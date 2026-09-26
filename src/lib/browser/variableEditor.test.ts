/**
 * Phase 4-9 — the shared variable editor's lifecycle, as model values.
 *
 * What this file pins, clause by clause of step 4-9's acceptance
 * (`docs/decisions/4-split-notes.md` §2):
 *
 * - every drafted scalar and structural variable action survives **both conflict
 *   origins** — a refused save's conflict and a watcher's external one — as the
 *   retained draft, its rows and its copy;
 * - an **unchanged container baseline reapplies** over either origin, and the
 *   rebuilt session sends the same intents against the new revision;
 * - a **shifted or changed list collides**, the whole container, by name;
 * - a **completely present intended result is satisfied**, and a half-present
 *   compound *Insert* is not;
 * - **recovery never creates a snippet whose references lost their definitions**
 *   (ruling 21);
 * - **R36's conservative rule and R37's single read through a caller**
 *   (`BrowserState.variableStructureRead`), with the limit stated in the model;
 * - **B1's regression coverage extended to variable lists** at the model layer;
 * - one undo step per compound *Insert*, consent discarded when the draft
 *   changes, and the carriage-return rule for every new control.
 *
 * **Model evidence, never a screen**: nothing here is mounted. Step 4-11 draws
 * the controls and owes the mounted and window evidence.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DICTIONARIES } from '../i18n/dictionaries';
import { LOCALES } from '../i18n/locale';
import type {
  ContainerBaseline,
  ContentRevision,
  CorrespondenceEntry,
  DocumentView,
  Finding,
  MatchDraft,
  MatchId,
  MatchView,
  NewVariable,
  ReapplyResolution,
  SaveResult,
  VariableView
} from '../ipc/types';
import type { ExternalConflictObservation } from './conflictSource';
import { editDraft, isDirty } from './draft';
import type { AdoptTheDiskVersion } from './editorSave';
import {
  field,
  makeConflict,
  makeDocument,
  makeMatch,
  makeSummary,
  makeVariable,
  scalar,
  scalarItem
} from './fixtures';
import type { InvalidationStatus } from './invalidation';
import {
  acknowledgeFindings,
  applyObservation,
  applySave,
  beginSave,
  canSave,
  cancelContentSwitch,
  chooseContentSwitch,
  conflictOf,
  discardAddedVariable,
  editField,
  editorReapplyObstacleKey,
  editVariableField,
  isVariablesEditable,
  matchDraftOf,
  matchEditorView,
  planMatchReapply,
  reapplyToDiskVersion,
  redoEdit,
  removeVariable,
  removeVariables,
  restoreVariable,
  restoreVariables,
  saveWithheldKey,
  startMatchEditor,
  undoEdit,
  variableMoveOffer,
  baselineOf,
  type MatchBuffers,
  type MatchEditorSession
} from './matchEditor';
import { arbitratedDelivery } from './observationDelivery';
import { matchRecoveryAvailability, recoveryUnavailableKey, startMatchFieldRecovery } from './recovery';
import { attemptOfReapply, type StandingOriginGuard } from './reapply';
import { referenceCopyOf, type ConflictModel, type DiskAdoptionOutcome } from './saveOutcome';
import {
  carriesDefinitions,
  variableAdditionRefusalKey,
  variableFieldRefusalKey,
  variableMoveRefusalKey,
  variableMoveSubmissionOf,
  variableStructureGrantOf,
  variableStructureReadOf,
  type VariableAdditionRefusal,
  type VariableFieldRefusal,
  type VariableMoveRefusal,
  type VariableStructureGrant
} from './variableEditor';
import {
  addVariable,
  insertRefusalKey,
  insertVariable,
  nameContextOf,
  nameRefusalKey,
  nameVerdictKey,
  nameVerdictOf,
  suggestedName,
  type NameContext,
  type NameRefusal
} from './variableInsertion';

/** The revision every projection below is minted from. */
const BASE: ContentRevision = 'a'.repeat(64);

/** The revision the file holds after an external change. */
const AFTER: ContentRevision = 'b'.repeat(64);

/** The adoption a save that wrote nothing owes: none. */
const NOT_OWED: InvalidationStatus = { kind: 'notOwed' };

/** The two variables most cases start from. */
const TWO_VARS: readonly VariableView[] = [
  makeVariable({ node: 20, name: 'first', declaredType: 'echo', kind: 'Echo', params: [field('echo', scalarItem('one'))] }),
  makeVariable({ node: 21, name: 'second', declaredType: 'echo', kind: 'Echo', params: [field('echo', scalarItem('two'))] })
];

/** A new `echo` variable. */
const NEW_ECHO: NewVariable = {
  name: 'greeting',
  params: { Echo: { echo: 'hello' } },
  inject_vars: null,
  depends_on: null,
  extra_params: []
};

/**
 * A projection of the snippet, minted at `revision`.
 *
 * @param overrides - Whatever the case needs; `trigger: ':a'` and `replace: 'b'`
 *   unless it says otherwise.
 * @param revision - The revision it is minted from.
 * @returns The projection.
 */
function projection(overrides: Parameters<typeof makeMatch>[0] = {}, revision: ContentRevision = BASE): MatchView {
  return makeMatch({ revision, document: 1, node: 1, trigger: ':a', replace: 'b', ...overrides });
} // End of function projection()

/**
 * A session over a projection, with a clock nothing advances.
 *
 * @param match - The projection.
 * @returns A clean session.
 */
function session(match: MatchView = projection({ vars: TWO_VARS })): MatchEditorSession {
  return startMatchEditor(match, () => 0);
} // End of function session()

/**
 * The file a projection lives in, as the window holds it.
 *
 * @param matches - The snippets.
 * @param revision - The file's revision.
 * @returns The projection.
 */
function file(matches: readonly MatchView[], revision: ContentRevision = BASE): DocumentView {
  return makeDocument({ id: 1, relativePath: 'match/base.yml', revision, matches });
} // End of function file()

/**
 * A structure grant over the session's own file, with no other draft open.
 *
 * @param held - The session.
 * @param match - The projection the file holds.
 * @returns The grant.
 */
