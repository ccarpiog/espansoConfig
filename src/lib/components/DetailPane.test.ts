/** @vitest-environment jsdom */

/**
 * The detail pane, mounted over a **real** `BrowserState`.
 *
 * **One claim, and it is the 2c-2-2 review's High finding.** The pane owns the
 * decision of *what the small editor is open over*, and it used to own only half
 * of it: the snippet was captured and the file was passed straight through from
 * the live selection. Opening the editor over a snippet of file A and then
 * clicking anything in file B moved the name on the editor's header to B while
 * every byte the save would write still went to A. A window naming one file and
 * writing another is the worst thing this application can do, and nothing inside
 * `MatchEditor.svelte` could have caught it, because the value arrived wrong.
 *
 * **The state is the real one, built by `createBrowserState` over scripted
 * commands, and that is load-bearing.** A hand-rolled stub is not reactive, so
 * the selection could not move under the mounted editor at all and the case would
 * have passed before the fix as loudly as after it.
 *
 * **Since 2c-5-4b it also carries two claims about the restore mode**, and both
 * are about reachability rather than about restore itself — `RestorePane.test.ts`
 * is where the operation is driven. The first is that a person can get to the
 * pane at all, from the file's whole-text surface and over the file's own parse.
 * The second is mechanical and is the trap 2c-5-4a handed forward: `BackupCommands`
 * has a **real production default**, so a `createBrowserState` call that omits its
 * third argument reaches `invoke` rather than a script, and no type says so. This
 * file injects one and a hoisted mock of `@tauri-apps/api/core` is what would
 * notice if it stopped.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeDocument, makeMatch, makeSummary, matchListPath } from '../browser/fixtures';
import {
  createBrowserState,
  type BackupCommands,
  type BrowserCommands,
  type BrowserState
} from '../browser/workspace.svelte';
import { DICTIONARIES, type TranslationKey } from '../i18n/dictionaries';
import { locale } from '../stores/locale.svelte';
import type { CommandResult } from '../ipc/commands';
import type {
  BackupBatchListing,
  BackupEntryListing,
  BackupTextResponse,
  DocumentSummary,
  DocumentView,
  MatchView,
  SaveResult,
  WorkspaceSummary
} from '../ipc/types';
import DetailPane from './DetailPane.svelte';

/**
 * The Tauri boundary, replaced for the whole file.
 *
 * `vi.hoisted` because a `vi.mock` factory is lifted above every import and
 * cannot close over an ordinary `const`. It **rejects**: a call that got this far
 * is already the defect, and a stub that answered would let a case pass.
 */
const { invoked } = vi.hoisted(() => ({ invoked: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: readonly unknown[]): Promise<never> => {
    invoked(...args);
    return Promise.reject(new Error('this suite invokes no command'));
  }
}));

/**
 * The two files this pane is driven over.
 *
 * The second is **read-only**, which is one of the two gates on the *Edit this
 * snippet* control and costs nothing to carry here: the cases that move the
 * selection onto it only need it to be selectable.
 */
const FILES: readonly DocumentSummary[] = [
  makeSummary({ id: 1, relativePath: 'match/a.yml' }),
  makeSummary({ id: 2, relativePath: 'match/b.yml', readOnly: true })
];

/**
 * The projection of `match/a.yml`, with one snippet in it.
 *
 * @returns The document view.
 */
function documentA(): DocumentView {
  return makeDocument({
    id: 1,
    relativePath: 'match/a.yml',
    revision: 'a'.repeat(64),
    matches: [
      makeMatch({
        node: 10,
        document: 1,
        revision: 'a'.repeat(64),
        trigger: ':a',
        replace: 'ay',
        // The address that makes it an *item of a sequence*, which is what a
        // duplicate copies: a snippet without one is `noSequencePosition` and
        // cannot be copied at all.
        path: matchListPath(0)
      })
    ]
  });
} // End of function documentA()

/**
 * The projection of `match/b.yml`, with one snippet in it.
 *
 * @returns The document view.
 */
