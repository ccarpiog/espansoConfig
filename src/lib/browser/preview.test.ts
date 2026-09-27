/**
 * Phase 4-19-1 — the preview model and coordination (`./preview.ts`).
 *
 * One section per acceptance clause of `docs/decisions/4-split-notes.md` §2,
 * step 4-19, as the 2026-09-27 addendum gives it to 4-19-1:
 *
 * - the sample instant and zone come from the injected clock, and **no test
 *   here reads the real clock** — `Date.now` and `Intl.DateTimeFormat` are
 *   spied on around every case and asserted never called, except where a case
 *   replaces them to measure {@link SYSTEM_SAMPLE_CLOCK} itself;
 * - a superseded answer never overwrites a current one, with the answers
 *   resolved out of order;
 * - the model changes no draft and reaches no writing command;
 * - an unsaved draft goes through the candidate reader, never a writer;
 * - unresolved values stay identifiable and limitations are typed codes;
 * - there is no execution and no clipboard-read member anywhere.
 *
 * Every fixture is hand-authored and neutral (`CLAUDE.md` section 1).
 */

import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import type { CommandResult } from '../ipc/commands';
import type {
  AnalysisSummary,
  CandidateOperation,
  CandidatePreview,
  ContentRevision,
  MatchDraft,
  MatchId,
  MatchPreview,
  PreviewSamples,
  SampleInstant
} from '../ipc/types';
import {
  EMPTY_PREVIEW_INPUTS,
  REAL_PREVIEW_COMMANDS,
  SYSTEM_SAMPLE_CLOCK,
  createPreviewCoordinator,
  instantOf,
  limitationsOf,
  previewRequestOf,
  readSampleInstant,
  sampleSlotsOf,
  withCapture,
  withFormValue,
  withPinnedInstant,
  withSelection,
  withoutSelection,
  zoneOf,
  type PreviewCommands,
  type PreviewState,
  type SampleClock
} from './preview';

/** A snippet identity. */
const ID: MatchId = { document: 1, revision: 'a'.repeat(64), node: 7 };

/** Every draft field unchanged but `replace`. */
const DRAFT: MatchDraft = {
  trigger: 'Unchanged',
  regex: 'Unchanged',
  replace: { Set: '<b>{{pick}}</b>' },
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

/** 2024-03-31T01:00:00.750Z, in milliseconds. */
const FIXED_MILLIS = 1_711_846_800_750;

/**
 * A fixed clock.
 *
 * @param zone - The zone name it answers, or `null`.
 * @param offsetMinutes - The offset it answers when asked.
 * @param millis - The time it answers.
 * @returns The clock, with call counters.
 */
function fixedClock(
  zone: string | null = 'Europe/Madrid',
  offsetMinutes = 120,
  millis = FIXED_MILLIS
): SampleClock & { reads: number } {
  const clock = {
    reads: 0,
    now(): number {
      clock.reads += 1;
      return millis;
    },
    zoneName: (): string | null => zone,
    offsetMinutesAt: (): number => offsetMinutes
  };
  return clock;
} // End of function fixedClock()

/** A preview holding every segment kind, a nested unresolved one included. */
const RICH_PREVIEW: MatchPreview = {
  bodies: [
    {
      field: 'Replace',
      segments: [
        { Literal: { text: '<script>x</script>' } },
        { Sample: { text: 'two', source: { Local: { index: 0 } } } },
        {
          Choice: {
            source: { Local: { index: 1 } },
            label: 'Shown',
            segments: [{ Unresolved: { text: '{{gone}}', source: null, reason: 'UnknownName' } }]
          }
        },
        { Placeholder: { source: { Local: { index: 2 } }, placeholder: { Shell: { command: 'rm -rf x' } } } },
        { Placeholder: { source: { Local: { index: 3 } }, placeholder: { Clipboard: {} } } },
        { Unresolved: { text: '{{d}}', source: { Local: { index: 4 } }, reason: 'DateInstantMissing' } },
        { Unresolved: { text: '{{e}}', source: null, reason: 'UnknownName' } }
      ]
    }
  ],
  limit: 'OutputBytes'
};

/** A deferred command answer. */
interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

/**
 * A promise and its settlers.
 *
 * @returns The deferred.
 */
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
} // End of function deferred()