function granted(held: MatchEditorSession, match: MatchView = projection({ vars: TWO_VARS })): VariableStructureGrant {
  return variableStructureGrantOf(held.match, variableStructureReadOf([file([match])], 1, []));
} // End of function granted()

/** A name context with nothing in it but what a case adds. */
const NO_NAMES: NameContext = {
  locals: [],
  additions: [],
  captures: [],
  globals: [],
  synthesized: [],
  scopeClosed: true
};

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
 * A session showing a **save** conflict over its drafted variables.
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
 * One external observation of the file, with a correspondence table naming the
 * session's snippet.
 *
 * @param entries - The table's rows.
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
 * A session showing an **external** conflict over its drafted variables.
 *
 * @param held - The edited session.
 * @param editor - The editor tier's answer for the session's snippet.
 * @param diskMatches - What the disk snapshot holds.
 * @returns The session, and the guard answering its own conflict's origin.
 */
function externallyConflicted(
  held: MatchEditorSession,
  editor: ReapplyResolution = { Unsupported: {} },
  diskMatches: readonly MatchView[] = []
): { readonly stuck: MatchEditorSession; readonly stands: StandingOriginGuard } {
  const seen = observed([{ base: held.match, exact: { Unsupported: {} }, editor }], diskMatches);
  const stuck = applyObservation(held, arbitratedDelivery(null, seen, false));
  const conflict = stuck.externalConflict;
  if (conflict === null) {
    throw new Error('this case needs an external conflict');
  }
  const source = conflict.source;
  return { stuck, stands: () => source };
} // End of function externallyConflicted()

/**
 * A recorder for the window's adoption.
 *
 * @param answer - What the window answers.
 * @returns The callback and what it was handed.
 */
function adopting(answer: DiskAdoptionOutcome = 'installed'): {
  readonly adopt: AdoptTheDiskVersion<MatchBuffers>;
  readonly adoptions: ConflictModel<MatchBuffers>[];
} {
  const adoptions: ConflictModel<MatchBuffers>[] = [];
  return {
    adopt: (conflict) => {
      adoptions.push(conflict);
      return answer;
    },
    adoptions
  };
} // End of function adopting()

/**
 * Reapplies a conflicted session through the one entry, over either origin.
 *
 * @param held - The conflicted session.
 * @param origin - Which origin it carries.
 * @param stands - The external origin's guard, when there is one.
 * @returns What became of the attempt.
 */
function reapply(
  held: MatchEditorSession,
  origin: 'save' | 'external',
  stands: StandingOriginGuard | null = null
): ReturnType<typeof reapplyToDiskVersion> {
  return reapplyToDiskVersion(held, adopting().adopt, origin === 'external' ? stands : null, () => held);
} // End of function reapply()

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
  return externallyConflicted(held, subject, [target]);
} // End of function conflictedOver()

/**
 * A disk snippet at node 9 of the newer revision.
 *
 * @param overrides - Whatever the case needs beyond the trigger and the body.
 * @returns The projection the disk snapshot holds.
 */
function diskMatch(overrides: Parameters<typeof makeMatch>[0] = {}): MatchView {
  return makeMatch({ revision: AFTER, document: 1, node: 9, trigger: ':a', replace: 'b', ...overrides });
} // End of function diskMatch()

// ---------------------------------------------------------------------------
// The baseline and the buffers
// ---------------------------------------------------------------------------

describe('the variables baseline is the projection, and the buffers are the draft', () => {
  it('reads the shape, the Rust-cut container and one row per variable', () => {
    const held = session();
    const variables = held.baseline.variables;
    expect(variables.shape).toBe('block');
    expect('Present' in variables.container).toBe(true);
    expect(variables.rows.map((row) => row.name.value)).toEqual(['first', 'second']);
    expect(session(projection()).baseline.variables.shape).toBe('absent');
    expect(session(projection()).baseline.variables.container).toEqual({ Absent: {} });
    expect(matchDraftOf(held.baseline, held.draft.value)).toMatchObject({ vars: [], var_intents: [] });
  });

  it('makes an absent key of an existing variable read-only, and says why', () => {
    const variables = session().baseline.variables;
    expect(variables.rows[0]?.inject_vars.eligibility).toEqual({ kind: 'readOnly', reason: 'notInVariable' });
    // Rust's `VariableDraft` refuses to insert an absent key, so no box offers it.
    const held = session();
    expect(editVariableField(held, 0, 'inject_vars', 'true')).toBe(held);
    const multiLine = session(
      projection({ vars: [makeVariable({ name: 'x', declaredType: 'echo' })].map((one) => ({ ...one, name: scalar('a\nb') })) })
    );
    expect(multiLine.baseline.variables.rows[0]?.name.eligibility).toEqual({ kind: 'readOnly', reason: 'lineBreak' });
  });

  it('emits an existing inject_vars edited from false to true as the draft Rust writes plain (the Phase 4-9 review)', () => {
    // The Rust half reads exactly this JSON and writes `inject_vars: true`, never
    // `'true'`: `an_existing_inject_vars_edited_from_false_to_true_writes_plain_true`
    // in `crates/espansoconfig-core/tests/draft_plan.rs`.
    const vars = [
      makeVariable({ node: 20, name: 'first', declaredType: 'echo', kind: 'Echo', injectVars: 'false', params: [field('echo', scalarItem('one'))] })
    ];
    const edited = editVariableField(session(projection({ vars })), 0, 'inject_vars', 'true');
    expect(JSON.parse(JSON.stringify(sent(edited).vars))).toEqual([
      {
        index: 0,
        name: 'Unchanged',
        type: 'Unchanged',
        inject_vars: { Set: 'true' },
        params: [],
        insert_params: [],
        depends_on: [],
        records: [],
        lists: [],
        fields: [],
        field_intents: []
      }
    ]);
  });

  it('drafts a rename as one VariableDraft by index, leaving everything else alone', () => {
    const renamed = editVariableField(session(), 1, 'name', 'later');
    expect(sent(renamed).vars).toEqual([
      {
        index: 1,
        name: { Set: 'later' },
        type: 'Unchanged',
        inject_vars: 'Unchanged',
        params: [],
        insert_params: [],
        depends_on: [],
        records: [],
        lists: [],
        fields: [],
        field_intents: []
      }
    ]);
    expect(sent(renamed).var_intents).toEqual([]);
    // Retyping the projected value is no edit, and the draft is clean again.
    expect(isDirty(editVariableField(renamed, 1, 'name', 'second').draft)).toBe(false);
  });

  it('drafts removals, the explicit container removal and one new variable', () => {
    const removed = removeVariable(session(), granted(session()), 0);
    expect(sent(removed).var_intents).toEqual([{ RemoveVariable: { index: 0 } }]);
    const both = removeVariable(removed, granted(removed), 1);
    expect(canSave(both)).toBe(false);
    expect(matchEditorView(both).saveWithheld).toBe('varsWouldBeEmpty');
    const container = removeVariables(session(), granted(session()));
    expect(sent(container).var_intents).toEqual([{ RemoveVars: {} }]);
    expect(restoreVariables(container).draft.value.variables.removeAll).toBe(false);
    expect(isDirty(restoreVariable(removed, 0).draft)).toBe(false);
    const added = addVariable(session(), granted(session()), NO_NAMES, NEW_ECHO);
    expect(added.kind).toBe('inserted');
    if (added.kind !== 'inserted') {
      throw new Error('this case needs the addition');
    }
    expect(sent(added.session).var_intents).toEqual([{ InsertVariable: { at: { End: {} }, variable: NEW_ECHO } }]);
    // One new variable per draft: a second would land where the first did.
    const second = addVariable(added.session, granted(added.session), NO_NAMES, { ...NEW_ECHO, name: 'other' });
    expect(second).toMatchObject({ kind: 'refused', refusal: { kind: 'addition', reason: 'additionPending' } });
    expect(isDirty(discardAddedVariable(added.session, 0).draft)).toBe(false);
  });

  it('refuses a new variable into a flow vars, and a removal from it, before any save', () => {
    const flow = projection({ vars: TWO_VARS });
    const nowhere = {
      key_node: 0,
      key_span: { start: 0, end: 0 },
      value_node: 0,
      value_span: { start: 0, end: 0 },
      path: null
    };
    const flowSession = session({ ...flow, vars_presence: { Items: { location: nowhere, flow: true, count: 2 } } });
    expect(flowSession.baseline.variables.shape).toBe('flow');
    expect(addVariable(flowSession, granted(flowSession, flow), NO_NAMES, NEW_ECHO)).toMatchObject({
      kind: 'refused',
      refusal: { kind: 'addition', reason: 'varsNotABlockList' }
    });
    expect(removeVariable(flowSession, granted(flowSession, flow), 0)).toBe(flowSession);
  });
}); // End of the baseline suite

