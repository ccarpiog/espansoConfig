/** @vitest-environment jsdom */

/**
 * The restore pane, mounted over a **real** `BrowserState` and driven through
 * real DOM events.
 *
 * The eighth file in this repository to opt into jsdom, and it opts in the same
 * way the first seven do: by the docblock above and by nothing else. The suite's
 * default environment is still `node`.
 *
 * **This file is the whole of Phase 2c-5's mounted evidence** (consult Q7 item
 * 4). `restore.test.ts` drives the value over plain fixtures and cannot see any
 * of the claims below, every one of which only a screen can break:
 *
 * 1. **nothing on this screen invokes a command directly.** A hoisted mock
 *    replaces `@tauri-apps/api/core` with an `invoke` that records and rejects,
 *    and every case asserts it was never called. That covers two different
 *    mistakes at once: a component importing `../ipc/commands`, and — the one
 *    2c-5-4a handed forward as a live trap no type closes — a `createBrowserState`
 *    call that omits its third argument and silently reaches the real backup
 *    boundary. **This suite injects `BackupCommands` explicitly, in every case**;
 *    the mock is what would notice if it stopped;
 * 2. **the confirmation is bound to five values and the spend is one-shot.** The
 *    cases move the entry, the candidate, the preview generation and the revision
 *    this window projects, each on its own, and assert that nothing reaches
 *    `save_raw_document`; the destination is bound by construction, because this
 *    pane sends what the permit carries and the permit's document is the session's
 *    own;
 * 3. **the refusal is an affordance and the authorization is not.** One case
 *    opens a competing write surface **after** the question has been asked, in a
 *    way the rendered refusal cannot notice, and presses the confirmation anyway:
 *    the send is refused inside `confirmRestore`, which is where the guarantee
 *    lives;
 * 4. **the acknowledgement is candidate-scoped rather than one-attempt.** A
 *    refused attempt is acknowledged, the question is asked again, the question is
 *    **cancelled**, and a fresh question is answered — and the second send still
 *    carries the same acknowledgement;
 * 5. **a conflict installs nothing**, the adoption is reached only through the
 *    two-step control, and the pane honours `refused` by re-pointing nothing while
 *    treating `alreadyThere` as success;
 * 6. **a committed replacement discharges the invalidation and is never
 *    afterwards drawn as a failure**, including when this window could not bring
 *    itself back into step;
 * 7. **no sentence on the rendered screen makes a forbidden historical or
 *    authenticity claim**, in either language, scanned over the whole pane in each
 *    of nineteen **mutually exclusive** states — the catalogue and the question, the
 *    five things a transaction can answer, both send-failure arms, three conflict
 *    states, a change the watcher observed and a refused reload after the
 *    candidate was dropped (both since Phase 2d-6-8b), and each of the seven
 *    open-surface refusals. The outcome states cannot
 *    coexist, so one walk cannot reach them all; `panels()` is the table and every
 *    entry proves it arrived before the scan runs.
 *
 * **This does not replace the window reading**, which 2c-5-6 owes. A mounted test
 * proves a handler fires and that the right value reaches the boundary; jsdom has
 * no layout, so the sticky action row and the scroll-into-view are not measured
 * here.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeDocument,
  makeSummary,
  scriptedAcknowledgement,
  type ScriptedAcknowledgement
} from '../browser/fixtures';
import type { RawDocumentText } from '../browser/rawDocument';
import {
  openWriteSurfaceKey,
  type CompetingWriteSurfaceKind,
  type OpenWriteSurface
} from '../browser/restore';
import { conflictChoiceKey, type DiskAdoptionOutcome } from '../browser/saveOutcome';
import { rawSaveChoiceKey } from '../browser/rawSave';
import { codePointLabel } from '../browser/sourceText';
import {
  createBrowserState,
  type BackupCommands,
  type BrowserCommands,
  type BrowserState
} from '../browser/workspace.svelte';
import { DICTIONARIES, translate, type TranslationKey } from '../i18n/dictionaries';
import { LOCALES, type Locale } from '../i18n/locale';
import type {
  CommandResult,
  RawSaveInvalidation,
  RawSaveOutcome,
  ReloadAfterRawSave
} from '../ipc/commands';
import type { IpcFailure } from '../ipc/errors';
import { locale } from '../stores/locale.svelte';
import type {
  Acknowledgement,
  BackupBatchId,
  BackupBatchListing,
  BackupEntry,
  BackupEntryId,
  BackupEntryListing,
  BackupTextResponse,
  ContentRevision,
  DocumentId,
  DocumentSummary,
  DocumentView,
  Finding,
  MatchView,
  SaveResult,
  WorkspaceSummary
} from '../ipc/types';
import RestorePane from './RestorePane.svelte';
import type { SurfaceBinding } from '../browser/surfaceReceivers';
import type { ObservationReceiver } from '../browser/workspace.svelte';
import type { ConflictModel, ReloadConfirmation } from '../browser/saveOutcome';
import { externalConflictSource, type ExternalConflictObservation } from '../browser/conflictSource';
import {
  arbitratedDelivery,
  retainedDelivery,
  type ObservationDelivery
} from '../browser/observationDelivery';
import { reconciliationRefusalKey, type ReconciliationRefusal } from '../browser/reconciliationStatus';

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

/** The file every case replaces. */
const TARGET: DocumentId = 2;

/** The revision the destination held when the pane opened. */
const BASE: ContentRevision = 'a'.repeat(64);

/** The revision it holds after a committed replacement. */
const AFTER: ContentRevision = 'b'.repeat(64);

/** A third revision, for a destination some other writer moved. */
const ELSEWHERE: ContentRevision = 'c'.repeat(64);

/** The hash of the candidate bytes, which is never a base revision. */
const CANDIDATE_REVISION: ContentRevision = 'e'.repeat(64);

/**
 * The candidate's exact bytes.
 *
 * **A byte-order mark, CRLF line endings, a lone carriage return and a
 * distinctive word.** The first three are what a `<textarea>` would have
 * destroyed and `SourceText` does not; the fourth is what a case looks for on
 * screen, because a rendered `SourceText` replaces every character no font draws
 * with its localized *name* and a test that matched the whole string would be
 * matching the rendering rather than the text.
 *
 * **The lone carriage return is the one line ending a rendering can be held to.**
 * `sourceSegments` collapses a CRLF and a bare LF to the same `break` segment, so
 * the DOM cannot tell them apart and no mounted assertion can; a `\r` that is
 * *not* followed by `\n` becomes a named invisible segment instead, so the exact
 * candidate case can prove that character survived to the screen. What proves the
 * CRLF survived is the submission, which is asserted against these bytes whole.
 */
const CANDIDATE =
  '﻿matches:\r\n  - trigger: ":cand"\r\n    replace: "candidatebytes"\r\r\n';

/** The word that appears in {@link CANDIDATE} and nowhere else on the screen. */
const CANDIDATE_MARKER = 'candidatebytes';

/** A second entry's bytes, so a case can tell one candidate from another. */
const OTHER_CANDIDATE = 'matches:\n  - trigger: ":other"\n    replace: "otherbytes"\n';

/** The word that appears in {@link OTHER_CANDIDATE} and nowhere else. */
const OTHER_MARKER = 'otherbytes';

/** The whole file text a conflict's fresh read carried. */
const DISK_TEXT = 'matches:\n  - trigger: ":disk"\n    replace: "diskbytes"\n';

/** The word that appears in {@link DISK_TEXT} and nowhere else. */
const DISK_MARKER = 'diskbytes';

/** The recognised batch every case lists entries of. */
const BATCH: BackupBatchId = { name: '2026-02-03T040506Z-000' };

/** A second recognised batch, listed beside it. */
const OTHER_BATCH: BackupBatchId = { name: '2026-01-02T030405Z-000' };

/** The file summary the pane names. */
const FILE: DocumentSummary = makeSummary({ id: TARGET, relativePath: 'match/base.yml' });

/** What the workspace summary says; nothing in this file reads it. */
const SUMMARY: WorkspaceSummary = {
  root: '/tmp/espanso',
  documents: 1,
  match_files: 1,
  config_profiles: 0,
  packages: 0,
  disabled: 0
};

/**
 * One entry of one batch, as a listing found it.
 *
 * @param relativePath - The entry's path inside the batch.
 * @param batch - The batch it belongs to.
 * @param length - The byte length the listing recorded, as decimal digits.
 * @returns The entry.
 */
function entryOf(
  relativePath = 'match/base.yml',
  batch: BackupBatchId = BATCH,
  length = '61'
): BackupEntry {
  return {
    id: { batch, relative_path: relativePath },
    display_path: relativePath,
    length,
    target: { InConfigRoot: { relative_path: relativePath } }
  };
} // End of function entryOf()

/** The batch listing every case starts from, newest name first. */
const BATCHES: BackupBatchListing = {
  root: 'Present',
  batches: [
    { id: BATCH, display_name: BATCH.name },
    { id: OTHER_BATCH, display_name: OTHER_BATCH.name }
  ],
  skipped: ['ForeignName', 'ForeignName', 'NoMarker'],
  unrecognised: 3,
  unreadable: 0,
  complete: true
};

/**
 * One batch's entry listing, with two entries.
 *
 * @param batch - Which batch the listing is about.
 * @returns The listing.
 */
function entriesIn(batch: BackupBatchId = BATCH): BackupEntryListing {
  return {
    batch,
    entries: [entryOf('match/base.yml', batch), entryOf('match/other.yml', batch, '48')],
    skipped: [],
    unrecognised: 0,
    unreadable: 0,
    unaddressable: 0,
    complete: true
  };
} // End of function entriesIn()

/**
 * What `read_backup_text` answers for one entry.
 *
 * @param over - Whatever the case needs to differ.
 * @returns The response, as it crosses the boundary.
 */
function textResponse(over: Partial<BackupTextResponse> = {}): BackupTextResponse {
  return {
    entry: entryOf(),
    document: TARGET,
    text: CANDIDATE,
    revision: CANDIDATE_REVISION,
    ...over
  };
} // End of function textResponse()

/**
 * The destination's projection at one revision.
 *
 * @param revision - The revision it is of.
 * @returns The projection.
 */
function projectionAt(revision: ContentRevision): DocumentView {
  return makeDocument({ id: TARGET, relativePath: 'match/base.yml', revision, matches: [] });
} // End of function projectionAt()

/** The parse rejection a candidate this parser will not read comes back with. */
const DOES_NOT_PARSE: Finding = {
  code: {
    DocumentDoesNotParse: {
      // **Content-addressed**: the revision binds consent to one exact candidate,
      // so a finding handed back unchanged acknowledges these bytes and no
      // others. The cases below compare the acknowledgement against this whole
      // object for that reason, rather than against its code.
      revision: CANDIDATE_REVISION,
      line: 2,
      column: 3,
      byte_index: 14,
      detail: 'did not find expected key'
    }
  },
  span: null,
  node: null,
  path: null
};

