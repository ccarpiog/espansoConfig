/**
 * Phase 4-10 — the form editor's model, as values.
 *
 * What this file pins, clause by clause of step 4-10's acceptance
 * (`docs/decisions/4-split-notes.md` §2):
 *
 * - **a layout edit creates or deletes no definition**, in both shapes;
 * - ***Add field* changes both parts and undo restores both**, in both shapes;
 * - **repeated placeholders share one row**, and definition-only rows are rows;
 * - **an absent field left blank is `'Unchanged'`**;
 * - **a layout holding `\r` is refused at load, edit and send** — the CRLF
 *   file's untouched bytes are checked separately, in Rust
 *   (`the_form_editors_wire_draft_keeps_a_crlf_files_untouched_bytes` in
 *   `crates/espansoconfig-core/tests/form_definitions.rs`), over the exact wire
 *   draft pinned here;
 * - **every new value has a lifecycle disposition**: save, discard (undo),
 *   conflict of both origins with retention and copy, reapply, recovery and
 *   reparse.
 *
 * **Model evidence, never a screen**: nothing here is mounted. The form
 * builder's mounted evidence is `../components/MatchEditorForms.test.ts` (Phase
 * 4-12); the window is owed to 4-13.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { describe, expect, it } from 'vitest';
import { DICTIONARIES } from '../i18n/dictionaries';
import { LOCALES } from '../i18n/locale';
import type {
  ContentRevision,
  CorrespondenceEntry,
  DocumentView,
  FieldView,
  Finding,
  MatchDraft,
  MatchView,
  NewFormField,
  ReapplyResolution,
  SaveResult,
  ValueView,
  VariableView
} from '../ipc/types';
import type { ExternalConflictObservation } from './conflictSource';
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
  formAdditionRefusalKey,
  formFieldRefusalKey,
  formRowAdvisoryKey,
  layoutPiecesOf,
  type FormAdditionRefusal,
  type FormFieldRefusal,
  type FormRowAdvisory
} from './formEditor';
import type { InvalidationStatus } from './invalidation';
import {
  acknowledgeFindings,
  addFormField,
  applyObservation,
  applySave,
  beginSave,
  canSave,
  conflictOf,
  discardAddedFormField,
  editField,
  editFormLayout,
  editFormOption,
  formFieldRemovalPreview,
  formRows,
  matchDraftOf,
  matchEditorView,
  redoEdit,
  reapplyToDiskVersion,
  removeFormField,
  removeVariable,
  restoreFormField,
  restoreVariable,
  saveWithheldKey,
  startMatchEditor,
  undoEdit,
  type MatchBuffers,
  type MatchEditorSession
} from './matchEditor';
import { arbitratedDelivery } from './observationDelivery';
import { matchRecoveryAvailability } from './recovery';
import { attemptOfReapply, type StandingOriginGuard } from './reapply';
import { referenceCopyOf, type ConflictModel } from './saveOutcome';
import {
  variableStructureGrantOf,
  variableStructureReadOf,
  type VariableStructureGrant
} from './variableEditor';

/** The revision every projection below is minted from. */
const BASE: ContentRevision = 'a'.repeat(64);

/** The revision the file holds after an external change. */
const AFTER: ContentRevision = 'b'.repeat(64);

/** The adoption a save that wrote nothing owes: none. */
const NOT_OWED: InvalidationStatus = { kind: 'notOwed' };

/** The adoption a committed save performed. */
const ADOPTED: InvalidationStatus = { kind: 'done' };

/**
 * A definition's option mapping.
 *
 * @param entries - Key and scalar text, in order.
 * @returns The projected value.
 */
function optionsOf(entries: readonly (readonly [string, string])[]): ValueView {
  return { Mapping: entries.map(([key, text]) => field(key, scalarItem(text))) };
} // End of function optionsOf()

/** The shorthand form's definitions: `alpha` (no `default`) and `gamma` (a `default`). */
const SHORT_FIELDS: readonly FieldView[] = [
  field('alpha', optionsOf([['type', 'choice']])),
  field('gamma', optionsOf([['type', 'text'], ['default', 'hi']]))
];

/** The shorthand layout: `alpha` twice, `beta` with no definition, `gamma` absent. */
const SHORT_LAYOUT = 'A: [[alpha]]\nB: [[beta]] and [[alpha]]\n';

/** A new definition *Add field* writes. */
const DELTA: NewFormField = {
  name: 'delta',
  options: { type: 'text', default: null, multiline: null, values: null, trim_string_values: null, extra: [] }
};

/**
 * A new definition named `name` with no option.
 *
 * @param name - The name.
 * @returns The definition.
 */
function bare(name: string): NewFormField {
  return { ...DELTA, name, options: { ...DELTA.options, type: null } };
} // End of function bare()

/**
 * A projection of a snippet holding the shorthand form.
 *
 * @param overrides - Whatever the case needs.
 * @param revision - The revision it is minted from.
 * @returns The projection.
 */
function shorthand(overrides: Parameters<typeof makeMatch>[0] = {}, revision: ContentRevision = BASE): MatchView {
  return makeMatch({
    revision,
    document: 1,
    node: 1,
    trigger: ':f',
    form: SHORT_LAYOUT,
    contentKind: 'Form',
    formFields: SHORT_FIELDS,
    ...overrides
  });
} // End of function shorthand()

/**
 * A `type: form` variable, projected as Rust would: `params.layout` (unless
 * `null`) and `params.fields`, with the kind-dependent presences the plain
 * fixture leaves out.
 *
 * @param layout - The layout text, or `null` for none.
 * @param definitions - The definitions.
 * @returns The variable.
 */
function formVariable(layout: string | null, definitions: readonly FieldView[]): VariableView {
  const params = [
    ...(layout === null ? [] : [field('layout', scalarItem(layout))]),
    field('fields', { Mapping: definitions })
  ];
  return {
    ...makeVariable({ node: 20, name: 'f', declaredType: 'form', kind: 'Form', params }),
    fields_presence: fixtureMappingPresence(definitions),
    field_shapes: definitions.map(fixtureFieldShape)
  };
} // End of function formVariable()

/** The verbose form's definitions. */
const VERBOSE_FIELDS: readonly FieldView[] = [field('x', optionsOf([['multiline', 'true']]))];