// ---------------------------------------------------------------------------
// History: one buffer set, one history
// ---------------------------------------------------------------------------

describe('variable actions share the editor’s one history', () => {
  it('walks a rename, a removal and a scalar field edit back and forward in order', () => {
    let held = editVariableField(session(), 0, 'name', 'one');
    held = removeVariable(held, granted(held), 1);
    held = editField(held, 'label', 'L');
    expect(held.draft.past).toHaveLength(3);
    held = undoEdit(held);
    expect(held.draft.value.label.text).toBe('');
    held = undoEdit(held);
    expect(held.draft.value.variables.rows[1]?.removed).toBe(false);
    held = undoEdit(held);
    expect(held.draft.value.variables.rows[0]?.name.text).toBe('first');
    expect(isDirty(held.draft)).toBe(false);
    held = redoEdit(redoEdit(held));
    expect(held.draft.value.variables.rows[1]?.removed).toBe(true);
    expect(held.draft.value.variables.rows[0]?.name.text).toBe('one');
  });

  it('makes the compound Insert one step: caret text, new variable and the shared name', () => {
    const held = session();
    const outcome = insertVariable(held, granted(held), nameContextOf(held, null, null), {
      field: 'replace',
      selection: { start: 1, end: 1 },
      variable: NEW_ECHO
    });
    expect(outcome.kind).toBe('inserted');
    if (outcome.kind !== 'inserted') {
      throw new Error('this case needs the insertion');
    }
    const after = outcome.session;
    expect(after.draft.value.replace.text).toBe('b{{greeting}}');
    expect(after.draft.value.variables.added.map((one) => one.variable.name)).toEqual(['greeting']);
    expect(after.draft.value.variables.added[0]?.insertedInto).toBe('replace');
    expect(outcome.selection).toEqual({ start: 13, end: 13 });
    expect(after.draft.past).toHaveLength(1);
    // One save carries both halves.
    const draft = sent(after);
    expect(draft.replace).toEqual({ Set: 'b{{greeting}}' });
    expect(draft.var_intents).toEqual([{ InsertVariable: { at: { End: {} }, variable: NEW_ECHO } }]);
    // One undo takes back both.
    const undone = undoEdit(after);
    expect(undone.draft.value.replace.text).toBe('b');
    expect(undone.draft.value.variables.added).toEqual([]);
    expect(isDirty(undone.draft)).toBe(false);
  });

  it('inserts into a snippet with no vars, so one save writes the whole subtree', () => {
    const bare = session(projection());
    const outcome = insertVariable(bare, granted(bare, projection()), NO_NAMES, {
      field: 'replace',
      selection: { start: 0, end: 1 },
      variable: NEW_ECHO
    });
    expect(outcome.kind).toBe('inserted');
    if (outcome.kind === 'inserted') {
      expect(outcome.session.draft.value.replace.text).toBe('{{greeting}}');
      expect(sent(outcome.session).var_intents).toHaveLength(1);
    }
  });

  it('discards consent whenever the variable draft changes (4-8 open item 2)', () => {
    // `ReferenceHasNoDeclaration` carries no revision, so Rust accepts consent for
    // it on any candidate that produces an equal finding. The editor binds consent
    // to the whole buffer set — variables included — so a changed variable draft
    // sends no acknowledgement.
    const finding: Finding = { code: { ReferenceHasNoDeclaration: { name: 'x' } }, span: null, node: null, path: null };
    const refusal: SaveResult = { outcome: 'refused', verdict: 'RefusedForUnacknowledgedSuspicions', findings: [finding] };
    const edited = editVariableField(session(), 0, 'name', 'one');
    const started = beginSave(edited, () => edited);
    if (started === null) {
      throw new Error('this case needs a saveable session');
    }
    const consented = acknowledgeFindings(applySave(started.session, refusal, NOT_OWED, () => started.session));
    const again = beginSave(consented, () => consented);
    expect(again?.submission.acknowledgement).toEqual({ accepted: [finding] });
    const changed = editVariableField(consented, 0, 'name', 'uno');
    expect(beginSave(changed, () => changed)?.submission.acknowledgement).toEqual({ accepted: [] });
  });
}); // End of the history suite

