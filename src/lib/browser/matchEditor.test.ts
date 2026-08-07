/**
 * The small editor's state machine, driven without a screen.
 *
 * Six groups, and each is a way this editor could be wrong in a manner a person
 * would only discover after their file had been written:
 *
 * 1. **eligibility** — the five refusals computed from the projection, each with
 *    its own reason code and a sentence in both languages;
 * 2. **the six intent rules** — the whole of the consult's Q3, and in particular
 *    the two that look like nothing: an absent field left blank writes nothing,
 *    and a present field retyped to its own value claims no edit;
 * 3. **the round-trip identity** — an editor seeded from a projection and saved
 *    untouched derives eighteen `'Unchanged'`s and four empty lists;
 * 4. **coalescing** — driven by an injected clock, at every boundary the consult
 *    names: idle, blur, a change of field, and a structural action;
 * 5. **the save** — the three arms, the identity adopted, the baselines rebased,
 *    and the acknowledgement round trip that consent is bound by;
 * 6. **the prohibition** — no conflict choice is called "keep my draft", in either
 *    language.
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
  ContentRevision,
  DraftError,
  EditError,
  Finding,
  MatchDraft,
  MatchId,
  MatchView,
  SaveResult,
  ScalarView,
  UnknownEntry
} from '../ipc/types';
import { editDraft, isDirty } from './draft';
import { aliasValue, makeDocument, makeMatch, scalar } from './fixtures';
import type { InvalidationStatus } from './invalidation';
import {
  acknowledgeFindings,
  applySave,
  askToReloadDiskVersion,
  baselineOf,
  baseRevisionOf,
  beginSave,
  buffersOf,
  canSave,
  confirmDiskReload,
  conflictOf,
  editField,
  fieldEligibility,
  fieldIntent,
  fieldRefusalKey,
  focusField,
  isEditable,
  isFieldEditable,
  keepEditing,
  matchDraftOf,
  matchEditorView,
  outcomeIsStale,
  redoEdit,
  reloadTheDiskVersion,
  removeField,
  restoreField,
  saveCouldNotBeSent,
  startMatchEditor,
  TYPING_GROUP_IDLE_MS,
  undoEdit,
  type EditableField,
  type FieldRefusal,
  type MatchBuffers,
  type MatchEditorSession
} from './matchEditor';
import type { AdoptTheDiskVersion } from './editorSave';
import type { DiskAdoptionOutcome } from './saveOutcome';
import { conflictChoiceKey, type ConflictChoice, type ConflictModel } from './saveOutcome';

/** The revision every projection below is minted from. */
const BASE: ContentRevision = 'a'.repeat(64);

/** The revision the file holds after a commit. */
const AFTER: ContentRevision = 'b'.repeat(64);

/** A clock a test drives by hand. */
class Ticker {
  /** The reading the next call answers. */
  private now = 0;

  /**
   * The clock to hand {@link startMatchEditor}.
   *
   * @returns The current reading, in milliseconds.
   */
  readonly clock = (): number => this.now;

  /**
   * Moves the reading forward.
   *
   * @param by - How many milliseconds to advance.
   */
  advance(by: number): void {
    this.now += by;
  } // End of function advance()
} // End of class Ticker

/**
 * A projection of one snippet with a trigger, a body and nothing else.
 *
 * @param overrides - Whatever the case needs beyond the two.
 * @returns The projection.
 */
function projection(overrides: Parameters<typeof makeMatch>[0] = {}): MatchView {
  return makeMatch({ revision: BASE, trigger: ':a', replace: 'b', ...overrides });
} // End of function projection()

/**
 * A session over {@link projection}, with a clock nothing advances.
 *
 * @param match - The projection to seed from.
 * @returns A clean session.
 */
function session(match: MatchView = projection()): MatchEditorSession {
  return startMatchEditor(match, () => 0);
} // End of function session()

/** The identity a committed save answers with. */
const MOVED: MatchId = { document: 1, revision: AFTER, node: 1 };

/** The adoption a save that wrote nothing owes: none. */
const NOT_OWED: InvalidationStatus = { kind: 'notOwed' };

/** The adoption a committed save performed. */
const ADOPTED: InvalidationStatus = { kind: 'done' };

/** The adoption a committed save could not perform. */
const NOT_ADOPTED: InvalidationStatus = {
  kind: 'failed',
  failure: { kind: 'command', error: { code: 'unknownDocument', document: 1 } }
};

/**
 * A `saved` outcome.
 *
 * @param committed - Whether the file was rewritten.
 * @param moved - The snippet's identity in the new revision.
 * @returns The wire result.
 */
function saved(committed = true, moved: MatchId | null = MOVED): SaveResult {
  return { outcome: 'saved', revision: AFTER, committed, notes: [], backup_taken: false, moved };
} // End of function saved()

/**
 * A finding the gate reported about the candidate.
 *
 * A suspicion of the ordinary kind — never `DocumentDoesNotParse`, which only a
 * whole-document replacement can produce.
 */
const SUSPICION: Finding = {
  code: { ReferenceHasNoDeclaration: { name: 'greeting' } },
  span: null,
  node: null,
  path: null
};

/** A refusal a person may accept. */
const REFUSAL: SaveResult = {
  outcome: 'refused',
  verdict: 'RefusedForUnacknowledgedSuspicions',
  findings: [SUSPICION]
};

/**
 * A session whose save came back refused.
 *
 * @returns The session showing the refusal, with its submission recorded.
 */
function refused(): MatchEditorSession {
  const started = beginSave(editField(session(), 'replace', 'c'));
  if (started === null) {
    throw new Error('an edited draft is saveable');
  }
  return applySave(started.session, REFUSAL, NOT_OWED);
} // End of function refused()

/**
 * A scalar that is not the decoder's output.
 *
 * @param text - What the projection carries.
 * @returns The scalar view.
 */
function undecoded(text: string): ScalarView {
  return { ...scalar(text), decoded: false };
} // End of function undecoded()

/**
 * A scalar whose span is zero-width.
 *
 * @param text - What the projection carries.
 * @returns The scalar view.
 */
function zeroWidth(text: string): ScalarView {
  return { ...scalar(text), span: { start: 12, end: 12 } };
} // End of function zeroWidth()

/**
 * A projection whose `label` is a key the projection did not model.
 *
 * @returns The projection.
 */
function unmodelledLabel(): MatchView {
  const entry: UnknownEntry = {
    key: 'label',
    key_node: 9,
    key_span: { start: 0, end: 5 },
    value_span: { start: 6, end: 12 },
    value_kind: 'Mapping',
    value_text: '{a: b}',
    path: null,
    reason: { UnexpectedShape: { found: 'Mapping' } }
  };
  return projection({ unknownEntries: [entry] });
} // End of function unmodelledLabel()

