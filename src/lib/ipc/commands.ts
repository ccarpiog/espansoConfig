/**
 * The fifteen workspace commands, typed.
 *
 * One function per `#[tauri::command]` in `src-tauri/src/commands.rs`, with the
 * command's wire name written once, here, and nowhere else in the frontend.
 * Nothing in this module renders anything: it moves typed values across the
 * boundary and classifies what comes back.
 *
 * ## Why these return a result instead of throwing
 *
 * `invoke` rejects, and a rejection is easy to forget. Every function below
 * returns a {@link CommandResult}, so a caller that ignores the failure arm
 * fails to compile rather than losing an error at runtime. That matters most
 * for the one failure this phase exists to preserve: a `getMatch` crossing a
 * reload comes back as `identityStaleRevision`, which says *the document moved
 * on, resolve this again* rather than *something went wrong* (`PROGRESS.md`
 * R27). A `try`/`catch` around an `invoke` is exactly the shape that turns the
 * first into the second.
 *
 * ## Six of them write
 *
 * {@link moveMatch}, since Phase 2b-2a; {@link saveMatch}, since 2b-2b-3;
 * {@link createMatch} and {@link deleteMatch}, since 2b-2c-2;
 * {@link saveRawDocument}, since 2b-2c-3b; and {@link duplicateMatch}, since
 * 2c-3c-2. They are the only functions in this application that can change a
 * file on disk, and what each answers with is a {@link SaveResult} in the value
 * channel rather than a thrown error: a save that was refused, and a save that
 * found the file had moved on, are **outcomes** and not failures.
 *
 * ## The fifth is not an edit, and its signature says so
 *
 * {@link saveRawDocument} replaces a file's **whole text**. It carries none of
 * the locality guarantee the other four keep, and — unlike them — a successful
 * commit invalidates *every* identity in that file at once rather than handing
 * one back. That obligation is not a paragraph here: it is the wrapper's last
 * parameter, which has no default and no `undefined` in its type, so a caller
 * that has nowhere to put the reload cannot compile.
 *
 * It is also the one wrapper that does **not** answer a {@link CommandResult}.
 * Its answer is a {@link RawSaveOutcome}, because a committed write and a failed
 * reload are two facts and this boundary must be able to state both — see the
 * function's own comment for why collapsing them broke `PROGRESS.md` D2.
 *
 * ## Three of them read the backup folder, and none of those writes
 *
 * {@link listBackupBatches}, {@link listBackupEntries} and
 * {@link readBackupText}, since Phase 2c-5-2. They put the read-only backup
 * catalogue on this boundary so a later sub-phase can offer a restore — and a
 * restore is a **content path on {@link saveRawDocument}**, not a seventh
 * writing command. What {@link readBackupText} answers is a candidate; sending
 * it is a whole-document replacement like any other, with the destination's own
 * base revision and the ordinary findings.
 *
 * ## What is deliberately absent
 *
 * `validate_match`. It has no phase yet, and a wrapper would be a standing
 * invitation to call something that is not there.
 */

import { invoke } from '@tauri-apps/api/core';

import { classifyFailure, type IpcFailure } from './errors';
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
  SaveResult,
  WorkspaceSummary
} from './types';

/** The outcome of one command: a value, or a classified failure. */
export type CommandResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failure: IpcFailure };

/**
 * The wire name of every command this module may call.
 *
 * Written out as a value rather than inlined at each call site so that the set
 * of commands the frontend can reach is one readable list. Adding a name here
 * that `invoke_handler` does not register is a runtime failure, not a compile
 * one — which is why the list is short and why nothing generates it.
 */
export const COMMAND_NAMES = [
  'open_workspace',
  'list_documents',
  'get_document',
  'get_match',
  'document_text',
  'reload_document',
  'move_match',
  'save_match',
  'create_match',
  'delete_match',
  'save_raw_document',
  'duplicate_match',
  'list_backup_batches',
  'list_backup_entries',
  'read_backup_text'
] as const;

/** One of {@link COMMAND_NAMES}. */
export type CommandName = (typeof COMMAND_NAMES)[number];

/**
 * Everything a committed whole-document replacement made stale.
 *
 * Deliberately **not** a wire type: Rust answers a {@link SaveResult} exactly as
 * it does for the other four writing commands (design consult Q3), and this is
 * what {@link saveRawDocument} derives from it for the one caller obligation the
 * wire cannot express.
 */
export interface RawSaveInvalidation {
  /** The file that was replaced. Every {@link MatchId} in it is now stale. */
  readonly document: DocumentId;
  /**
   * The revision the file holds now — the caller's new base revision.
   *
   * The value to reload against, and the value to send with the next save.
   */
  readonly revision: ContentRevision;
}