// ---------------------------------------------------------------------------
// Conflict retention, compare and copy, over both origins
// ---------------------------------------------------------------------------

/** Every drafted variable action, each its own draft. */
const DRAFTED: readonly (readonly [string, (held: MatchEditorSession) => MatchEditorSession])[] = [
  ['a rename', (held) => editVariableField(held, 0, 'name', 'renamed')],
  ['a type edit', (held) => editVariableField(held, 1, 'type', 'shell')],
  ['a removal', (held) => removeVariable(held, granted(held), 1)],
  ['a container removal', (held) => removeVariables(held, granted(held))],
  [
    'a compound insertion',
    (held) => {
      const outcome = insertVariable(held, granted(held), NO_NAMES, {
        field: 'replace',
        selection: { start: 1, end: 1 },
        variable: NEW_ECHO
      });
      return outcome.session;
    }
  ]
];

describe('every drafted variable action survives both conflict origins', () => {
  it.each(DRAFTED)('%s is retained, compared and copied under a save conflict', (_name, draft) => {
    const edited = draft(session());
    expect(isDirty(edited.draft)).toBe(true);
    const stuck = saveConflicted(edited);
    const conflict = conflictOf(stuck);
    expect(conflict?.draft).toBe(edited.draft);
    expect(isVariablesEditable(stuck)).toBe(false);
    expect(canSave(stuck)).toBe(false);
    const rows = matchEditorView(stuck).retainedDraft.filter((row) =>
      ['variableName', 'vars', 'type', 'params'].includes(row.label)
    );
    expect(rows.length).toBeGreaterThan(0);
    // The copy is built from the same rows, byte for byte.
    const copy = referenceCopyOf(matchEditorView(stuck).retainedDraft, {
      heading: 'H',
      label: (label) => `<${label}>`,
      status: (status) => `[${status}]`
    });
    for (const row of rows) {
      expect(copy).toContain(`<${row.label}> ([${row.status}])\n${row.text}`);
    } // End of the loop over the variable rows
  });

  it.each(DRAFTED)('%s is retained under an external conflict, and nothing may be drafted over it', (_name, draft) => {
    const edited = draft(session());
    const { stuck } = externallyConflicted(edited);
    expect(stuck.externalConflict?.draft).toBe(edited.draft);
    expect(canSave(stuck)).toBe(false);
    expect(editVariableField(stuck, 0, 'name', 'x')).toBe(stuck);
    expect(removeVariable(stuck, granted(stuck), 0)).toBe(stuck);
    expect(matchEditorView(stuck).retainedDraft.length).toBeGreaterThan(17);
  });

  it('lists the drafted variables with their status, and nothing for an untouched vars', () => {
    const untouched = matchEditorView(saveConflicted(editField(session(), 'label', 'x')));
    expect(untouched.retainedDraft.some((row) => row.label === 'variableName')).toBe(false);
    let held = editVariableField(session(), 0, 'name', 'renamed');
    held = removeVariable(held, granted(held), 1);
    const added = addVariable(held, granted(held), NO_NAMES, {
      ...NEW_ECHO,
      params: { Choice: { values: ['yes', 'no'] } },
      depends_on: ['renamed']
    });
    if (added.kind !== 'inserted') {
      throw new Error('this case needs the addition');
    }
    const rows = matchEditorView(saveConflicted(added.session)).retainedDraft.slice(17);
    expect(rows).toEqual([
      { label: 'variableName', text: 'renamed', status: 'setting' },
      { label: 'variableName', text: 'second', status: 'variableRemoved' },
      { label: 'variableName', text: 'greeting', status: 'variableAdded' },
      { label: 'type', text: 'choice', status: 'variableAdded' },
      { label: 'dependsOn', text: 'renamed', status: 'variableAdded' },
      { label: 'params', text: 'values', status: 'parameterName' },
      { label: 'params', text: 'yes', status: 'parameterValue' },
      { label: 'params', text: 'no', status: 'parameterValue' }
    ]);
  });
}); // End of the retention suite

// ---------------------------------------------------------------------------
// B1's regression coverage, extended to variable lists (model layer)
// ---------------------------------------------------------------------------

describe('B1, extended to variable lists — the model layer (Phase 4-9)', () => {
  // `docs/decisions/4-2-notes.md`: the conflict comparison was keyed by label and
  // threw on a repeated one. A variable draft repeats `variableName`, `type` and
  // `params` once per variable, so the same renderer rule must hold for it. The
  // mounted half — drafting through the variable controls and watching the panel
  // draw — needs those controls, which are Phase 4-11's (record §5).
  it.each([
    ['removal', (disk: DocumentView): readonly MatchView[] => disk.matches.slice(0, 0)],
    ['change', (disk: DocumentView): readonly MatchView[] => disk.matches]
  ] as const)('raises over a draft holding two variable rows under external %s, and keeps it', (_move, matches) => {
    let held = removeVariable(session(), granted(session()), 0);
    held = editVariableField(held, 1, 'name', 'kept');
    const disk = file([diskMatch({ replace: 'changed' })], AFTER);
    const stuck = applyObservation(
      held,
      arbitratedDelivery(null, { ...observed([], matches(disk)), correspondences: null }, false)
    );
    expect(stuck.externalConflict?.draft).toBe(held.draft);
    expect(canSave(stuck)).toBe(false);
    const rows = matchEditorView(stuck).retainedDraft.filter((row) => row.label === 'variableName');
    expect(rows.map((row) => row.text)).toEqual(['first', 'kept']);
  });

  it('keeps the comparison keyed by position in MatchEditor.svelte, which a repeated label needs', () => {
    const source = readFileSync(new URL('../components/MatchEditor.svelte', import.meta.url), 'utf8');
    expect(source).toContain('{#each view.retainedDraft as field, index (index)}');
    expect(source).not.toContain('{#each view.retainedDraft as field (field.label)}');
  });
}); // End of the B1 suite

