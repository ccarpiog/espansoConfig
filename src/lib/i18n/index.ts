/**
 * The single entry point every component uses to produce user-facing text.
 *
 * Import `t` from here and nothing else: reading a dictionary directly, or
 * writing a literal into markup, is the one habit CLAUDE.md section 2 forbids.
 */

// The *code* belongs to the browser, which raises it; the *prose* belongs here,
// where both languages are checked against each other. The accessor lives with
// the other twelve because CLAUDE.md section 2 is about where a component may
// get a string from, and the answer is only ever this module.
import {
  detailFieldKey,
  optionGroupKey,
  type DetailFieldName,
  type OptionGroupName
} from '../browser/detail';
import { fieldRefusalKey, type FieldRefusal } from '../browser/matchEditor';
import { selectionNoticeKey, type SelectionNotice } from '../browser/notices';
import { rawEditorRefusalKey, type RawEditorRefusal } from '../browser/rawEditor';
import {
  rawSaveChoiceKey,
  rawSaveMessageKey,
  rawSaveMessageParams,
  type RawSaveChoice,
  type RawSaveMessage
} from '../browser/rawSave';
import {
  conflictChoiceKey,
  saveOutcomeMessageKey,
  type ConflictChoice,
  type SaveOutcomeMessage
} from '../browser/saveOutcome';
import { codePointLabel, invisibleKey, type InvisibleSegment } from '../browser/sourceText';
import type { CommandError, IpcFailure } from '../ipc/errors';
import type {
  BackupError,
  BackupStep,
  ContentKind,
  DecodeError,
  DiagnosticCode,
  DraftError,
  EditError,
  FileKind,
  FindingClass,
  FindingCode,
  HazardKind,
  InvariantViolation,
  LineEnding,
  MatchBadge,
  MoveSeam,
  NodeKind,
  NotReencodable,
  PathError,
  PresentationNote,
  RotationOutcome,
  SaveError,
  SaveResult,
  SaveVerdict,
  ScalarStyle,
  SyntaxError,
  TargetDifference,
  TriggerKind,
  UnknownReason,
  ValueKind,
  VariableKind,
  VerificationFailure,
  WriteError,
  WriteStep
} from '../ipc/types';
import { locale } from '../stores/locale.svelte';
import {
  describeBackupError,
  describeBackupStep,
  describeCommandError,
  describeContentKind,
  describeDecodeError,
  describeDiagnostic,
  describeDraftError,
  describeEditError,
  describeFileKind,
  describeFindingClass,
  describeFindingCode,
  describeHazard,
  describeInvariantViolation,
  describeIpcFailure,
  describeLineEnding,
  describeMatchBadge,
  describeMoveSeam,
  describeNodeKind,
  describePathError,
  describeNotReencodable,
  describePresentationNote,
  describeRotationOutcome,
  describeSaveError,
  describeSaveResult,
  describeSaveVerdict,
  describeScalarStyle,
  describeSyntaxError,
  describeTargetDifference,
  describeTriggerKind,
  describeUnknownReason,
  describeValueKind,
  describeVariableKind,
  describeVerificationFailure,
  describeWriteError,
  describeWriteStep
} from './codes';
import { translate, type TranslationKey, type TranslationParams } from './dictionaries';
import { describeOccurrenceCount, describeSnippetCount, describeUnknownCount } from './plural';