/**
 * A projection with one field's scalar replaced by hand.
 *
 * `makeMatch` builds every scalar the ordinary way, and three of the five
 * refusals are about a scalar that is *not* ordinary, so those views are patched
 * rather than expressed as overrides — the fixture deliberately has no way to
 * write a broken one.
 *
 * @param field - Which field to patch.
 * @param value - The scalar to put there.
 * @returns The projection.
 */
function withScalar(field: 'replace' | 'label' | 'word', value: ScalarView): MatchView {
  const match = projection({ label: 'a name', options: { word: 'true' } });
  if (field === 'replace') {
    return { ...match, content: { ...match.content, replace: value } };
  }
  if (field === 'label') {
    return { ...match, label: value };
  }
  return { ...match, options: { ...match.options, word: value } };
} // End of function withScalar()

/**
 * A snippet carrying all three trigger forms, with their values placed by hand.
 *
 * **The spans are the test data.** `makeMatch` gives every scalar the span
 * `0..text.length`, so a fixture built from it alone puts all three forms at byte
 * zero and could not tell an ordering by position from an ordering by slot — which
 * is exactly the mistake the re-reading found. Each argument is the first byte of
 * one form's value, so a case chooses whether the file's order agrees with the
 * slot order or contradicts it.
 *
 * @param at - Where the file puts each form's value. A form left out of the map
 *   is left out of the snippet.
 * @returns The projection.
 */
function several(at: {
  readonly trigger?: number;
  readonly triggers?: number;
  readonly regex?: number;
}): MatchView {
  const match = projection({
    trigger: at.trigger === undefined ? null : ':one',
    triggers: at.triggers === undefined ? [] : [':two'],
    regex: at.regex === undefined ? null : 'th.*ee',
    triggerKind: 'Several'
  });
  /**
   * The same scalar with its value placed at one byte.
   *
   * @param value - The scalar as the fixture built it.
   * @param start - Where the file puts it.
   * @returns The scalar, moved.
   */
  const placed = (value: ScalarView, start: number): ScalarView => ({
    ...value,
    span: { start, end: start + value.text.length }
  });
  const spec = match.trigger;
  return {
    ...match,
    trigger: {
      ...spec,
      trigger: spec.trigger === null ? null : placed(spec.trigger, at.trigger ?? 0),
      triggers: spec.triggers.map((item) =>
        'Scalar' in item ? { Scalar: placed(item.Scalar, at.triggers ?? 0) } : item
      ),
      regex: spec.regex === null ? null : placed(spec.regex, at.regex ?? 0)
    }
  };
} // End of function several()

describe('what a refused field shows of the file', () => {
  /*
   * **The 2c-2-2 window reading's first finding**, and the reason it needed a
   * screen to find: every model test passed while a `triggers:`-list snippet drew
   * a field name, a refusal sentence, and nothing between them. `field.text` is
   * one scalar, and the whole point of that refusal is that there is no single
   * scalar behind `trigger:`. The re-reading then found two more, and the sharper
   * of them is the ordering below.
   */
  it('draws nothing for a field a control draws', () => {
    const base = baselineOf(projection());
    expect(base.replace.shown).toEqual([]);
    expect(base.label.shown).toEqual([]);
  });

  it('draws every trigger of a list, in the order the list carries them', () => {
    const base = baselineOf(
      makeMatch({ revision: BASE, replace: 'b', triggers: [':r1', ':r2'], triggerKind: 'Multiple' })
    );
    // `TriggerSpec.triggers` crosses one item per source entry in source order,
    // and nothing re-sorts them: this is the one ordering claim that was always
    // true, and it is a claim about items rather than about forms.
    expect(base.trigger.shown).toEqual([
      { kind: 'text', text: ':r1', source: 'triggers' },
      { kind: 'text', text: ':r2', source: 'triggers' }
    ]);
  });

  it('draws the pattern of a regex trigger, and every form of a `Several`', () => {
    expect(
      baselineOf(projection({ trigger: null, regex: 'a.*b', triggerKind: 'Regex' })).trigger.shown
    ).toEqual([{ kind: 'text', text: 'a.*b', source: 'regex' }]);
    // Three forms whose values the file puts in the order the spec names them.
    expect(baselineOf(several({ trigger: 10, triggers: 30, regex: 60 })).trigger.shown).toEqual([
      { kind: 'text', text: ':one', source: 'trigger' },
      { kind: 'text', text: ':two', source: 'triggers' },
      { kind: 'text', text: 'th.*ee', source: 'regex' }
    ]);
  }); // End of the "regex and several" case

  it('orders the forms by where the file puts them, not by the slot order', () => {
    // **The re-reading's §15.1, and this project's named worst defect class.** The
    // comment said *source order* while the code read three named slots in a fixed
    // order, so a file writing `regex:` above `trigger:` drew them the wrong way
    // round. The spans here disagree with the slot order in every pair.
    expect(baselineOf(several({ trigger: 60, triggers: 30, regex: 10 })).trigger.shown).toEqual([
      { kind: 'text', text: 'th.*ee', source: 'regex' },
      { kind: 'text', text: ':two', source: 'triggers' },
      { kind: 'text', text: ':one', source: 'trigger' }
    ]);
    // A list is placed by its earliest item, not by its last or by its slot.
    const listFirst = several({ trigger: 40, triggers: 5, regex: 70 });
    expect(baselineOf(listFirst).trigger.shown.map((one) => one.source)).toEqual([
      'triggers',
      'trigger',
      'regex'
    ]);
  }); // End of the "byte order" case

  it('draws a form it can give no byte position for last, keeping the form order', () => {
    // **A shape the wire type permits and no projection produces**, driven by hand
    // because that is the only way to reach it: `scalar_sequence()` in
    // `crates/espansoconfig-core/src/model/project.rs` is the only writer of
    // `TriggerSpec::triggers` and turns a non-scalar item into a `ValueView::Elided`
    // carrying its own span, so every real item is located. The third window
    // reading built a `triggers:` list of only `[a, b]` and `{k: v}` and watched it
    // draw **first**, in file order — this case pins the defensive branch, and it
    // is not evidence that a person can see it.
    const placed = several({ trigger: 60, regex: 10 });
    const unlocatable: MatchView = {
      ...placed,
      trigger: { ...placed.trigger, triggers: [{ Sequence: [] }] }
    };
    expect(baselineOf(unlocatable).trigger.shown).toEqual([
      { kind: 'text', text: 'th.*ee', source: 'regex' },
      { kind: 'text', text: ':one', source: 'trigger' },
      { kind: 'notScalar', shape: 'Sequence', source: 'triggers' }
    ]);
  }); // End of the "no position" case

  it('names a list item it cannot draw as text rather than dropping it', () => {
    // Silently omitting an item would be the same defect one level down: the file
    // has a trigger the screen does not mention.
    const match = projection({ trigger: null, triggers: [':r1'], triggerKind: 'Multiple' });
    const withAlias: MatchView = {
      ...match,
      trigger: { ...match.trigger, triggers: [...match.trigger.triggers, aliasValue(7)] }
    };
    expect(baselineOf(withAlias).trigger.shown).toEqual([
      { kind: 'text', text: ':r1', source: 'triggers' },
      { kind: 'notScalar', shape: 'Alias', source: 'triggers' }
    ]);
  }); // End of the "unshowable item" case

  it('draws the bytes of a key it did not model, and nothing for one that owns none', () => {
    expect(baselineOf(unmodelledLabel()).label.shown).toEqual([
      // No `source`: this field's own label already names the key.
      { kind: 'text', text: '{a: b}', source: null }
    ]);
    // `ownsNoBytes` genuinely has nothing to draw: the span is zero-width, so
    // there is no value in the file to show, and inventing a marker for it would
    // be this screen saying more than it knows.
    expect(baselineOf(withScalar('label', zeroWidth(''))).label.shown).toEqual([]);
    // And so does a snippet with no trigger of any form.
    expect(baselineOf(projection({ trigger: null, triggerKind: 'Absent' })).trigger.shown).toEqual(
      []
    );
  }); // End of the "nothing to draw" case

  it('draws an undecodable scalar’s source slice, and a carriage return it holds', () => {
    expect(baselineOf(withScalar('replace', undecoded('b'))).replace.shown).toEqual([
      { kind: 'text', text: 'b', source: null }
    ]);
    expect(baselineOf(withScalar('replace', scalar('a\rb'))).replace.shown).toEqual([
      { kind: 'text', text: 'a\rb', source: null }
    ]);
  });
}); // End of the "what a refused field shows" suite

