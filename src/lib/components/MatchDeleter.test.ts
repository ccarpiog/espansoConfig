/** @vitest-environment jsdom */

/**
 * The deletion panel, mounted and driven through real DOM events.
 *
 * The fifth file in this repository to opt into jsdom, and it opts in the same
 * way the first four do: by the docblock above and by nothing else. The suite's
 * default environment is still `node`, and the six components that predate
 * `RawEditor.svelte` are deliberately not back-filled
 * (`docs/decisions/2c-split-notes.md` section 7).
 *
 * **What this file is for, given that `matchDeletion.test.ts` already exists.**
 * That suite drives the value; it cannot see whether a confirmation is drawn,
 * whether the two phases are two clicks, or — the claim this whole sub-phase is
 * written against — **where the component reads `confirmDelete`'s second argument
 * from**. That argument is the only one that comes from outside the session, so a
 * component that hands `session.match` back type-checks perfectly and defeats the
 * confirmation entirely; nothing in TypeScript can say where a value came from,
 * and this is the check that can.
 *
 * The last suite is the design consult's **Q7** test, taken on a screen: a
 * committed deletion whose `moved` is `null`, over a projection in which every
 * surviving identity has changed, asserting that no pre-commit identity is left
 * anywhere in the window's view or its selection. It is mounted over a **real**
 * `BrowserState` for the reason `DetailPane.test.ts` gives: a hand-rolled stub is
 * not reactive, and the whole question is what the state does after its own
 * re-read.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeDocument, makeMatch, makeSummary } from '../browser/fixtures';
import type { InvalidationStatus } from '../browser/invalidation';
import { matchKey } from '../browser/labels';
import {
  createBrowserState,
  type BrowserCommands,
  type BrowserState,
  type MatchSaveAnswer
} from '../browser/workspace.svelte';
import { DICTIONARIES, type TranslationKey } from '../i18n/dictionaries';
import { locale } from '../stores/locale.svelte';
import type { CommandResult } from '../ipc/commands';
import type {
  Acknowledgement,
  ContentRevision,
  DocumentSummary,
  DocumentView,
  Finding,
  MatchId,
  MatchView,
  SaveResult,
  WorkspaceSummary
} from '../ipc/types';
import MatchDeleter from './MatchDeleter.svelte';

/** The revision the file is projected at before anything is written. */
const BASE: ContentRevision = 'a'.repeat(64);

/** The revision the file holds after a commit. */
const AFTER: ContentRevision = 'b'.repeat(64);

/** The file the snippet lives in. */
const FILE: DocumentSummary = makeSummary({ id: 2, relativePath: 'match/base.yml' });

/** The adoption a save that wrote nothing owes: none. */
const NOT_OWED: InvalidationStatus = { kind: 'notOwed' };

/** The adoption a committed save performed. */
const ADOPTED: InvalidationStatus = { kind: 'done' };

/**
 * A snippet file with two snippets in it.
 *
 * @param overrides - Whatever a case needs beyond the two.
 * @returns The projection.
 */
function file(overrides: Parameters<typeof makeDocument>[0] = {}): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision: BASE,
    matches: [
      makeMatch({ node: 10, document: 2, revision: BASE, trigger: ':sig' }),
      makeMatch({ node: 11, document: 2, revision: BASE, trigger: ':date' })
    ],
    ...overrides
  });
} // End of function file()

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

/**
 * A deletion that ran to the end and wrote the file.
 *
 * **`moved` is `null` by construction**: the snippet that was deleted has no
 * identity in the new revision, and filling that field with a neighbour's would
 * put a position back into the one field that exists to replace positions with
 * identities.
 */
const COMMITTED: SaveResult = {
  outcome: 'saved',
  revision: AFTER,
  committed: true,
  notes: [],
  backup_taken: false,
  moved: null
};

/** One call the component made to the boundary. */
interface RecordedDelete {
  /** Which snippet it aimed at. */
  readonly id: MatchId;
  /** The revision it said the session was opened at. */
  readonly baseRevision: ContentRevision;
  /** The suspicions it said had already been shown to a person. */
  readonly acknowledgement: Acknowledgement;
}

/** One scripted answer to one deletion. */
interface ScriptedAnswer {
  /** How the save ended, for the `answered` arm. */
  readonly result?: SaveResult;
  /** What became of the adoption; a commit adopts unless a case says otherwise. */
  readonly adoption?: InvalidationStatus;
}

