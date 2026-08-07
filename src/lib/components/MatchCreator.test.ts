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

import {
  conflictChoiceKey,
  type ConflictModel,
  type DiskAdoptionOutcome
} from '../browser/saveOutcome';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeDocument, makeMatch, makeSummary } from '../browser/fixtures';
import type { InvalidationStatus } from '../browser/invalidation';
import {
  destinationRefusalKey,
  type CreationBuffers,
  type DestinationRefusal
} from '../browser/matchCreation';
import type { MatchSaveAnswer } from '../browser/workspace.svelte';
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
}

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
  /** How many times the form asked to be closed. */
  readonly closed: () => number;
  /** Replaces what the projections reader answers, as a re-read would. */
  readonly reproject: (views: readonly DocumentView[]) => void;
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
      close: (): void => {
        closes += 1;
      }
    }
  });
  return {
    target,
    calls,
    adoptions,
    closed: () => closes,
    reproject: (next: readonly DocumentView[]) => {
      views = next;
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
 * Waits for the component's asynchronous handler to finish.
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

  it('closes on `alreadyThere`, and closes nothing on `refused`', async () => {
    // **`alreadyThere` is a success**: the window already holds the bytes that
    // were asked for. `refused` is the only answer that means it did not move.
    for (const [answer, closes] of [
      ['alreadyThere', 1],
      ['installed', 1],
      ['refused', 0]
    ] as const) {
      const form = mountCreator([{ result: CONFLICTED }], null, undefined, answer);
      fillIn(form);
      control(form.target, 'browser.matchCreation.create').click();
      await settle();
      control(form.target, conflictChoiceKey('reloadDiskVersion', 'authoredText')).click();
      flushSync();
      control(form.target, conflictChoiceKey('confirmReload', 'authoredText')).click();
      flushSync();

      expect(form.adoptions, answer).toHaveLength(1);
      expect(form.closed(), answer).toBe(closes);
      // A refused adoption leaves the conflict on screen rather than reporting a
      // reload that did not happen.
      expect(says(form.target, 'browser.saveOutcome.nothingWasWritten'), answer).toBe(
        closes === 0
      );
      form.stop();
    } // End of the loop over the three adoption answers
  }); // End of the "three adoption answers" case

  it('stops offering the reload once the window has refused it, and says why', async () => {
    // **The 2c-4a-3a review's finding 3, from the screen.** The control that could
    // only be refused again is gone, and the sentence takes its place; *Keep
    // editing* and the copy stay.
    const form = mountCreator([{ result: CONFLICTED }], null, undefined, 'refused');
    fillIn(form);
    control(form.target, 'browser.matchCreation.create').click();
    await settle();
    control(form.target, conflictChoiceKey('reloadDiskVersion', 'authoredText')).click();
    flushSync();
    control(form.target, conflictChoiceKey('confirmReload', 'authoredText')).click();
    flushSync();

    expect(says(form.target, 'browser.saveOutcome.reloadUnavailable')).toBe(true);
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
}); // End of the "mounted new-snippet form" suite