describe('what a field’s edit-eligibility is decided from', () => {
  it('admits an ordinary present scalar and an absent field alike', () => {
    const match = projection();
    expect(fieldEligibility(match, 'replace')).toEqual({ kind: 'editable' });
    // Absent: there is nothing to refuse, and typing into it is an insertion.
    expect(match.label).toBeNull();
    expect(fieldEligibility(match, 'label')).toEqual({ kind: 'editable' });
  });

  it('refuses a scalar the decoder did not produce', () => {
    expect(fieldEligibility(withScalar('replace', undecoded('b')), 'replace')).toEqual({
      kind: 'readOnly',
      reason: 'notDecodable'
    });
  });

  it('refuses a value carrying a carriage return, before it can reach a control', () => {
    // The consult's Q2 policy (i). A browser control turns this character into a
    // line break on the way back out, so the value is shown and not bound.
    expect(fieldEligibility(withScalar('replace', scalar('a\rb')), 'replace')).toEqual({
      kind: 'readOnly',
      reason: 'carriageReturn'
    });
  });

  it('refuses a key whose value owns no bytes', () => {
    // `plan_scalar` refuses this with `TargetOwnsNoBytes`, and the comparison is
    // the same one: `span.start == span.end`.
    expect(fieldEligibility(withScalar('label', zeroWidth('')), 'label')).toEqual({
      kind: 'readOnly',
      reason: 'ownsNoBytes'
    });
  });

  it('refuses a key the file has but the projection did not model', () => {
    // Reading this as absent would derive an insertion of a key the mapping
    // already holds, which Rust refuses by name.
    expect(fieldEligibility(unmodelledLabel(), 'label')).toEqual({
      kind: 'readOnly',
      reason: 'unmodelledShape'
    });
  });

  it('refuses the trigger of anything but a single literal trigger', () => {
    // The consult's Q5, for all four of the other shapes.
    for (const kind of ['Multiple', 'Regex', 'Several', 'Absent'] as const) {
      const match = projection({ triggerKind: kind });
      expect(fieldEligibility(match, 'trigger')).toEqual({
        kind: 'readOnly',
        reason: 'triggerNotSingle'
      });
      // And nothing else on the snippet is refused because of it.
      expect(fieldEligibility(match, 'replace')).toEqual({ kind: 'editable' });
    } // End of the loop over the trigger shapes that are not a single trigger
  });

  it('gives every reason a sentence in both languages', () => {
    const reasons: readonly FieldRefusal[] = [
      'notDecodable',
      'carriageReturn',
      'ownsNoBytes',
      'unmodelledShape',
      'triggerNotSingle'
    ];
    for (const locale of LOCALES) {
      for (const reason of reasons) {
        expect(DICTIONARIES[locale][fieldRefusalKey(reason)].length).toBeGreaterThan(0);
      }
    } // End of the loop over the two locales
  });
}); // End of the "edit-eligibility" suite

describe('the six rules that turn a baseline and a buffer into one intent', () => {
  it('says nothing about a field nobody touched, present or absent', () => {
    const base = baselineOf(projection());
    const buffers = buffersOf(base);
    expect(fieldIntent(base.replace, buffers.replace)).toBe('Unchanged');
    expect(base.label.present).toBe(false);
    expect(fieldIntent(base.label, buffers.label)).toBe('Unchanged');
  });

  it('writes nothing for an initially absent field left blank', () => {
    // **The rule that stops this app writing `label: ''` into a file that never
    // had a label.** The buffer alone cannot tell this case from the next one.
    const base = baselineOf(projection());
    expect(fieldIntent(base.label, { text: '', removed: false })).toBe('Unchanged');
  });

  it('sets an absent field the person typed into', () => {
    const base = baselineOf(projection());
    expect(fieldIntent(base.label, { text: 'a name', removed: false })).toEqual({
      Set: 'a name'
    });
  });

  it('sets a present field cleared to empty', () => {
    // The other side of rule two: this is an edit, and it writes `replace: ''`.
    const base = baselineOf(projection());
    expect(fieldIntent(base.replace, { text: '', removed: false })).toEqual({ Set: '' });
  });

  it('removes a present field the person asked to remove', () => {
    const base = baselineOf(projection());
    expect(fieldIntent(base.replace, { text: 'b', removed: true })).toBe('Remove');
  });

  it('claims no edit for a present field retyped to its own projected value', () => {
    // `plan_scalar` would answer `Ok(None)` for this, so what a `Set` costs is
    // honesty rather than bytes — and this phase's named failure is exactly a
    // draft that disagrees with the projection.
    const base = baselineOf(projection());
    expect(fieldIntent(base.replace, { text: 'b', removed: false })).toBe('Unchanged');
  });

  it('says nothing about removing a key the file does not have', () => {
    // Rust already treats `(Remove, None)` as a no-op, so the two agree; what this
    // adds is that the draft does not claim an edit it does not have.
    const base = baselineOf(projection());
    expect(fieldIntent(base.label, { text: '', removed: true })).toBe('Unchanged');
  });

  it('says nothing about a field that may not be edited, whatever its buffer holds', () => {
    // Defence in depth: a buffer that diverged by any route contributes no edit.
    const base = baselineOf(withScalar('replace', scalar('a\rb')));
    expect(base.replace.eligibility).toEqual({ kind: 'readOnly', reason: 'carriageReturn' });
    expect(fieldIntent(base.replace, { text: 'anything', removed: false })).toBe('Unchanged');
    expect(fieldIntent(base.replace, { text: 'x', removed: true })).toBe('Unchanged');
  });
}); // End of the "six rules" suite