/**
 * What a caller must do when a raw save commits.
 *
 * **The mechanism, not a reminder.** After `committed: true` every
 * {@link MatchId} the caller holds for that file resolves to
 * `identityStaleRevision`, and unlike a move, a save, a creation or a deletion
 * there is **no** single match to answer with: `moved` is `null` permanently and
 * by construction, so nothing in the answer can be followed across the save.
 * Phase 2b-2c-3a recorded that this obligation "is represented in no type — a
 * caller that ignores it compiles", and this type is what closes that.
 *
 * {@link saveRawDocument} takes one of these as a **required** argument and
 * calls it itself, awaiting it before resolving. So the obligation cannot be
 * dropped by forgetting it, cannot be dropped by handling the wrong arm, and
 * cannot be discharged after the caller has already acted on the result.
 *
 * What it cannot force is a body that does something: `() => {}` type-checks,
 * and this parameter is **not** what the running application relies on. The
 * invalidation the real path performs belongs to the module that owns the
 * projections — `createBrowserState` in `../browser/workspace.svelte`, whose
 * `saveRawDocument` passes its own — and this parameter is what keeps the
 * boundary drivable by a test that has no such state.
 *
 * A body that throws or rejects does **not** fail the save: see
 * {@link RawSaveOutcome}.
 *
 * @param invalidation - The file that was replaced and the revision it now
 *   holds.
 */
export type ReloadAfterRawSave = (invalidation: RawSaveInvalidation) => void | Promise<void>;

/**
 * What became of the reload a committed raw save owes.
 *
 * **Three states rather than two**, because "the reload did not run" and "the
 * reload ran and failed" are different things for a window to be in and only one
 * of them means the screen is out of step with the file.
 *
 * - `notOwed` — nothing was written, or the bytes were already what the file
 *   held, so no identity went stale and no reload was due.
 * - `done` — the reload was called and returned.
 * - `failed` — the reload was called and threw or rejected. **The save still
 *   committed.** The window is now drawing projections of bytes that are gone,
 *   which is a real problem and a different one from a failed write.
 */
export type RawSaveReload =
  | { readonly kind: 'notOwed' }
  | { readonly kind: 'done' }
  | { readonly kind: 'failed'; readonly failure: IpcFailure };

/**
 * What {@link saveRawDocument} answers: the save's own outcome, and the reload's.
 *
 * **The one wrapper on this boundary that does not answer a
 * {@link CommandResult}**, and the reason is `PROGRESS.md` D2: *a committed write
 * is never afterwards reported as an `Err`.* The first version of this wrapper
 * `await`ed the caller's reload inside a promise typed
 * `Promise<CommandResult<SaveResult>>`, so a reload that rejected threw **out of
 * the wrapper** — hiding a `Saved` the file on disk already reflects and
 * inviting the caller to retry a write that had happened. That is the invariant
 * the Rust side is built around, broken in TypeScript.
 *
 * So the two facts are carried side by side. The failure arm is unchanged and
 * means the *command* failed; the success arm always carries the
 * {@link SaveResult} the transaction really reached, and
 * {@link RawSaveOutcome.reload} says separately what happened to the
 * invalidation. Neither is optional, so neither can be read as absent.
 *
 * **What this does not do is force the caller to look at `reload`.** No
 * TypeScript type can require a property to be read. What it does is make the
 * failure survive as a value on the answer instead of as a thrown thing that
 * destroys the answer.
 */
export type RawSaveOutcome =
  | {
      /** The discriminant: the command itself succeeded. */
      readonly ok: true;
      /** How the save ended, exactly as the transaction reported it. */
      readonly value: SaveResult;
      /** What became of the invalidation that a commit owes. */
      readonly reload: RawSaveReload;
    }
  | {
      /** The discriminant: the command itself failed. */
      readonly ok: false;
      /** Why it failed. */
      readonly failure: IpcFailure;
    };

/**
 * Invokes one command and classifies whatever comes back.
 *
 * The single place `invoke` is called, so the single place a rejection can be
 * mishandled.
 *
 * @param command - The command's wire name.
 * @param args - The command's arguments, already in wire form.
 * @returns The command's value, or the classified failure.
 */
async function call<T>(
  command: CommandName,
  args: Readonly<Record<string, unknown>>
): Promise<CommandResult<T>> {
  try {
    const value = await invoke<T>(command, args);
    return { ok: true, value };
  } catch (raw: unknown) {
    return { ok: false, failure: classifyFailure(raw) };
  }
} // End of function call()

/**
 * Locates and opens an espanso configuration directory.
 *
 * Parses nothing: opening a directory of any size costs one directory walk, and
 * the sidebar can render before a single file has been read.
 *
 * @param root - A directory the user chose, or `null` to probe the standard
 *   locations in order.
 * @returns The workspace summary, or a failure — `notADirectory` for a chosen
 *   path that is not one, `configDirNotFound` when no candidate existed.
 */
