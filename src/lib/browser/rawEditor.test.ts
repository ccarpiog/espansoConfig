/**
 * The raw editor's state machine, driven without a screen.
 *
 * Five groups, and each is a way this editor could be wrong in a manner a person
 * would only discover after their file had been written:
 *
 * 1. **the draft** — dirty derived rather than stored, undo and redo, and the two
 *    moments the box stops accepting changes (a save in flight, a conflict on
 *    screen), which are this sub-phase's own policy decisions;
 * 2. **the save** — gated on dirty, one submission, and the seal opened exactly
 *    once with the invalidation discharged on the way through;
 * 3. **the three arms** — a commit that rebases the draft, a `committed: false`
 *    that rebases it too, and a committed save whose invalidation threw, which is
 *    still a committed save (`PROGRESS.md` D2);
 * 4. **the acknowledgement round trip** — consent bound to the exact candidate,
 *    and withdrawn, control and all, the moment the text changes;
 * 5. **the conflict** — the eight requirements of `2c-split-notes.md` section 6,
 *    including the prohibition: no choice is called "keep my draft", in either
 *    language.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { describe, expect, it } from 'vitest';
import { DICTIONARIES } from '../i18n/dictionaries';
import { LOCALES } from '../i18n/locale';
import type { RawSaveReload } from '../ipc/commands';
import type { IpcFailure } from '../ipc/errors';
import type {
  ContentRevision,
  Finding,
  RefusedResult,
  SaveResult
} from '../ipc/types';
import { isDirty, startDraft, textDraftRules } from './draft';
import { makeConflict, makeDocument, makeMatch } from './fixtures';
import {
  openWholeDocumentSave,
  sealWholeDocumentSave,
  type SealedWholeDocumentSave
} from './invalidation';
import {
  acknowledgeFindings,
  acknowledgeSnapshot,
  acknowledgementOf,
  applyObservation,
  applySave,
  askToReload,
  beginSave,
  canSave,
  conflictOf,
  confirmReload,
  editText,
  isEditable,
  keepEditing,
  loadDiskVersion,
  outcomeIsStale,
  rawEditorRefusal,
  rawEditorRefusalKey,
  rawEditorView,
  reapplyToDiskVersion,
  redoEdit,
  saveCouldNotBeSent,
  startRawEditor,
  textToCopy,
  undoEdit,
  type RawEditorSession,
  type RoundTripText
} from './rawEditor';
import { NOT_RELOADING, type AdoptTheDiskVersion, type ReloadStep } from './editorSave';
import {
  externalConflictSource,
  standingConflictOf,
  type ConflictSource,
  type ExternalChangeConflictSource,
  type ExternalConflictObservation,
  type ObservationVerdict
} from './conflictSource';
import {
  arbitratedDelivery,
  retainedDelivery,
  writtenHereDelivery,
  type ObservationDelivery
} from './observationDelivery';
import { submissionOf } from './draft';
import {
  conflictChoiceKey,
  isExternalConflict,
  isSaveConflict,
  type ConflictChoice,
  type ConflictModel,
  type DiskAdoptionOutcome,
  type ExternalConflictModel,
  type SaveConflictModel,
  type SaveOutcomeMessage
} from './saveOutcome';

/*
 * **`((onHand) => door(onHand, …, () => onHand))(value)`** is a door, a settling
 * transition or a reapply called with a reader answering the very session it is
 * handed — the installed session of a caller that registers no receiver. Phase
 * 2d-6-6a made the reader required; this is how a case that is not about
 * displacement says so without evaluating `value` twice. The cases that are about
 * displacement pass a holder's reader instead.
 */

/** The document every case here edits. */
const DOCUMENT = 7;

/** The revision the text was read at. */
const BASE: ContentRevision = 'a'.repeat(64);

/** The revision the file holds after a commit. */
const AFTER: ContentRevision = 'b'.repeat(64);

/** A third revision, for a file that changed twice. */
const AGAIN: ContentRevision = 'c'.repeat(64);

/** The text the file held when the editor opened. */
const ORIGINAL = 'matches:\n  - trigger: ":a"\n    replace: "b"\n';

/** What one edit produces. */
const EDITED = 'matches:\n  - trigger: ":a"\n    replace: "c"\n';

/** The same document with CRLF endings, which this editor refuses. */
const CRLF = 'matches:\r\n  - trigger: ":a"\r\n    replace: "b"\r\n';

/**
 * A session over {@link ORIGINAL}.
 *
 * Insists on a session, because {@link ORIGINAL} has no carriage return and every
 * case below that uses it is about something else. The refusal has its own suite.
 *
 * @returns A clean session with no history and nothing said.
 */
function fresh(): RawEditorSession {
  const session = startRawEditor(DOCUMENT, BASE, ORIGINAL);
  if (session === null) {
    throw new Error('this text is one the editor can hold unchanged');
  }
  return session;
} // End of function fresh()

/** A parse rejection, content-addressed to the candidate it is about. */
const REJECTION: Finding = {
  code: {
    DocumentDoesNotParse: {
      revision: AFTER,
      line: 3,
      column: 5,
      byte_index: 30,
      detail: 'mapping values are not allowed in this context'
    }
  },
  span: null,
  node: null,
  path: null
};

/** A classified failure, for the arms that carry one. */
const FAILURE: IpcFailure = {
  kind: 'command',
  error: { code: 'io', path: '/nowhere/match/base.yml', kind: 'PermissionDenied' }
};

/** A finding of the class no acknowledgement can move. */
const MODEL_ERROR: Finding = {
  code: 'MatchHasNoContentField',
  span: null,
  node: null,
  path: null
};

/**
 * A refusal carrying the findings given.
 *
 * @param findings - What the gate reported.
 * @param verdict - Which arm refused; the acknowledgeable one by default.
 * @returns The refusal as it crosses the boundary.
 */
function refusal(
  findings: readonly Finding[] = [REJECTION],
  verdict: RefusedResult['verdict'] = 'RefusedForUnacknowledgedSuspicions'
): SaveResult {
  return { outcome: 'refused', verdict, findings };
} // End of function refusal()

/**
 * A save that ran to the end.
 *
 * @param committed - Whether the file was really rewritten.
 * @returns The saved outcome as it crosses the boundary.
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

/** What the other writer left on disk, which the conflict carries. */
const DISK = 'matches:\n  - trigger: x\n    replace: theirs\n';

/**
 * A save the file had moved on under.
 *
 * @param diskRevision - What the read after the refusal found.
 * @param diskText - The whole file text at that revision. **Since 2c-4a-2 this is
 *   where a reload's text comes from**: the payload's own, paired with the
 *   revision by the command layer, rather than a second read a caller supplies.
 * @returns The conflict as it crosses the boundary.
 */
function conflict(diskRevision: ContentRevision = AFTER, diskText: string = DISK): SaveResult {
  return {
    outcome: 'conflict',
    reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
    expected: BASE,
    found: AFTER,
    disk_revision: diskRevision,
    disk_text: diskText,
    disk: makeDocument({ id: DOCUMENT, revision: diskRevision })
  };
} // End of function conflict()

/**
 * A recorder for the workspace adoption a reload performs.
 *
 * **A counter and not a spy, because what is being pinned is a count.** The
 * adoption must happen exactly once, on a reload that really happens, and never
 * on one this module refuses.
 *
 * @param answer - What the window answers. `refused` is a real production answer —
 *   a confirmation issued for another conflict, one already spent, a conflict this
 *   window did not produce, an unprojected document, or a projection replaced since
 *   the conflict arrived when the window does not already hold the requested
 *   revision — and a reload that took it for a success would reseed over a window
 *   that never moved.
 * @returns The callback to pass, and what it was handed.
 */
function adopting(answer: DiskAdoptionOutcome = 'installed'): {
  readonly adopt: AdoptTheDiskVersion<RoundTripText>;
  readonly adoptions: ConflictModel<RoundTripText>[];
} {
  const adoptions: ConflictModel<RoundTripText>[] = [];
  return {
    adopt: (conflict) => {
      adoptions.push(conflict);
      return answer;
    },
    adoptions
  };
} // End of function adopting()

/**
 * Seals one outcome the way `BrowserState.saveRawDocument` does.
 *
 * @param result - How the save ended.
 * @param issuer - What the issuer's own invalidation did; it succeeded unless a
 *   case is about it failing.
 * @returns The sealed outcome.
 */
function sealed(
  result: SaveResult,
  issuer: RawSaveReload = { kind: 'done' }
): SealedWholeDocumentSave {
  return sealWholeDocumentSave(DOCUMENT, result, issuer);
} // End of function sealed()

/**
 * Runs one whole save, from the draft as it stands to the answer applied.
 *
 * @param session - The session to save.
 * @param result - What the boundary answers.
 * @param acknowledge - Whether this is the *Save anyway* path.
 * @returns The session after the answer, and what was sent.
 */
function roundTrip(
  session: RawEditorSession,
  result: SaveResult,
  acknowledge = false
): { readonly session: RawEditorSession; readonly sent: readonly Finding[] } {
  const consented = acknowledge ? acknowledgeFindings(session) : session;
  const started = beginSave(consented, () => consented);
  if (started === null) {
    throw new Error('this case is about a save that could be started');
  }
  const sent = [...acknowledgementOf(started.submission).accepted];
  return { session: applySave(started.session, sealed(result), () => started.session), sent };
} // End of function roundTrip()

/**
 * Drives a session all the way into a conflict.
 *
 * @param diskRevision - What the read after the refusal found.
 * @param diskText - The whole file text at that revision.
 * @returns The session showing the conflict.
 */
function inConflict(
  diskRevision: ContentRevision = AFTER,
  diskText: string = DISK
): RawEditorSession {
  return roundTrip(editText(fresh(), EDITED), conflict(diskRevision, diskText)).session;
} // End of function inConflict()

