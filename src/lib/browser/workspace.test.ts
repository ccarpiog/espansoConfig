/**
 * The bootstrap: what the screen is in, and how it got there.
 *
 * Four states, each of which a user really reaches — reading, failed, read and
 * empty, ready — and one wiring claim: a failed `get_match` goes through
 * `identityRecovery`, and a re-resolution that finds a *different* snippet
 * clears the selection rather than moving it.
 *
 * Every command is scripted here rather than mocked at the module level: the
 * state takes its commands as a parameter precisely so that a test can make
 * `get_match` refuse and watch what happens next.
 *
 * **What is mocked is the Tauri boundary beneath the wrappers, for the whole
 * file** — Phase 2d-5-6, ruling 34. `@tauri-apps/api/core` is replaced and
 * `$lib/ipc/commands` is not, so a call that reaches the real wrappers through
 * the module-level bindings `workspace.svelte.ts` holds lands on a spy that
 * rejects, and the `afterEach` below holds that spy to zero in every case.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IpcFailure } from '../ipc/errors';
import { classifyFailure } from '../ipc/errors';
import type {
  CommandResult,
  RawSaveInvalidation,
  RawSaveOutcome,
  ReloadAfterRawSave
} from '../ipc/commands';
import type {
  Acknowledgement,
  BackupBatchId,
  BackupBatchListing,
  BackupEntry,
  BackupEntryListing,
  BackupTextResponse,
  BulkOptionSpellings,
  BulkOptionsRequest,
  BulkResult,
  ContentRevision,
  DocumentId,
  DocumentSummary,
  DocumentView,
  ExternalObservation,
  Finding,
  MatchDraft,
  MatchId,
  MatchView,
  NewMatch,
  NewMatchPosition,
  ObservedDocument,
  OwnedItemText,
  ReapplyResolution,
  ReconciliationBatch,
  SaveResult,
  SidecarChange,
  SidecarState,
  SidecarUpdateRequest,
  SidecarUpdateResult,
  UnreadableReason,
  WorkspaceSummary
} from '../ipc/types';
import {
  diagnostic,
  makeConflict,
  makeDocument,
  makeMatch,
  makeSummary,
  matchListPath
} from './fixtures';
import type {
  ReconciliationEventSource,
  ReconciliationUnlisten,
  ReconciliationWakeHandler
} from '../ipc/events';
import type { CorrespondenceEntry } from '../ipc/types';
import type { ForegroundSource } from './reconciliationCoordinator';
import {
  applyDeletion,
  applyDeletionObservation,
  askToReloadDiskVersion as askDeletionToReloadDiskVersion,
  baseRevisionOf as deletionBaseRevisionOf,
  canRequestDelete,
  confirmDelete,
  confirmDiskReload as confirmDeletionDiskReload,
  identityInProjection,
  matchDeletionView,
  reapplyToDiskVersion,
  reloadTheDiskVersion as reloadDeletionDiskVersion,
  requestDelete,
  startMatchDeletion,
  type MatchDeletionSession
} from './matchDeletion';
import {
  applyMove,
  applyMoveObservation,
  baseRevisionOf,
  beginMove,
  canChoose,
  canMove,
  choosePlacement,
  dismissMoveOutcome,
  matchMoveView,
  moveSubmissionRefusal,
  reapplyToDiskVersion as reapplyMoveToDiskVersion,
  startMatchMove,
  type MatchMoveSession
} from './matchMove';
import {
  applyDuplicationObservation,
  beginDuplicate,
  canDuplicate,
  duplicationSubmissionRefusal,
  matchDuplicationView,
  startMatchDuplication,
  type MatchDuplicationSession
} from './matchDuplication';
import {
  openWholeDocumentSave,
  type InvalidationStatus,
  type WholeDocumentOutcome
} from './invalidation';
import { externalConflictSource, type ExternalConflictObservation } from './conflictSource';
import { decideAutomaticReload, type ObservationDelivery } from './observationDelivery';
import { reapplyEvidenceFor } from './reapply';
import { startDraft, structuredDraftRules, textDraftRules } from './draft';
import {
  confirmReloadDiskVersion,
  describeEditSave,
  describeExternalConflict,
  supersedeConflict
} from './saveOutcome';
import {
  CONFLICT_CAPABILITIES as MATCH_EDITOR_CAPABILITIES,
  acknowledgeSnapshot,
  applyObservation,
  applySave as applyEditorSave,
  askToReloadDiskVersion,
  baselineOf,
  beginSave,
  buffersOf,
  canSave,
  confirmDiskReload,
  editField,
  matchEditorView,
  reapplyToDiskVersion as reapplyEditorToDiskVersion,
  reloadTheDiskVersion,
  startMatchEditor,
  type AcknowledgeTheUncertainty,
  type MatchBuffers,
  type MatchEditorSession
} from './matchEditor';
import {
  acknowledgeRecoverySnapshot,
  applyRecoveryObservation,
  askToReloadRecoveryDiskVersion,
  beginRecoveryCreate,
  chooseRecoveryDestination,
  confirmRecoveryDiskReload,
  editRecoveryField,
  reapplyRecoveryToDiskVersion,
  recoveryAvailability,
  recoveryBaseRevisionOf,
  recoveryRefusal,
  recoveryTargetOf,
  recoveryView,
  reloadRecoveryDiskVersion,
  sendRecoveryCreate,
  sourceConflictState,
  startMatchFieldRecovery,
  type CreateARecoveredSnippet,
  type InstallTheWaitingForm,
  type RecoverySession
} from './recovery';
import {
  applyObservation as applyCreatorObservation,
  askToReloadDiskVersion as askCreatorToReloadDiskVersion,
  baseRevisionOf as creationBaseRevisionOf,
  beginCreate,
  canCreate,
  chooseDestination,
  confirmDiskReload as confirmCreatorDiskReload,
  creationRefusal,
  creationTargetOf,
  editCreationField,
  editCreationOption,
  matchCreationView,
  reapplyToDiskVersion as reapplyCreatorToDiskVersion,
  reloadTheDiskVersion as reloadCreatorDiskVersion,
  startMatchCreation,
  type MatchCreationSession
} from './matchCreation';
import type {
  ConflictModel,
  DiskAdoptionOutcome,
  ReloadConfirmation,
  SaveConflictModel
} from './saveOutcome';
import {
  acknowledgeRestoreFindings,
  applyRestoreObservation,
  askToReloadDiskVersion as askRestoreToReloadDiskVersion,
  batchesLoaded,
  cancelRestore,
  candidateRead,
  candidateText,
  chooseBatch,
  chooseEntry,
  confirmDiskReload as confirmRestoreDiskReload,
  confirmRestore,
  entriesLoaded,
  loadingBatches,
  loadingEntries,
  prepareRestore,
  reloadTheDiskVersion as reloadRestoreDiskVersion,
  restoreRefusal,
  restoreView,
  revisionInProjection,
  sendRestore,
  startRestore,
  targetRevisionObserved,
  type InvalidateEverySurface,
  type OpenWriteSurface,
  type RestoreContext,
  type RestoreSession,
  type StartedRestore
} from './restore';
import {
  applyObservation as applyRawObservation,
  applySave as applyRawSave,
  askToReload as askRawToReload,
  beginSave as beginRawSave,
  canSave as canRawSave,
  confirmReload as confirmRawReload,
  editText as editRawText,
  loadDiskVersion as loadRawDiskVersion,
  rawEditorView,
  startRawEditor,
  type RawEditorSession
} from './rawEditor';
import { NO_PREFERENCES } from './preferences';
import {
  createBrowserState as createUnrecordedBrowserState,
  type BackupCommands,
  type BrowserCommands,
  type BrowserState,
  type MatchSaveAnswer,
  type RawSaveAnswer,
  type RetainedRetryOutcome,
  type UncertaintyAcknowledgement
} from './workspace.svelte';

/**
 * The Tauri boundary, replaced for the whole file — Phase 2d-5-6, ruling 34.
 *
 * `vi.hoisted` because a `vi.mock` factory is lifted above every import and
 * cannot close over an ordinary `const`. It **rejects**: a call that got this far
 * is already the defect, and a stub that answered would let a case pass.
 *
 * **What is mocked is `@tauri-apps/api/core` and not `$lib/ipc/commands`**, and
 * that choice is the whole guard: the real wrapper module and the real
 * `REAL_COMMANDS` assembly stay in place, so a wrapper in `workspace.svelte.ts`
 * that reaches one of the bindings it imports at module level — rather than the
 * surface it was injected with — runs the real wrapper all the way down to this
 * spy. The `afterEach` at the end of the harness asserts it was never reached.
 * That closes the route **in this file**: nothing in Vitest prevents a future
 * test file from importing `$lib/ipc/commands` with no spy at all.
 */
const { invoked } = vi.hoisted(() => ({ invoked: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: readonly unknown[]): Promise<never> => {
    invoked(...args);
    return Promise.reject(new Error('this suite invokes no command'));
  }
}));

/**
 * Opens what the state's raw save answered.
 *
 * The state **seals** its answer as of Phase 2c-1b, so a test that wants the
 * outcome has to discharge the invalidation to get at it — which is the whole
 * point of the seal. The callback is a no-op here on purpose: the invalidation
 * these cases are about is the state's *own*, which the command already ran before
 * this value existed, and every assertion below is about what that invalidation
 * did to the state.
 *
 * @param answer - What `saveRawDocument` answered.
 * @returns How the save ended, or `null` when the command failed.
 */
function outcomeOf(answer: RawSaveAnswer): WholeDocumentOutcome | null {
  if (answer.kind !== 'sealed') {
    return null;
  }
  const opening = openWholeDocumentSave(answer.sealed, () => undefined);
  return opening.kind === 'opened' ? opening.outcome : null;
} // End of function outcomeOf()

/**
 * What the state's own invalidation made of one raw save.
 *
 * Carried on the seal since the 2c-1b review's third finding, so that a committed
 * save this window could not re-project reaches a screen as *out of step* rather
 * than as a clean success with a line in the developer console.
 *
 * @param answer - What `saveRawDocument` answered.
 * @returns The status, or `null` when the command failed.
 */
function issuerInvalidationOf(answer: RawSaveAnswer): InvalidationStatus | null {
  if (answer.kind !== 'sealed') {
    return null;
  }
  const opening = openWholeDocumentSave(answer.sealed, () => undefined);
  return opening.kind === 'opened' ? opening.issuerInvalidation : null;
} // End of function issuerInvalidationOf()

/** A workspace summary of a two-file configuration. */
const SUMMARY: WorkspaceSummary = {
  root: '/tmp/espanso',
  documents: 3,
  match_files: 2,
  config_profiles: 1,
  packages: 0,
  disabled: 0
};

/** The three documents the happy path lists. */
const DOCUMENTS: readonly DocumentSummary[] = [
  makeSummary({ id: 1, relativePath: 'config/default.yml', kind: 'ConfigProfile' }),
  makeSummary({ id: 2, relativePath: 'match/base.yml' }),
  makeSummary({ id: 3, relativePath: 'match/other.yml' })
];

/** The projection of `match/base.yml`. */
function baseDocument(): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    matches: [
      makeMatch({ node: 10, document: 2, trigger: ':sig', label: 'Signature' }),
      makeMatch({ node: 11, document: 2, trigger: ':date', label: 'Today' })
    ]
  });
} // End of function baseDocument()

/** The projection of `match/other.yml`. */
function otherDocument(): DocumentView {
  return makeDocument({
    id: 3,
    relativePath: 'match/other.yml',
    matches: [makeMatch({ node: 20, document: 3, trigger: ':sql', label: 'Query' })]
  });
} // End of function otherDocument()

/**
 * The projection of `config/default.yml`.
 *
 * A profile is projected as of the 1c-2b-1 review: it holds no matches and it
 * does hold diagnostics, and skipping it made a profile with broken YAML silent
 * in every pane of the application.
 */
function profileDocument(): DocumentView {
  return makeDocument({
    id: 1,
    relativePath: 'config/default.yml',
    kind: 'ConfigProfile',
    diagnostics: [diagnostic({ RootIsNotAMapping: { found: 'Sequence' } })]
  });
} // End of function profileDocument()

/**
 * The projection of a `config/*.yml` whose **content** looks like a match file.
 *
 * Not a contrivance: the core projects a profile carrying match-file keys as
 * `DocumentShape::MatchFile` **on purpose**
 * (`crates/espansoconfig-core/src/model/document.rs`), so `matches` really can
 * be non-empty on a document whose `kind` is `ConfigProfile`. Its `kind` is what
 * espanso goes by — a fact about **where the file lives** — and espanso does not
 * load matches out of `config/`.
 *
 * @returns A profile with two matches in it.
 */
function matchShapedProfile(): DocumentView {
  return makeDocument({
    id: 1,
    relativePath: 'config/default.yml',
    kind: 'ConfigProfile',
    matches: [
      makeMatch({ node: 90, document: 1, trigger: ':inprofile', label: 'In a profile' }),
      makeMatch({ node: 91, document: 1, trigger: ':also', label: 'Also in a profile' })
    ]
  });
} // End of function matchShapedProfile()

/** What {@link scriptedCommands} may be told to do differently. */
interface Script {
  /** What `open_workspace` answers. */
  readonly open?: CommandResult<WorkspaceSummary>;
  /** What `list_documents` answers. */
  readonly list?: CommandResult<readonly DocumentSummary[]>;
  /** What `get_document` answers, keyed by identity. */
  readonly documents?: ReadonlyMap<number, CommandResult<DocumentView>>;
  /** What `get_match` answers. */
  readonly match?: CommandResult<MatchView>;
  /** What `reload_document` answers. */
  readonly reload?: CommandResult<DocumentView>;
  /** What `document_text` answers, keyed by identity. */
  readonly texts?: ReadonlyMap<number, CommandResult<string>>;
  /**
   * What `move_match` answers, in order.
   *
   * A list rather than a single answer, because the interesting case is two
   * calls: a refusal that carries its findings, and then the same move with the
   * acknowledgement built from them.
   */
  readonly moves?: readonly CommandResult<SaveResult>[];
  /**
   * What `save_match` answers, in order.
   *
   * A list for the same reason `moves` is: the interesting case is a refusal that
   * carries its findings, and then the same draft with the acknowledgement built
   * from them.
   */
  readonly saves?: readonly CommandResult<SaveResult>[];
  /**
   * What `create_match` answers, in order.
   *
   * A list for the same reason `moves` is: the interesting case is a refusal that
   * carries its findings, and then the same new snippet with the acknowledgement
   * built from them.
   */
  readonly creates?: readonly CommandResult<SaveResult>[];
  /**
   * What `delete_match` answers, in order.
   *
   * A list for the same reason `moves` is.
   */
  readonly deletes?: readonly CommandResult<SaveResult>[];
  /**
   * What `duplicate_match` answers, in order.
   *
   * A list for the same reason `moves` is — and here the two-call case is the
   * **ordinary** path rather than the interesting one: a duplicate's first
   * attempt is refused with the trigger suspicion by design, and the second
   * carries the acknowledgement built from it.
   */
  readonly duplicates?: readonly CommandResult<SaveResult>[];
  /** What `match_item_text` answers, in order (Phase 3-8-1). */
  readonly itemTexts?: readonly CommandResult<OwnedItemText>[];
  /** What `save_match_item_text` answers, in order (Phase 3-8-1). */
  readonly itemSaves?: readonly CommandResult<SaveResult>[];
  /** What `match_option_spellings` answers, in order (Phase 3-11-1). */
  readonly spellings?: readonly CommandResult<BulkOptionSpellings>[];
  /** What `apply_bulk_options` answers, in order (Phase 3-11-1). */
  readonly bulks?: readonly CommandResult<BulkResult>[];
  /**
   * What `load_sidecar` answers, in order (Phase 3-13-1); a fresh, empty,
   * writable sidecar once the list runs out, so a case that says nothing about
   * preferences sees none and no reported failure.
   */
  readonly sidecarLoads?: readonly CommandResult<SidecarState>[];
  /** What `update_sidecar` answers, in order; `noWorkspaceOpen` once it runs out. */
  readonly sidecarUpdates?: readonly CommandResult<SidecarUpdateResult>[];
  /**
   * What `save_raw_document` answers, in order.
   *
   * A list for the same reason `moves` is: the interesting case is a refusal
   * followed by the same text with the acknowledgement built from its findings.
   * The reload half of the answer is **not** scripted here — the stub below runs
   * the wrapper's own rule over these, so a test that scripts a commit really
   * drives the invalidation the state performs.
   */
  readonly raws?: readonly CommandResult<SaveResult>[];
  /**
   * What `drain_external_changes` answers, in order — Phase 2d-5-3.
   *
   * **A finite queue, and running out is a failure rather than a fallback.** A
   * reconciliation case declares exactly which drains it expects — how many, and
   * asked with which cursor — through {@link expectDrains}, and every answer it
   * scripts must be consumed: the `afterEach` below asserts all of it, so a
   * coordinator that drained one time too many or too few, or with the wrong
   * watermark, fails its own case instead of the next one. A case that scripts
   * nothing keeps the refusal every other case in this file has always had.
   */
  readonly drains?: readonly CommandResult<ReconciliationBatch>[];
}

/**
 * How many times any surface built by {@link scriptedCommands} has been drained.
 *
 * Module level rather than per-surface because the assertion is about the file:
 * **no case in it may drain through an injected surface**, whichever surface it
 * built and however many. The bound is the injection and it is not decorative:
 * this file's subject module holds a route around it, stated where the count is
 * incremented. The `afterEach` below reads and resets it.
 */
let drains = 0;

/**
 * The `afterSequence` of every drain the case now running has declared it will
 * make, in order — so the budget is both how many calls and which cursor each one
 * carries (Phase 2d-5-6, ruling 35).
 *
 * **Empty is still the default, and that is the point.** Every case that declares
 * nothing is held to zero drains, exactly as it has been since Phase 2d-5-3; only
 * a case that calls {@link expectDrains} may drain, and it must drain exactly that
 * many times, asked with exactly those cursors. A count alone was the 2d-5-3
 * shape, and it let a case drain the right number of times with the wrong
 * watermark unless the case also read {@link drainSequences} itself.
 */
let drainBudget: readonly number[] = [];

/**
 * The `afterSequence` of every drain made through an injected surface, in order.
 *
 * Compared against {@link drainBudget} by the `afterEach` below, and read directly
 * by the lifecycle cases that want to assert an intermediate state — so that "the
 * watermark the previous answer established" is an assertion rather than an
 * inference. Cleared with the budget.
 */
let drainSequences: number[] = [];

/**
 * How many scripted drain answers have been built and not yet consumed.
 *
 * The "nothing pending" half of ruling 35: a case that scripts three answers and
 * drains twice has a queue with something left in it, which is a different defect
 * from draining three times and is caught separately.
 */
let drainsPending = 0;

/**
 * How many drains were answered by the stub's refusal because the scripted queue
 * had nothing left for them.
 *
 * The other half of "a finite scripted queue" (ruling 35), found by the phase's
 * review: {@link drainsPending} catches a queue with an answer left over, but a
 * case that drains one time *more* than it scripted was answered `noWorkspaceOpen`
 * by the fallback below and stayed green so long as the cursor budget matched.
 * Counted rather than thrown, because a throw inside the drain would be caught by
 * the coordinator's own error handling and would surface as the wrong defect.
 */
let drainsUnscripted = 0;

/**
 * Declares the drains this case will make through the injected surface.
 *
 * @param afterSequences - The exact `afterSequence` of each call, in order; its
 *   length is the exact number of calls. Both are asserted by the `afterEach`
 *   below.
 */
function expectDrains(afterSequences: readonly number[]): void {
  drainBudget = afterSequences;
} // End of function expectDrains()

/**
 * One state the case now running built, with what the `afterEach` below asks of
 * it.
 */
interface BuiltState {
  /** The state. */
  readonly state: BrowserState;
  /**
   * The surface it was built over, or `null` when the case let the production
   * default stand. Its writing stubs are where the files it wrote are read from.
   */
  readonly commands: BrowserCommands | null;
  /**
   * Whether `start()` was called on it, so that its coordinator holds a
   * subscription and a pump.
   *
   * @returns The answer.
   */
  readonly started: () => boolean;
  /**
   * Whether `dispose()` was called on it.
   *
   * @returns The answer.
   */
  readonly disposed: () => boolean;
}

/**
 * Every state the case now running has built.
 *
 * Read and cleared by the `afterEach` below, which asks each one two things: that
 * a coordinator the case started was disposed before the case ended (ruling 35's
 * last sentence), and that no write lease is still open on any file the harness
 * can name.
 */
let statesBuilt: BuiltState[] = [];

/**
 * Builds a state exactly as the module does, and records it for the `afterEach`.
 *
 * **The module's own name, on purpose**: the import is aliased so that the
 * nearly two hundred call sites below read as they always have, and the
 * arguments are forwarded unchanged, production defaults included — a case that
 * omits the backup surface gets `REAL_BACKUP_COMMANDS`, and the hoisted spy at
 * the top of this file is what notices if that surface is then reached.
 *
 * Two spies are installed on the state so that the `afterEach` can ask whether
 * its coordinator was started and whether it was disposed. **Nothing forces a
 * case to dispose what it started**; the `afterEach` is what fails one that does
 * not.
 *
 * @param args - Exactly what `createBrowserState` in `./workspace.svelte.ts`
 *   takes.
 * @returns The state.
 */
function createBrowserState(
  ...args: Parameters<typeof createUnrecordedBrowserState>
): BrowserState {
  const state = createUnrecordedBrowserState(...args);
  const start = vi.spyOn(state, 'start');
  const dispose = vi.spyOn(state, 'dispose');
  statesBuilt.push({
    state,
    commands: args[0] ?? null,
    started: () => start.mock.calls.length > 0,
    disposed: () => dispose.mock.calls.length > 0
  });
  return state;
} // End of function createBrowserState()

/**
 * The eight members of a surface whose call opens ruling 27's barrier.
 *
 * Each of the eight wrappers in `workspace.svelte.ts` opens the barrier on exactly
 * the file identities it then hands its command — `match.document`, `id.document`
 * or `document`, and for a bulk edit every `request.files[].document` — so the
 * first argument of every recorded call names the files a lease was opened for. Nothing in TypeScript keeps an eighth writer, or a
 * wrapper that opened the barrier on some other identity, in step with this
 * list; it is read against the module by hand.
 */
const BARRIERED_MEMBERS = [
  'moveMatch',
  'saveMatch',
  'createMatch',
  'deleteMatch',
  'duplicateMatch',
  'saveRawDocument',
  'saveMatchItemText',
  'applyBulkOptions'
] as const;

/**
 * Every file a surface's writing stubs were asked to write.
 *
 * Read from the `vi.fn` records rather than from the state, because the barrier
 * table is private to the module and `writeInFlight` answers one file at a time.
 * A writing member a case replaced with something other than a `vi.fn` records
 * nothing and contributes nothing here; the state's own document list, added by
 * the caller, is what still names those files.
 *
 * @param commands - The surface.
 * @returns The identities, without repetition.
 */
function filesWrittenThrough(commands: BrowserCommands): ReadonlySet<DocumentId> {
  const written = new Set<DocumentId>();
  for (const member of BARRIERED_MEMBERS) {
    const stub: unknown = commands[member];
    if (!vi.isMockFunction(stub)) {
      continue;
    }
    for (const call of stub.mock.calls) {
      const first: unknown = call[0];
      if (typeof first === 'number') {
        written.add(first);
      } else if (typeof first === 'object' && first !== null && 'files' in first) {
        // A bulk request: one lease per applied file.
        for (const file of (first as BulkOptionsRequest).files) {
          written.add(file.document);
        }
      } else if (
        typeof first === 'object' &&
        first !== null &&
        'document' in first &&
        typeof first.document === 'number'
      ) {
        written.add(first.document);
      }
    } // End of the loop over one stub's recorded calls
  } // End of the loop over the eight barriered members
  return written;
} // End of function filesWrittenThrough()

/**
 * Every write lease a case left open, by the identities this harness can name.
 *
 * Asks each state about every file it lists and every file its surface's writing
 * stubs were asked to write. A lease opened through the injected surface is
 * always about one of those, for {@link BARRIERED_MEMBERS}' reason; a lease
 * opened through a module-level binding is the hoisted spy's to catch, since the
 * wrapper closes it in a `finally` either way. **What this cannot see is a lease
 * on a file neither source names**, which no wrapper opens today and nothing in
 * TypeScript prevents tomorrow.
 *
 * @param built - The states the case built.
 * @returns One entry per open lease: which state, by build order, and which file.
 */
function openLeasesOf(
  built: readonly BuiltState[]
): readonly { readonly state: number; readonly document: DocumentId }[] {
  const open: { readonly state: number; readonly document: DocumentId }[] = [];
  for (const [index, one] of built.entries()) {
    const files = new Set<DocumentId>(one.state.documents.map((summary) => summary.id));
    if (one.commands !== null) {
      for (const document of filesWrittenThrough(one.commands)) {
        files.add(document);
      }
    }
    for (const document of files) {
      if (one.state.writeInFlight(document)) {
        open.push({ state: index, document });
      }
    }
  } // End of the loop over the states the case built
  return open;
} // End of function openLeasesOf()

/**
 * A command surface that answers from a script.
 *
 * @param script - What each command should answer.
 * @returns The commands, with `vi.fn` wrappers so calls can be counted.
 */
function scriptedCommands(script: Script = {}): BrowserCommands {
  // How many moves and how many raw saves have been answered. Those are the two
  // commands a test drives more than once with different answers, so their
  // scripts are consumed in order.
  let moves = 0;
  let saves = 0;
  let creates = 0;
  let deletes = 0;
  let duplicates = 0;
  let itemTexts = 0;
  let itemSaves = 0;
  let spellingReads = 0;
  let bulks = 0;
  let sidecarLoads = 0;
  let sidecarUpdates = 0;
  let raws = 0;
  let drained = 0;
  drainsPending += script.drains?.length ?? 0;
  const documents =
    script.documents ??
    new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
  // Each answer is annotated rather than inferred: a bare `{ ok: true, … }`
  // literal widens `ok` to `boolean`, which does not satisfy the discriminated
  // union `CommandResult` is.
  const opened: CommandResult<WorkspaceSummary> = script.open ?? { ok: true, value: SUMMARY };
  const listed: CommandResult<readonly DocumentSummary[]> = script.list ?? {
    ok: true,
    value: DOCUMENTS
  };
  const matched: CommandResult<MatchView> = script.match ?? { ok: true, value: makeMatch() };
  const reloaded: CommandResult<DocumentView> = script.reload ?? {
    ok: true,
    value: baseDocument()
  };
  return {
    openWorkspace: vi.fn(async () => opened),
    listDocuments: vi.fn(async () => listed),
    getDocument: vi.fn(async (id: number) => {
      const answer: CommandResult<DocumentView> = documents.get(id) ?? {
        ok: false,
        failure: { kind: 'command', error: { code: 'unknownDocument', document: id } }
      };
      return answer;
    }),
    getMatch: vi.fn(async () => matched),
    reloadDocument: vi.fn(async () => reloaded),
    documentText: vi.fn(async (id: number) => {
      const answer: CommandResult<string> = script.texts?.get(id) ?? {
        ok: true,
        value: `# text of document ${id}\n`
      };
      return answer;
    }),
    moveMatch: vi.fn(async () => {
      const answer: CommandResult<SaveResult> = script.moves?.[moves++] ?? {
        ok: false,
        failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
      };
      return answer;
    }),
    saveMatch: vi.fn(async () => {
      const answer: CommandResult<SaveResult> = script.saves?.[saves++] ?? {
        ok: false,
        failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
      };
      return answer;
    }),
    createMatch: vi.fn(async () => {
      const answer: CommandResult<SaveResult> = script.creates?.[creates++] ?? {
        ok: false,
        failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
      };
      return answer;
    }),
    deleteMatch: vi.fn(async () => {
      const answer: CommandResult<SaveResult> = script.deletes?.[deletes++] ?? {
        ok: false,
        failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
      };
      return answer;
    }),
    duplicateMatch: vi.fn(async () => {
      const answer: CommandResult<SaveResult> = script.duplicates?.[duplicates++] ?? {
        ok: false,
        failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
      };
      return answer;
    }),
    matchItemText: vi.fn(async () => {
      const answer: CommandResult<OwnedItemText> = script.itemTexts?.[itemTexts++] ?? {
        ok: false,
        failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
      };
      return answer;
    }),
    saveMatchItemText: vi.fn(async () => {
      const answer: CommandResult<SaveResult> = script.itemSaves?.[itemSaves++] ?? {
        ok: false,
        failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
      };
      return answer;
    }),
    matchOptionSpellings: vi.fn(async () => {
      const answer: CommandResult<BulkOptionSpellings> = script.spellings?.[spellingReads++] ?? {
        ok: false,
        failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
      };
      return answer;
    }),
    applyBulkOptions: vi.fn(async (_request: BulkOptionsRequest) => {
      const answer: CommandResult<BulkResult> = script.bulks?.[bulks++] ?? {
        ok: false,
        failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
      };
      return answer;
    }),
    loadSidecar: vi.fn(async () => {
      const answer: CommandResult<SidecarState> = script.sidecarLoads?.[sidecarLoads++] ?? {
        ok: true,
        value: { status: { Fresh: {} }, writable: true, files: [], retained_orphans: 0 }
      };
      return answer;
    }),
    updateSidecar: vi.fn(async (_request: SidecarUpdateRequest) => {
      const answer: CommandResult<SidecarUpdateResult> = script.sidecarUpdates?.[
        sidecarUpdates++
      ] ?? {
        ok: false,
        failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
      };
      return answer;
    }),
    saveRawDocument: vi.fn(
      async (
        document: DocumentId,
        _baseRevision: ContentRevision,
        _text: string,
        _acknowledgement: Acknowledgement,
        reload: ReloadAfterRawSave
      ): Promise<RawSaveOutcome> => {
        // The wrapper's own rule, repeated here rather than approximated: the
        // reload runs on a commit and on nothing else, it is awaited, and a
        // reload that throws leaves the committed result intact. A stub that
        // simply returned the scripted answer would let a state test claim an
        // invalidation the real boundary never triggers.
        const answer: CommandResult<SaveResult> = script.raws?.[raws++] ?? {
          ok: false,
          failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
        };
        if (!answer.ok) {
          return answer;
        }
        if (!(answer.value.outcome === 'saved' && answer.value.committed)) {
          return { ok: true, value: answer.value, reload: { kind: 'notOwed' } };
        }
        try {
          await reload({ document, revision: answer.value.revision });
        } catch (raw: unknown) {
          return {
            ok: true,
            value: answer.value,
            reload: { kind: 'failed', failure: classifyFailure(raw) }
          };
        }
        return { ok: true, value: answer.value, reload: { kind: 'done' } };
      }
    ), // End of the scripted save_raw_document
    // Nothing in `BrowserState` drains *through this surface*: Phase 2d-4b puts
    // the member on the boundary and Phase 2d-5 is what calls it. The refusal is
    // the answer no caller could proceed on, and {@link drains} is what makes
    // such a call *visible* — a `vi.fn` records a call and asserts nothing about
    // it, so a fire-and-forget drain that ignored this answer would pass every
    // case in this file. The `afterEach` below is the assertion.
    //
    // **The bound is the injection, and it is stated because this file's subject
    // module holds a route around it.** `workspace.svelte.ts` imports its command
    // wrappers at module level, so a call made through one of those bindings rather
    // than through an injected parameter increments nothing here. The count is
    // evidence about the injected boundary and never about the module; **the route
    // is the hoisted `@tauri-apps/api/core` spy's** (Phase 2d-5-6, ruling 34), which
    // the same `afterEach` holds to zero — a call that took it would run the real
    // wrapper down to a spy that rejects, and be reported by name.
    //
    // The measurements behind that paragraph — how many wrappers the module binds
    // and to which surfaces, which phase probed which route and what each cost,
    // why a drain is swallowed rather than recorded in this file, and what the two
    // component suites did and did not trap before 2d-5-6 — are
    // `docs/decisions/2d-4b-notes.md` §11.8, which exists to be what this pointer
    // finds. **They are not repeated here on purpose.** They are counts and line
    // ranges in files other than this one, nothing in this repository checks a
    // comment, and six review rounds went to keeping such sentences true in a
    // place where only reading catches them going stale.
    //
    // **Phase 2d-5-3 answers from a script when one is given.** The refusal below
    // is still what an unscripted case gets, so the paragraphs above remain true
    // of every case that predates this one; what changed is that a case may now
    // declare a budget and a finite queue of batches, and both are asserted.
    drainExternalChanges: vi.fn(async (afterSequence: number) => {
      drains += 1;
      drainSequences.push(afterSequence);
      const scripted = script.drains?.[drained];
      if (scripted !== undefined) {
        drained += 1;
        drainsPending -= 1;
        return scripted;
      }
      // Past the end of the queue, or no queue at all. The `afterEach` holds this
      // to zero: a case that means to see this refusal scripts it.
      drainsUnscripted += 1;
      const answer: CommandResult<ReconciliationBatch> = {
        ok: false,
        failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
      };
      return answer;
    })
  };
} // End of function scriptedCommands()

/**
 * A promise whose settlement the test controls.
 *
 * The only way to make two requests overlap without a timer: the first command
 * is handed this promise and does not settle until the test says so, which is
 * exactly the window a second click lands in.
 *
 * @returns The promise and the function that resolves it.
 */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let settle: ((value: T) => void) | null = null;
  const promise = new Promise<T>((resolveWith) => {
    settle = resolveWith;
  });
  return {
    promise,
    resolve: (value: T) => settle?.(value)
  };
} // End of function deferred()

beforeEach(() => {
  invoked.mockClear();
});

afterEach(() => {
  // Everything is read, then cleared, then asserted, so one defect fails one case
  // rather than every case after it — and the assertions run in the order a
  // reader would want them attributed: the route first, because a wrapper that
  // escaped through it also did nothing through the surface, and a count below
  // would then fail for a reason that is not the count's.
  const drained = drains;
  const budget = drainBudget;
  const asked = drainSequences;
  const pending = drainsPending;
  const unscripted = drainsUnscripted;
  const built = statesBuilt;
  drains = 0;
  drainBudget = [];
  drainsPending = 0;
  drainsUnscripted = 0;
  drainSequences = [];
  statesBuilt = [];

  // **The route (ruling 34).** The assertion `scriptedCommands()`'s refusal cannot
  // make on its own, applied to every case in this file: the bound, and the route
  // around it, are stated where {@link drains} is incremented, and this is where
  // the route is caught — a wrapper that reached the real `invoke` is reported
  // here by command name. Zero in every case, an intended drain included, because
  // even an intended drain must use the injected boundary.
  expect(invoked).not.toHaveBeenCalled();

  // **Every coordinator started was disposed (ruling 35, last sentence).** A
  // started coordinator holds a subscription and a pump, and one left running
  // would drain into the next case's counters. A state never started registered
  // nothing and is not owed a disposal, which is why the question is asked of the
  // started ones. Nothing in TypeScript makes a case call `dispose()`; this does.
  const undisposed = built.filter((one) => one.started() && !one.disposed()).length;
  expect(undisposed).toBe(0);

  // **No write lease is left open (ruling 27's barrier).** A lease still open when
  // the case ends is a write the case never let settle — a deferred answer never
  // resolved — and in production that file's reconciliation would be silently
  // dead from then on. Bounded as {@link openLeasesOf} states.
  expect(openLeasesOf(built)).toEqual([]);

  // **The budget was consumed exactly, with nothing pending (ruling 35).** Four
  // questions, asked separately because they are different defects: which cursors
  // the drains asked with, in order; how many drains happened; whether every
  // scripted answer was consumed; and whether every drain *had* a scripted answer
  // — a case that drains the right number of times with the wrong watermark, one
  // that drains too few times, one that scripts more answers than it drains, and
  // one that drains past the end of its queue and was answered by the fallback
  // refusal each fail their own line. The last is the review's finding: without
  // it the queue was finite in one direction only. An unscripted case has the
  // empty budget and is held to zero exactly as it always was.
  expect(asked).toEqual(budget);
  expect(drained).toBe(budget.length);
  expect(pending).toBe(0);
  expect(unscripted).toBe(0);
}); // End of the afterEach that closes the route, the coordinators, the barrier and the budget

describe('the load', () => {
  it('starts in the reading state before anything is asked', () => {
    const state = createBrowserState(scriptedCommands(), () => undefined);
    expect(state.status).toBe('loading');
    expect(state.documents).toEqual([]);
  });

  it('ends ready, with every file projected — profiles included', async () => {
    const commands = scriptedCommands();
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    expect(state.status).toBe('ready');
    expect(state.summary?.root).toBe('/tmp/espanso');
    expect(state.documents).toHaveLength(3);
    // All three, the profile among them. It was skipped until the 1c-2b-1
    // review on the grounds that it holds no matches — true, and the wrong
    // test: it holds diagnostics, and nothing else in the application would
    // ever ask for them.
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
    expect(state.sidebar.total).toBe(3);
    expect(state.sidebar.pending).toBe(0);
    expect(state.scopedMatches).toHaveLength(3);
  });

  it('projects a profile without letting it into a count or the snippet list', async () => {
    const state = createBrowserState(scriptedCommands(), () => undefined);
    await state.open(null);

    // Read, and still showing "not read yet" rather than a count of 0: a `0`
    // would say the file was read and holds no snippets, which invites the
    // reader to expect that it could hold some.
    expect(state.sidebar.profiles[0]?.matches).toBeNull();
    expect(state.sidebar.total).toBe(3);
    expect(state.sidebar.pending).toBe(0);
    // …and it contributes nothing to the "All" list either.
    expect(state.scopedMatches).toHaveLength(3);
    state.show({ kind: 'document', id: 1 });
    expect(state.scopedMatches).toEqual([]);
  });

  it('keeps a match-shaped profile’s matches out of the list the total counts', async () => {
    /*
     * The second review pass's finding, and it is the profile fix regressing
     * itself: before profiles were projected there was no such view to leak.
     * `holdsMatches` guards the sidebar's counts, so a list built without the
     * same guard shows rows the total does not count — and the disagreement is
     * the assertion, not either number alone.
     */
    const state = createBrowserState(
      scriptedCommands({
        documents: new Map<number, CommandResult<DocumentView>>([
          [1, { ok: true, value: matchShapedProfile() }],
          [2, { ok: true, value: baseDocument() }],
          [3, { ok: true, value: otherDocument() }]
        ])
      }),
      () => undefined
    );
    await state.open(null);

    // The "All" scope: three real snippets, and the total says three.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11, 20]);
    expect(state.sidebar.total).toBe(state.scopedMatches.length);

    // The profile's own scope: still nothing, although `view.matches` has two.
    state.show({ kind: 'document', id: 1 });
    expect(state.scopedMatches).toEqual([]);
    expect(state.sidebar.profiles[0]?.matches).toBeNull();
    // …and its diagnostics stay reachable, which is why it is projected at all.
    expect(state.scopedDocument?.id).toBe(1);
  });

  it('makes a profile’s diagnostics reachable, which they were not before', async () => {
    const state = createBrowserState(scriptedCommands(), () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 1 });

    // The review's Medium 2, in one assertion: `scopedDocument` used to be
    // `null` here, so a profile with broken YAML said nothing anywhere.
    expect(state.scopedDocument?.id).toBe(1);
    expect(state.scopedDocument?.diagnostics).toHaveLength(1);
  });

  it('reports a failed open and shows it, rather than an empty window', async () => {
    const failure: IpcFailure = {
      kind: 'command',
      error: { code: 'configDirNotFound', candidates: ['/tmp/one', '/tmp/two'] }
    };
    const reported: IpcFailure[] = [];
    const state = createBrowserState(scriptedCommands({ open: { ok: false, failure } }), (f) =>
      reported.push(f)
    );
    await state.open(null);

    expect(state.status).toBe('failed');
    expect(state.failure).toEqual(failure);
    expect(reported).toEqual([failure]);
  });

  it('fails when the file list fails, without pretending the workspace is empty', async () => {
    const failure: IpcFailure = { kind: 'command', error: { code: 'noWorkspaceOpen' } };
    const state = createBrowserState(
      scriptedCommands({ list: { ok: false, failure } }),
      () => undefined
    );
    await state.open(null);
    expect(state.status).toBe('failed');
    expect(state.documents).toEqual([]);
  });

  it('keeps going when one file cannot be read', async () => {
    const failure: IpcFailure = {
      kind: 'command',
      error: { code: 'io', path: '/tmp/espanso/match/other.yml', kind: 'PermissionDenied' }
    };
    const reported: IpcFailure[] = [];
    const state = createBrowserState(
      scriptedCommands({
        documents: new Map<number, CommandResult<DocumentView>>([
          [1, { ok: true, value: profileDocument() }],
          [2, { ok: true, value: baseDocument() }],
          [3, { ok: false, failure }]
        ])
      }),
      (f) => reported.push(f)
    );
    await state.open(null);

    // One unreadable file must not blank a window that can show the rest.
    expect(state.status).toBe('ready');
    expect(state.scopedMatches).toHaveLength(2);
    // Not *pending*: a refused read is not a count on its way. It is on the
    // row, as `unreadable`.
    expect(state.sidebar.pending).toBe(0);
    expect(reported).toEqual([failure]);
    // …and it must not do it silently. The console is for the developer; the
    // user is looking at a total that omits a whole file, and `loadFailures` is
    // what the sidebar renders to say so.
    expect(state.loadFailures).toEqual([{ document: 3, failure }]);
  });

  it('exposes one projection per file that read, and none for one that did not', async () => {
    // **The accessor 2c-3a-2 added, and the shape a caller has to know about.**
    // `startMatchCreation` takes the summaries *and* the projections precisely
    // because they are two different lists: a file whose read refused is on the
    // first and not on the second, and a destination list built from this alone
    // would silently omit a file the sidebar is still naming — which is what the
    // design consult's Q5 rejects.
    const failure: IpcFailure = {
      kind: 'command',
      error: { code: 'io', path: '/tmp/espanso/match/other.yml', kind: 'PermissionDenied' }
    };
    const state = createBrowserState(
      scriptedCommands({
        documents: new Map<number, CommandResult<DocumentView>>([
          [1, { ok: true, value: profileDocument() }],
          [2, { ok: true, value: baseDocument() }],
          [3, { ok: false, failure }]
        ])
      }),
      () => undefined
    );
    await state.open(null);

    expect(state.documents.map((one) => one.id)).toEqual([1, 2, 3]);
    expect(state.views.map((one) => one.id)).toEqual([1, 2]);
    expect(state.views.find((one) => one.id === 2)?.revision).toBe('rev-a');
  });

  it('publishes nothing when the last file’s own getter opens another workspace', async () => {
    // **The check the per-iteration one cannot make.** `open()` compares its
    // generation at the top of every iteration, so the caller code that iteration
    // *i* runs — the ingress copy's twenty-four field reads, each match's, and the
    // injected `report` on the other arm — is caught by iteration *i+1*. The final
    // iteration has no *i+1*: before this round, nothing at all stood between its
    // reads and `views = projected; status = 'ready'`.
    const second = deferred<CommandResult<WorkspaceSummary>>();
    let opens = 0;
    let sprung = false;
    let state: BrowserState | null = null;
    // A `value` getter on the answer for the **last** identity `list_documents`
    // returns, which a `CommandResult` may perfectly well have: the command
    // surface is injected, so the answer is caller-controlled data and `readonly`
    // freezes nothing at runtime.
    const trap: CommandResult<DocumentView> = {
      ok: true as const,
      get value(): DocumentView {
        if (!sprung) {
          sprung = true;
          void state?.open('/second');
        }
        return otherDocument();
      }
    };
    const base = scriptedCommands({
      documents: new Map<number, CommandResult<DocumentView>>([
        [1, { ok: true, value: profileDocument() }],
        [2, { ok: true, value: baseDocument() }],
        [3, trap]
      ])
    });
    // The second open is **held**, so the window it left behind is readable. Let
    // it finish and it would overwrite everything, which is exactly why a case
    // that only inspects the settled state cannot see this defect at all.
    const commands: BrowserCommands = {
      ...base,
      openWorkspace: vi.fn(async (): Promise<CommandResult<WorkspaceSummary>> => {
        opens += 1;
        return opens === 1 ? { ok: true as const, value: SUMMARY } : second.promise;
      })
    };
    state = createBrowserState(commands, () => undefined);
    await state.open(null);

    // The getter fired, so the trap is live rather than decorative, and the
    // superseded load published nothing: the window is the second open's, still
    // loading, and not the first open's three projections presented as the new
    // workspace's.
    expect(sprung).toBe(true);
    expect(opens).toBe(2);
    expect(state.status).toBe('loading');
    expect(state.views).toEqual([]);
    expect(state.documents).toEqual([]);

    // And the second open finishes normally, so nothing here leaves a load stuck.
    second.resolve({ ok: true, value: SUMMARY });
    await settleDrains();
    await settleDrains();
    expect(state.status).toBe('ready');
    expect(state.views.map((one) => one.id)).toEqual([1, 2, 3]);
  }); // End of the superseded-open publication case

  it('publishes no row when a summary’s own getter opens another workspace', async () => {
    // **The same check one loop earlier** — Phase 2d-5-4-C's finding 3. `open()`
    // compares its generation once after `list_documents` answers, and everything
    // between that comparison and `documents = rows` is caller code: `listed.ok`,
    // `listed.value`, the iteration protocol and seven field reads per row inside
    // the ingress copy. The projection loop below it got its own check at Phase
    // 2d-5-4-B; the row loop did not.
    let opens = 0;
    let sprung = false;
    let state: BrowserState | null = null;
    // A getter on the **last** row `list_documents` answers, which an injected
    // command surface may perfectly well hand back.
    const trap: DocumentSummary = {
      ...makeSummary({ id: 3, relativePath: 'match/other.yml' }),
      get disabled(): boolean {
        if (!sprung) {
          sprung = true;
          void state?.open('/second');
        }
        return false;
      }
    };
    const base = scriptedCommands({
      list: {
        ok: true,
        value: [
          makeSummary({ id: 1, relativePath: 'config/default.yml', kind: 'ConfigProfile' }),
          makeSummary({ id: 2, relativePath: 'match/base.yml' }),
          trap
        ]
      }
    });
    // The second open is **refused**, so the window it leaves behind is the one a
    // person would be looking at: a failure over whatever the sidebar holds.
    const commands: BrowserCommands = {
      ...base,
      openWorkspace: vi.fn(async (): Promise<CommandResult<WorkspaceSummary>> => {
        opens += 1;
        if (opens === 1) {
          return { ok: true as const, value: SUMMARY };
        }
        return {
          ok: false as const,
          failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
        };
      })
    };
    state = createBrowserState(commands, () => undefined);
    await state.open(null);
    await settleDrains();

    // The getter fired, so the trap is live rather than decorative.
    expect(sprung).toBe(true);
    expect(opens).toBe(2);
    expect(state.status).toBe('failed');
    // **The two discriminating assertions.** Pre-fix the superseded load published
    // the first workspace's three rows over the second open's cleared list — rows
    // whose identities feed `rawTarget`, `creatorEligibility`, `holdsDocument` and
    // the coordinator's membership test, with no pending marks to constrain them —
    // and then sent one `get_document` for the first of them.
    expect(state.documents).toEqual([]);
    expect(commands.getDocument).not.toHaveBeenCalled();
  }); // End of the summary-getter publication case

  it('says which file could not be read, so its own row can say so too', async () => {
    const failure: IpcFailure = {
      kind: 'command',
      error: { code: 'io', path: '/tmp/espanso/match/other.yml', kind: 'PermissionDenied' }
    };
    const state = createBrowserState(
      scriptedCommands({
        documents: new Map<number, CommandResult<DocumentView>>([
          [1, { ok: true, value: profileDocument() }],
          [2, { ok: true, value: baseDocument() }],
          [3, { ok: false, failure }]
        ])
      }),
      () => undefined
    );
    await state.open(null);

    // The identity is carried rather than recovered from the failure's `path`:
    // a `WirePath` renders un-encodable bytes as U+FFFD, so two different files
    // can produce one display path, and several codes carry no path at all.
    expect(state.loadFailures.map((entry) => entry.document)).toEqual([3]);
    const refused = state.sidebar.files.find((row) => row.document.id === 3);
    const untouched = state.sidebar.files.find((row) => row.document.id === 2);
    expect(refused?.unreadable).toBe(true);
    expect(refused?.matches).toBeNull();
    expect(untouched?.unreadable).toBe(false);
    // A profile nobody projected is the other side of the conflation: no count
    // either, and it is *not* a file this app failed to read.
    expect(state.sidebar.profiles[0]?.unreadable).toBe(false);
    expect(state.sidebar.pending).toBe(0);
  });

  it('starts each open with no failures held over from the last one', async () => {
    const failure: IpcFailure = {
      kind: 'command',
      error: { code: 'io', path: '/tmp/espanso/match/other.yml', kind: 'PermissionDenied' }
    };
    // One state, two opens, and the second reads every file: a failure list
    // that is appended to rather than replaced reports a file that is fine.
    let round = 0;
    const commands: BrowserCommands = {
      ...scriptedCommands(),
      getDocument: vi.fn(async (id: number) => {
        if (id === 3 && round === 0) {
          const refused: CommandResult<DocumentView> = { ok: false, failure };
          return refused;
        }
        const answer: CommandResult<DocumentView> = {
          ok: true,
          value: id === 2 ? baseDocument() : otherDocument()
        };
        return answer;
      })
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    expect(state.loadFailures).toEqual([{ document: 3, failure }]);
    expect(state.sidebar.files.some((row) => row.unreadable)).toBe(true);

    round = 1;
    await state.open(null);
    expect(state.loadFailures).toEqual([]);
    expect(state.sidebar.pending).toBe(0);
    // The mark has to clear with the list. A row still saying "could not be
    // read" for a file that has just been read is the same lie as the total.
    expect(state.sidebar.files.some((row) => row.unreadable)).toBe(false);
  });

  it('is ready and empty for a configuration with no files at all', async () => {
    const state = createBrowserState(
      scriptedCommands({ list: { ok: true, value: [] } }),
      () => undefined
    );
    await state.open(null);
    expect(state.status).toBe('ready');
    expect(state.documents).toEqual([]);
    expect(state.sidebar.total).toBe(0);
  });
}); // End of the "load" suite

describe('the list the middle pane shows', () => {
  it('is every match of every file until a file is chosen', async () => {
    const state = createBrowserState(scriptedCommands(), () => undefined);
    await state.open(null);
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11, 20]);
  });

  it('narrows to one file when the sidebar selects one', async () => {
    const state = createBrowserState(scriptedCommands(), () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 3 });
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([20]);
  });

  it('applies the search on top of the file filter, not instead of it', async () => {
    const state = createBrowserState(scriptedCommands(), () => undefined);
    await state.open(null);
    state.search('sig');
    expect(state.visibleMatches.map((match) => match.id.node)).toEqual([10]);
    state.show({ kind: 'document', id: 3 });
    expect(state.visibleMatches).toEqual([]);
  });
}); // End of the "list" suite

describe('the file the middle pane is showing', () => {
  /*
   * `scopedDocument` is what the middle pane draws a file's diagnostics and
   * hazards from. It has to answer for a file with **no matches**, because a
   * file that does not parse is exactly that and is the one that most needs a
   * sentence.
   */
  it('is nothing while the list is showing every file', async () => {
    const state = createBrowserState(scriptedCommands(), () => undefined);
    await state.open(null);
    expect(state.scopedDocument).toBeNull();
  });

  it('is the projection of the file the sidebar selected', async () => {
    const state = createBrowserState(scriptedCommands(), () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 3 });
    expect(state.scopedDocument?.id).toBe(3);
  });

  it('is the projection even when that file holds no matches at all', async () => {
    // The four invalid fixtures' shape: a view with `parsed: false`, an empty
    // `matches` and a diagnostic. Nothing in it can be selected, so the detail
    // pane is unreachable and this is the only surface left.
    const broken = makeDocument({ id: 3, relativePath: 'match/other.yml', parsed: false });
    const state = createBrowserState(
      scriptedCommands({
        documents: new Map<number, CommandResult<DocumentView>>([
          [1, { ok: true, value: profileDocument() }],
          [2, { ok: true, value: baseDocument() }],
          [3, { ok: true, value: broken }]
        ])
      }),
      () => undefined
    );
    await state.open(null);
    state.show({ kind: 'document', id: 3 });
    expect(state.scopedMatches).toEqual([]);
    expect(state.scopedDocument?.parsed).toBe(false);
  });

  it('is nothing for a file whose read was refused', async () => {
    // The only remaining reason a listed file has no projection. There is no
    // view to answer with and the pane must not be handed a half-built one;
    // what the reader gets instead is the sidebar's "Could not be read".
    const failure: IpcFailure = {
      kind: 'command',
      error: { code: 'io', path: '/tmp/espanso/match/other.yml', kind: 'PermissionDenied' }
    };
    const state = createBrowserState(
      scriptedCommands({
        documents: new Map<number, CommandResult<DocumentView>>([
          [1, { ok: true, value: profileDocument() }],
          [2, { ok: true, value: baseDocument() }],
          [3, { ok: false, failure }]
        ])
      }),
      () => undefined
    );
    await state.open(null);
    state.show({ kind: 'document', id: 3 });
    expect(state.scopedDocument).toBeNull();
  });
}); // End of the "file the middle pane is showing" suite

describe('selecting a snippet', () => {
  it('holds the identity and checks it across the boundary', async () => {
    const commands = scriptedCommands();
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    const target = state.scopedMatches[1];
    expect(target).toBeDefined();
    await state.select(target!);

    expect(state.selected?.id.node).toBe(11);
    expect(state.selected?.position).toBe(1);
    expect(state.selectedMatch?.id.node).toBe(11);
    expect(state.selectedDocument?.relative_path).toBe('match/base.yml');
    expect(commands.getMatch).toHaveBeenCalledTimes(1);
    expect(state.notice).toBeNull();
  });

  it('resolves the position within the file, not within the list on screen', async () => {
    const state = createBrowserState(scriptedCommands(), () => undefined);
    await state.open(null);
    // The third row of the "All" list is the *first* match of `other.yml`.
    const target = state.scopedMatches[2];
    await state.select(target!);
    expect(state.selected?.document).toBe(3);
    expect(state.selected?.position).toBe(0);
  });

  it('installs the re-read document, not only the identity it found there', async () => {
    // The fixture is a *different revision*: same two snippets, new nodes, and
    // one more of them. A recovery that stores the fresh identity over the
    // cached projection leaves `selectedMatch` resolving node 10 in a document
    // that no longer has one, the list showing the old rows, and the count
    // stale — all three of which are asserted below rather than assumed from
    // the identity.
    const reparsed = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-b',
      matches: [
        makeMatch({ node: 30, document: 2, revision: 'rev-b', trigger: ':sig', label: 'Signature' }),
        makeMatch({ node: 31, document: 2, revision: 'rev-b', trigger: ':date', label: 'Today' }),
        makeMatch({ node: 32, document: 2, revision: 'rev-b', trigger: ':new', label: 'Added' })
      ]
    });
    const state = createBrowserState(
      scriptedCommands({
        match: {
          ok: false,
          failure: {
            kind: 'command',
            error: { code: 'identityStaleRevision', expected: 'rev-b', found: 'rev-a' }
          }
        },
        reload: { ok: true, value: reparsed }
      }),
      () => undefined
    );
    await state.open(null);
    await state.select(state.scopedMatches[0]!);

    expect(state.notice).toBe('kept');
    expect(state.selected?.id.node).toBe(30);
    expect(state.selected?.id.revision).toBe('rev-b');
    // Live, and of the bytes now on disk — the claim section 12 of the notes
    // makes to 1c-2.
    expect(state.selectedMatch?.id.node).toBe(30);
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([30, 31, 32, 20]);
    expect(state.sidebar.total).toBe(4);
  });

  it('drops a deleted snippet from the list, not only from the selection', async () => {
    const afterDeletion = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-b',
      matches: [makeMatch({ node: 30, document: 2, revision: 'rev-b', trigger: ':date', label: 'Today' })]
    });
    const state = createBrowserState(
      scriptedCommands({
        match: {
          ok: false,
          failure: {
            kind: 'command',
            error: { code: 'identityStaleRevision', expected: 'rev-b', found: 'rev-a' }
          }
        },
        reload: { ok: true, value: afterDeletion }
      }),
      () => undefined
    );
    await state.open(null);
    await state.select(state.scopedMatches[0]!);

    expect(state.notice).toBe('differentMatch');
    expect(state.selected).toBeNull();
    // The row for `:sig` must be gone from the list as well: it is not on disk.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([30, 20]);
    expect(state.sidebar.total).toBe(2);
  });

  it('clears the selection when that position now holds a different snippet', async () => {
    // The counterexample R27 was corrected by: the first match was deleted, so
    // the held position resolves — to the wrong snippet.
    const afterDeletion = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-b',
      matches: [makeMatch({ node: 30, document: 2, revision: 'rev-b', trigger: ':date', label: 'Today' })]
    });
    const state = createBrowserState(
      scriptedCommands({
        match: {
          ok: false,
          failure: {
            kind: 'command',
            error: { code: 'identityStaleRevision', expected: 'rev-b', found: 'rev-a' }
          }
        },
        reload: { ok: true, value: afterDeletion }
      }),
      () => undefined
    );
    await state.open(null);
    // `:sig` was selected at position 0; `:sig` is what the deletion removed,
    // so position 0 still resolves — to `:date`.
    await state.select(state.scopedMatches[0]!);

    expect(state.selected).toBeNull();
    expect(state.notice).toBe('differentMatch');
  });

  it('clears the selection when the snippet is simply not there any more', async () => {
    const state = createBrowserState(
      scriptedCommands({
        match: { ok: false, failure: { kind: 'command', error: { code: 'identityNoSuchMatch', node: 10 } } }
      }),
      () => undefined
    );
    await state.open(null);
    await state.select(state.scopedMatches[0]!);

    expect(state.selected).toBeNull();
    expect(state.notice).toBe('gone');
  });

  it('says so, and drops the selection, when the file cannot be read again', async () => {
    const state = createBrowserState(
      scriptedCommands({
        match: {
          ok: false,
          failure: {
            kind: 'command',
            error: { code: 'identityStaleRevision', expected: 'rev-b', found: 'rev-a' }
          }
        },
        reload: {
          ok: false,
          failure: { kind: 'command', error: { code: 'io', path: '/tmp/x', kind: 'NotFound' } }
        }
      }),
      () => undefined
    );
    await state.open(null);
    await state.select(state.scopedMatches[0]!);

    expect(state.selected).toBeNull();
    expect(state.notice).toBe('unresolved');
  });

  it('is dropped by a reload, so no notice outlives the window it belongs to', async () => {
    const state = createBrowserState(scriptedCommands(), () => undefined);
    await state.open(null);
    await state.select(state.scopedMatches[0]!);
    await state.open(null);
    expect(state.selected).toBeNull();
    expect(state.notice).toBeNull();
  });

  it('can be dismissed and cleared independently', async () => {
    // Both directions, on a case where the two really are independent: the
    // selection *survives* a `kept`, so dismissing the notice must leave it
    // standing, and clearing the selection must take the notice with it.
    const state = createBrowserState(
      scriptedCommands({
        match: {
          ok: false,
          failure: {
            kind: 'command',
            error: { code: 'identityStaleRevision', expected: 'rev-b', found: 'rev-a' }
          }
        },
        reload: { ok: true, value: baseDocument() }
      }),
      () => undefined
    );
    await state.open(null);
    await state.select(state.scopedMatches[0]!);
    expect(state.notice).toBe('kept');
    expect(state.selected).not.toBeNull();

    state.dismissNotice();
    expect(state.notice).toBeNull();
    expect(state.selected?.id.node).toBe(10);

    state.clearSelection();
    expect(state.selected).toBeNull();
    expect(state.notice).toBeNull();
  });
}); // End of the "selecting" suite

describe('two requests that overlap', () => {
  it('lets the newer selection win, however late the older one answers', async () => {
    // The user clicks A, then B before A's `get_match` has answered. A's answer
    // arrives last and is a *stale identity*, so the recovery path runs — and
    // it would re-resolve A, select it and raise A's notice, over a B the user
    // chose afterwards. The state B left is what has to survive.
    const first = deferred<CommandResult<MatchView>>();
    const answers: Promise<CommandResult<MatchView>>[] = [
      first.promise,
      Promise.resolve<CommandResult<MatchView>>({ ok: true, value: makeMatch({ node: 11 }) })
    ];
    let call = 0;
    const commands: BrowserCommands = {
      ...scriptedCommands(),
      getMatch: vi.fn(() => answers[call++] ?? answers[1]!)
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const pending = state.select(state.scopedMatches[0]!);
    await state.select(state.scopedMatches[1]!);
    expect(state.selected?.id.node).toBe(11);

    first.resolve({
      ok: false,
      failure: {
        kind: 'command',
        error: { code: 'identityStaleRevision', expected: 'rev-b', found: 'rev-a' }
      }
    });
    await pending;

    expect(state.selected?.id.node).toBe(11);
    expect(state.notice).toBeNull();
    // And it is dropped *before* the recovery, not after it: re-reading a file
    // to re-resolve a selection the user has already replaced is a command
    // nobody asked for, and the answer would have to be discarded anyway.
    expect(commands.reloadDocument).not.toHaveBeenCalled();
  });

  it('lets the newer selection win even when the older one is already recovering', async () => {
    // The second window, and it is a different one: A's `get_match` has already
    // refused, so A is inside `repairSelection` waiting for a *reload* when the
    // user clicks B. The recovery finishes afterwards and would otherwise
    // install its document, select A and raise A's notice.
    const reload = deferred<CommandResult<DocumentView>>();
    const stale: CommandResult<MatchView> = {
      ok: false,
      failure: {
        kind: 'command',
        error: { code: 'identityStaleRevision', expected: 'rev-b', found: 'rev-a' }
      }
    };
    const answers: CommandResult<MatchView>[] = [stale, { ok: true, value: makeMatch({ node: 11 }) }];
    let call = 0;
    const commands: BrowserCommands = {
      ...scriptedCommands(),
      getMatch: vi.fn(async () => answers[call++] ?? answers[1]!),
      reloadDocument: vi.fn(() => reload.promise)
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const pending = state.select(state.scopedMatches[0]!);
    // Drain every pending microtask, so that A is *inside* the recovery and has
    // already passed the check that follows `get_match`. Clicking before this
    // point would be caught by that earlier check and would say nothing about
    // this one.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(commands.reloadDocument).toHaveBeenCalledTimes(1);

    await state.select(state.scopedMatches[1]!);
    expect(state.selected?.id.node).toBe(11);

    reload.resolve({ ok: true, value: baseDocument() });
    await pending;

    expect(state.selected?.id.node).toBe(11);
    expect(state.notice).toBeNull();
  });

  it('lets the newer open win, however late the older one answers', async () => {
    const first = deferred<CommandResult<WorkspaceSummary>>();
    const second: CommandResult<WorkspaceSummary> = {
      ok: true,
      value: { ...SUMMARY, root: '/tmp/other' }
    };
    let call = 0;
    const commands: BrowserCommands = {
      ...scriptedCommands(),
      openWorkspace: vi.fn(() => (call++ === 0 ? first.promise : Promise.resolve(second)))
    };
    const state = createBrowserState(commands, () => undefined);

    const pending = state.open(null);
    await state.open('/tmp/other');
    expect(state.status).toBe('ready');
    expect(state.summary?.root).toBe('/tmp/other');

    first.resolve({ ok: true, value: SUMMARY });
    await pending;

    // The first open's answer describes a directory the user has replaced.
    expect(state.status).toBe('ready');
    expect(state.summary?.root).toBe('/tmp/other');
  });
}); // End of the "overlapping requests" suite

describe('opening a second workspace', () => {
  it('forgets the file filter and the query the first one was left in', async () => {
    // Workspace B may not have a document 3 at all, or may have given that
    // identity to another file. Either way the filter and the query are
    // statements about A, and carrying them over shows an empty pane for a
    // configuration that is not empty.
    const state = createBrowserState(scriptedCommands(), () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 3 });
    state.search('sql');
    expect(state.visibleMatches).toHaveLength(1);

    await state.open(null);

    expect(state.selection.kind).toBe('all');
    expect(state.query).toBe('');
    expect(state.visibleMatches).toHaveLength(3);
  });

  it('shows nothing of the first workspace while the second is being read', async () => {
    // `documents` and `summary` are what the empty and ready screens are drawn
    // from. Leaving them in place means the previous configuration's file list
    // is on screen under the new configuration's loading state.
    const first = deferred<CommandResult<WorkspaceSummary>>();
    let call = 0;
    const commands: BrowserCommands = {
      ...scriptedCommands(),
      openWorkspace: vi.fn(() =>
        call++ === 0
          ? Promise.resolve<CommandResult<WorkspaceSummary>>({ ok: true, value: SUMMARY })
          : first.promise
      )
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    expect(state.documents).toHaveLength(3);

    const pending = state.open('/tmp/other');
    expect(state.status).toBe('loading');
    expect(state.documents).toEqual([]);
    expect(state.summary).toBeNull();
    expect(state.scopedMatches).toEqual([]);

    first.resolve({ ok: true, value: SUMMARY });
    await pending;
    expect(state.status).toBe('ready');
  });
}); // End of the "opening a second workspace" suite

describe('the raw viewer', () => {
  /*
   * What this suite establishes is the **state machine**, not the screen. It can
   * say which file the viewer would show, which of the four arms its text is in
   * and how many times `document_text` was called; it cannot say that anything
   * was drawn, because nothing in this repository renders a Svelte component in
   * an automated test (`docs/decisions/1c-1-notes.md` hole 1). The evidence that
   * the pane renders is the window reading in
   * `docs/decisions/1c-2b-2b-2-notes.md`, taken by hand.
   */

  it('offers no file to show until something names one', async () => {
    const state = createBrowserState(scriptedCommands(), () => undefined);
    await state.open(null);

    // The "All" scope names no file and nothing is selected, so there is
    // nothing for the toggle to be about.
    expect(state.fileTextTarget).toBeNull();
    expect(state.fileTextShown).toBe(false);
    expect(state.fileText).toBeNull();
  });

  it('takes the sidebar’s file, including one that holds no snippets', async () => {
    // The reachability property the placement decision rests on: a file with no
    // matches can never be selected into this pane through a snippet, so if the
    // viewer's target came from the selection such a file would have no way of
    // ever being shown. It comes from the sidebar instead.
    const state = createBrowserState(scriptedCommands(), () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 1 });

    expect(state.scopedMatches).toEqual([]);
    expect(state.fileTextTarget?.relative_path).toBe('config/default.yml');
  });

  it('falls back to the selected snippet’s file in the “All” scope', async () => {
    const state = createBrowserState(scriptedCommands(), () => undefined);
    await state.open(null);
    await state.select(otherDocument().matches[0]!);

    expect(state.selection.kind).toBe('all');
    expect(state.fileTextTarget?.id).toBe(3);
  });

  it('reads the file’s text when it is shown, and answers the text arm', async () => {
    const commands = scriptedCommands();
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.showFileText(true);

    expect(commands.documentText).toHaveBeenCalledWith(2);
    expect(state.fileText).toEqual({ kind: 'text', text: '# text of document 2\n' });
  });

  it('calls nothing while it is closed', async () => {
    const commands = scriptedCommands();
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    // The viewer is a mode the reader turns on. A workspace load that read
    // every file's text as well as every projection would double the cost of
    // opening a configuration for a pane nobody has asked for.
    expect(commands.documentText).not.toHaveBeenCalled();
    expect(state.fileText).toBeNull();
  });

  it('holds a file it cannot decode in the refused arm, never in the empty one', async () => {
    // 1c-2b-2a hole 8, as state. `notUtf8` is the refusal this arm exists for:
    // the file cannot be represented as a string at all, and the reader must
    // not be shown an empty box that says the file holds nothing. That the two
    // arms *draw* differently is the window reading's claim, not this one's.
    const failure: IpcFailure = {
      kind: 'command',
      error: { code: 'notUtf8', path: '/tmp/espanso/match/base.yml', offset: 41 }
    };
    const state = createBrowserState(
      scriptedCommands({ texts: new Map([[2, { ok: false, failure }]]) }),
      () => undefined
    );
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.showFileText(true);

    expect(state.fileText).toEqual({ kind: 'refused', failure });
  });

  it('tells a file of no characters apart from one it could not read', async () => {
    // **Both inputs are supplied**, which is the review's fifth finding: a body
    // that offered only the empty file would still pass if an unreadable one
    // were classified as empty too, and telling the two apart is the entire
    // reason `RawDocumentText` has four arms rather than a string.
    const failure: IpcFailure = {
      kind: 'command',
      error: { code: 'notUtf8', path: '/tmp/espanso/match/other.yml', offset: 41 }
    };
    const state = createBrowserState(
      scriptedCommands({
        texts: new Map<number, CommandResult<string>>([
          [2, { ok: true, value: '' }],
          [3, { ok: false, failure }]
        ])
      }),
      () => undefined
    );
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.showFileText(true);
    expect(state.fileText).toEqual({ kind: 'empty' });

    state.show({ kind: 'document', id: 3 });
    await Promise.resolve();
    await Promise.resolve();
    expect(state.fileText).toEqual({ kind: 'refused', failure });
  }); // End of the "empty apart from unreadable" case

  it('reports a refusal to the developer as well as holding it on the state', async () => {
    const failure: IpcFailure = {
      kind: 'command',
      error: { code: 'io', path: '/tmp/espanso/match/base.yml', kind: 'PermissionDenied' }
    };
    const report = vi.fn();
    const state = createBrowserState(
      scriptedCommands({ texts: new Map([[2, { ok: false, failure }]]) }),
      report
    );
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.showFileText(true);

    expect(report).toHaveBeenCalledWith(failure);
    // Both channels, so the name is true of both halves: the console for the
    // developer, and the state the pane reads for the user.
    expect(state.fileText).toEqual({ kind: 'refused', failure });
  });

  it('reads the new file when a sidebar click moves the target', async () => {
    const commands = scriptedCommands();
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.showFileText(true);

    state.show({ kind: 'document', id: 3 });
    // The click starts the read, and what the pane holds until it settles is
    // `loading` rather than the previous file's text. **What makes that true is
    // `readFileText` nulling the answer synchronously**, not the identity guard
    // in the getter: experiment C removes that guard and nothing here fails.
    expect(state.fileText).toEqual({ kind: 'loading' });
    await Promise.resolve();
    await Promise.resolve();

    expect(state.fileTextTarget?.id).toBe(3);
    expect(state.fileText).toEqual({ kind: 'text', text: '# text of document 3\n' });
  });

  it('does not re-read one file because the reader clicked another snippet in it', async () => {
    const commands = scriptedCommands();
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.showFileText(true);
    expect(commands.documentText).toHaveBeenCalledTimes(1);

    await state.select(baseDocument().matches[0]!);
    await state.select(baseDocument().matches[1]!);

    expect(commands.documentText).toHaveBeenCalledTimes(1);
  });

  it('re-reads on every re-opening, because the file may have changed', async () => {
    // There is no watcher, so the only moment this application can honestly
    // take a snapshot of a file is the moment the reader asks to see it. What
    // makes that happen is `showFileText(false)` clearing the *identity* of the
    // file whose text is held: `readFileText` then sees a target it is not
    // already showing. Experiment F puts that identity back and this fails.
    const commands = scriptedCommands();
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.showFileText(true);
    await state.showFileText(false);
    await state.showFileText(true);

    expect(commands.documentText).toHaveBeenCalledTimes(2);
  });

  it('drops the text it was showing when it is closed', async () => {
    const state = createBrowserState(scriptedCommands(), () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.showFileText(true);
    await state.showFileText(false);

    expect(state.fileTextShown).toBe(false);
    expect(state.fileText).toBeNull();
  });

  it('discards an answer whose file the reader has already moved off', async () => {
    // The same race the two generation counters exist for, on a third channel.
    // Without it, a slow read of file 2 lands after a click on file 3 and the
    // pane shows one file's bytes under the other file's name.
    const slow = deferred<CommandResult<string>>();
    const commands: BrowserCommands = {
      ...scriptedCommands(),
      documentText: vi.fn((id: number) =>
        id === 2 ? slow.promise : Promise.resolve<CommandResult<string>>({ ok: true, value: 'b' })
      )
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    const pending = state.showFileText(true);

    state.show({ kind: 'document', id: 3 });
    await Promise.resolve();
    await Promise.resolve();
    expect(state.fileText).toEqual({ kind: 'text', text: 'b' });

    slow.resolve({ ok: true, value: 'a' });
    await pending;

    // File 2's answer arrived last and is discarded whole.
    expect(state.fileText).toEqual({ kind: 'text', text: 'b' });
  });

  it('re-reads a file whose target was cleared, rather than redrawing the old snapshot', async () => {
    // **The review's sixth finding, second half.** In the "All" scope the
    // selected snippet's file *is* the viewer's target, so dropping the
    // selection drops the target — and the held snapshot with it. Without that,
    // selecting a snippet in the same file again matches the identity
    // `readFileText` still holds, returns early, and redraws bytes read before
    // the clear, which contradicts this module's own policy that a file is
    // re-read whenever the viewer is pointed at it afresh.
    const commands = scriptedCommands();
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    await state.select(baseDocument().matches[0]!);
    await state.showFileText(true);
    expect(commands.documentText).toHaveBeenCalledTimes(1);

    state.clearSelection();
    expect(state.fileTextTarget).toBeNull();
    expect(state.fileText).toBeNull();

    await state.select(baseDocument().matches[0]!);
    await Promise.resolve();
    await Promise.resolve();

    expect(commands.documentText).toHaveBeenCalledTimes(2);
    expect(state.fileText).toEqual({ kind: 'text', text: '# text of document 2\n' });
  }); // End of the "re-reads a cleared target's file" case

  it('drops an answer in flight when the target is cleared, so no later selection reuses it', async () => {
    // **The same finding's first half**, and the harder one: the read was
    // already on its way when the target went. If it lands and installs itself
    // as the snapshot, the next selection of that file is served bytes the
    // reader never asked for again — with nothing on screen saying when they
    // were read.
    const slow = deferred<CommandResult<string>>();
    let calls = 0;
    const commands: BrowserCommands = {
      ...scriptedCommands(),
      documentText: vi.fn(() => {
        calls += 1;
        return calls === 1
          ? slow.promise
          : Promise.resolve<CommandResult<string>>({ ok: true, value: 'read again' });
      })
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    await state.select(baseDocument().matches[0]!);
    const pending = state.showFileText(true);

    state.clearSelection();
    slow.resolve({ ok: true, value: 'read before the clear' });
    await pending;
    expect(state.fileTextTarget).toBeNull();

    await state.select(baseDocument().matches[0]!);
    await Promise.resolve();
    await Promise.resolve();

    expect(commands.documentText).toHaveBeenCalledTimes(2);
    expect(state.fileText).toEqual({ kind: 'text', text: 'read again' });
  }); // End of the "answer in flight when the target is cleared" case

  it('closes with the workspace, because every identity is about to be reused', async () => {
    const state = createBrowserState(scriptedCommands(), () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.showFileText(true);

    await state.open(null);

    expect(state.fileTextShown).toBe(false);
    expect(state.fileText).toBeNull();
  });
}); // End of the "raw viewer" suite

/**
 * The moved-document projection: the same two snippets, in the other order,
 * under a new revision.
 *
 * A **new revision** and **new node identifiers**, because that is what a commit
 * really produces: `MatchId` carries the revision it was minted from, so every
 * identity held before the save stops resolving.
 */
function movedDocument(): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision: 'rev-b',
    matches: [
      makeMatch({ node: 30, document: 2, revision: 'rev-b', trigger: ':date', label: 'Today' }),
      makeMatch({ node: 31, document: 2, revision: 'rev-b', trigger: ':sig', label: 'Signature' })
    ]
  });
} // End of function movedDocument()

/**
 * A third projection of the same file, later than {@link movedDocument}.
 *
 * **A third revision and a third set of nodes**, so that a case about two reads
 * that overlap can say *which* of them the state ended up holding. Two projections
 * cannot: an assertion against `rev-b` passes whether the answer that installed it
 * was the wanted one or the stale one.
 *
 * @returns The projection.
 */
function laterDocument(): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision: 'rev-c',
    matches: [
      makeMatch({ node: 40, document: 2, revision: 'rev-c', trigger: ':sig', label: 'Signature' }),
      makeMatch({ node: 41, document: 2, revision: 'rev-c', trigger: ':date', label: 'Today' })
    ]
  });
} // End of function laterDocument()

/** A finding a refusal could carry and a caller could hand back. */
function suspicion(): Finding {
  return {
    code: { ReferenceHasNoDeclaration: { name: 'who' } },
    span: { start: 10, end: 20 },
    node: 11,
    path: null
  };
}

/** An acknowledgement of nothing, which is what a first attempt sends. */
const NOTHING_ACKNOWLEDGED: Acknowledgement = { accepted: [] };

/**
 * The revision every fixture in this file is projected at when the workspace opens.
 *
 * What a form, a move or a deletion session opened straight after the load would
 * carry as its base, and therefore what its caller hands the wrapper. It is named
 * rather than spelled at each call site because the interesting cases are the ones
 * that pass something **else** — a submission drafted before the window moved on.
 */
const OPEN_REVISION: ContentRevision = 'rev-a';

/**
 * The disk side's whole file text, on every conflict fixture in this file.
 *
 * A conflict payload carries the file as the disk holds it, and no wrapper here
 * reads it — 2c-4a-1 puts the value on the wire and adds no screen for it. It is
 * one constant so that a later step wiring it through has one fixture to change.
 */
const DISK_TEXT = 'matches:\n  - trigger: x\n    replace: theirs\n';

/**
 * A save that ran to the end and wrote nothing.
 *
 * A documented success, and the arm the argument cases below use precisely
 * because it moves nothing: the revision is the one this state was already
 * projecting, so no re-read happens and the assertion is about what was **sent**.
 */
const CREATED_NOTHING: SaveResult = {
  outcome: 'saved',
  revision: 'rev-a',
  committed: false,
  notes: [],
  backup_taken: false,
  moved: null
};

/**
 * A command failure at or after the rename.
 *
 * `may_have_written: true` is the wire saying this application cannot tell
 * whether the file was written, which is the one bit a screen cannot do without.
 */
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
};

describe('reading one file again', () => {
  /*
   * `BrowserState.rereadDocument`, added at Phase 2c-3b step 2 because
   * `MoveRecovery.reloadFile` in `./matchMove.ts` — the design consult's Q8
   * answer — was a code with no producer behind it: `commands.reloadDocument`
   * was reachable only from inside `select()`'s own repair.
   */

  it('replaces the projection, drops the text it was showing, and answers nothing', async () => {
    const commands = scriptedCommands({ reload: { ok: true, value: movedDocument() } });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.showFileText(true);
    expect(state.fileText).not.toBeNull();
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11]);

    const failure = await state.rereadDocument(2);

    expect(failure).toBeNull();
    expect(commands.reloadDocument).toHaveBeenCalledWith(2);
    // The whole projection moved, not merely one identity: the list, the counts
    // and every `MatchId` minted from the old parse are read off `views`.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([30, 31]);
    expect(state.scopedDocument?.revision).toBe('rev-b');
    // And the viewer's snapshot was of bytes this state has just stopped
    // vouching for, so it was dropped and read again rather than redrawn.
    expect(commands.documentText).toHaveBeenCalledTimes(2);
  }); // End of the "replaces the projection" case

  it('puts the selection back positionally and then checks it (R27)', async () => {
    // `movedDocument` writes `:date` first and `:sig` second, so the snippet at
    // the held position is a different one — which is a selection dropped with a
    // notice, never a silent re-point.
    const commands = scriptedCommands({ reload: { ok: true, value: movedDocument() } });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);
    expect(state.selected?.id.node).toBe(10);

    await state.rereadDocument(2);

    expect(state.selected).toBeNull();
    expect(state.notice).toBe('differentMatch');
  }); // End of the "selection repaired" case

  it('reports a read it could not make, answers it, and keeps what it holds', async () => {
    // **The stale projection stays.** Nothing here knows the file is gone, only
    // that this attempt did not reach it, and dropping a file's whole projection
    // is a bigger claim than a failed read supports. The failure is answered as
    // well as reported, so the caller can say why rather than leaving a control
    // that appeared to do nothing.
    const refusal: IpcFailure = {
      kind: 'command',
      error: { code: 'unknownDocument', document: 2 }
    };
    const reported: IpcFailure[] = [];
    const commands = scriptedCommands({ reload: { ok: false, failure: refusal } });
    const state = createBrowserState(commands, (failure) => reported.push(failure));
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    expect(await state.rereadDocument(2)).toEqual(refusal);

    expect(reported).toEqual([refusal]);
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11]);
    // A read that failed is not a workspace that failed.
    expect(state.status).toBe('ready');
    expect(state.failure).toBeNull();
  }); // End of the "failed re-read" case

  it('lets the newer re-read win, however late the older one answers', async () => {
    // **The second review's High finding.** This call awaited with no generation
    // captured at all, so of two overlapping re-reads of one file the *older*
    // answer installed last and won — the state ending up projecting bytes it had
    // already replaced with fresher ones, with every identity minted from them.
    const first = deferred<CommandResult<DocumentView>>();
    let call = 0;
    const commands: BrowserCommands = {
      ...scriptedCommands(),
      reloadDocument: vi.fn(() =>
        call++ === 0
          ? first.promise
          : Promise.resolve<CommandResult<DocumentView>>({ ok: true, value: laterDocument() })
      )
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    const pending = state.rereadDocument(2);
    await state.rereadDocument(2);
    expect(state.scopedDocument?.revision).toBe('rev-c');

    first.resolve({ ok: true, value: movedDocument() });
    expect(await pending).toBeNull();

    // The older answer is discarded whole rather than installed: `rev-b` describes
    // a parse the second read has already superseded, and answering `null` says
    // only that this read did not fail.
    expect(state.scopedDocument?.revision).toBe('rev-c');
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([40, 41]);
  }); // End of the "overlapping re-reads" case

  it('discards a re-read whose workspace has been replaced under it', async () => {
    // **The half neither per-document counter can see, and they miss it for
    // opposite reasons.** `open()` *clears* `projectionGenerations`, so a file whose
    // projection had never been replaced compares equal across two workspaces;
    // `rereadGenerations` is monotonic and `open()` leaves it alone, so it counts
    // straight through the replacement without ever encoding which workspace a read
    // belonged to. Meanwhile the load replaces every projection behind those
    // identities — which are themselves path-stable — so an answer from the closed
    // workspace installed into the open one describes bytes this state is not
    // showing. `openGeneration` is the only capture that catches it.
    const reload = deferred<CommandResult<DocumentView>>();
    const commands: BrowserCommands = {
      ...scriptedCommands(),
      reloadDocument: vi.fn(() => reload.promise)
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    const pending = state.rereadDocument(2);
    await state.open('/tmp/other');

    reload.resolve({ ok: true, value: movedDocument() });
    expect(await pending).toBeNull();

    expect(state.views.find((view) => view.id === 2)?.revision).toBe('rev-a');
    expect(state.status).toBe('ready');
  }); // End of the "replaced workspace" case
}); // End of the "reading one file again" suite

describe('moving a snippet', () => {
  it('re-reads the file, re-points the selection and forgets the text it was showing', async () => {
    const moved = movedDocument();
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: true,
        moved: moved.matches[1]!.id
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, moves: [saved] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);
    await state.showFileText(true);
    expect(state.fileText).not.toBeNull();

    // The commit is what the boundary answers, and the re-read is what it
    // answers with afterwards.
    documents.set(2, { ok: true, value: moved });
    const outcome = await state.moveMatch(
      baseDocument().matches[0]!.id,
      null,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    expect(outcome).toMatchObject({ kind: 'answered', adoption: { kind: 'done' } });
    expect(outcome.kind === 'answered' ? outcome.result.outcome : null).toBe('saved');
    // The projection the list draws from is the one that was written.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([30, 31]);
    // The selection followed the snippet by the identity the command answered
    // with, rather than staying at the position it used to occupy.
    expect(state.selected?.id.node).toBe(31);
    expect(state.selectedMatch?.label?.text).toBe('Signature');
    expect(state.notice).toBeNull();
    // And the raw viewer's snapshot was of bytes that have just been replaced,
    // so it was dropped and read again rather than redrawn.
    expect(commands.documentText).toHaveBeenCalledTimes(2);
    expect(state.fileText).toEqual({ kind: 'text', text: '# text of document 2\n' });
  }); // End of the "committed move" case

  it('shows the findings of a refusal and writes nothing', async () => {
    const refused: CommandResult<SaveResult> = {
      ok: true,
      value: { outcome: 'refused', verdict: 'RefusedForUnacknowledgedSuspicions', findings: [suspicion()] }
    };
    const commands = scriptedCommands({ moves: [refused] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    const outcome = await state.moveMatch(
      baseDocument().matches[0]!.id,
      null,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    expect(outcome).toEqual({
      kind: 'answered',
      result: refused.ok ? refused.value : null,
      // Nothing was written, so no adoption was owed.
      adoption: { kind: 'notOwed' }
    });
    // Nothing was written, so nothing here moved: same projection, same
    // selection, and no second read of the document.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11]);
    expect(state.selected?.id.node).toBe(10);
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
  }); // End of the "refused move" case

  it('sends back exactly the findings a refusal carried, and no flag', async () => {
    const shown = suspicion();
    const refused: CommandResult<SaveResult> = {
      ok: true,
      value: { outcome: 'refused', verdict: 'RefusedForUnacknowledgedSuspicions', findings: [shown] }
    };
    const moved = movedDocument();
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: moved.matches[1]!.id
      }
    };
    const commands = scriptedCommands({ moves: [refused, saved] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const first = await state.moveMatch(
      baseDocument().matches[0]!.id,
      null,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );
    const firstResult = first.kind === 'answered' ? first.result : null;
    expect(firstResult?.outcome).toBe('refused');
    const findings = firstResult?.outcome === 'refused' ? firstResult.findings : [];
    await state.moveMatch(baseDocument().matches[0]!.id, null, OPEN_REVISION, {
      accepted: findings
    });

    // The second call carried the findings back by content, unchanged. There is
    // no boolean anywhere in either call.
    const calls = vi.mocked(commands.moveMatch).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]![3]).toEqual({ accepted: [] });
    expect(calls[1]![3]).toEqual({ accepted: [shown] });
    expect(JSON.stringify(calls[1])).not.toContain('force');
  }); // End of the "acknowledgement round trip" case

  it('takes the conflict projection as the one the next save is checked against', async () => {
    const disk = movedDocument();
    const conflict: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'conflict',
        reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
        expected: 'rev-a',
        found: 'rev-b',
        disk_revision: 'rev-b',
        disk_text: DISK_TEXT,
        disk
      }
    };
    const commands = scriptedCommands({ moves: [conflict] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    const outcome = await state.moveMatch(
      baseDocument().matches[0]!.id,
      null,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    expect(outcome).toMatchObject({ kind: 'answered', adoption: { kind: 'notOwed' } });
    expect(outcome.kind === 'answered' ? outcome.result.outcome : null).toBe('conflict');
    // **The disk side is carried, not installed** (consult Q2). This case pinned
    // the opposite until 2c-4a-2, and what it pinned was the defect: a move that
    // wrote nothing re-ordered the snippet list and dropped the selection with a
    // notice saying the file had changed under the person.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11]);
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
    expect(state.selected?.id.node).toBe(10);
    expect(state.notice).toBeNull();
  }); // End of the "conflict" case

  it('leaves a move session usable after a conflict, through the real answer', async () => {
    // **The consult's Q2 asserted from the production wrapper rather than from a
    // hand-built pair, and this case says the opposite of what it said until
    // 2c-4a-2.** A conflict then installed its disk projection here while
    // reporting `adoption: notOwed`, so every identity the session held came from
    // a parse this window had just replaced and `applyMove` derived the
    // invalidation from the arm. Nothing is installed now: the session's
    // identities are still the ones the window is projecting, so it is refused
    // while the conflict is showing and usable again once the panel is dismissed.
    const before = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      matches: [
        makeMatch({ node: 10, document: 2, trigger: ':sig', path: matchListPath(0) }),
        makeMatch({ node: 11, document: 2, trigger: ':date', path: matchListPath(1) })
      ]
    });
    const disk = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-c',
      matches: [
        makeMatch({
          node: 10,
          document: 2,
          revision: 'rev-c',
          trigger: ':sig',
          path: matchListPath(0)
        }),
        makeMatch({
          node: 11,
          document: 2,
          revision: 'rev-c',
          trigger: ':date',
          path: matchListPath(1)
        })
      ]
    });
    const conflict: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'conflict',
        reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
        expected: 'rev-a',
        found: 'rev-c',
        disk_revision: 'rev-c',
        disk_text: DISK_TEXT,
        disk
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: before }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, moves: [conflict] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    // The session a screen would be holding: `:date` on its way to the top.
    const opened = choosePlacement(startMatchMove(before, before.matches[1]!, null), {
      kind: 'top'
    });
    const started = beginMove(opened, before.matches[1]!.id, () => opened);
    expect(started).not.toBeNull();

    const answer = await state.moveMatch(
      before.matches[1]!.id,
      null,
      baseRevisionOf(opened),
      NOTHING_ACKNOWLEDGED
    );
    if (answer.kind !== 'answered') {
      throw new Error('the wrapper answered no outcome at all');
    }
    // The pair production really produces, asserted rather than assumed.
    expect(answer.result.outcome).toBe('conflict');
    expect(answer.adoption).toEqual({ kind: 'notOwed' });

    const done = applyMove(started!.session, answer.result, answer.adoption, () => started!.session);
    expect(done.invalidated).toBe(false);
    // The panel refuses while the conflict is on screen, and hands the session
    // back once it is dismissed — against the projection this window still holds,
    // which is the one the session was opened over.
    expect(canChoose(done)).toBe(false);
    const dismissed = dismissMoveOutcome(done);
    expect(canChoose(dismissed)).toBe(true);
    expect(matchMoveView(dismissed, [before]).spent).toBe(false);
    expect(beginMove(dismissed, before.matches[1]!.id, () => dismissed)).not.toBeNull();
    // What has *not* changed is the file, so a retry carrying the frozen base is
    // **refused** rather than allowed to overwrite the other writer's bytes. This
    // case sends no second command and therefore says nothing about *which*
    // refusal: `conflict_after_the_lock` refreshed the Rust cache when it produced
    // the conflict, so `move_match`'s `view_at` answers `identityStaleRevision`
    // ahead of the locked check. What is asserted here is the base itself.
    expect(baseRevisionOf(dismissed)).toBe(before.revision);
    // And `disk` was carried, never installed.
    expect(state.views.find((view) => view.id === 2)?.revision).toBe(before.revision);
    expect(disk.revision).toBe('rev-c');
  }); // End of the "a conflict leaves the session usable" case

  it('reports a failed save and changes nothing on the screen', async () => {
    // **The fixture fails at the rename**, which is the step that means the
    // rename did *not* happen: `may_have_written` is `false`, so nothing this
    // window shows of the file has been invalidated. The case where it did is the
    // test below, and the two exist as a pair.
    const failure: IpcFailure = {
      kind: 'command',
      error: {
        code: 'saveFailed',
        error: { Write: { Io: { step: 'Rename', path: '/tmp/espanso/match/base.yml', kind: 'PermissionDenied', raw_os_error: 13 } } },
        may_have_written: false
      }
    };
    const reported: IpcFailure[] = [];
    const commands = scriptedCommands({ moves: [{ ok: false, failure }] });
    const state = createBrowserState(commands, (next) => reported.push(next));
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.showFileText(true);
    expect(commands.documentText).toHaveBeenCalledTimes(1);

    const outcome = await state.moveMatch(
      baseDocument().matches[0]!.id,
      null,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    // **The 2c-2 review's first finding, applied to a move at 2c-3b-1.** The
    // classification survives the wrapper, so a screen can tell this from
    // `noWorkspaceOpen` — and the reason travels beside the bit rather than only
    // to the developer channel.
    expect(outcome).toEqual({ kind: 'failed', mayHaveWritten: false, failure });
    expect(reported).toEqual([failure]);
    // A save that failed is not a workspace that failed: the window still shows
    // the configuration it was showing.
    expect(state.status).toBe('ready');
    expect(state.failure).toBeNull();
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11]);
    // Nothing was written, so nothing was re-read: three reads for the load and
    // one text read for the viewer, and no more of either.
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
    expect(commands.documentText).toHaveBeenCalledTimes(1);
  }); // End of the "failed save" case

  it('re-reads the file when the failure says the rename may have completed', async () => {
    // **The other side of `may_have_written`, and the finding the review of Phase
    // 2b-2a filed as High.** The rename succeeded and the directory sync failed,
    // so the file may already hold the moved snippet: the command layer drops its
    // own cached parse in exactly this case, and a window that assumed nothing had
    // happened would go on drawing the pre-save order and the pre-save text.
    const failure: IpcFailure = {
      kind: 'command',
      error: {
        code: 'saveFailed',
        error: { Write: { Io: { step: 'SyncDirectory', path: '/tmp/espanso/match/base.yml', kind: 'Interrupted', raw_os_error: 4 } } },
        may_have_written: true
      }
    };
    const moved = movedDocument();
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const reported: IpcFailure[] = [];
    const commands = scriptedCommands({ documents, moves: [{ ok: false, failure }] });
    const state = createBrowserState(commands, (next) => reported.push(next));
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);
    await state.showFileText(true);
    expect(commands.documentText).toHaveBeenCalledTimes(1);

    // What is on disk after the rename that did complete.
    documents.set(2, { ok: true, value: moved });
    const outcome = await state.moveMatch(
      baseDocument().matches[0]!.id,
      null,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    // It is still a failure and is still reported as one — and it carries the one
    // bit a screen cannot do without.
    expect(outcome).toEqual({ kind: 'failed', mayHaveWritten: true, failure });
    expect(reported).toEqual([failure]);
    expect(state.status).toBe('ready');
    // And the screen now describes the file as it may now be, rather than as it
    // was: the projection was re-read and the raw snapshot was dropped and taken
    // again.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([30, 31]);
    expect(commands.getDocument).toHaveBeenCalledTimes(4);
    expect(commands.documentText).toHaveBeenCalledTimes(2);
    // The selection was made against bytes that may be gone, and no identity was
    // answered for it, so it is repaired the ordinary way rather than kept.
    expect(state.selected).toBeNull();
    expect(state.notice).toBe('differentMatch');
  }); // End of the "failed save that may have written" case

  it('leaves the screen alone when a save commits nothing', async () => {
    // **`committed: false` is a success, not a failure.** Moving one of two
    // byte-identical snippets produces a byte-identical candidate, and a candidate
    // equal to what the file already holds is not written — every rename installs
    // a new inode and drops eight classes of metadata for nothing. Both gates
    // still ran, no identity went stale, and the revision is the one this state
    // was already projecting, so there is nothing here to re-read.
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-a',
        committed: false,
        notes: [],
        backup_taken: false,
        moved: null
      }
    };
    const commands = scriptedCommands({ moves: [saved] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);
    await state.showFileText(true);
    expect(commands.documentText).toHaveBeenCalledTimes(1);

    const outcome = await state.moveMatch(
      baseDocument().matches[0]!.id,
      null,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    // A success, answered as one — and no adoption was owed, because nothing this
    // state describes went out of date.
    expect(outcome).toMatchObject({ kind: 'answered', adoption: { kind: 'notOwed' } });
    expect(outcome.kind === 'answered' ? outcome.result.outcome : null).toBe('saved');
    // The selection is where it was, with no notice: nothing was invalidated, so
    // presenting a repair would be this application inventing an event.
    expect(state.selected?.id.node).toBe(10);
    expect(state.notice).toBeNull();
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11]);
    // And neither the projection nor the text was fetched again.
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
    expect(commands.documentText).toHaveBeenCalledTimes(1);
  }); // End of the "committed: false" case

  it('refuses a snippet whose document this state does not hold', async () => {
    const commands = scriptedCommands();
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    // Document 9 was never listed, so there is no base revision to send. The
    // command is not called at all, which is the assertion: inventing a base
    // revision would turn a move into a move of whatever now sits at the
    // position.
    const stranger = makeMatch({ node: 99, document: 9, trigger: ':nowhere' });
    // Its own arm, not a `failed` with `mayHaveWritten: false`: no command ran, so
    // there is no rejection to hand on and the type says so by carrying neither
    // field.
    expect(await state.moveMatch(stranger.id, null, OPEN_REVISION, NOTHING_ACKNOWLEDGED)).toEqual({
      kind: 'notAttempted'
    });
    expect(commands.moveMatch).not.toHaveBeenCalled();
  }); // End of the "unknown document" case

  it('sends the identities, the base revision and the acknowledgement, and no flag', async () => {
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: true,
        moved: null
      }
    };
    const commands = scriptedCommands({ moves: [saved] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const base = baseDocument();
    await state.moveMatch(base.matches[0]!.id, base.matches[1]!.id, OPEN_REVISION, NOTHING_ACKNOWLEDGED);

    const call = vi.mocked(commands.moveMatch).mock.calls[0]!;
    expect(call[0]).toEqual(base.matches[0]!.id);
    expect(call[1]).toEqual(base.matches[1]!.id);
    expect(call[2]).toBe('rev-a');
    expect(call[3]).toEqual(NOTHING_ACKNOWLEDGED);
    expect(JSON.stringify(call.slice(0, 4))).not.toContain('force');
  }); // End of the "arguments" case

  it('sends the caller’s own base revision, never the one it is projecting', async () => {
    // **The confirmation pass's second finding.** `createMatch` and `deleteMatch`
    // stopped substituting `view.revision` in the first review round; this method
    // did not, and the record justified the deferral by naming a component caller
    // that does not exist — `DetailPane.svelte` calls only `browser.saveMatch`, and
    // `BrowserState.moveMatch` has no production caller at all. The defect it was
    // left holding is the same one: a move decided against R0 and submitted after
    // the window reprojected to R1 was sent *as though decided at R1*, so the core
    // found no conflict to report and answered an identity failure instead.
    // A refusal, because it is the one answer that changes nothing on this state:
    // what the assertion is about is the argument, not the aftermath.
    const refused: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'refused',
        verdict: 'RefusedForUnacknowledgedSuspicions',
        findings: [suspicion()]
      }
    };
    const commands = scriptedCommands({ moves: [refused] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    const base = baseDocument();
    await state.moveMatch(base.matches[0]!.id, null, 'rev-older', NOTHING_ACKNOWLEDGED);

    // The state really is projecting something else, so this is not the same value
    // arriving by another route.
    expect(state.scopedDocument?.revision).toBe('rev-a');
    expect(vi.mocked(commands.moveMatch).mock.calls[0]![2]).toBe('rev-older');
  }); // End of the "stale move" case

  it('drops what it can no longer vouch for when the adoption itself fails, and says so', async () => {
    // **The second of the three latent shapes 2c-3b inherited, and the first case
    // that could observe it.** The move committed and the re-read failed, so every
    // projection and every identity this state holds for that file was minted from
    // bytes that are gone. Until 2c-3b-1 `adoptTheDocumentOnDisk`'s answer was
    // discarded here and the stale projection stayed installed under a committed
    // move — the window drawing the pre-move order over a file that had been
    // rewritten. They are dropped now, and the failure comes back **beside** the
    // committed outcome rather than in place of it.
    const moved = movedDocument();
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: moved.matches[1]!.id
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, moves: [saved] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    documents.set(2, {
      ok: false,
      failure: { kind: 'command', error: { code: 'unknownDocument', document: 2 } }
    });
    const answer = await state.moveMatch(
      baseDocument().matches[0]!.id,
      null,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    // The move is still a move.
    expect(answer.kind).toBe('answered');
    expect(answer.kind === 'answered' ? answer.result.outcome : null).toBe('saved');
    // And the failure travels with it rather than to the console alone.
    expect(answer.kind === 'answered' ? answer.adoption.kind : null).toBe('failed');
    // Nothing stale is left on screen: no projection of that file, no selection
    // into it, and no held text.
    expect(state.scopedMatches).toEqual([]);
    expect(state.selected).toBeNull();
    expect(state.scopedDocument).toBeNull();
  }); // End of the "failed adoption" case

  it('keeps a mid-flight selection the reorder did not move, and drops one it did', async () => {
    // **The answer to the consult's Q5, measured rather than reasoned about.**
    // `repairAfter` re-resolves **positionally and then checks**, so what a person
    // who selected some other snippet mid-flight gets after a committed move
    // depends entirely on whether the reorder shifted the position they were on:
    // the same fingerprint at the held position is kept, and a different snippet
    // there drops the selection. Both are exercised here, against one file, so
    // the two answers are one comparison.
    //
    // **Both notices are the asked-for-move arms since 2c-3b's fix**: the window
    // reading (`docs/decisions/2c-3b-2-window-reading.md` section 7.1) measured
    // `kept` and `differentMatch` here telling the person their file changed on
    // disk directly above a panel reporting the very write they asked for, so
    // `moveMatch`'s adoption now attributes the reorder to their own move. The
    // *repair* is unchanged — same selection kept, same selection dropped.
    const before = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      matches: [
        makeMatch({ node: 10, document: 2, trigger: ':sig', label: 'Signature' }),
        makeMatch({ node: 11, document: 2, trigger: ':date', label: 'Today' }),
        makeMatch({ node: 12, document: 2, trigger: ':sql', label: 'Query' })
      ]
    });
    // `:sig` moved below `:date`. Position 2 is untouched; position 1 is not.
    const after = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-b',
      matches: [
        makeMatch({ node: 30, document: 2, revision: 'rev-b', trigger: ':date', label: 'Today' }),
        makeMatch({ node: 31, document: 2, revision: 'rev-b', trigger: ':sig', label: 'Signature' }),
        makeMatch({ node: 32, document: 2, revision: 'rev-b', trigger: ':sql', label: 'Query' })
      ]
    });
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: after.matches[1]!.id
      }
    };

    /**
     * Moves `:sig` below `:date` while the person is looking at another snippet.
     *
     * @param position - Which snippet of the pre-move file they had selected.
     * @returns The state, after the move has been answered and adopted.
     */
    async function moveWhileLookingAt(position: number): Promise<ReturnType<typeof createBrowserState>> {
      const documents = new Map<number, CommandResult<DocumentView>>([
        [1, { ok: true, value: profileDocument() }],
        [2, { ok: true, value: before }],
        [3, { ok: true, value: otherDocument() }]
      ]);
      const commands = scriptedCommands({ documents, moves: [saved] });
      const state = createBrowserState(commands, () => undefined);
      await state.open(null);
      state.show({ kind: 'document', id: 2 });
      await state.select(before.matches[position]!);
      documents.set(2, { ok: true, value: after });
      await state.moveMatch(before.matches[0]!.id, before.matches[1]!.id, OPEN_REVISION, NOTHING_ACKNOWLEDGED);
      return state;
    } // End of function moveWhileLookingAt()

    // `:sql` is at position 2 before and after, so it is found and re-pointed under
    // its new identity. The notice names the person's own move, never the disk.
    const untouched = await moveWhileLookingAt(2);
    expect(untouched.selected?.id.node).toBe(32);
    expect(untouched.notice).toBe('keptAfterMove');

    // `:date` was at position 1 and `:sig` is there now, so the selection is
    // dropped (R27 stands). **The snippet is still in the file**, one row above —
    // which is why the notice says so and tells the person to pick it again,
    // rather than reporting an external change that never happened. This closes
    // the hole `docs/decisions/2c-3b-1-notes.md` section 5.2 recorded.
    const shifted = await moveWhileLookingAt(1);
    expect(shifted.selected).toBeNull();
    expect(shifted.notice).toBe('displacedByMove');
    expect(shifted.scopedMatches.map((match) => match.trigger.trigger?.text)).toContain(':date');
  }); // End of the "mid-flight selection" case

  it('keeps the external notice when the re-read is not the parse the move produced', async () => {
    // **The attribution is a claim, and the adoption only makes it against the
    // revision the transaction ended on.** The move committed at `rev-b`, and the
    // re-read finds `rev-elsewhere`: somebody rewrote the file again between the
    // answer and the read, so the reorder on screen is *not* only the move the
    // person asked for. "The move you asked for reordered this file" would be
    // false there — the same defect class as `differentMatch` after an asked-for
    // move, with the two writers swapped — so the repair falls back to the
    // external sentences, which the 2c-3b-2 reading's L4b/L5 launches proved
    // accurate for a genuinely external change.
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: { document: 2, revision: 'rev-b', node: 31 }
      }
    };
    const raced = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-elsewhere',
      matches: [
        makeMatch({
          node: 40,
          document: 2,
          revision: 'rev-elsewhere',
          trigger: ':stranger',
          label: 'Somebody else’s'
        }),
        makeMatch({
          node: 41,
          document: 2,
          revision: 'rev-elsewhere',
          trigger: ':also',
          label: 'Also theirs'
        })
      ]
    });
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, moves: [saved] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    // Parked on `:date`, a snippet the person's own reorder would have shifted —
    // the exact position that answers `displacedByMove` when the re-read *is*
    // the move's parse (the case above).
    await state.select(baseDocument().matches[1]!);

    documents.set(2, { ok: true, value: raced });
    await state.moveMatch(
      baseDocument().matches[0]!.id,
      baseDocument().matches[1]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    // Ordinary repair with the external attribution: the selection is dropped and
    // the notice says the file changed on disk, because it did — over and above
    // the committed move.
    expect(state.scopedDocument?.revision).toBe('rev-elsewhere');
    expect(state.selected).toBeNull();
    expect(state.notice).toBe('differentMatch');
  }); // End of the "re-read from another parse" case

  it('does not follow the move past a selection an identity’s own getter dropped', async () => {
    // **A getter on a `MatchId` — the third level**, one below where the ingress
    // copy stopped before Phase 2d-5-4-B. `positionOf` in `./selection.ts` reads
    // `match.id.node` on every element of the projection it is looking in, and
    // `positionInSameParse` calls it **between the selection-follow guard and the
    // `replaceSelection` that guard justifies**. `CLAUDE.md` names a check and a
    // spend separated by any property read as not atomic, and this is one.
    let fired = false;
    let reads = 0;
    let state: BrowserState | null = null;
    const before = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      matches: [
        makeMatch({ node: 10, document: 2, trigger: ':sig', label: 'Signature' }),
        makeMatch({ node: 11, document: 2, trigger: ':date', label: 'Today' })
      ]
    });
    const shifted = makeMatch({
      node: 30,
      document: 2,
      revision: 'rev-b',
      trigger: ':date',
      label: 'Today'
    });
    const clone = makeMatch({
      node: 31,
      document: 2,
      revision: 'rev-b',
      trigger: ':sig',
      label: 'Signature'
    });
    // The trap sits on the **first** match's identity, so the lookup for the moved
    // snippet has to read it before it finds what it is looking for at index 1.
    // What it does is the person's own *Clear selection*.
    const trap: MatchView = {
      ...shifted,
      id: {
        document: 2,
        revision: 'rev-b',
        get node(): number {
          reads += 1;
          if (!fired) {
            fired = true;
            state?.clearSelection();
          }
          return 30;
        }
      }
    };
    const after = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-b',
      matches: [trap, clone]
    });
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: clone.id
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: before }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, moves: [saved] });
    state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(before.matches[0]!);
    expect(state.selected?.id.node).toBe(10);

    documents.set(2, { ok: true, value: after });
    await state.moveMatch(
      before.matches[0]!.id,
      before.matches[1]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    // The getter fired, so the re-entry really happened, and what it did stands:
    // the person cleared their selection while the adoption was running, and the
    // move does not put one back. Before the identity copy, the guard had already
    // passed when the getter ran, so `replaceSelection` re-pointed the selection at
    // the moved snippet — a selection hijacked after the person had dropped it,
    // which is 2c-3c step 2's High in its third-level form.
    expect(reads).toBeGreaterThan(0);
    expect(state.selected).toBeNull();
    expect(state.selectedMatch).toBeNull();
  }); // End of the identity-getter selection case

  it('keeps no command identity when a repair keeps the selection', async () => {
    // **The one ingress of a `SelectedMatch` that was not normalized** — Phase
    // 2d-5-4-C's finding 1. `repairSelection` calls `reresolve` on the projection
    // `commands.reloadDocument` answered with, and `reresolve` fills the kept
    // selection's `id` from `view.matches[position].id` **by reference**, so what
    // the window went on holding for the rest of the session was the command's own
    // object. It is read as the last conjunct of three selection-follow guards,
    // immediately before the `replaceSelection` each of them justifies.
    let armed = false;
    let fired = 0;
    // The identity of the repaired snippet, as the reload answers it. Pre-fix this
    // exact object ends up in `state.selected`.
    const trapId: MatchId = {
      document: 2,
      revision: 'rev-b',
      get node(): number {
        if (armed) {
          fired += 1;
        }
        return 30;
      }
    };
    const reparsed = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-b',
      matches: [
        {
          ...makeMatch({
            node: 30,
            document: 2,
            revision: 'rev-b',
            trigger: ':sig',
            label: 'Signature'
          }),
          id: trapId
        },
        makeMatch({ node: 31, document: 2, revision: 'rev-b', trigger: ':date', label: 'Today' })
      ]
    });
    // What the committed move leaves on disk: a third revision, and the moved
    // snippet under an identity the save minted.
    const afterMove = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-c',
      matches: [
        makeMatch({ node: 40, document: 2, revision: 'rev-c', trigger: ':date', label: 'Today' }),
        makeMatch({ node: 41, document: 2, revision: 'rev-c', trigger: ':sig', label: 'Signature' })
      ]
    });
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-c',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: { document: 2, revision: 'rev-c', node: 41 }
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({
      documents,
      match: {
        ok: false,
        failure: {
          kind: 'command',
          error: { code: 'identityStaleRevision', expected: 'rev-b', found: 'rev-a' }
        }
      },
      reload: { ok: true, value: reparsed },
      moves: [saved]
    });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(state.scopedMatches[0]!);

    // The `kept` arm really ran, so the ingress this case is about was really
    // reached.
    expect(state.notice).toBe('kept');
    expect(state.selected?.id.node).toBe(30);
    // **The discriminating assertion, and it needs no trap at all**: what the
    // window retains may not be the object the command built.
    expect(state.selected?.id).not.toBe(trapId);

    // Armed only now, so the ingress copy and the repair itself are taken of a
    // truthful answer and only a *retained* read can fire this.
    armed = true;
    documents.set(2, { ok: true, value: afterMove });
    await state.moveMatch(
      { document: 2, revision: 'rev-b', node: 30 },
      { document: 2, revision: 'rev-b', node: 31 },
      'rev-b',
      NOTHING_ACKNOWLEDGED
    );

    // **Nothing the adoption's guard read was a command-supplied accessor.**
    // `isTheSameIdentity` reads `held.document`, `held.revision` and `held.node`
    // on the retained identity, as the guard's last conjunct and after its first
    // two have been answered — so pre-fix this counts at least one firing inside
    // exactly the window `CLAUDE.md` names as not atomic.
    expect(fired).toBe(0);
    // And the move is followed, which is what that guard is for.
    expect(state.selected?.id.node).toBe(41);
    expect(state.notice).toBeNull();
  }); // End of the kept-repair identity case
}); // End of the "moving a snippet" suite

/**
 * The projection after a committed duplicate of `:sig` in {@link baseDocument}.
 *
 * A **new revision and new node identifiers**, because that is what a commit
 * really produces — and one more snippet than before, because that is what a
 * duplicate produces: the clone sits immediately after its source, and every
 * snippet below the source is one position further down.
 *
 * @returns The projection.
 */
function duplicatedDocument(): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision: 'rev-b',
    matches: [
      makeMatch({ node: 30, document: 2, revision: 'rev-b', trigger: ':sig', label: 'Signature' }),
      makeMatch({ node: 31, document: 2, revision: 'rev-b', trigger: ':sig', label: 'Signature' }),
      makeMatch({ node: 32, document: 2, revision: 'rev-b', trigger: ':date', label: 'Today' })
    ]
  });
} // End of function duplicatedDocument()

describe('duplicating a snippet', () => {
  it('re-reads the file, follows the selection to the clone and forgets the text', async () => {
    const grown = duplicatedDocument();
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: true,
        moved: grown.matches[1]!.id
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, duplicates: [saved] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    // The person is parked on the source, which is what lets the selection
    // follow `moved` to the clone (consult Q8): the source is still the
    // selection that initiated the operation.
    await state.select(baseDocument().matches[0]!);
    await state.showFileText(true);
    expect(state.fileText).not.toBeNull();

    documents.set(2, { ok: true, value: grown });
    const outcome = await state.duplicateMatch(
      baseDocument().matches[0]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    expect(outcome).toMatchObject({ kind: 'answered', adoption: { kind: 'done' } });
    expect(outcome.kind === 'answered' ? outcome.result.outcome : null).toBe('saved');
    // The projection the list draws from is the one that was written: one more
    // snippet, the clone directly below its source.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([30, 31, 32]);
    // The selection followed the clone by the identity the command answered
    // with, and no notice was raised for it — the person asked for the copy.
    expect(state.selected?.id.node).toBe(31);
    expect(state.notice).toBeNull();
    // And the raw viewer's snapshot was of bytes that have just been replaced,
    // so it was dropped and read again rather than redrawn.
    expect(commands.documentText).toHaveBeenCalledTimes(2);
    expect(state.fileText).toEqual({ kind: 'text', text: '# text of document 2\n' });
  }); // End of the "committed duplicate" case

  it('shows the findings of a refusal and writes nothing', async () => {
    // **The ordinary first answer of this command**: a byte-exact copy keeps
    // its source's trigger definition, and the transaction says so before
    // anything is written.
    const refused: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'refused',
        verdict: 'RefusedForUnacknowledgedSuspicions',
        findings: [suspicion()]
      }
    };
    const commands = scriptedCommands({ duplicates: [refused] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    const outcome = await state.duplicateMatch(
      baseDocument().matches[0]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    expect(outcome).toEqual({
      kind: 'answered',
      result: refused.ok ? refused.value : null,
      adoption: { kind: 'notOwed' }
    });
    // Nothing was written, so nothing here moved: same projection, same
    // selection, and no second read of the document.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11]);
    expect(state.selected?.id.node).toBe(10);
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
  }); // End of the "refused duplicate" case

  it('sends back exactly the findings a refusal carried, and no flag', async () => {
    const shown = suspicion();
    const refused: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'refused',
        verdict: 'RefusedForUnacknowledgedSuspicions',
        findings: [shown]
      }
    };
    const grown = duplicatedDocument();
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: grown.matches[1]!.id
      }
    };
    const commands = scriptedCommands({ duplicates: [refused, saved] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const first = await state.duplicateMatch(
      baseDocument().matches[0]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );
    const firstResult = first.kind === 'answered' ? first.result : null;
    expect(firstResult?.outcome).toBe('refused');
    const findings = firstResult?.outcome === 'refused' ? firstResult.findings : [];
    await state.duplicateMatch(baseDocument().matches[0]!.id, OPEN_REVISION, {
      accepted: findings
    });

    // The second call carried the findings back by content, unchanged. There is
    // no boolean anywhere in either call.
    const calls = vi.mocked(commands.duplicateMatch).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]![2]).toEqual({ accepted: [] });
    expect(calls[1]![2]).toEqual({ accepted: [shown] });
    expect(JSON.stringify(calls[1])).not.toContain('force');
  }); // End of the "acknowledgement round trip" case

  it('takes the conflict projection as the one the next save is checked against', async () => {
    const disk = duplicatedDocument();
    const conflict: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'conflict',
        reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
        expected: 'rev-a',
        found: 'rev-b',
        disk_revision: 'rev-b',
        disk_text: DISK_TEXT,
        disk
      }
    };
    const commands = scriptedCommands({ duplicates: [conflict] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    const outcome = await state.duplicateMatch(
      baseDocument().matches[0]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    // The adoption stays `notOwed` — nothing was written, nothing was re-read
    // and, since 2c-4a-2, nothing was replaced either, which is why
    // `applyDuplication` no longer derives the session's invalidation from the arm.
    expect(outcome).toMatchObject({ kind: 'answered', adoption: { kind: 'notOwed' } });
    expect(outcome.kind === 'answered' ? outcome.result.outcome : null).toBe('conflict');
    // **The disk side is carried, not installed** (consult Q2). Until 2c-4a-2 this
    // case asserted the clone's projection here, for a duplicate that wrote nothing.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11]);
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
    expect(state.selected?.id.node).toBe(10);
    expect(state.notice).toBeNull();
  }); // End of the "conflict" case

  it('reports a failed save and changes nothing on the screen', async () => {
    // The fixture fails **at the rename**, which means the rename did not
    // happen: `may_have_written` is `false`, so nothing this window shows of
    // the file has been invalidated.
    const failure: IpcFailure = {
      kind: 'command',
      error: {
        code: 'saveFailed',
        error: {
          Write: {
            Io: {
              step: 'Rename',
              path: '/tmp/espanso/match/base.yml',
              kind: 'PermissionDenied',
              raw_os_error: 13
            }
          }
        },
        may_have_written: false
      }
    };
    const reported: IpcFailure[] = [];
    const commands = scriptedCommands({ duplicates: [{ ok: false, failure }] });
    const state = createBrowserState(commands, (next) => reported.push(next));
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    const outcome = await state.duplicateMatch(
      baseDocument().matches[0]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    expect(outcome).toEqual({ kind: 'failed', mayHaveWritten: false, failure });
    expect(reported).toEqual([failure]);
    expect(state.status).toBe('ready');
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11]);
    // Nothing was written, so nothing was re-read.
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
  }); // End of the "failed save" case

  it('re-reads cautiously when the rename may have completed, asserting nothing', async () => {
    // **The consult's Q8: a `may_have_written` failure attempts the cautious
    // re-read without asserting that the duplicate exists.** The adoption is
    // given no target and no `moved`, so nothing is selected on the clone's
    // account and the repair keeps the **external** sentences — an uncertain
    // write cannot claim the copy, and the sentence that claims less wins.
    const grown = duplicatedDocument();
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const reported: IpcFailure[] = [];
    const commands = scriptedCommands({ documents, duplicates: [WRITE_MAY_HAVE_HAPPENED] });
    const state = createBrowserState(commands, (next) => reported.push(next));
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    // Parked on `:date`, below the source: if the write did land, this
    // position now holds the clone.
    await state.select(baseDocument().matches[1]!);

    documents.set(2, { ok: true, value: grown });
    const outcome = await state.duplicateMatch(
      baseDocument().matches[0]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    expect(outcome).toEqual({
      kind: 'failed',
      mayHaveWritten: true,
      failure: WRITE_MAY_HAVE_HAPPENED.ok ? null : WRITE_MAY_HAVE_HAPPENED.failure
    });
    // The screen now describes the file as it may now be.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([30, 31, 32]);
    expect(commands.getDocument).toHaveBeenCalledTimes(4);
    // The selection's position now holds the clone, and the notice is the
    // external one — never `displacedByDuplicate`, which would assert the copy
    // this application cannot account for.
    expect(state.selected).toBeNull();
    expect(state.notice).toBe('differentMatch');
  }); // End of the "may have written" case

  it('leaves the screen alone when a save commits nothing', async () => {
    // `committed: false` is a documented success and is practically
    // unreachable for an insertion; the arm is exercised because the wrapper
    // carries it rather than hoping about it.
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-a',
        committed: false,
        notes: [],
        backup_taken: false,
        moved: null
      }
    };
    const commands = scriptedCommands({ duplicates: [saved] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    const outcome = await state.duplicateMatch(
      baseDocument().matches[0]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    expect(outcome).toMatchObject({ kind: 'answered', adoption: { kind: 'notOwed' } });
    expect(state.selected?.id.node).toBe(10);
    expect(state.notice).toBeNull();
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
  }); // End of the "committed: false" case

  it('refuses a snippet whose document this state does not hold', async () => {
    const commands = scriptedCommands();
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const stranger = makeMatch({ node: 99, document: 9, trigger: ':nowhere' });
    expect(
      await state.duplicateMatch(stranger.id, OPEN_REVISION, NOTHING_ACKNOWLEDGED)
    ).toEqual({ kind: 'notAttempted' });
    expect(commands.duplicateMatch).not.toHaveBeenCalled();
  }); // End of the "unknown document" case

  it('sends the identity, the base revision and the acknowledgement, and no flag', async () => {
    const commands = scriptedCommands({ duplicates: [{ ok: true, value: CREATED_NOTHING }] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const base = baseDocument();
    await state.duplicateMatch(base.matches[0]!.id, OPEN_REVISION, NOTHING_ACKNOWLEDGED);

    const call = vi.mocked(commands.duplicateMatch).mock.calls[0]!;
    expect(call[0]).toEqual(base.matches[0]!.id);
    expect(call[1]).toBe('rev-a');
    expect(call[2]).toEqual(NOTHING_ACKNOWLEDGED);
    expect(JSON.stringify(call.slice(0, 3))).not.toContain('force');
  }); // End of the "arguments" case

  it('sends the caller’s own base revision, never the one it is projecting', async () => {
    const refused: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'refused',
        verdict: 'RefusedForUnacknowledgedSuspicions',
        findings: [suspicion()]
      }
    };
    const commands = scriptedCommands({ duplicates: [refused] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    await state.duplicateMatch(baseDocument().matches[0]!.id, 'rev-older', NOTHING_ACKNOWLEDGED);

    // The state really is projecting something else, so this is not the same
    // value arriving by another route.
    expect(state.scopedDocument?.revision).toBe('rev-a');
    expect(vi.mocked(commands.duplicateMatch).mock.calls[0]![1]).toBe('rev-older');
  }); // End of the "stale duplicate" case

  it('drops what it can no longer vouch for when the adoption itself fails, and says so', async () => {
    const grown = duplicatedDocument();
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: grown.matches[1]!.id
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, duplicates: [saved] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    documents.set(2, {
      ok: false,
      failure: { kind: 'command', error: { code: 'unknownDocument', document: 2 } }
    });
    const answer = await state.duplicateMatch(
      baseDocument().matches[0]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    // The duplicate is still a duplicate: the outcome stays `Saved`, and the
    // failure travels beside it rather than in place of it (`PROGRESS.md` D2).
    expect(answer.kind).toBe('answered');
    expect(answer.kind === 'answered' ? answer.result.outcome : null).toBe('saved');
    expect(answer.kind === 'answered' ? answer.adoption.kind : null).toBe('failed');
    // Nothing stale is left on screen: no projection of that file, no
    // selection into it — dropped through `forgetTheReplacedDocument`.
    expect(state.scopedMatches).toEqual([]);
    expect(state.selected).toBeNull();
    expect(state.scopedDocument).toBeNull();
  }); // End of the "failed adoption" case

  it('keeps a mid-flight selection the insertion did not shift, and drops one it did', async () => {
    // `repairAfter` re-resolves positionally and then checks, so what a person
    // who selected some other snippet mid-flight gets after a committed
    // duplicate depends on whether the insertion shifted the position they
    // were on: positions above the clone keep the same snippet, and every
    // position below the source now holds its former neighbour. Both notices
    // are the duplicate's own arms — the external sentences would tell the
    // person their file changed on disk directly above a panel reporting the
    // very copy they asked for, the defect class 2c-3b's window reading
    // measured for a move.
    const before = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      matches: [
        makeMatch({ node: 10, document: 2, trigger: ':sig', label: 'Signature' }),
        makeMatch({ node: 11, document: 2, trigger: ':date', label: 'Today' }),
        makeMatch({ node: 12, document: 2, trigger: ':sql', label: 'Query' })
      ]
    });

    /**
     * Duplicates one snippet while the person is looking at another.
     *
     * @param source - Which snippet of the pre-save file is copied.
     * @param cloneIndex - Where the clone lands in the fresh projection.
     * @param after - The projection the commit produced.
     * @param position - Which snippet of the pre-save file they had selected.
     * @returns The state, after the duplicate has been answered and adopted.
     */
    async function duplicateWhileLookingAt(
      source: number,
      cloneIndex: number,
      after: DocumentView,
      position: number
    ): Promise<ReturnType<typeof createBrowserState>> {
      const saved: CommandResult<SaveResult> = {
        ok: true,
        value: {
          outcome: 'saved',
          revision: 'rev-b',
          committed: true,
          notes: [],
          backup_taken: false,
          moved: after.matches[cloneIndex]!.id
        }
      };
      const documents = new Map<number, CommandResult<DocumentView>>([
        [1, { ok: true, value: profileDocument() }],
        [2, { ok: true, value: before }],
        [3, { ok: true, value: otherDocument() }]
      ]);
      const commands = scriptedCommands({ documents, duplicates: [saved] });
      const state = createBrowserState(commands, () => undefined);
      await state.open(null);
      state.show({ kind: 'document', id: 2 });
      await state.select(before.matches[position]!);
      documents.set(2, { ok: true, value: after });
      await state.duplicateMatch(
        before.matches[source]!.id,
        OPEN_REVISION,
        NOTHING_ACKNOWLEDGED
      );
      return state;
    } // End of function duplicateWhileLookingAt()

    // `:sql` (last) duplicated while `:sig` at position 0 is selected: nothing
    // above the clone moved, so the selection is kept under its new identity
    // and the notice names the person's own copy.
    const grownAtEnd = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-b',
      matches: [
        makeMatch({ node: 30, document: 2, revision: 'rev-b', trigger: ':sig', label: 'Signature' }),
        makeMatch({ node: 31, document: 2, revision: 'rev-b', trigger: ':date', label: 'Today' }),
        makeMatch({ node: 32, document: 2, revision: 'rev-b', trigger: ':sql', label: 'Query' }),
        makeMatch({ node: 33, document: 2, revision: 'rev-b', trigger: ':sql', label: 'Query' })
      ]
    });
    const untouched = await duplicateWhileLookingAt(2, 3, grownAtEnd, 0);
    expect(untouched.selected?.id.node).toBe(30);
    expect(untouched.notice).toBe('keptAfterDuplicate');

    // `:sig` (first) duplicated while `:date` at position 1 is selected: the
    // insertion shifted every later position down one, so position 1 now holds
    // the clone and the selection is dropped (R27 stands) — with the notice
    // naming the person's own copy, and the snippet still in the file one row
    // below.
    const grownAtFront = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-b',
      matches: [
        makeMatch({ node: 30, document: 2, revision: 'rev-b', trigger: ':sig', label: 'Signature' }),
        makeMatch({ node: 31, document: 2, revision: 'rev-b', trigger: ':sig', label: 'Signature' }),
        makeMatch({ node: 32, document: 2, revision: 'rev-b', trigger: ':date', label: 'Today' }),
        makeMatch({ node: 33, document: 2, revision: 'rev-b', trigger: ':sql', label: 'Query' })
      ]
    });
    const shifted = await duplicateWhileLookingAt(0, 1, grownAtFront, 1);
    expect(shifted.selected).toBeNull();
    expect(shifted.notice).toBe('displacedByDuplicate');
    expect(shifted.scopedMatches.map((match) => match.trigger.trigger?.text)).toContain(':date');
  }); // End of the "mid-flight selection" case

  it('keeps the external notice when the re-read is not the parse the duplicate produced', async () => {
    // The attribution is a claim, and the adoption only makes it against the
    // revision the transaction ended on: a re-read that finds any other
    // revision found a file that changed *again* after the commit, so "the
    // copy you asked for grew this file" would be false there and the repair
    // falls back to the external sentences.
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: { document: 2, revision: 'rev-b', node: 31 }
      }
    };
    const raced = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-elsewhere',
      matches: [
        makeMatch({
          node: 40,
          document: 2,
          revision: 'rev-elsewhere',
          trigger: ':stranger',
          label: 'Somebody else’s'
        }),
        makeMatch({
          node: 41,
          document: 2,
          revision: 'rev-elsewhere',
          trigger: ':also',
          label: 'Also theirs'
        })
      ]
    });
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, duplicates: [saved] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    // Parked on `:date`, the position a real duplicate of `:sig` would shift —
    // the exact spot that answers `displacedByDuplicate` when the re-read *is*
    // the duplicate's parse.
    await state.select(baseDocument().matches[1]!);

    documents.set(2, { ok: true, value: raced });
    await state.duplicateMatch(
      baseDocument().matches[0]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    expect(state.scopedDocument?.revision).toBe('rev-elsewhere');
    expect(state.selected).toBeNull();
    expect(state.notice).toBe('differentMatch');
  }); // End of the "re-read from another parse" case

  it('does not drag the selection away from a snippet clicked in another file mid-flight', async () => {
    // **The two-document selection race.** The person picks a snippet of file
    // 3 while a duplicate in file 2 is being written; the commit's adoption
    // must not reclaim the selection for the clone, because the source is no
    // longer the selection that initiated the operation.
    const grown = duplicatedDocument();
    const saved: SaveResult = {
      outcome: 'saved',
      revision: 'rev-b',
      committed: true,
      notes: [],
      backup_taken: false,
      moved: grown.matches[1]!.id
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const gate = deferred<CommandResult<SaveResult>>();
    const commands: BrowserCommands = {
      ...scriptedCommands({ documents }),
      duplicateMatch: vi.fn(async () => gate.promise)
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    // The duplicate is decided while the source is selected…
    await state.select(baseDocument().matches[0]!);
    const pending = state.duplicateMatch(
      baseDocument().matches[0]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );
    // …and the person picks a snippet of another file while it is in flight.
    await state.select(otherDocument().matches[0]!);
    documents.set(2, { ok: true, value: grown });
    gate.resolve({ ok: true, value: saved });
    await pending;

    // The selection stays where the person put it, in file 3, and no repair
    // touched it: file 2's repair is about file 2's selection, and there is
    // none.
    expect(state.selected?.document).toBe(3);
    expect(state.selected?.id.node).toBe(20);
  }); // End of the "selection moved to another file mid-flight" case

  it('drops a selection lookup in flight when a duplicate adopts', async () => {
    // The per-document projection counter, driven through a duplicate: a
    // `select()` awaiting `get_match` lands after the commit's adoption has
    // followed the clone, and its stale answer must be dropped whole rather
    // than repaired — repairing it would drag the person off the clone with a
    // notice about a file that moved under them, when what happened is the
    // copy they asked for.
    const grown = duplicatedDocument();
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: grown.matches[1]!.id
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const lookup = deferred<CommandResult<MatchView>>();
    const commands: BrowserCommands = {
      ...scriptedCommands({ documents, duplicates: [saved] }),
      getMatch: vi.fn(() => lookup.promise)
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    // Selected, and still being checked across the boundary when the
    // duplicate lands.
    const selecting = state.select(baseDocument().matches[0]!);
    documents.set(2, { ok: true, value: grown });
    await state.duplicateMatch(
      baseDocument().matches[0]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );
    expect(state.selected?.id.node).toBe(31);

    lookup.resolve({
      ok: false,
      failure: {
        kind: 'command',
        error: { code: 'identityStaleRevision', expected: 'rev-b', found: 'rev-a' }
      }
    });
    await selecting;

    // The stale answer describes a parse this window has replaced, so it is
    // dropped whole: the person keeps the clone.
    expect(state.selected?.id.node).toBe(31);
    expect(state.notice).toBeNull();
    expect(commands.reloadDocument).not.toHaveBeenCalled();
  }); // End of the "lookup in flight during a duplicate" case

  it('does not reclaim a selection made on the source while the duplicate was in flight', async () => {
    // **Review round 1's High finding, first history.** The duplicate starts
    // while another snippet is selected; the person selects the source before
    // the answer lands. The current selection now *equals* the source, so a
    // wrapper that compared the current selection would follow `moved` to the
    // clone — but that selection is a new intent, expressed mid-flight, and
    // the clone must not hijack it. The initiating selection was not the
    // source, so the ordinary repair runs: same fingerprint at position 0,
    // kept under its new identity, with the person's own copy named.
    const grown = duplicatedDocument();
    const saved: SaveResult = {
      outcome: 'saved',
      revision: 'rev-b',
      committed: true,
      notes: [],
      backup_taken: false,
      moved: grown.matches[1]!.id
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const gate = deferred<CommandResult<SaveResult>>();
    const commands: BrowserCommands = {
      ...scriptedCommands({ documents }),
      duplicateMatch: vi.fn(async () => gate.promise)
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    // The initiating selection is `:date`, not the source.
    await state.select(baseDocument().matches[1]!);
    const pending = state.duplicateMatch(
      baseDocument().matches[0]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );
    // The person selects the source while the duplicate is in flight.
    await state.select(baseDocument().matches[0]!);
    expect(state.selected?.id.node).toBe(10);
    documents.set(2, { ok: true, value: grown });
    gate.resolve({ ok: true, value: saved });
    await pending;

    // Not the clone: the mid-flight selection of the source is a new intent,
    // repaired in place rather than redirected.
    expect(state.selected?.id.node).toBe(30);
    expect(state.selected?.id.node).not.toBe(31);
    expect(state.notice).toBe('keptAfterDuplicate');
  }); // End of the "selected the source mid-flight" case

  it('does not reclaim the source after the person left it and returned mid-flight', async () => {
    // **Review round 1's High finding, second history.** The duplicate starts
    // on the source; the person moves to another snippet and comes back to the
    // source before the answer lands. The current selection equals the source
    // again — and it is a *different* selection, expressed after two clicks
    // this window must not undo. The captured object and the intent counter
    // are what tell it apart from an unchanged initiating selection.
    const grown = duplicatedDocument();
    const saved: SaveResult = {
      outcome: 'saved',
      revision: 'rev-b',
      committed: true,
      notes: [],
      backup_taken: false,
      moved: grown.matches[1]!.id
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const gate = deferred<CommandResult<SaveResult>>();
    const commands: BrowserCommands = {
      ...scriptedCommands({ documents }),
      duplicateMatch: vi.fn(async () => gate.promise)
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    // The initiating selection is the source…
    await state.select(baseDocument().matches[0]!);
    const pending = state.duplicateMatch(
      baseDocument().matches[0]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );
    // …and the person leaves it and returns while the duplicate is in flight.
    await state.select(baseDocument().matches[1]!);
    await state.select(baseDocument().matches[0]!);
    expect(state.selected?.id.node).toBe(10);
    documents.set(2, { ok: true, value: grown });
    gate.resolve({ ok: true, value: saved });
    await pending;

    // Not the clone: leaving and returning is two intents, not none.
    expect(state.selected?.id.node).toBe(30);
    expect(state.selected?.id.node).not.toBe(31);
    expect(state.notice).toBe('keptAfterDuplicate');
  }); // End of the "left the source and returned" case

  it('does not reclaim the source when the person leaves and returns during the adoption re-read', async () => {
    // **The confirmation pass's High finding, its exact history.** The command
    // has already answered; what is deferred is the **adoption's own
    // `getDocument`**. The first fix validated the capture between the two
    // awaits and reduced it to a target identity, so a leave-and-return landing
    // in this window was still reclaimed — the helper compared only the
    // current selection's identity against the source. The capture now travels
    // whole and is re-validated after this very await, in the same synchronous
    // block that writes the selection.
    const grown = duplicatedDocument();
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: grown.matches[1]!.id
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const scripted = scriptedCommands({ documents, duplicates: [saved] });
    // The adoption's re-read is the deferred call, and the test proves it
    // drove that await rather than assuming it: the wrapper resolves
    // `adoptionStarted` at the moment the deferred read is requested, and the
    // mid-flight clicks happen strictly after that.
    let deferAdoption = false;
    let adoptionRequested: (() => void) | null = null;
    const adoptionStarted = new Promise<void>((resolve) => {
      adoptionRequested = resolve;
    });
    const adoptionGate = deferred<CommandResult<DocumentView>>();
    const commands: BrowserCommands = {
      ...scripted,
      getDocument: vi.fn(async (id: number) => {
        if (deferAdoption && id === 2) {
          deferAdoption = false;
          adoptionRequested?.();
          return adoptionGate.promise;
        }
        return scripted.getDocument(id);
      })
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    // The initiating selection is the source, and it is still held when the
    // command answers — the pre-command capture alone would follow the clone.
    await state.select(baseDocument().matches[0]!);
    deferAdoption = true;
    const pending = state.duplicateMatch(
      baseDocument().matches[0]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );
    await adoptionStarted;
    // The person leaves the source and returns to it **while the adoption's
    // re-read is in flight** — two intents this window must not undo.
    await state.select(baseDocument().matches[1]!);
    await state.select(baseDocument().matches[0]!);
    expect(state.selected?.id.node).toBe(10);
    adoptionGate.resolve({ ok: true, value: grown });
    const outcome = await pending;

    expect(outcome).toMatchObject({ kind: 'answered', adoption: { kind: 'done' } });
    // Not the clone: the selection is repaired in place under its new identity.
    expect(state.selected?.id.node).toBe(30);
    expect(state.selected?.id.node).not.toBe(31);
    expect(state.notice).toBe('keptAfterDuplicate');
  }); // End of the "left and returned during the adoption re-read" case

  it('does not follow the clone when a failed selection expressed an intent mid-adoption', async () => {
    // **The generation half of the capture, isolated.** A `select()` on a row
    // this state cannot resolve bumps the global `selectGeneration` at entry
    // and then returns without replacing the held object — so the reference
    // half of the guard still matches and only the generation can refuse. The
    // person expressed an intent; the clone must not be selected on the back
    // of it, however the attempt ended.
    const grown = duplicatedDocument();
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: grown.matches[1]!.id
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const scripted = scriptedCommands({ documents, duplicates: [saved] });
    let deferAdoption = false;
    let adoptionRequested: (() => void) | null = null;
    const adoptionStarted = new Promise<void>((resolve) => {
      adoptionRequested = resolve;
    });
    const adoptionGate = deferred<CommandResult<DocumentView>>();
    const commands: BrowserCommands = {
      ...scripted,
      getDocument: vi.fn(async (id: number) => {
        if (deferAdoption && id === 2) {
          deferAdoption = false;
          adoptionRequested?.();
          return adoptionGate.promise;
        }
        return scripted.getDocument(id);
      })
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);
    const heldThroughout = state.selected;
    deferAdoption = true;
    const pending = state.duplicateMatch(
      baseDocument().matches[0]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );
    await adoptionStarted;
    // A click this state cannot resolve: the intent counter moves, the held
    // object does not — the premise is asserted, not assumed.
    await state.select(makeMatch({ node: 99, document: 9, trigger: ':nowhere' }));
    expect(state.selected).toBe(heldThroughout);
    adoptionGate.resolve({ ok: true, value: grown });
    await pending;

    // Not the clone: the expressed intent refuses the follow, and the ordinary
    // repair re-points the still-held source under its new identity.
    expect(state.selected?.id.node).toBe(30);
    expect(state.selected?.id.node).not.toBe(31);
    expect(state.notice).toBe('keptAfterDuplicate');
  }); // End of the "failed selection intent mid-adoption" case

  it('stays a success and asserts no second writer when the clone is not identified', async () => {
    // **Review round 1's Medium, driven at the wrapper.** A committed answer
    // with `moved: null` means only that the clone could not be identified in
    // the read that followed the write — here the wrapper's own re-read then
    // succeeds at the transaction's **own** revision, so no second writer
    // exists at all, and nothing on this state may attribute the missing
    // identity to one. With no identity to follow, the repair runs with the
    // no-vouch fallback: the external `kept`, which claims less than
    // `keptAfterDuplicate` — the attribution's voucher is `moved`'s revision,
    // and a `null` vouches for nothing.
    const grown = duplicatedDocument();
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: null
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, duplicates: [saved] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    documents.set(2, { ok: true, value: grown });
    const outcome = await state.duplicateMatch(
      baseDocument().matches[0]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    // A success with a completed adoption — never a failure, and never a claim
    // about a second change.
    expect(outcome).toMatchObject({ kind: 'answered', adoption: { kind: 'done' } });
    expect(outcome.kind === 'answered' ? outcome.result.outcome : null).toBe('saved');
    // The selection is repaired in place under its new identity; nothing
    // follows a clone nobody identified.
    expect(state.selected?.id.node).toBe(30);
    expect(state.notice).toBe('kept');
  }); // End of the "clone not identified" case
}); // End of the "duplicating a snippet" suite

/**
 * A draft that changes one field and says *leave this alone* about every other.
 *
 * Written out rather than built, because `MatchDraft` has no optional property
 * and a helper that filled the gaps would be hiding exactly the thing the type is
 * arranged to expose.
 *
 * @returns The draft.
 */
function editedDraft(): MatchDraft {
  return {
    trigger: 'Unchanged',
    regex: 'Unchanged',
    replace: { Set: 'a new body' },
    markdown: 'Unchanged',
    html: 'Unchanged',
    image_path: 'Unchanged',
    form: 'Unchanged',
    label: 'Unchanged',
    comment: 'Unchanged',
    word: 'Unchanged',
    left_word: 'Unchanged',
    right_word: 'Unchanged',
    propagate_case: 'Unchanged',
    uppercase_style: 'Unchanged',
    force_mode: 'Unchanged',
    force_clipboard: 'Unchanged',
    paragraph: 'Unchanged',
    anchor: 'Unchanged',
    triggers: [],
    search_terms: [],
    vars: [],
    form_fields: [],
    content_switch: null,
    trigger_form: null,
    sequences: [],
    var_intents: []
  };
} // End of function editedDraft()

describe('saving one snippet’s fields', () => {
  it('adopts the identity the commit answered with, and re-reads the file', async () => {
    // **The consult's Q6, driven.** A caller cannot obtain this result without the
    // adoption, because the adoption happens inside the wrapper: the selection
    // follows `moved` rather than staying at the position it used to occupy, and
    // the raw viewer's snapshot of the replaced bytes is dropped and read again.
    const edited = movedDocument();
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: edited.matches[1]!.id
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, saves: [saved] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);
    await state.showFileText(true);

    documents.set(2, { ok: true, value: edited });
    const answer = await state.saveMatch(
      baseDocument().matches[0]!.id,
      editedDraft(),
      'rev-a',
      NOTHING_ACKNOWLEDGED
    );

    expect(answer).toMatchObject({ kind: 'answered', adoption: { kind: 'done' } });
    expect(answer.kind === 'answered' ? answer.result.outcome : null).toBe('saved');
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([30, 31]);
    expect(state.selected?.id.node).toBe(31);
    expect(state.notice).toBeNull();
    expect(commands.documentText).toHaveBeenCalledTimes(2);
  }); // End of the "committed field save" case

  it.each(['getDocument', 'documentText'] as const)(
    'answers a committed field save as saved when the %s that follows it throws',
    async (thrower) => {
      // **Phase 2d-6-6c-1's notes, section 4 item 7**, the shape that review's
      // first finding fixed in `createMatch`. The transaction committed and the
      // barrier was told so; then a read this window makes afterwards threw.
      // Rejecting here lets the editor draw a committed write as an unsuccessful
      // save — a committed write reported afterwards as an error (D2).
      const saved: CommandResult<SaveResult> = {
        ok: true,
        value: {
          outcome: 'saved',
          revision: 'rev-b',
          committed: true,
          notes: [],
          backup_taken: false,
          moved: movedDocument().matches[1]!.id
        }
      };
      const commands = scriptedCommands({ saves: [saved] });
      const state = createBrowserState(commands, () => undefined);
      await state.open(null);
      state.show({ kind: 'document', id: 2 });
      await state.select(baseDocument().matches[0]!);
      await state.showFileText(true);

      vi.mocked(commands[thrower]).mockImplementation(async () => {
        throw new Error('the read after the commit threw');
      });
      const answer = await state.saveMatch(
        baseDocument().matches[0]!.id,
        editedDraft(),
        'rev-a',
        NOTHING_ACKNOWLEDGED
      );

      expect(answer).toMatchObject({ kind: 'answered', adoption: { kind: 'failed' } });
      expect(answer.kind === 'answered' ? answer.result.outcome : null).toBe('saved');
    }
  ); // End of the "post-commit throw" case

  it.each([
    ['the adoption', 'getDocument'],
    ['the re-read', 'documentText']
  ] as const)(
    'answers a committed field save as saved when %s throws a value whose classification throws',
    async (_step, thrower) => {
      // **Phase 2d-6-6c-2's review, the one blocker.** The catch that answers a
      // post-commit exception classified it with `classifyFailure`, which reads
      // `code` off the thrown value — so a `code` getter that throws escaped the
      // catch, and the committed save was rejected after all (D2).
      const saved: CommandResult<SaveResult> = {
        ok: true,
        value: {
          outcome: 'saved',
          revision: 'rev-b',
          committed: true,
          notes: [],
          backup_taken: false,
          moved: movedDocument().matches[1]!.id
        }
      };
      const commands = scriptedCommands({ saves: [saved] });
      const state = createBrowserState(commands, () => undefined);
      await state.open(null);
      state.show({ kind: 'document', id: 2 });
      await state.select(baseDocument().matches[0]!);
      await state.showFileText(true);

      const hostile = Object.defineProperty({}, 'code', {
        get: (): never => {
          throw new Error('the code getter threw');
        }
      });
      vi.mocked(commands[thrower]).mockImplementation(async () => {
        throw hostile;
      });
      const answer = await state.saveMatch(
        baseDocument().matches[0]!.id,
        editedDraft(),
        'rev-a',
        NOTHING_ACKNOWLEDGED
      );

      expect(answer).toMatchObject({ kind: 'answered', adoption: { kind: 'failed' } });
      expect(answer.kind === 'answered' ? answer.result.outcome : null).toBe('saved');
    }
  ); // End of the "post-commit hostile throw" case

  it('does not resolve the saved identity in a projection of another parse', async () => {
    // The same defect as the create's, in the adoption `saveMatch` and `moveMatch`
    // share: `moved` names a snippet in the revision the transaction ended on, and
    // the re-read is a separate command that can find a file somebody else has
    // rewritten. Comparing the node alone re-points the selection at whatever now
    // occupies that arena slot.
    const raced = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-elsewhere',
      matches: [
        makeMatch({
          node: 31,
          document: 2,
          revision: 'rev-elsewhere',
          trigger: ':stranger',
          label: 'Somebody else’s'
        }),
        makeMatch({
          node: 32,
          document: 2,
          revision: 'rev-elsewhere',
          trigger: ':also',
          label: 'Also theirs'
        })
      ]
    });
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: { document: 2, revision: 'rev-b', node: 31 }
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, saves: [saved] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    documents.set(2, { ok: true, value: raced });
    await state.saveMatch(
      baseDocument().matches[0]!.id,
      editedDraft(),
      'rev-a',
      NOTHING_ACKNOWLEDGED
    );

    // Ordinary repair (R27) rather than adoption of an identity this projection is
    // not a parse of.
    expect(state.selected).toBeNull();
    expect(state.notice).toBe('differentMatch');
  }); // End of the "moved from another parse" case

  it('sends the identity, the base revision, the draft and the acknowledgement', async () => {
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-a',
        committed: false,
        notes: [],
        backup_taken: false,
        moved: null
      }
    };
    const commands = scriptedCommands({ saves: [saved] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const draft = editedDraft();
    await state.saveMatch(baseDocument().matches[0]!.id, draft, 'rev-a', NOTHING_ACKNOWLEDGED);

    const call = vi.mocked(commands.saveMatch).mock.calls[0]!;
    expect(call[0]).toEqual(baseDocument().matches[0]!.id);
    expect(call[1]).toBe(draft);
    expect(call[2]).toBe('rev-a');
    expect(call[3]).toEqual(NOTHING_ACKNOWLEDGED);
    // Nothing was written and the revision did not move, so nothing was re-read.
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
  }); // End of the "arguments" case

  it('sends the draft’s own base revision, never the one it is projecting', async () => {
    // **The last of the four**, closed at 2c-3a-2 because it is the only one with a
    // component caller: `MatchEditor.svelte` now hands over
    // `matchEditor.baseRevisionOf(session)` and this method forwards it. Until
    // then an editor opened at R0 over a window that had since reprojected to R1
    // was submitted *as though drafted at R1*, so the core found no conflict to
    // report and could commit into a parse the person never saw.
    // A refusal, because it is the one answer that changes nothing on this state:
    // what the assertion is about is the argument, not the aftermath.
    const refused: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'refused',
        verdict: 'RefusedForUnacknowledgedSuspicions',
        findings: [suspicion()]
      }
    };
    const commands = scriptedCommands({ saves: [refused] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    await state.saveMatch(
      baseDocument().matches[0]!.id,
      editedDraft(),
      'rev-older',
      NOTHING_ACKNOWLEDGED
    );

    // The state really is projecting something else, so this is not the same value
    // arriving by another route.
    expect(state.scopedDocument?.revision).toBe('rev-a');
    expect(vi.mocked(commands.saveMatch).mock.calls[0]![2]).toBe('rev-older');
  }); // End of the "stale field save" case

  it('refuses to send anything for a document this state does not describe', async () => {
    const commands = scriptedCommands();
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const stranger = makeMatch({ node: 99, document: 99 }).id;
    // **Its own arm, carrying nothing.** No command ran, so there is neither a
    // rejection to hand on nor a `mayHaveWritten` to weigh — and after the 2c-2-2
    // review the type says that rather than a comment claiming it beside an
    // `IpcFailure | null` that could have been `null` for any reason at all.
    expect(await state.saveMatch(stranger, editedDraft(), 'rev-a', NOTHING_ACKNOWLEDGED)).toEqual({
      kind: 'notAttempted'
    });
    expect(commands.saveMatch).not.toHaveBeenCalled();
  });

  it('shows the findings of a refusal and changes nothing here', async () => {
    const refused: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'refused',
        verdict: 'RefusedForUnacknowledgedSuspicions',
        findings: [suspicion()]
      }
    };
    const commands = scriptedCommands({ saves: [refused] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    const answer = await state.saveMatch(
      baseDocument().matches[0]!.id,
      editedDraft(),
      'rev-a',
      NOTHING_ACKNOWLEDGED
    );

    expect(answer).toMatchObject({ kind: 'answered', adoption: { kind: 'notOwed' } });
    expect(answer.kind === 'answered' ? answer.result.outcome : null).toBe('refused');
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11]);
    expect(state.selected?.id.node).toBe(10);
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
  }); // End of the "refused field save" case

  it('carries the disk projection a conflict handed back, and installs nothing', async () => {
    const disk = movedDocument();
    const conflict: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'conflict',
        reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
        expected: 'rev-a',
        found: 'rev-b',
        disk_revision: 'rev-b',
        disk_text: DISK_TEXT,
        disk
      }
    };
    const commands = scriptedCommands({ saves: [conflict] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    const answer = await state.saveMatch(
      baseDocument().matches[0]!.id,
      editedDraft(),
      'rev-a',
      NOTHING_ACKNOWLEDGED
    );

    expect(answer).toMatchObject({ kind: 'answered', adoption: { kind: 'notOwed' } });
    expect(answer.kind === 'answered' ? answer.result.outcome : null).toBe('conflict');
    // **Nothing was written, so nothing here moves** (consult Q2). Until 2c-4a-2
    // this case asserted the disk projection, and the screen it described was a
    // person's draft sitting beside a list that had re-ordered under it.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11]);
    expect(state.selected?.id.node).toBe(10);
    expect(state.notice).toBeNull();
  }); // End of the "conflicted field save" case

  it('re-reads the file when a failure may already have written it', async () => {
    const failed: CommandResult<SaveResult> = {
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
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, saves: [failed] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    documents.set(2, { ok: true, value: movedDocument() });
    // **The 2c-2 review's first finding.** The classification survives the wrapper:
    // a bare `null` here reads exactly like `noWorkspaceOpen`, and an editor that
    // could not tell them apart would say nothing was written about a file that may
    // already hold the edited snippet.
    expect(
      await state.saveMatch(
        baseDocument().matches[0]!.id,
        editedDraft(),
        'rev-a',
        NOTHING_ACKNOWLEDGED
      )
    ).toEqual({
      kind: 'failed',
      mayHaveWritten: true,
      // **2c-2-2's addition.** The reason travels beside the bit, because
      // `save_match`'s commonest rejection says which field cannot be written.
      failure: failed.ok ? null : failed.failure
    });

    // A failure at or after the rename means the file may already hold the edited
    // snippet, so nothing cached for it can be vouched for.
    expect(commands.getDocument).toHaveBeenCalledTimes(4);
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([30, 31]);
  }); // End of the "may have written" case

  it('drops what it can no longer vouch for when the adoption itself fails, and says so', async () => {
    // **The 2c-2 review's second finding.** The save committed and the re-read
    // failed, so every projection and every identity this state holds for that file
    // was minted from bytes that are gone. Leaving them installed would have the
    // window drawing the pre-save snippet under a committed save; they are dropped,
    // and the failure comes back **beside** the committed outcome rather than in
    // place of it.
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: movedDocument().matches[1]!.id
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, saves: [saved] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    documents.set(2, {
      ok: false,
      failure: { kind: 'command', error: { code: 'unknownDocument', document: 2 } }
    });
    const answer = await state.saveMatch(
      baseDocument().matches[0]!.id,
      editedDraft(),
      'rev-a',
      NOTHING_ACKNOWLEDGED
    );

    // The save is still a save.
    expect(answer.kind).toBe('answered');
    expect(answer.kind === 'answered' ? answer.result.outcome : null).toBe('saved');
    // And the failure travels with it rather than to the console alone.
    expect(answer.kind === 'answered' ? answer.adoption.kind : null).toBe('failed');
    // Nothing stale is left on screen: no projection of that file, no selection
    // into it, and no held text.
    expect(state.scopedMatches).toEqual([]);
    expect(state.selected).toBeNull();
    expect(state.scopedDocument).toBeNull();
  }); // End of the "failed adoption" case

  it('does not drag the selection back when it moved while the save was in flight', async () => {
    // **The 2c-2 review's fourth finding.** Save snippet A, click snippet B before
    // the answer lands, and the adoption must not re-point the selection at A: that
    // is this window moving a selection nobody asked it to move.
    const edited = movedDocument();
    const answering = deferred<CommandResult<SaveResult>>();
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands: BrowserCommands = {
      ...scriptedCommands({ documents }),
      saveMatch: vi.fn(() => answering.promise)
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    const inFlight = state.saveMatch(
      baseDocument().matches[0]!.id,
      editedDraft(),
      'rev-a',
      NOTHING_ACKNOWLEDGED
    );
    // The person clicks the other snippet of the same file while the save is out.
    await state.select(baseDocument().matches[1]!);
    expect(state.selected?.id.node).toBe(11);

    documents.set(2, { ok: true, value: edited });
    answering.resolve({
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: edited.matches[1]!.id
      }
    });
    await inFlight;

    // Node 31 is the saved snippet in the new revision. The selection was not on
    // it when the answer landed, so it is repaired the ordinary way — positionally
    // and then checked — and dropped with a notice rather than re-pointed at A.
    expect(state.selected?.id.node).not.toBe(31);
    expect(state.notice).toBe('differentMatch');
  }); // End of the "selection moved in flight" case

  it('leaves everything alone when the failure cannot have written', async () => {
    const failed: CommandResult<SaveResult> = {
      ok: false,
      failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
    };
    const commands = scriptedCommands({ saves: [failed] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    expect(
      await state.saveMatch(
        baseDocument().matches[0]!.id,
        editedDraft(),
        'rev-a',
        NOTHING_ACKNOWLEDGED
      )
    ).toEqual({ kind: 'failed', mayHaveWritten: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } });
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
  });
}); // End of the "saving one snippet's fields" suite

describe('the local raw editor’s read and write (Phase 3-8-1)', () => {
  /** One snippet’s owned text, as `match_item_text` answers it. */
  const OWNED_TEXT: OwnedItemText = {
    text: '  - trigger: ":a"\n    replace: "é 😀"\n',
    first_line: 2,
    line_count: 2
  };

  it('answers the read unchanged, and reports a refusal as well as answering it', async () => {
    const refused: CommandResult<OwnedItemText> = {
      ok: false,
      failure: {
        kind: 'command',
        error: {
          code: 'itemTextRefused',
          error: { ItemRangeNotContiguous: { edit: 0, hole: { start: 1, end: 4 } } }
        }
      }
    };
    const reported: IpcFailure[] = [];
    const commands = scriptedCommands({ itemTexts: [{ ok: true, value: OWNED_TEXT }, refused] });
    const state = createBrowserState(commands, (failure) => reported.push(failure));
    await state.open(null);
    const id = baseDocument().matches[0]!.id;

    expect(await state.matchItemText(id)).toEqual({ ok: true, value: OWNED_TEXT });
    expect(await state.matchItemText(id)).toBe(refused);
    expect(reported).toEqual([refused.ok ? null : refused.failure]);
    expect(vi.mocked(commands.matchItemText).mock.calls).toEqual([[id], [id]]);
  }); // End of the "read" case

  it('sends the identity, the base revision, the exact text and the acknowledgement', async () => {
    const unchanged: CommandResult<SaveResult> = {
      ok: true,
      value: { outcome: 'saved', revision: 'rev-a', committed: false, notes: [], backup_taken: false, moved: null }
    };
    const commands = scriptedCommands({ itemSaves: [unchanged] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    const id = baseDocument().matches[0]!.id;

    await state.saveMatchItemText(id, 'rev-a', OWNED_TEXT.text, NOTHING_ACKNOWLEDGED);

    expect(vi.mocked(commands.saveMatchItemText).mock.calls).toEqual([
      [id, 'rev-a', OWNED_TEXT.text, NOTHING_ACKNOWLEDGED]
    ]);
    expect(state.writeInFlight(2)).toBe(false);
    // Nothing was written and the revision did not move, so nothing was re-read.
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
  }); // End of the "arguments" case

  it('retires the old identity on a commit: the selection follows `moved`', async () => {
    const edited = movedDocument();
    const committed: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: edited.matches[1]!.id
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, itemSaves: [committed] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    documents.set(2, { ok: true, value: edited });
    const answer = await state.saveMatchItemText(
      baseDocument().matches[0]!.id,
      'rev-a',
      OWNED_TEXT.text,
      NOTHING_ACKNOWLEDGED
    );

    expect(answer).toMatchObject({ kind: 'answered', adoption: { kind: 'done' } });
    // The identity the save was sent with names nothing the window holds now.
    expect(state.selected?.id).toEqual(edited.matches[1]!.id);
    expect(state.selected?.id.revision).not.toBe(baseDocument().matches[0]!.id.revision);
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([30, 31]);
    expect(state.writeInFlight(2)).toBe(false);
  }); // End of the "commit" case

  it('answers a send that may have written as such, and re-reads the file', async () => {
    const commands = scriptedCommands({ itemSaves: [WRITE_MAY_HAVE_HAPPENED] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const answer = await state.saveMatchItemText(
      baseDocument().matches[0]!.id,
      'rev-a',
      OWNED_TEXT.text,
      NOTHING_ACKNOWLEDGED
    );

    expect(answer).toEqual({
      kind: 'failed',
      mayHaveWritten: true,
      failure: WRITE_MAY_HAVE_HAPPENED.ok ? null : WRITE_MAY_HAVE_HAPPENED.failure
    });
    expect(commands.getDocument).toHaveBeenCalledTimes(4);
    expect(state.writeOutcomeUncertain(2)).toBe(true);
  }); // End of the "may have written" case

  it('answers an engine refusal as a failure that wrote nothing, carrying the core’s refusal', async () => {
    const engine: CommandResult<SaveResult> = {
      ok: false,
      failure: {
        kind: 'command',
        error: {
          code: 'saveFailed',
          error: { Patch: { ItemTextEscapesItsIndentation: { edit: 0, line: 1 } } },
          may_have_written: false
        }
      }
    };
    const commands = scriptedCommands({ itemSaves: [engine] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const answer = await state.saveMatchItemText(
      baseDocument().matches[0]!.id,
      'rev-a',
      'x: y\n',
      NOTHING_ACKNOWLEDGED
    );

    expect(answer).toEqual({ kind: 'failed', mayHaveWritten: false, failure: engine.ok ? null : engine.failure });
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
    expect(state.writeOutcomeUncertain(2)).toBe(false);
  }); // End of the "engine refusal" case
}); // End of the "local raw editor's read and write" suite

describe('the bulk option edit’s read and write (Phase 3-11-1)', () => {
  /** How `match_option_spellings` answers for a snippet writing `word: 'true'`. */
  const SPELLINGS: BulkOptionSpellings = {
    word: { Written: { source: "'true'" } },
    left_word: { Absent: {} },
    right_word: { Absent: {} },
    propagate_case: { Absent: {} },
    uppercase_style: { Absent: {} },
    force_mode: { Absent: {} },
    force_clipboard: { Absent: {} }
  };

  /**
   * A bulk request over both snippet files, as `prepareBulkApply` builds one.
   *
   * @param excluded - The files excluded before sending.
   * @returns The request.
   */
  function bothFiles(excluded: readonly DocumentId[] = []): BulkOptionsRequest {
    return {
      changes: [{ option: 'word', value: { Set: 'true' } }],
      files: [
        { document: 2, base_revision: 'rev-a', matches: [baseDocument().matches[0]!.id], consent: null },
        { document: 3, base_revision: 'rev-a', matches: [otherDocument().matches[0]!.id], consent: null }
      ],
      excluded
    };
  } // End of function bothFiles()

  /**
   * What `match/base.yml` projects to after a bulk edit wrote `word: true` into it:
   * a new revision and new nodes, the snippets in the same order.
   *
   * @returns The projection.
   */
  function bulkEditedDocument(): DocumentView {
    return makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-b',
      matches: [
        makeMatch({ node: 40, document: 2, revision: 'rev-b', trigger: ':sig', label: 'Signature' }),
        makeMatch({ node: 41, document: 2, revision: 'rev-b', trigger: ':date', label: 'Today' })
      ]
    });
  } // End of function bulkEditedDocument()

  it('answers a spelling read unchanged, and reports a refusal as well as answering it', async () => {
    const stale: CommandResult<BulkOptionSpellings> = {
      ok: false,
      failure: { kind: 'command', error: { code: 'identityStaleRevision', expected: 'rev-b', found: 'rev-a' } }
    };
    const reported: IpcFailure[] = [];
    const commands = scriptedCommands({ spellings: [{ ok: true, value: SPELLINGS }, stale] });
    const state = createBrowserState(commands, (failure) => reported.push(failure));
    await state.open(null);
    const id = baseDocument().matches[0]!.id;

    expect(await state.matchOptionSpellings(id)).toEqual({ ok: true, value: SPELLINGS });
    expect(await state.matchOptionSpellings(id)).toBe(stale);
    expect(reported).toEqual([stale.ok ? null : stale.failure]);
    expect(vi.mocked(commands.matchOptionSpellings).mock.calls).toEqual([[id], [id]]);
  }); // End of the "spelling read" case

  it('sends nothing when the window holds no projection of an applied file', async () => {
    const commands = scriptedCommands();
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    const request: BulkOptionsRequest = {
      ...bothFiles(),
      files: [{ document: 9, base_revision: 'rev-a', matches: [], consent: null }]
    };

    expect(await state.applyBulkOptions(request)).toEqual({ kind: 'notAttempted' });
    expect(commands.applyBulkOptions).not.toHaveBeenCalled();
  });

  it('keeps a committed file’s success beside a later failure, and retires that file’s identities', async () => {
    const result: BulkResult = {
      preflight_passed: true,
      nothing_written: false,
      files: [
        { document: 2, outcome: 'saved', revision: 'rev-b', backup_taken: true, notes: [] },
        { document: 3, outcome: 'failed', error: { code: 'noWorkspaceOpen' } }
      ]
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, bulks: [{ ok: true, value: result }] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);
    documents.set(2, { ok: true, value: bulkEditedDocument() });
    const request = bothFiles();

    const answer = await state.applyBulkOptions(request);

    expect(answer).toEqual({
      kind: 'answered',
      result,
      adoptions: [{ document: 2, adoption: { kind: 'done' } }]
    });
    expect(vi.mocked(commands.applyBulkOptions).mock.calls).toEqual([[request]]);
    // The identity the request was sent with names nothing the window holds now.
    expect(state.selected?.id.revision).toBe('rev-b');
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([40, 41]);
    // Only the committed file was read again; the failed one wrote nothing.
    expect(commands.getDocument).toHaveBeenCalledTimes(4);
    expect(state.writeInFlight(2)).toBe(false);
    expect(state.writeInFlight(3)).toBe(false);
    expect(state.writeOutcomeUncertain(3)).toBe(false);
  }); // End of the "committed file beside a failure" case

  it('never turns a committed file into an error when re-reading it throws', async () => {
    const result: BulkResult = {
      preflight_passed: true,
      nothing_written: false,
      files: [
        { document: 2, outcome: 'saved', revision: 'rev-b', backup_taken: false, notes: [] },
        { document: 3, outcome: 'notAttempted' }
      ]
    };
    const commands = scriptedCommands({ bulks: [{ ok: true, value: result }] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    vi.mocked(commands.getDocument).mockImplementationOnce(async () => {
      throw new Error('the re-read threw');
    });

    const answer = await state.applyBulkOptions(bothFiles());

    expect(answer.kind).toBe('answered');
    if (answer.kind === 'answered') {
      expect(answer.result).toBe(result);
      expect(answer.adoptions).toHaveLength(1);
      expect(answer.adoptions[0]?.adoption.kind).toBe('failed');
    }
    expect(state.writeInFlight(2)).toBe(false);
    expect(state.writeOutcomeUncertain(2)).toBe(false);
  }); // End of the "adoption throws" case

  it('re-reads a file whose write may have happened, and leaves it marked uncertain', async () => {
    const result: BulkResult = {
      preflight_passed: true,
      nothing_written: false,
      files: [
        { document: 2, outcome: 'writeOutcomeUnknown', error: { code: 'noWorkspaceOpen' } },
        { document: 3, outcome: 'notAttempted' }
      ]
    };
    const commands = scriptedCommands({ bulks: [{ ok: true, value: result }] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const answer = await state.applyBulkOptions(bothFiles());

    expect(answer).toMatchObject({ kind: 'answered', adoptions: [{ document: 2, adoption: { kind: 'done' } }] });
    expect(commands.getDocument).toHaveBeenCalledTimes(4);
    expect(state.writeOutcomeUncertain(2)).toBe(true);
    expect(state.writeOutcomeUncertain(3)).toBe(false);
    expect(state.writeInFlight(2)).toBe(false);
  }); // End of the "may have written" case

  it('answers a request refused as a whole as a failure that wrote nothing, and closes every lease', async () => {
    const refused: CommandResult<BulkResult> = {
      ok: false,
      failure: { kind: 'command', error: { code: 'bulkRefused', error: { NoOptionChanges: {} } } }
    };
    const commands = scriptedCommands({ bulks: [refused] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const answer = await state.applyBulkOptions(bothFiles());

    expect(answer).toEqual({
      kind: 'failed',
      mayHaveWritten: false,
      failure: refused.ok ? null : refused.failure
    });
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
    expect(state.writeInFlight(2)).toBe(false);
    expect(state.writeInFlight(3)).toBe(false);
  }); // End of the "refused as a whole" case

  it('opens no lease for an excluded file, and re-reads nothing when every file already held the values', async () => {
    const result: BulkResult = {
      preflight_passed: true,
      nothing_written: true,
      files: [
        { document: 2, outcome: 'alreadyUnchanged', revision: 'rev-a' },
        { document: 3, outcome: 'excludedBeforeApply' }
      ]
    };
    const commands = scriptedCommands({ bulks: [{ ok: true, value: result }] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    const request: BulkOptionsRequest = { ...bothFiles([3]), files: [bothFiles().files[0]!] };

    const answer = await state.applyBulkOptions(request);

    expect(answer).toEqual({ kind: 'answered', result, adoptions: [] });
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
    expect(state.writeInFlight(2)).toBe(false);
    expect(state.writeOutcomeUncertain(3)).toBe(false);
  }); // End of the "excluded and unchanged" case
}); // End of the "bulk option edit's read and write" suite

describe('the bulk option edit’s post-commit ordering (Phase 3-11-1 review fixes)', () => {
  /** Both snippet files saved, as one answer establishes them. */
  const BOTH_SAVED: BulkResult = {
    preflight_passed: true,
    nothing_written: false,
    files: [
      { document: 2, outcome: 'saved', revision: 'rev-b', backup_taken: true, notes: [] },
      { document: 3, outcome: 'saved', revision: 'rev-y', backup_taken: true, notes: [] }
    ]
  };

  /**
   * A request over both snippet files.
   *
   * @returns The request.
   */
  function request(): BulkOptionsRequest {
    return {
      changes: [{ option: 'word', value: { Set: 'true' } }],
      files: [
        { document: 2, base_revision: 'rev-a', matches: [baseDocument().matches[0]!.id], consent: null },
        { document: 3, base_revision: 'rev-a', matches: [otherDocument().matches[0]!.id], consent: null }
      ],
      excluded: []
    };
  } // End of function request()

  /**
   * The two files as they read after the bulk edit: new revisions, new nodes,
   * the same bytes at each position.
   *
   * @returns The projections of documents 2 and 3.
   */
  function rewritten(): { base: DocumentView; other: DocumentView } {
    return {
      base: makeDocument({
        id: 2,
        relativePath: 'match/base.yml',
        revision: 'rev-b',
        matches: [
          makeMatch({ node: 40, document: 2, revision: 'rev-b', trigger: ':sig', label: 'Signature' }),
          makeMatch({ node: 41, document: 2, revision: 'rev-b', trigger: ':date', label: 'Today' })
        ]
      }),
      other: makeDocument({
        id: 3,
        relativePath: 'match/other.yml',
        revision: 'rev-y',
        matches: [makeMatch({ node: 50, document: 3, revision: 'rev-y', trigger: ':sql', label: 'Query' })]
      })
    };
  } // End of function rewritten()

  it('retires every committed file before the first re-read is awaited', async () => {
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, bulks: [{ ok: true, value: BOTH_SAVED }] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    const fresh = rewritten();
    documents.set(3, { ok: true, value: fresh.other });
    const held = deferred<CommandResult<DocumentView>>();
    vi.mocked(commands.getDocument).mockImplementationOnce(async () => held.promise);

    const answer = state.applyBulkOptions(request());
    await vi.waitFor(() => expect(commands.getDocument).toHaveBeenCalledTimes(4));

    // File 2's re-read is out; file 3 committed too, so neither old projection
    // may still be live.
    expect(vi.mocked(commands.getDocument).mock.calls[3]).toEqual([2]);
    expect(state.views.some((view) => view.id === 2)).toBe(false);
    expect(state.views.some((view) => view.id === 3)).toBe(false);

    held.resolve({ ok: true, value: fresh.base });
    expect(await answer).toMatchObject({
      kind: 'answered',
      adoptions: [
        { document: 2, adoption: { kind: 'done' } },
        { document: 3, adoption: { kind: 'done' } }
      ]
    });
    expect(state.views.find((view) => view.id === 2)?.revision).toBe('rev-b');
    expect(state.views.find((view) => view.id === 3)?.revision).toBe('rev-y');
  }); // End of the "retires every committed file" case

  it('does not restore a selection over a newer intent expressed during the re-read', async () => {
    const commands = scriptedCommands({
      bulks: [{ ok: true, value: { ...BOTH_SAVED, files: [BOTH_SAVED.files[0]!] } }],
      match: { ok: true, value: otherDocument().matches[0]! }
    });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    await state.select(baseDocument().matches[0]!);
    const held = deferred<CommandResult<DocumentView>>();
    vi.mocked(commands.getDocument).mockImplementationOnce(async () => held.promise);

    const answer = state.applyBulkOptions({ ...request(), files: [request().files[0]!] });
    await vi.waitFor(() => expect(commands.getDocument).toHaveBeenCalledTimes(4));
    await state.select(otherDocument().matches[0]!);
    held.resolve({ ok: true, value: rewritten().base });
    await answer;

    // Without the guard the re-read found the same bytes at the held position
    // and dragged the selection back to file 2 with a `kept` notice.
    expect(state.selected?.document).toBe(3);
    expect(state.selected?.id).toEqual(otherDocument().matches[0]!.id);
    expect(state.notice).toBeNull();
  }); // End of the "newer intent, bulk" case

  it('restores the selection when no newer intent was expressed', async () => {
    const commands = scriptedCommands({
      bulks: [{ ok: true, value: { ...BOTH_SAVED, files: [BOTH_SAVED.files[0]!] } }]
    });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    await state.select(baseDocument().matches[0]!);
    const held = deferred<CommandResult<DocumentView>>();
    vi.mocked(commands.getDocument).mockImplementationOnce(async () => held.promise);

    const answer = state.applyBulkOptions({ ...request(), files: [request().files[0]!] });
    await vi.waitFor(() => expect(commands.getDocument).toHaveBeenCalledTimes(4));
    held.resolve({ ok: true, value: rewritten().base });
    await answer;

    expect(state.selected?.id.revision).toBe('rev-b');
    expect(state.notice).toBe('kept');
  }); // End of the "no newer intent" case

  it('guards the raw save’s re-read the same way', async () => {
    const committed: CommandResult<SaveResult> = {
      ok: true,
      value: { outcome: 'saved', revision: 'rev-c', committed: true, notes: [], backup_taken: false, moved: null }
    };
    const commands = scriptedCommands({
      raws: [committed],
      match: { ok: true, value: otherDocument().matches[0]! }
    });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    await state.select(baseDocument().matches[0]!);
    const held = deferred<CommandResult<DocumentView>>();
    vi.mocked(commands.getDocument).mockImplementationOnce(async () => held.promise);

    const answer = state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
    await vi.waitFor(() => expect(commands.getDocument).toHaveBeenCalledTimes(4));
    await state.select(otherDocument().matches[0]!);
    held.resolve({ ok: true, value: replacedDocument() });
    await answer;

    // Unguarded, the re-read set the `differentMatch` notice over the person's
    // newer selection.
    expect(state.selected?.document).toBe(3);
    expect(state.notice).toBeNull();
  }); // End of the "raw save" case
}); // End of the "bulk option edit's post-commit ordering" suite

/**
 * What `match/base.yml` projects to after its whole text was replaced.
 *
 * A **new revision**, a **new node** and a different snippet, because that is
 * what a whole-document replacement really produces: nothing minted from the
 * previous parse survives it, and there is no `moved` identity to follow.
 *
 * @returns The projection of the bytes a replacement wrote.
 */
function replacedDocument(): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision: 'rev-c',
    matches: [
      makeMatch({ node: 40, document: 2, revision: 'rev-c', trigger: ':only', label: 'The only one' })
    ]
  });
} // End of function replacedDocument()

/**
 * A replacement that left the first snippet's own bytes exactly as they were.
 *
 * The other half of the re-resolution question: the file was rewritten, so every
 * identity in it is new, and the snippet the user had selected is nonetheless
 * still there and still spelled the same way.
 *
 * @returns The projection of the bytes such a replacement wrote.
 */
function replacedWithTheSameFirstSnippet(): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision: 'rev-c',
    matches: [
      makeMatch({ node: 50, document: 2, revision: 'rev-c', trigger: ':sig', label: 'Signature' })
    ]
  });
} // End of function replacedWithTheSameFirstSnippet()

/**
 * A committed replacement, as the transaction would report it.
 *
 * `moved` is `null` and is not a defensive default: a whole-document replacement
 * has no single snippet it acted on, so there is no identity for it to carry.
 */
const RAW_COMMITTED_VALUE: SaveResult = {
  outcome: 'saved',
  revision: 'rev-c',
  committed: true,
  notes: [],
  backup_taken: true,
  moved: null
};

/** That replacement, as the boundary would answer it. */
const RAW_COMMITTED: CommandResult<SaveResult> = { ok: true, value: RAW_COMMITTED_VALUE };

describe("replacing a file's whole text", () => {
  it('forgets everything cached for the file and reads it again', async () => {
    // **The invalidation the 2b-2c-3b review's Medium finding asked for**, and it
    // is performed by this module rather than by whatever a caller passes: the
    // state's own method takes four arguments and no callback, so there is
    // nothing a caller could have supplied or forgotten.
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, raws: [RAW_COMMITTED] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);
    await state.showFileText(true);
    expect(commands.documentText).toHaveBeenCalledTimes(1);

    // What is on disk once the replacement has been written.
    documents.set(2, { ok: true, value: replacedDocument() });
    const outcome = outcomeOf(
      await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED)
    );

    expect(outcome?.outcome).toBe('saved');
    // The projection: the one that was written, not the one that was replaced.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([40]);
    expect(commands.getDocument).toHaveBeenCalledTimes(4);
    // The identity: dropped rather than re-pointed. A replacement answers
    // `moved: null` permanently, so there is nothing to follow, and what sits at
    // the held position is a different snippet.
    expect(state.selected).toBeNull();
    expect(state.notice).toBe('differentMatch');
    // The raw viewer's snapshot: of bytes that have just been replaced whole.
    expect(commands.documentText).toHaveBeenCalledTimes(2);
    expect(state.fileText).toEqual({ kind: 'text', text: '# text of document 2\n' });
  }); // End of the "forgets everything cached" case

  it('finds the selection again when the replacement did not change that snippet', async () => {
    // Positional and **then checked** (R27): the identity is new, the position is
    // where re-resolution looks, and the source slice is what decides that what it
    // found is what was selected.
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, raws: [RAW_COMMITTED] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    documents.set(2, { ok: true, value: replacedWithTheSameFirstSnippet() });
    await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);

    // Held, under the identity the **fresh** parse minted, never the one the
    // selection was made with.
    expect(state.selected?.id.node).toBe(50);
    expect(state.selected?.id.revision).toBe('rev-c');
    expect(state.notice).toBe('kept');
  }); // End of the "selection survives" case

  it('changes nothing on the screen when the text was already what the file held', async () => {
    // `committed: false` is a documented success: no new revision exists, nothing
    // went stale, and invalidating anyway would make this window discard
    // projections that are still correct.
    const unchanged: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-a',
        committed: false,
        notes: [],
        backup_taken: false,
        moved: null
      }
    };
    const commands = scriptedCommands({ raws: [unchanged] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);
    await state.showFileText(true);

    const outcome = outcomeOf(
      await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED)
    );

    expect(outcome?.outcome).toBe('saved');
    expect(state.selected?.id.node).toBe(10);
    expect(state.notice).toBeNull();
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11]);
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
    expect(commands.documentText).toHaveBeenCalledTimes(1);
  }); // End of the "committed: false" case

  it('reports a reload that failed and still answers with the committed save', async () => {
    // **The 2b-2c-3b review's High finding, seen from the state.** The bytes are
    // on disk; a reload that failed afterwards cannot unwrite them, so it must not
    // turn a commit into a `null`. It is reported on the same channel every other
    // failure of this state uses, and the committed outcome still comes back.
    const failure: IpcFailure = {
      kind: 'command',
      error: { code: 'io', path: '/tmp/espanso/match/base.yml', kind: 'NotFound' }
    };
    const reported: IpcFailure[] = [];
    const commands: BrowserCommands = {
      ...scriptedCommands(),
      saveRawDocument: vi.fn(
        async (): Promise<RawSaveOutcome> => ({
          ok: true,
          value: RAW_COMMITTED_VALUE,
          reload: { kind: 'failed', failure }
        })
      )
    };
    const state = createBrowserState(commands, (next) => reported.push(next));
    await state.open(null);

    const outcome = outcomeOf(
      await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED)
    );

    expect(outcome?.outcome).toBe('saved');
    expect(outcome?.outcome === 'saved' ? outcome.committed : null).toBe(true);
    expect(reported).toEqual([failure]);
    // A failed reload is not a failed workspace either.
    expect(state.status).toBe('ready');
    expect(state.failure).toBeNull();
  }); // End of the "reload failed" case

  it('takes the conflict projection as the one the next save is checked against', async () => {
    const disk = replacedDocument();
    const conflict: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'conflict',
        reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
        expected: 'rev-a',
        found: 'rev-c',
        disk_revision: 'rev-c',
        disk_text: DISK_TEXT,
        disk
      }
    };
    const commands = scriptedCommands({ raws: [conflict] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    const outcome = outcomeOf(
      await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED)
    );

    expect(outcome?.outcome).toBe('conflict');
    // **Nothing was written by this call, so nothing here moves** (consult Q2).
    // The parse of what the file really holds is carried on the answer, where a
    // confirmed reload can install it; until 2c-4a-2 this case asserted that it
    // had already been installed.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11]);
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
    expect(state.selected?.id.node).toBe(10);
    expect(state.notice).toBeNull();
  }); // End of the "conflict" case

  it('re-reads the file when the failure says the rename may have completed', async () => {
    // A replacement that failed after its rename means the file may already hold a
    // **whole new text**, so nothing this window caches for it can be vouched for.
    const failure: IpcFailure = {
      kind: 'command',
      error: {
        code: 'saveFailed',
        error: { Write: { Io: { step: 'SyncDirectory', path: '/tmp/espanso/match/base.yml', kind: 'Interrupted', raw_os_error: 4 } } },
        may_have_written: true
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const reported: IpcFailure[] = [];
    const commands = scriptedCommands({ documents, raws: [{ ok: false, failure }] });
    const state = createBrowserState(commands, (next) => reported.push(next));
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    documents.set(2, { ok: true, value: replacedDocument() });
    const answer = await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);

    // **The 2c-1b review's second finding.** This is not "nothing was written": the
    // rename may have completed, so the file may already hold the candidate, and a
    // caller that collapsed this into a bare `null` had no way to say so. The
    // failure is typed and carries the one fact a screen needs.
    expect(answer).toEqual({ kind: 'failed', mayHaveWritten: true });
    expect(outcomeOf(answer)).toBeNull();
    expect(reported).toEqual([failure]);
    expect(state.status).toBe('ready');
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([40]);
    expect(commands.getDocument).toHaveBeenCalledTimes(4);
    expect(state.selected).toBeNull();
  }); // End of the "failed save that may have written" case

  it('says a failure before the rename wrote nothing, because that one it can tell', async () => {
    // The other half of the same finding: the two arms have to be distinguishable,
    // or the typed failure buys nothing over the `null` it replaced.
    const failure: IpcFailure = {
      kind: 'command',
      error: {
        code: 'saveFailed',
        error: {
          Write: {
            Io: {
              step: 'CreateTempFile',
              path: '/tmp/espanso/match/base.yml',
              kind: 'PermissionDenied',
              raw_os_error: 13
            }
          }
        },
        may_have_written: false
      }
    };
    const commands = scriptedCommands({ raws: [{ ok: false, failure }] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const answer = await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);

    expect(answer).toEqual({ kind: 'failed', mayHaveWritten: false });
    // Nothing was re-read either: there is nothing this window has to forget.
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
  }); // End of the "failure before the rename" case

  it('leaves the file unprojected, and says so, when the re-read itself fails', async () => {
    // The honest answer available here: this state cannot describe a file it could
    // not read, and blanking the workspace over one file would be a bigger claim
    // than the failure supports. What it must not do is keep the projection it
    // just invalidated — those are the bytes the replacement destroyed.
    const unreadable: IpcFailure = {
      kind: 'command',
      error: { code: 'io', path: '/tmp/espanso/match/base.yml', kind: 'PermissionDenied' }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const reported: IpcFailure[] = [];
    const commands = scriptedCommands({ documents, raws: [RAW_COMMITTED] });
    const state = createBrowserState(commands, (next) => reported.push(next));
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    documents.set(2, { ok: false, failure: unreadable });
    const answer = await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);

    // **The 2c-1b review's third finding.** The save committed and is answered as
    // one — and the fact that this window could not read the file back travels
    // *with* that answer, so a screen can say the window is out of step. Before the
    // fix it reached the developer channel and stopped there, and the person saw a
    // clean "the file was written".
    expect(issuerInvalidationOf(answer)).toMatchObject({ kind: 'failed' });
    expect(outcomeOf(answer)).toBeNull(); // the seal is one-shot; opened just above
    expect(reported).toEqual([unreadable]);
    // And the stale projection is gone rather than redrawn.
    expect(state.scopedMatches).toEqual([]);
    expect(state.scopedDocument).toBeNull();
  }); // End of the "re-read failed" case

  it('says the invalidation succeeded when the file really was re-read', async () => {
    // The oracle for the case above: a status that were always `failed` would pass
    // it and mean nothing.
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, raws: [RAW_COMMITTED] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    documents.set(2, { ok: true, value: replacedDocument() });
    const answer = await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);

    expect(issuerInvalidationOf(answer)).toEqual({ kind: 'done' });
  }); // End of the "invalidation succeeded" case

  it('answers a sealed outcome, which carries nothing until it is opened and opens once', async () => {
    // **Phase 2c-1b's answer to hole 4.2 of `2c-1a-notes.md`**: the pairing of a
    // document with a result happens here, in the adapter that issued the save and
    // therefore knows both, instead of at every caller that wants to describe it.
    // What that buys is checked rather than asserted in prose: the value carries
    // nothing a caller can read, and it opens exactly once.
    const commands = scriptedCommands({ raws: [RAW_COMMITTED] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const answer = await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
    expect(answer.kind).toBe('sealed');
    if (answer.kind !== 'sealed') {
      return;
    }
    const sealed = answer.sealed;
    expect(Reflect.ownKeys(sealed)).toEqual([]);
    expect(JSON.stringify(sealed)).toBe('{}');

    const invalidations: DocumentId[] = [];
    const opened = openWholeDocumentSave(sealed, (invalidation) => {
      invalidations.push(invalidation.document);
    });
    expect(opened.kind).toBe('opened');
    expect(opened.kind === 'opened' ? opened.outcome.outcome : null).toBe('saved');
    expect(opened.kind === 'opened' ? opened.document : null).toBe(2);
    expect(invalidations).toEqual([2]);
    // And what this state's own invalidation made of it travels with the outcome
    // rather than only reaching the console.
    expect(opened.kind === 'opened' ? opened.issuerInvalidation : null).toEqual({ kind: 'done' });

    // A second open is refused rather than served with a no-op callback.
    expect(openWholeDocumentSave(sealed, () => undefined).kind).toBe('alreadyOpened');
  }); // End of the "sealed outcome" case

  it('never pairs a held snapshot with a revision installed under it', async () => {
    // **The 2c-1b review's first finding, and the one that could lose a file.**
    // The viewer holds text T0 at revision `rev-a`. Stale-identity recovery
    // installs a fresh projection at `rev-b`, and `readFileText` used to skip the
    // re-read because the document identity had not changed — so *Edit* paired T0
    // with `rev-b`, the save's revision check passed, and the bytes some other
    // process had written were overwritten by an edit of text nobody had seen.
    //
    // Two things close it, and both are asserted: the revision is captured **with**
    // the read rather than read off the projection later, and installing a
    // projection drops a snapshot taken against the one it replaces.
    const reparsed = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-b',
      matches: [
        makeMatch({ node: 30, document: 2, revision: 'rev-b', trigger: ':sig', label: 'Signature' })
      ]
    });
    const texts = new Map<number, CommandResult<string>>([
      [2, { ok: true, value: 'the text at rev-a\n' }]
    ]);
    const commands = scriptedCommands({
      texts,
      match: {
        ok: false,
        failure: {
          kind: 'command',
          error: { code: 'identityStaleRevision', expected: 'rev-b', found: 'rev-a' }
        }
      },
      reload: { ok: true, value: reparsed }
    });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.showFileText(true);

    expect(state.fileText).toEqual({ kind: 'text', text: 'the text at rev-a\n' });
    expect(state.fileTextRevision).toBe('rev-a');
    expect(commands.documentText).toHaveBeenCalledTimes(1);

    // What the other process wrote, which the recovery is about to project.
    texts.set(2, { ok: true, value: 'the text at rev-b\n' });
    await state.select(state.scopedMatches[0]!);

    // The projection moved, so the snapshot moved with it rather than staying
    // behind to be paired with the new revision.
    expect(commands.documentText).toHaveBeenCalledTimes(2);
    expect(state.fileText).toEqual({ kind: 'text', text: 'the text at rev-b\n' });
    expect(state.fileTextRevision).toBe('rev-b');
  }); // End of the "held snapshot and installed revision" case

  it('pairs the revision the projection held when the read started, not the one it holds now', async () => {
    // The capture half on its own. `document_text` answers no revision, so the two
    // come from separate reads; taking the projection's revision *after* the text
    // would make it the newer of the two, and a single external write between them
    // would then be committed over. Taken before, the pair's revision is the older
    // one and the save gate refuses it as a conflict.
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.showFileText(true);

    expect(state.fileTextRevision).toBe(baseDocument().revision);
    // Closing the viewer drops the pair whole: a revision that outlived its text
    // is half of a claim.
    await state.showFileText(false);
    expect(state.fileText).toBeNull();
    expect(state.fileTextRevision).toBeNull();
  }); // End of the "captured revision" case

  it('reads the file no second time on a conflict, and leaves the viewer alone', async () => {
    // **What 2c-4a-2 replaced, stated as the thing that must not happen again.**
    // A conflicted raw save used to call `document_text` a second time to capture
    // the disk side, keyed by document — a read that could answer a *later* text
    // than the conflict was about, or an **earlier** one when the viewer happened
    // to be pointed at the same file (`2c-4a-1-notes.md` section 4.1). The text is
    // on the payload now, so there is no second call to be raced.
    const conflict: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'conflict',
        reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
        expected: 'rev-a',
        found: 'rev-c',
        disk_revision: 'rev-c',
        disk_text: DISK_TEXT,
        disk: replacedDocument()
      }
    };
    const commands = scriptedCommands({ raws: [conflict] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    // The window is looking at document 3; the save is of document 2.
    state.show({ kind: 'document', id: 3 });
    await state.showFileText(true);
    // One read: the viewer's, of document 3.
    expect(commands.documentText).toHaveBeenCalledTimes(1);

    await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);

    expect(commands.documentText).toHaveBeenCalledTimes(1);
    // And the viewer is untouched: it is still showing the file it was showing.
    expect(state.fileTextTarget?.id).toBe(3);
    expect(state.fileText).toEqual({ kind: 'text', text: '# text of document 3\n' });
  }); // End of the "no second read on a conflict" case

  it('sends the document, the base revision, the text and the acknowledgement, and no flag', async () => {
    const commands = scriptedCommands({ raws: [RAW_COMMITTED] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    // The same byte-exact sample the boundary's own test uses: a BOM, a CRLF pair,
    // a decomposed `e`-acute, an astral character and no final newline.
    const text = '\u{feff}matches:\r\n  - trigger: ":caf\u{65}\u{301}"\n    replace: \u{1f600}';
    await state.saveRawDocument(2, 'rev-a', text, NOTHING_ACKNOWLEDGED);

    const call = vi.mocked(commands.saveRawDocument).mock.calls[0]!;
    expect(call[0]).toBe(2);
    expect(call[1]).toBe('rev-a');
    expect(call[2]).toBe(text);
    expect(call[3]).toEqual({ accepted: [] });
    // The fifth argument is this module's own invalidation, not a caller's: the
    // state's method has no such parameter for a caller to pass one through.
    expect(typeof call[4]).toBe('function');
    expect(JSON.stringify([call[0], call[1], call[2], call[3]])).not.toContain('force');
  }); // End of the "arguments" case
}); // End of the "replacing a file's whole text" suite

/** What a new snippet says, on the wire. */
const NEW_MATCH: NewMatch = { trigger: { Single: ':new' }, content: { Replace: 'a new body' } };

/** The bottom of the destination file's list. */
const AT_END: NewMatchPosition = { End: {} };

/**
 * The projection of `match/base.yml` after a snippet has been added to it.
 *
 * **Every identity differs from `baseDocument`'s**, revision and node both,
 * because that is what a commit really does: a `MatchId` records the revision it
 * was minted from, and a fixture whose surviving identities happened to stay equal
 * would let a stale-reference bug pass unnoticed.
 *
 * @returns The projection.
 */
function grownDocument(): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision: 'rev-b',
    matches: [
      makeMatch({ node: 40, document: 2, revision: 'rev-b', trigger: ':sig', label: 'Signature' }),
      makeMatch({ node: 41, document: 2, revision: 'rev-b', trigger: ':date', label: 'Today' }),
      makeMatch({ node: 42, document: 2, revision: 'rev-b', trigger: ':new', label: 'New' })
    ]
  });
} // End of function grownDocument()

/**
 * A **third** parse of the same file, which reuses the node a create just minted.
 *
 * Not a contrivance: a `MatchId`'s node is an arena slot, and a parse of different
 * bytes allocates the same slots for whatever it finds. So a file another program
 * rewrote between the transaction's answer and this window's re-read really can
 * answer node 42 — for a snippet nobody in this window has ever seen.
 *
 * @returns The projection a re-read would install.
 */
function racedDocument(): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision: 'rev-elsewhere',
    matches: [
      makeMatch({
        node: 42,
        document: 2,
        revision: 'rev-elsewhere',
        trigger: ':stranger',
        label: 'Somebody else’s'
      }),
      makeMatch({
        node: 43,
        document: 2,
        revision: 'rev-elsewhere',
        trigger: ':also',
        label: 'Also theirs'
      })
    ]
  });
} // End of function racedDocument()

/** The three-snippet projection the deletion cases start from. */
function crowdedDocument(): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    matches: [
      makeMatch({ node: 10, document: 2, trigger: ':sig', label: 'Signature' }),
      makeMatch({ node: 11, document: 2, trigger: ':date', label: 'Today' }),
      makeMatch({ node: 12, document: 2, trigger: ':note', label: 'Note' })
    ]
  });
} // End of function crowdedDocument()

/**
 * The same file after the **first** of its three snippets has been deleted.
 *
 * The identity churn is the point, as it is for {@link grownDocument}: a new
 * revision and two node numbers that appear nowhere before the commit.
 *
 * @returns The projection.
 */
function thinnedDocument(): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision: 'rev-c',
    matches: [
      makeMatch({ node: 50, document: 2, revision: 'rev-c', trigger: ':date', label: 'Today' }),
      makeMatch({ node: 51, document: 2, revision: 'rev-c', trigger: ':note', label: 'Note' })
    ]
  });
} // End of function thinnedDocument()

/**
 * Every match identity a projection carries, as comparable strings.
 *
 * All three fields, because all three are the identity: a comparison that dropped
 * the revision would call two identities equal across the very reparse the
 * revision exists to separate.
 *
 * @param view - The projection to read.
 * @returns One string per snippet.
 */
function identitiesOf(view: DocumentView): readonly string[] {
  return view.matches.map((match) => `${match.id.document}/${match.id.revision}/${match.id.node}`);
} // End of function identitiesOf()

describe('creating a snippet', () => {
  it('sends the revision this state is projecting, and the request unchanged', async () => {
    const commands = scriptedCommands({ creates: [{ ok: true, value: CREATED_NOTHING }] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    await state.createMatch(2, NEW_MATCH, AT_END, OPEN_REVISION, NOTHING_ACKNOWLEDGED);

    const call = vi.mocked(commands.createMatch).mock.calls[0]!;
    expect(call[0]).toBe(2);
    expect(call[1]).toBe(NEW_MATCH);
    expect(call[2]).toBe(AT_END);
    expect(call[3]).toBe('rev-a');
    expect(call[4]).toEqual(NOTHING_ACKNOWLEDGED);
    expect(JSON.stringify(call.slice(0, 5))).not.toContain('force');
  }); // End of the "arguments" case

  it('sends the submission’s own base revision, never the one it is projecting', async () => {
    // **The first review round's second finding.** The wrapper used to read
    // `view.revision` at the moment of the call, which silently rebased a stale
    // form: open a form at R0, let anything reproject the file to R1, submit, and
    // the core sees no conflict — so a snippet is written into a parse the person
    // never saw, at an anchor resolved in it. Nothing else decides this: the
    // command's own conflict check can only compare what it is sent.
    const commands = scriptedCommands({ creates: [{ ok: true, value: CREATED_NOTHING }] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    await state.createMatch(2, NEW_MATCH, AT_END, 'rev-older', NOTHING_ACKNOWLEDGED);

    // The state really is projecting something else, so this is not the same value
    // arriving by another route.
    expect(state.scopedDocument?.revision).toBe('rev-a');
    expect(vi.mocked(commands.createMatch).mock.calls[0]![3]).toBe('rev-older');
  }); // End of the "stale form" case

  it('refuses to send anything for a document this state does not describe', async () => {
    const commands = scriptedCommands();
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    expect(await state.createMatch(99, NEW_MATCH, AT_END, OPEN_REVISION, NOTHING_ACKNOWLEDGED)).toEqual({
      kind: 'notAttempted'
    });
    expect(commands.createMatch).not.toHaveBeenCalled();
  });

  it('adopts the created snippet, selects it, and re-reads the file', async () => {
    const grown = grownDocument();
    const created: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: grown.matches[2]!.id
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, creates: [created] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);
    await state.showFileText(true);

    documents.set(2, { ok: true, value: grown });
    const answer = await state.createMatch(2, NEW_MATCH, AT_END, OPEN_REVISION, NOTHING_ACKNOWLEDGED);

    expect(answer).toMatchObject({ kind: 'answered', adoption: { kind: 'done' } });
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([40, 41, 42]);
    // The person has just made this snippet, so this is where the window points.
    expect(state.selected?.id.node).toBe(42);
    expect(state.notice).toBeNull();
    // The snapshot the raw viewer held is of bytes that no longer exist.
    expect(commands.documentText).toHaveBeenCalledTimes(2);
  }); // End of the "committed create" case

  it('does not resolve the created identity in a projection of another parse', async () => {
    // **The first review round's third finding.** `moved` is minted in the
    // revision the transaction ended on; the projection this window reads
    // afterwards is a separate command, and another program can rewrite the file
    // in between. Resolving by arena node alone then selects an unrelated snippet
    // and calls it the one the person has just made.
    const created: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: { document: 2, revision: 'rev-b', node: 42 }
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, creates: [created] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    // The re-read answers a parse that is not the one the save ended on, and it
    // reuses node 42 for a snippet nobody here created.
    documents.set(2, { ok: true, value: racedDocument() });
    await state.createMatch(2, NEW_MATCH, AT_END, OPEN_REVISION, NOTHING_ACKNOWLEDGED);

    // Ordinary repair (R27), not adoption: what sits at the held position is a
    // different snippet, so the selection is dropped and said to be dropped.
    expect(state.selected).toBeNull();
    expect(state.notice).toBe('differentMatch');
  }); // End of the "moved from another parse" case

  it('drops a selection lookup in flight when a create adopts', async () => {
    // **The first review round's fourth finding.** `select()` verifies its identity
    // across the boundary, and that answer can land *after* a commit has replaced
    // the projection it was taken from. Its repair then re-points the selection to
    // whatever the pre-save position now holds — dragging the person off the
    // snippet they have just made, with a notice about a file that moved under
    // them.
    const grown = grownDocument();
    const created: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: grown.matches[2]!.id
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const lookup = deferred<CommandResult<MatchView>>();
    const commands: BrowserCommands = {
      ...scriptedCommands({ documents, creates: [created], reload: { ok: true, value: grown } }),
      getMatch: vi.fn(() => lookup.promise)
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    // Selected, and still being checked across the boundary when the create lands.
    const selecting = state.select(baseDocument().matches[0]!);
    documents.set(2, { ok: true, value: grown });
    await state.createMatch(2, NEW_MATCH, AT_END, OPEN_REVISION, NOTHING_ACKNOWLEDGED);
    expect(state.selected?.id.node).toBe(42);

    lookup.resolve({
      ok: false,
      failure: {
        kind: 'command',
        error: { code: 'identityStaleRevision', expected: 'rev-b', found: 'rev-a' }
      }
    });
    await selecting;

    // The stale answer describes a parse this window has replaced, so it is
    // dropped whole rather than repaired: the person keeps the snippet they made.
    expect(state.selected?.id.node).toBe(42);
    expect(state.notice).toBeNull();
    expect(commands.reloadDocument).not.toHaveBeenCalled();
  }); // End of the "lookup in flight during a create" case

  it('does not drag the selection away from a snippet clicked while it was in flight', async () => {
    const grown = grownDocument();
    const created: SaveResult = {
      outcome: 'saved',
      revision: 'rev-b',
      committed: true,
      notes: [],
      backup_taken: false,
      moved: grown.matches[2]!.id
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const gate = deferred<CommandResult<SaveResult>>();
    const commands: BrowserCommands = {
      ...scriptedCommands({ documents }),
      createMatch: vi.fn(async () => gate.promise)
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const pending = state.createMatch(2, NEW_MATCH, AT_END, OPEN_REVISION, NOTHING_ACKNOWLEDGED);
    // The person picks something else while the create is being written.
    await state.select(otherDocument().matches[0]!);
    documents.set(2, { ok: true, value: grown });
    gate.resolve({ ok: true, value: created });
    await pending;

    // `saveMatch`'s rule, restated for an operation with no held target: the
    // selection moves only when nothing else has moved it since.
    expect(state.selected?.id.node).toBe(20);
    expect(state.selected?.document).toBe(3);
  }); // End of the "selection moved during the create" case

  it('does not select a snippet the middle pane is not showing', async () => {
    const grown = grownDocument();
    const created: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: grown.matches[2]!.id
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, creates: [created] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    // The sidebar is showing another file, so a snippet of `base.yml` is not in
    // the list at all and selecting one would point at a row nobody can see.
    state.show({ kind: 'document', id: 3 });
    await state.select(otherDocument().matches[0]!);

    documents.set(2, { ok: true, value: grown });
    await state.createMatch(2, NEW_MATCH, AT_END, OPEN_REVISION, NOTHING_ACKNOWLEDGED);

    expect(state.selected?.id.node).toBe(20);
    expect(state.notice).toBeNull();
  }); // End of the "out of scope" case

  it('re-reads the file when a failure may already have written it', async () => {
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, creates: [WRITE_MAY_HAVE_HAPPENED] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    documents.set(2, { ok: true, value: grownDocument() });
    expect(await state.createMatch(2, NEW_MATCH, AT_END, OPEN_REVISION, NOTHING_ACKNOWLEDGED)).toEqual({
      kind: 'failed',
      mayHaveWritten: true,
      failure: WRITE_MAY_HAVE_HAPPENED.ok ? null : WRITE_MAY_HAVE_HAPPENED.failure
    });
    expect(commands.getDocument).toHaveBeenCalledTimes(4);
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([40, 41, 42]);
  }); // End of the "may have written" case

  it('drops what it can no longer vouch for when the adoption itself fails, and says so', async () => {
    const created: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: { document: 2, revision: 'rev-b', node: 42 }
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, creates: [created] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    documents.set(2, {
      ok: false,
      failure: { kind: 'command', error: { code: 'unknownDocument', document: 2 } }
    });
    const answer = await state.createMatch(2, NEW_MATCH, AT_END, OPEN_REVISION, NOTHING_ACKNOWLEDGED);

    // A committed write is never afterwards reported as an error (D2): the failure
    // travels beside the outcome, and the outcome is still `saved`.
    expect(answer).toMatchObject({ kind: 'answered', adoption: { kind: 'failed' } });
    expect(answer.kind === 'answered' ? answer.result.outcome : null).toBe('saved');
    expect(state.scopedMatches).toEqual([]);
    expect(state.selected).toBeNull();
  }); // End of the "adoption failed" case

  it.each(['getDocument', 'documentText'] as const)(
    'answers a committed create as saved when the %s that follows it throws',
    async (thrower) => {
      // **Phase 2d-6-6c-1's review, first finding.** The transaction committed and
      // the barrier was told so; then a read this window makes afterwards threw.
      // Rejecting here let the form settle the create as a failed send that "may
      // have written" — a committed write reported afterwards as an error (D2).
      const created: CommandResult<SaveResult> = {
        ok: true,
        value: {
          outcome: 'saved',
          revision: 'rev-b',
          committed: true,
          notes: [],
          backup_taken: false,
          moved: { document: 2, revision: 'rev-b', node: 42 }
        }
      };
      const commands = scriptedCommands({ creates: [created] });
      const state = createBrowserState(commands, () => undefined);
      await state.open(null);
      state.show({ kind: 'document', id: 2 });
      await state.select(baseDocument().matches[0]!);
      await state.showFileText(true);

      vi.mocked(commands[thrower]).mockImplementation(async () => {
        throw new Error('the read after the commit threw');
      });
      const answer = await state.createMatch(
        2,
        NEW_MATCH,
        AT_END,
        OPEN_REVISION,
        NOTHING_ACKNOWLEDGED
      );

      expect(answer).toMatchObject({ kind: 'answered', adoption: { kind: 'failed' } });
      expect(answer.kind === 'answered' ? answer.result.outcome : null).toBe('saved');
    }
  ); // End of the "post-commit throw" case

  it('carries the disk projection a conflict handed back, and installs nothing', async () => {
    const disk = grownDocument();
    const conflict: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'conflict',
        reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
        expected: 'rev-a',
        found: 'rev-b',
        disk_revision: 'rev-b',
        disk_text: DISK_TEXT,
        disk
      }
    };
    const commands = scriptedCommands({ creates: [conflict] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    const answer = await state.createMatch(2, NEW_MATCH, AT_END, OPEN_REVISION, NOTHING_ACKNOWLEDGED);

    expect(answer).toMatchObject({ kind: 'answered', adoption: { kind: 'notOwed' } });
    expect(answer.kind === 'answered' ? answer.result.outcome : null).toBe('conflict');
    // **Nothing was written, so nothing here moves** (consult Q2): the list this
    // window shows is the one it loaded, not the one the conflict carried. Until
    // 2c-4a-2 this case asserted `[40, 41, 42]` — the disk side, installed.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11]);
    expect(disk.matches.map((match) => match.id.node)).toEqual([40, 41, 42]);
  }); // End of the "conflicted create" case
}); // End of the "creating a snippet" suite

describe('a committed operation whose follow-up read throws — Phase 2d-6-7a', () => {
  /** The four writing wrappers this suite drives after a commit. */
  type Operation = 'moveMatch' | 'deleteMatch' | 'duplicateMatch' | 'createMatch';
  /** The two reads a wrapper makes after its commit. */
  type Thrower = 'getDocument' | 'documentText';
  /** What the read throws: an `Error`, or a value whose `code` getter throws. */
  type Thrown = 'an error' | 'a value whose classification throws';

  /**
   * Sends one operation through the real `BrowserState` against a scripted
   * commit, after arming one of the two follow-up reads to throw.
   *
   * @param operation - The wrapper to drive.
   * @param thrower - The command that throws after the commit.
   * @param thrown - What it throws.
   * @returns The wrapper's answer, and the state it was sent through.
   */
  async function commitThenThrow(
    operation: Operation,
    thrower: Thrower,
    thrown: Thrown
  ): Promise<{ answer: MatchSaveAnswer; state: BrowserState }> {
    const committed: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: operation === 'deleteMatch' ? null : { document: 2, revision: 'rev-b', node: 31 }
      }
    };
    const commands = scriptedCommands({
      moves: [committed],
      deletes: [committed],
      duplicates: [committed],
      creates: [committed]
    });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);
    await state.showFileText(true);

    const hostile = Object.defineProperty({}, 'code', {
      get: (): never => {
        throw new Error('the code getter threw');
      }
    });
    vi.mocked(commands[thrower]).mockImplementation(async () => {
      if (thrown === 'an error') {
        throw new Error('the read after the commit threw');
      }
      throw hostile;
    });
    const source = baseDocument().matches[0]!.id;
    let answer: MatchSaveAnswer;
    switch (operation) {
      case 'moveMatch':
        answer = await state.moveMatch(source, null, OPEN_REVISION, NOTHING_ACKNOWLEDGED);
        break;
      case 'deleteMatch':
        answer = await state.deleteMatch(source, OPEN_REVISION, NOTHING_ACKNOWLEDGED);
        break;
      case 'duplicateMatch':
        answer = await state.duplicateMatch(source, OPEN_REVISION, NOTHING_ACKNOWLEDGED);
        break;
      case 'createMatch':
        answer = await state.createMatch(2, NEW_MATCH, AT_END, OPEN_REVISION, NOTHING_ACKNOWLEDGED);
        break;
    }
    return { answer, state };
  } // End of function commitThenThrow()

  it.each([
    ['moveMatch', 'getDocument', 'an error'],
    ['moveMatch', 'documentText', 'an error'],
    ['moveMatch', 'getDocument', 'a value whose classification throws'],
    ['moveMatch', 'documentText', 'a value whose classification throws'],
    ['deleteMatch', 'getDocument', 'an error'],
    ['deleteMatch', 'documentText', 'an error'],
    ['deleteMatch', 'getDocument', 'a value whose classification throws'],
    ['deleteMatch', 'documentText', 'a value whose classification throws'],
    ['duplicateMatch', 'getDocument', 'an error'],
    ['duplicateMatch', 'documentText', 'an error'],
    ['duplicateMatch', 'getDocument', 'a value whose classification throws'],
    ['duplicateMatch', 'documentText', 'a value whose classification throws'],
    ['createMatch', 'getDocument', 'a value whose classification throws'],
    ['createMatch', 'documentText', 'a value whose classification throws']
  ] as const)(
    'answers a committed %s as saved when its %s throws %s',
    async (operation, thrower, thrown) => {
      // **`2d-6-6c-2-notes.md` §5 items 2 and 7.** The transaction committed and
      // the barrier was told so; then a read this window makes afterwards threw.
      // A wrapper that lets that exception out — or that classifies it with a
      // `classifyFailure` a hostile `code` getter can make throw — rejects its
      // promise, and the panel draws a committed write as an error (D2).
      const { answer, state } = await commitThenThrow(operation, thrower, thrown);

      expect(answer).toMatchObject({ kind: 'answered', adoption: { kind: 'failed' } });
      expect(answer.kind === 'answered' ? answer.result.outcome : null).toBe('saved');
      // The barrier closed on the settlement the commit established.
      expect(state.writeInFlight(2)).toBe(false);
    }
  ); // End of the "post-commit throw" cases

  it.each(['saveMatch', 'createMatch', 'moveMatch', 'duplicateMatch'] as const)(
    'answers a committed %s as saved when the result’s moved getter throws (the review’s should-fix)',
    async (operation) => {
      // **Phase 2d-6-7a's review.** The shared helper's catch covers only what
      // runs inside its thunk; a wrapper that read `answer.value.moved` (or the
      // attribution's `committed`) before calling it let that getter's exception
      // reject a committed write (D2).
      const value = {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false
      } as const;
      const hostile = Object.defineProperty({ ...value }, 'moved', {
        enumerable: true,
        get: (): never => {
          throw new Error('the moved getter threw');
        }
      }) as unknown as SaveResult;
      const committed: CommandResult<SaveResult> = { ok: true, value: hostile };
      const commands = scriptedCommands({
        saves: [committed],
        creates: [committed],
        moves: [committed],
        duplicates: [committed]
      });
      const state = createBrowserState(commands, () => undefined);
      await state.open(null);
      state.show({ kind: 'document', id: 2 });
      await state.select(baseDocument().matches[0]!);
      const source = baseDocument().matches[0]!.id;
      let answer: MatchSaveAnswer;
      switch (operation) {
        case 'saveMatch':
          answer = await state.saveMatch(source, editedDraft(), OPEN_REVISION, NOTHING_ACKNOWLEDGED);
          break;
        case 'createMatch':
          answer = await state.createMatch(2, NEW_MATCH, AT_END, OPEN_REVISION, NOTHING_ACKNOWLEDGED);
          break;
        case 'moveMatch':
          answer = await state.moveMatch(source, null, OPEN_REVISION, NOTHING_ACKNOWLEDGED);
          break;
        case 'duplicateMatch':
          answer = await state.duplicateMatch(source, OPEN_REVISION, NOTHING_ACKNOWLEDGED);
          break;
      }
      expect(answer.kind).toBe('answered');
      expect(answer.kind === 'answered' ? answer.result.outcome : null).toBe('saved');
      expect(answer.kind === 'answered' ? answer.adoption.kind : null).toBe('failed');
      expect(state.writeInFlight(2)).toBe(false);
    }
  ); // End of the "hostile moved getter" cases
}); // End of the "committed operation whose follow-up read throws" suite

describe('a raw save whose follow-up read throws — Phase 2d-6-8a', () => {
  /** The two reads the raw wrapper makes after the command answered. */
  type Thrower = 'getDocument' | 'documentText';
  /** What the read throws: an `Error`, or a value whose `code` getter throws. */
  type Thrown = 'an error' | 'a value whose classification throws';

  /**
   * A thrown value `classifyFailure` cannot classify: its `code` getter throws.
   *
   * @returns A fresh hostile value.
   */
  function hostileValue(): object {
    return Object.defineProperty({}, 'code', {
      get: (): never => {
        throw new Error('the code getter threw');
      }
    });
  } // End of function hostileValue()

  /**
   * Builds a state over a scripted raw save and arms one follow-up read to throw.
   *
   * @param raw - What the raw save command answers.
   * @param thrower - The command that throws once the save has answered.
   * @param thrown - What it throws.
   * @returns The state and its commands.
   */
  async function armed(
    raw: CommandResult<SaveResult>,
    thrower: Thrower,
    thrown: Thrown
  ): Promise<{ state: BrowserState; commands: BrowserCommands }> {
    const commands = scriptedCommands({ raws: [raw] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);
    await state.showFileText(true);
    const hostile = hostileValue();
    vi.mocked(commands[thrower]).mockImplementation(async () => {
      if (thrown === 'an error') {
        throw new Error('the read after the raw save threw');
      }
      throw hostile;
    });
    return { state, commands };
  } // End of function armed()

  it.each([
    ['getDocument', 'an error'],
    ['documentText', 'an error'],
    ['getDocument', 'a value whose classification throws'],
    ['documentText', 'a value whose classification throws']
  ] as const)(
    'answers a committed raw save as sealed when its %s throws %s',
    async (thrower, thrown) => {
      // **The audit 2d-6-8a owed (`2d-6-7a-notes.md` §4 item 5).** The bytes are
      // on disk. The reload the command awaits is this state's own closure, and the
      // command classifies whatever it throws — with a `classifyFailure` a hostile
      // `code` getter makes throw, so the committed write came back as a rejection
      // (D2), the shape 2d-6-6c-2's review fixed in `saveMatch`.
      const { state } = await armed(RAW_COMMITTED, thrower, thrown);

      const answer = await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);

      expect(answer.kind).toBe('sealed');
      expect(issuerInvalidationOf(answer)?.kind).toBe('failed');
      expect(state.writeInFlight(2)).toBe(false);
    }
  ); // End of the "committed raw save, follow-up throw" cases

  it.each([
    ['getDocument', 'an error'],
    ['documentText', 'an error'],
    ['getDocument', 'a value whose classification throws'],
    ['documentText', 'a value whose classification throws']
  ] as const)(
    'answers a raw save that may have written as failed when its re-read %s throws %s',
    async (thrower, thrown) => {
      // The other post-answer path: a failure that may have renamed the candidate
      // into place. The re-read this wrapper then owes is awaited with no catch, so
      // an exception out of it rejected the wrapper and the one fact a screen needs
      // — *the file may already hold your text* — never reached it.
      const failure: IpcFailure = {
        kind: 'command',
        error: {
          code: 'saveFailed',
          error: { Write: { Io: { step: 'SyncDirectory', path: '/tmp/espanso/match/base.yml', kind: 'Interrupted', raw_os_error: 4 } } },
          may_have_written: true
        }
      };
      const { state } = await armed({ ok: false, failure }, thrower, thrown);

      const answer = await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);

      expect(answer).toEqual({ kind: 'failed', mayHaveWritten: true });
      expect(state.writeInFlight(2)).toBe(false);
    }
  ); // End of the "may have written, re-read throws" cases

  /**
   * A thrown value `isCommandError` accepts on its one read of `code`, and whose
   * every later read of `code` throws a value no classifier can read — the
   * review of Phase 2d-6-8a, its blocker.
   *
   * @returns A fresh flaky value.
   */
  function flakyCommandError(): object {
    let reads = 0;
    return Object.defineProperty({}, 'code', {
      enumerable: true,
      get: (): string => {
        reads += 1;
        if (reads === 1) {
          return 'noWorkspaceOpen';
        }
        // What the second read throws is itself unclassifiable, so nothing
        // downstream that classifies it — the command's own catch included — can
        // turn it back into an answer.
        throw hostileValue();
      }
    });
  } // End of function flakyCommandError()

  it.each([
    ['committed', 'getDocument'],
    ['committed', 'documentText'],
    ['may have written', 'getDocument'],
    ['may have written', 'documentText']
  ] as const)(
    'answers a %s raw save as such when its %s throws a value the default reporter cannot read (the review’s blocker)',
    async (path, thrower) => {
      // **The review of Phase 2d-6-8a, its blocker.** The guarded classifier reads
      // `code` once and accepts the value as a command error; the default
      // reporter, `reportIpcFailure`, then reads `failure.error.code` again, and
      // that second read throws — from inside the very catch meant to keep a
      // written file's answer from becoming an error.
      const failure: IpcFailure = {
        kind: 'command',
        error: {
          code: 'saveFailed',
          error: { Write: { Io: { step: 'SyncDirectory', path: '/tmp/espanso/match/base.yml', kind: 'Interrupted', raw_os_error: 4 } } },
          may_have_written: true
        }
      };
      const raw: CommandResult<SaveResult> = path === 'committed' ? RAW_COMMITTED : { ok: false, failure };
      const commands = scriptedCommands({ raws: [raw] });
      // The default reporter, on purpose: the third argument's default is what
      // production runs.
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const state = createBrowserState(commands);
      await state.open(null);
      state.show({ kind: 'document', id: 2 });
      await state.select(baseDocument().matches[0]!);
      await state.showFileText(true);
      vi.mocked(commands[thrower]).mockImplementation(async () => {
        throw flakyCommandError();
      });

      const answer = await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
      warn.mockRestore();

      if (path === 'committed') {
        expect(answer.kind).toBe('sealed');
        expect(issuerInvalidationOf(answer)?.kind).toBe('failed');
      } else {
        expect(answer).toEqual({ kind: 'failed', mayHaveWritten: true });
      }
      expect(state.writeInFlight(2)).toBe(false);
    }
  ); // End of the "default reporter cannot read the failure" cases
}); // End of the "raw save whose follow-up read throws" suite

describe('recovering a draft no reapply could resolve', () => {
  /**
   * An installation that puts the waiting form nowhere.
   *
   * These cases are about what reaches the boundary and what the wrapper does with
   * the answer, never about the screen the form is drawn on; `sendRecoveryCreate`
   * requires the argument all the same, so they say so rather than omit it.
   */
  const INSTALLS_NOTHING: InstallTheWaitingForm = () => {};

  /**
   * The conflict a match editor is showing over this state's own `base.yml`.
   *
   * The disk side is {@link grownDocument}, at `rev-b`, while the window goes on
   * projecting `rev-a` — which is the whole point of the `manualResolution` arm:
   * nothing was adopted, so the two observations are both live.
   *
   * @param buffers - The draft the conflict retained.
   * @returns The conflict model, built through the ordinary describer.
   */
  function editorConflict(buffers: MatchBuffers): ConflictModel<MatchBuffers> {
    const outcome = describeEditSave(
      makeConflict({ disk: grownDocument(), expected: 'rev-a' }),
      startDraft('rev-a', buffers, structuredDraftRules<MatchBuffers>()),
      MATCH_EDITOR_CAPABILITIES
    );
    if (outcome.kind !== 'conflict') {
      throw new Error('this helper needs the conflict arm');
    }
    return outcome;
  } // End of function editorConflict()

  /**
   * A recovery form opened over that conflict, against this state's own files.
   *
   * @param state - The window, opened.
   * @returns The form.
   */
  function recoveryOver(
    state: BrowserState,
    match: MatchView = makeMatch({
      // The snippet the editor was open on, with a body: `baseDocument`'s fixtures
      // carry no `replace`, and a draft that transfers none opens its body box
      // blank and refuses until a person fills it in.
      node: 10,
      document: 2,
      trigger: ':sig',
      replace: 'a body',
      label: 'Signature'
    }),
    conflict: ConflictModel<MatchBuffers> | null = null
  ): RecoverySession {
    const baseline = baselineOf(match);
    const start = startMatchFieldRecovery(
      { kind: 'manualResolution', obstacle: { kind: 'evidenceNotATarget' } },
      conflict ?? editorConflict(buffersOf(baseline)),
      baseline,
      state.documents,
      state.views,
      () => 0
    );
    if (start.kind !== 'ready') {
      throw new Error(`this helper needs an opened form, not ${start.reason}`);
    }
    return start.session;
  } // End of function recoveryOver()

  /**
   * A conflict this state really produced, so its adoption is authorizable.
   *
   * **Built by driving a save rather than by hand**, which is the whole point:
   * `BrowserState.adoptDiskVersion` looks a conflict up in the origin map this
   * state fills when one arrives, so a `makeConflict` literal would be refused for
   * the wrong reason and prove nothing about the authorization.
   *
   * @param state - The window, opened.
   * @returns The conflict model, over a draft of the snippet that was edited.
   */
  async function conflictFromASave(state: BrowserState): Promise<ConflictModel<MatchBuffers>> {
    const answer = await state.saveMatch(
      baseDocument().matches[0]!.id,
      editedDraft(),
      'rev-a',
      NOTHING_ACKNOWLEDGED
    );
    if (answer.kind !== 'answered' || answer.result.outcome !== 'conflict') {
      throw new Error('this helper needs the conflict arm');
    }
    const buffers = buffersOf(
      baselineOf(
        makeMatch({ node: 10, document: 2, trigger: ':sig', replace: 'a body', label: 'Signature' })
      )
    );
    const outcome = describeEditSave(
      answer.result,
      startDraft('rev-a', buffers, structuredDraftRules<MatchBuffers>()),
      MATCH_EDITOR_CAPABILITIES
    );
    if (outcome.kind !== 'conflict') {
      throw new Error('this helper needs the conflict arm');
    }
    return outcome;
  } // End of function conflictFromASave()

  /** The conflict `saveMatch` is scripted to answer in the cases below. */
  const SAVE_CONFLICTED: CommandResult<SaveResult> = {
    ok: true,
    value: {
      outcome: 'conflict',
      reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
      expected: 'rev-a',
      found: 'rev-b',
      disk_revision: 'rev-b',
      disk_text: DISK_TEXT,
      disk: grownDocument()
    }
  };

  it('writes through this state’s own create, at the end, with the disk revision', async () => {
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const grown = grownDocument();
    const created: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: grown.matches[2]!.id
      }
    };
    const commands = scriptedCommands({ documents, creates: [created] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    // **The composition really is this state's method**, which is what the
    // callback type exists to say: `MatchSaveAnswer` satisfies it structurally, so
    // there is no second writer and no new command anywhere on this path.
    const create: CreateARecoveredSnippet = state.createMatch;
    documents.set(2, { ok: true, value: grown });
    const after = await sendTracking(recoveryOver(state), create, INSTALLS_NOTHING);

    const call = vi.mocked(commands.createMatch).mock.calls[0]!;
    expect(call[0]).toBe(2);
    expect(call[1]).toEqual({
      trigger: { Single: ':sig' },
      content: { Replace: 'a body' },
      label: 'Signature'
    });
    expect(call[2]).toEqual({ End: {} });
    // The **disk** revision the conflict carried, not the `rev-a` this window is
    // still projecting: recovery drafts against the observation that refused the
    // save, and the wrapper forwards what it is handed.
    expect(call[3]).toBe('rev-b');
    expect(call[4]).toEqual(NOTHING_ACKNOWLEDGED);
    expect(JSON.stringify(call.slice(0, 5))).not.toContain('force');
    expect(after.committed).toBe(true);
    expect(sourceConflictState(after)).toBe('spent');
  }); // End of the "one ordinary create" case

  it('does not drag the selection away from a snippet clicked while it was in flight', async () => {
    const grown = grownDocument();
    const created: SaveResult = {
      outcome: 'saved',
      revision: 'rev-b',
      committed: true,
      notes: [],
      backup_taken: false,
      moved: grown.matches[2]!.id
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const gate = deferred<CommandResult<SaveResult>>();
    const commands: BrowserCommands = {
      ...scriptedCommands({ documents }),
      createMatch: vi.fn(async () => gate.promise)
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const pending = sendTracking(recoveryOver(state), state.createMatch, INSTALLS_NOTHING);
    // The person picks something else while the recovered snippet is being
    // written. The guard is the wrapper's own and holds at the write; recovery
    // neither observes the selection nor writes to it.
    await state.select(otherDocument().matches[0]!);
    documents.set(2, { ok: true, value: grown });
    gate.resolve({ ok: true, value: created });
    await pending;

    expect(state.selected?.id.node).toBe(20);
    expect(state.selected?.document).toBe(3);
  }); // End of the "selection moved during the recovery create" case

  it('gives an operation choice and the raw editor no create offer', async () => {
    // **Narrowed after the review's fourth finding**, which is right that the
    // previous version proved nothing about commands: it called one pure function
    // that receives neither this state nor its command surface, then asserted six
    // unrelated mocks were untouched. What can fail is below — the mock that the
    // exercised path really does call — and in `recovery.test.ts`, whose dependency
    // check fails if the module gains a route to the command layer at all.
    const commands = scriptedCommands();
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const identity = describeEditSave(
      makeConflict({ disk: grownDocument(), expected: 'rev-a' }),
      startDraft('rev-a', baseDocument().matches[0]!.id, structuredDraftRules<MatchId>()),
      MATCH_EDITOR_CAPABILITIES
    );
    const text = describeEditSave(
      makeConflict({ disk: grownDocument(), expected: 'rev-a' }),
      startDraft('rev-a', DISK_TEXT, textDraftRules),
      MATCH_EDITOR_CAPABILITIES
    );
    expect(identity.kind).toBe('conflict');
    expect(text.kind).toBe('conflict');

    expect(
      recoveryAvailability(
        'operationChoice',
        { kind: 'manualResolution', obstacle: { kind: 'evidenceNotATarget' } },
        identity.kind === 'conflict' ? identity : null,
        state.documents,
        state.views
      )
    ).toEqual({ kind: 'unavailable', reason: 'operationDraft' });
    expect(
      recoveryAvailability(
        'wholeDocumentText',
        { kind: 'manualResolution', obstacle: { kind: 'evidenceNotATarget' } },
        text.kind === 'conflict' ? text : null,
        state.documents,
        state.views
      )
    ).toEqual({ kind: 'unavailable', reason: 'wholeDocumentDraft' });

  }); // End of the "no create offer" case

  it('sends nothing through this state for a form that may not be submitted', async () => {
    const commands = scriptedCommands({ creates: [{ ok: true, value: CREATED_NOTHING }] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    // `baseDocument`'s snippets carry no `replace`, so the transfer carries no
    // body and the form refuses until a person supplies one.
    const blank = recoveryOver(state, baseDocument().matches[0]!);
    expect(recoveryRefusal(blank)).toBe('replaceEmpty');
    expect(await sendTracking(blank, state.createMatch, INSTALLS_NOTHING)).toBe(blank);
    expect(commands.createMatch).not.toHaveBeenCalled();

    // **And the same mock is reached the moment the refusal is gone**, which is
    // what stops the assertion above from being one that cannot fail.
    await sendTracking(
      editRecoveryField(blank, 'replace', 'a body'),
      state.createMatch,
      INSTALLS_NOTHING
    );
    expect(commands.createMatch).toHaveBeenCalledTimes(1);
  }); // End of the "nothing sent while a refusal stands" case

  it('stops calling the source conflict intact once an uncertain send reconciled the window', async () => {
    // **The review's High, against the real wrapper.** A failure whose
    // `mayHaveWritten` is true makes `BrowserState.createMatch` re-read the file,
    // install the projection and repair the selection — so the window the conflict
    // came from is gone, and `!committed` was never a claim the model could make
    // about it.
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({
      documents,
      saves: [SAVE_CONFLICTED],
      creates: [WRITE_MAY_HAVE_HAPPENED]
    });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);
    const conflict = await conflictFromASave(state);
    const reads = vi.mocked(commands.getDocument).mock.calls.length;

    // The re-read finds a third revision, which is neither what the window held
    // nor what the conflict carried.
    documents.set(2, { ok: true, value: thinnedDocument() });
    const after = await sendTracking(
      recoveryOver(state, undefined, conflict),
      state.createMatch,
      INSTALLS_NOTHING
    );

    expect(after.sendFailure?.kind).toBe('mayHaveWritten');
    expect(after.committed).toBe(false);
    expect(vi.mocked(commands.getDocument).mock.calls.length).toBe(reads + 1);
    expect(state.views.find((view) => view.id === 2)?.revision).toBe('rev-c');
    // The selection no longer names the parse the conflict was about.
    expect(state.selected).toBeNull();
    // The window moved, so the model says so — and the conflict's one-shot
    // authorization is refused by the projection-generation guard it is keyed to.
    expect(sourceConflictState(after)).toBe('windowMoved');
    expect(recoveryView(after).sourceConflict).toBe('windowMoved');
    expect(state.adoptDiskVersion(conflict, confirmReloadDiskVersion(conflict))).toBe('refused');
  }); // End of the "uncertain send reconciled the window" case

  it('leaves the window and the authorization alone when the send wrote nothing', async () => {
    // The other side of the same pair, and what makes it falsifiable: an ordinary
    // rejection reconciles nothing, so the projection, the selection and the
    // conflict's authorization are all exactly where they were.
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, saves: [SAVE_CONFLICTED] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);
    const conflict = await conflictFromASave(state);
    const reads = vi.mocked(commands.getDocument).mock.calls.length;

    const after = await sendTracking(
      recoveryOver(state, undefined, conflict),
      state.createMatch,
      INSTALLS_NOTHING
    );

    expect(after.sendFailure).toEqual({
      kind: 'notSent',
      reason: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
    });
    expect(vi.mocked(commands.getDocument).mock.calls.length).toBe(reads);
    expect(state.views.find((view) => view.id === 2)?.revision).toBe('rev-a');
    expect(state.selected?.id.node).toBe(10);
    expect(sourceConflictState(after)).toBe('retained');
    // The authorization is still the person's to spend, which is what `retained`
    // claims and what the case above shows it cannot claim.
    expect(state.adoptDiskVersion(conflict, confirmReloadDiskVersion(conflict))).toBe('installed');
  }); // End of the "nothing was written" case

  it('stops calling it intact when a saved arm that committed nothing reconciled the window', async () => {
    // The second half of the review's High: a recovery create is based on the
    // conflict's disk revision while the window projects the older one, so even a
    // `committed: false` result is out of date to the wrapper, which adopts.
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const wroteNothing: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: false,
        notes: [],
        backup_taken: false,
        moved: null
      }
    };
    const commands = scriptedCommands({
      documents,
      saves: [SAVE_CONFLICTED],
      creates: [wroteNothing]
    });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);
    const conflict = await conflictFromASave(state);

    documents.set(2, { ok: true, value: thinnedDocument() });
    const after = await sendTracking(
      recoveryOver(state, undefined, conflict),
      state.createMatch,
      INSTALLS_NOTHING
    );

    expect(after.committed).toBe(false);
    expect(after.outcome?.kind).toBe('saved');
    expect(state.views.find((view) => view.id === 2)?.revision).toBe('rev-c');
    expect(sourceConflictState(after)).toBe('windowMoved');
    expect(state.adoptDiskVersion(conflict, confirmReloadDiskVersion(conflict))).toBe('refused');
  }); // End of the "committed nothing, reconciled anyway" case

  it('offers the other file when the conflict’s own has lost its snippet list', async () => {
    const commands = scriptedCommands();
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const listless = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-b',
      topLevelKeys: ['global_vars']
    });
    const outcome = describeEditSave(
      makeConflict({ disk: listless, expected: 'rev-a' }),
      startDraft('rev-a', buffersOf(baselineOf(baseDocument().matches[0]!)), structuredDraftRules<MatchBuffers>()),
      MATCH_EDITOR_CAPABILITIES
    );
    const offer = recoveryAvailability(
      'matchFields',
      { kind: 'manualResolution', obstacle: { kind: 'evidenceNotATarget' } },
      outcome.kind === 'conflict' ? outcome : null,
      state.documents,
      state.views
    );
    // A missing `matches:` list is not permission to create one: the file is not
    // offered, the other snippet file is, and nothing has been written.
    expect(offer).toEqual({
      kind: 'offered',
      choices: ['createFromSupportedFields'],
      destinations: [{ document: 3, path: 'match/other.yml', revision: 'rev-a' }]
    });
    expect(commands.createMatch).not.toHaveBeenCalled();
  }); // End of the "missing sequence" case
}); // End of the "recovering a draft" suite

describe('deleting a snippet', () => {
  it('sends the identity, the revision this state is projecting, and no flag', async () => {
    const commands = scriptedCommands({ deletes: [{ ok: true, value: CREATED_NOTHING }] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const id = baseDocument().matches[0]!.id;
    await state.deleteMatch(id, OPEN_REVISION, NOTHING_ACKNOWLEDGED);

    const call = vi.mocked(commands.deleteMatch).mock.calls[0]!;
    expect(call[0]).toEqual(id);
    expect(call[1]).toBe('rev-a');
    expect(call[2]).toEqual(NOTHING_ACKNOWLEDGED);
    expect(JSON.stringify(call.slice(0, 3))).not.toContain('force');
  }); // End of the "arguments" case

  it('refuses to send anything for a document this state does not describe', async () => {
    const commands = scriptedCommands();
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const stranger = makeMatch({ node: 99, document: 99 }).id;
    expect(await state.deleteMatch(stranger, OPEN_REVISION, NOTHING_ACKNOWLEDGED)).toEqual({
      kind: 'notAttempted'
    });
    expect(commands.deleteMatch).not.toHaveBeenCalled();
  });

  it('sends the session’s own base revision, never the one it is projecting', async () => {
    // The same finding as the create's, and it bites harder here: a deletion
    // resolves an identity to a **position**, so a stale identity beside a fresh
    // base is answered as an identity failure rather than as the revision conflict
    // the person should be shown — and nothing in this window decided that.
    const commands = scriptedCommands({ deletes: [{ ok: true, value: CREATED_NOTHING }] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    const id = baseDocument().matches[0]!.id;
    await state.deleteMatch(id, 'rev-older', NOTHING_ACKNOWLEDGED);

    // The state really is projecting something else, so this is not the same value
    // arriving by another route.
    expect(state.scopedDocument?.revision).toBe('rev-a');
    expect(vi.mocked(commands.deleteMatch).mock.calls[0]![1]).toBe('rev-older');
  }); // End of the "stale session" case

  it('keeps no pre-commit identity anywhere after a commit that answered none', async () => {
    // **The consult's Q7, and the reason the fixture churns every identity.** The
    // likeliest defect is reading `moved: null` as "leave the selection alone" and
    // then holding the deleted — or another pre-commit — `MatchId` over a
    // projection that has been replaced. A fixture whose surviving identities
    // happened to stay equal would let exactly that pass.
    const before = crowdedDocument();
    const after = thinnedDocument();
    const deleted: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-c',
        committed: true,
        notes: [{ DoubledSequenceSeparation: { edit: 0 } }],
        backup_taken: true,
        // Null by construction, permanently: the snippet that was deleted has no
        // identity in the new revision.
        moved: null
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: before }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, deletes: [deleted] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(before.matches[0]!);
    await state.showFileText(true);

    documents.set(2, { ok: true, value: after });
    const answer = await state.deleteMatch(before.matches[0]!.id, OPEN_REVISION, NOTHING_ACKNOWLEDGED);

    expect(answer).toMatchObject({ kind: 'answered', adoption: { kind: 'done' } });
    const stale = new Set(identitiesOf(before));
    for (const identity of identitiesOf({ ...after, matches: state.scopedMatches })) {
      expect(stale.has(identity)).toBe(false);
    } // End of the loop over every identity the view now holds
    const held = state.selected;
    expect(held).not.toBeNull();
    expect(stale.has(`${held!.id.document}/${held!.id.revision}/${held!.id.node}`)).toBe(false);
    // The snippet now at the deleted one's former ordinal position, adopted under
    // its own new identity.
    expect(held!.id.node).toBe(50);
    expect(held!.position).toBe(0);
    expect(state.notice).toBe('deleted');
    expect(commands.documentText).toHaveBeenCalledTimes(2);
  }); // End of the consult's Q7 case

  it('drops a selection lookup in flight when a deletion adopts', async () => {
    // **The first review round's fourth finding, in the shape it was found in.**
    // Start selecting the snippet, delete it while its `get_match` is still in
    // flight, and let the adoption select the neighbour with the `deleted` notice
    // the consult's Q1 mandates. The stale answer then lands, repairs the
    // pre-commit identity against the file the deletion produced, and replaces
    // that notice with `differentMatch` — telling the person their file moved
    // under them when what happened is the deletion they asked for.
    const before = crowdedDocument();
    const after = thinnedDocument();
    const deleted: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-c',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: null
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: before }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const lookup = deferred<CommandResult<MatchView>>();
    const commands: BrowserCommands = {
      ...scriptedCommands({ documents, deletes: [deleted], reload: { ok: true, value: after } }),
      getMatch: vi.fn(() => lookup.promise)
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    const selecting = state.select(before.matches[0]!);
    documents.set(2, { ok: true, value: after });
    await state.deleteMatch(before.matches[0]!.id, OPEN_REVISION, NOTHING_ACKNOWLEDGED);
    expect(state.notice).toBe('deleted');

    lookup.resolve({
      ok: false,
      failure: {
        kind: 'command',
        error: { code: 'identityStaleRevision', expected: 'rev-c', found: 'rev-a' }
      }
    });
    await selecting;

    expect(state.selected?.id.node).toBe(50);
    expect(state.notice).toBe('deleted');
    expect(commands.reloadDocument).not.toHaveBeenCalled();
  }); // End of the "lookup in flight during a deletion" case

  it('falls back to the new last snippet when the one deleted was last', async () => {
    const before = crowdedDocument();
    const after = thinnedDocument();
    const deleted: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-c',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: null
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: before }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, deletes: [deleted] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(before.matches[2]!);

    documents.set(2, { ok: true, value: after });
    await state.deleteMatch(before.matches[2]!.id, OPEN_REVISION, NOTHING_ACKNOWLEDGED);

    expect(state.selected?.id.node).toBe(51);
    expect(state.selected?.position).toBe(1);
    expect(state.notice).toBe('deleted');
  }); // End of the "deleted the last snippet" case

  it('selects nothing when the file no longer holds any snippet', async () => {
    // The wrapper does not repeat `matchDeletion.ts`'s last-snippet refusal — the
    // core is what decides, and this is what the window does if it ever commits.
    const before = baseDocument();
    const empty = makeDocument({ id: 2, relativePath: 'match/base.yml', revision: 'rev-c' });
    const deleted: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-c',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: null
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: before }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, deletes: [deleted] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(before.matches[0]!);

    documents.set(2, { ok: true, value: empty });
    await state.deleteMatch(before.matches[0]!.id, OPEN_REVISION, NOTHING_ACKNOWLEDGED);

    expect(state.selected).toBeNull();
    expect(state.notice).toBe('deleted');
    expect(state.scopedMatches).toEqual([]);
  }); // End of the "file now holds none" case

  it('repairs another snippet’s selection the ordinary way, and does not hijack it', async () => {
    const before = crowdedDocument();
    const after = thinnedDocument();
    const deleted: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-c',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: null
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: before }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, deletes: [deleted] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    // The person is looking at the *second* snippet and deletes the first.
    await state.select(before.matches[1]!);

    documents.set(2, { ok: true, value: after });
    await state.deleteMatch(before.matches[0]!.id, OPEN_REVISION, NOTHING_ACKNOWLEDGED);

    // R27, unchanged: what is at the held position is a different snippet, so the
    // selection is dropped with its own notice rather than re-pointed — and the
    // deletion path did not take it over.
    expect(state.selected).toBeNull();
    expect(state.notice).toBe('differentMatch');
  }); // End of the "another snippet was selected" case

  it('re-reads the file when a failure may already have written it', async () => {
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, deletes: [WRITE_MAY_HAVE_HAPPENED] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    documents.set(2, { ok: true, value: thinnedDocument() });
    expect(
      await state.deleteMatch(baseDocument().matches[0]!.id, OPEN_REVISION, NOTHING_ACKNOWLEDGED)
    ).toEqual({
      kind: 'failed',
      mayHaveWritten: true,
      failure: WRITE_MAY_HAVE_HAPPENED.ok ? null : WRITE_MAY_HAVE_HAPPENED.failure
    });
    expect(commands.getDocument).toHaveBeenCalledTimes(4);
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([50, 51]);
  }); // End of the "may have written" case

  it('drops what it can no longer vouch for when the adoption itself fails, and says so', async () => {
    const before = crowdedDocument();
    const deleted: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-c',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: null
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: before }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, deletes: [deleted] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(before.matches[0]!);

    documents.set(2, {
      ok: false,
      failure: { kind: 'command', error: { code: 'unknownDocument', document: 2 } }
    });
    const answer = await state.deleteMatch(before.matches[0]!.id, OPEN_REVISION, NOTHING_ACKNOWLEDGED);

    expect(answer).toMatchObject({ kind: 'answered', adoption: { kind: 'failed' } });
    expect(answer.kind === 'answered' ? answer.result.outcome : null).toBe('saved');
    expect(state.scopedMatches).toEqual([]);
    expect(state.selected).toBeNull();
  }); // End of the "adoption failed" case

  it('carries the disk projection a conflict handed back, and installs nothing', async () => {
    const disk = thinnedDocument();
    const conflict: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'conflict',
        reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
        expected: 'rev-a',
        found: 'rev-c',
        disk_revision: 'rev-c',
        disk_text: DISK_TEXT,
        disk
      }
    };
    const commands = scriptedCommands({ deletes: [conflict] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    const answer = await state.deleteMatch(baseDocument().matches[0]!.id, OPEN_REVISION, NOTHING_ACKNOWLEDGED);

    expect(answer).toMatchObject({ kind: 'answered', adoption: { kind: 'notOwed' } });
    expect(answer.kind === 'answered' ? answer.result.outcome : null).toBe('conflict');
    // **Nothing was written, so nothing here moves** (consult Q2). Until 2c-4a-2
    // this case asserted `[50, 51]` — the disk side, installed for a deletion that
    // deleted nothing.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11]);
    expect(disk.matches.map((match) => match.id.node)).toEqual([50, 51]);
  }); // End of the "conflicted deletion" case
}); // End of the "deleting a snippet" suite

/**
 * A stale-identity answer, for the three cases below.
 *
 * The failure a `get_match` gives when the identity it was handed was minted in a
 * parse the file has moved on from — the one answer that sends `select()` into the
 * recovery path, which is where every cancellation below can be observed.
 */
const STALE_IDENTITY: CommandResult<MatchView> = {
  ok: false,
  failure: {
    kind: 'command',
    error: { code: 'identityStaleRevision', expected: 'rev-b', found: 'rev-a' }
  }
};

/**
 * A projection of `match/other.yml` holding a **different** snippet.
 *
 * What a re-resolution of that file finds when it runs: the held position is
 * occupied by something whose source text is not the selection's, which is R27's
 * `differentMatch` and clears the selection with a notice. Its whole purpose is to
 * make a repair that runs *visible*, so that a test asserting one did not run
 * cannot pass by finding the same snippet again.
 *
 * @returns The projection.
 */
function restockedOtherDocument(): DocumentView {
  return makeDocument({
    id: 3,
    relativePath: 'match/other.yml',
    revision: 'rev-b',
    matches: [makeMatch({ node: 21, document: 3, revision: 'rev-b', trigger: ':psql', label: 'Other' })]
  });
} // End of function restockedOtherDocument()

describe('what cancels a selection lookup, and what does not', () => {
  it('repairs a stale identity in one file when another file is replaced whole', async () => {
    // **The confirmation pass's High finding, and it was a regression the first fix
    // round introduced.** That round closed a narrower defect by bumping a single
    // global counter in `installView`, and made `forgetTheReplacedDocument`'s bump
    // unconditional beside it. The trade: a raw save of file B committing while a
    // click on a snippet of file A was still being checked across the boundary
    // cancelled A's lookup, so A's stale identity was never repaired and the state
    // went on holding a `MatchId` that resolves to nothing — this sub-phase's
    // declared worst failure. B's invalidation is a statement about B.
    const committed: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: null
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const lookup = deferred<CommandResult<MatchView>>();
    const commands: BrowserCommands = {
      ...scriptedCommands({
        documents,
        raws: [committed],
        reload: { ok: true, value: restockedOtherDocument() }
      }),
      getMatch: vi.fn(() => lookup.promise)
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    // A click on a snippet of file 3, still being checked across the boundary.
    const selecting = state.select(otherDocument().matches[0]!);
    // File 2's whole text is replaced and committed while it is in flight. Nothing
    // here is about file 3: the selection is not in it, and its projection is
    // untouched.
    await state.saveRawDocument(2, OPEN_REVISION, '# replaced\n', NOTHING_ACKNOWLEDGED);
    expect(state.selected?.id.node).toBe(20);

    lookup.resolve(STALE_IDENTITY);
    await selecting;

    // The repair ran, and it ran against file 3.
    expect(commands.reloadDocument).toHaveBeenCalledWith(3);
    // R27: the snippet at the held position is a different one, so the selection is
    // dropped with a notice rather than left naming a parse that is gone.
    expect(state.selected).toBeNull();
    expect(state.notice).toBe('differentMatch');
  }); // End of the "another file was replaced" case

  it('drops a stale identity lookup when the file it names is the one replaced', async () => {
    // The twin, and the cancellation the first fix round's fourth finding was about:
    // the same operation on the **same** file must still cancel. Nothing here is
    // over-cautious — every identity file 3 held was minted from bytes the
    // replacement wrote over.
    const committed: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: null
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const lookup = deferred<CommandResult<MatchView>>();
    const commands: BrowserCommands = {
      ...scriptedCommands({
        documents,
        raws: [committed],
        reload: { ok: true, value: restockedOtherDocument() }
      }),
      getMatch: vi.fn(() => lookup.promise)
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const selecting = state.select(otherDocument().matches[0]!);
    await state.saveRawDocument(3, OPEN_REVISION, '# replaced\n', NOTHING_ACKNOWLEDGED);
    // The replacement dropped everything held for file 3 and looked for the
    // selection again — positionally and then checked — in the projection it read
    // back, which still holds that snippet.
    expect(state.notice).toBe('kept');
    expect(state.selected?.id.node).toBe(20);

    lookup.resolve(STALE_IDENTITY);
    await selecting;

    // Nothing moved: the answer describes a parse this state has replaced, so it
    // never reaches the recovery at all.
    expect(commands.reloadDocument).not.toHaveBeenCalled();
    expect(state.notice).toBe('kept');
    expect(state.selected?.id.node).toBe(20);
  }); // End of the "the same file was replaced" case

  it('drops a stale identity lookup when another file’s create takes the selection', async () => {
    // **The half a per-document counter cannot see**, and the reason the selection
    // generation survives the scoping above rather than being folded into it. A
    // create commits in file 2 and its adoption moves the selection to the snippet
    // it just made; file 3's projection is untouched, so file 3's counter says
    // nothing — and the pending lookup for file 3, repaired, would drag the person
    // straight back off the snippet they made.
    const grown = grownDocument();
    const created: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: grown.matches[2]!.id
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const lookup = deferred<CommandResult<MatchView>>();
    const commands: BrowserCommands = {
      ...scriptedCommands({
        documents,
        creates: [created],
        reload: { ok: true, value: restockedOtherDocument() }
      }),
      getMatch: vi.fn(() => lookup.promise)
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    // The "All" scope, so the created snippet really is in the list the middle
    // pane is showing and the adoption's second condition is met.

    const selecting = state.select(otherDocument().matches[0]!);
    documents.set(2, { ok: true, value: grown });
    await state.createMatch(2, NEW_MATCH, AT_END, OPEN_REVISION, NOTHING_ACKNOWLEDGED);
    expect(state.selected?.id.node).toBe(42);

    lookup.resolve(STALE_IDENTITY);
    await selecting;

    expect(state.selected?.id.node).toBe(42);
    expect(state.notice).toBeNull();
    expect(commands.reloadDocument).not.toHaveBeenCalled();
  }); // End of the "another file's create took the selection" case
}); // End of the "what cancels a selection lookup" suite

describe('what a conflict does to this window, and what only a confirmed reload does', () => {
  /**
   * A conflict answer over `match/base.yml`, carrying a whole different parse.
   *
   * `replacedDocument()` is a **new revision with a new node and one snippet**,
   * so a window that installed it could not fail to show: the list would go from
   * two rows to one and every identity it holds would stop resolving.
   */
  const CONFLICT: CommandResult<SaveResult> = {
    ok: true,
    value: {
      outcome: 'conflict',
      reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
      expected: 'rev-a',
      found: 'rev-c',
      disk_revision: 'rev-c',
      disk_text: DISK_TEXT,
      disk: replacedDocument()
    }
  };

  /**
   * Opens a workspace with the second snippet of `match/base.yml` selected, and
   * the raw viewer **showing**.
   *
   * **The viewer is opened on purpose**, which is the 2c-4a-2 review's third Low —
   * and what the open viewer buys is stated exactly rather than as "re-reads
   * nothing". `readFileText` returns early when `fileTextShown` is `false`, so with
   * the viewer closed a `document_text` count could not notice anything at all.
   * With it open the count catches the pair the six conflict arms really used:
   * `forgetFileText()` followed by `readFileText()` — **measured**, by reinstating
   * exactly that in `moveMatch` and watching this case fail.
   *
   * What it still cannot catch is a *bare* `readFileText()` with no forgetting in
   * front of it, and that is not a coverage hole: `readFileText` returns early when
   * the viewer already holds the target document, so such a call reads nothing and
   * changes nothing. The eager install itself is caught three times over by the
   * revision, the list and the selection below.
   *
   * @param commands - The scripted boundary.
   * @returns The state, ready for one writing call.
   */
  async function withTheSecondSnippetSelected(commands: BrowserCommands): Promise<BrowserState> {
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[1]!);
    await state.showFileText(true);
    return state;
  } // End of function withTheSecondSnippetSelected()

  /**
   * Every writing wrapper, driven into a conflict, one per entry.
   *
   * A table rather than six cases, because the property is *one rule for all
   * six*: the consult's Q2 ruling is not about a particular command.
   */
  const WRITERS: readonly {
    readonly name: string;
    readonly script: Script;
    readonly send: (state: BrowserState) => Promise<unknown>;
  }[] = [
    {
      name: 'moveMatch',
      script: { moves: [CONFLICT] },
      send: (state) =>
        state.moveMatch(baseDocument().matches[0]!.id, null, 'rev-a', NOTHING_ACKNOWLEDGED)
    },
    {
      name: 'saveMatch',
      script: { saves: [CONFLICT] },
      send: (state) =>
        state.saveMatch(baseDocument().matches[0]!.id, editedDraft(), 'rev-a', NOTHING_ACKNOWLEDGED)
    },
    {
      name: 'createMatch',
      script: { creates: [CONFLICT] },
      send: (state) => state.createMatch(2, NEW_MATCH, AT_END, OPEN_REVISION, NOTHING_ACKNOWLEDGED)
    },
    {
      name: 'deleteMatch',
      script: { deletes: [CONFLICT] },
      send: (state) =>
        state.deleteMatch(baseDocument().matches[0]!.id, 'rev-a', NOTHING_ACKNOWLEDGED)
    },
    {
      name: 'duplicateMatch',
      script: { duplicates: [CONFLICT] },
      send: (state) =>
        state.duplicateMatch(baseDocument().matches[0]!.id, 'rev-a', NOTHING_ACKNOWLEDGED)
    },
    {
      name: 'saveRawDocument',
      script: { raws: [CONFLICT] },
      send: (state) => state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED)
    }
  ];

  it.each(WRITERS)(
    'installs no projection and moves no selection when $name conflicts',
    async ({ script, send }) => {
      // **The consult's Q2, as the assertion that would have caught it.** A
      // conflict writes nothing, and until 2c-4a-2 all six of these installed the
      // projection it carried: the snippet list re-ordered and the selection moved
      // for a save that changed no byte, leaving the person's draft beside a
      // projection that no longer described it.
      const commands = scriptedCommands(script);
      const state = await withTheSecondSnippetSelected(commands);
      const held = state.selected;
      // One projection per file at load, and one text read for the open viewer.
      expect(commands.getDocument).toHaveBeenCalledTimes(3);
      expect(commands.documentText).toHaveBeenCalledTimes(1);

      await send(state);

      // The list is the one this window loaded, not the one the conflict carried.
      expect(state.scopedDocument?.revision).toBe(baseDocument().revision);
      expect(state.scopedMatches).toHaveLength(2);
      // The selection is the very object it was: `replaceSelection` installs a
      // fresh one on every write, so identity is exactly the question *did
      // anything move it?*
      expect(state.selected).toBe(held);
      expect(state.notice).toBeNull();
      // **Neither read happened again.** The viewer is open, so the second count
      // is the guard this helper's own note describes; the third assertion is what
      // says the held snapshot was not dropped and left unrefilled.
      expect(commands.getDocument).toHaveBeenCalledTimes(3);
      expect(commands.documentText).toHaveBeenCalledTimes(1);
      expect(state.fileText).toEqual({ kind: 'text', text: '# text of document 2\n' });
    }
  ); // End of the per-writer "a conflict installs nothing" case

  it.each(WRITERS)(
    'marks the file stale when $name conflicts on a revision the window does not show',
    async ({ script, send }) => {
      // **The orchestrator's ruling on `stale`, taken at Phase 2d-6-9b-1**
      // (`docs/decisions/2d-6-9a-notes.md` §3.3): `stale` means the window holds a
      // disk snapshot of this file newer than its installed projection, whether it
      // came from an observation or from a save refused as a conflict. The refused
      // save's stabilized reading is coalesced by the backend, so no observation
      // will ever mark it; the conflict arm is the only place that can.
      const commands = scriptedCommands(script);
      const state = await withTheSecondSnippetSelected(commands);
      expect(state.externalDocumentStatus(2)).toBeNull();

      await send(state);

      expect(state.externalDocumentStatus(2)).toEqual({ kind: 'stale' });
      // Marking is not installing: the window still shows what it loaded.
      expect(state.scopedDocument?.revision).toBe(baseDocument().revision);
    }
  ); // End of the per-writer "a conflict marks the file stale" case

  it('marks nothing when the conflict names the revision the window already shows', async () => {
    // The window holds no snapshot newer than its projection here, so `stale`
    // would claim a difference nothing observed.
    const atTheShownRevision: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'conflict',
        reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
        expected: 'rev-z',
        found: baseDocument().revision,
        disk_revision: baseDocument().revision,
        disk_text: DISK_TEXT,
        disk: baseDocument()
      }
    };
    const commands = scriptedCommands({ raws: [atTheShownRevision] });
    const state = await withTheSecondSnippetSelected(commands);
    await state.saveRawDocument(2, 'rev-z', 'matches: []\n', NOTHING_ACKNOWLEDGED);
    expect(state.externalDocumentStatus(2)).toBeNull();
  });

  /**
   * The conflict model a surface would be holding, for one scripted conflict.
   *
   * @param answer - The conflict as it crossed the boundary.
   * @returns The model, which carries the retained draft.
   */
  function modelOf(answer: CommandResult<SaveResult> = CONFLICT): SaveConflictModel<string> {
    if (!answer.ok) {
      throw new Error('this case needs an outcome');
    }
    const model = describeEditSave(
      answer.value,
      startDraft('rev-a', 'matches: []\n', textDraftRules),
      // Any surface's declaration would do here: this case is about the adoption
      // door, and the capabilities only decide which reload sentence the model
      // carries. The match editor's is the one a `save_match` conflict would use.
      MATCH_EDITOR_CAPABILITIES
    );
    if (model.kind !== 'conflict') {
      throw new Error('this case is about a conflict');
    }
    return model;
  } // End of function modelOf()

  it('installs the disk projection and repairs the selection on a confirmed adoption', async () => {
    // **The sole frontend transition that crosses to the disk side**, and it
    // authorizes and installs in one call: nothing a surface holds can install a
    // projection, because there is no value between the two halves.
    const commands = scriptedCommands({ raws: [CONFLICT] });
    const state = await withTheSecondSnippetSelected(commands);
    await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);

    const model = modelOf();
    expect(state.adoptDiskVersion(model, confirmReloadDiskVersion(model))).toBe('installed');

    // Now — and only now — the window describes the bytes the other writer left.
    expect(state.scopedDocument?.revision).toBe('rev-c');
    expect(state.scopedMatches).toHaveLength(1);
    // The selection was repaired positionally and then checked: the snippet that
    // was at position 1 is gone, so it is dropped with a notice rather than
    // silently re-pointed (R27).
    expect(state.selected).toBeNull();
    expect(state.notice).toBe('gone');
  }); // End of the "confirmed adoption installs" case

  it('clears the conflict’s stale mark when a confirmed adoption installs the disk version', async () => {
    // The other half of the ruling on `stale` (Phase 2d-6-9b-1): once the snapshot
    // is installed, the window no longer holds anything newer than what it shows.
    const commands = scriptedCommands({ raws: [CONFLICT] });
    const state = await withTheSecondSnippetSelected(commands);
    await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
    expect(state.externalDocumentStatus(2)).toEqual({ kind: 'stale' });

    const model = modelOf();
    const confirmation = confirmReloadDiskVersion(model);
    expect(state.adoptDiskVersion(modelOf(), confirmReloadDiskVersion(modelOf()))).toBe('refused');
    // A refused adoption installs nothing, so the mark stands.
    expect(state.externalDocumentStatus(2)).toEqual({ kind: 'stale' });
    expect(state.adoptDiskVersion(model, confirmation)).toBe('installed');
    expect(state.externalDocumentStatus(2)).toBeNull();
  });

  /**
   * A started state over `match/base.yml`, with the second snippet selected and the
   * raw viewer showing, whose one wake drains `observations` — Phase 2d-6-9b-1's
   * fix round, for the cases that need a status written by an observation.
   *
   * Three drains are declared: the registration's, the open's, and the wake's.
   *
   * @param script - The commands' answers, less the drains.
   * @param observations - What the wake's batch carries, at sequence 1.
   * @returns The state and the wake that delivers the batch.
   */
  async function startedWithOneWake(
    script: Script,
    observations: readonly ExternalObservation[]
  ): Promise<{ readonly state: BrowserState; readonly wake: () => Promise<void> }> {
    expectDrains([0, 0, 0]);
    const events = testEvents();
    const commands = scriptedCommands({
      ...script,
      drains: [
        reconciliationBatch(),
        reconciliationBatch(),
        reconciliationBatch({ newest_sequence: 1, observations: [...observations] })
      ]
    });
    const state = createBrowserState(commands, () => undefined, undefined, events.source);
    state.start();
    await settleDrains();
    await state.open(null);
    await settleDrains();
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[1]!);
    await state.showFileText(true);
    return {
      state,
      wake: async () => {
        events.wake(5, 1);
        await settleDrains();
        await settleDrains();
      }
    };
  } // End of function startedWithOneWake()

  it('leaves a stale mark written after the conflict standing through an installed adoption', async () => {
    // **The clear guard's failing side** (the 2d-6-9b-1 review, finding 1). A later
    // observation, taking the automatic path with no surface over the file, marks
    // the file `stale` again and its read fails — so the mark now describes a
    // reading this conflict's snapshot is not. Installing the conflict must not
    // clear it: the status-write count moved since the conflict was registered.
    const { state, wake } = await startedWithOneWake(
      {
        raws: [CONFLICT],
        reload: { ok: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } }
      },
      [changedObservation(1, addressable(2, 'match/base.yml'))]
    );
    await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
    expect(state.externalDocumentStatus(2)).toEqual({ kind: 'stale' });
    await wake();
    expect(state.externalDocumentStatus(2)).toEqual({ kind: 'stale' });

    const model = modelOf();
    expect(state.adoptDiskVersion(model, confirmReloadDiskVersion(model))).toBe('installed');
    expect(state.externalDocumentStatus(2)).toEqual({ kind: 'stale' });
    state.dispose();
  });

  it('leaves an unavailable status written after the conflict standing through an installed adoption', async () => {
    const { state, wake } = await startedWithOneWake({ raws: [CONFLICT] }, [
      unreadableObservation(1, addressable(2, 'match/base.yml'))
    ]);
    await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
    await wake();
    expect(state.externalDocumentStatus(2)?.kind).toBe('unavailable');

    const model = modelOf();
    expect(state.adoptDiskVersion(model, confirmReloadDiskVersion(model))).toBe('installed');
    expect(state.externalDocumentStatus(2)?.kind).toBe('unavailable');
    state.dispose();
  });

  it('does not mark an unavailable file stale when a later save conflicts', async () => {
    // An `unavailable` is an observation's statement a refusal cannot order itself
    // against, so `rememberTheSaveConflict` leaves it.
    const { state, wake } = await startedWithOneWake({ raws: [CONFLICT] }, [
      unreadableObservation(1, addressable(2, 'match/base.yml'))
    ]);
    await wake();
    expect(state.externalDocumentStatus(2)?.kind).toBe('unavailable');
    await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
    expect(state.externalDocumentStatus(2)?.kind).toBe('unavailable');
    // Nothing wrote the status after this conflict registered, so only the
    // install's `stale` test keeps it from clearing an `unavailable`.
    const model = modelOf();
    expect(state.adoptDiskVersion(model, confirmReloadDiskVersion(model))).toBe('installed');
    expect(state.externalDocumentStatus(2)?.kind).toBe('unavailable');
    state.dispose();
  });

  it('does not mark a removed file stale when a later save conflicts', async () => {
    const { state, wake } = await startedWithOneWake({ raws: [CONFLICT] }, [
      removedObservation(1, addressable(2, 'match/base.yml'))
    ]);
    await wake();
    expect(state.externalDocumentStatus(2)).toEqual({ kind: 'removed' });
    await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
    expect(state.externalDocumentStatus(2)).toEqual({ kind: 'removed' });
    state.dispose();
  });

  it('marks nothing when no projection of the file is installed', async () => {
    // Document 4 is not in this window at all: there is no projection the
    // conflict's snapshot could be newer than.
    const commands = scriptedCommands({ raws: [CONFLICT] });
    const state = await withTheSecondSnippetSelected(commands);
    await state.saveRawDocument(4, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
    expect(state.externalDocumentStatus(4)).toBeNull();
  });

  it('refuses a confirmation issued for another conflict', async () => {
    const commands = scriptedCommands({ raws: [CONFLICT] });
    const state = await withTheSecondSnippetSelected(commands);
    await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);

    const other = modelOf();
    expect(state.adoptDiskVersion(modelOf(), confirmReloadDiskVersion(other))).toBe('refused');
    expect(state.scopedDocument?.revision).toBe(baseDocument().revision);
  });

  it('refuses a second spend of one confirmation, and answers a fresh one honestly', async () => {
    // **One click, one install.** A replay would bump that document's projection
    // generation and repair the selection a second time on the strength of one
    // person's single answer.
    const commands = scriptedCommands({ raws: [CONFLICT] });
    const state = await withTheSecondSnippetSelected(commands);
    await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);

    const model = modelOf();
    const confirmation = confirmReloadDiskVersion(model);
    expect(state.adoptDiskVersion(model, confirmation)).toBe('installed');
    expect(state.adoptDiskVersion(model, confirmation)).toBe('refused');
    // **A fresh confirmation for the same conflict is `alreadyThere`, not
    // refused**, which is the confirmation pass's correction: the window holds
    // exactly the bytes that were asked for, so the request is satisfied and a
    // surface may finish its transition. Nothing is installed a second time.
    expect(state.adoptDiskVersion(model, confirmReloadDiskVersion(model))).toBe('alreadyThere');
    expect(state.scopedDocument?.revision).toBe('rev-c');
  }); // End of the "one-shot confirmation" case

  /**
   * One narrowed external observation of `match/base.yml`.
   *
   * It carries the same replacement parse the scripted save conflict does, so a
   * window that installed it could not fail to show: two rows become one and every
   * identity this window holds for that file stops resolving.
   *
   * A fresh object every call, on purpose: the memo in `./conflictSource.ts` is
   * keyed on object identity, so two calls are two origins.
   *
   * @returns The observation, as this window would have narrowed it.
   */
  function externalObservation(): ExternalConflictObservation {
    return {
      sequence: 5,
      document: 2,
      previousRevision: 'rev-a',
      diskRevision: 'rev-c',
      diskText: DISK_TEXT,
      disk: replacedDocument(),
      findings: [],
      correspondences: null
    };
  } // End of function externalObservation()

  /**
   * The conflict model a surface would hold for one external observation.
   *
   * @param observation - The observation the surface was told about.
   * @returns The model, which carries the retained draft.
   */
  function externalModelOf(observation: ExternalConflictObservation) {
    return describeExternalConflict(
      observation,
      startDraft('rev-a', 'matches: []\n', textDraftRules),
      // Any surface's declaration would do here, exactly as it would for a save
      // conflict: this case is about the adoption door.
      MATCH_EDITOR_CAPABILITIES
    );
  } // End of function externalModelOf()

  it('refuses an external conflict this window never registered', async () => {
    // **The origin map is the whole of the check, and it is one check for both
    // origins.** An observation this state was never told about has no entry, so
    // the door installs nothing — the same answer a save conflict from a second
    // `BrowserState` gets.
    const state = await withTheSecondSnippetSelected(scriptedCommands());
    const model = externalModelOf(externalObservation());
    expect(state.adoptDiskVersion(model, confirmReloadDiskVersion(model))).toBe('refused');
    expect(state.scopedDocument?.revision).toBe(baseDocument().revision);
    expect(state.scopedMatches).toHaveLength(2);
  }); // End of the "refuses an unregistered external conflict" case

  it('registers an external conflict without installing anything', async () => {
    // **Registering is not adopting** (ruling 23), and this is the half that says
    // so: the snippet list, the selection and the projection are all exactly where
    // they were after the registration, and only the confirmed reload moves them.
    const commands = scriptedCommands();
    const state = await withTheSecondSnippetSelected(commands);
    const before = state.selected;

    state.rememberExternalConflict(externalObservation());

    expect(state.scopedDocument?.revision).toBe(baseDocument().revision);
    expect(state.scopedMatches).toHaveLength(2);
    expect(state.selected).toBe(before);
    expect(state.notice).toBeNull();
    expect(commands.reloadDocument).not.toHaveBeenCalled();
  }); // End of the "registration installs nothing" case

  it('answers all three adoption outcomes for an external-origin conflict', async () => {
    // **Ruling 23's other half: origin may not change who installs.**
    // `adoptDiskVersion` is still the only door and still answers its own three
    // values — and it answers them for a conflict no save produced.
    const state = await withTheSecondSnippetSelected(scriptedCommands());
    const observation = externalObservation();
    const registered = state.rememberExternalConflict(observation);
    const model = externalModelOf(observation);
    // The memo is what ties the two together: the model built from the observation
    // carries the identical origin object the registration wrote down.
    expect(model.source).toBe(registered);

    const confirmation = confirmReloadDiskVersion(model);
    expect(state.adoptDiskVersion(model, confirmation)).toBe('installed');
    // The window really moved, so `installed` is not a word for doing nothing.
    expect(state.scopedDocument?.revision).toBe('rev-c');
    expect(state.scopedMatches).toHaveLength(1);
    // One click, one install: the same token a second time is refused.
    expect(state.adoptDiskVersion(model, confirmation)).toBe('refused');
    // And a fresh confirmation is `alreadyThere`, because the window now holds
    // exactly the bytes that were asked for.
    expect(state.adoptDiskVersion(model, confirmReloadDiskVersion(model))).toBe('alreadyThere');
  }); // End of the "three adoption outcomes for an external origin" case

  it('refuses a second model built from an equal but distinct observation', async () => {
    // **Object identity, never value equality.** Two narrowings of one wire
    // snapshot are two observations here, and only the registered one can install.
    // Nothing in TypeScript says so, which is why this is a case.
    const state = await withTheSecondSnippetSelected(scriptedCommands());
    state.rememberExternalConflict(externalObservation());
    const lookalike = externalModelOf(externalObservation());
    expect(state.adoptDiskVersion(lookalike, confirmReloadDiskVersion(lookalike))).toBe('refused');
    expect(state.scopedDocument?.revision).toBe(baseDocument().revision);
  }); // End of the "an equal observation is a different origin" case

  it('does not renew a registration when one observation is registered twice', async () => {
    // **A second registration is not a second conflict, and it may not restore an
    // authority the window has already outlived** (Phase 2d-5-5a's review, finding
    // 1). The origin object is memoized on the observation, so registering the same
    // observation again lands on the *same* key — and writing the current
    // projection generation there would erase the very fact the generation is kept
    // for: that the window moved after this conflict arrived. The scenario is the
    // "projection replaced" case above with one extra call in the middle, and
    // without the first-registration-wins rule it installs `rev-c` over `rev-d` and
    // reports `installed` for moving the window backwards.
    const later = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-d',
      matches: [makeMatch({ node: 70, document: 2, revision: 'rev-d', trigger: ':later' })]
    });
    const state = await withTheSecondSnippetSelected(
      scriptedCommands({ reload: { ok: true, value: later } })
    );
    const observation = externalObservation();
    state.rememberExternalConflict(observation);
    const model = externalModelOf(observation);
    const confirmation = confirmReloadDiskVersion(model);

    // Something else replaces the projection between the registration and the
    // confirmed reload.
    expect(await state.rereadDocument(2)).toBeNull();
    expect(state.scopedDocument?.revision).toBe('rev-d');

    // The same observation is registered again — a coalescing pass re-telling this
    // state about a change it already knows, which is exactly what 2d-5-5b will do.
    state.rememberExternalConflict(observation);

    expect(state.adoptDiskVersion(model, confirmation)).toBe('refused');
    // The window is exactly where the re-read left it.
    expect(state.scopedDocument?.revision).toBe('rev-d');
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([70]);
  }); // End of the "a second registration renews nothing" case

  /**
   * The parse a third revision of `match/base.yml` would project to.
   *
   * @returns The projection, at `rev-d`.
   */
  function laterDocument(): DocumentView {
    return makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-d',
      matches: [makeMatch({ node: 70, document: 2, revision: 'rev-d', trigger: ':later' })]
    });
  } // End of function laterDocument()

  /**
   * One narrowed observation of **other** bytes than the scripted conflict's.
   *
   * A fresh object every call, exactly as {@link externalObservation} is.
   *
   * @param sequence - The sequence it was admitted under.
   * @returns The observation.
   */
  function laterObservation(sequence = 9): ExternalConflictObservation {
    return {
      sequence,
      document: 2,
      previousRevision: 'rev-c',
      diskRevision: 'rev-d',
      diskText: '# a third reading\n',
      disk: laterDocument(),
      findings: [],
      correspondences: null
    };
  } // End of function laterObservation()

  /**
   * A window holding one refused raw save of `match/base.yml`.
   *
   * @param commands - The scripted boundary, already carrying that refusal.
   * @returns The state, with the conflict registered and nothing installed.
   */
  async function withTheSaveRefused(commands: BrowserCommands): Promise<BrowserState> {
    const state = await withTheSecondSnippetSelected(commands);
    await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
    return state;
  } // End of function withTheSaveRefused()

  it('lets a refused save outrank a watcher reading of the same bytes', async () => {
    // **Ruling 25, in the order the consult names first**: the save conflict is
    // standing when the watcher's reading of the *same* revision arrives. Revision
    // equality proves identical bytes and never origin or chronology, and the
    // refusal carries the stronger fact — a locked write attempt was refused — so
    // the model, its messages and its **source identity** all stay where they are.
    const state = await withTheSaveRefused(scriptedCommands({ raws: [CONFLICT] }));
    const model = modelOf();
    expect(state.standingConflictFor(2)).toBe(model.source);

    const seen = externalObservation();
    expect(state.observeExternalChange(seen).verdict).toEqual({
      kind: 'coalesced',
      standing: model.source
    });
    // Nothing was re-keyed, so the conflict the surface is holding is still the one
    // this window answers for, and its confirmed reload still installs.
    expect(state.standingConflictFor(2)).toBe(model.source);
    expect(state.adoptDiskVersion(model, confirmReloadDiskVersion(model))).toBe('installed');
    expect(state.scopedDocument?.revision).toBe('rev-c');
  }); // End of the "a refused save outranks the same bytes" case

  it('lets a refused save take the standing place from a watcher reading of the same bytes', async () => {
    // **Ruling 25 in the other order**, which is the half an implementation can get
    // wrong while passing the first: the watcher reading arrives first and really is
    // the conflict, and then the save is refused against the same bytes. The refusal
    // is the newest fact this window has about that file, so it stands — and the
    // reading's pending confirmation is withdrawn rather than left able to install.
    const state = await withTheSecondSnippetSelected(scriptedCommands({ raws: [CONFLICT] }));
    const seen = externalObservation();
    expect(state.observeExternalChange(seen).verdict).toEqual({
      kind: 'raised',
      source: externalConflictSource(seen)
    });
    expect(state.standingConflictFor(2)).toBe(externalConflictSource(seen));

    await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
    const model = modelOf();
    expect(state.standingConflictFor(2)).toBe(model.source);

    const external = externalModelOf(seen);
    expect(state.adoptDiskVersion(external, confirmReloadDiskVersion(external))).toBe('refused');
    expect(state.scopedDocument?.revision).toBe(baseDocument().revision);
    // The refusal installs, so the window is not stuck: one of the two conflicts can
    // always be resolved.
    expect(state.adoptDiskVersion(model, confirmReloadDiskVersion(model))).toBe('installed');
    expect(state.scopedDocument?.revision).toBe('rev-c');
  }); // End of the "a refused save takes the standing place" case

  it('replaces a standing conflict with a strictly later reading of other bytes', async () => {
    // **Ruling 26.** A different revision and a sequence nothing older can match:
    // the disk side is replaced and the draft is not. The superseded conflict
    // installs nothing afterwards — that is *any pending reload confirmation
    // withdrawn*, and no projection generation moved, so it is the standing check
    // that refuses it and nothing else could.
    const state = await withTheSaveRefused(scriptedCommands({ raws: [CONFLICT] }));
    const model = modelOf();
    const later = laterObservation();
    expect(state.observeExternalChange(later).verdict).toEqual({
      kind: 'supersedes',
      superseded: model.source,
      source: externalConflictSource(later)
    });
    expect(state.standingConflictFor(2)).toBe(externalConflictSource(later));

    expect(state.adoptDiskVersion(model, confirmReloadDiskVersion(model))).toBe('refused');
    expect(state.scopedDocument?.revision).toBe(baseDocument().revision);

    // And the model that replaces it keeps the very draft the refusal retained.
    const replacing = supersedeConflict(model, later, MATCH_EDITOR_CAPABILITIES);
    expect(replacing.draft).toBe(model.draft);
    expect(state.adoptDiskVersion(replacing, confirmReloadDiskVersion(replacing))).toBe(
      'installed'
    );
    expect(state.scopedDocument?.revision).toBe('rev-d');
  }); // End of the "a later reading of other bytes supersedes" case

  it('answers all three adoption outcomes for the reading that superseded a save', async () => {
    // **Ruling 23 through ruling 26's door**: origin may change which conflict
    // stands, and it may not change who installs. `adoptDiskVersion` is still the
    // only one, and it still answers its own three values for a conflict that
    // arrived by superseding another.
    const state = await withTheSaveRefused(scriptedCommands({ raws: [CONFLICT] }));
    const later = laterObservation();
    state.observeExternalChange(later);
    const replacing = supersedeConflict(modelOf(), later, MATCH_EDITOR_CAPABILITIES);

    const confirmation = confirmReloadDiskVersion(replacing);
    expect(state.adoptDiskVersion(replacing, confirmation)).toBe('installed');
    expect(state.scopedDocument?.revision).toBe('rev-d');
    expect(state.adoptDiskVersion(replacing, confirmation)).toBe('refused');
    expect(state.adoptDiskVersion(replacing, confirmReloadDiskVersion(replacing))).toBe(
      'alreadyThere'
    );
  }); // End of the "three adoption outcomes after a supersession" case

  it('refuses the reapply evidence of a conflict a later reading superseded', async () => {
    // **Ruling 26's last clause, and it is one rule for both origins.** Before the
    // supersession the refusal's own evidence is available; afterwards the conflict
    // it would come from is not the one standing, so the evidence is about a state
    // the file has moved on from. The operand is `standingConflictFor`, and nothing
    // in TypeScript makes a caller ask it.
    const state = await withTheSaveRefused(scriptedCommands({ raws: [CONFLICT] }));
    const model = modelOf();
    expect(reapplyEvidenceFor(model, () => state.standingConflictFor(2))).toEqual({
      kind: 'saveEvidence',
      evidence: model.source.conflict.reapply
    });

    state.observeExternalChange(laterObservation());
    expect(reapplyEvidenceFor(model, () => state.standingConflictFor(2))).toEqual({
      kind: 'superseded'
    });
  }); // End of the "stale evidence after a supersession" case

  /**
   * A raw save this case settles by hand, with the barrier open in between.
   *
   * **The only way to make an observation arrive *during* a write.** The stub holds
   * the command open until the case releases the gate, which is exactly the window
   * ruling 27 is about.
   *
   * @param answer - What the boundary finally answers.
   * @param committedRevision - The revision to re-read at on a commit, or `null`
   *   when the answer is not a commit.
   * @param committedProjection - The parse a re-read answers once the commit has
   *   happened. It defaults to the one the scripted conflict carries; a case about
   *   a window that moved *past* a held reading passes a third revision instead.
   * @param script - What every other command answers; the 2d-6-1b watermark case
   *   scripts drains through it, and every other caller lets the default stand.
   * @returns The boundary and the gate that settles it.
   */
  function heldRawSave(
    answer: RawSaveOutcome,
    committedRevision: ContentRevision | null,
    committedProjection: DocumentView = replacedDocument(),
    script: Script = {}
  ): { commands: BrowserCommands; release: () => void } {
    const gate = deferred<void>();
    const scripted = scriptedCommands(script);
    // Whether the commit has happened, which is what decides which parse a re-read
    // of `match/base.yml` answers: the whole point of a committed replacement is
    // that the file is not what it was.
    let committed = false;
    return {
      commands: {
        ...scripted,
        getDocument: vi.fn(async (id: DocumentId): Promise<CommandResult<DocumentView>> => {
          if (id === 2 && committed) {
            return { ok: true, value: committedProjection };
          }
          return scripted.getDocument(id);
        }),
        saveRawDocument: vi.fn(
          async (
            document: DocumentId,
            _baseRevision: ContentRevision,
            _text: string,
            _acknowledgement: Acknowledgement,
            reload: ReloadAfterRawSave
          ): Promise<RawSaveOutcome> => {
            await gate.promise;
            if (committedRevision !== null) {
              committed = true;
              await reload({ document, revision: committedRevision });
            }
            return answer;
          }
        )
      },
      release: () => gate.resolve()
    };
  } // End of function heldRawSave()

  it('holds a reading of the bytes its own committed save ended on, and then drops it', async () => {
    // **Ruling 27's barrier and its coalescing, over a commit.** While the write is
    // out, what is on disk cannot be attributed, so the reading is held rather than
    // applied; when the transaction ends on exactly those bytes the reading is not
    // news about a change and no conflict is raised. **It says the revisions are
    // equal and never that this window wrote them.**
    const held = heldRawSave(
      {
        ok: true,
        value: {
          outcome: 'saved',
          revision: 'rev-c',
          committed: true,
          backup_taken: false,
          moved: null,
          notes: []
        },
        reload: { kind: 'done' }
      },
      'rev-c'
    );
    const state = await withTheSecondSnippetSelected(held.commands);
    const sending = state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
    expect(state.writeInFlight(2)).toBe(true);

    const seen = externalObservation();
    expect(state.observeExternalChange(seen).verdict).toEqual({ kind: 'retained' });
    expect(state.retainedObservationFor(2)).toBe(seen);
    // Held means held: nothing was registered and nothing stands.
    expect(state.standingConflictFor(2)).toBeNull();

    held.release();
    await sending;
    expect(state.writeInFlight(2)).toBe(false);
    expect(state.retainedObservationFor(2)).toBeNull();
    expect(state.standingConflictFor(2)).toBeNull();
    expect(state.writeOutcomeUncertain(2)).toBe(false);
    // The commit's own invalidation ran first, which is what the released reading
    // would have been arbitrated against had it been news.
    expect(state.scopedDocument?.revision).toBe('rev-c');
  }); // End of the "held across a committed save" case

  it('releases what it held as a conflict when the write is over and wrote nothing', async () => {
    // **A definite failure.** `mayHaveWritten` is `false`, so this application can
    // say the file was not written from here: the held reading is ordinary news
    // about another writer and is arbitrated exactly as one that arrived with no
    // write in flight.
    const held = heldRawSave(
      { ok: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } },
      null
    );
    const state = await withTheSecondSnippetSelected(held.commands);
    const sending = state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
    const seen = externalObservation();
    expect(state.observeExternalChange(seen).verdict).toEqual({ kind: 'retained' });

    held.release();
    const answer = await sending;
    expect(answer).toEqual({ kind: 'failed', mayHaveWritten: false });
    expect(state.writeOutcomeUncertain(2)).toBe(false);
    expect(state.retainedObservationFor(2)).toBeNull();
    expect(state.standingConflictFor(2)).toBe(externalConflictSource(seen));
    // Registering is not adopting: the window is where it was.
    expect(state.scopedDocument?.revision).toBe(baseDocument().revision);
  }); // End of the "released after a definite failure" case

  it('preserves the uncertainty of a write that may have written', async () => {
    // **Ruling 27's uncertain arm.** A later watcher snapshot can establish what is
    // on disk and never who put it there, so the reading still becomes the file's
    // conflict — the person is told — and every verdict for that file afterwards
    // says that no automatic reload may be made from it. **Nothing a watcher says
    // clears it**, which is why the second observation below answers the same arm.
    if (WRITE_MAY_HAVE_HAPPENED.ok) {
      throw new Error('this case needs a rejection');
    }
    const held = heldRawSave({ ok: false, failure: WRITE_MAY_HAVE_HAPPENED.failure }, null);
    const state = await withTheSecondSnippetSelected(held.commands);
    const sending = state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
    const seen = externalObservation();
    expect(state.observeExternalChange(seen).verdict).toEqual({ kind: 'retained' });

    held.release();
    expect(await sending).toEqual({ kind: 'failed', mayHaveWritten: true });
    expect(state.writeOutcomeUncertain(2)).toBe(true);
    expect(state.retainedObservationFor(2)).toBeNull();
    expect(state.standingConflictFor(2)).toBe(externalConflictSource(seen));

    const later = laterObservation();
    expect(state.observeExternalChange(later).verdict).toEqual({
      kind: 'raisedWithoutReload',
      source: externalConflictSource(later),
      superseded: externalConflictSource(seen)
    });
    expect(state.writeOutcomeUncertain(2)).toBe(true);
  }); // End of the "uncertainty is preserved" case

  it('keeps only the newest of several readings held behind one barrier', async () => {
    // **Coalescing is keeping the newest, never merging two readings**: two
    // snapshots of one file are two whole readings, and anything built from halves
    // of both would name a state that never existed. Order of arrival is not order
    // of sequence, and only the sequence decides.
    const held = heldRawSave(
      { ok: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } },
      null
    );
    const state = await withTheSecondSnippetSelected(held.commands);
    const sending = state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
    state.observeExternalChange(externalObservation());
    const newest = laterObservation(9);
    state.observeExternalChange(newest);
    state.observeExternalChange(laterObservation(7));
    expect(state.retainedObservationFor(2)).toBe(newest);

    held.release();
    await sending;
    expect(state.standingConflictFor(2)).toBe(externalConflictSource(newest));
  }); // End of the "newest of several held readings" case

  it('initiates no command from watcher arbitration', async () => {
    // **Ruling 27's last sentence**, as the assertion that would catch it: no save
    // command may ever be initiated by watcher arbitration, and nothing here reads a
    // file either. The two read counts are the ones `withTheSecondSnippetSelected`
    // leaves behind, unchanged by three arbitrations.
    const commands = scriptedCommands({ raws: [CONFLICT] });
    const state = await withTheSaveRefused(commands);
    const reads = (commands.getDocument as ReturnType<typeof vi.fn>).mock.calls.length;
    const texts = (commands.documentText as ReturnType<typeof vi.fn>).mock.calls.length;

    state.observeExternalChange(externalObservation());
    state.observeExternalChange(laterObservation());
    state.observeExternalChange(laterObservation(2));

    for (const writer of [
      commands.moveMatch,
      commands.saveMatch,
      commands.createMatch,
      commands.deleteMatch,
      commands.duplicateMatch
    ]) {
      expect(writer).not.toHaveBeenCalled();
    } // End of the loop over the five editing commands
    expect(commands.saveRawDocument).toHaveBeenCalledTimes(1);
    expect(commands.reloadDocument).not.toHaveBeenCalled();
    expect(commands.getDocument).toHaveBeenCalledTimes(reads);
    expect(commands.documentText).toHaveBeenCalledTimes(texts);
  }); // End of the "no command from arbitration" case

  it('registers a released reading at the window it arrived at, not at the one it left', async () => {
    // **This phase's review, finding 1.** A reading arrives while this window's own
    // write is out and is held; the write commits on *other* bytes and re-reads the
    // file, which replaces the projection; only then does the barrier release the
    // reading and register it. The generation a registration writes down is what
    // `adoptDiskVersion` compares to refuse a disk snapshot the window has moved
    // past — so registering at the generation the *release* runs at hands the
    // reading a freshness it never had, and the door then installs `rev-c` over the
    // `rev-d` the commit left and reports success for moving the window backwards.
    const held = heldRawSave(
      {
        ok: true,
        value: {
          outcome: 'saved',
          revision: 'rev-d',
          committed: true,
          backup_taken: false,
          moved: null,
          notes: []
        },
        reload: { kind: 'done' }
      },
      'rev-d',
      laterDocument()
    );
    const state = await withTheSecondSnippetSelected(held.commands);
    const sending = state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
    const seen = externalObservation();
    expect(state.observeExternalChange(seen).verdict).toEqual({ kind: 'retained' });

    held.release();
    await sending;
    // The commit's own re-read landed first, so the window really did move after
    // the held reading arrived — which is the whole of what makes it stale.
    expect(state.scopedDocument?.revision).toBe('rev-d');
    // It is still news, so it became the file's conflict and the person is told.
    expect(state.standingConflictFor(2)).toBe(externalConflictSource(seen));

    const model = externalModelOf(seen);
    expect(state.adoptDiskVersion(model, confirmReloadDiskVersion(model))).toBe('refused');
    expect(state.scopedDocument?.revision).toBe('rev-d');
  }); // End of the "a released reading keeps its arrival window" case

  it('registers no verdict decided against a standing origin that moved underneath it', async () => {
    // **This phase's review, finding 2 — a check and a spend are not atomic across
    // a property read.** The observation is a value a caller assembled, so reading
    // `diskRevision` runs that caller's getter, which re-enters this state and
    // registers a strictly later reading. The outer verdict was decided against the
    // standing origin as it was *before* that, and registering it afterwards
    // overwrites the newer origin with an older one — last-registration-wins means
    // nothing would refuse it. `readonly` freezes nothing at runtime and no type
    // says a getter may not do this.
    const state = await withTheSecondSnippetSelected(scriptedCommands());
    const inner = laterObservation(12);
    let entered = false;
    const outer: ExternalConflictObservation = {
      sequence: 5,
      document: 2,
      previousRevision: 'rev-a',
      get diskRevision(): ContentRevision {
        if (!entered) {
          entered = true;
          state.observeExternalChange(inner);
        }
        return 'rev-c';
      },
      diskText: DISK_TEXT,
      disk: replacedDocument(),
      findings: [],
      correspondences: null
    };

    const { verdict } = state.observeExternalChange(outer);

    // The newer reading is the one that speaks for the file.
    const standing = state.standingConflictFor(2);
    expect(
      standing !== null && standing.kind === 'externalChange'
        ? standing.observation.sequence
        : null
    ).toBe(12);
    expect(standing).toBe(externalConflictSource(inner));
    // And the older one is held rather than dropped: nobody has acted on it.
    expect(verdict).toEqual({ kind: 'retained' });
    expect(state.retainedObservationFor(2)).toBe(outer);
  }); // End of the "a re-entrant registration is not overwritten" case

  /**
   * A boundary whose one writing command rejects rather than answering.
   *
   * **A rejection, not a failure arm**: `CommandResult` carries a failure, and this
   * is the other thing — the promise itself rejecting, which is what an exception
   * anywhere below the wrapper looks like from inside it.
   *
   * @param command - Which of the six writing commands rejects.
   * @returns The boundary, scripted for everything else.
   */
  function rejectingBoundary(command: string): BrowserCommands {
    return Object.assign(scriptedCommands(), {
      [command]: vi.fn(async (): Promise<never> => {
        throw new Error('the boundary rejected');
      })
    });
  } // End of function rejectingBoundary()

  it('closes the barrier when any of the six writing wrappers rejects', async () => {
    // **This phase's review, finding 3.** A lease taken before a command and
    // released after it is released on no path at all when something in between
    // throws, and the barrier it holds is per document and permanent: every later
    // observation of that file is retained and never arbitrated, so its
    // reconciliation is silently dead for the life of the session. The direction is
    // *safe* and it is not *harmless*. The outcome of a rejected command cannot be
    // attributed — this application never learned whether the file was written — so
    // the barrier closes as uncertain, which forbids an automatic reload without
    // pretending to know anything.
    for (const writer of WRITERS) {
      const state = await withTheSecondSnippetSelected(rejectingBoundary(writer.name));

      await expect(writer.send(state)).rejects.toThrow('the boundary rejected');

      expect(state.writeInFlight(2)).toBe(false);
      expect(state.writeOutcomeUncertain(2)).toBe(true);
      // And the barrier really is open again: a reading arriving now is arbitrated
      // rather than held, under the uncertainty this write left.
      expect(state.observeExternalChange(externalObservation()).verdict.kind).toBe(
        'raisedWithoutReload'
      );
    } // End of the loop over the six writing wrappers
  }); // End of the "a rejected command closes the barrier" case

  it('closes the barrier on what the answer established when the adoption throws', async () => {
    // **Finding 3's other half: what an exception-safe close settles on.** The
    // transaction answered, so this application *does* know what happened to the
    // file; it is the re-read afterwards that threw. Closing on `uncertain` there
    // would mark the file unattributable for a failure that has nothing to do with
    // the disk — so the settlement the answer established is kept, and the reading
    // held during the write, being of exactly the bytes the transaction ended on,
    // is dropped as not-news rather than raised as a conflict.
    const scripted = scriptedCommands({
      moves: [
        {
          ok: true,
          value: {
            outcome: 'saved',
            revision: 'rev-c',
            committed: true,
            backup_taken: false,
            moved: null,
            notes: []
          }
        }
      ]
    });
    const seen = externalObservation();
    let state: BrowserState | null = null;
    let armed = false;
    const commands: BrowserCommands = {
      ...scripted,
      getDocument: vi.fn(async (id: DocumentId): Promise<CommandResult<DocumentView>> => {
        if (armed) {
          // The observation arrives while the write is still in flight — the
          // wrapper closes its lease after this adoption, deliberately — and then
          // the re-read fails.
          state?.observeExternalChange(seen);
          throw new Error('the re-read threw');
        }
        return scripted.getDocument(id);
      })
    };
    state = await withTheSecondSnippetSelected(commands);
    armed = true;

    // **Answered, not rejected, since Phase 2d-6-7a**: a committed write is never
    // afterwards reported as an error (D2), so the exception travels back as a
    // `failed` adoption beside the `saved` outcome. Until then this case asserted
    // the rejection — the defect `2d-6-6c-2-notes.md` §5 item 2 named.
    const answer = await state.moveMatch(
      baseDocument().matches[0]!.id,
      null,
      'rev-a',
      NOTHING_ACKNOWLEDGED
    );
    expect(answer).toMatchObject({ kind: 'answered', adoption: { kind: 'failed' } });
    expect(answer.kind === 'answered' ? answer.result.outcome : null).toBe('saved');

    expect(state.writeInFlight(2)).toBe(false);
    expect(state.retainedObservationFor(2)).toBeNull();
    // Dropped as a reading of the bytes this transaction ended on, which is what
    // the *known* settlement buys: an `uncertain` close would have raised it.
    expect(state.standingConflictFor(2)).toBeNull();
    expect(state.writeOutcomeUncertain(2)).toBe(false);
  }); // End of the "an exception after the answer keeps the settlement" case

  it('forgets what it arbitrated about the workspace it is closing', async () => {
    // A standing conflict names bytes of a file *that* workspace held, and an
    // uncertain write is uncertainty about a file this window is about to stop
    // describing. Carrying either would arbitrate the next workspace's observations
    // against the last one's facts.
    const state = await withTheSaveRefused(scriptedCommands({ raws: [CONFLICT] }));
    state.observeExternalChange(laterObservation());
    expect(state.standingConflictFor(2)).not.toBeNull();

    await state.open(null);

    expect(state.standingConflictFor(2)).toBeNull();
    expect(state.retainedObservationFor(2)).toBeNull();
    expect(state.writeOutcomeUncertain(2)).toBe(false);
  }); // End of the "an open forgets what was arbitrated" case

  it('installs nothing over a projection replaced since the conflict arrived', async () => {
    // **The confirmation pass's High, driven in its own order.** A conflict arrives
    // for a window at `rev-a` carrying disk snapshot `rev-c`. The person presses
    // *Reload disk version* and reads the warning; before they confirm, a re-read
    // lands and installs `rev-d`. A workspace reprojection is neither an `apply*`
    // outcome nor a dismissal, so the session survives at `confirming` with a
    // perfectly valid token. Installing `rev-c` then would move the window
    // **backwards** onto an observation older than the one it now holds, and report
    // success for it. Revisions are content hashes and carry no order, so this
    // application cannot tell which is fresher — it refuses.
    const later = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-d',
      matches: [makeMatch({ node: 70, document: 2, revision: 'rev-d', trigger: ':later' })]
    });
    const commands = scriptedCommands({ raws: [CONFLICT], reload: { ok: true, value: later } });
    const state = await withTheSecondSnippetSelected(commands);
    await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);

    // The token is minted while the window is still at `rev-a` — the warning step.
    const model = modelOf();
    const confirmation = confirmReloadDiskVersion(model);
    // And then something else replaces the projection.
    expect(await state.rereadDocument(2)).toBeNull();
    expect(state.scopedDocument?.revision).toBe('rev-d');

    expect(state.adoptDiskVersion(model, confirmation)).toBe('refused');
    // The window is exactly where the re-read left it.
    expect(state.scopedDocument?.revision).toBe('rev-d');
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([70]);
  }); // End of the "projection replaced since the conflict" case

  it('refuses a conflict this window never produced', async () => {
    // **A `DocumentId` is session-local**, so a second `BrowserState`'s conflict
    // about "document 2" is not about this one's — and a hand-assembled model names
    // no conflict at all. Both are refused by the same check: the wire value must be
    // one this state registered when it arrived.
    const commands = scriptedCommands({ raws: [CONFLICT] });
    const state = await withTheSecondSnippetSelected(commands);
    await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);

    // Same document, same revisions, same text — a different object.
    const lookalike = modelOf({
      ok: true,
      value: {
        outcome: 'conflict',
        reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
        expected: 'rev-a',
        found: 'rev-c',
        disk_revision: 'rev-c',
        disk_text: DISK_TEXT,
        disk: replacedDocument()
      }
    });
    expect(state.adoptDiskVersion(lookalike, confirmReloadDiskVersion(lookalike))).toBe('refused');
    expect(state.scopedDocument?.revision).toBe(baseDocument().revision);
  }); // End of the "conflict this window never produced" case

  it('refuses a conflict about a document this window does not project', async () => {
    const commands = scriptedCommands({ raws: [CONFLICT] });
    const state = await withTheSecondSnippetSelected(commands);
    await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);

    const elsewhere = modelOf({
      ok: true,
      value: {
        outcome: 'conflict',
        reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
        expected: 'rev-a',
        found: 'rev-c',
        disk_revision: 'rev-c',
        disk_text: DISK_TEXT,
        disk: makeDocument({ id: 99, relativePath: 'match/gone.yml', revision: 'rev-c' })
      }
    });
    expect(state.adoptDiskVersion(elsewhere, confirmReloadDiskVersion(elsewhere))).toBe('refused');
    expect(state.views.some((view) => view.id === 99)).toBe(false);
    expect(state.scopedDocument?.revision).toBe(baseDocument().revision);
  }); // End of the "unprojected document" case

  it('refuses an adoption held across a later conflict', async () => {
    // **The retained-callback scenario the first review named.** A first conflict is
    // resolved and the window crosses to `rev-c`; a stale reference to that first
    // conflict is then spent while a second one is being resolved. It installs
    // nothing, because the confirmation is spent.
    const commands = scriptedCommands({ raws: [CONFLICT, CONFLICT] });
    const state = await withTheSecondSnippetSelected(commands);
    await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
    const first = modelOf();
    const spent = confirmReloadDiskVersion(first);
    expect(state.adoptDiskVersion(first, spent)).toBe('installed');

    await state.saveRawDocument(2, 'rev-c', 'matches: []\n', NOTHING_ACKNOWLEDGED);
    expect(state.adoptDiskVersion(first, spent)).toBe('refused');
    expect(state.scopedDocument?.revision).toBe('rev-c');
  }); // End of the "retained across a later conflict" case

  it('installs one document from one confirmation, whatever its getters alternate between', async () => {
    // **The 2c-5-4b confirmation review's third High**, and the reason the fix round's
    // adjudication of it was unsound. The membership test was a `has` at the top and
    // the spend an `add` some twenty lines down, with `conflict.source` and
    // `adoption.disk.id` read in between — both caller-controlled. That was recorded
    // as harmless because "a re-entrant call that installs bumps the projection
    // generation, so the outer call then finds the window already holding the
    // requested revision". **Projection generations are per document**, so a conflict
    // whose getters alternate between two files defeats exactly that: the inner call
    // installs document 3 and bumps only document 3's generation, and the outer call —
    // already past its `has` — resumes with document 2, finds its generation
    // untouched, and installs that as well. One answer, two projection replacements,
    // two selection repairs.
    //
    // The confirmation is reserved immediately after the test now, with every
    // caller-controlled read taken before it, so whichever call reaches the pair first
    // is the only one that can install anything.
    const others = makeDocument({
      id: 3,
      relativePath: 'match/other.yml',
      revision: 'rev-e',
      matches: [makeMatch({ node: 21, document: 3, revision: 'rev-e', trigger: ':theirs' })]
    });
    const otherConflict: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'conflict',
        reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
        expected: 'rev-a',
        found: 'rev-e',
        disk_revision: 'rev-e',
        disk_text: DISK_TEXT,
        disk: others
      }
    };
    const commands = scriptedCommands({ raws: [CONFLICT, otherConflict] });
    const state = await withTheSecondSnippetSelected(commands);
    // Two conflicts, over two files, so this state has remembered both origins.
    await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
    await state.saveRawDocument(3, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
    const here = modelOf();
    const there = modelOf(otherConflict);

    let showingTheOther = false;
    let reentered = false;
    const inner: DiskAdoptionOutcome[] = [];
    // One model, one confirmation, and four getters that answer for whichever conflict
    // the flag names. Every one of them is a property of a value a surface assembled,
    // which is all a getter needs to be reachable from inside this method.
    const alternating: SaveConflictModel<string> = {
      ...here,
      get source() {
        if (!reentered) {
          reentered = true;
          showingTheOther = true;
          inner.push(state.adoptDiskVersion(alternating, confirmation));
          showingTheOther = false;
        }
        return showingTheOther ? there.source : here.source;
      },
      get disk() {
        return showingTheOther ? there.disk : here.disk;
      },
      get diskRevision() {
        return showingTheOther ? there.diskRevision : here.diskRevision;
      },
      get diskText() {
        return showingTheOther ? there.diskText : here.diskText;
      }
    };
    const confirmation = confirmReloadDiskVersion(alternating);

    const outer = state.adoptDiskVersion(alternating, confirmation);

    // The re-entry really happened, so this is the opening and not a case that never
    // reached one.
    expect(reentered).toBe(true);
    expect(inner).toHaveLength(1);
    // **One install, from one answer.** Which of the two calls wins is not the claim;
    // that only one of them does is.
    expect([outer, ...inner].filter((one) => one === 'installed')).toHaveLength(1);
    // And the window agrees: exactly one of the two files moved off the revision it
    // was loaded at.
    const moved = state.views.filter((view) => view.revision !== 'rev-a');
    expect(moved).toHaveLength(1);
  }); // End of the "one document from one confirmation" case

  /**
   * The file as another writer left it: two snippets, at `rev-c`.
   *
   * Two rather than one, because a deletion refuses to empty a sequence — and a
   * reapply that refused for `lastSnippet` would be about the wrong thing.
   *
   * @returns The projection a conflict carries.
   */
  function diskAfterTheOtherWriter(): DocumentView {
    return makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-c',
      matches: [
        makeMatch({ node: 40, document: 2, revision: 'rev-c', trigger: ':sig' }),
        makeMatch({ node: 41, document: 2, revision: 'rev-c', trigger: ':date' })
      ]
    });
  } // End of function diskAfterTheOtherWriter()

  /**
   * A deletion conflict whose correspondence evidence identifies the snippet.
   *
   * @param subject - What the search answered; an identification by default.
   * @returns The answer `delete_match` gives.
   */
  function deletionConflict(subject?: ReapplyResolution): CommandResult<SaveResult> {
    const disk = diskAfterTheOtherWriter();
    return {
      ok: true,
      value: makeConflict({
        disk,
        subject: subject ?? { Identified: { target: disk.matches[0]! } },
        expected: 'rev-a',
        found: 'rev-c',
        diskText: DISK_TEXT
      })
    };
  } // End of function deletionConflict()

  /**
   * Drives one deletion through the real window until it conflicts.
   *
   * **The whole path a person takes**, so that what the reapply is asked about is
   * a conflict this `BrowserState` really registered — which is what the origin
   * check in `adoptDiskVersion` is about.
   *
   * @param state - The window.
   * @returns The session showing the conflict.
   */
  async function conflictedDeletion(state: BrowserState): Promise<MatchDeletionSession> {
    const answered = await deletionUntilItConflicts(state);
    return applyDeletion(answered.session, answered.result, answered.adoption, () => answered.session);
  } // End of function conflictedDeletion()

  /**
   * The same path, stopped one step earlier: the answer, undescribed.
   *
   * **The `SaveResult` is handed back rather than a session**, so a case can
   * describe **one** wire conflict twice. `applyDeletion` calls `describeEditSave`,
   * which builds a fresh `ConflictModel` per call, and two models over one payload
   * is the shape the reapply authorization has to survive.
   *
   * @param state - The window.
   * @returns The waiting session, the answer it got, and the invalidation.
   */
  async function deletionUntilItConflicts(state: BrowserState): Promise<{
    readonly session: MatchDeletionSession;
    readonly result: SaveResult;
    readonly adoption: InvalidationStatus;
  }> {
    const held = state.views.find((view) => view.id === 2);
    if (held === undefined) {
      throw new Error('this case needs the file projected');
    }
    const opened = startMatchDeletion(held, held.matches[0]!);
    const started = ((onHand) => confirmDelete(onHand, held.matches[0]!.id, () => onHand))(requestDelete(opened));
    if (started === null) {
      throw new Error('a confirmed deletion is what this case sends');
    }
    const answer = await state.deleteMatch(
      started.match,
      deletionBaseRevisionOf(started.session),
      NOTHING_ACKNOWLEDGED
    );
    if (answer.kind !== 'answered') {
      throw new Error('this case needs the transaction to have answered');
    }
    return { session: started.session, result: answer.result, adoption: answer.adoption };
  } // End of function deletionUntilItConflicts()

  it('installs the disk projection when a reapply is carried out', async () => {
    // **The end-to-end shape of 2c-4b-2**: a surface decides, and the window is
    // the only thing that installs. No command is sent by the reapply itself.
    const commands = scriptedCommands({ deletes: [deletionConflict()] });
    const state = await withTheSecondSnippetSelected(commands);
    const stuck = await conflictedDeletion(state);
    expect(state.scopedDocument?.revision).toBe(baseDocument().revision);

    const answer = reapplyToDiskVersion(stuck, (conflict, confirmation) =>
      state.adoptDiskVersion(conflict, confirmation), null, () => stuck
    );
    expect(answer.kind).toBe('reapplied');
    expect(state.scopedDocument?.revision).toBe('rev-c');
    // **No second command.** The reapply rebuilds a session; sending it is the
    // ordinary submit path, which nothing here took.
    expect(commands.deleteMatch).toHaveBeenCalledTimes(1);
  }); // End of the "reapply installs" case

  it('sends no command and installs nothing on a manual-resolution refusal', async () => {
    const commands = scriptedCommands({
      deletes: [deletionConflict({ Refused: { reason: 'AmbiguousExact' } })]
    });
    const state = await withTheSecondSnippetSelected(commands);
    const stuck = await conflictedDeletion(state);
    const reads = (commands.getDocument as ReturnType<typeof vi.fn>).mock.calls.length;

    expect(
      reapplyToDiskVersion(stuck, (conflict, confirmation) =>
        state.adoptDiskVersion(conflict, confirmation), null, () => stuck
      ).kind
    ).toBe('manualResolution');
    // The window is exactly where it was, and the boundary was not touched again.
    expect(state.scopedDocument?.revision).toBe(baseDocument().revision);
    expect(commands.deleteMatch).toHaveBeenCalledTimes(1);
    expect(commands.getDocument).toHaveBeenCalledTimes(reads);
  }); // End of the "no command on a refusal" case

  it('refuses the adoption when the projection moved after the conflict arrived', async () => {
    // The consult's Q9 item 2, one layer up: the disk snapshot a conflict carries
    // may be **older** than what the window now holds, and revisions are content
    // hashes with no order. A reapply cannot install it, and says so.
    const later = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-d',
      matches: [makeMatch({ node: 70, document: 2, revision: 'rev-d', trigger: ':later' })]
    });
    const commands = scriptedCommands({
      deletes: [deletionConflict()],
      reload: { ok: true, value: later }
    });
    const state = await withTheSecondSnippetSelected(commands);
    const stuck = await conflictedDeletion(state);
    expect(await state.rereadDocument(2)).toBeNull();
    expect(state.scopedDocument?.revision).toBe('rev-d');

    expect(
      reapplyToDiskVersion(stuck, (conflict, confirmation) =>
        state.adoptDiskVersion(conflict, confirmation), null, () => stuck
      )
    ).toEqual({ kind: 'adoptionRefused' });
    expect(state.scopedDocument?.revision).toBe('rev-d');
    expect(commands.deleteMatch).toHaveBeenCalledTimes(1);
  }); // End of the "projection moved" case

  it('refuses a second reapply of one conflict, because one conflict has one token', async () => {
    // A reapply asks no second question, so there is no step to hold a token on;
    // the memo on the conflict's **origin** — `ConflictModel.source`, the one
    // object memoized per wire value, and not the model — is what hands the second
    // attempt the token this window has already spent.
    const commands = scriptedCommands({ deletes: [deletionConflict()] });
    const state = await withTheSecondSnippetSelected(commands);
    const stuck = await conflictedDeletion(state);
    const adopt = (conflict: ConflictModel<MatchId>, confirmation: ReloadConfirmation) =>
      state.adoptDiskVersion(conflict, confirmation);

    expect(reapplyToDiskVersion(stuck, adopt, null, () => stuck).kind).toBe('reapplied');
    expect(reapplyToDiskVersion(stuck, adopt, null, () => stuck)).toEqual({ kind: 'adoptionRefused' });
    expect(state.scopedDocument?.revision).toBe('rev-c');
  }); // End of the "one conflict, one token" case

  it('refuses the second of two descriptions of one wire conflict', async () => {
    // **The 2c-4b-2 review's first finding, driven through the real window.**
    // `describeEditSave` builds a fresh `ConflictModel` per call, so two
    // `applyDeletion` calls over one `SaveResult` give two model objects sharing
    // one `source`. Keyed on the model, the second would mint an unspent token,
    // pass `authorizeDiskAdoption`, and be answered `alreadyThere` — a second
    // successful adoption from one wire conflict, and a second rebuilt session.
    // Keyed on `source`, it presents the first model's token and the door refuses
    // it.
    const commands = scriptedCommands({ deletes: [deletionConflict()] });
    const state = await withTheSecondSnippetSelected(commands);
    const answered = await deletionUntilItConflicts(state);
    const first = applyDeletion(answered.session, answered.result, answered.adoption, () => answered.session);
    const second = applyDeletion(answered.session, answered.result, answered.adoption, () => answered.session);
    const adopt = (conflict: ConflictModel<MatchId>, confirmation: ReloadConfirmation) =>
      state.adoptDiskVersion(conflict, confirmation);

    expect(reapplyToDiskVersion(first, adopt, null, () => first).kind).toBe('reapplied');
    expect(reapplyToDiskVersion(second, adopt, null, () => second)).toEqual({ kind: 'adoptionRefused' });
    expect(state.scopedDocument?.revision).toBe('rev-c');
    expect(commands.deleteMatch).toHaveBeenCalledTimes(1);
  }); // End of the "two descriptions, one conflict" case

  it('treats a window already at the disk revision as a satisfied adoption', async () => {
    // **`alreadyThere` is a success**, and a boolean could not have carried it. The
    // second conflict describes the very bytes the first reapply installed, so
    // there is nothing to install and the rebuild proceeds.
    const commands = scriptedCommands({
      deletes: [deletionConflict(), deletionConflict()]
    });
    const state = await withTheSecondSnippetSelected(commands);
    const adopt = (conflict: ConflictModel<MatchId>, confirmation: ReloadConfirmation) =>
      state.adoptDiskVersion(conflict, confirmation);
    expect(((onHand) => reapplyToDiskVersion(onHand, adopt, null, () => onHand))(await conflictedDeletion(state)).kind).toBe('reapplied');
    expect(state.scopedDocument?.revision).toBe('rev-c');

    const again = await conflictedDeletion(state);
    expect(reapplyToDiskVersion(again, adopt, null, () => again).kind).toBe('reapplied');
    expect(state.scopedDocument?.revision).toBe('rev-c');
    expect(commands.deleteMatch).toHaveBeenCalledTimes(2);
  }); // End of the "already there" case
  describe('the observation protocol — Phase 2d-6-1b', () => {
    /**
     * Registers a recording receiver over one file.
     *
     * @param state - The window.
     * @param document - The file the fake session is over.
     * @returns The envelopes received, in order, and the unregister.
     */
    function receiverOver(
      state: BrowserState,
      document: DocumentId
    ): { readonly got: ObservationDelivery[]; readonly off: () => void } {
      const got: ObservationDelivery[] = [];
      const off = state.registerObservationReceiver(document, (delivery) => {
        got.push(delivery);
      });
      return { got, off };
    } // End of function receiverOver()

    /**
     * The verdict kinds a receiver saw, in order.
     *
     * @param got - What it received.
     * @returns The kinds.
     */
    function kindsOf(got: readonly ObservationDelivery[]): readonly string[] {
      return got.map((delivery) => delivery.verdict.kind);
    } // End of function kindsOf()

    /**
     * A window holding one uncertain write of `match/base.yml` and one observation
     * arbitrated under it, so that the file is under ruling 27's hold and an
     * `externalChange` origin stands.
     *
     * @param script - Anything else the boundary should answer.
     * @returns The window and the observation that stands.
     */
    async function underAnUncertainHold(
      script: Script = {}
    ): Promise<{ state: BrowserState; seen: ExternalConflictObservation; commands: BrowserCommands }> {
      const commands = scriptedCommands({
        ...script,
        raws: [WRITE_MAY_HAVE_HAPPENED, ...(script.raws ?? [])]
      });
      const state = await withTheSecondSnippetSelected(commands);
      expect(await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED)).toEqual({
        kind: 'failed',
        mayHaveWritten: true
      });
      expect(state.writeOutcomeUncertain(2)).toBe(true);
      const seen = externalObservation();
      expect(state.observeExternalChange(seen).verdict.kind).toBe('raisedWithoutReload');
      return { state, seen, commands };
    } // End of function underAnUncertainHold()

    it('delivers one sealed decision to every receiver over the file, and to no other file', async () => {
      // **Entries 2 and 4.** Two sessions over one file receive the *same* envelope
      // object — not two verdicts decided independently — and a session over
      // another file receives nothing. The envelope the method answers is the one
      // that was delivered.
      const commands = scriptedCommands();
      const state = await withTheSecondSnippetSelected(commands);
      const reads = (commands.getDocument as ReturnType<typeof vi.fn>).mock.calls.length;
      const first = receiverOver(state, 2);
      const second = receiverOver(state, 2);
      const elsewhere = receiverOver(state, 3);

      const seen = externalObservation();
      const answered = state.observeExternalChange(seen);

      expect(first.got).toHaveLength(1);
      expect(second.got).toHaveLength(1);
      expect(elsewhere.got).toEqual([]);
      expect(first.got[0]).toBe(answered);
      expect(second.got[0]).toBe(answered);
      expect(answered.observation).toBe(seen);
      expect(answered.verdict).toEqual({ kind: 'raised', source: externalConflictSource(seen) });
      expect(Object.isFrozen(answered)).toBe(true);
      // Delivered, registered, and nothing else: no read, no reload, no command.
      expect(state.standingConflictFor(2)).toBe(externalConflictSource(seen));
      expect(state.scopedDocument?.revision).toBe(baseDocument().revision);
      expect(commands.getDocument).toHaveBeenCalledTimes(reads);
      expect(commands.reloadDocument).not.toHaveBeenCalled();
      expect(invoked).not.toHaveBeenCalled();
      first.off();
      second.off();
      elsewhere.off();
    }); // End of the "one decision to every receiver" case

    it('delivers a held observation as retained, and its settlement verdict on the same path', async () => {
      // **Entry 2's second sentence, as behaviour.** Before this phase the
      // settlement arbitrated the held reading and discarded the answer; a session
      // told `retained` was never told how the wait ended. Now the same receiver
      // that got `retained` gets the settlement's verdict.
      const held = heldRawSave(
        { ok: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } },
        null
      );
      const state = await withTheSecondSnippetSelected(held.commands);
      const receiver = receiverOver(state, 2);
      // **The order entry 5 rests on, pinned on this side.** The settlement is
      // published from the lease's `close()` inside the wrapper's `finally`, so it
      // lands before the wrapper's promise settles and therefore before any
      // continuation awaiting that promise runs. What a session does with a
      // delivery that arrives before its own `await save(...)` resumes is the
      // session's, and 2d-6-6's mounted test; nothing here orders that.
      const order: string[] = [];
      const offOrder = state.registerObservationReceiver(2, (delivery) => {
        order.push(`delivered:${delivery.verdict.kind}`);
      });
      const sending = state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
      const continuation = sending.then(() => {
        order.push('continuation');
      });
      const seen = externalObservation();

      const heldEnvelope = state.observeExternalChange(seen);
      expect(kindsOf(receiver.got)).toEqual(['retained']);
      expect(receiver.got[0]).toBe(heldEnvelope);
      expect(state.retainedObservationFor(2)).toBe(seen);

      held.release();
      expect(await sending).toEqual({ kind: 'failed', mayHaveWritten: false });
      await continuation;
      expect(order).toEqual(['delivered:retained', 'delivered:raised', 'continuation']);
      offOrder();

      expect(kindsOf(receiver.got)).toEqual(['retained', 'raised']);
      const settled = receiver.got[1]!;
      expect(settled.observation).toBe(seen);
      expect(settled.verdict).toEqual({ kind: 'raised', source: externalConflictSource(seen) });
      expect(state.retainedObservationFor(2)).toBeNull();
      expect(state.standingConflictFor(2)).toBe(externalConflictSource(seen));
      // Registering is not adopting: the window is where it was.
      expect(state.scopedDocument?.revision).toBe(baseDocument().revision);
      expect(invoked).not.toHaveBeenCalled();
      receiver.off();
    }); // End of the "settlement verdict delivered" case

    it('announces a held reading dropped as the bytes its own commit ended on', async () => {
      // **The seventh arm, and why it exists.** The held reading is of exactly the
      // revision the transaction ended on, so it is not news and nothing stands
      // from it — but the session was told `retained`, and a wait that is never
      // announced over is a session that blocks for a check that already happened.
      // `writtenHere` says the revisions are equal and never who wrote them.
      const held = heldRawSave(
        {
          ok: true,
          value: {
            outcome: 'saved',
            revision: 'rev-c',
            committed: true,
            backup_taken: false,
            moved: null,
            notes: []
          },
          reload: { kind: 'done' }
        },
        'rev-c'
      );
      const state = await withTheSecondSnippetSelected(held.commands);
      const receiver = receiverOver(state, 2);
      const sending = state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
      const seen = externalObservation();
      state.observeExternalChange(seen);
      expect(kindsOf(receiver.got)).toEqual(['retained']);

      held.release();
      await sending;

      expect(kindsOf(receiver.got)).toEqual(['retained', 'writtenHere']);
      expect(receiver.got[1]!.observation).toBe(seen);
      expect(state.retainedObservationFor(2)).toBeNull();
      expect(state.standingConflictFor(2)).toBeNull();
      // The commit's own adoption is the only thing that moved the window.
      expect(state.scopedDocument?.revision).toBe('rev-c');
      expect(invoked).not.toHaveBeenCalled();
      receiver.off();
    }); // End of the "writtenHere is announced" case

    it('publishes a settlement without moving the drain watermark', async () => {
      // **Entry 2's last clause.** A settlement's publication neither admits a
      // sequence nor moves the cursor: the drain after it asks with the watermark
      // the last batch established, exactly as if nothing had been published.
      expectDrains([0, 0, 11]);
      const events = testEvents();
      const held = heldRawSave(
        { ok: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } },
        null,
        replacedDocument(),
        {
          drains: [
            reconciliationBatch(),
            reconciliationBatch({ epoch: 5, newest_sequence: 11 }),
            reconciliationBatch({ epoch: 5, newest_sequence: 12 })
          ]
        }
      );
      const state = createBrowserState(held.commands, () => undefined, undefined, events.source);
      state.start();
      await settleDrains();
      await state.open(null);
      await settleDrains();
      expect(drainSequences).toEqual([0, 0]);
      const receiver = receiverOver(state, 2);

      const sending = state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
      state.observeExternalChange(externalObservation());
      held.release();
      await sending;
      await settleDrains();
      expect(kindsOf(receiver.got)).toEqual(['retained', 'raised']);
      // Nothing drained on account of the publication.
      expect(drainSequences).toEqual([0, 0]);

      events.wake(5, 12);
      await settleDrains();
      // The cursor the second batch established, untouched by the publication.
      expect(drainSequences).toEqual([0, 0, 11]);
      expect(invoked).not.toHaveBeenCalled();
      receiver.off();
      state.dispose();
    }); // End of the "watermark unmoved" case

    it('keeps a receiver’s exception out of the settled write’s answer, and tells the others', async () => {
      // **A committed write is never afterwards reported as an error.** The
      // settlement publishes from inside the wrapper's `finally`; a receiver that
      // throws there would otherwise replace the committed answer with its
      // exception. It is reported on the injected channel instead, and its sibling
      // is still told.
      const reported: IpcFailure[] = [];
      const held = heldRawSave(
        {
          ok: true,
          value: {
            outcome: 'saved',
            revision: 'rev-d',
            committed: true,
            backup_taken: false,
            moved: null,
            notes: []
          },
          reload: { kind: 'done' }
        },
        'rev-d',
        laterDocument()
      );
      const state = createBrowserState(held.commands, (failure) => {
        reported.push(failure);
      });
      await state.open(null);
      state.show({ kind: 'document', id: 2 });
      const offThrowing = state.registerObservationReceiver(2, () => {
        throw new Error('this receiver is broken');
      });
      const sibling = receiverOver(state, 2);

      const sending = state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
      state.observeExternalChange(externalObservation());
      held.release();
      const answer = await sending;

      // The committed answer, intact, and the sibling told twice.
      expect(answer.kind).toBe('sealed');
      expect(outcomeOf(answer)?.outcome).toBe('saved');
      expect(kindsOf(sibling.got)).toEqual(['retained', 'raised']);
      expect(state.scopedDocument?.revision).toBe('rev-d');
      // Once per delivery the broken receiver was handed: the retention and the
      // settlement.
      expect(reported).toHaveLength(2);
      expect(reported.every((failure) => failure.kind === 'unexpected')).toBe(true);
      expect(invoked).not.toHaveBeenCalled();
      offThrowing();
      sibling.off();
    }); // End of the "receiver exception isolated" case

    /**
     * A committed raw save on other bytes, held open by the case, over a window
     * whose failure channel is the reporter given.
     *
     * The shape the review's blocker is re-derived on: the settlement publishes
     * from inside the wrapper's `finally`, so anything escaping delivery there
     * replaces the committed answer.
     *
     * @param report - The window's failure channel.
     * @returns The window, the gate and the pending save.
     */
    async function aCommittingSaveHeldOpen(
      report: (failure: IpcFailure) => void
    ): Promise<{ state: BrowserState; release: () => void; sending: Promise<RawSaveAnswer> }> {
      const held = heldRawSave(
        {
          ok: true,
          value: {
            outcome: 'saved',
            revision: 'rev-d',
            committed: true,
            backup_taken: false,
            moved: null,
            notes: []
          },
          reload: { kind: 'done' }
        },
        'rev-d',
        laterDocument()
      );
      const state = createBrowserState(held.commands, report);
      await state.open(null);
      state.show({ kind: 'document', id: 2 });
      const sending = state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
      return { state, release: held.release, sending };
    } // End of function aCommittingSaveHeldOpen()

    it('keeps a committed answer when the reporter itself throws on a receiver’s fault', async () => {
      // **The review's blocker, first half.** The receiver throws, the injected
      // reporter throws while reporting it: the second throw used to escape
      // `deliver`, then `close()`, then the wrapper's `finally`, and the committed
      // save came back as a rejection — the one report a committed write may
      // never receive. The sibling is still told both envelopes.
      let reports = 0;
      const { state, release, sending } = await aCommittingSaveHeldOpen(() => {
        reports += 1;
        throw new Error('the reporter is broken too');
      });
      const offThrowing = state.registerObservationReceiver(2, () => {
        throw new Error('this receiver is broken');
      });
      const sibling = receiverOver(state, 2);
      state.observeExternalChange(externalObservation());
      expect(kindsOf(sibling.got)).toEqual(['retained']);

      release();
      const answer = await sending;

      expect(answer.kind).toBe('sealed');
      expect(outcomeOf(answer)?.outcome).toBe('saved');
      expect(kindsOf(sibling.got)).toEqual(['retained', 'raised']);
      expect(state.scopedDocument?.revision).toBe('rev-d');
      // The reporter was reached once per fault and failed both times; nothing
      // else can carry that, and nothing else needs to.
      expect(reports).toBe(2);
      expect(invoked).not.toHaveBeenCalled();
      offThrowing();
      sibling.off();
    }); // End of the "reporter throws" case

    it('keeps a committed answer when the thrown value refuses to be classified', async () => {
      // **The review's blocker, second half.** `classifyFailure` in `../ipc/errors`
      // reads `code` off whatever was thrown, so a thrown object whose `code`
      // getter throws makes the classification itself throw — inside the `catch`
      // that was meant to contain the receiver. The committed answer survives and
      // the sibling is told.
      const reported: IpcFailure[] = [];
      const { state, release, sending } = await aCommittingSaveHeldOpen((failure) => {
        reported.push(failure);
      });
      const offThrowing = state.registerObservationReceiver(2, () => {
        throw {
          get code(): never {
            throw new Error('the thrown value is hostile');
          }
        };
      });
      const sibling = receiverOver(state, 2);
      state.observeExternalChange(externalObservation());

      release();
      const answer = await sending;

      expect(answer.kind).toBe('sealed');
      expect(outcomeOf(answer)?.outcome).toBe('saved');
      expect(kindsOf(sibling.got)).toEqual(['retained', 'raised']);
      expect(state.scopedDocument?.revision).toBe('rev-d');
      expect(invoked).not.toHaveBeenCalled();
      offThrowing();
      sibling.off();
    }); // End of the "unclassifiable throw" case

    it('delivers decisions to every receiver in the order they were made, across a re-entrant publication', async () => {
      // **The review's second finding.** Receiver A publishes a newer observation
      // from inside its handling of an older one. Without a queue the nested
      // delivery completes before the outer loop reaches B, so B is handed the
      // newer decision first and the older one second — the inversion entry 2's
      // "one decision to every session" exists to rule out.
      const state = await withTheSecondSnippetSelected(scriptedCommands());
      const older = externalObservation();
      const newer = laterObservation();
      const seenByA: string[] = [];
      const seenByB: string[] = [];
      let published = false;
      const offA = state.registerObservationReceiver(2, (delivery) => {
        seenByA.push(delivery.verdict.kind);
        if (!published) {
          published = true;
          state.observeExternalChange(newer);
        }
      });
      const offB = state.registerObservationReceiver(2, (delivery) => {
        seenByB.push(delivery.verdict.kind);
      });

      const answered = state.observeExternalChange(older);

      expect(answered.verdict.kind).toBe('raised');
      expect(seenByA).toEqual(['raised', 'supersedes']);
      expect(seenByB).toEqual(['raised', 'supersedes']);
      // Both were decided in that order too: the newer one supersedes the older.
      expect(state.standingConflictFor(2)).toBe(externalConflictSource(newer));
      expect(invoked).not.toHaveBeenCalled();
      offA();
      offB();
    }); // End of the "decision order across re-entrancy" case

    it('terminates when a receiver re-publishes what it receives, and when it publishes one newer reading on every delivery', async () => {
      // **The bound on the queue.** A receiver that forwards every envelope's
      // observation back through the door, and one that publishes the same newer
      // observation on every delivery, both come to rest: within one synchronous
      // drain a second verdict of the same kind about the same object is answered
      // to its caller and delivered to nobody, because it tells a recipient nothing
      // the first did not. What is *not* bounded, and could not be, is a receiver
      // that manufactures a fresh observation on every delivery.
      const state = await withTheSecondSnippetSelected(scriptedCommands());
      const forwarded: string[] = [];
      const offForwarding = state.registerObservationReceiver(2, (delivery) => {
        forwarded.push(delivery.verdict.kind);
        state.observeExternalChange(delivery.observation);
      });
      const witness = receiverOver(state, 2);

      state.observeExternalChange(externalObservation());
      expect(forwarded).toEqual(['raised', 'notLater']);
      expect(kindsOf(witness.got)).toEqual(['raised', 'notLater']);
      offForwarding();

      const newer = laterObservation();
      const pushing: string[] = [];
      const offPushing = state.registerObservationReceiver(2, (delivery) => {
        pushing.push(delivery.verdict.kind);
        state.observeExternalChange(newer);
      });
      state.observeExternalChange({ ...externalObservation(), sequence: 6 });
      // The sequence-6 reading of the same bytes coalesces into what stands, the
      // pushed reading supersedes, and the second push of it is `notLater` once;
      // the third is a repeat of that pair and goes nowhere.
      expect(pushing).toEqual(['coalesced', 'supersedes', 'notLater']);
      expect(kindsOf(witness.got).slice(2)).toEqual(['coalesced', 'supersedes', 'notLater']);
      expect(invoked).not.toHaveBeenCalled();
      offPushing();
      witness.off();
    }); // End of the "re-publication terminates" case

    it('removes only the registration an unregister was answered for', async () => {
      // **Instance-bound cleanup** (entry 1): the same function registered twice is
      // two registrations, each unregister removes exactly its own, and a second
      // call of one is inert rather than a removal of the other.
      const state = await withTheSecondSnippetSelected(scriptedCommands());
      let told = 0;
      const receiver = (): void => {
        told += 1;
      };
      const first = state.registerObservationReceiver(2, receiver);
      const second = state.registerObservationReceiver(2, receiver);

      state.observeExternalChange(externalObservation());
      expect(told).toBe(2);

      first();
      first();
      state.observeExternalChange(laterObservation());
      expect(told).toBe(3);

      second();
      state.observeExternalChange(laterObservation(10));
      expect(told).toBe(3);
      expect(invoked).not.toHaveBeenCalled();
    }); // End of the "instance-bound unregister" case

    it('fixes a delivery’s recipients before the first is told', async () => {
      // A receiver that registers a sibling during a delivery changes the next
      // delivery's recipients, not this one's; one that removes itself is still
      // told this time and not the next.
      const state = await withTheSecondSnippetSelected(scriptedCommands());
      const late: ObservationDelivery[] = [];
      // The unregisters the self-removing receiver hands out, collected in an
      // array because control-flow narrowing cannot see an assignment made inside
      // a callback.
      const cleanups: (() => void)[] = [];
      let selfTold = 0;
      const offSelf = state.registerObservationReceiver(2, () => {
        selfTold += 1;
        if (cleanups.length === 0) {
          cleanups.push(
            state.registerObservationReceiver(2, (delivery) => {
              late.push(delivery);
            })
          );
        }
        offSelf();
      });

      state.observeExternalChange(externalObservation());
      expect(selfTold).toBe(1);
      expect(late).toEqual([]);

      state.observeExternalChange(laterObservation());
      expect(selfTold).toBe(1);
      expect(kindsOf(late)).toEqual(['supersedes']);
      for (const off of cleanups) {
        off();
      }
    }); // End of the "recipients fixed at the start" case

    /**
     * A window holding one observation the barrier retains with **no** write in
     * flight — the re-entrant registration Phase 2d-5-5b's review found, which is
     * the one way an observation stays held after every write has settled.
     *
     * The outer observation's `diskRevision` getter re-enters this state once, on
     * its first read, to register `inner`; the outer verdict was decided against
     * the tables before that, so `arbitrateHere` retains it. Every later read runs
     * `onLaterRead` instead, and the reads are counted.
     *
     * @param commands - The boundary.
     * @param inner - What the first read registers.
     * @param onLaterRead - What every read after the first does.
     * @returns The window, the held observation and the read count.
     */
    async function withARetainedObservation(
      commands: BrowserCommands,
      inner: ExternalConflictObservation,
      onLaterRead: (state: BrowserState) => void = () => undefined
    ): Promise<{ state: BrowserState; outer: ExternalConflictObservation; reads: () => number }> {
      const state = await withTheSecondSnippetSelected(commands);
      let reads = 0;
      const outer: ExternalConflictObservation = {
        sequence: 5,
        document: 2,
        previousRevision: 'rev-a',
        get diskRevision(): ContentRevision {
          reads += 1;
          if (reads === 1) {
            state.observeExternalChange(inner);
          } else {
            onLaterRead(state);
          }
          return 'rev-c';
        },
        diskText: DISK_TEXT,
        disk: replacedDocument(),
        findings: [],
        correspondences: null
      };
      expect(state.observeExternalChange(outer).verdict).toEqual({ kind: 'retained' });
      expect(state.retainedObservationFor(2)).toBe(outer);
      expect(state.writeInFlight(2)).toBe(false);
      return { state, outer, reads: () => reads };
    } // End of function withARetainedObservation()

    /**
     * An older, different reading of `match/base.yml` than {@link externalObservation}.
     *
     * Sequence 3 and revision `rev-b`, so a held sequence-5 reading of `rev-c`
     * arbitrated against it is a supersession rather than `notLater`.
     *
     * @returns The observation.
     */
    function olderObservation(): ExternalConflictObservation {
      return {
        sequence: 3,
        document: 2,
        previousRevision: 'rev-a',
        diskRevision: 'rev-b',
        diskText: '# an older reading\n',
        disk: makeDocument({
          id: 2,
          relativePath: 'match/base.yml',
          revision: 'rev-b',
          matches: [makeMatch({ node: 60, document: 2, revision: 'rev-b', trigger: ':older' })]
        }),
        findings: [],
        correspondences: null
      };
    } // End of function olderObservation()

    it('retries a held observation at its original arrival generation, never at today’s', async () => {
      // **Entry 17, as the defect it forbids.** The reading is held at generation
      // g0; a re-read then installs `rev-d`, so the window is at g1 when the person
      // presses retry. The retry registers the reading at g0, and the adoption door
      // refuses to move the window backwards onto it — where a fresh
      // `observeExternalChange` would have registered it at g1 and installed
      // `rev-c` over `rev-d`, reporting success for it.
      const inner = olderObservation();
      const { state, outer } = await withARetainedObservation(
        scriptedCommands({ reload: { ok: true, value: laterDocument() } }),
        inner
      );
      const receiver = receiverOver(state, 2);
      expect(await state.rereadDocument(2)).toBeNull();
      expect(state.scopedDocument?.revision).toBe('rev-d');

      const pressed = state.retryRetainedObservation(2);

      expect(pressed.kind).toBe('attempted');
      if (pressed.kind !== 'attempted') {
        throw new Error('the retry is what this case is about');
      }
      expect(pressed.delivery.observation).toBe(outer);
      expect(pressed.delivery.verdict).toEqual({
        kind: 'supersedes',
        superseded: externalConflictSource(inner),
        source: externalConflictSource(outer)
      });
      expect(receiver.got).toEqual([pressed.delivery]);
      expect(state.retainedObservationFor(2)).toBeNull();
      expect(state.standingConflictFor(2)).toBe(externalConflictSource(outer));
      // Registered at g0, so the door refuses it against a window at g1.
      const model = externalModelOf(outer);
      expect(state.adoptDiskVersion(model, confirmReloadDiskVersion(model))).toBe('refused');
      expect(state.scopedDocument?.revision).toBe('rev-d');
      expect(invoked).not.toHaveBeenCalled();
      receiver.off();
    }); // End of the "original arrival generation" case

    it('would renew the evidence through a fresh observeExternalChange — the negative control', async () => {
      // The same window, the same held reading, the same re-read — and the path
      // entry 17 forbids instead of the retry. It registers at g1 and the door
      // installs `rev-c` over `rev-d`, which is exactly the renewal the retry above
      // does not perform.
      const inner = olderObservation();
      const { state, outer } = await withARetainedObservation(
        scriptedCommands({ reload: { ok: true, value: laterDocument() } }),
        inner
      );
      expect(await state.rereadDocument(2)).toBeNull();

      expect(state.observeExternalChange(outer).verdict.kind).toBe('supersedes');

      const model = externalModelOf(outer);
      expect(state.adoptDiskVersion(model, confirmReloadDiskVersion(model))).toBe('installed');
      expect(state.scopedDocument?.revision).toBe('rev-c');
    }); // End of the negative control

    it('makes at most one attempt per press, and a re-entrant press makes none', async () => {
      // **Entry 16.** A press inside the attempt finds the barrier already empty:
      // the record is taken out before the arbitration reads anything of the
      // caller's, so two presses cannot arbitrate one record twice. One press, one
      // read of the getter, one envelope.
      const reentrant: RetainedRetryOutcome[] = [];
      const { state, outer, reads } = await withARetainedObservation(
        scriptedCommands(),
        olderObservation(),
        (window) => {
          reentrant.push(window.retryRetainedObservation(2));
        }
      );
      const receiver = receiverOver(state, 2);
      expect(reads()).toBe(1);

      const pressed = state.retryRetainedObservation(2);

      expect(pressed.kind).toBe('attempted');
      expect(reads()).toBe(2);
      expect(reentrant).toEqual([{ kind: 'nothingRetained' }]);
      expect(receiver.got).toHaveLength(1);
      expect(receiver.got[0]?.observation).toBe(outer);
      expect(state.retainedObservationFor(2)).toBeNull();
      // And a press with nothing held is a press that does nothing.
      expect(state.retryRetainedObservation(2)).toEqual({ kind: 'nothingRetained' });
      expect(receiver.got).toHaveLength(1);
      expect(invoked).not.toHaveBeenCalled();
      receiver.off();
    }); // End of the "one attempt per press" case

    it('keeps the record when the retry’s arbitration throws before deciding', async () => {
      // **The review's third finding.** The record leaves the barrier before the
      // arbitration reads the caller's observation, so a getter that throws on that
      // read used to lose the record: nothing held, nothing standing, nothing
      // delivered, and no press could ever ask again — where entry 16 says a
      // re-entrant press leaves the observation held and askable. The throw still
      // reaches the caller; what changes is that the barrier holds what it held,
      // at the arrival generation it held it at.
      const inner = olderObservation();
      let throwing = true;
      const { state, outer, reads } = await withARetainedObservation(
        scriptedCommands(),
        inner,
        () => {
          if (throwing) {
            throw new Error('the getter threw on the retry');
          }
        }
      );
      const receiver = receiverOver(state, 2);

      expect(() => state.retryRetainedObservation(2)).toThrow('the getter threw on the retry');

      // Identity through a boolean rather than `toBe`, so a failure prints `false`
      // instead of formatting an object whose getter throws.
      expect(reads()).toBe(2);
      expect(state.retainedObservationFor(2) === outer).toBe(true);
      expect(state.standingConflictFor(2)).toBe(externalConflictSource(inner));
      expect(receiver.got).toEqual([]);
      // Askable again: a second press throws the same way and loses nothing, and
      // a press whose read does not throw decides at the original arrival.
      expect(() => state.retryRetainedObservation(2)).toThrow('the getter threw on the retry');
      expect(state.retainedObservationFor(2) === outer).toBe(true);
      throwing = false;
      const pressed = state.retryRetainedObservation(2);
      expect(pressed.kind).toBe('attempted');
      expect(kindsOf(receiver.got)).toEqual(['supersedes']);
      expect(state.retainedObservationFor(2)).toBeNull();
      expect(reads()).toBe(4);
      expect(invoked).not.toHaveBeenCalled();
      receiver.off();
    }); // End of the "record survives a throwing arbitration" case

    it('does not overwrite a record a re-entrant retention made while the retry’s arbitration was throwing', async () => {
      // **The other edge of the same fix.** The getter first retains a *newer*
      // reading re-entrantly — a write opens, an observation arrives, the write is
      // still out — and then throws. Restoring the outer record over that newer one
      // would be a second writer of the barrier's table; the barrier keeps the
      // newest, exactly as `retainObservation` always has.
      const gate = deferred<void>();
      const base = scriptedCommands();
      const commands: BrowserCommands = {
        ...base,
        saveRawDocument: vi.fn(async (): Promise<RawSaveOutcome> => {
          await gate.promise;
          return { ok: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } };
        })
      };
      const newer = laterObservation(30);
      let sending: Promise<RawSaveAnswer> | null = null;
      const { state, outer } = await withARetainedObservation(
        commands,
        olderObservation(),
        (window) => {
          sending = window.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
          window.observeExternalChange(newer);
          throw new Error('the getter threw after retaining');
        }
      );

      expect(() => state.retryRetainedObservation(2)).toThrow('the getter threw after retaining');

      // The newer reading is what the barrier holds, not the older one restored
      // over it; the write is still out, so a press is unavailable rather than lost.
      // Identity through booleans throughout: a failing `toBe` makes vitest walk
      // both operands for its hint, and walking `outer` runs the throwing getter.
      expect(state.retainedObservationFor(2) === newer).toBe(true);
      expect(state.retainedObservationFor(2) === outer).toBe(false);
      expect(state.retryRetainedObservation(2)).toEqual({ kind: 'writeInFlight' });
      gate.resolve();
      if (sending === null) {
        throw new Error('the getter was expected to start a write');
      }
      await sending;
      // The settlement released and registered the newer reading; the older one
      // was consumed by the throwing attempt, which is the cost the fix names.
      expect(state.retainedObservationFor(2)).toBeNull();
      expect(state.standingConflictFor(2) === externalConflictSource(newer)).toBe(true);
      expect(state.standingConflictFor(2) === externalConflictSource(outer)).toBe(false);
      expect(invoked).not.toHaveBeenCalled();
    }); // End of the "re-entrant retention is not overwritten" case

    it('leaves the observation held and askable again when the tables move under the attempt', async () => {
      // **Entry 16's re-entrancy clause, and the case 5b recorded as stranded.**
      // Every arbitration of this reading finds a newer origin registered underneath
      // it, so every press retains it again — at the same arrival generation — and
      // answers `retained`. Three presses are three arbitrations and nothing more:
      // no loop, and the action is askable after each.
      let sequence = 20;
      const { state, outer, reads } = await withARetainedObservation(
        scriptedCommands(),
        olderObservation(),
        (window) => {
          // A distinct revision each time, so every re-entrant reading supersedes
          // the one before it rather than coalescing into it.
          sequence += 1;
          window.observeExternalChange({
            ...laterObservation(sequence),
            diskRevision: `rev-e${sequence}`
          });
        }
      );
      const receiver = receiverOver(state, 2);

      for (let press = 1; press <= 3; press += 1) {
        const pressed = state.retryRetainedObservation(2);
        expect(pressed.kind, `press ${press}`).toBe('attempted');
        if (pressed.kind === 'attempted') {
          expect(pressed.delivery.verdict, `press ${press}`).toEqual({ kind: 'retained' });
          expect(pressed.delivery.observation, `press ${press}`).toBe(outer);
        }
        expect(state.retainedObservationFor(2), `press ${press}`).toBe(outer);
        expect(reads(), `press ${press}`).toBe(1 + press);
      } // End of the loop over three presses
      // The re-entrant readings were delivered too — each was arbitrated and
      // registered as it arrived — and each press delivered its own `retained`.
      expect(kindsOf(receiver.got)).toEqual([
        'supersedes',
        'retained',
        'supersedes',
        'retained',
        'supersedes',
        'retained'
      ]);
      expect(invoked).not.toHaveBeenCalled();
      receiver.off();
    }); // End of the "held and askable again" case

    it('is unavailable while a write is in flight, and leaves the record for the settlement', async () => {
      // **Entry 16's barrier clause.** The press is refused, the record is
      // untouched, nothing is delivered for it, and the write's own settlement is
      // what releases the reading — on the delivery path.
      const held = heldRawSave(
        { ok: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } },
        null
      );
      const state = await withTheSecondSnippetSelected(held.commands);
      const receiver = receiverOver(state, 2);
      const sending = state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
      const seen = externalObservation();
      state.observeExternalChange(seen);

      expect(state.retryRetainedObservation(2)).toEqual({ kind: 'writeInFlight' });
      expect(state.retainedObservationFor(2)).toBe(seen);
      expect(state.standingConflictFor(2)).toBeNull();
      expect(kindsOf(receiver.got)).toEqual(['retained']);

      held.release();
      await sending;
      expect(kindsOf(receiver.got)).toEqual(['retained', 'raised']);
      expect(state.retainedObservationFor(2)).toBeNull();
      expect(state.retryRetainedObservation(2)).toEqual({ kind: 'nothingRetained' });
      expect(invoked).not.toHaveBeenCalled();
      receiver.off();
    }); // End of the "unavailable in flight" case

    it('initiates no command from a retry, whatever it answers', async () => {
      // **Entry 18's negative spy.** The hoisted `invoke` spy is the route around the
      // injected surface, and the surface's own stubs are the route through it:
      // both are held to their counts across a refused press, an attempt and a
      // press with nothing held.
      const held = heldRawSave(
        { ok: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } },
        null
      );
      const commands = held.commands;
      const state = await withTheSecondSnippetSelected(commands);
      const reads = (commands.getDocument as ReturnType<typeof vi.fn>).mock.calls.length;
      const texts = (commands.documentText as ReturnType<typeof vi.fn>).mock.calls.length;
      const sending = state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
      state.observeExternalChange(externalObservation());
      state.retryRetainedObservation(2);
      held.release();
      await sending;
      state.retryRetainedObservation(2);

      for (const writer of [
        commands.moveMatch,
        commands.saveMatch,
        commands.createMatch,
        commands.deleteMatch,
        commands.duplicateMatch
      ]) {
        expect(writer).not.toHaveBeenCalled();
      } // End of the loop over the five editing commands
      expect(commands.saveRawDocument).toHaveBeenCalledTimes(1);
      expect(commands.reloadDocument).not.toHaveBeenCalled();
      expect(commands.getDocument).toHaveBeenCalledTimes(reads);
      expect(commands.documentText).toHaveBeenCalledTimes(texts);
      expect(invoked).not.toHaveBeenCalled();
    }); // End of the "no command from a retry" case

    it('ends the hold once, installing nothing, issuing no command and re-observing nothing', async () => {
      // **Entries 14 and 15.** One acknowledgement, minted against the origin the
      // person reviewed, ends the hold and does nothing else: the projection is the
      // very object it was, the standing origin is the one that stood — no fresh
      // `raised` was manufactured — and a second spend is refused. The reload
      // afterwards still goes through the door with its own confirmation.
      const { state, seen, commands } = await underAnUncertainHold();
      const source = externalConflictSource(seen);
      const projection = state.scopedDocument;
      const reads = (commands.getDocument as ReturnType<typeof vi.fn>).mock.calls.length;
      const receiver = receiverOver(state, 2);

      const acknowledgement = state.uncertaintyAcknowledgementFor(source);
      expect(acknowledgement).not.toBeNull();
      if (acknowledgement === null) {
        throw new Error('the acknowledgement is what this case is about');
      }
      expect(state.acknowledgeWriteUncertainty(acknowledgement)).toEqual({ kind: 'acknowledged' });

      expect(state.writeOutcomeUncertain(2)).toBe(false);
      expect(state.scopedDocument).toBe(projection);
      expect(state.standingConflictFor(2)).toBe(source);
      expect(receiver.got).toEqual([]);
      expect(commands.getDocument).toHaveBeenCalledTimes(reads);
      expect(commands.reloadDocument).not.toHaveBeenCalled();
      expect(commands.saveRawDocument).toHaveBeenCalledTimes(1);
      // One-shot: spent, and nothing further to mint against.
      expect(state.acknowledgeWriteUncertainty(acknowledgement)).toEqual({
        kind: 'refused',
        reason: 'spent'
      });
      expect(state.uncertaintyAcknowledgementFor(source)).toBeNull();
      // The reload is the door's, as ever: no consent was minted here.
      const model = externalModelOf(seen);
      expect(state.adoptDiskVersion(model, confirmReloadDiskVersion(model))).toBe('installed');
      expect(state.scopedDocument?.revision).toBe('rev-c');
      expect(invoked).not.toHaveBeenCalled();
      receiver.off();
    }); // End of the "acknowledged once" case

    it('rebuilds availability after acknowledgement: a later reading supersedes rather than raising without reload', async () => {
      // **Entry 15's first clause.** After the hold ends, the next verdict for the
      // file is the ordinary one; the acknowledged conflict itself is not
      // re-observed to reach it.
      const { state, seen } = await underAnUncertainHold();
      const acknowledgement = state.uncertaintyAcknowledgementFor(externalConflictSource(seen));
      if (acknowledgement === null) {
        throw new Error('this case needs an acknowledgement');
      }
      expect(state.acknowledgeWriteUncertainty(acknowledgement).kind).toBe('acknowledged');

      const later = laterObservation();
      expect(state.observeExternalChange(later).verdict).toEqual({
        kind: 'supersedes',
        superseded: externalConflictSource(seen),
        source: externalConflictSource(later)
      });
      expect(state.writeOutcomeUncertain(2)).toBe(false);
    }); // End of the "availability rebuilt" case

    it('refuses an acknowledgement while a write is in flight, spending nothing', async () => {
      // **Entry 14's in-flight clause.** The first save leaves the hold; the second
      // is held open by the case. While it is out the acknowledgement is refused
      // and nothing can be minted; when it settles having written nothing, the
      // hold and its generation are what they were, and the refused acknowledgement
      // — which spent nothing — succeeds.
      const gate = deferred<void>();
      let saves = 0;
      const base = scriptedCommands();
      const commands: BrowserCommands = {
        ...base,
        saveRawDocument: vi.fn(async (): Promise<RawSaveOutcome> => {
          saves += 1;
          if (saves === 1) {
            if (WRITE_MAY_HAVE_HAPPENED.ok) {
              throw new Error('this case needs a rejection');
            }
            return { ok: false, failure: WRITE_MAY_HAVE_HAPPENED.failure };
          }
          await gate.promise;
          return { ok: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } };
        })
      };
      const state = await withTheSecondSnippetSelected(commands);
      await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
      const seen = externalObservation();
      expect(state.observeExternalChange(seen).verdict.kind).toBe('raisedWithoutReload');
      const source = externalConflictSource(seen);
      const acknowledgement = state.uncertaintyAcknowledgementFor(source);
      if (acknowledgement === null) {
        throw new Error('this case needs an acknowledgement');
      }

      const sending = state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
      expect(state.writeInFlight(2)).toBe(true);
      expect(state.acknowledgeWriteUncertainty(acknowledgement)).toEqual({
        kind: 'refused',
        reason: 'writeInFlight'
      });
      expect(state.uncertaintyAcknowledgementFor(source)).toBeNull();
      expect(state.writeOutcomeUncertain(2)).toBe(true);

      gate.resolve();
      expect(await sending).toEqual({ kind: 'failed', mayHaveWritten: false });
      expect(state.writeInFlight(2)).toBe(false);
      expect(state.acknowledgeWriteUncertainty(acknowledgement)).toEqual({ kind: 'acknowledged' });
      expect(state.writeOutcomeUncertain(2)).toBe(false);
      expect(invoked).not.toHaveBeenCalled();
    }); // End of the "refused in flight" case

    it('refuses an acknowledgement minted for an origin a later reading superseded', async () => {
      // **Entry 14's supersession clause.** The person reviewed one snapshot; a
      // strictly later reading now stands, so that review says nothing about the
      // file as this window now knows it. Nothing is spent, and a fresh
      // acknowledgement against the origin that stands succeeds.
      const { state, seen } = await underAnUncertainHold();
      const stale = state.uncertaintyAcknowledgementFor(externalConflictSource(seen));
      if (stale === null) {
        throw new Error('this case needs an acknowledgement');
      }
      const later = laterObservation();
      expect(state.observeExternalChange(later).verdict.kind).toBe('raisedWithoutReload');

      expect(state.acknowledgeWriteUncertainty(stale)).toEqual({
        kind: 'refused',
        reason: 'superseded'
      });
      expect(state.writeOutcomeUncertain(2)).toBe(true);
      // The superseded origin cannot be minted against any more, and the standing
      // one can.
      expect(state.uncertaintyAcknowledgementFor(externalConflictSource(seen))).toBeNull();
      const fresh = state.uncertaintyAcknowledgementFor(externalConflictSource(later));
      expect(fresh).not.toBeNull();
      if (fresh !== null) {
        expect(state.acknowledgeWriteUncertainty(fresh)).toEqual({ kind: 'acknowledged' });
      }
      expect(state.writeOutcomeUncertain(2)).toBe(false);
      expect(invoked).not.toHaveBeenCalled();
    }); // End of the "refused after supersession" case

    it('refuses an acknowledgement at a moved projection generation, and after an open', async () => {
      // **Entry 14's outlived-generation clause, both generations.** A re-read
      // replaces the projection after the reviewed origin arrived, so the snapshot
      // reviewed is one the window has moved past; and an `open()` replaces the
      // workspace the hold was about.
      const { state, seen } = await underAnUncertainHold({
        reload: { ok: true, value: laterDocument() }
      });
      const source = externalConflictSource(seen);
      const beforeReread = state.uncertaintyAcknowledgementFor(source);
      if (beforeReread === null) {
        throw new Error('this case needs an acknowledgement');
      }
      expect(await state.rereadDocument(2)).toBeNull();
      expect(state.scopedDocument?.revision).toBe('rev-d');

      expect(state.acknowledgeWriteUncertainty(beforeReread)).toEqual({
        kind: 'refused',
        reason: 'projectionReplaced'
      });
      expect(state.writeOutcomeUncertain(2)).toBe(true);
      // Nor can one be minted now: the origin's arrival generation is outlived.
      expect(state.uncertaintyAcknowledgementFor(source)).toBeNull();

      // A second window, for the open-generation half.
      const other = await underAnUncertainHold();
      const beforeOpen = other.state.uncertaintyAcknowledgementFor(
        externalConflictSource(other.seen)
      );
      if (beforeOpen === null) {
        throw new Error('this case needs an acknowledgement');
      }
      await other.state.open(null);
      expect(other.state.acknowledgeWriteUncertainty(beforeOpen)).toEqual({
        kind: 'refused',
        reason: 'workspaceReplaced'
      });
      expect(invoked).not.toHaveBeenCalled();
    }); // End of the "refused at a moved generation" case

    it('refuses an acknowledgement of a hold a later uncertain write re-established', async () => {
      // **The uncertainty generation.** The person reviewed a snapshot under the
      // first hold; a second write of this window's own then also may have
      // written. That snapshot says nothing about the second write, so the first
      // acknowledgement is refused for the hold that now stands, and one minted
      // afterwards ends it. The second write is a boundary rejection, which the
      // lease closes as `uncertain` without re-reading the file: a `mayHaveWritten`
      // answer re-reads and would move the projection generation too, and the
      // refusal would then be `projectionReplaced` — asked first, and equally true.
      let saves = 0;
      const base = scriptedCommands({ raws: [WRITE_MAY_HAVE_HAPPENED] });
      const commands: BrowserCommands = {
        ...base,
        saveRawDocument: vi.fn(
          async (...args: Parameters<BrowserCommands['saveRawDocument']>): Promise<RawSaveOutcome> => {
            saves += 1;
            if (saves === 1) {
              return base.saveRawDocument(...args);
            }
            throw new Error('the boundary rejected');
          }
        )
      };
      const state = await withTheSecondSnippetSelected(commands);
      await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
      const seen = externalObservation();
      expect(state.observeExternalChange(seen).verdict.kind).toBe('raisedWithoutReload');
      const source = externalConflictSource(seen);
      const first = state.uncertaintyAcknowledgementFor(source);
      if (first === null) {
        throw new Error('this case needs an acknowledgement');
      }
      await expect(
        state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED)
      ).rejects.toThrow('the boundary rejected');
      expect(state.writeInFlight(2)).toBe(false);
      expect(state.writeOutcomeUncertain(2)).toBe(true);

      expect(state.acknowledgeWriteUncertainty(first)).toEqual({
        kind: 'refused',
        reason: 'holdMoved'
      });
      expect(state.writeOutcomeUncertain(2)).toBe(true);
      const second = state.uncertaintyAcknowledgementFor(source);
      expect(second).not.toBeNull();
      if (second !== null) {
        expect(state.acknowledgeWriteUncertainty(second)).toEqual({ kind: 'acknowledged' });
      }
      expect(state.writeOutcomeUncertain(2)).toBe(false);
      expect(invoked).not.toHaveBeenCalled();
    }); // End of the "hold re-established" case

    it('mints nothing for an unknown origin, a file under no hold, or an origin this window never registered', async () => {
      const state = await withTheSecondSnippetSelected(scriptedCommands());
      // Never registered here: a memoized origin of an observation nobody observed.
      expect(state.uncertaintyAcknowledgementFor(externalConflictSource(externalObservation()))).toBeNull();
      // Registered, standing, and under no hold.
      const seen = externalObservation();
      expect(state.observeExternalChange(seen).verdict.kind).toBe('raised');
      expect(state.uncertaintyAcknowledgementFor(externalConflictSource(seen))).toBeNull();
      // A hand-built object of the shape names nothing.
      expect(state.acknowledgeWriteUncertainty({} as UncertaintyAcknowledgement)).toEqual({
        kind: 'refused',
        reason: 'unknown'
      });
      expect(invoked).not.toHaveBeenCalled();
    }); // End of the "mints nothing" case

    it('acknowledges against a standing save refusal too, since the hold is per file', async () => {
      // The record's entry 14 binds the acknowledgement to the *standing* origin,
      // whichever kind stands: a refused save's `disk_text` is a disk snapshot too,
      // and a file under the hold with a save conflict standing would otherwise
      // have no third exit at all.
      const commands = scriptedCommands({ raws: [WRITE_MAY_HAVE_HAPPENED, CONFLICT] });
      const state = await withTheSecondSnippetSelected(commands);
      await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
      await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
      const model = modelOf();
      expect(state.standingConflictFor(2)).toBe(model.source);
      expect(state.writeOutcomeUncertain(2)).toBe(true);

      const acknowledgement = state.uncertaintyAcknowledgementFor(model.source);
      expect(acknowledgement).not.toBeNull();
      if (acknowledgement !== null) {
        expect(state.acknowledgeWriteUncertainty(acknowledgement)).toEqual({ kind: 'acknowledged' });
      }
      expect(state.writeOutcomeUncertain(2)).toBe(false);
      expect(state.scopedDocument?.revision).toBe(baseDocument().revision);
      expect(invoked).not.toHaveBeenCalled();
    }); // End of the "save origin" case

    it('answers the guard’s three facts per file, and the hold outlives every surface over it', async () => {
      // **Entry 15's last sentence, through the pure predicate.** Two panels over
      // one file share one hold; closing one does not release it; closing both
      // does not either — the refusal is `uncertaintyUnresolved` with no surface
      // registered at all — and only the acknowledgement permits.
      const { state } = await underAnUncertainHold();
      const editor = state.registerWriteSurface(
        { kind: 'matchEditor', target: { kind: 'document', document: 2 } },
        () => undefined
      );
      const deleter = state.registerWriteSurface(
        { kind: 'matchDeleter', target: { kind: 'document', document: 2 } },
        () => undefined
      );

      expect(state.automaticReloadGuardFor(2)).toEqual({
        uncertaintyUnresolved: true,
        observationRetained: false,
        surfaceOpen: true
      });
      expect(decideAutomaticReload(state.automaticReloadGuardFor(2))).toEqual({
        kind: 'refused',
        reason: 'uncertaintyUnresolved'
      });
      // The other file shares nothing.
      expect(state.automaticReloadGuardFor(3)).toEqual({
        uncertaintyUnresolved: false,
        observationRetained: false,
        surfaceOpen: false
      });
      expect(decideAutomaticReload(state.automaticReloadGuardFor(3))).toEqual({ kind: 'permitted' });

      editor();
      expect(state.automaticReloadGuardFor(2).surfaceOpen).toBe(true);
      expect(state.automaticReloadGuardFor(2).uncertaintyUnresolved).toBe(true);
      deleter();
      expect(state.automaticReloadGuardFor(2)).toEqual({
        uncertaintyUnresolved: true,
        observationRetained: false,
        surfaceOpen: false
      });
      expect(decideAutomaticReload(state.automaticReloadGuardFor(2))).toEqual({
        kind: 'refused',
        reason: 'uncertaintyUnresolved'
      });

      const standing = state.standingConflictFor(2);
      const acknowledgement = standing === null ? null : state.uncertaintyAcknowledgementFor(standing);
      if (acknowledgement === null) {
        throw new Error('this case needs an acknowledgement');
      }
      expect(state.acknowledgeWriteUncertainty(acknowledgement).kind).toBe('acknowledged');
      expect(decideAutomaticReload(state.automaticReloadGuardFor(2))).toEqual({ kind: 'permitted' });
      expect(Object.isFrozen(state.automaticReloadGuardFor(2))).toBe(true);
      expect(invoked).not.toHaveBeenCalled();
    }); // End of the "guard state per file" case

    it('counts a retained observation and an eligible unknown-target creator as the guard does', async () => {
      // The other two facts, from their tables: the barrier's, while a write is
      // out; and the registry's, through the same `targetingSurfaceFor` the
      // coordinator asks — so a destination-less creator covers the eligible match
      // file and not the profile.
      const held = heldRawSave(
        { ok: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } },
        null
      );
      const state = await withTheSecondSnippetSelected(held.commands);
      const sending = state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
      state.observeExternalChange(externalObservation());
      expect(state.automaticReloadGuardFor(2)).toEqual({
        uncertaintyUnresolved: false,
        observationRetained: true,
        surfaceOpen: false
      });
      expect(decideAutomaticReload(state.automaticReloadGuardFor(2))).toEqual({
        kind: 'refused',
        reason: 'observationRetained'
      });
      held.release();
      await sending;
      expect(state.automaticReloadGuardFor(2).observationRetained).toBe(false);

      const creator = state.registerWriteSurface(
        { kind: 'matchCreator', target: { kind: 'unknown' } },
        () => undefined
      );
      expect(state.automaticReloadGuardFor(2).surfaceOpen).toBe(true);
      expect(state.automaticReloadGuardFor(3).surfaceOpen).toBe(true);
      expect(state.automaticReloadGuardFor(1).surfaceOpen).toBe(false);
      creator();
      expect(state.automaticReloadGuardFor(2).surfaceOpen).toBe(false);
      expect(invoked).not.toHaveBeenCalled();
    }); // End of the "retained and creator facts" case
  }); // End of the "observation protocol" suite

  describe('the coordinator and workspace members — Phase 2d-6-1c', () => {
    /**
     * A boundary whose `reload_document` answers only when the case says so.
     *
     * Each call is its own promise, oldest released first, so a case can put the
     * window into a different state *between* a reread's request and its answer —
     * which is the only way to show that the guard is re-asked at the installation
     * rather than replayed from the request.
     *
     * @param script - Anything else the boundary should answer.
     * @returns The boundary, and the gate that answers the oldest pending read.
     */
    function heldReloads(script: Script = {}): {
      commands: BrowserCommands;
      release: () => void;
    } {
      const scripted = scriptedCommands(script);
      const waiting: ((value: CommandResult<DocumentView>) => void)[] = [];
      return {
        commands: {
          ...scripted,
          reloadDocument: vi.fn(
            (): Promise<CommandResult<DocumentView>> =>
              new Promise((resolve) => {
                waiting.push(resolve);
              })
          )
        },
        release: () => {
          const settle = waiting.shift();
          if (settle === undefined) {
            throw new Error('no reload is waiting to be answered');
          }
          settle({ ok: true, value: rereadBaseDocument() });
        }
      };
    } // End of function heldReloads()

    /**
     * A window holding one uncertain write of `match/base.yml`, so the file is
     * under ruling 27's hold with no surface open and no write out.
     *
     * The 1b suite's `underAnUncertainHold` is scoped to that suite; this one
     * differs in registering no observation, because the hold alone is the input
     * these cases are about.
     *
     * @returns The window and its boundary.
     */
    async function underTheUncertaintyHold(): Promise<{
      state: BrowserState;
      commands: BrowserCommands;
    }> {
      const commands = scriptedCommands({ raws: [WRITE_MAY_HAVE_HAPPENED] });
      const state = await withTheSecondSnippetSelected(commands);
      expect(await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED)).toEqual({
        kind: 'failed',
        mayHaveWritten: true
      });
      expect(state.writeOutcomeUncertain(2)).toBe(true);
      return { state, commands };
    } // End of function underTheUncertaintyHold()

    /**
     * A wake transport whose registration rejects with what the case says.
     *
     * @param error - What `subscribe` rejects with.
     * @returns The source.
     */
    function rejectingEvents(error: unknown): ReconciliationEventSource {
      return {
        /**
         * Refuses.
         *
         * @returns A promise that rejects with the case's value.
         */
        subscribe(): Promise<ReconciliationUnlisten> {
          return Promise.reject(error);
        }
      };
    } // End of function rejectingEvents()

    it('bumps one revision on every announcement, sanitizes the rejection, and leaves the selection the object it was', async () => {
      // **Entry 28 on this state.** `open()` announced twice before `start()`;
      // `start()` announces `registering` synchronously; the inert default source
      // rejects asynchronously and that lands as `failed`/`noTransport` with no
      // `error` property; the flushed open request drains once and the epoch it
      // adopts moves `watchState()`. Through all of it the selection is the very
      // object it was, and no command beyond the one scripted drain is reached.
      expectDrains([0]);
      const commands = scriptedCommands({ drains: [reconciliationBatch()] });
      const state = await withTheSecondSnippetSelected(commands);
      const held = state.selectedMatch;
      expect(held).not.toBeNull();
      const opened = state.reconciliationRevision();
      expect(opened).toBeGreaterThan(0);
      expect(state.reconciliationRegistration()).toEqual({ kind: 'idle' });
      expect(state.reconciliationWatchState()).toEqual({ kind: 'notObserved' });

      state.start();
      const registering = state.reconciliationRevision();
      expect(registering).toBeGreaterThan(opened);
      expect(state.reconciliationRegistration()).toEqual({ kind: 'registering' });
      expect(state.selectedMatch).toBe(held);

      await settleDrains();
      const settled = state.reconciliationRevision();
      expect(settled).toBeGreaterThan(registering);
      const registration = state.reconciliationRegistration();
      expect(registration).toEqual({ kind: 'failed', reason: 'noTransport' });
      expect('error' in registration).toBe(false);
      expect(Object.isFrozen(registration)).toBe(true);
      expect(state.reconciliationWatchState()).toEqual({ kind: 'watching', epoch: 5 });
      expect(state.reconciliationBlock()).toEqual({ kind: 'running' });
      expect(state.membershipReloadWanted()).toBe(false);
      expect(state.selectedMatch).toBe(held);

      state.dispose();
      expect(state.reconciliationRevision()).toBeGreaterThan(settled);
      expect(state.selectedMatch).toBe(held);
      expect(state.scopedDocument?.revision).toBe(baseDocument().revision);
      expect(commands.reloadDocument).not.toHaveBeenCalled();
      expectNoSaveCommand(commands);
      expect(invoked).not.toHaveBeenCalled();
    }); // End of the "one revision" case

    it('classifies a transport that refuses as rejected, whatever it threw', async () => {
      // The other code, and the shape of the sanitizing: an `Error` that is not
      // the inert source's, and a thrown string, both cross as `rejected` and
      // nothing of what was thrown crosses with them. No open, so no drain.
      for (const thrown of [new Error('the backend refused to record the listener'), 'refused']) {
        const state = createBrowserState(
          scriptedCommands(),
          () => undefined,
          undefined,
          rejectingEvents(thrown)
        );
        state.start();
        const registering = state.reconciliationRevision();
        await settleDrains();
        expect(state.reconciliationRevision()).toBeGreaterThan(registering);
        const registration = state.reconciliationRegistration();
        expect(registration).toEqual({ kind: 'failed', reason: 'rejected' });
        expect(Object.keys(registration)).toEqual(['kind', 'reason']);
        state.dispose();
      } // End of the loop over the two thrown values
      expect(invoked).not.toHaveBeenCalled();
    }); // End of the "rejected" case

    it('exposes notWatched for an epoch of zero, and registered for a transport that resolved', async () => {
      expectDrains([0]);
      const events = testEvents();
      const state = createBrowserState(
        scriptedCommands({ drains: [reconciliationBatch({ epoch: 0 })] }),
        () => undefined,
        undefined,
        events.source
      );
      state.start();
      await settleDrains();

      expect(state.reconciliationRegistration()).toEqual({ kind: 'registered' });
      expect(state.reconciliationWatchState()).toEqual({ kind: 'notWatched' });
      state.dispose();
      expect(events.unlistens()).toBe(1);
      expect(invoked).not.toHaveBeenCalled();
    }); // End of the "notWatched" case

    it('refuses a membership refresh while a surface is open, permits once the last closes without triggering, then re-runs the retained request', async () => {
      // **Entry 29, the membership intent.** Three drains and no more: the
      // registration's, the first open's, and the one the reload's own `open()`
      // requests at `ready` — which is the one command the request is expected
      // to reach. Nothing asked for a membership reload here, and the request is
      // permitted regardless (§2 of the phase notes).
      expectDrains([0, 0, 0]);
      const events = testEvents();
      const commands = scriptedCommands({
        drains: [reconciliationBatch(), reconciliationBatch(), reconciliationBatch()]
      });
      const state = createBrowserState(commands, () => undefined, undefined, events.source);
      state.start();
      await settleDrains();
      await state.open('/tmp/espanso');
      await settleDrains();
      expect(commands.openWorkspace).toHaveBeenCalledTimes(1);
      expect(state.membershipReloadWanted()).toBe(false);

      const editor = state.registerWriteSurface(
        { kind: 'matchEditor', target: { kind: 'document', document: 2 } },
        () => undefined
      );
      const creator = state.registerWriteSurface(
        { kind: 'matchCreator', target: { kind: 'unknown' } },
        () => undefined
      );
      expect(state.requestMembershipReload()).toEqual({
        kind: 'refused',
        reason: 'surfaceOpen',
        surfaces: ['matchEditor', 'matchCreator']
      });
      editor();
      expect(state.requestMembershipReload()).toEqual({
        kind: 'refused',
        reason: 'surfaceOpen',
        surfaces: ['matchCreator']
      });
      expect(commands.openWorkspace).toHaveBeenCalledTimes(1);

      // **Closing the last one permits and does not trigger**: nothing observes
      // the registry emptying, and a settled queue shows no open was started.
      creator();
      await settleDrains();
      expect(commands.openWorkspace).toHaveBeenCalledTimes(1);
      expect(state.status).toBe('ready');

      expect(state.requestMembershipReload()).toEqual({ kind: 'reloading' });
      expect(commands.openWorkspace).toHaveBeenCalledTimes(2);
      expect(commands.openWorkspace).toHaveBeenNthCalledWith(2, '/tmp/espanso');
      expect(state.status).toBe('loading');
      await settleDrains();
      await settleDrains();
      expect(state.status).toBe('ready');
      expect(state.documents.map((document) => document.id)).toEqual([1, 2, 3]);
      expect(drainSequences).toEqual([0, 0, 0]);
      expectNoSaveCommand(commands);
      expect(invoked).not.toHaveBeenCalled();
      state.dispose();
    }); // End of the "membership refresh" case

    it('re-runs null when null was the request, and clears the wanted flag by reopening', async () => {
      // `open(null)` means *discover the root*, and the retained request is that
      // `null` — never the summary's rendered root. The observation batch raises
      // the membership request; the reopen is what clears it.
      expectDrains([0, 0, 0]);
      const events = testEvents();
      const commands = scriptedCommands({
        drains: [
          reconciliationBatch(),
          reconciliationBatch({
            newest_sequence: 3,
            observations: [
              {
                Removed: {
                  sequence: 3,
                  document: { Unnamed: { relative_path: 'match/stranger.yml' } },
                  previous_revision: null
                }
              }
            ]
          }),
          reconciliationBatch()
        ]
      });
      const state = createBrowserState(commands, () => undefined, undefined, events.source);
      state.start();
      await settleDrains();
      await state.open(null);
      await settleDrains();
      expect(state.membershipReloadWanted()).toBe(true);
      expect(state.summary?.root).toBe('/tmp/espanso');

      expect(state.requestMembershipReload()).toEqual({ kind: 'reloading' });

      expect(commands.openWorkspace).toHaveBeenCalledTimes(2);
      expect(commands.openWorkspace).toHaveBeenNthCalledWith(2, null);
      expect(state.membershipReloadWanted()).toBe(false);
      await settleDrains();
      await settleDrains();
      expect(state.status).toBe('ready');
      expectNoSaveCommand(commands);
      expect(invoked).not.toHaveBeenCalled();
      state.dispose();
    }); // End of the "null request" case

    it('refuses both requests during an in-flight write, naming the file, and permits once it settles', async () => {
      // No `start()`, so no drain at all: the reopen's own request is remembered
      // and never issued, and the budget is empty.
      const held = heldRawSave(
        { ok: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } },
        null
      );
      const state = await withTheSecondSnippetSelected(held.commands);
      const sending = state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);

      expect(state.requestMembershipReload()).toEqual({
        kind: 'refused',
        reason: 'writeInFlight',
        documents: [2]
      });
      // The lost-history intent asks its own question before the barrier, and a
      // `running` session answers it first.
      expect(state.requestLostHistoryRecovery()).toEqual({ kind: 'refused', reason: 'notBlocked' });
      expect(held.commands.openWorkspace).toHaveBeenCalledTimes(1);

      held.release();
      await sending;
      expect(state.writeInFlight(2)).toBe(false);
      expect(state.requestMembershipReload()).toEqual({ kind: 'reloading' });
      expect(held.commands.openWorkspace).toHaveBeenCalledTimes(2);
      expect(held.commands.openWorkspace).toHaveBeenNthCalledWith(2, null);
      await settleDrains();
      await settleDrains();
      expect(state.status).toBe('ready');
      expect(invoked).not.toHaveBeenCalled();
    }); // End of the "write in flight" case

    it('refuses while an open is loading, after an open that failed, and after disposal', async () => {
      // **Lifecycle and disposal, at execution.** The gate is closed from an
      // `open()`'s first statements until one reaches `ready`; a refused
      // `open_workspace` leaves it closed, and the reason says *not ready* rather
      // than claiming which of the two it is. After `dispose()` both intents
      // answer `disposed` first, ahead of every other question.
      const gate = deferred<CommandResult<WorkspaceSummary>>();
      const scripted = scriptedCommands();
      const commands: BrowserCommands = {
        ...scripted,
        openWorkspace: vi.fn(() => gate.promise)
      };
      const state = createBrowserState(commands, () => undefined);
      const opening = state.open('/tmp/espanso');
      expect(state.requestMembershipReload()).toEqual({ kind: 'refused', reason: 'workspaceNotReady' });
      expect(state.requestLostHistoryRecovery()).toEqual({
        kind: 'refused',
        reason: 'workspaceNotReady'
      });
      gate.resolve({ ok: true, value: SUMMARY });
      await opening;
      expect(state.status).toBe('ready');
      expect(commands.openWorkspace).toHaveBeenCalledTimes(1);

      const failing = createBrowserState(
        scriptedCommands({
          open: { ok: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } }
        }),
        () => undefined
      );
      await failing.open(null);
      expect(failing.status).toBe('failed');
      expect(failing.requestMembershipReload()).toEqual({
        kind: 'refused',
        reason: 'workspaceNotReady'
      });

      state.dispose();
      expect(state.requestMembershipReload()).toEqual({ kind: 'refused', reason: 'disposed' });
      expect(state.requestLostHistoryRecovery()).toEqual({ kind: 'refused', reason: 'disposed' });
      expect(commands.openWorkspace).toHaveBeenCalledTimes(1);
      expect(invoked).not.toHaveBeenCalled();
    }); // End of the "lifecycle and disposal" case

    it('refuses a lost-history recovery while a surface is open, permits once it closes without triggering, and recovers on the explicit ask', async () => {
      // **Entry 29, the lost-history intent, over ruling 12's blocked state.** The
      // surface is open when the `discarded` rise arrives, so the batch-driven
      // recovery declines and the session blocks; closing the surface permits the
      // person's request and starts nothing; the request re-runs the retained
      // request, resets the block, and the reopen's drain adopts the new epoch.
      expectDrains([0, 0, 0]);
      const events = testEvents();
      const commands = scriptedCommands({
        drains: [
          reconciliationBatch(),
          reconciliationBatch({ newest_sequence: 9, discarded: 1 }),
          reconciliationBatch({ epoch: 6 })
        ]
      });
      const state = createBrowserState(commands, () => undefined, undefined, events.source);
      state.start();
      await settleDrains();
      expect(state.requestLostHistoryRecovery()).toEqual({ kind: 'refused', reason: 'notBlocked' });

      const lease = state.registerWriteSurface(
        { kind: 'matchDuplicator', target: { kind: 'document', document: 3 } },
        () => undefined
      );
      await state.open('/tmp/espanso');
      await settleDrains();
      expect(state.reconciliationBlock()).toEqual({
        kind: 'blockedByLostHistory',
        discarded: 1,
        epoch: 5
      });
      expect(state.requestLostHistoryRecovery()).toEqual({
        kind: 'refused',
        reason: 'surfaceOpen',
        surfaces: ['matchDuplicator']
      });
      expect(commands.openWorkspace).toHaveBeenCalledTimes(1);

      lease();
      await settleDrains();
      expect(commands.openWorkspace).toHaveBeenCalledTimes(1);
      expect(state.reconciliationBlock().kind).toBe('blockedByLostHistory');

      expect(state.requestLostHistoryRecovery()).toEqual({ kind: 'reloading' });
      expect(commands.openWorkspace).toHaveBeenCalledTimes(2);
      expect(commands.openWorkspace).toHaveBeenNthCalledWith(2, '/tmp/espanso');
      expect(state.reconciliationBlock()).toEqual({ kind: 'running' });
      await settleDrains();
      await settleDrains();
      expect(state.status).toBe('ready');
      expect(state.reconciliationWatchState()).toEqual({ kind: 'watching', epoch: 6 });
      expect(state.requestLostHistoryRecovery()).toEqual({ kind: 'refused', reason: 'notBlocked' });
      expect(drainSequences).toEqual([0, 0, 0]);
      expectNoSaveCommand(commands);
      expect(invoked).not.toHaveBeenCalled();
      state.dispose();
    }); // End of the "lost-history recovery" case

    it('refuses the reread at the request under each of the three per-file holds, sending nothing', async () => {
      // **Entry 32's first half, one input at a time.** The uncertainty hold with
      // no surface and no write out; a retained observation, held while a write is
      // out and named ahead of the barrier because it is the stronger claim; and a
      // registered surface over the file. Each answers at the request, and
      // `reload_document` is never sent.
      const uncertain = await underTheUncertaintyHold();
      expect(uncertain.state.automaticReloadGuardFor(2)).toEqual({
        uncertaintyUnresolved: true,
        observationRetained: false,
        surfaceOpen: false
      });
      expect(await uncertain.state.requestFileReread(2)).toEqual({
        kind: 'refused',
        reason: 'uncertaintyUnresolved',
        at: 'request'
      });
      expect(uncertain.commands.reloadDocument).not.toHaveBeenCalled();

      const held = heldRawSave(
        { ok: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } },
        null
      );
      const retaining = await withTheSecondSnippetSelected(held.commands);
      const sending = retaining.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
      retaining.observeExternalChange(externalObservation());
      expect(retaining.automaticReloadGuardFor(2).observationRetained).toBe(true);
      expect(await retaining.requestFileReread(2)).toEqual({
        kind: 'refused',
        reason: 'observationRetained',
        at: 'request'
      });
      held.release();
      await sending;
      expect(held.commands.reloadDocument).not.toHaveBeenCalled();

      const commands = scriptedCommands();
      const covered = await withTheSecondSnippetSelected(commands);
      const surface = covered.registerWriteSurface(
        { kind: 'matchDeleter', target: { kind: 'document', document: 2 } },
        () => undefined
      );
      expect(await covered.requestFileReread(2)).toEqual({
        kind: 'refused',
        reason: 'surfaceOpen',
        at: 'request'
      });
      // The other file shares no hold, and a surface over one file is not a
      // surface over the other.
      expect(await covered.requestFileReread(3)).toEqual({ kind: 'completed' });
      surface();
      expect(commands.reloadDocument).toHaveBeenCalledTimes(1);
      expect(commands.reloadDocument).toHaveBeenCalledWith(3);
      expect(invoked).not.toHaveBeenCalled();
    }); // End of the "three holds at the request" case

    it('refuses the reread at the request for a write in flight, an invented row, an unknown file, a blocked session and a loading workspace', async () => {
      // The other five guards, each at the request. The write barrier is asked
      // last, so it answers only when no hold does — here nothing is retained
      // because no observation arrived while the write was out.
      const held = heldRawSave(
        { ok: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } },
        null
      );
      const writing = await withTheSecondSnippetSelected(held.commands);
      const sending = writing.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
      expect(await writing.requestFileReread(2)).toEqual({
        kind: 'refused',
        reason: 'writeInFlight',
        at: 'request'
      });
      expect(await writing.requestFileReread(99)).toEqual({
        kind: 'refused',
        reason: 'notAddressable',
        at: 'request'
      });
      held.release();
      await sending;
      expect(held.commands.reloadDocument).not.toHaveBeenCalled();

      // A blocked session, and a row an addition invented, on one lifecycle: the
      // surface makes the `discarded` rise block rather than recover, and the
      // `Added` observation in the same batch is dropped with the rest — so the
      // invented row comes from a batch drained *before* the loss.
      expectDrains([0, 0, 6]);
      const events = testEvents();
      const commands = scriptedCommands({
        drains: [
          reconciliationBatch(),
          reconciliationBatch({
            newest_sequence: 6,
            observations: [
              {
                Added: {
                  sequence: 6,
                  document_summary: makeSummary({ id: 42, relativePath: 'match/new.yml' }),
                  content: {
                    Projected: {
                      disk: makeDocument({ id: 42, relativePath: 'match/new.yml' }),
                      findings: []
                    }
                  }
                }
              }
            ]
          }),
          reconciliationBatch({ newest_sequence: 9, discarded: 1 })
        ]
      });
      const state = createBrowserState(commands, () => undefined, undefined, events.source);
      state.start();
      await settleDrains();
      await state.open(null);
      await settleDrains();
      expect(state.documents.map((document) => document.id)).toEqual([1, 2, 3, 42]);
      expect(await state.requestFileReread(42)).toEqual({
        kind: 'refused',
        reason: 'notAddressable',
        at: 'request'
      });

      const lease = state.registerWriteSurface(
        { kind: 'matchEditor', target: { kind: 'document', document: 3 } },
        () => undefined
      );
      events.wake(5, 9);
      await settleDrains();
      await settleDrains();
      expect(state.reconciliationBlock().kind).toBe('blockedByLostHistory');
      expect(await state.requestFileReread(2)).toEqual({
        kind: 'refused',
        reason: 'blockedByLostHistory',
        at: 'request'
      });
      lease();

      // A loading workspace: the request's own `open()` closes the gate.
      const loading = createBrowserState(scriptedCommands(), () => undefined);
      const opening = loading.open(null);
      expect(await loading.requestFileReread(2)).toEqual({
        kind: 'refused',
        reason: 'workspaceNotReady',
        at: 'request'
      });
      await opening;

      state.dispose();
      expect(await state.requestFileReread(2)).toEqual({
        kind: 'refused',
        reason: 'disposed',
        at: 'request'
      });
      expect(commands.reloadDocument).not.toHaveBeenCalled();
      expectNoSaveCommand(commands);
      expect(invoked).not.toHaveBeenCalled();
    }); // End of the "other five guards at the request" case

    it('re-asks every guard immediately before installing, so one that moved while the read was out refuses the installation', async () => {
      // **Entry 32's second half.** Four reads, each permitted at the request and
      // each answered after the window moved in a way that moves none of
      // `rereadUnderGuard`'s own captures — so only the re-asked guard can refuse:
      // a surface opened over the file; an observation retained behind a write
      // that is still out; a bare write in flight; and a disposal. Each refuses at
      // the installation with the guard that moved, and the projection is the
      // object it was — nothing installed, nothing cleared. (An uncertainty that
      // *settles* while a read is out is not driven here: the wrapper's own
      // re-read supersedes the pending read first, and that answer is discarded
      // as no longer wanted, which `completed` truthfully reports.)
      const held = heldReloads();
      const gates: { promise: Promise<void>; resolve: (value: void) => void }[] = [];
      const commands: BrowserCommands = {
        ...held.commands,
        saveRawDocument: vi.fn(async (): Promise<RawSaveOutcome> => {
          const gate = deferred<void>();
          gates.push(gate);
          await gate.promise;
          return { ok: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } };
        })
      };
      const state = await withTheSecondSnippetSelected(commands);
      const projection = state.scopedDocument;
      expect(projection).not.toBeNull();

      const first = state.requestFileReread(2);
      expect(commands.reloadDocument).toHaveBeenCalledTimes(1);
      const surface = state.registerWriteSurface(
        { kind: 'matchEditor', target: { kind: 'document', document: 2 } },
        () => undefined
      );
      held.release();
      expect(await first).toEqual({ kind: 'refused', reason: 'surfaceOpen', at: 'installation' });
      expect(state.scopedDocument).toBe(projection);
      surface();

      const second = state.requestFileReread(2);
      expect(commands.reloadDocument).toHaveBeenCalledTimes(2);
      const firstWrite = state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
      expect(state.observeExternalChange(externalObservation()).verdict.kind).toBe('retained');
      held.release();
      expect(await second).toEqual({
        kind: 'refused',
        reason: 'observationRetained',
        at: 'installation'
      });
      expect(state.scopedDocument).toBe(projection);
      gates[0]?.resolve();
      await firstWrite;
      expect(state.retainedObservationFor(2)).toBeNull();

      const third = state.requestFileReread(2);
      expect(commands.reloadDocument).toHaveBeenCalledTimes(3);
      const secondWrite = state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
      held.release();
      expect(await third).toEqual({ kind: 'refused', reason: 'writeInFlight', at: 'installation' });
      expect(state.scopedDocument).toBe(projection);
      gates[1]?.resolve();
      await secondWrite;

      // The third file is under no hold, so the same flip on it is disposal.
      const fourth = state.requestFileReread(3);
      expect(commands.reloadDocument).toHaveBeenCalledTimes(4);
      state.dispose();
      held.release();
      expect(await fourth).toEqual({ kind: 'refused', reason: 'disposed', at: 'installation' });
      expect(state.views.find((view) => view.id === 3)?.matches.map((match) => match.id.node)).toEqual([
        20
      ]);
      expect(invoked).not.toHaveBeenCalled();
    }); // End of the "re-asked at the installation" case

    it('completes a stale file whose surface has closed, clears the mark, and leaves the automatic path to a fresh observation', async () => {
      // **Ruling 32's scenario, end to end.** A change arrives while a surface is
      // open over the file: the surface is told, the file is marked `stale`, and
      // nothing is reread. The surface closes — closure triggers nothing. The
      // explicit request rereads, installs the disk projection, and clears the
      // mark. Then a fresh accepted observation with no surface open takes the
      // automatic clean path exactly as before this phase.
      expectDrains([0, 0, 5]);
      const events = testEvents();
      const told: number[] = [];
      const commands = scriptedCommands({
        reload: { ok: true, value: rereadBaseDocument() },
        drains: [
          reconciliationBatch(),
          reconciliationBatch({
            newest_sequence: 5,
            observations: [changedObservation(5, addressable(2, 'match/base.yml'))]
          }),
          reconciliationBatch({
            newest_sequence: 6,
            observations: [changedObservation(6, addressable(2, 'match/base.yml'))]
          })
        ]
      });
      const state = createBrowserState(commands, () => undefined, undefined, events.source);
      state.start();
      await settleDrains();
      const lease = state.registerWriteSurface(
        { kind: 'matchEditor', target: { kind: 'document', document: 2 } },
        (observation) => {
          told.push(observation.sequence);
        }
      );
      await state.open(null);
      await settleDrains();
      await settleDrains();
      state.show({ kind: 'document', id: 2 });
      expect(told).toEqual([5]);
      expect(state.externalDocumentStatus(2)).toEqual({ kind: 'stale' });
      expect(commands.reloadDocument).not.toHaveBeenCalled();
      expect(await state.requestFileReread(2)).toEqual({
        kind: 'refused',
        reason: 'surfaceOpen',
        at: 'request'
      });

      lease();
      await settleDrains();
      expect(commands.reloadDocument).not.toHaveBeenCalled();
      expect(state.externalDocumentStatus(2)).toEqual({ kind: 'stale' });

      expect(await state.requestFileReread(2)).toEqual({ kind: 'completed' });
      expect(commands.reloadDocument).toHaveBeenCalledTimes(1);
      expect(state.scopedMatches.map((match) => match.id.node)).toEqual([77]);
      expect(state.externalDocumentStatus(2)).toBeNull();

      events.wake(5, 6);
      await settleDrains();
      await settleDrains();
      expect(commands.reloadDocument).toHaveBeenCalledTimes(2);
      expect(told).toEqual([5]);
      expectNoSaveCommand(commands);
      expect(invoked).not.toHaveBeenCalled();
      state.dispose();
    }); // End of the "stale after close" case

    it('reads no command-built key inside the installation guard, so a key’s own getter cannot open a surface under it', async () => {
      // **The phase review's blocker, re-derived.** `creatorEligibilityFor` reads
      // `view.top_level_keys[i].text` through `destinationEligibility`, and before
      // the ingress copy owned those keys that read was of the command's own
      // object — run inside `fileRereadRefusal`, *after* the registry list and the
      // two hold tables had been read. A getter there that registered a surface
      // over the file was invisible to the guard it ran inside: the answer was
      // installed under a surface that had just opened. Now the key is copied at
      // ingress, the getter fires exactly once — in `open()`, before any guard —
      // and never again, so nothing it could do is reachable from a guard.
      let reads = 0;
      let armed = false;
      let firedInsideTheGuard = false;
      let state: BrowserState | null = null;
      const projection = makeDocument({
        id: 2,
        relativePath: 'match/base.yml',
        matches: [
          makeMatch({ node: 10, document: 2, trigger: ':sig', label: 'Signature' }),
          makeMatch({ node: 11, document: 2, trigger: ':date', label: 'Today' })
        ]
      });
      const trap: DocumentView = {
        ...projection,
        top_level_keys: [
          {
            ...projection.top_level_keys[0]!,
            get text(): string {
              reads += 1;
              if (armed && !firedInsideTheGuard) {
                firedInsideTheGuard = true;
                state?.registerWriteSurface(
                  { kind: 'matchEditor', target: { kind: 'document', document: 2 } },
                  () => undefined
                );
              }
              return 'matches';
            }
          }
        ]
      };
      const held = heldReloads({
        documents: new Map<number, CommandResult<DocumentView>>([
          [1, { ok: true, value: profileDocument() }],
          [2, { ok: true, value: trap }],
          [3, { ok: true, value: otherDocument() }]
        ])
      });
      state = createBrowserState(held.commands, () => undefined);
      await state.open(null);
      state.show({ kind: 'document', id: 2 });
      const atIngress = reads;

      const reading = state.requestFileReread(2);
      expect(held.commands.reloadDocument).toHaveBeenCalledTimes(1);
      armed = true;
      held.release();
      const outcome = await reading;

      // **No surface exists, and the read installed legitimately** — before the
      // fix this line read `expected [ [ 'matchEditor' ], …(2) ] to deeply equal
      // [ [], { kind: 'completed' }, [ 77 ] ]`: an editor open over the file and
      // node 77 installed under it. And **no guard read the command's key**: the
      // count did not move across the request and the installation (before the
      // fix, `expected 2 to be +0` — the request guard and the installation guard),
      // and the trap never fired.
      expect([
        state.openWriteSurfaces().map((surface) => surface.kind),
        outcome,
        state.scopedMatches.map((match) => match.id.node)
      ]).toEqual([[], { kind: 'completed' }, [77]]);
      expect(reads).toBe(atIngress);
      expect(firedInsideTheGuard).toBe(false);
      // The control: the trap is live, and ingress is where it fired — while
      // `open()` copied the projection, before any guard existed.
      expect(atIngress).toBeGreaterThan(0);
      expect(invoked).not.toHaveBeenCalled();
    }); // End of the "key getter inside the guard" case

    it('answers a read the command refused as failed, reported, with nothing installed', async () => {
      const failure: IpcFailure = { kind: 'command', error: { code: 'noWorkspaceOpen' } };
      const reported: IpcFailure[] = [];
      const commands = scriptedCommands({ reload: { ok: false, failure } });
      const state = createBrowserState(commands, (refusal) => {
        reported.push(refusal);
      });
      await state.open(null);
      state.show({ kind: 'document', id: 2 });

      expect(await state.requestFileReread(2)).toEqual({ kind: 'failed', failure });
      expect(reported).toEqual([failure]);
      expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11]);
      expect(invoked).not.toHaveBeenCalled();
    }); // End of the "failed read" case
  }); // End of the "coordinator and workspace members" suite

  describe('the match editor’s external session — Phase 2d-6-2', () => {
    // **The session's receiver fed by a real window.** Every envelope here is one
    // `observeExternalChange`, a settlement or a retry sealed and delivered; the
    // session applies it through `applyObservation` in `./matchEditor.ts` and asks
    // the window's own doors — `adoptDiskVersion`, `standingConflictFor`, the two
    // acknowledgement members. No component registers anything (2d-6-6's), and the
    // route guard holds the command spy at zero through every transition.

    /** The snippet every session here edits: the second of `match/base.yml`. */
    const EDITED: MatchView = baseDocument().matches[1]!;

    /**
     * A session over that snippet with `replace` drafted, registered as a receiver
     * over its file, so that every delivery lands on the session the case reads.
     *
     * @param state - The window.
     * @returns The live session, a reader of it, and the unregister.
     */
    function editorOver(state: BrowserState): {
      readonly current: () => MatchEditorSession;
      readonly set: (next: MatchEditorSession) => void;
      readonly off: () => void;
    } {
      let session = editField(startMatchEditor(EDITED, () => 0), 'replace', 'mine');
      const off = state.registerObservationReceiver(2, (delivery) => {
        session = applyObservation(session, delivery);
      });
      return {
        current: () => session,
        set: (next) => {
          session = next;
        },
        off
      };
    } // End of function editorOver()

    /**
     * The window's two acknowledgement members, composed as the editor's callback.
     *
     * @param state - The window.
     * @returns The callback `acknowledgeSnapshot` takes.
     */
    function acknowledgingThrough(state: BrowserState): AcknowledgeTheUncertainty {
      return (source) => {
        const acknowledgement = state.uncertaintyAcknowledgementFor(source);
        return acknowledgement === null
          ? 'refused'
          : state.acknowledgeWriteUncertainty(acknowledgement).kind;
      };
    } // End of function acknowledgingThrough()

    /**
     * An observation of `match/base.yml` carrying a correspondence table whose one
     * row is about the edited snippet, resolved to a snippet of the disk projection.
     *
     * @param editor - What the editor tier answered for the row.
     * @param disk - The disk projection, holding the target when there is one.
     * @returns The observation, over the two revisions the window holds.
     */
    function observedWithTable(
      editor: ReapplyResolution,
      disk: DocumentView
    ): ExternalConflictObservation {
      return {
        ...externalObservation(),
        disk,
        correspondences: {
          base_revision: 'rev-a',
          disk_revision: 'rev-c',
          entries: [{ base: EDITED.id, exact: { Unsupported: {} }, editor }]
        }
      };
    } // End of function observedWithTable()

    /** The edited snippet as the disk holds it after another writer's change. */
    function diskTwin(): MatchView {
      return makeMatch({ node: 41, document: 2, revision: 'rev-c', trigger: ':date', label: 'Today' });
    } // End of function diskTwin()

    it('raises through a registered receiver, refuses the save, and moves nothing', async () => {
      const commands = scriptedCommands();
      const state = await withTheSecondSnippetSelected(commands);
      const revision = state.reconciliationRevision();
      const reads = (commands.getDocument as ReturnType<typeof vi.fn>).mock.calls.length;
      const editor = editorOver(state);
      expect(canSave(editor.current())).toBe(true);

      const seen = externalObservation();
      const answered = state.observeExternalChange(seen);
      const session = editor.current();
      expect(answered.verdict.kind).toBe('raised');
      // The session shows the origin the window registered — the same object — and
      // its own draft, retained.
      expect(session.externalConflict?.source).toBe(state.standingConflictFor(2));
      expect(session.draft.value.replace.text).toBe('mine');
      expect(canSave(session)).toBe(false);
      expect(beginSave(session, () => session)).toBeNull();
      expect(matchEditorView(session).externalMessages[0]).toEqual({ kind: 'fileChangedWhileOpen' });
      // Nothing moved: no read, no reload, no coordinator transition, no command.
      expect(state.scopedDocument?.revision).toBe('rev-a');
      expect(commands.getDocument).toHaveBeenCalledTimes(reads);
      expect(commands.saveMatch).not.toHaveBeenCalled();
      expect(state.reconciliationRevision()).toBe(revision);
      expect(invoked).not.toHaveBeenCalled();
      editor.off();
    }); // End of the "raised through the receiver" case

    it('resolves the conflict through the real door: installed, alreadyThere and refused', async () => {
      // **Installed**: the editor's two-step reload adopts and closes.
      const installing = await withTheSecondSnippetSelected(scriptedCommands());
      const first = editorOver(installing);
      installing.observeExternalChange(externalObservation());
      const closed = ((onHand) => reloadTheDiskVersion(onHand, installing.adoptDiskVersion, () => onHand))(confirmDiskReload(askToReloadDiskVersion(first.current())));
      expect(closed.closed).toBe(true);
      expect(closed.externalConflict).toBeNull();
      expect(installing.scopedDocument?.revision).toBe('rev-c');
      first.off();

      // **Already there**: another surface's confirmation adopted the same
      // observation first, so the window holds the bytes and the editor's own
      // confirmed reload is satisfied without a second installation.
      const satisfied = await withTheSecondSnippetSelected(scriptedCommands());
      const second = editorOver(satisfied);
      const seen = externalObservation();
      satisfied.observeExternalChange(seen);
      const elsewhere = externalModelOf(seen);
      expect(satisfied.adoptDiskVersion(elsewhere, confirmReloadDiskVersion(elsewhere))).toBe('installed');
      const before = satisfied.scopedDocument;
      const alsoClosed = ((onHand) => reloadTheDiskVersion(onHand, satisfied.adoptDiskVersion, () => onHand))(confirmDiskReload(askToReloadDiskVersion(second.current())));
      expect(alsoClosed.closed).toBe(true);
      // Nothing was installed a second time: the projection is the object it was.
      expect(satisfied.scopedDocument).toBe(before);
      expect(satisfied.scopedDocument?.revision).toBe('rev-c');
      second.off();

      // **Refused**: a strictly later reading superseded the origin at the window
      // while this session was no longer listening, so the door refuses the
      // outlived confirmation, the panel says so, and nothing closes or moves.
      const refusing = await withTheSecondSnippetSelected(scriptedCommands());
      const third = editorOver(refusing);
      refusing.observeExternalChange(externalObservation());
      third.off();
      refusing.observeExternalChange({
        ...externalObservation(),
        sequence: 6,
        diskRevision: 'rev-d',
        disk: makeDocument({ id: 2, relativePath: 'match/base.yml', revision: 'rev-d' })
      });
      const stuck = ((onHand) => reloadTheDiskVersion(onHand, refusing.adoptDiskVersion, () => onHand))(confirmDiskReload(askToReloadDiskVersion(third.current())));
      expect(stuck.closed).toBe(false);
      expect(matchEditorView(stuck).reloadUnavailable).toBe(true);
      expect(stuck.externalConflict).toBe(third.current().externalConflict);
      expect(refusing.scopedDocument?.revision).toBe('rev-a');
      expect(invoked).not.toHaveBeenCalled();
    }); // End of the "three adoption outcomes" case

    it('reapplies over the observation’s table by full identity, through the live guard and the real door', async () => {
      const disk = makeDocument({
        id: 2,
        relativePath: 'match/base.yml',
        revision: 'rev-c',
        matches: [diskTwin()]
      });
      const state = await withTheSecondSnippetSelected(scriptedCommands());
      const editor = editorOver(state);
      state.observeExternalChange(observedWithTable({ Identified: { target: diskTwin() } }, disk));
      const stuck = editor.current();
      expect(stuck.externalConflict).not.toBeNull();

      const answer = reapplyEditorToDiskVersion(stuck, state.adoptDiskVersion, () =>
        state.standingConflictFor(2), () => stuck
      );
      expect(answer.kind).toBe('reapplied');
      if (answer.kind !== 'reapplied') {
        throw new Error('this case is about the rebuilt session');
      }
      expect(answer.session.match).toEqual(diskTwin().id);
      expect(answer.session.draft.value.replace.text).toBe('mine');
      expect(canSave(answer.session)).toBe(true);
      // The window moved to the observation's snapshot, once, through the door.
      expect(state.scopedDocument?.revision).toBe('rev-c');
      expect(state.scopedMatches.map((match) => match.id.node)).toEqual([41]);
      expect(invoked).not.toHaveBeenCalled();
      editor.off();

      // **Superseded through the guard**: the same conflict, after a later reading
      // took the standing place, is refused before any evidence is read and nothing
      // is adopted.
      const later = await withTheSecondSnippetSelected(scriptedCommands());
      const listening = editorOver(later);
      later.observeExternalChange(observedWithTable({ Identified: { target: diskTwin() } }, disk));
      listening.off();
      later.observeExternalChange({
        ...externalObservation(),
        sequence: 6,
        diskRevision: 'rev-d',
        disk: makeDocument({ id: 2, relativePath: 'match/base.yml', revision: 'rev-d' })
      });
      expect(
        ((onHand) => reapplyEditorToDiskVersion(onHand, later.adoptDiskVersion, () =>
          later.standingConflictFor(2), () => onHand
        ))(listening.current())
      ).toEqual({ kind: 'manualResolution', obstacle: { kind: 'supersededEvidence' } });
      expect(later.scopedDocument?.revision).toBe('rev-a');
      expect(invoked).not.toHaveBeenCalled();
    }); // End of the "reapply through the live guard" case

    /**
     * A later reading of `match/base.yml`, and a disk projection whose `id`, once
     * armed, starts another surface's held raw save and tells the window of that
     * reading — which the barrier retains — while the adoption reads it.
     *
     * @param state - The window, built over `heldRawSave`'s commands.
     * @param plain - The projection the observation carries.
     * @returns The trapped projection, the later reading, the arming switch and
     *   the send to await once released.
     */
    function retainingDuringAdoption(
      state: BrowserState,
      plain: DocumentView
    ): {
      readonly disk: DocumentView;
      readonly later: ExternalConflictObservation;
      readonly arm: () => void;
      readonly sending: () => Promise<unknown> | null;
    } {
      let armed = false;
      let sending: Promise<unknown> | null = null;
      const later: ExternalConflictObservation = {
        ...externalObservation(),
        sequence: 6,
        diskRevision: 'rev-d',
        disk: makeDocument({ id: 2, relativePath: 'match/base.yml', revision: 'rev-d' })
      };
      const disk: DocumentView = {
        ...plain,
        get id(): DocumentId {
          if (armed) {
            armed = false;
            sending = state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
            expect(state.observeExternalChange(later).verdict.kind).toBe('retained');
          }
          return plain.id;
        }
      };
      return {
        disk,
        later,
        arm: () => {
          armed = true;
        },
        sending: () => sending
      };
    } // End of function retainingDuringAdoption()

    it('carries a wait the window recorded during the reapply’s own adoption into the rebuilt session (2d-6-6a review, finding 1)', async () => {
      // **The reviewer's interleaving, through the real `adoptDiskVersion`.** The
      // reapply's recheck runs before the door; the door then reads the
      // observation's projection, a getter there starts another surface's write
      // and tells the window of a later reading, which the barrier retains and the
      // registered receiver records as a wait on the installed session. The
      // rebuilt session must carry that wait, so its ordinary *Save* stays refused.
      const held = heldRawSave({ ok: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } }, null);
      const state = await withTheSecondSnippetSelected(held.commands);
      const editor = editorOver(state);
      const trap = retainingDuringAdoption(
        state,
        makeDocument({ id: 2, relativePath: 'match/base.yml', revision: 'rev-c', matches: [diskTwin()] })
      );
      expect(
        state.observeExternalChange(observedWithTable({ Identified: { target: diskTwin() } }, trap.disk)).verdict.kind
      ).toBe('raised');
      const stuck = editor.current();
      const answer = reapplyEditorToDiskVersion(
        stuck,
        (conflict, confirmation) => {
          trap.arm();
          return state.adoptDiskVersion(conflict, confirmation);
        },
        () => state.standingConflictFor(2),
        editor.current
      );
      expect(trap.sending()).not.toBeNull();
      expect(editor.current().awaitingReconciliation).toBe(trap.later);
      expect(state.scopedDocument?.revision).toBe('rev-c');
      expect(answer.kind).toBe('reapplied');
      if (answer.kind === 'reapplied') {
        expect(answer.session.awaitingReconciliation).toBe(trap.later);
        expect(canSave(answer.session)).toBe(false);
      }
      held.release();
      await trap.sending();
      expect(invoked).not.toHaveBeenCalled();
      editor.off();
    }); // End of the "wait recorded during the editor reapply's adoption" case

    it('is told retained through the barrier and then the settlement’s verdict, blocking the save in between', async () => {
      // A raw save of the same file — another surface's write — is in flight, so
      // the observation is held; the editor is told so and may not send; the
      // settlement arbitrates the held reading and the editor is told that too.
      const held = heldRawSave(
        { ok: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } },
        null
      );
      const state = await withTheSecondSnippetSelected(held.commands);
      const editor = editorOver(state);
      const sending = state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
      const seen = externalObservation();
      state.observeExternalChange(seen);
      const waiting = editor.current();
      expect(waiting.awaitingReconciliation).toBe(seen);
      expect(waiting.externalConflict).toBeNull();
      expect(canSave(waiting)).toBe(false);
      expect(beginSave(waiting, () => waiting)).toBeNull();
      expect(matchEditorView(waiting).externalNotices).toEqual([{ kind: 'observationRetained' }]);
      // The window's guard says the same thing the session's notice does.
      expect(await state.requestFileReread(2)).toEqual({
        kind: 'refused',
        reason: 'observationRetained',
        at: 'request'
      });

      held.release();
      await sending;
      const decided = editor.current();
      expect(decided.awaitingReconciliation).toBeNull();
      expect(decided.externalConflict?.source).toBe(externalConflictSource(seen));
      expect(canSave(decided)).toBe(false);
      expect(invoked).not.toHaveBeenCalled();
      editor.off();

      // **`writtenHere`**: a held reading of exactly the bytes the commit ended on
      // lifts the wait and raises nothing.
      const committing = heldRawSave(
        {
          ok: true,
          value: { outcome: 'saved', revision: 'rev-c', committed: true, backup_taken: false, moved: null, notes: [] },
          reload: { kind: 'done' }
        },
        'rev-c'
      );
      const window = await withTheSecondSnippetSelected(committing.commands);
      const listening = editorOver(window);
      const writing = window.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
      const same = externalObservation();
      window.observeExternalChange(same);
      expect(listening.current().awaitingReconciliation).toBe(same);
      committing.release();
      await writing;
      const lifted = listening.current();
      expect(lifted.awaitingReconciliation).toBeNull();
      expect(lifted.externalConflict).toBeNull();
      expect(canSave(lifted)).toBe(true);
      expect(window.standingConflictFor(2)).toBeNull();
      expect(invoked).not.toHaveBeenCalled();
      listening.off();
    }); // End of the "retained then decided" case

    it('withholds the reload under the uncertainty hold and rebuilds it through the window’s acknowledgement', async () => {
      const commands = scriptedCommands({ raws: [WRITE_MAY_HAVE_HAPPENED] });
      const state = await withTheSecondSnippetSelected(commands);
      expect(await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED)).toEqual({
        kind: 'failed',
        mayHaveWritten: true
      });
      expect(state.writeOutcomeUncertain(2)).toBe(true);
      const editor = editorOver(state);
      expect(state.observeExternalChange(externalObservation()).verdict.kind).toBe('raisedWithoutReload');
      const withheld = editor.current();
      expect(withheld.uncertaintyUnresolved).toBe(true);
      expect(matchEditorView(withheld).conflictChoices).toEqual(['keepEditing', 'copyDraft']);
      expect(matchEditorView(withheld).externalNotices).toEqual([{ kind: 'writeOutcomeUnknown' }]);
      // The reapply refuses before it could obtain an adoption, and the window is
      // where it was.
      expect(
        reapplyEditorToDiskVersion(withheld, state.adoptDiskVersion, () => state.standingConflictFor(2), () => withheld)
      ).toEqual({ kind: 'manualResolution', obstacle: { kind: 'writeOutcomeUnknown' } });
      expect(askToReloadDiskVersion(withheld)).toBe(withheld);
      expect(state.scopedDocument?.revision).toBe('rev-a');

      // The acknowledgement, minted and spent through the window's own members,
      // ends the hold there and rebuilds the availability here; nothing installs.
      const acknowledged = acknowledgeSnapshot(withheld, acknowledgingThrough(state));
      expect(acknowledged.uncertaintyUnresolved).toBe(false);
      expect(state.writeOutcomeUncertain(2)).toBe(false);
      expect(state.automaticReloadGuardFor(2).uncertaintyUnresolved).toBe(false);
      expect(state.scopedDocument?.revision).toBe('rev-a');
      expect(matchEditorView(acknowledged).conflictChoices).toContain('reloadDiskVersion');
      // A second acknowledgement has nothing to end and asks nothing that spends.
      expect(acknowledgeSnapshot(acknowledged, acknowledgingThrough(state))).toBe(acknowledged);
      // And the reload now goes through, two steps and the door.
      const closed = ((onHand) => reloadTheDiskVersion(onHand, state.adoptDiskVersion, () => onHand))(confirmDiskReload(askToReloadDiskVersion(acknowledged)));
      expect(closed.closed).toBe(true);
      expect(state.scopedDocument?.revision).toBe('rev-c');
      expect(invoked).not.toHaveBeenCalled();
      editor.off();
    }); // End of the "uncertainty acknowledged through the window" case

    it('refuses a reapply while a reading is held behind another surface’s write, through the real door', async () => {
      // **The review's first blocker, with a real adopter.** Conflict A stands and
      // is registered; a raw save of the same file is in flight; reading B arrives
      // and is held, so the editor refuses to send. `adoptDiskVersion` has no
      // write-in-flight guard, so a reapply that reached it would install A's
      // snapshot and hand back a fresh session with no wait recorded — and the
      // blocked submission would be allowed through that session's ordinary save.
      const held = heldRawSave(
        { ok: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } },
        null
      );
      const disk = makeDocument({
        id: 2,
        relativePath: 'match/base.yml',
        revision: 'rev-c',
        matches: [diskTwin()]
      });
      const state = await withTheSecondSnippetSelected(held.commands);
      const editor = editorOver(state);
      state.observeExternalChange(observedWithTable({ Identified: { target: diskTwin() } }, disk));
      expect(editor.current().externalConflict).not.toBeNull();
      const sending = state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
      const laterReading: ExternalConflictObservation = {
        ...externalObservation(),
        sequence: 6,
        diskRevision: 'rev-d',
        disk: makeDocument({ id: 2, relativePath: 'match/base.yml', revision: 'rev-d' })
      };
      expect(state.observeExternalChange(laterReading).verdict.kind).toBe('retained');
      const blocked = editor.current();
      expect(blocked.awaitingReconciliation).toBe(laterReading);
      expect(canSave(blocked)).toBe(false);

      const answer = reapplyEditorToDiskVersion(blocked, state.adoptDiskVersion, () =>
        state.standingConflictFor(2), () => blocked
      );
      expect(answer).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'observationRetained' }
      });
      // Nothing adopted, nothing moved, and the block stands on the session shown.
      expect(state.scopedDocument?.revision).toBe('rev-a');
      expect(canSave(blocked)).toBe(false);
      expect(matchEditorView(blocked).reapplyOffered).toBe(false);

      held.release();
      await sending;
      // The settlement decided the held reading — a later reading of other bytes
      // supersedes A — and the wait is over, with a conflict standing still.
      const decided = editor.current();
      expect(decided.awaitingReconciliation).toBeNull();
      expect(decided.externalConflict?.source).toBe(externalConflictSource(laterReading));
      expect(canSave(decided)).toBe(false);
      expect(invoked).not.toHaveBeenCalled();
      editor.off();
    }); // End of the "reapply refused behind another surface's write" case

    it('keeps a raised conflict delivered during its own save when a sibling’s coalesced follows it before the continuation', async () => {
      // **The review's second blocker, the reviewer's interleaving, through the
      // window.** The editor's own save is out; the barrier tells it `retained(A)`;
      // the save is refused, so the settlement delivers `raised(A)` from inside the
      // wrapper's `finally`; a sibling receiver over the same file answers that
      // `raised` by publishing a later reading of the same bytes, which the window
      // decides `coalesced` and hands to every receiver — all of it before the
      // editor's `await` resumes. The hold must replay both, in that order.
      const answering = deferred<CommandResult<SaveResult>>();
      const commands: BrowserCommands = {
        ...scriptedCommands(),
        saveMatch: vi.fn(() => answering.promise)
      };
      const state = await withTheSecondSnippetSelected(commands);
      const editor = editorOver(state);
      const started = ((onHand) => beginSave(onHand, () => onHand))(editor.current());
      if (started === null) {
        throw new Error('the edited draft is saveable');
      }
      editor.set(started.session);
      const sending = state.saveMatch(
        started.session.match,
        started.draft,
        started.session.draft.baseRevision,
        started.submission.acknowledgement
      );
      // The sibling: on `raised`, it publishes a later reading of the same bytes.
      let republished = false;
      const offSibling = state.registerObservationReceiver(2, (delivery) => {
        if (delivery.verdict.kind === 'raised' && !republished) {
          republished = true;
          state.observeExternalChange({ ...externalObservation(), sequence: 6 });
        }
      });
      const seen = externalObservation();
      expect(state.observeExternalChange(seen).verdict.kind).toBe('retained');
      expect(editor.current().externalConflict).toBeNull();

      answering.resolve({
        ok: true,
        value: {
          outcome: 'refused',
          verdict: 'RefusedForUnacknowledgedSuspicions',
          findings: [suspicion()]
        }
      });
      const answer = await sending;
      if (answer.kind !== 'answered') {
        throw new Error('the scripted refusal is an answer');
      }
      // Everything the window decided reached the editor before this line, held.
      const holding = editor.current();
      expect(holding.externalConflict).toBeNull();
      editor.set(applyEditorSave(holding, answer.result, answer.adoption, () => holding));

      const settled = editor.current();
      expect(settled.outcome?.kind).toBe('refused');
      expect(settled.externalConflict?.source).toBe(externalConflictSource(seen));
      expect(settled.externalConflict?.source).toBe(state.standingConflictFor(2));
      expect(settled.awaitingReconciliation).toBeNull();
      expect(canSave(settled)).toBe(false);
      // Held in the order the window decided, and nothing left held once replayed.
      expect(holding.heldDeliveries.map((delivery) => delivery.verdict.kind)).toEqual([
        'retained',
        'raised',
        'coalesced'
      ]);
      expect(settled.heldDeliveries).toEqual([]);
      expect(invoked).not.toHaveBeenCalled();
      offSibling();
      editor.off();
    }); // End of the "raised kept behind a sibling's coalesced" case

    it('receives one decision per delivery through a retry, and never a command', async () => {
      // A held reading retried by the person arrives at the session as the
      // arbitration's verdict, on the same receiver, with nothing sent.
      const held = heldRawSave(
        { ok: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } },
        null
      );
      const state = await withTheSecondSnippetSelected(held.commands);
      const editor = editorOver(state);
      const sending = state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
      const seen = externalObservation();
      state.observeExternalChange(seen);
      expect(state.retryRetainedObservation(2)).toEqual({ kind: 'writeInFlight' });
      expect(editor.current().awaitingReconciliation).toBe(seen);
      held.release();
      await sending;
      expect(editor.current().externalConflict?.source).toBe(externalConflictSource(seen));
      expect(state.retryRetainedObservation(2)).toEqual({ kind: 'nothingRetained' });
      expect(held.commands.saveMatch).not.toHaveBeenCalled();
      expect(held.commands.reloadDocument).not.toHaveBeenCalled();
      expect(invoked).not.toHaveBeenCalled();
      editor.off();
    }); // End of the "retry reaches the receiver" case
  }); // End of the "match editor's external session" suite

  describe('the creator’s and the recovery form’s external sessions — Phase 2d-6-3', () => {
    // **Two more receivers fed by the real window.** The new-snippet form and the
    // recovery form apply what `observeExternalChange`, a settlement or a retry
    // seals, through `applyObservation` in `./matchCreation.ts` and
    // `applyRecoveryObservation` in `./recovery.ts`, and ask the window's own
    // doors. No component registers anything (2d-6-6's), and the route guard holds
    // the command spy at zero through every transition.

    /** A clock nothing advances. */
    const CLOCK = (): number => 0;

    /**
     * A new-snippet form over this window's files, both boxes filled, registered
     * as a receiver over the files a case names.
     *
     * @param state - The window.
     * @param destination - The file to choose, or `null` for a destination-less form.
     * @param over - The files to register the receiver over.
     * @returns The live form, a reader, a setter and the unregister.
     */
    function creatorOver(
      state: BrowserState,
      destination: DocumentId | null,
      over: readonly DocumentId[]
    ): {
      readonly current: () => MatchCreationSession;
      readonly set: (next: MatchCreationSession) => void;
      readonly off: () => void;
    } {
      let session = startMatchCreation(state.documents, state.views, null, CLOCK);
      if (destination !== null) {
        session = chooseDestination(session, destination);
      }
      session = editCreationField(editCreationField(session, 'trigger', ':new'), 'replace', 'a body');
      const offs = over.map((document) =>
        state.registerObservationReceiver(document, (delivery) => {
          session = applyCreatorObservation(session, delivery);
        })
      );
      return {
        current: () => session,
        set: (next) => {
          session = next;
        },
        off: () => {
          for (const off of offs) {
            off();
          }
        }
      };
    } // End of function creatorOver()

    /**
     * A recovery form opened from a match editor's conflict over `match/base.yml`,
     * registered as a receiver over the files a case names.
     *
     * @param state - The window.
     * @param destination - The file to choose after opening, or `null` to keep the
     *   preferred one.
     * @param over - The files to register the receiver over.
     * @returns The live form, a reader and the unregister.
     */
    function recoveryFormOver(
      state: BrowserState,
      destination: DocumentId | null,
      over: readonly DocumentId[]
    ): {
      readonly current: () => RecoverySession;
      readonly off: () => void;
    } {
      const baseline = baselineOf(
        makeMatch({ node: 10, document: 2, trigger: ':sig', replace: 'a body', label: 'Signature' })
      );
      const conflict = describeEditSave(
        makeConflict({ disk: grownDocument(), expected: 'rev-a' }),
        startDraft('rev-a', buffersOf(baseline), structuredDraftRules<MatchBuffers>()),
        MATCH_EDITOR_CAPABILITIES
      );
      if (conflict.kind !== 'conflict') {
        throw new Error('this helper needs the conflict arm');
      }
      const start = startMatchFieldRecovery(
        { kind: 'manualResolution', obstacle: { kind: 'evidenceNotATarget' } },
        conflict,
        baseline,
        state.documents,
        state.views,
        CLOCK
      );
      if (start.kind !== 'ready') {
        throw new Error(`this helper needs an opened form, not ${start.reason}`);
      }
      let session = destination === null ? start.session : chooseRecoveryDestination(start.session, destination);
      const offs = over.map((document) =>
        state.registerObservationReceiver(document, (delivery) => {
          session = applyRecoveryObservation(session, delivery);
        })
      );
      return {
        current: () => session,
        off: () => {
          for (const off of offs) {
            off();
          }
        }
      };
    } // End of function recoveryFormOver()

    /**
     * An observation of `match/other.yml`, the cross-file destination.
     *
     * @returns The observation, a fresh object every call.
     */
    function otherFileObservation(): ExternalConflictObservation {
      return {
        sequence: 5,
        document: 3,
        previousRevision: 'rev-a',
        diskRevision: 'rev-o',
        diskText: DISK_TEXT,
        disk: makeDocument({
          id: 3,
          relativePath: 'match/other.yml',
          revision: 'rev-o',
          matches: [makeMatch({ node: 50, document: 3, revision: 'rev-o', trigger: ':sql' })]
        }),
        findings: [],
        correspondences: null
      };
    } // End of function otherFileObservation()

    it('raises over the creator’s chosen file through a registered receiver, refuses the send, and resolves through the real door', async () => {
      const state = await withTheSecondSnippetSelected(scriptedCommands());
      const creator = creatorOver(state, 2, [2]);
      expect(canCreate(creator.current())).toBe(true);
      const seen = externalObservation();
      expect(state.observeExternalChange(seen).verdict.kind).toBe('raised');
      const told = creator.current();
      expect(told.externalConflict?.source).toBe(state.standingConflictFor(2));
      expect(creationRefusal(told)).toBe('externalConflict');
      expect(beginCreate(told, () => told)).toBeNull();
      expect(creationTargetOf(told)).toEqual({ kind: 'document', document: 2 });
      expect(state.scopedDocument?.revision).toBe('rev-a');
      // The two-step reload adopts through the door and closes the form.
      const closed = ((onHand) => reloadCreatorDiskVersion(onHand, state.adoptDiskVersion, () => onHand))(confirmCreatorDiskReload(askCreatorToReloadDiskVersion(told)));
      expect(closed.closed).toBe(true);
      expect(state.scopedDocument?.revision).toBe('rev-c');
      expect(invoked).not.toHaveBeenCalled();
      creator.off();

      // **Refused**: a later reading superseded the origin while the form was no
      // longer listening, so the door refuses and nothing closes or moves.
      const refusing = await withTheSecondSnippetSelected(scriptedCommands());
      const second = creatorOver(refusing, 2, [2]);
      refusing.observeExternalChange(externalObservation());
      second.off();
      refusing.observeExternalChange({
        ...externalObservation(),
        sequence: 6,
        diskRevision: 'rev-d',
        disk: makeDocument({ id: 2, relativePath: 'match/base.yml', revision: 'rev-d' })
      });
      const stuck = ((onHand) => reloadCreatorDiskVersion(onHand, refusing.adoptDiskVersion, () => onHand))(confirmCreatorDiskReload(askCreatorToReloadDiskVersion(second.current())));
      expect(stuck.closed).toBe(false);
      expect(matchCreationView(stuck).reloadUnavailable).toBe(true);
      expect(refusing.scopedDocument?.revision).toBe('rev-a');
      expect(invoked).not.toHaveBeenCalled();
    }); // End of the "creator raised through the receiver" case

    it('lets a destination-less creator be told of any file, choose neither, and require the person’s explicit choice', async () => {
      const state = await withTheSecondSnippetSelected(scriptedCommands());
      // Registered over both snippet files, which is what an unknown target is
      // attributed to; where 2d-6-6 registers it is that step's.
      const creator = creatorOver(state, null, [2, 3]);
      expect(creationTargetOf(creator.current())).toEqual({ kind: 'unknown' });
      expect(state.observeExternalChange(externalObservation()).verdict.kind).toBe('raised');
      const told = creator.current();
      expect(told.chosen).toBeNull();
      expect(creationTargetOf(told)).toEqual({ kind: 'unknown' });
      expect(told.externalConflict?.source).toBe(state.standingConflictFor(2));
      expect(creationRefusal(told)).toBe('noDestination');
      expect(matchCreationView(told).destinationRequired).toBe(true);
      expect(matchCreationView(told).conflictChoices).toEqual(['keepEditing', 'copyDraft']);
      // The reapply refuses before the door, and the reload is refused before it.
      expect(
        reapplyCreatorToDiskVersion(told, state.adoptDiskVersion, () => state.standingConflictFor(2), () => told)
      ).toEqual({ kind: 'manualResolution', obstacle: { kind: 'destinationRequired' } });
      expect(askCreatorToReloadDiskVersion(told)).toBe(told);
      expect(state.scopedDocument?.revision).toBe('rev-a');
      // **The person names the other file**: the conflict was about a file the
      // form no longer writes into; the window's own conflict for that file stands.
      const elsewhere = chooseDestination(told, 3);
      expect(elsewhere.chosen).toBe(3);
      expect(elsewhere.externalConflict).toBeNull();
      expect(canCreate(elsewhere)).toBe(true);
      expect(state.standingConflictFor(2)).toBe(told.externalConflict?.source);
      expect(state.scopedDocument?.revision).toBe('rev-a');
      // **The person names the affected file**: an ordinary destination conflict
      // now, whose reapply goes through the real door — at the end of the list, so
      // the reading's table (none) is not asked for anything.
      const affected = chooseDestination(told, 2);
      expect(affected.externalConflict?.source).toBe(state.standingConflictFor(2));
      expect(creationRefusal(affected)).toBe('externalConflict');
      const answer = reapplyCreatorToDiskVersion(affected, state.adoptDiskVersion, () =>
        state.standingConflictFor(2), () => affected
      );
      expect(answer.kind).toBe('reapplied');
      if (answer.kind === 'reapplied') {
        expect(creationBaseRevisionOf(answer.session)).toBe('rev-c');
        expect(canCreate(answer.session)).toBe(true);
        expect(answer.session.placement).toEqual({ kind: 'end' });
      }
      expect(state.scopedDocument?.revision).toBe('rev-c');
      expect(state.scopedMatches.map((match) => match.id.node)).toEqual([40]);
      expect(invoked).not.toHaveBeenCalled();
      creator.off();
    }); // End of the "destination-less creator" case

    it('delivers a cross-file recovery its destination’s conflict and leaves its origin the object it was', async () => {
      const commands = scriptedCommands();
      const state = await withTheSecondSnippetSelected(commands);
      const host = editorOverBase(state);
      const recovery = recoveryFormOver(state, 3, [3]);
      const origin = recovery.current().origin;
      expect(recoveryTargetOf(recovery.current())).toEqual({ kind: 'document', document: 3 });
      // A reading of the destination reaches the recovery form and not the host.
      const seenOther = otherFileObservation();
      expect(state.observeExternalChange(seenOther).verdict.kind).toBe('raised');
      const told = recovery.current();
      expect(told.externalConflict?.source).toBe(state.standingConflictFor(3));
      expect(told.origin).toBe(origin);
      expect(told.origin.conflict).toBe(origin.conflict);
      expect(recoveryRefusal(told)).toBe('externalConflict');
      expect(host.current().externalConflict).toBeNull();
      // A reading of the origin's file reaches the host and not the recovery form;
      // the origin's source object is still the one it was, whatever now stands.
      const seenBase = externalObservation();
      expect(state.observeExternalChange(seenBase).verdict.kind).toBe('raised');
      expect(host.current().externalConflict?.source).toBe(state.standingConflictFor(2));
      expect(recovery.current().origin.conflict).toBe(origin.conflict);
      expect(recovery.current().externalConflict?.source).toBe(state.standingConflictFor(3));
      expect(state.standingConflictFor(2)).not.toBe(origin.conflict);
      // The recovery's reload spends the destination conflict's own authorization
      // through the real door, installing the other file's snapshot, and closes.
      const closed = ((onHand) => reloadRecoveryDiskVersion(onHand, state.adoptDiskVersion, () => onHand))(confirmRecoveryDiskReload(askToReloadRecoveryDiskVersion(told)));
      expect(closed.closed).toBe(true);
      expect(closed.origin.conflict).toBe(origin.conflict);
      expect(state.views.find((view) => view.id === 3)?.revision).toBe('rev-o');
      expect(state.scopedDocument?.revision).toBe('rev-a');
      expect(sourceConflictState(closed)).toBe('windowMoved');
      expect(commands.createMatch).not.toHaveBeenCalled();
      expect(invoked).not.toHaveBeenCalled();
      recovery.off();
      host.off();
    }); // End of the "cross-file recovery" case

    it('hands a same-file host and recovery form the one envelope, and the recovery’s reapply reads no table', async () => {
      const state = await withTheSecondSnippetSelected(scriptedCommands());
      const envelopes: ObservationDelivery[] = [];
      const host = editorOverBase(state, (delivery) => envelopes.push(delivery));
      const recovery = recoveryFormOver(state, null, [2]);
      expect(recovery.current().chosen).toBe(2);
      const offRecorder = state.registerObservationReceiver(2, (delivery) => envelopes.push(delivery));
      const seen = externalObservation();
      const answered = state.observeExternalChange(seen);
      expect(envelopes).toEqual([answered, answered]);
      expect(envelopes[0]).toBe(envelopes[1]);
      expect(host.current().externalConflict?.source).toBe(state.standingConflictFor(2));
      expect(recovery.current().externalConflict?.source).toBe(state.standingConflictFor(2));
      expect(recovery.current().origin.conflict).not.toBe(state.standingConflictFor(2));
      // The recovery form's reapply through the live guard and the real door:
      // targetless and at the end, so the reading's table is never consulted.
      const answer = ((onHand) => reapplyRecoveryToDiskVersion(onHand, state.adoptDiskVersion, () =>
        state.standingConflictFor(2), () => onHand
      ))(recovery.current());
      expect(answer.kind).toBe('reapplied');
      if (answer.kind === 'reapplied') {
        expect(recoveryBaseRevisionOf(answer.session)).toBe('rev-c');
        expect(answer.session.origin.conflict).toBe(recovery.current().origin.conflict);
        expect(sourceConflictState(answer.session)).toBe('windowMoved');
      }
      expect(state.scopedDocument?.revision).toBe('rev-c');
      expect(invoked).not.toHaveBeenCalled();
      offRecorder();
      recovery.off();
      host.off();
    }); // End of the "same-file host and recovery" case

    /**
     * A later reading of `match/base.yml`, and a disk projection whose `id`, once
     * armed, starts another surface's held raw save and tells the window of that
     * reading — which the barrier retains — while the adoption reads it.
     *
     * @param state - The window, built over `heldRawSave`'s commands.
     * @param plain - The projection the observation carries.
     * @returns The trapped projection, the later reading, the arming switch and
     *   the send to await once released.
     */
    function retainingDuringAdoption(
      state: BrowserState,
      plain: DocumentView
    ): {
      readonly disk: DocumentView;
      readonly later: ExternalConflictObservation;
      readonly arm: () => void;
      readonly sending: () => Promise<unknown> | null;
    } {
      let armed = false;
      let sending: Promise<unknown> | null = null;
      const later: ExternalConflictObservation = {
        ...externalObservation(),
        sequence: 6,
        diskRevision: 'rev-d',
        disk: makeDocument({ id: 2, relativePath: 'match/base.yml', revision: 'rev-d' })
      };
      const disk: DocumentView = {
        ...plain,
        get id(): DocumentId {
          if (armed) {
            armed = false;
            sending = state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
            expect(state.observeExternalChange(later).verdict.kind).toBe('retained');
          }
          return plain.id;
        }
      };
      return {
        disk,
        later,
        arm: () => {
          armed = true;
        },
        sending: () => sending
      };
    } // End of function retainingDuringAdoption()

    /** A raw save that never produced an outcome, for the held write the traps start. */
    const NO_OUTCOME = { ok: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } } as const;

    it('carries a wait the window recorded during the reapply’s own adoption into the rebuilt creator (2d-6-6a review, finding 1)', async () => {
      // The editor's case, on the creator: the door's read of the projection lets
      // the window retain a later reading, and the rebuilt form must carry the
      // wait the receiver recorded, so its send stays refused.
      const failure = NO_OUTCOME;
      const heldForCreator = heldRawSave(failure, null);
      const state = await withTheSecondSnippetSelected(heldForCreator.commands);
      const creator = creatorOver(state, 2, [2]);
      const creatorTrap = retainingDuringAdoption(state, replacedDocument());
      expect(state.observeExternalChange({ ...externalObservation(), disk: creatorTrap.disk }).verdict.kind).toBe('raised');
      const created = reapplyCreatorToDiskVersion(
        creator.current(),
        (conflict, confirmation) => {
          creatorTrap.arm();
          return state.adoptDiskVersion(conflict, confirmation);
        },
        () => state.standingConflictFor(2),
        creator.current
      );
      expect(creatorTrap.sending()).not.toBeNull();
      expect(creator.current().awaitingReconciliation.get(2)).toBe(creatorTrap.later);
      expect(created.kind).toBe('reapplied');
      if (created.kind === 'reapplied') {
        expect(created.session.awaitingReconciliation.get(2)).toBe(creatorTrap.later);
        expect(canCreate(created.session)).toBe(false);
      }
      heldForCreator.release();
      await creatorTrap.sending();
      expect(invoked).not.toHaveBeenCalled();
      creator.off();
    }); // End of the "wait recorded during the creator reapply's adoption" case

    it('carries a wait the window recorded during the reapply’s own adoption into the rebuilt recovery form (2d-6-6a review, finding 1)', async () => {
      // The same interleaving on the recovery form over its own destination.
      const heldForRecovery = heldRawSave(NO_OUTCOME, null);
      const window = await withTheSecondSnippetSelected(heldForRecovery.commands);
      const recovery = recoveryFormOver(window, null, [2]);
      expect(recovery.current().chosen).toBe(2);
      const recoveryTrap = retainingDuringAdoption(window, replacedDocument());
      expect(window.observeExternalChange({ ...externalObservation(), disk: recoveryTrap.disk }).verdict.kind).toBe('raised');
      const recovered = reapplyRecoveryToDiskVersion(
        recovery.current(),
        (conflict, confirmation) => {
          recoveryTrap.arm();
          return window.adoptDiskVersion(conflict, confirmation);
        },
        () => window.standingConflictFor(2),
        recovery.current
      );
      expect(recoveryTrap.sending()).not.toBeNull();
      expect(recovery.current().awaitingReconciliation.get(2)).toBe(recoveryTrap.later);
      expect(recovered.kind).toBe('reapplied');
      if (recovered.kind === 'reapplied') {
        expect(recovered.session.awaitingReconciliation.get(2)).toBe(recoveryTrap.later);
        expect(recoveryRefusal(recovered.session)).toBe('observationRetained');
      }
      heldForRecovery.release();
      await recoveryTrap.sending();
      expect(invoked).not.toHaveBeenCalled();
      recovery.off();
    }); // End of the "wait recorded during the recovery reapply's adoption" case

    it('answers the installed recovery form when a read of the door let the window displace it (2d-6-6a review, finding 2)', async () => {
      // The reviewer's interleaving through the real window: a getter behind the
      // draft's value tells the window of a reading, the registered receiver
      // installs the conflict, the door refuses — and the composition, installed
      // by its caller exactly as `RecoveryPanel.svelte` does, must hand back that
      // installed form rather than the capture.
      const commands = scriptedCommands();
      const state = await withTheSecondSnippetSelected(commands);
      const opened = recoveryFormOver(state, null, [2]);
      const plain = opened.current();
      opened.off();
      expect(plain.chosen).toBe(2);
      let armed = true;
      const seen = externalObservation();
      const trapped: RecoverySession = {
        ...plain,
        draft: {
          ...plain.draft,
          get value(): RecoverySession['draft']['value'] {
            if (armed) {
              armed = false;
              expect(state.observeExternalChange(seen).verdict.kind).toBe('raised');
            }
            return plain.draft.value;
          }
        }
      };
      let session: RecoverySession = trapped;
      const off = state.registerObservationReceiver(2, (delivery) => {
        session = applyRecoveryObservation(session, delivery);
      });
      session = await sendRecoveryCreate(
        trapped,
        state.createMatch,
        (waiting) => {
          session = waiting;
        },
        () => session
      );
      expect(armed).toBe(false);
      expect(session).not.toBe(trapped);
      expect(session.externalConflict?.source).toBe(state.standingConflictFor(2));
      expect(commands.createMatch).not.toHaveBeenCalled();
      expect(invoked).not.toHaveBeenCalled();
      off();
    }); // End of the "displaced recovery door through the window" case

    it('tells the creator retained through the barrier, then the settlement’s verdict, and lifts a writtenHere', async () => {
      const held = heldRawSave(
        { ok: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } },
        null
      );
      const state = await withTheSecondSnippetSelected(held.commands);
      const creator = creatorOver(state, 2, [2]);
      const sending = state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
      const seen = externalObservation();
      expect(state.observeExternalChange(seen).verdict.kind).toBe('retained');
      const waiting = creator.current();
      expect(waiting.awaitingReconciliation.get(2)).toBe(seen);
      expect(creationRefusal(waiting)).toBe('observationRetained');
      expect(beginCreate(waiting, () => waiting)).toBeNull();
      expect(matchCreationView(waiting).externalNotices).toEqual([{ kind: 'observationRetained' }]);
      expect(await state.requestFileReread(2)).toEqual({
        kind: 'refused',
        reason: 'observationRetained',
        at: 'request'
      });
      held.release();
      await sending;
      const decided = creator.current();
      expect(decided.awaitingReconciliation.size).toBe(0);
      expect(decided.externalConflict?.source).toBe(externalConflictSource(seen));
      expect(invoked).not.toHaveBeenCalled();
      creator.off();

      // `writtenHere`: a held reading of the bytes the commit ended on lifts the
      // wait and raises nothing.
      const committing = heldRawSave(
        {
          ok: true,
          value: { outcome: 'saved', revision: 'rev-c', committed: true, backup_taken: false, moved: null, notes: [] },
          reload: { kind: 'done' }
        },
        'rev-c'
      );
      const window = await withTheSecondSnippetSelected(committing.commands);
      const listening = creatorOver(window, 2, [2]);
      const writing = window.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
      const same = externalObservation();
      window.observeExternalChange(same);
      expect(listening.current().awaitingReconciliation.get(2)).toBe(same);
      committing.release();
      await writing;
      expect(listening.current().awaitingReconciliation.size).toBe(0);
      expect(listening.current().externalConflict).toBeNull();
      expect(canCreate(listening.current())).toBe(true);
      expect(invoked).not.toHaveBeenCalled();
      listening.off();
    }); // End of the "creator retained then decided" case

    it('withholds the recovery form’s reload under the uncertainty hold and rebuilds it through the window’s acknowledgement', async () => {
      const commands = scriptedCommands({ raws: [WRITE_MAY_HAVE_HAPPENED] });
      const state = await withTheSecondSnippetSelected(commands);
      expect(await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED)).toEqual({
        kind: 'failed',
        mayHaveWritten: true
      });
      const recovery = recoveryFormOver(state, null, [2]);
      expect(state.observeExternalChange(externalObservation()).verdict.kind).toBe('raisedWithoutReload');
      const withheld = recovery.current();
      expect(withheld.uncertaintyUnresolved).toBe(true);
      expect(recoveryView(withheld).conflictChoices).toEqual(['keepEditing']);
      expect(recoveryView(withheld).externalNotices).toEqual([{ kind: 'writeOutcomeUnknown' }]);
      expect(
        reapplyRecoveryToDiskVersion(withheld, state.adoptDiskVersion, () => state.standingConflictFor(2), () => withheld)
      ).toEqual({ kind: 'manualResolution', obstacle: { kind: 'writeOutcomeUnknown' } });
      expect(state.scopedDocument?.revision).toBe('rev-a');
      const acknowledged = acknowledgeRecoverySnapshot(withheld, (source) => {
        const acknowledgement = state.uncertaintyAcknowledgementFor(source);
        return acknowledgement === null ? 'refused' : state.acknowledgeWriteUncertainty(acknowledgement).kind;
      });
      expect(acknowledged.uncertaintyUnresolved).toBe(false);
      expect(state.writeOutcomeUncertain(2)).toBe(false);
      expect(acknowledged.origin.conflict).toBe(withheld.origin.conflict);
      const closed = ((onHand) => reloadRecoveryDiskVersion(onHand, state.adoptDiskVersion, () => onHand))(confirmRecoveryDiskReload(askToReloadRecoveryDiskVersion(acknowledged)));
      expect(closed.closed).toBe(true);
      expect(state.scopedDocument?.revision).toBe('rev-c');
      expect(commands.createMatch).not.toHaveBeenCalled();
      expect(invoked).not.toHaveBeenCalled();
      recovery.off();
    }); // End of the "recovery uncertainty acknowledged" case

    it('settles a recovery send against the form its receiver updated during the flight (the review’s first blocker)', async () => {
      // **The reviewer's interleaving, through the real send path.** The form's
      // create is out; the barrier tells the installed form `retained(A)`; the
      // create is refused, so the settlement delivers `raised(A)` — both before
      // the `await` in `sendRecoveryCreate` resumes. A send that settled the form
      // it captured before the await would hand back one with no conflict and
      // both deliveries lost.
      const answering = deferred<CommandResult<SaveResult>>();
      const commands: BrowserCommands = {
        ...scriptedCommands(),
        createMatch: vi.fn(() => answering.promise)
      };
      const state = await withTheSecondSnippetSelected(commands);
      const opened = recoveryFormOver(state, null, []);
      let current: RecoverySession = opened.current();
      const off = state.registerObservationReceiver(2, (delivery) => {
        current = applyRecoveryObservation(current, delivery);
      });
      const sending = sendRecoveryCreate(
        current,
        state.createMatch,
        (waiting) => {
          current = waiting;
        },
        () => current
      );
      expect(current.phase).toBe('saving');
      const seen = externalObservation();
      expect(state.observeExternalChange(seen).verdict.kind).toBe('retained');
      expect(current.heldDeliveries.map((delivery) => delivery.verdict.kind)).toEqual(['retained']);
      answering.resolve({
        ok: true,
        value: {
          outcome: 'refused',
          verdict: 'RefusedForUnacknowledgedSuspicions',
          findings: [suspicion()]
        }
      });
      const settled = await sending;
      // Everything the window decided during the flight is on the settled form,
      // in the order it was decided, and nothing is left held.
      expect(settled.outcome?.kind).toBe('refused');
      expect(settled.externalConflict?.source).toBe(externalConflictSource(seen));
      expect(settled.externalConflict?.source).toBe(state.standingConflictFor(2));
      expect(settled.heldDeliveries).toEqual([]);
      expect(recoveryRefusal(settled)).toBe('externalConflict');
      expect(beginRecoveryCreate(settled, () => settled)).toBeNull();
      expect(settled.origin.conflict).toBe(opened.current().origin.conflict);
      expect(invoked).not.toHaveBeenCalled();
      off();
    }); // End of the "recovery send settled against the current form" case

    /**
     * A match editor over the second snippet with `replace` drafted, registered
     * over `match/base.yml`, as the host a recovery form is opened beside.
     *
     * @param state - The window.
     * @param also - What else to do with each delivery, before the session applies it.
     * @returns The live session, a reader and the unregister.
     */
    function editorOverBase(
      state: BrowserState,
      also: (delivery: ObservationDelivery) => void = () => undefined
    ): { readonly current: () => MatchEditorSession; readonly off: () => void } {
      let session = editField(startMatchEditor(baseDocument().matches[1]!, CLOCK), 'replace', 'mine');
      const off = state.registerObservationReceiver(2, (delivery) => {
        also(delivery);
        session = applyObservation(session, delivery);
      });
      return { current: () => session, off };
    } // End of function editorOverBase()
  }); // End of the "creator's and recovery form's external sessions" suite

  describe('the deleter’s, mover’s and duplicator’s external sessions — Phase 2d-6-4', () => {
    // **Three more receivers fed by the real window.** The deleter, the mover and
    // the duplicator apply what `observeExternalChange`, a settlement or a retry
    // seals, through `applyDeletionObservation` in `./matchDeletion.ts`,
    // `applyMoveObservation` in `./matchMove.ts` and `applyDuplicationObservation`
    // in `./matchDuplication.ts`, and ask the window's own doors. No component
    // registers anything (2d-6-6's), and the route guard holds the command spy at
    // zero through every transition.

    /**
     * The projection of `match/base.yml` with both snippets addressed as items of
     * its list, which a move and a duplicate need and a deletion does not.
     *
     * @returns The projection, at the revision the window opens on.
     */
    function sequencedBase(): DocumentView {
      return makeDocument({
        id: 2,
        relativePath: 'match/base.yml',
        matches: [
          makeMatch({ node: 10, document: 2, trigger: ':sig', label: 'Signature', path: matchListPath(0) }),
          makeMatch({ node: 11, document: 2, trigger: ':date', label: 'Today', path: matchListPath(1) })
        ]
      });
    } // End of function sequencedBase()

    /**
     * The same file as another writer left it: the two snippets under a new
     * parse, still in one list, and a third after them.
     *
     * @returns The projection the observation carries.
     */
    function sequencedDisk(): DocumentView {
      return makeDocument({
        id: 2,
        relativePath: 'match/base.yml',
        revision: 'rev-c',
        matches: [
          makeMatch({ node: 40, document: 2, revision: 'rev-c', trigger: ':sig', path: matchListPath(0) }),
          makeMatch({ node: 41, document: 2, revision: 'rev-c', trigger: ':date', path: matchListPath(1) }),
          makeMatch({ node: 42, document: 2, revision: 'rev-c', trigger: ':new', path: matchListPath(2) })
        ]
      });
    } // End of function sequencedDisk()

    /** The scripted projections, with the base file sequenced. */
    function sequencedDocuments(): ReadonlyMap<number, CommandResult<DocumentView>> {
      return new Map<number, CommandResult<DocumentView>>([
        [1, { ok: true, value: profileDocument() }],
        [2, { ok: true, value: sequencedBase() }],
        [3, { ok: true, value: otherDocument() }]
      ]);
    } // End of function sequencedDocuments()

    /**
     * A deleter over the first snippet of `match/base.yml`, registered as a
     * receiver over its file.
     *
     * @param state - The window.
     * @returns The live session, a reader, a setter and the unregister.
     */
    function deleterOver(state: BrowserState): {
      readonly current: () => MatchDeletionSession;
      readonly set: (next: MatchDeletionSession) => void;
      readonly off: () => void;
    } {
      const base = state.views.find((view) => view.id === 2);
      if (base === undefined) {
        throw new Error('the window projects match/base.yml');
      }
      let session = startMatchDeletion(base, base.matches[0]!);
      const off = state.registerObservationReceiver(2, (delivery) => {
        session = applyDeletionObservation(session, delivery);
      });
      return {
        current: () => session,
        set: (next) => {
          session = next;
        },
        off
      };
    } // End of function deleterOver()

    it('raises over the deleter’s file through a registered receiver, withdraws the question, refuses both doors, and resolves through the real door', async () => {
      const commands = scriptedCommands();
      const state = await withTheSecondSnippetSelected(commands);
      const deleter = deleterOver(state);
      deleter.set(requestDelete(deleter.current()));
      expect(deleter.current().pending).not.toBeNull();
      const seen = externalObservation();
      expect(state.observeExternalChange(seen).verdict.kind).toBe('raised');
      const told = deleter.current();
      expect(told.externalConflict?.source).toBe(state.standingConflictFor(2));
      // Entry 12 through the window: the question is withdrawn, and neither door
      // answers anything against the live projection.
      expect(told.pending).toBeNull();
      expect(canRequestDelete(told)).toBe(false);
      expect(requestDelete(told)).toBe(told);
      expect(confirmDelete(told, identityInProjection(state.views, told.match), () => told)).toBeNull();
      expect(matchDeletionView(told).externalMessages[0]).toEqual({ kind: 'fileChangedWhileOpen' });
      expect(state.scopedDocument?.revision).toBe('rev-a');
      expect(commands.deleteMatch).not.toHaveBeenCalled();
      // The two-step reload adopts through the door and closes the session.
      const closed = ((onHand) => reloadDeletionDiskVersion(onHand, state.adoptDiskVersion, () => onHand))(confirmDeletionDiskReload(askDeletionToReloadDiskVersion(told)));
      expect(closed.closed).toBe(true);
      expect(closed.externalConflict).toBeNull();
      expect(state.scopedDocument?.revision).toBe('rev-c');
      expect(invoked).not.toHaveBeenCalled();
      deleter.off();
    }); // End of the "deleter raised through the receiver" case

    it('settles a deletion against the session its receiver updated during the flight, replaying the held decisions in order', async () => {
      // The editor's interleaving, for the deleter: the deletion is out; the
      // barrier tells the installed session `retained(A)`; the refusal settles,
      // delivering `raised(A)`; a sibling answers that by publishing a later
      // reading of the same bytes, which the window decides `coalesced` — all
      // before the `await` resumes. The caller settles the session it holds.
      const answering = deferred<CommandResult<SaveResult>>();
      const commands: BrowserCommands = {
        ...scriptedCommands(),
        deleteMatch: vi.fn(() => answering.promise)
      };
      const state = await withTheSecondSnippetSelected(commands);
      const deleter = deleterOver(state);
      const started = ((onHand) => confirmDelete(
        onHand,
        identityInProjection(state.views, deleter.current().match), () => onHand
      ))(requestDelete(deleter.current()));
      if (started === null) {
        throw new Error('a confirmed deletion is sendable');
      }
      deleter.set(started.session);
      const sending = state.deleteMatch(
        started.match,
        deletionBaseRevisionOf(started.session),
        started.submission.acknowledgement
      );
      let republished = false;
      const offSibling = state.registerObservationReceiver(2, (delivery) => {
        if (delivery.verdict.kind === 'raised' && !republished) {
          republished = true;
          state.observeExternalChange({ ...externalObservation(), sequence: 6 });
        }
      });
      const seen = externalObservation();
      expect(state.observeExternalChange(seen).verdict.kind).toBe('retained');
      expect(deleter.current().externalConflict).toBeNull();
      answering.resolve({
        ok: true,
        value: {
          outcome: 'refused',
          verdict: 'RefusedForUnacknowledgedSuspicions',
          findings: [suspicion()]
        }
      });
      const answer = await sending;
      if (answer.kind !== 'answered') {
        throw new Error('the scripted refusal is an answer');
      }
      const holding = deleter.current();
      expect(holding.heldDeliveries.map((delivery) => delivery.verdict.kind)).toEqual([
        'retained',
        'raised',
        'coalesced'
      ]);
      deleter.set(applyDeletion(holding, answer.result, answer.adoption, () => holding));
      const settled = deleter.current();
      expect(settled.outcome?.kind).toBe('refused');
      expect(settled.externalConflict?.source).toBe(externalConflictSource(seen));
      expect(settled.externalConflict?.source).toBe(state.standingConflictFor(2));
      expect(settled.awaitingReconciliation.size).toBe(0);
      expect(settled.heldDeliveries).toEqual([]);
      expect(settled.pending).toBeNull();
      expect(canRequestDelete(settled)).toBe(false);
      expect(invoked).not.toHaveBeenCalled();
      offSibling();
      deleter.off();
    }); // End of the "deletion settled against the current session" case

    it('reapplies a move over the observation’s table by full identity for the subject and the anchor, through the live guard and the real door', async () => {
      const commands = scriptedCommands({ documents: sequencedDocuments() });
      const state = await withTheSecondSnippetSelected(commands);
      const base = state.views.find((view) => view.id === 2);
      if (base === undefined) {
        throw new Error('the window projects match/base.yml');
      }
      // `:sig` on its way after `:date`, which really moves it.
      let session: MatchMoveSession = choosePlacement(startMatchMove(base, base.matches[0]!, null), {
        kind: 'after',
        anchor: base.matches[1]!.id
      });
      expect(canMove(session, state.views)).toBe(true);
      const off = state.registerObservationReceiver(2, (delivery) => {
        session = applyMoveObservation(session, delivery);
      });
      const disk = sequencedDisk();
      const seen: ExternalConflictObservation = {
        ...externalObservation(),
        disk,
        correspondences: {
          base_revision: 'rev-a',
          disk_revision: 'rev-c',
          entries: [
            { base: base.matches[0]!.id, exact: { Identified: { target: disk.matches[0]! } }, editor: { Unsupported: {} } },
            { base: base.matches[1]!.id, exact: { Identified: { target: disk.matches[1]! } }, editor: { Unsupported: {} } }
          ]
        }
      };
      expect(state.observeExternalChange(seen).verdict.kind).toBe('raised');
      expect(session.externalConflict?.source).toBe(state.standingConflictFor(2));
      expect(moveSubmissionRefusal(session, state.views)).toBe('externalConflict');
      expect(beginMove(session, identityInProjection(state.views, session.match), () => session)).toBeNull();
      expect(matchMoveView(session, state.views).conflictOperation).toBe('moveAfterSnippet');

      const answer = reapplyMoveToDiskVersion(session, null, state.adoptDiskVersion, () =>
        state.standingConflictFor(2), () => session
      );
      expect(answer.kind).toBe('reapplied');
      if (answer.kind !== 'reapplied') {
        throw new Error('this case is about the rebuilt session');
      }
      // The subject and the anchor were both followed by their own rows, and the
      // rebuilt move is one move, sendable against the live projection.
      expect(answer.session.match).toEqual(disk.matches[0]!.id);
      expect(answer.session.draft.value).toEqual({ kind: 'after', anchor: disk.matches[1]!.id });
      expect(state.scopedDocument?.revision).toBe('rev-c');
      expect(state.scopedMatches.map((match) => match.id.node)).toEqual([40, 41, 42]);
      expect(canMove(answer.session, state.views)).toBe(true);
      const started = beginMove(answer.session, identityInProjection(state.views, answer.session.match), () => answer.session);
      expect(started?.after).toEqual(disk.matches[1]!.id);
      expect(commands.moveMatch).not.toHaveBeenCalled();
      expect(invoked).not.toHaveBeenCalled();
      off();
    }); // End of the "move reapplied through the live guard" case

    it('tells the duplicator retained through the barrier, blocks the send, then the settlement’s verdict, and lifts a writtenHere', async () => {
      const held = heldRawSave(
        { ok: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } },
        null,
        replacedDocument(),
        { documents: sequencedDocuments() }
      );
      const state = await withTheSecondSnippetSelected(held.commands);
      const base = state.views.find((view) => view.id === 2);
      if (base === undefined) {
        throw new Error('the window projects match/base.yml');
      }
      let session: MatchDuplicationSession = startMatchDuplication(base, base.matches[0]!, false);
      expect(canDuplicate(session, state.views)).toBe(true);
      const off = state.registerObservationReceiver(2, (delivery) => {
        session = applyDuplicationObservation(session, delivery);
      });
      const sending = state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
      const seen = externalObservation();
      expect(state.observeExternalChange(seen).verdict.kind).toBe('retained');
      expect(session.awaitingReconciliation.get(2)).toBe(seen);
      expect(duplicationSubmissionRefusal(session, state.views)).toBe('observationRetained');
      expect(beginDuplicate(session, identityInProjection(state.views, session.match), () => session)).toBeNull();
      expect(matchDuplicationView(session, state.views).externalNotices).toEqual([{ kind: 'observationRetained' }]);
      expect(await state.requestFileReread(2)).toEqual({
        kind: 'refused',
        reason: 'observationRetained',
        at: 'request'
      });
      held.release();
      await sending;
      expect(session.awaitingReconciliation.size).toBe(0);
      expect(session.externalConflict?.source).toBe(externalConflictSource(seen));
      expect(duplicationSubmissionRefusal(session, state.views)).toBe('externalConflict');
      expect(held.commands.duplicateMatch).not.toHaveBeenCalled();
      expect(invoked).not.toHaveBeenCalled();
      off();

      // `writtenHere`: a held reading of the bytes the commit ended on lifts the
      // wait and raises nothing.
      const committing = heldRawSave(
        {
          ok: true,
          value: { outcome: 'saved', revision: 'rev-c', committed: true, backup_taken: false, moved: null, notes: [] },
          reload: { kind: 'done' }
        },
        'rev-c',
        replacedDocument(),
        { documents: sequencedDocuments() }
      );
      const window = await withTheSecondSnippetSelected(committing.commands);
      const listening = window.views.find((view) => view.id === 2);
      if (listening === undefined) {
        throw new Error('the window projects match/base.yml');
      }
      let later: MatchDuplicationSession = startMatchDuplication(listening, listening.matches[0]!, false);
      const offLater = window.registerObservationReceiver(2, (delivery) => {
        later = applyDuplicationObservation(later, delivery);
      });
      const writing = window.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
      const same = externalObservation();
      window.observeExternalChange(same);
      expect(later.awaitingReconciliation.get(2)).toBe(same);
      committing.release();
      await writing;
      expect(later.awaitingReconciliation.size).toBe(0);
      expect(later.externalConflict).toBeNull();
      expect(window.standingConflictFor(2)).toBeNull();
      expect(invoked).not.toHaveBeenCalled();
      offLater();
    }); // End of the "duplicator retained then decided" case

    it('refuses a confirmation whose projection read let the window displace the installed session (the review’s first blocker)', async () => {
      // **The reviewer's interleaving, through the real door.** The identity a
      // caller hands `confirmDelete` is read through property access; a getter
      // behind its `document` tells the window of a reading, and the window's
      // registered receiver replaces the installed session with one carrying the
      // conflict. The confirmation must be refused against that session, not
      // spent against the one captured before the read.
      const commands = scriptedCommands();
      const state = await withTheSecondSnippetSelected(commands);
      const deleter = deleterOver(state);
      deleter.set(requestDelete(deleter.current()));
      const handedIn = deleter.current();
      const seen = externalObservation();
      const projected: MatchId = {
        get document(): DocumentId {
          state.observeExternalChange(seen);
          return 2;
        },
        revision: 'rev-a',
        node: 10
      };
      expect(confirmDelete(handedIn, projected, deleter.current)).toBeNull();
      expect(deleter.current().externalConflict?.source).toBe(state.standingConflictFor(2));
      expect(deleter.current().pending).toBeNull();
      expect(commands.deleteMatch).not.toHaveBeenCalled();
      expect(invoked).not.toHaveBeenCalled();
      deleter.off();
    }); // End of the "confirmation displaced through the window" case

    it('refuses a confirmation whose later draft read let the window displace the installed session (Phase 2d-6-6a)', async () => {
      // **2d-6-5's `beginSave` class, at this door, through the real window.** A
      // getter behind the draft's value that tells the window of a reading on the
      // door's **last** read of it must be seen: the first landing read the value
      // for the comparison, then the installed session, then the value again for
      // the submission, so a delivery on that last read ran after the reader and
      // the door spent against a session the registered receiver had replaced.
      const commands = scriptedCommands();
      const state = await withTheSecondSnippetSelected(commands);
      const deleter = deleterOver(state);
      const asked = requestDelete(deleter.current());
      const seen = externalObservation();
      /**
       * The asked session with a draft whose value tells the window of `seen` on
       * the given read, counting from one, installed through the holder.
       *
       * @param on - The read that delivers, or `null` for none.
       * @returns The trapped session and its read count.
       */
      function trappedOn(on: number | null): { readonly trapped: MatchDeletionSession; readonly reads: () => number } {
        let reads = 0;
        const trapped: MatchDeletionSession = {
          ...asked,
          draft: {
            ...asked.draft,
            get value(): MatchId {
              reads += 1;
              if (reads === on) {
                state.observeExternalChange(seen);
              }
              return asked.draft.value;
            }
          }
        };
        deleter.set(trapped);
        return { trapped, reads: () => reads };
      } // End of function trappedOn()
      // How many times the door reads the value, measured rather than assumed.
      const quiet = trappedOn(null);
      expect(confirmDelete(quiet.trapped, identityInProjection(state.views, quiet.trapped.match), deleter.current)).not.toBeNull();
      const total = quiet.reads();
      expect(total).toBeGreaterThanOrEqual(1);
      const last = trappedOn(total);
      expect(confirmDelete(last.trapped, identityInProjection(state.views, last.trapped.match), deleter.current)).toBeNull();
      expect(deleter.current().externalConflict?.source).toBe(state.standingConflictFor(2));
      expect(commands.deleteMatch).not.toHaveBeenCalled();
      expect(invoked).not.toHaveBeenCalled();
      deleter.off();
    }); // End of the "later draft read displaced through the window" case

    it('replays a delivery the window made during the settlement replay, against the installed session (the review’s second blocker)', async () => {
      // **The reviewer's interleaving, through the real window.** The deletion is
      // out; the barrier tells the installed session `retained(A)`; the refusal
      // settles and `raised(A)` is delivered; both are held. While the settlement
      // replays A, a getter behind A's `document` tells the window of a later
      // reading B; the window delivers it at once to the installed session, still
      // `saving`, where the receiver appends it. The settled session must carry B.
      const answering = deferred<CommandResult<SaveResult>>();
      const commands: BrowserCommands = {
        ...scriptedCommands(),
        deleteMatch: vi.fn(() => answering.promise)
      };
      const state = await withTheSecondSnippetSelected(commands);
      const deleter = deleterOver(state);
      const started = ((onHand) => confirmDelete(
        onHand,
        identityInProjection(state.views, deleter.current().match), () => onHand
      ))(requestDelete(deleter.current()));
      if (started === null) {
        throw new Error('a confirmed deletion is sendable');
      }
      deleter.set(started.session);
      const sending = state.deleteMatch(
        started.match,
        deletionBaseRevisionOf(started.session),
        started.submission.acknowledgement
      );
      let armed = false;
      const later: ExternalConflictObservation = {
        ...externalObservation(),
        sequence: 6,
        diskRevision: 'rev-d',
        disk: makeDocument({ id: 2, relativePath: 'match/base.yml', revision: 'rev-d' })
      };
      const seen: ExternalConflictObservation = {
        ...externalObservation(),
        get document(): DocumentId {
          if (armed) {
            armed = false;
            state.observeExternalChange(later);
          }
          return 2;
        }
      };
      expect(state.observeExternalChange(seen).verdict.kind).toBe('retained');
      answering.resolve({
        ok: true,
        value: {
          outcome: 'refused',
          verdict: 'RefusedForUnacknowledgedSuspicions',
          findings: [suspicion()]
        }
      });
      const answer = await sending;
      if (answer.kind !== 'answered') {
        throw new Error('the scripted refusal is an answer');
      }
      expect(deleter.current().heldDeliveries.map((delivery) => delivery.verdict.kind)).toEqual(['retained', 'raised']);
      armed = true;
      deleter.set(applyDeletion(deleter.current(), answer.result, answer.adoption, deleter.current));
      expect(armed).toBe(false);
      const settled = deleter.current();
      expect(settled.outcome?.kind).toBe('refused');
      expect(settled.heldDeliveries).toEqual([]);
      // B superseded A at the window, and the session shows B.
      expect(state.standingConflictFor(2)).toBe(externalConflictSource(later));
      expect(settled.externalConflict?.source).toBe(externalConflictSource(later));
      expect(canRequestDelete(settled)).toBe(false);
      expect(invoked).not.toHaveBeenCalled();
      deleter.off();
    }); // End of the "delivery during the settlement replay" case

    it('refuses to adopt when a reading the window held arrived during the reapply’s evidence reads (the review’s third blocker)', async () => {
      // **The reviewer's interleaving, through the real window.** Conflict A
      // stands with a table; while the mover's reapply reads the anchor's row, a
      // getter behind its exact tier starts another surface's raw save and tells
      // the window of a reading B, which the barrier holds and delivers as
      // `retained(B)` to the installed session. `adoptDiskVersion` has no
      // write-in-flight guard, so a reapply that went on with the session it was
      // handed would install A's snapshot and hand back a session with no wait.
      const held = heldRawSave(
        { ok: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } },
        null,
        replacedDocument(),
        { documents: sequencedDocuments() }
      );
      const state = await withTheSecondSnippetSelected(held.commands);
      const base = state.views.find((view) => view.id === 2);
      if (base === undefined) {
        throw new Error('the window projects match/base.yml');
      }
      let session: MatchMoveSession = choosePlacement(startMatchMove(base, base.matches[0]!, null), {
        kind: 'after',
        anchor: base.matches[1]!.id
      });
      const off = state.registerObservationReceiver(2, (delivery) => {
        session = applyMoveObservation(session, delivery);
      });
      const disk = sequencedDisk();
      let sending: Promise<unknown> | null = null;
      const laterReading: ExternalConflictObservation = {
        ...externalObservation(),
        sequence: 6,
        diskRevision: 'rev-d',
        disk: makeDocument({ id: 2, relativePath: 'match/base.yml', revision: 'rev-d' })
      };
      const anchorRow: CorrespondenceEntry = {
        base: base.matches[1]!.id,
        get exact(): ReapplyResolution {
          if (sending === null) {
            sending = state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
            expect(state.observeExternalChange(laterReading).verdict.kind).toBe('retained');
          }
          return { Identified: { target: disk.matches[1]! } };
        },
        editor: { Unsupported: {} }
      };
      const seen: ExternalConflictObservation = {
        ...externalObservation(),
        disk,
        correspondences: {
          base_revision: 'rev-a',
          disk_revision: 'rev-c',
          entries: [
            { base: base.matches[0]!.id, exact: { Identified: { target: disk.matches[0]! } }, editor: { Unsupported: {} } },
            anchorRow
          ]
        }
      };
      expect(state.observeExternalChange(seen).verdict.kind).toBe('raised');
      const handedIn = session;
      const answer = reapplyMoveToDiskVersion(
        handedIn,
        null,
        state.adoptDiskVersion,
        () => state.standingConflictFor(2),
        () => session
      );
      expect(answer).toEqual({ kind: 'manualResolution', obstacle: { kind: 'observationRetained' } });
      // Nothing adopted, and the wait the window delivered stands on the session.
      expect(state.scopedDocument?.revision).toBe('rev-a');
      expect(session.awaitingReconciliation.get(2)).toBe(laterReading);
      expect(moveSubmissionRefusal(session, state.views)).toBe('externalConflict');
      held.release();
      if (sending !== null) {
        await sending;
      }
      expect(held.commands.moveMatch).not.toHaveBeenCalled();
      expect(invoked).not.toHaveBeenCalled();
      off();
    }); // End of the "wait delivered during the reapply's reads" case
  }); // End of the "deleter's, mover's and duplicator's external sessions" suite

  describe('the raw editor’s and restore’s external sessions — Phase 2d-6-5', () => {
    // **The last two receivers fed by the real window.** The raw editor and the
    // restore apply what `observeExternalChange`, a settlement or a retry seals,
    // through `applyObservation` in `./rawEditor.ts` and
    // `applyRestoreObservation` in `./restore.ts`, and ask the window's own
    // doors. No component registers anything (2d-6-8's), and the route guard
    // holds the command spy at zero through every transition.

    /** The text the raw editor opens over, and edits. */
    const OPENED = 'matches: []\n';

    /**
     * A raw editor over `match/base.yml` with one edit made, registered as a
     * receiver over its file.
     *
     * @param state - The window.
     * @returns The live session, a reader, a setter and the unregister.
     */
    function rawEditorOver(state: BrowserState): {
      readonly current: () => RawEditorSession;
      readonly set: (next: RawEditorSession) => void;
      readonly off: () => void;
    } {
      const opened = startRawEditor(2, 'rev-a', OPENED);
      if (opened === null) {
        throw new Error('this text is one the editor can hold unchanged');
      }
      let session = editRawText(opened, `${OPENED}# edited\n`);
      const off = state.registerObservationReceiver(2, (delivery) => {
        session = applyRawObservation(session, delivery);
      });
      return {
        current: () => session,
        set: (next) => {
          session = next;
        },
        off
      };
    } // End of function rawEditorOver()

    /**
     * A restore over `match/base.yml` with a candidate retained and the
     * question asked, registered as a receiver over its destination.
     *
     * @param state - The window, whose backup surface answers the walk.
     * @returns The live session, a reader, a setter and the unregister.
     */
    async function restoreOver(state: BrowserState): Promise<{
      readonly current: () => RestoreSession;
      readonly set: (next: RestoreSession) => void;
      readonly off: () => void;
    }> {
      const withCandidate = await walkToACandidate(state, openRestore(state));
      let session = prepareRestore(withCandidate, windowFor(state, withCandidate), () => withCandidate);
      expect(session.pending).not.toBeNull();
      const off = state.registerObservationReceiver(2, (delivery) => {
        session = applyRestoreObservation(session, delivery);
      });
      return {
        current: () => session,
        set: (next) => {
          session = next;
        },
        off
      };
    } // End of function restoreOver()

    it('raises over the raw editor’s file through a registered receiver, refuses both doors, and reseeds through the real door', async () => {
      const commands = scriptedCommands();
      const state = await withTheSecondSnippetSelected(commands);
      const editor = rawEditorOver(state);
      expect(canRawSave(editor.current())).toBe(true);
      const seen = externalObservation();
      expect(state.observeExternalChange(seen).verdict.kind).toBe('raised');
      const told = editor.current();
      expect(told.externalConflict?.source).toBe(state.standingConflictFor(2));
      // Entry 8 through the window: neither door answers anything, the box is
      // frozen, and the copy is exactly the edited text.
      expect(canRawSave(told)).toBe(false);
      expect(beginRawSave(told, () => told)).toBeNull();
      expect(beginRawSave(told, editor.current)).toBeNull();
      const view = rawEditorView(told);
      expect(view.editable).toBe(false);
      expect(view.externalMessages[0]).toEqual({ kind: 'fileChangedWhileOpen' });
      expect(view.diskText).toEqual({ kind: 'text', text: DISK_TEXT });
      expect(view.canReload).toBe(true);
      expect(state.scopedDocument?.revision).toBe('rev-a');
      // The two-step reload adopts through the door and reseeds the box from the
      // observation's own text (entry 23's "reseed").
      const reseeded = ((onHand) => loadRawDiskVersion(onHand, state.adoptDiskVersion, () => onHand))(confirmRawReload(askRawToReload(told)));
      expect(reseeded.draft.value).toBe(DISK_TEXT);
      expect(reseeded.draft.baseRevision).toBe('rev-c');
      expect(reseeded.externalConflict).toBeNull();
      expect(rawEditorView(reseeded).editable).toBe(true);
      expect(state.scopedDocument?.revision).toBe('rev-c');
      expect(commands.saveRawDocument).not.toHaveBeenCalled();
      expect(invoked).not.toHaveBeenCalled();
      editor.off();
    }); // End of the "raw editor raised through the receiver" case

    it('refuses to reseed the raw editor from a disk version holding a carriage return, through the real door', async () => {
      // **`CLAUDE.md` §6 at the external origin, with a real window.** The
      // observation's disk text has two CRLF lines among LF ones; the reload is
      // confirmed and the door is never asked, so the window stays where it was.
      const commands = scriptedCommands();
      const state = await withTheSecondSnippetSelected(commands);
      const editor = rawEditorOver(state);
      const seen: ExternalConflictObservation = {
        ...externalObservation(),
        diskText: 'matches:\r\n  - trigger: x\n    replace: theirs\r\n'
      };
      expect(state.observeExternalChange(seen).verdict.kind).toBe('raised');
      const told = editor.current();
      const view = rawEditorView(told);
      expect(view.diskRefusal).toEqual({ kind: 'lineEndingsNotPreserved' });
      expect(view.canReload).toBe(false);
      const confirmed = confirmRawReload(askRawToReload(told));
      expect(confirmed.reload.kind).toBe('confirmed');
      expect(loadRawDiskVersion(confirmed, state.adoptDiskVersion, () => confirmed)).toBe(confirmed);
      expect(confirmed.draft.value).toBe(`${OPENED}# edited\n`);
      expect(state.scopedDocument?.revision).toBe('rev-a');
      expect(state.standingConflictFor(2)).toBe(externalConflictSource(seen));
      expect(invoked).not.toHaveBeenCalled();
      editor.off();
    }); // End of the "carriage return refused through the door" case

    it('answers all three adoption outcomes to the raw editor through the real door, the outlived origin refused without resetting the warning', async () => {
      const commands = scriptedCommands();
      const state = await withTheSecondSnippetSelected(commands);
      // Two editors over one file receive the same envelope; the first reload
      // installs, the second finds the window already there and reseeds too.
      const first = rawEditorOver(state);
      const second = rawEditorOver(state);
      const seen = externalObservation();
      expect(state.observeExternalChange(seen).verdict.kind).toBe('raised');
      expect(first.current().externalConflict?.source).toBe(second.current().externalConflict?.source);
      const installed = ((onHand) => loadRawDiskVersion(onHand, state.adoptDiskVersion, () => onHand))(confirmRawReload(askRawToReload(first.current())));
      expect(installed.draft.value).toBe(DISK_TEXT);
      expect(state.scopedDocument?.revision).toBe('rev-c');
      const alreadyThere = ((onHand) => loadRawDiskVersion(onHand, state.adoptDiskVersion, () => onHand))(confirmRawReload(askRawToReload(second.current())));
      expect(alreadyThere.draft.value).toBe(DISK_TEXT);
      expect(alreadyThere.externalConflict).toBeNull();
      first.off();
      second.off();
      // The refusal of an outlived origin, in a fresh window: A is confirmed, B
      // supersedes it at the window; the installed session's reload was reset
      // by the transition (entry 12), and a session that kept A's confirmation
      // by hand is refused at the door — which does not reset its warning.
      const window = await withTheSecondSnippetSelected(scriptedCommands());
      const editor = rawEditorOver(window);
      const a = externalObservation();
      expect(window.observeExternalChange(a).verdict.kind).toBe('raised');
      const confirmedA = confirmRawReload(askRawToReload(editor.current()));
      editor.set(confirmedA);
      const b: ExternalConflictObservation = {
        ...externalObservation(),
        sequence: 6,
        diskRevision: 'rev-d',
        disk: makeDocument({ id: 2, relativePath: 'match/base.yml', revision: 'rev-d' })
      };
      expect(window.observeExternalChange(b).verdict.kind).toBe('supersedes');
      expect(editor.current().reload.kind).toBe('idle');
      expect(editor.current().externalConflict?.source).toBe(window.standingConflictFor(2));
      const refused = loadRawDiskVersion(confirmedA, window.adoptDiskVersion, () => confirmedA);
      expect(refused.reload).toEqual({ kind: 'refused' });
      expect(refused.draft).toBe(confirmedA.draft);
      expect(rawEditorView(refused).reloadUnavailable).toBe(true);
      expect(window.scopedDocument?.revision).toBe('rev-a');
      expect(invoked).not.toHaveBeenCalled();
      editor.off();
    }); // End of the "three adoption outcomes for the raw editor" case

    it('holds a reading during the raw editor’s own save and settles it against the installed session through the real boundary', async () => {
      // The raw save is out; the barrier tells the installed session
      // `retained(A)`; the refusal settles and the window delivers its verdict
      // about A — both held, because the session is still `saving` when the
      // wrapper publishes. The caller settles what it holds after its `await`.
      const held = heldRawSave(
        {
          ok: true,
          value: { outcome: 'refused', verdict: 'RefusedForUnacknowledgedSuspicions', findings: [suspicion()] },
          reload: { kind: 'done' }
        },
        null
      );
      const state = await withTheSecondSnippetSelected(held.commands);
      const editor = rawEditorOver(state);
      const started = beginRawSave(editor.current(), editor.current);
      if (started === null) {
        throw new Error('an edited raw session is sendable');
      }
      editor.set(started.session);
      const sending = state.saveRawDocument(
        2,
        started.session.draft.baseRevision,
        started.submission.candidate,
        started.submission.acknowledgement
      );
      const seen = externalObservation();
      expect(state.observeExternalChange(seen).verdict.kind).toBe('retained');
      expect(editor.current().heldDeliveries.map((delivery) => delivery.verdict.kind)).toEqual(['retained']);
      expect(editor.current().awaitingReconciliation.size).toBe(0);
      held.release();
      const answer = await sending;
      if (answer.kind !== 'sealed') {
        throw new Error('the scripted refusal is sealed');
      }
      expect(editor.current().heldDeliveries.map((delivery) => delivery.verdict.kind)).toEqual(['retained', 'raised']);
      editor.set(applyRawSave(editor.current(), answer.sealed, editor.current));
      const settled = editor.current();
      expect(settled.phase).toBe('editing');
      expect(settled.outcome?.kind).toBe('refused');
      expect(settled.heldDeliveries).toEqual([]);
      expect(settled.awaitingReconciliation.size).toBe(0);
      expect(settled.externalConflict?.source).toBe(externalConflictSource(seen));
      expect(settled.externalConflict?.source).toBe(state.standingConflictFor(2));
      expect(canRawSave(settled)).toBe(false);
      expect(rawEditorView(settled).refusalChoices).toEqual(['keepEditing']);
      expect(held.commands.saveRawDocument).toHaveBeenCalledTimes(1);
      expect(invoked).not.toHaveBeenCalled();
      editor.off();
    }); // End of the "raw save settled against the installed session" case

    it('raises over the restore’s destination through a registered receiver, withdraws the question, refuses all three doors, and retargets through the real door', async () => {
      const state = createBrowserState(scriptedCommands(), () => undefined, scriptedBackups());
      await state.open(null);
      const restore = await restoreOver(state);
      const asked = restore.current();
      const seen = externalObservation();
      expect(state.observeExternalChange(seen).verdict.kind).toBe('raised');
      const told = restore.current();
      expect(told.externalConflict?.source).toBe(state.standingConflictFor(2));
      // Entry 12 through the window: the question is withdrawn — the retained
      // session confirms nothing either — and the candidate is kept.
      expect(told.pending).toBeNull();
      expect(confirmRestore(asked, windowFor(state, asked), () => asked)).toBeNull();
      expect(candidateText(told.preview!)).toBe(CANDIDATE);
      expect(told.baseRevision).toBe('rev-a');
      // Entry 8, all three doors.
      expect(restoreRefusal(told, windowFor(state, told))).toEqual({ kind: 'externalConflict' });
      expect(prepareRestore(told, windowFor(state, told), restore.current)).toBe(told);
      const byHand: RestoreSession = { ...told, pending: asked.pending };
      expect(confirmRestore(byHand, windowFor(state, told), () => byHand)).toBeNull();
      const view = restoreView(told, windowFor(state, told));
      expect(view.canPrepare).toBe(false);
      expect(view.externalMessages[0]).toEqual({ kind: 'fileChangedWhileOpen' });
      expect(view.conflictOperation).toBe('replaceFileFromBackup');
      expect(revisionInProjection(state.views, 2)).toBe('rev-a');
      // The two-step reload adopts through the door and re-points the kept
      // candidate at the observation's disk revision (entry 23's "retarget").
      const reloaded = ((onHand) => reloadRestoreDiskVersion(
        onHand,
        state.adoptDiskVersion, () => onHand
      ))(confirmRestoreDiskReload(askRestoreToReloadDiskVersion(told)));
      expect(reloaded.baseRevision).toBe('rev-c');
      expect(reloaded.preview!.draft.baseRevision).toBe('rev-c');
      expect(candidateText(reloaded.preview!)).toBe(CANDIDATE);
      expect(reloaded.externalConflict).toBeNull();
      expect(revisionInProjection(state.views, 2)).toBe('rev-c');
      // Prepared again against what the window now holds — once the reloaded
      // session is the installed one: a reader answering the session the
      // receiver last installed makes the door answer that session, and ask
      // nothing over the captured one.
      expect(prepareRestore(reloaded, windowFor(state, reloaded), restore.current)).toBe(restore.current());
      restore.set(reloaded);
      const again = prepareRestore(reloaded, windowFor(state, reloaded), restore.current);
      expect(again.pending).not.toBeNull();
      expect(invoked).not.toHaveBeenCalled();
      restore.off();
    }); // End of the "restore raised through the receiver" case

    it('answers all three adoption outcomes to the restore through the real door, the outlived origin refused without resetting the warning', async () => {
      const state = createBrowserState(scriptedCommands(), () => undefined, scriptedBackups());
      await state.open(null);
      const first = await restoreOver(state);
      const second = await restoreOver(state);
      const seen = externalObservation();
      expect(state.observeExternalChange(seen).verdict.kind).toBe('raised');
      const installed = ((onHand) => reloadRestoreDiskVersion(
        onHand,
        state.adoptDiskVersion, () => onHand
      ))(confirmRestoreDiskReload(askRestoreToReloadDiskVersion(first.current())));
      expect(installed.baseRevision).toBe('rev-c');
      expect(revisionInProjection(state.views, 2)).toBe('rev-c');
      const alreadyThere = ((onHand) => reloadRestoreDiskVersion(
        onHand,
        state.adoptDiskVersion, () => onHand
      ))(confirmRestoreDiskReload(askRestoreToReloadDiskVersion(second.current())));
      expect(alreadyThere.baseRevision).toBe('rev-c');
      expect(candidateText(alreadyThere.preview!)).toBe(CANDIDATE);
      first.off();
      second.off();
      // The outlived origin, in a fresh window.
      const window = createBrowserState(scriptedCommands(), () => undefined, scriptedBackups());
      await window.open(null);
      const restore = await restoreOver(window);
      const a = externalObservation();
      expect(window.observeExternalChange(a).verdict.kind).toBe('raised');
      const confirmedA = confirmRestoreDiskReload(askRestoreToReloadDiskVersion(restore.current()));
      restore.set(confirmedA);
      const b: ExternalConflictObservation = {
        ...externalObservation(),
        sequence: 6,
        diskRevision: 'rev-d',
        disk: makeDocument({ id: 2, relativePath: 'match/base.yml', revision: 'rev-d' })
      };
      expect(window.observeExternalChange(b).verdict.kind).toBe('supersedes');
      expect(restore.current().reload.kind).toBe('idle');
      const refused = reloadRestoreDiskVersion(confirmedA, window.adoptDiskVersion, () => confirmedA);
      expect(refused.reload).toEqual({ kind: 'refused' });
      expect(refused.baseRevision).toBe('rev-a');
      expect(restoreView(refused, windowFor(window, refused)).reloadUnavailable).toBe(true);
      expect(revisionInProjection(window.views, 2)).toBe('rev-a');
      expect(invoked).not.toHaveBeenCalled();
      restore.off();
    }); // End of the "three adoption outcomes for the restore" case

    it('tells the restore retained through the barrier, blocks all three doors including the final permit, then the settlement’s verdict', async () => {
      const held = heldRawSave(
        { ok: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } },
        null
      );
      const state = createBrowserState(held.commands, () => undefined, scriptedBackups());
      await state.open(null);
      const restore = await restoreOver(state);
      const asked = restore.current();
      // Another surface's raw save is out; the reading is held.
      const sending = state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
      const seen = externalObservation();
      expect(state.observeExternalChange(seen).verdict.kind).toBe('retained');
      const waiting = restore.current();
      expect(waiting.awaitingReconciliation.get(2)).toBe(seen);
      // The question was carried to the installed session and is refused at
      // every door until the wait lifts; the retained one authorizes nothing.
      expect(waiting.pending).toBe(asked.pending);
      expect(restoreRefusal(waiting, windowFor(state, waiting))).toEqual({ kind: 'observationRetained' });
      expect(prepareRestore(waiting, windowFor(state, waiting), restore.current)).toBe(waiting);
      expect(confirmRestore(waiting, windowFor(state, waiting), restore.current)).toBeNull();
      expect(confirmRestore(asked, windowFor(state, asked), () => asked)).toBeNull();
      expect(restoreView(waiting, windowFor(state, waiting)).externalNotices).toEqual([{ kind: 'observationRetained' }]);
      // The final permit: a confirmation minted in a window with no wait, sent
      // beside the installed session, is consumed unspent and the sender is
      // never reached.
      const quiet = createBrowserState(scriptedCommands(), () => undefined, scriptedBackups());
      await quiet.open(null);
      const other = await restoreOver(quiet);
      const started = ((onHand) => confirmRestore(onHand, windowFor(quiet, other.current()), () => onHand))(other.current());
      if (started === null) {
        throw new Error('a pending restore confirms');
      }
      const carrying: RestoreSession = { ...started.session, awaitingReconciliation: waiting.awaitingReconciliation };
      const sent = await sendRestore(started, carrying, windowFor(quiet, carrying), (document, base, text, ack) =>
        quiet.saveRawDocument(document, base, text, ack), () => carrying
      );
      expect(sent).toEqual({ kind: 'withdrawn' });
      other.off();
      // The settlement delivers the verdict about the held reading.
      held.release();
      await sending;
      expect(restore.current().awaitingReconciliation.size).toBe(0);
      expect(restore.current().externalConflict?.source).toBe(externalConflictSource(seen));
      expect(restoreRefusal(restore.current(), windowFor(state, restore.current()))).toEqual({ kind: 'externalConflict' });
      expect(held.commands.saveRawDocument).toHaveBeenCalledTimes(1);
      expect(invoked).not.toHaveBeenCalled();
      restore.off();
    }); // End of the "restore retained then decided" case

    it('refuses a raw save whose later draft read let the window displace the installed session (the review’s first blocker)', async () => {
      // **The reviewer's interleaving, through the real door.** The draft's
      // value is read more than once on the way to a submission; a getter that
      // is quiet on the first read and tells the window of a reading on the
      // second ran after a check made too early. The window's registered
      // receiver installs the conflict; the save must be refused against that
      // session and nothing sent.
      const commands = scriptedCommands();
      const state = await withTheSecondSnippetSelected(commands);
      const editor = rawEditorOver(state);
      const handedIn = editor.current();
      const seen = externalObservation();
      let reads = 0;
      const trapped: RawEditorSession = {
        ...handedIn,
        draft: {
          ...handedIn.draft,
          get value() {
            reads += 1;
            if (reads === 2) {
              expect(state.observeExternalChange(seen).verdict.kind).toBe('raised');
            }
            return handedIn.draft.value;
          }
        }
      };
      editor.set(trapped);
      expect(beginRawSave(trapped, editor.current)).toBeNull();
      expect(reads).toBeGreaterThanOrEqual(2);
      expect(editor.current().externalConflict?.source).toBe(state.standingConflictFor(2));
      expect(canRawSave(editor.current())).toBe(false);
      expect(commands.saveRawDocument).not.toHaveBeenCalled();
      expect(invoked).not.toHaveBeenCalled();
      editor.off();
    }); // End of the "raw save displaced through the window on a later read" case

    it('answers the installed session from a refused preparation whose context read let the window displace it (the review’s second blocker)', async () => {
      // **The reviewer's interleaving, through the real window.** The context's
      // revision is read by the block; a getter there tells the window of a
      // reading and answers a revision the session is not measured against, so
      // the preparation refuses `targetMoved` — and a refusal that answered its
      // argument would have the caller overwrite the conflict the receiver
      // installed.
      const state = createBrowserState(scriptedCommands(), () => undefined, scriptedBackups());
      await state.open(null);
      const restore = await restoreOver(state);
      restore.set(cancelRestore(restore.current()));
      const handedIn = restore.current();
      expect(handedIn.pending).toBeNull();
      const seen = externalObservation();
      // Armed once: the block reads the revision twice, and the window hands
      // each decision out once.
      let armed = true;
      const context: RestoreContext = {
        get observed(): ContentRevision {
          if (armed) {
            armed = false;
            expect(state.observeExternalChange(seen).verdict.kind).toBe('raised');
          }
          return 'rev-z';
        },
        surfaces: []
      };
      const answered = prepareRestore(handedIn, context, restore.current);
      expect(answered).toBe(restore.current());
      expect(answered).not.toBe(handedIn);
      expect(answered.externalConflict?.source).toBe(state.standingConflictFor(2));
      expect(answered.pending).toBeNull();
      expect(restoreRefusal(answered, windowFor(state, answered))).toEqual({ kind: 'externalConflict' });
      expect(invoked).not.toHaveBeenCalled();
      restore.off();
    }); // End of the "refused preparation displaced through the window" case

    it('keeps what the window delivered during the adoption itself, on both surfaces (the review’s third finding)', async () => {
      // **The reviewer's interleaving, through the real `adoptDiskVersion`.**
      // The door copies the observation's projection before it decides; a
      // getter behind that projection's `id` tells the window of a strictly
      // later reading B, which supersedes A at the window and reaches the
      // registered receiver while the adoption is still inside the door. The
      // door then refuses A as outlived — and a reload that built its answer
      // over the session it was handed would hand back A's conflict at the
      // refused step, with B gone.
      /**
       * An observation of `match/base.yml` whose projection's `id`, once armed,
       * publishes a strictly later reading through the given window.
       *
       * @param state - The window.
       * @returns The observation, the later reading, and the arming switch.
       */
      function observationPublishingOnAdoption(state: BrowserState): {
        readonly seen: ExternalConflictObservation;
        readonly later: ExternalConflictObservation;
        readonly arm: () => void;
      } {
        let armed = false;
        const later: ExternalConflictObservation = {
          ...externalObservation(),
          sequence: 6,
          diskRevision: 'rev-d',
          disk: makeDocument({ id: 2, relativePath: 'match/base.yml', revision: 'rev-d' })
        };
        const plain = replacedDocument();
        const seen: ExternalConflictObservation = {
          ...externalObservation(),
          disk: {
            ...plain,
            get id(): DocumentId {
              if (armed) {
                armed = false;
                expect(state.observeExternalChange(later).verdict.kind).toBe('supersedes');
              }
              return plain.id;
            }
          }
        };
        return {
          seen,
          later,
          arm: () => {
            armed = true;
          }
        };
      } // End of function observationPublishingOnAdoption()
      // The raw editor.
      const commands = scriptedCommands();
      const state = await withTheSecondSnippetSelected(commands);
      const editor = rawEditorOver(state);
      const raw = observationPublishingOnAdoption(state);
      expect(state.observeExternalChange(raw.seen).verdict.kind).toBe('raised');
      const confirmedRaw = confirmRawReload(askRawToReload(editor.current()));
      editor.set(confirmedRaw);
      raw.arm();
      const rawAnswer = loadRawDiskVersion(confirmedRaw, state.adoptDiskVersion, editor.current);
      expect(state.standingConflictFor(2)).toBe(externalConflictSource(raw.later));
      expect(rawAnswer).toBe(editor.current());
      expect(rawAnswer.externalConflict?.source).toBe(externalConflictSource(raw.later));
      expect(rawAnswer.reload.kind).toBe('idle');
      expect(rawAnswer.draft.value).toBe(`${OPENED}# edited\n`);
      expect(state.scopedDocument?.revision).toBe('rev-a');
      expect(commands.saveRawDocument).not.toHaveBeenCalled();
      editor.off();
      // The restore.
      const window = createBrowserState(scriptedCommands(), () => undefined, scriptedBackups());
      await window.open(null);
      const restore = await restoreOver(window);
      const kept = observationPublishingOnAdoption(window);
      expect(window.observeExternalChange(kept.seen).verdict.kind).toBe('raised');
      const confirmedRestore = confirmRestoreDiskReload(askRestoreToReloadDiskVersion(restore.current()));
      restore.set(confirmedRestore);
      kept.arm();
      const restoreAnswer = reloadRestoreDiskVersion(confirmedRestore, window.adoptDiskVersion, restore.current);
      expect(window.standingConflictFor(2)).toBe(externalConflictSource(kept.later));
      expect(restoreAnswer).toBe(restore.current());
      expect(restoreAnswer.externalConflict?.source).toBe(externalConflictSource(kept.later));
      expect(restoreAnswer.reload.kind).toBe('idle');
      expect(restoreAnswer.baseRevision).toBe('rev-a');
      expect(candidateText(restoreAnswer.preview!)).toBe(CANDIDATE);
      expect(revisionInProjection(window.views, 2)).toBe('rev-a');
      expect(invoked).not.toHaveBeenCalled();
      restore.off();
    }); // End of the "delivery during the adoption kept on both surfaces" case

    it('carries a wait the window recorded during a satisfied adoption into the reseed and the retarget (the review’s third finding, the installed arm)', async () => {
      // The other outcome of the same interleaving: the getter starts another
      // surface's raw save before it tells the window of B, so the barrier holds
      // B and the receiver records a wait while the door goes on to install A's
      // snapshot. The reseed and the retarget must carry that wait, so the next
      // send is refused until the window decides B.
      /**
       * An observation whose projection's `id`, once armed, starts a held raw
       * save and publishes a reading the barrier retains.
       *
       * @param state - The window.
       * @returns The observation, the retained reading, the arming switch and
       *   the send to await once released.
       */
      function observationRetainingOnAdoption(state: BrowserState): {
        readonly seen: ExternalConflictObservation;
        readonly later: ExternalConflictObservation;
        readonly arm: () => void;
        readonly sending: () => Promise<unknown> | null;
      } {
        let armed = false;
        let sending: Promise<unknown> | null = null;
        const later: ExternalConflictObservation = {
          ...externalObservation(),
          sequence: 6,
          diskRevision: 'rev-d',
          disk: makeDocument({ id: 2, relativePath: 'match/base.yml', revision: 'rev-d' })
        };
        const plain = replacedDocument();
        const seen: ExternalConflictObservation = {
          ...externalObservation(),
          disk: {
            ...plain,
            get id(): DocumentId {
              if (armed) {
                armed = false;
                sending = state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
                expect(state.observeExternalChange(later).verdict.kind).toBe('retained');
              }
              return plain.id;
            }
          }
        };
        return {
          seen,
          later,
          arm: () => {
            armed = true;
          },
          sending: () => sending
        };
      } // End of function observationRetainingOnAdoption()
      // The raw editor.
      const heldForRaw = heldRawSave(
        { ok: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } },
        null
      );
      const state = await withTheSecondSnippetSelected(heldForRaw.commands);
      const editor = rawEditorOver(state);
      const raw = observationRetainingOnAdoption(state);
      expect(state.observeExternalChange(raw.seen).verdict.kind).toBe('raised');
      const confirmedRaw = confirmRawReload(askRawToReload(editor.current()));
      editor.set(confirmedRaw);
      raw.arm();
      const reseeded = loadRawDiskVersion(confirmedRaw, state.adoptDiskVersion, editor.current);
      expect(raw.sending()).not.toBeNull();
      expect(state.scopedDocument?.revision).toBe('rev-c');
      expect(reseeded.draft.value).toBe(DISK_TEXT);
      expect(reseeded.externalConflict).toBeNull();
      expect(reseeded.awaitingReconciliation.get(2)).toBe(raw.later);
      expect(canRawSave(editRawText(reseeded, `${DISK_TEXT}# again\n`))).toBe(false);
      heldForRaw.release();
      await raw.sending();
      expect(heldForRaw.commands.saveRawDocument).toHaveBeenCalledTimes(1);
      editor.off();
      // The restore.
      const heldForRestore = heldRawSave(
        { ok: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } },
        null
      );
      const window = createBrowserState(heldForRestore.commands, () => undefined, scriptedBackups());
      await window.open(null);
      const restore = await restoreOver(window);
      const kept = observationRetainingOnAdoption(window);
      expect(window.observeExternalChange(kept.seen).verdict.kind).toBe('raised');
      const confirmedRestore = confirmRestoreDiskReload(askRestoreToReloadDiskVersion(restore.current()));
      restore.set(confirmedRestore);
      kept.arm();
      const retargeted = reloadRestoreDiskVersion(confirmedRestore, window.adoptDiskVersion, restore.current);
      expect(kept.sending()).not.toBeNull();
      expect(revisionInProjection(window.views, 2)).toBe('rev-c');
      expect(retargeted.baseRevision).toBe('rev-c');
      expect(candidateText(retargeted.preview!)).toBe(CANDIDATE);
      expect(retargeted.externalConflict).toBeNull();
      expect(retargeted.awaitingReconciliation.get(2)).toBe(kept.later);
      expect(restoreRefusal(retargeted, windowFor(window, retargeted))).toEqual({ kind: 'observationRetained' });
      heldForRestore.release();
      await kept.sending();
      expect(heldForRestore.commands.saveRawDocument).toHaveBeenCalledTimes(1);
      expect(invoked).not.toHaveBeenCalled();
      restore.off();
    }); // End of the "wait during a satisfied adoption carried" case
  }); // End of the "raw editor's and restore's external sessions" suite

  describe('entry 15 on the coordinator’s automatic reread — Phase 2d-6-9b-3', () => {
    /**
     * A started state over `match/base.yml`, with the second snippet selected and
     * the raw viewer showing, whose one wake drains a `Changed` observation of that
     * file at sequence 1 — `startedWithOneWake`'s shape over a boundary the case
     * builds, so a case can hold the reread open.
     *
     * Three drains are declared: the registration's, the open's and the wake's.
     *
     * @param build - Builds the boundary from the scripted one, which already
     *   carries the three drains.
     * @param script - The scripted answers, less the drains.
     * @returns The state, its boundary, and the wake that delivers the batch.
     */
    async function overOneObservedChange(
      build: (scripted: BrowserCommands) => BrowserCommands,
      script: Script
    ): Promise<{
      readonly state: BrowserState;
      readonly commands: BrowserCommands;
      readonly wake: () => Promise<void>;
    }> {
      expectDrains([0, 0, 0]);
      const events = testEvents();
      const commands = build(
        scriptedCommands({
          ...script,
          drains: [
            reconciliationBatch(),
            reconciliationBatch(),
            reconciliationBatch({
              newest_sequence: 1,
              observations: [changedObservation(1, addressable(2, 'match/base.yml'))]
            })
          ]
        })
      );
      const state = createBrowserState(commands, () => undefined, undefined, events.source);
      state.start();
      await settleDrains();
      await state.open(null);
      await settleDrains();
      state.show({ kind: 'document', id: 2 });
      await state.select(baseDocument().matches[1]!);
      await state.showFileText(true);
      return {
        state,
        commands,
        wake: async () => {
          events.wake(5, 1);
          await settleDrains();
          await settleDrains();
        }
      };
    } // End of function overOneObservedChange()

    /**
     * Drives the one uncertain write that puts `match/base.yml` under the hold, with
     * no surface registered.
     *
     * @param state - The window.
     */
    async function holdTheFile(state: BrowserState): Promise<void> {
      expect(await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED)).toEqual({
        kind: 'failed',
        mayHaveWritten: true
      });
      expect(state.writeOutcomeUncertain(2)).toBe(true);
    } // End of function holdTheFile()

    it('refuses the automatic reread under an uncertainty hold, sending no reload and installing nothing', async () => {
      // **Entry 15, on the path 2d-6-9b-1 measured open** (`2d-6-9b-1-notes.md` §6
      // item 1): with the hold standing and no surface over the file, a drained
      // `Changed` observation used to issue `reload_document` and install the
      // answer while `writeOutcomeUncertain` stayed `true`.
      const { state, commands, wake } = await overOneObservedChange((scripted) => scripted, {
        raws: [WRITE_MAY_HAVE_HAPPENED],
        reload: { ok: true, value: rereadBaseDocument() }
      });
      await holdTheFile(state);
      const shown = state.scopedMatches.map((match) => match.id.node);
      await wake();

      expect(commands.reloadDocument).not.toHaveBeenCalled();
      expect(state.scopedMatches.map((match) => match.id.node)).toEqual(shown);
      expect(state.externalDocumentStatus(2)).toEqual({ kind: 'stale' });
      expect(state.writeOutcomeUncertain(2)).toBe(true);
      // The one raw save is the uncertain write that raised the hold; nothing
      // else wrote.
      expect(commands.saveRawDocument).toHaveBeenCalledTimes(1);
      expect(commands.saveMatch).not.toHaveBeenCalled();
      expect(invoked).not.toHaveBeenCalled();
      state.dispose();
    }); // End of the "refused at the request" case

    it('registers the refused observation as the file’s acknowledgeable origin, and acknowledging it opens the reread', async () => {
      // **The ruling's second half: the `stale` file keeps an exit.** The refused
      // observation stands for the file, an acknowledgement can be minted from it,
      // and once spent the person's reread goes through and clears the mark. The
      // manual request is refused under the hold exactly as before this phase.
      const { state, commands, wake } = await overOneObservedChange((scripted) => scripted, {
        raws: [WRITE_MAY_HAVE_HAPPENED],
        reload: { ok: true, value: rereadBaseDocument() }
      });
      await holdTheFile(state);
      expect(state.standingConflictFor(2)).toBeNull();
      await wake();

      const source = state.standingConflictFor(2);
      expect(source?.kind).toBe('externalChange');
      if (source?.kind !== 'externalChange') {
        throw new Error('the refused observation was expected to stand for the file');
      }
      expect(source.observation.sequence).toBe(1);
      expect(source.observation.diskRevision).toBe('rev-disk');
      expect(state.uncertaintyAcknowledgementEligibility(2)).toEqual({ kind: 'eligible' });
      expect(await state.requestFileReread(2)).toEqual({
        kind: 'refused',
        reason: 'uncertaintyUnresolved',
        at: 'request'
      });
      expect(commands.reloadDocument).not.toHaveBeenCalled();

      const token = state.uncertaintyAcknowledgementFor(source);
      expect(token).not.toBeNull();
      expect(state.acknowledgeWriteUncertainty(token!)).toEqual({ kind: 'acknowledged' });
      expect(state.writeOutcomeUncertain(2)).toBe(false);
      expect(state.externalDocumentStatus(2)).toEqual({ kind: 'stale' });

      expect(await state.requestFileReread(2)).toEqual({ kind: 'completed' });
      expect(commands.reloadDocument).toHaveBeenCalledTimes(1);
      expect(commands.reloadDocument).toHaveBeenCalledWith(2);
      expect(state.scopedMatches.map((match) => match.id.node)).toEqual([77]);
      expect(state.externalDocumentStatus(2)).toBeNull();
      expect(invoked).not.toHaveBeenCalled();
      state.dispose();
    }); // End of the "registered origin and its exit" case

    it('installs nothing when the hold is established while the automatic read is out, and leaves the file not stale', async () => {
      // The read starts with no hold; an uncertain raw save settles while it is
      // out. That failure re-adopts the file (`mayHaveWritten`), which replaces its
      // projection, so `rereadUnderGuard`'s own projection capture refuses the
      // answer before the host's hold recheck is ever asked. Nothing is installed
      // over the hold — which is entry 15's property — and no origin is
      // registered, because registering needs the generation the observation
      // arrived at and the window has since been replaced.
      //
      // **Phase 2d-7-1's ruling** (`docs/decisions/2d-7-1-notes.md` §2): this
      // used to leave the file `stale`, held, with nothing to acknowledge
      // (`2d-6-9b-3-notes.md` §6 item 1). The mark this read's own arrival wrote
      // is now cleared, because the window holds no snapshot that could back it —
      // the observation was neither installed nor registered — and the hold it
      // leaves standing is the true statement about the file. The file ends not
      // `stale`, under the hold, exactly as a hold with nothing observed does.
      const held = deferred<CommandResult<DocumentView>>();
      const { state, commands, wake } = await overOneObservedChange(
        (scripted) => ({ ...scripted, reloadDocument: vi.fn(async () => held.promise) }),
        { raws: [WRITE_MAY_HAVE_HAPPENED] }
      );
      const shown = state.scopedMatches.map((match) => match.id.node);
      await wake();
      expect(commands.reloadDocument).toHaveBeenCalledTimes(1);
      await holdTheFile(state);

      held.resolve({ ok: true, value: rereadBaseDocument() });
      await settleDrains();

      expect(state.scopedMatches.map((match) => match.id.node)).not.toContain(77);
      expect(state.scopedMatches.map((match) => match.id.node)).toEqual(shown);
      expect(state.externalDocumentStatus(2)).toBeNull();
      expect(state.writeOutcomeUncertain(2)).toBe(true);
      expect(state.standingConflictFor(2)).toBeNull();
      expect(commands.reloadDocument).toHaveBeenCalledTimes(1);
      expect(invoked).not.toHaveBeenCalled();
      state.dispose();
    }); // End of the "hold established during the read" case

    it('keeps the mark of a read the projection capture refused when no hold stands', async () => {
      // **Where Phase 2d-7-1's ruling keeps the mark standing.** The same refusal
      // as the case above — a committed raw save of this window's replaces the
      // projection while the automatic read is out — but the write ended on a
      // named revision, so no hold stands. The mark stays: the person's reread is
      // its exit (the reread control is offered and not refused), and a
      // conservative mark with an exit is the over-refusal cost ruling 19 accepts.
      const held = deferred<CommandResult<DocumentView>>();
      const { state, commands, wake } = await overOneObservedChange(
        (scripted) => ({ ...scripted, reloadDocument: vi.fn(async () => held.promise) }),
        { raws: [RAW_COMMITTED] }
      );
      await wake();
      expect(commands.reloadDocument).toHaveBeenCalledTimes(1);
      expect(state.externalDocumentStatus(2)).toEqual({ kind: 'stale' });
      expect((await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED)).kind).toBe(
        'sealed'
      );
      expect(state.writeOutcomeUncertain(2)).toBe(false);

      held.resolve({ ok: true, value: rereadBaseDocument() });
      await settleDrains();

      expect(state.scopedMatches.map((match) => match.id.node)).not.toContain(77);
      expect(state.externalDocumentStatus(2)).toEqual({ kind: 'stale' });
      expect(state.standingConflictFor(2)).toBeNull();
      expect(commands.reloadDocument).toHaveBeenCalledTimes(1);
      expect(invoked).not.toHaveBeenCalled();
      state.dispose();
    }); // End of the "no hold keeps the mark" case

    it('refuses the installation and registers the observation when the hold is established during the read with the projection unchanged', async () => {
      // **The review's finding (`docs/reviews/phase-2d-6-9b-3.md`), re-derived.**
      // A may-have-written delete re-adopts the file through
      // `adoptTheDocumentOnDisk`, which returns before `installView` when its
      // `get_document` fails — so the projection is not replaced, the lease's
      // `close()` still establishes the hold, and the automatic read answering
      // afterwards passes `stillCurrent()` and reaches the host's installation-time
      // hold recheck. That recheck refuses the install and registers the
      // observation.
      const held = deferred<CommandResult<DocumentView>>();
      let adoptionFails = false;
      const { state, commands, wake } = await overOneObservedChange(
        (scripted) => ({
          ...scripted,
          reloadDocument: vi.fn(async () => held.promise),
          getDocument: vi.fn(async (id: DocumentId): Promise<CommandResult<DocumentView>> =>
            adoptionFails
              ? { ok: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } }
              : scripted.getDocument(id)
          )
        }),
        { deletes: [WRITE_MAY_HAVE_HAPPENED] }
      );
      const shown = state.scopedMatches.map((match) => match.id.node);
      await wake();
      expect(commands.reloadDocument).toHaveBeenCalledTimes(1);
      expect(state.standingConflictFor(2)).toBeNull();

      adoptionFails = true;
      expect(
        (await state.deleteMatch(baseDocument().matches[0]!.id, OPEN_REVISION, NOTHING_ACKNOWLEDGED))
          .kind
      ).toBe('failed');
      expect(state.writeOutcomeUncertain(2)).toBe(true);
      expect(state.scopedMatches.map((match) => match.id.node)).toEqual(shown);

      held.resolve({ ok: true, value: rereadBaseDocument() });
      await settleDrains();

      expect(state.scopedMatches.map((match) => match.id.node)).toEqual(shown);
      expect(state.externalDocumentStatus(2)).toEqual({ kind: 'stale' });
      const source = state.standingConflictFor(2);
      expect(source?.kind === 'externalChange' ? source.observation.sequence : null).toBe(1);
      expect(state.uncertaintyAcknowledgementEligibility(2)).toEqual({ kind: 'eligible' });
      expect(commands.reloadDocument).toHaveBeenCalledTimes(1);
      expect(invoked).not.toHaveBeenCalled();
      state.dispose();
    }); // End of the "installation-time refusal" case

    it('lets a further observed change replace an outlived origin on the route, so the acknowledgement is offered again', async () => {
      // **Why the route's exits note now names an observation.** 9b-1 measured that
      // on the route the next observation was installed by the automatic reread
      // and the outlived origin kept standing. Refused and registered now, a
      // later observation of different bytes supersedes it at the current
      // projection generation. The outlived origin is reached the 9a review's
      // way: an observation held during a write that answers `may_have_written`,
      // whose own re-adoption outlives it.
      const gate = deferred<void>();
      const { state, commands, wake } = await overOneObservedChange(
        (scripted) => ({
          ...scripted,
          saveRawDocument: vi.fn(async (...args: Parameters<BrowserCommands['saveRawDocument']>) => {
            await gate.promise;
            return scripted.saveRawDocument(...args);
          })
        }),
        { raws: [WRITE_MAY_HAVE_HAPPENED], reload: { ok: true, value: rereadBaseDocument() } }
      );
      const saving = state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
      expect(state.observeExternalChange({ ...externalObservation(), sequence: 0 }).verdict.kind).toBe(
        'retained'
      );
      gate.resolve();
      await saving;
      expect(state.writeOutcomeUncertain(2)).toBe(true);
      expect(state.uncertaintyAcknowledgementEligibility(2)).toEqual({
        kind: 'ineligible',
        reason: 'projectionReplaced'
      });

      await wake();
      expect(commands.reloadDocument).not.toHaveBeenCalled();
      const source = state.standingConflictFor(2);
      expect(source?.kind === 'externalChange' ? source.observation.sequence : null).toBe(1);
      expect(state.uncertaintyAcknowledgementEligibility(2)).toEqual({ kind: 'eligible' });
      state.dispose();
    }); // End of the "outlived origin replaced" case

    it('still rereads and installs on the automatic path when no hold stands', async () => {
      // The clean path this phase must not narrow: the same observation, no
      // uncertain write, one read and one installation, and nothing registered.
      const { state, commands, wake } = await overOneObservedChange((scripted) => scripted, {
        reload: { ok: true, value: rereadBaseDocument() }
      });
      await wake();
      expect(commands.reloadDocument).toHaveBeenCalledTimes(1);
      expect(state.scopedMatches.map((match) => match.id.node)).toEqual([77]);
      expect(state.externalDocumentStatus(2)).toBeNull();
      expect(state.standingConflictFor(2)).toBeNull();
      state.dispose();
    }); // End of the "no hold" case
  }); // End of the "entry 15 on the automatic reread" suite

  describe('a stale mark across a writtenHere release — Phase 2d-7-1', () => {
    /*
     * `docs/decisions/2d-7-1-notes.md` §2, the ruling on `stale` while a write
     * surface is open, and `2d-6-11a-notes.md` §5 item 1, the defect it answers: a
     * reading that arrives behind an open raw editor while its save is out is
     * marked `stale` by the coordinator (`markStaleWhileOurs` in
     * `./observationTransitions.ts`), held by the barrier, and then dropped as
     * `writtenHere` when the save commits on exactly those bytes — and the mark
     * used to survive the drop, although the window held the bytes the watcher
     * read.
     */

    /** The revision the committed save ends on, and the one the reading names. */
    const WRITTEN: ContentRevision = 'rev-disk';

    /**
     * The parse a re-read answers once the save has committed.
     *
     * @param revision - The revision the parse is of.
     * @returns The projection.
     */
    function writtenProjection(revision: ContentRevision = WRITTEN): DocumentView {
      return makeDocument({
        id: 2,
        relativePath: 'match/base.yml',
        revision,
        matches: [makeMatch({ node: 60, document: 2, revision, trigger: ':new', label: 'Written here' })]
      });
    } // End of function writtenProjection()

    /** The committed raw save, ending on {@link WRITTEN}. */
    const COMMITTED_ON_WRITTEN: RawSaveOutcome = {
      ok: true,
      value: { ...RAW_COMMITTED_VALUE, revision: WRITTEN },
      reload: { kind: 'done' }
    };

    /**
     * One `Changed` observation of `match/base.yml` naming a chosen disk revision.
     *
     * @param sequence - The sequence it was admitted under.
     * @param diskRevision - The revision the watcher read.
     * @returns The observation.
     */
    function changedAt(sequence: number, diskRevision: ContentRevision): ExternalObservation {
      const observed = changedObservation(sequence, addressable(2, 'match/base.yml'));
      if (!('Changed' in observed)) {
        throw new Error('changedObservation answers a Changed observation');
      }
      return { Changed: { ...observed.Changed, disk_revision: diskRevision } };
    } // End of function changedAt()

    /**
     * A started state over `match/base.yml` with a raw editor registered over it,
     * whose transition hands what it is told to `observeExternalChange` exactly as
     * `DetailPane.svelte`'s does — but only for the sequences `forwarded` names, so
     * a case can build a reading the barrier never holds.
     *
     * @param commands - The boundary, whose drains are already scripted.
     * @param forwarded - The sequences the transition forwards.
     * @returns The state, what the surface was told, and the wake.
     */
    async function behindAnOpenRawEditor(
      commands: BrowserCommands,
      forwarded: readonly number[]
    ): Promise<{
      readonly state: BrowserState;
      readonly told: number[];
      readonly wake: (newest: number) => Promise<void>;
    }> {
      const events = testEvents();
      const told: number[] = [];
      const state = createBrowserState(commands, () => undefined, undefined, events.source);
      state.start();
      await settleDrains();
      state.registerWriteSurface({ kind: 'rawEditor', target: { kind: 'document', document: 2 } }, (observation) => {
        told.push(observation.sequence);
        if (forwarded.includes(observation.sequence)) {
          state.observeExternalChange(observation);
        }
      });
      await state.open(null);
      await settleDrains();
      state.show({ kind: 'document', id: 2 });
      return {
        state,
        told,
        wake: async (newest: number) => {
          events.wake(5, newest);
          await settleDrains();
          await settleDrains();
        }
      };
    } // End of function behindAnOpenRawEditor()

    it('clears the mark the held reading wrote when the release drops it as written here', async () => {
      // **The fix's own case**, shown failing on the unfixed tree first. The
      // reading's mark is the last status written for the file when the barrier
      // takes it, nothing writes the status again before the release, and the
      // window ends holding exactly the revision the reading names — so the window
      // holds no snapshot newer than its projection, which is what `stale` says.
      expectDrains([0, 0, 0]);
      const held = heldRawSave(COMMITTED_ON_WRITTEN, WRITTEN, writtenProjection(), {
        drains: [
          reconciliationBatch(),
          reconciliationBatch(),
          reconciliationBatch({ newest_sequence: 1, observations: [changedAt(1, WRITTEN)] })
        ]
      });
      const { state, told, wake } = await behindAnOpenRawEditor(held.commands, [1]);
      const sending = state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
      await wake(1);
      expect(told).toEqual([1]);
      expect(state.externalDocumentStatus(2)).toEqual({ kind: 'stale' });
      expect(state.retainedObservationFor(2)?.sequence).toBe(1);

      held.release();
      await sending;

      expect(state.retainedObservationFor(2)).toBeNull();
      expect(state.standingConflictFor(2)).toBeNull();
      expect(state.scopedDocument?.revision).toBe(WRITTEN);
      expect(state.externalDocumentStatus(2)).toBeNull();
      expect(held.commands.reloadDocument).not.toHaveBeenCalled();
      expect(invoked).not.toHaveBeenCalled();
      state.dispose();
    }); // End of the "writtenHere clears its own mark" case

    it('keeps the mark when the committed save could not be re-read, so the window does not hold the reading’s bytes', async () => {
      // **Where the ruling keeps the mark: the window does not hold the bytes.** The
      // save commits on the reading's revision, so the release is still
      // `writtenHere`, but the re-read after the commit fails and the replaced
      // projection is dropped rather than replaced. The reading names bytes this
      // window does not show, and the mark says so.
      expectDrains([0, 0, 0]);
      const held = heldRawSave(COMMITTED_ON_WRITTEN, WRITTEN, writtenProjection(), {
        drains: [
          reconciliationBatch(),
          reconciliationBatch(),
          reconciliationBatch({ newest_sequence: 1, observations: [changedAt(1, WRITTEN)] })
        ]
      });
      let rereadFails = false;
      const commands: BrowserCommands = {
        ...held.commands,
        getDocument: vi.fn(async (id: DocumentId): Promise<CommandResult<DocumentView>> =>
          rereadFails
            ? { ok: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } }
            : held.commands.getDocument(id)
        )
      };
      const { state, wake } = await behindAnOpenRawEditor(commands, [1]);
      const sending = state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
      await wake(1);
      expect(state.externalDocumentStatus(2)).toEqual({ kind: 'stale' });
      rereadFails = true;

      held.release();
      await sending;

      expect(state.retainedObservationFor(2)).toBeNull();
      expect(state.views.find((view) => view.id === 2)?.revision).not.toBe(WRITTEN);
      expect(state.externalDocumentStatus(2)).toEqual({ kind: 'stale' });
      expect(invoked).not.toHaveBeenCalled();
      state.dispose();
    }); // End of the "re-read failed keeps the mark" case

    it('keeps a mark written after the reading was held, which is another cause’s', async () => {
      // **Where the ruling keeps the mark: provenance.** The reading at sequence 1
      // is held; a later reading at sequence 2, of other bytes, reaches the
      // coordinator, which marks the file again — and is never held, because this
      // surface does not forward it. The file's status-write count has moved since
      // the barrier took the first reading, so the mark standing at the release is
      // not the one that reading wrote, and it stands: the window was told of a
      // reading it never installed.
      expectDrains([0, 0, 0, 1]);
      const held = heldRawSave(COMMITTED_ON_WRITTEN, WRITTEN, writtenProjection(), {
        drains: [
          reconciliationBatch(),
          reconciliationBatch(),
          reconciliationBatch({ newest_sequence: 1, observations: [changedAt(1, WRITTEN)] }),
          reconciliationBatch({ newest_sequence: 2, observations: [changedAt(2, 'rev-later')] })
        ]
      });
      const { state, told, wake } = await behindAnOpenRawEditor(held.commands, [1]);
      const sending = state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
      await wake(1);
      await wake(2);
      expect(told).toEqual([1, 2]);
      expect(state.retainedObservationFor(2)?.sequence).toBe(1);
      expect(state.externalDocumentStatus(2)).toEqual({ kind: 'stale' });

      held.release();
      await sending;

      expect(state.retainedObservationFor(2)).toBeNull();
      expect(state.scopedDocument?.revision).toBe(WRITTEN);
      expect(state.externalDocumentStatus(2)).toEqual({ kind: 'stale' });
      expect(invoked).not.toHaveBeenCalled();
      state.dispose();
    }); // End of the "a later mark stands" case
  }); // End of the "stale mark across a writtenHere release" suite
}); // End of the "deferred adoption" suite

/**
 * The batch every restore case in this file lists entries of.
 *
 * A folder name, and nothing here reads it as a time: consult Q6 forbids *taken
 * at*, *the version from* and every other historical claim, and a fixture that
 * spelled one would be the first place such a sentence appeared.
 */
const RESTORE_BATCH: BackupBatchId = { name: '2026-01-01T00-00-00Z-000' };

/** The file every restore case in this file would replace. */
const RESTORE_TARGET: DocumentId = 2;

/** The hash of the candidate bytes, which is never a base revision. */
const CANDIDATE_REVISION: ContentRevision = 'candidate-rev-1';

/** The hash of a second read's bytes. */
const SECOND_CANDIDATE_REVISION: ContentRevision = 'candidate-rev-2';

/**
 * The candidate's exact bytes.
 *
 * **A byte-order mark, CRLF line endings and a trailing space**, deliberately:
 * what these cases have to hold is that nothing on the path from
 * `read_backup_text` to `save_raw_document` touches one of them. A restore
 * candidate never enters an input control, so the raw editor's carriage-return
 * refusal does not apply to it.
 */
const CANDIDATE = '﻿matches:\r\n  - trigger: ":a"\r\n    replace: "b"   \r\n';

/** A second read's bytes, for the cases about asking again. */
const SECOND_CANDIDATE = 'matches:\n  - trigger: ":z"\n    replace: "y"\n';

/** A refusal the backup reads answer with. */
const BACKUP_REFUSAL: IpcFailure = {
  kind: 'command',
  error: { code: 'backupReadFailed', error: { StaleBatch: { batch: RESTORE_BATCH } } }
};

/**
 * One entry of {@link RESTORE_BATCH}, as a listing found it.
 *
 * @param relativePath - The entry's path inside the batch.
 * @returns The entry.
 */
function backupEntry(relativePath = 'match/base.yml'): BackupEntry {
  return {
    id: { batch: RESTORE_BATCH, relative_path: relativePath },
    display_path: relativePath,
    length: '42',
    target: { InConfigRoot: { relative_path: relativePath } }
  };
} // End of function backupEntry()

/** The batch listing every restore case starts from. */
const BACKUP_BATCHES: BackupBatchListing = {
  root: 'Present',
  batches: [{ id: RESTORE_BATCH, display_name: RESTORE_BATCH.name }],
  skipped: [],
  unrecognised: 0,
  unreadable: 0,
  complete: true
};

/** That batch's entry listing. */
const BACKUP_ENTRIES: BackupEntryListing = {
  batch: RESTORE_BATCH,
  entries: [backupEntry()],
  skipped: [],
  unrecognised: 0,
  unreadable: 0,
  unaddressable: 0,
  complete: true
};

/**
 * What one entry's text read answers.
 *
 * @param text - The exact bytes.
 * @param revision - The hash of exactly those bytes.
 * @returns The response, as it crosses the boundary.
 */
function backupText(text = CANDIDATE, revision = CANDIDATE_REVISION): BackupTextResponse {
  return { entry: backupEntry(), document: RESTORE_TARGET, text, revision };
} // End of function backupText()

/** What each of the three backup reads should answer, in order. */
interface BackupScript {
  /** What `list_backup_batches` answers, in order. */
  readonly batches?: readonly CommandResult<BackupBatchListing>[];
  /** What `list_backup_entries` answers, in order. */
  readonly entries?: readonly CommandResult<BackupEntryListing>[];
  /** What `read_backup_text` answers, in order. */
  readonly texts?: readonly CommandResult<BackupTextResponse>[];
}

/**
 * A backup surface that answers from a script.
 *
 * Lists rather than single answers for the reason `Script.moves` is one: the
 * interesting case here is a **second** ask, because a listing dropped while a
 * restore was in flight is asked for again and this is what tells the two answers
 * apart.
 *
 * @param script - What each of the three reads should answer.
 * @returns The commands, with `vi.fn` wrappers so calls can be counted.
 */
function scriptedBackups(script: BackupScript = {}): BackupCommands {
  let batches = 0;
  let entries = 0;
  let texts = 0;
  return {
    listBackupBatches: vi.fn(async () => {
      const answer: CommandResult<BackupBatchListing> = script.batches?.[batches++] ?? {
        ok: true,
        value: BACKUP_BATCHES
      };
      return answer;
    }),
    listBackupEntries: vi.fn(async () => {
      const answer: CommandResult<BackupEntryListing> = script.entries?.[entries++] ?? {
        ok: true,
        value: BACKUP_ENTRIES
      };
      return answer;
    }),
    readBackupText: vi.fn(async () => {
      const answer: CommandResult<BackupTextResponse> = script.texts?.[texts++] ?? {
        ok: true,
        value: backupText()
      };
      return answer;
    })
  };
} // End of function scriptedBackups()

/**
 * A ready workspace with a restore opened over `match/base.yml`.
 *
 * @param state - The state to open the restore over.
 * @returns The session, at its resting state with nothing asked for.
 */
function openRestore(state: BrowserState): RestoreSession {
  const view = state.views.find((held) => held.id === RESTORE_TARGET);
  if (view === undefined) {
    throw new Error('the destination was expected to be projected');
  }
  return startRestore(view);
} // End of function openRestore()

/**
 * What this window observes, read the way the model says it must be read.
 *
 * `revisionInProjection` over the state's own projections, never
 * `session.baseRevision`: a confirmation that compares two values minted together
 * observes nothing, and this helper is what the cases use so that the one case
 * about **disagreement** can be seen to arrange it deliberately.
 *
 * @param state - The window.
 * @param session - The session being asked about.
 * @returns The context every gate takes.
 */
function windowFor(state: BrowserState, session: RestoreSession): RestoreContext {
  return { observed: revisionInProjection(state.views, session.target), surfaces: [] };
} // End of function windowFor()

/**
 * Walks a session as far as one retained candidate, through the wrappers.
 *
 * Every read goes through {@link BrowserState}, which is the point: no `.svelte`
 * file imports `../ipc/commands`, so this is the path a screen has.
 *
 * @param state - The window.
 * @param session - The session to walk.
 * @returns The session holding the candidate.
 */
async function walkToACandidate(
  state: BrowserState,
  session: RestoreSession
): Promise<RestoreSession> {
  const listed = batchesLoaded(loadingBatches(session), await state.listBackupBatches());
  const chosen = chooseBatch(listed, RESTORE_BATCH);
  const walked = entriesLoaded(
    loadingEntries(chosen),
    await state.listBackupEntries(RESTORE_BATCH)
  );
  return takeTheCandidate(state, chooseEntry(walked, backupEntry().id));
} // End of function walkToACandidate()

/**
 * Reads the chosen entry's text and hands the answer to the session.
 *
 * The refusal arm is `candidateRefused`'s and is exercised in `restore.test.ts`;
 * what this helper is for is the cases that need a candidate, and the cases about
 * a dropped answer, which need the read to have really happened.
 *
 * @param state - The window.
 * @param session - The session that chose the entry.
 * @returns The session the answer produced, which is the same session when the
 *   model dropped it.
 */
async function takeTheCandidate(
  state: BrowserState,
  session: RestoreSession
): Promise<RestoreSession> {
  const entry = session.entry;
  if (entry === null) {
    throw new Error('an entry was expected to have been chosen');
  }
  const answer = await state.readBackupText(entry, session.target);
  if (!answer.ok) {
    throw new Error('this read was expected to answer');
  }
  return candidateRead(session, answer.value);
} // End of function takeTheCandidate()

/**
 * A workspace, a restore, a candidate and an answered question.
 *
 * @param commands - The workspace surface.
 * @param backups - The backup surface.
 * @returns The window and the session with the question pending.
 */
async function readyToConfirm(
  commands: BrowserCommands,
  backups: BackupCommands
): Promise<{ state: BrowserState; session: RestoreSession }> {
  const state = createBrowserState(commands, () => undefined, backups);
  await state.open(null);
  const withCandidate = await walkToACandidate(state, openRestore(state));
  return { state, session: prepareRestore(withCandidate, windowFor(state, withCandidate), () => withCandidate) };
} // End of function readyToConfirm()

/**
 * The session a confirmation was minted over — what a pane holds between its
 * `confirmRestore` and the answer, when it registers no receiver.
 *
 * `BrowserState.restoreDocument` takes a required reader since Phase 2d-6-6a; a
 * case that is not about displacement hands it this one, which answers what the
 * no-reader form checked and settled against before.
 *
 * @param started - What the confirmation produced.
 * @returns The confirmation's own session.
 */
function ownSessionOf(started: StartedRestore | null): RestoreSession {
  if (started === null) {
    throw new Error('a send with no permit reads no session');
  }
  return started.session;
} // End of function ownSessionOf()

/**
 * The reader for a send that holds no permit, which `BrowserState.restoreDocument`
 * answers before reading anything.
 *
 * @returns Nothing: it fails the case that reaches it.
 */
function neverRead(): RestoreSession {
  throw new Error('a send with no permit reads no session');
} // End of function neverRead()
/**
 * `sendRecoveryCreate` with the reader a panel passes: the form it was handed
 * until `install` is called, and the form `install` was last handed from then on.
 *
 * Phase 2d-6-6a made the reader required. A case that is not about displacement
 * still has to say what the caller holds, and what `RecoveryPanel.svelte` holds
 * is exactly this — the form it sent from, then the waiting form it installed —
 * so a case written before the reader existed keeps the behaviour it pinned: the
 * door checks the form handed in, and the answer is settled against the waiting
 * form. `install` is still called with every form it was called with before.
 *
 * @param session - The form to submit.
 * @param create - The boundary.
 * @param install - What the case does with the waiting form.
 * @returns What `sendRecoveryCreate` answers.
 */
function sendTracking(
  session: RecoverySession,
  create: CreateARecoveredSnippet,
  install: InstallTheWaitingForm
): Promise<RecoverySession> {
  let held = session;
  return sendRecoveryCreate(
    session,
    create,
    (waiting) => {
      held = waiting;
      install(waiting);
    },
    () => held
  );
} // End of function sendTracking()
/*
 * **`((onHand) => door(onHand, …, () => onHand))(value)`** is a door, a settling
 * transition or a reapply called with a reader answering the very session it is
 * handed — the installed session of a caller that registers no receiver. Phase
 * 2d-6-6a made the reader required; this is how a case that is not about
 * displacement says so without evaluating `value` twice. The cases that are about
 * displacement pass a holder's reader instead.
 */

/**
 * Sends a confirmed restore and requires an answer about the session.
 *
 * `BrowserState.restoreDocument` answers `null` when this call held no permit at all,
 * which two cases below assert deliberately; everywhere else a `null` would mean the
 * case sent nothing and every assertion after it would be about a session nobody
 * produced.
 *
 * @param state - The window.
 * @param started - What the confirmation produced.
 * @param invalidate - What the caller does about every write surface over the
 *   replaced file.
 * @param surfaces - Every write surface this window has open.
 * @returns The session the send answered with.
 */
async function restoreThrough(
  state: BrowserState,
  started: StartedRestore,
  invalidate: InvalidateEverySurface = () => undefined,
  surfaces: readonly OpenWriteSurface[] = []
): Promise<RestoreSession> {
  const answered = await state.restoreDocument(started, surfaces, invalidate, () => ownSessionOf(started));
  if (answered === null) {
    throw new Error('this send was expected to answer about the session');
  }
  return answered;
} // End of function restoreThrough()

/** A restore that the transaction refused, so the session stays askable. */
const RAW_REFUSED: CommandResult<SaveResult> = {
  ok: true,
  value: {
    outcome: 'refused',
    verdict: 'RefusedForUnacknowledgedSuspicions',
    findings: [suspicion()]
  }
};

/** A restore that wrote nothing because the candidate was the bytes already held. */
const RAW_UNCHANGED: CommandResult<SaveResult> = {
  ok: true,
  value: {
    outcome: 'saved',
    revision: 'rev-a',
    committed: false,
    notes: [],
    backup_taken: false,
    moved: null
  }
};

describe('reading the backup catalogue', () => {
  it('answers the batch listing and says nothing to the developer channel', async () => {
    const backups = scriptedBackups();
    const reported: IpcFailure[] = [];
    const state = createBrowserState(scriptedCommands(), (next) => reported.push(next), backups);
    await state.open(null);

    expect(await state.listBackupBatches()).toEqual({ ok: true, value: BACKUP_BATCHES });
    expect(backups.listBackupBatches).toHaveBeenCalledTimes(1);
    expect(reported).toEqual([]);
  }); // End of the "batch listing" case

  it('answers a refused batch listing and reports it as well', async () => {
    // Reported **and** answered, which is the shape every read on this state uses:
    // the developer channel gets it, and the caller gets it too so the refusal can
    // be put on a session and drawn. A read that only reported would leave the
    // catalogue looking like it had never been asked.
    const backups = scriptedBackups({ batches: [{ ok: false, failure: BACKUP_REFUSAL }] });
    const reported: IpcFailure[] = [];
    const state = createBrowserState(scriptedCommands(), (next) => reported.push(next), backups);
    await state.open(null);

    expect(await state.listBackupBatches()).toEqual({ ok: false, failure: BACKUP_REFUSAL });
    expect(reported).toEqual([BACKUP_REFUSAL]);
  }); // End of the "refused batch listing" case

  it('hands the batch identity to the command exactly as it was given', async () => {
    const backups = scriptedBackups();
    const state = createBrowserState(scriptedCommands(), () => undefined, backups);
    await state.open(null);

    expect(await state.listBackupEntries(RESTORE_BATCH)).toEqual({
      ok: true,
      value: BACKUP_ENTRIES
    });
    // **The same object, and `toBe` is what says so.** It is opaque, it is not
    // authority, and the command re-resolves it beneath the workspace-owned backup
    // folder. `toEqual` on the argument list passed a rebuilt but structurally equal
    // batch, so the record's claim that the identity arrives "as the very object it
    // was given" was evidence this suite did not hold — the 2c-5-4a review's Low.
    const call = vi.mocked(backups.listBackupEntries).mock.calls[0]!;
    expect(call).toHaveLength(1);
    expect(call[0]).toBe(RESTORE_BATCH);
  }); // End of the "entry listing" case

  it('answers a refused entry listing and reports it as well', async () => {
    const backups = scriptedBackups({ entries: [{ ok: false, failure: BACKUP_REFUSAL }] });
    const reported: IpcFailure[] = [];
    const state = createBrowserState(scriptedCommands(), (next) => reported.push(next), backups);
    await state.open(null);

    expect(await state.listBackupEntries(RESTORE_BATCH)).toEqual({
      ok: false,
      failure: BACKUP_REFUSAL
    });
    expect(reported).toEqual([BACKUP_REFUSAL]);
  }); // End of the "refused entry listing" case

  it('hands both arguments to the text read and answers the exact bytes', async () => {
    const backups = scriptedBackups();
    const state = createBrowserState(scriptedCommands(), () => undefined, backups);
    await state.open(null);

    const answer = await state.readBackupText(backupEntry().id, RESTORE_TARGET);

    expect(answer.ok).toBe(true);
    if (!answer.ok) {
      return;
    }
    // Byte for byte: the mark, both carriage returns and the trailing space.
    expect(answer.value.text).toBe(CANDIDATE);
    expect(answer.value.revision).toBe(CANDIDATE_REVISION);
    expect(vi.mocked(backups.readBackupText).mock.calls[0]).toEqual([
      backupEntry().id,
      RESTORE_TARGET
    ]);
  }); // End of the "text read" case

  it('answers a refused text read and reports it as well', async () => {
    const backups = scriptedBackups({ texts: [{ ok: false, failure: BACKUP_REFUSAL }] });
    const reported: IpcFailure[] = [];
    const state = createBrowserState(scriptedCommands(), (next) => reported.push(next), backups);
    await state.open(null);

    expect(await state.readBackupText(backupEntry().id, RESTORE_TARGET)).toEqual({
      ok: false,
      failure: BACKUP_REFUSAL
    });
    expect(reported).toEqual([BACKUP_REFUSAL]);
  }); // End of the "refused text read" case

  it('remembers nothing about a read, and disturbs nothing this window holds', async () => {
    // **Three asks, three commands.** Nothing here caches a listing or records that
    // one was asked for: the catalogue lives on a `RestoreSession`, which is what
    // makes calling this again the way to ask again. And all three reads leave the
    // projections, the selection and the viewer's snapshot exactly as they were —
    // they read a folder, and say nothing about the workspace.
    const backups = scriptedBackups();
    const commands = scriptedCommands();
    const state = createBrowserState(commands, () => undefined, backups);
    await state.open(null);
    state.show({ kind: 'document', id: RESTORE_TARGET });
    await state.select(baseDocument().matches[0]!);
    await state.showFileText(true);
    const heldRevision = state.scopedDocument?.revision;
    const heldSelection = state.selected;

    await state.listBackupBatches();
    await state.listBackupBatches();
    await state.listBackupBatches();
    await state.listBackupEntries(RESTORE_BATCH);
    await state.readBackupText(backupEntry().id, RESTORE_TARGET);
    await state.readBackupText(backupEntry().id, RESTORE_TARGET);

    expect(backups.listBackupBatches).toHaveBeenCalledTimes(3);
    expect(backups.listBackupEntries).toHaveBeenCalledTimes(1);
    expect(backups.readBackupText).toHaveBeenCalledTimes(2);
    expect(state.scopedDocument?.revision).toBe(heldRevision);
    expect(state.selected).toBe(heldSelection);
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
    expect(commands.documentText).toHaveBeenCalledTimes(1);
  }); // End of the "nothing remembered" case
}); // End of the "reading the backup catalogue" suite

describe('an answer that lands while a restore is being written', () => {
  it('drops a candidate read, and the same wrapper is how it is asked for again', async () => {
    // **2c-5-3's first handed-forward obligation.** A send in flight freezes the
    // catalogue, the selection and the candidate — that is what
    // `browser.restore.refused.inFlight` promises — so an answer that lands then is
    // dropped rather than installed under a submission already on its way. What
    // step 4 owes is a way to ask again, and it is this method: the coordinator
    // remembers nothing about a read, so calling it again really does ask again.
    const backups = scriptedBackups({
      texts: [
        { ok: true, value: backupText() },
        { ok: true, value: backupText(SECOND_CANDIDATE, SECOND_CANDIDATE_REVISION) },
        { ok: true, value: backupText(SECOND_CANDIDATE, SECOND_CANDIDATE_REVISION) }
      ]
    });
    const { state, session } = await readyToConfirm(
      scriptedCommands({ raws: [RAW_REFUSED] }),
      backups
    );
    const started = confirmRestore(session, windowFor(state, session), () => session);
    expect(started).not.toBeNull();
    if (started === null) {
      return;
    }
    const inFlight = started.session;

    // The second read really happens, and the model really drops it.
    const dropped = await takeTheCandidate(state, inFlight);
    expect(dropped).toBe(inFlight);
    expect(candidateText(inFlight.preview!)).toBe(CANDIDATE);

    const answered = await restoreThrough(state, started);
    expect(answered.phase).toBe('editing');
    expect(answered.restored).toBe(false);

    // Asked again, and installed this time.
    const again = await takeTheCandidate(state, answered);
    expect(candidateText(again.preview!)).toBe(SECOND_CANDIDATE);
    expect(backups.readBackupText).toHaveBeenCalledTimes(3);
  }); // End of the "dropped candidate" case

  it('drops a batch listing, and the same wrapper is how it is asked for again', async () => {
    const backups = scriptedBackups();
    const { state, session } = await readyToConfirm(
      scriptedCommands({ raws: [RAW_REFUSED] }),
      backups
    );
    const started = confirmRestore(session, windowFor(state, session), () => session);
    if (started === null) {
      throw new Error('this confirmation was expected to be produced');
    }
    const inFlight = started.session;

    const dropped = batchesLoaded(inFlight, await state.listBackupBatches());
    expect(dropped).toBe(inFlight);

    const answered = await restoreThrough(state, started);
    const again = batchesLoaded(loadingBatches(answered), await state.listBackupBatches());

    expect(again.batches).toEqual({ kind: 'loaded', listing: BACKUP_BATCHES });
    // Three: the walk to the candidate, the dropped ask, and the ask again.
    expect(backups.listBackupBatches).toHaveBeenCalledTimes(3);
  }); // End of the "dropped batch listing" case
}); // End of the "answer landing during a send" suite

describe('sending a confirmed restore', () => {
  it('sends nothing at all when no confirmation was produced', async () => {
    // **The proof that no save is issued without a confirmation**, watched rather
    // than argued from the shape of a signature: the sender is a spy, and the arm
    // that answers "nothing was attempted" must never have reached it.
    //
    // `null` comes back rather than a session, and that is the whole of what this
    // call can honestly say: there is no confirmation, so there is no session it
    // could describe, and the caller keeps the one it walked to a candidate with.
    const commands = scriptedCommands({ raws: [RAW_COMMITTED] });
    const state = createBrowserState(commands, () => undefined, scriptedBackups());
    await state.open(null);
    const session = await walkToACandidate(state, openRestore(state));
    const invalidations: RawSaveInvalidation[] = [];

    const answered = await state.restoreDocument(null, [], (invalidation) => {
      invalidations.push(invalidation);
    }, () => neverRead());

    expect(answered).toBeNull();
    expect(session.phase).toBe('editing');
    expect(commands.saveRawDocument).not.toHaveBeenCalled();
    expect(invalidations).toEqual([]);
  }); // End of the "no confirmation" case

  it('sends nothing when this window re-read the file after the confirmation', async () => {
    // **The revision half of the observation is this state's own answer.** The
    // caller passes only its open surfaces; the revision comes from
    // `revisionInProjection` over the projections this state holds, read here. So a
    // caller that would have handed back the session's own frozen base — which is
    // the hole `restore.ts` records as unforceable — cannot: the window really did
    // move, and the permit is refused.
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({
      documents,
      raws: [RAW_COMMITTED],
      reload: { ok: true, value: replacedDocument() }
    });
    const { state, session } = await readyToConfirm(commands, scriptedBackups());
    const started = confirmRestore(session, windowFor(state, session), () => session);
    if (started === null) {
      throw new Error('this confirmation was expected to be produced');
    }

    expect(await state.rereadDocument(RESTORE_TARGET)).toBeNull();
    expect(revisionInProjection(state.views, RESTORE_TARGET)).toBe('rev-c');

    const answered = await restoreThrough(state, started);

    expect(commands.saveRawDocument).not.toHaveBeenCalled();
    // **And what comes back is askable, which is the 2c-5-4a review's Medium.** The
    // confirmation put this session in `saving`, and the model makes every editing
    // transition a no-op while it is there — so returning it unchanged left a screen
    // claiming a send was in flight when no command had run, with nothing that could
    // take it anywhere. The candidate is kept, the phase is back, and the refusal a
    // panel would draw is the one that is actually true of the window now.
    expect(answered.phase).toBe('editing');
    expect(answered.inFlight).toBeNull();
    expect(candidateText(answered.preview!)).toBe(CANDIDATE);
    expect(restoreRefusal(answered, windowFor(state, answered))).toEqual({
      kind: 'targetMoved'
    });
    // The person really can act on it: re-measuring against what this window now
    // projects is a transition the frozen session refused outright.
    const remeasured = targetRevisionObserved(
      answered,
      revisionInProjection(state.views, RESTORE_TARGET)
    );
    expect(remeasured.baseRevision).toBe('rev-c');
    expect(restoreRefusal(remeasured, windowFor(state, remeasured))).toBeNull();
  }); // End of the "window moved after the confirmation" case

  it('spends the permit on a mismatch, so the same confirmation cannot be retried', async () => {
    // **Consent is for one attempt.** A permit that no longer describes the session
    // and the window is consumed by that mismatch rather than left behind, so a
    // caller that repairs whatever moved and hands the same confirmation over again
    // sends nothing: it asks again, which is `prepareRestore` and `confirmRestore`
    // over the repaired session. The second call held no permit at all, so it has
    // nothing to say about any session and answers `null`.
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({
      documents,
      raws: [RAW_COMMITTED],
      reload: { ok: true, value: replacedDocument() }
    });
    const { state, session } = await readyToConfirm(commands, scriptedBackups());
    const started = confirmRestore(session, windowFor(state, session), () => session);
    if (started === null) {
      throw new Error('this confirmation was expected to be produced');
    }
    expect(await state.rereadDocument(RESTORE_TARGET)).toBeNull();

    const withdrawn = await restoreThrough(state, started);
    expect(withdrawn.phase).toBe('editing');

    const again = await state.restoreDocument(started, [], () => undefined, () => ownSessionOf(started));

    expect(again).toBeNull();
    expect(commands.saveRawDocument).not.toHaveBeenCalled();
  }); // End of the "mismatch spends the permit" case

  it('spends one permit on one write when a surface read re-enters the send', async () => {
    // **The 2c-5-4a review's High, driven rather than argued.** `permitHolds` reads
    // a dozen properties off the session and the context, and the open surfaces are
    // the caller's own array — a plain one here, and a proxy whenever a component
    // holds it in a `$state`. A trap on it re-enters this method synchronously,
    // *while the outer call is still validating*: the inner call validates, spends
    // the permit and reaches the sender before the outer `permitHolds` has
    // returned. With the
    // permit's deletion unchecked the outer call then sent as well, so one
    // confirmation replaced the whole file twice. The deletion's own result is now
    // the authorization, so the outer call finds nothing to spend.
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, raws: [RAW_COMMITTED, RAW_COMMITTED] });
    const { state, session } = await readyToConfirm(commands, scriptedBackups());
    const started = confirmRestore(session, windowFor(state, session), () => session);
    if (started === null) {
      throw new Error('this confirmation was expected to be produced');
    }
    documents.set(RESTORE_TARGET, { ok: true, value: replacedDocument() });
    const inner: Promise<RestoreSession | null>[] = [];
    let entered = false;
    // A proxy over the empty surface list. `competingSurfaceFor` iterates it, which
    // is the last thing `permitHolds` does — so the trap fires after every other
    // check has passed and before the permit is spent, which is exactly the window
    // the finding names.
    const surfaces = new Proxy([] as OpenWriteSurface[], {
      get(target, property, receiver): unknown {
        if (!entered && property === Symbol.iterator) {
          entered = true;
          inner.push(state.restoreDocument(started, [], () => undefined, () => ownSessionOf(started)));
        }
        return Reflect.get(target, property, receiver);
      } // End of function get()
    });

    const answered = await state.restoreDocument(started, surfaces, () => undefined, () => ownSessionOf(started));
    const reentrant = await Promise.all(inner);

    // The trap really fired, so this is the re-entrant case and not one that never
    // re-entered at all.
    expect(entered).toBe(true);
    expect(reentrant).toHaveLength(1);
    // **One write for one confirmation.** Two would be two whole-file replacements.
    expect(commands.saveRawDocument).toHaveBeenCalledTimes(1);
    // And exactly one of the two calls answers about the session: the one that spent
    // the permit. The other held none and says so.
    const sessions = [answered, ...reentrant].filter((one) => one !== null);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.restored).toBe(true);
  }); // End of the "re-entrant send" case

  it('spends one confirmation on one write, however often it is handed over', async () => {
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, raws: [RAW_COMMITTED, RAW_COMMITTED] });
    const { state, session } = await readyToConfirm(commands, scriptedBackups());
    const started = confirmRestore(session, windowFor(state, session), () => session);
    if (started === null) {
      throw new Error('this confirmation was expected to be produced');
    }
    documents.set(RESTORE_TARGET, { ok: true, value: replacedDocument() });

    await restoreThrough(state, started);
    const twice = await state.restoreDocument(started, [], () => undefined, () => ownSessionOf(started));

    // The second call held no permit, so it says nothing about the session: the one
    // the first call answered with is the one the caller is holding, and handing
    // back the confirmation's frozen snapshot would have replaced it.
    expect(twice).toBeNull();
    expect(commands.saveRawDocument).toHaveBeenCalledTimes(1);
  }); // End of the "one confirmation, one write" case

  it('writes the candidate byte for byte, at the base the confirmation froze', async () => {
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, raws: [RAW_COMMITTED] });
    const { state, session } = await readyToConfirm(commands, scriptedBackups());
    const started = confirmRestore(session, windowFor(state, session), () => session);
    if (started === null) {
      throw new Error('this confirmation was expected to be produced');
    }
    documents.set(RESTORE_TARGET, { ok: true, value: replacedDocument() });
    const invalidations: RawSaveInvalidation[] = [];

    const answered = await restoreThrough(state, started, (invalidation) => {
      invalidations.push(invalidation);
    });

    const call = vi.mocked(commands.saveRawDocument).mock.calls[0]!;
    expect(call[0]).toBe(RESTORE_TARGET);
    // The base the confirmation froze, never one re-read just before sending.
    expect(call[1]).toBe(OPEN_REVISION);
    // The mark, both carriage returns and the trailing space, unchanged.
    expect(call[2]).toBe(CANDIDATE);
    expect(call[3]).toEqual(NOTHING_ACKNOWLEDGED);
    // The caller's whole-document invalidation ran, once, naming the file and the
    // revision it now holds.
    expect(invalidations).toEqual([{ document: RESTORE_TARGET, revision: 'rev-c' }]);
    expect(answered.restored).toBe(true);
    expect(answered.outcome?.kind).toBe('saved');
    expect(answered.extraMessages).toEqual([]);
    // And the window really moved: the projection is of the bytes that were
    // written, which is `saveRawDocument`'s own invalidation rather than this one.
    expect(state.views.find((view) => view.id === RESTORE_TARGET)?.revision).toBe('rev-c');
  }); // End of the "committed restore" case

  it('does not call the caller’s invalidation when nothing was written', async () => {
    // `committed: false` is a documented success in which the candidate was
    // byte-identical to what the file already held. Nothing became stale, so no
    // surface has to be closed and `restored` stays false — this session did not
    // carry a replacement out.
    const commands = scriptedCommands({ raws: [RAW_UNCHANGED] });
    const { state, session } = await readyToConfirm(commands, scriptedBackups());
    const started = confirmRestore(session, windowFor(state, session), () => session);
    if (started === null) {
      throw new Error('this confirmation was expected to be produced');
    }
    const invalidations: RawSaveInvalidation[] = [];

    const answered = await restoreThrough(state, started, (invalidation) => {
      invalidations.push(invalidation);
    });

    expect(commands.saveRawDocument).toHaveBeenCalledTimes(1);
    expect(invalidations).toEqual([]);
    expect(answered.outcome?.kind).toBe('saved');
    expect(answered.restored).toBe(false);
  }); // End of the "committed: false" case

  it('shows a conflict and installs nothing in this window', async () => {
    const conflict = makeConflict({ expected: OPEN_REVISION, disk: replacedDocument() });
    const commands = scriptedCommands({ raws: [{ ok: true, value: conflict }] });
    const { state, session } = await readyToConfirm(commands, scriptedBackups());
    const started = confirmRestore(session, windowFor(state, session), () => session);
    if (started === null) {
      throw new Error('this confirmation was expected to be produced');
    }

    const answered = await restoreThrough(state, started);

    expect(answered.outcome?.kind).toBe('conflict');
    expect(answered.restored).toBe(false);
    // Nothing was written and nothing was installed: the projection is still the
    // one the person was reading, and only a confirmed reload moves it.
    expect(state.views.find((view) => view.id === RESTORE_TARGET)?.revision).toBe(OPEN_REVISION);
  }); // End of the "conflict" case

  it('carries a refusal’s findings back on the second attempt', async () => {
    const shown = suspicion();
    const refused: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'refused',
        verdict: 'RefusedForUnacknowledgedSuspicions',
        findings: [shown]
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, raws: [refused, RAW_COMMITTED] });
    const { state, session } = await readyToConfirm(commands, scriptedBackups());
    const first = confirmRestore(session, windowFor(state, session), () => session);
    if (first === null) {
      throw new Error('this confirmation was expected to be produced');
    }

    const answered = await restoreThrough(state, first);
    expect(answered.outcome?.kind).toBe('refused');

    // The acknowledgement is produced by the session from the refusal it is
    // showing, never assembled by a caller — and it withdraws the question, so the
    // person is asked again before anything is sent.
    const consented = acknowledgeRestoreFindings(answered);
    const asked = prepareRestore(consented, windowFor(state, consented), () => consented);
    const second = confirmRestore(asked, windowFor(state, asked), () => asked);
    if (second === null) {
      throw new Error('this second confirmation was expected to be produced');
    }
    documents.set(RESTORE_TARGET, { ok: true, value: replacedDocument() });
    const committed = await restoreThrough(state, second);

    expect(commands.saveRawDocument).toHaveBeenCalledTimes(2);
    expect(vi.mocked(commands.saveRawDocument).mock.calls[1]![3]).toEqual({ accepted: [shown] });
    // And still the same bytes, at the same base.
    expect(vi.mocked(commands.saveRawDocument).mock.calls[1]![2]).toBe(CANDIDATE);
    expect(vi.mocked(commands.saveRawDocument).mock.calls[1]![1]).toBe(OPEN_REVISION);
    expect(committed.restored).toBe(true);
  }); // End of the "acknowledged refusal" case

  it('says the file may already hold the candidate when the send itself failed', async () => {
    // Not an outcome, and not "nothing was written": a failure at or after the
    // rename may have left the candidate on disk, and this window cannot tell.
    const failure: IpcFailure = {
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
    };
    const commands = scriptedCommands({ raws: [{ ok: false, failure }] });
    const { state, session } = await readyToConfirm(commands, scriptedBackups());
    const started = confirmRestore(session, windowFor(state, session), () => session);
    if (started === null) {
      throw new Error('this confirmation was expected to be produced');
    }

    const answered = await restoreThrough(state, started);

    expect(answered.phase).toBe('editing');
    expect(answered.outcome).toBeNull();
    // The arm that claims less: this window cannot tell, and says so, rather than
    // reporting that nothing was written.
    expect(answered.sendFailure?.kind).toBe('mayHaveWritten');
    // And the reason is `null` here rather than the classified failure: a
    // whole-document save's failed arm carries only `mayHaveWritten`, which is the
    // raw editor's identical limit and not this step's to widen.
    expect(answered.sendFailure?.reason).toBeNull();
    expect(answered.restored).toBe(false);
  }); // End of the "uncertain send" case

  it('keeps a committed restore committed when the caller’s invalidation throws', async () => {
    // **`PROGRESS.md` D2, one surface along.** The bytes are on disk and stay
    // there; what failed is this window's own forgetting, and it comes back as a
    // line **beside** the committed outcome rather than in place of it.
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, raws: [RAW_COMMITTED] });
    const { state, session } = await readyToConfirm(commands, scriptedBackups());
    const started = confirmRestore(session, windowFor(state, session), () => session);
    if (started === null) {
      throw new Error('this confirmation was expected to be produced');
    }
    documents.set(RESTORE_TARGET, { ok: true, value: replacedDocument() });

    const answered = await restoreThrough(state, started, () => {
      throw new Error('a surface refused to close');
    });

    expect(answered.outcome?.kind).toBe('saved');
    expect(answered.restored).toBe(true);
    expect(answered.extraMessages).toHaveLength(1);
  }); // End of the "invalidation threw" case
}); // End of the "sending a confirmed restore" suite

/**
 * Lets every queued microtask run, so the drain pump can make progress.
 *
 * `BrowserState.start()` and `open()` both *request* a drain and return; the
 * coordinator's pump yields once before its first call so that triggers arriving
 * together coalesce. **It waits for the queue and not for the coordinator**: a
 * drain that never happened is a failed count rather than a hung case.
 *
 * @returns A promise that resolves once the queue has drained ten times.
 */
async function settleDrains(): Promise<void> {
  for (let turn = 0; turn < 10; turn += 1) {
    await Promise.resolve();
  } // End of the loop that lets the microtask queue run
} // End of function settleDrains()

/**
 * A wake transport this file drives, with an exact unlisten count.
 */
interface TestEvents {
  /** What `createBrowserState` is given. */
  readonly source: ReconciliationEventSource;
  /**
   * How many times the unlisten was called.
   *
   * @returns The count.
   */
  unlistens(): number;
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
 * @returns The source and the handles that drive it.
 */
function testEvents(): TestEvents {
  let handler: ReconciliationWakeHandler | null = null;
  let unlistens = 0;
  /**
   * Ends the subscription and counts the call.
   */
  const unlisten = (): void => {
    unlistens += 1;
  };
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
    unlistens: (): number => unlistens,
    wake: (epoch: number, newest: number): void => {
      handler?.({ workspace_epoch: epoch, newest_sequence: newest });
    }
  };
} // End of function testEvents()

/**
 * A foreground transport this file can signal through.
 */
interface TestForeground {
  /** What `createBrowserState` is given. */
  readonly source: ForegroundSource;
  /** Signals a foreground or resume. */
  signal(): void;
}

/**
 * Builds a foreground transport this file drives.
 *
 * @returns The source and the handle that signals it.
 */
function testForeground(): TestForeground {
  let handler: (() => void) | null = null;
  return {
    source: {
      /**
       * Registers synchronously.
       *
       * @param onForeground - Where a signal goes.
       * @returns The unsubscribe.
       */
      subscribe(onForeground: () => void): () => void {
        handler = onForeground;
        return (): void => {
          handler = null;
        };
      }
    },
    signal: (): void => {
      handler?.();
    }
  };
} // End of function testForeground()

/**
 * One batch, with only what a case is about spelled out.
 *
 * @param overrides - Whatever the case cares about.
 * @returns A successful command answer carrying it.
 */
function reconciliationBatch(
  overrides: Partial<ReconciliationBatch> = {}
): CommandResult<ReconciliationBatch> {
  return {
    ok: true,
    value: { epoch: 5, newest_sequence: 0, observations: [], discarded: 0, ...overrides }
  };
} // End of function reconciliationBatch()

describe('the reconciliation lifecycle', () => {
  it('drains nothing until start is called, however many opens there are', async () => {
    // The default budget, stated rather than inherited: this is the case that says
    // every other case in this file is honest about draining zero times, and it
    // says it for a state whose `open()` really did reach `ready`.
    const state = createBrowserState(scriptedCommands(), () => undefined);
    await state.open(null);
    await state.open(null);
    await settleDrains();

    expect(state.status).toBe('ready');
    state.dispose();
  }); // End of the no-start case

  it('drains once when the injected registration resolves', async () => {
    expectDrains([0]);
    const events = testEvents();
    const state = createBrowserState(
      scriptedCommands({ drains: [reconciliationBatch({ newest_sequence: 4 })] }),
      () => undefined,
      undefined,
      events.source
    );
    state.start();
    await settleDrains();

    expect(drainSequences).toEqual([0]);
    state.dispose();
    expect(events.unlistens()).toBe(1);
  }); // End of the registration-drain case

  it('counts a drain the scripted queue had no answer for', async () => {
    // The negative control of the `afterEach`'s fourth budget question, found by
    // the 2d-5-6 review: one answer is scripted and the surface is drained twice,
    // directly, so the second call is what the fallback refusal answers. The
    // cursor budget and the pending count both come out clean — which is exactly
    // the false green the counter exists to catch.
    expectDrains([0, 0]);
    const commands = scriptedCommands({ drains: [reconciliationBatch({ newest_sequence: 4 })] });

    const first = await commands.drainExternalChanges(0);
    const second = await commands.drainExternalChanges(0);

    expect(first.ok).toBe(true);
    expect(second).toEqual({
      ok: false,
      failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
    });
    expect(drainsPending).toBe(0);
    expect(drainsUnscripted).toBe(1);

    // This case provoked the count on purpose and is the one case allowed to clear
    // it before the `afterEach` reads it. Nothing in Vitest prevents another case
    // from copying this line; a reviewer reading a second one has found a case
    // hiding an unscripted drain.
    drainsUnscripted = 0;
  }); // End of the unscripted-drain negative control

  it('drains again once a workspace reaches ready', async () => {
    expectDrains([0, 0]);
    const events = testEvents();
    const state = createBrowserState(
      scriptedCommands({
        drains: [reconciliationBatch({ newest_sequence: 6 }), reconciliationBatch({ newest_sequence: 6 })]
      }),
      () => undefined,
      undefined,
      events.source
    );
    state.start();
    await settleDrains();
    await state.open(null);
    await settleDrains();

    // **Two calls, and the second asks `0` rather than `4`** — which is the wiring
    // this case exists for. `open()` clears the session cursor at its entry, so the
    // watermark the registration's answer established belongs to the workspace that
    // was just closed and is not asked with again. The case below shows the other
    // half, where nothing intervenes and the watermark really is carried.
    expect(drainSequences).toEqual([0, 0]);
    state.dispose();
  }); // End of the open-drain case

  it('drains for no failed open, and holds later triggers behind the gate it left closed', async () => {
    expectDrains([0]);
    const failure: IpcFailure = { kind: 'command', error: { code: 'noWorkspaceOpen' } };
    const events = testEvents();
    const state = createBrowserState(
      scriptedCommands({
        open: { ok: false, failure },
        drains: [reconciliationBatch({ newest_sequence: 6 })]
      }),
      () => undefined,
      undefined,
      events.source
    );
    state.start();
    await settleDrains();
    expect(drainSequences).toEqual([0]);

    // **The half the case above does not cover.** `open()` closes the drain gate at
    // its entry and only `workspaceReady()` opens one; a refused `open_workspace`
    // returns before that call, so this open both requests no drain of its own and
    // leaves the gate closed. Put `workspaceReady()` on that failure arm and the
    // expectation below reads `[0, 0]`.
    await state.open(null);
    await settleDrains();
    expect(state.status).toBe('failed');
    expect(drainSequences).toEqual([0]);

    // And the gate is what holds it, rather than the mere absence of a trigger: a
    // wake arriving afterwards is recorded and issues nothing, where the same wake
    // after an open that reached `ready` drains.
    events.wake(5, 12);
    await settleDrains();

    expect(drainSequences).toEqual([0]);
    state.dispose();
  }); // End of the failed-open case

  it('drains for an open that completes before start, in one call', async () => {
    expectDrains([0]);
    const events = testEvents();
    const state = createBrowserState(
      scriptedCommands({ drains: [reconciliationBatch()] }),
      () => undefined,
      undefined,
      events.source
    );
    // Open first: the request is recorded and nothing is drained, because the
    // lifecycle has not begun. Losing it would leave this order with no drain.
    await state.open(null);
    await settleDrains();
    expect(drainSequences).toEqual([]);

    state.start();
    await settleDrains();

    expect(drainSequences).toEqual([0]);
    state.dispose();
  }); // End of the open-before-start case

  it('drains for a wake at the current epoch and for nothing else', async () => {
    expectDrains([0, 11]);
    const events = testEvents();
    const state = createBrowserState(
      scriptedCommands({
        drains: [
          reconciliationBatch({ epoch: 5, newest_sequence: 11 }),
          reconciliationBatch({ epoch: 5, newest_sequence: 12 })
        ]
      }),
      () => undefined,
      undefined,
      events.source
    );
    state.start();
    await settleDrains();

    events.wake(99, 40);
    await settleDrains();
    expect(drainSequences).toEqual([0]);

    events.wake(5, 12);
    await settleDrains();
    expect(drainSequences).toEqual([0, 11]);
    state.dispose();
  }); // End of the wake case

  it('drains on a foreground signal', async () => {
    expectDrains([0, 2]);
    const events = testEvents();
    const activity = testForeground();
    const state = createBrowserState(
      scriptedCommands({ drains: [reconciliationBatch({ newest_sequence: 2 }), reconciliationBatch()] }),
      () => undefined,
      undefined,
      events.source,
      activity.source
    );
    state.start();
    await settleDrains();

    activity.signal();
    await settleDrains();

    expect(drainSequences).toEqual([0, 2]);
    state.dispose();
  }); // End of the foreground case

  it('clears the session cursor at the entry of every open', async () => {
    expectDrains([0, 9, 0]);
    const events = testEvents();
    const state = createBrowserState(
      scriptedCommands({
        drains: [
          reconciliationBatch({ newest_sequence: 9 }),
          reconciliationBatch({ newest_sequence: 9 }),
          reconciliationBatch({ newest_sequence: 3 })
        ]
      }),
      () => undefined,
      undefined,
      events.source
    );
    state.start();
    await settleDrains();
    expect(drainSequences).toEqual([0]);

    // Nothing intervenes here, so the second drain really does carry the watermark
    // the first answer established.
    events.wake(5, 10);
    await settleDrains();
    expect(drainSequences).toEqual([0, 9]);

    // A second workspace: the epoch belongs to the lifecycle being closed and the
    // watermark indexes its queue, so the next drain starts from nothing again.
    await state.open(null);
    await settleDrains();

    expect(drainSequences).toEqual([0, 9, 0]);
    state.dispose();
  }); // End of the cursor-cleared-by-open case

  it('stops draining once disposed, and unlistens exactly once', async () => {
    expectDrains([0]);
    const events = testEvents();
    const activity = testForeground();
    const state = createBrowserState(
      scriptedCommands({ drains: [reconciliationBatch({ newest_sequence: 7 })] }),
      () => undefined,
      undefined,
      events.source,
      activity.source
    );
    state.start();
    await settleDrains();
    expect(drainSequences).toEqual([0]);

    state.dispose();
    state.dispose();
    events.wake(5, 8);
    activity.signal();
    await state.open(null);
    await settleDrains();

    expect(drainSequences).toEqual([0]);
    expect(events.unlistens()).toBe(1);
  }); // End of the disposal case

  it('registers nothing through the inert default source, and still drains on an open', async () => {
    expectDrains([0]);
    // No event source injected: `createBrowserState` defaults to the inert one,
    // which refuses rather than reporting a subscription this application does not
    // have. The other triggers are unaffected, which is the honest description of
    // a window with no wake transport — a state a test builds this way, and not
    // the shipped window, since `AppShell.svelte` injects the real one (2d-5-7a).
    const state = createBrowserState(
      scriptedCommands({ drains: [reconciliationBatch()] }),
      () => undefined
    );
    state.start();
    await settleDrains();
    expect(drainSequences).toEqual([]);

    await state.open(null);
    await settleDrains();

    expect(drainSequences).toEqual([0]);
    state.dispose();
  }); // End of the inert-default case
}); // End of the "reconciliation lifecycle" suite

/**
 * One document arm naming a file the open workspace resolves.
 *
 * @param document - The identity.
 * @param relativePath - Its path, for display.
 * @returns The arm.
 */
function addressable(document: DocumentId, relativePath: string): ObservedDocument {
  return { Addressable: { document, relative_path: relativePath } };
} // End of function addressable()

/**
 * One `Changed` observation whose bytes projected.
 *
 * @param sequence - The sequence it was admitted under.
 * @param document - Which document arm.
 * @returns The observation.
 */
function changedObservation(
  sequence: number,
  document: ObservedDocument
): ExternalObservation {
  return {
    Changed: {
      sequence,
      document,
      previous_revision: 'rev-before',
      disk_revision: 'rev-disk',
      content: {
        Projected: {
          disk_text: 'matches: []\n',
          disk: baseDocument(),
          findings: [],
          correspondences: null
        }
      }
    }
  };
} // End of function changedObservation()

/**
 * One `Removed` observation.
 *
 * @param sequence - The sequence it was admitted under.
 * @param document - Which document arm.
 * @returns The observation.
 */
function removedObservation(
  sequence: number,
  document: ObservedDocument
): ExternalObservation {
  return { Removed: { sequence, document, previous_revision: null } };
} // End of function removedObservation()

/** What a `PermissionDenied` looks like on the wire. */
const DENIED: UnreadableReason = { PermissionDenied: {} };

/**
 * One `Unreadable` observation.
 *
 * **The one arm that moves none of the host's three reread captures**, which is
 * what makes it the arm an in-flight read can overwrite: it installs nothing and
 * invalidates no projection, so a read that was already out still reaches its
 * installation block with every capture intact.
 *
 * @param sequence - The sequence it was admitted under.
 * @param document - Which document arm.
 * @returns The observation.
 */
function unreadableObservation(
  sequence: number,
  document: ObservedDocument
): ExternalObservation {
  return { Unreadable: { sequence, document, reason: DENIED } };
} // End of function unreadableObservation()

/**
 * The projection `reload_document` answers with when a case wants a visible
 * change.
 *
 * One snippet nothing else in this file mints, so "the reread installed" is an
 * assertion about a node number rather than about a length.
 *
 * @returns A projection of `match/base.yml` holding one new snippet.
 */
function rereadBaseDocument(): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    matches: [makeMatch({ node: 77, document: 2, trigger: ':fresh', label: 'From disk' })]
  });
} // End of function rereadBaseDocument()

/**
 * Asserts that nothing this batch did reached a command that writes a file.
 *
 * **The explicit zero-save-command assertion Phase 2d-5-4 owes.** Ruling 27 says
 * no save command may ever be initiated by watcher arbitration, and the type of
 * `ReconciliationWorkspace` is what makes that structural — this is the negative
 * spy that establishes it anyway, because a type says nothing about a future edit
 * that widens it.
 *
 * @param commands - The scripted surface the state was built over.
 */
function expectNoSaveCommand(commands: BrowserCommands): void {
  expect(commands.saveMatch).not.toHaveBeenCalled();
  expect(commands.createMatch).not.toHaveBeenCalled();
  expect(commands.deleteMatch).not.toHaveBeenCalled();
  expect(commands.moveMatch).not.toHaveBeenCalled();
  expect(commands.duplicateMatch).not.toHaveBeenCalled();
  expect(commands.saveRawDocument).not.toHaveBeenCalled();
} // End of function expectNoSaveCommand()

/**
 * How many times each reading command of the open workspace has been called.
 *
 * **Every one of the six, never a chosen two.** Ruling 28's negative half is that
 * *no* open-workspace document command is reached from an identity the workspace
 * does not resolve, and a case that names `get_document` and `open_workspace`
 * leaves the other four able to grow a route silently. This is the whole set the
 * boundary offers; the writing six are {@link expectNoSaveCommand}'s.
 *
 * @param commands - The scripted surface the state was built over.
 * @returns One count per command.
 */
function documentCommandCounts(commands: BrowserCommands): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const name of [
    'openWorkspace',
    'listDocuments',
    'getDocument',
    'getMatch',
    'reloadDocument',
    'documentText'
  ] as const) {
    counts[name] = (commands[name] as ReturnType<typeof vi.fn>).mock.calls.length;
  } // End of the loop over every reading command of the open workspace
  return counts;
} // End of function documentCommandCounts()

/**
 * Asserts that not one reading command has been called since a baseline.
 *
 * **The baseline has to be taken before the observations are delivered**, which
 * is what a controlled wake is for: a count snapshotted *after* the batch has been
 * processed already contains any erroneous call the batch made, and comparing it
 * with itself is an assertion that cannot fail.
 *
 * @param commands - The scripted surface.
 * @param baseline - What {@link documentCommandCounts} answered before the batch.
 */
function expectNoDocumentCommandSince(
  commands: BrowserCommands,
  baseline: Record<string, number>
): void {
  expect(documentCommandCounts(commands)).toEqual(baseline);
} // End of function expectNoDocumentCommandSince()

describe('the observation transitions', () => {
  it('rereads a changed file no open surface may be about', async () => {
    expectDrains([0, 0]);
    const events = testEvents();
    const commands = scriptedCommands({
      reload: { ok: true, value: rereadBaseDocument() },
      drains: [
        reconciliationBatch(),
        reconciliationBatch({
          newest_sequence: 5,
          observations: [changedObservation(5, addressable(2, 'match/base.yml'))]
        })
      ]
    });
    const state = createBrowserState(commands, () => undefined, undefined, events.source);
    state.start();
    await settleDrains();
    await state.open(null);
    await settleDrains();
    await settleDrains();

    // The clean path of the consult's Q5: the reread installed, and what is on
    // screen is the projection `reload_document` answered rather than the one the
    // batch carried.
    expect(commands.reloadDocument).toHaveBeenCalledWith(2);
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([77, 20]);
    expect(state.externalDocumentStatus(2)).toBeNull();
    expectNoSaveCommand(commands);
    state.dispose();
  }); // End of the clean-reread case

  it('tells the open surface instead, and installs nothing', async () => {
    expectDrains([0, 0]);
    const events = testEvents();
    const told: number[] = [];
    const commands = scriptedCommands({
      reload: { ok: true, value: rereadBaseDocument() },
      drains: [
        reconciliationBatch(),
        reconciliationBatch({
          newest_sequence: 5,
          observations: [changedObservation(5, addressable(2, 'match/base.yml'))]
        })
      ]
    });
    const state = createBrowserState(commands, () => undefined, undefined, events.source);
    state.start();
    await settleDrains();
    // **Registered before the batch carrying the observation arrives**, which is
    // the case this is: a surface already open when the watcher reports a change.
    // The race in which one opens *during* the read is its own case below.
    const lease = state.registerWriteSurface(
      { kind: 'matchEditor', target: { kind: 'document', document: 2 } },
      (observation) => {
        told.push(observation.sequence);
      }
    );
    await state.open(null);
    await settleDrains();
    await settleDrains();

    // Ruling 19's conservative sentence, as behaviour: a surface capable of
    // writing this file is open, and this window cannot tell whether it has been
    // edited, so nothing is reloaded.
    expect(commands.reloadDocument).not.toHaveBeenCalled();
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11, 20]);
    expect(told).toEqual([5]);
    expect(state.externalDocumentStatus(2)).toEqual({ kind: 'stale' });
    expectNoSaveCommand(commands);
    lease();
    state.dispose();
  }); // End of the surface-open case

  it('rereads one file and conflicts the other in the same batch', async () => {
    expectDrains([0, 0]);
    const events = testEvents();
    const told: number[] = [];
    const commands = scriptedCommands({
      reload: { ok: true, value: rereadBaseDocument() },
      drains: [
        reconciliationBatch(),
        reconciliationBatch({
          newest_sequence: 9,
          observations: [
            changedObservation(8, addressable(2, 'match/base.yml')),
            changedObservation(9, addressable(3, 'match/other.yml'))
          ]
        })
      ]
    });
    const state = createBrowserState(commands, () => undefined, undefined, events.source);
    state.start();
    await settleDrains();
    // **Two documents, never one.** The surface is over file 3 only, so file 2
    // must still reload — which a per-document rule gives and a global one does
    // not.
    const lease = state.registerWriteSurface(
      { kind: 'rawEditor', target: { kind: 'document', document: 3 } },
      (observation) => {
        told.push(observation.sequence);
      }
    );
    await state.open(null);
    await settleDrains();
    await settleDrains();

    expect(commands.reloadDocument).toHaveBeenCalledTimes(1);
    expect(commands.reloadDocument).toHaveBeenCalledWith(2);
    expect(told).toEqual([9]);
    expect(state.externalDocumentStatus(2)).toBeNull();
    expect(state.externalDocumentStatus(3)).toEqual({ kind: 'stale' });
    expectNoSaveCommand(commands);
    lease();
    state.dispose();
  }); // End of the two-document case

  it('installs nothing when a surface opens while the reread is in flight', async () => {
    expectDrains([0, 0]);
    const events = testEvents();
    const told: number[] = [];
    const held = deferred<CommandResult<DocumentView>>();
    const base = scriptedCommands({
      drains: [
        reconciliationBatch(),
        reconciliationBatch({
          newest_sequence: 5,
          observations: [changedObservation(5, addressable(2, 'match/base.yml'))]
        })
      ]
    });
    const commands: BrowserCommands = {
      ...base,
      reloadDocument: vi.fn(async () => held.promise)
    };
    const state = createBrowserState(commands, () => undefined, undefined, events.source);
    state.start();
    await settleDrains();
    await state.open(null);
    await settleDrains();
    await settleDrains();
    expect(commands.reloadDocument).toHaveBeenCalledWith(2);

    // The race: the read is out, and the person opens an editor over that file
    // before it comes back.
    const lease = state.registerWriteSurface(
      { kind: 'matchEditor', target: { kind: 'document', document: 2 } },
      (observation) => {
        told.push(observation.sequence);
      }
    );
    held.resolve({ ok: true, value: rereadBaseDocument() });
    await settleDrains();

    // Nothing installed, and the retained observation was re-arbitrated onto the
    // surface's conflict path rather than dropped.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11, 20]);
    expect(told).toEqual([5]);
    expect(state.externalDocumentStatus(2)).toEqual({ kind: 'stale' });
    expectNoSaveCommand(commands);
    lease();
    state.dispose();
  }); // End of the surface-open race

  it('inserts an added file as a row and reads nothing for it', async () => {
    expectDrains([0, 0, 0]);
    const events = testEvents();
    const commands = scriptedCommands({
      drains: [
        reconciliationBatch(),
        reconciliationBatch(),
        reconciliationBatch({
          newest_sequence: 6,
          observations: [
            {
              Added: {
                sequence: 6,
                document_summary: makeSummary({ id: 42, relativePath: 'match/new.yml' }),
                content: {
                  Projected: {
                    disk: makeDocument({ id: 42, relativePath: 'match/new.yml' }),
                    findings: []
                  }
                }
              }
            }
          ]
        })
      ]
    });
    const state = createBrowserState(commands, () => undefined, undefined, events.source);
    state.start();
    await settleDrains();
    await state.open(null);
    // **The baseline is read before the addition is fetched**, and the wake is what
    // fetches it. Taken after the batch had already been applied it would have held
    // any erroneous read the batch itself made, which is the vacuity this step's
    // review found in the sibling case below.
    await settleDrains();
    const before = documentCommandCounts(commands);

    events.wake(5, 6);
    await settleDrains();
    await settleDrains();

    // Ruling 30: the row is there and truthfully unloaded, nothing went into the
    // projections, and not one reading command was issued for an identity the open
    // workspace does not resolve.
    expect(state.documents.map((document) => document.id)).toEqual([1, 2, 3, 42]);
    expect(state.documents.find((document) => document.id === 42)?.loaded).toBe(false);
    // The row is drawn as *not read yet* — `pending`, never a count of zero
    // snippets, which would invite the reader to expect that it could hold some.
    expect(state.sidebar.pending).toBe(1);
    expect(state.sidebar.total).toBe(3);
    expectNoDocumentCommandSince(commands, before);
    expectNoSaveCommand(commands);
    state.dispose();
  }); // End of the addition case

  it('clears the selection with the gone notice when the selected file is removed', async () => {
    expectDrains([0, 0, 0]);
    const events = testEvents();
    const commands = scriptedCommands({
      drains: [
        reconciliationBatch(),
        reconciliationBatch(),
        reconciliationBatch({
          newest_sequence: 7,
          observations: [removedObservation(7, addressable(2, 'match/base.yml'))]
        })
      ]
    });
    const state = createBrowserState(commands, () => undefined, undefined, events.source);
    state.start();
    await settleDrains();
    await state.open(null);
    // **The two drains the lifecycle owes are taken before the selection is
    // made**, and the observation arrives on a wake afterwards. Letting the
    // observation batch land inside `select()`'s own await is a different case —
    // a removal invalidating a lookup in flight — and it would make this one's
    // subject unobservable.
    await settleDrains();
    state.show({ kind: 'document', id: 2 });
    const target = state.scopedMatches[0];
    expect(target?.id.node).toBe(10);
    await state.select(target!);
    expect(state.selectedMatch?.id.node).toBe(10);

    events.wake(5, 7);
    await settleDrains();
    await settleDrains();

    // Ruling 31's synchronous transition: the row, the projection and the
    // selection all go, and the notice is the one that claims no more than this
    // window can see.
    expect(state.documents.map((document) => document.id)).toEqual([1, 3]);
    expect(state.selectedMatch).toBeNull();
    expect(state.notice).toBe('gone');
    // Two snippets went with the file, so the "All" total is the one remaining.
    expect(state.sidebar.total).toBe(1);
    // And the sidebar filter that named the removed file was reset: still scoped
    // to it, this list would be empty rather than the one snippet left.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([20]);
    expect(state.scopedDocument).toBeNull();
    expect(state.externalDocumentStatus(2)).toEqual({ kind: 'removed' });
    expectNoSaveCommand(commands);
    state.dispose();
  }); // End of the removed-selected case

  it('leaves a selection in another file alone when one file is removed', async () => {
    expectDrains([0, 0, 0]);
    const events = testEvents();
    const commands = scriptedCommands({
      drains: [
        reconciliationBatch(),
        reconciliationBatch(),
        reconciliationBatch({
          newest_sequence: 7,
          observations: [removedObservation(7, addressable(2, 'match/base.yml'))]
        })
      ]
    });
    const state = createBrowserState(commands, () => undefined, undefined, events.source);
    state.start();
    await settleDrains();
    await state.open(null);
    await settleDrains();
    // The snippet of `match/other.yml`, which is the third row of the "All" list.
    const target = state.scopedMatches[2];
    expect(target?.id.node).toBe(20);
    await state.select(target!);
    expect(state.selectedMatch?.id.node).toBe(20);

    events.wake(5, 7);
    await settleDrains();
    await settleDrains();

    // The second document, which is what a one-document case cannot say anything
    // about: removing file 2 says nothing about a selection in file 3.
    expect(state.documents.map((document) => document.id)).toEqual([1, 3]);
    expect(state.selectedMatch?.id.node).toBe(20);
    expect(state.notice).toBeNull();
    expect(state.externalDocumentStatus(3)).toBeNull();
    expectNoSaveCommand(commands);
    state.dispose();
  }); // End of the removed-other case

  it('keeps the projection of an unreadable file and marks it unavailable', async () => {
    expectDrains([0, 0]);
    const events = testEvents();
    const commands = scriptedCommands({
      drains: [
        reconciliationBatch(),
        reconciliationBatch({
          newest_sequence: 8,
          observations: [
            {
              Unreadable: {
                sequence: 8,
                document: addressable(2, 'match/base.yml'),
                reason: { NotUtf8: { offset: 12 } }
              }
            }
          ]
        })
      ]
    });
    const state = createBrowserState(commands, () => undefined, undefined, events.source);
    state.start();
    await settleDrains();
    await state.open(null);
    await settleDrains();
    await settleDrains();

    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11, 20]);
    expect(state.documents.map((document) => document.id)).toEqual([1, 2, 3]);
    expect(commands.reloadDocument).not.toHaveBeenCalled();
    expect(state.externalDocumentStatus(2)).toEqual({
      kind: 'unavailable',
      reason: { NotUtf8: { offset: 12 } }
    });
    expectNoSaveCommand(commands);
    state.dispose();
  }); // End of the unreadable case

  it('routes a Named and an Unnamed observation to no command at all', async () => {
    expectDrains([0, 0, 0]);
    const events = testEvents();
    const commands = scriptedCommands({
      drains: [
        reconciliationBatch(),
        reconciliationBatch(),
        reconciliationBatch({
          newest_sequence: 12,
          observations: [
            {
              Changed: {
                sequence: 10,
                document: { Named: { document: 55, relative_path: 'match/pending.yml' } },
                previous_revision: null,
                disk_revision: 'rev-named',
                content: { Unreadable: { reason: { PermissionDenied: {} } } }
              }
            },
            {
              Removed: {
                sequence: 12,
                document: { Unnamed: { relative_path: 'match/stranger.yml' } },
                previous_revision: null
              }
            }
          ]
        })
      ]
    });
    const state = createBrowserState(commands, () => undefined, undefined, events.source);
    state.start();
    await settleDrains();
    await state.open(null);
    // **The two drains the lifecycle owes are taken first, and the baseline is
    // read while the observation batch is still unfetched.** Capturing it after a
    // `settleDrains()` that has already processed the batch was this case's own
    // defect: an erroneous `get_document` made *while* the observations were being
    // applied would have been inside the baseline, and comparing that number with
    // itself is an assertion nothing can fail.
    await settleDrains();
    const before = documentCommandCounts(commands);

    events.wake(5, 12);
    await settleDrains();
    await settleDrains();

    // Ruling 28's negative half, which only a spy can establish: neither arm
    // reached **any** open-workspace document command, and neither invented a row.
    expectNoDocumentCommandSince(commands, before);
    expect(state.documents.map((document) => document.id)).toEqual([1, 2, 3]);
    expect(state.externalPathDrift()).toEqual([
      { relativePath: 'match/stranger.yml', detail: { kind: 'removed' } }
    ]);
    expect(state.membershipReloadWanted()).toBe(true);
    expectNoSaveCommand(commands);
    state.dispose();
  }); // End of the Named-and-Unnamed case

  it('sends no document command for the row an addition invented', async () => {
    expectDrains([0, 0, 0]);
    const events = testEvents();
    const commands = scriptedCommands({
      drains: [
        reconciliationBatch(),
        reconciliationBatch(),
        reconciliationBatch({
          newest_sequence: 6,
          observations: [
            {
              Added: {
                sequence: 6,
                document_summary: makeSummary({ id: 42, relativePath: 'match/new.yml' }),
                content: {
                  Projected: {
                    disk: makeDocument({ id: 42, relativePath: 'match/new.yml' }),
                    findings: []
                  }
                }
              }
            }
          ]
        })
      ]
    });
    const state = createBrowserState(commands, () => undefined, undefined, events.source);
    state.start();
    await settleDrains();
    await state.open(null);
    await settleDrains();

    events.wake(5, 6);
    await settleDrains();
    await settleDrains();
    const before = documentCommandCounts(commands);

    // **The route ruling 28 does not close by itself**: `documents` is what the
    // sidebar draws *and* what `rawTarget` picks the viewer's file from, so
    // selecting the invented row and opening the viewer would have sent
    // `document_text` for an identity the open workspace refuses.
    state.show({ kind: 'document', id: 42 });
    await state.showFileText(true);
    await settleDrains();

    expectNoDocumentCommandSince(commands, before);
    expect(state.fileTextTarget).toBeNull();
    expect(state.fileText).toBeNull();
    // And the row is still drawn, as *not read yet*: keeping the identity out of
    // the command targets is not the same as hiding the file.
    expect(state.documents.map((document) => document.id)).toEqual([1, 2, 3, 42]);
    expect(state.sidebar.pending).toBe(1);
    expectNoSaveCommand(commands);
    state.dispose();
  }); // End of the pending-addition viewer case

  it('leaves the file marked stale when the guarded reread fails', async () => {
    expectDrains([0, 0]);
    const events = testEvents();
    const commands = scriptedCommands({
      reload: {
        ok: false,
        failure: { kind: 'command', error: { code: 'unknownDocument', document: 2 } }
      },
      drains: [
        reconciliationBatch(),
        reconciliationBatch({
          newest_sequence: 5,
          observations: [changedObservation(5, addressable(2, 'match/base.yml'))]
        })
      ]
    });
    const state = createBrowserState(commands, () => undefined, undefined, events.source);
    state.start();
    await settleDrains();
    await state.open(null);
    await settleDrains();
    await settleDrains();

    // The transition advanced this file's accepted sequence and the batch
    // watermark before the read was even issued, so this observation will never be
    // delivered again. A read that fails installs nothing — and until the outcome
    // was handled, nothing anywhere said so: the window kept the old projection
    // while the arbitration key said the file was reconciled.
    expect(commands.reloadDocument).toHaveBeenCalledWith(2);
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11, 20]);
    expect(state.externalDocumentStatus(2)).toEqual({ kind: 'stale' });
    expectNoSaveCommand(commands);
    state.dispose();
  }); // End of the failed-reread case

  it('installs nothing when the answer’s own getter opens a surface', async () => {
    expectDrains([0, 0]);
    const events = testEvents();
    const told: number[] = [];
    let sprung = false;
    // An array rather than a nullable local: the assignment happens inside a
    // getter, so a `let` would be narrowed to `null` by control-flow analysis that
    // cannot see the getter running.
    const leases: (() => void)[] = [];
    let state: BrowserState | null = null;
    const base = scriptedCommands({
      drains: [
        reconciliationBatch(),
        reconciliationBatch({
          newest_sequence: 5,
          observations: [changedObservation(5, addressable(2, 'match/base.yml'))]
        })
      ]
    });
    // **A `value` getter, which a `CommandResult` may perfectly well have.** The
    // command surface is injected, so the answer is caller-controlled data and
    // `readonly` freezes nothing at runtime: reading `.value` runs this, and this
    // opens an editor over the very file the guard has just been asked about. Read
    // *after* the guard — which is where it was read until this step's review — it
    // would spring inside `installView`'s own argument and the file would be
    // reloaded under an editor that was open by then.
    const commands: BrowserCommands = {
      ...base,
      reloadDocument: vi.fn(async () => ({
        ok: true as const,
        get value(): DocumentView {
          if (!sprung) {
            sprung = true;
            const lease = state?.registerWriteSurface(
              { kind: 'matchEditor', target: { kind: 'document', document: 2 } },
              (observation) => {
                told.push(observation.sequence);
              }
            );
            if (lease !== undefined) {
              leases.push(lease);
            }
          }
          return rereadBaseDocument();
        }
      }))
    };
    state = createBrowserState(commands, () => undefined, undefined, events.source);
    state.start();
    await settleDrains();
    await state.open(null);
    await settleDrains();
    await settleDrains();

    // The getter fired — so the trap was really sprung — and the installation the
    // guard approved is still the one that happened: none. The retained
    // observation went onto the new surface's conflict path instead.
    expect(sprung).toBe(true);
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11, 20]);
    expect(state.externalDocumentStatus(2)).toEqual({ kind: 'stale' });
    expect(told).toEqual([5]);
    expectNoSaveCommand(commands);
    for (const release of leases) {
      release();
    } // End of the loop that releases whatever the getter registered
    state.dispose();
  }); // End of the value-getter case

  it('installs into the slot the projection names, whatever a retained view says', async () => {
    expectDrains([0, 0]);
    const events = testEvents();
    let armed = false;
    let reads = 0;
    // **A retained view whose `id` is an accessor.** `open()` keeps what
    // `get_document` answered, so before this step's second review every element of
    // `views` was caller-controlled data — and `installView` compares `view.id` on
    // every one of them *after* the guard and after `invalidateProjectionOf` has
    // already been spent. This one answers `1` until the case arms it and `2`
    // afterwards, which is the smallest thing arbitrary code behind a property read
    // can do; the case below re-enters a public door instead.
    const trap: DocumentView = {
      ...profileDocument(),
      get id(): DocumentId {
        reads += 1;
        return armed ? 2 : 1;
      }
    };
    const commands = scriptedCommands({
      documents: new Map<number, CommandResult<DocumentView>>([
        [1, { ok: true, value: trap }],
        [2, { ok: true, value: baseDocument() }],
        [3, { ok: true, value: otherDocument() }]
      ]),
      reload: { ok: true, value: rereadBaseDocument() },
      drains: [
        reconciliationBatch(),
        reconciliationBatch({
          newest_sequence: 5,
          observations: [changedObservation(5, addressable(2, 'match/base.yml'))]
        })
      ]
    });
    const state = createBrowserState(commands, () => undefined, undefined, events.source);
    state.start();
    await settleDrains();
    await state.open(null);
    // Armed after the load, so the ingress copy is taken of a truthful answer and
    // only the *retained* reads see the accessor lie.
    armed = true;
    await settleDrains();
    await settleDrains();

    // The accessor really was consulted, so the trap is live rather than decorative.
    expect(reads).toBeGreaterThan(0);
    // File 1's slot still holds file 1 and file 2's fresh projection replaced file
    // 2's. Retained, the accessor made `findIndex` answer `0`, so the reread
    // overwrote the profile's slot: `views` held two entries for file 2, file 1's
    // projection was gone with nothing recording it, and the snippet list showed
    // the replaced projection beside the one that replaced it.
    expect(state.views.map((view) => view.id)).toEqual([1, 2, 3]);
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([77, 20]);
    expectNoSaveCommand(commands);
    state.dispose();
  }); // End of the retained-view-accessor case

  it('repairs the selection against the projection it read, not a re-entrant one', async () => {
    expectDrains([0, 0, 0]);
    const events = testEvents();
    let fired = false;
    let reads = 0;
    let state: BrowserState | null = null;
    const held = makeMatch({ node: 10, document: 2, trigger: ':sig', label: 'Signature' });
    // **A getter on a *match* of the answer**, which is one level below the copy
    // this step's first review added. `repairAfter` runs after the installation and
    // after the final check, and `reresolve` reads `view.matches[position]` and then
    // that candidate's `source_text` — so this runs inside the repair, between the
    // decision and the write it justifies, and calls a door the person has.
    const trap: MatchView = {
      ...held,
      get source_text(): string {
        reads += 1;
        if (!fired) {
          fired = true;
          state?.clearSelection();
        }
        return held.source_text;
      }
    };
    const commands = scriptedCommands({
      reload: {
        ok: true,
        value: makeDocument({ id: 2, relativePath: 'match/base.yml', matches: [trap] })
      },
      drains: [
        reconciliationBatch(),
        reconciliationBatch(),
        reconciliationBatch({
          newest_sequence: 5,
          observations: [changedObservation(5, addressable(2, 'match/base.yml'))]
        })
      ]
    });
    state = createBrowserState(commands, () => undefined, undefined, events.source);
    state.start();
    await settleDrains();
    await state.open(null);
    // The selection is made **before** the observation is fetched: the batch is
    // delivered by the wake below, so nothing is in flight across `select()`.
    await settleDrains();
    const first = state.scopedMatches[0];
    expect(first?.id.node).toBe(10);
    if (first !== undefined) {
      await state.select(first);
    }
    expect(state.selected?.document).toBe(2);

    events.wake(5, 5);
    await settleDrains();
    await settleDrains();

    // The getter fired, so the re-entry really happened. What it did is the
    // person's own *Clear selection*, and it stands: the repair was computed from a
    // selection that no longer existed, and committing it would have put back a
    // selection the person had just dropped — with a `kept` notice claiming the
    // window had preserved it for them.
    expect(reads).toBeGreaterThan(0);
    expect(state.selected).toBeNull();
    expect(state.selectedMatch).toBeNull();
    expect(state.notice).toBeNull();
    // And the reread still installed: the re-entry is bounded, not the install.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 20]);
    expectNoSaveCommand(commands);
    state.dispose();
  }); // End of the re-entrant-repair case

  it('keeps a newer removal over an older reread that came back a failure', async () => {
    expectDrains([0, 0, 5]);
    const events = testEvents();
    const answer = deferred<CommandResult<DocumentView>>();
    const base = scriptedCommands({
      drains: [
        reconciliationBatch(),
        reconciliationBatch({
          newest_sequence: 5,
          observations: [
            changedObservation(5, addressable(2, 'match/base.yml')),
            changedObservation(5, addressable(3, 'match/other.yml'))
          ]
        }),
        reconciliationBatch({
          newest_sequence: 6,
          observations: [removedObservation(6, addressable(2, 'match/base.yml'))]
        })
      ]
    });
    // **Two files, one held answer.** Both rereads are in flight together, so the
    // case can show that a failure lands over neither the file whose truth moved
    // nor the file whose did not — which a single-document case cannot tell from a
    // blanket suppression.
    //
    // **What this case pins changed at Phase 2d-5-4-C, and it is stated rather than
    // left to a reader.** It was written for the fence over the host member's
    // failure arm, and that arm is gone: a failed read now writes nothing at all,
    // because the mark it would have re-stated was already written before the read
    // started and the re-statement could only ever advance the ownership token a
    // newer read was holding (finding 2). So this case no longer tells a fence from
    // its absence — nothing is left to fence. What it still pins is the outcome:
    // neither file's status is disturbed by the failure.
    const commands: BrowserCommands = {
      ...base,
      reloadDocument: vi.fn(() => answer.promise)
    };
    const state = createBrowserState(commands, () => undefined, undefined, events.source);
    state.start();
    await settleDrains();
    await state.open(null);
    await settleDrains();

    // Both reads are out and both files are marked before they started, which is
    // true for the whole time they are out.
    expect(state.externalDocumentStatus(2)).toEqual({ kind: 'stale' });
    expect(state.externalDocumentStatus(3)).toEqual({ kind: 'stale' });

    // A newer batch says file 2 is gone. The row, the projection and the viewer's
    // snapshot go, and the status becomes `removed`.
    events.wake(5, 6);
    await settleDrains();
    expect(state.documents.map((document) => document.id)).toEqual([1, 3]);
    expect(state.externalDocumentStatus(2)).toEqual({ kind: 'removed' });

    // Only now does the older read come back, and it failed — which is the likely
    // outcome, the file it names having just been deleted.
    answer.resolve({
      ok: false,
      failure: { kind: 'command', error: { code: 'unknownDocument', document: 2 } }
    });
    await settleDrains();

    // `removed` survives: the window holds nothing for file 2, so *this window is
    // showing an older projection of it* would be a statement about nothing. File
    // 3 is still `stale` — the mark its own read wrote before it started, which
    // nothing has cleared, because only an installation clears one.
    expect(state.externalDocumentStatus(2)).toEqual({ kind: 'removed' });
    expect(state.externalDocumentStatus(3)).toEqual({ kind: 'stale' });
    expectNoSaveCommand(commands);
    state.dispose();
  }); // End of the newer-removal case

  it('keeps an overlapping reread’s installed status over an older failure', async () => {
    expectDrains([0, 0, 5]);
    const events = testEvents();
    const first = deferred<CommandResult<DocumentView>>();
    let reads = 0;
    const base = scriptedCommands({
      drains: [
        reconciliationBatch(),
        reconciliationBatch({
          newest_sequence: 5,
          observations: [changedObservation(5, addressable(2, 'match/base.yml'))]
        }),
        reconciliationBatch({
          newest_sequence: 6,
          observations: [changedObservation(6, addressable(2, 'match/base.yml'))]
        })
      ]
    });
    // The first read of file 2 is held; the second answers at once and succeeds.
    const commands: BrowserCommands = {
      ...base,
      reloadDocument: vi.fn(async (): Promise<CommandResult<DocumentView>> => {
        reads += 1;
        if (reads === 1) {
          return first.promise;
        }
        return { ok: true, value: rereadBaseDocument() };
      })
    };
    const state = createBrowserState(commands, () => undefined, undefined, events.source);
    state.start();
    await settleDrains();
    await state.open(null);
    await settleDrains();
    expect(state.externalDocumentStatus(2)).toEqual({ kind: 'stale' });

    // The overlapping reread lands first and installs the bytes now on disk, which
    // is what clears the mark.
    events.wake(5, 6);
    await settleDrains();
    expect(reads).toBe(2);
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([77, 20]);
    expect(state.externalDocumentStatus(2)).toBeNull();

    // Then the older read fails. The sentence that used to defend re-marking here
    // named exactly this case and got it backwards: an overlapping reread clears
    // the mark by **installing**, so the window is showing the newest bytes and
    // this failure is the oldest thing about the file, not the newest.
    first.resolve({
      ok: false,
      failure: { kind: 'command', error: { code: 'unknownDocument', document: 2 } }
    });
    await settleDrains();

    expect(state.externalDocumentStatus(2)).toBeNull();
    expectNoSaveCommand(commands);
    state.dispose();
  }); // End of the overlapping-reread case

  it('clears the mark when an explicit reread installs the file again', async () => {
    expectDrains([0, 0]);
    const events = testEvents();
    let reads = 0;
    const base = scriptedCommands({
      drains: [
        reconciliationBatch(),
        reconciliationBatch({
          newest_sequence: 5,
          observations: [changedObservation(5, addressable(2, 'match/base.yml'))]
        })
      ]
    });
    // The guarded reread fails; the explicit one the recovery control fires
    // succeeds.
    const commands: BrowserCommands = {
      ...base,
      reloadDocument: vi.fn(async (): Promise<CommandResult<DocumentView>> => {
        reads += 1;
        if (reads === 1) {
          return {
            ok: false,
            failure: { kind: 'command', error: { code: 'unknownDocument', document: 2 } }
          };
        }
        return { ok: true, value: rereadBaseDocument() };
      })
    };
    const state = createBrowserState(commands, () => undefined, undefined, events.source);
    state.start();
    await settleDrains();
    await state.open(null);
    await settleDrains();
    await settleDrains();
    expect(state.externalDocumentStatus(2)).toEqual({ kind: 'stale' });

    // **The control `DetailPane` draws for the mover and the duplicator**, which is
    // `rereadUnderGuard` with a guard that always holds — so until the clear moved
    // out of the coordinator's guard and onto the installation, nothing on this
    // path touched the status and the file stayed marked for the rest of the
    // session.
    expect(await state.rereadDocument(2)).toBeNull();

    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([77, 20]);
    expect(state.externalDocumentStatus(2)).toBeNull();
    // What the clear claims is *this file's content is current as of this read*. It
    // says nothing about file 3, which no read has been taken of.
    expect(state.externalDocumentStatus(3)).toBeNull();
    expectNoSaveCommand(commands);
    state.dispose();
  }); // End of the explicit-recovery case

  it('lets a newer successful reread clear a mark an older failure cannot hold', async () => {
    expectDrains([0, 0]);
    const events = testEvents();
    const first = deferred<CommandResult<DocumentView>>();
    const second = deferred<CommandResult<DocumentView>>();
    let reads = 0;
    const base = scriptedCommands({
      drains: [
        reconciliationBatch(),
        reconciliationBatch({
          newest_sequence: 5,
          observations: [changedObservation(5, addressable(2, 'match/base.yml'))]
        })
      ]
    });
    // Both reads are held, so the two really overlap: the coordinator's is first
    // and fails, the person's is second and succeeds.
    const commands: BrowserCommands = {
      ...base,
      reloadDocument: vi.fn(async (): Promise<CommandResult<DocumentView>> => {
        reads += 1;
        return reads === 1 ? first.promise : second.promise;
      })
    };
    const state = createBrowserState(commands, () => undefined, undefined, events.source);
    state.start();
    await settleDrains();
    await state.open(null);
    await settleDrains();
    expect(reads).toBe(1);
    expect(state.externalDocumentStatus(2)).toEqual({ kind: 'stale' });

    // **The recovery control, fired while the coordinator's read is still out.** It
    // writes no mark of its own — only the host's coordinator-facing member does —
    // so the token it captures is the one the coordinator's own mark established.
    const recovery = state.rereadDocument(2);
    expect(reads).toBe(2);

    // The older read comes back a failure. Nothing it does may take ownership of
    // this file's status away from the read that is still out: the mark it would
    // re-state is already there, so the write could never change a value, and the
    // only thing it could change was who owns it.
    first.resolve({
      ok: false,
      failure: { kind: 'command', error: { code: 'unknownDocument', document: 2 } }
    });
    await settleDrains();

    // Then the newer read succeeds and installs the bytes on disk.
    second.resolve({ ok: true, value: rereadBaseDocument() });
    expect(await recovery).toBeNull();
    await settleDrains();

    // **The discriminating assertion.** Pre-fix the failure arm's value-neutral
    // re-statement had advanced the token, so this installation's clear was
    // suppressed and the file stayed marked `stale` for the rest of the session —
    // with the bytes now on disk on screen, and nothing to re-derive the mark
    // because the batch watermark had moved past the observation that set it.
    expect(state.externalDocumentStatus(2)).toBeNull();
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([77, 20]);
    expectNoSaveCommand(commands);
    state.dispose();
  }); // End of the superseded-failure ownership case

  it('keeps a newer unreadable reason an explicit reread did not set', async () => {
    expectDrains([0, 0]);
    const events = testEvents();
    const held = deferred<CommandResult<DocumentView>>();
    const base = scriptedCommands({
      drains: [
        reconciliationBatch(),
        reconciliationBatch({
          newest_sequence: 5,
          observations: [unreadableObservation(5, addressable(2, 'match/base.yml'))]
        })
      ]
    });
    // The recovery control's read is held, so the observation lands in the middle
    // of it.
    const commands: BrowserCommands = { ...base, reloadDocument: vi.fn(() => held.promise) };
    const state = createBrowserState(commands, () => undefined, undefined, events.source);
    state.start();
    await settleDrains();
    await state.open(null);
    // Fired before the batch is drained: `open()` requests the drain and the pump
    // yields, so this read is out by the time the observation is applied.
    const recovery = state.rereadDocument(2);
    await settleDrains();

    // The watcher's last word about the file, with its typed reason. **It moves
    // none of the read's three captures** — it installs nothing and invalidates no
    // projection — so the read in flight still reaches its installation block.
    expect(state.externalDocumentStatus(2)).toEqual({ kind: 'unavailable', reason: DENIED });

    held.resolve({ ok: true, value: rereadBaseDocument() });
    expect(await recovery).toBeNull();
    await settleDrains();

    // **The install stands**, and deliberately: the bytes this answer carries are
    // the bytes that file held when the read was answered, which a status written
    // meanwhile does not contradict.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([77, 20]);
    // **And the mark stands too**, because this read did not set it. Clearing it
    // would say *there is nothing to report about this file* over the watcher's
    // *unreadable*, permanently — the batch watermark has moved past the
    // observation that carried the reason, so nothing re-derives it.
    expect(state.externalDocumentStatus(2)).toEqual({ kind: 'unavailable', reason: DENIED });
    expectNoSaveCommand(commands);
    state.dispose();
  }); // End of the reread-over-a-newer-reason case

  it('reads no summary of its own inside the coordinator’s guard', async () => {
    expectDrains([0, 0, 0]);
    const events = testEvents();
    const answer = deferred<CommandResult<DocumentView>>();
    let armed = false;
    let reads = 0;
    let sprung = false;
    let state: BrowserState | null = null;
    // **A row whose `id` is an accessor**, which is what `list_documents` may
    // perfectly well answer with: the command surface is injected, so its answer is
    // caller-controlled data and `readonly` freezes nothing at runtime.
    //
    // **What this case points at changed at Phase 2d-5-4-C.** It was written for
    // the host reread member's failure arm, whose last fence was a membership test
    // over `documents` run immediately before its write; that arm was deleted with
    // the write it fenced (finding 2), so pointing at it would now measure the
    // absence of a code path rather than the ownership of a row. The reader it
    // points at instead is the one `ownedSummaryOf`'s header names first and which
    // is still there: `creatorEligibility` walks this list **inside the
    // coordinator's guard**, between the arbitration that admitted an observation
    // and the `stale` that observation writes.
    const trap: DocumentSummary = {
      ...makeSummary({ id: 2, relativePath: 'match/base.yml' }),
      get id(): DocumentId {
        reads += 1;
        if (armed && !sprung) {
          sprung = true;
          // The largest thing arbitrary code can do from inside that guard: a
          // whole new workspace, over the one the observation is about.
          void state?.open('/second');
        }
        return 2;
      }
    };
    const base = scriptedCommands({
      list: {
        ok: true,
        value: [
          makeSummary({ id: 1, relativePath: 'config/default.yml', kind: 'ConfigProfile' }),
          trap,
          makeSummary({ id: 3, relativePath: 'match/other.yml' })
        ]
      },
      drains: [
        reconciliationBatch(),
        reconciliationBatch(),
        reconciliationBatch({
          newest_sequence: 5,
          observations: [changedObservation(5, addressable(2, 'match/base.yml'))]
        })
      ]
    });
    // Held, so the reread this observation starts never lands and the window stays
    // where the arbitration left it.
    const commands: BrowserCommands = { ...base, reloadDocument: vi.fn(() => answer.promise) };
    state = createBrowserState(commands, () => undefined, undefined, events.source);
    state.start();
    await settleDrains();
    await state.open(null);
    await settleDrains();

    // Armed only after the load, so the ingress copy is taken of a truthful answer
    // and only a *retained* read can fire this.
    armed = true;
    reads = 0;
    events.wake(5, 5);
    await settleDrains();

    // **Nothing the coordinator read was a command-supplied row**, because the
    // rows are this module's own objects. Without the ingress copy the getter ran
    // inside the guard and opened a second workspace, and the transition went on
    // to mark a file of the workspace that had just been replaced.
    expect(reads).toBe(0);
    expect(commands.openWorkspace).toHaveBeenCalledTimes(1);
    // The transition itself still ran, so the case is about *who was read* and not
    // about an observation that never arrived.
    expect(state.externalDocumentStatus(2)).toEqual({ kind: 'stale' });
    expectNoSaveCommand(commands);
    state.dispose();
  }); // End of the unnormalized-summary ingress case

  it('sends document_text for the viewer’s file after an observation installs', async () => {
    expectDrains([0, 0, 0]);
    const events = testEvents();
    const commands = scriptedCommands({
      reload: { ok: true, value: rereadBaseDocument() },
      drains: [
        reconciliationBatch(),
        reconciliationBatch(),
        reconciliationBatch({
          newest_sequence: 5,
          observations: [changedObservation(5, addressable(2, 'match/base.yml'))]
        })
      ]
    });
    const state = createBrowserState(commands, () => undefined, undefined, events.source);
    state.start();
    await settleDrains();
    await state.open(null);
    await settleDrains();
    state.show({ kind: 'document', id: 2 });
    await state.showFileText(true);
    const before = documentCommandCounts(commands);

    events.wake(5, 5);
    await settleDrains();
    await settleDrains();

    // **What `applyObservation` can reach transitively, pinned.** The arbitration
    // itself requests exactly one document command — `reload_document`. The host's
    // own viewer refresh then sends a **second**, `document_text`, because
    // `rereadUnderGuard` drops the viewer's snapshot with the projection it is
    // replacing and reads it again. Every routing case in this file runs with the
    // viewer closed, so `readFileText` returned at its first line and this was
    // invisible; the claim that the reread is the only reachable command was false
    // and is corrected in `observationTransitions.ts` and in the notes.
    expect(commands.reloadDocument).toHaveBeenCalledWith(2);
    expect(commands.documentText).toHaveBeenLastCalledWith(2);
    // The whole six-command record against the baseline, never two chosen keys:
    // exactly one more `reload_document`, exactly one more `document_text`, and
    // nothing else moved at all.
    expect(documentCommandCounts(commands)).toEqual({
      ...before,
      reloadDocument: (before.reloadDocument ?? 0) + 1,
      documentText: (before.documentText ?? 0) + 1
    });
    // Ruling 28 is untouched: the identity it was sent for is the viewer target's,
    // which the host filters pending additions out of.
    expect(state.fileTextTarget?.id).toBe(2);
    expectNoSaveCommand(commands);
    state.dispose();
  }); // End of the viewer-read reachability case

}); // End of the "observation transitions" suite

describe('the discarded-history recovery', () => {
  it('re-runs the original open request when no surface is open', async () => {
    expectDrains([0, 0, 0]);
    const events = testEvents();
    const commands = scriptedCommands({
      drains: [
        reconciliationBatch(),
        reconciliationBatch({
          newest_sequence: 9,
          discarded: 1,
          observations: [removedObservation(9, addressable(2, 'match/base.yml'))]
        }),
        reconciliationBatch({ epoch: 6 })
      ]
    });
    const state = createBrowserState(commands, () => undefined, undefined, events.source);
    state.start();
    await settleDrains();
    await state.open('/tmp/espanso');
    await settleDrains();
    await settleDrains();
    await settleDrains();

    // Ruling 11: a true `open()` with the **retained request**, and the batch's
    // own observations were refused rather than applied — the removal in it never
    // reached the window, which is what "the lost entry may have been the only
    // observation of an addition or a removal" means in practice.
    expect(commands.openWorkspace).toHaveBeenCalledTimes(2);
    expect(commands.openWorkspace).toHaveBeenNthCalledWith(2, '/tmp/espanso');
    expect(state.status).toBe('ready');
    expect(state.documents.map((document) => document.id)).toEqual([1, 2, 3]);
    expect(state.reconciliationBlock()).toEqual({ kind: 'running' });
    expectNoSaveCommand(commands);
    state.dispose();
  }); // End of the empty-registry recovery case

  it('reloads nothing while a surface is open, and preserves the window', async () => {
    expectDrains([0, 0, 9]);
    const events = testEvents();
    const commands = scriptedCommands({
      drains: [
        reconciliationBatch(),
        reconciliationBatch({ newest_sequence: 9, discarded: 1 }),
        reconciliationBatch({
          newest_sequence: 14,
          discarded: 1,
          observations: [removedObservation(14, addressable(2, 'match/base.yml'))]
        })
      ]
    });
    const state = createBrowserState(commands, () => undefined, undefined, events.source);
    state.start();
    await settleDrains();
    // Open **before** the batch that reports the loss, which is the arm this case
    // is about: ruling 12's *with any write surface open*.
    const lease = state.registerWriteSurface(
      { kind: 'matchEditor', target: { kind: 'document', document: 2 } },
      () => undefined
    );
    await state.open('/tmp/espanso');
    await settleDrains();
    const target = state.scopedMatches[0];
    await state.select(target!);
    expect(state.selectedMatch?.id.node).toBe(10);

    // Ruling 12: no `open()`, no synthetic conflict, and the draft's own document
    // untouched on screen.
    expect(commands.openWorkspace).toHaveBeenCalledTimes(1);
    expect(state.selectedMatch?.id.node).toBe(10);
    expect(state.documents.map((document) => document.id)).toEqual([1, 2, 3]);
    expect(state.reconciliationBlock()).toEqual({
      kind: 'blockedByLostHistory',
      discarded: 1,
      epoch: 5
    });

    // And ruling 13's cost: the next batch's observations are dropped rather than
    // applied, so the removal in it never reaches the window.
    events.wake(5, 15);
    await settleDrains();
    await settleDrains();
    expect(state.documents.map((document) => document.id)).toEqual([1, 2, 3]);
    expect(state.selectedMatch?.id.node).toBe(10);
    expect(commands.openWorkspace).toHaveBeenCalledTimes(1);
    expectNoSaveCommand(commands);
    lease();
    state.dispose();
  }); // End of the blocked case

  it('takes the permitted reload at the next batch once the surface closes', async () => {
    expectDrains([0, 0, 9, 0]);
    const events = testEvents();
    const commands = scriptedCommands({
      drains: [
        reconciliationBatch(),
        reconciliationBatch({ newest_sequence: 9, discarded: 2 }),
        reconciliationBatch({ newest_sequence: 10 }),
        reconciliationBatch({ epoch: 6 })
      ]
    });
    const state = createBrowserState(commands, () => undefined, undefined, events.source);
    state.start();
    await settleDrains();
    const lease = state.registerWriteSurface(
      { kind: 'matchDuplicator', target: { kind: 'document', document: 3 } },
      () => undefined
    );
    await state.open('/tmp/espanso');
    await settleDrains();
    expect(state.reconciliationBlock().kind).toBe('blockedByLostHistory');
    expect(commands.openWorkspace).toHaveBeenCalledTimes(1);

    // **Closing it triggers nothing**: nothing in this application observes the
    // registry emptying, so the permission is taken at the next batch.
    lease();
    expect(commands.openWorkspace).toHaveBeenCalledTimes(1);

    events.wake(5, 10);
    await settleDrains();
    await settleDrains();
    await settleDrains();

    expect(commands.openWorkspace).toHaveBeenCalledTimes(2);
    expect(commands.openWorkspace).toHaveBeenNthCalledWith(2, '/tmp/espanso');
    expect(state.reconciliationBlock()).toEqual({ kind: 'running' });
    expectNoSaveCommand(commands);
    state.dispose();
  }); // End of the permitted-reload case
}); // End of the "discarded-history recovery" suite

describe('the application preferences — Phase 3-13-1', () => {
  /** A sidecar answer holding defaults for file 2 (an empty `word` among them). */
  const WITH_DEFAULTS: CommandResult<SidecarState> = {
    ok: true,
    value: {
      status: { Loaded: {} },
      writable: true,
      files: [
        {
          document: 2,
          display_name: 'Everyday',
          sort_order: null,
          defaults: [
            { option: 'word', value: '' },
            { option: 'force_mode', value: 'keys' }
          ]
        }
      ],
      retained_orphans: 0
    }
  };

  /**
   * An update answer holding the given defaults for file 2.
   *
   * @param value - `force_mode`'s new default.
   * @returns What `update_sidecar` answers.
   */
  function updatedTo(value: string): CommandResult<SidecarUpdateResult> {
    return {
      ok: true,
      value: {
        outcome: { Saved: {} },
        state: {
          status: { Loaded: {} },
          writable: true,
          files: [
            {
              document: 2,
              display_name: null,
              sort_order: null,
              defaults: [{ option: 'force_mode', value }]
            }
          ],
          retained_orphans: 0
        }
      }
    };
  } // End of function updatedTo()

  /**
   * A creation form over the state's files, opened as a screen would open one,
   * with file 2 chosen and the two required fields filled in.
   *
   * @param state - The browser state.
   * @returns The form.
   */
  function creatorOver(state: BrowserState): MatchCreationSession {
    let session = startMatchCreation(state.documents, state.views, null, () => 0, state.creationDefaults());
    session = chooseDestination(session, 2);
    session = editCreationField(session, 'trigger', ':new');
    return editCreationField(session, 'replace', 'a body');
  } // End of function creatorOver()

  it('asks for the preferences on open and installs them, without the open waiting for them', async () => {
    const commands = scriptedCommands({ sidecarLoads: [WITH_DEFAULTS] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    await settleDrains();
    expect(vi.mocked(commands.loadSidecar).mock.calls).toEqual([[]]);
    expect(state.preferences.files.get(2)?.displayName).toBe('Everyday');
    expect(state.creationDefaults().get(2)).toMatchObject({ word: '', force_mode: 'keys', left_word: null });
    const session = creatorOver(state);
    expect(matchCreationView(session).options.filter((one) => one.value !== null).map((one) => one.option)).toEqual([
      'word',
      'force_mode'
    ]);
    state.dispose();
  });

  it('reaches ready and creates while a stalled read never answers', async () => {
    const commands: BrowserCommands = {
      ...scriptedCommands(),
      loadSidecar: vi.fn(() => new Promise<CommandResult<SidecarState>>(() => undefined))
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    await settleDrains();
    expect(state.status).toBe('ready');
    expect(state.preferences).toBe(NO_PREFERENCES);
    expect(state.creationDefaults().size).toBe(0);
    const session = creatorOver(state);
    expect(canCreate(session)).toBe(true);
    // A second refresh joins the stalled read instead of piling up another.
    void state.refreshPreferences();
    expect(vi.mocked(commands.loadSidecar)).toHaveBeenCalledTimes(1);
    state.dispose();
  });

  const unusable: readonly SidecarState['status'][] = [
    { Fresh: {} },
    { Quarantined: { aside: 'x.corrupt.json' } },
    { QuarantineFailed: {} },
    { FutureSchema: { version: '9' } },
    { Unreadable: {} },
    { RootUnresolved: {} },
    { StorageUnavailable: {} }
  ];

  it.each(unusable)('leaves creation working with no defaults over a sidecar that is %j', async (status) => {
    const reported: IpcFailure[] = [];
    const commands = scriptedCommands({
      sidecarLoads: [{ ok: true, value: { status, writable: false, files: [], retained_orphans: 0 } }]
    });
    const state = createBrowserState(commands, (failure) => reported.push(failure));
    await state.open(null);
    await settleDrains();
    expect(state.preferences.reading).toEqual({ kind: 'read', status });
    expect(state.creationDefaults().size).toBe(0);
    expect(canCreate(creatorOver(state))).toBe(true);
    expect(reported).toEqual([]);
    state.dispose();
  });

  it('leaves creation working when the read fails or throws, reporting it and rejecting nothing', async () => {
    const failure: IpcFailure = { kind: 'command', error: { code: 'noWorkspaceOpen' } };
    for (const loadSidecar of [
      vi.fn(async (): Promise<CommandResult<SidecarState>> => ({ ok: false, failure })),
      vi.fn(async (): Promise<CommandResult<SidecarState>> => {
        throw new Error('the boundary broke');
      })
    ]) {
      const reported: IpcFailure[] = [];
      const state = createBrowserState({ ...scriptedCommands(), loadSidecar }, (one) => reported.push(one));
      await state.open(null);
      await settleDrains();
      expect(state.preferences.reading.kind).toBe('failed');
      expect(reported).toHaveLength(1);
      expect(canCreate(creatorOver(state))).toBe(true);
      await expect(state.refreshPreferences()).resolves.toBeUndefined();
      state.dispose();
    } // End of the loop over the two ways a read fails
  });

  it('does not touch an open creation draft when a preference changes later', async () => {
    const commands = scriptedCommands({ sidecarLoads: [WITH_DEFAULTS], sidecarUpdates: [updatedTo('clipboard')] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    await settleDrains();
    const open = editCreationOption(creatorOver(state), 'left_word', 'mine');
    const before = open.draft.value;
    const report = await state.updatePreferences(2, [{ SetDefault: { option: 'force_mode', value: 'clipboard' } }]);
    expect(report).toEqual({ kind: 'saved' });
    expect(state.creationDefaults().get(2)?.force_mode).toBe('clipboard');
    // The form is a value holding its own snapshot: nothing reached it.
    expect(open.draft.value).toBe(before);
    expect(open.draft.value.options).toMatchObject({ word: '', force_mode: 'keys', left_word: 'mine' });
    expect(creatorOver(state).draft.value.options.force_mode).toBe('clipboard');
    state.dispose();
  });

  it('reports every failed preference save as a value, never a rejection, and changes nothing else', async () => {
    const failure: IpcFailure = { kind: 'command', error: { code: 'unknownDocument', document: 2 } };
    const notWritable: CommandResult<SidecarUpdateResult> = {
      ok: true,
      value: {
        outcome: { NotWritable: {} },
        state: { status: { QuarantineFailed: {} }, writable: false, files: [], retained_orphans: 0 }
      }
    };
    const reported: IpcFailure[] = [];
    const commands = scriptedCommands({ sidecarUpdates: [{ ok: false, failure }, notWritable] });
    const state = createBrowserState(commands, (one) => reported.push(one));
    await state.open(null);
    await settleDrains();
    const session = creatorOver(state);
    expect(await state.updatePreferences(2, [{ ClearDisplayName: {} }])).toEqual({ kind: 'failed', failure });
    expect(state.preferenceSave).toEqual({ kind: 'ended', report: { kind: 'failed', failure } });
    expect(await state.updatePreferences(2, [{ ClearDisplayName: {} }])).toEqual({
      kind: 'notWritable',
      status: { QuarantineFailed: {} }
    });
    const throwing = createBrowserState(
      {
        ...scriptedCommands(),
        updateSidecar: vi.fn(async (): Promise<CommandResult<SidecarUpdateResult>> => {
          throw new Error('the boundary broke');
        })
      },
      () => undefined
    );
    await throwing.open(null);
    await expect(throwing.updatePreferences(2, [])).resolves.toMatchObject({ kind: 'failed' });
    expect(reported).toEqual([failure]);
    expect(canCreate(session)).toBe(true);
    // No user-file writer was reached by any of it.
    expect(commands.saveMatch).not.toHaveBeenCalled();
    expect(commands.createMatch).not.toHaveBeenCalled();
    expect(commands.saveRawDocument).not.toHaveBeenCalled();
    state.dispose();
    throwing.dispose();
  });

  it('sends updates one at a time, copies the changes, and withdraws one queued across open()', async () => {
    const first = deferred<CommandResult<SidecarUpdateResult>>();
    const sent: SidecarUpdateRequest[] = [];
    const commands: BrowserCommands = {
      ...scriptedCommands(),
      updateSidecar: vi.fn((request: SidecarUpdateRequest) => {
        sent.push(request);
        return sent.length === 1 ? first.promise : Promise.resolve(updatedTo('keys'));
      })
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    const changes: SidecarChange[] = [{ SetDisplayName: { name: 'A' } }];
    const one = state.updatePreferences(2, changes);
    changes.push({ ClearDisplayName: {} });
    const two = state.updatePreferences(3, [{ ClearDisplayName: {} }]);
    await settleDrains();
    expect(sent).toEqual([{ document: 2, changes: [{ SetDisplayName: { name: 'A' } }] }]);
    expect(state.preferenceSave).toEqual({ kind: 'saving' });
    await state.open(null);
    first.resolve(updatedTo('clipboard'));
    expect(await one).toEqual({ kind: 'saved' });
    expect(await two).toEqual({ kind: 'withdrawn' });
    // The second was never sent, and the closed workspace's answer installed nothing.
    expect(sent).toHaveLength(1);
    expect(state.preferences.files.size).toBe(0);
    expect(state.preferenceSave).toEqual({ kind: 'idle' });
    state.dispose();
  });

  it('sends a read called while an update is out only after it, so the read never serves pre-update values', async () => {
    // A fake store with Rust's lock: whatever is served first is served in full.
    // Its `force_mode` default is `keys` until the update is applied.
    const update = deferred<CommandResult<SidecarUpdateResult>>();
    let applied = false;
    const order: string[] = [];
    const commands: BrowserCommands = {
      ...scriptedCommands(),
      loadSidecar: vi.fn(async (): Promise<CommandResult<SidecarState>> => {
        order.push(applied ? 'read after the update' : 'read before the update');
        if (!applied) {
          return WITH_DEFAULTS;
        }
        const after = updatedTo('clipboard');
        if (!after.ok) {
          throw new Error('unreachable');
        }
        return { ok: true, value: after.value.state };
      }),
      updateSidecar: vi.fn((_request: SidecarUpdateRequest) => {
        order.push('update');
        return update.promise;
      })
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    await settleDrains();
    const saving = state.updatePreferences(2, [{ SetDefault: { option: 'force_mode', value: 'clipboard' } }]);
    await settleDrains();
    // Sent later than the update: without one queue it would reach the store
    // first, answer `keys`, and win by its later number.
    const refreshed = state.refreshPreferences();
    await settleDrains();
    expect(commands.loadSidecar).toHaveBeenCalledTimes(1);
    applied = true;
    update.resolve(updatedTo('clipboard'));
    expect(await saving).toEqual({ kind: 'saved' });
    await refreshed;
    expect(order).toEqual(['read before the update', 'update', 'read after the update']);
    expect(state.creationDefaults().get(2)?.force_mode).toBe('clipboard');
    state.dispose();
  });

  it('discards a read answered after open() replaced the workspace it was asked about', async () => {
    const stale = deferred<CommandResult<SidecarState>>();
    let reads = 0;
    const commands: BrowserCommands = {
      ...scriptedCommands(),
      loadSidecar: vi.fn(() => {
        reads += 1;
        return reads === 1
          ? stale.promise
          : Promise.resolve<CommandResult<SidecarState>>({
              ok: true,
              value: { status: { Fresh: {} }, writable: true, files: [], retained_orphans: 0 }
            });
      })
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    await state.open(null);
    await settleDrains();
    stale.resolve(WITH_DEFAULTS);
    await settleDrains();
    expect(reads).toBe(2);
    expect(state.preferences.reading).toEqual({ kind: 'read', status: { Fresh: {} } });
    expect(state.creationDefaults().size).toBe(0);
    state.dispose();
  });
}); // End of the "application preferences" suite