export async function openWorkspace(root: string | null): Promise<CommandResult<WorkspaceSummary>> {
  return call<WorkspaceSummary>('open_workspace', { root });
} // End of function openWorkspace()

/**
 * Lists every file of the open workspace, parsed or not.
 *
 * @returns One summary per file, or `noWorkspaceOpen`.
 */
export async function listDocuments(): Promise<CommandResult<readonly DocumentSummary[]>> {
  return call<readonly DocumentSummary[]>('list_documents', {});
} // End of function listDocuments()

/**
 * Returns the projection of one document, parsing it on first use.
 *
 * A file that does not *parse* is not a failure: it comes back with
 * `parsed: false`, a diagnostic saying why, and every projection field empty.
 * Only a file that cannot be *read* rejects.
 *
 * @param id - The document's session-local identity.
 * @returns The projection, or `unknownDocument` / `io` / `notUtf8`.
 */
export async function getDocument(id: DocumentId): Promise<CommandResult<DocumentView>> {
  return call<DocumentView>('get_document', { id });
} // End of function getDocument()

/**
 * Returns one match of one document.
 *
 * The identity is scoped to the parse it was minted from, so a call that
 * crosses a {@link reloadDocument} — or any other reparse — comes back as
 * `identityStaleRevision` rather than resolving to whatever now occupies that
 * node. Handle it through `identityRecovery`: it is neither "not found" nor a
 * promise that the match survived whatever changed the file.
 *
 * @param id - The match's identity, exactly as it arrived.
 * @returns The match, or an identity failure that says which kind it is.
 */
export async function getMatch(id: MatchId): Promise<CommandResult<MatchView>> {
  return call<MatchView>('get_match', { id });
} // End of function getMatch()

/**
 * Returns the whole text of one document, unchanged, when the file is valid
 * UTF-8.
 *
 * The one command on this boundary that answers with a file's **own text**
 * rather than a projection of it, and the contract is exactly that narrow:
 * **exact preservation of valid UTF-8, and a typed refusal otherwise.**
 *
 * This is *not* a byte-fidelity API for arbitrary disk bytes, and the return
 * type is why — `CommandResult<string>` cannot represent a byte sequence that is
 * not valid UTF-8. A file containing one is refused in Rust before this command
 * runs, and arrives here as `notUtf8` carrying the byte offset of the first
 * invalid sequence. Nothing is decoded lossily and no U+FFFD is substituted: the
 * caller is told the file cannot be represented rather than shown a mangled
 * version of it, and the raw pane consequently cannot display that file at all.
 *
 * For a file that *is* valid UTF-8, nothing between `std::fs::read` and this
 * promise re-encodes the text: CRLF endings, a leading UTF-8 BOM, a missing
 * final newline, a decomposed `é`, an astral character, a NUL, U+2028/U+2029 and
 * a block scalar's trailing spaces all arrive as written, because JSON escaping
 * is exactly reversible. `src-tauri/src/dispatch_check.rs` measures that over
 * the byte-exact corpus fixtures rather than asserting it here.
 *
 * **The measurement stops at the response body Tauri builds.** Tauri's mock
 * runtime swaps the platform webview out, so no test in this repository says
 * anything about what WKWebView or `postMessage` then does with the string. That
 * is a named hole (`docs/decisions/1c-2b-2a-notes.md` section 4.3), not an
 * implication.
 *
 * **Do not cut a `ByteSpan` out of this string.** Every span on this wire counts
 * bytes; a JavaScript string index counts UTF-16 code units, and the two agree
 * only for ASCII. A value that needs slicing is sliced in Rust and carried —
 * `UnknownEntry.value_text` is the one that exists today.
 *
 * A file that does not *parse* still has text, and this is what returns it. Only
 * a file that cannot be *read* — or cannot be decoded — rejects.
 *
 * @param id - The document's session-local identity.
 * @returns The document's text, or `noWorkspaceOpen` / `unknownDocument` / `io`
 *   / `notUtf8`.
 */
export async function documentText(id: DocumentId): Promise<CommandResult<string>> {
  return call<string>('document_text', { id });
} // End of function documentText()

/**
 * Re-reads one document from disk, reparsing only if its bytes changed.
 *
 * The method a watcher notification will drive in a later phase. A notification
 * about a file that did not really change costs one read and one hash, and the
 * revision that comes back is the one that was already held.
 *
 * @param id - The document's session-local identity.
 * @returns The projection of the bytes now on disk, or a read failure.
 */