/**
 * The save conflict a session shows, narrowed, or a failure naming the case.
 *
 * `conflictOf` answers either origin since Phase 2d-6-5, so a case about the
 * three save-only fields narrows through the tested type guard rather than
 * reading them off the union.
 *
 * @param session - The session.
 * @returns Its save conflict.
 */
function saveConflictOf(session: RawEditorSession): SaveConflictModel<RoundTripText> {
  const shown = conflictOf(session);
  if (shown === null || !isSaveConflict(shown)) {
    throw new Error('this case needs a save conflict on the session');
  }
  return shown;
} // End of function saveConflictOf()

describe('a text this editor cannot give back unchanged', () => {
  // **The window reading's first finding** (notes section 9.10.1): a `<textarea>`'s
  // API value normalizes every line break to LF, so a CRLF document loses its
  // carriage returns on the first keystroke and the save writes the normalized
  // text under a panel that says the file holds exactly what was sent. The fix is
  // a refusal, and these are the cases that would have caught the original defect.

  it('refuses a CRLF document, and says why', () => {
    expect(rawEditorRefusal(CRLF)).toEqual({ kind: 'lineEndingsNotPreserved' });
    expect(startRawEditor(DOCUMENT, BASE, CRLF)).toBeNull();
  });

  it('refuses a lone carriage return and one inside a line, not only CRLF pairs', () => {
    // The same normalization applies to a bare CR, and a CR inside a block scalar
    // is a byte of the user's content this editor equally cannot give back.
    expect(startRawEditor(DOCUMENT, BASE, 'matches: []\r')).toBeNull();
    expect(startRawEditor(DOCUMENT, BASE, 'a: "one\rtwo"\n')).toBeNull();
    expect(startRawEditor(DOCUMENT, BASE, '\r')).toBeNull();
  }); // End of the "lone carriage return" case

  it('opens a text with no carriage return at all, including an empty one', () => {
    // The oracle: a refusal that refused everything would pass the cases above and
    // mean nothing.
    expect(rawEditorRefusal(ORIGINAL)).toBeNull();
    expect(startRawEditor(DOCUMENT, BASE, ORIGINAL)).not.toBeNull();
    expect(startRawEditor(DOCUMENT, BASE, '')).not.toBeNull();
    // And a backslash-r written in the source is two characters, not a carriage
    // return: refusing it would make this editor useless for ordinary YAML.
    expect(startRawEditor(DOCUMENT, BASE, 'a: "one\\rtwo"\n')).not.toBeNull();
  }); // End of the "no carriage return" case

  it('refuses an edit that would put a carriage return into a clean session', () => {
    // **The second review pass's High finding.** The first version checked only the
    // two entry points and typed everything else as `string`, so
    // `editText(session, 'a\rb')` type-checked from a perfectly valid LF session and
    // produced a candidate this editor could never read back. The component path
    // happened never to do it — a text area hands over an already-normalized value
    // — and *"happened never to"* is exactly what this project treats as a defect
    // when it is written down as a guarantee.
    const clean = fresh();
    expect(editText(clean, `${ORIGINAL}# with a carriage return\r\n`)).toBe(clean);
    expect(editText(clean, 'a\rb')).toBe(clean);
    // The same edit without the carriage return is taken, so the guard is a refusal
    // and not a broken transition.
    expect(rawEditorView(editText(clean, EDITED)).text).toBe(EDITED);
  }); // End of the "edit with a carriage return" case

  it('has no exported path that produces a candidate carrying a carriage return', () => {
    // The claim the refusal exists to make, stated as the thing a test can check,
    // and checked at **every** door rather than at the constructor alone.
    for (const text of [CRLF, 'matches: []\r', 'a: "one\rtwo"\n']) {
      expect(startRawEditor(DOCUMENT, BASE, text)).toBeNull();
    } // End of the loop over the texts a carriage return appears in

    // Editing: refused, so the candidate a save would send is unchanged.
    const typed = editText(editText(fresh(), EDITED), `${EDITED}\r`);
    expect(beginSave(typed, () => typed)?.submission.candidate).toBe(EDITED);

    // Reloading a disk version: refused, and the draft is left exactly as it was —
    // **and the window is not moved either**, which is what the recorder pins. The
    // disk text is the conflict's own since 2c-4a-2, so the carriage returns are
    // put there rather than handed in at the call.
    const carriage = adopting();
    const refusedReload = confirmReload(askToReload(inConflict(AFTER, CRLF)));
    const unchanged = loadDiskVersion(refusedReload, carriage.adopt, () => refusedReload);
    expect(unchanged).toBe(refusedReload);
    expect(rawEditorView(unchanged).text).toBe(EDITED);
    expect(carriage.adoptions).toEqual([]);
    // The same call over an LF disk version does reload, so that guard is a refusal
    // and not a broken transition either.
    const clean = adopting();
    const confirmed = confirmReload(askToReload(inConflict()));
    expect(rawEditorView(loadDiskVersion(confirmed, clean.adopt, () => confirmed)).text).toBe(DISK);
    expect(clean.adoptions).toHaveLength(1);

    // And the last line before the wire re-checks, because the brand is a cast at
    // bottom and a cast written anywhere would reach a user's file. Driven the only
    // way it can be driven — by planting the value the type system forbids.
    const planted: RawEditorSession = {
      ...fresh(),
      // The cast the brand cannot stop, written here on purpose: this is the only
      // way to reach the guard, and reaching it is the point.
      draft: startDraft(BASE, 'a\rb', textDraftRules) as unknown as RawEditorSession['draft']
    };
    expect(beginSave(planted, () => planted)).toBeNull();
  }); // End of the "no exported path to a carriage return" case

  it('gives the refusal a sentence in both languages, through the accessor', () => {
    for (const locale of LOCALES) {
      const sentence = DICTIONARIES[locale][rawEditorRefusalKey({ kind: 'lineEndingsNotPreserved' })];
      expect(sentence.length).toBeGreaterThan(0);
    } // End of the loop over both languages
  }); // End of the "sentence in both languages" case
}); // End of the "text this editor cannot give back" suite

describe('the draft the editor holds', () => {
  it('starts clean, with no history and nothing said', () => {
    const view = rawEditorView(fresh());
    expect(view.text).toBe(ORIGINAL);
    expect(view.dirty).toBe(false);
    expect(view.canUndo).toBe(false);
    expect(view.canRedo).toBe(false);
    expect(view.canSave).toBe(false);
    expect(view.outcome).toBeNull();
  }); // End of the "starts clean" case

  it('derives dirty rather than storing it, so typing back is clean again', () => {
    const there = editText(fresh(), EDITED);
    expect(rawEditorView(there).dirty).toBe(true);
    const back = editText(there, ORIGINAL);
    expect(rawEditorView(back).dirty).toBe(false);
    // The proof that it is derived and not a flag somebody remembered to clear.
    expect(Object.keys(back)).not.toContain('dirty');
  }); // End of the "dirty derived" case

  it('undoes and redoes, and an edit that changes nothing is not a step', () => {
    const one = editText(fresh(), EDITED);
    const same = editText(one, EDITED);
    expect(same).toBe(one);
    const back = undoEdit(one);
    expect(rawEditorView(back).text).toBe(ORIGINAL);
    expect(rawEditorView(back).canRedo).toBe(true);
    expect(rawEditorView(redoEdit(back)).text).toBe(EDITED);
  }); // End of the "undo and redo" case

  it('refuses every change while a save is in flight', () => {
    // 2c-1a hole 4.6 asked whether this editor should allow it. It should not:
    // there is nothing a person gains from typing into a box whose contents are
    // already on their way to disk, and the state it produces is the one the
    // spine can represent and nobody can describe.
    const started = ((onHand) => beginSave(onHand, () => onHand))(editText(fresh(), EDITED));
    const waiting = started?.session;
    expect(waiting).toBeDefined();
    if (waiting === undefined) {
      return;
    }
    expect(isEditable(waiting)).toBe(false);
    expect(editText(waiting, 'anything else')).toBe(waiting);
    expect(undoEdit(waiting)).toBe(waiting);
    expect(redoEdit(waiting)).toBe(waiting);
  }); // End of the "read-only while saving" case

  it('refuses every change while a conflict is showing, and gives the box back on keep editing', () => {
    const stuck = inConflict();
    expect(isEditable(stuck)).toBe(false);
    expect(editText(stuck, 'anything else')).toBe(stuck);
    // **Nothing was discarded**: the draft is exactly what it was.
    expect(rawEditorView(stuck).text).toBe(EDITED);
    expect(rawEditorView(stuck).dirty).toBe(true);
    const editing = keepEditing(stuck);
    expect(isEditable(editing)).toBe(true);
    expect(rawEditorView(editing).text).toBe(EDITED);
    expect(rawEditorView(editing).dirty).toBe(true);
  }); // End of the "read-only during a conflict" case
}); // End of the "draft the editor holds" suite

