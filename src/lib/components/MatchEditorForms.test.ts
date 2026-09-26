/** @vitest-environment jsdom */

/**
 * Phase 4-12 — the visual form builder inside the small editor, mounted and
 * driven through real DOM events.
 *
 * Opts into jsdom by the docblock above and by nothing else, as every mounted
 * suite here does. One `describe` per acceptance clause of step 4-12
 * (`docs/decisions/4-split-notes.md` §2), plus the Choice/List controls the step
 * delivers:
 *
 * 1. both storage shapes;
 * 2. layout-only edits;
 * 3. explicit compound additions (Add field, defining a placeholder, the Form
 *    insertion);
 * 4. definition-only rows;
 * 5. unknown source visible through `SourceText`;
 * 6. `multiline`, defaults and trimming as textual controls;
 * 7. first-class Choice/List controls, option removal and removal of every field;
 * 8. conflict compare;
 * 9. the recovery refusal.
 *
 * **Mounted evidence, never a screen** (Phase 4 ruling 29): what this proves is
 * which elements jsdom holds after the handlers ran and what reached the
 * injected ports — nothing about layout, wrapping or WebKit's normalisation. The
 * window half is owed to step 4-13.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveConflictSource, type ConflictSource } from '../browser/conflictSource';
import {
  field,
  fixtureFieldShape,
  fixtureMappingPresence,
  makeConflict,
  makeDocument,
  makeMatch,
  makeSummary,
  makeVariable,
  scalarItem,
  scriptedAcknowledgement
} from '../browser/fixtures';
import type { CreationBuffers } from '../browser/matchCreation';
import type { MatchBuffers } from '../browser/matchEditor';
import type { ConflictModel, DiskAdoptionOutcome } from '../browser/saveOutcome';
import type { SurfaceBinding } from '../browser/surfaceReceivers';
import { variableStructureReadOf } from '../browser/variableEditor';
import type { VariableGroupPort } from '../browser/variableGroup';
import type { MatchSaveAnswer } from '../browser/workspace.svelte';
import { DICTIONARIES, translate, type TranslationKey, type TranslationParams } from '../i18n/dictionaries';
import type { Locale } from '../i18n/locale';
import type { CommandResult } from '../ipc/commands';
import type {
  Acknowledgement,
  AnalysisSummary,
  AuthoringSnapshot,
  ContentRevision,
  DocumentId,
  DocumentSummary,
  DocumentView,
  FieldView,
  ListPlacement,
  MatchDraft,
  MatchId,
  MatchView,
  SaveResult,
  ValueView,
  VariableView
} from '../ipc/types';
import { locale } from '../stores/locale.svelte';
import MatchEditor from './MatchEditor.svelte';

/**
 * Every call that reaches `@tauri-apps/api/core`'s `invoke`: none should, since
 * every port is scripted, and the file-level `afterEach` fails a case that made
 * one.
 */
const { invoked } = vi.hoisted(() => ({ invoked: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: readonly unknown[]): Promise<never> => {
    invoked(...args);
    return Promise.reject(new Error('this suite invokes no command'));
  }
}));

/** The revision every projection below is minted from. */
const BASE: ContentRevision = 'a'.repeat(64);

/** The revision the file holds after a write or an external change. */
const AFTER: ContentRevision = 'b'.repeat(64);

/** The file the snippet lives in. */
const FILE = makeSummary({ id: 1, relativePath: 'match/base.yml' });

beforeEach(() => {
  locale.setOverride('en');
});

afterEach(() => {
  locale.setOverride(null);
  const calls = invoked.mock.calls.length;
  invoked.mockClear();
  expect(calls).toBe(0);
});

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
 * A scalar list value.
 *
 * @param items - The items' texts.
 * @returns The projected value.
 */
function listOf(items: readonly string[]): ValueView {
  return { Sequence: items.map(scalarItem) };
} // End of function listOf()

/**
 * The shorthand form's definitions: `pick` (a choice with three values and an
 * option this editor does not draft), `lines` (a list whose values are one
 * text) and `solo` (a definition the layout does not use).
 */
