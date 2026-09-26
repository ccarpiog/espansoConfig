/**
 * Phase 4-12 — the form builder's model half: the operations 4-10 handed on
 * (`values` items, option removal, removal of every definition), the builder's
 * view, *Add field* with a Choice or List definition, and the **Form**
 * insertion, as values.
 *
 * **Model evidence, never a screen.** The mounted half is
 * `../components/MatchEditorForms.test.ts`; the window half is owed to 4-13.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { describe, expect, it } from 'vitest';
import { DICTIONARIES, type TranslationKey } from '../i18n/dictionaries';
import { LOCALES } from '../i18n/locale';
import type {
  ContentRevision,
  DocumentView,
  FieldView,
  MatchDraft,
  MatchView,
  ReapplyResolution,
  ValueView,
  VariableView
} from '../ipc/types';
import { editDraft, isDirty } from './draft';
import type { AdoptTheDiskVersion } from './editorSave';
import {
  field,
  fixtureFieldShape,
  fixtureMappingPresence,
  makeConflict,
  makeDocument,
  makeMatch,
  makeSummary,
  makeVariable,
  scalarItem
} from './fixtures';
import {
  addField,
  fieldAdditionViewOf,
  formBuilderViewOf,
  formInsertionDraftOf,
  formInsertionProblemKey,
  formInsertionViewOf,
  formSelectionOfSeed,
  insertForm,
  layoutMalformationKey,
  newFieldKindKey,
  newFieldOf,
  removeAllRefusalKey,
  rowStatusKey,
  seededFormSelection,
  valuesProblemKey,
  withInsertedField,
  type FormInsertionDraft,
  type FormInsertionProblem
} from './formBuilder';
import { formAdditionRefusalKey, valuesOfLines } from './formEditor';
import type { InvalidationStatus } from './invalidation';
import {
  addFormField,
  addFormValuesItems,
  applySave,
  beginSave,
  canSave,
  conflictOf,
  discardFormValuesItem,
  editFormOption,
  editFormValuesItem,
  editFormValuesText,
  matchEditorView,
  reapplyToDiskVersion,
  removeFormField,
  removeFormFields,
  removeFormOption,
  removeFormValuesItem,
  restoreFormFields,
  restoreFormOption,
  restoreFormValuesItem,
  startMatchEditor,
  undoEdit,
  type MatchBuffers,
  type MatchEditorSession
} from './matchEditor';
import { attemptOfReapply } from './reapply';
import { matchRecoveryAvailability } from './recovery';
import type { ConflictModel } from './saveOutcome';
import { variableStructureGrantOf, variableStructureReadOf, type VariableStructureGrant } from './variableEditor';
import { nameContextOf } from './variableInsertion';

/** The revision every projection below is minted from. */
const BASE: ContentRevision = 'a'.repeat(64);

/** The revision the file holds after an external change. */
const AFTER: ContentRevision = 'b'.repeat(64);

/** The adoption a save that wrote nothing owes: none. */
const NOT_OWED: InvalidationStatus = { kind: 'notOwed' };

/** Nothing inserted into a definition's options. */
const NO_INSERT = { type: null, default: null, multiline: null, values: null, trim_string_values: null, extra: [] };

/**
 * A scalar list value.
 *
 * @param items - The items' texts.
 * @returns The projected value.
 */
function listOf(items: readonly string[]): ValueView {
  return { Sequence: items.map(scalarItem) };
} // End of function listOf()

/**
 * A definition's option mapping.
 *
 * @param entries - Key and value, in order.
 * @returns The projected value.
 */
function optionsOf(entries: readonly (readonly [string, ValueView])[]): ValueView {
  return { Mapping: entries.map(([key, value]) => field(key, value)) };
} // End of function optionsOf()

/**
 * The shorthand form's definitions:
 *
 * - `pick` — a choice with a `values` list of three and an option this editor
 *   does not draft (`hint`);
 * - `lines` — a list whose `values` is one multi-line text;
 * - `solo` — a single option.
 */
