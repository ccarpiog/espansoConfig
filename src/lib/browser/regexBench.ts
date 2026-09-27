/**
 * The regex bench and the *Regex capture* insertion — Phase 4-22.
 *
 * **Decisions as values; no component and no sentence.** `RegexBench.svelte`
 * draws {@link regexBenchViewOf}'s answer, and `VariableGroup.svelte` draws the
 * *Regex capture* `+ Insert` row from {@link captureOfferOf} and spends it
 * through {@link insertCaptureReference}. Codes stay typed; the components turn
 * them into sentences through `src/lib/i18n`.
 *
 * ## What the bench tests
 *
 * The snippet's **drafted** `regex` trigger ({@link benchPatternOf}), exactly as
 * its box holds it, against a sample the person types. The search is Rust's
 * (`test_regex`, Phase 4-21: this crate's `regex`, first match, no anchor
 * added); nothing here compiles, matches or slices a pattern, and JavaScript's
 * `RegExp` is never used (ruling 28). A request is sent only when the person
 * presses *Test* — never while typing — so the regex box's own sentence ("checked
 * when you save, not while you type") stays true of the save.
 *
 * ## Out-of-order replies
 *
 * {@link createRegexBenchCoordinator} numbers every request, and the number is
 * the `request_id` Rust echoes. An answer is installed only when its request is
 * still the latest one sent, compared immediately before installing, **and**
 * the echoed id is that request's; an earlier request answering after a later
 * one is dropped, never shown. An echo naming another request is drawn as a
 * failure of its own rather than as the answer.
 *
 * ## Captures come from the current pattern
 *
 * {@link captureOfferOf} offers the named groups of the last settled answer
 * only while that answer's pattern is, character for character, the pattern
 * the draft holds now, and only when Rust compiled it (`Tested`). An edit of
 * the regex box withdraws the offer until the pattern is tested again; a
 * sample that does not match keeps it (a group's name is the pattern's, not
 * the sample's — `phase-4-design.md` Q7). A name outside the supported
 * placeholder subset is listed but not insertable (ruling 16).
 *
 * ## The insertion creates no variable
 *
 * {@link insertCaptureReference} puts `{{name}}` in place of one content key's
 * selection, as one history step, and touches nothing else: `vars` is not
 * written, so no structure grant is asked for (R36 covers variable and form
 * structural actions; this is a text edit, as *Insert cursor position* is).
 *
 * ## What it cannot force
 *
 * - That a caller hands {@link insertCaptureReference} the coordinator's
 *   current state: it re-derives the offer from the state and the session it
 *   is given, so a state read at the press is the caller's to supply.
 * - That the sample sent is what a person typed: a `<textarea>` normalizes its
 *   line breaks to LF before the value reaches this module (`CLAUDE.md` §6), and
 *   the bench says so beside the box rather than reconstructing anything.
 */

import { testRegex, type CommandResult } from '../ipc/commands';
import { classifyFailure, type IpcFailure } from '../ipc/errors';
import type {
  RegexBenchAnswer,
  RegexCompileFailure,
  RegexEngine,
  RegexRefusal,
  RegexSpan
} from '../ipc/types';
import type { TranslationKey } from '../i18n/dictionaries';
import {
  recordCompoundChange,
  type MatchBuffers,
  type MatchEditorSession,
  type TextSelection
} from './matchEditor';
import { choiceTargetsOf } from './variableGroup';
import { isReferenceIdentifier, type ReferenceField } from './variableInsertion';

// ---------------------------------------------------------------------------
// The command surface
// ---------------------------------------------------------------------------

/**
 * The one reader the bench may reach — its own injectable surface, as
 * `PreviewCommands` is, so the bench can be handed nothing that writes.
 */
export interface RegexBenchCommands {
  /**
   * `test_regex` (Phase 4-21): stateless, no document, no file.
   *
   * @param requestId - The request's number, echoed in the answer.
   * @param pattern - The pattern, exactly as drafted.
   * @param sample - The text to search.
   * @returns The answer, or a failure of the call itself.
   */
  testRegex(requestId: number, pattern: string, sample: string): Promise<CommandResult<RegexBenchAnswer>>;
}