export { DICTIONARIES, placeholdersOf, translate } from './dictionaries';
export {
  describeOccurrenceCount,
  describeSnippetCount,
  describeUnknownCount,
  occurrenceCountKey,
  pluralKey,
  snippetCountKey,
  unknownCountKey
} from './plural';
export type { TranslationKey, TranslationParams } from './dictionaries';
export { DEFAULT_LOCALE, LOCALES, isLocale, matchLocaleTag, negotiateLocale } from './locale';
export type { Locale } from './locale';
export {
  backupErrorKey,
  backupStepKey,
  commandErrorKey,
  contentKindKey,
  decodeErrorKey,
  describeBackupError,
  describeBackupStep,
  describeCommandError,
  describeContentKind,
  describeDecodeError,
  describeDiagnostic,
  describeDraftError,
  describeEditError,
  describeFileKind,
  describeFindingClass,
  describeFindingCode,
  describeHazard,
  describeInvariantViolation,
  describeIpcFailure,
  describeLineEnding,
  describeMatchBadge,
  describeMoveSeam,
  describeNodeKind,
  describePathError,
  describeNotReencodable,
  describePresentationNote,
  describeRotationOutcome,
  describeSaveError,
  describeSaveResult,
  describeSaveVerdict,
  describeScalarStyle,
  describeSyntaxError,
  describeTargetDifference,
  describeTriggerKind,
  describeUnknownReason,
  describeValueKind,
  describeVariableKind,
  describeVerificationFailure,
  describeWriteError,
  describeWriteStep,
  diagnosticCodeKey,
  documentShapeKey,
  draftErrorKey,
  editErrorKey,
  fileKindKey,
  findingClassKey,
  findingCodeKey,
  hazardKindKey,
  invariantViolationKey,
  lineEndingKey,
  matchBadgeKey,
  moveSeamKey,
  nodeKindKey,
  pathErrorKey,
  notReencodableKey,
  presentationNoteKey,
  rotationOutcomeKey,
  saveErrorKey,
  saveResultKey,
  saveVerdictKey,
  scalarStyleKey,
  syntaxErrorKey,
  targetDifferenceKey,
  triggerKindKey,
  unknownReasonKey,
  valueKindKey,
  variableKindKey,
  verificationFailureKey,
  writeErrorKey,
  writeStepKey
} from './codes';

/**
 * Translates a key into the language the interface is currently showing.
 *
 * Reading `locale.current` inside this function is what makes it reactive: a
 * Svelte 5 template that calls `t(...)` records the read, so changing the
 * language re-renders every string on screen without a page reload and without
 * any component subscribing to anything.
 *
 * @param key - A key of the English dictionary; anything else is a type error.
 * @param params - Substitutions for the value's `{placeholder}` tokens.
 * @returns The translated string.
 */
export function t(key: TranslationKey, params?: TranslationParams): string {
  return translate(locale.current, key, params);
} // End of function t()

/**
 * The dictionary key naming a locale in its own language.
 *
 * Kept as a function rather than a lookup table so that adding a locale without
 * adding its name is a compile error rather than an undefined at runtime.
 *
 * @param value - The locale to name.
 * @returns The translation key holding that locale's endonym.
 */
export function localeNameKey(value: 'en' | 'es'): TranslationKey {
  return value === 'en' ? 'language.english' : 'language.spanish';
} // End of function localeNameKey()

/**
 * Renders a locale's own name for the language picker.
 *
 * The reactive twin of {@link localeNameKey}, and the function a component
 * calls. `LanguagePicker` wrote `t(localeNameKey(candidate))` until the 1c-1
 * review; that is a component building a key, which is what
 * `scripts/lint/built-translation-keys.ts` now refuses on every component.
 *
 * @param value - The locale to name.
 * @returns That locale's endonym, which is deliberately *not* translated.
 */
export function tLocaleName(value: 'en' | 'es'): string {
  return translate(locale.current, localeNameKey(value));
} // End of function tLocaleName()

/**
 * Renders a diagnostic in the language the interface is currently showing.
 *
 * The reactive twin of {@link describeDiagnostic}, and the function a component
 * calls. It exists so that no component ever builds a `code.` key itself: a key
 * assembled inline is a string the type system cannot check and the hardcoded-
 * string scanner cannot see.
 *
 * @param code - A diagnostic code as it crossed the boundary.
 * @returns The translated message.
 */
export function tDiagnostic(code: DiagnosticCode): string {
  return describeDiagnostic(locale.current, code);
} // End of function tDiagnostic()

/**
 * Renders an unmodelled-entry reason in the current language.
 *
 * @param reason - An unknown reason as it crossed the boundary.
 * @returns The translated message.
 */
