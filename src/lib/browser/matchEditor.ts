/**
 * The small editor's state machine: six fields of one snippet, drafted and saved.
 *
 * **No component and no screen.** This is the whole protocol as a value, exactly
 * as `./rawEditor.ts` is for the raw editor and for the same standing reason
 * (`docs/decisions/1c-1-notes.md` hole 1): nothing in this repository renders a
 * Svelte component in an automated test unless the file opts into jsdom, so a
 * decision written in markup is a decision nothing can check. A later step of
 * 2c-2 draws what this module decides.
 *
 * ## The four things it edits, and the six fields they are
 *
 * The literal **trigger**, the **`replace`** body, the **label** and the three
 * **word-boundary** keys — which is `word`, `left_word` and `right_word`, three
 * fields and not one control. Six `DraftField<string>`s of a twenty-two-field
 * {@link MatchDraft}; the other sixteen and all four lists go out `'Unchanged'`.
 *
 * The word-boundary keys stay **textual**, which is the design consult's Q1 and
 * D2u restated for an editor: a checkbox over `word` would have to decide that
 * `on`, `yes` and `true` are the same value, and this application does not know
 * that — it shows a scalar's source text as written and never an inferred type.
 *
 * ## The failure this phase is named after, made structural
 *
 * 2c-2's stated failure mode is **a draft-versus-projection mistake**. So the two
 * are not one value here and cannot be confused by accident:
 *
 * - {@link MatchBaseline} is the **projection** side — what the file held when
 *   this session was seeded, whether it held the key at all, and whether the field
 *   may be edited. It is not drafted, is not in the undo history, and moves only
 *   at a save boundary;
 * - {@link MatchBuffers} is the **draft** side — what the controls hold now, and
 *   whether the person has asked for a key to be taken away. This is what
 *   `Draft<T>` snapshots, freezes and walks backwards through.
 *
 * {@link fieldIntent} is the only thing that reads both, and the `DraftField`
 * tri-state it produces is the authoritative intent. That is the consult's Q3:
 * *absent*, *present* and *removed* are **not** three equivalent value states.
 *
 * The rule that pays for the whole arrangement is the second one below. An
 * initially absent field left blank is `'Unchanged'`, so this application does not
 * write `label: ''` into a file that never had a label — and it cannot, because
 * the buffer alone cannot tell that case from a present field cleared to empty.
 *
 * | The person did this | The intent |
 * |---|---|
 * | nothing, to a field the file has or does not have | `'Unchanged'` |
 * | left an **absent** field blank | `'Unchanged'` |
 * | typed into an **absent** field | `{ Set: value }` |
 * | cleared a **present** field to empty | `{ Set: '' }` |
 * | asked for a **present** field to be removed | `'Remove'` |
 * | retyped a present field's exact projected value | `'Unchanged'` |
 *
 * The last is not an optimisation. Rust's `plan_scalar` answers `Ok(None)` for a
 * `Set` whose value equals the scalar's own text, so the batch would be empty
 * either way; what a `Set` would cost is honesty — a draft claiming an edit it
 * does not have, which is exactly the mistake this phase is named after.
 *
 * ## Eligibility is decided before a value is bound to a control
 *
 * The consult's change 1. Every field carries a typed {@link FieldEligibility}
 * computed from the projection, and four of its five refusals are refusals this
 * application would otherwise discover *after* the person had typed:
 *
 * - `notDecodable` — `ScalarView.decoded` is `false`, so `text` is the raw source
 *   slice rather than a logical value and `plan_scalar` refuses with
 *   `NotDecodable`;
 * - `carriageReturn` — the **Q2 policy (i)** decision, below;
 * - `ownsNoBytes` — the scalar's span is zero-width, which `plan_scalar` refuses
 *   with `TargetOwnsNoBytes`. It is decidable from the projection:
 *   `ScalarView.span` crosses the wire and the Rust test is `span.start ==
 *   span.end`, the same comparison;
 * - `unmodelledShape` — the file **has** the key but its value is not a scalar, so
 *   the projection carries it in `unknown_entries` and `scalar_of` answers `None`.
 *   Treating that as absent would derive an insertion of a key the mapping already
 *   holds, which Rust refuses by name (`FieldHasAnUnmodelledShape`);
 * - `triggerNotSingle` — the **Q5** decision: the trigger is editable only when the
 *   match's `TriggerKind` is `Single`. Converting a `triggers:` list or a `regex:`
 *   into a literal trigger is a different operation, and a draft that could only
 *   ever reach an unacknowledgeable refusal should not be creatable.
 *
 * Each is a **code**, never a sentence — `fieldRefusalKey` maps it to a
 * dictionary key and `tFieldRefusal` in `../i18n` renders it. The consult asks
 * for read-only rather than disabled, which is a component decision; what this
 * module owes is the verdict and the reason, and {@link isFieldEditable} is the
 * gate every transition below goes through.
 *
 * ## The carriage return, twice
 *
 * A `replace: "a\rb"` decodes to a logical value holding a **real** carriage
 * return, and a browser text control normalises every carriage return in its value
 * to a line feed. So binding such a value to a control and reading it back
 * silently corrupts it, and the corruption is invisible: the save reports that the
 * bytes written are exactly the bytes sent, which is true and is not the point.
 *
 * The consult chose policy (i) — make such a value visibly read-only — over
 * "submit only when something else changed", which mistakes a deliberate
 * carriage-return-to-line-feed edit for no change, and over normalising, which
 * contradicts the preservation promise outright. It is enforced in two places:
 * {@link fieldEligibility} refuses the field before anything is bound, and
 * {@link editField} refuses a value carrying one on the way in, because the first
 * is a statement about the projection and the second is a statement about this
 * function.
 *
 * **Line breaks are not the hazard here, and 2c-1b's refusal does not
 * generalise.** The raw editor holds a file's own bytes, so a `\r\n` in the file
 * is a `\r` in the box. A projected scalar's `text` is the **decoder's** output,
 * and the decoder normalises every source line break to `\n`; Rust re-emits using
 * the document's own line ending. So a text area's line-break normalisation is a
 * no-op on these values, and the only carriage return that can reach one is an
 * explicit escape the person wrote on purpose.
 *
 * ## History is coalesced per field, which reverses 2c-1b for fields only
 *
 * `docs/decisions/2c-1b-notes.md` §2.4 decided **not** to coalesce, because what
 * one edit means in a free-form text area is a guess. The consult's Q4 reverses
 * that here, for fields, and the reason is that the raw editor's argument does not
 * carry over: a field has a boundary a text area does not — it can be left. A
 * group ends on a blur, on a change of focused field, on any structural action
 * (removal, restoration, save, undo, redo, dismissal) and on
 * {@link TYPING_GROUP_IDLE_MS} of quiet.
 *
 * The **live draft still updates on every keystroke**; only the history snapshot
 * is coalesced. Without that, a moderately long `replace` exhausts all hundred
 * history entries and performs a hundred deep clones and recursive freezes of a
 * six-field object, and every one of the person's earlier edits is dropped to make
 * room for the tail of one word.
 *
 * The clock is a **parameter**, never `Date.now()` reached for inside this module
 * and never a `setTimeout`: a boundary decided by real time is a boundary no test
 * can drive. {@link startMatchEditor} takes one and has no default, because a
 * default is a thing to forget.
 *
 * ## What a committed save moves, and what it does not
 *
 * A commit invalidates the identity this session holds, so `SavedResult.moved` is
 * **adopted** ({@link applySave}) and a commit that answers no identity puts the
 * session into {@link MatchEditorSession.identityStale}, where it will not save
 * again — a second save on a stale identity is refused by the command, and
 * offering it would be this editor promising something it cannot keep. A commit
 * whose **adoption failed** is the same state for a different reason: the window
 * holds no projection of that file at all, so there is nothing an identity could
 * resolve against. It is still a committed save, and it says so — the failure is a
 * line beside the saved arm and never in place of it.
 *
 * The baselines move too, to what was written: a field that was inserted is now
 * present, and a field that was removed is now absent. Without that, clearing a
 * label the *same session* had just inserted would derive `'Unchanged'` — the
 * absent-and-blank rule applied to a file that is no longer absent — and the label
 * would silently stay in the file. **What the rebase does not refresh is
 * eligibility**: the new scalar's style, span and `decoded` flag are Rust's to
 * report, so the honest refresh is a re-projection, which is what
 * {@link MatchEditorView.needsReprojection} tells a caller to do.
 */