/** The refusal such a candidate's first attempt comes back as. */
const REFUSED: SaveResult = {
  outcome: 'refused',
  verdict: 'RefusedForUnacknowledgedSuspicions',
  findings: [DOES_NOT_PARSE]
};

/** A replacement that ran to the end and wrote the file. */
const COMMITTED: SaveResult = {
  outcome: 'saved',
  revision: AFTER,
  committed: true,
  notes: [],
  backup_taken: true,
  moved: null
};

/** A replacement whose candidate was byte-identical to what the file held. */
const NOTHING_TO_WRITE: SaveResult = { ...COMMITTED, committed: false, backup_taken: false };

/** A replacement the file had moved on under. */
const CONFLICTED: SaveResult = {
  outcome: 'conflict',
  reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
  expected: BASE,
  found: ELSEWHERE,
  disk_revision: ELSEWHERE,
  disk_text: DISK_TEXT,
  disk: projectionAt(ELSEWHERE)
};

/** A command that ran and rejected without reaching the write. */
const REJECTED: IpcFailure = {
  kind: 'command',
  error: { code: 'identityStaleRevision', expected: ELSEWHERE, found: BASE }
};

/**
 * A rejection this application cannot tell the outcome of.
 *
 * `saveFailed` and nothing else, because `mayHaveWritten` in `../ipc/errors`
 * answers `true` for that one code — so this is what drives the *other* send-failure
 * arm, the one that says the file may already hold the candidate.
 */