export function tUnknownReason(reason: UnknownReason): string {
  return describeUnknownReason(locale.current, reason);
} // End of function tUnknownReason()

/**
 * Renders a snippet-list badge label in the current language.
 *
 * @param badge - A badge as it crossed the boundary.
 * @returns The translated label.
 */
export function tMatchBadge(badge: MatchBadge): string {
  return describeMatchBadge(locale.current, badge);
} // End of function tMatchBadge()

/**
 * Renders an editing hazard's noun phrase in the current language.
 *
 * @param kind - A hazard as it crossed the boundary.
 * @returns The translated phrase.
 */
export function tHazard(kind: HazardKind): string {
  return describeHazard(locale.current, kind);
} // End of function tHazard()

/**
 * Renders a command error in the current language.
 *
 * @param error - A command error as it crossed the boundary.
 * @returns The translated message.
 */
export function tCommandError(error: CommandError): string {
  return describeCommandError(locale.current, error);
} // End of function tCommandError()

/**
 * Renders any failed command in the current language.
 *
 * The unexpected arm renders one generic sentence and never the developer
 * string; it cannot, because that string is not a property of the failure at
 * all — see `src/lib/ipc/errors.ts`.
 *
 * @param failure - A classified IPC failure.
 * @returns The translated message.
 */
export function tIpcFailure(failure: IpcFailure): string {
  return describeIpcFailure(locale.current, failure);
} // End of function tIpcFailure()

/**
 * Renders how a scalar is written in the source, in the current language.
 *
 * A claim about spelling, never about meaning (D2u).
 *
 * @param style - A scalar style as it crossed the boundary.
 * @returns The translated phrase.
 */
export function tScalarStyle(style: ScalarStyle): string {
  return describeScalarStyle(locale.current, style);
} // End of function tScalarStyle()

/**
 * Renders a document's line terminator in the current language.
 *
 * @param ending - A line ending as it crossed the boundary.
 * @returns The translated phrase.
 */
export function tLineEnding(ending: LineEnding): string {
  return describeLineEnding(locale.current, ending);
} // End of function tLineEnding()

/**
 * Renders what espanso treats a file as, in the current language.
 *
 * @param kind - A file kind as it crossed the boundary.
 * @returns The translated phrase.
 */
export function tFileKind(kind: FileKind): string {
  return describeFileKind(locale.current, kind);
} // End of function tFileKind()

/**
 * Renders which trigger form a match uses, in the current language.
 *
 * @param kind - A trigger kind as it crossed the boundary.
 * @returns The translated phrase.
 */
export function tTriggerKind(kind: TriggerKind): string {
  return describeTriggerKind(locale.current, kind);
} // End of function tTriggerKind()

/**
 * Renders which content form a match uses, in the current language.
 *
 * @param kind - A content kind as it crossed the boundary.
 * @returns The translated phrase.
 */
export function tContentKind(kind: ContentKind): string {
  return describeContentKind(locale.current, kind);
} // End of function tContentKind()

/**
 * Renders which of espanso's variable types a `type` field names.
 *
 * @param kind - A variable kind as it crossed the boundary.
 * @returns The translated phrase.
 */
export function tVariableKind(kind: VariableKind): string {
  return describeVariableKind(locale.current, kind);
} // End of function tVariableKind()

/**
 * Renders what became of a selection whose document moved on.
 *
 * The thirteenth accessor, and the reason it exists: `DetailPane` used to call
 * `t(selectionNoticeKey(notice))`, which is a component turning a code into a
 * key — the one thing CLAUDE.md section 2 tells components not to do, however
 * exhaustive the `switch` behind it is. A component calls this instead.
 *
 * @param notice - What happened to the selection.
 * @returns The translated sentence.
 */
export function tSelectionNotice(notice: SelectionNotice): string {
  return translate(locale.current, selectionNoticeKey(notice));
} // End of function tSelectionNotice()

