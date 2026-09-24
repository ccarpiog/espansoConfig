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
import { recoveryChoiceKey, recoveryRefusalKey, sourceConflictStateKey } from '../browser/recovery';
import { externalEvidenceRefusalKey, reapplyOutcomeKey } from '../browser/reapply';
import { conflictChoiceKey } from '../browser/saveOutcome';
import type { OpenWriteSurface, OpenWriteSurfaceKind } from '../browser/restore';
import {
  createBrowserState,
  type BackupCommands,
  type BrowserCommands,
  type BrowserState
} from '../browser/workspace.svelte';
import type { ExternalConflictObservation } from '../browser/conflictSource';
import type { ObservationDelivery } from '../browser/observationDelivery';
import { DICTIONARIES, translate, type TranslationKey } from '../i18n/dictionaries';
import { LOCALES, type Locale } from '../i18n/locale';
import { locale } from '../stores/locale.svelte';
import type { CommandResult, RawSaveOutcome, ReloadAfterRawSave } from '../ipc/commands';
import type {
  ReconciliationEventSource,
  ReconciliationUnlisten,
  ReconciliationWakeHandler
} from '../ipc/events';
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
  ExternalObservation,
  MatchId,
  MatchView,
  OwnedItemText,
  ReconciliationBatch,
  SaveResult,
  WorkspaceSummary
} from '../ipc/types';
import DetailPane from './DetailPane.svelte';

/**
 * The Tauri boundary, replaced for the whole file — on the same terms as
 * `workspace.test.ts` since Phase 2d-5-6 (ruling 34).
 *
 * `vi.hoisted` because a `vi.mock` factory is lifted above every import and
 * cannot close over an ordinary `const`. It **rejects**: a call that got this far
 * is already the defect, and a stub that answered would let a case pass.
 *
 * **What is mocked is `@tauri-apps/api/core` and not `$lib/ipc/commands`**, so
 * the real wrappers and the real `REAL_COMMANDS` assembly stay in place, and a
 * wrapper in `workspace.svelte.ts` that reaches a binding it imports at module
 * level — rather than the surface it was injected with — runs down to this spy.
 * The `afterEach` below holds it to zero in every case. That closes the route
 * **in this file**: nothing in Vitest prevents a future test file from importing
 * `$lib/ipc/commands` with no spy at all.
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

/**
 * A raw save of `match/a.yml` that failed after its rename may have happened —
 * the shape `mayHaveWritten` in `../ipc/errors` answers `true` for (Phase
 * 2d-6-11a, after `ReconciliationStatus.test.ts`'s fixture).
 */
const RAW_WRITE_MAY_HAVE_HAPPENED = {
  ok: false,
  failure: {
    kind: 'command',
    error: {
      code: 'saveFailed',
      error: {
        Write: {
          Io: {
            step: 'SyncDirectory',
            path: '/tmp/espanso/match/a.yml',
            kind: 'Interrupted',
            raw_os_error: 4
          }
        }
      },
      may_have_written: true
    }
  }
} as unknown as RawSaveOutcome;

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
 * The `afterSequence` argument of every drain any surface built by
 * {@link scriptedCommands} was asked for, in call order — Phase 2d-6-11a.
 *
 * Module level rather than per-surface because the assertion is about the file:
 * **a case drains through the injected surface exactly as it declares, and no
 * other way**. The other route is live here rather than hypothetical: these cases
 * mount over a **real** `BrowserState`, and `workspace.svelte.ts` holds a
 * module-level `drainExternalChanges` binding that records nothing here. *No
 * component imports the wrapper* is true and is narrower than what this file
 * executes, so it is not the bound. That route is the hoisted `invoke` spy's:
 * since Phase 2d-5-6 the `afterEach` below holds `invoked` to zero in every case,
 * so a drain taking it is caught file-wide and by command name. The `afterEach`
 * reads and resets this list beside it.
 */
const drainArguments: number[] = [];

/**
 * The exact, ordered `afterSequence` arguments the running case expects its
 * drains to be asked with — Phase 2d-6-11a, replacing 2d-6-6b's count (the 2d-6
 * record's ruling 36).
 *
 * **Empty unless a case says otherwise**, which is every case that starts no
 * reconciliation: for those the `afterEach` asserts exactly zero drains. A
 * delivery case starts the coordinator over a finite queue of batches
 * ({@link PaneScript.batches}) and assigns the whole list it expects — the
 * registration's drain, the open's, then one per wake after the newest sequence
 * the previous batch reported. The `afterEach` compares the recorded list with
 * `toEqual`, which fixes the count and every argument; there is no relaxed
 * allowance. It resets this to empty.
 */
let expectedDrainArguments: readonly number[] = [];

/**
 * What a case scripts beyond the two files — Phase 2d-6-6b.
 *
 * Every field is optional and absent means what every earlier case had: the two
 * files above, a refused `save_match`, and a drain that refuses.
 */