const UNCERTAIN: IpcFailure = {
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

/** A re-read this window could not perform after a committed write. */
const UNREADABLE: IpcFailure = {
  kind: 'command',
  error: { code: 'unknownDocument', document: TARGET }
};

/** What this window had loaded of the destination's text. */
const LOADED: RawDocumentText = { kind: 'text', text: 'matches:\n  - trigger: ":live"\n' };

/** One call the pane made to the writing boundary. */
interface RecordedSave {
  /** Which file it aimed at. */
  readonly document: DocumentId;
  /** The revision it said the session was set up against. */
  readonly baseRevision: ContentRevision;
  /** The exact bytes it sent. */
  readonly text: string;
  /** The suspicions it said had already been shown to a person. */
  readonly acknowledgement: Acknowledgement;
}

/**
 * One scripted answer to one replacement.
 *
 * Which arm it produces is decided by which field it carries: `result` is the
 * transaction's own answer, and `failure` is the command rejecting.
 */
interface ScriptedSave {
  /** How the transaction ended. */
  readonly result?: SaveResult;
  /** Why the command rejected instead. */
  readonly failure?: IpcFailure;
  /** A re-read this window could not perform after a committed write. */
  readonly reloadFailure?: IpcFailure;
}

/** A mounted pane and everything a case needs to drive it. */
interface Mounted {
  /** The element the pane was mounted into. */
  readonly target: HTMLElement;
  /** The state it talks to, which is a real one. */
  readonly state: BrowserState;
  /** Every replacement that reached the writing boundary, in order. */
  readonly saves: readonly RecordedSave[];
  /** Every invalidation the pane discharged, in order. */
  readonly invalidations: readonly RawSaveInvalidation[];
  /** Every adoption the pane asked the window to perform, in order. */
  readonly adoptions: readonly unknown[];
  /** The write surfaces this window claims to have open. Mutable, on purpose. */
  readonly surfaces: OpenWriteSurface[];
  /** How many times the pane asked to be closed. */
  readonly closed: () => number;
  /**
   * Moves the file on and makes this window read it again.
   *
   * The only way a case can reach consult Q4's *changing the observed target
   * revision*: no control on this screen produces it, because it is the window
   * re-reading a file for its own reasons.
   *
   * @param revision - The revision the file now holds.
   */
  readonly moveTheFileOn: (revision: ContentRevision) => Promise<void>;
  /**
   * Hands the receiver this pane reported one sealed envelope directly, and
   * flushes — Phase 2d-6-8b. For the envelopes a case builds itself: a held
   * reading, or a conflict raised under an unknown write outcome.
   */
  readonly deliver: (delivery: ObservationDelivery) => void;
  /**
   * Tells the real state of one observation and flushes — Phase 2d-6-8b.
   *
   * `BrowserState.observeExternalChange`: the window arbitrates it once, registers
   * the origin and delivers the decision to the receivers over the file — which,
   * in an {@link Opened.live} mount, is this pane's. Nothing here drains or
   * starts a coordinator.
   *
   * @param observation - The narrowed observation.
   */
  readonly observe: (observation: ExternalConflictObservation) => void;
  /** Tears the pane down. */
  readonly stop: () => void;
}

/** Everything {@link mountRestore} takes beyond the replacements it scripts. */
interface Opened {
  /** What `read_backup_text` answers, in call order. */
  readonly reads?: readonly CommandResult<BackupTextResponse>[];
  /** What `list_backup_batches` answers, in call order. */
  readonly batches?: readonly CommandResult<BackupBatchListing>[];
  /** Write surfaces this window has open when the pane is mounted. */
  readonly surfaces?: readonly OpenWriteSurface[];
  /** What the window answers when the pane asks it to adopt a disk observation. */
  readonly adoption?: DiskAdoptionOutcome;
  /** What this window had loaded of the destination's text. */
  readonly loaded?: RawDocumentText | null;
  /**
   * Whether the pane's receiver is registered with the real state and its reload
   * adopts through the real `BrowserState.adoptDiskVersion` — Phase 2d-6-8b. An
   * explicit {@link Opened.adoption} still answers instead of the window.
   */
  readonly live?: boolean;
}

/**
 * How many times any surface built by {@link mountRestore} has been drained.
 *
 * Module level rather than per-mount because the assertion is about the file:
 * **no case in it may drain through the injected surface**. That bound is the
 * whole claim, and the other route is live here rather than hypothetical:
 * {@link mountRestore} builds a **real** `BrowserState`, and `workspace.svelte.ts`
 * holds a module-level `drainExternalChanges` binding that increments nothing in
 * this count. *No component imports the wrapper* is true and is narrower than
 * what this file executes, so it is not the bound. The other route is the hoisted
 * `invoke` spy's: since Phase 2d-5-6 the `afterEach` below holds `invoked` to zero
 * in every case, so a drain taking that route is caught file-wide and by command
 * name, where before it was caught only in the cases that asserted `invoked`
 * themselves. The `afterEach` reads and resets this count beside it.
 */
let drains = 0;

/**
 * A binding whose two methods do nothing — the `reportReceiver` answer for a
 * mount that drives no delivery (Phase 2d-6-8a made the prop required; the
 * deliveries themselves are driven through the real pane in
 * `DetailPane.test.ts`).
 *
 * @returns The inert binding.
 */
function inertBinding(): SurfaceBinding {
  return { reportTarget: () => undefined, withdraw: () => undefined };
} // End of function inertBinding()

/**
 * Mounts the pane over a real `BrowserState` and a scripted boundary.
 *
 * @param answers - What each successive replacement answers, in order.
 * @param opened - What the pane is opened over.
 * @returns The mounted pane.
 */
async function mountRestore(
  answers: readonly ScriptedSave[] = [],
  opened: Opened = {}
): Promise<Mounted> {
  const refusal: CommandResult<never> = {
    ok: false,
    failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
  };
  const views = new Map<number, DocumentView>([[TARGET, projectionAt(BASE)]]);
  const saves: RecordedSave[] = [];
  const remaining = [...answers];
  const reads = [...(opened.reads ?? [{ ok: true as const, value: textResponse() }])];
  const batchAnswers = [...(opened.batches ?? [])];
  const commands: BrowserCommands = {
    openWorkspace: async (): Promise<CommandResult<WorkspaceSummary>> => ({
      ok: true,
      value: SUMMARY
    }),
    listDocuments: async (): Promise<CommandResult<readonly DocumentSummary[]>> => ({
      ok: true,
      value: [FILE]
    }),
    getDocument: async (id: number): Promise<CommandResult<DocumentView>> => {
      const held = views.get(id);
      return held === undefined ? refusal : { ok: true, value: held };
    },
    getMatch: async (): Promise<CommandResult<MatchView>> => refusal,
    reloadDocument: async (id: number): Promise<CommandResult<DocumentView>> => {
      const held = views.get(id);
      return held === undefined ? refusal : { ok: true, value: held };
    },
    documentText: async (): Promise<CommandResult<string>> => refusal,
    moveMatch: async (): Promise<CommandResult<SaveResult>> => refusal,
    saveMatch: async (): Promise<CommandResult<SaveResult>> => refusal,
    createMatch: async (): Promise<CommandResult<SaveResult>> => refusal,
    deleteMatch: async (): Promise<CommandResult<SaveResult>> => refusal,
    duplicateMatch: async (): Promise<CommandResult<SaveResult>> => refusal,
    saveRawDocument: async (
      document: DocumentId,
      baseRevision: ContentRevision,
      text: string,
      acknowledgement: Acknowledgement,
      reload: ReloadAfterRawSave
    ): Promise<RawSaveOutcome> => {
      saves.push({ document, baseRevision, text, acknowledgement });
      const next = remaining.shift();
      if (next?.failure !== undefined) {
        return { ok: false, failure: next.failure };
      }
      const result = next?.result ?? REFUSED;
      if (result.outcome !== 'saved' || !result.committed) {
        return { ok: true, value: result, reload: { kind: 'notOwed' } };
      }
      // The real command calls the caller's reload before answering; the state's
      // own closure is what re-projects, so the map moves first.
      views.set(document, projectionAt(result.revision));
      await reload({ document, revision: result.revision });
      return {
        ok: true,
        value: result,
        reload:
          next?.reloadFailure === undefined
            ? { kind: 'done' }
            : { kind: 'failed', failure: next.reloadFailure }
      };
    },
    // Phase 2d-4b puts the drain on this surface; a restore never calls it
    // through the surface. The refusal is the answer no caller could proceed on,
    // and `drains` is what makes such a call *visible*: this stub is not even a
    // `vi.fn`, so without the count a call would leave no trace at all. The
    // `afterEach` below is the assertion, bounded as the count's own doc comment
    // states.
    drainExternalChanges: async () => {
      drains += 1;
      return refusal;
    }
  };
  const backup: BackupCommands = {
    listBackupBatches: async (): Promise<CommandResult<BackupBatchListing>> =>
      batchAnswers.shift() ?? { ok: true, value: BATCHES },
    listBackupEntries: async (
      batch: BackupBatchId
    ): Promise<CommandResult<BackupEntryListing>> => ({ ok: true, value: entriesIn(batch) }),
    readBackupText: async (): Promise<CommandResult<BackupTextResponse>> =>
      reads.shift() ?? { ok: true, value: textResponse() }
  };
  // **The third argument, explicitly.** `createBrowserState` has a real
  // production default for it, so a call that omitted it would reach `invoke`
  // rather than the script above — and the mock at the top of this file is what
  // would notice. No type says so, which is why every case here supplies it.
  const state = createBrowserState(commands, () => undefined, backup);
  await state.open(null);
  const projection = state.views.find((view) => view.id === TARGET);
  if (projection === undefined) {
    throw new Error('this suite needs a projection of the destination');
  }
  const surfaces: OpenWriteSurface[] = [...(opened.surfaces ?? [])];
  const invalidations: RawSaveInvalidation[] = [];
  const adoptions: unknown[] = [];
  let closes = 0;
  // The receiver the pane reports (Phase 2d-6-8b), and in a live mount its
  // registration with the real state over the destination.
  let receiver: ObservationReceiver | null = null;
  let unregister: (() => void) | null = null;
  const target = document.createElement('div');
  document.body.append(target);
  const component = mount(RestorePane, {
    target,
    props: {
      acknowledgement: acknowledging.port,
      projection,
      file: FILE,
      loadedText: opened.loaded === undefined ? LOADED : opened.loaded,
      projections: (): readonly DocumentView[] => state.views,
      surfaces: (): readonly OpenWriteSurface[] => surfaces,
      listBatches: () => state.listBackupBatches(),
      listEntries: (batch: BackupBatchId) => state.listBackupEntries(batch),
      readEntry: (entry: BackupEntryId, into: DocumentId) => state.readBackupText(entry, into),
      restore: state.restoreDocument,
      reportReceiver: (reported: ObservationReceiver): SurfaceBinding => {
        receiver = reported;
        if (opened.live === true) {
          unregister = state.registerObservationReceiver(TARGET, reported);
        }
        return {
          ...inertBinding(),
          withdraw: () => {
            unregister?.();
          }
        };
      },
      invalidate: (invalidation: RawSaveInvalidation): void => {
        invalidations.push(invalidation);
      },
      adoptDiskVersion: (
        conflict: ConflictModel<string>,
        confirmation: ReloadConfirmation
      ): DiskAdoptionOutcome => {
        adoptions.push(conflict);
        if (opened.adoption === undefined && opened.live === true) {
          return state.adoptDiskVersion(conflict, confirmation);
        }
        return opened.adoption ?? 'installed';
      },
      close: (): void => {
        closes += 1;
      }
    }
  });
  flushSync();
  return {
    target,
    state,
    saves,
    invalidations,
    adoptions,
    surfaces,
    closed: () => closes,
    moveTheFileOn: async (revision: ContentRevision): Promise<void> => {
      views.set(TARGET, projectionAt(revision));
      await state.rereadDocument(TARGET);
    },
    deliver: (delivery: ObservationDelivery): void => {
      receiver?.(delivery);
      flushSync();
    },
    observe: (observation: ExternalConflictObservation): void => {
      state.observeExternalChange(observation);
      flushSync();
    },
    stop: () => {
      void unmount(component);
      target.remove();
      // Every coordinator created is disposed before its case ends (ruling 35).
      // Nothing this pane draws starts one, so this releases nothing today; it is
      // here so that the rule holds for every state this file builds rather than
      // for the ones a case remembers.
      state.dispose();
    }
  };
} // End of function mountRestore()

/**
 * The button whose label is one rendering of one key, or `null`.
 *
 * Matched against the dictionary rather than against a literal, so this file
 * holds no user-facing text of its own.
 *
 * @param target - Where the pane was mounted.
 * @param key - The key holding the button's label.
 * @param params - Whatever the sentence substitutes.
 * @returns The button, or `null`.
 */
function button(
  target: HTMLElement,
  key: TranslationKey,
  params?: Readonly<Record<string, string | number>>
): HTMLButtonElement | null {
  const label = translate(locale.current, key, params);
  const found = [...target.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === label
  );
  return found ?? null;
} // End of function button()

/**
 * The same button, insisted upon.
 *
 * @param target - Where the pane was mounted.
 * @param key - The key holding the button's label.
 * @param params - Whatever the sentence substitutes.
 * @returns The button.
 */
function control(
  target: HTMLElement,
  key: TranslationKey,
  params?: Readonly<Record<string, string | number>>
): HTMLButtonElement {
  const found = button(target, key, params);
  if (found === null) {
    throw new Error(
      `this case needs the control labelled ${translate(locale.current, key, params)}`
    );
  }
  return found;
} // End of function control()

/**
 * The button that chooses one entry, which wears the entry's own path.
 *
 * A display path is data rather than a sentence, so it is matched literally —
 * the one label on this screen that is not a dictionary value.
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
 * Whether the pane is showing one sentence.
 *
 * @param target - Where the pane was mounted.
 * @param key - The key holding the sentence.
 * @returns `true` when the rendered text contains it.
 */
function says(target: HTMLElement, key: TranslationKey): boolean {
  return (target.textContent ?? '').includes(DICTIONARIES[locale.current][key]);
} // End of function says()

/**
 * The `SourceText` box the candidate is drawn in.
 *
 * Found by the section it lives in rather than by position among the pane's three
 * boxes, so a fourth one added above it does not silently retarget the assertions.
 *
 * @param target - Where the pane was mounted.
 * @returns The candidate's rendered container.
 */
function candidateBox(target: HTMLElement): HTMLElement {
  const step = [...target.querySelectorAll('section.step')].find((one) =>
    (one.textContent ?? '').includes(DICTIONARIES[locale.current]['browser.restore.candidateExact'])
  );
  const box = step?.querySelector('.sourceText');
  if (!(box instanceof HTMLElement)) {
    throw new Error('this case needs the candidate drawn through SourceText');
  }
  return box;
} // End of function candidateBox()

/**
 * The text nodes one rendered box holds, in order.
 *
 * The runs of the file's own characters, with the named invisible segments and the
 * line-ending elements left out — so an assertion over them is an assertion about
 * what the document holds between the things a font cannot draw.
 *
 * **Empty text nodes are dropped and nothing is trimmed.** Svelte's `{#each}`
 * leaves empty anchors between the blocks it renders, and they carry no
 * characters; every node that does carry characters is kept exactly as it stands,
 * leading spaces included, because the indentation *is* what a run has to survive.
 *
 * @param box - A rendered `SourceText` container.
 * @returns Each non-empty text node's content, in document order.
 */
function textRuns(box: HTMLElement): readonly string[] {
  return [...box.childNodes]
    .filter((node) => node.nodeType === node.TEXT_NODE)
    .map((node) => node.textContent ?? '')
    .filter((run) => run !== '');
} // End of function textRuns()

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
 * Walks the catalogue to a retained candidate.
 *
 * @param pane - The mounted pane.
 * @param path - Which entry to choose.
 */
async function walkToCandidate(pane: Mounted, path = 'match/base.yml'): Promise<void> {
  control(pane.target, 'browser.restore.listBatches').click();
  await settle();
  control(pane.target, 'browser.restore.batchNamed', { name: BATCH.name }).click();
  await settle();
  entryControl(pane.target, path).click();
  await settle();
} // End of function walkToCandidate()

/**
 * Walks to a candidate and asks the destructive question.
 *
 * @param pane - The mounted pane.
 */
async function walkToQuestion(pane: Mounted): Promise<void> {
  await walkToCandidate(pane);
  control(pane.target, 'browser.restore.prepare').click();
  flushSync();
} // End of function walkToQuestion()

/**
 * The acknowledgement port every mount here is handed (Phase 2d-6-9b-2), fresh for
 * each case: it predicts an enabled control and accepts a press until a case
 * scripts otherwise, and records which source each press minted from.
 */
let acknowledging: ScriptedAcknowledgement = scriptedAcknowledgement();

beforeEach(() => {
  acknowledging = scriptedAcknowledgement();
  invoked.mockClear();
  locale.setOverride('en');
});

afterEach(() => {
  locale.setOverride(null);
  // Read, then cleared, then asserted, so one defect fails one case rather than
  // every case after it. The route first (ruling 34): a wrapper that reached the
  // real `invoke` is reported here by command name, and zero is the number in
  // every case because even an intended drain must use the injected boundary.
  const drained = drains;
  drains = 0;
  expect(invoked).not.toHaveBeenCalled();
  // Then the drain budget (ruling 35), which in this file is an exact zero for
  // every case rather than a scripted queue: nothing this pane draws starts the
  // coordinator, so no case here reconciles, and a case that began to would owe
  // the scripted answers `workspace.test.ts` scripts rather than a larger
  // allowance here. This is the assertion `mountRestore()`'s refusal cannot make
  // on its own.
  expect(drained).toBe(0);
}); // End of the afterEach that closes the route and the drain budget

describe('the mounted restore pane: the catalogue and the candidate', () => {
  it('walks a recognised batch to an exact candidate without invoking anything', async () => {
    const pane = await mountRestore();
    // Nothing is asked for until it is asked for: the pane opens with the
    // destination named, the warning shown and no listing at all.
    expect(says(pane.target, 'browser.restore.warning')).toBe(true);
    expect(pane.target.textContent).toContain('match/base.yml');
    expect(says(pane.target, 'browser.restore.refused.noCandidate')).toBe(true);

    await walkToCandidate(pane);

    expect(says(pane.target, 'browser.restore.candidateExact')).toBe(true);
    // **The rendering, segment by segment, and not a distinctive substring.** The
    // 2c-5-4b review's finding 4: this case used to look for `CANDIDATE_MARKER`
    // alone, so it would have passed with the byte-order mark dropped, the
    // carriage return normalised away, or `SourceText` replaced by markup showing
    // only the interesting line. What is asserted now is what `SourceText` with
    // `documentStart` is *for*.
    const box = candidateBox(pane.target);
    // Both invisible characters are named rather than shown as nothing, and the
    // byte-order mark is named as one — which it is only because `documentStart`
    // is passed. A `documentStart`-less rendering calls it a zero-width character.
    expect([...box.querySelectorAll('span.invisible')].map((one) => one.textContent)).toEqual([
      translate('en', 'browser.source.invisible.bom', { code: codePointLabel('﻿') }),
      translate('en', 'browser.source.invisible.carriageReturn', { code: codePointLabel('\r') })
    ]);
    // Every line ending is a `<br>` and not a newline in a text node, and the
    // candidate has three.
    expect(box.querySelectorAll('br')).toHaveLength(3);
    // And the surrounding text is the file's own runs, in order, untrimmed.
    expect(textRuns(box)).toEqual([
      'matches:',
      '  - trigger: ":cand"',
      `    replace: "${CANDIDATE_MARKER}"`
    ]);
    // And nothing reached the Tauri boundary: every read went through the
    // injected `BackupCommands`, which is what the third argument of
    // `createBrowserState` is for.
    expect(invoked).not.toHaveBeenCalled();
    pane.stop();
  }); // End of the "walks to an exact candidate" case

  it('measures the candidate itself and discloses a listing that disagrees', async () => {
    // The listing recorded 61 bytes; the candidate is a byte-order mark plus a
    // CRLF document, and `candidateMeasurements` counts what would be written.
    const pane = await mountRestore();
    await walkToCandidate(pane);

    const bytes = new TextEncoder().encode(CANDIDATE).length;
    expect(bytes).not.toBe(61);
    expect(
      says(pane.target, 'browser.restore.listedDiffers') ||
        (pane.target.textContent ?? '').includes(
          translate('en', 'browser.restore.listedDiffers', { length: '61' })
        )
    ).toBe(true);
    expect(pane.target.textContent).toContain(
      translate('en', 'browser.restore.candidateMeasured', {
        bytes,
        characters: [...CANDIDATE].length
      })
    );
    pane.stop();
  }); // End of the "measures the candidate itself" case

  it('draws the window’s own loaded observation, labelled as one', async () => {
    const pane = await mountRestore();
    expect(says(pane.target, 'browser.restore.loadedObservation')).toBe(true);
    expect(pane.target.textContent).toContain(':live');
    // And the pane draws nothing of it when this window loaded nothing.
    const blind = await mountRestore([], { loaded: null });
    expect(says(blind.target, 'browser.restore.loadedObservation')).toBe(false);
    pane.stop();
    blind.stop();
  });

  it('collapses one skip code per entry to one sentence per reason', async () => {
    // The listing carries `ForeignName` twice and `NoMarker` once. A screen that
    // walked the list as it arrived would print the first sentence twice.
    const pane = await mountRestore();
    control(pane.target, 'browser.restore.listBatches').click();
    await settle();
    const foreign = DICTIONARIES.en['code.batchSkipped.foreignName'];
    const text = pane.target.textContent ?? '';
    expect(text.split(foreign).length - 1).toBe(1);
    expect(text).toContain(DICTIONARIES.en['code.batchSkipped.noMarker']);
    pane.stop();
  }); // End of the "collapses skip codes" case

  it('shows the refusal a read of an entry that is not this file comes back with', async () => {
    const mismatch: IpcFailure = {
      kind: 'command',
      error: { code: 'backupEntryIsNotThisDocument', document: TARGET }
    };
    const pane = await mountRestore([], { reads: [{ ok: false, failure: mismatch }] });
    await walkToCandidate(pane, 'match/other.yml');

    expect(says(pane.target, 'browser.restore.entriesRefused')).toBe(true);
    expect(pane.target.textContent).toContain(
      DICTIONARIES.en['code.commandError.backupEntryIsNotThisDocument']
    );
    // No candidate was retained, so nothing can be prepared.
    expect(control(pane.target, 'browser.restore.prepare').disabled).toBe(true);
    expect(says(pane.target, 'browser.restore.refused.noCandidate')).toBe(true);
    pane.stop();
  }); // End of the "refused read" case

  it('draws the specific reason beside a refused entry read, in both languages', async () => {
    // The wire nests the reason at `error.error`, where `describeCommandError`
    // substitutes nothing — so before 2c-5-6b's fix this panel drew two generic
    // sentences that each promised a reason beside themselves and nothing
    // supplied one (that reading's §4, the Medium). The offset is 7 rather
    // than 0 so this case proves the operand travelled, not a default.
    const notUtf8: IpcFailure = {
      kind: 'command',
      error: {
        code: 'backupReadFailed',
        error: {
          NotUtf8: { entry: { batch: BATCH, relative_path: 'match/base.yml' }, offset: 7 }
        }
      }
    };
    const pane = await mountRestore([], { reads: [{ ok: false, failure: notUtf8 }] });
    await walkToCandidate(pane);

    // The two sentences the panel always drew still stand…
    expect(says(pane.target, 'browser.restore.entriesRefused')).toBe(true);
    expect(pane.target.textContent).toContain(
      DICTIONARIES.en['code.commandError.backupReadFailed']
    );
    // …and the purpose-built reason now stands beside them, offset substituted,
    // rendered through the typed accessor and never a hand-built key.
    expect(pane.target.textContent).toContain(
      translate('en', 'code.backupReadError.notUtf8', { offset: 7 })
    );
    // The same mounted panel re-rendered in Spanish draws the Spanish sentence.
    locale.setOverride('es');
    flushSync();
    expect(pane.target.textContent).toContain(
      translate('es', 'code.backupReadError.notUtf8', { offset: 7 })
    );
    expect(invoked).not.toHaveBeenCalled();
    pane.stop();
  }); // End of the "specific reason beside a refused entry read" case

  it('draws the specific reason beside a refused batch listing', async () => {
    // The batches catalogue's failed panel has the same shape as the entries
    // one, and no launch can reach it — the seeded root is always a private
    // directory — so this case is that arm's whole evidence (2c-5-6's record
    // says so in its disposition).
    const rootGone: IpcFailure = {
      kind: 'command',
      error: {
        code: 'backupReadFailed',
        error: { RootNotADirectory: { path: '/tmp/espanso/.espansoconfig-backups' } }
      }
    };
    const pane = await mountRestore([], { batches: [{ ok: false, failure: rootGone }] });
    control(pane.target, 'browser.restore.listBatches').click();
    await settle();

    expect(says(pane.target, 'browser.restore.entriesRefused')).toBe(true);
    expect(pane.target.textContent).toContain(
      DICTIONARIES.en['code.commandError.backupReadFailed']
    );
    // The path operand, substituted through the same typed accessor.
    expect(pane.target.textContent).toContain(
      translate('en', 'code.backupReadError.rootNotADirectory', {
        path: '/tmp/espanso/.espansoconfig-backups'
      })
    );
    expect(invoked).not.toHaveBeenCalled();
    pane.stop();
  }); // End of the "specific reason beside a refused batch listing" case
}); // End of the "catalogue and candidate" suite

describe('the mounted restore pane: the two-stage confirmation', () => {
  it('sends nothing until the second control, then sends exactly what was shown', async () => {
    const pane = await mountRestore([{ result: COMMITTED }]);
    await walkToCandidate(pane);
    expect(says(pane.target, 'browser.restore.question')).toBe(false);
    expect(pane.saves).toHaveLength(0);

    control(pane.target, 'browser.restore.prepare').click();
    flushSync();
    // The question is asked and still nothing has been sent.
    expect(says(pane.target, 'browser.restore.question')).toBe(true);
    expect(says(pane.target, 'browser.restore.confirmBinding')).toBe(true);
    expect(pane.saves).toHaveLength(0);

    control(pane.target, 'browser.restore.confirm').click();
    await settle();

    // **The exact candidate, the session's own base revision, the destination the
    // pane opened over, and no consent nobody gave.**
    expect(pane.saves).toEqual([
      { document: TARGET, baseRevision: BASE, text: CANDIDATE, acknowledgement: { accepted: [] } }
    ]);
    expect(invoked).not.toHaveBeenCalled();
    pane.stop();
  }); // End of the "sends nothing until the second control" case

  it('takes the question back without touching the candidate', async () => {
    const pane = await mountRestore();
    await walkToQuestion(pane);

    control(pane.target, 'browser.restore.cancel').click();
    flushSync();

    expect(says(pane.target, 'browser.restore.question')).toBe(false);
    expect(pane.target.textContent).toContain(CANDIDATE_MARKER);
    expect(control(pane.target, 'browser.restore.prepare').disabled).toBe(false);
    expect(pane.saves).toHaveLength(0);
    pane.stop();
  });

  it('withdraws the question when another entry is chosen', async () => {
    const pane = await mountRestore([], {
      reads: [
        { ok: true, value: textResponse() },
        {
          ok: true,
          value: textResponse({
            entry: entryOf('match/other.yml'),
            text: OTHER_CANDIDATE,
            revision: 'f'.repeat(64)
          })
        }
      ]
    });
    await walkToQuestion(pane);

    entryControl(pane.target, 'match/other.yml').click();
    await settle();

    expect(says(pane.target, 'browser.restore.question')).toBe(false);
    expect(pane.target.textContent).toContain(OTHER_MARKER);
    expect(pane.target.textContent).not.toContain(CANDIDATE_MARKER);
    expect(pane.saves).toHaveLength(0);
    pane.stop();
  }); // End of the "another entry withdraws" case

  it('withdraws the question when the catalogue is listed again', async () => {
    const pane = await mountRestore();
    await walkToQuestion(pane);

    control(pane.target, 'browser.restore.relistBatches').click();
    await settle();

    expect(says(pane.target, 'browser.restore.question')).toBe(false);
    expect(pane.saves).toHaveLength(0);
    pane.stop();
  });

  it('withdraws the question when this window re-reads the destination', async () => {
    // Consult Q4's *changing the observed target revision*, and the only one of
    // the five withdrawals no control on this screen produces.
    const pane = await mountRestore();
    await walkToQuestion(pane);
    expect(says(pane.target, 'browser.restore.question')).toBe(true);

    await pane.moveTheFileOn(ELSEWHERE);
    await settle();

    expect(says(pane.target, 'browser.restore.question')).toBe(false);
    // The candidate is untouched by it — it is a backup entry's bytes and has
    // nothing to do with what the destination holds — and the question can be
    // asked again, now against the reading this window holds.
    expect(pane.target.textContent).toContain(CANDIDATE_MARKER);
    expect(control(pane.target, 'browser.restore.prepare').disabled).toBe(false);
    expect(pane.saves).toHaveLength(0);
    pane.stop();
  }); // End of the "a re-read withdraws" case

  it('refuses to prepare while another write surface over this file is open', async () => {
    const pane = await mountRestore([], {
      surfaces: [{ kind: 'matchEditor', target: { kind: 'document', document: TARGET } }]
    });
    await walkToCandidate(pane);

    expect(control(pane.target, 'browser.restore.prepare').disabled).toBe(true);
    expect(says(pane.target, 'browser.restore.refused.matchEditorOpen')).toBe(true);
    // The sentence claims an open editor and this application's inability to tell
    // whether it was edited, and never that unsaved edits exist.
    expect(pane.target.textContent).toContain('cannot tell whether');
    pane.stop();
  }); // End of the "refuses to prepare" case

  it('ignores a surface open over another file', async () => {
    const pane = await mountRestore([], {
      surfaces: [{ kind: 'matchEditor', target: { kind: 'document', document: 99 } }]
    });
    await walkToCandidate(pane);

    expect(control(pane.target, 'browser.restore.prepare').disabled).toBe(false);
    expect(says(pane.target, 'browser.restore.refused.matchEditorOpen')).toBe(false);
    pane.stop();
  });

  it('refuses the send for a surface opened after the question, which the screen cannot see', async () => {
    // **The affordance is not the safety proof.** The array the pane reads is
    // mutated in place, so nothing re-renders and the refusal beside the control
    // is stale — which is exactly the state a surface opened after the preview
    // puts this pane in. What refuses is `confirmRestore`, from the same one read
    // of the window the handler makes at the moment of the click.
    const pane = await mountRestore([{ result: COMMITTED }]);
    await walkToQuestion(pane);
    expect(control(pane.target, 'browser.restore.confirm').disabled).toBe(false);

    pane.surfaces.push({ kind: 'rawEditor', target: { kind: 'document', document: TARGET } });
    control(pane.target, 'browser.restore.confirm').click();
    await settle();

    expect(pane.saves).toHaveLength(0);
    expect(invoked).not.toHaveBeenCalled();
    pane.stop();
  }); // End of the "refuses the send for a late surface" case

  it('spends one question once, however many times the control is pressed', async () => {
    const pane = await mountRestore([{ result: COMMITTED }, { result: COMMITTED }]);
    await walkToQuestion(pane);

    const confirm = control(pane.target, 'browser.restore.confirm');
    confirm.click();
    confirm.click();
    confirm.click();
    await settle();

    expect(pane.saves).toHaveLength(1);
    pane.stop();
  }); // End of the "one question once" case
}); // End of the "two-stage confirmation" suite

describe('the mounted restore pane: what the transaction answers', () => {
  it('says the file was written, discharges the invalidation, and stays open', async () => {
    const pane = await mountRestore([{ result: COMMITTED }]);
    await walkToQuestion(pane);
    control(pane.target, 'browser.restore.confirm').click();
    await settle();

    expect(says(pane.target, 'browser.saveOutcome.fileWritten')).toBe(true);
    expect(says(pane.target, 'browser.restore.replaced')).toBe(true);
    // The whole-document invalidation is the post-commit half of the
    // open-surface rule, and this pane's host is what performs it.
    expect(pane.invalidations).toEqual([{ document: TARGET, revision: AFTER }]);
    // The pane stays open so the outcome can be read, and it refuses to replace
    // anything again.
    expect(pane.closed()).toBe(0);
    expect(says(pane.target, 'browser.restore.refused.alreadyRestored')).toBe(true);
    expect(control(pane.target, 'browser.restore.prepare').disabled).toBe(true);
    pane.stop();
  }); // End of the "says the file was written" case

  it('never draws a committed write as a failure when this window fell out of step', async () => {
    const pane = await mountRestore([{ result: COMMITTED, reloadFailure: UNREADABLE }]);
    await walkToQuestion(pane);
    control(pane.target, 'browser.restore.confirm').click();
    await settle();

    // Both, and in that order: the file was written, and this window is out of
    // step **beside** it rather than in place of it.
    expect(says(pane.target, 'browser.saveOutcome.fileWritten')).toBe(true);
    expect(says(pane.target, 'browser.saveOutcome.windowOutOfStep')).toBe(true);
    expect(says(pane.target, 'browser.restore.sendFailed')).toBe(false);
    pane.stop();
  }); // End of the "committed but out of step" case

  it('draws a byte-identical candidate as a success in which nothing was written', async () => {
    const pane = await mountRestore([{ result: NOTHING_TO_WRITE }]);
    await walkToQuestion(pane);
    control(pane.target, 'browser.restore.confirm').click();
    await settle();

    expect(says(pane.target, 'browser.saveOutcome.nothingToWrite')).toBe(true);
    // Nothing became stale, so the sentence about every snippet having a new
    // identity would be false and is not drawn.
    expect(says(pane.target, 'browser.restore.replaced')).toBe(false);
    expect(pane.invalidations).toHaveLength(0);
    pane.stop();
  }); // End of the "nothing to write" case

  it('says a send that produced no outcome wrote nothing, and offers no invention', async () => {
    const pane = await mountRestore([{ failure: REJECTED }]);
    await walkToQuestion(pane);
    control(pane.target, 'browser.restore.confirm').click();
    await settle();

    expect(says(pane.target, 'browser.restore.sendFailed')).toBe(true);
    expect(says(pane.target, 'browser.restore.mayHaveWritten')).toBe(false);
    // **No typed reason is drawn, and that is a limit rather than an omission.**
    // `RawSaveAnswer`'s failed arm carries only `mayHaveWritten`, so
    // `restoreCouldNotBeSent` raises a `SendFailure` with a `null` reason and
    // `failureLines` is empty — the raw editor has the identical limit and states
    // it. What must never appear is the heading over reasons that are not there.
    expect(says(pane.target, 'browser.restore.failureReason')).toBe(false);
    expect(pane.target.textContent).not.toContain(
      DICTIONARIES.en['code.commandError.identityStaleRevision']
    );
    // And the question was withdrawn, so a person can set it up again.
    expect(says(pane.target, 'browser.restore.question')).toBe(false);
    pane.stop();
  }); // End of the "send failed" case

  it('acknowledges a parse finding, asks again, and carries the same consent', async () => {
    // **The acknowledgement is candidate-scoped, not one-attempt.** The question
    // is re-asked, cancelled, and asked once more; the send that finally happens
    // still carries the consent collected before the cancellation.
    const pane = await mountRestore([{ result: REFUSED }, { result: COMMITTED }]);
    await walkToQuestion(pane);
    control(pane.target, 'browser.restore.confirm').click();
    await settle();

    expect(pane.saves).toHaveLength(1);
    expect(pane.saves[0]?.acknowledgement).toEqual({ accepted: [] });
    expect(pane.target.textContent).toContain(
      DICTIONARIES.en['browser.rawSave.replacesWholeDocument']
    );
    expect(says(pane.target, 'browser.restore.acknowledgedAsksAgain')).toBe(true);

    control(pane.target, rawSaveChoiceKey('saveAnyway', 'operationChoice')).click();
    flushSync();
    // Nothing was sent by accepting: the question is asked again instead.
    expect(pane.saves).toHaveLength(1);
    expect(says(pane.target, 'browser.restore.question')).toBe(true);

    control(pane.target, 'browser.restore.cancel').click();
    flushSync();
    control(pane.target, 'browser.restore.prepare').click();
    flushSync();
    control(pane.target, 'browser.restore.confirm').click();
    await settle();

    expect(pane.saves).toHaveLength(2);
    // The whole finding, its content-addressed revision included, so consent
    // collected for these bytes cannot be spent on any others.
    expect(pane.saves[1]?.acknowledgement).toEqual({ accepted: [DOES_NOT_PARSE] });
    expect(pane.saves[1]?.text).toBe(CANDIDATE);
    pane.stop();
  }); // End of the "acknowledges a parse finding" case
}); // End of the "what the transaction answers" suite

describe('the mounted restore pane: the conflict', () => {
  /**
   * Walks to a conflict on screen.
   *
   * @param opened - What the pane is opened over.
   * @returns The mounted pane, showing the conflict.
   */
  async function conflicted(opened: Opened = {}): Promise<Mounted> {
    const pane = await mountRestore([{ result: CONFLICTED }], opened);
    await walkToQuestion(pane);
    control(pane.target, 'browser.restore.confirm').click();
    await settle();
    return pane;
  } // End of function conflicted()

  it('installs nothing, keeps the candidate, and shows both sides', async () => {
    const pane = await conflicted();

    expect(pane.adoptions).toHaveLength(0);
    expect(says(pane.target, 'browser.saveOutcome.nothingWasWritten')).toBe(true);
    expect(says(pane.target, 'browser.saveOutcome.reloadRetargetsCandidate')).toBe(true);
    // The retained side is the operation summary; the disk side is the whole text
    // the command layer read. Both are on screen and neither is the other.
    expect(pane.target.textContent).toContain(
      DICTIONARIES.en['browser.saveOutcome.operation.replaceFileFromBackup']
    );
    expect(pane.target.textContent).toContain(DISK_MARKER);
    expect(pane.target.textContent).toContain(CANDIDATE_MARKER);
    // No copy is offered: the candidate is not something a person wrote.
    expect(button(pane.target, conflictChoiceKey('copyDraft', 'operationChoice'))).toBeNull();
    pane.stop();
  }); // End of the "installs nothing" case

  it('reaches the adoption only through the two-step control', async () => {
    const pane = await conflicted();
    // Step one is offered; step two is not, until step one is pressed.
    expect(
      button(pane.target, conflictChoiceKey('reloadDiskVersion', 'operationChoice'))
    ).not.toBeNull();
    expect(
      button(pane.target, conflictChoiceKey('confirmReloadKeeping', 'operationChoice'))
    ).toBeNull();

    control(pane.target, conflictChoiceKey('reloadDiskVersion', 'operationChoice')).click();
    flushSync();
    expect(pane.adoptions).toHaveLength(0);
    expect(
      button(pane.target, conflictChoiceKey('reloadDiskVersion', 'operationChoice'))
    ).toBeNull();

    control(pane.target, conflictChoiceKey('confirmReloadKeeping', 'operationChoice')).click();
    flushSync();

    expect(pane.adoptions).toHaveLength(1);
    // **The candidate survives and the pane stays open**, which is what the
    // label promises and what `retargetsCandidate` means. The confirmation is
    // withdrawn, because it was given against a reading this window has left.
    expect(pane.target.textContent).toContain(CANDIDATE_MARKER);
    expect(pane.closed()).toBe(0);
    expect(says(pane.target, 'browser.restore.question')).toBe(false);
    pane.stop();
  }); // End of the "two-step adoption" case

  it('treats an adoption the window refused as a refusal, and says the control has gone', async () => {
    const pane = await conflicted({ adoption: 'refused' });
    control(pane.target, conflictChoiceKey('reloadDiskVersion', 'operationChoice')).click();
    flushSync();
    control(pane.target, conflictChoiceKey('confirmReloadKeeping', 'operationChoice')).click();
    flushSync();

    expect(pane.adoptions).toHaveLength(1);
    expect(
      says(pane.target, 'browser.saveOutcome.reloadUnavailableOperation')
    ).toBe(true);
    expect(
      button(pane.target, conflictChoiceKey('reloadDiskVersion', 'operationChoice'))
    ).toBeNull();
    // Nothing was re-pointed over a window that did not move: the conflict is
    // still the one on screen.
    expect(says(pane.target, 'browser.saveOutcome.nothingWasWritten')).toBe(true);
    pane.stop();
  }); // End of the "refused adoption" case

  it('treats an adoption that was already satisfied as a success', async () => {
    // `alreadyThere` is not a refusal: a window already holding the requested
    // revision is answered so, and the candidate is re-pointed exactly as it is
    // for an install.
    const pane = await conflicted({ adoption: 'alreadyThere' });
    control(pane.target, conflictChoiceKey('reloadDiskVersion', 'operationChoice')).click();
    flushSync();
    control(pane.target, conflictChoiceKey('confirmReloadKeeping', 'operationChoice')).click();
    flushSync();

    expect(pane.adoptions).toHaveLength(1);
    expect(says(pane.target, 'browser.saveOutcome.reloadUnavailableOperation')).toBe(false);
    expect(says(pane.target, 'browser.saveOutcome.nothingWasWritten')).toBe(false);
    expect(pane.target.textContent).toContain(CANDIDATE_MARKER);
    pane.stop();
  }); // End of the "already there" case

  it('refuses to prepare anything while the conflict is on screen', async () => {
    const pane = await conflicted();
    expect(says(pane.target, 'browser.restore.refused.conflictShowing')).toBe(true);
    expect(control(pane.target, 'browser.restore.prepare').disabled).toBe(true);
    pane.stop();
  });
}); // End of the "conflict" suite

/**
 * The seven surface kinds a restore refuses to run beside.
 *
 * Written out with a `satisfies` for the reason every enumerated union in this
 * repository is: a union has no run-time extent, so a new competing kind with
 * no entry here is a compile error in this file rather than a refusal nobody
 * renders.
 */
const COMPETING_SURFACES = Object.keys({
  matchEditor: true,
  matchCreator: true,
  matchDeleter: true,
  matchMover: true,
  matchDuplicator: true,
  rawEditor: true,
  recovery: true
} satisfies Record<CompetingWriteSurfaceKind, true>) as readonly CompetingWriteSurfaceKind[];

/**
 * Vocabulary that would claim more about a backup than a catalogue establishes.
 *
 * Consult Q6's list, narrowed to the exact words a rendered sentence would have
 * to contain. What makes it evidence rather than decoration is the control below.
 */
const FORBIDDEN_ON_SCREEN: Readonly<Record<Locale, readonly string[]>> = {
  en: [
    'undo',
    'revert',
    'authentic',
    'untampered',
    'verified',
    'recoverable',
    'previous version',
    'original version',
    'newest backup',
    'taken at',
    'safe backup',
    'kept forever'
  ],
  es: [
    'deshacer',
    'revertir',
    'auténtic',
    'sin alterar',
    'verificad',
    'recuperable',
    'versión anterior',
    'versión original',
    'copia más reciente',
    'tomada el',
    'copia segura',
    'para siempre'
  ]
};

/**
 * Every state this pane can be in, as a walk into it.
 *
 * **The outcome states are mutually exclusive, so no single walk reaches them
 * all** — which is the 2c-5-4b review's finding 3. This scan used to be one walk
 * whose comment claimed it "reaches every panel this pane can draw at once"; it
 * reached the catalogue, the candidate, the loaded observation, the question and a
 * conflict, and it never rendered a committed outcome, a `committed: false`, a
 * refusal, either send-failure arm, or any of the six open-surface refusals. A
 * forbidden claim introduced into a shared `saveOutcome` or `code.*` sentence drawn
 * only after a commit would have been invisible to it, and invisible to
 * `restoreCodes.test.ts` too, because those keys are outside `browser.restore.*`.
 *
 * Each entry is one **rendered** state, and the families are disjoint by
 * construction: a pane showing a commit is not showing a refusal.
 *
 * **Every entry carries a `proof`, and the scan asserts it first.** A walk that
 * silently failed to reach its state would make the scan below pass over a screen
 * nobody looked at — which is the same shape as the finding this table exists to
 * close, one level down.
 *
 * @returns One entry per state, with the walk that reaches it and the evidence that
 *   it did.
 */
function panels(): readonly {
  readonly name: string;
  readonly reach: () => Promise<Mounted>;
  readonly proof: (pane: Mounted) => void;
}[] {
  /**
   * Walks to the question and answers it, so the transaction's own arm is drawn.
   *
   * @param answer - What the replacement answers.
   * @param opened - What the pane is opened over.
   * @returns The mounted pane, showing that outcome.
   */
  const answered = async (answer: ScriptedSave, opened: Opened = {}): Promise<Mounted> => {
    const pane = await mountRestore([answer], opened);
    await walkToQuestion(pane);
    control(pane.target, 'browser.restore.confirm').click();
    await settle();
    return pane;
  }; // End of function answered()
  /**
   * The evidence that one walk reached a state that draws one sentence.
   *
   * @param key - The key whose sentence only that state draws.
   * @returns The proof callback.
   */
  const saying =
    (key: TranslationKey) =>
    (pane: Mounted): void => {
      expect(says(pane.target, key), key).toBe(true);
    }; // End of function saying()
  return [
    {
      name: 'the catalogue, the candidate and the question',
      reach: async (): Promise<Mounted> => {
        const pane = await mountRestore();
        await walkToQuestion(pane);
        return pane;
      },
      proof: saying('browser.restore.question')
    },
    {
      name: 'a committed replacement',
      reach: () => answered({ result: COMMITTED }),
      proof: saying('browser.saveOutcome.fileWritten')
    },
    {
      name: 'a committed replacement this window could not re-read',
      reach: () => answered({ result: COMMITTED, reloadFailure: UNREADABLE }),
      proof: saying('browser.saveOutcome.windowOutOfStep')
    },
    {
      name: 'a candidate byte-identical to the file',
      reach: () => answered({ result: NOTHING_TO_WRITE }),
      proof: saying('browser.saveOutcome.nothingToWrite')
    },
    {
      name: 'a refusal carrying findings',
      reach: () => answered({ result: REFUSED }),
      proof: saying('browser.restore.acknowledgedAsksAgain')
    },
    {
      name: 'a send that wrote nothing',
      reach: () => answered({ failure: REJECTED }),
      proof: saying('browser.restore.sendFailed')
    },
    {
      name: 'a send that may have written',
      reach: () => answered({ failure: UNCERTAIN }),
      proof: saying('browser.restore.mayHaveWritten')
    },
    {
      name: 'a conflict',
      reach: () => answered({ result: CONFLICTED }),
      proof: saying('browser.saveOutcome.nothingWasWritten')
    },
    {
      name: 'a conflict at its reload warning',
      reach: async (): Promise<Mounted> => {
        const pane = await answered({ result: CONFLICTED });
        control(pane.target, conflictChoiceKey('reloadDiskVersion', 'operationChoice')).click();
        flushSync();
        return pane;
      },
      // The warning step draws no sentence of its own: what it changes is which
      // conflict choices are offered, so the destructive confirmation being on
      // screen is what says the walk arrived.
      proof: (pane: Mounted): void => {
        expect(
          button(pane.target, conflictChoiceKey('confirmReloadKeeping', 'operationChoice'))
        ).not.toBeNull();
      } // End of function proof()
    },
    {
      name: 'a reload the window refused',
      reach: async (): Promise<Mounted> => {
        const pane = await answered({ result: CONFLICTED }, { adoption: 'refused' });
        control(pane.target, conflictChoiceKey('reloadDiskVersion', 'operationChoice')).click();
        flushSync();
        control(pane.target, conflictChoiceKey('confirmReloadKeeping', 'operationChoice')).click();
        flushSync();
        return pane;
      },
      proof: saying('browser.saveOutcome.reloadUnavailableOperation')
    },
    {
      // Phase 2d-6-8b: the external panel, its origin and its lines.
      name: 'a change the watcher observed',
      reach: async (): Promise<Mounted> => {
        const pane = await mountRestore([], { live: true });
        await walkToCandidate(pane);
        pane.observe(observed(5));
        return pane;
      },
      proof: saying('browser.conflictOrigin.changedWhileOpen')
    },
    {
      // Phase 2d-6-8b: the reload-unavailable line once the candidate is dropped.
      name: 'a refused reload after the candidate was dropped',
      reach: async (): Promise<Mounted> => {
        const pane = await answered({ result: CONFLICTED }, { adoption: 'refused' });
        control(pane.target, conflictChoiceKey('reloadDiskVersion', 'operationChoice')).click();
        flushSync();
        control(pane.target, conflictChoiceKey('confirmReloadKeeping', 'operationChoice')).click();
        flushSync();
        control(pane.target, 'browser.restore.batchNamed', { name: BATCH.name }).click();
        await settle();
        return pane;
      },
      proof: saying('browser.restore.reloadUnavailableNoCandidate')
    },
    ...COMPETING_SURFACES.map((kind) => ({
      name: `a ${kind} open over the destination`,
      reach: async (): Promise<Mounted> => {
        const pane = await mountRestore([], {
          surfaces: [{ kind, target: { kind: 'document', document: TARGET } }]
        });
        await walkToCandidate(pane);
        return pane;
      },
      proof: saying(openWriteSurfaceKey(kind))
    }))
  ];
} // End of function panels()

/**
 * Every locale paired with every state, so the scan is run over both.
 *
 * Flattened here rather than nested in two `it.each` calls, because a nested one
 * would report the state without the language it failed in.
 */
const SCANNED: readonly (readonly [Locale, string, ReturnType<typeof panels>[number]])[] =
  LOCALES.flatMap((one) => panels().map((panel) => [one, panel.name, panel] as const));

describe('the mounted restore pane claims nothing it cannot establish (consult Q6)', () => {
  it.each(SCANNED)(
    'makes no historical or authenticity claim in %s while showing %s',
    async (one, _name, panel) => {
      locale.setOverride(one);
      const pane = await panel.reach();
      // The walk really arrived, so the scan below is over the state this case
      // names rather than over whatever the pane happened to be left showing.
      panel.proof(pane);

      const shown = (pane.target.textContent ?? '').toLowerCase();
      // The control: the scan can only be evidence if the vocabulary bites on
      // something, so it is run against a sentence built from the same list.
      const control_ = FORBIDDEN_ON_SCREEN[one].join(' ');
      expect(
        FORBIDDEN_ON_SCREEN[one].filter((word) => control_.includes(word)),
        one
      ).toEqual([...FORBIDDEN_ON_SCREEN[one]]);
      expect(
        FORBIDDEN_ON_SCREEN[one].filter((word) => shown.includes(word)),
        one
      ).toEqual([]);
      pane.stop();
    }
  );

  it.each(LOCALES)('calls a batch recognised rather than anything stronger in %s', async (one) => {
    // The positive half, and it is a claim about the catalogue rather than about
    // every state — so it is asserted where the catalogue is drawn instead of being
    // carried along by every walk above.
    locale.setOverride(one);
    const pane = await mountRestore();
    await walkToCandidate(pane);

    const shown = (pane.target.textContent ?? '').toLowerCase();
    expect(shown, one).toContain(one === 'en' ? 'recognised' : 'reconocid');
    pane.stop();
  }); // End of the "recognised rather than stronger" case

  it('names the batch as a label and never converts it into a time', async () => {
    const pane = await mountRestore();
    control(pane.target, 'browser.restore.listBatches').click();
    await settle();

    // The folder's own characters, inside *Backup batch named …*, unparsed.
    expect(pane.target.textContent).toContain(BATCH.name);
    expect(
      button(pane.target, 'browser.restore.batchNamed', { name: BATCH.name })
    ).not.toBeNull();
    // Newest name first, as the core's own shared ordering answered it: the pane
    // draws the listing in the order it arrived and sorts nothing.
    const labels = [...pane.target.querySelectorAll('.options button')].map((one) =>
      one.textContent?.trim()
    );
    expect(labels).toEqual([
      translate('en', 'browser.restore.batchNamed', { name: BATCH.name }),
      translate('en', 'browser.restore.batchNamed', { name: OTHER_BATCH.name })
    ]);
    pane.stop();
  }); // End of the "a label and never a time" case
}); // End of the "claims nothing" suite

/** The revision a watcher observation of the destination read. */
const OBSERVED: ContentRevision = 'd'.repeat(64);

/** The revision a later observation read. */
const OBSERVED_LATER: ContentRevision = '9'.repeat(64);

/** The whole text an observation read, with a word nothing else on screen holds. */
const OBSERVED_TEXT = 'matches:\n  - trigger: ":seen"\n    replace: "observedbytes"\n';

/** The word that tells the observed disk text apart on screen. */
const OBSERVED_MARKER = 'observedbytes';

/** A disk text holding a lone carriage return, which `SourceText` names. */
const OBSERVED_CR_TEXT = 'matches:\r\n  - trigger: ":seen"\r    replace: "crbytes"\n';

/**
 * One narrowed observation of the destination.
 *
 * A fresh object every call: the memo in `../browser/conflictSource.ts` and a
 * session's wait are both keyed on identity.
 *
 * @param sequence - The sequence it was admitted under.
 * @param revision - The revision it read.
 * @param diskText - The whole text it read.
 * @returns The observation.
 */
function observed(
  sequence: number,
  revision: ContentRevision = OBSERVED,
  diskText: string = OBSERVED_TEXT
): ExternalConflictObservation {
  return {
    sequence,
    document: TARGET,
    previousRevision: BASE,
    diskRevision: revision,
    diskText,
    disk: projectionAt(revision),
    findings: [],
    correspondences: null
  };
} // End of function observed()

/**
 * The text of the external conflict's own panel, or `null` when none is drawn.
 *
 * @param target - Where the pane was mounted.
 * @returns The panel's text.
 */
function externalText(target: HTMLElement): string | null {
  return target.querySelector('.panel.external')?.textContent ?? null;
} // End of function externalText()

/**
 * The external conflict's own panel, insisted upon.
 *
 * @param target - Where the pane was mounted.
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
 * The text of the pane's sticky action row.
 *
 * @param target - Where the pane was mounted.
 * @returns Its text.
 */
function actionsText(target: HTMLElement): string {
  return target.querySelector('.actions')?.textContent ?? '';
} // End of function actionsText()

/**
 * How many times one string occurs in another.
 *
 * @param haystack - Where to count.
 * @param needle - What to count.
 * @returns The number of non-overlapping occurrences.
 */
function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
} // End of function occurrences()