/** A preview whose only body is one literal. */
function literalPreview(text: string): MatchPreview {
  return { bodies: [{ field: 'Replace', segments: [{ Literal: { text } }] }], limit: null };
}

/** Commands whose every call waits on a deferred, recorded in call order. */
function deferredCommands(): {
  commands: PreviewCommands;
  saved: Deferred<CommandResult<MatchPreview>>[];
  candidates: Deferred<CommandResult<CandidatePreview>>[];
  calls: { name: string; args: unknown[] }[];
} {
  const saved: Deferred<CommandResult<MatchPreview>>[] = [];
  const candidates: Deferred<CommandResult<CandidatePreview>>[] = [];
  const calls: { name: string; args: unknown[] }[] = [];
  const commands: PreviewCommands = {
    previewMatch(id: MatchId, samples: PreviewSamples) {
      calls.push({ name: 'previewMatch', args: [id, samples] });
      const answer = deferred<CommandResult<MatchPreview>>();
      saved.push(answer);
      return answer.promise;
    },
    previewMatchCandidate(
      id: MatchId,
      operation: CandidateOperation,
      baseRevision: ContentRevision,
      samples: PreviewSamples
    ) {
      calls.push({ name: 'previewMatchCandidate', args: [id, operation, baseRevision, samples] });
      const answer = deferred<CommandResult<CandidatePreview>>();
      candidates.push(answer);
      return answer.promise;
    }
  };
  return { commands, saved, candidates, calls };
} // End of function deferredCommands()

/**
 * Freezes a value and everything under it — any write then throws (modules are strict).
 *
 * @param value - The value.
 * @returns The same value.
 */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value);
    for (const inner of Object.values(value as Record<string, unknown>)) {
      deepFreeze(inner);
    }
  }
  return value;
} // End of function deepFreeze()

let nowSpy: MockInstance<() => number>;
let intlSpy: MockInstance<typeof Intl.DateTimeFormat>;

beforeEach(() => {
  nowSpy = vi.spyOn(Date, 'now');
  intlSpy = vi.spyOn(Intl, 'DateTimeFormat');
});

afterEach(() => {
  // The clause "no test reads the clock": the model under test reached
  // neither the real time nor the real zone. Restored in any case, so one
  // failing case does not leave its spies to the next.
  try {
    expect(nowSpy).not.toHaveBeenCalled();
    expect(intlSpy).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
  }
});

