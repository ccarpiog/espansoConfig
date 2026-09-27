/** @vitest-environment jsdom */

/**
 * Phase 4-22 — the regex bench (`RegexBench.svelte`) and the *Regex capture*
 * `+ Insert` row of `VariableGroup.svelte`, mounted inside the small editor and
 * driven through real DOM events.
 *
 * Opts into jsdom by the docblock above and by nothing else. One `describe` per
 * acceptance clause of step 4-22 (`docs/decisions/4-split-notes.md` §2):
 *
 * 1. out-of-order `test_regex` replies are ignored;
 * 2. the captures shown and offered are the current pattern's;
 * 3. the `+ Insert` row is shown only for a current, compiling regex trigger,
 *    and inserts `{{name}}` without creating a variable;
 * 4. the compatibility sentence is drawn in English and in Spanish.
 *
 * **Mounted evidence, never a screen** (Phase 4 ruling 29): this proves which
 * elements jsdom holds and what reached the injected reader and the save
 * port — nothing about layout or WebKit. The window half is step 4-23's. Every
 * `test_regex` answer here is scripted: no pattern is compiled in this suite,
 * so nothing here says what Rust's `regex` accepts.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do. Every fixture is hand-authored and neutral (`CLAUDE.md` §1).
 */

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConflictSource } from '../browser/conflictSource';
import {
  inertPreviewCommands,
  inertVariablePort,
  makeMatch,
  makeSummary,
  scriptedAcknowledgement
} from '../browser/fixtures';
import type { CreationBuffers } from '../browser/matchCreation';
import type { MatchBuffers } from '../browser/matchEditor';
import type { RegexBenchCommands } from '../browser/regexBench';
import type { ConflictModel, DiskAdoptionOutcome } from '../browser/saveOutcome';
import type { SurfaceBinding } from '../browser/surfaceReceivers';
import type { MatchSaveAnswer } from '../browser/workspace.svelte';
import { DICTIONARIES, translate, type TranslationKey, type TranslationParams } from '../i18n/dictionaries';
import { LOCALES, type Locale } from '../i18n/locale';
import type { CommandResult } from '../ipc/commands';
import type {
  Acknowledgement,
  ContentRevision,
  DocumentView,
  MatchDraft,
  MatchId,
  MatchView,
  RegexBenchAnswer,
  RegexOutcome,
  SaveResult
} from '../ipc/types';
import { locale } from '../stores/locale.svelte';
import MatchEditor from './MatchEditor.svelte';

/**
 * Every call that reaches `@tauri-apps/api/core`'s `invoke`: none should, since
 * the bench's reader is a fake, and the file-level `afterEach` fails a case
 * that made one.
 */
const { invoked } = vi.hoisted(() => ({ invoked: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: readonly unknown[]): Promise<never> => {
    invoked(...args);
    return Promise.reject(new Error('this suite invokes no command'));
  }
}));

/** The revision every projection is minted from. */
const BASE: ContentRevision = 'a'.repeat(64);

/** The file the snippet lives in. */
const FILE = makeSummary({ id: 1, relativePath: 'match/base.yml' });

/** The engine every scripted answer names. */
const ENGINE = Object.freeze({ name: 'regex', version: '1.13.1' });

beforeEach(() => {
  locale.setOverride('en');
});

afterEach(() => {
  locale.setOverride(null);
  const calls = invoked.mock.calls.length;
  invoked.mockClear();
  expect(calls).toBe(0);
});

/** One call the fake reader received, with the hand that answers it. */
interface BenchCall {
  /** The request's number. */
  readonly requestId: number;
  /** The pattern sent. */
  readonly pattern: string;
  /** The sample sent. */
  readonly sample: string;
  /**
   * Answers the call with an outcome, echoing `echo` (the call's own number
   * unless a case says otherwise).
   */
  readonly answer: (outcome: RegexOutcome, echo?: number) => void;
}

/** A fake `test_regex` whose every call waits for its case to answer it. */
interface FakeBench {
  /** The reader handed to the editor. */
  readonly commands: RegexBenchCommands;
  /** Every call, in order. */
  readonly calls: BenchCall[];
}

/**
 * Builds the fake reader.
 *
 * @returns The fake.
 */
function fakeBench(): FakeBench {
  const calls: BenchCall[] = [];
  const commands: RegexBenchCommands = {
    testRegex: (requestId, pattern, sample) =>
      new Promise<CommandResult<RegexBenchAnswer>>((resolve) => {
        calls.push({
          requestId,
          pattern,
          sample,
          answer: (outcome, echo = requestId) =>
            resolve({ ok: true, value: { request_id: echo, engine: ENGINE, outcome } })
        });
      })
  };
  return { commands, calls };
} // End of function fakeBench()

