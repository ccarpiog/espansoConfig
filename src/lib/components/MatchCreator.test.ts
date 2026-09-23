/** @vitest-environment jsdom */

/**
 * The new-snippet form, mounted and driven through real DOM events.
 *
 * The fourth file in this repository to opt into jsdom, and it opts in the same
 * way the first three do: by the docblock above and by nothing else. The suite's
 * default environment is still `node`, and the six components that predate
 * `RawEditor.svelte` are deliberately not back-filled
 * (`docs/decisions/2c-split-notes.md` section 7).
 *
 * **What this file is for, given that `matchCreation.test.ts` already exists.**
 * That suite drives the value; it cannot see whether a control is drawn, whether
 * an ineligible file is offered at all, or what the component hands to the
 * boundary. Three of this sub-phase's claims are only about that:
 *
 * 1. **every file the window lists is offered**, ineligible ones included and
 *    each with its own localized reason — the consult's Q5 read literally, and a
 *    claim a model test can only make about a list nobody drew;
 * 2. **the `After` arm carries an identity**, so what reaches `create_match` is
 *    the anchor the model minted rather than a row's index;
 * 3. **the base revision that reaches the boundary is the form's own**, which is
 *    assembled entirely inside a component.
 *
 * **This does not replace the window reading.** What it proves is that a handler
 * fires and that the right value reaches the boundary. jsdom has no layout, no
 * WebKit, and — the point the carriage-return disclosure turns on — not
 * necessarily WebKit's value normalisation.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { rawSaveChoiceKey } from '../browser/rawSave';
import {
  conflictChoiceKey,
  reloadUnavailableKey,
  type ConflictModel,
  type DiskAdoptionOutcome
} from '../browser/saveOutcome';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveConflictSource, type ConflictSource } from '../browser/conflictSource';
import {
  makeDocument,
  makeMatch,
  makeSummary,
  scriptedAcknowledgement,
  type ScriptedAcknowledgement
} from '../browser/fixtures';
import type { InvalidationStatus } from '../browser/invalidation';
import {
  destinationRefusalKey,
  type CreationBuffers,
  type DestinationRefusal
} from '../browser/matchCreation';
import { recoveryChoiceKey, sourceConflictStateKey } from '../browser/recovery';
import { arbitratedDelivery, type ObservationDelivery } from '../browser/observationDelivery';
import type { SurfaceBinding } from '../browser/surfaceReceivers';
import type { MatchSaveAnswer, ObservationReceiver } from '../browser/workspace.svelte';
import { DICTIONARIES, type TranslationKey } from '../i18n/dictionaries';
import { t, tDraftCopy } from '../i18n';
import { locale } from '../stores/locale.svelte';
import type { IpcFailure } from '../ipc/errors';
import type {
  Acknowledgement,
  ContentRevision,
  DocumentId,
  DocumentSummary,
  DocumentView,
  Finding,
  MatchId,
  NewMatch,
  NewMatchPosition,
  SaveResult
} from '../ipc/types';
import MatchCreator from './MatchCreator.svelte';
import { LOCALES } from '../i18n/locale';
import type { Locale } from '../i18n/locale';
import { translate } from '../i18n/dictionaries';
import { externalConflictSource, standingConflictOf } from '../browser/conflictSource';
import type { ExternalConflictObservation } from '../browser/conflictSource';
import { reconciliationRefusalKey, type ReconciliationRefusal } from '../browser/reconciliationStatus';

/**
 * Records every call that reaches `@tauri-apps/api/core`'s `invoke` while this
 * file's cases run — Phase 2d-6-11a. Every mount here is handed scripted ports, so
 * no case should ever reach the boundary; the mock below rejects any call that
 * does, and the file-level `afterEach` fails the case that made it. It catches a
 * call reaching `invoke` in the cases this file runs and proves nothing about
 * other files, other paths or code loaded dynamically outside this module graph.
 */
const { invoked } = vi.hoisted(() => ({ invoked: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: readonly unknown[]): Promise<never> => {
    invoked(...args);
    return Promise.reject(new Error('this suite invokes no command'));
  }
}));

afterEach(() => {
  // Read, then cleared, then asserted, so one offending case does not fail the next.
  const calls = invoked.mock.calls.length;
  invoked.mockClear();
  expect(calls).toBe(0);
});

/** The revision the writable file is projected at. */
const BASE: ContentRevision = 'a'.repeat(64);

/** The revision the second writable file is projected at. */
const OTHER: ContentRevision = 'c'.repeat(64);

/** The revision the file holds after a commit. */
const AFTER: ContentRevision = 'b'.repeat(64);

/** The adoption a save that wrote nothing owes: none. */
const NOT_OWED: InvalidationStatus = { kind: 'notOwed' };

/** The adoption a committed save performed. */
const ADOPTED: InvalidationStatus = { kind: 'done' };

/** A snippet file with two snippets in it. */
function writableFile(): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision: BASE,
    matches: [
      makeMatch({ node: 10, document: 2, revision: BASE, trigger: ':sig' }),
      makeMatch({ node: 11, document: 2, revision: BASE, trigger: ':date' })
    ]
  });
} // End of function writableFile()

/** A second snippet file, so a change of destination is observable. */
function secondFile(): DocumentView {
  return makeDocument({
    id: 3,
    relativePath: 'match/other.yml',
    revision: OTHER,
    matches: [makeMatch({ node: 20, document: 3, revision: OTHER, trigger: ':sql' })]
  });
} // End of function secondFile()

/** A config profile, which espanso loads no snippets out of. */
function profile(): DocumentView {
  return makeDocument({ id: 1, relativePath: 'config/default.yml', kind: 'ConfigProfile' });
} // End of function profile()

/** A file from the Hub, which this application may never write. */
function packageFile(): DocumentView {
  return makeDocument({
    id: 6,
    relativePath: 'match/packages/x/package.yml',
    kind: 'Package',
    readOnly: true
  });
} // End of function packageFile()

/**
 * The summary the window would list one projection under.
 *
 * Derived from the projection rather than written twice, so a fixture cannot
 * disagree with itself about a file's kind or its read-only flag.
 *
 * @param view - The projection to describe.
 * @returns The summary.
 */
function summaryOf(view: DocumentView): DocumentSummary {
  return makeSummary({
    id: view.id,
    relativePath: view.relative_path,
    kind: view.kind,
    readOnly: view.read_only
  });
} // End of function summaryOf()

/**
 * The file the window lists but holds no projection of.
 *
 * There is deliberately no projection to go with it: `couldNotBeRead` is the
 * refusal that exists for a file whose `get_document` refused, and a fixture with
 * a projection could not produce it.
 */
const UNREADABLE: DocumentSummary = makeSummary({ id: 7, relativePath: 'match/unreadable.yml' });

/** A suspicion the gate reported about the candidate. */
const SUSPICION: Finding = {
  code: { ReferenceHasNoDeclaration: { name: 'greeting' } },
  span: null,
  node: null,
  path: null
};

/** A refusal a person may accept. */
const REFUSED: SaveResult = {
  outcome: 'refused',
  verdict: 'RefusedForUnacknowledgedSuspicions',
  findings: [SUSPICION]
};

/** A save that ran to the end and wrote the file. */
const COMMITTED: SaveResult = {
  outcome: 'saved',
  revision: AFTER,
  committed: true,
  notes: [],
  backup_taken: false,
  moved: { document: 2, revision: AFTER, node: 12 }
};

/**
 * The whole file text the conflict's fresh read carried.
 *
 * Distinguishable from anything the form holds, so a case can tell the disk side
 * of the panel from the draft side by looking at the rendered text.
 */
const DISK_TEXT = 'matches:\n  - trigger: x\n    replace: theirs\n';

/** A word that appears in {@link DISK_TEXT} and nowhere else on the screen. */
const DISK_TEXT_MARKER = 'theirs';

/** A create the file had moved on under. */
const CONFLICTED: SaveResult = {
  outcome: 'conflict',
  reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
  expected: BASE,
  found: AFTER,
  disk_revision: AFTER,
  disk_text: DISK_TEXT,
  disk: makeDocument({ id: 2, relativePath: 'match/base.yml', revision: AFTER })
};

/** The one rejection only `create_match` can produce. */
const NO_MATCH_LIST: IpcFailure = {
  kind: 'command',
  error: { code: 'documentHasNoMatchList', document: 2 }
};

/** One call the component made to the boundary. */
interface RecordedCreate {
  /** Which file it aimed at. */
  readonly document: DocumentId;
  /** What the new snippet says. */
  readonly newMatch: NewMatch;
  /** Where in the list it goes. */
  readonly position: NewMatchPosition;
  /** The revision it said the form was drafted against. */
  readonly baseRevision: ContentRevision;
  /** The suspicions it said had already been shown to a person. */
  readonly acknowledgement: Acknowledgement;
}

/**
 * One scripted answer to one create.
 *
 * Which arm of `MatchSaveAnswer` it produces is decided by which field it
 * carries: `result` is `answered`, `failure` is `failed`, and neither is
 * `notAttempted`.
 */
interface ScriptedAnswer {
  /** How the save ended, for the `answered` arm. */
  readonly result?: SaveResult;
  /** What became of the adoption; a commit adopts unless a case says otherwise. */
  readonly adoption?: InvalidationStatus;
  /** Whether the file may already hold the snippet. Only read beside `failure`. */
  readonly mayHaveWritten?: boolean;
  /** Why the command rejected, for the `failed` arm. */
  readonly failure?: IpcFailure;
  /**
   * What the wrapper throws instead of answering at all — Phase 2d-6-6c-1. Read
   * before every other field.
   */
  readonly throws?: Error;
}

/**
 * Records the origin a window would hold as standing after one scripted answer —
 * Phase 2d-6-6b.
 *
 * **The stand-in for `BrowserState.standingConflictFor`**, for
 * `MatchEditor.test.ts`'s reason: the window registers a save conflict's origin
 * for its file when the command answers `conflict`, and the reapply's live guard
 * asks it; answering `null` would make every reapply refuse as superseded.
 *
 * @param standing - The table this suite's `standingConflictFor` reads.
 * @param document - The file the answer is about.
 * @param next - The scripted answer.
 */
function noteStanding(
  standing: Map<DocumentId, ConflictSource>,
  document: DocumentId,
  next: ScriptedAnswer | undefined
): void {
  if (next?.result?.outcome === 'conflict') {
    standing.set(document, saveConflictSource(next.result));
  }
} // End of function noteStanding()

/**
 * A reporter that binds nothing — Phase 2d-6-6b. This suite mounts the form
 * alone; delivery through a real window is `DetailPane.test.ts`'s.
 *
 * @returns A binding whose two methods do nothing.
 */
function inertBinding(): SurfaceBinding {
  return { reportTarget: () => undefined, withdraw: () => undefined };
} // End of function inertBinding()

/** A mounted form and everything a case needs to drive it. */
interface Mounted {
  /** The element the component was mounted into. */
  readonly target: HTMLElement;
  /** Every call the component made, in order. */
  readonly calls: RecordedCreate[];
  /**
   * Every conflict the component asked the window to adopt, in order.
   *
   * **Empty is the assertion in most cases.** A conflict installs nothing until a
   * reload has been asked for *and* confirmed, so an entry here in a case that
   * only reached the panel is the pre-emptive install the consult's Q2 ruled out.
   */
  readonly adoptions: ConflictModel<CreationBuffers>[];
  /**
   * Every destination the form reported upward, in order.
   *
   * **Repeats included.** The report comes from an effect over the model's answer,
   * so a transition that leaves the destination where it was reports it again; a
   * host is what makes a repeat inert, and no type forces it to.
   */
  readonly reports: readonly (DocumentId | null)[];
  /** How many times the form asked to be closed. */
  readonly closed: () => number;
  /** Replaces what the projections reader answers, as a re-read would. */
  readonly reproject: (views: readonly DocumentView[]) => void;
  /**
   * Hands one envelope to the receiver the form reported — Phase 2d-6-6c-1 —
   * as the window's registration would, inside a flush. Since Phase 2d-6-11a a
   * replacing verdict also becomes what the stand-in for `standingConflictFor`
   * answers for the file, as the window registers the origin it delivered.
   */
  readonly deliver: (delivery: ObservationDelivery) => void;
  /** Tears the component down. */
  readonly stop: () => void;
}

