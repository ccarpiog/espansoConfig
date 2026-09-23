/**
 * @vitest-environment jsdom
 *
 * The reconciliation-status adapters under a real Svelte effect — Phase
 * 2d-6-9a's review fix round (`docs/reviews/phase-2d-6-9a.md`).
 *
 * A `.svelte.test.ts` file because the property under test is **reactive
 * invalidation**, which only a rune can observe: a `$derived` over
 * `fileFactsOf` in `./reconciliationStatus.ts` is recomputed on a read only when
 * a signal it read has moved, so a table this state keeps in a plain `Map` or
 * `Set` leaves it answering the snapshot it first took. The plain-`.ts` suite
 * beside this one calls the adapters directly and cannot see that.
 *
 * **jsdom, and only for the runtime.** Under `environment: 'node'` Svelte resolves
 * its server build, where no effect ever runs; this file mounts no component and
 * touches no DOM, exactly like `reveal.test.ts`, and opts in so the client
 * runtime schedules the effect it observes through. It declares its `invoke`
 * guard below (entry 37).
 *
 * The second finding is here too because it is reached through the same real
 * state: an acknowledgement the decision offered as enabled while
 * `BrowserState.uncertaintyAcknowledgementFor` in `./workspace.svelte.ts` could
 * not mint one.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers in this file do.
 */

import { flushSync } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CommandResult } from '../ipc/commands';
import type {
  DocumentId,
  DocumentView,
  SaveResult,
  WorkspaceSummary
} from '../ipc/types';
import type { ExternalConflictObservation } from './conflictSource';
import { makeDocument, makeSummary } from './fixtures';
import {
  decideFileReconciliation,
  fileFactsOf,
  workspaceFactsOf,
  type FileReconciliationFacts
} from './reconciliationStatus';
import { createBrowserState, type BrowserCommands, type BrowserState } from './workspace.svelte';

/** The Tauri boundary, replaced and held at zero, as in `workspace.test.ts`. */
const { invoked } = vi.hoisted(() => ({ invoked: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: readonly unknown[]): Promise<never> => {
    invoked(...args);
    return Promise.reject(new Error('this suite invokes no command'));
  }
}));

afterEach(() => {
  expect(invoked).not.toHaveBeenCalled();
  invoked.mockClear();
});

/** A raw save that failed after the rename may have happened (`workspace.test.ts`'s fixture). */
const WRITE_MAY_HAVE_HAPPENED: CommandResult<SaveResult> = {
  ok: false,
  failure: {
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
  }
} as unknown as CommandResult<SaveResult>;

/**
 * One external observation of file 2, from `rev-a` to `rev-c`.
 *
 * @returns The narrowed observation.
 */
function observation(): ExternalConflictObservation {
  return {
    sequence: 5,
    document: 2,
    previousRevision: 'rev-a',
    diskRevision: 'rev-c',
    diskText: 'matches: []\n',
    disk: makeDocument({ id: 2, revision: 'rev-c' }),
    findings: [],
    correspondences: null
  } as unknown as ExternalConflictObservation;
} // End of function observation()

/**
 * Commands over one file (2), whose raw save answers when the test says so.
 *
 * @param answers - The raw saves' answers, each a promise the test resolves.
 * @returns The commands.
 */
function commandsOver(answers: Promise<CommandResult<SaveResult>>[]): BrowserCommands {
  const refused = async (): Promise<CommandResult<never>> => ({
    ok: false,
    failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
  });
  const summary = { root: '/config', documents: 1, match_files: 1 } as unknown as WorkspaceSummary;
  const document = makeDocument({ id: 2, revision: 'rev-a' });
  return {
    openWorkspace: async () => ({ ok: true, value: summary }),
    listDocuments: async () => ({ ok: true, value: [makeSummary({ id: 2 })] }),
    getDocument: async (): Promise<CommandResult<DocumentView>> => ({ ok: true, value: document }),
    reloadDocument: async (): Promise<CommandResult<DocumentView>> => ({ ok: true, value: document }),
    documentText: async () => ({ ok: true, value: 'matches: []\n' }),
    saveRawDocument: () => answers.shift() ?? refused(),
    getMatch: refused,
    moveMatch: refused,
    saveMatch: refused,
    createMatch: refused,
    deleteMatch: refused,
    duplicateMatch: refused,
    drainExternalChanges: refused
  } as unknown as BrowserCommands;
} // End of function commandsOver()

/**
 * A promise and the function that resolves it.
 *
 * @returns Both.
 */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
} // End of function deferred()

/**
 * Lets every pending microtask and macrotask run once.
 *
 * @returns When they have.
 */
async function settle(): Promise<void> {
  await new Promise((done) => setTimeout(done, 0));
} // End of function settle()

/**
 * File 2's facts as the last value an `$effect` computed, inside an effect root.
 *
 * **An effect, not a bare `$derived` read.** A derived read outside any reaction
 * may simply be recomputed on the read, which would pass whether or not anything
 * invalidated it — the first draft of this helper did exactly that, and passed
 * before the fix. An effect re-runs only when a signal it read has moved, and
 * `flushSync` runs the re-runs that are due, so what `read` answers is what a
 * mounted panel would be showing.
 *
 * @param state - The real state.
 * @returns The reader and the root's cleanup.
 */