function documentB(): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/b.yml',
    readOnly: true,
    revision: 'b'.repeat(64),
    matches: [
      makeMatch({
        node: 20,
        document: 2,
        revision: 'b'.repeat(64),
        trigger: ':b',
        replace: 'bee',
        path: matchListPath(0)
      })
    ]
  });
} // End of function documentB()

/**
 * The whole text of `match/a.yml`, as `document_text` answers it.
 *
 * Distinguishable from anything else on screen, so a case can tell the file-text
 * surface from the snippet detail by looking at the rendered text.
 */
const FILE_TEXT = 'matches:\n  - trigger: ":a"\n    replace: wholefiletext\n';

/** What the workspace summary says; nothing in this file reads it. */
const SUMMARY: WorkspaceSummary = {
  root: '/tmp/espanso',
  documents: FILES.length,
  match_files: FILES.length,
  config_profiles: 0,
  packages: 0,
  disabled: 0
};

/**
 * How many times any surface built by {@link scriptedCommands} has been drained.
 *
 * Module level rather than per-surface because the assertion is about the file:
 * **no case in it may drain through the injected surface**. That bound is the
 * whole claim: a drain reaching the wrapper by any other route — a module-level
 * import of `drainExternalChanges`, which no component has today — increments
 * nothing here. The `afterEach` below reads and resets it.
 */
let drains = 0;

/**
 * A command surface that answers the two documents above.
 *
 * Only the commands this pane's path reaches are given real answers; the rest
 * refuse, which is what a state test would want anyway — a pane that started
 * calling one of them would refuse wherever the case uses the answer, rather
 * than being silently satisfied. **A call whose answer is discarded is a
 * different matter**, and refusing does not make one visible: only counting the
 * call does, which is what the drain below is given and the others are not.
 *
 * @returns The commands, with `vi.fn` wrappers so calls can be inspected.
 */
function scriptedCommands(): BrowserCommands {
  const refusal: CommandResult<never> = {
    ok: false,
    failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
  };
  const views = new Map<number, DocumentView>([
    [1, documentA()],
    [2, documentB()]
  ]);
  return {
    openWorkspace: vi.fn(async (): Promise<CommandResult<WorkspaceSummary>> => {
      return { ok: true, value: SUMMARY };
    }),
    listDocuments: vi.fn(async (): Promise<CommandResult<readonly DocumentSummary[]>> => {
      return { ok: true, value: FILES };
    }),
    getDocument: vi.fn(async (id: number): Promise<CommandResult<DocumentView>> => {
      const held = views.get(id);
      return held === undefined ? refusal : { ok: true, value: held };
    }),
    getMatch: vi.fn(async (): Promise<CommandResult<MatchView>> => refusal),
    reloadDocument: vi.fn(async (): Promise<CommandResult<DocumentView>> => refusal),
    documentText: vi.fn(async (id: number): Promise<CommandResult<string>> => {
      return id === 1 ? { ok: true, value: FILE_TEXT } : refusal;
    }),
    moveMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
    saveMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
    createMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
    deleteMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
    duplicateMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
    saveRawDocument: vi.fn(async () => refusal),
    // Phase 2d-4b puts the drain on this surface; nothing this pane draws calls
    // it through the surface. The refusal is the answer no caller could proceed
    // on, and `drains` is what makes such a call *visible* — a `vi.fn` records a
    // call and asserts nothing about it, so a fire-and-forget drain that ignored
    // this answer would pass every case here. The `afterEach` below is the
    // assertion, bounded as the count's own doc comment states.
    drainExternalChanges: vi.fn(async () => {
      drains += 1;
      return refusal;
    })
  };
} // End of function scriptedCommands()

/**
 * A backup surface that answers an empty, complete catalogue.
 *
 * **Injected in every mount, and that is the point.** `createBrowserState` has a
 * real production default for this argument, so omitting it would send the restore
 * pane's first listing to `invoke`; the hoisted mock above is what would notice.
 * The answers themselves are the least interesting thing here — this file proves
 * the mode is reachable, and `RestorePane.test.ts` drives what it does.
 *
 * @returns The commands, with `vi.fn` wrappers so calls can be inspected.
 */
