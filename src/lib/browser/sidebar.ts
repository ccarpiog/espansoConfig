/**
 * The sidebar model: which files exist, how they group, and how many snippets
 * each one holds.
 *
 * Plan section 8.1 draws three groups — files, profiles, packages — and section
 * 8.4 is the reason they are called *files*:
 *
 * > The groups-and-snippets metaphor implies stable entities with IDs. YAML
 * > provides neither. […] call sidebar items **Files** by default […] and
 * > **never hide the file boundary**.
 *
 * So this module never merges two documents, never invents a group, and never
 * reorders: the order is the one `list_documents` returned, which the core
 * sorts by path.
 *
 * ## Where each fact comes from
 *
 * Every property of a row is read off `DocumentSummary` and none is inferred:
 * `kind` decides the group, `disabled` is espanso's own "the file name starts
 * with `_`, so the default include glob skips it", and `read_only` is what makes
 * a package a package. Nothing here parses a path or looks at a file name.
 */

import type { DocumentId, DocumentSummary, FileKind } from '../ipc/types';

/** One row of the sidebar. */
export interface SidebarRow {
  /** The document this row stands for. */
  readonly document: DocumentSummary;
  /**
   * How many matches the document holds, or `null` when it is not loaded.
   *
   * `null` is not zero, and the two must not be rendered the same way: a file
   * whose projection has not arrived yet knows nothing about its own contents,
   * whereas a file with zero matches has been read and is empty.
   */
  readonly matches: number | null;
  /**
   * `true` when reading this file was **attempted and refused**.
   *
   * The third state of a count, and the reason it exists: *could not read* and
   * *have not read* are different facts about a file and both used to draw the
   * same `–`. A config profile nobody projected and a `match/` file whose
   * `get_document` came back `io / PermissionDenied` were one row apart and
   * indistinguishable. The 1c-1 window reading found it on a screen and named
   * it for 1c-2 (`docs/decisions/1c-1-notes.md` section 10.4, reading 4).
   *
   * Always paired with a `null` {@link SidebarRow.matches}: a refused read
   * produces no projection, so there is no count to have.
   */
  readonly unreadable: boolean;
}

/**
 * The three groups of the sidebar, plus the total the "All" entry shows.
 */
export interface SidebarModel {
  /**
   * How many matches are visible when no file is selected.
   *
   * The sum over every **loaded, match-bearing** document, so it grows as files
   * arrive and never counts a file twice. Both halves are enforced rather than
   * assumed: a document whose count is `null` contributes nothing — which is
   * why {@link SidebarModel.pending} exists, a total of 3 while two files are
   * still loading being a true statement about what is on screen and a
   * misleading one about the configuration — and a document
   * {@link holdsMatches} refuses contributes nothing either, whatever count it
   * is handed.
   */
  readonly total: number;
  /**
   * How many match-bearing documents are still expected to produce a count.
   *
   * A file whose read was **refused** is not pending: nothing is coming for it,
   * and counting it as waited-for would say the total is about to grow when it
   * is not. It is on {@link SidebarRow.unreadable} instead.
   */
  readonly pending: number;
  /** `match/` files espanso loads, in path order. */
  readonly files: readonly SidebarRow[];
  /** `config/` profiles, in path order. */
  readonly profiles: readonly SidebarRow[];
  /** Files from the Hub, which the editor may never write. */
  readonly packages: readonly SidebarRow[];
}

/** What the snippet list is currently showing. */
export type SidebarSelection =
  | { readonly kind: 'all' }
  | { readonly kind: 'document'; readonly id: DocumentId };

/** The selection the browser opens with. */
export const ALL_DOCUMENTS: SidebarSelection = { kind: 'all' };

/**
 * Returns `true` when two selections name the same thing.
 *
 * @param a - One selection.
 * @param b - The other.
 * @returns Whether they are the same selection.
 */
export function sameSelection(a: SidebarSelection, b: SidebarSelection): boolean {
  if (a.kind === 'all' || b.kind === 'all') {
    return a.kind === b.kind;
  }
  return a.id === b.id;
} // End of function sameSelection()

/**
 * Whether a document holds matches at all.
 *
 * A config profile does not, which is why the "All" total ignores them and why
 * their rows show "not read yet" rather than a count of zero.
 *
 * **What this no longer governs, since the 1c-2b-1 review: whether a document is
 * projected.** It used to, and that was the wrong test — a profile has no
 * matches and it does have *diagnostics*, so skipping the projection made a
 * profile with broken YAML silent everywhere in the application. It governs
 * counting only.
 *
 * Widened to `{ kind }` for the same review: the caller that decides which
 * projections contribute a count holds a `DocumentView`, which carries the same
 * `kind` the summary does, and looking the summary back up by identity to ask
 * one question would be a scan per document per render.
 *
 * @param document - Anything carrying a document's {@link FileKind}.
 * @returns Whether the document is one the snippet list can draw from.
 */
export function holdsMatches(document: { readonly kind: FileKind }): boolean {
  return document.kind === 'MatchFile' || document.kind === 'Package';
} // End of function holdsMatches()

/**
 * Builds the sidebar model from the document list and the counts known so far.
 *
 * @param documents - Every document of the workspace, in the order the command
 *   returned them.
 * @param counts - How many matches each loaded document holds, keyed by
 *   document identity. A document absent from this map has not been read yet.
 * @param unreadable - The documents whose read was attempted and refused.
 *   Defaults to none, so a caller with nothing to report writes nothing.
 * @returns The three groups and the totals.
 */
export function buildSidebar(
  documents: readonly DocumentSummary[],
  counts: ReadonlyMap<DocumentId, number>,
  unreadable: ReadonlySet<DocumentId> = new Set()
): SidebarModel {
  const files: SidebarRow[] = [];
  const profiles: SidebarRow[] = [];
  const packages: SidebarRow[] = [];
  let total = 0;
  let pending = 0;

  for (const document of documents) {
    const known = counts.get(document.id);
    const matches = known === undefined ? null : known;
    const refused = unreadable.has(document.id);
    const row: SidebarRow = { document, matches, unreadable: refused };
    if (holdsMatches(document)) {
      if (matches === null) {
        // A refused read is not a pending one: no count is on its way.
        pending += refused ? 0 : 1;
      } else {
        // `holdsMatches` guards the total as well as the wait. A count handed
        // in for a config profile is a caller error, and adding it would make
        // the "All" total disagree with the list the "All" entry shows, which
        // draws from match-bearing documents only.
        total += matches;
      }
    }
    switch (document.kind) {
      case 'MatchFile':
        files.push(row);
        break;
      case 'ConfigProfile':
        profiles.push(row);
        break;
      case 'Package':
        packages.push(row);
        break;
    }
  } // End of the loop over the workspace's documents

  return { total, pending, files, profiles, packages };
} // End of function buildSidebar()
