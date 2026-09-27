/** @vitest-environment jsdom */

/**
 * Phase 4-19-2 — the illustrative preview panel (`PreviewPanel.svelte`), mounted
 * alone and inside the small editor, driven through real DOM events.
 *
 * Opts into jsdom by the docblock above and by nothing else. One `describe` per
 * acceptance clause of step 4-19 (`docs/decisions/4-split-notes.md` §2, the
 * 2026-09-27 addendum's 4-19-2 half), each clause its own test or tests:
 *
 * 1. a superseded response cannot overwrite the current one on screen;
 * 2. previewing changes no draft, calls no writing command and touches no file;
 * 3. unresolved values stay identifiable in the drawn output;
 * 4. output text holding markup is drawn as text, never as markup;
 * 5. there is no execution control and no clipboard-read control.
 *
 * Then the drawing the model owes: sample inputs, the instant and zone beside
 * the result, and the states that stand in for a result.
 *
 * **Mounted evidence, never a screen** (Phase 4 ruling 29): this proves which
 * elements jsdom holds and what reached the injected ports — nothing about
 * layout or WebKit. The window half is step 4-20's. **No preview here reads the
 * real clock**: every panel is handed a fixed {@link SampleClock}, and the
 * instant a request carries is asserted to be that clock's. (`Date.now` itself
 * cannot be asserted uncalled here: jsdom stamps every DOM event with it.)
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do. Every fixture is hand-authored and neutral (`CLAUDE.md` §1).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inertRegexBenchCommands, makeDocument, makeMatch, makeSummary, scriptedAcknowledgement } from '../browser/fixtures';
import type { CreationBuffers } from '../browser/matchCreation';
import type { MatchBuffers } from '../browser/matchEditor';
import type { PreviewCommands, PreviewTarget, SampleClock } from '../browser/preview';
import type { ConflictModel, DiskAdoptionOutcome } from '../browser/saveOutcome';
import type { SurfaceBinding } from '../browser/surfaceReceivers';
import { variableStructureReadOf } from '../browser/variableEditor';
import type { VariableGroupPort } from '../browser/variableGroup';
import type { MatchSaveAnswer } from '../browser/workspace.svelte';
import { describePreviewPlaceholderName, describePreviewUnresolved } from '../i18n/codes';
import { translate } from '../i18n/dictionaries';
import type { CommandResult } from '../ipc/commands';
import type {
  AnalysisSummary,
  CandidateOperation,
  CandidatePreview,
  ContentRevision,
  DocumentSummary,
  DocumentView,
  MatchDraft,
  MatchId,
  MatchPreview,
  PreviewSamples,
  PreviewSegment
} from '../ipc/types';
import { locale } from '../stores/locale.svelte';
import MatchEditor from './MatchEditor.svelte';
import PreviewPanel from './PreviewPanel.svelte';

/**
 * Every call that reaches `@tauri-apps/api/core`'s `invoke` — the one door to
 * Rust, and so to any file. None should: every port is scripted, and the
 * file-level `afterEach` fails a case that made one.
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

/** The candidate revision a preview answers. */
const CANDIDATE: ContentRevision = 'c'.repeat(64);

/** A snippet identity. */
const ID: MatchId = { document: 1, revision: BASE, node: 1 };

/** Every draft field unchanged but `replace`. */
const DRAFT: MatchDraft = {
  trigger: 'Unchanged',
  regex: 'Unchanged',
  replace: { Set: 'Hello {{pick}}' },
  markdown: 'Unchanged',
  html: 'Unchanged',
  image_path: 'Unchanged',
  form: 'Unchanged',
  label: 'Unchanged',
  comment: 'Unchanged',
  word: 'Unchanged',
  left_word: 'Unchanged',
  right_word: 'Unchanged',
  propagate_case: 'Unchanged',
  uppercase_style: 'Unchanged',
  force_mode: 'Unchanged',
  force_clipboard: 'Unchanged',
  paragraph: 'Unchanged',
  anchor: 'Unchanged',
  triggers: [],
  search_terms: [],
  vars: [],
  form_fields: [],
  content_switch: null,
  trigger_form: null,
  sequences: [],
  var_intents: [],
  form_intents: []
};

/** A draft target over {@link DRAFT}. */
const TARGET: PreviewTarget = { kind: 'draft', id: ID, baseRevision: BASE, draft: DRAFT };

