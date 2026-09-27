/**
 * The illustrative preview's model and coordination — Phase 4-19-1.
 *
 * ## What it is
 *
 * Everything below the preview components 4-19-2 draws: the **sample inputs**
 * a person chooses for one example (which `choice`/`random` entry, what each
 * form field holds, what each regex capture matched, and optionally a pinned
 * instant), the **request** those inputs become — with the sample instant and
 * zone read here, in the frontend, through an injected {@link SampleClock} —
 * and the **state** the answer leaves behind: the illustrative output, its
 * limitations as typed codes, the instant and zone it was shown at, or the
 * failure. {@link createPreviewCoordinator} sends one request at a time over
 * two read-only commands and never lets a superseded answer overwrite a
 * current one.
 *
 * Two targets: the snippet's **saved** text (`preview_match`, Phase 4-17) and
 * an open editor's **draft**, saved or not (`preview_match_candidate`, Phase
 * 4-19-1), which Rust plans with the writer's own planner, patches in memory,
 * reparses and previews — never writing it.
 *
 * ## What it deliberately does not do
 *
 * - **It changes no draft and no file.** It imports nothing from `./draft.ts`
 *   or `./matchEditor.ts` and no writing wrapper from `../ipc/commands.ts`; the
 *   only commands it can reach are the two in {@link PreviewCommands}, both
 *   readers. A draft handed to it is copied as it would cross the wire and the
 *   copy is frozen; the caller's object is never written. `preview.test.ts`
 *   pins all three: the import list, the command surface, and a deep-frozen
 *   draft that would throw on any write.
 * - **It offers no execution and no clipboard read.** `shell`, `script`,
 *   `clipboard` and `match` variables come back from Rust as placeholders, and
 *   nothing here has a member that runs, tests or reads anything.
 * - **It renders nothing and holds no sentence.** Codes stay typed
 *   ({@link PreviewUnresolved}, {@link PreviewPlaceholderName},
 *   {@link PreviewLimit}) so a component draws them through
 *   `describePreviewUnresolved`, `describePreviewPlaceholder` and
 *   `describePreviewLimit` in `src/lib/i18n/codes.ts`. **Every segment text is
 *   the file's, the draft's or the sample's characters, markup included**: the
 *   renderer must draw it as text; TypeScript cannot force that.
 * - **It is not reactive.** A caller that draws the state passes an `onChange`
 *   listener and mirrors the value into its own `$state`.
 *
 * ## What it cannot force
 *
 * - That sample positions match the target. A `Local { index }` is a position
 *   in the saved revision for a saved target and in the **candidate** for a
 *   draft target (the candidate answer's `analysis` lists them); a sample built
 *   for one and sent with the other previews the wrong variable, and Rust
 *   silently ignores a sample that addresses nothing (`4-17-notes.md` §5
 *   item 4). {@link sampleSlotsOf} derives slots from whichever analysis the
 *   caller hands it; nothing checks it was the right one.
 * - That the real clock is read only through {@link SYSTEM_SAMPLE_CLOCK}. The
 *   rest of this module takes a {@link SampleClock} parameter and names no
 *   clock of its own; `preview.test.ts` makes `Date.now` and
 *   `Intl.DateTimeFormat` throw around every other test to prove it.
 */

import type { IpcFailure } from '../ipc/errors';
import { classifyFailure } from '../ipc/errors';
import type { CommandResult } from '../ipc/commands';
import { previewMatch, previewMatchCandidate } from '../ipc/commands';
import type {
  AnalysisSummary,
  CandidateOperation,
  CandidatePreview,
  CaptureSample,
  ContentRevision,
  FormValueSample,
  LayoutSummary,
  MatchDraft,
  MatchId,
  MatchPreview,
  PreviewLimit,
  PreviewPlaceholderName,
  PreviewSamples,
  PreviewSegment,
  PreviewSource,
  PreviewUnresolved,
  SampleInstant,
  SampleZone,
  SelectionSample
} from '../ipc/types';

// ---------------------------------------------------------------------------
// The clock and zone source
// ---------------------------------------------------------------------------

/**
 * Where the sample instant and zone come from — the only reading of "now" the
 * preview makes, injected so a test never reads the real clock.
 */
