/**
 * Phase 4-14-1 — the seven kind submodels for a new variable, as model values.
 *
 * What this file pins (step 4-14-1 of `docs/decisions/4-split-notes.md` §2, the
 * dated 2026-09-26 addendum under 4-14; the mounted half is suite 8 of
 * `../components/MatchEditorVariables.test.ts`):
 *
 * - each of Date, Random, Echo, Clipboard, Shell, Script and Match produces its
 *   **closed wire shape** — exactly one `NewVariableParams` variant, no
 *   `inject_vars`, `depends_on` or extra parameter — through the one save;
 * - **required-parameter readiness** mirrors Rust's `required_param`
 *   (`crates/espansoconfig-core/src/validate/mod.rs`), read from that file's
 *   own text; `date.format` is not required;
 * - **warning values**, and **unfamiliar text kept** exactly as typed;
 * - a **carriage return refused** at load, at edit and at send;
 * - each kind's insertion takes part in **undo, conflict (retained rows and
 *   reapply) and recovery** exactly as 4-11's Choice insertion does.
 *
 * **Model evidence, never a screen.** Per `1b-2a-notes.md` section 14, a
 * `describe`/`it` callback whose sibling argument is already its description
 * carries no JSDoc of its own; ordinary helpers here do.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DICTIONARIES, placeholdersOf, type TranslationKey } from '../i18n/dictionaries';
import { LOCALES } from '../i18n/locale';
import type {
  ContentRevision,
  DocumentView,
  FieldView,
  MatchDraft,
  MatchView,
  NewVariableParams,
  ReapplyResolution,
  ValueView,
  VariableView
} from '../ipc/types';
import { editDraft } from './draft';
import type { AdoptTheDiskVersion } from './editorSave';
import { field, makeConflict, makeDocument, makeMatch, makeSummary, makeVariable, scalar, scalarItem, styledScalar } from './fixtures';
import type { InvalidationStatus } from './invalidation';
import {
  applySave,
  beginSave,
  conflictOf,
  matchEditorView,
  reapplyToDiskVersion,
  startMatchEditor,
  undoEdit,
  type MatchBuffers,
  type MatchEditorSession
} from './matchEditor';
import { attemptOfReapply } from './reapply';
import { matchRecoveryAvailability } from './recovery';
import type { ConflictModel } from './saveOutcome';
import { variableStructureGrantOf, variableStructureReadOf, type VariableStructureGrant } from './variableEditor';
import { addVariable, nameContextOf, type NameContext } from './variableInsertion';
import {
  addedParamsOf,
  addKindVariable,
  editKindDraft,
  insertKindVariable,
  kindAdditionViewOf,
  kindDraftOf,
  kindEditRefusalKey,
  kindPartKey,
  kindProblemKey,
  kindProblemOf,
  kindVariableOf,
  kindWarningKey,
  kindWarningsOf,
  KIND_PARTS,
  NEW_VARIABLE_KINDS,
  newVariableKindKey,
  PARTS_OF_KIND,
  REQUIRED_PART,
  withKind,
  type KindDraft,
  type KindPart,
  type KindProblem,
  type KindWarning,
  type NewVariableKind
} from './variableKinds';

/** The revision every projection below is minted from. */
const BASE: ContentRevision = 'a'.repeat(64);

/** The revision the file holds after a write or an external change. */
const AFTER: ContentRevision = 'b'.repeat(64);

/** The adoption a save that wrote nothing owes: none. */
const NOT_OWED: InvalidationStatus = { kind: 'notOwed' };

/** One existing variable, so `vars` is a block list. */
const FIRST: VariableView = makeVariable({ node: 20, name: 'first', declaredType: 'echo', kind: 'Echo', params: [field('echo', scalarItem('one'))] });

/**
 * The snippet: trigger `:a`, body `Hello `, one variable.
 *
 * @param overrides - Whatever the case needs.
 * @param revision - The revision.
 * @returns The projection.
 */