describe('starting a save', () => {
  it('is gated on dirty, so a clean draft sends nothing', () => {
    expect(canSave(fresh())).toBe(false);
    expect(((onHand) => beginSave(onHand, () => onHand))(fresh())).toBeNull();
    expect(canSave(editText(fresh(), EDITED))).toBe(true);
  });

  it('sends the draft as it stands, with nothing acknowledged on a first attempt', () => {
    const started = ((onHand) => beginSave(onHand, () => onHand))(editText(fresh(), EDITED));
    expect(started?.submission.candidate).toBe(EDITED);
    expect(started?.submission.baseRevision).toBe(BASE);
    expect(acknowledgementOf(started!.submission)).toEqual({ accepted: [] });
  }); // End of the "first attempt" case

  it('cannot start while a conflict is showing', () => {
    expect(canSave(inConflict())).toBe(false);
    expect(((onHand) => beginSave(onHand, () => onHand))(inConflict())).toBeNull();
  });

  it('answers a send that never left without inventing an outcome', () => {
    const started = ((onHand) => beginSave(onHand, () => onHand))(editText(fresh(), EDITED));
    const failed = saveCouldNotBeSent(started!.session, false, () => started!.session);
    expect(rawEditorView(failed).sendFailure).toEqual({ kind: 'notSent', reason: null });
    expect(rawEditorView(failed).outcome).toBeNull();
    expect(rawEditorView(failed).text).toBe(EDITED);
    expect(rawEditorView(failed).dirty).toBe(true);
  }); // End of the "send that never left" case

  it('keeps a save that may have written apart from one that certainly did not', () => {
    // The 2c-1b review's second finding. A failure at or after the rename may have
    // left the candidate on disk, and collapsing it into "nothing was written" is
    // `PROGRESS.md` D2 broken from the other side: this application would be
    // telling a person their file is untouched when it may not be.
    const started = ((onHand) => beginSave(onHand, () => onHand))(editText(fresh(), EDITED));
    const indeterminate = saveCouldNotBeSent(started!.session, true, () => started!.session);
    expect(rawEditorView(indeterminate).sendFailure).toEqual({
      kind: 'mayHaveWritten',
      reason: null
    });
    // And in neither case is there an outcome, or a lost draft.
    expect(rawEditorView(indeterminate).outcome).toBeNull();
    expect(rawEditorView(indeterminate).text).toBe(EDITED);
    expect(rawEditorView(indeterminate).dirty).toBe(true);
    expect(rawEditorView(indeterminate).editable).toBe(true);
  }); // End of the "may have written" case
}); // End of the "starting a save" suite

describe('taking the answer', () => {
  it('opens the seal, discharging the invalidation on the way', () => {
    // The seal is the only way to the outcome, and it is one-shot: after this the
    // same value is spent, which the next case is about.
    const after = roundTrip(editText(fresh(), EDITED), saved()).session;
    expect(after.outcome?.kind).toBe('saved');
  }); // End of the "opens the seal" case

  it('leaves the session alone when the seal has already been opened', () => {
    const started = ((onHand) => beginSave(onHand, () => onHand))(editText(fresh(), EDITED));
    const once = sealed(saved());
    const first = applySave(started!.session, once, () => started!.session);
    const second = applySave(first, once, () => first);
    // Not a second outcome, and not an invented one: the answer was delivered.
    expect(second.outcome).toBe(first.outcome);
    expect(rawEditorView(second).saving).toBe(false);
  }); // End of the "already opened" case

  it('rebases the draft on the candidate that was written', () => {
    const after = roundTrip(editText(fresh(), EDITED), saved()).session;
    expect(after.draft.baseRevision).toBe(AFTER);
    expect(after.draft.baseValue).toBe(EDITED);
    expect(isDirty(after.draft)).toBe(false);
    expect(rawEditorView(after).canSave).toBe(false);
  }); // End of the "rebases on the candidate" case

  it('rebases on a committed: false too, because that is a success', () => {
    const after = roundTrip(editText(fresh(), EDITED), saved(false)).session;
    expect(after.draft.baseRevision).toBe(AFTER);
    expect(isDirty(after.draft)).toBe(false);
    expect(rawEditorView(after).messages.map((message) => message.kind)).toEqual([
      'nothingToWrite'
    ]);
  }); // End of the "committed: false" case

  it('still reports a committed save as committed when the invalidation threw', () => {
    // `PROGRESS.md` D2, at the layer where a screen would otherwise turn a
    // written file into an error and invite a retry of a write that happened.
    const seal = sealed(saved());
    // Driven through the opener directly, because `applySave` supplies its own
    // body and a test cannot make that one throw.
    const opening = openWholeDocumentSave(seal, () => {
      throw new Error('the window could not be brought back into step');
    });
    expect(opening.kind).toBe('opened');
    if (opening.kind !== 'opened') {
      return;
    }
    expect(opening.outcome.outcome).toBe('saved');
    expect(opening.invalidation.kind).toBe('failed');
  }); // End of the "invalidation threw" case

  it("says the window is out of step when the issuer's own re-projection failed", () => {
    // **The 2c-1b review's third finding.** The invalidation that can really fail
    // on the running path is the workspace's, which runs before this module sees
    // anything; before the fix its failure reached the developer console and no
    // screen, so a committed save whose file could not be re-projected drew a
    // clean "the file was written". It is a line **beside** the saved arm, never
    // in place of it.
    const started = ((onHand) => beginSave(onHand, () => onHand))(editText(fresh(), EDITED));
    const after = applySave(
      started!.session,
      sealed(saved(), { kind: 'failed', failure: FAILURE }), () => started!.session
    );
    expect(after.outcome?.kind).toBe('saved');
    expect(rawEditorView(after).messages.map((message) => message.kind)).toEqual([
      'fileWritten',
      'windowOutOfStep'
    ]);
    // And the draft is still rebased, because the bytes really are on disk.
    expect(isDirty(after.draft)).toBe(false);
  }); // End of the "issuer's re-projection failed" case

  it('says it once, not twice, when both invalidations failed', () => {
    const started = ((onHand) => beginSave(onHand, () => onHand))(editText(fresh(), EDITED));
    const seal = sealed(saved(), { kind: 'failed', failure: FAILURE });
    // The opener's own callback cannot be made to throw through `applySave`, so
    // the pair is checked at the boundary this module reads: one failure of each
    // kind must still produce one sentence.
    const after = applySave(started!.session, seal, () => started!.session);
    const lines = rawEditorView(after).messages.filter(
      (message) => message.kind === 'windowOutOfStep'
    );
    expect(lines).toHaveLength(1);
  }); // End of the "said once" case
}); // End of the "taking the answer" suite

describe('the acknowledgement round trip', () => {
  it('offers to save anyway exactly when handing the findings back would work', () => {
    const refused = roundTrip(editText(fresh(), EDITED), refusal()).session;
    expect(rawEditorView(refused).refusalChoices).toEqual(['saveAnyway', 'keepEditing']);

    const unmovable = roundTrip(
      editText(fresh(), EDITED),
      refusal([MODEL_ERROR], 'RefusedForEditorModelErrors')
    ).session;
    expect(rawEditorView(unmovable).refusalChoices).toEqual(['keepEditing']);
  }); // End of the "offer" case

  it('re-sends every finding the refusal carried, bound to that exact candidate', () => {
    // The gate matches an **exact multiset**, so a subset is simply a second
    // refusal — and the acknowledgement is derived from the refusal rather than
    // assembled, which is what makes it match at all.
    const refused = roundTrip(editText(fresh(), EDITED), refusal([REJECTION, MODEL_ERROR])).session;
    const again = roundTrip(refused, saved(), true);
    expect(again.sent).toEqual([REJECTION, MODEL_ERROR]);
  }); // End of the "exact multiset" case

  it('withdraws the consent, and the control, the moment the text changes', () => {
    const refused = roundTrip(editText(fresh(), EDITED), refusal()).session;
    // Consent collected for the candidate that was refused…
    const consented = acknowledgeFindings(refused);
    expect(consented).not.toBe(refused);
    // …and then the person types.
    const moved = editText(consented, `${EDITED}# and one more line\n`);
    expect(outcomeIsStale(moved)).toBe(true);
    expect(rawEditorView(moved).findingsAreStale).toBe(true);
    expect(rawEditorView(moved).refusalChoices).toEqual(['keepEditing']);
    // What would go out now is a first attempt, not somebody else's consent.
    expect(acknowledgementOf(beginSave(moved, () => moved)!.submission)).toEqual({ accepted: [] });
  }); // End of the "consent withdrawn by an edit" case

  it('withdraws it on an undo as well, because undo changes the candidate too', () => {
    const refused = roundTrip(editText(fresh(), EDITED), refusal()).session;
    const undone = undoEdit(acknowledgeFindings(refused));
    expect(rawEditorView(undone).findingsAreStale).toBe(true);
    // Undone back to the base, so there is nothing to send at all.
    expect(rawEditorView(undone).canSave).toBe(false);
  }); // End of the "consent withdrawn by an undo" case

  it('records nothing when there is no refusal on screen', () => {
    const after = roundTrip(editText(fresh(), EDITED), saved()).session;
    expect(acknowledgeFindings(after)).toBe(after);
    const untouched = fresh();
    expect(acknowledgeFindings(untouched)).toBe(untouched);
  }); // End of the "nothing to acknowledge" case

  it('says what this mode is before any save, and what the parser said after one', () => {
    // `describeRawSave`'s model, used rather than restated: the standing sentence
    // is present from the first frame, and a parse rejection adds its own two.
    expect(rawEditorView(fresh()).rawSave.messages.map((message) => message.kind)).toEqual([
      'replacesWholeDocument'
    ]);
    const refused = roundTrip(editText(fresh(), EDITED), refusal()).session;
    expect(rawEditorView(refused).rawSave.messages.map((message) => message.kind)).toEqual([
      'replacesWholeDocument',
      'willNotLoad',
      'stoppedAt'
    ]);
    expect(rawEditorView(refused).rawSave.unparseable?.detail).toContain('mapping values');
  }); // End of the "raw-save model" case
}); // End of the "acknowledgement round trip" suite

