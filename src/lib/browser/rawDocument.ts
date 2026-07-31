/**
 * What the raw YAML viewer shows: which file, and what state its text is in.
 *
 * The viewer itself is one branch of `../components/DetailPane.svelte`, drawn
 * through `SourceText.svelte` and therefore through `./sourceText.ts`. **No
 * second renderer for file text exists and none may be written.** What lives
 * here is the part a test can reach: which document the viewer would show, and
 * which of four things has happened to its text.
 *
 * ## Why the viewer is a mode of the third pane
 *
 * Four constraints decided it, and the fourth is the one that rules out the
 * obvious alternative.
 *
 * 1. **It must be reachable for a file that does not parse.** Such a file
 *    crosses the boundary with `parsed: false` and **no matches at all**, so
 *    nothing in it can ever be selected — which is the same argument
 *    `./findings.ts` records for putting a file's diagnostics in the *second*
 *    pane. {@link rawTarget} therefore takes the **sidebar** selection first: a
 *    file selected there has a target whether or not it holds a single snippet.
 * 2. **A whole document needs the width.** The third pane is the widest of the
 *    three (`AppShell.svelte` gives it `2fr` against `1.4fr` and `1fr`), and a
 *    document is drawn with `white-space: pre`, so a line longer than the pane
 *    scrolls rather than wrapping.
 * 3. **The control belongs with the thing it controls.** The toggle is rendered
 *    in the pane whose content it changes, so nothing has to explain that a
 *    button in one pane rearranges another.
 * 4. **The second pane is the *set*'s pane, the third is the *thing*'s.** The
 *    snippet list answers "what is in this file"; the detail pane answers "show
 *    me this one closely". A file's own text is the second kind of question.
 *
 * The cost, stated once: the third pane now has two subjects rather than one,
 * and a reader who has toggled the file's text on no longer sees the snippet
 * they selected. The toggle is the only way in and the only way out, and it
 * says which of the two it will show.
 */

import type { CommandResult } from '../ipc/commands';
import type { IpcFailure } from '../ipc/errors';
import type { DocumentSummary } from '../ipc/types';
import type { SelectedMatch } from './selection';
import type { SidebarSelection } from './sidebar';

/**
 * Which file the raw viewer would show, given what is selected.
 *
 * **The sidebar comes first, and that ordering is the decision.** A sidebar
 * entry naming a file is the user pointing at a *file*; a selected snippet is
 * the user pointing at something *inside* one. When the sidebar names a file,
 * that is the file, even if the held selection is a snippet from another one —
 * which can happen, because a selection made in the "All" scope survives a
 * later sidebar click.
 *
 * The `all` scope names no file, so it falls back to the selected snippet's
 * file. With neither, there is nothing to show and the toggle is not drawn.
 *
 * @param selection - Which sidebar entry is selected.
 * @param documents - Every file of the workspace, as listed.
 * @param selected - The held snippet selection, or `null`.
 * @returns The file the viewer would show, or `null` when there is none.
 */
export function rawTarget(
  selection: SidebarSelection,
  documents: readonly DocumentSummary[],
  selected: SelectedMatch | null
): DocumentSummary | null {
  if (selection.kind === 'document') {
    return documents.find((document) => document.id === selection.id) ?? null;
  }
  if (selected === null) {
    return null;
  }
  return documents.find((document) => document.id === selected.document) ?? null;
} // End of function rawTarget()

/**
 * What has happened to one file's text.
 *
 * **Four arms, because a file this app cannot show must not look like an empty
 * one.** `documentText` answers `CommandResult<string>`, and collapsing that to
 * a bare string would draw a file whose first bytes are not valid UTF-8 exactly
 * like a file of zero bytes: an empty box, with nothing saying which of the two
 * the reader is looking at. That is `docs/decisions/1c-2b-2a-notes.md` hole 8,
 * decided here — the same decision `SourceSlice` in `./detail.ts` makes about a
 * span, one level up.
 *
 * `loading` is an arm rather than a `null` for the same reason: a pane that
 * draws nothing while a read is in flight is a pane that says the file is empty
 * for as long as the read takes.
 */
export type RawDocumentText =
  /** The command has not answered yet. */
  | { readonly kind: 'loading' }
  /** The file's text, exactly as `document_text` answered it. */
  | { readonly kind: 'text'; readonly text: string }
  /** The command answered, and the file holds no characters at all. */
  | { readonly kind: 'empty' }
  /**
   * The command refused, so this file's text cannot be shown at all.
   *
   * `notUtf8` is the refusal this arm exists for and it is not the only one:
   * `io` (the file became unreadable), `unknownDocument` and `noWorkspaceOpen`
   * all land here. The failure is carried whole so the screen can render the
   * typed reason through `tIpcFailure` rather than one sentence for four
   * different facts.
   */
  | { readonly kind: 'refused'; readonly failure: IpcFailure };

/**
 * Reads one `document_text` answer into the arm the pane draws.
 *
 * **Nothing here re-slices anything**, and nothing may: a JavaScript string
 * index counts UTF-16 code units and every span on this wire counts bytes
 * (`docs/decisions/1c-2b-2a-notes.md` section 4.2). The text arrives whole and
 * is handed on whole.
 *
 * @param answer - What `documentText` answered, or `null` while it is in
 *   flight.
 * @returns Which of the four cases this is.
 */
export function documentTextState(answer: CommandResult<string> | null): RawDocumentText {
  if (answer === null) {
    return { kind: 'loading' };
  }
  if (!answer.ok) {
    return { kind: 'refused', failure: answer.failure };
  }
  return answer.value === '' ? { kind: 'empty' } : { kind: 'text', text: answer.value };
} // End of function documentTextState()
