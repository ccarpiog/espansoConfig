/** @vitest-environment jsdom */

/**
 * Phase 3-6-2 — the small editor's trigger side and `search_terms`, mounted and
 * driven through real DOM events.
 *
 * Opts into jsdom by the docblock above and by nothing else, as every mounted
 * suite here does. `MatchEditorScalar.test.ts` pins 3-5-2-1's surfaces; this file
 * pins what 3-6-2 drew over 3-6-1's model: the list controls for `triggers` and
 * `search_terms` (add, remove and edit, never reorder), the trigger-form switch
 * with its confirmation gating the save, the `Several` and `Absent`
 * presentations with the raw-repair offer, the `wouldDropAliases` refusal with
 * its count, the Rust `RegexDoesNotCompile` finding with the draft kept, and the
 * carriage-return rule for the new controls — in both languages where the
 * wording matters.
 *
 * **Mounted evidence, never a screen.** What this proves is which elements are
 * drawn, what a press changes and what reaches the boundary. It says nothing
 * about layout, and nothing about WebKit's value normalisation; the window half
 * is 3-6-3's.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConflictSource } from '../browser/conflictSource';
import { inertVariablePort, makeMatch, makeSummary, scriptedAcknowledgement } from '../browser/fixtures';
import type { CreationBuffers } from '../browser/matchCreation';
import type { MatchBuffers } from '../browser/matchEditor';
import { rawSaveChoiceKey } from '../browser/rawSave';
import type { ConflictModel, DiskAdoptionOutcome } from '../browser/saveOutcome';
import type { SurfaceBinding } from '../browser/surfaceReceivers';
import type { MatchSaveAnswer } from '../browser/workspace.svelte';
import { DICTIONARIES, translate, type TranslationKey, type TranslationParams } from '../i18n/dictionaries';
import { LOCALES, type Locale } from '../i18n/locale';
import type {
  Acknowledgement,
  ContentRevision,
  DocumentView,
  MatchDraft,
  MatchId,
  MatchView,
  SaveResult,
  SequencePresence
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

/** The file the snippet lives in. */
const FILE = makeSummary({ id: 1, relativePath: 'match/base.yml' });

/** A location nothing slices by, for a hand-built flow presence. */
const NOWHERE = {
  key_node: 0,
  key_span: { start: 0, end: 0 },
  value_node: 0,
  value_span: { start: 0, end: 0 },
  path: null
};

beforeEach(() => {
  locale.setOverride('en');
});

afterEach(() => {
  locale.setOverride(null);
  const calls = invoked.mock.calls.length;
  invoked.mockClear();
  expect(calls).toBe(0);
});

/** A mounted editor and what a case reads back. */
interface Mounted {
  /** The element the component was mounted into. */
  readonly target: HTMLElement;
  /** Every draft the component handed to the save port, in order. */
  readonly drafts: MatchDraft[];
  /** Tears the component down. */
  readonly stop: () => void;
}

/**
 * A projection of one snippet: trigger `:a`, body `b`, plus whatever is asked.
 *
 * @param overrides - Whatever the case needs.
 * @returns The projection.
 */
function projection(overrides: Parameters<typeof makeMatch>[0] = {}): MatchView {
  return makeMatch({ revision: BASE, trigger: ':a', replace: 'b', ...overrides });
} // End of function projection()

/**
 * A snippet whose trigger is a block `triggers` list.
 *
 * @param items - The list's items.
 * @returns The projection.
 */
function listed(items: readonly string[]): MatchView {
  return projection({ trigger: null, triggers: items, triggerKind: 'Multiple' });
} // End of function listed()

/**
 * A binding whose two methods do nothing: this suite registers no receiver.
 *
 * @returns The binding.
 */
function inertBinding(): SurfaceBinding {
  return { reportTarget: () => undefined, withdraw: () => undefined };
} // End of function inertBinding()

/**
 * Mounts the editor over a boundary that records each save and answers it with
 * the next scripted result, or never answers when none is left.
 *
 * @param match - The snippet to seed from.
 * @param answers - What each successive save answers, in order.
 * @returns The mounted editor.
 */
