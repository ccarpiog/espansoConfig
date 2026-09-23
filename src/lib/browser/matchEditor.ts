/**
 * The small editor's state machine: every eligible scalar field of one snippet,
 * drafted and saved.
 *
 * **No component and no screen.** This is the whole protocol as a value, exactly
 * as `./rawEditor.ts` is for the raw editor and for the same standing reason
 * (`docs/decisions/1c-1-notes.md` hole 1): nothing in this repository renders a
 * Svelte component in an automated test unless the file opts into jsdom, so a
 * decision written in markup is a decision nothing can check. A later step of
 * 2c-2 draws what this module decides.
 *
 * ## What it edits: seventeen scalar fields, since Phase 3-5-1
 *
 * The literal **trigger**, the five **content** keys (`replace`, `markdown`,
 * `html`, `image_path`, and `form` as layout text only — ruling 9 of
 * `docs/decisions/3-split-notes.md`; `form_fields` stays read-only), the
 * **label**, the **comment**, and the nine **options** — `word`, `left_word`,
 * `right_word`, `propagate_case`, `uppercase_style`, `force_mode`,
 * `force_clipboard`, `paragraph` and `anchor`, each its own textual field and
 * never one control over several. Seventeen `DraftField<string>`s of a
 * twenty-two-field {@link MatchDraft}; `regex` and all four lists go out
 * `'Unchanged'` (3-6 owns the trigger forms and the lists). Until Phase 3-5-1 it
 * was six: the trigger, `replace`, the label and the three word-boundary keys.
 *
 * **Three further things are drafted beside the fields** (Phase 3-5-1), and each
 * is a value of this model rather than a rule of a renderer:
 *
 * - **the content switch** ({@link chooseContentSwitch}): one compound,
 *   all-or-nothing intention that renames the snippet's one content key to
 *   another in place (rulings 8 and 23). It converts no content — the text is
 *   carried as it is — and removes no companion key; which companion keys stay
 *   is preview data ({@link ContentSwitchPreview}). A switch cannot be sent
 *   unconfirmed: {@link canSave} refuses until {@link confirmContentSwitch}, and
 *   the confirmation is part of the drafted value, so undo walks it back;
 * - **the cursor action** ({@link insertCursorPosition}), for `replace` only
 *   (ruling 18): buffer-only and undoable, it inserts `$|$`, selects the one
 *   already there, or answers a several-markers advisory as a code;
 * - **exact-string suggestions** for `uppercase_style` and `force_mode`
 *   ({@link OPTION_SUGGESTIONS}): a suggestion is a string compared with `===`,
 *   an unfamiliar value is kept exactly, and nothing here infers a boolean.
 *
 * The word-boundary keys stay **textual**, which is the design consult's Q1 and
 * D2u restated for an editor: a checkbox over `word` would have to decide that
 * `on`, `yes` and `true` are the same value, and this application does not know
 * that — it shows a scalar's source text as written and never an inferred type.
 * Since Phase 3-5-1 the same holds for every option (ruling 10): `force_mode` and
 * `force_clipboard` are two separate fields with no inferred precedence, and
 * `propagate_case` and `paragraph` are text like the rest.
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
 * tri-state it produces is the authoritative intent. Since Phase 3-5-1 it takes
 * the field's part in a drafted content switch as a third argument, and
 * {@link intentsOf} is the one production caller that builds that argument. That is the consult's Q3:
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
 * seventeen-field object, and every one of the person's earlier edits is dropped to make
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
 *
 * ## The external session — Phase 2d-6-2
 *
 * A conflict has two origins since Phase 2d-5-5a, and since 2d-6-2 this session
 * holds the second: {@link MatchEditorSession.externalConflict} is the conflict a
 * watcher observation raised over the file while this editor was open, a field
 * beside `outcome` and never an arm of it, so that *how a save ended* keeps its
 * provenance (the 2d-6 record's §3 entry 6). {@link applyObservation} is the
 * session's receiver as a value — every arm of the window's `ObservationVerdict`
 * has a named action there and a `never` terminus catches an eighth (entry 11) —
 * and {@link conflictOf} answers the conflict shown, whichever origin it has, so
 * `isEditable`, `canSave` and `beginSave` refuse under both without a second rule.
 * Two further restrictions live on the session because they are about it and not
 * about a panel: a held observation the window has not decided
 * ({@link MatchEditorSession.awaitingReconciliation}) stops a save being sent
 * (entry 8), and a conflict raised under an unknown write outcome
 * ({@link MatchEditorSession.uncertaintyUnresolved}) withholds the reload and the
 * reapply until {@link acknowledgeSnapshot} is told the hold ended (entries 11 and
 * 22). {@link keepEditing} erases none of the three (entry 9).
 *
 * **The reapply reads both origins through one entry** — `enterReapply` in
 * `./reapply.ts` — and for the external one finds this snippet's row in the
 * observation's correspondence table by its **full** base identity, never by
 * position or by node number (entries 19 and 20), refusing to manual resolution
 * with the typed sentence when the table, the row or the standing origin say no
 * (entry 22).
 *
 * **Registered since Phase 2d-6-6b.** `MatchEditor.svelte` reports a receiver that
 * installs this module's `applyObservation` through the binding `DetailPane`
 * hands down, and the pane registers it through
 * `BrowserState.registerObservationReceiver` over the editor's file
 * (`./surfaceReceivers.ts`); `DetailPane.test.ts` shows the mounted ordering of a
 * delivery against this editor's own `await save(...)`. Since Phase 2d-6-6c-1
 * `MatchEditor.svelte` draws the external conflict in a panel of its own and the
 * notices beside the save control.
 */

import type { TranslationKey } from '../i18n/dictionaries';
import type { IpcFailure } from '../ipc/errors';
import type {
  Acknowledgement,
  ContentForm,
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
import type { DetailFieldName, OptionGroupName } from './detail';
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
  atTheReloadWarning,
  conflictArm,
  consentForRefusal,
  offeredReloadStep,
  offeredRefusalChoices,
  reloadAsked,
  reloadConfirmed,
  refusedArm,
  sendFailureLines,
  sendFailureOf,
  reloadWasRefused,
  confirmationOf,
  settledAnswer,
  submissionIsStale,
  NOT_RELOADING,
  RELOAD_REFUSED,
  type AdoptTheDiskVersion,
  type EditorPhase,
  type ReloadStep,
  type SendFailure,
  type SendFailureLine
} from './editorSave';
import type { RawSaveChoice } from './rawSave';
import type { InvalidationStatus } from './invalidation';
import type {
  ConflictSource,
  ExternalChangeConflictSource,
  ExternalConflictObservation
} from './conflictSource';
import {
  externalConflictNoticeKey,
  type ExternalConflictNotice,
  type ObservationDelivery
} from './observationDelivery';
import {
  correspondenceRowFor,
  enterReapply,
  externalEvidenceRefusalKey,
  sharedReapplyObstacleKey,
  subjectCorrespondence,
  subjectResolution,
  SUPERSEDED_EVIDENCE_KEY,
  type ExternalEvidenceRefusal,
  type ReapplyAttempt,
  type ReapplyEvidenceAccess,
  type ReapplyOutcome,
  type SharedReapplyObstacle,
  type StandingOriginGuard,
  type SubjectCorrespondence
} from './reapply';
import {
  conflictChoicesFor,
  conflictDiskText,
  copyOfDraft,
  describeEditSave,
  describeExternalConflict,
  invalidationFailureMessage,
  reapplyIsOffered,
  supersedeConflict,
  type ConflictCapabilities,
  type ConflictChoice,
  type ConflictDiskText,
  type ConflictMessage,
  type ConflictModel,
  type DraftFieldStatus,
  type ExternalConflictModel,
  type RetainedDraftField,
  type SaveOutcomeMessage,
  type SaveOutcomeModel,
  reapplyAuthorizationFor
} from './saveOutcome';

/**
 * One field this editor can edit, spelled as its espanso key.
 *
 * The keys themselves rather than camel-case names, because that is what
 * `MatchDraft` is keyed by and a second spelling would be a second thing to keep
 * in step. {@link fieldLabelName} maps each to the label the detail pane already
 * has a sentence for.
 */
export type EditableField =
  | 'trigger'
  | ContentForm
  | 'label'
  | 'comment'
  | 'word'
  | 'left_word'
  | 'right_word'
  | 'propagate_case'
  | 'uppercase_style'
  | 'force_mode'
  | 'force_clipboard'
  | 'paragraph'
  | 'anchor';

/**
 * The five content keys, in `MatchField`'s order — Phase 3-5-1.
 *
 * A snippet is written with **one** of them; which one is its content kind, and
 * changing it is {@link chooseContentSwitch}'s compound intent, never an edit of
 * two fields.
 */
export const CONTENT_FIELDS: readonly ContentForm[] = [
  'replace',
  'markdown',
  'html',
  'image_path',
  'form'
];

/**
 * The nine options, in `MatchField`'s order — Phase 3-5-1.
 *
 * Every one is a textual field (D2u, ruling 10). `word` is first, which is what
 * the renderer's *matching* heading keys on.
 */
export const OPTION_FIELDS: readonly EditableField[] = [
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

/**
 * The seventeen fields, in the order a screen shows them.
 *
 * Trigger and content first, because they are what a snippet *is*; the label and
 * the comment next, because they are what a person calls it and says about it;
 * the nine options last, because they qualify the trigger and the insertion
 * rather than state them. The relative order is `MatchField::ALL`'s and
 * `NewMatch::entries()`'s, so recovery's carried fields and a creation's written
 * keys agree without either being derived from the other.
 */
export const EDITABLE_FIELDS: readonly EditableField[] = [
  'trigger',
  ...CONTENT_FIELDS,
  'label',
  'comment',
  ...OPTION_FIELDS
];

/**
 * Whether a field is one of the five content keys.
 *
 * @param field - Which field.
 * @returns `true` for `replace`, `markdown`, `html`, `image_path` and `form`.
 */
export function isContentField(field: EditableField): field is ContentForm {
  return (CONTENT_FIELDS as readonly EditableField[]).includes(field);
} // End of function isContentField()

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
  | 'triggerNotSingle'
  | 'lineBreak';

/**
 * Which kind of text control a field is drawn in — Phase 3-5-1.
 *
 * **A decision of this model, not of a renderer** (`CLAUDE.md` section 6): an
 * `<input type="text">` strips every line break from its value and a
 * `<textarea>` keeps them as line feeds, so which control draws a field decides
 * whether a value survives a round trip through it. The five content keys and
 * the comment are `multiLine`; the trigger, the label and the nine options are
 * `singleLine`, and a `singleLine` field whose value holds a line feed is
 * read-only (`lineBreak`) and refused at {@link editField} and {@link beginSave}.
 * What no type forces is that a renderer draws the control named here.
 */
export type FieldControl = 'multiLine' | 'singleLine';

/**
 * The control one field is drawn in.
 *
 * @param field - Which field.
 * @returns `multiLine` for the content keys and the comment, `singleLine` otherwise.
 */
export function fieldControlOf(field: EditableField): FieldControl {
  return isContentField(field) || field === 'comment' ? 'multiLine' : 'singleLine';
} // End of function fieldControlOf()

/**
 * Whether a text cannot pass through a field's control unchanged.
 *
 * A carriage return passes through no control in this window; a line feed passes
 * through a `multiLine` one and not through a `singleLine` one.
 *
 * @param field - Which field.
 * @param text - A value for it.
 * @returns `true` when the control would change it.
 */
function unreadableIn(field: EditableField, text: string): boolean {
  return text.includes('\r') || (fieldControlOf(field) === 'singleLine' && text.includes('\n'));
} // End of function unreadableIn()

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

/** What the file held for all seventeen fields. */
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

/**
 * A drafted switch of content kind, as the draft holds it — Phase 3-5-1.
 *
 * **Part of the drafted value**, so it is snapshotted, undone, retained by a
 * conflict, copied, reapplied and recovered with the fields. `confirmed` is the
 * model value ruling 8's confirmation is: {@link canSave} and {@link beginSave}
 * refuse a switch that is not confirmed, and {@link chooseContentSwitch} always
 * drafts one unconfirmed. `contentSwitchOf` turns it into the wire's
 * `ContentSwitch`, which has no confirmation because Rust is only ever sent a
 * confirmed one.
 */
export interface DraftedContentSwitch {
  /** The content key the file holds now. */
  readonly from: ContentForm;
  /** The content key it is to be renamed to. */
  readonly to: ContentForm;
  /** Whether the person has confirmed the switch after its preview. */
  readonly confirmed: boolean;
}

/**
 * What all seventeen fields' controls hold now, and the drafted content switch.
 *
 * The switch is a property beside the fields rather than a field: a
 * `Record<EditableField, …>` walk sees every field and never the switch, and the
 * switch is read by {@link intentsOf} and nothing that walks fields alone.
 */
export type MatchBuffers = Readonly<Record<EditableField, FieldBuffer>> & {
  /** The drafted switch of content kind, or `null`. */
  readonly contentSwitch: DraftedContentSwitch | null;
};

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
 * One editing session over one snippet's seventeen editable fields.
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
   * consults before any of the per-field verdicts are looked at.
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
  /**
   * The conflict a watcher observation raised over this session, or `null` —
   * Phase 2d-6-2, the 2d-6 record's §3 entry 6.
   *
   * **A field of its own beside {@link MatchEditorSession.outcome}, never an arm
   * of it.** An outcome is how *a save* ended, and its conflict arm can only
   * have come from a refused write attempt; a conflict the watcher raised is not
   * that, carries no `expected` and no `found`, and lives here so that `outcome`
   * keeps its provenance. {@link conflictOf} is the one accessor that reads both
   * and answers the conflict this session is showing, whichever origin it has.
   *
   * **Only one conflict is active at a time, and the transitions are what keep
   * it so** (entry 7): {@link applyObservation} retires a save conflict's outcome
   * when it sets this, and {@link applySave} retires this when a save ends as a
   * conflict; a committed success or a refusal left in `outcome` beside this is
   * history and is never the conflict {@link conflictOf} answers. The type admits
   * both populated — nothing in TypeScript ties two fields together — and a
   * session built by hand with both gets {@link conflictOf}'s stated precedence,
   * not a guarantee.
   *
   * While it is non-null the session is not editable and cannot submit, exactly
   * as under a save conflict, and {@link keepEditing} does not clear it (entry 9):
   * the ways out are the reload, the reapply, or closing.
   */
  readonly externalConflict: ExternalConflictModel<MatchBuffers> | null;
  /**
   * Whether {@link MatchEditorSession.externalConflict} was raised while a write
   * of this window's own had an unknown outcome, and this session has not been
   * told the hold ended — Phase 2d-6-2, entry 11's `raisedWithoutReload` row.
   *
   * While `true`, the ordinary reload is withheld — not offered by the view and
   * refused by {@link askToReloadDiskVersion} — and the reapply is refused before
   * it could obtain an adoption (entry 22), because a confirmed installation of a
   * disk snapshot a write of this window may or may not have produced would
   * settle, silently, a question only the person can. It ends when
   * {@link acknowledgeSnapshot} is told the window ended the hold, or when a later
   * verdict replaces the conflict under no uncertainty.
   *
   * **What it records is what this session was told, and nothing more.** The
   * window's hold can end by a later write of this window's own that settles on a
   * named revision, which delivers nothing to a session; this flag cannot see
   * that, and only the acknowledgement or a fresh verdict clears it here.
   */
  readonly uncertaintyUnresolved: boolean;
  /**
   * The observation this session was told the window is holding and has not
   * decided about, or `null` — Phase 2d-6-2, entry 11's `retained` row.
   *
   * **A restriction on submission and nothing else**: while non-null,
   * {@link canSave} and {@link beginSave} refuse (entry 8), the controls stay
   * live, and no disk comparison and no origin is recorded — the window has
   * decided nothing yet, so there is nothing honest to show but the fact of the
   * wait. It is lifted by the delivery that decides **this** observation, whatever
   * the verdict — `writtenHere` included, which is the one that decides it
   * without an origin — and replaced by a later `retained` delivery, because the
   * barrier keeps the newest reading and that is the one a settlement will decide.
   *
   * **Held by identity, never read.** No property of the observation is read by
   * this module; it is compared with `===` against the one a later envelope
   * carries. What that cannot see is a reading the barrier coalesced away without
   * announcing it — a session told `retained` about an older reading after a newer
   * one was already held waits for a verdict that will not come. In production
   * the coordinator admits observations in sequence order, so the last `retained`
   * a session is told is the reading the barrier keeps.
   */
  readonly awaitingReconciliation: ExternalConflictObservation | null;
  /**
   * Every delivery that arrived while this session's own save was in flight, in
   * the order it arrived, kept until that save's answer has been applied — Phase
   * 2d-6-2, the 2d-6 record's §3 entry 5.
   *
   * The window publishes a write's settlement from inside the writing wrapper,
   * **before** the `await save(...)` that started it resumes; applied at once,
   * the delivered conflict would be overwritten by the continuation's own
   * `applySave`. So {@link applyObservation} appends the envelope here while the
   * phase is `saving`, and {@link applySave} and {@link saveCouldNotBeSent}
   * replay the whole list through {@link applyObservation}, first to last, after
   * their own answer and in the same transition.
   *
   * **A list, not a slot, and the review of this phase is why.** The settlement's
   * `raised` is not the last envelope a save in flight can be told: a sibling
   * receiver over the same file may answer that `raised` by publishing a later
   * reading of the same bytes, which the window decides `coalesced` and hands to
   * every receiver — all before this session's continuation runs. A slot keeping
   * the latest envelope replayed `coalesced` over a session with no conflict to
   * coalesce into, and the file's change was never shown. **What the list forces**:
   * every envelope delivered to this session during its save is applied, in the
   * order the window delivered it, which the window states is the order its
   * decisions were made. **What it does not force**: that the order of delivery
   * was the order of decision — that is the window's guarantee, not this field's;
   * that a decision made against the window's state is still apt against the
   * session's once the save's answer is on it — each envelope is applied by the
   * same rules it would have met on arrival, no more; nor that a component applies
   * a delivery through this module at all. Nothing in TypeScript orders a delivery
   * against a continuation; the order here is a fact its own suite drives.
   */
  readonly heldDeliveries: readonly ObservationDelivery[];
  /**
   * The content-related keys the snippet held when the session was seeded,
   * which a content switch keeps — Phase 3-5-1, ruling 8's *removes no companion
   * field silently*. Taken from the projection once, with the baseline, and read
   * only by {@link ContentSwitchPreview}.
   */
  readonly companions: readonly CompanionKey[];
  /** Where the group boundary's readings come from. */
  readonly clock: Clock;
}

