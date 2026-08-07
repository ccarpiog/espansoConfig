/**
 * Moving one snippet, driven without a screen.
 *
 * Seven groups:
 *
 * 1. **the sequence** — consult correction 4: the invariant is *same sequence*,
 *    derived from `MatchView.path`, and never *same file*;
 * 2. **eligibility** — the five refusals, including the dirty-draft rule the
 *    consult's Q9 puts here as an input rather than in a component;
 * 3. **the destination panel** — the consult's Q1 and Q6: three arms, the
 *    complete unfiltered sequence, and the moving snippet excluded from its own
 *    anchors;
 * 4. **choosing, and the lowering `end` really is** — the wire has no `End`;
 * 5. **starting a move** — the live-identity check, the frozen base revision, and
 *    the destinations this module refuses to send;
 * 6. **the answer** — the three arms, the acknowledgement round trip, the two
 *    arms of a send that produced no outcome, and the recovery the consult's Q8
 *    asks for;
 * 7. **the view** — what a screen would draw, derived on every read.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { describe, expect, it } from 'vitest';
import { DICTIONARIES } from '../i18n/dictionaries';
import { LOCALES } from '../i18n/locale';
import type { IpcFailure } from '../ipc/errors';
import type {
  ConflictResult,
  ContentRevision,
  DocumentPath,
  DocumentView,
  Finding,
  MatchId,
  MatchView,
  PresentationNote,
  SaveResult
} from '../ipc/types';
import { makeDocument, makeMatch, matchListPath } from './fixtures';
import type { InvalidationStatus } from './invalidation';
import { identityInProjection } from './matchDeletion';
import {
  acknowledgeMoveFindings,
  applyMove,
  askToReloadDiskVersion,
  baseRevisionOf,
  beginMove,
  canChoose,
  canMove,
  choosePlacement,
  confirmDiskReload,
  conflictOf,
  dismissMoveOutcome,
  lowerPlacement,
  matchMoveView,
  membersOfSequence,
  moveCouldNotBeSent,
  moveEligibility,
  movePlacementOptionsOf,
  moveRecoveryChoices,
  moveRecoveryFailed,
  moveRecoveryKey,
  moveRefusalKey,
  moveSubmissionRefusal,
  moveSubmissionRefusalKey,
  placementOf,
  reloadTheDiskVersion,
  sameSequence,
  sequenceOf,
  startMatchMove,
  type MatchMoveSession,
  type MovePlacement,
  type MoveRefusal,
  type MoveSubmissionRefusal
} from './matchMove';
import type { AdoptTheDiskVersion } from './editorSave';
import type { DiskAdoptionOutcome } from './saveOutcome';
import type { ConflictChoice, ConflictModel } from './saveOutcome';

/** The revision every projection below is minted from. */
const BASE: ContentRevision = 'a'.repeat(64);

/** The revision the file holds after a commit. */
const AFTER: ContentRevision = 'b'.repeat(64);

/**
 * One snippet of the file's own `matches:` list.
 *
 * The `path` is what makes it an *item of a sequence*, which is the whole subject
 * of this file: a fixture without one is a snippet this application cannot
 * address as an item of a list and therefore cannot move.
 *
 * @param node - The arena node, which is also the identity's node.
 * @param index - Its position in the list, which is what its path ends in.
 * @param trigger - Its trigger, so the fixtures are distinguishable on screen.
 * @returns The projection.
 */
function item(node: number, index: number, trigger: string): MatchView {
  return makeMatch({
    node,
    document: 2,
    revision: BASE,
    trigger,
    path: matchListPath(index)
  });
} // End of function item()

/**
 * A snippet file with three snippets in one list.
 *
 * **Three rather than two**, because a two-item sequence cannot tell a middle
 * position from an end one, and the `end` lowering is exactly a claim about the
 * last item.
 *
 * @param overrides - Whatever a case needs beyond the three snippets.
 * @returns The projection.
 */
function file(overrides: Parameters<typeof makeDocument>[0] = {}): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision: BASE,
    matches: [item(10, 0, ':sig'), item(11, 1, ':date'), item(12, 2, ':sql')],
    ...overrides
  });
} // End of function file()

/**
 * The same file, as this window holds it after reading it again.
 *
 * **The arena nodes are deliberately kept and only the revision moves.** A fixture
 * that renumbered them would let a case pass by finding nothing, which is a weaker
 * claim than the one these cases make: an identity minted from an earlier parse is
 * refused even when the node it names is still occupied — a `MatchId` is
 * session-local, and node 10 of the new parse is not node 10 of the old one.
 *
 * @param overrides - Whatever a case needs the re-read file to keep saying about
 *   itself, such as the kind and read-only flag a packaged file does not lose by
 *   being read again.
 * @returns The projection this window holds after the re-read.
 */
function reread(overrides: Parameters<typeof makeDocument>[0] = {}): DocumentView {
  return file({
    revision: AFTER,
    matches: [
      makeMatch({ node: 10, document: 2, revision: AFTER, trigger: ':sig', path: matchListPath(0) }),
      makeMatch({
        node: 11,
        document: 2,
        revision: AFTER,
        trigger: ':date',
        path: matchListPath(1)
      }),
      makeMatch({ node: 12, document: 2, revision: AFTER, trigger: ':sql', path: matchListPath(2) })
    ],
    ...overrides
  });
} // End of function reread()

/**
 * A session over one snippet of {@link file}, with nothing drafted anywhere.
 *
 * @param position - Which snippet of the list the move is about.
 * @param document - The projection to take the pair from.
 * @returns The session.
 */
function session(position = 0, document: DocumentView = file()) {
  return startMatchMove(document, document.matches[position]!, null);
} // End of function session()

/**
 * The identity the window's **current** projection gives one snippet.
 *
 * What a screen would read off the live projection with `identityInProjection`
 * and hand to {@link beginMove}, which is the only argument there that comes from
 * outside the session and therefore the only one that can notice a reprojection.
 *
 * @param position - Which snippet.
 * @param document - The projection the window is holding now.
 * @returns That projection's identity for it.
 */
function live(position = 0, document: DocumentView = file()): MatchId {
  return document.matches[position]!.id;
} // End of function live()

/**
 * The projections the window holds while a session over {@link file} is fresh.
 *
 * Every question about what a session can do now is asked of the projections this
 * window is holding, so every case has to say which those are. This is the
 * ordinary answer: the file as the session was opened over it.
 */
const HELD: readonly DocumentView[] = [file()];

/** The adoption a save that wrote nothing owes: none. */
const NOT_OWED: InvalidationStatus = { kind: 'notOwed' };

/** The adoption a save this window had to re-read the file after performed. */
const ADOPTED: InvalidationStatus = { kind: 'done' };

/** The adoption a committed move could not perform. */
const NOT_ADOPTED: InvalidationStatus = {
  kind: 'failed',
  failure: { kind: 'command', error: { code: 'unknownDocument', document: 2 } }
};

/**
 * A `saved` outcome.
 *
 * **The revision is a parameter and it is not decoration.** A `committed: false`
 * answer whose revision is the one this window was already projecting owes no
 * adoption and spends nothing; one whose revision has moved owes an adoption, and
 * that adoption replaces every identity a session holds without a byte being
 * written. Pairing the second with a `notOwed` was how the first version of these
 * tests hid it.
 *
 * @param committed - Whether the file was rewritten.
 * @param moved - The moved snippet's identity in the new revision, or `null`.
 * @param revision - The revision the transaction ended on.
 * @param notes - What the save had to change about the way the file is written.
 * @returns The wire result.
 */
function saved(
  committed = true,
  moved: MatchId | null = null,
  revision: ContentRevision = AFTER,
  notes: readonly PresentationNote[] = []
): SaveResult {
  return {
    outcome: 'saved',
    revision,
    committed,
    notes,
    backup_taken: false,
    moved
  };
} // End of function saved()

/** A finding the gate reported about the move. */
const SUSPICION: Finding = {
  code: { ReferenceHasNoDeclaration: { name: 'greeting' } },
  span: null,
  node: null,
  path: null
};

/** A refusal carrying that finding. */
const REFUSED: SaveResult = {
  outcome: 'refused',
  verdict: 'RefusedForUnacknowledgedSuspicions',
  findings: [SUSPICION]
};