interface PaneScript {
  /** The files the workspace lists, in window order. */
  readonly files?: readonly DocumentSummary[];
  /** Their projections, which `get_document` answers by identity. */
  readonly views?: readonly DocumentView[];
  /** What `save_match` answers, called once per save. */
  readonly saveMatch?: () => Promise<CommandResult<SaveResult>>;
  /**
   * What `match_item_text` answers, called once per read (Phase 3-8-2). Absent,
   * it refuses, as every earlier case had it.
   */
  readonly matchItemText?: (id: MatchId) => Promise<CommandResult<OwnedItemText>>;
  /** What `delete_match` answers, called once per deletion (Phase 2d-6-7a). */
  readonly deleteMatch?: () => Promise<CommandResult<SaveResult>>;
  /**
   * What `save_raw_document` answers, called once per raw save (Phase 2d-6-8a).
   * When given, it replaces the stocked commit below and runs no reload.
   */
  readonly saveRawDocument?: () => Promise<RawSaveOutcome>;
  /** The batches the drain answers, in order; past the end it refuses. */
  readonly batches?: CommandResult<ReconciliationBatch>[];
  /**
   * What `reload_document` answers for one file, or `undefined` to answer the
   * held projection as every earlier case did (Phase 2d-6-8b). Read at each call,
   * so a case can move the file on between two wakes.
   */
  readonly reloadDocument?: (id: DocumentId) => DocumentView | undefined;
  /**
   * What `document_text` answers for one file, or `undefined` to answer
   * {@link FILE_TEXT} for `match/a.yml` as every earlier case did (Phase 2d-6-8b).
   */
  readonly documentText?: (id: DocumentId) => string | undefined;
  /**
   * A gate the stocked raw-save commit awaits before it writes anything, so a
   * case can hold a committing save in flight (Phase 2d-6-11a). Absent, the
   * stocked commit runs straight through, as it did for every earlier case.
   */
  readonly rawSaveGate?: Promise<void>;
}

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
function scriptedCommands(
  saves: RecordedRawSave[] | null = null,
  script: PaneScript = {}
): BrowserCommands {
  const refusal: CommandResult<never> = {
    ok: false,
    failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
  };
  const views = new Map<number, DocumentView>(
    (script.views ?? [documentA(), documentB()]).map((view) => [view.id, view])
  );
  const batches = [...(script.batches ?? [])];
  return {
    openWorkspace: vi.fn(async (): Promise<CommandResult<WorkspaceSummary>> => {
      return { ok: true, value: SUMMARY };
    }),
    listDocuments: vi.fn(async (): Promise<CommandResult<readonly DocumentSummary[]>> => {
      return { ok: true, value: script.files ?? FILES };
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
      const moved = script.reloadDocument?.(id);
      if (moved !== undefined) {
        views.set(id, moved);
      }
      const held = views.get(id);
      return held === undefined ? refusal : { ok: true, value: held };
    }),
    documentText: vi.fn(async (id: number): Promise<CommandResult<string>> => {
      const scripted = script.documentText?.(id);
      if (scripted !== undefined) {
        return { ok: true, value: scripted };
      }
      return id === 1 ? { ok: true, value: FILE_TEXT } : refusal;
    }),
    moveMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
    saveMatch: vi.fn(
      async (): Promise<CommandResult<SaveResult>> =>
        script.saveMatch === undefined ? refusal : script.saveMatch()
    ),
    createMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
    deleteMatch: vi.fn(
      async (): Promise<CommandResult<SaveResult>> =>
        script.deleteMatch === undefined ? refusal : script.deleteMatch()
    ),
    duplicateMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
    matchItemText: vi.fn(
      async (id: MatchId): Promise<CommandResult<OwnedItemText>> =>
        script.matchItemText === undefined ? refusal : script.matchItemText(id)
    ),
    saveMatchItemText: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
    saveRawDocument: vi.fn(
      async (
        document: DocumentId,
        baseRevision: ContentRevision,
        text: string,
        acknowledgement: Acknowledgement,
        reload: ReloadAfterRawSave
      ): Promise<RawSaveOutcome> => {
        if (script.saveRawDocument !== undefined) {
          return script.saveRawDocument();
        }
        if (saves === null) {
          return refusal;
        }
        if (script.rawSaveGate !== undefined) {
          await script.rawSaveGate;
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
    // on, and `drainArguments` is what makes such a call *visible* — a `vi.fn`
    // records a call and asserts nothing about it, so a fire-and-forget drain that
    // ignored this answer would pass every case here. The `afterEach` below is the
    // assertion, bounded as the list's own doc comment states.
    //
    // **Since Phase 2d-6-6b a case may script batches** (entry 36): the queue is
    // finite and a drain past its end refuses. Since Phase 2d-6-11a every drain's
    // `afterSequence` is recorded, and the case states the exact ordered list it
    // expects in {@link expectedDrainArguments}.
    drainExternalChanges: vi.fn(
      async (afterSequence: number): Promise<CommandResult<ReconciliationBatch>> => {
        drainArguments.push(afterSequence);
        return batches.shift() ?? refusal;
      }
    )
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
 * @param script - What the commands answer beyond the defaults (Phase 2d-6-6b).
 * @param events - A wake transport, when the case starts the reconciliation
 *   lifecycle; `null` leaves it unstarted, as every case before 2d-6-6b did.
 * @returns The mounted pane.
 */
async function mountPane(
  stocked = false,
  script: PaneScript = {},
  events: ReconciliationEventSource | null = null
): Promise<Mounted> {
  const saves: RecordedRawSave[] = [];
  const commands = scriptedCommands(stocked ? saves : null, script);
  const backup = scriptedBackup(stocked);
  const state =
    events === null
      ? createBrowserState(commands, () => undefined, backup)
      : createBrowserState(commands, () => undefined, backup, events);
  if (events !== null) {
    // **The lifecycle in `AppShell.svelte`'s order** (Phase 2d-6-6b): the
    // registration drains first and alone, then the open drains, so a case can
    // count both before it wakes the window.
    state.start();
    await settle();
  }
  await state.open(null);
  if (events !== null) {
    await settle();
  }
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
      // Every coordinator created is disposed before its case ends (ruling 35).
      // Only the delivery cases of Phase 2d-6-6b start one; it is here so that
      // the rule holds for every state this file builds rather than for the ones
      // a case remembers.
      state.dispose();
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
  // Read, then cleared, then asserted, so one defect fails one case rather than
  // every case after it. The route first (ruling 34): a wrapper that reached the
  // real `invoke` is reported here by command name, and zero is the number in
  // every case because even an intended drain must use the injected boundary.
  const drained = [...drainArguments];
  const expected = expectedDrainArguments;
  drainArguments.length = 0;
  expectedDrainArguments = [];
  expect(invoked).not.toHaveBeenCalled();
  // Then the drains themselves (ruling 35; entry 36), as an exact ordered list of
  // `afterSequence` arguments per case (Phase 2d-6-11a): empty — zero drains — for
  // every case that starts no reconciliation, and for a delivery case the list it
  // declared, which fixes both how many drains ran and where each resumed. This is
  // the assertion `scriptedCommands()`'s refusal cannot make on its own.
  expect(drained).toEqual(expected);
}); // End of the afterEach that closes the route and the drain arguments

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

/** How one of the pane's nine write surfaces is opened, and how it is closed. */
interface SurfaceWalk {
  /** What the commands answer beyond the defaults, when the walk needs it. */
  readonly script?: PaneScript;
  /**
   * Gets the pane into the state where the opener is drawn, and presses it.
   *
   * @param pane - The mounted pane.
   */
  readonly open: (pane: Mounted) => Promise<void>;
  /** The control that closes it again. */
  readonly close: TranslationKey;
  /** A confirmation the close asks for, pressed after it when it is drawn. */
  readonly confirm?: TranslationKey;
  /**
   * The surface open **beside** it, which closing it leaves registered — the
   * recovery form's host (the 2d-6 record's §5.1). Absent for the other eight.
   */
  readonly beside?: OpenWriteSurface;
  /** What the registry must hold while it is open. */
  readonly expected: OpenWriteSurface;
}

/**
 * A `save_match` answer that ran into a conflict over `match/a.yml` — Phase
 * 2d-6-6b.
 *
 * Its evidence names no snippet (`Unsupported`), so *Keep my draft* resolves
 * nothing and the editor offers recovery: the one route to a recovery form
 * through the pane's real controls.
 *
 * @returns The command's answer.
 */
async function conflictedSave(): Promise<CommandResult<SaveResult>> {
  return {
    ok: true,
    value: {
      outcome: 'conflict',
      reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
      expected: 'a'.repeat(64),
      found: 'c'.repeat(64),
      disk_revision: 'c'.repeat(64),
      disk_text: 'matches:\n  - trigger: ":a"\n    replace: theirs\n',
      disk: makeDocument({
        id: 1,
        relativePath: 'match/a.yml',
        revision: 'c'.repeat(64),
        matches: [
          makeMatch({
            node: 10,
            document: 1,
            revision: 'c'.repeat(64),
            trigger: ':a',
            replace: 'theirs',
            path: matchListPath(0)
          })
        ]
      })
    }
  };
} // End of function conflictedSave()

/**
 * Opens the editor over `match/a.yml`'s snippet, edits it, and saves into the
 * scripted conflict — Phase 2d-6-6b.
 *
 * @param pane - A pane mounted with {@link conflictedSave} as its `save_match`.
 * @param lang - The locale the pane is drawing in, whose labels the controls are
 *   found by (Phase 2d-6-6c-1); English unless a case says otherwise.
 */
async function editorInSaveConflict(pane: Mounted, lang: Locale = 'en'): Promise<void> {
  await pane.state.select(snippetOf(pane.state, 1));
  flushSync();
  controlIn(pane.target, lang, 'browser.matchEditor.open').click();
  flushSync();
  const body = pane.target.querySelector('.matchEditor textarea');
  if (!(body instanceof HTMLTextAreaElement)) {
    throw new Error('this case needs the editor’s body box');
  }
  body.value = 'mine';
  body.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
  controlIn(pane.target, lang, 'browser.matchEditor.save').click();
  await settle();
} // End of function editorInSaveConflict()

/**
 * Takes the editor's save conflict to recovery and opens the form — Phase 2d-6-6b.
 *
 * @param pane - A pane whose editor shows {@link conflictedSave}'s conflict.
 * @param lang - The locale the pane is drawing in (Phase 2d-6-6c-1).
 */
function openRecoveryForm(pane: Mounted, lang: Locale = 'en'): void {
  controlIn(pane.target, lang, conflictChoiceKey('keepMyDraft', 'authoredText')).click();
  flushSync();
  controlIn(pane.target, lang, recoveryChoiceKey('createFromSupportedFields')).click();
  flushSync();
} // End of function openRecoveryForm()

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
    // **One of the two kinds that may name no file**, and the state it registers in: the
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
  // **The ninth kind, Phase 3-8-2.** Opened over a snippet whose read the
  // default script refuses, so the editor draws its refusal and still registers:
  // the surface is the editor being open, not a session being drafted.
  rawSnippetEditor: {
    open: async (pane) => {
      await pane.state.select(snippetOf(pane.state, 1));
      flushSync();
      control(pane.target, 'browser.rawSnippet.open').click();
      await settle();
    },
    close: 'browser.rawSnippet.close',
    expected: { kind: 'rawSnippetEditor', target: { kind: 'document', document: 1 } }
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
  },
  // **The eighth kind, and the one opened beside another** (Phase 2d-6-6b). The
  // form reports its own target up through the editor that mounts it, so the
  // registry holds the editor and the form at once, and closing the form leaves
  // the editor registered.
  recovery: {
    script: { saveMatch: conflictedSave },
    open: async (pane) => {
      await editorInSaveConflict(pane);
      openRecoveryForm(pane);
    },
    close: 'browser.recovery.close',
    confirm: 'browser.recovery.discard',
    beside: { kind: 'matchEditor', target: { kind: 'document', document: 1 } },
    expected: { kind: 'recovery', target: { kind: 'document', document: 1 } }
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
      const pane = await mountPane(false, walk.script);
      expect(registered(pane.state)).toEqual([]);

      await walk.open(pane);
      flushSync();
      const beside = walk.beside === undefined ? [] : [walk.beside];
      expect(registered(pane.state)).toEqual([...beside, walk.expected]);

      control(pane.target, walk.close).click();
      flushSync();
      const confirm = walk.confirm;
      if (confirm !== undefined && pane.target.textContent?.includes(DICTIONARIES.en[confirm])) {
        control(pane.target, confirm).click();
        flushSync();
      }
      expect(registered(pane.state)).toEqual(beside);
      pane.stop();
    }); // End of the per-kind registration case
  } // End of the loop over the nine kinds

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
    // costs when a host survives one: the entry stands, naming a surface about the
    // workspace the load below `open()` replaced. The identity is path-stable, so
    // what is stale is the projection behind it and whether the new workspace holds
    // the file at all. Both consumers of that answer refuse rather than permit, so
    // a write stays safe; what it costs is a false refusal over a file nobody is
    // really editing.
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

/**
 * A wake transport this file drives — Phase 2d-6-6b.
 *
 * Its registration resolves at once, so `start()` drains for the registration and
 * `open()` drains again, and each {@link PaneEvents.wake} asks for one more.
 */
interface PaneEvents {
  /** What `createBrowserState` is given. */
  readonly source: ReconciliationEventSource;
  /**
   * Delivers one wake.
   *
   * @param epoch - Its `workspace_epoch`.
   * @param newest - Its `newest_sequence`.
   */
  wake(epoch: number, newest: number): void;
}

/**
 * Builds a wake transport whose registration resolves on its own.
 *
 * @returns The source, and the handle that wakes the window.
 */
function paneEvents(): PaneEvents {
  let handler: ReconciliationWakeHandler | null = null;
  /** Ends the subscription; nothing here counts it. */
  const unlisten: ReconciliationUnlisten = () => undefined;
  return {
    source: {
      /**
       * Registers, and resolves immediately.
       *
       * @param wakeHandler - Where a wake goes.
       * @returns The unlisten.
       */
      subscribe(wakeHandler: ReconciliationWakeHandler): Promise<ReconciliationUnlisten> {
        handler = wakeHandler;
        return Promise.resolve(unlisten);
      }
    },
    wake: (epoch: number, newest: number): void => {
      handler?.({ workspace_epoch: epoch, newest_sequence: newest });
    }
  };
} // End of function paneEvents()

/**
 * One drained batch.
 *
 * @param newest - Its `newest_sequence`.
 * @param observations - What it carries.
 * @returns A successful command answer.
 */
function batch(
  newest: number,
  observations: readonly ExternalObservation[] = []
): CommandResult<ReconciliationBatch> {
  return {
    ok: true,
    value: { epoch: 5, newest_sequence: newest, observations: [...observations], discarded: 0 }
  };
} // End of function batch()

/**
 * The disk projection an observation of one file carries.
 *
 * @param document - The file.
 * @param relativePath - Its path.
 * @param revision - The disk revision.
 * @returns The projection.
 */
function diskView(document: DocumentId, relativePath: string, revision: ContentRevision): DocumentView {
  return makeDocument({
    id: document,
    relativePath,
    revision,
    matches: [
      makeMatch({
        node: 90,
        document,
        revision,
        trigger: ':disk',
        replace: 'ondisk',
        path: matchListPath(0)
      })
    ]
  });
} // End of function diskView()

/**
 * One `Changed` observation whose bytes projected, as the drain carries it.
 *
 * @param sequence - The sequence it was admitted under.
 * @param document - The file.
 * @param relativePath - Its path.
 * @param revision - The disk revision it read.
 * @returns The wire observation.
 */
function changed(
  sequence: number,
  document: DocumentId,
  relativePath: string,
  revision: ContentRevision = 'c'.repeat(64)
): ExternalObservation {
  return {
    Changed: {
      sequence,
      document: { Addressable: { document, relative_path: relativePath } },
      previous_revision: 'a'.repeat(64),
      disk_revision: revision,
      content: {
        Projected: {
          disk_text: 'matches:\n  - trigger: ":disk"\n    replace: ondisk\n',
          disk: diskView(document, relativePath, revision),
          findings: [],
          correspondences: null
        }
      }
    }
  };
} // End of function changed()

/**
 * One narrowed observation, for the case that tells the window directly.
 *
 * @param sequence - Its sequence.
 * @param document - The file.
 * @param relativePath - Its path.
 * @param revision - The disk revision it read.
 * @returns The observation, as the window narrows one.
 */
function narrowed(
  sequence: number,
  document: DocumentId,
  relativePath: string,
  revision: ContentRevision
): ExternalConflictObservation {
  return {
    sequence,
    document,
    previousRevision: 'a'.repeat(64),
    diskRevision: revision,
    diskText: 'matches:\n  - trigger: ":disk"\n    replace: ondisk\n',
    disk: diskView(document, relativePath, revision),
    findings: [],
    correspondences: null
  };
} // End of function narrowed()

/** The third file the cross-file cases need: writable, and creator-eligible. */
const FILE_C: DocumentSummary = makeSummary({ id: 3, relativePath: 'match/c.yml' });

/**
 * The projection of `match/c.yml`.
 *
 * @returns The document view.
 */
function documentC(): DocumentView {
  return makeDocument({
    id: 3,
    relativePath: 'match/c.yml',
    revision: 'd'.repeat(64),
    matches: [
      makeMatch({
        node: 30,
        document: 3,
        revision: 'd'.repeat(64),
        trigger: ':c',
        replace: 'cy',
        path: matchListPath(0)
      })
    ]
  });
} // End of function documentC()

/** Three files: two writable (`a`, `c`) and one read-only (`b`). */
const THREE_FILES: PaneScript = {
  files: [...FILES, FILE_C],
  views: [documentA(), documentB(), documentC()]
};

/** One envelope one registration was handed. */
interface Delivered {
  /** Which registration, counted from zero in the order they were made. */
  readonly registration: number;
  /** The file it was registered over. */
  readonly document: DocumentId;
  /** The envelope. */
  readonly delivery: ObservationDelivery;
}

/** What {@link watchDeliveries} records. */
interface DeliveryLog {
  /** Every envelope handed to a registration made since the watch began. */
  readonly delivered: readonly Delivered[];
  /**
   * The files the registrations still live were made over, in order.
   *
   * @returns The files.
   */
  live(): readonly DocumentId[];
}

/**
 * Records every receiver registration the pane makes, and what each is handed.
 *
 * **Through the real door.** The pane registers through
 * `browser.registerObservationReceiver`, read at the call, so replacing the
 * method on the state records each registration and wraps its receiver without
 * changing what the window does: the wrapped receiver is what the window
 * delivers to, and it calls the pane's own.
 *
 * @param state - The state to watch.
 * @returns The log.
 */
function watchDeliveries(state: BrowserState): DeliveryLog {
  const direct = state.registerObservationReceiver.bind(state);
  const delivered: Delivered[] = [];
  const registrations: { document: DocumentId; live: boolean }[] = [];
  state.registerObservationReceiver = (document, receiver) => {
    const registration = registrations.length;
    const entry = { document, live: true };
    registrations.push(entry);
    const unregister = direct(document, (delivery) => {
      delivered.push({ registration, document, delivery });
      receiver(delivery);
    });
    return (): void => {
      entry.live = false;
      unregister();
    };
  };
  return {
    delivered,
    live: () => registrations.filter((one) => one.live).map((one) => one.document)
  };
} // End of function watchDeliveries()

/**
 * The button whose label is one key's rendering in one locale.
 *
 * @param target - Where the pane was mounted.
 * @param lang - The locale the pane is drawing in.
 * @param key - The key holding the label.
 * @returns The button.
 */
function controlIn(target: HTMLElement, lang: Locale, key: TranslationKey): HTMLButtonElement {
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
 * The first text box inside one element of the pane.
 *
 * @param target - Where the pane was mounted.
 * @param selector - The box's selector.
 * @returns The box.
 */
function box(target: HTMLElement, selector: string): HTMLInputElement | HTMLTextAreaElement {
  const found = target.querySelector(selector);
  if (!(found instanceof HTMLInputElement) && !(found instanceof HTMLTextAreaElement)) {
    throw new Error(`this case needs the box ${selector}`);
  }
  return found;
} // End of function box()

/**
 * The destination button naming one file, inside one form.
 *
 * @param target - Where the pane was mounted.
 * @param scope - The form's selector.
 * @param path - The file's path.
 * @returns The button.
 */
function destinationIn(target: HTMLElement, scope: string, path: string): HTMLButtonElement {
  const found = [...target.querySelectorAll(`${scope} button`)].find(
    (candidate) => candidate.textContent?.trim() === path
  );
  if (!(found instanceof HTMLButtonElement)) {
    throw new Error(`this case needs the destination ${path} in ${scope}`);
  }
  return found;
} // End of function destinationIn()

/**
 * Lets a wake's drain, the coordinator and the pane's handlers finish.
 */
async function settleWake(): Promise<void> {
  await settle();
  await settle();
} // End of function settleWake()

/** How many times each of the three read commands has been called — Phase 2d-6-11a. */
interface ReadCounts {
  /** `get_document`. */
  readonly getDocument: number;
  /** `reload_document`. */
  readonly reloadDocument: number;
  /** `document_text`. */
  readonly documentText: number;
}

/**
 * The call counts of the three commands that could reload or re-read a file.
 *
 * Taken before and after a wake, two equal readings say no read of any file ran
 * across it — which is what "no automatic reload" means at this boundary.
 *
 * @param pane - The mounted pane.
 * @returns The three counts.
 */
function readCounts(pane: Mounted): ReadCounts {
  return {
    getDocument: vi.mocked(pane.commands.getDocument).mock.calls.length,
    reloadDocument: vi.mocked(pane.commands.reloadDocument).mock.calls.length,
    documentText: vi.mocked(pane.commands.documentText).mock.calls.length
  };
} // End of function readCounts()

describe('the pane as a delivery host — Phase 2d-6-6b', () => {
  // **Through the real registry and the real coordinator boundary** (the 2d-6
  // record's §3 entry 34): every case below opens its surfaces through the pane's
  // controls, starts the reconciliation lifecycle over a finite scripted queue of
  // drains (entry 36, their arguments declared exactly in
  // `expectedDrainArguments`), and wakes the window — so the observation is
  // admitted by the coordinator, routed by
  // `targetingSurfaceFor`, handed to the transition this pane registered, and
  // arbitrated once by `BrowserState.observeExternalChange`. What these cases
  // assert is what 6b wires — the session's state as its controls show it, a
  // submission refused, one decision — and not the sentences the conflict panels
  // draw, which the Phase 2d-6-6c-1 suite at the end of this file reads.

  it.each(LOCALES)('a pristine editor conflicts, and refuses to submit (%s)', async (lang) => {
    expectedDrainArguments = [0, 0, 0];
    const events = paneEvents();
    const pane = await mountPane(
      false,
      { batches: [batch(0), batch(0), batch(5, [changed(5, 1, 'match/a.yml')])] },
      events.source
    );
    locale.setOverride(lang);
    const log = watchDeliveries(pane.state);
    await pane.state.select(snippetOf(pane.state, 1));
    flushSync();
    controlIn(pane.target, lang, 'browser.matchEditor.open').click();
    flushSync();
    expect(box(pane.target, '.matchEditor textarea').readOnly).toBe(false);
    expect(log.live()).toEqual([1]);

    events.wake(5, 5);
    await settleWake();

    // **Pristine, and told all the same** (R36): the arbitration asks nothing
    // about whether the draft was edited.
    expect(log.delivered.map((one) => one.delivery.verdict.kind)).toEqual(['raised']);
    expect(pane.state.standingConflictFor(1)?.kind).toBe('externalChange');
    expect(box(pane.target, '.matchEditor textarea').readOnly).toBe(true);
    const save = controlIn(pane.target, lang, 'browser.matchEditor.save');
    expect(save.disabled).toBe(true);
    // The file is protected rather than reloaded under the editor.
    expect(pane.state.externalDocumentStatus(1)).toEqual({ kind: 'stale' });
    expect(pane.commands.reloadDocument).not.toHaveBeenCalled();
    expect(pane.commands.saveMatch).not.toHaveBeenCalled();
    pane.stop();
  }); // End of the "pristine editor conflicts" case

  it.each([
    [1, 'match/a.yml'],
    [3, 'match/c.yml']
  ] as const)(
    'an unknown-target creator is delivered about every eligible file, and blocked by a change to %i',
    async (affected, path) => {
      expectedDrainArguments = [0, 0, 0];
      const events = paneEvents();
      const pane = await mountPane(
        false,
        { ...THREE_FILES, batches: [batch(0), batch(0), batch(5, [changed(5, affected, path)])] },
        events.source
      );
      const log = watchDeliveries(pane.state);
      control(pane.target, 'browser.matchCreation.open').click();
      flushSync();
      expect(registered(pane.state)).toEqual([
        { kind: 'matchCreator', target: { kind: 'unknown' } }
      ]);
      // **Every creator-eligible file and only those** — the read-only `b` is not
      // one, which is `targetingSurfaceFor`'s attribution of an unknown target.
      expect(log.live()).toEqual([1, 3]);

      events.wake(5, 5);
      await settleWake();

      expect(log.delivered.map((one) => [one.document, one.delivery.verdict.kind])).toEqual([
        [affected, 'raised']
      ]);
      expect(creatorTrigger(pane.target).readOnly).toBe(true);
      // **The delivery chose nothing** (Phase 2d-6-11a): before any destination is
      // pressed the registration is still over no file, every eligible file is
      // still registered, no destination is marked chosen, and the send refuses.
      expect(registered(pane.state)).toEqual([
        { kind: 'matchCreator', target: { kind: 'unknown' } }
      ]);
      expect(log.live()).toEqual([1, 3]);
      expect(
        [...pane.target.querySelectorAll('.creator .destinations button')].map((one) =>
          one.getAttribute('aria-pressed')
        )
      ).toEqual(['false', 'false', 'false']);
      expect(control(pane.target, 'browser.matchCreation.create').disabled).toBe(true);
      // **The destination stays choosable** (`canChooseDestination`, 2d-6-3's
      // carry-over): naming a file is the one way forward entry 21 leaves open.
      const destination = destinationIn(pane.target, '.creator', path);
      expect(destination.disabled).toBe(false);
      destination.click();
      flushSync();
      // Naming the affected file keeps the conflict, and the send stays refused.
      expect(registered(pane.state)).toEqual([
        { kind: 'matchCreator', target: { kind: 'document', document: affected } }
      ]);
      expect(log.live()).toEqual([affected]);
      expect(control(pane.target, 'browser.matchCreation.create').disabled).toBe(true);
      expect(creatorTrigger(pane.target).readOnly).toBe(true);
      expect(pane.commands.createMatch).not.toHaveBeenCalled();
      expect(pane.commands.reloadDocument).not.toHaveBeenCalled();
      pane.stop();
    }
  ); // End of the "unknown-target creator" case

  it('protects a recovery destination B while the host editor stays over A', async () => {
    expectedDrainArguments = [0, 0, 0];
    const events = paneEvents();
    const pane = await mountPane(
      false,
      {
        ...THREE_FILES,
        saveMatch: conflictedSave,
        batches: [batch(0), batch(0), batch(5, [changed(5, 3, 'match/c.yml')])]
      },
      events.source
    );
    const log = watchDeliveries(pane.state);
    await editorInSaveConflict(pane);
    openRecoveryForm(pane);
    destinationIn(pane.target, '.recovery', 'match/c.yml').click();
    flushSync();
    expect(registered(pane.state)).toEqual([
      { kind: 'matchEditor', target: { kind: 'document', document: 1 } },
      { kind: 'recovery', target: { kind: 'document', document: 3 } }
    ]);
    expect(log.live()).toEqual([1, 3]);
    const hostOrigin = pane.state.standingConflictFor(1);
    expect(hostOrigin?.kind).toBe('save');

    events.wake(5, 5);
    await settleWake();

    // **One delivery, to the form's registration over `c`, and none to the host.**
    expect(log.delivered.map((one) => [one.document, one.delivery.verdict.kind])).toEqual([
      [3, 'raised']
    ]);
    expect(box(pane.target, '.recovery textarea').readOnly).toBe(true);
    expect(control(pane.target, 'browser.recovery.create').disabled).toBe(true);
    expect(pane.state.externalDocumentStatus(3)).toEqual({ kind: 'stale' });
    // The host is where it was: still over `a`, its own origin still standing.
    expect(registered(pane.state)[0]).toEqual({
      kind: 'matchEditor',
      target: { kind: 'document', document: 1 }
    });
    expect(pane.state.standingConflictFor(1)).toBe(hostOrigin);
    expect(pane.commands.reloadDocument).not.toHaveBeenCalled();
    expect(pane.commands.createMatch).not.toHaveBeenCalled();
    pane.stop();
  }); // End of the "recovery over B" case

  it('gives a host and its recovery form over one file one decision', async () => {
    expectedDrainArguments = [0, 0, 0];
    const events = paneEvents();
    const pane = await mountPane(
      false,
      {
        saveMatch: conflictedSave,
        batches: [batch(0), batch(0), batch(5, [changed(5, 1, 'match/a.yml', 'd'.repeat(64))])]
      },
      events.source
    );
    const log = watchDeliveries(pane.state);
    await editorInSaveConflict(pane);
    openRecoveryForm(pane);
    expect(registered(pane.state)).toEqual([
      { kind: 'matchEditor', target: { kind: 'document', document: 1 } },
      { kind: 'recovery', target: { kind: 'document', document: 1 } }
    ]);
    const reads = readCounts(pane);

    events.wake(5, 5);
    await settleWake();

    // **Nothing reloaded and nothing installed** (Phase 2d-6-11a): no read
    // command ran across the wake, and the window still holds file 1 at the
    // revision it opened over.
    expect(readCounts(pane)).toEqual(reads);
    expect(pane.state.views.find((view) => view.id === 1)?.revision).toBe('a'.repeat(64));
    // **Two recipients, one envelope** (entry 2): never `raised` for one and
    // `coalesced` for the other.
    expect(log.delivered).toHaveLength(2);
    const [first, second] = log.delivered;
    expect(new Set(log.delivered.map((one) => one.registration)).size).toBe(2);
    expect(second?.delivery).toBe(first?.delivery);
    expect(first?.delivery.verdict.kind).toBe('supersedes');
    expect(box(pane.target, '.recovery textarea').readOnly).toBe(true);
    expect(control(pane.target, 'browser.recovery.create').disabled).toBe(true);
    expect(pane.commands.createMatch).not.toHaveBeenCalled();
    pane.stop();
  }); // End of the "one decision" case

  it('never hands a reopened editor what its previous instance was told', async () => {
    expectedDrainArguments = [0, 0, 0, 5];
    const events = paneEvents();
    const pane = await mountPane(
      false,
      {
        batches: [
          batch(0),
          batch(0),
          batch(5, [changed(5, 1, 'match/a.yml')]),
          batch(6, [changed(6, 1, 'match/a.yml', 'd'.repeat(64))])
        ]
      },
      events.source
    );
    const log = watchDeliveries(pane.state);
    await pane.state.select(snippetOf(pane.state, 1));
    flushSync();
    control(pane.target, 'browser.matchEditor.open').click();
    flushSync();
    events.wake(5, 5);
    await settleWake();
    expect(box(pane.target, '.matchEditor textarea').readOnly).toBe(true);

    control(pane.target, 'browser.matchEditor.close').click();
    flushSync();
    expect(log.live()).toEqual([]);
    control(pane.target, 'browser.matchEditor.open').click();
    flushSync();
    // **A fresh session**: the old instance's delivery did not follow it.
    expect(box(pane.target, '.matchEditor textarea').readOnly).toBe(false);
    expect(log.live()).toEqual([1]);

    events.wake(5, 6);
    await settleWake();
    // The first registration was told once and never again; only the second —
    // the reopened editor's — was told of the later reading.
    expect(log.delivered.map((one) => one.registration)).toEqual([0, 1]);
    expect(box(pane.target, '.matchEditor textarea').readOnly).toBe(true);
    pane.stop();
  }); // End of the "reopened editor" case

  it('lands a settlement after the save it settles, in the order it was decided', async () => {
    expectedDrainArguments = [0, 0, 0];
    const events = paneEvents();
    let answer: ((value: CommandResult<SaveResult>) => void) | null = null;
    const pane = await mountPane(
      false,
      {
        saveMatch: () =>
          new Promise<CommandResult<SaveResult>>((resolve) => {
            answer = resolve;
          }),
        batches: [batch(0), batch(0), batch(5, [changed(5, 1, 'match/a.yml')])]
      },
      events.source
    );
    const log = watchDeliveries(pane.state);
    await pane.state.select(snippetOf(pane.state, 1));
    flushSync();
    control(pane.target, 'browser.matchEditor.open').click();
    flushSync();
    const body = box(pane.target, '.matchEditor textarea');
    body.value = 'mine';
    body.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    control(pane.target, 'browser.matchEditor.save').click();
    await settle();
    expect(pane.commands.saveMatch).toHaveBeenCalledTimes(1);

    // **Arrives while the save is in flight**: the barrier holds it (ruling 27).
    events.wake(5, 5);
    await settleWake();
    expect(log.delivered.map((one) => one.delivery.verdict.kind)).toEqual(['retained']);

    // The command refuses: nothing was written, so the settlement arbitrates the
    // held reading and publishes it — before the save's own continuation runs.
    const settleSave = answer as ((value: CommandResult<SaveResult>) => void) | null;
    settleSave?.({ ok: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } });
    await settleWake();

    expect(log.delivered.map((one) => one.delivery.verdict.kind)).toEqual(['retained', 'raised']);
    // **Entry 5, on screen**: the continuation did not overwrite what the
    // settlement delivered — the editor ends showing the external conflict.
    expect(pane.state.standingConflictFor(1)?.kind).toBe('externalChange');
    expect(box(pane.target, '.matchEditor textarea').readOnly).toBe(true);
    expect(control(pane.target, 'browser.matchEditor.save').disabled).toBe(true);
    expect(pane.commands.saveMatch).toHaveBeenCalledTimes(1);
    pane.stop();
  }); // End of the "settlement lands in order" case

  it('keeps what a receiver installed during a refused *Keep my draft* (the reapply handler’s order)', async () => {
    // **The 2d-6-6a review's third finding, mounted.** A delivery that lands
    // while the synchronous handler is inside `reapplyToDiskVersion` replaces the
    // session; the reapply then refuses, and the handler must fold the outcome
    // into the session installed **now** — folding it into the one read before
    // the reapply would reinstall the save conflict the delivery retired.
    const pane = await mountPane(false, { saveMatch: conflictedSave });
    await editorInSaveConflict(pane);
    const keep = conflictChoiceKey('keepMyDraft', 'authoredText');
    expect(control(pane.target, keep)).toBeDefined();
    const direct = pane.state.standingConflictFor.bind(pane.state);
    let armed = true;
    // The guard is asked at the end of the reapply's entry, inside the handler;
    // the first ask tells the window of a later reading of the editor's file.
    pane.state.standingConflictFor = (document) => {
      if (armed) {
        armed = false;
        pane.state.observeExternalChange(narrowed(7, 1, 'match/a.yml', 'd'.repeat(64)));
      }
      return direct(document);
    };
    control(pane.target, keep).click();
    flushSync();
    expect(armed).toBe(false);
    expect(pane.state.standingConflictFor(1)?.kind).toBe('externalChange');
    // The receiver's session stands: its external conflict retired the save
    // outcome, so the save conflict's panel — read by its origin line — is gone
    // and the external one is drawn in its place, and the boxes stay frozen. (The
    // external panel offers *Keep my draft* too, so that label cannot tell them
    // apart.)
    expect(pane.target.textContent).not.toContain(
      DICTIONARIES.en['browser.conflictOrigin.refusedSave']
    );
    expect(pane.target.textContent).toContain(
      DICTIONARIES.en['browser.conflictOrigin.changedWhileOpen']
    );
    expect(box(pane.target, '.matchEditor textarea').readOnly).toBe(true);
    expect(pane.commands.saveMatch).toHaveBeenCalledTimes(1);
    pane.stop();
  }); // End of the "reapply handler order" case
}); // End of the "delivery host" suite

/**
 * The projection of `match/a.yml` with **two** snippets — Phase 2d-6-7a.
 *
 * A file of one snippet refuses every deletion (`lastSnippet`) and offers a move
 * no destination, so the operation panels' delivery cases need a second item in
 * the same sequence. Same revision as {@link documentA}, so the observation the
 * drain carries is about the parse the panels opened over.
 *
 * @returns The document view.
 */
function documentAWithTwo(): DocumentView {
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
        path: matchListPath(0)
      }),
      makeMatch({
        node: 11,
        document: 1,
        revision: 'a'.repeat(64),
        trigger: ':a2',
        replace: 'ay2',
        path: matchListPath(1)
      })
    ]
  });
} // End of function documentAWithTwo()

