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
  baseRevisionOf,
  beginMove,
  canChoose,
  canMove,
  choosePlacement,
  conflictOf,
  dismissMoveOutcome,
  lowerPlacement,
  matchMoveView,
  membersOfSequence,
  moveCouldNotBeSent,
  moveEligibility,
  moveRecoveryChoices,
  moveRecoveryKey,
  moveRefusalKey,
  moveSubmissionRefusal,
  moveSubmissionRefusalKey,
  movePlacementOptionsOf,
  placementOf,
  sameSequence,
  sequenceOf,
  startMatchMove,
  type MoveRefusal,
  type MoveSubmissionRefusal
} from './matchMove';

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
 * @returns The projection this window holds after the re-read.
 */
function reread(): DocumentView {
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
    ]
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
  expected: BASE,
  found: AFTER,
  disk_revision: AFTER,
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

  it('spends the session on a conflict, whose adoption is always `notOwed`', () => {
    // **The confirmation pass's second finding.** `BrowserState.moveMatch` installs
    // the projection a conflict carries on `disk` — which replaces every identity
    // this session holds — and reports `adoption: notOwed` for it, because it
    // re-read nothing and wrote nothing. So the adoption cannot be the evidence
    // here and the arm is. The pair below is the one production really produces;
    // the case this replaces paired a *refused* arm with an adoption, which
    // `BrowserState.moveMatch` cannot answer at all.
    const conflicted = applyMove(inFlight(), CONFLICT, NOT_OWED);
    expect(conflicted.moved).toBe(false);
    expect(conflicted.invalidated).toBe(true);
    // And it survives the panel being dismissed, which is the state the finding was
    // filed about: `canChoose` used to come back and `spent` used to stay false for
    // a session whose identities had been replaced.
    const dismissed = dismissMoveOutcome(conflicted);
    expect(canChoose(dismissed)).toBe(false);
    expect(matchMoveView(dismissed, [CONFLICT.disk]).spent).toBe(true);
    expect(matchMoveView(dismissed, [CONFLICT.disk]).cannotMove).toBe('outOfDate');
  }); // End of the "conflict spends the session" case

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
    expect(matchMoveView(conflicted, HELD).conflictChoices).toEqual(['keepEditing']);
    const dismissed = dismissMoveOutcome(conflicted);
    expect(conflictOf(dismissed)).toBeNull();
    // **Dismissing the panel is not getting the session back.** A conflict wrote
    // nothing, so `moved` stays `false` — but `BrowserState.moveMatch` installs
    // the projection the conflict carried, and these identities came from the one
    // it replaced. Two independent things refuse the move now: the invalidation the
    // arm itself sets, and the live check.
    expect(canMove(dismissed, [CONFLICT.disk])).toBe(false);
    expect(moveSubmissionRefusal(dismissed, [CONFLICT.disk])).toBe('outOfDate');
    expect(beginMove(dismissed, identityInProjection([CONFLICT.disk], dismissed.match))).toBeNull();
    // Including against the projection the session was opened over, which is what a
    // window that had not yet installed the disk side would be holding: the
    // invalidation is not conditional on the live check noticing.
    expect(canMove(dismissed, HELD)).toBe(false);
    expect(beginMove(dismissed, live(0))).toBeNull();
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

    // **And the invalidated-plus-uncertain pair.** A dismissed conflict leaves a
    // session whose identities were replaced and nothing written, which on its own
    // reads `outOfDate` — *nothing has been written*. An uncertain send after it
    // must not be reported with that sentence.
    const dismissed = dismissMoveOutcome(applyMove(inFlight(), CONFLICT, NOT_OWED));
    expect(moveSubmissionRefusal(dismissed, [CONFLICT.disk])).toBe('outOfDate');
    const uncertain = moveCouldNotBeSent(dismissed, true, UNCERTAIN);
    expect(uncertain.invalidated).toBe(true);
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
    expect(view.notMovable).toBeNull();
    expect(view.cannotMove).toBeNull();
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
    expect(view.notMovable).toBe('readOnly');
    expect(view.cannotMove).toBe('notMovable');
  });

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