describe('the conflict state', () => {
  it('says nothing was written, keeps the draft, and clears no dirtiness', () => {
    const stuck = inConflict();
    const view = rawEditorView(stuck);
    expect(view.messages.map((message) => message.kind)).toEqual([
      'nothingWasWritten',
      'changedElsewhere',
      'draftKeptInMemory',
      'reloadDiscardsDraft'
    ]);
    expect(view.text).toBe(EDITED);
    expect(view.dirty).toBe(true);
    // Byte for byte, and reachable by the one named way out.
    expect(textToCopy(stuck)).toBe(EDITED);
  }); // End of the "nothing written" case

  it('says so when the file changed again between the refusal and the read after it', () => {
    const twice = inConflict(AGAIN);
    expect(rawEditorView(twice).messages.map((message) => message.kind)).toContain(
      'changedAgainSinceRefusal'
    );
    expect(saveConflictOf(twice).changedAgain).toBe(true);
  }); // End of the "changed again" case

  it('carries enough revision information to tell the disk version from the draft', () => {
    // Read through the tested type guard since Phase 2d-6-5: `conflictOf`
    // answers either origin, and the three save-only fields are the save arm's.
    const stuck = saveConflictOf(inConflict(AGAIN));
    expect(stuck.expected).toBe(BASE);
    expect(stuck.found).toBe(AFTER);
    expect(stuck.diskRevision).toBe(AGAIN);
    expect(stuck.disk.id).toBe(DOCUMENT);
  }); // End of the "revision information" case

  it('never retries the stale candidate: there is no save anyway here', () => {
    const stuck = inConflict();
    expect(rawEditorView(stuck).conflictChoices).not.toContain('saveAnyway');
    expect(canSave(stuck)).toBe(false);
    expect(acknowledgeFindings(stuck)).toBe(stuck);
  }); // End of the "no retry" case

  it('offers the copy before the destructive choice, at both steps', () => {
    const stuck = inConflict();
    expect(rawEditorView(stuck).conflictChoices).toEqual([
      'keepEditing',
      'copyDraft',
      'reloadDiskVersion'
    ]);
    const asked = askToReload(stuck);
    expect(rawEditorView(asked).awaitingReloadConfirmation).toBe(true);
    expect(rawEditorView(asked).conflictChoices).toEqual([
      'keepEditing',
      'copyDraft',
      'confirmReload'
    ]);
  }); // End of the "copy before the destructive choice" case

  it('never reloads without a confirmation, and never automatically', () => {
    const recorder = adopting();
    const stuck = inConflict();
    // Straight to the destructive transition, with no warning step behind it.
    expect(loadDiskVersion(stuck, recorder.adopt, () => stuck)).toBe(stuck);
    // And the warning step alone is not a confirmation either.
    const asked = askToReload(stuck);
    expect(loadDiskVersion(asked, recorder.adopt, () => asked)).toBe(asked);
    expect(rawEditorView(asked).text).toBe(EDITED);
    // **Neither moved the window**, which is the half 2c-4a-2 adds: the conflict
    // itself installs nothing now, so an unconfirmed reload that installed
    // something would be the eager adoption back by another door.
    expect(recorder.adoptions).toEqual([]);
  }); // End of the "no reload without confirmation" case

  it('reloads once confirmed, and starts a clean draft over the disk version', () => {
    const recorder = adopting();
    const confirmed = confirmReload(askToReload(inConflict()));
    const reloaded = loadDiskVersion(confirmed, recorder.adopt, () => confirmed);
    const view = rawEditorView(reloaded);
    // The text and the revision are the conflict's own, which is what makes the
    // reseeded draft's base describe the bytes it holds.
    expect(view.text).toBe(DISK);
    expect(view.dirty).toBe(false);
    expect(view.canUndo).toBe(false);
    expect(view.outcome).toBeNull();
    expect(reloaded.draft.baseRevision).toBe(AFTER);
  }); // End of the "reload" case

  it('adopts the disk projection exactly once, in the same call that reseeds', () => {
    // **The consult's Q2 repair, as one operation.** A conflict installs nothing,
    // so the reload has to do both — and neither half is reachable without the
    // other: the adoption is minted from the conflict and its confirmation, and it
    // is handed over inside the transition rather than by the caller.
    const recorder = adopting();
    const confirmed = confirmReload(askToReload(inConflict()));
    loadDiskVersion(confirmed, recorder.adopt, () => confirmed);
    expect(recorder.adoptions).toHaveLength(1);
    // **The conflict itself is what crosses**, not a payload assembled from it:
    // authorization and installation happen in one call on `BrowserState`, so
    // there is no adoption value for a surface to keep, replay or forward.
    expect(recorder.adoptions[0]).toBe(conflictOf(confirmed));
    expect(recorder.adoptions[0]?.diskRevision).toBe(AFTER);
    expect(recorder.adoptions[0]?.diskText).toBe(DISK);
  }); // End of the "one adoption, one call" case

  it('finishes the reload when the window was already at the disk version', () => {
    // **`alreadyThere` is a success, and the confirmation pass is why.** A window
    // that has already reached the requested disk projection has satisfied the
    // request; reporting that as a refusal left the person on a confirm control
    // that could never do anything. The draft is reseeded exactly as it is for an
    // install, because the bytes it is seeded from are the same either way.
    const satisfied = adopting('alreadyThere');
    const confirmed = confirmReload(askToReload(inConflict()));
    const after = loadDiskVersion(confirmed, satisfied.adopt, () => confirmed);
    expect(after).not.toBe(confirmed);
    expect(rawEditorView(after).text).toBe(DISK);
    expect(conflictOf(after)).toBeNull();
  }); // End of the "already at the disk version" case

  it('reseeds nothing when the window refuses the adoption', () => {
    // **A `refused` is a real production answer** — a confirmation issued for
    // another conflict, one already spent, a conflict this window did not produce,
    // a document it no longer projects, or a projection replaced since the conflict
    // arrived when the window does not already hold the requested revision — and
    // taking it for a success would give the person a clean draft over a window that
    // never moved, with the conflict panel gone and nothing to say what happened.
    // Bytes the window already holds are **not** in that list: that is
    // `alreadyThere`, decided before the projection generation is compared at all,
    // and the case above is what it does.
    const refusing = adopting('refused');
    const confirmed = confirmReload(askToReload(inConflict()));
    const after = loadDiskVersion(confirmed, refusing.adopt, () => confirmed);
    expect(rawEditorView(after).text).toBe(EDITED);
    expect(conflictOf(after)).not.toBeNull();
    // **And the reload stops being offered rather than staying pressable**, which
    // is the 2c-4a-3a review's finding 3: the window refuses with no word about
    // which guard produced it, so the step is terminal and the panel discloses it
    // in place of the control. Terminal is what this panel draws, and not a claim
    // that a later ask would be refused too. *Keep editing* and the copy remain.
    expect(after.reload.kind).toBe('refused');
    expect(rawEditorView(after).reloadUnavailable).toBe(true);
    expect(rawEditorView(after).awaitingReloadConfirmation).toBe(false);
    expect(rawEditorView(after).conflictChoices).toEqual(['keepEditing', 'copyDraft']);
    // Asking again cannot spend anything a second time.
    expect(loadDiskVersion(after, refusing.adopt, () => after)).toBe(after);
    expect(refusing.adoptions).toHaveLength(1);
  }); // End of the "window refused the adoption" case

  it('refuses a confirmation issued for another conflict', () => {
    const recorder = adopting();
    const one = confirmReload(askToReload(inConflict()));
    const other = askToReload(inConflict(AGAIN));
    // The token travels, the conflict it was issued for does not.
    const spent: RawEditorSession = { ...other, reload: one.reload };
    expect(loadDiskVersion(spent, recorder.adopt, () => spent)).toBe(spent);
    expect(rawEditorView(spent).text).toBe(EDITED);
    // And nothing was installed on the strength of a token issued elsewhere.
    expect(recorder.adoptions).toEqual([]);
  }); // End of the "confirmation from another conflict" case

  it('says what the disk side holds, and whether it can be loaded at all', () => {
    // The disk side is view data now rather than a prop the pane supplies, and the
    // refusal that disables the confirm control is decided here rather than in
    // markup — a rule written into one renderer is carried by that renderer's
    // mounted suite alone.
    const ordinary = rawEditorView(inConflict());
    expect(ordinary.diskText).toEqual({ kind: 'text', text: DISK });
    expect(ordinary.diskRefusal).toBeNull();
    expect(ordinary.canReload).toBe(true);

    const carriage = rawEditorView(inConflict(AFTER, CRLF));
    expect(carriage.diskText).toEqual({ kind: 'text', text: CRLF });
    expect(carriage.diskRefusal).toEqual({ kind: 'lineEndingsNotPreserved' });
    expect(carriage.canReload).toBe(false);

    // **A file of zero characters is its own arm**, decided in `saveOutcome.ts`
    // since 2c-4a-3a rather than by three renderers each comparing a string to
    // `''` in markup (that review's finding 5). It is a fact about the file, not a
    // failure to obtain its text — 2c-4a-1's D1 — and loading it is legitimate.
    const emptied = rawEditorView(inConflict(AFTER, ''));
    expect(emptied.diskText).toEqual({ kind: 'empty' });
    expect(emptied.canReload).toBe(true);

    // No conflict, nothing to say about a disk side.
    const clean = rawEditorView(fresh());
    expect(clean.diskText).toBeNull();
    expect(clean.diskRefusal).toBeNull();
    expect(clean.canReload).toBe(false);
  }); // End of the "disk side on the view" case

  it('calls no choice "keep my draft", in either language', () => {
    // The prohibition of `2c-split-notes.md` section 6, checked against the
    // rendered labels and not only against the code names: 2c-4b is what that
    // phrase means, and using it here would make 2c-4b look already done.
    const choices: readonly ConflictChoice[] = [
      'keepEditing',
      'copyDraft',
      'reloadDiskVersion',
      'confirmReload'
    ];
    for (const locale of LOCALES) {
      for (const choice of choices) {
        // Both draft kinds, because `confirmReload` has one label per kind since
        // 2c-4a-3b and a forbidden phrase could hide in either of them.
        for (const draftKind of ['authoredText', 'operationChoice'] as const) {
          const label = DICTIONARIES[locale][conflictChoiceKey(choice, draftKind)].toLowerCase();
          expect(label).not.toContain('keep my draft');
          expect(label).not.toContain('conservar mi borrador');
        } // End of the loop over the two draft kinds
      } // End of the loop over the four choices
    } // End of the loop over both languages
  }); // End of the "no keep my draft" case
}); // End of the "conflict state" suite

