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
import type { OpenWriteSurface, OpenWriteSurfaceKind } from '../browser/restore';
import {
  createBrowserState,
  type BackupCommands,
  type BrowserCommands,
  type BrowserState
} from '../browser/workspace.svelte';
import { DICTIONARIES, translate, type TranslationKey } from '../i18n/dictionaries';
import { locale } from '../stores/locale.svelte';
import type { CommandResult, RawSaveOutcome, ReloadAfterRawSave } from '../ipc/commands';
import type {
  Acknowledgement,
  BackupBatchId,
  BackupBatchListing,
  BackupEntry,
  BackupEntryListing,
  BackupTextResponse,
  ContentRevision,
  DocumentId,
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
 * The recognised backup batch the restore cases list.
 *
 * Phase 2d-5-2b, and the reason this file needs a catalogue at all: reaching
 * {@link DetailPane}'s own `invalidateEverySurface` takes a restore that actually
 * commits, and a restore that commits takes a batch, an entry and a read.
 */
const BATCH: BackupBatchId = { name: '2026-02-03T040506Z-000' };

/** The entry that batch holds for `match/a.yml`. */
const ENTRY: BackupEntry = {
  id: { batch: BATCH, relative_path: 'match/a.yml' },
  display_path: 'match/a.yml',
  length: '24',
  target: { InConfigRoot: { relative_path: 'match/a.yml' } }
};

/** The bytes that entry holds, which a committed restore writes whole. */
const CANDIDATE = 'matches:\n  - trigger: ":restored"\n    replace: restoredbytes\n';

/** The hash of those bytes, which is never a base revision. */
const CANDIDATE_REVISION: ContentRevision = 'e'.repeat(64);

/** The revision `match/a.yml` holds once the replacement has been written. */
const RESTORED_REVISION: ContentRevision = 'f'.repeat(64);

/** The answer a replacement that ran to the end and wrote the file comes back with. */
const COMMITTED: SaveResult = {
  outcome: 'saved',
  revision: RESTORED_REVISION,
  committed: true,
  notes: [],
  backup_taken: true,
  moved: null
};

/** One whole-file replacement this file's scripted boundary was asked for. */
interface RecordedRawSave {
  /** The file it would write. */
  readonly document: DocumentId;
  /** The revision it was drafted against. */
  readonly baseRevision: ContentRevision;
  /** The text it would write, whole. */
  readonly text: string;
  /** The suspicions already shown to a person. */
  readonly acknowledgement: Acknowledgement;
}

/**
 * How many times any surface built by {@link scriptedCommands} has been drained.
 *
 * Module level rather than per-surface because the assertion is about the file:
 * **no case in it may drain through the injected surface**. That bound is the
 * whole claim, and the other route is live here rather than hypothetical: these
 * cases mount over a **real** `BrowserState`, and `workspace.svelte.ts` holds a
 * module-level `drainExternalChanges` binding that increments nothing in this
 * count. *No component imports the wrapper* is true and is narrower than what
 * this file executes, so it is not the bound. What this file does have, and the
 * count is not, is a partial trap: the `invoke` mock at the top of the file
 * rejects, so a drain taking that route would record on `invoked` — but `invoked`
 * is asserted case by case and never in the `afterEach`, so it catches nothing
 * file-wide. The `afterEach` below reads and resets the count.
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
 * @param saves - Where a whole-file replacement is recorded, or `null` when the
 *   case does not drive one. With `null` the command refuses, which is what every
 *   case before Phase 2d-5-2b needed; with an array it commits, re-projects the
 *   file in this surface's own map and discharges the caller's reload, which is
 *   the sequence the real command performs.
 * @returns The commands, with `vi.fn` wrappers so calls can be inspected.
 */
function scriptedCommands(saves: RecordedRawSave[] | null = null): BrowserCommands {
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
    // The same map `getDocument` reads, so a re-read after a committed
    // replacement answers the projection the write installed rather than the one
    // it replaced.
    reloadDocument: vi.fn(async (id: number): Promise<CommandResult<DocumentView>> => {
      const held = views.get(id);
      return held === undefined ? refusal : { ok: true, value: held };
    }),
    documentText: vi.fn(async (id: number): Promise<CommandResult<string>> => {
      return id === 1 ? { ok: true, value: FILE_TEXT } : refusal;
    }),
    moveMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
    saveMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
    createMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
    deleteMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
    duplicateMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
    saveRawDocument: vi.fn(
      async (
        document: DocumentId,
        baseRevision: ContentRevision,
        text: string,
        acknowledgement: Acknowledgement,
        reload: ReloadAfterRawSave
      ): Promise<RawSaveOutcome> => {
        if (saves === null) {
          return refusal;
        }
        saves.push({ document, baseRevision, text, acknowledgement });
        // The real command re-projects before it answers, and the state's own
        // closure is what installs it, so the map has to move first.
        views.set(
          document,
          makeDocument({
            id: document,
            relativePath: 'match/a.yml',
            revision: RESTORED_REVISION,
            matches: []
          })
        );
        await reload({ document, revision: RESTORED_REVISION });
        return { ok: true, value: COMMITTED, reload: { kind: 'done' } };
      }
    ),
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
 * @param stocked - Whether the catalogue holds anything. `false` answers a
 *   missing backups folder, which is what every case before Phase 2d-5-2b wanted;
 *   `true` answers one batch, one entry and one read, which is the least a restore
 *   needs to reach a commit.
 * @returns The commands, with `vi.fn` wrappers so calls can be inspected.
 */
function scriptedBackup(stocked = false): BackupCommands {
  const refusal: CommandResult<never> = {
    ok: false,
    failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
  };
  return {
    listBackupBatches: vi.fn(async (): Promise<CommandResult<BackupBatchListing>> => {
      return {
        ok: true,
        value: {
          root: stocked ? 'Present' : 'Missing',
          batches: stocked ? [{ id: BATCH, display_name: BATCH.name }] : [],
          skipped: [],
          unrecognised: 0,
          unreadable: 0,
          complete: true
        }
      };
    }),
    listBackupEntries: vi.fn(async (): Promise<CommandResult<BackupEntryListing>> => {
      return stocked
        ? {
            ok: true,
            value: {
              batch: BATCH,
              entries: [ENTRY],
              skipped: [],
              unrecognised: 0,
              unreadable: 0,
              unaddressable: 0,
              complete: true
            }
          }
        : refusal;
    }),
    readBackupText: vi.fn(async (): Promise<CommandResult<BackupTextResponse>> => {
      return stocked
        ? {
            ok: true,
            value: {
              entry: ENTRY,
              document: 1,
              text: CANDIDATE,
              revision: CANDIDATE_REVISION
            }
          }
        : refusal;
    })
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
  /** Every whole-file replacement the boundary was asked for, in order. */
  readonly saves: readonly RecordedRawSave[];
  /** Tears the pane down. */
  readonly stop: () => void;
}

/**
 * Opens a workspace and mounts the pane over it.
 *
 * @param stocked - Whether the backup catalogue holds a batch, an entry and a
 *   readable text. Only the cases that drive a restore to a commit need one.
 * @returns The mounted pane.
 */
async function mountPane(stocked = false): Promise<Mounted> {
  const saves: RecordedRawSave[] = [];
  const commands = scriptedCommands(stocked ? saves : null);
  const backup = scriptedBackup(stocked);
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
    saves,
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
 * @param params - What the key's placeholders stand for, when it has any.
 * @returns The button.
 */
function control(
  target: HTMLElement,
  key: TranslationKey,
  params?: Readonly<Record<string, string | number>>
): HTMLButtonElement {
  const label = params === undefined ? DICTIONARIES.en[key] : translate('en', key, params);
  const found = [...target.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === label
  );
  if (found === undefined) {
    throw new Error(`this case needs the control labelled ${label}`);
  }
  return found;
} // End of function control()

/**
 * The button that chooses one backup entry, which wears the entry's own path.
 *
 * A display path is data rather than a sentence, so it is matched literally — the
 * one label on this screen that is not a dictionary value.
 *
 * @param target - Where the pane was mounted.
 * @param path - The entry's display path.
 * @returns The button.
 */
function entryControl(target: HTMLElement, path: string): HTMLButtonElement {
  const found = [...target.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === path
  );
  if (found === undefined) {
    throw new Error(`this case needs the entry ${path}`);
  }
  return found;
} // End of function entryControl()

/**
 * Waits for the pane's asynchronous handlers to finish.
 *
 * A macrotask rather than a fixed number of microtask ticks.
 */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync();
} // End of function settle()

/**
 * Every surface the state's registry holds, as a plain comparable value.
 *
 * A helper rather than an inline read so that every case asserts the **whole**
 * live set: an assertion that one kind is present would pass while a second
 * registration nobody asked for stood beside it.
 *
 * @param state - The state to ask.
 * @returns Its live surfaces, oldest registration first.
 */
function registered(state: BrowserState): readonly OpenWriteSurface[] {
  return state.openWriteSurfaces();
} // End of function registered()

/** What {@link watchSurfaceAnswers} records, and how to read past it. */
interface SurfaceAnswers {
  /** Every answer the door has given since the watch began, in order. */
  readonly given: readonly (readonly OpenWriteSurface[])[];
  /** The unwatched door, for a read the recording must not see. */
  readonly direct: () => readonly OpenWriteSurface[];
}

/**
 * Records every answer `browser.openWriteSurfaces()` gives while the pane is up.
 *
 * **What this observes, and it is the whole reason it exists.** `DetailPane.svelte`
 * passes the restore `surfaces={() => browser.openWriteSurfaces()}` and that
 * closure is the **only** call to this door in any component, so what the door
 * answers while a restore is open is what the child's `$derived.by` was handed.
 * Reading the registry directly cannot establish that: `competingSurfaceFor` skips
 * `restore` entries, so an empty list and a list holding only the restore's own
 * entry draw identically — which is Phase 2d-5-2b's review, finding 2.
 *
 * **What it does not observe** is what `RestorePane.svelte` then does with the
 * value. That is a different case, and it is the one that opens a surface late and
 * looks for the sentence it must draw.
 *
 * @param state - The state to watch. Its method is replaced for the rest of the
 *   case; nothing restores it, because a case owns its own state.
 * @returns The recording, and the unwatched door.
 */
function watchSurfaceAnswers(state: BrowserState): SurfaceAnswers {
  const direct = state.openWriteSurfaces.bind(state);
  const given: (readonly OpenWriteSurface[])[] = [];
  state.openWriteSurfaces = (): readonly OpenWriteSurface[] => {
    const answered = direct();
    given.push(answered);
    return answered;
  };
  return { given, direct };
} // End of function watchSurfaceAnswers()

/**
 * The trigger box of the new-snippet form, inside this pane.
 *
 * Scoped to the form rather than to the pane, because the pane draws boxes of its
 * own elsewhere in the chain and a case about the form must not find one of those.
 *
 * @param target - Where the pane was mounted.
 * @returns The form's trigger `<input>`.
 */
function creatorTrigger(target: HTMLElement): HTMLInputElement {
  const found = target.querySelector('.creator input.text');
  if (!(found instanceof HTMLInputElement)) {
    throw new Error('this case needs the new-snippet form’s trigger box');
  }
  return found;
} // End of function creatorTrigger()

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

/** How one of the pane's seven write surfaces is opened, and how it is closed. */
interface SurfaceWalk {
  /**
   * Gets the pane into the state where the opener is drawn, and presses it.
   *
   * @param pane - The mounted pane.
   */
  readonly open: (pane: Mounted) => Promise<void>;
  /** The control that closes it again. */
  readonly close: TranslationKey;
  /** What the registry must hold while it is open. */
  readonly expected: OpenWriteSurface;
}

/**
 * Every kind, and how to open it from the pane.
 *
 * **Typed as `Record<OpenWriteSurfaceKind, …>` on purpose.** The assembly in
 * `DetailPane.svelte` is what makes omitting a kind a compile error in the
 * composition file; this makes omitting one a compile error in the file that
 * proves the composition works, so an eighth kind cannot be added, registered and
 * left untested. What neither can force is that the walk below opens the surface
 * it names — only the assertion on the live set does that.
 */
const WALKS: Record<OpenWriteSurfaceKind, SurfaceWalk> = {
  matchEditor: {
    open: async (pane) => {
      await pane.state.select(snippetOf(pane.state, 1));
      flushSync();
      control(pane.target, 'browser.matchEditor.open').click();
    },
    close: 'browser.matchEditor.close',
    expected: { kind: 'matchEditor', target: { kind: 'document', document: 1 } }
  },
  matchCreator: {
    open: async (pane) => {
      control(pane.target, 'browser.matchCreation.open').click();
      return Promise.resolve();
    },
    close: 'browser.matchCreation.close',
    // **The one kind that may name no file**, and the state it registers in: the
    // form has been opened and nobody has chosen a destination.
    expected: { kind: 'matchCreator', target: { kind: 'unknown' } }
  },
  matchDeleter: {
    open: async (pane) => {
      await pane.state.select(snippetOf(pane.state, 1));
      flushSync();
      control(pane.target, 'browser.matchDeletion.open').click();
    },
    close: 'browser.matchDeletion.close',
    expected: { kind: 'matchDeleter', target: { kind: 'document', document: 1 } }
  },
  matchMover: {
    open: async (pane) => {
      await pane.state.select(snippetOf(pane.state, 1));
      flushSync();
      control(pane.target, 'browser.matchMove.open').click();
    },
    close: 'browser.matchMove.close',
    expected: { kind: 'matchMover', target: { kind: 'document', document: 1 } }
  },
  matchDuplicator: {
    open: async (pane) => {
      await pane.state.select(snippetOf(pane.state, 1));
      flushSync();
      control(pane.target, 'browser.matchDuplication.open').click();
    },
    close: 'browser.matchDuplication.close',
    expected: { kind: 'matchDuplicator', target: { kind: 'document', document: 1 } }
  },
  rawEditor: {
    open: async (pane) => {
      await pane.state.select(snippetOf(pane.state, 1));
      await pane.state.showFileText(true);
      flushSync();
      control(pane.target, 'browser.rawEditor.open').click();
    },
    close: 'browser.rawEditor.close',
    expected: { kind: 'rawEditor', target: { kind: 'document', document: 1 } }
  },
  restore: {
    open: async (pane) => {
      await pane.state.select(snippetOf(pane.state, 1));
      await pane.state.showFileText(true);
      flushSync();
      control(pane.target, 'browser.restore.open').click();
    },
    close: 'browser.restore.close',
    expected: { kind: 'restore', target: { kind: 'document', document: 1 } }
  }
};

describe('the pane as a write-surface host', () => {
  for (const [kind, walk] of Object.entries(WALKS)) {
    it(`registers and unregisters its ${kind}`, async () => {
      // **The claim the assembly cannot make.** `satisfies
      // Record<OpenWriteSurfaceKind, …>` forces every kind to be *mentioned* in
      // `DetailPane.svelte`; it cannot force the entry filed under a key to be
      // true of the surface that key names, and it cannot force the host to
      // register or to dispose at all. This is where each of those is measured.
      const pane = await mountPane();
      expect(registered(pane.state)).toEqual([]);

      await walk.open(pane);
      flushSync();
      expect(registered(pane.state)).toEqual([walk.expected]);

      control(pane.target, walk.close).click();
      flushSync();
      expect(registered(pane.state)).toEqual([]);
      pane.stop();
    }); // End of the per-kind registration case
  } // End of the loop over the seven kinds

  it('returns every lease when the pane is unmounted', async () => {
    // Nothing in TypeScript forces a host to call the unregister it was handed —
    // `UnregisterWriteSurface` says so in its own comment — so teardown is a
    // mounted fact or it is nothing. A pane torn down with a surface still open is
    // the case that matters: closing it first would prove only what the case above
    // already proves.
    const pane = await mountPane();
    await WALKS.matchEditor.open(pane);
    flushSync();
    expect(registered(pane.state)).toHaveLength(1);

    pane.stop();
    expect(registered(pane.state)).toEqual([]);
    // **A registry assertion since Phase 2d-5-2b-A's review, finding 1.** This door
    // used to answer the reactive mirror, so the number here and the set above came
    // from two places and could disagree with nothing failing; it now answers
    // `writeSurfaceRegistry`'s own generation, which is the stronger oracle — one
    // registration and one unregister, counted by the thing that performed them.
    // What it consequently no longer observes is the *mirror*, which is why the two
    // reactive cases below exist — between them they cover all three of the
    // `noticeWriteSurfaces()` call sites.
    expect(pane.state.writeSurfaceGeneration()).toBe(2);
  }); // End of the "unmount returns every lease" case

  it('moves the new-snippet form from no file to its chosen one in place', async () => {
    // **The creator's unknown-to-known transition, and that it goes through the
    // lease.** The consult says no type can force a child to invoke its required
    // reporter correctly, so this is a mounted fact or it is nothing: what is
    // asserted is not only that the target moved but that the generation moved by
    // exactly **one**, which an unregister-and-register would have moved by two.
    //
    // **The generation read is the registry's own since Phase 2d-5-2b-A's review,
    // finding 1**, which makes this a stronger claim than it was: the number and
    // the set below now come from the same place, so "moved by one" is the
    // registry's own account of what the lease did to it. It says nothing about the
    // reactive mirror — that is the re-targeting case further down.
    const pane = await mountPane();
    control(pane.target, 'browser.matchCreation.open').click();
    flushSync();
    expect(registered(pane.state)).toEqual([
      { kind: 'matchCreator', target: { kind: 'unknown' } }
    ]);
    const before = pane.state.writeSurfaceGeneration();

    const destinations = [...pane.target.querySelectorAll('.destinations button')];
    const chosen = destinations.find((one) => one.textContent?.trim() === 'match/a.yml');
    if (!(chosen instanceof HTMLButtonElement)) {
      throw new Error('this case needs the destination control for match/a.yml');
    }
    chosen.click();
    flushSync();

    expect(registered(pane.state)).toEqual([
      { kind: 'matchCreator', target: { kind: 'document', document: 1 } }
    ]);
    expect(pane.state.writeSurfaceGeneration()).toBe(before + 1);
    pane.stop();
  }); // End of the "creator reports its destination" case

  it('forgets a reported destination when the form is closed and opened again', async () => {
    // A destination reported by one form must not describe the next: the pane
    // clears it on both edges, and the form's own report arrives only when the
    // child's effect flushes. Without the clear, the second form would be
    // registered over `match/a.yml` before it had chosen anything.
    const pane = await mountPane();
    control(pane.target, 'browser.matchCreation.open').click();
    flushSync();
    const destinations = [...pane.target.querySelectorAll('.destinations button')];
    const chosen = destinations.find((one) => one.textContent?.trim() === 'match/a.yml');
    if (!(chosen instanceof HTMLButtonElement)) {
      throw new Error('this case needs the destination control for match/a.yml');
    }
    chosen.click();
    flushSync();
    control(pane.target, 'browser.matchCreation.close').click();
    flushSync();

    control(pane.target, 'browser.matchCreation.open').click();
    flushSync();
    expect(registered(pane.state)).toEqual([
      { kind: 'matchCreator', target: { kind: 'unknown' } }
    ]);
    pane.stop();
  }); // End of the "a reported destination does not outlive its form" case

  it('leaves a registration standing across an open(), which is the decided cost', async () => {
    // **`2d-5-2a-notes.md` section 3.8, re-taken at 2d-5-2b rather than restated.**
    // `open()` deliberately does not clear the registry, and this is what that
    // costs when a host survives one: the entry stands, naming a `DocumentId` the
    // load below `open()` has reallocated. Both consumers of that answer refuse
    // rather than permit, so a write stays safe; what it costs is a false refusal
    // over an unrelated file.
    //
    // **In production no host survives an `open()`**, and that is why the decision
    // stands: `AppShell.svelte` draws this pane only in its `{:else}` arm, and
    // `open()` sets `status` to `loading` synchronously before its first await —
    // asserted below, because that is the half that is not obvious from reading
    // the markup. The pane is then unmounted and returns its leases. Clearing here
    // would be the unsafe direction instead: a host that *did* survive would go on
    // holding an open surface the registry no longer reports.
    const pane = await mountPane();
    await WALKS.matchEditor.open(pane);
    flushSync();
    expect(registered(pane.state)).toEqual([WALKS.matchEditor.expected]);

    const opening = pane.state.open(null);
    expect(pane.state.status).toBe('loading');
    await opening;
    flushSync();

    expect(registered(pane.state)).toEqual([WALKS.matchEditor.expected]);
    pane.stop();
  }); // End of the "a registration survives an open()" case

  it('gives the restore its surfaces from the registry, itself included', async () => {
    // **Restore's behaviour is unchanged, and this is what "unchanged" means.**
    // The pane used to hand the restore an array it built itself; it now hands it
    // `browser.openWriteSurfaces()`. The list has to hold the same thing it held
    // before — the restore's own entry, over the file it opened on — because
    // `competingSurfaceFor` skips `restore` entries and a list without it would
    // pass the gate for the wrong reason.
    //
    // **The list itself is what this case reads**, and that is Phase 2d-5-2b's
    // review, finding 2: reading the registry cannot establish this claim, because
    // an empty list and a list holding only the restore's own entry produce exactly
    // the same screen. What is asserted is the **last** answer the door gave, which
    // is the value the child's derived holds — the first answer is taken before
    // this pane's registration effect has run and is legitimately empty, which the
    // case below is about.
    const pane = await mountPane();
    const answers = watchSurfaceAnswers(pane.state);
    await WALKS.restore.open(pane);
    flushSync();

    expect(answers.given.length).toBeGreaterThan(0);
    expect(answers.given[answers.given.length - 1]).toEqual([WALKS.restore.expected]);
    expect(answers.direct()).toEqual([WALKS.restore.expected]);
    // A restore does not refuse itself, so none of the six competing-surface
    // sentences is drawn.
    for (const key of [
      'browser.restore.refused.matchEditorOpen',
      'browser.restore.refused.matchCreatorOpen',
      'browser.restore.refused.matchDeleterOpen',
      'browser.restore.refused.matchMoverOpen',
      'browser.restore.refused.matchDuplicatorOpen',
      'browser.restore.refused.rawEditorOpen'
    ] as const) {
      expect(pane.target.textContent).not.toContain(DICTIONARIES.en[key]);
    } // End of the loop over the six competing-surface refusals
    // What this *pane* cannot draw is a second surface beside the restore — `busy`
    // makes its seven mutually exclusive — so the case below registers one the way
    // a second host would, and `RestorePane.test.ts` drives the refusal arms
    // themselves over a surface list of its own.
    pane.stop();
  }); // End of the "restore's surfaces come from the registry" case

  it('shows the restore a surface that opened after its derived had run', async () => {
    // **Phase 2d-5-2b's review, finding 1**: the reading the restore holds has to
    // move when the live set does. It did not. `browser.openWriteSurfaces()` read a
    // plain `Map`, so `RestorePane.svelte`'s `$derived.by` had no dependency any
    // registration moved — and the ordering makes that concrete rather than
    // theoretical, because the child's derived runs *before* this pane's
    // registration effect and therefore always computes over a registry that is one
    // step behind. Under-refusal: a restore could be sent past a surface writing the
    // same file.
    //
    // **The registration here is a second host's, and that is the point.** This pane
    // keeps its own seven mutually exclusive, so nothing it draws can put a
    // competing surface beside an open restore; what a later host can do is exactly
    // this call. The observation is a sentence on screen and a disabled control,
    // which only the value the child received can produce.
    const pane = await mountPane(true);
    await WALKS.restore.open(pane);
    flushSync();
    control(pane.target, 'browser.restore.listBatches').click();
    await settle();
    control(pane.target, 'browser.restore.batchNamed', { name: BATCH.name }).click();
    await settle();
    entryControl(pane.target, 'match/a.yml').click();
    await settle();

    const editorOpen = DICTIONARIES.en['browser.restore.refused.matchEditorOpen'];
    expect(pane.target.textContent).not.toContain(editorOpen);
    expect(control(pane.target, 'browser.restore.prepare').disabled).toBe(false);

    const lease = pane.state.registerWriteSurface(
      { kind: 'matchEditor', target: { kind: 'document', document: 1 } },
      () => undefined
    );
    flushSync();

    expect(pane.target.textContent).toContain(editorOpen);
    expect(control(pane.target, 'browser.restore.prepare').disabled).toBe(true);

    // The other half of the same claim: closing that surface reaches the restore
    // too. The unregister goes through the lease rather than through the door, so
    // this is what establishes that the lease moves the mirror as well.
    lease();
    flushSync();

    expect(pane.target.textContent).not.toContain(editorOpen);
    expect(control(pane.target, 'browser.restore.prepare').disabled).toBe(false);
    expect(registered(pane.state)).toEqual([WALKS.restore.expected]);
    pane.stop();
  }); // End of the "a late surface reaches the restore" case

  it('shows the restore a surface that was re-targeted onto its file', async () => {
    // **The third `noticeWriteSurfaces()` call site, observed reactively** — Phase
    // 2d-5-2b-A's review, finding 2. Three operations move the live set through
    // `BrowserState`, and each has to bring the mirror into step. The case above
    // covers two of them: the registration inside `registerWriteSurface` makes the
    // refusal sentence appear, and the lease's unregister makes it go. The one left
    // is the lease's `replaceTarget`, whose only coverage was a
    // `writeSurfaceGeneration()` assertion — and that door now answers the
    // registry's own number rather than the mirror, so **no generation assertion
    // anywhere can observe the mirror**. A reactive consumer is the only thing that
    // can, and this is one.
    //
    // **A creator that names no file competes with nothing**, which is what makes
    // the two halves of this case different: registering one beside the restore
    // draws no refusal, and pointing it at the restore's own file *through the
    // lease* is a registry mutation that reaches the screen only if the mirror
    // moved with it. Nothing else in that block invalidates the child's
    // `$derived.by`, so the sentence appearing is the observation and not a
    // coincidence of re-rendering.
    //
    // **Only the second half is an oracle, and Phase 2d-5-2b-B's finding 3 is that
    // saying "different" invited the other reading.** The first half's
    // `not.toContain` held before the registration too, so it passes identically
    // whether the mirror moved or the child's `$derived.by` never re-ran at all: it
    // is a **negative control** establishing the starting screen. The `not.toContain`
    // can fail only if registering an unknown-target creator wrongly *draws* the
    // creator refusal; its neighbour, the `disabled` assertion, is weaker still and
    // can fail on any other refusal arm — `noCandidate` or `targetMoved` — with no
    // creator refusal drawn anywhere. That is Phase 2d-5-2b-C's finding 5: the
    // sentence was written of "the first half" and was true of only one of its two
    // assertions.
    //
    // **What that control is *for*, since it is not the evidence.** The evidence for
    // the third `noticeWriteSurfaces()` site is below the `replaceTarget`; this half
    // is what makes the `toContain` down there a *change* rather than a screen that
    // might have said so all along. Necessary to the reading, and not an oracle for
    // the mirror — the two are different jobs.
    //
    // **The registration is a second host's, exactly as above.** This pane keeps
    // its seven surfaces mutually exclusive through `busy`, so it can never draw a
    // creator beside an open restore itself.
    const pane = await mountPane(true);
    await WALKS.restore.open(pane);
    flushSync();
    control(pane.target, 'browser.restore.listBatches').click();
    await settle();
    control(pane.target, 'browser.restore.batchNamed', { name: BATCH.name }).click();
    await settle();
    entryControl(pane.target, 'match/a.yml').click();
    await settle();

    const creatorOpen = DICTIONARIES.en['browser.restore.refused.matchCreatorOpen'];
    const lease = pane.state.registerWriteSurface(
      { kind: 'matchCreator', target: { kind: 'unknown' } },
      () => undefined
    );
    flushSync();

    expect(pane.target.textContent).not.toContain(creatorOpen);
    expect(control(pane.target, 'browser.restore.prepare').disabled).toBe(false);

    // The answer travels back unchanged through the mirroring wrapper, which is the
    // half of `mirroringLease` a screen cannot show.
    expect(lease.replaceTarget({ kind: 'document', document: 1 })).toBe('replaced');
    flushSync();

    expect(pane.target.textContent).toContain(creatorOpen);
    expect(control(pane.target, 'browser.restore.prepare').disabled).toBe(true);
    expect(registered(pane.state)).toEqual([
      WALKS.restore.expected,
      { kind: 'matchCreator', target: { kind: 'document', document: 1 } }
    ]);

    // Released before the pane stops. **Not for the sibling case's reason** — Phase
    // 2d-5-2b-C's finding 6. That case's `lease()` is an observed step, with a
    // `flushSync()` and three assertions after it, and its comment calls it "the other
    // half of the same claim"; this one is bare cleanup, placed after the last
    // assertion so it can mask nothing. This lease is this block's own — no host owns
    // it — and `mountPane`'s `stop()` unmounts the component without disposing the
    // state, so releasing it is symmetry with the sibling's *placement* rather than a
    // leak that would otherwise outlive the case.
    lease();
    pane.stop();
  }); // End of the "a re-targeted surface reaches the restore" case

  it('leaves the registry alone when the form reports the same file again', async () => {
    // **The case `MatchCreator.test.ts` cites, which did not exist until Phase
    // 2d-5-2b's review** (finding 3). That file establishes that the child reports
    // again on a transition that leaves the destination where it was — typing moves
    // no file and still reports one — and says the host absorbs the repeat. This is
    // the host absorbing it: `creatorDestination` is `$state.raw`, an equal
    // assignment notifies nothing, the reconciling effect is not entered, and the
    // registry's generation does not move.
    //
    // **The generation is the assertion because the entry alone would not be.** A
    // re-registration would leave an identical surface behind it, so a case reading
    // only the live set would pass over the churn this is about.
    //
    // **Since Phase 2d-5-2b-A's review, finding 1, that generation is the
    // registry's own**, which is what makes "did not move" mean anything here: a
    // mirror can fail to move because the registry did not, or because a mirroring
    // call was missing, and only the registry's number distinguishes them.
    const pane = await mountPane();
    control(pane.target, 'browser.matchCreation.open').click();
    flushSync();
    const destinations = [...pane.target.querySelectorAll('.destinations button')];
    const chosen = destinations.find((one) => one.textContent?.trim() === 'match/a.yml');
    if (!(chosen instanceof HTMLButtonElement)) {
      throw new Error('this case needs the destination control for match/a.yml');
    }
    chosen.click();
    flushSync();
    const reported = pane.state.writeSurfaceGeneration();
    expect(registered(pane.state)).toEqual([
      { kind: 'matchCreator', target: { kind: 'document', document: 1 } }
    ]);

    const trigger = creatorTrigger(pane.target);
    trigger.value = ':typed';
    trigger.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();

    expect(pane.state.writeSurfaceGeneration()).toBe(reported);
    expect(registered(pane.state)).toEqual([
      { kind: 'matchCreator', target: { kind: 'document', document: 1 } }
    ]);
    pane.stop();
  }); // End of the "a repeat report churns nothing" case

  it('runs the whole-document invalidation when a restore commits', async () => {
    // **The coverage gap `PROGRESS.md` names**, closed. `invalidateEverySurface`
    // had exactly one call site — the `invalidate` prop — reached only inside the
    // restore's send path, which no case in this repository walked.
    //
    // **Reaching the committed sentence is what proves the body ran.**
    // `openWholeDocumentSave` is the only way to learn a whole-document outcome
    // and it discharges the invalidation on the way, so a screen that says the
    // file was written is a screen whose host's body was called. What this case
    // does **not** establish is that the body closes anything: `busy` keeps every
    // other surface shut while a restore is open, so there is nothing for it to
    // close, and 2d-5-1-B measured that deleting a line from it breaks no test in
    // this repository.
    const pane = await mountPane(true);
    await WALKS.restore.open(pane);
    flushSync();

    control(pane.target, 'browser.restore.listBatches').click();
    await settle();
    control(pane.target, 'browser.restore.batchNamed', { name: BATCH.name }).click();
    await settle();
    entryControl(pane.target, 'match/a.yml').click();
    await settle();
    control(pane.target, 'browser.restore.prepare').click();
    flushSync();
    control(pane.target, 'browser.restore.confirm').click();
    await settle();

    expect(pane.saves).toEqual([
      {
        document: 1,
        baseRevision: 'a'.repeat(64),
        text: CANDIDATE,
        acknowledgement: { accepted: [] }
      }
    ]);
    expect(pane.target.textContent).toContain(DICTIONARIES.en['browser.saveOutcome.fileWritten']);
    // The restore pane itself is the one surface the invalidation leaves open, so
    // its registration is still there for the outcome to be read against.
    expect(registered(pane.state)).toEqual([WALKS.restore.expected]);
    expect(invoked).not.toHaveBeenCalled();
    pane.stop();
  }); // End of the "the invalidation runs" case
}); // End of the "pane as a write-surface host" suite
