/**
 * R27 in the one place that holds an identity: the selection.
 *
 * > A stale revision means **the document moved on**, and nothing about whether
 * > the match survived. Re-resolution has three possible answers — the same
 * > match, a **different** match, or nothing.
 *
 * The counterexample that produced that wording is
 * `a_document_path_is_positional_so_a_deletion_repoints_it` in
 * `src-tauri/src/commands.rs`: delete the first match of a file and `matches[1]`
 * still resolves, to what used to be `matches[2]`. The frontend twin is
 * `deleting an earlier match must not move the selection`, below — it builds
 * exactly that file, deletes exactly that match, and asserts the selection is
 * **cleared** rather than moved. An implementation that trusts the position
 * passes every other test in this file and fails that one.
 *
 * The agreement test is the other half: `RESOLUTION_OUTCOMES` here and
 * `mayFind` on the boundary's `reresolve` arm are asserted to be the same set,
 * so neither side can quietly stop admitting `differentMatch`.
 *
 * The 1c-1 review added a second counterexample, and it is the sharper one:
 * two matches differing **only** in `word: true` / `word: false`. Nothing the
 * old fingerprint compared could see that difference, so a deletion that moved
 * the second into the first's position re-resolved as `sameMatch` and the
 * browser selected the wrong snippet without saying so. `answers differentMatch
 * for a twin that differs only in an option` is that file, and `changes when an
 * option no other field of the view carries changes` is the same fact one level
 * down, with the premise asserted so the test cannot pass vacuously.
 */

import { describe, expect, it, vi } from 'vitest';
import { identityRecovery } from '../ipc/errors';
import type { IpcFailure } from '../ipc/errors';
import type { CommandResult } from '../ipc/commands';
import type { DocumentView } from '../ipc/types';
import { makeDocument, makeMatch } from './fixtures';
import {
  RESOLUTION_OUTCOMES,
  matchFingerprint,
  positionOf,
  repairSelection,
  reresolve,
  selectMatch
} from './selection';

/** The three matches of the document every case below starts from. */
function original(): DocumentView {
  return makeDocument({
    id: 5,
    revision: 'rev-a',
    matches: [
      makeMatch({ node: 10, document: 5, revision: 'rev-a', trigger: ':first', label: 'First' }),
      makeMatch({ node: 11, document: 5, revision: 'rev-a', trigger: ':second', label: 'Second' }),
      makeMatch({ node: 12, document: 5, revision: 'rev-a', trigger: ':third', label: 'Third' })
    ]
  });
} // End of function original()

/** A stale-revision failure, as it arrives from the boundary. */
const STALE: IpcFailure = {
  kind: 'command',
  error: { code: 'identityStaleRevision', expected: 'rev-b', found: 'rev-a' }
};

/** A no-such-match failure, as it arrives from the boundary. */
const NO_SUCH_MATCH: IpcFailure = {
  kind: 'command',
  error: { code: 'identityNoSuchMatch', node: 11 }
};

/** A failure that says nothing about any selection. */
const UNRELATED: IpcFailure = {
  kind: 'command',
  error: { code: 'io', path: '/tmp/espanso/match/base.yml', kind: 'PermissionDenied' }
};

/**
 * A reload that answers with one projection.
 *
 * @param view - What the document now projects to.
 * @returns The reload function, wrapped so calls can be counted.
 */
function reloadWith(view: DocumentView): (id: number) => Promise<CommandResult<DocumentView>> {
  return vi.fn(async () => ({ ok: true, value: view }) as CommandResult<DocumentView>);
} // End of function reloadWith()

describe('the outcomes the two sides agree on', () => {
  it('are exactly what the boundary says re-resolution may find', () => {
    const recovery = identityRecovery({
      code: 'identityStaleRevision',
      expected: 'a',
      found: 'b'
    });
    expect(recovery.action).toBe('reresolve');
    const mayFind = recovery.action === 'reresolve' ? recovery.mayFind : [];
    expect([...mayFind].sort()).toEqual([...RESOLUTION_OUTCOMES].sort());
  });
}); // End of the "outcomes agree" suite

