/**
 * Phase 4-11 — the *Variables and fill-ins* group and the reorder writer, as
 * model values.
 *
 * What this file pins (step 4-11 of `docs/decisions/4-split-notes.md` §2, the
 * model half; the mounted half is `../components/MatchEditorVariables.test.ts`):
 *
 * - the view: one chip per declaration in authored order and then the new ones,
 *   a removed declaration and a removed container keeping every chip (every
 *   declaration stays reachable), no controls without a selection, and a
 *   selection that no longer names anything dropped;
 * - the dependency state read from the Rust analysis only while it answers for
 *   the session's exact identity, the reasons it is incomplete split between
 *   the group and the declaration they name, and the late reply that changes
 *   nothing;
 * - D2u for a quoted `inject_vars`: the style said beside the box, and that an
 *   edit writes it plain;
 * - the **Choice** insertion: the provisional name, "available among visible
 *   names" under an open scope, the values' problems, and one compound action
 *   that reaches one save and one undo;
 * - the reorder writer: `beginVariableMove` refuses a pending draft (R25), a
 *   stale draft in the file (R36, through the offer), an offer for another
 *   identity and a choice the offer does not hold; a commit owes a
 *   re-projection and is never reported as an error; a reorder's conflict and
 *   refusal withdraw the choices that act on a draft.
 *
 * **Model evidence, never a screen.** Per `1b-2a-notes.md` section 14, a
 * `describe`/`it` callback whose sibling argument is already its description
 * carries no JSDoc of its own; ordinary helpers here do.
 */

import { describe, expect, it } from 'vitest';
import { DICTIONARIES } from '../i18n/dictionaries';
import { LOCALES } from '../i18n/locale';
import type {
  AnalysisSummary,
  AuthoringSnapshot,
  ContentRevision,
  DeclarationSummary,
  DocumentView,
  ListPlacement,
  MatchId,
  MatchView,
  SaveResult,
  VariableView
} from '../ipc/types';
import {
  field,
  makeConflict,
  makeDocument,
  makeMatch,
  makeVariable,
  scalarItem,
  styledScalar
} from './fixtures';
import type { InvalidationStatus } from './invalidation';
import {
  applySave,
  beginSave,
  beginVariableMove,
  editField,
  editVariableField,
  matchEditorView,
  removeVariable,
  removeVariables,
  saveCouldNotBeSent,
  startMatchEditor,
  undoEdit,
  variableMoveOffer,
  type MatchEditorSession
} from './matchEditor';
import {
  analysisOf,
  analysisStateKey,
  choiceDraftOf,
  choiceInsertionViewOf,
  choiceProblemKey,
  choiceValuesOf,
  declarationStatusKey,
  heldAfterReply,
  insertChoice,
  liveSelection,
  moveChoiceKey,
  NO_SELECTION,
  seededSelection,
  selectionOfSeed,
  variableGroupViewOf,
  type HeldAnalysis
} from './variableGroup';
import {
  variableStructureGrantOf,
  variableStructureReadOf,
  type VariableStructureRead
} from './variableEditor';
import { nameContextOf, nameVerdictKey } from './variableInsertion';
import { addKindVariable, editKindDraft, kindAdditionViewOf, kindDraftOf, type KindDraft } from './variableKinds';

/**
 * An echo form holding a name and a text, through the model's own edit.
 *
 * @param name - The name.
 * @param echo - The echoed text.
 * @param context - The names the form was opened over.
 * @returns The form.
 */
function echoForm(name: string, echo: string, context: ReturnType<typeof nameContextOf>): KindDraft {
  const named = editKindDraft(kindDraftOf('echo', context), 'name', name).draft;
  return editKindDraft(named, 'echo', echo).draft;
} // End of function echoForm()

/** The revision every projection below is minted from. */
const BASE: ContentRevision = 'a'.repeat(64);

/** The revision a committed reorder produces. */
const AFTER: ContentRevision = 'b'.repeat(64);

/** The adoption a save that wrote nothing owes: none. */
const NOT_OWED: InvalidationStatus = { kind: 'notOwed' };