const FIELDS: readonly FieldView[] = [
  field('pick', optionsOf([['type', scalarItem('choice')], ['values', listOf(['a', 'b', 'c'])], ['hint', scalarItem('x')]])),
  field('lines', optionsOf([['type', scalarItem('list')], ['values', scalarItem('one\ntwo')]])),
  field('solo', optionsOf([['multiline', scalarItem('true')]]))
];

/** The shorthand layout: `pick`, `lines`, and `q` with no definition. */
const LAYOUT = 'P: [[pick]] L: [[lines]] Q: [[q]]';

/**
 * A snippet holding the shorthand form.
 *
 * @param overrides - Whatever the case needs.
 * @param revision - The revision.
 * @returns The projection.
 */
function shorthand(overrides: Parameters<typeof makeMatch>[0] = {}, revision: ContentRevision = BASE): MatchView {
  return makeMatch({ revision, document: 1, node: 1, trigger: ':f', form: LAYOUT, contentKind: 'Form', formFields: FIELDS, ...overrides });
} // End of function shorthand()

/**
 * A `type: form` variable holding `x` (with a `values` list) under `layout`.
 *
 * @returns The variable.
 */
function formVariable(): VariableView {
  const definitions = [field('x', optionsOf([['type', scalarItem('list')], ['values', listOf(['m', 'n'])]]))];
  return {
    ...makeVariable({
      node: 20,
      name: 'f',
      declaredType: 'form',
      kind: 'Form',
      params: [field('layout', scalarItem('X: [[x]]')), field('fields', { Mapping: definitions })]
    }),
    fields_presence: fixtureMappingPresence(definitions),
    field_shapes: definitions.map(fixtureFieldShape)
  };
} // End of function formVariable()

/**
 * A snippet with a verbose form and a replacement text.
 *
 * @returns The projection.
 */
function verbose(): MatchView {
  return makeMatch({ revision: BASE, document: 1, node: 1, trigger: ':v', replace: 'Hi ', vars: [formVariable()] });
} // End of function verbose()

/**
 * A plain snippet with a replacement text and no form.
 *
 * @returns The projection.
 */
function plain(): MatchView {
  return makeMatch({ revision: BASE, document: 1, node: 1, trigger: ':p', replace: 'Hello ' });
} // End of function plain()

/**
 * A session over a projection.
 *
 * @param match - The projection.
 * @returns A clean session.
 */
function session(match: MatchView = shorthand()): MatchEditorSession {
  return startMatchEditor(match, () => 0);
} // End of function session()

/**
 * The file a projection lives in.
 *
 * @param matches - The snippets.
 * @param revision - Its revision.
 * @returns The projection.
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
  return variableStructureGrantOf(held.match, variableStructureReadOf([file([shorthand(), verbose(), plain()])], 1, []));
} // End of function granted()

/**
 * The draft a save of this session would send.
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
 * A session showing a save conflict.
 *
 * @param held - The edited session.
 * @param subject - What the correspondence search answered.
 * @param disk - What the disk snapshot holds.
 * @returns The session showing the conflict.
 */
function saveConflicted(
  held: MatchEditorSession,
  subject: ReapplyResolution = { Unsupported: {} },
  disk: readonly MatchView[] = []
): MatchEditorSession {
  const started = beginSave(held, () => held);
  if (started === null) {
    throw new Error('this case needs a saveable session');
  }
  return applySave(
    started.session,
    makeConflict({ disk: file(disk, AFTER), subject, expected: BASE, found: AFTER }),
    NOT_OWED,
    () => started.session
  );
} // End of function saveConflicted()

/**
 * Conflicts a session over a save and reapplies it onto `target`.
 *
 * @param held - The edited session.
 * @param target - The disk snapshot's snippet the correspondence identifies.
 * @returns What became of the attempt.
 */
function reapplyOnto(held: MatchEditorSession, target: MatchView): ReturnType<typeof reapplyToDiskVersion> {
  const stuck = saveConflicted(held, { Identified: { target } }, [target]);
  const adopt: AdoptTheDiskVersion<MatchBuffers> = (_conflict: ConflictModel<MatchBuffers>) => 'installed';
  return reapplyToDiskVersion(stuck, adopt, null, () => stuck);
} // End of function reapplyOnto()

