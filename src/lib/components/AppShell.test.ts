/** @vitest-environment jsdom */

/**
 * The shell, mounted as the shipped window mounts it — Phase 2d-5-7a.
 *
 * **One claim, and it is the lifetime contract.** `AppShell.svelte` builds the
 * browser state over the **real** composition — `REAL_COMMANDS`,
 * `REAL_BACKUP_COMMANDS`, `reportIpcFailure`, `REAL_RECONCILIATION_EVENTS` — and
 * its `onMount` calls `start()` and returns `dispose()`. Nothing in TypeScript
 * makes a host do either: `start()` unused is a coordinator that registers
 * nothing, and `dispose()` unreturned is an unused method rather than a
 * disposal. So the whole of this file is counting: exactly one registration per
 * mount, exactly one unlisten per registration, whichever order registration and
 * disposal land in (ruling 16, `docs/decisions/2d-5-split-notes.md` §3).
 *
 * **What is mocked is the two Tauri boundaries and nothing above them.**
 * `@tauri-apps/api/event`'s `listen` is replaced by a spy whose every call is a
 * registration this file settles — the spy is the export itself, so the whole
 * argument list a caller passes is what it records — and `@tauri-apps/api/core`'s
 * `invoke` is replaced so that every command the composition sends is recorded
 * and answered by a script or refused. `src/lib/ipc/events.ts`, `src/lib/ipc/commands.ts`, the
 * coordinator and the state are all the real modules, which is what makes a
 * count here a fact about the shipped window's composition rather than about
 * a fake of it.
 *
 * **The `invoke` policy, and why it is not the sibling suites' exact zero.**
 * `DetailPane.test.ts` and `RestorePane.test.ts` inject scripted commands and
 * hold the real boundary to zero calls, because a call that reached it is the
 * defect. This file mounts the composition that *is* the real boundary, so the
 * shell's `open(null)` reaches `invoke` by design. The file-wide `afterEach`
 * therefore asserts the **exact** call list instead: by default one
 * `open_workspace` per mount with `{ root: null }` and nothing else, which the
 * mock refuses — so the shell draws its failure arm, the drain gate stays
 * closed, and a drain reaching the boundary would appear as an unexpected
 * entry. A case that wants the gate open scripts the answers itself and
 * declares every call it expects.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { makeDocument, makeSummary } from '../browser/fixtures';
import { DICTIONARIES, type TranslationKey } from '../i18n/dictionaries';
import { RECONCILIATION_EVENT_NAMES } from '../ipc/events';
import type { ReconciliationBatch, ReconciliationWake, WorkspaceSummary } from '../ipc/types';
import { locale } from '../stores/locale.svelte';
import AppShell from './AppShell.svelte';

/** The envelope Tauri's `listen` hands a handler; only `payload` is read. */
interface RawEnvelope {
  /** The event name, echoed. */
  readonly event: string;
  /** Tauri's listener identifier. */
  readonly id: number;
  /** The wake, as Rust emitted it. */
  readonly payload: ReconciliationWake;
}

/**
 * One call the mocked `listen` received, held open until a case settles it.
 *
 * The promise `listen` returned is resolved or rejected from here, which is what
 * lets a case put the registration on either side of the disposal.
 */
interface Registration {
  /** The event name the wrapper registered. */
  readonly event: string;
  /** The handler it registered, so a case can deliver a wake to it. */
  readonly deliver: (envelope: RawEnvelope) => void;
  /** Resolves the registration with an unlisten function. */
  readonly resolve: (unlisten: UnlistenFn) => void;
  /** Rejects it, as a refused `plugin:event|listen` would. */
  readonly reject: (reason: Error) => void;
  /** Whether a case has settled it; the `afterEach` requires every one to be. */
  settled: boolean;
}

/** What a scripted case answers `invoke` with. */
type Answerer = (command: string, args: unknown) => Promise<unknown>;

/**
 * The two Tauri boundaries, replaced for the whole file.
 *
 * `vi.hoisted` because a `vi.mock` factory is lifted above every import and
 * cannot close over an ordinary `const`. `invoked` is the `invoke` spy;
 * `registrations` is every `listen` call, newest last, held open until settled;
 * `script` is the current answerer, `null` meaning *refuse everything* — the
 * default, restored by the `afterEach`, so that no case inherits another case's
 * answers.
 *
 * **`listened` is the mocked `listen` itself, not a wrapper that forwards to a
 * spy.** The phase's review found the first shape vacuous: a wrapper declared
 * as `(event, handler)` forwarded those two and dropped any third argument, so
 * the `afterEach`'s "no options were passed" assertion could not fail. A `vi.fn`
 * records every argument its caller passed, whatever its implementation names,
 * which is what makes that assertion a measurement (§9 of the phase's notes has
 * the negative control).
 */