/**
 * Presses a control the screen has disabled, as a script could — Phase 2d-6-8b's
 * *direct submission refused*.
 *
 * `click()` on a disabled button dispatches nothing in jsdom, so this lifts the
 * attribute for the one press: the pane's own handler runs, and the model door
 * behind it is what refuses.
 *
 * @param control_ - The disabled button.
 */
function forcePress(control_: HTMLButtonElement): void {
  expect(control_.disabled).toBe(true);
  control_.disabled = false;
  control_.click();
} // End of function forcePress()

/** Restore's conflict choices, labelled by its own draft kind. */
const CHOICE = {
  keepEditing: conflictChoiceKey('keepEditing', 'operationChoice'),
  copyDraft: conflictChoiceKey('copyDraft', 'operationChoice'),
  keepMyDraft: conflictChoiceKey('keepMyDraft', 'operationChoice'),
  reloadDiskVersion: conflictChoiceKey('reloadDiskVersion', 'operationChoice'),
  confirmReloadKeeping: conflictChoiceKey('confirmReloadKeeping', 'operationChoice')
} as const;

describe('the restore pane under an external conflict, in English and Spanish — Phase 2d-6-8b', () => {
  // **2d-6-8's acceptance for this pane, read off the screen** (the 2d-6 record's
  // §3 entries 23, 34 and 35). A `live` mount registers the pane's own receiver
  // with the real state, so `observe` is the window's arbitration delivering to
  // it and the reload adopts through the window's own `adoptDiskVersion`; the
  // envelopes a case needs that the window would seal only around a write in
  // flight are handed to the receiver directly. Every sentence is pinned to its
  // dictionary value in the case's locale: that protects which code is drawn
  // where, never the quality of a translation.

  it.each(LOCALES)('holds a prepared question while a reading waits, says why once, and a forced confirmation sends nothing (%s)', async (lang) => {
    locale.setOverride(lang);
    const pane = await mountRestore([{ result: COMMITTED }]);
    await walkToQuestion(pane);
    const retained = translate(lang, 'browser.externalConflict.observationRetained');

    pane.deliver(retainedDelivery(observed(5)));

    // A wait carries the question (2d-6-5 §1.3) and the door refuses it: the
    // destructive control is off, and the sentence that says why is the refusal
    // line — drawn once, not again as a notice beside it.
    expect(says(pane.target, 'browser.restore.question')).toBe(true);
    const confirm = control(pane.target, 'browser.restore.confirm');
    expect(occurrences(pane.target.textContent ?? '', retained)).toBe(1);
    expect(actionsText(pane.target)).toContain(retained);
    expect(externalText(pane.target)).toBeNull();
    forcePress(confirm);
    await settle();
    expect(pane.saves).toEqual([]);
    pane.stop();
  }); // End of the "held reading" case

  it.each(LOCALES)('withdraws the question, keeps the candidate, and draws the origin and comparison (%s)', async (lang) => {
    locale.setOverride(lang);
    const pane = await mountRestore([{ result: COMMITTED }], { live: true });
    await walkToQuestion(pane);

    pane.observe(observed(5));

    expect(pane.state.standingConflictFor(TARGET)?.kind).toBe('externalChange');
    // **Direct submission is refused**: the question is withdrawn (entry 12), the
    // prepare control is off with the reason beside it, and pressing it anyway
    // asks nothing.
    expect(says(pane.target, 'browser.restore.question')).toBe(false);
    expect(button(pane.target, 'browser.restore.confirm')).toBeNull();
    expect(actionsText(pane.target)).toContain(
      translate(lang, 'browser.externalConflict.fileChangedWhileOpen')
    );
    forcePress(control(pane.target, 'browser.restore.prepare'));
    flushSync();
    expect(says(pane.target, 'browser.restore.question')).toBe(false);
    // **The candidate survives**, drawn where it always is.
    expect(candidateBox(pane.target).textContent).toContain(CANDIDATE_MARKER);
    // The origin, the observation's own lines and its one revision — none of a save's.
    const shown = externalText(pane.target) ?? '';
    expect(shown).toContain(translate(lang, 'browser.conflictOrigin.changedWhileOpen'));
    expect(shown).toContain(translate(lang, 'browser.externalConflict.fileChangedWhileOpen'));
    expect(shown).toContain(translate(lang, 'browser.saveOutcome.operationKeptInMemory'));
    expect(shown).toContain(translate(lang, 'browser.saveOutcome.reloadRetargetsCandidate'));
    expect(shown).toContain(
      translate(lang, 'browser.externalConflict.revisionObserved', { revision: OBSERVED })
    );
    const all = pane.target.textContent ?? '';
    expect(all).not.toContain(translate(lang, 'browser.conflictOrigin.refusedSave'));
    expect(all).not.toContain(translate(lang, 'browser.saveOutcome.changedElsewhere'));
    expect(all).not.toContain(translate(lang, 'browser.saveOutcome.nothingWasWritten'));
    expect(all).not.toContain(translate(lang, 'browser.restore.revisionExpected', { revision: BASE }));
    // The comparison: what was asked for, and the whole disk text.
    expect(shown).toContain(translate(lang, 'browser.saveOutcome.retainedOperation'));
    expect(shown).toContain(translate(lang, 'browser.saveOutcome.operation.replaceFileFromBackup'));
    expect(shown).toContain(translate(lang, 'browser.saveOutcome.diskVersion'));
    expect(shown).toContain(OBSERVED_MARKER);
    // Two choices: no copy (the candidate is not typed text) and no reapply.
    const panel = externalPanel(pane.target);
    const labels = [...panel.querySelectorAll('button')].map((one) => one.textContent?.trim());
    expect(labels).toEqual([translate(lang, CHOICE.keepEditing), translate(lang, CHOICE.reloadDiskVersion)]);
    expect(pane.saves).toEqual([]);
    expect(pane.adoptions).toEqual([]);
    pane.stop();
  }); // End of the "origin and comparison" case

  it.each(LOCALES)('retargets the kept candidate through the window and confirms it again against the adopted revision (%s)', async (lang) => {
    locale.setOverride(lang);
    const pane = await mountRestore([{ result: COMMITTED }], { live: true });
    await walkToCandidate(pane);
    const seen = observed(5);
    pane.observe(seen);

    control(externalPanel(pane.target), CHOICE.reloadDiskVersion).click();
    flushSync();
    expect(pane.adoptions).toEqual([]);
    control(externalPanel(pane.target), CHOICE.confirmReloadKeeping).click();
    flushSync();

    // **Retargeted, not reseeded and not closed**: the window adopted this
    // observation, the panel is gone, the pane is open and the same candidate is
    // still drawn — now measured against the adopted revision.
    expect(pane.adoptions).toHaveLength(1);
    expect((pane.adoptions[0] as ConflictModel<string>).source).toBe(externalConflictSource(seen));
    expect(pane.state.views.find((view) => view.id === TARGET)?.revision).toBe(OBSERVED);
    expect(externalText(pane.target)).toBeNull();
    expect(pane.closed()).toBe(0);
    expect(candidateBox(pane.target).textContent).toContain(CANDIDATE_MARKER);
    control(pane.target, 'browser.restore.prepare').click();
    flushSync();
    control(pane.target, 'browser.restore.confirm').click();
    await settle();
    expect(pane.saves).toHaveLength(1);
    expect(pane.saves[0]?.text).toBe(CANDIDATE);
    expect(pane.saves[0]?.baseRevision).toBe(OBSERVED);
    pane.stop();
  }); // End of the "retarget through the window" case

  it.each(
    LOCALES.flatMap((lang) => (['alreadyThere', 'refused'] as const).map((adoption) => [lang, adoption] as const))
  )('keeps the candidate whatever the window answers (%s, %s)', async (lang, adoption) => {
    locale.setOverride(lang);
    const pane = await mountRestore([], { live: true, adoption });
    await walkToCandidate(pane);
    pane.observe(observed(5));
    control(externalPanel(pane.target), CHOICE.reloadDiskVersion).click();
    flushSync();
    control(externalPanel(pane.target), CHOICE.confirmReloadKeeping).click();
    flushSync();

    expect(pane.adoptions).toHaveLength(1);
    expect(candidateBox(pane.target).textContent).toContain(CANDIDATE_MARKER);
    if (adoption === 'refused') {
      // Nothing re-pointed over a window that did not move; the control that has
      // just gone is replaced by the reason, and the candidate is still set up.
      expect(externalText(pane.target)).toContain(
        translate(lang, 'browser.saveOutcome.reloadUnavailableOperation')
      );
      expect(button(externalPanel(pane.target), CHOICE.reloadDiskVersion)).toBeNull();
    } else {
      expect(externalText(pane.target)).toBeNull();
    }
    expect(pane.closed()).toBe(0);
    expect(pane.saves).toEqual([]);
    pane.stop();
  }); // End of the "whatever the window answers" case

  it.each(LOCALES)('keeps the conflict through Leave this as it is, and resets the reload step (%s)', async (lang) => {
    locale.setOverride(lang);
    const pane = await mountRestore([], { live: true });
    await walkToCandidate(pane);
    pane.observe(observed(5));
    control(externalPanel(pane.target), CHOICE.reloadDiskVersion).click();
    flushSync();
    expect(button(externalPanel(pane.target), CHOICE.confirmReloadKeeping)).not.toBeNull();

    control(externalPanel(pane.target), CHOICE.keepEditing).click();
    flushSync();

    // The first step is back; the conflict stands (entry 9), so nothing can be
    // prepared.
    expect(button(externalPanel(pane.target), CHOICE.confirmReloadKeeping)).toBeNull();
    expect(button(externalPanel(pane.target), CHOICE.reloadDiskVersion)).not.toBeNull();
    expect(control(pane.target, 'browser.restore.prepare').disabled).toBe(true);
    expect(pane.adoptions).toEqual([]);
    pane.stop();
  }); // End of the "keep editing" case

  it.each(LOCALES)('withdraws the reload warning when a later reading supersedes the conflict (%s)', async (lang) => {
    locale.setOverride(lang);
    const pane = await mountRestore([], { live: true });
    await walkToCandidate(pane);
    pane.observe(observed(5));
    control(externalPanel(pane.target), CHOICE.reloadDiskVersion).click();
    flushSync();
    expect(button(externalPanel(pane.target), CHOICE.confirmReloadKeeping)).not.toBeNull();

    pane.observe(observed(6, OBSERVED_LATER));

    // Entry 12: the confirmation collected for the first conflict is not
    // spendable against this one, and its second step does not stay on screen.
    expect(button(externalPanel(pane.target), CHOICE.confirmReloadKeeping)).toBeNull();
    expect(button(externalPanel(pane.target), CHOICE.reloadDiskVersion)).not.toBeNull();
    const shown = externalText(pane.target) ?? '';
    expect(shown).toContain(
      translate(lang, 'browser.externalConflict.revisionObserved', { revision: OBSERVED_LATER })
    );
    expect(shown).not.toContain(
      translate(lang, 'browser.externalConflict.revisionObserved', { revision: OBSERVED })
    );
    expect(candidateBox(pane.target).textContent).toContain(CANDIDATE_MARKER);
    expect(pane.adoptions).toEqual([]);
    pane.stop();
  }); // End of the "supersession" case

  it.each(LOCALES)('withholds the reload while an earlier write’s outcome is unknown, and leaves the sentence to the pane (%s)', async (lang) => {
    locale.setOverride(lang);
    const pane = await mountRestore();
    await walkToCandidate(pane);
    pane.deliver(arbitratedDelivery(null, observed(5), true));

    // The sentence is the pane's since Phase 2d-6-9b-2, drawn once above this
    // panel; this panel draws the acknowledgement instead (the suite at the end
    // of this file).
    expect(pane.target.textContent).not.toContain(
      translate(lang, 'browser.externalConflict.writeOutcomeUnknown')
    );
    expect(button(externalPanel(pane.target), 'browser.externalConflict.action.acknowledgeSnapshot')).not.toBeNull();
    expect(button(externalPanel(pane.target), CHOICE.keepEditing)).not.toBeNull();
    expect(button(externalPanel(pane.target), CHOICE.reloadDiskVersion)).toBeNull();
    pane.stop();
  }); // End of the "unknown outcome" case

  it.each(LOCALES)('names a disk version’s carriage return and draws no file text into a box (%s)', async (lang) => {
    locale.setOverride(lang);
    const pane = await mountRestore([], { live: true });
    await walkToCandidate(pane);
    pane.observe(observed(5, OBSERVED, OBSERVED_CR_TEXT));

    const shown = externalText(pane.target) ?? '';
    expect(shown).toContain('crbytes');
    expect(shown).toContain(
      translate(lang, 'browser.source.invisible.carriageReturn', { code: codePointLabel('\r') })
    );
    // Nothing on this screen is a text control: the candidate, the loaded text and
    // the disk version are all `SourceText`.
    expect(pane.target.querySelectorAll('textarea, input')).toHaveLength(0);
    pane.stop();
  }); // End of the "carriage return on disk" case

  it.each(LOCALES)('keeps its session across a change of language (%s)', async (lang) => {
    locale.setOverride(lang);
    const pane = await mountRestore([], { live: true });
    await walkToCandidate(pane);
    pane.observe(observed(5));
    control(externalPanel(pane.target), CHOICE.reloadDiskVersion).click();
    flushSync();

    const other: Locale = lang === 'en' ? 'es' : 'en';
    locale.setOverride(other);
    flushSync();

    // The same step of the same conflict, over the same candidate, now in the
    // other language.
    const shown = externalText(pane.target) ?? '';
    expect(shown).toContain(translate(other, 'browser.conflictOrigin.changedWhileOpen'));
    expect(button(externalPanel(pane.target), CHOICE.confirmReloadKeeping)).not.toBeNull();
    expect(candidateBox(pane.target).textContent).toContain(CANDIDATE_MARKER);
    pane.stop();
  }); // End of the "language switch" case

  it.each(LOCALES)('names a replacement as the origin of a save conflict, beside its three revisions (%s)', async (lang) => {
    locale.setOverride(lang);
    const pane = await mountRestore([{ result: CONFLICTED }]);
    await walkToQuestion(pane);
    control(pane.target, 'browser.restore.confirm').click();
    await settle();

    const all = pane.target.textContent ?? '';
    expect(all).toContain(translate(lang, 'browser.conflictOrigin.refusedSave'));
    expect(all).toContain(translate(lang, 'browser.restore.revisionExpected', { revision: BASE }));
    expect(all).not.toContain(translate(lang, 'browser.conflictOrigin.changedWhileOpen'));
    expect(externalText(pane.target)).toBeNull();
    pane.stop();
  }); // End of the "save origin" case
}); // End of the "restore pane under an external conflict" suite