/**
 * Renders one line the raw editor says about replacing a whole file.
 *
 * The accessor over `describeRawSave`'s model, here for `tSelectionNotice`'s
 * reason: a component that wrote `t(rawSaveMessageKey(message))` would be
 * turning a code into a key in markup, which CLAUDE.md section 2 forbids and
 * `scripts/lint/built-translation-keys.ts` refuses.
 *
 * **The parser's own message is not among these.** `DocumentDoesNotParse.detail`
 * comes from `saphyr-parser` and cannot be translated; the sentence around it
 * is, and this is that sentence.
 *
 * @param message - A line of the raw-save model.
 * @returns The translated sentence, with its position substituted when it has
 *   one.
 */
export function tRawSaveMessage(message: RawSaveMessage): string {
  return translate(locale.current, rawSaveMessageKey(message), rawSaveMessageParams(message));
} // End of function tRawSaveMessage()

/**
 * Renders one thing the person may do about a refused raw save.
 *
 * @param choice - What the model offers.
 * @returns The translated label.
 */
export function tRawSaveChoice(choice: RawSaveChoice): string {
  return translate(locale.current, rawSaveChoiceKey(choice));
} // End of function tRawSaveChoice()

/**
 * Renders why the raw editor will not open a file at all.
 *
 * The accessor over `rawEditorRefusal`'s answer, here for `tRawSaveMessage`'s
 * reason: a component that wrote `t(rawEditorRefusalKey(refusal))` would be
 * turning a code into a key in markup, which CLAUDE.md section 2 forbids and
 * `scripts/lint/built-translation-keys.ts` refuses.
 *
 * @param refusal - Why the editor will not open.
 * @returns The translated sentence.
 */
export function tRawEditorRefusal(refusal: RawEditorRefusal): string {
  return translate(locale.current, rawEditorRefusalKey(refusal));
} // End of function tRawEditorRefusal()

/**
 * Renders why one field of a snippet is shown rather than edited.
 *
 * The accessor over `fieldEligibility`'s verdict, here for `tRawSaveMessage`'s
 * reason: a component that wrote `t(fieldRefusalKey(reason))` would be turning a
 * code into a key in markup, which CLAUDE.md section 2 forbids and
 * `scripts/lint/built-translation-keys.ts` refuses.
 *
 * **None of the five names a `TriggerKind`**, and `triggerNotSingle` deliberately
 * does not: the sentence says the snippet does not fire from one literal trigger,
 * and a screen that wants to name the shape it does have calls `tTriggerKind`.
 *
 * @param reason - Why the field may not be edited.
 * @returns The translated sentence.
 */
export function tFieldRefusal(reason: FieldRefusal): string {
  return translate(locale.current, fieldRefusalKey(reason));
} // End of function tFieldRefusal()

/**
 * Renders one line a save outcome shows, in the current language.
 *
 * The accessor over the save-outcome model, here for `tRawSaveMessage`'s
 * reason: a component that turned a code into a key in markup would be doing the
 * one thing CLAUDE.md section 2 forbids.
 *
 * **None of these nine sentences carries an operand**, so nothing is substituted
 * here. A revision is opaque and is never rendered; a finding's own numbers reach
 * a screen through `tFindingCode`.
 *
 * @param message - A line of the save-outcome model.
 * @returns The translated sentence.
 */
export function tSaveOutcomeMessage(message: SaveOutcomeMessage): string {
  return translate(locale.current, saveOutcomeMessageKey(message));
} // End of function tSaveOutcomeMessage()

/**
 * Renders one thing the person may do about a conflict, in the current language.
 *
 * **None of these labels is "keep my draft"**, and none may become one: that
 * phrase means *reapply the draft to the newly parsed document*, which is Phase
 * 2c-4b (`docs/decisions/2c-split-notes.md` section 6).
 *
 * @param choice - What the model offers.
 * @returns The translated label.
 */
export function tConflictChoice(choice: ConflictChoice): string {
  return translate(locale.current, conflictChoiceKey(choice));
} // End of function tConflictChoice()

/**
 * Renders what kind of node a value is, in the current language.
 *
 * A claim about shape, never about meaning. The detail pane calls it for a node
 * the projection stopped at, and for the header of a nested collection.
 *
 * @param kind - A value kind as it crossed the boundary.
 * @returns The translated phrase.
 */