import type { TranslationKey } from '../i18n/dictionaries';
import type {
  ContentRevision,
  DraftField,
  MatchDraft,
  MatchId,
  MatchView,
  PresentationNote,
  SaveResult,
  ScalarView
} from '../ipc/types';
import type { DetailFieldName } from './detail';
import { matchEditability, type MatchEditability } from './detail';
import {
  amendDraft,
  canRedo,
  canUndo,
  deepFreeze,
  editDraft,
  isDirty,
  redoDraft,
  savedDraft,
  startDraft,
  structuredDraftRules,
  submissionOf,
  undoDraft,
  type Draft,
  type DraftSubmission,
  type DraftValueRules
} from './draft';
import {
  conflictArm,
  consentForRefusal,
  offeredRefusalChoices,
  refusedArm,
  sendFailureOf,
  submissionIsStale,
  type EditorPhase,
  type SendFailure
} from './editorSave';
import type { RawSaveChoice } from './rawSave';
import type { InvalidationStatus } from './invalidation';
import {
  describeEditSave,
  invalidationFailureMessage,
  type ConflictChoice,
  type ConflictModel,
  type SaveOutcomeMessage,
  type SaveOutcomeModel
} from './saveOutcome';

/**
 * One field this editor can edit, spelled as its espanso key.
 *
 * The keys themselves rather than camel-case names, because that is what
 * `MatchDraft` is keyed by and a second spelling would be a second thing to keep
 * in step. {@link fieldLabelName} maps each to the label the detail pane already
 * has a sentence for.
 */
export type EditableField = 'trigger' | 'replace' | 'label' | 'word' | 'left_word' | 'right_word';

/**
 * The six fields, in the order a screen shows them.
 *
 * Trigger and body first, because they are what a snippet *is*; the label next,
 * because it is what a person calls it; the three word-boundary keys last,
 * because they qualify the trigger rather than state it.
 */
export const EDITABLE_FIELDS: readonly EditableField[] = [
  'trigger',
  'replace',
  'label',
  'word',
  'left_word',
  'right_word'
];

/**
 * Why one field may not be edited.
 *
 * **A code, never a sentence**, which is the rule every model in this directory
 * follows (CLAUDE.md §2): the prose lives in `src/lib/i18n/{en,es}.json` where the
 * two languages are checked against each other, and a component renders one by
 * calling `tFieldRefusal`, never by building a key.
 *
 * A plain union rather than a union of objects, because none of the five carries
 * an operand. `triggerNotSingle` deliberately does not carry the `TriggerKind`
 * that caused it: the sentence says the trigger is not one literal trigger, and a
 * screen that wants to name the shape has `tTriggerKind` for that already.
 */
export type FieldRefusal =
  | 'notDecodable'
  | 'carriageReturn'
  | 'ownsNoBytes'
  | 'unmodelledShape'
  | 'triggerNotSingle';

/**
 * Whether one field may be edited, and why not when it may not.
 *
 * A discriminated union rather than a boolean with a nullable reason, so a
 * refused verdict with no reason is not representable.
 */
export type FieldEligibility =
  | {
      /** The field may be bound to a control. */
      readonly kind: 'editable';
    }
  | {
      /** The field is shown and not edited. */
      readonly kind: 'readOnly';
      /** Why, as a code. */
      readonly reason: FieldRefusal;
    };

/** The one editable verdict, shared rather than rebuilt per field. */
const EDITABLE: FieldEligibility = Object.freeze({ kind: 'editable' as const });

/**
 * What the file held for one field when this session was seeded.
 *
 * **The projection side of the phase's named failure**, and it is not drafted:
 * nothing the person types changes it, undo does not walk through it, and it moves
 * only when a save tells this module what was written.
 */
export interface FieldBaseline {
  /**
   * Whether the file held this key at all.
   *
   * The distinction {@link fieldIntent} turns on, and the reason an absent field
   * left blank writes nothing.
   */
  readonly present: boolean;
  /**
   * The projected logical value, or `''` when the key is absent.
   *
   * `ScalarView.text`, which is the decoder's output and therefore a logical
   * value — never the source slice — for every field this editor will edit,
   * because `decoded === false` is one of the five refusals.
   */
  readonly value: string;
  /** Whether the field may be edited, and why not when it may not. */
  readonly eligibility: FieldEligibility;
}

/** What the file held for all six fields. */
export type MatchBaseline = Readonly<Record<EditableField, FieldBaseline>>;

/**
 * What one field's controls hold now.
 *
 * **The draft side.** This is what `Draft<T>` snapshots, freezes and walks
 * backwards through, so it holds only what the person can change.
 */
export interface FieldBuffer {
  /**
   * Whatever the control holds.
   *
   * **It carries no carriage return, and what enforces that is stated here rather
   * than assumed.** {@link editField} refuses one on the way in, and
   * {@link beginSave} refuses to send one on the way out. What is *not* enforced
   * is the type: `MatchBuffers` is a structural record with no brand, so a caller
   * that builds one by hand and hands it to `editDraft` type-checks. That is why
   * the save-time gate exists and is not merely defensive — the raw editor
   * re-checks at its own boundary because a brand is a cast at bottom, and this
   * path has no brand at all.
   *
   * A **baseline** value may carry one: that is the `carriageReturn` refusal, and
   * such a field is seeded into its buffer, shown, and never sent — its intent is
   * `'Unchanged'` and the gate below looks only at what would be written.
   */
  readonly text: string;
  /**
   * Whether the person asked for the key to be taken away.
   *
   * A flag beside the buffer rather than a third value state: the text is kept so
   * that {@link restoreField} gives back what was there, and so that a removal
   * followed by a restoration is a draft that is clean again rather than one that
   * has silently lost the value.
   */
  readonly removed: boolean;
}

