/**
 * The browser's state: what is open, what is loaded, and what is selected.
 *
 * The one place the read-only commands are actually called. Everything above it
 * is markup and everything below it is the typed boundary, so this module is
 * where the two meet — and where the three states a screen has to have are
 * decided: *reading*, *nothing to read*, and *the read failed*.
 *
 * ## Every command is called through an injected object
 *
 * Not because the real ones are hard to import, but because a test that cannot
 * run Tauri still has to be able to drive a `getMatch` into an
 * `identityStaleRevision` and watch what the selection does about it. The
 * default is the real boundary; `workspace.test.ts` supplies a scripted one.
 *
 * **There are two such objects since 2c-5-4a, not one.** {@link BrowserCommands}
 * holds the twelve; {@link BackupCommands} holds the three read-only backup
 * commands. Its own note records why they are apart, and the reason is a
 * constraint on the step that added them rather than a property of the design.
 *
 * ## Failure has one channel
 *
 * `reportIpcFailure` for the console, `IpcFailure` on the state for the screen.
 * There is no second error path, no thrown string and no `catch` that turns a
 * typed refusal into an untyped one: `CommandResult` is a value, and the arms
 * below handle it as one.
 *
 * A failure that stops the whole load lands on `failure`; a failure that only
 * costs one file lands on {@link BrowserState.loadFailures}, which the sidebar
 * renders. Neither is console-only, because a total the user can read is a
 * claim about their configuration and "some of it did not load" has to be part
 * of that claim rather than a line in a developer log.
 *
 * ## Every await is followed by a check that it is still wanted
 *
 * Two clicks race, and so do two opens. Each of the two asynchronous entry
 * points takes a generation token before its first command and compares it
 * after every `await`; a request whose generation has moved on discards its own
 * result instead of writing it over a newer one. `open()` also bumps the
 * *selection* generation, because a selection into the workspace being replaced
 * cannot be applied to the one replacing it.
 */

import {
  createMatch,
  deleteMatch,
  documentText,
  drainExternalChanges,
  duplicateMatch,
  getDocument,
  getMatch,
  listBackupBatches,
  listBackupEntries,
  listDocuments,
  matchItemText,
  moveMatch,
  openWorkspace,
  readBackupText,
  reloadDocument,
  saveMatch,
  saveMatchItemText,
  saveRawDocument
} from '../ipc/commands';
import type {
  CommandResult,
  RawSaveOutcome,
  RawSaveReload,
  ReloadAfterRawSave
} from '../ipc/commands';
import { classifyFailure, mayHaveWritten, reportIpcFailure } from '../ipc/errors';
import type { IpcFailure } from '../ipc/errors';
// **A type-only import, and that is load-bearing.** `../ipc/events` builds its real
// adapter at module scope from Tauri's `listen`, and the one production module that
// imports that value is `../components/AppShell.svelte`, which hands it to
// `createBrowserState` explicitly. `import type` is erased, so this file names the
// interface and imports nothing — which is what keeps the default below inert and
// every test state that takes the default off Tauri's `listen`. The adapter is
// described rather than named here so that searching `src/lib/browser/` for its
// identifier stays the oracle that no state in this directory reaches it.
import type { ReconciliationEventSource } from '../ipc/events';
import type {
  Acknowledgement,
  BackupBatchId,
  BackupBatchListing,
  BackupEntryId,
  BackupEntryListing,
  BackupTextResponse,
  ContentRevision,
  DocumentId,
  DocumentSummary,
  DocumentView,
  MatchDraft,
  MatchId,
  MatchView,
  NewMatch,
  NewMatchPosition,
  OwnedItemText,
  ReconciliationBatch,
  SaveResult,
  ScalarView,
  WorkspaceSummary
} from '../ipc/types';
import {
  externalConflictSource,
  newestObservationOf,
  releaseBarrier,
  saveConflictSource,
  standingConflictOf
} from './conflictSource';
import type {
  ConflictSource,
  ExternalChangeConflictSource,
  ExternalConflictObservation,
  ObservationVerdict,
  SaveConflictSource,
  WriteSettlement
} from './conflictSource';
import {
  arbitratedDelivery,
  decideAutomaticReload,
  retainedDelivery,
  writtenHereDelivery,
  type AutomaticReloadGuardInputs,
  type AutomaticReloadRefusal,
  type ObservationDelivery
} from './observationDelivery';
import {
  sealWholeDocumentSave,
  type InvalidationStatus,
  type SealedWholeDocumentSave
} from './invalidation';
import type { RepairAttribution, SelectionNotice } from './notices';
import { authorizeDiskAdoption } from './saveOutcome';
import type { ConflictModel, DiskAdoptionOutcome, ReloadConfirmation } from './saveOutcome';
import { documentTextState, rawTarget, type RawDocumentText } from './rawDocument';
import {
  applyRestore,
  creatorEligibilityOf,
  restoreConfirmationWithdrawn,
  restoreCouldNotBeSent,
  revisionInProjection,
  sendRestore,
  type CreatorEligibility,
  type InvalidateEverySurface,
  type OpenWriteSurface,
  type OpenWriteSurfaceKind,
  type ReadTheInstalledSession as ReadTheInstalledRestore,
  type RestoreContext,
  type RestoreSession,
  type StartedRestore,
  targetingSurfaceFor,
  type WriteSurfaceDocumentTarget
} from './restore';
import type {
  ExternalDocumentStatus,
  ExternalPathDrift
} from './observationTransitions';
import {
  createReconciliationCoordinator,
  INERT_FOREGROUND_EVENTS,
  INERT_RECONCILIATION_EVENTS,
  NO_RECONCILIATION_TRANSPORT,
  type ForegroundSource,
  type ReconciliationBlock,
  type ReconciliationCoordinator,
  type ReconciliationWatchState,
  type RegistrationState
} from './reconciliationCoordinator';
import { filterMatches } from './search';
import type { SelectedMatch, SelectionRepair } from './selection';
import { positionOf, repairSelection, reresolve, selectMatch } from './selection';
import type { SidebarModel, SidebarSelection } from './sidebar';
import { ALL_DOCUMENTS, buildSidebar, holdsMatches, sameSelection } from './sidebar';
import {
  createWriteSurfaceRegistry,
  type UnregisterWriteSurface,
  type WriteSurfaceTargetReplacement,
  type WriteSurfaceTransition
} from './writeSurfaceRegistry';

/**
 * The commands the browser needs, as one injectable object.
 *
 * The six read-only commands of `../ipc/commands`, with the same signatures, and
 * — since Phase 2b-2a — the ones that write. {@link BrowserCommands.moveMatch},
 * {@link BrowserCommands.saveMatch}, {@link BrowserCommands.createMatch},
 * {@link BrowserCommands.deleteMatch}, {@link BrowserCommands.saveRawDocument},
 * {@link BrowserCommands.duplicateMatch} and (since Phase 3-8-1)
 * {@link BrowserCommands.saveMatchItemText} are the seven members that can change
 * a file on disk, and they are here for the same reason the others are: a test
 * that cannot run Tauri still has to be able to drive a refusal, a conflict and
 * a commit and watch what this state does about each.
 *
 * **Since Phase 2d-4b there is a thirteenth member that is neither**:
 * {@link BrowserCommands.drainExternalChanges} reads what changed on disk
 * underneath the window. It is required like every other member — an optional
 * one would let an omission compile into *there is none*, which is the shape
 * this repository refuses everywhere — and it is added here rather than on a
 * second surface because this step is free to update every implementation of
 * this interface, which the step that added {@link BackupCommands} was not.
 */
export interface BrowserCommands {
  /**
   * Locates and opens a configuration directory.
   *
   * @param root - A directory to open, or `null` to probe the standard ones.
   * @returns The workspace summary, or a failure.
   */
  openWorkspace(root: string | null): Promise<CommandResult<WorkspaceSummary>>;
  /**
   * Lists every file of the open workspace.
   *
   * @returns One summary per file, or a failure.
   */
  listDocuments(): Promise<CommandResult<readonly DocumentSummary[]>>;
  /**
   * Projects one document, parsing it on first use.
   *
   * @param id - The document's session-local identity.
   * @returns The projection, or a failure.
   */
  getDocument(id: DocumentId): Promise<CommandResult<DocumentView>>;
  /**
   * Resolves one match identity against the current parse.
   *
   * @param id - The identity exactly as it arrived.
   * @returns The match, or an identity failure.
   */
  getMatch(id: MatchId): Promise<CommandResult<MatchView>>;
  /**
   * Re-reads one document from disk.
   *
   * @param id - The document's session-local identity.
   * @returns The projection of the bytes now on disk, or a failure.
   */
  reloadDocument(id: DocumentId): Promise<CommandResult<DocumentView>>;
  /**
   * Returns one document's whole text, when the file is valid UTF-8.
   *
   * The one command here that answers with a file's **own text** rather than a
   * projection of it, and the contract is that narrow: exact preservation of
   * valid UTF-8, and a typed refusal otherwise. A file that is not valid UTF-8
   * cannot be shown at all and comes back as `notUtf8`.
   *
   * @param id - The document's session-local identity.
   * @returns The file's text, or a failure.
   */
  documentText(id: DocumentId): Promise<CommandResult<string>>;
  /**
   * Moves one snippet within the list it is in, and saves the file.
   *
   * @param id - The snippet to move, by identity.
   * @param after - The snippet it should follow, or `null` for the top.
   * @param baseRevision - The revision the caller believes the file holds.
   * @param acknowledgement - The suspicions already shown to a person.
   * @returns How the save ended, or a failure.
   */
  moveMatch(
    id: MatchId,
    after: MatchId | null,
    baseRevision: ContentRevision,
    acknowledgement: Acknowledgement
  ): Promise<CommandResult<SaveResult>>;
  /**
   * Writes one snippet's drafted values into its file.
   *
   * @param id - The snippet to save, by identity.
   * @param draft - What the snippet should say, as a whole.
   * @param baseRevision - The revision the caller believes the file holds, and the
   *   revision the draft's indices are positions in.
   * @param acknowledgement - The suspicions already shown to a person.
   * @returns How the save ended, or a failure.
   */
  saveMatch(
    id: MatchId,
    draft: MatchDraft,
    baseRevision: ContentRevision,
    acknowledgement: Acknowledgement
  ): Promise<CommandResult<SaveResult>>;
  /**
   * Writes one new snippet into a file's snippet list, and saves the file.
   *
   * @param document - The file to write into, by the identity this window holds.
   * @param newMatch - What the new snippet says: a typed trigger and a typed
   *   body, both required, plus any of the twelve optional schema-known fields
   *   it is born holding.
   * @param position - Where it goes in the list; the `After` arm names the
   *   snippet it follows **by identity**.
   * @param baseRevision - The revision the caller believes the file holds, and
   *   the revision the anchor identity was minted from.
   * @param acknowledgement - The suspicions already shown to a person.
   * @returns How the save ended, or a failure.
   */
  createMatch(
    document: DocumentId,
    newMatch: NewMatch,
    position: NewMatchPosition,
    baseRevision: ContentRevision,
    acknowledgement: Acknowledgement
  ): Promise<CommandResult<SaveResult>>;
  /**
   * Deletes one snippet from its file, and saves the file.
   *
   * @param id - The snippet to delete, by identity.
   * @param baseRevision - The revision the caller believes the file holds. A
   *   stale one is refused rather than resolved, because the address a deletion
   *   resolves to is a **position**.
   * @param acknowledgement - The suspicions already shown to a person.
   * @returns How the save ended, or a failure. `saved.moved` is `null` by
   *   construction: the snippet that was deleted has no identity in the new
   *   revision.
   */
  deleteMatch(
    id: MatchId,
    baseRevision: ContentRevision,
    acknowledgement: Acknowledgement
  ): Promise<CommandResult<SaveResult>>;
  /**
   * Inserts a byte-exact copy of one snippet immediately after it, and saves
   * the file.
   *
   * @param id - The snippet to copy, by identity.
   * @param baseRevision - The revision the caller believes the file holds.
   * @param acknowledgement - The suspicions already shown to a person. The
   *   ordinary path here is refuse-then-acknowledge: the copy keeps its
   *   source's trigger definition, and the transaction says so first.
   * @returns How the save ended, or a failure. `saved.moved` is the **clone's**
   *   identity in the new revision.
   */
  duplicateMatch(
    id: MatchId,
    baseRevision: ContentRevision,
    acknowledgement: Acknowledgement
  ): Promise<CommandResult<SaveResult>>;
  /**
   * Replaces one file's whole text, and saves it.
   *
   * **The one member whose answer is not a `CommandResult`**, because a
   * committed replacement and a failed invalidation are two facts and both have
   * to survive to the caller (`PROGRESS.md` D2).
   *
   * @param document - The file to replace, by the identity this window holds.
   * @param baseRevision - The revision the text being replaced was loaded at.
   * @param text - The file's whole new text, committed exactly as given.
   * @param acknowledgement - The suspicions already shown to a person.
   * @param reload - What to do once the file has been replaced.
   * @returns How the save ended and what became of the reload, or a failure.
   */
  saveRawDocument(
    document: DocumentId,
    baseRevision: ContentRevision,
    text: string,
    acknowledgement: Acknowledgement,
    reload: ReloadAfterRawSave
  ): Promise<RawSaveOutcome>;
  /**
   * Reads one snippet's owned physical-line range as text, cut in Rust — Phase
   * 3-8-1, over the 3-7 command.
   *
   * Writes nothing. The text is sliced in Rust because a byte span is not a
   * JavaScript string index; nothing on this side cuts it out of a document's
   * text.
   *
   * @param id - The snippet, by identity.
   * @returns The range's text and its display lines, or a failure —
   *   `itemTextRefused` carrying the core's `EditError` among them.
   */
  matchItemText(id: MatchId): Promise<CommandResult<OwnedItemText>>;
  /**
   * Replaces one snippet's owned range with exact text, and saves the file —
   * Phase 3-8-1, over the 3-7 command.
   *
   * @param id - The snippet, by identity.
   * @param baseRevision - The revision the text was read against.
   * @param text - The exact text the range is to hold.
   * @param acknowledgement - The suspicions already shown to a person.
   * @returns How the save ended, or a failure. `saved.moved` is the edited
   *   snippet's identity in the new revision.
   */
  saveMatchItemText(
    id: MatchId,
    baseRevision: ContentRevision,
    text: string,
    acknowledgement: Acknowledgement
  ): Promise<CommandResult<SaveResult>>;
  /**
   * Hands back everything this session observed on disk above `afterSequence`.
   *
   * **The one member that is neither a read of the projection nor a write.** It
   * is the authoritative half of the reconciliation protocol, and it is here for
   * the reason every other member is: a test that cannot run Tauri still has to
   * be able to drive a changed file, an addition, a removal, a lost entry and a
   * stale epoch, and watch what a coordinator does about each.
   *
   * **This file calls it in exactly one place**: the `drain` callback that
   * {@link createBrowserState} hands to `createReconciliationCoordinator`
   * (Phase 2d-5-3), which forwards the coordinator's watermark and nothing else.
   * The watermark, the epoch comparison, the `discarded` response and the
   * decision of *when* a drain fires all belong to the coordinator in
   * `./reconciliationCoordinator.ts`, not to this interface; nothing in
   * TypeScript stops another module holding a `BrowserCommands` from calling it
   * directly.
   *
   * @param afterSequence - The highest sequence the caller has already accepted,
   *   or `0` for everything. Required, because the only honest source for it is
   *   the caller's own installed state.
   * @returns The batch, or a failure.
   */
  drainExternalChanges(afterSequence: number): Promise<CommandResult<ReconciliationBatch>>;
}

/** The real boundary, for the running application. */
export const REAL_COMMANDS: BrowserCommands = {
  openWorkspace,
  listDocuments,
  getDocument,
  getMatch,
  reloadDocument,
  documentText,
  moveMatch,
  saveMatch,
  createMatch,
  deleteMatch,
  duplicateMatch,
  saveRawDocument,
  matchItemText,
  saveMatchItemText,
  drainExternalChanges
};

/**
 * The three read-only backup commands, as one injectable object.
 *
 * **A second surface rather than three more members of {@link BrowserCommands},
 * and the reason is a constraint on the step that added it rather than a
 * property of the design.** Five object literals under `src/lib/components/`
 * implement `BrowserCommands` in full — one each in `DetailPane.test.ts`,
 * `MatchDeleter.test.ts` and `MatchDuplicator.test.ts`, and two in
 * `MatchMover.test.ts` — and Phase 2c-5-4a was scoped to change no file there;
 * three required members added to that interface would not compile in any of
 * them, and three **optional** ones would let an omission compile into "there is
 * none", which is the shape this repository refuses everywhere else. A second
 * surface keeps every member required. Whether the two should be folded into
 * one, in a commit that can update every implementation at once, is left open in
 * `docs/decisions/2c-5-4a-notes.md`.
 *
 * All three **read** and none of them writes; that is proved on the Rust side by
 * `src-tauri/src/commands.rs`'s lexical tripwire and by the whole-tree byte
 * oracle 2c-5-2 added, not here. What this interface exists for is the reason
 * {@link BrowserCommands} exists: a test that cannot run Tauri still has to be
 * able to drive a missing backup folder, a stale batch and an entry that is not
 * valid UTF-8, and watch what a restore session does about each.
 */
export interface BackupCommands {
  /**
   * Lists the recognised backup batches of the open workspace.
   *
   * @returns The listing, or a failure. A missing folder is a **successful**
   *   answer carrying `root: 'Missing'`, never a failure.
   */
  listBackupBatches(): Promise<CommandResult<BackupBatchListing>>;
  /**
   * Lists one recognised batch's entries.
   *
   * @param batch - The opaque identity a batch listing produced, handed back
   *   unchanged. It is not authority: the command re-resolves it.
   * @returns The listing, or a failure.
   */
  listBackupEntries(batch: BackupBatchId): Promise<CommandResult<BackupEntryListing>>;
  /**
   * Reads one backup entry's exact text, for the file it maps to.
   *
   * @param entry - The opaque identity an entry listing produced.
   * @param document - The live file the entry must map to, by identity. The
   *   command refuses when it does not, so one file's copy can never be read
   *   under another file's name.
   * @returns The entry, the document, the exact text and the hash of exactly
   *   those bytes, or a failure.
   */
  readBackupText(
    entry: BackupEntryId,
    document: DocumentId
  ): Promise<CommandResult<BackupTextResponse>>;
}

/** The real backup boundary, for the running application. */
export const REAL_BACKUP_COMMANDS: BackupCommands = {
  listBackupBatches,
  listBackupEntries,
  readBackupText
};

/** Where the workspace load has got to. */
export type BrowserStatus = 'loading' | 'ready' | 'failed';

/**
 * Whether two match identities name the same snippet of the same parse.
 *
 * All three fields, because all three are the identity: the revision is part of it
 * precisely so that a lookup crossing a reparse is refused rather than resolved to
 * whatever now occupies that arena slot.
 *
 * @param held - One identity, or `null`.
 * @param other - The other, or `null`.
 * @returns `true` when both are present and name the same snippet.
 */
function isTheSameIdentity(held: MatchId | null, other: MatchId | null): boolean {
  if (held === null || other === null) {
    return false;
  }
  return (
    held.document === other.document &&
    held.revision === other.revision &&
    held.node === other.node
  );
} // End of function isTheSameIdentity()

/**
 * Where one identity sits in a projection **of the parse it was minted from**.
 *
 * `positionOf` in `./selection.ts` compares the arena node alone, and its own
 * header says why: its caller has just read the projection it is looking in, so a
 * revision mismatch would be a caller error rather than the staleness R27 is
 * about. **An adoption is not that caller.** The identity it resolves is `moved`,
 * minted by the *save* in the revision the transaction ended on, and the
 * projection it looks in comes from a `get_document` performed afterwards — so
 * another program can move the file in between and the fresh parse can reuse the
 * arena node for a snippet nobody created. Resolving by node alone then selects
 * an unrelated snippet and calls it the one just written, which is the first
 * review round's third finding.
 *
 * So all three fields must agree, and the revision is the one doing the work.
 * When they do not, the caller falls back to ordinary repair (positionally and
 * then checked, R27) rather than exposing a stale identity as a current one.
 *
 * @param view - The projection just read.
 * @param id - The identity to resolve, minted in some other parse.
 * @returns The index, or `null` when this projection is of a different parse or
 *   holds no such node.
 */
function positionInSameParse(view: DocumentView, id: MatchId): number | null {
  if (view.id !== id.document || view.revision !== id.revision) {
    return null;
  }
  return positionOf(view, id);
} // End of function positionInSameParse()

/**
 * Copies one match identity out of a command's answer into an object this
 * module owns.
 *
 * **The third level the copy used to stop above.** A {@link MatchId} is what
 * `positionOf` in `./selection.ts` compares — `match.id.node`, one level below
 * where {@link ownedMatchOf} stopped — and {@link positionInSameParse} calls it
 * at all three adoption sites **between the selection-follow guard and the
 * `replaceSelection` that guard justifies**. A getter on a retained `id` runs
 * arbitrary code inside exactly that window, and `CLAUDE.md` records a check and
 * a spend separated by any property read as not atomic.
 *
 * **Field by field, and the return type is the check**, for
 * {@link ownedMatchOf}'s reason. The caveat that claim carries is stated once,
 * in {@link ownedProjectionOf}: it holds for *required* members. `MatchId`'s
 * three are all required today.
 *
 * @param id - An identity as a command answered it, or as a save minted it.
 * @returns An identity whose own properties are data this module wrote.
 */
function ownedMatchIdOf(id: MatchId): MatchId {
  return {
    document: id.document,
    revision: id.revision,
    node: id.node
  };
} // End of function ownedMatchIdOf()

/**
 * The same copy for an identity that may be absent.
 *
 * **Its callers are the three adoptions**, whose `target` and `moved` come from
 * a command's save answer — the same ingress class as a projection, and `null`
 * for every operation that has no such identity. Each of them calls this before
 * its only `await`, so the accessors run before the guard rather than inside it.
 *
 * @param id - The identity, or `null`.
 * @returns A copy this module owns, or `null` for `null`.
 */
function ownedIdentityOf(id: MatchId | null): MatchId | null {
  return id === null ? null : ownedMatchIdOf(id);
} // End of function ownedIdentityOf()

/**
 * Copies one match out of a command's answer into an object this module owns.
 *
 * **Field by field, and the return type is the check.** A field added to
 * {@link MatchView} later is a compile error *in this function* rather than a
 * field it silently stops copying, which is why it is neither a spread nor
 * `structuredClone`: a spread gives no compile-time answer at all, and a
 * structural clone throws on a function-valued property and answers nothing
 * either.
 *
 * **It copies one level, and `id` one level further.** Every field is read here,
 * once, and written into a plain own-property object; the *values* of those
 * fields — `trigger`, `content`, `options`, `search_terms_presence`, and the
 * arrays `search_terms`, `vars`, `form_fields`, `badges` and `unknown_entries`
 * along with their
 * elements — are still the command's own objects, and a getter or a proxy trap
 * on one of those runs whenever something reads it. **`id` is the one
 * exception**, through {@link ownedMatchIdOf}, because it is the only one of
 * those values whose *own* properties this module reads after a guard.
 *
 * @param match - One element of a command-supplied projection's match list.
 * @returns A match whose own properties are data this module wrote.
 */
function ownedMatchOf(match: MatchView): MatchView {
  return {
    id: ownedMatchIdOf(match.id),
    source_node: match.source_node,
    path: match.path,
    span: match.span,
    source_text: match.source_text,
    trigger: match.trigger,
    content: match.content,
    label: match.label,
    comment: match.comment,
    search_terms: match.search_terms,
    search_terms_presence: match.search_terms_presence,
    options: match.options,
    vars: match.vars,
    form_fields: match.form_fields,
    badges: match.badges,
    blocking_hazard: match.blocking_hazard,
    safely_editable: match.safely_editable,
    unknown_entries: match.unknown_entries,
    search_text: match.search_text
  };
} // End of function ownedMatchOf()

/**
 * Copies one projection out of a command's answer into an object this module
 * owns.
 *
 * **The ingress normalizer, and every command-supplied projection goes through
 * it**: `open()`'s per-file `get_document`, the guarded reread's
 * `reload_document`, all five adoptions' `get_document`, the projection a
 * selection repair carries, and the disk snapshot a conflict carries. What that
 * buys is one sentence — **nothing this module retains is an object a command
 * built** — and the sentence matters because `views` is read *after* guards:
 * `installView` compares `view.id` on every element it already holds, and a
 * caller's accessor there would run between the final check and the install.
 *
 * **The getters run once, here, at ingress, before any guard is taken.**
 * `commands` is injected, so every property read below is a read of
 * caller-controlled data and an accessor or proxy trap behind one runs arbitrary
 * code. Doing all of them in this function means they run *before* the
 * comparisons that decide whether the answer may be installed, and never between
 * one of those comparisons and the install it approved.
 *
 * **Exactly how deep it copies, and what it therefore does not promise.** Two
 * levels, plus one field at the third, plus the top-level keys: this view's own
 * fields, each match's own fields ({@link ownedMatchOf}), each match's `id`
 * ({@link ownedMatchIdOf}), and each of `top_level_keys` with its span
 * ({@link ownedScalarOf}). That is the depth this module reads after a guard,
 * and the readers are these five, plus the sixth the keys paragraph below names:
 *
 * - `installView` reads `next.id` and the `id` of every element of `views`;
 * - `repairAfter` reads `view.id` and indexes `view.matches`, and `reresolve`
 *   reads a candidate's `source_text` and its `id`;
 * - `readFileText` reads a held view's `revision`;
 * - {@link positionInSameParse} reads `view.id`, `view.revision` and the
 *   candidate identity's `document` and `revision`;
 * - `positionOf` in `./selection.ts`, which that one calls, reads **every
 *   match's `id.node`** — the third-level read, and the reason the identity copy
 *   exists. The three adoptions call it between the selection-follow guard and
 *   the `replaceSelection` that guard justifies.
 *
 * **`select()` below reads `match.id.document` too, and that one needs no
 * copy**: it takes its intent and projection captures *after* the read rather
 * than before it, so an accessor firing there runs before the comparison it
 * would have to defeat instead of between that comparison and the write. The
 * order is the whole difference, and it is stated here so that changing it is a
 * decision rather than an accident.
 *
 * **And the top-level keys, each with its span** — Phase 2d-6-1c, the phase
 * review's blocker. A sixth reader stands after a guard: `creatorEligibilityFor`
 * reads `top_level_keys[i].text` through `destinationEligibility`, and it is
 * asked inside two guards — the coordinator's `creatorEligibility` host member
 * in `tellTheSurfaceAbout`, and `automaticReloadGuardFor` inside
 * `requestFileReread`'s installation guard, **after** that guard has read the
 * registry list and the two hold tables. With the keys held by reference, a
 * `text` getter there ran caller code between the guard's reads and the
 * installation, and a surface it registered was invisible to the list already
 * taken: the answer installed under a surface that had just opened.
 * {@link ownedScalarOf} copies every key's own fields and its span here, so
 * every later read of one is a read of data this module wrote.
 *
 * **Anything deeper is still the command's own object** — the value of
 * `trigger`, `content`, `options`, `profile`, and the elements of
 * `global_vars`, `imports`, `coverage`, `undescended`, `diagnostics`, `hazards`
 * and `unknown_entries` — so a consumer that walks one of those is reading
 * caller-controlled data, and no type says so.
 *
 * **What the compile-time claim covers, and what it silently does not.** A
 * *required* member added to {@link DocumentView}, {@link MatchView} or
 * {@link MatchId} is a compile error in the function that copies it. An
 * **optional** member is not — an object literal that omits a `?` property
 * still satisfies the type — so the moment one of those types gains one, the
 * copy stops covering it with nothing failing. **None of the three has an
 * optional member today**, which is why the claim holds as written, and nothing
 * enforces that they never gain one.
 *
 * @param view - A projection exactly as a command answered it.
 * @returns A projection whose own properties, and whose matches' own
 *   properties, are data this module wrote.
 */
function ownedProjectionOf(view: DocumentView): DocumentView {
  const matches: MatchView[] = [];
  for (const match of view.matches) {
    matches.push(ownedMatchOf(match));
  } // End of the loop over the projection's matches
  const topLevelKeys: ScalarView[] = [];
  for (const key of view.top_level_keys) {
    topLevelKeys.push(ownedScalarOf(key));
  } // End of the loop over the projection's top-level keys
  return {
    id: view.id,
    path: view.path,
    relative_path: view.relative_path,
    kind: view.kind,
    disabled: view.disabled,
    read_only: view.read_only,
    revision: view.revision,
    byte_len: view.byte_len,
    line_ending: view.line_ending,
    bom: view.bom,
    parsed: view.parsed,
    stream_documents: view.stream_documents,
    shape: view.shape,
    top_level_keys: topLevelKeys,
    matches,
    global_vars: view.global_vars,
    imports: view.imports,
    imports_presence: view.imports_presence,
    profile: view.profile,
    unknown_entries: view.unknown_entries,
    coverage: view.coverage,
    undescended: view.undescended,
    diagnostics: view.diagnostics,
    hazards: view.hazards,
    safely_editable: view.safely_editable
  };
} // End of function ownedProjectionOf()

/**
 * Copies one scalar out of a command's answer into an object this module built —
 * Phase 2d-6-1c.
 *
 * Every own field of {@link ScalarView} and the two numbers of its span, read once
 * here and never again. `text` is the field the guards read; the rest are copied
 * so that the object is wholly this module's rather than a hybrid whose remaining
 * fields would still run a command's accessors. The same compile-time caveat as
 * {@link ownedProjectionOf}: a required field added to `ScalarView` fails here, an
 * optional one does not.
 *
 * @param scalar - A scalar exactly as a command answered it.
 * @returns A scalar whose own properties, and whose span, are data this module
 *   wrote.
 */
function ownedScalarOf(scalar: ScalarView): ScalarView {
  return {
    text: scalar.text,
    decoded: scalar.decoded,
    style: scalar.style,
    span: { start: scalar.span.start, end: scalar.span.end },
    node: scalar.node,
    ambiguous_yaml_1_1: scalar.ambiguous_yaml_1_1
  };
} // End of function ownedScalarOf()

/**
 * Copies one sidebar row out of a command's answer into an object this module
 * owns.
 *
 * **The second ingress class, and it was whole and unnormalized.** `documents`
 * holds what `list_documents` answered and what an `Added` observation carried,
 * and everything that draws a sidebar row, picks the viewer's target or answers
 * a coordinator question reads its elements. Two of those readers are the reason
 * this function exists rather than a general tidy, and both are `held.id` reads
 * that the coordinator makes between an arbitration and a write: `creatorEligibility`
 * runs **inside the coordinator's own guard**, and `holdsDocument` runs between
 * `applyNamedRow`'s `admit` and every status write below it. On caller-supplied data
 * a property read is arbitrary code by `CLAUDE.md`'s rule, so the fix is the one
 * {@link ownedProjectionOf} already sets: copy at ingress, not at the guard.
 *
 * **A third reader is gone rather than answered.** Until Phase 2d-5-4-C the host's
 * reread member had a failure arm whose last fence was a membership test over this
 * list, run immediately before its write; that arm was deleted with the write it
 * fenced (finding 2), so the case in `workspace.test.ts` written to pin it now
 * measures something weaker. What is left above is the whole of the justification.
 *
 * **Field by field and explicitly typed**, for the same compile-time reason and
 * with the same caveat — required members only; {@link DocumentSummary}'s seven
 * are all required today.
 *
 * **One level is the whole type.** Every member is a `number`, a `string` or a
 * `boolean`, so there is no second level for a getter to hide in, and this
 * function needs no depth disclaimer of the kind `ownedProjectionOf` carries.
 *
 * @param summary - A row exactly as a command or an observation supplied it.
 * @returns A row whose properties are data this module wrote.
 */
function ownedSummaryOf(summary: DocumentSummary): DocumentSummary {
  return {
    id: summary.id,
    path: summary.path,
    relative_path: summary.relative_path,
    kind: summary.kind,
    disabled: summary.disabled,
    read_only: summary.read_only,
    loaded: summary.loaded
  };
} // End of function ownedSummaryOf()

/**
 * Copies the projection a selection repair carries into one this module owns.
 *
 * **Taken where the repair lands rather than inside `applyRepair`**, so that the
 * caller-controlled reads happen *before* `select()`'s own staleness check and
 * not between that check and the installation it permits. The two arms that read
 * the document again are the only ones carrying anything; `unresolved` and
 * `unchanged` carry no projection, so they are answered as they are.
 *
 * **The kept selection is re-made too, and its `id` goes through
 * {@link ownedMatchIdOf}.** `reresolve` builds the {@link SelectedMatch} wrapper
 * in `./selection.ts`, so the wrapper's own fields are this project's data — but
 * it fills `id` from `view.matches[position].id` of the projection it was handed,
 * which on this path is `commands.reloadDocument`'s own answer. That identity is
 * then *retained*, and it is read as the last conjunct of the three
 * selection-follow guards — `adoptTheDocumentOnDisk`, `deleteMatch`'s
 * `heldBefore` capture and `duplicateMatch`'s `intent` capture — immediately
 * before the `replaceSelection` each of them justifies. {@link ownedMatchOf}'s
 * header says the same thing of a projection's matches: **`id` is the one
 * exception**, because it is the only value at that level whose own properties
 * this module reads after a guard.
 *
 * **The copy happens here rather than at the guard**, which is where this
 * function is called from: `select()` copies before its own staleness check, so
 * the accessors run before the comparison instead of between it and the write it
 * approves.
 *
 * @param repair - What {@link repairSelection} decided.
 * @returns The same decision, holding a projection and an identity this module
 *   wrote.
 */
function ownedRepair(repair: SelectionRepair): SelectionRepair {
  switch (repair.kind) {
    case 'kept':
      return {
        kind: 'kept',
        selected: {
          id: ownedMatchIdOf(repair.selected.id),
          document: repair.selected.document,
          position: repair.selected.position,
          fingerprint: repair.selected.fingerprint
        },
        reloaded: ownedProjectionOf(repair.reloaded)
      };
    case 'cleared':
      return {
        kind: 'cleared',
        reason: repair.reason,
        reloaded: repair.reloaded === null ? null : ownedProjectionOf(repair.reloaded)
      };
    default:
      return repair;
  } // End of the switch over the repair's four arms
} // End of function ownedRepair()

/**
 * What {@link BrowserState.saveRawDocument} answers.
 *
 * **Two arms, and the second is not "nothing happened".** The first version of
 * this method answered `SealedWholeDocumentSave | null`, and the 2c-1b review was
 * right that `null` collapses two different facts: a command that never reached
 * the file, and a write that **may already have replaced it**. A save that fails
 * after its rename carries `may_have_written: true`, and a screen that renders
 * every `null` as *nothing was written* states the opposite of what the disk may
 * hold — which is `PROGRESS.md` D2 broken from the other side.
 *
 * The reason it is not a `CommandResult` is the same as `RawSaveOutcome`'s: a
 * failure here is a fact about **this window**, and the failure itself has already
 * gone to the reporter. What the caller needs back is not the reason but whether
 * the file may have changed under it.
 */
/**
 * What {@link BrowserState.saveMatch}, {@link BrowserState.createMatch} and
 * {@link BrowserState.deleteMatch} answer.
 *
 * **One type for the three, and that is a decision rather than reuse for its own
 * sake**: the three questions a caller has to be able to ask are identical — did
 * the transaction answer, did this state refuse before anything ran, or did a
 * command run and reject — and the *only* thing that differs between them is what
 * the adoption consisted of, which `adoption` already carries as a status rather
 * than as a description. A delete-shaped variant would have differed in nothing a
 * caller could act on.
 *
 * **Three arms, and none of them is `null`.** The first version of this method
 * answered `SaveResult | null`, and the 2c-2 review was right that the `null`
 * throws away the one bit a screen cannot do without: a command that failed at or
 * after its rename carries `may_have_written: true`, and a caller that cannot tell
 * that from `noWorkspaceOpen` will tell the person nothing was written when the
 * file may already hold the edited snippet. That is `PROGRESS.md` D2 broken from
 * the same side {@link RawSaveAnswer} was written to protect.
 *
 * The `answered` arm carries the adoption's own fate beside the outcome, for the
 * reason the seal of `./invalidation.ts` carries an `InvalidationStatus`: a
 * committed save this window could not re-read is a **successful save and a window
 * out of step**, never a failed save, and a fact with nowhere to go is a fact that
 * reaches the developer console and no screen.
 *
 * **The two ways a save produces no outcome are two arms, not one arm with a
 * nullable reason, and that is the 2c-2-2 review's third finding.** The reason was
 * added as `IpcFailure | null` under a comment saying `null` happened only when no
 * command ran — a comment asserting a guarantee the type did not give, which is
 * this project's own named worst defect class. `{ kind: 'failed', mayHaveWritten:
 * true, failure: null }` type-checked. Now `notAttempted` carries no reason
 * *because there is none*, and `failed` carries one **required**, so the shape
 * cannot describe a command that ran and rejected with nothing to say.
 */
export type MatchSaveAnswer =
  | {
      /** The discriminant: the transaction answered. */
      readonly kind: 'answered';
      /** How the save ended. */
      readonly result: SaveResult;
      /**
       * What became of the adoption a committed save owes.
       *
       * `notOwed` when nothing was written and nothing went stale, `done` when
       * this state re-read the file and re-pointed what it holds, and `failed`
       * when it could not — in which case everything this state held for that file
       * has been **dropped** rather than left on screen describing bytes that are
       * gone, and the file is unprojected until something reads it again.
       *
       * **A `failed` here never means the save failed.**
       */
      readonly adoption: InvalidationStatus;
    }
  | {
      /**
       * The discriminant: this state refused before any command ran.
       *
       * It holds no projection of the file, so there is no base revision to send
       * and an edit would land on whatever now occupies those spans. **Nothing was
       * sent, so nothing can have been written**, and there is no rejection to
       * hand on — which is why this arm carries neither field. A screen may say
       * *nothing was written* for one of these and for nothing else.
       */
      readonly kind: 'notAttempted';
    }
  | {
      /** The discriminant: a command ran, rejected, and produced no outcome. */
      readonly kind: 'failed';
      /**
       * Whether the file may already hold the submitted draft.
       *
       * **A screen must not say "nothing was written" for one of these.**
       */
      readonly mayHaveWritten: boolean;
      /**
       * Why the command rejected. **Required**, because a command ran.
       *
       * **Carried as well as reported, which is 2c-2-2's addition.** The reason
       * still goes to the developer channel — every other failure on this state
       * does — but `save_match`'s most common rejection is `draftRefused`, whose
       * `DraftError` says *which field cannot be written and why*. That is an
       * actionable validation answer belonging beside the field the person was
       * editing (`tDraftError`'s own note), and a fact with nowhere to go is a
       * fact that reaches a console and no screen.
       */
      readonly failure: IpcFailure;
    };

export type RawSaveAnswer =
  | {
      /** The discriminant: the transaction answered, and the outcome is sealed. */
      readonly kind: 'sealed';
      /** How the save ended, readable only by discharging the invalidation. */
      readonly sealed: SealedWholeDocumentSave;
    }
  | {
      /** The discriminant: the command failed and there is no outcome at all. */
      readonly kind: 'failed';
      /**
       * Whether the file may already hold the submitted text.
       *
       * `mayHaveWritten` in `../ipc/errors` is the question, and it is `true` for
       * a failure at or after the rename. **A screen must not say "nothing was
       * written" for one of these**: this window cannot tell, and saying either
       * thing definitely would be a guess about the user's file.
       */
      readonly mayHaveWritten: boolean;
    };

/**
 * One file the load could not read, and which file it was.
 *
 * **The identity is carried rather than recovered.** Before 1c-2b-1 this was a
 * bare {@link IpcFailure}, which the sidebar could name in a block but could not
 * attach to a *row* — so a file whose read was refused showed the same `–` and
 * the same "Not read yet" tooltip as a profile nobody had projected, conflating
 * *could not* with *have not*.
 *
 * Two ways of recovering the identity were rejected. Matching a failure's `path`
 * operand against `DocumentSummary.path` is **unsound**: both are `WirePath`
 * renderings (`crates/espansoconfig-core/src/wire.rs`), so a byte no encoding
 * can name arrives as `U+FFFD` and two different files can produce one string.
 * And not every code carries a path at all — `noWorkspaceOpen` and
 * `menuUnavailable` carry none. The loop that meets the refusal already holds
 * the `DocumentId`, so it keeps it.
 */
export interface LoadFailure {
  /** The document whose read was refused. */
  readonly document: DocumentId;
  /** Why it was refused. */
  readonly failure: IpcFailure;
}

/**
 * What one session receives when this window decides something about an
 * observation of the file it is over — Phase 2d-6-1b, the 2d-6 record's §3
 * entries 2 and 4.
 *
 * **It receives a sealed envelope and never re-arbitrates**: the observation and
 * the verdict inside are this window's one decision, and every receiver
 * registered over the file gets the same object. What a receiver does with it is
 * the session transition's business (entry 11) — the match editor's is
 * `applyObservation` in `./matchEditor.ts` since Phase 2d-6-2, registered through
 * `DetailPane.svelte` since Phase 2d-6-6b; nothing in TypeScript makes a receiver act on the arm it is
 * given, or act on it in order against its own awaited write (entry 5 — see
 * {@link BrowserState.registerObservationReceiver}).
 *
 * **It answers `void`, deliberately.** A return type would be a claim about a
 * protocol between the window and a session that no step has designed; the window
 * learns what a session did by what the session then asks of it.
 */
export type ObservationReceiver = (delivery: ObservationDelivery) => void;

/**
 * Removes one receiver registration, and only that one.
 *
 * **Instance-bound by construction** (the 2d-6 record's §3 entry 1): the closure
 * names the registration it was answered for, so an old child's unregister
 * cannot detach the registration its replacement made, even when both registered
 * the same function. **One-shot and idempotent**: a second call finds nothing and
 * changes nothing. Nothing in TypeScript forces a caller to invoke it, exactly as
 * with `UnregisterWriteSurface`; a receiver whose host never unregisters goes on
 * being delivered to.
 */
export type UnregisterObservationReceiver = () => void;

/**
 * What one press of the person's retry did about a held observation — Phase
 * 2d-6-1b, the 2d-6 record's §3 entries 16-18.
 *
 * **Three answers and never a loop.** Nothing here schedules another attempt:
 * `attempted` says exactly one arbitration ran and its envelope was delivered,
 * whatever arm it reached — including `retained` again, when the tables moved
 * under the attempt, which leaves the observation held and the action askable
 * again — and the other two say no arbitration ran at all.
 */
export type RetainedRetryOutcome =
  | {
      /** The barrier holds nothing for the file, so there is nothing to retry. */
      readonly kind: 'nothingRetained';
    }
  | {
      /**
       * A write this window started is still in flight for the file, so the
       * action is unavailable (entry 16). The held observation is untouched, and
       * that write's own settlement is what will release it.
       */
      readonly kind: 'writeInFlight';
    }
  | {
      /**
       * Exactly one arbitration ran, at the record's original arrival generation,
       * and this is the envelope every receiver over the file was handed.
       */
      readonly kind: 'attempted';
      /** The one decision, sealed. */
      readonly delivery: ObservationDelivery;
    };

/**
 * The brand of an uncertainty acknowledgement. Declared, never exported, never at
 * runtime — the shape `ReloadConfirmation` in `./saveOutcome.ts` uses.
 */
declare const ACKNOWLEDGES: unique symbol;

/**
 * A person's one-shot acknowledgement of one file's uncertainty hold — Phase
 * 2d-6-1b, the 2d-6 record's §3 entry 14.
 *
 * **Minted by {@link BrowserState.uncertaintyAcknowledgementFor} and spent by
 * {@link BrowserState.acknowledgeWriteUncertainty}, and opaque in between.** What
 * it is bound to — the open generation, the file, the uncertainty generation and
 * the standing origin the person reviewed — lives in a table private to the state
 * that minted it, keyed by this object's identity, so a hand-built literal of
 * this shape names nothing and is refused; a caller cannot read, forge or widen
 * the binding. It is a *risk state acknowledged*, never a permission: spending it
 * installs nothing, mints no reload consent and issues no command, and a reload
 * afterwards still needs its own two-step confirmation and `adoptDiskVersion`
 * (entry 15). What the brand cannot force is that the person really reviewed the
 * snapshot; the control that mints one on a press is 2d-6-9's, and only a mounted
 * test can show it is drawn beside that snapshot.
 */
export interface UncertaintyAcknowledgement {
  /** The brand. Never present at runtime, never nameable outside this module. */
  readonly [ACKNOWLEDGES]: typeof ACKNOWLEDGES;
}

/**
 * Why an acknowledgement was refused, in the order the questions are asked.
 *
 * **Decisions, not sentences**: no dictionary key hangs off these, and whether a
 * refusal is drawn at all is 2d-6-9's. A refused acknowledgement spends nothing —
 * the hold stands, and the person may mint a fresh one against the state as it
 * now is.
 */
export type UncertaintyAcknowledgementRefusal =
  /** No state minted this object, or it was minted by another window. */
  | 'unknown'
  /** This acknowledgement was already spent. */
  | 'spent'
  /** `open()` has replaced the workspace the hold was about. */
  | 'workspaceReplaced'
  /** A write this window started is still in flight for the file. */
  | 'writeInFlight'
  /** A newer origin stands for the file than the one the person reviewed. */
  | 'superseded'
  /** The file's projection was replaced after the reviewed origin arrived. */
  | 'projectionReplaced'
  /**
   * The hold this was minted for is gone or is not the current one: it already
   * ended, or a later uncertain write re-established it, and a snapshot reviewed
   * before that write says nothing about it.
   */
  | 'holdMoved';

/**
 * Why no acknowledgement can be minted for one file right now — Phase 2d-6-9a's
 * review, finding 2.
 *
 * The mint's own guards, in the spend's order, as codes. `noHold` and
 * `noStandingOrigin` mean there is nothing to acknowledge at all; `writeInFlight`
 * and `projectionReplaced` mean there is, and the press would be refused.
 */
export type UncertaintyAcknowledgementIneligibility =
  | 'writeInFlight'
  | 'noHold'
  | 'noStandingOrigin'
  | 'projectionReplaced';

/**
 * Whether an acknowledgement of one file's hold could be minted against its
 * standing origin right now — Phase 2d-6-9a's review, finding 2.
 */
export type UncertaintyAcknowledgementEligibility =
  | {
      /** `uncertaintyAcknowledgementFor(standingConflictFor(document))` would mint. */
      readonly kind: 'eligible';
    }
  | {
      /** It would answer `null`. */
      readonly kind: 'ineligible';
      /** The first guard that refuses. */
      readonly reason: UncertaintyAcknowledgementIneligibility;
    };

/** What became of one acknowledgement. */
export type UncertaintyAcknowledgementOutcome =
  | {
      /** Spent, and the hold is ended. Nothing was installed and no command ran. */
      readonly kind: 'acknowledged';
    }
  | {
      /** Nothing was spent and the hold stands. */
      readonly kind: 'refused';
      /** The first question that refused it. */
      readonly reason: UncertaintyAcknowledgementRefusal;
    };

/**
 * Why the wake registration failed, as a code — Phase 2d-6-1c, the 2d-6 record's
 * §3 entry 28.
 *
 * **The sanitizing narrowing.** The coordinator's own `RegistrationState` keeps
 * whatever `subscribe` rejected with, unchanged and typed `unknown`, because a
 * registration failure must stay observable to its own suite; a window gets one
 * of two codes instead, so that no `Error` instance, no Tauri sentence and no
 * developer string crosses out of the model. `noTransport` is the inert default
 * source refusing — a state built with no wake transport, which every test state
 * is — and `rejected` is everything else, a transport that exists and refused.
 * Neither is a message: the EN/ES sentence for each is Phase 2d-6-9a's, selected
 * by the `switch` with a `never` terminus in `workspaceReconciliationStateKey`
 * (`./reconciliationStatus.ts`).
 */
export type RegistrationFailureReason = 'noTransport' | 'rejected';

/**
 * What became of the wake registration, as a window may know it — Phase 2d-6-1c.
 *
 * The coordinator's five arms with the failure arm narrowed to
 * {@link RegistrationFailureReason}. Every value is frozen and built here; nothing
 * a reader gets is an object the coordinator holds.
 */
export type ReconciliationRegistrationState =
  | {
      /** `start()` has not been called. */
      readonly kind: 'idle';
    }
  | {
      /** `subscribe` was called and has not settled. */
      readonly kind: 'registering';
    }
  | {
      /** `subscribe` resolved; a wake reaches this window. */
      readonly kind: 'registered';
    }
  | {
      /** `subscribe` rejected; nothing is listening and nothing pretends to be. */
      readonly kind: 'failed';
      /** Which kind of refusal, as a code. */
      readonly reason: RegistrationFailureReason;
    }
  | {
      /** `subscribe` resolved after disposal and its unlisten was called at once. */
      readonly kind: 'abandoned';
    };

/**
 * What a guarded workspace reload request decided — Phase 2d-6-1c, the 2d-6
 * record's §3 entry 29.
 *
 * **Two request methods share it, and both are decisions, not sentences.** No
 * key hangs off a reason: 2d-6-9 draws these, and what it needs to draw a refusal
 * travels with the arm — which surface kinds are open, which files have a write
 * out — so the drawing step does not have to re-ask a registry that may have
 * moved since the refusal. The refusals are asked in this order, the strongest
 * claim first: a disposed coordinator can reload nothing in this window ever
 * again; a workspace that has not reached `ready` has no membership to refresh
 * and no history to recover; for the lost-history intent alone, a `running`
 * session has nothing to recover from; a write in flight settles on its own and
 * the request is simply early; an open surface is the one refusal the person can
 * act on, and the arm names what to close.
 */
export type WorkspaceReloadOutcome =
  | {
      /**
       * The retained original open request was re-run through `open()`.
       *
       * **Started, not finished**: `open()` is asynchronous and this state's
       * `status` is what says where it got to, exactly as after any other open.
       */
      readonly kind: 'reloading';
    }
  | {
      /** Nothing was reopened. */
      readonly kind: 'refused';
      /** The coordinator has been disposed; no reload can be made from here. */
      readonly reason: 'disposed';
    }
  | {
      /** Nothing was reopened. */
      readonly kind: 'refused';
      /**
       * An `open()` has begun and none has since reached `ready` — one is loading,
       * or the last one failed. The coordinator's gate cannot tell those apart and
       * this reason does not pretend to.
       */
      readonly reason: 'workspaceNotReady';
    }
  | {
      /** Nothing was reopened. */
      readonly kind: 'refused';
      /** A write this window started has not settled. */
      readonly reason: 'writeInFlight';
      /** The files with a write out, in no particular order, without repetition. */
      readonly documents: readonly DocumentId[];
    }
  | {
      /** Nothing was reopened. */
      readonly kind: 'refused';
      /** A write surface is registered; closing it is what permits the request. */
      readonly reason: 'surfaceOpen';
      /** The kind of every open surface, in the registry's own order. */
      readonly surfaces: readonly OpenWriteSurfaceKind[];
    }
  | {
      /** Nothing was reopened. */
      readonly kind: 'refused';
      /**
       * The lost-history request only: reconciliation is `running`, so there is
       * no lost history to recover from. A stale press after a batch-driven
       * recovery already took the permitted reload lands here rather than
       * reloading the window a second time.
       */
      readonly reason: 'notBlocked';
    };

/**
 * Why a guarded file reread was refused — Phase 2d-6-1c, the 2d-6 record's §3
 * entry 32.
 *
 * Four this state asks first, in order; then 1a's three per-file hold reasons in
 * `decideAutomaticReload`'s own order; then the write barrier, last because a
 * write in flight is the one condition that ends by itself. `notAddressable` is a
 * file this window holds no row for, or one an `Added` observation invented and
 * the open workspace does not resolve — `reload_document` would refuse it, so the
 * request refuses first. `blockedByLostHistory` is the consult's *recheck the
 * block*: a session holding everything it has may not clear one file's `stale`
 * mark while its membership is in question.
 */
export type FileRereadRefusalReason =
  | 'disposed'
  | 'workspaceNotReady'
  | 'notAddressable'
  | 'blockedByLostHistory'
  | 'writeInFlight'
  | AutomaticReloadRefusal;

/**
 * What a guarded file reread request did — Phase 2d-6-1c.
 *
 * **Three arms, and `completed` claims less than "installed".** `refused` says
 * which guard refused and *when*: at the request, before any command was sent;
 * or at the installation, after the read answered, because a guard that held
 * when the request was made had moved by the time the answer came back — the
 * read was made and its answer discarded. `failed` is the command's own refusal,
 * reported and answered as every read on this state is. `completed` says the read
 * did not fail and no guard refused it; whether *this* answer was installed is
 * what the projections say, for `rereadDocument`'s reason — an answer the window
 * no longer wanted is discarded rather than applied, and nothing here can tell
 * that from an installation without claiming more than the captures prove.
 */
export type FileRereadOutcome =
  | {
      /** A guard refused. */
      readonly kind: 'refused';
      /** Which one. */
      readonly reason: FileRereadRefusalReason;
      /** Before the read was sent, or immediately before its answer was installed. */
      readonly at: 'request' | 'installation';
    }
  | {
      /** The read itself was refused by the command. */
      readonly kind: 'failed';
      /** Its failure, as reported. */
      readonly failure: IpcFailure;
    }
  | {
      /** The read did not fail and every guard held at the installation. */
      readonly kind: 'completed';
    };

/** The browser's reactive state. */
export interface BrowserState {
  /** Where the load has got to. */
  readonly status: BrowserStatus;
  /** Why the load failed, when it did. */
  readonly failure: IpcFailure | null;
  /**
   * The files that could not be read, in list order.
   *
   * One entry per `get_document` that refused during {@link BrowserState.open}.
   * The workspace still reaches `ready` — one unreadable file must not blank a
   * window that can show the rest — so this is what makes the "All" total
   * honest: while it is non-empty, that total counts only the files that read.
   * Each entry names its document, so the sidebar can mark the row as well as
   * list the reason.
   */
  readonly loadFailures: readonly LoadFailure[];
  /** What `open_workspace` answered, once it has. */
  readonly summary: WorkspaceSummary | null;
  /** Every file of the workspace, in the order the command returned them. */
  readonly documents: readonly DocumentSummary[];
  /**
   * Every projection this window holds, in the order they were read.
   *
   * **Not one per listed file.** A `get_document` that refused leaves no
   * projection and one entry on {@link BrowserState.loadFailures} instead, so a
   * caller building a per-file list walks {@link BrowserState.documents} and
   * looks each one up here — which is what `destinationsOf` in
   * `./matchCreation.ts` does, and why it takes both lists rather than this one
   * alone. A list built from this alone silently omits the files the sidebar is
   * still naming, which is what the design consult's Q5 rejects.
   *
   * Added in 2c-3a-2 because `startMatchCreation` needs it and because a
   * deletion's confirmation is checked against it (`identityInProjection` in
   * `./matchDeletion.ts`). It is the array itself and not a copy: everything on
   * this state is read-only to a caller by type, and nothing here can stop a
   * caller casting the readonly away.
   */
  readonly views: readonly DocumentView[];
  /** The three sidebar groups and the "All" total. */
  readonly sidebar: SidebarModel;
  /** Which sidebar entry is selected. */
  readonly selection: SidebarSelection;
  /** Whatever the search box holds. */
  readonly query: string;
  /**
   * The projection of the file the sidebar selection names, or `null`.
   *
   * `null` in the "All" scope, and `null` for a document whose read was
   * refused. Every document that *read* has one, config profiles included —
   * that is the 1c-2b-1 review's Medium 2, and before it a profile with broken
   * YAML was silent in every pane of this application.
   *
   * It is what the snippet list draws a file's diagnostics and hazards from,
   * and it exists because a file that does not **parse** has no matches at all:
   * nothing in it can be selected, so the detail pane can never be reached for
   * it and the middle pane is the only surface that can say anything about it.
   */
  readonly scopedDocument: DocumentView | null;
  /** The matches in scope for the current sidebar selection, unsearched. */
  readonly scopedMatches: readonly MatchView[];
  /** Those of {@link BrowserState.scopedMatches} the query admits. */
  readonly visibleMatches: readonly MatchView[];
  /** The held selection, or `null`. */
  readonly selected: SelectedMatch | null;
  /** The selected match's projection, or `null` when nothing is selected. */
  readonly selectedMatch: MatchView | null;
  /** The document the selected match lives in, or `null`. */
  readonly selectedDocument: DocumentSummary | null;
  /** What to tell the user about the selection, or `null`. */
  readonly notice: SelectionNotice | null;
  /**
   * The file the raw viewer would show, or `null` when there is none.
   *
   * `rawTarget`'s answer, which is the sidebar's file when the sidebar names
   * one and the selected snippet's file otherwise. Rendered whether or not the
   * viewer is showing, because it is what decides whether the toggle is drawn
   * at all — and a file that does not **parse** has no matches, so this is what
   * makes such a file's text reachable.
   */
  readonly fileTextTarget: DocumentSummary | null;
  /**
   * The revision {@link BrowserState.fileText} was **paired with**, or `null`.
   *
   * **What the raw editor takes its base revision from, and why it is not read off
   * the projection at the moment the editor opens.** `document_text` answers a
   * string and no revision, so the two come from separate reads; this is the
   * revision the file's projection held at the instant that text read *started*,
   * captured then and moved only when the text is.
   *
   * The 2c-1b review found the naive version of this wrong, and it is worth being
   * exact about how. Reading the projection's revision when the editor opens looks
   * equivalent and is not: `installView` can replace a projection without the
   * viewer re-reading — stale-identity recovery does exactly that — so the editor
   * could pair text from revision R0 with a base of R1 and **commit over R1's
   * bytes**. Capturing the revision with the read closes that, and `installView`
   * now drops a snapshot whose projection it replaces, so the pair is refreshed
   * rather than merely made consistent.
   *
   * What is still asserted rather than proven: the pair is two reads, and the
   * capture happens **before** the text read. That bounds the error to one
   * direction — the revision is the older of the two, so a file that moved between
   * them is refused as a conflict — and it does not eliminate it; see
   * `docs/decisions/2c-1b-notes.md` section 8.1.
   *
   * `null` when there is no text, or for a file the load could not project.
   */
  readonly fileTextRevision: ContentRevision | null;
  /** Whether the raw viewer is showing rather than the selected snippet. */
  readonly fileTextShown: boolean;
  /**
   * What has happened to {@link BrowserState.fileTextTarget}'s text.
   *
   * `null` when the viewer is not showing or there is no file to show; one of
   * {@link RawDocumentText}'s four arms otherwise. **A refusal is its own arm**,
   * so a file this app cannot decode never draws as an empty one.
   */
  readonly fileText: RawDocumentText | null;
  /**
   * Installs the disk observation a conflict carried, and repairs the selection.
   *
   * **The sole frontend transition that moves this window to the disk side of a
   * conflict, and the consult's Q2 is why it exists.** Until 2c-4a-2 all six
   * writing wrappers did this eagerly in their own conflict arm — so a save that
   * wrote **nothing** re-ordered the snippet list and moved the selection before
   * the person had chosen anything, leaving their draft on screen against a
   * projection that no longer described it. The Rust-side refresh that produces
   * `ConflictResult.disk` stays: it is required for the two-observation truth and
   * for the command layer's own cache coherence, and the disagreement between this
   * window and that cache until a person chooses is the design rather than a bug.
   *
   * **It authorizes and spends in one call**, which is the 2c-4a-2 review's second
   * finding. The first version took a `DiskAdoption` a surface had obtained
   * earlier: authorization was bound to its conflict and *spending* was bound to
   * nothing, so a retained value could be replayed, handed to another
   * `BrowserState`, or spent while a later conflict was on screen. There is no
   * such value to retain now. **This is an ordered sequence and not a set of checks
   * applied alike**, and 2c-4b-3 is where that is written down: the passage here
   * used to say *"Five things are checked here, in order"* over a flat list of five,
   * with the `alreadyThere` arm described three paragraphs below and saying nothing
   * about where in the order it returns — so a reader drew the conclusion that the
   * generation guarded every successful answer, from the file that decides it. It
   * does not. The real order is:
   *
   * 1. the confirmation was issued for **this** conflict (`authorizeDiskAdoption`);
   * 2. it has not already been spent through this state — one click, one install;
   * 3. **this state produced that conflict**, and about the file the payload names.
   *    `rememberTheConflict` wrote the entry when the conflict arrived, keyed by
   *    the conflict's origin — the one object `saveConflictSource` or
   *    `externalConflictSource` memoizes per wire value — so a conflict from a
   *    *second* `BrowserState` — whose
   *    session-local `DocumentId` may collide with one of this state's — installs
   *    nothing. That is the confirmation pass's residual half of the brand finding;
   * 4. **that conflict still stands for that file** — Phase 2d-5-5b, ruling 26. A
   *    strictly later observation supersedes a conflict's disk side without
   *    installing anything, so no projection generation moves and step 7 below
   *    cannot see it; this is the check that can;
   * 5. the document is still projected here;
   * 6. **the projection already holds the requested revision** — in which case the
   *    request is satisfied, the confirmation is spent, and the answer is
   *    `alreadyThere`;
   * 7. **that projection has not been replaced since the conflict arrived**, which
   *    is asked only of what is left: the branch that is about to install.
   *
   * So the first five precede **every** successful answer, and the generation
   * comparison guards **only** the installing branch — because step 6 has already
   * returned, and spent the token, for a window that holds those bytes.
   *
   * **Step 2 is a reservation, and the 2c-5-4b confirmation review is why.** The
   * membership test and the spend used to be a `has` at the top and an `add` some
   * twenty lines down, with `conflict.source` and `adoption.disk.id` read in between —
   * both caller-controlled, both able to re-enter here synchronously through a getter.
   * The later revision and generation checks were adjudicated as neutralising that,
   * and they do not: **projection generations are per document**, so a conflict whose
   * getters alternate between two remembered documents defeats them. The inner call
   * installs document B and bumps only B's generation; the outer call, already past
   * its `has`, resumes with document A, finds A's generation untouched, and installs A
   * as well. One answer, two projection installations, two selection repairs. The
   * confirmation is therefore reserved **immediately** after the test, with nothing
   * between them, and every refusal that follows releases the reservation so that a
   * refusal still spends nothing. Every caller-controlled read this method makes is
   * taken into a local **before** the reservation, so nothing can re-enter after it.
   *
   * **That last sentence became true at Phase 2d-5-4's second review and was an
   * overclaim before it.** The installing branch ended with
   * `installView(adoption.disk)` and `repairAfter(adoption.disk)` — two property
   * reads on a value a surface assembled, and `repairAfter` then walked that view's
   * `matches` — all of it after the reservation. The snapshot now goes through
   * {@link ownedProjectionOf} in the same block as `conflict.source`, so the branch
   * installs and repairs against an object this module built.
   *
   * **Step 6 is the confirmation pass's High, and the check is a generation rather
   * than `conflict.expected`.** The defect was real: a `rereadDocument` landing
   * while a person read the warning left the window on a *newer* parse, and the
   * confirm then installed the conflict's older snapshot over it and reported
   * success. Comparing the held revision against `conflict.expected` would also
   * catch that — and would refuse legitimate reloads besides, because a session's
   * base revision is frozen at *its* start and the window may have reprojected
   * before the save was even sent. The projection generation asks the narrower
   * question that actually matters: *has anything replaced this file's parse since
   * this conflict was reported?*
   *
   * **A window already holding the disk revision is `alreadyThere`, not a
   * refusal** — the request is satisfied, and the surface may finish. Reporting it
   * as a failure left a confirm control that could never succeed. That arm is step
   * 6 above and not an aside: a window that reprojected to those exact bytes is
   * answered before the generation is inspected at all, so it is *never* refused for
   * having moved — **but it is answered after step 4**, so a conflict a later
   * observation superseded is refused rather than told it is already there.
   *
   * **What none of this forces**: that a surface honours the answer. Nor can this
   * method know which conflict a surface is *currently* resolving; what closes that
   * is each session resetting its reload step whenever a new outcome arrives.
   *
   * It replaces the projection through the same `installView` every adoption uses,
   * so the snippet list, the counts and every `MatchId` minted from the old parse
   * move together; the selection is put back positionally and then checked (R27).
   * Since Phase 2d-6-9b-1 an install also clears the file's `stale` mark when
   * nothing has written the file's status since this conflict was registered — the
   * orchestrator's ruling on `stale`; a status a later observation wrote stands.
   * Everything that invalidates this window happens **synchronously**; the raw
   * viewer's re-read is fired afterwards and is not waited for, because the answer
   * this method owes — *did the window move* — is settled before it starts.
   *
   * **This superseded `rawTextOf`, which is gone.** That method answered *what
   * this window holds of one named document's text*, preferring a per-document
   * capture taken by a second `document_text` call. `ConflictModel.diskText`
   * carries the disk text on the conflict payload, revision-bound, so the capture
   * had nothing left to add — and it kept two defects, a second-read race and the
   * reuse of the viewer's **older** cached answer for the same file
   * (`docs/decisions/2c-4a-1-notes.md` section 4.1).
   *
   * @typeParam T - The drafted value the conflict retained.
   * @param conflict - The conflict being resolved.
   * @param confirmation - What `confirmReloadDiskVersion` issued for it.
   * @returns What became of the request. **`refused` is the only value a caller
   *   must not act on**: a surface that closed its panel on one would be reporting
   *   a reload that did not happen, and `alreadyThere` is a success.
   */
  adoptDiskVersion<T>(
    conflict: ConflictModel<T>,
    confirmation: ReloadConfirmation
  ): DiskAdoptionOutcome;
  /**
   * Registers one **external** observation as a conflict this window produced.
   *
   * **The eighth registration door, and it is the same door** — Phase 2d-5-5a.
   * The seven writing wrappers above register a refused save's origin as the conflict
   * arrives. **The routing that arrived later does not call this method**: an
   * arbitrated observation's origin is registered by the private `arbitrateHere`
   * through `rememberTheConflict` directly, at the generation the observation
   * arrived at, and this method has no production caller — only suites reach it.
   * It stays the public door for a caller that holds a narrowed observation:
   * `adoptDiskVersion` looks the origin up in this state's own map, and an origin
   * no `BrowserState` ever registered installs nothing.
   *
   * **It registers and installs nothing else** — the snippet list, the selection
   * and the viewer are untouched, exactly as a save conflict's registration leaves
   * them. Registering is not adopting.
   *
   * **The file is read off the observation and is never a second argument**, so a
   * caller cannot register an observation of one file against another window's
   * projection of a second.
   *
   * **Registering one observation twice registers it once** (this phase's review,
   * finding 1). The origin is memoized on the observation, so a second call lands
   * on the entry the first wrote and that entry stands: the generation a conflict
   * arrived at is what `adoptDiskVersion` refuses a backwards install by, and
   * renewing it would hand an outlived conflict its authority back. A caller that
   * really has a *newer* observation registers that observation, which is a
   * different object and gets its own entry.
   *
   * **What it forces, and what it does not, in the same sentence.** It forces that
   * the origin it returns is the one memoized object for that observation, so a
   * `ConflictModel` built from the same observation carries the identical source
   * and is found here; it cannot force that the observation was ever narrowed from
   * a wire snapshot by this window, because `ExternalConflictObservation` is an
   * ordinary interface a caller can satisfy by hand.
   *
   * @param observation - The narrowed observation, exactly as this window narrowed
   *   it.
   * @returns The memoized `externalChange` origin now registered.
   */
  rememberExternalConflict(
    observation: ExternalConflictObservation
  ): ExternalChangeConflictSource;
  /**
   * Arbitrates one watcher observation against this window's own state, once, and
   * delivers the one decision to every receiver registered over its file — Phase
   * 2d-5-5b, rulings 25, 26 and 27; Phase 2d-6-1b, the 2d-6 record's §3 entries
   * 2, 4 and 5.
   *
   * **The arbitration/delivery member the record's entry 4 names**, and the only
   * door that applies all three rulings together: ruling 27's barrier first,
   * because a write of this window's own that is still in flight makes every
   * question below it unanswerable; then ruling 25, at the same disk revision the
   * standing conflict wins; then ruling 26, a strictly later observation of
   * different bytes replaces the standing conflict's disk side. The decisions
   * themselves are `arbitrateObservation` and `releaseBarrier` in
   * `./conflictSource.ts`; what this adds is the four tables they are asked about
   * and the receivers the answer goes to.
   *
   * **Arbitrated once, delivered whole.** Two sessions over one file receive the
   * *same* sealed `ObservationDelivery` (`./observationDelivery.ts`), never two
   * verdicts decided independently — which is what stops one answering `raised`
   * and the other `coalesced` for one observation (entry 2). A `retained` answer is
   * delivered too, so a session can say an observation is waiting; and the
   * settlement that later releases it (`beginWrite`'s lease) and the person's
   * {@link retryRetainedObservation} publish through the same private path, so the
   * verdict that ends the wait arrives where the wait was announced. **Who is
   * registered is not this method's question**: since Phase 2d-6-6b the
   * coordinator's `tellTheSurfaceAbout` in `./observationTransitions.ts` calls the
   * `WriteSurfaceTransition` `DetailPane.svelte` registered, and that transition
   * calls this member for the editor, the new-snippet form and the recovery form,
   * since Phase 2d-6-7a for the deleter, the mover and the duplicator, and since
   * Phase 2d-6-8a for the raw editor and restore, whose child-reported receivers
   * the pane registers.
   *
   * **It registers, and it installs nothing.** A verdict that names a new origin
   * goes through the same private registration the seven save wrappers use, at the
   * generation the observation arrived at, and {@link adoptDiskVersion} stays the
   * only confirmed-install door. Nothing here replaces a projection, moves the
   * selection, reads a file, mints reload consent or calls any command — **no save
   * command may ever be initiated by watcher arbitration** (ruling 27), and the
   * narrowest way to say so is that this method reaches no command at all; a
   * signature cannot prove that (entry 18), and `workspace.test.ts` holds the
   * `invoke` spy at zero across every delivery to establish it.
   *
   * **What it deliberately does not do is accounting.** Ruling 25 requires the
   * coalesced observation to be accepted for sequence and watermark accounting all
   * the same; that is `AcceptedSequences.admit` in `./observationTransitions.ts` and
   * the cursor in `./reconciliationCoordinator.ts`, neither of which this method
   * or any delivery touches, so a `coalesced` answer here says nothing about
   * whether the batch was acknowledged, and no publication readmits a sequence.
   *
   * **Nothing forces a caller to have narrowed the observation from a wire
   * snapshot**, exactly as {@link rememberExternalConflict} cannot: the interface is
   * ordinary and this state trusts the caller it is given.
   *
   * @param observation - The narrowed observation, exactly as this window narrowed
   *   it.
   * @returns The envelope every receiver over the file was handed: the observation
   *   and what was decided about it, including whether it is merely being held.
   */
  observeExternalChange(observation: ExternalConflictObservation): ObservationDelivery;
  /**
   * Registers a session's receiver for deliveries about one file — Phase 2d-6-1b.
   *
   * **Where the envelopes of {@link observeExternalChange}, of a write's
   * settlement and of {@link retryRetainedObservation} go.** Delivery is
   * synchronous and in registration order, each receiver is called once per
   * envelope, and a receiver registered or removed *during* a delivery does not
   * change that delivery's recipients. **Decisions arrive in the order they were
   * made, at every receiver**: a publication a receiver makes while being told
   * something is decided at once and delivered after the current envelope has
   * reached every recipient, and one drain hands out each (observation, verdict
   * kind) pair once — so a receiver that re-publishes what it receives comes to
   * rest, while one that manufactures a fresh observation on every delivery does
   * not and cannot be made to. A receiver that throws is reported on this state's
   * failure channel and does not stop its siblings being told, nor turn a settled
   * write into an exception — a settlement publishes from inside the writing
   * wrapper's `finally`, and a committed write is never afterwards reported as an
   * error; a reporter that throws, or a thrown value that cannot be classified, is
   * dropped at that same boundary rather than let through it.
   *
   * **What it is for, and who calls it today.** The 2d-6 record's §3 entry 1
   * routes a child's receiver up through a required callback prop and keeps the
   * registry assembly in `DetailPane`. **Since Phase 2d-6-6b `DetailPane.svelte`
   * calls it**, through the roster in `./surfaceReceivers.ts`, for the editor, the
   * new-snippet form and the recovery form — over the file each names, or over
   * every creator-eligible file while a form names none — and since Phase 2d-6-7a
   * for the deleter, the mover and the duplicator, and since Phase 2d-6-8a for the
   * raw editor and restore, over the file each names.
   *
   * **Entry 5, stated where the code cannot force it.** A settlement is published
   * synchronously from the lease's `close()`, which runs before the wrapper's own
   * promise settles — so the session whose write it was receives the settlement
   * envelope *before* its `await save(...)` continuation runs. The record rules
   * that such a session holds the delivery until it has applied its own result and
   * then consumes the latest valid one, or the continuation overwrites the
   * delivered conflict. **Nothing in TypeScript orders a continuation against a
   * delivery**; that ordering is a mounted-test fact, pinned for the editor by
   * `DetailPane.test.ts` since Phase 2d-6-6b.
   *
   * **Not cleared by `open()`, for {@link registerWriteSurface}'s reason**: a
   * component owns its registration and removes it through the function this
   * answers, and clearing here would leave a still-open surface holding an inert
   * lease. Registering is keyed by nothing but the file: two receivers for one
   * file are two registrations, and the same function registered twice is
   * delivered to twice.
   *
   * @param document - The file the receiver's session is over.
   * @param receiver - What that session is told.
   * @returns The one-shot, instance-bound unregister.
   */
  registerObservationReceiver(
    document: DocumentId,
    receiver: ObservationReceiver
  ): UnregisterObservationReceiver;
  /**
   * Makes one arbitration attempt on the observation the barrier holds for one
   * file, because a person asked — Phase 2d-6-1b, the 2d-6 record's §3 entries
   * 16, 17 and 18.
   *
   * **One press, at most one attempt, and no loop.** Nothing calls this on a
   * surface closing or from an effect, and nothing schedules a second attempt:
   * the record is taken out of the barrier, arbitrated exactly once at **its
   * original arrival generation**, and the envelope is delivered through
   * {@link observeExternalChange}'s path. An attempt whose arbitration finds the
   * tables moved underneath it retains the observation again, at the same arrival
   * generation, and answers `attempted` with a `retained` verdict — held, and
   * askable again. A re-entrant press from inside the attempt finds the barrier
   * already empty and answers `nothingRetained`, so two presses cannot arbitrate
   * one record twice.
   *
   * **Never a fresh {@link observeExternalChange}** (entry 17): that would read
   * today's projection generation and hand evidence that arrived before a
   * projection replacement a freshness it never had — `adoptDiskVersion` would
   * then find the generations equal and install the older snapshot. The record's
   * identity and generation are read off this state's own table, before it is
   * modified; the only caller-controlled operand is the `DocumentId`.
   *
   * **Unavailable during a write in flight** (entry 16): the barrier is closed and
   * the observation is left for that write's settlement, which is the one path
   * that can tell whether the reading was of the bytes the write ended on.
   *
   * **It calls no command, installs no projection and mints no reload consent**
   * (entry 18); a signature cannot prove the first, and the tests' `invoke` spy at
   * zero is what does. Watermark and accepted sequence are untouched, as
   * {@link observeExternalChange} says of every delivery.
   *
   * @param document - The file.
   * @returns What the press did.
   */
  retryRetainedObservation(document: DocumentId): RetainedRetryOutcome;
  /**
   * Mints the one-shot acknowledgement of one file's uncertainty hold, bound to
   * what stands right now — Phase 2d-6-1b, the 2d-6 record's §3 entry 14.
   *
   * **Bound to four facts, all read off this state's own tables**: the current
   * open generation, the file the origin is registered against, the file's
   * current uncertainty generation, and the origin itself, which must be the one
   * standing for the file. The origin's arrival generation must also still be the
   * file's projection generation, exactly as {@link adoptDiskVersion} requires —
   * a snapshot the window has since moved past is not the evidence the person
   * would be acknowledging. `null` when any of that fails, when the file is under
   * no hold, or when a write is in flight; a refusal here spends nothing.
   *
   * **The one caller-controlled operand is the origin object, and it is read by
   * identity only** — a `WeakMap` lookup and a `===` — so no getter of the
   * caller's runs between the questions below and the entry that is written.
   * **Which origin the caller passes is the caller's honesty**: `model.source` of
   * the panel the person is looking at is the honest one, and nothing in
   * TypeScript stops a caller passing the standing origin it never showed.
   *
   * @param source - The origin whose disk snapshot the person reviewed, of either
   *   kind: the `raisedWithoutReload` verdict's `externalChange` origin in the case
   *   the record describes, or a save refusal's, whose `disk_text` is a disk
   *   snapshot too.
   * @returns The acknowledgement, or `null` when nothing may be acknowledged
   *   against the state as it stands.
   */
  uncertaintyAcknowledgementFor(source: ConflictSource): UncertaintyAcknowledgement | null;
  /**
   * Spends one acknowledgement and ends the hold it was minted for, atomically —
   * Phase 2d-6-1b, the 2d-6 record's §3 entries 14 and 15.
   *
   * **The third exit from ruling 27's uncertainty**, beside a later write of this
   * window's own that ends on a named revision and `open()`. It is neither a
   * second installation door nor a `force`: it installs nothing, replaces no
   * projection, mints no reload consent, re-observes nothing and issues no
   * command. What it changes is one fact — the file is no longer under the hold —
   * so that a session may rebuild the conflict's availability; the reload it may
   * then offer still needs its own two-step confirmation and
   * {@link adoptDiskVersion}, which stays revision-checked, and the
   * `raisedWithoutReload` verdicts already delivered are not rewritten.
   *
   * **Refused, spending nothing, when** the object was not minted here, was
   * already spent, `open()` has run since, a write is in flight for the file, a
   * newer origin stands than the one reviewed, the projection was replaced after
   * that origin arrived, or the hold is gone or was re-established by a later
   * uncertain write — in that order, and the first refusal answers.
   *
   * **Check and spend are one synchronous block over this state's own tables.**
   * The only caller-controlled operand is the acknowledgement's identity, read
   * once by a `WeakMap` lookup that runs no user code; every fact compared is a
   * `Map`, `Set` or counter of this state; and the spend — marking the object
   * spent and deleting the file from the uncertain set — follows the last question
   * with no statement between them that could run a getter. What that cannot
   * force is that the acknowledgement was minted against the snapshot the person
   * actually looked at; see {@link uncertaintyAcknowledgementFor}.
   *
   * @param acknowledgement - What {@link uncertaintyAcknowledgementFor} minted.
   * @returns Whether the hold ended, and if not, the first reason it did not.
   */
  acknowledgeWriteUncertainty(
    acknowledgement: UncertaintyAcknowledgement
  ): UncertaintyAcknowledgementOutcome;
  /**
   * Whether an acknowledgement of one file's hold could be minted against the
   * origin standing for it, answered without minting — Phase 2d-6-9a's review,
   * finding 2.
   *
   * **The mint's own guards, through the one function the mint asks**, so a
   * control enabled from this answer and the token a press mints cannot disagree
   * about the four facts it covers: a write in flight, no hold, no standing
   * origin, and a projection replaced since that origin arrived. **It mints
   * nothing, writes nothing and calls no command.** What it cannot predict is the
   * spend's refusals about a token (`spent`, `holdMoved` after a later hold), nor
   * that its answer is still current at the press: a snapshot, rechecked by
   * {@link uncertaintyAcknowledgementFor} and {@link acknowledgeWriteUncertainty}.
   * Reading it subscribes a derivation to the hold tables.
   *
   * @param document - The file.
   * @returns `eligible`, or the first guard that refuses.
   */
  uncertaintyAcknowledgementEligibility(document: DocumentId): UncertaintyAcknowledgementEligibility;
  /**
   * The three per-file facts an automatic reread of one file is decided on —
   * Phase 2d-6-1b, the 2d-6 record's §3 entries 15 and 32.
   *
   * **The state that feeds `decideAutomaticReload` in `./observationDelivery.ts`,
   * answered from this state's own tables and never from a mounted panel.**
   * `uncertaintyUnresolved` is the uncertain set, which outlives any surface —
   * the hold blocks an automatic reread after the surface that raised it closes,
   * per file; `observationRetained` is the barrier's table; `surfaceOpen` is the
   * write-surface registry asked through `targetingSurfaceFor`, the same
   * conservative question the coordinator asks before it rereads. All three are
   * read in one synchronous block and the answer is frozen, and **the block runs
   * no caller code**: every object the eligibility question walks — the rows, the
   * views, and since Phase 2d-6-1c each view's top-level keys — is a copy this
   * module made at ingress. What the type cannot force is that it stays so: a
   * field the predicate starts reading that ingress does not copy puts a
   * command's accessor back inside a guard, and only the key-getter case in
   * `workspace.test.ts` would notice.
   *
   * **A value, not a decision, and not a request.** The predicate that decides is
   * 1a's, and {@link BrowserState.requestFileReread} is the guarded reread request
   * that asks it — at the request and again immediately before installation, the
   * record's entry 32 (Phase 2d-6-1c). This member triggers nothing. What it
   * cannot force is that its answer is still current by the time a caller acts:
   * it is a snapshot, and the caller that installs must ask again inside its
   * guard, which is exactly what that request does.
   *
   * @param document - The file.
   * @returns The three facts, as they stand at the call.
   */
  automaticReloadGuardFor(document: DocumentId): AutomaticReloadGuardInputs;
  /**
   * Which conflict origin currently speaks for one file, or `null`.
   *
   * **The operand ruling 26's "old reapply evidence invalidated" is checked
   * against**: `reapplyEvidenceFor` in `./reapply.ts` refuses evidence taken from a
   * conflict that is not this, and it is a parameter there rather than a lookup, so
   * a caller that never asks this compiles.
   *
   * @param document - The file.
   * @returns The standing origin, or `null` when this state holds no conflict for
   *   it.
   */
  standingConflictFor(document: DocumentId): ConflictSource | null;
  /**
   * Whether a write this state started is still in flight for one file
   * (ruling 27).
   *
   * @param document - The file.
   * @returns Whether the barrier is closed for it.
   */
  writeInFlight(document: DocumentId): boolean;
  /**
   * The observation the barrier is holding for one file, or `null` (ruling 27).
   *
   * **At most one, and it is the newest**: coalescing keeps the latest reading
   * rather than a queue, because two readings of one file are two whole snapshots.
   * **Three things release it**: the settlement of a write for the file, a
   * person's {@link retryRetainedObservation}, and `open()`.
   *
   * @param document - The file.
   * @returns What is held, or `null`.
   */
  retainedObservationFor(document: DocumentId): ExternalConflictObservation | null;
  /**
   * Whether the last settled write this state made for one file may have written
   * and nothing has ended that hold (ruling 27).
   *
   * **It is preserved rather than resolved.** A later watcher snapshot can
   * establish what is on disk and never who wrote it, so no observation clears
   * this. **Three things end it**: a later write of this window's own that
   * *ended* on a named revision, `open()`, and the person's
   * {@link acknowledgeWriteUncertainty} (Phase 2d-6-1b, the 2d-6 record's §5.5) —
   * the last of which establishes nothing about the earlier write and says only
   * that the risk was looked at.
   *
   * @param document - The file.
   * @returns Whether what is on disk for it cannot be attributed and the hold
   *   stands.
   */
  writeOutcomeUncertain(document: DocumentId): boolean;
  /**
   * Every file under a hold — a held observation or an unresolved uncertainty —
   * Phase 2d-6-9b-1, `docs/decisions/2d-6-9a-notes.md` §5 item 3.
   *
   * **The reader the workspace route needs for a file nothing else names**: a
   * removed file whose surface has closed has no row and no surface, and without
   * this its hold would stand with nowhere to draw it and no control to end it.
   * Held observations first, then uncertain files, each in insertion order and
   * without repetition. Reading it subscribes a derivation to the hold tables. It
   * writes nothing and calls no command.
   *
   * @returns The files, frozen.
   */
  heldDocuments(): readonly DocumentId[];
  /**
   * Opens a configuration directory and loads every file that holds matches.
   *
   * @param root - A directory to open, or `null` to probe the standard ones.
   */
  open(root: string | null): Promise<void>;
  /**
   * Points the snippet list at one sidebar entry.
   *
   * @param next - The entry to show.
   */
  show(next: SidebarSelection): void;
  /**
   * Sets the search query.
   *
   * @param next - Whatever the search box now holds.
   */
  search(next: string): void;
  /**
   * Selects one match, then checks that its identity still resolves.
   *
   * @param match - The match a row was rendered from.
   */
  select(match: MatchView): Promise<void>;
  /** Drops the selection and any notice about it. */
  clearSelection(): void;
  /** Dismisses the notice without touching the selection. */
  dismissNotice(): void;
  /**
   * Shows or hides the raw viewer, reading the file's text when it is shown.
   *
   * Turning it **on** always re-reads, even for a file whose text was read a
   * moment ago: the answer is a snapshot of a file on disk and this application
   * has no watcher, so the only honest moment to take one is when the reader
   * asks to see it.
   *
   * @param on - Whether the file's text should be showing.
   */
  showFileText(on: boolean): Promise<void>;
  /**
   * Reads one file again and puts what it finds in place of what this state holds.
   *
   * **The one public re-read of a single document, and it exists for a recovery.**
   * `commands.reloadDocument` was reachable only from inside `select()`'s own
   * repair until Phase 2c-3b step 2, so `MoveRecovery.reloadFile` in
   * `./matchMove.ts` — the consult's Q8 answer, *read this file again* beside the
   * four codes that say this window and the file disagree about an address — was a
   * code with nothing behind it. This is what is behind it.
   *
   * It is a **re-read, never a repair of anything else**: the projection is
   * replaced through the same `installView` every adoption uses, so the snippet
   * list, the counts and every `MatchId` minted from the old parse move together,
   * and the selection is put back the ordinary way — positionally and then checked,
   * so bytes at the held position that are not the bytes that were selected drop it
   * with a notice (R27) rather than being silently adopted. The raw viewer's snapshot goes too, because it
   * describes bytes this state has just stopped vouching for.
   *
   * A re-read that fails is reported on the one channel every other failure of this
   * state uses **and answered**, so a caller can say on screen that the file could
   * not be read rather than leaving the person with a control that appeared to do
   * nothing. It leaves the stale projection in place: nothing here knows that the
   * file is gone, only that this attempt did not reach it, and dropping a file's
   * whole projection is a bigger claim than a failed read supports. **What that
   * failure means for the caller's own session is the caller's**, and the one there
   * is decides it: `moveRecoveryFailed` in `./matchMove.ts` spends a move session
   * whose recovery re-read failed, because that recovery is offered only after the
   * command has said this window's address disagrees with the file.
   *
   * **An answer that is no longer wanted installs nothing**, and that is the first
   * review of Phase 2c-3b step 2's High finding. Three captures taken before the
   * await decide it — the workspace generation, a per-document re-read generation,
   * and that document's projection generation — so a workspace replaced mid-read,
   * an overlapping re-read of the same file, and a projection installed meanwhile by
   * any other path each leave this answer discarded rather than applied.
   *
   * **`null` therefore means the read did not fail, not that this call installed
   * anything.** A caller that needs to know what the window now holds reads the
   * projections; a discarded answer is one where something newer already did.
   *
   * **What no type forces**, in the same sentence as what one does: nothing makes a
   * caller act on the answer, and nothing here can tell a recovery a person asked
   * for from a re-read some other code path wanted. What it does force is that the
   * projection, the viewer's held text and the selection move together, which is
   * the invariant `installView` exists for.
   *
   * @param document - The file to read again.
   * @returns The failure of the read, or `null` when it did not fail.
   */
  rereadDocument(document: DocumentId): Promise<IpcFailure | null>;
  /**
   * Moves one snippet inside the list it is in, and saves the file.
   *
   * **The first of the seven entry points on this state that change a file**; the
   * others are {@link BrowserState.saveMatch},
   * {@link BrowserState.createMatch}, {@link BrowserState.deleteMatch},
   * {@link BrowserState.saveRawDocument}, {@link BrowserState.duplicateMatch} and
   * {@link BrowserState.saveMatchItemText}. Everything else here reads.
   *
   * **The wrapper is the enforcement**, exactly as it is for
   * {@link BrowserState.saveMatch}: a committed move makes every `MatchId` this
   * window holds for that file stale, `SavedResult.moved` is the moved snippet's
   * identity in the new revision, and the adoption happens **here**, before the
   * answer is handed back, so there is no way to obtain the result without it.
   *
   * **The selection follows the moved snippet only when it is still the moved
   * snippet.** `adoptTheDocumentOnDisk` compares the held selection against the
   * identity this call was about, so a person who clicked another snippet while
   * the move was in flight is not dragged back to this one; any other selection in
   * the file is repaired the ordinary way, positionally and then checked (R27).
   *
   * **An adoption that could not be performed is carried, not swallowed**, which
   * is the second of the three latent shapes 2c-3b inherited. If the move commits
   * and the re-read then fails, everything this state holds for that file is stale
   * and cannot be refreshed: the projection and the held selection are **dropped**
   * rather than left on screen describing bytes that are gone, and `adoption`
   * comes back `failed` beside the committed outcome. The move succeeded; the
   * window is out of step. Those are two facts and both survive (`PROGRESS.md`
   * D2). Until 2c-3b-1 the re-read's answer was discarded and the stale projection
   * stayed installed.
   *
   * **The base revision is the caller's and is forwarded unchanged**, exactly as it
   * is for {@link BrowserState.createMatch} and {@link BrowserState.deleteMatch}.
   * This method read `view.revision` at the moment of the call until the 2c-3a-1
   * confirmation pass, which is the shape the first review round's second finding
   * closed for the other two: a stale R0 submission presented after the window had
   * reprojected to R1 was sent *as though drafted at R1*, so the core found no
   * conflict and answered an identity failure instead of the revision conflict that
   * describes what happened. `baseRevisionOf` in `./matchMove.ts` is where a
   * session's own base is.
   *
   * **What that does not force, in the same breath.** Nothing in TypeScript stops
   * a component importing `moveMatch` from `../ipc/commands` and calling it
   * directly, which bypasses this method entirely — the hole every writing command
   * has had since 2b-2a. Nor can any signature require `baseRevision` to be the
   * session's own rather than whatever the window is projecting, or require a
   * caller to *read* `adoption`. What the wrapper forces is that every caller
   * **of it** adopts, and that this layer no longer chooses the revision on the
   * caller's behalf; what keeps the other door shut is that no `.svelte` file
   * imports `../ipc/commands` at all, which is a fact about the code as written
   * and not a guarantee.
   *
   * **Identities, like the other four writing methods, and that changed at
   * 2c-3b-2.** This took `MatchView`s until step 2 gave it a component: only `.id`
   * was ever read from either argument, so the projections were friction rather
   * than information, and the friction was real — `beginMove` in `./matchMove.ts`
   * produces a `StartedMove` whose `match` and `after` are `MatchId`s, so a caller
   * had to look each one up in a projection again to satisfy the old signature, and
   * a lookup that answers `undefined` is a way for a decided move to be dropped
   * between the model and the wire. `docs/decisions/2c-3b-1-notes.md` recorded the
   * deferral; `docs/decisions/2c-3b-2-notes.md` records the choice.
   *
   * @param match - The snippet to move, by the identity the caller's session holds.
   * @param after - The snippet it should follow, or `null` for the top of the
   *   list. Already lowered by the caller: the destination panel's *end* is an
   *   identity by the time it reaches here, because the wire has no such anchor.
   * @param baseRevision - The revision the caller's move was decided against.
   *   Sent unchanged.
   * @param acknowledgement - The suspicions already shown to a person; pass
   *   `{ accepted: [] }` on a first attempt.
   * @returns How the save ended together with the adoption's own fate; a refusal
   *   this state made before any command ran; or a command failure that says
   *   whether the file may already have been written and why it rejected.
   */
  moveMatch(
    match: MatchId,
    after: MatchId | null,
    baseRevision: ContentRevision,
    acknowledgement: Acknowledgement
  ): Promise<MatchSaveAnswer>;
  /**
   * Writes one snippet's drafted values into its file.
   *
   * **The wrapper is the enforcement, and this is exactly what it enforces.** A
   * committed field save makes every `MatchId` this window holds for that file
   * stale, and `SavedResult.moved` is the snippet's identity in the new revision.
   * The design consult's Q6 says a caller that ignores it succeeds once and is
   * then rejected on every later edit, save or selection lookup — so the adoption
   * happens **here**, before the answer is handed back, and there is no way to
   * obtain the result without it. That is the consult's second option: a single
   * enforced wrapper rather than a sealed one-shot outcome, chosen because a field
   * save has one identity to answer with and does not need the ceremony that
   * `./invalidation.ts` exists to impose on a replacement that has none.
   *
   * **An adoption that could not be performed is carried, not swallowed.** If the
   * save commits and the re-read then fails, everything this state holds for that
   * file is stale and cannot be refreshed: the projection and the held selection
   * are **dropped** rather than left on screen describing bytes that are gone, and
   * `adoption` comes back `failed` beside the committed outcome. The save
   * succeeded; the window is out of step. Those are two facts and both survive.
   * Since Phase 2d-6-6c-2 the same holds for an **exception** thrown by the
   * adoption or the re-read after a commit, and for one whose classification
   * throws: it is caught and answered as a `failed` adoption beside the `saved`
   * outcome, and the promise does not reject. Since Phase 2d-6-7a that is one
   * policy, `adoptAfterTheCommit`, shared by this method, `createMatch`,
   * `moveMatch`, `deleteMatch` and `duplicateMatch`.
   *
   * **The base revision is the caller's and is forwarded unchanged**, which is the
   * last half of the 2c-3a-1 review's second finding and was closed at 2c-3a-2.
   * This method read `view.revision` at the moment of the call until then — so an
   * editor opened at R0 over a window that had since reprojected to R1 was
   * submitted *as though drafted at R1*, the core found no conflict, and a save was
   * committed into a parse the person never saw. It was the last of the three to be
   * closed because it is the only one of them with a component caller:
   * `matchEditor.baseRevisionOf(session)` is what `MatchEditor.svelte` passes, and
   * the signature and that caller moved in one commit.
   *
   * **What that does not force, in the same breath.** Nothing in TypeScript stops
   * a component importing `saveMatch` from `../ipc/commands` and calling it
   * directly, which bypasses this method entirely — the same hole `moveMatch` and
   * `saveRawDocument` have had since 2b-2a, and one no type in this repository can
   * close. Nor can any type require a caller to *read* `adoption`, or require
   * `baseRevision` to be the session's own rather than whatever the window is
   * projecting; what it can do is make the failure survive as a value on the answer
   * instead of as a line in a developer console. What the wrapper forces is that
   * every caller *of it* adopts and that this layer no longer chooses the revision
   * on the caller's behalf; what keeps the other door shut is that this is the only
   * path any component uses, which is a fact about the code as written and not a
   * guarantee.
   *
   * A snippet identified by `MatchId` rather than by `MatchView`, unlike
   * {@link BrowserState.moveMatch}: an editor adopts the identity a save answers
   * with, and there is no projection to go with it until the file is read again.
   *
   * @param id - The snippet to save, by the identity the caller drafted against.
   * @param draft - What the snippet should say, as a whole.
   * @param baseRevision - The revision the **draft** was seeded from, from
   *   `baseRevisionOf` in `./matchEditor.ts`. Sent unchanged.
   * @param acknowledgement - The suspicions already shown to a person; pass
   *   `{ accepted: [] }` on a first attempt.
   * @returns How the save ended together with the adoption's own fate; a refusal
   *   this state made before any command ran; or a command failure that says
   *   whether the file may already have been written and why it rejected.
   */
  saveMatch(
    id: MatchId,
    draft: MatchDraft,
    baseRevision: ContentRevision,
    acknowledgement: Acknowledgement
  ): Promise<MatchSaveAnswer>;
  /**
   * Writes one new snippet into a file's snippet list, and saves the file.
   *
   * **The wrapper is the enforcement**, exactly as it is for
   * {@link BrowserState.saveMatch}: a committed create makes every `MatchId` this
   * window holds for that file stale, `SavedResult.moved` is the **created**
   * snippet's identity in the new revision, and the adoption happens here, before
   * the answer is handed back, so there is no way to obtain the result without it.
   *
   * **The selection moves to the created snippet**, under two conditions that are
   * this method's own decision and are stated rather than assumed. `saveMatch`
   * re-points only when the held selection is still the snippet the save was
   * about; a create has no such target, so the rule applied instead is:
   *
   * - the held selection must be **exactly what it was when this call started**,
   *   which is the same protection stated for a different question — a person who
   *   clicked another snippet while the create was in flight must not be dragged
   *   away from it;
   * - the sidebar must be showing a scope that **contains** the new snippet — the
   *   "All" entry, or that same file. Selecting a snippet the middle pane is not
   *   listing would leave the window pointing at a row nobody can see.
   *
   * When either fails, or when the command answered no identity, the selection is
   * repaired the ordinary way (positionally and then checked, R27).
   *
   * **The base revision is the caller's and is forwarded unchanged**, which is the
   * 2c-3a-1 review's second finding. This method used to read `view.revision` at
   * the moment of the call and send that, which silently rebased a stale form: a
   * form opened at R0, a reprojection to R1 while it was open, and a submission
   * that the core then found no conflict in — so a snippet was written into a file
   * whose parse the person never saw, at an anchor resolved in it. The form's own
   * base is `submission.baseRevision` in `./matchCreation.ts`, and nothing between
   * it and `create_match` may substitute another.
   *
   * **What that does not force, in the same breath.** Nothing in TypeScript stops
   * a component importing `createMatch` from `../ipc/commands` and calling it
   * directly, which bypasses this method entirely — the same hole `moveMatch`,
   * `saveMatch` and `saveRawDocument` have had since 2b-2a. Nor can a signature
   * require `baseRevision` to be *the submission's*: a caller may pass the
   * projection's current one and get the old behaviour. What the wrapper forces is
   * that every caller *of it* adopts, and that this layer no longer chooses the
   * revision on the caller's behalf.
   *
   * @param document - The file to write into, by the identity this window holds.
   * @param newMatch - What the new snippet says: a trigger and a body, plus any
   *   of the four optional schema-known fields it is born holding.
   * @param position - Where it goes in the file's list.
   * @param baseRevision - The revision the **submission** was drafted from, and
   *   the revision its anchor identity was minted in. Sent unchanged.
   * @param acknowledgement - The suspicions already shown to a person; pass
   *   `{ accepted: [] }` on a first attempt.
   * @returns How the save ended together with the adoption's own fate; a refusal
   *   this state made before any command ran; or a command failure that says
   *   whether the file may already have been written and why it rejected.
   */
  createMatch(
    document: DocumentId,
    newMatch: NewMatch,
    position: NewMatchPosition,
    baseRevision: ContentRevision,
    acknowledgement: Acknowledgement
  ): Promise<MatchSaveAnswer>;
  /**
   * Deletes one snippet from its file, and saves the file.
   *
   * **`moved` is `null` permanently and every `MatchId` for that file is stale**,
   * so there is no identity to adopt — which makes this the one writing command
   * whose invalidation is neither an adoption nor the whole-document seal. What
   * happens instead, after the file has been read again:
   *
   * - when the held selection **was the snippet deleted**, the snippet now
   *   occupying its former **ordinal** position is selected, falling back to the
   *   new last snippet when the deleted one was last, and to no selection when the
   *   file now holds none. A `deleted` notice says so.
   *
   *   **This is not the positional reasoning `moved: null` forbids**, and the
   *   difference is worth being exact about. Nothing here preserves or
   *   re-resolves the stale identity: the projection is replaced whole, the
   *   window looks at the fresh one, and the snippet it selects is adopted under
   *   its **own new identity**. What distinguishes it from R27's `differentMatch`
   *   case — where changed bytes at the held position drop the selection —
   *   is that there the file changed underneath the person, and here they asked
   *   for the change themselves. Selecting a neighbour may still read as
   *   continuity with something that no longer exists, which is the design
   *   consult's own counter-argument to its Q1, and is why the notice is shown;
   * - when the held selection was a **different** snippet of that file, it is
   *   repaired the ordinary way (positionally and then checked, R27) and this
   *   method does not touch it.
   *
   * **The base revision is the caller's and is forwarded unchanged**, exactly as
   * it is for {@link BrowserState.createMatch} and for the same finding. It
   * matters more here than anywhere else on this state: a deletion resolves an
   * identity to a **position**, so a session opened at R0 and submitted after the
   * window re-read the file at R1 used to be sent with R1 beside an R0 identity —
   * which the core answers as an identity failure rather than as the revision
   * conflict the person should be shown, and which nothing in this window decided.
   *
   * The same hole as {@link BrowserState.createMatch}: nothing stops a component
   * importing `deleteMatch` from `../ipc/commands` and skipping this method,
   * nothing here requires the caller to have collected a confirmation —
   * `./matchDeletion.ts` is what makes a confirmation the only way to *produce*
   * something to send — and no signature can require `baseRevision` to be the
   * session's own.
   *
   * @param id - The snippet to delete, by the identity the caller holds.
   * @param baseRevision - The revision the caller's session was opened at, from
   *   `baseRevisionOf` in `./matchDeletion.ts`. Sent unchanged.
   * @param acknowledgement - The suspicions already shown to a person; pass
   *   `{ accepted: [] }` on a first attempt.
   * @returns How the save ended together with the adoption's own fate; a refusal
   *   this state made before any command ran; or a command failure that says
   *   whether the file may already have been written and why it rejected.
   */
  deleteMatch(
    id: MatchId,
    baseRevision: ContentRevision,
    acknowledgement: Acknowledgement
  ): Promise<MatchSaveAnswer>;
  /**
   * Inserts a byte-exact copy of one snippet immediately after it, and saves
   * the file.
   *
   * **The sixth entry point on this state that changes a file, and the wrapper
   * is the enforcement**, exactly as it is for {@link BrowserState.moveMatch}:
   * a committed duplicate makes every `MatchId` this window holds for that
   * file stale — the source's included — `SavedResult.moved` is the **clone's**
   * identity in the new revision, and the adoption happens **here**, before
   * the answer is handed back, so there is no way to obtain the result without
   * it.
   *
   * **The selection follows the clone only for an unchanged initiating
   * intent, checked at the moment the selection is written.** The selection
   * and the global `selectGeneration` are captured **before** the command is
   * sent, travel whole into `adoptAfterTheDuplicate`, and are re-validated
   * **after that helper's own re-read await**, in the same synchronous block
   * as the write — so the guard holds across every await on the path, the
   * command's and the adoption's. A person who clicked another snippet
   * mid-flight, was elsewhere and selected the source mid-flight, left the
   * source and returned to it — during either await — or whose failed
   * `select()` bumped the intent counter without landing an assignment, has
   * expressed a new intent, and the clone is not followed: the selection is
   * repaired the ordinary way, positionally and then checked (R27), where
   * `displacedByDuplicate` is the routine answer for a selection below the
   * source, because the insertion shifted every later position down by one.
   * (Review round 1's High finding, in two passes: the first version compared
   * the *current* selection against the source, so a leave-and-return history
   * was reclaimed; the first fix validated the capture between the two awaits,
   * so a leave-and-return during the adoption's own re-read still was.)
   *
   * **The committed adoption passes `'requestedDuplicate'`**, the duplicate's
   * own attribution rather than a reuse of the move's: the move's sentences say
   * *reordered*, which an insertion did not do, and a notice claiming it would
   * be a false record. It is honoured only against the parse the write itself
   * produced — `adoptTheDocumentOnDisk`'s own guard — and the
   * `may_have_written` path keeps the default `externalChange`, because an
   * uncertain write cannot claim the copy and the sentence that claims less
   * wins.
   *
   * **An adoption that could not be performed is carried, not swallowed.** If
   * the duplicate commits and the re-read then fails, everything this state
   * holds for that file is stale and cannot be refreshed: the projection and
   * the held selection are **dropped** through `forgetTheReplacedDocument`
   * rather than left on screen describing bytes that are gone, and `adoption`
   * comes back `failed` beside the committed outcome. The duplicate succeeded;
   * the window is out of step. Those are two facts and both survive
   * (`PROGRESS.md` D2). Since Phase 2d-6-7a the same holds for an exception
   * thrown by the adoption or the re-read, as it does for
   * {@link BrowserState.saveMatch}: the promise does not reject after a commit.
   *
   * **The base revision is the caller's and is forwarded unchanged**, exactly
   * as it is for the other writing wrappers: `baseRevisionOf` in
   * `./matchDuplication.ts` is where a session's own base is, and reading
   * `view.revision` here instead would rebase a duplicate the window has moved
   * on from and turn the conflict that should stop it into a commit.
   *
   * **What that does not force, in the same breath.** Nothing in TypeScript
   * stops a component importing `duplicateMatch` from `../ipc/commands` and
   * calling it directly — the hole every writing command has had since 2b-2a —
   * nor can any signature require `baseRevision` to be the session's own, or
   * require a caller to *read* `adoption`. What the wrapper forces is that
   * every caller **of it** adopts.
   *
   * @param match - The snippet to copy, by the identity the caller's session
   *   holds.
   * @param baseRevision - The revision the caller's duplicate was decided
   *   against. Sent unchanged.
   * @param acknowledgement - The suspicions already shown to a person; pass
   *   `{ accepted: [] }` on a first attempt. The ordinary path here is
   *   refuse-then-acknowledge, because the copy keeps its source's trigger
   *   definition.
   * @returns How the save ended together with the adoption's own fate; a
   *   refusal this state made before any command ran; or a command failure
   *   that says whether the file may already have been written and why it
   *   rejected.
   */
  duplicateMatch(
    match: MatchId,
    baseRevision: ContentRevision,
    acknowledgement: Acknowledgement
  ): Promise<MatchSaveAnswer>;
  /**
   * Replaces one file's whole text, and saves the file.
   *
   * **The fifth entry point on this state that changes a file, and the only one
   * that is not an edit.** It exists here rather than being called through
   * `../ipc/commands` directly because the invalidation a committed replacement
   * owes is about *this module's* cache: the projections, the selection and the
   * raw viewer's snapshot are all held here, so nothing outside can be trusted to
   * forget them. The wrapper's `reload` parameter is still what makes the
   * boundary drivable by a test; what closes the obligation on the running path
   * is that this method supplies its own.
   *
   * On a committed save this **forgets everything cached for that file** — the
   * projection, the held selection's identity and position, and the raw viewer's
   * text — and then reads the file again. Nothing is re-pointed by identity, as a
   * move's recovery does: a replacement rewrites the whole document, so there is
   * no identity to re-point with and `moved` is `null` by construction. The
   * selection is looked for the ordinary way and dropped with a notice when what
   * is at its position is not what was selected (R27).
   *
   * A command that failed answers the `failed` arm of {@link RawSaveAnswer}, which
   * carries whether the file **may already hold the submitted text**; a reload that
   * failed after a commit is **not** a failure of the save and does not produce
   * one — it is reported on the failure channel, carried on the seal, and the
   * committed outcome still comes back.
   *
   * **The answer is sealed** (`docs/decisions/2c-1a-notes.md` section 4.2, decided
   * at 2c-1b). `sealWholeDocumentSave` is called *here*, in the adapter that
   * issued the save and therefore knows which document it was about, so the
   * pairing of a document with a result happens once instead of being re-asserted
   * by every caller that wants to describe it. Three things follow, and the last
   * is the one worth stating plainly:
   *
   * - `describeWholeDocumentSave` in `./saveOutcome` takes a
   *   `WholeDocumentOutcome`, which only the seal produces, so a caller cannot
   *   accidentally present a whole-document replacement with the edit describer
   *   and lose the *this replaces the entire document* disclosure;
   * - the seal carries **what this state's own invalidation did**, so a committed
   *   save whose re-projection failed reaches a screen as *the file was written
   *   and this window is out of step* rather than as a clean success with a line
   *   in the developer console;
   * - the seal's callback is **not** what invalidates this state's cache. That has
   *   already happened by the time a caller can open it: the closure below is
   *   passed to the command, which calls it before its promise resolves, which is
   *   the only moment early enough (`docs/decisions/2b-2c-3b-notes.md` section 3).
   *   What the seal forces is that a caller cannot read the outcome without
   *   running a routine of its own.
   *
   * @param document - The file to replace, by the identity this window holds.
   * @param baseRevision - The revision the file held when the text being replaced
   *   was loaded. Never one re-read just before saving: it is the only thing
   *   standing between this call and silently overwriting whatever changed the
   *   file since.
   * @param text - The file's whole new text, committed exactly as given.
   * @param acknowledgement - The suspicions already shown to a person; pass
   *   `{ accepted: [] }` on a first attempt.
   * @returns The sealed outcome, or a failure that says whether the file may
   *   already have been written.
   */
  saveRawDocument(
    document: DocumentId,
    baseRevision: ContentRevision,
    text: string,
    acknowledgement: Acknowledgement
  ): Promise<RawSaveAnswer>;
  /**
   * Reads one snippet's owned text for the local raw editor — Phase 3-8-1.
   *
   * **A read this state performs and does not remember**, in the shape of
   * {@link BrowserState.listBackupBatches}: the failure is reported on the
   * developer channel and answered to the caller, so `openRawSnippet` in
   * `./rawSnippet.ts` can turn an `itemTextRefused` into a value a screen draws —
   * `ItemRangeNotContiguous` into the whole-document editor's offer. The text is
   * cut in Rust; nothing here slices a document's text by a byte span.
   *
   * It is on this state rather than imported from `../ipc/commands` by a component
   * because no `.svelte` file in this repository imports that module, which is a
   * fact about the code as written rather than a guarantee any type gives.
   *
   * @param id - The snippet, by identity. A stale one is refused by the command
   *   as `identityStaleRevision`.
   * @returns Whatever `match_item_text` answered, unchanged.
   */
  matchItemText(id: MatchId): Promise<CommandResult<OwnedItemText>>;
  /**
   * Replaces one snippet's owned range with exact text, and saves the file —
   * Phase 3-8-1, the seventh entry point on this state that changes a file.
   *
   * **{@link BrowserState.saveMatch}'s wrapper, over a different command**, and
   * the one body both run: ruling 27's barrier opens before the command and closes
   * in a `finally`; a failure that may have written re-reads the file; a commit
   * forgets the viewer's text and adopts the file through `adoptAfterTheCommit`,
   * which re-points a held selection of this snippet to `saved.moved` — every
   * `MatchId` held for the file is stale after a commit — and answers an exception
   * after the commit as a `failed` adoption beside the `saved` outcome, never as an
   * error (`PROGRESS.md` D2); a conflict installs nothing and records its origin.
   * An engine refusal (a text that does not parse, holds two snippets, escapes
   * the snippet's indentation, …) arrives as the `failed` arm carrying
   * `saveFailed` with the core's `EditError`, and `mayHaveWritten` answers `false`
   * for it.
   *
   * **The base revision is the caller's and is forwarded unchanged**, for
   * `saveMatch`'s reason. What no type forces is that it is the one the text was
   * read at; `baseRevisionOf` in `./rawSnippet.ts` is what a caller passes.
   *
   * @param id - The snippet, by the identity the text was read with.
   * @param baseRevision - The revision the text was read at. Sent unchanged.
   * @param text - The exact text the range is to hold.
   * @param acknowledgement - The suspicions already shown to a person; pass
   *   `{ accepted: [] }` on a first attempt.
   * @returns How the save ended together with the adoption's own fate; a refusal
   *   this state made before any command ran; or a command failure that says
   *   whether the file may already have been written and why it rejected.
   */
  saveMatchItemText(
    id: MatchId,
    baseRevision: ContentRevision,
    text: string,
    acknowledgement: Acknowledgement
  ): Promise<MatchSaveAnswer>;
  /**
   * Lists the recognised backup batches.
   *
   * **A read this state performs and does not remember.** Nothing here caches a
   * listing, keys one by workspace, or records that one was asked for: the
   * catalogue lives on a `RestoreSession` in `./restore.ts`, which is the value a
   * surface owns, exactly as every other editing session in this application is.
   * So **calling this again is how a listing is asked for again** — the
   * affordance 2c-5-3 handed forward, because a catalogue answer that lands while
   * a restore is being written is dropped by `batchesLoaded` rather than installed
   * over a send in flight. What no type here forces is that a screen offers it.
   *
   * It exists on this state rather than being imported from `../ipc/commands` by
   * whichever component draws the catalogue for one reason: no `.svelte` file in
   * this repository imports `../ipc/commands`, and that is a fact about the code
   * as written rather than a guarantee any type gives.
   *
   * The failure is **reported and answered**, the shape every read on this state
   * uses: the developer channel gets it, and the caller gets it too so that the
   * refusal can be put on the session and drawn.
   *
   * @returns Whatever `list_backup_batches` answered, unchanged.
   */
  listBackupBatches(): Promise<CommandResult<BackupBatchListing>>;
  /**
   * Lists one recognised batch's entries.
   *
   * Re-callable and unremembered, exactly as {@link BrowserState.listBackupBatches}
   * is, and for the same reason.
   *
   * **The batch is the caller's and is forwarded unchanged.** It is an opaque
   * identity a listing produced; this state neither builds one nor checks one, and
   * the command re-resolves it beneath the workspace-owned backup folder. Nothing
   * here can require that it is the batch the caller's session is showing —
   * `entriesLoaded` in `./restore.ts` is what refuses a listing about another
   * batch, and it refuses it at the session rather than here.
   *
   * @param batch - The opaque identity a batch listing produced.
   * @returns Whatever `list_backup_entries` answered, unchanged.
   */
  listBackupEntries(batch: BackupBatchId): Promise<CommandResult<BackupEntryListing>>;
  /**
   * Reads one backup entry's exact text, for one destination.
   *
   * Re-callable and unremembered, exactly as {@link BrowserState.listBackupBatches}
   * is. **The candidate this answers is read once per call and this state keeps no
   * copy of it**: `candidateRead` in `./restore.ts` retains the bytes on the
   * session, and consult Q1 is why nothing re-reads them at send time.
   *
   * **Both arguments are the caller's and are forwarded unchanged.** The command
   * refuses when the entry does not map to the document, which is what stops one
   * file's copy being read under another file's name; this state adds no second
   * opinion about the filesystem and takes none away.
   *
   * @param entry - The opaque identity an entry listing produced.
   * @param document - The live file the entry must map to, by identity.
   * @returns Whatever `read_backup_text` answered, unchanged.
   */
  readBackupText(
    entry: BackupEntryId,
    document: DocumentId
  ): Promise<CommandResult<BackupTextResponse>>;
  /**
   * Sends one confirmed restore, and takes its answer.
   *
   * **Restore is a content path on the sixth writer and not a writer of its own.** This
   * method issues no command of its own: it hands `sendRestore` in `./restore.ts`
   * a sender that is {@link BrowserState.saveRawDocument}, so the lock, the
   * revision check, the reparse, the validation verdict, the acknowledgement, the
   * backup, this state's own cache invalidation and the seal are all the ones a
   * raw save already has. There is no restore-specific command and consult Q3
   * rules that there must not be one.
   *
   * **Nothing is sent without an unspent permit**, which is consult Q8 and lives
   * in `./restore.ts` rather than here: `started` is the value `confirmRestore`
   * produced, the permit it keys is module-private, and `sendRestore` rechecks the
   * five bound values, the candidate's own bytes and the two window observations
   * and then spends the permit with a **checked** deletion — the deletion's own
   * result is the authorization — **before** the sender is called. A `null` here —
   * a confirmation that never happened, or one that was refused — reaches no
   * command at all, and reaches no model transition either: there is no session to
   * derive, so this method answers `null` and the caller keeps what it has. This
   * method **adds no check of its own between deciding and spending**, because a
   * check and a spend separated by any property read are not one operation in
   * JavaScript.
   *
   * **The session is the confirmation's own, and is not a parameter.** It is
   * `started.session`, which is the only session `sendRestore` can accept: a
   * signature that took one beside `started` let a caller pair a permit with a
   * different session, which wrote nothing and came back silent (the 2c-5-4a
   * review's Medium). What no type could have said, this signature simply does not
   * let a caller say.
   *
   * **A mismatch comes back askable rather than frozen.** When the permit no longer
   * describes the session and the window, `sendRestore` consumes it and answers
   * `withdrawn`; this method returns `restoreConfirmationWithdrawn`'s session, which
   * is out of `saving`, has nothing in flight, keeps the candidate and its consent,
   * and lets `restoreRefusal` say what is now in the way. Without that transition
   * the session stayed in the phase the confirmation put it in, every editing
   * transition in the model was a no-op over it, and the panel had no way back.
   *
   * **The revision half of the window's observation is read here, from the
   * projections this state holds**, and that is the one thing this wrapper adds to
   * the model's own guarantees. `./restore.ts`'s header records that nothing can
   * force `RestoreContext.observed` to be the live projection's revision rather
   * than the session's own frozen base — a caller that hands back
   * `session.baseRevision` gets agreement it did not earn. Here it cannot: the
   * value comes from `revisionInProjection` over this state's `views`, read
   * synchronously before the send. **It is not a refreshed base revision**: what
   * is written is the base the confirmation froze, taken off the permit, and this
   * observation can only make a send that should be refused actually be refused.
   *
   * **The open surfaces are the caller's, because this state cannot observe
   * them.** Every write surface is a session held inside a component —
   * `MatchEditor.svelte`'s, `MatchCreator.svelte`'s, and the four others — so no
   * coordinator can see one, exactly as no coordinator can see a draft's derived
   * `isDirty` (R36). Whichever component hosts them is the only thing that can
   * enumerate them, and nothing here can check that the list it was handed is
   * complete; an empty array claims there are none.
   *
   * **The invalidation is the caller's too, and for the same reason.** A committed
   * whole-document replacement makes every `MatchId` in that file stale, so every
   * write surface over it has to be closed or marked terminal — and only the
   * component that holds them can do it. It is passed straight through to
   * `applyRestore`, which discharges it inside `openWholeDocumentSave`; a body
   * that throws is classified onto the answer and **never unwrites the file**.
   * `() => {}` satisfies the type, so what the signature forces is that a caller
   * cannot take a restore's answer without supplying one.
   *
   * **The reader is the caller's too, and required since Phase 2d-6-6a** — the
   * one `current` every door and settling transition of `./restore.ts` takes. The
   * confirmation's own session is what the permit is checked against; the reader
   * is what says whether that session is still the one the caller holds, so a
   * receiver that replaced it during the permit's reads refuses the send
   * (`sendRestore`), and every delivery it appended to the installed session
   * while the replacement was in flight is replayed by the settling transition
   * this method ends in. This state holds no session and cannot read one, which is
   * why the reader is a parameter rather than something this method builds; what
   * no type forces is that the closure a caller passes reads what it installs
   * rather than a capture.
   *
   * **What no type forces, in the same sentence as what one does.** Nothing stops a
   * component calling {@link BrowserState.saveRawDocument} with any text it likes
   * and skipping this method, which is the hole every writing command has had
   * since 2b-2a; and nothing makes a caller *install* the session this answers —
   * a caller that drops it keeps whatever it was holding, exactly as it does for
   * every other value-model surface in this directory. What is forced is that the
   * bytes **this** method sends are the permit's own submission, that no argument
   * of this signature can substitute them, and that the session this answers about
   * is the one the confirmation minted rather than one a caller chose.
   *
   * @param started - What `confirmRestore` in `./restore.ts` produced, or `null`.
   * @param surfaces - Every write surface this window has open, in any order.
   * @param invalidate - What the caller does about every write surface over the
   *   replaced file. Required, with no default.
   * @param current - Reads the restore session the caller holds now —
   *   `() => session` over the pane's state. Required.
   * @returns The session showing what the restore ended as — including a
   *   consumed confirmation that sent nothing — or `null` when this call held no
   *   permit at all and therefore has nothing to say about any session.
   */
  restoreDocument(
    started: StartedRestore | null,
    surfaces: readonly OpenWriteSurface[],
    invalidate: InvalidateEverySurface,
    current: ReadTheInstalledRestore
  ): Promise<RestoreSession | null>;

  /**
   * Records that one write surface is open, and answers its lease.
   *
   * **This state owns one registry and this is the door to it** — Phase 2d-5-2a.
   * The registry itself is `./writeSurfaceRegistry.ts`, which carries the whole
   * contract: a lease rather than a bare kind key, an idempotent unregister that is
   * inert once displaced, and a target that can be reported in place.
   *
   * **`DetailPane.svelte` is the one production caller** — Phase 2d-5-2b. It
   * registers all eight kinds (the recovery form since Phase 2d-6-6b) from a
   * single exhaustive assembly, re-targets the new-snippet form through the lease
   * when `MatchCreator.svelte` reports the file the person chose, and returns every
   * lease when it is unmounted. The transition it registers is its `transitionOf`,
   * which hands the observation to {@link BrowserState.observeExternalChange} while
   * a receiver of that kind is bound and does nothing when none is (since
   * 2d-6-6b). The live set is read by the restore's pre-send gate, by the
   * reconciliation coordinator and observation routing through the registry, and
   * by the status readers in `./reconciliationStatus.ts` and `DetailPane.svelte`'s
   * header files through {@link BrowserState.openWriteSurfaces}.
   *
   * **What it cannot force, in the same sentence as what it does.** It forces that
   * a stale instance of one kind can neither remove nor re-target a newer one —
   * that is the lease's own guarantee — and it forces nothing at all about
   * completeness: **nothing makes a component register**, and
   * {@link BrowserState.openWriteSurfaces} answering an empty array claims there are
   * no open surfaces, which is `competingSurfaceFor`'s stated limitation reaching
   * this layer unchanged. What 2d-5-2b added is narrower than completeness: the one
   * host that exists cannot omit a kind **it declares**, because its assembly is an
   * exact record over `OpenWriteSurfaceKind`. A component written later and never
   * classified as a write surface is still invisible.
   *
   * **{@link BrowserState.restoreDocument} still takes its surfaces as an
   * argument**, and that has not changed — what changed is who supplies them.
   * `DetailPane.svelte` passes {@link BrowserState.openWriteSurfaces} into the
   * restore rather than a list it builds itself, so the argument is now this
   * registry's answer travelling through a component. The parameter stays because a
   * caller that must state what it holds open is what stops silence compiling into
   * *"there are none"*.
   *
   * **It can throw, and a host that calls it on mount is the caller that has to know
   * that.** This method is straight through, so the registry's refusal of a
   * `kind`/`target` pairing `OpenWriteSurface` cannot represent — a `TypeError`,
   * rather than a coerced value or a silently dropped registration — arrives here
   * unchanged. It is not reachable from a well-typed literal: `OpenWriteSurface`
   * correlates the two, so the compiler already rejects a non-`matchCreator` kind
   * over a target that names no file. It becomes reachable when a caller takes the
   * two apart — a widened `kind` variable paired with a separately built target and
   * reconciled by a cast or an assertion — or when a property read answers something
   * other than its declared type, since the registry reads `kind` and `target` here
   * rather than where they were written. **Uncaught inside a mount effect that is a
   * blank pane, not a refused registration**, so a host that cannot hand over a
   * correlated literal is the host that has to catch.
   *
   * **The lease this answers is not the registry's own object.** It is a wrapper
   * that calls through and then brings this state's reactive mirror into step —
   * see {@link BrowserState.openWriteSurfaces} — because unregistering and
   * re-targeting are two of the three ways the live set moves. It changes no
   * answer: the unregister is still idempotent and inert once displaced, and
   * `replaceTarget` still answers the registry's own `replaced` or `staleLease`.
   * What it does change is identity, which nothing compares: the registry recognises
   * a lease by the serial it captured itself, never by the function object.
   *
   * @param surface - The surface, exactly as a consumer will see it.
   * @param transition - What that surface is told about an external observation of
   *   its file. Stored and never called at 2d-5-2a.
   * @returns The lease: call it to unregister, or report a file through it.
   * @throws TypeError - When the `kind` read from `surface` and the arm read from
   *   `surface.target` are not a representable pairing: any kind other than
   *   `matchCreator` over a target that names no file, or a target whose
   *   discriminant is neither `'document'` nor `'unknown'`. Nothing this call would
   *   have written is written — no lease, no entry, no moved generation — but a
   *   registration the caller's own reads performed on the way in stands.
   */
  registerWriteSurface(
    surface: OpenWriteSurface,
    transition: WriteSurfaceTransition
  ): UnregisterWriteSurface;

  /**
   * Every write surface registered with this state, oldest registration first.
   *
   * **A snapshot, and a fresh array each call.** It is the value
   * `competingSurfaceFor` and `targetingSurfaceFor` in `./restore.ts` take, and its
   * order is the registry's own — see `./writeSurfaceRegistry.ts` for what that
   * order does and does not decide.
   *
   * **It is what `DetailPane.svelte` passes to a restore** since Phase 2d-5-2b,
   * replacing the second array that component used to assemble from what it had
   * open. What it answers is only what has been **registered**, which is the whole
   * of the limitation: a surface whose host never registered is not in it, and an
   * empty answer says nobody registered rather than that nothing is open.
   *
   * **Reading it is reactive, and that is a property of this door rather than of
   * the registry** — Phase 2d-5-2b's review, finding 1. The registry itself holds a
   * plain `Map` and nothing watches it; this method reads a signal mirroring the
   * registry's generation, so a `$derived` or an `$effect` that asks re-runs when a
   * surface is registered, unregistered or re-targeted through this state. Without
   * it, `RestorePane.svelte`'s `$derived.by` had no dependency any registration
   * moved: measured, its first read ran *before* the pane's registration effect,
   * answered the empty set, and was never invalidated again.
   *
   * **What that does not make current.** The answer is in step with the last
   * operation performed on this door, so a surface a component has opened but not
   * yet registered — its host's `$effect` has not run — is not in it, exactly as
   * before. Reactivity closes the gap between two flushes and not the one inside a
   * synchronous block.
   *
   * @returns Every live surface, oldest registration first.
   */
  openWriteSurfaces(): readonly OpenWriteSurface[];

  /**
   * How many times the registered set has changed.
   *
   * **The guard the consult's Q5 asks a later coordinator to capture before an
   * await and recheck before it installs** (`docs/reviews/phase-2d-5-design.md`
   * lines 157-163). Moving means the set was mutated since the capture; it says
   * nothing about *what* changed, nothing about any particular document, and does
   * not imply the set now differs from the capture. **That capture exists since
   * Phase 2d-5-4 and it does not go through this door**: the observation
   * transitions take it from the registry through `ReconciliationHost`, which is
   * deliberately outside every reactive mirror. The callers *this* member has are
   * cases in `DetailPane.test.ts`, which assert the number itself — the earlier
   * wording here said "nothing calls it", which was wider than the code and is
   * Phase 2d-5-2b-A's review, finding 3.
   *
   * **It answers the registry and reads the mirror**, which is exactly what
   * {@link BrowserState.openWriteSurfaces} does. The number returned is
   * `writeSurfaceRegistry`'s own, so the two doors describe the same registry state
   * *by construction* rather than by the mirror happening to be in step; the mirror
   * read is what makes a caller inside a reactive context re-run when either would
   * have moved. **What the mirror owns is the invalidation — and for a reactive
   * caller the invalidation *is* the value.** Phase 2d-5-2b-B's finding 2 narrowed
   * this sentence, which used to say the two could be separated. A later method that
   * moved the registry without calling `noticeWriteSurfaces()` would leave both
   * doors truthful *to a caller that calls them*, and nothing in TypeScript prevents
   * such a path; but a `$derived`, an `$effect` or a template read over either door
   * only re-runs when something invalidates it, so it would go on showing — or go on
   * having acted on — the number it last computed, until some **other** dependency of
   * that derivation moved. A stale screen is the cost, not merely a missed re-run.
   * **The line is the reactive context, not whether the caller calls** — Phase
   * 2d-5-2b-C's finding 3: an `$effect` calls this method exactly as an imperative
   * caller does, and is stale exactly as the `$derived` is. A caller outside any
   * reactive context — a coordinator capturing this across an `await`, or the cases
   * in `DetailPane.test.ts` that call it today — is the kind for which "the
   * invalidation and not the value" is the whole truth. It is a *kind* rather than
   * "the one caller" — Phase 2d-5-2b-C's NIT 4: that coordinator does not exist yet,
   * as the paragraph directly above says, and the test callers that do exist are the
   * same kind.
   *
   * @returns The current generation; zero for a state nothing has registered with.
   */
  writeSurfaceGeneration(): number;

  /**
   * Begins the reconciliation lifecycle — Phase 2d-5-3.
   *
   * Registers for `workspace://reconciliation-ready` through the injected event
   * source and for foreground and resume signals through the injected activity
   * source, and drains once registration resolves. **Idempotent**: a host with
   * two `onMount`s must not end up with two subscriptions.
   *
   * **The one production caller is `AppShell.svelte`'s `onMount`** — Phase
   * 2d-5-7a — which calls it before `open(null)` over the real event source and,
   * since Phase 2d-6-10, the DOM foreground source of `./domForeground.ts`, and
   * returns {@link BrowserState.dispose} as its
   * cleanup. Both injected sources still *default* to the inert ones in
   * `./reconciliationCoordinator.ts`, so a state built without naming a source
   * registers nothing. Nothing in TypeScript makes a host call this, or call
   * {@link BrowserState.dispose} afterwards; `AppShell.test.ts` asserts the exact
   * registration and unlisten counts instead.
   */
  start(): void;

  /**
   * Ends it: unsubscribes exactly once and makes every drain in flight inert.
   *
   * Idempotent, and safe to call whether or not {@link BrowserState.start} ever
   * was. A `subscribe` that resolves *after* this is called has its unlisten
   * invoked immediately rather than stored, which is the registration race
   * `docs/decisions/2d-5-split-notes.md` section 3 ruling 16 gives to disposal —
   * and nothing in TypeScript forces that continuation to be written, so the
   * exact unlisten count is asserted by test.
   */
  dispose(): void;

  /**
   * What this window can say about one file it did not reload — Phase 2d-5-4.
   *
   * **A code; no component renders the code itself.** Its words exist since
   * Phase 2d-6-9a — `decideFileReconciliation` in `./reconciliationStatus.ts`
   * decides where each arm is drawn, and `describeReconciliationFileState` in
   * `src/lib/i18n/codes.ts` holds the EN/ES sentences — and since 2d-6-9b
   * `FileReconciliationStatus.svelte` and `Sidebar.svelte` draw them.
   *
   * **A `removed` status outlives the row it is about**, deliberately: a write
   * surface over a removed file is preserved rather than closed, so the state that
   * describes its target has to survive the removal.
   *
   * @param document - The file.
   * @returns The status, or `null` when there is nothing to report.
   */
  externalDocumentStatus(document: DocumentId): ExternalDocumentStatus | null;

  /**
   * What was observed of paths this window holds no identity for — Phase 2d-5-4.
   *
   * The `Unnamed` arm's whole product. **No identity is invented and no row is
   * matched by path**, because a wire path is lossy; a consumer holds the display
   * path and nothing a command would accept.
   *
   * @returns One entry per path, the most recent observation of each.
   */
  externalPathDrift(): readonly ExternalPathDrift[];

  /**
   * Whether reconciliation is running or is held by a hole in the history —
   * Phase 2d-5-4.
   *
   * @returns The coordinator's typed state.
   */
  reconciliationBlock(): ReconciliationBlock;

  /**
   * Whether an observation has asked for a safe membership reload — Phase 2d-5-4.
   *
   * **Nothing acts on it**, here or in the coordinator: it is raised by the arms
   * that saw a file the open workspace does not resolve, and 2d-6 is where a
   * person gets a control that asks for one.
   *
   * @returns `true` once such a request has been made in this session.
   */
  membershipReloadWanted(): boolean;

  /**
   * How many times the coordinator has announced a transition — Phase 2d-6-1c,
   * the 2d-6 record's §3 entry 28.
   *
   * **The one reconciliation signal, and the dependency every coordinator reader
   * on this state subscribes a `$derived` or an `$effect` to.** It is a counter
   * and nothing else: no watch state, block, registration or flag is copied into
   * this state, so there is no second copy to keep in step — each reader re-asks
   * the coordinator and reads this number first, exactly as `openWriteSurfaces()`
   * reads `surfaceGeneration`. A component may read this directly to re-derive
   * from several readers at once.
   *
   * **What the type forces and what it cannot, in one sentence.** It forces that
   * every announcement the coordinator makes moves one number; it cannot force
   * the coordinator to announce every transition — a typed callback cannot make
   * every mutation site call it — and `reconciliationCoordinator.test.ts` is what
   * counts the announcements across every transition, asynchronous subscription
   * rejection included. It also cannot force that nothing else moves with it: it
   * touches no selection and no other value here, and `workspace.test.ts` pins
   * that the selection is the very object it was across every announcement.
   *
   * @returns The count since this state was built; never reset by `open()`.
   */
  reconciliationRevision(): number;

  /**
   * What this window can truthfully say about being watched — Phase 2d-6-1c, the
   * 2d-6 record's §3 entry 28 and its §6 item 11.
   *
   * The coordinator's answer, unchanged: a `notObserved`, `notWatched` or
   * `watching` value carrying at most an epoch number, which needs no narrowing.
   * Reading it subscribes a derivation to {@link BrowserState.reconciliationRevision}.
   *
   * @returns The typed state the 2d-5 record's ruling 9 asks for.
   */
  reconciliationWatchState(): ReconciliationWatchState;

  /**
   * What became of the wake registration, sanitized — Phase 2d-6-1c.
   *
   * **No receiver, lease, unlisten or `Error` crosses here.** The coordinator's
   * failure arm carries whatever `subscribe` rejected with; this answers a
   * {@link RegistrationFailureReason} code in its place, built fresh and frozen.
   * Reading it subscribes a derivation to {@link BrowserState.reconciliationRevision}.
   *
   * @returns The registration state a window may draw from.
   */
  reconciliationRegistration(): ReconciliationRegistrationState;

  /**
   * Asks for the workspace's membership to be refreshed — Phase 2d-6-1c, the 2d-6
   * record's §3 entry 29.
   *
   * **A whole `open()` with the coordinator's retained original request, on a
   * person's ask.** The request never passes through this state: this method
   * takes no argument at all, so nothing a screen displays can be handed in as a
   * root, and the coordinator re-runs what `open()` was last called with — `null`
   * included, which means *discover the configuration root*. It ends in the
   * existing `open()`, which clears every projection, the selection and the
   * viewer; that is what a membership refresh is.
   *
   * **Four rechecks at execution, in one synchronous block with the reopen** and
   * with no caller code between them: the coordinator's disposal, its open gate
   * (`awaitingWorkspaceReady()`), the outstanding writes and the write-surface
   * registry. An open surface refuses with the kinds that are open; closing the
   * last one **permits and does not trigger** — nothing here observes the
   * registry emptying, and only a fresh call reloads. It is permitted whether or
   * not {@link BrowserState.membershipReloadWanted} is `true`: that flag says an
   * observation *asked*, and a person may refresh without one having asked.
   *
   * What the type forces is that no path is accepted; what it cannot force is
   * that a caller rechecks anything itself, which is why every check is inside.
   *
   * @returns Whether the reopen was started, and if not, the first reason it was
   *   refused.
   */
  requestMembershipReload(): WorkspaceReloadOutcome;

  /**
   * Asks for recovery from a hole in the observation history — Phase 2d-6-1c,
   * the 2d-6 record's §3 entry 29.
   *
   * **The same reopen as {@link BrowserState.requestMembershipReload}, under one
   * more condition**: reconciliation must be `blockedByLostHistory`. A separate
   * intent and a separate method because the two controls say different things
   * to a person — one refreshes a membership an observation could not describe,
   * the other recovers from a session that has been holding everything it has —
   * and because a request for a recovery there is nothing to recover from is
   * refused (`notBlocked`) rather than reloading the window again: the permitted
   * reload may already have been taken at the batch after the last surface
   * closed, and a stale press must not clear a workspace twice.
   *
   * The four rechecks, the no-argument rule and *permits without triggering* are
   * the sibling's, word for word.
   *
   * @returns Whether the reopen was started, and if not, the first reason it was
   *   refused.
   */
  requestLostHistoryRecovery(): WorkspaceReloadOutcome;

  /**
   * Reads one file again on a person's ask, under every guard — Phase 2d-6-1c,
   * the 2d-6 record's §3 entry 32.
   *
   * **The control for a `stale` file whose surface has closed, and never
   * {@link BrowserState.rereadDocument}.** That member's guard always holds; this
   * one asks eight questions and asks them **twice** — once at the request, so a
   * refusal costs no command, and once immediately before the installation, in
   * the same synchronous block as it, through `rereadUnderGuard`'s guard. The
   * eight: the coordinator's disposal, its open gate, whether this window holds an
   * addressable row for the file, the lost-history block, 1b's three per-file
   * facts through 1a's `decideAutomaticReload` — the uncertainty hold, a retained
   * observation, an open surface over the file — and last a write in flight for
   * the file. A guard that held at the request and moved while the read was out
   * refuses the installation, and the answer says so (`at: 'installation'`).
   *
   * **It marks nothing `stale` and clears the mark only by installing**, which is
   * `rereadUnderGuard`'s own rule: the clear lives with the install and a refusal
   * clears nothing. The automatic clean path is untouched — a fresh accepted
   * observation still rereads through the coordinator's guard when every guard
   * permits — and this is a second caller of the same helper, not a change to it.
   *
   * What the type forces is that the guard is a function asked by the helper;
   * what it cannot force is that the function re-asks rather than replays, and
   * `workspace.test.ts` flips each guard between the request and the answer to
   * pin it.
   *
   * @param document - The file to read again.
   * @returns What was decided, and if the read was made, how it ended.
   */
  requestFileReread(document: DocumentId): Promise<FileRereadOutcome>;
}

/**
 * The selection that initiated a duplicate, with the intent generation it was
 * captured at.
 *
 * **A pair on purpose, and the pair travels whole to the write site.** The
 * held object answers "is the very selection that initiated the operation
 * still the one held?" — every write to `selected` installs a fresh object —
 * and the generation answers the half the object cannot: an intent expressed
 * without an assignment landing, such as a `select()` that bumped the counter
 * at entry and then failed to resolve. `adoptAfterTheDuplicate` re-validates
 * both **after its own await**, in the same synchronous block that writes the
 * selection; reducing the pair to a boolean anywhere earlier is the residual
 * hole the 2c-3c-2 review's confirmation pass found.
 */
interface DuplicateIntent {
  /** The selection held when the duplicate was sent — the source itself. */
  readonly held: SelectedMatch;
  /** The global `selectGeneration` at the same instant. */
  readonly generation: number;
}

/**
 * One file, and what this window can say about it without having reloaded it.
 *
 * A pair rather than a `Map`, because it is `$state` and a `Map` in `$state` is
 * not reactive without Svelte's own wrapper. Phase 2d-5-4.
 */
interface ExternalDocumentStatusEntry {
  /** The file. **Kept after the row is gone** for a `removed` status. */
  readonly document: DocumentId;
  /** What this window can say about it. */
  readonly status: ExternalDocumentStatus;
}

/**
 * One observation ruling 27's barrier is holding, and the window it arrived at.
 *
 * **The generation is not decoration.** A conflict is registered with the
 * projection generation it *arrived* at, because that is the fact
 * `BrowserState.adoptDiskVersion` compares against to refuse a disk snapshot the
 * window has since moved past. A retained observation arrives while a write is in
 * flight and is registered after it settles, and a committing write replaces that
 * file's projection in between — so reading the generation at release rather than
 * at arrival hands the observation a freshness it never had. Phase 2d-5-5b's
 * review, finding 1.
 */
interface RetainedObservation {
  /** The observation the barrier is holding. */
  readonly observation: ExternalConflictObservation;
  /**
   * That file's projection generation when this observation arrived.
   *
   * **What a settlement and a person's retry both arbitrate at** — never the
   * generation they run at (the 2d-6 record's §3 entry 17).
   */
  readonly generation: number;
  /**
   * That file's status-write count when the barrier took this observation in —
   * Phase 2d-7-1, the provenance of the `stale` ruling.
   *
   * **What a `writtenHere` release asks to decide whether the mark standing is
   * this reading's**: an unmoved count means nothing has written the file's status
   * since the barrier took this reading, so the mark standing is the one its
   * arrival wrote or one written before it. A moved count means some later cause
   * wrote it, and that mark stands. It does not say *who* wrote the mark; nothing
   * does (`ExternalDocumentStatus`'s `stale` carries no cause).
   */
  readonly statusWrites: number;
}

/**
 * What one minted {@link UncertaintyAcknowledgement} is bound to — Phase 2d-6-1b.
 *
 * Four facts read off this state's own tables at minting and compared against
 * them at spending; the binding is this module's own literal, so reading it runs
 * no user code.
 */
interface AcknowledgementBinding {
  /** The `open()` generation the hold belonged to. */
  readonly openGeneration: number;
  /** The file, as the origin's own registration names it. */
  readonly document: DocumentId;
  /** The file's uncertainty generation when this was minted. */
  readonly uncertaintyGeneration: number;
  /** The origin the person reviewed, which stood for the file at minting. */
  readonly source: ConflictSource;
}

/**
 * One registered receiver — Phase 2d-6-1b.
 *
 * An object rather than the bare function, so that identity is per registration:
 * the unregister answered for one registration removes that object and no other,
 * whichever function the sibling registrations hold.
 */
interface ReceiverRegistration {
  /** The session's receiver. */
  readonly receiver: ObservationReceiver;
}

/**
 * One envelope waiting for the delivery in progress to finish — Phase 2d-6-1b's
 * review, finding 2.
 */
interface PendingDelivery {
  /** The file the envelope is about. */
  readonly document: DocumentId;
  /** The sealed decision. */
  readonly delivery: ObservationDelivery;
}

/**
 * One in-flight write's hold on ruling 27's barrier.
 *
 * **Two methods because a write establishes its outcome before it has finished
 * acting on it.** A wrapper learns what the transaction did the moment the command
 * answers, and then spends several awaits adopting what it produced; an exception
 * in that stretch must still release the barrier, and must release it on what was
 * already known rather than on a guess. So the knowing and the releasing are two
 * calls: {@link WriteLease.expect} records, {@link WriteLease.close} releases.
 */
interface WriteLease {
  /**
   * Records what this write has established, releasing nothing.
   *
   * Called as soon as the command answers, and overwritten rather than merged.
   *
   * @param settlement - What the answer establishes about the file.
   */
  expect(settlement: WriteSettlement): void;
  /**
   * Releases the barrier on what was last expected, or on `uncertain`.
   *
   * One-shot: a second call does nothing. Called from a `finally`, so it runs on
   * every exit a wrapper has.
   */
  close(): void;
}

/**
 * The guard a re-read somebody asked for is run under.
 *
 * **A named constant rather than an inline `() => true`**, so that the one call
 * site which passes no coordinator guard says which of the two it is at the call
 * rather than in a comment. Phase 2d-5-4.
 *
 * @returns `true`, always.
 */
const ALWAYS_PERMITTED = (): boolean => true;

/**
 * Builds the browser state over a set of commands.
 *
 * @param commands - The IPC surface to drive; defaults to the real one.
 * @param report - Where a failure goes for the developer; defaults to the
 *   console reporter of `../ipc/errors`.
 * @param backup - The read-only backup surface to drive; defaults to the real
 *   one. Separate from `commands` for the reason {@link BackupCommands} records,
 *   which is a constraint on the step that added it rather than a property of
 *   the design.
 * @param events - Where a reconciliation wake arrives — Phase 2d-5-3. **Defaults
 *   to the inert source, never to the real adapter**: `AppShell.svelte` passes the
 *   real one from `src/lib/ipc/events.ts` explicitly (Phase 2d-5-7a, beside the two
 *   capability entries that registration needs), and every state built without
 *   naming a source keeps registering nothing.
 * @param foreground - Where a foreground or resume signal arrives — Phase
 *   2d-5-3. Defaults to the inert source, which registers a real handler that
 *   nothing ever calls; `AppShell.svelte` passes the DOM source of
 *   `./domForeground.ts` explicitly (Phase 2d-6-10). Its type names neither the
 *   DOM nor Tauri, exactly as `ReconciliationEventSource` does not.
 * @returns Reactive state a component can read directly.
 */
export function createBrowserState(
  commands: BrowserCommands = REAL_COMMANDS,
  report: (failure: IpcFailure) => void = reportIpcFailure,
  backup: BackupCommands = REAL_BACKUP_COMMANDS,
  events: ReconciliationEventSource = INERT_RECONCILIATION_EVENTS,
  foreground: ForegroundSource = INERT_FOREGROUND_EVENTS
): BrowserState {
  let status = $state<BrowserStatus>('loading');
  let failure = $state<IpcFailure | null>(null);
  let loadFailures = $state<readonly LoadFailure[]>([]);
  let summary = $state<WorkspaceSummary | null>(null);
  let documents = $state<readonly DocumentSummary[]>([]);
  let views = $state<readonly DocumentView[]>([]);
  let selection = $state<SidebarSelection>(ALL_DOCUMENTS);
  let query = $state('');
  let selected = $state<SelectedMatch | null>(null);
  let notice = $state<SelectionNotice | null>(null);
  let fileTextShown = $state(false);
  // What `document_text` answered, and which file it answered about. The two
  // are kept apart so that an answer can never be drawn under the wrong file
  // name: the getter below compares the identity before it reads the answer,
  // and a mismatch is the `loading` arm rather than the previous file's text.
  let fileTextAnswer = $state<CommandResult<string> | null>(null);
  let fileTextDocument = $state<DocumentId | null>(null);
  // **The revision the projection held when that read started**, captured before
  // the command was called and never afterwards. It is what makes the text and a
  // revision a *pair* rather than two facts a caller happens to read together —
  // the 2c-1b review's first finding, which is that `installView` can move the
  // projection under a held snapshot without moving the snapshot.
  let fileTextRevision = $state<ContentRevision | null>(null);
  // **There is no second text cache, and 2c-4a-2 removed the one there was.** It
  // kept the disk text of a conflicted save by document, filled by a separate
  // `document_text` call — which could answer a later text than the conflict was
  // about, or an earlier one when the viewer happened to hold the same file
  // (`docs/decisions/2c-4a-1-notes.md` section 4.1). `ConflictModel.diskText`
  // arrives on the conflict payload paired with `diskRevision`, so that capture had
  // nothing left to add and two defects left to keep.

  // The generation counters. None is `$state`: nothing renders them, and they are
  // read only by the request that took one, immediately after its own `await`.
  // Making them reactive would add a dependency to every getter that happens to
  // run in the same effect.
  let openGeneration = 0;
  let selectGeneration = 0;
  let fileTextGeneration = 0;
  // **The projection counters, one per document**, and the confirmation review's
  // High finding is why they are not one. A single counter made every projection
  // replacement invalidate every selection lookup in flight, including one for a
  // file the replacement said nothing about: a raw save of B committing while a
  // click on a snippet of A was still being checked cancelled A's repair, and the
  // state went on holding a `MatchId` that no longer resolved — this sub-phase's
  // declared worst failure, produced by the fix for a narrower one.
  //
  // A plain `Map` rather than `$state`: nothing renders it, and a `Map` in `$state`
  // is not reactive without Svelte's own wrapper anyway. A document with no entry
  // has never had a projection replaced, which is generation zero.
  const projectionGenerations = new Map<DocumentId, number>();
  // **The re-read counters, one per document**, and they count *requests* rather
  // than replacements — which is why they are not the map above. A re-read that
  // starts while another is in flight for the same file must be the one that wins,
  // whichever order the two answers arrive in, and a counter of installations
  // cannot express that: the older read installs first, bumps it, and the newer
  // read then finds its own capture stale and discards the fresher parse. This is
  // `fileTextGeneration`'s shape — take the next number, compare after the await —
  // per document, because a re-read of file A says nothing about one of file B.
  //
  // **Not cleared by `open()`**, unlike `projectionGenerations`. Clearing would set
  // them back to zero while a capture from the closed workspace still held one, and
  // the first re-read of the new workspace would then match it; `openGeneration` is
  // what covers a replaced workspace, and monotonic counters cannot collide with a
  // capture that has already been invalidated by it.
  const rereadGenerations = new Map<DocumentId, number>();
  // **Every reload confirmation this state has already spent.** A confirmation is
  // one person's answer to one question, and `adoptDiskVersion` refuses a second
  // spend of it: replaying one would install a projection again, bumping that
  // document's generation and repairing the selection on the strength of one
  // click. A `WeakSet` because a confirmation is an opaque object nobody else
  // holds once its session is gone — this must not keep it alive.
  const spentConfirmations = new WeakSet<ReloadConfirmation>();
  // **Every conflict this state has seen, and the window it was seen against.**
  // **Keyed by the conflict's *origin* since Phase 2d-5-5a** (ruling 22), not by the
  // wire `ConflictResult`: `ConflictSource` is what `ConflictModel.source` now
  // carries, and one wire value yields exactly one source object because
  // `saveConflictSource` and `externalConflictSource` in `./conflictSource.ts`
  // memoize on it. The substitution is therefore lossless for the save origin and is
  // what lets the external origin be registered at all. **Nothing forces a caller
  // through those memos** — a hand-built wrapper of the same shape type-checks, is
  // in no map, and installs nothing, which fails safe and silently.
  //
  // A conflict some *other* `BrowserState` produced — or one a caller assembled —
  // has no entry and can install nothing:
  // a `DocumentId` is session-local, and without this the two states' document
  // number 2 were indistinguishable here. The recorded generation is the second
  // half: if anything replaced that document's projection between the conflict
  // arriving and the person confirming, the disk snapshot the conflict carries may
  // be **older** than what the window now holds, and installing it would move the
  // window backwards. That is the confirmation pass's High, and the check is a
  // generation rather than `conflict.expected` because a session's frozen base
  // legitimately differs from what the window projects.
  const conflictOrigins = new WeakMap<
    ConflictSource,
    { readonly document: DocumentId; readonly generation: number }
  >();
  // **Which origin currently speaks for each file** — Phase 2d-5-5b, rulings 25
  // and 26. It is not a second copy of `conflictOrigins` above: that map answers
  // *did this state register this origin, and against which projection*, keyed by
  // the origin; this one answers *which of the origins it registered is the current
  // one for this file*, keyed by the file. The two are written in one place —
  // {@link rememberTheConflict} — so they cannot be updated apart, and a registration
  // that is refused there writes neither.
  //
  // **Last registration wins here, while `conflictOrigins` is first-wins**, and the
  // difference is the point. A re-registration of an origin already known returns
  // above without reaching either map, so a stale conflict cannot make itself
  // standing again; a *new* origin — a refused save, or an observation
  // {@link arbitrateObservation} ruled strictly later — is by definition the newest
  // fact this state has about that file. Nothing in TypeScript keeps the two maps in
  // step; one function writing both is the whole of what does.
  const standingConflicts = new Map<DocumentId, ConflictSource>();
  // **The file's status-write count at the moment each origin was registered** —
  // Phase 2d-6-9b-1, the orchestrator's ruling on `stale`. `adoptDiskVersion`
  // clears a `stale` mark on installation only while this count is still the
  // file's, i.e. while nothing has written the file's status since the conflict
  // arrived; a mark some later observation wrote is that observation's to clear.
  // Written in {@link rememberTheConflict} beside the two maps above, and a
  // `WeakMap` for `conflictOrigins`' reason.
  const conflictStatusWrites = new WeakMap<ConflictSource, number>();
  // **Ruling 27's barrier: how many writes this state started are still in flight
  // for each file.** A count rather than a flag because two surfaces could write one
  // file at once — `busy` keeps the seven surfaces mutually exclusive today, which is
  // a fact about the components and not about this type — and a flag the first
  // settlement cleared would open the barrier while the second write was still out.
  // A file with no entry has nothing in flight.
  const writesInFlight = new Map<DocumentId, number>();
  // **What the barrier is holding for each file**, which is at most one observation:
  // ruling 27 coalesces by keeping the newest rather than by queuing, because two
  // readings of one file are two whole snapshots and nothing can be built from halves
  // of both. `newestObservationOf` in `./conflictSource.ts` is the choice.
  //
  // **The projection generation it arrived at travels with it**, which is this
  // phase's review, finding 1: a write that commits invalidates this file's
  // projection *before* its barrier releases, so an observation registered at the
  // generation it is released at would claim to have arrived at a window it never
  // saw — and {@link BrowserState.adoptDiskVersion}'s generation comparison, whose
  // whole job is to refuse a snapshot older than what the window now holds, would
  // find the two equal and install it.
  const retainedObservations = new Map<DocumentId, RetainedObservation>();
  // **Every file whose last settled write may have written** (ruling 27). It is
  // preserved rather than resolved: a later watcher snapshot can establish what is on
  // disk but never who put it there, so nothing a watcher says can clear this.
  // **Three things end it** (the 2d-6 record's §5.5): a later write of this
  // window's own that *ended* — a transaction outcome names the revision the file
  // holds — `open()`, which replaces the workspace the uncertainty was about, and
  // the person's `acknowledgeWriteUncertainty` below, which establishes nothing
  // about the earlier write and only says the risk was looked at. No gate would
  // notice if a file stayed in here for the life of a session; what 2d-6-1b gives
  // a person is a way out they have to press.
  const uncertainWrites = new Set<DocumentId>();
  // **How many times each file's hold has been established** — Phase 2d-6-1b. An
  // acknowledgement is bound to the number it was minted at, so one minted while
  // the person reviewed a snapshot cannot spend a hold a *later* uncertain write
  // re-established: that snapshot says nothing about the later write. Bumped by
  // the lease's `close()` on every `uncertain` settlement, whether or not the file
  // was already in the set; never decremented and deliberately not cleared by
  // `open()` — it is monotonic for the life of this state, and the open generation
  // is what refuses an acknowledgement minted for a workspace that is gone. A file
  // with no entry has never been held, which is generation zero.
  const uncertaintyGenerations = new Map<DocumentId, number>();
  // **What each minted acknowledgement is bound to**, keyed by the object's
  // identity, and **which have been spent** — Phase 2d-6-1b. Two `Weak*` tables
  // rather than a flag on the object: the object is frozen and empty, so a caller
  // cannot read or forge its binding, and a hand-built literal of the shape is
  // absent from both and refused. Neither table is cleared by `open()`: an
  // acknowledgement minted for an earlier workspace carries that workspace's open
  // generation and is refused by it.
  const acknowledgementBindings = new WeakMap<UncertaintyAcknowledgement, AcknowledgementBinding>();
  const spentAcknowledgements = new WeakSet<UncertaintyAcknowledgement>();
  // **Who is told about each file** — Phase 2d-6-1b. One registration object per
  // `registerObservationReceiver` call, so the same function registered twice is
  // two entries and each unregister removes exactly the one it was answered for.
  // Not `$state` — nothing renders it — and not cleared by `open()`, for the reason
  // `writeSurfaces` below gives: a component owns its registration and removes it
  // through the function it was handed. **In production, since Phase 2d-6-6b**,
  // `DetailPane.svelte` registers the editor's, the new-snippet form's and the
  // recovery form's receivers here, since Phase 2d-6-7a the deleter's, the
  // mover's and the duplicator's, and since Phase 2d-6-8a the raw editor's and
  // restore's — every kind, through the roster in `./surfaceReceivers.ts`.
  const observationReceivers = new Map<DocumentId, Set<ReceiverRegistration>>();
  // **The delivery queue** — Phase 2d-6-1b's review, finding 2. A publication made
  // from inside a delivery (a receiver that calls `observeExternalChange` or the
  // retry while being told something) is decided at once and *delivered* only
  // after the envelope now going round has reached every recipient, so every
  // receiver sees decisions in the order they were made. `delivering` says a
  // drain is running; the queue holds what arrived during it; the per-drain table
  // says which (observation, verdict kind) pairs this drain has already handed
  // out, which is what bounds a receiver that re-publishes what it receives. All
  // three are reset when the outermost `deliver` returns.
  const pendingDeliveries: PendingDelivery[] = [];
  let delivering = false;
  const handedOutThisDrain = new Map<ExternalConflictObservation, Set<ObservationVerdict['kind']>>();
  // **Every write surface this window has told this state about** — Phase 2d-5-2a.
  // One registry per state, created here rather than at module level for the reason
  // `./writeSurfaceRegistry.ts` gives: two windows are two registries, and a
  // `DocumentId` is session-local, so a shared one would make a surface open in one
  // window visible in the other.
  //
  // **Not `$state`, and not cleared by `open()`.** The registry is a plain `Map`
  // and stays one; what is reactive is the mirrored generation declared below, and
  // that mirror exists because something *does* render from this — the restore's
  // refusal is derived from the live set (Phase 2d-5-2b's review, finding 1). The
  // sentence this replaces said nothing renders it, which was true only while no
  // component consumed the answer. And `open()` deliberately does not clear it,
  // although it clears documents, projections, selection and the viewer: a
  // component owns its own registration and unregisters through its lease when it
  // closes, so clearing here would make a still-open surface invisible while its
  // component went on holding an inert lease. That is the unsafe direction —
  // "no surface is open" is exactly the answer that permits a silent reload — so
  // the direction taken here is the safe one.
  //
  // **It is not free, and what it costs is named rather than glossed.** `open()`
  // clears `projectionGenerations` below because every projection of the workspace
  // being closed goes with it, and a registration that survives an `open()`
  // therefore names a surface about a workspace this window is no longer showing.
  // **Not a `DocumentId` that denotes a different file** — an identity is minted
  // per path and is stable for the life of the process — but a file the replacing
  // workspace may not hold at all, named by a host whose draft was built against
  // bytes that are gone: `competingSurfaceFor` would refuse a restore on the
  // strength of that surface, and `targetingSurfaceFor` would answer with it. Both
  // are refusals rather than permissions, so a write is still safe; the price is a
  // false refusal over a file nobody is really editing, until that host
  // unregisters. Nothing enforces that it ever does.
  //
  // **Re-taken at Phase 2d-5-2b, when a host started registering, and measured
  // rather than restated.** The decision stands, and three things are now known
  // rather than expected. A registration really does survive an `open()` when its
  // host does — driven in `DetailPane.test.ts`, so the price above is real and not
  // hypothetical. **No production `open()` can run while a surface is registered**:
  // this method has exactly two callers, both in `AppShell.svelte`, one in `onMount`
  // before the pane exists and one on a *Retry* control drawn only in the `failed`
  // arm, where the pane is not mounted. And the guard those callers sit behind
  // disposes anyway — this method sets `status` to `'loading'` synchronously, before
  // its first await, so the arm holding `DetailPane` is torn down and its leases come
  // back at the next flush. What that leaves open, said plainly: the window between
  // that synchronous assignment and the flush, in which the registry still answers
  // surfaces registered against the workspace this load replaces. Nothing reads it there
  // today, and 2d-5-4's discarded-history recovery — the third caller consult Q3
  // adds, now shipped — reads the registry **before** it decides, and refuses to
  // re-open while any surface is registered, which is the direction that window
  // fails safe in: a lease that has not come back yet is a surface the recovery
  // sees, so it blocks rather than reopening.
  const writeSurfaces = createWriteSurfaceRegistry();
  // **The registry's own generation, mirrored into a signal** — Phase 2d-5-2b's
  // review, finding 1. The registry is deliberately not reactive and stays that
  // way; what is reactive is this number, which is assigned the registry's
  // generation after every operation *this door* performs on it. It is a mirror
  // rather than a second count, so the two cannot drift: nothing here decides when
  // the set changed, it only copies the registry's answer to that question.
  //
  // **What it is for.** `DetailPane.svelte` hands the restore
  // `() => browser.openWriteSurfaces()`, and `RestorePane.svelte` calls that inside
  // a `$derived.by`. Without a signal in that answer the derived had no dependency
  // any registration moved, so a surface opened after it last ran was invisible to
  // the restore's refusal and to what `confirmRestore` is handed — under-refusal,
  // measured rather than reasoned: opening the restore, the child's derived ran
  // *before* `DetailPane`'s registration effect and answered `[]`, and nothing
  // afterwards made it run again.
  //
  // **What it forces and what it does not, in one sentence.** It forces that a
  // `$derived` or an `$effect` that asks {@link BrowserState.openWriteSurfaces} or
  // {@link BrowserState.writeSurfaceGeneration} re-runs when the live set moves
  // through this door. It forces nothing about *completeness* — a component that
  // never registers is still invisible, which is `competingSurfaceFor`'s standing
  // limitation — and nothing about a surface opened in the same synchronous block
  // as the question, which is not registered until its host's effect has run. And
  // nothing in TypeScript keeps a later method of this state from moving the live
  // set without mirroring afterwards: the three operations that can move it — the
  // registration below, and the two the lease performs — are today's whole set, and
  // a fourth written without a `noticeWriteSurfaces()` would leave this number
  // behind the registry with nothing failing.
  let surfaceGeneration = $state(0);
  // **The coordinator's announcements, counted into a signal** — Phase 2d-6-1c,
  // the 2d-6 record's §3 entry 28. The coordinator is not reactive and stays so;
  // it tells this state, through the host member below, that a value one of its
  // readers answers has moved, and this number is bumped in that callback and
  // nowhere else. **A count, never a copy**: no watch state, block or flag is
  // mirrored, so nothing here can be behind the coordinator — every reader
  // re-asks it and reads this number first, which is `surfaceGeneration`'s shape
  // with the direction reversed (the registry's generation is copied because the
  // registry has one; the coordinator has none and announces instead).
  //
  // **What it forces and what it cannot, in one sentence.** It forces that a
  // `$derived` or an `$effect` reading any coordinator reader on this state re-runs
  // on every announcement; it cannot force the coordinator to announce every
  // transition, because a typed callback does not make a mutation site call it,
  // and that is `reconciliationCoordinator.test.ts`'s to count. It moves nothing
  // else: not the selection, not a generation, not a status — the callback is one
  // increment, and `workspace.test.ts` holds the selection to the same object
  // across every announcement.
  let reconciliationRevision = $state(0);
  // **The per-file hold tables, counted into a signal** — Phase 2d-6-9a's review,
  // finding 1. The barrier (`writesInFlight`), the held observations, the
  // uncertain set, the standing origins and the projection generations are plain
  // `Map`s and `Set`s, deliberately — they are guard tables read inside
  // synchronous check-and-spend blocks — and nothing about a plain table
  // invalidates a `$derived` or an `$effect` that read it. So every mutation of
  // them is followed by {@link noticeHolds}, and every reader that answers from
  // them reads this number first. **A count, never a copy**, for
  // `reconciliationRevision`'s reason.
  //
  // **What it forces and what it cannot, in one sentence.** It forces that a
  // reactive reader of `writeInFlight`, `retainedObservationFor`,
  // `writeOutcomeUncertain`, `standingConflictFor`, `automaticReloadGuardFor` or
  // `uncertaintyAcknowledgementEligibility` re-runs after every mutation site that
  // calls `noticeHolds()` — fifteen today; it cannot force a sixteenth site to
  // call it, and `reconciliationStatus.svelte.test.ts` observes the sites a
  // status panel depends on through a real effect.
  let holdRevision = $state(0);
  // The plain counter the signal is assigned from, so that bumping it never
  // *reads* the signal: a bump from inside an effect that also read it would
  // otherwise make that effect depend on its own write.
  let holdCount = 0;
  // **What this window can say about a file it did not reload** — Phase 2d-5-4.
  // One entry per document at most, replaced rather than appended, and `$state`
  // because 2d-6 draws these: a `Map` in `$state` is not reactive without Svelte's
  // own wrapper, and a configuration is tens of files, so a scanned array is the
  // same argument `viewOf` makes one screen up.
  //
  // **Drawn since Phase 2d-6-9b, never directly.** `externalDocumentStatus()` is
  // read by `./reconciliationStatus.ts`, whose decisions `FileReconciliationStatus.svelte`
  // and `Sidebar.svelte` draw through the EN/ES keys 2d-6-9a added
  // (`describeReconciliationFileState` in `src/lib/i18n/codes.ts`).
  let externalStatuses = $state<readonly ExternalDocumentStatusEntry[]>([]);
  // **How many times each file's status has been written** — Phase 2d-5-4's second
  // review. Not `$state`: nothing draws it and nothing derives from it. It exists
  // so that an arm which wrote a status *before* an await can ask, afterwards,
  // whether it still owns that file's status — which is a question neither the
  // entry's value nor any generation this state already keeps can answer. A value
  // comparison cannot: `stale` written by this arm and `stale` written by a newer
  // transition are the same value. The projection and re-read generations cannot
  // either: an `Unreadable` observation records a status and moves neither.
  //
  // **Bumped by `noteDocumentStatus` and by nothing else**, which is what makes it
  // a fence rather than a decoration — and `open()`'s wholesale `externalStatuses =
  // []` is deliberately *not* a bump, because the open generation is what catches
  // that: a capture taken in the closed workspace fails `stillCurrent()`'s first
  // clause whatever this counter says.
  //
  // **Not cleared by `open()` either**, for `rereadGenerations`' reason one screen
  // up: clearing would set a count back to zero while a capture taken in the closed
  // workspace still held one, and monotonic counters cannot collide with a capture
  // the open generation has already invalidated. So it grows with the identities
  // this process mints, exactly as `rereadGenerations` does.
  const statusWrites = new Map<DocumentId, number>();
  // **What was observed of a path this window holds no identity for** — Phase
  // 2d-5-4. Keyed by the lossy display path and **deduplicated by it**, which is
  // the only bound there is: an `Unnamed` observation carries no identity, so the
  // accepted-sequence map cannot arbitrate one and a watcher flapping on one path
  // would otherwise append without limit. Latest wins, and nothing orders two
  // observations of two different paths.
  let pathDrift = $state<readonly ExternalPathDrift[]>([]);
  // **Which rows this window invented rather than listed** — Phase 2d-5-4, and the
  // one thing that keeps ruling 28 true of the *viewer* as well as of the
  // transitions. An `Added` observation's identity is by definition not an address
  // the open workspace resolves, so every open-workspace document command refuses
  // it — but `documents` is also what `rawTarget` picks the raw viewer's file from,
  // so a person selecting that new row and opening the viewer would have sent
  // `document_text` for exactly such an identity. The row is drawn; it is simply
  // not a target.
  //
  // **Explicit retained state rather than an inference from `loaded`.** `loaded`
  // is a wire field about whether the *engine* has read the file, and a listed
  // document can legitimately carry `false` for it — inferring addressability from
  // it would refuse a file the workspace really does resolve. What makes an
  // identity addressable is a successful `open()`, which replaces `documents`
  // wholesale from `list_documents`, so this list is cleared there and nowhere
  // else but the removal transition.
  //
  // **`$state` because `fileTextTarget` is read from markup**: the toggle's
  // condition has to re-run when a row stops being pending.
  let pendingAdditions = $state<readonly DocumentId[]>([]);
  // **The drain lifecycle, as a value beside this file** — Phase 2d-5-3. It owns
  // when a drain fires and what a batch does to the session cursor; this state owns
  // the two facts it cannot see for itself, which are the injected command surface
  // and the workspace-open generation.
  //
  // **The drain goes through `commands`, never through the module-level wrapper
  // imported at the top of this file.** That is the bound `workspace.test.ts`'s
  // drain counter measures, and the route around it — a call made through one of
  // those bindings — is what 2d-5-6 closes for all three suites.
  //
  // **Created here, started by the host.** Construction registers nothing: `start()`
  // is what subscribes, and `AppShell.svelte`'s `onMount` is its one production
  // caller (Phase 2d-5-7a). A state built by a test and never started stays a
  // coordinator that registers nothing, which is what lets every suite in this
  // directory drive `open()` without a transport.
  const reconciliation: ReconciliationCoordinator = createReconciliationCoordinator(
    {
      /**
       * Asks for everything above the session watermark.
       *
       * @param afterSequence - The coordinator's watermark.
       * @returns The batch, or a failure.
       */
      drain: (afterSequence: number) => commands.drainExternalChanges(afterSequence),
      /**
       * The generation the coordinator captures around its await.
       *
       * @returns The number `open()` last took.
       */
      openGeneration: () => openGeneration,
      report,
      /**
       * Every write surface this window has open.
       *
       * **The registry directly, not `state.openWriteSurfaces()`.** That door
       * exists to make a `$derived` re-run, and reading its mirror here would put
       * a reactive dependency inside a coordinator that is deliberately not
       * reactive. The answer is the same object either way.
       *
       * @returns The live set.
       */
      openWriteSurfaces: (): readonly OpenWriteSurface[] => writeSurfaces.openWriteSurfaces(),
      /**
       * How many times that set has changed.
       *
       * @returns The registry's own generation, never the mirror — the mirror can
       *   only be behind it.
       */
      writeSurfaceGeneration: (): number => writeSurfaces.generation(),
      /**
       * Whether the new-snippet form would offer one file as a destination.
       *
       * The private {@link creatorEligibilityFor}, which states the safe direction;
       * shared with `automaticReloadGuardFor` so the question has one answer.
       */
      creatorEligibility: creatorEligibilityFor,
      /**
       * The transition of the live surface of one kind.
       *
       * @param kind - Which kind.
       * @returns Its transition, or `null`.
       */
      transitionFor: (kind: OpenWriteSurfaceKind): WriteSurfaceTransition | null =>
        writeSurfaces.transitionFor(kind),
      /**
       * Whether this window holds a row for one identity.
       *
       * @param document - The identity.
       * @returns Whether a row with it exists.
       */
      holdsDocument: (document: DocumentId): boolean =>
        documents.some((held) => held.id === document),
      /**
       * Reads one file again under the coordinator's guard, marking it stale for
       * as long as that read is out.
       *
       * Fired rather than awaited: the coordinator's decision is complete and the
       * read's own three captures decide whether its answer is still wanted.
       *
       * **The file is marked `stale` before the read starts** — a true statement
       * for the whole time the read is out, because the window *is* still showing
       * the older projection — and the only thing that clears it is a successful
       * installation, in the same synchronous block as `installView`. That mark is
       * also what records a read that never landed: a failed read installs nothing,
       * and before the mark existed the window went on showing the old projection
       * while the arbitration key said the file was reconciled, with nothing
       * anywhere recording that anything had gone wrong.
       *
       * **`owns` is the caller's ownership question, asked in the same synchronous
       * block as the mark** — Phase 2d-5-4-C's finding 4. The mark is a statement
       * about *this file's status*, and between the arbitration that admitted the
       * observation and this line `applyChange` runs two host members —
       * `openWriteSurfaces()` and `creatorEligibility()`, the second of which walks
       * this window's row list — and then `writeSurfaceGeneration()`. A host whose
       * accessor admits a newer observation for the same file would make this write
       * land over a typed `unavailable` that nothing re-derives, because the batch
       * watermark has moved past the observation which carried the reason. The
       * caller cannot fence it from where it stands, because the write is here; so
       * the *question* travels instead of the write. **Nothing in this type forces
       * the caller to hand over a question that is really about ownership** — it is
       * a `() => boolean`, and a caller passing `() => true` would compile.
       *
       * **The failure arm is gone, and deleting it is the fix rather than a
       * regression** — Phase 2d-5-4-C's finding 2. It used to re-state `stale`
       * behind three fences: the open generation, this file's status-write count
       * and whether the window still holds a row. The fences were right, and what
       * they proved is that the write could never change a value — a write they
       * permit happens only when nothing has written this file's status since the
       * mark above, so the entry there *is* this arm's own `stale`. What the write
       * still did was advance {@link statusWriteOf}'s per-file token, which
       * `noteDocumentStatus` bumps whether or not a value changes, and that token is
       * the one an **overlapping** read captured in order to decide whether it may
       * clear the mark. A superseded read's failure therefore took ownership away
       * from a newer read that had already succeeded, and the newer read's clear was
       * suppressed: the file stayed marked `stale` permanently, with the bytes now
       * on disk on screen.
       *
       * **So the answer is not handled here, and it is not discarded either.** The
       * private helper below `report`s the failure on the one channel every other
       * failure of this state uses, and the mark above is this window's record of
       * it. What was removed is a second statement of something already true.
       *
       * **What it does not claim.** It does not retry, and it does not say *why* the
       * read failed — `report` is what carries the failure itself, and
       * {@link ExternalDocumentStatus} is a code about this window's knowledge, not
       * about the engine's refusal. The failure reaches no screen: `AppShell.svelte`
       * passes `reportIpcFailure` (`src/lib/ipc/errors.ts`) as `report`, which
       * writes to the developer console. The `stale` mark is drawn since Phase
       * 2d-6-9b, through `./reconciliationStatus.ts`, by
       * `FileReconciliationStatus.svelte` and `Sidebar.svelte`.
       *
       * **Refused outright under an uncertainty hold, and the observation
       * registered instead** — Phase 2d-6-9b-3, the orchestrator's ruling on the
       * 2d-6 record's §3 entry 15 (*the hold blocks automatic rereading after its
       * surface closes — per file, never dependent on a mounted panel*). Until this
       * phase the hold was asked only by {@link BrowserState.requestFileReread}, and
       * a drained observation with no surface over a held file was read and
       * installed while `writeOutcomeUncertain` stayed `true`. Now:
       * - **at the request**, after the `stale` mark, a held file sends no
       *   `reload_document`: the refusal costs no command;
       * - **at the installation**, after the caller's `guard` and in the same
       *   synchronous block as `installView`, the hold is asked again (entry 32's
       *   rule). Whether a hold established while the read is out reaches this
       *   question depends on whether the settling write replaced the projection:
       *   when its re-adoption installed a parse (a raw save's
       *   `adoptTheReplacedDocument`, or `adoptTheDocumentOnDisk` whose
       *   `get_document` succeeded), `rereadUnderGuard`'s projection capture
       *   refuses first and **nothing is registered** — and since Phase 2d-7-1
       *   the mark this read wrote is cleared once the read ends, while it is
       *   still the last status written for the file (`clearAnUnbackedMark`
       *   below; `docs/decisions/2d-7-1-notes.md` §2); when the re-adoption's
       *   `get_document` failed, `adoptTheDocumentOnDisk` returns before
       *   `installView`, the projection is unchanged, and this recheck refuses the
       *   install and registers the observation. `workspace.test.ts` holds both.
       *
       * **Either refusal registers the refused observation** through
       * {@link takeInObservation} — the barrier, or `observeExternalChange`'s own
       * arbitration at the generation the observation arrived at — so a `stale`
       * file under the hold has an origin to acknowledge (the ruling's *keeps an
       * exit*: acknowledge, then read again through `requestFileReread`). The
       * arbitration still decides: an observation of the bytes the standing origin
       * already carries coalesces into it (ruling 25) and registers nothing new.
       * Registration is fenced by `owns`, asked again, so an observation a newer
       * one has overtaken is not made to stand. **Nothing here forces
       * `observation` to be the one this read answers**: it is a parameter, and
       * `applyChange` in `./observationTransitions.ts` is the one caller.
       *
       * **The manual path is untouched**: `requestFileReread` and
       * {@link BrowserState.rereadDocument} call the private helper directly and
       * never pass through this member.
       *
       * @param document - The file.
       * @param guard - Asked immediately before the installation.
       * @param owns - Asked immediately before the initial mark; `false` writes no
       *   status at all. Asked again before a refused observation is registered.
       * @param observation - The observation this read answers; `null` registers
       *   nothing when the hold refuses.
       */
      rereadUnderGuard: (
        document: DocumentId,
        guard: () => boolean,
        owns: () => boolean,
        observation: ExternalConflictObservation | null
      ): void => {
        const marked = owns();
        if (marked) {
          noteDocumentStatus(document, { kind: 'stale' });
        }
        // The generation this observation arrived at, taken with the mark and
        // before the read: what a registration records (see `rememberTheConflict`).
        const arrival = projectionGenerationOf(document);
        // The two captures Phase 2d-7-1's clear below is fenced by: the workspace
        // this read belongs to, and the file's status-write count *including* the
        // mark just written, so an unmoved count means that mark is still the last
        // status written for the file.
        const opened = openGeneration;
        const markedAt = statusWriteOf(document);
        let registered = false;
        /**
         * Registers the observation the hold refused, while it still owns the file.
         */
        const registerTheRefused = (): void => {
          if (observation !== null && owns()) {
            registered = true;
            takeInObservation(document, observation, arrival);
          }
        };
        if (uncertainWrites.has(document)) {
          registerTheRefused();
          return;
        }
        /**
         * The caller's guard, then the hold asked again at the installation.
         *
         * @returns `true` when the answer may be installed.
         */
        const guardAndHold = (): boolean => {
          if (!guard()) {
            return false;
          }
          if (uncertainWrites.has(document)) {
            registerTheRefused();
            return false;
          }
          return true;
        };
        /**
         * Clears this read's own mark when the read ended under a hold with nothing
         * to back it — Phase 2d-7-1's ruling on `2d-6-9b-3-notes.md` §6 item 1.
         *
         * Reached after the read has ended, whatever it answered. **Every condition
         * is on this state's own data**, and together they name the dead end
         * exactly: the same workspace; this read wrote the mark and it is still the
         * last status written for the file; the mark is `stale`; the observation
         * was not registered; the file is under a hold; and a projection is
         * installed that replaced the one the observation arrived at. Then the
         * observation was neither installed nor registered — registering it now
         * would record a generation it never arrived at, which is what
         * `adoptDiskVersion`'s generation check refuses — so the window holds no
         * snapshot that could back the mark, and the hold stays as the statement
         * about the file.
         *
         * **What it does not know, stated.** Whether the observation's bytes are
         * newer than the projection that replaced them: revisions carry no order,
         * and the re-adoption's read may have been sent before the observation
         * arrived. The ruling clears without knowing, because under the hold the
         * window already says it cannot attribute what is on disk, and a mark
         * nothing can discharge says nothing the hold does not. **Without a hold the
         * mark stands**: the person's reread is its exit.
         */
        const clearAnUnbackedMark = (): void => {
          if (
            marked &&
            !registered &&
            opened === openGeneration &&
            statusWriteOf(document) === markedAt &&
            externalStatuses.find((entry) => entry.document === document)?.status.kind === 'stale' &&
            uncertainWrites.has(document) &&
            projectionGenerationOf(document) !== arrival &&
            viewOf(document) !== undefined
          ) {
            noteDocumentStatus(document, null);
          }
        }; // End of function clearAnUnbackedMark()
        void rereadUnderGuard(document, guardAndHold).then(clearAnUnbackedMark);
      }, // End of the coordinator-facing rereadUnderGuard member
      addDocument,
      /**
       * Drops one file, and moves the raw viewer off it if it was showing it.
       *
       * The invalidation itself is **synchronous** (ruling 31); the re-read that
       * follows is the viewer's, and is the same fire-and-forget every other place
       * that can move the viewer's target performs.
       *
       * @param document - The file that is gone.
       */
      removeDocument: (document: DocumentId): void => {
        removeDocumentFromWindow(document);
        void readFileText();
      },
      noteDocumentStatus,
      notePathDrift,
      /**
       * Re-runs the retained original open request.
       *
       * **`state.open` rather than a private helper**, because the recovery ruling
       * 11 asks for is *a true open* — the one that clears documents, projections,
       * selection, viewer state and every per-document generation — and a second
       * path to it would be a second rule that can drift from the first.
       *
       * @param request - Exactly what the original `open()` was called with.
       */
      reopenWorkspace: (request: string | null): void => {
        void state.open(request);
      },
      /**
       * Bumps the one reconciliation signal — Phase 2d-6-1c.
       *
       * One increment and nothing else, so that a callback the coordinator makes
       * from inside a transition can neither throw nor re-enter this state; what
       * it costs is one invalidation of every derivation that read a coordinator
       * reader here.
       */
      reconciliationChanged: (): void => {
        reconciliationRevision += 1;
      }
    },
    events,
    foreground
  );

  /**
   * Whether the new-snippet form would offer one file as a destination.
   *
   * **The coordinator host's `creatorEligibility` and
   * {@link BrowserState.automaticReloadGuardFor}'s `surfaceOpen` share it**, so
   * that "may a surface be about this file" is one question wherever it is asked
   * (Phase 2d-6-1b extracted it from the host literal for the second caller). A
   * file this window holds no row for is `notCreatorEligible`, which is the safe
   * direction here and the unsafe one nowhere: a `false` makes an unknown-target
   * creator *stop* covering that file, so the effect is that a document nothing
   * names may be reloaded — exactly right for a file this window is not showing,
   * since no form could have offered it.
   *
   * @param document - The file.
   * @returns Whether an unknown-target creator may be about it.
   */
  function creatorEligibilityFor(document: DocumentId): CreatorEligibility {
    const summary = documents.find((held) => held.id === document);
    if (summary === undefined) {
      return 'notCreatorEligible';
    }
    return creatorEligibilityOf(summary, viewOf(document) ?? null);
  } // End of function creatorEligibilityFor()

  /**
   * Narrows the coordinator's registration state to what a window may hold —
   * Phase 2d-6-1c.
   *
   * **The one place the rejection value is read, and it is read for one
   * comparison.** The inert source rejects with an `Error` carrying
   * `NO_RECONCILIATION_TRANSPORT`, which is the exported string that exists for
   * exactly this distinction; anything else is `rejected`. The `message` read is
   * on a value the transport threw — caller code in the sense every read of an
   * injected value is — and nothing is spent after it, so a hostile getter can
   * make this reader throw and nothing worse. Every answer is a fresh frozen
   * literal: the coordinator's own object never crosses.
   *
   * @param registration - The coordinator's answer.
   * @returns The sanitized state.
   */
  function sanitizedRegistration(registration: RegistrationState): ReconciliationRegistrationState {
    switch (registration.kind) {
      case 'idle':
      case 'registering':
      case 'registered':
      case 'abandoned':
        return Object.freeze({ kind: registration.kind });
      case 'failed': {
        const error = registration.error;
        const reason: RegistrationFailureReason =
          error instanceof Error && error.message === NO_RECONCILIATION_TRANSPORT
            ? 'noTransport'
            : 'rejected';
        return Object.freeze({ kind: 'failed', reason });
      }
      default: {
        const exhaustive: never = registration;
        return exhaustive;
      }
    }
  } // End of function sanitizedRegistration()

  /**
   * The first workspace-reload recheck that refuses, or `null` — Phase 2d-6-1c,
   * the 2d-6 record's §3 entry 29.
   *
   * **Every read is this state's own or the coordinator's, and none runs caller
   * code**: three coordinator closures over plain `let`s, a `Map` of numbers and
   * the registry's own list. That is what lets {@link reopenRetained} treat the
   * answer as current in the statement after it. The registry is read directly
   * rather than through the reactive mirror, for the coordinator host's reason:
   * this is a decision, not a dependency.
   *
   * **The order.** Disposal and the open gate first, because either means there
   * is no shown workspace for any reload to act on; then, for the lost-history
   * intent alone, whether there is a hole to recover from at all; then the two
   * conditions that are about *now* — a write that will settle by itself, and a
   * surface the person can close.
   *
   * @param intent - Which request is asking; only `lostHistory` asks the block.
   * @returns The refusal, or `null` when every recheck permits.
   */
  function workspaceReloadRefusal(
    intent: 'membership' | 'lostHistory'
  ): Extract<WorkspaceReloadOutcome, { kind: 'refused' }> | null {
    if (reconciliation.isDisposed()) {
      return { kind: 'refused', reason: 'disposed' };
    }
    if (reconciliation.awaitingWorkspaceReady()) {
      return { kind: 'refused', reason: 'workspaceNotReady' };
    }
    if (intent === 'lostHistory' && reconciliation.block().kind !== 'blockedByLostHistory') {
      return { kind: 'refused', reason: 'notBlocked' };
    }
    if (writesInFlight.size > 0) {
      return {
        kind: 'refused',
        reason: 'writeInFlight',
        documents: Object.freeze([...writesInFlight.keys()])
      };
    }
    const open = writeSurfaces.openWriteSurfaces();
    if (open.length > 0) {
      return {
        kind: 'refused',
        reason: 'surfaceOpen',
        surfaces: Object.freeze(open.map((surface) => surface.kind))
      };
    }
    return null;
  } // End of function workspaceReloadRefusal()

  /**
   * Rechecks and reopens, in one synchronous block — Phase 2d-6-1c.
   *
   * **The whole body of the two request methods.** The rechecks and the reopen
   * are adjacent statements with no caller code between them: the coordinator's
   * `reopenFromRetainedRequest` asks disposal once more on its own side and then
   * reaches `open()` through the host's `reopenWorkspace`, with the request it
   * retained. The `false` arm is reachable only by a disposal between the two
   * statements, which no code runs, and is answered as the refusal it is rather
   * than trusted away.
   *
   * @param intent - Which request is asking.
   * @returns The outcome.
   */
  function reopenRetained(intent: 'membership' | 'lostHistory'): WorkspaceReloadOutcome {
    const refusal = workspaceReloadRefusal(intent);
    if (refusal !== null) {
      return refusal;
    }
    if (!reconciliation.reopenFromRetainedRequest()) {
      return { kind: 'refused', reason: 'disposed' };
    }
    return { kind: 'reloading' };
  } // End of function reopenRetained()

  /**
   * The first guard that refuses a person's reread of one file, or `null` —
   * Phase 2d-6-1c, the 2d-6 record's §3 entry 32.
   *
   * **Asked twice by `requestFileReread`, and it is the same function both
   * times** — once before the command is sent and once inside `rereadUnderGuard`'s
   * guard, immediately before the installation. Four questions of this state and
   * the coordinator, then 1a's predicate over 1b's three facts, then the write
   * barrier — the hold before the barrier because its three reasons are the
   * stronger claims (`decideAutomaticReload` orders them so for the same reason)
   * and a write in flight is the one condition here that ends by itself. The
   * addressability read walks `documents` and `pendingAdditions`, both this
   * module's own arrays of this module's own objects; `automaticReloadGuardFor`
   * reads three tables and the eligibility predicate over ingress copies — the
   * top-level keys included, since the phase review's blocker made `ownedScalarOf`
   * copy them — so nothing here runs caller code, and the key-getter case in
   * `workspace.test.ts` is what holds that true.
   *
   * @param document - The file.
   * @returns The reason, or `null` when every guard permits.
   */
  function fileRereadRefusal(document: DocumentId): FileRereadRefusalReason | null {
    if (reconciliation.isDisposed()) {
      return 'disposed';
    }
    if (reconciliation.awaitingWorkspaceReady()) {
      return 'workspaceNotReady';
    }
    if (!documents.some((held) => held.id === document) || pendingAdditions.includes(document)) {
      return 'notAddressable';
    }
    if (reconciliation.block().kind === 'blockedByLostHistory') {
      return 'blockedByLostHistory';
    }
    const decision = decideAutomaticReload(state.automaticReloadGuardFor(document));
    if (decision.kind === 'refused') {
      return decision.reason;
    }
    if ((writesInFlight.get(document) ?? 0) > 0) {
      return 'writeInFlight';
    }
    return null;
  } // End of function fileRereadRefusal()

  /**
   * Brings the reactive mirror into step with the registry.
   *
   * Called after every operation this state performs on the registry, including
   * the ones a lease performs. Assigning an unchanged number notifies nothing, so
   * an unregister that was already inert and a `staleLease` report cost no
   * invalidation — which is why this copies the generation rather than counting
   * calls.
   */
  function noticeWriteSurfaces(): void {
    surfaceGeneration = writeSurfaces.generation();
  } // End of function noticeWriteSurfaces()

  /**
   * Announces that a per-file hold table moved — Phase 2d-6-9a's review, finding
   * 1. See `holdRevision`.
   */
  function noticeHolds(): void {
    holdCount += 1;
    holdRevision = holdCount;
  } // End of function noticeHolds()

  /**
   * One registry lease, wrapped so that using it moves the mirror.
   *
   * **The lease is the other half of the door.** Two of the three operations that
   * can change the live set are performed through it — the unregister and
   * `replaceTarget` — so a mirror updated only in
   * {@link BrowserState.registerWriteSurface} would go stale the moment a surface
   * closed or the new-snippet form reported its destination.
   *
   * **It adds no rule and reads nothing of its own.** Both wrappers call through
   * first and copy the registry's generation afterwards; `replaceTarget`'s answer
   * is passed back unchanged, because a consuming operation whose result is
   * discarded is this project's named silent-success defect class. What the wrapper
   * cannot preserve is the lease's *identity*: a caller comparing the value it was
   * handed with one the registry minted would find two different functions, and
   * nothing in the type says so. No caller does — the registry compares serials it
   * captured itself, never the lease object.
   *
   * @param lease - The lease the registry answered.
   * @returns A lease that does the same and then updates the mirror.
   */
  function mirroringLease(lease: UnregisterWriteSurface): UnregisterWriteSurface {
    /**
     * Removes the registration, then brings the mirror into step.
     *
     * @returns Nothing; see `UnregisterWriteSurface`.
     */
    const unregister = (): void => {
      lease();
      noticeWriteSurfaces();
    };
    return Object.assign(unregister, {
      /**
       * Reports the file this surface is about, then brings the mirror into step.
       *
       * @param target - The file this surface would write.
       * @returns Whatever the registry answered, unchanged.
       */
      replaceTarget: (
        target: WriteSurfaceDocumentTarget
      ): WriteSurfaceTargetReplacement => {
        const answered = lease.replaceTarget(target);
        noticeWriteSurfaces();
        return answered;
      }
    });
  } // End of function mirroringLease()

  /**
   * The loaded projection of one document, if it has arrived.
   *
   * A scan rather than a map because a configuration is tens of files, and a
   * `Map` in `$state` is not reactive without Svelte's own wrapper — a
   * dependency this phase would be taking on for a lookup that costs nothing.
   *
   * @param id - The document's identity.
   * @returns The projection, or `undefined`.
   */
  function viewOf(id: DocumentId): DocumentView | undefined {
    return views.find((view) => view.id === id);
  } // End of function viewOf()

  /**
   * How many times one document's projection has been replaced or dropped.
   *
   * @param document - The file.
   * @returns Its projection generation; zero for a file never replaced.
   */
  function projectionGenerationOf(document: DocumentId): number {
    return projectionGenerations.get(document) ?? 0;
  } // End of function projectionGenerationOf()

  /**
   * Invalidates every lookup taken against one document's projection.
   *
   * Called by {@link installView} and by {@link forgetTheReplacedDocument}, which
   * are the only two functions that replace or drop a projection.
   *
   * @param document - The file whose projection has been replaced or dropped.
   */
  function invalidateProjectionOf(document: DocumentId): void {
    projectionGenerations.set(document, projectionGenerationOf(document) + 1);
    noticeHolds();
  } // End of function invalidateProjectionOf()

  /**
   * Records that one conflict arrived, and against which projection.
   *
   * **The only thing a conflict arm does**, and it installs nothing: it writes down
   * the window this conflict describes, so that a confirmed reload much later can
   * be checked against it. Registering is not adopting — the snippet list, the
   * selection and the viewer are all untouched by this call.
   *
   * **It takes the origin, not the wire value** (ruling 22, Phase 2d-5-5a), which is
   * what makes one function serve both origins: a refused save arrives as a
   * `ConflictResult` and is wrapped by `saveConflictSource` at each of the six call
   * sites, and a watcher observation arrives narrowed and is wrapped by
   * `externalConflictSource` in {@link rememberExternalConflict}. **Nothing in
   * TypeScript forces either caller through the memo**: a fresh wrapper of the same
   * shape is a different object, so the entry written here would never be found
   * again and the adoption would be refused — safe, and silent.
   *
   * **The first registration of one origin is the only one, and that is the whole
   * of what this forces** (Phase 2d-5-5a's review, finding 1). The memos in
   * `./conflictSource.ts` answer one object per wire refusal and one per narrowed
   * observation, so registering the same conflict twice lands on the *same* key —
   * and overwriting the entry would write **today's** projection generation over
   * the one the conflict really arrived at, which is exactly the fact
   * {@link BrowserState.adoptDiskVersion} reads to refuse an install that would
   * move the window backwards. A second registration is not a second conflict, so
   * it is ignored outright rather than merged: both halves of the entry are kept,
   * which also means a re-registration cannot re-point an origin at another file.
   * What it does **not** force is that a *different* origin object for the same
   * change be recognised — two narrowings of one wire snapshot are two keys and the
   * second gets its own entry, as it always has.
   *
   * **The generation is the one the conflict *arrived* at, and a caller that omits
   * it says "now".** All seven save wrappers do omit it, and that is honest for them:
   * a refusal is registered in the same synchronous block the answer arrived in.
   * A **retained** observation is the one case where the two differ — it arrived
   * while a write was in flight and is registered after that write settled, with a
   * committing write's own projection replacement in between — so
   * {@link beginWrite} passes the generation it recorded when it took the
   * observation in. Nothing in TypeScript distinguishes an honest generation from a
   * convenient one; the default is what a caller with nothing to say gets.
   *
   * @param document - The file the conflict is about.
   * @param source - Where the conflict came from, as the memoized origin object.
   * @param generation - That file's projection generation when this conflict
   *   arrived. Defaults to the current one.
   */
  function rememberTheConflict(
    document: DocumentId,
    source: ConflictSource,
    generation: number = projectionGenerationOf(document)
  ): void {
    if (conflictOrigins.has(source)) {
      // Already registered, at the generation it really arrived at. `WeakMap.has`
      // on an object key runs no user code, so nothing can run between this test
      // and the two writes below.
      return;
    }
    conflictOrigins.set(source, { document, generation });
    conflictStatusWrites.set(source, statusWriteOf(document));
    // **And this origin is the one that speaks for the file now** — Phase 2d-5-5b.
    // Written here rather than at the call sites so that the two maps cannot be
    // updated apart, and written *after* the first-registration test so that
    // re-registering an outlived origin cannot make it standing again: that is the
    // same defect first-registration-wins exists for, one map along.
    standingConflicts.set(document, source);
    noticeHolds();
  } // End of function rememberTheConflict()

  /**
   * Registers a save refused as a conflict, marking the file `stale` first when the
   * refusal read a revision the window does not show — Phase 2d-6-9b-1.
   *
   * **The orchestrator's ruling on `stale`**: it means *the window holds a disk
   * snapshot of this file newer than its installed projection*, whether the snapshot
   * came from an observation or from a save refused as a conflict. The refused
   * save's own reading is coalesced by the backend as a duplicate
   * (`docs/decisions/2d-6-9a-notes.md` §3.3), so no observation will ever mark the
   * file for it, and this arm is the only place that can. The seven save wrappers
   * call this and nothing else on their conflict arm.
   *
   * **What it marks over, and what it leaves alone.** It writes only over no status
   * or an existing `stale`; an `unavailable` or a `removed` is an observation's
   * statement that this refusal cannot order itself against — a refusal carries no
   * sequence — so it stands. With no projection installed there is nothing the
   * snapshot is newer than, and nothing is marked. The mark is written **before**
   * the registration so that {@link rememberTheConflict} records the status-write
   * count that includes it, which is what lets {@link BrowserState.adoptDiskVersion}
   * clear exactly this mark on installation and nothing written after it.
   *
   * **Revisions are hashes and carry no order**, so "newer" is this state's
   * inference that a refusal's locked read is later than the projection it
   * refused against; a different revision is the whole of the test.
   *
   * @param document - The file the save was aimed at.
   * @param source - The refusal, as the memoized `save` origin.
   */
  function rememberTheSaveConflict(document: DocumentId, source: SaveConflictSource): void {
    const diskRevision = source.conflict.disk_revision;
    const held = viewOf(document);
    const status = externalStatuses.find((entry) => entry.document === document)?.status ?? null;
    if (
      held !== undefined &&
      held.revision !== diskRevision &&
      (status === null || status.kind === 'stale')
    ) {
      noteDocumentStatus(document, { kind: 'stale' });
    }
    rememberTheConflict(document, source);
  } // End of function rememberTheSaveConflict()

  /**
   * What this state currently says speaks for one file, or `null`.
   *
   * @param document - The file.
   * @returns The standing origin, or `null` when this state holds no conflict for
   *   it.
   */
  function standingConflictFor(document: DocumentId): ConflictSource | null {
    return standingConflicts.get(document) ?? null;
  } // End of function standingConflictFor()

  /**
   * The first mint guard that refuses an acknowledgement of one file's hold
   * against one origin, or `null` — Phase 2d-6-9a's review, finding 2.
   *
   * **The one predicate the mint and the eligibility reader share**, in the
   * spend's order: a write in flight, no hold, an origin that is not the standing
   * one (or none), an origin whose arrival generation the projection has moved
   * past. It reads only this state's own tables — a `WeakMap` lookup by identity,
   * `Map`s, a `Set` and a counter — and writes nothing. What it cannot answer is
   * the spend's `unknown`, `spent`, `workspaceReplaced` and `holdMoved`: those
   * are facts about one minted token, and no token exists here.
   *
   * @param document - The file.
   * @param source - The origin a person would acknowledge, or `null` when none
   *   stands.
   * @returns The refusal, or `null` when a token may be minted.
   */
  function acknowledgementMintRefusal(
    document: DocumentId,
    source: ConflictSource | null
  ): UncertaintyAcknowledgementIneligibility | null {
    if ((writesInFlight.get(document) ?? 0) > 0) {
      return 'writeInFlight';
    }
    if (!uncertainWrites.has(document)) {
      return 'noHold';
    }
    if (source === null || standingConflicts.get(document) !== source) {
      return 'noStandingOrigin';
    }
    const origin = conflictOrigins.get(source);
    if (origin === undefined || origin.generation !== projectionGenerationOf(document)) {
      return 'projectionReplaced';
    }
    return null;
  } // End of function acknowledgementMintRefusal()

  /**
   * Arbitrates one observation against what stands, and registers what wins.
   *
   * **The one place a verdict becomes a registration**, and every arm that names a
   * new origin goes through {@link rememberTheConflict}, so the origin map, the
   * standing map and the generation an origin arrived at are written by one
   * function. `coalesced` and `notLater` register nothing: ruling 25 says the
   * watcher observation must not replace the standing conflict's model, its
   * messages **or its source identity**, and registering it would replace the last
   * of the three.
   *
   * **The uncertainty operand is read here and once**, from this state's own set,
   * so the arbitration is made against the same answer the verdict reports.
   *
   * **Every state operand is captured before the arbitration and re-read after
   * it** (this phase's review, finding 2). Deciding costs two kinds of
   * caller-controlled read — `standingConflictOf` walks the standing origin, and
   * `arbitrateObservation` walks the arriving observation — and a property read
   * runs arbitrary code through a getter or a `Proxy` trap, which can re-enter this
   * state through any of its methods: register a newer conflict, open a write
   * barrier, replace the projection. Registering afterwards without looking would
   * overwrite that newer origin with this older verdict, and last-registration-wins
   * means nothing would refuse it. So the four facts this verdict was decided
   * against are compared with the four that hold at the spend, and a verdict
   * decided against a state that is gone registers nothing.
   *
   * **What it does then is retain the observation and answer `retained`**, which is
   * the conservative direction and not a dropped reading: an observation held is an
   * observation no one has acted on. **Three things release it** (the 2d-6
   * record's §5.6): the next settlement of a write for that file, a person's
   * {@link BrowserState.retryRetainedObservation} — one attempt per press, which
   * lands here again at the same arrival generation — and `open()` clearing the
   * table. Nothing in TypeScript says a held observation will be looked at, and
   * nothing schedules a look on its own.
   *
   * **It decides and registers; it does not deliver.** The envelope it answers is
   * sealed by `arbitratedDelivery` or `retainedDelivery` in
   * `./observationDelivery.ts`, so the verdict inside is about the observation
   * inside by construction, and {@link arbitrateAndDeliver} is the one caller that
   * hands it to the receivers — every path that reaches this function goes through
   * that one, so an arbitration cannot be decided here and go unannounced, which
   * is what happened to the settlement's answer before Phase 2d-6-1b (the 2d-6
   * record's §3 entry 2).
   *
   * @param document - The file, read off the observation by the caller and taken
   *   once.
   * @param observation - The narrowed observation.
   * @param arrival - That file's projection generation when this observation
   *   arrived, which is what a registration records.
   * @returns What was decided, sealed with the observation it is about.
   */
  function arbitrateHere(
    document: DocumentId,
    observation: ExternalConflictObservation,
    arrival: number
  ): ObservationDelivery {
    const standing = standingConflicts.get(document);
    const uncertain = uncertainWrites.has(document);
    const generation = projectionGenerationOf(document);
    const delivery = arbitratedDelivery(
      standing === undefined ? null : standingConflictOf(standing),
      observation,
      uncertain
    );
    if (
      standingConflicts.get(document) !== standing ||
      uncertainWrites.has(document) !== uncertain ||
      projectionGenerationOf(document) !== generation ||
      (writesInFlight.get(document) ?? 0) > 0
    ) {
      // **The state this verdict was decided against moved while it was being
      // decided**, so the verdict is about a window that is gone: a newer origin
      // may stand, a write may now be in flight, or the projection this observation
      // would be registered against may have been replaced. All four reads here are
      // of this state's own tables — a `Map` keyed by a `DocumentId` and a `Set` of
      // them — so nothing can run between them and the registration below.
      retainObservation(document, observation, arrival);
      return retainedDelivery(observation);
    }
    const verdict = delivery.verdict;
    switch (verdict.kind) {
      case 'raised':
      case 'raisedWithoutReload':
      case 'supersedes':
        // **The newer observation is registered as its own origin**, which is the
        // obligation Phase 2d-5-5a's first-registration-wins rule hands this one:
        // re-registering the origin it replaces would write nothing, so a
        // supersession that expected the standing entry to move would silently
        // leave the outlived one in place. **At the generation this observation
        // arrived at**, never at today's: see {@link rememberTheConflict}.
        rememberTheConflict(document, verdict.source, arrival);
        return delivery;
      case 'coalesced':
      case 'notLater':
        return delivery;
      default: {
        // `retained` and `writtenHere` are not arms here: `arbitratedDelivery`
        // answers an `ArbitratedDelivery`, whose verdict is an `ArbitrationOutcome`.
        const unreachable: never = verdict;
        return unreachable;
      }
    }
  } // End of function arbitrateHere()

  /**
   * Arbitrates one observation and hands the one decision to every receiver over
   * its file — Phase 2d-6-1b, the 2d-6 record's §3 entries 2 and 4.
   *
   * **The one caller of {@link arbitrateHere}, and the one path every verdict
   * travels**: the public `observeExternalChange`, the coordinator's automatic
   * reread refused under an uncertainty hold (both through
   * {@link takeInObservation}, the second since Phase 2d-6-9b-3), the lease's
   * settlement in {@link beginWrite} and the person's `retryRetainedObservation`
   * all end here,
   * so a session is told about a settlement on the same path it was told the
   * observation was held on, and no arbitration is decided and discarded. It adds
   * no rule of its own.
   *
   * @param document - The file, taken once by the caller.
   * @param observation - The narrowed observation.
   * @param arrival - That file's projection generation when the observation
   *   arrived.
   * @returns The envelope that was delivered.
   */
  function arbitrateAndDeliver(
    document: DocumentId,
    observation: ExternalConflictObservation,
    arrival: number
  ): ObservationDelivery {
    const delivery = arbitrateHere(document, observation, arrival);
    deliver(document, delivery);
    return delivery;
  } // End of function arbitrateAndDeliver()

  /**
   * Takes one narrowed observation in: held behind a write in flight, or
   * arbitrated and delivered — the body of {@link BrowserState.observeExternalChange},
   * shared since Phase 2d-6-9b-3 with the coordinator's refused automatic reread.
   *
   * **One rule for both callers**, so an observation the hold kept from being
   * installed is registered exactly as one a surface handed in would be: behind
   * ruling 27's barrier when a write is out, and otherwise through
   * {@link arbitrateAndDeliver}, where ruling 25's coalescing and the standing
   * origin's sequence still decide whether it becomes the file's origin. It reads
   * nothing of the observation's itself; the caller took `document` once.
   *
   * @param document - The file, taken once by the caller.
   * @param observation - The narrowed observation.
   * @param arrival - That file's projection generation when the observation
   *   arrived.
   * @returns The envelope that was delivered.
   */
  function takeInObservation(
    document: DocumentId,
    observation: ExternalConflictObservation,
    arrival: number
  ): ObservationDelivery {
    if ((writesInFlight.get(document) ?? 0) > 0) {
      // **Ruling 27's barrier.** A write this window started is still out, so what
      // is on disk cannot be attributed yet: it is held and coalesced with
      // whatever was already held, and nothing is applied until the write settles.
      // **Held, and said so** (Phase 2d-6-1b): the receivers over the file get a
      // `retained` envelope, so a session can say an observation is waiting, and
      // the settlement that releases it publishes on the same path.
      retainObservation(document, observation, arrival);
      const held = retainedDelivery(observation);
      deliver(document, held);
      return held;
    }
    return arbitrateAndDeliver(document, observation, arrival);
  } // End of function takeInObservation()

  /**
   * Hands one sealed envelope to every receiver registered over one file, in the
   * order decisions were made — Phase 2d-6-1b, and its review's findings 1 and 2.
   *
   * **Synchronous, and queued behind the delivery in progress.** The outermost
   * call drains: it hands out its own envelope, then every envelope a receiver
   * published while being told — through `observeExternalChange` or the retry —
   * in the order they were decided. A nested call therefore returns at once and
   * its envelope reaches the receivers after the current one has reached them
   * all; without that, a receiver publishing a newer decision from inside an older
   * one would hand its sibling the newer verdict first. No `await` and no
   * microtask: the drain ends before the outermost call returns.
   *
   * **One drain hands out each (observation, verdict kind) pair once.** A repeat
   * of a pair this drain already delivered goes back to its caller and to nobody
   * else — within one synchronous block a second verdict of the same kind about
   * the same object tells a recipient nothing the first did not, and delivering
   * it is exactly what lets a receiver that re-publishes what it receives loop for
   * ever. **What that bounds is repetition, not invention**: a receiver that
   * manufactures a fresh observation on every delivery loops through this door as
   * it would through any, and nothing in TypeScript stops it.
   *
   * **The recipients of one envelope are fixed before the first is called**, and
   * are read when that envelope is handed out — so a receiver registered by a
   * sibling during a drain is told the *later* envelopes of that drain and not the
   * one being handed out when it registered.
   *
   * **Nothing escapes {@link handOut}.** Each receiver call is isolated, and so is
   * the reporting of what it threw, because this runs from the write lease's
   * `close()` inside the seven wrappers' `finally` — a throw escaping from here
   * would replace a settled write's answer with a session's exception, and a
   * committed write is never afterwards reported as an error.
   *
   * **It touches no table of this state**: it neither admits a sequence nor moves
   * the coordinator's watermark — it cannot reach either — and it installs nothing.
   *
   * @param document - The file the envelope is about.
   * @param delivery - The sealed decision.
   */
  function deliver(document: DocumentId, delivery: ObservationDelivery): void {
    if (delivering) {
      pendingDeliveries.push({ document, delivery });
      return;
    }
    delivering = true;
    try {
      let next: PendingDelivery | undefined = { document, delivery };
      while (next !== undefined) {
        handOut(next.document, next.delivery);
        next = pendingDeliveries.shift();
      } // End of the loop that drains the delivery queue
    } finally {
      // `handOut` cannot throw, so this is reached with the queue empty; the reset
      // is unconditional all the same, so that no future edit could leave a drain
      // marked as running with envelopes stranded behind it.
      delivering = false;
      pendingDeliveries.length = 0;
      handedOutThisDrain.clear();
    }
  } // End of function deliver()

  /**
   * Hands one envelope to the receivers registered over its file right now, once
   * per (observation, verdict kind) pair per drain, containing everything they
   * throw — Phase 2d-6-1b's review, finding 1.
   *
   * **Two boundaries, not one.** A receiver that throws is reported through the
   * injected `report`, classified as an `unexpected` failure — the one developer
   * channel this state has, at the cost of a console prefix naming a command where
   * the fault is a session's. But `classifyFailure` in `../ipc/errors` reads `code`
   * off whatever was thrown, so a thrown object with a throwing getter makes the
   * classification throw, and an injected reporter can throw on its own; either
   * would have escaped the first `catch`. The second `catch` drops what the first
   * could not report. **It is the one place this state drops an error, and the
   * reason is stated where it happens**: the channel that carries errors is what
   * failed, nothing else can carry it, and the committed write's answer must
   * survive. **Nothing in TypeScript stops a receiver or a reporter throwing**, and
   * a receiver that does has told nobody what it did with the envelope.
   *
   * @param document - The file the envelope is about.
   * @param delivery - The sealed decision.
   */
  function handOut(document: DocumentId, delivery: ObservationDelivery): void {
    // **Own data throughout.** The envelope is this module's frozen literal, the
    // verdict inside it is a constructor's frozen literal, and the two tables are
    // keyed by an object and a `DocumentId`; no read below runs user code until a
    // receiver is called.
    const observation = delivery.observation;
    const kind = delivery.verdict.kind;
    const handed = handedOutThisDrain.get(observation);
    if (handed === undefined) {
      handedOutThisDrain.set(observation, new Set([kind]));
    } else if (handed.has(kind)) {
      return;
    } else {
      handed.add(kind);
    }
    const registered = observationReceivers.get(document);
    if (registered === undefined) {
      return;
    }
    const recipients = [...registered];
    for (const registration of recipients) {
      try {
        registration.receiver(delivery);
      } catch (raw: unknown) {
        try {
          report(classifyFailure(raw));
        } catch {
          // Dropped, and said so above: the reporter, or the classification of a
          // hostile thrown value, is what failed here.
        }
      }
    } // End of the loop over the receivers registered when the envelope was handed out
  } // End of function handOut()

  /**
   * Takes one observation into ruling 27's barrier, keeping the newer of the two.
   *
   * **The only writer of `retainedObservations`**, so the rule that an arrival
   * generation travels with the observation it belongs to cannot be written down in
   * two places and differ. Coalescing is `newestObservationOf`'s: a strictly
   * greater sequence replaces what is held, and an equal or lower one leaves it —
   * **with the generation it was held at**, because that reading is the one that is
   * still being kept.
   *
   * **The status-write count is captured with the arrival generation, and on the
   * same rule** — Phase 2d-7-1. A reading that replaces what is held records the
   * count as it stands now, which on the coordinator's path already includes the
   * `stale` mark its own arrival wrote (`tellTheSurfaceAbout` marks before it
   * calls the surface that hands the reading here); one that is coalesced away
   * leaves the held record, count included, untouched, so a mark some other cause
   * wrote meanwhile is not adopted by a reading that was dropped.
   *
   * @param document - The file.
   * @param observation - The observation that arrived.
   * @param arrival - That file's projection generation at this arrival.
   */
  function retainObservation(
    document: DocumentId,
    observation: ExternalConflictObservation,
    arrival: number
  ): void {
    const held = retainedObservations.get(document) ?? null;
    const kept = newestObservationOf(held === null ? null : held.observation, observation);
    retainedObservations.set(
      document,
      held !== null && kept === held.observation
        ? held
        : { observation: kept, generation: arrival, statusWrites: statusWriteOf(document) }
    );
    noticeHolds();
  } // End of function retainObservation()

  /**
   * Clears the `stale` mark a reading dropped as `writtenHere` leaves behind, when
   * the window holds that reading's bytes — Phase 2d-7-1's ruling
   * (`docs/decisions/2d-7-1-notes.md` §2), and `2d-6-11a-notes.md` §5 item 1.
   *
   * **Three conditions, each on this state's own data.**
   * - The file's status is `stale`: an `unavailable` or a `removed` is an
   *   observation's statement about the file that no write answers.
   * - The status-write count is still the one captured when the barrier took the
   *   reading in (`RetainedObservation.statusWrites`). That is the provenance: the
   *   mark standing is the one the reading's arrival wrote, or one written before
   *   it, and no later cause has written since. A mark written after it — a later
   *   reading the barrier never held, a refused save of an overlapping write — is
   *   that cause's and stands.
   * - The installed projection is of the revision the write ended on, which is the
   *   revision the reading names. A write whose re-read failed leaves the window
   *   without those bytes, and then the mark is true and stands.
   *
   * **What it does not know, stated.** The count cannot say *who* wrote a mark
   * older than the reading; such a mark is cleared too, because the window now
   * holds the bytes of a reading that arrived after it. Revisions are hashes and
   * carry no order, so "after" is arrival order in this window — the same inference
   * {@link BrowserState.adoptDiskVersion}'s own clear makes.
   *
   * @param document - The file the write was aimed at.
   * @param statusWrites - The status-write count captured with the held reading.
   * @param revision - The revision the write ended on.
   */
  function clearTheWrittenReadingsMark(
    document: DocumentId,
    statusWrites: number,
    revision: ContentRevision
  ): void {
    const status = externalStatuses.find((entry) => entry.document === document)?.status ?? null;
    if (
      status !== null &&
      status.kind === 'stale' &&
      statusWriteOf(document) === statusWrites &&
      viewOf(document)?.revision === revision
    ) {
      noteDocumentStatus(document, null);
    }
  } // End of function clearTheWrittenReadingsMark()

  /**
   * Opens ruling 27's barrier for one file and hands back the one way to close it.
   *
   * **A lease rather than a bare count**, for `writeSurfaceRegistry.ts`'s reason:
   * the lease is one-shot, so a wrapper that somehow closed it twice closes the
   * barrier once, and two overlapping writes each hold their own.
   *
   * **Two methods, and the split is this phase's review, finding 3.** `expect`
   * records what the write has established without releasing anything; `close`
   * releases, and is what the seven wrappers call from a `finally`. The barrier is
   * therefore closed on **every** exit a wrapper has, including an exception — a
   * rejected command, a reporter that threw, a re-read that threw — where the
   * previous shape left the file barriered for the life of the session and its
   * reconciliation silently dead.
   *
   * **What `close` settles on when nothing was expected is `uncertain`, and that is
   * a decision rather than a default.** An exception before the command answered
   * leaves this application unable to say whether the file was written, and
   * `uncertain` is what "cannot be attributed" is called; it forbids automatic
   * reload for that file until a later write of this window's own ends on a named
   * revision, `open()` replaces the workspace, or the person acknowledges the
   * snapshot through {@link BrowserState.acknowledgeWriteUncertainty} (Phase
   * 2d-6-1b's third exit). An exception *after* the answer settles on what the
   * answer established, because that is known and losing it would mark a file
   * unattributable for a failure that has nothing to do with the disk.
   *
   * **What `close` releases is delivered, not discarded** — Phase 2d-6-1b, the
   * 2d-6 record's §3 entry 2. A held observation the settlement arbitrates goes
   * through {@link arbitrateAndDeliver}, and one it drops as a reading of the
   * bytes the write ended on is delivered as `writtenHere`, so a session told
   * `retained` while the write was out is told how the wait ended on the same
   * path. Both run synchronously inside the wrapper's `finally`, before the
   * wrapper's promise settles; entry 5's ordering obligation on the session that
   * receives its own settlement is stated at
   * {@link BrowserState.registerObservationReceiver}.
   *
   * **Nothing in TypeScript forces a caller to close at all**, and a wrapper that
   * dropped the lease would still leave the barrier open; the `finally` at each of
   * the six call sites is the whole of what closes it.
   *
   * @param document - The file being written.
   * @returns The lease: `expect` records, `close` releases exactly once.
   */
  function beginWrite(document: DocumentId): WriteLease {
    writesInFlight.set(document, (writesInFlight.get(document) ?? 0) + 1);
    noticeHolds();
    let settled = false;
    // What this write has established so far, or `null` while it has established
    // nothing. Overwritten rather than merged: a later reading of one write's own
    // outcome supersedes an earlier one.
    let expected: WriteSettlement | null = null;
    return {
      /**
       * Records what this write established; see {@link WriteLease.expect}.
       *
       * @param settlement - What the answer establishes about the file.
       */
      expect(settlement: WriteSettlement): void {
        expected = settlement;
      },
      /** Releases the barrier once; see {@link WriteLease.close}. */
      close(): void {
        if (settled) {
          return;
        }
        settled = true;
        const settlement: WriteSettlement = expected ?? { kind: 'uncertain' };
        // **The uncertainty is recorded before anything is released**, so a release
        // that arbitrates a held observation arbitrates it under what this write
        // just established. An `ended` outcome names the revision the file holds and
        // therefore ends an earlier uncertainty; `nothingWritten` establishes
        // nothing new and leaves one standing.
        //
        // **Every `uncertain` settlement is a new hold, counted** — Phase 2d-6-1b.
        // The generation moves whether or not the file was already in the set, so
        // an acknowledgement minted against the earlier hold is refused for this
        // one: the snapshot the person reviewed then says nothing about this write.
        if (settlement.kind === 'uncertain') {
          uncertainWrites.add(document);
          uncertaintyGenerations.set(document, (uncertaintyGenerations.get(document) ?? 0) + 1);
          noticeHolds();
        } else if (settlement.kind === 'ended') {
          uncertainWrites.delete(document);
          noticeHolds();
        }
        const held = (writesInFlight.get(document) ?? 1) - 1;
        if (held > 0) {
          // Another write of this file is still out, so the barrier stays closed
          // and what it holds is left for that one's settlement to release.
          writesInFlight.set(document, held);
          noticeHolds();
          return;
        }
        writesInFlight.delete(document);
        noticeHolds();
        const retained = retainedObservations.get(document) ?? null;
        // The window the held observation arrived at, or — when nothing is held and
        // the arms below reach no arbitration — this one.
        const arrival =
          retained === null ? projectionGenerationOf(document) : retained.generation;
        const release = releaseBarrier(
          settlement,
          retained === null ? null : retained.observation
        );
        switch (release.kind) {
          case 'nothingRetained':
            return;
          case 'writtenHere':
            // A reading of exactly the bytes this transaction ended on, so it is
            // not news about a change. It is dropped rather than arbitrated —
            // arbitrating it would supersede nothing and coalesce into whatever
            // stands, which is an answer about a conflict rather than about a
            // write. **Dropped from the table, and announced** (Phase 2d-6-1b):
            // the sessions that were told `retained` are told the check happened
            // and nothing stands from it, on the same path.
            retainedObservations.delete(document);
            noticeHolds();
            // **And its `stale` mark cleared where the window holds its bytes** —
            // Phase 2d-7-1's ruling, before the delivery so that a session told
            // `writtenHere` reads the settled status. `retained` is never `null`
            // on this arm and the settlement is always `ended` (`releaseBarrier`
            // answers `writtenHere` on nothing else); the two checks say so to
            // the compiler rather than guard anything.
            if (retained !== null && settlement.kind === 'ended') {
              clearTheWrittenReadingsMark(document, retained.statusWrites, settlement.revision);
            }
            deliver(document, writtenHereDelivery(release.observation));
            return;
          case 'arbitrate':
            retainedObservations.delete(document);
            noticeHolds();
            // **Arbitrated at the generation it arrived at, not at this one.** A
            // committing write replaced this file's projection before this release
            // ran — the wrappers close after their own adoption, deliberately — so
            // registering at today's generation would tell `adoptDiskVersion` that
            // this observation had seen a window it never saw (finding 1).
            // **And delivered** — Phase 2d-6-1b, the 2d-6 record's §3 entry 2: the
            // answer used to be discarded here, which left a session told
            // `retained` waiting for a verdict that had already been reached.
            arbitrateAndDeliver(document, release.observation, arrival);
            return;
          default: {
            const unreachable: never = release;
            return unreachable;
          }
        } // End of the switch over what the barrier released
      } // End of function close()
    };
  } // End of function beginWrite()

  /**
   * What one of the seven writing wrappers' answers settled as (ruling 27).
   *
   * **One mapping for all seven**, so a wrapper cannot invent a fourth reading of its
   * own outcome. `saved` names the revision the transaction ended on whether or not
   * it committed — `committed: false` is a documented success and the file holds
   * that revision either way — and both `refused` and `conflict` wrote nothing.
   *
   * @param outcome - The transaction's own arm and the revision a `saved` carries.
   * @returns The settlement.
   */
  function settlementOfOutcome(
    outcome:
      | { readonly outcome: 'saved'; readonly revision: ContentRevision }
      | { readonly outcome: 'refused' | 'conflict' }
  ): WriteSettlement {
    return outcome.outcome === 'saved'
      ? { kind: 'ended', revision: outcome.revision }
      : { kind: 'nothingWritten' };
  } // End of function settlementOfOutcome()

  /**
   * What a rejected command settled as (ruling 27).
   *
   * @param written - `mayHaveWritten` of the failure, taken by the caller.
   * @returns The settlement.
   */
  function settlementOfFailure(written: boolean): WriteSettlement {
    return written ? { kind: 'uncertain' } : { kind: 'nothingWritten' };
  } // End of function settlementOfFailure()

  /**
   * Takes the next re-read generation for one document.
   *
   * Called immediately before the read it belongs to, so that a re-read started
   * afterwards for the same file makes this one's capture stale.
   *
   * @param document - The file about to be read again.
   * @returns The generation this read is the newest at.
   */
  function nextRereadOf(document: DocumentId): number {
    const next = (rereadGenerations.get(document) ?? 0) + 1;
    rereadGenerations.set(document, next);
    return next;
  } // End of function nextRereadOf()

  /**
   * Replaces the held selection, and cancels any lookup the old one was for.
   *
   * The invariant is that **no selection is assigned without `selectGeneration`
   * having been bumped in the same synchronous block**, so an answer that lands
   * afterwards is describing an intent nobody holds. Every write to `selected`
   * goes through here to get that, with exactly **two** deliberate exceptions,
   * each of which bumps the counter itself:
   *
   * - `select()`'s own assignment, which bumps at entry instead — a call cannot be
   *   allowed to cancel the lookup it is about to take;
   * - `open()`'s, which bumps globally before clearing both the map and the
   *   selection, because every projection of the workspace being closed is going.
   *
   * **That list is maintained by hand and TypeScript does not enforce it.** What
   * the compiler forces is nothing at all here: `selected` is a `$state` binding in
   * this module's scope, so a third direct assignment added later would type-check
   * and would strand exactly the lookup this function exists to cancel. The
   * enumeration above is the check, and it is a call-site one — the third-pass
   * review's only finding was that an earlier version of this comment claimed one
   * exception when there were two.
   *
   * **This is the half {@link invalidateProjectionOf} cannot do**, and the two are
   * about different things. A create committing in file B can move the selection to
   * the snippet it made while a click on a snippet of file A is still being checked
   * across the boundary; nothing about A's projection changed, so A's projection
   * generation is untouched, and without this bump A's stale answer would be
   * repaired and would drag the person back off the snippet they just made.
   *
   * @param next - The selection to hold, or `null` to hold none.
   */
  function replaceSelection(next: SelectedMatch | null): void {
    selectGeneration += 1;
    selected = next;
  } // End of function replaceSelection()

  /**
   * Whether a selection lookup taken earlier still describes something.
   *
   * Two questions, and the confirmation review's High finding is that they were
   * one: whether the **intent** it was serving has been replaced, and whether the
   * **projection** its identity was minted from has been. A lookup survives only
   * while both answers are no.
   *
   * @param intent - The selection generation the lookup was taken at.
   * @param document - The file the lookup's identity belongs to.
   * @param projection - That file's projection generation when it was taken.
   * @returns Whether the answer must be dropped rather than acted on.
   */
  function selectionLookupIsStale(
    intent: number,
    document: DocumentId,
    projection: number
  ): boolean {
    return intent !== selectGeneration || projection !== projectionGenerationOf(document);
  } // End of function selectionLookupIsStale()

  /**
   * The matches the current sidebar entry puts in scope, unsearched.
   *
   * A function rather than two copies of the same expression in two getters,
   * which is also why `visibleMatches` below does not have to reach through
   * `this` to find it.
   *
   * **Both branches ask `holdsMatches`, and they have to.** A `matches` array is
   * not evidence that a document is a snippet file: a `config/*.yml` whose
   * content carries match-file keys is projected as `DocumentShape::MatchFile`
   * **on purpose** (`crates/espansoconfig-core/src/model/document.rs`), so
   * `view.matches` on a profile can be non-empty. The sidebar's count already
   * refuses such a document — `holdsMatches` guards the counts map and
   * `buildSidebar`'s total — so a list built without the same guard would show
   * rows that the total does not count. That is the second review pass's
   * finding, and it is this sub-phase's Medium 2 fix regressing itself: before
   * profiles were projected, no such view existed to leak.
   *
   * The question is asked of `kind`, which is what espanso treats the file as
   * and is a fact about **where it lives**, not of `shape`, which is what its
   * content looks like. Espanso does not load matches out of `config/`,
   * whatever the file says.
   *
   * @returns The matches in scope, in source order.
   */
  function scopedMatches(): readonly MatchView[] {
    if (selection.kind === 'document') {
      const view = viewOf(selection.id);
      return view !== undefined && holdsMatches(view) ? view.matches : [];
    }
    // Source order within a file, file order between files: both are orders
    // the user can see, and neither is invented here.
    return views.flatMap((view) => (holdsMatches(view) ? [...view.matches] : []));
  } // End of function scopedMatches()

  /**
   * Records a failure: on the state for the screen, and in the console.
   *
   * @param next - The classified failure.
   */
  function fail(next: IpcFailure): void {
    failure = next;
    status = 'failed';
    report(next);
  } // End of function fail()

  /**
   * Puts a freshly read projection in place of the cached one.
   *
   * Everything on this state that describes a document's contents is read off
   * `views`: the snippet list, the counts, `selectedMatch`. A recovery that
   * installed a new identity and left the old projection in place would leave
   * all three describing bytes that are no longer on disk, which is what the
   * 1c-1 review found. The replacement is in place, so file order is kept.
   *
   * **It also drops the raw viewer's snapshot of that same file**, which is the
   * second half of the 2c-1b review's first finding. A held snapshot was taken
   * against the projection this call is replacing; leaving it in place leaves the
   * viewer drawing bytes from one revision beside a snippet list drawn from
   * another, and — since 2c-1b — offers an *Edit* whose starting text and starting
   * revision come from two different reads. `readFileText` skips a re-read when
   * the document identity is unchanged, so nothing else on this path would have
   * asked for the file again. Every caller that installs a projection already
   * calls `readFileText` afterwards, so dropping it here is what makes them
   * re-read rather than what leaves them empty.
   *
   * **It also invalidates every selection lookup taken against the projection it
   * replaces** — `next.id`'s, and no other file's. That is the 2c-3a-1 review's
   * fourth finding as corrected by the confirmation pass, and the scope is the
   * correction. The defect the bump exists for: a `select()` awaiting `get_match`
   * lands after a deletion's adoption has chosen the neighbour and raised the
   * mandated `deleted` notice, its stale identity is repaired against the file the
   * commit produced, and the repair clears the selection and replaces the notice
   * with `differentMatch` — the person is told their file moved under them when
   * what actually happened is the deletion they asked for. A create is dragged off
   * the snippet it just made the same way.
   *
   * **What the first fix round got wrong was the width, not the place.** It bumped
   * one global counter and the doc comment here argued that every caller "wants"
   * it, enumerating them. The enumeration was true of every caller and said nothing
   * about the *other* documents each call was not concerned with: a raw save of
   * file B commits, this function installs B, and a click on a snippet of file A
   * that is still being checked across the boundary is cancelled by it. A's
   * identity then goes unrepaired and the state keeps a `MatchId` that resolves to
   * nothing. So the counter is per document, and the claim this comment can make is
   * the narrow one — a lookup is cancelled by a replacement **of the projection it
   * was taken from**.
   *
   * The other half, a selection replaced without any projection being replaced, is
   * {@link replaceSelection}'s and is stated there. Neither implies the other, and
   * `select()` checks both.
   *
   * The bump happens before the caller re-points anything, and none of the
   * adoptions awaits between this call and its selection assignment, so no answer
   * can land in between. `applyRepair` is the one caller inside `select()` itself,
   * and it runs *after* that call's own two checks and before nothing — so this
   * bump cancels only lookups **other** than the one performing the repair.
   *
   * @param next - The projection just read from disk.
   */
  function installView(next: DocumentView): void {
    invalidateProjectionOf(next.id);
    const index = views.findIndex((view) => view.id === next.id);
    // The `-1` arm is not reachable from `select()` — a selection exists only
    // in a document that was projected — but appending is the right answer for
    // a document that was skipped at load and has now been read.
    views = index === -1 ? [...views, next] : views.map((view, at) => (at === index ? next : view));
    if (fileTextDocument === next.id) {
      forgetFileText();
    }
  } // End of function installView()

  /**
   * Puts one sidebar row in place, by identity — Phase 2d-5-4.
   *
   * The `Added` arm's whole effect (ruling 30). **Nothing goes into `views`**: an
   * addition's identity is by definition not an address the open workspace
   * resolves, so `getDocument` would refuse it and the projection the observation
   * carries is deliberately dropped. The row is therefore drawn as *not read yet*,
   * which is what `loaded: false` means everywhere else in this state and is true
   * of it.
   *
   * **The replace arm is for a second addition of one path, and nothing else.**
   * A summary already in `documents` whose projection this window holds cannot
   * reach here under the wire's own contract; if one ever did, the row would say
   * *not read yet* beside a projection that exists, and this function would not
   * notice. `docs/decisions/2d-5-4-notes.md` records that as a residual.
   *
   * **The identity is recorded as pending in the same statement that draws it**,
   * and that is ruling 28's other half. The row is a thing to *look* at; it is not
   * a thing to *address*, and `documents` is read by `rawTarget` as well as by the
   * sidebar. Recording it here rather than inferring it later is what stops a
   * selection of that row sending `document_text` for an identity the open
   * workspace refuses — `pendingAdditions`' own comment says why the list is
   * explicit. Nothing in TypeScript makes the two assignments one: a future arm
   * that wrote `documents` without writing this list would reopen the route, and
   * only `workspace.test.ts`'s negative command-spy case would notice.
   *
   * @param summary - The row, with `loaded` already forced false by the caller.
   */
  function addDocument(summary: DocumentSummary): void {
    // **The observation's row is copied before it is retained**, which is the
    // second half of Phase 2d-5-4-B's ingress rule: `documents` is read inside the
    // coordinator's guard — `creatorEligibility` and `holdsDocument` both walk it —
    // so nothing it holds may be an object something outside this module built.
    //
    // **This copy is for `documents`' readers and it does not fence the write
    // below** — Phase 2d-5-4-C's M5, which is the thing the sentence here used to
    // blur. The check that entitles this row to be inserted is
    // `sequences.admit(...)` in `applyChange`'s neighbour `applyAddition`, one
    // module away; the assignment below is the spend. What keeps them atomic is
    // that **`applyAddition` materializes the wire summary before it arbitrates**,
    // so `summary` is already a plain own-property object by the time this runs and
    // the seven reads here fire no accessor. That is a fact about the one caller
    // and it is stated in that caller too; nothing in this function's type says the
    // next caller has to do the same, and a caller handing a live wire value
    // straight through would reopen the window without failing to compile.
    const row = ownedSummaryOf(summary);
    const index = documents.findIndex((held) => held.id === row.id);
    documents =
      index === -1
        ? [...documents, row]
        : documents.map((held, at) => (at === index ? row : held));
    if (!pendingAdditions.includes(row.id)) {
      pendingAdditions = [...pendingAdditions, row.id];
    }
  } // End of function addDocument()

  /**
   * Drops one file and everything this window derived from it — Phase 2d-5-4.
   *
   * **The synchronous removal transition ruling 31 asks for, and it is not
   * `repairAfter`**: that repairs the selection against a supplied `DocumentView`,
   * and a removed file has none to supply. So the projection is invalidated and
   * dropped, the row goes, the load failure goes, and a selection inside the file
   * is cleared with the external-gone notice — all before any `await`, because a
   * getter read between two of those would describe a file that is half gone.
   *
   * **`gone` is reused rather than a new notice added**, and what it says is
   * weaker than what happened rather than stronger: *espansoConfig can no longer
   * point at the snippet that was selected… nothing here searched this file for
   * it*. Both clauses are true of a removed file, and a sentence claiming the file
   * was deleted would be this window asserting something about a path from an
   * observation that says the watcher stopped seeing it.
   *
   * **The sidebar filter is reset when it names this file.** The row it filters by
   * is gone from the list, so nothing on screen could take the person back out of
   * an empty scope; leaving it there is a filter that cannot be changed by
   * clicking anything.
   *
   * **Any write surface over the file is left exactly as it is** (Q8): its
   * registration stands, nothing is reloaded under it, and the file's
   * {@link ExternalDocumentStatus} says `removed`. Nothing here *tells* the
   * surface — `WriteSurfaceTransition` takes the narrowed `Changed`/`Projected`
   * snapshot, so a removal cannot be delivered through it at all, and widening
   * that protocol is 2d-5-5's.
   *
   * @param document - The file that is gone.
   */
  function removeDocumentFromWindow(document: DocumentId): void {
    // First, because everything below reads or drops something minted from it.
    invalidateProjectionOf(document);
    views = views.filter((view) => view.id !== document);
    documents = documents.filter((held) => held.id !== document);
    // The row is gone, so its pending mark goes with it. Left behind it would be a
    // statement about a row nothing draws, and an addition of the same path
    // afterwards re-records it anyway.
    pendingAdditions = pendingAdditions.filter((held) => held !== document);
    loadFailures = loadFailures.filter((held) => held.document !== document);
    if (selected !== null && selected.document === document) {
      // Through `replaceSelection`, so the intent generation moves in the same
      // synchronous block as the write — this state's standing invariant, which
      // nothing in TypeScript enforces.
      replaceSelection(null);
      notice = 'gone';
    }
    if (selection.kind === 'document' && selection.id === document) {
      selection = ALL_DOCUMENTS;
    }
    if (fileTextDocument === document) {
      forgetFileText();
    }
  } // End of function removeDocumentFromWindow()

  /**
   * Records what this window can say about a file it did not reload.
   *
   * At most one entry per file: the previous one is dropped whether or not a new
   * one replaces it, so `null` is how a clean reread says *there is nothing to
   * report about this file any more*.
   *
   * @param document - The file.
   * @param status - The code, or `null` to clear it.
   */
  function noteDocumentStatus(
    document: DocumentId,
    status: ExternalDocumentStatus | null
  ): void {
    statusWrites.set(document, (statusWrites.get(document) ?? 0) + 1);
    const rest = externalStatuses.filter((entry) => entry.document !== document);
    externalStatuses = status === null ? rest : [...rest, { document, status }];
  } // End of function noteDocumentStatus()

  /**
   * How many times this file's status has been written.
   *
   * Captured by an arm before it awaits, and compared afterwards: an unchanged
   * count means **the entry this arm wrote is still the one there**, so it still
   * owns what the file's status says. A changed one means somebody else's
   * transition has spoken since, and this arm's answer is the older statement.
   *
   * @param document - The file.
   * @returns The count, `0` for a file whose status has never been written.
   */
  function statusWriteOf(document: DocumentId): number {
    return statusWrites.get(document) ?? 0;
  } // End of function statusWriteOf()

  /**
   * Records what was observed of a path this window holds no identity for.
   *
   * **Keyed by the path and deduplicated by it**, latest wins. That is the whole
   * bound on how much this can grow, and it is a bound on *paths* rather than on
   * observations: a watcher flapping on one file records one entry, and a thousand
   * unnamed paths record a thousand.
   *
   * @param drift - The path and what was observed of it.
   */
  function notePathDrift(drift: ExternalPathDrift): void {
    const rest = pathDrift.filter((held) => held.relativePath !== drift.relativePath);
    pathDrift = [...rest, drift];
  } // End of function notePathDrift()

  /**
   * Reads one file again and installs it only while both guards hold.
   *
   * **The private guarded helper the consult's Q5 permits**
   * (`docs/reviews/phase-2d-5-design.md:147-163`), and `BrowserState.rereadDocument`
   * is now one call of it with a guard that always holds. Assigning an
   * observation's own `disk` projection instead is what the consult forbids: the
   * batch's projection is snapshot-exact and installing it directly would bypass
   * `installView`'s invalidation and the selection discipline. The extra disk read
   * is the accepted cost.
   *
   * **Three captures of its own, taken before the await**, exactly as this
   * function has taken them since Phase 2c-3b step 2: the workspace generation,
   * because a replaced workspace is a fresh projection of every file it holds, so
   * an answer read in the closed one describes bytes this window is no longer
   * showing; a
   * per-document re-read generation, so that of two overlapping reads of one file
   * the newer wins whichever order the answers arrive in; and that document's
   * projection generation, so a projection installed meanwhile by any other path is
   * not overwritten. **Neither per-document counter can stand in for the workspace
   * one, and they fail for opposite reasons** — `open()` clears
   * `projectionGenerations`, so a file whose projection was never replaced compares
   * equal across two workspaces, while `rereadGenerations` is deliberately
   * monotonic and survives an `open()` untouched.
   *
   * **The caller's guard is asked between two readings of those same three, and
   * that is not belt and braces.** A guard is caller-supplied code: the
   * coordinator's asks the registry, computes an eligibility and — on the arm where
   * a surface opened during the read — calls that surface's transition, which is a
   * component's callback. `CLAUDE.md` names a check and a spend separated by any
   * such read as this project's repeated defect class, so the three captures are
   * compared again **after** the guard has run and immediately before the
   * installation. The pre-guard reading is what stops a guard being consulted about
   * a read that is already stale, which would let it clear a status or fire a
   * transition for an answer nobody is going to install.
   *
   * **The answer is normalized before either of those two readings, and that is
   * what makes the second one worth taking.** `commands` is injected, so
   * `fresh.value` is a property read on caller-controlled data: a getter or a proxy
   * trap behind it runs arbitrary code, and `readonly` does not freeze anything at
   * runtime. Read after the final comparison — which is where it was until Phase
   * 2d-5-4's first review — such a getter could move the very generations that
   * comparison had just approved, and the stale answer would be installed anyway.
   * So the command's answer goes through {@link ownedProjectionOf} **before** the
   * pre-guard reading, and the local is what is installed.
   *
   * **Exactly what bounds the two things that run after the final check, corrected
   * at that step's second review.** Both `installView` and `repairAfter` run after
   * the last `stillCurrent()`, and both read more than the sentence here used to
   * admit: `installView` reads `next.id` *and* the `id` of every element already in
   * `views`, and `repairAfter` indexes `next.matches` and reads a candidate's
   * `source_text` and `id`. What makes every one of those a data read is
   * {@link ownedProjectionOf} at **every** ingress — this call's, `open()`'s, the
   * adoptions' — so nothing `views` holds and nothing `next` holds one level down is
   * an object a command built.
   *
   * **It is not `replaceSelection` that bounds the repair, and saying so was
   * false.** `replaceSelection` bumps the intent counter in the same synchronous
   * block as the write, which cancels lookups taken *earlier* and asynchronously; it
   * checks nothing, refuses nothing, and `repairAfter` consults it about nothing. A
   * synchronous re-entry from a caller's accessor was bounded by nothing at all,
   * which is why the normalization is at ingress rather than here. **No type
   * expresses any of it**, and the guarantee stops exactly where
   * {@link ownedProjectionOf} says it does: two levels deep plus each match's
   * `id`, with everything below that still the command's own object.
   *
   * **A fourth capture, and it fences the clear alone.** The three above are about
   * *the projection*: they answer whether this read's answer is still the one the
   * window wants to install. The file's **status** is a separate thing that a
   * separate transition can own, and none of the three moves when it changes — an
   * `Unreadable` observation admitted while this read is in flight writes
   * `unavailable` with a typed reason and touches no generation, so before this
   * round the held answer landed, installed, and **cleared a mark it did not set**,
   * permanently: the batch watermark has moved past the observation that carried
   * the reason, so nothing re-derives it. {@link statusWriteOf} is captured beside
   * the other three and compared at the clear.
   *
   * **Why the install is not fenced by it and the clear is.** They claim different
   * things. The install claims *these are the bytes this file held when the read
   * was answered*, which a status written meanwhile does not contradict; the clear
   * claims *there is nothing to report about this file*, which is precisely what
   * such a status contradicts. Refusing the clear leaves the window showing the
   * older content under a mark that correctly says the file could not be read,
   * which is never worse than the state today — and refusing the install as well
   * would strand a file on an older projection because something wrote its status,
   * which is a different and larger claim than this capture can support.
   *
   * @param document - The file to read again.
   * @param guard - Asked immediately before the installation; `false` installs
   *   nothing and answers `null`.
   * @returns The failure of the read, or `null` when it did not fail.
   */
  async function rereadUnderGuard(
    document: DocumentId,
    guard: () => boolean
  ): Promise<IpcFailure | null> {
    const opened = openGeneration;
    const reread = nextRereadOf(document);
    const projection = projectionGenerationOf(document);
    // **The status capture, taken with the other three and compared only at the
    // clear.** On the coordinator's path the host member has already written its
    // own `stale` before calling this function — or deliberately written nothing,
    // when the ownership question it was handed said a newer observation already
    // speaks for this file — so this number counts that arm's own write where
    // there was one and a successful installation still clears it. What it catches
    // is a *third party*: a newer observation's transition speaking about this
    // file while the read was out. **It is the only reader of this token now.**
    // The member's failure arm captured it too, and Phase 2d-5-4-C deleted that
    // arm, because the write it fenced could never change a value and could always
    // take ownership away from an overlapping read holding this very capture.
    const statusAt = statusWriteOf(document);
    /**
     * Whether this read is still the one whose answer the window wants.
     *
     * @returns `true` while all three captures still hold.
     */
    const stillCurrent = (): boolean =>
      opened === openGeneration &&
      reread === rereadGenerations.get(document) &&
      projection === projectionGenerationOf(document);
    const fresh = await commands.reloadDocument(document);
    if (!fresh.ok) {
      // Answered and reported whether or not this read is still the wanted one: a
      // failed read installs nothing, so there is no state to protect here, and
      // the failure is a true statement about the attempt the caller made.
      report(fresh.failure);
      return fresh.failure;
    }
    // **Read once, here, and never again.** Every later use is of this local:
    // `ownedProjectionOf` copies the answer field by field, and each of its matches
    // field by field, so whatever a getter behind `value` — or behind any field of
    // the view, or of a match — does, it does *now*, before both comparisons below,
    // and the two of them are what catch it.
    const next: DocumentView = ownedProjectionOf(fresh.value);
    if (!stillCurrent()) {
      // Nothing is installed and nothing is forgotten. The caller is answered
      // `null` because this read did not fail — what happened is that the window
      // moved on, and it moved on by reading this file again or by dropping the
      // workspace whole, so nobody is left holding the parse this answer would
      // have replaced.
      return null;
    }
    if (!guard()) {
      return null;
    }
    if (!stillCurrent()) {
      return null;
    }
    // The viewer's snapshot goes with the projection, for `installView`'s own
    // reason one level down: a snapshot taken against the parse being replaced
    // draws bytes from one revision beside a snippet list drawn from another.
    forgetFileText();
    installView(next);
    // **The clear lives with the install** — Phase 2d-5-4's second review, and it
    // used to live in the coordinator's guard. There it reached one caller of the
    // two this helper then had: `BrowserState.rereadDocument` passes
    // `ALWAYS_PERMITTED`, so a person using the recovery control on a file a failed
    // guarded reread had marked `stale` read it successfully from disk and the
    // mark stayed for the rest of the session. **Since Phase 2d-6-1c there are
    // three callers**: `requestFileReread` passes a guard that re-asks disposal,
    // the open gate, addressability, the lost-history block, the write barrier and
    // the per-file hold immediately before this installation, and its refusal
    // returns above like every other — clearing nothing, installing nothing.
    //
    // **What it claims is narrow, and both halves are load-bearing.** It claims
    // *this file's content is current as of this read* — the projection now on
    // screen came from the bytes `reload_document` just answered with. It does
    // **not** claim that a session blocked by lost history has reconciled its
    // *membership*: that is not a per-document fact, no per-document code could
    // carry it, and 2d-6 is what draws it. The coordinator's guard refusing on
    // `stillApplying` is what keeps a blocked session's own rereads from reaching
    // this line at all; an explicit reread reaches it and says only the narrow
    // thing.
    //
    // **No arm of this helper that refuses clears anything**, and moving the clear
    // here is what makes that structural rather than argued: there is one clear in
    // this helper, it is after the installation, and a refusal returns before it.
    // Both properties survive the fence below — the clear is still inside the
    // installation block, and the condition can only ever *suppress* it, never
    // move it to an arm that refused. **One clear outside this helper does follow a
    // refusal** (Phase 2d-7-1): the coordinator-facing host member's
    // `clearAnUnbackedMark`, after this helper has returned, only under an
    // uncertainty hold and only for the mark that member itself wrote.
    //
    // **And it is fenced on the status rather than on the projection**, which the
    // header states at length: an `Unreadable` admitted while this read was out
    // moves none of the three captures above, so without this comparison the held
    // answer cleared a mark somebody else had set and nothing could ever restore
    // it. The install above is deliberately left unfenced; the header says why the
    // two claims differ.
    if (statusAt === statusWriteOf(document)) {
      noteDocumentStatus(document, null);
    }
    repairAfter(next);
    await readFileText();
    return null;
  } // End of function rereadUnderGuard()

  /**
   * The file the raw viewer would show right now.
   *
   * A function rather than a copy of the same call at every use: the getter, the
   * read and every entry point that can move the target — a sidebar click, a
   * snippet click, a cleared selection and a repair that clears one — all need
   * the same answer, and the decision itself is `rawTarget`'s in
   * `./rawDocument.ts`.
   *
   * **Pending-added rows are not candidates** — Phase 2d-5-4, ruling 28. The list
   * handed to `rawTarget` is the addressable one, so a row an `Added` observation
   * invented answers `null` here however it was selected, and `document_text` is
   * never sent for an identity the open workspace refuses. Filtering the
   * *candidates* rather than the answer is deliberate: `rawTarget` falls back from
   * the sidebar to the selected snippet's file, and a filter applied to its answer
   * would suppress that fallback instead of letting it run over the files that
   * remain.
   *
   * @returns The file, or `null` when nothing names one.
   */
  function fileTextTarget(): DocumentSummary | null {
    const addressable =
      pendingAdditions.length === 0
        ? documents
        : documents.filter((held) => !pendingAdditions.includes(held.id));
    return rawTarget(selection, addressable, selected);
  } // End of function fileTextTarget()

  /**
   * Drops the held file text, and any read still in flight for it.
   *
   * **One helper rather than three lines repeated at four call sites**, which is
   * the 1c-2b-2b-2 review's sixth finding: the snapshot has to be forgotten
   * wherever the viewer's target goes away, and a call site that forgets to
   * forget leaves a stale snapshot behind that the next read of that same file
   * would be served from its identity. Bumping the generation is part of it —
   * an answer already in flight for the file that was the target must not land
   * and re-install itself as the snapshot after the target has gone.
   */
  function forgetFileText(): void {
    fileTextGeneration += 1;
    fileTextAnswer = null;
    fileTextDocument = null;
    // The captured revision belongs to the answer, not to the file, so it goes
    // with it: a revision left behind would be one half of a pair whose other
    // half no longer exists.
    fileTextRevision = null;
  } // End of function forgetFileText()

  /**
   * Reads the target file's text, if the viewer is showing a different file.
   *
   * Called from the toggle and from every place the target can move — a sidebar
   * click, a snippet click, a cleared selection and a repair that clears one.
   * **The identity comparison is the whole policy**, and it decides two things
   * at once: a walk through the snippets of one file does not re-read that file
   * once per click, and *closing* the viewer, which sets the held identity to
   * `null`, guarantees that re-opening it re-reads. There is no `force` flag,
   * and there was one until experiment E showed it could not change any outcome
   * (`docs/decisions/1c-2b-2b-2-notes.md`).
   *
   * **The no-target case is handled here rather than at each caller**, so that
   * every path which can remove the target is covered by calling this one
   * function. That is what closes the review's sixth finding.
   */
  async function readFileText(): Promise<void> {
    const target = fileTextTarget();
    if (target === null) {
      // Nothing names a file any more — clearing a selection in the "All" scope
      // is how a reader reaches this. The held snapshot is about a file the
      // viewer is no longer pointed at, so it is dropped: keeping it would let
      // a later selection of that same file match on identity, skip the read
      // and redraw bytes taken at some earlier moment, which contradicts the
      // policy above that every re-opening re-reads.
      forgetFileText();
      return;
    }
    if (!fileTextShown) {
      return;
    }
    if (target.id === fileTextDocument) {
      return;
    }
    const generation = ++fileTextGeneration;
    fileTextDocument = target.id;
    fileTextAnswer = null;
    // **Captured here, before the read, and never re-read afterwards.** This is
    // the revision the text will be paired with, and taking it first is what
    // bounds the error: a file that moves between the two reads makes the pair's
    // revision the *older* one, which the save gate refuses as a conflict.
    // Reading it after the text would make it the newer one, and a single
    // external write would then be committed over.
    const captured = viewOf(target.id)?.revision ?? null;
    const answer = await commands.documentText(target.id);
    if (generation !== fileTextGeneration) {
      // A later toggle, click or workspace load has moved the viewer on. This
      // answer is about a file the reader is no longer looking at.
      return;
    }
    fileTextAnswer = answer;
    fileTextRevision = captured;
    if (!answer.ok) {
      // The user sees the typed refusal in the pane; the developer sees it in
      // the console, on the one channel every other failure of this state uses.
      report(answer.failure);
    }
  } // End of function readFileText()

  /**
   * Applies what {@link repairSelection} decided.
   *
   * The document goes in **before** the selection, so that no getter can be
   * read between a fresh identity and the stale projection it names.
   *
   * @param repair - The decision.
   */
  function applyRepair(repair: SelectionRepair): void {
    switch (repair.kind) {
      case 'kept':
        installView(repair.reloaded);
        replaceSelection(repair.selected);
        notice = 'kept';
        return;
      case 'cleared':
        if (repair.reloaded !== null) {
          // A snippet that was deleted must stop being in the list, not only
          // stop being selected.
          installView(repair.reloaded);
        }
        replaceSelection(null);
        notice = repair.reason;
        return;
      case 'unresolved':
        replaceSelection(null);
        notice = 'unresolved';
        report(repair.failure);
        return;
      case 'unchanged':
        return;
    }
  } // End of function applyRepair()

  /**
   * Saves one snippet in place through one command, and adopts what a commit
   * produced — the body {@link BrowserState.saveMatch} and, since Phase 3-8-1,
   * {@link BrowserState.saveMatchItemText} share.
   *
   * **One body, so the two writers cannot drift**: both edit one snippet whose
   * identity `saved.moved` answers in the new revision, and every rule here — the
   * `notAttempted` refusal without a projection, ruling 27's barrier, the re-read
   * after a failure that may have written, `adoptAfterTheCommit`'s "a commit is
   * never reported as an error", and the conflict that installs nothing — is one
   * rule for both. What differs is the command and its arguments, which the
   * caller's `send` closes over; what no type forces is that `send` calls a
   * command about `id` at all.
   *
   * @param id - The snippet the save is about, by identity.
   * @param send - Issues the command, with the caller's arguments unchanged.
   * @returns How the save ended together with the adoption's own fate; a refusal
   *   made before any command ran; or a command failure.
   */
  async function saveOneSnippetInPlace(
    id: MatchId,
    send: () => Promise<CommandResult<SaveResult>>
  ): Promise<MatchSaveAnswer> {
    const view = views.find((held) => held.id === id.document);
    if (view === undefined) {
      // Nothing on this state describes that document, so there is no base
      // revision to send. The same refusal a move makes, for the same reason: a
      // base that is not the parse the caller was drafting against turns an edit
      // into an edit of whatever now occupies those spans. Nothing was sent, so
      // nothing can have been written — and there is no rejection to hand on,
      // because no command ran. Its own arm, so the type says both rather than
      // a comment claiming it.
      return { kind: 'notAttempted' };
    }
    // **Ruling 27's barrier opens here and closes in the `finally` below.**
    // While it is open, a watcher observation of this file is held rather than
    // applied, because what is on disk cannot be attributed to a writer until
    // this promise settles. See `beginWrite`.
    const write = beginWrite(id.document);
    try {
      // **The caller's command, carrying the caller's base revision unchanged**,
      // and never `view.revision`: see `BrowserState.saveMatch`'s JSDoc. Reading
      // the projection here rebases a draft the window has moved on from, and
      // turns the conflict that should stop it into a commit. The `view` lookup
      // above stays, because without a projection this state can neither adopt
      // what a commit produces nor tell whether its own projection went out of
      // date.
      const answer = await send();
      if (!answer.ok) {
        // A save that failed is not a workspace that failed, so the window keeps
        // showing the configuration it was showing — but `mayHaveWritten` is the
        // only thing that says whether it is still showing this *file* correctly. A
        // failure at or after the rename means the file may already hold the edited
        // snippet, and a window that went on drawing the pre-save projection and the
        // pre-save text would be describing bytes that are no longer there.
        //
        // **The answer carries it**, which is the 2c-2 review's first finding: a
        // bare `null` here is indistinguishable from `noWorkspaceOpen`, and a screen
        // that renders both as *nothing was written* states the opposite of what the
        // disk may hold.
        const written = mayHaveWritten(answer.failure);
        // **What this failure establishes, recorded before anything is done about
        // it**: `uncertain` when the write may have written, nothing-written
        // otherwise. It is the `finally` below that releases the barrier, so a
        // reporter or a re-read that throws still closes it on this settlement.
        write.expect(settlementOfFailure(written));
        report(answer.failure);
        if (written) {
          forgetFileText();
          await adoptTheDocumentOnDisk(id.document, null, null);
          await readFileText();
        }
        return { kind: 'failed', mayHaveWritten: written, failure: answer.failure };
      }

      // **What the transaction established, recorded before the adoption below**,
      // and released by the `finally` after it (ruling 27): a commit completes its
      // own projection invalidation first, so an observation released then is
      // arbitrated against the window the commit left rather than the one it found.
      // Recording it here rather than beside that release is what keeps an
      // exception in between from settling a known outcome as `uncertain`.
      write.expect(settlementOfOutcome(answer.value));

      let adoption: InvalidationStatus = { kind: 'notOwed' };
      if (answer.value.outcome === 'saved') {
        // **A `Saved` does not mean the bytes changed.** `committed: false` is a
        // documented success — a draft whose every field already held the value it
        // asked for derives no edit — so what makes this screen out of date is one
        // of two facts: the file was rewritten, or the revision the transaction
        // ended on is not the one this state was projecting, which is a file some
        // other program changed under the lock's two reads.
        const outOfDate = answer.value.committed || answer.value.revision !== view.revision;
        if (outOfDate) {
          forgetFileText();
          // **Nothing thrown after the commit may turn it into an error** — Phase
          // 2d-6-6c-2, the shape 2d-6-6c-1's review fixed in `createMatch`, and
          // since Phase 2d-6-7a the one policy `adoptAfterTheCommit` holds for
          // every match-level wrapper: an exception out of the adoption or the
          // re-read, and one out of classifying it, travels back as the
          // adoption's failure beside the `saved` outcome (`PROGRESS.md` D2).
          //
          // **The adoption the consult's Q6 asks for**, performed here so that a
          // caller cannot obtain this result without it. `moved` is the snippet's
          // identity in the new revision, and the selection follows it — but only
          // when the selection is still the snippet that was saved, which is the
          // review's fourth finding: a person who clicked another snippet while
          // the save was in flight must not be dragged back to this one.
          // Every read of the result that feeds the adoption runs inside the thunk, so
          // the helper's catch covers a getter that throws (Phase 2d-6-7a's review).
          const result = answer.value;
          adoption = await adoptAfterTheCommit(id.document, () =>
            adoptTheDocumentOnDisk(id.document, id, result.moved)
          );
        }
      } else if (answer.value.outcome === 'conflict') {
        // **A conflict installs nothing here** — `BrowserState.moveMatch`'s own note
        // says why, and the rule is one rule for all seven writing wrappers. What is
        // written down is which projection the conflict describes.
        rememberTheSaveConflict(id.document, saveConflictSource(answer.value));
      }
      return { kind: 'answered', result: answer.value, adoption };
    } finally {
      // **Ruling 27's barrier closes here, on every exit this wrapper has** —
      // including an exception: `close` releases it on whatever the answer above
      // established, or on `uncertain` when nothing did. See `beginWrite`.
      write.close();
    }
  } // End of function saveOneSnippetInPlace()

  // **Named rather than returned anonymously, since 2c-5-4a.** `restoreDocument`
  // has to hand `sendRestore` the sixth writer itself — restore is a content path
  // on `saveRawDocument` and not a command of its own — and a name is what lets one
  // method of this object call another instead of the alternative, which is a
  // second copy of the seal, the conflict registration and the invalidation. None
  // of these methods reads `this`, so the reference is a plain closure lookup.
  const state: BrowserState = {
    get status(): BrowserStatus {
      return status;
    },
    get failure(): IpcFailure | null {
      return failure;
    },
    get loadFailures(): readonly LoadFailure[] {
      return loadFailures;
    },
    get summary(): WorkspaceSummary | null {
      return summary;
    },
    get documents(): readonly DocumentSummary[] {
      return documents;
    },
    get views(): readonly DocumentView[] {
      return views;
    },
    get sidebar(): SidebarModel {
      const counts = new Map<DocumentId, number>();
      for (const view of views) {
        // A profile is projected now, and still has no *snippet* count: a `0`
        // beside `config/default.yml` would say the file was read and holds no
        // snippets, which invites the reader to expect that it could. The row
        // keeps its `–`, which is what 1c-1 chose and what the 1c-2b-1 window
        // reading confirms is still on screen.
        if (holdsMatches(view)) {
          counts.set(view.id, view.matches.length);
        }
      } // End of the loop over the projected documents
      const unreadable = new Set<DocumentId>(loadFailures.map((entry) => entry.document));
      return buildSidebar(documents, counts, unreadable);
    },
    get selection(): SidebarSelection {
      return selection;
    },
    get query(): string {
      return query;
    },
    get scopedDocument(): DocumentView | null {
      return selection.kind === 'document' ? (viewOf(selection.id) ?? null) : null;
    },
    get scopedMatches(): readonly MatchView[] {
      return scopedMatches();
    },
    get visibleMatches(): readonly MatchView[] {
      return filterMatches(scopedMatches(), query);
    },
    get selected(): SelectedMatch | null {
      return selected;
    },
    get selectedMatch(): MatchView | null {
      const held = selected;
      if (held === null) {
        return null;
      }
      return viewOf(held.document)?.matches[held.position] ?? null;
    },
    get selectedDocument(): DocumentSummary | null {
      const held = selected;
      if (held === null) {
        return null;
      }
      return documents.find((document) => document.id === held.document) ?? null;
    },
    get notice(): SelectionNotice | null {
      return notice;
    },
    get fileTextTarget(): DocumentSummary | null {
      return fileTextTarget();
    },
    get fileTextRevision(): ContentRevision | null {
      // Guarded exactly as `fileText` is, and for the same reason: a revision
      // that outlived the answer it was captured with is half a pair.
      if (!fileTextShown) {
        return null;
      }
      const target = fileTextTarget();
      return target !== null && target.id === fileTextDocument ? fileTextRevision : null;
    },
    get fileTextShown(): boolean {
      return fileTextShown;
    },
    get fileText(): RawDocumentText | null {
      if (!fileTextShown) {
        return null;
      }
      const target = fileTextTarget();
      if (target === null) {
        return null;
      }
      // The identity guard, and what it is worth is stated rather than
      // implied. **No call site today can produce the mismatch**: every path
      // that moves the target calls `readFileText`, which sets the new identity
      // and nulls the answer *synchronously*, before any getter can run.
      // Removing this line therefore fails nothing — experiment C in
      // `docs/decisions/1c-2b-2b-2-notes.md`, recorded as one that did not fire.
      // It is kept because the failure it forecloses is the worst this pane
      // could have, one file's bytes drawn under another file's name, and
      // because the invariant it depends on lives in a different function.
      return documentTextState(target.id === fileTextDocument ? fileTextAnswer : null);
    },

    adoptDiskVersion<T>(
      conflict: ConflictModel<T>,
      confirmation: ReloadConfirmation
    ): DiskAdoptionOutcome {
      // **Authorized and spent in one call**, which is what the first review's
      // second finding asked for: nothing that authorizes an install exists outside
      // these few lines, so no surface can retain, replay or forward one.
      const adoption = authorizeDiskAdoption(conflict, confirmation);
      if (adoption === null) {
        // The confirmation was issued for another conflict.
        return 'refused';
      }
      // **Every caller-controlled read this method makes, taken here.** `source` and
      // `disk.id` are properties of values a surface assembled, so either can be a
      // getter or a proxy trap that re-enters this method synchronously. Reading them
      // *before* the reservation below means the whole decision that follows runs on
      // this state's own data — a `WeakMap` keyed by object identity, a plain record
      // this state wrote, and two counters — so nothing between the test and the spend
      // can run user code, and nothing after the spend can either until the install
      // itself, by which time the confirmation is gone.
      const source = conflict.source;
      // **And the snapshot itself, in this same block.** `adoption.disk` is a
      // `DocumentView` a surface assembled, so it is caller-controlled exactly as
      // `source` is; copying it here means the reads it costs happen before the
      // reservation below rather than after the checks it authorises.
      const disk = ownedProjectionOf(adoption.disk);
      const diskDocument = disk.id;
      if (spentConfirmations.has(confirmation)) {
        // **One-shot.** A confirmation is a person's answer to one question, and
        // spending it twice would install a projection a second time — bumping the
        // projection generation and repairing the selection again — on the strength
        // of one click.
        return 'refused';
      }
      // **Reserved in the same breath as the test, which is the confirmation review's
      // third High.** A `has` here and an `add` twenty lines down is a check and a
      // spend with caller-controlled reads between them, and the later revision and
      // generation checks do not close it: those counters are per document, so a
      // conflict alternating between two remembered files passes both calls. Nothing
      // stands between these two statements, and `WeakSet.has` and `WeakSet.add` on an
      // object key run no user code.
      spentConfirmations.add(confirmation);
      /**
       * Hands the reservation back, for a refusal that installs nothing.
       *
       * **Only this call's own reservation can be released.** The arm that finds the
       * confirmation already reserved returns *above* without reserving, so no path
       * here gives back a reservation another call made — which is what keeps this
       * from being the release half of the very defect the reservation closes. A
       * refusal therefore still spends nothing and the person may press again, which
       * is the behaviour every surface's *Reload disk version* control has always had.
       *
       * @returns `refused`, so each refusal arm stays one statement.
       */
      const releaseReservation = (): DiskAdoptionOutcome => {
        spentConfirmations.delete(confirmation);
        return 'refused';
      }; // End of function releaseReservation()
      const origin = conflictOrigins.get(source);
      if (origin === undefined || origin.document !== diskDocument) {
        // **A conflict this state never produced.** Its `DocumentId` is another
        // session's number, or the payload has been re-pointed at a different file
        // since; either way this window has no business installing it.
        return releaseReservation();
      }
      if (standingConflicts.get(origin.document) !== source) {
        // **Superseded, which is ruling 26's "any pending reload confirmation
        // withdrawn"** — Phase 2d-5-5b. A strictly later observation replaced this
        // conflict's disk side, so the snapshot it carries is a reading the file has
        // moved on from and installing it would move the window onto older bytes and
        // report success for it. That is the same failure the generation comparison
        // below refuses, in the one shape it cannot see: a supersession installs
        // nothing, so no projection generation moves.
        //
        // **Placed before the `alreadyThere` arm deliberately.** A window that
        // happens to hold exactly these bytes would be told *you are already
        // there* about a file a later reading says has changed again, which is a
        // true sentence that leaves a false impression; a refusal is the
        // conservative answer and the person may act on the conflict that stands.
        // `Map.get` on a `DocumentId` runs no user code, and `source` was read once
        // above, so nothing runs between this comparison and the two operands.
        return releaseReservation();
      }
      const held = viewOf(origin.document);
      if (held === undefined) {
        // The document is no longer projected here at all — a replaced workspace,
        // or a file dropped after a commit this window could not re-read.
        return releaseReservation();
      }
      if (held.revision === adoption.diskRevision) {
        // **Satisfied, not refused**, and the confirmation pass is why: the window
        // already holds exactly the bytes that were asked for, so there is nothing
        // to install and a surface may finish its transition. Installing anyway
        // would repair the selection for no change at all. The reservation stands,
        // because the question it answered has been answered.
        return 'alreadyThere';
      }
      if (origin.generation !== projectionGenerationOf(origin.document)) {
        // **The window moved after this conflict arrived**, so the disk snapshot it
        // carries may be *older* than the projection now installed — a re-read that
        // found a third revision, a commit adopted elsewhere. Content revisions are
        // hashes and carry no order, so this application cannot tell which of the
        // two is fresher; installing the older one would move the window backwards
        // and report success for it. The way forward is *Keep editing* and a fresh
        // attempt, which will meet the file as it now is.
        return releaseReservation();
      }
      // **Everything the six conflict arms used to do eagerly, done here once**,
      // synchronously and before anything can await, for
      // `forgetTheReplacedDocument`'s reason: an asynchronous invalidation has a
      // window in which a getter can still read what it is replacing.
      forgetFileText();
      installView(disk);
      // **The `stale` mark this conflict stands for is cleared with the install** —
      // Phase 2d-6-9b-1, the orchestrator's ruling on `stale`: the window now shows
      // the newest snapshot it holds of the file (the standing check above), so it
      // holds nothing newer. Cleared only while the file's status-write count is
      // still the one recorded when this conflict was registered: a status some
      // later observation wrote — an `unavailable`, or a `stale` about a reading
      // this snapshot is not — is that observation's, and stands. `WeakMap.get`
      // and the array walk run no user code.
      if (
        conflictStatusWrites.get(source) === statusWriteOf(origin.document) &&
        externalStatuses.find((entry) => entry.document === origin.document)?.status.kind ===
          'stale'
      ) {
        noteDocumentStatus(origin.document, null);
      }
      repairAfter(disk);
      // The viewer's re-read is a separate step, exactly as it is after every other
      // projection replacement, and it is fired rather than returned — the answer
      // this method owes is *what became of the request*, which is already settled.
      void readFileText();
      return 'installed';
    }, // End of function adoptDiskVersion()

    rememberExternalConflict(
      observation: ExternalConflictObservation
    ): ExternalChangeConflictSource {
      // **The caller-controlled read taken first, and once.** `observation` is a
      // value a caller assembled, so `document` can be a getter or a proxy trap
      // that re-enters this state; taking it before the memo means the whole
      // registration below runs on this state's own data.
      const document = observation.document;
      const source = externalConflictSource(observation);
      rememberTheConflict(document, source);
      return source;
    }, // End of function rememberExternalConflict()

    observeExternalChange(observation: ExternalConflictObservation): ObservationDelivery {
      // **The caller-controlled read taken first, and once**, the same idiom
      // `rememberExternalConflict` above and `adoptDiskVersion` use: `observation`
      // is a value a caller assembled, so `document` can be a getter that answers
      // one file to the barrier test and another to the arbitration.
      const document = observation.document;
      // **The window this observation arrives at, read here and carried from
      // here**, whichever of the two paths below it takes: a registration records
      // the generation a conflict arrived at, and for a retained observation that
      // is this one and not the one its release will run at (finding 1).
      const arrival = projectionGenerationOf(document);
      // The barrier, or the arbitration: one private body since Phase 2d-6-9b-3,
      // shared with the coordinator's refused automatic reread.
      return takeInObservation(document, observation, arrival);
    }, // End of function observeExternalChange()

    registerObservationReceiver(
      document: DocumentId,
      receiver: ObservationReceiver
    ): UnregisterObservationReceiver {
      // One object per call, so identity is per registration and the unregister
      // below removes exactly this one — see `ReceiverRegistration`.
      const registration: ReceiverRegistration = { receiver };
      const registered = observationReceivers.get(document);
      if (registered === undefined) {
        observationReceivers.set(document, new Set([registration]));
      } else {
        registered.add(registration);
      }
      /**
       * Removes this registration and no other; inert once it has run.
       */
      return (): void => {
        const held = observationReceivers.get(document);
        if (held === undefined) {
          return;
        }
        // **The consuming operation's answer is read, not thrown away**: a `delete`
        // that answers `false` here is the second call of a one-shot unregister,
        // and that is inert by design rather than a defect — but it is named, so
        // the empty-set cleanup below runs only for a registration that was there.
        if (held.delete(registration) && held.size === 0) {
          observationReceivers.delete(document);
        }
      }; // End of the unregister this registration answers
    }, // End of function registerObservationReceiver()

    retryRetainedObservation(document: DocumentId): RetainedRetryOutcome {
      // **Every operand off this state's own tables, and the record modified only
      // after both of its facts are taken.** `document` is a number, the table is a
      // `Map` keyed by it, and the record is this module's own literal, so nothing
      // between the first line and the deletion runs user code.
      const record = retainedObservations.get(document) ?? null;
      if (record === null) {
        return { kind: 'nothingRetained' };
      }
      if ((writesInFlight.get(document) ?? 0) > 0) {
        // **Unavailable during a write in flight** (entry 16). The record is left
        // exactly as it was: that write's settlement is the one path that can tell
        // whether the held reading was of the bytes the write ended on, and
        // arbitrating it now would answer a question the barrier exists to defer.
        return { kind: 'writeInFlight' };
      }
      const observation = record.observation;
      // **The original arrival generation, never today's** (entry 17).
      const arrival = record.generation;
      // **The one attempt is spent before the arbitration reads anything of the
      // caller's.** The arbitration walks the observation — a value somebody
      // assembled, whose getters can re-enter this state — so the record comes out
      // of the barrier first: a re-entrant press finds nothing held and answers
      // `nothingRetained`, and an arbitration that finds the tables moved retains
      // the observation again at this same arrival generation, which is the
      // *askable again* the record's entry 16 requires and not a second attempt.
      retainedObservations.delete(document);
      noticeHolds();
      let delivery: ObservationDelivery;
      try {
        delivery = arbitrateAndDeliver(document, observation, arrival);
      } catch (raw: unknown) {
        // **A throw here decided nothing that was written, so the record is owed
        // back** — this phase's review, finding 3. Every throw `arbitrateHere` can
        // make is a caller-controlled read — the observation's fields, the standing
        // origin's, and on its retained path the `sequence` comparison against a
        // reading held meanwhile — and none comes after a table was written;
        // delivery contains its own. Restored only into an empty slot, by `has` and
        // `set` on a `Map` keyed by a number with nothing between them: a
        // re-entrant arrival the throwing read retained meanwhile stays, whatever
        // its sequence, because re-applying the barrier's newest-wins rule would
        // need a `sequence` read of the caller's object inside a `catch` that must
        // not throw. What that does not cover, said plainly: a `sequence` getter
        // that throws inside that very comparison leaves the meanwhile-held reading
        // in the slot and this one lost — an observation that defeats its own
        // retention, which nothing in TypeScript prevents. The throw itself still
        // reaches the caller, and a completed arbitration never reaches this arm.
        if (!retainedObservations.has(document)) {
          retainedObservations.set(document, record);
          noticeHolds();
        }
        throw raw;
      }
      return { kind: 'attempted', delivery };
    }, // End of function retryRetainedObservation()

    uncertaintyAcknowledgementFor(source: ConflictSource): UncertaintyAcknowledgement | null {
      // **The caller's object is read by identity only.** `WeakMap.get` on an object
      // key and `===` run no user code; no property of `source` is read here.
      const origin = conflictOrigins.get(source);
      if (origin === undefined) {
        // Not an origin this state registered, or a hand-built wrapper.
        return null;
      }
      const document = origin.document;
      if (acknowledgementMintRefusal(document, source) !== null) {
        // Every refusal `acknowledgeWriteUncertainty` would give at once, asked
        // here so that nothing is minted for a press that could not succeed. The
        // spend asks them all again: this is a courtesy, not the guard. The same
        // function answers `uncertaintyAcknowledgementEligibility`, so the reader a
        // control is enabled from and this mint cannot disagree (Phase 2d-6-9a's
        // review, finding 2).
        return null;
      }
      const acknowledgement = Object.freeze({}) as UncertaintyAcknowledgement;
      acknowledgementBindings.set(
        acknowledgement,
        Object.freeze({
          openGeneration,
          document,
          uncertaintyGeneration: uncertaintyGenerations.get(document) ?? 0,
          source
        })
      );
      return acknowledgement;
    }, // End of function uncertaintyAcknowledgementFor()

    acknowledgeWriteUncertainty(
      acknowledgement: UncertaintyAcknowledgement
    ): UncertaintyAcknowledgementOutcome {
      // **One caller-controlled operand, read once by identity.** Everything below
      // it is this state's own — a frozen binding this module wrote, three `Map`s, a
      // `Set` and a counter — so no user code can run between the first question
      // and the spend at the end.
      const binding = acknowledgementBindings.get(acknowledgement);
      if (binding === undefined) {
        return { kind: 'refused', reason: 'unknown' };
      }
      if (spentAcknowledgements.has(acknowledgement)) {
        return { kind: 'refused', reason: 'spent' };
      }
      const document = binding.document;
      if (binding.openGeneration !== openGeneration) {
        return { kind: 'refused', reason: 'workspaceReplaced' };
      }
      if ((writesInFlight.get(document) ?? 0) > 0) {
        return { kind: 'refused', reason: 'writeInFlight' };
      }
      const source = binding.source;
      if (standingConflicts.get(document) !== source) {
        return { kind: 'refused', reason: 'superseded' };
      }
      const origin = conflictOrigins.get(source);
      if (origin === undefined || origin.generation !== projectionGenerationOf(document)) {
        // `origin` cannot be `undefined` for a source that stood at minting —
        // `conflictOrigins` is a `WeakMap` nothing deletes from — but the type says
        // it can, and the honest answer to a source with no arrival generation is
        // the same refusal as to one whose generation has moved.
        return { kind: 'refused', reason: 'projectionReplaced' };
      }
      if (
        !uncertainWrites.has(document) ||
        (uncertaintyGenerations.get(document) ?? 0) !== binding.uncertaintyGeneration
      ) {
        return { kind: 'refused', reason: 'holdMoved' };
      }
      // **Spent and ended in one breath.** Nothing stands between the last question
      // above and these two writes, and neither runs user code: `WeakSet.add` on an
      // object key and `Set.delete` on a number. The generation counter is left as
      // it is — a hold is counted when it is established, and this ends one rather
      // than making another.
      spentAcknowledgements.add(acknowledgement);
      uncertainWrites.delete(document);
      noticeHolds();
      return { kind: 'acknowledged' };
    }, // End of function acknowledgeWriteUncertainty()

    automaticReloadGuardFor(document: DocumentId): AutomaticReloadGuardInputs {
      // **Three reads of this state's own tables, in one synchronous block, then
      // frozen.** `surfaceOpen` is the registry's answer through the same predicate
      // the coordinator asks — `targetingSurfaceFor` over the live set with this
      // file's creator eligibility — so a destination-less creator over an eligible
      // file counts as a surface here exactly as it does there. The registry
      // itself, never the reactive mirror: this is a coordinator-side question.
      //
      // **No caller code runs in this block, and that is a fact about ingress, not
      // about this function** — the phase review's blocker (2d-6-1c). The
      // eligibility question walks `documents`, `views` and a view's
      // `top_level_keys[i].text`; the rows and the views were always this module's
      // copies, and the keys are since `ownedScalarOf`. Before that copy the key
      // read here was of the command's own object and ran *after* the registry
      // list above it had been taken, so a getter that registered a surface was
      // invisible to the answer it ran inside. A field this predicate starts
      // reading that ingress does not copy reopens exactly that, with nothing
      // failing but `workspace.test.ts`'s key-getter case.
      // **Both signals first** (Phase 2d-6-9a's review, finding 1), so a reactive
      // caller re-runs when a hold table or the registry moves; a coordinator-side
      // caller reads two numbers and nothing else changes for it.
      void holdRevision;
      void surfaceGeneration;
      const uncertaintyUnresolved = uncertainWrites.has(document);
      const observationRetained = retainedObservations.has(document);
      const surfaceOpen =
        targetingSurfaceFor(
          document,
          writeSurfaces.openWriteSurfaces(),
          creatorEligibilityFor(document)
        ) !== null;
      return Object.freeze({ uncertaintyUnresolved, observationRetained, surfaceOpen });
    }, // End of function automaticReloadGuardFor()

    standingConflictFor(document: DocumentId): ConflictSource | null {
      void holdRevision;
      return standingConflictFor(document);
    },

    writeInFlight(document: DocumentId): boolean {
      void holdRevision;
      return (writesInFlight.get(document) ?? 0) > 0;
    },

    retainedObservationFor(document: DocumentId): ExternalConflictObservation | null {
      void holdRevision;
      // The generation the barrier keeps beside it is this module's bookkeeping and
      // no reader's business: what a caller can ask is *which reading is held*.
      return retainedObservations.get(document)?.observation ?? null;
    },

    writeOutcomeUncertain(document: DocumentId): boolean {
      void holdRevision;
      return uncertainWrites.has(document);
    },

    heldDocuments(): readonly DocumentId[] {
      void holdRevision;
      const held = new Set<DocumentId>(retainedObservations.keys());
      for (const document of uncertainWrites) {
        held.add(document);
      }
      return Object.freeze([...held]);
    },

    uncertaintyAcknowledgementEligibility(document: DocumentId): UncertaintyAcknowledgementEligibility {
      void holdRevision;
      const source = standingConflicts.get(document) ?? null;
      const refusal = acknowledgementMintRefusal(document, source);
      return refusal === null
        ? Object.freeze({ kind: 'eligible' as const })
        : Object.freeze({ kind: 'ineligible' as const, reason: refusal });
    }, // End of function uncertaintyAcknowledgementEligibility()

    async open(root: string | null): Promise<void> {
      const generation = ++openGeneration;
      // **The reconciliation cursor goes with the workspace, and it goes first.**
      // The epoch belongs to the lifecycle being closed, the watermark indexes that
      // lifecycle's queue and `lastDiscarded` is cumulative within its epoch, so
      // carrying any of them into the next open would compare two lifecycles'
      // numbers. Cleared *before* the first await for `projectionGenerations`'
      // reason: a drain already in flight rechecks `openGeneration` after its own
      // await and installs nothing, and the bump above has already invalidated it.
      //
      // **It also closes the coordinator's drain gate, and that half is about the
      // drains this open has not started yet.** Rust holds the workspace being
      // replaced until `open_workspace` succeeds, so a trigger arriving between
      // here and `ready` would drain *that* lifecycle — and every generation
      // capture in the pump would pass, because the bump above has already
      // happened. Those reasons are recorded and issued by `workspaceReady()`.
      //
      // **The request is handed over rather than the summary's root** — Phase
      // 2d-5-4, ruling 11. `summary.root` is a lossy rendering of a path and is not
      // round-trippable as a command argument, so the discarded-history recovery
      // re-runs *this argument*, whatever it was, including `null`.
      reconciliation.workspaceOpened(root);
      // A selection into the workspace being replaced can never be applied to
      // the one replacing it, so every pending `select()` is invalidated here —
      // globally, which is right because *every* projection is about to go.
      selectGeneration += 1;
      // And the per-document counters are about documents of the workspace being
      // closed. The identities survive the load below — they are path-stable — so
      // an entry kept here would be the *same* file's count, taken in one lifecycle
      // and compared in the next, which counts nothing the new workspace did.
      // Clearing
      // cannot un-cancel anything: the bump above has already invalidated every
      // lookup that could have read one.
      projectionGenerations.clear();
      noticeHolds();
      // **And what this state had arbitrated about the workspace being closed** —
      // Phase 2d-5-5b. A standing conflict names bytes of a file *that* workspace
      // held, a retained observation is a reading admitted under an epoch that is
      // ending, and an uncertain write is uncertainty about a file this window is
      // about to stop describing; carrying any of the three would arbitrate the new
      // workspace's observations against the old one's facts.
      //
      // **`writesInFlight` is deliberately not cleared**, because a promise that is
      // still out will settle and decrement it: zeroing the count here would open a
      // barrier while its write was still running, which is the unsafe direction.
      // The maps it protects are empty by then, so a settlement that lands after
      // this releases nothing.
      //
      // **Nor are Phase 2d-6-1b's three tables**, each for its own reason stated
      // where it is declared: `uncertaintyGenerations` is monotonic and the open
      // generation bumped above is what refuses an acknowledgement minted for the
      // workspace being closed; the two acknowledgement tables are weak and carry
      // that generation; and `observationReceivers` is a component's own
      // registration, exactly as `writeSurfaces` is.
      standingConflicts.clear();
      retainedObservations.clear();
      uncertainWrites.clear();
      noticeHolds();

      // *Everything* the previous workspace decided goes, not only the parts
      // that obviously belong to a file: a sidebar filter naming document 3 and
      // a query naming a snippet in it are both statements about the workspace
      // that is being closed, and carrying either into the next one shows an
      // empty or arbitrarily filtered screen for a configuration that is not.
      status = 'loading';
      failure = null;
      loadFailures = [];
      summary = null;
      documents = [];
      views = [];
      selection = ALL_DOCUMENTS;
      query = '';
      selected = null;
      notice = null;
      // **What the watcher told this window about the workspace being closed goes
      // too** — Phase 2d-5-4. A status says what the watcher reported about a file
      // while *that* workspace was open, and a path drift is a statement about
      // which files *that* workspace held; carrying either would describe the new
      // workspace with the old one's observations.
      externalStatuses = [];
      pathDrift = [];
      // **And the pending marks, because this load is what ends them.** A row is
      // pending exactly while the open workspace does not resolve its identity;
      // `list_documents` below is what decides which identities it resolves, so a
      // mark carried across would say *unaddressable* about a file this workspace
      // really does hold. Cleared with `documents` rather than after the listing
      // for the reason every early return has: a refused open leaves no rows, and
      // a mark about a row that no longer exists is not a mark about anything.
      pendingAdditions = [];
      // The viewer closes with the workspace: it is showing one file's text, read
      // out of the workspace that is being replaced. `forgetFileText` also
      // invalidates the read in flight, which describes a file this state is about
      // to stop knowing about.
      fileTextShown = false;
      forgetFileText();

      const opened = await commands.openWorkspace(root);
      if (generation !== openGeneration) {
        return;
      }
      if (!opened.ok) {
        // **The coordinator is deliberately not told**, and this is the one place
        // that decision is visible from. `workspaceOpened()` closed its drain gate
        // above and only `workspaceReady()` opens one, so this path leaves
        // reconciliation held — which is the wanted answer rather than an omission:
        // `WorkspaceSession::open` leaves the *previously* open workspace in place
        // when it refuses, while this window has already cleared every document and
        // shows a failure, so a drain from here would come back describing a
        // lifecycle nothing on screen belongs to and hand it to `accept()` as this
        // session's epoch. The gate is not stuck by it — the next `open()` that
        // reaches `ready` opens it, and an `open()` is the only thing that puts a
        // workspace on screen at all.
        fail(opened.failure);
        return;
      }
      summary = opened.value;

      const listed = await commands.listDocuments();
      if (generation !== openGeneration) {
        return;
      }
      if (!listed.ok) {
        // Same as the arm above, and for the same reason: the drain gate stays
        // closed because no open reached `ready`.
        fail(listed.failure);
        return;
      }
      // **Copied at ingress, row by row**, for {@link ownedSummaryOf}'s reason:
      // `documents` is read inside the coordinator's guard — `creatorEligibility`
      // and `holdsDocument` both walk it — and `listed.value` is an injected
      // command's answer. Read once, here, into an array this module built.
      const rows: DocumentSummary[] = [];
      for (const summary of listed.value) {
        rows.push(ownedSummaryOf(summary));
      } // End of the loop over the rows the workspace listed
      // **The check the one above the loop cannot make** — Phase 2d-5-4-C's
      // finding 3, and the same repair this file already makes after the
      // projection loop below. Everything between that check and this line is
      // caller code: `listed.ok`, `listed.value`, the iteration protocol
      // `for…of` asks `listed.value` for, and seven field reads per row inside
      // {@link ownedSummaryOf}. A getter on any of them can synchronously call
      // `state.open(...)`, which blanks the window for a new root and suspends at
      // its own first await — and the assignment below would then publish the
      // *superseded* workspace's rows over the new open's cleared list, and the
      // loop after it would issue a `get_document` for one of them.
      //
      // **The window this closes is older than the copy that made it wide.**
      // Before the copy this line read `documents = listed.value`, with two
      // caller-supplied reads between the check and the assignment rather than
      // `2 + 7N` plus an iterator; the copy widened it, and did not introduce it.
      if (generation !== openGeneration) {
        return;
      }
      documents = rows;

      // **Every file is projected up front, config profiles included.** The
      // sidebar's counts and the "All" list are both statements about the whole
      // configuration, and a lazy load would make them statements about
      // whichever files had been clicked. A document that fails to *read* is
      // reported, kept on `loadFailures` for the sidebar to name, and skipped
      // rather than failing the workspace: one unreadable file must not blank a
      // window that can show the rest, and must not vanish from it either.
      //
      // Profiles were skipped until the 1c-2b-1 review, on the grounds that
      // they hold no matches — which is true and was the wrong test. A profile
      // has *diagnostics*, and a profile with broken YAML was silent in every
      // pane of this application: `holdsMatches` refused it here, so
      // `scopedDocument` answered `null` for its sidebar row and the middle
      // pane had nothing to say about a file the owner cannot browse. Phase 1's
      // exit is "the owner can browse their **entire** real config".
      //
      // What `holdsMatches` still governs is the *counting*, in two places: the
      // snippet-count map below and `buildSidebar`'s total and pending. A
      // profile projects, and contributes no count and no row in the snippet
      // list — `ConfigProfileView` has entries, not matches, so `view.matches`
      // is empty for one and `scopedMatches` needs no guard of its own.
      const projected: DocumentView[] = [];
      const refused: LoadFailure[] = [];
      for (const document of documents) {
        const view = await commands.getDocument(document.id);
        if (generation !== openGeneration) {
          return;
        }
        if (view.ok) {
          // **Copied here, not retained.** Everything `views` holds has to be an
          // object this module built, because `installView` compares the `id` of
          // every element it already holds *after* its caller's last check.
          //
          // The copy itself runs caller code — that is what it is for — and it
          // runs *after* the comparison above. What covers it is the comparison
          // after the loop, not this one; the arm below is caller code too,
          // because `report` is injected.
          projected.push(ownedProjectionOf(view.value));
        } else {
          // Both channels: the console for the developer, the state for the
          // user, who is otherwise reading a total that silently omits a file.
          // The identity goes with the failure so the file's own row can say
          // "could not be read" rather than "not read yet".
          refused.push({ document: document.id, failure: view.failure });
          report(view.failure);
        }
      } // End of the loop over every document of the workspace
      // **The check the per-iteration one cannot make, and it is about the last
      // document only.** For any earlier file, the caller code this loop runs —
      // `ownedProjectionOf`'s twenty-four field reads and each match's, or the
      // injected `report` on the failure arm — is caught by the *next* iteration's
      // comparison at the top. The final iteration has no next one: between its
      // reads and the publication below there was nothing at all, so an accessor
      // that synchronously called `state.open(...)` blanked the window for a new
      // root, returned at that call's first await, and then watched this function
      // install the superseded workspace's projections and say `ready` over it —
      // with `workspaceReady()` opening the coordinator's drain gate for a
      // lifecycle that is not the one on screen.
      if (generation !== openGeneration) {
        return;
      }
      views = projected;
      loadFailures = refused;
      status = 'ready';
      // **The second trigger, and only for a load that really finished.** Every
      // early return above — a superseded generation, a refused `open_workspace`, a
      // refused `list_documents` — leaves this unreached, so a drain is requested
      // exactly for the successful current open the consult's Q2 names. It is also
      // where the shown epoch comes from: `open_workspace` answers a root and
      // counts, so the first batch this drain brings back is the only thing that
      // can supply one. And it is the **only** thing that opens the gate
      // `workspaceOpened()` closed, so it also flushes every trigger that arrived
      // while this open was loading.
      reconciliation.workspaceReady();
    }, // End of function open()

    show(next: SidebarSelection): void {
      if (sameSelection(selection, next)) {
        return;
      }
      selection = next;
      // A sidebar click can move the raw viewer's target, and when it does the
      // new file's text has to be read. `readFileText` returns immediately when
      // the viewer is closed or the target did not move.
      void readFileText();
    },

    search(next: string): void {
      query = next;
    },

    async select(match: MatchView): Promise<void> {
      // **This call's own intent**, bumped before anything can fail: a click that
      // cannot be resolved still replaces the intent of an earlier one.
      const generation = ++selectGeneration;
      // **And the projection this lookup will be taken against.** Captured here,
      // per document, because the answer below is only about the parse the
      // identity was minted from; a replacement of some *other* file's projection
      // says nothing about it. The confirmation review's High finding is that the
      // two were one counter and this lookup died with any file's replacement.
      const document = match.id.document;
      const projection = projectionGenerationOf(document);
      // The row was rendered from a projection this state holds, so the
      // document is found by identity and the position is looked up rather than
      // carried through the markup — a row's index in the *list* is not a
      // position in a file, and in the "All" scope the two differ.
      const view = viewOf(match.id.document);
      if (view === undefined) {
        return;
      }
      const position = positionOf(view, match.id);
      if (position === null) {
        return;
      }
      const next = selectMatch(view, position);
      if (next === null) {
        return;
      }
      // Assigned directly rather than through `replaceSelection`, and this is the
      // one place that is right: the bump at the top of this call is this
      // assignment's, and bumping again here would cancel the lookup below.
      selected = next;
      notice = null;
      // In the "All" scope the selected snippet's file *is* the raw viewer's
      // target, so a click on a snippet in another file moves it.
      void readFileText();

      // The identity is checked across the boundary rather than assumed live.
      // In a browser with no watcher this almost always succeeds; when it does
      // not, R27's three answers are what comes back, and `repairSelection` is
      // where they are turned into a decision.
      const resolved = await commands.getMatch(next.id);
      if (selectionLookupIsStale(generation, document, projection)) {
        // A later click, a reload of the whole workspace, an operation that moved
        // the selection, or a replacement of **this file's** projection has
        // happened while this one was in flight. Its answer describes a selection
        // the user has already replaced or a parse this state no longer holds, so
        // it is dropped whole — including the reloaded document, which is a
        // projection the newer selection's position and identity were not taken
        // from.
        return;
      }
      if (resolved.ok) {
        return;
      }
      report(resolved.failure);
      // Copied before the check below, never between it and `applyRepair`: the
      // projection this repair carries came from `commands.reloadDocument`.
      const repair = ownedRepair(
        await repairSelection(next, resolved.failure, commands.reloadDocument)
      );
      if (selectionLookupIsStale(generation, document, projection)) {
        return;
      }
      applyRepair(repair);
      // A repair that clears the selection can take the viewer's target with
      // it, because in the "All" scope the selected snippet's file *is* the
      // target. `readFileText` forgets the held snapshot when nothing names a
      // file, so the next selection of that file reads it again.
      void readFileText();
    }, // End of function select()

    clearSelection(): void {
      // A selection dropped on purpose also invalidates whatever `select()` has
      // in flight: its answer is about a selection the user has just discarded.
      replaceSelection(null);
      notice = null;
      // And in the "All" scope the selection *was* the raw viewer's target, so
      // dropping it leaves nothing named. Same call, same reason as above.
      void readFileText();
    },

    dismissNotice(): void {
      notice = null;
    },

    async showFileText(on: boolean): Promise<void> {
      fileTextShown = on;
      if (!on) {
        // Closing the viewer drops the text it was showing rather than keeping
        // it for a re-open: a snapshot taken minutes ago and redrawn without a
        // re-read would be this application showing bytes that may no longer be
        // on disk, which is the one thing it exists not to do.
        forgetFileText();
        return;
      }
      await readFileText();
    }, // End of function showFileText()

    rereadDocument(document: DocumentId): Promise<IpcFailure | null> {
      // **The whole body moved to `rereadUnderGuard` at Phase 2d-5-4**, which is
      // the private guarded helper the design consult's Q5 permits, and this is now
      // one call of it with a guard that always holds. The captures, their
      // comparison and the install-forget-repair-reread order are unchanged and are
      // documented there.
      //
      // **What `ALWAYS_PERMITTED` means, corrected.** It used to say that nothing
      // has to arbitrate a read somebody asked for against an observation nobody
      // has seen. That is false about the window this read lands in: an
      // `Unreadable` observation can be admitted and acted on *while this read is
      // in flight*, and by the time the answer arrives it has been seen. What the
      // absent guard really means is narrower — **a person's own recovery is not
      // arbitrated away by a surface opening or by the registry moving**, which is
      // all the coordinator's guard decides. Ownership of the file's *status* is a
      // different question, and `rereadUnderGuard` answers it for every caller with
      // its own capture rather than with a guard.
      //
      // **What this member is not, since Phase 2d-6-1c.** It is not the control for
      // a `stale` file whose surface has closed: the 2d-6 record's §3 entry 32
      // forbids exposing this unguarded call as that control, and
      // `requestFileReread` is the guarded request that serves it. This one stays
      // what it was — the reload the move and duplicate panels offer from inside a
      // conflict they already own, where the surface asking *is* the surface the
      // guard would otherwise refuse for.
      return rereadUnderGuard(document, ALWAYS_PERMITTED);
    }, // End of function rereadDocument()

    async moveMatch(
      match: MatchId,
      after: MatchId | null,
      baseRevision: ContentRevision,
      acknowledgement: Acknowledgement
    ): Promise<MatchSaveAnswer> {
      const view = views.find((held) => held.id === match.document);
      if (view === undefined) {
        // Nothing on this state describes that document, so nothing here could
        // adopt what a commit produced or tell whether its own projection went out
        // of date — and the anchor is worse than an edit's target: an identity
        // minted from a parse this window does not hold names a *different*
        // snippet in the parse the command reads. Nothing was sent, so nothing can
        // have been written, and there is no rejection to hand on because no
        // command ran. Its own arm, so the type says both rather than a comment
        // claiming it.
        return { kind: 'notAttempted' };
      }
      // **Ruling 27's barrier opens here and closes in the `finally` below.**
      // While it is open, a watcher observation of this file is held rather than
      // applied, because what is on disk cannot be attributed to a writer until
      // this promise settles. See `beginWrite`.
      const write = beginWrite(match.document);
      try {
        const answer = await commands.moveMatch(
          match,
          after,
          // **The caller's, unchanged**, and never `view.revision`: see this method's
          // JSDoc. Reading the projection here rebases a move the window has moved on
          // from, and turns the conflict that should stop it into a commit.
          baseRevision,
          acknowledgement
        );
        if (!answer.ok) {
          // A save that failed is not a workspace that failed, so the window keeps
          // showing the configuration it was showing — but *which* bytes it is
          // showing of this one file is a different question, and `mayHaveWritten`
          // is the only thing that answers it. A failure after the rename means the
          // file may already hold the moved snippet: the command layer drops its own
          // cached parse in exactly that case, and a window that did not do the same
          // would go on drawing the pre-save order and the pre-save text over a file
          // that has moved on.
          //
          // **The answer carries it**, which is the 2c-2 review's first finding
          // applied here at 2c-3b-1: a bare `null` was indistinguishable from
          // `noWorkspaceOpen`, and a screen that renders both as *nothing was
          // written* states the opposite of what the disk may hold.
          const written = mayHaveWritten(answer.failure);
          // **What this failure establishes, recorded before anything is done about
          // it**: `uncertain` when the write may have written, nothing-written
          // otherwise. It is the `finally` below that releases the barrier, so a
          // reporter or a re-read that throws still closes it on this settlement.
          write.expect(settlementOfFailure(written));
          report(answer.failure);
          if (written) {
            forgetFileText();
            await adoptTheDocumentOnDisk(match.document, null, null);
            await readFileText();
          }
          return { kind: 'failed', mayHaveWritten: written, failure: answer.failure };
        }

        // **What the transaction established, recorded before the adoption below**,
        // and released by the `finally` after it (ruling 27): a commit completes its
        // own projection invalidation first, so an observation released then is
        // arbitrated against the window the commit left rather than the one it found.
        // Recording it here rather than beside that release is what keeps an
        // exception in between from settling a known outcome as `uncertain`.
        write.expect(settlementOfOutcome(answer.value));

        let adoption: InvalidationStatus = { kind: 'notOwed' };
        if (answer.value.outcome === 'saved') {
          // **A `Saved` does not mean the bytes changed.** `committed: false` is a
          // documented success: a candidate byte-identical to what the file already
          // held is not written, because every rename installs a new inode for
          // nothing — and moving one of two identical snippets produces exactly
          // that. What makes this screen out of date is therefore not the arm but
          // one of two facts: the file was rewritten, or the revision the
          // transaction ended on is not the one this state was projecting, which is
          // a file some other program changed under the lock's two reads.
          const outOfDate = answer.value.committed || answer.value.revision !== view.revision;
          if (outOfDate) {
            // The viewer's snapshot is of bytes that have just been replaced. There
            // is one text cache to drop since 2c-4a-2; there were two, and forgetting
            // only this one left a conflict capture for this same file behind.
            forgetFileText();
            // **The one adoption that passes an attribution**, which is the fix
            // `docs/decisions/2c-3b-2-window-reading.md` section 7.1 prescribes: a
            // repair after a committed move must not tell the person their file
            // changed on disk when the reorder is the write they asked for. It is
            // passed only for a commit — `committed: false` here means the move
            // wrote nothing and this screen is out of date because the *revision*
            // moved, which is another writer's doing — and this method's
            // `mayHaveWritten` path above keeps the default for the same reason:
            // an uncertain write cannot claim the reorder, and the sentence that
            // claims less wins.
            //
            // **Nothing thrown after the commit may turn it into an error** — Phase
            // 2d-6-7a; `adoptAfterTheCommit` is the one post-commit policy, and a
            // failure travels back beside the committed outcome, never in place of
            // it (`PROGRESS.md` D2).
            // Every read of the result that feeds the adoption runs inside the thunk, so
            // the helper's catch covers a getter that throws (Phase 2d-6-7a's review).
            const result = answer.value;
            adoption = await adoptAfterTheCommit(match.document, () =>
              adoptTheDocumentOnDisk(
                match.document,
                match,
                result.moved,
                result.committed ? 'requestedMove' : 'externalChange'
              )
            );
          }
        } else if (answer.value.outcome === 'conflict') {
          // **A conflict installs nothing here, and that is 2c-4a-2's central
          // change.** Nothing was written; the command layer refreshed its own cache
          // and handed back what it read, and this state deliberately does not take
          // it. Installing it re-ordered the snippet list and moved the selection for
          // a save that changed no byte, leaving the person's draft beside a
          // projection that no longer described it (consult Q2).
          // `BrowserState.adoptDiskVersion` is the one transition that installs it,
          // and only a confirmed reload can reach it.
          //
          // What this arm does do is **write down** which projection the conflict
          // describes, which is what lets that adoption refuse a window that has
          // moved on since. Registering is not adopting.
          rememberTheSaveConflict(match.document, saveConflictSource(answer.value));
        }
        return { kind: 'answered', result: answer.value, adoption };
      } finally {
        // **Ruling 27's barrier closes here, on every exit this wrapper has** —
        // including an exception: `close` releases it on whatever the answer above
        // established, or on `uncertain` when nothing did. See `beginWrite`.
        write.close();
      }
    }, // End of function moveMatch()

    async saveMatch(
      id: MatchId,
      draft: MatchDraft,
      baseRevision: ContentRevision,
      acknowledgement: Acknowledgement
    ): Promise<MatchSaveAnswer> {
      return saveOneSnippetInPlace(id, () =>
        commands.saveMatch(id, draft, baseRevision, acknowledgement)
      );
    },

    async matchItemText(id: MatchId): Promise<CommandResult<OwnedItemText>> {
      return reportedRead(await commands.matchItemText(id));
    },

    async saveMatchItemText(
      id: MatchId,
      baseRevision: ContentRevision,
      text: string,
      acknowledgement: Acknowledgement
    ): Promise<MatchSaveAnswer> {
      // The text travels exactly as given: Rust re-derives the range under the
      // write lock and writes these bytes into it, or refuses.
      return saveOneSnippetInPlace(id, () =>
        commands.saveMatchItemText(id, baseRevision, text, acknowledgement)
      );
    },

    async createMatch(
      document: DocumentId,
      newMatch: NewMatch,
      position: NewMatchPosition,
      baseRevision: ContentRevision,
      acknowledgement: Acknowledgement
    ): Promise<MatchSaveAnswer> {
      const view = views.find((held) => held.id === document);
      if (view === undefined) {
        // Nothing on this state describes that file, so nothing here could adopt
        // what a commit produced or tell whether the projection went out of date —
        // and for a create the anchor is worse than an edit's target: an identity
        // minted from a parse this window does not hold would name a *different*
        // snippet in the parse the command reads. Nothing was sent, so nothing can
        // have been written.
        return { kind: 'notAttempted' };
      }
      // **Captured before the command**, because the rule below is about whether
      // the person moved the selection while the create was in flight, and after
      // the `await` there is no way to tell.
      const heldBefore = selected;
      // **Ruling 27's barrier opens here and closes in the `finally` below.**
      // While it is open, a watcher observation of this file is held rather than
      // applied, because what is on disk cannot be attributed to a writer until
      // this promise settles. See `beginWrite`.
      const write = beginWrite(document);
      try {
        const answer = await commands.createMatch(
          document,
          newMatch,
          position,
          // **The caller's, unchanged**, and never `view.revision`: see this method's
          // JSDoc. Reading the projection here rebases a form the window has moved
          // on from, and turns the conflict that should stop it into a commit.
          baseRevision,
          acknowledgement
        );
        if (!answer.ok) {
          // The same rule a failed field save follows: a save that failed is not a
          // workspace that failed, and `mayHaveWritten` is the only thing that says
          // whether this window is still describing the file correctly.
          const written = mayHaveWritten(answer.failure);
          // **What this failure establishes, recorded before anything is done about
          // it**: `uncertain` when the write may have written, nothing-written
          // otherwise. It is the `finally` below that releases the barrier, so a
          // reporter or a re-read that throws still closes it on this settlement.
          write.expect(settlementOfFailure(written));
          report(answer.failure);
          if (written) {
            forgetFileText();
            await adoptTheDocumentOnDisk(document, null, null);
            await readFileText();
          }
          return { kind: 'failed', mayHaveWritten: written, failure: answer.failure };
        }

        // **What the transaction established, recorded before the adoption below**,
        // and released by the `finally` after it (ruling 27): a commit completes its
        // own projection invalidation first, so an observation released then is
        // arbitrated against the window the commit left rather than the one it found.
        // Recording it here rather than beside that release is what keeps an
        // exception in between from settling a known outcome as `uncertain`.
        write.expect(settlementOfOutcome(answer.value));

        let adoption: InvalidationStatus = { kind: 'notOwed' };
        if (answer.value.outcome === 'saved') {
          // A `committed: false` is a documented success and is very nearly
          // unreachable for an insertion; the second half of the test is the one
          // that matters here, as it does for a move: a revision the transaction
          // ended on that is not the one this state was projecting is a file some
          // other program changed under the lock's two reads.
          const outOfDate = answer.value.committed || answer.value.revision !== view.revision;
          if (outOfDate) {
            forgetFileText();
            // **Nothing thrown after the commit may turn it into an error** — Phase
            // 2d-6-6c-1's review, first finding. The transaction has written and the
            // barrier has been told so above; an exception out of the adoption or the
            // re-read below used to reject this promise, and the form then settled a
            // committed create as a failed send that may have written (`PROGRESS.md`
            // D2). The exception is caught and travels back as the adoption's
            // failure, beside the `saved` outcome, never in place of it — since
            // Phase 2d-6-7a through `adoptAfterTheCommit`, whose classification of
            // the thrown value is guarded as well (`2d-6-6c-2-notes.md` §5 item 7).
            // What the catch does not do is make the window's own state right: the
            // file is dropped as it is for a read that failed, so nothing minted
            // from the replaced bytes stays on screen.
            // Every read of the result that feeds the adoption runs inside the thunk, so
            // the helper's catch covers a getter that throws (Phase 2d-6-7a's review).
            const result = answer.value;
            adoption = await adoptAfterTheCommit(document, () =>
              adoptTheCreatedSnippet(document, heldBefore, result.moved)
            );
          }
        } else if (answer.value.outcome === 'conflict') {
          // **A conflict installs nothing here** — `BrowserState.moveMatch`'s own note
          // says why, and the rule is one rule for all seven writing wrappers. What is
          // written down is which projection the conflict describes.
          rememberTheSaveConflict(document, saveConflictSource(answer.value));
        }
        return { kind: 'answered', result: answer.value, adoption };
      } finally {
        // **Ruling 27's barrier closes here, on every exit this wrapper has** —
        // including an exception: `close` releases it on whatever the answer above
        // established, or on `uncertain` when nothing did. See `beginWrite`.
        write.close();
      }
    }, // End of function createMatch()

    async deleteMatch(
      id: MatchId,
      baseRevision: ContentRevision,
      acknowledgement: Acknowledgement
    ): Promise<MatchSaveAnswer> {
      const view = views.find((held) => held.id === id.document);
      if (view === undefined) {
        // Nothing on this state describes that file, so nothing here could adopt
        // what a commit produced or tell whether the projection went out of date.
        // Nothing was sent, so nothing can have been written.
        return { kind: 'notAttempted' };
      }
      // **Captured before the command**, and it is the *position* that is captured
      // as well as the identity: after a committed deletion the identity names
      // nothing, and the position is where the repair below starts looking.
      const heldBefore =
        selected !== null &&
        selected.document === id.document &&
        isTheSameIdentity(selected.id, id)
          ? selected
          : null;
      // **The caller's base revision, unchanged**, and never `view.revision`: a
      // deletion resolves an identity to a *position*, so a base that is not the
      // parse the session was opened against is the one thing standing between a
      // stale confirmation and the removal of whatever now sits there.
      // **Ruling 27's barrier opens here and closes in the `finally` below.**
      // While it is open, a watcher observation of this file is held rather than
      // applied, because what is on disk cannot be attributed to a writer until
      // this promise settles. See `beginWrite`.
      const write = beginWrite(id.document);
      try {
        const answer = await commands.deleteMatch(id, baseRevision, acknowledgement);
        if (!answer.ok) {
          const written = mayHaveWritten(answer.failure);
          // **What this failure establishes, recorded before anything is done about
          // it**: `uncertain` when the write may have written, nothing-written
          // otherwise. It is the `finally` below that releases the barrier, so a
          // reporter or a re-read that throws still closes it on this settlement.
          write.expect(settlementOfFailure(written));
          report(answer.failure);
          if (written) {
            forgetFileText();
            await adoptTheDocumentOnDisk(id.document, null, null);
            await readFileText();
          }
          return { kind: 'failed', mayHaveWritten: written, failure: answer.failure };
        }

        // **What the transaction established, recorded before the adoption below**,
        // and released by the `finally` after it (ruling 27): a commit completes its
        // own projection invalidation first, so an observation released then is
        // arbitrated against the window the commit left rather than the one it found.
        // Recording it here rather than beside that release is what keeps an
        // exception in between from settling a known outcome as `uncertain`.
        write.expect(settlementOfOutcome(answer.value));

        let adoption: InvalidationStatus = { kind: 'notOwed' };
        if (answer.value.outcome === 'saved') {
          const outOfDate = answer.value.committed || answer.value.revision !== view.revision;
          if (outOfDate) {
            forgetFileText();
            // **Nothing thrown after the commit may turn it into an error** — Phase
            // 2d-6-7a: `adoptAfterTheCommit` answers an exception out of the
            // adoption or the re-read as a `failed` adoption beside the `saved`
            // outcome (`PROGRESS.md` D2).
            adoption = await adoptAfterTheCommit(id.document, () =>
              adoptAfterTheDeletion(id.document, heldBefore)
            );
          }
        } else if (answer.value.outcome === 'conflict') {
          // **A conflict installs nothing here** — `BrowserState.moveMatch`'s own note
          // says why, and the rule is one rule for all seven writing wrappers. What is
          // written down is which projection the conflict describes.
          rememberTheSaveConflict(id.document, saveConflictSource(answer.value));
        }
        return { kind: 'answered', result: answer.value, adoption };
      } finally {
        // **Ruling 27's barrier closes here, on every exit this wrapper has** —
        // including an exception: `close` releases it on whatever the answer above
        // established, or on `uncertain` when nothing did. See `beginWrite`.
        write.close();
      }
    }, // End of function deleteMatch()

    async duplicateMatch(
      match: MatchId,
      baseRevision: ContentRevision,
      acknowledgement: Acknowledgement
    ): Promise<MatchSaveAnswer> {
      const view = views.find((held) => held.id === match.document);
      if (view === undefined) {
        // Nothing on this state describes that document, so nothing here could
        // adopt what a commit produced or tell whether its own projection went
        // out of date — and an identity minted from a parse this window does
        // not hold names a *different* snippet in the parse the command reads,
        // whose bytes would then be copied. Nothing was sent, so nothing can
        // have been written, and there is no rejection to hand on because no
        // command ran. Its own arm, so the type says both.
        return { kind: 'notAttempted' };
      }
      // **Captured before the command, validated where the selection is
      // written** (review round 1, finding 1; the confirmation pass is why the
      // capture travels whole rather than being reduced to a boolean here).
      // Following `moved` to the clone is legitimate only when the selection
      // that **initiated** the duplicate was the source and the person has
      // expressed no new intent since — and "since" runs across **every**
      // await on the path, the command's *and* the adoption's own re-read, so
      // the check cannot live at this altitude at all: a boolean computed
      // between the two awaits was exactly the residual hole. The capture is
      // handed to `adoptAfterTheDuplicate`, which re-validates both halves in
      // the same synchronous block that writes the selection. The captured
      // object answers "was the source selected when this started, and is that
      // very selection still held?" (every write to `selected` installs a
      // fresh object); the captured `selectGeneration` answers the half the
      // object cannot — an intent expressed without an assignment landing,
      // such as a `select()` that bumped the counter at entry and then failed
      // to resolve. The two counters are not interchangeable, and neither is a
      // substitute for this pair: the projection generation says nothing about
      // intent.
      const intent: DuplicateIntent | null =
        selected !== null &&
        selected.document === match.document &&
        isTheSameIdentity(selected.id, match)
          ? { held: selected, generation: selectGeneration }
          : null;
      // **Ruling 27's barrier opens here and closes in the `finally` below.**
      // While it is open, a watcher observation of this file is held rather than
      // applied, because what is on disk cannot be attributed to a writer until
      // this promise settles. See `beginWrite`.
      const write = beginWrite(match.document);
      try {
        const answer = await commands.duplicateMatch(
          match,
          // **The caller's, unchanged**, and never `view.revision`: see this
          // method's JSDoc. Reading the projection here rebases a duplicate the
          // window has moved on from, and turns the conflict that should stop it
          // into a commit.
          baseRevision,
          acknowledgement
        );
        if (!answer.ok) {
          // A save that failed is not a workspace that failed, so the window
          // keeps showing the configuration it was showing — but `mayHaveWritten`
          // is the only thing that says whether it is still showing this *file*
          // correctly. A failure at or after the rename means the file may
          // already hold the clone, and the cautious re-read below is attempted
          // **without asserting that the duplicate exists** (consult Q8): the
          // adoption is given no target and no `moved`, so nothing is selected on
          // its account and the repair keeps the external sentences — an
          // uncertain write cannot claim the copy.
          const written = mayHaveWritten(answer.failure);
          // **What this failure establishes, recorded before anything is done about
          // it**: `uncertain` when the write may have written, nothing-written
          // otherwise. It is the `finally` below that releases the barrier, so a
          // reporter or a re-read that throws still closes it on this settlement.
          write.expect(settlementOfFailure(written));
          report(answer.failure);
          if (written) {
            forgetFileText();
            await adoptTheDocumentOnDisk(match.document, null, null);
            await readFileText();
          }
          return { kind: 'failed', mayHaveWritten: written, failure: answer.failure };
        }

        // **What the transaction established, recorded before the adoption below**,
        // and released by the `finally` after it (ruling 27): a commit completes its
        // own projection invalidation first, so an observation released then is
        // arbitrated against the window the commit left rather than the one it found.
        // Recording it here rather than beside that release is what keeps an
        // exception in between from settling a known outcome as `uncertain`.
        write.expect(settlementOfOutcome(answer.value));

        let adoption: InvalidationStatus = { kind: 'notOwed' };
        if (answer.value.outcome === 'saved') {
          // **A `Saved` does not mean the bytes changed.** `committed: false` is
          // a documented success and is practically unreachable for an insertion
          // — a duplicate always changes the document — so the half that matters
          // here is the second: a revision the transaction ended on that is not
          // the one this state was projecting is a file some other program
          // changed under the lock's two reads.
          const outOfDate = answer.value.committed || answer.value.revision !== view.revision;
          if (outOfDate) {
            // The viewer's snapshot, which is the one text cache this window keeps
            // since 2c-4a-2 — the same rule every writing wrapper follows.
            forgetFileText();
            // **The duplicate's own adoption, and the intent capture goes in
            // whole** (the confirmation pass's finding): the decision to follow
            // the clone is taken inside `adoptAfterTheDuplicate`, after its own
            // await, in the same synchronous block that writes the selection —
            // never here, where a value computed between the two awaits goes
            // stale the moment the re-read yields. It also passes the duplicate's
            // own attribution rather than the move's: `requestedDuplicate`'s
            // sentences name the person's copy, where `requestedMove`'s say
            // *reordered* — a claim an insertion would make false. Passed only
            // for a commit; a `committed: false` here means the revision moved on
            // its own, which is another writer's doing, and the external
            // sentences are the accurate ones there.
            //
            // **Nothing thrown after the commit may turn it into an error** — Phase
            // 2d-6-7a: `adoptAfterTheCommit` answers an exception out of the
            // adoption or the re-read as a `failed` adoption beside the `saved`
            // outcome (`PROGRESS.md` D2).
            // Every read of the result that feeds the adoption runs inside the thunk, so
            // the helper's catch covers a getter that throws (Phase 2d-6-7a's review).
            const result = answer.value;
            adoption = await adoptAfterTheCommit(match.document, () =>
              adoptAfterTheDuplicate(
                match.document,
                intent,
                result.moved,
                result.committed ? 'requestedDuplicate' : 'externalChange'
              )
            );
          }
        } else if (answer.value.outcome === 'conflict') {
          // **A conflict installs nothing here** — `BrowserState.moveMatch`'s own note
          // says why, and the rule is one rule for all seven writing wrappers. What is
          // written down is which projection the conflict describes.
          rememberTheSaveConflict(match.document, saveConflictSource(answer.value));
        }
        return { kind: 'answered', result: answer.value, adoption };
      } finally {
        // **Ruling 27's barrier closes here, on every exit this wrapper has** —
        // including an exception: `close` releases it on whatever the answer above
        // established, or on `uncertain` when nothing did. See `beginWrite`.
        write.close();
      }
    }, // End of function duplicateMatch()

    async saveRawDocument(
      document: DocumentId,
      baseRevision: ContentRevision,
      text: string,
      acknowledgement: Acknowledgement
    ): Promise<RawSaveAnswer> {
      // **The invalidation is this module's, not the caller's.** The wrapper's
      // parameter cannot make a body do anything — `() => {}` type-checks — so
      // what closes the obligation on the running path is that the state which
      // owns the cache is the thing that passes one. The closure below is the
      // only production caller of that parameter.
      //
      // Its own failure is **kept**, not merely reported. `adoptTheReplacedDocument`
      // answers the failure of the re-read rather than swallowing it, because a
      // committed save this window could not re-project is a window out of step
      // with a file that really was rewritten — and until the 2c-1b review that
      // fact reached the developer console and no screen.
      //
      // **Nothing escapes this closure, since Phase 2d-6-8a.** The command awaits
      // it and classifies whatever it throws, but with a bare `classifyFailure`,
      // which a thrown value whose `code` getter throws makes throw in turn — so a
      // committed save came back as a rejection (D2), the shape 2d-6-6c-2's review
      // fixed in `saveMatch`. Caught here, the failure is classified by the guarded
      // `classifiedAfterTheCommit`, reported as the command's own catch would have
      // reported it, and kept on `reprojection`. `adoptTheReplacedDocument` forgets
      // the file before its first await, so a throw from the re-read leaves the
      // replaced projection dropped (from `getDocument`) or the new one installed
      // (from `documentText`), as `adoptAfterTheCommit` does.
      let reprojection: IpcFailure | null = null;
      const invalidate: ReloadAfterRawSave = async (invalidation) => {
        try {
          reprojection = await adoptTheReplacedDocument(invalidation.document);
        } catch (raw: unknown) {
          // **Recorded before it is reported, and the report contained** (Phase
          // 2d-6-8a's review, its blocker): the reporter reads the failure again —
          // `reportIpcFailure` reads `failure.error.code` — and a value the
          // classifier accepted on one read can throw on the next. The report is
          // diagnostic; the recorded failure is what the seal carries.
          const failure = classifiedAfterTheCommit(raw);
          reprojection = failure;
          reportedQuietly(failure);
        }
      };
      // **Ruling 27's barrier opens here and closes in the `finally` below.**
      // While it is open, a watcher observation of this file is held rather than
      // applied, because what is on disk cannot be attributed to a writer until
      // this promise settles. See `beginWrite`.
      const write = beginWrite(document);
      try {
        const answer = await commands.saveRawDocument(
          document,
          baseRevision,
          text,
          acknowledgement,
          invalidate
        );
        if (!answer.ok) {
          // Same rule as a failed move: a save that failed is not a workspace that
          // failed, but `mayHaveWritten` decides whether this window is still
          // describing the file correctly. A replacement that failed after its
          // rename means the file may already hold a *whole new text*, so nothing
          // cached for it can be vouched for — and the caller is told, because a
          // screen that renders this as "nothing was written" states the opposite of
          // what the disk may hold.
          const written = mayHaveWritten(answer.failure);
          // **What this failure establishes, recorded before anything is done about
          // it**: `uncertain` when the write may have written, nothing-written
          // otherwise. It is the `finally` below that releases the barrier, so a
          // reporter or a re-read that throws still closes it on this settlement.
          write.expect(settlementOfFailure(written));
          report(answer.failure);
          if (written) {
            // **Caught since Phase 2d-6-8a.** An exception out of this re-read
            // used to reject the wrapper, and the one fact a screen needs here —
            // the file may already hold the candidate — never reached it. What it
            // threw is reported, classified by the guarded helper; the answer is
            // the same `mayHaveWritten` either way.
            try {
              await adoptTheReplacedDocument(document);
            } catch (raw: unknown) {
              // Contained for the same reason as the closure's report above.
              reportedQuietly(classifiedAfterTheCommit(raw));
            }
          }
          return { kind: 'failed', mayHaveWritten: written };
        }

        // **What the transaction established, recorded before the adoption below**,
        // and released by the `finally` after it (ruling 27): a commit completes its
        // own projection invalidation first, so an observation released then is
        // arbitrated against the window the commit left rather than the one it found.
        // Recording it here rather than beside that release is what keeps an
        // exception in between from settling a known outcome as `uncertain`.
        write.expect(settlementOfOutcome(answer.value));
        // **The write committed and the window could not be brought back into
        // step.** It is reported rather than turned into a failed save, because the
        // bytes really are on disk and telling the caller otherwise would invite a
        // retry of a write that already happened (D2). Everything cached for the
        // file has already been forgotten by then, so what is on screen is
        // incomplete rather than wrong — and *that* is what the seal now carries, so
        // a screen can say it.
        //
        // Two sources, one status. `answer.reload` is `failed` when the closure
        // above **threw**; `reprojection` is non-null when it returned a typed
        // failure instead. Both mean the same thing to a person.
        const thrown = answer.reload.kind === 'failed' ? answer.reload.failure : null;
        const stale: IpcFailure | null = thrown ?? reprojection;
        if (thrown !== null) {
          report(thrown);
        }
        const invalidated: RawSaveReload =
          stale === null ? answer.reload : { kind: 'failed', failure: stale };
        // **There is no `outOfDate` arm here, and a move's is not missing.** A move
        // compares the revision the transaction ended on against the one this state
        // was projecting, because a `committed: false` there can still mean some
        // other program moved the file on between the lock's two reads. A
        // replacement cannot reach that: `committed: false` means the candidate was
        // byte-identical to what the locked read found, and the locked read already
        // agreed with `baseRevision` or this would be a conflict — so the revision
        // the answer carries is the one that was sent.
        //
        // **And a conflict installs nothing here** — `BrowserState.moveMatch`'s own
        // note says why. There is no second read of the file's text either: the
        // conflict payload carries `disk_text`, paired with `disk_revision` by the
        // command layer, so the capture this used to make had nothing to add and a
        // race to lose (`docs/decisions/2c-4a-1-notes.md` section 4.1). What is
        // written down is which projection the conflict describes.
        if (answer.value.outcome === 'conflict') {
          rememberTheSaveConflict(document, saveConflictSource(answer.value));
        }
        //
        // Sealed here and nowhere else: this is the one place that knows which
        // document was aimed at, what the transaction answered, and what this
        // state's own invalidation made of it.
        return {
          kind: 'sealed',
          sealed: sealWholeDocumentSave(document, answer.value, invalidated)
        };
      } finally {
        // **Ruling 27's barrier closes here, on every exit this wrapper has** —
        // including an exception: `close` releases it on whatever the answer above
        // established, or on `uncertain` when nothing did. See `beginWrite`.
        write.close();
      }
    }, // End of function saveRawDocument()

    async listBackupBatches(): Promise<CommandResult<BackupBatchListing>> {
      return reportedRead(await backup.listBackupBatches());
    },

    async listBackupEntries(batch: BackupBatchId): Promise<CommandResult<BackupEntryListing>> {
      // The batch travels through untouched: it is an opaque identity a listing
      // produced, it is not authority, and the command re-resolves it beneath the
      // workspace-owned backup folder.
      return reportedRead(await backup.listBackupEntries(batch));
    },

    async readBackupText(
      entry: BackupEntryId,
      document: DocumentId
    ): Promise<CommandResult<BackupTextResponse>> {
      // Both arguments travel through untouched, and the command is what refuses
      // an entry that does not map to the document. Nothing here keeps the text:
      // `candidateRead` in `./restore.ts` retains it on the session, and a second
      // copy on this state would be a second thing for a preview to drift from.
      return reportedRead(await backup.readBackupText(entry, document));
    },

    async restoreDocument(
      started: StartedRestore | null,
      surfaces: readonly OpenWriteSurface[],
      invalidate: InvalidateEverySurface,
      current: ReadTheInstalledRestore
    ): Promise<RestoreSession | null> {
      if (started === null) {
        // A confirmation that never happened, or one that was refused. There is no
        // session to derive and nothing to say about the caller's: not a command, not
        // a context, not a transition. `restoreRefusal` over what the caller holds is
        // what a screen draws instead.
        return null;
      }
      // **The session is the confirmation's own.** Taking one as a parameter beside
      // `started` let a caller pair a permit with a session it was not minted for,
      // which wrote nothing and answered a frozen session that no ordinary transition
      // could move (the 2c-5-4a review's Medium). Here there is nothing to pair
      // wrongly.
      const session = started.session;
      // **The revision half is this state's own answer, not the caller's.**
      // `./restore.ts` records that nothing can force `RestoreContext.observed` to
      // have come from the live projection rather than from the session's frozen
      // base; here it did. Read synchronously, before anything awaits, so it
      // describes the window the permit is about to be checked against — and it is
      // **not** a refreshed base revision: what gets written is the base the
      // confirmation froze, taken off the permit inside `sendRestore`. The surfaces
      // half is the caller's because no coordinator can observe a session held
      // inside a component (R36).
      const context: RestoreContext = {
        observed: revisionInProjection(views, session.target),
        surfaces
      };
      // **The sixth writer, called rather than copied.** Restore is a content path
      // on `saveRawDocument`: the lock, the revision check, the reparse, the
      // acknowledgement, the backup, this state's cache invalidation and the seal
      // are all that method's. The forwarder is written out rather than passing the
      // method by reference so that nothing here depends on how `this` binds.
      const sent = await sendRestore(
        started,
        session,
        context,
        (document, baseRevision, text, acknowledgement) =>
          state.saveRawDocument(document, baseRevision, text, acknowledgement),
        current
      );
      if (sent.kind === 'notAttempted') {
        // This call held no permit: another call — an earlier one, or a re-entrant
        // one that reached the checked deletion first — is the one that spent it and
        // the one that answers for the session. **This restore attempt sent
        // nothing**, which says nothing about what that other call, or any other
        // writer, may have done to the file. Answering the confirmation's own session
        // here would hand back a frozen snapshot in place of whatever that call
        // produced, so nothing is answered at all.
        return null;
      }
      if (sent.kind === 'withdrawn') {
        // The permit no longer described the session and the window, so it was
        // consumed and **this restore attempt sent nothing**. The session has to come
        // out of the phase the confirmation put it in — the model freezes every
        // editing transition while it is there — so what comes back keeps the
        // candidate and its consent and is askable again, with `restoreRefusal`
        // saying what is in the way.
        return restoreConfirmationWithdrawn(session, current);
      }
      if (sent.answer.kind === 'failed') {
        // A command ran and produced no outcome. Whether the file changed is a
        // second question and `mayHaveWritten` is the only honest answer to it.
        return restoreCouldNotBeSent(session, sent.answer.mayHaveWritten, current);
      }
      // The answer is sealed, and `applyRestore` is the only way to open it: the
      // caller's whole-document invalidation is discharged on the way, and a body
      // that throws comes back as a line beside the committed outcome rather than
      // in place of it.
      return applyRestore(session, sent.answer.sealed, invalidate, current);
    }, // End of function restoreDocument()

    start(): void {
      // Straight through, for `registerWriteSurface`'s reason one member down: the
      // coordinator owns idempotence, the registration race and the pump, and a
      // guard here would be a second rule that can drift from it.
      reconciliation.start();
    },

    dispose(): void {
      reconciliation.dispose();
    },

    registerWriteSurface(
      surface: OpenWriteSurface,
      transition: WriteSurfaceTransition
    ): UnregisterWriteSurface {
      // Straight through for the decision: the registry owns the lease, the key and
      // the generation, and adding a check here would be a second rule that can
      // drift from it. What this door adds is not a rule but a mirror — the
      // registry's own generation copied into a signal, so that a window can derive
      // from the live set at all. A throw from the registry leaves the mirror alone,
      // which is right for the narrow reason and not the broad one: *this* call
      // wrote nothing, and a registration the caller's own reads performed on the
      // way in came through this same door and mirrored itself before answering.
      const lease = writeSurfaces.registerWriteSurface(surface, transition);
      noticeWriteSurfaces();
      return mirroringLease(lease);
    },

    openWriteSurfaces(): readonly OpenWriteSurface[] {
      // **This read is the dependency, and its value is deliberately unused.**
      // Reading the mirror inside the answer is what subscribes a caller's
      // `$derived` or `$effect` to the live set: the array below is built from a
      // plain `Map` that no signal watches, so without this line a consumer would
      // hold whatever the set was when it last happened to run. The restore's
      // `surfaces` prop is exactly such a consumer.
      void surfaceGeneration;
      return writeSurfaces.openWriteSurfaces();
    },

    writeSurfaceGeneration(): number {
      // **The read is the dependency; the registry is the answer.** This is the
      // same shape `openWriteSurfaces()` above uses, and Phase 2d-5-2b-A's review,
      // finding 1, is why it is used here too: reading the mirror subscribes a
      // caller's `$derived` or `$effect` exactly as it does there, and returning
      // `writeSurfaces.generation()` makes the number itself authoritative rather
      // than derivative.
      //
      // **The direction is the whole reason.** Returning the mirror instead would
      // make this door *under-report* if a later method of this state ever moved
      // the registry without calling `noticeWriteSurfaces()`: it would answer
      // "nothing changed" while `openWriteSurfaces()`, which reads the registry,
      // answered the new set in the same block. Reading the registry cannot fail
      // *that* way: this door's answer is never behind the registry, whoever asks.
      // **The Q5 guard this sentence used to name as that caller is not one**: the
      // guard Phase 2d-5-4 shipped captures `writeSurfaces.generation()` through
      // `ReconciliationHost`, not through this door, so the argument above stands
      // on its own merits and on no consumer this repository holds.
      //
      // **What such a path would still cost depends on who is asking, and Phase
      // 2d-5-2b-B's finding 2 is that the old sentence here named only half of
      // them.** For a caller in **no reactive context** the cost is the
      // *invalidation* alone — it calls, so it gets today's number regardless. For a
      // caller **inside one** the cost is the *value* as well, because a derivation
      // that is never invalidated keeps what it last computed until some other
      // dependency moves it, and what is on screen is that stale answer.
      //
      // **The split is by reactive context, not by "does it call"** — Phase
      // 2d-5-2b-C's finding 3. An `$effect` calls this method just as an imperative
      // caller does, so the old wording sorted it into the arm that pays nothing,
      // when in fact it never re-runs and is as stale as the derived; a template read
      // is a render effect and is the same case. The class is already written
      // correctly as "`$derived` or `$effect`" at the top of this same comment and
      // elsewhere in this file; the narrow wording was in the two sentences Phase
      // 2d-5-2b-B rewrote — this one and its twin in this door's JSDoc — and both
      // were corrected together. Nothing in TypeScript prevents the path; that is
      // item 9 of this step's "where it is thin", not a claim made here.
      void surfaceGeneration;
      return writeSurfaces.generation();
    }, // End of function writeSurfaceGeneration()

    externalDocumentStatus(document: DocumentId): ExternalDocumentStatus | null {
      // Reading the `$state` array is the dependency, exactly as
      // `openWriteSurfaces()` reads its mirror: a `$derived` that asks this
      // re-runs when a status is recorded or cleared.
      return externalStatuses.find((entry) => entry.document === document)?.status ?? null;
    }, // End of function externalDocumentStatus()

    externalPathDrift(): readonly ExternalPathDrift[] {
      return pathDrift;
    },

    reconciliationBlock(): ReconciliationBlock {
      // **The read is the dependency; the coordinator is the answer** — Phase
      // 2d-6-1c, the shape `openWriteSurfaces()` uses. Nothing is mirrored: the
      // value is still the coordinator's own, asked fresh, and reading the revision
      // first is what makes a `$derived` that asks this re-run when the block moves.
      // The sentence that stood here — *deliberately not mirrored into a signal*,
      // with 2d-6 named as the step to decide — is discharged this way rather than
      // by a copy, so there is no second value to keep in step.
      void reconciliationRevision;
      return reconciliation.block();
    }, // End of function reconciliationBlock()

    membershipReloadWanted(): boolean {
      void reconciliationRevision;
      return reconciliation.membershipReloadWanted();
    },

    reconciliationRevision(): number {
      return reconciliationRevision;
    },

    reconciliationWatchState(): ReconciliationWatchState {
      void reconciliationRevision;
      return reconciliation.watchState();
    },

    reconciliationRegistration(): ReconciliationRegistrationState {
      void reconciliationRevision;
      return sanitizedRegistration(reconciliation.registration());
    },

    requestMembershipReload(): WorkspaceReloadOutcome {
      // No question of its own: whether an observation asked for one is not a
      // condition of a person asking. The shared body holds the rechecks and the
      // reopen in one block.
      return reopenRetained('membership');
    },

    requestLostHistoryRecovery(): WorkspaceReloadOutcome {
      // One more question than the sibling — `notBlocked` — asked inside the same
      // block as the others: a `running` session has no hole to recover from, and a
      // stale press after the batch-driven recovery took the permitted reload must
      // not clear the window a second time.
      return reopenRetained('lostHistory');
    },

    async requestFileReread(document: DocumentId): Promise<FileRereadOutcome> {
      // **Asked once before the command, so a refusal costs nothing.** The same
      // function is asked again inside the guard below, immediately before the
      // installation and in its synchronous block, which is the recheck entry 32
      // requires; a guard that permits here and refuses there is recorded as an
      // installation refusal.
      const early = fileRereadRefusal(document);
      if (early !== null) {
        return { kind: 'refused', reason: early, at: 'request' };
      }
      // What the guard decided, when it was asked. `rereadUnderGuard` asks its
      // guard at most once per call and answers `null` for a refusal exactly as it
      // does for an installation, so the guard records its own answer here and the
      // arm below reads it back rather than inferring anything from `null`.
      let refusedAt: FileRereadRefusalReason | null = null;
      /**
       * Re-asks every guard immediately before the installation.
       *
       * @returns `true` when the answer may be installed.
       */
      const guard = (): boolean => {
        refusedAt = fileRereadRefusal(document);
        return refusedAt === null;
      };
      const failure = await rereadUnderGuard(document, guard);
      if (failure !== null) {
        return { kind: 'failed', failure };
      }
      // Read through a local of the wider type: TypeScript narrows `refusedAt` to
      // its initializer across the closure's assignment, and the comparison would
      // otherwise be against `null` alone.
      const refused: FileRereadRefusalReason | null = refusedAt;
      if (refused !== null) {
        return { kind: 'refused', reason: refused, at: 'installation' };
      }
      return { kind: 'completed' };
    } // End of function requestFileReread()
  };

  return state;

  /**
   * Puts a refused read on the developer channel and answers it unchanged.
   *
   * **Reported *and* answered**, which is the shape every read on this state uses
   * and the reason there is no second error path: the developer channel gets the
   * classified failure, and the caller gets the whole `CommandResult` back so the
   * refusal can be put on a session and drawn. Written once because the three
   * backup reads would otherwise each carry the rule, and a rule carried three
   * times is a rule two of them can lose.
   *
   * It is deliberately **not** an invalidation of anything. All three of its
   * callers read; none of them says anything about the projections, the selection
   * or the viewer's snapshot, so none of them touches them.
   *
   * @typeParam T - Whatever the command answers with.
   * @param answer - The result exactly as it crossed the boundary.
   * @returns That same result.
   */
  function reportedRead<T>(answer: CommandResult<T>): CommandResult<T> {
    if (!answer.ok) {
      report(answer.failure);
    }
    return answer;
  } // End of function reportedRead()

  /**
   * Re-reads a document whose bytes this state can no longer vouch for, and
   * re-points the selection.
   *
   * The projection is fetched rather than assumed: a commit invalidates every
   * identity this state holds for that file, and `views` still describes the bytes
   * that were replaced. `moved` is the identity the command minted in the new
   * revision, and it is `null` whenever the command could not establish one — or
   * whenever there is no such identity to have, which is the case for **a save
   * that failed after its rename**. In both cases the selection is repaired the
   * ordinary way, by looking for it.
   *
   * A re-read that itself fails is reported **and answered**, so a caller that
   * needs to know its window is out of step can be told. What this function does
   * *not* do about it is decide: leaving the stale projection in place is right for
   * a caller that only suspects a write, and dropping it is right for one that
   * knows a commit happened, so the choice belongs to the caller that knows which
   * it is. Both callers that know a commit happened —
   * `BrowserState.saveMatch` and, since 2c-3b-1, `BrowserState.moveMatch` — drop
   * it through {@link forgetTheReplacedDocument}. The `may_have_written` paths of
   * each call this with no target and **keep** whatever they find, because a
   * suspected write is not a commit.
   *
   * **The selection is re-pointed only when it is still the snippet that was
   * operated on**, which is the 2c-2 review's fourth finding. Without the `target`
   * comparison, a person who saved snippet A and clicked snippet B while the save
   * was in flight was dragged back to A when the answer landed — a selection this
   * window moved without being asked. Any other selection in the file is repaired
   * the ordinary way, positionally and then checked (R27).
   *
   * **And `moved` is resolved only in a projection of its own parse**, which is
   * 2c-3a-1's third finding: {@link positionInSameParse} compares all three fields,
   * so a file another program rewrote between the transaction's answer and this
   * read falls back to that same ordinary repair rather than adopting whatever now
   * occupies the arena node.
   *
   * **The attribution is honoured only against the parse the write produced.**
   * `requestedMove` and `requestedDuplicate` are claims — *the operation you
   * asked for changed this file* — and this function can only stand behind one
   * when the projection it just read is the revision the transaction ended on,
   * the one `moved` was minted in. A re-read that comes back with any other
   * revision found a file that changed *again* after the commit, so the repair
   * falls back to `externalChange`, whose sentences are the accurate ones there
   * (`docs/decisions/2c-3b-2-window-reading.md` section 5.3: the external
   * sentences are right when the file really was changed by another writer).
   * The same fallback covers a `moved` of `null`, where no revision can vouch
   * for the claim at all.
   *
   * @param document - The file that was, or may have been, written.
   * @param target - The identity the operation was about, as it was **before** the
   *   save, or `null` when there is none. Compared against the held selection.
   * @param moved - That snippet's identity in the new revision — the clone's,
   *   for a duplicate — or `null`.
   * @param attribution - Who a repair's notice says changed the file. Defaults
   *   to `externalChange`, so every caller that does not pass it — every writing
   *   wrapper except the **committed** adoptions of `BrowserState.moveMatch` and
   *   `BrowserState.duplicateMatch` — shows exactly what it showed before this
   *   argument existed.
   * @returns The failure of the re-read, or `null` when it succeeded.
   */
  async function adoptTheDocumentOnDisk(
    document: DocumentId,
    target: MatchId | null,
    moved: MatchId | null,
    attribution: RepairAttribution = 'externalChange'
  ): Promise<IpcFailure | null> {
    // **Both identities copied before the await**, and the locals below are what
    // the rest of this function uses — never the parameters. `target` is read by
    // the guard's last conjunct and `moved` by `positionInSameParse` *after* that
    // guard and before the `replaceSelection` it justifies, so a getter on either
    // would be arbitrary code inside exactly the window 2c-3c step 2's High was
    // closed to protect. Both arrive from a command's save answer.
    const ownedTarget = ownedIdentityOf(target);
    const ownedMoved = ownedIdentityOf(moved);
    const fresh = await commands.getDocument(document);
    if (!fresh.ok) {
      report(fresh.failure);
      return fresh.failure;
    }
    const next = ownedProjectionOf(fresh.value);
    installView(next);
    if (
      ownedMoved !== null &&
      selected !== null &&
      selected.document === document &&
      isTheSameIdentity(selected.id, ownedTarget)
    ) {
      // All three fields, against the projection just read: see
      // `positionInSameParse`. A `moved` from the save's revision must not be
      // resolved in a later parse that happens to reuse its node.
      const position = positionInSameParse(next, ownedMoved);
      if (position !== null) {
        replaceSelection(selectMatch(next, position));
        notice = null;
        return null;
      }
    }
    // The guard this function's JSDoc states: the requested attribution stands
    // only when this projection is the parse the write produced.
    const fromThisWrite =
      ownedMoved !== null &&
      next.id === ownedMoved.document &&
      next.revision === ownedMoved.revision;
    repairAfter(next, fromThisWrite ? attribution : 'externalChange');
    return null;
  } // End of function adoptTheDocumentOnDisk()

  /**
   * Re-reads a file a create wrote into, and points the selection at the new
   * snippet.
   *
   * The projection is fetched rather than assumed, exactly as
   * {@link adoptTheDocumentOnDisk} does: a commit invalidates every identity this
   * state holds for that file, and `views` still describes the bytes that were
   * replaced.
   *
   * **The two conditions on moving the selection are `BrowserState.createMatch`'s
   * own**, and they are stated in its JSDoc: the held selection must not have been
   * replaced since the call, and the sidebar must be showing a scope that contains
   * the new snippet. The first is a reference comparison rather than a field-by-
   * field one on purpose — `selected` is replaced whole by every path that changes
   * it, so identity is exactly the question "has anything moved it since?", and it
   * answers `true` for the ordinary case where nothing was selected at all.
   *
   * **A third condition is the file's rather than the person's**, and it is
   * 2c-3a-1's third finding: {@link positionInSameParse} resolves the created
   * identity only in a projection of the revision it was minted in, so a file
   * another program rewrote between the write and this read cannot make an
   * unrelated snippet look like the one just created.
   *
   * Anything else is repaired the ordinary way, positionally and then checked
   * (R27).
   *
   * @param document - The file that was written.
   * @param heldBefore - The selection this state held when the create started.
   * @param moved - The created snippet's identity in the new revision, or `null`.
   * @returns The failure of the re-read, or `null` when it succeeded.
   */
  async function adoptTheCreatedSnippet(
    document: DocumentId,
    heldBefore: SelectedMatch | null,
    moved: MatchId | null
  ): Promise<IpcFailure | null> {
    // Copied before the await, for `adoptTheDocumentOnDisk`'s reason: `moved` is
    // a command's object, and `positionInSameParse` reads it between the guard
    // below and the `replaceSelection` that guard justifies.
    const ownedMoved = ownedIdentityOf(moved);
    const fresh = await commands.getDocument(document);
    if (!fresh.ok) {
      report(fresh.failure);
      return fresh.failure;
    }
    const next = ownedProjectionOf(fresh.value);
    installView(next);
    const inScope = selection.kind === 'all' || selection.id === document;
    if (ownedMoved !== null && selected === heldBefore && inScope) {
      // The third condition, and it is about the *file* rather than the person:
      // `positionInSameParse` refuses a `moved` the fresh projection is not a
      // parse of, so a file another program rewrote between the write and the
      // read cannot hand this window an unrelated snippet as the one just made.
      const position = positionInSameParse(next, ownedMoved);
      if (position !== null) {
        replaceSelection(selectMatch(next, position));
        notice = null;
        return null;
      }
    } // End of the arm that selects the snippet the person has just made
    repairAfter(next);
    return null;
  } // End of function adoptTheCreatedSnippet()

  /**
   * Re-reads a file a duplicate wrote, and follows the clone only for an
   * initiating intent still standing **at the moment the selection is
   * written**.
   *
   * **The duplicate's own adoption, and the re-validation site is the whole
   * reason it exists** (review round 1's High finding, closed fully at its
   * confirmation pass). The rule every write to `selected` lives under is that
   * the justification is checked in the same synchronous block that performs
   * the write, re-validated after every `await` that precedes it —
   * `rereadDocument`'s three captures are the established shape. The first fix
   * validated the capture *between* the command's await and this function's
   * own, then reduced it to a target identity: a person who left the source
   * and returned **during this function's re-read** — or whose failed
   * `select()` bumped the intent counter without replacing the object — was
   * still reclaimed, because the helper compared only the current selection's
   * identity. So the capture now travels whole, and both halves are required
   * **here**, after the one await, immediately before `replaceSelection`:
   * the held object must still be the very selection that initiated the
   * duplicate, and the global `selectGeneration` must not have moved. There is
   * no await between the checks and the write, so nothing can invalidate a
   * justification that has been established.
   *
   * **`moved` is a separate argument because it is also the attribution's
   * voucher**: `requestedDuplicate` is honoured only when this projection is
   * the parse the write itself produced — `moved`'s own revision — and a
   * refused follow must not demote the person's committed copy to an external
   * change when the parse still vouches for it.
   *
   * **The no-follow path never leaves a stale identity selected** (the
   * 2c-3a-1 rule): the fresh projection is installed first, and
   * {@link repairAfter} either re-points the selection under an identity of
   * that projection or clears it with a notice, synchronously.
   *
   * @param document - The file that was written.
   * @param intent - The selection that initiated the duplicate — required to
   *   have been the source — with the intent generation it was captured at, or
   *   `null` when the source was not the initiating selection.
   * @param moved - The clone's identity in the new revision, or `null`.
   * @param attribution - Who a repair's notice says changed the file. Pass
   *   `requestedDuplicate` only for a commit.
   * @returns The failure of the re-read, or `null` when it succeeded.
   */
  async function adoptAfterTheDuplicate(
    document: DocumentId,
    intent: DuplicateIntent | null,
    moved: MatchId | null,
    attribution: RepairAttribution
  ): Promise<IpcFailure | null> {
    // Copied before the await, for `adoptTheDocumentOnDisk`'s reason.
    const ownedMoved = ownedIdentityOf(moved);
    const fresh = await commands.getDocument(document);
    if (!fresh.ok) {
      report(fresh.failure);
      return fresh.failure;
    }
    const next = ownedProjectionOf(fresh.value);
    installView(next);
    // **The justification, at the write.** Both halves re-validated after the
    // await above — the only await on this path — and no await separates them
    // from the `replaceSelection` they justify.
    //
    // **And no *property read on caller data* separates them either, which the
    // sentence above does not say and which is the half that was false.**
    // `CLAUDE.md` says a check and a spend separated by any property read are not
    // atomic, because a getter runs arbitrary code; `positionInSameParse` sits
    // between the conditions below and the write, and it walks every match's
    // `id.node`. Those are module-owned now — `ownedMatchIdOf` at the projection's
    // ingress and `ownedIdentityOf` above for the clone's own identity — so the
    // reads between the check and the spend run no code a command supplied.
    if (
      ownedMoved !== null &&
      intent !== null &&
      selected === intent.held &&
      selectGeneration === intent.generation
    ) {
      // All three fields, against the projection just read: a `moved` from the
      // save's revision must not be resolved in a later parse that happens to
      // reuse its node. See `positionInSameParse`.
      const position = positionInSameParse(next, ownedMoved);
      if (position !== null) {
        replaceSelection(selectMatch(next, position));
        notice = null;
        return null;
      }
    } // End of the arm that follows the clone for an unchanged intent
    // The guard `adoptTheDocumentOnDisk` states: the requested attribution
    // stands only when this projection is the parse the write produced.
    const fromThisWrite =
      ownedMoved !== null &&
      next.id === ownedMoved.document &&
      next.revision === ownedMoved.revision;
    repairAfter(next, fromThisWrite ? attribution : 'externalChange');
    return null;
  } // End of function adoptAfterTheDuplicate()

  /**
   * Re-reads a file a deletion wrote, and repairs the selection.
   *
   * **The one adoption that has no identity to adopt.** `moved` is `null`
   * permanently for a deletion — the snippet that was deleted has none in the new
   * revision, and filling that field with a neighbour's would put a position back
   * into the one field that exists to replace positions with identities — so this
   * function is handed the *selection that was deleted* instead, and only when the
   * held selection really was that snippet.
   *
   * **Why this is not the positional reasoning `moved: null` forbids.** Nothing
   * here preserves or re-resolves the stale identity: the projection is replaced
   * whole and the snippet selected is adopted under its **own new identity**,
   * minted by the read that has just happened. What separates it from R27's
   * `differentMatch` — where changed bytes at the held position drop the
   * selection with a notice — is that R27 is about a file that moved **under**
   * somebody, and this is the change they asked for. The notice is shown anyway,
   * because selecting a neighbour can still read as continuity with a snippet that
   * no longer exists (the consult's own counter-argument to its Q1).
   *
   * Any other selection in that file is repaired the ordinary way, and this
   * function does not hijack it.
   *
   * @param document - The file the snippet was deleted from.
   * @param deleted - The selection that was the deleted snippet, or `null` when
   *   the person had something else, or nothing, selected.
   * @returns The failure of the re-read, or `null` when it succeeded.
   */
  async function adoptAfterTheDeletion(
    document: DocumentId,
    deleted: SelectedMatch | null
  ): Promise<IpcFailure | null> {
    const fresh = await commands.getDocument(document);
    if (!fresh.ok) {
      report(fresh.failure);
      return fresh.failure;
    }
    const next = ownedProjectionOf(fresh.value);
    installView(next);
    if (deleted === null || selected !== deleted) {
      // Either the person was looking at another snippet all along, or they moved
      // the selection while the deletion was in flight. Both are ordinary repairs.
      repairAfter(next);
      return null;
    }
    // The former ordinal position, and the new last snippet when the deleted one
    // was last. `selectMatch` answers `null` for a file that now holds none, which
    // is the third case and needs no branch of its own.
    const at = Math.min(deleted.position, next.matches.length - 1);
    replaceSelection(at < 0 ? null : selectMatch(next, at));
    notice = 'deleted';
    return null;
  } // End of function adoptAfterTheDeletion()

  /**
   * Forgets everything this state holds about one document.
   *
   * **Total, and synchronous.** After a committed whole-document replacement the
   * file's projection, every identity minted from it and the raw viewer's
   * snapshot of its bytes are stale *at once*, so they go together and they go
   * before any `await` — an asynchronous invalidation has a window in which a
   * getter can still read the projections the commit destroyed, and `await` only
   * protects the code that comes after it.
   *
   * The selection is **dropped, not re-pointed**, and that is the difference from
   * {@link adoptTheDocumentOnDisk}: a move answers with the moved snippet's
   * identity in the new revision, and a replacement answers `moved: null`
   * permanently, so there is no identity to follow. What the selection *was* is
   * returned rather than kept, so that a caller which reads the file again can
   * look for it the ordinary way — positionally and then checked (R27) — without
   * this function holding a selection into a document it has just forgotten.
   *
   * @param document - The file whose cached state is stale.
   * @returns The selection that was held in that file, or `null`.
   */
  function forgetTheReplacedDocument(document: DocumentId): SelectedMatch | null {
    const held = selected !== null && selected.document === document ? selected : null;
    views = views.filter((view) => view.id !== document);
    // A `select()` in flight **against this document** describes a parse that no
    // longer exists, so its answer must not land after this. Scoped to the file
    // being dropped, exactly as `installView`'s is, and for the same finding: the
    // first fix round made this bump unconditional *and global*, which cancelled
    // lookups into files this call says nothing about. Unconditional it stays —
    // the branch below asks whether the **selection** is in this document, and a
    // generation asks whether a **lookup** is, which are different questions — but
    // it is now a question about one file rather than about all of them.
    invalidateProjectionOf(document);
    if (held !== null) {
      // A selection dropped is an intent replaced, so it cancels a lookup for any
      // document, which is `replaceSelection`'s own half of the rule.
      replaceSelection(null);
      notice = null;
    }
    if (fileTextDocument === document) {
      // The snapshot is of bytes that have just been replaced whole. Another
      // file's snapshot is untouched, because nothing about it changed.
      forgetFileText();
    }
    // **One text cache since 2c-4a-2, so the branch above is the whole of it.**
    // There used to be a second, keyed by document rather than by the viewer's
    // target, which this function had to reach separately or leave behind a text
    // for a file that had just been rewritten. It is gone with the second read
    // that filled it.
    return held;
  } // End of function forgetTheReplacedDocument()

  /**
   * The adoption and the re-read a committed match-level write owes, answered as
   * an {@link InvalidationStatus} and **never as an exception** — Phase 2d-6-7a,
   * the one post-commit policy of `saveMatch`, `createMatch`, `moveMatch`,
   * `deleteMatch` and `duplicateMatch` (`2d-6-6c-2-notes.md` §5 items 2 and 7).
   *
   * The transaction has written and its caller has already told the barrier so.
   * An exception out of the adoption or the re-read used to reject the wrapper's
   * promise, and a panel then drew a committed write as an error (`PROGRESS.md`
   * D2). Here it travels back as a `failed` adoption, beside the `saved` outcome:
   *
   * - an adoption that answers a failure drops the replaced projection, because
   *   everything this window holds for that file was minted from bytes that have
   *   been replaced;
   * - an exception thrown before the adoption answered drops it for the same
   *   reason; one thrown by the re-read after it keeps the new projection;
   * - a failure the adoption already answered is kept, never replaced;
   * - **the classification is guarded too** (Phase 2d-6-6c-2's review):
   *   `classifyFailure` reads `code` off the thrown value, so a getter that
   *   throws would escape the catch. Its fallback classifies a fixed string and
   *   never looks at the thrown value again.
   *
   * **What this forces**: no value thrown by `adopt` or by `readFileText` can
   * reject the caller. **What it does not force**: that `forgetTheReplacedDocument`,
   * which runs inside the catch, never throws — no type says so — and that a
   * caller routes its adoption through here rather than awaiting one bare.
   *
   * @param document - The file the commit wrote.
   * @param adopt - The wrapper's own adoption; answers the re-read's failure, or
   *   `null` when the new projection was installed.
   * @returns `done`, or `failed` with the failure the window could not recover
   *   from.
   */
  async function adoptAfterTheCommit(
    document: DocumentId,
    adopt: () => Promise<IpcFailure | null>
  ): Promise<InvalidationStatus> {
    let adoption: InvalidationStatus = { kind: 'notOwed' };
    try {
      const stale = await adopt();
      if (stale === null) {
        adoption = { kind: 'done' };
      } else {
        // **The commit happened and this window could not read the file back.**
        // A stale projection is not a smaller problem than an unprojected file,
        // it is the same problem told as a fact, so it is dropped.
        forgetTheReplacedDocument(document);
        adoption = { kind: 'failed', failure: stale };
      }
      await readFileText();
    } catch (raw: unknown) {
      if (adoption.kind === 'notOwed') {
        forgetTheReplacedDocument(document);
      }
      if (adoption.kind !== 'failed') {
        adoption = { kind: 'failed', failure: classifiedAfterTheCommit(raw) };
      }
    } // End of the post-commit adoption and re-read
    return adoption;
  } // End of function adoptAfterTheCommit()

  /**
   * Classifies a value thrown after a write answered, **never throwing itself**.
   *
   * `classifyFailure` in `../ipc/errors` reads `code` off the value it is given,
   * so a thrown value whose `code` getter throws escapes it (Phase 2d-6-6c-2's
   * review). The fallback classifies a fixed string and never looks at the
   * thrown value again. Shared since Phase 2d-6-8a by `adoptAfterTheCommit` and
   * the two post-answer paths of `saveRawDocument`, rather than held as three
   * copies of one rule.
   *
   * **What this forces**: the call returns an `IpcFailure` for any thrown value.
   * **What it does not force**: that a caller uses it rather than calling
   * `classifyFailure` bare inside its own catch.
   *
   * @param raw - Whatever was thrown.
   * @returns The failure, classified, or the fixed-string fallback.
   */
  function classifiedAfterTheCommit(raw: unknown): IpcFailure {
    try {
      return classifyFailure(raw);
    } catch {
      return classifyFailure('the exception after a committed save could not be classified');
    }
  } // End of function classifiedAfterTheCommit()

  /**
   * Reports a failure met after a write answered, **never throwing** — Phase
   * 2d-6-8a's review, its blocker.
   *
   * The reporter reads the failure again (the default, `reportIpcFailure` in
   * `../ipc/errors`, reads `failure.error.code`), and a thrown value the guarded
   * classifier accepted as a command error on one read of `code` can throw on the
   * next. A report is diagnostic, so an exception out of it is dropped rather
   * than allowed to turn a written file's answer into an error. **What this
   * forces**: the call returns for any failure and any reporter. **What it does
   * not force**: that the report was delivered — a reporter that threw reported
   * nothing, and nothing says so.
   *
   * @param failure - The failure, already classified.
   */
  function reportedQuietly(failure: IpcFailure): void {
    try {
      report(failure);
    } catch {
      // Deliberately empty: see the doc above.
    }
  } // End of function reportedQuietly()

  /**
   * Forgets a replaced document and reads it again.
   *
   * The whole invalidation a committed raw save owes, in the module that owns the
   * cache. The forgetting is unconditional; the re-read is what keeps the window
   * from going blank, and a re-read that itself fails is reported and leaves the
   * file unprojected — this state cannot describe a file it could not read, and
   * blanking the workspace over one file would be a bigger claim than the failure
   * supports.
   *
   * **The failure is answered as well as reported**, which is the 2c-1b review's
   * third finding. A committed save this window could not re-project leaves the
   * person looking at a screen that is out of step with a file that really was
   * rewritten, and returning `void` left that fact with nowhere to go but the
   * developer console. It is still not an error: the caller carries it *beside*
   * the committed outcome and never in place of one.
   *
   * @param document - The file whose whole text was replaced.
   * @returns The failure of the re-read, or `null` when it succeeded.
   */
  async function adoptTheReplacedDocument(document: DocumentId): Promise<IpcFailure | null> {
    const held = forgetTheReplacedDocument(document);
    const fresh = await commands.getDocument(document);
    if (!fresh.ok) {
      report(fresh.failure);
      return fresh.failure;
    }
    const next = ownedProjectionOf(fresh.value);
    installView(next);
    if (held !== null) {
      // Positional, and then checked. `reresolve` answers `differentMatch` when
      // the snippet at the held position is not the one that was selected, which
      // after a whole-text replacement is the expected answer rather than the
      // surprising one.
      const found = reresolve(held, next);
      if (found.outcome === 'sameMatch') {
        replaceSelection(found.selected);
        notice = 'kept';
      } else {
        notice = found.outcome;
      }
    }
    await readFileText();
    return null;
  } // End of function adoptTheReplacedDocument()

  /**
   * The notice a repair raises when the selection was found again.
   *
   * One place for the mapping rather than a ternary per caller, because the
   * attribution grew a third value at 2c-3c-2 and a swapped pair of literals
   * would tell the person their duplicate reordered the file.
   *
   * @param attribution - Who the repair's notice credits.
   * @returns The notice for a kept selection.
   */
  function keptNoticeFor(attribution: RepairAttribution): SelectionNotice {
    switch (attribution) {
      case 'requestedMove':
        return 'keptAfterMove';
      case 'requestedDuplicate':
        return 'keptAfterDuplicate';
      case 'externalChange':
        return 'kept';
    }
  } // End of function keptNoticeFor()

  /**
   * The notice a repair raises when the held position now holds another
   * snippet.
   *
   * @param attribution - Who the repair's notice credits.
   * @returns The notice for a displaced selection.
   */
  function displacedNoticeFor(attribution: RepairAttribution): SelectionNotice {
    switch (attribution) {
      case 'requestedMove':
        return 'displacedByMove';
      case 'requestedDuplicate':
        return 'displacedByDuplicate';
      case 'externalChange':
        return 'differentMatch';
    }
  } // End of function displacedNoticeFor()

  /**
   * Puts the selection back in a projection that has just replaced the one it
   * was made against.
   *
   * `reresolve` is positional **and then checks**: bytes at the held position
   * that are not the bytes that were selected are `differentMatch` and drop the
   * selection with a notice, never a silent re-point (`PROGRESS.md` R27). **The
   * arm names byte inequality and not an identity** — the same snippet edited in
   * place by another program lands here too, which is 2c-4b-3c-2 §11.3, and the
   * two attributed arms below are the exception because their revision guard
   * makes the parse the committed operation's own. After a move that is the
   * expected answer for every selection except the moved one, which
   * {@link adoptTheDocumentOnDisk} has already re-pointed by identity — and
   * after a duplicate it is the routine answer for every selection below the
   * source, which the insertion shifted down by one.
   *
   * **The attribution changes the sentence, never the repair.** What is kept,
   * dropped or re-pointed is identical under all three values; only which
   * notice is raised differs. The parameter defaults to `externalChange`, so
   * every caller that does not pass it shows exactly what it showed before this
   * argument existed — the fix shape `docs/decisions/2c-3b-1-notes.md` section
   * 5.2 prescribes, an argument threaded from the adoption rather than a swap
   * made here. `gone` keeps the external sentence under every attribution: a
   * move never changes its sequence's length and a duplicate only grows it, so
   * a vanished position means something other than the asked-for operation also
   * happened, and the sentence that claims less wins.
   *
   * @param view - The projection now in place.
   * @param attribution - Who the notice says changed the file. Pass
   *   `requestedMove` or `requestedDuplicate` only for a repair against the
   *   parse the committed operation itself produced.
   */
  function repairAfter(
    view: DocumentView,
    attribution: RepairAttribution = 'externalChange'
  ): void {
    if (selected === null || selected.document !== view.id) {
      return;
    }
    const found = reresolve(selected, view);
    if (found.outcome === 'sameMatch') {
      replaceSelection(found.selected);
      notice = keptNoticeFor(attribution);
      return;
    }
    replaceSelection(null);
    notice =
      found.outcome === 'differentMatch' ? displacedNoticeFor(attribution) : found.outcome;
  } // End of function repairAfter()
} // End of function createBrowserState()