const { invoked, listened, registrations, script } = vi.hoisted(() => {
  const registrations: Registration[] = [];
  const listened = vi.fn(
    (event: string, handler: (envelope: RawEnvelope) => void): Promise<UnlistenFn> =>
      new Promise<UnlistenFn>((resolve, reject) => {
        registrations.push({ event, deliver: handler, resolve, reject, settled: false });
      })
  );
  return {
    invoked: vi.fn(),
    listened,
    registrations,
    script: { current: null as Answerer | null }
  };
});

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (command: string, args: unknown): Promise<unknown> => {
    invoked(command, args);
    const current = script.current;
    if (current === null) {
      return Promise.reject(new Error('this suite scripts no answer for this command'));
    }
    return current(command, args);
  }
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: listened
}));

/** The one event name, as `events.ts` declares it and Rust emits it. */
const [READY] = RECONCILIATION_EVENT_NAMES;

/** A mounted shell and the call that tears it down. */
interface MountedShell {
  /** The element the shell was mounted into. */
  readonly target: HTMLElement;
  /** Unmounts the shell, which is what runs `onMount`'s cleanup. */
  readonly stop: () => void;
}

/** Every unlisten function a case resolved a registration with. */
const unlistens: ReturnType<typeof vi.fn>[] = [];

/** The exact `invoke` calls the running case expects, in order. */
let expectedInvokes: [string, unknown][] = [];

/** How many refused opens the running case expects the shell to report. */
let expectedReports = 0;

/** How many shells the running case mounted. */
let mounted = 0;

/**
 * Every shell mounted and not yet stopped.
 *
 * The `afterEach` requires this to be empty **and** empties it: a case that
 * threw before its `stop()` fails on the count, and its shell is unmounted
 * anyway, so a live coordinator never survives into the next case — the phase's
 * review found that it did.
 */
const live = new Set<MountedShell>();

/** `console.warn`, spied for the file: `reportIpcFailure` is where a refused open goes. */
let warn: ReturnType<typeof vi.spyOn> | null = null;

/**
 * Mounts the shell and records the one `open_workspace` its `onMount` sends.
 *
 * The expectation is pushed here rather than in each case because it is the
 * shell's, not the case's: every mount opens exactly once with `null`. A case
 * that scripts a successful open pushes what follows it.
 *
 * **The shell is entered into {@link live} before the flush that runs
 * `onMount`**, so a throw from inside the mount still leaves it where the
 * `afterEach` can unmount it.
 *
 * @param refusedOpen - Whether the mock will refuse that open, in which case the
 *   shell reports it exactly once through `reportIpcFailure`.
 * @returns The mounted shell.
 */
function mountShell(refusedOpen = true): MountedShell {
  const target = document.createElement('div');
  document.body.append(target);
  const component = mount(AppShell, { target });
  const shell: MountedShell = {
    target,
    stop: () => {
      if (!live.delete(shell)) {
        throw new Error('a shell is stopped once');
      }
      void unmount(component);
      target.remove();
    }
  };
  live.add(shell);
  flushSync();
  mounted += 1;
  expectedInvokes.push(['open_workspace', { root: null }]);
  if (refusedOpen) {
    expectedReports += 1;
  }
  return shell;
} // End of function mountShell()

/**
 * The registration at `index`, which must exist.
 *
 * @param index - Which `listen` call, oldest first.
 * @returns The held registration.
 */
function registration(index: number): Registration {
  const found = registrations[index];
  if (found === undefined) {
    throw new Error(`this case needs a registration at ${index}; ${registrations.length} exist`);
  }
  return found;
} // End of function registration()

/**
 * Resolves the registration at `index` with a fresh unlisten spy.
 *
 * @param index - Which `listen` call, oldest first.
 * @returns The unlisten function the coordinator now holds, or will be handed.
 */
function resolveRegistration(index: number): ReturnType<typeof vi.fn> {
  const held = registration(index);
  const unlisten = vi.fn((): void => undefined);
  unlistens.push(unlisten);
  held.settled = true;
  held.resolve(unlisten);
  return unlisten;
} // End of function resolveRegistration()

/**
 * Rejects the registration at `index`, as a refused plugin command would.
 *
 * @param index - Which `listen` call, oldest first.
 */
function rejectRegistration(index: number): void {
  const held = registration(index);
  held.settled = true;
  held.reject(new Error('plugin:event|listen refused'));
} // End of function rejectRegistration()

/**
 * Waits for the composition's asynchronous work to finish.
 *
 * One zero-delay macrotask turn and a flush, as the two sibling suites settle:
 * nothing in the composition uses a timer, so the turn exists only to let the
 * whole microtask queue run — registration continuations, command answers and
 * the pump's yield — before the case reads. It waits for the queue, never for
 * the coordinator: a drain that never happened is a wrong call list, not a
 * hung case.
 */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync();
} // End of function settle()

