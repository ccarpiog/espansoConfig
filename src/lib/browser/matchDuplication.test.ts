/**
 * Duplicating one snippet, driven without a screen.
 *
 * Five groups:
 *
 * 1. **eligibility** — the four refusals of the consult's Q6, including the
 *    document-wide open-editor rule as an input rather than a lookup;
 * 2. **starting a duplicate** — the live-identity gate, the frozen base
 *    revision, and every way this module refuses to produce something to send;
 * 3. **the answer** — the three arms, the acknowledgement round trip that is
 *    this operation's *ordinary* path, the two arms of a send that produced no
 *    outcome, and the recovery;
 * 4. **the refusal precedence** — every adjacent pair of the consult's order,
 *    driven where a transition can reach the pair and constructed where only a
 *    hand-written session can;
 * 5. **the view** — what a screen would draw, derived on every read;
 * 6. **the external session** (Phase 2d-6-4) — the seven verdict arms, the two
 *    new refusal codes, the held observation, the uncertainty and the reapply
 *    over the observation's table by full identity.
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
  DocumentView,
  Finding,
  MatchId,
  MatchView,
  PresentationNote,
  ReapplyResolution,
  SaveResult
} from '../ipc/types';
import { makeConflict, makeDocument, makeMatch, matchListPath } from './fixtures';
import type { InvalidationStatus } from './invalidation';
import { identityInProjection } from './matchDeletion';
import {
  acknowledgeDuplicationFindings,
  acknowledgeDuplicationSnapshot,
  applyDuplication,
  applyDuplicationObservation,
  askToReloadDiskVersion,
  baseRevisionOf,
  beginDuplicate,
  canDuplicate,
  confirmDiskReload,
  conflictOf,
  dismissDuplicationOutcome,
  documentHasUnsavedDraft,
  duplicationCouldNotBeSent,
  duplicationEligibility,
  duplicationRecoveryChoices,
  duplicationRecoveryFailed,
  duplicationReapplyObstacleKey,
  duplicationRecoveryKey,
  duplicationRefusalKey,
  duplicationSubmissionRefusal,
  duplicationSubmissionRefusalKey,
  matchDuplicationView,
  reapplyToDiskVersion,
  reloadTheDiskVersion,
  startMatchDuplication,
  type DuplicationReapplyObstacle,
  type DuplicationRefusal,
  type DuplicationSubmissionRefusal,
  type MatchDuplicationSession
} from './matchDuplication';
import { NOT_RELOADING, type AdoptTheDiskVersion } from './editorSave';
import {
  externalConflictSource,
  standingConflictOf,
  type ConflictSource,
  type ExternalChangeConflictSource,
  type ExternalConflictObservation,
  type ObservationVerdict
} from './conflictSource';
import { describeDuplicationReapplyObstacle } from '../i18n';
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
 * The `path` is what makes it an *item of a sequence*: a duplicate copies a
 * sequence item, so a fixture without one is a snippet this application cannot
 * address and therefore cannot copy.
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
 * A snippet file with two snippets in one list.
 *
 * @param overrides - Whatever a case needs beyond the two snippets.
 * @returns The projection.
 */
function file(overrides: Parameters<typeof makeDocument>[0] = {}): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision: BASE,
    matches: [item(10, 0, ':sig'), item(11, 1, ':date')],
    ...overrides
  });
} // End of function file()

/**
 * The same file, as this window holds it after reading it again.
 *
 * **The arena nodes are deliberately kept and only the revision moves**, for
 * `matchMove.test.ts`'s stated reason: an identity minted from an earlier parse
 * must be refused even when the node it names is still occupied.
 *
 * @param overrides - Whatever a case needs the re-read file to keep saying.
 * @returns The projection this window holds after the re-read.
 */
function reread(overrides: Parameters<typeof makeDocument>[0] = {}): DocumentView {
  return file({
    revision: AFTER,
    matches: [
      makeMatch({ node: 10, document: 2, revision: AFTER, trigger: ':sig', path: matchListPath(0) }),
      makeMatch({ node: 11, document: 2, revision: AFTER, trigger: ':date', path: matchListPath(1) })
    ],
    ...overrides
  });
} // End of function reread()

/**
 * A session over one snippet of {@link file}, with no editor open anywhere.
 *
 * @param position - Which snippet of the list the duplicate is about.
 * @param document - The projection to take the pair from.
 * @returns The session.
 */
function session(position = 0, document: DocumentView = file()): MatchDuplicationSession {
  return startMatchDuplication(document, document.matches[position]!, false);
} // End of function session()

/**
 * The identity the window's **current** projection gives one snippet.
 *
 * What a screen would read off the live projection with `identityInProjection`
 * and hand to {@link beginDuplicate}, which is the only argument there that
 * comes from outside the session and therefore the only one that can notice a
 * reprojection.
 *
 * @param position - Which snippet.
 * @param document - The projection the window is holding now.
 * @returns That projection's identity for it.
 */
function live(position = 0, document: DocumentView = file()): MatchId {
  return document.matches[position]!.id;
} // End of function live()

/** The projections the window holds while a session over {@link file} is fresh. */
const HELD: readonly DocumentView[] = [file()];

/** The adoption a save that wrote nothing owes: none. */
const NOT_OWED: InvalidationStatus = { kind: 'notOwed' };

/** The adoption a save this window had to re-read the file after performed. */
const ADOPTED: InvalidationStatus = { kind: 'done' };

/** The adoption a committed duplicate could not perform. */
const NOT_ADOPTED: InvalidationStatus = {
  kind: 'failed',
  failure: { kind: 'command', error: { code: 'unknownDocument', document: 2 } }
};

/**
 * A `saved` outcome.
 *
 * The revision is a parameter for `matchMove.test.ts`'s stated reason: a
 * `committed: false` answer whose revision is the one this window was already
 * projecting owes no adoption and spends nothing; one whose revision has moved
 * owes an adoption, and that adoption replaces every identity a session holds
 * without a byte being written.
 *
 * @param committed - Whether the file was rewritten.
 * @param moved - The clone's identity in the new revision, or `null`.
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

/**
 * The finding the transaction produces on a duplicate's first attempt.
 *
 * The duplicate's own suspicion, carrying the candidate's revision — the
 * operand that binds consent to one clone (`docs/decisions/2c-3c-1-notes.md`
 * section 6.1).
 */
const TRIGGER_KEPT: Finding = {
  code: { DuplicateKeepsTriggerDefinition: { revision: AFTER } },
  span: null,
  node: null,
  path: null
};

/** The refusal a duplicate's first attempt ordinarily comes back as. */
const REFUSED: SaveResult = {
  outcome: 'refused',
  verdict: 'RefusedForUnacknowledgedSuspicions',
  findings: [TRIGGER_KEPT]
};

/** A conflict: the file moved on and nothing was written. */
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
 * `saveFailed` and nothing else, for `matchMove.test.ts`'s stated reason:
 * `mayHaveWritten` in `../ipc/errors` answers `true` for that one code.
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

describe('whether one snippet may be duplicated at all', () => {
  it('says yes for an ordinary item of an ordinary list', () => {
    const document = file();
    expect(duplicationEligibility(document, document.matches[0]!, false)).toEqual({
      kind: 'duplicable'
    });
  });

  it('refuses a file this application must not write', () => {
    const packaged = file({ kind: 'Package', readOnly: true });
    expect(duplicationEligibility(packaged, packaged.matches[0]!, false)).toEqual({
      kind: 'refused',
      reason: 'readOnly'
    });
  });

  it('refuses a snippet and a file that are not a pair this projection describes', () => {
    // All three shapes of the mismatch: another file, another revision of the
    // same file, and a node this projection simply does not hold.
    const document = file();
    const otherFile = makeMatch({ node: 10, document: 3, revision: BASE, path: matchListPath(0) });
    expect(duplicationEligibility(document, otherFile, false)).toEqual({
      kind: 'refused',
      reason: 'notInDocument'
    });
    const otherParse = makeMatch({ node: 10, document: 2, revision: AFTER, path: matchListPath(0) });
    expect(duplicationEligibility(document, otherParse, false)).toEqual({
      kind: 'refused',
      reason: 'notInDocument'
    });
    const missing = makeMatch({ node: 99, document: 2, revision: BASE, path: matchListPath(0) });
    expect(duplicationEligibility(document, missing, false)).toEqual({
      kind: 'refused',
      reason: 'notInDocument'
    });
  });

  it('refuses a snippet this projection gives no sequence position', () => {
    const unaddressed = makeMatch({ node: 10, document: 2, revision: BASE, path: null });
    const document = file({ matches: [unaddressed, item(11, 1, ':date')] });
    expect(duplicationEligibility(document, document.matches[0]!, false)).toEqual({
      kind: 'refused',
      reason: 'noSequencePosition'
    });
  });

  it('refuses while any snippet of the file is open in the editor, not only the source', () => {
    // **Document-wide, on purpose** (consult Q6): a committed duplicate mints a
    // new revision, which strands whatever an editor open over *any* snippet of
    // the file has not saved. The fact is a boolean the coordinator supplies — a
    // `{document,node}` pair could not be followed across a reparse, which is
    // the recorded hole `moveEligibility`'s narrower rule carries and this one
    // designs out. **It is "open", never "dirty"** (R36): nothing outside
    // `MatchEditor.svelte` can see `isDirty`, so the honest question is the
    // wider one and the refusal's sentence claims no more than it asks.
    const document = file();
    expect(duplicationEligibility(document, document.matches[0]!, true)).toEqual({
      kind: 'refused',
      reason: 'unsavedDraftInDocument'
    });
    expect(duplicationEligibility(document, document.matches[0]!, false)).toEqual({
      kind: 'duplicable'
    });
  });

  it('answers the document-wide question from the drafts the coordinator holds', () => {
    // **The producer step 2 deliberately left missing** (`2c-3c-2-notes.md`
    // section 4, hole 3). Three claims: an empty list is `false` rather than a
    // caller's silence; a draft in **another** file does not refuse this one; and
    // a draft for a snippet that is not the source **does**, because a commit
    // strands every `MatchId` in the file rather than only the copied one.
    const inThisFile: MatchId = { document: 2, revision: BASE, node: 11 };
    const inAnotherFile: MatchId = { document: 3, revision: BASE, node: 10 };
    expect(documentHasUnsavedDraft(2, [])).toBe(false);
    expect(documentHasUnsavedDraft(2, [inAnotherFile])).toBe(false);
    expect(documentHasUnsavedDraft(2, [inThisFile])).toBe(true);
    expect(documentHasUnsavedDraft(2, [inAnotherFile, inThisFile])).toBe(true);
  });

  it('counts a draft minted over an earlier parse of the same file', () => {
    // **Only the file is compared, and that is the point.** A draft held over a
    // parse the window has replaced is stranded by the commit exactly as a
    // current one is, so comparing the whole identity would let the very draft
    // this rule protects slip through — and following a `{document, node}` pair
    // across a reparse is the hole the consult designed out by asking a wider
    // question (Q6).
    const stale: MatchId = { document: 2, revision: AFTER, node: 99 };
    expect(documentHasUnsavedDraft(2, [stale])).toBe(true);

    // And it really is the argument `duplicationEligibility` takes: the refusal
    // it produces is the document-wide one.
    const document = file();
    expect(
      duplicationEligibility(document, document.matches[0]!, documentHasUnsavedDraft(2, [stale]))
    ).toEqual({ kind: 'refused', reason: 'unsavedDraftInDocument' });
  });

  it('has a sentence for every refusal, in both languages', () => {
    const reasons: readonly DuplicationRefusal[] = [
      'readOnly',
      'notInDocument',
      'noSequencePosition',
      'unsavedDraftInDocument'
    ];
    for (const locale of LOCALES) {
      for (const reason of reasons) {
        expect(DICTIONARIES[locale][duplicationRefusalKey(reason)].length).toBeGreaterThan(0);
      }
    } // End of the loop over the two locales
  });
}); // End of the "eligibility" suite

