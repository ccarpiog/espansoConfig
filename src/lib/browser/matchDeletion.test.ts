/**
 * Deleting one snippet, driven without a screen.
 *
 * Four groups:
 *
 * 1. **eligibility** — the three refusals, and in particular the last snippet of
 *    a file, which the consult's Q6 says the value refuses **and** the core still
 *    decides;
 * 2. **the two phases** — the consult's Q2: nothing reaches the command without a
 *    confirmation, and a confirmation is bound to the exact identity it was given
 *    for;
 * 3. **the answer** — the three arms, the acknowledgement round trip, and the
 *    `DoubledSequenceSeparation` note that only a deletion produces;
 * 4. **the view** — what a screen would draw, derived on every read;
 * 5. **the external session** (Phase 2d-6-4) — the seven verdict arms, the
 *    withdrawal of a pending question, the held observation, the uncertainty and
 *    the reapply over the observation's table by full identity.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { describe, expect, it } from 'vitest';
import { DICTIONARIES } from '../i18n/dictionaries';
import { LOCALES } from '../i18n/locale';
import type {
  ContentRevision,
  CorrespondenceEntry,
  CorrespondenceTable,
  DocumentId,
  DocumentView,
  Finding,
  MatchId,
  MatchView,
  ReapplyResolution,
  SaveResult
} from '../ipc/types';
import { makeConflict, makeDocument, makeMatch } from './fixtures';
import type { InvalidationStatus } from './invalidation';
import {
  acknowledgeDeletionFindings,
  acknowledgeDeletionSnapshot,
  applyDeletion,
  applyDeletionObservation,
  askToReloadDiskVersion,
  baseRevisionOf,
  cancelDelete,
  canRequestDelete,
  confirmDelete,
  confirmDiskReload,
  conflictOf,
  deletionCouldNotBeSent,
  deletionEligibility,
  deletionReapplyObstacleKey,
  deletionRefusalKey,
  dismissDeletionOutcome,
  identityInProjection,
  matchDeletionView,
  reapplyToDiskVersion,
  reloadTheDiskVersion,
  requestDelete,
  startMatchDeletion,
  type DeletionReapplyObstacle,
  type DeletionRefusal,
  type MatchDeletionSession
} from './matchDeletion';
import { NOT_RELOADING, type AdoptTheDiskVersion } from './editorSave';
import {
  externalConflictSource,
  standingConflictOf,
  type ConflictSource,
  type ExternalChangeConflictSource,
  type ExternalConflictObservation,
  type ObservationVerdict
} from './conflictSource';
import { describeDeletionReapplyObstacle } from '../i18n';
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

/** The revision a *third* writer leaves, after a reapply has already happened. */
const LATER: ContentRevision = 'c'.repeat(64);

/**
 * A snippet file with two snippets in it.
 *
 * @param overrides - Whatever a case needs beyond the two snippets.
 * @returns The projection.
 */
function file(overrides: Parameters<typeof makeDocument>[0] = {}): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision: BASE,
    matches: [
      makeMatch({ node: 10, document: 2, revision: BASE, trigger: ':sig' }),
      makeMatch({ node: 11, document: 2, revision: BASE, trigger: ':date' })
    ],
    ...overrides
  });
} // End of function file()

/**
 * A session over the first snippet of {@link file}.
 *
 * @param document - The projection to take the pair from.
 * @returns The session.
 */
function session(document: DocumentView = file()): MatchDeletionSession {
  return startMatchDeletion(document, document.matches[0]!);
} // End of function session()

/**
 * The identity the window's **current** projection gives the snippet under test.
 *
 * What a screen would read off the live projection and hand to
 * {@link confirmDelete}, which is the only argument there that comes from outside
 * the session and therefore the only one that can notice a reprojection.
 *
 * @param document - The projection the window is holding now.
 * @returns That projection's identity for the first snippet.
 */
function live(document: DocumentView = file()): MatchId {
  return document.matches[0]!.id;
} // End of function live()

/**
 * The same file, re-read: the same two snippets under a new parse.
 *
 * **The fixture the retained-session case needs.** Nothing about the session
 * changes when a window re-reads a file — that is the whole point of the finding
 * this exists for — so what has to change is the world, and a reparse changes
 * every identity in it.
 *
 * @returns The projection a re-read would install.
 */
function reprojected(): DocumentView {
  return file({
    revision: AFTER,
    matches: [
      makeMatch({ node: 30, document: 2, revision: AFTER, trigger: ':sig' }),
      makeMatch({ node: 31, document: 2, revision: AFTER, trigger: ':date' })
    ]
  });
} // End of function reprojected()

/** The adoption a save that wrote nothing owes: none. */
const NOT_OWED: InvalidationStatus = { kind: 'notOwed' };

/** The adoption a committed deletion performed. */
const ADOPTED: InvalidationStatus = { kind: 'done' };

/** The adoption a committed deletion could not perform. */
const NOT_ADOPTED: InvalidationStatus = {
  kind: 'failed',
  failure: { kind: 'command', error: { code: 'unknownDocument', document: 2 } }
};

/**
 * A `saved` outcome.
 *
 * **`moved` is `null` and has no parameter**, because a deletion's answer names
 * nothing by construction: the snippet that was deleted has no identity in the new
 * revision, and a fixture that could say otherwise would model a wire this
 * application does not have.
 *
 * @param committed - Whether the file was rewritten.
 * @returns The wire result.
 */
function saved(committed = true): SaveResult {
  return {
    outcome: 'saved',
    revision: AFTER,
    committed,
    notes: [],
    backup_taken: false,
    moved: null
  };
} // End of function saved()

/** A finding the gate reported about the deletion. */
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

/** A conflict: the file moved on and nothing was written. */
const CONFLICT: SaveResult = {
  outcome: 'conflict',
  reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
  expected: BASE,
  found: AFTER,
  disk_revision: AFTER,
  disk_text: 'matches:\n  - trigger: x\n    replace: theirs\n',
  disk: file()
};

describe('whether one snippet may be deleted at all', () => {
  it('says yes for an ordinary snippet of an ordinary file', () => {
    expect(deletionEligibility(file(), file().matches[0]!)).toEqual({ kind: 'deletable' });
    expect(canRequestDelete(session())).toBe(true);
  });

  it('refuses the last snippet of a file, from the projection', () => {
    // The consult's Q6: an affordance derived from current state, not
    // authorization. The core refuses the same thing, and its refusal is what a
    // person sees if the two ever disagree.
    const lonely = file({
      matches: [makeMatch({ node: 10, document: 2, revision: BASE, trigger: ':sig' })]
    });
    expect(deletionEligibility(lonely, lonely.matches[0]!)).toEqual({
      kind: 'refused',
      reason: 'lastSnippet'
    });
    expect(canRequestDelete(session(lonely))).toBe(false);
    expect(requestDelete(session(lonely)).pending).toBeNull();
  });

  it('refuses a file this application must not write', () => {
    const packaged = file({ kind: 'Package', readOnly: true });
    expect(deletionEligibility(packaged, packaged.matches[0]!)).toEqual({
      kind: 'refused',
      reason: 'readOnly'
    });
  });

  it('refuses a snippet and a file that are not a pair this projection describes', () => {
    // 2c-2-2's High finding one level up: the two arguments are one fact, and a
    // caller passing a second value straight from the live selection type-checks.
    const stranger = makeMatch({ node: 10, document: 9, revision: BASE });
    expect(deletionEligibility(file(), stranger)).toEqual({
      kind: 'refused',
      reason: 'notInDocument'
    });
    const stale = makeMatch({ node: 10, document: 2, revision: AFTER });
    expect(deletionEligibility(file(), stale)).toEqual({
      kind: 'refused',
      reason: 'notInDocument'
    });
    const absent = makeMatch({ node: 99, document: 2, revision: BASE });
    expect(deletionEligibility(file(), absent)).toEqual({
      kind: 'refused',
      reason: 'notInDocument'
    });
  });

  it('has a sentence for every refusal, in both languages', () => {
    const reasons: readonly DeletionRefusal[] = ['readOnly', 'lastSnippet', 'notInDocument'];
    for (const locale of LOCALES) {
      for (const reason of reasons) {
        expect(DICTIONARIES[locale][deletionRefusalKey(reason)].length).toBeGreaterThan(0);
      }
    } // End of the loop over the two locales
  });
}); // End of the "eligibility" suite