// ---------------------------------------------------------------------------
// Whole-container reapply (ruling 22)
// ---------------------------------------------------------------------------

describe('the reapply is keyed on the whole vars container', () => {
  it.each(['save', 'external'] as const)(
    'reapplies over an unchanged container baseline (%s origin), sending the same intents',
    (origin) => {
      let edited = editVariableField(session(), 0, 'name', 'renamed');
      edited = removeVariable(edited, granted(edited), 1);
      const target = diskMatch({ vars: TWO_VARS, replace: 'moved elsewhere' });
      const { stuck, stands } = conflictedOver(edited, origin, target);
      const answer = reapply(stuck, origin, stands);
      expect(answer.kind).toBe('reapplied');
      if (answer.kind !== 'reapplied') {
        throw new Error('this case is about the rebuilt session');
      }
      expect(answer.session.match).toEqual(target.id);
      const draft = sent(answer.session);
      expect(draft.vars.map((one) => [one.index, one.name])).toEqual([[0, { Set: 'renamed' }]]);
      expect(draft.var_intents).toEqual([{ RemoveVariable: { index: 1 } }]);
      // A shifted offset is not a change: the fixture's container is the same
      // list whatever else moved.
    }
  );

  it.each(['save', 'external'] as const)('collides the whole container when the list changed or shifted (%s origin)', (origin) => {
    const edited = editVariableField(session(), 1, 'name', 'renamed');
    for (const changed of [
      // An insertion before the drafted one: index 1 now names another variable.
      [makeVariable({ node: 30, name: 'zero', declaredType: 'echo' }), ...TWO_VARS],
      // A reorder.
      [TWO_VARS[1] as VariableView, TWO_VARS[0] as VariableView],
      // A changed parameter of an untouched variable.
      [TWO_VARS[0] as VariableView, { ...(TWO_VARS[1] as VariableView), params: [field('echo', scalarItem('three'))] }]
    ]) {
      const { stuck, stands } = conflictedOver(edited, origin, diskMatch({ vars: changed }));
      const answer = reapply(stuck, origin, stands);
      expect(answer).toEqual({ kind: 'manualResolution', obstacle: { kind: 'fieldCollisions', fields: ['vars'] } });
    } // End of the loop over the changed lists
  });

  it.each(['save', 'external'] as const)(
    'collides a removal when only a comment it would delete changed (%s origin, the Phase 4-9 review)',
    (origin) => {
      // The review's scenario: the first variable is drafted for removal, and the
      // file meanwhile edits that variable's owned leading comment. Every row
      // projects the same; only Rust's container cut — which since the review
      // covers the owned hull (`a_change_to_a_comment_a_removal_would_delete_changes_the_container`
      // in `tests/authoring_snapshots.rs`) — tells the two files apart.
      const cut = (comment: string): ContainerBaseline => {
        const text = `    vars:\n      # ${comment}\n      - name: one\n`;
        return { Present: { text, fingerprint: text } };
      }; // End of function cut()
      const start = projection({ vars: TWO_VARS, varsContainer: cut('the first one') });
      const held = session(start);
      const edited = removeVariable(held, granted(held, start), 0);
      const target = diskMatch({ vars: TWO_VARS, varsContainer: cut('the first one, edited') });
      const { stuck, stands } = conflictedOver(edited, origin, target);
      expect(reapply(stuck, origin, stands)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'fieldCollisions', fields: ['vars'] }
      });
      // The same cut on both sides still reapplies.
      const same = conflictedOver(edited, origin, diskMatch({ vars: TWO_VARS, varsContainer: cut('the first one') }));
      expect(reapply(same.stuck, origin, same.stands).kind).toBe('reapplied');
    }
  );

  it('collides an Uncut container, which corresponds to nothing — itself included', () => {
    const uncut = session(projection({ vars: TWO_VARS, varsContainer: { Uncut: {} } }));
    const edited = editVariableField(uncut, 0, 'name', 'x');
    const plan = planMatchReapply(edited.baseline, edited.draft.value, baselineOf(diskMatch({ vars: TWO_VARS, varsContainer: { Uncut: {} } })));
    expect(plan.variables).toBe('collision');
    expect(plan.collisions).toEqual(['vars']);
  });

  it.each(['save', 'external'] as const)('is satisfied by a completely present intended result (%s origin)', (origin) => {
    let edited = editVariableField(session(), 0, 'name', 'renamed');
    edited = removeVariable(edited, granted(edited), 1);
    const added = addVariable(edited, granted(edited), NO_NAMES, NEW_ECHO);
    if (added.kind !== 'inserted') {
      throw new Error('this case needs the addition');
    }
    const present = [
      makeVariable({ node: 40, name: 'renamed', declaredType: 'echo', kind: 'Echo', params: [field('echo', scalarItem('one'))] }),
      makeVariable({ node: 41, name: 'greeting', declaredType: 'echo', kind: 'Echo', params: [field('echo', scalarItem('hello'))] })
    ];
    const { stuck, stands } = conflictedOver(added.session, origin, diskMatch({ vars: present }));
    expect(reapply(stuck, origin, stands).kind).toBe('alreadySatisfied');
    // One piece missing — the new variable's parameter differs — is no longer the
    // whole intended result, and the container moved, so it collides.
    const partial = [present[0] as VariableView, { ...(present[1] as VariableView), params: [field('echo', scalarItem('other'))] }];
    const again = conflictedOver(added.session, origin, diskMatch({ vars: partial }));
    expect(reapply(again.stuck, origin, again.stands)).toMatchObject({ kind: 'manualResolution' });
  });

  it('keeps a compound Insert together: half on disk collides both halves', () => {
    const held = session();
    const outcome = insertVariable(held, granted(held), NO_NAMES, {
      field: 'replace',
      selection: { start: 1, end: 1 },
      variable: NEW_ECHO
    });
    if (outcome.kind !== 'inserted') {
      throw new Error('this case needs the insertion');
    }
    const withNew = [
      ...TWO_VARS,
      makeVariable({ node: 42, name: 'greeting', declaredType: 'echo', kind: 'Echo', params: [field('echo', scalarItem('hello'))] })
    ];
    // The variable is already there and the reference is not.
    const half = planMatchReapply(outcome.session.baseline, outcome.session.draft.value, baselineOf(diskMatch({ vars: withNew })));
    expect(half.variables).toBe('collision');
    expect(half.collisions).toEqual(['replace', 'vars']);
    // Both halves there: satisfied together. Neither: applicable together.
    const whole = planMatchReapply(
      outcome.session.baseline,
      outcome.session.draft.value,
      baselineOf(diskMatch({ vars: withNew, replace: 'b{{greeting}}' }))
    );
    expect(whole.collisions).toEqual([]);
    expect(whole.writesAnything).toBe(false);
    const neither = planMatchReapply(outcome.session.baseline, outcome.session.draft.value, baselineOf(diskMatch({ vars: TWO_VARS })));
    expect(neither.collisions).toEqual([]);
    expect(neither.variables).toBe('applicable');
  });

  it('moves a compound Insert back with the text when the content switch is cancelled (the Phase 4-9 review)', () => {
    const held = session();
    const switched = chooseContentSwitch(held, 'markdown');
    expect(switched.draft.value.markdown.text).toBe('b');
    const outcome = insertVariable(switched, granted(switched), NO_NAMES, {
      field: 'markdown',
      selection: { start: 1, end: 1 },
      variable: NEW_ECHO
    });
    if (outcome.kind !== 'inserted') {
      throw new Error('this case needs the insertion');
    }
    expect(outcome.session.draft.value.variables.added[0]?.insertedInto).toBe('markdown');
    const cancelled = cancelContentSwitch(outcome.session);
    expect(cancelled.draft.value.replace.text).toBe('b{{greeting}}');
    expect(cancelled.draft.value.variables.added[0]?.insertedInto).toBe('replace');
    // So the compound rule still holds the halves together: the variable already
    // on disk and the reference not is a collision of both, never a half write.
    const withNew = [
      ...TWO_VARS,
      makeVariable({ node: 42, name: 'greeting', declaredType: 'echo', kind: 'Echo', params: [field('echo', scalarItem('hello'))] })
    ];
    const half = planMatchReapply(cancelled.baseline, cancelled.draft.value, baselineOf(diskMatch({ vars: withNew })));
    expect(half.variables).toBe('collision');
    expect(half.collisions).toEqual(['replace', 'vars']);
  });

  it('moves a compound Insert with the text when the content switch is chosen or re-pointed (the Phase 4-9 review)', () => {
    const held = session();
    const inserted = insertVariable(held, granted(held), NO_NAMES, {
      field: 'replace',
      selection: { start: 1, end: 1 },
      variable: NEW_ECHO
    });
    if (inserted.kind !== 'inserted') {
      throw new Error('this case needs the insertion');
    }
    // Choosing a target carries the source's text, reference included.
    const switched = chooseContentSwitch(inserted.session, 'markdown');
    expect(switched.draft.value.markdown.text).toBe('b{{greeting}}');
    expect(switched.draft.value.variables.added[0]?.insertedInto).toBe('markdown');
    // Re-pointing carries the previous target's text to the new one.
    const repointed = chooseContentSwitch(switched, 'html');
    expect(repointed.draft.value.html.text).toBe('b{{greeting}}');
    expect(repointed.draft.value.markdown.text).toBe('');
    expect(repointed.draft.value.variables.added[0]?.insertedInto).toBe('html');
    // And cancelling from there hands it back to the source.
    expect(cancelContentSwitch(repointed).draft.value.variables.added[0]?.insertedInto).toBe('replace');
    // Undo walks the ownership back with the text, one step each.
    expect(undoEdit(repointed).draft.value.variables.added[0]?.insertedInto).toBe('markdown');
  });

  it('never claims a logical string written plain as the intended one when it could be something else', () => {
    // `true` written plain is a boolean to YAML; a new variable named `true` is a
    // string Rust would quote. "Already there" must not be claimed.
    const edited = editVariableField(session(), 0, 'name', 'true');
    const plain = [{ ...(TWO_VARS[0] as VariableView), name: scalar('true') }, TWO_VARS[1] as VariableView];
    const plan = planMatchReapply(edited.baseline, edited.draft.value, baselineOf(diskMatch({ vars: plain })));
    expect(plan.variables).toBe('collision');
  });

  it('names the vars collision through the obstacle sentence, in both languages', () => {
    expect(editorReapplyObstacleKey({ kind: 'fieldCollisions', fields: ['vars'] })).toBe(
      'browser.matchEditor.reapply.fieldCollisions'
    );
    for (const locale of LOCALES) {
      expect(DICTIONARIES[locale]['browser.saveOutcome.label.vars']).toBeTruthy();
    } // End of the loop over the locales
  });
}); // End of the reapply suite

