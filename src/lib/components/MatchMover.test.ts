/** @vitest-environment jsdom */

/**
 * The destination panel, mounted and driven through real DOM events.
 *
 * The sixth file in this repository to opt into jsdom, and it opts in the same
 * way the first five do: by the docblock above and by nothing else. The suite's
 * default environment is still `node`, and the six components that predate
 * `RawEditor.svelte` are deliberately not back-filled
 * (`docs/decisions/2c-split-notes.md` section 7).
 *
 * **What this file is for, given that `matchMove.test.ts` already exists.** That
 * suite drives the value over plain fixtures; it cannot see any of the four
 * claims this sub-phase's screen makes and only a screen can break:
 *
 * 1. **the frozen `notMovable` reason is never drawn beside a live `outOfDate`**
 *    — the one rule `matchMove.ts` states and cannot enforce, because the only
 *    place it can be broken is a `.svelte` file;
 * 2. **the identity handed to `beginMove` is read from the live projections**,
 *    so a panel retained across a re-read of the file sends nothing;
 * 3. **`unsavedDraftFor` has a producer at all**, which every model test supplied
 *    as a literal;
 * 4. **a `MatchId` reaching `draft.ts` is a plain object.** `structuredClone`
 *    throws on a `$state` proxy and `BrowserState.views` is deeply proxied, so
 *    the last suite chooses a destination over a **real** `BrowserState` — a
 *    model test cannot catch a repeat of that, because model tests pass plain
 *    fixtures. It is the same reason `MatchDeleter.test.ts` mounts over a real
 *    state rather than a stub.
 *
 * The last suite is also the only place `BrowserState.rereadDocument` — the
 * producer step 2 added behind `MoveRecovery.reloadFile`, the consult's Q8 — is
 * driven end to end: a hand-rolled stub is not reactive, and the whole question
 * is what the panel says *after* the state has replaced its own projection.
 *
 * **This does not replace the window reading.** What it proves is that a handler
 * fires and that the right value reaches the boundary. jsdom has no layout, so
 * the bound on the destination list — the 2c-3a-2 finding this panel is the same
 * shape as — is not measured here and is owed a reading.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import type { DiskAdoptionOutcome } from '../browser/saveOutcome';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeDocument, makeMatch, makeSummary, matchListPath } from '../browser/fixtures';
import type { InvalidationStatus } from '../browser/invalidation';
import {
  createBrowserState,
  type BrowserCommands,
  type BrowserState,
  type MatchSaveAnswer
} from '../browser/workspace.svelte';
import { DICTIONARIES, translate, type TranslationKey } from '../i18n/dictionaries';
import type { CommandResult } from '../ipc/commands';
import type { IpcFailure } from '../ipc/errors';
import { locale } from '../stores/locale.svelte';
import type {
  Acknowledgement,
  ContentRevision,
  DocumentId,
  DocumentSummary,
  DocumentView,
  Finding,
  MatchId,
  MatchView,
  SaveResult,
  WorkspaceSummary
} from '../ipc/types';
import MatchMover from './MatchMover.svelte';

/** The revision every projection below is minted from. */
const BASE: ContentRevision = 'a'.repeat(64);

/** The revision the file holds after it has been read again. */
const AFTER: ContentRevision = 'b'.repeat(64);

/** The file the snippets live in. */
const FILE: DocumentSummary = makeSummary({ id: 2, relativePath: 'match/base.yml' });

/** The adoption a save that wrote nothing owes: none. */
const NOT_OWED: InvalidationStatus = { kind: 'notOwed' };

/** The adoption a committed save performed. */
const ADOPTED: InvalidationStatus = { kind: 'done' };

/**
 * The adoption a committed move could **not** perform.
 *
 * The file was written and this window could not read it back, which is
 * `PROGRESS.md` D2's shape: the failure travels *beside* the committed outcome and
 * never in place of it.
 */
const NOT_ADOPTED: InvalidationStatus = {
  kind: 'failed',
  failure: { kind: 'command', error: { code: 'unknownDocument', document: 2 } }
};

/**
 * One snippet of the file's own `matches:` list.
 *
 * The `path` is what makes it an *item of a sequence*, which is what a move is
 * about: a fixture without one is `noSequencePosition` and offers no
 * destinations at all.
 *
 * @param node - The arena node, which is also the identity's node.
 * @param index - Its position in the list, which is what its path ends in.
 * @param trigger - Its trigger, so the rows are distinguishable on screen.
 * @param revision - The parse it belongs to.
 * @returns The projection.
 */