describe('the round trip, which must be the identity', () => {
  it('derives eighteen unchanged fields and four empty lists from an untouched draft', () => {
    const editor = session();
    const draft = matchDraftOf(editor.baseline, editor.draft.value);
    const scalars: readonly (keyof MatchDraft)[] = [
      'trigger',
      'regex',
      'replace',
      'markdown',
      'html',
      'image_path',
      'form',
      'label',
      'comment',
      'word',
      'left_word',
      'right_word',
      'propagate_case',
      'uppercase_style',
      'force_mode',
      'force_clipboard',
      'paragraph',
      'anchor'
    ];
    expect(scalars).toHaveLength(18);
    for (const field of scalars) {
      expect(draft[field]).toBe('Unchanged');
    }
    expect(draft.triggers).toEqual([]);
    expect(draft.search_terms).toEqual([]);
    expect(draft.vars).toEqual([]);
    expect(draft.form_fields).toEqual([]);
  }); // End of the "eighteen unchanged fields" case

  it('is still the identity for a snippet that fills all six fields', () => {
    const editor = session(
      projection({
        label: 'a name',
        options: { word: 'true', left_word: 'false', right_word: 'true' }
      })
    );
    const draft = matchDraftOf(editor.baseline, editor.draft.value);
    for (const field of ['trigger', 'replace', 'label', 'word', 'left_word', 'right_word'] as const) {
      expect(draft[field]).toBe('Unchanged');
    }
    expect(isDirty(editor.draft)).toBe(false);
    expect(canSave(editor)).toBe(false);
  });

  it('takes its base revision from the identity the projection was minted from', () => {
    // One value rather than two reads, so a projection and its revision cannot
    // disagree the way 2c-1b's text and revision could.
    expect(baseRevisionOf(session())).toBe(BASE);
  });
}); // End of the "round trip" suite

describe('what the controls may change, and what they may not', () => {
  it('refuses an edit to a field the projection refused', () => {
    const editor = session(withScalar('replace', scalar('a\rb')));
    expect(isFieldEditable(editor, 'replace')).toBe(false);
    expect(editField(editor, 'replace', 'c')).toBe(editor);
    expect(removeField(editor, 'replace')).toBe(editor);
  });

  it('refuses a value carrying a carriage return, at this door too', () => {
    // The verdict is a statement about the projection; this is a statement about
    // this function, which a caller that is not a control could otherwise pass.
    const editor = session();
    expect(editField(editor, 'replace', 'a\rb')).toBe(editor);
  });

  it('refuses everything while a save is in flight', () => {
    const started = beginSave(editField(session(), 'replace', 'c'));
    expect(started).not.toBeNull();
    const flight = started!.session;
    expect(isEditable(flight)).toBe(false);
    expect(editField(flight, 'replace', 'd')).toBe(flight);
    expect(undoEdit(flight)).toBe(flight);
  });

  it('refuses a removal of a key the file does not have', () => {
    const editor = session();
    expect(editor.baseline.label.present).toBe(false);
    expect(removeField(editor, 'label')).toBe(editor);
  });

  it('keeps the text through a removal, so restoring gives it back', () => {
    const removed = removeField(session(), 'replace');
    expect(removed.draft.value.replace).toEqual({ text: 'b', removed: true });
    const restored = restoreField(removed, 'replace');
    expect(restored.draft.value.replace).toEqual({ text: 'b', removed: false });
    expect(isDirty(restored.draft)).toBe(false);
  });

  it('takes a removal back when the person types into the field', () => {
    const typed = editField(removeField(session(), 'replace'), 'replace', 'c');
    expect(typed.draft.value.replace).toEqual({ text: 'c', removed: false });
  });

  it('refuses everything for a snippet this app says is not safely editable', () => {
    const editor = session(projection({ safelyEditable: false, blockingHazard: 'AliasReference' }));
    expect(isEditable(editor)).toBe(false);
    expect(matchEditorView(editor).editability).toEqual({ kind: 'blocked', hazard: 'AliasReference' });
    expect(editField(editor, 'replace', 'c')).toBe(editor);
  });
}); // End of the "what the controls may change" suite

