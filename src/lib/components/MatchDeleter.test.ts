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
import { flushSync, mount, unmount } from 'svelte';
import {
  externalConflictSource,
  saveConflictSource,
  standingConflictOf,
  type ConflictSource,
  type ExternalConflictObservation
} from '../browser/conflictSource';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeDocument,
  makeMatch,
  makeSummary,
  scriptedAcknowledgement,
  type ScriptedAcknowledgement
} from '../browser/fixtures';
import type { InvalidationStatus } from '../browser/invalidation';
import { matchKey } from '../browser/labels';
import {
  createBrowserState,
  type BrowserCommands,
  type BrowserState,
  type MatchSaveAnswer,
  type ObservationReceiver
} from '../browser/workspace.svelte';
import { DICTIONARIES, translate, type TranslationKey } from '../i18n/dictionaries';
import { locale } from '../stores/locale.svelte';
import type { CommandResult } from '../ipc/commands';
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
import MatchDeleter from './MatchDeleter.svelte';
import type { SurfaceBinding } from '../browser/surfaceReceivers';
import {
  arbitratedDelivery,
  retainedDelivery,
  type ObservationDelivery
} from '../browser/observationDelivery';
import { LOCALES, type Locale } from '../i18n/locale';
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
 * A binding whose two methods do nothing — the `reportReceiver` answer for a
 * mount that drives no delivery (Phase 2d-6-7a made the prop required; the
 * deliveries themselves are driven through the real pane in
 * `DetailPane.test.ts`).
 *
 * @returns The inert binding.
 */
function inertBinding(): SurfaceBinding {
  return { reportTarget: () => undefined, withdraw: () => undefined };
} // End of function inertBinding()

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
  /**
   * Hands the receiver this panel reported one sealed envelope, as the window's
   * registration would, and flushes — Phase 2d-6-7b. A replacing verdict also
   * becomes what the stand-in for `standingConflictFor` answers for the file, as
   * the window registers the origin it delivered.
   */
  readonly deliver: (delivery: ObservationDelivery) => void;
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
  // **The stand-in for `BrowserState.standingConflictFor`** — Phase 2d-6-6b. The
  // window registers a conflict's origin for its file when the command answers
  // `conflict`, and the reapply's live guard asks it at the end of its entry;
  // answering `null` would make every reapply refuse as superseded.
  const standing = new Map<DocumentId, ConflictSource>();
  // The receiver the panel reports, kept so a case can deliver to it (Phase
  // 2d-6-7b); the window's own registration is `DetailPane.test.ts`'s.
  let receiver: ObservationReceiver | null = null;
  const component = mount(MatchDeleter, {
    target,
    props: {
      acknowledgement: acknowledging.port,
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
        if (next?.result?.outcome === 'conflict') {
          standing.set(id.document, saveConflictSource(next.result));
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
      // 2c-4a-3b this surface offers the reload, so a case can press the two
      // controls that reach it and see exactly when — and whether — it is called.
      adoptDiskVersion: (conflict: ConflictModel<MatchId>): DiskAdoptionOutcome => {
        adoptions.push(conflict);
        return adoption;
      },
      standingConflictFor: (document: DocumentId): ConflictSource | null =>
        standing.get(document) ?? null,
      reportReceiver: (reported: ObservationReceiver): SurfaceBinding => {
        receiver = reported;
        return inertBinding();
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
 * Waits for the component's asynchronous handler to finish.
 *
 * A macrotask rather than a fixed number of microtask ticks.
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

  it('asks for the external panel when an observation raises a conflict (Phase 2d-6-7b)', () => {
    const panel = mountDeleter();
    scrolled.length = 0;
    panel.deliver(raisedBy(observed(5)));

    const external = panel.target.querySelector('.panel.external');
    expect(external).not.toBeNull();
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]?.target).toBe(external);
    expect(scrolled[0]?.block).toBe('start');

    // The second step points at the controls inside that panel.
    scrolled.length = 0;
    control(panel.target, conflictChoiceKey('reloadDiskVersion', 'operationChoice')).click();
    flushSync();
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]?.target).toBe(panel.target.querySelector('.panel.external .choices'));
    panel.stop();
  });

  it('reveals the external panel over a refusal kept as history, and its controls at the reload step (2d-6-7b review, finding 2)', async () => {
    // A refusal stays on screen as history when an observation raises a conflict
    // (entry 7). The active conflict is what the person must act on, so it is the
    // reveal's cue and target — and its second step is revealed too.
    const panel = mountDeleter([{ result: REFUSED }]);
    control(panel.target, 'browser.matchDeletion.confirm').click();
    await settle();
    expect(panel.target.textContent).toContain(DICTIONARIES.en['browser.matchDeletion.findings']);
    scrolled.length = 0;

    panel.deliver(raisedBy(observed(5)));

    const external = panel.target.querySelector('.panel.external');
    expect(external).not.toBeNull();
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]?.target).toBe(external);

    scrolled.length = 0;
    const reload = [...(external?.querySelectorAll('button') ?? [])].find(
      (one) => one.textContent?.trim() === DICTIONARIES.en[conflictChoiceKey('reloadDiskVersion', 'operationChoice')]
    );
    reload?.click();
    flushSync();
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]?.target).toBe(panel.target.querySelector('.panel.external .choices'));
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
      saveRawDocument: vi.fn(async () => refusal),
      drainExternalChanges: vi.fn(async () => refusal)
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
        acknowledgement: acknowledging.port,
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
        standingConflictFor: (document: DocumentId): ConflictSource | null =>
          state.standingConflictFor(document),
        reportReceiver: inertBinding,
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
    // Nothing was written, so nothing may have closed this panel either. The
    // `close` callback is a spy rather than a real unmount, so continued local
    // rendering does not prove the surface was not told to go away.
    expect(panel.closed()).toBe(0);
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