/**
 * A `Tested` outcome with a match.
 *
 * @param whole - The whole match's text (positions are not drawn).
 * @param groups - Each named group and what it captured, or `null`.
 * @returns The outcome.
 */
function found(whole: string, groups: readonly (readonly [string, string | null])[]): RegexOutcome {
  const span = (text: string) => ({ text, utf16_start: 0, utf16_end: text.length });
  return {
    Tested: {
      group_names: groups.map(([name]) => name),
      found: {
        whole: span(whole),
        groups: groups.map(([name, text]) => ({ name, capture: text === null ? null : span(text) }))
      }
    }
  };
} // End of function found()

/**
 * A `Tested` outcome with no match.
 *
 * @param names - The pattern's named groups.
 * @returns The outcome.
 */
function notFound(names: readonly string[]): RegexOutcome {
  return { Tested: { group_names: names, found: null } };
} // End of function notFound()

/** A compile refusal. */
const COMPILE_REJECTED: RegexOutcome = { Refused: { refusal: { CompileRejected: { reason: 'Syntax' } } } };

/** A mounted editor and what a case reads back. */
interface Mounted {
  /** The element the component was mounted into. */
  readonly target: HTMLElement;
  /** Every draft handed to the save port, in order. */
  readonly drafts: MatchDraft[];
  /** Tears the component down. */
  readonly stop: () => void;
}

/**
 * A projection: a regex trigger (or whatever is asked) and body `b`.
 *
 * @param overrides - Whatever the case needs.
 * @returns The projection.
 */
function projection(overrides: Parameters<typeof makeMatch>[0] = {}): MatchView {
  return makeMatch({ revision: BASE, trigger: null, regex: '(?P<alpha>a)', triggerKind: 'Regex', replace: 'b', ...overrides });
} // End of function projection()

/**
 * A binding whose two methods do nothing.
 *
 * @returns The binding.
 */
function inertBinding(): SurfaceBinding {
  return { reportTarget: () => undefined, withdraw: () => undefined };
} // End of function inertBinding()

/**
 * Mounts the editor over the fake reader; a save is recorded and answered with
 * the next scripted result, or never.
 *
 * @param bench - The fake reader.
 * @param match - The snippet.
 * @param answers - What each save answers.
 * @returns The mounted editor.
 */
function mountEditor(bench: FakeBench, match: MatchView = projection(), answers: readonly SaveResult[] = []): Mounted {
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
      adoptRecoveryDiskVersion: (_conflict: ConflictModel<CreationBuffers>): DiskAdoptionOutcome => 'refused',
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
      previewCommands: inertPreviewCommands(),
      regexBenchCommands: bench.commands,
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
 * One key's sentence in one language.
 *
 * @param lang - The language.
 * @param key - The key.
 * @param params - Its placeholders.
 * @returns The sentence.
 */
function sentence(lang: Locale, key: TranslationKey, params?: TranslationParams): string {
  return translate(lang, key, params);
} // End of function sentence()

/**
 * Whether the rendered text contains one key's sentence.
 *
 * @param scope - Where to look.
 * @param key - The key.
 * @param lang - The language.
 * @param params - Its placeholders.
 * @returns `true` when drawn.
 */
function says(scope: HTMLElement, key: TranslationKey, lang: Locale = 'en', params?: TranslationParams): boolean {
  return (scope.textContent ?? '').includes(sentence(lang, key, params));
} // End of function says()

/**
 * The bench's section, or `null` when none is drawn.
 *
 * @param target - Where the editor was mounted.
 * @param lang - The language.
 * @returns The section.
 */
function benchOf(target: HTMLElement, lang: Locale = 'en'): HTMLElement | null {
  const found = target.querySelector(`section[aria-label="${DICTIONARIES[lang]['browser.regexBench.heading']}"]`);
  return found instanceof HTMLElement ? found : null;
} // End of function benchOf()

/**
 * The bench, insisted upon.
 *
 * @param target - Where the editor was mounted.
 * @param lang - The language.
 * @returns The section.
 */
function bench(target: HTMLElement, lang: Locale = 'en'): HTMLElement {
  const found = benchOf(target, lang);
  if (found === null) {
    throw new Error('this case needs the bench drawn');
  }
  return found;
} // End of function bench()

/**
 * Types into a box the way a keystroke does.
 *
 * @param control - The box.
 * @param text - Its whole new value.
 */
function typeInto(control: Element | null | undefined, text: string): void {
  if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)) {
    throw new Error('this case needs the box drawn');
  }
  control.value = text;
  control.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
} // End of function typeInto()

