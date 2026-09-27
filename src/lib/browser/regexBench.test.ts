/**
 * Phase 4-22 — the regex bench's model (`./regexBench.ts`): the coordinator's
 * supersession, the view, the *Regex capture* offer and the insertion.
 *
 * Plain values in the default `node` environment; the mounted half is
 * `../components/RegexBench.test.ts`. Every `test_regex` answer is scripted,
 * so nothing here says what Rust's `regex` accepts.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own.
 */

import { describe, expect, it } from 'vitest';
import type { CommandResult } from '../ipc/commands';
import type { RegexBenchAnswer, RegexOutcome } from '../ipc/types';
import { makeMatch } from './fixtures';
import { editField, editRegex, startMatchEditor, type MatchEditorSession } from './matchEditor';
import {
  benchPatternOf,
  captureOfferOf,
  captureTargetOf,
  createRegexBenchCoordinator,
  insertCaptureReference,
  REGEX_BENCH_IDLE,
  regexBenchViewOf,
  type RegexBenchCommands,
  type RegexBenchState
} from './regexBench';

/** The engine every scripted answer names. */
const ENGINE = Object.freeze({ name: 'regex', version: '1.13.1' });

/**
 * A session over a regex snippet with body `xy`.
 *
 * @param regex - The pattern.
 * @returns The session.
 */
function regexSession(regex = '(?P<alpha>a)'): MatchEditorSession {
  return startMatchEditor(
    makeMatch({ revision: 'r'.repeat(64), trigger: null, regex, triggerKind: 'Regex', replace: 'xy' }),
    () => 0
  );
} // End of function regexSession()

/**
 * A settled state that answered `outcome` for `pattern`.
 *
 * @param pattern - The pattern the request carried.
 * @param outcome - What Rust answered.
 * @returns The state.
 */
function answered(pattern: string, outcome: RegexOutcome): RegexBenchState {
  return {
    kind: 'answered',
    request: { requestId: 1, pattern, sample: 's' },
    answer: { request_id: 1, engine: ENGINE, outcome }
  };
} // End of function answered()

/** A fake reader whose calls a case answers by hand. */
function handFake(): {
  readonly commands: RegexBenchCommands;
  readonly resolvers: ((reply: CommandResult<RegexBenchAnswer>) => void)[];
  readonly rejecters: ((raw: unknown) => void)[];
} {
  const resolvers: ((reply: CommandResult<RegexBenchAnswer>) => void)[] = [];
  const rejecters: ((raw: unknown) => void)[] = [];
  return {
    commands: {
      testRegex: () =>
        new Promise((resolve, reject) => {
          resolvers.push(resolve);
          rejecters.push(reject);
        })
    },
    resolvers,
    rejecters
  };
} // End of function handFake()

/**
 * A successful reply.
 *
 * @param id - The echoed id.
 * @param names - The group names.
 * @returns The reply.
 */
function reply(id: number, names: readonly string[]): CommandResult<RegexBenchAnswer> {
  return { ok: true, value: { request_id: id, engine: ENGINE, outcome: { Tested: { group_names: names, found: null } } } };
} // End of function reply()

describe('createRegexBenchCoordinator', () => {
  it('numbers requests, drops an earlier reply resolving after a later one, and never installs it', async () => {
    const fake = handFake();
    const seen: RegexBenchState[] = [];
    const bench = createRegexBenchCoordinator(fake.commands, (state) => seen.push(state));
    const first = bench.request('p1', 's');
    const second = bench.request('p2', 's');
    fake.resolvers[1]?.(reply(2, ['two']));
    await second;
    fake.resolvers[0]?.(reply(1, ['one']));
    const late = await first;
    const current = bench.current();
    expect(current.kind).toBe('answered');
    expect(current.kind === 'answered' && current.request).toEqual({ requestId: 2, pattern: 'p2', sample: 's' });
    expect(late).toBe(current);
    expect(seen.some((state) => state.kind === 'answered' && state.request.requestId === 1)).toBe(false);
  });

  it('keeps the last settled answer while the next request is out', async () => {
    const fake = handFake();
    const bench = createRegexBenchCoordinator(fake.commands);
    const first = bench.request('p', 'a');
    fake.resolvers[0]?.(reply(1, ['g']));
    await first;
    void bench.request('p', 'b');
    const pending = bench.current();
    expect(pending.kind).toBe('pending');
    expect(pending.kind === 'pending' && pending.last?.request.sample).toBe('a');
  });

  it('settles a wrong echo, a failed call and a rejection as failures', async () => {
    const fake = handFake();
    const bench = createRegexBenchCoordinator(fake.commands);
    const one = bench.request('p', 's');
    fake.resolvers[0]?.(reply(7, ['g']));
    expect(await one).toMatchObject({ kind: 'failed', failure: { kind: 'wrongRequest' } });
    const two = bench.request('p', 's');
    fake.resolvers[1]?.({ ok: false, failure: { kind: 'transport', message: 'x' } as never });
    expect(await two).toMatchObject({ kind: 'failed', failure: { kind: 'ipc' } });
    const three = bench.request('p', 's');
    fake.rejecters[2]?.(new Error('boom'));
    expect(await three).toMatchObject({ kind: 'failed', failure: { kind: 'ipc' } });
  });

  it('clear() drops what is in flight', async () => {
    const fake = handFake();
    const bench = createRegexBenchCoordinator(fake.commands);
    const out = bench.request('p', 's');
    bench.clear();
    fake.resolvers[0]?.(reply(1, ['g']));
    await out;
    expect(bench.current()).toBe(REGEX_BENCH_IDLE);
  });
});

