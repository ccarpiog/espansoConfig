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
 * 5. **the view** — what a screen would draw, derived on every read.
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
  SaveResult
} from '../ipc/types';
import { makeDocument, makeMatch, matchListPath } from './fixtures';
import type { InvalidationStatus } from './invalidation';
import { identityInProjection } from './matchDeletion';
import {
  acknowledgeDuplicationFindings,
  applyDuplication,
  baseRevisionOf,
  beginDuplicate,
  canDuplicate,
  conflictOf,
  dismissDuplicationOutcome,
  documentHasUnsavedDraft,
  duplicationCouldNotBeSent,
  duplicationEligibility,
  duplicationRecoveryChoices,
  duplicationRecoveryFailed,
  duplicationRecoveryKey,
  duplicationRefusalKey,
  duplicationSubmissionRefusal,
  duplicationSubmissionRefusalKey,
  matchDuplicationView,
  startMatchDuplication,
  type DuplicationRefusal,
  type DuplicationSubmissionRefusal,
  type MatchDuplicationSession
} from './matchDuplication';

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
    const started = beginDuplicate(opened, live(0));
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
    expect(beginDuplicate(opened, identityInProjection([reread()], opened.match))).toBeNull();
    expect(beginDuplicate(opened, null)).toBeNull();
    // And the same rule, read from the view side: the refusal is `outOfDate`.
    expect(duplicationSubmissionRefusal(opened, [reread()])).toBe('outOfDate');
    expect(canDuplicate(opened, [reread()])).toBe(false);
  });

  it('produces nothing for a snippet that may not be duplicated', () => {
    const packaged = file({ kind: 'Package', readOnly: true });
    const opened = startMatchDuplication(packaged, packaged.matches[0]!, false);
    expect(beginDuplicate(opened, live(0, packaged))).toBeNull();
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
    return beginDuplicate(session(0), live(0))!.session;
  } // End of function inFlight()

  it('spends the session on a commit and keeps the identity the save answered', () => {
    const clone: MatchId = { document: 2, revision: AFTER, node: 31 };
    const done = applyDuplication(inFlight(), saved(true, clone), ADOPTED);
    const view = matchDuplicationView(done, HELD);
    expect(view.duplicated).toBe(true);
    expect(view.spent).toBe(true);
    expect(view.landed).toEqual(clone);
    expect(view.duplicating).toBe(false);
    expect(view.messages.map((message) => message.kind)).toEqual(['fileWritten']);
    expect(beginDuplicate(done, live(0))).toBeNull();
  });

  it('holds the committed arm even when the clone could not be identified', () => {
    // `moved: null` on a commit is legal, and it means only that the clone
    // could not be identified in the read that followed the write — the causes
    // are not enumerable from here (the file may have changed again, or that
    // read may have failed; the Rust boundary test produces this very answer
    // with no second writer at all). The session is spent exactly as it is for
    // an identified clone; only `landed` differs, and a screen has to be able
    // to draw that case.
    const done = applyDuplication(inFlight(), saved(true, null), ADOPTED);
    expect(done.duplicated).toBe(true);
    expect(done.landed).toBeNull();
    expect(matchDuplicationView(done, HELD).spent).toBe(true);
  });

  it('spends nothing when the save committed nothing and owed no adoption', () => {
    // Practically unreachable for an insertion — a duplicate always changes the
    // document — and the arm is honest rather than hopeful (consult Q6: a
    // `committed: false` with no adoption owed spends nothing, even if
    // insertion makes that arm practically unreachable).
    const done = applyDuplication(inFlight(), saved(false, null, BASE), NOT_OWED);
    expect(done.duplicated).toBe(false);
    expect(done.invalidated).toBe(false);
    const view = matchDuplicationView(done, HELD);
    expect(view.spent).toBe(false);
    expect(view.canDuplicate).toBe(true);
    expect(beginDuplicate(done, live(0))).not.toBeNull();
  });

  it('spends the session when a `committed: false` owed an adoption anyway', () => {
    // The wrapper adopts on `committed || revision !== view.revision`, so a
    // save that wrote nothing and ended on a revision this window was not
    // projecting re-reads the file — and every identity here was minted from
    // the parse that re-read replaced. The session must stop offering the
    // duplicate **without** claiming one committed.
    const done = applyDuplication(inFlight(), saved(false, null, AFTER), ADOPTED);
    expect(done.duplicated).toBe(false);
    expect(done.invalidated).toBe(true);
    const view = matchDuplicationView(done, [reread()]);
    expect(view.duplicated).toBe(false);
    expect(view.spent).toBe(true);
    expect(view.cannotDuplicate).toBe('outOfDate');
    expect(beginDuplicate(done, identityInProjection([reread()], done.match))).toBeNull();
  });

  it('spends the session on a conflict, whose adoption is always `notOwed`', () => {
    // `BrowserState.duplicateMatch` installs the projection a conflict carries
    // on `disk` — which replaces every identity this session holds — and
    // reports `adoption: notOwed` for it, because it re-read nothing and wrote
    // nothing. So the adoption cannot be the evidence here and the arm is,
    // exactly as `applyMove` derives it.
    const conflicted = applyDuplication(inFlight(), CONFLICT, NOT_OWED);
    expect(conflicted.duplicated).toBe(false);
    expect(conflicted.invalidated).toBe(true);
    expect(conflictOf(conflicted)).not.toBeNull();
    expect(duplicationSubmissionRefusal(conflicted, [CONFLICT.disk])).toBe('conflict');
    expect(matchDuplicationView(conflicted, [CONFLICT.disk]).conflictChoices).toEqual([
      'keepEditing'
    ]);
    // Dismissing the panel is not getting the session back: the conflict goes,
    // the invalidation stays, and two independent things refuse the send — the
    // arm's own flag and the live check.
    const dismissed = dismissDuplicationOutcome(conflicted);
    expect(conflictOf(dismissed)).toBeNull();
    expect(duplicationSubmissionRefusal(dismissed, [CONFLICT.disk])).toBe('outOfDate');
    expect(matchDuplicationView(dismissed, [CONFLICT.disk]).spent).toBe(true);
    expect(
      beginDuplicate(dismissed, identityInProjection([CONFLICT.disk], dismissed.match))
    ).toBeNull();
    // Including against the projection the session was opened over: the
    // invalidation is not conditional on the live check noticing.
    expect(beginDuplicate(dismissed, live(0))).toBeNull();
  });

  it('invalidates an arm that is not `saved` when the adoption was owed anyway', () => {
    // A structural guard, `matchMove.test.ts`'s: the wrapper owes an adoption
    // only on the `saved` arm, so `refused` beside `done` is not an answer it
    // gives — what this pins is the shape of the rule, so that moving the
    // `adoption.kind !== 'notOwed'` check inside the saved branch cannot drop
    // the guarantee silently.
    const refused = applyDuplication(inFlight(), REFUSED, ADOPTED);
    expect(refused.duplicated).toBe(false);
    expect(refused.invalidated).toBe(true);
    expect(matchDuplicationView(refused, HELD).spent).toBe(true);
    expect(applyDuplication(inFlight(), REFUSED, NOT_ADOPTED).invalidated).toBe(true);
  });

  it('puts the out-of-step line beside a commit whose adoption failed', () => {
    const done = applyDuplication(inFlight(), saved(), NOT_ADOPTED);
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
    const refused = applyDuplication(inFlight(), REFUSED, NOT_OWED);
    const view = matchDuplicationView(refused, HELD);
    expect(view.outcome?.kind).toBe('refused');
    expect(view.refusalChoices).toEqual(['saveAnyway', 'keepEditing']);
    expect(view.duplicated).toBe(false);
    expect(view.spent).toBe(false);

    const consented = acknowledgeDuplicationFindings(refused);
    const again = beginDuplicate(consented, live(0));
    expect(again).not.toBeNull();
    expect(again!.submission.acknowledgement).toEqual({ accepted: [TRIGGER_KEPT] });
    expect(again!.submission.baseRevision).toBe(BASE);
  });

  it('records a send that produced no outcome, in its two arms', () => {
    const notSent = duplicationCouldNotBeSent(inFlight(), false, null);
    expect(notSent.sendFailure).toEqual({ kind: 'notSent', reason: null });
    expect(notSent.duplicated).toBe(false);
    // A failure before the rename really did write nothing, so the session is
    // not spent and the same duplicate may be sent again.
    expect(notSent.mayHaveWritten).toBe(false);
    expect(canDuplicate(notSent, HELD)).toBe(true);
    const failure: IpcFailure = { kind: 'command', error: { code: 'noWorkspaceOpen' } };
    const maybe = duplicationCouldNotBeSent(inFlight(), true, failure);
    expect(maybe.sendFailure).toEqual({ kind: 'mayHaveWritten', reason: failure });
    expect(matchDuplicationView(maybe, HELD).failureLines).toEqual([{ kind: 'failure', failure }]);
  });

  it('spends the session when the send may already have written the file', () => {
    const maybe = duplicationCouldNotBeSent(inFlight(), true, UNCERTAIN);
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
    expect(beginDuplicate(maybe, live(0))).toBeNull();
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
        matchDuplicationView(duplicationCouldNotBeSent(inFlight(), false, failure), HELD).recovery
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
    const refused = duplicationCouldNotBeSent(inFlight(), false, disputed);
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
    expect(beginDuplicate(spent, identityInProjection(HELD, spent.match))).toBeNull();
    expect(dismissDuplicationOutcome(spent).invalidated).toBe(true);
  }); // End of the "failed recovery re-read" case

  it('ignores an answer nothing was waiting for', () => {
    const clean = session(0);
    expect(applyDuplication(clean, saved(), ADOPTED)).toBe(clean);
  });

  it('never takes a commit or an invalidation back', () => {
    // Both flags are or-ed into rather than assigned, so "cleared by nothing"
    // is what the code does and not only what the reachable transitions allow.
    const committed = applyDuplication(inFlight(), saved(), ADOPTED);
    const again = applyDuplication(committed, saved(false, null, BASE), NOT_OWED);
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
    return beginDuplicate(session(0), live(0))!.session;
  } // End of function inFlight()

  it('answers the uncertain send ahead of the commit, in both orders', () => {
    // `mayHaveWritten` and `alreadyDuplicated` — the adjacent pair at the top
    // of the order, and the reason the order is a rule: a definite *this
    // snippet has been copied* beside a send failure disclaiming exactly that
    // is the arrangement the precedence forbids.
    const committed = applyDuplication(inFlight(), saved(), ADOPTED);
    expect(duplicationSubmissionRefusal(committed, HELD)).toBe('alreadyDuplicated');
    const afterwards = duplicationCouldNotBeSent(committed, true, UNCERTAIN);
    expect(afterwards.duplicated).toBe(true);
    expect(afterwards.mayHaveWritten).toBe(true);
    expect(duplicationSubmissionRefusal(afterwards, HELD)).toBe('mayHaveWritten');
    // The other order, because which answer arrives first is the caller's.
    const beforehand = applyDuplication(
      duplicationCouldNotBeSent(inFlight(), true, UNCERTAIN),
      saved(),
      ADOPTED
    );
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
      ...applyDuplication(inFlight(), saved(), ADOPTED),
      phase: 'saving'
    };
    expect(duplicationSubmissionRefusal(both, HELD)).toBe('alreadyDuplicated');
  });

  it('answers the flight ahead of the conflict', () => {
    // `saveInFlight` and `conflict` — adjacent in the order. A conflict answer
    // always ends the flight, so the pair is constructed for the same stated
    // reason as above.
    const conflicted = applyDuplication(inFlight(), CONFLICT, NOT_OWED);
    const both: MatchDuplicationSession = { ...conflicted, phase: 'saving' };
    expect(duplicationSubmissionRefusal(both, [CONFLICT.disk])).toBe('saveInFlight');
  });

  it('answers the conflict ahead of the staleness it itself causes', () => {
    // `conflict` and `outOfDate` — adjacent in the order, and this pair is the
    // one production really produces: a conflict sets `invalidated` in the
    // same transition, and while the panel is up the person is told about the
    // conflict, not about staleness. Dismissing it is what leaves `outOfDate`.
    const conflicted = applyDuplication(inFlight(), CONFLICT, NOT_OWED);
    expect(conflicted.invalidated).toBe(true);
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
    const started = beginDuplicate(session(0), live(0));
    const done = applyDuplication(started!.session, saved(true, null, AFTER, [note]), ADOPTED);
    expect(matchDuplicationView(done, HELD).notes).toEqual([note]);
    const quiet = applyDuplication(started!.session, saved(), ADOPTED);
    expect(matchDuplicationView(quiet, HELD).notes).toEqual([]);
  });

  it('has a sentence for every submission refusal, in both languages', () => {
    const reasons: readonly DuplicationSubmissionRefusal[] = [
      'mayHaveWritten',
      'alreadyDuplicated',
      'saveInFlight',
      'conflict',
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