describe('the reapply this editor can never have', () => {
  // **The consult's Q4 as an executable value.** A whole-document candidate has no
  // target, no field intent and no operation to re-resolve, so *reapply* could only
  // mean overwriting the newly read disk text with a stale string — plan section
  // 6.5 — or inventing a text merge, which the plan forbids for v1 outright.

  it('answers unavailable with a conflict on screen', () => {
    expect(reapplyToDiskVersion(inConflict())).toEqual({ kind: 'unavailable' });
  });

  it('answers unavailable with no conflict at all', () => {
    // **Permanent and not a state.** A surface that can never reapply says so
    // whether or not there is something to reapply, because answering *there is
    // nothing to do* would invite a caller to conclude the refusal was temporary.
    expect(reapplyToDiskVersion(fresh())).toEqual({ kind: 'unavailable' });
    expect(reapplyToDiskVersion(editText(fresh(), EDITED))).toEqual({ kind: 'unavailable' });
  });

  it('answers unavailable even for a payload that identified a snippet', () => {
    // A `ReapplyEvidence` is a boundary value and nothing in TypeScript proves
    // which command produced one. `enterReapply` (since Phase 2d-6-5; `beginReapply`
    // before it) reads this surface's permanent declaration **before** it looks at
    // the evidence, which is what makes the answer a declaration rather than an
    // accident of which arms the wire carries.
    const identified: SaveResult = makeConflict({
      disk: makeDocument({ id: DOCUMENT, revision: AFTER }),
      expected: BASE,
      found: AFTER,
      diskText: DISK,
      subject: {
        Identified: {
          target: makeMatch({ node: 40, document: DOCUMENT, revision: AFTER, trigger: ':a' })
        }
      }
    });
    const stuck = roundTrip(editText(fresh(), EDITED), identified).session;
    expect(conflictOf(stuck)).not.toBeNull();
    expect(reapplyToDiskVersion(stuck)).toEqual({ kind: 'unavailable' });
  });

  it('takes no adoption function, so no disk snapshot can be installed through it', () => {
    // The strongest thing a test can say about a transition that does nothing:
    // there is no parameter through which it could ask the window to move.
    expect(reapplyToDiskVersion).toHaveLength(1);
  });
}); // End of the raw reapply suite