describe('the two phases a deletion goes through', () => {
  it('produces nothing to send until the person has confirmed', () => {
    // The consult's Q2, and the reason it exists: the protocol's acknowledgement
    // round trip engages only for a finding-bearing candidate, so a clean deletion
    // collects no consent anywhere else.
    const clean = session();
    expect(confirmDelete(clean, live(), () => clean)).toBeNull();
    const asked = requestDelete(clean);
    expect(asked.pending).not.toBeNull();
    expect(confirmDelete(asked, live(), () => asked)).not.toBeNull();
  });

  it('takes the question back', () => {
    const asked = requestDelete(session());
    const cancelled = cancelDelete(asked);
    expect(cancelled.pending).toBeNull();
    expect(confirmDelete(cancelled, live(), () => cancelled)).toBeNull();
    // And cancelling nothing changes nothing.
    expect(cancelDelete(cancelled)).toBe(cancelled);
  });

  it('refuses a confirmation given for a different identity', () => {
    // All three fields of the pending consent against the session's own. Both are
    // minted together, so this is the *caller-built* case: a session literal
    // carrying somebody else's identity.
    const asked = requestDelete(session());
    const elsewhere: MatchId = { document: 2, revision: AFTER, node: 10 };
    const carried: MatchDeletionSession = { ...asked, match: elsewhere };
    expect(confirmDelete(carried, elsewhere, () => carried)).toBeNull();
    const otherNode: MatchDeletionSession = {
      ...asked,
      match: { document: 2, revision: BASE, node: 11 }
    };
    expect(confirmDelete(otherNode, otherNode.match, () => otherNode)).toBeNull();
  });

  it('refuses a confirmation the window has reprojected the file under', () => {
    // **The first review round's fifth finding, and the whole of it.** The session
    // is *retained*, exactly as a component holding one in a `$state.raw` retains
    // it: nothing here manufactures a changed `session.match`, because a reload
    // does not change one. What changes is the file, and the identity the current
    // projection gives that snippet is the only value in the comparison that comes
    // from outside the session — so it is the only one that can say so.
    const asked = requestDelete(session());
    expect(confirmDelete(asked, live(), () => asked)).not.toBeNull();

    const afterReload = reprojected();
    expect(confirmDelete(asked, live(afterReload), () => asked)).toBeNull();
    // The session really is untouched: every field it carries still names the
    // parse it was opened over, which is why nothing inside it could have noticed.
    expect(asked.match).toEqual(file().matches[0]!.id);
    expect(asked.draft.value).toEqual(file().matches[0]!.id);
    expect(asked.pending).not.toBeNull();
  });

  it('refuses a confirmation when the projection no longer holds the snippet', () => {
    // Somebody else deleted it, or the file no longer parses: there is no current
    // identity to agree with, and a confirmation cannot be spent on nothing.
    const asked = requestDelete(session());
    expect(confirmDelete(asked, null, () => asked)).toBeNull();
  });

  it('spends the confirmation, so a second attempt is asked for again', () => {
    const started = ((onHand) => confirmDelete(onHand, live(), () => onHand))(requestDelete(session()));
    expect(started!.session.pending).toBeNull();
    expect(started!.match).toEqual(file().matches[0]!.id);
    expect(started!.session.phase).toBe('saving');
    expect(started!.submission.acknowledgement).toEqual({ accepted: [] });
    expect(baseRevisionOf(started!.session)).toBe(BASE);
  });

  it('asks nothing while a deletion is in flight, or after one has committed', () => {
    const started = ((onHand) => confirmDelete(onHand, live(), () => onHand))(requestDelete(session()));
    expect(canRequestDelete(started!.session)).toBe(false);
    expect(requestDelete(started!.session)).toBe(started!.session);
    const done = applyDeletion(started!.session, saved(), ADOPTED, () => started!.session);
    expect(done.deleted).toBe(true);
    expect(canRequestDelete(done)).toBe(false);
    // And dismissing the panel does not give it back.
    expect(canRequestDelete(dismissDeletionOutcome(done))).toBe(false);
    expect(((onHand) => confirmDelete(onHand, live(), () => onHand))(requestDelete(done))).toBeNull();
  });
}); // End of the "two phases" suite

describe('what comes back', () => {
  it('spends the session on a commit and says the file was written', () => {
    const started = ((onHand) => confirmDelete(onHand, live(), () => onHand))(requestDelete(session()));
    const done = applyDeletion(started!.session, saved(), ADOPTED, () => started!.session);
    const view = matchDeletionView(done);
    expect(view.deleted).toBe(true);
    expect(view.deleting).toBe(false);
    expect(view.messages.map((message) => message.kind)).toEqual(['fileWritten']);
  });

  it('carries the doubled-separation note only a deletion produces', () => {
    const started = ((onHand) => confirmDelete(onHand, live(), () => onHand))(requestDelete(session()));
    const withNote: SaveResult = {
      outcome: 'saved',
      revision: AFTER,
      committed: true,
      notes: [{ DoubledSequenceSeparation: { edit: 0 } }],
      backup_taken: false,
      moved: null
    };
    const view = matchDeletionView(applyDeletion(started!.session, withNote, ADOPTED, () => started!.session));
    // Plan section 6.2 is *never silently normalise*, and the blank line a removed
    // snippet leaves behind is exactly such a change.
    expect(view.notes).toEqual([{ DoubledSequenceSeparation: { edit: 0 } }]);
  });

  it('puts the out-of-step line beside a commit whose adoption failed', () => {
    const started = ((onHand) => confirmDelete(onHand, live(), () => onHand))(requestDelete(session()));
    const done = applyDeletion(started!.session, saved(), NOT_ADOPTED, () => started!.session);
    // Beside the saved arm, never in place of it: the snippet really is gone.
    expect(matchDeletionView(done).messages.map((message) => message.kind)).toEqual([
      'fileWritten',
      'windowOutOfStep'
    ]);
  });

  it('carries a refusal’s findings and the consent that answers them', () => {
    const started = ((onHand) => confirmDelete(onHand, live(), () => onHand))(requestDelete(session()));
    const refused = applyDeletion(started!.session, REFUSED, NOT_OWED, () => started!.session);
    const view = matchDeletionView(refused);
    expect(view.outcome?.kind).toBe('refused');
    expect(view.refusalChoices).toEqual(['saveAnyway', 'keepEditing']);
    expect(view.deleted).toBe(false);

    const consented = acknowledgeDeletionFindings(refused);
    const again = ((onHand) => confirmDelete(onHand, live(), () => onHand))(requestDelete(consented));
    expect(again!.submission.acknowledgement).toEqual({ accepted: [SUSPICION] });
  });

  it('offers one way out of a conflict, and stops asking while it shows', () => {
    const started = ((onHand) => confirmDelete(onHand, live(), () => onHand))(requestDelete(session()));
    const conflicted = applyDeletion(started!.session, CONFLICT, NOT_OWED, () => started!.session);
    expect(conflictOf(conflicted)).not.toBeNull();
    expect(canRequestDelete(conflicted)).toBe(false);
    // Two, since 2c-4a-3b flipped `offersReload`: the non-destructive way out and
    // the first step of the reload. Never a copy — a `MatchId` is a protocol
    // carrier, and `conflictChoicesFor` refuses one whatever this surface declares.
    expect(matchDeletionView(conflicted).conflictChoices).toEqual([
      'keepEditing',
      'keepMyDraft',
      'reloadDiskVersion'
    ]);
    expect(matchDeletionView(conflicted).conflictOperation).toBe('deleteSnippet');
    const dismissed = dismissDeletionOutcome(conflicted);
    expect(conflictOf(dismissed)).toBeNull();
    expect(canRequestDelete(dismissed)).toBe(true);
  });

  it('records a send that produced no outcome, in its two arms', () => {
    const started = ((onHand) => confirmDelete(onHand, live(), () => onHand))(requestDelete(session()));
    const notSent = deletionCouldNotBeSent(started!.session, false, null, () => started!.session);
    expect(notSent.sendFailure).toEqual({ kind: 'notSent', reason: null });
    expect(notSent.deleted).toBe(false);
    const failure = { kind: 'command' as const, error: { code: 'noWorkspaceOpen' as const } };
    const maybe = deletionCouldNotBeSent(started!.session, true, failure, () => started!.session);
    expect(maybe.sendFailure).toEqual({ kind: 'mayHaveWritten', reason: failure });
    expect(matchDeletionView(maybe).failureLines).toEqual([{ kind: 'failure', failure }]);
  });

  it('ignores an answer nothing was waiting for', () => {
    const clean = session();
    expect(applyDeletion(clean, saved(), ADOPTED, () => clean)).toBe(clean);
  });
}); // End of the "what comes back" suite

describe('the view a screen draws', () => {
  it('answers everything a control needs, derived on every read', () => {
    const view = matchDeletionView(session());
    expect(view.match).toEqual(file().matches[0]!.id);
    expect(view.canDelete).toBe(true);
    expect(view.refusal).toBeNull();
    expect(view.confirming).toBe(false);
    expect(view.deleting).toBe(false);
    expect(view.deleted).toBe(false);
    expect(view.outcome).toBeNull();
    expect(view.notes).toEqual([]);
  });

  it('names the refusal and stops offering the control', () => {
    const lonely = file({
      matches: [makeMatch({ node: 10, document: 2, revision: BASE, trigger: ':sig' })]
    });
    const view = matchDeletionView(session(lonely));
    expect(view.canDelete).toBe(false);
    expect(view.refusal).toBe('lastSnippet');
  });

  it('says when the question is on screen', () => {
    expect(matchDeletionView(requestDelete(session())).confirming).toBe(true);
  });
}); // End of the "view" suite

describe('the identity a session holds', () => {
  it('is a plain copy, because the draft snapshots it through structuredClone', () => {
    // **Found by the mounted test of 2c-3a-2, not by this file.** A screen reads
    // its snippet out of `BrowserState.views`, which is `$state` and therefore
    // deeply proxied, and `structuredClone` **throws** on a proxy — so opening a
    // deletion from a real window threw while every case here, which passes plain
    // fixtures, stayed green. The copy is also what keeps the session's identity
    // independent of a projection that may be replaced under it.
    const document = file();
    const held = startMatchDeletion(document, document.matches[0]!);
    expect(held.match).toEqual(document.matches[0]!.id);
    expect(held.match).not.toBe(document.matches[0]!.id);
    expect(held.draft.value).not.toBe(document.matches[0]!.id);
  });
}); // End of the "identity a session holds" suite

