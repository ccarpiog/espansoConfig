/**
 * The draft spine, and the properties it exists to keep true.
 *
 * Every case below is a claim the type system has no opinion about:
 *
 * 1. **Dirty is derived.** The shape has no `dirty` field, so the test that
 *    matters is the one a flag would fail: type something, type it back, and the
 *    draft is clean again.
 * 2. **A structured value is snapshotted, not aliased.** The 2c-1a review's
 *    scenario, driven exactly: acknowledge candidate A, change a nested field, and
 *    both dirty tracking and consent must notice. A draft that stored the caller's
 *    object would fail all of it silently.
 * 3. **Undo and redo are a pair**, and the history is bounded.
 * 4. **A save draws a boundary without destroying what came after it.**
 * 5. **Consent cannot outlive its candidate, and cannot be moved to another
 *    draft.** This is the load-bearing one: `DocumentDoesNotParse` is
 *    content-addressed to the exact submitted text.
 */

import { describe, expect, it } from 'vitest';
import type { ContentRevision, Finding, RefusedResult } from '../ipc/types';
import {
  acknowledgeRefusal,
  amendDraft,
  boundAcknowledgement,
  canRedo,
  canUndo,
  deepEquals,
  deepFreeze,
  editDraft,
  EMPTY_ACKNOWLEDGEMENT,
  HISTORY_LIMIT,
  isDirty,
  redoDraft,
  reloadedDraft,
  savedDraft,
  startDraft,
  structuredDraftRules,
  submissionOf,
  textDraftRules,
  undoDraft,
  type Draft,
  type DraftSubmission
} from './draft';

/** A revision, in the 64 hex characters the wire uses. */
const BASE: ContentRevision = 'a'.repeat(64);

/** A second revision, so that a boundary can be seen to have moved. */
const NEXT: ContentRevision = 'b'.repeat(64);

/** A parse rejection, bound by its `revision` operand to one exact text. */
const REJECTION: Finding = {
  code: {
    DocumentDoesNotParse: {
      revision: BASE,
      line: 2,
      column: 1,
      byte_index: 20,
      detail: 'mapping values are not allowed in this context'
    }
  },
  span: null,
  node: null,
  path: null
};

/** The refusal a person may accept: acknowledging it would really work. */
const REFUSAL: RefusedResult = {
  outcome: 'refused',
  verdict: 'RefusedForUnacknowledgedSuspicions',
  findings: [REJECTION]
};

/** A refusal no acknowledgement can move. */
const UNMOVABLE: RefusedResult = {
  outcome: 'refused',
  verdict: 'RefusedForEditorModelErrors',
  findings: [REJECTION]
};

/**
 * A draft of one file's text, the shape 2c-1b will hold.
 *
 * @param value - The text the file holds.
 * @returns A clean text draft at {@link BASE}.
 */
function text(value = 'matches:\n'): Draft<string> {
  return startDraft(BASE, value, textDraftRules);
} // End of function text()

/** A structured drafted value, the shape 2c-2 will hold. */
interface Structured {
  /** One scalar field. */
  trigger: string;
  /** A nested list, so a mutation can be made below the top level. */
  vars: { name: string }[];
}

/**
 * A draft the person has edited into an unparseable state and had refused.
 *
 * @returns The draft carrying consent, and the submission the refusal answered.
 */
function acknowledged(): {
  readonly draft: Draft<string>;
  readonly submission: DraftSubmission<string>;
} {
  const edited = editDraft(text('0'), 'broken:');
  const submission = submissionOf(edited);
  return { draft: acknowledgeRefusal(edited, submission, REFUSAL), submission };
} // End of function acknowledged()