/** Three variables: `first` and `second` echo, `third` depends on `first`. */
const THREE_VARS: readonly VariableView[] = [
  makeVariable({ node: 20, name: 'first', declaredType: 'echo', kind: 'Echo', params: [field('echo', scalarItem('one'))] }),
  makeVariable({ node: 21, name: 'second', declaredType: 'echo', kind: 'Echo', params: [field('echo', scalarItem('two'))] }),
  makeVariable({ node: 22, name: 'third', declaredType: 'echo', kind: 'Echo', dependsOn: [scalarItem('first')] })
];

/**
 * A projection of the snippet, minted at `revision`.
 *
 * @param overrides - Whatever the case needs.
 * @param revision - The revision.
 * @returns The projection.
 */
function projection(overrides: Parameters<typeof makeMatch>[0] = {}, revision: ContentRevision = BASE): MatchView {
  return makeMatch({ revision, document: 1, node: 1, trigger: ':a', replace: 'Hello ', vars: THREE_VARS, ...overrides });
} // End of function projection()

/**
 * The file a projection lives in.
 *
 * @param matches - Its snippets.
 * @param revision - Its revision.
 * @returns The projection of the file.
 */
function file(matches: readonly MatchView[], revision: ContentRevision = BASE): DocumentView {
  return makeDocument({ id: 1, relativePath: 'match/base.yml', revision, matches });
} // End of function file()

/**
 * A clean session over a projection.
 *
 * @param match - The projection.
 * @returns The session.
 */
function session(match: MatchView = projection()): MatchEditorSession {
  return startMatchEditor(match, () => 0);
} // End of function session()

/**
 * One read of the window holding the session's own file and no other draft.
 *
 * @param match - The projection the file holds.
 * @param drafts - Other open drafts.
 * @returns The read.
 */
function readOf(match: MatchView = projection(), drafts: readonly MatchId[] = []): VariableStructureRead {
  return variableStructureReadOf([file([match])], 1, drafts);
} // End of function readOf()

/**
 * One declaration of an analysis.
 *
 * @param index - Its position.
 * @param name - Its name.
 * @param usage - Its usage counts, all zero unless given.
 * @returns The declaration.
 */
function declared(index: number, name: string | null, usage: Partial<DeclarationSummary['usage']> = {}): DeclarationSummary {
  return {
    index,
    name,
    kind: 'Echo',
    injection: 'Disabled',
    usage: { body: 0, parameters: 0, depends_on: 0, unverified_layout: 0, ...usage },
    layout: null
  };
} // End of function declared()

/**
 * An analysis of the three variables: `first` used once in the body and
 * depended on by `third`, `second` referenced nowhere, `third` written after its
 * dependency; the scope open because the file imports others.
 *
 * @param overrides - Whatever the case changes.
 * @returns The analysis.
 */
function analysis(overrides: Partial<AnalysisSummary> = {}): AnalysisSummary {
  return {
    declarations: [declared(0, 'first', { body: 1, depends_on: 1 }), declared(1, 'second'), declared(2, 'third', { body: 1 })],
    edges: [{ consumer: 2, dependency: 0, kind: 'Explicit' }],
    cycles: [],
    missing_dependencies: [],
    order_advisories: [],
    form_advisories: [],
    incomplete: [{ ImportsOpenScope: {} }, { InjectionUncertain: { declaration: 1 } }],
    scope_closed: false,
    captures: [],
    shorthand_form: null,
    unverified_layout_references: [],
    ...overrides
  };
} // End of function analysis()

/**
 * What the editor holds once the snapshot for the session answered.
 *
 * @param held - The session.
 * @param summary - The analysis.
 * @returns The held analysis.
 */
function readFor(held: MatchEditorSession, summary: AnalysisSummary = analysis()): HeldAnalysis {
  const snapshot: AuthoringSnapshot = {
    id: held.match,
    vars: held.baseline.variables.container,
    form_fields: { Absent: {} },
    analysis: summary
  };
  return { kind: 'read', for: held.match, snapshot };
} // End of function readFor()