/**
 * Mounts the form over a scripted boundary.
 *
 * **The three readers are functions**, which is how the component takes them:
 * a re-seed after a committed create must see the files as the window has since
 * re-read them, so `reproject` below is what a case uses to move the world under
 * an open form.
 *
 * @param answers - What each successive create answers, in order.
 * @param held - The snippet the window has selected, or `null`.
 * @param documents - Every file the window lists. Defaults to the six fixtures.
 * @param adoption - What the window answers when the form asks it to adopt the
 *   disk observation. All three values are real production answers.
 * @returns The mounted form.
 */
function mountCreator(
  answers: readonly ScriptedAnswer[] = [],
  held: MatchId | null = null,
  documents: readonly DocumentSummary[] = [
    summaryOf(profile()),
    summaryOf(writableFile()),
    summaryOf(secondFile()),
    summaryOf(packageFile()),
    UNREADABLE
  ],
  adoption: DiskAdoptionOutcome = 'installed'
): Mounted {
  const remaining = [...answers];
  const calls: RecordedCreate[] = [];
  const adoptions: ConflictModel<CreationBuffers>[] = [];
  const reports: (DocumentId | null)[] = [];
  const standing = new Map<DocumentId, ConflictSource>();
  // The receiver the form reports, kept so a case can deliver to it (Phase
  // 2d-6-6c-1); the window's own registration is `DetailPane.test.ts`'s.
  let receiver: ObservationReceiver | null = null;
  let closes = 0;
  let views: readonly DocumentView[] = [
    profile(),
    writableFile(),
    secondFile(),
    packageFile()
  ];
  const target = document.createElement('div');
  document.body.append(target);
  const component = mount(MatchCreator, {
    target,
    props: {
      acknowledgement: acknowledging.port,
      documents: (): readonly DocumentSummary[] => documents,
      projections: (): readonly DocumentView[] => views,
      held: (): MatchId | null => held,
      clock: (): number => 0,
      create: (
        into: DocumentId,
        newMatch: NewMatch,
        position: NewMatchPosition,
        baseRevision: ContentRevision,
        acknowledgement: Acknowledgement
      ): Promise<MatchSaveAnswer> => {
        calls.push({ document: into, newMatch, position, baseRevision, acknowledgement });
        const next = remaining.shift();
        noteStanding(standing, into, next);
        if (next?.throws !== undefined) {
          return Promise.reject(next.throws);
        }
        if (next?.failure !== undefined) {
          return Promise.resolve({
            kind: 'failed',
            mayHaveWritten: next.mayHaveWritten ?? false,
            failure: next.failure
          });
        }
        if (next === undefined || next.result === undefined) {
          return Promise.resolve({ kind: 'notAttempted' });
        }
        return Promise.resolve({
          kind: 'answered',
          result: next.result,
          adoption:
            next.adoption ??
            (next.result.outcome === 'saved' && next.result.committed ? ADOPTED : NOT_OWED)
        });
      },
      // **The window's own adoption**, recorded rather than assumed. Since
      // 2c-4a-3a this surface offers the reload, so a case can press the two
      // controls and watch exactly when — and whether — the window is asked to
      // move.
      adoptDiskVersion: (conflict: ConflictModel<CreationBuffers>): DiskAdoptionOutcome => {
        adoptions.push(conflict);
        return adoption;
      },
      // **Every report, in order, including the repeats** — Phase 2d-5-2b. The
      // component reports from an effect, so it reports again whenever the session
      // is replaced even if the destination did not move; recording the calls
      // rather than the latest value is what lets a case see that, and what would
      // catch a report the component stopped sending.
      reportDestination: (into: DocumentId | null): void => {
        reports.push(into);
      },
      reportReceiver: (reported: ObservationReceiver): SurfaceBinding => {
        receiver = reported;
        return inertBinding();
      },
      reportRecovery: inertBinding,
      standingConflictFor: (document: DocumentId): ConflictSource | null =>
        standing.get(document) ?? null,
      close: (): void => {
        closes += 1;
      }
    }
  });
  return {
    target,
    calls,
    adoptions,
    reports,
    closed: () => closes,
    reproject: (next: readonly DocumentView[]) => {
      views = next;
    },
    deliver: (delivery: ObservationDelivery): void => {
      const verdict = delivery.verdict;
      if (verdict.kind === 'raised' || verdict.kind === 'raisedWithoutReload' || verdict.kind === 'supersedes') {
        standing.set(delivery.observation.document, verdict.source);
      }
      receiver?.(delivery);
      flushSync();
    },
    stop: () => {
      void unmount(component);
      target.remove();
    }
  };
} // End of function mountCreator()

/**
 * The button whose label is the English rendering of one key, or `null`.
 *
 * Matched against the dictionary rather than against a literal, so this file
 * holds no user-facing text of its own.
 *
 * @param target - Where the component was mounted.
 * @param key - The key holding the button's label.
 * @returns The button, or `null`.
 */
function button(target: HTMLElement, key: TranslationKey): HTMLButtonElement | null {
  const label = DICTIONARIES.en[key];
  const found = [...target.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === label
  );
  return found ?? null;
} // End of function button()

/**
 * The same button, insisted upon.
 *
 * @param target - Where the component was mounted.
 * @param key - The key holding the button's label.
 * @returns The button.
 */
function control(target: HTMLElement, key: TranslationKey): HTMLButtonElement {
  const found = button(target, key);
  if (found === null) {
    throw new Error(`this case needs the control labelled ${DICTIONARIES.en[key]}`);
  }
  return found;
} // End of function control()

/**
 * The destination control naming one relative path.
 *
 * @param target - Where the component was mounted.
 * @param path - The file's path relative to the configuration root.
 * @returns The button.
 */
function destination(target: HTMLElement, path: string): HTMLButtonElement {
  const found = [...target.querySelectorAll('.destinations button')].find(
    (candidate) => candidate.textContent?.trim() === path
  );
  if (!(found instanceof HTMLButtonElement)) {
    throw new Error(`this form offers no destination for ${path}`);
  }
  return found;
} // End of function destination()

/**
 * The position control.
 *
 * @param target - Where the component was mounted.
 * @returns The `<select>` the three arms are offered through.
 */
function positions(target: HTMLElement): HTMLSelectElement {
  const found = target.querySelector('select');
  if (found === null) {
    throw new Error('this form draws no position control');
  }
  return found;
} // End of function positions()

/**
 * One of the form's two boxes.
 *
 * @param target - Where the component was mounted.
 * @param field - Which one.
 * @returns The control.
 */
function box(
  target: HTMLElement,
  field: 'trigger' | 'replace'
): HTMLInputElement | HTMLTextAreaElement {
  const found =
    field === 'trigger'
      ? target.querySelector('input.text')
      : target.querySelector('textarea.text');
  if (!(found instanceof HTMLInputElement) && !(found instanceof HTMLTextAreaElement)) {
    throw new Error(`this form draws no box for ${field}`);
  }
  return found;
} // End of function box()

/**
 * Everything the form says inside one box's own field.
 *
 * The disclosure under a box is a claim about *that control*, so a case about it
 * has to look inside the block the control is in rather than at the whole form:
 * `target.textContent` would pass with both sentences under one box and none
 * under the other.
 *
 * @param target - Where the component was mounted.
 * @param field - Which box's field.
 * @returns The text of the `.field` block that box is in.
 */
function fieldSays(target: HTMLElement, field: 'trigger' | 'replace'): string {
  const block = box(target, field).closest('.field');
  if (block === null) {
    throw new Error(`the ${field} box is not inside a field block`);
  }
  return block.textContent ?? '';
} // End of function fieldSays()

/**
 * Types into one box the way a person does.
 *
 * The controls are controlled rather than bound, so the value is set and a real
 * `input` event is dispatched — which is the path a keystroke takes.
 *
 * @param target - Where the component was mounted.
 * @param field - Which box.
 * @param text - The whole new value of the control.
 */
function type(target: HTMLElement, field: 'trigger' | 'replace', text: string): void {
  const control = box(target, field);
  control.value = text;
  control.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
} // End of function type()

/**
 * Picks one position, the way a person does.
 *
 * @param target - Where the component was mounted.
 * @param key - The option's own key, as the model minted it.
 */
function pick(target: HTMLElement, key: string): void {
  const select = positions(target);
  select.value = key;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  flushSync();
} // End of function pick()

/**
 * Whether the form is showing one sentence.
 *
 * @param target - Where the component was mounted.
 * @param key - The key holding the sentence.
 * @returns `true` when the rendered text contains it.
 */
function says(target: HTMLElement, key: TranslationKey): boolean {
  return (target.textContent ?? '').includes(DICTIONARIES.en[key]);
} // End of function says()

/**
 * Fills the form in over the writable file.
 *
 * @param form - The mounted form.
 */
function fillIn(form: Mounted): void {
  destination(form.target, 'match/base.yml').click();
  flushSync();
  type(form.target, 'trigger', ':new');
  type(form.target, 'replace', 'a body');
} // End of function fillIn()

/** What one scripted `execCommand('copy')` saw. */
interface CopiedSelections {
  /** The **selected** text of each copy, in order. */
  readonly selections: string[];
}

/**
 * Replaces `document.execCommand` with one that records what was *selected*.
 *
 * **It reads the carrier's selection and never its whole value**, which is the
 * 2c-4a-3a review's finding 4: a mock that reads `.value` passes even when the
 * component forgets to select anything, and a real `execCommand('copy')` over an
 * empty selection copies nothing. Setting a text area's `value` leaves its
 * selection collapsed at the end, so an unselected carrier records `''` here.
 *
 * The caller restores the original descriptor; this only installs.
 *
 * @returns The recorder the case reads.
 */
function recordTheSelectionCopied(): CopiedSelections {
  const selections: string[] = [];
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    writable: true,
    value: (command: string): boolean => {
      const selected = document.activeElement;
      if (selected instanceof HTMLTextAreaElement) {
        selections.push(
          selected.value.slice(selected.selectionStart ?? 0, selected.selectionEnd ?? 0)
        );
      }
      return command === 'copy';
    }
  });
  return { selections };
} // End of function recordTheSelectionCopied()

/**
 * A `raised` envelope about one file, sealed as the window seals one — Phase
 * 2d-6-6c-1.
 *
 * @param document - The file that changed.
 * @param relativePath - Its display path.
 * @param sequence - The sequence it was admitted under.
 * @returns The envelope.
 */
function changeTo(document: DocumentId, relativePath: string, sequence: number): ObservationDelivery {
  return arbitratedDelivery(
    null,
    {
      sequence,
      document,
      previousRevision: BASE,
      diskRevision: 'f'.repeat(64),
      diskText: DISK_TEXT,
      disk: makeDocument({ id: document, relativePath, revision: 'f'.repeat(64) }),
      findings: [],
      correspondences: null
    },
    false
  );
} // End of function changeTo()

/**
 * Waits for the component's asynchronous handler to finish.
 *
 * A macrotask rather than a fixed number of microtask ticks: counting ticks is a
 * way to write a test that passes until somebody adds an `await`.
 */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync();
} // End of function settle()

/**
 * The acknowledgement port every mount here is handed (Phase 2d-6-9b-2), fresh for
 * each case: it predicts an enabled control and accepts a press until a case
 * scripts otherwise, and records which source each press minted from.
 */
let acknowledging: ScriptedAcknowledgement = scriptedAcknowledgement();

beforeEach(() => {
  acknowledging = scriptedAcknowledgement();
  locale.setOverride('en');
});