function scriptedBackup(): BackupCommands {
  const refusal: CommandResult<never> = {
    ok: false,
    failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
  };
  return {
    listBackupBatches: vi.fn(async (): Promise<CommandResult<BackupBatchListing>> => {
      return {
        ok: true,
        value: {
          root: 'Missing',
          batches: [],
          skipped: [],
          unrecognised: 0,
          unreadable: 0,
          complete: true
        }
      };
    }),
    listBackupEntries: vi.fn(async (): Promise<CommandResult<BackupEntryListing>> => refusal),
    readBackupText: vi.fn(async (): Promise<CommandResult<BackupTextResponse>> => refusal)
  };
} // End of function scriptedBackup()

/** A mounted pane and what a case needs to drive it. */
interface Mounted {
  /** Where the pane was mounted. */
  readonly target: HTMLElement;
  /** The state it is drawing. */
  readonly state: BrowserState;
  /** The commands behind that state. */
  readonly commands: BrowserCommands;
  /** The backup commands behind it, injected rather than defaulted. */
  readonly backup: BackupCommands;
  /** Tears the pane down. */
  readonly stop: () => void;
}

/**
 * Opens a workspace and mounts the pane over it.
 *
 * @returns The mounted pane.
 */
async function mountPane(): Promise<Mounted> {
  const commands = scriptedCommands();
  const backup = scriptedBackup();
  const state = createBrowserState(commands, () => undefined, backup);
  await state.open(null);
  const target = document.createElement('div');
  document.body.append(target);
  const component = mount(DetailPane, { target, props: { browser: state } });
  flushSync();
  return {
    target,
    state,
    commands,
    backup,
    stop: () => {
      void unmount(component);
      target.remove();
    }
  };
} // End of function mountPane()

/**
 * The snippet one document holds, taken from the state's own projection.
 *
 * @param state - The state to ask.
 * @param id - Which document.
 * @returns Its first snippet.
 */
function snippetOf(state: BrowserState, id: number): MatchView {
  const found = state.scopedMatches.find((match) => match.id.document === id);
  if (found === undefined) {
    throw new Error(`this workspace holds no snippet in document ${id}`);
  }
  return found;
} // End of function snippetOf()