/** The three operation kinds this suite drives, as the pane's registry names them. */
type OperationKind = 'matchDeleter' | 'matchMover' | 'matchDuplicator';

/** How a case reaches one operation panel and tells whether it may still send. */
interface OperationWalk {
  /** The pane's control that opens the panel. */
  readonly open: TranslationKey;
  /** The panel's own close control. */
  readonly close: TranslationKey;
  /**
   * Brings the panel to the point where its send is offered and enabled.
   *
   * @param target - Where the pane was mounted.
   */
  arm(target: HTMLElement): void;
  /**
   * Whether the panel's send is offered and enabled now.
   *
   * @param target - Where the pane was mounted.
   * @returns `true` while a person could press it.
   */
  mayStillSend(target: HTMLElement): boolean;
  /** The command the send would reach. */
  readonly command: 'deleteMatch' | 'moveMatch' | 'duplicateMatch';
}

/**
 * The button labelled with one key's English rendering, or `null` when none is
 * drawn.
 *
 * @param target - Where the pane was mounted.
 * @param key - The label's key.
 * @returns The button, or `null`.
 */
function maybeControl(target: HTMLElement, key: TranslationKey): HTMLButtonElement | null {
  const label = DICTIONARIES.en[key];
  return (
    [...target.querySelectorAll('button')].find(
      (candidate) => candidate.textContent?.trim() === label
    ) ?? null
  );
} // End of function maybeControl()