export async function reloadDocument(id: DocumentId): Promise<CommandResult<DocumentView>> {
  return call<DocumentView>('reload_document', { id });
} // End of function reloadDocument()

/**
 * Moves one snippet within the list it is in, and saves the file.
 *
 * **The only function in this application that writes a user's file.** It goes
 * through the save transaction and through nothing else: the file is locked,
 * read and hashed under that lock, patched, reparsed, projected, checked, backed
 * up and replaced atomically, all before this promise resolves.
 *
 * ## What it answers, and why a refusal is not a rejection
 *
 * A {@link SaveResult} with three arms. `saved` means the transaction ran to the
 * end. `conflict` means the file no longer held what `baseRevision` claimed, and
 * **nothing was written**. `refused` means the semantic gate found something and
 * declined: show `findings`, and — if the person says so — call again with an
 * {@link Acknowledgement} holding exactly the findings they were shown. Only the
 * things that are neither of those reject, and a save that failed rejects with
 * `saveFailed` carrying the transaction's own typed reason.
 *
 * ## Every identity you hold is stale afterwards
 *
 * A {@link MatchId} records the revision it was minted from, so a successful
 * commit invalidates every one of them for that file. `saved.moved` is the moved
 * snippet's identity **in the new revision**; the one passed in as `id` will now
 * answer `identityStaleRevision`. The document's cached projection is refreshed
 * on the Rust side before this resolves, so a following {@link getDocument} or
 * {@link documentText} sees the new bytes without an explicit reload.
 *
 * There is deliberately **no force flag.** The acknowledgement is matched against
 * findings recomputed from the file under the lock, as an exact multiset, so two
 * equal suspicions need two acknowledged copies.
 *
 * @param id - The snippet to move, by identity.
 * @param after - The snippet it should be written after, by identity, or `null`
 *   to put it at the top of the list. An identity rather than a position: a
 *   position re-points itself the moment anything above it is deleted.
 * @param baseRevision - The revision the caller believes the file holds. Checked
 *   against this session's projection and again against the bytes under the write
 *   lock.
 * @param acknowledgement - The suspicions already shown to a person, by content.
 *   Pass `{ accepted: [] }` on a first attempt.
 * @returns How the save ended, or a failure — `noWorkspaceOpen`, an identity
 *   code, `moveNotWithinOneSequence`, or `saveFailed`.
 */
export async function moveMatch(
  id: MatchId,
  after: MatchId | null,
  baseRevision: ContentRevision,
  acknowledgement: Acknowledgement
): Promise<CommandResult<SaveResult>> {
  return call<SaveResult>('move_match', { id, after, baseRevision, acknowledgement });
} // End of function moveMatch()

/**
 * Writes one snippet's drafted values into its file.
 *
 * **The second function in this application that writes a user's file**, and it
 * goes through the same save transaction as {@link moveMatch} and through
 * nothing else: locked, read and hashed under that lock, patched, reparsed,
 * projected, checked, backed up and replaced atomically, all before this promise
 * resolves.
 *
 * ## The draft is one intention, not a list of changes
 *
 * A {@link MatchDraft} says what the whole snippet should hold. Rust derives the
 * **smallest** edit batch that realises it, so a field left `'Unchanged'`
 * produces no edit at all and cannot rewrite bytes nobody touched — that is what
 * makes an unedited field's spelling, quoting and comments survive a save
 * byte-for-byte. A field set to the value it already holds produces no edit
 * either, and a save that derives none is a `saved` result with
 * `committed: false`, which is a **success**.
 *
 * ## A refused draft is not a refused save
 *
 * Two different refusals reach a caller from here and they call for two
 * different interfaces. `refused` in the {@link SaveResult} means the semantic
 * gate found something in a candidate it had already built: show the findings,
 * and call again with an {@link Acknowledgement} holding exactly those the person
 * accepted. A rejection with `draftRefused` means the draft could not be turned
 * into edits **at all** — no candidate, no transaction, and no acknowledgement
 * that could ever change the answer. Route it to the field the person was
 * editing, not to a generic error toast, and never offer to retry it.
 *
 * ## Positional addressing is why the base revision is load-bearing
 *
 * Everything below the snippet's own keys is drafted by **index into the
 * projection** — which variable, which parameter, which list item. A stale
 * revision would therefore let an index name a *different* entry rather than a
 * missing one, so the draft must be planned against the projection the caller
 * actually looked at. The optimistic-concurrency check inside the transaction,
 * taken under the write lock, is what enforces that; a mismatch comes back as
 * `conflict` with nothing written.
 *
 * Every {@link MatchId} held for this file is stale after a successful commit;
 * `saved.moved` is this snippet's identity in the new revision. There is
 * deliberately **no force flag**.
 *
 * @param id - The snippet to save, by identity.
 * @param draft - What the snippet should say, as a whole.
 * @param baseRevision - The revision the caller believes the file holds, and the
 *   revision the draft's indices are positions in.
 * @param acknowledgement - The suspicions already shown to a person, by content.
 *   Pass `{ accepted: [] }` on a first attempt.
 * @returns How the save ended, or a failure — `noWorkspaceOpen`, an identity
 *   code, `draftRefused`, or `saveFailed`.
 */