/**
 * The shorthand form's first definition's wire draft.
 *
 * @param held - The session.
 * @param index - The definition's position.
 * @returns Its `FormFieldDraft`, or `undefined`.
 */
function definitionSent(held: MatchEditorSession, index: number): MatchDraft['form_fields'][number] | undefined {
  return sent(held).form_fields.find((one) => one.index === index);
} // End of function definitionSent()

describe('an option is taken out explicitly, and restored', () => {
  it('drafts a Remove of the option by its position, as its own history step, and restores it', () => {
    const held = session();
    const removed = removeFormOption(held, granted(held), 0, 0, 2);
    expect(isDirty(removed.draft)).toBe(true);
    expect(removed.draft.past).toHaveLength(1);
    expect(definitionSent(removed, 0)).toEqual({
      index: 0,
      options: [{ index: 2, value: 'Remove', items: [] }],
      insert_options: NO_INSERT,
      values: []
    });
    const back = restoreFormOption(removed, 0, 0, 2);
    expect(isDirty(back.draft)).toBe(false);
    expect(undoEdit(removed).draft.value).toEqual(held.draft.value);
  });

  it('keeps a removed option’s box text and sends only the removal; a restoration brings the edit back', () => {
    let held = editFormOption(session(), 0, 0, 'type', 'list');
    held = removeFormOption(held, granted(held), 0, 0, 0);
    expect(definitionSent(held, 0)?.options).toEqual([{ index: 0, value: 'Remove', items: [] }]);
    expect(editFormOption(held, 0, 0, 'type', 'text')).toBe(held);
    const back = restoreFormOption(held, 0, 0, 0);
    expect(definitionSent(back, 0)?.options).toEqual([{ index: 0, value: { Set: 'list' }, items: [] }]);
  });

  it('refuses the last option, a stale grant, and a definition’s removal over it', () => {
    const held = session();
    expect(removeFormOption(held, granted(held), 0, 2, 0)).toBe(held);
    const refused: VariableStructureGrant = { kind: 'refused', reason: 'staleDraftInDocument' };
    expect(removeFormOption(held, refused, 0, 0, 2)).toBe(held);
    const gone = removeFormField(held, granted(held), 0, 0);
    expect(removeFormOption(gone, granted(gone), 0, 0, 2)).toBe(gone);
  });
});

