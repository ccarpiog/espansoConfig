/**
 * The bridge from a Rust code to a sentence, in whichever language is showing.
 *
 * Plan section 9: *Rust returns error codes and structured data, never
 * user-facing prose.* Everything that crosses the IPC boundary is therefore a
 * variant name plus operands, and the prose for every one of those names lives
 * in `en.json` and `es.json` under the `code.` namespace. This file is the only
 * place that turns the first into the second.
 *
 * ## The key-naming scheme
 *
 * `code.<enum>.<variant>`, where `<enum>` is the Rust enum's name with a
 * lowercase first letter and `<variant>` is the variant's name with a lowercase
 * first letter. `DiagnosticCode::ParseFailed` is `code.diagnosticCode.parseFailed`
 * and `CommandError::NotUtf8` is `code.commandError.notUtf8`.
 *
 * The scheme is **mechanical on purpose**, and it is checked from both sides:
 *
 * - **In TypeScript, at compile time.** Every builder below returns a
 *   {@link TranslationKey}, and its body is a template literal whose type is
 *   `code.<enum>.${Uncapitalize<Union>}`. `TranslationKey` is derived from
 *   `en.json`, so a member with no dictionary entry is a type error in this file
 *   rather than an `undefined` on a screen.
 * - **In Rust, at test time.** `src-tauri/src/dictionary_contract.rs` reads the
 *   enum declarations out of the core's own source, applies the same formula,
 *   and compares the result against the `code.` keys of both dictionaries in
 *   both directions. A variant added in Rust with no key fails `cargo test`, and
 *   so does a key here that names no variant.
 *
 * The compile-time half only covers the enums the frontend has a type for. The
 * Rust-side half covers every enum, including the three the wire never carries
 * (`WorkspaceError`, `DiscoveryError`, `IdentityError`, whose conditions reach
 * the frontend flattened into `CommandError`).
 *
 * ## The six the review added
 *
 * `ScalarStyle`, `LineEnding`, `FileKind`, `TriggerKind`, `ContentKind` and
 * `VariableKind` cross the wire as fields of the read projection and had no
 * strings until Phase 1b-2b's review. They were deferred on the grounds that no
 * message interpolates them, which was the wrong test: a component meeting
 * `trigger.kind = "Single"` with no key can only render the raw Rust identifier
 * or invent a mapping nothing checks. A code with no string is worse than a code
 * with no caller.
 *
 * `describeScalarStyle` is a claim about **how the file spells a scalar** and
 * never about what it means, which is D2u seen from the dictionary: "Written
 * between single quotes" is a syntactic fact, and no key below resolves a
 * value.
 *
 * ## What is deliberately not interpolated
 *
 * An operand that is an English identifier with no dictionary of its own is not
 * put into a sentence: `IoError.kind` is a `std::io::ErrorKind` variant name,
 * `IdentityStaleRevisionError.expected` is a hex digest, and
 * `InvalidMenuLabelsError.missing` is a list of wire field names. All are in the
 * wire value the caller still holds, and all belong in a console rather than in
 * a message. The developer string of an unexpected failure is the same case and
 * is stated once more, loudly, on {@link describeIpcFailure}.
 */

import type { CommandError, IpcFailure } from '../ipc/errors';
import type {
  ContentKind,
  DiagnosticCode,
  DiagnosticCodeName,
  DocumentShape,
  FileKind,
  HazardKind,
  LineEnding,
  MatchBadge,
  ScalarStyle,
  TriggerKind,
  UnknownReason,
  UnknownReasonName,
  ValueKind,
  VariableKind
} from '../ipc/types';
import { diagnosticCodeName, diagnosticCodeOperands, unknownReasonName } from '../ipc/types';
import { DICTIONARIES, translate, type TranslationKey, type TranslationParams } from './dictionaries';
import type { Locale } from './locale';

/**
 * Lowercases the first character of a string, in the type as well as the value.
 *
 * The cast states what `Uncapitalize` already means; there is no way to write
 * this without one, and the alternative — a lookup table from every variant name
 * to every key — is the hand-maintained list this scheme exists to avoid.
 *
 * @param value - Any string.
 * @returns The same string with a lowercase first character.
 */
function uncapitalize<S extends string>(value: S): Uncapitalize<S> {
  return (value.charAt(0).toLowerCase() + value.slice(1)) as Uncapitalize<S>;
} // End of function uncapitalize()

/**
 * The dictionary key for one diagnostic code.
 *
 * @param name - The variant name of a `DiagnosticCode`.
 * @returns The key holding that code's message.
 */