export async function saveMatch(
  id: MatchId,
  draft: MatchDraft,
  baseRevision: ContentRevision,
  acknowledgement: Acknowledgement
): Promise<CommandResult<SaveResult>> {
  return call<SaveResult>('save_match', { id, draft, baseRevision, acknowledgement });
} // End of function saveMatch()

/**
 * Writes one new snippet into a file's list, and saves the file.
 *
 * **The third function in this application that writes a user's file**, and it
 * goes through the same save transaction as {@link moveMatch} and
 * {@link saveMatch} and through nothing else: the file is locked, read and hashed
 * under that lock, patched, reparsed, projected, checked, backed up and replaced
 * atomically, all before this promise resolves.
 *
 * ## The snippet's content is closed, and its keys are not the caller's
 *
 * A {@link NewMatch} carries **two required and four optional schema-known
 * scalar fields** and nothing else. `trigger` and `replace` are required — a
 * trigger with no body is not a usable espanso snippet and this application does
 * not create one — while `label`, `word`, `left_word` and `right_word` are
 * written only when they are given, and an omitted one is a key the new snippet
 * is not born holding rather than a key written empty. Every value's **spelling**
 * in the file — plain, quoted, or a text block — is Rust's decision, made by the
 * same encoder every other value goes through, so a value holding a `#`, a line
 * break or a leading `*` is written correctly rather than injected. Nothing here
 * composes a YAML key.
 *
 * ## It targets the file's own snippet list
 *
 * The file is named by the identity this window holds for it, never by a path: a
 * path on this wire is display text, and two different filenames can render to
 * one string. The list is the file's top-level snippet list, and a file that has
 * none rejects with `documentHasNoMatchList` **before anything is attempted** — a
 * refusal to change the request, not a save to retry. A file whose list line has
 * nothing under it is not that case: the first snippet of such a file is created
 * normally.
 *
 * ## `saved.moved` is the created snippet
 *
 * This is the one command whose answer a caller cannot derive for itself, because
 * the snippet did not exist when the call was made. Every {@link MatchId} held
 * for this file is stale after a successful commit; `saved.moved` is the new
 * snippet's identity in the new revision. There is deliberately **no force
 * flag**.
 *
 * @param document - The file to write into, by the identity this window holds.
 * @param newMatch - What the new snippet says: a trigger and a body, plus any of
 *   the four optional schema-known fields it is born holding.
 * @param position - Where it goes in the list — `{ Front: {} }`, `{ End: {} }` or
 *   `{ After: { anchor } }` naming the snippet it follows **by identity**.
 * @param baseRevision - The revision the caller believes the file holds, and the
 *   revision the anchor identity was minted from.
 * @param acknowledgement - The suspicions already shown to a person, by content.
 *   Pass `{ accepted: [] }` on a first attempt.
 * @returns How the save ended, or a failure — `noWorkspaceOpen`, an identity
 *   code, `moveNotWithinOneSequence`, `documentHasNoMatchList`, or `saveFailed`.
 */
export async function createMatch(
  document: DocumentId,
  newMatch: NewMatch,
  position: NewMatchPosition,
  baseRevision: ContentRevision,
  acknowledgement: Acknowledgement
): Promise<CommandResult<SaveResult>> {
  return call<SaveResult>('create_match', {
    document,
    newMatch,
    position,
    baseRevision,
    acknowledgement
  });
} // End of function createMatch()