afterEach(() => {
  locale.setOverride(null);
});

describe('the mounted new-snippet form', () => {
  it('offers every file the window lists, with a reason on the ones it cannot write', () => {
    // **The consult's Q5 on a screen.** A destination list silently shorter than
    // the sidebar reads as an incomplete list rather than as an explanation, so a
    // profile, a package and a file this window could not read are all drawn — and
    // each carries the typed refusal that says why it is not offered for writing.
    const form = mountCreator();
    const listed = [...form.target.querySelectorAll('.destinations button')].map((one) =>
      one.textContent?.trim()
    );
    expect(listed).toEqual([
      'config/default.yml',
      'match/base.yml',
      'match/other.yml',
      'match/packages/x/package.yml',
      'match/unreadable.yml'
    ]);
    expect(destination(form.target, 'match/base.yml').disabled).toBe(false);
    for (const [path, reason] of [
      ['config/default.yml', 'notASnippetFile'],
      ['match/packages/x/package.yml', 'readOnly'],
      ['match/unreadable.yml', 'couldNotBeRead']
    ] as const) {
      expect(destination(form.target, path).disabled).toBe(true);
      expect(says(form.target, destinationRefusalKey(reason as DestinationRefusal))).toBe(true);
    } // End of the loop over the three refused destinations
    form.stop();
  }); // End of the "every file offered" case

  it('says why the form cannot be sent, one reason at a time', () => {
    // The small editor's `beginSave` answers a bare `null` and cannot explain
    // itself; every refusal here has a code, so the disabled control says why.
    const form = mountCreator();
    expect(control(form.target, 'browser.matchCreation.create').disabled).toBe(true);
    expect(says(form.target, 'browser.matchCreation.cannotCreate.noDestination')).toBe(true);

    destination(form.target, 'match/base.yml').click();
    flushSync();
    expect(says(form.target, 'browser.matchCreation.cannotCreate.triggerEmpty')).toBe(true);

    type(form.target, 'trigger', ':new');
    expect(says(form.target, 'browser.matchCreation.cannotCreate.replaceEmpty')).toBe(true);

    type(form.target, 'replace', 'a body');
    expect(control(form.target, 'browser.matchCreation.create').disabled).toBe(false);
    form.stop();
  }); // End of the "refusal sentences" case

  it('defaults to After the held snippet only when it is in the file chosen', () => {
    // The consult's Q4. The held selection is in `match/base.yml`, so choosing
    // that file defaults to following it — and choosing the other one cannot keep
    // an anchor that belongs to a file it is not in.
    const held: MatchId = { document: 2, revision: BASE, node: 11 };
    const form = mountCreator([], held);
    destination(form.target, 'match/base.yml').click();
    flushSync();
    expect(positions(form.target).value).toBe(`after:2:${BASE}:11`);

    destination(form.target, 'match/other.yml').click();
    flushSync();
    expect(positions(form.target).value).toBe('end');
    form.stop();
  }); // End of the "After default" case

  it('sends the file, the anchor identity, both values and its own base revision', async () => {
    const held: MatchId = { document: 2, revision: BASE, node: 11 };
    const form = mountCreator([{ result: COMMITTED }], held);
    fillIn(form);
    pick(form.target, `after:2:${BASE}:10`);

    control(form.target, 'browser.matchCreation.create').click();
    await settle();

    expect(form.calls).toHaveLength(1);
    const sent = form.calls[0]!;
    expect(sent.document).toBe(2);
    expect(sent.newMatch).toEqual({ trigger: ':new', replace: 'a body' });
    // **An identity and never an ordinal**, which is the half of Q4 a model test
    // cannot make a claim about: what the control produced is the anchor the model
    // minted, all three of its fields.
    expect(sent.position).toEqual({ After: { anchor: { document: 2, revision: BASE, node: 10 } } });
    expect(sent.baseRevision).toBe(BASE);
    expect(sent.acknowledgement).toEqual({ accepted: [] });
    form.stop();
  }); // End of the "sends the anchor" case

  it('sends the newly chosen file’s revision after the destination moves', async () => {
    // The base revision is re-pointed by the model when the destination changes,
    // and this is the half only a screen can show: the value that reaches the
    // boundary is the second file's, not the one the form opened at.
    const form = mountCreator([{ result: COMMITTED }]);
    destination(form.target, 'match/base.yml').click();
    flushSync();
    destination(form.target, 'match/other.yml').click();
    flushSync();
    type(form.target, 'trigger', ':new');
    type(form.target, 'replace', 'a body');

    control(form.target, 'browser.matchCreation.create').click();
    await settle();

    expect(form.calls[0]?.document).toBe(3);
    expect(form.calls[0]?.baseRevision).toBe(OTHER);
    form.stop();
  }); // End of the "retargeted base revision" case

  it('keeps a carriage return out of both boxes, and each box loses it its own way', () => {
    // **What this measures and what it does not.** jsdom is not WebKit, but it
    // normalises both controls' API values the same way the shipped webview was
    // measured to (`docs/decisions/2c-2-2-window-reading.md` section 6): assigning
    // `"a\rb"` to the body box reads back `"a\nb"`, and assigning `":a\rb"` to the
    // trigger box reads back `":ab"` — collapsed in the one, **deleted** in the
    // other. So a carriage return never reaches the model through a control at
    // all, which is why the form's own gate is covered in `matchCreation.test.ts`
    // against a caller rather than against a box. The agreement is what makes the
    // two disclosures checkable here; it is not evidence that jsdom is WebKit, and
    // the shipped behaviour rests on the window reading either way.
    const form = mountCreator();
    fillIn(form);
    type(form.target, 'replace', 'a\rb');
    expect(box(form.target, 'replace').value).not.toContain('\r');
    expect(box(form.target, 'replace').value).toBe('a\nb');
    type(form.target, 'trigger', ':a\rb');
    expect(box(form.target, 'trigger').value).not.toContain('\r');
    // The trigger does not gain a line break in exchange: the character is gone,
    // which is the fact the shared sentence used to contradict.
    expect(box(form.target, 'trigger').value).toBe(':ab');
    form.stop();
  }); // End of the "carriage return" case

  it('discloses each box’s own normalisation, beside that box', () => {
    // **The review's first finding.** One shared sentence promised that a pasted
    // carriage return became an ordinary line break, which is true of the body and
    // false of the trigger — where the character is removed, so a person could
    // create a snippet whose trigger is not the one the screen described. Each
    // control now carries its own sentence, and this case is what fails if they
    // are merged again or if one of them drifts to the wrong control.
    const form = mountCreator();
    const triggerSaid = fieldSays(form.target, 'trigger');
    const replaceSaid = fieldSays(form.target, 'replace');
    expect(triggerSaid).toContain(DICTIONARIES.en['browser.matchCreation.lineEndings.trigger']);
    expect(replaceSaid).toContain(DICTIONARIES.en['browser.matchCreation.lineEndings.replace']);
    // Neither box carries the other's claim, in either direction.
    expect(triggerSaid).not.toContain(DICTIONARIES.en['browser.matchCreation.lineEndings.replace']);
    expect(replaceSaid).not.toContain(DICTIONARIES.en['browser.matchCreation.lineEndings.trigger']);
    form.stop();
  }); // End of the "per-control disclosure" case

  it('draws the one rejection only a create can produce', async () => {
    // `documentHasNoMatchList` became drawable with this screen: no other command
    // answers it, so until now the sentence existed in both dictionaries and
    // reached no window at all.
    const form = mountCreator([{ failure: NO_MATCH_LIST }]);
    fillIn(form);

    control(form.target, 'browser.matchCreation.create').click();
    await settle();

    expect(says(form.target, 'browser.matchCreation.sendFailed')).toBe(true);
    expect(says(form.target, 'code.commandError.documentHasNoMatchList')).toBe(true);
    // Nothing was written, so nothing claims otherwise, and the draft is kept.
    expect(says(form.target, 'browser.saveOutcome.fileWritten')).toBe(false);
    expect(box(form.target, 'replace').value).toBe('a body');
    form.stop();
  }); // End of the "no match list" case

  it('never shows a copy of one retained draft as the copy of another', async () => {
    // **Phase 2d-6-6c-1's review, second finding.** The copy disclosure was one
    // component-wide flag, so a draft copied under one conflict was still said to
    // be copied under the next — after the person had named another file and
    // edited the text. The disclosure belongs to the exact snapshot copied.
    const original = Object.getOwnPropertyDescriptor(document, 'execCommand');
    recordTheSelectionCopied();
    try {
      const form = mountCreator();
      type(form.target, 'trigger', ':new');
      type(form.target, 'replace', 'a body');
      form.deliver(changeTo(2, 'match/base.yml', 5));
      control(form.target, conflictChoiceKey('copyDraft', 'authoredText')).click();
      await settle();
      expect(says(form.target, 'browser.saveOutcome.draftCopied')).toBe(true);

      // Another file named: the conflict goes, the boxes come back, the text changes.
      destination(form.target, 'match/other.yml').click();
      flushSync();
      type(form.target, 'replace', 'an edited body');
      form.deliver(changeTo(3, 'match/other.yml', 6));

      expect(says(form.target, 'browser.externalConflict.fileChangedWhileOpen')).toBe(true);
      expect(says(form.target, 'browser.saveOutcome.draftCopied')).toBe(false);
      form.stop();
    } finally {
      if (original === undefined) {
        Reflect.deleteProperty(document, 'execCommand');
      } else {
        Object.defineProperty(document, 'execCommand', original);
      }
    }
  }); // End of the "copy bound to its snapshot" case

  it('ignores a clipboard completion that arrives for a snapshot no longer shown', async () => {
    // The same finding's second half: the clipboard answers asynchronously, and an
    // answer about the draft that *was* retained must not be installed over the
    // draft that is retained when it lands.
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    let finish: (() => void) | null = null;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (): Promise<void> =>
          new Promise<void>((resolve) => {
            finish = resolve;
          })
      }
    });
    try {
      const form = mountCreator();
      type(form.target, 'trigger', ':new');
      type(form.target, 'replace', 'a body');
      form.deliver(changeTo(2, 'match/base.yml', 5));
      control(form.target, conflictChoiceKey('copyDraft', 'authoredText')).click();
      flushSync();

      destination(form.target, 'match/other.yml').click();
      flushSync();
      type(form.target, 'replace', 'an edited body');
      form.deliver(changeTo(3, 'match/other.yml', 6));
      const late = finish as (() => void) | null;
      late?.();
      await settle();

      expect(says(form.target, 'browser.externalConflict.fileChangedWhileOpen')).toBe(true);
      expect(says(form.target, 'browser.saveOutcome.draftCopied')).toBe(false);
      expect(says(form.target, 'browser.saveOutcome.draftCopyFailed')).toBe(false);
      form.stop();
    } finally {
      if (original === undefined) {
        Reflect.deleteProperty(navigator, 'clipboard');
      } else {
        Object.defineProperty(navigator, 'clipboard', original);
      }
    }
  }); // End of the "late clipboard completion" case

  it('settles a create that throws instead of staying in flight forever', async () => {
    // **2d-6-3's carried item, closed in Phase 2d-6-6c-1.** A wrapper that throws
    // answers nothing, and the form used to stay `saving` for good: the create
    // control refused with `saveInFlight`, *Stop adding this snippet* stayed
    // disabled, and nothing said why. Nothing is known about the file, so the form
    // settles as a send that may have written, keeps the draft, and gives the
    // controls back.
    const form = mountCreator([{ throws: new Error('the wrapper threw') }]);
    fillIn(form);

    control(form.target, 'browser.matchCreation.create').click();
    await settle();

    expect(form.calls).toHaveLength(1);
    expect(says(form.target, 'browser.matchCreation.mayHaveWritten')).toBe(true);
    expect(says(form.target, 'browser.matchCreation.saving')).toBe(false);
    expect(says(form.target, 'browser.matchCreation.cannotCreate.saveInFlight')).toBe(false);
    expect(control(form.target, 'browser.matchCreation.close').disabled).toBe(false);
    expect(box(form.target, 'replace').value).toBe('a body');
    form.stop();
  }); // End of the "thrown create" case

  it('runs the acknowledgement round trip with consent bound to what is on screen', async () => {
    const form = mountCreator([{ result: REFUSED }, { result: COMMITTED }]);
    fillIn(form);

    control(form.target, 'browser.matchCreation.create').click();
    await settle();
    expect(says(form.target, 'browser.saveOutcome.nothingWasWritten')).toBe(true);

    control(form.target, 'browser.rawSave.choice.saveAnyway').click();
    await settle();

    expect(form.calls).toHaveLength(2);
    expect(form.calls[1]?.acknowledgement).toEqual({ accepted: [SUSPICION] });
    expect(says(form.target, 'browser.saveOutcome.fileWritten')).toBe(true);
    form.stop();
  }); // End of the "acknowledgement round trip" case

  it('withdraws the consent when the destination moves after a refusal', async () => {
    // **The first review round's first finding, on a screen.** Consent is
    // content-addressed to the buffers alone, and a destination is not a buffer:
    // findings accepted for a create into one file are not consent for another.
    const form = mountCreator([{ result: REFUSED }, { result: COMMITTED }]);
    fillIn(form);
    control(form.target, 'browser.matchCreation.create').click();
    await settle();
    expect(button(form.target, 'browser.rawSave.choice.saveAnyway')).not.toBeNull();

    destination(form.target, 'match/other.yml').click();
    flushSync();

    expect(button(form.target, 'browser.rawSave.choice.saveAnyway')).toBeNull();
    control(form.target, 'browser.matchCreation.create').click();
    await settle();
    expect(form.calls[1]?.acknowledgement).toEqual({ accepted: [] });
    form.stop();
  }); // End of the "consent withdrawn" case

  it('spends itself on a commit and re-seeds from what the window has since read', async () => {
    const form = mountCreator([{ result: COMMITTED }]);
    fillIn(form);
    control(form.target, 'browser.matchCreation.create').click();
    await settle();

    expect(says(form.target, 'browser.saveOutcome.fileWritten')).toBe(true);
    expect(says(form.target, 'browser.matchCreation.committed')).toBe(true);
    // The form has stopped accepting changes, and there is no *Dismiss* that puts
    // the obligation out of sight without discharging it.
    expect(control(form.target, 'browser.matchCreation.create').disabled).toBe(true);
    expect(button(form.target, 'browser.notice.dismiss')).toBeNull();
    expect(says(form.target, 'browser.matchCreation.cannotCreate.alreadyCreated')).toBe(true);

    // The window has re-read the file the commit replaced. The re-seed must see
    // *that* parse, which is why the readers are functions.
    const rewritten = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: AFTER,
      matches: [
        makeMatch({ node: 40, document: 2, revision: AFTER, trigger: ':sig' }),
        makeMatch({ node: 41, document: 2, revision: AFTER, trigger: ':new' })
      ]
    });
    form.reproject([profile(), rewritten, secondFile(), packageFile()]);
    control(form.target, 'browser.matchCreation.addAnother').click();
    flushSync();

    expect(box(form.target, 'trigger').value).toBe('');
    destination(form.target, 'match/base.yml').click();
    flushSync();
    const offered = [...positions(form.target).querySelectorAll('option')].map((one) => one.value);
    expect(offered).toEqual(['front', `after:2:${AFTER}:40`, `after:2:${AFTER}:41`, 'end']);
    form.stop();
  }); // End of the "commit spends the form" case

  it('asks before leaving with something typed, and leaves at once without it', () => {
    const clean = mountCreator();
    control(clean.target, 'browser.matchCreation.close').click();
    flushSync();
    expect(clean.closed()).toBe(1);
    clean.stop();

    const dirty = mountCreator();
    fillIn(dirty);
    control(dirty.target, 'browser.matchCreation.close').click();
    flushSync();

    expect(dirty.closed()).toBe(0);
    expect(says(dirty.target, 'browser.matchCreation.discardWarning')).toBe(true);
    control(dirty.target, 'browser.matchCreation.discard').click();
    flushSync();
    expect(dirty.closed()).toBe(1);
    dirty.stop();
  }); // End of the "leaving" case

  it('shows both sides of a conflict, and adds nothing', async () => {
    // **The comparison the consult's Q5 ruled, on this screen.** The retained
    // draft is the two typed strings under their labels, through `SourceText`, and
    // the disk side is the whole file text the command layer read. There is no
    // disk-side snippet to point at — this one was never written — so nothing here
    // pretends to find one.
    const form = mountCreator([{ result: CONFLICTED }]);
    fillIn(form);
    control(form.target, 'browser.matchCreation.create').click();
    await settle();

    expect(says(form.target, 'browser.saveOutcome.nothingWasWritten')).toBe(true);
    expect(says(form.target, 'browser.saveOutcome.retainedDraft')).toBe(true);
    expect(says(form.target, 'browser.saveOutcome.diskVersion')).toBe(true);
    expect(form.target.textContent).toContain(DISK_TEXT_MARKER);
    // The two drafted values plus the disk text, all through the one rendering
    // surface for file text.
    expect(form.target.querySelectorAll('.panel .sourceText')).toHaveLength(3);
    // Both revisions, always, and the third beside them.
    expect(form.target.textContent).toContain(
      t('browser.matchCreation.revisionExpected', { revision: BASE })
    );
    expect(form.target.textContent).toContain(
      t('browser.matchCreation.revisionFound', { revision: AFTER })
    );
    expect(form.target.textContent).toContain(
      t('browser.matchCreation.revisionDisk', { revision: AFTER })
    );
    // Three choices, and the destructive one is a second step away.
    expect(button(form.target, conflictChoiceKey('keepEditing', 'authoredText'))).not.toBeNull();
    expect(button(form.target, conflictChoiceKey('copyDraft', 'authoredText'))).not.toBeNull();
    expect(button(form.target, conflictChoiceKey('reloadDiskVersion', 'authoredText'))).not.toBeNull();
    expect(button(form.target, conflictChoiceKey('confirmReload', 'authoredText'))).toBeNull();
    // And nothing has moved: no adoption, and the form is still open.
    expect(form.adoptions).toEqual([]);
    expect(form.closed()).toBe(0);
    form.stop();
  }); // End of the "both sides" case

  it('adopts the disk version and closes only when the reload is confirmed', async () => {
    const form = mountCreator([{ result: CONFLICTED }]);
    fillIn(form);
    control(form.target, 'browser.matchCreation.create').click();
    await settle();

    expect(says(form.target, 'browser.matchCreation.reloadSeedsNoForm')).toBe(false);
    control(form.target, conflictChoiceKey('reloadDiskVersion', 'authoredText')).click();
    flushSync();

    // The second step: the warning that says what happens *here* — the window
    // crosses, this form closes, and the snippet is not added.
    expect(says(form.target, 'browser.matchCreation.reloadSeedsNoForm')).toBe(true);
    expect(button(form.target, conflictChoiceKey('copyDraft', 'authoredText'))).not.toBeNull();
    expect(button(form.target, conflictChoiceKey('reloadDiskVersion', 'authoredText'))).toBeNull();
    expect(form.adoptions).toEqual([]);
    expect(form.closed()).toBe(0);

    control(form.target, conflictChoiceKey('confirmReload', 'authoredText')).click();
    flushSync();

    expect(form.adoptions).toHaveLength(1);
    expect(form.adoptions[0]?.diskRevision).toBe(AFTER);
    expect(form.closed()).toBe(1);
    // Nothing was sent a second time: a conflict is not a retry.
    expect(form.calls).toHaveLength(1);
    form.stop();
  }); // End of the "confirmed reload" case

  it.each(LOCALES)('closes on `alreadyThere`, and closes nothing on `refused` (%s)', async (lang) => {
    // **`alreadyThere` is a success**: the window already holds the bytes that
    // were asked for. `refused` is the only answer that means it did not move.
    // Run once per locale (Phase 2d-7-2): the 2d-6-11a notes, section 5 item 4,
    // left this loop EN-only.
    locale.setOverride(lang);
    for (const [answer, closes] of [
      ['alreadyThere', 1],
      ['installed', 1],
      ['refused', 0]
    ] as const) {
      const form = mountCreator([{ result: CONFLICTED }], null, undefined, answer);
      fillIn(form);
      pressIn(form.target, lang, 'browser.matchCreation.create');
      await settle();
      pressIn(form.target, lang, conflictChoiceKey('reloadDiskVersion', 'authoredText'));
      flushSync();
      pressIn(form.target, lang, conflictChoiceKey('confirmReload', 'authoredText'));
      flushSync();

      expect(form.adoptions, answer).toHaveLength(1);
      expect(form.closed(), answer).toBe(closes);
      // A refused adoption leaves the conflict on screen rather than reporting a
      // reload that did not happen.
      expect(
        (form.target.textContent ?? '').includes(translate(lang, 'browser.saveOutcome.nothingWasWritten')),
        answer
      ).toBe(closes === 0);
      form.stop();
    } // End of the loop over the three adoption answers
  }); // End of the "three adoption answers" case

  it('stops offering the reload once the window has refused it, and says why', async () => {
    // **The 2c-4a-3a review's finding 3, from the screen.** The control the window
    // refused without a word is gone, and the sentence takes its place; *Keep
    // editing* and the copy stay. Withholding it claims nothing about how a later
    // ask would be answered.
    const form = mountCreator([{ result: CONFLICTED }], null, undefined, 'refused');
    fillIn(form);
    control(form.target, 'browser.matchCreation.create').click();
    await settle();
    control(form.target, conflictChoiceKey('reloadDiskVersion', 'authoredText')).click();
    flushSync();
    control(form.target, conflictChoiceKey('confirmReload', 'authoredText')).click();
    flushSync();

    // The authored-text half of 3c-4's split: this surface's sentence is the
    // one that was always here, and the operation wording is not drawn.
    expect(says(form.target, reloadUnavailableKey('authoredText'))).toBe(true);
    expect(says(form.target, reloadUnavailableKey('operationChoice'))).toBe(false);
    expect(button(form.target, conflictChoiceKey('confirmReload', 'authoredText'))).toBeNull();
    expect(button(form.target, conflictChoiceKey('reloadDiskVersion', 'authoredText'))).toBeNull();
    expect(button(form.target, conflictChoiceKey('copyDraft', 'authoredText'))).not.toBeNull();
    expect(says(form.target, 'browser.matchCreation.reloadSeedsNoForm')).toBe(false);
    expect(form.adoptions).toHaveLength(1);
    expect(form.closed()).toBe(0);

    // And *Keep editing* gives the form back with what was typed still in it.
    control(form.target, conflictChoiceKey('keepEditing', 'authoredText')).click();
    flushSync();
    expect(box(form.target, 'trigger').value).toBe(':new');
    expect(box(form.target, 'trigger').readOnly).toBe(false);
    form.stop();
  }); // End of the "refused reload stops being offered" case

  it('warns that the reload closes this form, never that it replaces the text', async () => {
    // **The 2c-4a-3a review's finding 2**: this surface installs the disk
    // projection and closes, and there is no half-written snippet on disk to load
    // in the draft's place.
    const form = mountCreator([{ result: CONFLICTED }]);
    fillIn(form);
    control(form.target, 'browser.matchCreation.create').click();
    await settle();

    expect(says(form.target, 'browser.saveOutcome.reloadClosesSurface')).toBe(true);
    expect(says(form.target, 'browser.saveOutcome.reloadDiscardsDraft')).toBe(false);
    form.stop();
  }); // End of the "surface-aware warning" case

  it('copies a labelled reference of the draft, and never YAML', async () => {
    // The selection fallback, exactly as the webview takes it: jsdom has no
    // clipboard, so `navigator.clipboard.writeText` rejects and the carrier route
    // runs. What it carries is the same list the panel drew.
    const original = Object.getOwnPropertyDescriptor(document, 'execCommand');
    const copied = recordTheSelectionCopied();
    try {
      const form = mountCreator([{ result: CONFLICTED }]);
      fillIn(form);
      control(form.target, 'browser.matchCreation.create').click();
      await settle();

      control(form.target, conflictChoiceKey('copyDraft', 'authoredText')).click();
      await settle();

      expect(says(form.target, 'browser.saveOutcome.draftCopied')).toBe(true);
      expect(says(form.target, 'browser.saveOutcome.draftCopyFailed')).toBe(false);
      // **Exactly what the model would render, and only what was selected.** The
      // mock records the carrier's *selection*, so a carrier the component never
      // selected copies an empty string and fails this (2c-4a-3a review,
      // finding 4).
      expect(copied.selections).toEqual([
        tDraftCopy([
          { label: 'trigger', text: ':new', status: 'setting' },
          { label: 'replace', text: 'a body', status: 'setting' }
        ])
      ]);
      const text = copied.selections[0] ?? '';
      expect(text).toContain(DICTIONARIES.en['browser.saveOutcome.copyHeading']);
      // Not YAML, and nothing that could be pasted back as one.
      expect(text).not.toContain('matches:');
      expect(text).not.toContain('trigger: :new');
      // The carrier is gone again: the form's own body box is the only one left.
      expect(document.querySelectorAll('textarea')).toHaveLength(1);
      form.stop();
    } finally {
      if (original === undefined) {
        Reflect.deleteProperty(document, 'execCommand');
      } else {
        Object.defineProperty(document, 'execCommand', original);
      }
    }
  }); // End of the "reference copy" case

  it('keeps the authored-text way out saying “Keep editing”', async () => {
    // **The other side of 2c-4a-3c's finding 10.2.** `conflictChoiceKey` branches
    // `keepEditing` on the draft kind now, and this form drafts authored text: the
    // person really is editing, so its label must **not** have moved with the three
    // operation-choice panels'.
    const form = mountCreator([{ result: CONFLICTED }]);
    fillIn(form);
    control(form.target, 'browser.matchCreation.create').click();
    await settle();

    expect(button(form.target, 'browser.rawSave.choice.keepEditing')).not.toBeNull();
    expect(button(form.target, 'browser.saveOutcome.choice.keepOperation')).toBeNull();
    form.stop();
  }); // End of the "authored-text way out" case

  it('says the snippet was drafted against a revision, never written to one', async () => {
    // **2c-4a-3c's finding 10.1, on the screen that produced it.** The Spanish line
    // read *"Este fragmento **se ha escrito** sobre la versión …"* four lines under
    // *"No se ha escrito nada"*, on the one panel whose entire job is to make that
    // unambiguous. `dictionaries.test.ts` holds the invariant over both locales'
    // whole `revisionExpected` family; this case is the one that says the two
    // sentences really are drawn on the same panel, which is what made the
    // contradiction visible in the first place.
    const form = mountCreator([{ result: CONFLICTED }]);
    fillIn(form);
    control(form.target, 'browser.matchCreation.create').click();
    await settle();

    const panel = form.target.querySelector('[role="status"]');
    expect(panel).not.toBeNull();
    const drawn = panel?.textContent ?? '';
    expect(drawn).toContain(DICTIONARIES.en['browser.saveOutcome.nothingWasWritten']);
    expect(drawn).toContain(t('browser.matchCreation.revisionExpected', { revision: BASE }));
    form.stop();
  }); // End of the "drafted against, never written to" case
}); // End of the "mounted new-snippet form" suite