function projection(overrides: Parameters<typeof makeMatch>[0] = {}, revision: ContentRevision = BASE): MatchView {
  return makeMatch({ revision, document: 1, node: 1, trigger: ':a', replace: 'Hello ', vars: [FIRST], ...overrides });
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
 * A clean session over the snippet.
 *
 * @param match - The projection.
 * @returns The session.
 */
function session(match: MatchView = projection()): MatchEditorSession {
  return startMatchEditor(match, () => 0);
} // End of function session()

/**
 * A structure grant over the session's own file, with no other draft open.
 *
 * @param held - The session.
 * @param drafts - Other drafts open in the file.
 * @returns The grant.
 */
function granted(held: MatchEditorSession, drafts: Parameters<typeof variableStructureReadOf>[2] = []): VariableStructureGrant {
  return variableStructureGrantOf(held.match, variableStructureReadOf([file([projection()])], 1, drafts));
} // End of function granted()

/**
 * The names a form is checked against: the file's, with no analysis at hand.
 *
 * @param held - The session.
 * @returns The context.
 */
function namesOf(held: MatchEditorSession): NameContext {
  return nameContextOf(held, null, file([projection()]));
} // End of function namesOf()

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
 * A form of one kind with the given parts typed into it, through the model's
 * own edit — so each text passes the edit gate a box's does.
 *
 * @param kind - The kind.
 * @param parts - The texts, by part.
 * @param context - The names the form opens over.
 * @returns The form.
 */
function formOf(kind: NewVariableKind, parts: Partial<Record<KindPart, string>>, context: NameContext): KindDraft {
  let draft = kindDraftOf(kind, context);
  for (const [part, text] of Object.entries(parts) as [KindPart, string][]) {
    const edit = editKindDraft(draft, part, text);
    if (edit.kind !== 'edited') {
      throw new Error(`this case needs ${part} taken`);
    }
    draft = edit.draft;
  } // End of the loop over the typed parts
  return draft;
} // End of function formOf()

/**
 * A logical string on disk, written double-quoted so a reapply takes it as the
 * string Rust's codec wrote (a plain spelling counts only when it cannot be
 * anything but a string).
 *
 * @param text - The text.
 * @returns The projected value.
 */
function quoted(text: string): ValueView {
  return { Scalar: styledScalar(text, 'DoubleQuoted') };
} // End of function quoted()

/**
 * A plain-source setting on disk, written plain.
 *
 * @param text - The source text.
 * @returns The projected value.
 */
function plainValue(text: string): ValueView {
  return { Scalar: scalar(text) };
} // End of function plainValue()

/** One kind's case: what is typed, what is sent, and what the disk holds once written. */
interface KindCase {
  /** The kind. */
  readonly kind: NewVariableKind;
  /** The provisional name the form proposes. */
  readonly name: string;
  /** What is typed into its boxes. */
  readonly parts: Partial<Record<KindPart, string>>;
  /** The closed shape sent. */
  readonly params: NewVariableParams;
  /** The `params` keys the retained draft names, in order. */
  readonly keys: readonly string[];
  /** What the disk's `params` hold once Rust wrote it. */
  readonly disk: readonly FieldView[];
}

/** The seven kinds, each with every part it owns typed. */
const CASES: readonly KindCase[] = [
  {
    kind: 'date',
    name: 'date',
    parts: { format: '%Y-%m-%d', offset: '86400', tz: 'Europe/Madrid', locale: 'es-ES' },
    params: { Date: { format: '%Y-%m-%d', offset: '86400', tz: 'Europe/Madrid', locale: 'es-ES' } },
    keys: ['format', 'offset', 'tz', 'locale'],
    disk: [field('format', quoted('%Y-%m-%d')), field('offset', plainValue('86400')), field('tz', quoted('Europe/Madrid')), field('locale', quoted('es-ES'))]
  },
  {
    kind: 'random',
    name: 'random',
    parts: { choices: 'one\ntwo\n' },
    params: { Random: { choices: ['one', 'two'] } },
    keys: ['choices'],
    disk: [field('choices', { Sequence: [quoted('one'), quoted('two')] })]
  },
  {
    kind: 'echo',
    name: 'echo',
    parts: { echo: 'hello\nworld' },
    params: { Echo: { echo: 'hello\nworld' } },
    keys: ['echo'],
    disk: [field('echo', quoted('hello\nworld'))]
  },
  {
    kind: 'clipboard',
    name: 'clipboard',
    parts: {},
    params: { Clipboard: {} },
    keys: [],
    disk: []
  },
  {
    kind: 'shell',
    name: 'shell',
    parts: { cmd: 'date +%s\necho done', shell: 'bash', trim: 'true', debug: 'false' },
    params: { Shell: { cmd: 'date +%s\necho done', shell: 'bash', trim: 'true', debug: 'false' } },
    keys: ['cmd', 'shell', 'trim', 'debug'],
    disk: [field('cmd', quoted('date +%s\necho done')), field('shell', quoted('bash')), field('trim', plainValue('true')), field('debug', plainValue('false'))]
  },
  {
    kind: 'script',
    name: 'script',
    parts: { args: 'python3\n%CONFIG%/scripts/x.py', trim: 'false' },
    params: { Script: { args: ['python3', '%CONFIG%/scripts/x.py'], trim: 'false' } },
    keys: ['args', 'trim'],
    disk: [field('args', { Sequence: [quoted('python3'), quoted('%CONFIG%/scripts/x.py')] }), field('trim', plainValue('false'))]
  },
  {
    kind: 'match',
    name: 'match',
    parts: { trigger: ':sig' },
    params: { Match: { trigger: ':sig' } },
    keys: ['trigger'],
    disk: [field('trigger', quoted(':sig'))]
  }
];

/**
 * Adds one case's variable to a clean session, insisting it is drafted.
 *
 * @param one - The case.
 * @returns The clean session and the one holding the addition.
 */
function added(one: KindCase): { readonly held: MatchEditorSession; readonly after: MatchEditorSession } {
  const held = session();
  const context = namesOf(held);
  const outcome = addKindVariable(held, granted(held), context, formOf(one.kind, one.parts, context));
  if (outcome.kind !== 'inserted') {
    throw new Error(`this case needs the ${one.kind} variable drafted`);
  }
  return { held, after: outcome.session };
} // End of function added()

/**
 * The disk variable Rust writes for one case, at the end of `vars`.
 *
 * @param one - The case.
 * @returns The projected variable.
 */
function writtenVariable(one: KindCase): VariableView {
  return {
    ...makeVariable({ node: 40, name: one.name, declaredType: one.kind, kind: 'Echo', params: one.disk }),
    name: styledScalar(one.name, 'DoubleQuoted'),
    declared_type: styledScalar(one.kind, 'DoubleQuoted')
  };
} // End of function writtenVariable()

describe('each kind produces its closed shape through the one save', () => {
  it.each(CASES)('$kind: one InsertVariable holding exactly its variant', (one) => {
    const { after } = added(one);
    expect(after.draft.past).toHaveLength(1);
    expect(sent(after).var_intents).toEqual([
      {
        InsertVariable: {
          at: { End: {} },
          variable: { name: one.name, params: one.params, inject_vars: null, depends_on: null, extra_params: [] }
        }
      }
    ]);
    // Nothing else of the snippet is drafted.
    expect(sent(after).replace).toBe('Unchanged');
    expect(sent(after).vars).toEqual([]);
    // The panel of the selected addition lists exactly the keys it writes.
    expect(addedParamsOf(one.params).map((param) => param.key)).toEqual(one.keys);
  });

  it('proposes each kind’s own provisional name, numbered past a taken one', () => {
    const held = session();
    const context = namesOf(held);
    expect(NEW_VARIABLE_KINDS.map((kind) => kindDraftOf(kind, context).name)).toEqual(NEW_VARIABLE_KINDS);
    const taken = nameContextOf(held, null, file([projection({ vars: [FIRST, makeVariable({ node: 21, name: 'shell', declaredType: 'echo' })] })]));
    expect(kindDraftOf('shell', { ...taken, locals: [...taken.locals, 'shell'] }).name).toBe('shell2');
  });

  it('sends only the chosen kind’s own parts, keeps every typed text across a change of kind, and re-proposes an untouched name', () => {
    const held = session();
    const context = namesOf(held);
    const shell = formOf('shell', { cmd: 'ls', trim: 'true' }, context);
    const script = withKind(shell, 'script', context);
    expect(script.name).toBe('script');
    expect(script.parts.cmd).toBe('ls');
    expect(kindVariableOf(editKindDraft(script, 'args', 'python3').draft)).toEqual({
      variable: { name: 'script', params: { Script: { args: ['python3'], trim: 'true' } }, inject_vars: null, depends_on: null, extra_params: [] }
    });
    // A name a person typed survives the change.
    const renamed = editKindDraft(shell, 'name', 'mine').draft;
    expect(withKind(renamed, 'date', context).name).toBe('mine');
    // Back to shell: the command is still there.
    expect(withKind(script, 'shell', context).parts.cmd).toBe('ls');
  });

  it('writes a blank optional part not at all, never as an empty value', () => {
    const held = session();
    const context = namesOf(held);
    expect(kindVariableOf(kindDraftOf('date', context))).toEqual({
      variable: { name: 'date', params: { Date: { format: null, offset: null, tz: null, locale: null } }, inject_vars: null, depends_on: null, extra_params: [] }
    });
    expect(kindVariableOf(formOf('shell', { cmd: 'ls' }, context))).toMatchObject({
      variable: { params: { Shell: { cmd: 'ls', shell: null, trim: null, debug: null } } }
    });
    expect(kindVariableOf(formOf('script', { args: 'a' }, context))).toMatchObject({
      variable: { params: { Script: { args: ['a'], trim: null } } }
    });
  });
}); // End of the closed-shape suite

/**
 * Rust's `required_param` table, read from its own source: each `VariableKind`
 * arm returning `Some("…")`, lower-cased, and the kinds returning `None`.
 *
 * @returns The required parameter by kind word.
 */
function rustRequiredParams(): ReadonlyMap<string, string | null> {
  const source = readFileSync(new URL('../../../crates/espansoconfig-core/src/validate/mod.rs', import.meta.url), 'utf8');
  const start = source.indexOf('pub fn required_param');
  const body = source.slice(start, source.indexOf('} // End of function required_param()', start));
  const table = new Map<string, string | null>();
  for (const arm of body.matchAll(/VariableKind::(\w+) => Some\("(\w+)"\)/g)) {
    table.set((arm[1] as string).toLowerCase(), arm[2] as string);
  } // End of the loop over the arms that require something
  const none = /((?:\|?\s*VariableKind::\w+\s*)+)=> None/.exec(body);
  for (const kind of none?.[1]?.matchAll(/VariableKind::(\w+)/g) ?? []) {
    table.set((kind[1] as string).toLowerCase(), null);
  } // End of the loop over the kinds that require nothing
  return table;
} // End of function rustRequiredParams()

describe('required-parameter readiness mirrors Rust’s required_param', () => {
  it('names the same required part as validate/mod.rs for each of the seven kinds, and none for date', () => {
    const rust = rustRequiredParams();
    expect(rust.get('date')).toBeNull();
    expect(rust.get('clipboard')).toBeNull();
    for (const kind of NEW_VARIABLE_KINDS) {
      expect(rust.has(kind)).toBe(true);
      expect(REQUIRED_PART[kind]).toBe(rust.get(kind) ?? null);
    } // End of the loop over the kinds
    // `random` requires `choices`, which is its own list part.
    expect(PARTS_OF_KIND.random).toContain('choices');
  });

  it.each(CASES)('$kind: ready only once its required part is given', (one) => {
    const held = session();
    const context = namesOf(held);
    const blank = kindDraftOf(one.kind, context);
    const required = REQUIRED_PART[one.kind];
    const view = kindAdditionViewOf(held, context, granted(held), blank);
    if (required === null) {
      expect(view.problem).toBeNull();
      expect(view.canAdd).toBe(true);
    } else {
      expect(view.problem).toEqual({ kind: 'required', part: required });
      expect(view.canAdd).toBe(false);
      expect(view.parts.find((part) => part.part === required)?.required).toBe(true);
      expect(addKindVariable(held, granted(held), context, blank)).toMatchObject({ kind: 'problem', problem: { kind: 'required', part: required } });
    }
    const full = formOf(one.kind, one.parts, context);
    expect(kindAdditionViewOf(held, context, granted(held), full)).toMatchObject({ problem: null, canAdd: true });
  });

  it('refuses an empty line between two list items by name, and never drops it', () => {
    const held = session();
    const context = namesOf(held);
    expect(kindProblemOf(formOf('random', { choices: 'a\n\nb' }, context))).toEqual({ kind: 'emptyItem', part: 'choices' });
    expect(kindProblemOf(formOf('script', { args: 'a\n\nb' }, context))).toEqual({ kind: 'emptyItem', part: 'args' });
    // A space is an item: kept as typed.
    expect(kindVariableOf(formOf('random', { choices: ' \nb' }, context))).toMatchObject({
      variable: { params: { Random: { choices: [' ', 'b'] } } }
    });
  });

  it('withholds Add over a stale draft in the file and over a pending addition, whatever the form holds', () => {
    const held = session();
    const context = namesOf(held);
    const form = formOf('match', { trigger: ':x' }, context);
    const stale = granted(held, [{ document: 1, revision: 'c'.repeat(64), node: 9 }]);
    expect(kindAdditionViewOf(held, context, stale, form)).toMatchObject({
      withheld: { kind: 'structure', reason: 'staleDraftInDocument' },
      canAdd: false
    });
    expect(addKindVariable(held, stale, context, form)).toMatchObject({ kind: 'refused', refusal: { kind: 'structure', reason: 'staleDraftInDocument' } });
    const { after } = added(CASES[0] as KindCase);
    expect(kindAdditionViewOf(after, context, granted(after), form)).toMatchObject({
      withheld: { kind: 'addition', reason: 'additionPending' },
      canAdd: false
    });
  });

  it('says which kinds espanso runs a command or reads the clipboard for', () => {
    const held = session();
    const context = namesOf(held);
    const said = NEW_VARIABLE_KINDS.map((kind) => {
      const view = kindAdditionViewOf(held, context, granted(held), kindDraftOf(kind, context));
      return [kind, view.executes, view.readsClipboard];
    });
    expect(said).toEqual([
      ['echo', false, false],
      ['date', false, false],
      ['random', false, false],
      ['clipboard', false, true],
      ['shell', true, false],
      ['script', true, false],
      ['match', false, false]
    ]);
  });
}); // End of the readiness suite

describe('warning values, and unfamiliar text kept exactly as typed', () => {
  it('warns about an unusual text without refusing it, and sends it verbatim', () => {
    const held = session();
    const context = namesOf(held);
    const date = formOf('date', { format: 'today', offset: '1d', tz: ' Mars/Olympus', locale: 'xx' }, context);
    expect(kindWarningsOf(date)).toEqual([
      { code: 'formatWithoutSpecifier', part: 'format' },
      { code: 'offsetNotAnInteger', part: 'offset' },
      { code: 'surroundingSpace', part: 'tz' }
    ]);
    const shell = formOf('shell', { cmd: 'ls', shell: 'fish', trim: 'yes', debug: 'on ' }, context);
    expect(kindWarningsOf(shell)).toEqual([
      { code: 'unfamiliarShell', part: 'shell' },
      { code: 'notTrueOrFalse', part: 'trim' },
      { code: 'notTrueOrFalse', part: 'debug' },
      { code: 'surroundingSpace', part: 'debug' }
    ]);
    const view = kindAdditionViewOf(held, context, granted(held), shell);
    expect(view.canAdd).toBe(true);
    expect(view.parts.map((part) => [part.part, part.plainSource])).toEqual([
      ['cmd', false],
      ['shell', false],
      ['trim', true],
      ['debug', true]
    ]);
    const outcome = addKindVariable(held, granted(held), context, shell);
    if (outcome.kind !== 'inserted') {
      throw new Error('this case needs the shell variable drafted');
    }
    expect(sent(outcome.session).var_intents).toEqual([
      {
        InsertVariable: {
          at: { End: {} },
          variable: { name: 'shell', params: { Shell: { cmd: 'ls', shell: 'fish', trim: 'yes', debug: 'on ' } }, inject_vars: null, depends_on: null, extra_params: [] }
        }
      }
    ]);
    // The date's odd texts are sent as typed too, the leading space included.
    expect(kindVariableOf(date)).toMatchObject({
      variable: { params: { Date: { format: 'today', offset: '1d', tz: ' Mars/Olympus', locale: 'xx' } } }
    });
  });

  it('earns no warning for a text it recognises, nor for a blank optional part', () => {
    const held = session();
    const context = namesOf(held);
    for (const one of CASES) {
      expect(kindWarningsOf(formOf(one.kind, one.parts, context))).toEqual([]);
    } // End of the loop over the cases
    expect(kindWarningsOf(kindDraftOf('date', context))).toEqual([]);
    expect(kindWarningsOf(formOf('date', { offset: '-3600' }, context))).toEqual([]);
  });

  it('warns only about the chosen kind’s own parts', () => {
    const held = session();
    const context = namesOf(held);
    const shell = formOf('shell', { cmd: 'ls', shell: 'fish' }, context);
    expect(kindWarningsOf(withKind(shell, 'echo', context))).toEqual([]);
  });
}); // End of the warnings suite

describe('a carriage return is refused at load, at edit and at send', () => {
  it('opens every form holding no text, and a change of kind brings none in', () => {
    const held = session();
    const context = namesOf(held);
    for (const kind of NEW_VARIABLE_KINDS) {
      const draft = kindDraftOf(kind, context);
      expect(KIND_PARTS.every((part) => draft.parts[part] === '')).toBe(true);
      expect(kindProblemOf(draft)?.kind ?? null).not.toBe('carriageReturn');
    } // End of the loop over the kinds
  });

  it('refuses one at edit in every box, and a line feed in a one-line box, leaving the form as it was', () => {
    const held = session();
    const context = namesOf(held);
    const draft = kindDraftOf('date', context);
    for (const part of [...KIND_PARTS, 'name'] as const) {
      expect(editKindDraft(draft, part, 'a\rb')).toEqual({ kind: 'refused', draft, reason: 'carriageReturn' });
    } // End of the loop over the boxes
    for (const part of ['name', 'format', 'offset', 'tz', 'locale', 'shell', 'trim', 'debug', 'trigger'] as const) {
      expect(editKindDraft(draft, part, 'a\nb')).toEqual({ kind: 'refused', draft, reason: 'lineBreak' });
    } // End of the loop over the one-line boxes
    for (const part of ['echo', 'cmd', 'choices', 'args'] as const) {
      expect(editKindDraft(draft, part, 'a\nb').kind).toBe('edited');
    } // End of the loop over the multi-line boxes
  });

  it.each(CASES)('$kind: refuses a forged form at the press, a forged description at addVariable, and a forged buffer at beginSave', (one) => {
    const held = session();
    const context = namesOf(held);
    const form = formOf(one.kind, one.parts, context);
    const forgedName: KindDraft = { ...form, name: `${one.name}\r` };
    expect(addKindVariable(held, granted(held), context, forgedName)).toMatchObject({
      kind: 'problem',
      problem: { kind: 'carriageReturn', part: 'name' }
    });
    const part = PARTS_OF_KIND[one.kind][0];
    if (part !== undefined) {
      const forged: KindDraft = { ...form, parts: { ...form.parts, [part]: `${form.parts[part]}\r` } };
      expect(kindAdditionViewOf(held, context, granted(held), forged)).toMatchObject({
        problem: { kind: 'carriageReturn', part },
        canAdd: false
      });
      expect(insertKindVariable(held, granted(held), context, forged, 'replace', { start: 0, end: 0 })).toMatchObject({ kind: 'problem' });
    }
    // A description built by hand reaches `addVariable`, which refuses it: the
    // first text value of the kind's own parameters gains a `\r`; a kind with
    // none (clipboard) gets it in the name instead, which the name check refuses.
    const described = kindVariableOf(form);
    if (!('variable' in described)) {
      throw new Error('this case needs the description');
    }
    const params = JSON.stringify(described.variable.params);
    const taintedParams = params.replace(/"((?:[^"\\]|\\.)*)"(?=[,\]}])/, '"$1\\r"');
    const tainted =
      taintedParams === params
        ? { ...described.variable, name: 'a\rb' }
        : { ...described.variable, params: JSON.parse(taintedParams) as NewVariableParams };
    expect(JSON.stringify(tainted)).toContain('\\r');
    expect(addVariable(held, granted(held), context, tainted)).toMatchObject({
      kind: 'refused',
      refusal: { kind: taintedParams === params ? 'name' : 'unreadableText' }
    });
    // `MatchBuffers` carries no brand: a hand-built buffer reaches `beginSave`,
    // which refuses to send it.
    const forgedBuffer: MatchEditorSession = {
      ...held,
      draft: editDraft(held.draft, {
        ...held.draft.value,
        variables: { ...held.draft.value.variables, added: [{ variable: tainted, insertedInto: null }] }
      })
    };
    expect(beginSave(forgedBuffer, () => forgedBuffer)).toBeNull();
  });
}); // End of the carriage-return suite

