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
 * 7. **the view** — what a screen would draw, derived on every read;
 * 8. **the external session** (Phase 2d-6-4) — the seven verdict arms, the two
 *    new refusal codes, the held observation, the uncertainty, and the reapply
 *    over the observation's table by full identity for the subject and the
 *    anchor, with the same-sequence rule asked of both over the disk version.
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
  ReapplyPlacement,
  ReapplyResolution,
  SaveResult
} from '../ipc/types';
import { makeConflict, makeDocument, makeMatch, matchListPath } from './fixtures';
import type { InvalidationStatus } from './invalidation';
import { identityInProjection } from './matchDeletion';
import {
  acknowledgeMoveFindings,
  acknowledgeMoveSnapshot,
  applyMove,
  applyMoveObservation,
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
  moveReapplyObstacleKey,
  moveRecoveryChoices,
  moveRecoveryFailed,
  moveRecoveryKey,
  moveRefusalKey,
  moveSubmissionRefusal,
  moveSubmissionRefusalKey,
  placementOf,
  reapplyToDiskVersion,
  reloadTheDiskVersion,
  sameSequence,
  sequenceOf,
  startMatchMove,
  type MatchMoveSession,
  type MovePlacement,
  type MoveReapplyObstacle,
  type MoveRefusal,
  type MoveSubmissionRefusal
} from './matchMove';
import { NOT_RELOADING, type AdoptTheDiskVersion } from './editorSave';
import {
  externalConflictSource,
  standingConflictOf,
  type ConflictSource,
  type ExternalChangeConflictSource,
  type ExternalConflictObservation,
  type ObservationVerdict
} from './conflictSource';
import { describeMoveReapplyObstacle } from '../i18n';
import type { CorrespondenceEntry, CorrespondenceTable, DocumentId } from '../ipc/types';
import {
  arbitratedDelivery,
  retainedDelivery,
  writtenHereDelivery,
  type ObservationDelivery
} from './observationDelivery';
import { attemptOfReapply, reapplyToShow, type StandingOriginGuard } from './reapply';
import { isExternalConflict, isSaveConflict, type DiskAdoptionOutcome } from './saveOutcome';
import type { ConflictChoice, ConflictModel, ExternalConflictModel } from './saveOutcome';

/*
 * **`((onHand) => door(onHand, …, () => onHand))(value)`** is a door, a settling
 * transition or a reapply called with a reader answering the very session it is
 * handed — the installed session of a caller that registers no receiver. Phase
 * 2d-6-6a made the reader required; this is how a case that is not about
 * displacement says so without evaluating `value` twice. The cases that are about
 * displacement pass a holder's reader instead.
 */

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
    expect(beginMove(chosen, identityInProjection(held, chosen.match), () => chosen)).toBeNull();
    // **Every placement and not only the `after` ones.** The snippet being moved
    // shares its document and its revision with its anchors, so it stops resolving
    // when they do: "choose another destination" would be false advice.
    for (const placement of [{ kind: 'top' as const }, { kind: 'end' as const }]) {
      const other = choosePlacement(session(0), placement);
      expect(moveSubmissionRefusal(other, held)).toBe('outOfDate');
      expect(beginMove(other, identityInProjection(held, other.match), () => other)).toBeNull();
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
    expect(beginMove(forged, live(0), () => forged)).toBeNull();
  });

  it('withdraws what was said about the last attempt when the destination moves', () => {
    const started = ((onHand) => beginMove(onHand, live(0), () => onHand))(choosePlacement(session(0), { kind: 'end' }));
    const refused = applyMove(started!.session, REFUSED, NOT_OWED, () => started!.session);
    expect(matchMoveView(refused, HELD).outcome?.kind).toBe('refused');
    const rechosen = choosePlacement(refused, { kind: 'after', anchor: live(1) });
    // A refusal is about **one** destination, so a panel describing a destination
    // nobody has chosen any more is taken down with it.
    expect(rechosen.outcome).toBeNull();
    expect(rechosen.submitted).toBeNull();
  });

  it('accepts nothing while a move is in flight, in a conflict, or after a commit', () => {
    const started = ((onHand) => beginMove(onHand, live(0), () => onHand))(choosePlacement(session(0), { kind: 'end' }));
    expect(canChoose(started!.session)).toBe(false);
    expect(choosePlacement(started!.session, { kind: 'top' })).toBe(started!.session);

    const conflicted = applyMove(started!.session, CONFLICT, NOT_OWED, () => started!.session);
    expect(canChoose(conflicted)).toBe(false);
    expect(moveSubmissionRefusal(conflicted, HELD)).toBe('conflict');

    const committed = applyMove(started!.session, saved(), ADOPTED, () => started!.session);
    expect(canChoose(committed)).toBe(false);
    expect(moveSubmissionRefusal(committed, HELD)).toBe('alreadyMoved');
    // And dismissing the panel does not give it back.
    expect(canChoose(dismissMoveOutcome(committed))).toBe(false);
  });
}); // End of the "choosing" suite

describe('starting a move', () => {
  it('produces the identities the command takes, with the end already lowered', () => {
    const started = ((onHand) => beginMove(onHand, live(0), () => onHand))(choosePlacement(session(0), { kind: 'end' }));
    expect(started!.match).toEqual(live(0));
    expect(started!.after).toEqual(live(2));
    expect(started!.session.phase).toBe('saving');
    expect(started!.submission.acknowledgement).toEqual({ accepted: [] });
  });

  it('sends a `null` anchor for the top of the list', () => {
    const started = ((onHand) => beginMove(onHand, live(2), () => onHand))(choosePlacement(session(2), { kind: 'top' }));
    expect(started!.after).toBeNull();
  });

  it('freezes the base revision the session was opened at', () => {
    const held = choosePlacement(session(0), { kind: 'end' });
    expect(baseRevisionOf(held)).toBe(BASE);
    expect(beginMove(held, live(0), () => held)!.submission.baseRevision).toBe(BASE);
  });

  it('refuses when the live projection no longer gives that snippet this identity', () => {
    // **The only argument that comes from outside the session.** Everything else
    // was minted at `startMatchMove` and goes on agreeing with itself however
    // stale it all is, which is `confirmDelete`'s fourth-value rule for a move.
    const held = choosePlacement(session(0), { kind: 'end' });
    expect(beginMove(held, live(0), () => held)).not.toBeNull();
    expect(beginMove(held, null, () => held)).toBeNull();
    // The node is deliberately kept and only the revision moved: a fixture that
    // renumbered the nodes would pass by finding nothing, which is a weaker claim.
    expect(beginMove(held, live(0, reread()), () => held)).toBeNull();
    // And what a screen would have drawn about that session says the same thing,
    // which is the half that used to be missing: the view is derived from the same
    // live projections, so it cannot enable a control this refuses.
    expect(matchMoveView(held, [reread()]).canMove).toBe(false);
  });

  it('produces nothing when the destination does not move the snippet', () => {
    expect(((onHand) => beginMove(onHand, live(0), () => onHand))(session(0))).toBeNull();
    expect(((onHand) => beginMove(onHand, live(2), () => onHand))(choosePlacement(session(2), { kind: 'end' }))).toBeNull();
  });

  it('produces nothing for a snippet that may not be moved', () => {
    const packaged = file({ kind: 'Package', readOnly: true });
    const held = session(0, packaged);
    expect(moveSubmissionRefusal(held, [packaged])).toBe('notMovable');
    expect(beginMove(held, live(0, packaged), () => held)).toBeNull();
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
    expect(beginMove(held, live(0, again), () => held)).toBeNull();
  });
}); // End of the "starting" suite