/**
 * Deletes one snippet from its file, and saves the file.
 *
 * **The fourth function in this application that writes a user's file**, and the
 * only one that takes something away. It goes through the same save transaction
 * as the other three and through nothing else.
 *
 * ## What goes with the snippet
 *
 * Its own leading comment block and its inline comment, because a comment
 * describing something that is no longer there is worse than no comment. A
 * comment the file owns — one separated from every snippet by a blank line —
 * stays exactly where it is, byte for byte, and so does every byte of the
 * snippets around it.
 *
 * **Deleting the last snippet of a file is refused**, and rejects with
 * `saveFailed` carrying the engine's own reason. Emptying the list would mean
 * either writing an empty list or leaving the list line with nothing under it,
 * and those are two different files from the one the person has. Offer to delete
 * the file instead, or say so; do not retry.
 *
 * ## Its answer names nothing, and that is the answer
 *
 * `saved.moved` is `null` after a successful deletion, because the snippet that
 * was deleted has no identity in the new revision. It is **not** a neighbour's
 * identity: `moved` means *where the snippet you acted on is now*, and filling it
 * with whatever this window might select next would put a position back into the
 * one field that exists to replace positions with identities. Re-read the
 * document and choose.
 *
 * Every {@link MatchId} held for this file is stale afterwards. There is
 * deliberately **no force flag**.
 *
 * @param id - The snippet to delete, by identity.
 * @param baseRevision - The revision the caller believes the file holds. A stale
 *   one is refused rather than resolved, because the address a deletion resolves
 *   to is a **position**, and a stale identity's old position may now hold a
 *   different snippet.
 * @param acknowledgement - The suspicions already shown to a person, by content.
 *   Pass `{ accepted: [] }` on a first attempt.
 * @returns How the save ended, or a failure — `noWorkspaceOpen`, an identity
 *   code, `moveNotWithinOneSequence`, or `saveFailed`.
 */
export async function deleteMatch(
  id: MatchId,
  baseRevision: ContentRevision,
  acknowledgement: Acknowledgement
): Promise<CommandResult<SaveResult>> {
  return call<SaveResult>('delete_match', { id, baseRevision, acknowledgement });
} // End of function deleteMatch()

/**
 * Replaces one file's whole text with the text given, and saves it.
 *
 * **The fifth function in this application that writes a user's file, and the
 * only one that is not an edit.** It goes through the same save transaction as
 * the other four and through nothing else: the file is locked, read and hashed
 * under that lock, its bytes replaced, reparsed, projected, checked, backed up
 * and replaced atomically, all before this promise resolves.
 *
 * ## It replaces the entire document, and an interface must say so
 *
 * The other four promise that every byte outside the span they edited comes out
 * identical. **This one promises nothing of the kind.** What it promises is
 * narrower and exact: the submitted text is committed byte for byte — no
 * reformatting, no newline normalisation, no BOM added or removed, no final
 * newline supplied, no re-indentation. Presenting it as an edit to part of the
 * file would be a false statement about what was written; `describeRawSave` in
 * `../browser/rawSave` is the model that says it correctly, in both languages.
 *
 * ## A text espanso's YAML cannot read is written, once the person says so
 *
 * Deliberately, and by the owner's ruling: refusing would mean this application
 * cannot repair a file that is *already* broken, which is the most valuable
 * thing a raw editor does. So a candidate the parser rejects comes back as
 * `refused` carrying a `DocumentDoesNotParse` finding, and calling again with
 * that exact finding acknowledged **commits it**. The finding is bound to the
 * text it is about, so consent collected for one broken draft cannot be spent on
 * another: edit the text and the same acknowledgement is refused again. There is
 * still no force flag.
 *
 * ## Every identity for that file is stale, and there is none to hand back
 *
 * `saved.moved` is `null` permanently. A move, a save, a creation and a deletion
 * each act on one snippet and can say where it went; a replacement rewrites the
 * whole file, so **all** of them are stale at once. That is why `reload` is a
 * required argument rather than a sentence in this comment: it is called, and
 * awaited, exactly when `committed` is `true`. It is not, on its own, what makes
 * the invalidation happen — a no-op body type-checks, so the running
 * application's path goes through `createBrowserState`'s own `saveRawDocument`,
 * which owns the projections and supplies the body itself.
 *
 * It is **not** called for `committed: false` — a text identical to what the
 * file already held is not written, so nothing became stale — and not for
 * `conflict`, where nothing was written either and the fresh projection of what
 * the file really holds is carried in the answer's own `disk` field for the
 * caller to adopt.
 *
 * ## A reload that fails cannot unwrite the file
 *
 * The answer is a {@link RawSaveOutcome} rather than a `CommandResult`, and this
 * is the whole reason. The reload runs after the bytes are on disk, so its
 * failure says nothing about whether the save happened; letting it reject this
 * promise would have hidden a committed `Saved` behind an exception and invited
 * a retry of a write that already happened, which is exactly what
 * `PROGRESS.md` D2 forbids. It is caught, classified onto
 * {@link RawSaveOutcome.reload}, and neither swallowed nor allowed to escape.
 *
 * @param document - The file to replace, by the identity this window holds.
 *   Never a path: a path on this wire is display text, and two different
 *   filenames can render to one string.
 * @param baseRevision - The revision the file held when its text was loaded into
 *   the editor. **The only thing standing between this call and silently
 *   overwriting whatever changed the file since**, so it must be the revision the
 *   editor really loaded, never one re-read just before saving.
 * @param text - The file's whole new text, committed exactly as given.
 * @param acknowledgement - The suspicions already shown to a person, by content.
 *   Pass `{ accepted: [] }` on a first attempt.
 * @param reload - What to do once the file has been replaced. Called with the
 *   file and its new revision, and awaited, on `committed: true` only. Its own
 *   failure is reported on the answer and never as a rejection of this promise.
 * @returns How the save ended and what became of the reload, or a failure —
 *   `noWorkspaceOpen`, `unknownDocument`, or `saveFailed`.
 */