export interface SampleClock {
  /** Milliseconds since 1970-01-01T00:00:00Z, as `Date.now()` answers. */
  now(): number;
  /**
   * The IANA name of the zone standing in for espanso's system zone, as
   * `Intl.DateTimeFormat().resolvedOptions().timeZone` answers, or `null` when
   * none can be read.
   */
  zoneName(): string | null;
  /**
   * Minutes east of UTC at `millis` — the negation of
   * `Date.prototype.getTimezoneOffset` — used only when no zone name is read.
   *
   * @param millis - The instant, in milliseconds since the epoch.
   */
  offsetMinutesAt(millis: number): number;
}

/**
 * The real clock and zone of this machine. **The one place the preview reads
 * them**; everything else takes a {@link SampleClock}.
 */
export const SYSTEM_SAMPLE_CLOCK: SampleClock = Object.freeze({
  now: (): number => Date.now(),
  zoneName: (): string | null => {
    try {
      const name = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return typeof name === 'string' && name.length > 0 ? name : null;
    } catch {
      return null;
    }
  },
  offsetMinutesAt: (millis: number): number => -new Date(millis).getTimezoneOffset()
});

/**
 * Reads one sample instant from `clock`: the current whole second and the zone
 * — by IANA name when the clock has one, else the fixed offset at that instant.
 *
 * **A reading the wire cannot carry is `null`, never a guess**: a clock answering
 * a non-finite time, or an offset that is not finite or not strictly inside a
 * day, gives no instant, and Rust then answers every date `DateInstantMissing`.
 * A zone name Rust's tzdb does not hold is sent as read and answered
 * `ZoneUnsupported` there.
 *
 * @param clock - The clock and zone source.
 * @returns The instant and zone, or `null`.
 */
export function readSampleInstant(clock: SampleClock): SampleInstant | null {
  const millis = clock.now();
  if (!Number.isFinite(millis)) {
    return null;
  }
  const unixSeconds = Math.floor(millis / 1000);
  if (!Number.isSafeInteger(unixSeconds)) {
    return null;
  }
  const name = clock.zoneName();
  if (typeof name === 'string' && name.length > 0) {
    return Object.freeze({ unix_seconds: unixSeconds, zone: Object.freeze({ Named: Object.freeze({ name }) }) });
  }
  const minutes = clock.offsetMinutesAt(millis);
  const seconds = Math.round(minutes * 60);
  if (!Number.isFinite(seconds) || Math.abs(seconds) >= 86_400) {
    return null;
  }
  return Object.freeze({
    unix_seconds: unixSeconds,
    zone: Object.freeze({ Fixed: Object.freeze({ offset_seconds: seconds }) })
  });
} // End of function readSampleInstant()

/**
 * The zone of an instant, for drawing: the IANA name, or the fixed offset in
 * seconds east of UTC.
 *
 * @param zone - A sample zone.
 * @returns A tagged value a component formats; never a sentence.
 */
export function zoneOf(
  zone: SampleZone
): { readonly kind: 'named'; readonly name: string } | { readonly kind: 'fixed'; readonly offsetSeconds: number } {
  return 'Named' in zone
    ? { kind: 'named', name: zone.Named.name }
    : { kind: 'fixed', offsetSeconds: zone.Fixed.offset_seconds };
} // End of function zoneOf()

// ---------------------------------------------------------------------------
// Sample inputs
// ---------------------------------------------------------------------------

/**
 * The samples a person chose for one example. Values, never a draft: nothing
 * here is written to a file.
 *
 * **A sample value is used exactly as given, a carriage return included.** It
 * never reaches a file, so the `\r` refusal every drafting control owes
 * (`CLAUDE.md` §6) does not apply; a `<textarea>` carrying it will still have
 * normalized line breaks to LF before this model sees the text.
 */
export interface PreviewInputs {
  /** Which entry each `choice` and `random` variable yields — at most one per variable. */
  readonly selections: readonly SelectionSample[];
  /** What each form field holds — at most one per form and field. */
  readonly formValues: readonly FormValueSample[];
  /** What each regex capture matched — at most one per name. */
  readonly captures: readonly CaptureSample[];
  /** A chosen instant, or `null` to read the clock afresh for every request. */
  readonly pinnedInstant: SampleInstant | null;
}