/** The real boundary. */
export const REAL_REGEX_BENCH_COMMANDS: RegexBenchCommands = Object.freeze({ testRegex });

// ---------------------------------------------------------------------------
// State and coordination
// ---------------------------------------------------------------------------

/** One request as it was sent. */
export interface RegexBenchRequest {
  /** Its number, which is also its generation. */
  readonly requestId: number;
  /** The pattern sent. */
  readonly pattern: string;
  /** The sample sent. */
  readonly sample: string;
}

/** Why a request has no answer to draw. */
export type RegexBenchFailure =
  | {
      /** The call itself failed. */
      readonly kind: 'ipc';
      /** How. */
      readonly failure: IpcFailure;
    }
  | {
      /** The answer echoed another request's number, so it is not this request's. */
      readonly kind: 'wrongRequest';
    };

/** A request that settled. */
export type RegexBenchSettled =
  | {
      /** Rust answered it. */
      readonly kind: 'answered';
      /** The request. */
      readonly request: RegexBenchRequest;
      /** Rust's answer, a refusal included. */
      readonly answer: RegexBenchAnswer;
    }
  | {
      /** It has no answer to draw. */
      readonly kind: 'failed';
      /** The request. */
      readonly request: RegexBenchRequest;
      /** Why. */
      readonly failure: RegexBenchFailure;
    };

/** What the bench holds. */
export type RegexBenchState =
  | {
      /** Nothing was sent. */
      readonly kind: 'idle';
    }
  | {
      /** A request is out. */
      readonly kind: 'pending';
      /** The request. */
      readonly request: RegexBenchRequest;
      /** The last settled request, still drawn while this one is out. */
      readonly last: RegexBenchSettled | null;
    }
  | RegexBenchSettled;

/** Nothing sent. */
export const REGEX_BENCH_IDLE: RegexBenchState = Object.freeze({ kind: 'idle' as const });

/** One bench's coordinator. */
export interface RegexBenchCoordinator {
  /**
   * The current state.
   *
   * @returns The state.
   */
  current(): RegexBenchState;
  /**
   * Sends one request, superseding every earlier one.
   *
   * @param pattern - The pattern.
   * @param sample - The sample.
   * @returns The state once this request settled — or, when a later request
   *   or a {@link RegexBenchCoordinator.clear} superseded it first, the state
   *   at that moment, which this answer did not change.
   */
  request(pattern: string, sample: string): Promise<RegexBenchState>;
  /** Supersedes everything in flight and returns to idle. */
  clear(): void;
}

/**
 * The last settled request a state holds.
 *
 * @param state - The state.
 * @returns The settled request, or `null`.
 */
export function settledOf(state: RegexBenchState): RegexBenchSettled | null {
  if (state.kind === 'idle') {
    return null;
  }
  return state.kind === 'pending' ? state.last : state;
} // End of function settledOf()

/**
 * Builds a coordinator over `commands`.
 *
 * **Supersession is a counter.** Every request and every clear takes the next
 * number; the number is the request's `requestId`. An answer is installed only
 * when its number is still the latest, compared immediately before installing
 * with nothing read in between, and only when Rust echoed that number. A
 * rejection from the injected command settles as an `ipc` failure, so every
 * request settles.
 *
 * @param commands - The reader.
 * @param onChange - Called with every new state, after it is installed.
 * @returns The coordinator.
 */