/**
 * The button whose label is the English rendering of one key.
 *
 * @param target - Where the shell was mounted.
 * @param key - The key holding the button's label.
 * @returns The button.
 */
function control(target: HTMLElement, key: TranslationKey): HTMLButtonElement {
  const label = DICTIONARIES.en[key];
  const found = [...target.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === label
  );
  if (found === undefined) {
    throw new Error(`this case needs the control labelled ${label}`);
  }
  return found;
} // End of function control()

/**
 * A promise a case resolves by hand, so an answer can be held until the case
 * has put something else in front of it.
 *
 * @returns The promise and its resolver.
 */
function deferred<T>(): { readonly promise: Promise<T>; readonly resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => {
    throw new Error('the deferred promise was resolved before its resolver was captured');
  };
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
} // End of function deferred()

/** A summary of a workspace with nothing in it, as `open_workspace` answers. */
const EMPTY_SUMMARY: WorkspaceSummary = {
  root: '/tmp/espanso',
  documents: 0,
  match_files: 0,
  config_profiles: 0,
  packages: 0,
  disabled: 0
};

/**
 * An empty batch for epoch one, as `drain_external_changes` answers when the
 * queue holds nothing.
 *
 * @returns The batch.
 */
function emptyBatch(): ReconciliationBatch {
  return { epoch: 1, newest_sequence: 0, observations: [], discarded: 0 };
} // End of function emptyBatch()

beforeEach(() => {
  locale.setOverride('en');
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  locale.setOverride(null);
  // Read, then cleared, then asserted, so one defect fails one case rather than
  // every case after it.
  const calls = invoked.mock.calls;
  const expected = expectedInvokes;
  const registered = listened.mock.calls;
  const shells = mounted;
  const held = registrations.splice(0, registrations.length);
  const released = unlistens.splice(0, unlistens.length);
  const reports = warn?.mock.calls.length ?? 0;
  const expectedReported = expectedReports;
  invoked.mockClear();
  listened.mockClear();
  expectedInvokes = [];
  expectedReports = 0;
  mounted = 0;
  script.current = null;
  warn?.mockRestore();
  warn = null;

  // **The teardown, unconditionally and before any assertion**, so that a case
  // which threw before its `stop()` leaves nothing behind for the next one: a
  // surviving shell is unmounted here — which runs the host's cleanup and so
  // disposes its coordinator — and a registration nobody settled is resolved
  // into that disposed coordinator, which calls the unlisten it is handed and
  // stores nothing. What survived is counted first and asserted on below, so the
  // cleanup does not hide the defect it cleans up after.
  const survivors = [...live];
  for (const shell of survivors) {
    shell.stop();
  } // End of the loop that unmounts the shells a failed case left mounted
  const unsettled = held.filter((entry) => !entry.settled);
  for (const entry of unsettled) {
    entry.settled = true;
    entry.resolve(vi.fn((): void => undefined));
  } // End of the loop that settles the registrations a failed case left pending

  // 1. Every shell was stopped by its case, so every coordinator the case
  //    started was disposed through the host's own cleanup (ruling 35) — by the
  //    case, not by the teardown above.
  expect(survivors).toHaveLength(0);
  // 2. Exactly one registration per mount, of the one event name, through
  //    `listen(event, handler)` with no options — the third argument's absence is
  //    what makes the target `Any`, which is how the shipped window registers.
  expect(registered).toHaveLength(shells);
  for (const call of registered) {
    expect(call).toHaveLength(2);
    expect(call[0]).toBe(READY);
    expect(call[1]).toBeTypeOf('function');
  } // End of the loop over the registrations
  // 3. Every registration was settled by the case — measured before the
  //    teardown settled the rest — so no coordinator is left awaiting a promise
  //    this file would otherwise never resolve.
  expect(unsettled).toHaveLength(0);
  // 4. Ruling 16, file-wide: every unlisten a resolved registration handed over
  //    was called exactly once by the time the case ended — not zero, which is a
  //    leaked subscription, and not twice.
  for (const unlisten of released) {
    expect(unlisten).toHaveBeenCalledTimes(1);
  } // End of the loop over the unlisten functions
  // 5. The route, exactly: every call that reached the real `invoke`, in order,
  //    is one the case declared. A drain the gate should have held, or a second
  //    open nobody clicked for, shows up here by name.
  expect(calls).toEqual(expected);
  // 6. And every refused open was reported once through the reporter the shell
  //    passes explicitly, so `console.warn` saw exactly that many calls.
  expect(reports).toBe(expectedReported);
}); // End of the afterEach that holds the file to its counts