/** What all six fields' controls hold now. */
export type MatchBuffers = Readonly<Record<EditableField, FieldBuffer>>;

/**
 * How this editor compares and snapshots its drafted value.
 *
 * `structuredDraftRules` and nothing narrower: {@link MatchBuffers} has fields, so
 * the snapshot must be a deep copy and a deep freeze. 2c-1a's whole argument for
 * the parameter is this case — mutate one nested field of a value the draft is
 * holding and the base, the current value, the history entry and the consent
 * candidate all change at once, because they are one object.
 */
const BUFFER_RULES: DraftValueRules<MatchBuffers> = structuredDraftRules<MatchBuffers>();

/**
 * A source of milliseconds, injected so a boundary is testable.
 *
 * Never `Date.now` named inside this module, and never a `setTimeout`: a group
 * boundary decided by real time is a boundary a test would have to sleep through.
 * The running application passes `() => Date.now()`.
 *
 * @returns A reading in milliseconds, which must not go backwards within a
 *   session.
 */
export type Clock = () => number;

/**
 * How long a pause ends a run of typing in one field, in milliseconds.
 *
 * **A judgement, not a measurement.** Nothing has been profiled and no session has
 * been timed; seven hundred milliseconds is long enough that ordinary typing in
 * one field stays one undo step and short enough that stopping to think starts a
 * new one. The cost of it being wrong is undo granularity, which is recoverable
 * by pressing undo again — unlike the cost of not coalescing at all, which is
 * history entries the person cannot get back.
 */
export const TYPING_GROUP_IDLE_MS = 700;

/** A run of typing in one field that later keystrokes may still join. */
export interface TypingGroup {
  /** The field being typed into. A different field is a different group. */
  readonly field: EditableField;
  /** The clock reading of the last keystroke recorded in it. */
  readonly at: number;
}

/**
 * One editing session over one snippet's six editable fields.
 *
 * **A value with pure transitions, never a store**, which is 2c-1a's D1 one layer
 * up: a component holds one in a `$state.raw` and reassigns it, and every function
 * below returns a new session without touching its argument.
 */
export interface MatchEditorSession {
  /**
   * The snippet being edited, by the identity this window holds.
   *
   * Moves once, when a committed save answers with the snippet's identity in the
   * new revision. Everything else leaves it alone.
   */
  readonly match: MatchId;
  /**
   * What this application says about editing this snippet at all.
   *
   * `matchEditability`'s answer, taken once from the projection. It is defence in
   * depth beside Rust's own semantic gate, and it is what {@link isEditable}
   * consults before any of the six verdicts are looked at.
   */
  readonly editability: MatchEditability;
  /** What the file held, per field. Not drafted. */
  readonly baseline: MatchBaseline;
  /** What the controls hold, per field. Drafted, with history and consent. */
  readonly draft: Draft<MatchBuffers>;
  /** Whether a save is in flight. */
  readonly phase: EditorPhase;
  /** Which field has the focus, as the screen last reported it. */
  readonly focus: EditableField | null;
  /** The run of typing later keystrokes may join, or `null`. */
  readonly group: TypingGroup | null;
  /** What the last save sent, or `null`. Kept so a refusal can be consented to. */
  readonly submitted: DraftSubmission<MatchBuffers> | null;
  /** How the last save ended, as the thing a screen draws, or `null`. */
  readonly outcome: SaveOutcomeModel<MatchBuffers> | null;
  /**
   * Lines to show **beside** the outcome rather than in place of it.
   *
   * Today exactly one can appear: a committed save whose adoption failed. It is
   * never a replacement for the saved arm — the bytes are on disk (`PROGRESS.md`
   * D2), and what failed is this window's attempt to bring itself back into step.
   */
  readonly extraMessages: readonly SaveOutcomeMessage[];
  /** How the last save failed to produce an outcome at all, or `null`. */
  readonly sendFailure: SendFailure | null;
  /**
   * Whether this session's identity is known to be stale.
   *
   * Set by a committed save that answered no identity in the new revision. The
   * session stops being saveable, because every later call would be refused with
   * an identity code; the draft is untouched, so nothing the person typed is lost
   * and a caller can seed a new session from a fresh projection.
   */
  readonly identityStale: boolean;
  /** Where the group boundary's readings come from. */
  readonly clock: Clock;
}

/**
 * The projected scalar of one editable field, or `null`.
 *
 * A `switch` over the six rather than a lookup table, so a seventh field is a
 * compile error here rather than an `undefined` at run time.
 *
 * @param match - The snippet's projection.
 * @param field - Which field.
 * @returns The scalar the file holds for it, or `null` when it holds none.
 */
export function projectedScalar(match: MatchView, field: EditableField): ScalarView | null {
  switch (field) {
    case 'trigger':
      return match.trigger.trigger;
    case 'replace':
      return match.content.replace;
    case 'label':
      return match.label;
    case 'word':
      return match.options.word;
    case 'left_word':
      return match.options.left_word;
    case 'right_word':
      return match.options.right_word;
  }
} // End of function projectedScalar()

/**
 * The label the detail pane already has a sentence for.
 *
 * Reused rather than duplicated: `browser.detail.field.*` names these six fields
 * in both languages, and a second set of labels would be a second thing to
 * translate and a second thing to disagree.
 *
 * @param field - Which field.
 * @returns The name `tDetailField` renders.
 */
export function fieldLabelName(field: EditableField): DetailFieldName {
  switch (field) {
    case 'trigger':
      return 'trigger';
    case 'replace':
      return 'replace';
    case 'label':
      return 'label';
    case 'word':
      return 'word';
    case 'left_word':
      return 'leftWord';
    case 'right_word':
      return 'rightWord';
  }
} // End of function fieldLabelName()

/**
 * Whether the file writes this key as something this projection did not model.
 *
 * A key the file **has** but whose value is not a scalar reads as absent through
 * {@link projectedScalar}, and treating it as absent would derive an insertion of
 * a key the mapping already holds. The projection does carry the fact — an
 * unmodelled entry is in `unknown_entries` with its decoded key — so the frontend
 * can refuse before the person types rather than after Rust does.
 *
 * A repeated key lands there too, which this refuses for the same reason: which of
 * two `label:` entries a replacement would hit is not a question this editor
 * should be answering.
 *
 * @param match - The snippet's projection.
 * @param field - Which field.
 * @returns `true` when the file has the key and the projection did not model it.
 */