function mountEditor(match: MatchView = projection(), answers: readonly SaveResult[] = []): Mounted {
  const drafts: MatchDraft[] = [];
  const remaining = [...answers];
  const target = document.createElement('div');
  document.body.append(target);
  const component = mount(MatchEditor, {
    target,
    props: {
      acknowledgement: scriptedAcknowledgement().port,
      match,
      file: FILE,
      documents: () => [],
      projections: (): readonly DocumentView[] => [],
      create: (): Promise<MatchSaveAnswer> => Promise.resolve({ kind: 'notAttempted' }),
      adoptRecoveryDiskVersion: (_conflict: ConflictModel<CreationBuffers>): DiskAdoptionOutcome =>
        'refused',
      clock: (): number => 0,
      save: (
        _id: MatchId,
        draft: MatchDraft,
        _base: ContentRevision,
        _acknowledgement: Acknowledgement
      ): Promise<MatchSaveAnswer> => {
        drafts.push(draft);
        const next = remaining.shift();
        return next === undefined
          ? new Promise<MatchSaveAnswer>(() => undefined)
          : Promise.resolve({ kind: 'answered', result: next, adoption: { kind: 'notOwed' } });
      },
      reproject: () => ({ kind: 'unavailable', reason: 'otherFile' }) as const,
      adoptDiskVersion: (_conflict: ConflictModel<MatchBuffers>): DiskAdoptionOutcome => 'refused',
      reportReceiver: () => inertBinding(),
      reportRecovery: inertBinding,
      variables: inertVariablePort(),
      standingConflictFor: (): ConflictSource | null => null,
      close: (): void => undefined
    }
  });
  return {
    target,
    drafts,
    stop: () => {
      void unmount(component);
      target.remove();
    }
  };
} // End of function mountEditor()

/**
 * One key's sentence in one language, with its placeholders filled.
 *
 * @param lang - The language.
 * @param key - The key.
 * @param params - Its placeholders, if any.
 * @returns The sentence.
 */
function sentence(lang: Locale, key: TranslationKey, params?: TranslationParams): string {
  return translate(lang, key, params);
} // End of function sentence()

/**
 * The block whose name is one label's sentence in one language, or `null`.
 *
 * @param target - Where the component was mounted.
 * @param key - The key holding the label.
 * @param lang - The language it is drawn in.
 * @returns The block, or `null` when none is drawn.
 */
function blockNamed(target: HTMLElement, key: TranslationKey, lang: Locale = 'en'): HTMLElement | null {
  const label = DICTIONARIES[lang][key];
  for (const element of target.querySelectorAll('.field')) {
    if (element instanceof HTMLElement && element.querySelector('.name')?.textContent?.trim() === label) {
      return element;
    }
  } // End of the loop over the editor's blocks
  return null;
} // End of function blockNamed()

/**
 * The same block, insisted upon.
 *
 * @param target - Where the component was mounted.
 * @param key - The key holding the label.
 * @param lang - The language it is drawn in.
 * @returns The block.
 */
function block(target: HTMLElement, key: TranslationKey, lang: Locale = 'en'): HTMLElement {
  const found = blockNamed(target, key, lang);
  if (found === null) {
    throw new Error(`this case needs the block named ${key}`);
  }
  return found;
} // End of function block()

/**
 * The values of every text box inside one scope, in document order.
 *
 * @param scope - Where to look.
 * @returns The values.
 */
function values(scope: HTMLElement): string[] {
  return [...scope.querySelectorAll('input')].map((one) => one.value);
} // End of function values()

/**
 * Types into one box the way a keystroke does.
 *
 * @param control - The box.
 * @param text - Its whole new value.
 */
function typeInto(control: HTMLInputElement | undefined, text: string): void {
  if (control === undefined) {
    throw new Error('this case needs the box drawn');
  }
  control.value = text;
  control.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
} // End of function typeInto()

/**
 * The button inside `scope` whose label is exactly `label`, or `null`.
 *
 * @param scope - Where to look.
 * @param label - The rendered label.
 * @returns The button, or `null`.
 */
function buttonLabelled(scope: HTMLElement, label: string): HTMLButtonElement | null {
  return [...scope.querySelectorAll('button')].find((one) => one.textContent?.trim() === label) ?? null;
} // End of function buttonLabelled()

/**
 * The button labelled with one key's sentence, insisted upon.
 *
 * @param scope - Where to look.
 * @param key - The key holding the label.
 * @param lang - The language it is drawn in.
 * @param params - The label's placeholders, if any.
 * @returns The button.
 */
function control(
  scope: HTMLElement,
  key: TranslationKey,
  lang: Locale = 'en',
  params?: TranslationParams
): HTMLButtonElement {
  const found = buttonLabelled(scope, sentence(lang, key, params));
  if (found === null) {
    throw new Error(`this case needs the control ${key}`);
  }
  return found;
} // End of function control()