describe('the external session — Phase 2d-6-5', () => {
  // **The receiver as a value, driven without a window.** Every envelope here is
  // sealed by the three constructors of `./observationDelivery.ts`, so the verdict
  // inside is about the observation inside by construction; `workspace.test.ts`
  // drives this same transition through a real `BrowserState`. Nothing here can
  // show a component registers the receiver — 2d-6-8 wires it — and nothing here
  // calls a command: no `BrowserState` exists in this file.

  /** The disk text every observation below reads, which this editor can hold. */
  const THEIRS = DISK;

  /** A disk text this editor refuses to reseed from: two CRLF lines among LF ones. */
  const THEIRS_WITH_CR = 'matches:\r\n  - trigger: x\n    replace: theirs\r\n';

  /**
   * One narrowed observation of the editor's file.
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
      document: DOCUMENT,
      previousRevision: BASE,
      diskRevision: AFTER,
      diskText: THEIRS,
      disk: makeDocument({ id: DOCUMENT, revision: AFTER }),
      findings: [],
      correspondences: null,
      ...overrides
    };
  } // End of function observation()

  /**
   * An observation of another file, which this editor is never about.
   *
   * @returns The observation.
   */
  function otherObservation(): ExternalConflictObservation {
    return observation({
      document: DOCUMENT + 1,
      previousRevision: null,
      diskRevision: AGAIN,
      disk: makeDocument({ id: DOCUMENT + 1, relativePath: 'match/other.yml', revision: AGAIN })
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
   * The external conflict a session shows, or a failure naming the case.
   *
   * @param held - The session.
   * @returns Its external conflict.
   */
  function externalOf(held: RawEditorSession): ExternalConflictModel<RoundTripText> {
    const conflict = held.externalConflict;
    if (conflict === null) {
      throw new Error('this case needs an external conflict on the session');
    }
    return conflict;
  } // End of function externalOf()

  /**
   * An edited session, dirty and sendable.
   *
   * @returns The session.
   */
  function edited(): RawEditorSession {
    return editText(fresh(), EDITED);
  } // End of function edited()

  /**
   * A session whose save was refused for findings — the refusal path.
   *
   * @returns The session showing the refusal.
   */
  function refusedOnce(): RawEditorSession {
    return roundTrip(edited(), refusal()).session;
  } // End of function refusedOnce()

  /**
   * A holder standing in for the component's `$state`: what a registered
   * receiver would update, and what the reader answers.
   *
   * @param first - The session installed at the start.
   * @returns The holder, its reader, and a receiver that applies to it.
   */
  function installed(first: RawEditorSession): {
    current: () => RawEditorSession;
    receive: (delivery: ObservationDelivery) => void;
    set: (next: RawEditorSession) => void;
  } {
    let session = first;
    return {
      current: () => session,
      receive: (delivery) => {
        session = applyObservation(session, delivery);
      },
      set: (next) => {
        session = next;
      }
    };
  } // End of function installed()

  describe('the seven arms over a session opened over one file (entries 6, 8, 11)', () => {
    it('raises over the file, freezes the box, and refuses the save at both doors', () => {
      const seen = observation();
      const next = applyObservation(edited(), raised(seen));
      const conflict = externalOf(next);
      expect(conflict.source).toBe(externalConflictSource(seen));
      expect(conflict.draft).toBe(next.draft);
      expect(conflict.draft.value).toBe(EDITED);
      expect(conflict.diskText).toBe(THEIRS);
      expect(isExternalConflict(conflict)).toBe(true);
      expect(conflictOf(next)).toBe(conflict);
      // `outcome` is untouched: no save ended (entry 6).
      expect(next.outcome).toBeNull();
      // Entry 8: neither door answers anything, and the box is read-only so the
      // copy is exactly the bytes the conflict is about.
      expect(canSave(next)).toBe(false);
      expect(beginSave(next, () => next)).toBeNull();
      expect(isEditable(next)).toBe(false);
      expect(editText(next, ORIGINAL)).toBe(next);
      expect(textToCopy(next)).toBe(EDITED);
      const view = rawEditorView(next);
      expect(view.canSave).toBe(false);
      expect(view.editable).toBe(false);
      expect(view.dirty).toBe(true);
      expect(view.conflict).toBe(conflict);
      expect(view.externalMessages).toBe(conflict.messages);
      expect(view.externalMessages.map((line) => line.kind)).toEqual([
        'fileChangedWhileOpen',
        'draftKeptInMemory',
        'reloadDiscardsDraft'
      ]);
      expect(view.messages).toEqual([]);
      expect(view.externalNotices).toEqual([]);
      expect(view.diskText).toEqual({ kind: 'text', text: THEIRS });
      expect(view.diskRefusal).toBeNull();
      expect(view.canReload).toBe(true);
      expect(view.conflictChoices).toEqual<readonly ConflictChoice[]>([
        'keepEditing',
        'copyDraft',
        'reloadDiskVersion'
      ]);
    }); // End of the "raised over the file" case

    it('answers null from beginSave called directly under an external conflict, refusal path included', () => {
      // **Past a disabled button.** The refusal panel's *Save anyway* would reach
      // `beginSave`, which asks `canSave` first; a caller that consented and then
      // pressed past the withdrawn control sends nothing.
      const blocked = applyObservation(refusedOnce(), raised(observation()));
      expect(blocked.outcome?.kind).toBe('refused');
      const consented = acknowledgeFindings(blocked);
      expect(beginSave(consented, () => consented)).toBeNull();
      const view = rawEditorView(blocked);
      expect(view.refusalChoices).toEqual(['keepEditing']);
      expect(view.findingsAreStale).toBe(false);
    });

    it('takes nothing from a delivery about another file, except the end of a wait recorded for it', () => {
      // An editor over one file told another changed is the object it was: a
      // reload of that conflict would reseed this box with the other file's text.
      const over = edited();
      const elsewhere = otherObservation();
      expect(applyObservation(over, raised(elsewhere))).toBe(over);
      expect(applyObservation(over, retainedDelivery(elsewhere))).toBe(over);
      expect(applyObservation(over, decided(null, elsewhere, true, 'raisedWithoutReload'))).toBe(over);
      const waiting: RawEditorSession = {
        ...over,
        awaitingReconciliation: new Map([[DOCUMENT + 1, elsewhere]])
      };
      expect(applyObservation(waiting, writtenHereDelivery(elsewhere)).awaitingReconciliation.size).toBe(0);
      expect(applyObservation(waiting, raised(elsewhere))).toEqual({
        ...waiting,
        awaitingReconciliation: new Map()
      });
      expect(canSave(waiting)).toBe(true);
    });

    it('changes nothing on coalesced and notLater, not even the object, and resets the reload on every replacing verdict', () => {
      const seen = observation();
      const asked = askToReload(applyObservation(edited(), raised(seen)));
      expect(rawEditorView(asked).awaitingReloadConfirmation).toBe(true);
      const standing = externalConflictSource(seen);
      expect(applyObservation(asked, decided(standing, observation({ sequence: 6 }), false, 'coalesced'))).toBe(asked);
      expect(
        applyObservation(asked, decided(standing, observation({ sequence: 4, diskRevision: AGAIN }), false, 'notLater'))
      ).toBe(asked);
      // Entry 12: a replacing verdict puts the reload back to idle.
      const later = observation({ sequence: 7, diskRevision: AGAIN });
      const replaced = applyObservation(confirmReload(asked), decided(standing, later, false, 'supersedes'));
      expect(replaced.reload).toBe(NOT_RELOADING);
      expect(externalOf(replaced).source).toBe(externalConflictSource(later));
      expect(externalOf(replaced).draft.value).toBe(EDITED);
      expect(rawEditorView(replaced).awaitingReloadConfirmation).toBe(false);
      const fresh = edited();
      expect(applyObservation(fresh, decided(null, seen, true, 'raisedWithoutReload')).reload).toBe(NOT_RELOADING);
    }); // End of the "coalesced, notLater and the reload reset" case
  }); // End of the "seven arms" suite

  describe('the held observation, and writtenHere by identity (entries 8 and 11)', () => {
    it('records a wait as a restriction on saving alone, and lifts it only for that observation', () => {
      const seen = observation();
      const waiting = applyObservation(edited(), retainedDelivery(seen));
      expect(waiting.awaitingReconciliation.get(DOCUMENT)).toBe(seen);
      expect(waiting.awaitingReconciliation.size).toBe(1);
      expect(waiting.externalConflict).toBeNull();
      expect(conflictOf(waiting)).toBeNull();
      // Saving is refused; drafting is not.
      expect(canSave(waiting)).toBe(false);
      expect(beginSave(waiting, () => waiting)).toBeNull();
      expect(isEditable(waiting)).toBe(true);
      const typed = editText(waiting, `${EDITED}# more\n`);
      expect(typed.awaitingReconciliation.get(DOCUMENT)).toBe(seen);
      expect(undoEdit(typed).awaitingReconciliation.get(DOCUMENT)).toBe(seen);
      const view = rawEditorView(waiting);
      expect(view.canSave).toBe(false);
      expect(view.editable).toBe(true);
      expect(view.conflict).toBeNull();
      expect(view.externalNotices).toEqual([{ kind: 'observationRetained' }]);
      // Lifted by identity, and by nothing else.
      expect(applyObservation(waiting, writtenHereDelivery(observation())).awaitingReconciliation.get(DOCUMENT)).toBe(seen);
      const lifted = applyObservation(waiting, writtenHereDelivery(seen));
      expect(lifted).toEqual({ ...waiting, awaitingReconciliation: new Map() });
      expect(canSave(lifted)).toBe(true);
      expect(beginSave(lifted, () => lifted)).not.toBeNull();
      expect(applyObservation(lifted, writtenHereDelivery(seen))).toBe(lifted);
      // Any decision about the awaited observation ends the wait; a later
      // `retained` replaces it; a re-held reading is still held.
      const standing = externalConflictSource(observation({ sequence: 9 }));
      expect(applyObservation(waiting, decided(standing, seen, false, 'notLater'))).toEqual({
        ...waiting,
        awaitingReconciliation: new Map()
      });
      expect(applyObservation(waiting, raised(seen)).awaitingReconciliation.size).toBe(0);
      const newer = observation({ sequence: 7 });
      expect(applyObservation(waiting, retainedDelivery(newer)).awaitingReconciliation.get(DOCUMENT)).toBe(newer);
      expect(applyObservation(waiting, retainedDelivery(seen)).awaitingReconciliation.get(DOCUMENT)).toBe(seen);
    }); // End of the "retained and writtenHere" case

    it('holds every delivery during its own save and replays them in arrival order (entry 5)', () => {
      const started = ((onHand) => beginSave(onHand, () => onHand))(edited());
      if (started === null) {
        throw new Error('an edited session is sendable');
      }
      const seen = observation();
      const later = observation({ sequence: 6 });
      const standing = externalConflictSource(seen);
      const held = applyObservation(
        applyObservation(applyObservation(started.session, retainedDelivery(seen)), raised(seen)),
        decided(standing, later, false, 'coalesced')
      );
      expect(held.externalConflict).toBeNull();
      expect(held.awaitingReconciliation.size).toBe(0);
      expect(held.heldDeliveries.map((one) => one.verdict.kind)).toEqual(['retained', 'raised', 'coalesced']);
      // The save's answer lands first, the held decisions second, in one
      // transition: the conflict `raised` announced stands, the wait `retained`
      // recorded ended with it, and `coalesced` found the conflict it was about.
      const settled = applySave(held, sealed(refusal()), () => held);
      expect(settled.heldDeliveries).toEqual([]);
      expect(settled.outcome?.kind).toBe('refused');
      expect(externalOf(settled).source).toBe(standing);
      expect(settled.awaitingReconciliation.size).toBe(0);
      expect(canSave(settled)).toBe(false);
      // On a commit too: the draft is rebased and the conflict stands beside the
      // success; on a seal already opened the save is over as well.
      const committed = applySave(held, sealed(saved()), () => held);
      expect(committed.outcome?.kind).toBe('saved');
      expect(committed.draft.baseRevision).toBe(AFTER);
      expect(externalOf(committed).source).toBe(standing);
      const twice = sealed(saved());
      applySave(held, twice, () => held);
      const again = applySave(held, twice, () => held);
      expect(again.phase).toBe('editing');
      expect(again.outcome).toBeNull();
      expect(externalOf(again).source).toBe(standing);
      // A save that produced no outcome consumes the hold too.
      const heldUncertain = applyObservation(started.session, decided(null, seen, true, 'raisedWithoutReload'));
      const failed = saveCouldNotBeSent(heldUncertain, true, () => heldUncertain);
      expect(failed.heldDeliveries).toEqual([]);
      expect(failed.sendFailure?.kind).toBe('mayHaveWritten');
      expect(failed.uncertaintyUnresolved).toBe(true);
      expect(externalOf(failed).source).toBe(externalConflictSource(seen));
    }); // End of the "held during the save" case
  }); // End of the "held observation" suite

  describe('collisions: only one conflict is active (entry 7), and the dismissal erases nothing (entry 9)', () => {
    it('retires a save conflict when an observation supersedes it, keeping the retained draft and dropping the confirmation', () => {
      const stuck = inConflict();
      const saveModel = saveConflictOf(stuck);
      const confirmed = confirmReload(askToReload(stuck));
      expect(confirmed.reload.kind).toBe('confirmed');
      const seen = observation({ diskRevision: AGAIN });
      const next = applyObservation(confirmed, decided(saveModel.source, seen, false, 'supersedes'));
      expect(next.outcome).toBeNull();
      expect(next.submitted).toBeNull();
      expect(next.extraMessages).toEqual([]);
      const conflict = externalOf(next);
      expect(conflict.draft).toBe(saveModel.draft);
      expect(conflict.draft.value).toBe(EDITED);
      expect(conflict.diskRevision).toBe(AGAIN);
      expect(conflictOf(next)).toBe(conflict);
      expect(isEditable(next)).toBe(false);
      // The reload is idle again and the confirmation is gone: nothing reseeds
      // and the window is not asked.
      expect(next.reload).toBe(NOT_RELOADING);
      expect(rawEditorView(next).awaitingReloadConfirmation).toBe(false);
      const recorder = adopting();
      expect(loadDiskVersion(next, recorder.adopt, () => next)).toBe(next);
      expect(recorder.adoptions).toEqual([]);
    }); // End of the "supersedes a save conflict" case

    it('keeps a committed success and a refusal as history, and lets a save that conflicts retire the external one', () => {
      const committed = roundTrip(edited(), saved()).session;
      const overSaved = applyObservation(committed, raised(observation()));
      expect(overSaved.outcome?.kind).toBe('saved');
      expect(conflictOf(overSaved)).toBe(overSaved.externalConflict);
      expect(rawEditorView(overSaved).messages.map((line) => line.kind)).toContain('fileWritten');
      // The reverse collision, kept for a direct call: a conflict answer retires
      // the external conflict, a refusal leaves it.
      const blocked = applyObservation(refusedOnce(), raised(observation()));
      const sending: RawEditorSession = { ...blocked, phase: 'saving', submitted: submissionOf(blocked.draft) };
      const conflicted = applySave(sending, sealed(conflict()), () => sending);
      expect(conflicted.externalConflict).toBeNull();
      expect(conflictOf(conflicted)?.source.kind).toBe('save');
      const refusedAgain = applySave(sending, sealed(refusal()), () => sending);
      expect(refusedAgain.externalConflict).toBe(blocked.externalConflict);
    }); // End of the "history and the reverse collision" case

    it('lets keepEditing cancel the warning and the panel, and nothing external (entry 9)', () => {
      const seen = observation();
      const blocked = askToReload(applyObservation(refusedOnce(), raised(seen)));
      expect(rawEditorView(blocked).awaitingReloadConfirmation).toBe(true);
      const kept = keepEditing(blocked);
      expect(kept.outcome).toBeNull();
      expect(kept.submitted).toBeNull();
      expect(kept.reload).toBe(NOT_RELOADING);
      expect(kept.externalConflict).toBe(blocked.externalConflict);
      // The box is not given back: the conflict stands, so the copy stays exact.
      expect(isEditable(kept)).toBe(false);
      expect(canSave(kept)).toBe(false);
      expect(textToCopy(kept)).toBe(EDITED);
      const withheld = applyObservation(edited(), decided(null, observation(), true, 'raisedWithoutReload'));
      expect(keepEditing(withheld).uncertaintyUnresolved).toBe(true);
      const waiting = applyObservation(edited(), retainedDelivery(seen));
      expect(keepEditing(waiting).awaitingReconciliation.get(DOCUMENT)).toBe(seen);
      expect(canSave(keepEditing(waiting))).toBe(false);
    }); // End of the "keepEditing erases nothing" case
  }); // End of the "collisions" suite

  describe('the uncertainty and its exits (entries 11, 14, 15; the record’s §5.5)', () => {
    it('withholds the reload on raisedWithoutReload until the snapshot is acknowledged', () => {
      const seen = observation();
      const withheld = applyObservation(edited(), decided(null, seen, true, 'raisedWithoutReload'));
      expect(withheld.uncertaintyUnresolved).toBe(true);
      const view = rawEditorView(withheld);
      expect(view.conflictChoices).toEqual<readonly ConflictChoice[]>(['keepEditing', 'copyDraft']);
      expect(view.canReload).toBe(false);
      expect(view.externalNotices).toEqual([{ kind: 'writeOutcomeUnknown' }]);
      expect(askToReload(withheld)).toBe(withheld);
      // A confirmation assembled by hand spends nothing and reseeds nothing.
      const recorder = adopting();
      const byHand: RawEditorSession = { ...withheld, reload: confirmReload(askToReload(inConflict())).reload };
      expect(loadDiskVersion(byHand, recorder.adopt, () => byHand)).toBe(byHand);
      expect(recorder.adoptions).toEqual([]);
      // Exit three: the acknowledgement, refused and then accepted.
      const asked: ExternalChangeConflictSource[] = [];
      expect(
        acknowledgeSnapshot(withheld, (source) => {
          asked.push(source);
          return 'refused';
        })
      ).toBe(withheld);
      expect(asked).toEqual([externalOf(withheld).source]);
      const acknowledged = acknowledgeSnapshot(withheld, () => 'acknowledged');
      expect(acknowledged).toEqual({ ...withheld, uncertaintyUnresolved: false, reload: NOT_RELOADING });
      expect(rawEditorView(acknowledged).conflictChoices).toContain('reloadDiskVersion');
      expect(rawEditorView(acknowledged).canReload).toBe(true);
      expect(rawEditorView(askToReload(acknowledged)).awaitingReloadConfirmation).toBe(true);
      // Nothing to acknowledge asks nothing.
      let askedWithoutCause = 0;
      const plain = applyObservation(edited(), raised(seen));
      expect(
        acknowledgeSnapshot(plain, () => {
          askedWithoutCause += 1;
          return 'acknowledged';
        })
      ).toBe(plain);
      expect(askedWithoutCause).toBe(0);
    }); // End of the "raisedWithoutReload" case

    it('clears the uncertainty when a later verdict under none replaces the conflict', () => {
      const first = observation();
      const withheld = applyObservation(edited(), decided(null, first, true, 'raisedWithoutReload'));
      const later = observation({ sequence: 6, diskRevision: AGAIN });
      const replaced = applyObservation(withheld, decided(externalConflictSource(first), later, false, 'supersedes'));
      expect(replaced.uncertaintyUnresolved).toBe(false);
      expect(externalOf(replaced).source).toBe(externalConflictSource(later));
      expect(rawEditorView(replaced).conflictChoices).toContain('reloadDiskVersion');
    });
  }); // End of the "uncertainty" suite

  describe('the reseed from an observation: the carriage-return refusal, consent, and the three adoption outcomes (entries 12, 23)', () => {
    it('refuses to reseed from a disk version holding a carriage return, and never normalizes it', () => {
      // **`CLAUDE.md` §6, at the external origin.** The observation's own disk
      // text is what a reload would reseed from; two CRLF lines among LF ones is
      // the committed fixture's shape, and re-applying a dominant convention
      // would reformat lines the person never touched.
      const seen = observation({ diskText: THEIRS_WITH_CR });
      const stuck = applyObservation(edited(), raised(seen));
      const view = rawEditorView(stuck);
      expect(view.diskRefusal).toEqual({ kind: 'lineEndingsNotPreserved' });
      expect(view.canReload).toBe(false);
      expect(view.diskText).toEqual({ kind: 'text', text: THEIRS_WITH_CR });
      const confirmed = confirmReload(askToReload(stuck));
      expect(confirmed.reload.kind).toBe('confirmed');
      const recorder = adopting();
      expect(loadDiskVersion(confirmed, recorder.adopt, () => confirmed)).toBe(confirmed);
      expect(recorder.adoptions).toEqual([]);
      // The draft is untouched, the conflict stands, and nothing was written.
      expect(confirmed.draft.value).toBe(EDITED);
      expect(externalOf(confirmed).source).toBe(externalConflictSource(seen));
      expect(rawEditorRefusal(externalOf(confirmed).diskText)).not.toBeNull();
    }); // End of the "carriage return refused" case

    it('withdraws consent with the reseed: an acknowledgement for one draft cannot be spent on the reseeded one', () => {
      // A refusal consented to, then the watcher's conflict, then the reload.
      const consented = acknowledgeFindings(refusedOnce());
      expect(submissionOf(consented.draft).acknowledgement.accepted).toHaveLength(1);
      const seen = observation();
      const blocked = applyObservation(consented, raised(seen));
      // The refusal stays as history with its consent — and nothing can spend
      // it: the box is frozen and the save refused.
      expect(blocked.outcome?.kind).toBe('refused');
      expect(submissionOf(blocked.draft).acknowledgement.accepted).toHaveLength(1);
      expect(beginSave(blocked, () => blocked)).toBeNull();
      const recorder = adopting();
      const reseeded = ((onHand) => loadDiskVersion(onHand, recorder.adopt, () => onHand))(confirmReload(askToReload(blocked)));
      expect(recorder.adoptions).toEqual([externalOf(blocked)]);
      expect(reseeded.draft.value).toBe(THEIRS);
      expect(reseeded.draft.baseRevision).toBe(AFTER);
      expect(isDirty(reseeded.draft)).toBe(false);
      expect(reseeded.outcome).toBeNull();
      expect(reseeded.submitted).toBeNull();
      expect(reseeded.externalConflict).toBeNull();
      expect(submissionOf(reseeded.draft).acknowledgement.accepted).toEqual([]);
      expect(acknowledgeFindings(reseeded)).toBe(reseeded);
      // A save of the reseeded draft, once edited, carries no consent.
      const started = ((onHand) => beginSave(onHand, () => onHand))(editText(reseeded, `${THEIRS}# edited\n`));
      expect(started).not.toBeNull();
      expect(acknowledgementOf(started!.submission).accepted).toEqual([]);
    }); // End of the "consent withdrawn" case

    it('answers every adoption outcome for the external origin', () => {
      const seen = observation();
      const confirmed = confirmReload(askToReload(applyObservation(edited(), raised(seen))));
      expect(rawEditorView(confirmed).conflictChoices).toEqual<readonly ConflictChoice[]>([
        'keepEditing',
        'copyDraft',
        'confirmReload'
      ]);
      // `installed` and `alreadyThere` both reseed.
      for (const answer of ['installed', 'alreadyThere'] as const) {
        const recorder = adopting(answer);
        const reseeded = loadDiskVersion(confirmed, recorder.adopt, () => confirmed);
        expect(recorder.adoptions).toHaveLength(1);
        expect(reseeded.draft.value).toBe(THEIRS);
        expect(reseeded.draft.baseRevision).toBe(AFTER);
        expect(reseeded.externalConflict).toBeNull();
        expect(reseeded.uncertaintyUnresolved).toBe(false);
        expect(reseeded.reload).toBe(NOT_RELOADING);
        expect(isEditable(reseeded)).toBe(true);
      } // End of the loop over the two satisfied answers
      // `refused` reseeds nothing and stops offering the control; the conflict
      // stands, and *Keep editing* resets the step for a fresh attempt.
      const recorder = adopting('refused');
      const refused = loadDiskVersion(confirmed, recorder.adopt, () => confirmed);
      expect(recorder.adoptions).toHaveLength(1);
      expect(refused.draft).toBe(confirmed.draft);
      expect(refused.reload).toEqual({ kind: 'refused' });
      expect(externalOf(refused).source).toBe(externalConflictSource(seen));
      const view = rawEditorView(refused);
      expect(view.reloadUnavailable).toBe(true);
      expect(view.conflictChoices).toEqual<readonly ConflictChoice[]>(['keepEditing', 'copyDraft']);
      expect(keepEditing(refused).reload).toBe(NOT_RELOADING);
      expect(externalOf(keepEditing(refused)).source).toBe(externalConflictSource(seen));
      // A wait about another observation survives the reseed: an adoption
      // decides nothing about it.
      const waitingToo = applyObservation(confirmed, retainedDelivery(observation({ sequence: 8 })));
      const reseededWaiting = loadDiskVersion(waitingToo, adopting().adopt, () => waitingToo);
      expect(reseededWaiting.draft.value).toBe(THEIRS);
      expect(reseededWaiting.awaitingReconciliation.size).toBe(1);
      expect(canSave(editText(reseededWaiting, EDITED))).toBe(false);
    }); // End of the "three adoption outcomes" case

    it('reapplies nothing for a conflict of either origin, and still takes no adoption function (entry 22)', () => {
      const seen = observation({
        correspondences: { base_revision: BASE, disk_revision: AFTER, entries: [] }
      });
      expect(reapplyToDiskVersion(applyObservation(edited(), raised(seen)))).toEqual({ kind: 'unavailable' });
      expect(reapplyToDiskVersion(applyObservation(edited(), retainedDelivery(seen)))).toEqual({ kind: 'unavailable' });
      expect(reapplyToDiskVersion(inConflict())).toEqual({ kind: 'unavailable' });
      expect(reapplyToDiskVersion).toHaveLength(1);
    });
  }); // End of the "reseed from an observation" suite

  describe('the door and the settlement against the installed session (2d-6-4’s review, taken)', () => {
    it('refuses a save when the draft read displaced the installed session', () => {
      // A getter behind the draft's value is caller code that runs between the
      // block and the spend; a window's receiver, run from it, replaces the
      // installed session with one carrying an external conflict. The save must
      // be refused against that session, not spent against the one handed in.
      const holder = installed(edited());
      const handedIn = holder.current();
      const seen = observation();
      const trapped: RawEditorSession = {
        ...handedIn,
        draft: {
          ...handedIn.draft,
          get value(): RoundTripText {
            holder.receive(raised(seen));
            return handedIn.draft.value;
          }
        }
      };
      holder.set(trapped);
      expect(beginSave(trapped, holder.current)).toBeNull();
      expect(holder.current().externalConflict?.source).toBe(externalConflictSource(seen));
      // The same read that displaces nothing spends as before.
      const quiet = installed(edited());
      expect(beginSave(quiet.current(), quiet.current)).not.toBeNull();
      // And a reader answering a session that carries a block is refused too.
      const waiting = installed(applyObservation(edited(), retainedDelivery(seen)));
      expect(beginSave(edited(), waiting.current)).toBeNull();
    }); // End of the "displaced during the draft read" case

    it('refuses a save when a later read of this door displaced the installed session (the review’s first blocker)', () => {
      // **The installed session is read once, and it must be read last.** The
      // door reads the draft's value more than once — the carriage-return check,
      // the dirtiness `canSave` derives, the submission — and spreads the
      // session; a getter that stays quiet on the first read and delivers on a
      // later one, or on the spread, ran after a check made too early. Three
      // shapes, one rule: nothing caller-controlled runs after the reader.
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
        readonly trapped: RawEditorSession;
        readonly reads: () => number;
      } {
        const holder = installed(edited());
        const handedIn = holder.current();
        let reads = 0;
        const trapped: RawEditorSession = {
          ...handedIn,
          draft: {
            ...handedIn.draft,
            get value(): RoundTripText {
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
      // How many times the door reads the value, measured rather than assumed;
      // a delivery on any one of them, the last included, must be refused.
      const quiet = deliveringOnRead(null);
      expect(beginSave(quiet.trapped, quiet.holder.current)).not.toBeNull();
      const total = quiet.reads();
      expect(total).toBeGreaterThanOrEqual(2);
      for (let on = 1; on <= total; on += 1) {
        const displaced = deliveringOnRead(on);
        expect(beginSave(displaced.trapped, displaced.holder.current)).toBeNull();
        expect(externalOf(displaced.holder.current()).source).toBe(externalConflictSource(seen));
      } // End of the loop over the reads of the draft's value
      // The spread that builds the waiting session reads every own property.
      // Armed once: the receiver's own spread reads it again.
      const spreading = installed(edited());
      const beforeSpread = spreading.current();
      let armed = true;
      const trappedSpread: RawEditorSession = {
        ...beforeSpread,
        get extraMessages(): readonly SaveOutcomeMessage[] {
          if (armed) {
            armed = false;
            spreading.receive(raised(seen));
          }
          return [];
        }
      };
      spreading.set(trappedSpread);
      expect(beginSave(trappedSpread, spreading.current)).toBeNull();
      expect(externalOf(spreading.current()).source).toBe(externalConflictSource(seen));
    }); // End of the "displaced during a later read" case

    it('checks the carriage-return refusal on the exact bytes it would send', () => {
      // A getter answering a clean text to the first read and a text holding a
      // carriage return to the next one: the check that passed was made on
      // bytes that never reach the wire. The submission's own candidate is what
      // must be checked, so the door answers nothing.
      const handedIn = edited();
      let reads = 0;
      const shifting: RawEditorSession = {
        ...handedIn,
        draft: {
          ...handedIn.draft,
          get value(): RoundTripText {
            reads += 1;
            return (reads === 1 ? handedIn.draft.value : CRLF) as RoundTripText;
          }
        }
      };
      const started = beginSave(shifting, () => shifting);
      expect(started === null || rawEditorRefusal(started.submission.candidate) === null).toBe(true);
    }); // End of the "checked on the exact bytes" case

    it('reseeds over the installed session, and answers it untouched when the adoption itself replaced the conflict (the review’s third finding)', () => {
      // **The adoption runs the window's own reads of the observation's
      // projection**, and a getter there can tell the window of a later reading;
      // the receiver installs what the window decides while the adoption is
      // still inside `adopt`. A reseed built over the session handed in would
      // hand the caller a session with no record of that decision.
      const seen = observation();
      /**
       * A holder over a session confirmed to reload from `seen`.
       *
       * @returns The holder.
       */
      function confirmedToReload(): ReturnType<typeof installed> {
        return installed(confirmReload(askToReload(applyObservation(edited(), raised(seen)))));
      } // End of function confirmedToReload()
      // A wait recorded during a satisfied adoption is carried by the reseed.
      const waiting = confirmedToReload();
      const later = observation({ sequence: 8 });
      const recorder = adopting('installed');
      const reseeded = loadDiskVersion(
        waiting.current(),
        (conflict, confirmation) => {
          waiting.receive(retainedDelivery(later));
          return recorder.adopt(conflict, confirmation);
        },
        waiting.current
      );
      expect(recorder.adoptions).toHaveLength(1);
      expect(reseeded.draft.value).toBe(THEIRS);
      expect(reseeded.draft.baseRevision).toBe(AFTER);
      expect(reseeded.externalConflict).toBeNull();
      expect(reseeded.awaitingReconciliation.get(DOCUMENT)).toBe(later);
      expect(canSave(editText(reseeded, EDITED))).toBe(false);
      // A supersession delivered during the adoption, which the window then
      // refuses: the installed session — the newer conflict, its reload reset —
      // is answered untouched, and nothing is reseeded over it.
      const superseded = confirmedToReload();
      const newer = observation({ sequence: 6, diskRevision: AGAIN });
      const refusing = adopting('refused');
      const answered = loadDiskVersion(
        superseded.current(),
        (conflict, confirmation) => {
          superseded.receive(decided(externalConflictSource(seen), newer, false, 'supersedes'));
          return refusing.adopt(conflict, confirmation);
        },
        superseded.current
      );
      expect(refusing.adoptions).toHaveLength(1);
      expect(answered).toBe(superseded.current());
      expect(externalOf(answered).source).toBe(externalConflictSource(newer));
      expect(answered.reload).toBe(NOT_RELOADING);
      expect(answered.draft.value).toBe(EDITED);
      // Displaced before the window is asked: the installed session is answered
      // and the window never asked.
      const early = confirmedToReload();
      const before = early.current();
      // Armed once: the receiver's own spread reads the step again.
      let armed = true;
      const trapped: RawEditorSession = {
        ...before,
        get reload(): ReloadStep {
          if (armed) {
            armed = false;
            early.receive(retainedDelivery(later));
          }
          return before.reload;
        }
      };
      early.set(trapped);
      const untouched = adopting('installed');
      expect(loadDiskVersion(trapped, untouched.adopt, early.current)).toBe(early.current());
      expect(untouched.adoptions).toEqual([]);
      expect(early.current().awaitingReconciliation.get(DOCUMENT)).toBe(later);
      // A reader answering the capture it was handed reseeds only that capture —
      // the documented cost of a reader that does not read what the caller installs.
      const alone = confirmedToReload();
      const lost = ((onHand) => loadDiskVersion(onHand, (conflict, confirmation) => {
        alone.receive(retainedDelivery(later));
        return adopting('installed').adopt(conflict, confirmation);
      }, () => onHand))(alone.current());
      expect(lost.awaitingReconciliation.size).toBe(0);
    }); // End of the "reseed over the installed session" case

    it('settles against the installed session and replays a delivery that arrived during its own replay', () => {
      // With `retained(A), raised(A)` held, a getter behind A's `document`
      // publishes B while A is being replayed; the window delivers B to the
      // installed session — still `saving`, so it is appended there — and a
      // settlement that returned only its own replay would let the caller
      // overwrite that append. The settled session must carry B.
      const started = ((onHand) => beginSave(onHand, () => onHand))(edited());
      if (started === null) {
        throw new Error('an edited session is sendable');
      }
      const later = observation({ sequence: 6, diskRevision: AGAIN });
      /**
       * A holder over the in-flight session with A held twice, A's `document`
       * armed to deliver B's supersession once.
       *
       * @returns The holder, and the observation A.
       */
      function armed(): { readonly holder: ReturnType<typeof installed>; readonly seen: ExternalConflictObservation; readonly fired: () => boolean } {
        const holder = installed(started!.session);
        let live = false;
        let fired = false;
        const seen: ExternalConflictObservation = {
          ...observation(),
          get document(): number {
            if (live) {
              live = false;
              fired = true;
              holder.receive(decided(externalConflictSource(this), later, false, 'supersedes'));
            }
            return DOCUMENT;
          }
        };
        holder.receive(retainedDelivery(seen));
        holder.receive(raised(seen));
        expect(holder.current().heldDeliveries.map((one) => one.verdict.kind)).toEqual(['retained', 'raised']);
        live = true;
        return { holder, seen, fired: () => fired };
      } // End of function armed()
      const first = armed();
      const settled = applySave(first.holder.current(), sealed(refusal()), first.holder.current);
      expect(first.fired()).toBe(true);
      expect(settled.outcome?.kind).toBe('refused');
      expect(settled.heldDeliveries).toEqual([]);
      expect(settled.awaitingReconciliation.size).toBe(0);
      expect(externalOf(settled).source).toBe(externalConflictSource(later));
      // The same through a send that produced no outcome.
      const second = armed();
      const failed = saveCouldNotBeSent(second.holder.current(), false, second.holder.current);
      expect(failed.heldDeliveries).toEqual([]);
      expect(externalOf(failed).source).toBe(externalConflictSource(later));
      // A reader answering the capture it was handed settles only that capture —
      // the documented cost of a reader that does not read what the caller installs.
      const alone = armed();
      expect(externalOf(((onHand) => applySave(onHand, sealed(refusal()), () => onHand))(alone.holder.current())).source).toBe(
        externalConflictSource(alone.seen)
      );
    }); // End of the "delivery during the replay" case
  }); // End of the "against the installed session" suite
}); // End of the "external session" suite