function hasUnmodelledShape(match: MatchView, field: EditableField): boolean {
  return match.unknown_entries.some((entry) => entry.key === field);
} // End of function hasUnmodelledShape()

/**
 * Whether one field may be edited, decided from the projection alone.
 *
 * Called before any value is bound to a control — the consult's change 1 — so the
 * four refusals Rust would answer with, and the one this application adds, are all
 * known in advance rather than discovered after the person has typed.
 *
 * The order of the checks is `plan_scalar`'s own: `decoded` first, because when it
 * is `false` the `text` is the raw source slice and no comparison against it means
 * anything.
 *
 * @param match - The snippet's projection.
 * @param field - Which field.
 * @returns The verdict, with a reason code when it is a refusal.
 */
export function fieldEligibility(match: MatchView, field: EditableField): FieldEligibility {
  if (field === 'trigger' && match.trigger.kind !== 'Single') {
    return { kind: 'readOnly', reason: 'triggerNotSingle' };
  }
  const scalar = projectedScalar(match, field);
  if (scalar === null) {
    return hasUnmodelledShape(match, field)
      ? { kind: 'readOnly', reason: 'unmodelledShape' }
      : EDITABLE;
  }
  if (!scalar.decoded) {
    return { kind: 'readOnly', reason: 'notDecodable' };
  }
  if (scalar.text.includes('\r')) {
    return { kind: 'readOnly', reason: 'carriageReturn' };
  }
  if (scalar.span.start === scalar.span.end) {
    return { kind: 'readOnly', reason: 'ownsNoBytes' };
  }
  return EDITABLE;
} // End of function fieldEligibility()

/**
 * What the file holds for all six fields, and which of them may be edited.
 *
 * @param match - The snippet's projection.
 * @returns The baseline, frozen, so nothing downstream can change what the file
 *   is recorded as having held.
 */
export function baselineOf(match: MatchView): MatchBaseline {
  const baseline: Record<EditableField, FieldBaseline> = {} as Record<
    EditableField,
    FieldBaseline
  >;
  for (const field of EDITABLE_FIELDS) {
    const scalar = projectedScalar(match, field);
    baseline[field] = {
      present: scalar !== null,
      // A field whose scalar could not be decoded is read-only, so its `text` —
      // which is the source slice in that one case — is never treated as a
      // logical value by anything below. It is still carried, because a screen
      // shows what the file says.
      value: scalar === null ? '' : scalar.text,
      eligibility: fieldEligibility(match, field)
    };
  } // End of the loop over the six editable fields
  return deepFreeze(baseline);
} // End of function baselineOf()

/**
 * The buffers a session starts with: exactly what the file holds, nothing removed.
 *
 * @param baseline - What the file holds.
 * @returns The starting buffers.
 */
export function buffersOf(baseline: MatchBaseline): MatchBuffers {
  const buffers: Record<EditableField, FieldBuffer> = {} as Record<EditableField, FieldBuffer>;
  for (const field of EDITABLE_FIELDS) {
    buffers[field] = { text: baseline[field].value, removed: false };
  }
  return buffers;
} // End of function buffersOf()

/**
 * What one field's draft says should happen to it.
 *
 * **The whole of the consult's Q3, and the only thing that reads both sides.**
 * Six rules, and each is stated in this module's own header with the reason it
 * exists; four of them are indistinguishable from one another without the
 * baseline, which is why the baseline is not folded into the buffer.
 *
 * The two guards in front are not decoration. An **ineligible** field always
 * answers `'Unchanged'`, so a buffer that diverged by any route this module did
 * not sanction still contributes no edit — the last line before a value that
 * cannot be given back reaches a file. And a removal of a key the file does not
 * have is `'Unchanged'` rather than `'Remove'`: Rust already treats that pairing
 * as a no-op, so the two agree, and what this adds is that the draft does not
 * claim an edit it does not have.
 *
 * @param baseline - What the file holds for this field.
 * @param buffer - What its controls hold.
 * @returns The tri-state to put in the {@link MatchDraft}.
 */
export function fieldIntent(baseline: FieldBaseline, buffer: FieldBuffer): DraftField<string> {
  if (baseline.eligibility.kind !== 'editable') {
    return 'Unchanged';
  }
  if (buffer.removed) {
    return baseline.present ? 'Remove' : 'Unchanged';
  }
  if (!baseline.present) {
    return buffer.text === '' ? 'Unchanged' : { Set: buffer.text };
  }
  return buffer.text === baseline.value ? 'Unchanged' : { Set: buffer.text };
} // End of function fieldIntent()

/**
 * The whole twenty-two-field draft to send.
 *
 * **An exhaustive literal, and it must stay one.** No property of `MatchDraft` is
 * optional, so a field left out is a compile error and a field added in a later
 * phase breaks this function rather than being silently omitted. A spread over a
 * partial would give both of those away, and what it would buy is six fewer lines.
 *
 * The sixteen fields this editor does not touch and all four lists go out saying
 * *leave this alone*, which is what makes an unedited field's spelling, quoting
 * and surrounding comments survive a save byte for byte.
 *
 * @param baseline - What the file holds.
 * @param buffers - What the controls hold.
 * @returns The draft `save_match` takes.
 */
export function matchDraftOf(baseline: MatchBaseline, buffers: MatchBuffers): MatchDraft {
  return {
    trigger: fieldIntent(baseline.trigger, buffers.trigger),
    regex: 'Unchanged',
    replace: fieldIntent(baseline.replace, buffers.replace),
    markdown: 'Unchanged',
    html: 'Unchanged',
    image_path: 'Unchanged',
    form: 'Unchanged',
    label: fieldIntent(baseline.label, buffers.label),
    comment: 'Unchanged',
    word: fieldIntent(baseline.word, buffers.word),
    left_word: fieldIntent(baseline.left_word, buffers.left_word),
    right_word: fieldIntent(baseline.right_word, buffers.right_word),
    propagate_case: 'Unchanged',
    uppercase_style: 'Unchanged',
    force_mode: 'Unchanged',
    force_clipboard: 'Unchanged',
    paragraph: 'Unchanged',
    anchor: 'Unchanged',
    triggers: [],
    search_terms: [],
    vars: [],
    form_fields: []
  };
} // End of function matchDraftOf()

/**
 * Starts an editing session over one snippet's six fields.
 *
 * The base revision is the snippet's own `id.revision` and is not a separate
 * argument, which closes by construction the pairing hazard 2c-1b had to reason
 * about: a projection and the revision it was minted from are one value here, so
 * they cannot come from two reads and disagree.
 *
 * @param match - The snippet's projection, exactly as this window holds it.
 * @param clock - Where the typing group's boundary readings come from.
 *   **Required**: a default would be `Date.now`, which is the one thing a test
 *   cannot drive.
 * @returns A clean session with no history, no consent and nothing said.
 */