describe('the group view — chips, the list and the selection', () => {
  it('draws one chip per declaration in authored order, and no controls until one is selected', () => {
    const held = session();
    const view = variableGroupViewOf(held, null, null, readOf());
    expect(view.chips.map((chip) => [chip.name, chip.typeText, chip.status])).toEqual([
      ['first', 'echo', 'file'],
      ['second', 'echo', 'file'],
      ['third', 'echo', 'file']
    ]);
    expect(view.rows.map((row) => row.index)).toEqual([0, 1, 2]);
    expect(view.selected).toBeNull();
    expect(view.chips.every((chip) => !chip.selected)).toBe(true);
    const chosen = variableGroupViewOf(held, null, { kind: 'variable', index: 1 }, readOf());
    expect(chosen.selected).toMatchObject({ kind: 'variable', index: 1, name: 'second' });
    expect(chosen.chips.map((chip) => chip.selected)).toEqual([false, true, false]);
  });

  it('keeps every declaration reachable: a removed variable and a removed container keep their chips', () => {
    const held = session();
    const removed = removeVariable(held, variableStructureGrantOf(held.match, readOf()), 1);
    const view = variableGroupViewOf(removed, null, { kind: 'variable', index: 1 }, readOf());
    expect(view.chips.map((chip) => chip.status)).toEqual(['file', 'removed', 'file']);
    expect(view.selected).toMatchObject({ kind: 'variable', removed: true, canRestore: true, canRemove: false });
    const all = removeVariables(held, variableStructureGrantOf(held.match, readOf()));
    const everything = variableGroupViewOf(all, null, { kind: 'variable', index: 0 }, readOf());
    expect(everything.containerRemoved).toBe(true);
    expect(everything.canRestoreAll).toBe(true);
    expect(everything.chips.map((chip) => chip.status)).toEqual(['removed', 'removed', 'removed']);
    // A variable under a removed container is restored with the container.
    expect(everything.selected).toMatchObject({ kind: 'variable', removed: true, canRestore: false });
  });

  it('marks an edited declaration and draws the draft’s name', () => {
    const held = session();
    const renamed = editVariableField(held, 0, 'name', 'renamed');
    const view = variableGroupViewOf(renamed, null, null, readOf());
    expect(view.chips[0]).toMatchObject({ name: 'renamed', status: 'edited' });
    expect(view.rows.map((row) => row.status)).toEqual(['edited', 'file', 'file']);
    // A content edit is not a variable edit.
    const typed = variableGroupViewOf(editField(held, 'replace', 'Hello x'), null, null, readOf());
    expect(typed.rows.map((row) => row.status)).toEqual(['file', 'file', 'file']);
  });

  it('drops a selection that names nothing any more', () => {
    const held = session();
    expect(liveSelection(held, { kind: 'variable', index: 3 })).toBeNull();
    expect(liveSelection(held, { kind: 'added', position: 0 })).toBeNull();
    expect(liveSelection(held, { kind: 'choice' })).toEqual({ kind: 'choice' });
    expect(liveSelection(held, { kind: 'variable', index: 2 })).toEqual({ kind: 'variable', index: 2 });
  });

  it('withholds structural actions over a stale draft in the file (R36), and says why', () => {
    const held = session();
    const stale: MatchId = { document: 1, revision: 'c'.repeat(64), node: 9 };
    const view = variableGroupViewOf(held, null, { kind: 'variable', index: 0 }, readOf(projection(), [stale]));
    expect(view.structureRefusal).toBe('staleDraftInDocument');
    expect(view.canRemoveAll).toBe(false);
    expect(view.moveRefusal).toBe('staleDraftInDocument');
    expect(view.selected).toMatchObject({ canRemove: false, moves: [] });
  });
}); // End of the "group view" suite

