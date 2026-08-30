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
 * 1. **the panel renders the model's `notMovableToShow` and decides nothing about
 *    it** — the precedence between the frozen reason and a live `outOfDate` is
 *    `matchMoveView`'s since 2c-4a-3b, and the two cases below are its rendered
 *    halves rather than the rule itself. They are also this renderer's standing
 *    regression cover for the shape the duplicator left behind at 2c-3c-3: the
 *    condition they drive used to live in this markup, and a mounted suite is
 *    exactly what can see a rule that lives there;
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

import { rawSaveChoiceKey } from '../browser/rawSave';
import {
  recoveryChoiceKey,
  recoveryUnavailableKey,
  type RecoveryUnavailable
} from '../browser/recovery';
import { RECOVERY_WITHOUT_CREATION_ATTRIBUTE } from './RecoveryWithoutCreation.svelte';
import {
  conflictChoiceKey,
  reloadUnavailableKey,
  type ConflictModel,
  type DiskAdoptionOutcome
} from '../browser/saveOutcome';
import type { MovePlacement } from '../browser/matchMove';
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

/**
 * The whole file text the conflict's fresh read carried.
 *
 * Distinguishable from anything the panel holds, so a case can tell the disk side
 * of the panel from the operation summary by looking at the rendered text.
 */
const DISK_TEXT = 'matches:\n  - trigger: x\n    replace: theirs\n';

/** A word that appears in {@link DISK_TEXT} and nowhere else on the screen. */
const DISK_TEXT_MARKER = 'theirs';