describe('the mounted shell', () => {
  it('registers one listener on mount and unlistens exactly once on unmount', async () => {
    const shell = mountShell();
    expect(listened).toHaveBeenCalledTimes(1);
    const unlisten = resolveRegistration(0);
    await settle();
    // Registered, and held: nothing has been disposed yet.
    expect(unlisten).not.toHaveBeenCalled();

    // The refused open drew the failure arm, which is the real reporter and the
    // real `tIpcFailure` reached through the composition.
    expect(shell.target.textContent).toContain(DICTIONARIES.en['browser.status.failed.heading']);

    shell.stop();
    // Synchronously, on the unmount: `onMount`'s cleanup runs `dispose()`, which
    // calls the held unlisten before anything can await.
    expect(unlisten).toHaveBeenCalledTimes(1);
    await settle();
    expect(unlisten).toHaveBeenCalledTimes(1);
  }); // End of the "one listener, one unlisten" case

  it('behaves identically over a second mount and unmount, leaking no subscription', async () => {
    const first = mountShell();
    const firstUnlisten = resolveRegistration(0);
    await settle();
    first.stop();
    expect(firstUnlisten).toHaveBeenCalledTimes(1);

    const second = mountShell();
    expect(listened).toHaveBeenCalledTimes(2);
    const secondUnlisten = resolveRegistration(1);
    await settle();
    // The first shell's subscription is not touched by the second's lifetime.
    expect(firstUnlisten).toHaveBeenCalledTimes(1);
    expect(secondUnlisten).not.toHaveBeenCalled();

    second.stop();
    expect(secondUnlisten).toHaveBeenCalledTimes(1);
    expect(firstUnlisten).toHaveBeenCalledTimes(1);
  }); // End of the "second cycle" case

  it('unlistens exactly once when disposal lands before the registration resolves', async () => {
    // Ruling 16, observed through the host: the shell is torn down while `listen`
    // is still pending, so `dispose()` holds nothing to call — and the
    // registration that resolves afterwards must end itself.
    const shell = mountShell();
    expect(listened).toHaveBeenCalledTimes(1);
    shell.stop();

    const unlisten = resolveRegistration(0);
    expect(unlisten).not.toHaveBeenCalled();
    await settle();
    expect(unlisten).toHaveBeenCalledTimes(1);
    // And stays there: a second turn calls nothing again.
    await settle();
    expect(unlisten).toHaveBeenCalledTimes(1);
  }); // End of the "disposal before registration" case

  it('tears down cleanly when the registration is refused', async () => {
    // What the shipped window sees if `plugin:event|listen` were refused — the
    // capability missing, say. The coordinator records the failure; there is no
    // unlisten to call, and the shell still opens and still disposes.
    const shell = mountShell();
    rejectRegistration(0);
    await settle();
    expect(shell.target.textContent).toContain(DICTIONARIES.en['browser.status.failed.heading']);
    shell.stop();
    expect(unlistens).toHaveLength(0);
  }); // End of the "registration refused" case

  it('re-opens through the same boundary on retry without touching the subscription', async () => {
    const shell = mountShell();
    const unlisten = resolveRegistration(0);
    await settle();

    // The refused open drew the retry control; clicking it is the shell's second
    // `open(null)`. A workspace replacement neither unsubscribes nor
    // resubscribes (`events.ts`, *Lifetime*), so the counts do not move.
    control(shell.target, 'browser.status.retry').click();
    expectedInvokes.push(['open_workspace', { root: null }]);
    expectedReports += 1;
    await settle();
    expect(listened).toHaveBeenCalledTimes(1);
    expect(unlisten).not.toHaveBeenCalled();

    shell.stop();
    expect(unlisten).toHaveBeenCalledTimes(1);
  }); // End of the "retry" case

  it('drains once for registration and open together, then once per current-epoch wake', async () => {
    // The whole composition end to end: the mocked `listen` resolves into the
    // real adapter, the real coordinator asks the real command wrapper, and the
    // mocked `invoke` answers. The open is held open by hand so that the
    // registration lands while the gate is closed — the order the shell's
    // `onMount` makes likely, pinned here rather than left to tick counts.
    const opened = deferred<WorkspaceSummary>();
    script.current = (command) => {
      switch (command) {
        case 'open_workspace':
          return opened.promise;
        case 'list_documents':
          return Promise.resolve([]);
        case 'drain_external_changes':
          return Promise.resolve(emptyBatch());
        default:
          return Promise.reject(new Error(`this case scripts no answer for ${command}`));
      }
    };
    const shell = mountShell(false);
    const unlisten = resolveRegistration(0);
    await settle();
    // Registered while the open is pending: the registration's drain is
    // recorded, and nothing has reached the boundary but the open itself.
    expect(invoked).toHaveBeenCalledTimes(1);

    opened.resolve(EMPTY_SUMMARY);
    expectedInvokes.push(['list_documents', {}], ['drain_external_changes', { afterSequence: 0 }]);
    await settle();
    // One physical drain satisfied both reasons, and the empty workspace is drawn.
    expect(invoked).toHaveBeenCalledTimes(3);
    expect(shell.target.textContent).toContain(DICTIONARIES.en['browser.status.empty.heading']);

    // A wake for the adopted epoch, delivered through the handler the real
    // adapter registered, is a fourth call; one for another epoch is nothing.
    registration(0).deliver({ event: READY, id: 1, payload: { workspace_epoch: 1, newest_sequence: 3 } });
    expectedInvokes.push(['drain_external_changes', { afterSequence: 0 }]);
    await settle();
    expect(invoked).toHaveBeenCalledTimes(4);
    registration(0).deliver({ event: READY, id: 1, payload: { workspace_epoch: 2, newest_sequence: 1 } });
    await settle();
    expect(invoked).toHaveBeenCalledTimes(4);

    shell.stop();
    expect(unlisten).toHaveBeenCalledTimes(1);
    // A wake after disposal reaches a disposed coordinator and drains nothing.
    registration(0).deliver({ event: READY, id: 1, payload: { workspace_epoch: 1, newest_sequence: 9 } });
    await settle();
    expect(invoked).toHaveBeenCalledTimes(4);
  }); // End of the "drains through the composition" case
}); // End of the describe over the mounted shell