describe('the dependency state — the Rust analysis, for this identity only', () => {
  it('shows nothing until the snapshot answers, and nothing for another identity', () => {
    const held = session();
    expect(analysisOf(held, null)).toEqual({ state: 'unavailable', analysis: null });
    expect(analysisOf(held, { kind: 'reading', for: held.match }).state).toBe('reading');
    expect(analysisOf(held, { kind: 'unreadable', for: held.match }).state).toBe('unavailable');
    const other: MatchId = { ...held.match, revision: AFTER };
    expect(analysisOf(held, { kind: 'reading', for: other }).state).toBe('outOfStep');
    const current = readFor(held);
    expect(analysisOf(held, current).state).toBe('current');
    // A snapshot whose own identity is another revision is not about this session.
    if (current.kind !== 'read') {
      throw new Error('unreachable');
    }
    expect(
      analysisOf(held, { ...current, snapshot: { ...current.snapshot, id: other } }).state
    ).toBe('outOfStep');
    expect(variableGroupViewOf(held, { kind: 'reading', for: held.match }, null, readOf()).rows.every(
      (row) => row.dependency === null
    )).toBe(true);
  });

  it('reads usage, edges, cycles, missing dependencies, order advisories and reasons from the analysis', () => {
    const held = session();
    const summary = analysis({
      cycles: [{ members: [1], explicit: true, inferred: false }],
      missing_dependencies: [{ consumer: 2, entry: 0 }],
      order_advisories: [{ consumer: 0, dependency: 2 }]
    });
    const view = variableGroupViewOf(held, readFor(held, summary), null, readOf());
    const [first, second, third] = view.rows.map((row) => row.dependency);
    expect(first).toMatchObject({
      usage: { body: 1, parameters: 0, depends_on: 1, unverified_layout: 0 },
      noVisibleReference: false,
      dependsOn: [],
      usedBy: [{ name: 'third', kind: 'Explicit' }],
      writtenBefore: ['third'],
      inCycle: false
    });
    // "No visible reference found" — never "has no effect" (ruling 13).
    expect(second).toMatchObject({ noVisibleReference: true, inCycle: true, incomplete: [{ InjectionUncertain: { declaration: 1 } }] });
    expect(third).toMatchObject({ dependsOn: [{ name: 'first', kind: 'Explicit' }], missingDependencies: 1 });
    // The reason naming no declaration is the group's; the one naming `second` is its row's.
    expect(view.analysis).toEqual({ state: 'current', incomplete: [{ ImportsOpenScope: {} }] });
    expect(third?.incomplete).toEqual([]);
  });

  it('keeps a late reply for an identity the editor moved away from out', () => {
    const held = session();
    const asked = held.match;
    const moved: MatchId = { ...asked, revision: AFTER };
    const answer = { ok: true as const, value: (readFor(held) as Extract<HeldAnalysis, { kind: 'read' }>).snapshot };
    expect(heldAfterReply({ kind: 'reading', for: asked }, asked, answer)).toMatchObject({ kind: 'read' });
    const newer: HeldAnalysis = { kind: 'reading', for: moved };
    expect(heldAfterReply(newer, asked, answer)).toBe(newer);
    expect(heldAfterReply(null, asked, answer)).toBeNull();
    expect(
      heldAfterReply({ kind: 'reading', for: asked }, asked, {
        ok: false,
        failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
      })
    ).toEqual({ kind: 'unreadable', for: asked });
  });
}); // End of the "dependency state" suite

describe('D2u for a quoted setting', () => {
  it('says how the file writes a quoted inject_vars, and that an edit writes it plain', () => {
    const quoted: VariableView = { ...THREE_VARS[0]!, inject_vars: styledScalar('false', 'SingleQuoted') };
    const plain: VariableView = { ...THREE_VARS[1]!, inject_vars: styledScalar('false', 'Plain') };
    const match = projection({ vars: [quoted, plain] });
    const held = session(match);
    const first = variableGroupViewOf(held, null, { kind: 'variable', index: 0 }, readOf(match));
    expect(first.selected?.kind === 'variable' ? first.selected.fields : []).toEqual([
      expect.objectContaining({ field: 'name', style: null, editWritesPlain: false }),
      expect.objectContaining({ field: 'type', style: null, editWritesPlain: false }),
      expect.objectContaining({ field: 'inject_vars', text: 'false', style: 'SingleQuoted', editWritesPlain: true, editable: true })
    ]);
    const second = variableGroupViewOf(held, null, { kind: 'variable', index: 1 }, readOf(match));
    expect(second.selected?.kind === 'variable' ? second.selected.fields[2] : null).toMatchObject({
      style: null,
      editWritesPlain: false
    });
  });

  it('shows an absent key read-only with its reason, never as a box', () => {
    const held = session();
    const view = variableGroupViewOf(held, null, { kind: 'variable', index: 0 }, readOf());
    expect(view.selected?.kind === 'variable' ? view.selected.fields[2] : null).toMatchObject({
      field: 'inject_vars',
      editable: false,
      refusal: 'notInVariable'
    });
  });
}); // End of the "D2u" suite