/**
 * A projection of a snippet holding one verbose form.
 *
 * @param layout - The form's layout, or `null`.
 * @param revision - The revision it is minted from.
 * @param definitions - The definitions.
 * @returns The projection.
 */
function verbose(
  layout: string | null = 'X: [[x]]',
  revision: ContentRevision = BASE,
  definitions: readonly FieldView[] = VERBOSE_FIELDS
): MatchView {
  return makeMatch({
    revision,
    document: 1,
    node: revision === BASE ? 1 : 9,
    trigger: ':v',
    replace: '{{f.x}}',
    vars: [formVariable(layout, definitions)]
  });
} // End of function verbose()

/**
 * A session over a projection, with a clock nothing advances.
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
 * @param revision - The file's revision.
 * @returns The projection.
 */
function file(matches: readonly MatchView[], revision: ContentRevision = BASE): DocumentView {
  return makeDocument({ id: 1, relativePath: 'match/base.yml', revision, matches });
} // End of function file()

/**
 * A structure grant over the session's own file.
 *
 * @param held - The session.
 * @param match - The projection the file holds.
 * @returns The grant.
 */
function granted(held: MatchEditorSession, match: MatchView = shorthand()): VariableStructureGrant {
  return variableStructureGrantOf(held.match, variableStructureReadOf([file([match])], 1, []));
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
 * *Add field*, answered with the session it drafted, or a failure.
 *
 * @param held - The session.
 * @param form - The form's position.
 * @param newField - The definition.
 * @param selection - The layout's selection, or `null`.
 * @param match - The projection the grant is minted over.
 * @returns The session.
 */
function added(
  held: MatchEditorSession,
  form: number,
  newField: NewFormField,
  selection: { readonly start: number; readonly end: number } | null,
  match: MatchView = shorthand()
): MatchEditorSession {
  const outcome = addFormField(held, granted(held, match), form, { field: newField, selection });
  if (outcome.kind !== 'added') {
    throw new Error(`this case needs the addition, not ${JSON.stringify(outcome.refusal)}`);
  }
  return outcome.session;
} // End of function added()

/**
 * The refusal *Add field* answers.
 *
 * @param held - The session.
 * @param form - The form's position.
 * @param newField - The definition.
 * @param selection - The layout's selection, or `null`.
 * @param grant - The grant, when not the session's own.
 * @returns The refusal.
 */
function refusalOf(
  held: MatchEditorSession,
  form: number,
  newField: NewFormField,
  selection: { readonly start: number; readonly end: number } | null,
  grant: VariableStructureGrant = granted(held)
): FormAdditionRefusal {
  const outcome = addFormField(held, grant, form, { field: newField, selection });
  if (outcome.kind !== 'refused') {
    throw new Error('this case needs a refusal');
  }
  expect(outcome.session).toBe(held);
  return outcome.refusal;
} // End of function refusalOf()

/**
 * A session showing a save conflict.
 *
 * @param held - The edited session.
 * @param subject - What the correspondence search answered.
 * @param diskMatches - What the disk snapshot holds.
 * @returns The session showing the conflict.
 */
function saveConflicted(
  held: MatchEditorSession,
  subject: ReapplyResolution = { Unsupported: {} },
  diskMatches: readonly MatchView[] = []
): MatchEditorSession {
  const started = beginSave(held, () => held);
  if (started === null) {
    throw new Error('this case needs a saveable session');
  }
  return applySave(
    started.session,
    makeConflict({ disk: file(diskMatches, AFTER), subject, expected: BASE, found: AFTER }),
    NOT_OWED,
    () => started.session
  );
} // End of function saveConflicted()

/**
 * One external observation of the file.
 *
 * @param entries - The correspondence table's rows.
 * @param diskMatches - What the disk snapshot holds.
 * @returns The observation.
 */
function observed(
  entries: readonly CorrespondenceEntry[],
  diskMatches: readonly MatchView[]
): ExternalConflictObservation {
  return {
    sequence: 5,
    document: 1,
    previousRevision: BASE,
    diskRevision: AFTER,
    diskText: 'matches: []\n',
    disk: file(diskMatches, AFTER),
    findings: [],
    correspondences: { base_revision: BASE, disk_revision: AFTER, entries }
  };
} // End of function observed()

/**
 * A conflicted session over one of the two origins, reapply-ready.
 *
 * @param held - The edited session.
 * @param origin - Which origin.
 * @param target - The disk snapshot's snippet the correspondence identifies.
 * @returns The conflicted session and the guard to reapply with.
 */
function conflictedOver(
  held: MatchEditorSession,
  origin: 'save' | 'external',
  target: MatchView
): { readonly stuck: MatchEditorSession; readonly stands: StandingOriginGuard | null } {
  const subject: ReapplyResolution = { Identified: { target } };
  if (origin === 'save') {
    return { stuck: saveConflicted(held, subject, [target]), stands: null };
  }
  const seen = observed([{ base: held.match, exact: { Unsupported: {} }, editor: subject }], [target]);
  const stuck = applyObservation(held, arbitratedDelivery(null, seen, false));
  const conflict = stuck.externalConflict;
  if (conflict === null) {
    throw new Error('this case needs an external conflict');
  }
  const source = conflict.source;
  return { stuck, stands: () => source };
} // End of function conflictedOver()

/**
 * Reapplies a conflicted session, adopting whatever it is handed.
 *
 * @param held - The conflicted session.
 * @param stands - The external origin's guard, or `null`.
 * @returns What became of the attempt.
 */
function reapply(held: MatchEditorSession, stands: StandingOriginGuard | null): ReturnType<typeof reapplyToDiskVersion> {
  const adopt: AdoptTheDiskVersion<MatchBuffers> = (_conflict: ConflictModel<MatchBuffers>) => 'installed';
  return reapplyToDiskVersion(held, adopt, stands, () => held);
} // End of function reapply()

/**
 * Conflicts a session over one origin and reapplies it.
 *
 * @param args - The edited session, the origin and the disk's snippet.
 * @returns What became of the attempt.
 */
function reapplyOver(
  args: readonly [MatchEditorSession, 'save' | 'external', MatchView]
): ReturnType<typeof reapplyToDiskVersion> {
  const { stuck, stands } = conflictedOver(...args);
  return reapply(stuck, stands);
} // End of function reapplyOver()

/**
 * The same session with its draft replaced by a buffer built by hand — what no
 * control can produce, and what `beginSave`'s gate exists for.
 *
 * @param held - The session.
 * @param forge - Builds the forged buffers from the live ones.
 * @returns The session holding them.
 */
function forged(held: MatchEditorSession, forge: (buffers: MatchBuffers) => MatchBuffers): MatchEditorSession {
  return { ...held, draft: editDraft(held.draft, forge(held.draft.value)) };
} // End of function forged()

// ---------------------------------------------------------------------------
// One model, two adapters
// ---------------------------------------------------------------------------

describe('one form model reads both storage shapes', () => {
  it('reads the shorthand form over the existing form field, with no second layout draft', () => {
    const held = session();
    const forms = held.baseline.forms.forms;
    expect(forms).toHaveLength(1);
    expect(forms[0]?.address).toEqual({ kind: 'shorthand' });
    // The layout is the seventeen-field record's `form`, and only that.
    expect(forms[0]?.layout).toBeNull();
    expect(held.draft.value.forms.forms[0]?.layout).toBeNull();
    expect(held.draft.value.form.text).toBe(SHORT_LAYOUT);
    expect(forms[0]?.definitions.map((one) => one.name)).toEqual(['alpha', 'gamma']);
    expect(matchDraftOf(held.baseline, held.draft.value)).toMatchObject({ form_fields: [], form_intents: [], vars: [] });
  });

  it('reads a verbose form from its variable, with its own layout box', () => {
    const held = session(verbose());
    const form = held.baseline.forms.forms[0];
    expect(form?.address).toEqual({ kind: 'verbose', variable: 0 });
    expect(form?.layout).toMatchObject({ present: true, value: 'X: [[x]]', index: 0, eligibility: { kind: 'editable' } });
    expect(form?.definitions.map((one) => one.name)).toEqual(['x']);
    expect(session(makeMatch({ trigger: ':p', replace: 'plain' })).baseline.forms.forms).toEqual([]);
  });
}); // End of the adapters suite

// ---------------------------------------------------------------------------
// Clause 1: a layout edit creates or deletes no definition
// ---------------------------------------------------------------------------

describe('a layout edit creates or deletes no definition (ruling 15)', () => {
  it('rewrites the shorthand layout alone, and only the rows follow it', () => {
    const held = session();
    const edited = editField(held, 'form', 'Only [[zeta]] now');
    const draft = sent(edited);
    expect(draft.form).toEqual({ Set: 'Only [[zeta]] now' });
    expect(draft.form_fields).toEqual([]);
    expect(draft.form_intents).toEqual([]);
    expect(draft.vars).toEqual([]);
    expect(edited.draft.value.forms).toEqual(held.draft.value.forms);
    expect(formRows(edited, 0)?.rows).toEqual([
      { name: 'zeta', occurrences: 1, definition: null, advisory: 'noDefinition' },
      { name: 'alpha', occurrences: 0, definition: { kind: 'existing', index: 0, removed: false }, advisory: 'noOccurrence' },
      { name: 'gamma', occurrences: 0, definition: { kind: 'existing', index: 1, removed: false }, advisory: 'noOccurrence' }
    ]);
    // Emptying the layout deletes nothing either.
    expect(sent(editField(held, 'form', '')).form_intents).toEqual([]);
  });

  it('rewrites a verbose layout as its params entry alone', () => {
    const held = session(verbose());
    const edited = editFormLayout(held, 0, 'Y: [[y]]');
    const draft = sent(edited);
    expect(draft.vars).toEqual([
      {
        index: 0,
        name: 'Unchanged',
        type: 'Unchanged',
        inject_vars: 'Unchanged',
        params: [{ index: 0, value: { Set: 'Y: [[y]]' }, items: [] }],
        insert_params: [],
        depends_on: [],
        records: [],
        lists: [],
        fields: [],
        field_intents: []
      }
    ]);
    expect(draft.var_intents).toEqual([]);
    expect(draft.form_intents).toEqual([]);
    expect(formRows(edited, 0)?.rows.map((row) => [row.name, row.advisory])).toEqual([
      ['y', 'noDefinition'],
      ['x', 'noOccurrence']
    ]);
    // A shorthand layout is never drafted through the verbose box.
    const short = session();
    expect(editFormLayout(short, 0, 'nope')).toBe(short);
  });

  it('merges a verbose layout edit into the variable editor’s own draft of that variable', () => {
    const held = session(verbose());
    const draft = sent(editFormLayout(editField(held, 'label', 'L'), 0, 'Z'));
    expect(draft.vars).toHaveLength(1);
    expect(draft.label).toEqual({ Set: 'L' });
  });
}); // End of the layout-edit suite

// ---------------------------------------------------------------------------
// Clause 2: Add field changes both parts, and undo restores both
// ---------------------------------------------------------------------------

describe('Add field is one compound action over both parts', () => {
  it('puts [[name]] into the shorthand layout and adds the definition, as one history step', () => {
    const held = session();
    const outcome = addFormField(held, granted(held), 0, { field: DELTA, selection: { start: 3, end: 3 } });
    if (outcome.kind !== 'added') {
      throw new Error('this case needs the addition');
    }
    const after = outcome.session;
    expect(after.draft.past).toHaveLength(1);
    expect(outcome.selection).toEqual({ start: 3 + '[[delta]]'.length, end: 3 + '[[delta]]'.length });
    const draft = sent(after);
    expect(draft.form).toEqual({ Set: `A: [[delta]]${SHORT_LAYOUT.slice(3)}` });
    expect(draft.form_intents).toEqual([{ InsertField: { after: null, field: DELTA } }]);
    expect(draft.form_fields).toEqual([]);
    const undone = undoEdit(after);
    expect(undone.draft.value).toEqual(held.draft.value);
    expect(isDirty(undone.draft)).toBe(false);
    expect(sent(redoEdit(undone))).toEqual(draft);
  });

  it('replaces a selection, in a verbose layout, and undo restores both there too', () => {
    const held = session(verbose());
    const after = added(held, 0, DELTA, { start: 3, end: 8 }, verbose());
    const draft = sent(after);
    expect(draft.vars[0]?.params).toEqual([{ index: 0, value: { Set: 'X: [[delta]]' }, items: [] }]);
    expect(draft.vars[0]?.field_intents).toEqual([{ InsertField: { after: null, field: DELTA } }]);
    expect(draft.form_intents).toEqual([]);
    expect(undoEdit(after).draft.value).toEqual(held.draft.value);
  });

  it('adds a definition alone for a placeholder the layout already holds', () => {
    const held = session();
    const after = added(held, 0, bare('beta'), null);
    const draft = sent(after);
    expect(draft.form).toBe('Unchanged');
    expect(draft.form_intents).toEqual([{ InsertField: { after: null, field: bare('beta') } }]);
    expect(formRows(after, 0)?.rows[1]).toEqual({
      name: 'beta',
      occurrences: 1,
      definition: { kind: 'added', position: 0 },
      advisory: null
    });
    // Discarding the new definition keeps the layout and cleans the draft.
    expect(isDirty(discardAddedFormField(after, 0, 0).draft)).toBe(false);
  });

  it('refuses a name it cannot give, a stale grant, and unreadable definitions — with codes', () => {
    const held = session();
    expect(refusalOf(held, 0, bare(''), null)).toEqual({ kind: 'name', reason: 'empty' });
    expect(refusalOf(held, 0, bare('two words'), null)).toEqual({ kind: 'name', reason: 'notAnIdentifier' });
    expect(refusalOf(held, 0, bare('alpha'), null)).toEqual({ kind: 'name', reason: 'takenByDefinition' });
    expect(refusalOf(added(held, 0, DELTA, null), 0, DELTA, null)).toEqual({ kind: 'name', reason: 'takenByAddition' });
    const stale = variableStructureGrantOf(
      held.match,
      variableStructureReadOf([file([shorthand()])], 1, [{ document: 1, revision: 'c'.repeat(64), node: 5 }])
    );
    expect(refusalOf(held, 0, DELTA, null, stale)).toEqual({ kind: 'structure', reason: 'staleDraftInDocument' });
    const nowhere = { key_node: 0, key_span: { start: 0, end: 0 }, value_node: 0, value_span: { start: 0, end: 0 }, path: null };
    const flow = session({ ...shorthand(), form_fields_presence: { Entries: { location: nowhere, flow: true, count: 2 } } });
    expect(refusalOf(flow, 0, DELTA, null)).toEqual({ kind: 'definitionsNotABlockMapping' });
    expect(removeFormField(flow, granted(flow), 0, 0)).toBe(flow);
    const unreadable = session(shorthand({ formFields: [{ key: null, key_node: 0, value: { Mapping: [] } }] }));
    expect(refusalOf(unreadable, 0, DELTA, null)).toEqual({ kind: 'definitionsUnreadable' });
    for (const refusal of [
      { kind: 'formNotEditable' },
      { kind: 'layoutNotEditable' },
      { kind: 'structure', reason: 'readOnly' },
      { kind: 'definitionsNotABlockMapping' },
      { kind: 'definitionsUnreadable' },
      { kind: 'name', reason: 'takenByAddition' },
      { kind: 'unreadableText' }
    ] as const satisfies readonly FormAdditionRefusal[]) {
      for (const locale of LOCALES) {
        expect(DICTIONARIES[locale][formAdditionRefusalKey(refusal)]).toBeTruthy();
      } // End of the loop over the locales
    } // End of the loop over the refusals
  });

  it('removes a definition explicitly, previews what the layout keeps, and restores it', () => {
    const held = session();
    expect(formFieldRemovalPreview(held, 0, 0)).toEqual({ name: 'alpha', occurrencesKept: 2 });
    const removed = removeFormField(held, granted(held), 0, 0);
    const draft = sent(removed);
    expect(draft.form_intents).toEqual([{ RemoveField: { index: 0 } }]);
    expect(draft.form).toBe('Unchanged');
    expect(formRows(removed, 0)?.rows[0]).toEqual({
      name: 'alpha',
      occurrences: 2,
      definition: { kind: 'existing', index: 0, removed: true },
      advisory: 'noDefinition'
    });
    const both = removeFormField(removed, granted(removed), 0, 1);
    expect(canSave(both)).toBe(false);
    expect(matchEditorView(both).saveWithheld).toBe('formFieldsWouldBeEmpty');
    for (const locale of LOCALES) {
      expect(DICTIONARIES[locale][saveWithheldKey('formFieldsWouldBeEmpty')]).toBeTruthy();
    } // End of the loop over the locales
    expect(isDirty(restoreFormField(removed, 0, 0).draft)).toBe(false);
  });
}); // End of the Add field suite

// ---------------------------------------------------------------------------
// Clause 3: repeated placeholders share one row
// ---------------------------------------------------------------------------

describe('repeated placeholders share one row, and definition-only rows are rows', () => {
  it('draws one row per name, in layout order, then the definition-only rows', () => {
    const rows = formRows(session(), 0);
    expect(rows?.fullySupported).toBe(true);
    expect(rows?.rows).toEqual([
      { name: 'alpha', occurrences: 2, definition: { kind: 'existing', index: 0, removed: false }, advisory: null },
      { name: 'beta', occurrences: 1, definition: null, advisory: 'noDefinition' },
      { name: 'gamma', occurrences: 0, definition: { kind: 'existing', index: 1, removed: false }, advisory: 'noOccurrence' }
    ]);
  });

  it('does not claim a definition has no occurrence over syntax outside the supported subset', () => {
    const held = editField(session(), 'form', '[[alpha]] [[ spaced ]]');
    const rows = formRows(held, 0);
    expect(rows?.fullySupported).toBe(false);
    expect(rows?.rows.find((row) => row.name === 'gamma')?.advisory).toBe('noOccurrenceUnverified');
    for (const advisory of ['noDefinition', 'noOccurrence', 'noOccurrenceUnverified'] as const satisfies readonly FormRowAdvisory[]) {
      for (const locale of LOCALES) {
        expect(DICTIONARIES[locale][formRowAdvisoryKey(advisory)]).toBeTruthy();
      } // End of the loop over the locales
    } // End of the loop over the advisories
  });

  it('transcribes the Rust parser: every character kept, and each malformed spelling reported', () => {
    // The samples of `every_character_is_kept` and
    // `malformed_regions_are_reported_not_repaired` in
    // `crates/espansoconfig-core/src/analysis/placeholder.rs`.
    for (const text of [
      '',
      'plain',
      '[[a]]',
      'Hi [[name]], [[name]] again',
      '[[ spaced ]] and [[1digit]] and [[]] and [[open',
      '[[[triple]]]',
      '[[a [[b]]',
      'é [[x]] \u{1F600} [[é]]',
      ']] [[x]',
      '[',
      '[['
    ]) {
      const pieces = layoutPiecesOf(text);
      expect(pieces.map((piece) => piece.text).join('')).toBe(text);
      expect(pieces.every((piece) => piece.text.length > 0)).toBe(true);
    } // End of the loop over the sample layouts
    for (const [text, reason] of [
      ['[[]]', 'empty'],
      ['[[ name ]]', 'invalidIdentifier'],
      ['[[1st]]', 'invalidIdentifier'],
      ['[[a-b]]', 'invalidIdentifier'],
      ['[[a.b]]', 'invalidIdentifier'],
      ['[[é]]', 'invalidIdentifier'],
      ['[[a\nb]]', 'invalidIdentifier'],
      ['[[open', 'unterminated']
    ] as const) {
      const pieces = layoutPiecesOf(text);
      expect(pieces.filter((piece) => piece.kind === 'malformed').map((piece) => piece.kind === 'malformed' && piece.reason)).toEqual([reason]);
      expect(pieces.some((piece) => piece.kind === 'placeholder')).toBe(false);
    } // End of the loop over the malformed samples
    // Repeated unterminated openers stay linear (Rust's `NextDelimiter`, the 4-7
    // review's fourth finding): each is one piece, and the scan does not restart.
    expect(layoutPiecesOf('[[ '.repeat(40000))).toHaveLength(80000);
    const reopened = layoutPiecesOf('[[a [[b]]');
    expect(reopened[0]).toEqual({ kind: 'malformed', text: '[[', reason: 'unterminated' });
    expect(reopened.filter((piece) => piece.kind === 'placeholder').map((piece) => piece.kind === 'placeholder' && piece.name)).toEqual(['b']);
  });
}); // End of the rows suite

// ---------------------------------------------------------------------------
// Clause 4: an absent field left blank is 'Unchanged'
// ---------------------------------------------------------------------------

describe('an absent field left blank is Unchanged', () => {
  it('sends nothing for an absent option left blank, and inserts it once typed into', () => {
    const held = session();
    // `alpha` holds no `default`; its box is editable and starts blank.
    expect(held.baseline.forms.forms[0]?.definitions[0]?.scalars.default).toMatchObject({
      present: false,
      eligibility: { kind: 'editable' }
    });
    expect(editFormOption(held, 0, 0, 'default', '')).toBe(held);
    const typedAndCleared = editFormOption(editFormOption(held, 0, 0, 'default', 'x'), 0, 0, 'default', '');
    expect(isDirty(typedAndCleared.draft)).toBe(false);
    expect(matchDraftOf(typedAndCleared.baseline, typedAndCleared.draft.value).form_fields).toEqual([]);
    expect(sent(editFormOption(held, 0, 0, 'default', 'x')).form_fields).toEqual([
      {
        index: 0,
        options: [],
        insert_options: { type: null, default: 'x', multiline: null, values: null, trim_string_values: null, extra: [] },
        values: []
      }
    ]);
    // A present option cleared to empty is a `Set('')`, never a removal.
    expect(sent(editFormOption(held, 0, 1, 'default', '')).form_fields).toEqual([
      {
        index: 1,
        options: [{ index: 1, value: { Set: '' }, items: [] }],
        insert_options: { type: null, default: null, multiline: null, values: null, trim_string_values: null, extra: [] },
        values: []
      }
    ]);
    // Retyping the projected value is no edit.
    expect(isDirty(editFormOption(editFormOption(held, 0, 1, 'type', 'x'), 0, 1, 'type', 'text').draft)).toBe(false);
  });

  it('leaves an absent shorthand layout Unchanged, and shows an absent verbose layout read-only', () => {
    const noLayout = session(shorthand({ form: null }));
    expect(noLayout.baseline.forms.forms).toHaveLength(1);
    expect(matchDraftOf(noLayout.baseline, noLayout.draft.value).form).toBe('Unchanged');
    const held = session(verbose(null));
    expect(held.baseline.forms.forms[0]?.layout).toMatchObject({
      present: false,
      eligibility: { kind: 'readOnly', reason: 'notInForm' }
    });
    expect(editFormLayout(held, 0, 'X')).toBe(held);
    expect(refusalOf(held, 0, DELTA, { start: 0, end: 0 }, granted(held, verbose(null)))).toEqual({
      kind: 'layoutNotEditable'
    });
  });

  it('shows an option of a definition that is not a block mapping read-only, with a sentence', () => {
    const held = session(shorthand({ formFields: [field('flat', scalarItem('x'))] }));
    expect(held.baseline.forms.forms[0]?.definitions[0]?.scalars.type.eligibility).toEqual({
      kind: 'readOnly',
      reason: 'optionsNotABlockMapping'
    });
    expect(editFormOption(held, 0, 0, 'type', 'text')).toBe(held);
    for (const reason of [
      'notDecodable',
      'carriageReturn',
      'ownsNoBytes',
      'unmodelledShape',
      'lineBreak',
      'notInForm',
      'optionsNotABlockMapping'
    ] as const satisfies readonly FormFieldRefusal[]) {
      for (const locale of LOCALES) {
        expect(DICTIONARIES[locale][formFieldRefusalKey(reason)]).toBeTruthy();
      } // End of the loop over the locales
    } // End of the loop over the refusals
  });
}); // End of the absent-field suite

// ---------------------------------------------------------------------------
// Clause 5: a layout holding \r is refused at load, edit and send
// ---------------------------------------------------------------------------

describe('a carriage return is refused at load, at edit and at send', () => {
  it('at load: a layout or an option holding a real \\r is read-only, and nothing is put into it', () => {
    const short = session(shorthand({ form: 'A: [[alpha]]\r\nB' }));
    expect(short.baseline.form.eligibility).toEqual({ kind: 'readOnly', reason: 'carriageReturn' });
    expect(refusalOf(short, 0, DELTA, { start: 0, end: 0 }, granted(short, shorthand({ form: 'A: [[alpha]]\r\nB' })))).toEqual({
      kind: 'layoutNotEditable'
    });
    // The rows still read the text the file holds.
    expect(formRows(short, 0)?.rows[0]?.name).toBe('alpha');
    const crLayout = verbose('X: [[x]]\r\n');
    const long = session(crLayout);
    expect(long.baseline.forms.forms[0]?.layout?.eligibility).toEqual({ kind: 'readOnly', reason: 'carriageReturn' });
    expect(editFormLayout(long, 0, 'fine')).toBe(long);
    expect(refusalOf(long, 0, DELTA, { start: 0, end: 0 }, granted(long, crLayout))).toEqual({ kind: 'layoutNotEditable' });
    const crOption = session(shorthand({ formFields: [field('alpha', optionsOf([['default', 'a\rb']]))] }));
    expect(crOption.baseline.forms.forms[0]?.definitions[0]?.scalars.default.eligibility).toEqual({
      kind: 'readOnly',
      reason: 'carriageReturn'
    });
  });

  it('at edit: every box and Add field refuse a \\r, and a one-line box a line feed', () => {
    const held = session();
    expect(editField(held, 'form', 'a\rb')).toBe(held);
    const long = session(verbose());
    expect(editFormLayout(long, 0, 'a\rb')).toBe(long);
    expect(editFormOption(held, 0, 0, 'default', 'a\rb')).toBe(held);
    expect(editFormOption(held, 0, 0, 'type', 'a\nb')).toBe(held);
    // `default` is multi-line: a line feed passes, a carriage return does not.
    expect(isDirty(editFormOption(held, 0, 0, 'default', 'a\nb').draft)).toBe(true);
    expect(refusalOf(held, 0, { ...DELTA, options: { ...DELTA.options, default: 'x\ry' } }, null)).toEqual({
      kind: 'unreadableText'
    });
    expect(refusalOf(held, 0, { ...DELTA, options: { ...DELTA.options, type: 'a\nb' } }, null)).toEqual({
      kind: 'unreadableText'
    });
  });

  it('at send: a forged buffer holding a \\r or a one-line line feed sends nothing', () => {
    const long = session(verbose());
    const forgedLayout = forged(long, (buffers) => ({
      ...buffers,
      forms: { forms: buffers.forms.forms.map((form) => ({ ...form, layout: { text: 'a\rb' } })) }
    }));
    // The derivation would carry it; the gate is what refuses it.
    expect(matchDraftOf(forgedLayout.baseline, forgedLayout.draft.value).vars[0]?.params[0]?.value).toEqual({ Set: 'a\rb' });
    expect(beginSave(forgedLayout, () => forgedLayout)).toBeNull();
    const short = session();
    const forgedForm = forged(short, (buffers) => ({ ...buffers, form: { text: '[[alpha]]\r', removed: false } }));
    expect(beginSave(forgedForm, () => forgedForm)).toBeNull();
    const forgedOption = forged(short, (buffers) => ({
      ...buffers,
      forms: {
        forms: buffers.forms.forms.map((form) => ({
          ...form,
          definitions: form.definitions.map((one, index) =>
            index === 1 ? { ...one, options: { ...one.options, type: { text: 'a\nb' } } } : one
          )
        }))
      }
    }));
    expect(matchDraftOf(forgedOption.baseline, forgedOption.draft.value).form_fields[0]?.options[0]?.value).toEqual({
      Set: 'a\nb'
    });
    expect(beginSave(forgedOption, () => forgedOption)).toBeNull();
    const forgedAddition = forged(short, (buffers) => ({
      ...buffers,
      forms: {
        forms: buffers.forms.forms.map((form) => ({
          ...form,
          added: [{ field: { ...DELTA, name: 'a\nb' }, placeholderInserted: false }]
        }))
      }
    }));
    expect(beginSave(forgedAddition, () => forgedAddition)).toBeNull();
    // The same session with honest text still sends.
    const honest = editFormLayout(long, 0, 'a\nb');
    expect(beginSave(honest, () => honest)?.draft.vars[0]?.params[0]?.value).toEqual({ Set: 'a\nb' });
  });

  it('emits, for a CRLF file, exactly the wire draft the Rust untouched-bytes test applies', () => {
    // The projection of the CRLF source in
    // `the_form_editors_wire_draft_keeps_a_crlf_files_untouched_bytes`
    // (`crates/espansoconfig-core/tests/form_definitions.rs`): a literal block
    // layout decodes with a line feed, so it is editable; *Add field* at the end
    // of its first line. That test applies this JSON and compares every byte it
    // did not ask to change.
    const crlf = shorthand({
      form: 'Name: [[name]]\n',
      formFields: [field('name', optionsOf([['type', 'text']]))]
    });
    const held = session(crlf);
    const after = added(held, 0, { ...bare('when'), options: { ...bare('when').options, type: 'text' } }, { start: 14, end: 14 }, crlf);
    const draft = sent(after);
    expect({ form: draft.form, form_intents: draft.form_intents, form_fields: draft.form_fields }).toEqual(
      JSON.parse(CRLF_WIRE)
    );
  });
}); // End of the carriage-return suite

/** The wire draft's form parts `the_form_editors_wire_draft_keeps_a_crlf_files_untouched_bytes` reads. */
const CRLF_WIRE =
  '{"form":{"Set":"Name: [[name]][[when]]\\n"},"form_intents":[{"InsertField":{"after":null,"field":{"name":"when","options":{"type":"text","default":null,"multiline":null,"values":null,"trim_string_values":null,"extra":[]}}}}],"form_fields":[]}';

// ---------------------------------------------------------------------------
// Clause 6: every new value has a lifecycle disposition
// ---------------------------------------------------------------------------

/** Every drafted form action, each its own draft, with the projection it is drafted over. */
const DRAFTED: readonly (readonly [string, MatchView, (held: MatchEditorSession) => MatchEditorSession])[] = [
  ['a verbose layout edit', verbose(), (held) => editFormLayout(held, 0, 'Y: [[x]]')],
  ['an option edit', shorthand(), (held) => editFormOption(held, 0, 1, 'default', 'bye')],
  ['a definition removal', shorthand(), (held) => removeFormField(held, granted(held), 0, 1)],
  ['a shorthand Add field', shorthand(), (held) => added(held, 0, DELTA, { start: 0, end: 0 })],
  ['a verbose Add field', verbose(), (held) => added(held, 0, DELTA, { start: 0, end: 0 }, verbose())]
];

describe('every form action is retained, compared and copied under both conflict origins', () => {
  it.each(DRAFTED)('%s survives a save conflict: retained, rows, copy byte for byte', (_name, match, draft) => {
    const edited = draft(session(match));
    expect(isDirty(edited.draft)).toBe(true);
    const stuck = saveConflicted(edited);
    expect(conflictOf(stuck)?.draft).toBe(edited.draft);
    expect(canSave(stuck)).toBe(false);
    const rows = matchEditorView(stuck).retainedDraft.filter((row) =>
      ['formField', 'formOption', 'layout', 'form'].includes(row.label) && row.status !== 'unchanged'
    );
    expect(rows.length).toBeGreaterThan(0);
    const copy = referenceCopyOf(matchEditorView(stuck).retainedDraft, {
      heading: 'H',
      label: (label) => `<${label}>`,
      status: (status) => `[${status}]`
    });
    for (const row of rows) {
      expect(copy).toContain(`<${row.label}> ([${row.status}])\n${row.text}`);
    } // End of the loop over the form rows
  });

  it.each(DRAFTED)('%s survives an external conflict, and nothing is drafted over it', (_name, match, draft) => {
    const edited = draft(session(match));
    const { stuck } = conflictedOver(edited, 'external', match);
    expect(stuck.externalConflict?.draft).toBe(edited.draft);
    expect(canSave(stuck)).toBe(false);
    expect(editFormOption(stuck, 0, 0, 'type', 'z')).toBe(stuck);
    expect(addFormField(stuck, granted(stuck, match), 0, { field: bare('late'), selection: null })).toMatchObject({
      kind: 'refused',
      refusal: { kind: 'formNotEditable' }
    });
  });

  it('lists the drafted form rows in order, and nothing for a draft that touches no form', () => {
    const untouched = matchEditorView(saveConflicted(editField(session(), 'label', 'x')));
    expect(untouched.retainedDraft.slice(17)).toEqual([]);
    let held = removeFormField(session(), granted(session()), 0, 0);
    held = editFormOption(held, 0, 1, 'default', 'bye');
    held = added(held, 0, { ...DELTA, options: { ...DELTA.options, values: { List: ['p', 'q'] } } }, null);
    expect(matchEditorView(saveConflicted(held)).retainedDraft.slice(17)).toEqual([
      { label: 'formField', text: 'alpha', status: 'fieldRemoved' },
      { label: 'formField', text: 'gamma', status: 'fieldEdited' },
      { label: 'formOption', text: 'default', status: 'optionName' },
      { label: 'formOption', text: 'bye', status: 'optionValue' },
      { label: 'formField', text: 'delta', status: 'fieldAdded' },
      { label: 'formOption', text: 'type', status: 'optionName' },
      { label: 'formOption', text: 'text', status: 'optionValue' },
      { label: 'formOption', text: 'values', status: 'optionName' },
      { label: 'formOption', text: 'p', status: 'optionValue' },
      { label: 'formOption', text: 'q', status: 'optionValue' }
    ]);
    const long = editFormLayout(session(verbose()), 0, 'Y');
    expect(matchEditorView(saveConflicted(long)).retainedDraft.slice(17)).toEqual([
      { label: 'variableName', text: 'f', status: 'unchanged' },
      { label: 'layout', text: 'Y', status: 'setting' }
    ]);
    for (const key of [
      'browser.saveOutcome.label.formFields',
      'browser.saveOutcome.label.formField',
      'browser.saveOutcome.label.formOption',
      'browser.saveOutcome.label.layout',
      'browser.saveOutcome.field.fieldAdded',
      'browser.saveOutcome.field.fieldRemoved',
      'browser.saveOutcome.field.fieldEdited',
      'browser.saveOutcome.field.optionName',
      'browser.saveOutcome.field.optionValue'
    ] as const) {
      for (const locale of LOCALES) {
        expect(DICTIONARIES[locale][key]).toBeTruthy();
      } // End of the loop over the locales
    } // End of the loop over the keys
  });
}); // End of the retention suite

describe('the reapply is keyed on the whole form container', () => {
  it.each(['save', 'external'] as const)('reapplies over unchanged containers (%s origin), sending the same intents', (origin) => {
    const short = removeFormField(session(), granted(session()), 0, 1);
    const target = shorthand({ label: 'moved elsewhere' }, AFTER);
    const answer = reapplyOver([short, origin, target]);
    expect(answer.kind).toBe('reapplied');
    if (answer.kind !== 'reapplied') {
      throw new Error('this case is about the rebuilt session');
    }
    expect(sent(answer.session).form_intents).toEqual([{ RemoveField: { index: 1 } }]);
    const long = editFormLayout(session(verbose()), 0, 'Y');
    const longTarget = { ...verbose('X: [[x]]', AFTER), label: null };
    const again = reapplyOver([long, origin, longTarget]);
    if (again.kind !== 'reapplied') {
      throw new Error('this case is about the rebuilt session');
    }
    expect(sent(again.session).vars[0]?.params).toEqual([{ index: 0, value: { Set: 'Y' }, items: [] }]);
  });

  it.each(['save', 'external'] as const)('collides the whole container when it changed (%s origin)', (origin) => {
    const short = editFormOption(session(), 0, 1, 'default', 'bye');
    const changed = shorthand({ formFields: [SHORT_FIELDS[1] as FieldView, SHORT_FIELDS[0] as FieldView] }, AFTER);
    const answer = reapplyOver([short, origin, changed]);
    expect(answer).toEqual({ kind: 'manualResolution', obstacle: { kind: 'fieldCollisions', fields: ['form_fields'] } });
    const long = editFormLayout(session(verbose()), 0, 'Y');
    const longChanged = verbose('X: [[x]]', AFTER, [field('x', optionsOf([['multiline', 'false']]))]);
    const again = reapplyOver([long, origin, longChanged]);
    expect(again).toEqual({ kind: 'manualResolution', obstacle: { kind: 'fieldCollisions', fields: ['vars'] } });
  });

  it.each(['save', 'external'] as const)(
    'carries no stale buffer for a form it did not check, and sends only the drafted edits (%s origin, the 4-10 review)',
    (origin) => {
      // A snippet holding both shapes. Only a shorthand option is drafted; the
      // file meanwhile rewrites the untouched verbose layout. The shorthand
      // container is unchanged, so the reapply applies — and must not carry the
      // verbose form's old layout text over the new one.
      /**
       * The snippet with both forms, minted at `revision`.
       *
       * @param layout - The verbose form's layout.
       * @param revision - The revision.
       * @returns The projection.
       */
      const both = (layout: string, revision: ContentRevision): MatchView =>
        shorthand({ vars: [formVariable(layout, VERBOSE_FIELDS)] }, revision);
      const held = editFormOption(session(both('X: [[x]]', BASE)), 0, 1, 'default', 'bye');
      const answer = reapplyOver([held, origin, both('X: [[x]] changed outside', AFTER)]);
      expect(answer.kind).toBe('reapplied');
      if (answer.kind !== 'reapplied') {
        throw new Error('this case is about the rebuilt session');
      }
      const draft = sent(answer.session);
      expect(draft.vars).toEqual([]);
      expect(draft.var_intents).toEqual([]);
      expect(draft.form_intents).toEqual([]);
      expect(draft.form_fields).toEqual([
        {
          index: 1,
          options: [{ index: 1, value: { Set: 'bye' }, items: [] }],
          insert_options: { type: null, default: null, multiline: null, values: null, trim_string_values: null, extra: [] },
          values: []
        }
      ]);
      expect(answer.session.draft.value.forms.forms[1]?.layout).toEqual({ text: 'X: [[x]] changed outside' });
    }
  );

  it.each(['save', 'external'] as const)('keeps Add field together: its layout half already on disk collides both (%s origin)', (origin) => {
    const held = added(session(), 0, DELTA, { start: 0, end: 0 });
    const halfThere = shorthand({ form: `[[delta]]${SHORT_LAYOUT}` }, AFTER);
    const answer = reapplyOver([held, origin, halfThere]);
    expect(answer).toEqual({ kind: 'manualResolution', obstacle: { kind: 'fieldCollisions', fields: ['form', 'form_fields'] } });
  });
}); // End of the reapply suite

describe('the remaining dispositions: save, discard, recovery, reparse, consent', () => {
  it('owes a re-projection after a commit that changed a form, and drafts nothing until one', () => {
    const edited = editFormOption(session(), 0, 1, 'default', 'bye');
    const started = beginSave(edited, () => edited);
    if (started === null) {
      throw new Error('this case needs a saveable session');
    }
    const saved: SaveResult = { outcome: 'saved', revision: AFTER, committed: true, notes: [], backup_taken: false, moved: null };
    const done = applySave(started.session, saved, ADOPTED, () => started.session);
    expect(done.baseline.forms.reprojectionOwed).toBe(true);
    expect(isDirty(done.draft)).toBe(false);
    expect(editFormOption(done, 0, 1, 'default', 'again')).toBe(done);
    expect(matchDraftOf(done.baseline, done.draft.value).form_fields).toEqual([]);
    // A verbose form lives in `vars`: its commit owes the variables one as well.
    const long = editFormLayout(session(verbose()), 0, 'Y');
    const longStarted = beginSave(long, () => long);
    if (longStarted === null) {
      throw new Error('this case needs a saveable session');
    }
    const longDone = applySave(longStarted.session, saved, ADOPTED, () => longStarted.session);
    expect(longDone.baseline.variables.reprojectionOwed).toBe(true);
    // A re-projection (a fresh session over the file as now parsed) starts clean.
    const reparsed = session(shorthand({}, AFTER));
    expect(reparsed.baseline.forms.reprojectionOwed).toBe(false);
    expect(matchDraftOf(reparsed.baseline, reparsed.draft.value).form_intents).toEqual([]);
  });

  it('keeps a verbose form out of reach while its variable is drafted for removal', () => {
    // A second variable, so removing the form's is not removing every one.
    const two = {
      ...verbose(),
      vars: [...verbose().vars, makeVariable({ node: 21, name: 'e', declaredType: 'echo', kind: 'Echo' })]
    };
    const edited = editFormLayout(session(two), 0, 'Y');
    const removed = removeVariable(edited, granted(edited, two), 0);
    // The removal is what is sent; the form's edits wait, as the variable's own boxes do.
    expect(sent(removed).vars).toEqual([]);
    expect(sent(removed).var_intents).toEqual([{ RemoveVariable: { index: 0 } }]);
    expect(editFormLayout(removed, 0, 'Z')).toBe(removed);
    expect(sent(restoreVariable(removed, 0)).vars[0]?.params).toEqual([{ index: 0, value: { Set: 'Y' }, items: [] }]);
  });

  it('refuses recovery for a draft that adds a definition, and still offers it without one', () => {
    /**
     * What recovery answers for one conflicted session after a reapply that
     * resolved nothing.
     *
     * @param stuck - The conflicted session.
     * @returns The availability.
     */
    const recoveryOf = (stuck: MatchEditorSession): ReturnType<typeof matchRecoveryAvailability> => {
      const attempt = attemptOfReapply(stuck, reapply(stuck, null));
      const summary = makeSummary({ id: 1, relativePath: 'match/base.yml' });
      return matchRecoveryAvailability(attempt.outcome, conflictOf(stuck), stuck.baseline, [summary], [file([], AFTER)]);
    }; // End of function recoveryOf()
    const bareForm = shorthand({ formFields: [] });
    const held = session(bareForm);
    const withDefinition = added(held, 0, bare('alpha'), null, bareForm);
    expect(recoveryOf(saveConflicted(withDefinition))).toEqual({ kind: 'unavailable', reason: 'variablesNotCarried' });
    expect(recoveryOf(saveConflicted(editField(held, 'form', 'changed'))).kind).toBe('offered');
  });

  it('discards consent whenever the form draft changes', () => {
    const finding: Finding = { code: { ReferenceHasNoDeclaration: { name: 'x' } }, span: null, node: null, path: null };
    const refusal: SaveResult = { outcome: 'refused', verdict: 'RefusedForUnacknowledgedSuspicions', findings: [finding] };
    const edited = editFormOption(session(), 0, 1, 'default', 'bye');
    const started = beginSave(edited, () => edited);
    if (started === null) {
      throw new Error('this case needs a saveable session');
    }
    const consented = acknowledgeFindings(applySave(started.session, refusal, NOT_OWED, () => started.session));
    expect(beginSave(consented, () => consented)?.submission.acknowledgement).toEqual({ accepted: [finding] });
    const changed = editFormOption(consented, 0, 1, 'default', 'later');
    expect(beginSave(changed, () => changed)?.submission.acknowledgement).toEqual({ accepted: [] });
  });
}); // End of the dispositions suite