export function startMatchEditor(match: MatchView, clock: Clock): MatchEditorSession {
  const baseline = baselineOf(match);
  return {
    match: match.id,
    editability: matchEditability(match),
    baseline,
    draft: startDraft(match.id.revision, buffersOf(baseline), BUFFER_RULES),
    phase: 'editing',
    focus: null,
    group: null,
    submitted: null,
    outcome: null,
    extraMessages: [],
    sendFailure: null,
    identityStale: false,
    clock
  };
} // End of function startMatchEditor()

/**
 * The conflict the session is showing, or `null`.
 *
 * @param session - The session to ask about.
 * @returns The conflict model, or `null` when the session is not in one.
 */
export function conflictOf(session: MatchEditorSession): ConflictModel<MatchBuffers> | null {
  return conflictArm(session.outcome);
} // End of function conflictOf()

/**
 * Whether this session accepts changes at all right now.
 *
 * Four reasons it may not, and the first two are 2c-1b's policy decisions carried
 * over unchanged: not while a save is in flight, and not while a conflict is
 * showing. The third is this sub-phase's — not after a commit whose identity could
 * not be adopted, because there is nothing left to save against. The fourth is
 * defence in depth: not when this application has said the snippet is not safely
 * editable.
 *
 * @param session - The session to ask about.
 * @returns `true` when any field's controls may change anything.
 */
export function isEditable(session: MatchEditorSession): boolean {
  return (
    session.phase === 'editing' &&
    conflictOf(session) === null &&
    !session.identityStale &&
    session.editability.kind === 'unrestricted'
  );
} // End of function isEditable()

/**
 * Whether one field's control accepts changes right now.
 *
 * The session's own answer and the field's verdict, together. Every transition
 * below goes through it, so a refusal computed from the projection is not merely
 * something a screen is expected to honour.
 *
 * @param session - The session to ask about.
 * @param field - Which field.
 * @returns `true` when {@link editField} would do anything.
 */
export function isFieldEditable(session: MatchEditorSession, field: EditableField): boolean {
  return isEditable(session) && session.baseline[field].eligibility.kind === 'editable';
} // End of function isFieldEditable()

/**
 * The buffers with one field replaced.
 *
 * A named helper rather than a computed-key spread at four call sites: the spread
 * widens the result's type, and this keeps the record exact.
 *
 * @param buffers - What the controls hold.
 * @param field - Which field to replace.
 * @param buffer - What it should hold.
 * @returns The new buffers.
 */
function withField(
  buffers: MatchBuffers,
  field: EditableField,
  buffer: FieldBuffer
): MatchBuffers {
  const next: Record<EditableField, FieldBuffer> = { ...buffers };
  next[field] = buffer;
  return next;
} // End of function withField()

/**
 * Records a change, joining the open typing group or starting a new one.
 *
 * **The whole of the coalescing policy, in one place.** A change joins the group
 * when it is in the same field and within {@link TYPING_GROUP_IDLE_MS} of the last
 * one recorded in it; otherwise it opens a step of its own. Joining uses
 * `amendDraft`, which replaces the current value without pushing history;
 * starting uses `editDraft`, which pushes.
 *
 * The live value moves either way, on every keystroke. What is coalesced is the
 * *snapshot*, and nothing else.
 *
 * **A burst that ends where it began leaves no step**, which is the 2c-2 review's
 * fifth finding: type three characters and erase them again inside the window, and
 * the amendment restored the value the group started from while its history entry
 * stayed — an undo the person could press that changed nothing on screen and only
 * spent a step. `amendDraft` now drops the entry in that case, and the group is
 * closed here rather than left open, because a group whose step no longer exists
 * has nothing left to amend and the next keystroke must push one.
 *
 * @param session - The session being edited.
 * @param field - The field the change is in.
 * @param buffers - What the controls now hold.
 * @returns The session after the change, or the same session when nothing changed.
 */
function recordChange(
  session: MatchEditorSession,
  field: EditableField,
  buffers: MatchBuffers
): MatchEditorSession {
  const now = session.clock();
  const open = session.group;
  const joins = open !== null && open.field === field && now - open.at <= TYPING_GROUP_IDLE_MS;
  const draft = joins ? amendDraft(session.draft, buffers) : editDraft(session.draft, buffers);
  if (draft === session.draft) {
    // Nothing changed, so nothing happened: the group is not extended either, or a
    // no-op keystroke would keep a group alive across an arbitrary pause.
    return session;
  }
  // The amendment collapsed its own step: the burst is back where it started, the
  // history entry is gone, and there is nothing for a later keystroke to amend.
  const collapsed = joins && draft.past.length < session.draft.past.length;
  return {
    ...session,
    draft,
    focus: field,
    group: collapsed ? null : { field, at: now },
    sendFailure: null
  };
} // End of function recordChange()

/**
 * Records whatever one field's control now holds.
 *
 * **A value carrying a carriage return is refused here as well as at the
 * verdict**, and the redundancy is deliberate for the reason 2c-1b's `editText`
 * gives: the verdict is a statement about the projection, and this is a statement
 * about this function. A control cannot produce one — its value has every line
 * break normalised — so what this closes is a caller that is not a control.
 *
 * Typing into a field the person had asked to remove takes the removal back: they
 * have said what they want the key to hold, which is not "gone".
 *
 * @param session - The session being edited.
 * @param field - Which field.
 * @param text - The control's whole value.
 * @returns The session after the edit, or the same session when the field is not
 *   accepting changes, the text carries a carriage return, or nothing changed.
 */
export function editField(
  session: MatchEditorSession,
  field: EditableField,
  text: string
): MatchEditorSession {
  if (!isFieldEditable(session, field) || text.includes('\r')) {
    return session;
  }
  return recordChange(session, field, withField(session.draft.value, field, { text, removed: false }));
} // End of function editField()

/**
 * Asks for one field's key to be taken out of the file.
 *
 * A structural action, so it ends the typing group and is always its own history
 * step. Refused for a key the file does not have: there is nothing to remove, and
 * a control offering it would be offering to do nothing.
 *
 * The buffer's text is **kept**, so {@link restoreField} gives back what was
 * there rather than an empty box.
 *
 * @param session - The session being edited.
 * @param field - Which field.
 * @returns The session with the removal drafted, or the same session.
 */
export function removeField(
  session: MatchEditorSession,
  field: EditableField
): MatchEditorSession {
  if (!isFieldEditable(session, field) || !session.baseline[field].present) {
    return session;
  }
  const buffer = session.draft.value[field];
  if (buffer.removed) {
    return session;
  }
  const draft = editDraft(session.draft, withField(session.draft.value, field, { ...buffer, removed: true }));
  return { ...session, draft, group: null, sendFailure: null };
} // End of function removeField()

/**
 * Takes back a removal, leaving the field holding what it held.
 *
 * @param session - The session being edited.
 * @param field - Which field.
 * @returns The session with the removal withdrawn, or the same session.
 */