describe('each kind’s insertion takes part in undo, conflict and recovery', () => {
  it.each(CASES)('$kind: one undo takes the addition back', (one) => {
    const { held, after } = added(one);
    expect(undoEdit(after).draft.value).toEqual(held.draft.value);
  });

  it.each(CASES)('$kind: an Insert drafts the reference and the variable as one step, and one undo takes both back', (one) => {
    const held = session();
    const context = namesOf(held);
    const outcome = insertKindVariable(held, granted(held), context, formOf(one.kind, one.parts, context), 'replace', { start: 6, end: 6 });
    if (outcome.kind !== 'inserted') {
      throw new Error('this case needs the insertion');
    }
    expect(outcome.session.draft.past).toHaveLength(1);
    expect(sent(outcome.session).replace).toEqual({ Set: `Hello {{${one.name}}}` });
    expect(sent(outcome.session).var_intents).toHaveLength(1);
    expect(undoEdit(outcome.session).draft.value).toEqual(held.draft.value);
  });

  it('refuses an Insert into a content key the snippet does not hold', () => {
    const held = session();
    const context = namesOf(held);
    expect(insertKindVariable(held, granted(held), context, formOf('match', { trigger: ':x' }, context), 'html', { start: 0, end: 0 })).toEqual({
      kind: 'problem',
      session: held,
      problem: { kind: 'noTarget' }
    });
  });

  it.each(CASES)('$kind: a save conflict retains the name, the type and every parameter, row by row, and the draft is read-only', (one) => {
    const { after } = added(one);
    const stuck = saveConflicted(after);
    const view = matchEditorView(stuck);
    expect(view.editable).toBe(false);
    const rows = view.retainedDraft.filter((row) => row.status === 'variableAdded' || row.status === 'parameterName' || row.status === 'parameterValue');
    expect(rows.slice(0, 2)).toEqual([
      { label: 'variableName', text: one.name, status: 'variableAdded' },
      { label: 'type', text: one.kind, status: 'variableAdded' }
    ]);
    expect(rows.filter((row) => row.status === 'parameterName').map((row) => row.text)).toEqual(one.keys);
    const values = addedParamsOf(one.params).flatMap((param) => param.texts);
    expect(rows.filter((row) => row.status === 'parameterValue').map((row) => row.text)).toEqual(values);
  });

  it.each(CASES)('$kind: reapplies over an unchanged container, and is already satisfied by the variable Rust wrote', (one) => {
    const { after } = added(one);
    const same = reapplyOnto(after, projection({ label: 'elsewhere' }, AFTER));
    if (same.kind !== 'reapplied') {
      throw new Error(`this case needs the reapply, got ${same.kind}`);
    }
    expect(sent(same.session).var_intents).toEqual(sent(after).var_intents);
    const written = reapplyOnto(after, projection({ vars: [FIRST, writtenVariable(one)] }, AFTER));
    expect(written.kind).toBe('alreadySatisfied');
    // A changed parameter on disk is not the intended result: the container collides.
    if (one.disk.length > 0) {
      const changed = { ...writtenVariable(one), params: [field(one.keys[0] as string, quoted('other'))] };
      expect(reapplyOnto(after, projection({ vars: [FIRST, changed] }, AFTER))).toMatchObject({ kind: 'manualResolution' });
    }
  });

  it.each(CASES)('$kind: recovery refuses to recreate the snippet as new (ruling 21)', (one) => {
    const { after } = added(one);
    const stuck = saveConflicted(after);
    const adopt: AdoptTheDiskVersion<MatchBuffers> = (_conflict: ConflictModel<MatchBuffers>) => 'installed';
    const attempt = attemptOfReapply(stuck, reapplyToDiskVersion(stuck, adopt, null, () => stuck));
    const summary = makeSummary({ id: 1, relativePath: 'match/base.yml' });
    expect(matchRecoveryAvailability(attempt.outcome, conflictOf(stuck), stuck.baseline, [summary], [file([], AFTER)])).toEqual({
      kind: 'unavailable',
      reason: 'variablesNotCarried'
    });
  });
}); // End of the lifecycle suite

