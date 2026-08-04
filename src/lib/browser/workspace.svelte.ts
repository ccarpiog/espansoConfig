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
  getDocument,
  getMatch,
  listDocuments,
  moveMatch,
  openWorkspace,
  reloadDocument,
  saveMatch,
  saveRawDocument
} from '../ipc/commands';
import type {
  CommandResult,
  RawSaveOutcome,
  RawSaveReload,
  ReloadAfterRawSave
} from '../ipc/commands';
import { mayHaveWritten, reportIpcFailure } from '../ipc/errors';
import type { IpcFailure } from '../ipc/errors';
import type {
  Acknowledgement,
  ContentRevision,
  DocumentId,
  DocumentSummary,
  DocumentView,
  MatchDraft,
  MatchId,
  MatchView,
  NewMatch,
  NewMatchPosition,
  SaveResult,
  WorkspaceSummary
} from '../ipc/types';
import {
  sealWholeDocumentSave,
  type InvalidationStatus,
  type SealedWholeDocumentSave
} from './invalidation';
import type { RepairAttribution, SelectionNotice } from './notices';
import { documentTextState, rawTarget, type RawDocumentText } from './rawDocument';
import { filterMatches } from './search';
import type { SelectedMatch, SelectionRepair } from './selection';
import { positionOf, repairSelection, reresolve, selectMatch } from './selection';
import type { SidebarModel, SidebarSelection } from './sidebar';
import { ALL_DOCUMENTS, buildSidebar, holdsMatches, sameSelection } from './sidebar';

/**
 * The commands the browser needs, as one injectable object.
 *
 * The six read-only commands of `../ipc/commands`, with the same signatures, and
 * — since Phase 2b-2a — the ones that write. {@link BrowserCommands.moveMatch},
 * {@link BrowserCommands.saveMatch}, {@link BrowserCommands.createMatch},
 * {@link BrowserCommands.deleteMatch} and
 * {@link BrowserCommands.saveRawDocument} are the five members that can change a
 * file on disk, and they are here for the same reason the others are: a test that
 * cannot run Tauri still has to be able to drive a refusal, a conflict and a
 * commit and watch what this state does about each.
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
   * @param newMatch - What the new snippet says: a trigger and a body, both
   *   required.
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
  saveRawDocument
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
   * What this window last read of **one named document's** text, or `null`.
   *
   * {@link BrowserState.fileText} answers about whatever the viewer is pointed at,
   * which is the wrong question for the raw editor: an editor open on file A must
   * be able to show and to load the version on disk for **A** even when the rest
   * of the window has moved to file B. That is the 2c-1b review's fifth finding —
   * without it, a conflict on A while the pane points elsewhere leaves *Reload
   * disk version* permanently disabled, losing one of the eight requirements of
   * `docs/decisions/2c-split-notes.md` section 6.
   *
   * Two sources, in this order: the text captured when a save of that document
   * **conflicted**, which is the version that refused the save and therefore the
   * one the conflict is about; and otherwise the viewer's own snapshot, when the
   * viewer happens to hold that document. `null` when this window holds neither.
   *
   * A method rather than a field because the question names a document. It reads
   * reactive state, so a `$derived` over it re-runs when either source moves.
   *
   * @param document - The file to ask about.
   * @returns What this window holds of that file's text, or `null`.
   */
  rawTextOf(document: DocumentId): RawDocumentText | null;
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
   * so a different snippet at the held position drops it with a notice (R27) rather
   * than being silently adopted. The raw viewer's snapshot and any captured
   * conflict text for that file go too, because they describe bytes this state has
   * just stopped vouching for.
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
   * projection, the two text caches and the selection move together, which is the
   * invariant `installView` exists for.
   *
   * @param document - The file to read again.
   * @returns The failure of the read, or `null` when it did not fail.
   */
  rereadDocument(document: DocumentId): Promise<IpcFailure | null>;
  /**
   * Moves one snippet inside the list it is in, and saves the file.
   *
   * **The first of the five entry points on this state that change a file**; the
   * others are {@link BrowserState.saveMatch},
   * {@link BrowserState.createMatch}, {@link BrowserState.deleteMatch} and
   * {@link BrowserState.saveRawDocument}. Everything else here reads.
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
   * @param newMatch - What the new snippet says: a trigger and a body.
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
   *   case — where a different snippet at the held position drops the selection —
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
}

/**
 * Builds the browser state over a set of commands.
 *
 * @param commands - The IPC surface to drive; defaults to the real one.
 * @param report - Where a failure goes for the developer; defaults to the
 *   console reporter of `../ipc/errors`.
 * @returns Reactive state a component can read directly.
 */