describe('the sample instant and zone come from the injected clock', () => {
  it('reads the whole second and the IANA zone name', () => {
    const clock = fixedClock();
    expect(readSampleInstant(clock)).toEqual({
      unix_seconds: 1_711_846_800,
      zone: { Named: { name: 'Europe/Madrid' } }
    });
    expect(clock.reads).toBe(1);
  });

  it('falls back to the fixed offset at that instant when no zone name is read', () => {
    expect(readSampleInstant(fixedClock(null, -330))).toEqual({
      unix_seconds: 1_711_846_800,
      zone: { Fixed: { offset_seconds: -19_800 } }
    });
    expect(readSampleInstant(fixedClock('', 0))?.zone).toEqual({ Fixed: { offset_seconds: 0 } });
  });

  it('floors a time before the epoch to the earlier second', () => {
    expect(readSampleInstant(fixedClock('UTC', 0, -1))?.unix_seconds).toBe(-1);
  });

  it('sends no instant rather than a guess for a reading the wire cannot carry', () => {
    expect(readSampleInstant(fixedClock('UTC', 0, Number.NaN))).toBeNull();
    expect(readSampleInstant(fixedClock(null, Number.NaN))).toBeNull();
    expect(readSampleInstant(fixedClock(null, 24 * 60))).toBeNull();
    expect(readSampleInstant(fixedClock(null, 24 * 60 - 1))?.zone).toEqual({
      Fixed: { offset_seconds: 86_340 }
    });
  });

  it('the system clock is the one place the real time and zone are read', () => {
    nowSpy.mockReturnValue(FIXED_MILLIS);
    intlSpy.mockImplementation(
      () => ({ resolvedOptions: () => ({ timeZone: 'Asia/Tokyo' }) }) as unknown as Intl.DateTimeFormat
    );
    expect(readSampleInstant(SYSTEM_SAMPLE_CLOCK)).toEqual({
      unix_seconds: 1_711_846_800,
      zone: { Named: { name: 'Asia/Tokyo' } }
    });
    expect(nowSpy).toHaveBeenCalledTimes(1);
    expect(intlSpy).toHaveBeenCalledTimes(1);
    nowSpy.mockClear();
    intlSpy.mockClear();
  });

  it('draws a zone as a tagged value, never a sentence', () => {
    expect(zoneOf({ Named: { name: 'UTC' } })).toEqual({ kind: 'named', name: 'UTC' });
    expect(zoneOf({ Fixed: { offset_seconds: 3600 } })).toEqual({ kind: 'fixed', offsetSeconds: 3600 });
  });

  it('a pinned instant is sent as chosen and the clock is not read', () => {
    const clock = fixedClock();
    const pinned: SampleInstant = { unix_seconds: 0, zone: { Fixed: { offset_seconds: 0 } } };
    const request = previewRequestOf({ kind: 'saved', id: ID }, withPinnedInstant(EMPTY_PREVIEW_INPUTS, pinned), clock);
    expect(request.samples.instant).toEqual(pinned);
    expect(clock.reads).toBe(0);
  });

  it('reads the clock afresh for every request, and exposes the instant each one used', async () => {
    let millis = FIXED_MILLIS;
    const clock: SampleClock = { now: () => millis, zoneName: () => 'UTC', offsetMinutesAt: () => 0 };
    const { commands, saved } = deferredCommands();
    const coordinator = createPreviewCoordinator(commands, clock);
    const first = coordinator.request({ kind: 'saved', id: ID }, EMPTY_PREVIEW_INPUTS);
    expect(instantOf(coordinator.current())?.unix_seconds).toBe(1_711_846_800);
    saved[0]?.resolve({ ok: true, value: literalPreview('a') });
    const answered = await first;
    expect(instantOf(answered)).toEqual({ unix_seconds: 1_711_846_800, zone: { Named: { name: 'UTC' } } });
    millis += 60_000;
    const second = coordinator.request({ kind: 'saved', id: ID }, EMPTY_PREVIEW_INPUTS);
    saved[1]?.resolve({ ok: true, value: literalPreview('b') });
    expect(instantOf(await second)?.unix_seconds).toBe(1_711_846_860);
    expect(instantOf({ kind: 'idle' })).toBeNull();
  });
});