export function createRegexBenchCoordinator(
  commands: RegexBenchCommands,
  onChange: (state: RegexBenchState) => void = () => {}
): RegexBenchCoordinator {
  let latest = 0;
  let state: RegexBenchState = REGEX_BENCH_IDLE;

  const install = (next: RegexBenchState): void => {
    state = next;
    onChange(next);
  };

  return {
    current: (): RegexBenchState => state,

    async request(pattern: string, sample: string): Promise<RegexBenchState> {
      latest += 1;
      const requestId = latest;
      const request: RegexBenchRequest = Object.freeze({ requestId, pattern: String(pattern), sample: String(sample) });
      install(Object.freeze({ kind: 'pending' as const, request, last: settledOf(state) }));
      let settled: RegexBenchSettled;
      try {
        const reply = await commands.testRegex(requestId, request.pattern, request.sample);
        settled = !reply.ok
          ? Object.freeze({ kind: 'failed' as const, request, failure: Object.freeze({ kind: 'ipc' as const, failure: reply.failure }) })
          : reply.value.request_id !== requestId
            ? Object.freeze({ kind: 'failed' as const, request, failure: Object.freeze({ kind: 'wrongRequest' as const }) })
            : Object.freeze({ kind: 'answered' as const, request, answer: reply.value });
      } catch (raw: unknown) {
        settled = Object.freeze({
          kind: 'failed' as const,
          request,
          failure: Object.freeze({ kind: 'ipc' as const, failure: classifyFailure(raw) })
        });
      }
      if (requestId !== latest) {
        return state;
      }
      install(settled);
      return state;
    }, // End of method request()

    clear(): void {
      latest += 1;
      install(REGEX_BENCH_IDLE);
    }
  };
} // End of function createRegexBenchCoordinator()

// ---------------------------------------------------------------------------
// What the bench draws
// ---------------------------------------------------------------------------

/**
 * The pattern the bench tests: the drafted `regex` trigger's text while the
 * drafted trigger form is `regex`, else `null` (no bench, no capture row).
 *
 * @param session - The editing session.
 * @returns The pattern, exactly as the box holds it, or `null`.
 */
export function benchPatternOf(session: MatchEditorSession): string | null {
  const side = session.draft.value.triggerSide;
  return side.form === 'regex' ? side.regex.text : null;
} // End of function benchPatternOf()

/** One named group, as the bench lists it. */
export interface BenchGroupRow {
  /** The name, as the pattern writes it. */
  readonly name: string;
  /** What it captured, or `null` when it took no part (or nothing matched). */
  readonly capture: RegexSpan | null;
  /** `{{name}}`, or `null` when the name is outside the supported subset. */
  readonly reference: string | null;
}

/** A settled request, as the bench draws it. */
export type BenchResult =
  | {
      /** The pattern compiled and matched. */
      readonly kind: 'found';
      /** The engine Rust names. */
      readonly engine: RegexEngine;
      /** The first match. */
      readonly whole: RegexSpan;
      /** Every named group, in pattern order. */
      readonly groups: readonly BenchGroupRow[];
    }
  | {
      /** The pattern compiled and matches nowhere in the sample. */
      readonly kind: 'notFound';
      /** The engine Rust names. */
      readonly engine: RegexEngine;
      /** Every named group, none captured. */
      readonly groups: readonly BenchGroupRow[];
    }
  | {
      /** Rust refused the request. */
      readonly kind: 'refused';
      /** The engine Rust names. */
      readonly engine: RegexEngine;
      /** Why. */
      readonly refusal: RegexRefusal;
      /** A compile failure's own reason, or `null` for any other refusal. */
      readonly compileFailure: RegexCompileFailure | null;
    }
  | {
      /** No answer to draw. */
      readonly kind: 'failed';
      /** Why. */
      readonly failure: RegexBenchFailure;
    };

/** What the bench draws now. */
export interface RegexBenchView {
  /** Whether there is a pattern to test (the drafted trigger form is `regex`). */
  readonly testable: boolean;
  /** Whether a request is out. */
  readonly pending: boolean;
  /** The last settled request, or `null`. */
  readonly result: BenchResult | null;
  /**
   * Whether the pattern or the sample now differs from what that result was
   * tested with — the result is kept, and said to be behind.
   */
  readonly behind: boolean;
}

/**
 * One group row.
 *
 * @param name - The group's name.
 * @param capture - What it captured, or `null`.
 * @returns The row.
 */
function groupRow(name: string, capture: RegexSpan | null): BenchGroupRow {
  return { name, capture, reference: isReferenceIdentifier(name) ? `{{${name}}}` : null };
} // End of function groupRow()

/**
 * A settled request as the bench draws it.
 *
 * @param settled - The settled request.
 * @returns The result.
 */