/** No samples, and the clock read at each request. */
export const EMPTY_PREVIEW_INPUTS: PreviewInputs = Object.freeze({
  selections: Object.freeze([]) as readonly SelectionSample[],
  formValues: Object.freeze([]) as readonly FormValueSample[],
  captures: Object.freeze([]) as readonly CaptureSample[],
  pinnedInstant: null
});

/**
 * Whether two sources name the same thing.
 *
 * @param a - One source.
 * @param b - The other.
 * @returns `true` for the same variable, form or capture.
 */
export function samePreviewSource(a: PreviewSource, b: PreviewSource): boolean {
  if ('Local' in a) {
    return 'Local' in b && a.Local.index === b.Local.index;
  }
  if ('Global' in a) {
    return 'Global' in b && a.Global.index === b.Global.index;
  }
  if ('ShorthandForm' in a) {
    return 'ShorthandForm' in b;
  }
  return 'Capture' in b && a.Capture.name === b.Capture.name;
} // End of function samePreviewSource()

/**
 * `inputs` with `variable` yielding its entry at `index`, replacing any earlier
 * selection of that variable. A negative or non-integer index is refused as
 * `null`: the wire takes an unsigned position.
 *
 * @param inputs - The current inputs.
 * @param variable - The `choice` or `random` variable.
 * @param index - The entry's position in its list.
 * @returns The new inputs, or `null` for an index the wire cannot carry.
 */
export function withSelection(
  inputs: PreviewInputs,
  variable: PreviewSource,
  index: number
): PreviewInputs | null {
  if (!Number.isSafeInteger(index) || index < 0) {
    return null;
  }
  const kept = inputs.selections.filter((sample) => !samePreviewSource(sample.variable, variable));
  return frozenInputs({ ...inputs, selections: [...kept, { variable, index }] });
} // End of function withSelection()

/**
 * `inputs` with no selection for `variable`.
 *
 * @param inputs - The current inputs.
 * @param variable - The variable.
 * @returns The new inputs.
 */
export function withoutSelection(inputs: PreviewInputs, variable: PreviewSource): PreviewInputs {
  return frozenInputs({
    ...inputs,
    selections: inputs.selections.filter((sample) => !samePreviewSource(sample.variable, variable))
  });
} // End of function withoutSelection()

/**
 * `inputs` with `field` of `form` holding `value`, replacing any earlier value.
 *
 * @param inputs - The current inputs.
 * @param form - A `type: form` variable, or `{ ShorthandForm: {} }`.
 * @param field - The field's name.
 * @param value - The sample text, used as given.
 * @returns The new inputs.
 */
export function withFormValue(
  inputs: PreviewInputs,
  form: PreviewSource,
  field: string,
  value: string
): PreviewInputs {
  const kept = inputs.formValues.filter(
    (sample) => !(samePreviewSource(sample.form, form) && sample.field === field)
  );
  return frozenInputs({ ...inputs, formValues: [...kept, { form, field, value }] });
} // End of function withFormValue()

/**
 * `inputs` with capture `name` having matched `value`, replacing any earlier value.
 *
 * @param inputs - The current inputs.
 * @param name - The capture group's name.
 * @param value - The sample text, used as given.
 * @returns The new inputs.
 */
export function withCapture(inputs: PreviewInputs, name: string, value: string): PreviewInputs {
  const kept = inputs.captures.filter((sample) => sample.name !== name);
  return frozenInputs({ ...inputs, captures: [...kept, { name, value }] });
} // End of function withCapture()

/**
 * `inputs` with a pinned instant, or with the clock read afresh (`null`).
 *
 * @param inputs - The current inputs.
 * @param instant - The instant and zone to show dates at, or `null`.
 * @returns The new inputs.
 */
export function withPinnedInstant(inputs: PreviewInputs, instant: SampleInstant | null): PreviewInputs {
  return frozenInputs({ ...inputs, pinnedInstant: instant });
} // End of function withPinnedInstant()

/**
 * A frozen, shallow-copied inputs value.
 *
 * @param inputs - The inputs.
 * @returns The same values, frozen.
 */