describe('the new-snippet form’s refused arm names what this surface drafts', () => {
  /*
   * **The 2c-4a-3c review's Medium, and the arm no window transcript had ever
   * drawn.** `rawSaveChoiceKey` returned `browser.rawSave.choice.keepEditing`
   * unconditionally, so a refusal carrying findings offered *Keep editing* on the
   * mover, the deleter and the duplicator, where nobody typed anything. 3c-3
   * deferred this on the grounds that no reading had seen it; the review's answer
   * is that absence from a transcript is a gap in evidence and not evidence that
   * a reachable label is correct.
   */

  it('labels the way out by the draft kind, and the same control still dismisses', async () => {
    const form = mountCreator([{ result: REFUSED }]);
    fillIn(form);
    control(form.target, 'browser.matchCreation.create').click();
    await settle();

    expect(says(form.target, 'browser.saveOutcome.nothingWasWritten')).toBe(true);
    expect(button(form.target, rawSaveChoiceKey('keepEditing', 'authoredText'))).not.toBeNull();
    expect(button(form.target, rawSaveChoiceKey('keepEditing', 'operationChoice'))).toBeNull();

    // Nothing else moved: it is the same choice with the truthful label on it.
    control(form.target, rawSaveChoiceKey('keepEditing', 'authoredText')).click();
    flushSync();
    expect(says(form.target, 'browser.saveOutcome.nothingWasWritten')).toBe(false);
    expect(form.calls).toHaveLength(1);
    form.stop();
  }); // End of the "refused arm names what this surface drafts" case
}); // End of the "new-snippet form's refused arm" suite