describe('starting a duplicate', () => {
  it('produces the identity and the frozen base revision the command takes', () => {
    const opened = session(0);
    const started = beginDuplicate(opened, live(0), () => opened);
    expect(started).not.toBeNull();
    expect(started!.match).toEqual(live(0));
    expect(started!.submission.baseRevision).toBe(BASE);
    expect(started!.submission.acknowledgement).toEqual({ accepted: [] });
    expect(started!.session.phase).toBe('saving');
    expect(baseRevisionOf(opened)).toBe(BASE);
  });

  it('refuses when the live projection no longer gives that snippet this identity', () => {
    // The one argument that comes from outside the session, and the only one
    // that can notice a reprojection: the re-read file gives node 10 a new
    // revision, so all three fields no longer agree.
    const opened = session(0);
    expect(beginDuplicate(opened, identityInProjection([reread()], opened.match), () => opened)).toBeNull();
    expect(beginDuplicate(opened, null, () => opened)).toBeNull();
    // And the same rule, read from the view side: the refusal is `outOfDate`.
    expect(duplicationSubmissionRefusal(opened, [reread()])).toBe('outOfDate');
    expect(canDuplicate(opened, [reread()])).toBe(false);
  });

  it('produces nothing for a snippet that may not be duplicated', () => {
    const packaged = file({ kind: 'Package', readOnly: true });
    const opened = startMatchDuplication(packaged, packaged.matches[0]!, false);
    expect(beginDuplicate(opened, live(0, packaged), () => opened)).toBeNull();
    expect(duplicationSubmissionRefusal(opened, [packaged])).toBe('notDuplicable');
  });

  it('answers the stale session above the frozen ineligibility', () => {
    // **The rule matchMove's fourth pass earned, inherited as a rule**:
    // `eligibility` was frozen at the session's first parse, so once the
    // session is stale the definite claim about the snippet is the one that
    // may no longer be true, and the weaker `outOfDate` wins over it.
    const packaged = file({ kind: 'Package', readOnly: true });
    const opened = startMatchDuplication(packaged, packaged.matches[0]!, false);
    expect(duplicationSubmissionRefusal(opened, [packaged])).toBe('notDuplicable');
    const invalidated = duplicationRecoveryFailed(opened);
    expect(duplicationSubmissionRefusal(invalidated, [packaged])).toBe('outOfDate');
  });
}); // End of the "starting a duplicate" suite

describe('what comes back', () => {
  /**
   * A session with a duplicate already sent.
   *
   * @returns The waiting session.
   */
  function inFlight(): MatchDuplicationSession {
    return ((onHand) => beginDuplicate(onHand, live(0), () => onHand))(session(0))!.session;
  } // End of function inFlight()

  it('spends the session on a commit and keeps the identity the save answered', () => {
    const clone: MatchId = { document: 2, revision: AFTER, node: 31 };
    const done = ((onHand) => applyDuplication(onHand, saved(true, clone), ADOPTED, () => onHand))(inFlight());
    const view = matchDuplicationView(done, HELD);
    expect(view.duplicated).toBe(true);
    expect(view.spent).toBe(true);
    expect(view.landed).toEqual(clone);
    expect(view.duplicating).toBe(false);
    expect(view.messages.map((message) => message.kind)).toEqual(['fileWritten']);
    expect(beginDuplicate(done, live(0), () => done)).toBeNull();
  });

  it('holds the committed arm even when the clone could not be identified', () => {
    // `moved: null` on a commit is legal, and it means only that the clone
    // could not be identified in the read that followed the write — the causes
    // are not enumerable from here (the file may have changed again, or that
    // read may have failed; the Rust boundary test produces this very answer
    // with no second writer at all). The session is spent exactly as it is for
    // an identified clone; only `landed` differs, and a screen has to be able
    // to draw that case.
    const done = ((onHand) => applyDuplication(onHand, saved(true, null), ADOPTED, () => onHand))(inFlight());
    expect(done.duplicated).toBe(true);
    expect(done.landed).toBeNull();
    expect(matchDuplicationView(done, HELD).spent).toBe(true);
  });

  it('spends nothing when the save committed nothing and owed no adoption', () => {
    // Practically unreachable for an insertion — a duplicate always changes the
    // document — and the arm is honest rather than hopeful (consult Q6: a
    // `committed: false` with no adoption owed spends nothing, even if
    // insertion makes that arm practically unreachable).
    const done = ((onHand) => applyDuplication(onHand, saved(false, null, BASE), NOT_OWED, () => onHand))(inFlight());
    expect(done.duplicated).toBe(false);
    expect(done.invalidated).toBe(false);
    const view = matchDuplicationView(done, HELD);
    expect(view.spent).toBe(false);
    expect(view.canDuplicate).toBe(true);
    expect(beginDuplicate(done, live(0), () => done)).not.toBeNull();
  });

  it('spends the session when a `committed: false` owed an adoption anyway', () => {
    // The wrapper adopts on `committed || revision !== view.revision`, so a
    // save that wrote nothing and ended on a revision this window was not
    // projecting re-reads the file — and every identity here was minted from
    // the parse that re-read replaced. The session must stop offering the
    // duplicate **without** claiming one committed.
    const done = ((onHand) => applyDuplication(onHand, saved(false, null, AFTER), ADOPTED, () => onHand))(inFlight());
    expect(done.duplicated).toBe(false);
    expect(done.invalidated).toBe(true);
    const view = matchDuplicationView(done, [reread()]);
    expect(view.duplicated).toBe(false);
    expect(view.spent).toBe(true);
    expect(view.cannotDuplicate).toBe('outOfDate');
    expect(beginDuplicate(done, identityInProjection([reread()], done.match), () => done)).toBeNull();
  });

  it('does not spend the session on a conflict, whose adoption is always `notOwed`', () => {
    // **The consult's Q2, and this case said the opposite until 2c-4a-2.**
    // `BrowserState.duplicateMatch` then installed the projection a conflict
    // carries on `disk` — replacing every identity this session held — while
    // reporting `adoption: notOwed`, so the arm had to be the evidence. It
    // installs nothing now, exactly as `applyMove` no longer derives it.
    const conflicted = ((onHand) => applyDuplication(onHand, CONFLICT, NOT_OWED, () => onHand))(inFlight());
    expect(conflicted.duplicated).toBe(false);
    expect(conflicted.invalidated).toBe(false);
    expect(conflictOf(conflicted)).not.toBeNull();
    expect(duplicationSubmissionRefusal(conflicted, HELD)).toBe('conflict');
    // Two, since 2c-4a-3b flipped `offersReload`: the non-destructive way out and
    // the first step of the reload. Never a copy — a `MatchId` is a protocol
    // carrier, and `conflictChoicesFor` refuses one whatever this surface declares.
    expect(matchDuplicationView(conflicted, HELD).conflictChoices).toEqual([
      'keepEditing',
      'keepMyDraft',
      'reloadDiskVersion'
    ]);
    expect(matchDuplicationView(conflicted, HELD).conflictOperation).toBe(
      'duplicateSnippet'
    );
    // Dismissing the panel gives the session back, against the projection this
    // window still holds. What has not changed is the file: a resend carries the
    // frozen base revision, which the command refuses. Nothing here sends one, so
    // this says nothing about which refusal — see this module's header.
    const dismissed = dismissDuplicationOutcome(conflicted);
    expect(conflictOf(dismissed)).toBeNull();
    expect(duplicationSubmissionRefusal(dismissed, HELD)).toBeNull();
    expect(matchDuplicationView(dismissed, HELD).spent).toBe(false);
    expect(beginDuplicate(dismissed, live(0), () => dismissed)).not.toBeNull();
    // A window that really has adopted the disk side is the live check's question,
    // and it still answers it.
    expect(duplicationSubmissionRefusal(dismissed, [CONFLICT.disk])).toBe('outOfDate');
    expect(
      beginDuplicate(dismissed, identityInProjection([CONFLICT.disk], dismissed.match), () => dismissed)
    ).toBeNull();
  });

  it('invalidates an arm that is not `saved` when the adoption was owed anyway', () => {
    // A structural guard, `matchMove.test.ts`'s: the wrapper owes an adoption
    // only on the `saved` arm, so `refused` beside `done` is not an answer it
    // gives — what this pins is the shape of the rule, so that moving the
    // `adoption.kind !== 'notOwed'` check inside the saved branch cannot drop
    // the guarantee silently.
    const refused = ((onHand) => applyDuplication(onHand, REFUSED, ADOPTED, () => onHand))(inFlight());
    expect(refused.duplicated).toBe(false);
    expect(refused.invalidated).toBe(true);
    expect(matchDuplicationView(refused, HELD).spent).toBe(true);
    expect(((onHand) => applyDuplication(onHand, REFUSED, NOT_ADOPTED, () => onHand))(inFlight()).invalidated).toBe(true);
  });

  it('puts the out-of-step line beside a commit whose adoption failed', () => {
    const done = ((onHand) => applyDuplication(onHand, saved(), NOT_ADOPTED, () => onHand))(inFlight());
    // Beside the saved arm, never in place of it: the clone really is in the
    // file, and telling the person the duplicate failed would invite a retry
    // of a write that already happened (`PROGRESS.md` D2).
    expect(matchDuplicationView(done, HELD).messages.map((message) => message.kind)).toEqual([
      'fileWritten',
      'windowOutOfStep'
    ]);
    expect(matchDuplicationView(done, HELD).duplicated).toBe(true);
    expect(done.invalidated).toBe(true);
  });

  it('carries the trigger finding and the consent that answers it — the ordinary path', () => {
    // **Refuse-then-acknowledge is this operation's ordinary path, not its
    // exceptional one**: a byte-exact copy keeps its source's trigger
    // definition, and the transaction says so on the first attempt with a
    // finding bound to the candidate by its revision operand.
    const refused = ((onHand) => applyDuplication(onHand, REFUSED, NOT_OWED, () => onHand))(inFlight());
    const view = matchDuplicationView(refused, HELD);
    expect(view.outcome?.kind).toBe('refused');
    expect(view.refusalChoices).toEqual(['saveAnyway', 'keepEditing']);
    expect(view.duplicated).toBe(false);
    expect(view.spent).toBe(false);

    const consented = acknowledgeDuplicationFindings(refused);
    const again = beginDuplicate(consented, live(0), () => consented);
    expect(again).not.toBeNull();
    expect(again!.submission.acknowledgement).toEqual({ accepted: [TRIGGER_KEPT] });
    expect(again!.submission.baseRevision).toBe(BASE);
  });

  it('records a send that produced no outcome, in its two arms', () => {
    const notSent = ((onHand) => duplicationCouldNotBeSent(onHand, false, null, () => onHand))(inFlight());
    expect(notSent.sendFailure).toEqual({ kind: 'notSent', reason: null });
    expect(notSent.duplicated).toBe(false);
    // A failure before the rename really did write nothing, so the session is
    // not spent and the same duplicate may be sent again.
    expect(notSent.mayHaveWritten).toBe(false);
    expect(canDuplicate(notSent, HELD)).toBe(true);
    const failure: IpcFailure = { kind: 'command', error: { code: 'noWorkspaceOpen' } };
    const maybe = ((onHand) => duplicationCouldNotBeSent(onHand, true, failure, () => onHand))(inFlight());
    expect(maybe.sendFailure).toEqual({ kind: 'mayHaveWritten', reason: failure });
    expect(matchDuplicationView(maybe, HELD).failureLines).toEqual([{ kind: 'failure', failure }]);
  });

  it('spends the session when the send may already have written the file', () => {
    const maybe = ((onHand) => duplicationCouldNotBeSent(onHand, true, UNCERTAIN, () => onHand))(inFlight());
    expect(maybe.mayHaveWritten).toBe(true);
    // Nothing is offered beside it, and that is not an omission: `saveFailed`
    // is the only code the flag comes from and it is not one of the four a
    // re-read is offered for.
    expect(matchDuplicationView(maybe, HELD).recovery).toEqual([]);
    // Whether or not the wrapper's cautious re-read then succeeded, the reason
    // is `mayHaveWritten` and never `outOfDate`, whose sentence would claim
    // *this duplicate wrote nothing* — the one claim this session has just
    // disclaimed.
    expect(duplicationSubmissionRefusal(maybe, HELD)).toBe('mayHaveWritten');
    expect(duplicationSubmissionRefusal(maybe, [reread()])).toBe('mayHaveWritten');
    expect(beginDuplicate(maybe, live(0), () => maybe)).toBeNull();
    expect(matchDuplicationView(maybe, HELD).spent).toBe(true);
    // Putting the panel away does not hand the session back: the message is
    // cleared, the flag is not.
    const dismissed = dismissDuplicationOutcome(maybe);
    expect(dismissed.sendFailure).toBeNull();
    expect(dismissed.mayHaveWritten).toBe(true);
    expect(duplicationSubmissionRefusal(dismissed, HELD)).toBe('mayHaveWritten');
  }); // End of the "may have written" case

  it('offers a re-read for the four failures that say this window disagrees with the file', () => {
    // The consult's Q8, with the duplicate's own command code in place of the
    // move's: a typed command failure carries no findings, so there is nothing
    // to accept and the honest offer is a re-read.
    const codes = [
      'duplicateSourceNotASequenceItem',
      'identityStaleRevision',
      'identityNoSuchMatch',
      'identityWrongDocument'
    ] as const;
    const failures: readonly IpcFailure[] = [
      { kind: 'command', error: { code: 'duplicateSourceNotASequenceItem' } },
      { kind: 'command', error: { code: 'identityStaleRevision', expected: BASE, found: AFTER } },
      { kind: 'command', error: { code: 'identityNoSuchMatch', node: 10 } },
      { kind: 'command', error: { code: 'identityWrongDocument', expected: 2, found: 3 } }
    ];
    expect(failures.map((one) => (one.kind === 'command' ? one.error.code : null))).toEqual(codes);
    for (const failure of failures) {
      expect(duplicationRecoveryChoices(failure)).toEqual(['reloadFile']);
      expect(
        matchDuplicationView(((onHand) => duplicationCouldNotBeSent(onHand, false, failure, () => onHand))(inFlight()), HELD).recovery
      ).toEqual(['reloadFile']);
    } // End of the loop over the four codes a re-read is offered for

    // And nothing for a failure a re-read cannot help with — including the
    // move's own code, which this command never raises.
    expect(
      duplicationRecoveryChoices({ kind: 'command', error: { code: 'noWorkspaceOpen' } })
    ).toEqual([]);
    expect(
      duplicationRecoveryChoices({ kind: 'command', error: { code: 'moveNotWithinOneSequence' } })
    ).toEqual([]);
    expect(duplicationRecoveryChoices({ kind: 'unexpected' })).toEqual([]);
    expect(duplicationRecoveryChoices(null)).toEqual([]);
    for (const locale of LOCALES) {
      expect(DICTIONARIES[locale][duplicationRecoveryKey('reloadFile')].length).toBeGreaterThan(0);
    } // End of the loop over the two locales
  });

  it('spends the session when the recovery re-read could not reach the file', () => {
    const disputed: IpcFailure = {
      kind: 'command',
      error: { code: 'identityStaleRevision', expected: AFTER, found: BASE }
    };
    const refused = ((onHand) => duplicationCouldNotBeSent(onHand, false, disputed, () => onHand))(inFlight());
    // Before the recovery is attempted the session is live and sendable:
    // nothing was written, so a retry is a legitimate thing to offer.
    expect(matchDuplicationView(refused, HELD).recovery).toEqual(['reloadFile']);
    expect(duplicationSubmissionRefusal(refused, HELD)).toBeNull();

    const spent = duplicationRecoveryFailed(refused);

    expect(spent.invalidated).toBe(true);
    // And nothing else is claimed: a failed read is not a write, and it is not
    // a write this application cannot account for either.
    expect(spent.duplicated).toBe(false);
    expect(spent.mayHaveWritten).toBe(false);
    expect(duplicationSubmissionRefusal(spent, HELD)).toBe('outOfDate');
    expect(matchDuplicationView(spent, HELD).spent).toBe(true);
    expect(beginDuplicate(spent, identityInProjection(HELD, spent.match), () => spent)).toBeNull();
    expect(dismissDuplicationOutcome(spent).invalidated).toBe(true);
  }); // End of the "failed recovery re-read" case

  it('ignores an answer nothing was waiting for', () => {
    const clean = session(0);
    expect(applyDuplication(clean, saved(), ADOPTED, () => clean)).toBe(clean);
  });

  it('never takes a commit or an invalidation back', () => {
    // Both flags are or-ed into rather than assigned, so "cleared by nothing"
    // is what the code does and not only what the reachable transitions allow.
    const committed = ((onHand) => applyDuplication(onHand, saved(), ADOPTED, () => onHand))(inFlight());
    const again = applyDuplication(committed, saved(false, null, BASE), NOT_OWED, () => committed);
    expect(again.duplicated).toBe(true);
    expect(again.invalidated).toBe(true);
  });
}); // End of the "what comes back" suite