/**
 * Whether a control is drawn and enabled.
 *
 * @param target - Where the pane was mounted.
 * @param key - The label's key.
 * @returns `true` when a person could press it.
 */
function offered(target: HTMLElement, key: TranslationKey): boolean {
  const found = maybeControl(target, key);
  return found !== null && !found.disabled;
} // End of function offered()

/** The walk for each operation panel. */
const OPERATIONS: Record<OperationKind, OperationWalk> = {
  matchDeleter: {
    open: 'browser.matchDeletion.open',
    close: 'browser.matchDeletion.close',
    // The panel opens with the question already asked (`requestDelete`).
    arm: () => undefined,
    mayStillSend: (target) => offered(target, 'browser.matchDeletion.confirm'),
    command: 'deleteMatch'
  },
  matchMover: {
    open: 'browser.matchMove.open',
    close: 'browser.matchMove.close',
    arm: (target) => {
      control(target, 'browser.matchMove.position.end').click();
      flushSync();
    },
    mayStillSend: (target) => offered(target, 'browser.matchMove.move'),
    command: 'moveMatch'
  },
  matchDuplicator: {
    open: 'browser.matchDuplication.open',
    close: 'browser.matchDuplication.close',
    arm: () => undefined,
    mayStillSend: (target) => offered(target, 'browser.matchDuplication.duplicate'),
    command: 'duplicateMatch'
  }
};

describe('the pane as a delivery host for the operation panels — Phase 2d-6-7a', () => {
  // **Through the real registry and the real coordinator boundary**, as the
  // Phase 2d-6-6b suite above: each case opens its panel through the pane's own
  // control, starts the lifecycle over a finite drain queue whose arguments are
  // declared exactly, and wakes the window. What these cases assert is what 2d-6-7a wires — the
  // registration, the envelope, the send withdrawn. The sentences the panels
  // draw about the conflict are read by the suite after this one (Phase 2d-6-7b)
  // and by each panel's own suite.

  it.each(['matchDeleter', 'matchMover', 'matchDuplicator'] as const)(
    'an open %s is delivered its file’s change, and its send is withdrawn',
    async (kind) => {
      expectedDrainArguments = [0, 0, 0];
      const events = paneEvents();
      const pane = await mountPane(
        false,
        {
          views: [documentAWithTwo(), documentB()],
          batches: [batch(0), batch(0), batch(5, [changed(5, 1, 'match/a.yml')])]
        },
        events.source
      );
      const walk = OPERATIONS[kind];
      const log = watchDeliveries(pane.state);
      await pane.state.select(snippetOf(pane.state, 1));
      flushSync();
      control(pane.target, walk.open).click();
      flushSync();
      walk.arm(pane.target);
      expect(registered(pane.state)).toEqual([
        { kind, target: { kind: 'document', document: 1 } }
      ]);
      expect(log.live()).toEqual([1]);
      expect(walk.mayStillSend(pane.target)).toBe(true);

      events.wake(5, 5);
      await settleWake();

      // **One decision, to the one registration over the file**, and the
      // origin the window now holds is the external change.
      expect(log.delivered.map((one) => [one.document, one.delivery.verdict.kind])).toEqual([
        [1, 'raised']
      ]);
      expect(pane.state.standingConflictFor(1)?.kind).toBe('externalChange');
      // **The send is withdrawn** — the session the receiver installed refuses it.
      expect(walk.mayStillSend(pane.target)).toBe(false);
      // Protected rather than reloaded under the panel, and nothing was sent.
      expect(pane.state.externalDocumentStatus(1)).toEqual({ kind: 'stale' });
      expect(pane.commands.reloadDocument).not.toHaveBeenCalled();
      expect(pane.commands[walk.command]).not.toHaveBeenCalled();
      pane.stop();
    }
  ); // End of the "operation panel delivered" case

  it.each(['matchDeleter', 'matchMover', 'matchDuplicator'] as const)(
    'never hands a reopened %s what its previous instance was told',
    async (kind) => {
      expectedDrainArguments = [0, 0, 0, 5];
      const events = paneEvents();
      const pane = await mountPane(
        false,
        {
          views: [documentAWithTwo(), documentB()],
          batches: [
            batch(0),
            batch(0),
            batch(5, [changed(5, 1, 'match/a.yml')]),
            batch(6, [changed(6, 1, 'match/a.yml', 'd'.repeat(64))])
          ]
        },
        events.source
      );
      const walk = OPERATIONS[kind];
      const log = watchDeliveries(pane.state);
      await pane.state.select(snippetOf(pane.state, 1));
      flushSync();
      control(pane.target, walk.open).click();
      flushSync();
      events.wake(5, 5);
      await settleWake();
      walk.arm(pane.target);
      expect(walk.mayStillSend(pane.target)).toBe(false);

      control(pane.target, walk.close).click();
      flushSync();
      expect(log.live()).toEqual([]);
      expect(registered(pane.state)).toEqual([]);
      control(pane.target, walk.open).click();
      flushSync();
      walk.arm(pane.target);
      // **A fresh session**: the old instance's delivery did not follow it.
      expect(walk.mayStillSend(pane.target)).toBe(true);
      expect(log.live()).toEqual([1]);

      events.wake(5, 6);
      await settleWake();
      // The first registration was told once and never again; only the second —
      // the reopened panel's — was told of the later reading.
      expect(log.delivered.map((one) => one.registration)).toEqual([0, 1]);
      expect(walk.mayStillSend(pane.target)).toBe(false);
      expect(pane.commands[walk.command]).not.toHaveBeenCalled();
      pane.stop();
    }
  ); // End of the "reopened operation panel" case

  it('lands a settlement after the deletion it settles, in the order it was decided', async () => {
    expectedDrainArguments = [0, 0, 0];
    const events = paneEvents();
    let answer: ((value: CommandResult<SaveResult>) => void) | null = null;
    const pane = await mountPane(
      false,
      {
        views: [documentAWithTwo(), documentB()],
        deleteMatch: () =>
          new Promise<CommandResult<SaveResult>>((resolve) => {
            answer = resolve;
          }),
        batches: [batch(0), batch(0), batch(5, [changed(5, 1, 'match/a.yml')])]
      },
      events.source
    );
    const log = watchDeliveries(pane.state);
    await pane.state.select(snippetOf(pane.state, 1));
    flushSync();
    control(pane.target, 'browser.matchDeletion.open').click();
    flushSync();
    control(pane.target, 'browser.matchDeletion.confirm').click();
    await settle();
    expect(pane.commands.deleteMatch).toHaveBeenCalledTimes(1);

    // **Arrives while the deletion is in flight**: the barrier holds it (ruling
    // 27), and the receiver records the wait inside the session.
    events.wake(5, 5);
    await settleWake();
    expect(log.delivered.map((one) => one.delivery.verdict.kind)).toEqual(['retained']);

    // The command refuses: nothing was written, so the settlement arbitrates the
    // held reading and publishes it — before the deletion's own continuation.
    const settleDeletion = answer as ((value: CommandResult<SaveResult>) => void) | null;
    settleDeletion?.({ ok: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } });
    await settleWake();

    expect(log.delivered.map((one) => one.delivery.verdict.kind)).toEqual(['retained', 'raised']);
    // **Entry 5**: the continuation did not overwrite what the settlement
    // delivered — the deleter ends holding the external conflict, and asks nothing.
    expect(pane.state.standingConflictFor(1)?.kind).toBe('externalChange');
    expect(OPERATIONS.matchDeleter.mayStillSend(pane.target)).toBe(false);
    expect(maybeControl(pane.target, 'browser.matchDeletion.request')).toBeNull();
    expect(pane.commands.deleteMatch).toHaveBeenCalledTimes(1);
    pane.stop();
  }); // End of the "deletion settlement lands in order" case
}); // End of the "delivery host for the operation panels" suite