describe('sample inputs', () => {
  it('keep one selection per variable, the latest, and refuse a position the wire cannot carry', () => {
    const one = withSelection(EMPTY_PREVIEW_INPUTS, { Local: { index: 0 } }, 1);
    const two = one && withSelection(one, { Local: { index: 0 } }, 2);
    const three = two && withSelection(two, { Global: { index: 0 } }, 0);
    expect(three?.selections).toEqual([
      { variable: { Local: { index: 0 } }, index: 2 },
      { variable: { Global: { index: 0 } }, index: 0 }
    ]);
    expect(withSelection(EMPTY_PREVIEW_INPUTS, { Local: { index: 0 } }, -1)).toBeNull();
    expect(withSelection(EMPTY_PREVIEW_INPUTS, { Local: { index: 0 } }, 1.5)).toBeNull();
    expect(three && withoutSelection(three, { Local: { index: 0 } }).selections).toEqual([
      { variable: { Global: { index: 0 } }, index: 0 }
    ]);
    expect(EMPTY_PREVIEW_INPUTS.selections).toEqual([]);
    expect(Object.isFrozen(three)).toBe(true);
  });

  it('keep one value per form field and per capture, used exactly as given', () => {
    let inputs = withFormValue(EMPTY_PREVIEW_INPUTS, { ShorthandForm: {} }, 'name', 'a');
    inputs = withFormValue(inputs, { ShorthandForm: {} }, 'name', '<b>b</b>\r\n');
    inputs = withFormValue(inputs, { Local: { index: 3 } }, 'name', 'c');
    inputs = withCapture(inputs, 'num', '1');
    inputs = withCapture(inputs, 'num', '2');
    const request = previewRequestOf({ kind: 'saved', id: ID }, inputs, fixedClock());
    expect(request.samples.form_values).toEqual([
      { form: { ShorthandForm: {} }, field: 'name', value: '<b>b</b>\r\n' },
      { form: { Local: { index: 3 } }, field: 'name', value: 'c' }
    ]);
    expect(request.samples.captures).toEqual([{ name: 'num', value: '2' }]);
  });

  it('derive their slots from an analysis: selections, form fields in layout order, captures', () => {
    const analysis = {
      declarations: [
        { index: 0, name: 'pick', kind: 'Choice', layout: null },
        { index: 1, name: 'roll', kind: 'Random', layout: null },
        { index: 2, name: 'sh', kind: 'Shell', layout: null },
        {
          index: 3,
          name: 'f',
          kind: 'Form',
          layout: {
            pieces: [
              { Placeholder: { name: 'x' } },
              { Text: { text: ' ' } },
              { Placeholder: { name: 'y' } },
              { Placeholder: { name: 'x' } }
            ],
            fully_supported: true,
            definitions_without_occurrence: []
          }
        }
      ],
      captures: ['num'],
      shorthand_form: { pieces: [{ Placeholder: { name: 'z' } }], fully_supported: true, definitions_without_occurrence: [] }
    } as unknown as AnalysisSummary;
    expect(sampleSlotsOf(analysis)).toEqual([
      { kind: 'selection', variable: { Local: { index: 0 } }, name: 'pick', variableKind: 'Choice' },
      { kind: 'selection', variable: { Local: { index: 1 } }, name: 'roll', variableKind: 'Random' },
      { kind: 'formField', form: { Local: { index: 3 } }, name: 'f', field: 'x' },
      { kind: 'formField', form: { Local: { index: 3 } }, name: 'f', field: 'y' },
      { kind: 'formField', form: { ShorthandForm: {} }, name: null, field: 'z' },
      { kind: 'capture', name: 'num' }
    ]);
  });
});

describe('unresolved values and limitations', () => {
  it('stay identifiable: every reason as a typed code, nested choices included, and the text kept as written', () => {
    expect(limitationsOf(RICH_PREVIEW)).toEqual({
      unresolved: ['UnknownName', 'DateInstantMissing'],
      unresolvedCount: 3,
      placeholders: ['Shell', 'Clipboard'],
      limit: 'OutputBytes'
    });
    expect(limitationsOf(literalPreview('x'))).toEqual({
      unresolved: [],
      unresolvedCount: 0,
      placeholders: [],
      limit: null
    });
  });

  it('are carried on the shown state beside the untouched segments, markup included', async () => {
    const { commands, saved } = deferredCommands();
    const coordinator = createPreviewCoordinator(commands, fixedClock());
    const pending = coordinator.request({ kind: 'saved', id: ID }, EMPTY_PREVIEW_INPUTS);
    saved[0]?.resolve({ ok: true, value: RICH_PREVIEW });
    const state = await pending;
    expect(state.kind).toBe('shown');
    if (state.kind !== 'shown') {
      return;
    }
    expect(state.preview).toBe(RICH_PREVIEW);
    expect(state.preview.bodies[0]?.segments[0]).toEqual({ Literal: { text: '<script>x</script>' } });
    expect(state.limitations.unresolved).toEqual(['UnknownName', 'DateInstantMissing']);
    expect(state.candidate).toBeNull();
    expect(state.analysis).toBeNull();
  });
});