function derivedFacts(state: BrowserState): {
  read: () => FileReconciliationFacts;
  stop: () => void;
} {
  let seen: FileReconciliationFacts | null = null;
  const stop = $effect.root(() => {
    $effect(() => {
      seen = fileFactsOf(state, 2 as DocumentId);
    });
  });
  return {
    read: () => {
      flushSync();
      if (seen === null) {
        throw new Error('the effect never ran');
      }
      return seen;
    },
    stop
  };
} // End of function derivedFacts()

describe('the adapters under an effect (review finding 1)', () => {
  it('follow a write in flight, an uncertainty hold, a standing origin and its acknowledgement', async () => {
    const answer = deferred<CommandResult<SaveResult>>();
    const state = createBrowserState(commandsOver([answer.promise]), () => undefined);
    await state.open(null);
    const facts = derivedFacts(state);
    expect(facts.read().writeInFlight).toBe(false);

    const saving = state.saveRawDocument(2, 'rev-a', 'matches: []\n', { accepted: [] });
    expect(state.writeInFlight(2)).toBe(true);
    expect(facts.read().writeInFlight).toBe(true);

    answer.resolve(WRITE_MAY_HAVE_HAPPENED);
    await saving;
    await settle();
    expect(state.writeOutcomeUncertain(2)).toBe(true);
    expect(facts.read()).toMatchObject({ writeInFlight: false, uncertaintyUnresolved: true });

    expect(state.observeExternalChange(observation()).verdict.kind).toBe('raisedWithoutReload');
    const source = state.standingConflictFor(2);
    expect(source).not.toBeNull();
    expect(facts.read().acknowledgement).toEqual({ kind: 'eligible' });

    const token = state.uncertaintyAcknowledgementFor(source!);
    expect(state.acknowledgeWriteUncertainty(token!)).toEqual({ kind: 'acknowledged' });
    expect(facts.read().uncertaintyUnresolved).toBe(false);
    facts.stop();
  });

  it('follow a surface registered over the file and its lease dropped', async () => {
    const state = createBrowserState(commandsOver([]), () => undefined);
    await state.open(null);
    const facts = derivedFacts(state);
    expect(facts.read().surfaceOpen).toBe(false);
    const lease = state.registerWriteSurface(
      { kind: 'rawEditor', target: { kind: 'document', document: 2 } },
      () => undefined
    );
    expect(facts.read().surfaceOpen).toBe(true);
    lease();
    expect(facts.read().surfaceOpen).toBe(false);
    facts.stop();
  });

  it('follow a held observation and its release', async () => {
    const answer = deferred<CommandResult<SaveResult>>();
    const state = createBrowserState(commandsOver([answer.promise]), () => undefined);
    await state.open(null);
    const facts = derivedFacts(state);
    const saving = state.saveRawDocument(2, 'rev-a', 'matches: []\n', { accepted: [] });
    expect(state.observeExternalChange(observation()).verdict.kind).toBe('retained');
    expect(facts.read().observationRetained).toBe(true);
    answer.resolve(WRITE_MAY_HAVE_HAPPENED);
    await saving;
    await settle();
    expect(state.retainedObservationFor(2)).toBeNull();
    expect(facts.read().observationRetained).toBe(false);
    facts.stop();
  });
}); // End of the "adapters under an effect" suite

describe('the acknowledgement control against the mint (review finding 2)', () => {
  it('is disabled, with the mint’s refusal, when no token can be minted', async () => {
    // The reviewer's reproduction: an observation retained during a write that
    // then answers `may_have_written`. The settlement releases it at its arrival
    // generation, a conflict stands and the hold stands — and the mint refuses.
    const answer = deferred<CommandResult<SaveResult>>();
    const state = createBrowserState(commandsOver([answer.promise]), () => undefined);
    await state.open(null);
    const saving = state.saveRawDocument(2, 'rev-a', 'matches: []\n', { accepted: [] });
    expect(state.observeExternalChange(observation()).verdict.kind).toBe('retained');
    answer.resolve(WRITE_MAY_HAVE_HAPPENED);
    await saving;
    await settle();
    const source = state.standingConflictFor(2);
    expect(source).not.toBeNull();
    expect(state.writeOutcomeUncertain(2)).toBe(true);
    const minted = state.uncertaintyAcknowledgementFor(source!);

    const decision = decideFileReconciliation(workspaceFactsOf(state), fileFactsOf(state, 2));
    const control = decision.controls.find((each) => each.control === 'acknowledgeUncertainty');
    // The mint refuses: the failed save's own re-read replaced the projection
    // after the held observation arrived, so its origin is outlived.
    expect(minted).toBeNull();
    expect(state.uncertaintyAcknowledgementEligibility(2)).toEqual({
      kind: 'ineligible',
      reason: 'projectionReplaced'
    });
    expect(control).toEqual({
      control: 'acknowledgeUncertainty',
      enabled: false,
      reason: 'projectionReplaced'
    });
  });
}); // End of the "acknowledgement control against the mint" suite
