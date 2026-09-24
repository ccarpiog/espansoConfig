/**
 * The local raw editor's state machine, driven without a screen — Phase 3-8-1.
 *
 * One group per acceptance clause of the 3-8-1 cut (`docs/decisions/3-split-notes.md`
 * §2 step 3-8, its 2026-09-24 addendum): no JavaScript byte slicing; the carriage
 * return refused at load, at edit and at send; `ItemRangeNotContiguous` as the
 * whole-document fallback; retention of the draft under conflict and refusal; a
 * commit invalidating the old identity; an uncertain write that keeps the text and
 * needs reconciliation; and CF-55's model half — under one held save *Undo* and
 * *Redo* are neither enabled nor mutating. The whole-document editor's half of
 * CF-55 is in `rawEditor.test.ts`.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DICTIONARIES } from '../i18n/dictionaries';
import { LOCALES } from '../i18n/locale';
import type { CommandResult } from '../ipc/commands';
import type { IpcFailure } from '../ipc/errors';
import type {
  ContentRevision,
  EditError,
  Finding,
  MatchId,
  OwnedItemText,
  SaveResult
} from '../ipc/types';
import { arbitratedDelivery, retainedDelivery, writtenHereDelivery } from './observationDelivery';
import type { ExternalConflictObservation } from './conflictSource';
import { canRedo, canUndo, startDraft, textDraftRules } from './draft';
import { makeDocument } from './fixtures';
import type { DiskAdoptionOutcome } from './saveOutcome';
import {
  acknowledgeFindings,
  applyObservation,
  applySave,
  askToReload,
  baseRevisionOf,
  beginSave,
  canRedoEdit,
  canSave,
  canUndoEdit,
  confirmReload,
  editErrorOf,
  editText,
  fallbackOf,
  keepEditing,
  openRawSnippet,
  rawSnippetRefusalKey,
  rawSnippetView,
  reconcileWithDisk,
  redoEdit,
  reloadTheDiskVersion,
  saveCouldNotBeSent,
  textToCopy,
  undoEdit,
  type RawSnippetRefusal,
  type RawSnippetSession,
  type StartedRawSnippetSave
} from './rawSnippet';

/** The document the snippet lives in. */
const DOCUMENT = 4;

/** The revision the snippet's text was read at. */
const BASE: ContentRevision = 'a'.repeat(64);

/** The revision the file holds after a commit. */
const AFTER: ContentRevision = 'b'.repeat(64);

/** The snippet, by the identity the read was made with. */
const MATCH: MatchId = { document: DOCUMENT, revision: BASE, node: 9 };

/** The snippet's identity in the revision a commit produced. */
const MOVED: MatchId = { document: DOCUMENT, revision: AFTER, node: 11 };

/**
 * The snippet's owned text: a leading comment, a precomposed `é`, a decomposed
 * `é` and an astral `😀` before the value — so any cut by a byte offset would land
 * somewhere else in a JavaScript string.
 */
const OWNED = '  # greeting\n  - trigger: ":hé"\n    replace: "é 😀 hi"\n';

/** What one edit produces. */
const EDITED = '  # greeting\n  - trigger: ":hé"\n    replace: "é 😀 hello"\n';

/** A second edit, so a session can hold both an undo and a redo step. */
const THIRD = '  - trigger: ":hé"\n    replace: "third"\n';

/** A span, for the core refusals that carry one. */
const HOLE = { start: 3, end: 17 };

/**
 * What `match_item_text` answers for one text.
 *
 * @param text - The range's text.
 * @returns The command's answer.
 */
function read(text: string = OWNED): CommandResult<OwnedItemText> {
  return { ok: true, value: { text, first_line: 7, line_count: 3 } };
} // End of function read()

/**
 * A command failure carrying a core refusal as `itemTextRefused`.
 *
 * @param error - The core's refusal.
 * @returns The failure.
 */
function itemTextRefused(error: EditError): IpcFailure {
  return { kind: 'command', error: { code: 'itemTextRefused', error } };
} // End of function itemTextRefused()

/**
 * A command failure carrying an engine refusal of the save.
 *
 * @param error - The core's refusal.
 * @returns The failure, which wrote nothing.
 */