describe('the Choice insertion', () => {
  it('proposes a provisional name the visible names do not refuse, and says "available among visible names" under an open scope', () => {
    const match = projection({ vars: [...THREE_VARS, makeVariable({ node: 23, name: 'choice', declaredType: 'echo', kind: 'Echo' })] });
    const held = session(match);
    const open = nameContextOf(held, null, file([match]));
    const draft = choiceDraftOf(held, open);
    expect(draft).toEqual({ name: 'choice2', values: '', target: 'replace' });
    const grant = variableStructureGrantOf(held.match, readOf(match));
    const said = choiceInsertionViewOf(held, open, grant, { ...draft, values: 'a\nb' });
    expect(said.verdict).toEqual({ kind: 'available', scope: 'open' });
    expect(nameVerdictKey(said.verdict)).toBe('browser.variableEditor.name.availableAmongVisibleNames');
    expect(said.canInsert).toBe(true);
    // A closed scope is the other sentence.
    const closed = nameContextOf(held, analysis({ scope_closed: true, incomplete: [] }), file([match]));
    expect(choiceInsertionViewOf(held, closed, grant, { ...draft, values: 'a' }).verdict).toEqual({
      kind: 'available',
      scope: 'closed'
    });
    // A taken name is refused by name.
    expect(choiceInsertionViewOf(held, open, grant, { ...draft, name: 'first', values: 'a' })).toMatchObject({
      verdict: { kind: 'refused', reason: 'takenByLocal' },
      canInsert: false
    });
  });

  it('reads the values one per line, and names what is wrong with them', () => {
    expect(choiceValuesOf('a\nb')).toEqual({ values: ['a', 'b'] });
    expect(choiceValuesOf('a\nb\n')).toEqual({ values: ['a', 'b'] });
    expect(choiceValuesOf('')).toEqual({ problem: 'noValues' });
    expect(choiceValuesOf('a\n\nb')).toEqual({ problem: 'emptyValue' });
    expect(choiceValuesOf('a\r\nb')).toEqual({ problem: 'carriageReturn' });
  });

  it('inserts the reference and the choice variable as one step, which one save sends and one undo takes back', () => {
    const held = session();
    const grant = variableStructureGrantOf(held.match, readOf());
    const context = nameContextOf(held, null, file([projection()]));
    const outcome = insertChoice(held, grant, context, { name: 'choice', values: 'yes\nno', target: 'replace' }, { start: 6, end: 6 });
    if (outcome.kind !== 'inserted') {
      throw new Error('this case needs the insertion drafted');
    }
    const after = outcome.session;
    expect(after.draft.value.replace.text).toBe('Hello {{choice}}');
    expect(outcome.selection).toEqual({ start: 16, end: 16 });
    const started = beginSave(after, () => after);
    expect(started?.draft.replace).toEqual({ Set: 'Hello {{choice}}' });
    expect(started?.draft.var_intents).toEqual([
      {
        InsertVariable: {
          at: { End: {} },
          variable: {
            name: 'choice',
            params: { Choice: { values: ['yes', 'no'] } },
            inject_vars: null,
            depends_on: null,
            extra_params: []
          }
        }
      }
    ]);
    const view = variableGroupViewOf(after, null, { kind: 'added', position: 0 }, readOf());
    expect(view.chips.at(-1)).toMatchObject({ name: 'choice', typeText: 'choice', status: 'added', selected: true });
    expect(view.selected).toMatchObject({ kind: 'added', values: ['yes', 'no'], insertedInto: 'replace' });
    const undone = undoEdit(after);
    expect(undone.draft.value.replace.text).toBe('Hello ');
    expect(undone.draft.value.variables.added).toEqual([]);
  });

  it('refuses without drafting: no target, bad values, a pending addition, a stale draft', () => {
    const noBody = projection({ replace: null, form: 'Name: [[name]]' });
    const formSession = session(noBody);
    const grant = variableStructureGrantOf(formSession.match, readOf(noBody));
    const context = nameContextOf(formSession, null, file([noBody]));
    expect(insertChoice(formSession, grant, context, { name: 'choice', values: 'a', target: 'replace' }, { start: 0, end: 0 })).toMatchObject({
      kind: 'problem',
      problem: 'noTarget'
    });
    const held = session();
    const ok = variableStructureGrantOf(held.match, readOf());
    const names = nameContextOf(held, null, file([projection()]));
    expect(insertChoice(held, ok, names, { name: 'choice', values: '', target: 'replace' }, { start: 0, end: 0 })).toMatchObject({
      kind: 'problem',
      problem: 'noValues'
    });
    const first = insertChoice(held, ok, names, { name: 'choice', values: 'a', target: 'replace' }, { start: 0, end: 0 });
    if (first.kind !== 'inserted') {
      throw new Error('this case needs the first insertion drafted');
    }
    const second = insertChoice(first.session, ok, names, { name: 'other', values: 'a', target: 'replace' }, { start: 0, end: 0 });
    expect(second).toMatchObject({ kind: 'refused', refusal: { kind: 'addition', reason: 'additionPending' } });
    const stale = variableStructureGrantOf(held.match, readOf(projection(), [{ document: 1, revision: 'c'.repeat(64), node: 9 }]));
    expect(insertChoice(held, stale, names, { name: 'choice', values: 'a', target: 'replace' }, { start: 0, end: 0 })).toMatchObject({
      kind: 'refused',
      refusal: { kind: 'structure', reason: 'staleDraftInDocument' }
    });
  });
}); // End of the "Choice insertion" suite