describe('the refusal precedence — the arm that claims less wins', () => {
  /**
   * A session with a duplicate already sent.
   *
   * @returns The waiting session.
   */
  function inFlight(): MatchDuplicationSession {
    return ((onHand) => beginDuplicate(onHand, live(0), () => onHand))(session(0))!.session;
  } // End of function inFlight()

  it('answers the uncertain send ahead of the commit, in both orders', () => {
    // `mayHaveWritten` and `alreadyDuplicated` — the adjacent pair at the top
    // of the order, and the reason the order is a rule: a definite *this
    // snippet has been copied* beside a send failure disclaiming exactly that
    // is the arrangement the precedence forbids.
    const committed = ((onHand) => applyDuplication(onHand, saved(), ADOPTED, () => onHand))(inFlight());
    expect(duplicationSubmissionRefusal(committed, HELD)).toBe('alreadyDuplicated');
    const afterwards = duplicationCouldNotBeSent(committed, true, UNCERTAIN, () => committed);
    expect(afterwards.duplicated).toBe(true);
    expect(afterwards.mayHaveWritten).toBe(true);
    expect(duplicationSubmissionRefusal(afterwards, HELD)).toBe('mayHaveWritten');
    // The other order, because which answer arrives first is the caller's.
    const beforehand = ((onHand) => applyDuplication(
      onHand,
      saved(),
      ADOPTED, () => onHand
    ))(((onHand) => duplicationCouldNotBeSent(onHand, true, UNCERTAIN, () => onHand))(inFlight()));
    expect(beforehand.duplicated).toBe(true);
    expect(beforehand.mayHaveWritten).toBe(true);
    expect(duplicationSubmissionRefusal(beforehand, HELD)).toBe('mayHaveWritten');
  });

  it('answers the commit ahead of the flight', () => {
    // `alreadyDuplicated` and `saveInFlight` — adjacent in the order. No
    // transition here re-enters `saving` on a committed session, so the pair
    // is constructed: `MatchDuplicationSession` is a structural interface with
    // no brand, and what this pins is the order of the checks, not a reachable
    // history.
    const both: MatchDuplicationSession = {
      ...((onHand) => applyDuplication(onHand, saved(), ADOPTED, () => onHand))(inFlight()),
      phase: 'saving'
    };
    expect(duplicationSubmissionRefusal(both, HELD)).toBe('alreadyDuplicated');
  });

  it('answers the flight ahead of the conflict', () => {
    // `saveInFlight` and `conflict` — adjacent in the order. A conflict answer
    // always ends the flight, so the pair is constructed for the same stated
    // reason as above.
    const conflicted = ((onHand) => applyDuplication(onHand, CONFLICT, NOT_OWED, () => onHand))(inFlight());
    const both: MatchDuplicationSession = { ...conflicted, phase: 'saving' };
    expect(duplicationSubmissionRefusal(both, [CONFLICT.disk])).toBe('saveInFlight');
  });

  it('answers the conflict ahead of a staleness it no longer causes', () => {
    // `conflict` and `outOfDate` — adjacent in the order. Since 2c-4a-2 a conflict
    // does not set `invalidated`, so the pair is constructed by handing the live
    // check a projection the window really did move to: while the panel is up the
    // person is told about the conflict, not about staleness.
    const conflicted = ((onHand) => applyDuplication(onHand, CONFLICT, NOT_OWED, () => onHand))(inFlight());
    expect(conflicted.invalidated).toBe(false);
    expect(duplicationSubmissionRefusal(conflicted, [CONFLICT.disk])).toBe('conflict');
    expect(
      duplicationSubmissionRefusal(dismissDuplicationOutcome(conflicted), [CONFLICT.disk])
    ).toBe('outOfDate');
  });

  it('answers the staleness ahead of the frozen ineligibility', () => {
    // `outOfDate` and `notDuplicable` — the last adjacent pair. Frozen
    // eligibility is a definite claim read off a parse that is gone, so the
    // weaker claim wins once the session is stale.
    const packaged = file({ kind: 'Package', readOnly: true });
    const opened = startMatchDuplication(packaged, packaged.matches[0]!, false);
    expect(duplicationSubmissionRefusal(opened, [packaged])).toBe('notDuplicable');
    expect(duplicationSubmissionRefusal(duplicationRecoveryFailed(opened), [packaged])).toBe(
      'outOfDate'
    );
    // And the live check reaches the same arm without the flag: a session whose
    // projections moved on is `outOfDate` before it is `notDuplicable`.
    expect(duplicationSubmissionRefusal(opened, [reread({ kind: 'Package', readOnly: true })])).toBe(
      'outOfDate'
    );
  });
}); // End of the "refusal precedence" suite

