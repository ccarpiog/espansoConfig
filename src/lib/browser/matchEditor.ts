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
 * ## The carriage return, three times
 *
 * A `replace: "a\rb"` decodes to a logical value holding a **real** carriage
 * return, and a browser text control does not give one back. So binding such a
 * value to a control and reading it back silently corrupts it, and the corruption
 * is invisible: the save reports that the bytes written are exactly the bytes
 * sent, which is true and is not the point.
 *
 * **What the controls actually do is now measured rather than assumed**, in this
 * application's own WKWebView (`docs/decisions/2c-2-2-window-reading.md` §6), and
 * the two are not the same normalisation:
 *
 * - a `<textarea>` assigned `"x\ry\r\nz"` reads back `"x\ny\nz"` — a bare CR and a
 *   CRLF both collapse to one LF, which is the HTML API value the spec describes
 *   and what 2c-1b found;
 * - an `<input type="text">` assigned `"p\rq"` reads back `"pq"` — it **deletes**
 *   the character rather than converting it, so three characters become two.
 *
 * That is the complete answer to the design consult's Q7 as far as a window can
 * give one: **no control in this editor can produce a carriage return**, in either
 * direction. The gates below therefore protect against a caller that is not a
 * control, which is exactly what the third of them was written for.
 *
 * The consult chose policy (i) — make such a value visibly read-only — over
 * "submit only when something else changed", which mistakes a deliberate
 * carriage-return-to-line-feed edit for no change, and over normalising, which
 * contradicts the preservation promise outright. It is enforced in **three**
 * places: {@link fieldEligibility} refuses the field before anything is bound,
 * {@link editField} refuses a value carrying one on the way in, and
 * {@link beginSave} refuses to send one on the way out. The first is a statement
 * about the projection and the second about that function; the third is the one
 * that is load-bearing rather than defensive, because {@link MatchBuffers} carries
 * **no brand** and a caller that builds one by hand type-checks. This header said
 * *two* until 2c-2-2 and the third gate was already there — the same
 * documentation-versus-code mismatch the decision record calls this project's
 * worst defect class.
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
 * report, so the honest refresh is a re-projection, and
 * {@link MatchEditorSession.needsReprojection} does not merely *ask* for one —
 * the session stops accepting changes until it has one, and no transition here
 * clears the flag. Only {@link startMatchEditor} over a freshly projected snippet
 * does. That is the 2c-2-2 review's second finding: while the fact was derived
 * from the saved *panel*, dismissing the panel dismissed the obligation with it.
 */