describe('what the deletion panel says about recovery', () => {
  /*
   * **2c-4c-3b's negative half, on the first of its four surfaces.** Step 3a proved
   * the positive half — that the match editor and the creator reach a recovery
   * create — and this is the other side of the consult's step-3 matrix: that a
   * surface whose draft is an operation offers **neither copy nor save-as-new**, and
   * that nothing recovery draws here spends the conflict it is drawn beside.
   *
   * `recovery.test.ts` holds the same claims at the value level. What only a mounted
   * panel can hold is that this surface **mounts the shared renderer**, that it draws
   * no control, and that no recovery form is mounted here at all.
   */

  /** The reason a deletion's draft kind produces, so a rename is a compile error. */
  const REASON: RecoveryUnavailable = 'operationDraft';

  it('says nothing at all until something has gone wrong', () => {
    // The permanent-paragraph defect 2c-4c-3b's model change closes. Before it,
    // `recoveryAvailability` answered `operationDraft` for this surface whatever was
    // happening, so an explanation of a version on disk would have stood on a screen
    // where no version on disk was in dispute.
    const panel = mountDeleter();
    // The shared renderer is mounted and drew nothing, which is its own decision
    // and not a condition this surface carries.
    expect(recoveryNote(panel.target)).toBeNull();
    expect(says(panel.target, recoveryUnavailableKey('operationDraft'))).toBe(false);
    panel.stop();
  });

  it('offers neither a copy nor a save-as-new, and says why instead', async () => {
    const panel = await conflicted();

    // The reason, and the surface's own: the raw editor's sentence is about a whole
    // file and would be false here. `recoveryNote` is what says the shared renderer
    // drew it; `says` alone could not tell that from a paragraph of this file's own.
    expect(recoveryNote(panel.target)).toBe(REASON);
    expect(says(panel.target, recoveryUnavailableKey('operationDraft'))).toBe(true);
    expect(says(panel.target, recoveryUnavailableKey('wholeDocumentDraft'))).toBe(false);
    // No save-as-new. The control 3a drew on the two creating surfaces is the one
    // named by `recoveryChoiceKey`, and it is not here — nor is the form it opens.
    expect(button(panel.target, recoveryChoiceKey('createFromSupportedFields'))).toBeNull();
    expect(says(panel.target, 'browser.recovery.label')).toBe(false);
    expect(says(panel.target, 'browser.recovery.transferHeading')).toBe(false);
    expect(says(panel.target, 'browser.recovery.destination')).toBe(false);
    // And no copy, which is `conflictChoicesFor`'s decision from what this surface
    // drafts rather than anything recovery added.
    expect(button(panel.target, conflictChoiceKey('copyDraft', 'operationChoice'))).toBeNull();
    // Nothing was written and nothing moved.
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

    // **A reapply that resolved nothing.** The sentence and the conflict are both
    // still there, and the window was never asked to move.
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

    // **A reload asked for and not confirmed.** The destructive choice is a second
    // step away, and until it is taken nothing has been spent.
    const atTheWarning = await conflicted();
    control(atTheWarning.target, conflictChoiceKey('reloadDiskVersion', 'operationChoice')).click();
    flushSync();
    expect(recoveryNote(atTheWarning.target)).toBe(REASON);
    expect(atTheWarning.adoptions).toEqual([]);
    expect(atTheWarning.calls).toHaveLength(1);
    expect(atTheWarning.closed()).toBe(0);
    atTheWarning.stop();

    // **A reload the window refused.** The adoption was spent and answered `refused`,
    // so the conflict stayed, and the sentence stayed with it.
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
    // The one thing that ends the sentence without a commit is the person's own
    // dismissal — and it ends the conflict too, which is the point: recovery is
    // about a conflict, and there is no longer one.
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
}); // End of the "what the deletion panel says about recovery" suite

/** The revision an observation of the deleter's file reads. */
const OBSERVED: ContentRevision = 'c'.repeat(64);

/** The revision a later observation of the same file reads. */
const OBSERVED_LATER: ContentRevision = 'd'.repeat(64);

/** The whole file text an observation carried, distinguishable from {@link DISK_TEXT}. */
const OBSERVED_TEXT = 'matches:\n  - trigger: y\n    replace: elsewhere\n';

/** A word that appears in {@link OBSERVED_TEXT} and nowhere else on the screen. */
const OBSERVED_MARKER = 'elsewhere';

/**
 * The deleter's file as another writer left it: the same two snippets under a new
 * parse, with new arena nodes.
 *
 * @param revision - The revision the observation read.
 * @returns The disk projection.
 */
function observedFile(revision: ContentRevision = OBSERVED): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision,
    matches: [
      makeMatch({ node: 20, document: 2, revision, trigger: ':sig' }),
      makeMatch({ node: 21, document: 2, revision, trigger: ':date' })
    ]
  });
} // End of function observedFile()