describe('the new-snippet form asks for its outcome to be brought into view', () => {
  /*
   * **2c-4a-3c's findings 10.3 and 10.4, from this component's own markup.** This
   * form is one of the two surfaces where the *confirmation* control was pushed
   * back out of the viewport by the very sentence that justifies it — y = 771 in
   * English and y = 788 in Spanish, in a 728 px window, after the pane had already
   * been scrolled to its end. That is why the second step has a target of its own.
   *
   * The decision is `./reveal.ts`'s and has its own suite; what only a mounted case
   * can say is that this file **binds** the two elements and **runs** the effect.
   */

  /** Every `scrollIntoView` the mounted component asked for, in order. */
  const scrolled: { readonly target: Element; readonly block: unknown }[] = [];

  beforeEach(() => {
    scrolled.length = 0;
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value(this: Element, options?: ScrollIntoViewOptions) {
        scrolled.push({ target: this, block: options?.block });
      }
    });
  });

  afterEach(() => {
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  /**
   * A form showing a conflict over a filled-in draft.
   *
   * @returns The mounted form.
   */
  async function conflicted(): Promise<ReturnType<typeof mountCreator>> {
    const form = mountCreator([{ result: CONFLICTED }]);
    fillIn(form);
    control(form.target, 'browser.matchCreation.create').click();
    await settle();
    return form;
  } // End of function conflicted()

  it('asks for the panel’s first line when a conflict appears', async () => {
    const form = await conflicted();
    const outcome = form.target.querySelector('[role="status"]');
    expect(outcome).not.toBeNull();
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]?.target).toBe(outcome);
    expect(scrolled[0]?.block).toBe('start');
    form.stop();
  });

  it('asks for the controls at the reload’s second step', async () => {
    const form = await conflicted();
    scrolled.length = 0;
    control(form.target, conflictChoiceKey('reloadDiskVersion', 'authoredText')).click();
    flushSync();

    const choices = form.target.querySelector('[role="status"] .choices');
    expect(choices).not.toBeNull();
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]?.target).toBe(choices);
    expect(scrolled[0]?.block).toBe('end');
    form.stop();
  });

  it('asks for the replacing panel when one arm succeeds another', async () => {
    // **The 2c-4a-3c review's second finding, and only a mounted case can see it.**
    // `beginSave` retains the refusal while the retry is in flight, so `saved`
    // replaces `refused` over the **same** bound element. While all three arms
    // answered one `'panel'` cue the effect's dependency did not change, so it need
    // not run and nothing ever asked for the new panel's first line. The spy
    // is cleared before the second result, so what is asserted is a *new* reveal.
    const form = mountCreator([{ result: REFUSED }, { result: COMMITTED }]);
    fillIn(form);
    control(form.target, 'browser.matchCreation.create').click();
    await settle();
    expect(says(form.target, 'browser.saveOutcome.nothingWasWritten')).toBe(true);
    const refusedPanel = form.target.querySelector('[role="status"]');

    scrolled.length = 0;
    control(form.target, 'browser.rawSave.choice.saveAnyway').click();
    await settle();

    expect(says(form.target, 'browser.saveOutcome.fileWritten')).toBe(true);
    const savedPanel = form.target.querySelector('[role="status"]');
    expect(savedPanel).toBe(refusedPanel);
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]?.target).toBe(savedPanel);
    expect(scrolled[0]?.block).toBe('start');
    form.stop();
  }); // End of the "arm replacing an arm" case

  it('asks for a refused reapply’s report, and again on a second press', async () => {
    // **2c-4b-3c-2 §11.1.** The report is drawn *above* the outcome panel, and
    // that reading measured it entirely above the scrollport in all 42 of its
    // refusal launches while the outcome panel below it kept pixel-identical
    // coordinates — so pressing the control and being refused changed nothing a
    // person could see. The **second** press is what settled the severity: the
    // identical sentence at the identical rectangle, with nothing to tell the two
    // presses apart. It is asserted here because the cue is a string and a second
    // refusal produces the same string, so an effect depending on the cue alone
    // would not re-run.
    //
    // **jsdom has no viewport and does not lay anything out**, so this case
    // cannot fail because the block ends up off screen. What it pins is that this
    // component binds the block and runs the effect. 3d-2's window reading is the
    // only thing that can say a person sees the sentence. **And the spy installed
    // above is a platform that always accepts**: a real one may have no
    // `scrollIntoView` or may refuse the call, and `scrollQuietly` is silent for
    // both — so the reveal is asked for here, never achieved.
    const form = await conflicted();
    scrolled.length = 0;
    control(form.target, conflictChoiceKey('keepMyDraft', 'authoredText')).click();
    flushSync();

    const report = form.target.querySelector('[role="status"].reapply');
    expect(report).not.toBeNull();
    expect(says(form.target, 'browser.reapply.manualResolution')).toBe(true);
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]?.target).toBe(report);
    expect(scrolled[0]?.block).toBe('nearest');

    scrolled.length = 0;
    control(form.target, conflictChoiceKey('keepMyDraft', 'authoredText')).click();
    flushSync();
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]?.target).toBe(report);
    expect(scrolled[0]?.block).toBe('nearest');
    form.stop();
  }); // End of the "asks for a refused reapply's report" case
}); // End of the "new-snippet form asks for its outcome" suite