/** A mounted panel and everything a case needs to drive it. */
interface Mounted {
  /** The element the component was mounted into. */
  readonly target: HTMLElement;
  /** Every call the component made, in order. */
  readonly calls: RecordedDelete[];
  /** How many times the panel asked to be closed. */
  readonly closed: () => number;
  /** Replaces what the projections reader answers, as a re-read would. */
  readonly reproject: (views: readonly DocumentView[]) => void;
  /** Tears the component down. */
  readonly stop: () => void;
}

/**
 * Mounts the panel over a scripted boundary.
 *
 * @param answers - What each successive deletion answers, in order.
 * @param projection - The file's projection to open over.
 * @param at - Which of its snippets to open over.
 * @returns The mounted panel.
 */
function mountDeleter(
  answers: readonly ScriptedAnswer[] = [],
  projection: DocumentView = file(),
  at = 0
): Mounted {
  const remaining = [...answers];
  const calls: RecordedDelete[] = [];
  let closes = 0;
  let views: readonly DocumentView[] = [projection];
  const target = document.createElement('div');
  document.body.append(target);
  const component = mount(MatchDeleter, {
    target,
    props: {
      projection,
      match: projection.matches[at]!,
      file: FILE,
      projections: (): readonly DocumentView[] => views,
      remove: (
        id: MatchId,
        baseRevision: ContentRevision,
        acknowledgement: Acknowledgement
      ): Promise<MatchSaveAnswer> => {
        calls.push({ id, baseRevision, acknowledgement });
        const next = remaining.shift();
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
} // End of function mountDeleter()

/**
 * The button whose label is the English rendering of one key, or `null`.
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
 * Waits for the component's asynchronous handler to finish.
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

describe('the mounted deletion panel', () => {
  it('opens with the question and sends nothing until it is answered', async () => {
    // **The consult's Q2 on a screen.** The protocol's acknowledgement round trip
    // engages only for a finding-bearing candidate, so an ordinary deletion
    // collects consent nowhere and this panel is the only thing that asks.
    const panel = mountDeleter([{ result: COMMITTED }]);
    expect(says(panel.target, 'browser.matchDeletion.question')).toBe(true);
    expect(panel.calls).toHaveLength(0);
    // The snippet is named, so the question is about something the person can see.
    expect(panel.target.textContent).toContain(':sig');
    expect(panel.target.textContent).toContain('match/base.yml');

    control(panel.target, 'browser.matchDeletion.confirm').click();
    await settle();

    expect(panel.calls).toHaveLength(1);
    expect(panel.calls[0]?.id).toEqual({ document: 2, revision: BASE, node: 10 });
    expect(panel.calls[0]?.baseRevision).toBe(BASE);
    expect(panel.calls[0]?.acknowledgement).toEqual({ accepted: [] });
    panel.stop();
  }); // End of the "asks first" case

  it('takes the question back and leaves, having sent nothing', () => {
    const panel = mountDeleter([{ result: COMMITTED }]);
    control(panel.target, 'browser.matchDeletion.cancel').click();
    flushSync();

    expect(panel.calls).toHaveLength(0);
    expect(panel.closed()).toBe(1);
    panel.stop();
  }); // End of the "cancelled" case

  it('refuses a confirmation once the window has read the file again', async () => {
    // **The first review round's fifth finding, on the screen that can defeat
    // it.** Nothing about the session changes when a window re-reads a file, so
    // the pending consent and the session's own identity go on agreeing with each
    // other; the only value that can notice is the one this component reads off
    // the **live** projections at the moment of the click. A component that handed
    // `session.match` back instead would pass this case's first half and delete a
    // snippet nobody was asked about.
    const panel = mountDeleter([{ result: COMMITTED }]);
    panel.reproject([
      file({
        revision: AFTER,
        matches: [
          makeMatch({ node: 10, document: 2, revision: AFTER, trigger: ':sig' }),
          makeMatch({ node: 11, document: 2, revision: AFTER, trigger: ':date' })
        ]
      })
    ]);

    control(panel.target, 'browser.matchDeletion.confirm').click();
    await settle();

    expect(panel.calls).toHaveLength(0);
    expect(says(panel.target, 'browser.matchDeletion.confirmationRefused')).toBe(true);
    // **A dead end with a way out and an explanation, and it is a dead end on
    // purpose**: this session's own identity is from the parse that was replaced,
    // so asking again would collect an answer that is refused for the same reason.
    // The sentence says to leave and pick the snippet from the list, and both
    // exits are drawn.
    expect(control(panel.target, 'browser.matchDeletion.cancel').disabled).toBe(false);
    expect(control(panel.target, 'browser.matchDeletion.close').disabled).toBe(false);
    panel.stop();
  }); // End of the "stale confirmation" case

  it('refuses the last snippet of a file, with the reason and no question', () => {
    // The consult's Q6: refused in the tested value, said inline, and the core's
    // own refusal still the one that decides. Nothing is asked, because nobody
    // should be walked through a confirmation for an operation known to fail.
    const lonely = file({
      matches: [makeMatch({ node: 10, document: 2, revision: BASE, trigger: ':sig' })]
    });
    const panel = mountDeleter([], lonely);

    expect(says(panel.target, 'browser.matchDeletion.refused.lastSnippet')).toBe(true);
    expect(says(panel.target, 'browser.matchDeletion.question')).toBe(false);
    expect(button(panel.target, 'browser.matchDeletion.confirm')).toBeNull();
    expect(button(panel.target, 'browser.matchDeletion.request')).toBeNull();
    // Leaving is still offered.
    expect(control(panel.target, 'browser.matchDeletion.close').disabled).toBe(false);
    panel.stop();
  }); // End of the "last snippet" case

  it('asks again after a refusal, and carries the consent into the second attempt', async () => {
    // `confirmDelete` consumes the pending request, so consent is for one attempt.
    // *Save anyway* records it and **re-raises the question**, which is the same
    // acknowledgement round trip every other writing surface has, with the second
    // phase kept where the model put it.
    const panel = mountDeleter([{ result: REFUSED }, { result: COMMITTED }]);
    control(panel.target, 'browser.matchDeletion.confirm').click();
    await settle();

    expect(says(panel.target, 'browser.saveOutcome.nothingWasWritten')).toBe(true);
    expect(says(panel.target, 'browser.matchDeletion.question')).toBe(false);

    control(panel.target, 'browser.rawSave.choice.saveAnyway').click();
    flushSync();
    expect(says(panel.target, 'browser.matchDeletion.question')).toBe(true);
    expect(panel.calls).toHaveLength(1);

    control(panel.target, 'browser.matchDeletion.confirm').click();
    await settle();

    expect(panel.calls).toHaveLength(2);
    expect(panel.calls[1]?.acknowledgement).toEqual({ accepted: [SUSPICION] });
    expect(says(panel.target, 'browser.saveOutcome.fileWritten')).toBe(true);
    panel.stop();
  }); // End of the "acknowledgement round trip" case

  it('spends itself on a commit and offers nothing more to delete', async () => {
    const panel = mountDeleter([{ result: COMMITTED }]);
    control(panel.target, 'browser.matchDeletion.confirm').click();
    await settle();

    expect(says(panel.target, 'browser.saveOutcome.fileWritten')).toBe(true);
    expect(says(panel.target, 'browser.matchDeletion.spent')).toBe(true);
    expect(button(panel.target, 'browser.matchDeletion.confirm')).toBeNull();
    expect(button(panel.target, 'browser.matchDeletion.request')).toBeNull();

    control(panel.target, 'browser.matchDeletion.done').click();
    flushSync();
    expect(panel.closed()).toBe(1);
    panel.stop();
  }); // End of the "commit spends the session" case

  it('says nothing was written when the window refused before any command ran', async () => {
    const panel = mountDeleter([]);
    control(panel.target, 'browser.matchDeletion.confirm').click();
    await settle();

    expect(says(panel.target, 'browser.matchDeletion.sendFailed')).toBe(true);
    expect(says(panel.target, 'browser.matchDeletion.mayHaveWritten')).toBe(false);
    expect(says(panel.target, 'browser.saveOutcome.fileWritten')).toBe(false);
    panel.stop();
  }); // End of the "nothing attempted" case
}); // End of the "mounted deletion panel" suite

/** The workspace summary the state below is opened over; nothing reads it. */
const SUMMARY: WorkspaceSummary = {
  root: '/tmp/espanso',
  documents: 1,
  match_files: 1,
  config_profiles: 0,
  packages: 0,
  disabled: 0
};

/**
 * The file as it is **after** the deletion, with every identity changed.
 *
 * **The fixture the consult's Q7 turns on.** A re-read whose surviving snippets
 * happened to keep their nodes and their revision would let a stale-reference bug
 * pass unnoticed, so the revision moves *and* every node is renumbered: nothing
 * that was true of an identity before the commit is true of one after it.
 *
 * @returns The projection the re-read installs.
 */
function thinned(): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision: AFTER,
    matches: [
      makeMatch({ node: 90, document: 2, revision: AFTER, trigger: ':date' }),
      makeMatch({ node: 91, document: 2, revision: AFTER, trigger: ':addr' })
    ]
  });
} // End of function thinned()

/**
 * The file as it is before, with three snippets so a deletion leaves two.
 *
 * @returns The projection the load installs.
 */
function crowded(): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision: BASE,
    matches: [
      makeMatch({ node: 10, document: 2, revision: BASE, trigger: ':sig' }),
      makeMatch({ node: 11, document: 2, revision: BASE, trigger: ':date' }),
      makeMatch({ node: 12, document: 2, revision: BASE, trigger: ':addr' })
    ]
  });
} // End of function crowded()

