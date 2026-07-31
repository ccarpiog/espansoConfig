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
import { selectionNoticeKey, type SelectionNotice } from '../browser/notices';
import { codePointLabel, invisibleKey, type InvisibleSegment } from '../browser/sourceText';
import type { CommandError, IpcFailure } from '../ipc/errors';
import type {
  ContentKind,
  DiagnosticCode,
  FileKind,
  HazardKind,
  LineEnding,
  MatchBadge,
  ScalarStyle,
  TriggerKind,
  UnknownReason,
  ValueKind,
  VariableKind
} from '../ipc/types';
import { locale } from '../stores/locale.svelte';
import {
  describeCommandError,
  describeContentKind,
  describeDiagnostic,
  describeFileKind,
  describeHazard,
  describeIpcFailure,
  describeLineEnding,
  describeMatchBadge,
  describeScalarStyle,
  describeTriggerKind,
  describeUnknownReason,
  describeValueKind,
  describeVariableKind
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
  commandErrorKey,
  contentKindKey,
  describeCommandError,
  describeContentKind,
  describeDiagnostic,
  describeFileKind,
  describeHazard,
  describeIpcFailure,
  describeLineEnding,
  describeMatchBadge,
  describeScalarStyle,
  describeTriggerKind,
  describeUnknownReason,
  describeValueKind,
  describeVariableKind,
  diagnosticCodeKey,
  documentShapeKey,
  fileKindKey,
  hazardKindKey,
  lineEndingKey,
  matchBadgeKey,
  scalarStyleKey,
  triggerKindKey,
  unknownReasonKey,
  valueKindKey,
  variableKindKey
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