/**
 * A conflict: the file moved on and nothing was written.
 *
 * **Its `disk` is the re-read projection and not the one the session was opened
 * over**, because that is what a conflict is: the bytes on disk are not the ones
 * this window was projecting. `BrowserState.moveMatch` installs it, so a case
 * about what happens after a conflict has to hand that projection back.
 */
const CONFLICT: ConflictResult = {
  outcome: 'conflict',
  reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
  expected: BASE,
  found: AFTER,
  disk_revision: AFTER,
  disk_text: 'matches:\n  - trigger: x\n    replace: theirs\n',
  disk: reread()
};

/**
 * A rejection this application cannot tell the outcome of.
 *
 * **`saveFailed` and nothing else**: `mayHaveWritten` in `../ipc/errors` answers
 * `true` for that one code, and a directory sync interrupted after the rename is
 * what the save transaction reports it for. Shared by the cases below so that
 * every one of them is about the failure production really produces.
 */
const UNCERTAIN: IpcFailure = {
  kind: 'command',
  error: {
    code: 'saveFailed',
    error: {
      Write: {
        Io: { step: 'SyncDirectory', path: 'match/base.yml', kind: 'Interrupted', raw_os_error: 4 }
      }
    },
    may_have_written: true
  }
};

describe('the sequence a snippet is an item of', () => {
  it('is the path with its own index taken off', () => {
    expect(sequenceOf(item(10, 0, ':sig'))).toEqual({
      document: 2,
      documentIndex: 0,
      segments: [{ Key: 'matches' }]
    });
    // The prefix is the same for every item of the list, which is what makes the
    // three of them co-sequential.
    expect(sequenceOf(item(11, 7, ':date'))).toEqual(sequenceOf(item(10, 0, ':sig')));
  });

  it('is nothing for a snippet with no addressable position', () => {
    expect(sequenceOf(makeMatch({ node: 10, document: 2, revision: BASE }))).toBeNull();
    // A path that ends in a *key* addresses a mapping entry, not an item of a
    // sequence, so there is no sequence to move it within.
    const keyed: DocumentPath = { document_index: 0, segments: [{ Key: 'matches' }] };
    expect(sequenceOf(makeMatch({ node: 10, document: 2, revision: BASE, path: keyed }))).toBeNull();
    const rootless: DocumentPath = { document_index: 0, segments: [] };
    expect(
      sequenceOf(makeMatch({ node: 10, document: 2, revision: BASE, path: rootless }))
    ).toBeNull();
  });

  it('is not the file, so two files with one path shape are two sequences', () => {
    // **Consult correction 4.** A `DocumentPath` addresses a node *within* one
    // file and carries nothing that names the file, so `matches[0]` of two files
    // is one path and two sequences. Encoding "same file means same sequence"
    // would make this comparison answer `true`.
    const here = sequenceOf(item(10, 0, ':sig'));
    const elsewhere = sequenceOf(
      makeMatch({ node: 20, document: 3, revision: BASE, path: matchListPath(0) })
    );
    expect(here).not.toBeNull();
    expect(elsewhere).not.toBeNull();
    expect(sameSequence(here!, elsewhere!)).toBe(false);
    // And the stream document is part of it too: espanso loads the first, but the
    // projection can address others.
    const second = sequenceOf(
      makeMatch({ node: 13, document: 2, revision: BASE, path: matchListPath(0, 1) })
    );
    expect(sameSequence(here!, second!)).toBe(false);
  });

  it('collects the members of one sequence and no other, in file order', () => {
    // Two sequences in one file, which today's projection does not produce and
    // which this model must not assume away: the `vars` items below are addressed
    // under a different key, so they are not destinations for a `matches` item.
    const elsewhere: DocumentPath = {
      document_index: 0,
      segments: [{ Key: 'global_vars' }, { Index: 0 }]
    };
    const mixed = file({
      matches: [
        item(10, 0, ':sig'),
        makeMatch({ node: 90, document: 2, revision: BASE, path: elsewhere }),
        item(11, 1, ':date')
      ]
    });
    const sequence = sequenceOf(mixed.matches[0]!)!;
    expect(membersOfSequence(mixed, sequence).map((one) => one.id.node)).toEqual([10, 11]);
  });
}); // End of the "sequence" suite

describe('whether one snippet may be moved at all', () => {
  it('says yes for an ordinary item of an ordinary list', () => {
    expect(moveEligibility(file(), file().matches[0]!, null)).toEqual({ kind: 'movable' });
  });

  it('refuses a file this application must not write', () => {
    const packaged = file({ kind: 'Package', readOnly: true });
    expect(moveEligibility(packaged, packaged.matches[0]!, null)).toEqual({
      kind: 'refused',
      reason: 'readOnly'
    });
  });

  it('refuses a snippet and a file that are not a pair this projection describes', () => {
    // The two arguments are one fact, and a caller passing a second value straight
    // from the live selection type-checks perfectly and can be wrong.
    const stranger = makeMatch({ node: 10, document: 9, revision: BASE, path: matchListPath(0) });
    expect(moveEligibility(file(), stranger, null)).toEqual({
      kind: 'refused',
      reason: 'notInDocument'
    });
    const stale = makeMatch({ node: 10, document: 2, revision: AFTER, path: matchListPath(0) });
    expect(moveEligibility(file(), stale, null)).toEqual({
      kind: 'refused',
      reason: 'notInDocument'
    });
    const absent = makeMatch({ node: 99, document: 2, revision: BASE, path: matchListPath(0) });
    expect(moveEligibility(file(), absent, null)).toEqual({
      kind: 'refused',
      reason: 'notInDocument'
    });
  });

  it('refuses a snippet this projection gives no sequence position', () => {
    const unaddressed = file({
      matches: [
        makeMatch({ node: 10, document: 2, revision: BASE, trigger: ':sig' }),
        item(11, 1, ':date')
      ]
    });
    expect(moveEligibility(unaddressed, unaddressed.matches[0]!, null)).toEqual({
      kind: 'refused',
      reason: 'noSequencePosition'
    });
  });

  it('refuses the only snippet of a sequence, which is not the only snippet of a file', () => {
    const lonely = file({ matches: [item(10, 0, ':sig')] });
    expect(moveEligibility(lonely, lonely.matches[0]!, null)).toEqual({
      kind: 'refused',
      reason: 'onlySnippetInSequence'
    });
    // **The distinction correction 4 is about.** The file holds two snippets and
    // the sequence holds one, so a rule written about the file would have called
    // this movable and offered a destination in another list.
    const twoLists = file({
      matches: [
        item(10, 0, ':sig'),
        makeMatch({
          node: 90,
          document: 2,
          revision: BASE,
          path: { document_index: 0, segments: [{ Key: 'global_vars' }, { Index: 0 }] }
        })
      ]
    });
    expect(moveEligibility(twoLists, twoLists.matches[0]!, null)).toEqual({
      kind: 'refused',
      reason: 'onlySnippetInSequence'
    });
  });

  it('refuses a snippet this window is holding unsaved edits for', () => {
    // **The consult's Q9, as an input.** The fact is an argument, so the rule is
    // here where a test can drive it and a component only supplies the fact.
    const document = file();
    const editing = document.matches[0]!.id;
    expect(moveEligibility(document, document.matches[0]!, editing)).toEqual({
      kind: 'refused',
      reason: 'unsavedDraft'
    });
    // A draft on some *other* snippet says nothing about this one.
    expect(moveEligibility(document, document.matches[0]!, document.matches[1]!.id)).toEqual({
      kind: 'movable'
    });
  });

  it('does not treat an identity from another parse as the snippet being moved', () => {
    // **A `MatchId` is session-local**, so `{document: 2, node: 10}` of another
    // parse is not this snippet: after a reprojection that arena node can hold
    // something unrelated, and a rule that ignored the revision would refuse the
    // move for a snippet nobody is editing. The comparison is all three fields.
    const document = file();
    const otherParse: MatchId = { document: 2, revision: AFTER, node: 10 };
    expect(moveEligibility(document, document.matches[0]!, otherParse)).toEqual({
      kind: 'movable'
    });
    // **What that costs, said plainly rather than papered over**: a draft really
    // held over an older parse of this snippet is not recognised here, so the move
    // is allowed and a commit strands those edits. What closes it is a caller
    // reading the draft's identity from the same projection it passes as
    // `document`, and no type can say where an argument came from.
  });

  it('has a sentence for every refusal, in both languages', () => {
    const reasons: readonly MoveRefusal[] = [
      'readOnly',
      'notInDocument',
      'noSequencePosition',
      'onlySnippetInSequence',
      'unsavedDraft'
    ];
    for (const locale of LOCALES) {
      for (const reason of reasons) {
        expect(DICTIONARIES[locale][moveRefusalKey(reason)].length).toBeGreaterThan(0);
      }
    } // End of the loop over the two locales
  });
}); // End of the "eligibility" suite