describe('a committed deletion, over the real workspace state', () => {
  it('leaves no pre-commit identity anywhere in the view or the selection', async () => {
    // **The design consult's Q7, taken on a screen.** The likeliest defect is
    // reading `moved: null` as *leave the selection alone* and then retaining the
    // deleted — or another pre-commit — `MatchId` after the projection has been
    // replaced. Every identity in the fixture changes across the commit, so a
    // retained one is a value that cannot be produced by the new parse.
    const reads = [crowded(), thinned()];
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
        return { ok: true, value: reads.length > 1 ? reads.shift()! : reads[0]! };
      }),
      getMatch: vi.fn(async (): Promise<CommandResult<MatchView>> => refusal),
      reloadDocument: vi.fn(async (): Promise<CommandResult<DocumentView>> => refusal),
      documentText: vi.fn(async (): Promise<CommandResult<string>> => refusal),
      moveMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
      saveMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
      createMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
      deleteMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => {
        return { ok: true, value: COMMITTED };
      }),
      saveRawDocument: vi.fn(async () => refusal)
    };
    const state: BrowserState = createBrowserState(commands, () => undefined);
    await state.open(null);
    const doomed = state.views[0]!.matches[0]!;
    // Every identity the window could be holding before the commit, as strings —
    // all three fields, because a comparison that dropped the revision would call
    // two identities equal across the very reparse the revision exists to separate.
    const before = state.views.flatMap((view) => view.matches.map((one) => matchKey(one.id)));
    await state.select(doomed);
    flushSync();
    expect(state.selected?.id.node).toBe(10);

    const target = document.createElement('div');
    document.body.append(target);
    const component = mount(MatchDeleter, {
      target,
      props: {
        projection: state.views[0]!,
        match: doomed,
        file: FILE,
        projections: (): readonly DocumentView[] => state.views,
        remove: (
          id: MatchId,
          baseRevision: ContentRevision,
          acknowledgement: Acknowledgement
        ): Promise<MatchSaveAnswer> => state.deleteMatch(id, baseRevision, acknowledgement),
        close: (): void => undefined
      }
    });
    flushSync();

    control(target, 'browser.matchDeletion.confirm').click();
    await settle();

    // The write happened, and it was decided against the parse the panel opened
    // over rather than against whatever the window is projecting now.
    expect(commands.deleteMatch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(commands.deleteMatch).mock.calls[0]![1]).toBe(BASE);
    expect(says(target, 'browser.saveOutcome.fileWritten')).toBe(true);

    // **Nothing pre-commit survives.** The projection, the selection and the
    // identity the selection resolves to are all from the parse the re-read
    // installed, and none of them is a value the old parse could have produced.
    const after = state.views.flatMap((view) => view.matches.map((one) => matchKey(one.id)));
    expect(after).toEqual([`2:${AFTER}:90`, `2:${AFTER}:91`]);
    for (const identity of after) {
      expect(before).not.toContain(identity);
    } // End of the loop over the identities the re-read produced
    expect(state.selected).not.toBeNull();
    expect(before).not.toContain(matchKey(state.selected!.id));
    expect(before).not.toContain(matchKey(state.selectedMatch!.id));
    // The consult's Q1: the snippet now at the deleted one's former ordinal
    // position, adopted under its own new identity, with the notice that says so.
    expect(state.selected?.position).toBe(0);
    expect(state.selectedMatch?.id).toEqual({ document: 2, revision: AFTER, node: 90 });
    expect(state.notice).toBe('deleted');

    void unmount(component);
    target.remove();
  }); // End of the "no pre-commit identity" case
}); // End of the "committed deletion over the real state" suite