describe('the pane as a delivery host for the raw editor and restore — Phase 2d-6-8a', () => {
  // **Through the real registry and the real coordinator boundary**, as the two
  // suites above: each case opens its surface through the pane's own control,
  // starts the lifecycle over a finite drain queue whose arguments are declared
  // exactly, and wakes the window, so the observation is admitted by the real
  // coordinator, routed to the
  // pane's transition, arbitrated once by `observeExternalChange`, and delivered
  // through the roster's registration. What these cases assert is what 2d-6-8a
  // wires — the registration, the envelope, the send withdrawn. What the two
  // panels draw about the conflict is 2d-6-8b's, so no sentence is read here.

  /** The two surfaces this suite drives. */
  type LastKind = 'rawEditor' | 'restore';

  /** How one of the two is brought to a state where it may send. */
  interface LastWalk {
    /**
     * Opens the surface through the pane's control and arms its send: the raw
     * editor's box edited, restore's candidate read.
     *
     * @param pane - The mounted pane.
     */
    readonly arm: (pane: Mounted) => Promise<void>;
    /**
     * Whether its send is offered.
     *
     * @param target - Where the pane was mounted.
     * @returns `true` while the control is enabled.
     */
    readonly mayStillSend: (target: HTMLElement) => boolean;
    /**
     * Closes it through its own controls: the raw editor's edited draft asks
     * first, and is discarded.
     *
     * @param target - Where the pane was mounted.
     */
    readonly leave: (target: HTMLElement) => void;
  }

  /**
   * Edits the raw editor's box, as a person typing would.
   *
   * @param target - Where the pane was mounted.
   */
  function typeIntoRaw(target: HTMLElement): void {
    const body = box(target, 'textarea');
    body.value = `${body.value}# edited\n`;
    body.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
  } // End of function typeIntoRaw()

  const LAST: Record<LastKind, LastWalk> = {
    rawEditor: {
      arm: async (pane) => {
        await WALKS.rawEditor.open(pane);
        flushSync();
        typeIntoRaw(pane.target);
      },
      mayStillSend: (target) => !control(target, 'browser.rawEditor.save').disabled,
      leave: (target) => {
        control(target, 'browser.rawEditor.close').click();
        flushSync();
        control(target, 'browser.rawEditor.discard').click();
      }
    },
    restore: {
      arm: async (pane) => {
        await WALKS.restore.open(pane);
        flushSync();
        control(pane.target, 'browser.restore.listBatches').click();
        await settle();
        control(pane.target, 'browser.restore.batchNamed', { name: BATCH.name }).click();
        await settle();
        entryControl(pane.target, 'match/a.yml').click();
        await settle();
      },
      mayStillSend: (target) => !control(target, 'browser.restore.prepare').disabled,
      leave: (target) => {
        control(target, 'browser.restore.close').click();
      }
    }
  };

  it.each(['rawEditor', 'restore'] as const)(
    'an open %s is delivered its file’s change, and its send is withdrawn',
    async (kind) => {
      expectedDrainArguments = [0, 0, 0];
      const events = paneEvents();
      const pane = await mountPane(
        true,
        { batches: [batch(0), batch(0), batch(5, [changed(5, 1, 'match/a.yml')])] },
        events.source
      );
      const log = watchDeliveries(pane.state);
      await LAST[kind].arm(pane);
      expect(registered(pane.state)).toEqual([WALKS[kind].expected]);
      expect(log.live()).toEqual([1]);
      expect(LAST[kind].mayStillSend(pane.target)).toBe(true);

      events.wake(5, 5);
      await settleWake();

      // **One decision, to the one registration over the file**, and the origin
      // the window now holds is the external change.
      expect(log.delivered.map((one) => [one.document, one.delivery.verdict.kind])).toEqual([
        [1, 'raised']
      ]);
      expect(pane.state.standingConflictFor(1)?.kind).toBe('externalChange');
      // **The send is withdrawn** — the session the receiver installed refuses it.
      expect(LAST[kind].mayStillSend(pane.target)).toBe(false);
      // Protected rather than reloaded under the surface, and nothing was sent.
      expect(pane.state.externalDocumentStatus(1)).toEqual({ kind: 'stale' });
      expect(pane.commands.reloadDocument).not.toHaveBeenCalled();
      expect(pane.commands.saveRawDocument).not.toHaveBeenCalled();
      pane.stop();
    }
  ); // End of the "raw or restore delivered" case

  it.each(['rawEditor', 'restore'] as const)(
    'never hands a reopened %s what its previous instance was told',
    async (kind) => {
      expectedDrainArguments = [0, 0, 0, 5];
      const events = paneEvents();
      const pane = await mountPane(
        true,
        {
          batches: [
            batch(0),
            batch(0),
            batch(5, [changed(5, 1, 'match/a.yml')]),
            batch(6, [changed(6, 1, 'match/a.yml', 'd'.repeat(64))])
          ]
        },
        events.source
      );
      const log = watchDeliveries(pane.state);
      await LAST[kind].arm(pane);
      events.wake(5, 5);
      await settleWake();
      expect(LAST[kind].mayStillSend(pane.target)).toBe(false);

      LAST[kind].leave(pane.target);
      flushSync();
      expect(log.live()).toEqual([]);
      expect(registered(pane.state)).toEqual([]);
      await LAST[kind].arm(pane);
      // **A fresh session**: the old instance's delivery did not follow it.
      expect(LAST[kind].mayStillSend(pane.target)).toBe(true);
      expect(log.live()).toEqual([1]);

      events.wake(5, 6);
      await settleWake();
      // The first registration was told once and never again; only the second —
      // the reopened surface's — was told of the later reading.
      expect(log.delivered.map((one) => one.registration)).toEqual([0, 1]);
      expect(LAST[kind].mayStillSend(pane.target)).toBe(false);
      expect(pane.commands.saveRawDocument).not.toHaveBeenCalled();
      pane.stop();
    }
  ); // End of the "reopened raw or restore" case

  it('lands a settlement after the raw save it settles, in the order it was decided', async () => {
    expectedDrainArguments = [0, 0, 0];
    const events = paneEvents();
    let answer: ((value: RawSaveOutcome) => void) | null = null;
    const pane = await mountPane(
      false,
      {
        saveRawDocument: () =>
          new Promise<RawSaveOutcome>((resolve) => {
            answer = resolve;
          }),
        batches: [batch(0), batch(0), batch(5, [changed(5, 1, 'match/a.yml')])]
      },
      events.source
    );
    const log = watchDeliveries(pane.state);
    await LAST.rawEditor.arm(pane);
    control(pane.target, 'browser.rawEditor.save').click();
    await settle();
    expect(pane.commands.saveRawDocument).toHaveBeenCalledTimes(1);

    // **Arrives while the save is in flight**: the barrier holds it (ruling 27),
    // and the receiver records the wait inside the session.
    events.wake(5, 5);
    await settleWake();
    expect(log.delivered.map((one) => one.delivery.verdict.kind)).toEqual(['retained']);

    // The command refuses: nothing was written, so the settlement arbitrates the
    // held reading and publishes it — before the save's own continuation.
    const settleSave = answer as ((value: RawSaveOutcome) => void) | null;
    settleSave?.({ ok: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } });
    await settleWake();

    expect(log.delivered.map((one) => one.delivery.verdict.kind)).toEqual(['retained', 'raised']);
    // **Entry 5**: the continuation did not overwrite what the settlement
    // delivered — the editor ends holding the external conflict, and sends nothing.
    expect(pane.state.standingConflictFor(1)?.kind).toBe('externalChange');
    expect(LAST.rawEditor.mayStillSend(pane.target)).toBe(false);
    expect(pane.commands.saveRawDocument).toHaveBeenCalledTimes(1);
    pane.stop();
  }); // End of the "raw save settlement lands in order" case

  it.each([
    ['equal to the committed revision, is dropped as written here', RESTORED_REVISION, 'writtenHere'],
    ['of a different revision, raises the conflict once the save settles', 'c'.repeat(64), 'raised']
  ] as const)(
    'a reading held behind a committed raw save, %s',
    async (_title, revision, verdict) => {
      // **Row 7 (b) and (c), through a real coordinator** (Phase 2d-6-11a): the
      // stocked commit is held open at its gate, the wake lands while it is in
      // flight, and the release decides on the revision the commit ended on.
      expectedDrainArguments = [0, 0, 0];
      const events = paneEvents();
      let open: (() => void) | null = null;
      const rawSaveGate = new Promise<void>((resolve) => {
        open = resolve;
      });
      const pane = await mountPane(
        true,
        {
          rawSaveGate,
          batches: [batch(0), batch(0), batch(5, [changed(5, 1, 'match/a.yml', revision)])]
        },
        events.source
      );
      const log = watchDeliveries(pane.state);
      await LAST.rawEditor.arm(pane);
      control(pane.target, 'browser.rawEditor.save').click();
      await settle();
      expect(pane.commands.saveRawDocument).toHaveBeenCalledTimes(1);

      events.wake(5, 5);
      await settleWake();
      expect(log.delivered.map((one) => one.delivery.verdict.kind)).toEqual(['retained']);

      const release = open as (() => void) | null;
      release?.();
      await settleWake();

      // The commit went through and ended on RESTORED_REVISION either way.
      expect(pane.saves).toHaveLength(1);
      expect(pane.state.views.find((view) => view.id === 1)?.revision).toBe(RESTORED_REVISION);
      expect(log.delivered.map((one) => one.delivery.verdict.kind)).toEqual(['retained', verdict]);
      if (verdict === 'writtenHere') {
        // **Not news**: nothing stands and the editor draws no external conflict.
        // The file's `stale` mark, written when the reading arrived behind the
        // open editor, is cleared by the release: the window holds the bytes the
        // reading names (Phase 2d-7-1's ruling, `docs/decisions/2d-7-1-notes.md`).
        expect(pane.state.standingConflictFor(1)).toBeNull();
        expect(isDrawn(pane.target, '.panel.external')).toBe(false);
        expect(pane.state.externalDocumentStatus(1)).toBeNull();
      } else {
        expect(pane.state.standingConflictFor(1)?.kind).toBe('externalChange');
        expect(isDrawn(pane.target, '.panel.external')).toBe(true);
        // A reading of other bytes is news: its mark stands beside the conflict.
        expect(pane.state.externalDocumentStatus(1)).toEqual({ kind: 'stale' });
      }
      expect(pane.commands.saveRawDocument).toHaveBeenCalledTimes(1);
      pane.stop();
    }
  ); // End of the "held reading behind a committed raw save" case

  it('settles a reading held behind a raw save that may have written as a conflict without reload', async () => {
    // **Row 7 (d)** (Phase 2d-6-11a): the save fails in the shape `mayHaveWritten`
    // answers `true` for, so the settlement is `uncertain` and the held reading is
    // arbitrated under it — raised, with no automatic reload allowed from it.
    expectedDrainArguments = [0, 0, 0];
    const events = paneEvents();
    let answer: ((value: RawSaveOutcome) => void) | null = null;
    const pane = await mountPane(
      false,
      {
        saveRawDocument: () =>
          new Promise<RawSaveOutcome>((resolve) => {
            answer = resolve;
          }),
        batches: [batch(0), batch(0), batch(5, [changed(5, 1, 'match/a.yml')])]
      },
      events.source
    );
    const log = watchDeliveries(pane.state);
    await LAST.rawEditor.arm(pane);
    control(pane.target, 'browser.rawEditor.save').click();
    await settle();
    events.wake(5, 5);
    await settleWake();
    expect(log.delivered.map((one) => one.delivery.verdict.kind)).toEqual(['retained']);

    const settleSave = answer as ((value: RawSaveOutcome) => void) | null;
    settleSave?.(RAW_WRITE_MAY_HAVE_HAPPENED);
    await settleWake();

    expect(log.delivered.map((one) => one.delivery.verdict.kind)).toEqual([
      'retained',
      'raisedWithoutReload'
    ]);
    expect(pane.state.standingConflictFor(1)?.kind).toBe('externalChange');
    expect(LAST.rawEditor.mayStillSend(pane.target)).toBe(false);
    expect(pane.commands.saveRawDocument).toHaveBeenCalledTimes(1);
    pane.stop();
  }); // End of the "raw save that may have written" case
}); // End of the "delivery host for the raw editor and restore" suite

describe('the operation panels’ drawn sentences through the pane, in English and Spanish — Phase 2d-6-7b', () => {
  // **Read off the screen through the real registry and coordinator boundary**,
  // so the sentences each panel's own suite reads through its reported receiver
  // are shown to be what a real delivery produces too (the 2d-6 record's §3
  // entries 34 and 35). Opened by the pane's controls in the case's locale, a
  // finite drain queue whose arguments are declared exactly, a wake admitted by
  // the coordinator.

  it.each(
    (['matchDeleter', 'matchMover', 'matchDuplicator'] as const).flatMap((kind) =>
      LOCALES.map((lang) => [kind, lang] as const)
    )
  )('an open %s draws the external origin, its revision and the comparison, and refuses to send (%s)', async (kind, lang) => {
    expectedDrainArguments = [0, 0, 0];
    const events = paneEvents();
    const pane = await mountPane(
      false,
      {
        views: [documentAWithTwo(), documentB()],
        batches: [batch(0), batch(0), batch(5, [changed(5, 1, 'match/a.yml')])]
      },
      events.source
    );
    locale.setOverride(lang);
    const walk = OPERATIONS[kind];
    await pane.state.select(snippetOf(pane.state, 1));
    flushSync();
    controlIn(pane.target, lang, walk.open).click();
    flushSync();
    if (kind === 'matchMover') {
      controlIn(pane.target, lang, 'browser.matchMove.position.end').click();
      flushSync();
    }
    expect(isDrawn(pane.target, '.panel.external')).toBe(false);

    events.wake(5, 5);
    await settleWake();

    const panel = drawn(pane.target, '.panel.external');
    expect(panel).toContain(translate(lang, 'browser.conflictOrigin.changedWhileOpen'));
    expect(panel).toContain(translate(lang, 'browser.externalConflict.fileChangedWhileOpen'));
    expect(panel).toContain(
      translate(lang, 'browser.externalConflict.revisionObserved', { revision: 'c'.repeat(64) })
    );
    expect(panel).toContain(translate(lang, 'browser.saveOutcome.diskVersion'));
    expect(panel).not.toContain(translate(lang, 'browser.conflictOrigin.refusedSave'));
    expect(panel).not.toContain(translate(lang, 'browser.saveOutcome.changedElsewhere'));
    // The three choices, in this locale, and the recovery reason beside them.
    for (const choice of ['keepEditing', 'keepMyDraft', 'reloadDiskVersion'] as const) {
      const label = translate(lang, conflictChoiceKey(choice, 'operationChoice'));
      expect(
        [...(pane.target.querySelector('.panel.external')?.querySelectorAll('button') ?? [])].some(
          (one) => one.textContent?.trim() === label
        )
      ).toBe(true);
    } // End of the loop over the three offered choices
    expect(pane.target.textContent).toContain(translate(lang, 'browser.recovery.unavailable.operationDraft'));
    // Direct submission is refused, read in this locale: the deleter's question
    // is withdrawn, and the mover's and the duplicator's send is disabled with the
    // reason beside it. (`walk.mayStillSend` reads English labels, so it would be
    // vacuous here in Spanish.)
    const sendKey: TranslationKey =
      kind === 'matchDeleter'
        ? 'browser.matchDeletion.confirm'
        : kind === 'matchMover'
          ? 'browser.matchMove.move'
          : 'browser.matchDuplication.duplicate';
    const send = [...pane.target.querySelectorAll('button')].find(
      (one) => one.textContent?.trim() === translate(lang, sendKey)
    );
    if (kind === 'matchDeleter') {
      expect(send).toBeUndefined();
    } else {
      expect(send?.disabled).toBe(true);
      expect(pane.target.querySelector('.actions')?.textContent).toContain(
        translate(lang, 'browser.externalConflict.fileChangedWhileOpen')
      );
    }
    expect(pane.commands[walk.command]).not.toHaveBeenCalled();
    pane.stop();
  }); // End of the "operation panel drawn sentences" case
}); // End of the "operation panels’ drawn sentences through the pane" suite

/**
 * The text one element of the pane draws, insisted upon — Phase 2d-6-6c-1.
 *
 * @param target - Where the pane was mounted.
 * @param selector - The element's selector.
 * @returns Its whole text.
 */
function drawn(target: HTMLElement, selector: string): string {
  const found = target.querySelector(selector);
  if (found === null) {
    throw new Error(`this case needs ${selector} drawn`);
  }
  return found.textContent ?? '';
} // End of function drawn()

/**
 * Whether one element of the pane is drawn at all.
 *
 * @param target - Where the pane was mounted.
 * @param selector - The element's selector.
 * @returns `true` when it is.
 */
