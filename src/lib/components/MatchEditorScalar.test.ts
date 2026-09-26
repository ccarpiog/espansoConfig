/** @vitest-environment jsdom */

/**
 * Phase 3-5-2-1 — the small editor's scalar-content and option controls, mounted
 * and driven through real DOM events.
 *
 * Opts into jsdom by the docblock above and by nothing else, as every mounted
 * suite here does. `MatchEditor.test.ts` pins the editor's save, conflict and
 * recovery surfaces; this file pins what 3-5-2-1 drew over 3-5-1's model: the
 * seventeen fields in the model's control, the four option groups with the one
 * *Insertion* group, the exact-string suggestions, the content-switch preview
 * and its confirmation gating the save, the `$|$` action and its undo, and the
 * new sentences in both languages.
 *
 * **Mounted evidence, never a screen.** What this proves is which elements are
 * drawn, what a press changes and what reaches the boundary. It says nothing
 * about layout, and nothing about WebKit's value normalisation; the window half
 * is 3-5-2-2's.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConflictSource } from '../browser/conflictSource';
import { detailFieldKey, optionGroupKey } from '../browser/detail';
import { inertVariablePort, makeMatch, makeSummary, scriptedAcknowledgement } from '../browser/fixtures';
import type { CreationBuffers } from '../browser/matchCreation';
import {
  CURSOR_MARKER,
  EDITABLE_FIELDS,
  fieldControlOf,
  fieldLabelName,
  type EditableField,
  type MatchBuffers
} from '../browser/matchEditor';
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
  MatchView
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
 * A binding whose two methods do nothing: this suite registers no receiver.
 *
 * @returns The binding.
 */
function inertBinding(): SurfaceBinding {
  return { reportTarget: () => undefined, withdraw: () => undefined };
} // End of function inertBinding()

/**
 * Mounts the editor over a boundary that records each save and never answers it,
 * so a case can read the sent draft without driving an outcome.
 *
 * @param match - The snippet to seed from.
 * @returns The mounted editor.
 */
function mountEditor(match: MatchView = projection()): Mounted {
  const drafts: MatchDraft[] = [];
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
        return new Promise<MatchSaveAnswer>(() => undefined);
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
 * The block of markup one field owns, found by its drawn label.
 *
 * @param target - Where the component was mounted.
 * @param field - Which field.
 * @param lang - The language the label is drawn in.
 * @returns That field's block.
 */
function blockOf(target: HTMLElement, field: EditableField, lang: Locale = 'en'): HTMLElement {
  const label = DICTIONARIES[lang][detailFieldKey(fieldLabelName(field))];
  for (const element of target.querySelectorAll('.field')) {
    if (element instanceof HTMLElement && element.querySelector('.name')?.textContent?.trim() === label) {
      return element;
    }
  } // End of the loop over the editor's field blocks
  throw new Error(`this editor draws no block for ${field}`);
} // End of function blockOf()

/**
 * The text control one field's block holds.
 *
 * @param target - Where the component was mounted.
 * @param field - Which field.
 * @param lang - The language the label is drawn in.
 * @returns The control.
 */
function box(
  target: HTMLElement,
  field: EditableField,
  lang: Locale = 'en'
): HTMLInputElement | HTMLTextAreaElement {
  const found = blockOf(target, field, lang).querySelector('input, textarea');
  if (!(found instanceof HTMLInputElement || found instanceof HTMLTextAreaElement)) {
    throw new Error(`this case needs ${field} drawn as a control`);
  }
  return found;
} // End of function box()

/**
 * Types into one field the way a keystroke does.
 *
 * @param target - Where the component was mounted.
 * @param field - Which field.
 * @param text - The control's whole new value.
 */
function type(target: HTMLElement, field: EditableField, text: string): void {
  const control = box(target, field);
  control.value = text;
  control.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
} // End of function type()

/**
 * The button inside `scope` whose label is exactly `label`, or `null`.
 *
 * @param scope - Where to look.
 * @param label - The rendered label.
 * @returns The button, or `null`.
 */
function buttonLabelled(scope: HTMLElement, label: string): HTMLButtonElement | null {
  return (
    [...scope.querySelectorAll('button')].find((one) => one.textContent?.trim() === label) ?? null
  );
} // End of function buttonLabelled()

/**
 * Presses the button labelled with one key's sentence, insisting it is drawn.
 *
 * @param scope - Where to look.
 * @param key - The key holding the label.
 * @param lang - The language it is drawn in.
 * @param params - The label's placeholders, if any.
 */
function press(
  scope: HTMLElement,
  key: TranslationKey,
  lang: Locale = 'en',
  params?: TranslationParams
): void {
  const found = buttonLabelled(scope, sentence(lang, key, params));
  if (found === null) {
    throw new Error(`this case needs the control ${key}`);
  }
  found.click();
  flushSync();
} // End of function press()

/**
 * The save control, in English.
 *
 * @param target - Where the component was mounted.
 * @returns The button.
 */
function saveButton(target: HTMLElement): HTMLButtonElement {
  const found = buttonLabelled(target, sentence('en', 'browser.matchEditor.save'));
  if (found === null) {
    throw new Error('the save control is always drawn');
  }
  return found;
} // End of function saveButton()

/**
 * Whether the rendered text contains one sentence.
 *
 * @param target - Where the component was mounted.
 * @param text - The sentence.
 * @returns `true` when it is drawn.
 */
function shows(target: HTMLElement, text: string): boolean {
  return (target.textContent ?? '').includes(text);
} // End of function shows()

/**
 * Waits for an asynchronous handler (a `tick`, a save) to finish.
 */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync();
} // End of function settle()