describe('a superseded answer never overwrites a current one', () => {
  it('drops an earlier answer that resolves after a later one', async () => {
    const { commands, saved } = deferredCommands();
    const seen: PreviewState['kind'][] = [];
    const coordinator = createPreviewCoordinator(commands, fixedClock(), (state) => seen.push(state.kind));
    const first = coordinator.request({ kind: 'saved', id: ID }, EMPTY_PREVIEW_INPUTS);
    const second = coordinator.request({ kind: 'saved', id: ID }, EMPTY_PREVIEW_INPUTS);
    saved[1]?.resolve({ ok: true, value: literalPreview('current') });
    const current = await second;
    saved[0]?.resolve({ ok: true, value: literalPreview('superseded') });
    const late = await first;
    expect(late).toBe(current);
    expect(coordinator.current()).toBe(current);
    expect(current.kind === 'shown' && current.preview.bodies[0]?.segments).toEqual([{ Literal: { text: 'current' } }]);
    expect(seen).toEqual(['pending', 'pending', 'shown']);
  });

  it('drops an earlier failure too, and an earlier answer that resolves before a later one is replaced by it', async () => {
    const { commands, saved } = deferredCommands();
    const coordinator = createPreviewCoordinator(commands, fixedClock());
    const first = coordinator.request({ kind: 'saved', id: ID }, EMPTY_PREVIEW_INPUTS);
    const second = coordinator.request({ kind: 'saved', id: ID }, EMPTY_PREVIEW_INPUTS);
    saved[0]?.reject(new Error('boom'));
    await first;
    expect(coordinator.current().kind).toBe('pending');
    saved[1]?.resolve({ ok: true, value: literalPreview('current') });
    expect((await second).kind).toBe('shown');

    const third = coordinator.request({ kind: 'saved', id: ID }, EMPTY_PREVIEW_INPUTS);
    const fourth = coordinator.request({ kind: 'saved', id: ID }, EMPTY_PREVIEW_INPUTS);
    saved[2]?.resolve({ ok: true, value: literalPreview('third') });
    await third;
    const pending = coordinator.current();
    expect(pending.kind).toBe('pending');
    // The last answered state is kept for drawing while the current request runs.
    expect(pending.kind === 'pending' && pending.last?.generation).toBe(2);
    saved[3]?.resolve({ ok: true, value: literalPreview('fourth') });
    const shown = await fourth;
    expect(shown.kind === 'shown' && shown.preview.bodies[0]?.segments).toEqual([{ Literal: { text: 'fourth' } }]);
  });

  it('drops every answer in flight after a clear', async () => {
    const { commands, candidates } = deferredCommands();
    const coordinator = createPreviewCoordinator(commands, fixedClock());
    const first = coordinator.request(
      { kind: 'draft', id: ID, baseRevision: 'b'.repeat(64), draft: DRAFT },
      EMPTY_PREVIEW_INPUTS
    );
    coordinator.clear();
    candidates[0]?.resolve({
      ok: true,
      value: { candidate: 'c'.repeat(64), preview: literalPreview('late'), analysis: null }
    });
    expect((await first).kind).toBe('idle');
    expect(coordinator.current().kind).toBe('idle');
  });

  it('installs and sends nothing for a request cleared by its own clock while being built', async () => {
    const { commands, calls } = deferredCommands();
    let coordinator: ReturnType<typeof createPreviewCoordinator> | null = null;
    const clock: SampleClock = {
      now(): number {
        coordinator?.clear();
        return FIXED_MILLIS;
      },
      zoneName: (): string | null => 'UTC',
      offsetMinutesAt: (): number => 0
    };
    coordinator = createPreviewCoordinator(commands, clock);
    const answered = await coordinator.request(
      { kind: 'draft', id: ID, baseRevision: 'b'.repeat(64), draft: DRAFT },
      EMPTY_PREVIEW_INPUTS
    );
    expect(answered.kind).toBe('idle');
    expect(coordinator.current().kind).toBe('idle');
    expect(calls).toEqual([]);
  });

  it('installs and sends nothing for a request cleared by a getter on its inputs while being built', async () => {
    const { commands, calls } = deferredCommands();
    const coordinator = createPreviewCoordinator(commands, fixedClock());
    const inputs = new Proxy(EMPTY_PREVIEW_INPUTS, {
      get(target, key, receiver): unknown {
        coordinator.clear();
        return Reflect.get(target, key, receiver);
      }
    });
    const answered = await coordinator.request(
      { kind: 'draft', id: ID, baseRevision: 'b'.repeat(64), draft: DRAFT },
      inputs
    );
    expect(answered.kind).toBe('idle');
    expect(coordinator.current().kind).toBe('idle');
    expect(calls).toEqual([]);
  });
});