function frozenInputs(inputs: PreviewInputs): PreviewInputs {
  return Object.freeze({
    selections: Object.freeze([...inputs.selections]),
    formValues: Object.freeze([...inputs.formValues]),
    captures: Object.freeze([...inputs.captures]),
    pinnedInstant: inputs.pinnedInstant
  });
} // End of function frozenInputs()

// ---------------------------------------------------------------------------
// Sample slots
// ---------------------------------------------------------------------------

/**
 * One sample a match's example can take — what a sample input control is for.
 * `name` is the file's own text (a variable's `name`), never prose.
 */
export type SampleSlot =
  | {
      readonly kind: 'selection';
      readonly variable: PreviewSource;
      readonly name: string | null;
      readonly variableKind: 'Choice' | 'Random';
    }
  | {
      readonly kind: 'formField';
      readonly form: PreviewSource;
      readonly name: string | null;
      readonly field: string;
    }
  | { readonly kind: 'capture'; readonly name: string };

/**
 * The samples a match's example can take, read off one analysis — the saved
 * snapshot's for a saved target, the candidate's for a draft target.
 *
 * Local `choice` and `random` variables give a selection slot each; a local
 * form variable and the shorthand `form:` give one slot per distinct field its
 * layout names, in layout order; a regex trigger gives one per named capture.
 * Global variables are not listed: the analysis summary does not carry them.
 *
 * @param analysis - A match's analysis summary.
 * @returns The slots, in authored order.
 */
export function sampleSlotsOf(analysis: AnalysisSummary): readonly SampleSlot[] {
  const slots: SampleSlot[] = [];
  for (const declaration of analysis.declarations) {
    const variable: PreviewSource = { Local: { index: declaration.index } };
    if (declaration.kind === 'Choice' || declaration.kind === 'Random') {
      slots.push({ kind: 'selection', variable, name: declaration.name, variableKind: declaration.kind });
    } else if (declaration.kind === 'Form' && declaration.layout !== null) {
      for (const field of layoutFields(declaration.layout)) {
        slots.push({ kind: 'formField', form: variable, name: declaration.name, field });
      }
    }
  } // End of the loop over the local declarations
  if (analysis.shorthand_form !== null) {
    for (const field of layoutFields(analysis.shorthand_form)) {
      slots.push({ kind: 'formField', form: { ShorthandForm: {} }, name: null, field });
    }
  }
  for (const name of analysis.captures) {
    slots.push({ kind: 'capture', name });
  }
  return Object.freeze(slots);
} // End of function sampleSlotsOf()

/**
 * The distinct placeholder names of a layout, in the order they first appear.
 *
 * @param layout - A layout summary.
 * @returns The field names.
 */
function layoutFields(layout: LayoutSummary): readonly string[] {
  const fields: string[] = [];
  for (const piece of layout.pieces) {
    if ('Placeholder' in piece && !fields.includes(piece.Placeholder.name)) {
      fields.push(piece.Placeholder.name);
    }
  }
  return fields;
} // End of function layoutFields()

// ---------------------------------------------------------------------------
// Targets and requests
// ---------------------------------------------------------------------------

/**
 * What is previewed: a snippet's saved text, or an open editor's draft of it
 * against the revision the editor was opened on.
 */
export type PreviewTarget =
  | { readonly kind: 'saved'; readonly id: MatchId }
  | {
      readonly kind: 'draft';
      readonly id: MatchId;
      readonly baseRevision: ContentRevision;
      readonly draft: MatchDraft;
    };

/** One request, as sent: its target and its samples, the instant resolved. */
export interface PreviewRequest {
  /** What is previewed; a draft target holds a frozen copy of the draft. */
  readonly target: PreviewTarget;
  /** The samples sent, `instant` being the one dates are shown at. */
  readonly samples: PreviewSamples;
}

/**
 * Builds the request `inputs` make for `target`, reading `clock` once unless
 * the inputs pin an instant.
 *
 * A draft target's draft is **copied as it crosses the wire** (a JSON round
 * trip) and the copy frozen, so neither this request nor anything later can
 * write the caller's object, and a caller that goes on editing its own object
 * does not change what this request describes.
 *
 * @param target - The saved snippet or the draft.
 * @param inputs - The sample inputs.
 * @param clock - The clock and zone source.
 * @returns The request.
 */