describe('the shell over an emptied workspace — Phase 2d-6-6b', () => {
  it.each(['en', 'es'] as const)(
    'keeps the panes mounted while a surface is open, and gives way once it closes, in %s',
    async (lang) => {
      // **The 2d-6 record's §3 entry 31 and §5.2.** The empty state used to replace
      // the panes the moment the last row went, unmounting `DetailPane` and every
      // session in it. Here the only file is removed on disk while the new-snippet
      // form is open: the row goes, the form stays, and only closing it lets the
      // empty state draw.
      // Run once per locale (Phase 2d-7-2): the 2d-6-11a notes, section 5 item 4,
      // left this case EN-only.
      locale.setOverride(lang);
      const only = makeSummary({ id: 1, relativePath: 'match/a.yml' });
      const view = makeDocument({ id: 1, relativePath: 'match/a.yml' });
      let drained = 0;
      script.current = (command) => {
        switch (command) {
          case 'open_workspace':
            return Promise.resolve({ ...EMPTY_SUMMARY, documents: 1, match_files: 1 });
          case 'list_documents':
            return Promise.resolve([only]);
          case 'get_document':
            return Promise.resolve(view);
          case 'drain_external_changes':
            drained += 1;
            return Promise.resolve(
              drained === 1
                ? emptyBatch()
                : {
                    epoch: 1,
                    newest_sequence: 1,
                    observations: [
                      {
                        Removed: {
                          sequence: 1,
                          document: { Addressable: { document: 1, relative_path: 'match/a.yml' } },
                          previous_revision: null
                        }
                      }
                    ],
                    discarded: 0
                  }
            );
          default:
            return Promise.reject(new Error(`this case scripts no answer for ${command}`));
        }
      };
      const shell = mountShell(false);
      resolveRegistration(0);
      await settle();
      expectedInvokes.push(
        ['list_documents', {}],
        ['get_document', { id: 1 }],
        ['drain_external_changes', { afterSequence: 0 }]
      );
      await settle();
      controlIn(shell.target, lang, 'browser.matchCreation.open').click();
      flushSync();
      expect(shell.target.textContent).toContain(DICTIONARIES[lang]['browser.matchCreation.label']);

      registration(0).deliver({ event: READY, id: 1, payload: { workspace_epoch: 1, newest_sequence: 1 } });
      expectedInvokes.push(['drain_external_changes', { afterSequence: 0 }]);
      await settle();
      await settle();

      // The last row is gone, and the form is still on screen.
      expect(shell.target.textContent).not.toContain(DICTIONARIES[lang]['browser.status.empty.heading']);
      expect(shell.target.textContent).toContain(DICTIONARIES[lang]['browser.matchCreation.label']);

      controlIn(shell.target, lang, 'browser.matchCreation.close').click();
      flushSync();
      expect(shell.target.textContent).toContain(DICTIONARIES[lang]['browser.status.empty.heading']);
      expect(shell.target.textContent).not.toContain(DICTIONARIES[lang]['browser.matchCreation.label']);
      shell.stop();
    }
  ); // End of the "emptied workspace" case

  it.each(['en', 'es'] as const)(
    'draws the banners and their reload control over the empty state, and reloads on the press, in %s',
    async (lang) => {
      // **Phase 2d-6-9b-1: the retention half the banners need** (`workspaceBannersDrawnIn`
      // in `../browser/reconciliationStatus.ts`). The shell draws the empty state
      // and, beside it, the banner a drifted path raised with its membership-reload
      // control — the removal that empties a list must not take the person's one way
      // to ask for the list again with it. One press is one open, declared below.
      locale.setOverride(lang);
      let drained = 0;
      script.current = (command) => {
        switch (command) {
          case 'open_workspace':
            return Promise.resolve(EMPTY_SUMMARY);
          case 'list_documents':
            return Promise.resolve([]);
          case 'drain_external_changes':
            drained += 1;
            return Promise.resolve(
              drained === 2
                ? {
                    epoch: 1,
                    newest_sequence: 1,
                    observations: [
                      {
                        Removed: {
                          sequence: 1,
                          document: { Unnamed: { relative_path: 'match/stranger.yml' } },
                          previous_revision: null
                        }
                      }
                    ],
                    discarded: 0
                  }
                : emptyBatch()
            );
          default:
            return Promise.reject(new Error(`this case scripts no answer for ${command}`));
        }
      };
      const shell = mountShell(false);
      resolveRegistration(0);
      expectedInvokes.push(['list_documents', {}], ['drain_external_changes', { afterSequence: 0 }]);
      await settle();
      registration(0).deliver({ event: READY, id: 1, payload: { workspace_epoch: 1, newest_sequence: 1 } });
      expectedInvokes.push(['drain_external_changes', { afterSequence: 0 }]);
      await settle();

      const text = shell.target.textContent ?? '';
      expect(text).toContain(DICTIONARIES[lang]['browser.status.empty.heading']);
      expect(text).toContain(DICTIONARIES[lang]['browser.reconciliation.membershipReloadWanted']);
      const label = DICTIONARIES[lang]['browser.reconciliation.action.membershipReload'];
      const reload = [...shell.target.querySelectorAll('button')].find(
        (candidate) => candidate.textContent?.trim() === label
      );
      expect(reload?.disabled).toBe(false);

      reload?.click();
      expectedInvokes.push(
        ['open_workspace', { root: null }],
        ['list_documents', {}],
        ['drain_external_changes', { afterSequence: 0 }]
      );
      await settle();
      await settle();
      expect(shell.target.textContent).not.toContain(
        DICTIONARIES[lang]['browser.reconciliation.membershipReloadWanted']
      );
      expect(shell.target.textContent).toContain(DICTIONARIES[lang]['browser.status.empty.heading']);
      shell.stop();
    }
  ); // End of the "banners over the empty state" case
}); // End of the describe over an emptied workspace