export function benchResultOf(settled: RegexBenchSettled): BenchResult {
  if (settled.kind === 'failed') {
    return { kind: 'failed', failure: settled.failure };
  }
  const { engine, outcome } = settled.answer;
  if ('Refused' in outcome) {
    const refusal = outcome.Refused.refusal;
    const compileFailure = typeof refusal === 'object' ? refusal.CompileRejected.reason : null;
    return { kind: 'refused', engine, refusal, compileFailure };
  }
  const { group_names: names, found } = outcome.Tested;
  if (found === null) {
    return { kind: 'notFound', engine, groups: names.map((name) => groupRow(name, null)) };
  }
  return {
    kind: 'found',
    engine,
    whole: found.whole,
    groups: found.groups.map((group) => groupRow(group.name, group.capture))
  };
} // End of function benchResultOf()

/**
 * What the bench draws for a state, the pattern the draft holds and the sample
 * the box holds.
 *
 * @param state - The coordinator's state.
 * @param pattern - {@link benchPatternOf}'s answer now.
 * @param sample - The sample box's text now.
 * @returns The view.
 */
export function regexBenchViewOf(state: RegexBenchState, pattern: string | null, sample: string): RegexBenchView {
  const settled = settledOf(state);
  return {
    testable: pattern !== null,
    pending: state.kind === 'pending',
    result: settled === null ? null : benchResultOf(settled),
    behind: settled !== null && (settled.request.pattern !== pattern || settled.request.sample !== sample)
  };
} // End of function regexBenchViewOf()

// ---------------------------------------------------------------------------
// The *Regex capture* row
// ---------------------------------------------------------------------------

/** One capture the row lists. */
export interface CaptureChoice {
  /** The group's name. */
  readonly name: string;
  /** `{{name}}`, or `null` when it cannot be inserted as a reference. */
  readonly reference: string | null;
}

/** Whether the *Regex capture* row is shown, and what it lists. */
export type CaptureOffer =
  | {
      /** Shown: the drafted regex was tested as it stands and compiled. */
      readonly kind: 'offered';
      /** The pattern the captures belong to — the draft's, now. */
      readonly pattern: string;
      /** Every named group, in pattern order; possibly none. */
      readonly captures: readonly CaptureChoice[];
    }
  | {
      /** Not shown. */
      readonly kind: 'withheld';
    };

/** The row withheld. */
const WITHHELD: CaptureOffer = Object.freeze({ kind: 'withheld' as const });

/**
 * The *Regex capture* row: offered only for a **current, compiling** regex
 * trigger — the drafted form is `regex`, the last settled request tested
 * exactly the pattern the draft holds now, and Rust compiled it. The names are
 * that answer's `group_names`, so they are the current pattern's, match or no
 * match.
 *
 * @param session - The editing session.
 * @param state - The bench's state.
 * @returns The offer.
 */
export function captureOfferOf(session: MatchEditorSession, state: RegexBenchState): CaptureOffer {
  const pattern = benchPatternOf(session);
  const settled = settledOf(state);
  if (pattern === null || settled === null || settled.kind !== 'answered' || settled.request.pattern !== pattern) {
    return WITHHELD;
  }
  const outcome = settled.answer.outcome;
  if (!('Tested' in outcome)) {
    return WITHHELD;
  }
  return {
    kind: 'offered',
    pattern,
    captures: outcome.Tested.group_names.map((name) => ({
      name,
      reference: isReferenceIdentifier(name) ? `{{${name}}}` : null
    }))
  };
} // End of function captureOfferOf()

/**
 * The content key a capture's reference goes into: the one chosen when it can
 * take one, else the focused content key, else the one focused last, else the
 * first that can; `null` when none can.
 *
 * @param session - The editing session.
 * @param chosen - The key the person chose, or `null`.
 * @param lastContent - The content key focused last, or `null`.
 * @returns The target, or `null`.
 */
export function captureTargetOf(
  session: MatchEditorSession,
  chosen: ReferenceField | null,
  lastContent: ReferenceField | null
): ReferenceField | null {
  const targets = choiceTargetsOf(session);
  const focus = session.focus as string | null;
  for (const candidate of [chosen, focus, lastContent]) {
    if (candidate !== null && (targets as readonly string[]).includes(candidate)) {
      return candidate as ReferenceField;
    }
  } // End of the loop over the preferred targets
  return targets[0] ?? null;
} // End of function captureTargetOf()