describe('every new code has a sentence in both languages', () => {
  it('maps each code to a key both dictionaries hold, with the part as its placeholder', () => {
    const problems: readonly KindProblem[] = [
      { kind: 'required', part: 'cmd' },
      { kind: 'emptyItem', part: 'args' },
      { kind: 'carriageReturn', part: 'name' },
      { kind: 'lineBreak', part: 'tz' },
      { kind: 'noTarget' }
    ];
    const warnings: readonly KindWarning[] = [
      { code: 'offsetNotAnInteger', part: 'offset' },
      { code: 'notTrueOrFalse', part: 'trim' },
      { code: 'unfamiliarShell', part: 'shell' },
      { code: 'formatWithoutSpecifier', part: 'format' },
      { code: 'surroundingSpace', part: 'tz' }
    ];
    const withPart: TranslationKey[] = [
      ...problems.filter((one) => one.kind !== 'noTarget').map(kindProblemKey),
      ...warnings.map(kindWarningKey),
      kindEditRefusalKey('carriageReturn'),
      kindEditRefusalKey('lineBreak')
    ];
    const keys: TranslationKey[] = [
      ...NEW_VARIABLE_KINDS.map(newVariableKindKey),
      ...KIND_PARTS.map(kindPartKey),
      kindProblemKey({ kind: 'noTarget' }),
      ...withPart
    ];
    expect(new Set([...NEW_VARIABLE_KINDS.map(newVariableKindKey), ...KIND_PARTS.map(kindPartKey)]).size).toBe(
      NEW_VARIABLE_KINDS.length + KIND_PARTS.length
    );
    for (const key of keys) {
      for (const locale of LOCALES) {
        expect(DICTIONARIES[locale][key]).toBeTruthy();
      } // End of the loop over the locales
    } // End of the loop over the keys
    for (const key of withPart) {
      for (const locale of LOCALES) {
        expect(placeholdersOf(DICTIONARIES[locale][key])).toContain('part');
      } // End of the loop over the locales
    } // End of the loop over the keys that name a part
  });
}); // End of the sentences suite