export function diagnosticCodeKey(name: DiagnosticCodeName): TranslationKey {
  return `code.diagnosticCode.${uncapitalize(name)}`;
} // End of function diagnosticCodeKey()

/**
 * The dictionary key for one reason an entry was not modelled.
 *
 * @param name - The variant name of an `UnknownReason`.
 * @returns The key holding that reason's message.
 */
export function unknownReasonKey(name: UnknownReasonName): TranslationKey {
  return `code.unknownReason.${uncapitalize(name)}`;
} // End of function unknownReasonKey()

/**
 * The dictionary key for one editing hazard.
 *
 * @param kind - A `HazardKind` as it crossed the boundary.
 * @returns The key holding that hazard's noun phrase.
 */
export function hazardKindKey(kind: HazardKind): TranslationKey {
  return `code.hazardKind.${uncapitalize(kind)}`;
} // End of function hazardKindKey()

/**
 * The dictionary key for one value shape.
 *
 * @param kind - A `ValueKind` as it crossed the boundary.
 * @returns The key holding that shape's noun phrase.
 */
export function valueKindKey(kind: ValueKind): TranslationKey {
  return `code.valueKind.${uncapitalize(kind)}`;
} // End of function valueKindKey()

/**
 * The dictionary key for one document shape.
 *
 * @param shape - A `DocumentShape` as it crossed the boundary.
 * @returns The key holding that shape's noun phrase.
 */
export function documentShapeKey(shape: DocumentShape): TranslationKey {
  return `code.documentShape.${uncapitalize(shape)}`;
} // End of function documentShapeKey()

/**
 * The dictionary key for one snippet-list badge.
 *
 * @param badge - A `MatchBadge` as it crossed the boundary.
 * @returns The key holding that badge's label.
 */
export function matchBadgeKey(badge: MatchBadge): TranslationKey {
  return `code.matchBadge.${uncapitalize(badge)}`;
} // End of function matchBadgeKey()

/**
 * The dictionary key for one scalar's written style.
 *
 * **A claim about the source text, never about a value (D2u).** "Written
 * between single quotes" says how the file spells the scalar; it says nothing
 * about what YAML 1.1 would resolve it to.
 *
 * @param style - A `ScalarStyle` as it crossed the boundary.
 * @returns The key holding that style's phrase.
 */
export function scalarStyleKey(style: ScalarStyle): TranslationKey {
  return `code.scalarStyle.${uncapitalize(style)}`;
} // End of function scalarStyleKey()

/**
 * The dictionary key for one document's line terminator.
 *
 * @param ending - A `LineEnding` as it crossed the boundary.
 * @returns The key holding that terminator's phrase.
 */
export function lineEndingKey(ending: LineEnding): TranslationKey {
  return `code.lineEnding.${uncapitalize(ending)}`;
} // End of function lineEndingKey()

/**
 * The dictionary key for what espanso treats a file as.
 *
 * @param kind - A `FileKind` as it crossed the boundary.
 * @returns The key holding that kind's noun phrase.
 */
export function fileKindKey(kind: FileKind): TranslationKey {
  return `code.fileKind.${uncapitalize(kind)}`;
} // End of function fileKindKey()

/**
 * The dictionary key for which trigger form a match uses.
 *
 * @param kind - A `TriggerKind` as it crossed the boundary.
 * @returns The key holding that form's noun phrase.
 */
export function triggerKindKey(kind: TriggerKind): TranslationKey {
  return `code.triggerKind.${uncapitalize(kind)}`;
} // End of function triggerKindKey()

/**
 * The dictionary key for which content form a match uses.
 *
 * @param kind - A `ContentKind` as it crossed the boundary.
 * @returns The key holding that form's noun phrase.
 */
export function contentKindKey(kind: ContentKind): TranslationKey {
  return `code.contentKind.${uncapitalize(kind)}`;
} // End of function contentKindKey()

/**
 * The dictionary key for which of espanso's variable types a `type` field names.
 *
 * @param kind - A `VariableKind` as it crossed the boundary.
 * @returns The key holding that type's noun phrase.
 */
export function variableKindKey(kind: VariableKind): TranslationKey {
  return `code.variableKind.${uncapitalize(kind)}`;
} // End of function variableKindKey()

/**
 * The dictionary key for one command error.
 *
 * The wire codes of `CommandError` are already written with a lowercase first
 * letter — `noWorkspaceOpen`, not `NoWorkspaceOpen` — so this builder appends
 * the code unchanged. `dictionary_contract.rs` asserts that the two spellings
 * really do coincide, rather than leaving it as a coincidence a rename could
 * break.
 *
 * @param error - A command error as it crossed the boundary.
 * @returns The key holding that error's message.
 */
