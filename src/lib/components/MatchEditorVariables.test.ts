/** @vitest-environment jsdom */

/**
 * Phase 4-11 — the *Variables and fill-ins* group inside the small editor,
 * mounted and driven through real DOM events.
 *
 * Opts into jsdom by the docblock above and by nothing else, as every mounted
 * suite here does. One `describe` per acceptance clause of step 4-11
 * (`docs/decisions/4-split-notes.md` §2):
 *
 * 1. controls are not mounted until selected;
 * 2. every declaration stays reachable;
 * 3. a provisional name is labelled "available among visible names" under an
 *    open scope;
 * 4. the compound insertion reaches one save;
 * 5. reorder cannot bypass the pending-draft rule or R25;
 * 6. conflict and recovery states draw.
 *
 * Suite 8 is Phase 4-14-1's mounted half: every one of the seven kinds through
 * the *Add a variable* form (`../browser/variableKinds.ts`; the model half is
 * `../browser/variableKinds.test.ts`). Suite 9 is Phase 4-14-2's: an existing
 * variable's parameters, list items and `depends_on` items
 * (`../browser/variableParams.ts`; the model half is
 * `../browser/variableParams.test.ts`).
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
import { makeConflict, makeDocument, makeMatch, makeSummary, makeVariable, field, scalarItem, scriptedAcknowledgement, styledScalar } from '../browser/fixtures';
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
  ListPlacement,
  MatchDraft,
  MatchId,
  MatchView,
  NewVariableParams,
  SaveResult,
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

/** Three variables: `first`, `second` (with `inject_vars`) and `third`. */
const THREE_VARS: readonly VariableView[] = [
  makeVariable({ node: 20, name: 'first', declaredType: 'echo', kind: 'Echo', params: [field('echo', scalarItem('one'))] }),
  makeVariable({ node: 21, name: 'second', declaredType: 'echo', kind: 'Echo', injectVars: 'true' }),
  makeVariable({ node: 22, name: 'third', declaredType: 'echo', kind: 'Echo' })
];

/**
 * The snippet: trigger `:a`, body `Hello `, the three variables.
 *
 * @param overrides - Whatever the case needs.
 * @param revision - The revision.
 * @returns The projection.
 */
function projection(overrides: Parameters<typeof makeMatch>[0] = {}, revision: ContentRevision = BASE): MatchView {
  return makeMatch({ revision, document: 1, node: 1, trigger: ':a', replace: 'Hello ', vars: THREE_VARS, ...overrides });
} // End of function projection()

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
 * The variables group.
 *
 * @param target - Where the editor was mounted.
 * @param lang - The language its heading is drawn in.
 * @returns The group.
 */
function group(target: HTMLElement, lang: Locale = 'en'): HTMLElement {
  const label = DICTIONARIES[lang]['browser.variableGroup.heading'];
  const found = target.querySelector(`[role="group"][aria-label="${label}"]`);
  if (!(found instanceof HTMLElement)) {
    throw new Error('this case needs the variables group drawn');
  }
  return found;
} // End of function group()

/**
 * The chips of the strip, in order.
 *
 * @param target - Where the editor was mounted.
 * @returns The chip buttons.
 */
function chips(target: HTMLElement): HTMLButtonElement[] {
  return [...group(target).querySelectorAll('button.chip')].filter(
    (one): one is HTMLButtonElement => one instanceof HTMLButtonElement
  );
} // End of function chips()

/**
 * Presses the chip whose name is `name`.
 *
 * @param target - Where the editor was mounted.
 * @param name - The declaration's name.
 */
function pressChip(target: HTMLElement, name: string): void {
  const chip = chips(target).find((one) => one.querySelector('code')?.textContent === name);
  if (chip === undefined) {
    throw new Error(`this case needs the chip ${name}`);
  }
  chip.click();
  flushSync();
} // End of function pressChip()

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
 * The boxes the group has mounted.
 *
 * @param target - Where the editor was mounted.
 * @returns Every input and text area inside the group.
 */
function groupBoxes(target: HTMLElement): (HTMLInputElement | HTMLTextAreaElement)[] {
  return [...group(target).querySelectorAll('input, textarea')].filter(
    (one): one is HTMLInputElement | HTMLTextAreaElement =>
      one instanceof HTMLInputElement || one instanceof HTMLTextAreaElement
  );
} // End of function groupBoxes()

/**
 * The editor's `replace` text area.
 *
 * @param target - Where the editor was mounted.
 * @returns The box.
 */
function replaceBox(target: HTMLElement): HTMLTextAreaElement {
  const found = target.querySelector('textarea[data-field="replace"]');
  if (!(found instanceof HTMLTextAreaElement)) {
    throw new Error('this case needs the replace box');
  }
  return found;
} // End of function replaceBox()