describe('values: a list item by item, a text as one text', () => {
  it('rewrites one item by its position, inside the values option’s entry draft', () => {
    const held = editFormValuesItem(session(), 0, 0, 1, 'B');
    expect(definitionSent(held, 0)).toEqual({
      index: 0,
      options: [{ index: 1, value: 'Unchanged', items: [{ index: 1, value: { Set: 'B' } }] }],
      insert_options: NO_INSERT,
      values: []
    });
    const back = editFormValuesItem(held, 0, 0, 1, 'b');
    expect(isDirty(back.draft)).toBe(false);
  });

  it('removes items explicitly, never the last one kept, and sends no rewrite of a removed item', () => {
    let held = editFormValuesItem(session(), 0, 0, 0, 'A');
    held = removeFormValuesItem(held, granted(held), 0, 0, 0);
    held = removeFormValuesItem(held, granted(held), 0, 0, 1);
    expect(removeFormValuesItem(held, granted(held), 0, 0, 2)).toBe(held);
    expect(definitionSent(held, 0)).toEqual({
      index: 0,
      options: [],
      insert_options: NO_INSERT,
      values: [{ RemoveItem: { index: 0 } }, { RemoveItem: { index: 1 } }]
    });
    const back = restoreFormValuesItem(held, 0, 0, 0);
    expect(definitionSent(back, 0)?.options).toEqual([
      { index: 1, value: 'Unchanged', items: [{ index: 0, value: { Set: 'A' } }] }
    ]);
  });

  it('adds new values at the end, one per line, as one step; refuses empty lines and a carriage return', () => {
    const held = session();
    const outcome = addFormValuesItems(held, granted(held), 0, 0, 'd\ne\n');
    expect(outcome.kind).toBe('added');
    if (outcome.kind !== 'added') {
      throw new Error('this case needs the addition');
    }
    expect(outcome.session.draft.past).toHaveLength(1);
    expect(definitionSent(outcome.session, 0)?.values).toEqual([{ InsertItems: { at: { End: {} }, items: ['d', 'e'] } }]);
    expect(addFormValuesItems(held, granted(held), 0, 0, 'd\n\ne')).toMatchObject({ kind: 'refused', problem: 'emptyValue' });
    expect(addFormValuesItems(held, granted(held), 0, 0, '')).toMatchObject({ kind: 'refused', problem: 'noValues' });
    expect(addFormValuesItems(held, granted(held), 0, 0, 'd\re')).toMatchObject({ kind: 'refused', problem: 'unreadableText' });
    expect(addFormValuesItems(held, granted(held), 0, 1, 'd')).toMatchObject({ kind: 'refused', problem: 'notAList' });
    const dropped = discardFormValuesItem(outcome.session, 0, 0, 0);
    expect(definitionSent(dropped, 0)?.values).toEqual([{ InsertItems: { at: { End: {} }, items: ['e'] } }]);
  });

  it('refuses a line feed or a carriage return in an item box, at edit and at send', () => {
    const held = session();
    expect(editFormValuesItem(held, 0, 0, 0, 'a\nb')).toBe(held);
    expect(editFormValuesItem(held, 0, 0, 0, 'a\rb')).toBe(held);
    const forged: MatchEditorSession = {
      ...held,
      draft: editDraft(held.draft, {
        ...held.draft.value,
        forms: {
          forms: held.draft.value.forms.forms.map((form, at) =>
            at !== 0
              ? form
              : {
                  ...form,
                  definitions: form.definitions.map((one, index) =>
                    index !== 0 || one.values.kind !== 'list'
                      ? one
                      : { ...one, values: { ...one.values, added: ['x\ny'] } }
                  )
                }
          )
        }
      })
    };
    expect(beginSave(forged, () => forged)).toBeNull();
  });

  it('edits a multi-line values text as one text, never as a list', () => {
    const held = editFormValuesText(session(), 0, 1, 'one\ntwo\nthree');
    expect(definitionSent(held, 1)).toEqual({
      index: 1,
      options: [{ index: 1, value: { Set: 'one\ntwo\nthree' }, items: [] }],
      insert_options: NO_INSERT,
      values: []
    });
    expect(editFormValuesText(held, 0, 1, 'x\ry')).toBe(held);
    expect(addFormValuesItems(held, granted(held), 0, 1, 'four')).toMatchObject({ problem: 'notAList' });
  });
});

describe('every definition is taken out by one explicit action', () => {
  it('sends RemoveFields as the form’s only intent, keeps the boxes, and restores', () => {
    let held = editFormOption(session(), 0, 0, 'type', 'list');
    held = removeFormFields(held, granted(held), 0);
    const draft = sent(held);
    expect(draft.form_intents).toEqual([{ RemoveFields: {} }]);
    expect(draft.form_fields).toEqual([]);
    expect(draft.form).toBe('Unchanged');
    expect(editFormOption(held, 0, 0, 'type', 'text')).toBe(held);
    expect(addFormField(held, granted(held), 0, { field: newField('late'), selection: null })).toMatchObject({
      kind: 'refused',
      refusal: { kind: 'definitionsRemoved' }
    });
    const back = restoreFormFields(held, 0);
    expect(definitionSent(back, 0)?.options).toEqual([{ index: 0, value: { Set: 'list' }, items: [] }]);
  });

  it('is withheld while the draft adds a definition, with its reason', () => {
    const held = session();
    const outcome = addFormField(held, granted(held), 0, { field: newField('extra'), selection: null });
    if (outcome.kind !== 'added') {
      throw new Error('this case needs the addition');
    }
    expect(removeFormFields(outcome.session, granted(outcome.session), 0)).toBe(outcome.session);
    const view = formBuilderViewOf(outcome.session, null, granted(outcome.session));
    expect(view.forms[0]?.removeAllRefusal).toBe('additionsPending');
  });

  it('writes the verbose form’s RemoveFields into its variable', () => {
    const held = session(verbose());
    const removed = removeFormFields(held, granted(held), 0);
    expect(sent(removed).vars).toEqual([
      expect.objectContaining({ index: 0, fields: [], field_intents: [{ RemoveFields: {} }] })
    ]);
  });
});

