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

import type { DocumentId, DocumentSummary } from '../ipc/types';

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
  /** How many documents have no count yet. */
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
 * A config profile does not, which is why the "All" total and the snippet list
 * both ignore them rather than showing an empty row per profile.
 *
 * @param document - A document summary as it crossed the boundary.
 * @returns Whether the document is one the snippet list can draw from.
 */
export function holdsMatches(document: DocumentSummary): boolean {
  return document.kind === 'MatchFile' || document.kind === 'Package';
} // End of function holdsMatches()

/**
 * Builds the sidebar model from the document list and the counts known so far.
 *
 * @param documents - Every document of the workspace, in the order the command
 *   returned them.
 * @param counts - How many matches each loaded document holds, keyed by
 *   document identity. A document absent from this map has not been read yet.
 * @returns The three groups and the totals.
 */
export function buildSidebar(
  documents: readonly DocumentSummary[],
  counts: ReadonlyMap<DocumentId, number>
): SidebarModel {
  const files: SidebarRow[] = [];
  const profiles: SidebarRow[] = [];
  const packages: SidebarRow[] = [];
  let total = 0;
  let pending = 0;

  for (const document of documents) {
    const known = counts.get(document.id);
    const matches = known === undefined ? null : known;
    const row: SidebarRow = { document, matches };
    if (holdsMatches(document)) {
      if (matches === null) {
        pending += 1;
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
