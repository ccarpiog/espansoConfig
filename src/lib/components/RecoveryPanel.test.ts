/** @vitest-environment jsdom */

/**
 * The recovery panel, mounted and driven through real DOM events.
 *
 * The eighth file in this repository to opt into jsdom, and it opts in the same
 * way the first seven do: by the docblock above and by nothing else. The suite's
 * default environment is still `node`, and the components that predate
 * `RawEditor.svelte` are deliberately not back-filled
 * (`docs/decisions/2c-split-notes.md` section 7).
 *
 * **What this file is for, given that `recovery.test.ts` already exists.** That
 * suite drives the value; it cannot see whether a control is drawn, what the
 * transfer table says about a field, whether a destination this application will
 * not write into is offered anyway, or what the panel hands to the boundary. Six
 * of this sub-phase's claims are only about that:
 *
 * 1. **the transfer disclosure names three different things** — carried, omitted,
 *    and *type this in* — with a key carried as an **empty value** told apart from
 *    a key that is not written at all, which is step 1's `None`-is-not-`Some("")`
 *    contract on a screen;
 * 2. **only files this application may write into are listed**, and a missing
 *    snippet list is never invented;
 * 3. **the placement is a sentence and not a control**, so nothing on this screen
 *    can ask for `After` or for a numeric position;
 * 4. **the repeated-trigger finding is presented as acknowledgeable risk**, and
 *    the consent it collects is content-addressed: a changed candidate withdraws
 *    the offer rather than spending the old acceptance on the new text;
 * 5. **the original conflict survives every non-committed ending** — a refusal, an
 *    acknowledgement that was refused again, an uncertain send, a dismissal and an
 *    abandonment — and the panel never hands **its** conflict's authorization to
 *    the window in place of its own;
 * 6. **a create can be reached and committed**, with the fixed end placement and
 *    the chosen destination's own base revision on the wire;
 * 7. **a form goes inert on the press and not on the answer** — the 2c-4c-3a
 *    review's first High. `recovery.test.ts` can hold that `sendRecoveryCreate`
 *    offers the waiting form before it authorizes anything; only a mounted panel
 *    with a create **held in flight** can show that this renderer installs it, so
 *    the deferred cases below press every control while one is outstanding.
 *
 * **This does not replace the window reading.** What it proves is that a handler
 * fires and that the right value reaches the boundary. jsdom has no layout, does
 * not implement `scrollIntoView`, and is not WebKit — so neither reveal effect nor
 * either box's carriage-return behaviour can be observed here at all. 2c-4c-5 is
 * the reading.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detailFieldKey } from '../browser/detail';
import { startDraft, structuredDraftRules } from '../browser/draft';
import type { AdoptTheDiskVersion } from '../browser/editorSave';
import { makeConflict, makeDocument, makeMatch, makeSummary } from '../browser/fixtures';
import type { InvalidationStatus } from '../browser/invalidation';
import type { CreationBuffers } from '../browser/matchCreation';
import {
  CONFLICT_CAPABILITIES as EDITOR_CAPABILITIES,
  baselineOf,
  buffersOf,
  fieldLabelName,
  fieldRefusalKey,
  type EditableField,
  type EditorReapplyObstacle,
  type MatchBuffers
} from '../browser/matchEditor';
import { rawSaveChoiceKey } from '../browser/rawSave';
import type { ReapplyOutcome } from '../browser/reapply';
import {
  RECOVERY_CONFLICT_CAPABILITIES,
  recoveryAvailability,
  recoveryChoiceKey,
  recoveryRefusalKey,
  recoveryUnavailableKey,
  sourceConflictStateKey,
  startMatchFieldRecovery,
  transferRefusalKey,
  transferStatusKey,
  type RecoveryAvailability,
  type RecoveryStart
} from '../browser/recovery';
import {
  conflictChoiceKey,
  describeEditSave,
  type ConflictModel,
  type DiskAdoptionOutcome
} from '../browser/saveOutcome';
import type { MatchSaveAnswer } from '../browser/workspace.svelte';
import { DICTIONARIES, type TranslationKey } from '../i18n/dictionaries';
import { locale } from '../stores/locale.svelte';
import type { IpcFailure } from '../ipc/errors';
import type {
  Acknowledgement,
  ContentRevision,
  DocumentId,
  DocumentSummary,
  DocumentView,
  Finding,
  MatchView,
  NewMatch,
  NewMatchPosition,
  SaveResult
} from '../ipc/types';
import RecoveryPanel from './RecoveryPanel.svelte';

/** The revision the window is projecting when the conflict arrives. */
const HELD: ContentRevision = 'a'.repeat(64);