describe('the echo Add variable (the Add a variable form on its echo kind since Phase 4-14-1)', () => {
  it('proposes a provisional name, checks it as a name rather than a reference, and adds the variable as one step', () => {
    const held = session();
    const grant = variableStructureGrantOf(held.match, readOf());
    const context = nameContextOf(held, null, file([projection()]));
    const draft = kindDraftOf('echo', context);
    expect(draft.name).toBe('echo');
    expect(draft.parts.echo).toBe('');
    // Not inserted as a reference, so a name outside the identifier subset is not refused for it.
    expect(kindAdditionViewOf(held, context, grant, echoForm('my name', 'x', context))).toMatchObject({
      verdict: { kind: 'available', scope: 'open' },
      canAdd: true
    });
    const outcome = addKindVariable(held, grant, context, echoForm('greeting', 'hello', context));
    if (outcome.kind !== 'inserted') {
      throw new Error('this case needs the addition drafted');
    }
    expect(outcome.session.draft.value.replace.text).toBe('Hello ');
    expect(outcome.session.draft.past.length).toBe(1);
    expect(beginSave(outcome.session, () => outcome.session)?.draft.var_intents).toEqual([
      {
        InsertVariable: {
          at: { End: {} },
          variable: { name: 'greeting', params: { Echo: { echo: 'hello' } }, inject_vars: null, depends_on: null, extra_params: [] }
        }
      }
    ]);
    // A second addition waits for a save.
    expect(kindAdditionViewOf(outcome.session, context, grant, echoForm('other', '', context))).toMatchObject({
      withheld: { kind: 'addition', reason: 'additionPending' },
      canAdd: false
    });
  });
}); // End of the "echo Add variable" suite

/**
 * A committed reorder's answer.
 *
 * @param held - The session the reorder was sent from.
 * @returns The save result.
 */