/**
 * Presses the button labelled with one key's sentence.
 *
 * @param scope - Where to look.
 * @param key - The key holding the label.
 * @param lang - The language it is drawn in.
 * @param params - The label's placeholders, if any.
 */
function press(scope: HTMLElement, key: TranslationKey, lang: Locale = 'en', params?: TranslationParams): void {
  control(scope, key, lang, params).click();
  flushSync();
} // End of function press()

/**
 * Whether the rendered text contains one key's sentence.
 *
 * @param scope - Where to look.
 * @param key - The key.
 * @param lang - The language.
 * @param params - Its placeholders, if any.
 * @returns `true` when it is drawn.
 */
function says(scope: HTMLElement, key: TranslationKey, lang: Locale = 'en', params?: TranslationParams): boolean {
  return (scope.textContent ?? '').includes(sentence(lang, key, params));
} // End of function says()

/**
 * The trigger side's group, found by its heading in one language.
 *
 * @param target - Where the component was mounted.
 * @param lang - The language.
 * @returns The group.
 */
function triggerSide(target: HTMLElement, lang: Locale = 'en'): HTMLElement {
  const name = DICTIONARIES[lang]['browser.matchEditor.triggerForm.heading'];
  const found = target.querySelector(`[role="group"][aria-label="${name}"]`);
  if (!(found instanceof HTMLElement)) {
    throw new Error('the trigger side is always drawn');
  }
  return found;
} // End of function triggerSide()

/**
 * The label of one *Change to* or *Add a trigger as* control.
 *
 * @param lang - The language.
 * @param key - Which of the two.
 * @param form - The form's label key.
 * @returns The parameters `press` takes.
 */
function formParams(lang: Locale, form: TranslationKey): TranslationParams {
  return { form: DICTIONARIES[lang][form] };
} // End of function formParams()

/**
 * The save control, in whichever language the case chose.
 *
 * @param target - Where the component was mounted.
 * @returns The button.
 */
function saveButton(target: HTMLElement): HTMLButtonElement {
  for (const lang of LOCALES) {
    const found = buttonLabelled(target, sentence(lang, 'browser.matchEditor.save'));
    if (found !== null) {
      return found;
    }
  } // End of the loop over the languages
  throw new Error('the save control is always drawn');
} // End of function saveButton()

/**
 * Waits for an asynchronous handler (a save) to finish.
 */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync();
} // End of function settle()