export function tValueKind(kind: ValueKind): string {
  return describeValueKind(locale.current, kind);
} // End of function tValueKind()

/**
 * Renders the label of one field of the detail pane, in the current language.
 *
 * The sixteenth accessor, and the reason it exists is the reason the other
 * fifteen do: `DetailPane` renders a row whose field arrived as a **code**, and
 * a component turns a code into text by calling this rather than by assembling
 * `browser.detail.field.` + something. `detailFieldKey` is where the key is
 * built, and its return type makes a field with no dictionary entry a compile
 * error there.
 *
 * @param field - Which field a row stands for.
 * @returns The translated label.
 */
export function tDetailField(field: DetailFieldName): string {
  return translate(locale.current, detailFieldKey(field));
} // End of function tDetailField()

/**
 * Renders the heading of one group of match options, in the current language.
 *
 * The seventeenth accessor, and it exists for the reason the sixteenth does: the
 * pane walks a list of groups whose name arrived as a **code**, and a component
 * turns a code into text by calling this rather than by assembling
 * `browser.detail.options.` + something. `optionGroupKey` is where the key is
 * built, and its return type makes a group with no dictionary entry a compile
 * error there.
 *
 * @param name - Which intent a group stands for.
 * @returns The translated heading.
 */
export function tOptionGroup(name: OptionGroupName): string {
  return translate(locale.current, optionGroupKey(name));
} // End of function tOptionGroup()

/**
 * Names one character the file holds and no font draws, in the current language.
 *
 * The eighteenth accessor, and it exists for the reason the other seventeen do:
 * `SourceText.svelte` walks segments whose name arrived as a **code**, and a
 * component turns a code into text by calling this rather than by assembling
 * `browser.source.invisible.` + something. `invisibleKey` in
 * `../browser/sourceText.ts` is where the key is built, and its return type makes
 * a name with no dictionary entry a compile error there.
 *
 * It takes the whole segment rather than the name alone because every one of the
 * six strings carries a `{code}` operand: the name says what family the character
 * belongs to and the code point says which character it is, and the second half
 * is what makes `other` — the catch-all — a fact rather than a shrug.
 *
 * @param segment - An invisible character as `sourceSegments` classified it.
 * @returns The translated name, with its code point substituted.
 */
export function tInvisible(segment: InvisibleSegment): string {
  return translate(locale.current, invisibleKey(segment.name), {
    code: codePointLabel(segment.character)
  });
} // End of function tInvisible()

/**
 * Renders "N snippets" in the current language, in the right number.
 *
 * @param count - How many snippets a sidebar row stands for.
 * @returns The translated phrase, with the count substituted.
 */
export function tSnippetCount(count: number): string {
  return describeSnippetCount(locale.current, count);
} // End of function tSnippetCount()

/**
 * Renders the unmodelled-entry count in the current language and number.
 *
 * @param count - How many entries of a snippet the projection did not model.
 * @returns The translated sentence, with the count substituted.
 */
export function tUnknownCount(count: number): string {
  return describeUnknownCount(locale.current, count);
} // End of function tUnknownCount()

/**
 * Renders "in N places" in the current language, in the right number.
 *
 * @param count - How many distinct places one diagnostic was raised in.
 * @returns The translated phrase, with the count substituted.
 */
export function tOccurrenceCount(count: number): string {
  return describeOccurrenceCount(locale.current, count);
} // End of function tOccurrenceCount()

// ---------------------------------------------------------------------------
// The save transaction — Phase 2b-1
// ---------------------------------------------------------------------------
//
// Eighteen more accessors, for the eighteen enums the save transaction put on
// the wire. They exist for the reason every accessor above exists: a component
// turns a code into text by calling one of these, never by assembling a `code.`
// key itself — the key builders in `./codes` are where a key is built, and their
// return types make a missing dictionary entry a compile error there.
//
// **Nothing calls them yet.** No command answers with a save error until Phase
// 2b-2, and 1b-1 shipped the whole i18n layer with no caller for exactly this
// reason: a boundary that arrives with the code it describes cannot be half
// built.