export function restoreField(
  session: MatchEditorSession,
  field: EditableField
): MatchEditorSession {
  if (!isFieldEditable(session, field)) {
    return session;
  }
  const buffer = session.draft.value[field];
  if (!buffer.removed) {
    return session;
  }
  const draft = editDraft(session.draft, withField(session.draft.value, field, { ...buffer, removed: false }));
  return { ...session, draft, group: null, sendFailure: null };
} // End of function restoreField()

/**
 * Records which field has the focus, ending the typing group when it moves.
 *
 * Two of the consult's four boundaries in one transition: a blur is
 * `focusField(session, null)` and a change of focused field is a call naming a
 * different one. Focusing the field that already has the focus changes nothing, so
 * a spurious focus event does not split an undo step.
 *
 * @param session - The session.
 * @param field - The field that now has the focus, or `null` for a blur.
 * @returns The session with the focus recorded and the group closed when it moved.
 */
export function focusField(
  session: MatchEditorSession,
  field: EditableField | null
): MatchEditorSession {
  if (session.focus === field) {
    return session;
  }
  return { ...session, focus: field, group: null };
} // End of function focusField()

/**
 * Goes back one step.
 *
 * A structural action, so the typing group ends: a keystroke after an undo starts
 * a step of its own rather than amending the value the undo restored.
 *
 * @param session - The session to undo.
 * @returns The session one step back, or the same session when there is nothing to
 *   undo or it is not accepting changes.
 */
export function undoEdit(session: MatchEditorSession): MatchEditorSession {
  if (!isEditable(session)) {
    return session;
  }
  const draft = undoDraft(session.draft);
  return draft === session.draft
    ? session
    : { ...session, draft, group: null, sendFailure: null };
} // End of function undoEdit()

/**
 * Goes forward one step, undoing an undo.
 *
 * @param session - The session to redo.
 * @returns The session one step forward, or the same session when there is nothing
 *   to redo or it is not accepting changes.
 */
export function redoEdit(session: MatchEditorSession): MatchEditorSession {
  if (!isEditable(session)) {
    return session;
  }
  const draft = redoDraft(session.draft);
  return draft === session.draft
    ? session
    : { ...session, draft, group: null, sendFailure: null };
} // End of function redoEdit()

/**
 * Whether the findings on screen are about the draft the session still holds.
 *
 * @param session - The session to ask about.
 * @returns `true` when a save has been answered and the draft has moved on since.
 */
export function outcomeIsStale(session: MatchEditorSession): boolean {
  return submissionIsStale(session.draft, session.submitted);
} // End of function outcomeIsStale()

/**
 * Whether a save may be started.
 *
 * **Gated on dirty**, so the control cannot send a draft byte-identical to what
 * the file holds — a legal save that would take the lock, reparse the file and
 * write a backup batch marker for nothing.
 *
 * Dirty here means *the buffers differ from what the file held*, and it implies
 * that at least one field's intent is not `'Unchanged'`: every way a buffer can
 * differ from its baseline produces a `Set` or a `Remove`. The converse is what
 * matters and is not assumed — a draft with nothing to say cannot be sent.
 *
 * @param session - The session to ask about.
 * @returns `true` when {@link beginSave} would produce a submission.
 */
export function canSave(session: MatchEditorSession): boolean {
  return isEditable(session) && isDirty(session.draft);
} // End of function canSave()

/** A save about to be sent: the session that is waiting, and what to send. */
export interface StartedMatchSave {
  /** The session, now in flight, with the submission recorded on it. */
  readonly session: MatchEditorSession;
  /**
   * What was drafted, for the acknowledgement round trip and the history
   * boundary.
   *
   * Its `acknowledgement` is whatever consent is bound to **this exact candidate**
   * and `EMPTY_ACKNOWLEDGEMENT` otherwise; `submissionOf` is the only place the two
   * are put together.
   */
  readonly submission: DraftSubmission<MatchBuffers>;
  /** The twenty-two-field draft to hand `saveMatch`. */
  readonly draft: MatchDraft;
}

/**
 * Whether a draft would write a value carrying a carriage return.
 *
 * **It asks the derived draft, not the buffers**, and the difference is the whole
 * point: a field refused for `carriageReturn` has that character in its *baseline*
 * and therefore in its buffer, legitimately, and its intent is `'Unchanged'` so
 * nothing of it reaches the file. What must never reach the file is a `Set`
 * carrying one, because Rust would write it and no control in this window could
 * ever read it back.
 *
 * @param draft - The draft that would be sent.
 * @returns `true` when some field would be written with a carriage return in it.
 */
function writesACarriageReturn(draft: MatchDraft): boolean {
  return EDITABLE_FIELDS.some((field) => {
    const intent = draft[field];
    return typeof intent === 'object' && intent.Set.includes('\r');
  });
} // End of function writesACarriageReturn()

/**
 * Starts a save of the draft as it stands.
 *
 * The wire draft is built here, from the submission's own candidate rather than
 * from the session, so the three values that travel together — the candidate, the
 * consent bound to it, and the `MatchDraft` derived from it — cannot describe two
 * different things.
 *
 * **The carriage-return check is repeated here, at the boundary that matters, and
 * it is not redundant.** `editField` refuses one on the way in, but
 * {@link MatchBuffers} is a structural record with **no brand**: `editDraft(
 * session.draft, { …, replace: { text: 'a\rb', removed: false } })` type-checks
 * today, and without this gate that value would reach `save_match` as
 * `{ Set: 'a\rb' }` and be written into the user's file. The raw editor re-checks
 * at the same point because its brand is a cast at bottom; this path has no brand
 * at all, so it needs the gate more rather than less.
 *
 * **What this cannot do is explain itself.** It answers `null`, which a screen
 * reads as *there is nothing to save*, and no signature here can carry a reason to
 * a control that was never drawn for a field this session refused. A caller that
 * reaches this state has driven the state machine through a door
 * {@link fieldEligibility} and {@link editField} both close.
 *
 * @param session - The session to save.
 * @returns The waiting session, the submission and the draft, or `null` when there
 *   is nothing to save or the draft would write a value this window could not read
 *   back.
 */
export function beginSave(session: MatchEditorSession): StartedMatchSave | null {
  if (!canSave(session)) {
    return null;
  }
  const submission = submissionOf(session.draft);
  const draft = matchDraftOf(session.baseline, submission.candidate);
  if (writesACarriageReturn(draft)) {
    return null;
  }
  return {
    session: {
      ...session,
      phase: 'saving',
      submitted: submission,
      group: null,
      sendFailure: null
    },
    submission,
    draft
  };
} // End of function beginSave()

/**
 * The baselines a committed save leaves behind.
 *
 * What was written becomes what the file holds: a field that was inserted is
 * present and holds the buffer's text, and a field that was removed is absent and
 * holds nothing. A field the draft said nothing about is untouched.
 *
 * **Eligibility is carried over rather than recomputed**, and that is a limit
 * rather than a claim: the new scalar's style, span and `decoded` flag are facts
 * about bytes only Rust has seen. The honest refresh is a re-projection, which
 * {@link MatchEditorView.needsReprojection} asks the caller for.
 *
 * @param baseline - What the file held before the save.
 * @param buffers - The candidate that was written.
 * @returns The baselines to measure the next edit against.
 */