describe('the identity a screen reads off the live projection', () => {
  it('answers what this window’s projection gives that node', () => {
    // The argument `confirmDelete`'s whole check turns on, and the one place in
    // this application that produces it. A screen calls this rather than handing
    // the session's own identity back — which type-checks and defeats the check.
    expect(identityInProjection([file()], session().match)).toEqual(live());
  });

  it('answers the re-read parse’s identity, which is a different identity', () => {
    // **Not a way to follow a snippet across a reparse.** It answers the identity
    // the *current* projection gives the node, revision included, so a re-read
    // makes the answer disagree with the session and the confirmation is refused.
    // The node is deliberately kept and only the revision moved: a fixture that
    // renumbered the nodes would pass by finding nothing, which is a weaker claim.
    const sameNodes = file({
      revision: AFTER,
      matches: [
        makeMatch({ node: 10, document: 2, revision: AFTER, trigger: ':sig' }),
        makeMatch({ node: 11, document: 2, revision: AFTER, trigger: ':date' })
      ]
    });
    const fresh = identityInProjection([sameNodes], session().match);
    expect(fresh).toEqual({ document: 2, revision: AFTER, node: 10 });
    expect(((onHand) => confirmDelete(onHand, fresh, () => onHand))(requestDelete(session()))).toBeNull();
  });

  it('answers nothing for a file this window holds no projection of', () => {
    expect(identityInProjection([], session().match)).toBeNull();
    expect(identityInProjection([file({ id: 3 })], session().match)).toBeNull();
  });

  it('answers nothing when the file no longer holds the node', () => {
    const thinned = file({
      matches: [makeMatch({ node: 11, document: 2, revision: BASE, trigger: ':date' })]
    });
    expect(identityInProjection([thinned], session().match)).toBeNull();
  });
}); // End of the "live identity" suite

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
   * A conflicted deletion of a confirmed session.
   *
   * @returns The session showing the conflict.
   */
  function conflicted(): MatchDeletionSession {
    const started = ((onHand) => confirmDelete(onHand, live(), () => onHand))(requestDelete(session()));
    if (started === null) {
      throw new Error('a confirmed deletion is sendable');
    }
    return applyDeletion(started.session, CONFLICT, NOT_OWED, () => started.session);
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
    readonly adopt: AdoptTheDiskVersion<MatchId>;
    readonly adoptions: ConflictModel<MatchId>[];
  } {
    const adoptions: ConflictModel<MatchId>[] = [];
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
    expect(matchDeletionView(asked).awaitingReloadConfirmation).toBe(true);
    // The warning alone is not a confirmation either.
    expect(reloadTheDiskVersion(asked, recorder.adopt, () => asked)).toBe(asked);
    expect(recorder.adoptions).toEqual([]);
    expect(matchDeletionView(asked).closed).toBe(false);
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
    expect(matchDeletionView(after).closed).toBe(true);
    expect(conflictOf(after)).toBeNull();
    expect(canRequestDelete(after)).toBe(false);
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
    expect(matchDeletionView(after).reloadUnavailable).toBe(true);
    expect(matchDeletionView(after).awaitingReloadConfirmation).toBe(false);
    expect(matchDeletionView(after).conflictChoices).not.toContain('confirmReload');
    expect(matchDeletionView(after).conflictChoices).not.toContain('reloadDiskVersion');
    expect(matchDeletionView(after).conflictChoices).toContain('keepEditing');
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
    expect(matchDeletionView(conflict).conflictChoices).toEqual<readonly ConflictChoice[]>([
      'keepEditing',
      'keepMyDraft',
      'reloadDiskVersion'
    ]);
    expect(matchDeletionView(conflict).awaitingReloadConfirmation).toBe(false);

    const asked = askToReloadDiskVersion(conflict);
    expect(matchDeletionView(asked).conflictChoices).toEqual<readonly ConflictChoice[]>([
      'keepEditing',
      'keepMyDraft',
      'confirmReload'
    ]);
    expect(matchDeletionView(asked).awaitingReloadConfirmation).toBe(true);
    // And still no copy: the Q4 rule is about what this draft *is*.
    expect(matchDeletionView(asked).conflictChoices).not.toContain('copyDraft');
  }); // End of the "two-step reload is offered" case

  it('forgets a confirmation when the panel is dismissed or a new answer arrives', () => {
    // A confirmation is a person's answer to **one** conflict. Reaching the
    // confirmed step and then dismissing must not leave it spendable.
    const recorder = adopting();
    const confirmed = confirmDiskReload(askToReloadDiskVersion(conflicted()));
    const dismissed = dismissDeletionOutcome(confirmed);
    expect(dismissed.reload.kind).toBe('idle');
    expect(reloadTheDiskVersion(dismissed, recorder.adopt, () => dismissed)).toBe(dismissed);
    expect(recorder.adoptions).toEqual([]);
  }); // End of the "dismissal forgets the confirmation" case
}); // End of the "confirmed reload" suite

