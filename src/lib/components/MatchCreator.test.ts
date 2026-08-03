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

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeDocument, makeMatch, makeSummary } from '../browser/fixtures';
import type { InvalidationStatus } from '../browser/invalidation';
import { destinationRefusalKey, type DestinationRefusal } from '../browser/matchCreation';
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
  ]
): Mounted {
  const remaining = [...answers];
  const calls: RecordedCreate[] = [];
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
      close: (): void => {
        closes += 1;
      }
    }
  });
  return {
    target,
    calls,
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
}); // End of the "mounted new-snippet form" suite