/**
 * Types a sample and presses *Test*.
 *
 * @param target - Where the editor was mounted.
 * @param sample - The sample.
 * @param lang - The language.
 */
function testWith(target: HTMLElement, sample: string, lang: Locale = 'en'): void {
  const section = bench(target, lang);
  typeInto(section.querySelector('textarea[data-bench-sample]'), sample);
  const button = section.querySelector('button[data-bench-action="test"]');
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error('the bench always draws Test');
  }
  button.click();
  flushSync();
} // End of function testWith()

/**
 * Types into the editor's regex box.
 *
 * @param target - Where the editor was mounted.
 * @param text - The pattern.
 */
function typeRegex(target: HTMLElement, text: string): void {
  const label = DICTIONARIES.en['browser.detail.field.regex'];
  const box = [...target.querySelectorAll('.field')]
    .find((one) => one.querySelector('.name')?.textContent?.trim() === label)
    ?.querySelector('input');
  typeInto(box, text);
} // End of function typeRegex()

/**
 * The *Regex capture* row's button, or `null`.
 *
 * @param target - Where the editor was mounted.
 * @returns The button.
 */
function captureRow(target: HTMLElement): HTMLButtonElement | null {
  const found = target.querySelector('button[data-row="capture"]');
  return found instanceof HTMLButtonElement ? found : null;
} // End of function captureRow()

/**
 * Opens the row's panel and answers the names it offers to insert.
 *
 * @param target - Where the editor was mounted.
 * @returns The names on the panel's *Insert* buttons.
 */
function openCaptures(target: HTMLElement): string[] {
  const row = captureRow(target);
  if (row === null) {
    throw new Error('this case needs the Regex capture row');
  }
  row.click();
  flushSync();
  return [...target.querySelectorAll('button[data-capture]')].map((one) => one.getAttribute('data-capture') ?? '');
} // End of function openCaptures()

/**
 * Lets pending promises settle and the component redraw.
 */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync();
} // End of function settle()

describe('out-of-order test_regex replies', () => {
  it.each(LOCALES)('an earlier reply arriving after a later one is ignored (%s)', async (lang) => {
    locale.setOverride(lang);
    const fake = fakeBench();
    const editor = mountEditor(fake);
    testWith(editor.target, 'first', lang);
    testWith(editor.target, 'second', lang);
    expect(fake.calls.map((call) => [call.requestId, call.pattern, call.sample])).toEqual([
      [1, '(?P<alpha>a)', 'first'],
      [2, '(?P<alpha>a)', 'second']
    ]);
    fake.calls[1]?.answer(found('LATER', [['alpha', 'LATER']]));
    await settle();
    fake.calls[0]?.answer(found('EARLIER', [['alpha', 'EARLIER']]));
    await settle();
    const section = bench(editor.target, lang);
    expect(section.textContent).toContain('LATER');
    expect(section.textContent).not.toContain('EARLIER');
    expect(section.querySelector('[data-bench-notice="behind"]')).toBeNull();
    expect(section.querySelector('[data-bench-notice="pending"]')).toBeNull();
    editor.stop();
  });

  it('a reply echoing another request is not drawn as the answer', async () => {
    const fake = fakeBench();
    const editor = mountEditor(fake);
    testWith(editor.target, 'sample');
    fake.calls[0]?.answer(found('STRAY', [['alpha', 'STRAY']]), 99);
    await settle();
    const section = bench(editor.target);
    expect(section.textContent).not.toContain('STRAY');
    expect(says(section, 'browser.regexBench.wrongRequest')).toBe(true);
    expect(captureRow(editor.target)).toBeNull();
    editor.stop();
  });

  it('a late reply for an old pattern brings back neither its result nor its captures', async () => {
    const fake = fakeBench();
    const editor = mountEditor(fake);
    testWith(editor.target, 'sample');
    typeRegex(editor.target, '(?P<beta>b)');
    testWith(editor.target, 'sample');
    fake.calls[1]?.answer(notFound(['beta']));
    await settle();
    fake.calls[0]?.answer(found('a', [['alpha', 'a']]));
    await settle();
    expect(openCaptures(editor.target)).toEqual(['beta']);
    editor.stop();
  });
});