export function previewRequestOf(
  target: PreviewTarget,
  inputs: PreviewInputs,
  clock: SampleClock
): PreviewRequest {
  const instant = inputs.pinnedInstant ?? readSampleInstant(clock);
  const samples: PreviewSamples = Object.freeze({
    selections: Object.freeze([...inputs.selections]),
    form_values: Object.freeze([...inputs.formValues]),
    captures: Object.freeze([...inputs.captures]),
    instant
  });
  const sent: PreviewTarget =
    target.kind === 'saved'
      ? Object.freeze({ kind: 'saved', id: target.id })
      : Object.freeze({
          kind: 'draft',
          id: target.id,
          baseRevision: target.baseRevision,
          draft: frozenCopy(target.draft)
        });
  return Object.freeze({ target: sent, samples });
} // End of function previewRequestOf()

/**
 * A deep, frozen copy of a wire value, taken exactly as it would be serialized.
 *
 * @param value - A JSON-serializable value.
 * @returns The copy.
 */
function frozenCopy<T>(value: T): T {
  const copy = JSON.parse(JSON.stringify(value)) as T;
  return deepFrozen(copy);
} // End of function frozenCopy()

/**
 * Freezes `value` and everything reachable from it, in place.
 *
 * @param value - A value this module owns.
 * @returns The same value.
 */
function deepFrozen<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value as Record<string, unknown>)) {
      deepFrozen(inner);
    }
  }
  return value;
} // End of function deepFrozen()

// ---------------------------------------------------------------------------
// Limitations
// ---------------------------------------------------------------------------

/**
 * What an answered preview could not illustrate, as typed codes for the
 * `describe*` accessors — derived from the segments, which stay the truth.
 */
export interface PreviewLimitations {
  /** Every distinct unresolved reason, in first-appearance order, nested choices included. */
  readonly unresolved: readonly PreviewUnresolved[];
  /** How many unresolved segments there are, nested choices included. */
  readonly unresolvedCount: number;
  /** Every distinct placeholder kind, in first-appearance order. */
  readonly placeholders: readonly PreviewPlaceholderName[];
  /** The first limit reached, or `null`. */
  readonly limit: PreviewLimit | null;
}

/**
 * The limitations of one preview.
 *
 * @param preview - An answered preview.
 * @returns Its limitations.
 */
export function limitationsOf(preview: MatchPreview): PreviewLimitations {
  const unresolved: PreviewUnresolved[] = [];
  const placeholders: PreviewPlaceholderName[] = [];
  let unresolvedCount = 0;
  const visit = (segments: readonly PreviewSegment[]): void => {
    for (const segment of segments) {
      if ('Unresolved' in segment) {
        unresolvedCount += 1;
        if (!unresolved.includes(segment.Unresolved.reason)) {
          unresolved.push(segment.Unresolved.reason);
        }
      } else if ('Placeholder' in segment) {
        const name = placeholderName(segment.Placeholder.placeholder);
        if (!placeholders.includes(name)) {
          placeholders.push(name);
        }
      } else if ('Choice' in segment) {
        visit(segment.Choice.segments);
      }
    } // End of the loop over one list of segments
  };
  for (const body of preview.bodies) {
    visit(body.segments);
  }
  return Object.freeze({
    unresolved: Object.freeze(unresolved),
    unresolvedCount,
    placeholders: Object.freeze(placeholders),
    limit: preview.limit
  });
} // End of function limitationsOf()

/**
 * The variant name of a placeholder.
 *
 * @param placeholder - A placeholder as it crossed the boundary.
 * @returns Its name.
 */