describe('the destinations a session offers', () => {
  it('never offers the moving snippet as its own anchor', () => {
    const held = session(1);
    expect(held.members.map((one) => one.node)).toEqual([10, 11, 12]);
    expect(held.anchors.map((one) => one.node)).toEqual([10, 12]);
  });

  it('offers the top, every anchor in file order, and the end', () => {
    // The consult's Q1 order, over the complete sequence (Q6): a search box
    // filters what the middle pane lists and says nothing about document order.
    const options = movePlacementOptionsOf(session(0), [file()]);
    expect(options.map((one) => one.key)).toEqual([
      'top',
      `after:2:${BASE}:11`,
      `after:2:${BASE}:12`,
      'end'
    ]);
    expect(options.map((one) => one.anchor?.id.node ?? null)).toEqual([null, 11, 12, null]);
  });

  it('marks the destination the file already writes the snippet at', () => {
    // The first snippet is at the top, and nothing else is where it is.
    expect(movePlacementOptionsOf(session(0), [file()]).map((one) => one.current)).toEqual([
      true,
      false,
      false,
      false
    ]);
    // The last snippet is *two* of them at once, and that is the aliasing this
    // flag exists to expose: `end` and `after :date` are one request.
    expect(movePlacementOptionsOf(session(2), [file()]).map((one) => one.current)).toEqual([
      false,
      false,
      true,
      true
    ]);
  });

  it('does not offer an anchor this window can no longer name', () => {
    // The projections handed in are asked for a snippet of the anchor's own
    // document **and its own revision**, so a file re-read since the session
    // opened resolves none of its anchors.
    expect(movePlacementOptionsOf(session(0), [reread()]).map((one) => one.key)).toEqual([
      'top',
      'end'
    ]);
  });

  it('stops saying the move can be sent once the destinations are gone', () => {
    // **The contradiction this pins, which is what a shrinking option list alone
    // does not.** The options come from the live projections and the refusal used
    // to come from the session's frozen snapshot, so a panel that had dropped
    // every destination still reported `canMove: true` — and pressing the control
    // produced nothing at all, because `beginMove` reads the live identity.
    const chosen = choosePlacement(session(0), { kind: 'after', anchor: live(1) });
    const held = [reread()];
    expect(movePlacementOptionsOf(chosen, held).map((one) => one.key)).toEqual(['top', 'end']);
    expect(matchMoveView(chosen, held).canMove).toBe(false);
    expect(matchMoveView(chosen, held).cannotMove).toBe('outOfDate');
    expect(beginMove(chosen, identityInProjection(held, chosen.match))).toBeNull();
    // **Every placement and not only the `after` ones.** The snippet being moved
    // shares its document and its revision with its anchors, so it stops resolving
    // when they do: "choose another destination" would be false advice.
    for (const placement of [{ kind: 'top' as const }, { kind: 'end' as const }]) {
      const other = choosePlacement(session(0), placement);
      expect(moveSubmissionRefusal(other, held)).toBe('outOfDate');
      expect(beginMove(other, identityInProjection(held, other.match))).toBeNull();
    } // End of the loop over the two placements that name no anchor
    // And the same session over the projections it was opened on is unaffected.
    expect(matchMoveView(chosen, HELD).canMove).toBe(true);
  });

  it('says which option the session is holding', () => {
    const chosen = choosePlacement(session(0), { kind: 'end' });
    expect(movePlacementOptionsOf(chosen, [file()]).map((one) => one.chosen)).toEqual([
      false,
      false,
      false,
      true
    ]);
  });
}); // End of the "destinations" suite

describe('choosing a destination, and what `end` really is', () => {
  it('opens showing where the snippet is now', () => {
    expect(placementOf(session(0))).toEqual({ kind: 'top' });
    expect(placementOf(session(1))).toEqual({ kind: 'after', anchor: live(0) });
    expect(placementOf(session(2))).toEqual({ kind: 'after', anchor: live(1) });
    // So the control does nothing until a destination is chosen, and says why.
    expect(moveSubmissionRefusal(session(0), HELD)).toBe('alreadyThere');
    expect(canMove(session(0), HELD)).toBe(false);
  });

  it('lowers the end to the last snippet that is not the one moving', () => {
    // **The wire has no `End`.** The panel's third option is this application's,
    // and this is where it becomes an identity.
    expect(lowerPlacement(session(0), { kind: 'end' })).toEqual({
      kind: 'after',
      anchor: live(2)
    });
    // For the last snippet the last *other* one is the one above it, which is why
    // choosing the end there moves nothing.
    expect(lowerPlacement(session(2), { kind: 'end' })).toEqual({
      kind: 'after',
      anchor: live(1)
    });
    expect(lowerPlacement(session(0), { kind: 'top' })).toEqual({ kind: 'front' });
  });

  it('refuses an anchor that is not one of this session’s own', () => {
    const held = session(0);
    // Itself, which is the self-anchor exclusion seen from the other side.
    expect(choosePlacement(held, { kind: 'after', anchor: live(0) })).toBe(held);
    // Another file's snippet.
    const foreign: MatchId = { document: 3, revision: BASE, node: 20 };
    expect(choosePlacement(held, { kind: 'after', anchor: foreign })).toBe(held);
    // An older parse of the right file: all three fields are compared.
    const stale: MatchId = { document: 2, revision: AFTER, node: 11 };
    expect(choosePlacement(held, { kind: 'after', anchor: stale })).toBe(held);
  });

  it('installs its own copy of the anchor rather than the caller’s object', () => {
    // The draft snapshots through `structuredClone`, which throws on a reactive
    // proxy, so what goes in is this session's plain identity and never the
    // argument's — the same rule `plainIdentity` states one level down.
    const held = session(0);
    const caller: MatchId = { document: 2, revision: BASE, node: 11 };
    const chosen = choosePlacement(held, { kind: 'after', anchor: caller });
    const placement = placementOf(chosen);
    expect(placement).toEqual({ kind: 'after', anchor: caller });
    expect(placement.kind === 'after' ? placement.anchor : null).not.toBe(caller);
  });

  it('refuses a destination that is where the file already writes the snippet', () => {
    // An affordance derived from current state, never authorization: the core
    // would accept this and answer `committed: false`.
    const last = session(2);
    expect(moveSubmissionRefusal(choosePlacement(last, { kind: 'end' }), HELD)).toBe('alreadyThere');
    expect(
      moveSubmissionRefusal(choosePlacement(last, { kind: 'after', anchor: live(1) }), HELD)
    ).toBe('alreadyThere');
    // And the option that really moves it does not.
    expect(moveSubmissionRefusal(choosePlacement(last, { kind: 'top' }), HELD)).toBeNull();
  });

  it('names a placement it cannot lower, which only a hand-built session reaches', () => {
    // **Recorded as unreachable through this module's own transitions, and
    // exercised anyway.** `session.anchors` is a snapshot taken at
    // `startMatchMove` and never replaced, and `choosePlacement` refuses any
    // anchor that is not one of them, so no sequence of calls here can install a
    // placement this session cannot lower. `MatchMoveSession` is a structural
    // interface with no brand, so a caller can assemble one. It answers the same
    // `outOfDate` a reprojection answers, and that is not a shrug: a session
    // showing a destination it cannot turn into a request is a session that does
    // not describe the file, which is what the code says.
    const held = session(0);
    const forged = { ...held, draft: { ...held.draft, value: { kind: 'after' as const, anchor: { document: 2, revision: AFTER, node: 11 } } } };
    expect(lowerPlacement(forged, placementOf(forged))).toBeNull();
    expect(moveSubmissionRefusal(forged, HELD)).toBe('outOfDate');
    expect(beginMove(forged, live(0))).toBeNull();
  });

  it('withdraws what was said about the last attempt when the destination moves', () => {
    const started = beginMove(choosePlacement(session(0), { kind: 'end' }), live(0));
    const refused = applyMove(started!.session, REFUSED, NOT_OWED);
    expect(matchMoveView(refused, HELD).outcome?.kind).toBe('refused');
    const rechosen = choosePlacement(refused, { kind: 'after', anchor: live(1) });
    // A refusal is about **one** destination, so a panel describing a destination
    // nobody has chosen any more is taken down with it.
    expect(rechosen.outcome).toBeNull();
    expect(rechosen.submitted).toBeNull();
  });

  it('accepts nothing while a move is in flight, in a conflict, or after a commit', () => {
    const started = beginMove(choosePlacement(session(0), { kind: 'end' }), live(0));
    expect(canChoose(started!.session)).toBe(false);
    expect(choosePlacement(started!.session, { kind: 'top' })).toBe(started!.session);

    const conflicted = applyMove(started!.session, CONFLICT, NOT_OWED);
    expect(canChoose(conflicted)).toBe(false);
    expect(moveSubmissionRefusal(conflicted, HELD)).toBe('conflict');

    const committed = applyMove(started!.session, saved(), ADOPTED);
    expect(canChoose(committed)).toBe(false);
    expect(moveSubmissionRefusal(committed, HELD)).toBe('alreadyMoved');
    // And dismissing the panel does not give it back.
    expect(canChoose(dismissMoveOutcome(committed))).toBe(false);
  });
}); // End of the "choosing" suite