describe('history, coalesced per field on an injected clock', () => {
  it('joins consecutive keystrokes in one field into one step', () => {
    const ticker = new Ticker();
    let editor = startMatchEditor(projection(), ticker.clock);
    for (const text of ['b1', 'b12', 'b123']) {
      ticker.advance(50);
      editor = editField(editor, 'replace', text);
    }
    expect(editor.draft.value.replace.text).toBe('b123');
    // One step, and undoing it goes back to what the file held.
    expect(editor.draft.past).toHaveLength(1);
    expect(undoEdit(editor).draft.value.replace.text).toBe('b');
  });

  it('starts a new step after a pause longer than the idle boundary', () => {
    const ticker = new Ticker();
    let editor = startMatchEditor(projection(), ticker.clock);
    editor = editField(editor, 'replace', 'b1');
    ticker.advance(TYPING_GROUP_IDLE_MS + 1);
    editor = editField(editor, 'replace', 'b12');
    expect(editor.draft.past).toHaveLength(2);
    expect(undoEdit(editor).draft.value.replace.text).toBe('b1');
  });

  it('treats the boundary itself as still one burst', () => {
    const ticker = new Ticker();
    let editor = startMatchEditor(projection(), ticker.clock);
    editor = editField(editor, 'replace', 'b1');
    ticker.advance(TYPING_GROUP_IDLE_MS);
    editor = editField(editor, 'replace', 'b12');
    expect(editor.draft.past).toHaveLength(1);
  });

  it('ends the group when the typing moves to another field', () => {
    const ticker = new Ticker();
    let editor = startMatchEditor(projection({ label: 'a name' }), ticker.clock);
    editor = editField(editor, 'replace', 'b1');
    editor = editField(editor, 'label', 'a name!');
    editor = editField(editor, 'replace', 'b12');
    // Three steps: nothing here is in the same field as the change before it.
    expect(editor.draft.past).toHaveLength(3);
  });

  it('ends the group on a blur and on a change of focused field', () => {
    const ticker = new Ticker();
    let editor = startMatchEditor(projection(), ticker.clock);
    editor = editField(editor, 'replace', 'b1');
    editor = focusField(editor, null);
    expect(editor.group).toBeNull();
    editor = editField(editor, 'replace', 'b12');
    expect(editor.draft.past).toHaveLength(2);

    let again = startMatchEditor(projection(), ticker.clock);
    again = editField(again, 'replace', 'b1');
    again = focusField(again, 'label');
    expect(again.group).toBeNull();
  }); // End of the "ends the group on a blur" case

  it('ends the group on a structural action', () => {
    const ticker = new Ticker();
    let editor = startMatchEditor(projection(), ticker.clock);
    editor = editField(editor, 'replace', 'b1');
    editor = removeField(editor, 'replace');
    expect(editor.group).toBeNull();
    editor = restoreField(editor, 'replace');
    editor = editField(editor, 'replace', 'b12');
    // Four steps: the burst, the removal, the restoration, and the burst after it.
    expect(editor.draft.past).toHaveLength(4);
  });

  it('ends the group on an undo, so the next keystroke does not amend what came back', () => {
    const ticker = new Ticker();
    let editor = startMatchEditor(projection(), ticker.clock);
    editor = editField(editor, 'replace', 'b1');
    editor = undoEdit(editor);
    expect(editor.group).toBeNull();
    editor = editField(editor, 'replace', 'b9');
    expect(editor.draft.past).toHaveLength(1);
    expect(undoEdit(editor).draft.value.replace.text).toBe('b');
  });

  it('does not extend a group with a keystroke that changed nothing', () => {
    const ticker = new Ticker();
    let editor = startMatchEditor(projection(), ticker.clock);
    editor = editField(editor, 'replace', 'b1');
    const at = editor.group?.at;
    ticker.advance(TYPING_GROUP_IDLE_MS);
    editor = editField(editor, 'replace', 'b1');
    expect(editor.group?.at).toBe(at);
  });

  it('leaves no step behind when a burst ends where it began', () => {
    // **The 2c-2 review's fifth finding.** Type three characters and erase them
    // again inside the window: the amendment restores the value the group started
    // from, and without the collapse its history entry would survive as an undo the
    // person can press that changes nothing on screen.
    const ticker = new Ticker();
    let editor = startMatchEditor(projection(), ticker.clock);
    editor = editField(editor, 'replace', 'b1');
    ticker.advance(100);
    editor = editField(editor, 'replace', 'b12');
    ticker.advance(100);
    editor = editField(editor, 'replace', 'b');
    expect(editor.draft.value.replace.text).toBe('b');
    expect(isDirty(editor.draft)).toBe(false);
    expect(matchEditorView(editor).canUndo).toBe(false);
    expect(editor.draft.past).toEqual([]);
    // The group went with the step it was amending, so the next keystroke pushes
    // one rather than amending a step that no longer exists.
    expect(editor.group).toBeNull();
    ticker.advance(1);
    editor = editField(editor, 'replace', 'bz');
    expect(editor.draft.past).toHaveLength(1);
    expect(undoEdit(editor).draft.value.replace.text).toBe('b');
  }); // End of the "burst ends where it began" case

  it('redoes what it undid, and keeps dirty derived', () => {
    const ticker = new Ticker();
    const editor = editField(startMatchEditor(projection(), ticker.clock), 'replace', 'c');
    expect(isDirty(editor.draft)).toBe(true);
    const undone = undoEdit(editor);
    expect(isDirty(undone.draft)).toBe(false);
    expect(redoEdit(undone).draft.value.replace.text).toBe('c');
  });
}); // End of the "history, coalesced" suite