/**
 * Overrides what `document.visibilityState` reads, until {@link restoreVisibility}.
 *
 * An own property shadowing jsdom's prototype getter, so deleting it restores
 * jsdom's own answer exactly.
 *
 * @param state - What the page should report.
 */
function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
} // End of function setVisibility()

/** Removes the override {@link setVisibility} installed, if any. */
function restoreVisibility(): void {
  Reflect.deleteProperty(document, 'visibilityState');
} // End of function restoreVisibility()

/**
 * Answers the open with an empty workspace and every drain with an empty batch,
 * so the drain gate opens and a foreground drain reaches the boundary by name.
 *
 * @returns Nothing; the answerer is installed on the file's script.
 */
function scriptOpenWorkspace(): void {
  script.current = (command) => {
    switch (command) {
      case 'open_workspace':
        return Promise.resolve(EMPTY_SUMMARY);
      case 'list_documents':
        return Promise.resolve([]);
      case 'drain_external_changes':
        return Promise.resolve(emptyBatch());
      default:
        return Promise.reject(new Error(`this case scripts no answer for ${command}`));
    }
  };
} // End of function scriptOpenWorkspace()

/**
 * Mounts a shell whose open succeeds and settles its first drain.
 *
 * @returns The mounted shell, with the registration's and the open's one drain
 *   already declared and issued.
 */
async function mountOpenShell(): Promise<MountedShell> {
  scriptOpenWorkspace();
  const shell = mountShell(false);
  resolveRegistration(0);
  expectedInvokes.push(['list_documents', {}], ['drain_external_changes', { afterSequence: 0 }]);
  await settle();
  await settle();
  expect(invoked).toHaveBeenCalledTimes(3);
  return shell;
} // End of function mountOpenShell()