/** The revision the disk projection the conflict carries was taken at. */
const DISK: ContentRevision = 'b'.repeat(64);

/** The revision a second writable file is projected at. */
const OTHER: ContentRevision = 'c'.repeat(64);

/** The revision the destination holds after a committed recovery create. */
const AFTER: ContentRevision = 'd'.repeat(64);

/** The adoption a save that wrote nothing owes: none. */
const NOT_OWED: InvalidationStatus = { kind: 'notOwed' };

/** The adoption a committed save performed. */
const ADOPTED: InvalidationStatus = { kind: 'done' };

/** A clock nothing advances, so every keystroke joins one run. */
const CLOCK = (): number => 0;

/**
 * The snippet the editing session was seeded from.
 *
 * @param overrides - Whatever the case cares about.
 * @returns The projection.
 */
function snippet(overrides: Parameters<typeof makeMatch>[0] = {}): MatchView {
  return makeMatch({
    node: 10,
    document: 2,
    revision: HELD,
    trigger: ':sig',
    replace: 'Regards',
    label: 'A name',
    ...overrides
  });
} // End of function snippet()

/**
 * The file the conflict is about, as the **disk** projection carries it.
 *
 * @param overrides - Whatever the case cares about.
 * @returns The projection.
 */
function diskFile(overrides: Parameters<typeof makeDocument>[0] = {}): DocumentView {
  return makeDocument({ id: 2, relativePath: 'match/base.yml', revision: DISK, ...overrides });
} // End of function diskFile()

/**
 * The file the window still holds, which is the parse the conflict refused.
 *
 * @returns The projection.
 */
function heldFile(): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision: HELD,
    matches: [snippet()]
  });
} // End of function heldFile()

/**
 * A second snippet file, so a change of destination is observable.
 *
 * @returns The projection.
 */
function otherFile(): DocumentView {
  return makeDocument({ id: 3, relativePath: 'match/other.yml', revision: OTHER });
} // End of function otherFile()

/** A config profile, which espanso loads no snippets out of. */
function profile(): DocumentView {
  return makeDocument({ id: 1, relativePath: 'config/default.yml', kind: 'ConfigProfile' });
} // End of function profile()

/** A file from the Hub, which this application may never write. */
function packageFile(): DocumentView {
  return makeDocument({
    id: 4,
    relativePath: 'match/packages/x/package.yml',
    kind: 'Package',
    readOnly: true
  });
} // End of function packageFile()

/**
 * The summary the window would list one projection under.
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

/** The file the window lists and holds no projection of. */
const UNREADABLE: DocumentSummary = makeSummary({ id: 5, relativePath: 'match/unreadable.yml' });

/** The finding 2c-4c-1 added, as a refusal carries it. */
const REPEATS_TRIGGER: Finding = {
  code: { NewMatchRepeatsLiteralTrigger: { revision: AFTER } },
  path: null,
  span: null,
  node: null
};

/** What the transaction answers for a create refused for that one suspicion. */
const REFUSED: SaveResult = {
  outcome: 'refused',
  verdict: 'RefusedForUnacknowledgedSuspicions',
  findings: [REPEATS_TRIGGER]
};

/** What the transaction answers for a committed create. */
const COMMITTED: SaveResult = {
  outcome: 'saved',
  revision: AFTER,
  committed: true,
  notes: [],
  backup_taken: false,
  moved: { document: 2, revision: AFTER, node: 44 }
};

/** A create the destination had moved on under. */
function conflictedCreate(): SaveResult {
  return makeConflict({
    disk: diskFile({ revision: AFTER }),
    expected: DISK,
    subject: { Targetless: {} }
  });
} // End of function conflictedCreate()

/** A rejection that establishes nothing about whether the file was written. */
const UNCERTAIN: IpcFailure = {
  kind: 'command',
  error: {
    code: 'saveFailed',
    error: {
      Write: {
        Io: {
          step: 'SyncDirectory',
          path: '/tmp/espanso/match/base.yml',
          kind: 'Interrupted',
          raw_os_error: 4
        }
      }
    },
    may_have_written: true
  }
};

/** One scripted answer to one recovery create. */
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
   * Whether this create hangs until the case answers it by hand.
   *
   * The only way to observe a form **while** a write is in flight: every other
   * entry resolves before the case can look, so a panel that installed the waiting
   * form and a panel that never did would be indistinguishable. The resolver is
   * handed to the case on {@link Mounted.pending}; the entry's other fields are not
   * read.
   */
  readonly defer?: boolean;
}