function engineRefused(error: EditError): IpcFailure {
  return {
    kind: 'command',
    error: { code: 'saveFailed', error: { Patch: error }, may_have_written: false }
  };
} // End of function engineRefused()

/** A failure after the rename: the file may hold the submitted text. */
const MAY_HAVE_WRITTEN: IpcFailure = {
  kind: 'command',
  error: {
    code: 'saveFailed',
    error: { Target: { TargetMissing: { path: '/nowhere/match/base.yml' } } },
    may_have_written: true
  }
};

/**
 * A session over {@link OWNED}, or a failure naming the case.
 *
 * @param answer - What the read answered.
 * @returns The session.
 */
function fresh(answer: CommandResult<OwnedItemText> = read()): RawSnippetSession {
  const opening = openRawSnippet(MATCH, answer);
  if (opening.kind !== 'opened') {
    throw new Error('this case needs a text the editor can open');
  }
  return opening.session;
} // End of function fresh()

/**
 * The refusal an opening answered, or a failure naming the case.
 *
 * @param answer - What the read answered.
 * @returns The refusal and its fallback.
 */
function refusedBy(answer: CommandResult<OwnedItemText>): {
  readonly refusal: RawSnippetRefusal;
  readonly fallback: string | null;
} {
  const opening = openRawSnippet(MATCH, answer);
  if (opening.kind !== 'refused') {
    throw new Error('this case needs a refused opening');
  }
  return opening;
} // End of function refusedBy()

/**
 * Starts a save of a session with a reader answering that very session.
 *
 * @param session - The session to save.
 * @returns What was started, or a failure naming the case.
 */
function started(session: RawSnippetSession): StartedRawSnippetSave {
  const begun = beginSave(session, () => session);
  if (begun === null) {
    throw new Error('this case needs a save that could be started');
  }
  return begun;
} // End of function started()

/**
 * A save that ran to the end.
 *
 * @param moved - The snippet's identity in the new revision, or `null`.
 * @param committed - Whether the file was really rewritten.
 * @returns The saved outcome as it crosses the boundary.
 */
function saved(moved: MatchId | null = MOVED, committed = true): SaveResult {
  return { outcome: 'saved', revision: AFTER, committed, notes: [], backup_taken: false, moved };
} // End of function saved()

/** The whole file on disk after another writer, which a conflict carries. */
const DISK = 'matches:\n  - trigger: x\n    replace: theirs\n';

/**
 * A save the file had moved on under.
 *
 * @returns The conflict as it crosses the boundary.
 */
function conflict(): SaveResult {
  return {
    outcome: 'conflict',
    reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
    expected: BASE,
    found: AFTER,
    disk_revision: AFTER,
    disk_text: DISK,
    disk: makeDocument({ id: DOCUMENT, revision: AFTER })
  };
} // End of function conflict()

/** A finding the gate lets an acknowledgement move. */
const SUSPICION: Finding = {
  code: { ReferenceHasNoDeclaration: { name: 'greeting' } },
  span: null,
  node: null,
  path: null
};

/**
 * A refusal for findings.
 *
 * @returns The refusal as it crosses the boundary.
 */
function refusal(): SaveResult {
  return { outcome: 'refused', verdict: 'RefusedForUnacknowledgedSuspicions', findings: [SUSPICION] };
} // End of function refusal()

/**
 * An edited session saved once, with the answer applied.
 *
 * @param result - What the boundary answered.
 * @param adoption - What became of the adoption.
 * @returns The session after the answer.
 */
function answered(
  result: SaveResult,
  adoption: Parameters<typeof applySave>[2] = { kind: 'done' }
): RawSnippetSession {
  const waiting = started(editText(fresh(), EDITED)).session;
  return applySave(waiting, result, adoption, () => waiting);
} // End of function answered()

/**
 * An edited session whose send failed.
 *
 * @param mayHaveWritten - Whether the file may hold the submitted text.
 * @param reason - Why the command rejected.
 * @returns The session after the failure.
 */
function failed(mayHaveWritten: boolean, reason: IpcFailure): RawSnippetSession {
  const waiting = started(editText(fresh(), EDITED)).session;
  return saveCouldNotBeSent(waiting, mayHaveWritten, reason, () => waiting);
} // End of function failed()

/**
 * One observation of the snippet's file.
 *
 * @returns A fresh observation object.
 */