/** A move the file had moved on under. */
const CONFLICTED: SaveResult = {
  outcome: 'conflict',
  reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
  expected: BASE,
  found: AFTER,
  disk_revision: AFTER,
  disk_text: DISK_TEXT,
  disk: makeDocument({ id: 2, relativePath: 'match/base.yml', revision: AFTER })
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
  /**
   * Every conflict the panel asked the window to adopt, in order.
   *
   * **Empty is the assertion in most cases.** A conflict installs nothing until a
   * reload has been asked for *and* confirmed, so an entry here in a case that
   * only reached the panel is the pre-emptive install the consult's Q2 ruled out.
   */
  readonly adoptions: ConflictModel<MovePlacement>[];
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
  /**
   * What the window answers when the panel asks it to adopt the disk observation.
   *
   * All three values are real production answers; `installed` is the default.
   */
  readonly adoption?: DiskAdoptionOutcome;
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
  const adoptions: ConflictModel<MovePlacement>[] = [];
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
      // **The window's own adoption**, recorded rather than assumed. Since
      // 2c-4a-3b this surface offers the reload, so a case can press the two
      // controls that reach it and see exactly when — and whether — it is called.
      adoptDiskVersion: (conflict: ConflictModel<MovePlacement>): DiskAdoptionOutcome => {
        adoptions.push(conflict);
        return opened.adoption ?? 'installed';
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
 * The reason the shared recovery renderer drew, or `null` when it drew nothing.
 *
 * **The proof that this surface mounts `RecoveryWithoutCreation.svelte`** rather
 * than repeating its paragraph. The attribute belongs to that component and its
 * value is the reason **it** derived, so a surface that stopped mounting it — or
 * that drew the same sentence itself — fails here even though the words on screen
 * would be identical. `says()` cannot tell those apart, and that a host can omit
 * the sentence while consuming the model faithfully is the failure mode
 * 2c-4c-3b's review found in four copied `{#if}` blocks.
 *
 * @param target - Where the component was mounted.
 * @returns The reason drawn, or `null` when nothing was.
 */
function recoveryNote(target: HTMLElement): string | null {
  const note = target.querySelector(`[${RECOVERY_WITHOUT_CREATION_ATTRIBUTE}]`);
  return note?.getAttribute(RECOVERY_WITHOUT_CREATION_ATTRIBUTE) ?? null;
} // End of function recoveryNote()

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

/**
 * Reaches the conflict panel: choose a destination, move, and answer with one.
 *
 * @param adoption - What the window answers when asked to adopt.
 * @param label - Which destination to choose first. The default names a snippet,
 *   which is the arm most of these cases are about; a case checking what the
 *   confirmation warns has to be able to pick a positional one instead.
 * @returns The mounted panel, showing the conflict.
 */
async function conflicted(
  adoption: DiskAdoptionOutcome = 'installed',
  label: string = afterLabel(':date')
): Promise<Mounted> {
  const panel = mountMover([{ result: CONFLICTED }], { adoption });
  destination(panel.target, label).click();
  flushSync();
  control(panel.target, 'browser.matchMove.move').click();
  await settle();
  return panel;
} // End of function conflicted()

describe('the destination panel’s conflict', () => {
  it('shows the chosen placement beside the disk text, and moves nothing', async () => {
    // **The comparison the consult's Q5 ruled, on a surface that drafts no text.**
    // The retained side is the model's summary of the placement the conflict kept —
    // never a `MovePlacement` rendered as though it were content — and the disk side
    // is the whole file text the command layer read, through `SourceText`.
    const panel = await conflicted();

    expect(says(panel.target, 'browser.saveOutcome.nothingWasWritten')).toBe(true);
    expect(says(panel.target, 'browser.saveOutcome.retainedOperation')).toBe(true);
    expect(says(panel.target, 'browser.saveOutcome.operation.moveAfterSnippet')).toBe(true);
    expect(says(panel.target, 'browser.saveOutcome.operationIdentityIsOld')).toBe(true);
    expect(says(panel.target, 'browser.saveOutcome.diskVersion')).toBe(true);
    expect(panel.target.textContent).toContain(DISK_TEXT_MARKER);
    expect(panel.target.querySelectorAll('.panel .sourceText')).toHaveLength(1);
    // All three revisions, always.
    expect(panel.target.textContent).toContain(
      translate('en', 'browser.matchMove.revisionExpected', { revision: BASE })
    );
    expect(panel.target.textContent).toContain(
      translate('en', 'browser.matchMove.revisionFound', { revision: AFTER })
    );
    expect(panel.target.textContent).toContain(
      translate('en', 'browser.matchMove.revisionDisk', { revision: AFTER })
    );
    // The destination list still marks the chosen one, which is where the summary's
    // "the one marked as chosen above" points; the model names no anchor itself.
    expect(destination(panel.target, afterLabel(':date')).getAttribute('aria-pressed')).toBe(
      'true'
    );
    // Two choices, and the destructive one is a second step away. No copy, ever.
    expect(button(panel.target, conflictChoiceKey('keepEditing', 'operationChoice'))).not.toBeNull();
    expect(
      button(panel.target, conflictChoiceKey('reloadDiskVersion', 'operationChoice'))
    ).not.toBeNull();
    expect(button(panel.target, conflictChoiceKey('confirmReload', 'operationChoice'))).toBeNull();
    expect(button(panel.target, conflictChoiceKey('copyDraft', 'operationChoice'))).toBeNull();
    expect(panel.adoptions).toEqual([]);
    expect(panel.closed()).toBe(0);
    panel.stop();
  }); // End of the "both sides" case

  it('warns that the reload closes this panel, never that it replaces text', async () => {
    // **2c-4a-3b's verification of `reloadOutcome`.** `reloadClosesSurface` ends
    // *copy it first if you want to keep it*, and there is no control here that
    // could — consult Q4 refuses one as a property of what this surface drafts.
    const panel = await conflicted();
    expect(says(panel.target, 'browser.saveOutcome.reloadAbandonsOperation')).toBe(true);
    expect(says(panel.target, 'browser.saveOutcome.reloadClosesSurface')).toBe(false);
    expect(says(panel.target, 'browser.saveOutcome.reloadDiscardsDraft')).toBe(false);
    expect(says(panel.target, 'browser.saveOutcome.operationKeptInMemory')).toBe(true);
    expect(says(panel.target, 'browser.saveOutcome.draftKeptInMemory')).toBe(false);
    panel.stop();
  }); // End of the "surface-aware warning" case

  it('adopts the disk version and closes only when the reload is confirmed', async () => {
    const panel = await conflicted();

    expect(says(panel.target, 'browser.matchMove.reloadDropsAnchoredDestination')).toBe(false);
    control(panel.target, conflictChoiceKey('reloadDiskVersion', 'operationChoice')).click();
    flushSync();

    expect(says(panel.target, 'browser.matchMove.reloadDropsAnchoredDestination')).toBe(true);
    expect(
      button(panel.target, conflictChoiceKey('reloadDiskVersion', 'operationChoice'))
    ).toBeNull();
    expect(panel.adoptions).toEqual([]);
    expect(panel.closed()).toBe(0);

    control(panel.target, conflictChoiceKey('confirmReload', 'operationChoice')).click();
    flushSync();

    expect(panel.adoptions).toHaveLength(1);
    expect(panel.adoptions[0]?.diskRevision).toBe(AFTER);
    expect(panel.closed()).toBe(1);
    // Nothing was sent a second time: a conflict is not a retry.
    expect(panel.calls).toHaveLength(1);
    panel.stop();
  }); // End of the "confirmed reload" case

  it('warns about the destination it really holds, and never about a snippet for a position', async () => {
    // **The 2c-4a-3b review's finding 1, on the screen that draws it.** The one
    // sentence this replaces claimed the destination *names snippets of the
    // version this window read*, which is false of `top` and of `end`. This panel
    // decides nothing: it draws the arm `matchMoveView` chose, and the two cases
    // below are that choice rendered.
    const positional = await conflicted(
      'installed',
      DICTIONARIES.en['browser.matchMove.position.end']
    );
    control(positional.target, conflictChoiceKey('reloadDiskVersion', 'operationChoice')).click();
    flushSync();
    expect(says(positional.target, 'browser.matchMove.reloadDropsPositionalDestination')).toBe(
      true
    );
    expect(says(positional.target, 'browser.matchMove.reloadDropsAnchoredDestination')).toBe(false);
    positional.stop();

    const anchored = await conflicted();
    control(anchored.target, conflictChoiceKey('reloadDiskVersion', 'operationChoice')).click();
    flushSync();
    expect(says(anchored.target, 'browser.matchMove.reloadDropsAnchoredDestination')).toBe(true);
    expect(says(anchored.target, 'browser.matchMove.reloadDropsPositionalDestination')).toBe(false);
    anchored.stop();
  }); // End of the "warning per arm on screen" case

  it('closes on `alreadyThere`, and closes nothing on `refused`', async () => {
    // **`alreadyThere` is a success**: the window already holds the bytes that
    // were asked for. `refused` is the only answer that means it did not move.
    for (const [answer, closes] of [
      ['alreadyThere', 1],
      ['installed', 1],
      ['refused', 0]
    ] as const) {
      const panel = await conflicted(answer);
      control(panel.target, conflictChoiceKey('reloadDiskVersion', 'operationChoice')).click();
      flushSync();
      control(panel.target, conflictChoiceKey('confirmReload', 'operationChoice')).click();
      flushSync();

      expect(panel.adoptions, answer).toHaveLength(1);
      expect(panel.closed(), answer).toBe(closes);
      expect(says(panel.target, 'browser.saveOutcome.nothingWasWritten'), answer).toBe(
        closes === 0
      );
      panel.stop();
    } // End of the loop over the three adoption answers
  }); // End of the "three adoption answers" case

  it('stops offering the reload once the window has refused it, and says why', async () => {
    // **The 2c-4a-3a review's finding 3, from this screen.** The control the window
    // refused without a word is gone, and the sentence takes its place; withholding
    // it claims nothing about how a later ask would be answered.
    const panel = await conflicted('refused');
    control(panel.target, conflictChoiceKey('reloadDiskVersion', 'operationChoice')).click();
    flushSync();
    control(panel.target, conflictChoiceKey('confirmReload', 'operationChoice')).click();
    flushSync();

    // **The orchestrator's finding at 3c-4, from this screen.** The sentence a
    // withdrawn reload leaves behind used to end *Keep editing* on all six
    // surfaces; this one drafts an operation and edits nothing.
    expect(says(panel.target, reloadUnavailableKey('operationChoice'))).toBe(true);
    expect(says(panel.target, reloadUnavailableKey('authoredText'))).toBe(false);
    expect(button(panel.target, conflictChoiceKey('confirmReload', 'operationChoice'))).toBeNull();
    expect(
      button(panel.target, conflictChoiceKey('reloadDiskVersion', 'operationChoice'))
    ).toBeNull();
    expect(says(panel.target, 'browser.matchMove.reloadDropsAnchoredDestination')).toBe(false);
    expect(panel.adoptions).toHaveLength(1);
    expect(panel.closed()).toBe(0);

    // And *Keep editing* gives the panel back, with the destination still chosen.
    control(panel.target, conflictChoiceKey('keepEditing', 'operationChoice')).click();
    flushSync();
    expect(says(panel.target, reloadUnavailableKey('operationChoice'))).toBe(false);
    expect(control(panel.target, 'browser.matchMove.move').disabled).toBe(false);
    panel.stop();
  }); // End of the "refused reload stops being offered" case

  it('offers a way out that does not claim anything is being edited', async () => {
    // **2c-4a-3c's finding 10.2, on one of the three screens that produced it.**
    // This panel is about a move: nobody typed anything, so the raw editor's *Keep
    // editing* named an activity the person never started. `conflictChoiceKey`
    // branches on the draft kind now, and this is that branch through the markup.
    const panel = await conflicted();
    expect(button(panel.target, 'browser.saveOutcome.choice.keepOperation')).not.toBeNull();
    expect(button(panel.target, 'browser.rawSave.choice.keepEditing')).toBeNull();
    // And it is the same control: pressing it still dismisses the panel.
    control(panel.target, 'browser.saveOutcome.choice.keepOperation').click();
    flushSync();
    expect(says(panel.target, 'browser.saveOutcome.nothingWasWritten')).toBe(false);
    expect(control(panel.target, 'browser.matchMove.move').disabled).toBe(false);
    panel.stop();
  }); // End of the "way out that claims no editing" case
}); // End of the "destination panel's conflict" suite

describe('the destination panel’s refused arm names what this surface drafts', () => {
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
    const panel = mountMover([{ result: REFUSED }]);
    destination(panel.target, afterLabel(':date')).click();
    flushSync();
    control(panel.target, 'browser.matchMove.move').click();
    await settle();

    expect(says(panel.target, 'browser.saveOutcome.nothingWasWritten')).toBe(true);
    expect(button(panel.target, rawSaveChoiceKey('keepEditing', 'operationChoice'))).not.toBeNull();
    expect(button(panel.target, rawSaveChoiceKey('keepEditing', 'authoredText'))).toBeNull();

    // Nothing else moved: it is the same choice with the truthful label on it.
    control(panel.target, rawSaveChoiceKey('keepEditing', 'operationChoice')).click();
    flushSync();
    expect(says(panel.target, 'browser.saveOutcome.nothingWasWritten')).toBe(false);
    expect(panel.calls).toHaveLength(1);
    panel.stop();
  }); // End of the "refused arm names what this surface drafts" case
}); // End of the "destination panel's refused arm" suite