function placeholderName(
  placeholder: Extract<PreviewSegment, { readonly Placeholder: unknown }>['Placeholder']['placeholder']
): PreviewPlaceholderName {
  if ('Clipboard' in placeholder) {
    return 'Clipboard';
  }
  if ('Shell' in placeholder) {
    return 'Shell';
  }
  return 'Script' in placeholder ? 'Script' : 'Match';
} // End of function placeholderName()

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** A preview answered and drawable. */
export interface PreviewShown {
  readonly kind: 'shown';
  /** The request's generation. */
  readonly generation: number;
  /** The request answered — its `samples.instant` is what dates were shown at. */
  readonly request: PreviewRequest;
  /** The illustration. */
  readonly preview: MatchPreview;
  /** What it could not illustrate. */
  readonly limitations: PreviewLimitations;
  /** The candidate revision, for a draft target; `null` for a saved one. */
  readonly candidate: ContentRevision | null;
  /** The candidate's analysis, for a draft target; `null` for a saved one. */
  readonly analysis: AnalysisSummary | null;
}

/** A draft whose candidate holds no snippet at the edited place. */
export interface PreviewNoMatchInCandidate {
  readonly kind: 'noMatchInCandidate';
  /** The request's generation. */
  readonly generation: number;
  /** The request answered. */
  readonly request: PreviewRequest;
  /** The candidate revision. */
  readonly candidate: ContentRevision;
}

/** A request that failed; `failure` is drawn through `describeIpcFailure`. */
export interface PreviewFailed {
  readonly kind: 'failed';
  /** The request's generation. */
  readonly generation: number;
  /** The request that failed. */
  readonly request: PreviewRequest;
  /** Why — a stale identity, a draft the planner refuses, … */
  readonly failure: IpcFailure;
}

/** Any answered state. */
export type PreviewAnswered = PreviewShown | PreviewNoMatchInCandidate | PreviewFailed;

/** Everything the coordinator can hold. */
export type PreviewState =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'pending';
      /** The request's generation. */
      readonly generation: number;
      /** The request in flight. */
      readonly request: PreviewRequest;
      /** The last answer, kept so a component can go on drawing it. */
      readonly last: PreviewAnswered | null;
    }
  | PreviewAnswered;

/** No preview requested, or the last one cleared. */
export const PREVIEW_IDLE: PreviewState = Object.freeze({ kind: 'idle' as const });

/**
 * The instant and zone the state's request showed (or will show) dates at —
 * what 4-19-2 draws beside the result.
 *
 * @param state - A preview state.
 * @returns The instant, or `null` when idle or when none was sent.
 */
export function instantOf(state: PreviewState): SampleInstant | null {
  return state.kind === 'idle' ? null : state.request.samples.instant;
} // End of function instantOf()

// ---------------------------------------------------------------------------
// Coordination
// ---------------------------------------------------------------------------

/**
 * The two commands the preview may reach — both readers. **No writing command
 * is a member**, and there is nothing to run and nothing to read the
 * clipboard with.
 */
export interface PreviewCommands {
  /**
   * Previews a snippet's saved text.
   *
   * @param id - The snippet.
   * @param samples - The example.
   * @returns The preview, or a failure.
   */
  previewMatch(id: MatchId, samples: PreviewSamples): Promise<CommandResult<MatchPreview>>;
  /**
   * Previews a drafted operation's candidate, writing nothing.
   *
   * @param id - The snippet.
   * @param operation - The draft.
   * @param baseRevision - The revision its positions belong to.
   * @param samples - The example, by the candidate's positions.
   * @returns The candidate preview, or a failure.
   */
  previewMatchCandidate(
    id: MatchId,
    operation: CandidateOperation,
    baseRevision: ContentRevision,
    samples: PreviewSamples
  ): Promise<CommandResult<CandidatePreview>>;
}

/** The real boundary. */
export const REAL_PREVIEW_COMMANDS: PreviewCommands = Object.freeze({
  previewMatch,
  previewMatchCandidate
});

/** One preview surface's coordinator. */
export interface PreviewCoordinator {
  /**
   * The current state.
   *
   * @returns The state.
   */
  current(): PreviewState;
  /**
   * Sends one request, superseding every earlier one: whatever an earlier
   * request answers afterwards is discarded, never shown.
   *
   * @param target - The saved snippet or the draft.
   * @param inputs - The sample inputs.
   * @returns The state once this request is answered — or, if a later request
   *   or a {@link PreviewCoordinator.clear} superseded it first, the state at
   *   that moment, which this answer did not change.
   */
  request(target: PreviewTarget, inputs: PreviewInputs): Promise<PreviewState>;
  /** Supersedes everything in flight and returns to idle. */
  clear(): void;
}