describe('the view a screen draws', () => {
  it('answers everything a control needs, derived on every read', () => {
    const view = matchDuplicationView(session(0), HELD);
    expect(view.match).toEqual(live(0));
    expect(view.document).toBe(2);
    expect(view.canDuplicate).toBe(true);
    expect(view.notDuplicableToShow).toBeNull();
    expect(view.cannotDuplicate).toBeNull();
    expect(view.duplicating).toBe(false);
    expect(view.duplicated).toBe(false);
    expect(view.spent).toBe(false);
    expect(view.landed).toBeNull();
    expect(view.outcome).toBeNull();
    expect(view.recovery).toEqual([]);
    expect(view.notes).toEqual([]);
    expect(view.conflict).toBeNull();
  });

  it('names both refusals separately, because they answer different questions', () => {
    const packaged = file({ kind: 'Package', readOnly: true });
    const view = matchDuplicationView(
      startMatchDuplication(packaged, packaged.matches[0]!, false),
      [packaged]
    );
    expect(view.canDuplicate).toBe(false);
    expect(view.notDuplicableToShow).toBe('readOnly');
    expect(view.cannotDuplicate).toBe('notDuplicable');
  });

  it('withholds the frozen reason once the weaker live claim has won', () => {
    // **Step 3's Medium finding, closed in the model.** A panel opened over a
    // read-only projection and then left standing while the window reads the
    // file again is both `readOnly` — frozen, definite, and about a parse that
    // is gone — and `outOfDate`, which is live and claims less. `refusalGiven`
    // ranks them, and until this was fixed the ranking was undone by the view
    // handing the frozen reason out anyway: the only thing keeping the two
    // apart was a condition in `MatchDuplicator.svelte` — decision logic no
    // model test like this one can drive, and logic a second renderer or a
    // markup refactor could omit while walking the model faithfully.
    // `MatchDuplicator.test.ts` mounts that panel and asserts both rendered
    // halves; what this case owns is the decision itself.
    const packaged = file({ kind: 'Package', readOnly: true });
    const opened = startMatchDuplication(packaged, packaged.matches[0]!, false);

    // Live: the frozen verdict *is* what disables the control, so it is
    // presented. This half is what makes the other half non-vacuous.
    const held = matchDuplicationView(opened, [packaged]);
    expect(held.cannotDuplicate).toBe('notDuplicable');
    expect(held.notDuplicableToShow).toBe('readOnly');

    // The same session, against the projection this window holds after a
    // re-read: one sentence, and it is the one that claims less.
    const stale = matchDuplicationView(opened, [reread({ kind: 'Package', readOnly: true })]);
    expect(stale.cannotDuplicate).toBe('outOfDate');
    expect(stale.notDuplicableToShow).toBeNull();
    expect(stale.canDuplicate).toBe(false);

    // And the fact itself is not lost — a caller that wants the frozen verdict
    // rather than the sentence still has it on the session.
    expect(opened.eligibility).toEqual({ kind: 'refused', reason: 'readOnly' });
  }); // End of the "frozen reason withheld" case

  it('withholds it for the flag-borne staleness too, not only for a replaced projection', () => {
    // The other way into `outOfDate`: a recovery re-read that failed leaves the
    // projection installed and spends the session through `invalidated`. The
    // suppression is a rule about the *refusal that won*, so it does not care
    // which of the two produced it.
    const packaged = file({ kind: 'Package', readOnly: true });
    const opened = duplicationRecoveryFailed(
      startMatchDuplication(packaged, packaged.matches[0]!, false)
    );
    const view = matchDuplicationView(opened, [packaged]);
    expect(view.cannotDuplicate).toBe('outOfDate');
    expect(view.notDuplicableToShow).toBeNull();
  }); // End of the "flag-borne staleness" case

  it('carries whatever presentation notes the save reported, unchanged', () => {
    // A duplicate produces none today, and that is read off the core rather
    // than assumed; the field is carried so a note the core learns to emit is
    // drawn rather than dropped — which is what this drives, because asserting
    // `[]` against an empty answer would pass with the field hard-coded.
    const note: PresentationNote = {
      ScalarRestyled: { edit: 0, from: 'Plain', to: 'SingleQuoted', reason: null }
    };
    const started = ((onHand) => beginDuplicate(onHand, live(0), () => onHand))(session(0));
    const done = applyDuplication(started!.session, saved(true, null, AFTER, [note]), ADOPTED, () => started!.session);
    expect(matchDuplicationView(done, HELD).notes).toEqual([note]);
    const quiet = applyDuplication(started!.session, saved(), ADOPTED, () => started!.session);
    expect(matchDuplicationView(quiet, HELD).notes).toEqual([]);
  });

  it('has a sentence for every submission refusal, in both languages', () => {
    const reasons: readonly DuplicationSubmissionRefusal[] = [
      'mayHaveWritten',
      'alreadyDuplicated',
      'saveInFlight',
      'externalConflict',
      'conflict',
      'observationRetained',
      'outOfDate',
      'notDuplicable'
    ];
    for (const locale of LOCALES) {
      for (const reason of reasons) {
        expect(
          DICTIONARIES[locale][duplicationSubmissionRefusalKey(reason)].length
        ).toBeGreaterThan(0);
      }
    } // End of the loop over the two locales
  });
}); // End of the "view" suite