/**
 * A new definition with no options.
 *
 * @param name - The name.
 * @returns The definition.
 */
function newField(name: string): { readonly name: string; readonly options: typeof NO_INSERT } {
  return { name, options: NO_INSERT };
} // End of function newField()

describe('the builder’s view', () => {
  it('draws the rows the layout derives, with no controls until one is selected', () => {
    const held = session();
    const view = formBuilderViewOf(held, null, granted(held));
    expect(view.forms).toHaveLength(1);
    const form = view.forms[0];
    expect(form?.layout).toEqual({ kind: 'contentField' });
    expect(form?.rows.map((row) => [row.key, row.status, row.typeText, row.advisory])).toEqual([
      ['existing:0', 'file', 'choice', null],
      ['existing:1', 'file', 'list', null],
      ['placeholder:q', 'undefined', '', 'noDefinition'],
      ['existing:2', 'file', '', 'noOccurrence']
    ]);
    expect(form?.selected).toBeNull();
  });

  it('shows the selected definition’s options as text boxes, its values in their own shape, and unknown source', () => {
    const held = session();
    const selected = formBuilderViewOf(held, { kind: 'row', form: 0, row: 'existing:0' }, granted(held)).forms[0]?.selected;
    if (selected?.kind !== 'existing') {
      throw new Error('this case needs the definition’s controls');
    }
    expect(selected.options.map((one) => [one.key, one.text, one.present, one.oneLine])).toEqual([
      ['type', 'choice', true, true],
      ['default', '', false, false],
      ['multiline', '', false, true],
      ['trim_string_values', '', false, true]
    ]);
    expect(selected.options[0]?.suggestions).toEqual(['text', 'choice', 'list']);
    expect(selected.values).toMatchObject({ kind: 'list', items: [{ text: 'a' }, { text: 'b' }, { text: 'c' }], canAdd: true });
    expect(selected.others).toEqual([{ option: 2, key: 'hint', texts: ['x'], shape: null, removed: false, canRemove: true }]);
    const text = formBuilderViewOf(held, { kind: 'row', form: 0, row: 'existing:1' }, granted(held)).forms[0]?.selected;
    expect(text).toMatchObject({ kind: 'existing', values: { kind: 'text', text: 'one\ntwo', editable: true } });
  });

  it('shows a known option its box cannot hold, and a repeated one, as unknown source (the 4-12 review)', () => {
    const odd = shorthand({
      formFields: [field('odd', optionsOf([['default', listOf(['hidden'])], ['type', scalarItem('text')], ['type', scalarItem('choice')]]))]
    });
    const held = session(odd);
    const selected = formBuilderViewOf(held, { kind: 'row', form: 0, row: 'existing:0' }, granted(held)).forms[0]?.selected;
    if (selected?.kind !== 'existing') {
      throw new Error('this case needs the definition’s controls');
    }
    expect(selected.others.map((one) => [one.option, one.key, one.texts])).toEqual([
      [0, 'default', ['hidden']],
      [1, 'type', ['text']],
      [2, 'type', ['choice']]
    ]);
  });

  it('never infers a type: a quoted or unusual type is shown as its text (D2u)', () => {
    const odd = shorthand({ formFields: [field('pick', optionsOf([['type', scalarItem('Choice ')]]))] });
    const held = session(odd);
    expect(formBuilderViewOf(held, null, granted(held)).forms[0]?.rows[0]?.typeText).toBe('Choice ');
  });

  it('draws a verbose form with its own layout box, and marks a changed row', () => {
    const held = editFormValuesItem(session(verbose()), 0, 0, 0, 'M');
    const view = formBuilderViewOf(held, null, granted(held));
    expect(view.forms[0]).toMatchObject({ shape: 'verbose', variableName: 'f', layout: { kind: 'box', text: 'X: [[x]]' } });
    expect(view.forms[0]?.rows[0]?.status).toBe('edited');
  });

  it('clears a selection once the forms baseline it was made over is replaced', () => {
    const held = session();
    const seeded = seededFormSelection(held, { kind: 'row', form: 0, row: 'existing:0' });
    expect(formSelectionOfSeed(held, seeded)).toEqual({ kind: 'row', form: 0, row: 'existing:0' });
    const reseeded = session();
    expect(formSelectionOfSeed(reseeded, seeded)).toBeNull();
  });
});