describe('a candidate dropped under a standing conflict, on screen — Phase 2d-6-8b, 2d-6-5 §4 item 12', () => {
  // **The decision is the model's** (`restoreView` in `../browser/restore.ts`):
  // the lines that say a candidate is kept follow the live preview. These cases
  // are the renderer's half — the pane draws what the view answers, in both
  // languages, and the catalogue stays open under the conflict.

  it.each(LOCALES)('drops the kept-candidate lines and the operation when the candidate goes (%s)', async (lang) => {
    locale.setOverride(lang);
    const pane = await mountRestore([], { live: true });
    await walkToCandidate(pane);
    pane.observe(observed(5));
    expect(externalText(pane.target)).toContain(
      translate(lang, 'browser.saveOutcome.operationKeptInMemory')
    );

    // Choosing the batch again drops the candidate, as it always has.
    control(pane.target, 'browser.restore.batchNamed', { name: BATCH.name }).click();
    await settle();

    expect(pane.target.textContent).not.toContain(CANDIDATE_MARKER);
    const shown = externalText(pane.target) ?? '';
    expect(shown).toContain(translate(lang, 'browser.externalConflict.fileChangedWhileOpen'));
    expect(shown).not.toContain(translate(lang, 'browser.saveOutcome.operationKeptInMemory'));
    expect(shown).not.toContain(translate(lang, 'browser.saveOutcome.reloadRetargetsCandidate'));
    expect(shown).not.toContain(translate(lang, 'browser.saveOutcome.retainedOperation'));
    expect(shown).not.toContain(translate(lang, 'browser.saveOutcome.operation.replaceFileFromBackup'));
    pane.stop();
  }); // End of the "external conflict, dropped" case

  it.each(LOCALES)('says no candidate is selected where a refused reload’s control has gone (%s)', async (lang) => {
    locale.setOverride(lang);
    const pane = await mountRestore([{ result: CONFLICTED }], { adoption: 'refused' });
    await walkToQuestion(pane);
    control(pane.target, 'browser.restore.confirm').click();
    await settle();
    control(pane.target, CHOICE.reloadDiskVersion).click();
    flushSync();
    control(pane.target, CHOICE.confirmReloadKeeping).click();
    flushSync();
    expect(says(pane.target, 'browser.saveOutcome.reloadUnavailableOperation')).toBe(true);

    control(pane.target, 'browser.restore.batchNamed', { name: BATCH.name }).click();
    await settle();

    expect(says(pane.target, 'browser.saveOutcome.reloadUnavailableOperation')).toBe(false);
    expect(says(pane.target, 'browser.restore.reloadUnavailableNoCandidate')).toBe(true);
    expect(says(pane.target, 'browser.saveOutcome.operationKeptInMemory')).toBe(false);
    expect(says(pane.target, 'browser.saveOutcome.nothingWasWritten')).toBe(true);
    pane.stop();
  }); // End of the "refused reload, dropped" case
}); // End of the "candidate dropped on screen" suite