export async function saveRawDocument(
  document: DocumentId,
  baseRevision: ContentRevision,
  text: string,
  acknowledgement: Acknowledgement,
  reload: ReloadAfterRawSave
): Promise<RawSaveOutcome> {
  const answer = await call<SaveResult>('save_raw_document', {
    document,
    baseRevision,
    text,
    acknowledgement
  });
  if (!answer.ok) {
    return answer;
  }
  if (!(answer.value.outcome === 'saved' && answer.value.committed)) {
    // Nothing was written, so no identity went stale and there is no obligation
    // to discharge. Saying so with its own arm keeps "did not run" apart from
    // "ran and worked", which a boolean would have collapsed.
    return { ok: true, value: answer.value, reload: { kind: 'notOwed' } };
  }
  try {
    // Awaited rather than fired: a caller that reloads asynchronously must have
    // finished before this promise resolves, or the code after the `await` would
    // run against the projections this commit has just invalidated — which is
    // the exact failure the parameter exists to prevent.
    await reload({ document, revision: answer.value.revision });
  } catch (raw: unknown) {
    // **The file is written and stays written.** `classifyFailure` never throws
    // and never returns `undefined`, so this arm always has something to carry,
    // and what it carries goes on the answer beside the committed `Saved` rather
    // than in place of it.
    return {
      ok: true,
      value: answer.value,
      reload: { kind: 'failed', failure: classifyFailure(raw) }
    };
  }
  return { ok: true, value: answer.value, reload: { kind: 'done' } };
} // End of function saveRawDocument()

/**
 * Inserts a byte-exact copy of one snippet immediately after it, and saves the
 * file.
 *
 * **The sixth function in this application that writes a user's file**, and it
 * goes through the same save transaction as the other five and through nothing
 * else: the file is locked, read and hashed under that lock, patched, reparsed,
 * projected, checked, backed up and replaced atomically, all before this
 * promise resolves.
 *
 * ## The copy is the source's own bytes, and it lands in one place
 *
 * The clone is the snippet's owned lines exactly as the file writes them —
 * comments, key order, scalar spelling, line endings — inserted **immediately
 * after the source, in the same list**. There is no destination argument: a
 * placement product was considered and refused, so the action stays
 * unsurprising and no anchor can go stale (2c-3c design consult, Q4).
 *
 * ## The first attempt is refused, by design, and that is the ordinary path
 *
 * A byte-exact copy keeps its source's trigger definition, so whenever the
 * source has one the save is interrupted with a `refused` outcome carrying a
 * `DuplicateKeepsTriggerDefinition` finding — a claim about **risk**, never
 * about espanso semantics: this application cannot determine how espanso
 * chooses between overlapping definitions, and no string built on this command
 * may say which snippet would win. The finding carries the candidate's own
 * revision, so consent collected for one clone cannot be spent on another;
 * hand the findings back exactly as they arrived and the same call commits.
 * There is deliberately **no force flag**.
 *
 * ## `saved.moved` is the clone
 *
 * Every {@link MatchId} held for this file is stale after a successful commit,
 * the source's included; `saved.moved` is the **clone's** identity in the new
 * revision, minted at the slot below its source. It is the only safe
 * continuation — and `null` on a commit means only that **the clone could not
 * be identified in the read that followed the write**, never which of its
 * causes occurred: the file may have changed again, or that read itself may
 * have failed, among others. A caller re-reads the document and asserts
 * nothing about a second writer.
 *
 * @param id - The snippet to copy, by identity. Not a path: a path is a
 *   **position**, and deleting an earlier snippet re-points one at a different
 *   snippet — whose bytes this command would then copy.
 * @param baseRevision - The revision the caller believes the file holds.
 *   Checked against this session's projection and again against the bytes under
 *   the write lock.
 * @param acknowledgement - The suspicions already shown to a person, by
 *   content. Pass `{ accepted: [] }` on a first attempt.
 * @returns How the save ended, or a failure — `noWorkspaceOpen`, an identity
 *   code, `duplicateSourceNotASequenceItem`, or `saveFailed`.
 */
export async function duplicateMatch(
  id: MatchId,
  baseRevision: ContentRevision,
  acknowledgement: Acknowledgement
): Promise<CommandResult<SaveResult>> {
  return call<SaveResult>('duplicate_match', { id, baseRevision, acknowledgement });
} // End of function duplicateMatch()

