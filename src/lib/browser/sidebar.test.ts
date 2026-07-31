/**
 * The sidebar's grouping and its counts.
 *
 * Three claims, each of which a plausible implementation gets wrong:
 *
 * 1. **A file's count is the count of that file**, not of the group. The
 *    obvious bug is an off-by-one group boundary, and the fixture below has two
 *    files with different counts so that swapping them fails.
 * 2. **"Not loaded yet" is not "zero".** `counts.get()` returns `undefined` for
 *    a file that has not been read, and an implementation writing `?? 0` passes
 *    every other assertion here while telling the user that a file they have
 *    not opened is empty.
 * 3. **A config profile holds no matches**, so it is neither counted in the
 *    "All" total nor waited for.
 */

import { describe, expect, it } from 'vitest';
import { makeSummary } from './fixtures';
import { ALL_DOCUMENTS, buildSidebar, holdsMatches, sameSelection } from './sidebar';
import type { DocumentId } from '../ipc/types';

/** The four documents every case below is built from, in list order. */
const DOCUMENTS = [
  makeSummary({ id: 1, relativePath: 'config/default.yml', kind: 'ConfigProfile' }),
  makeSummary({ id: 2, relativePath: 'match/base.yml' }),
  makeSummary({ id: 3, relativePath: 'match/_drafts.yml', disabled: true }),
  makeSummary({
    id: 4,
    relativePath: 'match/packages/example/package.yml',
    kind: 'Package',
    readOnly: true
  })
];

/**
 * The counts of a partially loaded workspace.
 *
 * @returns Counts for two of the three match-bearing documents.
 */
function partialCounts(): ReadonlyMap<DocumentId, number> {
  return new Map<DocumentId, number>([
    [2, 3],
    [4, 7]
  ]);
} // End of function partialCounts()

describe('grouping', () => {
  const model = buildSidebar(DOCUMENTS, partialCounts());

  it('puts each document in the group its kind names', () => {
    expect(model.files.map((row) => row.document.id)).toEqual([2, 3]);
    expect(model.profiles.map((row) => row.document.id)).toEqual([1]);
    expect(model.packages.map((row) => row.document.id)).toEqual([4]);
  });

  it('keeps the order the command returned', () => {
    expect(model.files.map((row) => row.document.relative_path)).toEqual([
      'match/base.yml',
      'match/_drafts.yml'
    ]);
  });

  it('carries the not-auto-loaded flag through untouched', () => {
    expect(model.files.map((row) => row.document.disabled)).toEqual([false, true]);
  });

  it('carries the read-only flag the lock is drawn from', () => {
    expect(model.packages[0]?.document.read_only).toBe(true);
  });
}); // End of the "grouping" suite

describe('counts', () => {
  const model = buildSidebar(DOCUMENTS, partialCounts());

  it('gives each file its own count', () => {
    expect(model.files[0]?.matches).toBe(3);
    expect(model.packages[0]?.matches).toBe(7);
  });

  it('distinguishes "not read yet" from "empty"', () => {
    const readAndEmpty = buildSidebar([makeSummary({ id: 9 })], new Map<DocumentId, number>([[9, 0]]));
    expect(model.files[1]?.matches).toBeNull();
    expect(readAndEmpty.files[0]?.matches).toBe(0);
  });

  it('counts the pending documents, so a partial total can say so', () => {
    expect(model.pending).toBe(1);
  });

  it('totals only what is loaded', () => {
    expect(model.total).toBe(10);
  });

  it('neither waits for a profile nor counts one, whatever count it is handed', () => {
    // Both halves of the claim, and the second needs an adversarial input: a
    // profile with **no** count tests only `pending`, and the version of
    // `buildSidebar` this phase shipped with added 5 to the total here while
    // `holdsMatches` said the document holds none.
    const profilesOnly = buildSidebar(
      [makeSummary({ id: 1, kind: 'ConfigProfile' })],
      new Map<DocumentId, number>([[1, 5]])
    );
    expect(profilesOnly.pending).toBe(0);
    expect(profilesOnly.total).toBe(0);
    // The row still shows what it was handed: the total is the claim being
    // narrowed, not the count of a row nothing asked about.
    expect(profilesOnly.profiles[0]?.matches).toBe(5);
  });

  it('does not wait for a profile that has not been read either', () => {
    const unread = buildSidebar(
      [makeSummary({ id: 1, kind: 'ConfigProfile' })],
      new Map<DocumentId, number>()
    );
    expect(unread.pending).toBe(0);
    expect(unread.total).toBe(0);
  });

  it('grows as files arrive', () => {
    const complete = buildSidebar(
      DOCUMENTS,
      new Map<DocumentId, number>([
        [2, 3],
        [3, 1],
        [4, 7]
      ])
    );
    expect(complete.total).toBe(11);
    expect(complete.pending).toBe(0);
  });
}); // End of the "counts" suite

describe('which documents can hold matches', () => {
  it.each([
    ['MatchFile', true],
    ['Package', true],
    ['ConfigProfile', false]
  ] as const)('%s: %s', (kind, expected) => {
    expect(holdsMatches(makeSummary({ kind }))).toBe(expected);
  });
}); // End of the "holdsMatches" suite

describe('selection equality', () => {
  it('tells "all" from a document', () => {
    expect(sameSelection(ALL_DOCUMENTS, { kind: 'document', id: 1 })).toBe(false);
  });

  it('tells two documents apart', () => {
    expect(sameSelection({ kind: 'document', id: 1 }, { kind: 'document', id: 2 })).toBe(false);
    expect(sameSelection({ kind: 'document', id: 2 }, { kind: 'document', id: 2 })).toBe(true);
  });

  it('is true for two "all"s', () => {
    expect(sameSelection(ALL_DOCUMENTS, { kind: 'all' })).toBe(true);
  });
}); // End of the "selection equality" suite