describe('the creation form’s *Keep my draft*', () => {
  /** The reapply control's label on this surface, whose draft is authored text. */
  const KEEP_MY_DRAFT = conflictChoiceKey('keepMyDraft', 'authoredText');

  /**
   * The same conflict, carrying the arm a creation's own conflict carries.
   *
   * **`Targetless` and not `Unsupported`.** A creation brings its own snippet and
   * names no existing one to find again; a whole-document replacement has no
   * snippet *and* no honest reapply, and collapsing the two is what consult Q3
   * forbids.
   */
  const TARGETLESS: SaveResult = {
    ...CONFLICTED,
    disk: makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: AFTER,
      matches: [
        makeMatch({ node: 30, document: 2, revision: AFTER, trigger: ':sig' }),
        makeMatch({ node: 31, document: 2, revision: AFTER, trigger: ':date' })
      ]
    }),
    reapply: { subject: { Targetless: {} }, placement: { NotAnchored: {} } }
  };

  /**
   * A form showing a conflict over a filled-in draft, with a chosen payload.
   *
   * @param result - The conflict the scripted boundary answers with.
   * @returns The mounted form.
   */
  async function conflictedWith(result: SaveResult): Promise<Mounted> {
    const form = mountCreator([{ result }]);
    fillIn(form);
    control(form.target, 'browser.matchCreation.create').click();
    await settle();
    return form;
  } // End of function conflictedWith()

  it('draws the control and the authored-text line beside it', async () => {
    const form = await conflictedWith(CONFLICTED);
    expect(button(form.target, KEEP_MY_DRAFT)).not.toBeNull();
    expect(says(form.target, 'browser.reapply.ready')).toBe(true);
    expect(says(form.target, 'browser.reapply.readyOperation')).toBe(false);
    form.stop();
  });

  it('re-points the form at the disk version and sends it afresh', async () => {
    // The typed values are what a person wrote and mean the same against either
    // parse; the destination, the base revision and every ordinary check are
    // rebuilt around them, and the consent collected before the conflict is gone.
    const form = await conflictedWith(TARGETLESS);
    control(form.target, KEEP_MY_DRAFT).click();
    flushSync();

    expect(form.adoptions).toHaveLength(1);
    expect(says(form.target, 'browser.reapply.reapplied')).toBe(true);
    expect(says(form.target, 'browser.saveOutcome.nothingWasWritten')).toBe(false);
    expect(form.calls).toHaveLength(1);

    control(form.target, 'browser.matchCreation.create').click();
    await settle();
    expect(form.calls).toHaveLength(2);
    expect(form.calls[1]?.baseRevision).toBe(AFTER);
    // The acknowledgement round trip starts again: findings accepted for one
    // revision's candidate say nothing about another's.
    expect(form.calls[1]?.acknowledgement).toEqual({ accepted: [] });
    form.stop();
  }); // End of the "form re-pointed" case

  it('refuses and adopts nothing when the evidence is not a creation’s', async () => {
    // `Unsupported` is a whole-document replacement's arm, and a form handed one
    // treats the disagreement as a refusal: it writes nothing.
    const form = await conflictedWith(CONFLICTED);
    control(form.target, KEEP_MY_DRAFT).click();
    flushSync();

    expect(says(form.target, 'browser.reapply.manualResolution')).toBe(true);
    expect(says(form.target, 'browser.reapply.obstacle.evidenceNotATarget')).toBe(true);
    expect(form.adoptions).toEqual([]);
    expect(says(form.target, 'browser.saveOutcome.nothingWasWritten')).toBe(true);
    form.stop();
  });
}); // End of the "creation form’s reapply" suite

describe('an ordinary creation that repeats a literal trigger', () => {
  /*
   * **The evidence 2c-4c-1's live behaviour change never got.**
   * `FindingCode::NewMatchRepeatsLiteralTrigger` is emitted for every `InsertItem`
   * candidate, so it reaches an **ordinary** `create_match` on this form and not
   * only a recovery create — exact repetition is a property of the candidate and
   * not of the route that reached it. It shipped at step 1 with no mounted test and
   * no window reading behind it, which is what these two cases close.
   *
   * The claim the sentence makes is **risk and nothing else**: the localized string
   * says the new snippet repeats trigger text another snippet already writes and
   * that this application cannot determine how espanso will handle overlapping
   * definitions. No test in this repository pins that meaning — the i18n suites
   * check key parity and placeholder agreement — so what these cases hold is that
   * the finding is *drawn*, that it is *acknowledgeable*, and that the consent it
   * collects is bound to the exact candidate.
   */

  /** The finding step 1 added, as a refusal carries it. */
  const REPEATS_TRIGGER: Finding = {
    code: { NewMatchRepeatsLiteralTrigger: { revision: AFTER } },
    path: null,
    span: null,
    node: null
  };

  /** What the transaction answers for a create refused for that one suspicion. */
  const REPEATED: SaveResult = {
    outcome: 'refused',
    verdict: 'RefusedForUnacknowledgedSuspicions',
    findings: [REPEATS_TRIGGER]
  };

  it('draws it as an acknowledgeable risk, and saving anyway carries it back whole', async () => {
    const form = mountCreator([{ result: REPEATED }, { result: COMMITTED }]);
    fillIn(form);
    control(form.target, 'browser.matchCreation.create').click();
    await settle();

    expect(says(form.target, 'code.findingCode.newMatchRepeatsLiteralTrigger')).toBe(true);
    expect(form.calls[0]?.acknowledgement).toEqual({ accepted: [] });

    control(form.target, rawSaveChoiceKey('saveAnyway', 'authoredText')).click();
    await settle();
    // The **complete** accepted finding, its `revision` operand included: the gate
    // matches an exact multiset, so a consent that dropped the operand would be
    // consent for a different candidate.
    expect(form.calls).toHaveLength(2);
    expect(form.calls[1]?.acknowledgement).toEqual({ accepted: [REPEATS_TRIGGER] });
    expect(says(form.target, 'browser.matchCreation.committed')).toBe(true);
    form.stop();
  }); // End of the "acknowledgeable risk" case

  it('withdraws the acceptance the moment the candidate changes', async () => {
    // Content-addressed consent, on a screen: the finding names the candidate's own
    // revision, so a keystroke afterwards makes the offer to save past it an offer
    // this application would not keep.
    const form = mountCreator([{ result: REPEATED }]);
    fillIn(form);
    control(form.target, 'browser.matchCreation.create').click();
    await settle();
    expect(button(form.target, rawSaveChoiceKey('saveAnyway', 'authoredText'))).not.toBeNull();

    type(form.target, 'trigger', ':different');
    expect(says(form.target, 'browser.matchCreation.findingsAreStale')).toBe(true);
    expect(button(form.target, rawSaveChoiceKey('saveAnyway', 'authoredText'))).toBeNull();
    expect(form.calls).toHaveLength(1);
    form.stop();
  });
}); // End of the "ordinary repeated trigger" suite

describe('the creation form’s recovery', () => {
  /** The reapply control's label on this surface. */
  const KEEP_MY_DRAFT = conflictChoiceKey('keepMyDraft', 'authoredText');

  /** The label of the control that offers recovery. */
  const CREATE_FROM_FIELDS = recoveryChoiceKey('createFromSupportedFields');

  /**
   * A form at a conflict a reapply could resolve nothing about.
   *
   * `CONFLICTED` carries a whole-document replacement's evidence, which a creation
   * cannot rebase onto — so *Keep my draft* refuses and adopts nothing, which is
   * exactly recovery's entry condition.
   *
   * @param answers - What each successive create answers, in order. **The recovery
   *   panel is handed the same `create` this form uses**, which is the production
   *   arrangement: both go through `BrowserState.createMatch`.
   * @returns The mounted form, at the manual-resolution report.
   */
  async function stuck(answers: readonly ScriptedAnswer[]): Promise<Mounted> {
    const form = mountCreator(answers);
    fillIn(form);
    control(form.target, 'browser.matchCreation.create').click();
    await settle();
    control(form.target, KEEP_MY_DRAFT).click();
    flushSync();
    return form;
  } // End of function stuck()

  it('offers nothing until a reapply has resolved nothing', async () => {
    const form = mountCreator([{ result: CONFLICTED }]);
    fillIn(form);
    control(form.target, 'browser.matchCreation.create').click();
    await settle();
    expect(button(form.target, CREATE_FROM_FIELDS)).toBeNull();
    form.stop();
  });

  it('offers recovery once it has, and reaches a committed create', async () => {
    const form = await stuck([{ result: CONFLICTED }, { result: COMMITTED }]);
    expect(says(form.target, 'browser.reapply.manualResolution')).toBe(true);
    control(form.target, CREATE_FROM_FIELDS).click();
    flushSync();

    expect(says(form.target, 'browser.recovery.transferHeading')).toBe(true);
    expect(says(form.target, sourceConflictStateKey('retained'))).toBe(true);
    control(form.target, 'browser.recovery.create').click();
    await settle();

    expect(form.calls).toHaveLength(2);
    expect(form.calls[1]?.document).toBe(2);
    expect(form.calls[1]?.position).toEqual({ End: {} });
    // The **disk** revision the conflict carried, which is the newest observation
    // this window has of that file.
    expect(form.calls[1]?.baseRevision).toBe(AFTER);
    // The two authored fields and no key nobody authored: an absent optional writes
    // no key, which is a different request from sending it empty.
    expect(form.calls[1]?.newMatch).toEqual({ trigger: ':new', replace: 'a body' });
    expect(form.adoptions).toEqual([]);
    expect(says(form.target, sourceConflictStateKey('spent'))).toBe(true);
    form.stop();
  }); // End of the "reaches a committed create" case

  it('keeps the form’s own conflict and draft through an abandoned recovery', async () => {
    const form = await stuck([{ result: CONFLICTED }]);
    control(form.target, CREATE_FROM_FIELDS).click();
    flushSync();
    control(form.target, 'browser.recovery.close').click();
    flushSync();

    expect(form.calls).toHaveLength(1);
    expect(form.adoptions).toEqual([]);
    expect(says(form.target, 'browser.saveOutcome.draftKeptInMemory')).toBe(true);
    expect(button(form.target, KEEP_MY_DRAFT)).not.toBeNull();
    expect(button(form.target, CREATE_FROM_FIELDS)).not.toBeNull();
    form.stop();
  });
}); // End of the "creation form’s recovery" suite

describe('the form reporting its destination upward', () => {
  it('reports no file on mount, then the file that is chosen', () => {
    // **Phase 2d-5-2b.** The destination is state that lives inside this
    // component, so the host can only register this form as a surface over a file
    // by being told — and the consult says no type can force a child to invoke its
    // required reporter correctly, which makes this a mounted fact or nothing.
    const form = mountCreator();
    flushSync();
    expect(form.reports[0]).toBeNull();

    destination(form.target, 'match/base.yml').click();
    flushSync();
    expect(form.reports.at(-1)).toBe(2);
    form.stop();
  }); // End of the "reports what is chosen" case

  it('reports the destination the model defaulted to, with no control pressed', () => {
    // **The report is over `matchCreationView`'s answer, never over the control
    // that was pressed**, and this is the difference: `startMatchCreation` chooses
    // the held selection's own file, so the very first report names a file nobody
    // clicked. A reporter wired into the destination handler would have said
    // `null` here, and the host would have registered a surface over no file while
    // the form was already pointed at one.
    const held: MatchId = { document: 2, revision: BASE, node: 11 };
    const form = mountCreator([], held);
    flushSync();
    expect(form.reports[0]).toBe(2);
    form.stop();
  }); // End of the "reports the model's default" case

  it('reports again when a transition leaves the destination where it was', () => {
    // **What the host has to absorb, said as a fact rather than as a hope.** The
    // report comes from an effect over the session, so every transition re-runs it
    // — typing moves no destination and still reports one. Nothing here can force
    // a host to make the repeat inert; `DetailPane.svelte` assigns it to state,
    // where an equal value notifies nothing, and `DetailPane.test.ts`'s *"leaves
    // the registry alone when the form reports the same file again"* is what shows
    // the registry is not churned by it. **That case was written by Phase 2d-5-2b's
    // review** (finding 3): this sentence named coverage that did not exist for one
    // phase, because no case over there drove a repeat report at all.
    const form = mountCreator();
    destination(form.target, 'match/base.yml').click();
    flushSync();
    const afterChoosing = form.reports.length;

    type(form.target, 'trigger', ':new');
    flushSync();
    expect(form.reports.length).toBeGreaterThan(afterChoosing);
    expect(new Set(form.reports.slice(afterChoosing))).toEqual(new Set([2]));
    form.stop();
  }); // End of the "reports repeat" case
}); // End of the "reporting its destination" suite

/**
 * The button labelled with one key's rendering in one language, or `null` —
 * Phase 2d-6-9b-2's acknowledgement cases.
 *
 * @param scope - Where to look.
 * @param lang - The language the case runs in.
 * @param key - The key holding the label.
 * @returns The button, or `null`.
 */
function labelledIn(scope: HTMLElement, lang: Locale, key: TranslationKey): HTMLButtonElement | null {
  const label = translate(lang, key);
  return [...scope.querySelectorAll('button')].find((each) => each.textContent?.trim() === label) ?? null;
} // End of function labelledIn()