describe('starting a move', () => {
  it('produces the identities the command takes, with the end already lowered', () => {
    const started = beginMove(choosePlacement(session(0), { kind: 'end' }), live(0));
    expect(started!.match).toEqual(live(0));
    expect(started!.after).toEqual(live(2));
    expect(started!.session.phase).toBe('saving');
    expect(started!.submission.acknowledgement).toEqual({ accepted: [] });
  });

  it('sends a `null` anchor for the top of the list', () => {
    const started = beginMove(choosePlacement(session(2), { kind: 'top' }), live(2));
    expect(started!.after).toBeNull();
  });

  it('freezes the base revision the session was opened at', () => {
    const held = choosePlacement(session(0), { kind: 'end' });
    expect(baseRevisionOf(held)).toBe(BASE);
    expect(beginMove(held, live(0))!.submission.baseRevision).toBe(BASE);
  });

  it('refuses when the live projection no longer gives that snippet this identity', () => {
    // **The only argument that comes from outside the session.** Everything else
    // was minted at `startMatchMove` and goes on agreeing with itself however
    // stale it all is, which is `confirmDelete`'s fourth-value rule for a move.
    const held = choosePlacement(session(0), { kind: 'end' });
    expect(beginMove(held, live(0))).not.toBeNull();
    expect(beginMove(held, null)).toBeNull();
    // The node is deliberately kept and only the revision moved: a fixture that
    // renumbered the nodes would pass by finding nothing, which is a weaker claim.
    expect(beginMove(held, live(0, reread()))).toBeNull();
    // And what a screen would have drawn about that session says the same thing,
    // which is the half that used to be missing: the view is derived from the same
    // live projections, so it cannot enable a control this refuses.
    expect(matchMoveView(held, [reread()]).canMove).toBe(false);
  });

  it('produces nothing when the destination does not move the snippet', () => {
    expect(beginMove(session(0), live(0))).toBeNull();
    expect(beginMove(choosePlacement(session(2), { kind: 'end' }), live(2))).toBeNull();
  });

  it('produces nothing for a snippet that may not be moved', () => {
    const packaged = file({ kind: 'Package', readOnly: true });
    const held = session(0, packaged);
    expect(moveSubmissionRefusal(held, [packaged])).toBe('notMovable');
    expect(beginMove(held, live(0, packaged))).toBeNull();
  });

  it('answers the stale session above the frozen ineligibility', () => {
    // **The fourth pass's first finding.** `eligibility` is computed once, at
    // `startMatchMove`, and no transition recomputes it — so against the session's
    // own projection `notMovable` is the only true arm and this is what it says.
    const packaged = file({ kind: 'Package', readOnly: true });
    const held = session(0, packaged);
    expect(moveSubmissionRefusal(held, [packaged])).toBe('notMovable');

    // Read the file again and both arms are true at once. *This snippet cannot be
    // moved* is then a definite claim read off a parse this window has replaced,
    // while *this session is out of date* is the half still known to be true, so
    // the weaker one wins — the same rule that puts `mayHaveWritten` on top.
    const again = reread({ kind: 'Package', readOnly: true });
    expect(moveSubmissionRefusal(held, [again])).toBe('outOfDate');
    // And the view a screen draws from the same live projections agrees, which is
    // the half a refusal computed off the frozen session alone would have missed.
    expect(matchMoveView(held, [again]).cannotMove).toBe('outOfDate');
    // **And the view withholds the frozen reason**, since 2c-4a-3b: the precedence
    // that puts `outOfDate` above `notMovable` is undone if the definite claim
    // reaches the screen through a second field, and until then a condition in
    // `MatchMover.svelte` was the only thing stopping it. The raw frozen verdict is
    // still on the session for a caller that wants the fact rather than a sentence.
    expect(matchMoveView(held, [again]).notMovableToShow).toBeNull();
    expect(held.eligibility).toEqual({ kind: 'refused', reason: 'readOnly' });
    // Nothing is sendable either way; `beginMove` refuses both without saying why.
    expect(beginMove(held, live(0, again))).toBeNull();
  });
}); // End of the "starting" suite