/**
 * Renders what kind of YAML construct a node is, in the current language.
 *
 * @param kind - A node kind as it crossed the boundary.
 * @returns The translated phrase.
 */
export function tNodeKind(kind: NodeKind): string {
  return describeNodeKind(locale.current, kind);
} // End of function tNodeKind()

/**
 * Renders which arm of the blocking policy decided a save, in the current language.
 *
 * @param verdict - A save verdict as it crossed the boundary.
 * @returns The translated sentence.
 */
export function tSaveVerdict(verdict: SaveVerdict): string {
  return describeSaveVerdict(locale.current, verdict);
} // End of function tSaveVerdict()

/**
 * Renders how seriously to take a finding, in the current language.
 *
 * @param value - A finding class as it crossed the boundary.
 * @returns The translated phrase.
 */
export function tFindingClass(value: FindingClass): string {
  return describeFindingClass(locale.current, value);
} // End of function tFindingClass()

/**
 * Renders one semantic-gate finding, in the current language.
 *
 * @param code - A finding code as it crossed the boundary.
 * @returns The translated message.
 */
export function tFindingCode(code: FindingCode): string {
  return describeFindingCode(locale.current, code);
} // End of function tFindingCode()

/**
 * Renders which step of the atomic write failed, in the current language.
 *
 * @param step - A write step as it crossed the boundary.
 * @returns The translated phrase.
 */
export function tWriteStep(step: WriteStep): string {
  return describeWriteStep(locale.current, step);
} // End of function tWriteStep()

/**
 * Renders which part of taking a backup failed, in the current language.
 *
 * @param step - A backup step as it crossed the boundary.
 * @returns The translated phrase.
 */
export function tBackupStep(step: BackupStep): string {
  return describeBackupStep(locale.current, step);
} // End of function tBackupStep()

/**
 * Renders how far the backup tidy-up got, in the current language.
 *
 * A claim about tidiness, never about safety.
 *
 * @param outcome - A rotation outcome as it crossed the boundary.
 * @returns The translated sentence.
 */
export function tRotationOutcome(outcome: RotationOutcome): string {
  return describeRotationOutcome(locale.current, outcome);
} // End of function tRotationOutcome()

/**
 * Renders which join of a move a refusal is about, in the current language.
 *
 * @param seam - A move seam as it crossed the boundary.
 * @returns The translated phrase.
 */
export function tMoveSeam(seam: MoveSeam): string {
  return describeMoveSeam(locale.current, seam);
} // End of function tMoveSeam()

/**
 * Renders why a change was not applied, in the current language.
 *
 * @param error - An edit error as it crossed the boundary.
 * @returns The translated message.
 */
export function tEditError(error: EditError): string {
  return describeEditError(locale.current, error);
} // End of function tEditError()

/**
 * Renders why a candidate failed verification, in the current language.
 *
 * @param failure - A verification failure as it crossed the boundary.
 * @returns The translated message.
 */
export function tVerificationFailure(failure: VerificationFailure): string {
  return describeVerificationFailure(locale.current, failure);
} // End of function tVerificationFailure()

/**
 * Renders why a document could not be indexed, in the current language.
 *
 * @param error - A syntax error as it crossed the boundary.
 * @returns The translated message.
 */
export function tSyntaxError(error: SyntaxError): string {
  return describeSyntaxError(locale.current, error);
} // End of function tSyntaxError()

/**
 * Renders which invariant of the span index broke, in the current language.
 *
 * @param violation - An invariant violation as it crossed the boundary.
 * @returns The translated message.
 */
export function tInvariantViolation(violation: InvariantViolation): string {
  return describeInvariantViolation(locale.current, violation);
} // End of function tInvariantViolation()

/**
 * Renders why an address did not resolve, in the current language.
 *
 * @param error - A path error as it crossed the boundary.
 * @returns The translated message.
 */
export function tPathError(error: PathError): string {
  return describePathError(locale.current, error);
} // End of function tPathError()