function isDrawn(target: HTMLElement, selector: string): boolean {
  return target.querySelector(selector) !== null;
} // End of function isDrawn()

/**
 * The labels of the buttons one element of the pane draws — Phase 2d-6-6c-1.
 *
 * A control is asserted by its label rather than by the panel's text, because a
 * sentence beside the controls may quote a label (the reload warning does).
 *
 * @param target - Where the pane was mounted.
 * @param selector - The element's selector.
 * @returns The trimmed labels, in document order.
 */
function labelsIn(target: HTMLElement, selector: string): readonly string[] {
  return [...target.querySelectorAll(`${selector} button`)].map(
    (one) => one.textContent?.trim() ?? ''
  );
} // End of function labelsIn()

/** The editor's own external conflict panel, never the recovery form's inside it. */
const EDITOR_EXTERNAL = '.matchEditor > .panel.external';

/** The editor's own outcome panel: a direct child that is neither of the other two. */
const EDITOR_OUTCOME = '.matchEditor > .panel[role="status"]:not(.reapply):not(.external)';

/** The recovery form's own external conflict panel. */
const RECOVERY_EXTERNAL = '.recovery .panel.external';

/** The new-snippet form's external conflict panel. */
const CREATOR_EXTERNAL = '.creator > .panel.external';

/**
 * Makes the selection route of the copy succeed, and says how to undo it.
 *
 * jsdom has no `navigator.clipboard`, so `copyReferenceText` in `./clipboard.ts`
 * takes its selection route, which asks `document.execCommand('copy')`; jsdom has
 * no such method either, and this installs one that answers `true` for `copy`.
 *
 * @returns Restores what was there before.
 */
function selectionCopySucceeds(): () => void {
  const original = Object.getOwnPropertyDescriptor(document, 'execCommand');
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    writable: true,
    value: (command: string): boolean => command === 'copy'
  });
  return (): void => {
    if (original === undefined) {
      Reflect.deleteProperty(document, 'execCommand');
    } else {
      Object.defineProperty(document, 'execCommand', original);
    }
  };
} // End of function selectionCopySucceeds()

describe('the conflict panels’ drawn sentences, in English and Spanish — Phase 2d-6-6c-1', () => {
  // **2d-6-6's acceptance, read off the screen.** The same six scenarios as the
  // delivery suite above, each through the real registry and the real coordinator
  // boundary — opened by the pane's controls in the case's own locale, a finite
  // scripted drain queue whose arguments are declared exactly, a wake admitted by
  // the coordinator — and each asserting the **sentences** the three authored
  // panels draw, in both
  // locales (the 2d-6 record's §3 entries 34 and 35). What a sentence is pinned
  // to is its dictionary value in that locale: this protects that the panel draws
  // the right code in the right place, never that a translation is good.

  it.each(LOCALES)(
    'a pristine editor draws the external origin, evidence, comparison, copy and recovery (%s)',
    async (lang) => {
      expectedDrainArguments = [0, 0, 0];
      const events = paneEvents();
      const pane = await mountPane(
        false,
        { batches: [batch(0), batch(0), batch(5, [changed(5, 1, 'match/a.yml')])] },
        events.source
      );
      locale.setOverride(lang);
      await pane.state.select(snippetOf(pane.state, 1));
      flushSync();
      controlIn(pane.target, lang, 'browser.matchEditor.open').click();
      flushSync();
      expect(isDrawn(pane.target, EDITOR_EXTERNAL)).toBe(false);

      events.wake(5, 5);
      await settleWake();

      // **The origin, then the observation's own line, then its one revision** — and
      // none of the save arm's: there was no save, so no *expected* and no *found*.
      const panel = drawn(pane.target, EDITOR_EXTERNAL);
      expect(panel).toContain(translate(lang, 'browser.conflictOrigin.changedWhileOpen'));
      expect(panel).toContain(translate(lang, 'browser.externalConflict.fileChangedWhileOpen'));
      expect(panel).toContain(
        translate(lang, 'browser.externalConflict.revisionObserved', { revision: 'c'.repeat(64) })
      );
      expect(panel).not.toContain(translate(lang, 'browser.conflictOrigin.refusedSave'));
      expect(panel).not.toContain(
        translate(lang, 'browser.matchEditor.revisionExpected', { revision: 'a'.repeat(64) })
      );
      expect(panel).not.toContain(translate(lang, 'browser.saveOutcome.changedElsewhere'));
      // **The comparison the save panel has** (entry 23): the retained draft, the
      // whole disk text, the copy disclosure and the choices.
      expect(panel).toContain(translate(lang, 'browser.saveOutcome.retainedDraft'));
      expect(panel).toContain(translate(lang, 'browser.saveOutcome.diskVersion'));
      expect(panel).toContain('ondisk');
      expect(panel).toContain(translate(lang, 'browser.saveOutcome.copyIsReference'));
      expect(isDrawn(pane.target, EDITOR_OUTCOME)).toBe(false);

      // **The copy**, through `copyReferenceText`, disclosed in this locale.
      const restore = selectionCopySucceeds();
      try {
        controlIn(pane.target, lang, conflictChoiceKey('copyDraft', 'authoredText')).click();
        await settle();
      } finally {
        restore();
      }
      expect(drawn(pane.target, EDITOR_EXTERNAL)).toContain(
        translate(lang, 'browser.saveOutcome.draftCopied')
      );

      // **The evidence**: the observation carried no correspondence, so *Keep my
      // draft* reaches manual resolution with the typed external-evidence sentence.
      controlIn(pane.target, lang, conflictChoiceKey('keepMyDraft', 'authoredText')).click();
      flushSync();
      const report = drawn(pane.target, '.matchEditor > .panel.reapply');
      expect(report).toContain(translate(lang, reapplyOutcomeKey('manualResolution')));
      expect(report).toContain(translate(lang, externalEvidenceRefusalKey('noCorrespondence')));

      // **The recovery path**, offered after that manual resolution and opened over
      // the external conflict, which it names as untouched.
      controlIn(pane.target, lang, recoveryChoiceKey('createFromSupportedFields')).click();
      flushSync();
      expect(drawn(pane.target, '.recovery')).toContain(
        translate(lang, sourceConflictStateKey('retained'))
      );
      expect(pane.commands.saveMatch).not.toHaveBeenCalled();
      expect(pane.commands.createMatch).not.toHaveBeenCalled();
      pane.stop();
    }
  ); // End of the "pristine editor draws" case

  it.each([
    ['en', 1, 'match/a.yml'],
    ['en', 3, 'match/c.yml'],
    ['es', 1, 'match/a.yml'],
    ['es', 3, 'match/c.yml']
  ] as const)(
    'an unknown-target creator names the affected file and its one way forward (%s, file %i)',
    async (lang, affected, path) => {
      expectedDrainArguments = [0, 0, 0];
      const events = paneEvents();
      const pane = await mountPane(
        false,
        { ...THREE_FILES, batches: [batch(0), batch(0), batch(5, [changed(5, affected, path)])] },
        events.source
      );
      locale.setOverride(lang);
      flushSync();
      controlIn(pane.target, lang, 'browser.matchCreation.open').click();
      flushSync();

      events.wake(5, 5);
      await settleWake();

      const panel = drawn(pane.target, CREATOR_EXTERNAL);
      expect(panel).toContain(translate(lang, 'browser.conflictOrigin.changedWhileOpen'));
      expect(panel).toContain(translate(lang, 'browser.externalConflict.fileChangedWhileOpen'));
      expect(panel).toContain(translate(lang, 'browser.externalConflict.affectedFile', { path }));
      expect(panel).toContain(translate(lang, 'browser.externalConflict.destinationRequired'));
      // **Every eligible target blocked**: the send refuses for want of a file, and
      // neither way to the disk version is offered — only *Keep editing* and the copy.
      expect(drawn(pane.target, '.creator .actions')).toContain(
        translate(lang, 'browser.matchCreation.cannotCreate.noDestination')
      );
      expect(labelsIn(pane.target, CREATOR_EXTERNAL)).toEqual([
        translate(lang, conflictChoiceKey('keepEditing', 'authoredText')),
        translate(lang, conflictChoiceKey('copyDraft', 'authoredText'))
      ]);

      // Naming the affected file is the way forward: the line goes, the reload comes.
      destinationIn(pane.target, '.creator', path).click();
      flushSync();
      const named = drawn(pane.target, CREATOR_EXTERNAL);
      expect(named).not.toContain(translate(lang, 'browser.externalConflict.destinationRequired'));
      expect(labelsIn(pane.target, CREATOR_EXTERNAL)).toContain(
        translate(lang, conflictChoiceKey('reloadDiskVersion', 'authoredText'))
      );
      expect(drawn(pane.target, '.creator .actions')).not.toContain(
        translate(lang, 'browser.matchCreation.cannotCreate.noDestination')
      );
      expect(controlIn(pane.target, lang, 'browser.matchCreation.create').disabled).toBe(true);
      expect(pane.commands.createMatch).not.toHaveBeenCalled();
      pane.stop();
    }
  ); // End of the "unknown-target creator draws" case

  it.each(LOCALES)(
    'recovery over B draws B’s external conflict while its host still draws its save conflict over A (%s)',
    async (lang) => {
      expectedDrainArguments = [0, 0, 0];
      const events = paneEvents();
      const pane = await mountPane(
        false,
        {
          ...THREE_FILES,
          saveMatch: conflictedSave,
          batches: [batch(0), batch(0), batch(5, [changed(5, 3, 'match/c.yml')])]
        },
        events.source
      );
      locale.setOverride(lang);
      await editorInSaveConflict(pane, lang);
      openRecoveryForm(pane, lang);
      destinationIn(pane.target, '.recovery', 'match/c.yml').click();
      flushSync();

      events.wake(5, 5);
      await settleWake();

      const form = drawn(pane.target, RECOVERY_EXTERNAL);
      expect(form).toContain(translate(lang, 'browser.conflictOrigin.changedWhileOpen'));
      expect(form).toContain(
        translate(lang, 'browser.externalConflict.affectedFile', { path: 'match/c.yml' })
      );
      expect(form).toContain(
        translate(lang, 'browser.externalConflict.revisionObserved', { revision: 'c'.repeat(64) })
      );
      expect(form).not.toContain(translate(lang, 'browser.externalConflict.destinationRequired'));
      expect(drawn(pane.target, '.recovery .actions')).toContain(
        translate(lang, recoveryRefusalKey('externalConflict'))
      );
      // **The host is where it was**: its own save conflict over `a`, with the save
      // origin and the save's revisions, and no external panel of its own.
      const host = drawn(pane.target, EDITOR_OUTCOME);
      expect(host).toContain(translate(lang, 'browser.conflictOrigin.refusedSave'));
      expect(host).toContain(
        translate(lang, 'browser.matchEditor.revisionExpected', { revision: 'a'.repeat(64) })
      );
      expect(host).not.toContain(translate(lang, 'browser.conflictOrigin.changedWhileOpen'));
      expect(isDrawn(pane.target, EDITOR_EXTERNAL)).toBe(false);
      expect(pane.commands.createMatch).not.toHaveBeenCalled();
      pane.stop();
    }
  ); // End of the "recovery over B draws" case

  it.each(LOCALES)(
    'a host and its recovery form over one file draw the one decision alike (%s)',
    async (lang) => {
      expectedDrainArguments = [0, 0, 0];
      const events = paneEvents();
      const pane = await mountPane(
        false,
        {
          saveMatch: conflictedSave,
          batches: [batch(0), batch(0), batch(5, [changed(5, 1, 'match/a.yml', 'd'.repeat(64))])]
        },
        events.source
      );
      locale.setOverride(lang);
      await editorInSaveConflict(pane, lang);
      openRecoveryForm(pane, lang);

      events.wake(5, 5);
      await settleWake();

      // **`supersedes` on both**: the host's save conflict is replaced by the
      // external one, and the form draws the same observation.
      const observed = translate(lang, 'browser.externalConflict.revisionObserved', {
        revision: 'd'.repeat(64)
      });
      const host = drawn(pane.target, EDITOR_EXTERNAL);
      expect(host).toContain(translate(lang, 'browser.conflictOrigin.changedWhileOpen'));
      expect(host).toContain(observed);
      expect(isDrawn(pane.target, EDITOR_OUTCOME)).toBe(false);
      const form = drawn(pane.target, RECOVERY_EXTERNAL);
      expect(form).toContain(translate(lang, 'browser.conflictOrigin.changedWhileOpen'));
      expect(form).toContain(observed);
      expect(pane.commands.createMatch).not.toHaveBeenCalled();
      pane.stop();
    }
  ); // End of the "one decision drawn alike" case

  it.each(LOCALES)(
    'a reopened editor draws nothing of what its previous instance was told (%s)',
    async (lang) => {
      expectedDrainArguments = [0, 0, 0, 5];
      const events = paneEvents();
      const pane = await mountPane(
        false,
        {
          batches: [
            batch(0),
            batch(0),
            batch(5, [changed(5, 1, 'match/a.yml')]),
            batch(6, [changed(6, 1, 'match/a.yml', 'd'.repeat(64))])
          ]
        },
        events.source
      );
      locale.setOverride(lang);
      await pane.state.select(snippetOf(pane.state, 1));
      flushSync();
      controlIn(pane.target, lang, 'browser.matchEditor.open').click();
      flushSync();
      events.wake(5, 5);
      await settleWake();
      expect(drawn(pane.target, EDITOR_EXTERNAL)).toContain(
        translate(lang, 'browser.externalConflict.revisionObserved', { revision: 'c'.repeat(64) })
      );

      controlIn(pane.target, lang, 'browser.matchEditor.close').click();
      flushSync();
      controlIn(pane.target, lang, 'browser.matchEditor.open').click();
      flushSync();
      expect(isDrawn(pane.target, EDITOR_EXTERNAL)).toBe(false);
      expect(drawn(pane.target, '.matchEditor')).not.toContain(
        translate(lang, 'browser.conflictOrigin.changedWhileOpen')
      );

      events.wake(5, 6);
      await settleWake();
      // Only the later reading, told to the reopened editor, is drawn.
      const panel = drawn(pane.target, EDITOR_EXTERNAL);
      expect(panel).toContain(
        translate(lang, 'browser.externalConflict.revisionObserved', { revision: 'd'.repeat(64) })
      );
      expect(panel).not.toContain(
        translate(lang, 'browser.externalConflict.revisionObserved', { revision: 'c'.repeat(64) })
      );
      pane.stop();
    }
  ); // End of the "reopened editor draws" case

  it.each(LOCALES)(
    'a settlement lands after the save it settles, and both are drawn (%s)',
    async (lang) => {
      expectedDrainArguments = [0, 0, 0];
      const events = paneEvents();
      let answer: ((value: CommandResult<SaveResult>) => void) | null = null;
      const pane = await mountPane(
        false,
        {
          saveMatch: () =>
            new Promise<CommandResult<SaveResult>>((resolve) => {
              answer = resolve;
            }),
          batches: [batch(0), batch(0), batch(5, [changed(5, 1, 'match/a.yml')])]
        },
        events.source
      );
      locale.setOverride(lang);
      await pane.state.select(snippetOf(pane.state, 1));
      flushSync();
      controlIn(pane.target, lang, 'browser.matchEditor.open').click();
      flushSync();
      const body = box(pane.target, '.matchEditor textarea');
      body.value = 'mine';
      body.dispatchEvent(new Event('input', { bubbles: true }));
      flushSync();
      controlIn(pane.target, lang, 'browser.matchEditor.save').click();
      await settle();

      // Held while the save is in flight: nothing external is drawn yet, and the
      // save says it cannot be stopped.
      events.wake(5, 5);
      await settleWake();
      expect(isDrawn(pane.target, EDITOR_EXTERNAL)).toBe(false);
      expect(drawn(pane.target, '.matchEditor')).toContain(
        translate(lang, 'browser.matchEditor.savingCannotBeStopped')
      );

      const settleSave = answer as ((value: CommandResult<SaveResult>) => void) | null;
      settleSave?.({ ok: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } });
      await settleWake();

      // **In the order it was decided**: the save's own ending — a send that
      // produced no outcome — and then the external conflict the settlement raised,
      // which the continuation did not overwrite.
      const editor = drawn(pane.target, '.matchEditor');
      expect(editor).toContain(translate(lang, 'browser.matchEditor.sendFailed'));
      const panel = drawn(pane.target, EDITOR_EXTERNAL);
      expect(panel).toContain(translate(lang, 'browser.conflictOrigin.changedWhileOpen'));
      expect(panel).toContain(translate(lang, 'browser.externalConflict.fileChangedWhileOpen'));
      expect(controlIn(pane.target, lang, 'browser.matchEditor.save').disabled).toBe(true);
      pane.stop();
    }
  ); // End of the "settlement drawn in order" case
}); // End of the "drawn sentences" suite