describe('the list controls', () => {
  it.each(LOCALES)('adds search_terms, items in order, and sends the whole list (%s)', async (lang) => {
    locale.setOverride(lang);
    const editor = mountEditor();
    const terms = block(editor.target, 'browser.detail.field.searchTerms', lang);
    expect(says(terms, 'browser.matchEditor.list.absent', lang)).toBe(true);
    expect(values(terms)).toEqual([]);
    press(terms, 'browser.matchEditor.list.add', lang);

    const added = block(editor.target, 'browser.detail.field.searchTerms', lang);
    expect(says(added, 'browser.matchEditor.list.empty', lang)).toBe(true);
    expect(says(added, 'browser.matchEditor.list.absent', lang)).toBe(false);
    press(added, 'browser.matchEditor.list.addItem', lang);
    typeInto(added.querySelectorAll('input')[0], 'alpha');
    press(block(editor.target, 'browser.detail.field.searchTerms', lang), 'browser.matchEditor.list.addItem', lang);
    const twice = block(editor.target, 'browser.detail.field.searchTerms', lang);
    typeInto(twice.querySelectorAll('input')[1], 'beta');
    expect(values(twice)).toEqual(['alpha', 'beta']);
    expect(says(twice, 'browser.matchEditor.list.item.added', lang)).toBe(true);
    expect(says(twice, 'browser.matchEditor.list.item', lang, { number: 2 })).toBe(true);

    saveButton(editor.target).click();
    await settle();
    expect(editor.drafts[0]?.sequences).toEqual([
      { InsertField: { field: 'search_terms', items: ['alpha', 'beta'] } }
    ]);
    editor.stop();
  });

  it('edits, removes and adds items of a block triggers list, and offers no reorder', async () => {
    const editor = mountEditor(listed([':one', ':two', ':three']));
    const list = block(editor.target, 'browser.detail.field.triggers');
    expect(values(list)).toEqual([':one', ':two', ':three']);
    expect(says(list, 'browser.matchEditor.list.style.block')).toBe(true);
    // Every button in the list is an add or a take-out: nothing moves an item.
    const labels = new Set([...list.querySelectorAll('button')].map((one) => one.textContent?.trim()));
    expect(labels).toEqual(
      new Set([
        sentence('en', 'browser.matchEditor.list.removeItem'),
        sentence('en', 'browser.matchEditor.list.addItem')
      ])
    );

    typeInto(list.querySelectorAll('input')[1], ':TWO');
    expect(says(block(editor.target, 'browser.detail.field.triggers'), 'browser.matchEditor.list.item.edited')).toBe(
      true
    );
    const removeFirst = block(editor.target, 'browser.detail.field.triggers').querySelectorAll('button')[0];
    removeFirst?.click();
    flushSync();
    const after = block(editor.target, 'browser.detail.field.triggers');
    expect(values(after)).toEqual([':TWO', ':three']);
    expect(says(after, 'browser.matchEditor.list.removedItems')).toBe(true);
    expect(after.querySelector('.sourceText')?.textContent).toContain(':one');

    saveButton(editor.target).click();
    await settle();
    expect(editor.drafts[0]?.triggers).toEqual([{ index: 1, value: { Set: ':TWO' } }]);
    expect(editor.drafts[0]?.sequences).toEqual([{ RemoveItem: { field: 'triggers', index: 0 } }]);
    editor.stop();
  });

  it('keeps the last item, says why, and says a flow list stays in brackets', () => {
    const one = mountEditor(projection({ searchTerms: ['alpha'] }));
    const terms = block(one.target, 'browser.detail.field.searchTerms');
    expect(control(terms, 'browser.matchEditor.list.removeItem').disabled).toBe(true);
    expect(says(terms, 'browser.matchEditor.list.lastItemKept')).toBe(true);
    press(terms, 'browser.matchEditor.list.remove');
    expect(
      says(block(one.target, 'browser.detail.field.searchTerms'), 'browser.matchEditor.list.removing')
    ).toBe(true);
    one.stop();

    const match = projection({ searchTerms: ['a', 'b'] });
    const presence: SequencePresence = { Items: { location: NOWHERE, flow: true, count: 2 } };
    const flow = mountEditor({ ...match, search_terms_presence: presence });
    expect(
      says(block(flow.target, 'browser.detail.field.searchTerms'), 'browser.matchEditor.list.style.flow')
    ).toBe(true);
    flow.stop();
  });

  it('draws a list holding a carriage return through SourceText, with no box, and says why', () => {
    const editor = mountEditor(projection({ searchTerms: ['a\rb', 'c'] }));
    const terms = block(editor.target, 'browser.detail.field.searchTerms');
    expect(terms.querySelectorAll('input, textarea')).toHaveLength(0);
    expect(terms.querySelectorAll('.sourceText')).toHaveLength(2);
    expect(says(terms, 'browser.matchEditor.list.readOnly.carriageReturn')).toBe(true);
    expect(buttonLabelled(terms, sentence('en', 'browser.matchEditor.list.addItem'))).toBeNull();
    editor.stop();
  });
});

describe('review fix: a list the draft takes out', () => {
  it('shows its items without boxes, and adding it back sends nothing typed while it was out', async () => {
    const editor = mountEditor(projection({ searchTerms: ['alpha'], label: 'L' }));
    press(block(editor.target, 'browser.detail.field.searchTerms'), 'browser.matchEditor.list.remove');
    const removed = block(editor.target, 'browser.detail.field.searchTerms');
    expect(removed.querySelectorAll('input, textarea')).toHaveLength(0);
    expect(removed.querySelector('.sourceText')?.textContent).toContain('alpha');

    press(removed, 'browser.matchEditor.list.add');
    const back = block(editor.target, 'browser.detail.field.searchTerms');
    expect(values(back)).toEqual(['alpha']);
    expect(back.querySelector('input')?.readOnly).toBe(false);
    typeInto(block(editor.target, 'browser.detail.field.label').querySelector('input') ?? undefined, 'M');
    saveButton(editor.target).click();
    await settle();
    expect(editor.drafts[0]?.label).toEqual({ Set: 'M' });
    expect(editor.drafts[0]?.search_terms).toEqual([]);
    expect(editor.drafts[0]?.sequences).toEqual([]);
    editor.stop();
  });
});