describe('the save, and what its answer moves', () => {
  it('is offered only for a draft that differs from what the file holds', () => {
    expect(canSave(session())).toBe(false);
    expect(beginSave(session())).toBeNull();
    const edited = editField(session(), 'replace', 'c');
    expect(canSave(edited)).toBe(true);
    expect(beginSave(edited)).not.toBeNull();
  });

  it('sends the draft derived from the candidate it recorded', () => {
    const started = beginSave(editField(session(), 'replace', 'c'));
    expect(started?.draft.replace).toEqual({ Set: 'c' });
    expect(started?.draft.label).toBe('Unchanged');
    expect(started?.submission.candidate.replace).toEqual({ text: 'c', removed: false });
    expect(started?.submission.baseRevision).toBe(BASE);
    expect(started?.session.phase).toBe('saving');
  });

  it('adopts the identity a commit answers with', () => {
    const started = beginSave(editField(session(), 'replace', 'c'))!;
    const done = applySave(started.session, saved(), ADOPTED);
    expect(done.match).toEqual(MOVED);
    expect(done.identityStale).toBe(false);
    expect(baseRevisionOf(done)).toBe(AFTER);
    expect(isDirty(done.draft)).toBe(false);
    expect(matchEditorView(done).needsReprojection).toBe(true);
  });

  it('stops offering to save when a commit answered no identity', () => {
    const started = beginSave(editField(session(), 'replace', 'c'))!;
    const done = applySave(started.session, saved(true, null), ADOPTED);
    expect(done.identityStale).toBe(true);
    expect(isEditable(done)).toBe(false);
    expect(canSave(done)).toBe(false);
    // Nothing the person typed is lost, so a caller can seed a new session.
    expect(done.draft.value.replace.text).toBe('c');
  });

  it('moves the baselines to what was written, so a later clear is not silently dropped', () => {
    // **The draft-versus-projection mistake this phase is named after.** Insert a
    // label, save it, then clear it: without the rebase the absent-and-blank rule
    // would answer `'Unchanged'` and the label would stay in the file for ever.
    const started = beginSave(editField(session(), 'label', 'a name'))!;
    const done = applySave(started.session, saved(), ADOPTED);
    expect(done.baseline.label).toMatchObject({ present: true, value: 'a name' });
    // Asked of the rebased baseline directly rather than through `editField`,
    // because a commit now stops the session accepting changes until a fresh
    // projection is seeded — driving a control here would test that gate instead
    // of this rebase.
    expect(fieldIntent(done.baseline.label, { text: '', removed: false })).toEqual({ Set: '' });
    // And the same question against the baseline as it was **before** the save is
    // the other half of the rule: an absent field left blank writes nothing.
    expect(fieldIntent(started.session.baseline.label, { text: '', removed: false })).toBe(
      'Unchanged'
    );
  });

  it('stops accepting changes after a commit until a fresh projection is seeded', () => {
    // **The 2c-2-2 review's second finding.** The baselines a commit rebases are
    // right about presence and values and say nothing about the new scalars'
    // spelling, spans or decodability, so every eligibility verdict this session
    // holds is about bytes that no longer exist.
    const started = beginSave(editField(session(), 'replace', 'c'))!;
    const done = applySave(started.session, saved(), ADOPTED);
    expect(matchEditorView(done).needsReprojection).toBe(true);
    expect(isEditable(done)).toBe(false);
    expect(editField(done, 'replace', 'd')).toBe(done);

    // **Dismissing the panel does not dismiss the obligation.** While this was
    // derived from the outcome, `keepEditing` cleared the outcome and with it the
    // only trace of the debt, and editing resumed on carried-over eligibility.
    const dismissed = keepEditing(done);
    expect(dismissed.outcome).toBeNull();
    expect(matchEditorView(dismissed).needsReprojection).toBe(true);
    expect(isEditable(dismissed)).toBe(false);

    // The one way out, and it is a new session rather than a transition.
    const reseeded = startMatchEditor(projection({ replace: 'c' }), () => 0);
    expect(matchEditorView(reseeded).needsReprojection).toBe(false);
    expect(isEditable(reseeded)).toBe(true);
  }); // End of the "re-projection is owed" case

  it('moves a removed field’s baseline to absent, and says nothing about it afterwards', () => {
    const started = beginSave(removeField(session(), 'replace'))!;
    expect(started.draft.replace).toBe('Remove');
    const done = applySave(started.session, saved(), ADOPTED);
    expect(done.baseline.replace).toMatchObject({ present: false, value: '' });
    // The buffer still says "removed", and the file no longer has the key, so the
    // draft claims nothing and is not dirty.
    expect(fieldIntent(done.baseline.replace, done.draft.value.replace)).toBe('Unchanged');
    expect(isDirty(done.draft)).toBe(false);
  });

  it('treats a `committed: false` as the success it is', () => {
    const started = beginSave(editField(session(), 'replace', 'c'))!;
    const done = applySave(started.session, saved(false, null), NOT_OWED);
    expect(done.identityStale).toBe(false);
    expect(baseRevisionOf(done)).toBe(AFTER);
    expect(matchEditorView(done).messages).toEqual([{ kind: 'nothingToWrite' }]);
    expect(matchEditorView(done).needsReprojection).toBe(false);
  });

  it('describes a refusal with the edit describer, which says nothing about whole documents', () => {
    const view = matchEditorView(refused());
    expect(view.outcome?.kind).toBe('refused');
    expect(view.messages).toEqual([{ kind: 'nothingWasWritten' }]);
    // `rawSave` is the whole-document disclosure, and this is not one.
    expect(view.outcome?.kind === 'refused' ? view.outcome.rawSave : 'missing').toBeNull();
    expect(view.refusalChoices).toEqual(['saveAnyway', 'keepEditing']);
  });

  it('records consent for the exact candidate, and withdraws it when the draft moves', () => {
    const consented = acknowledgeFindings(refused());
    const again = beginSave(consented);
    expect(again?.submission.acknowledgement).toEqual({ accepted: [SUSPICION] });

    // One more keystroke and the findings are about something nobody is looking
    // at: the consent goes, and the offer goes with it.
    const moved = editField(consented, 'replace', 'cc');
    expect(outcomeIsStale(moved)).toBe(true);
    expect(matchEditorView(moved).refusalChoices).toEqual(['keepEditing']);
    expect(matchEditorView(moved).findingsAreStale).toBe(true);
    expect(beginSave(moved)?.submission.acknowledgement).toEqual({ accepted: [] });
  }); // End of the "records consent" case

  it('records no consent when there is no refusal on screen', () => {
    const editor = editField(session(), 'replace', 'c');
    expect(acknowledgeFindings(editor)).toBe(editor);
  });

  it('reports a send that never left as neither an outcome nor a written file', () => {
    const started = beginSave(editField(session(), 'replace', 'c'))!;
    const notSent = saveCouldNotBeSent(started.session, false, null);
    expect(notSent.sendFailure).toEqual({ kind: 'notSent', reason: null });
    expect(notSent.outcome).toBeNull();
    expect(notSent.draft.value.replace.text).toBe('c');
    expect(saveCouldNotBeSent(started.session, true, null).sendFailure).toEqual({
      kind: 'mayHaveWritten',
      reason: null
    });
    expect(matchEditorView(notSent).failureLines).toEqual([]);
  });

  it('unfolds a refused draft into the sentence that names the field', () => {
    // **The reason 2c-2-2 added the third argument.** `save_match`'s commonest
    // rejection is `draftRefused`, and its `DraftError` is what says *which field
    // cannot be written and why*. Before this, all thirty-two of those sentences
    // reached the developer console and no screen at all.
    const started = beginSave(editField(session(), 'replace', 'c'))!;
    const unmodelled: DraftError = {
      FieldHasAnUnmodelledShape: { field: 'label', found: 'Sequence' }
    };
    const refusedDraft: IpcFailure = {
      kind: 'command',
      error: { code: 'draftRefused', error: unmodelled }
    };
    const answered = saveCouldNotBeSent(started.session, false, refusedDraft);
    expect(matchEditorView(answered).failureLines).toEqual([
      { kind: 'failure', failure: refusedDraft },
      { kind: 'draft', error: unmodelled }
    ]);
  }); // End of the "refused draft" case

  it('unfolds a save that failed on its patch down to the edit that failed', () => {
    // The other chain, and the deepest one a field save can produce: a
    // `saveFailed` carrying a `SaveError` whose `Patch` arm carries an
    // `EditError`. Thirty-six more sentences that had never been drawn.
    const started = beginSave(editField(session(), 'replace', 'c'))!;
    const patch: EditError = { EmptyTarget: { edit: 0, node: 7, at: { start: 12, end: 12 } } };
    const failedSave: IpcFailure = {
      kind: 'command',
      error: {
        code: 'saveFailed',
        error: { Patch: patch },
        may_have_written: false
      }
    };
    const answered = saveCouldNotBeSent(started.session, false, failedSave);
    expect(matchEditorView(answered).failureLines).toEqual([
      { kind: 'failure', failure: failedSave },
      { kind: 'save', error: { Patch: patch } },
      { kind: 'edit', error: patch }
    ]);
  }); // End of the "failed patch" case

  it('says only what it has to say about a rejection that carries no chain', () => {
    const started = beginSave(editField(session(), 'replace', 'c'))!;
    const stale: IpcFailure = {
      kind: 'command',
      error: { code: 'identityStaleRevision', expected: AFTER, found: BASE }
    };
    expect(matchEditorView(saveCouldNotBeSent(started.session, false, stale)).failureLines).toEqual(
      [{ kind: 'failure', failure: stale }]
    );
    const unexpected: IpcFailure = { kind: 'unexpected' };
    expect(
      matchEditorView(saveCouldNotBeSent(started.session, true, unexpected)).failureLines
    ).toEqual([{ kind: 'failure', failure: unexpected }]);
  }); // End of the "no chain" case

  it('puts an outcome away without touching the draft', () => {
    const dismissed = keepEditing(refused());
    expect(dismissed.outcome).toBeNull();
    expect(dismissed.submitted).toBeNull();
    expect(dismissed.draft.value.replace.text).toBe('c');
    expect(canSave(dismissed)).toBe(true);
  });

  it('does nothing with an answer to a save that was never started', () => {
    const editor = session();
    expect(applySave(editor, saved(), ADOPTED)).toBe(editor);
  });

  it('refuses at the last gate to write a value carrying a carriage return', () => {
    // **The 2c-2 review's third finding.** `MatchBuffers` has no brand, so this
    // call type-checks: a well-typed caller can put a carriage return into the
    // draft without going through `editField`, which refuses one. Without the
    // save-time gate `{ Set: 'a\rb' }` would reach `save_match` and be written into
    // the user's file, and no control in this window could ever read it back.
    const editor = session();
    const smuggled = editDraft(editor.draft, {
      ...editor.draft.value,
      replace: { text: 'a\rb', removed: false }
    });
    const driven: MatchEditorSession = { ...editor, draft: smuggled };
    expect(isDirty(driven.draft)).toBe(true);
    expect(canSave(driven)).toBe(true);
    expect(beginSave(driven)).toBeNull();
  }); // End of the "last gate" case

  it('still saves a snippet that merely holds a carriage return it is not writing', () => {
    // The other side of the same gate: a field refused for `carriageReturn` has
    // that character in its baseline and therefore in its buffer, legitimately. Its
    // intent is `'Unchanged'`, so the gate — which looks at what would be written —
    // must not refuse the whole save because of it.
    const editor = editField(session(withScalar('replace', scalar('a\rb'))), 'label', 'renamed');
    const started = beginSave(editor);
    expect(started?.draft.label).toEqual({ Set: 'renamed' });
    expect(started?.draft.replace).toBe('Unchanged');
  });

  it('says the file was written and this window is out of step when adoption failed', () => {
    // **The 2c-2 review's second finding, at this end.** A committed save whose
    // re-read failed is still a committed save: the line is added *beside* the
    // saved arm and never in place of it (`PROGRESS.md` D2). The session stops
    // offering to save, because there is no projection left to resolve an identity
    // against.
    const started = beginSave(editField(session(), 'replace', 'c'))!;
    const done = applySave(started.session, saved(), NOT_ADOPTED);
    const view = matchEditorView(done);
    expect(view.outcome?.kind).toBe('saved');
    expect(view.messages).toEqual([{ kind: 'fileWritten' }, { kind: 'windowOutOfStep' }]);
    expect(done.identityStale).toBe(true);
    expect(canSave(done)).toBe(false);
    // And dismissing the panel takes the extra line with it.
    expect(matchEditorView(keepEditing(done)).messages).toEqual([]);
  }); // End of the "out of step" case
}); // End of the "the save" suite