/**
 * A form whose part is a getter answering `first` on its first read and `later`
 * on every read after — the check-and-spend probe of `CLAUDE.md` §6.
 *
 * @param kind - The kind.
 * @param part - The getter-backed part.
 * @param first - What the first read answers.
 * @param later - What every later read answers.
 * @param context - The names the form opens over.
 * @returns The form and a counter of the part's reads.
 */
function shiftingForm(
  kind: NewVariableKind,
  part: KindPart,
  first: string,
  later: string,
  context: NameContext
): { readonly draft: KindDraft; readonly reads: () => number } {
  const base = kindDraftOf(kind, context);
  let reads = 0;
  const parts = { ...base.parts };
  Object.defineProperty(parts, part, {
    enumerable: true,
    get: () => {
      reads += 1;
      return reads === 1 ? first : later;
    }
  });
  return { draft: { ...base, parts }, reads: () => reads };
} // End of function shiftingForm()

describe('review fix — one snapshot of the form is validated and spent (the 4-14-1 review, finding 1)', () => {
  it.each([
    ['random', 'choices', 'valid', 'bad\rvalue'],
    ['script', 'args', 'valid', 'bad\rvalue'],
    ['echo', 'echo', 'valid', 'bad\rvalue']
  ] as const)('%s: a %s getter that changes after the check cannot reach the description', (kind, part, first, later) => {
    const held = session();
    const context = namesOf(held);
    const probe = shiftingForm(kind, part, first, later, context);
    const described = kindVariableOf(probe.draft);
    expect(JSON.stringify(described)).not.toContain('\\r');
    expect(described).toMatchObject({ variable: { name: kind } });
    expect(JSON.stringify(described)).toContain('valid');
    expect(probe.reads()).toBe(1);
    const outcome = addKindVariable(held, granted(held), context, shiftingForm(kind, part, first, later, context).draft);
    if (outcome.kind !== 'inserted') {
      throw new Error('this case needs the validated snapshot drafted');
    }
    expect(JSON.stringify(sent(outcome.session).var_intents)).not.toContain('\\r');
    expect(JSON.stringify(sent(outcome.session).var_intents)).toContain('valid');
  });
}); // End of the review-fix suite