function observation(): ExternalConflictObservation {
  return {
    sequence: 5,
    document: DOCUMENT,
    previousRevision: BASE,
    diskRevision: AFTER,
    diskText: DISK,
    disk: makeDocument({ id: DOCUMENT, revision: AFTER }),
    findings: [],
    correspondences: null
  };
} // End of function observation()

describe('no JavaScript byte slicing', () => {
  it('drafts exactly the text the command answered, at the identity’s revision', () => {
    const session = fresh();
    const view = rawSnippetView(session);
    expect(view.text).toBe(OWNED);
    expect(view.lines).toEqual({ first: 7, count: 3 });
    expect(baseRevisionOf(session)).toBe(BASE);
    expect(session.match).toBe(MATCH);
    // The save sends the identity and the text back, never an offset.
    const begun = started(editText(session, EDITED));
    expect(begun.match).toBe(MATCH);
    expect(begun.submission.candidate).toBe(EDITED);
    expect(begun.submission.baseRevision).toBe(BASE);
  });

  it('holds no slicing method anywhere in the module', () => {
    const source = readFileSync(new URL('./rawSnippet.ts', import.meta.url), 'utf8');
    for (const method of ['.slice(', '.substring(', '.substr(', 'TextEncoder', 'TextDecoder']) {
      expect(source.includes(method), method).toBe(false);
    } // End of the loop over the slicing methods
  });
});

describe('a carriage return is refused at load, at edit and at send', () => {
  it('refuses at load, whether Rust refused the range or the text carries one', () => {
    const fromRust = refusedBy({ ok: false, failure: itemTextRefused({ ItemTextHoldsCarriageReturn: { edit: 0 } }) });
    expect(fromRust.refusal).toEqual({ kind: 'lineEndingsNotPreserved' });
    expect(fromRust.fallback).toBeNull();
    const carried = refusedBy(read('  - trigger: x\r\n    replace: y\r\n'));
    expect(carried.refusal).toEqual({ kind: 'lineEndingsNotPreserved' });
    // A lone carriage return is refused as well: a text box normalizes it too.
    expect(refusedBy(read('  - trigger: x\n    replace: "a\rb"\n')).refusal.kind).toBe('lineEndingsNotPreserved');
  });

  it('refuses at edit, leaving the session exactly as it was', () => {
    const session = fresh();
    expect(editText(session, '  - trigger: x\r\n')).toBe(session);
    const edited = editText(session, EDITED);
    expect(editText(edited, 'a\rb')).toBe(edited);
  });

  it('refuses at send, on the submission’s own candidate', () => {
    // The cast the brand cannot stop, written on purpose: it is the only way to
    // reach the last check before the wire.
    const planted: RawSnippetSession = {
      ...fresh(),
      draft: startDraft(BASE, OWNED, textDraftRules) as unknown as RawSnippetSession['draft']
    };
    const dirty: RawSnippetSession = {
      ...planted,
      draft: { ...planted.draft, value: 'a\rb' } as unknown as RawSnippetSession['draft']
    };
    expect(canSave(dirty)).toBe(true);
    expect(beginSave(dirty, () => dirty)).toBeNull();
  });
});