/** 2024-03-31T01:00:00Z plus 750 ms. */
const FIXED_MILLIS = 1_711_846_800_750;

/**
 * A fixed clock and zone.
 *
 * @param zone - The IANA name it answers, or `null` for a fixed offset.
 * @returns The clock.
 */
function fixedClock(zone: string | null = 'Europe/Madrid'): SampleClock {
  return { now: () => FIXED_MILLIS, zoneName: () => zone, offsetMinutesAt: () => 120 };
} // End of function fixedClock()

/** An analysis with one choice, one form of two fields and one capture. */
const ANALYSIS: AnalysisSummary = {
  declarations: [
    {
      index: 0,
      name: 'pick',
      kind: 'Choice',
      injection: 'Enabled',
      usage: { body: 1, parameters: 0, depends_on: 0, unverified_layout: 0 },
      layout: null
    },
    {
      index: 1,
      name: 'f',
      kind: 'Form',
      injection: 'Enabled',
      usage: { body: 0, parameters: 0, depends_on: 0, unverified_layout: 0 },
      layout: {
        pieces: [{ Placeholder: { name: 'who' } }, { Text: { text: ' ' } }, { Placeholder: { name: 'where' } }],
        fully_supported: true,
        definitions_without_occurrence: []
      }
    }
  ],
  edges: [],
  cycles: [],
  missing_dependencies: [],
  order_advisories: [],
  form_advisories: [],
  incomplete: [],
  scope_closed: true,
  captures: ['num'],
  shorthand_form: null,
  unverified_layout_references: []
};

/**
 * A preview of one `replace` body.
 *
 * @param segments - Its segments.
 * @returns The preview.
 */
function previewOf(segments: readonly PreviewSegment[]): MatchPreview {
  return { bodies: [{ field: 'Replace', segments }], limit: null };
} // End of function previewOf()

/**
 * A successful candidate answer.
 *
 * @param preview - The preview, or `null` for a candidate holding no snippet.
 * @returns The answer.
 */
function candidateAnswer(preview: MatchPreview | null): CommandResult<CandidatePreview> {
  return { ok: true, value: { candidate: CANDIDATE, preview, analysis: preview === null ? null : ANALYSIS } };
} // End of function candidateAnswer()

/** A deferred command answer. */
interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
}

/**
 * A promise and its settler.
 *
 * @returns The deferred.
 */
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
} // End of function deferred()

/** One recorded preview call. */
interface PreviewCall {
  readonly name: string;
  readonly id: MatchId;
  readonly operation: CandidateOperation | null;
  readonly samples: PreviewSamples;
}

/**
 * Preview commands whose every call waits on a deferred, recorded in order —
 * wrapped in a `Proxy` that records every member read, so a case can assert
 * that nothing but the preview readers was reached.
 *
 * @returns The commands, the pending answers, the calls and the members read.
 */
function deferredCommands(): {
  commands: PreviewCommands;
  answers: Deferred<CommandResult<CandidatePreview>>[];
  calls: PreviewCall[];
  touched: Set<PropertyKey>;
} {
  const answers: Deferred<CommandResult<CandidatePreview>>[] = [];
  const calls: PreviewCall[] = [];
  const touched = new Set<PropertyKey>();
  const inner: PreviewCommands = {
    previewMatch(id: MatchId, samples: PreviewSamples) {
      calls.push({ name: 'previewMatch', id, operation: null, samples });
      return new Promise(() => undefined);
    },
    previewMatchCandidate(id: MatchId, operation: CandidateOperation, _base: ContentRevision, samples: PreviewSamples) {
      calls.push({ name: 'previewMatchCandidate', id, operation, samples });
      const answer = deferred<CommandResult<CandidatePreview>>();
      answers.push(answer);
      return answer.promise;
    }
  };
  const commands = new Proxy(inner, {
    get(object, property, receiver) {
      touched.add(property);
      return Reflect.get(object, property, receiver) as unknown;
    }
  });
  return { commands, answers, calls, touched };
} // End of function deferredCommands()

/** A mounted component. */
interface Mounted {
  readonly target: HTMLElement;
  readonly stop: () => void;
}