describe('an unsaved draft goes through the candidate reader', () => {
  it('sends the draft as a Draft operation against its base revision, with the samples', async () => {
    const { commands, candidates, calls } = deferredCommands();
    const coordinator = createPreviewCoordinator(commands, fixedClock());
    const inputs = withCapture(EMPTY_PREVIEW_INPUTS, 'n', '1');
    const pending = coordinator.request({ kind: 'draft', id: ID, baseRevision: 'b'.repeat(64), draft: DRAFT }, inputs);
    expect(calls.map((call) => call.name)).toEqual(['previewMatchCandidate']);
    expect(calls[0]?.args).toEqual([
      ID,
      { Draft: { draft: DRAFT } },
      'b'.repeat(64),
      {
        selections: [],
        form_values: [],
        captures: [{ name: 'n', value: '1' }],
        instant: { unix_seconds: 1_711_846_800, zone: { Named: { name: 'Europe/Madrid' } } }
      }
    ]);
    const analysis = { declarations: [], captures: [] } as unknown as AnalysisSummary;
    candidates[0]?.resolve({
      ok: true,
      value: { candidate: 'c'.repeat(64), preview: literalPreview('drafted'), analysis }
    });
    const state = await pending;
    expect(state.kind === 'shown' && [state.candidate, state.analysis]).toEqual(['c'.repeat(64), analysis]);
  });

  it('answers a candidate holding no snippet at that place as its own state, and a refusal as a failure', async () => {
    const { commands, candidates } = deferredCommands();
    const coordinator = createPreviewCoordinator(commands, fixedClock());
    const target = { kind: 'draft', id: ID, baseRevision: 'b'.repeat(64), draft: DRAFT } as const;
    const first = coordinator.request(target, EMPTY_PREVIEW_INPUTS);
    candidates[0]?.resolve({ ok: true, value: { candidate: 'c'.repeat(64), preview: null, analysis: null } });
    expect(await first).toMatchObject({ kind: 'noMatchInCandidate', candidate: 'c'.repeat(64) });
    const second = coordinator.request(target, EMPTY_PREVIEW_INPUTS);
    candidates[1]?.resolve({
      ok: false,
      failure: { kind: 'command', error: { code: 'identityStaleRevision' } } as never
    });
    expect(await second).toMatchObject({ kind: 'failed', failure: { kind: 'command' } });
  });
});