function committedReorder(held: MatchEditorSession): SaveResult {
  return {
    outcome: 'saved',
    revision: AFTER,
    committed: true,
    notes: [],
    backup_taken: false,
    moved: { ...held.match, revision: AFTER }
  };
} // End of function committedReorder()

/**
 * Starts the reorder of the second variable to the front, from a fresh offer.
 *
 * @param held - The session.
 * @returns The started reorder.
 */
function startReorder(held: MatchEditorSession): NonNullable<ReturnType<typeof beginVariableMove>> {
  const started = beginVariableMove(held, variableMoveOffer(held, readOf()), 1, { Front: {} }, () => held);
  if (started === null) {
    throw new Error('this case needs the reorder started');
  }
  return started;
} // End of function startReorder()

describe('the reorder writer — alone in its save, over a clean draft', () => {
  it('starts only from a clean draft (R25), an offer for this identity and a choice the offer holds', () => {
    const held = session();
    const front: ListPlacement = { Front: {} };
    const offer = variableMoveOffer(held, readOf());
    // A pending draft: the kept offer does not let it through.
    const dirty = editField(held, 'replace', 'Hello there');
    expect(beginVariableMove(dirty, offer, 1, front, () => dirty)).toBeNull();
    // An offer minted for another revision.
    expect(beginVariableMove(held, { ...offer, baseRevision: AFTER }, 1, front, () => held)).toBeNull();
    expect(beginVariableMove(held, { ...offer, match: { ...held.match, node: 99 } }, 1, front, () => held)).toBeNull();
    // A placement the offer does not hold (the first variable is already first).
    expect(beginVariableMove(held, offer, 0, front, () => held)).toBeNull();
    // A stale draft in the file: the offer itself is refused (R36).
    const staleOffer = variableMoveOffer(held, readOf(projection(), [{ document: 1, revision: 'c'.repeat(64), node: 9 }]));
    expect(staleOffer.refusal).toBe('staleDraftInDocument');
    expect(beginVariableMove(held, staleOffer, 1, front, () => held)).toBeNull();
    // A session that is no longer the one installed.
    expect(beginVariableMove(held, offer, 1, front, () => dirty)).toBeNull();
    const started = startReorder(held);
    expect(started.submission).toEqual({ match: held.match, variable: 1, to: front, baseRevision: BASE });
    expect(started.acknowledgement).toEqual({ accepted: [] });
    expect(started.session.phase).toBe('saving');
    expect(matchEditorView(started.session).editable).toBe(false);
  });

  it('takes a commit as a success that owes a re-projection, never as an error', () => {
    const held = session();
    const started = startReorder(held);
    const saved = applySave(started.session, committedReorder(held), { kind: 'done' }, () => started.session);
    const view = matchEditorView(saved);
    expect(view.outcome?.kind).toBe('saved');
    expect(view.sendFailure).toBeNull();
    expect(view.needsReprojection).toBe(true);
    expect(saved.match.revision).toBe(AFTER);
    expect(saved.baseline.variables.reprojectionOwed).toBe(true);
    expect(saved.baseline.forms.reprojectionOwed).toBe(true);
    expect(view.reorderAnswered).toBe(true);
    // Nothing drafted is left to save.
    expect(view.dirty).toBe(false);
  });

  it('withdraws Keep my draft and Copy my text from a reorder’s conflict, and keeps them for a draft save’s', () => {
    const held = session();
    const started = startReorder(held);
    const conflict = makeConflict({ disk: file([], AFTER), expected: BASE, found: AFTER });
    const conflicted = applySave(started.session, conflict, NOT_OWED, () => started.session);
    const view = matchEditorView(conflicted);
    expect(view.reorderAnswered).toBe(true);
    expect(view.conflictChoices).not.toContain('keepMyDraft');
    expect(view.conflictChoices).not.toContain('copyDraft');
    expect(view.conflictChoices).toContain('reloadDiskVersion');
    expect(view.retainedDraft).toEqual([]);
    // A draft save's conflict still offers both.
    const dirty = editField(held, 'replace', 'Hello there');
    const draftStart = beginSave(dirty, () => dirty);
    if (draftStart === null) {
      throw new Error('this case needs a saveable draft');
    }
    const draftConflict = matchEditorView(applySave(draftStart.session, conflict, NOT_OWED, () => draftStart.session));
    expect(draftConflict.reorderAnswered).toBe(false);
    expect(draftConflict.conflictChoices).toContain('keepMyDraft');
  });

  it('offers only Keep editing over a reorder’s refusal, and a later draft save forgets the reorder', () => {
    const held = session();
    const started = startReorder(held);
    const refused: SaveResult = {
      outcome: 'refused',
      verdict: 'RefusedForUnacknowledgedSuspicions',
      findings: [{ code: { ReferenceHasNoDeclaration: { name: 'x' } }, span: null, node: null, path: null }]
    };
    const answered = applySave(started.session, refused, NOT_OWED, () => started.session);
    expect(matchEditorView(answered).refusalChoices).toEqual(['keepEditing']);
    expect(matchEditorView(answered).reorderAnswered).toBe(true);
    // The same refusal over a draft save offers Save anyway: the withdrawal is the reorder's.
    const dirty = editField(held, 'replace', 'Hello there');
    const draftStart = beginSave(dirty, () => dirty);
    if (draftStart === null) {
      throw new Error('this case needs a saveable draft');
    }
    expect(
      matchEditorView(applySave(draftStart.session, refused, NOT_OWED, () => draftStart.session)).refusalChoices
    ).toContain('saveAnyway');
    const failed = saveCouldNotBeSent(started.session, false, null, () => started.session);
    expect(matchEditorView(failed).sendFailure).not.toBeNull();
    const edited = editField(failed, 'replace', 'Hello there');
    const later = beginSave(edited, () => edited);
    expect(later?.session.movedVariable).toBeNull();
  });
}); // End of the "reorder writer" suite