/**
 * Mounts the panel alone.
 *
 * @param commands - The preview readers.
 * @param target - What it previews.
 * @param clock - The clock.
 * @returns The mounted panel.
 */
function mountPanel(commands: PreviewCommands, target: () => PreviewTarget = () => TARGET, clock = fixedClock()): Mounted {
  const element = document.createElement('div');
  document.body.append(element);
  const component = mount(PreviewPanel, { target: element, props: { target, commands, clock } });
  flushSync();
  return {
    target: element,
    stop: () => {
      void unmount(component);
      element.remove();
    }
  };
} // End of function mountPanel()

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
 * Presses one of the panel's two buttons.
 *
 * @param root - Where the panel is.
 * @param action - `request` (show or refresh) or `close`.
 */
function press(root: HTMLElement, action: 'request' | 'close'): void {
  const button = root.querySelector<HTMLButtonElement>(`button[data-preview-action="${action}"]`);
  expect(button).not.toBeNull();
  button?.click();
  flushSync();
} // End of function press()

/**
 * Types into one sample-input box.
 *
 * @param root - Where the panel is.
 * @param key - The box's slot key.
 * @param value - The text.
 */
function type(root: HTMLElement, key: string, value: string): void {
  const box = root.querySelector<HTMLInputElement>(`input[data-slot='${key}']`);
  expect(box).not.toBeNull();
  if (box !== null) {
    box.value = value;
    box.dispatchEvent(new Event('input', { bubbles: true }));
  }
  flushSync();
} // End of function type()

/**
 * The drawn output's text, every body joined.
 *
 * @param root - Where the panel is.
 * @returns The text.
 */
function outputText(root: HTMLElement): string {
  return [...root.querySelectorAll('[data-preview-output]')].map((element) => element.textContent ?? '').join('|');
} // End of function outputText()

let mounted: Mounted | null = null;

beforeEach(() => {
  locale.setOverride('en');
});

afterEach(() => {
  mounted?.stop();
  mounted = null;
  locale.setOverride(null);
  const calls = invoked.mock.calls.length;
  invoked.mockClear();
  expect(calls).toBe(0);
});

describe('clause 1 — a superseded response cannot overwrite the current one on screen', () => {
  it('draws the later answer when the earlier one resolves after it', async () => {
    const { commands, answers } = deferredCommands();
    mounted = mountPanel(commands);
    press(mounted.target, 'request');
    press(mounted.target, 'request');
    expect(answers).toHaveLength(2);
    answers[1]?.resolve(candidateAnswer(previewOf([{ Literal: { text: 'current answer' } }])));
    await settle();
    expect(outputText(mounted.target)).toBe('current answer');
    answers[0]?.resolve(candidateAnswer(previewOf([{ Literal: { text: 'stale answer' } }])));
    await settle();
    expect(outputText(mounted.target)).toBe('current answer');
    expect(mounted.target.textContent).not.toContain('stale answer');
  });

  it('draws the answer to the latest sample edit, not an earlier one resolving late', async () => {
    const { commands, answers, calls } = deferredCommands();
    mounted = mountPanel(commands);
    press(mounted.target, 'request');
    answers[0]?.resolve(candidateAnswer(previewOf([{ Literal: { text: 'first' } }])));
    await settle();
    type(mounted.target, 'capture:num', 'one');
    type(mounted.target, 'capture:num', 'two');
    expect(calls.map((call) => call.samples.captures)).toEqual([[], [{ name: 'num', value: 'one' }], [{ name: 'num', value: 'two' }]]);
    answers[2]?.resolve(candidateAnswer(previewOf([{ Literal: { text: 'for two' } }])));
    await settle();
    answers[1]?.resolve(candidateAnswer(previewOf([{ Literal: { text: 'for one' } }])));
    await settle();
    expect(outputText(mounted.target)).toBe('for two');
  });

  it('draws nothing an answer brings after the preview was closed', async () => {
    const { commands, answers } = deferredCommands();
    mounted = mountPanel(commands);
    press(mounted.target, 'request');
    press(mounted.target, 'close');
    answers[0]?.resolve(candidateAnswer(previewOf([{ Literal: { text: 'too late' } }])));
    await settle();
    expect(mounted.target.querySelector('[data-preview-output]')).toBeNull();
    expect(mounted.target.querySelector('button[data-preview-action="close"]')).toBeNull();
  });
});

