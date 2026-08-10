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

import { rawSaveChoiceKey } from '../browser/rawSave';
import {
  conflictChoiceKey,
  reloadUnavailableKey,
  type ConflictModel,
  type DiskAdoptionOutcome
} from '../browser/saveOutcome';
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
import { DICTIONARIES, translate, type TranslationKey } from '../i18n/dictionaries';
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
 * The whole file text the conflict's fresh read carried.
 *
 * Distinguishable from anything the panel holds, so a case can tell the disk side
 * of the panel from the operation summary by looking at the rendered text.
 */
const DISK_TEXT = 'matches:\n  - trigger: x\n    replace: theirs\n';

/** A word that appears in {@link DISK_TEXT} and nowhere else on the screen. */
const DISK_TEXT_MARKER = 'theirs';

/** A deletion the file had moved on under. */
const CONFLICTED: SaveResult = {
  outcome: 'conflict',
  reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
  expected: BASE,
  found: AFTER,
  disk_revision: AFTER,
  disk_text: DISK_TEXT,
  disk: makeDocument({ id: 2, relativePath: 'match/base.yml', revision: AFTER })
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
  /**
   * Every conflict the component asked the window to adopt, in order.
   *
   * **Empty is the assertion in most cases.** A conflict installs nothing until a
   * reload has been asked for *and* confirmed, so an entry here in a case that
   * only reached the panel is the pre-emptive install the consult's Q2 ruled out.
   */
  readonly adoptions: ConflictModel<MatchId>[];
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
 * @param adoption - What the window answers when the panel asks it to adopt the
 *   disk observation. All three values are real production answers.
 * @returns The mounted panel.
 */
function mountDeleter(
  answers: readonly ScriptedAnswer[] = [],
  projection: DocumentView = file(),
  at = 0,
  adoption: DiskAdoptionOutcome = 'installed'
): Mounted {
  const remaining = [...answers];
  const calls: RecordedDelete[] = [];
  const adoptions: ConflictModel<MatchId>[] = [];
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
      // **The window's own adoption**, recorded rather than assumed. Since
      // 2c-4a-3b this surface offers the reload, so a case can press the two
      // controls that reach it and see exactly when — and whether — it is called.
      adoptDiskVersion: (conflict: ConflictModel<MatchId>): DiskAdoptionOutcome => {
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

/**
 * Reaches the conflict panel: confirm the question, and answer with a conflict.
 *
 * @param adoption - What the window answers when asked to adopt.
 * @returns The mounted panel, showing the conflict.
 */
async function conflicted(adoption: DiskAdoptionOutcome = 'installed'): Promise<Mounted> {
  return conflictedWith(CONFLICTED, adoption);
} // End of function conflicted()

/**
 * The file as the fresh read after the refusal found it.
 *
 * Two snippets, so a rebuilt deletion is not refused for emptying the list, and
 * **different arena nodes**, so a case can tell an identity minted from this parse
 * from one minted from the parse the panel opened over.
 */
const DISK: DocumentView = file({
  revision: AFTER,
  matches: [
    makeMatch({ node: 20, document: 2, revision: AFTER, trigger: ':sig' }),
    makeMatch({ node: 21, document: 2, revision: AFTER, trigger: ':date' })
  ]
});

/**
 * The same conflict, whose correspondence evidence identified the snippet.
 *
 * `disk` and the identified target come from one value here; in Rust one refresh
 * builds the text, the revision and the projection together, and nothing in a
 * fixture can stand in for that (`fixtures.ts`'s own note).
 */
const IDENTIFIED: SaveResult = {
  ...CONFLICTED,
  disk: DISK,
  reapply: {
    subject: { Identified: { target: DISK.matches[0]! } },
    placement: { NotAnchored: {} }
  }
};

/**
 * Reaches the conflict panel with a chosen payload.
 *
 * @param result - The conflict the scripted boundary answers with.
 * @param adoption - What the window answers when asked to adopt.
 * @returns The mounted panel, showing the conflict.
 */
async function conflictedWith(
  result: SaveResult,
  adoption: DiskAdoptionOutcome = 'installed'
): Promise<Mounted> {
  const panel = mountDeleter([{ result }], file(), 0, adoption);
  control(panel.target, 'browser.matchDeletion.confirm').click();
  await settle();
  return panel;
} // End of function conflictedWith()

/** The reapply control's label on this surface, which drafts no text. */
const KEEP_MY_DRAFT = conflictChoiceKey('keepMyDraft', 'operationChoice');

describe('the deletion panel’s conflict', () => {
  it('shows the operation beside the disk text, and deletes nothing', async () => {
    // **The comparison the consult's Q5 ruled, on a surface that drafts no text.**
    // The retained side is the model's summary of what was asked for — never a
    // `MatchId` rendered as though it were content — and the disk side is the whole
    // file text the command layer read, through `SourceText`.
    const panel = await conflicted();

    expect(says(panel.target, 'browser.saveOutcome.nothingWasWritten')).toBe(true);
    expect(says(panel.target, 'browser.saveOutcome.retainedOperation')).toBe(true);
    expect(says(panel.target, 'browser.saveOutcome.operation.deleteSnippet')).toBe(true);
    expect(says(panel.target, 'browser.saveOutcome.operationIdentityIsOld')).toBe(true);
    expect(says(panel.target, 'browser.saveOutcome.diskVersion')).toBe(true);
    expect(panel.target.textContent).toContain(DISK_TEXT_MARKER);
    // One rendering surface for file text, and only the disk side needs it.
    expect(panel.target.querySelectorAll('.panel .sourceText')).toHaveLength(1);
    // All three revisions, always.
    expect(panel.target.textContent).toContain(
      translate('en', 'browser.matchDeletion.revisionExpected', { revision: BASE })
    );
    expect(panel.target.textContent).toContain(
      translate('en', 'browser.matchDeletion.revisionFound', { revision: AFTER })
    );
    expect(panel.target.textContent).toContain(
      translate('en', 'browser.matchDeletion.revisionDisk', { revision: AFTER })
    );
    // Two choices, and the destructive one is a second step away. No copy, ever:
    // the Q4 rule is a property of what this surface drafts.
    expect(button(panel.target, conflictChoiceKey('keepEditing', 'operationChoice'))).not.toBeNull();
    expect(
      button(panel.target, conflictChoiceKey('reloadDiskVersion', 'operationChoice'))
    ).not.toBeNull();
    expect(
      button(panel.target, conflictChoiceKey('confirmReload', 'operationChoice'))
    ).toBeNull();
    expect(button(panel.target, conflictChoiceKey('copyDraft', 'operationChoice'))).toBeNull();
    // And nothing has moved: no adoption, and the panel is still open.
    expect(panel.adoptions).toEqual([]);
    expect(panel.closed()).toBe(0);
    panel.stop();
  }); // End of the "both sides" case

  it('warns that the reload closes this panel, never that it replaces text', async () => {
    // **2c-4a-3b's verification of `reloadOutcome`.** This surface declares
    // `closesSurface` and drafts an `operationChoice`, so the shared line is the
    // one that promises no copy — `reloadClosesSurface` ends *copy it first if you
    // want to keep it*, and there is no control here that could.
    const panel = await conflicted();
    expect(says(panel.target, 'browser.saveOutcome.reloadAbandonsOperation')).toBe(true);
    expect(says(panel.target, 'browser.saveOutcome.reloadClosesSurface')).toBe(false);
    expect(says(panel.target, 'browser.saveOutcome.reloadDiscardsDraft')).toBe(false);
    // And what was retained is described as an operation, not as text.
    expect(says(panel.target, 'browser.saveOutcome.operationKeptInMemory')).toBe(true);
    expect(says(panel.target, 'browser.saveOutcome.draftKeptInMemory')).toBe(false);
    panel.stop();
  }); // End of the "surface-aware warning" case

  it('adopts the disk version and closes only when the reload is confirmed', async () => {
    const panel = await conflicted();

    expect(says(panel.target, 'browser.matchDeletion.reloadIdentifiesNoSnippet')).toBe(false);
    control(panel.target, conflictChoiceKey('reloadDiskVersion', 'operationChoice')).click();
    flushSync();

    // The second step: the warning that says what happens *here* — the window
    // crosses, this panel closes, and the snippet is not deleted.
    expect(says(panel.target, 'browser.matchDeletion.reloadIdentifiesNoSnippet')).toBe(true);
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
      // A refused adoption leaves the conflict on screen rather than reporting a
      // reload that did not happen.
      expect(says(panel.target, 'browser.saveOutcome.nothingWasWritten'), answer).toBe(
        closes === 0
      );
      panel.stop();
    } // End of the loop over the three adoption answers
  }); // End of the "three adoption answers" case

  it('stops offering the reload once the window has refused it, and says why', async () => {
    // **The 2c-4a-3a review's finding 3, from this screen.** The control the window
    // refused without a word is gone, and the sentence takes its place; *Keep
    // editing* stays and resets the step. Withholding it claims nothing about how a
    // later ask would be answered.
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
    expect(says(panel.target, 'browser.matchDeletion.reloadIdentifiesNoSnippet')).toBe(false);
    expect(panel.adoptions).toHaveLength(1);
    expect(panel.closed()).toBe(0);

    // And *Keep editing* gives the panel back, with the deletion still askable.
    control(panel.target, conflictChoiceKey('keepEditing', 'operationChoice')).click();
    flushSync();
    expect(says(panel.target, reloadUnavailableKey('operationChoice'))).toBe(false);
    expect(button(panel.target, 'browser.matchDeletion.request')).not.toBeNull();
    panel.stop();
  }); // End of the "refused reload stops being offered" case

  it('offers a way out that does not claim anything is being edited', async () => {
    // **2c-4a-3c's finding 10.2, on the screen that produced it.** This panel is
    // about a deletion: nobody typed anything and nothing is being edited, so the
    // raw editor's *Keep editing* named an activity the person never started.
    // `conflictChoiceKey` branches on the draft kind now, and this is the branch
    // seen through the markup rather than through the model.
    const panel = await conflicted();
    expect(button(panel.target, 'browser.saveOutcome.choice.keepOperation')).not.toBeNull();
    expect(button(panel.target, 'browser.rawSave.choice.keepEditing')).toBeNull();
    // And it is the same control: pressing it still dismisses the panel.
    control(panel.target, 'browser.saveOutcome.choice.keepOperation').click();
    flushSync();
    expect(says(panel.target, 'browser.saveOutcome.nothingWasWritten')).toBe(false);
    expect(button(panel.target, 'browser.matchDeletion.request')).not.toBeNull();
    panel.stop();
  }); // End of the "way out that claims no editing" case
}); // End of the "deletion panel's conflict" suite

describe('the deletion panel’s refused arm names what this surface drafts', () => {
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
    const panel = mountDeleter([{ result: REFUSED }]);
    control(panel.target, 'browser.matchDeletion.confirm').click();
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
}); // End of the "deletion panel's refused arm" suite

describe('the deletion panel asks for its outcome to be brought into view', () => {
  /*
   * **2c-4a-3c's findings 10.3 and 10.4, from this component's own markup.** The
   * decision is `./reveal.ts`'s and has its own suite; what only a mounted case can
   * say is that this file **binds** the two elements and **runs** the effect — both
   * of which can be deleted silently, and neither of which any model test can see.
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
    // jsdom leaves the property absent, so it is deleted rather than restored:
    // `reveal.test.ts` asserts that absence as the platform condition it guards.
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it('asks for the panel’s first line when a conflict appears', async () => {
    const panel = await conflicted();
    const outcome = panel.target.querySelector('[role="status"]');
    expect(outcome).not.toBeNull();
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]?.target).toBe(outcome);
    // `start`: the first line is *Nothing was written*, and that is the sentence
    // the window reading found a person could not see.
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
    // This surface reaches it by a route of its own: *Save anyway* records consent
    // and **re-raises the confirmation** — `confirmDelete` consumed the pending one
    // — so the refusal panel stays on screen and it is the second *Delete it*
    // that replaces `refused` with `saved` over the **same** bound element. While
    // all three arms answered one `'panel'` cue the effect's dependency did not
    // change, so it need not run and nothing ever asked for the new panel's first
    // line. The spy is cleared before the second result, so what is asserted
    // is a *new* reveal.
    const panel = mountDeleter([{ result: REFUSED }, { result: COMMITTED }]);
    control(panel.target, 'browser.matchDeletion.confirm').click();
    await settle();
    expect(says(panel.target, 'browser.saveOutcome.nothingWasWritten')).toBe(true);

    control(panel.target, 'browser.rawSave.choice.saveAnyway').click();
    flushSync();
    // Still the refusal, and the question with it: nothing has been sent again.
    expect(says(panel.target, 'browser.matchDeletion.question')).toBe(true);
    const refusedPanel = panel.target.querySelector('[role="status"]');
    expect(refusedPanel).not.toBeNull();

    scrolled.length = 0;
    control(panel.target, 'browser.matchDeletion.confirm').click();
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
}); // End of the "deletion panel asks for its outcome" suite

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
      duplicateMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
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
        // **The window's own adoption**, which no case in this suite reaches: it
        // never opens the conflict panel, and a conflict installs nothing until a
        // reload has been asked for *and* confirmed. The conflict suite above
        // records every call instead.
        adoptDiskVersion: (): DiskAdoptionOutcome => 'installed',
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

describe('the deletion panel’s *Keep my draft*', () => {
  it('draws the control and the line that stands beside it', () => {
    // **A mounted test proves a handler fires, not that a window draws.** What it
    // establishes is that the model names this choice for this surface, that the
    // panel turns that into a control, and that the sentence beside it is the
    // operation-choice one — nobody typed anything here, so the version that talks
    // about changes to fields would describe something the person never produced.
    return conflicted().then((panel) => {
      expect(button(panel.target, KEEP_MY_DRAFT)).not.toBeNull();
      expect(says(panel.target, 'browser.reapply.readyOperation')).toBe(true);
      expect(says(panel.target, 'browser.reapply.ready')).toBe(false);
      // And it sits above the destructive choice, which is the consult's Q6 order.
      const labels = [...panel.target.querySelectorAll('.choices button')].map((one) =>
        one.textContent?.trim()
      );
      expect(labels.indexOf(DICTIONARIES.en[KEEP_MY_DRAFT])).toBeLessThan(
        labels.indexOf(DICTIONARIES.en[conflictChoiceKey('reloadDiskVersion', 'operationChoice')])
      );
      panel.stop();
    });
  }); // End of the "control and readiness line" case

  it('refuses and adopts nothing when the evidence names no snippet', async () => {
    // The conflict this suite's other cases use carries `Unsupported`, which is
    // what a save that names nothing produces — so the transition refuses before it
    // asks the window to move anything, and the panel says both halves: that
    // nothing was applied, and which negative claim about the evidence stopped it.
    const panel = await conflicted();
    control(panel.target, KEEP_MY_DRAFT).click();
    flushSync();

    expect(says(panel.target, 'browser.reapply.manualResolution')).toBe(true);
    expect(says(panel.target, 'browser.reapply.obstacle.evidenceNotATarget')).toBe(true);
    // Decide first, adopt second: the window was never asked.
    expect(panel.adoptions).toEqual([]);
    // And the conflict is still on screen, with its choices, and nothing was sent.
    expect(says(panel.target, 'browser.saveOutcome.nothingWasWritten')).toBe(true);
    expect(button(panel.target, KEEP_MY_DRAFT)).not.toBeNull();
    expect(panel.calls).toHaveLength(1);
    expect(panel.closed()).toBe(0);
    panel.stop();
  }); // End of the "refusal adopts nothing" case

  it('rebuilds the deletion over the disk version and asks its own question again', async () => {
    // **Consult Q6: there is no second "are you sure?" merely because the reload
    // has one — the deletion's own confirmation is what a reapply hands back.** The
    // rebuilt session has nothing pending, so the request control returns and the
    // person answers a question about the snippet the new parse names.
    const panel = await conflictedWith(IDENTIFIED);
    control(panel.target, KEEP_MY_DRAFT).click();
    flushSync();

    expect(panel.adoptions).toHaveLength(1);
    expect(says(panel.target, 'browser.reapply.reapplied')).toBe(true);
    // The conflict panel is gone: the rebuilt session carries no outcome at all.
    expect(says(panel.target, 'browser.saveOutcome.nothingWasWritten')).toBe(false);
    expect(button(panel.target, KEEP_MY_DRAFT)).toBeNull();
    // Nothing was sent by the reapply itself.
    expect(panel.calls).toHaveLength(1);

    // The window really moved, which is what the stubbed adoption stands for.
    panel.reproject([DISK]);
    control(panel.target, 'browser.matchDeletion.request').click();
    flushSync();
    control(panel.target, 'browser.matchDeletion.confirm').click();
    await settle();

    expect(panel.calls).toHaveLength(2);
    // The identity and the base revision are both the newly parsed ones; nothing
    // from the parse this panel opened over is sent a second time.
    expect(panel.calls[1]?.id).toEqual(DISK.matches[0]?.id);
    expect(panel.calls[1]?.baseRevision).toBe(AFTER);
    panel.stop();
  }); // End of the "renewed confirmation" case

  it('refuses the renewed confirmation while the window still holds the old parse', async () => {
    // The half no model test can reach: `confirmDelete`'s live-projection argument
    // is read **here**, at the click, and a window that has not moved gives the
    // rebuilt snippet no identity at all. Nothing is sent.
    const panel = await conflictedWith(IDENTIFIED);
    control(panel.target, KEEP_MY_DRAFT).click();
    flushSync();
    control(panel.target, 'browser.matchDeletion.request').click();
    flushSync();
    control(panel.target, 'browser.matchDeletion.confirm').click();
    await settle();

    expect(says(panel.target, 'browser.matchDeletion.confirmationRefused')).toBe(true);
    expect(panel.calls).toHaveLength(1);
    panel.stop();
  }); // End of the "renewed confirmation refused" case

  it('says what happened when the window refuses to move, and keeps the panel', async () => {
    const panel = await conflictedWith(IDENTIFIED, 'refused');
    control(panel.target, KEEP_MY_DRAFT).click();
    flushSync();

    expect(says(panel.target, 'browser.reapply.adoptionRefused')).toBe(true);
    expect(says(panel.target, 'browser.reapply.reapplied')).toBe(false);
    // The conflict is still showing and the session was not replaced.
    expect(says(panel.target, 'browser.saveOutcome.nothingWasWritten')).toBe(true);
    expect(panel.calls).toHaveLength(1);
    expect(panel.closed()).toBe(0);
    panel.stop();
  }); // End of the "adoption refused" case
}); // End of the "deletion panel’s reapply" suite
