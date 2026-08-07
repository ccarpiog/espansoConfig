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
import { makeDocument } from './fixtures';
import {
  openWholeDocumentSave,
  sealWholeDocumentSave,
  type SealedWholeDocumentSave
} from './invalidation';
import {
  acknowledgeFindings,
  acknowledgementOf,
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
  redoEdit,
  saveCouldNotBeSent,
  startRawEditor,
  textToCopy,
  undoEdit,
  type RawEditorSession,
  type RoundTripText
} from './rawEditor';
import type { AdoptTheDiskVersion } from './editorSave';
import type { DiskAdoptionOutcome } from './saveOutcome';
import { conflictChoiceKey, type ConflictChoice, type ConflictModel } from './saveOutcome';

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
 *   a spent confirmation, a conflict this window did not produce, or a projection
 *   replaced since it arrived — and a reload that took it for a success would
 *   reseed over a window that never moved.
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
  const started = beginSave(consented);
  if (started === null) {
    throw new Error('this case is about a save that could be started');
  }
  const sent = [...acknowledgementOf(started.submission).accepted];
  return { session: applySave(started.session, sealed(result)), sent };
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
    expect(beginSave(typed)?.submission.candidate).toBe(EDITED);

    // Reloading a disk version: refused, and the draft is left exactly as it was —
    // **and the window is not moved either**, which is what the recorder pins. The
    // disk text is the conflict's own since 2c-4a-2, so the carriage returns are
    // put there rather than handed in at the call.
    const carriage = adopting();
    const refusedReload = confirmReload(askToReload(inConflict(AFTER, CRLF)));
    const unchanged = loadDiskVersion(refusedReload, carriage.adopt);
    expect(unchanged).toBe(refusedReload);
    expect(rawEditorView(unchanged).text).toBe(EDITED);
    expect(carriage.adoptions).toEqual([]);
    // The same call over an LF disk version does reload, so that guard is a refusal
    // and not a broken transition either.
    const clean = adopting();
    const confirmed = confirmReload(askToReload(inConflict()));
    expect(rawEditorView(loadDiskVersion(confirmed, clean.adopt)).text).toBe(DISK);
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
    expect(beginSave(planted)).toBeNull();
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
    const started = beginSave(editText(fresh(), EDITED));
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
    expect(beginSave(fresh())).toBeNull();
    expect(canSave(editText(fresh(), EDITED))).toBe(true);
  });

  it('sends the draft as it stands, with nothing acknowledged on a first attempt', () => {
    const started = beginSave(editText(fresh(), EDITED));
    expect(started?.submission.candidate).toBe(EDITED);
    expect(started?.submission.baseRevision).toBe(BASE);
    expect(acknowledgementOf(started!.submission)).toEqual({ accepted: [] });
  }); // End of the "first attempt" case

  it('cannot start while a conflict is showing', () => {
    expect(canSave(inConflict())).toBe(false);
    expect(beginSave(inConflict())).toBeNull();
  });

  it('answers a send that never left without inventing an outcome', () => {
    const started = beginSave(editText(fresh(), EDITED));
    const failed = saveCouldNotBeSent(started!.session, false);
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
    const started = beginSave(editText(fresh(), EDITED));
    const indeterminate = saveCouldNotBeSent(started!.session, true);
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
    const started = beginSave(editText(fresh(), EDITED));
    const once = sealed(saved());
    const first = applySave(started!.session, once);
    const second = applySave(first, once);
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
    const started = beginSave(editText(fresh(), EDITED));
    const after = applySave(
      started!.session,
      sealed(saved(), { kind: 'failed', failure: FAILURE })
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
    const started = beginSave(editText(fresh(), EDITED));
    const seal = sealed(saved(), { kind: 'failed', failure: FAILURE });
    // The opener's own callback cannot be made to throw through `applySave`, so
    // the pair is checked at the boundary this module reads: one failure of each
    // kind must still produce one sentence.
    const after = applySave(started!.session, seal);
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
    expect(acknowledgementOf(beginSave(moved)!.submission)).toEqual({ accepted: [] });
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
    expect(conflictOf(twice)?.changedAgain).toBe(true);
  }); // End of the "changed again" case

  it('carries enough revision information to tell the disk version from the draft', () => {
    const stuck = conflictOf(inConflict(AGAIN));
    expect(stuck?.expected).toBe(BASE);
    expect(stuck?.found).toBe(AFTER);
    expect(stuck?.diskRevision).toBe(AGAIN);
    expect(stuck?.disk.id).toBe(DOCUMENT);
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
    expect(loadDiskVersion(stuck, recorder.adopt)).toBe(stuck);
    // And the warning step alone is not a confirmation either.
    const asked = askToReload(stuck);
    expect(loadDiskVersion(asked, recorder.adopt)).toBe(asked);
    expect(rawEditorView(asked).text).toBe(EDITED);
    // **Neither moved the window**, which is the half 2c-4a-2 adds: the conflict
    // itself installs nothing now, so an unconfirmed reload that installed
    // something would be the eager adoption back by another door.
    expect(recorder.adoptions).toEqual([]);
  }); // End of the "no reload without confirmation" case

  it('reloads once confirmed, and starts a clean draft over the disk version', () => {
    const recorder = adopting();
    const confirmed = confirmReload(askToReload(inConflict()));
    const reloaded = loadDiskVersion(confirmed, recorder.adopt);
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
    loadDiskVersion(confirmed, recorder.adopt);
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
    const after = loadDiskVersion(confirmed, satisfied.adopt);
    expect(after).not.toBe(confirmed);
    expect(rawEditorView(after).text).toBe(DISK);
    expect(conflictOf(after)).toBeNull();
  }); // End of the "already at the disk version" case

  it('reseeds nothing when the window refuses the adoption', () => {
    // **A `refused` is a real production answer** — a spent confirmation, a
    // conflict this window did not produce, a document it no longer projects, or a
    // projection replaced since the conflict arrived — and taking it for a success
    // would give the person a clean draft over a window that never moved, with the
    // conflict panel gone and nothing to say what happened. Bytes the window
    // already holds are **not** in that list: that is `alreadyThere`, and the case
    // above is what it does.
    const refusing = adopting('refused');
    const confirmed = confirmReload(askToReload(inConflict()));
    const after = loadDiskVersion(confirmed, refusing.adopt);
    expect(after).toBe(confirmed);
    expect(rawEditorView(after).text).toBe(EDITED);
    expect(conflictOf(after)).not.toBeNull();
  }); // End of the "window refused the adoption" case

  it('refuses a confirmation issued for another conflict', () => {
    const recorder = adopting();
    const one = confirmReload(askToReload(inConflict()));
    const other = askToReload(inConflict(AGAIN));
    // The token travels, the conflict it was issued for does not.
    const spent: RawEditorSession = { ...other, reload: one.reload };
    expect(loadDiskVersion(spent, recorder.adopt)).toBe(spent);
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
    expect(ordinary.diskText).toBe(DISK);
    expect(ordinary.diskRefusal).toBeNull();
    expect(ordinary.canReload).toBe(true);

    const carriage = rawEditorView(inConflict(AFTER, CRLF));
    expect(carriage.diskText).toBe(CRLF);
    expect(carriage.diskRefusal).toEqual({ kind: 'lineEndingsNotPreserved' });
    expect(carriage.canReload).toBe(false);

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
        const label = DICTIONARIES[locale][conflictChoiceKey(choice)].toLowerCase();
        expect(label).not.toContain('keep my draft');
        expect(label).not.toContain('conservar mi borrador');
      }
    } // End of the loop over both languages
  }); // End of the "no keep my draft" case
}); // End of the "conflict state" suite