describe('the trigger-form switch', () => {
  it.each(LOCALES)('previews a change to a list, withholds the save until confirmed, and sends the switch (%s)', async (lang) => {
    locale.setOverride(lang);
    const editor = mountEditor();
    const side = triggerSide(editor.target, lang);
    expect(values(block(side, 'browser.detail.field.trigger', lang))).toEqual([':a']);
    press(side, 'browser.matchEditor.triggerForm.to', lang, formParams(lang, 'browser.detail.field.triggers'));

    const drafted = triggerSide(editor.target, lang);
    // One control, the drafted form's: the list, holding the literal as its item.
    expect(blockNamed(drafted, 'browser.detail.field.trigger', lang)).toBeNull();
    expect(values(block(drafted, 'browser.detail.field.triggers', lang))).toEqual([':a']);
    expect(
      says(drafted, 'browser.matchEditor.triggerForm.previewFrom', lang, formParams(lang, 'browser.detail.field.trigger'))
    ).toBe(true);
    expect(
      says(drafted, 'browser.matchEditor.triggerForm.previewTo', lang, formParams(lang, 'browser.detail.field.triggers'))
    ).toBe(true);
    expect(says(drafted, 'browser.matchEditor.triggerForm.listHolds', lang)).toBe(true);
    expect(saveButton(editor.target).disabled).toBe(true);
    expect(says(editor.target, 'browser.matchEditor.saveWithheld.triggerFormUnconfirmed', lang)).toBe(true);

    press(drafted, 'browser.matchEditor.triggerForm.confirm', lang);
    expect(saveButton(editor.target).disabled).toBe(false);
    expect(says(editor.target, 'browser.matchEditor.triggerForm.confirmed', lang)).toBe(true);
    press(editor.target, 'browser.matchEditor.undo', lang);
    expect(saveButton(editor.target).disabled).toBe(true);
    press(editor.target, 'browser.matchEditor.redo', lang);

    saveButton(editor.target).click();
    await settle();
    expect(editor.drafts[0]?.trigger_form).toEqual({
      Switch: { switch: { ToList: { from: 'trigger', items: [':a'] } } }
    });
    editor.stop();
  });

  it('renames trigger to regex keeping the text, and cancelling gives the literal back', () => {
    const editor = mountEditor();
    press(triggerSide(editor.target), 'browser.matchEditor.triggerForm.to', 'en', formParams('en', 'browser.detail.field.regex'));
    const side = triggerSide(editor.target);
    expect(values(block(side, 'browser.detail.field.regex'))).toEqual([':a']);
    expect(says(side, 'browser.matchEditor.triggerForm.textKept')).toBe(true);
    expect(says(side, 'browser.matchEditor.regex.hint')).toBe(true);
    press(side, 'browser.matchEditor.triggerForm.cancel');
    const back = triggerSide(editor.target);
    expect(values(block(back, 'browser.detail.field.trigger'))).toEqual([':a']);
    expect(blockNamed(back, 'browser.detail.field.regex')).toBeNull();
    expect(saveButton(editor.target).disabled).toBe(true);
    editor.stop();
  });

  it.each(LOCALES)('refuses multiple→single for a longer list, by count, and never offers it (%s)', (lang) => {
    locale.setOverride(lang);
    const editor = mountEditor(listed([':one', ':two', ':three']));
    const side = triggerSide(editor.target, lang);
    for (const form of ['browser.detail.field.trigger', 'browser.detail.field.regex'] as const) {
      expect(control(side, 'browser.matchEditor.triggerForm.to', lang, formParams(lang, form)).disabled).toBe(true);
    } // End of the loop over the two scalar forms
    expect(says(side, 'browser.matchEditor.triggerForm.refused.wouldDropAliases', lang, { count: 3 })).toBe(true);
    control(side, 'browser.matchEditor.triggerForm.to', lang, formParams(lang, 'browser.detail.field.trigger')).click();
    flushSync();
    expect(values(block(triggerSide(editor.target, lang), 'browser.detail.field.triggers', lang))).toEqual([
      ':one',
      ':two',
      ':three'
    ]);
    expect(saveButton(editor.target).disabled).toBe(true);
    editor.stop();
  });
});