describe('reapplying the retained deletion', () => {
  // **2c-4b-2 builds this and 2c-4b-3 draws it.** `ConflictChoice` has no member
  // for a reapply, so nothing here is reachable from a control; every case calls
  // the transition directly.

  /**
   * A conflicted deletion whose payload carries chosen correspondence evidence.
   *
   * @param subject - What the search for this snippet answered.
   * @param disk - The newly parsed projection the conflict carries.
   * @returns The session showing the conflict.
   */
  function conflictedOver(
    subject: ReapplyResolution,
    disk: DocumentView = reprojected()
  ): MatchDeletionSession {
    const started = ((onHand) => confirmDelete(onHand, live(), () => onHand))(requestDelete(session()));
    if (started === null) {
      throw new Error('a confirmed deletion is what this case sends');
    }
    return applyDeletion(
      started.session,
      makeConflict({ disk, subject, expected: BASE, found: AFTER }),
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
    readonly adopt: AdoptTheDiskVersion<MatchId>;
    readonly adoptions: ConflictModel<MatchId>[];
  } {
    const adoptions: ConflictModel<MatchId>[] = [];
    return {
      adopt: (conflict) => {
        adoptions.push(conflict);
        return answer;
      },
      adoptions
    };
  } // End of function adoptingReapply()

  it('re-opens the deletion over the identified snippet, with the question unasked', () => {
    // **The confirmation is asked again, and against the live projection**
    // (consult Q4). Carrying a pending confirmation across a reparse would be
    // exactly the "two values minted together" defect `confirmDelete` exists to
    // close.
    const disk = reprojected();
    const target = disk.matches[0]!;
    const stuck = conflictedOver({ Identified: { target } }, disk);
    const recorder = adoptingReapply();
    const answer = reapplyToDiskVersion(stuck, recorder.adopt, null, () => stuck);
    expect(answer.kind).toBe('reapplied');
    if (answer.kind !== 'reapplied') {
      throw new Error('this case is about the rebuilt session');
    }
    expect(answer.session.pending).toBeNull();
    expect(answer.session.match).toEqual(target.id);
    expect(baseRevisionOf(answer.session)).toBe(AFTER);
    expect(canRequestDelete(answer.session)).toBe(true);
    expect(recorder.adoptions).toEqual([conflictOf(stuck)]);
    // The rebuilt session can be confirmed while the projection it was built over
    // is still the one the window holds. **On its own this proves nothing about
    // where the identity came from** — `answer.session.match` and `live(disk)` are
    // both `disk.matches[0]!.id`, minted together — which is what the next
    // assertion is for.
    const again = ((onHand) => confirmDelete(onHand, live(disk), () => onHand))(requestDelete(answer.session));
    expect(again).not.toBeNull();
    expect(again?.match).toEqual(target.id);
    // **And it resolves against the live projection, not against itself.** A third
    // writer reparses the file, so the identity the window now gives that snippet
    // differs from the rebuilt session's own; the confirmation must refuse. This is
    // the assertion that fails if `confirmDelete` compares `session.match` with
    // itself instead of with what it was handed.
    const third = file({
      revision: LATER,
      matches: [
        makeMatch({ node: 50, document: 2, revision: LATER, trigger: ':sig' }),
        makeMatch({ node: 51, document: 2, revision: LATER, trigger: ':date' })
      ]
    });
    expect(live(third)).not.toEqual(answer.session.match);
    expect(((onHand) => confirmDelete(onHand, live(third), () => onHand))(requestDelete(answer.session))).toBeNull();
  });

  it('refuses a correspondence the core would not establish, and adopts nothing', () => {
    const recorder = adoptingReapply();
    expect(
      ((onHand) => reapplyToDiskVersion(onHand, recorder.adopt, null, () => onHand))(conflictedOver({ Refused: { reason: 'NoExactCorrespondence' } }))
    ).toEqual({
      kind: 'manualResolution',
      obstacle: { kind: 'correspondence', reason: 'NoExactCorrespondence' }
    });
    expect(recorder.adoptions).toEqual([]);
  });

  it('refuses evidence that names no snippet, and adopts nothing', () => {
    const recorder = adoptingReapply();
    expect(((onHand) => reapplyToDiskVersion(onHand, recorder.adopt, null, () => onHand))(conflictedOver({ Unsupported: {} }))).toEqual({
      kind: 'manualResolution',
      obstacle: { kind: 'evidenceNotATarget' }
    });
    expect(recorder.adoptions).toEqual([]);
  });

  it('rechecks eligibility over the new parse, including the last snippet', () => {
    // The refusal to empty a sequence is decided again over the file as it now is,
    // rather than carried from the parse this session opened on.
    const disk = file({
      revision: AFTER,
      matches: [makeMatch({ node: 30, document: 2, revision: AFTER, trigger: ':sig' })]
    });
    const recorder = adoptingReapply();
    expect(
      ((onHand) => reapplyToDiskVersion(onHand, recorder.adopt, null, () => onHand))(conflictedOver({ Identified: { target: disk.matches[0]! } }, disk))
    ).toEqual({
      kind: 'manualResolution',
      obstacle: { kind: 'notDeletable', reason: 'lastSnippet' }
    });
    expect(recorder.adoptions).toEqual([]);
  });

  it('reports the window refusal and rebuilds nothing', () => {
    const disk = reprojected();
    const recorder = adoptingReapply('refused');
    expect(
      ((onHand) => reapplyToDiskVersion(onHand, recorder.adopt, null, () => onHand))(conflictedOver({ Identified: { target: disk.matches[0]! } }, disk))
    ).toEqual({ kind: 'adoptionRefused' });
    expect(recorder.adoptions).toHaveLength(1);
  });

  it('is not attempted when no conflict is showing', () => {
    const recorder = adoptingReapply();
    expect(((onHand) => reapplyToDiskVersion(onHand, recorder.adopt, null, () => onHand))(session())).toEqual({ kind: 'notAttempted' });
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
   * The file as another writer left it: the same two snippets under a new
   * parse, plus a third.
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
        makeMatch({ node: 30, document: 2, revision: AFTER, trigger: ':sig' }),
        makeMatch({ node: 31, document: 2, revision: AFTER, trigger: ':date' }),
        makeMatch({ node: 32, document: 2, revision: AFTER, trigger: ':theirs' })
      ],
      ...overrides
    });
  } // End of function diskFile()

  /**
   * One narrowed observation of the session's file.
   *
   * A fresh object every call, deliberately: the memo in `./conflictSource.ts` and
   * the session's wait are both keyed on object identity, so two calls are two
   * observations.
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
    readonly adopt: AdoptTheDiskVersion<MatchId>;
    readonly adoptions: ConflictModel<MatchId>[];
  } {
    const adoptions: ConflictModel<MatchId>[] = [];
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
  function externalOf(held: MatchDeletionSession): ExternalConflictModel<MatchId> {
    const conflict = held.externalConflict;
    if (conflict === null) {
      throw new Error('this case needs an external conflict on the session');
    }
    return conflict;
  } // End of function externalOf()

  /**
   * A session whose question has been asked and not answered.
   *
   * @returns The session with a pending question.
   */
  function requested(): MatchDeletionSession {
    const asked = requestDelete(session());
    expect(asked.pending).not.toBeNull();
    return asked;
  } // End of function requested()

  /**
   * A session whose deletion met a save conflict — the save origin.
   *
   * @returns The session showing the save conflict.
   */
  function saveConflicted(): MatchDeletionSession {
    const started = ((onHand) => confirmDelete(onHand, live(), () => onHand))(requested());
    if (started === null) {
      throw new Error('a confirmed deletion is sendable');
    }
    return applyDeletion(started.session, CONFLICT, NOT_OWED, () => started.session);
  } // End of function saveConflicted()

  /**
   * A session whose deletion was refused for findings — the refusal path.
   *
   * @returns The session showing the refusal.
   */
  function refusedOnce(): MatchDeletionSession {
    const started = ((onHand) => confirmDelete(onHand, live(), () => onHand))(requested());
    if (started === null) {
      throw new Error('a confirmed deletion is sendable');
    }
    return applyDeletion(started.session, REFUSED, NOT_OWED, () => started.session);
  } // End of function refusedOnce()

  describe('the seven arms over a session opened over one file (entries 6, 8, 11, 12)', () => {
    it('raises over the file, withdraws the pending question, and refuses both doors', () => {
      const seen = observation();
      const next = applyDeletionObservation(requested(), raised(seen));
      const conflict = externalOf(next);
      expect(conflict.source).toBe(externalConflictSource(seen));
      expect(conflict.draft).toBe(next.draft);
      expect(conflict.diskText).toBe(THEIRS);
      expect(isExternalConflict(conflict)).toBe(true);
      expect(conflictOf(next)).toBe(conflict);
      // `outcome` is untouched: no deletion ended (entry 6).
      expect(next.outcome).toBeNull();
      // Entry 12: the question asked about the snippet as this window projected it
      // is withdrawn, and neither door answers anything.
      expect(next.pending).toBeNull();
      expect(canRequestDelete(next)).toBe(false);
      expect(requestDelete(next)).toBe(next);
      expect(confirmDelete(next, live(), () => next)).toBeNull();
      const view = matchDeletionView(next);
      expect(view.canDelete).toBe(false);
      expect(view.confirming).toBe(false);
      expect(view.refusal).toBeNull();
      expect(view.conflict).toBe(conflict);
      expect(view.externalMessages).toBe(conflict.messages);
      expect(view.externalMessages[0]).toEqual({ kind: 'fileChangedWhileOpen' });
      expect(view.messages).toEqual([]);
      expect(view.externalNotices).toEqual([]);
      expect(view.conflictOperation).toBe('deleteSnippet');
      expect(view.conflictChoices).toEqual<readonly ConflictChoice[]>([
        'keepEditing',
        'keepMyDraft',
        'reloadDiskVersion'
      ]);
    }); // End of the "raised over the file" case

    it('answers null from confirmDelete called directly under an external conflict, refusal path included', () => {
      // **Past a disabled button.** The refusal panel's *Save anyway* would
      // re-ask the question; `requestDelete` answers the same session, and a
      // caller that assembled a pending question by hand is refused at
      // `confirmDelete` after every identity it hands in has been read.
      const blocked = applyDeletionObservation(refusedOnce(), raised(observation()));
      expect(blocked.outcome?.kind).toBe('refused');
      const consented = acknowledgeDeletionFindings(blocked);
      expect(requestDelete(consented)).toBe(consented);
      const byHand: MatchDeletionSession = { ...consented, pending: requested().pending };
      expect(confirmDelete(byHand, live(), () => byHand)).toBeNull();
      const view = matchDeletionView(blocked);
      expect(view.refusalChoices).toEqual(['keepEditing']);
      expect(view.findingsAreStale).toBe(false);
    });

    it('takes nothing from a delivery about another file, except the end of a wait recorded for it', () => {
      // A session over `match/base.yml` told `match/other.yml` changed is the
      // object it was: a reload of that conflict would adopt a file the person
      // never named.
      const over = requested();
      const elsewhere = otherObservation();
      expect(applyDeletionObservation(over, raised(elsewhere))).toBe(over);
      expect(applyDeletionObservation(over, retainedDelivery(elsewhere))).toBe(over);
      expect(applyDeletionObservation(over, decided(null, elsewhere, true, 'raisedWithoutReload'))).toBe(over);
      // A wait a hand-built session holds for that observation ends with the
      // decision about it, whichever file it names, and nothing is raised.
      const waiting: MatchDeletionSession = { ...over, awaitingReconciliation: new Map([[3, elsewhere]]) };
      expect(applyDeletionObservation(waiting, writtenHereDelivery(elsewhere)).awaitingReconciliation.size).toBe(0);
      expect(applyDeletionObservation(waiting, raised(elsewhere))).toEqual({
        ...waiting,
        awaitingReconciliation: new Map()
      });
      expect(canRequestDelete(waiting)).toBe(true);
    });

    it('takes nothing once closed', () => {
      const closed = ((onHand) => reloadTheDiskVersion(onHand, adopting().adopt, () => onHand))(confirmDiskReload(askToReloadDiskVersion(saveConflicted())));
      expect(closed.closed).toBe(true);
      expect(applyDeletionObservation(closed, raised(observation()))).toBe(closed);
      expect(applyDeletionObservation(closed, retainedDelivery(observation()))).toBe(closed);
    });

    it('withdraws a pending question on every replacing verdict, and keeps it on coalesced and notLater', () => {
      const asked = requested();
      const seen = observation();
      expect(applyDeletionObservation(asked, raised(seen)).pending).toBeNull();
      expect(applyDeletionObservation(asked, decided(null, seen, true, 'raisedWithoutReload')).pending).toBeNull();
      const standing = externalConflictSource(observation({ sequence: 1, diskRevision: 'c'.repeat(64) }));
      expect(applyDeletionObservation(asked, decided(standing, seen, false, 'supersedes')).pending).toBeNull();
      // A verdict that changes nothing about the file changes nothing about the
      // question either: the session is the object it was, question included.
      const sameBytes = externalConflictSource(observation({ sequence: 1 }));
      expect(applyDeletionObservation(asked, decided(sameBytes, seen, false, 'coalesced'))).toBe(asked);
      const later = externalConflictSource(observation({ sequence: 9 }));
      expect(applyDeletionObservation(asked, decided(later, seen, false, 'notLater'))).toBe(asked);
      expect(matchDeletionView(asked).confirming).toBe(true);
    }); // End of the "pending question withdrawn" case
  }); // End of the "seven arms" suite

  describe('the held observation, and writtenHere by identity (entries 8 and 11)', () => {
    it('records a wait as a restriction on asking and answering, and lifts it only for that observation', () => {
      const seen = observation();
      const waiting = applyDeletionObservation(session(), retainedDelivery(seen));
      expect(waiting.awaitingReconciliation.get(2)).toBe(seen);
      expect(waiting.awaitingReconciliation.size).toBe(1);
      expect(waiting.externalConflict).toBeNull();
      expect(conflictOf(waiting)).toBeNull();
      expect(canRequestDelete(waiting)).toBe(false);
      expect(requestDelete(waiting)).toBe(waiting);
      const byHand: MatchDeletionSession = { ...waiting, pending: requested().pending };
      expect(confirmDelete(byHand, live(), () => byHand)).toBeNull();
      const view = matchDeletionView(waiting);
      expect(view.canDelete).toBe(false);
      expect(view.conflict).toBeNull();
      expect(view.externalNotices).toEqual([{ kind: 'observationRetained' }]);
      // Lifted by identity, and by nothing else.
      expect(applyDeletionObservation(waiting, writtenHereDelivery(observation())).awaitingReconciliation.get(2)).toBe(seen);
      const lifted = applyDeletionObservation(waiting, writtenHereDelivery(seen));
      expect(lifted).toEqual({ ...waiting, awaitingReconciliation: new Map() });
      expect(canRequestDelete(lifted)).toBe(true);
      expect(applyDeletionObservation(lifted, writtenHereDelivery(seen))).toBe(lifted);
      // Any decision about the awaited observation ends the wait; a later
      // `retained` replaces it; a re-held reading is still held.
      const standing = externalConflictSource(observation({ sequence: 9 }));
      expect(applyDeletionObservation(waiting, decided(standing, seen, false, 'notLater'))).toEqual({
        ...waiting,
        awaitingReconciliation: new Map()
      });
      expect(
        applyDeletionObservation(
          waiting,
          decided(externalConflictSource(observation({ sequence: 1 })), seen, false, 'coalesced')
        )
      ).toEqual({ ...waiting, awaitingReconciliation: new Map() });
      expect(applyDeletionObservation(waiting, raised(seen)).awaitingReconciliation.size).toBe(0);
      const newer = observation({ sequence: 7 });
      expect(applyDeletionObservation(waiting, retainedDelivery(newer)).awaitingReconciliation.get(2)).toBe(newer);
      expect(applyDeletionObservation(waiting, retainedDelivery(seen)).awaitingReconciliation.get(2)).toBe(seen);
    }); // End of the "retained and writtenHere" case

    it('holds every delivery during its own deletion and replays them in arrival order (entry 5)', () => {
      const started = ((onHand) => confirmDelete(onHand, live(), () => onHand))(requested());
      if (started === null) {
        throw new Error('a confirmed deletion is sendable');
      }
      const seen = observation();
      const later = observation({ sequence: 6 });
      const standing = externalConflictSource(seen);
      const held = applyDeletionObservation(
        applyDeletionObservation(applyDeletionObservation(started.session, retainedDelivery(seen)), raised(seen)),
        decided(standing, later, false, 'coalesced')
      );
      expect(held.externalConflict).toBeNull();
      expect(held.awaitingReconciliation.size).toBe(0);
      expect(held.heldDeliveries.map((one) => one.verdict.kind)).toEqual(['retained', 'raised', 'coalesced']);
      // The deletion's answer lands first, the held decisions second, in one
      // transition: the conflict `raised` announced stands, the wait `retained`
      // recorded ended with it, and `coalesced` found the conflict it was about.
      const settled = applyDeletion(held, REFUSED, NOT_OWED, () => held);
      expect(settled.heldDeliveries).toEqual([]);
      expect(settled.outcome?.kind).toBe('refused');
      expect(externalOf(settled).source).toBe(standing);
      expect(settled.awaitingReconciliation.size).toBe(0);
      expect(canRequestDelete(settled)).toBe(false);
      // The answer lands first and the replay has the last word, on a commit too:
      // the session is spent and the conflict stands beside the success.
      const committed = applyDeletion(held, saved(), ADOPTED, () => held);
      expect(committed.outcome?.kind).toBe('saved');
      expect(committed.deleted).toBe(true);
      expect(externalOf(committed).source).toBe(standing);
      // A deletion that produced no outcome consumes the hold too.
      const heldUncertain = applyDeletionObservation(
        started.session,
        decided(null, seen, true, 'raisedWithoutReload')
      );
      const failed = deletionCouldNotBeSent(heldUncertain, true, null, () => heldUncertain);
      expect(failed.heldDeliveries).toEqual([]);
      expect(failed.sendFailure?.kind).toBe('mayHaveWritten');
      expect(failed.uncertaintyUnresolved).toBe(true);
      expect(externalOf(failed).source).toBe(externalConflictSource(seen));
    }); // End of the "held during the deletion" case
  }); // End of the "held observation" suite

  describe('collisions: only one conflict is active (entry 7), and a replacing verdict resets (entry 12)', () => {
    it('retires a save conflict when an observation supersedes it, keeping the retained draft and dropping the confirmation', () => {
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
      const next = applyDeletionObservation(confirmed, decided(saveModel.source, seen, false, 'supersedes'));
      expect(next.outcome).toBeNull();
      expect(next.submitted).toBeNull();
      const conflict = externalOf(next);
      expect(conflict.draft).toBe(saveModel.draft);
      expect(conflict.diskRevision).toBe('c'.repeat(64));
      expect(conflictOf(next)).toBe(conflict);
      // The reload is idle again and the confirmation is gone; the displayed
      // reapply result is about a session no longer on screen.
      expect(next.reload).toBe(NOT_RELOADING);
      expect(matchDeletionView(next).awaitingReloadConfirmation).toBe(false);
      const recorder = adopting();
      expect(reloadTheDiskVersion(next, recorder.adopt, () => next)).toBe(next);
      expect(recorder.adoptions).toEqual([]);
      expect(reapplyToShow(attempt, next)).toBeNull();
    }); // End of the "supersedes a save conflict" case

    it('keeps a committed success and a refusal as history, and lets a deletion that conflicts retire the external one', () => {
      const started = ((onHand) => confirmDelete(onHand, live(), () => onHand))(requested());
      if (started === null) {
        throw new Error('a confirmed deletion is sendable');
      }
      const committed = applyDeletion(started.session, saved(), ADOPTED, () => started.session);
      const overSaved = applyDeletionObservation(committed, raised(observation()));
      expect(overSaved.outcome?.kind).toBe('saved');
      expect(overSaved.deleted).toBe(true);
      expect(conflictOf(overSaved)).toBe(overSaved.externalConflict);
      // The reverse collision, kept for a direct call: a conflict answer retires
      // the external conflict, a refusal leaves it.
      const blocked = applyDeletionObservation(refusedOnce(), raised(observation()));
      const conflicted = applyDeletion(blocked, CONFLICT, NOT_OWED, () => blocked);
      expect(conflicted.externalConflict).toBeNull();
      expect(conflictOf(conflicted)?.source.kind).toBe('save');
      const refusedAgain = applyDeletion(blocked, REFUSED, NOT_OWED, () => blocked);
      expect(refusedAgain.externalConflict).toBe(blocked.externalConflict);
    });

    it('lets the dismissal cancel the warning and the panel, and nothing external (entry 9)', () => {
      const seen = observation();
      const blocked = askToReloadDiskVersion(applyDeletionObservation(refusedOnce(), raised(seen)));
      expect(matchDeletionView(blocked).awaitingReloadConfirmation).toBe(true);
      const kept = dismissDeletionOutcome(blocked);
      expect(kept.outcome).toBeNull();
      expect(kept.reload).toBe(NOT_RELOADING);
      expect(kept.externalConflict).toBe(blocked.externalConflict);
      expect(canRequestDelete(kept)).toBe(false);
      expect(requestDelete(kept)).toBe(kept);
      const withheld = applyDeletionObservation(session(), decided(null, observation(), true, 'raisedWithoutReload'));
      expect(dismissDeletionOutcome(withheld).uncertaintyUnresolved).toBe(true);
      const waiting = applyDeletionObservation(session(), retainedDelivery(seen));
      expect(dismissDeletionOutcome(waiting).awaitingReconciliation.get(2)).toBe(seen);
      expect(canRequestDelete(dismissDeletionOutcome(waiting))).toBe(false);
    });

    it('changes nothing on coalesced and notLater, not even the object', () => {
      const seen = observation();
      const asked = askToReloadDiskVersion(applyDeletionObservation(session(), raised(seen)));
      expect(matchDeletionView(asked).awaitingReloadConfirmation).toBe(true);
      const standing = externalConflictSource(seen);
      expect(applyDeletionObservation(asked, decided(standing, observation({ sequence: 6 }), false, 'coalesced'))).toBe(asked);
      expect(
        applyDeletionObservation(
          asked,
          decided(standing, observation({ sequence: 4, diskRevision: 'd'.repeat(64) }), false, 'notLater')
        )
      ).toBe(asked);
    });
  }); // End of the "collisions" suite

  describe('the uncertainty and its exits (entries 11, 14, 15, 22; the record’s §5.5)', () => {
    it('withholds the reload and the reapply on raisedWithoutReload until the snapshot is acknowledged', () => {
      const seen = observation();
      const withheld = applyDeletionObservation(requested(), decided(null, seen, true, 'raisedWithoutReload'));
      expect(withheld.uncertaintyUnresolved).toBe(true);
      expect(withheld.pending).toBeNull();
      const view = matchDeletionView(withheld);
      expect(view.conflictChoices).toEqual<readonly ConflictChoice[]>(['keepEditing']);
      expect(view.reapplyOffered).toBe(false);
      expect(view.externalNotices).toEqual([{ kind: 'writeOutcomeUnknown' }]);
      expect(askToReloadDiskVersion(withheld)).toBe(withheld);
      const recorder = adopting();
      expect(reapplyToDiskVersion(withheld, recorder.adopt, () => externalOf(withheld).source, () => withheld)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'writeOutcomeUnknown' }
      });
      expect(recorder.adoptions).toEqual([]);
      // Exit three: the acknowledgement, refused and then accepted.
      const asked: ExternalChangeConflictSource[] = [];
      expect(
        acknowledgeDeletionSnapshot(withheld, (source) => {
          asked.push(source);
          return 'refused';
        })
      ).toBe(withheld);
      expect(asked).toEqual([externalOf(withheld).source]);
      const acknowledged = acknowledgeDeletionSnapshot(withheld, () => 'acknowledged');
      expect(acknowledged).toEqual({ ...withheld, uncertaintyUnresolved: false, reload: NOT_RELOADING });
      expect(matchDeletionView(acknowledged).conflictChoices).toContain('reloadDiskVersion');
      expect(matchDeletionView(askToReloadDiskVersion(acknowledged)).awaitingReloadConfirmation).toBe(true);
      // Nothing to acknowledge asks nothing.
      let askedWithoutCause = 0;
      const plain = applyDeletionObservation(session(), raised(seen));
      expect(
        acknowledgeDeletionSnapshot(plain, () => {
          askedWithoutCause += 1;
          return 'acknowledged';
        })
      ).toBe(plain);
      expect(askedWithoutCause).toBe(0);
    }); // End of the "raisedWithoutReload" case

    it('clears the uncertainty when a later verdict under none replaces the conflict', () => {
      const first = observation();
      const withheld = applyDeletionObservation(session(), decided(null, first, true, 'raisedWithoutReload'));
      const later = observation({ sequence: 6, diskRevision: 'c'.repeat(64), disk: diskFile({ revision: 'c'.repeat(64) }) });
      const replaced = applyDeletionObservation(withheld, decided(externalConflictSource(first), later, false, 'supersedes'));
      expect(replaced.uncertaintyUnresolved).toBe(false);
      expect(externalOf(replaced).source).toBe(externalConflictSource(later));
      expect(matchDeletionView(replaced).conflictChoices).toContain('reloadDiskVersion');
    });
  }); // End of the "uncertainty" suite

  describe('the reapply over the external origin: the subject’s exact from the table (entries 19, 20, 22)', () => {
    /** The base identity of the snippet the session is about. */
    const SUBJECT: MatchId = file().matches[0]!.id;

    /** The disk-side snippet the subject's row identifies. */
    const TWIN: MatchView = diskFile().matches[0]!;

    /**
     * One row of a table.
     *
     * The editor tier is deliberately a **refusal**, so a surface that read it
     * instead of `exact` would refuse where this suite expects a rebuild.
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
     * A session raised over one observation, with the question pending first so
     * the withdrawal is part of every case.
     *
     * @param seen - The observation.
     * @returns The session and the guard answering its own conflict's origin.
     */
    function raisedOver(
      seen: ExternalConflictObservation
    ): { readonly stuck: MatchDeletionSession; readonly stands: StandingOriginGuard } {
      const stuck = applyDeletionObservation(requested(), raised(seen));
      const source = externalOf(stuck).source;
      return { stuck, stands: () => source };
    } // End of function raisedOver()

    it('rebuilds the deletion from the row the subject’s full identity finds, reading its exact tier and never the editor tier', () => {
      const { stuck, stands } = raisedOver(observed([row(SUBJECT, { Identified: { target: TWIN } })]));
      const recorder = adopting();
      const answer = reapplyToDiskVersion(stuck, recorder.adopt, stands, () => stuck);
      expect(answer.kind).toBe('reapplied');
      if (answer.kind !== 'reapplied') {
        throw new Error('this case is about the rebuilt session');
      }
      expect(answer.session.match).toEqual(TWIN.id);
      expect(answer.session.pending).toBeNull();
      expect(baseRevisionOf(answer.session)).toBe(AFTER);
      expect(answer.session.externalConflict).toBeNull();
      expect(answer.session.awaitingReconciliation.size).toBe(0);
      expect(canRequestDelete(answer.session)).toBe(true);
      expect(recorder.adoptions).toEqual([externalOf(stuck)]);
      // The question is asked again, and answered against the live projection.
      const again = ((onHand) => confirmDelete(onHand, live(diskFile()), () => onHand))(requestDelete(answer.session));
      expect(again?.match).toEqual(TWIN.id);
      expect(((onHand) => confirmDelete(onHand, live(), () => onHand))(requestDelete(answer.session))).toBeNull();
    }); // End of the "rebuilt from the row" case

    it('refuses the subject: a refused tier, an empty tier, a stale full identity, the node alone, the position, and several rows', () => {
      const recorder = adopting();
      const refusedTier = raisedOver(observed([row(SUBJECT, { Refused: { reason: 'NoExactCorrespondence' } })]));
      expect(reapplyToDiskVersion(refusedTier.stuck, recorder.adopt, refusedTier.stands, () => refusedTier.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'correspondence', reason: 'NoExactCorrespondence' }
      });
      for (const empty of [{ Unsupported: {} }, { Targetless: {} }] as const) {
        const emptyTier = raisedOver(observed([row(SUBJECT, empty)]));
        expect(reapplyToDiskVersion(emptyTier.stuck, recorder.adopt, emptyTier.stands, () => emptyTier.stuck)).toEqual({
          kind: 'manualResolution',
          obstacle: { kind: 'evidenceNotATarget' }
        });
      } // End of the loop over the two empty arms
      // **Full identity, and nothing weaker** (entry 20): a row about the same
      // node of another parse, a row about the same node of the same parse of
      // another file, and a row at the subject's array position naming another
      // node all find nothing.
      const staleRevision = raisedOver(
        observed([row({ document: 2, revision: LATER, node: 10 }, { Identified: { target: TWIN } })])
      );
      expect(reapplyToDiskVersion(staleRevision.stuck, recorder.adopt, staleRevision.stands, () => staleRevision.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: 'noRowForBase' }
      });
      const otherFile = raisedOver(
        observed([row({ document: 3, revision: BASE, node: 10 }, { Identified: { target: TWIN } })])
      );
      expect(reapplyToDiskVersion(otherFile.stuck, recorder.adopt, otherFile.stands, () => otherFile.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: 'noRowForBase' }
      });
      const byPosition = raisedOver(
        observed([
          row({ document: 2, revision: BASE, node: 99 }, { Identified: { target: TWIN } }),
          row({ document: 2, revision: BASE, node: 11 }, { Identified: { target: TWIN } })
        ])
      );
      expect(reapplyToDiskVersion(byPosition.stuck, recorder.adopt, byPosition.stands, () => byPosition.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: 'noRowForBase' }
      });
      const twice = raisedOver(
        observed([row(SUBJECT, { Identified: { target: TWIN } }), row(SUBJECT, { Identified: { target: TWIN } })])
      );
      expect(reapplyToDiskVersion(twice.stuck, recorder.adopt, twice.stands, () => twice.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: 'severalRowsForBase' }
      });
      expect(recorder.adoptions).toEqual([]);
    }); // End of the "subject refusals" case

    it('refuses a table about other revisions, and an observation with none', () => {
      const recorder = adopting();
      const otherBase = raisedOver(observed([row(SUBJECT, { Identified: { target: TWIN } })], { base: 'z'.repeat(64) }));
      expect(reapplyToDiskVersion(otherBase.stuck, recorder.adopt, otherBase.stands, () => otherBase.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: 'baseRevisionMoved' }
      });
      const otherDisk = raisedOver(observed([row(SUBJECT, { Identified: { target: TWIN } })], { disk: 'z'.repeat(64) }));
      expect(reapplyToDiskVersion(otherDisk.stuck, recorder.adopt, otherDisk.stands, () => otherDisk.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: 'diskRevisionMoved' }
      });
      const tableless = raisedOver(observation());
      expect(reapplyToDiskVersion(tableless.stuck, recorder.adopt, tableless.stands, () => tableless.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: 'noCorrespondence' }
      });
      expect(recorder.adoptions).toEqual([]);
    });

    it('refuses superseded evidence through the live guard, whichever origin, adopting nothing', () => {
      const recorder = adopting();
      const elsewhere = externalConflictSource(observation({ sequence: 9 }));
      const found = raisedOver(observed([row(SUBJECT, { Identified: { target: TWIN } })]));
      expect(reapplyToDiskVersion(found.stuck, recorder.adopt, () => elsewhere, () => found.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'supersededEvidence' }
      });
      expect(reapplyToDiskVersion(found.stuck, recorder.adopt, () => null, () => found.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'supersededEvidence' }
      });
      expect(((onHand) => reapplyToDiskVersion(onHand, recorder.adopt, () => elsewhere, () => onHand))(saveConflicted())).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'supersededEvidence' }
      });
      expect(recorder.adoptions).toEqual([]);
    });

    it('answers every adoption outcome for the external origin, and rechecks eligibility over the disk parse', () => {
      const { stuck, stands } = raisedOver(observed([row(SUBJECT, { Identified: { target: TWIN } })]));
      expect(reapplyToDiskVersion(stuck, adopting('installed').adopt, stands, () => stuck).kind).toBe('reapplied');
      expect(reapplyToDiskVersion(stuck, adopting('alreadyThere').adopt, stands, () => stuck).kind).toBe('reapplied');
      const refusedWindow = adopting('refused');
      expect(reapplyToDiskVersion(stuck, refusedWindow.adopt, stands, () => stuck)).toEqual({ kind: 'adoptionRefused' });
      expect(refusedWindow.adoptions).toHaveLength(1);
      // The last snippet of the disk parse is refused there, adopting nothing.
      const alone = diskFile({ matches: [makeMatch({ node: 30, document: 2, revision: AFTER, trigger: ':sig' })] });
      const last = raisedOver(observed([row(SUBJECT, { Identified: { target: alone.matches[0]! } })], {}, alone));
      const recorder = adopting();
      expect(reapplyToDiskVersion(last.stuck, recorder.adopt, last.stands, () => last.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'notDeletable', reason: 'lastSnippet' }
      });
      expect(recorder.adoptions).toEqual([]);
    });

    it('refuses a reapply while an observation is held, so no rebuilt session can drop the block', () => {
      const { stuck, stands } = raisedOver(observed([row(SUBJECT, { Identified: { target: TWIN } })]));
      const heldReading = observation({ sequence: 6, diskRevision: 'd'.repeat(64), disk: diskFile({ revision: 'd'.repeat(64) }) });
      const held = applyDeletionObservation(stuck, retainedDelivery(heldReading));
      expect(held.awaitingReconciliation.get(2)).toBe(heldReading);
      expect(canRequestDelete(held)).toBe(false);
      const recorder = adopting();
      expect(reapplyToDiskVersion(held, recorder.adopt, stands, () => held)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'observationRetained' }
      });
      expect(recorder.adoptions).toEqual([]);
      const view = matchDeletionView(held);
      expect(view.conflictChoices).toEqual<readonly ConflictChoice[]>(['keepEditing', 'reloadDiskVersion']);
      expect(view.reapplyOffered).toBe(false);
      expect(view.externalNotices).toEqual([{ kind: 'observationRetained' }]);
      const lifted = applyDeletionObservation(held, writtenHereDelivery(heldReading));
      const answer = reapplyToDiskVersion(lifted, adopting().adopt, stands, () => lifted);
      expect(answer.kind).toBe('reapplied');
      if (answer.kind === 'reapplied') {
        expect(answer.session.awaitingReconciliation.size).toBe(0);
        expect(canRequestDelete(answer.session)).toBe(true);
      }
      // The waits are carried whole through the rebuild: one a hand-built session
      // holds about another file survives it.
      const elsewhere = otherObservation();
      const carrying: MatchDeletionSession = { ...stuck, awaitingReconciliation: new Map([[3, elsewhere]]) };
      const rebuilt = reapplyToDiskVersion(carrying, adopting().adopt, stands, () => carrying);
      expect(rebuilt.kind).toBe('reapplied');
      if (rebuilt.kind === 'reapplied') {
        expect(rebuilt.session.awaitingReconciliation.get(3)).toBe(elsewhere);
        expect(canRequestDelete(rebuilt.session)).toBe(true);
      }
    }); // End of the "reapply refused while held" case

    it('asks nothing of the window when no guard is handed in, and leaves the door to decide', () => {
      const { stuck } = raisedOver(observed([row(SUBJECT, { Identified: { target: TWIN } })]));
      const refusedWindow = adopting('refused');
      expect(reapplyToDiskVersion(stuck, refusedWindow.adopt, null, () => stuck)).toEqual({ kind: 'adoptionRefused' });
      expect(refusedWindow.adoptions).toEqual([externalOf(stuck)]);
      expect(reapplyToDiskVersion(stuck, adopting().adopt, null, () => stuck).kind).toBe('reapplied');
    });

    it('names a sentence in both languages for every obstacle the external origin can raise', () => {
      const obstacles: DeletionReapplyObstacle[] = [
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
        const key = deletionReapplyObstacleKey(obstacle);
        for (const locale of LOCALES) {
          expect(DICTIONARIES[locale][key], `${locale}:${obstacle.kind}`).toBeTruthy();
          const rendered = describeDeletionReapplyObstacle(locale, obstacle);
          expect(rendered, `${locale}:${obstacle.kind}`).toBe(DICTIONARIES[locale][key]);
          expect(rendered).not.toContain('{');
        } // End of the loop over the two locales
      } // End of the loop over the external obstacles
      expect(deletionReapplyObstacleKey({ kind: 'writeOutcomeUnknown' })).toBe('browser.externalConflict.writeOutcomeUnknown');
      expect(deletionReapplyObstacleKey({ kind: 'observationRetained' })).toBe('browser.externalConflict.observationRetained');
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
    function trappedForReapply(over: MatchDeletionSession, body: () => void): { readonly proxy: MatchDeletionSession; arm(): void } {
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
      const { stuck, stands } = raisedOver(observed([row(SUBJECT, { Identified: { target: TWIN } })]));
      const displaced = applyDeletionObservation(stuck, retainedDelivery(observation({ sequence: 6 })));
      let holder: MatchDeletionSession = stuck;
      const trap = trappedForReapply(stuck, () => {
        holder = displaced;
      });
      holder = trap.proxy;
      const recorder = adopting('installed');
      const answer = reapplyToDiskVersion(trap.proxy, recorder.adopt, stands, () => {
        const now = holder;
        trap.arm();
        return now;
      });
      expect(holder).toBe(displaced);
      expect(answer.kind).toBe('manualResolution');
      expect(recorder.adoptions).toEqual([]);
    }); // End of the "displaced before the reapply's adoption" case

    it('rebuilds nothing when a read of the settled session displaced it after the adoption (Phase 2d-6-7a)', () => {
      const { stuck, stands } = raisedOver(observed([row(SUBJECT, { Identified: { target: TWIN } })]));
      const displaced = applyDeletionObservation(stuck, retainedDelivery(observation({ sequence: 6 })));
      let holder: MatchDeletionSession = stuck;
      const trap = trappedForReapply(stuck, () => {
        holder = displaced;
      });
      holder = trap.proxy;
      const recorder = adopting('installed');
      const answer = reapplyToDiskVersion(
        trap.proxy,
        (conflict, confirmation) => {
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
      const { stuck, stands } = raisedOver(observed([row(SUBJECT, { Identified: { target: TWIN } })]));
      let holder: MatchDeletionSession = stuck;
      const newer = observation({ sequence: 6, diskRevision: 'c'.repeat(64), disk: diskFile({ revision: 'c'.repeat(64) }) });
      const recorder = adopting('installed');
      const answer = reapplyToDiskVersion(
        stuck,
        (conflict, confirmation) => {
          holder = applyDeletionObservation(holder, decided(externalOf(holder).source, newer, false, 'supersedes'));
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
      const { stuck, stands } = raisedOver(observed([row(SUBJECT, { Identified: { target: TWIN } })]));
      let holder: MatchDeletionSession = stuck;
      const later = observation({ sequence: 6 });
      const recorder = adopting('installed');
      const answer = reapplyToDiskVersion(
        stuck,
        (conflict, confirmation) => {
          holder = applyDeletionObservation(holder, retainedDelivery(later));
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

  describe('the doors, the settlement and the reapply against the installed session (the review’s three blockers)', () => {
    /** The base identity of the snippet the session is about. */
    const SUBJECT: MatchId = file().matches[0]!.id;

    /** The disk-side snippet the subject's row identifies. */
    const TWIN: MatchView = diskFile().matches[0]!;

    /**
     * A holder standing in for the component's `$state`: what a registered
     * receiver would update, and what the reader answers.
     *
     * @param first - The session installed at the start.
     * @returns The holder, its reader, and a receiver that applies to it.
     */
    function installed(first: MatchDeletionSession): {
      current: () => MatchDeletionSession;
      receive: (delivery: ObservationDelivery) => void;
      set: (next: MatchDeletionSession) => void;
      held: () => MatchDeletionSession;
    } {
      let session = first;
      return {
        current: () => session,
        receive: (delivery) => {
          session = applyDeletionObservation(session, delivery);
        },
        set: (next) => {
          session = next;
        },
        held: () => session
      };
    } // End of function installed()

    it('refuses a confirmation when the projection read displaced the installed session', () => {
      // **The review's first blocker.** A getter behind `projected.document` is
      // caller code that runs between the block and the spend; a window's
      // receiver, run from it, replaces the installed session with one carrying
      // an external conflict. The confirmation must be settled against the
      // session installed after that read, not the one handed in before it.
      const holder = installed(requested());
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
      expect(confirmDelete(handedIn, projected, holder.current)).toBeNull();
      expect(holder.current().externalConflict?.source).toBe(externalConflictSource(seen));
      expect(holder.current().pending).toBeNull();
      // The same read that displaces nothing spends as before.
      const quiet = installed(requested());
      expect(confirmDelete(quiet.current(), live(), quiet.current)).not.toBeNull();
      // And a reader answering a session that carries a block is refused too.
      const waiting = installed(applyDeletionObservation(requested(), retainedDelivery(seen)));
      const byHand: MatchDeletionSession = { ...waiting.current(), pending: requested().pending };
      expect(confirmDelete(byHand, live(), waiting.current)).toBeNull();
    }); // End of the "displaced during the projection read" case

    it('refuses a confirmation when a later read of this door displaced the installed session (2d-6-5’s class, Phase 2d-6-6a)', () => {
      // **The installed session is read once, and it must be read last.** The
      // door reads the draft's value for the comparison and again for the
      // submission, and spreads the session; a getter quiet on the first read
      // and delivering on a later one, or on the spread, runs after a reader
      // asked too early. Every read the door makes, counted, delivers in turn.
      const seen = observation();
      /**
       * A holder whose installed session delivers `raised` on the given read of
       * the draft's value, counting from one, and counts the reads.
       *
       * @param on - The read that delivers, or `null` to deliver never.
       * @returns The holder, the trapped session it installs, and the count.
       */
      function deliveringOnRead(on: number | null): {
        readonly holder: ReturnType<typeof installed>;
        readonly trapped: MatchDeletionSession;
        readonly reads: () => number;
      } {
        const holder = installed(requested());
        const handedIn = holder.current();
        let reads = 0;
        const trapped: MatchDeletionSession = {
          ...handedIn,
          draft: {
            ...handedIn.draft,
            get value(): MatchId {
              reads += 1;
              if (reads === on) {
                holder.receive(raised(seen));
              }
              return handedIn.draft.value;
            }
          }
        };
        holder.set(trapped);
        return { holder, trapped, reads: () => reads };
      } // End of function deliveringOnRead()
      const quiet = deliveringOnRead(null);
      expect(confirmDelete(quiet.trapped, live(), quiet.holder.current)).not.toBeNull();
      const total = quiet.reads();
      expect(total).toBeGreaterThanOrEqual(1);
      for (let on = 1; on <= total; on += 1) {
        const displaced = deliveringOnRead(on);
        expect(confirmDelete(displaced.trapped, live(), displaced.holder.current)).toBeNull();
        expect(externalOf(displaced.holder.current()).source).toBe(externalConflictSource(seen));
      } // End of the loop over the reads of the draft's value
      // The spread that builds the waiting session reads every own property.
      // Armed once: the receiver's own spread reads it again.
      const spreading = installed(requested());
      const beforeSpread = spreading.current();
      let armed = true;
      const trappedSpread: MatchDeletionSession = {
        ...beforeSpread,
        get extraMessages(): MatchDeletionSession['extraMessages'] {
          if (armed) {
            armed = false;
            spreading.receive(raised(seen));
          }
          return [];
        }
      };
      spreading.set(trappedSpread);
      expect(confirmDelete(trappedSpread, live(), spreading.current)).toBeNull();
      expect(externalOf(spreading.current()).source).toBe(externalConflictSource(seen));
    }); // End of the "displaced during a later read" case

    it('settles against the installed session and replays a delivery that arrived during its own replay', () => {
      // **The review's second blocker.** With `retained(A), raised(A)` held, a
      // getter behind A's `document` publishes B while A is being replayed; the
      // window delivers B to the installed session — still `saving`, so it is
      // appended there — and a settlement that returned only its own replay would
      // let the caller overwrite that append. The settled session must carry B.
      const started = ((onHand) => confirmDelete(onHand, live(), () => onHand))(requested());
      if (started === null) {
        throw new Error('a confirmed deletion is sendable');
      }
      const holder = installed(started.session);
      let armed = false;
      const later = observation({ sequence: 6, diskRevision: 'c'.repeat(64), disk: diskFile({ revision: 'c'.repeat(64) }) });
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
      const settled = applyDeletion(holder.current(), REFUSED, NOT_OWED, holder.current);
      expect(armed).toBe(false);
      expect(settled.outcome?.kind).toBe('refused');
      expect(settled.heldDeliveries).toEqual([]);
      expect(settled.awaitingReconciliation.size).toBe(0);
      expect(externalOf(settled).source).toBe(externalConflictSource(later));
      // The same through a send that produced no outcome.
      const again = installed(started.session);
      const seenAgain: ExternalConflictObservation = {
        ...observation(),
        get document(): DocumentId {
          if (armed) {
            armed = false;
            again.receive(decided(externalConflictSource(this), later, false, 'supersedes'));
          }
          return 2;
        }
      };
      again.receive(retainedDelivery(seenAgain));
      again.receive(raised(seenAgain));
      armed = true;
      const failed = deletionCouldNotBeSent(again.current(), false, null, again.current);
      expect(failed.heldDeliveries).toEqual([]);
      expect(externalOf(failed).source).toBe(externalConflictSource(later));
      // A reader answering the capture it was handed settles only that capture —
      // the documented cost of a reader that does not read what the caller installs.
      const alone = installed(started.session);
      const seenAlone: ExternalConflictObservation = {
        ...observation(),
        get document(): DocumentId {
          if (armed) {
            armed = false;
            alone.receive(decided(externalConflictSource(this), later, false, 'supersedes'));
          }
          return 2;
        }
      };
      alone.receive(retainedDelivery(seenAlone));
      alone.receive(raised(seenAlone));
      armed = true;
      expect(externalOf(((onHand) => applyDeletion(onHand, REFUSED, NOT_OWED, () => onHand))(alone.current())).source).toBe(externalConflictSource(seenAlone));
    }); // End of the "delivery during the replay" case

    it('rechecks the installed session immediately before adopting, and refuses a wait or a supersession that arrived during the evidence reads', () => {
      // **The review's third blocker.** A getter behind a row's `exact` is
      // caller code that runs after the two blocks were asked and before the
      // adoption; a window's receiver, run from it, records a wait on the
      // installed session. The reapply must ask the installed session again,
      // once, immediately before it adopts — and adopt nothing when it changed.
      const heldReading = observation({ sequence: 6, diskRevision: 'd'.repeat(64), disk: diskFile({ revision: 'd'.repeat(64) }) });
      const recorder = adopting();
      /**
       * A session raised over a table whose subject row delivers to the holder
       * when its exact tier is read.
       *
       * @param deliver - What the read delivers.
       * @returns The holder and the guard.
       */
      function trapped(deliver: (source: ExternalChangeConflictSource) => ObservationDelivery): {
        readonly holder: ReturnType<typeof installed>;
        readonly stands: StandingOriginGuard;
      } {
        let holder: ReturnType<typeof installed> | null = null;
        const row: CorrespondenceEntry = {
          base: SUBJECT,
          get exact(): ReapplyResolution {
            if (holder !== null) {
              const source = externalOf(holder.current()).source;
              holder.receive(deliver(source));
            }
            return { Identified: { target: TWIN } };
          },
          editor: { Unsupported: {} }
        };
        const seen = observation({
          correspondences: { base_revision: BASE, disk_revision: AFTER, entries: [row] }
        });
        holder = installed(applyDeletionObservation(requested(), raised(seen)));
        const source = externalOf(holder.current()).source;
        return { holder, stands: () => source };
      } // End of function trapped()
      const waited = trapped(() => retainedDelivery(heldReading));
      expect(reapplyToDiskVersion(waited.holder.current(), recorder.adopt, waited.stands, waited.holder.current)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'observationRetained' }
      });
      expect(waited.holder.current().awaitingReconciliation.get(2)).toBe(heldReading);
      const superseded = trapped((source) => decided(source, heldReading, false, 'supersedes'));
      expect(
        reapplyToDiskVersion(superseded.holder.current(), recorder.adopt, superseded.stands, superseded.holder.current)
      ).toEqual({ kind: 'manualResolution', obstacle: { kind: 'supersededEvidence' } });
      const uncertain = trapped((source) => decided(source, heldReading, true, 'raisedWithoutReload'));
      expect(
        reapplyToDiskVersion(uncertain.holder.current(), recorder.adopt, uncertain.stands, uncertain.holder.current)
      ).toEqual({ kind: 'manualResolution', obstacle: { kind: 'writeOutcomeUnknown' } });
      expect(recorder.adoptions).toEqual([]);
      // A read that delivers nothing new adopts as before, and carries the
      // installed session's waits about other files.
      const elsewhere = otherObservation();
      const quiet = trapped(() => retainedDelivery(elsewhere));
      const answer = reapplyToDiskVersion(quiet.holder.current(), recorder.adopt, quiet.stands, quiet.holder.current);
      expect(answer.kind).toBe('reapplied');
      expect(recorder.adoptions).toHaveLength(1);
    }); // End of the "recheck before adoption" case

    it('reads no evidence for a session that is already blocked', () => {
      // **The review's should-fix.** The record says the two blocks come before
      // any evidence is read; the entry used to be asked first. A table whose
      // spine counts its reads is the pin.
      let reads = 0;
      const seen: ExternalConflictObservation = {
        ...observation(),
        get correspondences(): CorrespondenceTable {
          reads += 1;
          return { base_revision: BASE, disk_revision: AFTER, entries: [] };
        }
      };
      const stuck = applyDeletionObservation(requested(), raised(seen));
      const stands: StandingOriginGuard = () => externalOf(stuck).source;
      const recorder = adopting();
      const held = applyDeletionObservation(stuck, retainedDelivery(observation({ sequence: 6 })));
      expect(reapplyToDiskVersion(held, recorder.adopt, stands, () => held)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'observationRetained' }
      });
      const withheld = applyDeletionObservation(requested(), decided(null, seen, true, 'raisedWithoutReload'));
      expect(reapplyToDiskVersion(withheld, recorder.adopt, stands, () => withheld)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'writeOutcomeUnknown' }
      });
      expect(reads).toBe(0);
      // And an unblocked session reads it exactly once.
      expect(reapplyToDiskVersion(stuck, recorder.adopt, stands, () => stuck)).toEqual({
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
    function confirmedOver(seen: ExternalConflictObservation): MatchDeletionSession {
      const confirmed = confirmDiskReload(askToReloadDiskVersion(applyDeletionObservation(requested(), raised(seen))));
      expect(confirmed.reload.kind).toBe('confirmed');
      return confirmed;
    } // End of function confirmedOver()

    it('answers the installed session and asks the window nothing when the session was displaced before the adoption', () => {
      const confirmed = confirmedOver(observation());
      const installed = applyDeletionObservation(confirmed, retainedDelivery(observation({ sequence: 6 })));
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
          holder = applyDeletionObservation(holder, decided(externalConflictSource(seen), newer, false, 'supersedes'));
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
          holder = applyDeletionObservation(holder, retainedDelivery(later));
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
    function trappedSession(target: MatchDeletionSession, body: () => void): { readonly proxy: MatchDeletionSession; arm(): void } {
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
        const displaced = applyDeletionObservation(confirmed, retainedDelivery(observation({ sequence: 6 })));
        let holder: MatchDeletionSession = confirmed;
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
      const asked = askToReloadDiskVersion(applyDeletionObservation(requested(), raised(observation())));
      expect(asked.reload.kind).not.toBe('confirmed');
      const displaced = applyDeletionObservation(asked, retainedDelivery(observation({ sequence: 6 })));
      let holder: MatchDeletionSession = asked;
      const step = asked.reload;
      const tricked: MatchDeletionSession = {
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