/** Why a capture's reference was not inserted — a code, never a sentence. */
export type CaptureInsertRefusal =
  /** The row is not offered now: no current, compiling regex trigger. */
  | 'notOffered'
  /** The name is not one of the current pattern's named groups. */
  | 'notACapture'
  /** The name is outside the supported placeholder subset. */
  | 'notAReference'
  /** The content key cannot take a reference now. */
  | 'noTarget';

/** What a capture insertion did. */
export type CaptureInsertOutcome =
  | {
      /** `{{name}}` drafted, as one history step; no variable created. */
      readonly kind: 'inserted';
      /** The session holding it. */
      readonly session: MatchEditorSession;
      /** The caret just after the reference, in UTF-16 code units. */
      readonly selection: TextSelection;
    }
  | {
      /** Nothing drafted. */
      readonly kind: 'refused';
      /** The same session. */
      readonly session: MatchEditorSession;
      /** Why. */
      readonly refusal: CaptureInsertRefusal;
    };

/**
 * A position clamped into a text, or the text's end when it is not an integer.
 *
 * @param position - What the control reported.
 * @param length - The text's length in code units.
 * @returns A usable index.
 */
function clamped(position: number, length: number): number {
  if (!Number.isInteger(position)) {
    return length;
  }
  return Math.min(Math.max(position, 0), length);
} // End of function clamped()

/**
 * *Insert* on the *Regex capture* row: `{{name}}` in place of one content key's
 * selection, one history step, **and nothing else** — no variable, no `vars`.
 *
 * The offer is re-derived here from the session and the state handed in, so a
 * name is inserted only while it is a group of the pattern the draft holds now
 * and that pattern compiled; the body is read once.
 *
 * @param session - The editing session.
 * @param state - The bench's state, read at the press.
 * @param name - The capture's name.
 * @param field - The content key.
 * @param selection - Its box's selection, in UTF-16 code units; non-integers
 *   mean the end of the text.
 * @returns What happened.
 */
export function insertCaptureReference(
  session: MatchEditorSession,
  state: RegexBenchState,
  name: string,
  field: ReferenceField,
  selection: TextSelection
): CaptureInsertOutcome {
  const offer = captureOfferOf(session, state);
  if (offer.kind !== 'offered') {
    return { kind: 'refused', session, refusal: 'notOffered' };
  }
  const choice = offer.captures.find((one) => one.name === name);
  if (choice === undefined) {
    return { kind: 'refused', session, refusal: 'notACapture' };
  }
  if (choice.reference === null) {
    return { kind: 'refused', session, refusal: 'notAReference' };
  }
  if (!choiceTargetsOf(session).includes(field)) {
    return { kind: 'refused', session, refusal: 'noTarget' };
  }
  const reference = choice.reference;
  const buffers = session.draft.value;
  const text = buffers[field].text;
  const first = clamped(selection.start, text.length);
  const second = clamped(selection.end, text.length);
  const start = Math.min(first, second);
  const end = Math.max(first, second);
  const next: MatchBuffers = {
    ...buffers,
    [field]: { text: `${text.slice(0, start)}${reference}${text.slice(end)}`, removed: false }
  };
  const after = recordCompoundChange(session, next, field);
  const caret = start + reference.length;
  return { kind: 'inserted', session: after, selection: { start: caret, end: caret } };
} // End of function insertCaptureReference()

/**
 * The dictionary key holding one capture refusal's sentence.
 *
 * @param refusal - Why nothing was inserted.
 * @returns The key.
 */
export function captureInsertRefusalKey(refusal: CaptureInsertRefusal): TranslationKey {
  switch (refusal) {
    case 'notOffered':
      return 'browser.variableGroup.capture.notOffered';
    case 'notACapture':
      return 'browser.variableGroup.capture.notACapture';
    case 'notAReference':
      return 'browser.regexBench.notAReference';
    case 'noTarget':
      return 'browser.variableGroup.choice.noTarget';
  }
} // End of function captureInsertRefusalKey()