describe('the whole-document editor is the fallback for a range with holes', () => {
  it('turns ItemRangeNotContiguous into a value offering the whole-document editor', () => {
    const refused = refusedBy({ ok: false, failure: itemTextRefused({ ItemRangeNotContiguous: { edit: 0, hole: HOLE } }) });
    expect(refused.refusal).toEqual({ kind: 'rangeNotContiguous' });
    expect(refused.fallback).toBe('wholeDocumentEditor');
    expect(fallbackOf(refused.refusal)).toBe('wholeDocumentEditor');
  });

  it('carries every other refusal whole, and offers no fallback for it', () => {
    const other: EditError = { ItemTextLosesItsFinalLineBreak: { edit: 0 } };
    expect(refusedBy({ ok: false, failure: itemTextRefused(other) })).toEqual({
      kind: 'refused',
      refusal: { kind: 'notEditable', error: other },
      fallback: null
    });
    const stale: IpcFailure = {
      kind: 'command',
      error: { code: 'identityStaleRevision', expected: BASE, found: AFTER }
    };
    expect(refusedBy({ ok: false, failure: stale })).toEqual({
      kind: 'refused',
      refusal: { kind: 'unreadable', failure: stale },
      fallback: null
    });
  });

  it('offers the fallback beside a send the engine refused as a range with holes', () => {
    const holed = failed(false, engineRefused({ ItemRangeNotContiguous: { edit: 0, hole: HOLE } }));
    expect(rawSnippetView(holed).fallback).toBe('wholeDocumentEditor');
    expect(editErrorOf(holed.sendFailure?.reason ?? null)).toEqual({
      ItemRangeNotContiguous: { edit: 0, hole: HOLE }
    });
    const escaped = failed(false, engineRefused({ ItemTextEscapesItsIndentation: { edit: 0, line: 2 } }));
    expect(rawSnippetView(escaped).fallback).toBeNull();
  });

  it('gives every refusal a sentence in both languages, through the key function', () => {
    const refusals: readonly RawSnippetRefusal[] = [
      { kind: 'rangeNotContiguous' },
      { kind: 'lineEndingsNotPreserved' },
      { kind: 'notEditable', error: { ItemTextLosesItsFinalLineBreak: { edit: 0 } } },
      { kind: 'unreadable', failure: MAY_HAVE_WRITTEN }
    ];
    const keys = refusals.map(rawSnippetRefusalKey);
    expect(new Set(keys).size).toBe(refusals.length);
    for (const locale of LOCALES) {
      for (const key of keys) {
        expect(DICTIONARIES[locale][key].length, `${locale}:${key}`).toBeGreaterThan(0);
      } // End of the loop over the keys
    } // End of the loop over both languages
  });
});

describe('the draft is retained under conflict and refusal', () => {
  it('keeps the draft on a save conflict, freezes the box and copies exactly it', () => {
    const shown = answered(conflict());
    const view = rawSnippetView(shown);
    expect(view.text).toBe(EDITED);
    expect(view.editable).toBe(false);
    expect(view.canSave).toBe(false);
    expect(textToCopy(shown)).toBe(EDITED);
    expect(view.conflictChoices).toContain('copyDraft');
    // Keep editing gives the box back with the draft untouched.
    const back = keepEditing(shown);
    expect(rawSnippetView(back).text).toBe(EDITED);
    expect(rawSnippetView(back).canSave).toBe(true);
  });

  it('keeps the draft under an external conflict raised by the watcher', () => {
    const edited = editText(fresh(), EDITED);
    const raised = applyObservation(edited, arbitratedDelivery(null, observation(), false));
    expect(raised.externalConflict).not.toBeNull();
    expect(textToCopy(raised)).toBe(EDITED);
    expect(rawSnippetView(raised).editable).toBe(false);
  });

  it('keeps the draft on a refusal for findings, and lets consent be recorded for it', () => {
    const shown = answered(refusal());
    expect(rawSnippetView(shown).text).toBe(EDITED);
    const consented = acknowledgeFindings(shown);
    expect(consented).not.toBe(shown);
    const again = started(consented);
    expect(again.submission.acknowledgement.accepted).toHaveLength(1);
  });

  it('keeps the draft on an engine refusal, and allows a corrected retry', () => {
    const refused = failed(false, engineRefused({ ItemTextEscapesItsIndentation: { edit: 0, line: 2 } }));
    const view = rawSnippetView(refused);
    expect(view.text).toBe(EDITED);
    expect(view.sendFailure?.kind).toBe('notSent');
    expect(view.canSave).toBe(true);
    expect(refused.needsReconciliation).toBe(false);
  });

  it('closes the surface on a confirmed reload, and closes nothing when the window refuses', () => {
    const shown = answered(conflict());
    const confirmed = confirmReload(askToReload(shown));
    const answers: DiskAdoptionOutcome[] = [];
    const refusedReload = reloadTheDiskVersion(confirmed, () => { answers.push('refused'); return 'refused'; }, () => confirmed);
    expect(refusedReload.closed).toBe(false);
    expect(textToCopy(refusedReload)).toBe(EDITED);
    const closed = reloadTheDiskVersion(confirmed, () => 'installed', () => confirmed);
    expect(closed.closed).toBe(true);
    expect(rawSnippetView(closed).editable).toBe(false);
    expect(answers).toEqual(['refused']);
  });
});

