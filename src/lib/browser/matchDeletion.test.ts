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
 * 4. **the view** — what a screen would draw, derived on every read.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { describe, expect, it } from 'vitest';
import { DICTIONARIES } from '../i18n/dictionaries';
import { LOCALES } from '../i18n/locale';
import type { ContentRevision, DocumentView, Finding, MatchId, SaveResult } from '../ipc/types';
import { makeDocument, makeMatch } from './fixtures';
import type { InvalidationStatus } from './invalidation';
import {
  acknowledgeDeletionFindings,
  applyDeletion,
  askToReloadDiskVersion,
  baseRevisionOf,
  cancelDelete,
  canRequestDelete,
  confirmDelete,
  confirmDiskReload,
  conflictOf,
  deletionCouldNotBeSent,
  deletionEligibility,
  deletionRefusalKey,
  dismissDeletionOutcome,
  identityInProjection,
  matchDeletionView,
  reloadTheDiskVersion,
  requestDelete,
  startMatchDeletion,
  type DeletionRefusal,
  type MatchDeletionSession
} from './matchDeletion';
import type { AdoptTheDiskVersion } from './editorSave';
import type { DiskAdoptionOutcome } from './saveOutcome';
import type { ConflictChoice, ConflictModel } from './saveOutcome';

/** The revision every projection below is minted from. */
const BASE: ContentRevision = 'a'.repeat(64);

/** The revision the file holds after a commit. */
const AFTER: ContentRevision = 'b'.repeat(64);

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
    expect(confirmDelete(clean, live())).toBeNull();
    const asked = requestDelete(clean);
    expect(asked.pending).not.toBeNull();
    expect(confirmDelete(asked, live())).not.toBeNull();
  });

  it('takes the question back', () => {
    const asked = requestDelete(session());
    const cancelled = cancelDelete(asked);
    expect(cancelled.pending).toBeNull();
    expect(confirmDelete(cancelled, live())).toBeNull();
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
    expect(confirmDelete(carried, elsewhere)).toBeNull();
    const otherNode: MatchDeletionSession = {
      ...asked,
      match: { document: 2, revision: BASE, node: 11 }
    };
    expect(confirmDelete(otherNode, otherNode.match)).toBeNull();
  });

  it('refuses a confirmation the window has reprojected the file under', () => {
    // **The first review round's fifth finding, and the whole of it.** The session
    // is *retained*, exactly as a component holding one in a `$state.raw` retains
    // it: nothing here manufactures a changed `session.match`, because a reload
    // does not change one. What changes is the file, and the identity the current
    // projection gives that snippet is the only value in the comparison that comes
    // from outside the session — so it is the only one that can say so.
    const asked = requestDelete(session());
    expect(confirmDelete(asked, live())).not.toBeNull();

    const afterReload = reprojected();
    expect(confirmDelete(asked, live(afterReload))).toBeNull();
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
    expect(confirmDelete(asked, null)).toBeNull();
  });

  it('spends the confirmation, so a second attempt is asked for again', () => {
    const started = confirmDelete(requestDelete(session()), live());
    expect(started!.session.pending).toBeNull();
    expect(started!.match).toEqual(file().matches[0]!.id);
    expect(started!.session.phase).toBe('saving');
    expect(started!.submission.acknowledgement).toEqual({ accepted: [] });
    expect(baseRevisionOf(started!.session)).toBe(BASE);
  });

  it('asks nothing while a deletion is in flight, or after one has committed', () => {
    const started = confirmDelete(requestDelete(session()), live());
    expect(canRequestDelete(started!.session)).toBe(false);
    expect(requestDelete(started!.session)).toBe(started!.session);
    const done = applyDeletion(started!.session, saved(), ADOPTED);
    expect(done.deleted).toBe(true);
    expect(canRequestDelete(done)).toBe(false);
    // And dismissing the panel does not give it back.
    expect(canRequestDelete(dismissDeletionOutcome(done))).toBe(false);
    expect(confirmDelete(requestDelete(done), live())).toBeNull();
  });
}); // End of the "two phases" suite