describe('captures come from the current pattern', () => {
  it('an edit of the regex withdraws the row until the new pattern is tested, then offers its groups only', async () => {
    const fake = fakeBench();
    const editor = mountEditor(fake);
    testWith(editor.target, 'a');
    fake.calls[0]?.answer(found('a', [['alpha', 'a']]));
    await settle();
    expect(openCaptures(editor.target)).toEqual(['alpha']);

    typeRegex(editor.target, '(?P<beta>b)(?P<gamma>c)?');
    expect(captureRow(editor.target)).toBeNull();
    expect(editor.target.querySelector('button[data-capture]')).toBeNull();
    expect(says(bench(editor.target), 'browser.regexBench.behind')).toBe(true);

    testWith(editor.target, 'b');
    expect(fake.calls[1]?.pattern).toBe('(?P<beta>b)(?P<gamma>c)?');
    fake.calls[1]?.answer(found('b', [['beta', 'b'], ['gamma', null]]));
    await settle();
    expect(openCaptures(editor.target)).toEqual(['beta', 'gamma']);
    const section = bench(editor.target);
    expect(section.querySelector('[data-bench-group="alpha"]')).toBeNull();
    expect(section.querySelector('[data-bench-group="gamma"]')?.textContent).toContain(
      sentence('en', 'browser.regexBench.groupUnmatched')
    );
    editor.stop();
  });

  it('a sample that does not match keeps the pattern’s captures insertable', async () => {
    const fake = fakeBench();
    const editor = mountEditor(fake);
    testWith(editor.target, 'zzz');
    fake.calls[0]?.answer(notFound(['alpha']));
    await settle();
    expect(says(bench(editor.target), 'browser.regexBench.notFound')).toBe(true);
    expect(openCaptures(editor.target)).toEqual(['alpha']);
    editor.stop();
  });

  it('a name outside the supported subset is listed but has no Insert', async () => {
    const fake = fakeBench();
    const editor = mountEditor(fake);
    testWith(editor.target, 'x');
    fake.calls[0]?.answer(notFound(['año', 'plain']));
    await settle();
    expect(openCaptures(editor.target)).toEqual(['plain']);
    expect(editor.target.querySelector('[data-capture-refused="año"]')).not.toBeNull();
    editor.stop();
  });
});

describe('the Regex capture row', () => {
  it('is not drawn for a literal trigger, which has no bench', () => {
    const fake = fakeBench();
    const editor = mountEditor(fake, projection({ trigger: ':a', regex: null, triggerKind: 'Single' }));
    expect(benchOf(editor.target)).toBeNull();
    expect(captureRow(editor.target)).toBeNull();
    editor.stop();
  });

  it('is not drawn before the regex is tested, nor while the only test is out', () => {
    const fake = fakeBench();
    const editor = mountEditor(fake);
    expect(captureRow(editor.target)).toBeNull();
    testWith(editor.target, 'a');
    expect(captureRow(editor.target)).toBeNull();
    expect(fake.calls).toHaveLength(1);
    editor.stop();
  });

  it.each([
    ['a compile refusal', COMPILE_REJECTED],
    ['a pattern too large', { Refused: { refusal: 'PatternTooLarge' } } as RegexOutcome],
    ['an output too large', { Refused: { refusal: 'OutputLimit' } } as RegexOutcome]
  ])('is not drawn after %s', async (_label, outcome) => {
    const fake = fakeBench();
    const editor = mountEditor(fake);
    testWith(editor.target, 'a');
    fake.calls[0]?.answer(outcome);
    await settle();
    expect(captureRow(editor.target)).toBeNull();
    editor.stop();
  });

  it('draws a compile refusal and its reason in the bench, distinct from no match', async () => {
    const fake = fakeBench();
    const editor = mountEditor(fake);
    testWith(editor.target, 'a');
    fake.calls[0]?.answer(COMPILE_REJECTED);
    await settle();
    const section = bench(editor.target);
    expect(section.querySelector('[data-bench-result="refused"]')).not.toBeNull();
    expect(says(section, 'code.regexRefusal.compileRejected')).toBe(true);
    expect(says(section, 'code.regexCompileFailure.syntax')).toBe(true);
    expect(says(section, 'browser.regexBench.notFound')).toBe(false);
    editor.stop();
  });

  it.each(LOCALES)('inserts {{name}} at the selection and creates no variable (%s)', async (lang) => {
    locale.setOverride(lang);
    const fake = fakeBench();
    const editor = mountEditor(fake, projection({ replace: 'xy' }));
    testWith(editor.target, 'a', lang);
    fake.calls[0]?.answer(found('a', [['alpha', 'a']]));
    await settle();
    expect(captureRow(editor.target)?.textContent?.trim()).toBe(
      sentence(lang, 'browser.variableGroup.capture.open')
    );
    const body = editor.target.querySelector('textarea[data-field="replace"]');
    if (!(body instanceof HTMLTextAreaElement)) {
      throw new Error('the replace box is drawn');
    }
    body.setSelectionRange(1, 1);
    openCaptures(editor.target);
    const insert = editor.target.querySelector('button[data-capture="alpha"]');
    expect(insert?.textContent?.trim()).toBe(
      sentence(lang, 'browser.variableGroup.capture.insertOne', { reference: '{{alpha}}' })
    );
    (insert as HTMLButtonElement).click();
    flushSync();
    expect(body.value).toBe('x{{alpha}}y');
    expect(says(editor.target, 'browser.variableGroup.capture.inserted', lang, {
      field: DICTIONARIES[lang]['browser.detail.field.replace']
    })).toBe(true);
    // No variable was drafted: the group still lists none added.
    expect(says(editor.target, 'browser.variableGroup.row.new', lang)).toBe(false);

    const save = [...editor.target.querySelectorAll('button')].find(
      (one) => one.textContent?.trim() === sentence(lang, 'browser.matchEditor.save')
    );
    save?.click();
    await settle();
    expect(editor.drafts).toHaveLength(1);
    const draft = editor.drafts[0];
    expect(draft?.replace).toEqual({ Set: 'x{{alpha}}y' });
    expect(draft?.var_intents).toEqual([]);
    expect(draft?.vars).toEqual([]);
    editor.stop();
  });
});