describe('a committed save invalidates the old identity', () => {
  it('adopts the edited snippet’s new identity and rebases the draft on the text sent', () => {
    const committed = answered(saved());
    expect(committed.match).toBe(MOVED);
    expect(committed.identityStale).toBe(false);
    expect(baseRevisionOf(committed)).toBe(AFTER);
    expect(rawSnippetView(committed).dirty).toBe(false);
    expect(rawSnippetView(committed).text).toBe(EDITED);
    // The next save sends the new identity and the new revision, never the old.
    const next = started(editText(committed, THIRD));
    expect(next.match).toBe(MOVED);
    expect(next.submission.baseRevision).toBe(AFTER);
  });

  it('stops offering to save when the commit answered no identity', () => {
    const lost = answered(saved(null));
    expect(lost.identityStale).toBe(true);
    expect(lost.match).toBe(MATCH);
    expect(rawSnippetView(lost).canSave).toBe(false);
    expect(beginSave(editText(lost, THIRD), () => lost)).toBeNull();
  });

  it('stays a committed save when the adoption failed, and stops offering to save', () => {
    const outOfStep = answered(saved(), { kind: 'failed', failure: MAY_HAVE_WRITTEN });
    const view = rawSnippetView(outOfStep);
    expect(view.outcome?.kind).toBe('saved');
    expect(view.messages.length).toBeGreaterThan(0);
    expect(outOfStep.identityStale).toBe(true);
    expect(view.canSave).toBe(false);
  });

  it('keeps the identity on a byte-identical save that committed nothing', () => {
    const unchanged = answered(saved(MOVED, false));
    expect(unchanged.identityStale).toBe(false);
    expect(unchanged.match).toBe(MOVED);
  });
});

describe('an uncertain write keeps the text and needs reconciliation', () => {
  it('keeps the draft and refuses every save until reconciled, even after an edit', () => {
    const uncertain = failed(true, MAY_HAVE_WRITTEN);
    const view = rawSnippetView(uncertain);
    expect(view.text).toBe(EDITED);
    expect(view.sendFailure?.kind).toBe('mayHaveWritten');
    expect(view.needsReconciliation).toBe(true);
    expect(view.canSave).toBe(false);
    expect(view.editable).toBe(true);
    const typed = editText(uncertain, THIRD);
    expect(typed.needsReconciliation).toBe(true);
    expect(typed.sendFailure?.kind).toBe('mayHaveWritten');
    expect(beginSave(typed, () => typed)).toBeNull();
    expect(keepEditing(typed).needsReconciliation).toBe(true);
  });

  it('reconciles against a fresh read that holds the sent text: the write landed', () => {
    const uncertain = failed(true, MAY_HAVE_WRITTEN);
    const reconciled = reconcileWithDisk(uncertain, MOVED, read(EDITED));
    if (reconciled.kind !== 'reconciled') {
      throw new Error('this case needs a reconciliation');
    }
    expect(reconciled.written).toBe(true);
    expect(reconciled.session.match).toBe(MOVED);
    expect(baseRevisionOf(reconciled.session)).toBe(AFTER);
    expect(rawSnippetView(reconciled.session).dirty).toBe(false);
    expect(rawSnippetView(reconciled.session).sendFailure).toBeNull();
    expect(reconciled.session.needsReconciliation).toBe(false);
  });

  it('reconciles against a fresh read that does not: the draft is kept, dirty', () => {
    const uncertain = failed(true, MAY_HAVE_WRITTEN);
    const reconciled = reconcileWithDisk(uncertain, MOVED, read(OWNED));
    if (reconciled.kind !== 'reconciled') {
      throw new Error('this case needs a reconciliation');
    }
    expect(reconciled.written).toBe(false);
    const view = rawSnippetView(reconciled.session);
    expect(view.text).toBe(EDITED);
    expect(view.dirty).toBe(true);
    expect(view.canSave).toBe(true);
    expect(started(reconciled.session).match).toBe(MOVED);
  });

  it('refuses a reconciliation nothing owes, or one whose read is refused', () => {
    expect(reconcileWithDisk(fresh(), MOVED, read())).toEqual({ kind: 'notReconciled', refusal: null });
    const uncertain = failed(true, MAY_HAVE_WRITTEN);
    expect(reconcileWithDisk(uncertain, { ...MOVED, document: DOCUMENT + 1 }, read())).toEqual({
      kind: 'notReconciled',
      refusal: null
    });
    expect(reconcileWithDisk(uncertain, MOVED, read('x\r\n'))).toEqual({
      kind: 'notReconciled',
      refusal: { kind: 'lineEndingsNotPreserved' }
    });
  });
});