/**
 * Lists the recognised backup batches of the open workspace, newest name first.
 *
 * **The thirteenth command, and the first of three that read the backup folder
 * and write nothing.** Nothing here creates a folder, removes one or tidies one
 * away: the read side of the backup module shares none of the write side's
 * machinery, and a configuration this application has never saved from is left
 * without a backup folder rather than given one.
 *
 * ## A missing folder is an answer, not a failure
 *
 * `root: 'Missing'` is the ordinary state of a fresh install, and it resolves
 * successfully. Only an *existing* folder that is not a real private directory
 * rejects.
 *
 * ## An empty list is not the same as no backups
 *
 * Read `complete` before saying anything about what the folder holds: an entry
 * nothing could be learned about leaves the list short, and the counts beside it
 * are what distinguish a short list from a whole one.
 *
 * ## What a batch is, and is not
 *
 * A batch is one editing **session**'s copies, recognised by an ownership marker
 * that anything able to write inside the folder could also write — so
 * *recognised* is the strongest word that applies, and *authentic*, *verified*
 * and *created by this application* are not. Its name is a sortable folder name
 * derived from the process clock: ordering by it is proved, and reading it as a
 * time is not.
 *
 * @returns The listing, or `noWorkspaceOpen` / `backupReadFailed`.
 */
export async function listBackupBatches(): Promise<CommandResult<BackupBatchListing>> {
  return call<BackupBatchListing>('list_backup_batches', {});
} // End of function listBackupBatches()

/**
 * Lists the entries one recognised backup batch offers.
 *
 * Writes nothing, exactly as {@link listBackupBatches} does. The batch identity
 * is re-resolved against the folder first, so a batch removed between two calls
 * comes back as `backupReadFailed` carrying `StaleBatch` — **never as a batch
 * with no entries**, which is a sentence about the batch that would not be true.
 *
 * ## Two ways the list can be short, and they are counted apart
 *
 * `unreadable` is a thing inside the batch nothing could be learned about;
 * `unaddressable` is an entry whose file name cannot be spelled exactly on this
 * boundary, which is a property of the wire rather than of the folder and is
 * normally zero. `complete` is false when either is non-zero.
 *
 * @param batch - The opaque identity {@link listBackupBatches} produced. Hand it
 *   back unchanged; it is not authority, and the command re-resolves it beneath
 *   the workspace-owned backup folder rather than trusting anything built from
 *   its strings.
 * @returns The listing, or `noWorkspaceOpen` / `unrecognisedBackupBatch` /
 *   `backupReadFailed`.
 */
export async function listBackupEntries(
  batch: BackupBatchId
): Promise<CommandResult<BackupEntryListing>> {
  return call<BackupEntryListing>('list_backup_entries', { batch });
} // End of function listBackupEntries()

/**
 * Reads one backup entry's exact text, for the document it maps to.
 *
 * **The fifteenth command, and it writes nothing.** What it answers is a
 * *candidate*: to restore it, send that exact string through
 * {@link saveRawDocument} with the **destination's** base revision. This
 * function is not a restore and has no route to write to disk.
 *
 * ## Both arguments are required, and the second is the whole point
 *
 * The batch is asked which entry the *document's own resolved path* maps to, and
 * the identity passed in has to be that entry, or nothing is read. Without that
 * check a caller could read one file's copy while believing it was another's —
 * and a display path could not stand in for the document, because two distinct
 * filenames can render to one wire string.
 *
 * ## The revision beside the text is the candidate's, never the destination's
 *
 * It is the hash of exactly the bytes returned, so a caller can prove that what
 * it previewed and what it later submits are the same bytes. The live file this
 * text would replace has a revision of its own, and confusing the two is how a
 * confirmation gets spent on different bytes.
 *
 * ## Bytes that are not valid UTF-8 have no text
 *
 * They are refused with `backupReadFailed` carrying `NotUtf8` and the offset of
 * the first invalid sequence. Nothing is decoded lossily and no U+FFFD is
 * substituted, so such an entry cannot be previewed or restored at all — the
 * same contract, and the same limit, as {@link documentText}.
 *
 * @param entry - The opaque identity {@link listBackupEntries} produced.
 * @param document - The live file the entry must map to, by identity.
 * @returns The entry, the document, the exact text and its revision, or
 *   `noWorkspaceOpen` / `unrecognisedBackupBatch` / `unaddressableBackupEntry` /
 *   `unknownDocument` / `backupEntryIsNotThisDocument` / `backupReadFailed`.
 */
export async function readBackupText(
  entry: BackupEntryId,
  document: DocumentId
): Promise<CommandResult<BackupTextResponse>> {
  return call<BackupTextResponse>('read_backup_text', { entry, document });
} // End of function readBackupText()