function item(
  node: number,
  index: number,
  trigger: string,
  revision: ContentRevision = BASE
): MatchView {
  return makeMatch({ node, document: 2, revision, trigger, path: matchListPath(index) });
} // End of function item()

/**
 * A snippet file with three snippets in one list.
 *
 * **Three rather than two**, for `matchMove.test.ts`'s reason: a two-item
 * sequence cannot tell a middle position from an end one, and the `end` lowering
 * is exactly a claim about the last item.
 *
 * @param overrides - Whatever a case needs beyond the three snippets.
 * @returns The projection.
 */
function file(overrides: Parameters<typeof makeDocument>[0] = {}): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision: BASE,
    matches: [item(10, 0, ':sig'), item(11, 1, ':date'), item(12, 2, ':sql')],
    ...overrides
  });
} // End of function file()

/**
 * The same file as this window holds it after reading it again.
 *
 * **The arena nodes are kept and only the revision moves.** A fixture that
 * renumbered them would let a case pass by finding nothing, which is a weaker
 * claim than the one these cases make: an identity from an earlier parse is
 * refused even when the node it names is still occupied.
 *
 * @returns The projection the re-read installs.
 */
function reread(): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision: AFTER,
    matches: [
      item(10, 0, ':sig', AFTER),
      item(11, 1, ':date', AFTER),
      item(12, 2, ':sql', AFTER)
    ]
  });
} // End of function reread()

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

/** A move that ran to the end and wrote the file. */
const COMMITTED: SaveResult = {
  outcome: 'saved',
  revision: AFTER,
  committed: true,
  notes: [],
  backup_taken: false,
  moved: { document: 2, revision: AFTER, node: 10 }
};

/**
 * The same committed move, with no identity to point at afterwards.
 *
 * **`moved: null` is legal on a committed move**: the command answers no identity
 * when the file changed again between the write and the read that followed it.
 * What that intervening change did to the snippet is not something this
 * application can establish, which is what the sentence beside it has to say.
 */
const COMMITTED_UNLOCATED: SaveResult = { ...COMMITTED, moved: null };

/**
 * A save that failed at or after the rename, so the file may already hold it.
 *
 * **`saveFailed` and nothing else**: `mayHaveWritten` in `../ipc/errors` answers
 * `true` for that one code, and a directory sync interrupted after the rename is
 * what the save transaction reports it for. The same failure `matchMove.test.ts`
 * drives the model with, so the screen case is about what production produces.
 */
const AFTER_THE_RENAME: IpcFailure = {
  kind: 'command',
  error: {
    code: 'saveFailed',
    error: {
      Write: {
        Io: { step: 'SyncDirectory', path: 'match/base.yml', kind: 'Interrupted', raw_os_error: 4 }
      }
    },
    may_have_written: true
  }
};

/** A rejection that says this window and the file disagree about an address. */
const STALE_IDENTITY: IpcFailure = {
  kind: 'command',
  error: { code: 'identityStaleRevision', expected: AFTER, found: BASE }
};

/** One call the panel made to the boundary. */
interface RecordedMove {
  /** Which snippet it aimed at. */
  readonly id: MatchId;
  /** The snippet it said the moved one should follow, or `null` for the top. */
  readonly after: MatchId | null;
  /** The revision it said the session was opened at. */
  readonly baseRevision: ContentRevision;
  /** The suspicions it said had already been shown to a person. */
  readonly acknowledgement: Acknowledgement;
}

/**
 * One scripted answer to one move.
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
  /** Whether the file may already hold the moved snippet. */
  readonly mayHaveWritten?: boolean;
  /** Why the command rejected, for the `failed` arm. */
  readonly failure?: IpcFailure;
}

/** A mounted panel and everything a case needs to drive it. */
interface Mounted {
  /** The element the component was mounted into. */
  readonly target: HTMLElement;
  /** Every call the panel made, in order. */
  readonly calls: RecordedMove[];
  /** How many times the panel asked to be closed. */
  readonly closed: () => number;
  /** How many times the panel asked for the file to be read again. */
  readonly reloads: () => number;
  /** Tears the component down. */
  readonly stop: () => void;
}