describe('the destination panel asks for its outcome to be brought into view', () => {
  /*
   * **2c-4a-3c's findings 10.3 and 10.4, from this component's own markup.** The
   * decision is `./reveal.ts`'s and has its own suite; what only a mounted case can
   * say is that this file **binds** the two elements and **runs** the effect — both
   * of which can be deleted silently, and neither of which any model test can see.
   *
   * **This surface's confirmation step is `reloadWarning !== null` and not a
   * boolean**, which is `matchMove.ts`'s own arrangement, so the second case here
   * is also the check that this component read the right field.
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

  it('asks for the panel’s first line when a conflict appears', async () => {
    const panel = await conflicted();
    const outcome = panel.target.querySelector('[role="status"]');
    expect(outcome).not.toBeNull();
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]?.target).toBe(outcome);
    expect(scrolled[0]?.block).toBe('start');
    panel.stop();
  });

  it('asks for the controls at the reload’s second step', async () => {
    const panel = await conflicted();
    scrolled.length = 0;
    control(panel.target, conflictChoiceKey('reloadDiskVersion', 'operationChoice')).click();
    flushSync();

    const choices = panel.target.querySelector('[role="status"] .choices');
    expect(choices).not.toBeNull();
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]?.target).toBe(choices);
    expect(scrolled[0]?.block).toBe('end');
    panel.stop();
  });

  it('asks for the replacing panel when one arm succeeds another', async () => {
    // **The 2c-4a-3c review's second finding, and only a mounted case can see it.**
    // `beginSave` retains the refusal while the retry is in flight, so `saved`
    // replaces `refused` over the **same** bound element. While all three arms
    // answered one `'panel'` cue the effect's dependency did not change, so it need
    // not run and nothing ever asked for the new panel's first line. The spy
    // is cleared before the second result, so what is asserted is a *new* reveal.
    const panel = mountMover([{ result: REFUSED }, { result: COMMITTED }]);
    destination(panel.target, afterLabel(':date')).click();
    flushSync();
    control(panel.target, 'browser.matchMove.move').click();
    await settle();
    expect(says(panel.target, 'browser.saveOutcome.nothingWasWritten')).toBe(true);
    const refusedPanel = panel.target.querySelector('[role="status"]');

    scrolled.length = 0;
    control(panel.target, 'browser.rawSave.choice.saveAnyway').click();
    await settle();

    expect(says(panel.target, 'browser.saveOutcome.fileWritten')).toBe(true);
    const savedPanel = panel.target.querySelector('[role="status"]');
    expect(savedPanel).toBe(refusedPanel);
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]?.target).toBe(savedPanel);
    expect(scrolled[0]?.block).toBe('start');
    panel.stop();
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
    const panel = await conflicted();
    scrolled.length = 0;
    control(panel.target, conflictChoiceKey('keepMyDraft', 'operationChoice')).click();
    flushSync();

    const report = panel.target.querySelector('[role="status"].reapply');
    expect(report).not.toBeNull();
    expect(says(panel.target, 'browser.reapply.manualResolution')).toBe(true);
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]?.target).toBe(report);
    expect(scrolled[0]?.block).toBe('nearest');

    scrolled.length = 0;
    control(panel.target, conflictChoiceKey('keepMyDraft', 'operationChoice')).click();
    flushSync();
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]?.target).toBe(report);
    expect(scrolled[0]?.block).toBe('nearest');
    panel.stop();
  }); // End of the "asks for a refused reapply's report" case
}); // End of the "destination panel asks for its outcome" suite

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
      saveRawDocument: vi.fn(async () => refusal),
      drainExternalChanges: vi.fn(async () => refusal)
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
        // **The window's own adoption**, which no case in this suite reaches: it
        // never opens the conflict panel, and a conflict installs nothing until a
        // reload has been asked for *and* confirmed. The conflict suite above
        // records every call instead.
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

  it('stops pointing at a marked destination when a reprojection drops it under an open conflict', async () => {
    // **The 2c-4a-3b review's finding 2, and the coverage the review named as
    // missing.** The `after` summary sends the reader to the destination the list
    // above marks. Every mounted case before this one held one static projection,
    // so nothing could see what happens when the window replaces that parse
    // *while the conflict is still displayed* — which a re-read from the sidebar
    // or another surface's committed save does. Only a real `BrowserState` can
    // stage it: `state.views` is `$state`, so the panel re-derives on its own, and
    // an array a test swapped would not be noticed at all.
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
        return { ok: true, value: file() };
      }),
      getMatch: vi.fn(async (): Promise<CommandResult<MatchView>> => refusal),
      reloadDocument: vi.fn(async (): Promise<CommandResult<DocumentView>> => {
        return { ok: true, value: reread() };
      }),
      documentText: vi.fn(async (): Promise<CommandResult<string>> => refusal),
      moveMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => {
        return { ok: true, value: CONFLICTED };
      }),
      saveMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
      createMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
      deleteMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
      duplicateMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
      saveRawDocument: vi.fn(async () => refusal),
      drainExternalChanges: vi.fn(async () => refusal)
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
        // Never reached: this case never confirms a reload, and a conflict
        // installs nothing on its own.
        adoptDiskVersion: (): DiskAdoptionOutcome => 'installed',
        close: (): void => undefined
      }
    });
    flushSync();

    destination(target, afterLabel(':date')).click();
    flushSync();
    control(target, 'browser.matchMove.move').click();
    await settle();

    // The conflict is on screen, the anchor is still offered and still marked, and
    // the summary is the one that sends the reader to it.
    expect(destination(target, afterLabel(':date')).getAttribute('aria-pressed')).toBe('true');
    expect(says(target, 'browser.saveOutcome.operation.moveAfterSnippet')).toBe(true);
    expect(says(target, 'browser.saveOutcome.operation.moveAfterSnippetNoLongerShown')).toBe(false);

    // The window reads the file again — nothing here asked it to, which is the
    // point — and the conflict panel stays exactly where it was.
    expect(await state.rereadDocument(2)).toBeNull();
    flushSync();

    expect(state.views[0]?.revision).toBe(AFTER);
    expect(destinations(target).map((one) => one.textContent?.trim())).toEqual([
      DICTIONARIES.en['browser.matchMove.position.top'],
      DICTIONARIES.en['browser.matchMove.position.end']
    ]);
    expect(says(target, 'browser.saveOutcome.operation.moveAfterSnippet')).toBe(false);
    expect(says(target, 'browser.saveOutcome.operation.moveAfterSnippetNoLongerShown')).toBe(true);
    // Still a conflict, and still nothing written or installed.
    expect(says(target, 'browser.saveOutcome.nothingWasWritten')).toBe(true);
    expect(commands.moveMatch).toHaveBeenCalledTimes(1);

    void unmount(component);
    target.remove();
  }); // End of the "reprojection under an open conflict" case
}); // End of the "move panel over the real state" suite

/** The reapply control's label on this surface, which drafts no text. */
const KEEP_MY_DRAFT = conflictChoiceKey('keepMyDraft', 'operationChoice');

/**
 * A conflict whose evidence identified the moved snippet in a chosen disk parse.
 *
 * @param disk - The projection of the fresh read, and where the target is found.
 * @param at - Which of its snippets the evidence identified.
 * @returns The conflict as it crosses the boundary.
 */
function identifiedIn(disk: DocumentView, at: number): SaveResult {
  // Written out rather than spread over {@link CONFLICTED}: a spread into a
  // `SaveResult` annotation is checked against all three arms, and the two this is
  // not lack every field below.
  return {
    outcome: 'conflict',
    reapply: {
      subject: { Identified: { target: disk.matches[at]! } },
      placement: { NotAnchored: {} }
    },
    expected: BASE,
    found: AFTER,
    disk_revision: AFTER,
    disk_text: DISK_TEXT,
    disk
  };
} // End of function identifiedIn()

/**
 * Reaches the conflict panel with a chosen payload and a positional destination.
 *
 * **Positional on purpose.** `top` and `end` are semantic choices the rebuilt
 * session lowers afresh, so these cases drive the subject's correspondence without
 * also depending on an anchor's — which is the mover's second, separate arm.
 *
 * @param result - The conflict the scripted boundary answers with.
 * @returns The mounted panel, showing the conflict.
 */
async function conflictedGoingToTheEnd(result: SaveResult): Promise<Mounted> {
  const panel = mountMover([{ result }]);
  destination(panel.target, DICTIONARIES.en['browser.matchMove.position.end']).click();
  flushSync();
  control(panel.target, 'browser.matchMove.move').click();
  await settle();
  return panel;
} // End of function conflictedGoingToTheEnd()

describe('the destination panel’s *Keep my draft*', () => {
  it('draws the control and the operation-choice line beside it', async () => {
    const panel = await conflicted();
    expect(button(panel.target, KEEP_MY_DRAFT)).not.toBeNull();
    expect(says(panel.target, 'browser.reapply.readyOperation')).toBe(true);
    // Never the authored-text sentence: nobody typed a placement.
    expect(says(panel.target, 'browser.reapply.ready')).toBe(false);
    panel.stop();
  });

  it('rebuilds the move over the disk version, sending nothing', async () => {
    // The disk still writes this snippet first, so *at the bottom of the list* is
    // a real request against the new parse and the rebuilt session has one to send.
    const panel = await conflictedGoingToTheEnd(identifiedIn(reread(), 0));
    control(panel.target, KEEP_MY_DRAFT).click();
    flushSync();

    expect(panel.adoptions).toHaveLength(1);
    expect(says(panel.target, 'browser.reapply.reapplied')).toBe(true);
    expect(says(panel.target, 'browser.reapply.alreadySatisfied')).toBe(false);
    // The conflict is gone and nothing was sent a second time: a reapply is not a
    // retry, and the ordinary submit path is what sends what it hands back.
    expect(says(panel.target, 'browser.saveOutcome.nothingWasWritten')).toBe(false);
    expect(panel.calls).toHaveLength(1);
    expect(panel.closed()).toBe(0);
    panel.stop();
  }); // End of the "move rebuilt" case

  it('reports the no-op arm when the disk already places the snippet there', async () => {
    // **`alreadySatisfied` is not `reapplied` and not a refusal**, which is consult
    // Q9's likeliest false sentence designed out: the disk snapshot was adopted and
    // there is nothing left to send, and saying *reapplied* would invite a person
    // to look for something to press.
    const settled = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: AFTER,
      matches: [item(11, 0, ':date', AFTER), item(12, 1, ':sql', AFTER), item(10, 2, ':sig', AFTER)]
    });
    const panel = await conflictedGoingToTheEnd(identifiedIn(settled, 2));
    control(panel.target, KEEP_MY_DRAFT).click();
    flushSync();

    expect(panel.adoptions).toHaveLength(1);
    expect(says(panel.target, 'browser.reapply.alreadySatisfied')).toBe(true);
    expect(says(panel.target, 'browser.reapply.reapplied')).toBe(false);
    expect(panel.calls).toHaveLength(1);
    // Nothing was written, so nothing may have closed this panel either. The
    // `close` callback is a spy rather than a real unmount, so continued local
    // rendering does not prove the surface was not told to go away.
    expect(panel.closed()).toBe(0);
    panel.stop();
  }); // End of the "already satisfied" case

  it('refuses and adopts nothing when the evidence names no snippet', async () => {
    const panel = await conflicted();
    control(panel.target, KEEP_MY_DRAFT).click();
    flushSync();

    expect(says(panel.target, 'browser.reapply.manualResolution')).toBe(true);
    expect(says(panel.target, 'browser.reapply.obstacle.evidenceNotATarget')).toBe(true);
    expect(panel.adoptions).toEqual([]);
    expect(says(panel.target, 'browser.saveOutcome.nothingWasWritten')).toBe(true);
    expect(panel.closed()).toBe(0);
    panel.stop();
  });
}); // End of the "destination panel’s reapply" suite