describe('what comes back', () => {
  it('spends the session on a commit and says the file was written', () => {
    const started = confirmDelete(requestDelete(session()), live());
    const done = applyDeletion(started!.session, saved(), ADOPTED);
    const view = matchDeletionView(done);
    expect(view.deleted).toBe(true);
    expect(view.deleting).toBe(false);
    expect(view.messages.map((message) => message.kind)).toEqual(['fileWritten']);
  });

  it('carries the doubled-separation note only a deletion produces', () => {
    const started = confirmDelete(requestDelete(session()), live());
    const withNote: SaveResult = {
      outcome: 'saved',
      revision: AFTER,
      committed: true,
      notes: [{ DoubledSequenceSeparation: { edit: 0 } }],
      backup_taken: false,
      moved: null
    };
    const view = matchDeletionView(applyDeletion(started!.session, withNote, ADOPTED));
    // Plan section 6.2 is *never silently normalise*, and the blank line a removed
    // snippet leaves behind is exactly such a change.
    expect(view.notes).toEqual([{ DoubledSequenceSeparation: { edit: 0 } }]);
  });

  it('puts the out-of-step line beside a commit whose adoption failed', () => {
    const started = confirmDelete(requestDelete(session()), live());
    const done = applyDeletion(started!.session, saved(), NOT_ADOPTED);
    // Beside the saved arm, never in place of it: the snippet really is gone.
    expect(matchDeletionView(done).messages.map((message) => message.kind)).toEqual([
      'fileWritten',
      'windowOutOfStep'
    ]);
  });

  it('carries a refusal’s findings and the consent that answers them', () => {
    const started = confirmDelete(requestDelete(session()), live());
    const refused = applyDeletion(started!.session, REFUSED, NOT_OWED);
    const view = matchDeletionView(refused);
    expect(view.outcome?.kind).toBe('refused');
    expect(view.refusalChoices).toEqual(['saveAnyway', 'keepEditing']);
    expect(view.deleted).toBe(false);

    const consented = acknowledgeDeletionFindings(refused);
    const again = confirmDelete(requestDelete(consented), live());
    expect(again!.submission.acknowledgement).toEqual({ accepted: [SUSPICION] });
  });

  it('offers one way out of a conflict, and stops asking while it shows', () => {
    const started = confirmDelete(requestDelete(session()), live());
    const conflicted = applyDeletion(started!.session, CONFLICT, NOT_OWED);
    expect(conflictOf(conflicted)).not.toBeNull();
    expect(canRequestDelete(conflicted)).toBe(false);
    expect(matchDeletionView(conflicted).conflictChoices).toEqual(['keepEditing']);
    const dismissed = dismissDeletionOutcome(conflicted);
    expect(conflictOf(dismissed)).toBeNull();
    expect(canRequestDelete(dismissed)).toBe(true);
  });

  it('records a send that produced no outcome, in its two arms', () => {
    const started = confirmDelete(requestDelete(session()), live());
    const notSent = deletionCouldNotBeSent(started!.session, false, null);
    expect(notSent.sendFailure).toEqual({ kind: 'notSent', reason: null });
    expect(notSent.deleted).toBe(false);
    const failure = { kind: 'command' as const, error: { code: 'noWorkspaceOpen' as const } };
    const maybe = deletionCouldNotBeSent(started!.session, true, failure);
    expect(maybe.sendFailure).toEqual({ kind: 'mayHaveWritten', reason: failure });
    expect(matchDeletionView(maybe).failureLines).toEqual([{ kind: 'failure', failure }]);
  });

  it('ignores an answer nothing was waiting for', () => {
    const clean = session();
    expect(applyDeletion(clean, saved(), ADOPTED)).toBe(clean);
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
    expect(confirmDelete(requestDelete(session()), fresh)).toBeNull();
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

describe('the confirmed reload, which is built but not offered yet', () => {
  // **2c-4a-2's High finding.** The consult's Q3 gives every one of the six
  // surfaces a confirmed reload; withholding the *offering* until 2c-4a-3 draws
  // this surface's control is right, and withholding the **transition** was not —
  // an unoffered transition can be built and driven without drawing anything, and
  // leaving it out would have made step 3 invent five model machines on top of
  // five panels. So the transition below is built **and** wired: this surface's
  // `conflictAction` calls it, and `offersReload` stays `false` so nothing on
  // screen reaches it. Every case here calls it directly, as that arm does.

  /**
   * A conflicted deletion of a confirmed session.
   *
   * @returns The session showing the conflict.
   */
  function conflicted(): MatchDeletionSession {
    const started = confirmDelete(requestDelete(session()), live());
    if (started === null) {
      throw new Error('a confirmed deletion is sendable');
    }
    return applyDeletion(started.session, CONFLICT, NOT_OWED);
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
    expect(reloadTheDiskVersion(stuck, recorder.adopt)).toBe(stuck);
    const asked = askToReloadDiskVersion(stuck);
    expect(matchDeletionView(asked).awaitingReloadConfirmation).toBe(true);
    // The warning alone is not a confirmation either.
    expect(reloadTheDiskVersion(asked, recorder.adopt)).toBe(asked);
    expect(recorder.adoptions).toEqual([]);
    expect(matchDeletionView(asked).closed).toBe(false);
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
    expect(after).toBe(confirmed);
    expect(after.closed).toBe(false);
    expect(conflictOf(after)).not.toBeNull();
  }); // End of the "window refused" case

  it('does not offer the reload, so no control is drawn for it', () => {
    // The half of the review's judgement that stands: the transition exists, is
    // driven here and is called by this surface's `conflictAction`; `offersReload`
    // stays `false`, so nothing on screen can reach it and 2c-4a-3 has only the
    // boolean to flip.
    const asked = askToReloadDiskVersion(conflicted());
    expect(matchDeletionView(asked).conflictChoices).toEqual<readonly ConflictChoice[]>([
      'keepEditing'
    ]);
  });

  it('forgets a confirmation when the panel is dismissed or a new answer arrives', () => {
    // A confirmation is a person's answer to **one** conflict. Reaching the
    // confirmed step and then dismissing must not leave it spendable.
    const recorder = adopting();
    const confirmed = confirmDiskReload(askToReloadDiskVersion(conflicted()));
    const dismissed = dismissDeletionOutcome(confirmed);
    expect(dismissed.reload.kind).toBe('idle');
    expect(reloadTheDiskVersion(dismissed, recorder.adopt)).toBe(dismissed);
    expect(recorder.adoptions).toEqual([]);
  }); // End of the "dismissal forgets the confirmation" case
}); // End of the "confirmed reload" suite