/**
 * A key a content switch leaves where it is, named in its preview — Phase
 * 3-5-1.
 *
 * Spelled as the espanso key, like `MatchField`: `vars` and `form_fields` are
 * collections this editor never drafts, and `paragraph` is an option whose
 * meaning espanso ties to `markdown`. A switch renames one key and touches none
 * of these; the preview says which of them the snippet holds so that keeping them
 * is never silent.
 */
export type CompanionKey = 'vars' | 'form_fields' | 'paragraph';

/**
 * The companion keys one snippet holds, in a fixed order.
 *
 * @param match - The snippet's projection.
 * @returns The keys, possibly none.
 */
function companionsOf(match: MatchView): readonly CompanionKey[] {
  const held: CompanionKey[] = [];
  if (match.vars.length > 0) {
    held.push('vars');
  }
  if (match.form_fields.length > 0) {
    held.push('form_fields');
  }
  if (match.options.paragraph !== null) {
    held.push('paragraph');
  }
  return held;
} // End of function companionsOf()

/**
 * The projected scalar of one editable field, or `null`.
 *
 * A `switch` over the seventeen rather than a lookup table, so an eighteenth
 * field is a compile error here rather than an `undefined` at run time.
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
    case 'markdown':
      return match.content.markdown;
    case 'html':
      return match.content.html;
    case 'image_path':
      return match.content.image_path;
    case 'form':
      return match.content.form;
    case 'label':
      return match.label;
    case 'comment':
      return match.comment;
    case 'word':
    case 'left_word':
    case 'right_word':
    case 'propagate_case':
    case 'uppercase_style':
    case 'force_mode':
    case 'force_clipboard':
    case 'paragraph':
    case 'anchor':
      return match.options[field];
  }
} // End of function projectedScalar()

/**
 * The label the detail pane already has a sentence for.
 *
 * Reused rather than duplicated: `browser.detail.field.*` names these seventeen
 * fields in both languages, and a second set of labels would be a second thing to
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
    case 'markdown':
      return 'markdown';
    case 'html':
      return 'html';
    case 'image_path':
      return 'imagePath';
    case 'form':
      return 'form';
    case 'label':
      return 'label';
    case 'comment':
      return 'comment';
    case 'word':
      return 'word';
    case 'left_word':
      return 'leftWord';
    case 'right_word':
      return 'rightWord';
    case 'propagate_case':
      return 'propagateCase';
    case 'uppercase_style':
      return 'uppercaseStyle';
    case 'force_mode':
      return 'forceMode';
    case 'force_clipboard':
      return 'forceClipboard';
    case 'paragraph':
      return 'paragraph';
    case 'anchor':
      return 'anchor';
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
  if (fieldControlOf(field) === 'singleLine' && scalar.text.includes('\n')) {
    return { kind: 'readOnly', reason: 'lineBreak' };
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
 * What the file holds for all seventeen fields, and which of them may be edited.
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
  } // End of the loop over the seventeen editable fields
  return deepFreeze(baseline);
} // End of function baselineOf()

/**
 * The buffers a session starts with: exactly what the file holds, nothing removed
 * and no content switch drafted.
 *
 * @param baseline - What the file holds.
 * @returns The starting buffers.
 */