describe('two capture insertions in a row (review 4-22)', () => {
  it.each(LOCALES)('each lands at the caret the previous one left, and each is one undo step (%s)', async (lang) => {
    locale.setOverride(lang);
    const fake = fakeBench();
    const editor = mountEditor(fake, projection({ replace: 'xy' }));
    testWith(editor.target, 'ab', lang);
    fake.calls[0]?.answer(found('ab', [['alpha', 'a'], ['beta', 'b']]));
    await settle();
    const body = editor.target.querySelector('textarea[data-field="replace"]');
    if (!(body instanceof HTMLTextAreaElement)) {
      throw new Error('the replace box is drawn');
    }
    body.setSelectionRange(1, 1);
    openCaptures(editor.target);
    (editor.target.querySelector('button[data-capture="alpha"]') as HTMLButtonElement).click();
    await settle();
    expect(body.value).toBe('x{{alpha}}y');
    expect([body.selectionStart, body.selectionEnd]).toEqual([10, 10]);
    (editor.target.querySelector('button[data-capture="beta"]') as HTMLButtonElement).click();
    await settle();
    expect(body.value).toBe('x{{alpha}}{{beta}}y');
    expect([body.selectionStart, body.selectionEnd]).toEqual([18, 18]);

    const undo = [...editor.target.querySelectorAll('button')].find(
      (one) => one.textContent?.trim() === sentence(lang, 'browser.matchEditor.undo')
    );
    undo?.click();
    flushSync();
    expect(body.value).toBe('x{{alpha}}y');
    undo?.click();
    flushSync();
    expect(body.value).toBe('xy');
    editor.stop();
  });
});

describe('the compatibility sentence', () => {
  it.each(LOCALES)('is drawn beside a result with the engine Rust named (%s)', async (lang) => {
    locale.setOverride(lang);
    const fake = fakeBench();
    const editor = mountEditor(fake);
    testWith(editor.target, 'a', lang);
    expect(says(bench(editor.target, lang), 'browser.regexBench.compatibility', lang, { version: '1.13.1' })).toBe(
      false
    );
    fake.calls[0]?.answer(found('a', [['alpha', 'a']]));
    await settle();
    const drawn = bench(editor.target, lang).querySelector('[data-bench-compatibility]')?.textContent?.trim();
    expect(drawn).toBe(sentence(lang, 'browser.regexBench.compatibility', { version: '1.13.1' }));
    expect(drawn).toContain('1.13.1');
    expect(drawn).toContain('1.5.5');
    expect(drawn).toContain('2.3.0');
    editor.stop();
  });

  it.each(LOCALES)('is drawn beside a compile refusal too (%s)', async (lang) => {
    locale.setOverride(lang);
    const fake = fakeBench();
    const editor = mountEditor(fake);
    testWith(editor.target, 'a', lang);
    fake.calls[0]?.answer(COMPILE_REJECTED);
    await settle();
    expect(bench(editor.target, lang).querySelector('[data-bench-compatibility]')?.textContent?.trim()).toBe(
      sentence(lang, 'browser.regexBench.compatibility', { version: '1.13.1' })
    );
    editor.stop();
  });
});