export function createBrowserState(
  commands: BrowserCommands = REAL_COMMANDS,
  report: (failure: IpcFailure) => void = reportIpcFailure
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
  // The disk text of a document whose save conflicted, kept **by document** and
  // not by whatever the viewer is pointed at. The conflict UI has to be able to
  // offer the version on disk for the file being edited even when the rest of the
  // window has moved somewhere else, which is the review's fifth finding.
  let conflictText = $state<{
    readonly document: DocumentId;
    readonly answer: CommandResult<string>;
  } | null>(null);

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
  } // End of function invalidateProjectionOf()

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
   * The file the raw viewer would show right now.
   *
   * A function rather than a copy of the same call at every use: the getter, the
   * read and every entry point that can move the target — a sidebar click, a
   * snippet click, a cleared selection and a repair that clears one — all need
   * the same answer, and the decision itself is `rawTarget`'s in
   * `./rawDocument.ts`.
   *
   * @returns The file, or `null` when nothing names one.
   */
  function fileTextTarget(): DocumentSummary | null {
    return rawTarget(selection, documents, selected);
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
   * Drops the disk text captured for one document, when it is that document's.
   *
   * **The second text cache, and the one `forgetFileText` cannot reach.**
   * `conflictText` is keyed by document rather than by whatever the viewer is
   * pointed at — that is the whole reason it exists — so forgetting the viewer's
   * snapshot leaves it untouched, and `rawTextOf` prefers it. The 2c-2 confirmation
   * pass found the consequence: a raw save that conflicted captured version A, a
   * later field save committed version B, and `rawTextOf` still answered A. Nothing
   * on screen would have said the text was two writes old.
   *
   * Another document's capture is left alone, because nothing about it changed.
   *
   * @param document - The file whose captured text can no longer be vouched for.
   */
  function forgetConflictText(document: DocumentId): void {
    if (conflictText !== null && conflictText.document === document) {
      conflictText = null;
    }
  } // End of function forgetConflictText()

  /**
   * Drops **every** text this window holds that could be about one document.
   *
   * There are two caches and they are keyed differently — the viewer's snapshot by
   * whatever it is pointed at, the conflict capture by document — so "forget this
   * file's text" is two calls and was one until the 2c-2 confirmation pass. A call
   * site that makes the second question answerable and only asks the first leaves a
   * text behind that `rawTextOf` will happily serve.
   *
   * The viewer's half is dropped unconditionally rather than only when it names
   * this document, which is what `forgetFileText` has always done: it also cancels
   * a read in flight, and a read in flight for another file is cheap to retake.
   *
   * @param document - The file whose bytes this window can no longer vouch for.
   */
  function forgetTextOf(document: DocumentId): void {
    forgetFileText();
    forgetConflictText(document);
  } // End of function forgetTextOf()

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

  return {
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

    rawTextOf(document: DocumentId): RawDocumentText | null {
      const captured = conflictText;
      if (captured !== null && captured.document === document) {
        return documentTextState(captured.answer);
      }
      // The viewer's own snapshot, and only when it is really about this file.
      // `loading` is deliberately not answered here: a read in flight for the
      // viewer says nothing about a document the caller named, and a caller that
      // is not the viewer has no reason to be told to wait for it.
      return fileTextDocument === document && fileTextAnswer !== null
        ? documentTextState(fileTextAnswer)
        : null;
    }, // End of function rawTextOf()

    async open(root: string | null): Promise<void> {
      const generation = ++openGeneration;
      // A selection into the workspace being replaced can never be applied to
      // the one replacing it, so every pending `select()` is invalidated here —
      // globally, which is right because *every* projection is about to go.
      selectGeneration += 1;
      // And the per-document counters are about documents of the workspace being
      // closed. Their identities are reallocated by the load below, so an entry
      // kept here would be a count of replacements of a different file. Clearing
      // cannot un-cancel anything: the bump above has already invalidated every
      // lookup that could have read one.
      projectionGenerations.clear();

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
      // The viewer closes with the workspace: it is showing one file's text,
      // and every identity in the workspace being replaced is about to be
      // reallocated. `forgetFileText` also invalidates the read in flight,
      // which describes a file this state is about to stop knowing about.
      fileTextShown = false;
      forgetFileText();

      const opened = await commands.openWorkspace(root);
      if (generation !== openGeneration) {
        return;
      }
      if (!opened.ok) {
        fail(opened.failure);
        return;
      }
      summary = opened.value;

      const listed = await commands.listDocuments();
      if (generation !== openGeneration) {
        return;
      }
      if (!listed.ok) {
        fail(listed.failure);
        return;
      }
      documents = listed.value;

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
          projected.push(view.value);
        } else {
          // Both channels: the console for the developer, the state for the
          // user, who is otherwise reading a total that silently omits a file.
          // The identity goes with the failure so the file's own row can say
          // "could not be read" rather than "not read yet".
          refused.push({ document: document.id, failure: view.failure });
          report(view.failure);
        }
      } // End of the loop over every document of the workspace
      views = projected;
      loadFailures = refused;
      status = 'ready';
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
      const repair = await repairSelection(next, resolved.failure, commands.reloadDocument);
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

    async rereadDocument(document: DocumentId): Promise<IpcFailure | null> {
      // **Three captures, taken before the await, exactly as every other
      // asynchronous path in this module takes its own.** The first review of step
      // 2 found this call awaiting with none of them, which is how an older read
      // installs a projection over newer state:
      //
      // - `openGeneration`, because a workspace that has been replaced reallocates
      //   every document identity, and a projection from the closed one installed
      //   into the open one describes a file this state is not showing.
      //   **Neither per-document counter can stand in for it, and they fail for
      //   opposite reasons**: `open()` *clears* `projectionGenerations`, so a file
      //   whose projection had never been replaced compares equal across the two
      //   workspaces; while `rereadGenerations` is deliberately monotonic and
      //   `open()` leaves it alone (its own comment at its declaration says so),
      //   so it goes on counting through a replacement and never encodes which
      //   workspace a read belonged to. Only `openGeneration` separates them;
      // - the re-read generation, so that of two overlapping reads of this file the
      //   **newer** one wins whichever order the answers arrive in;
      // - the projection generation, so that a projection installed by any other
      //   path meanwhile — an adoption after a save, a repair inside `select()` —
      //   is not overwritten by a read that started before it.
      const opened = openGeneration;
      const reread = nextRereadOf(document);
      const projection = projectionGenerationOf(document);
      const fresh = await commands.reloadDocument(document);
      if (!fresh.ok) {
        // Answered and reported whether or not this read is still the wanted one: a
        // failed read installs nothing, so there is no state to protect here, and
        // the failure is a true statement about the attempt the caller made.
        report(fresh.failure);
        return fresh.failure;
      }
      if (
        opened !== openGeneration ||
        reread !== rereadGenerations.get(document) ||
        projection !== projectionGenerationOf(document)
      ) {
        // Nothing is installed and nothing is forgotten. The caller is answered
        // `null` because this read did not fail — what happened is that the window
        // moved on, and it moved on by reading this file again or by dropping the
        // workspace whole, so nobody is left holding the parse this answer would
        // have replaced.
        return null;
      }
      // The two text caches go with the projection, for `installView`'s own
      // reason one level down: a snapshot taken against the parse being replaced
      // draws bytes from one revision beside a snippet list drawn from another.
      // `installView` drops the viewer's when it is pointed at this file;
      // `forgetTextOf` also reaches the conflict capture, which is keyed by
      // document and which `installView` cannot see.
      forgetTextOf(document);
      installView(fresh.value);
      repairAfter(fresh.value);
      await readFileText();
      return null;
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
        report(answer.failure);
        const written = mayHaveWritten(answer.failure);
        if (written) {
          forgetTextOf(match.document);
          await adoptTheDocumentOnDisk(match.document, null, null);
          await readFileText();
        }
        return { kind: 'failed', mayHaveWritten: written, failure: answer.failure };
      }

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
          // Both text caches, not only the viewer's snapshot: `forgetFileText`
          // alone left a conflict capture for this same file in place, which
          // `rawTextOf` would then serve for bytes that have just been replaced.
          // The identical omission the 2c-2 confirmation pass found in `saveMatch`.
          forgetTextOf(match.document);
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
          const stale = await adoptTheDocumentOnDisk(
            match.document,
            match,
            answer.value.moved,
            answer.value.committed ? 'requestedMove' : 'externalChange'
          );
          if (stale === null) {
            adoption = { kind: 'done' };
          } else {
            // **The commit happened and this window could not read the file back.**
            // Everything it holds for that file was minted from bytes that have
            // been replaced, so it is dropped rather than left on screen: a stale
            // projection is not a smaller problem than an unprojected file, it is
            // the same problem told as a fact. The failure travels back beside the
            // committed outcome, never in place of it (`PROGRESS.md` D2).
            forgetTheReplacedDocument(match.document);
            adoption = { kind: 'failed', failure: stale };
          }
          await readFileText();
        }
      } else if (answer.value.outcome === 'conflict') {
        // Nothing was written, and the command has already refreshed its own
        // cache from the disk. Taking the projection it handed back keeps this
        // state describing the same bytes the next save will be checked against.
        // The viewer's snapshot is of the bytes the *caller* read, which are not
        // the ones on disk, so it goes too — and so does an earlier capture of
        // that file's text, which describes bytes older still.
        forgetTextOf(match.document);
        installView(answer.value.disk);
        repairAfter(answer.value.disk);
        await readFileText();
      }
      return { kind: 'answered', result: answer.value, adoption };
    }, // End of function moveMatch()

    async saveMatch(
      id: MatchId,
      draft: MatchDraft,
      baseRevision: ContentRevision,
      acknowledgement: Acknowledgement
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
      const answer = await commands.saveMatch(
        id,
        draft,
        // **The caller's, unchanged**, and never `view.revision`: see this method's
        // JSDoc. Reading the projection here rebases a draft the window has moved
        // on from, and turns the conflict that should stop it into a commit. The
        // `view` lookup above stays, because without a projection this state can
        // neither adopt what a commit produces nor tell whether its own projection
        // went out of date.
        baseRevision,
        acknowledgement
      );
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
        report(answer.failure);
        const written = mayHaveWritten(answer.failure);
        if (written) {
          forgetTextOf(id.document);
          await adoptTheDocumentOnDisk(id.document, null, null);
          await readFileText();
        }
        return { kind: 'failed', mayHaveWritten: written, failure: answer.failure };
      }

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
          forgetTextOf(id.document);
          // **The adoption the consult's Q6 asks for**, performed here so that a
          // caller cannot obtain this result without it. `moved` is the snippet's
          // identity in the new revision, and the selection follows it — but only
          // when the selection is still the snippet that was saved, which is the
          // review's fourth finding: a person who clicked another snippet while the
          // save was in flight must not be dragged back to this one.
          const stale = await adoptTheDocumentOnDisk(id.document, id, answer.value.moved);
          if (stale === null) {
            adoption = { kind: 'done' };
          } else {
            // **The commit happened and this window could not read the file back.**
            // Everything it holds for that file was minted from bytes that have been
            // replaced, so it is dropped rather than left on screen: a stale
            // projection is not a smaller problem than an unprojected file, it is
            // the same problem told as a fact. The failure travels back beside the
            // committed outcome, never in place of it (`PROGRESS.md` D2).
            forgetTheReplacedDocument(id.document);
            adoption = { kind: 'failed', failure: stale };
          }
          await readFileText();
        }
      } else if (answer.value.outcome === 'conflict') {
        // Nothing was written, and the command has already refreshed its own cache
        // from the disk. Taking the projection it handed back keeps this state
        // describing the same bytes the next save will be checked against — and an
        // earlier capture of that file's text describes bytes older still.
        forgetTextOf(id.document);
        installView(answer.value.disk);
        repairAfter(answer.value.disk);
        await readFileText();
      }
      return { kind: 'answered', result: answer.value, adoption };
    }, // End of function saveMatch()

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
        report(answer.failure);
        const written = mayHaveWritten(answer.failure);
        if (written) {
          forgetTextOf(document);
          await adoptTheDocumentOnDisk(document, null, null);
          await readFileText();
        }
        return { kind: 'failed', mayHaveWritten: written, failure: answer.failure };
      }

      let adoption: InvalidationStatus = { kind: 'notOwed' };
      if (answer.value.outcome === 'saved') {
        // A `committed: false` is a documented success and is very nearly
        // unreachable for an insertion; the second half of the test is the one
        // that matters here, as it does for a move: a revision the transaction
        // ended on that is not the one this state was projecting is a file some
        // other program changed under the lock's two reads.
        const outOfDate = answer.value.committed || answer.value.revision !== view.revision;
        if (outOfDate) {
          forgetTextOf(document);
          const stale = await adoptTheCreatedSnippet(document, heldBefore, answer.value.moved);
          if (stale === null) {
            adoption = { kind: 'done' };
          } else {
            // The commit happened and this window could not read the file back, so
            // everything it holds for that file was minted from bytes that have
            // been replaced. It is dropped rather than left on screen, and the
            // failure travels back beside the committed outcome (`PROGRESS.md` D2).
            forgetTheReplacedDocument(document);
            adoption = { kind: 'failed', failure: stale };
          }
          await readFileText();
        }
      } else if (answer.value.outcome === 'conflict') {
        // Nothing was written, and the command has already refreshed its own cache
        // from the disk. Taking the projection it handed back keeps this state
        // describing the bytes the next attempt will be checked against.
        forgetTextOf(document);
        installView(answer.value.disk);
        repairAfter(answer.value.disk);
        await readFileText();
      }
      return { kind: 'answered', result: answer.value, adoption };
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
      const answer = await commands.deleteMatch(id, baseRevision, acknowledgement);
      if (!answer.ok) {
        report(answer.failure);
        const written = mayHaveWritten(answer.failure);
        if (written) {
          forgetTextOf(id.document);
          await adoptTheDocumentOnDisk(id.document, null, null);
          await readFileText();
        }
        return { kind: 'failed', mayHaveWritten: written, failure: answer.failure };
      }

      let adoption: InvalidationStatus = { kind: 'notOwed' };
      if (answer.value.outcome === 'saved') {
        const outOfDate = answer.value.committed || answer.value.revision !== view.revision;
        if (outOfDate) {
          forgetTextOf(id.document);
          const stale = await adoptAfterTheDeletion(id.document, heldBefore);
          if (stale === null) {
            adoption = { kind: 'done' };
          } else {
            forgetTheReplacedDocument(id.document);
            adoption = { kind: 'failed', failure: stale };
          }
          await readFileText();
        }
      } else if (answer.value.outcome === 'conflict') {
        forgetTextOf(id.document);
        installView(answer.value.disk);
        repairAfter(answer.value.disk);
        await readFileText();
      }
      return { kind: 'answered', result: answer.value, adoption };
    }, // End of function deleteMatch()

    async saveRawDocument(
      document: DocumentId,
      baseRevision: ContentRevision,
      text: string,
      acknowledgement: Acknowledgement
    ): Promise<RawSaveAnswer> {
      // A capture from an earlier conflict describes a file this call is about to
      // move on from, so it goes before anything else does.
      conflictText = null;
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
      let reprojection: IpcFailure | null = null;
      const invalidate: ReloadAfterRawSave = async (invalidation) => {
        reprojection = await adoptTheReplacedDocument(invalidation.document);
      };
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
        report(answer.failure);
        const written = mayHaveWritten(answer.failure);
        if (written) {
          await adoptTheReplacedDocument(document);
        }
        return { kind: 'failed', mayHaveWritten: written };
      }
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
      if (answer.value.outcome === 'conflict') {
        // Nothing was written, and the command has already refreshed its own
        // cache from the disk. Same handling as a conflicted move: adopt the
        // projection it handed back, so this state describes the bytes the next
        // save will be checked against.
        forgetFileText();
        installView(answer.value.disk);
        repairAfter(answer.value.disk);
        await readFileText();
        await captureTheDiskText(document);
      }
      // Sealed here and nowhere else: this is the one place that knows which
      // document was aimed at, what the transaction answered, and what this
      // state's own invalidation made of it.
      return { kind: 'sealed', sealed: sealWholeDocumentSave(document, answer.value, invalidated) };
    } // End of function saveRawDocument()
  };

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
   * `requestedMove` is a claim — *the move you asked for reordered this file* —
   * and this function can only stand behind it when the projection it just read
   * is the revision the transaction ended on, the one `moved` was minted in. A
   * re-read that comes back with any other revision found a file that changed
   * *again* after the commit, so the repair falls back to `externalChange`,
   * whose sentences are the accurate ones there
   * (`docs/decisions/2c-3b-2-window-reading.md` section 5.3: the external
   * sentences are right when the file really was changed by another writer).
   * The same fallback covers a `moved` of `null`, where no revision can vouch
   * for the claim at all.
   *
   * @param document - The file that was, or may have been, written.
   * @param target - The identity the operation was about, as it was **before** the
   *   save, or `null` when there is none. Compared against the held selection.
   * @param moved - That snippet's identity in the new revision, or `null`.
   * @param attribution - Who a repair's notice says reordered the file. Defaults
   *   to `externalChange`, so every caller that does not pass it — every writing
   *   wrapper except `BrowserState.moveMatch` — shows exactly what it showed
   *   before this argument existed.
   * @returns The failure of the re-read, or `null` when it succeeded.
   */
  async function adoptTheDocumentOnDisk(
    document: DocumentId,
    target: MatchId | null,
    moved: MatchId | null,
    attribution: RepairAttribution = 'externalChange'
  ): Promise<IpcFailure | null> {
    const fresh = await commands.getDocument(document);
    if (!fresh.ok) {
      report(fresh.failure);
      return fresh.failure;
    }
    installView(fresh.value);
    if (
      moved !== null &&
      selected !== null &&
      selected.document === document &&
      isTheSameIdentity(selected.id, target)
    ) {
      // All three fields, against the projection just read: see
      // `positionInSameParse`. A `moved` from the save's revision must not be
      // resolved in a later parse that happens to reuse its node.
      const position = positionInSameParse(fresh.value, moved);
      if (position !== null) {
        replaceSelection(selectMatch(fresh.value, position));
        notice = null;
        return null;
      }
    }
    // The guard this function's JSDoc states: the requested attribution stands
    // only when this projection is the parse the write produced.
    const fromThisWrite =
      moved !== null && fresh.value.id === moved.document && fresh.value.revision === moved.revision;
    repairAfter(fresh.value, fromThisWrite ? attribution : 'externalChange');
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
    const fresh = await commands.getDocument(document);
    if (!fresh.ok) {
      report(fresh.failure);
      return fresh.failure;
    }
    installView(fresh.value);
    const inScope = selection.kind === 'all' || selection.id === document;
    if (moved !== null && selected === heldBefore && inScope) {
      // The third condition, and it is about the *file* rather than the person:
      // `positionInSameParse` refuses a `moved` the fresh projection is not a
      // parse of, so a file another program rewrote between the write and the
      // read cannot hand this window an unrelated snippet as the one just made.
      const position = positionInSameParse(fresh.value, moved);
      if (position !== null) {
        replaceSelection(selectMatch(fresh.value, position));
        notice = null;
        return null;
      }
    } // End of the arm that selects the snippet the person has just made
    repairAfter(fresh.value);
    return null;
  } // End of function adoptTheCreatedSnippet()

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
   * `differentMatch` — where a different snippet at the held position drops the
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
    installView(fresh.value);
    if (deleted === null || selected !== deleted) {
      // Either the person was looking at another snippet all along, or they moved
      // the selection while the deletion was in flight. Both are ordinary repairs.
      repairAfter(fresh.value);
      return null;
    }
    // The former ordinal position, and the new last snippet when the deleted one
    // was last. `selectMatch` answers `null` for a file that now holds none, which
    // is the third case and needs no branch of its own.
    const at = Math.min(deleted.position, fresh.value.matches.length - 1);
    replaceSelection(at < 0 ? null : selectMatch(fresh.value, at));
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
    // **Both text caches, because this function claims to be total for one
    // document.** The conflict capture is keyed by document rather than by the
    // viewer's target, so the branch above cannot reach it, and a capture left
    // behind here is a text `rawTextOf` would serve for a file that has just been
    // rewritten. The 2c-2 confirmation pass found the same omission in `saveMatch`.
    forgetConflictText(document);
    return held;
  } // End of function forgetTheReplacedDocument()

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
    installView(fresh.value);
    if (held !== null) {
      // Positional, and then checked. `reresolve` answers `differentMatch` when
      // the snippet at the held position is not the one that was selected, which
      // after a whole-text replacement is the expected answer rather than the
      // surprising one.
      const found = reresolve(held, fresh.value);
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
   * Keeps the disk text of a document whose save conflicted, by that document.
   *
   * **Not the viewer's snapshot.** The raw editor may be open on file A while the
   * rest of the window points at file B, and the conflict state has to be able to
   * show the version on disk for A and to offer to load it — the fifth of the
   * eight requirements of `docs/decisions/2c-split-notes.md` section 6. Keying on
   * the viewer's target loses that affordance the moment the person clicks
   * elsewhere, which is the 2c-1b review's fifth finding.
   *
   * The viewer's own answer is reused when it happens to be about the same file,
   * so the ordinary case costs no second read; the second read happens only when
   * the window really is looking somewhere else.
   *
   * @param document - The file whose save conflicted.
   */
  async function captureTheDiskText(document: DocumentId): Promise<void> {
    if (fileTextDocument === document && fileTextAnswer !== null) {
      conflictText = { document, answer: fileTextAnswer };
      return;
    }
    const answer = await commands.documentText(document);
    conflictText = { document, answer };
    if (!answer.ok) {
      // The typed refusal is what the conflict state draws in place of the disk
      // version, and the developer sees it on the one channel every other failure
      // of this state uses.
      report(answer.failure);
    }
  } // End of function captureTheDiskText()

  /**
   * Puts the selection back in a projection that has just replaced the one it
   * was made against.
   *
   * `reresolve` is positional **and then checks**: a different snippet at the
   * held position is `differentMatch` and drops the selection with a notice,
   * never a silent re-point (`PROGRESS.md` R27). After a move that is the
   * expected answer for every selection except the moved one, which
   * {@link adoptTheDocumentOnDisk} has already re-pointed by identity.
   *
   * **The attribution changes the sentence, never the repair.** What is kept,
   * dropped or re-pointed is identical under both values; only which notice is
   * raised differs. The parameter defaults to `externalChange`, so every caller
   * that does not pass it shows exactly what it showed before this argument
   * existed — the fix shape `docs/decisions/2c-3b-1-notes.md` section 5.2
   * prescribes, an argument threaded from the adoption rather than a swap made
   * here. `gone` keeps the external sentence under both attributions: a move
   * within one sequence never changes its length, so a vanished position means
   * something other than the move also happened, and the sentence that claims
   * less wins.
   *
   * @param view - The projection now in place.
   * @param attribution - Who the notice says reordered the file. Pass
   *   `requestedMove` only for a repair against the parse a committed move
   *   produced.
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
      notice = attribution === 'requestedMove' ? 'keptAfterMove' : 'kept';
      return;
    }
    replaceSelection(null);
    notice =
      attribution === 'requestedMove' && found.outcome === 'differentMatch'
        ? 'displacedByMove'
        : found.outcome;
  } // End of function repairAfter()
} // End of function createBrowserState()