describe('clause 2 — previewing changes no draft, calls no writing command and touches no file', () => {
  it('reads a deep-frozen draft target without writing it, and reaches only the candidate reader', async () => {
    const { commands, answers, calls, touched } = deferredCommands();
    const frozen = structuredClone(TARGET);
    const deepFreeze = (value: unknown): void => {
      if (value !== null && typeof value === 'object') {
        Object.freeze(value);
        Object.values(value).forEach(deepFreeze);
      }
    };
    deepFreeze(frozen);
    mounted = mountPanel(commands, () => frozen);
    press(mounted.target, 'request');
    answers[0]?.resolve(candidateAnswer(previewOf([{ Literal: { text: 'shown' } }])));
    await settle();
    type(mounted.target, 'capture:num', 'x');
    expect(frozen).toEqual(TARGET);
    expect([...touched]).toEqual(['previewMatchCandidate']);
    expect(calls.map((call) => call.name)).toEqual(['previewMatchCandidate', 'previewMatchCandidate']);
    expect(calls[0]?.operation).toEqual({ Draft: { draft: DRAFT } });
  });

  it('inside the editor: sends the open draft, leaves the draft and its history alone, and calls no writer', async () => {
    const { commands, answers, calls, touched } = deferredCommands();
    const editor = mountEditor(commands);
    mounted = editor;
    const box = editor.target.querySelector<HTMLTextAreaElement>('textarea[data-field="replace"]');
    expect(box).not.toBeNull();
    if (box === null) {
      return;
    }
    box.value = 'Drafted {{pick}}';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    const undo = (): HTMLButtonElement | undefined =>
      [...editor.target.querySelectorAll<HTMLButtonElement>('button')].find(
        (button) => button.textContent?.trim() === translate('en', 'browser.matchEditor.undo')
      );
    expect(undo()?.disabled).toBe(false);
    press(editor.target, 'request');
    answers[0]?.resolve(candidateAnswer(previewOf([{ Literal: { text: 'Drafted ' } }])));
    await settle();
    expect(outputText(editor.target)).toBe('Drafted ');
    // The draft the reader was handed is the editor's, carried as a wire copy.
    const sent = calls[0]?.operation;
    expect(sent !== null && sent !== undefined && 'Draft' in sent ? sent.Draft.draft.replace : null).toEqual({
      Set: 'Drafted {{pick}}'
    });
    // The draft is untouched: the box still holds the edit, and one undo step exists.
    expect(box.value).toBe('Drafted {{pick}}');
    undo()?.click();
    flushSync();
    expect(box.value).toBe('Hello ');
    expect(undo()?.disabled).toBe(true);
    // Only the preview reader was reached; the save and reorder ports never were,
    // and `invoke` — the one door to a file — never was (the file-level `afterEach`).
    expect([...touched]).toEqual(['previewMatchCandidate']);
    expect(editor.saves).toEqual([]);
    expect(editor.moves).toBe(0);
  });

  it('says so when the draft has moved on since the drawn answer', async () => {
    const { commands, answers } = deferredCommands();
    const editor = mountEditor(commands);
    mounted = editor;
    press(editor.target, 'request');
    answers[0]?.resolve(candidateAnswer(previewOf([{ Literal: { text: 'Hello ' } }])));
    await settle();
    expect(editor.target.querySelector('[data-preview-notice="behindDraft"]')).toBeNull();
    const box = editor.target.querySelector<HTMLTextAreaElement>('textarea[data-field="replace"]');
    if (box !== null) {
      box.value = 'Changed';
      box.dispatchEvent(new Event('input', { bubbles: true }));
    }
    flushSync();
    expect(editor.target.querySelector('[data-preview-notice="behindDraft"]')?.textContent).toBe(
      translate('en', 'browser.preview.notice.behindDraft')
    );
  });
});