export function commandErrorKey(error: CommandError): TranslationKey {
  return `code.commandError.${error.code}`;
} // End of function commandErrorKey()

/**
 * Operand names whose value is itself an enum with its own dictionary.
 *
 * The only three that occur: `found` is a `ValueKind`, `shape` is a
 * `DocumentShape` and `kind` is a `HazardKind`. Without this table a diagnostic
 * would interpolate the raw Rust variant name — `Sequence`, `MergeKey` — into a
 * Spanish sentence, which is a hardcoded English string arriving by the back
 * door (CLAUDE.md section 2).
 *
 * Scoped to the diagnostic and unknown-reason dictionaries deliberately:
 * `CommandError::Io` also has an operand called `kind`, and that one is a
 * `std::io::ErrorKind` name with no dictionary, so it must not be looked up
 * here.
 */
const ENUM_OPERAND_NAMESPACES: Readonly<Record<string, string>> = {
  found: 'valueKind',
  shape: 'documentShape',
  kind: 'hazardKind'
};

/**
 * The key for one member of an enum namespace, when the dictionary has one.
 *
 * The untyped twin of the builders above, for a value that arrived as JSON and
 * therefore has no literal type. It applies the same formula and then checks the
 * result against the dictionary, so a member this build does not know renders as
 * its own name rather than as `undefined`.
 *
 * @param namespace - The `code.<namespace>` the member belongs to.
 * @param member - The Rust variant name.
 * @returns The key, or `null` when no such key exists.
 */
function memberKey(namespace: string, member: string): TranslationKey | null {
  const candidate = `code.${namespace}.${member.charAt(0).toLowerCase()}${member.slice(1)}`;
  return Object.prototype.hasOwnProperty.call(DICTIONARIES.en, candidate)
    ? (candidate as TranslationKey)
    : null;
} // End of function memberKey()

/**
 * Translates the operands of a diagnostic that are themselves codes.
 *
 * Values that are not enum members pass through unchanged: `key` is a key the
 * file supplied, `count` and `depth` are numbers, and neither is prose this
 * project wrote. A `null` operand is dropped, because a placeholder left
 * unsubstituted stays visible in the output and that is more honest than the
 * word "null" in a sentence.
 *
 * @param locale - The dictionary to read from.
 * @param operands - The operand object as it crossed the boundary.
 * @returns Substitutions for the message's `{placeholder}` tokens.
 */
function localizedOperands(
  locale: Locale,
  operands: Readonly<Record<string, unknown>>
): TranslationParams {
  const params: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(operands)) {
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === 'number') {
      params[name] = value;
      continue;
    }
    const namespace = typeof value === 'string' ? ENUM_OPERAND_NAMESPACES[name] : undefined;
    const key = namespace === undefined ? null : memberKey(namespace, value as string);
    params[name] = key === null ? String(value) : translate(locale, key);
  } // End of the loop over the operands
  return params;
} // End of function localizedOperands()

/**
 * The sentence one diagnostic reads as.
 *
 * @param locale - The dictionary to read from.
 * @param code - A diagnostic code as it crossed the boundary.
 * @returns The translated message, with its operands substituted.
 */
export function describeDiagnostic(locale: Locale, code: DiagnosticCode): string {
  const key = diagnosticCodeKey(diagnosticCodeName(code));
  const operands = diagnosticCodeOperands(code);
  return translate(locale, key, operands === null ? undefined : localizedOperands(locale, operands));
} // End of function describeDiagnostic()

/**
 * The sentence one unmodelled-entry reason reads as.
 *
 * @param locale - The dictionary to read from.
 * @param reason - An unknown reason as it crossed the boundary.
 * @returns The translated message, with its operands substituted.
 */
export function describeUnknownReason(locale: Locale, reason: UnknownReason): string {
  const key = unknownReasonKey(unknownReasonName(reason));
  if (typeof reason === 'string') {
    return translate(locale, key);
  }
  return translate(locale, key, localizedOperands(locale, reason.UnexpectedShape));
} // End of function describeUnknownReason()

/**
 * The label one snippet-list badge reads as.
 *
 * @param locale - The dictionary to read from.
 * @param badge - A badge as it crossed the boundary.
 * @returns The translated label.
 */