// ---------------------------------------------------------------------------
// Recovery refuses to recreate a snippet whose references lost their definitions
// ---------------------------------------------------------------------------

describe('recovery never creates a snippet whose references lost their definitions (ruling 21)', () => {
  /**
   * What recovery answers for one conflicted session, after a reapply that
   * resolved nothing.
   *
   * @param stuck - The conflicted session.
   * @returns The availability.
   */
  function recoveryOf(stuck: MatchEditorSession): ReturnType<typeof matchRecoveryAvailability> {
    const attempt = attemptOfReapply(stuck, reapply(stuck, 'save'));
    expect(attempt.outcome.kind).toBe('manualResolution');
    const summary = makeSummary({ id: 1, relativePath: 'match/base.yml' });
    return matchRecoveryAvailability(attempt.outcome, conflictOf(stuck), stuck.baseline, [summary], [file([], AFTER)]);
  } // End of function recoveryOf()

  it('refuses a snippet holding vars, whatever the draft changed', () => {
    const stuck = saveConflicted(editField(session(), 'replace', '{{first}} changed'));
    expect(recoveryOf(stuck)).toEqual({ kind: 'unavailable', reason: 'variablesNotCarried' });
    const opened = startMatchFieldRecovery(
      reapply(stuck, 'save'),
      conflictOf(stuck),
      stuck.baseline,
      [makeSummary({ id: 1, relativePath: 'match/base.yml' })],
      [file([], AFTER)],
      () => 0
    );
    expect(opened).toEqual({ kind: 'unavailable', reason: 'variablesNotCarried' });
  });

  it('refuses a draft that adds a variable to a snippet with none, and a shorthand form_fields', () => {
    const bare = session(projection());
    const inserted = insertVariable(bare, granted(bare, projection()), NO_NAMES, {
      field: 'replace',
      selection: { start: 1, end: 1 },
      variable: NEW_ECHO
    });
    expect(recoveryOf(saveConflicted(inserted.session))).toEqual({ kind: 'unavailable', reason: 'variablesNotCarried' });
    const form = session(projection({ replace: null, form: 'Hi [[n]]', formFields: [field('n', { Mapping: [] })] }));
    expect(carriesDefinitions(form.baseline.variables, form.draft.value.variables)).toBe(true);
  });

  it('still offers recovery for a snippet with no variables and no form definitions', () => {
    const stuck = saveConflicted(editField(session(projection()), 'replace', 'changed'));
    expect(recoveryOf(stuck).kind).toBe('offered');
    // An empty `vars: []` holds no definition a reference could lose.
    const empty = session(projection());
    expect(carriesDefinitions({ ...empty.baseline.variables, shape: 'empty' }, empty.draft.value.variables)).toBe(false);
  });

  it('has a sentence in both languages that names the ways out and claims nothing was written', () => {
    const key = recoveryUnavailableKey('variablesNotCarried');
    for (const locale of LOCALES) {
      expect(DICTIONARIES[locale][key]).toBeTruthy();
    } // End of the loop over the locales
    expect(DICTIONARIES.en[key]).toContain('Nothing was written');
  });
}); // End of the recovery suite