describe('review fixes (3-8-1 review)', () => {
  it('never rebases onto a fresh read another writer produced (finding 1)', () => {
    // Uncertain write of EDITED over OWNED; the fresh read holds neither.
    const uncertain = failed(true, MAY_HAVE_WRITTEN);
    const theirs = '  - trigger: ":hé"\n    replace: "somebody else"\n';
    expect(reconcileWithDisk(uncertain, MOVED, read(theirs))).toEqual({ kind: 'diverged' });
    // Nothing moved: the draft is kept, the old base stands and no save is offered.
    expect(uncertain.needsReconciliation).toBe(true);
    expect(rawSnippetView(uncertain).text).toBe(EDITED);
    expect(rawSnippetView(uncertain).canSave).toBe(false);
  });

  it('binds no old findings to a different candidate after a failed retry (finding 2)', () => {
    // A is refused with findings; the person edits to B and saves B; B is not sent.
    const refusedA = answered(refusal());
    const b = editText(refusedA, THIRD);
    const waiting = started(b).session;
    expect(waiting.outcome).toBeNull();
    const notSent = saveCouldNotBeSent(waiting, false, engineRefused({ ItemTextLosesItsFinalLineBreak: { edit: 0 } }), () => waiting);
    expect(notSent.outcome).toBeNull();
    expect(acknowledgeFindings(notSent)).toBe(notSent);
    expect(rawSnippetView(notSent).refusalChoices).toEqual([]);
    expect(started(notSent).submission.acknowledgement.accepted).toEqual([]);
  });

  it('offers and applies no dismissal while a save is in flight (finding 3)', () => {
    // An acknowledged retry: the refusal was on screen when the second send began.
    const consented = acknowledgeFindings(answered(refusal()));
    const held = started(consented).session;
    expect(rawSnippetView(held).refusalChoices).toEqual([]);
    expect(rawSnippetView(held).conflictChoices).toEqual([]);
    expect(keepEditing(held)).toBe(held);
    // The in-flight submission survives to settle the committed answer.
    const settled = applySave(held, saved(), { kind: 'done' }, () => held);
    expect(settled.outcome?.kind).toBe('saved');
    expect(settled.match).toBe(MOVED);
  });
});

describe('CF-55: under one held save, Undo and Redo are neither enabled nor mutating', () => {
  it('disables and refuses both while a save is in flight', () => {
    const both = undoEdit(editText(editText(fresh(), EDITED), THIRD));
    expect(canUndo(both.draft) && canRedo(both.draft)).toBe(true);
    const held = started(both).session;
    expect(canUndo(held.draft) && canRedo(held.draft)).toBe(true);
    expect(canUndoEdit(held)).toBe(false);
    expect(canRedoEdit(held)).toBe(false);
    expect(rawSnippetView(held).canUndo).toBe(false);
    expect(rawSnippetView(held).canRedo).toBe(false);
    expect(undoEdit(held)).toBe(held);
    expect(redoEdit(held)).toBe(held);
    expect(editText(held, OWNED)).toBe(held);
  });

  it('holds a delivery that arrives during the save, and replays it after the answer', () => {
    const held = started(editText(fresh(), EDITED)).session;
    const seen = observation();
    const holding = applyObservation(held, retainedDelivery(seen));
    expect(holding.heldDeliveries).toHaveLength(1);
    expect(holding.awaitingReconciliation.size).toBe(0);
    const settled = applySave(holding, refusal(), { kind: 'notOwed' }, () => holding);
    expect(settled.heldDeliveries).toHaveLength(0);
    expect(settled.awaitingReconciliation.get(DOCUMENT)).toBe(seen);
    expect(rawSnippetView(settled).canSave).toBe(false);
    const lifted = applyObservation(settled, writtenHereDelivery(seen));
    expect(lifted.awaitingReconciliation.size).toBe(0);
  });

  it('enables each exactly when its transition would change the session', () => {
    const edited = editText(fresh(), EDITED);
    const undone = undoEdit(editText(edited, THIRD));
    const states: readonly RawSnippetSession[] = [
      fresh(),
      edited,
      undone,
      started(undone).session,
      answered(conflict()),
      answered(refusal()),
      answered(saved()),
      answered(saved(null)),
      failed(true, MAY_HAVE_WRITTEN)
    ];
    for (const state of states) {
      expect(canUndoEdit(state)).toBe(undoEdit(state) !== state);
      expect(canRedoEdit(state)).toBe(redoEdit(state) !== state);
      expect(rawSnippetView(state).canUndo).toBe(canUndoEdit(state));
      expect(rawSnippetView(state).canRedo).toBe(canRedoEdit(state));
    } // End of the loop over the states built
  });
});