describe('the raw editor’s and restore’s drawn sentences through the pane, in English and Spanish — Phase 2d-6-8b', () => {
  // **Read off the screen through the real registry and coordinator boundary**,
  // so the sentences `RawEditor.test.ts` and `RestorePane.test.ts` read through a
  // reported receiver are shown to be what a real delivery produces too (the
  // 2d-6 record's §3 entries 34 and 35). Opened by the pane's own controls, a
  // finite drain queue whose arguments are declared exactly, a wake admitted by
  // the coordinator.

  /**
   * Opens one of the two surfaces and arms its send: the raw editor's box
   * edited, restore's candidate read.
   *
   * @param pane - The mounted pane.
   * @param kind - Which surface.
   */
  async function armed(pane: Mounted, kind: 'rawEditor' | 'restore'): Promise<void> {
    await WALKS[kind].open(pane);
    flushSync();
    if (kind === 'rawEditor') {
      const body = box(pane.target, 'textarea');
      body.value = `${body.value}# edited\n`;
      body.dispatchEvent(new Event('input', { bubbles: true }));
      flushSync();
      return;
    }
    control(pane.target, 'browser.restore.listBatches').click();
    await settle();
    control(pane.target, 'browser.restore.batchNamed', { name: BATCH.name }).click();
    await settle();
    entryControl(pane.target, 'match/a.yml').click();
    await settle();
  } // End of function armed()

  it.each(
    (['rawEditor', 'restore'] as const).flatMap((kind) => LOCALES.map((lang) => [kind, lang] as const))
  )('an open %s draws the external origin, its revision and the comparison, and refuses to send (%s)', async (kind, lang) => {
    expectedDrainArguments = [0, 0, 0];
    const events = paneEvents();
    const pane = await mountPane(
      true,
      { batches: [batch(0), batch(0), batch(5, [changed(5, 1, 'match/a.yml')])] },
      events.source
    );
    await armed(pane, kind);
    locale.setOverride(lang);
    flushSync();
    expect(isDrawn(pane.target, '.panel.external')).toBe(false);

    events.wake(5, 5);
    await settleWake();

    const panel = drawn(pane.target, '.panel.external');
    expect(panel).toContain(translate(lang, 'browser.conflictOrigin.changedWhileOpen'));
    expect(panel).toContain(translate(lang, 'browser.externalConflict.fileChangedWhileOpen'));
    expect(panel).toContain(
      translate(lang, 'browser.externalConflict.revisionObserved', { revision: 'c'.repeat(64) })
    );
    expect(panel).toContain('ondisk');
    expect(panel).not.toContain(translate(lang, 'browser.conflictOrigin.refusedSave'));
    expect(panel).not.toContain(translate(lang, 'browser.saveOutcome.changedElsewhere'));
    if (kind === 'rawEditor') {
      // The reseed is what this editor's reload does, and the box is frozen.
      expect(panel).toContain(translate(lang, 'browser.saveOutcome.reloadDiscardsDraft'));
      expect(panel).toContain(translate(lang, 'browser.rawEditor.diskVersion'));
      expect((box(pane.target, 'textarea') as HTMLTextAreaElement).readOnly).toBe(true);
      expect(controlIn(pane.target, lang, 'browser.rawEditor.save').disabled).toBe(true);
    } else {
      // The retarget is what restore's reload does, and the candidate survives.
      expect(panel).toContain(translate(lang, 'browser.saveOutcome.reloadRetargetsCandidate'));
      expect(panel).toContain(translate(lang, 'browser.saveOutcome.diskVersion'));
      expect(pane.target.textContent).toContain('restoredbytes');
      expect(controlIn(pane.target, lang, 'browser.restore.prepare').disabled).toBe(true);
      expect(pane.target.querySelector('.actions')?.textContent).toContain(
        translate(lang, 'browser.externalConflict.fileChangedWhileOpen')
      );
    }
    expect(pane.commands.saveRawDocument).not.toHaveBeenCalled();
    pane.stop();
  }); // End of the "raw or restore drawn sentences" case

  it.each(LOCALES)('refreshes the raw viewer through the guarded reread, and the raw editor over the same file conflicts instead while another file still refreshes (%s)', async (lang) => {
    // **The viewer/editor distinction** (the 2d-5 record's entry 20, the 2d-6
    // record's §3 entry 34): the viewer is ordinary browser state and the clean
    // path — `rereadUnderGuard` — refreshes it; the editor is a registered write
    // surface, so the same kind of change to its file raises its conflict and
    // installs nothing, while a change to a file no surface is over is still
    // reread through the guarded path beside it.
    expectedDrainArguments = [0, 0, 0, 5, 6];
    const events = paneEvents();
    const FIRST = 'matches:\n  - trigger: ":a"\n    replace: firstchange\n';
    const SECOND = 'matches:\n  - trigger: ":a"\n    replace: secondchange\n';
    /**
     * `match/a.yml` at a new revision with its one snippet unchanged, so the
     * selection repair keeps the snippet and the viewer stays pointed at the file.
     *
     * @param revision - The revision it is at.
     * @returns The projection.
     */
    const aAt = (revision: ContentRevision): DocumentView =>
      makeDocument({
        id: 1,
        relativePath: 'match/a.yml',
        revision,
        matches: [
          makeMatch({
            node: 10,
            document: 1,
            revision,
            trigger: ':a',
            replace: 'ay',
            path: matchListPath(0)
          })
        ]
      }); // End of function aAt()
    let text: string | undefined;
    let moved: DocumentView | undefined;
    let movedC: DocumentView | undefined;
    const pane = await mountPane(
      false,
      {
        ...THREE_FILES,
        batches: [
          batch(0),
          batch(0),
          batch(5, [changed(5, 1, 'match/a.yml')]),
          batch(6, [changed(6, 1, 'match/a.yml', 'd'.repeat(64))]),
          batch(7, [changed(7, 3, 'match/c.yml', '8'.repeat(64))])
        ],
        reloadDocument: (id) => (id === 1 ? moved : id === 3 ? movedC : undefined),
        documentText: (id) => (id === 1 ? text : undefined)
      },
      events.source
    );
    locale.setOverride(lang);
    const log = watchDeliveries(pane.state);
    await pane.state.select(snippetOf(pane.state, 1));
    await pane.state.showFileText(true);
    await settle();
    expect(pane.target.textContent).toContain('wholefiletext');

    // **The viewer alone**: the change is reread and the viewer draws it.
    moved = aAt('c'.repeat(64));
    text = FIRST;
    events.wake(5, 5);
    await settleWake();
    await settle();
    expect(pane.commands.reloadDocument).toHaveBeenCalledWith(1);
    expect(log.delivered).toEqual([]);
    expect(pane.state.standingConflictFor(1)).toBeNull();
    expect(pane.target.textContent).toContain('firstchange');
    expect(pane.target.textContent).not.toContain('wholefiletext');

    // **The editor over the same file**: the next change conflicts instead.
    controlIn(pane.target, lang, 'browser.rawEditor.open').click();
    flushSync();
    const body = box(pane.target, 'textarea');
    expect(body.value).toBe(FIRST);
    body.value = `${FIRST}# edited\n`;
    body.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    const reloadsBefore = vi.mocked(pane.commands.reloadDocument).mock.calls.length;
    const textsBefore = vi.mocked(pane.commands.documentText).mock.calls.length;
    moved = aAt('d'.repeat(64));
    text = SECOND;
    events.wake(5, 6);
    await settleWake();

    expect(log.delivered.map((one) => [one.document, one.delivery.verdict.kind])).toEqual([
      [1, 'raised']
    ]);
    const panel = drawn(pane.target, '.panel.external');
    expect(panel).toContain(translate(lang, 'browser.conflictOrigin.changedWhileOpen'));
    expect(pane.state.externalDocumentStatus(1)).toEqual({ kind: 'stale' });
    expect(vi.mocked(pane.commands.reloadDocument).mock.calls.length).toBe(reloadsBefore);
    expect(vi.mocked(pane.commands.documentText).mock.calls.length).toBe(textsBefore);
    // The viewer's snapshot underneath is the first change, not the second.
    expect(pane.state.fileText).toEqual({ kind: 'text', text: FIRST });
    expect(body.value).toBe(`${FIRST}# edited\n`);

    // **A file no surface is over is still reread**, beside the standing conflict.
    movedC = diskView(3, 'match/c.yml', '8'.repeat(64));
    events.wake(5, 7);
    await settleWake();
    expect(pane.commands.reloadDocument).toHaveBeenLastCalledWith(3);
    expect(pane.state.views.find((view) => view.id === 3)?.revision).toBe('8'.repeat(64));
    expect(log.delivered).toHaveLength(1);
    expect(drawn(pane.target, '.panel.external')).toContain(
      translate(lang, 'browser.externalConflict.revisionObserved', { revision: 'd'.repeat(64) })
    );
    expect(pane.commands.saveRawDocument).not.toHaveBeenCalled();
    pane.stop();
  }); // End of the "viewer refreshes, editor conflicts" case
}); // End of the "raw editor’s and restore’s drawn sentences" suite