/**
 * Builds a coordinator over `commands`, reading the instant from `clock`.
 *
 * **Supersession is a generation counter.** Every request and every clear
 * takes the next generation; an answer is installed only when its generation
 * is still the latest, compared immediately before installing, with nothing
 * read in between. The pending state is installed under the same rule, after
 * the request is built, so a `clear()` or a later request re-entered from a
 * getter or the clock while it was being built wins. An earlier answer that resolves after a later one is
 * therefore dropped, and a later answer that resolves after an earlier one
 * replaces it.
 *
 * @param commands - The two reading commands.
 * @param clock - The clock and zone source.
 * @param onChange - Called with every new state, after it is installed.
 * @returns The coordinator.
 */
export function createPreviewCoordinator(
  commands: PreviewCommands,
  clock: SampleClock,
  onChange: (state: PreviewState) => void = () => {}
): PreviewCoordinator {
  let latest = 0;
  let state: PreviewState = PREVIEW_IDLE;

  const install = (next: PreviewState): void => {
    state = next;
    onChange(next);
  };

  return {
    current: (): PreviewState => state,

    async request(target: PreviewTarget, inputs: PreviewInputs): Promise<PreviewState> {
      latest += 1;
      const generation = latest;
      const request = previewRequestOf(target, inputs, clock);
      // Building the request reads caller-owned properties and calls the
      // injected clock, either of which may re-enter `clear()` or `request()`:
      // a request superseded while it was being built installs nothing and
      // sends nothing.
      if (generation !== latest) {
        return state;
      }
      const last = state.kind === 'pending' ? state.last : state.kind === 'idle' ? null : state;
      install(Object.freeze({ kind: 'pending' as const, generation, request, last }));
      let answered: PreviewAnswered;
      try {
        answered = await answerOf(commands, generation, request);
      } catch (raw: unknown) {
        answered = Object.freeze({ kind: 'failed' as const, generation, request, failure: classifyFailure(raw) });
      }
      if (generation !== latest) {
        return state;
      }
      install(answered);
      return answered;
    }, // End of method request()

    clear(): void {
      latest += 1;
      install(PREVIEW_IDLE);
    }
  };
} // End of function createPreviewCoordinator()

/**
 * Sends `request` and turns the answer into a state.
 *
 * @param commands - The two reading commands.
 * @param generation - The request's generation.
 * @param request - The request.
 * @returns The answered state.
 */
async function answerOf(
  commands: PreviewCommands,
  generation: number,
  request: PreviewRequest
): Promise<PreviewAnswered> {
  const { target, samples } = request;
  if (target.kind === 'saved') {
    const answer = await commands.previewMatch(target.id, samples);
    if (!answer.ok) {
      return Object.freeze({ kind: 'failed', generation, request, failure: answer.failure });
    }
    return shown(generation, request, answer.value, null, null);
  }
  const operation: CandidateOperation = Object.freeze({ Draft: Object.freeze({ draft: target.draft }) });
  const answer = await commands.previewMatchCandidate(target.id, operation, target.baseRevision, samples);
  if (!answer.ok) {
    return Object.freeze({ kind: 'failed', generation, request, failure: answer.failure });
  }
  const { candidate, preview, analysis } = answer.value;
  if (preview === null) {
    return Object.freeze({ kind: 'noMatchInCandidate', generation, request, candidate });
  }
  return shown(generation, request, preview, candidate, analysis);
} // End of function answerOf()

/**
 * A shown state.
 *
 * @param generation - The request's generation.
 * @param request - The request answered.
 * @param preview - The illustration.
 * @param candidate - The candidate revision, or `null` for a saved target.
 * @param analysis - The candidate's analysis, or `null` for a saved target.
 * @returns The state.
 */
function shown(
  generation: number,
  request: PreviewRequest,
  preview: MatchPreview,
  candidate: ContentRevision | null,
  analysis: AnalysisSummary | null
): PreviewShown {
  return Object.freeze({
    kind: 'shown',
    generation,
    request,
    preview,
    limitations: limitationsOf(preview),
    candidate,
    analysis
  });
} // End of function shown()