describe('what comes back', () => {
  /**
   * A session with a destination chosen and a move already sent.
   *
   * @returns The waiting session.
   */
  function inFlight() {
    return beginMove(choosePlacement(session(0), { kind: 'end' }), live(0))!.session;
  } // End of function inFlight()

  it('spends the session on a commit and keeps the identity the save answered', () => {
    const landed: MatchId = { document: 2, revision: AFTER, node: 31 };
    const done = applyMove(inFlight(), saved(true, landed), ADOPTED);
    const view = matchMoveView(done, HELD);
    expect(view.moved).toBe(true);
    expect(view.spent).toBe(true);
    expect(view.landed).toEqual(landed);
    expect(view.moving).toBe(false);
    expect(view.messages.map((message) => message.kind)).toEqual(['fileWritten']);
  });

  it('spends nothing when the save committed nothing and owed no adoption', () => {
    // A candidate byte-identical to what the file already held is not written, and
    // that is a documented success: the transaction ended on the revision this
    // window is projecting, so `BrowserState.moveMatch` re-read nothing and no
    // identity went stale. **Both halves matter** — see the case below.
    const done = applyMove(inFlight(), saved(false, null, BASE), NOT_OWED);
    expect(done.moved).toBe(false);
    expect(done.invalidated).toBe(false);
    const view = matchMoveView(done, HELD);
    expect(view.spent).toBe(false);
    expect(view.messages.map((message) => message.kind)).toEqual(['nothingToWrite']);
    // And the session really is still usable: the snippet is still at the top, so
    // moving it to the end is still a move that can be sent.
    expect(view.canMove).toBe(true);
    expect(beginMove(done, live(0))).not.toBeNull();
  });

  it('spends the session when a `committed: false` owed an adoption anyway', () => {
    // **Finding 1 of the 2c-3b-1 review, pinned.** "The move committed" and "this
    // session's identities were invalidated" are two facts. The wrapper adopts on
    // `committed || revision !== view.revision`, so a save that wrote nothing and
    // ended on a revision this window was not projecting re-reads the file — and
    // every identity here was minted from the parse that re-read replaced. The
    // session must stop offering the move **without** claiming the move committed.
    const done = applyMove(inFlight(), saved(false, null, AFTER), ADOPTED);
    expect(done.moved).toBe(false);
    expect(done.invalidated).toBe(true);
    const view = matchMoveView(done, [reread()]);
    expect(view.moved).toBe(false);
    expect(view.spent).toBe(true);
    expect(view.canMove).toBe(false);
    expect(view.cannotMove).toBe('outOfDate');
    // The old code left `moved: false` and rebased only the draft, so the model
    // said the session was usable while `beginMove` answered `null` against the
    // live identity. The two now agree.
    expect(beginMove(done, identityInProjection([reread()], done.match))).toBeNull();
    // Nothing was written, and the outcome panel still says so.
    expect(view.messages.map((message) => message.kind)).toEqual(['nothingToWrite']);
    // Choosing another destination does not give the session back either: its
    // anchors name a parse that is gone.
    expect(canChoose(done)).toBe(false);
    expect(choosePlacement(done, { kind: 'top' })).toBe(done);
  });

  it('does not spend the session on a conflict, whose adoption is always `notOwed`', () => {
    // **The consult's Q2, and this case said the opposite until 2c-4a-2.**
    // `BrowserState.moveMatch` then installed the projection a conflict carries on
    // `disk` — replacing every identity this session held — while reporting
    // `adoption: notOwed`, so the arm had to be the evidence. It installs nothing
    // now: a save that wrote no byte must not re-order the list or move the
    // selection before the person has chosen. So these identities are still the
    // ones the window is projecting, and invalidation follows actual adoption.
    const conflicted = applyMove(inFlight(), CONFLICT, NOT_OWED);
    expect(conflicted.moved).toBe(false);
    expect(conflicted.invalidated).toBe(false);
    // The panel refuses while the conflict is showing, and hands the session back
    // once it is dismissed — against the projection the window still holds.
    expect(canChoose(conflicted)).toBe(false);
    const dismissed = dismissMoveOutcome(conflicted);
    expect(canChoose(dismissed)).toBe(true);
    expect(matchMoveView(dismissed, HELD).spent).toBe(false);
    expect(matchMoveView(dismissed, HELD).cannotMove).toBeNull();
    // A window that *has* adopted the disk side is a different question, and the
    // live check is what answers it — nothing about this session changed.
    expect(matchMoveView(dismissed, [CONFLICT.disk]).cannotMove).toBe('outOfDate');
  }); // End of the "a conflict does not spend the session" case

  it('invalidates an arm that is not `saved` when the adoption was owed anyway', () => {
    // **A structural guard, and deliberately not a pair production can answer** —
    // the third pass's fifth finding. `BrowserState.moveMatch` owes an adoption
    // only on the `saved` arm, so `refused` beside `done` is not an answer it can
    // give, and the case above is the pair it really does give. What this one pins
    // is the *shape* of the rule rather than a reachable transition: moving
    // `adoption.kind !== 'notOwed'` inside the saved branch of `applyMove` would
    // leave every reachable adoption case green while dropping the guarantee that
    // an adoption owed at all invalidates whatever arm carried it. It is kept
    // beside the conflict case rather than replaced by it.
    const refused = applyMove(inFlight(), REFUSED, ADOPTED);
    expect(refused.moved).toBe(false);
    expect(refused.invalidated).toBe(true);
    expect(matchMoveView(refused, HELD).spent).toBe(true);
    expect(canChoose(refused)).toBe(false);
    // And the same for a failed adoption, which is the other arm of "owed at all".
    expect(applyMove(inFlight(), REFUSED, NOT_ADOPTED).invalidated).toBe(true);
  }); // End of the structural non-saved-arm adoption case

  it('puts the out-of-step line beside a commit whose adoption failed', () => {
    const done = applyMove(inFlight(), saved(), NOT_ADOPTED);
    // Beside the saved arm, never in place of it: the snippet really did move.
    expect(matchMoveView(done, HELD).messages.map((message) => message.kind)).toEqual([
      'fileWritten',
      'windowOutOfStep'
    ]);
    expect(matchMoveView(done, HELD).moved).toBe(true);
    // A failed adoption dropped the projection altogether, so it invalidates too.
    expect(done.invalidated).toBe(true);
  });

  it('carries a refusal’s findings and the consent that answers them', () => {
    const refused = applyMove(inFlight(), REFUSED, NOT_OWED);
    const view = matchMoveView(refused, HELD);
    expect(view.outcome?.kind).toBe('refused');
    expect(view.refusalChoices).toEqual(['saveAnyway', 'keepEditing']);
    expect(view.moved).toBe(false);

    const consented = acknowledgeMoveFindings(refused);
    const again = beginMove(consented, live(0));
    expect(again!.submission.acknowledgement).toEqual({ accepted: [SUSPICION] });
  });

  it('withdraws the consent when the destination changes under a refusal', () => {
    // Consent is content-addressed to the candidate, and the candidate here **is**
    // the destination — so a second destination cannot spend the first's consent.
    const refused = applyMove(inFlight(), REFUSED, NOT_OWED);
    const consented = acknowledgeMoveFindings(refused);
    const rechosen = choosePlacement(consented, { kind: 'after', anchor: live(1) });
    expect(beginMove(rechosen, live(0))!.submission.acknowledgement).toEqual({ accepted: [] });
  });

  it('offers one way out of a conflict, and stops offering the move while it shows', () => {
    const conflicted = applyMove(inFlight(), CONFLICT, NOT_OWED);
    expect(conflictOf(conflicted)).not.toBeNull();
    expect(canMove(conflicted, HELD)).toBe(false);
    // Two, since 2c-4a-3b flipped `offersReload`: the non-destructive way out and
    // the first step of the reload. Never a copy — a placement is a positional
    // choice, and `conflictChoicesFor` refuses one whatever this surface declares.
    expect(matchMoveView(conflicted, HELD).conflictChoices).toEqual([
      'keepEditing',
      'reloadDiskVersion'
    ]);
    // The summary is read off the placement the conflict retained, so it says what
    // this session asked for and not what the session now holds.
    expect(matchMoveView(conflicted, HELD).conflictOperation).toBe('moveToEnd');
    const dismissed = dismissMoveOutcome(conflicted);
    expect(conflictOf(dismissed)).toBeNull();
    // **Dismissing the panel gives the session back, and 2c-4a-2 is where that
    // changed.** A conflict wrote nothing and now replaces nothing, so `moved`
    // stays `false`, nothing was invalidated, and the identities this session holds
    // are the ones the window is still projecting. What has not changed is the
    // file: a resend carries the frozen base revision, which the command refuses.
    // Nothing here sends one, so this says nothing about which refusal — see
    // `dismissMoveOutcome`'s note for why it is `identityStaleRevision`.
    expect(canMove(dismissed, HELD)).toBe(true);
    expect(moveSubmissionRefusal(dismissed, HELD)).toBeNull();
    expect(beginMove(dismissed, live(0))).not.toBeNull();
    // A window that really has moved on is the live check's question, and it still
    // answers it: the session says nothing about a projection nobody told it about.
    expect(canMove(dismissed, [CONFLICT.disk])).toBe(false);
    expect(moveSubmissionRefusal(dismissed, [CONFLICT.disk])).toBe('outOfDate');
    expect(beginMove(dismissed, identityInProjection([CONFLICT.disk], dismissed.match))).toBeNull();
  });

  it('records a send that produced no outcome, in its two arms', () => {
    const notSent = moveCouldNotBeSent(inFlight(), false, null);
    expect(notSent.sendFailure).toEqual({ kind: 'notSent', reason: null });
    expect(notSent.moved).toBe(false);
    // A failure before the rename really did write nothing, so the session is not
    // spent and the same move may be sent again.
    expect(notSent.mayHaveWritten).toBe(false);
    expect(canChoose(notSent)).toBe(true);
    expect(canMove(notSent, HELD)).toBe(true);
    const failure: IpcFailure = { kind: 'command', error: { code: 'noWorkspaceOpen' } };
    const maybe = moveCouldNotBeSent(inFlight(), true, failure);
    expect(maybe.sendFailure).toEqual({ kind: 'mayHaveWritten', reason: failure });
    expect(matchMoveView(maybe, HELD).failureLines).toEqual([{ kind: 'failure', failure }]);
  });

  it('spends the session when the send may already have written the file', () => {
    // **The confirmation pass's first finding, and both halves of it.** A
    // `may_have_written` rejection means the save failed at or after the rename, so
    // this application knows neither that the move happened nor that it did not.
    // What the wrapper does next is a re-read that may itself fail, and the two
    // outcomes are the two projections below — the session must be spent under
    // both, and for the same stated reason.
    const maybe = moveCouldNotBeSent(inFlight(), true, UNCERTAIN);
    expect(maybe.mayHaveWritten).toBe(true);
    // Nothing is offered beside it, and that is not an omission: `saveFailed` is
    // the only code the flag comes from and it is not one of the four a re-read is
    // offered for, so the pair the record once claimed cannot occur in production.
    expect(matchMoveView(maybe, HELD).recovery).toEqual([]);
    // **The re-read failed**, so this window is still projecting the parse the
    // session was opened over. Before the fix that made the move immediately
    // available again, beside a message telling the person to look at the file.
    expect(canChoose(maybe)).toBe(false);
    expect(choosePlacement(maybe, { kind: 'top' })).toBe(maybe);
    expect(canMove(maybe, HELD)).toBe(false);
    expect(moveSubmissionRefusal(maybe, HELD)).toBe('mayHaveWritten');
    expect(beginMove(maybe, live(0))).toBeNull();
    expect(matchMoveView(maybe, HELD).spent).toBe(true);
    // **The re-read succeeded**, so the window now holds a different parse. The
    // reason is still `mayHaveWritten` and never `outOfDate`, whose sentence says
    // *nothing has been written* — the one claim this session has just disclaimed.
    expect(moveSubmissionRefusal(maybe, [reread()])).toBe('mayHaveWritten');
    expect(matchMoveView(maybe, [reread()]).cannotMove).toBe('mayHaveWritten');
    expect(matchMoveView(maybe, [reread()]).spent).toBe(true);
    expect(beginMove(maybe, identityInProjection([reread()], maybe.match))).toBeNull();
    // And putting the panel away does not hand the session back: the message is
    // cleared, the flag is not.
    const dismissed = dismissMoveOutcome(maybe);
    expect(dismissed.sendFailure).toBeNull();
    expect(dismissed.mayHaveWritten).toBe(true);
    expect(canChoose(dismissed)).toBe(false);
    expect(moveSubmissionRefusal(dismissed, HELD)).toBe('mayHaveWritten');
  }); // End of the "may have written" case

  it('answers the uncertain send ahead of the commit and ahead of the invalidation', () => {
    // **The third pass's first finding.** Two of the three flags can be true at
    // once, and the refusal shown is then the one that claims *less*: a session
    // that committed a move and afterwards met a send this application could not
    // account for is `moved` **and** `mayHaveWritten`, and answering `alreadyMoved`
    // there drew a definite "this snippet has been moved" beside a send failure
    // saying the opposite may be true, with a dismissal that took the uncertain
    // half off the screen while the flag stayed set. The round before this one had
    // the two checks the other way round, which is why the rule — not the
    // arrangement — is written down in `refusalGiven`.
    const committed = applyMove(inFlight(), saved(), ADOPTED);
    expect(moveSubmissionRefusal(committed, HELD)).toBe('alreadyMoved');
    const afterwards = moveCouldNotBeSent(committed, true, UNCERTAIN);
    expect(afterwards.moved).toBe(true);
    expect(afterwards.mayHaveWritten).toBe(true);
    expect(moveSubmissionRefusal(afterwards, HELD)).toBe('mayHaveWritten');
    expect(matchMoveView(afterwards, HELD).cannotMove).toBe('mayHaveWritten');
    expect(matchMoveView(afterwards, HELD).spent).toBe(true);

    // **The other order, because which answer arrives first is the caller's.** A
    // session already spent by an uncertain send that then takes a committed answer
    // holds both flags too, and says the same thing about them.
    const beforehand = applyMove(moveCouldNotBeSent(inFlight(), true, UNCERTAIN), saved(), ADOPTED);
    expect(beforehand.moved).toBe(true);
    expect(beforehand.mayHaveWritten).toBe(true);
    expect(moveSubmissionRefusal(beforehand, HELD)).toBe('mayHaveWritten');

    // **And the stale-plus-uncertain pair.** A session whose window has moved on —
    // measured by the live projections, since 2c-4a-2 a dismissed conflict spends
    // nothing — reads `outOfDate` on its own, which says *nothing has been
    // written*. An uncertain send after it must not be reported with that sentence.
    const dismissed = dismissMoveOutcome(applyMove(inFlight(), CONFLICT, NOT_OWED));
    expect(moveSubmissionRefusal(dismissed, [CONFLICT.disk])).toBe('outOfDate');
    const uncertain = moveCouldNotBeSent(dismissed, true, UNCERTAIN);
    expect(uncertain.moved).toBe(false);
    expect(moveSubmissionRefusal(uncertain, [CONFLICT.disk])).toBe('mayHaveWritten');
    expect(beginMove(uncertain, identityInProjection([CONFLICT.disk], uncertain.match))).toBeNull();
  }); // End of the refusal-precedence case

  it('offers a re-read for the four failures that say this window disagrees with the file', () => {
    // **The consult's Q8.** A typed command failure, not an acknowledgeable save
    // refusal: it carries no findings, so there is nothing to accept.
    const codes = [
      'moveNotWithinOneSequence',
      'identityStaleRevision',
      'identityNoSuchMatch',
      'identityWrongDocument'
    ] as const;
    const failures: readonly IpcFailure[] = [
      { kind: 'command', error: { code: 'moveNotWithinOneSequence' } },
      { kind: 'command', error: { code: 'identityStaleRevision', expected: BASE, found: AFTER } },
      { kind: 'command', error: { code: 'identityNoSuchMatch', node: 10 } },
      { kind: 'command', error: { code: 'identityWrongDocument', expected: 2, found: 3 } }
    ];
    expect(failures.map((one) => (one.kind === 'command' ? one.error.code : null))).toEqual(codes);
    for (const failure of failures) {
      expect(moveRecoveryChoices(failure)).toEqual(['reloadFile']);
      expect(matchMoveView(moveCouldNotBeSent(inFlight(), false, failure), HELD).recovery).toEqual([
        'reloadFile'
      ]);
    } // End of the loop over the four codes a re-read is offered for

    // And nothing for a failure a re-read cannot help with: offering one would be
    // a control that never works.
    expect(moveRecoveryChoices({ kind: 'command', error: { code: 'noWorkspaceOpen' } })).toEqual([]);
    expect(moveRecoveryChoices({ kind: 'unexpected' })).toEqual([]);
    expect(moveRecoveryChoices(null)).toEqual([]);
    for (const locale of LOCALES) {
      expect(DICTIONARIES[locale][moveRecoveryKey('reloadFile')].length).toBeGreaterThan(0);
    } // End of the loop over the two locales
  });

  it('spends the session when the recovery re-read could not reach the file', () => {
    // **The second review's fifth finding.** The recovery is offered for four codes
    // and all four say the address this window sent does not describe the file the
    // command read — so until the re-read either succeeds or fails, the session is
    // still holding an identity the file has already contradicted. A re-read that
    // fails takes away the only way of resolving that, and leaving the session
    // sendable there let the same disputed identity go back out, from a panel whose
    // destinations were built from the very reading the command rejected.
    const disputed: IpcFailure = {
      kind: 'command',
      error: { code: 'identityStaleRevision', expected: AFTER, found: BASE }
    };
    const refused = moveCouldNotBeSent(inFlight(), false, disputed);
    // Before the recovery is attempted the session is live and sendable: nothing
    // was written, so a retry is a legitimate thing to offer.
    expect(matchMoveView(refused, HELD).recovery).toEqual(['reloadFile']);
    expect(canChoose(refused)).toBe(true);
    expect(moveSubmissionRefusal(refused, HELD)).toBeNull();

    const spent = moveRecoveryFailed(refused);

    expect(spent.invalidated).toBe(true);
    // **And nothing else is claimed.** A failed read is not a write, and it is not
    // a write this application cannot account for either.
    expect(spent.moved).toBe(false);
    expect(spent.mayHaveWritten).toBe(false);
    expect(canChoose(spent)).toBe(false);
    expect(moveSubmissionRefusal(spent, HELD)).toBe('outOfDate');
    expect(matchMoveView(spent, HELD).spent).toBe(true);
    expect(beginMove(spent, identityInProjection(HELD, spent.match))).toBeNull();
    // Putting the send failure away does not hand the session back, which is the
    // rule every other spending flag already follows.
    expect(dismissMoveOutcome(spent).invalidated).toBe(true);
    expect(canChoose(dismissMoveOutcome(spent))).toBe(false);
  }); // End of the "failed recovery re-read" case

  it('ignores an answer nothing was waiting for', () => {
    const clean = session(0);
    expect(applyMove(clean, saved(), ADOPTED)).toBe(clean);
  });

  it('never takes a commit or an invalidation back', () => {
    // Both flags are or-ed into rather than assigned, so "cleared by nothing" is
    // what the code does and not only what the reachable transitions allow: a
    // second answer handed to a session that has already committed — which this
    // module offers no way to produce, and which a hand-written caller can — does
    // not turn a written file back into an unwritten one.
    const committed = applyMove(inFlight(), saved(), ADOPTED);
    const again = applyMove(committed, saved(false, null, BASE), NOT_OWED);
    expect(again.moved).toBe(true);
    expect(again.invalidated).toBe(true);
  });
}); // End of the "what comes back" suite