describe('clause 3 — unresolved values stay identifiable in the drawn output', () => {
  it('marks each unresolved value as written, names its reason, and lists every reason', async () => {
    const { commands, answers } = deferredCommands();
    mounted = mountPanel(commands);
    press(mounted.target, 'request');
    answers[0]?.resolve(
      candidateAnswer(
        previewOf([
          { Literal: { text: 'Hi ' } },
          { Unresolved: { text: '{{gone}}', source: null, reason: 'UnknownName' } },
          {
            Choice: {
              source: { Local: { index: 0 } },
              label: 'Shown',
              segments: [{ Unresolved: { text: '{{d}}', source: null, reason: 'DateInstantMissing' } }]
            }
          }
        ])
      )
    );
    await settle();
    const marks = [...mounted.target.querySelectorAll<HTMLElement>('[data-preview-output] mark.unresolved')];
    expect(marks.map((mark) => [mark.textContent, mark.dataset.unresolved, mark.title])).toEqual([
      ['{{gone}}', 'UnknownName', describePreviewUnresolved('en', 'UnknownName')],
      ['{{d}}', 'DateInstantMissing', describePreviewUnresolved('en', 'DateInstantMissing')]
    ]);
    // A literal is never marked.
    expect(mounted.target.querySelector('[data-preview-output] .literal')?.closest('mark')).toBeNull();
    const listed = [...mounted.target.querySelectorAll<HTMLElement>('li[data-limitation="unresolved"]')];
    expect(listed.map((item) => item.textContent)).toEqual([
      describePreviewUnresolved('en', 'UnknownName'),
      describePreviewUnresolved('en', 'DateInstantMissing')
    ]);
    expect(mounted.target.querySelector('[data-preview-count]')?.textContent).toBe(
      translate('en', 'browser.preview.unresolvedCount', { count: 2 })
    );
  });

  it('names the reason in Spanish under a Spanish override', async () => {
    locale.setOverride('es');
    const { commands, answers } = deferredCommands();
    mounted = mountPanel(commands);
    press(mounted.target, 'request');
    answers[0]?.resolve(candidateAnswer(previewOf([{ Unresolved: { text: '{{x}}', source: null, reason: 'Cycle' } }])));
    await settle();
    const mark = mounted.target.querySelector<HTMLElement>('mark.unresolved');
    expect(mark?.title).toBe(describePreviewUnresolved('es', 'Cycle'));
    expect(mark?.title).not.toBe(describePreviewUnresolved('en', 'Cycle'));
  });
});

describe('clause 4 — output text holding markup is drawn as text, never as markup', () => {
  it('draws tags in every piece kind as characters and creates no element from them', async () => {
    const { commands, answers } = deferredCommands();
    mounted = mountPanel(commands);
    press(mounted.target, 'request');
    answers[0]?.resolve(
      candidateAnswer(
        previewOf([
          { Literal: { text: '<b>x</b>' } },
          { Sample: { text: '<script>window.hacked = 1</script>', source: { Capture: { name: 'num' } } } },
          {
            Choice: {
              source: { Local: { index: 0 } },
              label: '<i>label</i>',
              segments: [{ Literal: { text: '<img src="y" onerror="window.hacked = 2">' } }]
            }
          },
          { Unresolved: { text: '<u>{{z}}</u>', source: null, reason: 'UnknownName' } }
        ])
      )
    );
    await settle();
    const output = mounted.target.querySelector('[data-preview-output]');
    expect(output).not.toBeNull();
    expect(output?.querySelectorAll('b, script, img, i, u')).toHaveLength(0);
    const text = output?.textContent ?? '';
    for (const written of ['<b>x</b>', '<script>window.hacked = 1</script>', '<i>label</i>', '<img src="y" onerror="window.hacked = 2">', '<u>{{z}}</u>']) {
      expect(text).toContain(written);
    } // End of the loop over the written texts
    expect((window as unknown as { hacked?: number }).hacked).toBeUndefined();
  });

  it('never uses {@html}, and draws a carriage return as a named marker, never in a box', async () => {
    const source = readFileSync(resolve(process.cwd(), 'src/lib/components/PreviewPanel.svelte'), 'utf8');
    expect(source).not.toContain('@html');
    const { commands, answers } = deferredCommands();
    mounted = mountPanel(commands);
    press(mounted.target, 'request');
    answers[0]?.resolve(candidateAnswer(previewOf([{ Literal: { text: 'a\rb' } }])));
    await settle();
    const output = mounted.target.querySelector('[data-preview-output]');
    expect(output?.querySelector('.invisible')).not.toBeNull();
    expect(output?.textContent).not.toContain('\r');
    expect(mounted.target.querySelectorAll('textarea')).toHaveLength(0);
    const boxes = [...mounted.target.querySelectorAll('input')];
    expect(boxes.every((box) => !box.value.includes('\r'))).toBe(true);
  });
});