function committedBaseline(baseline: MatchBaseline, buffers: MatchBuffers): MatchBaseline {
  const next: Record<EditableField, FieldBaseline> = {} as Record<EditableField, FieldBaseline>;
  for (const field of EDITABLE_FIELDS) {
    const was = baseline[field];
    const intent = fieldIntent(was, buffers[field]);
    if (intent === 'Unchanged') {
      next[field] = was;
    } else if (intent === 'Remove') {
      next[field] = { ...was, present: false, value: '' };
    } else {
      next[field] = { ...was, present: true, value: intent.Set };
    }
  } // End of the loop over the six editable fields
  return deepFreeze(next);
} // End of function committedBaseline()

/**
 * Takes a save's answer.
 *
 * **Not sealed, and that is not an omission.** The seal of `./invalidation.ts`
 * exists because a whole-document replacement makes *every* identity in the file
 * stale with no single identity to answer with. A field save has one:
 * `SavedResult.moved` is this snippet in the new revision, so the invalidation is
 * an adoption and `BrowserState.saveMatch` performs it before this is ever called.
 *
 * Three things happen on a `saved` arm, and each closes a way this could be wrong:
 *
 * - the **identity is adopted**, so a second save is checked against the revision
 *   the file now holds rather than the one it held. A commit that answered no
 *   identity sets {@link MatchEditorSession.identityStale} instead, and the
 *   session stops offering to save;
 * - the **baselines move to what was written**, so the absent-and-blank rule stops
 *   applying to a field this very save made present. Without it, clearing a label
 *   the same session had just inserted would silently write nothing;
 * - the **draft's base moves to the candidate that was sent**, through
 *   `savedDraft`, which also cuts the history at the step that was saved. Nothing
 *   is lost by that here — this editor is read-only while a save is in flight, so
 *   there are no steps after the submitted one to keep.
 *
 * Nothing here is conditional on `committed`: a `committed: false` is a documented
 * success — the candidate was byte-identical to what the file already held — and
 * it moves the base for the same reason a write does.
 *
 * **A failed adoption is a line beside the outcome, never in place of it.** The
 * wrapper answers `adoption: { kind: 'failed' }` when the file was written and this
 * window could not read it back, and that reaches a screen as *the file was written
 * and this window is out of step* through the sentence `saveOutcome.ts` already
 * owns. Telling the person the save failed would invite a retry of a write that
 * already happened (`PROGRESS.md` D2). It also makes the identity stale by
 * definition — there is no fresh projection to adopt one from — so the session
 * stops offering to save, exactly as a commit with no `moved` does.
 *
 * @param session - The session waiting for an answer.
 * @param result - How the save ended, exactly as the transaction reported it.
 * @param adoption - What became of the adoption, from `BrowserState.saveMatch`.
 *   Required and not defaulted: a default would be this function inventing a
 *   `notOwed` for a caller that simply did not look.
 * @returns The session showing what the save ended as.
 */
export function applySave(
  session: MatchEditorSession,
  result: SaveResult,
  adoption: InvalidationStatus
): MatchEditorSession {
  const submission = session.submitted;
  if (submission === null) {
    return session;
  }
  const outcome = describeEditSave(result, session.draft);
  const failed = invalidationFailureMessage(adoption);
  const extraMessages = failed === null ? [] : [failed];
  if (result.outcome !== 'saved') {
    return {
      ...session,
      phase: 'editing',
      group: null,
      outcome,
      extraMessages,
      sendFailure: null
    };
  }
  return {
    ...session,
    match: result.moved ?? session.match,
    // Stale when the commit answered no identity, and stale when the adoption
    // failed: in the second case the window holds no projection of that file at
    // all, so there is nothing an identity could be resolved against.
    identityStale: result.committed && (result.moved === null || adoption.kind === 'failed'),
    baseline: committedBaseline(session.baseline, submission.candidate),
    draft: savedDraft(session.draft, submission, result.revision),
    phase: 'editing',
    group: null,
    outcome,
    extraMessages,
    sendFailure: null
  };
} // End of function applySave()

/**
 * Records that the save produced no outcome.
 *
 * **Not an outcome, and not always "nothing was written".** The command failed
 * before any of the three arms existed and the reason went to the workspace's own
 * failure channel. Whether the file changed is a **second** question, and the only
 * honest answers are "no" and "this application cannot tell". The draft is
 * untouched either way, so nothing the person typed is lost.
 *
 * @param session - The session waiting for an answer.
 * @param mayHaveWritten - Whether the file may already hold the submitted draft.
 * @returns The session, back to editing, with the right notice raised.
 */
export function saveCouldNotBeSent(
  session: MatchEditorSession,
  mayHaveWritten: boolean
): MatchEditorSession {
  return {
    ...session,
    phase: 'editing',
    group: null,
    sendFailure: sendFailureOf(mayHaveWritten)
  };
} // End of function saveCouldNotBeSent()

/**
 * Records that the person accepted the findings of the refusal on screen.
 *
 * Delegates to `consentForRefusal`, which delegates to `acknowledgeRefusal` — the
 * **only** producer of consent in this application. The submission is taken from
 * the session rather than from an argument, so a caller cannot pair one candidate's
 * acknowledgement with another candidate.
 *
 * @param session - The session showing a refusal.
 * @returns The session carrying consent, or the same session.
 */
export function acknowledgeFindings(session: MatchEditorSession): MatchEditorSession {
  const draft = consentForRefusal(session.draft, session.submitted, session.outcome);
  return draft === session.draft ? session : { ...session, draft };
} // End of function acknowledgeFindings()

/**
 * Puts the outcome away and gives the controls back.
 *
 * *Keep editing*, for all three arms. The draft is untouched — this is a panel
 * being dismissed, not a state being resolved — and the submission goes with it,
 * because there is nothing left on screen to acknowledge.
 *
 * @param session - The session showing an outcome.
 * @returns The session with nothing being said about the last save.
 */
export function keepEditing(session: MatchEditorSession): MatchEditorSession {
  return {
    ...session,
    submitted: null,
    outcome: null,
    extraMessages: [],
    group: null,
    sendFailure: null
  };
} // End of function keepEditing()

/**
 * The choices a conflict offers in this sub-phase.
 *
 * **One**, and the two that are missing are missing on purpose. *Copy draft*
 * copies a text, and this editor's draft is six fields rather than a document.
 * *Load the version on disk* would have to re-seed the baselines from a fresh
 * projection, which is conflict capture and preservation — Phase 2c-4a — and doing
 * a rough version of it here would make that phase look already done.
 *
 * **None of these is "keep my draft"** and none may become one: that phrase means
 * *reapply the draft to the newly parsed document*, which is 2c-4b.
 */
