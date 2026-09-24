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
  conflictOriginMessageKey,
  type ConflictOriginMessage
} from '../browser/conflictSource';
import {
  detailFieldKey,
  optionGroupKey,
  type DetailFieldName,
  type OptionGroupName
} from '../browser/detail';
import {
  creationRefusalKey,
  creationReapplyObstacleKey,
  destinationRefusalKey,
  type CreationReapplyObstacle,
  type CreationRefusal,
  type DestinationRefusal
} from '../browser/matchCreation';
import {
  deletionReapplyObstacleKey,
  deletionRefusalKey,
  type DeletionReapplyObstacle,
  type DeletionRefusal
} from '../browser/matchDeletion';
import {
  duplicationReapplyObstacleKey,
  duplicationRecoveryKey,
  duplicationRefusalKey,
  duplicationSubmissionRefusalKey,
  type DuplicationReapplyObstacle,
  type DuplicationRecovery,
  type DuplicationRefusal,
  type DuplicationSubmissionRefusal
} from '../browser/matchDuplication';
import {
  moveReapplyObstacleKey,
  moveRecoveryKey,
  moveRefusalKey,
  moveReloadWarningKey,
  moveSubmissionRefusalKey,
  type MoveReapplyObstacle,
  type MoveRecovery,
  type MoveRefusal,
  type MoveReloadWarning,
  type MoveSubmissionRefusal
} from '../browser/matchMove';
import {
  collisionLabelName,
  contentRoleNoteKey,
  cursorAdvisoryKey,
  editorReapplyObstacleKey,
  fieldRefusalKey,
  reprojectionRefusalKey,
  saveWithheldKey,
  triggerFormChoiceKey,
  triggerFormRefusalKey,
  triggerFormTextNoteKey,
  triggerPresentationKey,
  triggerRepairKey,
  triggerWithdrawalKey,
  type ContentRoleNote,
  type CursorAdvisory,
  type EditorReapplyObstacle,
  type FieldRefusal,
  type ReprojectionRefusal,
  type SaveWithheld,
  type TriggerFormPreview,
  type TriggerFormRefusal,
  type TriggerPresentation,
  type TriggerRepair,
  type TriggerWithdrawal
} from '../browser/matchEditor';
import {
  listItemStatusKey,
  listRefusalKey,
  listStyleNoteKey,
  type ListItemStatus,
  type ListRefusal,
  type ListStyle
} from '../browser/matchLists';
import {
  externalEvidenceRefusalKey,
  reapplyOutcomeKey,
  sharedReapplyObstacleKey,
  SUPERSEDED_EVIDENCE_KEY,
  type ExternalEvidenceRefusal,
  type ReapplyOutcomeCode,
  type SharedReapplyObstacle
} from '../browser/reapply';
import {
  recoveryChoiceKey,
  recoveryReapplyObstacleKey,
  recoveryRefusalKey,
  recoveryUnavailableKey,
  sourceConflictStateKey,
  transferRefusalKey,
  transferStatusKey,
  type RecoveryChoice,
  type RecoveryReapplyObstacle,
  type RecoveryRefusal,
  type RecoveryUnavailable,
  type SourceConflictState,
  type TransferRefusal,
  type TransferStatus
} from '../browser/recovery';
import { selectionNoticeKey, type SelectionNotice } from '../browser/notices';
import {
  rawEditorDiskRefusalKey,
  rawEditorRefusalKey,
  type RawEditorRefusal
} from '../browser/rawEditor';
import { rawSnippetRefusalKey, type RawSnippetRefusal } from '../browser/rawSnippet';
import {
  rawSaveChoiceKey,
  rawSaveMessageKey,
  rawSaveMessageParams,
  type RawSaveChoice,
  type RawSaveMessage
} from '../browser/rawSave';
// The restore panel's refusals. The import that step 2c-5-3 deliberately did not
// add — nothing drew them then, and this module is reachable from the application
// entry, so importing a model nothing drew would have put it in the production
// bundle. `RestorePane.svelte` draws them now.
import {
  restoreRefusalKey,
  restoreReloadUnavailableKey,
  type RestoreRefusal,
  type RestoreReloadUnavailable
} from '../browser/restore';
import type {
  ExternalConflictAction,
  ExternalConflictNotice
} from '../browser/observationDelivery';
import type { AutoLoadNote, AutoLoadPlacement, ImportsState } from '../browser/fileScope';
import type {
  BulkBlocker,
  BulkCountLine,
  BulkExclusionReason,
  BulkOutcomeHeadline,
  WordedOptionSummary
} from '../browser/bulkEdit';
import type {
  FileReconciliationState,
  FileStatePlacement,
  ReconciliationControl,
  ReconciliationRefusal,
  RouteControlNote,
  SurfaceControlNote,
  WorkspaceReconciliationState
} from '../browser/reconciliationStatus';
import {
  conflictChoiceKey,
  conflictOperationKey,
  draftFieldStatusKey,
  reapplyReadinessKey,
  referenceCopyOf,
  reloadUnavailableKey,
  saveOutcomeMessageKey,
  type ConflictChoice,
  type ConflictDraftKind,
  type ConflictMessage,
  type ConflictOperation,
  type DraftFieldStatus,
  type RetainedDraftField,
  type SaveOutcomeMessage
} from '../browser/saveOutcome';
import { codePointLabel, invisibleKey, type InvisibleSegment } from '../browser/sourceText';
import type { CommandError, IpcFailure } from '../ipc/errors';
import type {
  AddedContent,
  BackupError,
  BackupReadError,
  BackupReadStep,
  BackupRootState,
  BackupStep,
  BackupTarget,
  BatchSkipped,
  BulkFileOutcome,
  BulkPlanError,
  ChangedContent,
  ContentKind,
  DecodeError,
  DiagnosticCode,
  DraftError,
  DuplicateSeam,
  EditError,
  EntrySkipped,
  ExternalObservation,
  FileKind,
  FindingClass,
  FindingCode,
  HazardKind,
  IdentityError,
  InvariantViolation,
  LineEnding,
  MatchBadge,
  MoveSeam,
  NodeKind,
  NotReencodable,
  PathError,
  PresentationNote,
  ReapplyPlacement,
  ReapplyRefusal,
  ReapplyResolution,
  RotationOutcome,
  SaveError,
  SaveResult,
  SaveVerdict,
  ScalarStyle,
  SequencePresence,
  SyntaxError,
  TargetDifference,
  TriggerKind,
  UnknownReason,
  UnreadableReason,
  ValueKind,
  VariableKind,
  VerificationFailure,
  WriteError,
  WriteStep
} from '../ipc/types';
import { locale } from '../stores/locale.svelte';
import type { Locale } from './locale';
import {
  describeAddedContent,
  describeBackupError,
  describeBackupReadError,
  describeBackupReadStep,
  describeBackupRootState,
  describeBackupStep,
  describeBackupTarget,
  describeBatchSkipped,
  describeBulkBlocker,
  describeBulkCount,
  describeBulkExclusion,
  describeBulkFileOutcome,
  describeBulkOptionSummary,
  describeBulkOutcomeHeadline,
  describeBulkPlanError,
  describeChangedContent,
  describeCommandError,
  describeConflictMessage,
  describeContentKind,
  describeDecodeError,
  describeDiagnostic,
  describeDraftError,
  describeDuplicateSeam,
  describeEditError,
  describeEntrySkipped,
  describeExternalConflictAction,
  describeExternalConflictNotice,
  describeExternalObservation,
  describeFileKind,
  describeFindingClass,
  describeFindingCode,
  describeHazard,
  describeIdentityError,
  describeImportsState,
  describeInvariantViolation,
  describeIpcFailure,
  describeLineEnding,
  describeMatchBadge,
  describeMoveSeam,
  describeNodeKind,
  describeAutoLoadNote,
  describePathError,
  describeNotReencodable,
  describePresentationNote,
  describeReapplyPlacement,
  describeReapplyRefusal,
  describeReapplyResolution,
  describeReconciliationControl,
  describeReconciliationFileState,
  describeReconciliationRefusal,
  describeReconciliationRouteNote,
  describeReconciliationSurfaceNote,
  describeReconciliationWorkspaceState,
  describeRotationOutcome,
  describeSaveError,
  describeSaveResult,
  describeSaveVerdict,
  describeScalarStyle,
  describeSequencePresence,
  describeSyntaxError,
  describeTargetDifference,
  describeTriggerKind,
  describeUnknownReason,
  describeUnreadableReason,
  describeUnsupportedImport,
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
  addedContentKey,
  backupErrorKey,
  backupReadErrorKey,
  backupReadStepKey,
  backupRootStateKey,
  backupStepKey,
  backupTargetKey,
  batchSkippedKey,
  bulkFileOutcomeKey,
  bulkPlanErrorKey,
  changedContentKey,
  commandErrorKey,
  contentKindKey,
  decodeErrorKey,
  describeAddedContent,
  describeBackupError,
  describeBackupReadError,
  describeBackupReadStep,
  describeBackupRootState,
  describeBackupStep,
  describeBackupTarget,
  describeBatchSkipped,
  describeBulkBlocker,
  describeBulkCount,
  describeBulkExclusion,
  describeBulkFileOutcome,
  describeBulkOptionSummary,
  describeBulkOutcomeHeadline,
  describeBulkPlanError,
  describeChangedContent,
  describeCommandError,
  describeConflictMessage,
  describeContentKind,
  describeDecodeError,
  describeDiagnostic,
  describeDraftError,
  describeDuplicateSeam,
  describeEditError,
  describeEntrySkipped,
  describeExternalConflictAction,
  describeExternalConflictNotice,
  describeExternalObservation,
  describeFileKind,
  describeFindingClass,
  describeFindingCode,
  describeHazard,
  describeIdentityError,
  describeInvariantViolation,
  describeIpcFailure,
  describeLineEnding,
  describeMatchBadge,
  describeMoveSeam,
  describeNodeKind,
  describePathError,
  describeNotReencodable,
  describePresentationNote,
  describeReapplyPlacement,
  describeReapplyRefusal,
  describeReapplyResolution,
  describeReconciliationControl,
  describeReconciliationFileState,
  describeReconciliationRefusal,
  describeReconciliationRouteNote,
  describeReconciliationSurfaceNote,
  describeReconciliationWorkspaceState,
  describeRotationOutcome,
  describeSaveError,
  describeSaveResult,
  describeSaveVerdict,
  describeScalarStyle,
  describeSequencePresence,
  describeSyntaxError,
  describeTargetDifference,
  describeTriggerKind,
  describeUnknownReason,
  describeUnreadableReason,
  describeValueKind,
  describeVariableKind,
  describeVerificationFailure,
  describeWriteError,
  describeWriteStep,
  diagnosticCodeKey,
  documentShapeKey,
  draftErrorKey,
  duplicateSeamKey,
  editErrorKey,
  entrySkippedKey,
  externalObservationKey,
  fileKindKey,
  findingClassKey,
  findingCodeKey,
  hazardKindKey,
  identityErrorKey,
  invariantViolationKey,
  lineEndingKey,
  matchBadgeKey,
  moveSeamKey,
  nodeKindKey,
  pathErrorKey,
  notReencodableKey,
  presentationNoteKey,
  reapplyPlacementKey,
  reapplyRefusalKey,
  reapplyResolutionKey,
  rotationOutcomeKey,
  saveErrorKey,
  saveResultKey,
  saveVerdictKey,
  scalarStyleKey,
  sequencePresenceKey,
  syntaxErrorKey,
  targetDifferenceKey,
  triggerKindKey,
  unknownReasonKey,
  unreadableReasonKey,
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
 * Renders a list's presence in the current language (Phase 3-2).
 *
 * @param presence - A list's presence as it crossed the boundary.
 * @returns The translated noun phrase.
 */
export function tSequencePresence(presence: SequencePresence): string {
  return describeSequencePresence(locale.current, presence);
} // End of function tSequencePresence()

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
 * Renders one thing the person may do about a **refused** save.
 *
 * **The draft kind travels with the choice, exactly as it does for
 * {@link tConflictChoice}**, and the 2c-4a-3c review's Medium is why: the way out
 * of a refusal said *Keep editing* on the mover, the deleter and the duplicator,
 * where nothing is being edited — the duplicator's *ordinary* first outcome. It
 * is the calling surface's own `CONFLICT_CAPABILITIES.draftKind`; nothing here
 * can check that it is.
 *
 * @param choice - What the model offers.
 * @param draftKind - What the calling surface's retained draft is.
 * @returns The translated label.
 */
export function tRawSaveChoice(choice: RawSaveChoice, draftKind: ConflictDraftKind): string {
  return translate(locale.current, rawSaveChoiceKey(choice, draftKind));
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
 * Renders why the version on disk will not be loaded into an open raw editor.
 *
 * The accessor over `rawEditorDiskRefusalKey`, and a **second** accessor over the
 * same `RawEditorRefusal` rather than a parameter on the first one: a `scope`
 * argument would make the door a caller's assertion, which is exactly the shape
 * `saveOutcome.ts` refused for `describeRawSave`. 2c-4a-3c's finding 10.5 is why
 * the two sentences are two sentences.
 *
 * @param refusal - Why the disk version will not be loaded.
 * @returns The translated sentence.
 */
export function tRawEditorDiskRefusal(refusal: RawEditorRefusal): string {
  return translate(locale.current, rawEditorDiskRefusalKey(refusal));
} // End of function tRawEditorDiskRefusal()

/**
 * Renders why the local raw editor will not open one snippet's text — Phase
 * 3-8-1.
 *
 * The sentence only: a `notEditable` refusal's `EditError` and an `unreadable`
 * one's `IpcFailure` are drawn beside it through `tEditError` and `tIpcFailure`,
 * and a `rangeNotContiguous` one's fallback is `fallbackOf` in
 * `../browser/rawSnippet.ts`, drawn as a control rather than read out of this
 * sentence.
 *
 * @param refusal - Why the editor will not open, from `openRawSnippet`.
 * @returns The translated sentence.
 */
export function tRawSnippetRefusal(refusal: RawSnippetRefusal): string {
  return translate(locale.current, rawSnippetRefusalKey(refusal));
} // End of function tRawSnippetRefusal()

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
 * Renders the cursor action's advisory, in the current language — Phase 3-5-1.
 *
 * The model answers a code with its count (`insertCursorPosition` in
 * `../browser/matchEditor.ts`); this is where it becomes a sentence, so no
 * component builds the key.
 *
 * @param advisory - What the cursor action answered.
 * @returns The translated sentence, with the count filled in.
 */
export function tCursorAdvisory(advisory: CursorAdvisory): string {
  return translate(locale.current, cursorAdvisoryKey(advisory), { count: advisory.count });
} // End of function tCursorAdvisory()

/**
 * Renders why a dirty editor's save is held back, in the current language —
 * Phase 3-5-2-1.
 *
 * The model answers a code (`MatchEditorView.saveWithheld` in
 * `../browser/matchEditor.ts`); `saveWithheldKey` there names the key, so no
 * component builds one.
 *
 * @param code - Why the save is held back.
 * @returns The translated sentence.
 */
export function tSaveWithheld(code: SaveWithheld): string {
  return translate(locale.current, saveWithheldKey(code));
} // End of function tSaveWithheld()

/**
 * Renders what a content key's role means for its box, in the current language —
 * Phase 3-5-2-1.
 *
 * @param note - The note `contentRoleNoteOf` in `../browser/matchEditor.ts`
 *   answered for the field.
 * @returns The translated sentence.
 */
export function tContentRoleNote(note: ContentRoleNote): string {
  return translate(locale.current, contentRoleNoteKey(note));
} // End of function tContentRoleNote()

/**
 * Renders why a list (`triggers`, `search_terms`) is shown rather than edited,
 * in the current language — Phase 3-6-1.
 *
 * @param reason - The code `ListModel.refusal` in `../browser/matchEditor.ts`
 *   answered.
 * @returns The translated sentence.
 */
export function tListRefusal(reason: ListRefusal): string {
  return translate(locale.current, listRefusalKey(reason));
} // End of function tListRefusal()

/**
 * Renders why a trigger form cannot be chosen, in the current language — Phase
 * 3-6-1.
 *
 * @param refusal - The code a `TriggerFormChoice` in `../browser/matchEditor.ts`
 *   carries; `wouldDropAliases` fills `{count}`.
 * @returns The translated sentence.
 */
export function tTriggerFormRefusal(refusal: TriggerFormRefusal): string {
  return translate(
    locale.current,
    triggerFormRefusalKey(refusal),
    refusal.kind === 'wouldDropAliases' ? { count: refusal.count } : {}
  );
} // End of function tTriggerFormRefusal()

/**
 * Renders what a trigger presentation says, in the current language, or `null`
 * for a snippet with one form, which owes no sentence — Phase 3-6-1.
 *
 * @param presentation - `TriggerFormView.presentation` in
 *   `../browser/matchEditor.ts`.
 * @returns The translated sentence, or `null`.
 */
export function tTriggerPresentation(presentation: TriggerPresentation): string | null {
  const key = triggerPresentationKey(presentation);
  return key === null ? null : translate(locale.current, key);
} // End of function tTriggerPresentation()

/**
 * Renders the repair a `several` presentation offers, in the current language —
 * Phase 3-6-1.
 *
 * @param repair - The repair code.
 * @returns The translated sentence.
 */
export function tTriggerRepair(repair: TriggerRepair): string {
  return translate(locale.current, triggerRepairKey(repair));
} // End of function tTriggerRepair()

/**
 * Renders the label of one trigger-form choice's control, in the current
 * language — Phase 3-6-2: *Change to* over a held form, *Add a trigger as* on a
 * snippet with none.
 *
 * @param presentation - `TriggerFormView.presentation` in
 *   `../browser/matchEditor.ts`.
 * @param form - The choice's label, as `TriggerFormChoice.label` names it.
 * @returns The translated label.
 */
export function tTriggerFormChoice(presentation: TriggerPresentation, form: DetailFieldName): string {
  return translate(locale.current, triggerFormChoiceKey(presentation), { form: tDetailField(form) });
} // End of function tTriggerFormChoice()

/**
 * Renders the sentence introducing what a drafted change of trigger form writes,
 * in the current language — Phase 3-6-2.
 *
 * @param preview - `TriggerFormView.preview` in `../browser/matchEditor.ts`.
 * @returns The translated sentence.
 */
export function tTriggerFormTextNote(preview: TriggerFormPreview): string {
  return translate(locale.current, triggerFormTextNoteKey(preview));
} // End of function tTriggerFormTextNote()

/**
 * Renders the label of the control that withdraws a drafted trigger form, in the
 * current language — Phase 3-6-2.
 *
 * @param withdrawal - `TriggerFormView.withdrawal` in `../browser/matchEditor.ts`.
 * @returns The translated label.
 */
export function tTriggerWithdrawal(withdrawal: TriggerWithdrawal): string {
  return translate(locale.current, triggerWithdrawalKey(withdrawal));
} // End of function tTriggerWithdrawal()

/**
 * Renders how the file writes a list and that a save keeps it, in the current
 * language, or `null` for a style that owes no note — Phase 3-6-2.
 *
 * @param style - `ListModel.style` in `../browser/matchEditor.ts`.
 * @returns The translated sentence, or `null`.
 */
export function tListStyleNote(style: ListStyle): string | null {
  const key = listStyleNoteKey(style);
  return key === null ? null : translate(locale.current, key);
} // End of function tListStyleNote()

/**
 * Renders the marker one drafted list item carries, in the current language, or
 * `null` for an item kept as the file has it — Phase 3-6-2.
 *
 * @param status - `ListItemModel.status` in `../browser/matchLists.ts`.
 * @returns The translated marker, or `null`.
 */
export function tListItemStatus(status: ListItemStatus): string | null {
  const key = listItemStatusKey(status);
  return key === null ? null : translate(locale.current, key);
} // End of function tListItemStatus()

/**
 * Renders why this window cannot read one snippet again.
 *
 * The accessor over a `Reprojection`'s refusal, for `tFieldRefusal`'s reason. It
 * exists as a **code with three arms** because the single sentence it replaces
 * named one cause — *the window is no longer showing the file* — and was false for
 * the other two, which is the defect class this project names as its worst.
 *
 * @param reason - Why the window holds no fresh projection of the snippet.
 * @returns The translated sentence.
 */
export function tReprojectionRefusal(reason: ReprojectionRefusal): string {
  return translate(locale.current, reprojectionRefusalKey(reason));
} // End of function tReprojectionRefusal()

/**
 * Renders why a new snippet may not be written into one file.
 *
 * The accessor over `destinationEligibility`'s verdict, here for
 * `tFieldRefusal`'s reason: a component that wrote
 * `t(destinationRefusalKey(reason))` would be turning a code into a key in
 * markup, which CLAUDE.md section 2 forbids and
 * `scripts/lint/built-translation-keys.ts` refuses.
 *
 * @param reason - Why the file cannot be a destination.
 * @returns The translated sentence.
 */
export function tDestinationRefusal(reason: DestinationRefusal): string {
  return translate(locale.current, destinationRefusalKey(reason));
} // End of function tDestinationRefusal()

/**
 * Renders why the new-snippet form cannot be submitted as it stands.
 *
 * @param reason - What `creationRefusal` answered.
 * @returns The translated sentence.
 */
export function tCreationRefusal(reason: CreationRefusal): string {
  return translate(locale.current, creationRefusalKey(reason));
} // End of function tCreationRefusal()

/**
 * Renders why one snippet may not be deleted.
 *
 * @param reason - What `deletionEligibility` answered.
 * @returns The translated sentence.
 */
export function tDeletionRefusal(reason: DeletionRefusal): string {
  return translate(locale.current, deletionRefusalKey(reason));
} // End of function tDeletionRefusal()

/**
 * Renders why one snippet may not be moved at all.
 *
 * @param reason - What `moveEligibility` answered.
 * @returns The translated sentence.
 */
export function tMoveRefusal(reason: MoveRefusal): string {
  return translate(locale.current, moveRefusalKey(reason));
} // End of function tMoveRefusal()

/**
 * Renders why the move control does nothing as things stand.
 *
 * A second accessor beside {@link tMoveRefusal} because the two answer different
 * questions: that one is about the snippet, this one is about what the
 * destination panel is currently showing.
 *
 * @param reason - What `moveSubmissionRefusal` answered.
 * @returns The translated sentence.
 */
export function tMoveSubmissionRefusal(reason: MoveSubmissionRefusal): string {
  return translate(locale.current, moveSubmissionRefusalKey(reason));
} // End of function tMoveSubmissionRefusal()

/**
 * Renders one thing the person may do about a move that produced no outcome.
 *
 * @param choice - What `moveRecoveryChoices` offered.
 * @returns The translated label.
 */
export function tMoveRecovery(choice: MoveRecovery): string {
  return translate(locale.current, moveRecoveryKey(choice));
} // End of function tMoveRecovery()

/**
 * Renders what a confirmed reload takes with it on the destination panel.
 *
 * The accessor over `MoveReloadWarning`, here for {@link tConflictOperation}'s
 * reason: a component that turned the code into a key in markup would be doing
 * the one thing CLAUDE.md section 2 forbids — and there is an arm to turn only
 * because the single sentence this replaces claimed the destination named a
 * snippet, which is false of `top` and of `end`.
 *
 * **Neither arm repeats the close/abandon guarantee.** That is one sentence,
 * chosen by `reloadWarningFor` in `../browser/saveOutcome` and drawn once at the
 * top of the same panel.
 *
 * @param warning - What the model said the confirmation step has to say.
 * @returns The translated sentence.
 */
export function tMoveReloadWarning(warning: MoveReloadWarning): string {
  return translate(locale.current, moveReloadWarningKey(warning));
} // End of function tMoveReloadWarning()

/**
 * Renders why one snippet may not be duplicated at all.
 *
 * @param reason - What `duplicationEligibility` answered.
 * @returns The translated sentence.
 */
export function tDuplicationRefusal(reason: DuplicationRefusal): string {
  return translate(locale.current, duplicationRefusalKey(reason));
} // End of function tDuplicationRefusal()

/**
 * Renders why the duplicate control does nothing as things stand.
 *
 * A second accessor beside {@link tDuplicationRefusal} for
 * {@link tMoveSubmissionRefusal}'s reason: that one is about the snippet, this
 * one is about what the panel is currently showing.
 *
 * @param reason - What `duplicationSubmissionRefusal` answered.
 * @returns The translated sentence.
 */
export function tDuplicationSubmissionRefusal(reason: DuplicationSubmissionRefusal): string {
  return translate(locale.current, duplicationSubmissionRefusalKey(reason));
} // End of function tDuplicationSubmissionRefusal()

/**
 * Renders one thing the person may do about a duplicate that produced no
 * outcome.
 *
 * @param choice - What `duplicationRecoveryChoices` offered.
 * @returns The translated label.
 */
export function tDuplicationRecovery(choice: DuplicationRecovery): string {
  return translate(locale.current, duplicationRecoveryKey(choice));
} // End of function tDuplicationRecovery()

/**
 * Renders why this application will not prepare or confirm a replacement of one
 * file's whole text right now.
 *
 * **One accessor for all nine arms of `RestoreRefusal`, including the seven
 * competing surfaces its `writeSurfaceOpen` arm can name.**
 * `restoreRefusalKey` in `../browser/restore` delegates its `writeSurfaceOpen`
 * arm to `openWriteSurfaceKey`, so *which* surface is open is decided in one
 * place; a second accessor over `CompetingWriteSurfaceKind` would have no caller
 * here, because a component never reaches that code without the refusal that
 * carries it.
 *
 * **What no test in this repository holds**, in the same sentence as what one
 * does: `restoreCodes.test.ts` pins that every arm names a real entry in both
 * dictionaries and that a listed vocabulary of forbidden claims does not appear
 * in any of them, and nothing anywhere pins what the sentences *mean* — the i18n
 * suites check key parity and placeholder agreement and never meaning
 * (`CLAUDE.md` section 6).
 *
 * @param refusal - What `restoreRefusal` answered.
 * @returns The translated sentence.
 */
export function tRestoreRefusal(refusal: RestoreRefusal): string {
  return translate(locale.current, restoreRefusalKey(refusal));
} // End of function tRestoreRefusal()

/**
 * Renders the sentence the restore pane draws where its reload control has gone,
 * in the current language — Phase 2d-6-8b.
 *
 * The accessor over `restoreReloadUnavailableKey` in `../browser/restore`, which
 * delegates the `candidateKept` arm to the shared `reloadUnavailableKey` and
 * answers the pane's own key for `noCandidate` — a conflict whose candidate was
 * dropped while it stood, where the shared sentence's *what you asked for here
 * is still set up* would be false (2d-6-5 §4 item 12). Which arm is drawn is
 * `RestoreView.reloadUnavailableLine`'s decision.
 *
 * @param line - What the view answered.
 * @returns The translated sentence.
 */
export function tRestoreReloadUnavailable(line: RestoreReloadUnavailable): string {
  return translate(locale.current, restoreReloadUnavailableKey(line));
} // End of function tRestoreReloadUnavailable()

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
 * Renders one line of a conflict of **either origin**, in the current language.
 *
 * The reactive wrapper over `describeConflictMessage` in `./codes` (Phase
 * 2d-6-1a). It exists because an external conflict's first line,
 * `fileChangedWhileOpen`, is not a `SaveOutcomeMessage` and
 * {@link tSaveOutcomeMessage} cannot take the external model's list; a renderer
 * of `view.conflict` calls this one for both arms and never narrows the union in
 * markup.
 *
 * **Eight components call it** — `MatchEditor.svelte`, `MatchCreator.svelte` and
 * `RecoveryPanel.svelte` since Phase 2d-6-6c-1, `MatchDeleter.svelte`,
 * `MatchMover.svelte` and `MatchDuplicator.svelte` since 2d-6-7b, `RawEditor.svelte`
 * and `RestorePane.svelte` since 2d-6-8b — over `view.externalMessages` in the
 * external conflict panel each draws outside the save-outcome branch (the 2d-6
 * record's §3 entry 10). Every component still draws a save outcome's lines through
 * {@link tSaveOutcomeMessage} over `view.messages`, whose type is unchanged.
 *
 * @param message - A line of either conflict arm.
 * @returns The translated sentence.
 */
export function tConflictMessage(message: ConflictMessage): string {
  return describeConflictMessage(locale.current, message);
} // End of function tConflictMessage()

/**
 * Renders the line a surface shows while an observation about its file is held
 * or a write's outcome is unknown, in the current language.
 *
 * The reactive wrapper over `describeExternalConflictNotice` in `./codes` (the
 * 2d-6 record's §3 entries 13 and 14). **No component calls it since Phase
 * 2d-6-9b-2**: the eight write panels called it over their views' notices from
 * 2d-6-6c-1, 2d-6-7b and 2d-6-8b until the pane's `FileReconciliationStatus.svelte`
 * block became the one drawing of both sentences (through
 * `tReconciliationFileState`, the same two keys). Kept, with its accessor, as the
 * reviewed rendering of the notice codes; its removal is an open item of that
 * phase's record.
 *
 * @param notice - Which state the surface is in.
 * @returns The translated sentence.
 */
export function tExternalConflictNotice(notice: ExternalConflictNotice): string {
  return describeExternalConflictNotice(locale.current, notice);
} // End of function tExternalConflictNotice()

/**
 * Renders the label of the control that ends an uncertainty hold, in the current
 * language.
 *
 * The reactive wrapper over `describeExternalConflictAction` in `./codes`. It
 * labels the control that calls `BrowserState.acknowledgeWriteUncertainty` in
 * `../browser/workspace.svelte.ts`. The renderers draw that label through
 * `tReconciliationControl('acknowledgeUncertainty')`, which returns the same key,
 * so no component calls this wrapper; it is kept with its accessor as the
 * reviewed pairing of the label with its notice.
 *
 * @param action - Which control to label.
 * @returns The translated label.
 */
export function tExternalConflictAction(action: ExternalConflictAction): string {
  return describeExternalConflictAction(locale.current, action);
} // End of function tExternalConflictAction()

/**
 * Renders the line saying where one conflict came from, in the current language.
 *
 * The accessor over `conflictOriginMessageKey` in `../browser/conflictSource`, here
 * for `tSaveOutcomeMessage`'s reason: a component that turned the code into a key in
 * markup would be doing the one thing CLAUDE.md section 2 forbids.
 *
 * **Neither sentence carries an operand**, so nothing is substituted here. Neither
 * names a file, a revision or a time — the watcher line says in as many words that
 * this application cannot say what changed the file or when.
 *
 * **Eight components draw it** — `MatchEditor.svelte`, `MatchCreator.svelte` and
 * `RecoveryPanel.svelte` since Phase 2d-6-6c-1, `MatchDeleter.svelte`,
 * `MatchMover.svelte` and `MatchDuplicator.svelte` since 2d-6-7b, `RawEditor.svelte`
 * and `RestorePane.svelte` since 2d-6-8b — as the first line of a conflict panel
 * of either origin, over `conflictOriginMessage(conflict.source)`.
 *
 * @param message - Which origin line the model asked for.
 * @returns The translated sentence.
 */
export function tConflictOriginMessage(message: ConflictOriginMessage): string {
  return translate(locale.current, conflictOriginMessageKey(message));
} // End of function tConflictOriginMessage()

/**
 * Renders one thing the person may do about a conflict, in the current language.
 *
 * **None of these labels is "keep my draft"**, and none may become one: that
 * phrase means *reapply the draft to the newly parsed document*, which is Phase
 * 2c-4b (`docs/decisions/2c-split-notes.md` section 6).
 *
 * **The draft kind travels with the choice**, because the confirmation's label
 * says what is discarded and the three `operationChoice` surfaces discard no text
 * (2c-4a-3b). It is the calling surface's own `CONFLICT_CAPABILITIES.draftKind`;
 * nothing here can check that it is.
 *
 * @param choice - What the model offers.
 * @param draftKind - What the calling surface's retained draft is.
 * @returns The translated label.
 */
export function tConflictChoice(choice: ConflictChoice, draftKind: ConflictDraftKind): string {
  return translate(locale.current, conflictChoiceKey(choice, draftKind));
} // End of function tConflictChoice()

/**
 * Renders why the reload control has gone from a conflict panel.
 *
 * The accessor over `reloadUnavailableKey`, and the **third** place this
 * application chooses between an editing wording and an operation one — the
 * orchestrator's finding at 2c-4a-3c-4. All three now branch in
 * `../browser/draftKind`, so the sentence and the two labels beside it cannot
 * drift apart.
 *
 * Six components drew this line as a bare key literal, which is legal only
 * because there was one key; there are two now, and an accessor is how a code
 * reaches a screen in this project.
 *
 * @param draftKind - What the calling surface's retained draft is.
 * @returns The translated sentence.
 */
export function tReloadUnavailable(draftKind: ConflictDraftKind): string {
  return translate(locale.current, reloadUnavailableKey(draftKind));
} // End of function tReloadUnavailable()

/**
 * Renders what an `operationChoice` surface's retained draft asked for.
 *
 * The accessor over `ConflictOperation`, here for `tConflictChoice`'s reason: a
 * component that turned the code into a key in markup would be doing the one
 * thing CLAUDE.md section 2 forbids.
 *
 * **It carries no operand and names no snippet.** Which snippet the panel is
 * about is drawn from the projection the session opened over, above this line;
 * naming one from the disk side would be the cross-revision identification
 * 2c-4b owns.
 *
 * @param operation - What the model said the retained draft asked for.
 * @returns The translated sentence.
 */
export function tConflictOperation(operation: ConflictOperation): string {
  return translate(locale.current, conflictOperationKey(operation));
} // End of function tConflictOperation()

/**
 * Renders what a save would do with one field of a retained draft.
 *
 * The accessor over `RetainedDraftField.status`, here for `tFieldRefusal`'s
 * reason: a component that wrote `t(draftFieldStatusKey(status))` would be turning
 * a code into a key in markup, which CLAUDE.md section 2 forbids.
 *
 * @param status - What the model said a save would do with the field.
 * @returns The translated phrase.
 */
export function tDraftFieldStatus(status: DraftFieldStatus): string {
  return translate(locale.current, draftFieldStatusKey(status));
} // End of function tDraftFieldStatus()

/**
 * Renders a retained draft as the labelled reference copy a conflict offers.
 *
 * **The one adapter between the format and the sentences.** `referenceCopyOf` in
 * `../browser/saveOutcome` decides the order, the heading's position and the fact
 * that each field's text is inserted byte for byte — rules a test drives — and
 * this supplies the three localized pieces it assembles them from. Two components
 * call it, so neither holds a copy of the format and neither can drift from the
 * other.
 *
 * **It is a reference copy and never YAML** (consult Q4): emitting YAML from a
 * projection would drop comments, key order and scalar spelling while looking like
 * something that could be pasted back into a configuration file.
 *
 * @param fields - The retained draft, in the surface's own field order.
 * @returns The text to put on the clipboard.
 */
export function tDraftCopy(fields: readonly RetainedDraftField[]): string {
  return referenceCopyOf(fields, {
    heading: t('browser.saveOutcome.copyHeading'),
    label: tDetailField,
    status: tDraftFieldStatus
  });
} // End of function tDraftCopy()

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
// **Five of them are called from components; the rest have no production
// caller.** `tSaveVerdict`, `tFindingCode`, `tEditError`, `tSaveError` and
// `tPresentationNote` are drawn by the write panels (`MatchEditor.svelte`,
// `MatchCreator.svelte`, `RecoveryPanel.svelte`, the three operation panels,
// `RawEditor.svelte` and `RestorePane.svelte` — `tEditError` and `tSaveError` by
// all but `RawEditor.svelte`). The other accessors here were shipped with the
// codes they describe, as 1b-1 shipped the whole i18n layer, because a boundary
// that arrives with the code it describes cannot be half built.

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
// The correspondence evidence a conflict carries — Phase 2c-4b-1
// ---------------------------------------------------------------------------
//
// Three accessors written one sub-phase before anything called them, because a
// code with no string is worse than a code with no caller and the only lawful way
// to reach a `code.` key is an accessor whose return type makes a missing one a
// compile error. **Two of them have callers as of 2c-4b-3**: the composing
// describers below put `tReapplyRefusal`'s sentence under the obstacle that
// carried the code. `tReapplyResolution` and `tReapplyPlacement` still have none —
// they describe an evidence slot whole, which no panel this step draws shows.

/**
 * Renders what the search for a conflict's own snippet found, in the current
 * language.
 *
 * **Evidence, not a promise.** Nothing here says a save would now succeed, that
 * a draft still applies, that nothing else in the file changed, or that the file
 * cannot change again. A screen that shows the refusing arm renders
 * {@link tReapplyRefusal} beside this rather than instead of it, and a screen
 * showing an operation placed after a named snippet renders
 * {@link tReapplyPlacement} beside it too — this accessor says nothing about a
 * destination.
 *
 * @param resolution - A resolution as it crossed the boundary.
 * @returns The translated sentence.
 */
export function tReapplyResolution(resolution: ReapplyResolution): string {
  return describeReapplyResolution(locale.current, resolution);
} // End of function tReapplyResolution()

/**
 * Renders what the search for a conflict's positional anchor found, in the
 * current language.
 *
 * The second half of one conflict's evidence, and a separate sentence set
 * because it answers a separate question. *This change brings its own snippet*
 * and *this change is not placed after a named one* are two facts, and one
 * sentence for both would be untrue of one of them.
 *
 * @param placement - A placement resolution as it crossed the boundary.
 * @returns The translated sentence.
 */
export function tReapplyPlacement(placement: ReapplyPlacement): string {
  return describeReapplyPlacement(locale.current, placement);
} // End of function tReapplyPlacement()

/**
 * Renders why a conflict's snippet could not be identified, in the current
 * language.
 *
 * Each sentence is a **negative claim about evidence**: none of them says the
 * snippet is gone, and none of them says who changed the file.
 *
 * @param reason - A refusal as it crossed the boundary.
 * @returns The translated message.
 */
export function tReapplyRefusal(reason: ReapplyRefusal): string {
  return describeReapplyRefusal(locale.current, reason);
} // End of function tReapplyRefusal()

// ---------------------------------------------------------------------------
// *Keep my draft*, as sentences — Phase 2c-4b-3
// ---------------------------------------------------------------------------
//
// The readiness line that stands beside the control, the six arms one attempt can
// end on, and one composing describer per surface for the obstacle that refused
// it. **The composition is here rather than in five components** for the reason
// every model in `src/lib/browser/` states about itself: an obstacle that carries
// a nested code needs two sentences, and a renderer that walked the union itself
// could omit the second one while every other renderer showed it — a rule written
// into one renderer is carried by that renderer's mounted suite alone (2c-3c-3).
//
// **What no test in this repository can hold about any of it**: that a sentence
// says what the consult's Q6 requires. The i18n suites check key parity and
// placeholder agreement, never meaning (`CLAUDE.md` section 6).

/**
 * Renders what one reapply attempt ended as, in one language.
 *
 * **Six arms and no operand.** `manualResolution` says only that this attempt
 * applied nothing, wrote nothing and moved nothing; *why* is the surface's own
 * obstacle, drawn beside this and never folded into it. **Every one of the six
 * bounds its claim to the attempt** since Phase 2d-6-2's register review — *this
 * reapply attempt wrote nothing*, never *nothing was written* — because a reapply
 * can be asked for after a write of this window's own whose outcome is unknown,
 * and an unbounded sentence would then be a claim about the file nobody can make.
 *
 * @param locale - The dictionary to read from.
 * @param code - Which arm the attempt ended on.
 * @returns The translated sentence.
 */
export function describeReapplyOutcome(locale: Locale, code: ReapplyOutcomeCode): string {
  return translate(locale, reapplyOutcomeKey(code));
} // End of function describeReapplyOutcome()

/**
 * Renders what one reapply attempt ended as, in the current language.
 *
 * @param code - Which arm the attempt ended on.
 * @returns The translated sentence.
 */
export function tReapplyOutcome(code: ReapplyOutcomeCode): string {
  return describeReapplyOutcome(locale.current, code);
} // End of function tReapplyOutcome()

/**
 * Renders the line that stands beside *Keep my draft*, in one language.
 *
 * @param locale - The dictionary to read from.
 * @param draftKind - What the calling surface's retained draft is.
 * @returns The translated sentence.
 */
export function describeReapplyReadiness(
  locale: Locale,
  draftKind: ConflictDraftKind
): string {
  return translate(locale, reapplyReadinessKey(draftKind));
} // End of function describeReapplyReadiness()

/**
 * Renders the line that stands beside *Keep my draft*, in the current language.
 *
 * @param draftKind - What the calling surface's retained draft is, from its own
 *   `CONFLICT_CAPABILITIES`.
 * @returns The translated sentence.
 */
export function tReapplyReadiness(draftKind: ConflictDraftKind): string {
  return describeReapplyReadiness(locale.current, draftKind);
} // End of function tReapplyReadiness()

/**
 * Renders why an external observation's correspondence was refused, in one
 * language.
 *
 * The accessor over `externalEvidenceRefusalKey` in `../browser/reapply`, here for
 * `tReapplyOutcome`'s reason: a component that turned the code into a key in markup
 * would be doing the one thing CLAUDE.md section 2 forbids.
 *
 * **None of the five sentences carries an operand**, so nothing is substituted
 * here. None names a revision: a content revision is a hex digest, and showing one
 * beside a refusal would invite a person to compare two strings that carry no
 * order. Three are about the table and two, since Phase 2d-6-2, about its rows —
 * no row for the snippet, or more than one (the 2d-6 record's §3 entry 20).
 *
 * **Drawn since Phase 2d-6-6c-1, through the reapply obstacles.** The match
 * editor's, the new-snippet form's and the recovery form's reapplies reach these
 * through their `describe*ReapplyObstacle` accessors, and the three panels draw
 * the obstacle beside the reapply outcome after a *Keep my draft* over an external
 * conflict; `DetailPane.test.ts` reads the `noCorrespondence` sentence off the
 * editor's panel in both languages.
 *
 * @param locale - The dictionary to read from.
 * @param reason - Which negative claim about the table, or about its rows, this is.
 * @returns The translated sentence.
 */
export function describeExternalEvidenceRefusal(
  locale: Locale,
  reason: ExternalEvidenceRefusal
): string {
  return translate(locale, externalEvidenceRefusalKey(reason));
} // End of function describeExternalEvidenceRefusal()

/**
 * Renders why an external observation's correspondence was refused, in the current
 * language.
 *
 * @param reason - Which negative claim about the table, or about its rows, this is.
 * @returns The translated sentence.
 */
export function tExternalEvidenceRefusal(reason: ExternalEvidenceRefusal): string {
  return describeExternalEvidenceRefusal(locale.current, reason);
} // End of function tExternalEvidenceRefusal()

/**
 * Renders that a conflict's evidence was superseded by another accepted reading,
 * in one language.
 *
 * The accessor over `SUPERSEDED_EVIDENCE_KEY` in `../browser/reapply`, and the one
 * sentence the `superseded` arm of `ReapplyEvidenceAccess` owes. It takes no
 * operand and names no revision, for the reason the three refusals above do not: a
 * content revision is a hex digest, and showing one beside a refusal invites a
 * person to compare two strings that carry no order. **Since Phase 2d-6-1a the
 * sentence says the accepted evidence changed and not that the disk is newer** (the
 * 2d-6 record's §3 entry 24): the accepted sequence orders observations, and it
 * establishes nothing about disk chronology relative to a locked save read.
 *
 * **Its key is drawn; this accessor is not called.** The `supersededEvidence`
 * obstacle of each of the six reapplying surfaces — the match editor, the
 * new-snippet form, the recovery form, the deleter, the mover and the duplicator —
 * resolves to `SUPERSEDED_EVIDENCE_KEY` through that surface's own
 * `describe*ReapplyObstacle` accessor (the editor's is
 * {@link describeEditorReapplyObstacle}), and each surface's component draws the
 * obstacle through its `t*ReapplyObstacle` wrapper. Nothing in production calls
 * {@link describeSupersededEvidence} or {@link tSupersededEvidence}; they are kept
 * as the key's own accessor pair.
 *
 * @param locale - The dictionary to read from.
 * @returns The translated sentence.
 */
export function describeSupersededEvidence(locale: Locale): string {
  return translate(locale, SUPERSEDED_EVIDENCE_KEY);
} // End of function describeSupersededEvidence()

/**
 * Renders that a conflict's evidence was superseded by another accepted reading,
 * in the current language.
 *
 * @returns The translated sentence.
 */
export function tSupersededEvidence(): string {
  return describeSupersededEvidence(locale.current);
} // End of function tSupersededEvidence()

/**
 * One obstacle's own sentence followed by the wire code's, as one string.
 *
 * The shape every composing describer below shares: the obstacle names *what*
 * could not be done and the nested code names *what the search answered*, and the
 * second is never dropped, because the first alone would leave a person with a
 * refusal and no reason.
 *
 * @param locale - The dictionary to read from.
 * @param key - The obstacle's own key.
 * @param reason - The correspondence refusal it carried.
 * @returns The two sentences, joined by a space.
 */
function obstacleWithRefusal(
  locale: Locale,
  key: TranslationKey,
  reason: ReapplyRefusal
): string {
  return `${translate(locale, key)} ${describeReapplyRefusal(locale, reason)}`;
} // End of function obstacleWithRefusal()

/**
 * Renders one of the two obstacles every surface shares, in one language.
 *
 * @param locale - The dictionary to read from.
 * @param obstacle - The shared obstacle.
 * @returns The translated sentence, with the correspondence refusal's under it.
 */
function describeSharedReapplyObstacle(
  locale: Locale,
  obstacle: SharedReapplyObstacle
): string {
  const key = sharedReapplyObstacleKey(obstacle);
  return obstacle.kind === 'correspondence'
    ? obstacleWithRefusal(locale, key, obstacle.reason)
    : translate(locale, key);
} // End of function describeSharedReapplyObstacle()

/**
 * Renders why a match editor's reapply refused, in one language.
 *
 * **`fieldCollisions` names its fields, and the list is joined with a comma and a
 * space in every language.** That is a compromise this file states rather than
 * hides: a locale whose list separator differs would need its own rule, and none
 * of the two shipped does. The names themselves come from the detail pane's own
 * labels, so a field is called the same thing here as it is where it is edited.
 *
 * **A `switch` with a `never` terminus since Phase 2d-6-2**, when the union grew
 * the four external-origin arms — a refused table or row, superseded evidence, a
 * write whose outcome is unknown, and a reading the window holds undecided — so
 * that an arm added to
 * `EditorReapplyObstacle` with no sentence chosen here is a compile error rather
 * than a fall-through into the shared describer, which would have thrown on it.
 *
 * @param locale - The dictionary to read from.
 * @param obstacle - What stopped the reapply.
 * @returns The translated sentence.
 */
export function describeEditorReapplyObstacle(
  locale: Locale,
  obstacle: EditorReapplyObstacle
): string {
  switch (obstacle.kind) {
    case 'fieldCollisions':
      return translate(locale, editorReapplyObstacleKey(obstacle), {
        fields: obstacle.fields
          .map((field) => translate(locale, detailFieldKey(collisionLabelName(field))))
          .join(', ')
      });
    case 'targetNotEditable':
    case 'externalEvidence':
    case 'supersededEvidence':
    case 'writeOutcomeUnknown':
    case 'observationRetained':
      return translate(locale, editorReapplyObstacleKey(obstacle));
    case 'correspondence':
    case 'evidenceNotATarget':
      return describeSharedReapplyObstacle(locale, obstacle);
    default: {
      const unreachable: never = obstacle;
      return unreachable;
    }
  }
} // End of function describeEditorReapplyObstacle()

/**
 * Renders why a match editor's reapply refused, in the current language.
 *
 * @param obstacle - What stopped the reapply.
 * @returns The translated sentence.
 */
export function tEditorReapplyObstacle(obstacle: EditorReapplyObstacle): string {
  return describeEditorReapplyObstacle(locale.current, obstacle);
} // End of function tEditorReapplyObstacle()

/**
 * Renders why a creation form's reapply refused, in one language.
 *
 * **A `switch` with a `never` terminus since Phase 2d-6-3**, when the union grew
 * the external-origin arms — a form naming no file, a refused table or row,
 * superseded evidence, a write whose outcome is unknown, and a reading the window
 * holds undecided — so that an arm added to `CreationReapplyObstacle` with no
 * sentence chosen here is a compile error rather than a fall-through.
 *
 * @param locale - The dictionary to read from.
 * @param obstacle - What stopped the reapply.
 * @returns The translated sentence, with any nested code's under it.
 */
export function describeCreationReapplyObstacle(
  locale: Locale,
  obstacle: CreationReapplyObstacle
): string {
  const key = creationReapplyObstacleKey(obstacle);
  switch (obstacle.kind) {
    case 'anchorCorrespondence':
      return obstacleWithRefusal(locale, key, obstacle.reason);
    case 'creationRefused':
      return `${translate(locale, key)} ${translate(locale, creationRefusalKey(obstacle.reason))}`;
    case 'evidenceNotAnAnchor':
    case 'anchorNotInDestination':
    case 'notTheDestination':
    case 'destinationRequired':
    case 'externalEvidence':
    case 'supersededEvidence':
    case 'writeOutcomeUnknown':
    case 'observationRetained':
      return translate(locale, key);
    case 'correspondence':
    case 'evidenceNotATarget':
      return describeSharedReapplyObstacle(locale, obstacle);
    default: {
      const unreachable: never = obstacle;
      return unreachable;
    }
  }
} // End of function describeCreationReapplyObstacle()

/**
 * Renders why a creation form's reapply refused, in the current language.
 *
 * @param obstacle - What stopped the reapply.
 * @returns The translated sentence.
 */
export function tCreationReapplyObstacle(obstacle: CreationReapplyObstacle): string {
  return describeCreationReapplyObstacle(locale.current, obstacle);
} // End of function tCreationReapplyObstacle()

/**
 * Renders why a deletion's reapply refused, in one language.
 *
 * **A `switch` with a `never` terminus since Phase 2d-6-4**, when the union grew
 * the four external-origin arms — a refused table or row, superseded evidence, a
 * write whose outcome is unknown, and a reading the window holds undecided — so
 * that an arm added to `DeletionReapplyObstacle` with no sentence chosen here is
 * a compile error rather than a fall-through.
 *
 * @param locale - The dictionary to read from.
 * @param obstacle - What stopped the reapply.
 * @returns The translated sentence, with any nested code's under it.
 */
export function describeDeletionReapplyObstacle(
  locale: Locale,
  obstacle: DeletionReapplyObstacle
): string {
  const key = deletionReapplyObstacleKey(obstacle);
  switch (obstacle.kind) {
    case 'notDeletable':
      return `${translate(locale, key)} ${translate(locale, deletionRefusalKey(obstacle.reason))}`;
    case 'externalEvidence':
    case 'supersededEvidence':
    case 'writeOutcomeUnknown':
    case 'observationRetained':
      return translate(locale, key);
    case 'correspondence':
    case 'evidenceNotATarget':
      return describeSharedReapplyObstacle(locale, obstacle);
    default: {
      const unreachable: never = obstacle;
      return unreachable;
    }
  }
} // End of function describeDeletionReapplyObstacle()

/**
 * Renders why a deletion's reapply refused, in the current language.
 *
 * @param obstacle - What stopped the reapply.
 * @returns The translated sentence.
 */
export function tDeletionReapplyObstacle(obstacle: DeletionReapplyObstacle): string {
  return describeDeletionReapplyObstacle(locale.current, obstacle);
} // End of function tDeletionReapplyObstacle()

/**
 * Renders why a duplication's reapply refused, in one language.
 *
 * **A `switch` with a `never` terminus since Phase 2d-6-4**, when the union grew
 * the four external-origin arms — a refused table or row, superseded evidence, a
 * write whose outcome is unknown, and a reading the window holds undecided — so
 * that an arm added to `DuplicationReapplyObstacle` with no sentence chosen here
 * is a compile error rather than a fall-through.
 *
 * @param locale - The dictionary to read from.
 * @param obstacle - What stopped the reapply.
 * @returns The translated sentence, with any nested code's under it.
 */
export function describeDuplicationReapplyObstacle(
  locale: Locale,
  obstacle: DuplicationReapplyObstacle
): string {
  const key = duplicationReapplyObstacleKey(obstacle);
  switch (obstacle.kind) {
    case 'notDuplicable':
      return `${translate(locale, key)} ${translate(locale, duplicationRefusalKey(obstacle.reason))}`;
    case 'externalEvidence':
    case 'supersededEvidence':
    case 'writeOutcomeUnknown':
    case 'observationRetained':
      return translate(locale, key);
    case 'correspondence':
    case 'evidenceNotATarget':
      return describeSharedReapplyObstacle(locale, obstacle);
    default: {
      const unreachable: never = obstacle;
      return unreachable;
    }
  }
} // End of function describeDuplicationReapplyObstacle()

/**
 * Renders why a duplication's reapply refused, in the current language.
 *
 * @param obstacle - What stopped the reapply.
 * @returns The translated sentence.
 */
export function tDuplicationReapplyObstacle(obstacle: DuplicationReapplyObstacle): string {
  return describeDuplicationReapplyObstacle(locale.current, obstacle);
} // End of function tDuplicationReapplyObstacle()

/**
 * Renders why a move's reapply refused, in one language.
 *
 * **The subject's refusal and the anchor's are two sentences here too**, because
 * they are two arms in `matchMove.ts` and two enums on the wire: *the snippet you
 * moved* and *the snippet you moved it after* are different things to have lost.
 *
 * **A `never` terminus since Phase 2d-6-4**, when the union grew the four
 * external-origin arms — a refused table or row, superseded evidence, a write
 * whose outcome is unknown, and a reading the window holds undecided — so that an
 * arm added to `MoveReapplyObstacle` with no sentence chosen here is a compile
 * error rather than a fall-through.
 *
 * @param locale - The dictionary to read from.
 * @param obstacle - What stopped the reapply.
 * @returns The translated sentence, with any nested code's under it.
 */
export function describeMoveReapplyObstacle(
  locale: Locale,
  obstacle: MoveReapplyObstacle
): string {
  const key = moveReapplyObstacleKey(obstacle);
  switch (obstacle.kind) {
    case 'anchorCorrespondence':
      return obstacleWithRefusal(locale, key, obstacle.reason);
    case 'moveRefused':
      return `${translate(locale, key)} ${translate(locale, moveSubmissionRefusalKey(obstacle.reason))}`;
    case 'evidenceNotAnAnchor':
    case 'notTheSameSequence':
    case 'anchorNotInSequence':
    case 'externalEvidence':
    case 'supersededEvidence':
    case 'writeOutcomeUnknown':
    case 'observationRetained':
    case 'nothingRequested':
      return translate(locale, key);
    case 'correspondence':
    case 'evidenceNotATarget':
      return describeSharedReapplyObstacle(locale, obstacle);
    default: {
      const unreachable: never = obstacle;
      return unreachable;
    }
  }
} // End of function describeMoveReapplyObstacle()

/**
 * Renders why a move's reapply refused, in the current language.
 *
 * @param obstacle - What stopped the reapply.
 * @returns The translated sentence.
 */
export function tMoveReapplyObstacle(obstacle: MoveReapplyObstacle): string {
  return describeMoveReapplyObstacle(locale.current, obstacle);
} // End of function tMoveReapplyObstacle()

// ---------------------------------------------------------------------------
// Recovery from a conflict nothing could resolve — Phase 2c-4c-3a
// ---------------------------------------------------------------------------
//
// Seven accessors over the six code unions `../browser/recovery` owns, written
// together with the one panel that renders them. Two of them **compose**, for the
// reason the reapply describers above compose: an arm that carries a nested code
// needs two sentences, and a renderer that walked the union itself could omit the
// second one while every other renderer showed it (2c-3c-3).
//
// **The product is named once, in `browser.recovery.open`**, and it is *create a new
// snippet from supported fields*. It is not a duplicate, not an exact copy and not
// *keep my draft* — that phrase is the reapply control's alone
// (`docs/reviews/phase-2c-4c-design.md`, "What this phase must not do").
//
// **Every sentence about {@link SourceConflictState} names an act and never an
// outcome.** `windowMoved` means *an adoption was spent or a re-read was ordered*,
// and nothing in this application learns what came of either — so no string here may
// say the window moved, the list re-ordered or the projection changed. Nothing
// mechanical holds that: these suites check key parity and placeholder agreement,
// never meaning.

/**
 * Renders the label of one thing recovery offers, in the current language.
 *
 * @param choice - What `recoveryAvailability` offered.
 * @returns The translated label.
 */
export function tRecoveryChoice(choice: RecoveryChoice): string {
  return translate(locale.current, recoveryChoiceKey(choice));
} // End of function tRecoveryChoice()

/**
 * Renders why recovery offers nothing on one surface, in the current language.
 *
 * @param reason - What `recoveryAvailability` answered.
 * @returns The translated sentence.
 */
export function tRecoveryUnavailable(reason: RecoveryUnavailable): string {
  return translate(locale.current, recoveryUnavailableKey(reason));
} // End of function tRecoveryUnavailable()

/**
 * Renders what one row of the transfer table says, in the current language.
 *
 * @param status - What `transferStatusOf` answered.
 * @returns The translated phrase.
 */
export function tTransferStatus(status: TransferStatus): string {
  return translate(locale.current, transferStatusKey(status));
} // End of function tTransferStatus()

/**
 * Renders why one field is not carried into a recovered snippet, in one language.
 *
 * **The `fieldNotEditable` arm is two sentences**, and the second is the match
 * editor's own `FieldRefusal` — which already has strings and a key function — so
 * this composes the two rather than a fifth string set being invented for the four
 * eligibility refusals that reach here.
 *
 * @param locale - The dictionary to read from.
 * @param refusal - Why the field is not carried.
 * @returns The translated sentence, with the nested code's under it.
 */
export function describeTransferRefusal(locale: Locale, refusal: TransferRefusal): string {
  const key = transferRefusalKey(refusal);
  if (refusal.kind === 'listNotEditable') {
    return `${translate(locale, key)} ${translate(locale, listRefusalKey(refusal.reason))}`;
  }
  return refusal.kind === 'fieldNotEditable'
    ? `${translate(locale, key)} ${translate(locale, fieldRefusalKey(refusal.reason))}`
    : translate(locale, key);
} // End of function describeTransferRefusal()

/**
 * Renders why one field is not carried into a recovered snippet, in the current
 * language.
 *
 * @param refusal - Why the field is not carried.
 * @returns The translated sentence.
 */
export function tTransferRefusal(refusal: TransferRefusal): string {
  return describeTransferRefusal(locale.current, refusal);
} // End of function tTransferRefusal()

/**
 * Renders why a recovery form cannot be submitted, in the current language.
 *
 * @param reason - What `recoveryRefusal` answered.
 * @returns The translated sentence.
 */
export function tRecoveryRefusal(reason: RecoveryRefusal): string {
  return translate(locale.current, recoveryRefusalKey(reason));
} // End of function tRecoveryRefusal()

/**
 * Renders why a recovery form's reapply refused, in one language.
 *
 * @param locale - The dictionary to read from.
 * @param obstacle - What stopped the reapply.
 * @returns The translated sentence, with any nested code's under it.
 */
export function describeRecoveryReapplyObstacle(
  locale: Locale,
  obstacle: RecoveryReapplyObstacle
): string {
  const key = recoveryReapplyObstacleKey(obstacle);
  switch (obstacle.kind) {
    case 'recoveryRefused':
      return `${translate(locale, key)} ${translate(locale, recoveryRefusalKey(obstacle.reason))}`;
    case 'notTheDestination':
    case 'destinationRequired':
    case 'supersededEvidence':
    case 'writeOutcomeUnknown':
    case 'observationRetained':
      return translate(locale, key);
    case 'correspondence':
    case 'evidenceNotATarget':
      return describeSharedReapplyObstacle(locale, obstacle);
    default: {
      // A `never` terminus since Phase 2d-6-3, when the union grew its four
      // external-origin arms, so an arm with no sentence chosen here is a compile
      // error rather than a fall-through.
      const unreachable: never = obstacle;
      return unreachable;
    }
  }
} // End of function describeRecoveryReapplyObstacle()

/**
 * Renders why a recovery form's reapply refused, in the current language.
 *
 * @param obstacle - What stopped the reapply.
 * @returns The translated sentence.
 */
export function tRecoveryReapplyObstacle(obstacle: RecoveryReapplyObstacle): string {
  return describeRecoveryReapplyObstacle(locale.current, obstacle);
} // End of function tRecoveryReapplyObstacle()

/**
 * Renders what became of the conflict a recovery was opened from, in the current
 * language.
 *
 * **The middle answer names the act and not its outcome.** `windowMoved` says an
 * adoption was spent or a re-read was ordered; it may not say what that did, because
 * `recovery.ts` cannot observe it and a satisfied adoption answers `alreadyThere` as
 * readily as `installed`.
 *
 * @param state - What `sourceConflictState` answered.
 * @returns The translated sentence.
 */
export function tSourceConflictState(state: SourceConflictState): string {
  return translate(locale.current, sourceConflictStateKey(state));
} // End of function tSourceConflictState()

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

/**
 * Renders why a bulk option edit, or one file of it, could not be planned, in
 * the current language (Phase 3-10). Nothing was written.
 *
 * @param error - A bulk planning refusal as it crossed the boundary.
 * @returns The translated message.
 */
export function tBulkPlanError(error: BulkPlanError): string {
  return describeBulkPlanError(locale.current, error);
} // End of function tBulkPlanError()

/**
 * Renders what happened to one file of a bulk option edit, in the current
 * language (Phase 3-10). A per-file sentence, never a claim about the whole
 * request.
 *
 * @param outcome - One file's outcome as it crossed the boundary.
 * @returns The translated sentence.
 */
export function tBulkFileOutcome(outcome: BulkFileOutcome): string {
  return describeBulkFileOutcome(locale.current, outcome);
} // End of function tBulkFileOutcome()

/**
 * Renders why a selected snippet's identity did not resolve, in the current
 * language — the `Identity` arm of a bulk planning refusal (Phase 3-10).
 *
 * @param error - An identity refusal as it crossed the boundary.
 * @returns The translated sentence.
 */
export function tIdentityError(error: IdentityError): string {
  return describeIdentityError(locale.current, error);
} // End of function tIdentityError()

// ---------------------------------------------------------------------------
// The read-only backup catalogue — Phase 2c-5-2
// ---------------------------------------------------------------------------
//
// Six accessors written one sub-phase before anything calls them, because a code
// with no string is worse than a code with no caller and the only lawful way to
// reach a `code.` key is an accessor whose return type makes a missing one a
// compile error. 2c-5-4 is the step that draws them.
//
// Every one of them is bounded by what the catalogue establishes. None says a
// backup is authentic, verified or made by this application; none turns a batch
// name into a time; none calls an entry a version of anything or promises that
// it can be recovered.

/**
 * Renders whether the backup folder was there to be listed, in the current
 * language.
 *
 * **A missing folder is not a failure**, and this sentence does not read as one:
 * a configuration this application has never saved from legitimately has none.
 *
 * @param state - A root state as it crossed the boundary.
 * @returns The translated sentence.
 */
export function tBackupRootState(state: BackupRootState): string {
  return describeBackupRootState(locale.current, state);
} // End of function tBackupRootState()

/**
 * Renders why one entry of the backup folder is not a batch, in the current
 * language.
 *
 * @param reason - A skip reason as it crossed the boundary.
 * @returns The translated phrase.
 */
export function tBatchSkipped(reason: BatchSkipped): string {
  return describeBatchSkipped(locale.current, reason);
} // End of function tBatchSkipped()

/**
 * Renders why one thing inside a batch is not an entry, in the current language.
 *
 * @param reason - A skip reason as it crossed the boundary.
 * @returns The translated phrase.
 */
export function tEntrySkipped(reason: EntrySkipped): string {
  return describeEntrySkipped(locale.current, reason);
} // End of function tEntrySkipped()

/**
 * Renders which part of reading the backup folder failed, in the current
 * language.
 *
 * @param step - A read step as it crossed the boundary.
 * @returns The translated phrase.
 */
export function tBackupReadStep(step: BackupReadStep): string {
  return describeBackupReadStep(locale.current, step);
} // End of function tBackupReadStep()

/**
 * Renders which target namespace an entry's name occupies, in the current
 * language.
 *
 * **A claim about the name**, never about where any bytes came from.
 *
 * @param target - A target classification as it crossed the boundary.
 * @returns The translated phrase.
 */
export function tBackupTarget(target: BackupTarget): string {
  return describeBackupTarget(locale.current, target);
} // End of function tBackupTarget()

/**
 * Renders why a backup-catalogue request did not produce its result, in the
 * current language.
 *
 * **Not every arm is a failed read**: `NotUtf8` is the one where the entry opened
 * and every byte arrived, and only turning those bytes into a string did not
 * succeed.
 *
 * A missing folder never reaches this: that is an outcome on a successful
 * listing. A **forged** identity does not reach it either — that is
 * `unrecognisedBackupBatch` or `unaddressableBackupEntry`, and the difference is
 * whether anything was asked of the disk at all.
 *
 * @param error - A read refusal as it crossed the boundary.
 * @returns The translated message.
 */
export function tBackupReadError(error: BackupReadError): string {
  return describeBackupReadError(locale.current, error);
} // End of function tBackupReadError()

// ---------------------------------------------------------------------------
// The duplicate's seams — a gap Phase 2d-4b's namespace check exposed
// ---------------------------------------------------------------------------

/**
 * Renders one join created by a duplicate, in the current language.
 *
 * {@link tMoveSeam}'s twin. Its three phrases have had dictionary entries since
 * Phase 2c-3c-1 and no accessor until now, which is exactly the state the
 * namespace check in `codes.test.ts` exists to make impossible: a key nothing
 * could lawfully render.
 *
 * @param seam - A duplicate seam as it crossed the boundary.
 * @returns The translated phrase.
 */
export function tDuplicateSeam(seam: DuplicateSeam): string {
  return describeDuplicateSeam(locale.current, seam);
} // End of function tDuplicateSeam()

// ---------------------------------------------------------------------------
// The external-change reconciliation codes — Phase 2d-4b
// ---------------------------------------------------------------------------
//
// Four accessors written before anything calls them, for the reason this file
// already gives about the correspondence evidence: a code with no string is
// worse than a code with no caller, and the only lawful way to reach a `code.`
// key is an accessor whose return type makes a missing one a compile error.
// Phase 2d-6 is what draws any of these; Phase 2d-4b draws nothing.
//
// **What no test in this repository holds about any of the fourteen sentences**
// is that one of them says the right thing. The i18n suites check key parity,
// placeholder agreement and that a sentence is not blank; nothing anywhere
// establishes meaning, or that the Spanish value is Spanish.

/**
 * Renders what happened to a file underneath the window, in the current
 * language.
 *
 * **A statement about the file, never about what this application will do.**
 * None of the four says anything has been reloaded, that a draft still applies,
 * or that the file cannot change again.
 *
 * @param observation - An observation as it crossed the boundary.
 * @returns The translated sentence.
 */
export function tExternalObservation(observation: ExternalObservation): string {
  return describeExternalObservation(locale.current, observation);
} // End of function tExternalObservation()

/**
 * Renders why a file's text is not available, in the current language.
 *
 * **`NotUtf8` is not a failed read**: the bytes arrived and are not text, so its
 * sentence says this application will not guess rather than that the file could
 * not be read. The other five are the operating system's own refusals.
 *
 * @param reason - A reason as it crossed the boundary.
 * @returns The translated sentence.
 */
export function tUnreadableReason(reason: UnreadableReason): string {
  return describeUnreadableReason(locale.current, reason);
} // End of function tUnreadableReason()

/**
 * Renders what a newly seen file's bytes projected to, in the current language.
 *
 * A claim about this application's **reading** of the file and never about
 * whether what it holds is valid espanso configuration.
 *
 * @param content - An addition's content as it crossed the boundary.
 * @returns The translated sentence.
 */
export function tAddedContent(content: AddedContent): string {
  return describeAddedContent(locale.current, content);
} // End of function tAddedContent()

/**
 * Renders what a changed file's new bytes projected to, in the current language.
 *
 * Separate from {@link tAddedContent} because the two answer separate questions:
 * *this file is new to me* and *this file is one I had already read* are two
 * facts, and one sentence for both would be untrue of one of them.
 *
 * @param content - A change's content as it crossed the boundary.
 * @returns The translated sentence.
 */
export function tChangedContent(content: ChangedContent): string {
  return describeChangedContent(locale.current, content);
} // End of function tChangedContent()

/**
 * Renders one workspace reconciliation banner in the current language — Phase
 * 2d-6-9a.
 *
 * The reactive wrapper over `describeReconciliationWorkspaceState` in `./codes`.
 * `ReconciliationStatus.svelte` draws it over the decisions of
 * `decideWorkspaceReconciliation` in `../browser/reconciliationStatus.ts`.
 *
 * @param state - The banner.
 * @returns The translated sentence.
 */
export function tReconciliationWorkspaceState(state: WorkspaceReconciliationState): string {
  return describeReconciliationWorkspaceState(locale.current, state);
} // End of function tReconciliationWorkspaceState()

/**
 * Renders one per-file reconciliation state at one placement in the current
 * language — Phase 2d-6-9a. The reactive wrapper over
 * `describeReconciliationFileState` in `./codes`; drawn since Phase 2d-6-9b-1.
 *
 * @param state - The state.
 * @param placement - Where it is drawn.
 * @returns The translated sentence.
 */
export function tReconciliationFileState(
  state: FileReconciliationState,
  placement: FileStatePlacement
): string {
  return describeReconciliationFileState(locale.current, state, placement);
} // End of function tReconciliationFileState()

/**
 * Renders one reconciliation control's label in the current language — Phase
 * 2d-6-9a. The reactive wrapper over `describeReconciliationControl` in
 * `./codes`; drawn since Phase 2d-6-9b-1.
 *
 * @param control - The control.
 * @returns The translated label.
 */
export function tReconciliationControl(control: ReconciliationControl): string {
  return describeReconciliationControl(locale.current, control);
} // End of function tReconciliationControl()

/**
 * Renders why a reconciliation control is disabled, or why its press was refused,
 * in the current language — Phase 2d-6-9a. The reactive wrapper over
 * `describeReconciliationRefusal` in `./codes`; drawn since Phase 2d-6-9b-1.
 *
 * @param refusal - Why.
 * @returns The translated sentence.
 */
export function tReconciliationRefusal(refusal: ReconciliationRefusal): string {
  return describeReconciliationRefusal(locale.current, refusal);
} // End of function tReconciliationRefusal()

/**
 * Renders one workspace-route note in the current language — Phase 2d-6-9b-1.
 * The reactive wrapper over `describeReconciliationRouteNote` in `./codes`, drawn
 * by `ReconciliationStatus.svelte`.
 *
 * @param note - The note.
 * @returns The translated sentence.
 */
export function tReconciliationRouteNote(note: RouteControlNote): string {
  return describeReconciliationRouteNote(locale.current, note);
} // End of function tReconciliationRouteNote()

/**
 * Renders one write-renderer note in the current language — Phase 2d-6-9b-2.
 * The reactive wrapper over `describeReconciliationSurfaceNote` in `./codes`,
 * drawn by `SnapshotAcknowledgement.svelte` inside each of the eight write panels.
 *
 * @param note - The note.
 * @returns The translated sentence.
 */
export function tReconciliationSurfaceNote(note: SurfaceControlNote): string {
  return describeReconciliationSurfaceNote(locale.current, note);
} // End of function tReconciliationSurfaceNote()

// ---------------------------------------------------------------------------
// The file-scope inspector — Phase 3-9-1
// ---------------------------------------------------------------------------

/**
 * Renders the words for a file the core flags for its `_` name, at one
 * placement, in the current language. The reactive wrapper over
 * `describeAutoLoadNote` in `./codes`, drawn by `Sidebar.svelte` (the mark and
 * its `title`) and `FileScope.svelte`.
 *
 * @param note - The flagged state, from `autoLoadOf`.
 * @param placement - A sidebar mark or the full explanation.
 * @returns The translated words.
 */
export function tAutoLoadNote(note: AutoLoadNote, placement: AutoLoadPlacement): string {
  return describeAutoLoadNote(locale.current, note, placement);
} // End of function tAutoLoadNote()

/**
 * Renders one imports state in the current language. The reactive wrapper over
 * `describeImportsState` in `./codes`, drawn by `FileScope.svelte`.
 *
 * @param state - The state.
 * @returns The translated sentence.
 */
export function tImportsState(state: ImportsState): string {
  return describeImportsState(locale.current, state);
} // End of function tImportsState()

/**
 * Renders one unsupported imports entry's reason in the current language. The
 * reactive wrapper over `describeUnsupportedImport` in `./codes`, drawn by
 * `FileScope.svelte`.
 *
 * @param found - What the entry is written as.
 * @returns The translated sentence.
 */
export function tUnsupportedImport(found: ValueKind): string {
  return describeUnsupportedImport(locale.current, found);
} // End of function tUnsupportedImport()

// ---------------------------------------------------------------------------
// The bulk option edit — Phase 3-11-1
// ---------------------------------------------------------------------------

/**
 * Renders why a selected snippet is left out of a bulk edit, in the current
 * language. The reactive wrapper over `describeBulkExclusion` in `./codes`.
 *
 * @param reason - The exclusion's reason.
 * @returns The translated sentence.
 */
export function tBulkExclusion(reason: BulkExclusionReason): string {
  return describeBulkExclusion(locale.current, reason);
} // End of function tBulkExclusion()

/**
 * Renders why a bulk edit cannot be sent now, in the current language. The
 * reactive wrapper over `describeBulkBlocker` in `./codes`.
 *
 * @param blocker - One blocker.
 * @returns The translated sentence.
 */
export function tBulkBlocker(blocker: BulkBlocker): string {
  return describeBulkBlocker(locale.current, blocker);
} // End of function tBulkBlocker()

/**
 * Renders how one option is written across a selection, in the current
 * language. The reactive wrapper over `describeBulkOptionSummary` in `./codes`.
 *
 * @param kind - The summary's kind; `same` is drawn as the file's own bytes.
 * @returns The translated words.
 */
export function tBulkOptionSummary(kind: WordedOptionSummary): string {
  return describeBulkOptionSummary(locale.current, kind);
} // End of function tBulkOptionSummary()

/**
 * Renders the headline of a bulk edit's answer, in the current language. The
 * reactive wrapper over `describeBulkOutcomeHeadline` in `./codes`.
 *
 * @param headline - The headline.
 * @returns The translated sentence.
 */
export function tBulkOutcomeHeadline(headline: BulkOutcomeHeadline): string {
  return describeBulkOutcomeHeadline(locale.current, headline);
} // End of function tBulkOutcomeHeadline()

/**
 * Renders one counted line of a bulk edit's answer, in the current language —
 * Phase 3-11-2. The reactive wrapper over `describeBulkCount` in `./codes`.
 *
 * @param line - The counted line, from `bulkOutcomeCounts`.
 * @returns The translated line.
 */
export function tBulkCount(line: BulkCountLine): string {
  return describeBulkCount(locale.current, line);
} // End of function tBulkCount()