describe('clause 5 — no execution control and no clipboard-read control', () => {
  it('draws commands and the clipboard as labelled placeholders, with no control but show, refresh and close', async () => {
    const read = vi.fn();
    const readText = vi.fn();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { read, readText } });
    const { commands, answers } = deferredCommands();
    mounted = mountPanel(commands);
    press(mounted.target, 'request');
    answers[0]?.resolve(
      candidateAnswer(
        previewOf([
          { Placeholder: { source: { Local: { index: 0 } }, placeholder: { Shell: { command: 'touch /tmp/x' } } } },
          { Placeholder: { source: { Local: { index: 1 } }, placeholder: { Script: { args: ['/usr/bin/true'] } } } },
          { Placeholder: { source: { Local: { index: 2 } }, placeholder: { Clipboard: {} } } }
        ])
      )
    );
    await settle();
    const buttons = [...mounted.target.querySelectorAll<HTMLButtonElement>('button')];
    expect(buttons.map((button) => button.dataset.previewAction)).toEqual(['request', 'close']);
    for (const button of buttons) {
      button.click();
      flushSync();
    } // End of the loop over every button
    await settle();
    expect(read).not.toHaveBeenCalled();
    expect(readText).not.toHaveBeenCalled();
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('labels each placeholder and says what it stands for', async () => {
    const { commands, answers } = deferredCommands();
    mounted = mountPanel(commands);
    press(mounted.target, 'request');
    answers[0]?.resolve(
      candidateAnswer(
        previewOf([
          { Placeholder: { source: { Local: { index: 0 } }, placeholder: { Shell: { command: 'echo hi' } } } },
          { Placeholder: { source: { Local: { index: 2 } }, placeholder: { Clipboard: {} } } }
        ])
      )
    );
    await settle();
    const chips = [...mounted.target.querySelectorAll<HTMLElement>('[data-preview-output] .placeholder')];
    expect(chips.map((chip) => [chip.textContent, chip.title])).toEqual([
      [translate('en', 'browser.preview.placeholder.shell'), describePreviewPlaceholderName('en', 'Shell')],
      [translate('en', 'browser.preview.placeholder.clipboard'), describePreviewPlaceholderName('en', 'Clipboard')]
    ]);
    expect(outputText(mounted.target)).not.toContain('echo hi');
  });

  it('holds no clipboard read, process or shell spelling in the new sources', () => {
    for (const file of ['src/lib/components/PreviewPanel.svelte', 'src/lib/browser/previewView.ts']) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(source).not.toMatch(/navigator\.clipboard|readText|clipboard\.read|child_process|plugin-shell|execCommand/);
    } // End of the loop over the new sources
  });
});