describe('the sentences', () => {
  it('has both languages for every new code', () => {
    const keys = [
      ...(['reading', 'current', 'unavailable', 'outOfStep'] as const).map(analysisStateKey),
      ...(['edited', 'removed', 'added'] as const).map((status) => declarationStatusKey(status)),
      ...(['front', 'after', 'end'] as const).map(moveChoiceKey),
      ...(['noTarget', 'noValues', 'emptyValue', 'carriageReturn'] as const).map(choiceProblemKey)
    ];
    expect(declarationStatusKey('file')).toBeNull();
    for (const lang of LOCALES) {
      for (const key of keys) {
        if (key === null) {
          throw new Error('only `file` draws no marker');
        }
        expect(DICTIONARIES[lang][key]).toBeTruthy();
      }
    }
  });
}); // End of the "sentences" suite

describe('review fixes — the revision boundary (Phase 4-11 review)', () => {
  it('draws no analysis while a committed write owes the rows a re-projection, even one for the new identity', () => {
    const held = session();
    const started = startReorder(held);
    const saved = applySave(started.session, committedReorder(held), { kind: 'done' }, () => started.session);
    // The snapshot for the new identity answers and matches `saved.match`…
    expect(analysisOf(saved, readFor(saved))).toEqual({ state: 'outOfStep', analysis: null });
    // …and once a fresh projection seeds a new session, it counts.
    const reseeded = startMatchEditor(projection({}, AFTER), () => 0);
    expect(analysisOf(reseeded, readFor(reseeded)).state).toBe('current');
  });

  it('binds a selection to the baseline it was made over, and drops it once that baseline is replaced', () => {
    const held = session();
    const chosen = seededSelection(held, { kind: 'variable', index: 1 });
    expect(selectionOfSeed(held, chosen)).toEqual({ kind: 'variable', index: 1 });
    // An edit keeps the baseline, so the selection holds.
    expect(selectionOfSeed(editField(held, 'replace', 'Hello x'), chosen)).toEqual({ kind: 'variable', index: 1 });
    // A re-seed of the same length does not.
    const reseeded = startMatchEditor(projection({}, AFTER), () => 0);
    expect(selectionOfSeed(reseeded, chosen)).toBeNull();
    expect(selectionOfSeed(held, NO_SELECTION)).toBeNull();
  });
}); // End of the "review fixes" suite
