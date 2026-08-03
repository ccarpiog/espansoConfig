/**
 * The selection, and what happens to it when the document underneath moves.
 *
 * This module is the caller `identityRecovery` in `../ipc/errors` was written
 * for, and R27 is the whole of its content:
 *
 * > A stale revision means **the document moved on**, and nothing about whether
 * > the match survived. Re-resolution has three possible answers — the same
 * > match, a **different** match, or nothing.
 *
 * `DocumentPath` is **not** a fallback identity, and neither is the position
 * kept below. A sequence step is a position: delete the first match of a file
 * and `matches[1]` still resolves, to what used to be `matches[2]`. So the
 * position is where re-resolution *looks*, and the fingerprint is what decides
 * whether what it found is what was selected. Neither is an identity claim.
 *
 * ## What the fingerprint is, and what it cannot do
 *
 * **The match's complete source slice** — `MatchView.source_text`, the bytes
 * `MatchView.span` names — and nothing else. It is a fact about how the file is
 * written, never a resolved value, so comparing it decides nothing that D2u
 * reserves.
 *
 * It used to be a *display* projection: `search_text`, the badges and the two
 * shape codes. The 1c-1 review found what that costs. `word`, `propagate_case`,
 * every variable, every form field, every unmodelled entry and every content
 * field the projection does not show first are all absent from those, so two
 * matches differing only in `word: true` / `word: false` fingerprinted
 * identically — and re-resolution answered `sameMatch` for the wrong snippet.
 * The slice cannot be blind that way: it is what the file says.
 *
 * **What is still outside it**, stated rather than hoped about:
 *
 * - **Two byte-identical matches are indistinguishable**, and remain so. A file
 *   holding two identical snippets that swap places re-resolves as `sameMatch`.
 *   Nothing in either match distinguishes them, and the user cannot see a
 *   difference either.
 * - **The slice is the match's own mapping**, so trivia outside it — a comment
 *   on the line above, a blank line — is not compared. Two byte-identical
 *   matches under different comments are the case above with one more reason to
 *   be careful; 1c-1 shows no leading comment, so nothing on screen disagrees.
 *
 * Both are stated as a hole in `docs/decisions/1c-1-notes.md`.
 */

import type { IpcFailure, ReselectionOutcome } from '../ipc/errors';
import { identityRecovery } from '../ipc/errors';
import type { CommandResult } from '../ipc/commands';
import type { DocumentId, DocumentView, MatchId, MatchView } from '../ipc/types';

/**
 * Every answer {@link reresolve} can give.
 *
 * Exported as a value because it is half of an agreement: the `reresolve` arm
 * of `identityRecovery` carries `mayFind`, and `selection.test.ts` asserts that
 * the two lists are the same set. A frontend that stopped handling
 * `differentMatch`, or a boundary that stopped admitting it, would break that
 * assertion rather than silently disagreeing.
 */
export const RESOLUTION_OUTCOMES: readonly ReselectionOutcome[] = [
  'sameMatch',
  'differentMatch',
  'gone'
];

/** Why a selection was dropped: the two outcomes that are not `sameMatch`. */
export type ClearedReason = Exclude<ReselectionOutcome, 'sameMatch'>;

/**
 * What the browser is holding when a snippet is selected.
 *
 * The identity is the thing to hand back to `get_match`. The other three
 * exist only for the moment the identity is refused.
 */
export interface SelectedMatch {
  /** The identity, scoped to the parse it was minted from. */
  readonly id: MatchId;
  /** The document it lives in. */
  readonly document: DocumentId;
  /**
   * Its index in that document's `matches`, at the time it was selected.
   *
   * **A position, not an identity.** It is where re-resolution starts looking
   * and never what it concludes from.
   */
  readonly position: number;
  /** The source-text fingerprint described in this module's header. */
  readonly fingerprint: string;
}

/**
 * The fingerprint of one match: its complete source slice.
 *
 * One field, on purpose. Any *selection* of fields is a comparison that can be
 * blind to a field it did not select, and the 1c-1 review found the version of
 * this function that was: it compared `search_text`, the badge list and the two
 * shape codes, none of which carries `word`, `propagate_case`, a variable, a
 * form field, an unmodelled entry, or a content field that is not the first.
 *
 * No scalar is resolved and no type is inferred (D2u): the slice is bytes out
 * of the file. A badge is not compared on top of it, because a badge is a
 * function of those same bytes — the core derives every one from a key's
 * presence or a `type` field's text — and neither are the two shape codes, for
 * the same reason.
 *
 * @param match - A match as it crossed the boundary.
 * @returns A string that changes whenever the match's own bytes do.
 */
export function matchFingerprint(match: MatchView): string {
  return match.source_text;
} // End of function matchFingerprint()

/**
 * Where one identity sits in a projection's match list.
 *
 * Compares the arena node, which is what a `MatchId` names inside one parse.
 * The revision is deliberately not compared here: the caller has just read this
 * projection, so a mismatch would mean it handed in an identity from a
 * different parse — a caller error rather than the staleness R27 is about, and
 * the boundary refuses that case with its own code.
 *
 * **That assumption has one kind of caller it is false for**, and 2c-3a-1's third
 * finding was exactly it: an *adoption* resolves an identity a save minted, in a
 * projection a later command read, so another program can move the file in between
 * and the fresh parse can reuse the node. `positionInSameParse` in
 * `./workspace.svelte.ts` is what such a caller uses instead — the same lookup
 * with all three fields compared first.
 *
 * @param view - The projection to look in.
 * @param id - The identity to find.
 * @returns The index, or `null` when the projection has no such node.
 */