describe('1. controls are not mounted until selected', () => {
  it('draws the chips and the list with no box, then one declaration’s boxes on selection', () => {
    const editor = mountEditor();
    expect(chips(editor.target).map((one) => one.querySelector('code')?.textContent)).toEqual(['first', 'second', 'third']);
    expect(group(editor.target).querySelectorAll('li.variableRow')).toHaveLength(3);
    expect(groupBoxes(editor.target)).toHaveLength(0);
    expect(group(editor.target).textContent).toContain(sentence('browser.variableGroup.selectHint'));

    pressChip(editor.target, 'second');
    const boxes = groupBoxes(editor.target);
    expect(boxes.map((one) => one.value)).toEqual(['second', 'echo', 'true']);
    expect(chips(editor.target).map((one) => one.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);

    // Pressing it again hides its controls; another chip swaps them.
    pressChip(editor.target, 'second');
    expect(groupBoxes(editor.target)).toHaveLength(0);
    pressChip(editor.target, 'first');
    // `first` has no inject_vars: shown read-only with its reason, never as a box.
    // Its one parameter, `echo`, is a box since Phase 4-14-2.
    expect(groupBoxes(editor.target).map((one) => one.value)).toEqual(['first', 'echo', 'one']);
    expect(group(editor.target).textContent).toContain(sentence('browser.variableEditor.readOnly.notInVariable'));
    editor.stop();
  });

  it('draws the group in Spanish too', () => {
    locale.setOverride('es');
    const editor = mountEditor();
    flushSync();
    expect(group(editor.target, 'es').querySelector('h3')?.textContent).toBe(
      DICTIONARIES.es['browser.variableGroup.heading']
    );
    expect(group(editor.target, 'es').textContent).toContain(DICTIONARIES.es['browser.variableGroup.selectHint']);
    editor.stop();
  });

  it('edits a selected variable through its box, as one draft with the fields', () => {
    const editor = mountEditor();
    pressChip(editor.target, 'first');
    type(groupBoxes(editor.target)[0]!, 'renamed');
    expect(chips(editor.target)[0]?.querySelector('code')?.textContent).toBe('renamed');
    expect(chips(editor.target)[0]?.textContent).toContain(sentence('browser.variableGroup.status.edited'));
    press(editor.target, 'browser.matchEditor.save');
    expect(editor.saves).toHaveLength(1);
    expect(editor.saves[0]?.vars).toEqual([
      expect.objectContaining({ index: 0, name: { Set: 'renamed' }, type: 'Unchanged', inject_vars: 'Unchanged' })
    ]);
    editor.stop();
  });
}); // End of suite 1

describe('2. every declaration stays reachable', () => {
  it('keeps a removed variable’s chip and its restoration, and every chip under a removed container', () => {
    const editor = mountEditor();
    pressChip(editor.target, 'second');
    press(group(editor.target), 'browser.variableGroup.remove');
    expect(chips(editor.target)).toHaveLength(3);
    expect(chips(editor.target)[1]?.textContent).toContain(sentence('browser.variableGroup.status.removed'));
    expect(group(editor.target).textContent).toContain(sentence('browser.variableGroup.removedNote'));
    press(group(editor.target), 'browser.variableGroup.restore');
    expect(chips(editor.target)[1]?.textContent).not.toContain(sentence('browser.variableGroup.status.removed'));

    press(group(editor.target), 'browser.variableGroup.removeAll');
    expect(chips(editor.target)).toHaveLength(3);
    expect(chips(editor.target).every((one) => one.textContent?.includes(sentence('browser.variableGroup.status.removed')))).toBe(true);
    expect(group(editor.target).textContent).toContain(sentence('browser.variableGroup.containerRemoved'));
    pressChip(editor.target, 'third');
    expect(groupBoxes(editor.target).length).toBeGreaterThan(0);
    expect(groupBoxes(editor.target).every((one) => one.readOnly)).toBe(true);
    press(group(editor.target), 'browser.variableGroup.restoreAll');
    expect(chips(editor.target).some((one) => one.textContent?.includes(sentence('browser.variableGroup.status.removed')))).toBe(false);
    editor.stop();
  });

  it('draws a chip for a new variable, whose controls can drop it again', async () => {
    const editor = mountEditor();
    press(group(editor.target), 'browser.variableGroup.choice.open');
    const [, values] = groupBoxes(editor.target);
    type(values!, 'yes\nno');
    press(group(editor.target), 'browser.variableGroup.choice.insert');
    expect(chips(editor.target).map((one) => one.querySelector('code')?.textContent)).toEqual(['first', 'second', 'third', 'choice']);
    expect(chips(editor.target)[3]?.getAttribute('aria-pressed')).toBe('true');
    expect(group(editor.target).textContent).toContain(
      sentence('browser.variableGroup.added.insertedInto', { field: DICTIONARIES.en['browser.detail.field.replace'] })
    );
    press(group(editor.target), 'browser.variableGroup.discard');
    expect(chips(editor.target)).toHaveLength(3);
    editor.stop();
  });
  it('adds an echo variable through Add variable, with a chip, sent by one save', () => {
    const editor = mountEditor();
    press(group(editor.target), 'browser.variableGroup.addVariable.open');
    const [name, text] = groupBoxes(editor.target);
    expect(name?.value).toBe('echo');
    type(text!, 'hello');
    press(group(editor.target), 'browser.variableGroup.addVariable.add');
    expect(chips(editor.target).at(-1)?.querySelector('code')?.textContent).toBe('echo');
    expect(replaceBox(editor.target).value).toBe('Hello ');
    press(editor.target, 'browser.matchEditor.save');
    expect(editor.saves).toHaveLength(1);
    expect(editor.saves[0]?.replace).toBe('Unchanged');
    expect(editor.saves[0]?.var_intents).toEqual([
      {
        InsertVariable: {
          at: { End: {} },
          variable: { name: 'echo', params: { Echo: { echo: 'hello' } }, inject_vars: null, depends_on: null, extra_params: [] }
        }
      }
    ]);
    editor.stop();
  });
}); // End of suite 2

describe('3. a provisional name under an open scope', () => {
  it('labels it "available among visible names" while no analysis is at hand, and under an open scope', async () => {
    for (const scripted of [undefined, false] as const) {
      const editor = mountEditor(
        scripted === undefined
          ? {}
          : { snapshot: (id) => ({ ok: true, value: { id, vars: { Absent: {} }, form_fields: { Absent: {} }, analysis: analysis(scripted) } }) }
      );
      await settle();
      press(group(editor.target), 'browser.variableGroup.choice.open');
      expect(groupBoxes(editor.target)[0]?.value).toBe('choice');
      const verdict = group(editor.target).querySelector('.verdict');
      expect(verdict?.textContent).toBe(sentence('browser.variableEditor.name.availableAmongVisibleNames'));
      editor.stop();
    } // End of the loop over the two open scopes
  });

  it('says "available" only under a closed scope, and refuses a taken name by name', async () => {
    const editor = mountEditor({
      snapshot: (id) => ({ ok: true, value: { id, vars: { Absent: {} }, form_fields: { Absent: {} }, analysis: analysis(true) } })
    });
    await settle();
    expect(group(editor.target).textContent).toContain(sentence('browser.variableGroup.analysis.current'));
    press(group(editor.target), 'browser.variableGroup.choice.open');
    expect(group(editor.target).querySelector('.verdict')?.textContent).toBe(sentence('browser.variableEditor.name.available'));
    type(groupBoxes(editor.target)[0]!, 'first');
    expect(group(editor.target).querySelector('.verdict')?.textContent).toBe(sentence('browser.variableEditor.name.takenByLocal'));
    expect(buttonLabelled(group(editor.target), sentence('browser.variableGroup.choice.insert'))?.disabled).toBe(true);
    editor.stop();
  });

  it('draws the Spanish sentence under an open scope', async () => {
    locale.setOverride('es');
    const editor = mountEditor();
    await settle();
    const open = buttonLabelled(group(editor.target, 'es'), DICTIONARIES.es['browser.variableGroup.choice.open']);
    open?.click();
    flushSync();
    expect(group(editor.target, 'es').querySelector('.verdict')?.textContent).toBe(
      DICTIONARIES.es['browser.variableEditor.name.availableAmongVisibleNames']
    );
    editor.stop();
  });
}); // End of suite 3

describe('4. the compound insertion reaches one save', () => {
  it('puts the reference and the choice variable into one draft, sent by one save and taken back by one undo', () => {
    const editor = mountEditor();
    press(group(editor.target), 'browser.variableGroup.choice.open');
    type(groupBoxes(editor.target)[1]!, 'yes\nno');
    press(group(editor.target), 'browser.variableGroup.choice.insert');
    expect(replaceBox(editor.target).value).toBe('Hello {{choice}}');

    press(editor.target, 'browser.matchEditor.save');
    expect(editor.saves).toHaveLength(1);
    expect(editor.saves[0]?.replace).toEqual({ Set: 'Hello {{choice}}' });
    expect(editor.saves[0]?.var_intents).toEqual([
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
    expect(editor.moves).toHaveLength(0);
    editor.stop();
  });

  it('takes both halves back with one undo', () => {
    const editor = mountEditor();
    press(group(editor.target), 'browser.variableGroup.choice.open');
    type(groupBoxes(editor.target)[1]!, 'yes');
    press(group(editor.target), 'browser.variableGroup.choice.insert');
    press(editor.target, 'browser.matchEditor.undo');
    expect(replaceBox(editor.target).value).toBe('Hello ');
    expect(chips(editor.target)).toHaveLength(3);
    editor.stop();
  });
}); // End of suite 4

describe('5. reorder cannot bypass the pending-draft rule or R25', () => {
  it('offers no reorder while anything else is drafted, and offers it again once the draft is clean', () => {
    const editor = mountEditor();
    pressChip(editor.target, 'second');
    expect(buttonLabelled(group(editor.target), sentence('browser.variableGroup.move.front'))).not.toBeNull();
    type(replaceBox(editor.target), 'Hello there');
    expect(buttonLabelled(group(editor.target), sentence('browser.variableGroup.move.front'))).toBeNull();
    expect(group(editor.target).textContent).toContain(sentence('browser.variableEditor.move.otherEditsPending'));
    press(editor.target, 'browser.matchEditor.undo');
    expect(buttonLabelled(group(editor.target), sentence('browser.variableGroup.move.front'))).not.toBeNull();
    expect(editor.moves).toHaveLength(0);
    editor.stop();
  });

  it('offers no reorder over a stale draft in the file (R36)', () => {
    const editor = mountEditor({ drafts: [{ document: 1, revision: 'c'.repeat(64), node: 9 }] });
    pressChip(editor.target, 'second');
    expect(buttonLabelled(group(editor.target), sentence('browser.variableGroup.move.front'))).toBeNull();
    expect(group(editor.target).textContent).toContain(sentence('browser.variableEditor.structure.staleDraftInDocument'));
    editor.stop();
  });

  it('sends the reorder alone, through the reorder port, and takes a commit as a success', async () => {
    const committed: SaveResult = {
      outcome: 'saved',
      revision: AFTER,
      committed: true,
      notes: [],
      backup_taken: false,
      moved: { document: 1, revision: AFTER, node: 1 }
    };
    const editor = mountEditor({ moves: [committed] });
    pressChip(editor.target, 'second');
    press(group(editor.target), 'browser.variableGroup.move.front');
    expect(editor.moves).toEqual([
      { id: { document: 1, revision: BASE, node: 1 }, variable: 1, to: { Front: {} }, baseRevision: BASE, acknowledgement: { accepted: [] } }
    ]);
    expect(editor.saves).toHaveLength(0);
    await settle();
    expect(editor.target.textContent).toContain(sentence('browser.matchEditor.needsReprojection'));
    expect(editor.target.textContent).not.toContain(sentence('browser.matchEditor.sendFailed'));
    // A commit owes a re-projection: nothing in the group accepts a change.
    pressChip(editor.target, 'first');
    expect(groupBoxes(editor.target).length).toBeGreaterThan(0);
    expect(groupBoxes(editor.target).every((one) => one.readOnly)).toBe(true);
    editor.stop();
  });
}); // End of suite 5

describe('6. conflict and recovery states draw', () => {
  it('draws a variable draft under a save conflict, read-only, and the recovery refusal after Keep my draft', async () => {
    const disk = projection({ vars: [THREE_VARS[0]!] }, AFTER);
    const conflict = makeConflict({ disk: fileOf([disk], AFTER), expected: BASE, found: AFTER });
    const editor = mountEditor({ saves: [conflict] });
    pressChip(editor.target, 'first');
    type(groupBoxes(editor.target)[0]!, 'renamed');
    press(editor.target, 'browser.matchEditor.save');
    await settle();

    const panel = editor.target.querySelector('.panel[role="status"]');
    expect(panel).not.toBeNull();
    const retained = [...(panel?.querySelectorAll('.shownValue') ?? [])].map((one) => one.textContent ?? '');
    expect(retained.some((one) => one.includes('renamed') && one.includes(DICTIONARIES.en['browser.saveOutcome.label.variableName']))).toBe(true);
    // The group still draws the selection, and nothing in it accepts a change.
    expect(groupBoxes(editor.target).length).toBeGreaterThan(0);
    expect(groupBoxes(editor.target).every((one) => one.readOnly)).toBe(true);
    expect(group(editor.target).textContent).toContain(sentence('browser.variableEditor.move.editorNotEditable'));

    press(editor.target, 'browser.saveOutcome.choice.keepMyDraft');
    await settle();
    expect(editor.target.textContent).toContain(sentence('browser.recovery.unavailable.variablesNotCarried'));
    expect(editor.saves).toHaveLength(1);
    editor.stop();
  });

  it('draws a reorder’s conflict with nothing to keep or copy, and says why', async () => {
    const conflict = makeConflict({ disk: fileOf([], AFTER), expected: BASE, found: AFTER });
    const editor = mountEditor({ moves: [conflict] });
    pressChip(editor.target, 'second');
    press(group(editor.target), 'browser.variableGroup.move.end');
    await settle();
    expect(editor.target.textContent).toContain(sentence('browser.variableGroup.reorderConflict'));
    expect(buttonLabelled(editor.target, sentence('browser.saveOutcome.choice.keepMyDraft'))).toBeNull();
    expect(buttonLabelled(editor.target, sentence('browser.saveOutcome.choice.copyDraft'))).toBeNull();
    expect(buttonLabelled(editor.target, sentence('browser.saveOutcome.choice.reloadDiskVersion'))).not.toBeNull();
    expect(editor.saves).toHaveLength(0);
    editor.stop();
  });
}); // End of suite 6

/**
 * A committed save answering the snippet's identity in the new revision.
 *
 * @returns The save result.
 */
function committedToAfter(): SaveResult {
  return {
    outcome: 'saved',
    revision: AFTER,
    committed: true,
    notes: [],
    backup_taken: false,
    moved: { document: 1, revision: AFTER, node: 1 }
  };
} // End of function committedToAfter()

/**
 * The analysis the snapshot answers for one revision: at `BASE` the variables
 * in their first order, at `AFTER` with `second` moved to the front and
 * referenced five times in the content — a count no row of the old order holds.
 *
 * @param id - The identity the snapshot was asked for.
 * @returns The snapshot's answer.
 */
function snapshotByRevision(id: MatchId): CommandResult<AuthoringSnapshot> {
  const names = id.revision === AFTER ? ['second', 'first', 'third'] : ['first', 'second', 'third'];
  const summary: AnalysisSummary = {
    ...analysis(true),
    declarations: names.map((name, index) => ({
      index,
      name,
      kind: 'Echo',
      injection: 'Disabled',
      usage: { body: id.revision === AFTER && name === 'second' ? 5 : 0, parameters: 0, depends_on: 0, unverified_layout: 0 },
      layout: null
    }))
  };
  return { ok: true, value: { id, vars: { Absent: {} }, form_fields: { Absent: {} }, analysis: summary } };
} // End of function snapshotByRevision()

/**
 * The usage sentence of each row of the list, in order, or `null` for a row that
 * draws none.
 *
 * @param target - Where the editor was mounted.
 * @returns One entry per row: its name and its usage sentence.
 */
function rowUsages(target: HTMLElement): (readonly [string, string | null])[] {
  const prefix = sentence('browser.variableGroup.row.usage', { body: 0, parameters: 0, dependsOn: 0, layout: 0 }).slice(0, 18);
  return [...group(target).querySelectorAll('li.variableRow')].map((row) => [
    row.querySelector('code')?.textContent ?? '',
    [...row.querySelectorAll('p.kind')].map((one) => one.textContent ?? '').find((one) => one.startsWith(prefix)) ?? null
  ]);
} // End of function rowUsages()

describe('7. review fixes — the revision boundary after a committed write', () => {
  it('draws no new-revision analysis over the old order, and the new order’s after the re-seed', async () => {
    const reordered = projection({ vars: [THREE_VARS[1]!, THREE_VARS[0]!, THREE_VARS[2]!] }, AFTER);
    const editor = mountEditor({ snapshot: snapshotByRevision, moves: [committedToAfter()], fresh: reordered });
    await settle();
    pressChip(editor.target, 'second');
    press(group(editor.target), 'browser.variableGroup.move.front');
    await settle();
    // Committed, not yet re-seeded: the snapshot for AFTER has answered, and the
    // rows are still the old order, so no row may carry its counts.
    expect(rowUsages(editor.target).map(([name]) => name)).toEqual(['first', 'second', 'third']);
    expect(rowUsages(editor.target).every(([, usage]) => usage === null)).toBe(true);
    expect(group(editor.target).textContent).toContain(sentence('browser.variableGroup.analysis.outOfStep'));

    press(editor.target, 'browser.matchEditor.reload');
    await settle();
    const after = rowUsages(editor.target);
    expect(after.map(([name]) => name)).toEqual(['second', 'first', 'third']);
    expect(after[0]?.[1]).toContain('5');
    editor.stop();
  });

  it('clears the selection when a reorder is committed and the editor re-seeded', async () => {
    const reordered = projection({ vars: [THREE_VARS[1]!, THREE_VARS[0]!, THREE_VARS[2]!] }, AFTER);
    const editor = mountEditor({ moves: [committedToAfter()], fresh: reordered });
    pressChip(editor.target, 'second');
    press(group(editor.target), 'browser.variableGroup.move.front');
    await settle();
    press(editor.target, 'browser.matchEditor.reload');
    await settle();
    expect(chips(editor.target).map((one) => one.querySelector('code')?.textContent)).toEqual(['second', 'first', 'third']);
    expect(chips(editor.target).every((one) => one.getAttribute('aria-pressed') === 'false')).toBe(true);
    expect(groupBoxes(editor.target)).toHaveLength(0);
    editor.stop();
  });

  it('clears the selection when a removal is committed and the editor re-seeded', async () => {
    const removed = projection({ vars: [THREE_VARS[0]!, THREE_VARS[2]!] }, AFTER);
    const editor = mountEditor({ saves: [committedToAfter()], fresh: removed });
    pressChip(editor.target, 'second');
    press(group(editor.target), 'browser.variableGroup.remove');
    press(editor.target, 'browser.matchEditor.save');
    await settle();
    press(editor.target, 'browser.matchEditor.reload');
    await settle();
    expect(chips(editor.target).map((one) => one.querySelector('code')?.textContent)).toEqual(['first', 'third']);
    expect(chips(editor.target).every((one) => one.getAttribute('aria-pressed') === 'false')).toBe(true);
    expect(groupBoxes(editor.target)).toHaveLength(0);
    editor.stop();
  });
}); // End of suite 7

// ---------------------------------------------------------------------------
// Phase 4-14-1 — the seven kinds through *Add a variable*
// ---------------------------------------------------------------------------

/**
 * One part's box inside the *Add a variable* form.
 *
 * @param target - Where the editor was mounted.
 * @param part - The part's espanso key.
 * @returns The box.
 */
function partBox(target: HTMLElement, part: string): HTMLInputElement | HTMLTextAreaElement {
  const found = group(target).querySelector(`[data-part="${part}"] input, [data-part="${part}"] textarea`);
  if (!(found instanceof HTMLInputElement || found instanceof HTMLTextAreaElement)) {
    throw new Error(`this case needs the ${part} box`);
  }
  return found;
} // End of function partBox()

/**
 * The *Add a variable* form.
 *
 * @param target - Where the editor was mounted.
 * @returns The form's panel.
 */
function addForm(target: HTMLElement): HTMLElement {
  const found = group(target).querySelector('.addForm');
  if (!(found instanceof HTMLElement)) {
    throw new Error('this case needs the Add a variable form');
  }
  return found;
} // End of function addForm()

/** One kind's mounted case: what is typed, and the closed shape the save carries. */
interface MountedKind {
  /** The kind's label key. */
  readonly label: TranslationKey;
  /** The `type` word, which is also the provisional name. */
  readonly word: string;
  /** What is typed, by part. */
  readonly typed: Readonly<Record<string, string>>;
  /** The `params` keys the selected addition's panel lists, in order. */
  readonly keys: readonly string[];
  /** The closed shape sent. */
  readonly params: NewVariableParams;
}

/** The seven kinds, as a person fills them in. */
const MOUNTED_KINDS: readonly MountedKind[] = [
  { label: 'browser.variableKinds.kind.echo', word: 'echo', typed: { echo: 'hi' }, keys: ['echo'], params: { Echo: { echo: 'hi' } } },
  {
    label: 'browser.variableKinds.kind.date',
    word: 'date',
    typed: { format: '%H:%M', offset: '60' },
    keys: ['format', 'offset'],
    params: { Date: { format: '%H:%M', offset: '60', tz: null, locale: null } }
  },
  { label: 'browser.variableKinds.kind.random', word: 'random', typed: { choices: 'a\nb' }, keys: ['choices'], params: { Random: { choices: ['a', 'b'] } } },
  { label: 'browser.variableKinds.kind.clipboard', word: 'clipboard', typed: {}, keys: [], params: { Clipboard: {} } },
  {
    label: 'browser.variableKinds.kind.shell',
    word: 'shell',
    typed: { cmd: 'date', trim: 'true' },
    keys: ['cmd', 'trim'],
    params: { Shell: { cmd: 'date', shell: null, trim: 'true', debug: null } }
  },
  { label: 'browser.variableKinds.kind.script', word: 'script', typed: { args: 'python3\nx.py' }, keys: ['args'], params: { Script: { args: ['python3', 'x.py'], trim: null } } },
  { label: 'browser.variableKinds.kind.match', word: 'match', typed: { trigger: ':sig' }, keys: ['trigger'], params: { Match: { trigger: ':sig' } } }
];

describe('8. Phase 4-14-1 — every kind through Add a variable', () => {
  it.each(MOUNTED_KINDS)('$word: chosen, filled, added with a chip, listed, and sent by one save in its closed shape', (one) => {
    const editor = mountEditor();
    press(group(editor.target), 'browser.variableGroup.addVariable.open');
    press(addForm(editor.target), one.label);
    expect(groupBoxes(editor.target)[0]?.value).toBe(one.word);
    for (const [part, text] of Object.entries(one.typed)) {
      type(partBox(editor.target, part), text);
    } // End of the loop over the typed parts
    press(group(editor.target), 'browser.variableGroup.addVariable.add');
    const chip = chips(editor.target).at(-1);
    expect(chip?.querySelector('code')?.textContent).toBe(one.word);
    expect(chip?.getAttribute('aria-pressed')).toBe('true');
    expect([...group(editor.target).querySelectorAll('.addedParam code')].map((code) => code.textContent)).toEqual(one.keys);
    press(editor.target, 'browser.matchEditor.save');
    expect(editor.saves).toHaveLength(1);
    expect(editor.saves[0]?.replace).toBe('Unchanged');
    expect(editor.saves[0]?.var_intents).toEqual([
      {
        InsertVariable: {
          at: { End: {} },
          variable: { name: one.word, params: one.params, inject_vars: null, depends_on: null, extra_params: [] }
        }
      }
    ]);
    editor.stop();
  });

  it('keeps Add disabled until the required part is given, says why, and says what espanso may run', () => {
    const editor = mountEditor();
    press(group(editor.target), 'browser.variableGroup.addVariable.open');
    press(addForm(editor.target), 'browser.variableKinds.kind.shell');
    expect(buttonLabelled(addForm(editor.target), sentence('browser.variableGroup.addVariable.add'))?.disabled).toBe(true);
    expect(addForm(editor.target).textContent).toContain(sentence('browser.variableKinds.problem.required', { part: 'cmd' }));
    expect(addForm(editor.target).textContent).toContain(sentence('browser.variableKinds.note.executes'));
    // `date` requires nothing: Add is enabled on a blank form.
    press(addForm(editor.target), 'browser.variableKinds.kind.date');
    expect(buttonLabelled(addForm(editor.target), sentence('browser.variableGroup.addVariable.add'))?.disabled).toBe(false);
    press(addForm(editor.target), 'browser.variableKinds.kind.clipboard');
    expect(addForm(editor.target).textContent).toContain(sentence('browser.variableKinds.note.readsClipboard'));
    expect(addForm(editor.target).querySelectorAll('[data-part]')).toHaveLength(0);
    editor.stop();
  });

  it('draws a warning beside an unfamiliar text and sends the text exactly as typed', () => {
    const editor = mountEditor();
    press(group(editor.target), 'browser.variableGroup.addVariable.open');
    press(addForm(editor.target), 'browser.variableKinds.kind.shell');
    type(partBox(editor.target, 'cmd'), 'ls');
    type(partBox(editor.target, 'shell'), 'fish');
    type(partBox(editor.target, 'debug'), 'yes');
    expect(addForm(editor.target).textContent).toContain(sentence('browser.variableKinds.warning.unfamiliarShell', { part: 'shell' }));
    expect(addForm(editor.target).textContent).toContain(sentence('browser.variableKinds.warning.notTrueOrFalse', { part: 'debug' }));
    expect(addForm(editor.target).textContent).toContain(sentence('browser.variableKinds.plainSource'));
    press(group(editor.target), 'browser.variableGroup.addVariable.add');
    press(editor.target, 'browser.matchEditor.save');
    expect(editor.saves[0]?.var_intents).toEqual([
      {
        InsertVariable: {
          at: { End: {} },
          variable: { name: 'shell', params: { Shell: { cmd: 'ls', shell: 'fish', trim: null, debug: 'yes' } }, inject_vars: null, depends_on: null, extra_params: [] }
        }
      }
    ]);
    editor.stop();
  });

  it('never takes a carriage return at edit: the box normalizes it, and a forged one is refused and put back', () => {
    const editor = mountEditor();
    press(group(editor.target), 'browser.variableGroup.addVariable.open');
    press(addForm(editor.target), 'browser.variableKinds.kind.shell');
    // A text area normalizes a pasted CRLF to LF, as WebKit does (`CLAUDE.md`
    // §6): through a real box no `\r` reaches the model at all.
    type(partBox(editor.target, 'cmd'), 'ls\r\nrm');
    expect(partBox(editor.target, 'cmd').value).toBe('ls\nrm');
    type(partBox(editor.target, 'cmd'), 'ls');
    // A box whose value does hold one — forged here by an own `value` property —
    // is refused: the box is put back to the form's text and the sentence drawn.
    const box = partBox(editor.target, 'cmd');
    let held = 'ls\rrm';
    Object.defineProperty(box, 'value', {
      configurable: true,
      get: () => held,
      set: (next: string) => {
        held = next;
      }
    });
    box.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    expect(held).toBe('ls');
    Reflect.deleteProperty(box, 'value');
    expect(addForm(editor.target).textContent).toContain(sentence('browser.variableKinds.problem.carriageReturn', { part: 'cmd' }));
    // The next accepted edit clears the sentence.
    type(partBox(editor.target, 'cmd'), 'ls -l');
    expect(addForm(editor.target).textContent).not.toContain(sentence('browser.variableKinds.problem.carriageReturn', { part: 'cmd' }));
    press(group(editor.target), 'browser.variableGroup.addVariable.add');
    press(editor.target, 'browser.matchEditor.save');
    expect(JSON.stringify(editor.saves[0]?.var_intents)).not.toContain('\\r');
    editor.stop();
  });

  it('takes an added shell variable back with one undo', () => {
    const editor = mountEditor();
    press(group(editor.target), 'browser.variableGroup.addVariable.open');
    press(addForm(editor.target), 'browser.variableKinds.kind.shell');
    type(partBox(editor.target, 'cmd'), 'date');
    press(group(editor.target), 'browser.variableGroup.addVariable.add');
    expect(chips(editor.target)).toHaveLength(4);
    press(editor.target, 'browser.matchEditor.undo');
    expect(chips(editor.target)).toHaveLength(3);
    expect(replaceBox(editor.target).value).toBe('Hello ');
    editor.stop();
  });

  it('retains a new script variable under a save conflict, and draws the recovery refusal after Keep my draft', async () => {
    const conflict = makeConflict({ disk: fileOf([projection({}, AFTER)], AFTER), expected: BASE, found: AFTER });
    const editor = mountEditor({ saves: [conflict] });
    press(group(editor.target), 'browser.variableGroup.addVariable.open');
    press(addForm(editor.target), 'browser.variableKinds.kind.script');
    type(partBox(editor.target, 'args'), 'python3\nrun.py');
    press(group(editor.target), 'browser.variableGroup.addVariable.add');
    press(editor.target, 'browser.matchEditor.save');
    await settle();
    const panel = editor.target.querySelector('.panel[role="status"]');
    const retained = [...(panel?.querySelectorAll('.shownValue') ?? [])].map((one) => one.textContent ?? '');
    expect(retained.some((one) => one.includes('script'))).toBe(true);
    expect(retained.some((one) => one.includes('run.py'))).toBe(true);
    press(editor.target, 'browser.saveOutcome.choice.keepMyDraft');
    await settle();
    expect(editor.target.textContent).toContain(sentence('browser.recovery.unavailable.variablesNotCarried'));
    expect(editor.saves).toHaveLength(1);
    editor.stop();
  });

  it('draws the kinds in Spanish', () => {
    locale.setOverride('es');
    const editor = mountEditor();
    flushSync();
    const open = buttonLabelled(group(editor.target, 'es'), DICTIONARIES.es['browser.variableGroup.addVariable.open']);
    open?.click();
    flushSync();
    const labels = [...group(editor.target, 'es').querySelectorAll('.kinds button')].map((one) => one.textContent?.trim());
    expect(labels).toEqual(
      (['echo', 'date', 'random', 'clipboard', 'shell', 'script', 'match'] as const).map(
        (kind) => DICTIONARIES.es[`browser.variableKinds.kind.${kind}`]
      )
    );
    editor.stop();
  });
}); // End of suite 8

// ---------------------------------------------------------------------------
// Suite 9 — Phase 4-14-2: an existing variable's parameters and lists
// ---------------------------------------------------------------------------

/** A block list presence of `count` items, at no location. */
const BLOCK_OF_TWO = {
  Items: {
    location: { key_node: 0, key_span: { start: 0, end: 0 }, value_node: 0, value_span: { start: 0, end: 0 }, path: null },
    flow: false,
    count: 2
  }
} as const;

/**
 * Three variables with parameters: `stamp` (a `date` with `format`, a plain
 * `offset` and `depends_on: [pick]`), `pick` (a `choice` with two values) and
 * `run` (a `shell` with `cmd`, a plain `trim` and a quoted `debug`).
 */
const PARAM_VARS: readonly VariableView[] = [
  makeVariable({
    node: 30,
    name: 'stamp',
    declaredType: 'date',
    kind: 'Date',
    params: [field('format', scalarItem('%H')), field('offset', scalarItem('0'))],
    dependsOn: [scalarItem('pick')]
  }),
  makeVariable({
    node: 31,
    name: 'pick',
    declaredType: 'choice',
    kind: 'Choice',
    params: [field('values', { Sequence: [scalarItem('alpha'), scalarItem('beta')] })],
    listParamPresence: BLOCK_OF_TWO
  }),
  makeVariable({
    node: 32,
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
 * The editor over the snippet holding {@link PARAM_VARS}.
 *
 * @param script - Whatever else the case scripts.
 * @returns The mounted editor.
 */
function mountParams(script: Script = {}): Mounted {
  return mountEditor({ match: projection({ vars: PARAM_VARS }), ...script });
} // End of function mountParams()

/**
 * The block drawing one `params` entry of the selected variable.
 *
 * @param target - Where the editor was mounted.
 * @param key - The entry's key.
 * @returns The block.
 */
function paramBlock(target: HTMLElement, key: string): HTMLElement {
  const found = group(target).querySelector(`[data-param="${key}"]`);
  if (!(found instanceof HTMLElement)) {
    throw new Error(`this case needs the parameter ${key}`);
  }
  return found;
} // End of function paramBlock()

/**
 * The block drawing one list of the selected variable.
 *
 * @param target - Where the editor was mounted.
 * @param key - The list's key (`depends_on` for the dependencies).
 * @returns The block.
 */
function listBlock(target: HTMLElement, key: string): HTMLElement {
  const found = group(target).querySelector(`[data-list="${key}"]`);
  if (!(found instanceof HTMLElement)) {
    throw new Error(`this case needs the list ${key}`);
  }
  return found;
} // End of function listBlock()

/**
 * The one box of a scalar parameter.
 *
 * @param target - Where the editor was mounted.
 * @param key - The entry's key.
 * @returns The box.
 */
function paramBox(target: HTMLElement, key: string): HTMLInputElement | HTMLTextAreaElement {
  const found = paramBlock(target, key).querySelector('input, textarea');
  if (!(found instanceof HTMLInputElement) && !(found instanceof HTMLTextAreaElement)) {
    throw new Error(`this case needs the box of ${key}`);
  }
  return found;
} // End of function paramBox()

/**
 * The item boxes of one list, in order.
 *
 * @param target - Where the editor was mounted.
 * @param key - The list's key.
 * @returns The one-line boxes.
 */
function itemBoxes(target: HTMLElement, key: string): HTMLInputElement[] {
  return [...listBlock(target, key).querySelectorAll('.listItem input')].filter(
    (one): one is HTMLInputElement => one instanceof HTMLInputElement
  );
} // End of function itemBoxes()

/**
 * The *New items* box of one list.
 *
 * @param target - Where the editor was mounted.
 * @param key - The list's key.
 * @returns The text area.
 */
function newItemsBox(target: HTMLElement, key: string): HTMLTextAreaElement {
  const found = listBlock(target, key).querySelector(`textarea[data-new-items="${key}"]`);
  if (!(found instanceof HTMLTextAreaElement)) {
    throw new Error(`this case needs the new items box of ${key}`);
  }
  return found;
} // End of function newItemsBox()

describe('9. Phase 4-14-2 — an existing variable’s parameters, list items and depends_on', () => {
  it('draws the parameters and depends_on as boxes, the typed setting as one line, and sends an edit as typed', () => {
    const editor = mountParams();
    // Not mounted until selected.
    expect(group(editor.target).querySelectorAll('[data-param]')).toHaveLength(0);
    pressChip(editor.target, 'stamp');
    expect(paramBox(editor.target, 'format')).toBeInstanceOf(HTMLTextAreaElement);
    expect(paramBox(editor.target, 'offset')).toBeInstanceOf(HTMLInputElement);
    expect(paramBox(editor.target, 'offset').value).toBe('0');
    expect(paramBlock(editor.target, 'offset').textContent).toContain(sentence('browser.variableKinds.plainSource'));
    expect(paramBlock(editor.target, 'format').textContent).not.toContain(sentence('browser.variableKinds.plainSource'));
    expect(itemBoxes(editor.target, 'depends_on').map((one) => one.value)).toEqual(['pick']);
    type(paramBox(editor.target, 'offset'), '3600');
    expect(chips(editor.target)[0]?.textContent).toContain(sentence('browser.variableGroup.status.edited'));
    press(editor.target, 'browser.matchEditor.save');
    expect(editor.saves).toHaveLength(1);
    // Exactly the JSON the Rust half writes as plain `offset: 3600`
    // (`an_existing_offset_and_trim_are_written_as_plain_source`).
    expect(editor.saves[0]?.vars).toEqual([
      expect.objectContaining({ index: 0, params: [{ index: 1, value: { Set: '3600' }, items: [] }], depends_on: [], lists: [] })
    ]);
    editor.stop();
  });

  it('says how a quoted typed setting is written and that an edit writes it plain', () => {
    const editor = mountParams();
    pressChip(editor.target, 'run');
    const debug = paramBlock(editor.target, 'debug');
    expect(paramBox(editor.target, 'debug').value).toBe('false');
    expect(debug.textContent).toContain(sentence('browser.variableGroup.quotedText'));
    expect(debug.textContent).toContain(sentence('browser.variableGroup.editWritesPlain'));
    expect(paramBlock(editor.target, 'trim').textContent).not.toContain(sentence('browser.variableGroup.editWritesPlain'));
    type(paramBox(editor.target, 'debug'), 'on');
    press(editor.target, 'browser.matchEditor.save');
    expect(editor.saves[0]?.vars).toEqual([
      expect.objectContaining({ index: 2, params: [{ index: 2, value: { Set: 'on' }, items: [] }] })
    ]);
    editor.stop();
  });

  it('edits, takes out, keeps and adds list items, and sends them as one draft', () => {
    const editor = mountParams();
    pressChip(editor.target, 'pick');
    const values = listBlock(editor.target, 'values');
    expect(itemBoxes(editor.target, 'values').map((one) => one.value)).toEqual(['alpha', 'beta']);
    type(itemBoxes(editor.target, 'values')[1]!, 'gamma');
    press(values, 'browser.variableParams.removeItem');
    // The last item kept cannot be taken out, and the list says why.
    expect(buttonLabelled(listBlock(editor.target, 'values'), sentence('browser.variableParams.removeItem'))?.disabled).toBe(true);
    expect(listBlock(editor.target, 'values').textContent).toContain(sentence('browser.variableParams.lastItem'));
    expect(listBlock(editor.target, 'values').textContent).toContain(sentence('browser.variableParams.removedItem'));
    type(newItemsBox(editor.target, 'values'), 'delta\nepsilon');
    press(listBlock(editor.target, 'values'), 'browser.variableParams.addItems');
    expect(newItemsBox(editor.target, 'values').value).toBe('');
    expect(listBlock(editor.target, 'values').textContent).toContain('epsilon');
    press(listBlock(editor.target, 'values'), 'browser.variableParams.restoreItem');
    press(listBlock(editor.target, 'values'), 'browser.variableParams.removeItem');
    press(editor.target, 'browser.matchEditor.save');
    expect(editor.saves[0]?.vars).toEqual([
      expect.objectContaining({
        index: 1,
        params: [{ index: 0, value: 'Unchanged', items: [{ index: 1, value: { Set: 'gamma' } }] }],
        lists: [
          { RemoveItem: { list: 'values', index: 0 } },
          { InsertItems: { list: 'values', at: { End: {} }, items: { Strings: ['delta', 'epsilon'] } } }
        ]
      })
    ]);
    editor.stop();
  });

  it('says why new items were not added, and drops a new item', () => {
    const editor = mountParams();
    pressChip(editor.target, 'stamp');
    type(newItemsBox(editor.target, 'depends_on'), 'a\n\nb');
    press(listBlock(editor.target, 'depends_on'), 'browser.variableParams.addItems');
    expect(listBlock(editor.target, 'depends_on').textContent).toContain(sentence('browser.variableParams.problem.emptyItem'));
    type(newItemsBox(editor.target, 'depends_on'), 'run');
    press(listBlock(editor.target, 'depends_on'), 'browser.variableParams.addItems');
    expect(listBlock(editor.target, 'depends_on').textContent).toContain(sentence('browser.variableParams.newItem'));
    press(listBlock(editor.target, 'depends_on'), 'browser.variableParams.discardItem');
    expect(listBlock(editor.target, 'depends_on').textContent).not.toContain(sentence('browser.variableParams.newItem'));
    editor.stop();
  });

  it('never takes a carriage return at edit: a forged one is refused, put back and said', () => {
    const editor = mountParams();
    pressChip(editor.target, 'run');
    const box = paramBox(editor.target, 'cmd');
    // A text area normalizes a pasted CRLF, as WebKit does (`CLAUDE.md` §6).
    type(box, 'ls\r\nrm');
    expect(box.value).toBe('ls\nrm');
    let held = 'ls\rrm';
    Object.defineProperty(box, 'value', {
      configurable: true,
      get: () => held,
      set: (next: string) => {
        held = next;
      }
    });
    box.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    expect(held).toBe('ls\nrm');
    Reflect.deleteProperty(box, 'value');
    expect(paramBlock(editor.target, 'cmd').textContent).toContain(sentence('browser.variableParams.editRefused'));
    type(paramBox(editor.target, 'cmd'), 'ls -l');
    expect(paramBlock(editor.target, 'cmd').textContent).not.toContain(sentence('browser.variableParams.editRefused'));
    press(editor.target, 'browser.matchEditor.save');
    expect(JSON.stringify(editor.saves[0]?.vars)).not.toContain('\\r');
    editor.stop();
  });

  it('takes a parameter edit back with one undo', () => {
    const editor = mountParams();
    pressChip(editor.target, 'stamp');
    type(paramBox(editor.target, 'format'), '%Y');
    press(editor.target, 'browser.matchEditor.undo');
    expect(paramBox(editor.target, 'format').value).toBe('%H');
    expect(chips(editor.target)[0]?.textContent).not.toContain(sentence('browser.variableGroup.status.edited'));
    editor.stop();
  });

  it('retains the drafted parameters under a save conflict, read-only, and draws the recovery refusal after Keep my draft', async () => {
    const conflict = makeConflict({ disk: fileOf([projection({ vars: PARAM_VARS }, AFTER)], AFTER), expected: BASE, found: AFTER });
    const editor = mountParams({ saves: [conflict] });
    pressChip(editor.target, 'pick');
    type(itemBoxes(editor.target, 'values')[0]!, 'omega');
    press(editor.target, 'browser.matchEditor.save');
    await settle();
    const panel = editor.target.querySelector('.panel[role="status"]');
    const retained = [...(panel?.querySelectorAll('.shownValue') ?? [])].map((one) => one.textContent ?? '');
    expect(retained.some((one) => one.includes('values'))).toBe(true);
    expect(retained.some((one) => one.includes('omega'))).toBe(true);
    expect(itemBoxes(editor.target, 'values').every((one) => one.readOnly)).toBe(true);
    expect(buttonLabelled(listBlock(editor.target, 'values'), sentence('browser.variableParams.addItems'))?.disabled).toBe(true);
    press(editor.target, 'browser.saveOutcome.choice.keepMyDraft');
    await settle();
    expect(editor.target.textContent).toContain(sentence('browser.recovery.unavailable.variablesNotCarried'));
    expect(editor.saves).toHaveLength(1);
    editor.stop();
  });

  it('draws the parameter controls in Spanish', () => {
    locale.setOverride('es');
    const editor = mountParams();
    flushSync();
    const chip = [...group(editor.target, 'es').querySelectorAll('button.chip')].find(
      (one) => one.querySelector('code')?.textContent === 'pick'
    );
    (chip as HTMLButtonElement | undefined)?.click();
    flushSync();
    const values = group(editor.target, 'es').querySelector('[data-list="values"]');
    expect(values?.textContent).toContain(DICTIONARIES.es['browser.variableParams.addItems']);
    expect(values?.textContent).toContain(DICTIONARIES.es['browser.variableParams.removeItem']);
    expect(group(editor.target, 'es').textContent).toContain(DICTIONARIES.es['browser.detail.field.params']);
    editor.stop();
  });

  it('review fix — pending new items never follow a position across a re-seed into another variable', async () => {
    // The file after the commit holds another choice, `other`, at position 1,
    // where `pick` was when its new items were typed.
    const other = makeVariable({
      node: 33,
      name: 'other',
      declaredType: 'choice',
      kind: 'Choice',
      params: [field('values', { Sequence: [scalarItem('x'), scalarItem('y')] })],
      listParamPresence: BLOCK_OF_TWO
    });
    const fresh = projection({ vars: [PARAM_VARS[0]!, other, PARAM_VARS[1]!, PARAM_VARS[2]!] }, AFTER);
    const editor = mountParams({ saves: [committedToAfter()], fresh });
    pressChip(editor.target, 'pick');
    type(newItemsBox(editor.target, 'values'), 'meant for pick');
    type(itemBoxes(editor.target, 'values')[0]!, 'ALPHA');
    press(editor.target, 'browser.matchEditor.save');
    await settle();
    press(editor.target, 'browser.matchEditor.reload');
    await settle();
    pressChip(editor.target, 'other');
    // The box typed over the old baseline holds nothing now, so no press can
    // send its text into `other`.
    expect(newItemsBox(editor.target, 'values').value).toBe('');
    expect(group(editor.target).textContent).not.toContain('meant for pick');
    editor.stop();
  });
}); // End of suite 9