/**
 * One narrowed observation of the deleter's file — Phase 2d-6-7b.
 *
 * A fresh object every call: the memo in `../browser/conflictSource.ts` and a
 * session's wait are both keyed on identity.
 *
 * @param sequence - The sequence it was admitted under.
 * @param revision - The revision it read.
 * @param withTwin - Whether it carries a correspondence naming the first
 *   snippet's twin, so a reapply can rebuild over it.
 * @returns The observation.
 */
function observed(
  sequence: number,
  revision: ContentRevision = OBSERVED,
  withTwin = false
): ExternalConflictObservation {
  const disk = observedFile(revision);
  return {
    sequence,
    document: 2,
    previousRevision: BASE,
    diskRevision: revision,
    diskText: OBSERVED_TEXT,
    disk,
    findings: [],
    correspondences: withTwin
      ? {
          base_revision: BASE,
          disk_revision: revision,
          entries: [
            {
              base: file().matches[0]!.id,
              exact: { Identified: { target: disk.matches[0]! } },
              editor: { Refused: { reason: 'AmbiguousTrigger' } }
            }
          ]
        }
      : null
  };
} // End of function observed()

/**
 * The envelope a window seals for a first observation of the file.
 *
 * @param seen - The observation.
 * @param uncertain - Whether the last settled write may have written.
 * @returns The `raised` (or `raisedWithoutReload`) envelope.
 */