describe('re-resolution', () => {
  it('finds the same match when the file changed elsewhere', () => {
    const held = selectMatch(original(), 1);
    expect(held).not.toBeNull();
    const reparsed = makeDocument({
      id: 5,
      revision: 'rev-b',
      matches: [
        makeMatch({ node: 20, document: 5, revision: 'rev-b', trigger: ':first', label: 'First' }),
        makeMatch({ node: 21, document: 5, revision: 'rev-b', trigger: ':second', label: 'Second' }),
        makeMatch({ node: 22, document: 5, revision: 'rev-b', trigger: ':third', label: 'Third' })
      ]
    });
    const found = reresolve(held!, reparsed);
    expect(found.outcome).toBe('sameMatch');
    // The identity is the *new* one: the old one is scoped to a parse that no
    // longer exists, and handing it back would be refused again.
    expect(found.outcome === 'sameMatch' ? found.selected.id.node : null).toBe(21);
    expect(found.outcome === 'sameMatch' ? found.selected.id.revision : null).toBe('rev-b');
  });

  it('answers differentMatch when an earlier match was deleted', () => {
    const held = selectMatch(original(), 1);
    const reparsed = makeDocument({
      id: 5,
      revision: 'rev-b',
      matches: [
        makeMatch({ node: 20, document: 5, revision: 'rev-b', trigger: ':second', label: 'Second' }),
        makeMatch({ node: 21, document: 5, revision: 'rev-b', trigger: ':third', label: 'Third' })
      ]
    });
    expect(reresolve(held!, reparsed).outcome).toBe('differentMatch');
  });

  it('answers differentMatch for a twin that differs only in an option', () => {
    // The 1c-1 review's failure scenario, run end to end. Position 0 held the
    // `word: true` match; it is the one deleted, so position 0 now holds its
    // `word: false` twin — same trigger, same content, same badges, same
    // haystack, same two shape codes. The fingerprint this phase shipped with
    // answered `sameMatch` here, and the browser silently selected the other
    // snippet.
    const twins = makeDocument({
      id: 5,
      revision: 'rev-a',
      matches: [
        makeMatch({
          node: 10,
          document: 5,
          trigger: ':same',
          replace: 'body',
          options: { word: 'true' }
        }),
        makeMatch({
          node: 11,
          document: 5,
          trigger: ':same',
          replace: 'body',
          options: { word: 'false' }
        })
      ]
    });
    const held = selectMatch(twins, 0);
    const afterDeletion = makeDocument({
      id: 5,
      revision: 'rev-b',
      matches: [
        makeMatch({
          node: 20,
          document: 5,
          revision: 'rev-b',
          trigger: ':same',
          replace: 'body',
          options: { word: 'false' }
        })
      ]
    });
    expect(reresolve(held!, afterDeletion).outcome).toBe('differentMatch');
  });

  it('answers gone when nothing is at that position any more', () => {
    const held = selectMatch(original(), 2);
    const reparsed = makeDocument({
      id: 5,
      revision: 'rev-b',
      matches: [makeMatch({ node: 20, document: 5, revision: 'rev-b', trigger: ':first' })]
    });
    expect(reresolve(held!, reparsed).outcome).toBe('gone');
  });
}); // End of the "re-resolution" suite

describe('the fingerprint', () => {
  it('changes when any visible field of the match changes', () => {
    // One assertion per field would pass against an implementation that reads
    // only the field that assertion moved, so all three move independently
    // from the same base.
    const base = makeMatch({ trigger: ':a', replace: 'body', label: 'One' });
    for (const changed of [
      makeMatch({ trigger: ':b', replace: 'body', label: 'One' }),
      makeMatch({ trigger: ':a', replace: 'other', label: 'One' }),
      makeMatch({ trigger: ':a', replace: 'body', label: 'Two' })
    ]) {
      expect(matchFingerprint(changed)).not.toBe(matchFingerprint(base));
    } // End of the loop over the three one-field changes
  });

  it('changes when an option no other field of the view carries changes', () => {
    // The 1c-1 review's counterexample. `word` produces no badge, changes
    // neither shape code and is absent from `search_text` — the three things
    // the fingerprint used to be — so the premise is asserted first and the
    // property second. An implementation that goes back to the display
    // projection fails on the second assertion while passing every other test
    // in this file.
    const on = makeMatch({ trigger: ':same', replace: 'body', options: { word: 'true' } });
    const off = makeMatch({ trigger: ':same', replace: 'body', options: { word: 'false' } });
    expect(on.search_text).toBe(off.search_text);
    expect(on.badges).toEqual(off.badges);
    expect(on.trigger.kind).toBe(off.trigger.kind);
    expect(on.content.kind).toBe(off.content.kind);

    expect(matchFingerprint(on)).not.toBe(matchFingerprint(off));
  });

  it('ignores the identity, which is what makes it usable across a reparse', () => {
    expect(matchFingerprint(makeMatch({ node: 1, revision: 'rev-a', trigger: ':a' }))).toBe(
      matchFingerprint(makeMatch({ node: 99, revision: 'rev-z', trigger: ':a' }))
    );
  });

  it('cannot tell two byte-identical matches apart, which is its honest limit', () => {
    // Not a defect to be fixed by widening the comparison: there is nothing
    // left to widen it with. Two matches whose bytes agree are the same text in
    // the same file, and the user cannot see a difference either. Hole 3 of
    // `docs/decisions/1c-1-notes.md` says so in the same words.
    const twin = { sourceText: '- trigger: :same\n  replace: body' } as const;
    expect(matchFingerprint(makeMatch({ node: 1, ...twin }))).toBe(
      matchFingerprint(makeMatch({ node: 2, ...twin }))
    );
  });
}); // End of the "fingerprint" suite