const CONFLICT_CHOICES: readonly ConflictChoice[] = ['keepEditing'];

/** Everything a screen needs about one field, derived on every read. */
export interface EditableFieldModel {
  /** Which field, as its espanso key. */
  readonly field: EditableField;
  /** The name `tDetailField` renders as its label. */
  readonly label: DetailFieldName;
  /** What the control shows. */
  readonly text: string;
  /** Whether the file held this key when the session was seeded. */
  readonly present: boolean;
  /** Whether the person has asked for the key to be taken away. */
  readonly removed: boolean;
  /** Whether the control accepts changes. */
  readonly editable: boolean;
  /** Why it does not, as a code, or `null`. */
  readonly refusal: FieldRefusal | null;
  /** What a save would say about this field. */
  readonly intent: DraftField<string>;
  /** Whether a *Remove* control would do anything. */
  readonly canRemove: boolean;
  /** Whether a *Restore* control would do anything. */
  readonly canRestore: boolean;
}

/** Everything a screen needs about one session, derived on every read. */
export interface MatchEditorView {
  /** The six fields, in {@link EDITABLE_FIELDS} order. */
  readonly fields: readonly EditableFieldModel[];
  /** Whether the draft differs from what the file held. Derived. */
  readonly dirty: boolean;
  /** Whether there is a step to go back to. Derived. */
  readonly canUndo: boolean;
  /** Whether there is an undone step to go forward to. Derived. */
  readonly canRedo: boolean;
  /** Whether a save is in flight. */
  readonly saving: boolean;
  /** Whether the session accepts changes at all. */
  readonly editable: boolean;
  /** What this application says about editing this snippet at all. */
  readonly editability: MatchEditability;
  /** Whether the save control does anything. */
  readonly canSave: boolean;
  /** How the last attempt failed to produce an outcome, or `null`. */
  readonly sendFailure: SendFailure | null;
  /** How the last save ended, or `null`. */
  readonly outcome: SaveOutcomeModel<MatchBuffers> | null;
  /** The outcome's lines followed by anything to be said beside them. */
  readonly messages: readonly SaveOutcomeMessage[];
  /** The presentation changes a saved arm disclosed, in report order. */
  readonly notes: readonly PresentationNote[];
  /** What to offer about a refusal, withdrawn once its findings are stale. */
  readonly refusalChoices: readonly RawSaveChoice[];
  /** Whether the findings on screen are about a draft that has since changed. */
  readonly findingsAreStale: boolean;
  /** The conflict being shown, or `null`. */
  readonly conflict: ConflictModel<MatchBuffers> | null;
  /** What to offer about the conflict. */
  readonly conflictChoices: readonly ConflictChoice[];
  /** Whether this session's identity is known to be stale. */
  readonly identityStale: boolean;
  /**
   * Whether the caller should seed a new session from a fresh projection.
   *
   * `true` after a commit. The baselines this session rebased are what was
   * *written*, which is correct about presence and values and says nothing about
   * the new scalars' spelling, spans or decodability — so eligibility is the one
   * thing only a re-projection can refresh.
   */
  readonly needsReprojection: boolean;
}

/**
 * Everything a screen needs about one field.
 *
 * @param session - The session to describe.
 * @param field - Which field.
 * @returns The field's model.
 */
function fieldModel(session: MatchEditorSession, field: EditableField): EditableFieldModel {
  const baseline = session.baseline[field];
  const buffer = session.draft.value[field];
  const editable = isFieldEditable(session, field);
  return {
    field,
    label: fieldLabelName(field),
    text: buffer.text,
    present: baseline.present,
    removed: buffer.removed,
    editable,
    refusal: baseline.eligibility.kind === 'readOnly' ? baseline.eligibility.reason : null,
    intent: fieldIntent(baseline, buffer),
    canRemove: editable && baseline.present && !buffer.removed,
    canRestore: editable && buffer.removed
  };
} // End of function fieldModel()

/**
 * Everything a screen needs about one session.
 *
 * Derived on every call and stored nowhere, which is 2c-1a's D2 carried up: a
 * `dirty` this module cached would be a second answer to a question the draft
 * already answers, and the two would eventually disagree.
 *
 * @param session - The session to describe.
 * @returns The view.
 */
export function matchEditorView(session: MatchEditorSession): MatchEditorView {
  const outcome = session.outcome;
  const refused = refusedArm(outcome);
  const stale = outcomeIsStale(session);
  const conflict = conflictOf(session);
  const saved = outcome !== null && outcome.kind === 'saved' ? outcome : null;
  return {
    fields: EDITABLE_FIELDS.map((field) => fieldModel(session, field)),
    dirty: isDirty(session.draft),
    canUndo: canUndo(session.draft),
    canRedo: canRedo(session.draft),
    saving: session.phase === 'saving',
    editable: isEditable(session),
    editability: session.editability,
    canSave: canSave(session),
    sendFailure: session.sendFailure,
    outcome,
    messages: outcome === null ? [] : [...outcome.messages, ...session.extraMessages],
    notes: saved === null ? [] : saved.notes,
    refusalChoices: offeredRefusalChoices(refused, stale),
    findingsAreStale: refused !== null && stale,
    conflict,
    conflictChoices: conflict === null ? [] : CONFLICT_CHOICES,
    identityStale: session.identityStale,
    needsReprojection: saved !== null && saved.committed
  };
} // End of function matchEditorView()

/**
 * The dictionary key holding one refusal's sentence.
 *
 * A `switch` over literal keys rather than a template, the idiom of every other
 * describer in this directory: a renamed key is a compile error here, and a new
 * member of {@link FieldRefusal} with no sentence is one too.
 *
 * @param reason - Why the field may not be edited.
 * @returns The key holding that reason's sentence.
 */
export function fieldRefusalKey(reason: FieldRefusal): TranslationKey {
  switch (reason) {
    case 'notDecodable':
      return 'browser.matchEditor.readOnly.notDecodable';
    case 'carriageReturn':
      return 'browser.matchEditor.readOnly.carriageReturn';
    case 'ownsNoBytes':
      return 'browser.matchEditor.readOnly.ownsNoBytes';
    case 'unmodelledShape':
      return 'browser.matchEditor.readOnly.unmodelledShape';
    case 'triggerNotSingle':
      return 'browser.matchEditor.readOnly.triggerNotSingle';
  }
} // End of function fieldRefusalKey()

/**
 * The base revision one session would save against.
 *
 * A named read rather than a property walk at the call site, so the one place a
 * screen hands a revision to the boundary is a place this module can be searched
 * for.
 *
 * @param session - The session to ask about.
 * @returns The revision the draft was seeded from, and the one a save sends.
 */
export function baseRevisionOf(session: MatchEditorSession): ContentRevision {
  return session.draft.baseRevision;
} // End of function baseRevisionOf()