describe('what the destination panel says about recovery', () => {
  /*
   * **2c-4c-3b's negative half, on the mover.** A move drafts a `MovePlacement` — a
   * positional choice nobody typed — so this surface offers neither copy nor
   * save-as-new, and what recovery draws here is a reason. `recovery.test.ts` holds
   * that at the value level; only a mounted panel can hold that this surface
   * **mounts the shared renderer**, draws no control, and mounts no recovery form.
   */

  /** The reason a move's draft kind produces, so a rename is a compile error. */
  const REASON: RecoveryUnavailable = 'operationDraft';

  it('says nothing at all until something has gone wrong', () => {
    const panel = mountMover();
    // The shared renderer is mounted and drew nothing, which is its own decision
    // and not a condition this surface carries.
    expect(recoveryNote(panel.target)).toBeNull();
    expect(says(panel.target, recoveryUnavailableKey('operationDraft'))).toBe(false);
    panel.stop();
  });

  it('offers neither a copy nor a save-as-new, and says why instead', async () => {
    const panel = await conflicted();

    // `recoveryNote` is what says the shared renderer drew it; `says` alone could
    // not tell that from a paragraph of this file's own.
    expect(recoveryNote(panel.target)).toBe(REASON);
    expect(says(panel.target, recoveryUnavailableKey('operationDraft'))).toBe(true);
    expect(says(panel.target, recoveryUnavailableKey('wholeDocumentDraft'))).toBe(false);
    expect(button(panel.target, recoveryChoiceKey('createFromSupportedFields'))).toBeNull();
    expect(says(panel.target, 'browser.recovery.label')).toBe(false);
    expect(says(panel.target, 'browser.recovery.transferHeading')).toBe(false);
    expect(says(panel.target, 'browser.recovery.destination')).toBe(false);
    expect(button(panel.target, conflictChoiceKey('copyDraft', 'operationChoice'))).toBeNull();
    expect(panel.calls).toHaveLength(1);
    expect(panel.adoptions).toEqual([]);
    expect(panel.closed()).toBe(0);
    panel.stop();
  }); // End of the "neither copy nor save-as-new" case

  it('keeps the conflict through every ending that wrote nothing', async () => {
    /*
     * **All three of this surface's non-committed endings are reachable**, which
     * the raw editor's three cannot claim: its `reapplySupport` is `unavailable`,
     * so only the two reload endings exist there.
     *
     * **Every one of them asserts `closed()`.** The `close` callback here is a spy
     * and not a parent unmount, so a surface that had been told to close would go
     * on rendering and every sentence below would still be found — the reason
     * continued rendering is not evidence, and the count is.
     */

    // A reapply that resolved nothing: the sentence and the conflict both stand,
    // and the window was never asked to move.
    const refusedReapply = await conflicted();
    control(refusedReapply.target, KEEP_MY_DRAFT).click();
    flushSync();
    expect(says(refusedReapply.target, 'browser.reapply.manualResolution')).toBe(true);
    expect(recoveryNote(refusedReapply.target)).toBe(REASON);
    expect(says(refusedReapply.target, 'browser.saveOutcome.nothingWasWritten')).toBe(true);
    expect(refusedReapply.adoptions).toEqual([]);
    expect(refusedReapply.calls).toHaveLength(1);
    expect(refusedReapply.closed()).toBe(0);
    refusedReapply.stop();

    // A reload asked for and not confirmed: nothing spent, everything still drawn.
    const atTheWarning = await conflicted();
    control(atTheWarning.target, conflictChoiceKey('reloadDiskVersion', 'operationChoice')).click();
    flushSync();
    expect(recoveryNote(atTheWarning.target)).toBe(REASON);
    expect(atTheWarning.adoptions).toEqual([]);
    expect(atTheWarning.calls).toHaveLength(1);
    expect(atTheWarning.closed()).toBe(0);
    atTheWarning.stop();

    // A reload the window refused: the conflict stayed, and the sentence with it.
    const refusedReload = await conflicted('refused');
    control(refusedReload.target, conflictChoiceKey('reloadDiskVersion', 'operationChoice')).click();
    flushSync();
    control(refusedReload.target, conflictChoiceKey('confirmReload', 'operationChoice')).click();
    flushSync();
    expect(says(refusedReload.target, 'browser.saveOutcome.nothingWasWritten')).toBe(true);
    expect(recoveryNote(refusedReload.target)).toBe(REASON);
    expect(refusedReload.calls).toHaveLength(1);
    expect(refusedReload.closed()).toBe(0);
    refusedReload.stop();
  }); // End of the "conflict survives every non-committed ending" case

  it('stops saying it when the person puts the conflict away', async () => {
    const panel = await conflicted();
    control(panel.target, conflictChoiceKey('keepEditing', 'operationChoice')).click();
    flushSync();

    expect(says(panel.target, 'browser.saveOutcome.nothingWasWritten')).toBe(false);
    expect(recoveryNote(panel.target)).toBeNull();
    expect(says(panel.target, recoveryUnavailableKey('operationDraft'))).toBe(false);
    expect(panel.adoptions).toEqual([]);
    expect(panel.calls).toHaveLength(1);
    // A dismissal is an ending that wrote nothing too, and it does not close either.
    expect(panel.closed()).toBe(0);
    panel.stop();
  }); // End of the "dismissal ends the sentence" case
}); // End of the "what the destination panel says about recovery" suite