/** One call the panel made to the boundary. */
interface RecordedCreate {
  /** Which file it aimed at. */
  readonly document: DocumentId;
  /** What the new snippet says. */
  readonly newMatch: NewMatch;
  /** Where in the list it goes, which is always the end. */
  readonly position: NewMatchPosition;
  /** The revision it said the form was drafted against. */
  readonly baseRevision: ContentRevision;
  /** The suspicions it said had already been shown to a person. */
  readonly acknowledgement: Acknowledgement;
}

/** A mounted panel and everything a case needs to drive it. */
interface Mounted {
  /** The element the component was mounted into. */
  readonly target: HTMLElement;
  /** Every create the panel sent, in order. */
  readonly calls: RecordedCreate[];
  /** The resolvers of the creates still in flight, in the order they were sent. */
  readonly pending: ((answer: MatchSaveAnswer) => void)[];
  /** Every conflict the panel asked the window to adopt, in order. */
  readonly adoptions: ConflictModel<CreationBuffers>[];
  /** The conflict recovery was opened from, which the panel must never spend. */
  readonly source: ConflictModel<MatchBuffers>;
  /** Tears the component down. */
  readonly stop: () => void;
}

/**
 * The conflict a match editor is showing over one drafted value.
 *
 * Built through `describeEditSave` rather than by hand, so the panel is handed the
 * value the boundary and the outcome describer really produce — the `source` wire
 * value included, which recovery carries and must never spend.
 *
 * @param buffers - The draft the conflict retained.
 * @param disk - The newly parsed projection it carries.
 * @returns The conflict model.
 */
function conflictOver(
  buffers: MatchBuffers,
  disk: DocumentView = diskFile()
): ConflictModel<MatchBuffers> {
  const outcome = describeEditSave(
    makeConflict({ disk, expected: HELD }),
    // The draft the editor would have been holding when it conflicted.
    startDraft(HELD, buffers, structuredDraftRules<MatchBuffers>()),
    EDITOR_CAPABILITIES
  );
  if (outcome.kind !== 'conflict') {
    throw new Error('this helper needs the conflict arm');
  }
  return outcome;
} // End of function conflictOver()

/**
 * Mounts the panel over a scripted boundary and one editor conflict.
 *
 * @param options - What the case needs to vary.
 * @returns The mounted panel.
 */