describe('Add field with a Choice or List definition, explicit and compound', () => {
  it('describes a choice with its values as a list, and a text field by its type alone', () => {
    expect(newFieldOf({ name: 'c', kind: 'choice', values: 'yes\nno\n' })).toEqual({
      field: { name: 'c', options: { ...NO_INSERT, type: 'choice', values: { List: ['yes', 'no'] } } }
    });
    expect(newFieldOf({ name: 't', kind: 'text', values: 'ignored' })).toEqual({
      field: { name: 't', options: { ...NO_INSERT, type: 'text' } }
    });
    expect(newFieldOf({ name: 'l', kind: 'list', values: '' })).toEqual({ problem: 'noValues' });
  });

  it('defines a placeholder the layout holds as a list, alone, and adds a new field into the layout as one step', () => {
    const held = session();
    const defined = addField(held, granted(held), 0, { name: 'q', kind: 'list', values: 'r\ns' }, null);
    if (defined.kind !== 'added') {
      throw new Error('this case needs the definition');
    }
    expect(sent(defined.session).form).toBe('Unchanged');
    expect(sent(defined.session).form_intents).toEqual([
      { InsertField: { after: null, field: { name: 'q', options: { ...NO_INSERT, type: 'list', values: { List: ['r', 's'] } } } } }
    ]);
    const compound = addField(held, granted(held), 0, { name: 'z', kind: 'choice', values: 'u' }, { start: 0, end: 0 });
    if (compound.kind !== 'added') {
      throw new Error('this case needs the addition');
    }
    expect(sent(compound.session).form).toEqual({ Set: `[[z]]${LAYOUT}` });
    expect(compound.session.draft.past).toHaveLength(1);
    expect(undoEdit(compound.session).draft.value).toEqual(held.draft.value);
    expect(addField(held, granted(held), 0, { name: 'z', kind: 'choice', values: 'u\n\nv' }, null)).toMatchObject({
      kind: 'problem',
      problem: 'emptyValue'
    });
  });

  it('says why a name is refused before the press', () => {
    const held = session();
    expect(fieldAdditionViewOf(held, 0, granted(held), { name: 'pick', kind: 'text', values: '' })).toMatchObject({
      refusal: { kind: 'name', reason: 'takenByDefinition' },
      canAdd: false
    });
    expect(fieldAdditionViewOf(held, 0, granted(held), { name: 'ok', kind: 'text', values: '' }).canAdd).toBe(true);
  });
});

/**
 * The Form insertion's panel over a plain snippet, with a layout.
 *
 * @param held - The session.
 * @param layout - The layout.
 * @returns The panel.
 */
function insertionPanel(held: MatchEditorSession, layout: string): FormInsertionDraft {
  return { ...formInsertionDraftOf(held, nameContextOf(held, null, null)), layout };
} // End of function insertionPanel()