describe('the foreground fallback — Phase 2d-6-10', () => {
  afterEach(() => {
    restoreVisibility();
  });

  it('requests a drain on a visibilitychange to visible, and none on one to hidden', async () => {
    const shell = await mountOpenShell();

    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    await settle();
    // Hidden asks for nothing: the call list is unchanged.
    expect(invoked).toHaveBeenCalledTimes(3);

    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expectedInvokes.push(['drain_external_changes', { afterSequence: 0 }]);
    await settle();
    expect(invoked).toHaveBeenCalledTimes(4);
    shell.stop();
  }); // End of the "visibilitychange" case

  it('requests a drain on a window focus', async () => {
    const shell = await mountOpenShell();
    window.dispatchEvent(new Event('focus'));
    expectedInvokes.push(['drain_external_changes', { afterSequence: 0 }]);
    await settle();
    expect(invoked).toHaveBeenCalledTimes(4);
    shell.stop();
  }); // End of the "focus" case

  it('coalesces a visibilitychange and a focus dispatched in one turn into one drain', async () => {
    // Both signals dispatched in the same synchronous turn. The adapter calls
    // the coordinator for each; the coordinator's pump turns the requests into
    // one physical drain. Signals the host delivers as separate tasks are not
    // covered by this case and cost a follow-up drain; whether WKWebView
    // delivers the pair in one task has not been read in a window.
    const shell = await mountOpenShell();
    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('focus'));
    expectedInvokes.push(['drain_external_changes', { afterSequence: 0 }]);
    await settle();
    await settle();
    expect(invoked).toHaveBeenCalledTimes(4);
    shell.stop();
  }); // End of the "coalesce" case

  it('reaches no boundary while the open has left the drain gate closed', async () => {
    // The default script refuses the open, so the gate stays closed and a
    // foreground signal is recorded but issues nothing — the file-wide call list
    // holds only the open.
    const shell = mountShell();
    resolveRegistration(0);
    await settle();
    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    await settle();
    expect(invoked).toHaveBeenCalledTimes(1);
    shell.stop();
  }); // End of the "gate closed" case

  it('adds one listener of each kind on mount and removes exactly those two on unmount', async () => {
    const pageAdd = vi.spyOn(document, 'addEventListener');
    const pageRemove = vi.spyOn(document, 'removeEventListener');
    const viewAdd = vi.spyOn(window, 'addEventListener');
    const viewRemove = vi.spyOn(window, 'removeEventListener');
    try {
      /**
       * The listeners one spy saw for one event type.
       *
       * @param spy - An `addEventListener` or `removeEventListener` spy.
       * @param type - The event type.
       * @returns The listener arguments, in call order.
       */
      const of = (spy: { mock: { calls: unknown[][] } }, type: string): unknown[] =>
        spy.mock.calls.filter((call) => call[0] === type).map((call) => call[1]);

      const shell = mountShell();
      resolveRegistration(0);
      await settle();
      const visibility = of(pageAdd, 'visibilitychange');
      const focus = of(viewAdd, 'focus');
      expect(visibility).toHaveLength(1);
      expect(focus).toHaveLength(1);
      expect(of(pageRemove, 'visibilitychange')).toHaveLength(0);
      expect(of(viewRemove, 'focus')).toHaveLength(0);

      shell.stop();
      // Synchronously, on the unmount, and the very functions that were added.
      expect(of(pageRemove, 'visibilitychange')).toEqual(visibility);
      expect(of(viewRemove, 'focus')).toEqual(focus);
    } finally {
      pageAdd.mockRestore();
      pageRemove.mockRestore();
      viewAdd.mockRestore();
      viewRemove.mockRestore();
    }
  }); // End of the "unmount removes both listeners" case
}); // End of the describe over the foreground fallback

/**
 * The button whose label is one locale's rendering of one key.
 *
 * {@link control} reads the English dictionary only; the lost-history cases run
 * in both locales and press their controls by the words that locale draws.
 *
 * @param target - Where the shell was mounted.
 * @param lang - The locale whose dictionary holds the label.
 * @param key - The key holding the button's label.
 * @returns The button.
 */
function controlIn(target: HTMLElement, lang: 'en' | 'es', key: TranslationKey): HTMLButtonElement {
  const label = DICTIONARIES[lang][key];
  const found = [...target.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === label
  );
  if (found === undefined) {
    throw new Error(`this case needs the control labelled ${label}`);
  }
  return found;
} // End of function controlIn()

/**
 * Answers a one-file workspace whose second drain reports lost history.
 *
 * The first drain is the open's, and empty. The second — the one a wake asks
 * for — carries `discarded: 1` for the adopted epoch, which is a strict rise from
 * zero and so the coordinator's lost-history block. Every drain after it answers
 * an empty batch for epoch 2, as the watcher of a reopened workspace would, so a
 * recovery that reopens is not blocked again by the same count.
 *
 * @returns Nothing; the answerer is installed on the file's script.
 */