describe('the conflict, which is terminal in this sub-phase', () => {
  /**
   * A conflicted save of an edited draft.
   *
   * @returns The session showing the conflict.
   */
  function conflicted(): MatchEditorSession {
    const started = beginSave(editField(session(), 'replace', 'c'));
    if (started === null) {
      throw new Error('an edited draft is saveable');
    }
    const conflict: SaveResult = {
      outcome: 'conflict',
      expected: BASE,
      found: AFTER,
      disk_revision: AFTER,
      disk_text: 'matches:\n  - trigger: x\n    replace: theirs\n',
      disk: makeDocument({ revision: AFTER })
    };
    return applySave(started.session, conflict, NOT_OWED);
  } // End of function conflicted()

  it('keeps the draft and stops accepting changes', () => {
    const stuck = conflicted();
    expect(conflictOf(stuck)).not.toBeNull();
    expect(conflictOf(stuck)?.draft.value.replace.text).toBe('c');
    expect(isEditable(stuck)).toBe(false);
    expect(editField(stuck, 'replace', 'd')).toBe(stuck);
  });

  it('offers three ways out, and none of them is called "keep my draft"', () => {
    // **2c-4a-3a offers what 2c-4a-2 built.** Both capability booleans are `true`
    // for this surface, so the non-destructive way out comes first, the copy that
    // makes the destruction survivable comes next, and the destructive one is two
    // clicks away — the ordering `conflictChoicesFor` owns, not this module's.
    const choices = matchEditorView(conflicted()).conflictChoices;
    expect(choices).toEqual<readonly ConflictChoice[]>([
      'keepEditing',
      'copyDraft',
      'reloadDiskVersion'
    ]);
    for (const locale of LOCALES) {
      for (const choice of choices) {
        // Both draft kinds, because `confirmReload` has one label per kind since
        // 2c-4a-3b and a forbidden phrase could hide in either of them.
        for (const draftKind of ['authoredText', 'operationChoice'] as const) {
          const label = DICTIONARIES[locale][conflictChoiceKey(choice, draftKind)].toLowerCase();
          expect(label).not.toContain('keep my draft');
          expect(label).not.toContain('mantener mi borrador');
        } // End of the loop over the two draft kinds
      } // End of the loop over the choices this surface offers
    } // End of the loop over the two locales
  });

  it('labels the retained draft field by field, and says what each would do', () => {
    // **The list the panel draws and the copy is built from, and it is one list.**
    // All six fields in `EDITABLE_FIELDS` order, each with the label the detail
    // pane uses, the buffer's exact text, and what a save would actually say about
    // it — never a presence flag. An untouched field is `unchanged`, so an
    // initially absent field left blank cannot be described as "this text would be
    // written", which is the rule the whole draft-versus-projection arrangement
    // exists for.
    const view = matchEditorView(conflicted());
    expect(view.retainedDraft.map((field) => field.label)).toEqual([
      'trigger',
      'replace',
      'label',
      'word',
      'leftWord',
      'rightWord'
    ]);
    const replace = view.retainedDraft.find((field) => field.label === 'replace');
    expect(replace?.text).toBe('c');
    expect(replace?.status).toBe('setting');
    const trigger = view.retainedDraft.find((field) => field.label === 'trigger');
    expect(trigger?.text).toBe(':a');
    expect(trigger?.status).toBe('unchanged');
    const label = view.retainedDraft.find((field) => field.label === 'label');
    expect(label?.text).toBe('');
    expect(label?.status).toBe('unchanged');
    // And nothing is retained when there is no conflict to retain it.
    expect(matchEditorView(session()).retainedDraft).toEqual([]);
  }); // End of the "retained draft" case

  it('says a drafted removal would take the key out, and keeps its text', () => {
    // A removed field keeps its text in its buffer, so a copy that dropped either
    // the text or the status would not preserve what was drafted (consult Q4).
    const started = beginSave(removeField(session(projection({ label: 'Signature' })), 'label'));
    if (started === null) {
      throw new Error('a drafted removal is saveable');
    }
    const stuck = applySave(
      started.session,
      {
        outcome: 'conflict',
        expected: BASE,
        found: AFTER,
        disk_revision: AFTER,
        disk_text: 'matches:\n  - trigger: x\n',
        disk: makeDocument({ revision: AFTER })
      },
      NOT_OWED
    );
    const label = matchEditorView(stuck).retainedDraft.find((one) => one.label === 'label');
    expect(label?.status).toBe('removing');
    expect(label?.text).toBe('Signature');
  }); // End of the "drafted removal" case

  it('gives the controls back when the panel is dismissed', () => {
    const kept = keepEditing(conflicted());
    expect(conflictOf(kept)).toBeNull();
    expect(isEditable(kept)).toBe(true);
  });
}); // End of the "conflict" suite