// ---------------------------------------------------------------------------
// R36 and R37
// ---------------------------------------------------------------------------

describe('R36’s conservative rule and R37’s one read', () => {
  it('withholds every structural variable action in the file while any match draft of it is stale', () => {
    const held = session();
    const stale: MatchId = { document: 1, revision: 'c'.repeat(64), node: 5 };
    const read = variableStructureReadOf([file([projection({ vars: TWO_VARS })])], 1, [stale]);
    const grant = variableStructureGrantOf(held.match, read);
    expect(grant).toEqual({ kind: 'refused', reason: 'staleDraftInDocument' });
    expect(removeVariable(held, grant, 0)).toBe(held);
    expect(removeVariables(held, grant)).toBe(held);
    expect(
      insertVariable(held, grant, NO_NAMES, { field: 'replace', selection: { start: 0, end: 0 }, variable: NEW_ECHO })
    ).toMatchObject({ kind: 'refused', refusal: { kind: 'structure', reason: 'staleDraftInDocument' } });
    expect(variableMoveOffer(held, read)).toMatchObject({ refusal: 'staleDraftInDocument', choices: [] });
    // The session's own identity counts: a file re-read under it is stale too,
    // and that is the reason given — not a missing snippet.
    const newer = variableStructureReadOf([file([projection({ vars: TWO_VARS }, AFTER)], AFTER)], 1, []);
    expect(variableStructureGrantOf(held.match, newer)).toEqual({ kind: 'refused', reason: 'staleDraftInDocument' });
  });

  it('spends only a grant minted for this exact identity', () => {
    const held = session();
    const other: VariableStructureGrant = { kind: 'granted', match: { ...held.match, node: 99 } };
    expect(removeVariable(held, other, 0)).toBe(held);
    expect(variableStructureGrantOf(held.match, variableStructureReadOf([], 1, []))).toEqual({
      kind: 'refused',
      reason: 'notInDocument'
    });
    const readOnly = variableStructureReadOf(
      [makeDocument({ id: 1, revision: BASE, readOnly: true, matches: [projection({ vars: TWO_VARS })] })],
      1,
      []
    );
    expect(variableStructureGrantOf(held.match, readOnly)).toEqual({ kind: 'refused', reason: 'readOnly' });
  });

  it('offers a reorder alone in its save (R25), and submits only a choice of the offer it drew', () => {
    const held = session();
    const read = variableStructureReadOf([file([projection({ vars: TWO_VARS })])], 1, []);
    const offer = variableMoveOffer(held, read);
    expect(offer.refusal).toBeNull();
    expect(offer.choices).toEqual([
      { variable: 0, to: { End: {} } },
      { variable: 1, to: { Front: {} } }
    ]);
    expect(variableMoveSubmissionOf(offer, 0, { End: {} })).toEqual({
      match: held.match,
      variable: 0,
      to: { End: {} },
      baseRevision: BASE
    });
    expect(variableMoveSubmissionOf(offer, 0, { Front: {} })).toBeNull();
    const dirty = editField(held, 'label', 'x');
    expect(variableMoveOffer(dirty, read)).toMatchObject({ refusal: 'otherEditsPending', choices: [] });
    expect(variableMoveOffer(session(projection({ vars: [TWO_VARS[0] as VariableView] })), read).refusal).toBe(
      'tooFewVariables'
    );
  });
}); // End of the R36/R37 suite

// ---------------------------------------------------------------------------
// Carriage returns and line feeds
// ---------------------------------------------------------------------------