export function positionOf(view: DocumentView, id: MatchId): number | null {
  const index = view.matches.findIndex((match) => match.id.node === id.node);
  return index === -1 ? null : index;
} // End of function positionOf()

/**
 * Builds the held selection for one match of one document.
 *
 * @param view - The document projection the match came from.
 * @param position - The match's index in `view.matches`.
 * @returns The selection to hold, or `null` when that index holds nothing.
 */
export function selectMatch(view: DocumentView, position: number): SelectedMatch | null {
  const match = view.matches[position];
  if (match === undefined) {
    return null;
  }
  return {
    id: match.id,
    document: view.id,
    position,
    fingerprint: matchFingerprint(match)
  };
} // End of function selectMatch()

/** What looking for the selection again in a fresh projection turned up. */
export type Reresolution =
  | { readonly outcome: 'sameMatch'; readonly selected: SelectedMatch }
  | { readonly outcome: 'differentMatch' }
  | { readonly outcome: 'gone' };

/**
 * Looks for a held selection in a fresh projection of the same document.
 *
 * Positional by necessity and never by assumption: it reads the same index and
 * then *checks* what is there. A different snippet at that index answers
 * `differentMatch`, which the caller must not treat as a hit — that is the
 * whole content of the correction R27 records.
 *
 * @param previous - The selection held before the document changed.
 * @param view - The projection of the bytes now on disk.
 * @returns Which of the three answers re-resolution found.
 */
export function reresolve(previous: SelectedMatch, view: DocumentView): Reresolution {
  const candidate = view.matches[previous.position];
  if (candidate === undefined) {
    return { outcome: 'gone' };
  }
  if (matchFingerprint(candidate) !== previous.fingerprint) {
    return { outcome: 'differentMatch' };
  }
  return {
    outcome: 'sameMatch',
    selected: {
      id: candidate.id,
      document: view.id,
      position: previous.position,
      fingerprint: previous.fingerprint
    }
  };
} // End of function reresolve()

/**
 * What the browser should do with its selection after a failed command.
 *
 * - `kept` — re-resolution found the same match, under a new identity.
 * - `cleared` — the selection is gone, and `reason` says which way.
 * - `unresolved` — the document could not be read again, so nothing is known.
 *   The selection is dropped, because keeping an identity nothing could check
 *   is exactly the stale hold R27 refuses.
 * - `unchanged` — the failure says nothing about the selection.
 *
 * **The two arms that read the document again carry what they read.** The
 * caller holds a cached projection of that document, and it is the *stale* one:
 * the identity that was just minted, the rows the list draws, the counts the
 * sidebar shows and the match the detail pane renders all come out of it. A
 * repair that handed back only the new identity would leave every one of those
 * describing bytes that are no longer on disk — which is the defect the 1c-1
 * review found. So `reloaded` is not an optimisation; it is the other half of
 * the answer, and `null` on `cleared` means precisely *no read happened*.
 */
export type SelectionRepair =
  | { readonly kind: 'kept'; readonly selected: SelectedMatch; readonly reloaded: DocumentView }
  | {
      readonly kind: 'cleared';
      readonly reason: ClearedReason;
      readonly reloaded: DocumentView | null;
    }
  | { readonly kind: 'unresolved'; readonly failure: IpcFailure }
  | { readonly kind: 'unchanged' };

/**
 * Reads one document again, for the recovery below.
 *
 * A parameter rather than an import so that the recovery can be driven without
 * a Tauri host; the real implementation is `reloadDocument` in `../ipc`.
 *
 * @param id - The document to read again.
 * @returns The projection of the bytes now on disk, or a failure.
 */
export type ReloadDocument = (id: DocumentId) => Promise<CommandResult<DocumentView>>;

/**
 * Decides what a failed command does to the held selection.
 *
 * The classification is `identityRecovery`'s, not this function's: it maps a
 * code to `reresolve` / `clearSelection` / `none`, and every arm below acts on
 * one of those three. Nothing here switches on an error code, so a new code
 * cannot be handled here and forgotten there.
 *
 * @param previous - The selection held when the command failed.
 * @param failure - The classified failure.
 * @param reload - Reads the document again, for the `reresolve` arm.
 * @returns What to do with the selection.
 */
export async function repairSelection(
  previous: SelectedMatch,
  failure: IpcFailure,
  reload: ReloadDocument
): Promise<SelectionRepair> {
  if (failure.kind !== 'command') {
    // An unexpected rejection is not a statement about any document, so it
    // cannot be read as one. The selection stands and the console gets the
    // developer string through `reportIpcFailure`.
    return { kind: 'unchanged' };
  }

  const recovery = identityRecovery(failure.error);
  switch (recovery.action) {
    case 'none':
      return { kind: 'unchanged' };
    case 'clearSelection':
      // The identity names something this projection does not have, and no
      // re-resolution could find it. That is `gone` in the same sense the
      // outcome union means it. Nothing was read, so there is nothing to
      // install: the cached projection is of the revision the boundary is still
      // answering from, and replacing it with itself would be a lie about a
      // read that did not happen.
      return { kind: 'cleared', reason: 'gone', reloaded: null };
    case 'reresolve': {
      const reloaded = await reload(previous.document);
      if (!reloaded.ok) {
        return { kind: 'unresolved', failure: reloaded.failure };
      }
      const found = reresolve(previous, reloaded.value);
      if (found.outcome === 'sameMatch') {
        return { kind: 'kept', selected: found.selected, reloaded: reloaded.value };
      }
      return { kind: 'cleared', reason: found.outcome, reloaded: reloaded.value };
    }
  }
} // End of function repairSelection()
