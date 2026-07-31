/**
 * The single entry point every component uses to produce user-facing text.
 *
 * Import `t` from here and nothing else: reading a dictionary directly, or
 * writing a literal into markup, is the one habit CLAUDE.md section 2 forbids.
 */

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
  describeVariableKind
} from './codes';
import { translate, type TranslationKey, type TranslationParams } from './dictionaries';

export { DICTIONARIES, placeholdersOf, translate } from './dictionaries';
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