describe('the view a screen draws', () => {
  it('answers everything a control needs, derived on every read', () => {
    const view = matchMoveView(choosePlacement(session(0), { kind: 'end' }), HELD);
    expect(view.match).toEqual(live(0));
    expect(view.document).toBe(2);
    expect(view.placement).toEqual({ kind: 'end' });
    expect(view.canMove).toBe(true);
    expect(view.notMovableToShow).toBeNull();
    expect(view.cannotMove).toBeNull();
    expect(view.conflictOperation).toBeNull();
    expect(view.moving).toBe(false);
    expect(view.moved).toBe(false);
    expect(view.spent).toBe(false);
    expect(view.landed).toBeNull();
    expect(view.outcome).toBeNull();
    expect(view.recovery).toEqual([]);
  });

  it('names both refusals separately, because they answer different questions', () => {
    const packaged = file({ kind: 'Package', readOnly: true });
    const view = matchMoveView(session(0, packaged), [packaged]);
    expect(view.canMove).toBe(false);
    expect(view.notMovableToShow).toBe('readOnly');
    expect(view.cannotMove).toBe('notMovable');
  });

  it('gives the frozen reason only when the frozen verdict is the one that won', () => {
    // **2c-3c-3's Medium, brought here at 2c-4a-3b.** The rule is written against
    // `'notMovable'` and not against `outOfDate`, so a refusal added above it in
    // `refusalGiven`'s order suppresses the frozen detail by construction rather
    // than by a later edit. Driven from both sides, because a view that never
    // answered a frozen reason at all would satisfy the suppression half trivially.
    const packaged = file({ kind: 'Package', readOnly: true });
    const live = matchMoveView(session(0, packaged), [packaged]);
    expect(live.cannotMove).toBe('notMovable');
    expect(live.notMovableToShow).toBe('readOnly');

    // **A refusal above it that is not `outOfDate`.** A session cannot reach a
    // conflict with a refused eligibility — it can never send — so the reachable
    // proof that the rule is written against the *value* rather than against
    // `outOfDate` is `saveInFlight`, which `refusalGiven` also ranks above
    // `notMovable`. A rule written the old way would still be drawing *this
    // snippet cannot be moved* here.
    const inFlight = matchMoveView({ ...session(0, packaged), phase: 'saving' }, [packaged]);
    expect(inFlight.cannotMove).toBe('saveInFlight');
    expect(inFlight.notMovableToShow).toBeNull();
  }); // End of the "frozen reason only when it won" case

  it('carries whatever presentation notes the save reported, unchanged', () => {
    // **A move produces none today, and that is read off the core rather than
    // assumed**: a batch holding an `ItemMove` may hold no other edit, and
    // `plan_move` sets `note: None`. The field is carried anyway, so that a note
    // the core learns to emit is drawn rather than dropped — and *that* is what
    // this case drives, because asserting `[]` against an empty answer would pass
    // just as well with the field hard-coded to `[]`.
    const note: PresentationNote = {
      ScalarRestyled: { edit: 0, from: 'Plain', to: 'SingleQuoted', reason: null }
    };
    const started = beginMove(choosePlacement(session(0), { kind: 'end' }), live(0));
    const done = applyMove(started!.session, saved(true, null, AFTER, [note]), ADOPTED);
    expect(matchMoveView(done, HELD).notes).toEqual([note]);
    expect(matchMoveView(done, HELD).notes[0]).toBe(note);
    // And an answer that carried none still shows none.
    const quiet = applyMove(started!.session, saved(), ADOPTED);
    expect(matchMoveView(quiet, HELD).notes).toEqual([]);
  });

  it('has a sentence for every submission refusal, in both languages', () => {
    const reasons: readonly MoveSubmissionRefusal[] = [
      'alreadyMoved',
      'mayHaveWritten',
      'saveInFlight',
      'conflict',
      'notMovable',
      'outOfDate',
      'alreadyThere'
    ];
    for (const locale of LOCALES) {
      for (const reason of reasons) {
        expect(DICTIONARIES[locale][moveSubmissionRefusalKey(reason)].length).toBeGreaterThan(0);
      }
    } // End of the loop over the two locales
  });
}); // End of the "view" suite