describe('the restore pane reveals its external panel — Phase 2d-6-8b', () => {
  /** Every `scrollIntoView` the mounted pane asked for, in order. */
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
    // jsdom leaves the property absent, so it is deleted rather than restored.
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it('reveals the external panel over a refusal kept as history, and its controls at the reload step', async () => {
    const pane = await mountRestore([{ result: REFUSED }], { live: true });
    await walkToQuestion(pane);
    control(pane.target, 'browser.restore.confirm').click();
    await settle();
    expect(says(pane.target, 'browser.restore.acknowledgedAsksAgain')).toBe(true);
    scrolled.length = 0;

    pane.observe(observed(5));

    const panel = pane.target.querySelector('.panel.external');
    expect(panel).not.toBeNull();
    expect(scrolled.map((one) => one.target)).toEqual([panel]);
    scrolled.length = 0;
    control(externalPanel(pane.target), CHOICE.reloadDiskVersion).click();
    flushSync();
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]?.target).toBe(panel?.querySelector('.choices'));
    expect(scrolled[0]?.block).toBe('end');
    pane.stop();
  });
}); // End of the "restore pane reveals its external panel" suite

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

describe('The restore pane acknowledges an unknown write outcome on its own panel, in English and Spanish — Phase 2d-6-9b-2', () => {
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
    const mounted = await mountRestore();
    await walkToCandidate(mounted);
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
    expect(text.indexOf('observedbytes')).toBeGreaterThanOrEqual(0);
    expect(text.indexOf('observedbytes')).toBeLessThan(text.indexOf(translate(lang, ACKNOWLEDGE_SNAPSHOT)));
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