describe('sample inputs, the instant beside the result, and the states standing in for one', () => {
  it('offers one box per slot of the candidate and sends what each holds', async () => {
    const { commands, answers, calls } = deferredCommands();
    mounted = mountPanel(commands);
    press(mounted.target, 'request');
    expect(mounted.target.querySelectorAll('input')).toHaveLength(0);
    answers[0]?.resolve(candidateAnswer(previewOf([{ Literal: { text: 'x' } }])));
    await settle();
    const keys = [...mounted.target.querySelectorAll<HTMLInputElement>('input[data-slot]')].map((box) => box.dataset.slot);
    expect(keys).toEqual([
      'selection:{"Local":{"index":0}}',
      'field:{"Local":{"index":1}}:who',
      'field:{"Local":{"index":1}}:where',
      'capture:num'
    ]);
    type(mounted.target, 'selection:{"Local":{"index":0}}', '2');
    type(mounted.target, 'field:{"Local":{"index":1}}:who', 'Ana <b>');
    expect(calls.at(-1)?.samples.selections).toEqual([{ variable: { Local: { index: 0 } }, index: 1 }]);
    expect(calls.at(-1)?.samples.form_values).toEqual([{ form: { Local: { index: 1 } }, field: 'who', value: 'Ana <b>' }]);
  });

  it('refuses an entry that is not a whole number from 1, and sends nothing for it', async () => {
    const { commands, answers, calls } = deferredCommands();
    mounted = mountPanel(commands);
    press(mounted.target, 'request');
    answers[0]?.resolve(candidateAnswer(previewOf([{ Literal: { text: 'x' } }])));
    await settle();
    type(mounted.target, 'selection:{"Local":{"index":0}}', '0');
    expect(mounted.target.textContent).toContain(translate('en', 'browser.preview.slot.entryRefused'));
    expect(calls).toHaveLength(1);
  });

  it('puts a refused entry back to the accepted one, so a box never shows what is not sent (review 4-19-2)', async () => {
    const { commands, answers, calls } = deferredCommands();
    mounted = mountPanel(commands);
    press(mounted.target, 'request');
    answers[0]?.resolve(candidateAnswer(previewOf([{ Literal: { text: 'x' } }])));
    await settle();
    const key = 'selection:{"Local":{"index":0}}';
    type(mounted.target, key, '2');
    type(mounted.target, key, '0');
    expect(mounted.target.textContent).toContain(translate('en', 'browser.preview.slot.entryRefused'));
    type(mounted.target, 'capture:num', 'seven');
    expect(calls).toHaveLength(3);
    expect(calls.at(-1)?.samples.selections).toEqual([{ variable: { Local: { index: 0 } }, index: 1 }]);
    expect(mounted.target.querySelector<HTMLInputElement>(`input[data-slot='${key}']`)?.value).toBe('2');
  });

  it('drops a positional sample before requesting a candidate whose variables changed (review 4-19-2)', async () => {
    const { commands, answers, calls } = deferredCommands();
    let current: PreviewTarget = TARGET;
    mounted = mountPanel(commands, () => current);
    press(mounted.target, 'request');
    answers[0]?.resolve(candidateAnswer(previewOf([{ Literal: { text: 'x' } }])));
    await settle();
    const key = 'selection:{"Local":{"index":0}}';
    type(mounted.target, key, '2');
    type(mounted.target, 'capture:num', 'seven');
    expect(calls.at(-1)?.samples.selections).toEqual([{ variable: { Local: { index: 0 } }, index: 1 }]);
    current = { ...TARGET, draft: { ...DRAFT, var_intents: [{ RemoveVariable: { index: 0 } }] } };
    press(mounted.target, 'request');
    expect(calls.at(-1)?.samples.selections).toEqual([]);
    expect(calls.at(-1)?.samples.captures).toEqual([{ name: 'num', value: 'seven' }]);
    expect(mounted.target.querySelector<HTMLInputElement>(`input[data-slot='${key}']`)?.value).toBe('');
  });

  it('keeps a positional sample while the drafted variables stay as they were', async () => {
    const { commands, answers, calls } = deferredCommands();
    let current: PreviewTarget = TARGET;
    mounted = mountPanel(commands, () => current);
    press(mounted.target, 'request');
    answers[0]?.resolve(candidateAnswer(previewOf([{ Literal: { text: 'x' } }])));
    await settle();
    type(mounted.target, 'selection:{"Local":{"index":0}}', '2');
    current = { ...TARGET, draft: { ...DRAFT, replace: { Set: 'Bye {{pick}}' } } };
    press(mounted.target, 'request');
    expect(calls.at(-1)?.samples.selections).toEqual([{ variable: { Local: { index: 0 } }, index: 1 }]);
  });

  it('draws the instant and zone the answer was prepared at beside the output', async () => {
    const { commands, answers, calls } = deferredCommands();
    mounted = mountPanel(commands, () => TARGET, fixedClock());
    press(mounted.target, 'request');
    answers[0]?.resolve(candidateAnswer(previewOf([{ Literal: { text: 'x' } }])));
    await settle();
    expect(calls[0]?.samples.instant).toEqual({ unix_seconds: 1_711_846_800, zone: { Named: { name: 'Europe/Madrid' } } });
    const aside = mounted.target.querySelector('aside[data-preview-instant]');
    expect(aside?.parentElement?.querySelector('[data-preview-output]')).not.toBeNull();
    expect(aside?.textContent).toContain(translate('en', 'browser.preview.instant.utc', { instant: '2024-03-31 01:00:00' }));
    expect(aside?.textContent).toContain(translate('en', 'browser.preview.zone.named', { name: 'Europe/Madrid' }));
  });

  it('draws a fixed offset when the clock names no zone', async () => {
    const { commands, answers } = deferredCommands();
    mounted = mountPanel(commands, () => TARGET, fixedClock(null));
    press(mounted.target, 'request');
    answers[0]?.resolve(candidateAnswer(previewOf([{ Literal: { text: 'x' } }])));
    await settle();
    expect(mounted.target.querySelector('aside[data-preview-instant]')?.textContent).toContain(
      translate('en', 'browser.preview.zone.fixed', { offset: '+02:00' })
    );
  });

  it('says so when the candidate holds no snippet there, and when the reader refuses', async () => {
    const { commands, answers } = deferredCommands();
    mounted = mountPanel(commands);
    press(mounted.target, 'request');
    answers[0]?.resolve(candidateAnswer(null));
    await settle();
    expect(mounted.target.querySelector('[data-preview-notice="noMatchInCandidate"]')?.textContent).toBe(
      translate('en', 'browser.preview.notice.noMatchInCandidate')
    );
    press(mounted.target, 'request');
    answers[1]?.resolve({ ok: false, failure: { kind: 'unexpected' } } as unknown as CommandResult<CandidatePreview>);
    await settle();
    expect(mounted.target.querySelector('[role="alert"]')).not.toBeNull();
    expect(mounted.target.querySelector('[data-preview-output]')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The editor harness
// ---------------------------------------------------------------------------

/** A mounted editor and what reached its writing ports. */
interface MountedEditor extends Mounted {
  /** Every draft the save port was handed. */
  readonly saves: MatchDraft[];
  /** How many reorders the variables port was handed. */
  readonly moves: number;
}

/**
 * A binding whose two methods do nothing.
 *
 * @returns The binding.
 */
function inertBinding(): SurfaceBinding {
  return { reportTarget: () => undefined, withdraw: () => undefined };
} // End of function inertBinding()

/**
 * Mounts the small editor over one snippet, every writing port recording and
 * never answering, and the preview readers injected.
 *
 * @param commands - The preview readers.
 * @returns The mounted editor.
 */
function mountEditor(commands: PreviewCommands): MountedEditor {
  const match = makeMatch({ revision: BASE, document: 1, node: 1, trigger: ':a', replace: 'Hello ' });
  const views: readonly DocumentView[] = [makeDocument({ id: 1, relativePath: 'match/base.yml', revision: BASE, matches: [match] })];
  const saves: MatchDraft[] = [];
  let moves = 0;
  const variables: VariableGroupPort = {
    snapshot: () => new Promise(() => undefined),
    structureRead: (document) => variableStructureReadOf(views, document, []),
    moveVariable: () => {
      moves += 1;
      return new Promise<MatchSaveAnswer>(() => undefined);
    }
  };
  const element = document.createElement('div');
  document.body.append(element);
  const component = mount(MatchEditor, {
    target: element,
    props: {
      acknowledgement: scriptedAcknowledgement().port,
      match,
      file: makeSummary({ id: 1, relativePath: 'match/base.yml' }),
      documents: (): readonly DocumentSummary[] => [makeSummary({ id: 1, relativePath: 'match/base.yml' })],
      projections: (): readonly DocumentView[] => views,
      create: (): Promise<MatchSaveAnswer> => new Promise(() => undefined),
      adoptRecoveryDiskVersion: (_conflict: ConflictModel<CreationBuffers>): DiskAdoptionOutcome => 'refused',
      clock: (): number => 0,
      save: (_id: MatchId, draft: MatchDraft): Promise<MatchSaveAnswer> => {
        saves.push(draft);
        return new Promise(() => undefined);
      },
      reproject: () => ({ kind: 'unavailable', reason: 'otherFile' }) as const,
      adoptDiskVersion: (_conflict: ConflictModel<MatchBuffers>): DiskAdoptionOutcome => 'refused',
      reportReceiver: () => inertBinding(),
      reportRecovery: inertBinding,
      standingConflictFor: () => null,
      variables,
      close: (): void => undefined,
      previewCommands: commands,
      regexBenchCommands: inertRegexBenchCommands(),
      sampleClock: fixedClock()
    }
  });
  flushSync();
  return {
    target: element,
    saves,
    get moves(): number {
      return moves;
    },
    stop: () => {
      void unmount(component);
      element.remove();
    }
  };
} // End of function mountEditor()