describe('what comes back', () => {
  /**
   * A session with a destination chosen and a move already sent.
   *
   * @returns The waiting session.
   */
  function inFlight() {
    return ((onHand) => beginMove(onHand, live(0), () => onHand))(choosePlacement(session(0), { kind: 'end' }))!.session;
  } // End of function inFlight()

  it('spends the session on a commit and keeps the identity the save answered', () => {
    const landed: MatchId = { document: 2, revision: AFTER, node: 31 };
    const done = ((onHand) => applyMove(onHand, saved(true, landed), ADOPTED, () => onHand))(inFlight());
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
    const done = ((onHand) => applyMove(onHand, saved(false, null, BASE), NOT_OWED, () => onHand))(inFlight());
    expect(done.moved).toBe(false);
    expect(done.invalidated).toBe(false);
    const view = matchMoveView(done, HELD);
    expect(view.spent).toBe(false);
    expect(view.messages.map((message) => message.kind)).toEqual(['nothingToWrite']);
    // And the session really is still usable: the snippet is still at the top, so
    // moving it to the end is still a move that can be sent.
    expect(view.canMove).toBe(true);
    expect(beginMove(done, live(0), () => done)).not.toBeNull();
  });

  it('spends the session when a `committed: false` owed an adoption anyway', () => {
    // **Finding 1 of the 2c-3b-1 review, pinned.** "The move committed" and "this
    // session's identities were invalidated" are two facts. The wrapper adopts on
    // `committed || revision !== view.revision`, so a save that wrote nothing and
    // ended on a revision this window was not projecting re-reads the file — and
    // every identity here was minted from the parse that re-read replaced. The
    // session must stop offering the move **without** claiming the move committed.
    const done = ((onHand) => applyMove(onHand, saved(false, null, AFTER), ADOPTED, () => onHand))(inFlight());
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
    expect(beginMove(done, identityInProjection([reread()], done.match), () => done)).toBeNull();
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
    const conflicted = ((onHand) => applyMove(onHand, CONFLICT, NOT_OWED, () => onHand))(inFlight());
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
    const refused = ((onHand) => applyMove(onHand, REFUSED, ADOPTED, () => onHand))(inFlight());
    expect(refused.moved).toBe(false);
    expect(refused.invalidated).toBe(true);
    expect(matchMoveView(refused, HELD).spent).toBe(true);
    expect(canChoose(refused)).toBe(false);
    // And the same for a failed adoption, which is the other arm of "owed at all".
    expect(((onHand) => applyMove(onHand, REFUSED, NOT_ADOPTED, () => onHand))(inFlight()).invalidated).toBe(true);
  }); // End of the structural non-saved-arm adoption case

  it('puts the out-of-step line beside a commit whose adoption failed', () => {
    const done = ((onHand) => applyMove(onHand, saved(), NOT_ADOPTED, () => onHand))(inFlight());
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
    const refused = ((onHand) => applyMove(onHand, REFUSED, NOT_OWED, () => onHand))(inFlight());
    const view = matchMoveView(refused, HELD);
    expect(view.outcome?.kind).toBe('refused');
    expect(view.refusalChoices).toEqual(['saveAnyway', 'keepEditing']);
    expect(view.moved).toBe(false);

    const consented = acknowledgeMoveFindings(refused);
    const again = beginMove(consented, live(0), () => consented);
    expect(again!.submission.acknowledgement).toEqual({ accepted: [SUSPICION] });
  });

  it('withdraws the consent when the destination changes under a refusal', () => {
    // Consent is content-addressed to the candidate, and the candidate here **is**
    // the destination — so a second destination cannot spend the first's consent.
    const refused = ((onHand) => applyMove(onHand, REFUSED, NOT_OWED, () => onHand))(inFlight());
    const consented = acknowledgeMoveFindings(refused);
    const rechosen = choosePlacement(consented, { kind: 'after', anchor: live(1) });
    expect(beginMove(rechosen, live(0), () => rechosen)!.submission.acknowledgement).toEqual({ accepted: [] });
  });

  it('offers one way out of a conflict, and stops offering the move while it shows', () => {
    const conflicted = ((onHand) => applyMove(onHand, CONFLICT, NOT_OWED, () => onHand))(inFlight());
    expect(conflictOf(conflicted)).not.toBeNull();
    expect(canMove(conflicted, HELD)).toBe(false);
    // Two, since 2c-4a-3b flipped `offersReload`: the non-destructive way out and
    // the first step of the reload. Never a copy — a placement is a positional
    // choice, and `conflictChoicesFor` refuses one whatever this surface declares.
    expect(matchMoveView(conflicted, HELD).conflictChoices).toEqual([
      'keepEditing',
      'keepMyDraft',
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
    expect(beginMove(dismissed, live(0), () => dismissed)).not.toBeNull();
    // A window that really has moved on is the live check's question, and it still
    // answers it: the session says nothing about a projection nobody told it about.
    expect(canMove(dismissed, [CONFLICT.disk])).toBe(false);
    expect(moveSubmissionRefusal(dismissed, [CONFLICT.disk])).toBe('outOfDate');
    expect(beginMove(dismissed, identityInProjection([CONFLICT.disk], dismissed.match), () => dismissed)).toBeNull();
  });

  it('records a send that produced no outcome, in its two arms', () => {
    const notSent = ((onHand) => moveCouldNotBeSent(onHand, false, null, () => onHand))(inFlight());
    expect(notSent.sendFailure).toEqual({ kind: 'notSent', reason: null });
    expect(notSent.moved).toBe(false);
    // A failure before the rename really did write nothing, so the session is not
    // spent and the same move may be sent again.
    expect(notSent.mayHaveWritten).toBe(false);
    expect(canChoose(notSent)).toBe(true);
    expect(canMove(notSent, HELD)).toBe(true);
    const failure: IpcFailure = { kind: 'command', error: { code: 'noWorkspaceOpen' } };
    const maybe = ((onHand) => moveCouldNotBeSent(onHand, true, failure, () => onHand))(inFlight());
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
    const maybe = ((onHand) => moveCouldNotBeSent(onHand, true, UNCERTAIN, () => onHand))(inFlight());
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
    expect(beginMove(maybe, live(0), () => maybe)).toBeNull();
    expect(matchMoveView(maybe, HELD).spent).toBe(true);
    // **The re-read succeeded**, so the window now holds a different parse. The
    // reason is still `mayHaveWritten` and never `outOfDate`, whose sentence says
    // *nothing has been written* — the one claim this session has just disclaimed.
    expect(moveSubmissionRefusal(maybe, [reread()])).toBe('mayHaveWritten');
    expect(matchMoveView(maybe, [reread()]).cannotMove).toBe('mayHaveWritten');
    expect(matchMoveView(maybe, [reread()]).spent).toBe(true);
    expect(beginMove(maybe, identityInProjection([reread()], maybe.match), () => maybe)).toBeNull();
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
    const committed = ((onHand) => applyMove(onHand, saved(), ADOPTED, () => onHand))(inFlight());
    expect(moveSubmissionRefusal(committed, HELD)).toBe('alreadyMoved');
    const afterwards = moveCouldNotBeSent(committed, true, UNCERTAIN, () => committed);
    expect(afterwards.moved).toBe(true);
    expect(afterwards.mayHaveWritten).toBe(true);
    expect(moveSubmissionRefusal(afterwards, HELD)).toBe('mayHaveWritten');
    expect(matchMoveView(afterwards, HELD).cannotMove).toBe('mayHaveWritten');
    expect(matchMoveView(afterwards, HELD).spent).toBe(true);

    // **The other order, because which answer arrives first is the caller's.** A
    // session already spent by an uncertain send that then takes a committed answer
    // holds both flags too, and says the same thing about them.
    const beforehand = ((onHand) => applyMove(onHand, saved(), ADOPTED, () => onHand))(((onHand) => moveCouldNotBeSent(onHand, true, UNCERTAIN, () => onHand))(inFlight()));
    expect(beforehand.moved).toBe(true);
    expect(beforehand.mayHaveWritten).toBe(true);
    expect(moveSubmissionRefusal(beforehand, HELD)).toBe('mayHaveWritten');

    // **And the stale-plus-uncertain pair.** A session whose window has moved on —
    // measured by the live projections, since 2c-4a-2 a dismissed conflict spends
    // nothing — reads `outOfDate` on its own, which says *nothing has been
    // written*. An uncertain send after it must not be reported with that sentence.
    const dismissed = dismissMoveOutcome(((onHand) => applyMove(onHand, CONFLICT, NOT_OWED, () => onHand))(inFlight()));
    expect(moveSubmissionRefusal(dismissed, [CONFLICT.disk])).toBe('outOfDate');
    const uncertain = moveCouldNotBeSent(dismissed, true, UNCERTAIN, () => dismissed);
    expect(uncertain.moved).toBe(false);
    expect(moveSubmissionRefusal(uncertain, [CONFLICT.disk])).toBe('mayHaveWritten');
    expect(beginMove(uncertain, identityInProjection([CONFLICT.disk], uncertain.match), () => uncertain)).toBeNull();
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
      expect(matchMoveView(((onHand) => moveCouldNotBeSent(onHand, false, failure, () => onHand))(inFlight()), HELD).recovery).toEqual([
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
    const refused = ((onHand) => moveCouldNotBeSent(onHand, false, disputed, () => onHand))(inFlight());
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
    expect(beginMove(spent, identityInProjection(HELD, spent.match), () => spent)).toBeNull();
    // Putting the send failure away does not hand the session back, which is the
    // rule every other spending flag already follows.
    expect(dismissMoveOutcome(spent).invalidated).toBe(true);
    expect(canChoose(dismissMoveOutcome(spent))).toBe(false);
  }); // End of the "failed recovery re-read" case

  it('ignores an answer nothing was waiting for', () => {
    const clean = session(0);
    expect(applyMove(clean, saved(), ADOPTED, () => clean)).toBe(clean);
  });

  it('never takes a commit or an invalidation back', () => {
    // Both flags are or-ed into rather than assigned, so "cleared by nothing" is
    // what the code does and not only what the reachable transitions allow: a
    // second answer handed to a session that has already committed — which this
    // module offers no way to produce, and which a hand-written caller can — does
    // not turn a written file back into an unwritten one.
    const committed = ((onHand) => applyMove(onHand, saved(), ADOPTED, () => onHand))(inFlight());
    const again = applyMove(committed, saved(false, null, BASE), NOT_OWED, () => committed);
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
    const started = ((onHand) => beginMove(onHand, live(0), () => onHand))(choosePlacement(session(0), { kind: 'end' }));
    const done = applyMove(started!.session, saved(true, null, AFTER, [note]), ADOPTED, () => started!.session);
    expect(matchMoveView(done, HELD).notes).toEqual([note]);
    expect(matchMoveView(done, HELD).notes[0]).toBe(note);
    // And an answer that carried none still shows none.
    const quiet = applyMove(started!.session, saved(), ADOPTED, () => started!.session);
    expect(matchMoveView(quiet, HELD).notes).toEqual([]);
  });

  it('has a sentence for every submission refusal, in both languages', () => {
    const reasons: readonly MoveSubmissionRefusal[] = [
      'alreadyMoved',
      'mayHaveWritten',
      'saveInFlight',
      'externalConflict',
      'conflict',
      'observationRetained',
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
    const started = ((onHand) => beginMove(onHand, live(0), () => onHand))(choosePlacement(session(0), { kind: 'end' }));
    if (started === null) {
      throw new Error('a chosen destination is sendable');
    }
    return applyMove(started.session, CONFLICT, NOT_OWED, () => started.session);
  } // End of function conflicted()

  /**
   * A recorder for the window's own adoption.
   *
   * @param answer - What the window answers. `refused` is a real production
   *   answer — a confirmation issued for another conflict, one already spent, a
   *   conflict this window did not produce, an unprojected document, or a
   *   projection replaced since the conflict arrived when the window does not
   *   already hold the requested revision.
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
    expect(reloadTheDiskVersion(stuck, recorder.adopt, () => stuck)).toBe(stuck);
    const asked = askToReloadDiskVersion(stuck);
    expect(matchMoveView(asked, HELD).reloadWarning).toBe('positionalDestination');
    // The warning alone is not a confirmation either.
    expect(reloadTheDiskVersion(asked, recorder.adopt, () => asked)).toBe(asked);
    expect(recorder.adoptions).toEqual([]);
    expect(matchMoveView(asked, HELD).closed).toBe(false);
  }); // End of the "two steps" case

  it('adopts the disk projection once, and closes the session', () => {
    const recorder = adopting();
    const confirmed = confirmDiskReload(askToReloadDiskVersion(conflicted()));
    const after = reloadTheDiskVersion(confirmed, recorder.adopt, () => confirmed);

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
    const after = reloadTheDiskVersion(confirmed, satisfied.adopt, () => confirmed);
    expect(after.closed).toBe(true);
    expect(conflictOf(after)).toBeNull();
  }); // End of the "already at the disk version" case

  it('closes nothing when the window refuses the adoption', () => {
    // Closing over a window that never moved would report a reload that did not
    // happen, and take the conflict panel off the screen with it.
    const refusing = adopting('refused');
    const confirmed = confirmDiskReload(askToReloadDiskVersion(conflicted()));
    const after = reloadTheDiskVersion(confirmed, refusing.adopt, () => confirmed);
    expect(after.closed).toBe(false);
    // **And the reload stops being offered rather than staying pressable.** The
    // window said no with no word about which guard produced it, so the step is
    // terminal, the panel discloses it, and only *Keep editing* and the copy remain
    // (2c-4a-3a review, finding 3). Terminal is what this panel draws, and not a
    // claim that a later ask would be refused too.
    expect(after.reload.kind).toBe('refused');
    expect(matchMoveView(after, HELD).reloadUnavailable).toBe(true);
    expect(matchMoveView(after, HELD).reloadWarning).toBeNull();
    expect(matchMoveView(after, HELD).conflictChoices).not.toContain('confirmReload');
    expect(matchMoveView(after, HELD).conflictChoices).not.toContain('reloadDiskVersion');
    expect(matchMoveView(after, HELD).conflictChoices).toContain('keepEditing');
    // Asking again cannot spend anything a second time.
    expect(reloadTheDiskVersion(after, refusing.adopt, () => after)).toBe(after);
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
      'keepMyDraft',
      'reloadDiskVersion'
    ]);
    expect(matchMoveView(conflict, HELD).reloadWarning).toBeNull();

    const asked = askToReloadDiskVersion(conflict);
    expect(matchMoveView(asked, HELD).conflictChoices).toEqual<readonly ConflictChoice[]>([
      'keepEditing',
      'keepMyDraft',
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
      const started = ((onHand) => beginMove(onHand, live(1), () => onHand))(choosePlacement(session(1), placement));
      if (started === null) {
        throw new Error(`this case needs ${warning} to be sendable`);
      }
      const asked = askToReloadDiskVersion(applyMove(started.session, CONFLICT, NOT_OWED, () => started.session));
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
      const started = ((onHand) => beginMove(onHand, live(1), () => onHand))(choosePlacement(session(1), placement));
      if (started === null) {
        throw new Error(`this case needs ${summary} to be sendable`);
      }
      const conflict = applyMove(started.session, CONFLICT, NOT_OWED, () => started.session);
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
    const started = ((onHand) => beginMove(
      onHand,
      live(1), () => onHand
    ))(choosePlacement(session(1), { kind: 'after', anchor: live(2) }));
    if (started === null) {
      throw new Error('an anchored destination is sendable');
    }
    const conflict = applyMove(started.session, CONFLICT, NOT_OWED, () => started.session);
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
    expect(reloadTheDiskVersion(dismissed, recorder.adopt, () => dismissed)).toBe(dismissed);
    expect(recorder.adoptions).toEqual([]);
  }); // End of the "dismissal forgets the confirmation" case
}); // End of the "confirmed reload" suite

describe('reapplying the retained move', () => {
  // **2c-4b-2 builds this and 2c-4b-3 draws it.** `ConflictChoice` has no member
  // for a reapply, so nothing here is reachable from a control; every case calls
  // the transition directly.

  /**
   * The same three snippets, **reordered**, at the revision a conflict reports.
   *
   * The arena nodes travel with the snippets and the indexes do not, which is
   * exactly what a reapply must follow: the old final path index is never a
   * tie-break, and the destination is rebuilt from the new sequence.
   *
   * @param overrides - Whatever a case needs the disk file to keep saying.
   * @returns The projection the conflict carries.
   */
  function reordered(overrides: Parameters<typeof makeDocument>[0] = {}): DocumentView {
    return file({
      revision: AFTER,
      matches: [
        makeMatch({ node: 12, document: 2, revision: AFTER, trigger: ':sql', path: matchListPath(0) }),
        makeMatch({ node: 10, document: 2, revision: AFTER, trigger: ':sig', path: matchListPath(1) }),
        makeMatch({ node: 11, document: 2, revision: AFTER, trigger: ':date', path: matchListPath(2) })
      ],
      ...overrides
    });
  } // End of function reordered()

  /**
   * One snippet of a disk projection, by the trigger it is written with.
   *
   * By trigger rather than by index, because *which snippet* is the whole question
   * a reapply answers and an index is what it must not use.
   *
   * @param document - The projection.
   * @param trigger - The snippet's trigger.
   * @returns Its projection.
   */
  function snippet(document: DocumentView, trigger: string): MatchView {
    const found = document.matches.find((one) => one.trigger.trigger?.text === trigger);
    if (found === undefined) {
      throw new Error(`this fixture holds no ${trigger}`);
    }
    return found;
  } // End of function snippet()

  /**
   * A conflicted move whose payload carries chosen correspondence evidence.
   *
   * @param position - Which snippet of {@link file} the move is about.
   * @param placement - Where the person asked for it to go.
   * @param subject - What the search for the moved snippet answered.
   * @param disk - The newly parsed projection the conflict carries.
   * @param anchor - What the search for the positional anchor answered.
   * @returns The session showing the conflict.
   */
  function conflictedOver(
    position: number,
    placement: MovePlacement,
    subject: ReapplyResolution,
    disk: DocumentView,
    anchor: ReapplyPlacement = { NotAnchored: {} }
  ): MatchMoveSession {
    const chosen = choosePlacement(session(position), placement);
    const started = beginMove(chosen, live(position), () => chosen);
    if (started === null) {
      throw new Error('this case needs a move that really moves');
    }
    return applyMove(
      started.session,
      makeConflict({ disk, subject, placement: anchor, expected: BASE, found: AFTER }),
      NOT_OWED, () => started.session
    );
  } // End of function conflictedOver()

  /**
   * A recorder for the window's own adoption.
   *
   * @param answer - What the window answers.
   * @returns The callback to pass, and the conflicts it was handed.
   */
  function adoptingReapply(answer: DiskAdoptionOutcome = 'installed'): {
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
  } // End of function adoptingReapply()

  it('follows the snippet and not its former index after a reorder', () => {
    // The snippet was the second item and is now the third. Nothing carries the
    // old index: the members and the anchors are rebuilt from the sequence the
    // adopted projection holds.
    const disk = reordered();
    const target = snippet(disk, ':date');
    const stuck = conflictedOver(1, { kind: 'top' }, { Identified: { target } }, disk);
    const recorder = adoptingReapply();
    const answer = reapplyToDiskVersion(stuck, null, recorder.adopt, null, () => stuck);
    expect(answer.kind).toBe('reapplied');
    if (answer.kind !== 'reapplied') {
      throw new Error('this case is about the rebuilt session');
    }
    expect(answer.session.match).toEqual(target.id);
    expect(baseRevisionOf(answer.session)).toBe(AFTER);
    expect(answer.session.members.map((one) => one.node)).toEqual([12, 10, 11]);
    expect(placementOf(answer.session)).toEqual({ kind: 'top' });
    expect(recorder.adoptions).toEqual([conflictOf(stuck)]);
    // **R25 stays visible**: what the rebuilt session produces is one move and
    // nothing else, and the wire's `after` is the lowering of *top*.
    const started = beginMove(
      answer.session,
      identityInProjection([disk], answer.session.match), () => answer.session
    );
    expect(started).not.toBeNull();
    expect(started?.match).toEqual(target.id);
    expect(started?.after).toBeNull();
    expect(started?.submission.baseRevision).toBe(AFTER);
  });

  it('lowers end afresh against the new sequence', () => {
    // *End* is a semantic choice: it means the bottom of whatever list the file
    // now holds, so the anchor it lowers to is the new last other snippet.
    const disk = reordered();
    const target = snippet(disk, ':sig');
    const stuck = conflictedOver(0, { kind: 'end' }, { Identified: { target } }, disk);
    const answer = reapplyToDiskVersion(stuck, null, adoptingReapply().adopt, null, () => stuck);
    if (answer.kind !== 'reapplied') {
      throw new Error('this case is about the rebuilt session');
    }
    expect(placementOf(answer.session)).toEqual({ kind: 'end' });
    expect(
      beginMove(answer.session, identityInProjection([disk], answer.session.match), () => answer.session)?.after
    ).toEqual(snippet(disk, ':date').id);
  });

  it('ignores the evidence anchor entirely for a semantic placement', () => {
    // **An `end` was lowered to *after the last other snippet* before it was
    // sent**, so its wire anchor is a snippet the person never named. Refusing the
    // move because that snippet's bytes changed would refuse a request that has
    // nothing to do with it.
    const disk = reordered();
    const target = snippet(disk, ':sig');
    const stuck = conflictedOver(0, { kind: 'end' }, { Identified: { target } }, disk, {
      Refused: { reason: 'NoExactCorrespondence' }
    });
    expect(reapplyToDiskVersion(stuck, null, adoptingReapply().adopt, null, () => stuck).kind).toBe('reapplied');
  });

  it('rebuilds an after from the identified anchor, never from the old one', () => {
    const disk = reordered();
    const target = snippet(disk, ':sig');
    const anchor = snippet(disk, ':date');
    const stuck = conflictedOver(
      0,
      { kind: 'after', anchor: live(1) },
      { Identified: { target } },
      disk,
      { Identified: { target: anchor } }
    );
    const answer = reapplyToDiskVersion(stuck, null, adoptingReapply().adopt, null, () => stuck);
    if (answer.kind !== 'reapplied') {
      throw new Error('this case is about the rebuilt session');
    }
    // The anchor's revision is the adopted one; the identity the session drafted
    // belonged to a parse that is gone.
    expect(placementOf(answer.session)).toEqual({ kind: 'after', anchor: anchor.id });
    expect(
      beginMove(answer.session, identityInProjection([disk], answer.session.match), () => answer.session)?.after
    ).toEqual(anchor.id);
  });

  it('reports alreadySatisfied when the disk already writes it there', () => {
    // The person asked for *after `:sql`*, and the reordered file already writes
    // `:sig` directly after `:sql`. Nothing is written — and the disk is still
    // adopted, because the window must describe the file that already says it.
    const disk = reordered();
    const target = snippet(disk, ':sig');
    const anchor = snippet(disk, ':sql');
    const stuck = conflictedOver(
      0,
      { kind: 'after', anchor: live(2) },
      { Identified: { target } },
      disk,
      { Identified: { target: anchor } }
    );
    const recorder = adoptingReapply();
    const answer = reapplyToDiskVersion(stuck, null, recorder.adopt, null, () => stuck);
    expect(answer.kind).toBe('alreadySatisfied');
    if (answer.kind !== 'alreadySatisfied') {
      throw new Error('this case is about the satisfied arm');
    }
    expect(recorder.adoptions).toHaveLength(1);
    expect(moveSubmissionRefusal(answer.session, [disk])).toBe('alreadyThere');
    expect(
      beginMove(answer.session, identityInProjection([disk], answer.session.match), () => answer.session)
    ).toBeNull();
  });

  it('refuses an anchor the core would not establish, and adopts nothing', () => {
    const disk = reordered();
    const recorder = adoptingReapply();
    const stuck = conflictedOver(
      0,
      { kind: 'after', anchor: live(1) },
      { Identified: { target: snippet(disk, ':sig') } },
      disk,
      { Refused: { reason: 'AmbiguousExact' } }
    );
    expect(reapplyToDiskVersion(stuck, null, recorder.adopt, null, () => stuck)).toEqual({
      kind: 'manualResolution',
      obstacle: { kind: 'anchorCorrespondence', reason: 'AmbiguousExact' }
    });
    expect(recorder.adoptions).toEqual([]);
  });

  it('refuses evidence that answers no anchor although the move names one', () => {
    const disk = reordered();
    const recorder = adoptingReapply();
    const stuck = conflictedOver(
      0,
      { kind: 'after', anchor: live(1) },
      { Identified: { target: snippet(disk, ':sig') } },
      disk
    );
    expect(reapplyToDiskVersion(stuck, null, recorder.adopt, null, () => stuck)).toEqual({
      kind: 'manualResolution',
      obstacle: { kind: 'evidenceNotAnAnchor' }
    });
    expect(recorder.adoptions).toEqual([]);
  });

  it('refuses an identified anchor the new sequence does not offer, and adopts nothing', () => {
    // The anchor identified is the moved snippet itself — the self-anchor
    // exclusion — which `choosePlacement` would answer *unchanged* for, and that
    // answer is indistinguishable from *the destination did not move*.
    const disk = reordered();
    const target = snippet(disk, ':sig');
    const recorder = adoptingReapply();
    const stuck = conflictedOver(
      0,
      { kind: 'after', anchor: live(1) },
      { Identified: { target } },
      disk,
      { Identified: { target } }
    );
    expect(reapplyToDiskVersion(stuck, null, recorder.adopt, null, () => stuck)).toEqual({
      kind: 'manualResolution',
      obstacle: { kind: 'anchorNotInSequence' }
    });
    expect(recorder.adoptions).toEqual([]);
  });

  it('refuses a snippet the new parse addresses in another sequence', () => {
    // **"Same sequence" is the invariant, and "same file" is not it** (D2r). No
    // projection produces two snippet lists today, which is exactly why the rule
    // is written rather than assumed: encoding the coincidence would make the
    // model silently wrong the first time one does.
    const elsewhere = makeMatch({
      node: 10,
      document: 2,
      revision: AFTER,
      trigger: ':sig',
      path: { document_index: 0, segments: [{ Key: 'other' }, { Index: 0 }] }
    });
    const disk = reordered({
      matches: [
        elsewhere,
        makeMatch({ node: 11, document: 2, revision: AFTER, trigger: ':date', path: matchListPath(0) }),
        makeMatch({ node: 12, document: 2, revision: AFTER, trigger: ':sql', path: matchListPath(1) })
      ]
    });
    const recorder = adoptingReapply();
    const stuck = conflictedOver(0, { kind: 'end' }, { Identified: { target: elsewhere } }, disk);
    expect(reapplyToDiskVersion(stuck, null, recorder.adopt, null, () => stuck)).toEqual({
      kind: 'manualResolution',
      obstacle: { kind: 'notTheSameSequence' }
    });
    expect(recorder.adoptions).toEqual([]);
  });

  it('refuses a correspondence the core would not establish, and adopts nothing', () => {
    const recorder = adoptingReapply();
    const stuck = conflictedOver(
      0,
      { kind: 'end' },
      { Refused: { reason: 'TargetMissingOrTriggerChanged' } },
      reordered()
    );
    expect(reapplyToDiskVersion(stuck, null, recorder.adopt, null, () => stuck)).toEqual({
      kind: 'manualResolution',
      obstacle: { kind: 'correspondence', reason: 'TargetMissingOrTriggerChanged' }
    });
    expect(recorder.adoptions).toEqual([]);
  });

  it('refuses evidence that names no snippet, and adopts nothing', () => {
    const recorder = adoptingReapply();
    const stuck = conflictedOver(0, { kind: 'end' }, { Targetless: {} }, reordered());
    expect(reapplyToDiskVersion(stuck, null, recorder.adopt, null, () => stuck)).toEqual({
      kind: 'manualResolution',
      obstacle: { kind: 'evidenceNotATarget' }
    });
    expect(recorder.adoptions).toEqual([]);
  });

  it('asks the ordinary submission rule again over the new parse', () => {
    const disk = reordered({ readOnly: true });
    const recorder = adoptingReapply();
    const stuck = conflictedOver(
      0,
      { kind: 'end' },
      { Identified: { target: snippet(disk, ':sig') } },
      disk
    );
    expect(reapplyToDiskVersion(stuck, null, recorder.adopt, null, () => stuck)).toEqual({
      kind: 'manualResolution',
      obstacle: { kind: 'moveRefused', reason: 'notMovable' }
    });
    expect(recorder.adoptions).toEqual([]);
  });

  it('reports the window refusal and rebuilds nothing', () => {
    const disk = reordered();
    const recorder = adoptingReapply('refused');
    const stuck = conflictedOver(
      0,
      { kind: 'end' },
      { Identified: { target: snippet(disk, ':sig') } },
      disk
    );
    expect(reapplyToDiskVersion(stuck, null, recorder.adopt, null, () => stuck)).toEqual({ kind: 'adoptionRefused' });
    expect(recorder.adoptions).toHaveLength(1);
  });

  it('is not attempted when no conflict is showing', () => {
    const recorder = adoptingReapply();
    expect(((onHand) => reapplyToDiskVersion(onHand, null, recorder.adopt, null, () => onHand))(session(0))).toEqual({
      kind: 'notAttempted'
    });
    expect(recorder.adoptions).toEqual([]);
  });
}); // End of the reapply suite

describe('the external session — Phase 2d-6-4', () => {
  // **The receiver as a value, driven without a window.** Every envelope here is
  // sealed by the three constructors of `./observationDelivery.ts`, so the verdict
  // inside is about the observation inside by construction; `workspace.test.ts`
  // drives this same transition through a real `BrowserState`. Nothing here can
  // show a component registers the receiver — 2d-6-6 wires it — and nothing here
  // calls a command: no `BrowserState` exists in this file.

  /** The disk text every observation below reads. */
  const THEIRS = 'matches:\n  - trigger: x\n    replace: theirs\n';

  /**
   * The file as another writer left it: the same three snippets under a new
   * parse, **reordered**, so a reapply that carried an index would land on the
   * wrong snippet.
   *
   * @param overrides - Whatever the case needs the disk file to keep saying.
   * @returns The projection the observation carries.
   */
  function diskFile(overrides: Parameters<typeof makeDocument>[0] = {}): DocumentView {
    return makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: AFTER,
      matches: [
        makeMatch({ node: 32, document: 2, revision: AFTER, trigger: ':sql', path: matchListPath(0) }),
        makeMatch({ node: 30, document: 2, revision: AFTER, trigger: ':sig', path: matchListPath(1) }),
        makeMatch({ node: 31, document: 2, revision: AFTER, trigger: ':date', path: matchListPath(2) })
      ],
      ...overrides
    });
  } // End of function diskFile()

  /**
   * One snippet of a disk projection, by the trigger it is written with.
   *
   * @param document - The projection.
   * @param trigger - The snippet's trigger.
   * @returns Its projection.
   */
  function snippet(document: DocumentView, trigger: string): MatchView {
    const found = document.matches.find((one) => one.trigger.trigger?.text === trigger);
    if (found === undefined) {
      throw new Error(`this fixture holds no ${trigger}`);
    }
    return found;
  } // End of function snippet()

  /**
   * One narrowed observation of the session's file.
   *
   * A fresh object every call, deliberately: the memo in `./conflictSource.ts` and
   * the session's wait are both keyed on object identity.
   *
   * @param overrides - Whatever the case needs beyond the defaults.
   * @returns The observation, as a window would have narrowed it.
   */
  function observation(
    overrides: Partial<ExternalConflictObservation> = {}
  ): ExternalConflictObservation {
    return {
      sequence: 5,
      document: 2,
      previousRevision: BASE,
      diskRevision: AFTER,
      diskText: THEIRS,
      disk: diskFile(),
      findings: [],
      correspondences: null,
      ...overrides
    };
  } // End of function observation()

  /**
   * An observation of another file, which this session is never about.
   *
   * @returns The observation.
   */
  function otherObservation(): ExternalConflictObservation {
    return observation({
      document: 3,
      previousRevision: null,
      diskRevision: 'd'.repeat(64),
      disk: makeDocument({ id: 3, relativePath: 'match/other.yml', revision: 'd'.repeat(64) })
    });
  } // End of function otherObservation()

  /**
   * An arbitrated envelope, asserted to have reached the arm the case is about.
   *
   * @param standing - What stands for the file, or `null`.
   * @param seen - The observation.
   * @param uncertain - Whether the last settled write may have written.
   * @param arm - The verdict the case needs.
   * @returns The sealed envelope.
   */
  function decided(
    standing: ConflictSource | null,
    seen: ExternalConflictObservation,
    uncertain: boolean,
    arm: ObservationVerdict['kind']
  ): ObservationDelivery {
    const delivery = arbitratedDelivery(
      standing === null ? null : standingConflictOf(standing),
      seen,
      uncertain
    );
    expect(delivery.verdict.kind).toBe(arm);
    return delivery;
  } // End of function decided()

  /**
   * The `raised` envelope for one observation.
   *
   * @param seen - The observation.
   * @returns The envelope.
   */
  function raised(seen: ExternalConflictObservation): ObservationDelivery {
    return decided(null, seen, false, 'raised');
  } // End of function raised()

  /**
   * A recorder for the window's own adoption.
   *
   * @param answer - What the window answers.
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

  /**
   * The external conflict a session shows, or a failure naming the case.
   *
   * @param held - The session.
   * @returns Its external conflict.
   */
  function externalOf(held: MatchMoveSession): ExternalConflictModel<MovePlacement> {
    const conflict = held.externalConflict;
    if (conflict === null) {
      throw new Error('this case needs an external conflict on the session');
    }
    return conflict;
  } // End of function externalOf()

  /**
   * A session over one snippet with a destination that really moves it chosen.
   *
   * @param placement - Where the person asked for it to go.
   * @param position - Which snippet of {@link file} the move is about.
   * @returns The session showing that destination.
   */
  function chosen(placement: MovePlacement = { kind: 'end' }, position = 0): MatchMoveSession {
    const next = choosePlacement(session(position), placement);
    expect(canMove(next, HELD)).toBe(true);
    return next;
  } // End of function chosen()

  /**
   * A session whose move is in flight.
   *
   * @returns The waiting session.
   */
  function inFlight(): MatchMoveSession {
    const started = ((onHand) => beginMove(onHand, live(), () => onHand))(chosen());
    if (started === null) {
      throw new Error('a chosen destination is sendable');
    }
    return started.session;
  } // End of function inFlight()

  /**
   * A session whose move met a save conflict — the save origin.
   *
   * @returns The session showing the save conflict.
   */
  function saveConflicted(): MatchMoveSession {
    return ((onHand) => applyMove(onHand, CONFLICT, NOT_OWED, () => onHand))(inFlight());
  } // End of function saveConflicted()

  /**
   * A session whose move was refused for findings.
   *
   * @returns The session showing the refusal.
   */
  function refusedOnce(): MatchMoveSession {
    return ((onHand) => applyMove(onHand, REFUSED, NOT_OWED, () => onHand))(inFlight());
  } // End of function refusedOnce()

  describe('the seven arms over a session opened over one file (entries 6, 8, 11, 12)', () => {
    it('raises over the file, refuses the send and the destination controls, and retains the chosen destination', () => {
      const seen = observation();
      const next = applyMoveObservation(chosen(), raised(seen));
      const conflict = externalOf(next);
      expect(conflict.source).toBe(externalConflictSource(seen));
      expect(conflict.draft).toBe(next.draft);
      expect(conflict.draft.value).toEqual({ kind: 'end' });
      expect(conflict.diskText).toBe(THEIRS);
      expect(isExternalConflict(conflict)).toBe(true);
      expect(conflictOf(next)).toBe(conflict);
      expect(next.outcome).toBeNull();
      // The controls refuse and the send has a code of its own, whose sentence is
      // the external origin's first line and never *while this move was being sent*.
      expect(canChoose(next)).toBe(false);
      expect(choosePlacement(next, { kind: 'top' })).toBe(next);
      expect(placementOf(next)).toEqual({ kind: 'end' });
      expect(moveSubmissionRefusal(next, HELD)).toBe('externalConflict');
      expect(moveSubmissionRefusalKey('externalConflict')).toBe('browser.externalConflict.fileChangedWhileOpen');
      expect(beginMove(next, live(), () => next)).toBeNull();
      expect(next.invalidated).toBe(false);
      const view = matchMoveView(next, HELD);
      expect(view.canMove).toBe(false);
      expect(view.cannotMove).toBe('externalConflict');
      expect(view.spent).toBe(false);
      expect(view.notMovableToShow).toBeNull();
      expect(view.conflict).toBe(conflict);
      expect(view.externalMessages).toBe(conflict.messages);
      expect(view.externalMessages[0]).toEqual({ kind: 'fileChangedWhileOpen' });
      expect(view.messages).toEqual([]);
      expect(view.externalNotices).toEqual([]);
      expect(view.conflictOperation).toBe('moveToEnd');
      expect(view.reloadWarning).toBeNull();
      expect(view.conflictChoices).toEqual<readonly ConflictChoice[]>([
        'keepEditing',
        'keepMyDraft',
        'reloadDiskVersion'
      ]);
      // The two-step reload warns about the destination it really retained.
      expect(matchMoveView(askToReloadDiskVersion(next), HELD).reloadWarning).toBe('positionalDestination');
    }); // End of the "raised over the file" case

    it('names no operation and no chosen destination for a mover raised before anything was chosen (Phase 2d-6-7b)', () => {
      // A save conflict needs a send, and a send needs a destination that moves the
      // snippet; an observation needs neither. A mover opened and left alone holds
      // its origin as the draft, so a summary read off that draft would say the
      // person asked for a move they never asked for.
      const pristine = applyMoveObservation(session(), raised(observation()));
      expect(externalOf(pristine).draft.value).toEqual({ kind: 'top' });
      const view = matchMoveView(pristine, HELD);
      expect(view.conflictOperation).toBeNull();
      expect(view.awaitingReloadConfirmation).toBe(false);
      const warned = matchMoveView(askToReloadDiskVersion(pristine), HELD);
      expect(warned.awaitingReloadConfirmation).toBe(true);
      expect(warned.reloadWarning).toBeNull();
      // Choosing the origin again after another destination is the same fact.
      const back = choosePlacement(choosePlacement(session(), { kind: 'end' }), { kind: 'top' });
      const returned = applyMoveObservation(back, raised(observation()));
      expect(matchMoveView(returned, HELD).conflictOperation).toBeNull();
      // A destination that was chosen is still described, and still warned about.
      const moving = applyMoveObservation(chosen(), raised(observation()));
      expect(matchMoveView(moving, HELD).conflictOperation).toBe('moveToEnd');
      const movingWarned = matchMoveView(askToReloadDiskVersion(moving), HELD);
      expect(movingWarned.awaitingReloadConfirmation).toBe(true);
      expect(movingWarned.reloadWarning).toBe('positionalDestination');
    }); // End of the "pristine mover" case

    it('withholds and refuses the reapply for a mover raised before anything was chosen (2d-6-7b review, finding 1)', () => {
      // Evidence that would rebuild, so only the missing request can refuse: the
      // subject's twin is found, and rebuilding its origin placement against the
      // reordered disk version would set up a move nobody asked for.
      const seen = observation({
        correspondences: {
          base_revision: BASE,
          disk_revision: AFTER,
          entries: [
            {
              base: file().matches[0]!.id,
              exact: { Identified: { target: snippet(diskFile(), ':sig') } },
              editor: { Refused: { reason: 'AmbiguousTrigger' } }
            }
          ]
        }
      });
      const pristine = applyMoveObservation(session(), raised(seen));
      const view = matchMoveView(pristine, HELD);
      expect(view.conflictChoices).toEqual<readonly ConflictChoice[]>(['keepEditing', 'reloadDiskVersion']);
      expect(view.reapplyOffered).toBe(false);
      const source = externalOf(pristine).source;
      const recorder = adopting();
      expect(reapplyToDiskVersion(pristine, null, recorder.adopt, () => source, () => pristine)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'nothingRequested' }
      });
      expect(recorder.adoptions).toEqual([]);
      // A chosen destination is still offered the reapply.
      const moving = applyMoveObservation(chosen(), raised(observation()));
      expect(matchMoveView(moving, HELD).conflictChoices).toContain('keepMyDraft');
    }); // End of the "pristine mover reapply withheld" case

    it('answers null from beginMove called directly under an external conflict, refusal path included', () => {
      const blocked = applyMoveObservation(refusedOnce(), raised(observation()));
      expect(blocked.outcome?.kind).toBe('refused');
      expect(((onHand) => beginMove(onHand, live(), () => onHand))(acknowledgeMoveFindings(blocked))).toBeNull();
      const view = matchMoveView(blocked, HELD);
      expect(view.refusalChoices).toEqual(['keepEditing']);
      expect(view.findingsAreStale).toBe(false);
    });

    it('ranks the external conflict where the save conflict sits, and the uncertain send above it', () => {
      const seen = observation();
      const uncertain = applyMoveObservation(((onHand) => moveCouldNotBeSent(onHand, true, UNCERTAIN, () => onHand))(inFlight()), raised(seen));
      expect(moveSubmissionRefusal(uncertain, HELD)).toBe('mayHaveWritten');
      const stale = applyMoveObservation(chosen(), raised(seen));
      expect(moveSubmissionRefusal(stale, [reread()])).toBe('externalConflict');
      const waiting = applyMoveObservation(chosen(), retainedDelivery(seen));
      expect(moveSubmissionRefusal(waiting, [reread()])).toBe('observationRetained');
    });

    it('takes nothing from a delivery about another file, except the end of a wait recorded for it', () => {
      const over = chosen();
      const elsewhere = otherObservation();
      expect(applyMoveObservation(over, raised(elsewhere))).toBe(over);
      expect(applyMoveObservation(over, retainedDelivery(elsewhere))).toBe(over);
      expect(applyMoveObservation(over, decided(null, elsewhere, true, 'raisedWithoutReload'))).toBe(over);
      const waiting: MatchMoveSession = { ...over, awaitingReconciliation: new Map([[3, elsewhere]]) };
      expect(applyMoveObservation(waiting, writtenHereDelivery(elsewhere)).awaitingReconciliation.size).toBe(0);
      expect(applyMoveObservation(waiting, raised(elsewhere))).toEqual({
        ...waiting,
        awaitingReconciliation: new Map()
      });
      expect(canMove(waiting, HELD)).toBe(true);
    });

    it('takes nothing once closed', () => {
      const closed = ((onHand) => reloadTheDiskVersion(onHand, adopting().adopt, () => onHand))(confirmDiskReload(askToReloadDiskVersion(saveConflicted())));
      expect(closed.closed).toBe(true);
      expect(applyMoveObservation(closed, raised(observation()))).toBe(closed);
      expect(applyMoveObservation(closed, retainedDelivery(observation()))).toBe(closed);
    });
  }); // End of the "seven arms" suite

  describe('the held observation, and writtenHere by identity (entries 8 and 11)', () => {
    it('records a wait as a restriction on sending, keeps the destination controls live, and lifts it only for that observation', () => {
      const seen = observation();
      const waiting = applyMoveObservation(chosen(), retainedDelivery(seen));
      expect(waiting.awaitingReconciliation.get(2)).toBe(seen);
      expect(waiting.awaitingReconciliation.size).toBe(1);
      expect(waiting.externalConflict).toBeNull();
      expect(conflictOf(waiting)).toBeNull();
      expect(moveSubmissionRefusal(waiting, HELD)).toBe('observationRetained');
      expect(moveSubmissionRefusalKey('observationRetained')).toBe('browser.externalConflict.observationRetained');
      expect(beginMove(waiting, live(), () => waiting)).toBeNull();
      // The destination controls stay live, and a choice carries the wait.
      expect(canChoose(waiting)).toBe(true);
      const rechosen = choosePlacement(waiting, { kind: 'top' });
      expect(placementOf(rechosen)).toEqual({ kind: 'top' });
      expect(rechosen.awaitingReconciliation.get(2)).toBe(seen);
      expect(beginMove(rechosen, live(), () => rechosen)).toBeNull();
      const view = matchMoveView(waiting, HELD);
      expect(view.canMove).toBe(false);
      expect(view.cannotMove).toBe('observationRetained');
      expect(view.conflict).toBeNull();
      expect(view.externalNotices).toEqual([{ kind: 'observationRetained' }]);
      // Lifted by identity, and by nothing else.
      expect(applyMoveObservation(waiting, writtenHereDelivery(observation())).awaitingReconciliation.get(2)).toBe(seen);
      const lifted = applyMoveObservation(waiting, writtenHereDelivery(seen));
      expect(lifted).toEqual({ ...waiting, awaitingReconciliation: new Map() });
      expect(canMove(lifted, HELD)).toBe(true);
      expect(applyMoveObservation(lifted, writtenHereDelivery(seen))).toBe(lifted);
      const standing = externalConflictSource(observation({ sequence: 9 }));
      expect(applyMoveObservation(waiting, decided(standing, seen, false, 'notLater'))).toEqual({
        ...waiting,
        awaitingReconciliation: new Map()
      });
      expect(
        applyMoveObservation(
          waiting,
          decided(externalConflictSource(observation({ sequence: 1 })), seen, false, 'coalesced')
        )
      ).toEqual({ ...waiting, awaitingReconciliation: new Map() });
      expect(applyMoveObservation(waiting, raised(seen)).awaitingReconciliation.size).toBe(0);
      const newer = observation({ sequence: 7 });
      expect(applyMoveObservation(waiting, retainedDelivery(newer)).awaitingReconciliation.get(2)).toBe(newer);
      expect(applyMoveObservation(waiting, retainedDelivery(seen)).awaitingReconciliation.get(2)).toBe(seen);
    }); // End of the "retained and writtenHere" case

    it('holds every delivery during its own move and replays them in arrival order (entry 5)', () => {
      const started = inFlight();
      const seen = observation();
      const later = observation({ sequence: 6 });
      const standing = externalConflictSource(seen);
      const held = applyMoveObservation(
        applyMoveObservation(applyMoveObservation(started, retainedDelivery(seen)), raised(seen)),
        decided(standing, later, false, 'coalesced')
      );
      expect(held.externalConflict).toBeNull();
      expect(held.awaitingReconciliation.size).toBe(0);
      expect(held.heldDeliveries.map((one) => one.verdict.kind)).toEqual(['retained', 'raised', 'coalesced']);
      const settled = applyMove(held, REFUSED, NOT_OWED, () => held);
      expect(settled.heldDeliveries).toEqual([]);
      expect(settled.outcome?.kind).toBe('refused');
      expect(externalOf(settled).source).toBe(standing);
      expect(settled.awaitingReconciliation.size).toBe(0);
      expect(moveSubmissionRefusal(settled, HELD)).toBe('externalConflict');
      const committed = applyMove(held, saved(), ADOPTED, () => held);
      expect(committed.outcome?.kind).toBe('saved');
      expect(committed.moved).toBe(true);
      expect(externalOf(committed).source).toBe(standing);
      expect(moveSubmissionRefusal(committed, HELD)).toBe('alreadyMoved');
      const heldUncertain = applyMoveObservation(started, decided(null, seen, true, 'raisedWithoutReload'));
      const failed = moveCouldNotBeSent(heldUncertain, true, UNCERTAIN, () => heldUncertain);
      expect(failed.heldDeliveries).toEqual([]);
      expect(failed.mayHaveWritten).toBe(true);
      expect(failed.uncertaintyUnresolved).toBe(true);
      expect(externalOf(failed).source).toBe(externalConflictSource(seen));
    }); // End of the "held during the move" case
  }); // End of the "held observation" suite

  describe('collisions: only one conflict is active (entry 7), and a replacing verdict resets (entry 12)', () => {
    it('retires a save conflict when an observation supersedes it, keeping the retained destination and dropping the confirmation', () => {
      const stuck = saveConflicted();
      const saveModel = conflictOf(stuck);
      if (saveModel === null || !isSaveConflict(saveModel)) {
        throw new Error('this case starts from a save conflict');
      }
      const confirmed = confirmDiskReload(askToReloadDiskVersion(stuck));
      expect(confirmed.reload.kind).toBe('confirmed');
      const attempt = attemptOfReapply(confirmed, { kind: 'adoptionRefused' } as const);
      expect(reapplyToShow(attempt, confirmed)).toEqual({ kind: 'adoptionRefused' });
      const seen = observation({ diskRevision: 'c'.repeat(64), disk: diskFile({ revision: 'c'.repeat(64) }) });
      const next = applyMoveObservation(confirmed, decided(saveModel.source, seen, false, 'supersedes'));
      expect(next.outcome).toBeNull();
      expect(next.submitted).toBeNull();
      const conflict = externalOf(next);
      expect(conflict.draft).toBe(saveModel.draft);
      expect(conflict.draft.value).toEqual({ kind: 'end' });
      expect(conflict.diskRevision).toBe('c'.repeat(64));
      expect(conflictOf(next)).toBe(conflict);
      expect(next.reload).toBe(NOT_RELOADING);
      expect(matchMoveView(next, HELD).reloadWarning).toBeNull();
      const recorder = adopting();
      expect(reloadTheDiskVersion(next, recorder.adopt, () => next)).toBe(next);
      expect(recorder.adoptions).toEqual([]);
      expect(reapplyToShow(attempt, next)).toBeNull();
    }); // End of the "supersedes a save conflict" case

    it('keeps a committed success and a refusal as history, and lets a move that conflicts retire the external one', () => {
      const committed = ((onHand) => applyMove(onHand, saved(), ADOPTED, () => onHand))(inFlight());
      const overSaved = applyMoveObservation(committed, raised(observation()));
      expect(overSaved.outcome?.kind).toBe('saved');
      expect(overSaved.moved).toBe(true);
      expect(conflictOf(overSaved)).toBe(overSaved.externalConflict);
      expect(moveSubmissionRefusal(overSaved, HELD)).toBe('alreadyMoved');
      const blocked = applyMoveObservation(refusedOnce(), raised(observation()));
      const conflicted = applyMove(blocked, CONFLICT, NOT_OWED, () => blocked);
      expect(conflicted.externalConflict).toBeNull();
      expect(conflictOf(conflicted)?.source.kind).toBe('save');
      const refusedAgain = applyMove(blocked, REFUSED, NOT_OWED, () => blocked);
      expect(refusedAgain.externalConflict).toBe(blocked.externalConflict);
    });

    it('lets the dismissal cancel the warning and the panel, and nothing external (entry 9)', () => {
      const seen = observation();
      const blocked = askToReloadDiskVersion(applyMoveObservation(refusedOnce(), raised(seen)));
      expect(matchMoveView(blocked, HELD).reloadWarning).toBe('positionalDestination');
      const kept = dismissMoveOutcome(blocked);
      expect(kept.outcome).toBeNull();
      expect(kept.reload).toBe(NOT_RELOADING);
      expect(kept.externalConflict).toBe(blocked.externalConflict);
      expect(canChoose(kept)).toBe(false);
      expect(beginMove(kept, live(), () => kept)).toBeNull();
      const withheld = applyMoveObservation(chosen(), decided(null, observation(), true, 'raisedWithoutReload'));
      expect(dismissMoveOutcome(withheld).uncertaintyUnresolved).toBe(true);
      const waiting = applyMoveObservation(chosen(), retainedDelivery(seen));
      expect(dismissMoveOutcome(waiting).awaitingReconciliation.get(2)).toBe(seen);
    });

    it('changes nothing on coalesced and notLater, not even the object', () => {
      const seen = observation();
      const asked = askToReloadDiskVersion(applyMoveObservation(chosen(), raised(seen)));
      expect(matchMoveView(asked, HELD).reloadWarning).toBe('positionalDestination');
      const standing = externalConflictSource(seen);
      expect(applyMoveObservation(asked, decided(standing, observation({ sequence: 6 }), false, 'coalesced'))).toBe(asked);
      expect(
        applyMoveObservation(
          asked,
          decided(standing, observation({ sequence: 4, diskRevision: 'd'.repeat(64) }), false, 'notLater')
        )
      ).toBe(asked);
    });
  }); // End of the "collisions" suite

  describe('the uncertainty and its exits (entries 11, 14, 15, 22; the record’s §5.5)', () => {
    it('withholds the reload and the reapply on raisedWithoutReload until the snapshot is acknowledged', () => {
      const seen = observation();
      const withheld = applyMoveObservation(chosen(), decided(null, seen, true, 'raisedWithoutReload'));
      expect(withheld.uncertaintyUnresolved).toBe(true);
      const view = matchMoveView(withheld, HELD);
      expect(view.conflictChoices).toEqual<readonly ConflictChoice[]>(['keepEditing']);
      expect(view.reapplyOffered).toBe(false);
      expect(view.externalNotices).toEqual([{ kind: 'writeOutcomeUnknown' }]);
      expect(askToReloadDiskVersion(withheld)).toBe(withheld);
      const recorder = adopting();
      expect(reapplyToDiskVersion(withheld, null, recorder.adopt, () => externalOf(withheld).source, () => withheld)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'writeOutcomeUnknown' }
      });
      expect(recorder.adoptions).toEqual([]);
      const asked: ExternalChangeConflictSource[] = [];
      expect(
        acknowledgeMoveSnapshot(withheld, (source) => {
          asked.push(source);
          return 'refused';
        })
      ).toBe(withheld);
      expect(asked).toEqual([externalOf(withheld).source]);
      const acknowledged = acknowledgeMoveSnapshot(withheld, () => 'acknowledged');
      expect(acknowledged).toEqual({ ...withheld, uncertaintyUnresolved: false, reload: NOT_RELOADING });
      expect(matchMoveView(acknowledged, HELD).conflictChoices).toContain('reloadDiskVersion');
      expect(matchMoveView(askToReloadDiskVersion(acknowledged), HELD).reloadWarning).toBe('positionalDestination');
      let askedWithoutCause = 0;
      const plain = applyMoveObservation(chosen(), raised(seen));
      expect(
        acknowledgeMoveSnapshot(plain, () => {
          askedWithoutCause += 1;
          return 'acknowledged';
        })
      ).toBe(plain);
      expect(askedWithoutCause).toBe(0);
    }); // End of the "raisedWithoutReload" case

    it('clears the uncertainty when a later verdict under none replaces the conflict', () => {
      const first = observation();
      const withheld = applyMoveObservation(chosen(), decided(null, first, true, 'raisedWithoutReload'));
      const later = observation({ sequence: 6, diskRevision: 'c'.repeat(64), disk: diskFile({ revision: 'c'.repeat(64) }) });
      const replaced = applyMoveObservation(withheld, decided(externalConflictSource(first), later, false, 'supersedes'));
      expect(replaced.uncertaintyUnresolved).toBe(false);
      expect(externalOf(replaced).source).toBe(externalConflictSource(later));
      expect(matchMoveView(replaced, HELD).conflictChoices).toContain('reloadDiskVersion');
    });
  }); // End of the "uncertainty" suite

  describe('the reapply over the external origin: the subject’s and the anchor’s exact from one table (entries 19, 20, 22; D2r, R25)', () => {
    /** The base identity of the snippet the session moves. */
    const SUBJECT: MatchId = file().matches[0]!.id;

    /** The base identity of the snippet the session places it after. */
    const ANCHOR: MatchId = file().matches[1]!.id;

    /** The disk-side snippet the subject's row identifies: `:sig`, now second. */
    const TWIN: MatchView = snippet(diskFile(), ':sig');

    /** The disk-side snippet the anchor's row identifies: `:date`, now last. */
    const ANCHOR_TWIN: MatchView = snippet(diskFile(), ':date');

    /** A placement after the second snippet, by the base identity. */
    const AFTER_ANCHOR: MovePlacement = { kind: 'after', anchor: ANCHOR };

    /**
     * One row of a table, whose editor tier is a refusal so a surface reading
     * the wrong tier would refuse where this suite expects a rebuild.
     *
     * @param base - The identity the row is about.
     * @param exact - The exact tier's answer.
     * @returns The row.
     */
    function row(base: MatchId, exact: ReapplyResolution): CorrespondenceEntry {
      return { base, exact, editor: { Refused: { reason: 'AmbiguousTrigger' } } };
    } // End of function row()

    /**
     * An observation carrying a table over the two revisions.
     *
     * @param entries - The table's rows.
     * @param revisions - The table's two revisions, defaulting to the matching pair.
     * @param disk - The disk projection.
     * @returns The observation.
     */
    function observed(
      entries: readonly CorrespondenceEntry[],
      revisions: { readonly base?: string; readonly disk?: string } = {},
      disk: DocumentView = diskFile()
    ): ExternalConflictObservation {
      return observation({
        disk,
        correspondences: {
          base_revision: revisions.base ?? BASE,
          disk_revision: revisions.disk ?? AFTER,
          entries
        }
      });
    } // End of function observed()

    /**
     * A table naming both the subject and the anchor, resolved to their twins.
     *
     * @param disk - The disk projection the twins are taken from.
     * @returns The observation.
     */
    function bothFound(disk: DocumentView = diskFile()): ExternalConflictObservation {
      return observed(
        [
          row(SUBJECT, { Identified: { target: snippet(disk, ':sig') } }),
          row(ANCHOR, { Identified: { target: snippet(disk, ':date') } })
        ],
        {},
        disk
      );
    } // End of function bothFound()

    /**
     * A session with a destination chosen, raised over one observation.
     *
     * @param seen - The observation.
     * @param placement - Where the person asked for the snippet to go.
     * @param position - Which snippet of {@link file} the move is about.
     * @returns The session and the guard answering its own conflict's origin.
     */
    function raisedOver(
      seen: ExternalConflictObservation,
      placement: MovePlacement = AFTER_ANCHOR,
      position = 0
    ): { readonly stuck: MatchMoveSession; readonly stands: StandingOriginGuard } {
      const stuck = applyMoveObservation(chosen(placement, position), raised(seen));
      const source = externalOf(stuck).source;
      return { stuck, stands: () => source };
    } // End of function raisedOver()

    it('rebuilds an after from the subject’s and the anchor’s rows of one table, reading their exact tiers and never the index', () => {
      const { stuck, stands } = raisedOver(bothFound());
      const recorder = adopting();
      const answer = reapplyToDiskVersion(stuck, null, recorder.adopt, stands, () => stuck);
      expect(answer.kind).toBe('reapplied');
      if (answer.kind !== 'reapplied') {
        throw new Error('this case is about the rebuilt session');
      }
      // The snippet is followed to its new position, and the anchor to its own.
      expect(answer.session.match).toEqual(TWIN.id);
      expect(placementOf(answer.session)).toEqual({ kind: 'after', anchor: ANCHOR_TWIN.id });
      expect(answer.session.members.map((one) => one.node)).toEqual([32, 30, 31]);
      expect(baseRevisionOf(answer.session)).toBe(AFTER);
      expect(answer.session.draft.consent).toBeNull();
      expect(answer.session.externalConflict).toBeNull();
      expect(answer.session.awaitingReconciliation.size).toBe(0);
      expect(canMove(answer.session, [diskFile()])).toBe(true);
      // R25: what goes out is one move and nothing else, against the live identity.
      const started = beginMove(answer.session, live(1, diskFile()), () => answer.session);
      expect(started?.match).toEqual(TWIN.id);
      expect(started?.after).toEqual(ANCHOR_TWIN.id);
      expect(beginMove(answer.session, live(), () => answer.session)).toBeNull();
      expect(recorder.adoptions).toEqual([externalOf(stuck)]);
    }); // End of the "after rebuilt from both rows" case

    it('lowers top and end afresh, asks the table nothing about an anchor, and reports alreadySatisfied when the disk already has it there', () => {
      const recorder = adopting();
      // `end`: the subject's row alone suffices, and the end is lowered against
      // the new sequence — after `:date`, which is now last.
      const atEnd = raisedOver(observed([row(SUBJECT, { Identified: { target: TWIN } })]), { kind: 'end' });
      const moved = reapplyToDiskVersion(atEnd.stuck, null, recorder.adopt, atEnd.stands, () => atEnd.stuck);
      expect(moved.kind).toBe('reapplied');
      if (moved.kind === 'reapplied') {
        expect(placementOf(moved.session)).toEqual({ kind: 'end' });
        expect(beginMove(moved.session, live(1, diskFile()), () => moved.session)?.after).toEqual(ANCHOR_TWIN.id);
      }
      // `top`, for the second snippet, over a disk that already writes it
      // first: nothing to send, and nothing written.
      const first = diskFile({
        matches: [
          makeMatch({ node: 31, document: 2, revision: AFTER, trigger: ':date', path: matchListPath(0) }),
          makeMatch({ node: 32, document: 2, revision: AFTER, trigger: ':sql', path: matchListPath(1) }),
          makeMatch({ node: 30, document: 2, revision: AFTER, trigger: ':sig', path: matchListPath(2) })
        ]
      });
      const atTop = raisedOver(
        observed([row(ANCHOR, { Identified: { target: snippet(first, ':date') } })], {}, first),
        { kind: 'top' },
        1
      );
      const satisfied = reapplyToDiskVersion(atTop.stuck, null, recorder.adopt, atTop.stands, () => atTop.stuck);
      expect(satisfied.kind).toBe('alreadySatisfied');
      if (satisfied.kind === 'alreadySatisfied') {
        expect(satisfied.session.match).toEqual(snippet(first, ':date').id);
        expect(moveSubmissionRefusal(satisfied.session, [first])).toBe('alreadyThere');
        expect(beginMove(satisfied.session, live(0, first), () => satisfied.session)).toBeNull();
      }
      // A table whose anchor row would refuse changes nothing for a placement
      // that names no snippet.
      const refusingAnchor = raisedOver(
        observed([
          row(SUBJECT, { Identified: { target: TWIN } }),
          row(ANCHOR, { Refused: { reason: 'NoExactCorrespondence' } })
        ]),
        { kind: 'end' }
      );
      expect(reapplyToDiskVersion(refusingAnchor.stuck, null, recorder.adopt, refusingAnchor.stands, () => refusingAnchor.stuck).kind).toBe('reapplied');
      expect(recorder.adoptions).toHaveLength(3);
    }); // End of the "semantic placements" case

    it('refuses the subject: a refused tier, an empty tier, a stale full identity, the node alone, and several rows', () => {
      const recorder = adopting();
      const refusedTier = raisedOver(
        observed([row(SUBJECT, { Refused: { reason: 'AmbiguousExact' } }), row(ANCHOR, { Identified: { target: ANCHOR_TWIN } })])
      );
      expect(reapplyToDiskVersion(refusedTier.stuck, null, recorder.adopt, refusedTier.stands, () => refusedTier.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'correspondence', reason: 'AmbiguousExact' }
      });
      for (const empty of [{ Unsupported: {} }, { Targetless: {} }] as const) {
        const emptyTier = raisedOver(observed([row(SUBJECT, empty), row(ANCHOR, { Identified: { target: ANCHOR_TWIN } })]));
        expect(reapplyToDiskVersion(emptyTier.stuck, null, recorder.adopt, emptyTier.stands, () => emptyTier.stuck)).toEqual({
          kind: 'manualResolution',
          obstacle: { kind: 'evidenceNotATarget' }
        });
      } // End of the loop over the two empty arms
      const staleRevision = raisedOver(
        observed([
          row({ document: 2, revision: AFTER, node: 10 }, { Identified: { target: TWIN } }),
          row(ANCHOR, { Identified: { target: ANCHOR_TWIN } })
        ])
      );
      expect(reapplyToDiskVersion(staleRevision.stuck, null, recorder.adopt, staleRevision.stands, () => staleRevision.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: 'noRowForBase' }
      });
      const byPosition = raisedOver(
        observed([
          row({ document: 2, revision: BASE, node: 99 }, { Identified: { target: TWIN } }),
          row(ANCHOR, { Identified: { target: ANCHOR_TWIN } })
        ])
      );
      expect(reapplyToDiskVersion(byPosition.stuck, null, recorder.adopt, byPosition.stands, () => byPosition.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: 'noRowForBase' }
      });
      const twice = raisedOver(
        observed([
          row(SUBJECT, { Identified: { target: TWIN } }),
          row(SUBJECT, { Identified: { target: TWIN } }),
          row(ANCHOR, { Identified: { target: ANCHOR_TWIN } })
        ])
      );
      expect(reapplyToDiskVersion(twice.stuck, null, recorder.adopt, twice.stands, () => twice.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: 'severalRowsForBase' }
      });
      expect(recorder.adoptions).toEqual([]);
    }); // End of the "subject refusals" case

    it('refuses the anchor: a refused tier, an empty tier, a missing row, several rows, a stranger, and the moved snippet itself', () => {
      const recorder = adopting();
      const subjectRow = row(SUBJECT, { Identified: { target: TWIN } });
      const refusedTier = raisedOver(observed([subjectRow, row(ANCHOR, { Refused: { reason: 'NoExactCorrespondence' } })]));
      expect(reapplyToDiskVersion(refusedTier.stuck, null, recorder.adopt, refusedTier.stands, () => refusedTier.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'anchorCorrespondence', reason: 'NoExactCorrespondence' }
      });
      for (const empty of [{ Unsupported: {} }, { Targetless: {} }] as const) {
        const emptyTier = raisedOver(observed([subjectRow, row(ANCHOR, empty)]));
        expect(reapplyToDiskVersion(emptyTier.stuck, null, recorder.adopt, emptyTier.stands, () => emptyTier.stuck)).toEqual({
          kind: 'manualResolution',
          obstacle: { kind: 'evidenceNotAnAnchor' }
        });
      } // End of the loop over the two empty arms
      const missing = raisedOver(observed([subjectRow]));
      expect(reapplyToDiskVersion(missing.stuck, null, recorder.adopt, missing.stands, () => missing.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: 'noRowForBase' }
      });
      const twice = raisedOver(
        observed([subjectRow, row(ANCHOR, { Identified: { target: ANCHOR_TWIN } }), row(ANCHOR, { Identified: { target: ANCHOR_TWIN } })])
      );
      expect(reapplyToDiskVersion(twice.stuck, null, recorder.adopt, twice.stands, () => twice.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: 'severalRowsForBase' }
      });
      // An anchor the new sequence does not offer: a snippet of no sequence, and
      // the moved snippet itself — the self-anchor exclusion.
      const stranger = makeMatch({ node: 99, document: 2, revision: AFTER, trigger: ':gone' });
      const notHeld = raisedOver(observed([subjectRow, row(ANCHOR, { Identified: { target: stranger } })]));
      expect(reapplyToDiskVersion(notHeld.stuck, null, recorder.adopt, notHeld.stands, () => notHeld.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'anchorNotInSequence' }
      });
      const itself = raisedOver(observed([subjectRow, row(ANCHOR, { Identified: { target: TWIN } })]));
      expect(reapplyToDiskVersion(itself.stuck, null, recorder.adopt, itself.stands, () => itself.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'anchorNotInSequence' }
      });
      expect(recorder.adoptions).toEqual([]);
    }); // End of the "anchor refusals" case

    it('keeps the same-sequence rule over the disk version for the subject and the anchor (D2r), adopting nothing', () => {
      // **The invariant is "same sequence", never "same file".** A disk parse
      // that addresses the subject's twin in a second sequence of the same file
      // refuses, whatever the table says; one that addresses the anchor's twin
      // in another sequence refuses the anchor, because the rebuilt session's
      // anchors are the members of the subject's sequence and no other.
      const recorder = adopting();
      const elsewhere = diskFile({
        matches: [
          makeMatch({ node: 32, document: 2, revision: AFTER, trigger: ':sql', path: matchListPath(0) }),
          makeMatch({ node: 31, document: 2, revision: AFTER, trigger: ':date', path: matchListPath(1) }),
          makeMatch({ node: 30, document: 2, revision: AFTER, trigger: ':sig', path: matchListPath(0, 1) })
        ]
      });
      const subjectMoved = raisedOver(bothFound(elsewhere));
      expect(reapplyToDiskVersion(subjectMoved.stuck, null, recorder.adopt, subjectMoved.stands, () => subjectMoved.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'notTheSameSequence' }
      });
      const anchorElsewhere = diskFile({
        matches: [
          makeMatch({ node: 32, document: 2, revision: AFTER, trigger: ':sql', path: matchListPath(0) }),
          makeMatch({ node: 30, document: 2, revision: AFTER, trigger: ':sig', path: matchListPath(1) }),
          makeMatch({ node: 31, document: 2, revision: AFTER, trigger: ':date', path: matchListPath(0, 1) })
        ]
      });
      const anchorMoved = raisedOver(bothFound(anchorElsewhere));
      expect(reapplyToDiskVersion(anchorMoved.stuck, null, recorder.adopt, anchorMoved.stands, () => anchorMoved.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'anchorNotInSequence' }
      });
      // An `end` over the second parse is lowered within the subject's own
      // sequence — two snippets now, the anchor's twin not among them — which
      // already writes the subject last: nothing to send, and nothing written.
      const atEnd = raisedOver(bothFound(anchorElsewhere), { kind: 'end' });
      const answer = reapplyToDiskVersion(atEnd.stuck, null, adopting().adopt, atEnd.stands, () => atEnd.stuck);
      expect(answer.kind).toBe('alreadySatisfied');
      if (answer.kind === 'alreadySatisfied') {
        expect(answer.session.members.map((one) => one.node)).toEqual([32, 30]);
        expect(answer.session.anchors.map((one) => one.node)).toEqual([32]);
        expect(beginMove(answer.session, live(1, anchorElsewhere), () => answer.session)).toBeNull();
      }
      expect(recorder.adoptions).toEqual([]);
    }); // End of the "same-sequence rule over the disk version" case

    it('refuses a table about other revisions, and an observation with none, whatever the placement', () => {
      const recorder = adopting();
      for (const placement of [AFTER_ANCHOR, { kind: 'end' }] as const) {
        const otherBase = raisedOver(observed([row(SUBJECT, { Identified: { target: TWIN } })], { base: 'z'.repeat(64) }), placement);
        expect(reapplyToDiskVersion(otherBase.stuck, null, recorder.adopt, otherBase.stands, () => otherBase.stuck)).toEqual({
          kind: 'manualResolution',
          obstacle: { kind: 'externalEvidence', reason: 'baseRevisionMoved' }
        });
        const otherDisk = raisedOver(observed([row(SUBJECT, { Identified: { target: TWIN } })], { disk: 'z'.repeat(64) }), placement);
        expect(reapplyToDiskVersion(otherDisk.stuck, null, recorder.adopt, otherDisk.stands, () => otherDisk.stuck)).toEqual({
          kind: 'manualResolution',
          obstacle: { kind: 'externalEvidence', reason: 'diskRevisionMoved' }
        });
        const tableless = raisedOver(observation(), placement);
        expect(reapplyToDiskVersion(tableless.stuck, null, recorder.adopt, tableless.stands, () => tableless.stuck)).toEqual({
          kind: 'manualResolution',
          obstacle: { kind: 'externalEvidence', reason: 'noCorrespondence' }
        });
      } // End of the loop over an anchored and a semantic placement
      expect(recorder.adoptions).toEqual([]);
    });

    it('refuses superseded evidence through the live guard, whichever origin and placement, adopting nothing', () => {
      const recorder = adopting();
      const elsewhere = externalConflictSource(observation({ sequence: 9 }));
      const anchored = raisedOver(bothFound());
      expect(reapplyToDiskVersion(anchored.stuck, null, recorder.adopt, () => elsewhere, () => anchored.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'supersededEvidence' }
      });
      const atEnd = raisedOver(observation(), { kind: 'end' });
      expect(reapplyToDiskVersion(atEnd.stuck, null, recorder.adopt, () => null, () => atEnd.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'supersededEvidence' }
      });
      expect(((onHand) => reapplyToDiskVersion(onHand, null, recorder.adopt, () => elsewhere, () => onHand))(saveConflicted())).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'supersededEvidence' }
      });
      expect(recorder.adoptions).toEqual([]);
    });

    it('answers every adoption outcome for the external origin, and asks the ordinary rule again over the disk parse', () => {
      const { stuck, stands } = raisedOver(bothFound());
      expect(reapplyToDiskVersion(stuck, null, adopting('installed').adopt, stands, () => stuck).kind).toBe('reapplied');
      expect(reapplyToDiskVersion(stuck, null, adopting('alreadyThere').adopt, stands, () => stuck).kind).toBe('reapplied');
      const refusedWindow = adopting('refused');
      expect(reapplyToDiskVersion(stuck, null, refusedWindow.adopt, stands, () => stuck)).toEqual({ kind: 'adoptionRefused' });
      expect(refusedWindow.adoptions).toHaveLength(1);
      // The unsaved-draft rule is asked again, by the disk parse's identity.
      const recorder = adopting();
      expect(reapplyToDiskVersion(stuck, TWIN.id, recorder.adopt, stands, () => stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'moveRefused', reason: 'notMovable' }
      });
      expect(recorder.adoptions).toEqual([]);
    });

    it('refuses a reapply while an observation is held, so no rebuilt session can drop the block', () => {
      const { stuck, stands } = raisedOver(bothFound());
      const heldReading = observation({ sequence: 6, diskRevision: 'd'.repeat(64), disk: diskFile({ revision: 'd'.repeat(64) }) });
      const held = applyMoveObservation(stuck, retainedDelivery(heldReading));
      expect(held.awaitingReconciliation.get(2)).toBe(heldReading);
      expect(moveSubmissionRefusal(held, HELD)).toBe('externalConflict');
      const recorder = adopting();
      expect(reapplyToDiskVersion(held, null, recorder.adopt, stands, () => held)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'observationRetained' }
      });
      expect(recorder.adoptions).toEqual([]);
      const view = matchMoveView(held, HELD);
      expect(view.conflictChoices).toEqual<readonly ConflictChoice[]>(['keepEditing', 'reloadDiskVersion']);
      expect(view.reapplyOffered).toBe(false);
      expect(view.externalNotices).toEqual([{ kind: 'observationRetained' }]);
      const lifted = applyMoveObservation(held, writtenHereDelivery(heldReading));
      const answer = reapplyToDiskVersion(lifted, null, adopting().adopt, stands, () => lifted);
      expect(answer.kind).toBe('reapplied');
      if (answer.kind === 'reapplied') {
        expect(answer.session.awaitingReconciliation.size).toBe(0);
        expect(canMove(answer.session, [diskFile()])).toBe(true);
      }
      const elsewhere = otherObservation();
      const carrying: MatchMoveSession = { ...stuck, awaitingReconciliation: new Map([[3, elsewhere]]) };
      const rebuilt = reapplyToDiskVersion(carrying, null, adopting().adopt, stands, () => carrying);
      expect(rebuilt.kind).toBe('reapplied');
      if (rebuilt.kind === 'reapplied') {
        expect(rebuilt.session.awaitingReconciliation.get(3)).toBe(elsewhere);
      }
    }); // End of the "reapply refused while held" case

    it('asks nothing of the window when no guard is handed in, and leaves the door to decide', () => {
      const { stuck } = raisedOver(bothFound());
      const refusedWindow = adopting('refused');
      expect(reapplyToDiskVersion(stuck, null, refusedWindow.adopt, null, () => stuck)).toEqual({ kind: 'adoptionRefused' });
      expect(refusedWindow.adoptions).toEqual([externalOf(stuck)]);
      expect(reapplyToDiskVersion(stuck, null, adopting().adopt, null, () => stuck).kind).toBe('reapplied');
    });

    it('names a sentence in both languages for every obstacle the external origin can raise', () => {
      const obstacles: MoveReapplyObstacle[] = [
        { kind: 'externalEvidence', reason: 'noCorrespondence' },
        { kind: 'externalEvidence', reason: 'baseRevisionMoved' },
        { kind: 'externalEvidence', reason: 'diskRevisionMoved' },
        { kind: 'externalEvidence', reason: 'noRowForBase' },
        { kind: 'externalEvidence', reason: 'severalRowsForBase' },
        { kind: 'supersededEvidence' },
        { kind: 'writeOutcomeUnknown' },
        { kind: 'observationRetained' }
      ];
      for (const obstacle of obstacles) {
        const key = moveReapplyObstacleKey(obstacle);
        for (const locale of LOCALES) {
          expect(DICTIONARIES[locale][key], `${locale}:${obstacle.kind}`).toBeTruthy();
          const rendered = describeMoveReapplyObstacle(locale, obstacle);
          expect(rendered, `${locale}:${obstacle.kind}`).toBe(DICTIONARIES[locale][key]);
          expect(rendered).not.toContain('{');
        } // End of the loop over the two locales
      } // End of the loop over the external obstacles
    }); // End of the "a sentence per obstacle" case

    /**
     * A Proxy over one session whose first property read after it is armed runs
     * a body once — Phase 2d-6-7a, the reapply's reads after its looks
     * (`2d-6-6b-notes.md` §7 item 2).
     *
     * @param over - The session to stand in for.
     * @param body - What that read does before answering.
     * @returns The proxy, and the call that arms it.
     */
    function trappedForReapply(over: MatchMoveSession, body: () => void): { readonly proxy: MatchMoveSession; arm(): void } {
      let armed = false;
      const proxy = new Proxy(over, {
        /**
         * Runs the body on the first read after arming, then reads through.
         *
         * @param of - The session.
         * @param key - The property.
         * @param receiver - The receiver.
         * @returns The property's value.
         */
        get(of, key, receiver): unknown {
          if (armed) {
            armed = false;
            body();
          }
          return Reflect.get(of, key, receiver) as unknown;
        }
      });
      return {
        proxy,
        arm: () => {
          armed = true;
        }
      };
    } // End of function trappedForReapply()

    it('refuses, and asks the window nothing, when a read of the installed session displaced it before the adoption (Phase 2d-6-7a)', () => {
      const { stuck, stands } = raisedOver(bothFound());
      const displaced = applyMoveObservation(stuck, retainedDelivery(observation({ sequence: 6 })));
      let holder: MatchMoveSession = stuck;
      const trap = trappedForReapply(stuck, () => {
        holder = displaced;
      });
      holder = trap.proxy;
      const recorder = adopting('installed');
      const answer = reapplyToDiskVersion(trap.proxy, null, recorder.adopt, stands, () => {
        const now = holder;
        trap.arm();
        return now;
      });
      expect(holder).toBe(displaced);
      expect(answer.kind).toBe('manualResolution');
      expect(recorder.adoptions).toEqual([]);
    }); // End of the "displaced before the reapply's adoption" case

    it('rebuilds nothing when a read of the settled session displaced it after the adoption (Phase 2d-6-7a)', () => {
      const { stuck, stands } = raisedOver(bothFound());
      const displaced = applyMoveObservation(stuck, retainedDelivery(observation({ sequence: 6 })));
      let holder: MatchMoveSession = stuck;
      const trap = trappedForReapply(stuck, () => {
        holder = displaced;
      });
      holder = trap.proxy;
      const recorder = adopting('installed');
      const answer = reapplyToDiskVersion(
        trap.proxy,
        null, (conflict, confirmation) => {
          trap.arm();
          return recorder.adopt(conflict, confirmation);
        },
        stands,
        () => holder
      );
      expect(recorder.adoptions).toHaveLength(1);
      expect(holder).toBe(displaced);
      expect(answer).toEqual({ kind: 'manualResolution', obstacle: { kind: 'supersededEvidence' } });
    }); // End of the "displaced after the reapply's adoption" case

    it('answers supersededEvidence and rebuilds nothing when another conflict landed during the adoption (Phase 2d-6-7a)', () => {
      const { stuck, stands } = raisedOver(bothFound());
      let holder: MatchMoveSession = stuck;
      const newer = observation({ sequence: 6, diskRevision: 'c'.repeat(64), disk: diskFile({ revision: 'c'.repeat(64) }) });
      const recorder = adopting('installed');
      const answer = reapplyToDiskVersion(
        stuck,
        null, (conflict, confirmation) => {
          holder = applyMoveObservation(holder, decided(externalOf(holder).source, newer, false, 'supersedes'));
          return recorder.adopt(conflict, confirmation);
        },
        stands,
        () => holder
      );
      expect(recorder.adoptions).toHaveLength(1);
      expect(answer).toEqual({ kind: 'manualResolution', obstacle: { kind: 'supersededEvidence' } });
      expect(externalOf(holder).source).toBe(externalConflictSource(newer));
    }); // End of the "another conflict during the reapply's adoption" case

    it('hands the rebuilt session a wait recorded during the adoption (Phase 2d-6-7a)', () => {
      const { stuck, stands } = raisedOver(bothFound());
      let holder: MatchMoveSession = stuck;
      const later = observation({ sequence: 6 });
      const recorder = adopting('installed');
      const answer = reapplyToDiskVersion(
        stuck,
        null, (conflict, confirmation) => {
          holder = applyMoveObservation(holder, retainedDelivery(later));
          return recorder.adopt(conflict, confirmation);
        },
        stands,
        () => holder
      );
      expect(recorder.adoptions).toHaveLength(1);
      expect(answer.kind).toBe('reapplied');
      if (answer.kind === 'reapplied') {
        expect(answer.session.awaitingReconciliation.get(2)).toBe(later);
      }
    }); // End of the "wait recorded during the reapply's adoption" case
  }); // End of the "reapply over the external origin" suite

  describe('the door, the settlement and the reapply against the installed session (the review’s three blockers)', () => {
    /** The base identity of the snippet the session moves. */
    const SUBJECT: MatchId = file().matches[0]!.id;

    /** The base identity of the snippet the session places it after. */
    const ANCHOR: MatchId = file().matches[1]!.id;

    /** A placement after the second snippet, by the base identity. */
    const AFTER_ANCHOR: MovePlacement = { kind: 'after', anchor: ANCHOR };

    /** The disk-side twin of the moved snippet: `:sig`, now second. */
    const TWIN: MatchView = snippet(diskFile(), ':sig');

    /** The disk-side twin of the anchor: `:date`, now last. */
    const ANCHOR_TWIN: MatchView = snippet(diskFile(), ':date');

    /**
     * A holder standing in for the component's `$state`: what a registered
     * receiver would update, and what the reader answers.
     *
     * @param first - The session installed at the start.
     * @returns The holder, its reader, and a receiver that applies to it.
     */
    function installed(first: MatchMoveSession): {
      current: () => MatchMoveSession;
      receive: (delivery: ObservationDelivery) => void;
    } {
      let held = first;
      return {
        current: () => held,
        receive: (delivery) => {
          held = applyMoveObservation(held, delivery);
        }
      };
    } // End of function installed()

    it('refuses a move when the projection read displaced the installed session', () => {
      // **The review's first blocker, at this door.**
      const holder = installed(chosen());
      const handedIn = holder.current();
      const seen = observation();
      const projected: MatchId = {
        get document(): DocumentId {
          holder.receive(raised(seen));
          return 2;
        },
        revision: BASE,
        node: 10
      };
      expect(beginMove(handedIn, projected, holder.current)).toBeNull();
      expect(holder.current().externalConflict?.source).toBe(externalConflictSource(seen));
      const quiet = installed(chosen());
      expect(beginMove(quiet.current(), live(), quiet.current)).not.toBeNull();
      const waiting = installed(applyMoveObservation(chosen(), retainedDelivery(seen)));
      expect(beginMove(waiting.current(), live(), waiting.current)).toBeNull();
    }); // End of the "displaced during the projection read" case

    it('refuses a move when a later read of this door displaced the installed session (2d-6-5’s class, Phase 2d-6-6a)', () => {
      // **The installed session is read once, and it must be read last.** The
      // door reads the draft's value for the submission and the lowering, and
      // spreads the session; a getter quiet on the first read and delivering on
      // a later one, or on the spread, runs after a reader asked too early.
      const seen = observation();
      /**
       * A holder installing a session whose draft value delivers `raised` to it
       * on the given read, counting from one, and counts the reads.
       *
       * @param on - The read that delivers, or `null` to deliver never.
       * @returns The reader, the trapped session and the count.
       */
      function deliveringOnRead(on: number | null): {
        readonly current: () => MatchMoveSession;
        readonly trapped: MatchMoveSession;
        readonly reads: () => number;
      } {
        const handedIn = chosen();
        let reads = 0;
        let held: MatchMoveSession = handedIn;
        const trapped: MatchMoveSession = {
          ...handedIn,
          draft: {
            ...handedIn.draft,
            get value(): MovePlacement {
              reads += 1;
              if (reads === on) {
                held = applyMoveObservation(held, raised(seen));
              }
              return handedIn.draft.value;
            }
          }
        };
        held = trapped;
        return { current: () => held, trapped, reads: () => reads };
      } // End of function deliveringOnRead()
      const quiet = deliveringOnRead(null);
      expect(beginMove(quiet.trapped, live(), quiet.current)).not.toBeNull();
      const total = quiet.reads();
      expect(total).toBeGreaterThanOrEqual(1);
      for (let on = 1; on <= total; on += 1) {
        const displaced = deliveringOnRead(on);
        expect(beginMove(displaced.trapped, live(), displaced.current)).toBeNull();
        expect(externalOf(displaced.current()).source).toBe(externalConflictSource(seen));
      } // End of the loop over the reads of the draft's value
      // The spread that builds the waiting session reads every own property.
      // Armed once: the receiver's own spread reads it again.
      const beforeSpread = chosen();
      let armed = true;
      let spreadHeld: MatchMoveSession = beforeSpread;
      const trappedSpread: MatchMoveSession = {
        ...beforeSpread,
        get extraMessages(): MatchMoveSession['extraMessages'] {
          if (armed) {
            armed = false;
            spreadHeld = applyMoveObservation(spreadHeld, raised(seen));
          }
          return [];
        }
      };
      spreadHeld = trappedSpread;
      expect(beginMove(trappedSpread, live(), () => spreadHeld)).toBeNull();
      expect(externalOf(spreadHeld).source).toBe(externalConflictSource(seen));
    }); // End of the "displaced during a later read" case

    it('settles against the installed session and replays a delivery that arrived during its own replay', () => {
      // **The review's second blocker**, on the two settling transitions.
      const later = observation({ sequence: 6, diskRevision: 'c'.repeat(64), disk: diskFile({ revision: 'c'.repeat(64) }) });
      let armed = false;
      /**
       * A holder over an in-flight move told `retained(A), raised(A)`, where
       * reading A's file while armed delivers a supersession to the holder.
       *
       * @returns The holder.
       */
      function trapped(): ReturnType<typeof installed> {
        const holder = installed(inFlight());
        const seen: ExternalConflictObservation = {
          ...observation(),
          get document(): DocumentId {
            if (armed) {
              armed = false;
              holder.receive(decided(externalConflictSource(this), later, false, 'supersedes'));
            }
            return 2;
          }
        };
        holder.receive(retainedDelivery(seen));
        holder.receive(raised(seen));
        expect(holder.current().heldDeliveries.map((one) => one.verdict.kind)).toEqual(['retained', 'raised']);
        armed = true;
        return holder;
      } // End of function trapped()
      const answered = trapped();
      const settled = applyMove(answered.current(), REFUSED, NOT_OWED, answered.current);
      expect(armed).toBe(false);
      expect(settled.outcome?.kind).toBe('refused');
      expect(settled.heldDeliveries).toEqual([]);
      expect(externalOf(settled).source).toBe(externalConflictSource(later));
      const unanswered = trapped();
      const failed = moveCouldNotBeSent(unanswered.current(), false, null, unanswered.current);
      expect(failed.heldDeliveries).toEqual([]);
      expect(externalOf(failed).source).toBe(externalConflictSource(later));
      const alone = trapped();
      expect(externalOf(((onHand) => applyMove(onHand, REFUSED, NOT_OWED, () => onHand))(alone.current())).source).not.toBe(externalConflictSource(later));
    }); // End of the "delivery during the replay" case

    it('rechecks the installed session immediately before adopting, and refuses a wait or a supersession that arrived during the subject’s or the anchor’s read', () => {
      // **The review's third blocker**, at both rows the mover reads.
      const heldReading = observation({ sequence: 6, diskRevision: 'd'.repeat(64), disk: diskFile({ revision: 'd'.repeat(64) }) });
      const recorder = adopting();
      /**
       * A session placed after the anchor, raised over a table one of whose two
       * rows delivers to the holder when its exact tier is read.
       *
       * @param which - Which row is the trap.
       * @param deliver - What the read delivers.
       * @returns The holder and the guard.
       */
      function trapped(
        which: 'subject' | 'anchor',
        deliver: (source: ExternalChangeConflictSource) => ObservationDelivery
      ): { readonly holder: ReturnType<typeof installed>; readonly stands: StandingOriginGuard } {
        let holder: ReturnType<typeof installed> | null = null;
        /**
         * One row, trapping when asked to.
         *
         * @param base - The identity the row is about.
         * @param target - The disk snippet the row identifies.
         * @param trap - Whether reading this row's tier delivers.
         * @returns The row.
         */
        function rowFor(base: MatchId, target: MatchView, trap: boolean): CorrespondenceEntry {
          return {
            base,
            get exact(): ReapplyResolution {
              if (trap && holder !== null) {
                holder.receive(deliver(externalOf(holder.current()).source));
              }
              return { Identified: { target } };
            },
            editor: { Unsupported: {} }
          };
        } // End of function rowFor()
        const seen = observation({
          correspondences: {
            base_revision: BASE,
            disk_revision: AFTER,
            entries: [rowFor(SUBJECT, TWIN, which === 'subject'), rowFor(ANCHOR, ANCHOR_TWIN, which === 'anchor')]
          }
        });
        holder = installed(applyMoveObservation(chosen(AFTER_ANCHOR), raised(seen)));
        const source = externalOf(holder.current()).source;
        return { holder, stands: () => source };
      } // End of function trapped()
      for (const which of ['subject', 'anchor'] as const) {
        const waited = trapped(which, () => retainedDelivery(heldReading));
        expect(
          reapplyToDiskVersion(waited.holder.current(), null, recorder.adopt, waited.stands, waited.holder.current)
        ).toEqual({ kind: 'manualResolution', obstacle: { kind: 'observationRetained' } });
        const superseded = trapped(which, (source) => decided(source, heldReading, false, 'supersedes'));
        expect(
          reapplyToDiskVersion(superseded.holder.current(), null, recorder.adopt, superseded.stands, superseded.holder.current)
        ).toEqual({ kind: 'manualResolution', obstacle: { kind: 'supersededEvidence' } });
        const uncertain = trapped(which, (source) => decided(source, heldReading, true, 'raisedWithoutReload'));
        expect(
          reapplyToDiskVersion(uncertain.holder.current(), null, recorder.adopt, uncertain.stands, uncertain.holder.current)
        ).toEqual({ kind: 'manualResolution', obstacle: { kind: 'writeOutcomeUnknown' } });
      } // End of the loop over the two rows
      expect(recorder.adoptions).toEqual([]);
      const quiet = trapped('anchor', () => retainedDelivery(otherObservation()));
      expect(reapplyToDiskVersion(quiet.holder.current(), null, recorder.adopt, quiet.stands, quiet.holder.current).kind).toBe('reapplied');
      expect(recorder.adoptions).toHaveLength(1);
    }); // End of the "recheck before adoption" case

    it('reads no evidence for a session that is already blocked', () => {
      // **The review's should-fix.**
      let reads = 0;
      const seen: ExternalConflictObservation = {
        ...observation(),
        get correspondences(): CorrespondenceTable {
          reads += 1;
          return { base_revision: BASE, disk_revision: AFTER, entries: [] };
        }
      };
      const stuck = applyMoveObservation(chosen(AFTER_ANCHOR), raised(seen));
      const stands: StandingOriginGuard = () => externalOf(stuck).source;
      const recorder = adopting();
      const held = applyMoveObservation(stuck, retainedDelivery(observation({ sequence: 6 })));
      expect(reapplyToDiskVersion(held, null, recorder.adopt, stands, () => held)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'observationRetained' }
      });
      const withheld = applyMoveObservation(chosen(AFTER_ANCHOR), decided(null, seen, true, 'raisedWithoutReload'));
      expect(reapplyToDiskVersion(withheld, null, recorder.adopt, stands, () => withheld)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'writeOutcomeUnknown' }
      });
      expect(reads).toBe(0);
      expect(reapplyToDiskVersion(stuck, null, recorder.adopt, stands, () => stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: 'noRowForBase' }
      });
      expect(reads).toBe(1);
      expect(recorder.adoptions).toEqual([]);
    }); // End of the "no evidence read while blocked" case
  }); // End of the "against the installed session" suite

  describe('the reload against the installed session (Phase 2d-6-6b)', () => {
    // **The adoption runs the window's own reads of the observation's
    // projection** (2d-6-5's review, its third finding), and a getter there can
    // tell the window of a later reading whose receiver installs a new session
    // while the reload is still inside `adopt`. `holder` stands in for the
    // component's `$state`.

    /**
     * A session showing an external conflict about its file, confirmed to
     * reload from it.
     *
     * @param seen - The observation raised over it.
     * @returns The confirmed session.
     */
    function confirmedOver(seen: ExternalConflictObservation): MatchMoveSession {
      const confirmed = confirmDiskReload(askToReloadDiskVersion(applyMoveObservation(chosen(), raised(seen))));
      expect(confirmed.reload.kind).toBe('confirmed');
      return confirmed;
    } // End of function confirmedOver()

    it('answers the installed session and asks the window nothing when the session was displaced before the adoption', () => {
      const confirmed = confirmedOver(observation());
      const installed = applyMoveObservation(confirmed, retainedDelivery(observation({ sequence: 6 })));
      expect(installed).not.toBe(confirmed);
      const recorder = adopting();
      expect(reloadTheDiskVersion(confirmed, recorder.adopt, () => installed)).toBe(installed);
      expect(recorder.adoptions).toEqual([]);
    });

    it('answers the installed session untouched when another conflict landed during the adoption', () => {
      const seen = observation();
      let holder = confirmedOver(seen);
      const newer = observation({ sequence: 6, diskRevision: 'c'.repeat(64), disk: diskFile({ revision: 'c'.repeat(64) }) });
      const recorder = adopting('installed');
      const answered = reloadTheDiskVersion(
        holder,
        (conflict, confirmation) => {
          holder = applyMoveObservation(holder, decided(externalConflictSource(seen), newer, false, 'supersedes'));
          return recorder.adopt(conflict, confirmation);
        },
        () => holder
      );
      expect(recorder.adoptions).toHaveLength(1);
      expect(answered).toBe(holder);
      expect(answered.closed).toBe(false);
      expect(externalOf(answered).source).toBe(externalConflictSource(newer));
    }); // End of the "another conflict during the reload's adoption" case

    it('carries a wait recorded during a refused adoption', () => {
      let holder = confirmedOver(observation());
      const later = observation({ sequence: 6 });
      const refusing = adopting('refused');
      const refused = reloadTheDiskVersion(
        holder,
        (conflict, confirmation) => {
          holder = applyMoveObservation(holder, retainedDelivery(later));
          return refusing.adopt(conflict, confirmation);
        },
        () => holder
      );
      expect(refusing.adoptions).toHaveLength(1);
      expect(refused.reload.kind).toBe('refused');
      expect(refused.awaitingReconciliation.get(2)).toBe(later);
      expect(refused.closed).toBe(false);
    }); // End of the "wait carried through a refused reload" case

    /**
     * A Proxy over one session whose first property read after it is armed runs
     * a body once — 2d-6-6b's review, its one blocker.
     *
     * @param target - The session to stand in for.
     * @param body - What that read does before answering.
     * @returns The proxy, and the call that arms it.
     */
    function trappedSession(target: MatchMoveSession, body: () => void): { readonly proxy: MatchMoveSession; arm(): void } {
      let armed = false;
      const proxy = new Proxy(target, {
        /**
         * Runs the body on the first read after arming, then reads through.
         *
         * @param of - The session.
         * @param key - The property.
         * @param receiver - The receiver.
         * @returns The property's value.
         */
        get(of, key, receiver): unknown {
          if (armed) {
            armed = false;
            body();
          }
          return Reflect.get(of, key, receiver) as unknown;
        }
      });
      return {
        proxy,
        arm: () => {
          armed = true;
        }
      };
    } // End of function trappedSession()

    it.each(['installed', 'refused'] as const)(
      'answers what a read of the settled session installed, after a %s adoption (the review’s blocker)',
      (answer) => {
        const confirmed = confirmedOver(observation());
        const displaced = applyMoveObservation(confirmed, retainedDelivery(observation({ sequence: 6 })));
        let holder: MatchMoveSession = confirmed;
        const trap = trappedSession(confirmed, () => {
          holder = displaced;
        });
        holder = trap.proxy;
        const recorder = adopting(answer);
        const answered = reloadTheDiskVersion(
          trap.proxy,
          (conflict, confirmation) => {
            trap.arm();
            return recorder.adopt(conflict, confirmation);
          },
          () => holder
        );
        expect(recorder.adoptions).toHaveLength(1);
        expect(holder).toBe(displaced);
        expect(answered).toBe(displaced);
      }
    ); // End of the "read of the settled session" case

    it('answers what a read of the reload step installed, on a reload not attempted (the review’s blocker)', () => {
      const asked = askToReloadDiskVersion(applyMoveObservation(chosen(), raised(observation())));
      expect(asked.reload.kind).not.toBe('confirmed');
      const displaced = applyMoveObservation(asked, retainedDelivery(observation({ sequence: 6 })));
      let holder: MatchMoveSession = asked;
      const step = asked.reload;
      const tricked: MatchMoveSession = {
        ...asked,
        reload: new Proxy(step, {
          /**
           * Installs the displacing session on every read, then reads through.
           *
           * @param of - The step.
           * @param key - The property.
           * @param receiver - The receiver.
           * @returns The property's value.
           */
          get(of, key, receiver): unknown {
            holder = displaced;
            return Reflect.get(of, key, receiver) as unknown;
          }
        })
      };
      holder = tricked;
      const recorder = adopting();
      expect(reloadTheDiskVersion(tricked, recorder.adopt, () => holder)).toBe(displaced);
      expect(recorder.adoptions).toEqual([]);
    }); // End of the "read of the reload step" case
  }); // End of the "reload against the installed session" suite
}); // End of the "external session" suite