describe('the Several and Absent presentations', () => {
  it.each(LOCALES)('shows every form of a Several, picks none, and offers the raw repair (%s)', (lang) => {
    locale.setOverride(lang);
    const editor = mountEditor(projection({ trigger: ':sev', regex: 'sev[0-9]+', triggerKind: 'Several' }));
    const side = triggerSide(editor.target, lang);
    expect(says(side, 'browser.matchEditor.triggerForm.several', lang)).toBe(true);
    expect(says(side, 'browser.matchEditor.triggerForm.repair.rawDocument', lang)).toBe(true);
    const shown = [...side.querySelectorAll('.shownValue')].map((one) => one.textContent ?? '');
    expect(shown).toHaveLength(2);
    expect(shown[0]).toContain(':sev');
    expect(shown[1]).toContain('sev[0-9]+');
    // No winner: no box, and no choice of form.
    expect(side.querySelectorAll('input, textarea')).toHaveLength(0);
    expect(side.querySelectorAll('button')).toHaveLength(0);
    editor.stop();
  });

  it.each(LOCALES)('adds a trigger to a snippet with none, and takes the addition back (%s)', async (lang) => {
    locale.setOverride(lang);
    const editor = mountEditor(projection({ trigger: null, triggerKind: 'Absent' }));
    const side = triggerSide(editor.target, lang);
    expect(says(side, 'browser.matchEditor.triggerForm.absent', lang)).toBe(true);
    expect(side.querySelectorAll('input')).toHaveLength(0);
    press(side, 'browser.matchEditor.triggerForm.add', lang, formParams(lang, 'browser.detail.field.regex'));

    const drafted = triggerSide(editor.target, lang);
    const regex = block(drafted, 'browser.detail.field.regex', lang);
    expect(values(regex)).toEqual(['']);
    expect(says(editor.target, 'browser.matchEditor.saveWithheld.triggerFormEmpty', lang)).toBe(true);
    typeInto(regex.querySelectorAll('input')[0], '^x');
    // No confirmation is owed for an addition; the save is offered at once.
    expect(saveButton(editor.target).disabled).toBe(false);
    press(drafted, 'browser.matchEditor.triggerForm.cancelAddition', lang);
    expect(triggerSide(editor.target, lang).querySelectorAll('input')).toHaveLength(0);

    press(triggerSide(editor.target, lang), 'browser.matchEditor.triggerForm.add', lang, formParams(lang, 'browser.detail.field.trigger'));
    const literal = block(triggerSide(editor.target, lang), 'browser.detail.field.trigger', lang);
    // A blank added trigger is withheld, never said to "write nothing".
    expect(says(literal, 'browser.matchEditor.fieldAbsent', lang)).toBe(false);
    typeInto(literal.querySelectorAll('input')[0], ':new');
    saveButton(editor.target).click();
    await settle();
    expect(editor.drafts[0]?.trigger).toEqual({ Set: ':new' });
    editor.stop();
  });
});

describe('a regex that does not compile', () => {
  it.each(LOCALES)('is sent, refused by Rust’s finding, and the draft is kept (%s)', async (lang) => {
    locale.setOverride(lang);
    const refused: SaveResult = {
      outcome: 'refused',
      verdict: 'RefusedForEditorModelErrors',
      findings: [
        { code: { RegexDoesNotCompile: { detail: 'regex parse error' } }, span: null, node: null, path: null }
      ]
    };
    const editor = mountEditor(projection({ trigger: null, regex: '^a', triggerKind: 'Regex' }), [refused]);
    const regex = block(triggerSide(editor.target, lang), 'browser.detail.field.regex', lang);
    typeInto(regex.querySelectorAll('input')[0], '(unclosed');
    saveButton(editor.target).click();
    await settle();
    expect(editor.drafts[0]?.regex).toEqual({ Set: '(unclosed' });
    expect(says(editor.target, 'code.findingCode.regexDoesNotCompile', lang)).toBe(true);
    expect(values(block(triggerSide(editor.target, lang), 'browser.detail.field.regex', lang))).toEqual([
      '(unclosed'
    ]);
    // An editor-model error nobody can acknowledge: no *Save anyway*, and
    // *Keep editing* is offered.
    expect(buttonLabelled(editor.target, sentence(lang, rawSaveChoiceKey('saveAnyway', 'authoredText')))).toBeNull();
    expect(buttonLabelled(editor.target, sentence(lang, rawSaveChoiceKey('keepEditing', 'authoredText')))).not.toBeNull();
    editor.stop();
  });

  it('draws a pattern holding a carriage return through SourceText, with no box', () => {
    const editor = mountEditor(projection({ trigger: null, regex: 'a\rb', triggerKind: 'Regex' }));
    const regex = block(triggerSide(editor.target), 'browser.detail.field.regex');
    expect(regex.querySelectorAll('input, textarea')).toHaveLength(0);
    expect(regex.querySelectorAll('.sourceText')).toHaveLength(1);
    expect(says(regex, 'browser.matchEditor.readOnly.carriageReturn')).toBe(true);
    editor.stop();
  });
});