function scriptLostHistory(): void {
  const only = makeSummary({ id: 1, relativePath: 'match/a.yml' });
  const view = makeDocument({ id: 1, relativePath: 'match/a.yml' });
  let drained = 0;
  script.current = (command) => {
    switch (command) {
      case 'open_workspace':
        return Promise.resolve({ ...EMPTY_SUMMARY, documents: 1, match_files: 1 });
      case 'list_documents':
        return Promise.resolve([only]);
      case 'get_document':
        return Promise.resolve(view);
      case 'drain_external_changes':
        drained += 1;
        if (drained === 1) {
          return Promise.resolve(emptyBatch());
        }
        return Promise.resolve(
          drained === 2
            ? { epoch: 1, newest_sequence: 1, observations: [], discarded: 1 }
            : { epoch: 2, newest_sequence: 0, observations: [], discarded: 0 }
        );
      default:
        return Promise.reject(new Error(`this case scripts no answer for ${command}`));
    } // End of the switch over the command
  }; // End of the lost-history answerer
} // End of function scriptLostHistory()

describe('the lost-history recovery through the composition — Phase 2d-6-11a', () => {
  it.each(['en', 'es'] as const)(
    'draws lost history held by an open surface, and reloads the workspace on the press once it closes, in %s',
    async (lang) => {
      // The design consult's "both workspace reload requests" row: the membership
      // reload is pressed above; this is the other, `requestLostHistoryRecovery`,
      // reached through the shell's own `ReconciliationStatus`. The new-snippet
      // form is a write surface, and an open one is what keeps the coordinator
      // from recovering by itself, so the banner and its control are drawn.
      locale.setOverride(lang);
      scriptLostHistory();
      const shell = mountShell(false);
      resolveRegistration(0);
      expectedInvokes.push(
        ['list_documents', {}],
        ['get_document', { id: 1 }],
        ['drain_external_changes', { afterSequence: 0 }]
      );
      await settle();
      await settle();
      controlIn(shell.target, lang, 'browser.matchCreation.open').click();
      flushSync();

      registration(0).deliver({ event: READY, id: 1, payload: { workspace_epoch: 1, newest_sequence: 1 } });
      expectedInvokes.push(['drain_external_changes', { afterSequence: 0 }]);
      await settle();
      await settle();
      expect(invoked).toHaveBeenCalledTimes(5);
      expect(shell.target.textContent).toContain(DICTIONARIES[lang]['browser.reconciliation.lostHistory']);
      expect(
        controlIn(shell.target, lang, 'browser.reconciliation.action.lostHistoryRecovery').disabled
      ).toBe(true);

      // Closing the form permits the recovery and does not trigger it.
      controlIn(shell.target, lang, 'browser.matchCreation.close').click();
      flushSync();
      await settle();
      expect(invoked).toHaveBeenCalledTimes(5);
      const recover = controlIn(shell.target, lang, 'browser.reconciliation.action.lostHistoryRecovery');
      expect(recover.disabled).toBe(false);

      recover.click();
      expectedInvokes.push(
        ['open_workspace', { root: null }],
        ['list_documents', {}],
        ['get_document', { id: 1 }],
        ['drain_external_changes', { afterSequence: 0 }]
      );
      await settle();
      await settle();
      expect(shell.target.textContent).not.toContain(
        DICTIONARIES[lang]['browser.reconciliation.lostHistory']
      );
      expect(
        [...shell.target.querySelectorAll('button')].some(
          (candidate) =>
            candidate.textContent?.trim() ===
            DICTIONARIES[lang]['browser.reconciliation.action.lostHistoryRecovery']
        )
      ).toBe(false);
      shell.stop();
    }
  ); // End of the "lost history held by a surface" case

  it('recovers by itself when no surface is open, drawing no banner and offering no control', async () => {
    // `recoverFromLostHistory` in `../browser/reconciliationCoordinator.ts`: with
    // the write-surface registry empty, the batch that reports the loss is
    // refused whole and the retained open is rerun in the same drain.
    scriptLostHistory();
    const shell = mountShell(false);
    resolveRegistration(0);
    expectedInvokes.push(
      ['list_documents', {}],
      ['get_document', { id: 1 }],
      ['drain_external_changes', { afterSequence: 0 }]
    );
    await settle();
    await settle();

    registration(0).deliver({ event: READY, id: 1, payload: { workspace_epoch: 1, newest_sequence: 1 } });
    expectedInvokes.push(
      ['drain_external_changes', { afterSequence: 0 }],
      ['open_workspace', { root: null }],
      ['list_documents', {}],
      ['get_document', { id: 1 }],
      ['drain_external_changes', { afterSequence: 0 }]
    );
    await settle();
    await settle();
    expect(shell.target.textContent).not.toContain(DICTIONARIES.en['browser.reconciliation.lostHistory']);
    expect(
      [...shell.target.querySelectorAll('button')].some(
        (candidate) =>
          candidate.textContent?.trim() ===
          DICTIONARIES.en['browser.reconciliation.action.lostHistoryRecovery']
      )
    ).toBe(false);
    shell.stop();
  }); // End of the "automatic recovery" case
}); // End of the describe over the lost-history recovery