/**
 * The button whose label is the English rendering of one key.
 *
 * @param target - Where the pane was mounted.
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

beforeEach(() => {
  invoked.mockClear();
  locale.setOverride('en');
});

afterEach(() => {
  locale.setOverride(null);
  // The assertion `scriptedCommands()`'s refusal cannot make on its own, applied
  // to every case in this file: nothing this pane draws drains through the
  // injected surface at 2d-4b. Read, then cleared, then asserted, so one drain
  // fails one case rather than every case after it.
  const drained = drains;
  drains = 0;
  expect(drained).toBe(0);
});

describe('the mounted detail pane', () => {
  it('keeps the small editor naming the file it is writing when the selection moves', async () => {
    // **The 2c-2-2 review's High finding.** The snippet was captured and the file
    // was not, so the header followed the selection while the save target did not.
    const pane = await mountPane();
    const inA = snippetOf(pane.state, 1);
    await pane.state.select(inA);
    flushSync();

    control(pane.target, 'browser.matchEditor.open').click();
    flushSync();
    expect(pane.target.textContent).toContain('match/a.yml');
    expect(pane.target.textContent).not.toContain('match/b.yml');

    // The person clicks a snippet in the other file while the editor is open. The
    // editor outranks the rest of the pane, so it stays — and it must go on naming
    // its own target rather than whatever is selected now.
    await pane.state.select(snippetOf(pane.state, 2));
    flushSync();

    expect(pane.target.textContent).toContain('match/a.yml');
    expect(pane.target.textContent).not.toContain('match/b.yml');
    // And what it would write is still the snippet it opened over: the box holds
    // A's body, not B's.
    const body = pane.target.querySelector('textarea');
    expect(body?.value).toBe('ay');
    pane.stop();
  }); // End of the "selection moved under the editor" case

  it('sends the snippet it opened over, whatever the selection has since become', async () => {
    // The half a rendered file name cannot prove. The editor's save has to reach
    // `save_match` with the identity it was opened with, and the pane's own
    // `saveMatch` wrapper is what carries it there.
    const pane = await mountPane();
    await pane.state.select(snippetOf(pane.state, 1));
    flushSync();
    control(pane.target, 'browser.matchEditor.open').click();
    flushSync();

    await pane.state.select(snippetOf(pane.state, 2));
    flushSync();

    const body = pane.target.querySelector('textarea');
    if (body === null) {
      throw new Error('this case is about an editor that opened');
    }
    body.value = 'edited';
    body.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    control(pane.target, 'browser.matchEditor.save').click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    flushSync();

    expect(pane.commands.saveMatch).toHaveBeenCalledTimes(1);
    const sent = vi.mocked(pane.commands.saveMatch).mock.calls[0];
    expect(sent?.[0]).toEqual({ document: 1, revision: 'a'.repeat(64), node: 10 });
    expect(sent?.[1].replace).toEqual({ Set: 'edited' });
    pane.stop();
  }); // End of the "sends its own target" case

  it('offers the editor for a writable snippet and withdraws it for a read-only file', async () => {
    // The control is withdrawn rather than opening into a dead end, which is the
    // rule the raw editor's *Edit* control already follows: this application will
    // not write a read-only file, so offering to edit one is a promise it cannot
    // keep.
    const pane = await mountPane();
    await pane.state.select(snippetOf(pane.state, 1));
    flushSync();
    expect(pane.target.textContent).toContain(DICTIONARIES.en['browser.matchEditor.open']);

    await pane.state.select(snippetOf(pane.state, 2));
    flushSync();
    expect(pane.target.textContent).not.toContain(DICTIONARIES.en['browser.matchEditor.open']);
    pane.stop();
  }); // End of the "editor offered" case

  it('opens the deletion panel from the pane, over the snippet and its own parse', async () => {
    // **Reachability, which no test of `MatchDeleter.svelte` can establish.** That
    // suite mounts the panel directly; this is the claim that a person can get to
    // it at all, and that what it opens over is the selected snippet rather than
    // whatever the pane happened to be holding.
    const pane = await mountPane();
    await pane.state.select(snippetOf(pane.state, 1));
    flushSync();

    control(pane.target, 'browser.matchDeletion.open').click();
    flushSync();

    // `match/a.yml` holds exactly one snippet, so what opens is the consult's Q6
    // on the running pane: the panel names the snippet and its file, says why this
    // one may not be deleted, and asks nothing. The two-phase question over a file
    // that *can* lose a snippet is `MatchDeleter.test.ts`'s.
    expect(pane.target.textContent).toContain(':a');
    expect(pane.target.textContent).toContain('match/a.yml');
    expect(pane.target.textContent).toContain(
      DICTIONARIES.en['browser.matchDeletion.refused.lastSnippet']
    );
    expect(pane.target.textContent).not.toContain(
      DICTIONARIES.en['browser.matchDeletion.question']
    );
    // The panel outranks the pane's read-only subjects while it is open, so the
    // openers beside it are withdrawn rather than drawn under a pending question.
    expect(pane.target.textContent).not.toContain(DICTIONARIES.en['browser.matchEditor.open']);
    expect(pane.target.textContent).not.toContain(DICTIONARIES.en['browser.matchCreation.open']);
    pane.stop();
  }); // End of the "deletion reachable" case

  it('opens the duplicate panel from the pane, over the snippet and its own parse', async () => {
    // **Reachability, which no test of `MatchDuplicator.svelte` can establish.**
    // That suite mounts the panel directly; this is the claim that a person can
    // get to it at all, that what it opens over is the selected snippet, and that
    // the pane's own `unsavedDraftInDocument` producer answers rather than
    // throwing — a `true` from it would refuse a snippet nothing is being edited.
    const pane = await mountPane();
    await pane.state.select(snippetOf(pane.state, 1));
    flushSync();

    control(pane.target, 'browser.matchDuplication.open').click();
    flushSync();

    expect(pane.target.textContent).toContain(':a');
    expect(pane.target.textContent).toContain('match/a.yml');
    expect(pane.target.textContent).toContain(
      DICTIONARIES.en['browser.matchDuplication.landsAfterSource']
    );
    // No editor is open, so no draft is held for this file and the copy is
    // offered rather than refused.
    expect(pane.target.textContent).not.toContain(
      DICTIONARIES.en['browser.matchDuplication.refused.unsavedDraftInDocument']
    );
    expect(control(pane.target, 'browser.matchDuplication.duplicate').disabled).toBe(false);
    // The panel outranks the pane's read-only subjects while it is open, so the
    // openers beside it are withdrawn rather than drawn under it.
    expect(pane.target.textContent).not.toContain(DICTIONARIES.en['browser.matchEditor.open']);
    expect(pane.target.textContent).not.toContain(DICTIONARIES.en['browser.matchCreation.open']);
    pane.stop();
  }); // End of the "duplicate reachable" case

  it('opens the restore pane from the file\u2019s whole-text surface, over its own parse', async () => {
    // **Reachability, which no test of `RestorePane.svelte` can establish.** That
    // suite mounts the pane directly; this is the claim that a person can get to
    // it at all — from the file's whole text, which is where a whole-file
    // replacement belongs (consult Q5) — and that what it opens over is the file
    // the viewer is pointed at.
    const pane = await mountPane();
    await pane.state.select(snippetOf(pane.state, 1));
    await pane.state.showFileText(true);
    flushSync();
    expect(pane.target.textContent).toContain('wholefiletext');

    control(pane.target, 'browser.restore.open').click();
    flushSync();

    expect(pane.target.textContent).toContain(
      DICTIONARIES.en['browser.restore.warning']
    );
    expect(pane.target.textContent).toContain('match/a.yml');
    // The pane outranks this pane's read-only subjects and its other write
    // surfaces while it is open, so the openers beside it are withdrawn.
    expect(pane.target.textContent).not.toContain(DICTIONARIES.en['browser.matchCreation.open']);
    expect(pane.target.textContent).not.toContain(DICTIONARIES.en['browser.rawEditor.open']);
    pane.stop();
  }); // End of the "restore reachable" case

  it('sends the restore pane\u2019s catalogue read through the injected surface', async () => {
    // **The trap 2c-5-4a handed forward, closed by a mount rather than by a
    // type.** `BackupCommands` has a real production default, so a
    // `createBrowserState` call that omitted it would reach `invoke` here; the
    // hoisted mock at the top of this file rejects, so the case would fail rather
    // than pass quietly.
    const pane = await mountPane();
    await pane.state.select(snippetOf(pane.state, 1));
    await pane.state.showFileText(true);
    flushSync();
    control(pane.target, 'browser.restore.open').click();
    flushSync();

    control(pane.target, 'browser.restore.listBatches').click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    flushSync();

    expect(pane.backup.listBackupBatches).toHaveBeenCalledTimes(1);
    expect(invoked).not.toHaveBeenCalled();
    // A missing backups folder is an outcome and not a failure, and the pane says
    // so with the core's own sentence.
    expect(pane.target.textContent).toContain(
      DICTIONARIES.en['code.backupRootState.missing']
    );
    pane.stop();
  }); // End of the "catalogue through the injected surface" case

  it('opens the new-snippet form with nothing selected, and offers every file', async () => {
    // The form asks which file itself rather than inheriting the selection, so it
    // has to be reachable with nothing selected — which is exactly the state a
    // person adding their first snippet is in.
    const pane = await mountPane();
    expect(pane.state.selected).toBeNull();

    control(pane.target, 'browser.matchCreation.open').click();
    flushSync();

    const listed = [...pane.target.querySelectorAll('.destinations button')].map((one) =>
      one.textContent?.trim()
    );
    // Both files, the read-only one included: the consult's Q5 says every file the
    // window lists is offered, with a reason on the ones it cannot write.
    expect(listed).toEqual(['match/a.yml', 'match/b.yml']);
    expect(pane.target.textContent).toContain(
      DICTIONARIES.en['browser.matchCreation.destination.readOnly']
    );
    pane.stop();
  }); // End of the "creation reachable" case
}); // End of the "mounted detail pane" suite