function mountPanel(options: {
  /** The snippet the editing session was seeded from. */
  readonly match?: MatchView;
  /** What the editor's controls held instead of what the file holds. */
  readonly edits?: Partial<MatchBuffers>;
  /** The newly parsed projection the conflict carries. */
  readonly disk?: DocumentView;
  /** Every file the window lists, in window order. */
  readonly documents?: readonly DocumentSummary[];
  /** Every projection the window holds. */
  readonly views?: readonly DocumentView[];
  /** What the surface's last reapply became. */
  readonly attempt?: ReapplyOutcome<unknown, EditorReapplyObstacle> | null;
  /** What each successive create answers, in order. */
  readonly answers?: readonly ScriptedAnswer[];
  /** What the window answers when the panel asks it to adopt a disk observation. */
  readonly adoption?: DiskAdoptionOutcome;
} = {}): Mounted {
  const match = options.match ?? snippet();
  const baseline = baselineOf(match);
  const buffers: MatchBuffers = { ...buffersOf(baseline), ...options.edits };
  const disk = options.disk ?? diskFile();
  const views = options.views ?? [heldFile(), otherFile()];
  const documents =
    options.documents ?? [summaryOf(heldFile()), summaryOf(otherFile())];
  const attempt =
    options.attempt === undefined
      ? ({ kind: 'manualResolution', obstacle: { kind: 'evidenceNotATarget' } } as const)
      : options.attempt;
  const source = conflictOver(buffers, disk);
  const remaining = [...(options.answers ?? [])];
  const calls: RecordedCreate[] = [];
  const pending: ((answer: MatchSaveAnswer) => void)[] = [];
  const adoptions: ConflictModel<CreationBuffers>[] = [];

  const availability: RecoveryAvailability = recoveryAvailability(
    'matchFields',
    attempt,
    source,
    documents,
    views
  );
  const target = document.createElement('div');
  document.body.append(target);
  const component = mount(RecoveryPanel, {
    target,
    props: {
      availability,
      open: (): RecoveryStart =>
        startMatchFieldRecovery(attempt, source, baseline, documents, views, CLOCK),
      create: (
        into: DocumentId,
        newMatch: NewMatch,
        position: NewMatchPosition,
        baseRevision: ContentRevision,
        acknowledgement: Acknowledgement
      ): Promise<MatchSaveAnswer> => {
        calls.push({ document: into, newMatch, position, baseRevision, acknowledgement });
        const next = remaining.shift();
        if (next?.defer === true) {
          return new Promise<MatchSaveAnswer>((resolve) => {
            pending.push(resolve);
          });
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
      adoptDiskVersion: ((conflict: ConflictModel<CreationBuffers>): DiskAdoptionOutcome => {
        adoptions.push(conflict);
        return options.adoption ?? 'installed';
      }) as AdoptTheDiskVersion<CreationBuffers>
    }
  });
  return {
    target,
    calls,
    pending,
    adoptions,
    source,
    stop: () => {
      void unmount(component);
      target.remove();
    }
  };
} // End of function mountPanel()

/**
 * The button whose label is the English rendering of one key, or `null`.
 *
 * Matched against the dictionary rather than against a literal, so this file holds
 * no user-facing text of its own.
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
 * Whether the panel is showing one sentence.
 *
 * @param target - Where the component was mounted.
 * @param key - The key holding the sentence.
 * @returns `true` when the rendered text contains it.
 */
function says(target: HTMLElement, key: TranslationKey): boolean {
  return (target.textContent ?? '').includes(DICTIONARIES.en[key]);
} // End of function says()

/**
 * One of the panel's two boxes.
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
    throw new Error(`this panel draws no box for ${field}`);
  }
  return found;
} // End of function box()

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
  const written = box(target, field);
  written.value = text;
  written.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
} // End of function type()

/**
 * Everything the transfer table says about one field.
 *
 * The row is found by the field's own label, so a case about `label` cannot
 * accidentally read the trigger's row.
 *
 * @param target - Where the component was mounted.
 * @param field - Which field.
 * @returns The text of that row.
 */
function rowFor(target: HTMLElement, field: EditableField): string {
  const label = DICTIONARIES.en[detailFieldKey(fieldLabelName(field))];
  for (const row of target.querySelectorAll('.transfer li')) {
    if (row.querySelector('.marker')?.textContent?.trim() === label) {
      return row.textContent ?? '';
    }
  } // End of the loop over the transfer table's rows
  throw new Error(`this panel draws no transfer row for ${field}`);
} // End of function rowFor()

/**
 * The destination control naming one relative path, or `null`.
 *
 * @param target - Where the component was mounted.
 * @param path - The file's path relative to the configuration root.
 * @returns The button, or `null` when this panel does not offer it.
 */
function destination(target: HTMLElement, path: string): HTMLButtonElement | null {
  const found = [...target.querySelectorAll('.destinations button')].find(
    (candidate) => candidate.textContent?.trim() === path
  );
  return found instanceof HTMLButtonElement ? found : null;
} // End of function destination()

/**
 * Opens the recovery form the way a person does.
 *
 * @param panel - The mounted panel.
 */
function openForm(panel: Mounted): void {
  control(panel.target, recoveryChoiceKey('createFromSupportedFields')).click();
  flushSync();
} // End of function openForm()

/**
 * Waits for the panel's asynchronous handler to finish.
 *
 * A macrotask rather than a fixed number of microtask ticks: counting ticks is a
 * way to write a test that passes until somebody adds an `await`.
 */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync();
} // End of function settle()

beforeEach(() => {
  locale.setOverride('en');
});

afterEach(() => {
  locale.setOverride(null);
});

describe('the offer', () => {
  it('names the product once, and never as a duplicate or a copy', () => {
    const panel = mountPanel();
    const label = DICTIONARIES.en[recoveryChoiceKey('createFromSupportedFields')];
    expect(control(panel.target, recoveryChoiceKey('createFromSupportedFields'))).not.toBeNull();
    // The consult's prohibition, checked against the label this control really
    // draws rather than against the key it came from.
    expect(label.toLowerCase()).not.toContain('duplicate');
    expect(label.toLowerCase()).not.toContain('copy');
    expect(label.toLowerCase()).not.toContain('keep my draft');
    panel.stop();
  });

  it('says nothing at all until a reapply has resolved nothing', () => {
    // `recoveryIsAnswerable`'s two silent refusals: recovery has not been *reached*,
    // which is a different fact from *it cannot help here*, and drawing it would
    // explain an unoffered control on a screen that is not about it.
    const panel = mountPanel({ attempt: null });
    expect(panel.target.textContent?.trim()).toBe('');
    expect(says(panel.target, recoveryUnavailableKey('notFromManualResolution'))).toBe(false);
    panel.stop();
  });

  it('says why it can offer nothing when no file may be written into', () => {
    // The consult's Q2, and the exit criterion it states: an environmental lack of
    // a destination is explained, nothing is written, and a missing snippet list is
    // not permission to create one.
    const panel = mountPanel({
      disk: diskFile({ topLevelKeys: [] }),
      documents: [summaryOf(profile()), summaryOf(heldFile())],
      views: [profile(), heldFile()]
    });
    expect(says(panel.target, recoveryUnavailableKey('noEligibleDestination'))).toBe(true);
    expect(button(panel.target, recoveryChoiceKey('createFromSupportedFields'))).toBeNull();
    panel.stop();
  });
}); // End of the "offer" suite

describe('the transfer table', () => {
  it('tells a key written empty apart from a key not written at all', () => {
    // **Step 1's `None`-is-not-`Some("")` contract, on a screen.** `label` is in the
    // file and the draft cleared it, so the new snippet is born holding `label:`
    // with nothing after it; `word` was never in the file, so no key is written.
    const panel = mountPanel({ edits: { label: { text: '', removed: false } } });
    openForm(panel);
    expect(rowFor(panel.target, 'label')).toContain(
      DICTIONARIES.en[transferStatusKey('carriedEmptyValue')]
    );
    expect(rowFor(panel.target, 'word')).toContain(
      DICTIONARIES.en[transferStatusKey('omitted')]
    );
    expect(rowFor(panel.target, 'word')).toContain(
      DICTIONARIES.en[transferRefusalKey({ kind: 'notInTheFile' })]
    );
    panel.stop();
  });

  it('says which value was carried, and shows it', () => {
    const panel = mountPanel();
    openForm(panel);
    const row = rowFor(panel.target, 'label');
    expect(row).toContain(DICTIONARIES.en[transferStatusKey('carried')]);
    // **And not the empty-value phrase**, which begins with the same words: a
    // `toContain` of the shorter phrase alone would pass for either, which is
    // exactly the distinction this table exists to draw.
    expect(row).not.toContain(DICTIONARIES.en[transferStatusKey('carriedEmptyValue')]);
    expect(row).toContain('A name');
    panel.stop();
  });

  it('says a removed key is not carried, and gives the draft as the reason', () => {
    const panel = mountPanel({ edits: { label: { text: 'A name', removed: true } } });
    openForm(panel);
    expect(rowFor(panel.target, 'label')).toContain(
      DICTIONARIES.en[transferStatusKey('omitted')]
    );
    expect(rowFor(panel.target, 'label')).toContain(
      DICTIONARIES.en[transferRefusalKey({ kind: 'removedByTheDraft' })]
    );
    panel.stop();
  });

  it('asks for a mandatory value it could not carry, and opens its box blank', () => {
    // The consult's Q1: a trigger that is not one literal has no literal to carry,
    // so the box is empty, the reason is on the table beside it, and nothing here
    // invents content. The refusal is composed of two sentences: this table's own,
    // and the match editor's for the eligibility that produced it.
    const panel = mountPanel({
      match: snippet({ triggerKind: 'Multiple', triggers: [':a', ':b'] })
    });
    openForm(panel);
    const row = rowFor(panel.target, 'trigger');
    expect(row).toContain(DICTIONARIES.en[transferStatusKey('needsAValue')]);
    expect(row).toContain(
      DICTIONARIES.en[transferRefusalKey({ kind: 'fieldNotEditable', reason: 'triggerNotSingle' })]
    );
    expect(row).toContain(DICTIONARIES.en[fieldRefusalKey('triggerNotSingle')]);
    expect(box(panel.target, 'trigger').value).toBe('');
    expect(says(panel.target, recoveryRefusalKey('triggerEmpty'))).toBe(true);
    expect(control(panel.target, 'browser.recovery.create').disabled).toBe(true);
    panel.stop();
  });
}); // End of the "transfer table" suite

describe('where the new snippet goes', () => {
  it('offers only files it may write into, and never invents a snippet list', () => {
    // The opposite of the creator's list, and deliberately so: recovery is an
    // escape from a dead end rather than a file browser, so a file this app will
    // not write into is not representable in the list at all.
    const panel = mountPanel({
      documents: [
        summaryOf(profile()),
        summaryOf(heldFile()),
        summaryOf(otherFile()),
        summaryOf(packageFile()),
        UNREADABLE
      ],
      views: [profile(), heldFile(), otherFile(), packageFile()]
    });
    openForm(panel);
    const listed = [...panel.target.querySelectorAll('.destinations button')].map((one) =>
      one.textContent?.trim()
    );
    expect(listed).toEqual(['match/base.yml', 'match/other.yml']);
    expect(destination(panel.target, 'config/default.yml')).toBeNull();
    expect(destination(panel.target, 'match/packages/x/package.yml')).toBeNull();
    expect(destination(panel.target, 'match/unreadable.yml')).toBeNull();
    panel.stop();
  });

  it('drops the conflict’s own file when the disk parse says it may not be written', async () => {
    // The consult's Q2 read exactly: the window still holds the parse the conflict
    // refused, and asking *that* whether the file still has a snippet list would be
    // answering from bytes this app already knows are gone.
    const panel = mountPanel({
      disk: diskFile({ topLevelKeys: [] }),
      answers: [{ result: COMMITTED }]
    });
    openForm(panel);
    expect(destination(panel.target, 'match/base.yml')).toBeNull();
    expect(destination(panel.target, 'match/other.yml')).not.toBeNull();
    // Nothing is preferred, so the form says so rather than choosing for the person.
    expect(says(panel.target, recoveryRefusalKey('noDestination'))).toBe(true);
    destination(panel.target, 'match/other.yml')?.click();
    flushSync();
    control(panel.target, 'browser.recovery.create').click();
    await settle();
    expect(panel.calls).toHaveLength(1);
    expect(panel.calls[0]!.document).toBe(3);
    // The chosen file's own revision, never the conflict's.
    expect(panel.calls[0]!.baseRevision).toBe(OTHER);
    panel.stop();
  });

  it('draws no placement control, and sends the fixed end', async () => {
    // There is no `After`, no numeric position and no chooser: `RECOVERY_POSITION`
    // is the only value anywhere, and the absence is a sentence rather than a gap.
    const panel = mountPanel({ answers: [{ result: COMMITTED }] });
    openForm(panel);
    expect(panel.target.querySelector('select')).toBeNull();
    expect(says(panel.target, 'browser.recovery.position')).toBe(true);
    control(panel.target, 'browser.recovery.create').click();
    await settle();
    expect(panel.calls[0]!.position).toEqual({ End: {} });
    panel.stop();
  });
}); // End of the "where it goes" suite

describe('the create', () => {
  it('sends the transferred fields and reaches a commit', async () => {
    const panel = mountPanel({ answers: [{ result: COMMITTED }] });
    openForm(panel);
    expect(box(panel.target, 'trigger').value).toBe(':sig');
    expect(box(panel.target, 'replace').value).toBe('Regards');
    type(panel.target, 'trigger', ':sig2');
    control(panel.target, 'browser.recovery.create').click();
    await settle();
    expect(panel.calls).toHaveLength(1);
    // The two mandatory fields come from the boxes and the optional ones from the
    // transfer; a key nobody authored is **absent** rather than empty.
    expect(panel.calls[0]!.newMatch).toEqual({
      trigger: ':sig2',
      replace: 'Regards',
      label: 'A name'
    });
    expect(panel.calls[0]!.baseRevision).toBe(DISK);
    expect(says(panel.target, 'browser.recovery.committed')).toBe(true);
    // A committed create is what answers the conflict this panel was opened from.
    expect(says(panel.target, sourceConflictStateKey('spent'))).toBe(true);
    expect(control(panel.target, 'browser.recovery.create').disabled).toBe(true);
    expect(says(panel.target, recoveryRefusalKey('alreadyCreated'))).toBe(true);
    panel.stop();
  });

  it('presents the repeated trigger as risk, and accepting it is content-addressed', async () => {
    // **The finding 2c-4c-1 added, on a screen.** It claims risk and nothing about
    // what espanso will do, and the acceptance is bound to the exact candidate: the
    // second call carries the whole finding back, and a keystroke afterwards
    // withdraws the offer rather than spending the old consent on new text.
    const panel = mountPanel({ answers: [{ result: REFUSED }, { result: REFUSED }] });
    openForm(panel);
    control(panel.target, 'browser.recovery.create').click();
    await settle();
    expect(says(panel.target, 'code.findingCode.newMatchRepeatsLiteralTrigger')).toBe(true);
    expect(panel.calls[0]!.acknowledgement).toEqual({ accepted: [] });

    control(
      panel.target,
      rawSaveChoiceKey('saveAnyway', RECOVERY_CONFLICT_CAPABILITIES.draftKind)
    ).click();
    await settle();
    expect(panel.calls).toHaveLength(2);
    expect(panel.calls[1]!.acknowledgement).toEqual({ accepted: [REPEATS_TRIGGER] });

    // A changed candidate invalidates it: the offer to save past those findings is
    // withdrawn, and the sentence says why.
    type(panel.target, 'trigger', ':different');
    expect(says(panel.target, 'browser.recovery.findingsAreStale')).toBe(true);
    expect(
      button(panel.target, rawSaveChoiceKey('saveAnyway', RECOVERY_CONFLICT_CAPABILITIES.draftKind))
    ).toBeNull();
    panel.stop();
  });
}); // End of the "create" suite

describe('a create this panel has sent and not yet been answered', () => {
  it('goes inert on the press itself, with no answer and no await in between', () => {
    // **The 2c-4c-3a review's first High, on a screen.** The handler installs the
    // waiting form synchronously, so everything below is asserted with no `await`
    // anywhere between the click and the assertion — the state the panel was in for
    // the whole flight when it did not.
    const panel = mountPanel({ answers: [{ defer: true }] });
    openForm(panel);
    type(panel.target, 'trigger', ':typed');
    control(panel.target, 'browser.recovery.create').click();
    flushSync();

    expect(panel.calls).toHaveLength(1);
    expect(panel.pending).toHaveLength(1);
    expect(says(panel.target, 'browser.recovery.saving')).toBe(true);
    expect(says(panel.target, 'browser.recovery.savingCannotBeStopped')).toBe(true);
    expect(says(panel.target, recoveryRefusalKey('saveInFlight'))).toBe(true);
    // Every control the view gates on `saving`, one by one: the create refuses, the
    // way out is withheld, both boxes stop taking keystrokes and no destination can
    // move under a request that already named one.
    expect(control(panel.target, 'browser.recovery.create').disabled).toBe(true);
    expect(control(panel.target, 'browser.recovery.close').disabled).toBe(true);
    expect(box(panel.target, 'trigger').readOnly).toBe(true);
    expect(box(panel.target, 'replace').readOnly).toBe(true);
    expect(destination(panel.target, 'match/other.yml')?.disabled).toBe(true);

    // *Stop creating this snippet* cannot abandon a form with a write in flight:
    // the form is still here, still holding what was typed, and the offer that
    // replaces an abandoned form is nowhere.
    control(panel.target, 'browser.recovery.close').click();
    flushSync();
    expect(box(panel.target, 'trigger').value).toBe(':typed');
    expect(says(panel.target, 'browser.recovery.discardWarning')).toBe(false);
    expect(button(panel.target, recoveryChoiceKey('createFromSupportedFields'))).toBeNull();
    panel.stop();
  }); // End of the "inert from the press" case

  it('refuses a second create from the one control that stays live, and lets the commit stand', async () => {
    // The refusal panel's own controls carry no `disabled`, on this surface and on
    // the five others, so *Save anyway* is a live way to ask for a second write
    // while the first is in flight. What refuses it is the model — `saveInFlight`
    // — and not a renderer's attribute, which is why the claim is made here rather
    // than by reading a button's state.
    const panel = mountPanel({ answers: [{ result: REFUSED }, { defer: true }] });
    openForm(panel);
    control(panel.target, 'browser.recovery.create').click();
    await settle();
    expect(says(panel.target, 'code.findingCode.newMatchRepeatsLiteralTrigger')).toBe(true);

    const saveAnyway = rawSaveChoiceKey('saveAnyway', RECOVERY_CONFLICT_CAPABILITIES.draftKind);
    control(panel.target, saveAnyway).click();
    flushSync();
    expect(panel.calls).toHaveLength(2);
    expect(says(panel.target, recoveryRefusalKey('saveInFlight'))).toBe(true);

    control(panel.target, saveAnyway).click();
    await settle();
    expect(panel.calls).toHaveLength(2);
    expect(says(panel.target, recoveryRefusalKey('saveInFlight'))).toBe(true);

    // **A committed write is never afterwards reported as an error**, and here that
    // is structural: there is no second request whose answer could arrive after
    // this one and replace it.
    panel.pending[0]!({ kind: 'answered', result: COMMITTED, adoption: ADOPTED });
    await settle();
    expect(panel.calls).toHaveLength(2);
    expect(says(panel.target, 'browser.recovery.committed')).toBe(true);
    expect(says(panel.target, sourceConflictStateKey('spent'))).toBe(true);
    expect(says(panel.target, recoveryRefusalKey('alreadyCreated'))).toBe(true);
    panel.stop();
  }); // End of the "no second create, and the commit stands" case
}); // End of the "in flight" suite

describe('the conflict this panel was opened from', () => {
  it('survives a refusal, an acknowledgement refused again, and a dismissal', async () => {
    const panel = mountPanel({ answers: [{ result: REFUSED }, { result: REFUSED }] });
    openForm(panel);
    expect(says(panel.target, sourceConflictStateKey('retained'))).toBe(true);

    control(panel.target, 'browser.recovery.create').click();
    await settle();
    expect(says(panel.target, sourceConflictStateKey('retained'))).toBe(true);

    control(
      panel.target,
      rawSaveChoiceKey('saveAnyway', RECOVERY_CONFLICT_CAPABILITIES.draftKind)
    ).click();
    await settle();
    expect(says(panel.target, sourceConflictStateKey('retained'))).toBe(true);

    control(
      panel.target,
      rawSaveChoiceKey('keepEditing', RECOVERY_CONFLICT_CAPABILITIES.draftKind)
    ).click();
    flushSync();
    expect(says(panel.target, sourceConflictStateKey('retained'))).toBe(true);
    expect(says(panel.target, sourceConflictStateKey('spent'))).toBe(false);
    expect(panel.adoptions).toEqual([]);
    panel.stop();
  });

  it('says the window may have moved after a send that may have written', async () => {
    // **The act, never the outcome.** `mayHaveWritten` is the branch on which the
    // wrapper re-reads the file, so the panel stops calling the window exactly where
    // the conflict left it — and says only that, because nothing here learns what
    // the re-read installed.
    const panel = mountPanel({
      answers: [{ failure: UNCERTAIN, mayHaveWritten: true }]
    });
    openForm(panel);
    control(panel.target, 'browser.recovery.create').click();
    await settle();
    expect(says(panel.target, 'browser.recovery.mayHaveWritten')).toBe(true);
    expect(says(panel.target, sourceConflictStateKey('windowMoved'))).toBe(true);
    expect(says(panel.target, sourceConflictStateKey('spent'))).toBe(false);
    panel.stop();
  });

  it('survives abandonment, which spends nothing and sends nothing', () => {
    const panel = mountPanel();
    openForm(panel);
    type(panel.target, 'trigger', ':typed');
    control(panel.target, 'browser.recovery.close').click();
    flushSync();
    // A dirty form asks before it goes.
    expect(says(panel.target, 'browser.recovery.discardWarning')).toBe(true);
    control(panel.target, 'browser.recovery.discard').click();
    flushSync();
    expect(panel.calls).toEqual([]);
    expect(panel.adoptions).toEqual([]);
    // Back to the offer, with the conflict above it untouched.
    expect(control(panel.target, recoveryChoiceKey('createFromSupportedFields'))).not.toBeNull();
    panel.stop();
  });

  it('spends its own conflict’s authorization for a reload, and never the source’s', async () => {
    const panel = mountPanel({ answers: [{ result: conflictedCreate() }] });
    openForm(panel);
    control(panel.target, 'browser.recovery.create').click();
    await settle();
    // The conflict arm: its three revision lines with their operands substituted,
    // and the whole file as the command layer read it.
    expect(panel.target.textContent).toContain(
      DICTIONARIES.en['browser.recovery.revisionExpected'].replace('{revision}', DISK)
    );
    expect(panel.target.textContent).toContain('# the file as it is now');

    control(
      panel.target,
      conflictChoiceKey('reloadDiskVersion', RECOVERY_CONFLICT_CAPABILITIES.draftKind)
    ).click();
    flushSync();
    expect(says(panel.target, 'browser.recovery.reloadEndsRecovery')).toBe(true);
    expect(panel.adoptions).toEqual([]);

    control(
      panel.target,
      conflictChoiceKey('confirmReload', RECOVERY_CONFLICT_CAPABILITIES.draftKind)
    ).click();
    flushSync();
    expect(panel.adoptions).toHaveLength(1);
    // **Its own conflict and never the one it was opened from.** The two are
    // different wire values, and handing over the second would spend an
    // authorization this panel was told to leave alone.
    expect(panel.adoptions[0]!.source).not.toBe(panel.source.source);
    expect(says(panel.target, 'browser.recovery.closed')).toBe(true);
    expect(says(panel.target, recoveryRefusalKey('formClosed'))).toBe(true);
    panel.stop();
  });

  it('rebases its own form onto the newly parsed file when the reapply is pressed', async () => {
    const panel = mountPanel({
      answers: [{ result: conflictedCreate() }, { result: COMMITTED }]
    });
    openForm(panel);
    control(panel.target, 'browser.recovery.create').click();
    await settle();
    control(
      panel.target,
      conflictChoiceKey('keepMyDraft', RECOVERY_CONFLICT_CAPABILITIES.draftKind)
    ).click();
    flushSync();
    expect(panel.adoptions).toHaveLength(1);
    expect(says(panel.target, 'browser.reapply.reapplied')).toBe(true);
    // The typed values are kept and the base moved, so the next send meets the
    // newly parsed revision rather than the one already refused.
    expect(box(panel.target, 'trigger').value).toBe(':sig');
    control(panel.target, 'browser.recovery.create').click();
    await settle();
    expect(panel.calls[1]!.baseRevision).toBe(AFTER);
    panel.stop();
  });
}); // End of the "source conflict" suite