/**
 * Presses the button labelled with one key in one language, insisting it is drawn.
 *
 * @param scope - Where to look.
 * @param lang - The language the case runs in.
 * @param key - The key holding the label.
 */
function pressIn(scope: HTMLElement, lang: Locale, key: TranslationKey): void {
  const found = labelledIn(scope, lang, key);
  if (found === null) {
    throw new Error(`this case needs the control labelled ${translate(lang, key)}`);
  }
  found.click();
} // End of function pressIn()

/**
 * The external conflict's own panel, for the acknowledgement cases.
 *
 * @param target - Where the component was mounted.
 * @returns The panel.
 */
function externalConflictPanel(target: HTMLElement): HTMLElement {
  const found = target.querySelector<HTMLElement>('.panel.external');
  if (found === null) {
    throw new Error('this case needs the external conflict panel');
  }
  return found;
} // End of function externalConflictPanel()

/** The acknowledgement's label key, shared with the workspace route. */
const ACKNOWLEDGE_SNAPSHOT: TranslationKey = 'browser.externalConflict.action.acknowledgeSnapshot';

/** This panel's reload choice, whose presence says whether the reload is withheld. */
const RELOAD_CHOICE = conflictChoiceKey('reloadDiskVersion', 'authoredText');

describe('The new-snippet form acknowledges an unknown write outcome on its own panel, in English and Spanish — Phase 2d-6-9b-2', () => {
  // The pane draws the unknown-outcome sentence once, above this panel
  // (`FileReconciliationStatus.svelte`); this panel draws only the control, under
  // the disk snapshot it is about, and mints from its own conflict's source
  // through the port `DetailPane.svelte` hands it. The port is scripted here
  // (`scriptedAcknowledgement` in `../browser/fixtures.ts`); the window's own is
  // `ReconciliationStatus.test.ts`'s.

  /**
   * Mounts the panel and brings it to the point where a conflict can be shown.
   *
   * @param lang - The language the case runs in.
   * @returns The mounted panel.
   */
  async function opened(lang: Locale): Promise<Mounted> {
    locale.setOverride(lang);
    const mounted = mountCreator();
    destination(mounted.target, 'match/base.yml').click();
    flushSync();
    type(mounted.target, 'trigger', ':new');
    type(mounted.target, 'replace', 'a body');
    return mounted;
  } // End of function opened()

  /**
   * One observation of the panel's file.
   *
   * @returns A fresh observation, so its source is its own.
   */
  function seenChange(): ExternalConflictObservation {
    return {
      sequence: 5,
      document: 2,
      previousRevision: BASE,
      diskRevision: 'f'.repeat(64),
      diskText: DISK_TEXT,
      disk: makeDocument({ id: 2, relativePath: 'match/base.yml', revision: 'f'.repeat(64) }),
      findings: [],
      correspondences: null
    };
  } // End of function seenChange()

  it.each(LOCALES)('offers it under the disk snapshot, mints from the conflict it shows, and offers the reload again (%s)', async (lang) => {
    const mounted = await opened(lang);
    const seen = seenChange();
    mounted.deliver(arbitratedDelivery(null, seen, true));

    const panel = externalConflictPanel(mounted.target);
    const acknowledge = labelledIn(panel, lang, ACKNOWLEDGE_SNAPSHOT);
    expect(acknowledge?.disabled).toBe(false);
    // Under the snapshot it is about: the disk text comes first in the panel.
    const text = panel.textContent ?? '';
    expect(text.indexOf('theirs')).toBeGreaterThanOrEqual(0);
    expect(text.indexOf('theirs')).toBeLessThan(text.indexOf(translate(lang, ACKNOWLEDGE_SNAPSHOT)));
    // The unknown-outcome sentence is the pane's and never this panel's.
    expect(mounted.target.textContent).not.toContain(
      translate(lang, 'browser.externalConflict.writeOutcomeUnknown')
    );
    expect(labelledIn(panel, lang, RELOAD_CHOICE)).toBeNull();

    acknowledge?.click();
    flushSync();
    // One press, minted from the very source this panel shows.
    expect(acknowledging.asked).toHaveLength(1);
    expect(acknowledging.asked[0]).toBe(externalConflictSource(seen));
    const after = externalConflictPanel(mounted.target);
    expect(labelledIn(after, lang, ACKNOWLEDGE_SNAPSHOT)).toBeNull();
    // The reload is offered again, from its idle step, and nothing was adopted.
    expect(labelledIn(after, lang, RELOAD_CHOICE)).not.toBeNull();
    expect(mounted.adoptions).toEqual([]);
    mounted.stop();
  }); // End of the "acknowledged" case

  it.each(LOCALES)('draws it disabled with its refusal and this panel’s exits, and keeps the reload withheld (%s)', async (lang) => {
    const cases: readonly (readonly [ReconciliationRefusal, TranslationKey | null])[] = [
      ['projectionReplaced', 'browser.reconciliation.surface.observationExit'],
      ['superseded', 'browser.reconciliation.surface.observationExit'],
      ['holdMoved', 'browser.reconciliation.surface.holdEnded'],
      ['writeInFlight', null]
    ];
    for (const [refusal, note] of cases) {
      acknowledging.refusal = refusal;
      const mounted = await opened(lang);
      mounted.deliver(arbitratedDelivery(null, seenChange(), true));

      const panel = externalConflictPanel(mounted.target);
      expect(labelledIn(panel, lang, ACKNOWLEDGE_SNAPSHOT)?.disabled).toBe(true);
      const text = panel.textContent ?? '';
      expect(text).toContain(translate(lang, reconciliationRefusalKey(refusal)));
      for (const exit of [
        'browser.reconciliation.surface.observationExit',
        'browser.reconciliation.surface.holdEnded'
      ] as const) {
        expect(text.includes(translate(lang, exit))).toBe(exit === note);
      }
      expect(labelledIn(panel, lang, RELOAD_CHOICE)).toBeNull();
      mounted.stop();
    } // End of the loop over the four refusals
  }); // End of the "disabled" case

  it.each(LOCALES)('draws a refused press’s reason once and changes nothing (%s)', async (lang) => {
    acknowledging.answer = 'holdMoved';
    const mounted = await opened(lang);
    mounted.deliver(arbitratedDelivery(null, seenChange(), true));

    labelledIn(externalConflictPanel(mounted.target), lang, ACKNOWLEDGE_SNAPSHOT)?.click();
    flushSync();
    expect(acknowledging.asked).toHaveLength(1);
    const panel = externalConflictPanel(mounted.target);
    const sentence = translate(lang, 'browser.reconciliation.refusal.holdMoved');
    expect((panel.textContent ?? '').split(sentence)).toHaveLength(2);
    // The window said no, so the session is as it was: still withholding.
    expect(labelledIn(panel, lang, ACKNOWLEDGE_SNAPSHOT)).not.toBeNull();
    expect(labelledIn(panel, lang, RELOAD_CHOICE)).toBeNull();
    mounted.stop();
  }); // End of the "refused press" case

  it.each(LOCALES)('offers nothing to acknowledge over a conflict raised under no uncertainty (%s)', async (lang) => {
    const mounted = await opened(lang);
    mounted.deliver(arbitratedDelivery(null, seenChange(), false));

    const panel = externalConflictPanel(mounted.target);
    expect(labelledIn(panel, lang, ACKNOWLEDGE_SNAPSHOT)).toBeNull();
    expect(labelledIn(panel, lang, RELOAD_CHOICE)).not.toBeNull();
    mounted.stop();
  }); // End of the "nothing owed" case
}); // End of the "own acknowledgement" suite