const FIELDS: readonly FieldView[] = [
  field('pick', optionsOf([['type', scalarItem('choice')], ['values', listOf(['a', 'b', 'c'])], ['hint', scalarItem('kept as written')]])),
  field('lines', optionsOf([['type', scalarItem('list')], ['values', scalarItem('one\ntwo')]])),
  field('solo', optionsOf([['multiline', scalarItem('true')], ['default', scalarItem('d')]]))
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
function projection(overrides: Parameters<typeof makeMatch>[0] = {}, revision: ContentRevision = BASE): MatchView {
  return makeMatch({ revision, document: 1, node: 1, trigger: ':f', form: LAYOUT, contentKind: 'Form', formFields: FIELDS, ...overrides });
} // End of function projection()

/**
 * A `type: form` variable `f` holding `x` under `layout`.
 *
 * @param layout - Its layout.
 * @returns The variable.
 */
function formVariable(layout: string): VariableView {
  const definitions = [field('x', optionsOf([['type', scalarItem('list')], ['values', listOf(['m', 'n'])]]))];
  return {
    ...makeVariable({
      node: 20,
      name: 'f',
      declaredType: 'form',
      kind: 'Form',
      params: [field('layout', scalarItem(layout)), field('fields', { Mapping: definitions })]
    }),
    fields_presence: fixtureMappingPresence(definitions),
    field_shapes: definitions.map(fixtureFieldShape)
  };
} // End of function formVariable()

/**
 * A snippet whose form is a verbose one, referenced from its replacement text.
 *
 * @param layout - The form's layout.
 * @returns The projection.
 */
function verbose(layout = 'X: [[x]]'): MatchView {
  return makeMatch({ revision: BASE, document: 1, node: 1, trigger: ':v', replace: 'Hi {{f.x}}', vars: [formVariable(layout)] });
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
 * The file as the window holds it.
 *
 * @param matches - Its snippets.
 * @param revision - Its revision.
 * @returns The projection of the file.
 */
function fileOf(matches: readonly MatchView[], revision: ContentRevision = BASE): DocumentView {
  return makeDocument({ id: 1, relativePath: 'match/base.yml', revision, matches });
} // End of function fileOf()

/**
 * An analysis whose scope is open or closed, holding no reason and no edge.
 *
 * @param scopeClosed - Whether the set of visible names is closed.
 * @returns The analysis.
 */
function analysis(scopeClosed: boolean): AnalysisSummary {
  return {
    declarations: [],
    edges: [],
    cycles: [],
    missing_dependencies: [],
    order_advisories: [],
    form_advisories: [],
    incomplete: scopeClosed ? [] : [{ ImportsOpenScope: {} }],
    scope_closed: scopeClosed,
    captures: [],
    shorthand_form: null,
    unverified_layout_references: []
  };
} // End of function analysis()

/** One recorded reorder. */
interface RecordedMove {
  readonly id: MatchId;
  readonly variable: number;
  readonly to: ListPlacement;
  readonly baseRevision: ContentRevision;
  readonly acknowledgement: Acknowledgement;
}

/** What a case can script. */
interface Script {
  /** The snippet the editor opens over. */
  readonly match?: MatchView;
  /** What the snapshot read answers; never answers when absent. */
  readonly snapshot?: (id: MatchId) => CommandResult<AuthoringSnapshot>;
  /** What each save answers, in order; a save with none left never answers. */
  readonly saves?: readonly SaveResult[];
  /** What each reorder answers, in order; one with none left never answers. */
  readonly moves?: readonly SaveResult[];
  /** Other match drafts open beside the editor (R36). */
  readonly drafts?: readonly MatchId[];
  /**
   * The fresh projection `reproject` answers after a commit (review fix, Phase
   * 4-11); the window has moved elsewhere when absent.
   */
  readonly fresh?: MatchView;
}

/** A mounted editor and what a case reads back. */
interface Mounted {
  /** The element the component was mounted into. */
  readonly target: HTMLElement;
  /** Every draft the save port was handed, in order. */
  readonly saves: MatchDraft[];
  /** Every reorder the variables port was handed, in order. */
  readonly moves: RecordedMove[];
  /** Tears the component down. */
  readonly stop: () => void;
}

/**
 * A binding whose two methods do nothing: this suite registers no receiver.
 *
 * @returns The binding.
 */
function inertBinding(): SurfaceBinding {
  return { reportTarget: () => undefined, withdraw: () => undefined };
} // End of function inertBinding()

/**
 * One scripted save answer, as the window's wrapper would hand it back.
 *
 * @param result - The result, or `undefined` for one that never answers.
 * @returns The answer's promise.
 */
function answered(result: SaveResult | undefined): Promise<MatchSaveAnswer> {
  if (result === undefined) {
    return new Promise<MatchSaveAnswer>(() => undefined);
  }
  return Promise.resolve({
    kind: 'answered',
    result,
    adoption: result.outcome === 'saved' && result.committed ? { kind: 'done' } : { kind: 'notOwed' }
  });
} // End of function answered()

/**
 * Mounts the editor over scripted ports.
 *
 * @param script - What the case scripts.
 * @returns The mounted editor.
 */
function mountEditor(script: Script = {}): Mounted {
  const match = script.match ?? projection();
  const views: readonly DocumentView[] = [fileOf([match]), makeDocument({ id: 2, relativePath: 'match/other.yml', revision: BASE })];
  const saves: MatchDraft[] = [];
  const moves: RecordedMove[] = [];
  const remainingSaves = [...(script.saves ?? [])];
  const remainingMoves = [...(script.moves ?? [])];
  const standing = new Map<DocumentId, ConflictSource>();
  /**
   * Records the origin the window would hold after one answer, so the reapply's
   * live guard sees the conflict it was raised by.
   *
   * @param document - The file.
   * @param result - The answer.
   */
  const note = (document: DocumentId, result: SaveResult | undefined): void => {
    if (result?.outcome === 'conflict') {
      standing.set(document, saveConflictSource(result));
    }
  };
  const variables: VariableGroupPort = {
    snapshot: (id) =>
      script.snapshot === undefined ? new Promise(() => undefined) : Promise.resolve(script.snapshot(id)),
    structureRead: (document) => variableStructureReadOf(views, document, script.drafts ?? []),
    moveVariable: (id, variable, to, baseRevision, acknowledgement) => {
      moves.push({ id, variable, to, baseRevision, acknowledgement });
      const next = remainingMoves.shift();
      note(id.document, next);
      return answered(next);
    }
  };
  const target = document.createElement('div');
  document.body.append(target);
  const component = mount(MatchEditor, {
    target,
    props: {
      acknowledgement: scriptedAcknowledgement().port,
      match,
      file: FILE,
      documents: (): readonly DocumentSummary[] =>
        views.map((view) => makeSummary({ id: view.id, relativePath: view.relative_path })),
      projections: (): readonly DocumentView[] => views,
      create: (): Promise<MatchSaveAnswer> => Promise.resolve({ kind: 'notAttempted' }),
      adoptRecoveryDiskVersion: (_conflict: ConflictModel<CreationBuffers>): DiskAdoptionOutcome => 'refused',
      clock: (): number => 0,
      save: (id: MatchId, draft: MatchDraft): Promise<MatchSaveAnswer> => {
        saves.push(draft);
        const next = remainingSaves.shift();
        note(id.document, next);
        return answered(next);
      },
      reproject: () =>
        script.fresh === undefined
          ? ({ kind: 'unavailable', reason: 'otherFile' } as const)
          : ({ kind: 'projected', match: script.fresh } as const),
      adoptDiskVersion: (_conflict: ConflictModel<MatchBuffers>): DiskAdoptionOutcome => 'refused',
      reportReceiver: () => inertBinding(),
      reportRecovery: inertBinding,
      standingConflictFor: (document: DocumentId): ConflictSource | null => standing.get(document) ?? null,
      variables,
      close: (): void => undefined
    }
  });
  flushSync();
  return {
    target,
    saves,
    moves,
    stop: () => {
      void unmount(component);
      target.remove();
    }
  };
} // End of function mountEditor()

/**
 * Lets the ports' promises settle and the DOM follow.
 */
async function settle(): Promise<void> {
  for (let round = 0; round < 4; round += 1) {
    await Promise.resolve();
    await tick();
  } // End of the loop over the settling rounds
  flushSync();
} // End of function settle()

/**
 * One key's sentence in one language.
 *
 * @param key - The key.
 * @param params - Its placeholders.
 * @param lang - The language.
 * @returns The sentence.
 */
function sentence(key: TranslationKey, params?: TranslationParams, lang: Locale = 'en'): string {
  return translate(lang, key, params);
} // End of function sentence()




/**
 * The button inside `scope` labelled exactly `label`, or `null`.
 *
 * @param scope - Where to look.
 * @param label - The rendered label.
 * @returns The button, or `null`.
 */
function buttonLabelled(scope: HTMLElement, label: string): HTMLButtonElement | null {
  return [...scope.querySelectorAll('button')].find((one) => one.textContent?.trim() === label) ?? null;
} // End of function buttonLabelled()

/**
 * Presses the button labelled with one key's sentence, insisting it is drawn and
 * enabled.
 *
 * @param scope - Where to look.
 * @param key - The key holding the label.
 * @param params - Its placeholders.
 */
function press(scope: HTMLElement, key: TranslationKey, params?: TranslationParams): void {
  const found = buttonLabelled(scope, sentence(key, params));
  if (found === null) {
    throw new Error(`this case needs the control ${key}`);
  }
  expect(found.disabled).toBe(false);
  found.click();
  flushSync();
} // End of function press()

/**
 * Types a whole value into one control the way a keystroke does.
 *
 * @param control - The box.
 * @param text - Its whole new value.
 */
function type(control: HTMLInputElement | HTMLTextAreaElement, text: string): void {
  control.value = text;
  control.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
} // End of function type()



/**
 * The form builder.
 *
 * @param target - Where the editor was mounted.
 * @param lang - The language its heading is drawn in.
 * @returns The builder.
 */
function builder(target: HTMLElement, lang: Locale = 'en'): HTMLElement {
  const label = DICTIONARIES[lang]['browser.formBuilder.heading'];
  const found = target.querySelector(`[role="group"][aria-label="${label}"]`);
  if (!(found instanceof HTMLElement)) {
    throw new Error('this case needs the form builder drawn');
  }
  return found;
} // End of function builder()

/**
 * The row buttons of the builder, in order.
 *
 * @param target - Where the editor was mounted.
 * @returns The buttons.
 */
function rows(target: HTMLElement): HTMLButtonElement[] {
  return [...builder(target).querySelectorAll('button.rowButton')].filter(
    (one): one is HTMLButtonElement => one instanceof HTMLButtonElement
  );
} // End of function rows()

/**
 * The name each row shows, in order (`null` for none).
 *
 * @param target - Where the editor was mounted.
 * @returns The names.
 */
function rowNames(target: HTMLElement): (string | null)[] {
  return rows(target).map((one) => one.querySelector('code')?.textContent ?? null);
} // End of function rowNames()

/**
 * Presses the row whose name is `name`.
 *
 * @param target - Where the editor was mounted.
 * @param name - The row's name.
 */
function pressRow(target: HTMLElement, name: string): void {
  const row = rows(target).find((one) => one.querySelector('code')?.textContent === name);
  if (row === undefined) {
    throw new Error(`this case needs the row ${name}`);
  }
  row.click();
  flushSync();
} // End of function pressRow()

/**
 * One element found by a selector inside the builder, insisting it exists.
 *
 * @typeParam E - The element type.
 * @param target - Where the editor was mounted.
 * @param selector - The selector.
 * @param kind - The element class it must be.
 * @returns The element.
 */
function inBuilder<E extends Element>(target: HTMLElement, selector: string, kind: new () => E): E {
  const found = builder(target).querySelector(selector);
  if (!(found instanceof kind)) {
    throw new Error(`this case needs ${selector}`);
  }
  return found;
} // End of function inBuilder()

/**
 * The editor's box for one content key.
 *
 * @param target - Where the editor was mounted.
 * @param name - The key.
 * @returns The box.
 */
function contentBox(target: HTMLElement, name: string): HTMLTextAreaElement {
  const found = target.querySelector(`textarea[data-field="${name}"]`);
  if (!(found instanceof HTMLTextAreaElement)) {
    throw new Error(`this case needs the ${name} box`);
  }
  return found;
} // End of function contentBox()

/**
 * The texts drawn through `SourceText` inside one element.
 *
 * @param scope - Where to look.
 * @returns Their texts.
 */
function sourceTexts(scope: Element): string[] {
  return [...scope.querySelectorAll('.sourceText')].map((one) => one.textContent ?? '');
} // End of function sourceTexts()

/**
 * The one save the case made.
 *
 * @param editor - The mounted editor.
 * @returns The draft sent.
 */
function onlySave(editor: Mounted): MatchDraft {
  expect(editor.saves).toHaveLength(1);
  return editor.saves[0] as MatchDraft;
} // End of function onlySave()

/** Nothing inserted into a definition's options. */
const NO_INSERT = { type: null, default: null, multiline: null, values: null, trim_string_values: null, extra: [] };

describe('1. both storage shapes', () => {
  it('draws the shorthand form under the Form box, with its rows and a display that follows the layout', () => {
    const editor = mountEditor();
    const drawn = builder(editor.target);
    expect(drawn.textContent).toContain(sentence('browser.formBuilder.shorthand'));
    expect(drawn.textContent).toContain(sentence('browser.formBuilder.layout.contentField'));
    // One draft of the layout: the builder draws no second box for it.
    expect(drawn.querySelector('textarea[data-form-layout]')).toBeNull();
    expect(contentBox(editor.target, 'form').value).toBe(LAYOUT);
    expect(rowNames(editor.target)).toEqual(['pick', 'lines', 'q', 'solo']);
    expect([...drawn.querySelectorAll('mark.placeholder')].map((one) => one.textContent)).toEqual(['[[pick]]', '[[lines]]', '[[q]]']);
    // No row's controls are mounted until one is selected.
    expect(drawn.querySelectorAll('input, textarea')).toHaveLength(0);
    editor.stop();
  });

  it('draws a verbose form with its own layout box, and in Spanish', () => {
    locale.setOverride('es');
    const editor = mountEditor({ match: verbose() });
    const drawn = builder(editor.target, 'es');
    expect(drawn.textContent).toContain(sentence('browser.formBuilder.verbose', { name: 'f' }, 'es'));
    const box = drawn.querySelector('textarea[data-form-layout="0"]');
    expect(box instanceof HTMLTextAreaElement ? box.value : null).toBe('X: [[x]]');
    expect([...drawn.querySelectorAll('button.rowButton code')].map((one) => one.textContent)).toEqual(['x']);
    editor.stop();
  });
});

describe('2. layout-only edits', () => {
  it('re-derives the rows from the Form box and sends the layout alone', () => {
    const editor = mountEditor({ saves: [] });
    type(contentBox(editor.target, 'form'), 'P: [[pick]] N: [[fresh]] [[fresh]]');
    expect(rowNames(editor.target)).toEqual(['pick', 'fresh', 'lines', 'solo']);
    const drawn = builder(editor.target);
    expect(drawn.textContent).toContain(sentence('browser.formBuilder.row.occurrences', { count: 2 }));
    expect(drawn.textContent).toContain(sentence('browser.formEditor.row.noDefinition'));
    expect(drawn.textContent).toContain(sentence('browser.formEditor.row.noOccurrence'));
    press(editor.target, 'browser.matchEditor.save');
    const draft = onlySave(editor);
    expect(draft.form).toEqual({ Set: 'P: [[pick]] N: [[fresh]] [[fresh]]' });
    expect(draft.form_fields).toEqual([]);
    expect(draft.form_intents).toEqual([]);
    editor.stop();
  });

  it('sends a verbose layout edit as its params entry alone', () => {
    const editor = mountEditor({ match: verbose(), saves: [] });
    type(inBuilder(editor.target, 'textarea[data-form-layout="0"]', HTMLTextAreaElement), 'Y: [[y]]');
    expect(rowNames(editor.target)).toEqual(['y', 'x']);
    press(editor.target, 'browser.matchEditor.save');
    const draft = onlySave(editor);
    expect(draft.vars).toEqual([
      expect.objectContaining({ index: 0, params: [{ index: 0, value: { Set: 'Y: [[y]]' }, items: [] }], fields: [], field_intents: [] })
    ]);
    editor.stop();
  });
});

describe('3. explicit compound additions', () => {
  it('Add field puts [[name]] at the caret and a Choice definition into one draft, taken back by one undo', () => {
    const editor = mountEditor({ saves: [] });
    const form = contentBox(editor.target, 'form');
    form.setSelectionRange(0, 0);
    press(builder(editor.target), 'browser.formBuilder.addField.open');
    type(inBuilder(editor.target, '.panel input.text', HTMLInputElement), 'z');
    press(builder(editor.target), 'browser.formBuilder.kind.choice');
    type(inBuilder(editor.target, 'textarea[data-form-new-values]', HTMLTextAreaElement), 'yes\nno');
    press(builder(editor.target), 'browser.formBuilder.addField.add');
    expect(contentBox(editor.target, 'form').value).toBe(`[[z]]${LAYOUT}`);
    expect(rowNames(editor.target)).toEqual(['z', 'pick', 'lines', 'q', 'solo']);

    press(editor.target, 'browser.matchEditor.undo');
    expect(contentBox(editor.target, 'form').value).toBe(LAYOUT);
    expect(rowNames(editor.target)).toEqual(['pick', 'lines', 'q', 'solo']);
    press(editor.target, 'browser.matchEditor.redo');
    press(editor.target, 'browser.matchEditor.save');
    const draft = onlySave(editor);
    expect(draft.form).toEqual({ Set: `[[z]]${LAYOUT}` });
    expect(draft.form_intents).toEqual([
      { InsertField: { after: null, field: { name: 'z', options: { ...NO_INSERT, type: 'choice', values: { List: ['yes', 'no'] } } } } }
    ]);
    editor.stop();
  });

  it('defines a placeholder the layout holds as a List, leaving the layout alone', () => {
    const editor = mountEditor({ saves: [] });
    pressRow(editor.target, 'q');
    expect(builder(editor.target).textContent).toContain(sentence('browser.formBuilder.define.heading', { name: 'q' }));
    press(builder(editor.target), 'browser.formBuilder.kind.list');
    type(inBuilder(editor.target, 'textarea[data-form-new-values]', HTMLTextAreaElement), 'r\ns\n');
    press(builder(editor.target), 'browser.formBuilder.define.add');
    press(editor.target, 'browser.matchEditor.save');
    const draft = onlySave(editor);
    expect(draft.form).toBe('Unchanged');
    expect(draft.form_intents).toEqual([
      { InsertField: { after: null, field: { name: 'q', options: { ...NO_INSERT, type: 'list', values: { List: ['r', 's'] } } } } }
    ]);
    editor.stop();
  });

  it('inserts a Form — its referenced fields and the new variable — as one step and one save', () => {
    const editor = mountEditor({ match: plain(), saves: [] });
    contentBox(editor.target, 'replace').setSelectionRange(6, 6);
    press(builder(editor.target), 'browser.formBuilder.insert.open');
    const panel = builder(editor.target).querySelector(`[aria-label="${sentence('browser.formBuilder.insert.heading')}"]`);
    if (!(panel instanceof HTMLElement)) {
      throw new Error('this case needs the insertion panel');
    }
    expect(panel.querySelector('.verdict')?.textContent).toBe(sentence('browser.variableEditor.name.availableAmongVisibleNames'));
    type(inBuilder(editor.target, 'textarea[data-form-insert-layout]', HTMLTextAreaElement), 'A: [[a]] B: [[b]]');
    const second = panel.querySelector('[aria-label="b"]');
    if (!(second instanceof HTMLElement)) {
      throw new Error('this case needs the second field');
    }
    press(second, 'browser.formBuilder.kind.choice');
    const values = panel.querySelector('[aria-label="b"] textarea');
    if (!(values instanceof HTMLTextAreaElement)) {
      throw new Error('this case needs the values box');
    }
    type(values, 'x\ny');
    expect(sourceTexts(panel)).toContain('{{form.a}} {{form.b}}');
    press(panel, 'browser.formBuilder.insert.insert');
    expect(contentBox(editor.target, 'replace').value).toBe('Hello {{form.a}} {{form.b}}');
    press(editor.target, 'browser.matchEditor.save');
    const draft = onlySave(editor);
    expect(draft.replace).toEqual({ Set: 'Hello {{form.a}} {{form.b}}' });
    expect(draft.var_intents).toEqual([
      {
        InsertVariable: {
          at: { End: {} },
          variable: {
            name: 'form',
            params: {
              Form: {
                layout: 'A: [[a]] B: [[b]]',
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
    editor.stop();
  });

  it('says why a Form cannot be inserted into a snippet whose content is a form', () => {
    const editor = mountEditor();
    press(builder(editor.target), 'browser.formBuilder.insert.open');
    type(inBuilder(editor.target, 'textarea[data-form-insert-layout]', HTMLTextAreaElement), '[[a]]');
    expect(builder(editor.target).textContent).toContain(sentence('browser.formBuilder.insert.noTarget'));
    expect(buttonLabelled(builder(editor.target), sentence('browser.formBuilder.insert.insert'))?.disabled).toBe(true);
    editor.stop();
  });
});

describe('4. definition-only rows', () => {
  it('draws a definition the layout does not use as a row with its advisory, and removes it explicitly', () => {
    const editor = mountEditor({ saves: [] });
    const solo = rows(editor.target).find((one) => one.querySelector('code')?.textContent === 'solo');
    expect(solo?.closest('li')?.textContent).toContain(sentence('browser.formEditor.row.noOccurrence'));
    pressRow(editor.target, 'solo');
    expect(builder(editor.target).textContent).toContain(sentence('browser.formBuilder.field.removalPreview', { count: 0 }));
    press(builder(editor.target), 'browser.formBuilder.field.remove');
    expect(builder(editor.target).textContent).toContain(sentence('browser.formBuilder.field.removedNote'));
    // Still reachable, and restorable.
    expect(rowNames(editor.target)).toContain('solo');
    press(editor.target, 'browser.matchEditor.save');
    expect(onlySave(editor).form_intents).toEqual([{ RemoveField: { index: 2 } }]);
    editor.stop();
  });
});

describe('5. unknown source is visible through SourceText', () => {
  it('draws an option this editor does not draft as the file writes it, removable only', () => {
    const editor = mountEditor({ saves: [] });
    pressRow(editor.target, 'pick');
    const other = inBuilder(editor.target, '.otherOption', HTMLElement);
    expect(other.querySelector('code')?.textContent).toBe('hint');
    expect(sourceTexts(other)).toEqual(['kept as written']);
    expect(other.textContent).toContain(sentence('browser.formBuilder.option.unknown'));
    expect(other.querySelectorAll('input, textarea')).toHaveLength(0);
    press(other, 'browser.formBuilder.option.remove');
    press(editor.target, 'browser.matchEditor.save');
    expect(onlySave(editor).form_fields).toEqual([
      { index: 0, options: [{ index: 2, value: 'Remove', items: [] }], insert_options: NO_INSERT, values: [] }
    ]);
    editor.stop();
  });

  it('draws a verbose layout holding a carriage return through SourceText, never in a box', () => {
    const editor = mountEditor({ match: verbose('X:\r\n[[x]]') });
    const drawn = builder(editor.target);
    expect(drawn.querySelector('textarea[data-form-layout]')).toBeNull();
    expect(sourceTexts(drawn).some((one) => one.startsWith('X:') && one.endsWith('[[x]]'))).toBe(true);
    expect(drawn.querySelector('.layoutDisplay')).toBeNull();
    expect(drawn.textContent).toContain(sentence('browser.matchEditor.readOnly.carriageReturn'));
    editor.stop();
  });
});

describe('6. multiline, defaults and trimming are textual controls', () => {
  it('draws them as text boxes, never checkboxes, and sends exactly the text typed or suggested', () => {
    const editor = mountEditor({ saves: [] });
    pressRow(editor.target, 'solo');
    const drawn = builder(editor.target);
    expect(drawn.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    const multiline = inBuilder(editor.target, 'input[data-form-option="multiline"]', HTMLInputElement);
    expect(multiline.type).toBe('text');
    expect(multiline.value).toBe('true');
    const fallback = inBuilder(editor.target, 'textarea[data-form-option="default"]', HTMLTextAreaElement);
    expect(fallback.value).toBe('d');
    const trim = inBuilder(editor.target, 'input[data-form-option="trim_string_values"]', HTMLInputElement);
    expect(trim.value).toBe('');
    expect(trim.closest('.formOption')?.textContent).toContain(sentence('browser.formBuilder.option.absent'));
    type(multiline, 'no');
    type(fallback, 'line one\nline two');
    // A suggestion is an exact string put into the box.
    const suggestion = [...(trim.closest('.formOption')?.querySelectorAll('button') ?? [])].find((one) => one.textContent?.trim() === 'false');
    suggestion?.click();
    flushSync();
    expect(inBuilder(editor.target, 'input[data-form-option="trim_string_values"]', HTMLInputElement).value).toBe('false');
    press(editor.target, 'browser.matchEditor.save');
    expect(onlySave(editor).form_fields).toEqual([
      {
        index: 2,
        options: [
          { index: 0, value: { Set: 'no' }, items: [] },
          { index: 1, value: { Set: 'line one\nline two' }, items: [] }
        ],
        insert_options: { ...NO_INSERT, trim_string_values: 'false' },
        values: []
      }
    ]);
    editor.stop();
  });
});

describe('7. Choice and List controls, option removal and removal of every field', () => {
  it('edits, removes and adds values item by item', () => {
    const editor = mountEditor({ saves: [] });
    pressRow(editor.target, 'pick');
    type(inBuilder(editor.target, 'input[data-form-value="0"]', HTMLInputElement), 'A');
    const second = inBuilder(editor.target, 'input[data-form-value="1"]', HTMLInputElement).closest('li');
    if (!(second instanceof HTMLElement)) {
      throw new Error('this case needs the second item');
    }
    press(second, 'browser.formBuilder.values.removeItem');
    type(inBuilder(editor.target, 'textarea[data-form-add-values]', HTMLTextAreaElement), 'd\ne');
    press(builder(editor.target), 'browser.formBuilder.values.add');
    const list = inBuilder(editor.target, '.valuesList', HTMLElement);
    expect(sourceTexts(list)).toEqual(['b', 'd', 'e']);
    press(editor.target, 'browser.matchEditor.save');
    expect(onlySave(editor).form_fields).toEqual([
      {
        index: 0,
        options: [{ index: 1, value: 'Unchanged', items: [{ index: 0, value: { Set: 'A' } }] }],
        insert_options: NO_INSERT,
        values: [{ RemoveItem: { index: 1 } }, { InsertItems: { at: { End: {} }, items: ['d', 'e'] } }]
      }
    ]);
    editor.stop();
  });

  it('edits a values text as one text, and takes an option out', () => {
    const editor = mountEditor({ saves: [] });
    pressRow(editor.target, 'lines');
    expect(builder(editor.target).textContent).toContain(sentence('browser.formBuilder.values.text'));
    type(inBuilder(editor.target, 'textarea[data-form-values-text]', HTMLTextAreaElement), 'one\ntwo\nthree');
    const typeBox = inBuilder(editor.target, 'input[data-form-option="type"]', HTMLInputElement).closest('.formOption');
    if (!(typeBox instanceof HTMLElement)) {
      throw new Error('this case needs the type option');
    }
    press(typeBox, 'browser.formBuilder.option.remove');
    expect(builder(editor.target).textContent).toContain(sentence('browser.formBuilder.option.removed'));
    press(editor.target, 'browser.matchEditor.save');
    expect(onlySave(editor).form_fields).toEqual([
      {
        index: 1,
        options: [
          { index: 0, value: 'Remove', items: [] },
          { index: 1, value: { Set: 'one\ntwo\nthree' }, items: [] }
        ],
        insert_options: NO_INSERT,
        values: []
      }
    ]);
    editor.stop();
  });

  it('takes every field out by one explicit action, keeps the layout, and restores them', () => {
    const editor = mountEditor({ saves: [] });
    press(builder(editor.target), 'browser.formBuilder.removeAll.remove');
    expect(builder(editor.target).textContent).toContain(sentence('browser.formBuilder.removeAll.drafted'));
    press(builder(editor.target), 'browser.formBuilder.removeAll.restore');
    press(builder(editor.target), 'browser.formBuilder.removeAll.remove');
    press(editor.target, 'browser.matchEditor.save');
    const draft = onlySave(editor);
    expect(draft.form).toBe('Unchanged');
    expect(draft.form_intents).toEqual([{ RemoveFields: {} }]);
    expect(draft.form_fields).toEqual([]);
    editor.stop();
  });
});

describe('8. conflict compare', () => {
  it('retains the form draft under a save conflict, row by row, and draws the builder read-only', async () => {
    const disk = projection({ formFields: [] }, AFTER);
    const conflict = makeConflict({ disk: fileOf([disk], AFTER), expected: BASE, found: AFTER });
    const editor = mountEditor({ saves: [conflict] });
    pressRow(editor.target, 'pick');
    type(inBuilder(editor.target, 'input[data-form-value="0"]', HTMLInputElement), 'A');
    press(editor.target, 'browser.matchEditor.save');
    await settle();
    const panel = editor.target.querySelector('.panel[role="status"]');
    expect(panel).not.toBeNull();
    const retained = [...(panel?.querySelectorAll('.shownValue') ?? [])].map((one) => one.textContent ?? '');
    const formField = DICTIONARIES.en['browser.saveOutcome.label.formField'];
    const formOption = DICTIONARIES.en['browser.saveOutcome.label.formOption'];
    expect(retained.some((one) => one.includes(formField) && one.includes('pick'))).toBe(true);
    expect(retained.some((one) => one.includes(formOption) && one.includes('A'))).toBe(true);
    const boxes = [...builder(editor.target).querySelectorAll('input, textarea')].filter(
      (one): one is HTMLInputElement | HTMLTextAreaElement => one instanceof HTMLInputElement || one instanceof HTMLTextAreaElement
    );
    expect(boxes.length).toBeGreaterThan(0);
    expect(boxes.every((one) => one.readOnly)).toBe(true);
    expect(buttonLabelled(builder(editor.target), sentence('browser.formBuilder.addField.open'))?.disabled).toBe(true);
    editor.stop();
  });
});

describe('9. the recovery refusal', () => {
  it('refuses to recreate a snippet whose draft inserts a form, after Keep my draft', async () => {
    const conflict = makeConflict({ disk: fileOf([], AFTER), expected: BASE, found: AFTER });
    const editor = mountEditor({ match: plain(), saves: [conflict] });
    press(builder(editor.target), 'browser.formBuilder.insert.open');
    type(inBuilder(editor.target, 'textarea[data-form-insert-layout]', HTMLTextAreaElement), '[[a]]');
    press(builder(editor.target), 'browser.formBuilder.insert.insert');
    press(editor.target, 'browser.matchEditor.save');
    await settle();
    press(editor.target, 'browser.saveOutcome.choice.keepMyDraft');
    await settle();
    expect(editor.target.textContent).toContain(sentence('browser.recovery.unavailable.variablesNotCarried'));
    expect(editor.saves).toHaveLength(1);
    editor.stop();
  });

  it('says "available among visible names" only while the scope is open, as the variables group does', async () => {
    const editor = mountEditor({
      match: plain(),
      snapshot: (id) => ({ ok: true, value: { id, vars: { Absent: {} }, form_fields: { Absent: {} }, analysis: analysis(true) } })
    });
    await settle();
    press(builder(editor.target), 'browser.formBuilder.insert.open');
    expect(builder(editor.target).querySelector('.verdict')?.textContent).toBe(sentence('browser.variableEditor.name.available'));
    editor.stop();
  });
});

/**
 * A snippet whose verbose form `g` defines `y` with its values written as one text.
 *
 * @returns The projection.
 */
function verboseWithTextValues(): MatchView {
  const definitions = [field('y', optionsOf([['type', scalarItem('list')], ['values', scalarItem('one\ntwo')]]))];
  const variable: VariableView = {
    ...makeVariable({
      node: 20,
      name: 'g',
      declaredType: 'form',
      kind: 'Form',
      params: [field('layout', scalarItem('Y: [[y]]')), field('fields', { Mapping: definitions })]
    }),
    fields_presence: fixtureMappingPresence(definitions),
    field_shapes: definitions.map(fixtureFieldShape)
  };
  return makeMatch({ revision: BASE, document: 1, node: 1, trigger: ':t', replace: 'Hi {{g.y}}', vars: [variable] });
} // End of function verboseWithTextValues()

describe('10. review fixes — unshown known options, and removal of a values text', () => {
  it('draws a known option its box cannot hold, and a repeated one, through SourceText', () => {
    const odd = projection({
      formFields: [
        field('odd', optionsOf([['default', listOf(['hidden-default'])], ['type', scalarItem('text')], ['type', scalarItem('choice')]]))
      ]
    });
    const editor = mountEditor({ match: odd });
    pressRow(editor.target, 'odd');
    const others = [...builder(editor.target).querySelectorAll('.otherOption')];
    expect(others.map((one) => one.querySelector('code')?.textContent)).toEqual(['default', 'type', 'type']);
    expect(others.flatMap((one) => sourceTexts(one))).toEqual(['hidden-default', 'text', 'choice']);
    editor.stop();
  });

  it.each([
    ['shorthand', (): MatchView => projection(), 'lines'],
    ['verbose', verboseWithTextValues, 'y']
  ] as const)('offers the removal of a values text (%s shape), sent as a Remove by position', (shape, match, name) => {
    const editor = mountEditor({ match: match(), saves: [] });
    pressRow(editor.target, name);
    const text = inBuilder(editor.target, 'textarea[data-form-values-text]', HTMLTextAreaElement).closest('.formOption');
    if (!(text instanceof HTMLElement)) {
      throw new Error('this case needs the values text');
    }
    press(text, 'browser.formBuilder.option.remove');
    expect(builder(editor.target).textContent).toContain(sentence('browser.formBuilder.option.removed'));
    press(editor.target, 'browser.matchEditor.save');
    const draft = onlySave(editor);
    const sentFields = shape === 'shorthand' ? draft.form_fields : (draft.vars[0]?.fields ?? []);
    expect(sentFields).toEqual([
      { index: shape === 'shorthand' ? 1 : 0, options: [{ index: 1, value: 'Remove', items: [] }], insert_options: NO_INSERT, values: [] }
    ]);
    editor.stop();
  });
});