describe('the preview changes no draft and no file', () => {
  it('neither writes nor keeps the caller\'s draft, and the request holds a frozen copy', async () => {
    const draft = deepFreeze(structuredClone(DRAFT) as MatchDraft);
    const before = JSON.stringify(draft);
    const { commands, candidates, calls } = deferredCommands();
    const coordinator = createPreviewCoordinator(commands, fixedClock());
    const pending = coordinator.request({ kind: 'draft', id: ID, baseRevision: 'b'.repeat(64), draft }, EMPTY_PREVIEW_INPUTS);
    candidates[0]?.resolve({ ok: true, value: { candidate: 'c'.repeat(64), preview: literalPreview('x'), analysis: null } });
    const state = await pending;
    expect(JSON.stringify(draft)).toBe(before);
    const sent = calls[0]?.args[1] as { Draft: { draft: MatchDraft } };
    expect(sent.Draft.draft).toEqual(draft);
    expect(sent.Draft.draft).not.toBe(draft);
    expect(state.kind !== 'idle' && state.request.target.kind === 'draft' && Object.isFrozen(state.request.target.draft.var_intents)).toBe(true);

    // A caller that goes on editing its own (unfrozen) object does not change
    // what an earlier request describes.
    const editable = structuredClone(DRAFT) as { replace: unknown };
    const request = previewRequestOf(
      { kind: 'draft', id: ID, baseRevision: 'b'.repeat(64), draft: editable as unknown as MatchDraft },
      EMPTY_PREVIEW_INPUTS,
      fixedClock()
    );
    editable.replace = { Set: 'edited later' };
    expect(request.target.kind === 'draft' && request.target.draft.replace).toEqual({ Set: '<b>{{pick}}</b>' });
    expect(Object.isFrozen(editable)).toBe(false);
  });

  it('reaches no command but the two readers', async () => {
    const touched: PropertyKey[] = [];
    const { commands, saved, candidates } = deferredCommands();
    const watched = new Proxy(commands, {
      get(target, key, receiver) {
        touched.push(key);
        return Reflect.get(target, key, receiver) as unknown;
      }
    });
    const coordinator = createPreviewCoordinator(watched, fixedClock());
    const first = coordinator.request({ kind: 'saved', id: ID }, EMPTY_PREVIEW_INPUTS);
    saved[0]?.resolve({ ok: true, value: literalPreview('x') });
    await first;
    const second = coordinator.request({ kind: 'draft', id: ID, baseRevision: 'b'.repeat(64), draft: DRAFT }, EMPTY_PREVIEW_INPUTS);
    candidates[0]?.resolve({ ok: true, value: { candidate: 'c'.repeat(64), preview: null, analysis: null } });
    await second;
    expect([...new Set(touched)].sort()).toEqual(['previewMatch', 'previewMatchCandidate']);
    expect(Object.keys(REAL_PREVIEW_COMMANDS).sort()).toEqual(['previewMatch', 'previewMatchCandidate']);
  });

  it('imports no draft model and no writing wrapper — only the two readers from the IPC layer', () => {
    const source = readFileSync(new URL('./preview.ts', import.meta.url), 'utf8');
    const imports = [...source.matchAll(/^import\s+(type\s+)?\{([^}]*)\}\s+from\s+'([^']+)';/gm)].map(
      (found) => ({ type: found[1] !== undefined, names: found[2]?.split(',').map((name) => name.trim()).filter(Boolean), from: found[3] })
    );
    expect(imports.map((found) => found.from).sort()).toEqual([
      '../ipc/commands',
      '../ipc/commands',
      '../ipc/errors',
      '../ipc/errors',
      '../ipc/types'
    ]);
    expect(source.match(/^import /gm)).toHaveLength(imports.length);
    const valueImportsFromCommands = imports.filter((found) => found.from === '../ipc/commands' && !found.type);
    expect(valueImportsFromCommands.flatMap((found) => found.names)).toEqual(['previewMatch', 'previewMatchCandidate']);
    for (const writer of [
      'moveMatch',
      'saveMatch',
      'createMatch',
      'deleteMatch',
      'saveRawDocument',
      'duplicateMatch',
      'saveMatchItemText',
      'applyBulkOptions',
      'moveVariable',
      'updateSidecar',
      'editDraft',
      'amendDraft'
    ]) {
      expect(source).not.toMatch(new RegExp(`\\b${writer}\\b`));
    } // End of the loop over the writing names
  });
});

describe('no execution and no clipboard-read control', () => {
  it('exports nothing that runs, tests or reads the clipboard', async () => {
    const exported = Object.keys(await import('./preview')).join(' ');
    expect(exported).not.toMatch(/run|exec|spawn|shell|script|clipboard|paste/i);
    const source = readFileSync(new URL('./preview.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/navigator\.clipboard|readText|child_process|plugin-shell/);
  });
});