/** The label of the change-to control for one content key, in one language. */
const changeTo = (lang: Locale, field: EditableField): string =>
  sentence(lang, 'browser.matchEditor.switch.to', {
    kind: DICTIONARIES[lang][detailFieldKey(fieldLabelName(field))]
  });

describe('the seventeen fields and the option groups', () => {
  it('draws every field in the model’s control, and no checkbox anywhere', () => {
    const editor = mountEditor(projection({ options: { word: 'true', force_clipboard: 'on' } }));
    for (const field of EDITABLE_FIELDS) {
      const control = box(editor.target, field);
      const expected = fieldControlOf(field) === 'multiLine' ? 'TEXTAREA' : 'INPUT';
      expect(control.tagName, field).toBe(expected);
      if (control instanceof HTMLInputElement) {
        expect(control.type, field).toBe('text');
      }
    } // End of the loop over the seventeen fields
    expect(editor.target.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect(editor.target.querySelectorAll('input:not([type="text"])')).toHaveLength(0);
    editor.stop();
  });

  it.each(LOCALES)('draws the four option groups, with force_mode and force_clipboard as two labelled boxes under Insertion (%s)', (lang) => {
    locale.setOverride(lang);
    const editor = mountEditor(projection({ options: { force_mode: 'clipboard', force_clipboard: 'true' } }));
    const groups = [...editor.target.querySelectorAll('[role="group"]')].map((one) =>
      one.getAttribute('aria-label')
    );
    for (const name of ['matching', 'case', 'injection', 'other'] as const) {
      expect(groups, name).toContain(DICTIONARIES[lang][optionGroupKey(name)]);
    } // End of the loop over the four option groups
    const insertion = editor.target.querySelector(
      `[role="group"][aria-label="${DICTIONARIES[lang][optionGroupKey('injection')]}"]`
    );
    if (!(insertion instanceof HTMLElement)) {
      throw new Error('the Insertion group is drawn');
    }
    const labels = [...insertion.querySelectorAll('.field .name')].map((one) => one.textContent?.trim());
    expect(labels).toEqual([
      DICTIONARIES[lang][detailFieldKey('forceMode')],
      DICTIONARIES[lang][detailFieldKey('forceClipboard')]
    ]);
    const boxes = [...insertion.querySelectorAll('input')];
    expect(boxes.map((one) => [one.type, one.value])).toEqual([
      ['text', 'clipboard'],
      ['text', 'true']
    ]);
    editor.stop();
  });

  it('offers exact-string suggestions, keeps an unfamiliar value as written, and sends the text', async () => {
    const editor = mountEditor(projection({ options: { force_mode: 'Keys' } }));
    const block = blockOf(editor.target, 'force_mode');
    const unfamiliar = sentence('en', 'browser.matchEditor.suggestions.unfamiliar');
    expect(box(editor.target, 'force_mode').value).toBe('Keys');
    expect(shows(block, unfamiliar)).toBe(true);
    expect(
      [...block.querySelectorAll('.suggestions button')].map((one) => one.textContent?.trim())
    ).toEqual(['clipboard', 'keys']);
    // No other field but uppercase_style offers any.
    expect(editor.target.querySelectorAll('.suggestions')).toHaveLength(2);
    buttonLabelled(block, 'keys')?.click();
    flushSync();
    expect(box(editor.target, 'force_mode').value).toBe('keys');
    expect(shows(blockOf(editor.target, 'force_mode'), unfamiliar)).toBe(false);
    saveButton(editor.target).click();
    await settle();
    expect(editor.drafts[0]?.force_mode).toEqual({ Set: 'keys' });
    expect(editor.drafts[0]?.force_clipboard).toBe('Unchanged');
    editor.stop();
  });
});

describe('the change of content kind', () => {
  it('draws the preview, withholds the save until confirmed, and undo takes the confirmation back', async () => {
    const editor = mountEditor(projection({ replace: 'Regards', options: { paragraph: 'true' } }));
    expect(saveButton(editor.target).disabled).toBe(true);
    const offer = buttonLabelled(editor.target, changeTo('en', 'markdown'));
    expect(offer).not.toBeNull();
    offer?.click();
    flushSync();

    // The preview: what is renamed, the text kept, the companion kept.
    expect(
      shows(
        editor.target,
        sentence('en', 'browser.matchEditor.switch.preview', {
          from: DICTIONARIES.en[detailFieldKey('replace')],
          to: DICTIONARIES.en[detailFieldKey('markdown')]
        })
      )
    ).toBe(true);
    expect(shows(editor.target, sentence('en', 'browser.matchEditor.switch.textKept'))).toBe(true);
    const preview = editor.target.querySelector('.preview');
    expect([...(preview?.querySelectorAll('code') ?? [])].map((one) => one.textContent)).toEqual([
      'paragraph'
    ]);
    // The drafted target's own control does nothing, so it is disabled.
    expect(buttonLabelled(editor.target, changeTo('en', 'markdown'))?.disabled).toBe(true);
    expect(box(editor.target, 'markdown').value).toBe('Regards');
    expect(box(editor.target, 'replace').readOnly).toBe(true);

    // Unconfirmed: unsaveable, and the sentence says why.
    const withheld = sentence('en', 'browser.matchEditor.saveWithheld.contentSwitchUnconfirmed');
    expect(saveButton(editor.target).disabled).toBe(true);
    expect(shows(editor.target, withheld)).toBe(true);

    press(editor.target, 'browser.matchEditor.switch.confirm');
    expect(saveButton(editor.target).disabled).toBe(false);
    expect(shows(editor.target, withheld)).toBe(false);
    expect(shows(editor.target, sentence('en', 'browser.matchEditor.switch.confirmed'))).toBe(true);

    press(editor.target, 'browser.matchEditor.undo');
    expect(saveButton(editor.target).disabled).toBe(true);
    expect(buttonLabelled(editor.target, sentence('en', 'browser.matchEditor.switch.confirm'))).not.toBeNull();

    press(editor.target, 'browser.matchEditor.redo');
    saveButton(editor.target).click();
    await settle();
    expect(editor.drafts).toHaveLength(1);
    expect(editor.drafts[0]?.content_switch).toEqual({ from: 'replace', to: 'markdown' });
    expect(editor.drafts[0]?.markdown).toBe('Unchanged');
    expect(editor.drafts[0]?.paragraph).toBe('Unchanged');
    editor.stop();
  });

  it('says the text was edited, and cancelling gives the text back to the source box', () => {
    const editor = mountEditor();
    buttonLabelled(editor.target, changeTo('en', 'html'))?.click();
    flushSync();
    type(editor.target, 'html', '<b>b</b>');
    expect(shows(editor.target, sentence('en', 'browser.matchEditor.switch.textEdited'))).toBe(true);
    expect(shows(editor.target, sentence('en', 'browser.matchEditor.switch.noCompanions'))).toBe(true);
    press(editor.target, 'browser.matchEditor.switch.cancel');
    expect(editor.target.querySelector('.preview')).toBeNull();
    expect(box(editor.target, 'replace').value).toBe('<b>b</b>');
    expect(box(editor.target, 'replace').readOnly).toBe(false);
    editor.stop();
  });

  it.each(LOCALES)('promises only that the switch removes no companion, and a drafted companion edit is sent (review fix, %s)', async (lang) => {
    locale.setOverride(lang);
    const editor = mountEditor(projection({ options: { paragraph: 'true' } }));
    buttonLabelled(editor.target, changeTo(lang, 'markdown'))?.click();
    flushSync();
    press(editor.target, 'browser.matchEditor.switch.confirm', lang);
    const paragraph = box(editor.target, 'paragraph', lang);
    paragraph.value = 'false';
    paragraph.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    // The sentence over the list is the corrected one, and it does not claim the
    // companion is unchanged — the edit is what the save sends.
    expect(shows(editor.target, sentence(lang, 'browser.matchEditor.switch.companionsKept'))).toBe(true);
    expect([...(editor.target.querySelector('.preview')?.querySelectorAll('code') ?? [])].map((one) => one.textContent)).toEqual(['paragraph']);
    const save = buttonLabelled(editor.target, sentence(lang, 'browser.matchEditor.save'));
    expect(save?.disabled).toBe(false);
    save?.click();
    await settle();
    expect(editor.drafts[0]?.content_switch).toEqual({ from: 'replace', to: 'markdown' });
    expect(editor.drafts[0]?.paragraph).toEqual({ Set: 'false' });
    editor.stop();
  });

  it('offers no change of kind for a snippet holding two content keys', () => {
    const editor = mountEditor(projection({ markdown: 'm' }));
    expect(buttonLabelled(editor.target, changeTo('en', 'html'))).toBeNull();
    expect(shows(editor.target, sentence('en', 'browser.matchEditor.switch.heading'))).toBe(false);
    editor.stop();
  });

  it.each(LOCALES)('draws the role notes, the preview and the withheld save in the chosen language (%s)', (lang) => {
    locale.setOverride(lang);
    const editor = mountEditor();
    const dormant = sentence(lang, 'browser.matchEditor.contentRole.dormant');
    expect(shows(blockOf(editor.target, 'markdown', lang), dormant)).toBe(true);
    expect(
      shows(blockOf(editor.target, 'markdown', lang), sentence(lang, 'browser.matchEditor.fieldAbsent'))
    ).toBe(false);
    buttonLabelled(editor.target, changeTo(lang, 'markdown'))?.click();
    flushSync();
    expect(
      shows(blockOf(editor.target, 'replace', lang), sentence(lang, 'browser.matchEditor.contentRole.switchedAway'))
    ).toBe(true);
    expect(
      shows(blockOf(editor.target, 'markdown', lang), sentence(lang, 'browser.matchEditor.contentRole.switchTarget'))
    ).toBe(true);
    expect(
      shows(
        editor.target,
        sentence(lang, 'browser.matchEditor.switch.preview', {
          from: DICTIONARIES[lang][detailFieldKey('replace')],
          to: DICTIONARIES[lang][detailFieldKey('markdown')]
        })
      )
    ).toBe(true);
    expect(
      shows(editor.target, sentence(lang, 'browser.matchEditor.saveWithheld.contentSwitchUnconfirmed'))
    ).toBe(true);
    press(editor.target, 'browser.matchEditor.switch.confirm', lang);
    expect(shows(editor.target, sentence(lang, 'browser.matchEditor.switch.confirmed'))).toBe(true);
    editor.stop();
  });
});

describe('the cursor action', () => {
  it('inserts one marker at the selection, selects it, and undo takes it back', async () => {
    const editor = mountEditor(projection({ replace: 'hello' }));
    const body = box(editor.target, 'replace') as HTMLTextAreaElement;
    body.setSelectionRange(2, 4);
    press(blockOf(editor.target, 'replace'), 'browser.matchEditor.cursor.insert');
    await settle();
    expect(body.value).toBe(`he${CURSOR_MARKER}o`);
    expect([body.selectionStart, body.selectionEnd]).toEqual([2, 2 + CURSOR_MARKER.length]);
    press(editor.target, 'browser.matchEditor.undo');
    expect(box(editor.target, 'replace').value).toBe('hello');
    editor.stop();
  });

  it('selects the one marker already there and changes nothing', async () => {
    const editor = mountEditor(projection({ replace: `ab${CURSOR_MARKER}cd` }));
    const body = box(editor.target, 'replace') as HTMLTextAreaElement;
    body.setSelectionRange(0, 0);
    press(blockOf(editor.target, 'replace'), 'browser.matchEditor.cursor.insert');
    await settle();
    expect(body.value).toBe(`ab${CURSOR_MARKER}cd`);
    expect([body.selectionStart, body.selectionEnd]).toEqual([2, 5]);
    expect(saveButton(editor.target).disabled).toBe(true);
    editor.stop();
  });

  it.each(LOCALES)('draws the several-markers advisory with its count, and changes nothing (%s)', async (lang) => {
    locale.setOverride(lang);
    const text = `a${CURSOR_MARKER}b${CURSOR_MARKER}c${CURSOR_MARKER}`;
    const editor = mountEditor(projection({ replace: text }));
    const advisory = sentence(lang, 'browser.matchEditor.cursor.severalMarkers', { count: 3 });
    expect(shows(editor.target, advisory)).toBe(false);
    press(blockOf(editor.target, 'replace', lang), 'browser.matchEditor.cursor.insert', lang);
    await settle();
    expect(shows(editor.target, advisory)).toBe(true);
    expect(box(editor.target, 'replace', lang).value).toBe(text);
    // Any change to the draft replaces the session, and the advisory goes with it.
    const body = box(editor.target, 'replace', lang);
    body.value = 'x';
    body.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    expect(shows(editor.target, advisory)).toBe(false);
    editor.stop();
  });

  it('is drawn for replace only, and not once a switch renames replace away', () => {
    const label = sentence('en', 'browser.matchEditor.cursor.insert');
    const markdown = mountEditor(projection({ replace: null, markdown: 'm' }));
    expect(buttonLabelled(markdown.target, label)).toBeNull();
    markdown.stop();

    const editor = mountEditor();
    const holders = EDITABLE_FIELDS.filter(
      (field) => buttonLabelled(blockOf(editor.target, field), label) !== null
    );
    expect(holders).toEqual(['replace']);
    buttonLabelled(editor.target, changeTo('en', 'markdown'))?.click();
    flushSync();
    expect(buttonLabelled(editor.target, label)).toBeNull();
    editor.stop();
  });
});