/**
 * Renders why a scalar could not be decoded, in the current language.
 *
 * @param error - A decode error as it crossed the boundary.
 * @returns The translated message.
 */
export function tDecodeError(error: DecodeError): string {
  return describeDecodeError(locale.current, error);
} // End of function tDecodeError()

/**
 * Renders how the save target differed from what was inspected, in the current
 * language.
 *
 * @param difference - A target difference as it crossed the boundary.
 * @returns The translated message.
 */
export function tTargetDifference(difference: TargetDifference): string {
  return describeTargetDifference(locale.current, difference);
} // End of function tTargetDifference()

/**
 * Renders one atomic-write failure, in the current language.
 *
 * @param error - A write error as it crossed the boundary.
 * @returns The translated message.
 */
export function tWriteError(error: WriteError): string {
  return describeWriteError(locale.current, error);
} // End of function tWriteError()

/**
 * Renders one backup failure, in the current language.
 *
 * @param error - A backup error as it crossed the boundary.
 * @returns The translated message.
 */
export function tBackupError(error: BackupError): string {
  return describeBackupError(locale.current, error);
} // End of function tBackupError()

/**
 * Renders why a save did not commit, in the current language.
 *
 * One sentence for the outer reason. A nested `EditError` or `WriteError` has
 * {@link tEditError} and {@link tWriteError} of its own; how much of the chain a
 * screen shows is that screen's decision, not this function's.
 *
 * @param error - A save error as it crossed the boundary.
 * @returns The translated message.
 */
export function tSaveError(error: SaveError): string {
  return describeSaveError(locale.current, error);
} // End of function tSaveError()

/**
 * Renders why a value's spelling could not be kept, in the current language.
 *
 * The reason a {@link tSaveError} never has to give: a presentation note is not a
 * failure, and this sentence says what changed about the *spelling* of a value
 * rather than about its content.
 *
 * @param reason - A `NotReencodable` as it crossed the boundary.
 * @returns The translated message.
 */
export function tNotReencodable(reason: NotReencodable): string {
  return describeNotReencodable(locale.current, reason);
} // End of function tNotReencodable()

/**
 * Renders one presentation change a successful save made, in the current
 * language.
 *
 * The sentence that keeps plan section 6.2 — never silently normalise — true on a
 * screen. It reports a change the save *made*, so it belongs beside the value or
 * the list it is about and never in an error toast: the save succeeded.
 *
 * @param note - A `PresentationNote` as it crossed the boundary.
 * @returns The translated message.
 */
export function tPresentationNote(note: PresentationNote): string {
  return describePresentationNote(locale.current, note);
} // End of function tPresentationNote()

/**
 * Renders how a save ended, in the current language.
 *
 * One sentence for the outcome. A refused save's verdict and findings have
 * {@link tSaveVerdict} and {@link tFindingCode} of their own; how much of that a
 * screen shows is that screen's decision.
 *
 * @param result - A save result as it crossed the boundary.
 * @returns The translated sentence.
 */
export function tSaveResult(result: SaveResult): string {
  return describeSaveResult(locale.current, result);
} // End of function tSaveResult()

// ---------------------------------------------------------------------------
// The draft surface — Phase 2b-2b-3
// ---------------------------------------------------------------------------
//
// One more accessor, for the one enum the draft surface put on the wire. It is
// the first of this family with a command behind it: `save_match` rejects with
// `draftRefused`, and this is what turns that rejection's reason into a sentence.

/**
 * Renders why a draft could not be planned, in the current language.
 *
 * **Not a failed save, and the interface should not present it as one.** No
 * batch was derived and no transaction ran, so there is nothing to acknowledge
 * and nothing to retry: this sentence belongs beside the field the person was
 * editing. `identityRecovery` in `../ipc/errors` says the same thing about the
 * selection — a refused draft leaves it exactly where it was.
 *
 * @param error - A draft error as it crossed the boundary.
 * @returns The translated message.
 */
export function tDraftError(error: DraftError): string {
  return describeDraftError(locale.current, error);
} // End of function tDraftError()