describe('the view a screen draws', () => {
  it('describes all six fields, in order, with their labels and their verdicts', () => {
    const view = matchEditorView(session(unmodelledLabel()));
    expect(view.fields.map((field) => field.field)).toEqual<readonly EditableField[]>([
      'trigger',
      'replace',
      'label',
      'word',
      'left_word',
      'right_word'
    ]);
    expect(view.fields.map((field) => field.label)).toEqual([
      'trigger',
      'replace',
      'label',
      'word',
      'leftWord',
      'rightWord'
    ]);
    const label = view.fields.find((field) => field.field === 'label');
    expect(label?.editable).toBe(false);
    expect(label?.refusal).toBe('unmodelledShape');
    expect(label?.intent).toBe('Unchanged');
  }); // End of the "describes all six fields" case

  it('offers a removal only for a present field that is not already removed', () => {
    const editor = session();
    const before = matchEditorView(editor).fields;
    expect(before.find((field) => field.field === 'replace')?.canRemove).toBe(true);
    expect(before.find((field) => field.field === 'label')?.canRemove).toBe(false);
    const after = matchEditorView(removeField(editor, 'replace')).fields;
    const replace = after.find((field) => field.field === 'replace');
    expect(replace?.canRemove).toBe(false);
    expect(replace?.canRestore).toBe(true);
    expect(replace?.intent).toBe('Remove');
  });

  it('derives dirty, undo and redo rather than storing them', () => {
    const edited = editField(session(), 'replace', 'c');
    const view = matchEditorView(edited);
    expect(view.dirty).toBe(true);
    expect(view.canUndo).toBe(true);
    expect(view.canRedo).toBe(false);
    expect(matchEditorView(undoEdit(edited)).dirty).toBe(false);
    expect(matchEditorView(undoEdit(edited)).canRedo).toBe(true);
  });
}); // End of the "view" suite

describe('the confirmed reload', () => {
  // **2c-4a-2 built this and 2c-4a-3a offers it.** The consult's Q3 gives every
  // one of the six surfaces a confirmed reload; withholding the *offering* until
  // the panel existed was right, and withholding the **transition** was not — an
  // unoffered transition can be built and driven without drawing anything, and
  // leaving it out would have made step 3 invent five model machines on top of
  // five panels. `offersReload` is now `true` for this surface and
  // `MatchEditor.svelte` draws the two controls; every case here calls the
  // transitions directly, as that component's arms do.

  /**
   * A conflicted save of an edited draft.
   *
   * @returns The session showing the conflict.
   */
  function conflicted(): MatchEditorSession {
    const started = beginSave(editField(session(), 'replace', 'c'));
    if (started === null) {
      throw new Error('an edited draft is saveable');
    }
    const answer: SaveResult = {
      outcome: 'conflict',
      expected: BASE,
      found: AFTER,
      disk_revision: AFTER,
      disk_text: 'matches:\n  - trigger: x\n    replace: theirs\n',
      disk: makeDocument({ revision: AFTER })
    };
    return applySave(started.session, answer, NOT_OWED);
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
    readonly adopt: AdoptTheDiskVersion<MatchBuffers>;
    readonly adoptions: ConflictModel<MatchBuffers>[];
  } {
    const adoptions: ConflictModel<MatchBuffers>[] = [];
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
    expect(matchEditorView(asked).awaitingReloadConfirmation).toBe(true);
    // The warning alone is not a confirmation either.
    expect(reloadTheDiskVersion(asked, recorder.adopt)).toBe(asked);
    expect(recorder.adoptions).toEqual([]);
    expect(matchEditorView(asked).closed).toBe(false);
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
    expect(matchEditorView(after).closed).toBe(true);
    expect(conflictOf(after)).toBeNull();
    expect(isEditable(after)).toBe(false);
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
    expect(after.closed).toBe(false);
    // **And the reload stops being offered rather than staying pressable.** The
    // confirmation is spent and the window said no for a reason asking again
    // cannot change, so the step is terminal, the panel discloses it, and only
    // *Keep editing* and the copy remain (2c-4a-3a review, finding 3).
    expect(after.reload.kind).toBe('refused');
    expect(matchEditorView(after).reloadUnavailable).toBe(true);
    expect(matchEditorView(after).awaitingReloadConfirmation).toBe(false);
    expect(matchEditorView(after).conflictChoices).not.toContain('confirmReload');
    expect(matchEditorView(after).conflictChoices).not.toContain('reloadDiskVersion');
    expect(matchEditorView(after).conflictChoices).toContain('keepEditing');
    // Asking again cannot spend anything a second time.
    expect(reloadTheDiskVersion(after, refusing.adopt)).toBe(after);
    expect(refusing.adoptions).toHaveLength(1);
    expect(conflictOf(after)).not.toBeNull();
  }); // End of the "window refused" case

  it('offers the confirmation label once the warning has been asked for', () => {
    // **What 2c-4a-3a changed here, and it is one boolean.** The transition was
    // built and driven by this suite from 2c-4a-2; `offersReload` was `false`, so
    // the list said `['keepEditing']` at both steps and no control could reach the
    // arms above. Now the second step names `confirmReload` and never
    // `reloadDiskVersion` beside it — the two labels are exclusive, which is
    // `conflictChoicesFor`'s rule and is checked there.
    const asked = askToReloadDiskVersion(conflicted());
    expect(matchEditorView(asked).conflictChoices).toEqual<readonly ConflictChoice[]>([
      'keepEditing',
      'copyDraft',
      'confirmReload'
    ]);
    expect(matchEditorView(asked).awaitingReloadConfirmation).toBe(true);
  });

  it('forgets a confirmation when the panel is dismissed or a new answer arrives', () => {
    // A confirmation is a person's answer to **one** conflict. Reaching the
    // confirmed step and then dismissing must not leave it spendable.
    const recorder = adopting();
    const confirmed = confirmDiskReload(askToReloadDiskVersion(conflicted()));
    const dismissed = keepEditing(confirmed);
    expect(dismissed.reload.kind).toBe('idle');
    expect(reloadTheDiskVersion(dismissed, recorder.adopt)).toBe(dismissed);
    expect(recorder.adoptions).toEqual([]);
  }); // End of the "dismissal forgets the confirmation" case
}); // End of the "confirmed reload" suite