import type { TranslationKey } from '../i18n/dictionaries';
import type { IpcFailure } from '../ipc/errors';
import type {
  Acknowledgement,
  ContentRevision,
  DraftField,
  MatchDraft,
  MatchId,
  MatchView,
  PresentationNote,
  SaveResult,
  ScalarView,
  ValueKind,
  ValueView
} from '../ipc/types';
import type { DetailFieldName } from './detail';
import { matchEditability, type MatchEditability } from './detail';
import {
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
import { recordTyping, TYPING_GROUP_IDLE_MS, type Clock, type TypingRun } from './typing';
import {
  conflictArm,
  consentForRefusal,
  offeredReloadStep,
  offeredRefusalChoices,
  reloadAsked,
  reloadConfirmed,
  refusedArm,
  sendFailureLines,
  sendFailureOf,
  spendTheConfirmedReload,
  submissionIsStale,
  NOT_RELOADING,
  type AdoptTheDiskVersion,
  type EditorPhase,
  type ReloadStep,
  type SendFailure,
  type SendFailureLine
} from './editorSave';
import type { RawSaveChoice } from './rawSave';
import type { InvalidationStatus } from './invalidation';
import {
  conflictChoicesFor,
  describeEditSave,
  invalidationFailureMessage,
  type ConflictCapabilities,
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
 * One piece of what the file holds for a field a screen may not edit.
 *
 * **A refused field is read-only, not blank**, and until the 2c-2-2 window
 * reading it was blank for one refusal in particular. A `triggers:` list has no
 * single scalar behind `trigger:`, so the field's own `text` was `''` and the
 * screen drew a name and a reason with nothing between them — and because the
 * editor replaces the whole detail pane, a person editing a multi-trigger snippet
 * could not see their triggers **anywhere**. The record is
 * `docs/decisions/2c-2-2-window-reading.md` §5.1, measured as
 * `open triggersOnScreen: no`.
 *
 * Two arms, because a trigger list may hold something that is not a scalar. An
 * item this projection did not model as text is named by its **shape** rather
 * than dropped: a screen that silently omitted it would be the same defect one
 * level down.
 */
export type ShownValue =
  | {
      /** Source text, drawn exactly as the file writes it. */
      readonly kind: 'text';
      /** What to hand `SourceText`. */
      readonly text: string;
      /** Which key this came from, or `null`. See {@link ShownValue}. */
      readonly source: DetailFieldName | null;
    }
  | {
      /** A value that is not one piece of text, named rather than drawn. */
      readonly kind: 'notScalar';
      /** What to hand `tValueKind`. */
      readonly shape: ValueKind;
      /** Which key this came from, or `null`. See {@link ShownValue}. */
      readonly source: DetailFieldName | null;
    };

/**
 * What one projected value is, as a shape a sentence can name.
 *
 * `flattenValue` in `./detail.ts` walks the same union into lines; this answers
 * the one question a marker needs, which is a different question and a much
 * smaller one.
 *
 * @param value - A projected value as it crossed the boundary.
 * @returns The shape to name it by.
 */
function shapeOf(value: ValueView): ValueKind {
  if ('Scalar' in value) {
    return 'Scalar';
  }
  if ('Sequence' in value) {
    return 'Sequence';
  }
  if ('Mapping' in value) {
    return 'Mapping';
  }
  return 'Alias' in value ? 'Alias' : value.Elided.kind;
} // End of function shapeOf()

/**
 * Where the file puts one projected value, or `null`.
 *
 * **Three of the five arms of `ValueView` carry a byte span and two do not**: a
 * scalar, an alias and an elided node each name their own bytes, while a nested
 * sequence or mapping crosses as its items and nothing else. So the `null` is a
 * fact about the **type**, and it is unreachable through the one caller below —
 * `scalar_sequence()` in `crates/espansoconfig-core/src/model/project.rs` is the
 * only writer of `TriggerSpec::triggers`, and it turns an item that is not a
 * scalar into a `ValueView::Elided` carrying that item's own span rather than
 * into a `Sequence` or a `Mapping`.
 *
 * @param value - A projected value as it crossed the boundary.
 * @returns The first byte of the value, or `null` when the wire carries none —
 *   which no projection of a `triggers:` list produces today.
 */
function spanStartOf(value: ValueView): number | null {
  if ('Scalar' in value) {
    return value.Scalar.span.start;
  }
  if ('Alias' in value) {
    return value.Alias.span.start;
  }
  return 'Elided' in value ? value.Elided.span.start : null;
} // End of function spanStartOf()

/**
 * One item of a trigger list, as the thing a screen draws.
 *
 * @param value - The item as it crossed the boundary.
 * @param source - Which key it came from.
 * @returns Its text when it is a scalar, its shape when it is not.
 */
function shownItem(value: ValueView, source: DetailFieldName): ShownValue {
  return 'Scalar' in value
    ? { kind: 'text', text: value.Scalar.text, source }
    : { kind: 'notScalar', shape: shapeOf(value), source };
} // End of function shownItem()

/**
 * One trigger form's values, together with where the file puts that form.
 *
 * A form rather than a value, because the three forms are what have to be
 * ordered against one another: the items *inside* a `triggers:` list already
 * cross in the order the file writes them, and nothing here re-sorts them.
 */
interface ShownForm {
  /**
   * The first byte of the form's value, or `null` when the wire carries none.
   *
   * `null` is representable and is not produced: see {@link spanStartOf}.
   */
  readonly position: number | null;
  /** What that form contributes, in the order the wire carries it. */
  readonly values: readonly ShownValue[];
}

/**
 * The three trigger forms, put in the order the file writes them.
 *
 * **A stable partition rather than a sort with an invented key for the unknowns.**
 * A form whose position the projection carries is placed by that position; a form
 * it carries none for keeps its place relative to the other unpositioned forms and
 * is drawn after all the positioned ones. Giving an unpositioned form a numeric
 * key — zero, or a maximum — would be this function inventing a location for a
 * value it has just admitted it cannot locate.
 *
 * **The second half of that is defence against a shape the type permits, and no
 * projection produces it** ({@link spanStartOf}), so the branch is unreachable
 * from the running application and is kept rather than removed because
 * `ValueView` has five arms whether or not today's single Rust writer uses two of
 * them, and a `MatchView` is a boundary value nothing in TypeScript proves came
 * from that writer. What this function therefore guarantees in practice is the
 * first half alone: **the forms come out in the order the file writes them.**
 *
 * @param forms - The contributing forms, in the fixed order `trigger`,
 *   `triggers`, `regex`.
 * @returns The same forms, positioned ones first and in byte order.
 */
function orderedForms(forms: readonly ShownForm[]): readonly ShownForm[] {
  const placed: { readonly position: number; readonly form: ShownForm }[] = [];
  const unplaced: ShownForm[] = [];
  for (const form of forms) {
    if (form.position === null) {
      unplaced.push(form);
    } else {
      placed.push({ position: form.position, form });
    }
  } // End of the loop that separates the located forms from the rest
  placed.sort((left, right) => left.position - right.position);
  return [...placed.map((one) => one.form), ...unplaced];
} // End of function orderedForms()

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
  /**
   * What the file holds here, for a field no control will draw.
   *
   * Empty for an editable field — a control shows that value — and empty for a
   * refusal that genuinely has nothing to show. Otherwise every piece of it: **a
   * `triggers:` list contributes one entry per trigger**, not one for the list.
   *
   * **The order is {@link shownValuesOf}'s and is stated there in full**, because
   * it is not simply the order the projection's fields happen to be read in: the
   * three trigger forms are placed by the first byte of each form's value, so they
   * come out in the order the file writes them. (That function also documents a
   * partition for a form carrying no byte position, which the type permits and no
   * projection produces.)
   */
  readonly shown: readonly ShownValue[];
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
 * **Re-exported rather than declared here since 2c-3a**, when the coalescing
 * policy moved to `./typing.ts` so that the creation form of 2c-3a could hold the
 * same rule rather than a second copy of it. `MatchEditor.svelte` imports this
 * name from this module, so it keeps answering here.
 */
export type { Clock };

/**
 * How long a pause ends a run of typing in one field, in milliseconds.
 *
 * Re-exported from `./typing.ts`, which owns the boundary both editors share.
 */
export { TYPING_GROUP_IDLE_MS };

/**
 * A run of typing in one field that later keystrokes may still join.
 *
 * The shared {@link TypingRun} named over this editor's own field union, so the
 * session's shape is unchanged by the 2c-3a extraction.
 */
export type TypingGroup = TypingRun<EditableField>;

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
   * How far a confirmed reload of the disk version has got.
   *
   * **Reset to `idle` by every new outcome and by every dismissal**, which is what
   * stops a confirmation collected for one conflict from being spendable while a
   * later one is on screen. The window refuses a spent confirmation too, but this
   * is the guard that means the situation never arises.
   */
  readonly reload: ReloadStep;
  /**
   * Whether a confirmed reload has ended this session.
   *
   * **The match-level reload result the consult's Q3 ruled**: install the disk
   * projection and *close* the editor, never re-seed "the same" snippet from a
   * fresh projection — identifying a match across revisions is 2c-4b. The panel
   * that reads this closes itself; everything here refuses once it is `true`.
   */
  readonly closed: boolean;
  /**
   * Whether this session's identity is known to be stale.
   *
   * Set by a committed save that answered no identity in the new revision. The
   * session stops being saveable, because every later call would be refused with
   * an identity code; the draft is untouched, so nothing the person typed is lost
   * and a caller can seed a new session from a fresh projection.
   */
  readonly identityStale: boolean;
  /**
   * Whether a re-projection is owed before editing may continue.
   *
   * **On the session rather than derived from the outcome, and that is the whole
   * of the 2c-2-2 review's second finding.** It was derived — `saved !== null &&
   * saved.committed` — which made it a property of a *panel*: dismissing the
   * saved panel through {@link keepEditing} cleared the outcome, and with it the
   * only trace of the obligation, and the session went on editing against
   * eligibility carried over from bytes that no longer exist.
   *
   * Set by a committed save and cleared by **nothing** — not by `keepEditing`,
   * not by an undo. The only way out is {@link startMatchEditor} over a freshly
   * projected snippet, which is what makes the recorded protocol a rule rather
   * than a request. {@link isEditable} is `false` for as long as it is `true`.
   */
  readonly needsReprojection: boolean;
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
 * What the file holds for one field a screen will not let anybody edit.
 *
 * **Wherever a value exists, it is shown**, which is the 2c-2-2 window reading's
 * first finding. Three sources, one arm each below:
 *
 * - a refused **trigger** is the whole trigger spec, not the `trigger:` key: a
 *   `triggers:` list contributes **every** trigger, a `regex:` contributes its
 *   pattern, and a `Several` contributes all of them. This is the arm the reading
 *   found blank, and the order it comes out in is the paragraph below;
 * - an **unmodelled** key is the bytes the projection kept for it —
 *   `UnknownEntry.value_text`, sliced in Rust, which is the same text the detail
 *   pane draws for such an entry;
 * - anything else is the field's own scalar, which covers `notDecodable` (where
 *   the text is the raw source slice, and saying so is the refusal's job) and
 *   `carriageReturn` (which the reading confirmed already worked).
 *
 * **The order, stated exactly, because the first version of this comment claimed
 * one the code did not give.** It said *source order* while reading `TriggerSpec`'s
 * three named slots in the fixed order `trigger` → `triggers` → `regex`, so a file
 * writing `regex:` above `trigger:` drew them the wrong way round — the re-reading's
 * §15.1, and this project's own named worst defect class. What the code now does:
 *
 * - each form is placed by the **first byte of its value** —
 *   `ScalarView.span.start` for `trigger:` and `regex:`, and the lowest such start
 *   among a `triggers:` list's items — so the forms come out in the order the file
 *   writes them, for **every** shape a projection can produce;
 * - the items **inside** a `triggers:` list are never re-sorted: `TriggerSpec.triggers`
 *   crosses one item per source entry in source order, and that order is kept;
 * - a form the projection gives **no** byte position for would be drawn after every
 *   positioned one, keeping the fixed form order among such forms — and **no
 *   projection produces such a form**, so that branch orders nothing today. The
 *   type permits it, because two of `ValueView`'s five arms carry no span; the
 *   only writer of `TriggerSpec::triggers` cannot emit either of them, since
 *   `scalar_sequence()` in `crates/espansoconfig-core/src/model/project.rs` turns a
 *   non-scalar item into a `ValueView::Elided` carrying that item's **own span**.
 *   The second version of this comment said such a list drew last; the third window
 *   reading built exactly that shape and watched it draw **first**, in file order,
 *   because it was located after all (§23) — the same defect class as §15.1, one
 *   round later, and the reason the sentence now names its own unreachability.
 *
 * Each value also carries **which key it came from** ({@link ShownValue.source}),
 * because a `Several` draws two boxes that are otherwise identical — the
 * re-reading's §15.2. It is the detail pane's own `DetailFieldName`, so a screen
 * renders it with the `tDetailField` it already uses and no new string exists.
 * **`tTriggerKind` would not do**: it names the shape of the whole spec, not of one
 * slot, and `Several` has no per-slot meaning at all.
 *
 * **`ownsNoBytes` answers nothing, and that is the honest answer**: the span is
 * zero-width, so there is no value in the file to draw. So does a
 * `triggerNotSingle` of kind `Absent`, for the same reason — the snippet has no
 * trigger of any form.
 *
 * @param match - The snippet's projection.
 * @param field - Which field.
 * @param eligibility - What {@link fieldEligibility} decided about it.
 * @returns What to draw, ordered as the paragraph above states; empty when a
 *   control draws it or when there is nothing in the file to draw.
 */
function shownValuesOf(
  match: MatchView,
  field: EditableField,
  eligibility: FieldEligibility
): readonly ShownValue[] {
  if (eligibility.kind === 'editable') {
    return [];
  }
  if (eligibility.reason === 'triggerNotSingle') {
    const spec = match.trigger;
    const forms: ShownForm[] = [];
    if (spec.trigger !== null) {
      const scalar = spec.trigger;
      forms.push({
        position: scalar.span.start,
        values: [{ kind: 'text', text: scalar.text, source: 'trigger' }]
      });
    }
    if (spec.triggers.length > 0) {
      const starts = spec.triggers
        .map(spanStartOf)
        .filter((start): start is number => start !== null);
      forms.push({
        position: starts.length === 0 ? null : Math.min(...starts),
        values: spec.triggers.map((item) => shownItem(item, 'triggers'))
      });
    }
    if (spec.regex !== null) {
      const scalar = spec.regex;
      forms.push({
        position: scalar.span.start,
        values: [{ kind: 'text', text: scalar.text, source: 'regex' }]
      });
    }
    return orderedForms(forms).flatMap((form) => form.values);
  } // End of the trigger-shape arm
  if (eligibility.reason === 'unmodelledShape') {
    const entry = match.unknown_entries.find((one) => one.key === field);
    const text = entry?.value_text ?? '';
    // No `source`: this field's own label already names the key, and repeating it
    // under the box would say nothing a reader does not already have.
    return text === '' ? [] : [{ kind: 'text', text, source: null }];
  }
  const scalar = projectedScalar(match, field);
  return scalar === null || scalar.text === ''
    ? []
    : [{ kind: 'text', text: scalar.text, source: null }];
} // End of function shownValuesOf()

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
    const eligibility = fieldEligibility(match, field);
    baseline[field] = {
      present: scalar !== null,
      // A field whose scalar could not be decoded is read-only, so its `text` —
      // which is the source slice in that one case — is never treated as a
      // logical value by anything below. It is still carried, because a screen
      // shows what the file says.
      value: scalar === null ? '' : scalar.text,
      eligibility,
      shown: shownValuesOf(match, field, eligibility)
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
    reload: NOT_RELOADING,
    closed: false,
    identityStale: false,
    // The one producer of `false` after a commit: a session over a projection
    // somebody has just read is, by construction, in step with the file.
    needsReprojection: false,
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
 * Five reasons it may not, and the first two are 2c-1b's policy decisions carried
 * over unchanged: not while a save is in flight, and not while a conflict is
 * showing. The third is this sub-phase's — not after a commit whose identity could
 * not be adopted, because there is nothing left to save against. The fifth is
 * defence in depth: not when this application has said the snippet is not safely
 * editable.
 *
 * **The fourth is the 2c-2-2 review's second finding**: not after a commit until
 * a fresh projection has been seeded. The baselines a commit rebases are right
 * about presence and values and say nothing about the new scalars' spelling,
 * spans or decodability — so every one of the five eligibility verdicts is a
 * statement about bytes that have been replaced. Editing on carried-over
 * eligibility is not a live carriage-return write today, because `editField` and
 * `beginSave` both still gate one, but it is a draft built on a claim this
 * session is no longer entitled to make.
 *
 * @param session - The session to ask about.
 * @returns `true` when any field's controls may change anything.
 */
export function isEditable(session: MatchEditorSession): boolean {
  return (
    !session.closed &&
    session.phase === 'editing' &&
    conflictOf(session) === null &&
    !session.identityStale &&
    !session.needsReprojection &&
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
 * **The policy itself is `recordTyping`'s**, in `./typing.ts`, since 2c-3a: the
 * boundary — the same field, within {@link TYPING_GROUP_IDLE_MS} — is shared with
 * the creation form and is one rule in one place rather than two copies. What
 * stays here is what is about *this* session: the focus follows the field being
 * typed into, and a change clears the last send failure.
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
  const recorded = recordTyping(session.draft, session.group, field, buffers, session.clock());
  if (recorded === null) {
    return session;
  }
  return {
    ...session,
    draft: recorded.draft,
    focus: field,
    group: recorded.group,
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
      // **A new outcome resets the reload**, so a confirmation collected for an
      // earlier conflict cannot be spent while this one is on screen.
      reload: NOT_RELOADING,
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
    // A commit replaced the bytes every eligibility verdict was computed from, so
    // the session owes a re-projection and stops accepting changes until it has
    // one. A `committed: false` replaced nothing and owes nothing.
    needsReprojection: result.committed,
    baseline: committedBaseline(session.baseline, submission.candidate),
    draft: savedDraft(session.draft, submission, result.revision),
    phase: 'editing',
    group: null,
    outcome,
    extraMessages,
    reload: NOT_RELOADING,
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
 * **The reason is carried, and 2c-2-2 is why the third argument exists.** A
 * `save_match` that never produced an outcome is very often a *validation*
 * answer rather than an infrastructure one — `draftRefused` carries the core's
 * `DraftError`, whose thirty-two sentences say which field cannot be written and
 * why — and until this parameter existed every one of them reached the developer
 * console and no screen. It is required rather than defaulted, for
 * {@link applySave}'s `adoption` reason: a default would be this function
 * inventing *nothing is known* for a caller that did not look.
 *
 * @param session - The session waiting for an answer.
 * @param mayHaveWritten - Whether the file may already hold the submitted draft.
 * @param reason - Why the command rejected, or `null` when nothing was sent and
 *   the boundary therefore has no rejection to hand on.
 * @returns The session, back to editing, with the right notice raised.
 */
export function saveCouldNotBeSent(
  session: MatchEditorSession,
  mayHaveWritten: boolean,
  reason: IpcFailure | null
): MatchEditorSession {
  return {
    ...session,
    phase: 'editing',
    group: null,
    sendFailure: sendFailureOf(mayHaveWritten, reason)
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
 * **It does not give the controls back after a commit**, and that is deliberate
 * rather than an oversight of the spread below:
 * {@link MatchEditorSession.needsReprojection} lives on the session and survives
 * this, so a person cannot dismiss their way past the re-projection a commit
 * owes. Only {@link startMatchEditor} over a freshly projected snippet clears it.
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
    reload: NOT_RELOADING,
    sendFailure: null
  };
} // End of function keepEditing()

/**
 * Asks to load the version on disk, which is the step **before** confirming.
 *
 * @param session - The session showing a conflict.
 * @returns The session at the warning, or the same session when no conflict is
 *   showing or one has already been asked about.
 */
export function askToReloadDiskVersion(session: MatchEditorSession): MatchEditorSession {
  const next = reloadAsked(conflictOf(session), session.reload);
  return next === null ? session : { ...session, reload: next };
} // End of function askToReloadDiskVersion()

/**
 * Confirms abandoning this edit for the version on disk.
 *
 * Issues the token the adoption checks, for **this** conflict. Reachable only from
 * the warning step, so a confirmation cannot be produced by a screen that never
 * showed the warning.
 *
 * @param session - The session at the warning.
 * @returns The session holding the confirmation, or the same session.
 */
export function confirmDiskReload(session: MatchEditorSession): MatchEditorSession {
  const next = reloadConfirmed(conflictOf(session), session.reload);
  return next === null ? session : { ...session, reload: next };
} // End of function confirmDiskReload()

/**
 * Adopts the disk version into the window and ends this editing session.
 *
 * **The match-level reload the consult's Q3 ruled, and it is not a reseed.** There
 * is no disk-side `MatchBuffers` to load: finding "the same" snippet in a revision
 * this application has not been told anything about is cross-revision identity
 * work, which is 2c-4b and is forbidden here. So the window crosses to the disk
 * observation and the editor **closes**, taking the draft with it — which is what
 * the confirmation was collected for.
 *
 * **Nothing is closed for an adoption the window refused.** A `refused` from
 * `adopt` — a spent confirmation, a conflict this window did not produce, or a
 * projection replaced since it arrived — leaves the session exactly as it was,
 * because closing over a window that did not move would report a reload that did
 * not happen. **`alreadyThere` is not a refusal**: the window already holds the
 * bytes that were asked for, so the request is satisfied and this session ends.
 *
 * **What no type here forces**: that `adopt`'s body does anything, and that the
 * panel reading {@link MatchEditorView.closed} really closes.
 *
 * @param session - The session holding a confirmation.
 * @param adopt - `BrowserState.adoptDiskVersion`. Called at most once.
 * @returns The closed session, or the same session.
 */
export function reloadTheDiskVersion(
  session: MatchEditorSession,
  adopt: AdoptTheDiskVersion<MatchBuffers>
): MatchEditorSession {
  if (!spendTheConfirmedReload(conflictOf(session), session.reload, adopt)) {
    return session;
  }
  return {
    ...session,
    submitted: null,
    outcome: null,
    extraMessages: [],
    group: null,
    reload: NOT_RELOADING,
    sendFailure: null,
    closed: true
  };
} // End of function reloadTheDiskVersion()

/**
 * What this surface offers about a conflict.
 *
 * **`draftKind` is the permanent fact and the two booleans are not.**
 * {@link MatchBuffers} holds the strings a person typed, so the consult's Q3/Q4
 * rule gives this surface *Copy draft* — a labelled reference copy of the fields,
 * never YAML — and a confirmed reload that installs the disk projection and
 * **closes** the editor.
 *
 * **The reload is built and wired; it is only unoffered.**
 * {@link askToReloadDiskVersion}, {@link confirmDiskReload} and
 * {@link reloadTheDiskVersion} are the transition, and `MatchEditor.svelte`'s
 * `conflictAction` calls them. `conflictChoicesFor` names only what these booleans
 * admit, so no control that could reach either arm is drawn — which is why an
 * unoffered arm is not a dead control. **Phase 2c-4a-3 flips them**: the reload
 * over machinery that already exists and is already driven by this module's tests,
 * *Copy draft* over a labelled field renderer still to be written.
 *
 * **None of these is "keep my draft"** and none may become one: that phrase means
 * *reapply the draft to the newly parsed document*, which is 2c-4b.
 */
export const CONFLICT_CAPABILITIES: ConflictCapabilities = {
  draftKind: 'authoredText',
  offersCopyDraft: false,
  offersReload: false
};

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
  /**
   * What the file holds here, when no control will draw it.
   *
   * Empty for an editable field and for a refusal with nothing to show. A screen
   * walks it and calls `SourceText` or `tValueKind` per arm, and `tDetailField`
   * for a value whose `source` is not `null` — never `field.text`, which is one
   * scalar and is `''` for the very case the window reading found blank.
   * {@link shownValuesOf} states the order these come out in.
   */
  readonly shown: readonly ShownValue[];
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
  /**
   * The reasons to show beside that failure, outermost first.
   *
   * Empty whenever there is no failure and whenever the boundary handed no
   * reason on. `sendFailureLines` walks the chain — a `draftRefused` carries a
   * `DraftError`, a `saveFailed` carries a `SaveError` whose `Patch` arm carries
   * an `EditError` — so a component renders each line by calling the accessor its
   * arm names rather than by deciding in markup how deep to go.
   */
  readonly failureLines: readonly SendFailureLine[];
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
  /** Whether the warning is showing and the destructive choice is one click away. */
  readonly awaitingReloadConfirmation: boolean;
  /**
   * Whether a confirmed reload has ended this session.
   *
   * The panel that reads this calls its own `close`: a match-level reload adopts
   * the disk projection and closes, because there is no disk-side draft to seed.
   */
  readonly closed: boolean;
  /** Whether this session's identity is known to be stale. */
  readonly identityStale: boolean;
  /**
   * Whether the caller must seed a new session from a fresh projection.
   *
   * `true` after a commit, and **`editable` is `false` for as long as it is** —
   * this is an obligation rather than a suggestion since the 2c-2-2 review, and
   * dismissing the saved panel no longer clears it. The baselines this session
   * rebased are what was *written*, which is correct about presence and values
   * and says nothing about the new scalars' spelling, spans or decodability — so
   * eligibility is the one thing only a re-projection can refresh.
   *
   * **What no type here can force** is that a caller *performs* one: a component
   * that draws no way to re-seed leaves a person with an editor that has stopped
   * accepting changes, which is a dead end rather than a data risk. What the
   * model does force is that no draft is built on eligibility it cannot vouch for.
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
    shown: baseline.shown,
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
    failureLines: sendFailureLines(session.sendFailure?.reason ?? null),
    outcome,
    messages: outcome === null ? [] : [...outcome.messages, ...session.extraMessages],
    notes: saved === null ? [] : saved.notes,
    refusalChoices: offeredRefusalChoices(refused, stale),
    findingsAreStale: refused !== null && stale,
    conflict,
    conflictChoices:
      conflict === null
        ? []
        : conflictChoicesFor(CONFLICT_CAPABILITIES, offeredReloadStep(session.reload)),
    awaitingReloadConfirmation: conflict !== null && session.reload.kind !== 'idle',
    closed: session.closed,
    identityStale: session.identityStale,
    needsReprojection: session.needsReprojection
  };
} // End of function matchEditorView()

/**
 * Why this window cannot seed a fresh session over one snippet.
 *
 * **Three reasons, because one sentence naming a single cause was false in two of
 * them.** `cannotReproject` used to say the window was *no longer showing the file
 * the snippet is in*; the confirmation pass found that a person who selects another
 * snippet **in that same file** while a save is in flight reaches the same disabled
 * control under that same false sentence, and so does a commit whose adoption
 * failed. A code with three arms is this project's usual answer to that — the same
 * shape as {@link FieldRefusal} — and it is what makes the sentence true rather
 * than merely vaguer.
 */
export type ReprojectionRefusal =
  /** The window holds no projection that answers for this snippet at all. */
  | 'notProjected'
  /** The window has moved to a different file. */
  | 'otherFile'
  /** The window is on this file, showing a different snippet. */
  | 'otherSnippet';

/**
 * What a caller answers when a session asks to be seeded again.
 *
 * A discriminated union rather than `MatchView | null`, so a refusal with no
 * reason is not representable and the screen cannot be left inventing one.
 */
export type Reprojection =
  | {
      /** The window has a fresh projection of that snippet. */
      readonly kind: 'projected';
      /** The projection to seed the new session from. */
      readonly match: MatchView;
    }
  | {
      /** It has none. */
      readonly kind: 'unavailable';
      /** Why, as a code. */
      readonly reason: ReprojectionRefusal;
    };

/**
 * The dictionary key holding one reprojection refusal's sentence.
 *
 * A `switch` over literal keys, the idiom {@link fieldRefusalKey} follows and for
 * the same reason: a renamed key is a compile error here, and a new member of
 * {@link ReprojectionRefusal} with no sentence is one too.
 *
 * @param reason - Why the window cannot re-read the snippet.
 * @returns The key holding that reason's sentence.
 */
export function reprojectionRefusalKey(reason: ReprojectionRefusal): TranslationKey {
  switch (reason) {
    case 'notProjected':
      return 'browser.matchEditor.cannotReproject.notProjected';
    case 'otherFile':
      return 'browser.matchEditor.cannotReproject.otherFile';
    case 'otherSnippet':
      return 'browser.matchEditor.cannotReproject.otherSnippet';
  }
} // End of function reprojectionRefusalKey()

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
 * The acknowledgement one submission carries, for a caller that only needs that.
 *
 * A named read rather than a property walk at the call site, so the one place a
 * screen hands consent to the boundary is a place this module can be searched
 * for. `rawEditor.ts` has the same read over its own drafted value; that is not
 * the copying D7 forbids, because a property read is not a rule about consent —
 * the rule is `acknowledgeRefusal`'s, and there is exactly one of it.
 *
 * @param submission - What {@link beginSave} produced.
 * @returns The suspicions already shown to a person, for this exact candidate.
 */
export function acknowledgementOf(submission: DraftSubmission<MatchBuffers>): Acknowledgement {
  return submission.acknowledgement;
} // End of function acknowledgementOf()

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