describe('the Form insertion: one compound action, one save', () => {
  it('inserts the selected {{name.field}} references and the form variable as one history step', () => {
    const held = session(plain());
    let panel = insertionPanel(held, 'A: [[a]] B: [[b]] [[a]]');
    expect(panel.name).toBe('form');
    panel = withInsertedField(panel, { name: 'b', kind: 'choice', values: 'x\ny', referenced: true });
    const context = nameContextOf(held, null, null);
    const view = formInsertionViewOf(held, context, granted(held), panel);
    expect(view.fields.map((one) => [one.name, one.kind])).toEqual([['a', 'none'], ['b', 'choice']]);
    expect(view.referenceText).toBe('{{form.a}} {{form.b}}');
    expect(view.verdict).toEqual({ kind: 'available', scope: 'open' });
    expect(view.canInsert).toBe(true);
    const outcome = insertForm(held, granted(held), context, panel, { start: 6, end: 6 });
    if (outcome.kind !== 'inserted') {
      throw new Error('this case needs the insertion');
    }
    expect(outcome.session.draft.past).toHaveLength(1);
    const draft = sent(outcome.session);
    expect(draft.replace).toEqual({ Set: 'Hello {{form.a}} {{form.b}}' });
    expect(draft.var_intents).toEqual([
      {
        InsertVariable: {
          at: { End: {} },
          variable: {
            name: 'form',
            params: {
              Form: {
                layout: 'A: [[a]] B: [[b]] [[a]]',
                fields: [{ name: 'b', options: { ...NO_INSERT, type: 'choice', values: { List: ['x', 'y'] } } }]
              }
            },
            inject_vars: null,
            depends_on: null,
            extra_params: []
          }
        }
      }
    ]);
    expect(undoEdit(outcome.session).draft.value).toEqual(held.draft.value);
  });

  it('references only the fields chosen, and names each problem', () => {
    const held = session(plain());
    const context = nameContextOf(held, null, null);
    const panel = withInsertedField(insertionPanel(held, '[[a]] [[b]]'), { name: 'a', kind: 'none', values: '', referenced: false });
    expect(formInsertionViewOf(held, context, granted(held), panel).referenceText).toBe('{{form.b}}');
    /**
     * The problem a panel is refused for.
     *
     * @param draft - The panel.
     * @returns The problem.
     */
    const problemOf = (draft: FormInsertionDraft): FormInsertionProblem | null =>
      formInsertionViewOf(held, context, granted(held), draft).problem;
    expect(problemOf(insertionPanel(held, ''))).toEqual({ kind: 'noLayout' });
    expect(problemOf(insertionPanel(held, 'no fields [[ x]]'))).toEqual({ kind: 'noPlaceholder' });
    expect(problemOf(insertionPanel(held, 'a\r[[a]]'))).toEqual({ kind: 'unreadableLayout' });
    expect(problemOf(withInsertedField(insertionPanel(held, '[[a]]'), { name: 'a', kind: 'none', values: '', referenced: false }))).toEqual({
      kind: 'noReference'
    });
    expect(problemOf(withInsertedField(insertionPanel(held, '[[a]]'), { name: 'a', kind: 'list', values: '', referenced: true }))).toEqual({
      kind: 'values',
      field: 'a',
      problem: 'noValues'
    });
    const formSnippet = session();
    expect(formInsertionViewOf(formSnippet, nameContextOf(formSnippet, null, null), granted(formSnippet), insertionPanel(formSnippet, '[[a]]')).problem).toEqual({
      kind: 'noTarget'
    });
  });

  it('is refused for recreate-as-new after a conflict (ruling 21)', () => {
    const held = session(plain());
    const context = nameContextOf(held, null, null);
    const outcome = insertForm(held, granted(held), context, insertionPanel(held, '[[a]]'), { start: 0, end: 0 });
    if (outcome.kind !== 'inserted') {
      throw new Error('this case needs the insertion');
    }
    const stuck = saveConflicted(outcome.session);
    const conflict = matchEditorView(stuck).retainedDraft;
    expect(conflict.some((row) => row.label === 'params' && row.text === '[[a]]')).toBe(true);
    const adopt: AdoptTheDiskVersion<MatchBuffers> = (_conflict: ConflictModel<MatchBuffers>) => 'installed';
    const attempt = attemptOfReapply(stuck, reapplyToDiskVersion(stuck, adopt, null, () => stuck));
    const summary = makeSummary({ id: 1, relativePath: 'match/base.yml' });
    const availability = matchRecoveryAvailability(attempt.outcome, conflictOf(stuck), stuck.baseline, [summary], [file([], AFTER)]);
    expect(availability).toEqual({ kind: 'unavailable', reason: 'variablesNotCarried' });
  });
});