/** Everything {@link mountMover} takes beyond the answers it scripts. */
interface Opened {
  /** The file's projection to open over. */
  readonly projection?: DocumentView;
  /** Which of its snippets the move is about. */
  readonly at?: number;
  /** What the projections reader answers. Defaults to the opened projection. */
  readonly views?: readonly DocumentView[];
  /** What the unsaved-draft reader answers. */
  readonly draft?: MatchId | null;
  /** What a re-read answers. */
  readonly reload?: IpcFailure | null;
}

/**
 * Mounts the panel over a scripted boundary.
 *
 * @param answers - What each successive move answers, in order.
 * @param opened - What the panel is opened over.
 * @returns The mounted panel.
 */
function mountMover(answers: readonly ScriptedAnswer[] = [], opened: Opened = {}): Mounted {
  const projection = opened.projection ?? file();
  const remaining = [...answers];
  const calls: RecordedMove[] = [];
  let closes = 0;
  let reloads = 0;
  const target = document.createElement('div');
  document.body.append(target);
  const component = mount(MatchMover, {
    target,
    props: {
      projection,
      match: projection.matches[opened.at ?? 0]!,
      file: FILE,
      projections: (): readonly DocumentView[] => opened.views ?? [projection],
      unsavedDraftFor: (): MatchId | null => opened.draft ?? null,
      move: (
        id: MatchId,
        after: MatchId | null,
        baseRevision: ContentRevision,
        acknowledgement: Acknowledgement
      ): Promise<MatchSaveAnswer> => {
        calls.push({ id, after, baseRevision, acknowledgement });
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
      reload: (): Promise<IpcFailure | null> => {
        reloads += 1;
        return Promise.resolve(opened.reload ?? null);
      },
      // **The window's own adoption**, which no case here reaches: the five match
      // surfaces declare `offersReload: false`, so no control that could spend a
      // confirmation is drawn. `matchMove.test.ts` drives the transition directly.
      adoptDiskVersion: (): DiskAdoptionOutcome => 'installed',
      close: (): void => {
        closes += 1;
      }
    }
  });
  return {
    target,
    calls,
    closed: () => closes,
    reloads: () => reloads,
    stop: () => {
      void unmount(component);
      target.remove();
    }
  };
} // End of function mountMover()

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
 * Every destination the panel is offering, in the order it draws them.
 *
 * @param target - Where the component was mounted.
 * @returns The controls.
 */
function destinations(target: HTMLElement): readonly HTMLButtonElement[] {
  return [...target.querySelectorAll('.destinations button')].filter(
    (one): one is HTMLButtonElement => one instanceof HTMLButtonElement
  );
} // End of function destinations()

/**
 * The destination whose label is one rendering, insisted upon.
 *
 * @param target - Where the component was mounted.
 * @param label - The rendered label to look for.
 * @returns The control.
 */
function destination(target: HTMLElement, label: string): HTMLButtonElement {
  const found = destinations(target).find((one) => one.textContent?.trim() === label);
  if (found === undefined) {
    throw new Error(`this panel offers no destination labelled ${label}`);
  }
  return found;
} // End of function destination()

/**
 * The English rendering of the *after* option naming one trigger.
 *
 * @param trigger - The anchor's trigger.
 * @returns What the control's label reads.
 */
function afterLabel(trigger: string): string {
  return translate('en', 'browser.matchMove.position.after', { trigger });
} // End of function afterLabel()

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
 * Waits for the panel's asynchronous handler to finish.
 *
 * A macrotask rather than a fixed number of microtask ticks.
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

describe('the mounted destination panel', () => {
  it('offers the file’s own order, excludes the snippet itself, and sends nothing until asked', async () => {
    // **The consult's Q1 and Q6 on a screen.** Top, one option per other snippet
    // in the order the file writes them, then End — and the moving snippet is not
    // among its own anchors.
    const panel = mountMover([{ result: COMMITTED }]);
    expect(destinations(panel.target).map((one) => one.textContent?.trim())).toEqual([
      DICTIONARIES.en['browser.matchMove.position.top'],
      afterLabel(':date'),
      afterLabel(':sql'),
      DICTIONARIES.en['browser.matchMove.position.end']
    ]);
    // The boundary sentence names the file the destinations came from, and it is
    // drawn beside the list rather than in place of foreign rows (Q4).
    expect(panel.target.textContent).toContain(
      translate('en', 'browser.matchMove.withinThisFile', { file: 'match/base.yml' })
    );
    // `:sig` is at the top already, so the panel opens on a destination that
    // moves nothing and the control says so rather than being silently disabled.
    expect(control(panel.target, 'browser.matchMove.move').disabled).toBe(true);
    expect(says(panel.target, 'browser.matchMove.cannotMove.alreadyThere')).toBe(true);
    expect(panel.calls).toHaveLength(0);

    destination(panel.target, afterLabel(':date')).click();
    flushSync();
    expect(control(panel.target, 'browser.matchMove.move').disabled).toBe(false);
    expect(panel.calls).toHaveLength(0);

    control(panel.target, 'browser.matchMove.move').click();
    await settle();

    // **The anchor that travels is an identity the model minted**, never a row
    // index this file assembled, and the base revision is the session's own.
    expect(panel.calls).toHaveLength(1);
    expect(panel.calls[0]?.id).toEqual({ document: 2, revision: BASE, node: 10 });
    expect(panel.calls[0]?.after).toEqual({ document: 2, revision: BASE, node: 11 });
    expect(panel.calls[0]?.baseRevision).toBe(BASE);
    expect(panel.calls[0]?.acknowledgement).toEqual({ accepted: [] });
    panel.stop();
  }); // End of the "offers the file's order" case

  it('lowers End to the last other snippet, and shows the aliasing rather than hiding it', async () => {
    // **`end` is this application's lowering and not a wire arm.** For the last
    // snippet, *End* and *after the one above it* are two placements and one
    // request, so both options carry "where it is now" — which the model computes
    // on the lowered target and this panel draws on both.
    const panel = mountMover([{ result: COMMITTED }], { at: 2 });
    const rows = [...panel.target.querySelectorAll('.destinations li')];
    const marked = rows.filter((row) =>
      (row.textContent ?? '').includes(DICTIONARIES.en['browser.matchMove.position.current'])
    );
    expect(marked).toHaveLength(2);

    // And moving it to the top really does lower to `after: null`.
    destination(panel.target, DICTIONARIES.en['browser.matchMove.position.top']).click();
    flushSync();
    control(panel.target, 'browser.matchMove.move').click();
    await settle();

    expect(panel.calls).toHaveLength(1);
    expect(panel.calls[0]?.after).toBeNull();
    panel.stop();
  }); // End of the "End lowering" case

  it('refuses a snippet this window is holding unsaved edits for', () => {
    // **The producer `unsavedDraftFor` never had.** Every call in step 1 passed
    // `null` or a fixture; this is the arm reached through a prop a component
    // supplies, and the comparison is all three fields.
    const panel = mountMover([], { draft: { document: 2, revision: BASE, node: 10 } });

    expect(says(panel.target, 'browser.matchMove.refused.unsavedDraft')).toBe(true);
    expect(says(panel.target, 'browser.matchMove.cannotMove.notMovable')).toBe(true);
    expect(control(panel.target, 'browser.matchMove.move').disabled).toBe(true);
    expect(panel.calls).toHaveLength(0);
    // Leaving is still offered: this is a refusal, not a trap.
    expect(control(panel.target, 'browser.matchMove.close').disabled).toBe(false);
    panel.stop();
  }); // End of the "unsaved draft" case

  it('draws the frozen reason while the session is live', () => {
    // **The non-vacuity half of the case below.** A panel that never drew
    // `notMovable` at all would satisfy the suppression assertion trivially, so
    // the same fixture is asserted from both sides: here the session is live and
    // the reason is on screen, and there it is stale and the reason is gone.
    const locked = file({ readOnly: true });
    const panel = mountMover([], { projection: locked, views: [locked] });

    expect(says(panel.target, 'browser.matchMove.refused.readOnly')).toBe(true);
    expect(says(panel.target, 'browser.matchMove.cannotMove.notMovable')).toBe(true);
    expect(says(panel.target, 'browser.matchMove.cannotMove.outOfDate')).toBe(false);
    panel.stop();
  }); // End of the "frozen reason while live" case

  it('never draws the frozen reason beside a live outOfDate', () => {
    // **The one rule `matchMove.ts` states and cannot enforce**, and the only
    // place it can be broken is this component. `eligibility` is frozen at
    // `startMatchMove` and no transition recomputes it, so once the window has
    // read the file again *this snippet cannot be moved* is a definite claim read
    // off a parse that has been replaced; `refusalGiven` puts `outOfDate` above
    // `notMovable` for exactly that reason, and a panel drawing both would put the
    // suppressed certainty back through the other field.
    const locked = file({ readOnly: true });
    const panel = mountMover([], { projection: locked, views: [reread()] });

    expect(says(panel.target, 'browser.matchMove.cannotMove.outOfDate')).toBe(true);
    expect(says(panel.target, 'browser.matchMove.refused.readOnly')).toBe(false);
    expect(says(panel.target, 'browser.matchMove.cannotMove.notMovable')).toBe(false);
    expect(control(panel.target, 'browser.matchMove.move').disabled).toBe(true);
    panel.stop();
  }); // End of the "suppressed frozen reason" case

  it('carries the acknowledged findings into the second attempt', async () => {
    const panel = mountMover([{ result: REFUSED }, { result: COMMITTED }]);
    destination(panel.target, afterLabel(':date')).click();
    flushSync();
    control(panel.target, 'browser.matchMove.move').click();
    await settle();

    expect(says(panel.target, 'browser.saveOutcome.nothingWasWritten')).toBe(true);
    expect(panel.target.textContent).toContain(
      DICTIONARIES.en['browser.matchMove.findings']
    );

    // **One step, not two.** A deletion re-raises its confirmation because
    // `confirmDelete` consumed the pending one; a move has no confirmation to
    // re-raise, which is the consult's Q7.
    control(panel.target, 'browser.rawSave.choice.saveAnyway').click();
    await settle();

    expect(panel.calls).toHaveLength(2);
    expect(panel.calls[1]?.acknowledgement).toEqual({ accepted: [SUSPICION] });
    expect(says(panel.target, 'browser.saveOutcome.fileWritten')).toBe(true);
    panel.stop();
  }); // End of the "acknowledgement round trip" case

  it('spends itself on a commit and offers no further destination', async () => {
    const panel = mountMover([{ result: COMMITTED }]);
    destination(panel.target, afterLabel(':sql')).click();
    flushSync();
    control(panel.target, 'browser.matchMove.move').click();
    await settle();

    expect(says(panel.target, 'browser.saveOutcome.fileWritten')).toBe(true);
    expect(says(panel.target, 'browser.matchMove.moved')).toBe(true);
    // The command answered an identity, so the "cannot point at it" sentence is
    // not drawn — the pair is what makes each of them mean something.
    expect(says(panel.target, 'browser.matchMove.movedNotIdentified')).toBe(false);
    expect(destinations(panel.target).every((one) => one.disabled)).toBe(true);
    expect(button(panel.target, 'browser.notice.dismiss')).toBeNull();

    control(panel.target, 'browser.matchMove.done').click();
    flushSync();
    expect(panel.closed()).toBe(1);
    panel.stop();
  }); // End of the "commit spends the session" case

  it('says the snippet moved and the window is out of step, without contradicting itself', async () => {
    // **The second review's second finding, and the state its mounted cases had
    // missed.** `view.moved` is true whether the adoption succeeded or failed, so
    // this pair is reachable: the file really was written, and this window really
    // could not read it back. The sentence beside the commit therefore says nothing
    // about a re-read — it used to say the file had been read again, which is
    // exactly what `windowOutOfStep` beneath it denies.
    const panel = mountMover([{ result: COMMITTED, adoption: NOT_ADOPTED }]);
    destination(panel.target, afterLabel(':date')).click();
    flushSync();
    control(panel.target, 'browser.matchMove.move').click();
    await settle();

    expect(says(panel.target, 'browser.saveOutcome.fileWritten')).toBe(true);
    expect(says(panel.target, 'browser.saveOutcome.windowOutOfStep')).toBe(true);
    expect(says(panel.target, 'browser.matchMove.moved')).toBe(true);
    // A committed move is never afterwards reported as an error, so the way out is
    // still *Done* rather than a retry.
    expect(control(panel.target, 'browser.matchMove.move').disabled).toBe(true);
    expect(control(panel.target, 'browser.matchMove.done').disabled).toBe(false);
    expect(panel.calls).toHaveLength(1);
    panel.stop();
  }); // End of the "failed adoption" case

  it('keeps the uncertainty when the command answered no identity for the moved snippet', async () => {
    // **The second review's third finding.** `landed: null` means the file changed
    // again between the write and the reading that followed it, and that
    // intervening change may have removed or replaced the snippet — so the sentence
    // says the window cannot say where it is or whether it is still there, rather
    // than sending the person to look for it in a list this window is drawing from
    // a parse the file has moved past.
    const panel = mountMover([{ result: COMMITTED_UNLOCATED, adoption: ADOPTED }]);
    destination(panel.target, afterLabel(':sql')).click();
    flushSync();
    control(panel.target, 'browser.matchMove.move').click();
    await settle();

    expect(says(panel.target, 'browser.matchMove.moved')).toBe(true);
    expect(says(panel.target, 'browser.matchMove.movedNotIdentified')).toBe(true);
    expect(destinations(panel.target).every((one) => one.disabled)).toBe(true);
    panel.stop();
  }); // End of the "committed without an identity" case

  it('says nothing was written when the window refused before any command ran', async () => {
    const panel = mountMover([]);
    destination(panel.target, afterLabel(':date')).click();
    flushSync();
    control(panel.target, 'browser.matchMove.move').click();
    await settle();

    expect(says(panel.target, 'browser.matchMove.sendFailed')).toBe(true);
    expect(says(panel.target, 'browser.matchMove.mayHaveWritten')).toBe(false);
    expect(says(panel.target, 'browser.saveOutcome.fileWritten')).toBe(false);
    // Nothing was sent, so nothing is spent: the panel goes on accepting a
    // destination.
    expect(control(panel.target, 'browser.matchMove.move').disabled).toBe(false);
    panel.stop();
  }); // End of the "nothing attempted" case

  it('spends the session on a send that may already have written, and offers no re-read', async () => {
    // **The weakest claim wins.** After a `may_have_written` rejection this
    // application knows neither that the move happened nor that it did not, so
    // the panel says exactly that — and it must not say `outOfDate`, whose
    // sentence claims *nothing has been written*.
    const panel = mountMover([
      { failure: AFTER_THE_RENAME, mayHaveWritten: true }
    ]);
    destination(panel.target, afterLabel(':date')).click();
    flushSync();
    control(panel.target, 'browser.matchMove.move').click();
    await settle();

    expect(says(panel.target, 'browser.matchMove.mayHaveWritten')).toBe(true);
    expect(says(panel.target, 'browser.matchMove.cannotMove.mayHaveWritten')).toBe(true);
    expect(says(panel.target, 'browser.matchMove.cannotMove.outOfDate')).toBe(false);
    expect(says(panel.target, 'browser.matchMove.cannotMove.alreadyMoved')).toBe(false);
    // `mayHaveWritten` is `true` for one code and that code is not one a re-read
    // can help with, so no recovery is offered — which follows from the model
    // rather than being decided here.
    expect(button(panel.target, 'browser.matchMove.recovery.reloadFile')).toBeNull();
    expect(control(panel.target, 'browser.matchMove.move').disabled).toBe(true);
    panel.stop();
  }); // End of the "may have written" case

  it('says why a re-read failed, and stops offering to send after it', async () => {
    const panel = mountMover([{ failure: STALE_IDENTITY }], {
      reload: { kind: 'command', error: { code: 'unknownDocument', document: 2 } }
    });
    destination(panel.target, afterLabel(':date')).click();
    flushSync();
    control(panel.target, 'browser.matchMove.move').click();
    await settle();

    // The command said this window's address does not describe the file it read,
    // so the panel offers the one recovery — and until it is attempted the move is
    // still sendable, because nothing was written.
    expect(control(panel.target, 'browser.matchMove.move').disabled).toBe(false);

    control(panel.target, 'browser.matchMove.recovery.reloadFile').click();
    await settle();

    expect(panel.reloads()).toBe(1);
    expect(says(panel.target, 'browser.matchMove.reloadFailed')).toBe(true);
    // **The second review's fifth finding.** The recovery was offered because the
    // window and the file disagree about an address; a read that cannot reach the
    // file leaves that standing with no way to resolve it, so the session stops
    // being sendable rather than going on offering the same disputed identity.
    expect(says(panel.target, 'browser.matchMove.cannotMove.outOfDate')).toBe(true);
    expect(control(panel.target, 'browser.matchMove.move').disabled).toBe(true);
    expect(destinations(panel.target).every((one) => one.disabled)).toBe(true);

    control(panel.target, 'browser.matchMove.move').click();
    await settle();
    expect(panel.calls).toHaveLength(1);
    panel.stop();
  }); // End of the "failed re-read" case
}); // End of the "mounted destination panel" suite

/** The workspace summary the state below is opened over; nothing reads it. */
const SUMMARY: WorkspaceSummary = {
  root: '/tmp/espanso',
  documents: 1,
  match_files: 1,
  config_profiles: 0,
  packages: 0,
  disabled: 0
};

describe('a move panel over the real workspace state', () => {
  it('reads the file again through the recovery, and then sends nothing', async () => {
    // **Three claims a stub cannot make.** `BrowserState.views` is `$state` and
    // therefore deeply proxied, so choosing a destination here is what proves the
    // identities reaching `draft.ts` are plain objects — `structuredClone` throws
    // on a proxy, and a model test cannot catch a repeat of that. The recovery
    // really re-reads through `BrowserState.rereadDocument`, the producer step 2
    // added behind the consult's Q8 code. And the panel's refusal afterwards is
    // the live-identity check working over a projection the state replaced on its
    // own, rather than over an array a test swapped.
    const reads: DocumentView[] = [file()];
    const refusal: CommandResult<never> = {
      ok: false,
      failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
    };
    const commands: BrowserCommands = {
      openWorkspace: vi.fn(async (): Promise<CommandResult<WorkspaceSummary>> => {
        return { ok: true, value: SUMMARY };
      }),
      listDocuments: vi.fn(async (): Promise<CommandResult<readonly DocumentSummary[]>> => {
        return { ok: true, value: [FILE] };
      }),
      getDocument: vi.fn(async (): Promise<CommandResult<DocumentView>> => {
        return { ok: true, value: reads[0]! };
      }),
      getMatch: vi.fn(async (): Promise<CommandResult<MatchView>> => refusal),
      reloadDocument: vi.fn(async (): Promise<CommandResult<DocumentView>> => {
        return { ok: true, value: reread() };
      }),
      documentText: vi.fn(async (): Promise<CommandResult<string>> => refusal),
      moveMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => {
        return { ok: false, failure: STALE_IDENTITY };
      }),
      saveMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
      createMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
      deleteMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
      duplicateMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
      saveRawDocument: vi.fn(async () => refusal)
    };
    const state: BrowserState = createBrowserState(commands, () => undefined);
    await state.open(null);

    const target = document.createElement('div');
    document.body.append(target);
    const component = mount(MatchMover, {
      target,
      props: {
        projection: state.views[0]!,
        match: state.views[0]!.matches[0]!,
        file: FILE,
        projections: (): readonly DocumentView[] => state.views,
        unsavedDraftFor: (): MatchId | null => null,
        move: (
          id: MatchId,
          after: MatchId | null,
          baseRevision: ContentRevision,
          acknowledgement: Acknowledgement
        ): Promise<MatchSaveAnswer> => state.moveMatch(id, after, baseRevision, acknowledgement),
        reload: (document: DocumentId): Promise<IpcFailure | null> =>
          state.rereadDocument(document),
        // **The window's own adoption**, which no case here reaches: the five match
        // surfaces declare `offersReload: false`, so no control that could spend a
        // confirmation is drawn. `matchMove.test.ts` drives the transition directly.
        adoptDiskVersion: (): DiskAdoptionOutcome => 'installed',
        close: (): void => undefined
      }
    });
    flushSync();

    // The `structuredClone` of a placement carrying an identity read straight out
    // of a reactive projection. This is the line that throws if a plain copy is
    // ever dropped.
    destination(target, afterLabel(':date')).click();
    flushSync();
    control(target, 'browser.matchMove.move').click();
    await settle();

    expect(commands.moveMatch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(commands.moveMatch).mock.calls[0]![2]).toBe(BASE);
    expect(says(target, 'browser.matchMove.sendFailed')).toBe(true);

    control(target, 'browser.matchMove.recovery.reloadFile').click();
    await settle();

    // The state really replaced its own projection, and the panel noticed without
    // being told: everything it holds was minted from the parse that is gone.
    expect(commands.reloadDocument).toHaveBeenCalledTimes(1);
    expect(state.views[0]?.revision).toBe(AFTER);
    expect(says(target, 'browser.matchMove.cannotMove.outOfDate')).toBe(true);
    expect(control(target, 'browser.matchMove.move').disabled).toBe(true);

    control(target, 'browser.matchMove.move').click();
    await settle();
    expect(commands.moveMatch).toHaveBeenCalledTimes(1);

    void unmount(component);
    target.remove();
  }); // End of the "recovery over the real state" case
}); // End of the "move panel over the real state" suite