describe('the identities a session holds', () => {
  it('are plain copies, because the draft snapshots them through structuredClone', () => {
    // **Found by the mounted test of 2c-3a-2, not by a model test.** A screen reads
    // its snippet out of `BrowserState.views`, which is `$state` and therefore
    // deeply proxied, and `structuredClone` **throws** on a proxy. A model test
    // cannot catch a repeat of it, because model tests pass plain fixtures; what it
    // can check is that nothing here is the projection's own object.
    const document = file();
    const held = startMatchMove(document, document.matches[0]!, null);
    expect(held.match).toEqual(document.matches[0]!.id);
    expect(held.match).not.toBe(document.matches[0]!.id);
    expect(held.members[1]).toEqual(document.matches[1]!.id);
    expect(held.members[1]).not.toBe(document.matches[1]!.id);
    expect(held.anchors[0]).not.toBe(document.matches[1]!.id);
    // The sequence's own steps too: a session outlives the projection it was
    // opened over.
    expect(held.sequence?.segments[0]).toEqual({ Key: 'matches' });
    expect(held.sequence?.segments[0]).not.toBe(document.matches[0]!.path?.segments[0]);
  });
}); // End of the "identities" suite

describe('the confirmed reload, offered since 2c-4a-3b', () => {
  // **2c-4a-2's High finding, and the trade it made paying off at 2c-4a-3b.** The
  // consult's Q3 gives every one of the six surfaces a confirmed reload;
  // withholding the *offering* until a panel was drawn for it was right, and
  // withholding the **transition** was not — an unoffered transition can be built
  // and driven without drawing anything, and leaving it out would have made step 3
  // invent five model machines on top of five panels. So this suite drove the
  // transition before any control could reach it, and 2c-4a-3b then flipped one
  // boolean. Every case here calls the transition directly, as the component's
  // `conflictAction` arm does.

  /**
   * A conflicted move of a chosen destination.
   *
   * @returns The session showing the conflict.
   */
  function conflicted(): MatchMoveSession {
    const started = beginMove(choosePlacement(session(0), { kind: 'end' }), live(0));
    if (started === null) {
      throw new Error('a chosen destination is sendable');
    }
    return applyMove(started.session, CONFLICT, NOT_OWED);
  } // End of function conflicted()

  /**
   * A recorder for the window's own adoption.
   *
   * @param answer - What the window answers. `refused` is a real production
   *   answer — a spent confirmation, a conflict this window did not produce, or a
   *   projection replaced since it arrived.
   * @returns The callback to pass, and the conflicts it was handed.
   */
  function adopting(answer: DiskAdoptionOutcome = 'installed'): {
    readonly adopt: AdoptTheDiskVersion<MovePlacement>;
    readonly adoptions: ConflictModel<MovePlacement>[];
  } {
    const adoptions: ConflictModel<MovePlacement>[] = [];
    return {
      adopt: (conflict) => {
        adoptions.push(conflict);
        return answer;
      },
      adoptions
    };
  } // End of function adopting()

  it('needs two deliberate steps before anything can be spent', () => {
    const stuck = conflicted();
    const recorder = adopting();
    // Straight to the destructive transition, with no warning behind it.
    expect(reloadTheDiskVersion(stuck, recorder.adopt)).toBe(stuck);
    const asked = askToReloadDiskVersion(stuck);
    expect(matchMoveView(asked, HELD).reloadWarning).toBe('positionalDestination');
    // The warning alone is not a confirmation either.
    expect(reloadTheDiskVersion(asked, recorder.adopt)).toBe(asked);
    expect(recorder.adoptions).toEqual([]);
    expect(matchMoveView(asked, HELD).closed).toBe(false);
  }); // End of the "two steps" case

  it('adopts the disk projection once, and closes the session', () => {
    const recorder = adopting();
    const confirmed = confirmDiskReload(askToReloadDiskVersion(conflicted()));
    const after = reloadTheDiskVersion(confirmed, recorder.adopt);

    // **The conflict itself crosses**, not a payload assembled from it: the window
    // authorizes and installs in one call, so nothing here can retain an adoption.
    expect(recorder.adoptions).toHaveLength(1);
    expect(recorder.adoptions[0]).toBe(conflictOf(confirmed));
    // And this session is over. There is no disk-side draft to seed — finding "the
    // same" thing in a revision nobody has described is 2c-4b — so the panel closes.
    expect(after.closed).toBe(true);
    expect(matchMoveView(after, HELD).closed).toBe(true);
    expect(conflictOf(after)).toBeNull();
    expect(canChoose(after)).toBe(false);
  }); // End of the "adopt and close" case

  it('finishes the reload when the window was already at the disk version', () => {
    // **`alreadyThere` is a success**, so this session closes exactly as it does
    // for an install: the window holds the disk projection either way, and treating
    // the answer as a failure would leave a confirm control that could never work.
    const satisfied = adopting('alreadyThere');
    const confirmed = confirmDiskReload(askToReloadDiskVersion(conflicted()));
    const after = reloadTheDiskVersion(confirmed, satisfied.adopt);
    expect(after.closed).toBe(true);
    expect(conflictOf(after)).toBeNull();
  }); // End of the "already at the disk version" case

  it('closes nothing when the window refuses the adoption', () => {
    // Closing over a window that never moved would report a reload that did not
    // happen, and take the conflict panel off the screen with it.
    const refusing = adopting('refused');
    const confirmed = confirmDiskReload(askToReloadDiskVersion(conflicted()));
    const after = reloadTheDiskVersion(confirmed, refusing.adopt);
    expect(after.closed).toBe(false);
    // **And the reload stops being offered rather than staying pressable.** The
    // confirmation is spent and the window said no for a reason asking again
    // cannot change, so the step is terminal, the panel discloses it, and only
    // *Keep editing* and the copy remain (2c-4a-3a review, finding 3).
    expect(after.reload.kind).toBe('refused');
    expect(matchMoveView(after, HELD).reloadUnavailable).toBe(true);
    expect(matchMoveView(after, HELD).reloadWarning).toBeNull();
    expect(matchMoveView(after, HELD).conflictChoices).not.toContain('confirmReload');
    expect(matchMoveView(after, HELD).conflictChoices).not.toContain('reloadDiskVersion');
    expect(matchMoveView(after, HELD).conflictChoices).toContain('keepEditing');
    // Asking again cannot spend anything a second time.
    expect(reloadTheDiskVersion(after, refusing.adopt)).toBe(after);
    expect(refusing.adoptions).toHaveLength(1);
    expect(conflictOf(after)).not.toBeNull();
  }); // End of the "window refused" case

  it('offers the second step once the first has been taken, and never both', () => {
    // **2c-4a-3b flipped `offersReload`**, over machinery this suite already drove:
    // the transition existed and this surface's `conflictAction` already called it,
    // so what the flip added is the control. The two labels are never offered
    // together — the destructive one is a second step, by `conflictChoicesFor`.
    const conflict = conflicted();
    expect(matchMoveView(conflict, HELD).conflictChoices).toEqual<readonly ConflictChoice[]>([
      'keepEditing',
      'reloadDiskVersion'
    ]);
    expect(matchMoveView(conflict, HELD).reloadWarning).toBeNull();

    const asked = askToReloadDiskVersion(conflict);
    expect(matchMoveView(asked, HELD).conflictChoices).toEqual<readonly ConflictChoice[]>([
      'keepEditing',
      'confirmReload'
    ]);
    expect(matchMoveView(asked, HELD).reloadWarning).toBe('positionalDestination');
    // And still no copy: the Q4 rule is about what this draft *is*.
    expect(matchMoveView(asked, HELD).conflictChoices).not.toContain('copyDraft');
  }); // End of the "two-step reload is offered" case

  it('warns about the destination it really retained, arm by arm', () => {
    // **The 2c-4a-3b review's finding 1.** The one sentence this replaces said the
    // destination *names snippets of the version this window read* — true of an
    // `after`, and false of `top` and `end`, which name a position and no snippet
    // at all. The claim now depends on the arm, and it depends on it here rather
    // than in `MatchMover.svelte`: a rule written into one renderer is carried by
    // that renderer's mounted suite alone.
    for (const [placement, warning] of [
      [{ kind: 'top' as const }, 'positionalDestination'],
      [{ kind: 'end' as const }, 'positionalDestination'],
      [{ kind: 'after' as const, anchor: live(2) }, 'anchoredDestination']
    ] as const) {
      const started = beginMove(choosePlacement(session(1), placement), live(1));
      if (started === null) {
        throw new Error(`this case needs ${warning} to be sendable`);
      }
      const asked = askToReloadDiskVersion(applyMove(started.session, CONFLICT, NOT_OWED));
      expect(matchMoveView(asked, HELD).reloadWarning, warning).toBe(warning);
    } // End of the loop over the three placement arms
  }); // End of the "warning per arm" case

  it('summarises the placement the conflict retained, one code per arm', () => {
    // **The `operationChoice` side of the comparison** (consult Q5). Every arm of
    // `MovePlacement` gets its own summary, and the `after` one names no anchor:
    // an anchor is a revision-scoped identity, and the destination list the panel
    // still draws is what marks which one was chosen.
    // The middle snippet, so all three placements really move it and `beginMove`
    // produces something to send for each.
    for (const [placement, summary] of [
      [{ kind: 'top' as const }, 'moveToTop'],
      [{ kind: 'end' as const }, 'moveToEnd'],
      [{ kind: 'after' as const, anchor: live(2) }, 'moveAfterSnippet']
    ] as const) {
      const started = beginMove(choosePlacement(session(1), placement), live(1));
      if (started === null) {
        throw new Error(`this case needs ${summary} to be sendable`);
      }
      const conflict = applyMove(started.session, CONFLICT, NOT_OWED);
      expect(matchMoveView(conflict, HELD).conflictOperation, summary).toBe(summary);
    } // End of the loop over the three placement arms
  }); // End of the "placement summary" case

  it('stops pointing at a marked destination once the reprojection has dropped it', () => {
    // **The 2c-4a-3b review's finding 2.** The `after` summary sends the reader to
    // the destination the list above marks, and `movePlacementOptionsOf` stops
    // offering an anchor whose parse this window has replaced — so a reprojection
    // arriving *while the conflict is still displayed* took the mark away and left
    // the sentence pointing at nothing. The two arms are decided from the same
    // option list the panel draws, so they cannot disagree with it.
    const started = beginMove(
      choosePlacement(session(1), { kind: 'after', anchor: live(2) }),
      live(1)
    );
    if (started === null) {
      throw new Error('an anchored destination is sendable');
    }
    const conflict = applyMove(started.session, CONFLICT, NOT_OWED);
    // While the window still holds the parse the anchor was minted from, the
    // option is offered and marked, and the sentence may point at it.
    const held = matchMoveView(conflict, HELD);
    expect(held.conflictOperation).toBe('moveAfterSnippet');
    expect(
      movePlacementOptionsOf(conflict, HELD).some((one) => one.chosen && one.anchor !== null)
    ).toBe(true);

    // The window reads the file again — from the sidebar, from another surface's
    // committed save — and nothing about the conflict changes. The destination
    // list does: the anchor belongs to a parse that is gone.
    const now: readonly DocumentView[] = [reread()];
    expect(movePlacementOptionsOf(conflict, now).some((one) => one.chosen)).toBe(false);
    expect(matchMoveView(conflict, now).conflictOperation).toBe('moveAfterSnippetNoLongerShown');
    // And the conflict is still the one being shown: this is a sentence changing,
    // never the panel moving on.
    expect(matchMoveView(conflict, now).conflict).not.toBeNull();
  }); // End of the "dropped anchor" case

  it('forgets a confirmation when the panel is dismissed or a new answer arrives', () => {
    // A confirmation is a person's answer to **one** conflict. Reaching the
    // confirmed step and then dismissing must not leave it spendable.
    const recorder = adopting();
    const confirmed = confirmDiskReload(askToReloadDiskVersion(conflicted()));
    const dismissed = dismissMoveOutcome(confirmed);
    expect(dismissed.reload.kind).toBe('idle');
    expect(reloadTheDiskVersion(dismissed, recorder.adopt)).toBe(dismissed);
    expect(recorder.adoptions).toEqual([]);
  }); // End of the "dismissal forgets the confirmation" case
}); // End of the "confirmed reload" suite