describe('regexBenchViewOf', () => {
  it('says a result is behind when the pattern or the sample changed', () => {
    const state = answered('p', { Tested: { group_names: [], found: null } });
    expect(regexBenchViewOf(state, 'p', 's').behind).toBe(false);
    expect(regexBenchViewOf(state, 'q', 's').behind).toBe(true);
    expect(regexBenchViewOf(state, 'p', 't').behind).toBe(true);
    expect(regexBenchViewOf(REGEX_BENCH_IDLE, null, '').testable).toBe(false);
  });

  it('carries a compile failure’s reason and marks a non-subset name as not a reference', () => {
    const refused = regexBenchViewOf(
      answered('p', { Refused: { refusal: { CompileRejected: { reason: 'CompiledTooBig' } } } }),
      'p',
      's'
    ).result;
    expect(refused).toMatchObject({ kind: 'refused', compileFailure: 'CompiledTooBig' });
    const listed = regexBenchViewOf(answered('p', { Tested: { group_names: ['ok_1', 'a.b'], found: null } }), 'p', 's');
    expect(listed.result).toMatchObject({
      kind: 'notFound',
      groups: [
        { name: 'ok_1', reference: '{{ok_1}}' },
        { name: 'a.b', reference: null }
      ]
    });
  });
});

describe('captureOfferOf', () => {
  it('offers only the current, compiled pattern’s names', () => {
    const session = regexSession('(?P<alpha>a)');
    expect(benchPatternOf(session)).toBe('(?P<alpha>a)');
    const state = answered('(?P<alpha>a)', { Tested: { group_names: ['alpha'], found: null } });
    expect(captureOfferOf(session, state)).toEqual({
      kind: 'offered',
      pattern: '(?P<alpha>a)',
      captures: [{ name: 'alpha', reference: '{{alpha}}' }]
    });
    expect(captureOfferOf(editRegex(session, '(?P<beta>b)'), state).kind).toBe('withheld');
    expect(captureOfferOf(session, answered('(?P<alpha>a)', { Refused: { refusal: 'SampleTooLarge' } })).kind).toBe(
      'withheld'
    );
    expect(captureOfferOf(session, REGEX_BENCH_IDLE).kind).toBe('withheld');
  });

  it('withholds the row for a snippet whose drafted trigger form is not regex', () => {
    const literal = startMatchEditor(makeMatch({ revision: 'r'.repeat(64), trigger: ':a', replace: 'b' }), () => 0);
    expect(benchPatternOf(literal)).toBeNull();
    expect(captureOfferOf(literal, answered('', { Tested: { group_names: ['g'], found: null } })).kind).toBe(
      'withheld'
    );
  });
});

describe('insertCaptureReference', () => {
  const state = answered('(?P<alpha>a)', { Tested: { group_names: ['alpha', 'año'], found: null } });

  it('puts {{name}} in place of the selection, as one step, and drafts no variable', () => {
    const session = regexSession();
    const outcome = insertCaptureReference(session, state, 'alpha', 'replace', { start: 1, end: 2 });
    expect(outcome.kind).toBe('inserted');
    if (outcome.kind !== 'inserted') {
      return;
    }
    expect(outcome.session.draft.value.replace.text).toBe('x{{alpha}}');
    expect(outcome.selection).toEqual({ start: 10, end: 10 });
    expect(outcome.session.draft.value.variables).toEqual(session.draft.value.variables);
    expect(outcome.session.focus).toBe('replace');
  });

  it('refuses a stale pattern, an unknown name, a non-subset name and a key that takes no reference', () => {
    const session = regexSession();
    const at = { start: 0, end: 0 };
    expect(insertCaptureReference(editRegex(session, 'x'), state, 'alpha', 'replace', at)).toMatchObject({
      kind: 'refused',
      refusal: 'notOffered'
    });
    expect(insertCaptureReference(session, state, 'beta', 'replace', at)).toMatchObject({ refusal: 'notACapture' });
    expect(insertCaptureReference(session, state, 'año', 'replace', at)).toMatchObject({ refusal: 'notAReference' });
    expect(insertCaptureReference(session, state, 'alpha', 'html', at)).toMatchObject({ refusal: 'noTarget' });
  });

  it('chooses the target: chosen, then focus, then the one focused last, then the first', () => {
    const session = regexSession();
    expect(captureTargetOf(session, null, null)).toBe('replace');
    expect(captureTargetOf(session, 'html', 'markdown')).toBe('replace');
    const typed = editField(session, 'replace', 'xyz');
    expect(captureTargetOf(typed, null, null)).toBe('replace');
  });
});
