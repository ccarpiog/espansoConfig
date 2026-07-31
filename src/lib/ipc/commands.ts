/**
 * The six read-only commands, typed.
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
 * ## What is deliberately absent
 *
 * Every mutating command. `save_match`, `create_match`, `delete_match`,
 * `move_match`, `save_raw_document` and `validate_match` are Phase 2, and the
 * save transaction they need does not exist. A wrapper here would be a
 * standing invitation to call one.
 */

import { invoke } from '@tauri-apps/api/core';

import { classifyFailure, type IpcFailure } from './errors';
import type {
  DocumentId,
  DocumentSummary,
  DocumentView,
  MatchId,
  MatchView,
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
  'reload_document'
] as const;

/** One of {@link COMMAND_NAMES}. */
export type CommandName = (typeof COMMAND_NAMES)[number];

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