describe('Phase 3-8-2 additions', () => {
  it('treats a save refused as identityStaleRevision as a stale identity: no retry is offered (3-8-1 §5 item 5)', () => {
    const stale: IpcFailure = {
      kind: 'command',
      error: { code: 'identityStaleRevision', expected: BASE, found: AFTER }
    };
    const refused = failed(false, stale);
    const view = rawSnippetView(refused);
    expect(refused.identityStale).toBe(true);
    expect(view.identityStale).toBe(true);
    expect(view.canSave).toBe(false);
    expect(view.editable).toBe(false);
    expect(view.text).toBe(EDITED);
    expect(beginSave(refused, () => refused)).toBeNull();
    // Any other refusal that wrote nothing still allows a corrected retry.
    const other = failed(false, engineRefused({ ItemTextLosesItsFinalLineBreak: { edit: 0 } }));
    expect(other.identityStale).toBe(false);
    // And a send that may have written keeps its own restriction, not this one.
    expect(failed(true, stale).identityStale).toBe(false);
  });

  it('answers diverged for a fresh read whose range starts on another line, even with the sent text', () => {
    const uncertain = failed(true, MAY_HAVE_WRITTEN);
    const elsewhere: CommandResult<OwnedItemText> = {
      ok: true,
      value: { text: EDITED, first_line: 8, line_count: 3 }
    };
    expect(reconcileWithDisk(uncertain, MOVED, elsewhere)).toEqual({ kind: 'diverged' });
    expect(uncertain.needsReconciliation).toBe(true);
  });

  it('explains a trailing blank line only for ItemTextEscapesTheItem over a text that ends with one', () => {
    const escapes: EditError = {
      Verification: { ItemTextEscapesTheItem: { edit: 0, at: { start: 1, end: 2 } } }
    };
    /**
     * A session whose send of one text the engine refused with one error.
     *
     * @param text - The text sent.
     * @param error - The core's refusal.
     * @returns The session after the refusal.
     */
    const refusedWith = (text: string, error: EditError): RawSnippetSession => {
      const waiting = started(editText(fresh(), text)).session;
      return saveCouldNotBeSent(waiting, false, engineRefused(error), () => waiting);
    };
    expect(rawSnippetView(refusedWith(`${EDITED}\n`, escapes)).trailingBlankLineRefused).toBe(true);
    expect(rawSnippetView(refusedWith(`${EDITED}  \t\n`, escapes)).trailingBlankLineRefused).toBe(true);
    expect(rawSnippetView(refusedWith(EDITED, escapes)).trailingBlankLineRefused).toBe(false);
    expect(
      rawSnippetView(refusedWith(`${EDITED}\n`, { ItemTextLosesItsFinalLineBreak: { edit: 0 } }))
        .trailingBlankLineRefused
    ).toBe(false);
    // The explanation goes with the failure it explains.
    const blank = refusedWith(`${EDITED}\n`, escapes);
    expect(rawSnippetView(editText(blank, THIRD)).trailingBlankLineRefused).toBe(false);
  });

  it('carries the failure lines of a send that produced no outcome, outermost first', () => {
    const view = rawSnippetView(failed(false, engineRefused({ ItemTextLosesItsFinalLineBreak: { edit: 0 } })));
    expect(view.failureLines.map((line) => line.kind)).toEqual(['failure', 'save', 'edit']);
    expect(rawSnippetView(fresh()).failureLines).toEqual([]);
  });
});