describe('the new-snippet form under an external conflict, in English and Spanish — Phase 2d-6-11a', () => {
  // **The design consult's Q8 row for this surface** (`docs/reviews/phase-2d-6-design.md`,
  // "Each surface's mounted suite"): an external conflict cannot submit, every offered
  // choice invokes its intended transition, a supersession withdraws the reload
  // warning, and the three answers of `adoptDiskVersion` have their surface effects.
  // The conflict is delivered through the receiver the form reported, in envelopes
  // the real `arbitratedDelivery` sealed; the window's own registration and
  // arbitration are `DetailPane.test.ts`'s. Every sentence is pinned to its
  // dictionary value in the case's locale, which protects which code is drawn
  // where, never the quality of a translation.

  /** The revision a first observation of the destination read. */
  const SEEN: ContentRevision = 'd'.repeat(64);

  /** The revision a later observation of the destination read. */
  const SEEN_LATER: ContentRevision = 'e'.repeat(64);

  /** The snippet the window holds, which the form places the new one after. */
  const HELD: MatchId = { document: 2, revision: BASE, node: 11 };

  /** The *Keep editing* choice on this surface, whose draft is authored text. */
  const KEEP_EDITING = conflictChoiceKey('keepEditing', 'authoredText');

  /** The *Copy my text* choice. */
  const COPY_DRAFT = conflictChoiceKey('copyDraft', 'authoredText');

  /** The *Keep my draft* choice, which is the reapply. */
  const KEEP_MY_DRAFT = conflictChoiceKey('keepMyDraft', 'authoredText');

  /** The reload's second step. */
  const CONFIRM_RELOAD = conflictChoiceKey('confirmReload', 'authoredText');

  /** The reload warning this surface draws at the second step. */
  const RELOAD_WARNING: TranslationKey = 'browser.matchCreation.reloadSeedsNoForm';

  /**
   * The held snippet as a disk read at one revision projects it.
   *
   * @param revision - The revision the disk read.
   * @returns The disk-side snippet.
   */
  function twinAt(revision: ContentRevision): ReturnType<typeof makeMatch> {
    return makeMatch({ node: 31, document: 2, revision, trigger: ':date' });
  } // End of function twinAt()

  /**
   * One observation of the form's destination.
   *
   * A fresh object every call: the memo in `../browser/conflictSource.ts` and a
   * session's wait are both keyed on identity.
   *
   * @param sequence - The sequence it was admitted under.
   * @param revision - The revision it read.
   * @param withTwin - Whether it carries a correspondence naming the held
   *   snippet's twin, so an `after` placement can be rebuilt over it.
   * @returns The observation.
   */
  function observed(
    sequence: number,
    revision: ContentRevision = SEEN,
    withTwin = false
  ): ExternalConflictObservation {
    const twin = twinAt(revision);
    return {
      sequence,
      document: 2,
      previousRevision: BASE,
      diskRevision: revision,
      diskText: DISK_TEXT,
      disk: makeDocument({
        id: 2,
        relativePath: 'match/base.yml',
        revision,
        matches: [makeMatch({ node: 30, document: 2, revision, trigger: ':sig' }), twin]
      }),
      findings: [],
      correspondences: withTwin
        ? {
            base_revision: BASE,
            disk_revision: revision,
            entries: [
              {
                base: HELD,
                exact: { Identified: { target: twin } },
                editor: { Identified: { target: twin } }
              }
            ]
          }
        : null
    };
  } // End of function observed()

  /**
   * The envelope a window seals for a first observation of the destination.
   *
   * @param seen - The observation.
   * @returns The `raised` envelope.
   */
  function raisedBy(seen: ExternalConflictObservation): ObservationDelivery {
    return arbitratedDelivery(null, seen, false);
  } // End of function raisedBy()

  /**
   * The envelope a window seals for a later observation over one that stands.
   *
   * @param prior - The observation whose origin stands.
   * @param seen - The later observation.
   * @returns The `supersedes` envelope.
   */
  function supersededBy(
    prior: ExternalConflictObservation,
    seen: ExternalConflictObservation
  ): ObservationDelivery {
    return arbitratedDelivery(standingConflictOf(externalConflictSource(prior)), seen, false);
  } // End of function supersededBy()

  /**
   * Mounts the form in one language, filled in over the writable file, before any
   * conflict.
   *
   * @param lang - The language the case runs in.
   * @param adoption - What the window answers when asked to adopt.
   * @param held - The snippet the window holds; `null` places the new one at the end.
   * @returns The mounted form, able to create.
   */
  function opened(
    lang: Locale,
    adoption: DiskAdoptionOutcome = 'installed',
    held: MatchId | null = null
  ): Mounted {
    locale.setOverride(lang);
    const form = mountCreator([{ result: COMMITTED }], held, undefined, adoption);
    fillIn(form);
    return form;
  } // End of function opened()

  /**
   * Presses the choice labelled with one key's rendering, inside the external panel.
   *
   * @param form - The mounted form.
   * @param lang - The language the case runs in.
   * @param key - The key holding the choice's label.
   */
  function choose(form: Mounted, lang: Locale, key: TranslationKey): void {
    const found = labelledIn(externalConflictPanel(form.target), lang, key);
    if (found === null) {
      throw new Error(`this case needs the choice labelled ${translate(lang, key)}`);
    }
    found.click();
    flushSync();
  } // End of function choose()

  /**
   * Whether the external panel offers the choice labelled with one key's rendering.
   *
   * @param form - The mounted form.
   * @param lang - The language the case runs in.
   * @param key - The key holding the choice's label.
   * @returns `true` when it does.
   */
  function offers(form: Mounted, lang: Locale, key: TranslationKey): boolean {
    return labelledIn(externalConflictPanel(form.target), lang, key) !== null;
  } // End of function offers()

  /**
   * The external panel's text, or `null` when none is drawn.
   *
   * @param form - The mounted form.
   * @returns The panel's text.
   */
  function externalText(form: Mounted): string | null {
    return form.target.querySelector('.panel.external')?.textContent ?? null;
  } // End of function externalText()

  /**
   * The form's create control, in the case's language.
   *
   * @param form - The mounted form.
   * @param lang - The language the case runs in.
   * @returns The control, or `null` when it is not drawn.
   */
  function createIn(form: Mounted, lang: Locale): HTMLButtonElement | null {
    return labelledIn(form.target, lang, 'browser.matchCreation.create');
  } // End of function createIn()

  it.each(LOCALES)('refuses to send a form under an external conflict, and draws its origin and choices (%s)', async (lang) => {
    const form = opened(lang);
    expect(createIn(form, lang)?.disabled).toBe(false);

    form.deliver(raisedBy(observed(5)));

    // **Direct submission is refused**: the control is drawn disabled, the boxes are
    // held read-only, and a click forced past the disabled control sends nothing.
    const create = createIn(form, lang);
    expect(create).not.toBeNull();
    expect(create?.disabled).toBe(true);
    expect(box(form.target, 'trigger').readOnly).toBe(true);
    expect(box(form.target, 'replace').value).toBe('a body');
    create?.click();
    await settle();
    expect(form.calls).toEqual([]);
    const shown = externalText(form) ?? '';
    expect(shown).toContain(translate(lang, 'browser.conflictOrigin.changedWhileOpen'));
    expect(shown).toContain(translate(lang, 'browser.externalConflict.fileChangedWhileOpen'));
    expect(shown).toContain(translate(lang, 'browser.externalConflict.revisionObserved', { revision: SEEN }));
    expect(shown).toContain(DISK_TEXT_MARKER);
    for (const key of [KEEP_EDITING, COPY_DRAFT, KEEP_MY_DRAFT, RELOAD_CHOICE]) {
      expect(offers(form, lang, key)).toBe(true);
    } // End of the loop over the four first-step choices
    expect(offers(form, lang, CONFIRM_RELOAD)).toBe(false);
    expect(form.adoptions).toEqual([]);
    expect(form.closed()).toBe(0);
    form.stop();
  }); // End of the "cannot submit" case

  it.each(LOCALES)('keeps the conflict through Keep editing, and resets the reload step (%s)', (lang) => {
    const form = opened(lang);
    form.deliver(raisedBy(observed(5)));
    choose(form, lang, RELOAD_CHOICE);
    expect(externalText(form)).toContain(translate(lang, RELOAD_WARNING));
    expect(offers(form, lang, CONFIRM_RELOAD)).toBe(true);

    choose(form, lang, KEEP_EDITING);

    // The warning is gone and the first step is back; the conflict stands, so the
    // form stays read-only and nothing can be sent.
    expect(externalText(form)).not.toBeNull();
    expect(externalText(form)).not.toContain(translate(lang, RELOAD_WARNING));
    expect(offers(form, lang, RELOAD_CHOICE)).toBe(true);
    expect(offers(form, lang, CONFIRM_RELOAD)).toBe(false);
    expect(createIn(form, lang)?.disabled).toBe(true);
    expect(box(form.target, 'trigger').readOnly).toBe(true);
    expect(form.calls).toEqual([]);
    expect(form.adoptions).toEqual([]);
    expect(form.closed()).toBe(0);
    form.stop();
  }); // End of the "keep editing" case

  it.each(LOCALES)('copies the retained draft through Copy my text, and keeps the conflict (%s)', async (lang) => {
    const original = Object.getOwnPropertyDescriptor(document, 'execCommand');
    const copied = recordTheSelectionCopied();
    try {
      const form = opened(lang);
      form.deliver(raisedBy(observed(5)));

      choose(form, lang, COPY_DRAFT);
      await settle();

      expect(copied.selections).toHaveLength(1);
      expect(copied.selections[0]).toContain(':new');
      expect(copied.selections[0]).toContain('a body');
      expect(form.target.textContent).toContain(translate(lang, 'browser.saveOutcome.draftCopied'));
      expect(form.target.textContent).not.toContain(
        translate(lang, 'browser.saveOutcome.draftCopyFailed')
      );
      // A copy resolves nothing: the conflict and its restriction stand.
      expect(externalText(form)).not.toBeNull();
      expect(createIn(form, lang)?.disabled).toBe(true);
      expect(form.calls).toEqual([]);
      expect(form.adoptions).toEqual([]);
      form.stop();
    } finally {
      if (original === undefined) {
        Reflect.deleteProperty(document, 'execCommand');
      } else {
        Object.defineProperty(document, 'execCommand', original);
      }
    }
  }); // End of the "copy" case

  it.each(LOCALES)('re-points an end placement at the disk version through Keep my draft, which needs no row (%s)', async (lang) => {
    // A creation brings its own snippet, so an `end` placement consults no row of
    // the table (`rebuiltPlacement` in `../browser/matchCreation.ts`): the reapply
    // proceeds with the observation carrying no correspondence at all.
    const form = opened(lang);
    const seen = observed(5);
    form.deliver(raisedBy(seen));

    choose(form, lang, KEEP_MY_DRAFT);

    expect(form.adoptions.map((one) => one.source)).toEqual([externalConflictSource(seen)]);
    expect(form.target.textContent).toContain(translate(lang, 'browser.reapply.reapplied'));
    expect(externalText(form)).toBeNull();
    expect(box(form.target, 'trigger').value).toBe(':new');
    expect(box(form.target, 'trigger').readOnly).toBe(false);
    expect(form.calls).toEqual([]);

    createIn(form, lang)?.click();
    await settle();
    expect(form.calls).toHaveLength(1);
    expect(form.calls[0]?.baseRevision).toBe(SEEN);
    expect(form.calls[0]?.position).toEqual({ End: {} });
    form.stop();
  }); // End of the "end placement reapplied" case

  it.each(LOCALES)('rebuilds an after placement over the anchor’s twin when the evidence names it (%s)', async (lang) => {
    const form = opened(lang, 'installed', HELD);
    expect(positions(form.target).value).toBe(`after:2:${BASE}:11`);
    const seen = observed(5, SEEN, true);
    form.deliver(raisedBy(seen));

    choose(form, lang, KEEP_MY_DRAFT);

    expect(form.adoptions.map((one) => one.source)).toEqual([externalConflictSource(seen)]);
    expect(form.target.textContent).toContain(translate(lang, 'browser.reapply.reapplied'));
    expect(externalText(form)).toBeNull();
    expect(form.calls).toEqual([]);

    createIn(form, lang)?.click();
    await settle();
    // What goes out is placed after the twin, against the version the reapply adopted.
    expect(form.calls).toHaveLength(1);
    expect(form.calls[0]?.baseRevision).toBe(SEEN);
    expect(form.calls[0]?.position).toEqual({ After: { anchor: twinAt(SEEN).id } });
    form.stop();
  }); // End of the "after placement reapplied" case

  it.each(LOCALES)('refuses Keep my draft for an after placement without evidence, says why, and keeps the conflict (%s)', (lang) => {
    const form = opened(lang, 'installed', HELD);
    form.deliver(raisedBy(observed(5)));

    choose(form, lang, KEEP_MY_DRAFT);

    const shown = form.target.textContent ?? '';
    expect(shown).toContain(translate(lang, 'browser.reapply.manualResolution'));
    expect(shown).toContain(translate(lang, 'browser.reapply.externalEvidence.noCorrespondence'));
    expect(externalText(form)).not.toBeNull();
    expect(createIn(form, lang)?.disabled).toBe(true);
    expect(box(form.target, 'trigger').value).toBe(':new');
    expect(form.adoptions).toEqual([]);
    expect(form.calls).toEqual([]);
    form.stop();
  }); // End of the "reapply refused" case

  it.each(LOCALES)('withdraws the reload warning when a later reading supersedes the conflict (%s)', (lang) => {
    const form = opened(lang);
    const first = observed(5);
    form.deliver(raisedBy(first));
    choose(form, lang, RELOAD_CHOICE);
    expect(offers(form, lang, CONFIRM_RELOAD)).toBe(true);

    form.deliver(supersededBy(first, observed(6, SEEN_LATER)));

    // The confirmation collected for the first conflict is not spendable against
    // this one, and its warning does not stay on screen.
    expect(offers(form, lang, CONFIRM_RELOAD)).toBe(false);
    expect(offers(form, lang, RELOAD_CHOICE)).toBe(true);
    const shown = externalText(form) ?? '';
    expect(shown).not.toContain(translate(lang, RELOAD_WARNING));
    expect(shown).toContain(
      translate(lang, 'browser.externalConflict.revisionObserved', { revision: SEEN_LATER })
    );
    expect(shown).not.toContain(
      translate(lang, 'browser.externalConflict.revisionObserved', { revision: SEEN })
    );
    expect(form.adoptions).toEqual([]);
    expect(form.calls).toEqual([]);
    form.stop();
  }); // End of the "supersession" case

  it.each(
    LOCALES.flatMap((lang) =>
      (['installed', 'alreadyThere', 'refused'] as const).map((adoption) => [lang, adoption] as const)
    )
  )('reloads in two steps and closes on what the window answers (%s, %s)', (lang, adoption) => {
    const form = opened(lang, adoption);
    const seen = observed(5);
    form.deliver(raisedBy(seen));
    choose(form, lang, RELOAD_CHOICE);
    expect(externalText(form)).toContain(translate(lang, RELOAD_WARNING));
    expect(form.adoptions).toEqual([]);

    choose(form, lang, CONFIRM_RELOAD);

    // One adoption, of this observation's conflict and no other.
    expect(form.adoptions).toHaveLength(1);
    expect(form.adoptions[0]?.source).toBe(externalConflictSource(seen));
    if (adoption === 'refused') {
      // Nothing closes over a window that did not move, and the control that has
      // just gone is replaced by the reason.
      expect(form.closed()).toBe(0);
      const shown = externalText(form) ?? '';
      expect(shown).toContain(translate(lang, reloadUnavailableKey('authoredText')));
      expect(shown).not.toContain(translate(lang, RELOAD_WARNING));
      expect(offers(form, lang, RELOAD_CHOICE)).toBe(false);
      expect(offers(form, lang, CONFIRM_RELOAD)).toBe(false);
      expect(offers(form, lang, KEEP_EDITING)).toBe(true);
    } else {
      expect(form.closed()).toBe(1);
    }
    expect(form.calls).toEqual([]);
    form.stop();
  }); // End of the "two-step reload" case
}); // End of the "new-snippet form under an external conflict" suite
