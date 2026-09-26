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
  CorrespondenceEntry,
  CorrespondenceTable,
  DraftError,
  EditError,
  Finding,
  MatchDraft,
  MatchId,
  MatchView,
  ReapplyResolution,
  SaveResult,
  ScalarView,
  UnknownEntry
} from '../ipc/types';
import { describeEditorReapplyObstacle } from '../i18n';
import {
  externalConflictSource,
  saveConflictSource,
  standingConflictOf,
  type ConflictSource,
  type ExternalChangeConflictSource,
  type ExternalConflictObservation,
  type ObservationVerdict
} from './conflictSource';
import { editDraft, isDirty } from './draft';
import {
  aliasValue,
  makeConflict,
  makeDocument,
  makeMatch,
  scalar,
  styledScalar,
  unknownEntry
} from './fixtures';
import type { InvalidationStatus } from './invalidation';
import {
  acknowledgeFindings,
  acknowledgeSnapshot,
  addListItem,
  applyObservation,
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
  editorReapplyObstacleKey,
  fieldEligibility,
  fieldIntent,
  fieldReapply,
  fieldRefusalKey,
  focusField,
  isEditable,
  isFieldEditable,
  keepEditing,
  matchDraftOf,
  matchEditorView,
  outcomeIsStale,
  planMatchReapply,
  reapplyToDiskVersion,
  redoEdit,
  reloadTheDiskVersion,
  removeField,
  restoreField,
  saveCouldNotBeSent,
  startMatchEditor,
  TYPING_GROUP_IDLE_MS,
  undoEdit,
  type EditableField,
  type EditorReapplyObstacle,
  type FieldRefusal,
  type MatchBuffers,
  type MatchEditorSession
} from './matchEditor';
import { NOT_RELOADING, type AdoptTheDiskVersion } from './editorSave';
import {
  arbitratedDelivery,
  retainedDelivery,
  writtenHereDelivery,
  type ObservationDelivery
} from './observationDelivery';
import { attemptOfReapply, reapplyToShow, type StandingOriginGuard } from './reapply';
import type { DiskAdoptionOutcome, ExternalConflictModel } from './saveOutcome';
import {
  conflictChoiceKey,
  isExternalConflict,
  isSaveConflict,
  type ConflictChoice,
  type ConflictModel
} from './saveOutcome';

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
  const started = ((onHand) => beginSave(onHand, () => onHand))(editField(session(), 'replace', 'c'));
  if (started === null) {
    throw new Error('an edited draft is saveable');
  }
  return applySave(started.session, REFUSAL, NOT_OWED, () => started.session);
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
      'triggerNotSingle',
      'lineBreak'
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

  it('keeps a quoted option Unchanged through typing and undoing back to it (4-1)', () => {
    // Phase 4-1: an option is written as plain source only on an explicit `Set`,
    // so an untouched `word: 'true'` must never become one. The baseline is the
    // decoded text, and `fieldIntent` compares the final buffer with it — visiting
    // or retyping the value is not an intent.
    const quoted = withScalar('word', styledScalar('true', 'SingleQuoted', false));
    const typed = editField(session(quoted), 'word', 'truex');
    expect(matchDraftOf(typed.baseline, typed.draft.value).word).toEqual({ Set: 'truex' });
    const undone = undoEdit(typed);
    expect(matchDraftOf(undone.baseline, undone.draft.value).word).toBe('Unchanged');
    const retyped = editField(typed, 'word', 'true');
    expect(matchDraftOf(retyped.baseline, retyped.draft.value).word).toBe('Unchanged');
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
    const started = ((onHand) => beginSave(onHand, () => onHand))(editField(session(), 'replace', 'c'));
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
    expect(((onHand) => beginSave(onHand, () => onHand))(session())).toBeNull();
    const edited = editField(session(), 'replace', 'c');
    expect(canSave(edited)).toBe(true);
    expect(beginSave(edited, () => edited)).not.toBeNull();
  });

  it('sends the draft derived from the candidate it recorded', () => {
    const started = ((onHand) => beginSave(onHand, () => onHand))(editField(session(), 'replace', 'c'));
    expect(started?.draft.replace).toEqual({ Set: 'c' });
    expect(started?.draft.label).toBe('Unchanged');
    expect(started?.submission.candidate.replace).toEqual({ text: 'c', removed: false });
    expect(started?.submission.baseRevision).toBe(BASE);
    expect(started?.session.phase).toBe('saving');
  });

  it('adopts the identity a commit answers with', () => {
    const started = ((onHand) => beginSave(onHand, () => onHand))(editField(session(), 'replace', 'c'))!;
    const done = applySave(started.session, saved(), ADOPTED, () => started.session);
    expect(done.match).toEqual(MOVED);
    expect(done.identityStale).toBe(false);
    expect(baseRevisionOf(done)).toBe(AFTER);
    expect(isDirty(done.draft)).toBe(false);
    expect(matchEditorView(done).needsReprojection).toBe(true);
  });

  it('stops offering to save when a commit answered no identity', () => {
    const started = ((onHand) => beginSave(onHand, () => onHand))(editField(session(), 'replace', 'c'))!;
    const done = applySave(started.session, saved(true, null), ADOPTED, () => started.session);
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
    const started = ((onHand) => beginSave(onHand, () => onHand))(editField(session(), 'label', 'a name'))!;
    const done = applySave(started.session, saved(), ADOPTED, () => started.session);
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
    const started = ((onHand) => beginSave(onHand, () => onHand))(editField(session(), 'replace', 'c'))!;
    const done = applySave(started.session, saved(), ADOPTED, () => started.session);
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
    const started = ((onHand) => beginSave(onHand, () => onHand))(removeField(session(), 'replace'))!;
    expect(started.draft.replace).toBe('Remove');
    const done = applySave(started.session, saved(), ADOPTED, () => started.session);
    expect(done.baseline.replace).toMatchObject({ present: false, value: '' });
    // The buffer still says "removed", and the file no longer has the key, so the
    // draft claims nothing and is not dirty.
    expect(fieldIntent(done.baseline.replace, done.draft.value.replace)).toBe('Unchanged');
    expect(isDirty(done.draft)).toBe(false);
  });

  it('treats a `committed: false` as the success it is', () => {
    const started = ((onHand) => beginSave(onHand, () => onHand))(editField(session(), 'replace', 'c'))!;
    const done = applySave(started.session, saved(false, null), NOT_OWED, () => started.session);
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
    const again = beginSave(consented, () => consented);
    expect(again?.submission.acknowledgement).toEqual({ accepted: [SUSPICION] });

    // One more keystroke and the findings are about something nobody is looking
    // at: the consent goes, and the offer goes with it.
    const moved = editField(consented, 'replace', 'cc');
    expect(outcomeIsStale(moved)).toBe(true);
    expect(matchEditorView(moved).refusalChoices).toEqual(['keepEditing']);
    expect(matchEditorView(moved).findingsAreStale).toBe(true);
    expect(beginSave(moved, () => moved)?.submission.acknowledgement).toEqual({ accepted: [] });
  }); // End of the "records consent" case

  it('records no consent when there is no refusal on screen', () => {
    const editor = editField(session(), 'replace', 'c');
    expect(acknowledgeFindings(editor)).toBe(editor);
  });

  it('reports a send that never left as neither an outcome nor a written file', () => {
    const started = ((onHand) => beginSave(onHand, () => onHand))(editField(session(), 'replace', 'c'))!;
    const notSent = saveCouldNotBeSent(started.session, false, null, () => started.session);
    expect(notSent.sendFailure).toEqual({ kind: 'notSent', reason: null });
    expect(notSent.outcome).toBeNull();
    expect(notSent.draft.value.replace.text).toBe('c');
    expect(saveCouldNotBeSent(started.session, true, null, () => started.session).sendFailure).toEqual({
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
    const started = ((onHand) => beginSave(onHand, () => onHand))(editField(session(), 'replace', 'c'))!;
    const unmodelled: DraftError = {
      FieldHasAnUnmodelledShape: { field: 'label', found: 'Sequence' }
    };
    const refusedDraft: IpcFailure = {
      kind: 'command',
      error: { code: 'draftRefused', error: unmodelled }
    };
    const answered = saveCouldNotBeSent(started.session, false, refusedDraft, () => started.session);
    expect(matchEditorView(answered).failureLines).toEqual([
      { kind: 'failure', failure: refusedDraft },
      { kind: 'draft', error: unmodelled }
    ]);
  }); // End of the "refused draft" case

  it('unfolds a save that failed on its patch down to the edit that failed', () => {
    // The other chain, and the deepest one a field save can produce: a
    // `saveFailed` carrying a `SaveError` whose `Patch` arm carries an
    // `EditError`. Thirty-six more sentences that had never been drawn.
    const started = ((onHand) => beginSave(onHand, () => onHand))(editField(session(), 'replace', 'c'))!;
    const patch: EditError = { EmptyTarget: { edit: 0, node: 7, at: { start: 12, end: 12 } } };
    const failedSave: IpcFailure = {
      kind: 'command',
      error: {
        code: 'saveFailed',
        error: { Patch: patch },
        may_have_written: false
      }
    };
    const answered = saveCouldNotBeSent(started.session, false, failedSave, () => started.session);
    expect(matchEditorView(answered).failureLines).toEqual([
      { kind: 'failure', failure: failedSave },
      { kind: 'save', error: { Patch: patch } },
      { kind: 'edit', error: patch }
    ]);
  }); // End of the "failed patch" case

  it('says only what it has to say about a rejection that carries no chain', () => {
    const started = ((onHand) => beginSave(onHand, () => onHand))(editField(session(), 'replace', 'c'))!;
    const stale: IpcFailure = {
      kind: 'command',
      error: { code: 'identityStaleRevision', expected: AFTER, found: BASE }
    };
    expect(matchEditorView(saveCouldNotBeSent(started.session, false, stale, () => started.session)).failureLines).toEqual(
      [{ kind: 'failure', failure: stale }]
    );
    const unexpected: IpcFailure = { kind: 'unexpected' };
    expect(
      matchEditorView(saveCouldNotBeSent(started.session, true, unexpected, () => started.session)).failureLines
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
    expect(applySave(editor, saved(), ADOPTED, () => editor)).toBe(editor);
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
    expect(beginSave(driven, () => driven)).toBeNull();
  }); // End of the "last gate" case

  it('still saves a snippet that merely holds a carriage return it is not writing', () => {
    // The other side of the same gate: a field refused for `carriageReturn` has
    // that character in its baseline and therefore in its buffer, legitimately. Its
    // intent is `'Unchanged'`, so the gate — which looks at what would be written —
    // must not refuse the whole save because of it.
    const editor = editField(session(withScalar('replace', scalar('a\rb'))), 'label', 'renamed');
    const started = beginSave(editor, () => editor);
    expect(started?.draft.label).toEqual({ Set: 'renamed' });
    expect(started?.draft.replace).toBe('Unchanged');
  });

  it('says the file was written and this window is out of step when adoption failed', () => {
    // **The 2c-2 review's second finding, at this end.** A committed save whose
    // re-read failed is still a committed save: the line is added *beside* the
    // saved arm and never in place of it (`PROGRESS.md` D2). The session stops
    // offering to save, because there is no projection left to resolve an identity
    // against.
    const started = ((onHand) => beginSave(onHand, () => onHand))(editField(session(), 'replace', 'c'))!;
    const done = applySave(started.session, saved(), NOT_ADOPTED, () => started.session);
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
    const started = ((onHand) => beginSave(onHand, () => onHand))(editField(session(), 'replace', 'c'));
    if (started === null) {
      throw new Error('an edited draft is saveable');
    }
    const conflict: SaveResult = {
      outcome: 'conflict',
      reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
      expected: BASE,
      found: AFTER,
      disk_revision: AFTER,
      disk_text: 'matches:\n  - trigger: x\n    replace: theirs\n',
      disk: makeDocument({ revision: AFTER })
    };
    return applySave(started.session, conflict, NOT_OWED, () => started.session);
  } // End of function conflicted()

  it('keeps the draft and stops accepting changes', () => {
    const stuck = conflicted();
    expect(conflictOf(stuck)).not.toBeNull();
    expect(conflictOf(stuck)?.draft.value.replace.text).toBe('c');
    expect(isEditable(stuck)).toBe(false);
    expect(editField(stuck, 'replace', 'd')).toBe(stuck);
  });

  it('offers four ways out, and only the reapply is called "keep my draft"', () => {
    // **2c-4a-3a offered what 2c-4a-2 built, and 2c-4b-3 did it again**: all three
    // capability booleans are `true` for this surface, so the non-destructive way
    // out comes first, the copy that makes the destruction survivable comes next,
    // the reapply comes above the destructive one, and the destructive one is two
    // clicks away — the ordering `conflictChoicesFor` owns, not this module's.
    const choices = matchEditorView(conflicted()).conflictChoices;
    expect(choices).toEqual<readonly ConflictChoice[]>([
      'keepEditing',
      'copyDraft',
      'keepMyDraft',
      'reloadDiskVersion'
    ]);
    // The phrase is reserved for the one control that reapplies, and every other
    // label must still not use it — the reason it was reserved has not changed.
    for (const locale of LOCALES) {
      for (const choice of choices) {
        if (choice === 'keepMyDraft') {
          continue;
        }
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
    // All seventeen fields in `EDITABLE_FIELDS` order (six until Phase 3-5-1),
    // each with the label the detail pane uses, the buffer's exact text, and what
    // a save would actually say about it — never a presence flag. An untouched
    // field is `unchanged`, so an initially absent field left blank cannot be
    // described as "this text would be written", which is the rule the whole
    // draft-versus-projection arrangement exists for.
    const view = matchEditorView(conflicted());
    expect(view.retainedDraft.map((field) => field.label)).toEqual([
      'trigger',
      'replace',
      'markdown',
      'html',
      'imagePath',
      'form',
      'label',
      'comment',
      'word',
      'leftWord',
      'rightWord',
      'propagateCase',
      'uppercaseStyle',
      'forceMode',
      'forceClipboard',
      'paragraph',
      'anchor'
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
    const started = ((onHand) => beginSave(onHand, () => onHand))(removeField(session(projection({ label: 'Signature' })), 'label'));
    if (started === null) {
      throw new Error('a drafted removal is saveable');
    }
    const stuck = applySave(
      started.session,
      {
        outcome: 'conflict',
        reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
        expected: BASE,
        found: AFTER,
        disk_revision: AFTER,
        disk_text: 'matches:\n  - trigger: x\n',
        disk: makeDocument({ revision: AFTER })
      },
      NOT_OWED, () => started.session
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
  it('describes all seventeen fields, in order, with their labels and their verdicts', () => {
    const view = matchEditorView(session(unmodelledLabel()));
    expect(view.fields.map((field) => field.field)).toEqual<readonly EditableField[]>([
      'trigger',
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
    ]);
    expect(view.fields.map((field) => field.label)).toEqual([
      'trigger',
      'replace',
      'markdown',
      'html',
      'imagePath',
      'form',
      'label',
      'comment',
      'word',
      'leftWord',
      'rightWord',
      'propagateCase',
      'uppercaseStyle',
      'forceMode',
      'forceClipboard',
      'paragraph',
      'anchor'
    ]);
    const label = view.fields.find((field) => field.field === 'label');
    expect(label?.editable).toBe(false);
    expect(label?.refusal).toBe('unmodelledShape');
    expect(label?.intent).toBe('Unchanged');
  }); // End of the "describes all seventeen fields" case

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
    const started = ((onHand) => beginSave(onHand, () => onHand))(editField(session(), 'replace', 'c'));
    if (started === null) {
      throw new Error('an edited draft is saveable');
    }
    const answer: SaveResult = {
      outcome: 'conflict',
      reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
      expected: BASE,
      found: AFTER,
      disk_revision: AFTER,
      disk_text: 'matches:\n  - trigger: x\n    replace: theirs\n',
      disk: makeDocument({ revision: AFTER })
    };
    return applySave(started.session, answer, NOT_OWED, () => started.session);
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
    expect(reloadTheDiskVersion(stuck, recorder.adopt, () => stuck)).toBe(stuck);
    const asked = askToReloadDiskVersion(stuck);
    expect(matchEditorView(asked).awaitingReloadConfirmation).toBe(true);
    // The warning alone is not a confirmation either.
    expect(reloadTheDiskVersion(asked, recorder.adopt, () => asked)).toBe(asked);
    expect(recorder.adoptions).toEqual([]);
    expect(matchEditorView(asked).closed).toBe(false);
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
    expect(matchEditorView(after).reloadUnavailable).toBe(true);
    expect(matchEditorView(after).awaitingReloadConfirmation).toBe(false);
    expect(matchEditorView(after).conflictChoices).not.toContain('confirmReload');
    expect(matchEditorView(after).conflictChoices).not.toContain('reloadDiskVersion');
    expect(matchEditorView(after).conflictChoices).toContain('keepEditing');
    // Asking again cannot spend anything a second time.
    expect(reloadTheDiskVersion(after, refusing.adopt, () => after)).toBe(after);
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
      'keepMyDraft',
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
    expect(reloadTheDiskVersion(dismissed, recorder.adopt, () => dismissed)).toBe(dismissed);
    expect(recorder.adoptions).toEqual([]);
  }); // End of the "dismissal forgets the confirmation" case
}); // End of the "confirmed reload" suite

describe('reapplying the retained draft', () => {
  // **2c-4b-2 builds this and 2c-4b-3 draws it**, which is the same trade
  // 2c-4a-2 made for the reload: an unoffered transition can be built and driven
  // without a screen, and `ConflictChoice` has no member for a reapply yet — so
  // nothing here is reachable from a control, and every case calls the transition
  // directly.

  /**
   * A conflicted save of an edited draft, over a chosen disk snapshot.
   *
   * @param edit - What the person did before saving.
   * @param subject - What the correspondence search answered about the snippet.
   * @param diskMatches - What the newly parsed projection holds.
   * @param base - The snippet the session was seeded from.
   * @returns The session showing the conflict.
   */
  function conflictedOver(
    edit: (start: MatchEditorSession) => MatchEditorSession,
    subject: ReapplyResolution,
    diskMatches: readonly MatchView[],
    base: MatchView = projection()
  ): MatchEditorSession {
    const started = ((onHand) => beginSave(onHand, () => onHand))(edit(session(base)));
    if (started === null) {
      throw new Error('this case needs a saveable draft');
    }
    const disk = makeDocument({ revision: AFTER, matches: diskMatches });
    return applySave(
      started.session,
      makeConflict({ disk, subject, expected: BASE, found: AFTER }),
      NOT_OWED, () => started.session
    );
  } // End of function conflictedOver()

  /**
   * The disk-side twin of {@link projection}, at the revision a conflict reports.
   *
   * @param overrides - Whatever the case needs beyond the trigger and the body.
   * @returns The projection the disk snapshot holds.
   */
  function diskMatch(overrides: Parameters<typeof makeMatch>[0] = {}): MatchView {
    return makeMatch({ revision: AFTER, trigger: ':a', replace: 'b', ...overrides });
  } // End of function diskMatch()

  /**
   * One field's baseline, taken from a whole projection.
   *
   * Through `baselineOf` rather than by writing a `FieldBaseline` literal, so the
   * eligibility a row is about is the one `fieldEligibility` really computes.
   *
   * @param match - The projection.
   * @param field - Which field.
   * @returns That field's baseline.
   */
  function baselineFor(match: MatchView, field: EditableField) {
    return baselineOf(match)[field];
  } // End of function baselineFor()

  describe('the field table', () => {
    it('row 1 — an unchanged intent preserves whatever the disk now holds', () => {
      const was = baselineFor(projection({ label: 'mine' }), 'label');
      const now = baselineFor(diskMatch({ label: 'theirs' }), 'label');
      expect(fieldReapply(was, { text: 'mine', removed: false }, now)).toEqual({
        kind: 'unchanged'
      });
    });

    it('row 1 — an absent field left blank is unchanged, never Set("")', () => {
      // **The presence-vs-blank rule, which is what the whole draft-versus-
      // projection arrangement exists for.** The buffer alone cannot tell an absent
      // field left blank from a present field cleared to empty, and getting it
      // wrong here would write `label: ''` into a file that never had a label — and
      // would then have to decide whether the disk's new label collided with it.
      const was = baselineFor(projection(), 'label');
      const now = baselineFor(diskMatch({ label: 'theirs' }), 'label');
      expect(was.present).toBe(false);
      expect(fieldReapply(was, { text: '', removed: false }, now)).toEqual({ kind: 'unchanged' });
    });

    it('row 2 — a Set survives a disk field in exactly the old state', () => {
      const was = baselineFor(projection({ label: 'old' }), 'label');
      const now = baselineFor(diskMatch({ label: 'old' }), 'label');
      expect(fieldReapply(was, { text: 'new', removed: false }, now)).toEqual({
        kind: 'applicable',
        intent: { Set: 'new' }
      });
    });

    it('row 3 — a Set the disk already made is satisfied, not applicable', () => {
      // Nothing is written for it, and it is **not** the same answer as row 1: the
      // person did ask for this, and the file happens to say it already.
      const was = baselineFor(projection({ label: 'old' }), 'label');
      const now = baselineFor(diskMatch({ label: 'new' }), 'label');
      expect(fieldReapply(was, { text: 'new', removed: false }, now)).toEqual({
        kind: 'satisfied'
      });
    });

    it('row 4 — a Remove survives a disk field in exactly the old state', () => {
      const was = baselineFor(projection({ label: 'old' }), 'label');
      const now = baselineFor(diskMatch({ label: 'old' }), 'label');
      expect(fieldReapply(was, { text: 'old', removed: true }, now)).toEqual({
        kind: 'applicable',
        intent: 'Remove'
      });
    });

    it('row 5 — a Remove the disk already made is satisfied', () => {
      const was = baselineFor(projection({ label: 'old' }), 'label');
      const now = baselineFor(diskMatch(), 'label');
      expect(now.present).toBe(false);
      expect(fieldReapply(was, { text: 'old', removed: true }, now)).toEqual({ kind: 'satisfied' });
    });

    it('row 5 — a key the disk now writes as something unmodelled is not "already removed"', () => {
      // **`present` is `false` for an unmodelled key too**, because the projection
      // carries no scalar for it — so *absent* alone would call a `label:` that has
      // become a mapping "already removed", write nothing, and leave the key in the
      // file. The editable test is what excludes it.
      const now = baselineFor(
        diskMatch({
          unknownEntries: [unknownEntry('label', { UnexpectedShape: { found: 'Mapping' } })]
        }),
        'label'
      );
      expect(now.present).toBe(false);
      expect(now.eligibility).toEqual({ kind: 'readOnly', reason: 'unmodelledShape' });
      const was = baselineFor(projection({ label: 'old' }), 'label');
      expect(fieldReapply(was, { text: 'old', removed: true }, now)).toEqual({ kind: 'collision' });
    });

    it('row 6 — a Set over a field the disk moved to a third value collides', () => {
      const was = baselineFor(projection({ label: 'old' }), 'label');
      const now = baselineFor(diskMatch({ label: 'theirs' }), 'label');
      expect(fieldReapply(was, { text: 'mine', removed: false }, now)).toEqual({
        kind: 'collision'
      });
    });

    it('row 6 — a Set over a field that is newly ineligible collides', () => {
      // Eligibility is load-bearing: a fresh projection can make a formerly
      // editable scalar undecodable, zero-width, the wrong shape or
      // carriage-return-bearing, and writing into it would be writing into
      // something this application has just said it cannot read.
      const was = baselineFor(projection({ label: 'old' }), 'label');
      const now = baselineFor(
        makeMatch({ revision: AFTER, trigger: ':a', replace: 'b', label: 'old\rx' }),
        'label'
      );
      expect(now.eligibility).toEqual({ kind: 'readOnly', reason: 'carriageReturn' });
      expect(fieldReapply(was, { text: 'mine', removed: false }, now)).toEqual({
        kind: 'collision'
      });
    });

    it('row 6 — a Set whose value the disk matches, in a field it made read-only, collides', () => {
      // The satisfied rows ask for editability as well as for the value: a field
      // the new parse will not let anybody edit is not a field whose drafted change
      // has been made, it is a field this session can no longer reason about.
      const was = baselineFor(projection({ label: 'old' }), 'label');
      const undecodable = makeMatch({ revision: AFTER, trigger: ':a', replace: 'b' });
      const now = baselineFor(
        { ...undecodable, label: undecoded('new') },
        'label'
      );
      expect(now.eligibility).toEqual({ kind: 'readOnly', reason: 'notDecodable' });
      expect(now.value).toBe('new');
      expect(fieldReapply(was, { text: 'new', removed: false }, now)).toEqual({
        kind: 'collision'
      });
    });
  }); // End of the field table suite

  describe('the plan over all six fields', () => {
    it('rebuilds buffers that derive exactly the intents it decided', () => {
      // The round trip that makes the rebuilt session honest: `fieldIntent` over
      // the **new** baseline must answer what the plan said it would, or the
      // session would send something other than what was decided.
      const was = baselineOf(projection({ label: 'old', options: { word: 'on' } }));
      const now = baselineOf(diskMatch({ label: 'old', options: { word: 'on' } }));
      const buffers: MatchBuffers = {
        ...buffersOf(was),
        replace: { text: 'mine', removed: false },
        label: { text: 'old', removed: true }
      };
      const plan = planMatchReapply(was, buffers, now);
      expect(plan.collisions).toEqual([]);
      expect(plan.writesAnything).toBe(true);
      for (const field of ['trigger', 'replace', 'label', 'word'] as const) {
        expect(fieldIntent(now[field], plan.buffers[field]), field).toEqual(
          plan.verdicts[field].kind === 'applicable'
            ? (plan.verdicts[field] as { readonly intent: unknown }).intent
            : 'Unchanged'
        );
      } // End of the loop over the fields this case drafted or left alone
    });

    it('names every collided field and blocks the whole reapply', () => {
      // **Any collision blocks all of it** (consult Q4): *Keep my draft* claims one
      // retained intention, and saving the safe fields only would strand the rest
      // while looking successful.
      const was = baselineOf(projection({ label: 'old' }));
      const now = baselineOf(diskMatch({ trigger: ':theirs', label: 'theirs' }));
      const buffers: MatchBuffers = {
        ...buffersOf(was),
        trigger: { text: ':mine', removed: false },
        replace: { text: 'mine', removed: false },
        label: { text: 'mine', removed: false }
      };
      const plan = planMatchReapply(was, buffers, now);
      expect(plan.collisions).toEqual(['trigger', 'label']);
      expect(plan.verdicts.replace).toEqual({ kind: 'applicable', intent: { Set: 'mine' } });
    });

    it('writes nothing when every drafted change was already satisfied', () => {
      const was = baselineOf(projection({ label: 'old' }));
      const now = baselineOf(diskMatch({ label: 'mine' }));
      const buffers: MatchBuffers = {
        ...buffersOf(was),
        label: { text: 'mine', removed: false }
      };
      const plan = planMatchReapply(was, buffers, now);
      expect(plan.collisions).toEqual([]);
      expect(plan.writesAnything).toBe(false);
      expect(plan.verdicts.label).toEqual({ kind: 'satisfied' });
    });
  }); // End of the plan suite

  describe('the transition', () => {
    /**
     * A recorder for the window's own adoption.
     *
     * @param answer - What the window answers.
     * @returns The callback to pass, and the conflicts it was handed.
     */
    function adoptingReapply(answer: DiskAdoptionOutcome = 'installed'): {
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
    } // End of function adoptingReapply()

    it('rebuilds the draft over the identified snippet and draws a new boundary', () => {
      const target = diskMatch({ node: 9 });
      const stuck = conflictedOver(
        (start) => editField(start, 'replace', 'mine'),
        { Identified: { target } },
        [target]
      );
      const recorder = adoptingReapply();
      const answer = reapplyToDiskVersion(stuck, recorder.adopt, null, () => stuck);
      expect(answer.kind).toBe('reapplied');
      if (answer.kind !== 'reapplied') {
        throw new Error('this case is about the rebuilt session');
      }
      // The identity and the base revision are the disk snapshot's, so the save
      // that follows is measured against the bytes that refused the last one.
      expect(answer.session.match).toEqual(target.id);
      expect(baseRevisionOf(answer.session)).toBe(AFTER);
      // The drafted value survived, and the disk field it did not touch survived
      // with it.
      expect(answer.session.draft.value.replace.text).toBe('mine');
      expect(canSave(answer.session)).toBe(true);
      expect(matchDraftOf(answer.session.baseline, answer.session.draft.value)).toMatchObject({
        replace: { Set: 'mine' },
        trigger: 'Unchanged',
        label: 'Unchanged'
      });
      // A new history boundary: one step back to the version on disk, and nothing
      // of the old session's history or consent.
      expect(answer.session.draft.past).toHaveLength(1);
      expect(answer.session.draft.future).toEqual([]);
      expect(answer.session.draft.consent).toBeNull();
      expect(answer.session.outcome).toBeNull();
      expect(recorder.adoptions).toEqual([conflictOf(stuck)]);
    });

    it('keeps a field the other writer changed, when the draft did not touch it', () => {
      const target = diskMatch({ node: 9, label: 'theirs' });
      const stuck = conflictedOver(
        (start) => editField(start, 'replace', 'mine'),
        { Identified: { target } },
        [target]
      );
      const answer = reapplyToDiskVersion(stuck, adoptingReapply().adopt, null, () => stuck);
      if (answer.kind !== 'reapplied') {
        throw new Error('this case is about the rebuilt session');
      }
      // The external label is in the baseline and goes out `'Unchanged'`, so the
      // save preserves the other writer's bytes exactly.
      expect(answer.session.baseline.label.value).toBe('theirs');
      expect(matchDraftOf(answer.session.baseline, answer.session.draft.value).label).toBe(
        'Unchanged'
      );
    });

    it('reports alreadySatisfied and leaves nothing to send', () => {
      const target = diskMatch({ node: 9, replace: 'mine' });
      const stuck = conflictedOver(
        (start) => editField(start, 'replace', 'mine'),
        { Identified: { target } },
        [target]
      );
      const recorder = adoptingReapply();
      const answer = reapplyToDiskVersion(stuck, recorder.adopt, null, () => stuck);
      expect(answer.kind).toBe('alreadySatisfied');
      if (answer.kind !== 'alreadySatisfied') {
        throw new Error('this case is about the satisfied arm');
      }
      // **The disk was still adopted**: the window must move to the file that
      // already holds the change, or it would go on describing bytes that are gone.
      expect(recorder.adoptions).toHaveLength(1);
      expect(canSave(answer.session)).toBe(false);
      expect(isDirty(answer.session.draft)).toBe(false);
      expect(answer.session.draft.value.replace.text).toBe('mine');
    });

    it('refuses a field collision, names the fields, and adopts nothing', () => {
      const target = diskMatch({ node: 9, replace: 'theirs' });
      const stuck = conflictedOver(
        (start) => editField(start, 'replace', 'mine'),
        { Identified: { target } },
        [target]
      );
      const recorder = adoptingReapply();
      const answer = reapplyToDiskVersion(stuck, recorder.adopt, null, () => stuck);
      expect(answer).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'fieldCollisions', fields: ['replace'] }
      });
      // **Decide first, adopt second.** A refusal leaves the window exactly where
      // it was — no projection replaced, no selection repaired, no token spent.
      expect(recorder.adoptions).toEqual([]);
    });

    it('refuses a correspondence the core would not establish, and adopts nothing', () => {
      const stuck = conflictedOver(
        (start) => editField(start, 'replace', 'mine'),
        { Refused: { reason: 'AmbiguousTrigger' } },
        [diskMatch({ node: 9 })]
      );
      const recorder = adoptingReapply();
      expect(reapplyToDiskVersion(stuck, recorder.adopt, null, () => stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'correspondence', reason: 'AmbiguousTrigger' }
      });
      expect(recorder.adoptions).toEqual([]);
    });

    it('refuses evidence that names no snippet, and adopts nothing', () => {
      for (const subject of [{ Unsupported: {} }, { Targetless: {} }] as const) {
        const stuck = conflictedOver(
          (start) => editField(start, 'replace', 'mine'),
          subject,
          [diskMatch({ node: 9 })]
        );
        const recorder = adoptingReapply();
        expect(reapplyToDiskVersion(stuck, recorder.adopt, null, () => stuck)).toEqual({
          kind: 'manualResolution',
          obstacle: { kind: 'evidenceNotATarget' }
        });
        expect(recorder.adoptions).toEqual([]);
      } // End of the loop over the two empty subject arms
    });

    it('refuses a snippet the new parse will not let anybody edit, and adopts nothing', () => {
      const target = diskMatch({ node: 9, blockingHazard: 'MergeKey', safelyEditable: false });
      const stuck = conflictedOver(
        (start) => editField(start, 'replace', 'mine'),
        { Identified: { target } },
        [target]
      );
      const recorder = adoptingReapply();
      expect(reapplyToDiskVersion(stuck, recorder.adopt, null, () => stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'targetNotEditable' }
      });
      expect(recorder.adoptions).toEqual([]);
    });

    it('reports the window refusal and rebuilds nothing', () => {
      const target = diskMatch({ node: 9 });
      const stuck = conflictedOver(
        (start) => editField(start, 'replace', 'mine'),
        { Identified: { target } },
        [target]
      );
      const recorder = adoptingReapply('refused');
      expect(reapplyToDiskVersion(stuck, recorder.adopt, null, () => stuck)).toEqual({ kind: 'adoptionRefused' });
      expect(recorder.adoptions).toHaveLength(1);
    });

    it('treats a window that already holds the disk version as a success', () => {
      const target = diskMatch({ node: 9 });
      const stuck = conflictedOver(
        (start) => editField(start, 'replace', 'mine'),
        { Identified: { target } },
        [target]
      );
      expect(reapplyToDiskVersion(stuck, adoptingReapply('alreadyThere').adopt, null, () => stuck).kind).toBe(
        'reapplied'
      );
    });

    it('is not attempted when no conflict is showing', () => {
      const recorder = adoptingReapply();
      expect(((onHand) => reapplyToDiskVersion(onHand, recorder.adopt, null, () => onHand))(session())).toEqual({ kind: 'notAttempted' });
      expect(recorder.adoptions).toEqual([]);
    });

    it('meets another conflict as an ordinary one, with no retry loop', () => {
      // **A reapply is one new attempt** (consult Q5). The rebuilt session goes
      // through the ordinary submit path, and a file that moved a third time
      // produces an ordinary conflict panel — not a second automatic rebase.
      const target = diskMatch({ node: 9 });
      const stuck = conflictedOver(
        (start) => editField(start, 'replace', 'mine'),
        { Identified: { target } },
        [target]
      );
      const answer = reapplyToDiskVersion(stuck, adoptingReapply().adopt, null, () => stuck);
      if (answer.kind !== 'reapplied') {
        throw new Error('this case starts from a rebuilt session');
      }
      const started = beginSave(answer.session, () => answer.session);
      if (started === null) {
        throw new Error('the rebuilt session is saveable');
      }
      // The base revision it sends is the adopted one, not the session's original.
      expect(started.submission.baseRevision).toBe(AFTER);
      const third = makeDocument({ revision: 'c'.repeat(64), matches: [diskMatch({ node: 11 })] });
      const again = applySave(
        started.session,
        makeConflict({ disk: third, expected: AFTER, found: 'c'.repeat(64) }),
        NOT_OWED, () => started.session
      );
      expect(again.outcome?.kind).toBe('conflict');
      expect(conflictOf(again)?.diskRevision).toBe('c'.repeat(64));
      // The retained draft is the one the reapply rebuilt, kept again.
      expect(conflictOf(again)?.draft.value.replace.text).toBe('mine');
    });
  }); // End of the transition suite
}); // End of the reapply suite

describe('the external session — Phase 2d-6-2', () => {
  // **The receiver as a value, driven without a window.** Every envelope here is
  // sealed by the three constructors of `./observationDelivery.ts`, so the verdict
  // inside is about the observation inside by construction; a `BrowserState` is
  // what seals them in production, and `workspace.test.ts` drives this same
  // transition through a real one. Nothing here can show a component registers
  // the receiver — 2d-6-6 wires it — and nothing here calls a command: no
  // `BrowserState` exists in this file.

  /** The disk text every observation below reads. */
  const THEIRS = 'matches:\n  - trigger: x\n    replace: theirs\n';

  /**
   * One narrowed observation of the file the fixtures' snippet lives in.
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
      document: 1,
      previousRevision: BASE,
      diskRevision: AFTER,
      diskText: THEIRS,
      disk: makeDocument({ revision: AFTER }),
      findings: [],
      correspondences: null,
      ...overrides
    };
  } // End of function observation()

  /**
   * An arbitrated envelope, asserted to have reached the arm the case is about.
   *
   * The arbitration is `arbitrateObservation`'s and not this file's; asserting the
   * arm keeps a fixture that reached another one from passing a case for the wrong
   * reason.
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
   * A session over an edited draft, saveable.
   *
   * @returns The session, with `replace` drafted to `c`.
   */
  function edited(): MatchEditorSession {
    return editField(session(), 'replace', 'c');
  } // End of function edited()

  /**
   * A conflicted save of an edited draft — the save origin.
   *
   * @returns The session showing the save conflict.
   */
  function saveConflicted(): MatchEditorSession {
    const started = ((onHand) => beginSave(onHand, () => onHand))(edited());
    if (started === null) {
      throw new Error('an edited draft is saveable');
    }
    return applySave(
      started.session,
      makeConflict({ disk: makeDocument({ revision: AFTER }), expected: BASE, found: AFTER, diskText: THEIRS }),
      NOT_OWED, () => started.session
    );
  } // End of function saveConflicted()

  /**
   * A recorder for the window's own adoption.
   *
   * @param answer - What the window answers.
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

  /**
   * The external conflict a session shows, or a failure naming the case.
   *
   * @param held - The session.
   * @returns Its external conflict.
   */
  function externalOf(held: MatchEditorSession): ExternalConflictModel<MatchBuffers> {
    const conflict = held.externalConflict;
    if (conflict === null) {
      throw new Error('this case needs an external conflict on the session');
    }
    return conflict;
  } // End of function externalOf()

  describe('raising a conflict over a draft (entries 6 and 11)', () => {
    it('raises over a pristine draft, blocks edits and the save, and retires nothing', () => {
      const seen = observation();
      const next = applyObservation(session(), raised(seen));
      const conflict = externalOf(next);
      // The model is the one `describeExternalConflict` builds over this session's
      // own draft, with the memoized origin — so an adoption can be matched against
      // the object the window registered.
      expect(conflict.source).toBe(externalConflictSource(seen));
      expect(conflict.draft).toBe(next.draft);
      expect(conflict.diskText).toBe(THEIRS);
      expect(conflict.messages[0]).toEqual({ kind: 'fileChangedWhileOpen' });
      expect(isExternalConflict(conflict)).toBe(true);
      // `outcome` is untouched: no save ended, and a save outcome's conflict arm is
      // not where an external conflict lives (entry 6).
      expect(next.outcome).toBeNull();
      expect(conflictOf(next)).toBe(conflict);
      expect(isEditable(next)).toBe(false);
      expect(canSave(next)).toBe(false);
      expect(editField(next, 'replace', 'd')).toBe(next);
      expect(isDirty(next.draft)).toBe(false);
      const view = matchEditorView(next);
      expect(view.conflict).toBe(conflict);
      expect(view.externalMessages).toBe(conflict.messages);
      expect(view.messages).toEqual([]);
      expect(view.externalNotices).toEqual([]);
      expect(view.conflictChoices).toEqual<readonly ConflictChoice[]>([
        'keepEditing',
        'copyDraft',
        'keepMyDraft',
        'reloadDiskVersion'
      ]);
    }); // End of the "pristine draft" case

    it('raises over an edited draft, keeping the draft, its history and its intent', () => {
      const before = edited();
      const next = applyObservation(before, raised(observation()));
      expect(externalOf(next).draft).toBe(before.draft);
      expect(next.draft.value.replace.text).toBe('c');
      expect(fieldIntent(next.baseline.replace, next.draft.value.replace)).toEqual({ Set: 'c' });
      expect(matchDraftOf(next.baseline, next.draft.value).replace).toEqual({ Set: 'c' });
      expect(matchEditorView(next).canUndo).toBe(true);
      const retained = matchEditorView(next).retainedDraft.find((one) => one.label === 'replace');
      expect(retained).toEqual({ label: 'replace', text: 'c', status: 'setting' });
      expect(canSave(next)).toBe(false);
    });

    it('answers null from beginSave called directly under an external conflict (entry 8)', () => {
      // **Past a disabled button.** The draft is dirty and would otherwise be sent;
      // the model refuses at the same function the view asks, so a *Save anyway*
      // reaching `beginSave` sends nothing.
      const next = applyObservation(edited(), raised(observation()));
      expect(isDirty(next.draft)).toBe(true);
      expect(beginSave(next, () => next)).toBeNull();
      // And the refusal path: consent recorded on a refusal cannot be spent either,
      // and the view withholds the offer that would reach this.
      const blockedRefusal = applyObservation(refused(), raised(observation()));
      expect(blockedRefusal.outcome?.kind).toBe('refused');
      expect(((onHand) => beginSave(onHand, () => onHand))(acknowledgeFindings(blockedRefusal))).toBeNull();
      const view = matchEditorView(blockedRefusal);
      expect(view.refusalChoices).toEqual(['keepEditing']);
      expect(view.findingsAreStale).toBe(false);
    }); // End of the "beginSave under an external conflict" case

    // **Phase 4-2, B1's model layer.** The mounted suite in
    // `../components/DetailPane.test.ts` ("B1: …") shows the envelope delivered and
    // the panel not drawn; this pins that the session between them is right: a
    // list-item addition is raised over like any other draft, retained whole, and
    // its retained rows repeat the list's label once per item — which is the
    // model's settled shape (`triggerLists.test.ts`, "lists the drafted items with
    // their status"), so a renderer must not key those rows by label.
    it.each([
      ['triggers', projection({ trigger: null, triggers: [':a', ':b'], triggerKind: 'Multiple' }), ':added'],
      ['search_terms', projection({ searchTerms: ['alpha'] }), 'added']
    ] as const)('raises over a draft holding an item added to %s, and keeps it', (field, match, item) => {
      const drafted = addListItem(session(match), field, field === 'triggers' ? 2 : 1, item);
      expect(isDirty(drafted.draft)).toBe(true);
      const next = applyObservation(drafted, raised(observation()));
      const conflict = externalOf(next);
      expect(conflict.draft).toBe(drafted.draft);
      const view = matchEditorView(next);
      expect(view.conflict).toBe(conflict);
      expect(canSave(next)).toBe(false);
      const label = field === 'triggers' ? 'triggers' : 'searchTerms';
      const rows = view.retainedDraft.filter((row) => row.label === label);
      expect(rows.map((row) => row.text)).toContain(item);
      expect(rows.length).toBeGreaterThan(1);
    }); // End of the B1 model-layer case

    it('takes nothing once closed', () => {
      const closed = ((onHand) => reloadTheDiskVersion(onHand, adopting().adopt, () => onHand))(confirmDiskReload(askToReloadDiskVersion(saveConflicted())));
      expect(closed.closed).toBe(true);
      expect(applyObservation(closed, raised(observation()))).toBe(closed);
      expect(applyObservation(closed, retainedDelivery(observation()))).toBe(closed);
    });
  }); // End of the "raising" suite

  describe('collisions: only one conflict is active (entry 7)', () => {
    it('retires a save conflict when an observation supersedes it, keeping the retained draft', () => {
      const stuck = saveConflicted();
      const saveModel = conflictOf(stuck);
      if (saveModel === null || !isSaveConflict(saveModel)) {
        throw new Error('this case starts from a save conflict');
      }
      const seen = observation({ diskRevision: 'c'.repeat(64), disk: makeDocument({ revision: 'c'.repeat(64) }) });
      const next = applyObservation(stuck, decided(saveModel.source, seen, false, 'supersedes'));
      // The save outcome is retired with its submission; the external conflict
      // carries the draft the save conflict retained — `supersedeConflict` reads it
      // off the model being replaced and nothing here chooses it.
      expect(next.outcome).toBeNull();
      expect(next.submitted).toBeNull();
      const conflict = externalOf(next);
      expect(conflict.draft).toBe(saveModel.draft);
      expect(conflict.draft.value.replace.text).toBe('c');
      expect(conflict.diskRevision).toBe('c'.repeat(64));
      expect(conflictOf(next)).toBe(conflict);
      expect(isSaveConflict(conflict)).toBe(false);
      // The view draws one conflict, with the external lines and no save lines.
      const view = matchEditorView(next);
      expect(view.conflict).toBe(conflict);
      expect(view.messages).toEqual([]);
      expect(view.externalMessages[0]).toEqual({ kind: 'fileChangedWhileOpen' });
    }); // End of the "supersedes a save conflict" case

    it('raises over a save conflict too, when the window says nothing stood, and retires it', () => {
      // A `raised` over a session showing a save conflict is a hand-built order —
      // the wrapper registers a save conflict as standing — and the model keeps the
      // invariant for it all the same: the newest decision is what the session shows.
      const stuck = saveConflicted();
      const next = applyObservation(stuck, raised(observation()));
      expect(next.outcome).toBeNull();
      expect(externalOf(next).draft.value.replace.text).toBe('c');
    });

    it('keeps a committed success and a refusal as history beside the external conflict', () => {
      // **History is not a conflict.** A `saved` outcome stays, with the
      // re-projection it owes; a `refused` outcome stays, with the submission its
      // consent path needs; neither is what `conflictOf` answers.
      const started = ((onHand) => beginSave(onHand, () => onHand))(edited());
      if (started === null) {
        throw new Error('an edited draft is saveable');
      }
      const committed = applySave(started.session, saved(), ADOPTED, () => started.session);
      const overSaved = applyObservation(committed, raised(observation()));
      expect(overSaved.outcome?.kind).toBe('saved');
      expect(overSaved.needsReprojection).toBe(true);
      expect(conflictOf(overSaved)).toBe(overSaved.externalConflict);
      const savedView = matchEditorView(overSaved);
      expect(savedView.messages.length).toBeGreaterThan(0);
      expect(savedView.externalMessages.length).toBe(3);

      const overRefused = applyObservation(refused(), raised(observation()));
      expect(overRefused.outcome?.kind).toBe('refused');
      expect(overRefused.submitted).not.toBeNull();
      expect(conflictOf(overRefused)).toBe(overRefused.externalConflict);
    }); // End of the "history survives" case

    it('lets a save that ends as a conflict retire the external one, and a refusal leave it (the reverse collision)', () => {
      // Not reachable through `beginSave`, which refuses under an external
      // conflict; this is the transition keeping entry 7 for a direct call.
      const blocked = applyObservation(refused(), raised(observation()));
      expect(blocked.externalConflict).not.toBeNull();
      const conflicted = applySave(
        blocked,
        makeConflict({ disk: makeDocument({ revision: AFTER }), expected: BASE, found: AFTER }),
        NOT_OWED, () => blocked
      );
      expect(conflicted.externalConflict).toBeNull();
      expect(conflicted.outcome?.kind).toBe('conflict');
      expect(conflictOf(conflicted)?.source.kind).toBe('save');
      // A refusal wrote nothing and says nothing about the file: the external
      // conflict stands over it.
      const refusedAgain = applySave(blocked, REFUSAL, NOT_OWED, () => blocked);
      expect(refusedAgain.externalConflict).toBe(blocked.externalConflict);
      expect(refusedAgain.outcome?.kind).toBe('refused');
    }); // End of the "reverse collision" case

    it('holds every delivery during its own save and replays them after the answer (entry 5)', () => {
      const started = ((onHand) => beginSave(onHand, () => onHand))(edited());
      if (started === null) {
        throw new Error('an edited draft is saveable');
      }
      const seen = observation();
      // The barrier tells the session `retained` first, then the settlement's
      // verdict — both before the continuation runs. Held, not applied: no
      // conflict, no wait, until the save's own answer is on the session.
      const heldOnce = applyObservation(started.session, retainedDelivery(seen));
      expect(heldOnce.externalConflict).toBeNull();
      expect(heldOnce.awaitingReconciliation).toBeNull();
      expect(heldOnce.heldDeliveries.map((one) => one.verdict.kind)).toEqual(['retained']);
      const heldTwice = applyObservation(heldOnce, raised(seen));
      expect(heldTwice.heldDeliveries.map((one) => one.verdict.kind)).toEqual(['retained', 'raised']);
      // The save's answer lands first, the held decision second, in one transition.
      const settled = applySave(heldTwice, saved(), ADOPTED, () => heldTwice);
      expect(settled.heldDeliveries).toEqual([]);
      expect(settled.outcome?.kind).toBe('saved');
      expect(externalOf(settled).source).toBe(externalConflictSource(seen));
      // A settlement that arbitrated the held reading against the save conflict the
      // wrapper registered answers `coalesced`, and the save conflict stands.
      const heldCoalesced = applyObservation(
        started.session,
        decided(saveConflictSource(makeConflict({ disk: makeDocument({ revision: AFTER }), expected: BASE, found: AFTER })), observation(), false, 'coalesced')
      );
      const saveConflict = applySave(
        heldCoalesced,
        makeConflict({ disk: makeDocument({ revision: AFTER }), expected: BASE, found: AFTER }),
        NOT_OWED, () => heldCoalesced
      );
      expect(saveConflict.heldDeliveries).toEqual([]);
      expect(saveConflict.externalConflict).toBeNull();
      expect(saveConflict.outcome?.kind).toBe('conflict');
      // And a save that produced no outcome consumes the hold too — the uncertain
      // settlement's `raisedWithoutReload` is what this path applies.
      const heldUncertain = applyObservation(started.session, decided(null, seen, true, 'raisedWithoutReload'));
      const failed = saveCouldNotBeSent(heldUncertain, true, null, () => heldUncertain);
      expect(failed.heldDeliveries).toEqual([]);
      expect(failed.sendFailure?.kind).toBe('mayHaveWritten');
      expect(failed.uncertaintyUnresolved).toBe(true);
      expect(externalOf(failed).source).toBe(externalConflictSource(seen));
    }); // End of the "held during the save" case
    it('replays every delivery held during its save in order, so a raised is not lost behind a later coalesced', () => {
      // **The review's second blocker, the reviewer's interleaving.** During the
      // editor's own save the barrier tells it `retained(A)`; the write settles
      // without writing and the settlement delivers `raised(A)`; before the
      // continuation runs, a sibling receiver publishes a later reading of the same
      // bytes and every receiver is told `coalesced`. A hold that kept only the
      // latest envelope replayed `coalesced` over a session with no conflict to
      // coalesce into, and the file's change was never shown.
      const started = ((onHand) => beginSave(onHand, () => onHand))(edited());
      if (started === null) {
        throw new Error('an edited draft is saveable');
      }
      const seen = observation();
      const later = observation({ sequence: 6 });
      const standing = externalConflictSource(seen);
      const held = applyObservation(
        applyObservation(applyObservation(started.session, retainedDelivery(seen)), raised(seen)),
        decided(standing, later, false, 'coalesced')
      );
      expect(held.externalConflict).toBeNull();
      const settled = applySave(held, REFUSAL, NOT_OWED, () => held);
      // The conflict `raised(A)` announced stands; the wait `retained(A)` recorded
      // ended with it; the `coalesced` found the conflict it was about.
      expect(settled.externalConflict?.source).toBe(standing);
      expect(settled.awaitingReconciliation).toBeNull();
      expect(settled.outcome?.kind).toBe('refused');
      expect(canSave(settled)).toBe(false);
      // Held in delivery order, and nothing left held once replayed.
      expect(held.heldDeliveries.map((delivery) => delivery.verdict.kind)).toEqual([
        'retained',
        'raised',
        'coalesced'
      ]);
      expect(settled.heldDeliveries).toEqual([]);
    }); // End of the "held deliveries replayed in order" case
  }); // End of the "collisions" suite

  describe('every verdict arm has an action (entry 11)', () => {
    it('changes nothing on coalesced and notLater, not even the object', () => {
      const seen = observation();
      const asked = askToReloadDiskVersion(applyObservation(edited(), raised(seen)));
      expect(matchEditorView(asked).awaitingReloadConfirmation).toBe(true);
      const same = observation({ sequence: 6 });
      const older = observation({ sequence: 4, diskRevision: 'd'.repeat(64) });
      const standing = externalConflictSource(seen);
      expect(applyObservation(asked, decided(standing, same, false, 'coalesced'))).toBe(asked);
      expect(applyObservation(asked, decided(standing, older, false, 'notLater'))).toBe(asked);
    });

    it('records a held observation as a restriction on sending, and writtenHere lifts it', () => {
      const seen = observation();
      const waiting = applyObservation(edited(), retainedDelivery(seen));
      // The wait: no conflict, no comparison, no origin — and no save.
      expect(waiting.awaitingReconciliation).toBe(seen);
      expect(waiting.externalConflict).toBeNull();
      expect(conflictOf(waiting)).toBeNull();
      expect(canSave(waiting)).toBe(false);
      expect(beginSave(waiting, () => waiting)).toBeNull();
      // The controls stay live: this is a restriction on sending, not on drafting.
      expect(isEditable(waiting)).toBe(true);
      const typed = editField(waiting, 'replace', 'cd');
      expect(typed.draft.value.replace.text).toBe('cd');
      expect(typed.awaitingReconciliation).toBe(seen);
      const view = matchEditorView(typed);
      expect(view.canSave).toBe(false);
      expect(view.editable).toBe(true);
      expect(view.externalNotices).toEqual([{ kind: 'observationRetained' }]);
      expect(view.conflict).toBeNull();
      // `writtenHere` about that observation lifts it and changes nothing else.
      const lifted = applyObservation(typed, writtenHereDelivery(seen));
      expect(lifted.awaitingReconciliation).toBeNull();
      expect(canSave(lifted)).toBe(true);
      expect(lifted).toEqual({ ...typed, awaitingReconciliation: null });
      expect(matchEditorView(lifted).externalNotices).toEqual([]);
      // About another observation it lifts nothing; with nothing awaited it is
      // the session itself.
      expect(applyObservation(typed, writtenHereDelivery(observation())).awaitingReconciliation).toBe(seen);
      expect(applyObservation(lifted, writtenHereDelivery(seen))).toBe(lifted);
    }); // End of the "retained and writtenHere" case

    it('ends the wait with any decision about the awaited observation, and replaces it with a later retained', () => {
      const seen = observation();
      const waiting = applyObservation(edited(), retainedDelivery(seen));
      // Decided as a conflict: the wait is over and the conflict stands.
      const nowConflict = applyObservation(waiting, raised(seen));
      expect(nowConflict.awaitingReconciliation).toBeNull();
      expect(nowConflict.externalConflict).not.toBeNull();
      // Decided as nothing new against a standing origin: the wait is over, the
      // rest is the session it was.
      const standing = externalConflictSource(observation({ sequence: 9 }));
      const notLater = applyObservation(waiting, decided(standing, seen, false, 'notLater'));
      expect(notLater).toEqual({ ...waiting, awaitingReconciliation: null });
      const coalesced = applyObservation(
        waiting,
        decided(externalConflictSource(observation({ sequence: 1 })), seen, false, 'coalesced')
      );
      expect(coalesced).toEqual({ ...waiting, awaitingReconciliation: null });
      // A later `retained` is the newer reading the barrier keeps, so it is the
      // one awaited now.
      const newer = observation({ sequence: 7 });
      expect(applyObservation(waiting, retainedDelivery(newer)).awaitingReconciliation).toBe(newer);
    }); // End of the "any decision ends the wait" case

    it('withholds the reload and the reapply on raisedWithoutReload until the snapshot is acknowledged', () => {
      const seen = observation();
      const withheld = applyObservation(edited(), decided(null, seen, true, 'raisedWithoutReload'));
      expect(withheld.uncertaintyUnresolved).toBe(true);
      const view = matchEditorView(withheld);
      expect(view.conflictChoices).toEqual<readonly ConflictChoice[]>(['keepEditing', 'copyDraft']);
      expect(view.reapplyOffered).toBe(false);
      expect(view.externalNotices).toEqual([{ kind: 'writeOutcomeUnknown' }]);
      // The three reload steps refuse a call made past the withheld control.
      expect(askToReloadDiskVersion(withheld)).toBe(withheld);
      expect(confirmDiskReload({ ...withheld, reload: { kind: 'confirming' } })).toEqual({
        ...withheld,
        reload: { kind: 'confirming' }
      });
      // And the reapply refuses before any evidence is read, adopting nothing.
      const recorder = adopting();
      expect(reapplyToDiskVersion(withheld, recorder.adopt, () => externalOf(withheld).source, () => withheld)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'writeOutcomeUnknown' }
      });
      expect(recorder.adoptions).toEqual([]);
      // A refused acknowledgement changes nothing; an accepted one rebuilds the
      // availability — from the idle reload step — and nothing else.
      const asked: ExternalChangeConflictSource[] = [];
      const refusedAck = acknowledgeSnapshot(withheld, (source) => {
        asked.push(source);
        return 'refused';
      });
      expect(refusedAck).toBe(withheld);
      expect(asked).toEqual([externalOf(withheld).source]);
      const acknowledged = acknowledgeSnapshot(withheld, () => 'acknowledged');
      expect(acknowledged).toEqual({ ...withheld, uncertaintyUnresolved: false, reload: NOT_RELOADING });
      expect(matchEditorView(acknowledged).conflictChoices).toEqual<readonly ConflictChoice[]>([
        'keepEditing',
        'copyDraft',
        'keepMyDraft',
        'reloadDiskVersion'
      ]);
      expect(matchEditorView(askToReloadDiskVersion(acknowledged)).awaitingReloadConfirmation).toBe(true);
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
      const later = observation({ sequence: 6, diskRevision: 'c'.repeat(64), disk: makeDocument({ revision: 'c'.repeat(64) }) });
      const replaced = applyObservation(
        withheld,
        decided(externalConflictSource(first), later, false, 'supersedes')
      );
      expect(replaced.uncertaintyUnresolved).toBe(false);
      expect(externalOf(replaced).source).toBe(externalConflictSource(later));
      expect(matchEditorView(replaced).conflictChoices).toContain('reloadDiskVersion');
    });
  }); // End of the "every verdict arm" suite

  describe('a replacing verdict resets the surface (entry 12), and dismissal erases no block (entry 9)', () => {
    it('resets the reload, drops the confirmation and invalidates a displayed reapply result, keeping intent and history', () => {
      const stuck = saveConflicted();
      const saveModel = conflictOf(stuck);
      if (saveModel === null) {
        throw new Error('this case starts from a save conflict');
      }
      const confirmed = confirmDiskReload(askToReloadDiskVersion(stuck));
      expect(confirmed.reload.kind).toBe('confirmed');
      // A report a panel is showing about the old conflict, paired to its session.
      const attempt = attemptOfReapply(confirmed, { kind: 'adoptionRefused' } as const);
      expect(reapplyToShow(attempt, confirmed)).toEqual({ kind: 'adoptionRefused' });

      const seen = observation({ diskRevision: 'c'.repeat(64), disk: makeDocument({ revision: 'c'.repeat(64) }) });
      const next = applyObservation(confirmed, decided(saveModel.source, seen, false, 'supersedes'));
      // The reload is idle again: the confirmation collected under the old warning
      // is gone from the session, so it cannot be spent against the new conflict.
      expect(next.reload).toBe(NOT_RELOADING);
      expect(matchEditorView(next).awaitingReloadConfirmation).toBe(false);
      const recorder = adopting();
      expect(reloadTheDiskVersion(next, recorder.adopt, () => next)).toBe(next);
      expect(recorder.adoptions).toEqual([]);
      // The displayed result is about a session that is no longer on screen.
      expect(reapplyToShow(attempt, next)).toBeNull();
      // Field intent survives.
      expect(next.draft.value.replace.text).toBe('c');
      expect(fieldIntent(next.baseline.replace, next.draft.value.replace)).toEqual({ Set: 'c' });
    }); // End of the "replacing verdict resets" case

    it('keeps save history through a replacing verdict', () => {
      const withRefusal = applyObservation(refused(), raised(observation()));
      const seen = observation({ sequence: 6, diskRevision: 'c'.repeat(64), disk: makeDocument({ revision: 'c'.repeat(64) }) });
      const replaced = applyObservation(
        withRefusal,
        decided(externalOf(withRefusal).source, seen, false, 'supersedes')
      );
      expect(replaced.outcome).toBe(withRefusal.outcome);
      expect(replaced.submitted).toBe(withRefusal.submitted);
      expect(externalOf(replaced).source).toBe(externalConflictSource(seen));
    });

    it('lets keepEditing cancel the warning and the save panel, and nothing external', () => {
      const seen = observation();
      const blocked = askToReloadDiskVersion(applyObservation(refused(), raised(seen)));
      expect(blocked.outcome?.kind).toBe('refused');
      const kept = keepEditing(blocked);
      // The save panel and the warning go; the block stays.
      expect(kept.outcome).toBeNull();
      expect(kept.reload).toBe(NOT_RELOADING);
      expect(kept.externalConflict).toBe(blocked.externalConflict);
      expect(conflictOf(kept)).toBe(blocked.externalConflict);
      expect(isEditable(kept)).toBe(false);
      expect(canSave(kept)).toBe(false);
      expect(beginSave(kept, () => kept)).toBeNull();
      // The uncertainty and the wait survive it too.
      const withheld = applyObservation(edited(), decided(null, observation(), true, 'raisedWithoutReload'));
      expect(keepEditing(withheld).uncertaintyUnresolved).toBe(true);
      const waiting = applyObservation(edited(), retainedDelivery(seen));
      expect(keepEditing(waiting).awaitingReconciliation).toBe(seen);
      expect(canSave(keepEditing(waiting))).toBe(false);
    }); // End of the "keepEditing erases no block" case
  }); // End of the "entry 12 and entry 9" suite

  describe('the reapply over the external origin (entries 19, 20 and 22)', () => {
    /** The base identity the fixtures' session edits: document 1, `BASE`, node 1. */
    const SUBJECT = session().match;

    /**
     * The disk-side snippet an identified row points at.
     *
     * @param overrides - Whatever the case needs beyond the trigger and the body.
     * @returns The projection the disk snapshot holds.
     */
    function target(overrides: Parameters<typeof makeMatch>[0] = {}): MatchView {
      return makeMatch({ revision: AFTER, node: 9, trigger: ':a', replace: 'b', ...overrides });
    } // End of function target()

    /**
     * One row of a table.
     *
     * @param base - The identity the row is about.
     * @param editor - The editor tier's answer.
     * @returns The row, with an exact tier that answers nothing.
     */
    function row(base: MatchId, editor: ReapplyResolution): CorrespondenceEntry {
      return { base, exact: { Unsupported: {} }, editor };
    } // End of function row()

    /**
     * An observation carrying a table over the two revisions, with a disk
     * projection holding the target.
     *
     * @param entries - The table's rows.
     * @param disk - The disk snapshot's matches.
     * @param revisions - The table's two revisions, defaulting to the matching pair.
     * @returns The observation.
     */
    function observed(
      entries: readonly CorrespondenceEntry[],
      disk: readonly MatchView[],
      revisions: { readonly base?: string; readonly disk?: string } = {}
    ): ExternalConflictObservation {
      return observation({
        disk: makeDocument({ revision: AFTER, matches: disk }),
        correspondences: {
          base_revision: revisions.base ?? BASE,
          disk_revision: revisions.disk ?? AFTER,
          entries
        }
      });
    } // End of function observed()

    /**
     * A session showing an external conflict over an edited draft.
     *
     * @param seen - The observation raised over it.
     * @param edit - What the person did first.
     * @returns The session, and the guard answering its own conflict's origin.
     */
    function raisedOver(
      seen: ExternalConflictObservation,
      edit: (start: MatchEditorSession) => MatchEditorSession = (start) => editField(start, 'replace', 'mine')
    ): { readonly stuck: MatchEditorSession; readonly stands: StandingOriginGuard } {
      const stuck = applyObservation(edit(session()), raised(seen));
      const source = externalOf(stuck).source;
      return { stuck, stands: () => source };
    } // End of function raisedOver()

    it('rebuilds the draft over the snippet the row identified by full base identity', () => {
      const identified = target();
      const { stuck, stands } = raisedOver(observed([row(SUBJECT, { Identified: { target: identified } })], [identified]));
      const recorder = adopting();
      const answer = reapplyToDiskVersion(stuck, recorder.adopt, stands, () => stuck);
      expect(answer.kind).toBe('reapplied');
      if (answer.kind !== 'reapplied') {
        throw new Error('this case is about the rebuilt session');
      }
      expect(answer.session.match).toEqual(identified.id);
      expect(baseRevisionOf(answer.session)).toBe(AFTER);
      expect(answer.session.draft.value.replace.text).toBe('mine');
      expect(canSave(answer.session)).toBe(true);
      // A fresh session over the adopted projection: no external conflict, no
      // uncertainty, no wait carried across.
      expect(answer.session.externalConflict).toBeNull();
      expect(answer.session.awaitingReconciliation).toBeNull();
      // The adoption was the external conflict's own, once.
      expect(recorder.adoptions).toEqual([externalOf(stuck)]);
    }); // End of the "rebuilds over the identified row" case

    it('reads the row’s editor tier: a refused tier and an empty one each end where the save origin’s would', () => {
      const refusedTier = raisedOver(
        observed([row(SUBJECT, { Refused: { reason: 'AmbiguousTrigger' } })], [target()])
      );
      const recorder = adopting();
      expect(reapplyToDiskVersion(refusedTier.stuck, recorder.adopt, refusedTier.stands, () => refusedTier.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'correspondence', reason: 'AmbiguousTrigger' }
      });
      const emptyTier = raisedOver(observed([row(SUBJECT, { Unsupported: {} })], [target()]));
      expect(reapplyToDiskVersion(emptyTier.stuck, recorder.adopt, emptyTier.stands, () => emptyTier.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'evidenceNotATarget' }
      });
      expect(recorder.adoptions).toEqual([]);
    });

    it('refuses a table with no row for the identity, or several, adopting nothing', () => {
      // **Never the node alone and never the position** (entry 20): the only row
      // agrees on node and document and names another revision; the second table
      // puts a row about another snippet where this one's index would be.
      const nodeOnly = raisedOver(
        observed([row({ document: 1, revision: 'z'.repeat(64), node: 1 }, { Identified: { target: target() } })], [target()])
      );
      const recorder = adopting();
      expect(reapplyToDiskVersion(nodeOnly.stuck, recorder.adopt, nodeOnly.stands, () => nodeOnly.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: 'noRowForBase' }
      });
      const byPosition = raisedOver(
        observed([row({ document: 1, revision: BASE, node: 2 }, { Identified: { target: target() } })], [target()])
      );
      expect(reapplyToDiskVersion(byPosition.stuck, recorder.adopt, byPosition.stands, () => byPosition.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: 'noRowForBase' }
      });
      const twice = raisedOver(
        observed(
          [
            row(SUBJECT, { Identified: { target: target() } }),
            row(SUBJECT, { Identified: { target: target({ node: 12 }) } })
          ],
          [target(), target({ node: 12 })]
        )
      );
      expect(reapplyToDiskVersion(twice.stuck, recorder.adopt, twice.stands, () => twice.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: 'severalRowsForBase' }
      });
      expect(recorder.adoptions).toEqual([]);
    }); // End of the "no row or several rows" case

    it('refuses a table about other revisions, and an observation with none, adopting nothing', () => {
      const recorder = adopting();
      const otherBase = raisedOver(
        observed([row(SUBJECT, { Identified: { target: target() } })], [target()], { base: 'z'.repeat(64) })
      );
      expect(reapplyToDiskVersion(otherBase.stuck, recorder.adopt, otherBase.stands, () => otherBase.stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: 'baseRevisionMoved' }
      });
      const otherDisk = raisedOver(
        observed([row(SUBJECT, { Identified: { target: target() } })], [target()], { disk: 'z'.repeat(64) })
      );
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
    }); // End of the "table refusals" case

    it('refuses superseded evidence through the live guard, whichever origin, adopting nothing', () => {
      const identified = target();
      const { stuck } = raisedOver(observed([row(SUBJECT, { Identified: { target: identified } })], [identified]));
      const recorder = adopting();
      const elsewhere = externalConflictSource(observation({ sequence: 9 }));
      expect(reapplyToDiskVersion(stuck, recorder.adopt, () => elsewhere, () => stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'supersededEvidence' }
      });
      expect(reapplyToDiskVersion(stuck, recorder.adopt, () => null, () => stuck)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'supersededEvidence' }
      });
      // The save origin enters through the same entry and meets the same guard.
      expect(((onHand) => reapplyToDiskVersion(onHand, recorder.adopt, () => elsewhere, () => onHand))(saveConflicted())).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'supersededEvidence' }
      });
      expect(recorder.adoptions).toEqual([]);
    });

    it('answers every adoption outcome for the external origin as it does for the save origin', () => {
      const identified = target();
      const { stuck, stands } = raisedOver(observed([row(SUBJECT, { Identified: { target: identified } })], [identified]));
      expect(reapplyToDiskVersion(stuck, adopting('installed').adopt, stands, () => stuck).kind).toBe('reapplied');
      expect(reapplyToDiskVersion(stuck, adopting('alreadyThere').adopt, stands, () => stuck).kind).toBe('reapplied');
      const refusedWindow = adopting('refused');
      expect(reapplyToDiskVersion(stuck, refusedWindow.adopt, stands, () => stuck)).toEqual({ kind: 'adoptionRefused' });
      expect(refusedWindow.adoptions).toHaveLength(1);
      // Already satisfied on disk, with the disk adopted all the same.
      const satisfying = target({ replace: 'mine' });
      const already = raisedOver(observed([row(SUBJECT, { Identified: { target: satisfying } })], [satisfying]));
      const recorder = adopting();
      const answer = reapplyToDiskVersion(already.stuck, recorder.adopt, already.stands, () => already.stuck);
      expect(answer.kind).toBe('alreadySatisfied');
      expect(recorder.adoptions).toHaveLength(1);
    }); // End of the "three adoption outcomes" case

    it('refuses a reapply while an observation is held, so no rebuilt session can drop the block', () => {
      // **The review's first blocker.** A conflict stands, another surface's write
      // is in flight, and a second reading is held undecided: the session refuses to
      // send. A reapply that rebuilt the session over the adopted snapshot would
      // hand back one with no wait recorded, and the blocked submission would be
      // allowed through the fresh session's ordinary `Save`.
      const identified = target();
      const { stuck, stands } = raisedOver(observed([row(SUBJECT, { Identified: { target: identified } })], [identified]));
      const heldReading = observation({ sequence: 6, diskRevision: 'd'.repeat(64), disk: makeDocument({ revision: 'd'.repeat(64) }) });
      const held = applyObservation(stuck, retainedDelivery(heldReading));
      expect(held.awaitingReconciliation).toBe(heldReading);
      expect(canSave(held)).toBe(false);
      const recorder = adopting();
      expect(reapplyToDiskVersion(held, recorder.adopt, stands, () => held)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'observationRetained' }
      });
      expect(recorder.adoptions).toEqual([]);
      // The control is withheld by the same fact, and the notice says why.
      const view = matchEditorView(held);
      expect(view.conflictChoices).toEqual<readonly ConflictChoice[]>(['keepEditing', 'copyDraft', 'reloadDiskVersion']);
      expect(view.reapplyOffered).toBe(false);
      expect(view.externalNotices).toEqual([{ kind: 'observationRetained' }]);
      // Once the held reading is decided, the reapply goes through as before.
      const lifted = applyObservation(held, writtenHereDelivery(heldReading));
      const answer = reapplyToDiskVersion(lifted, adopting().adopt, stands, () => lifted);
      expect(answer.kind).toBe('reapplied');
      if (answer.kind !== 'reapplied') {
        throw new Error('this case ends on the rebuilt session');
      }
      expect(answer.session.awaitingReconciliation).toBeNull();
      expect(canSave(answer.session)).toBe(true);
    }); // End of the "reapply refused while an observation is held" case

    it('asks nothing of the window when no guard is handed in, and leaves the door to decide', () => {
      // **The documented cost of the optional guard**: the supersession question is
      // not asked here, so a superseded origin reaches `adopt`, which refuses it at
      // the door — `adoptionRefused`, not the typed supersession sentence.
      const identified = target();
      const { stuck } = raisedOver(observed([row(SUBJECT, { Identified: { target: identified } })], [identified]));
      const refusedWindow = adopting('refused');
      expect(reapplyToDiskVersion(stuck, refusedWindow.adopt, null, () => stuck)).toEqual({ kind: 'adoptionRefused' });
      expect(refusedWindow.adoptions).toEqual([externalOf(stuck)]);
      // And a window that installs lets the rebuild through, as the component's
      // save-origin call always has.
      expect(reapplyToDiskVersion(stuck, adopting().adopt, null, () => stuck).kind).toBe('reapplied');
    });

    it('names a sentence in both languages for every obstacle the external origin can raise', () => {
      const obstacles: EditorReapplyObstacle[] = [
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
        const key = editorReapplyObstacleKey(obstacle);
        for (const locale of LOCALES) {
          expect(DICTIONARIES[locale][key], `${locale}:${obstacle.kind}`).toBeTruthy();
          const rendered = describeEditorReapplyObstacle(locale, obstacle);
          expect(rendered, `${locale}:${obstacle.kind}`).toBe(DICTIONARIES[locale][key]);
          expect(rendered).not.toContain('{');
        } // End of the loop over the two locales
      } // End of the loop over the external obstacles
      // The uncertainty and retained obstacles are the notices' own sentences, by
      // their own keys.
      expect(editorReapplyObstacleKey({ kind: 'writeOutcomeUnknown' })).toBe(
        'browser.externalConflict.writeOutcomeUnknown'
      );
      expect(editorReapplyObstacleKey({ kind: 'observationRetained' })).toBe(
        'browser.externalConflict.observationRetained'
      );
    }); // End of the "a sentence per obstacle" case

    it('reads no evidence for a session that is already blocked (2d-6-4’s pattern, Phase 2d-6-6a)', () => {
      // The two blocks come before the entry, which reads the observation's
      // table; a table whose spine counts its reads is the pin.
      let reads = 0;
      const seen: ExternalConflictObservation = {
        ...observation(),
        get correspondences(): CorrespondenceTable {
          reads += 1;
          return { base_revision: BASE, disk_revision: AFTER, entries: [] };
        }
      };
      const { stuck, stands } = raisedOver(seen);
      const recorder = adopting();
      const held = applyObservation(stuck, retainedDelivery(observation({ sequence: 6 })));
      expect(reapplyToDiskVersion(held, recorder.adopt, stands, () => held)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'observationRetained' }
      });
      const withheld = applyObservation(edited(), decided(null, seen, true, 'raisedWithoutReload'));
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

    it('rechecks the installed session immediately before adopting, and refuses what a read delivered during the reapply (Phase 2d-6-6a)', () => {
      // A getter behind the row's `editor` tier runs after the two blocks were
      // asked and before the adoption; a window's receiver, run from it, records
      // a wait, a supersession or an uncertainty on the installed session. The
      // reapply must ask the installed session again, once, immediately before it
      // adopts — and adopt nothing when it changed.
      const identified = target();
      const heldReading = observation({ sequence: 6, diskRevision: 'd'.repeat(64), disk: makeDocument({ revision: 'd'.repeat(64) }) });
      const recorder = adopting();
      /**
       * A session raised over a table whose subject row delivers to the holder
       * when its editor tier is read.
       *
       * @param deliver - What the read delivers, or `null` for nothing.
       * @returns The reader and the guard.
       */
      function trapped(deliver: ((source: ConflictSource) => ObservationDelivery) | null): {
        readonly current: () => MatchEditorSession;
        readonly stands: StandingOriginGuard;
      } {
        let held: MatchEditorSession | null = null;
        const trappedRow: CorrespondenceEntry = {
          base: SUBJECT,
          exact: { Unsupported: {} },
          get editor(): ReapplyResolution {
            if (held !== null && deliver !== null) {
              held = applyObservation(held, deliver(externalOf(held).source));
            }
            return { Identified: { target: identified } };
          }
        };
        const raisedSession = raisedOver(observed([trappedRow], [identified])).stuck;
        held = raisedSession;
        const source = externalOf(raisedSession).source;
        return { current: () => held ?? raisedSession, stands: () => source };
      } // End of function trapped()
      const waited = trapped(() => retainedDelivery(heldReading));
      expect(reapplyToDiskVersion(waited.current(), recorder.adopt, waited.stands, waited.current)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'observationRetained' }
      });
      expect(waited.current().awaitingReconciliation).toBe(heldReading);
      const superseded = trapped((source) => decided(source, heldReading, false, 'supersedes'));
      expect(reapplyToDiskVersion(superseded.current(), recorder.adopt, superseded.stands, superseded.current)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'supersededEvidence' }
      });
      const uncertain = trapped((source) => decided(source, heldReading, true, 'raisedWithoutReload'));
      expect(reapplyToDiskVersion(uncertain.current(), recorder.adopt, uncertain.stands, uncertain.current)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'writeOutcomeUnknown' }
      });
      expect(recorder.adoptions).toEqual([]);
      // A read that delivers nothing adopts as before.
      const quiet = trapped(null);
      expect(reapplyToDiskVersion(quiet.current(), recorder.adopt, quiet.stands, quiet.current).kind).toBe('reapplied');
      expect(recorder.adoptions).toHaveLength(1);
      // And a reader answering another session than the one handed in adopts
      // nothing: the conflict it shows is not the one being reapplied.
      const displaced = trapped(null);
      const other = applyObservation(edited(), raised(observation({ sequence: 7 })));
      expect(reapplyToDiskVersion(displaced.current(), recorder.adopt, displaced.stands, () => other)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'supersededEvidence' }
      });
      expect(recorder.adoptions).toHaveLength(1);
    }); // End of the "recheck before adoption" case

    it('keeps the installed session when a refused reapply is folded by a panel’s handler (2d-6-6a review, finding 3)', () => {
      // **The handler's order, reproduced over the real transitions.** A panel
      // folds the outcome into the session to hold through `attemptOfReapply`;
      // an evidence getter that delivers a wait makes the recheck refuse
      // `observationRetained`, and the session the handler then installs must be
      // the one the receiver installed, not one read before the reapply ran.
      // No component registers a receiver yet (2d-6-6b), so this is the rule
      // `MatchEditor.svelte`'s `keepMyDraft` and its five twins follow, pinned
      // where it can be driven.
      const identified = target();
      const heldReading = observation({ sequence: 6, diskRevision: 'd'.repeat(64), disk: makeDocument({ revision: 'd'.repeat(64) }) });
      let session: MatchEditorSession | null = null;
      const trappedRow: CorrespondenceEntry = {
        base: SUBJECT,
        exact: { Unsupported: {} },
        get editor(): ReapplyResolution {
          if (session !== null) {
            session = applyObservation(session, retainedDelivery(heldReading));
          }
          return { Identified: { target: identified } };
        }
      };
      const raisedSession = raisedOver(observed([trappedRow], [identified])).stuck;
      session = raisedSession;
      const recorder = adopting();
      const current = (): MatchEditorSession => session ?? raisedSession;
      // The handler: the outcome first, then the session still installed. (The
      // first landing passed `attemptOfReapply` a session read before the reapply
      // ran, and folded a refusal into that capture.)
      const outcome = reapplyToDiskVersion(current(), recorder.adopt, null, current);
      const attempt = attemptOfReapply(current(), outcome);
      expect(outcome).toEqual({ kind: 'manualResolution', obstacle: { kind: 'observationRetained' } });
      expect(attempt.session).toBe(current());
      expect(attempt.session.awaitingReconciliation).toBe(heldReading);
      expect(recorder.adoptions).toEqual([]);
    }); // End of the "handler keeps the installed session" case

    it('answers supersededEvidence and rebuilds nothing when another conflict landed during a satisfied adoption (Phase 2d-6-6b)', () => {
      // **The arm the 2d-6-6a fix round wrote and did not pin** (its §4 item 5):
      // the window installs this snapshot, and while it is still inside `adopt`
      // the receiver records a later reading superseding the conflict. The
      // person must decide about that one; nothing is rebuilt over it.
      const identified = target();
      const { stuck, stands } = raisedOver(observed([row(SUBJECT, { Identified: { target: identified } })], [identified]));
      let holder = stuck;
      const newer = observation({ sequence: 6, diskRevision: 'c'.repeat(64), disk: makeDocument({ revision: 'c'.repeat(64) }) });
      const recorder = adopting('installed');
      const answer = reapplyToDiskVersion(
        stuck,
        (conflict, confirmation) => {
          holder = applyObservation(holder, decided(externalOf(holder).source, newer, false, 'supersedes'));
          return recorder.adopt(conflict, confirmation);
        },
        stands,
        () => holder
      );
      expect(recorder.adoptions).toHaveLength(1);
      expect(answer).toEqual({ kind: 'manualResolution', obstacle: { kind: 'supersededEvidence' } });
      expect(holder).not.toBe(stuck);
      expect(externalOf(holder).source).toBe(externalConflictSource(newer));
      expect(holder.match).toBe(stuck.match);
      expect(baseRevisionOf(holder)).toBe(BASE);
    }); // End of the "another conflict after a satisfied adoption" case

    /**
     * A Proxy over one session whose first property read after it is armed runs
     * a body once — 2d-6-6b's review, its one blocker, on the reapply.
     *
     * @param over - The session to stand in for.
     * @param body - What that read does before answering.
     * @returns The proxy, and the call that arms it.
     */
    function trappedForReapply(over: MatchEditorSession, body: () => void): { readonly proxy: MatchEditorSession; arm(): void } {
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

    it('refuses, and asks the window nothing, when a read of the installed session displaced it before the adoption (the review’s blocker)', () => {
      const identified = target();
      const { stuck, stands } = raisedOver(observed([row(SUBJECT, { Identified: { target: identified } })], [identified]));
      const displaced = applyObservation(stuck, retainedDelivery(observation({ sequence: 6 })));
      let holder: MatchEditorSession = stuck;
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

    it('rebuilds nothing when a read of the settled session displaced it after the adoption (the review’s blocker)', () => {
      const identified = target();
      const { stuck, stands } = raisedOver(observed([row(SUBJECT, { Identified: { target: identified } })], [identified]));
      const displaced = applyObservation(stuck, retainedDelivery(observation({ sequence: 6 })));
      let holder: MatchEditorSession = stuck;
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
  }); // End of the "reapply over the external origin" suite

  describe('the reload against the installed session (Phase 2d-6-6b)', () => {
    // **The adoption runs the window's own reads of the observation's
    // projection** (2d-6-5's review, its third finding), and a getter there can
    // tell the window of a later reading whose receiver installs a new session
    // while the reload is still inside `adopt`. `holder` stands in for the
    // component's `$state`.

    /**
     * A session showing an external conflict over an edited draft, confirmed to
     * reload from it.
     *
     * @param seen - The observation raised over it.
     * @returns The confirmed session.
     */
    function confirmedOver(seen: ExternalConflictObservation): MatchEditorSession {
      const confirmed = confirmDiskReload(askToReloadDiskVersion(applyObservation(edited(), raised(seen))));
      expect(confirmed.reload.kind).toBe('confirmed');
      return confirmed;
    } // End of function confirmedOver()

    it('answers the installed session and asks the window nothing when the session was displaced before the adoption', () => {
      const confirmed = confirmedOver(observation());
      const installed = applyObservation(confirmed, retainedDelivery(observation({ sequence: 6 })));
      expect(installed).not.toBe(confirmed);
      const recorder = adopting();
      expect(reloadTheDiskVersion(confirmed, recorder.adopt, () => installed)).toBe(installed);
      expect(recorder.adoptions).toEqual([]);
    });

    it('answers the installed session untouched when another conflict landed during the adoption', () => {
      const seen = observation();
      let holder = confirmedOver(seen);
      const newer = observation({ sequence: 6, diskRevision: 'c'.repeat(64), disk: makeDocument({ revision: 'c'.repeat(64) }) });
      const recorder = adopting('installed');
      const answered = reloadTheDiskVersion(
        holder,
        (conflict, confirmation) => {
          holder = applyObservation(holder, decided(externalConflictSource(seen), newer, false, 'supersedes'));
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
          holder = applyObservation(holder, retainedDelivery(later));
          return refusing.adopt(conflict, confirmation);
        },
        () => holder
      );
      expect(refusing.adoptions).toHaveLength(1);
      expect(refused.reload.kind).toBe('refused');
      expect(refused.awaitingReconciliation).toBe(later);
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
    function trappedSession(target: MatchEditorSession, body: () => void): { readonly proxy: MatchEditorSession; arm(): void } {
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
        const displaced = applyObservation(confirmed, retainedDelivery(observation({ sequence: 6 })));
        let holder: MatchEditorSession = confirmed;
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
      const asked = askToReloadDiskVersion(applyObservation(edited(), raised(observation())));
      expect(asked.reload.kind).not.toBe('confirmed');
      const displaced = applyObservation(asked, retainedDelivery(observation({ sequence: 6 })));
      let holder: MatchEditorSession = asked;
      const step = asked.reload;
      const tricked: MatchEditorSession = {
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