describe('positionOf', () => {
  it('finds the node the identity names', () => {
    expect(positionOf(original(), { document: 5, revision: 'rev-a', node: 12 })).toBe(2);
  });

  it('answers null rather than -1 for a node that is not there', () => {
    expect(positionOf(original(), { document: 5, revision: 'rev-a', node: 99 })).toBeNull();
  });
}); // End of the "positionOf" suite

describe('repairSelection', () => {
  it('keeps a selection re-resolution found again', async () => {
    const held = selectMatch(original(), 1);
    const reparsed = makeDocument({
      id: 5,
      revision: 'rev-b',
      matches: [
        makeMatch({ node: 20, document: 5, revision: 'rev-b', trigger: ':first', label: 'First' }),
        makeMatch({ node: 21, document: 5, revision: 'rev-b', trigger: ':second', label: 'Second' }),
        makeMatch({ node: 22, document: 5, revision: 'rev-b', trigger: ':third', label: 'Third' })
      ]
    });
    const repair = await repairSelection(held!, STALE, reloadWith(reparsed));
    expect(repair.kind).toBe('kept');
    expect(repair.kind === 'kept' ? repair.selected.id.node : null).toBe(21);
    expect(repair.kind === 'kept' ? repair.reloaded : null).toBe(reparsed);
  });

  it('clears the selection when deleting an earlier match repointed the position', async () => {
    const held = selectMatch(original(), 1);
    const afterDeletion = makeDocument({
      id: 5,
      revision: 'rev-b',
      matches: [
        makeMatch({ node: 20, document: 5, revision: 'rev-b', trigger: ':second', label: 'Second' }),
        makeMatch({ node: 21, document: 5, revision: 'rev-b', trigger: ':third', label: 'Third' })
      ]
    });
    const repair = await repairSelection(held!, STALE, reloadWith(afterDeletion));
    expect(repair.kind).toBe('cleared');
    expect(repair.kind === 'cleared' ? repair.reason : null).toBe('differentMatch');
    // The projection the decision was taken from comes back with it: the caller
    // is holding a stale one, and clearing the selection without replacing it
    // leaves the deleted snippet in the list.
    expect(repair.kind === 'cleared' ? repair.reloaded : null).toBe(afterDeletion);
  });

  it('clears the selection when the match is gone', async () => {
    const held = selectMatch(original(), 2);
    const truncated = makeDocument({ id: 5, revision: 'rev-b', matches: [] });
    expect(await repairSelection(held!, STALE, reloadWith(truncated))).toEqual({
      kind: 'cleared',
      reason: 'gone',
      reloaded: truncated
    });
  });

  it('does not even try to re-resolve a match the projection does not have', async () => {
    const held = selectMatch(original(), 1);
    const reload = vi.fn(reloadWith(original()));
    expect(await repairSelection(held!, NO_SUCH_MATCH, reload)).toEqual({
      kind: 'cleared',
      reason: 'gone',
      // No read happened, so there is nothing to install — and saying so is
      // different from handing back the stale projection.
      reloaded: null
    });
    expect(reload).not.toHaveBeenCalled();
  });

  it('reports that it could not tell, rather than guessing, when the reload fails', async () => {
    const held = selectMatch(original(), 1);
    const failure: IpcFailure = { kind: 'command', error: { code: 'unknownDocument', document: 5 } };
    const repair = await repairSelection(held!, STALE, async () => ({ ok: false, failure }));
    expect(repair.kind).toBe('unresolved');
  });

  it('leaves the selection alone for a failure that says nothing about it', async () => {
    const held = selectMatch(original(), 1);
    const reload = vi.fn(reloadWith(original()));
    expect(await repairSelection(held!, UNRELATED, reload)).toEqual({ kind: 'unchanged' });
    expect(reload).not.toHaveBeenCalled();
  });

  it('leaves the selection alone for a rejection this build does not recognise', async () => {
    const held = selectMatch(original(), 1);
    const reload = vi.fn(reloadWith(original()));
    expect(await repairSelection(held!, { kind: 'unexpected' }, reload)).toEqual({
      kind: 'unchanged'
    });
    expect(reload).not.toHaveBeenCalled();
  });
}); // End of the "repairSelection" suite

describe('selectMatch', () => {
  it('records the position and the fingerprint beside the identity', () => {
    const view = original();
    const held = selectMatch(view, 0);
    expect(held?.position).toBe(0);
    expect(held?.document).toBe(5);
    expect(held?.id.node).toBe(10);
    // The fingerprint is asserted rather than named: a selection holding the
    // *wrong* match's fingerprint re-resolves to `differentMatch` for a file
    // nothing changed.
    expect(held?.fingerprint).toBe(matchFingerprint(view.matches[0]!));
    expect(held?.fingerprint).not.toBe(matchFingerprint(view.matches[1]!));
  });

  it('answers null for a position the document does not have', () => {
    expect(selectMatch(original(), 9)).toBeNull();
  });
}); // End of the "selectMatch" suite