describe('the delivery matrix’s remaining rows through the pane — Phase 2d-6-11a', () => {
  // **The gaps an audit of the suites above found**, each through the real
  // registry and the real coordinator boundary, over a finite drain queue whose
  // arguments are declared exactly: a pristine raw editor and restore, drafted
  // values surviving a delivery, and a closed creator's and recovery form's
  // delivery not following a reopened one.

  it.each(
    (['rawEditor', 'restore'] as const).flatMap((kind) => LOCALES.map((lang) => [kind, lang] as const))
  )('a pristine %s conflicts on its file’s change, and nothing is reloaded (%s)', async (kind, lang) => {
    expectedDrainArguments = [0, 0, 0];
    const events = paneEvents();
    const pane = await mountPane(
      false,
      { batches: [batch(0), batch(0), batch(5, [changed(5, 1, 'match/a.yml')])] },
      events.source
    );
    const log = watchDeliveries(pane.state);
    // Opened and left alone: nothing typed into the raw editor, nothing listed or
    // read in restore.
    await WALKS[kind].open(pane);
    flushSync();
    locale.setOverride(lang);
    flushSync();
    expect(registered(pane.state)).toEqual([WALKS[kind].expected]);
    expect(log.live()).toEqual([1]);
    expect(isDrawn(pane.target, '.panel.external')).toBe(false);
    const reads = readCounts(pane);

    events.wake(5, 5);
    await settleWake();

    // **Pristine, and told all the same** (R36).
    expect(log.delivered.map((one) => [one.document, one.delivery.verdict.kind])).toEqual([
      [1, 'raised']
    ]);
    expect(pane.state.standingConflictFor(1)?.kind).toBe('externalChange');
    expect(drawn(pane.target, '.panel.external')).toContain(
      translate(lang, 'browser.conflictOrigin.changedWhileOpen')
    );
    if (kind === 'rawEditor') {
      expect(box(pane.target, 'textarea').readOnly).toBe(true);
      expect(controlIn(pane.target, lang, 'browser.rawEditor.save').disabled).toBe(true);
    }
    // **No automatic reload**: no read ran across the wake and the window still
    // holds file 1 at the revision it opened over.
    expect(readCounts(pane)).toEqual(reads);
    expect(pane.state.views.find((view) => view.id === 1)?.revision).toBe('a'.repeat(64));
    expect(pane.commands.saveRawDocument).not.toHaveBeenCalled();
    pane.stop();
  }); // End of the "pristine raw or restore" case

  /** A surface a sentinel draft is set in, and how that draft is read back. */
  interface DraftWalk {
    /** What the commands answer beyond the defaults. */
    readonly script: PaneScript;
    /** The drained reading, about `match/a.yml`. */
    readonly revision: ContentRevision;
    /** The verdict each registration over `match/a.yml` is handed, in order. */
    readonly verdicts: readonly string[];
    /**
     * Opens the surface through the pane's controls and sets the sentinel.
     *
     * @param pane - The mounted pane.
     */
    readonly draft: (pane: Mounted) => Promise<void>;
    /**
     * Whether the sentinel is still what the control holds.
     *
     * @param target - Where the pane was mounted.
     * @returns `true` while it is.
     */
    readonly holdsSentinel: (target: HTMLElement) => boolean;
  }

  /** The sentinel every text draft below is set to. */
  const SENTINEL = 'sentinel-draft-11a';

  /**
   * Types a value into one box, as a person would.
   *
   * @param target - Where the pane was mounted.
   * @param selector - The box's selector.
   */
  function typeSentinel(target: HTMLElement, selector: string): void {
    const found = box(target, selector);
    found.value = SENTINEL;
    found.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
  } // End of function typeSentinel()

  const DRAFTS: Record<'matchEditor' | 'matchCreator' | 'matchMover' | 'recovery', DraftWalk> = {
    matchEditor: {
      script: {},
      revision: 'c'.repeat(64),
      verdicts: ['raised'],
      draft: async (pane) => {
        await WALKS.matchEditor.open(pane);
        flushSync();
        typeSentinel(pane.target, '.matchEditor textarea');
      },
      holdsSentinel: (target) => box(target, '.matchEditor textarea').value === SENTINEL
    },
    matchCreator: {
      script: {},
      revision: 'c'.repeat(64),
      verdicts: ['raised'],
      draft: async (pane) => {
        await WALKS.matchCreator.open(pane);
        flushSync();
        typeSentinel(pane.target, '.creator input.text');
      },
      holdsSentinel: (target) => creatorTrigger(target).value === SENTINEL
    },
    // The mover's draft is its position choice, which is a pressed button.
    matchMover: {
      script: { views: [documentAWithTwo(), documentB()] },
      revision: 'c'.repeat(64),
      verdicts: ['raised'],
      draft: async (pane) => {
        await WALKS.matchMover.open(pane);
        flushSync();
        control(pane.target, 'browser.matchMove.position.end').click();
        flushSync();
      },
      holdsSentinel: (target) =>
        control(target, 'browser.matchMove.position.end').getAttribute('aria-pressed') === 'true'
    },
    // A reading of a revision other than the save conflict's, so it supersedes.
    recovery: {
      script: { saveMatch: conflictedSave },
      revision: 'd'.repeat(64),
      // The host editor and the form, one envelope each (entry 2).
      verdicts: ['supersedes', 'supersedes'],
      draft: async (pane) => {
        await WALKS.recovery.open(pane);
        flushSync();
        typeSentinel(pane.target, '.recovery input.text');
      },
      holdsSentinel: (target) => box(target, '.recovery input.text').value === SENTINEL
    }
  };

  it.each(['matchEditor', 'matchCreator', 'matchMover', 'recovery'] as const)(
    'a drafted %s keeps its draft through a delivery, and nothing is reloaded',
    async (kind) => {
      expectedDrainArguments = [0, 0, 0];
      const walk = DRAFTS[kind];
      const events = paneEvents();
      const pane = await mountPane(
        false,
        {
          ...walk.script,
          batches: [batch(0), batch(0), batch(5, [changed(5, 1, 'match/a.yml', walk.revision)])]
        },
        events.source
      );
      const log = watchDeliveries(pane.state);
      await walk.draft(pane);
      expect(walk.holdsSentinel(pane.target)).toBe(true);
      const reads = readCounts(pane);

      events.wake(5, 5);
      await settleWake();

      expect(log.delivered.map((one) => one.delivery.verdict.kind)).toEqual(walk.verdicts);
      expect(pane.state.standingConflictFor(1)?.kind).toBe('externalChange');
      // **The draft is where the person left it.**
      expect(walk.holdsSentinel(pane.target)).toBe(true);
      expect(readCounts(pane)).toEqual(reads);
      expect(pane.state.views.find((view) => view.id === 1)?.revision).toBe('a'.repeat(64));
      pane.stop();
    }
  ); // End of the "drafted values survive" case

  it('never hands a reopened creator what its previous instance was told', async () => {
    expectedDrainArguments = [0, 0, 0, 5];
    const events = paneEvents();
    const pane = await mountPane(
      false,
      {
        batches: [
          batch(0),
          batch(0),
          batch(5, [changed(5, 1, 'match/a.yml')]),
          batch(6, [changed(6, 1, 'match/a.yml', 'd'.repeat(64))])
        ]
      },
      events.source
    );
    const log = watchDeliveries(pane.state);
    control(pane.target, 'browser.matchCreation.open').click();
    flushSync();
    events.wake(5, 5);
    await settleWake();
    expect(creatorTrigger(pane.target).readOnly).toBe(true);

    control(pane.target, 'browser.matchCreation.close').click();
    flushSync();
    if (maybeControl(pane.target, 'browser.matchCreation.discard') !== null) {
      control(pane.target, 'browser.matchCreation.discard').click();
      flushSync();
    }
    expect(log.live()).toEqual([]);
    expect(registered(pane.state)).toEqual([]);
    control(pane.target, 'browser.matchCreation.open').click();
    flushSync();
    // **A fresh session**: the old instance's delivery did not follow it.
    expect(creatorTrigger(pane.target).readOnly).toBe(false);
    expect(log.live()).toEqual([1]);

    events.wake(5, 6);
    await settleWake();
    // The first registration was told once and never again; only the second —
    // the reopened form's — was told of the later reading.
    expect(log.delivered.map((one) => one.registration)).toEqual([0, 1]);
    expect(creatorTrigger(pane.target).readOnly).toBe(true);
    expect(pane.commands.createMatch).not.toHaveBeenCalled();
    pane.stop();
  }); // End of the "reopened creator" case

  it('never hands a reopened recovery form what its previous instance was told', async () => {
    expectedDrainArguments = [0, 0, 0, 5];
    const events = paneEvents();
    const pane = await mountPane(
      false,
      {
        ...THREE_FILES,
        saveMatch: conflictedSave,
        batches: [
          batch(0),
          batch(0),
          batch(5, [changed(5, 3, 'match/c.yml')]),
          batch(6, [changed(6, 3, 'match/c.yml', 'e'.repeat(64))])
        ]
      },
      events.source
    );
    const log = watchDeliveries(pane.state);
    await editorInSaveConflict(pane);
    openRecoveryForm(pane);
    destinationIn(pane.target, '.recovery', 'match/c.yml').click();
    flushSync();
    events.wake(5, 5);
    await settleWake();
    expect(box(pane.target, '.recovery input.text').readOnly).toBe(true);
    // Registrations are counted in the order made: the host editor over `a` (0),
    // the form over `a` (1), then over `c` once `c` was chosen (2).
    expect(log.delivered.map((one) => [one.registration, one.document])).toEqual([[2, 3]]);

    control(pane.target, 'browser.recovery.close').click();
    flushSync();
    if (maybeControl(pane.target, 'browser.recovery.discard') !== null) {
      control(pane.target, 'browser.recovery.discard').click();
      flushSync();
    }
    expect(log.live()).toEqual([1]);
    expect(registered(pane.state)).toEqual([
      { kind: 'matchEditor', target: { kind: 'document', document: 1 } }
    ]);
    // **Reachable again from the host**, which still offers recovery.
    control(pane.target, recoveryChoiceKey('createFromSupportedFields')).click();
    flushSync();
    destinationIn(pane.target, '.recovery', 'match/c.yml').click();
    flushSync();
    expect(registered(pane.state)).toEqual([
      { kind: 'matchEditor', target: { kind: 'document', document: 1 } },
      { kind: 'recovery', target: { kind: 'document', document: 3 } }
    ]);
    // **A fresh session**: the old instance's delivery did not follow it.
    expect(box(pane.target, '.recovery input.text').readOnly).toBe(false);
    expect(log.live()).toEqual([1, 3]);

    events.wake(5, 6);
    await settleWake();
    // The closed form's registration (2) was told once and never again; only the
    // reopened form's registration over `c` (4) was told of the later reading.
    expect(log.delivered.map((one) => [one.registration, one.document])).toEqual([
      [2, 3],
      [4, 3]
    ]);
    expect(box(pane.target, '.recovery input.text').readOnly).toBe(true);
    expect(pane.commands.createMatch).not.toHaveBeenCalled();
    pane.stop();
  }); // End of the "reopened recovery form" case
}); // End of the "delivery matrix’s remaining rows" suite

describe('the snippet text editor inside the pane — Phase 3-8-2', () => {
  it('opens over the selected snippet and draws exactly the text the command answered', async () => {
    const owned = '  - trigger: ":a"\n    replace: "b"\n';
    const asked: MatchId[] = [];
    const pane = await mountPane(false, {
      matchItemText: async (id) => {
        asked.push(id);
        return { ok: true, value: { text: owned, first_line: 2, line_count: 2 } };
      }
    });
    const selected = snippetOf(pane.state, 1);
    await pane.state.select(selected);
    flushSync();
    control(pane.target, 'browser.rawSnippet.open').click();
    await settle();
    // Read by the identity the pane captured, and drawn whole: no text was cut here.
    expect(asked).toEqual([selected.id]);
    const box = pane.target.querySelector('.rawSnippet textarea');
    expect(box instanceof HTMLTextAreaElement && box.value).toBe(owned);
    expect(pane.target.textContent).toContain(
      translate('en', 'browser.rawSnippet.startsAt', { line: 2 })
    );
    // The editor outranks the pane's other openers while it is open.
    expect(pane.target.textContent).not.toContain(DICTIONARIES.en['browser.matchEditor.open']);
    pane.stop();
  }); // End of the "opens over the selected snippet" case

  it('offers the whole-document editor for a range with holes, and the offer reaches it', async () => {
    const pane = await mountPane(false, {
      matchItemText: async () => ({
        ok: false,
        failure: {
          kind: 'command',
          error: {
            code: 'itemTextRefused',
            error: { ItemRangeNotContiguous: { edit: 0, hole: { start: 10, end: 20 } } }
          }
        }
      })
    });
    await pane.state.select(snippetOf(pane.state, 1));
    flushSync();
    control(pane.target, 'browser.rawSnippet.open').click();
    await settle();
    expect(pane.target.textContent).toContain(
      DICTIONARIES.en['browser.rawSnippet.refused.rangeNotContiguous']
    );
    // No box is drawn for a range the editor refused.
    expect(pane.target.querySelector('.rawSnippet textarea')).toBeNull();

    control(pane.target, 'browser.rawSnippet.openWholeDocument').click();
    await settle();
    // The snippet editor is gone, its surface is returned, and the file's whole
    // text is on screen with the control that opens the whole-document editor.
    expect(pane.target.querySelector('.rawSnippet')).toBeNull();
    expect(registered(pane.state)).toEqual([]);
    control(pane.target, 'browser.rawEditor.open').click();
    flushSync();
    expect(registered(pane.state)).toEqual([
      { kind: 'rawEditor', target: { kind: 'document', document: 1 } }
    ]);
    pane.stop();
  }); // End of the "whole-document fallback" case

  it('says why the offer is missing while the window points at another file', async () => {
    const pane = await mountPane(false, {
      matchItemText: async () => ({
        ok: false,
        failure: {
          kind: 'command',
          error: {
            code: 'itemTextRefused',
            error: { ItemRangeNotContiguous: { edit: 0, hole: { start: 10, end: 20 } } }
          }
        }
      })
    });
    await pane.state.select(snippetOf(pane.state, 1));
    flushSync();
    control(pane.target, 'browser.rawSnippet.open').click();
    await settle();
    // Another file's snippet is selected while the editor stays open over file 1.
    await pane.state.select(snippetOf(pane.state, 2));
    await settle();
    expect(
      [...pane.target.querySelectorAll('button')].some(
        (one) => one.textContent?.trim() === DICTIONARIES.en['browser.rawSnippet.openWholeDocument']
      )
    ).toBe(false);
    expect(pane.target.textContent).toContain(
      DICTIONARIES.en['browser.rawSnippet.wholeDocumentElsewhere']
    );
    pane.stop();
  }); // End of the "offer missing" case
}); // End of the "snippet text editor inside the pane" suite