function raisedBy(seen: ExternalConflictObservation, uncertain = false): ObservationDelivery {
  return arbitratedDelivery(null, seen, uncertain);
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
 * The button labelled with one key's rendering in one language, insisted upon.
 *
 * @param target - Where the component was mounted.
 * @param lang - The language the case runs in.
 * @param key - The key holding the label.
 * @returns The button.
 */
function controlIn(target: HTMLElement, lang: Locale, key: TranslationKey): HTMLButtonElement {
  const label = translate(lang, key);
  const found = [...target.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === label
  );
  if (found === undefined) {
    throw new Error(`this case needs the control labelled ${label}`);
  }
  return found;
} // End of function controlIn()

/**
 * The external conflict's own panel, insisted upon.
 *
 * **Conflict choices are pressed inside it and never found on the whole panel**:
 * until Phase 2d-6-11b the header's close control and the operation's *keep
 * editing* choice read identically in Spanish (*Dejarlo como está*,
 * `docs/decisions/2d-6-7b-notes.md` §4 item 1), so a search of the whole panel found
 * the close control first. The labels now differ (`bilingualFixtures.test.ts` pins
 * that), and pressing inside the panel still keeps a later collision from being
 * papered over by pressing whichever comes first.
 *
 * @param target - Where the component was mounted.
 * @returns The panel.
 */
function externalPanel(target: HTMLElement): HTMLElement {
  const found = target.querySelector<HTMLElement>('.panel.external');
  if (found === null) {
    throw new Error('this case needs the external conflict panel');
  }
  return found;
} // End of function externalPanel()

/**
 * Whether a button labelled with one key's rendering in one language is drawn.
 *
 * @param target - Where the component was mounted.
 * @param lang - The language the case runs in.
 * @param key - The key holding the label.
 * @returns `true` when one is.
 */
function offersIn(target: HTMLElement, lang: Locale, key: TranslationKey): boolean {
  const label = translate(lang, key);
  return [...target.querySelectorAll('button')].some(
    (candidate) => candidate.textContent?.trim() === label
  );
} // End of function offersIn()

/**
 * The text of the external conflict's own panel, or `null` when none is drawn.
 *
 * @param target - Where the component was mounted.
 * @returns The panel's text.
 */
function externalText(target: HTMLElement): string | null {
  return target.querySelector('.panel.external')?.textContent ?? null;
} // End of function externalText()

describe('the deletion panel under an external conflict, in English and Spanish — Phase 2d-6-7b', () => {
  // **2d-6-7's acceptance for this panel, read off the screen** (the 2d-6 record's
  // §3 entries 23, 34 and 35). The receiver is the one the panel reported, handed
  // envelopes the real `arbitratedDelivery` sealed; the window's own registration
  // and arbitration are `DetailPane.test.ts`'s. Every sentence is pinned to its
  // dictionary value in the case's locale: that protects which code is drawn
  // where, never the quality of a translation.

  it.each(LOCALES)('holds the question while a reading waits, refuses to send it, and says why (%s)', (lang) => {
    locale.setOverride(lang);
    const panel = mountDeleter([{ result: COMMITTED }]);
    expect(offersIn(panel.target, lang, 'browser.matchDeletion.confirm')).toBe(true);

    panel.deliver(retainedDelivery(observed(5)));

    // The question stays — a held reading withdraws nothing (entry 11) — but the
    // answer that would send is refused. The sentence that says why is the
    // pane's since Phase 2d-6-9b-2, drawn once above this panel, never this one's.
    const confirm = controlIn(panel.target, lang, 'browser.matchDeletion.confirm');
    expect(confirm.disabled).toBe(true);
    expect(panel.target.textContent).not.toContain(translate(lang, 'browser.externalConflict.observationRetained'));
    confirm.click();
    flushSync();
    expect(panel.calls).toEqual([]);
    // Never the stale-reading sentence: this window has read nothing again.
    expect(panel.target.textContent).not.toContain(
      translate(lang, 'browser.matchDeletion.confirmationRefused')
    );
    expect(externalText(panel.target)).toBeNull();
    panel.stop();
  }); // End of the "held question" case

  it.each(LOCALES)('draws the origin, evidence and comparison, and withdraws the question (%s)', (lang) => {
    locale.setOverride(lang);
    const panel = mountDeleter([{ result: COMMITTED }]);
    expect(offersIn(panel.target, lang, 'browser.matchDeletion.confirm')).toBe(true);

    panel.deliver(raisedBy(observed(5)));

    // **Direct submission is refused**: the question is withdrawn (entry 12), and
    // nothing takes its place that could send.
    expect(offersIn(panel.target, lang, 'browser.matchDeletion.confirm')).toBe(false);
    expect(offersIn(panel.target, lang, 'browser.matchDeletion.request')).toBe(false);
    // The origin, the observation's own lines, its one revision — and none of the
    // save arm's: there was no save, so no *expected* and no *found*.
    const shown = externalText(panel.target);
    expect(shown).not.toBeNull();
    expect(shown).toContain(translate(lang, 'browser.conflictOrigin.changedWhileOpen'));
    expect(shown).toContain(translate(lang, 'browser.externalConflict.fileChangedWhileOpen'));
    expect(shown).toContain(translate(lang, 'browser.saveOutcome.operationKeptInMemory'));
    expect(shown).toContain(translate(lang, 'browser.saveOutcome.reloadAbandonsOperation'));
    expect(shown).toContain(
      translate(lang, 'browser.externalConflict.revisionObserved', { revision: OBSERVED })
    );
    expect(panel.target.textContent).not.toContain(translate(lang, 'browser.conflictOrigin.refusedSave'));
    expect(panel.target.textContent).not.toContain(translate(lang, 'browser.saveOutcome.changedElsewhere'));
    expect(panel.target.textContent).not.toContain(
      translate(lang, 'browser.matchDeletion.revisionExpected', { revision: BASE })
    );
    // The comparison the save panel has (entry 23): the operation, the whole disk
    // text, the readiness line and the three choices.
    expect(shown).toContain(translate(lang, 'browser.saveOutcome.retainedOperation'));
    expect(shown).toContain(translate(lang, 'browser.saveOutcome.operation.deleteSnippet'));
    expect(shown).toContain(translate(lang, 'browser.saveOutcome.operationIdentityIsOld'));
    expect(shown).toContain(translate(lang, 'browser.saveOutcome.diskVersion'));
    expect(shown).toContain(OBSERVED_MARKER);
    expect(shown).toContain(translate(lang, 'browser.reapply.readyOperation'));
    for (const choice of ['keepEditing', 'keepMyDraft', 'reloadDiskVersion'] as const) {
      expect(offersIn(externalPanel(panel.target), lang, conflictChoiceKey(choice, 'operationChoice'))).toBe(true);
    } // End of the loop over the three offered choices
    // Recovery is a reason on this surface, drawn by the shared renderer.
    expect(recoveryNote(panel.target)).toBe('operationDraft');
    expect(panel.target.textContent).toContain(translate(lang, recoveryUnavailableKey('operationDraft')));
    expect(panel.calls).toEqual([]);
    expect(panel.adoptions).toEqual([]);
    panel.stop();
  }); // End of the "origin and comparison" case

  it.each(LOCALES)('keeps the conflict through Leave this as it is, and resets the reload step (%s)', (lang) => {
    locale.setOverride(lang);
    const panel = mountDeleter();
    panel.deliver(raisedBy(observed(5)));
    controlIn(externalPanel(panel.target), lang, conflictChoiceKey('reloadDiskVersion', 'operationChoice')).click();
    flushSync();
    expect(externalText(panel.target)).toContain(
      translate(lang, 'browser.matchDeletion.reloadIdentifiesNoSnippet')
    );
    expect(offersIn(externalPanel(panel.target), lang, conflictChoiceKey('confirmReload', 'operationChoice'))).toBe(true);

    controlIn(externalPanel(panel.target), lang, conflictChoiceKey('keepEditing', 'operationChoice')).click();
    flushSync();

    // The warning is gone and the first step is back; the conflict stands (entry
    // 9), so nothing can be asked or sent.
    expect(externalText(panel.target)).not.toContain(
      translate(lang, 'browser.matchDeletion.reloadIdentifiesNoSnippet')
    );
    expect(offersIn(externalPanel(panel.target), lang, conflictChoiceKey('reloadDiskVersion', 'operationChoice'))).toBe(true);
    expect(offersIn(panel.target, lang, 'browser.matchDeletion.request')).toBe(false);
    expect(panel.adoptions).toEqual([]);
    expect(panel.closed()).toBe(0);
    panel.stop();
  }); // End of the "keep editing" case

  it.each(
    LOCALES.flatMap((lang) =>
      (['installed', 'alreadyThere', 'refused'] as const).map((adoption) => [lang, adoption] as const)
    )
  )('reloads in two steps and closes on what the window answers (%s, %s)', (lang, adoption) => {
    locale.setOverride(lang);
    const panel = mountDeleter([], file(), 0, adoption);
    const seen = observed(5);
    panel.deliver(raisedBy(seen));
    controlIn(externalPanel(panel.target), lang, conflictChoiceKey('reloadDiskVersion', 'operationChoice')).click();
    flushSync();
    expect(panel.adoptions).toEqual([]);
    controlIn(externalPanel(panel.target), lang, conflictChoiceKey('confirmReload', 'operationChoice')).click();
    flushSync();

    // One adoption, of this observation's conflict and no other.
    expect(panel.adoptions).toHaveLength(1);
    expect(panel.adoptions[0]?.source).toBe(externalConflictSource(seen));
    if (adoption === 'refused') {
      // Nothing closes over a window that did not move, and the control that has
      // just gone is replaced by the reason.
      expect(panel.closed()).toBe(0);
      expect(externalText(panel.target)).toContain(translate(lang, reloadUnavailableKey('operationChoice')));
      expect(offersIn(externalPanel(panel.target), lang, conflictChoiceKey('reloadDiskVersion', 'operationChoice'))).toBe(false);
    } else {
      expect(panel.closed()).toBe(1);
    }
    expect(panel.calls).toEqual([]);
    panel.stop();
  }); // End of the "two-step reload" case

  it.each(LOCALES)('rebuilds over the disk version through Keep what I asked for, and asks again (%s)', async (lang) => {
    locale.setOverride(lang);
    const panel = mountDeleter([{ result: COMMITTED }]);
    const seen = observed(5, OBSERVED, true);
    panel.deliver(raisedBy(seen));

    controlIn(externalPanel(panel.target), lang, conflictChoiceKey('keepMyDraft', 'operationChoice')).click();
    flushSync();

    // The window was asked to move once, for this conflict; the report says what
    // happened, the external panel is gone, and the question has to be asked again.
    expect(panel.adoptions.map((one) => one.source)).toEqual([externalConflictSource(seen)]);
    expect(panel.target.querySelector('.panel.reapply')?.textContent).toContain(
      translate(lang, 'browser.reapply.reapplied')
    );
    expect(externalText(panel.target)).toBeNull();
    expect(panel.calls).toEqual([]);
    controlIn(panel.target, lang, 'browser.matchDeletion.request').click();
    flushSync();
    panel.reproject([observedFile()]);
    controlIn(panel.target, lang, 'browser.matchDeletion.confirm').click();
    await settle();
    // What goes out is the twin, against the version the reapply adopted.
    expect(panel.calls).toHaveLength(1);
    expect(panel.calls[0]?.id).toEqual(observedFile().matches[0]!.id);
    expect(panel.calls[0]?.baseRevision).toBe(OBSERVED);
    panel.stop();
  }); // End of the "reapply rebuilds" case

  it.each(LOCALES)('refuses Keep what I asked for without evidence, says why, and keeps the conflict (%s)', (lang) => {
    locale.setOverride(lang);
    const panel = mountDeleter();
    panel.deliver(raisedBy(observed(5)));

    controlIn(externalPanel(panel.target), lang, conflictChoiceKey('keepMyDraft', 'operationChoice')).click();
    flushSync();

    const report = panel.target.querySelector('.panel.reapply')?.textContent ?? '';
    expect(report).toContain(translate(lang, 'browser.reapply.manualResolution'));
    expect(report).toContain(translate(lang, 'browser.reapply.externalEvidence.noCorrespondence'));
    expect(externalText(panel.target)).not.toBeNull();
    expect(panel.adoptions).toEqual([]);
    expect(offersIn(panel.target, lang, 'browser.matchDeletion.request')).toBe(false);
    panel.stop();
  }); // End of the "reapply refused" case

  it.each(LOCALES)('withdraws the reload warning when a later reading supersedes the conflict (%s)', (lang) => {
    locale.setOverride(lang);
    const panel = mountDeleter();
    const first = observed(5);
    panel.deliver(raisedBy(first));
    controlIn(externalPanel(panel.target), lang, conflictChoiceKey('reloadDiskVersion', 'operationChoice')).click();
    flushSync();
    expect(offersIn(externalPanel(panel.target), lang, conflictChoiceKey('confirmReload', 'operationChoice'))).toBe(true);

    panel.deliver(supersededBy(first, observed(6, OBSERVED_LATER)));

    // Entry 12: the confirmation collected for the first conflict is not
    // spendable against this one, and its warning does not stay on screen.
    expect(offersIn(externalPanel(panel.target), lang, conflictChoiceKey('confirmReload', 'operationChoice'))).toBe(false);
    expect(offersIn(externalPanel(panel.target), lang, conflictChoiceKey('reloadDiskVersion', 'operationChoice'))).toBe(true);
    const shown = externalText(panel.target) ?? '';
    expect(shown).not.toContain(translate(lang, 'browser.matchDeletion.reloadIdentifiesNoSnippet'));
    expect(shown).toContain(
      translate(lang, 'browser.externalConflict.revisionObserved', { revision: OBSERVED_LATER })
    );
    expect(shown).not.toContain(
      translate(lang, 'browser.externalConflict.revisionObserved', { revision: OBSERVED })
    );
    expect(panel.adoptions).toEqual([]);
    panel.stop();
  }); // End of the "supersession" case

  it.each(LOCALES)('withholds the reload and the reapply while an earlier write’s outcome is unknown (%s)', (lang) => {
    locale.setOverride(lang);
    const panel = mountDeleter();
    panel.deliver(raisedBy(observed(5), true));

    // The sentence is the pane's since Phase 2d-6-9b-2; this panel draws the
    // acknowledgement instead (the suite at the end of this file).
    expect(panel.target.textContent).not.toContain(translate(lang, 'browser.externalConflict.writeOutcomeUnknown'));
    expect(offersIn(externalPanel(panel.target), lang, 'browser.externalConflict.action.acknowledgeSnapshot')).toBe(true);
    expect(externalText(panel.target)).not.toBeNull();
    expect(offersIn(externalPanel(panel.target), lang, conflictChoiceKey('keepEditing', 'operationChoice'))).toBe(true);
    expect(offersIn(externalPanel(panel.target), lang, conflictChoiceKey('keepMyDraft', 'operationChoice'))).toBe(false);
    expect(offersIn(externalPanel(panel.target), lang, conflictChoiceKey('reloadDiskVersion', 'operationChoice'))).toBe(false);
    expect(externalText(panel.target)).not.toContain(translate(lang, 'browser.reapply.readyOperation'));
    panel.stop();
  }); // End of the "unknown outcome" case

  it.each(LOCALES)('keeps its session across a change of language (%s)', (lang) => {
    locale.setOverride(lang);
    const panel = mountDeleter();
    panel.deliver(raisedBy(observed(5)));
    controlIn(externalPanel(panel.target), lang, conflictChoiceKey('reloadDiskVersion', 'operationChoice')).click();
    flushSync();

    const other: Locale = lang === 'en' ? 'es' : 'en';
    locale.setOverride(other);
    flushSync();

    // The same step of the same conflict, now in the other language.
    const shown = externalText(panel.target) ?? '';
    expect(shown).toContain(translate(other, 'browser.conflictOrigin.changedWhileOpen'));
    expect(shown).toContain(translate(other, 'browser.matchDeletion.reloadIdentifiesNoSnippet'));
    expect(offersIn(externalPanel(panel.target), other, conflictChoiceKey('confirmReload', 'operationChoice'))).toBe(true);
    panel.stop();
  }); // End of the "language switch" case

  it.each(LOCALES)('names a save as the origin of a save conflict, beside its three revisions (%s)', async (lang) => {
    locale.setOverride(lang);
    const panel = mountDeleter([{ result: CONFLICTED }]);
    controlIn(panel.target, lang, 'browser.matchDeletion.confirm').click();
    await settle();

    expect(panel.target.textContent).toContain(translate(lang, 'browser.conflictOrigin.refusedSave'));
    expect(panel.target.textContent).not.toContain(translate(lang, 'browser.conflictOrigin.changedWhileOpen'));
    expect(externalText(panel.target)).toBeNull();
    panel.stop();
  }); // End of the "save origin" case
}); // End of the "deletion panel under an external conflict" suite

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
const RELOAD_CHOICE = conflictChoiceKey('reloadDiskVersion', 'operationChoice');

describe('The deletion panel acknowledges an unknown write outcome on its own panel, in English and Spanish — Phase 2d-6-9b-2', () => {
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
    const mounted = mountDeleter();
    return mounted;
  } // End of function opened()

  /**
   * One observation of the panel's file.
   *
   * @returns A fresh observation, so its source is its own.
   */
  function seenChange(): ExternalConflictObservation {
    return observed(5);
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
    expect(text.indexOf('elsewhere')).toBeGreaterThanOrEqual(0);
    expect(text.indexOf('elsewhere')).toBeLessThan(text.indexOf(translate(lang, ACKNOWLEDGE_SNAPSHOT)));
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
