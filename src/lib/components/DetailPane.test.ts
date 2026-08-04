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
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeDocument, makeMatch, makeSummary } from '../browser/fixtures';
import {
  createBrowserState,
  type BrowserCommands,
  type BrowserState
} from '../browser/workspace.svelte';
import { DICTIONARIES, type TranslationKey } from '../i18n/dictionaries';
import { locale } from '../stores/locale.svelte';
import type { CommandResult } from '../ipc/commands';
import type {
  DocumentSummary,
  DocumentView,
  MatchView,
  SaveResult,
  WorkspaceSummary
} from '../ipc/types';
import DetailPane from './DetailPane.svelte';

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
      makeMatch({ node: 10, document: 1, revision: 'a'.repeat(64), trigger: ':a', replace: 'ay' })
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
      makeMatch({ node: 20, document: 2, revision: 'b'.repeat(64), trigger: ':b', replace: 'bee' })
    ]
  });
} // End of function documentB()

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
 * A command surface that answers the two documents above.
 *
 * Only the commands this pane's path reaches are given real answers; the rest
 * refuse, which is what a state test would want anyway — a pane that started
 * calling one of them would be visible rather than silently satisfied.
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
    documentText: vi.fn(async (): Promise<CommandResult<string>> => refusal),
    moveMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
    saveMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
    createMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
    deleteMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
    duplicateMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
    saveRawDocument: vi.fn(async () => refusal)
  };
} // End of function scriptedCommands()

/** A mounted pane and what a case needs to drive it. */
interface Mounted {
  /** Where the pane was mounted. */
  readonly target: HTMLElement;
  /** The state it is drawing. */
  readonly state: BrowserState;
  /** The commands behind that state. */
  readonly commands: BrowserCommands;
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
  const state = createBrowserState(commands, () => undefined);
  await state.open(null);
  const target = document.createElement('div');
  document.body.append(target);
  const component = mount(DetailPane, { target, props: { browser: state } });
  flushSync();
  return {
    target,
    state,
    commands,
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
  locale.setOverride('en');
});

afterEach(() => {
  locale.setOverride(null);
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
