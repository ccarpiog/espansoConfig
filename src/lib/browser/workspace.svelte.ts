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
  documentText,
  getDocument,
  getMatch,
  listDocuments,
  moveMatch,
  openWorkspace,
  reloadDocument
} from '../ipc/commands';
import type { CommandResult } from '../ipc/commands';
import { mayHaveWritten, reportIpcFailure } from '../ipc/errors';
import type { IpcFailure } from '../ipc/errors';
import type {
  Acknowledgement,
  ContentRevision,
  DocumentId,
  DocumentSummary,
  DocumentView,
  MatchId,
  MatchView,
  SaveResult,
  WorkspaceSummary
} from '../ipc/types';
import type { SelectionNotice } from './notices';
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
 * — since Phase 2b-2a — the one that writes. {@link BrowserCommands.moveMatch} is
 * the only member that can change a file on disk, and it is here for the same
 * reason the others are: a test that cannot run Tauri still has to be able to
 * drive a refusal, a conflict and a commit and watch what this state does about
 * each.
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
}

/** The real boundary, for the running application. */
export const REAL_COMMANDS: BrowserCommands = {
  openWorkspace,
  listDocuments,
  getDocument,
  getMatch,
  reloadDocument,
  documentText,
  moveMatch
};

/** Where the workspace load has got to. */
export type BrowserStatus = 'loading' | 'ready' | 'failed';

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
   * Moves one snippet inside the list it is in, and saves the file.
   *
   * **The one entry point on this state that changes a file.** Everything else
   * here reads.
   *
   * What comes back is the outcome, and all three of its arms are answers rather
   * than failures: `saved`, `conflict` — the file moved on, and nothing was
   * written — and `refused`, which carries the findings to show and to hand back.
   * `null` means the command itself failed; the reason went to the reporter, as
   * every other failure on this state does.
   *
   * On a committed save this refreshes the document's projection, drops the raw
   * viewer's held text, and re-points the selection at the identity the command
   * answered with — because a commit invalidates every identity this state holds
   * for that file.
   *
   * @param match - The snippet to move.
   * @param after - The snippet it should follow, or `null` for the top of the
   *   list.
   * @param acknowledgement - The suspicions already shown to a person; pass
   *   `{ accepted: [] }` on a first attempt.
   * @returns How the save ended, or `null` when the command failed.
   */
  moveMatch(
    match: MatchView,
    after: MatchView | null,
    acknowledgement: Acknowledgement
  ): Promise<SaveResult | null>;
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

  // The three generation counters. None is `$state`: nothing renders them, and
  // they are read only by the request that took one, immediately after its own
  // `await`. Making them reactive would add a dependency to every getter that
  // happens to run in the same effect.
  let openGeneration = 0;
  let selectGeneration = 0;
  let fileTextGeneration = 0;

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
   * @param next - The projection just read from disk.
   */
  function installView(next: DocumentView): void {
    const index = views.findIndex((view) => view.id === next.id);
    // The `-1` arm is not reachable from `select()` — a selection exists only
    // in a document that was projected — but appending is the right answer for
    // a document that was skipped at load and has now been read.
    views = index === -1 ? [...views, next] : views.map((view, at) => (at === index ? next : view));
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
    const answer = await commands.documentText(target.id);
    if (generation !== fileTextGeneration) {
      // A later toggle, click or workspace load has moved the viewer on. This
      // answer is about a file the reader is no longer looking at.
      return;
    }
    fileTextAnswer = answer;
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
        selected = repair.selected;
        notice = 'kept';
        return;
      case 'cleared':
        if (repair.reloaded !== null) {
          // A snippet that was deleted must stop being in the list, not only
          // stop being selected.
          installView(repair.reloaded);
        }
        selected = null;
        notice = repair.reason;
        return;
      case 'unresolved':
        selected = null;
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

    async open(root: string | null): Promise<void> {
      const generation = ++openGeneration;
      // A selection into the workspace being replaced can never be applied to
      // the one replacing it, so every pending `select()` is invalidated here.
      selectGeneration += 1;

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
      const generation = ++selectGeneration;
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
      if (generation !== selectGeneration) {
        // A later click, or a reload of the whole workspace, has happened while
        // this one was in flight. Its answer describes a selection the user has
        // already replaced, so it is dropped whole — including the reloaded
        // document, which is a projection the newer selection's position and
        // identity were not taken from.
        return;
      }
      if (resolved.ok) {
        return;
      }
      report(resolved.failure);
      const repair = await repairSelection(next, resolved.failure, commands.reloadDocument);
      if (generation !== selectGeneration) {
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
      selectGeneration += 1;
      selected = null;
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

    async moveMatch(
      match: MatchView,
      after: MatchView | null,
      acknowledgement: Acknowledgement
    ): Promise<SaveResult | null> {
      const view = views.find((held) => held.id === match.id.document);
      if (view === undefined) {
        // Nothing on this state describes that document, so there is no base
        // revision to send. Refusing here rather than inventing one is the same
        // rule the command applies: a base that is not the parse the caller was
        // editing against turns a move into a move of whatever now sits at the
        // position.
        return null;
      }
      const answer = await commands.moveMatch(
        match.id,
        after === null ? null : after.id,
        view.revision,
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
        report(answer.failure);
        if (mayHaveWritten(answer.failure)) {
          forgetFileText();
          await adoptTheDocumentOnDisk(match.id.document, null);
          await readFileText();
        }
        return null;
      }

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
          // The snapshot the raw viewer holds is of a file that no longer exists
          // in that form. This is `forgetFileText`'s fourth caller and the first
          // one that is about a *write*.
          forgetFileText();
          await adoptTheDocumentOnDisk(match.id.document, answer.value.moved);
          await readFileText();
        }
      } else if (answer.value.outcome === 'conflict') {
        // Nothing was written, and the command has already refreshed its own
        // cache from the disk. Taking the projection it handed back keeps this
        // state describing the same bytes the next save will be checked against.
        // The viewer's snapshot is of the bytes the *caller* read, which are not
        // the ones on disk, so it goes too.
        forgetFileText();
        installView(answer.value.disk);
        repairAfter(answer.value.disk);
        await readFileText();
      }
      return answer.value;
    } // End of function moveMatch()
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
   * A re-read that itself fails is reported and leaves the projection alone. That
   * is the honest answer available here: this state cannot describe a file it
   * could not read, and blanking the workspace over one file would be a bigger
   * claim than the failure supports.
   *
   * @param document - The file that was, or may have been, written.
   * @param moved - The moved snippet's identity in the new revision, or `null`.
   */
  async function adoptTheDocumentOnDisk(
    document: DocumentId,
    moved: MatchId | null
  ): Promise<void> {
    const fresh = await commands.getDocument(document);
    if (!fresh.ok) {
      report(fresh.failure);
      return;
    }
    installView(fresh.value);
    if (moved !== null && selected !== null && selected.document === document) {
      const position = positionOf(fresh.value, moved);
      if (position !== null) {
        selected = selectMatch(fresh.value, position);
        notice = null;
        return;
      }
    }
    repairAfter(fresh.value);
  } // End of function adoptTheDocumentOnDisk()

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
   * @param view - The projection now in place.
   */
  function repairAfter(view: DocumentView): void {
    if (selected === null || selected.document !== view.id) {
      return;
    }
    const found = reresolve(selected, view);
    if (found.outcome === 'sameMatch') {
      selected = found.selected;
      notice = 'kept';
      return;
    }
    selected = null;
    notice = found.outcome;
  } // End of function repairAfter()
} // End of function createBrowserState()