describe('the new edits live through conflict, reapply and recovery', () => {
  it('retains option removals, values items and a container removal, row by row', () => {
    let held = removeFormOption(session(), granted(session()), 0, 0, 2);
    held = editFormValuesItem(held, 0, 0, 0, 'A');
    held = removeFormValuesItem(held, granted(held), 0, 0, 1);
    const added = addFormValuesItems(held, granted(held), 0, 0, 'd');
    if (added.kind !== 'added') {
      throw new Error('this case needs the values');
    }
    held = editFormValuesText(added.session, 0, 1, 'one');
    const stuck = saveConflicted(held);
    expect(canSave(stuck)).toBe(false);
    expect(matchEditorView(stuck).retainedDraft.slice(17)).toEqual([
      { label: 'formField', text: 'pick', status: 'fieldEdited' },
      { label: 'formOption', text: 'hint', status: 'removing' },
      { label: 'formOption', text: 'values', status: 'optionName' },
      { label: 'formOption', text: 'A', status: 'setting' },
      { label: 'formOption', text: 'b', status: 'itemRemoved' },
      { label: 'formOption', text: 'd', status: 'itemAdded' },
      { label: 'formField', text: 'lines', status: 'fieldEdited' },
      { label: 'formOption', text: 'values', status: 'optionName' },
      { label: 'formOption', text: 'one', status: 'optionValue' }
    ]);
    const all = removeFormFields(session(), granted(session()), 0);
    expect(matchEditorView(saveConflicted(all)).retainedDraft.slice(17)).toEqual([
      { label: 'formFields', text: '', status: 'removing' }
    ]);
  });

  it('reapplies the new edits over an unchanged container and collides a changed one', () => {
    const held = removeFormValuesItem(session(), granted(session()), 0, 0, 1);
    const same = reapplyOnto(held, shorthand({ label: 'elsewhere' }, AFTER));
    if (same.kind !== 'reapplied') {
      throw new Error('this case needs the reapply');
    }
    expect(definitionSent(same.session, 0)?.values).toEqual([{ RemoveItem: { index: 1 } }]);
    const changed = shorthand({ formFields: [FIELDS[1] as FieldView, FIELDS[0] as FieldView, FIELDS[2] as FieldView] }, AFTER);
    expect(reapplyOnto(held, changed)).toEqual({
      kind: 'manualResolution',
      obstacle: { kind: 'fieldCollisions', fields: ['form_fields'] }
    });
  });
});

describe('every new code has a sentence in both languages', () => {
  it('maps each code to a key both dictionaries hold', () => {
    const keys: TranslationKey[] = [
      ...(['file', 'edited', 'removed', 'added', 'undefined'] as const).flatMap((status) => {
        const key = rowStatusKey(status);
        return key === null ? [] : [key];
      }),
      ...(['noDefinitions', 'additionsPending', 'formNotEditable'] as const).map(removeAllRefusalKey),
      ...(['notAList', 'noValues', 'emptyValue', 'unreadableText'] as const).map(valuesProblemKey),
      ...(['empty', 'invalidIdentifier', 'unterminated'] as const).map(layoutMalformationKey),
      ...(['text', 'choice', 'list', 'none'] as const).map(newFieldKindKey),
      ...(
        [
          { kind: 'noTarget' },
          { kind: 'noLayout' },
          { kind: 'unreadableLayout' },
          { kind: 'noPlaceholder' },
          { kind: 'noReference' },
          { kind: 'values', field: 'a', problem: 'noValues' }
        ] as const
      ).map(formInsertionProblemKey),
      formAdditionRefusalKey({ kind: 'definitionsRemoved' })
    ];
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      for (const locale of LOCALES) {
        expect(DICTIONARIES[locale][key]).toBeTruthy();
      } // End of the loop over the locales
    } // End of the loop over the keys
    expect(DICTIONARIES.es['browser.formBuilder.insert.values']).toContain('{name}');
  });

  it('reads values one per line with the Choice insertion’s rule', () => {
    expect(valuesOfLines('a\nb\n')).toEqual({ values: ['a', 'b'] });
    expect(valuesOfLines('a\n\nb')).toEqual({ problem: 'emptyValue' });
  });
});