describe('what a draft is started as', () => {
  it('is clean, has no history and has collected no consent', () => {
    const draft = text();
    expect(draft.baseRevision).toBe(BASE);
    expect(draft.baseValue).toBe('matches:\n');
    expect(draft.value).toBe('matches:\n');
    expect(isDirty(draft)).toBe(false);
    expect(canUndo(draft)).toBe(false);
    expect(canRedo(draft)).toBe(false);
    expect(draft.consent).toBeNull();
  });

  it('keeps the base value beside the base revision, not only the revision', () => {
    // Both, because "dirty" is a comparison against the value and the save is a
    // comparison against the revision. A shape holding only the revision could
    // not answer the first without asking the disk again.
    const draft = editDraft(text(), 'matches:\n  - trigger: x\n');
    expect(draft.baseRevision).toBe(BASE);
    expect(draft.baseValue).toBe('matches:\n');
    expect(draft.value).toBe('matches:\n  - trigger: x\n');
  });
}); // End of the "what a draft is started as" suite

describe('dirty, derived rather than stored', () => {
  it('is true after an edit and false again once the value returns to the base', () => {
    // The case a `dirty` flag gets wrong. Clean means *equal to the base*, not
    // *never touched*.
    const edited = editDraft(text('a'), 'b');
    expect(isDirty(edited)).toBe(true);
    const back = editDraft(edited, 'a');
    expect(back.value).toBe('a');
    expect(isDirty(back)).toBe(false);
  });

  it('is false again after undoing back to the base value', () => {
    const undone = undoDraft(editDraft(text('a'), 'b'));
    expect(undone.value).toBe('a');
    expect(isDirty(undone)).toBe(false);
  });

  it('has no field to go out of step with, so nothing can set it', () => {
    expect(Object.keys(text())).not.toContain('dirty');
  });

  it('uses the rules the draft was started with, for every question it asks', () => {
    const draft = startDraft(BASE, { trigger: ':hi', vars: [] }, structuredDraftRules<Structured>());
    const rewritten = editDraft(draft, { trigger: ':hi', vars: [] });
    expect(rewritten).toBe(draft);
    expect(isDirty(rewritten)).toBe(false);
    expect(isDirty(editDraft(draft, { trigger: ':bye', vars: [] }))).toBe(true);
  });

  it('compares text by identity, which is value equality for a string', () => {
    expect(textDraftRules.same('a', 'a')).toBe(true);
    expect(textDraftRules.same('a', 'b')).toBe(false);
  });

  it('compares structured data by its contents, at any depth', () => {
    expect(deepEquals({ a: [1, { b: 'c' }] }, { a: [1, { b: 'c' }] })).toBe(true);
    expect(deepEquals({ a: [1, { b: 'c' }] }, { a: [1, { b: 'd' }] })).toBe(false);
    expect(deepEquals([1, 2], { 0: 1, 1: 2 })).toBe(false);
    expect(deepEquals({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
}); // End of the "dirty, derived" suite

describe('a structured value is snapshotted, never aliased', () => {
  it('does not change when the caller mutates the object it handed in', () => {
    // The draft copies on the way in, so the caller's object stays the caller's.
    const outside: Structured = { trigger: ':a', vars: [{ name: 'one' }] };
    const draft = startDraft(BASE, outside, structuredDraftRules<Structured>());
    const nested = outside.vars[0] as { name: string };
    nested.name = 'two';
    expect(draft.baseValue.vars[0]?.name).toBe('one');
    expect(draft.value.vars[0]?.name).toBe('one');
    expect(isDirty(draft)).toBe(false);
  }); // End of the "does not change when the caller mutates" case

  it('refuses a mutation of what it is holding, at any depth', () => {
    // `readonly` is shallow and has no runtime existence; `Object.freeze` does.
    // In strict mode — every module here is one — the assignment throws instead
    // of silently doing nothing.
    const draft = startDraft(
      BASE,
      { trigger: ':a', vars: [{ name: 'one' }] },
      structuredDraftRules<Structured>()
    );
    expect(() => {
      (draft.value as Structured).trigger = ':z';
    }).toThrow(TypeError);
    expect(() => {
      (draft.value.vars[0] as { name: string }).name = 'two';
    }).toThrow(TypeError);
  }); // End of the "refuses a mutation" case

  it('notices a nested change, in dirty and in consent, which aliasing would hide', () => {
    // The review's scenario, exactly: acknowledge candidate A, then change a
    // nested field to make candidate B. Aliased storage would leave `isDirty`
    // false and `boundAcknowledgement` satisfied, and the editor would send B
    // carrying A's acknowledgement.
    const rules = structuredDraftRules<Structured>();
    const draft = startDraft(BASE, { trigger: ':a', vars: [{ name: 'one' }] }, rules);
    const submission = submissionOf(draft);
    const consented = acknowledgeRefusal(draft, submission, REFUSAL);
    expect(boundAcknowledgement(consented)).not.toBeNull();

    const candidateB = structuredClone(submission.candidate) as Structured;
    const nested = candidateB.vars[0] as { name: string };
    nested.name = 'two';
    const edited = editDraft(consented, candidateB);

    expect(isDirty(edited)).toBe(true);
    expect(edited.consent).toBeNull();
    expect(boundAcknowledgement(edited)).toBeNull();
    expect(submissionOf(edited).acknowledgement).toEqual(EMPTY_ACKNOWLEDGEMENT);
  }); // End of the "notices a nested change" case

  it('freezes everything under a value rather than only its surface', () => {
    const frozen = deepFreeze({ a: { b: [1] } });
    expect(Object.isFrozen(frozen.a)).toBe(true);
    expect(Object.isFrozen(frozen.a.b)).toBe(true);
    expect(deepFreeze('text')).toBe('text');
  });
}); // End of the "structured value is snapshotted" suite

describe('undo and redo', () => {
  it('round-trips: three edits, three undos, three redos', () => {
    let draft = text('0');
    for (const value of ['1', '2', '3']) {
      draft = editDraft(draft, value);
    }
    expect(draft.value).toBe('3');
    for (const value of ['2', '1', '0']) {
      draft = undoDraft(draft);
      expect(draft.value).toBe(value);
    }
    expect(canUndo(draft)).toBe(false);
    for (const value of ['1', '2', '3']) {
      draft = redoDraft(draft);
      expect(draft.value).toBe(value);
    }
    expect(canRedo(draft)).toBe(false);
    expect(draft.value).toBe('3');
  }); // End of the "round-trips" case

  it('clears the redo stack when editing resumes from an undone state', () => {
    // The rule that keeps history a history: after undoing to "1" and typing
    // "9", the "2" that was undone never happened, and offering to redo it would
    // replay a value from a branch nothing is on.
    const undone = undoDraft(editDraft(editDraft(text('0'), '1'), '2'));
    expect(canRedo(undone)).toBe(true);
    const branched = editDraft(undone, '9');
    expect(canRedo(branched)).toBe(false);
    expect(branched.future).toEqual([]);
    expect(redoDraft(branched)).toBe(branched);
  });

  it('does nothing at either end rather than throwing', () => {
    const draft = text('0');
    expect(undoDraft(draft)).toBe(draft);
    expect(redoDraft(draft)).toBe(draft);
  });

  it('records no history for an edit that changes nothing', () => {
    const draft = editDraft(text('0'), '1');
    expect(editDraft(draft, '1')).toBe(draft);
    expect(draft.past).toHaveLength(1);
  });

  it('gives every step its own generation, and never reuses one', () => {
    const draft = editDraft(editDraft(text('0'), '1'), '2');
    const generations = [...draft.past.map((step) => step.generation), draft.generation];
    expect(new Set(generations).size).toBe(generations.length);
    // Undo restores the step's own generation rather than minting a new one, so
    // a submission can still be found on the branch afterwards.
    expect(undoDraft(draft).generation).toBe(draft.past[draft.past.length - 1]?.generation);
  });

  it('never mutates the draft it was handed', () => {
    const draft = editDraft(text('0'), '1');
    const before = JSON.stringify({ ...draft, rules: null });
    undoDraft(draft);
    editDraft(draft, '2');
    expect(JSON.stringify({ ...draft, rules: null })).toBe(before);
  });

  it('keeps the history bounded, dropping the oldest step first', () => {
    // A raw draft holds a file's whole text, so one entry per keystroke is
    // unbounded retained memory. What a person loses at the bound is the oldest
    // undo step; the base value is never dropped, so "what this file held when I
    // opened it" survives even when its history does not.
    let draft = text('0');
    for (let index = 1; index <= HISTORY_LIMIT + 5; index += 1) {
      draft = editDraft(draft, String(index));
    }
    expect(draft.past).toHaveLength(HISTORY_LIMIT);
    expect(draft.past[0]?.value).toBe('5');
    expect(draft.baseValue).toBe('0');
  }); // End of the "keeps the history bounded" case
}); // End of the "undo and redo" suite

describe('amending the current step, which is what coalescing is made of', () => {
  it('replaces the value and adds no history step', () => {
    const draft = amendDraft(editDraft(text('0'), '1'), '12');
    expect(draft.value).toBe('12');
    // One step, for the edit. The amendment joined it rather than following it.
    expect(draft.past).toHaveLength(1);
    expect(draft.past[0]?.value).toBe('0');
    expect(undoDraft(draft).value).toBe('0');
  });

  it('mints a new generation, because the value changed', () => {
    const edited = editDraft(text('0'), '1');
    const amended = amendDraft(edited, '12');
    expect(amended.generation).not.toBe(edited.generation);
    expect(amended.nextGeneration).toBe(edited.nextGeneration + 1);
  });

  it('leaves a submission taken at the replaced step off the branch, so a save discards nothing', () => {
    // `savedDraft`'s third case, reached by amending rather than by branching:
    // the step the submission names is gone, there is no boundary left to draw,
    // and the honest answer is to keep the history rather than to guess.
    const edited = editDraft(text('0'), '1');
    const submission = submissionOf(edited);
    const amended = amendDraft(edited, '12');
    const saved = savedDraft(amended, submission, NEXT);
    expect(saved.past).toEqual(amended.past);
    expect(saved.baseValue).toBe('1');
  });

  it('clears the redo stack and any collected consent', () => {
    const undone = undoDraft(editDraft(editDraft(text('0'), '1'), '2'));
    expect(canRedo(undone)).toBe(true);
    expect(canRedo(amendDraft(undone, '9'))).toBe(false);
    const { draft } = acknowledged();
    expect(boundAcknowledgement(draft)).not.toBeNull();
    expect(amendDraft(draft, 'broken: more').consent).toBeNull();
  });

  it('answers the same draft when nothing changed', () => {
    const draft = editDraft(text('0'), '1');
    expect(amendDraft(draft, '1')).toBe(draft);
  });

  it('drops the step it was replacing when the replacement is what that step began as', () => {
    // Two adjacent identical branch entries are an undo the person can press that
    // changes nothing and only spends a step. The entry that survives is the one
    // that was about to be duplicated, and its own generation comes back with it,
    // exactly as an undo restores one.
    const started = text('0');
    const edited = editDraft(started, '1');
    const back = amendDraft(edited, '0');
    expect(back.value).toBe('0');
    expect(back.past).toEqual([]);
    expect(canUndo(back)).toBe(false);
    expect(back.generation).toBe(started.generation);
    expect(isDirty(back)).toBe(false);
  }); // End of the "drops the step" case

  it('gives back the entry its own push evicted at the bound, so a net-zero group costs nothing', () => {
    // **The 2c-2 confirmation pass's second finding.** With the history full, the
    // push that opens a group evicts the oldest step; a collapse that only sliced
    // left the value where it started and the history one state shorter — and
    // silently, because nothing on screen changed. Repeat that burst and the past
    // erodes one entry at a time.
    let draft = text('0');
    for (let index = 1; index <= HISTORY_LIMIT; index += 1) {
      draft = editDraft(draft, String(index));
    }
    expect(draft.past).toHaveLength(HISTORY_LIMIT);
    expect(draft.past[0]?.value).toBe('0');

    const opened = editDraft(draft, 'typed');
    // The push really did cost the oldest entry: this is the state the collapse has
    // to be able to give back.
    expect(opened.past[0]?.value).toBe('1');
    expect(opened.evicted?.value).toBe('0');

    const back = amendDraft(opened, String(HISTORY_LIMIT));
    expect(back.value).toBe(String(HISTORY_LIMIT));
    expect(back.past).toHaveLength(HISTORY_LIMIT);
    expect(back.past[0]?.value).toBe('0');
    // And it is reachable by undo, not merely present in the array.
    let walked = back;
    for (let step = 0; step < HISTORY_LIMIT; step += 1) {
      walked = undoDraft(walked);
    }
    expect(walked.value).toBe('0');
    // The slot is released once it has been spent, so a later collapse cannot
    // resurrect it a second time.
    expect(back.evicted).toBeNull();
  }); // End of the "gives back the entry its own push evicted" case

  it('releases the retained eviction at every boundary a collapse could not follow', () => {
    let draft = text('0');
    for (let index = 1; index <= HISTORY_LIMIT; index += 1) {
      draft = editDraft(draft, String(index));
    }
    const opened = editDraft(draft, 'typed');
    expect(opened.evicted).not.toBeNull();
    // An undo moves the branch somewhere the collapse no longer applies.
    expect(undoDraft(opened).evicted).toBeNull();
    // A save draws a boundary undo may not cross, so nothing may reappear behind it.
    expect(savedDraft(opened, submissionOf(opened), NEXT).evicted).toBeNull();
    // A reload discards the history, and the slot held outside it goes too.
    expect(reloadedDraft(opened, NEXT, 'fresh').evicted).toBeNull();
    // An amendment that does *not* collapse keeps it: a group is one push followed
    // by any number of amendments, and the collapse may be the last of ten.
    const amended = amendDraft(opened, 'typed more');
    expect(amended.evicted?.value).toBe('0');
    expect(amendDraft(amended, String(HISTORY_LIMIT)).past[0]?.value).toBe('0');
  }); // End of the "releases the retained eviction" case

  it('collapses only against the step immediately before it', () => {
    // `0 → 1 → 2`, then amend the `2` back to `1`: the `1` entry is the one about
    // to be duplicated, so it goes and the `0` before it stays.
    const draft = amendDraft(editDraft(editDraft(text('0'), '1'), '2'), '1');
    expect(draft.value).toBe('1');
    expect(draft.past.map((step) => step.value)).toEqual(['0']);
    // And an amendment back to a value further up the branch is an ordinary
    // amendment: `0` is not the step this one is replacing.
    const further = amendDraft(editDraft(editDraft(text('0'), '1'), '2'), '0');
    expect(further.past.map((step) => step.value)).toEqual(['0', '1']);
  }); // End of the "collapses only against the step immediately before it" case

  it('snapshots a structured value rather than keeping the caller’s object', () => {
    const rules = structuredDraftRules<Structured>();
    const draft = startDraft(BASE, { trigger: ':a', vars: [] }, rules);
    const mine: Structured = { trigger: ':ab', vars: [{ name: 'x' }] };
    const amended = amendDraft(draft, mine);
    mine.vars[0]!.name = 'y';
    expect(amended.value.vars[0]?.name).toBe('x');
    expect(Object.isFrozen(amended.value)).toBe(true);
  });
}); // End of the "amending the current step" suite

describe('the boundaries a save and a reload draw', () => {
  it('rebases on the candidate that was written', () => {
    const edited = editDraft(editDraft(text('0'), '1'), '2');
    const saved = savedDraft(edited, submissionOf(edited), NEXT);
    expect(saved.baseRevision).toBe(NEXT);
    expect(saved.baseValue).toBe('2');
    expect(saved.value).toBe('2');
    expect(isDirty(saved)).toBe(false);
  });

  it('stops undo at what was saved, discarding only what is older', () => {
    const edited = editDraft(editDraft(text('0'), '1'), '2');
    const saved = savedDraft(edited, submissionOf(edited), NEXT);
    expect(saved.past).toEqual([]);
    expect(canUndo(saved)).toBe(false);
  });

  it('keeps the edits made while the save was in flight, and their undo', () => {
    // The review's finding: the first version cleared the whole history, so a
    // person who typed during a save could not undo back to what had just been
    // written. Now the boundary is drawn at the submitted step and everything
    // after it is kept.
    const submitted = editDraft(editDraft(text('0'), '1'), '2');
    const submission = submissionOf(submitted);
    const typedOn = editDraft(submitted, '3');
    const saved = savedDraft(typedOn, submission, NEXT);

    expect(saved.baseValue).toBe('2');
    expect(saved.value).toBe('3');
    expect(isDirty(saved)).toBe(true);
    expect(canUndo(saved)).toBe(true);
    const undone = undoDraft(saved);
    expect(undone.value).toBe('2');
    expect(isDirty(undone)).toBe(false);
    // And no further: undo may not walk backwards across the write.
    expect(canUndo(undone)).toBe(false);
  }); // End of the "keeps the edits made while the save was in flight" case

  it('discards nothing when the person undid past the submitted value', () => {
    // They have already walked back past the saved state deliberately. Taking
    // their history away as well would punish them for it.
    const submitted = editDraft(editDraft(text('0'), '1'), '2');
    const submission = submissionOf(submitted);
    const rewound = undoDraft(undoDraft(submitted));
    const saved = savedDraft(rewound, submission, NEXT);
    expect(saved.value).toBe('0');
    expect(saved.past).toEqual(rewound.past);
    expect(saved.future).toEqual(rewound.future);
    expect(saved.baseValue).toBe('2');
    expect(isDirty(saved)).toBe(true);
  }); // End of the "discards nothing when the person undid past" case

  it('discards nothing when a branch abandoned the submitted value', () => {
    // Editing from an undone state cleared the future the submitted step was in,
    // so there is no boundary left to draw and nothing to gain by cutting.
    const submitted = editDraft(editDraft(text('0'), '1'), '2');
    const submission = submissionOf(submitted);
    const branched = editDraft(undoDraft(submitted), '9');
    const saved = savedDraft(branched, submission, NEXT);
    expect(saved.past).toEqual(branched.past);
    expect(saved.future).toEqual([]);
    expect(saved.baseValue).toBe('2');
  }); // End of the "discards nothing when a branch abandoned" case

  it('draws the same boundary for a save that wrote nothing', () => {
    // `committed: false` is a documented success — the candidate was
    // byte-identical to what the file already held — and it moves the base for
    // the same reason a write does.
    const edited = editDraft(text('0'), '1');
    const saved = savedDraft(edited, submissionOf(edited), NEXT);
    expect(saved.baseValue).toBe('1');
    expect(isDirty(saved)).toBe(false);
  });

  it('replaces everything on a reload, which is the destructive boundary', () => {
    const edited = editDraft(editDraft(text('0'), '1'), '2');
    const reloaded = reloadedDraft(edited, NEXT, 'from disk');
    expect(reloaded.baseRevision).toBe(NEXT);
    expect(reloaded.baseValue).toBe('from disk');
    expect(reloaded.value).toBe('from disk');
    expect(isDirty(reloaded)).toBe(false);
    expect(canUndo(reloaded)).toBe(false);
    expect(canRedo(reloaded)).toBe(false);
  }); // End of the "replaces everything on a reload" case
}); // End of the "boundaries" suite

describe('consent, which only a refusal of this draft can produce', () => {
  it('is readable while the draft still holds the text it was collected for', () => {
    const { draft } = acknowledged();
    expect(boundAcknowledgement(draft)).toEqual({ accepted: [REJECTION] });
    expect(submissionOf(draft)).toEqual({
      baseRevision: BASE,
      candidate: 'broken:',
      acknowledgement: { accepted: [REJECTION] },
      generation: draft.generation
    });
  });

  it('cannot be handed in: it is derived from the refusal itself', () => {
    // There is no `acknowledgeDraft(draft, someAcknowledgement)` to call. The
    // findings that go back are the ones the gate reported, whole, because it
    // matches them as an exact multiset.
    const { draft } = acknowledged();
    expect(boundAcknowledgement(draft)?.accepted).toEqual(REFUSAL.findings);
  });

  it('is not recorded for a refusal no acknowledgement can move', () => {
    const edited = editDraft(text('0'), 'broken:');
    const unchanged = acknowledgeRefusal(edited, submissionOf(edited), UNMOVABLE);
    expect(unchanged).toBe(edited);
    expect(unchanged.consent).toBeNull();
  });

  it('is not recorded when the draft moved on while the save was in flight', () => {
    // The refusal is about a text that is no longer on screen. Consenting to it
    // would consent to the wrong thing.
    const edited = editDraft(text('0'), 'broken:');
    const submission = submissionOf(edited);
    const typedOn = editDraft(edited, 'broken: again');
    expect(acknowledgeRefusal(typedOn, submission, REFUSAL)).toBe(typedOn);
  });

  it('cannot be moved from one draft to another', () => {
    // The review's Medium 4, driven: draft A's refusal, offered to draft B. The
    // submission carries the candidate it was taken from, and it is not B's.
    const first = editDraft(text('0'), 'broken:');
    const submissionA = submissionOf(first);
    const second = editDraft(text('0'), 'different text');
    const unchanged = acknowledgeRefusal(second, submissionA, REFUSAL);
    expect(unchanged).toBe(second);
    expect(boundAcknowledgement(unchanged)).toBeNull();
  }); // End of the "cannot be moved from one draft to another" case

  it('is refused when the submission came from another base revision', () => {
    const edited = editDraft(text('0'), 'broken:');
    const stale = { ...submissionOf(edited), baseRevision: NEXT };
    expect(acknowledgeRefusal(edited, stale, REFUSAL)).toBe(edited);
  });

  it('does not survive an edit', () => {
    const { draft } = acknowledged();
    const edited = editDraft(draft, 'broken: again');
    expect(edited.consent).toBeNull();
    expect(boundAcknowledgement(edited)).toBeNull();
    expect(submissionOf(edited).acknowledgement).toEqual(EMPTY_ACKNOWLEDGEMENT);
  });

  it('does not survive an undo', () => {
    // The reason this belongs in the draft shape rather than in an editor: undo
    // changes the candidate exactly as typing does, and only the shape sees both.
    const undone = undoDraft(acknowledged().draft);
    expect(undone.value).toBe('0');
    expect(undone.consent).toBeNull();
    expect(boundAcknowledgement(undone)).toBeNull();
  });

  it('does not survive a redo either', () => {
    const redone = redoDraft(undoDraft(acknowledged().draft));
    expect(redone.value).toBe('broken:');
    // The value is back and the consent is not: a redo is a change of candidate
    // like any other, and consent is not re-earned by arriving at the same text
    // again.
    expect(redone.consent).toBeNull();
  });

  it('does not survive a save or a reload', () => {
    const { draft, submission } = acknowledged();
    expect(savedDraft(draft, submission, NEXT).consent).toBeNull();
    expect(reloadedDraft(draft, NEXT, 'broken:').consent).toBeNull();
  });

  it('is refused by the last gate even if a stale consent is planted by hand', () => {
    // Unreachable through this module's API — the consent type is branded on a
    // symbol it does not export, so this literal needs a cast — and checked
    // anyway, because it costs one comparison and being wrong costs a save that
    // writes unparseable text on consent collected for different text.
    const stale = {
      ...text('now'),
      consent: { candidate: 'then', acknowledgement: { accepted: [REJECTION] } }
    } as unknown as Draft<string>;
    expect(boundAcknowledgement(stale)).toBeNull();
    expect(submissionOf(stale).acknowledgement).toEqual(EMPTY_ACKNOWLEDGEMENT);
  }); // End of the "refused by the last gate" case

  it('is frozen, so nothing can add a finding to what goes back', () => {
    const { draft } = acknowledged();
    const accepted = boundAcknowledgement(draft)?.accepted as Finding[];
    expect(() => accepted.push(REJECTION)).toThrow(TypeError);
    expect(() => (EMPTY_ACKNOWLEDGEMENT.accepted as Finding[]).push(REJECTION)).toThrow(TypeError);
  });

  it('sends an empty acknowledgement on a first attempt, never a force flag', () => {
    expect(submissionOf(text('0')).acknowledgement).toEqual({ accepted: [] });
  });
}); // End of the "consent" suite