describe('the identities a session holds', () => {
  it('are plain copies, because the draft snapshots them through structuredClone', () => {
    // Found by the mounted test of 2c-3a-2, not by a model test: a screen reads
    // its snippet out of `BrowserState.views`, which is `$state` and therefore
    // deeply proxied, and `structuredClone` **throws** on a proxy. What a model
    // test can check is that nothing here is the projection's own object.
    const document = file();
    const held = startMatchDuplication(document, document.matches[0]!, false);
    expect(held.match).toEqual(document.matches[0]!.id);
    expect(held.match).not.toBe(document.matches[0]!.id);
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
   * A conflicted duplicate of a live session.
   *
   * @returns The session showing the conflict.
   */
  function conflicted(): MatchDuplicationSession {
    const started = ((onHand) => beginDuplicate(onHand, live(0), () => onHand))(session(0));
    if (started === null) {
      throw new Error('a live session is sendable');
    }
    return applyDuplication(started.session, CONFLICT, NOT_OWED, () => started.session);
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
    expect(matchDuplicationView(asked, HELD).awaitingReloadConfirmation).toBe(true);
    // The warning alone is not a confirmation either.
    expect(reloadTheDiskVersion(asked, recorder.adopt, () => asked)).toBe(asked);
    expect(recorder.adoptions).toEqual([]);
    expect(matchDuplicationView(asked, HELD).closed).toBe(false);
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
    expect(matchDuplicationView(after, HELD).closed).toBe(true);
    expect(conflictOf(after)).toBeNull();
    expect(canDuplicate(after, HELD)).toBe(false);
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
    expect(matchDuplicationView(after, HELD).reloadUnavailable).toBe(true);
    expect(matchDuplicationView(after, HELD).awaitingReloadConfirmation).toBe(false);
    expect(matchDuplicationView(after, HELD).conflictChoices).not.toContain('confirmReload');
    expect(matchDuplicationView(after, HELD).conflictChoices).not.toContain('reloadDiskVersion');
    expect(matchDuplicationView(after, HELD).conflictChoices).toContain('keepEditing');
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
    expect(matchDuplicationView(conflict, HELD).conflictChoices).toEqual<readonly ConflictChoice[]>(
      ['keepEditing', 'keepMyDraft', 'reloadDiskVersion']
    );
    expect(matchDuplicationView(conflict, HELD).awaitingReloadConfirmation).toBe(false);

    const asked = askToReloadDiskVersion(conflict);
    expect(matchDuplicationView(asked, HELD).conflictChoices).toEqual<readonly ConflictChoice[]>([
      'keepEditing',
      'keepMyDraft',
      'confirmReload'
    ]);
    expect(matchDuplicationView(asked, HELD).awaitingReloadConfirmation).toBe(true);
    // And still no copy: the Q4 rule is about what this draft *is*.
    expect(matchDuplicationView(asked, HELD).conflictChoices).not.toContain('copyDraft');
  }); // End of the "two-step reload is offered" case

  it('forgets a confirmation when the panel is dismissed or a new answer arrives', () => {
    // A confirmation is a person's answer to **one** conflict. Reaching the
    // confirmed step and then dismissing must not leave it spendable.
    const recorder = adopting();
    const confirmed = confirmDiskReload(askToReloadDiskVersion(conflicted()));
    const dismissed = dismissDuplicationOutcome(confirmed);
    expect(dismissed.reload.kind).toBe('idle');
    expect(reloadTheDiskVersion(dismissed, recorder.adopt, () => dismissed)).toBe(dismissed);
    expect(recorder.adoptions).toEqual([]);
  }); // End of the "dismissal forgets the confirmation" case
}); // End of the "confirmed reload" suite

describe('reapplying the retained duplication', () => {
  // **2c-4b-2 builds this and 2c-4b-3 draws it.** `ConflictChoice` has no member
  // for a reapply, so nothing here is reachable from a control; every case calls
  // the transition directly.

  /**
   * A conflicted duplicate whose payload carries chosen correspondence evidence.
   *
   * @param subject - What the search for this snippet answered.
   * @param disk - The newly parsed projection the conflict carries.
   * @returns The session showing the conflict.
   */
  function conflictedOver(
    subject: ReapplyResolution,
    disk: DocumentView = reread()
  ): MatchDuplicationSession {
    const started = ((onHand) => beginDuplicate(onHand, live(0), () => onHand))(session(0));
    if (started === null) {
      throw new Error('a fresh session is duplicable');
    }
    return applyDuplication(
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

  it('re-opens the duplicate over the identified snippet, with no consent carried', () => {
    // **The old acknowledgement cannot cross.** `DuplicateKeepsTriggerDefinition`
    // is content-addressed to the candidate's own revision, so consent collected
    // before the conflict describes bytes that are gone: the rebuilt session
    // carries none and the refuse-then-acknowledge round starts again.
    const disk = reread();
    const target = disk.matches[0]!;
    const stuck = conflictedOver({ Identified: { target } }, disk);
    const recorder = adoptingReapply();
    const answer = reapplyToDiskVersion(stuck, false, recorder.adopt, null, () => stuck);
    expect(answer.kind).toBe('reapplied');
    if (answer.kind !== 'reapplied') {
      throw new Error('this case is about the rebuilt session');
    }
    expect(answer.session.match).toEqual(target.id);
    expect(baseRevisionOf(answer.session)).toBe(AFTER);
    expect(answer.session.draft.consent).toBeNull();
    expect(answer.session.duplicated).toBe(false);
    expect(answer.session.invalidated).toBe(false);
    expect(beginDuplicate(answer.session, live(0, disk), () => answer.session)).not.toBeNull();
    expect(recorder.adoptions).toEqual([conflictOf(stuck)]);
  });

  it('refuses a correspondence the core would not establish, and adopts nothing', () => {
    const recorder = adoptingReapply();
    expect(
      ((onHand) => reapplyToDiskVersion(
        onHand,
        false,
        recorder.adopt, null, () => onHand
      ))(conflictedOver({ Refused: { reason: 'AmbiguousExact' } }))
    ).toEqual({
      kind: 'manualResolution',
      obstacle: { kind: 'correspondence', reason: 'AmbiguousExact' }
    });
    expect(recorder.adoptions).toEqual([]);
  });

  it('refuses evidence that names no snippet, and adopts nothing', () => {
    const recorder = adoptingReapply();
    expect(
      ((onHand) => reapplyToDiskVersion(onHand, false, recorder.adopt, null, () => onHand))(conflictedOver({ Targetless: {} }))
    ).toEqual({
      kind: 'manualResolution',
      obstacle: { kind: 'evidenceNotATarget' }
    });
    expect(recorder.adoptions).toEqual([]);
  });

  it('asks the open-editor question again, about this window now', () => {
    // The answer is about the window at the moment of the reapply, not about the
    // parse that was replaced — and it says *an editor is open*, never *there are
    // unsaved edits*, because no coordinator can see a component-local `isDirty`.
    const disk = reread();
    const recorder = adoptingReapply();
    expect(
      ((onHand) => reapplyToDiskVersion(
        onHand,
        true,
        recorder.adopt, null, () => onHand
      ))(conflictedOver({ Identified: { target: disk.matches[0]! } }, disk))
    ).toEqual({
      kind: 'manualResolution',
      obstacle: { kind: 'notDuplicable', reason: 'unsavedDraftInDocument' }
    });
    expect(recorder.adoptions).toEqual([]);
  });

  it('rechecks eligibility over the new parse', () => {
    const disk = reread({ readOnly: true });
    const recorder = adoptingReapply();
    expect(
      ((onHand) => reapplyToDiskVersion(
        onHand,
        false,
        recorder.adopt, null, () => onHand
      ))(conflictedOver({ Identified: { target: disk.matches[0]! } }, disk))
    ).toEqual({
      kind: 'manualResolution',
      obstacle: { kind: 'notDuplicable', reason: 'readOnly' }
    });
    expect(recorder.adoptions).toEqual([]);
  });

  it('reports the window refusal and rebuilds nothing', () => {
    const disk = reread();
    const recorder = adoptingReapply('refused');
    expect(
      ((onHand) => reapplyToDiskVersion(
        onHand,
        false,
        recorder.adopt, null, () => onHand
      ))(conflictedOver({ Identified: { target: disk.matches[0]! } }, disk))
    ).toEqual({ kind: 'adoptionRefused' });
    expect(recorder.adoptions).toHaveLength(1);
  });

  it('is not attempted when no conflict is showing', () => {
    const recorder = adoptingReapply();
    expect(((onHand) => reapplyToDiskVersion(onHand, false, recorder.adopt, null, () => onHand))(session(0))).toEqual({
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
   * The file as another writer left it: the same two snippets under a new
   * parse, plus a third, each an item of the list.
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
        makeMatch({ node: 30, document: 2, revision: AFTER, trigger: ':sig', path: matchListPath(0) }),
        makeMatch({ node: 31, document: 2, revision: AFTER, trigger: ':date', path: matchListPath(1) }),
        makeMatch({ node: 32, document: 2, revision: AFTER, trigger: ':theirs', path: matchListPath(2) })
      ],
      ...overrides
    });
  } // End of function diskFile()

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
  function externalOf(held: MatchDuplicationSession): ExternalConflictModel<MatchId> {
    const conflict = held.externalConflict;
    if (conflict === null) {
      throw new Error('this case needs an external conflict on the session');
    }
    return conflict;
  } // End of function externalOf()

  /**
   * A session whose duplicate is in flight.
   *
   * @returns The waiting session.
   */
  function inFlight(): MatchDuplicationSession {
    const started = ((onHand) => beginDuplicate(onHand, live(), () => onHand))(session());
    if (started === null) {
      throw new Error('a fresh session is sendable');
    }
    return started.session;
  } // End of function inFlight()

  /**
   * A session whose duplicate met a save conflict — the save origin.
   *
   * @returns The session showing the save conflict.
   */
  function saveConflicted(): MatchDuplicationSession {
    return ((onHand) => applyDuplication(onHand, CONFLICT, NOT_OWED, () => onHand))(inFlight());
  } // End of function saveConflicted()

  /**
   * A session whose duplicate was refused for the trigger finding — the
   * ordinary first answer.
   *
   * @returns The session showing the refusal.
   */
  function refusedOnce(): MatchDuplicationSession {
    return ((onHand) => applyDuplication(onHand, REFUSED, NOT_OWED, () => onHand))(inFlight());
  } // End of function refusedOnce()

  describe('the seven arms over a session opened over one file (entries 6, 8, 11, 12)', () => {
    it('raises over the file, refuses the send with a code of its own, and spends nothing', () => {
      const seen = observation();
      const next = applyDuplicationObservation(session(), raised(seen));
      const conflict = externalOf(next);
      expect(conflict.source).toBe(externalConflictSource(seen));
      expect(conflict.draft).toBe(next.draft);
      expect(conflict.diskText).toBe(THEIRS);
      expect(isExternalConflict(conflict)).toBe(true);
      expect(conflictOf(next)).toBe(conflict);
      // `outcome` is untouched: no duplicate ended (entry 6).
      expect(next.outcome).toBeNull();
      // The refusal has a code of its own, whose sentence is the external origin's
      // first line and never *while this duplicate was being sent*.
      expect(duplicationSubmissionRefusal(next, HELD)).toBe('externalConflict');
      expect(duplicationSubmissionRefusalKey('externalConflict')).toBe('browser.externalConflict.fileChangedWhileOpen');
      expect(canDuplicate(next, HELD)).toBe(false);
      expect(beginDuplicate(next, live(), () => next)).toBeNull();
      // Nothing is spent: the identities are still the ones the window projects.
      expect(next.invalidated).toBe(false);
      expect(next.duplicated).toBe(false);
      const view = matchDuplicationView(next, HELD);
      expect(view.canDuplicate).toBe(false);
      expect(view.cannotDuplicate).toBe('externalConflict');
      expect(view.spent).toBe(false);
      expect(view.notDuplicableToShow).toBeNull();
      expect(view.conflict).toBe(conflict);
      expect(view.externalMessages).toBe(conflict.messages);
      expect(view.externalMessages[0]).toEqual({ kind: 'fileChangedWhileOpen' });
      expect(view.messages).toEqual([]);
      expect(view.externalNotices).toEqual([]);
      expect(view.conflictOperation).toBe('duplicateSnippet');
      expect(view.conflictChoices).toEqual<readonly ConflictChoice[]>([
        'keepEditing',
        'keepMyDraft',
        'reloadDiskVersion'
      ]);
    }); // End of the "raised over the file" case

    it('answers null from beginDuplicate called directly under an external conflict, refusal path included', () => {
      // **Past a disabled button.** The refusal panel's *Save anyway* would reach
      // `beginDuplicate` with consent recorded; the model refuses at the same
      // rule the view asks, and the view withholds the offer.
      const blocked = applyDuplicationObservation(refusedOnce(), raised(observation()));
      expect(blocked.outcome?.kind).toBe('refused');
      expect(((onHand) => beginDuplicate(onHand, live(), () => onHand))(acknowledgeDuplicationFindings(blocked))).toBeNull();
      const view = matchDuplicationView(blocked, HELD);
      expect(view.refusalChoices).toEqual(['keepEditing']);
      expect(view.findingsAreStale).toBe(false);
    });

    it('ranks the external conflict where the save conflict sits, and the uncertain send above it', () => {
      // The rule `refusalGiven` states: the weakest true claim wins. A session
      // spent by a send it cannot account for says so before it says the file
      // changed; a stale session says the file changed before it says it is stale.
      const seen = observation();
      const uncertain = applyDuplicationObservation(
        ((onHand) => duplicationCouldNotBeSent(onHand, true, UNCERTAIN, () => onHand))(inFlight()),
        raised(seen)
      );
      expect(duplicationSubmissionRefusal(uncertain, HELD)).toBe('mayHaveWritten');
      const stale = applyDuplicationObservation(session(), raised(seen));
      expect(duplicationSubmissionRefusal(stale, [reread()])).toBe('externalConflict');
      const waiting = applyDuplicationObservation(session(), retainedDelivery(seen));
      expect(duplicationSubmissionRefusal(waiting, [reread()])).toBe('observationRetained');
    });

    it('takes nothing from a delivery about another file, except the end of a wait recorded for it', () => {
      const over = session();
      const elsewhere = otherObservation();
      expect(applyDuplicationObservation(over, raised(elsewhere))).toBe(over);
      expect(applyDuplicationObservation(over, retainedDelivery(elsewhere))).toBe(over);
      expect(applyDuplicationObservation(over, decided(null, elsewhere, true, 'raisedWithoutReload'))).toBe(over);
      const waiting: MatchDuplicationSession = { ...over, awaitingReconciliation: new Map([[3, elsewhere]]) };
      expect(applyDuplicationObservation(waiting, writtenHereDelivery(elsewhere)).awaitingReconciliation.size).toBe(0);
      expect(applyDuplicationObservation(waiting, raised(elsewhere))).toEqual({
        ...waiting,
        awaitingReconciliation: new Map()
      });
      expect(canDuplicate(waiting, HELD)).toBe(true);
    });

    it('takes nothing once closed', () => {
      const closed = ((onHand) => reloadTheDiskVersion(onHand, adopting().adopt, () => onHand))(confirmDiskReload(askToReloadDiskVersion(saveConflicted())));
      expect(closed.closed).toBe(true);
      expect(applyDuplicationObservation(closed, raised(observation()))).toBe(closed);
      expect(applyDuplicationObservation(closed, retainedDelivery(observation()))).toBe(closed);
    });
  }); // End of the "seven arms" suite

  describe('the held observation, and writtenHere by identity (entries 8 and 11)', () => {
    it('records a wait as a restriction on sending, and lifts it only for that observation', () => {
      const seen = observation();
      const waiting = applyDuplicationObservation(session(), retainedDelivery(seen));
      expect(waiting.awaitingReconciliation.get(2)).toBe(seen);
      expect(waiting.awaitingReconciliation.size).toBe(1);
      expect(waiting.externalConflict).toBeNull();
      expect(conflictOf(waiting)).toBeNull();
      expect(duplicationSubmissionRefusal(waiting, HELD)).toBe('observationRetained');
      expect(duplicationSubmissionRefusalKey('observationRetained')).toBe('browser.externalConflict.observationRetained');
      expect(beginDuplicate(waiting, live(), () => waiting)).toBeNull();
      const view = matchDuplicationView(waiting, HELD);
      expect(view.canDuplicate).toBe(false);
      expect(view.cannotDuplicate).toBe('observationRetained');
      expect(view.conflict).toBeNull();
      expect(view.externalNotices).toEqual([{ kind: 'observationRetained' }]);
      // Lifted by identity, and by nothing else.
      expect(applyDuplicationObservation(waiting, writtenHereDelivery(observation())).awaitingReconciliation.get(2)).toBe(seen);
      const lifted = applyDuplicationObservation(waiting, writtenHereDelivery(seen));
      expect(lifted).toEqual({ ...waiting, awaitingReconciliation: new Map() });
      expect(canDuplicate(lifted, HELD)).toBe(true);
      expect(applyDuplicationObservation(lifted, writtenHereDelivery(seen))).toBe(lifted);
      // Any decision about the awaited observation ends the wait; a later
      // `retained` replaces it; a re-held reading is still held.
      const standing = externalConflictSource(observation({ sequence: 9 }));
      expect(applyDuplicationObservation(waiting, decided(standing, seen, false, 'notLater'))).toEqual({
        ...waiting,
        awaitingReconciliation: new Map()
      });
      expect(
        applyDuplicationObservation(
          waiting,
          decided(externalConflictSource(observation({ sequence: 1 })), seen, false, 'coalesced')
        )
      ).toEqual({ ...waiting, awaitingReconciliation: new Map() });
      expect(applyDuplicationObservation(waiting, raised(seen)).awaitingReconciliation.size).toBe(0);
      const newer = observation({ sequence: 7 });
      expect(applyDuplicationObservation(waiting, retainedDelivery(newer)).awaitingReconciliation.get(2)).toBe(newer);
      expect(applyDuplicationObservation(waiting, retainedDelivery(seen)).awaitingReconciliation.get(2)).toBe(seen);
    }); // End of the "retained and writtenHere" case

    it('holds every delivery during its own duplicate and replays them in arrival order (entry 5)', () => {
      const started = inFlight();
      const seen = observation();
      const later = observation({ sequence: 6 });
      const standing = externalConflictSource(seen);
      const held = applyDuplicationObservation(
        applyDuplicationObservation(applyDuplicationObservation(started, retainedDelivery(seen)), raised(seen)),
        decided(standing, later, false, 'coalesced')
      );
      expect(held.externalConflict).toBeNull();
      expect(held.awaitingReconciliation.size).toBe(0);
      expect(held.heldDeliveries.map((one) => one.verdict.kind)).toEqual(['retained', 'raised', 'coalesced']);
      const settled = applyDuplication(held, REFUSED, NOT_OWED, () => held);
      expect(settled.heldDeliveries).toEqual([]);
      expect(settled.outcome?.kind).toBe('refused');
      expect(externalOf(settled).source).toBe(standing);
      expect(settled.awaitingReconciliation.size).toBe(0);
      expect(duplicationSubmissionRefusal(settled, HELD)).toBe('externalConflict');
      // The answer lands first and the replay has the last word, on a commit too.
      const committed = applyDuplication(held, saved(), ADOPTED, () => held);
      expect(committed.outcome?.kind).toBe('saved');
      expect(committed.duplicated).toBe(true);
      expect(externalOf(committed).source).toBe(standing);
      expect(duplicationSubmissionRefusal(committed, HELD)).toBe('alreadyDuplicated');
      // A duplicate that produced no outcome consumes the hold too.
      const heldUncertain = applyDuplicationObservation(started, decided(null, seen, true, 'raisedWithoutReload'));
      const failed = duplicationCouldNotBeSent(heldUncertain, true, UNCERTAIN, () => heldUncertain);
      expect(failed.heldDeliveries).toEqual([]);
      expect(failed.mayHaveWritten).toBe(true);
      expect(failed.uncertaintyUnresolved).toBe(true);
      expect(externalOf(failed).source).toBe(externalConflictSource(seen));
    }); // End of the "held during the duplicate" case
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
      const next = applyDuplicationObservation(confirmed, decided(saveModel.source, seen, false, 'supersedes'));
      expect(next.outcome).toBeNull();
      expect(next.submitted).toBeNull();
      const conflict = externalOf(next);
      expect(conflict.draft).toBe(saveModel.draft);
      expect(conflict.diskRevision).toBe('c'.repeat(64));
      expect(conflictOf(next)).toBe(conflict);
      expect(next.reload).toBe(NOT_RELOADING);
      expect(matchDuplicationView(next, HELD).awaitingReloadConfirmation).toBe(false);
      const recorder = adopting();
      expect(reloadTheDiskVersion(next, recorder.adopt, () => next)).toBe(next);
      expect(recorder.adoptions).toEqual([]);
      expect(reapplyToShow(attempt, next)).toBeNull();
    }); // End of the "supersedes a save conflict" case

    it('keeps a committed success and a refusal as history, and lets a duplicate that conflicts retire the external one', () => {
      const committed = ((onHand) => applyDuplication(onHand, saved(), ADOPTED, () => onHand))(inFlight());
      const overSaved = applyDuplicationObservation(committed, raised(observation()));
      expect(overSaved.outcome?.kind).toBe('saved');
      expect(overSaved.duplicated).toBe(true);
      expect(conflictOf(overSaved)).toBe(overSaved.externalConflict);
      // The weaker claim still wins beside the conflict: the session is spent.
      expect(duplicationSubmissionRefusal(overSaved, HELD)).toBe('alreadyDuplicated');
      const blocked = applyDuplicationObservation(refusedOnce(), raised(observation()));
      const conflicted = applyDuplication(blocked, CONFLICT, NOT_OWED, () => blocked);
      expect(conflicted.externalConflict).toBeNull();
      expect(conflictOf(conflicted)?.source.kind).toBe('save');
      const refusedAgain = applyDuplication(blocked, REFUSED, NOT_OWED, () => blocked);
      expect(refusedAgain.externalConflict).toBe(blocked.externalConflict);
    });

    it('lets the dismissal cancel the warning and the panel, and nothing external (entry 9)', () => {
      const seen = observation();
      const blocked = askToReloadDiskVersion(applyDuplicationObservation(refusedOnce(), raised(seen)));
      expect(matchDuplicationView(blocked, HELD).awaitingReloadConfirmation).toBe(true);
      const kept = dismissDuplicationOutcome(blocked);
      expect(kept.outcome).toBeNull();
      expect(kept.reload).toBe(NOT_RELOADING);
      expect(kept.externalConflict).toBe(blocked.externalConflict);
      expect(beginDuplicate(kept, live(), () => kept)).toBeNull();
      const withheld = applyDuplicationObservation(session(), decided(null, observation(), true, 'raisedWithoutReload'));
      expect(dismissDuplicationOutcome(withheld).uncertaintyUnresolved).toBe(true);
      const waiting = applyDuplicationObservation(session(), retainedDelivery(seen));
      expect(dismissDuplicationOutcome(waiting).awaitingReconciliation.get(2)).toBe(seen);
    });

    it('changes nothing on coalesced and notLater, not even the object', () => {
      const seen = observation();
      const asked = askToReloadDiskVersion(applyDuplicationObservation(session(), raised(seen)));
      expect(matchDuplicationView(asked, HELD).awaitingReloadConfirmation).toBe(true);
      const standing = externalConflictSource(seen);
      expect(applyDuplicationObservation(asked, decided(standing, observation({ sequence: 6 }), false, 'coalesced'))).toBe(asked);
      expect(
        applyDuplicationObservation(
          asked,
          decided(standing, observation({ sequence: 4, diskRevision: 'd'.repeat(64) }), false, 'notLater')
        )
      ).toBe(asked);
    });
  }); // End of the "collisions" suite

  describe('the uncertainty and its exits (entries 11, 14, 15, 22; the record’s §5.5)', () => {
    it('withholds the reload and the reapply on raisedWithoutReload until the snapshot is acknowledged', () => {
      const seen = observation();
      const withheld = applyDuplicationObservation(session(), decided(null, seen, true, 'raisedWithoutReload'));
      expect(withheld.uncertaintyUnresolved).toBe(true);
      const view = matchDuplicationView(withheld, HELD);
      expect(view.conflictChoices).toEqual<readonly ConflictChoice[]>(['keepEditing']);
      expect(view.reapplyOffered).toBe(false);
      expect(view.externalNotices).toEqual([{ kind: 'writeOutcomeUnknown' }]);
      expect(askToReloadDiskVersion(withheld)).toBe(withheld);
      const recorder = adopting();
      expect(reapplyToDiskVersion(withheld, false, recorder.adopt, () => externalOf(withheld).source, () => withheld)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'writeOutcomeUnknown' }
      });
      expect(recorder.adoptions).toEqual([]);
      const asked: ExternalChangeConflictSource[] = [];
      expect(
        acknowledgeDuplicationSnapshot(withheld, (source) => {
          asked.push(source);
          return 'refused';
        })
      ).toBe(withheld);
      expect(asked).toEqual([externalOf(withheld).source]);
      const acknowledged = acknowledgeDuplicationSnapshot(withheld, () => 'acknowledged');
      expect(acknowledged).toEqual({ ...withheld, uncertaintyUnresolved: false, reload: NOT_RELOADING });
      expect(matchDuplicationView(acknowledged, HELD).conflictChoices).toContain('reloadDiskVersion');
      expect(matchDuplicationView(askToReloadDiskVersion(acknowledged), HELD).awaitingReloadConfirmation).toBe(true);
      let askedWithoutCause = 0;
      const plain = applyDuplicationObservation(session(), raised(seen));
      expect(
        acknowledgeDuplicationSnapshot(plain, () => {
          askedWithoutCause += 1;
          return 'acknowledged';
        })
      ).toBe(plain);
      expect(askedWithoutCause).toBe(0);
    }); // End of the "raisedWithoutReload" case

    it('clears the uncertainty when a later verdict under none replaces the conflict', () => {
      const first = observation();
      const withheld = applyDuplicationObservation(session(), decided(null, first, true, 'raisedWithoutReload'));
      const later = observation({ sequence: 6, diskRevision: 'c'.repeat(64), disk: diskFile({ revision: 'c'.repeat(64) }) });
      const replaced = applyDuplicationObservation(withheld, decided(externalConflictSource(first), later, false, 'supersedes'));
      expect(replaced.uncertaintyUnresolved).toBe(false);
      expect(externalOf(replaced).source).toBe(externalConflictSource(later));
      expect(matchDuplicationView(replaced, HELD).conflictChoices).toContain('reloadDiskVersion');
    });
  }); // End of the "uncertainty" suite

  describe('the reapply over the external origin: the subject’s exact from the table (entries 19, 20, 22)', () => {
    /** The base identity of the snippet the session is about. */
    const SUBJECT: MatchId = file().matches[0]!.id;

    /** The disk-side snippet the subject's row identifies. */
    const TWIN: MatchView = diskFile().matches[0]!;

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
     * A session raised over one observation.
     *
     * @param seen - The observation.
     * @returns The session and the guard answering its own conflict's origin.
     */
    function raisedOver(
      seen: ExternalConflictObservation
    ): { readonly stuck: MatchDuplicationSession; readonly stands: StandingOriginGuard } {
      const stuck = applyDuplicationObservation(session(), raised(seen));
      const source = externalOf(stuck).source;
      return { stuck, stands: () => source };
    } // End of function raisedOver()

    it('rebuilds the duplicate from the row the subject’s full identity finds, reading its exact tier and never the editor tier', () => {
      const { stuck, stands } = raisedOver(observed([row(SUBJECT, { Identified: { target: TWIN } })]));
      const recorder = adopting();
      const answer = reapplyToDiskVersion(stuck, false, recorder.adopt, stands, () => stuck);
      expect(answer.kind).toBe('reapplied');
      if (answer.kind !== 'reapplied') {
        throw new Error('this case is about the rebuilt session');
      }
      expect(answer.session.match).toEqual(TWIN.id);
      expect(baseRevisionOf(answer.session)).toBe(AFTER);
      expect(answer.session.draft.consent).toBeNull();
      expect(answer.session.externalConflict).toBeNull();
      expect(answer.session.awaitingReconciliation.size).toBe(0);
      expect(canDuplicate(answer.session, [diskFile()])).toBe(true);
      expect(beginDuplicate(answer.session, live(0, diskFile()), () => answer.session)?.match).toEqual(TWIN.id);
      expect(beginDuplicate(answer.session, live(), () => answer.session)).toBeNull();
      expect(recorder.adoptions).toEqual([externalOf(stuck)]);
    }); // End of the "rebuilt from the row" case

    it('refuses the subject: a refused tier, an empty tier, a stale full identity, another file, the position, and several rows', () => {
      const recorder = adopting();
      const refusedTier = raisedOver(observed([row(SUBJECT, { Refused: { reason: 'AmbiguousExact' } })]));
      expect(reapplyToDiskVersion(refusedTier.stuck, false, recorder.adopt, refusedTier.stands, () => refusedTier.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'correspondence', reason: 'AmbiguousExact' }
      });
      for (const empty of [{ Unsupported: {} }, { Targetless: {} }] as const) {
        const emptyTier = raisedOver(observed([row(SUBJECT, empty)]));
        expect(reapplyToDiskVersion(emptyTier.stuck, false, recorder.adopt, emptyTier.stands, () => emptyTier.stuck)).toEqual({
          kind: 'manualResolution',
          obstacle: { kind: 'evidenceNotATarget' }
        });
      } // End of the loop over the two empty arms
      const staleRevision = raisedOver(
        observed([row({ document: 2, revision: AFTER, node: 10 }, { Identified: { target: TWIN } })])
      );
      expect(reapplyToDiskVersion(staleRevision.stuck, false, recorder.adopt, staleRevision.stands, () => staleRevision.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: 'noRowForBase' }
      });
      const otherFile = raisedOver(
        observed([row({ document: 3, revision: BASE, node: 10 }, { Identified: { target: TWIN } })])
      );
      expect(reapplyToDiskVersion(otherFile.stuck, false, recorder.adopt, otherFile.stands, () => otherFile.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: 'noRowForBase' }
      });
      const byPosition = raisedOver(
        observed([
          row({ document: 2, revision: BASE, node: 99 }, { Identified: { target: TWIN } }),
          row({ document: 2, revision: BASE, node: 11 }, { Identified: { target: TWIN } })
        ])
      );
      expect(reapplyToDiskVersion(byPosition.stuck, false, recorder.adopt, byPosition.stands, () => byPosition.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: 'noRowForBase' }
      });
      const twice = raisedOver(
        observed([row(SUBJECT, { Identified: { target: TWIN } }), row(SUBJECT, { Identified: { target: TWIN } })])
      );
      expect(reapplyToDiskVersion(twice.stuck, false, recorder.adopt, twice.stands, () => twice.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: 'severalRowsForBase' }
      });
      expect(recorder.adoptions).toEqual([]);
    }); // End of the "subject refusals" case

    it('refuses a table about other revisions, and an observation with none', () => {
      const recorder = adopting();
      const otherBase = raisedOver(observed([row(SUBJECT, { Identified: { target: TWIN } })], { base: 'z'.repeat(64) }));
      expect(reapplyToDiskVersion(otherBase.stuck, false, recorder.adopt, otherBase.stands, () => otherBase.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: 'baseRevisionMoved' }
      });
      const otherDisk = raisedOver(observed([row(SUBJECT, { Identified: { target: TWIN } })], { disk: 'z'.repeat(64) }));
      expect(reapplyToDiskVersion(otherDisk.stuck, false, recorder.adopt, otherDisk.stands, () => otherDisk.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: 'diskRevisionMoved' }
      });
      const tableless = raisedOver(observation());
      expect(reapplyToDiskVersion(tableless.stuck, false, recorder.adopt, tableless.stands, () => tableless.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: 'noCorrespondence' }
      });
      expect(recorder.adoptions).toEqual([]);
    });

    it('refuses superseded evidence through the live guard, whichever origin, adopting nothing', () => {
      const recorder = adopting();
      const elsewhere = externalConflictSource(observation({ sequence: 9 }));
      const found = raisedOver(observed([row(SUBJECT, { Identified: { target: TWIN } })]));
      expect(reapplyToDiskVersion(found.stuck, false, recorder.adopt, () => elsewhere, () => found.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'supersededEvidence' }
      });
      expect(reapplyToDiskVersion(found.stuck, false, recorder.adopt, () => null, () => found.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'supersededEvidence' }
      });
      expect(((onHand) => reapplyToDiskVersion(onHand, false, recorder.adopt, () => elsewhere, () => onHand))(saveConflicted())).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'supersededEvidence' }
      });
      expect(recorder.adoptions).toEqual([]);
    });

    it('answers every adoption outcome for the external origin, and rechecks eligibility over the disk parse', () => {
      const { stuck, stands } = raisedOver(observed([row(SUBJECT, { Identified: { target: TWIN } })]));
      expect(reapplyToDiskVersion(stuck, false, adopting('installed').adopt, stands, () => stuck).kind).toBe('reapplied');
      expect(reapplyToDiskVersion(stuck, false, adopting('alreadyThere').adopt, stands, () => stuck).kind).toBe('reapplied');
      const refusedWindow = adopting('refused');
      expect(reapplyToDiskVersion(stuck, false, refusedWindow.adopt, stands, () => stuck)).toEqual({ kind: 'adoptionRefused' });
      expect(refusedWindow.adoptions).toHaveLength(1);
      // The open-editor rule is asked again, about this window now.
      const recorder = adopting();
      expect(reapplyToDiskVersion(stuck, true, recorder.adopt, stands, () => stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'notDuplicable', reason: 'unsavedDraftInDocument' }
      });
      expect(recorder.adoptions).toEqual([]);
    });

    it('refuses a reapply while an observation is held, so no rebuilt session can drop the block', () => {
      const { stuck, stands } = raisedOver(observed([row(SUBJECT, { Identified: { target: TWIN } })]));
      const heldReading = observation({ sequence: 6, diskRevision: 'd'.repeat(64), disk: diskFile({ revision: 'd'.repeat(64) }) });
      const held = applyDuplicationObservation(stuck, retainedDelivery(heldReading));
      expect(held.awaitingReconciliation.get(2)).toBe(heldReading);
      expect(duplicationSubmissionRefusal(held, HELD)).toBe('externalConflict');
      const recorder = adopting();
      expect(reapplyToDiskVersion(held, false, recorder.adopt, stands, () => held)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'observationRetained' }
      });
      expect(recorder.adoptions).toEqual([]);
      const view = matchDuplicationView(held, HELD);
      expect(view.conflictChoices).toEqual<readonly ConflictChoice[]>(['keepEditing', 'reloadDiskVersion']);
      expect(view.reapplyOffered).toBe(false);
      expect(view.externalNotices).toEqual([{ kind: 'observationRetained' }]);
      const lifted = applyDuplicationObservation(held, writtenHereDelivery(heldReading));
      const answer = reapplyToDiskVersion(lifted, false, adopting().adopt, stands, () => lifted);
      expect(answer.kind).toBe('reapplied');
      if (answer.kind === 'reapplied') {
        expect(answer.session.awaitingReconciliation.size).toBe(0);
        expect(canDuplicate(answer.session, [diskFile()])).toBe(true);
      }
      const elsewhere = otherObservation();
      const carrying: MatchDuplicationSession = { ...stuck, awaitingReconciliation: new Map([[3, elsewhere]]) };
      const rebuilt = reapplyToDiskVersion(carrying, false, adopting().adopt, stands, () => carrying);
      expect(rebuilt.kind).toBe('reapplied');
      if (rebuilt.kind === 'reapplied') {
        expect(rebuilt.session.awaitingReconciliation.get(3)).toBe(elsewhere);
      }
    }); // End of the "reapply refused while held" case

    it('asks nothing of the window when no guard is handed in, and leaves the door to decide', () => {
      const { stuck } = raisedOver(observed([row(SUBJECT, { Identified: { target: TWIN } })]));
      const refusedWindow = adopting('refused');
      expect(reapplyToDiskVersion(stuck, false, refusedWindow.adopt, null, () => stuck)).toEqual({ kind: 'adoptionRefused' });
      expect(refusedWindow.adoptions).toEqual([externalOf(stuck)]);
      expect(reapplyToDiskVersion(stuck, false, adopting().adopt, null, () => stuck).kind).toBe('reapplied');
    });

    it('names a sentence in both languages for every obstacle the external origin can raise', () => {
      const obstacles: DuplicationReapplyObstacle[] = [
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
        const key = duplicationReapplyObstacleKey(obstacle);
        for (const locale of LOCALES) {
          expect(DICTIONARIES[locale][key], `${locale}:${obstacle.kind}`).toBeTruthy();
          const rendered = describeDuplicationReapplyObstacle(locale, obstacle);
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
    function trappedForReapply(over: MatchDuplicationSession, body: () => void): { readonly proxy: MatchDuplicationSession; arm(): void } {
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
      const displaced = applyDuplicationObservation(stuck, retainedDelivery(observation({ sequence: 6 })));
      let holder: MatchDuplicationSession = stuck;
      const trap = trappedForReapply(stuck, () => {
        holder = displaced;
      });
      holder = trap.proxy;
      const recorder = adopting('installed');
      const answer = reapplyToDiskVersion(trap.proxy, false, recorder.adopt, stands, () => {
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
      const displaced = applyDuplicationObservation(stuck, retainedDelivery(observation({ sequence: 6 })));
      let holder: MatchDuplicationSession = stuck;
      const trap = trappedForReapply(stuck, () => {
        holder = displaced;
      });
      holder = trap.proxy;
      const recorder = adopting('installed');
      const answer = reapplyToDiskVersion(
        trap.proxy,
        false, (conflict, confirmation) => {
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
      let holder: MatchDuplicationSession = stuck;
      const newer = observation({ sequence: 6, diskRevision: 'c'.repeat(64), disk: diskFile({ revision: 'c'.repeat(64) }) });
      const recorder = adopting('installed');
      const answer = reapplyToDiskVersion(
        stuck,
        false, (conflict, confirmation) => {
          holder = applyDuplicationObservation(holder, decided(externalOf(holder).source, newer, false, 'supersedes'));
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
      let holder: MatchDuplicationSession = stuck;
      const later = observation({ sequence: 6 });
      const recorder = adopting('installed');
      const answer = reapplyToDiskVersion(
        stuck,
        false, (conflict, confirmation) => {
          holder = applyDuplicationObservation(holder, retainedDelivery(later));
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
    function installed(first: MatchDuplicationSession): {
      current: () => MatchDuplicationSession;
      receive: (delivery: ObservationDelivery) => void;
    } {
      let held = first;
      return {
        current: () => held,
        receive: (delivery) => {
          held = applyDuplicationObservation(held, delivery);
        }
      };
    } // End of function installed()

    it('refuses a duplicate when the projection read displaced the installed session', () => {
      // **The review's first blocker, at this door.** A getter behind
      // `projected.document` runs a receiver that replaces the installed session
      // with one carrying an external conflict; the spend must be refused
      // against the session installed after that read.
      const holder = installed(session());
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
      expect(beginDuplicate(handedIn, projected, holder.current)).toBeNull();
      expect(holder.current().externalConflict?.source).toBe(externalConflictSource(seen));
      const quiet = installed(session());
      expect(beginDuplicate(quiet.current(), live(), quiet.current)).not.toBeNull();
      const waiting = installed(applyDuplicationObservation(session(), retainedDelivery(seen)));
      expect(beginDuplicate(waiting.current(), live(), waiting.current)).toBeNull();
    }); // End of the "displaced during the projection read" case

    it('refuses a duplicate when a later read of this door displaced the installed session (2d-6-5’s class, Phase 2d-6-6a)', () => {
      // **The installed session is read once, and it must be read last.** The
      // door reads the draft's value for the comparison and again for the
      // submission, and spreads the session; a getter quiet on the first read
      // and delivering on a later one, or on the spread, runs after a reader
      // asked too early.
      const seen = observation();
      /**
       * A holder installing a session whose draft value delivers `raised` to it
       * on the given read, counting from one, and counts the reads.
       *
       * @param on - The read that delivers, or `null` to deliver never.
       * @returns The reader, the trapped session and the count.
       */
      function deliveringOnRead(on: number | null): {
        readonly current: () => MatchDuplicationSession;
        readonly trapped: MatchDuplicationSession;
        readonly reads: () => number;
      } {
        const handedIn = session();
        let reads = 0;
        let held: MatchDuplicationSession = handedIn;
        const trapped: MatchDuplicationSession = {
          ...handedIn,
          draft: {
            ...handedIn.draft,
            get value(): MatchId {
              reads += 1;
              if (reads === on) {
                held = applyDuplicationObservation(held, raised(seen));
              }
              return handedIn.draft.value;
            }
          }
        };
        held = trapped;
        return { current: () => held, trapped, reads: () => reads };
      } // End of function deliveringOnRead()
      const quiet = deliveringOnRead(null);
      expect(beginDuplicate(quiet.trapped, live(), quiet.current)).not.toBeNull();
      const total = quiet.reads();
      expect(total).toBeGreaterThanOrEqual(1);
      for (let on = 1; on <= total; on += 1) {
        const displaced = deliveringOnRead(on);
        expect(beginDuplicate(displaced.trapped, live(), displaced.current)).toBeNull();
        expect(externalOf(displaced.current()).source).toBe(externalConflictSource(seen));
      } // End of the loop over the reads of the draft's value
      // The spread that builds the waiting session reads every own property.
      // Armed once: the receiver's own spread reads it again.
      const beforeSpread = session();
      let armed = true;
      let spreadHeld: MatchDuplicationSession = beforeSpread;
      const trappedSpread: MatchDuplicationSession = {
        ...beforeSpread,
        get extraMessages(): MatchDuplicationSession['extraMessages'] {
          if (armed) {
            armed = false;
            spreadHeld = applyDuplicationObservation(spreadHeld, raised(seen));
          }
          return [];
        }
      };
      spreadHeld = trappedSpread;
      expect(beginDuplicate(trappedSpread, live(), () => spreadHeld)).toBeNull();
      expect(externalOf(spreadHeld).source).toBe(externalConflictSource(seen));
    }); // End of the "displaced during a later read" case

    it('settles against the installed session and replays a delivery that arrived during its own replay', () => {
      // **The review's second blocker**, on the two settling transitions.
      const later = observation({ sequence: 6, diskRevision: 'c'.repeat(64), disk: diskFile({ revision: 'c'.repeat(64) }) });
      let armed = false;
      /**
       * A holder over an in-flight duplicate told `retained(A), raised(A)`, where
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
      const settled = applyDuplication(answered.current(), REFUSED, NOT_OWED, answered.current);
      expect(armed).toBe(false);
      expect(settled.outcome?.kind).toBe('refused');
      expect(settled.heldDeliveries).toEqual([]);
      expect(externalOf(settled).source).toBe(externalConflictSource(later));
      const unanswered = trapped();
      const failed = duplicationCouldNotBeSent(unanswered.current(), false, null, unanswered.current);
      expect(failed.heldDeliveries).toEqual([]);
      expect(externalOf(failed).source).toBe(externalConflictSource(later));
      // A reader answering the capture it was handed settles only that capture —
      // the documented cost of a reader that does not read what the caller installs.
      const alone = trapped();
      expect(externalOf(((onHand) => applyDuplication(onHand, REFUSED, NOT_OWED, () => onHand))(alone.current())).source).not.toBe(externalConflictSource(later));
    }); // End of the "delivery during the replay" case

    it('rechecks the installed session immediately before adopting, and refuses a wait or a supersession that arrived during the evidence reads', () => {
      // **The review's third blocker.**
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
              holder.receive(deliver(externalOf(holder.current()).source));
            }
            return { Identified: { target: TWIN } };
          },
          editor: { Unsupported: {} }
        };
        const seen = observation({
          correspondences: { base_revision: BASE, disk_revision: AFTER, entries: [row] }
        });
        holder = installed(applyDuplicationObservation(session(), raised(seen)));
        const source = externalOf(holder.current()).source;
        return { holder, stands: () => source };
      } // End of function trapped()
      const waited = trapped(() => retainedDelivery(heldReading));
      expect(
        reapplyToDiskVersion(waited.holder.current(), false, recorder.adopt, waited.stands, waited.holder.current)
      ).toEqual({ kind: 'manualResolution', obstacle: { kind: 'observationRetained' } });
      const superseded = trapped((source) => decided(source, heldReading, false, 'supersedes'));
      expect(
        reapplyToDiskVersion(superseded.holder.current(), false, recorder.adopt, superseded.stands, superseded.holder.current)
      ).toEqual({ kind: 'manualResolution', obstacle: { kind: 'supersededEvidence' } });
      const uncertain = trapped((source) => decided(source, heldReading, true, 'raisedWithoutReload'));
      expect(
        reapplyToDiskVersion(uncertain.holder.current(), false, recorder.adopt, uncertain.stands, uncertain.holder.current)
      ).toEqual({ kind: 'manualResolution', obstacle: { kind: 'writeOutcomeUnknown' } });
      expect(recorder.adoptions).toEqual([]);
      const quiet = trapped(() => retainedDelivery(otherObservation()));
      expect(reapplyToDiskVersion(quiet.holder.current(), false, recorder.adopt, quiet.stands, quiet.holder.current).kind).toBe('reapplied');
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
      const stuck = applyDuplicationObservation(session(), raised(seen));
      const stands: StandingOriginGuard = () => externalOf(stuck).source;
      const recorder = adopting();
      const held = applyDuplicationObservation(stuck, retainedDelivery(observation({ sequence: 6 })));
      expect(reapplyToDiskVersion(held, false, recorder.adopt, stands, () => held)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'observationRetained' }
      });
      const withheld = applyDuplicationObservation(session(), decided(null, seen, true, 'raisedWithoutReload'));
      expect(reapplyToDiskVersion(withheld, false, recorder.adopt, stands, () => withheld)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'writeOutcomeUnknown' }
      });
      expect(reads).toBe(0);
      expect(reapplyToDiskVersion(stuck, false, recorder.adopt, stands, () => stuck)).toEqual({
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
    function confirmedOver(seen: ExternalConflictObservation): MatchDuplicationSession {
      const confirmed = confirmDiskReload(askToReloadDiskVersion(applyDuplicationObservation(session(), raised(seen))));
      expect(confirmed.reload.kind).toBe('confirmed');
      return confirmed;
    } // End of function confirmedOver()

    it('answers the installed session and asks the window nothing when the session was displaced before the adoption', () => {
      const confirmed = confirmedOver(observation());
      const installed = applyDuplicationObservation(confirmed, retainedDelivery(observation({ sequence: 6 })));
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
          holder = applyDuplicationObservation(holder, decided(externalConflictSource(seen), newer, false, 'supersedes'));
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
          holder = applyDuplicationObservation(holder, retainedDelivery(later));
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
    function trappedSession(target: MatchDuplicationSession, body: () => void): { readonly proxy: MatchDuplicationSession; arm(): void } {
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
        const displaced = applyDuplicationObservation(confirmed, retainedDelivery(observation({ sequence: 6 })));
        let holder: MatchDuplicationSession = confirmed;
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
      const asked = askToReloadDiskVersion(applyDuplicationObservation(session(), raised(observation())));
      expect(asked.reload.kind).not.toBe('confirmed');
      const displaced = applyDuplicationObservation(asked, retainedDelivery(observation({ sequence: 6 })));
      let holder: MatchDuplicationSession = asked;
      const step = asked.reload;
      const tricked: MatchDuplicationSession = {
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