export function describeMatchBadge(locale: Locale, badge: MatchBadge): string {
  return translate(locale, matchBadgeKey(badge));
} // End of function describeMatchBadge()

/**
 * The noun phrase one editing hazard reads as.
 *
 * A phrase rather than a sentence, because a hazard is named inside other
 * messages as often as it is shown on its own.
 *
 * @param locale - The dictionary to read from.
 * @param kind - A hazard as it crossed the boundary.
 * @returns The translated phrase.
 */
export function describeHazard(locale: Locale, kind: HazardKind): string {
  return translate(locale, hazardKindKey(kind));
} // End of function describeHazard()

/**
 * The phrase one scalar's written style reads as.
 *
 * @param locale - The dictionary to read from.
 * @param style - A style as it crossed the boundary.
 * @returns The translated phrase.
 */
export function describeScalarStyle(locale: Locale, style: ScalarStyle): string {
  return translate(locale, scalarStyleKey(style));
} // End of function describeScalarStyle()

/**
 * The phrase one document's line terminator reads as.
 *
 * @param locale - The dictionary to read from.
 * @param ending - A line ending as it crossed the boundary.
 * @returns The translated phrase.
 */
export function describeLineEnding(locale: Locale, ending: LineEnding): string {
  return translate(locale, lineEndingKey(ending));
} // End of function describeLineEnding()

/**
 * The noun phrase one file kind reads as.
 *
 * @param locale - The dictionary to read from.
 * @param kind - A file kind as it crossed the boundary.
 * @returns The translated phrase.
 */
export function describeFileKind(locale: Locale, kind: FileKind): string {
  return translate(locale, fileKindKey(kind));
} // End of function describeFileKind()

/**
 * The noun phrase one trigger form reads as.
 *
 * @param locale - The dictionary to read from.
 * @param kind - A trigger kind as it crossed the boundary.
 * @returns The translated phrase.
 */
export function describeTriggerKind(locale: Locale, kind: TriggerKind): string {
  return translate(locale, triggerKindKey(kind));
} // End of function describeTriggerKind()

/**
 * The noun phrase one content form reads as.
 *
 * @param locale - The dictionary to read from.
 * @param kind - A content kind as it crossed the boundary.
 * @returns The translated phrase.
 */
export function describeContentKind(locale: Locale, kind: ContentKind): string {
  return translate(locale, contentKindKey(kind));
} // End of function describeContentKind()

/**
 * The noun phrase one variable type reads as.
 *
 * @param locale - The dictionary to read from.
 * @param kind - A variable kind as it crossed the boundary.
 * @returns The translated phrase.
 */
export function describeVariableKind(locale: Locale, kind: VariableKind): string {
  return translate(locale, variableKindKey(kind));
} // End of function describeVariableKind()

/**
 * The sentence one command error reads as.
 *
 * Only the operands the message names are substituted, and the message names
 * only the operands that mean something to a person: a path and a byte offset,
 * never an `ErrorKind` name, a document identifier or a content revision.
 *
 * @param locale - The dictionary to read from.
 * @param error - A command error as it crossed the boundary.
 * @returns The translated message.
 */
export function describeCommandError(locale: Locale, error: CommandError): string {
  const params: Record<string, string | number> = {};
  if ('path' in error) {
    params.path = error.path;
  }
  if ('offset' in error) {
    params.offset = error.offset;
  }
  return translate(locale, commandErrorKey(error), params);
} // End of function describeCommandError()

/**
 * The sentence any failed command reads as.
 *
 * **The developer string of an unexpected failure is never read here, and there
 * is nothing on the value to read it from.** It is Tauri's own English, a thrown
 * `Error`'s message, or `JSON.stringify` of a value nobody designed, so the
 * unexpected arm gets one generic key instead. That is not a convention this
 * comment asks for: the string is not a property of `IpcFailure` at all — it
 * lives behind a non-enumerable symbol in `src/lib/ipc/errors.ts`, `errors.test.ts`
 * fails if it becomes enumerable again, `scripts/lint/ipc-detail.ts` fails the
 * build if any module outside the two that declare and test the accessor names
 * it, and a test in `codes.test.ts` fails if such a string ever appears in this
 * function's output.
 *
 * @param locale - The dictionary to read from.
 * @param failure - A classified IPC failure.
 * @returns The translated message.
 */
export function describeIpcFailure(locale: Locale, failure: IpcFailure): string {
  if (failure.kind === 'command') {
    return describeCommandError(locale, failure.error);
  }
  return translate(locale, 'ipc.unexpectedFailure');
} // End of function describeIpcFailure()