export function buffersOf(baseline: MatchBaseline): MatchBuffers {
  const fields: Record<EditableField, FieldBuffer> = {} as Record<EditableField, FieldBuffer>;
  for (const field of EDITABLE_FIELDS) {
    fields[field] = { text: baseline[field].value, removed: false };
  }
  return { ...fields, contentSwitch: null };
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
 * **A drafted content switch changes two rows, and only through `role`** (Phase
 * 3-5-1). The switch's **source** key is renamed rather than written, so its
 * intent is `'Unchanged'` — Rust's planner refuses any other intent on it. The
 * **destination**'s intent is `'Unchanged'` when its text is the reference text
 * (the source's projected value, or the destination's own once a commit has made
 * it present), which keeps the value's bytes exactly, and `Set` otherwise — `Set('')`
 * included, because the key the switch creates holds whatever the box holds.
 * Neither can be removed while the switch stands.
 *
 * **The role defaults to {@link NO_SWITCH}**, and that is a statement about a
 * caller holding one field without the buffers it sits in; every production
 * caller goes through {@link intentsOf}, which reads the drafted switch and passes
 * the role it implies. What no type forces is that a new caller does the same.
 *
 * @param baseline - What the file holds for this field.
 * @param buffer - What its controls hold.
 * @param role - The field's part in a drafted content switch.
 * @returns The tri-state to put in the {@link MatchDraft}.
 */
export function fieldIntent(
  baseline: FieldBaseline,
  buffer: FieldBuffer,
  role: SwitchRole = NO_SWITCH
): DraftField<string> {
  if (baseline.eligibility.kind !== 'editable') {
    return 'Unchanged';
  }
  if (role.kind === 'source') {
    return 'Unchanged';
  }
  if (role.kind === 'destination') {
    return buffer.text === role.reference ? 'Unchanged' : { Set: buffer.text };
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
 * One field's part in a drafted content switch — Phase 3-5-1.
 *
 * `destination` carries the **reference** text its intent is measured against:
 * the source's projected value while the file still holds the source key, and the
 * destination's own once a commit has made it present.
 */
export type SwitchRole =
  | {
      /** The field takes no part in a switch. */
      readonly kind: 'none';
    }
  | {
      /** The key a drafted switch renames away from. */
      readonly kind: 'source';
    }
  | {
      /** The key a drafted switch renames to. */
      readonly kind: 'destination';
      /** The text whose equality keeps the value's bytes. */
      readonly reference: string;
    };

/** The role of a field no switch names, shared rather than rebuilt. */
export const NO_SWITCH: SwitchRole = Object.freeze({ kind: 'none' as const });

/**
 * One field's part in a drafted content switch.
 *
 * @param baseline - What the file holds.
 * @param contentSwitch - The drafted switch, **read once by the caller**, or `null`.
 * @param field - Which field.
 * @returns The role {@link fieldIntent} takes.
 */
export function switchRoleOf(
  baseline: MatchBaseline,
  contentSwitch: DraftedContentSwitch | null,
  field: EditableField
): SwitchRole {
  if (contentSwitch === null) {
    return NO_SWITCH;
  }
  if (field === contentSwitch.from) {
    return { kind: 'source' };
  }
  if (field === contentSwitch.to) {
    const destination = baseline[field];
    return {
      kind: 'destination',
      reference: destination.present ? destination.value : baseline[contentSwitch.from].value
    };
  }
  return NO_SWITCH;
} // End of function switchRoleOf()

/**
 * A drafted switch copied into a plain value, so it is read exactly once.
 *
 * **The check-and-spend rule of `CLAUDE.md` section 6**: `MatchBuffers` carries
 * no brand, so a caller can hand in a switch whose properties are getters. Every
 * function below that both decides and derives from a switch reads it through
 * this, once, and uses the copy.
 *
 * @param buffers - What the controls hold.
 * @returns A plain copy of the drafted switch, or `null`.
 */
function capturedSwitch(buffers: MatchBuffers): DraftedContentSwitch | null {
  const drafted = buffers.contentSwitch;
  if (drafted === null) {
    return null;
  }
  return { from: drafted.from, to: drafted.to, confirmed: drafted.confirmed };
} // End of function capturedSwitch()

/**
 * Every field's intent, the drafted switch taken into account — Phase 3-5-1.
 *
 * **The one production caller of {@link fieldIntent}**: it reads the switch once
 * and each field's buffer once, so a buffer or a switch behind a getter cannot
 * answer one thing to the role and another to the intent.
 *
 * @param baseline - What the file holds.
 * @param buffers - What the controls hold.
 * @param contentSwitch - The drafted switch, read once by the caller.
 * @returns One intent per field.
 */
export function intentsOf(
  baseline: MatchBaseline,
  buffers: MatchBuffers,
  contentSwitch: DraftedContentSwitch | null
): Readonly<Record<EditableField, DraftField<string>>> {
  const intents: Record<EditableField, DraftField<string>> = {} as Record<
    EditableField,
    DraftField<string>
  >;
  for (const field of EDITABLE_FIELDS) {
    intents[field] = fieldIntent(
      baseline[field],
      buffers[field],
      switchRoleOf(baseline, contentSwitch, field)
    );
  }
  return intents;
} // End of function intentsOf()

/**
 * The whole twenty-two-field draft to send.
 *
 * **An exhaustive literal, and it must stay one.** No property of `MatchDraft` is
 * optional, so a field left out is a compile error and a field added in a later
 * phase breaks this function rather than being silently omitted. A spread over a
 * partial would give both of those away, and what it would buy is six fewer lines.
 *
 * `regex` and all four lists go out saying *leave this alone*, which is what
 * makes an unedited field's spelling, quoting and surrounding comments survive a
 * save byte for byte; so does every field whose intent is `'Unchanged'`. Since
 * Phase 3-5-1 the draft also carries `content_switch`, built from the switch read
 * once and used for both the intents and the wire value.
 *
 * @param baseline - What the file holds.
 * @param buffers - What the controls hold.
 * @returns The draft `save_match` takes.
 */
export function matchDraftOf(baseline: MatchBaseline, buffers: MatchBuffers): MatchDraft {
  return draftWith(baseline, buffers, capturedSwitch(buffers));
} // End of function matchDraftOf()

/**
 * {@link matchDraftOf} over a switch the caller has already read once.
 *
 * @param baseline - What the file holds.
 * @param buffers - What the controls hold.
 * @param contentSwitch - The drafted switch, captured by the caller, or `null`.
 * @returns The draft `save_match` takes.
 */
function draftWith(
  baseline: MatchBaseline,
  buffers: MatchBuffers,
  contentSwitch: DraftedContentSwitch | null
): MatchDraft {
  const intents = intentsOf(baseline, buffers, contentSwitch);
  return {
    trigger: intents.trigger,
    regex: 'Unchanged',
    replace: intents.replace,
    markdown: intents.markdown,
    html: intents.html,
    image_path: intents.image_path,
    form: intents.form,
    label: intents.label,
    comment: intents.comment,
    word: intents.word,
    left_word: intents.left_word,
    right_word: intents.right_word,
    propagate_case: intents.propagate_case,
    uppercase_style: intents.uppercase_style,
    force_mode: intents.force_mode,
    force_clipboard: intents.force_clipboard,
    paragraph: intents.paragraph,
    anchor: intents.anchor,
    triggers: [],
    search_terms: [],
    vars: [],
    form_fields: [],
    content_switch: contentSwitchOf(contentSwitch)
  };
} // End of function draftWith()

/**
 * The wire's `ContentSwitch` for a drafted one, or `null`.
 *
 * The one producer of a wire switch, and it never builds `from === to`:
 * {@link chooseContentSwitch} refuses to draft one, and a hand-built draft with
 * one is answered `null` here and refused by {@link switchIsReady} before a save.
 *
 * @param drafted - The drafted switch, already captured, or `null`.
 * @returns The two keys, or `null`.
 */
export function contentSwitchOf(
  drafted: DraftedContentSwitch | null
): MatchDraft['content_switch'] {
  return drafted === null || drafted.from === drafted.to
    ? null
    : { from: drafted.from, to: drafted.to };
} // End of function contentSwitchOf()

/**
 * Starts an editing session over one snippet's seventeen fields.
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
    externalConflict: null,
    uncertaintyUnresolved: false,
    awaitingReconciliation: null,
    heldDeliveries: [],
    companions: companionsOf(match),
    clock
  };
} // End of function startMatchEditor()

/**
 * The conflict the session is showing, of either origin, or `null`.
 *
 * **Widened to the union at Phase 2d-6-2** (the 2d-6 record's §3 entry 6): the
 * external conflict first, then the save outcome's conflict arm. The transitions
 * keep the two exclusive — {@link applyObservation} retires a save conflict when
 * it raises an external one, {@link applySave} retires an external one when a
 * save ends as a conflict — so the order here decides nothing on any session
 * this module built; it is stated so that a session assembled by hand with both
 * populated gets a definite answer rather than an accidental one. A renderer
 * that needs one arm's own fields narrows through `isSaveConflict` or
 * `isExternalConflict` in `./saveOutcome.ts`, never through `source.kind` alone.
 *
 * @param session - The session to ask about.
 * @returns The conflict model, or `null` when the session is not in one.
 */
export function conflictOf(session: MatchEditorSession): ConflictModel<MatchBuffers> | null {
  return session.externalConflict ?? conflictArm(session.outcome);
} // End of function conflictOf()

/**
 * Whether this session accepts changes at all right now.
 *
 * Five reasons it may not, and the first two are 2c-1b's policy decisions carried
 * over unchanged: not while a save is in flight, and not while a conflict is
 * showing — **of either origin** since Phase 2d-6-2, because {@link conflictOf}
 * answers the external one too, and the copy and the reapply both read the
 * conflict's retained draft as the session's own. The third is this sub-phase's —
 * not after a commit whose identity could not be adopted, because there is
 * nothing left to save against. The fifth is defence in depth: not when this
 * application has said the snippet is not safely editable. A held observation
 * ({@link MatchEditorSession.awaitingReconciliation}) is deliberately **not** a
 * sixth: it restricts submission, which {@link canSave} refuses, and not
 * drafting — the window has decided nothing about the file, so there is no
 * retained-draft pairing to protect.
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
  if (!isEditable(session) || session.baseline[field].eligibility.kind !== 'editable') {
    return false;
  }
  if (!isContentField(field)) {
    return true;
  }
  const role = contentRoleOf(session.baseline, capturedSwitch(session.draft.value), field);
  return role === 'current' || role === 'open' || role === 'switchTarget';
} // End of function isFieldEditable()

/**
 * What one content key is to this session — Phase 3-5-1.
 *
 * - `current` — the file holds it, and no switch is drafted: edited in place;
 * - `open` — the file holds **no** content key at all, so any of the five may
 *   be typed into (a snippet with no content is repaired, not switched);
 * - `dormant` — the file holds another content key: writing this one would give
 *   the snippet two, so it is reached only through {@link chooseContentSwitch};
 * - `switchedAway` — the drafted switch renames this key away; its box is not
 *   edited, because its text now lives in the destination;
 * - `switchTarget` — the drafted switch renames the source to this key; its box
 *   holds the text the key will have.
 */
export type ContentRole = 'current' | 'open' | 'dormant' | 'switchedAway' | 'switchTarget';

/**
 * Whether the file holds a key, whether or not the projection modelled it.
 *
 * @param baseline - What the file holds for one field.
 * @returns `true` when the key is there as a scalar or as an unmodelled shape.
 */
function holdsKey(baseline: FieldBaseline): boolean {
  return (
    baseline.present ||
    (baseline.eligibility.kind === 'readOnly' && baseline.eligibility.reason === 'unmodelledShape')
  );
} // End of function holdsKey()

/**
 * One content key's role, from the baseline and the drafted switch.
 *
 * @param baseline - What the file holds.
 * @param contentSwitch - The drafted switch, read once by the caller, or `null`.
 * @param field - Which content key.
 * @returns Its role.
 */
export function contentRoleOf(
  baseline: MatchBaseline,
  contentSwitch: DraftedContentSwitch | null,
  field: ContentForm
): ContentRole {
  if (contentSwitch !== null) {
    if (field === contentSwitch.from) {
      return 'switchedAway';
    }
    return field === contentSwitch.to ? 'switchTarget' : 'dormant';
  }
  if (baseline[field].present) {
    return 'current';
  }
  return CONTENT_FIELDS.some((one) => holdsKey(baseline[one])) ? 'dormant' : 'open';
} // End of function contentRoleOf()

/**
 * The content key a switch would rename, or `null` when there is none to rename.
 *
 * Exactly one content key held, as an editable scalar the draft has not asked to
 * remove: a snippet with two content keys is a shape to repair, not to switch,
 * and a removed or ineligible key has nothing a rename could keep.
 *
 * @param baseline - What the file holds.
 * @param buffers - What the controls hold.
 * @returns The source key, or `null`.
 */
function switchSourceOf(baseline: MatchBaseline, buffers: MatchBuffers): ContentForm | null {
  const held = CONTENT_FIELDS.filter((field) => holdsKey(baseline[field]));
  const only = held[0];
  if (held.length !== 1 || only === undefined) {
    return null;
  }
  return baseline[only].present &&
    baseline[only].eligibility.kind === 'editable' &&
    !buffers[only].removed
    ? only
    : null;
} // End of function switchSourceOf()

/**
 * Whether a drafted switch may be sent, or `true` when none is drafted.
 *
 * **The confirmation is here, and so is the shape** (ruling 8): an unconfirmed
 * switch is never sent, and neither is one whose keys the baseline does not hold
 * in the state the switch was drafted against — which a hand-built buffer can
 * express and {@link chooseContentSwitch} never drafts.
 *
 * @param baseline - What the file holds.
 * @param contentSwitch - The drafted switch, read once by the caller, or `null`.
 * @returns `true` when there is nothing to hold the save back for.
 */
export function switchIsReady(
  baseline: MatchBaseline,
  contentSwitch: DraftedContentSwitch | null
): boolean {
  if (contentSwitch === null) {
    return true;
  }
  const source = baseline[contentSwitch.from];
  const destination = baseline[contentSwitch.to];
  return (
    contentSwitch.confirmed &&
    contentSwitch.from !== contentSwitch.to &&
    source.present &&
    source.eligibility.kind === 'editable' &&
    !holdsKey(destination) &&
    destination.eligibility.kind === 'editable'
  );
} // End of function switchIsReady()

/**
 * What a draft says about one companion key: the drafted intent for
 * `paragraph`, and `'Unchanged'` for `vars` and `form_fields`, which this editor
 * never drafts.
 *
 * @param key - The companion key.
 * @param intents - The draft's intents.
 * @returns The intent.
 */
function companionIntentOf(
  key: CompanionKey,
  intents: Readonly<Record<EditableField, DraftField<string>>>
): DraftField<string> {
  return key === 'paragraph' ? intents.paragraph : 'Unchanged';
} // End of function companionIntentOf()

/**
 * Whether a wire draft switches content kind **and** removes a companion key —
 * ruling 8, Phase 3-5-1's review fix.
 *
 * Asked of the **built draft**, which is the captured candidate's own values:
 * a removal drafted before the switch was chosen and one drafted after it are the
 * same `paragraph: 'Remove'` here. Rust refuses the same batch
 * (`SubstitutionConflictsWithField { field: paragraph }`); this is the model's
 * refusal before anything is sent.
 *
 * @param draft - The draft that would be sent.
 * @returns `true` when it would remove a companion beside a switch.
 */
export function removesACompanion(draft: MatchDraft): boolean {
  return draft.content_switch !== null && draft.paragraph === 'Remove';
} // End of function removesACompanion()

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
  const next: Record<EditableField, FieldBuffer> & {
    contentSwitch: DraftedContentSwitch | null;
  } = { ...buffers };
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
  if (!isFieldEditable(session, field) || unreadableIn(field, text)) {
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
  const drafted = capturedSwitch(session.draft.value);
  if (drafted !== null && (field === drafted.from || field === drafted.to || field === 'paragraph')) {
    // Neither key of a drafted switch is removed: the source is renamed and the
    // destination is created by the switch. Nor is `paragraph`, the companion a
    // switch keeps (ruling 8). Cancelling the switch comes first.
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
 * The content keys a switch may rename to right now — Phase 3-5-1.
 *
 * **The choices a screen offers, derived from the session alone**: the source is
 * the one content key the baseline holds (or the drafted switch's own source),
 * and a target is any other content key the file does not hold in any shape and
 * that is eligible — a key the projection carries as an unmodelled shape would
 * make the rename a duplicate, which Rust refuses by name.
 *
 * **R37, stated where it binds**: the view that draws these, the choice list and
 * the submission identity ({@link beginSave}'s `content_switch` and
 * `session.match`) all come from the one projection this session was seeded
 * from — one read, at {@link startMatchEditor} — and a component that derives
 * them in one synchronous block from the session it holds agrees with itself.
 * TypeScript does not force that: a caller that asks with a stale session gets
 * the stale session's answer, consistently, and the command's revision check is
 * what refuses its submission.
 *
 * @param session - The session to ask about.
 * @returns The keys, in {@link CONTENT_FIELDS} order; empty when no switch can
 *   be drafted.
 */
export function contentSwitchTargets(session: MatchEditorSession): readonly ContentForm[] {
  if (!isEditable(session)) {
    return [];
  }
  const buffers = session.draft.value;
  const drafted = capturedSwitch(buffers);
  const from = drafted === null ? switchSourceOf(session.baseline, buffers) : drafted.from;
  if (from === null) {
    return [];
  }
  return CONTENT_FIELDS.filter(
    (field) =>
      field !== from &&
      !holdsKey(session.baseline[field]) &&
      session.baseline[field].eligibility.kind === 'editable'
  );
} // End of function contentSwitchTargets()

/**
 * Drafts a switch of content kind to `to`, unconfirmed — Phase 3-5-1.
 *
 * **One compound intention, all or nothing** (rulings 8 and 23): the source key is
 * renamed to `to` in place and its text travels with it **unconverted** — the
 * destination's box is given exactly what the source's box held, and nothing
 * here rewrites markup or paths. No companion key is removed; the preview names
 * the ones that stay. Choosing a second target while one is drafted re-points the
 * switch, carrying whatever the destination's box now holds, and the confirmation
 * is dropped, because what was confirmed was the first target.
 *
 * A structural action: its own history step, so undo takes it back whole.
 *
 * @param session - The session being edited.
 * @param to - The content key to switch to.
 * @returns The session with the switch drafted, or the same session when `to` is
 *   not one of {@link contentSwitchTargets} or is already the drafted target.
 */
export function chooseContentSwitch(
  session: MatchEditorSession,
  to: ContentForm
): MatchEditorSession {
  if (!contentSwitchTargets(session).includes(to)) {
    return session;
  }
  const buffers = session.draft.value;
  const drafted = capturedSwitch(buffers);
  const from = drafted === null ? switchSourceOf(session.baseline, buffers) : drafted.from;
  if (from === null || (drafted !== null && drafted.to === to)) {
    return session;
  }
  if (intentsOf(session.baseline, buffers, drafted).paragraph === 'Remove') {
    // A companion removal drafted before the switch: the switch would remove a
    // companion beside it (ruling 8). Restoring `paragraph` comes first.
    return session;
  }
  const carried = drafted === null ? buffers[from].text : buffers[drafted.to].text;
  const next: Record<EditableField, FieldBuffer> = { ...buffers };
  if (drafted !== null) {
    next[drafted.to] = { text: session.baseline[drafted.to].value, removed: false };
  }
  next[to] = { text: carried, removed: false };
  const value: MatchBuffers = { ...next, contentSwitch: { from, to, confirmed: false } };
  return { ...session, draft: editDraft(session.draft, value), group: null, sendFailure: null };
} // End of function chooseContentSwitch()

/**
 * Confirms the drafted switch after its preview — Phase 3-5-1, ruling 8.
 *
 * The confirmation is part of the drafted value, so it is its own history step
 * and undo withdraws it; {@link canSave} refuses until it has happened.
 *
 * @param session - The session being edited.
 * @returns The session with the switch confirmed, or the same session when none
 *   is drafted, it is already confirmed, or the session is not accepting changes.
 */
export function confirmContentSwitch(session: MatchEditorSession): MatchEditorSession {
  if (!isEditable(session)) {
    return session;
  }
  const buffers = session.draft.value;
  const drafted = capturedSwitch(buffers);
  if (drafted === null || drafted.confirmed) {
    return session;
  }
  const value: MatchBuffers = { ...buffers, contentSwitch: { ...drafted, confirmed: true } };
  return { ...session, draft: editDraft(session.draft, value), group: null, sendFailure: null };
} // End of function confirmContentSwitch()

/**
 * Withdraws the drafted switch, giving its text back to the source's box.
 *
 * Nothing typed into the destination is lost: the source's box is given what the
 * destination's box holds, and the destination goes back to what the file holds
 * for it (nothing, since a target is a key the file does not have).
 *
 * @param session - The session being edited.
 * @returns The session with no switch drafted, or the same session.
 */
export function cancelContentSwitch(session: MatchEditorSession): MatchEditorSession {
  if (!isEditable(session)) {
    return session;
  }
  const buffers = session.draft.value;
  const drafted = capturedSwitch(buffers);
  if (drafted === null) {
    return session;
  }
  const next: Record<EditableField, FieldBuffer> = { ...buffers };
  next[drafted.from] = { text: buffers[drafted.to].text, removed: false };
  next[drafted.to] = { text: session.baseline[drafted.to].value, removed: false };
  const value: MatchBuffers = { ...next, contentSwitch: null };
  return { ...session, draft: editDraft(session.draft, value), group: null, sendFailure: null };
} // End of function cancelContentSwitch()

/** The cursor marker espanso reads in a `replace` body (ruling 18). */
export const CURSOR_MARKER = '$|$';

/**
 * A selection in a text control, in **UTF-16 code units** of the box's string.
 *
 * A JavaScript string index, which is what a `<textarea>`'s `selectionStart`
 * and `selectionEnd` are, and never a byte offset: the cursor action works on
 * the buffer, which is a string, and slices nothing of the file.
 */
export interface TextSelection {
  /** The first code unit selected, or the caret when nothing is. */
  readonly start: number;
  /** One past the last code unit selected; equal to `start` for a caret. */
  readonly end: number;
}

/**
 * Why the cursor action did nothing to the text, as a code with its operands —
 * never a sentence (`cursorAdvisoryKey` names the key).
 */
export type CursorAdvisory = {
  /** The body holds more than one marker, so the action neither adds nor picks. */
  readonly kind: 'severalMarkers';
  /** How many, at least two. */
  readonly count: number;
};

/** What the cursor action did. */
export type CursorActionResult =
  | {
      /** A marker was inserted in place of the selection; one history step. */
      readonly kind: 'inserted';
      /** The session with the marker drafted. */
      readonly session: MatchEditorSession;
      /** The marker's own range, for the control to select. */
      readonly selection: TextSelection;
    }
  | {
      /** The one marker already there; nothing changed. */
      readonly kind: 'selected';
      /** The same session. */
      readonly session: MatchEditorSession;
      /** The marker's range, for the control to select. */
      readonly selection: TextSelection;
    }
  | {
      /** Several markers are there; nothing changed, and a sentence is owed. */
      readonly kind: 'advisory';
      /** The same session. */
      readonly session: MatchEditorSession;
      /** Which advisory. */
      readonly advisory: CursorAdvisory;
    }
  | {
      /** The action is not offered: `replace` is not an editable body now. */
      readonly kind: 'unavailable';
      /** The same session. */
      readonly session: MatchEditorSession;
    };

/**
 * How many non-overlapping cursor markers a text holds.
 *
 * @param text - A body.
 * @returns The count.
 */
export function cursorMarkerCount(text: string): number {
  return text.split(CURSOR_MARKER).length - 1;
} // End of function cursorMarkerCount()

/**
 * Whether the cursor action is offered — `replace` only, and only while its box
 * accepts changes (ruling 18). A `replace` a drafted switch renames away is not
 * offered it; a `replace` a switch renames *to* is.
 *
 * @param session - The session to ask about.
 * @returns `true` when {@link insertCursorPosition} can do anything.
 */
export function cursorActionOffered(session: MatchEditorSession): boolean {
  return isFieldEditable(session, 'replace');
} // End of function cursorActionOffered()

/**
 * A position clamped into a text, or the text's end when it is not an integer.
 *
 * @param position - What the control reported.
 * @param length - The text's length in code units.
 * @returns A usable index.
 */
function clampedPosition(position: number, length: number): number {
  if (!Number.isInteger(position)) {
    return length;
  }
  return Math.min(Math.max(position, 0), length);
} // End of function clampedPosition()

/**
 * *Insert cursor position* — Phase 3-5-1, ruling 18. **Buffer-only**: it drafts
 * text and writes nothing, adds no finding and asks nothing of Rust.
 *
 * With no marker in the body it puts one in place of the selection, as its own
 * history step, so undo takes it back; with exactly one it answers that marker's
 * range and changes nothing; with several it answers the `severalMarkers`
 * advisory and changes nothing, because choosing which one espanso honours is
 * not this action's to decide.
 *
 * The body is read **once**, and the count, the position and the new text are
 * all taken from that one string.
 *
 * @param session - The session being edited.
 * @param selection - The body control's selection, in UTF-16 code units.
 * @returns What happened, with the session to hold.
 */
export function insertCursorPosition(
  session: MatchEditorSession,
  selection: TextSelection
): CursorActionResult {
  if (!cursorActionOffered(session)) {
    return { kind: 'unavailable', session };
  }
  const text = session.draft.value.replace.text;
  const count = cursorMarkerCount(text);
  if (count >= 2) {
    return { kind: 'advisory', session, advisory: { kind: 'severalMarkers', count } };
  }
  if (count === 1) {
    const at = text.indexOf(CURSOR_MARKER);
    return { kind: 'selected', session, selection: { start: at, end: at + CURSOR_MARKER.length } };
  }
  const first = clampedPosition(selection.start, text.length);
  const second = clampedPosition(selection.end, text.length);
  const start = Math.min(first, second);
  const end = Math.max(first, second);
  const next = `${text.slice(0, start)}${CURSOR_MARKER}${text.slice(end)}`;
  const draft = editDraft(
    session.draft,
    withField(session.draft.value, 'replace', { text: next, removed: false })
  );
  return {
    kind: 'inserted',
    session: { ...session, draft, focus: 'replace', group: null, sendFailure: null },
    selection: { start, end: start + CURSOR_MARKER.length }
  };
} // End of function insertCursorPosition()

/**
 * The dictionary key holding one cursor advisory's sentence.
 *
 * @param advisory - What {@link insertCursorPosition} answered.
 * @returns The key; its `{count}` placeholder takes `advisory.count`.
 */
export function cursorAdvisoryKey(advisory: CursorAdvisory): TranslationKey {
  switch (advisory.kind) {
    case 'severalMarkers':
      return 'browser.matchEditor.cursor.severalMarkers';
  }
} // End of function cursorAdvisoryKey()

/**
 * The exact strings offered as suggestions for two options — Phase 3-5-1,
 * ruling 10.
 *
 * **Data, not a vocabulary**: a suggestion is compared with the box's text by
 * `===` and nothing else, so `Keys` is not `keys` and neither is `keys ` — and a
 * value outside the list is kept exactly as written, never replaced, flagged as
 * wrong or normalised. The strings are espanso's own spellings and are drawn as
 * written in every language. No other field has suggestions, and none of the
 * nine options is ever turned into a boolean.
 */
export const OPTION_SUGGESTIONS: Readonly<Partial<Record<EditableField, readonly string[]>>> =
  Object.freeze({
    uppercase_style: Object.freeze(['uppercase', 'capitalize', 'capitalize_words']),
    force_mode: Object.freeze(['clipboard', 'keys'])
  });

/**
 * The suggestions for one field, or none.
 *
 * @param field - Which field.
 * @returns The exact strings, possibly none.
 */
export function suggestionsFor(field: EditableField): readonly string[] {
  return OPTION_SUGGESTIONS[field] ?? [];
} // End of function suggestionsFor()

/**
 * Puts one suggestion into its field's box, as its own history step.
 *
 * Refused unless `value` is one of that field's suggestions **exactly** — this is
 * the one door by which a suggestion is chosen, and typing is {@link editField}'s.
 *
 * @param session - The session being edited.
 * @param field - Which field.
 * @param value - The suggestion chosen.
 * @returns The session with the value drafted, or the same session.
 */
export function applySuggestion(
  session: MatchEditorSession,
  field: EditableField,
  value: string
): MatchEditorSession {
  if (!isFieldEditable(session, field) || !suggestionsFor(field).includes(value)) {
    return session;
  }
  const draft = editDraft(session.draft, withField(session.draft.value, field, { text: value, removed: false }));
  return draft === session.draft ? session : { ...session, draft, group: null, sendFailure: null };
} // End of function applySuggestion()

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
 * **"Cannot submit" is a rule of this model and not of a disabled button** —
 * Phase 2d-6-2, the 2d-6 record's §3 entry 8. Two external restrictions refuse
 * here, and {@link beginSave} asks this same function so the two boundaries
 * cannot disagree: a conflict of either origin, through {@link isEditable}, and
 * an observation the window is holding undecided
 * ({@link MatchEditorSession.awaitingReconciliation}), which is a restriction on
 * sending alone. What this forces is refusal for the session it is given; **it
 * cannot force that session to be current** (R37) — a component that asks with a
 * stale value gets an answer about that value, and one synchronous decision over
 * one snapshot is the whole of the guarantee.
 *
 * **A drafted content switch must be confirmed** (Phase 3-5-1, ruling 8), and
 * {@link switchIsReady} is where that lives: a switch cannot be submitted
 * unconfirmed, whatever a control shows.
 *
 * @param session - The session to ask about.
 * @returns `true` when {@link beginSave} would produce a submission.
 */
export function canSave(session: MatchEditorSession): boolean {
  return (
    isEditable(session) &&
    isDirty(session.draft) &&
    session.awaitingReconciliation === null &&
    switchIsReady(session.baseline, capturedSwitch(session.draft.value)) &&
    !removesACompanion(matchDraftOf(session.baseline, session.draft.value))
  );
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
 * Since Phase 3-5-1 it asks the same of a line feed in a `singleLine` field
 * ({@link fieldControlOf}), which its control would have stripped.
 *
 * @param draft - The draft that would be sent.
 * @returns `true` when some field would be written with a carriage return in it,
 *   or with a line feed its control cannot hold.
 */
function writesACarriageReturn(draft: MatchDraft): boolean {
  return EDITABLE_FIELDS.some((field) => {
    const intent = draft[field];
    return typeof intent === 'object' && unreadableIn(field, intent.Set);
  });
} // End of function writesACarriageReturn()

/**
 * Reads the session a caller currently holds — the one its registered receiver
 * has been updating — for a door or a settling transition to check against.
 *
 * **The reader 2d-6-4 set on the three operation sessions, for this one** (Phase
 * 2d-6-6a; `ReadTheInstalledSession` in `./matchDeletion.ts` states the class): a
 * door's and a reapply's operands and a settlement's replayed observations are
 * read through property access, a property read runs arbitrary code, and a getter
 * there can tell the window of a reading whose registered receiver replaces the
 * *installed* session behind the transition's back. So {@link beginSave} reads it
 * once after its last caller-controlled read and spends only while the session it
 * was handed is still the one installed; {@link reapplyToDiskVersion} rechecks the
 * installed session's blocks and conflict once, immediately before adopting; and
 * {@link applySave} / {@link saveCouldNotBeSent} replay whatever the receiver
 * appended to it during their own replay, round after round. Since Phase 2d-6-6b
 * {@link reloadTheDiskVersion} reads it too, before its adoption and once more
 * after it (raw's and restore's reload shape).
 *
 * **What it forces and what it does not, in the same sentence.** It is required,
 * so no call compiles without one, and `MatchEditor.svelte` passes one at every
 * call; what no type can force is that the closure reads the installed session
 * rather than a capture. `() => session` over the component's `$state.raw` is the
 * honest one — and, for a door handed a session derived from the installed one
 * in the same synchronous block (a consent just recorded), the closure that
 * answers the derived session while the installed one is still the session it was
 * derived from and the installed session otherwise.
 *
 * @returns The session the caller holds now.
 */
export type ReadTheInstalledSession = () => MatchEditorSession;

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
 * **Under an external conflict, or while an observation is held undecided, it
 * answers `null` when called directly** — Phase 2d-6-2, the 2d-6 record's §3
 * entry 8 — because the first line asks {@link canSave} and that is where both
 * restrictions live; a *Save anyway* pressed past a disabled control reaches
 * this and sends nothing. The same sentence applies: it refuses for the session
 * it is handed and cannot make that session current.
 *
 * **Every caller-controlled read comes first, and the installed session is read
 * once, last** (Phase 2d-6-6a — 2d-6-5's `beginSave` shape in `./rawEditor.ts`):
 * {@link canSave} is asked, the submission taken, the wire draft derived and
 * checked for a carriage return, and the waiting session spread — the spread
 * reads every own property — and only then is the installed session read through
 * `current`, once. A session that is no longer the one installed spends nothing,
 * and nothing caller-controlled runs between that read and the answer. What no
 * type forces is that the reader is honest ({@link ReadTheInstalledSession}), nor
 * anything about a caller that redefines a property of the very session it
 * handed in: a receiver replaces a session and never mutates one.
 *
 * @param session - The session to save.
 * @param current - Reads the session the caller holds now. Required.
 * @returns The waiting session, the submission and the draft, or `null` when there
 *   is nothing to save, the session may not submit, the draft would write a value
 *   this window could not read back, or the session is no longer installed.
 */
export function beginSave(
  session: MatchEditorSession,
  current: ReadTheInstalledSession
): StartedMatchSave | null {
  if (!canSave(session)) {
    return null;
  }
  const submission = submissionOf(session.draft);
  // **The candidate's switch, read once and used for the check and the draft**
  // (Phase 3-5-1): `canSave` read the live draft, and the value sent is the
  // candidate, so the confirmation is checked again on what is sent.
  const captured = capturedSwitch(submission.candidate);
  if (!switchIsReady(session.baseline, captured)) {
    return null;
  }
  const draft = draftWith(session.baseline, submission.candidate, captured);
  if (writesACarriageReturn(draft) || removesACompanion(draft)) {
    return null;
  }
  const started: StartedMatchSave = {
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
  // **The installed session, read once, after the last caller-controlled read.**
  return current() === session ? started : null;
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
  const contentSwitch = capturedSwitch(buffers);
  const intents = intentsOf(baseline, buffers, contentSwitch);
  for (const field of EDITABLE_FIELDS) {
    const was = baseline[field];
    const intent = intents[field];
    if (contentSwitch !== null && field === contentSwitch.from) {
      // The switch renamed this key away: the file no longer holds it.
      next[field] = { ...was, present: false, value: '' };
    } else if (contentSwitch !== null && field === contentSwitch.to) {
      // …and holds the destination, with the text the switch carried.
      next[field] = { ...was, present: true, value: buffers[field].text };
    } else if (intent === 'Unchanged') {
      next[field] = was;
    } else if (intent === 'Remove') {
      next[field] = { ...was, present: false, value: '' };
    } else {
      next[field] = { ...was, present: true, value: intent.Set };
    }
  } // End of the loop over the seventeen editable fields
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
 * **What it does about an external conflict, and about a delivery held during
 * the save** — Phase 2d-6-2. A `saved` or a `conflict` answer retires
 * {@link MatchEditorSession.externalConflict} (the 2d-6 record's §3 entry 7:
 * only one conflict is active, and the save's own answer is the newer fact about
 * the file); a `refused` answer wrote nothing and leaves it standing. Neither
 * is reachable from {@link beginSave} while an external conflict stands — it
 * refuses — so this is the transition keeping the invariant for a caller that
 * drove the model directly, not a path a component takes. Then, whatever the
 * answer, every delivery {@link applyObservation} held while the save was in
 * flight is replayed on top, in arrival order and through that same function, so
 * the decisions the window published before this continuation ran — the
 * settlement's, and any a sibling's re-publication provoked — have the last word
 * (entry 5) — and then, through the reader, every delivery the receiver appended
 * to the installed session during this transition's own replay (Phase 2d-6-6a,
 * 2d-6-4's pattern (b); {@link consumingHeldDeliveries}).
 *
 * @param session - The session waiting for an answer.
 * @param result - How the save ended, exactly as the transaction reported it.
 * @param adoption - What became of the adoption, from `BrowserState.saveMatch`.
 *   Required and not defaulted: a default would be this function inventing a
 *   `notOwed` for a caller that simply did not look.
 * @param current - Reads the session the caller holds now. Required.
 * @returns The session showing what the save ended as.
 */
export function applySave(
  session: MatchEditorSession,
  result: SaveResult,
  adoption: InvalidationStatus,
  current: ReadTheInstalledSession
): MatchEditorSession {
  const submission = session.submitted;
  if (submission === null) {
    return session;
  }
  const outcome = describeEditSave(result, session.draft, CONFLICT_CAPABILITIES);
  const failed = invalidationFailureMessage(adoption);
  const extraMessages = failed === null ? [] : [failed];
  if (result.outcome !== 'saved') {
    // A refusal wrote nothing and says nothing about the file, so an external
    // conflict standing over it stands still; a save conflict is the file's newer
    // conflict and retires it (entry 7).
    const refused = result.outcome === 'refused';
    return consumingHeldDeliveries(
      {
        ...session,
        phase: 'editing',
        group: null,
        outcome,
        extraMessages,
        // **A new outcome resets the reload**, so a confirmation collected for an
        // earlier conflict cannot be spent while this one is on screen.
        reload: NOT_RELOADING,
        sendFailure: null,
        externalConflict: refused ? session.externalConflict : null,
        uncertaintyUnresolved: refused ? session.uncertaintyUnresolved : false
      },
      current
    );
  }
  return consumingHeldDeliveries(
    {
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
      sendFailure: null,
      // The save ended on the file, so the disk side an earlier observation showed
      // is no longer the comparison to draw (entry 7); the success stays as history.
      externalConflict: null,
      uncertaintyUnresolved: false
    },
    current
  );
} // End of function applySave()

/**
 * Replays every delivery a session held during its save, in the order it arrived,
 * once the save's own answer is on it — the second half of the 2d-6 record's §3
 * entry 5.
 *
 * Shared by {@link applySave} and {@link saveCouldNotBeSent}, which are the two
 * ways a save in flight ends; the session handed in already carries that ending
 * and its phase is `editing`, so each held envelope goes through
 * {@link applyObservation} exactly as it would have on arrival — none is held a
 * second time — and each is applied to the session the one before it left. The
 * list is emptied **before** the first replay, so a replay cannot see itself in
 * the list, and nothing is held on what comes back.
 *
 * **Then the rounds** (Phase 2d-6-6a — 2d-6-4's pattern (b);
 * `consumingHeldDeliveries` in `./matchDeletion.ts` says why): replaying an
 * envelope reads its observation, a read runs caller code, and a getter there can
 * tell the window of a reading that it delivers at once to the installed session —
 * still `saving`, so the receiver appends it there, to a list this transition was
 * handed a copy of. So after each round the installed session is read through
 * `current`, once, and the envelopes it holds beyond the ones replayed are
 * replayed too, in arrival order, until a read finds none. **What this forces** is
 * that no envelope delivered during the save, or during this settlement, is
 * dropped when the reader answers the installed session, and that first-to-last
 * is the order; **what it cannot force** is that the window delivered them in the
 * order it decided them, which is that state's own contract, that the reader is
 * honest, or that the installed list is an extension of the one replayed — one
 * that is not is left alone — nor that the rounds end for a getter that
 * manufactures a fresh reading on every read.
 *
 * @param settled - The session with its save's answer applied and its phase back
 *   to `editing`.
 * @param current - Reads the session the caller holds now.
 * @returns The session with every held delivery applied, or the same session when
 *   none was held.
 */
function consumingHeldDeliveries(
  settled: MatchEditorSession,
  current: ReadTheInstalledSession
): MatchEditorSession {
  let queue = settled.heldDeliveries;
  let replayed: MatchEditorSession = queue.length === 0 ? settled : { ...settled, heldDeliveries: [] };
  let seen = 0;
  for (;;) {
    for (let at = seen; at < queue.length; at += 1) {
      replayed = applyObservation(replayed, queue[at]!);
    } // End of the loop over the deliveries not yet replayed
    seen = queue.length;
    const arrived = current().heldDeliveries;
    if (arrived.length <= seen || !extendsTheReplayed(arrived, queue)) {
      return replayed;
    }
    queue = arrived;
  } // End of the loop over the rounds of replay
} // End of function consumingHeldDeliveries()

/**
 * Whether one held list is the other with more appended: the same envelopes, by
 * identity, in the same positions — `extendsTheReplayed` in `./matchDeletion.ts`,
 * for this session.
 *
 * @param arrived - The installed session's list.
 * @param replayed - The list already replayed.
 * @returns `true` when `arrived` begins with every entry of `replayed`.
 */
function extendsTheReplayed(
  arrived: readonly ObservationDelivery[],
  replayed: readonly ObservationDelivery[]
): boolean {
  return replayed.every((delivery, at) => arrived[at] === delivery);
} // End of function extendsTheReplayed()

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
 * @param current - Reads the session the caller holds now, for the replay's
 *   rounds ({@link applySave}'s reason). Required.
 * @returns The session, back to editing, with the right notice raised.
 */
export function saveCouldNotBeSent(
  session: MatchEditorSession,
  mayHaveWritten: boolean,
  reason: IpcFailure | null,
  current: ReadTheInstalledSession
): MatchEditorSession {
  // The save is over, so a delivery held while it was out is applied now — the
  // settlement of an uncertain write arbitrates the held reading under that
  // uncertainty, and its `raisedWithoutReload` is what this applies (entry 5).
  return consumingHeldDeliveries(
    {
      ...session,
      phase: 'editing',
      group: null,
      sendFailure: sendFailureOf(mayHaveWritten, reason)
    },
    current
  );
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
 * **Nor does it erase an external block** — Phase 2d-6-2, the 2d-6 record's §3
 * entry 9. {@link MatchEditorSession.externalConflict},
 * {@link MatchEditorSession.uncertaintyUnresolved} and
 * {@link MatchEditorSession.awaitingReconciliation} all survive this spread, so
 * under an external conflict what this dismisses is the save outcome's panel and
 * the reload warning — `reload` goes back to idle — and the conflict, its
 * restriction on drafting and the restriction on sending all stand until an
 * explicit resolution: the reload's confirmation, a reapply, or closing. What the
 * spread forces is that those three fields are copied; what no type here forces
 * is that a later edit to this function keeps them out of the literal, and the
 * suite's *keepEditing under an external block* case is what would notice.
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
 * The conflict a reload may be asked about, or `null` when none may be.
 *
 * **The reload gate of the 2d-6 record's §3 entry 11, as one rule for the three
 * reload steps below.** A conflict raised `raisedWithoutReload` has the ordinary
 * reload withheld until the person acknowledges the uncertainty it was raised
 * under: a confirmed installation of bytes a write of this window may or may not
 * have produced would settle silently what only the person can. The view
 * withholds the control through the same fact, and these three transitions
 * refuse it, so a call made past the withheld control changes nothing (entry 8).
 *
 * @param session - The session to ask about.
 * @returns The conflict, or `null` when there is none or its reload is withheld.
 */
function reloadableConflictOf(session: MatchEditorSession): ConflictModel<MatchBuffers> | null {
  return session.uncertaintyUnresolved ? null : conflictOf(session);
} // End of function reloadableConflictOf()

/**
 * Asks to load the version on disk, which is the step **before** confirming.
 *
 * @param session - The session showing a conflict.
 * @returns The session at the warning, or the same session when no conflict is
 *   showing, one has already been asked about, or the reload is withheld under
 *   an unacknowledged write uncertainty ({@link reloadableConflictOf}).
 */
export function askToReloadDiskVersion(session: MatchEditorSession): MatchEditorSession {
  const next = reloadAsked(reloadableConflictOf(session), session.reload);
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
  const next = reloadConfirmed(reloadableConflictOf(session), session.reload);
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
 * `adopt` — a confirmation issued for another conflict, one already spent, a
 * conflict this window did not produce, an unprojected document, or a projection
 * replaced since the conflict arrived when the window does not already hold the
 * requested revision — leaves the session exactly as it was, because closing over
 * a window that did not move would report a reload that did not happen. Those are
 * `BrowserState.adoptDiskVersion`'s guards **in its order**, not a set applied
 * alike. **`alreadyThere` is not a refusal**: a window already holding the
 * requested revision is answered so, and its confirmation spent, *before* the
 * projection generation is compared at all, so the request is satisfied and this
 * session ends.
 *
 * **What no type here forces**: that `adopt`'s body does anything, and that the
 * panel reading {@link MatchEditorView.closed} really closes.
 *
 * **The installed session is read three times: once after this function's own
 * reads and immediately before the adoption, once more after it, and once last,
 * after the answer is built** (the last since 2d-6-6b's review: the confirmation
 * is snapshot through `confirmationOf` before the first read, and every read and
 * spread of the settled session happens before `settledAnswer` in `./editorSave.ts`
 * takes the last look, so a getter or `Proxy` trap that displaces it is answered
 * with what it installed and nothing caller-controlled runs after that look) (Phase 2d-6-6b —
 * 2d-6-5's review, its third finding, carried from raw's and restore's reloads).
 * The adoption is the window's, and `BrowserState.adoptDiskVersion` copies the
 * observation's projection before it decides — a read of caller data, and a getter
 * there can tell the window of a later reading, which the window decides and hands
 * to the registered receiver while this function is still inside `adopt`. So: a
 * session displaced before the adoption is not closed and the installed session is
 * answered, the window never asked. After the adoption the installed session is
 * read again; when it now shows **another conflict** (by source identity) the
 * person must decide about that one, whether the window installed this snapshot
 * or refused it as outlived, so the installed session is answered untouched and
 * nothing is closed over it; when it shows the same conflict with more recorded —
 * a wait, most of all — the refused step and the closed session are built over
 * **it**, so a wait the receiver recorded during a refused adoption survives. What
 * that cannot force is that the required reader is honest
 * ({@link ReadTheInstalledSession}): one answering a capture closes or refuses
 * what it was handed, and a delivery the receiver made during the adoption is lost
 * when the caller installs the answer.
 *
 * @param session - The session holding a confirmation.
 * @param adopt - `BrowserState.adoptDiskVersion`. Called at most once.
 * @param current - Reads the session the caller holds now —
 *   `() => session` over the caller's state. Required.
 * @returns The closed session, the session at the terminal refused step, the same
 *   session, or the installed session when the one handed in is no longer it or
 *   another conflict landed during the adoption.
 */
export function reloadTheDiskVersion(
  session: MatchEditorSession,
  adopt: AdoptTheDiskVersion<MatchBuffers>,
  current: ReadTheInstalledSession
): MatchEditorSession {
  // **Every read of this function's own, taken first.**
  const step = session.reload;
  const conflict = reloadableConflictOf(session);
  // **The confirmation this spends, snapshot before the installed-session read**
  // (2d-6-6b's review, its one blocker): the step is caller data, and asking it
  // after that read would run a getter past the last look.
  const confirmation = conflict === null ? null : confirmationOf(step);
  // **The installed session, read once, after those reads and immediately
  // before the adoption.** A session no longer installed is not closed, and
  // what is installed is answered so the caller keeps it.
  const installed = current();
  if (installed !== session) {
    return installed;
  }
  if (conflict === null || confirmation === null) {
    return session;
  }
  const spend = adopt(conflict, confirmation) === 'refused' ? 'refused' : 'satisfied';
  // **Read once more, after the adoption**, which ran the window's own reads.
  const settled = current();
  if (settled !== session && conflictOf(settled)?.source !== conflict.source) {
    // A replacing verdict landed during the adoption: the conflict the receiver
    // installed is the one to decide about now, and nothing is closed over it.
    return settledAnswer(settled, settled, current);
  }
  if (spend === 'refused') {
    // **A terminal step rather than the session unchanged**, which is the
    // 2c-4a-3a review’s finding 3: the window said no without a word about which
    // of `adoptDiskVersion`'s ordered guards produced it, so the control stops
    // being offered and the panel says so. That is a decision about what to draw
    // and **not** a claim that a later ask would be refused too — a refusal spends
    // nothing. *Keep editing* writes NOT_RELOADING back. Built over the settled
    // session, so a wait recorded during the adoption is carried forward.
    return settledAnswer(settled, { ...settled, reload: RELOAD_REFUSED }, current);
  }
  // **Built first, then the final installed-session read** (2d-6-6b's review):
  // the spread reads the settled session, and nothing caller-controlled may run
  // after the look `settledAnswer` takes.
  return settledAnswer(
    settled,
    {
      ...settled,
      submitted: null,
      outcome: null,
      extraMessages: [],
      group: null,
      reload: NOT_RELOADING,
      sendFailure: null,
      // The conflict of either origin is resolved by the reload that ends this
      // session, and a closed session says nothing about the file any more.
      externalConflict: null,
      uncertaintyUnresolved: false,
      awaitingReconciliation: null,
      closed: true
    },
    current
  );
} // End of function reloadTheDiskVersion()

/**
 * Takes the window's decision about one watcher observation of this session's
 * file — Phase 2d-6-2, the 2d-6 record's §3 entries 6, 7, 11 and 12.
 *
 * **The session's receiver, as a value.** A component registers a function through
 * `BrowserState.registerObservationReceiver` that calls this with the envelope and
 * installs what comes back (`MatchEditor.svelte`, since Phase 2d-6-6b); the decision itself is here,
 * so that a suite can drive every arm without a window. It never re-arbitrates:
 * the envelope carries one decision the window reached, the same object every
 * receiver over the file was handed, and this combines it with the session's own
 * draft and declared capabilities (entry 4) and reads none of the window's tables.
 *
 * **Every verdict has a named action, switched with a `never` terminus** (entry
 * 11, plus the seventh arm Phase 2d-6-1b added):
 *
 * | Verdict | What this does |
 * |---|---|
 * | `raised` | builds the external model from the observation and the retained draft |
 * | `raisedWithoutReload` | the same, and records that the reload is withheld until the uncertainty is acknowledged |
 * | `supersedes` | `supersedeConflict` over the conflict shown — its draft kept, its disk side replaced |
 * | `coalesced` | keeps the model, its source identity and the reload step |
 * | `notLater` | changes nothing |
 * | `retained` | records the held observation as a restriction on sending; no disk comparison, no origin |
 * | `writtenHere` | lifts the restriction recorded for that observation, and changes nothing else |
 *
 * **Every replacing verdict resets the reload step and retires a save conflict**
 * (entries 7 and 12): the confirmation a person collected for the conflict that
 * was on screen must not be spendable against the one that replaced it, and a
 * save conflict's outcome is retired so that only one conflict is active — a
 * committed success or a refusal in `outcome` stays as history. A displayed
 * reapply result is invalidated by the same transition, because a panel shows one
 * only while its `ReapplyAttempt.session` is the session on screen
 * (`reapplyToShow` in `./reapply.ts`) and every arm that changes anything answers
 * a new session. `supersedes` builds through `supersedeConflict` when a conflict
 * is shown — the retained draft is read off the model being replaced, never
 * chosen here — and through `describeExternalConflict` over the session's draft
 * when none is, which is the same value: a conflict refuses every edit, so the
 * two drafts are one object. The `superseded` origin the verdict names is not
 * compared with the shown conflict's: the envelope is the window's decision about
 * the file, and a session that re-checked it would be arbitrating.
 *
 * **A wait ends with the decision about what was awaited.** Whatever the verdict,
 * a delivery whose observation is the one
 * {@link MatchEditorSession.awaitingReconciliation} holds — by identity — lifts
 * that restriction first; `writtenHere` is the arm that does nothing but that.
 *
 * **During this session's own save the envelope is appended to the held list, not
 * applied** (entry 5): see {@link MatchEditorSession.heldDeliveries} for what the
 * list guarantees and what it does not. A closed session takes nothing.
 *
 * **What it forces and what it does not, in the same sentence.** It forces that
 * every arm of `ObservationVerdict` has an action here — an eighth arm is a
 * compile error at the terminus — and that no arm installs, adopts, spends or
 * calls a command, which its signature cannot prove and the command spy at zero
 * in `workspace.test.ts` does. It cannot force that a component registers it,
 * calls it with every envelope, or installs what it answers; nor that the
 * envelope was sealed by the window rather than assembled by hand, since
 * `ObservationDelivery` is an ordinary interface. The only caller-controlled
 * reads are the envelope's two fields and the verdict's `kind`, each read once
 * before anything is decided.
 *
 * @param session - The session over the observation's file.
 * @param delivery - What the window decided, sealed with the observation.
 * @returns The session after the decision, or the same session when the verdict
 *   changes nothing about it.
 */
export function applyObservation(
  session: MatchEditorSession,
  delivery: ObservationDelivery
): MatchEditorSession {
  if (session.closed) {
    return session;
  }
  // **The caller-controlled reads, taken once and first.** The envelope is a
  // constructor's frozen literal when the window sealed it and an ordinary object
  // when a caller did; either way nothing below reads it again.
  const observation = delivery.observation;
  const kind = delivery.verdict.kind;
  if (session.phase === 'saving') {
    return { ...session, heldDeliveries: [...session.heldDeliveries, delivery] };
  }
  // The decision about the awaited observation ends the wait for it, whatever
  // the decision is; any other observation leaves the wait standing.
  const awaited = session.awaitingReconciliation;
  const stillAwaited = awaited === observation ? null : awaited;
  switch (kind) {
    case 'retained':
      return { ...session, awaitingReconciliation: observation };
    case 'writtenHere':
    case 'coalesced':
    case 'notLater':
      return stillAwaited === awaited ? session : { ...session, awaitingReconciliation: stillAwaited };
    case 'raised':
    case 'supersedes':
      return replacedBy(session, observation, false, stillAwaited);
    case 'raisedWithoutReload':
      return replacedBy(session, observation, true, stillAwaited);
    default: {
      const unreachable: never = kind;
      return unreachable;
    }
  }
} // End of function applyObservation()

/**
 * The session after a verdict that puts a new origin in front of it.
 *
 * The shared body of the three replacing arms of {@link applyObservation}, which
 * documents what happens here; this is the one place the external model is built
 * for this surface, so the two ways of building it — over the shown conflict's
 * retained draft, or over the session's own — are written once.
 *
 * @param session - The session, not closed and not saving.
 * @param observation - The observation the verdict is about.
 * @param uncertaintyUnresolved - Whether the verdict was `raisedWithoutReload`.
 * @param awaitingReconciliation - What is still awaited after this delivery.
 * @returns The session showing the new conflict.
 */
function replacedBy(
  session: MatchEditorSession,
  observation: ExternalConflictObservation,
  uncertaintyUnresolved: boolean,
  awaitingReconciliation: ExternalConflictObservation | null
): MatchEditorSession {
  const shown = conflictOf(session);
  const externalConflict =
    shown === null
      ? describeExternalConflict(observation, session.draft, CONFLICT_CAPABILITIES)
      : supersedeConflict(shown, observation, CONFLICT_CAPABILITIES);
  // A save conflict is retired with its submission (entry 7); a refusal or a
  // success stays, as history, with the submission a refusal's consent needs.
  const retiring = conflictArm(session.outcome) !== null;
  return {
    ...session,
    externalConflict,
    uncertaintyUnresolved,
    awaitingReconciliation,
    outcome: retiring ? null : session.outcome,
    submitted: retiring ? null : session.submitted,
    extraMessages: retiring ? [] : session.extraMessages,
    group: null,
    // Entry 12: the confirmation collected for the conflict that was on screen is
    // not spendable against this one. `adoptDiskVersion` would refuse it too, but
    // the warning it was collected under would stay on screen saying the wrong
    // thing until somebody pressed it (the record's §5.7).
    reload: NOT_RELOADING
  };
} // End of function replacedBy()

/**
 * How a surface asks the window to end the uncertainty hold its conflict was
 * raised under, as this module sees it — Phase 2d-6-2.
 *
 * **Two answers, and the window's two members behind them.** The honest closure
 * mints through `BrowserState.uncertaintyAcknowledgementFor(source)` and spends
 * through `BrowserState.acknowledgeWriteUncertainty`, answering `acknowledged`
 * only when the second did; `refused` covers a mint that answered `null` and a
 * spend the window refused alike, because to this surface both mean the hold
 * stands. **Which origin is passed is this module's honesty**: it hands over the
 * shown conflict's own `source`, which is the snapshot the person is looking at.
 * Nothing in TypeScript stops a caller passing a closure that answers
 * `acknowledged` without asking the window, and such a caller compiles.
 */
export type AcknowledgeTheUncertainty = (
  source: ExternalChangeConflictSource
) => 'acknowledged' | 'refused';

/**
 * Records that the person has reviewed the disk snapshot and the window has ended
 * the uncertainty hold — Phase 2d-6-2, the 2d-6 record's §3 entries 14 and 15.
 *
 * **It rebuilds the conflict's availability and nothing else.** The conflict stays
 * exactly as it was, the draft with it; what changes is that the ordinary reload
 * is offered again — from its idle step, so it still needs its own two-step
 * confirmation and `adoptDiskVersion` — and the reapply is no longer refused for
 * the uncertainty. It installs nothing, mints no reload consent and re-observes
 * nothing; the window's member it calls does none of those either.
 *
 * **Asked at most once per call, and only when there is something to end**: a
 * session with no external conflict, or whose conflict was raised under no
 * uncertainty, answers itself unchanged without asking. A `refused` leaves the
 * session unchanged too — the window said no, and its own reasons are decisions
 * 2d-6-9 draws — so the person may ask again against the state as it now stands.
 *
 * **What it cannot see.** The window's hold can end without this — a later
 * definite write of this window's own, or `open()` — and nothing delivers that to
 * a session; a conflict raised under uncertainty then stays withheld here until a
 * fresh verdict replaces it or this is asked and the window, whose hold is gone,
 * refuses. That gap is stated rather than closed; see the phase record.
 *
 * @param session - The session showing a conflict raised under uncertainty.
 * @param acknowledge - The window's two acknowledgement members, composed.
 * @returns The session with its reload and reapply available again, or the same
 *   session.
 */
export function acknowledgeSnapshot(
  session: MatchEditorSession,
  acknowledge: AcknowledgeTheUncertainty
): MatchEditorSession {
  const conflict = session.externalConflict;
  if (session.closed || conflict === null || !session.uncertaintyUnresolved) {
    return session;
  }
  if (acknowledge(conflict.source) !== 'acknowledged') {
    return session;
  }
  return { ...session, uncertaintyUnresolved: false, reload: NOT_RELOADING };
} // End of function acknowledgeSnapshot()

/**
 * What one field's retained intent can do against the newly parsed projection.
 *
 * **Four arms, and three of them emit something different.** `applicable` keeps the
 * intent as it was, `satisfied` emits `'Unchanged'` because the file already says
 * what the person asked for, `unchanged` emits `'Unchanged'` because the person
 * asked for nothing, and `collision` emits nothing at all — it stops the whole
 * reapply.
 *
 * **`satisfied` and `unchanged` are not one arm**, although both write nothing:
 * the first is a drafted change the disk has already made and the second is no
 * drafted change, and the consult's Q9 names *"all changes reapplied" when some
 * were merely already satisfied* as this phase's likeliest false sentence. Keeping
 * them apart is what lets 2c-4b-3 say which happened.
 */
export type FieldReapplyVerdict =
  | {
      /** The drafted change still applies to the new projection unchanged. */
      readonly kind: 'applicable';
      /**
       * The intent to send, which is the one the retained draft derived.
       *
       * `'Unchanged'` is excluded by the type, not merely absent by construction:
       * an applicable verdict is a field that **would be written**, and the two
       * arms that write nothing are `satisfied` and `unchanged`.
       */
      readonly intent: Exclude<DraftField<string>, 'Unchanged'>;
    }
  | {
      /** The disk already holds what the drafted change asked for. */
      readonly kind: 'satisfied';
    }
  | {
      /** The retained draft asked for nothing here. */
      readonly kind: 'unchanged';
    }
  | {
      /**
       * The new projection does not hold this field in the state the draft was
       * built against, and does not already satisfy it. Blocks the reapply.
       *
       * **The name is narrower than the predicate, and the sentence is written
       * against the predicate** (2c-4b-3c-2 §11.5). `collision` reads as *two
       * values fighting*, and {@link sameBaselineState} compares presence,
       * value **and eligibility** — so a field whose value on disk did not
       * change at all lands here when the projection made it ineligible, and in
       * the sharpest sub-case the disk holds exactly the drafted value while
       * being ineligible. `browser.matchEditor.reapply.fieldCollisions` was
       * reworded because it said the disk *had changed* those fields' values;
       * it now names the disjunction this predicate actually is.
       */
      readonly kind: 'collision';
    };

/**
 * Whether two eligibility verdicts say the same thing.
 *
 * @param one - One verdict.
 * @param other - The other.
 * @returns `true` when both are editable, or both refuse for the same reason.
 */
function sameEligibility(one: FieldEligibility, other: FieldEligibility): boolean {
  if (one.kind === 'editable' || other.kind === 'editable') {
    return one.kind === other.kind;
  }
  return one.reason === other.reason;
} // End of function sameEligibility()

/**
 * Whether the new projection holds a field in exactly the state the old one did.
 *
 * **Three things, and the consult's Q4 names all three**: key presence, logical
 * scalar text, and eligibility. Comparing the buffers instead would ask whether the
 * person's *draft* still matches, which says nothing about what the file now holds;
 * comparing presence and value alone would call a field that has become
 * undecodable, zero-width or unmodelled "the same state" and then write into it.
 *
 * @param was - What the file held when the session was seeded.
 * @param now - What the newly parsed projection holds.
 * @returns `true` when the field is, for a save's purposes, untouched.
 */
function sameBaselineState(was: FieldBaseline, now: FieldBaseline): boolean {
  return (
    was.present === now.present &&
    was.value === now.value &&
    sameEligibility(was.eligibility, now.eligibility)
  );
} // End of function sameBaselineState()

/**
 * What one field's retained intent does against the newly parsed projection.
 *
 * The consult's Q4 table, one row per branch and in the consult's own order:
 *
 * | Old intent | New disk field | Result |
 * |---|---|---|
 * | `Unchanged` | anything | `unchanged` — the disk field is preserved exactly |
 * | `Set(x)` | exactly the old baseline state | `applicable`, emitting `Set(x)` |
 * | `Set(x)` | already present as editable text `x` | `satisfied` |
 * | `Remove` | exactly the old baseline state | `applicable`, emitting `Remove` |
 * | `Remove` | absent, and the key is editable | `satisfied` |
 * | `Set`/`Remove` | anything else, or newly ineligible | `collision` |
 *
 * **The two `satisfied` rows require the new field to be editable, and that is not
 * decoration.** A key the file *has* but whose value the projection did not model
 * reads as `present: false` — `projectedScalar` answers `null` for it — so *absent*
 * on its own would call a `label:` that has become a mapping "already removed" and
 * write nothing while the key stayed. `fieldEligibility` answers `unmodelledShape`
 * for exactly that case, which is what the editable test excludes.
 *
 * **The rows are disjoint and the order is presentation only.** A `Set(x)` implies
 * the old baseline did not already hold `x` — `fieldIntent` answers `'Unchanged'`
 * when a present field's buffer equals its value, and refuses an empty buffer over
 * an absent key — so *the new state equals the old* and *the new state is `x`*
 * cannot both hold. The same argument holds for `Remove`, which implies the old key
 * was present.
 *
 * @param was - What the file held for this field when the session was seeded.
 * @param buffer - What the retained draft holds for it.
 * @param now - What the newly parsed projection holds for it.
 * @returns The verdict, with the intent to send when there is one.
 */
export function fieldReapply(
  was: FieldBaseline,
  buffer: FieldBuffer,
  now: FieldBaseline
): FieldReapplyVerdict {
  const intent = fieldIntent(was, buffer);
  if (intent === 'Unchanged') {
    return { kind: 'unchanged' };
  }
  if (sameBaselineState(was, now)) {
    return { kind: 'applicable', intent };
  }
  const editable = now.eligibility.kind === 'editable';
  if (intent === 'Remove') {
    return !now.present && editable ? { kind: 'satisfied' } : { kind: 'collision' };
  }
  return now.present && editable && now.value === intent.Set
    ? { kind: 'satisfied' }
    : { kind: 'collision' };
} // End of function fieldReapply()

/**
 * What a reapply does with a drafted content switch — Phase 3-5-1.
 *
 * **All or nothing** (ruling 23): the switch is one intent over two keys, and
 * it is `applicable` only when the new projection holds **both** in the state
 * the draft was built against; `satisfied` when the disk already holds the
 * destination as editable text equal to what the switch would write and no longer
 * holds the source; and a `collision` of both keys otherwise.
 */
export type SwitchReapplyVerdict = 'applicable' | 'satisfied' | 'collision';

/**
 * The reapply verdict of a drafted switch.
 *
 * @param was - What the file held when the session was seeded.
 * @param buffers - What the retained draft holds.
 * @param now - What the newly parsed projection holds.
 * @param contentSwitch - The retained switch, read once by the caller.
 * @returns The verdict.
 */
function switchReapply(
  was: MatchBaseline,
  buffers: MatchBuffers,
  now: MatchBaseline,
  contentSwitch: DraftedContentSwitch
): SwitchReapplyVerdict {
  const { from, to } = contentSwitch;
  if (sameBaselineState(was[from], now[from]) && sameBaselineState(was[to], now[to])) {
    return 'applicable';
  }
  const sourceGone = !holdsKey(now[from]) && now[from].eligibility.kind === 'editable';
  const destinationThere =
    now[to].present && now[to].eligibility.kind === 'editable' && now[to].value === buffers[to].text;
  return sourceGone && destinationThere ? 'satisfied' : 'collision';
} // End of function switchReapply()

/** What a reapply would do with all seventeen fields and a drafted switch. */
export interface MatchReapplyPlan {
  /**
   * One verdict per field, in {@link EDITABLE_FIELDS} order.
   *
   * **The two keys of a drafted switch carry the switch's verdict** (Phase
   * 3-5-1): both `collision` together, both `satisfied` together, and when the
   * switch applies the source is `unchanged` (it is renamed, not written) and the
   * destination is `applicable` with its `Set` when the text differs from the
   * source's, `unchanged` when the bytes are kept. {@link MatchReapplyPlan.contentSwitch}
   * is the switch's own verdict.
   */
  readonly verdicts: Readonly<Record<EditableField, FieldReapplyVerdict>>;
  /** The drafted switch's verdict, or `null` when none was retained. */
  readonly contentSwitch: SwitchReapplyVerdict | null;
  /**
   * The drafted fields the new projection does not hold in the state the draft
   * was built against, in field order.
   *
   * **Any one of them blocks the whole reapply** (consult Q4): *Keep my draft*
   * claims one retained intention, and saving the safe fields only would strand the
   * rest while looking successful. Per-field manual resolution is 2c-4c's.
   *
   * **"Moved under a drafted change" is what this used to say and it was too
   * strong**: presence, value and eligibility are three ways to differ, and only
   * two of them are a change to what the file *says*. The rendered sentence names
   * all three; see {@link FieldReapplyVerdict}'s `collision` arm.
   */
  readonly collisions: readonly EditableField[];
  /**
   * The buffers to hold over the new baseline.
   *
   * Built so that {@link fieldIntent} over the **new** baseline derives exactly the
   * intent each verdict names: an `applicable` `Set` puts its text in the box, an
   * `applicable` `Remove` marks the key removed, and everything else holds whatever
   * the new projection holds. Empty of meaning when {@link MatchReapplyPlan.collisions}
   * is not empty, because nothing is then built from it.
   */
  readonly buffers: MatchBuffers;
  /** Whether any field would still be written. */
  readonly writesAnything: boolean;
}

/**
 * What a reapply would do with every field, without doing any of it.
 *
 * Exported because it is the whole of the consult's Q4 rule and a test drives it
 * directly, one row at a time; {@link reapplyToDiskVersion} is what acts on it.
 *
 * @param was - What the file held when the session was seeded.
 * @param buffers - What the retained draft holds.
 * @param now - What the newly parsed projection holds.
 * @returns The plan, including the buffers a rebuilt session would hold.
 */
export function planMatchReapply(
  was: MatchBaseline,
  buffers: MatchBuffers,
  now: MatchBaseline
): MatchReapplyPlan {
  const verdicts: Record<EditableField, FieldReapplyVerdict> = {} as Record<
    EditableField,
    FieldReapplyVerdict
  >;
  const rebuilt: Record<EditableField, FieldBuffer> = {} as Record<EditableField, FieldBuffer>;
  let writesAnything = false;
  const contentSwitch = capturedSwitch(buffers);
  const switched =
    contentSwitch === null ? null : switchReapply(was, buffers, now, contentSwitch);
  for (const field of EDITABLE_FIELDS) {
    if (contentSwitch !== null && switched !== null && (field === contentSwitch.from || field === contentSwitch.to)) {
      verdicts[field] = switchedFieldVerdict(was, buffers, contentSwitch, switched, field);
      rebuilt[field] = switchedFieldBuffer(buffers, now, contentSwitch, switched, field);
      writesAnything ||= switched === 'applicable';
      continue;
    }
    const verdict = fieldReapply(was[field], buffers[field], now[field]);
    verdicts[field] = verdict;
    if (verdict.kind === 'applicable') {
      writesAnything = true;
    }
    // The buffer that derives this verdict's intent over the *new* baseline. A
    // `Remove` keeps the projected text beside the flag, exactly as `removeField`
    // does, so a later restore gives back what the file holds rather than a blank.
    rebuilt[field] =
      verdict.kind === 'applicable' && verdict.intent !== 'Remove'
        ? { text: verdict.intent.Set, removed: false }
        : { text: now[field].value, removed: verdict.kind === 'applicable' };
  } // End of the loop over the seventeen editable fields
  const collisions = EDITABLE_FIELDS.filter((field) => verdicts[field].kind === 'collision');
  return {
    verdicts,
    contentSwitch: switched,
    collisions,
    buffers: {
      ...rebuilt,
      contentSwitch: switched === 'applicable' ? contentSwitch : null
    },
    writesAnything
  };
} // End of function planMatchReapply()

/**
 * The verdict one key of a drafted switch reports, from the switch's own.
 *
 * @param was - What the file held when the session was seeded.
 * @param buffers - What the retained draft holds.
 * @param contentSwitch - The retained switch.
 * @param switched - The switch's verdict.
 * @param field - The source or the destination.
 * @returns That key's verdict.
 */
function switchedFieldVerdict(
  was: MatchBaseline,
  buffers: MatchBuffers,
  contentSwitch: DraftedContentSwitch,
  switched: SwitchReapplyVerdict,
  field: EditableField
): FieldReapplyVerdict {
  if (switched !== 'applicable') {
    return { kind: switched };
  }
  const intent = fieldIntent(was[field], buffers[field], switchRoleOf(was, contentSwitch, field));
  return intent === 'Unchanged' ? { kind: 'unchanged' } : { kind: 'applicable', intent };
} // End of function switchedFieldVerdict()

/**
 * The buffer one key of a drafted switch is rebuilt with.
 *
 * Applicable: the source holds what the new projection holds and the destination
 * holds the retained text, with the switch carried; otherwise both hold what the
 * new projection holds, and no switch is carried.
 *
 * @param buffers - What the retained draft holds.
 * @param now - What the newly parsed projection holds.
 * @param contentSwitch - The retained switch.
 * @param switched - The switch's verdict.
 * @param field - The source or the destination.
 * @returns The buffer.
 */
function switchedFieldBuffer(
  buffers: MatchBuffers,
  now: MatchBaseline,
  contentSwitch: DraftedContentSwitch,
  switched: SwitchReapplyVerdict,
  field: EditableField
): FieldBuffer {
  return switched === 'applicable' && field === contentSwitch.to
    ? { text: buffers[field].text, removed: false }
    : { text: now[field].value, removed: false };
} // End of function switchedFieldBuffer()

/**
 * Why a reapply of this editor's draft could not be carried out.
 *
 * **A code, never a sentence**, the rule every model in this directory follows.
 * {@link editorReapplyObstacleKey} maps it to a key, `describeEditorReapplyObstacle`
 * in `../i18n` renders it (both since 2c-4b-3), and `MatchEditor.svelte` draws it
 * beside a reapply outcome through `tEditorReapplyObstacle`.
 */
export type EditorReapplyObstacle =
  | SharedReapplyObstacle
  | {
      /**
       * The new projection does not hold drafted fields in the state the draft
       * was built against.
       *
       * Every one of them is named, so 2c-4b-3 can say **which**; the whole reapply
       * is refused all the same.
       *
       * **Presence, value or eligibility**, and the rendered sentence names all
       * three since 2c-4b-3d-1 — a field whose value did not change is here when
       * the projection made it ineligible, so *the disk changed these fields* was
       * a false reason for a correct refusal (2c-4b-3c-2 §11.5).
       */
      readonly kind: 'fieldCollisions';
      /** The fields, in {@link EDITABLE_FIELDS} order. */
      readonly fields: readonly EditableField[];
    }
  | {
      /**
       * The identified snippet is one this application will not edit at all.
       *
       * `matchEditability` over the *new* projection: a snippet that has grown a
       * blocking hazard since the session opened cannot be drafted against, and
       * handing back a session whose `canSave` is permanently `false` would be an
       * offer this editor could not keep.
       */
      readonly kind: 'targetNotEditable';
    }
  | {
      /**
       * The external observation's correspondence could not be used as evidence
       * — Phase 2d-6-2, the 2d-6 record's §3 entries 20 and 22.
       *
       * Five reasons, and all of them are about the evidence and never about the
       * snippet on disk: the reading carried no table, the table's base or disk
       * revision is not this conflict's, or the table names this snippet's base
       * identity in no row or in more than one. Rendered through
       * `tExternalEvidenceRefusal`, whose five sentences each end by bounding the
       * claim to this attempt.
       */
      readonly kind: 'externalEvidence';
      /** Which negative claim about the evidence this is. */
      readonly reason: ExternalEvidenceRefusal;
    }
  | {
      /**
       * Another accepted reading of the file has superseded the conflict's
       * evidence, whichever origin it had (ruling 26; the record's §3 entry 22).
       *
       * Answered by the live standing-origin guard, asked last: the evidence was
       * assembled, then the window said another origin stands. Its obstacle key
       * resolves to `SUPERSEDED_EVIDENCE_KEY`, drawn by `MatchEditor.svelte`
       * through `tEditorReapplyObstacle` (`tSupersededEvidence` itself has no
       * caller); the sentence says the accepted evidence changed and never that
       * the disk is newer.
       */
      readonly kind: 'supersededEvidence';
    }
  | {
      /**
       * The conflict was raised while a write of this window's own had an unknown
       * outcome, and the person has not acknowledged that — the record's §3
       * entries 11 and 22.
       *
       * A reapply ends in an adoption, and under unresolved uncertainty it may not
       * obtain one; so it is refused **before** any evidence is read or any plan
       * computed, and nothing is adopted. Rendered through the uncertainty notice's
       * own sentence (`browser.externalConflict.writeOutcomeUnknown`), which is the
       * reason exactly and adds no new key.
       */
      readonly kind: 'writeOutcomeUnknown';
    }
  | {
      /**
       * The window holds a reading of this file it has not decided about, and this
       * session may not send until it has — the record's §3 entries 8 and 11, and
       * this phase's review.
       *
       * A reapply ends by handing back a session whose ordinary *Save* sends the
       * rebuilt intents, and a session rebuilt over the adopted snapshot would carry
       * no record of the wait: the submission the held reading blocks would then
       * be allowed through the fresh session. So the reapply is refused **before**
       * any evidence is read, nothing is adopted, and the control is withheld by
       * the same fact. Rendered through the retained notice's own sentence
       * (`browser.externalConflict.observationRetained`), the reason exactly.
       */
      readonly kind: 'observationRetained';
    };

/** What a reapply of this editor's draft became. */
export type MatchEditorReapply = ReapplyOutcome<MatchEditorSession, EditorReapplyObstacle>;

/** One reapply attempt this panel made, tied to the session it left behind. */
export type EditorReapplyAttempt = ReapplyAttempt<MatchEditorSession, EditorReapplyObstacle>;

/**
 * The dictionary key holding one reapply obstacle's sentence.
 *
 * A `switch` over literal keys rather than a template, the idiom of every other
 * describer in this directory: a renamed key is a compile error here, and a new
 * member of {@link EditorReapplyObstacle} with no sentence is one too. The two
 * shared arms delegate to {@link sharedReapplyObstacleKey}.
 *
 * **`fieldCollisions` names its fields through a `{fields}` placeholder**, filled
 * by the i18n layer from {@link EditorReapplyObstacle}'s own list and the detail
 * pane's existing field labels. The sentence names *which* fields the new
 * projection does not hold in the state the draft was built against — presence,
 * value **or** eligibility, never "the disk changed their values" (2c-4b-3c-2
 * §11.5); that the whole reapply is refused is what
 * `browser.reapply.manualResolution` says above it, once.
 *
 * @param obstacle - What stopped the reapply.
 * @returns The key holding that obstacle's sentence.
 */
export function editorReapplyObstacleKey(obstacle: EditorReapplyObstacle): TranslationKey {
  switch (obstacle.kind) {
    case 'fieldCollisions':
      return 'browser.matchEditor.reapply.fieldCollisions';
    case 'targetNotEditable':
      return 'browser.matchEditor.reapply.targetNotEditable';
    case 'correspondence':
    case 'evidenceNotATarget':
      return sharedReapplyObstacleKey(obstacle);
    case 'externalEvidence':
      // The five external-evidence sentences are `./reapply.ts`'s and one
      // accessor renders them, so the key is that module's key function's.
      return externalEvidenceRefusalKey(obstacle.reason);
    case 'supersededEvidence':
      return SUPERSEDED_EVIDENCE_KEY;
    case 'writeOutcomeUnknown':
      // The notice's own key, through its own key function, so a renamed key is a
      // compile error there and here at once; no sentence of this module's own.
      return externalConflictNoticeKey({ kind: 'writeOutcomeUnknown' });
    case 'observationRetained':
      return externalConflictNoticeKey({ kind: 'observationRetained' });
  }
} // End of function editorReapplyObstacleKey()

/**
 * The session a reapply hands back: the identified snippet, with the rebuilt
 * buffers.
 *
 * **A clean session over the new projection, and the draft is the only thing
 * carried across.** The base value is what the file now holds, the current value is
 * what the person still wants, and the one step between them is the whole history —
 * consult Q4's *draw a new history boundary, clear old undo/redo and consent*.
 * Replaying the old history over a different baseline would itself be a merge
 * algorithm.
 *
 * @param target - The identified snippet, as the disk snapshot projects it.
 * @param plan - What {@link planMatchReapply} decided.
 * @param session - The session the reapply was attempted from: its clock is
 *   carried across unchanged, and so is any wait on the file
 *   ({@link rebuiltOver}).
 * @returns The session to hold.
 */
function reapplied(
  target: MatchView,
  plan: MatchReapplyPlan,
  session: MatchEditorSession
): MatchEditorSession {
  const fresh = rebuiltOver(target, session);
  // `editDraft` answers the same draft when the value did not change, which is the
  // `alreadySatisfied` case — and that case never reaches here, because the caller
  // has already answered it from `writesAnything`.
  return { ...fresh, draft: editDraft(fresh.draft, plan.buffers) };
} // End of function reapplied()

/**
 * Rebuilds this editor's retained draft over the newly parsed disk version.
 *
 * **The consult's Q4 for the match editor, and the one transition that is allowed
 * to fall back from exact item identity to a unique unchanged trigger.** The tier
 * itself is 2c-4b-1's, decided in Rust against the exact snapshot the conflict
 * carries; what happens here is what the consult permits *because* the tier is
 * weaker: every drafted field is checked against the new projection, and **any**
 * collision refuses the whole thing.
 *
 * The order is decide-then-adopt. A refusal therefore leaves the window untouched:
 * no projection replaced, no selection repaired, and the conflict's one
 * authorization unspent.
 *
 * **What it hands back and what it does not.** `reapplied` is a session whose
 * ordinary *Save* sends the same intents against the new base revision — it is not
 * a save, and the gates it will meet are the ordinary ones. `alreadySatisfied` is a
 * clean session over the adopted projection with **nothing to send**, because every
 * drafted change is already in the file. Neither claims the identified snippet is
 * the original one: where the trigger tier answered, an external delete followed by
 * an indistinguishable replacement cannot be detected at all.
 *
 * **Both origins since Phase 2d-6-2, through one entry** (the 2d-6 record's §3
 * entries 19, 20 and 22). `enterReapply` in `./reapply.ts` answers
 * `reapplyEvidenceFor`'s four arms and this switches over them, so the answers
 * stay distinct: a refused save's own `subject` is read as before; an external
 * observation's validated table is searched for **this snippet's full base
 * identity** — `session.match`, all three fields, never an array index and never
 * a node number alone — and the row's `editor` resolution is read as the subject,
 * because the editor is the one surface whose tier may fall back from the exact
 * item to a unique unchanged trigger; a refused table or row and superseded
 * evidence each end in manual resolution with their own typed sentence. What
 * follows the subject is the same for both origins: editability, the seventeen-field
 * plan, the adoption, the rebuilt session.
 *
 * **Under an unacknowledged write uncertainty, and while the window holds a
 * reading of this file undecided, it refuses before reading any evidence**
 * (entries 22 and 8): a reapply ends in an adoption, and a confirmed installation
 * of bytes a write of this window may or may not have produced is exactly what
 * the uncertainty withholds; a session rebuilt over the adopted snapshot while a
 * reading is held would be the same session with its ordinary *Save* live. Since
 * Phase 2d-6-6a both are asked **before** `enterReapply`, which reads the
 * observation's table (2d-6-4's finding 4); before that landing the entry came
 * first and this sentence claimed an order the code did not have. The view
 * withholds the control through the same facts; these are the rules for a call
 * made past it.
 *
 * **The two blocks and the conflict's identity are asked again of the installed
 * session, once, immediately before the adoption** (Phase 2d-6-6a — 2d-6-4's
 * pattern (c)): every read between the entry and the door — the table's row, the
 * row's `editor` tier, the target projection, the seventeen-field plan over it — is a
 * read of caller data, and a getter there can tell the window of a reading whose
 * receiver records a wait, an uncertainty or a new conflict on the installed
 * session. So the adoption is refused `observationRetained` or
 * `writeOutcomeUnknown` when the installed session now carries either, and
 * `supersededEvidence` when the conflict it shows is no longer the one being
 * reapplied; the rebuilt session is built before that read, the three facts are
 * read off it, and — since 2d-6-6b's review, its one blocker — one last look
 * follows them (a session displaced while they were read is answered
 * `supersededEvidence`), so nothing caller-controlled runs between the last look
 * and the adoption. **And once more after
 * the adoption** (the 2d-6-6a review, its first finding — 2d-6-5's reload shape):
 * `adoptDiskVersion` copies the observation's projection, and a getter there can
 * tell the window of a reading that the receiver records on the installed session
 * while the door is still inside `adopt`. A session that now shows **another
 * conflict** is not rebuilt over — `supersededEvidence`, and the caller keeps
 * the installed session — and the same conflict with a wait recorded hands the
 * rebuilt session that wait, so its ordinary *Save* stays refused; the answer is
 * built before a last look, and a session displaced while the settled one was
 * read is answered `supersededEvidence` and not rebuilt over. What no type
 * forces is that the reader is honest ({@link ReadTheInstalledSession}).
 *
 * **The standing-origin guard is a parameter, and `null` is accepted for one
 * stated reason.** `MatchEditor.svelte` has handed the live
 * `BrowserState.standingConflictFor` closure down since Phase 2d-6-6b, through
 * the narrow function prop `standingConflictFor`, and passes no `null`, and the
 * parameter stays nullable; the parameter is nullable rather
 * than defaulted since Phase 2d-6-6a, so that the required reader can follow it.
 * **When no guard is handed in, the supersession question is not asked by the
 * entry**: the entry is given a closure answering the
 * conflict's own origin, which `StandingOriginGuard`'s doc names as the closure
 * that defeats the check. What still refuses a superseded origin on that path is
 * `adoptDiskVersion`'s fourth check, at the door — answered `adoptionRefused`,
 * after the plan was computed and without the typed supersession sentence. So an
 * omitted guard costs a sentence and some work, never a wrong installation, and
 * this comment is where that cost is written down.
 *
 * **What no type here forces**: that `adopt`'s body does anything, that a caller
 * stops on `adoptionRefused`, that the session handed back is installed, or that
 * the guard a caller passes asks the window rather than the conflict. What is
 * closed is that no path here writes, calls a command, or adopts anything before
 * the whole rebase has been decided.
 *
 * @param session - The session showing the conflict.
 * @param adopt - `BrowserState.adoptDiskVersion`. Called at most once, and never
 *   at all on a refusal.
 * @param standing - Asks what origin stands for the file **now**;
 *   `() => browser.standingConflictFor(document)` is the honest closure. `null`
 *   asks nothing — see above for what that costs.
 * @param current - Reads the session the caller holds now, for the recheck
 *   before the adoption. Required.
 * @returns What became of the attempt.
 */
export function reapplyToDiskVersion(
  session: MatchEditorSession,
  adopt: AdoptTheDiskVersion<MatchBuffers>,
  standing: StandingOriginGuard | null,
  current: ReadTheInstalledSession
): MatchEditorReapply {
  const conflict = conflictOf(session);
  if (conflict !== null) {
    // **Before the entry, which reads the evidence** (2d-6-2's review, finding 1;
    // Phase 2d-6-6a). A blocked session reads none of it: the session may not
    // send while the window holds an undecided reading of its file, and a session
    // rebuilt over the adopted snapshot would be the same session with its
    // ordinary *Save* live.
    if (session.uncertaintyUnresolved) {
      return { kind: 'manualResolution', obstacle: { kind: 'writeOutcomeUnknown' } };
    }
    if (session.awaitingReconciliation !== null) {
      return { kind: 'manualResolution', obstacle: { kind: 'observationRetained' } };
    }
  }
  const entry = enterReapply(CONFLICT_CAPABILITIES, conflict, standing ?? unaskedGuard(conflict));
  if (entry.kind !== 'ready') {
    return entry;
  }
  const subject = subjectOfEvidence(entry.evidence, session.match);
  if (subject.kind === 'manualResolution') {
    return subject;
  }
  if (subject.kind === 'refused') {
    return { kind: 'manualResolution', obstacle: { kind: 'correspondence', reason: subject.reason } };
  }
  if (subject.kind === 'noSubject') {
    return { kind: 'manualResolution', obstacle: { kind: 'evidenceNotATarget' } };
  }
  const target = subject.target;
  if (matchEditability(target).kind !== 'unrestricted') {
    return { kind: 'manualResolution', obstacle: { kind: 'targetNotEditable' } };
  }
  const plan = planMatchReapply(session.baseline, copyOfDraft(entry.conflict), baselineOf(target));
  if (plan.collisions.length > 0) {
    return {
      kind: 'manualResolution',
      obstacle: { kind: 'fieldCollisions', fields: plan.collisions }
    };
  }
  const answer: MatchEditorReapply = plan.writesAnything
    ? { kind: 'reapplied', session: reapplied(target, plan, session) }
    : { kind: 'alreadySatisfied', session: rebuiltOver(target, session) };
  // **The installed session, read after the last caller-controlled read of the
  // reapply's own**; its three facts below are read off it, and a last look
  // follows them, before the door (2d-6-6b's review).
  const installed = current();
  if (installed.uncertaintyUnresolved) {
    return { kind: 'manualResolution', obstacle: { kind: 'writeOutcomeUnknown' } };
  }
  if (installed.awaitingReconciliation !== null) {
    return { kind: 'manualResolution', obstacle: { kind: 'observationRetained' } };
  }
  if (conflictOf(installed)?.source !== entry.conflict.source) {
    return { kind: 'manualResolution', obstacle: { kind: 'supersededEvidence' } };
  }
  // **Everything the spend needs, taken now, then one last look** (2d-6-6b's
  // review, its one blocker): the three reads above are of the installed
  // session, which is caller data, and a getter or `Proxy` trap among them can
  // displace it. The authorization reads the conflict's origin, so it is minted
  // before the look too; after it nothing caller-controlled runs before the door.
  const adopted = entry.conflict;
  const authorization = reapplyAuthorizationFor(adopted);
  if (current() !== installed) {
    return { kind: 'manualResolution', obstacle: { kind: 'supersededEvidence' } };
  }
  if (adopt(adopted, authorization) === 'refused') {
    return { kind: 'adoptionRefused' };
  }
  // **Read again after the adoption**, which read caller data of its own.
  const settled = current();
  if (conflictOf(settled)?.source !== entry.conflict.source) {
    return { kind: 'manualResolution', obstacle: { kind: 'supersededEvidence' } };
  }
  const waiting = settled.awaitingReconciliation;
  // **Built first, then one last look at the installed session** (2d-6-6b's
  // review): every read of the settled session above is caller data, and a
  // session displaced during them is not rebuilt over; nothing caller-controlled
  // runs after the look.
  const result: MatchEditorReapply = answer.kind === 'reapplied' || answer.kind === 'alreadySatisfied'
    ? { ...answer, session: { ...answer.session, awaitingReconciliation: waiting } }
    : answer;
  if (current() !== settled) {
    return { kind: 'manualResolution', obstacle: { kind: 'supersededEvidence' } };
  }
  return result;
} // End of function reapplyToDiskVersion()

/**
 * A clean session over the adopted snapshot, carrying forward the one restriction
 * that is about the file rather than about the conflict just resolved.
 *
 * **The rebuild of both success arms goes through here** (this phase's review,
 * finding 1). A held observation is a fact about the file the window has not
 * decided, not about the conflict the reapply resolved, so a session rebuilt over
 * the adopted snapshot still may not send while it stands. `reapplyToDiskVersion`
 * refuses before reaching this while one is held, so on every path this module
 * takes the value carried is `null`; it is carried all the same so that the
 * rebuild does not depend on the refusal's position for its honesty, and no test
 * can tell the two apart — which is stated here rather than claimed as coverage.
 * Everything else — the conflict, the uncertainty, the outcome, the history — is
 * the resolved conflict's and is left behind.
 *
 * @param target - The identified snippet, as the disk snapshot projects it.
 * @param session - The session the reapply was attempted from.
 * @returns A fresh session over the target, with the wait carried.
 */
function rebuiltOver(target: MatchView, session: MatchEditorSession): MatchEditorSession {
  return {
    ...startMatchEditor(target, session.clock),
    awaitingReconciliation: session.awaitingReconciliation
  };
} // End of function rebuiltOver()

/**
 * The guard {@link reapplyToDiskVersion} uses when its caller hands none in.
 *
 * It answers the shown conflict's own origin, so the supersession question the entry
 * asks last is answered *yes, it stands* without the window being asked — the closure
 * `StandingOriginGuard`'s doc names as defeating the check. It exists for a caller that
 * passes `null`; since Phase 2d-6-6b no component does — each hands the live
 * `BrowserState.standingConflictFor` closure down — so only a model suite reaches
 * it, and what it costs is stated on the caller. The origin is read once, here, off the model this module built.
 *
 * @param conflict - The conflict shown, or `null`.
 * @returns A guard that never asks the window.
 */
function unaskedGuard(conflict: ConflictModel<MatchBuffers> | null): StandingOriginGuard {
  const source: ConflictSource | null = conflict === null ? null : conflict.source;
  return (): ConflictSource | null => source;
} // End of function unaskedGuard()

/**
 * The snippet one conflict's evidence names for this editor, or why it names
 * none — the origin switch of {@link reapplyToDiskVersion}.
 *
 * **Four arms in, and each has its own answer** (the 2d-6 record's §3 entry 19).
 * Save evidence is read through `subjectCorrespondence`, as it always was. An
 * external table is searched through `correspondenceRowFor` for the editor's
 * **full** base identity (entry 20) and the found row's `editor` resolution is
 * read through `subjectResolution` — the flexible tier, which is this surface's
 * by ruling 20, and read exactly once. A refused table or row resolves to manual
 * resolution with `tExternalEvidenceRefusal`'s sentence, superseded evidence
 * with the `SUPERSEDED_EVIDENCE_KEY` sentence (entry 22). Nothing here is cast: a row is a row
 * and a `ReapplyEvidence` is a `ReapplyEvidence`.
 *
 * @param evidence - What `enterReapply` found the conflict's origin to offer.
 * @param base - This session's snippet, by the identity the base snapshot minted.
 * @returns The subject to work from, or the manual resolution to answer with.
 */
function subjectOfEvidence(
  evidence: ReapplyEvidenceAccess,
  base: MatchId
): SubjectCorrespondence | Extract<MatchEditorReapply, { kind: 'manualResolution' }> {
  switch (evidence.kind) {
    case 'saveEvidence':
      return subjectCorrespondence(evidence.evidence);
    case 'externalCorrespondence': {
      const row = correspondenceRowFor(evidence.correspondences, base);
      if (row.kind === 'refused') {
        return {
          kind: 'manualResolution',
          obstacle: { kind: 'externalEvidence', reason: row.reason }
        };
      }
      // **The row's flexible tier, read once.** `editor` is the one field of the
      // row this surface reads; `exact` is the destructive operations' and is not
      // looked at here.
      return subjectResolution(row.entry.editor);
    }
    case 'refused':
      return {
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: evidence.reason }
      };
    case 'superseded':
      return { kind: 'manualResolution', obstacle: { kind: 'supersededEvidence' } };
    default: {
      const unreachable: never = evidence;
      return unreachable;
    }
  }
} // End of function subjectOfEvidence()

/**
 * What this surface offers about a conflict.
 *
 * **`draftKind` is the permanent fact and the two booleans are not.**
 * {@link MatchBuffers} holds the strings a person typed, so the consult's Q3/Q4
 * rule gives this surface *Copy draft* — a labelled reference copy of the fields,
 * never YAML — and a confirmed reload that installs the disk projection and
 * **closes** the editor.
 *
 * **Both booleans were flipped at 2c-4a-3a, over machinery that already existed.**
 * {@link askToReloadDiskVersion}, {@link confirmDiskReload} and
 * {@link reloadTheDiskVersion} are the transition — built and wired at 2c-4a-2 and
 * driven by this module's own suite since then — and `MatchEditor.svelte`'s
 * `conflictAction` calls them from the two controls `conflictChoicesFor` now names.
 * The copy is {@link MatchEditorView.retainedDraft} put through `tDraftCopy`: a
 * labelled reference copy of the seventeen buffers, **never YAML**.
 *
 * **`offersReapply` is `true` as of 2c-4b-3**, over the transition 2c-4b-2 built
 * and this module's suite already drove. `MatchEditor.svelte`'s `conflictAction` is
 * what calls {@link reapplyToDiskVersion}, and this is the one surface whose reapply
 * may fall back from exact item identity to a unique unchanged trigger — so the
 * every-field check that follows it is what the weaker tier is paid for, and **any**
 * collision refuses the whole thing rather than writing the safe fields.
 */
export const CONFLICT_CAPABILITIES: ConflictCapabilities = {
  draftKind: 'authoredText',
  reloadOutcome: 'closesSurface',
  offersCopyDraft: true,
  offersReload: true,
  offersReapply: true,
  reapplySupport: 'supported'
};

/**
 * What this surface offers about the conflict it is showing **now**, derived from
 * the declaration and one fact about the session — Phase 2d-6-2, the 2d-6
 * record's §3 entry 11.
 *
 * The declaration above is permanent; this is the "effective capabilities" the
 * consult's Q3 names for a conflict raised under an unacknowledged write
 * uncertainty: the ordinary reload is withheld, and the reapply with it, because
 * both end in a confirmed installation of bytes a write of this window may or may
 * not have produced. **The reapply is withheld while the window holds an undecided
 * reading of the file too** (this phase's review, finding 1): a reapply hands back
 * a session whose ordinary *Save* is live, and a held reading is exactly what
 * forbids sending. The reload is not withheld for a held reading — it closes the
 * editor and sends nothing. The two permanent facts and the copy are untouched — a
 * copy writes nothing. It feeds `conflictChoicesFor`, which stays the only producer
 * of a choice list; what this cannot force is that the transitions honour the same
 * facts, which is why each of them asks {@link reloadableConflictOf} or the fields
 * themselves.
 *
 * @param session - The session to derive for.
 * @returns The capabilities to offer choices from.
 */
function effectiveCapabilitiesOf(session: MatchEditorSession): ConflictCapabilities {
  const reloadWithheld = session.uncertaintyUnresolved;
  const reapplyWithheld = reloadWithheld || session.awaitingReconciliation !== null;
  if (!reloadWithheld && !reapplyWithheld) {
    return CONFLICT_CAPABILITIES;
  }
  return {
    ...CONFLICT_CAPABILITIES,
    offersReload: !reloadWithheld,
    offersReapply: !reapplyWithheld
  };
} // End of function effectiveCapabilitiesOf()

/**
 * The notices one session owes, in the order the stronger claim comes first.
 *
 * The uncertainty first, because it is the one state under which the conflict
 * on screen offers neither way to the disk version, and the held observation
 * second. Each is answered from one session field and nothing is read twice.
 *
 * @param session - The session to describe.
 * @returns The codes, possibly none.
 */
function externalNoticesOf(session: MatchEditorSession): readonly ExternalConflictNotice[] {
  const notices: ExternalConflictNotice[] = [];
  if (session.externalConflict !== null && session.uncertaintyUnresolved) {
    notices.push({ kind: 'writeOutcomeUnknown' });
  }
  if (session.awaitingReconciliation !== null) {
    notices.push({ kind: 'observationRetained' });
  }
  return notices;
} // End of function externalNoticesOf()

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
  /** Which control draws it — {@link fieldControlOf}. */
  readonly control: FieldControl;
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
  /**
   * What this content key is to the session, or `null` for a field that is not
   * one of the five — Phase 3-5-1. A `dormant` or `switchedAway` key is not
   * editable, and its reason is this role, not a {@link FieldRefusal}.
   */
  readonly contentRole: ContentRole | null;
  /**
   * The exact strings offered for this field, or none — `uppercase_style` and
   * `force_mode` only ({@link OPTION_SUGGESTIONS}).
   */
  readonly suggestions: readonly string[];
  /**
   * Whether the box holds one of {@link EditableFieldModel.suggestions} exactly.
   * `false` for an unfamiliar value, which is kept as written: this is a fact
   * about a string comparison and never a verdict on the value.
   */
  readonly suggested: boolean;
  /**
   * Whether the screen says the value is not one of the suggestions — Phase
   * 3-5-2-1. `true` only for a field that has suggestions and a non-empty box
   * holding none of them exactly; the sentence says the value is kept as
   * written, never that it is wrong.
   */
  readonly unfamiliar: boolean;
  /**
   * The sentence a content key's role owes beside its box, or `null` —
   * Phase 3-5-2-1 ({@link contentRoleNoteOf}).
   */
  readonly roleNote: ContentRoleNote | null;
  /**
   * Whether the screen says the file does not hold this key. `false` for a key
   * whose {@link EditableFieldModel.roleNote} says what the box is instead,
   * because *typing in it adds the key* is false for a dormant key and says
   * nothing true about a switch's source or destination.
   */
  readonly saysAbsent: boolean;
  /**
   * Whether this field's block draws the *Insert cursor position* control —
   * `replace` only, and only while {@link cursorActionOffered} (ruling 18).
   */
  readonly cursorAction: boolean;
}

/**
 * What a content key's role says beside its box — Phase 3-5-2-1.
 *
 * The three {@link ContentRole}s whose box does not behave as an ordinary field:
 * a `dormant` key is not added because another content key is held; a
 * `switchedAway` key is renamed by the drafted switch; a `switchTarget` key is
 * what the switch renames to. `current` and `open` owe nothing.
 */
export type ContentRoleNote = 'dormant' | 'switchedAway' | 'switchTarget';

/**
 * The note one content role owes, or `null`.
 *
 * @param role - The field's role, or `null` for a field that is not content.
 * @returns The note, or `null` for `current`, `open` and a non-content field.
 */
export function contentRoleNoteOf(role: ContentRole | null): ContentRoleNote | null {
  return role === 'dormant' || role === 'switchedAway' || role === 'switchTarget' ? role : null;
} // End of function contentRoleNoteOf()

/**
 * The dictionary key holding one content role's sentence.
 *
 * @param note - The note {@link contentRoleNoteOf} answered.
 * @returns The key.
 */
export function contentRoleNoteKey(note: ContentRoleNote): TranslationKey {
  switch (note) {
    case 'dormant':
      return 'browser.matchEditor.contentRole.dormant';
    case 'switchedAway':
      return 'browser.matchEditor.contentRole.switchedAway';
    case 'switchTarget':
      return 'browser.matchEditor.contentRole.switchTarget';
  }
} // End of function contentRoleNoteKey()

/**
 * The option groups the editor draws, each with its fields, in the order a
 * screen shows them — Phase 3-5-2-1, ruling 10.
 *
 * The detail pane's own four groups (`describeOptions` in `./detail.ts`) and its
 * own headings, so the pane and the editor name a group alike. **`injection` is
 * the one *Insertion* group, and it holds `force_mode` and `force_clipboard` as
 * two fields**: two separately labelled text boxes, with no inferred precedence
 * between them and no migration of one into the other. Every field in
 * {@link OPTION_FIELDS} is in exactly one group; `the option groups` in
 * `scalarFields.test.ts` checks that, since no type here can.
 */
export const OPTION_GROUPS: readonly {
  readonly group: OptionGroupName;
  readonly fields: readonly EditableField[];
}[] = [
  { group: 'matching', fields: ['word', 'left_word', 'right_word'] },
  { group: 'case', fields: ['propagate_case', 'uppercase_style'] },
  { group: 'injection', fields: ['force_mode', 'force_clipboard'] },
  { group: 'other', fields: ['paragraph', 'anchor'] }
];

/**
 * One section of the editor, in the order a screen draws them — Phase 3-5-2-1.
 *
 * `fields` is a run of field blocks under an option group's heading, or under no
 * heading (`group: null`) for the trigger, the content keys, the label and the
 * comment. `contentSwitch` is where the change of content kind — its choices,
 * its preview and its confirmation — is drawn: directly under the five content
 * keys, and only when there is something to draw.
 */
export type EditorSection =
  | {
      readonly kind: 'fields';
      /** The option group's heading, or `null` for no heading. */
      readonly group: OptionGroupName | null;
      /** The field blocks, in {@link EDITABLE_FIELDS} order. */
      readonly fields: readonly EditableFieldModel[];
    }
  | { readonly kind: 'contentSwitch' };

/**
 * The editor's sections, from the field models already built.
 *
 * @param fields - The seventeen field models, in {@link EDITABLE_FIELDS} order.
 * @param switchDrawn - Whether the content-switch section has anything to draw.
 * @returns The sections.
 */
function sectionsOf(
  fields: readonly EditableFieldModel[],
  switchDrawn: boolean
): readonly EditorSection[] {
  const pick = (names: readonly EditableField[]): readonly EditableFieldModel[] =>
    fields.filter((one) => names.includes(one.field));
  const sections: EditorSection[] = [
    { kind: 'fields', group: null, fields: pick(['trigger', ...CONTENT_FIELDS]) }
  ];
  if (switchDrawn) {
    sections.push({ kind: 'contentSwitch' });
  }
  sections.push({ kind: 'fields', group: null, fields: pick(['label', 'comment']) });
  for (const { group, fields: names } of OPTION_GROUPS) {
    sections.push({ kind: 'fields', group, fields: pick(names) });
  } // End of the loop over the option groups
  return sections;
} // End of function sectionsOf()

/**
 * The dictionary key holding the sentence for why a save is held back.
 *
 * @param code - What {@link MatchEditorView.saveWithheld} answered.
 * @returns The key.
 */
export function saveWithheldKey(code: SaveWithheld): TranslationKey {
  switch (code) {
    case 'contentSwitchUnconfirmed':
      return 'browser.matchEditor.saveWithheld.contentSwitchUnconfirmed';
    case 'switchRemovesCompanion':
      return 'browser.matchEditor.saveWithheld.switchRemovesCompanion';
  }
} // End of function saveWithheldKey()

/**
 * What a drafted content switch will do, for its preview — Phase 3-5-1.
 *
 * Data only: a renderer draws it and asks for the confirmation, and every
 * sentence comes from the i18n layer.
 */
export interface ContentSwitchPreview {
  /** The key renamed away from. */
  readonly from: ContentForm;
  /** The key renamed to. */
  readonly to: ContentForm;
  /** `from`'s label, for `tDetailField`. */
  readonly fromLabel: DetailFieldName;
  /** `to`'s label, for `tDetailField`. */
  readonly toLabel: DetailFieldName;
  /** The text the renamed key will hold: the destination's box, unconverted. */
  readonly text: string;
  /**
   * Whether that text is exactly the source's projected value, in which case
   * the value's bytes are kept as the file writes them (Rust renames the key
   * token and nothing else).
   */
  readonly textKept: boolean;
  /**
   * The companion keys the snippet holds **and the drafted value keeps** — read
   * off the same intents the save would send, so a companion the draft removes is
   * never listed here (Phase 3-5-1's review fix).
   */
  readonly companionsKept: readonly CompanionKey[];
  /**
   * Companion keys the drafted value would remove beside the switch. Never sent:
   * {@link canSave} and {@link beginSave} refuse such a draft
   * ({@link removesACompanion}); it is reported so the refusal is not silent.
   */
  readonly companionsRemoved: readonly CompanionKey[];
  /** Whether the switch has been confirmed. {@link canSave} requires it. */
  readonly confirmed: boolean;
}

/** One control offering a change of content kind — Phase 3-5-2-1. */
export interface SwitchChoice {
  /** The content key the switch would rename to. */
  readonly to: ContentForm;
  /** Its label, for `tDetailField`. */
  readonly label: DetailFieldName;
  /** Whether the drafted switch already points here. */
  readonly drafted: boolean;
}

/** Why a dirty session's save is held back, as a code. */
export type SaveWithheld =
  /** A content switch is drafted and not confirmed (ruling 8). */
  | 'contentSwitchUnconfirmed'
  /**
   * A content switch is drafted beside the removal of a companion key it keeps
   * (ruling 8: a switch removes no companion field silently).
   */
  | 'switchRemovesCompanion';

/** Everything a screen needs about one session, derived on every read. */
export interface MatchEditorView {
  /** The seventeen fields, in {@link EDITABLE_FIELDS} order. */
  readonly fields: readonly EditableFieldModel[];
  /**
   * The same seventeen field models, cut into the sections a screen draws, with
   * the content-switch section placed among them — Phase 3-5-2-1
   * ({@link EditorSection}).
   */
  readonly sections: readonly EditorSection[];
  /** The drafted content switch's preview, or `null` — Phase 3-5-1. */
  readonly contentSwitch: ContentSwitchPreview | null;
  /** The content keys a switch may be drafted to now — {@link contentSwitchTargets}. */
  readonly switchTargets: readonly ContentForm[];
  /**
   * One control per switch target, for a screen to draw — Phase 3-5-2-1.
   * `drafted` marks the target the drafted switch already points at, whose
   * control would do nothing ({@link chooseContentSwitch} answers the same
   * session) and is drawn disabled.
   */
  readonly switchChoices: readonly SwitchChoice[];
  /** Whether the cursor action is offered — {@link cursorActionOffered}. */
  readonly cursorActionOffered: boolean;
  /** How many cursor markers the `replace` box holds now. */
  readonly cursorMarkers: number;
  /** Why the save is held back although the draft is dirty, or `null`. */
  readonly saveWithheld: SaveWithheld | null;
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
  /**
   * The external conflict's own lines, or empty when none is showing — Phase
   * 2d-6-2.
   *
   * **Beside {@link MatchEditorView.messages}, never merged into it.** The save
   * outcome's lines are `SaveOutcomeMessage`s and `tSaveOutcomeMessage` draws
   * them; an external conflict's first line is an `ExternalConflictMessage` that
   * accessor cannot take, so these go through `tConflictMessage`. A panel that
   * draws `view.conflict` outside the save-outcome branch (the 2d-6 record's §3
   * entry 10) draws these there, and a save conflict's lines stay where they
   * were — so nothing is drawn twice. `MatchEditor.svelte` draws these in its
   * external conflict panel since Phase 2d-6-6c-1.
   */
  readonly externalMessages: readonly ConflictMessage[];
  /**
   * What the session owes a person about an observation it cannot act on, in
   * the order the stronger claim comes first — Phase 2d-6-2.
   *
   * `writeOutcomeUnknown` while the conflict shown was raised under a write
   * uncertainty nobody has acknowledged, which is why no reload and no reapply is
   * offered; `observationRetained` while the window holds a reading of this file
   * it has not decided about, which is why nothing can be sent. Codes, never
   * sentences, and since Phase 2d-6-9b-2 no renderer draws them (no component
   * calls `tExternalConflictNotice` any more): the pane's
   * `FileReconciliationStatus.svelte` block says both states once, above the panel,
   * and `MatchEditor.svelte` reads this list only through `surfaceAcknowledgementOwed` in
   * `./reconciliationStatus.ts`, to decide whether to draw the acknowledgement.
   */
  readonly externalNotices: readonly ExternalConflictNotice[];
  /** The presentation changes a saved arm disclosed, in report order. */
  readonly notes: readonly PresentationNote[];
  /**
   * What to offer about a refusal, withdrawn once its findings are stale.
   *
   * **Withdrawn to *Keep editing* alone under an external block too** — Phase
   * 2d-6-2, the 2d-6 record's §3 entry 8: a *Save anyway* offered beside a
   * refusal while an external conflict stands, or while an observation is held
   * undecided, would be a control whose {@link beginSave} answers `null`. The
   * findings are not thereby called stale; {@link MatchEditorView.findingsAreStale}
   * keeps its own answer.
   */
  readonly refusalChoices: readonly RawSaveChoice[];
  /** Whether the findings on screen are about a draft that has since changed. */
  readonly findingsAreStale: boolean;
  /** The conflict being shown, or `null`. */
  readonly conflict: ConflictModel<MatchBuffers> | null;
  /**
   * The draft that conflict retained, labelled, in {@link EDITABLE_FIELDS} order.
   *
   * Empty whenever no conflict is showing. The conflict panel draws this **and**
   * the *Copy draft* control builds its text from the same list, so what a person
   * is told they copied is what the panel showed them.
   *
   * **It is built from the conflict's own retained draft**, through
   * `copyOfDraft`, and never from the session's current buffers: the two are
   * equal today because a conflict refuses every edit until it is dismissed, and
   * writing it that way would make the panel silently describe something else the
   * first time that stops being true.
   */
  readonly retainedDraft: readonly RetainedDraftField[];
  /** What to offer about the conflict. */
  readonly conflictChoices: readonly ConflictChoice[];
  /** Whether the warning is showing and the destructive choice is one click away. */
  readonly awaitingReloadConfirmation: boolean;
  /**
   * Whether a confirmed reload was spent and the window refused it.
   *
   * **The disclosure the panel owes for a control that has just gone.** The
   * reload is not offered again once a spend has been refused — the refusal came
   * back with no word about its cause, so this panel withholds the control rather
   * than claiming a later ask could only be refused too — and a control that
   * vanishes with nothing said in its place reads as a bug (2c-4a-3a review,
   * finding 3). Nothing was written
   * and nothing was discarded; *Keep editing* resets the step.
   */
  readonly reloadUnavailable: boolean;
  /**
   * Whether the reapply control is among {@link MatchEditorView.conflictChoices}.
   *
   * **Read from the produced list and never from the capability record**, through
   * `reapplyIsOffered`: the readiness sentence and the control it stands beside must
   * come from one authority, and a view that asked the declaration instead would be
   * expressing capability twice — the split that once let a button compile and do
   * nothing.
   */
  readonly reapplyOffered: boolean;
  /**
   * The disk side of that conflict, or `null` when none is showing.
   *
   * A union rather than a string, so *a file of zero characters is a fact about
   * the file rather than a failure to obtain it* is decided in this directory
   * once instead of in each renderer’s markup (2c-4a-3a review, finding 5).
   */
  readonly diskText: ConflictDiskText | null;
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
 * @param intent - Its intent, from {@link intentsOf}.
 * @param contentSwitch - The drafted switch, read once by the caller, or `null`.
 * @returns The field's model.
 */
function fieldModel(
  session: MatchEditorSession,
  field: EditableField,
  intent: DraftField<string>,
  contentSwitch: DraftedContentSwitch | null
): EditableFieldModel {
  const baseline = session.baseline[field];
  const buffer = session.draft.value[field];
  const editable = isFieldEditable(session, field);
  const suggestions = suggestionsFor(field);
  const switched = contentSwitch !== null && (field === contentSwitch.from || field === contentSwitch.to);
  const contentRole = isContentField(field)
    ? contentRoleOf(session.baseline, contentSwitch, field)
    : null;
  const roleNote = contentRoleNoteOf(contentRole);
  const suggested = suggestions.includes(buffer.text);
  return {
    field,
    label: fieldLabelName(field),
    text: buffer.text,
    present: baseline.present,
    removed: buffer.removed,
    editable,
    control: fieldControlOf(field),
    refusal: baseline.eligibility.kind === 'readOnly' ? baseline.eligibility.reason : null,
    shown: baseline.shown,
    intent,
    canRemove: editable && baseline.present && !buffer.removed && !switched,
    canRestore: editable && buffer.removed,
    contentRole,
    suggestions,
    suggested,
    unfamiliar: suggestions.length > 0 && buffer.text !== '' && !suggested,
    roleNote,
    saysAbsent: !baseline.present && roleNote === null,
    cursorAction: field === 'replace' && cursorActionOffered(session)
  };
} // End of function fieldModel()

/**
 * Why a drafted switch holds the save back, or `null`.
 *
 * @param contentSwitch - The drafted switch, read once by the caller.
 * @param intents - The intents built from that same read.
 * @returns The code.
 */
function saveWithheldOf(
  contentSwitch: DraftedContentSwitch | null,
  intents: Readonly<Record<EditableField, DraftField<string>>>
): SaveWithheld | null {
  if (contentSwitch === null) {
    return null;
  }
  if (intents.paragraph === 'Remove') {
    return 'switchRemovesCompanion';
  }
  return contentSwitch.confirmed ? null : 'contentSwitchUnconfirmed';
} // End of function saveWithheldOf()

/**
 * The preview of a drafted switch, or `null`.
 *
 * **Derived from the same captured values the save would send**: the switch read
 * once by the caller and the intents {@link intentsOf} built from that read, so
 * the companions it says are kept are the ones the draft does not remove.
 *
 * @param session - The session to describe.
 * @param contentSwitch - The drafted switch, read once by the caller.
 * @param intents - The intents built from that same read.
 * @returns The preview.
 */
function switchPreviewOf(
  session: MatchEditorSession,
  contentSwitch: DraftedContentSwitch | null,
  intents: Readonly<Record<EditableField, DraftField<string>>>
): ContentSwitchPreview | null {
  if (contentSwitch === null) {
    return null;
  }
  const text = session.draft.value[contentSwitch.to].text;
  const removed = session.companions.filter((key) => companionIntentOf(key, intents) === 'Remove');
  return {
    from: contentSwitch.from,
    to: contentSwitch.to,
    fromLabel: fieldLabelName(contentSwitch.from),
    toLabel: fieldLabelName(contentSwitch.to),
    text,
    textKept: text === session.baseline[contentSwitch.from].value,
    companionsKept: session.companions.filter((key) => !removed.includes(key)),
    companionsRemoved: removed,
    confirmed: contentSwitch.confirmed
  };
} // End of function switchPreviewOf()

/**
 * What a save would do with one field, as the phrase a copy names it by.
 *
 * The three arms of the wire's own `DraftField<string>` mapped onto the three of
 * {@link DraftFieldStatus}, so the status beside a copied value is what
 * {@link matchDraftOf} would actually send for it rather than a second opinion
 * about presence. An absent field left blank is therefore *unchanged* and not
 * *setting*, which is the rule the whole draft-versus-projection arrangement
 * exists for.
 *
 * @param intent - What {@link fieldIntent} answered for the field.
 * @returns The status to show and to copy.
 */
function statusOfIntent(intent: DraftField<string>): DraftFieldStatus {
  if (intent === 'Unchanged') {
    return 'unchanged';
  }
  return intent === 'Remove' ? 'removing' : 'setting';
} // End of function statusOfIntent()

/**
 * The retained draft of one conflict, labelled, for the panel and for the copy.
 *
 * **All seventeen fields, in {@link EDITABLE_FIELDS} order**, which is the consult's Q4
 * read literally: a field left out of the copy is a piece of the drafted value
 * that was not copied, and a removed field keeps its text in its buffer, so
 * dropping either the text or the status would not preserve what was drafted.
 *
 * @param session - The session showing the conflict, for its baselines.
 * @param conflict - The conflict holding the retained draft.
 * @returns One entry per editable field, in the order a screen shows them.
 */
function retainedDraftOf(
  session: MatchEditorSession,
  conflict: ConflictModel<MatchBuffers>
): readonly RetainedDraftField[] {
  const buffers = copyOfDraft(conflict);
  const contentSwitch = capturedSwitch(buffers);
  const intents = intentsOf(session.baseline, buffers, contentSwitch);
  return EDITABLE_FIELDS.map((field) => ({
    label: fieldLabelName(field),
    text: buffers[field].text,
    status: retainedStatusOf(field, intents[field], contentSwitch)
  }));
} // End of function retainedDraftOf()

/**
 * The status one retained field is copied with, the drafted switch included.
 *
 * @param field - Which field.
 * @param intent - Its intent, from {@link intentsOf}.
 * @param contentSwitch - The retained switch, or `null`.
 * @returns The status.
 */
function retainedStatusOf(
  field: EditableField,
  intent: DraftField<string>,
  contentSwitch: DraftedContentSwitch | null
): DraftFieldStatus {
  if (contentSwitch !== null && field === contentSwitch.from) {
    return 'switchingAway';
  }
  if (contentSwitch !== null && field === contentSwitch.to) {
    return 'switchingTo';
  }
  return statusOfIntent(intent);
} // End of function retainedStatusOf()

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
  const conflictChoices =
    conflict === null
      ? []
      : conflictChoicesFor(effectiveCapabilitiesOf(session), offeredReloadStep(session.reload));
  const externallyBlocked = session.externalConflict !== null || session.awaitingReconciliation !== null;
  const refusalChoices = offeredRefusalChoices(refused, stale);
  const contentSwitch = capturedSwitch(session.draft.value);
  const intents = intentsOf(session.baseline, session.draft.value, contentSwitch);
  const fields = EDITABLE_FIELDS.map((field) =>
    fieldModel(session, field, intents[field], contentSwitch)
  );
  const preview = switchPreviewOf(session, contentSwitch, intents);
  const switchTargets = contentSwitchTargets(session);
  return {
    fields,
    sections: sectionsOf(fields, preview !== null || switchTargets.length > 0),
    contentSwitch: preview,
    switchTargets,
    switchChoices: switchTargets.map((to) => ({
      to,
      label: fieldLabelName(to),
      drafted: contentSwitch !== null && contentSwitch.to === to
    })),
    cursorActionOffered: cursorActionOffered(session),
    cursorMarkers: cursorMarkerCount(session.draft.value.replace.text),
    saveWithheld: saveWithheldOf(contentSwitch, intents),
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
    externalMessages: session.externalConflict === null ? [] : session.externalConflict.messages,
    externalNotices: externalNoticesOf(session),
    notes: saved === null ? [] : saved.notes,
    // The one offer a refusal panel may keep under an external block is the
    // dismissal: `beginSave` would answer `null` to the other, and a control that
    // does nothing when pressed is the defect `conflictChoicesFor` exists to stop.
    refusalChoices: externallyBlocked
      ? refusalChoices.filter((choice) => choice === 'keepEditing')
      : refusalChoices,
    findingsAreStale: refused !== null && stale,
    conflict,
    retainedDraft: conflict === null ? [] : retainedDraftOf(session, conflict),
    conflictChoices,
    awaitingReloadConfirmation: conflict !== null && atTheReloadWarning(session.reload),
    reloadUnavailable: conflict !== null && reloadWasRefused(session.reload),
    reapplyOffered: reapplyIsOffered(conflictChoices),
    diskText: conflictDiskText(conflict),
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
    case 'lineBreak':
      return 'browser.matchEditor.readOnly.lineBreak';
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