describe('a carriage return is refused for every new control, and a line feed for every one-line one', () => {
  it('refuses both in a variable scalar box, at the edit', () => {
    const held = session();
    expect(editVariableField(held, 0, 'name', 'a\rb')).toBe(held);
    expect(editVariableField(held, 0, 'name', 'a\nb')).toBe(held);
  });

  it('refuses a new variable holding one, at the insertion and at the save', () => {
    const held = session();
    for (const variable of [
      { ...NEW_ECHO, params: { Echo: { echo: 'a\rb' } } },
      { ...NEW_ECHO, depends_on: ['a\nb'] }
    ] as const) {
      expect(addVariable(held, granted(held), NO_NAMES, variable)).toMatchObject({
        kind: 'refused',
        refusal: { kind: 'unreadableText' }
      });
    } // End of the loop over the unreadable variables
    // A multi-line echo is fine: a textarea keeps a line feed.
    expect(addVariable(held, granted(held), NO_NAMES, { ...NEW_ECHO, params: { Echo: { echo: 'a\nb' } } }).kind).toBe(
      'inserted'
    );
    // `MatchBuffers` carries no brand: a hand-built buffer reaches `beginSave`,
    // which refuses to send it.
    const forged = {
      ...held,
      draft: editDraft(held.draft, {
        ...held.draft.value,
        variables: {
          ...held.draft.value.variables,
          added: [{ variable: { ...NEW_ECHO, params: { Echo: { echo: 'a\rb' } } }, insertedInto: null }]
        }
      })
    };
    expect(beginSave(forged, () => forged)).toBeNull();
    const forgedName = {
      ...held,
      draft: editDraft(held.draft, {
        ...held.draft.value,
        variables: {
          ...held.draft.value.variables,
          rows: held.draft.value.variables.rows.map((row, index) =>
            index === 0 ? { ...row, name: { text: 'x\ny' } } : row
          )
        }
      })
    };
    expect(beginSave(forgedName, () => forgedName)).toBeNull();
  });
}); // End of the carriage-return suite

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

describe('names are checked against every visible name, and an open scope says so', () => {
  it('refuses a local, an addition, a capture, a global and a synthesized name', () => {
    const context: NameContext = {
      locals: ['first'],
      additions: ['pending'],
      captures: ['cap'],
      globals: ['glob'],
      synthesized: ['form1'],
      scopeClosed: false
    };
    expect(nameVerdictOf('first', context, true)).toEqual({ kind: 'refused', reason: 'takenByLocal' });
    expect(nameVerdictOf('pending', context, true)).toEqual({ kind: 'refused', reason: 'takenByAddition' });
    expect(nameVerdictOf('cap', context, true)).toEqual({ kind: 'refused', reason: 'takenByCapture' });
    expect(nameVerdictOf('glob', context, true)).toEqual({ kind: 'refused', reason: 'takenByGlobal' });
    expect(nameVerdictOf('form1', context, true)).toEqual({ kind: 'refused', reason: 'takenBySynthesized' });
    expect(nameVerdictOf('', context, true)).toEqual({ kind: 'refused', reason: 'empty' });
    expect(nameVerdictOf('two words', context, true)).toEqual({ kind: 'refused', reason: 'notAnIdentifier' });
    expect(nameVerdictOf('two words', context, false).kind).toBe('available');
    // Open scope: available among visible names, never collision-free.
    expect(nameVerdictOf('fresh', context, true)).toEqual({ kind: 'available', scope: 'open' });
    expect(nameVerdictKey({ kind: 'available', scope: 'open' })).toBe(
      'browser.variableEditor.name.availableAmongVisibleNames'
    );
    expect(nameVerdictOf('fresh', { ...context, scopeClosed: true }, true)).toEqual({ kind: 'available', scope: 'closed' });
  });

  it('gathers the context from the session, the analysis and the file, and a renamed name stays taken', () => {
    const held = editVariableField(session(), 0, 'name', 'renamed');
    const context = nameContextOf(held, null, file([], BASE));
    expect(context.locals).toEqual(expect.arrayContaining(['first', 'renamed', 'second']));
    expect(context.scopeClosed).toBe(false);
    expect(suggestedName('first', context)).toBe('first2');
    expect(suggestedName('choice!', NO_NAMES)).toBe('choice');
    expect(suggestedName('', NO_NAMES)).toBe('var');
    const refused = insertVariable(held, granted(held), context, {
      field: 'replace',
      selection: { start: 0, end: 0 },
      variable: { ...NEW_ECHO, name: 'first' }
    });
    expect(refused).toMatchObject({ kind: 'refused', refusal: { kind: 'name', reason: 'takenByLocal' } });
  });
}); // End of the names suite

// ---------------------------------------------------------------------------
// Every new code has a sentence in both languages
// ---------------------------------------------------------------------------

describe('every new code has a sentence in both languages', () => {
  it('for every refusal and verdict this phase adds', () => {
    const keys = [
      ...(['notDecodable', 'carriageReturn', 'ownsNoBytes', 'unmodelledShape', 'lineBreak', 'notInVariable'] as const satisfies readonly VariableFieldRefusal[]).map(variableFieldRefusalKey),
      ...(['varsNotABlockList', 'additionPending', 'containerRemoved', 'notDraftable'] as const satisfies readonly VariableAdditionRefusal[]).map(variableAdditionRefusalKey),
      ...([
        'notInDocument',
        'readOnly',
        'staleDraftInDocument',
        'editorNotEditable',
        'otherEditsPending',
        'varsNotABlockList',
        'tooFewVariables'
      ] as const satisfies readonly VariableMoveRefusal[]).map(variableMoveRefusalKey),
      ...([
        'empty',
        'notAnIdentifier',
        'takenByLocal',
        'takenByAddition',
        'takenByCapture',
        'takenByGlobal',
        'takenBySynthesized'
      ] as const satisfies readonly NameRefusal[]).map(nameRefusalKey),
      nameVerdictKey({ kind: 'available', scope: 'closed' }),
      insertRefusalKey({ kind: 'fieldNotEditable' }),
      insertRefusalKey({ kind: 'unreadableText' }),
      saveWithheldKey('varsWouldBeEmpty'),
      saveWithheldKey('variableAdditionsCollide')
    ];
    for (const key of keys) {
      for (const locale of LOCALES) {
        expect(DICTIONARIES[locale][key], `${locale}:${key}`).toBeTruthy();
      } // End of the loop over the locales
    } // End of the loop over the keys
  });
}); // End of the sentences suite
