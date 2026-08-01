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
  BackupError,
  BackupErrorName,
  BackupStep,
  ContentKind,
  DecodeError,
  DecodeErrorName,
  DiagnosticCode,
  DiagnosticCodeName,
  DocumentShape,
  EditError,
  EditErrorName,
  FileKind,
  FindingClass,
  FindingCode,
  FindingCodeName,
  HazardKind,
  InvariantViolation,
  InvariantViolationName,
  LineEnding,
  MatchBadge,
  MoveSeam,
  NodeKind,
  PathError,
  PathErrorName,
  RotationOutcome,
  SaveError,
  SaveErrorName,
  SaveVerdict,
  ScalarStyle,
  SyntaxError,
  SyntaxErrorName,
  TargetDifference,
  TargetDifferenceName,
  TriggerKind,
  UnknownReason,
  UnknownReasonName,
  ValueKind,
  VariableKind,
  VerificationFailure,
  VerificationFailureName,
  WriteError,
  WriteErrorName,
  WriteStep
} from '../ipc/types';
import {
  diagnosticCodeName,
  diagnosticCodeOperands,
  unknownReasonName,
  wireVariantName,
  wireVariantOperands
} from '../ipc/types';
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
 * Wire operands that are **zero-based indices**, and the name each displays
 * under — **per diagnostic variant, and exhaustively**.
 *
 * `DiagnosticCode::EmptyDocument` and `AdditionalDocumentNotProjected` carry a
 * `document_index` counted from 0, because it indexes
 * `SyntaxIndex::documents()`. A person counting the documents in a file starts
 * at one, so rendering the wire number produced *"Document 0 of this file has no
 * content"* for the first document and called the second one "document 1" — a
 * sentence that is not wrong so much as about a different numbering than the
 * reader's.
 *
 * The conversion happens **here and not in Rust**: the index is an offset into a
 * data structure everywhere else it is used (the patch engine addresses
 * documents by it), so making it one-based on the wire would corrupt an
 * identifier to improve a sentence. It is one-based only at the moment it
 * becomes prose.
 *
 * The operand is emitted under its **display** name and not under its wire name,
 * deliberately: a dictionary value still spelling `{document_index}` then leaves
 * an unsubstituted placeholder, which `translate` keeps visible and
 * `codes.test.ts` fails on. Emitting both names would let a stale sentence go on
 * quietly printing the zero-based number.
 *
 * ## Why a full table over every variant, and not a list of operand names
 *
 * The first version was keyed on the operand *spelling* alone — one entry,
 * `document_index` — so every number the table did not name passed through
 * unchanged. A future zero-based `match_index` would then have rendered `0`
 * with no missing placeholder and no failing test: silence, which is the one
 * outcome this project treats as worse than a loud wrong answer. The second
 * review pass named it, and the fix is the shape `COMMAND_ERROR_OPERANDS` in
 * `src/lib/ipc/errors.ts` already uses — **a row per variant, mapped over the
 * union**, so that a variant added to {@link DiagnosticCodeName} and forgotten
 * here is a `npm run check` failure in this file rather than a wrong number on
 * a screen. Most rows are empty, and an empty row is a statement: *this
 * variant's numbers are counts, not indices.*
 *
 * The mapped type touches nothing else. In particular it does not go near the
 * key builders above, whose template-literal return types are the guarantee
 * this file exists for.
 */
const DIAGNOSTIC_DISPLAY_INDICES: {
  readonly [K in DiagnosticCodeName]: Readonly<Record<string, string>>;
} = {
  ParseFailed: {},
  IndexRejected: {},
  NoDocument: {},
  // The two that carry one. Both index `SyntaxIndex::documents()`.
  EmptyDocument: { document_index: 'document' },
  AdditionalDocumentNotProjected: { document_index: 'document' },
  RootIsNotAMapping: {},
  FieldHasUnexpectedShape: {},
  RepeatedKey: {},
  NonScalarKey: {},
  ShapeDisagreesWithLocation: {},
  MatchHasNoTrigger: {},
  // `count` is how many, not which. A count is already one-based.
  MatchHasSeveralTriggerForms: {},
  MatchHasNoContent: {},
  MatchHasSeveralContentForms: {},
  MatchIsNotAMapping: {},
  VariableIsNotAMapping: {},
  VariableHasNoName: {},
  VariableHasNoType: {},
  ScalarNotDecodable: {},
  // `depth` is a number of levels, not a position in a list.
  ValueTooDeep: {},
  CoverageIsIncomplete: {},
  KeyNotAccountedFor: {},
  Hazard: {}
};

/** No operand of this message is a zero-based index. */
const NO_DISPLAY_INDICES: Readonly<Record<string, string>> = {};

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
 * @param displayIndices - Which of this variant's numeric operands are
 *   zero-based indices, and the name each displays under. Defaults to none,
 *   which is the right answer for every message that is not a diagnostic.
 * @returns Substitutions for the message's `{placeholder}` tokens.
 */
function localizedOperands(
  locale: Locale,
  operands: Readonly<Record<string, unknown>>,
  displayIndices: Readonly<Record<string, string>> = NO_DISPLAY_INDICES
): TranslationParams {
  const params: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(operands)) {
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === 'number') {
      const displayName = displayIndices[name];
      if (displayName === undefined) {
        params[name] = value;
      } else {
        params[displayName] = value + 1;
      }
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
  const name = diagnosticCodeName(code);
  const key = diagnosticCodeKey(name);
  const operands = diagnosticCodeOperands(code);
  if (operands === null) {
    return translate(locale, key);
  }
  return translate(locale, key, localizedOperands(locale, operands, DIAGNOSTIC_DISPLAY_INDICES[name]));
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
 * The noun phrase one value shape reads as.
 *
 * A claim about the *shape* of a node — "a list", "a set of keys" — and never
 * about what it resolves to. The detail pane needs it for a node the projection
 * stopped at: the node exists, and saying which kind of node it is is the whole
 * difference between "the projection stopped here" and rendering nothing.
 *
 * @param locale - The dictionary to read from.
 * @param kind - A value kind as it crossed the boundary.
 * @returns The translated phrase.
 */
export function describeValueKind(locale: Locale, kind: ValueKind): string {
  return translate(locale, valueKindKey(kind));
} // End of function describeValueKind()

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

// ---------------------------------------------------------------------------
// The save transaction — Phase 2b-1
// ---------------------------------------------------------------------------

/**
 * The operands of a save-transaction code, filtered down to what a sentence can
 * hold.
 *
 * **Strings and numbers only**, and everything else is dropped. Three kinds of
 * value are deliberately not carried into a message:
 *
 * - **a nested wire value.** `SaveError.Patch` carries a whole `EditError`, which
 *   has a message of its own; interpolating `[object Object]` is the failure this
 *   filter exists to prevent;
 * - **a `null` operand.** A placeholder left unsubstituted stays visible in the
 *   output, which is more honest than the word "null" in a sentence — the rule
 *   {@link localizedOperands} already follows;
 * - **an enum-valued operand.** These are *not* translated here, unlike the three
 *   the diagnostics table names, and that is a decision rather than an omission:
 *   `kind` means a `NodeKind` in `EditError.NotAScalar`, a `VariableKind` in
 *   `FindingCode.VariableMissingRequiredParam` and a `std::io::ErrorKind` name in
 *   `WriteError.Io`, so one operand-name-to-namespace table would have to be
 *   wrong about two of the three. No message written for these codes names such
 *   an operand; the value is in the wire object the caller still holds.
 *
 * @param operands - The operand object as it crossed the boundary, or `null`.
 * @returns Substitutions for the message's `{placeholder}` tokens.
 */
function scalarOperands(operands: Readonly<Record<string, unknown>> | null): TranslationParams {
  const params: Record<string, string | number> = {};
  if (operands === null) {
    return params;
  }
  for (const [name, value] of Object.entries(operands)) {
    if (typeof value === 'string' || typeof value === 'number') {
      params[name] = value;
    }
  } // End of the loop over the operands
  return params;
} // End of function scalarOperands()

/**
 * The dictionary key for one kind of YAML construct.
 *
 * @param kind - A `NodeKind` as it crossed the boundary.
 * @returns The key holding that construct's noun phrase.
 */
export function nodeKindKey(kind: NodeKind): TranslationKey {
  return `code.nodeKind.${uncapitalize(kind)}`;
} // End of function nodeKindKey()

/**
 * The dictionary key for one save verdict.
 *
 * @param verdict - A `SaveVerdict` as it crossed the boundary.
 * @returns The key holding that verdict's sentence.
 */
export function saveVerdictKey(verdict: SaveVerdict): TranslationKey {
  return `code.saveVerdict.${uncapitalize(verdict)}`;
} // End of function saveVerdictKey()

/**
 * The dictionary key for one class of finding.
 *
 * @param value - A `FindingClass` as it crossed the boundary.
 * @returns The key holding that class's phrase.
 */
export function findingClassKey(value: FindingClass): TranslationKey {
  return `code.findingClass.${uncapitalize(value)}`;
} // End of function findingClassKey()

/**
 * The dictionary key for one step of the atomic write.
 *
 * @param step - A `WriteStep` as it crossed the boundary.
 * @returns The key holding that step's noun phrase.
 */
export function writeStepKey(step: WriteStep): TranslationKey {
  return `code.writeStep.${uncapitalize(step)}`;
} // End of function writeStepKey()

/**
 * The dictionary key for one step of taking a backup.
 *
 * @param step - A `BackupStep` as it crossed the boundary.
 * @returns The key holding that step's noun phrase.
 */
export function backupStepKey(step: BackupStep): TranslationKey {
  return `code.backupStep.${uncapitalize(step)}`;
} // End of function backupStepKey()

/**
 * The dictionary key for how far the backup tidy-up got.
 *
 * @param outcome - A `RotationOutcome` as it crossed the boundary.
 * @returns The key holding that outcome's sentence.
 */
export function rotationOutcomeKey(outcome: RotationOutcome): TranslationKey {
  return `code.rotationOutcome.${uncapitalize(outcome)}`;
} // End of function rotationOutcomeKey()

/**
 * The dictionary key for one join a move creates.
 *
 * @param seam - A `MoveSeam` as it crossed the boundary.
 * @returns The key holding that seam's phrase.
 */
export function moveSeamKey(seam: MoveSeam): TranslationKey {
  return `code.moveSeam.${uncapitalize(seam)}`;
} // End of function moveSeamKey()

/**
 * The dictionary key for one semantic-gate finding.
 *
 * @param name - The variant name of a `FindingCode`.
 * @returns The key holding that finding's message.
 */
export function findingCodeKey(name: FindingCodeName): TranslationKey {
  return `code.findingCode.${uncapitalize(name)}`;
} // End of function findingCodeKey()

/**
 * The dictionary key for one reason a change was not applied.
 *
 * @param name - The variant name of an `EditError`.
 * @returns The key holding that reason's message.
 */
export function editErrorKey(name: EditErrorName): TranslationKey {
  return `code.editError.${uncapitalize(name)}`;
} // End of function editErrorKey()

/**
 * The dictionary key for one reason a candidate failed verification.
 *
 * @param name - The variant name of a `VerificationFailure`.
 * @returns The key holding that reason's message.
 */
export function verificationFailureKey(name: VerificationFailureName): TranslationKey {
  return `code.verificationFailure.${uncapitalize(name)}`;
} // End of function verificationFailureKey()

/**
 * The dictionary key for one reason a document could not be indexed.
 *
 * @param name - The variant name of a `SyntaxError`.
 * @returns The key holding that reason's message.
 */
export function syntaxErrorKey(name: SyntaxErrorName): TranslationKey {
  return `code.syntaxError.${uncapitalize(name)}`;
} // End of function syntaxErrorKey()

/**
 * The dictionary key for one broken invariant of the span index.
 *
 * @param name - The variant name of an `InvariantViolation`.
 * @returns The key holding that violation's message.
 */
export function invariantViolationKey(name: InvariantViolationName): TranslationKey {
  return `code.invariantViolation.${uncapitalize(name)}`;
} // End of function invariantViolationKey()

/**
 * The dictionary key for one reason an address did not resolve.
 *
 * @param name - The variant name of a `PathError`.
 * @returns The key holding that reason's message.
 */
export function pathErrorKey(name: PathErrorName): TranslationKey {
  return `code.pathError.${uncapitalize(name)}`;
} // End of function pathErrorKey()

/**
 * The dictionary key for one reason a scalar could not be decoded.
 *
 * @param name - The variant name of a `DecodeError`.
 * @returns The key holding that reason's message.
 */
export function decodeErrorKey(name: DecodeErrorName): TranslationKey {
  return `code.decodeError.${uncapitalize(name)}`;
} // End of function decodeErrorKey()

/**
 * The dictionary key for one way the save target differed from what was inspected.
 *
 * @param name - The variant name of a `TargetDifference`.
 * @returns The key holding that difference's sentence.
 */
export function targetDifferenceKey(name: TargetDifferenceName): TranslationKey {
  return `code.targetDifference.${uncapitalize(name)}`;
} // End of function targetDifferenceKey()

/**
 * The dictionary key for one failure of the atomic write.
 *
 * @param name - The variant name of a `WriteError`.
 * @returns The key holding that failure's message.
 */
export function writeErrorKey(name: WriteErrorName): TranslationKey {
  return `code.writeError.${uncapitalize(name)}`;
} // End of function writeErrorKey()

/**
 * The dictionary key for one failure of taking a backup.
 *
 * @param name - The variant name of a `BackupError`.
 * @returns The key holding that failure's message.
 */
export function backupErrorKey(name: BackupErrorName): TranslationKey {
  return `code.backupError.${uncapitalize(name)}`;
} // End of function backupErrorKey()

/**
 * The dictionary key for one reason a save did not commit.
 *
 * @param name - The variant name of a `SaveError`.
 * @returns The key holding that reason's message.
 */
export function saveErrorKey(name: SaveErrorName): TranslationKey {
  return `code.saveError.${uncapitalize(name)}`;
} // End of function saveErrorKey()

/**
 * The noun phrase one kind of YAML construct reads as.
 *
 * @param locale - The dictionary to read from.
 * @param kind - A node kind as it crossed the boundary.
 * @returns The translated phrase.
 */
export function describeNodeKind(locale: Locale, kind: NodeKind): string {
  return translate(locale, nodeKindKey(kind));
} // End of function describeNodeKind()

/**
 * The sentence one save verdict reads as.
 *
 * **Risk, not prophecy.** A refusal says this editor declined to write, never
 * that espanso would have rejected the file.
 *
 * @param locale - The dictionary to read from.
 * @param verdict - A save verdict as it crossed the boundary.
 * @returns The translated sentence.
 */
export function describeSaveVerdict(locale: Locale, verdict: SaveVerdict): string {
  return translate(locale, saveVerdictKey(verdict));
} // End of function describeSaveVerdict()

/**
 * The phrase one class of finding reads as.
 *
 * @param locale - The dictionary to read from.
 * @param value - A finding class as it crossed the boundary.
 * @returns The translated phrase.
 */
export function describeFindingClass(locale: Locale, value: FindingClass): string {
  return translate(locale, findingClassKey(value));
} // End of function describeFindingClass()

/**
 * The noun phrase one step of the atomic write reads as.
 *
 * @param locale - The dictionary to read from.
 * @param step - A write step as it crossed the boundary.
 * @returns The translated phrase.
 */
export function describeWriteStep(locale: Locale, step: WriteStep): string {
  return translate(locale, writeStepKey(step));
} // End of function describeWriteStep()

/**
 * The noun phrase one step of taking a backup reads as.
 *
 * @param locale - The dictionary to read from.
 * @param step - A backup step as it crossed the boundary.
 * @returns The translated phrase.
 */
export function describeBackupStep(locale: Locale, step: BackupStep): string {
  return translate(locale, backupStepKey(step));
} // End of function describeBackupStep()

/**
 * The sentence one backup tidy-up outcome reads as.
 *
 * **Tidiness, never safety.** An outcome other than `Scanned` says the backups
 * folder is not known to hold at most ten batches; it says nothing about whether
 * any file can be recovered, and no string here may.
 *
 * @param locale - The dictionary to read from.
 * @param outcome - A rotation outcome as it crossed the boundary.
 * @returns The translated sentence.
 */
export function describeRotationOutcome(locale: Locale, outcome: RotationOutcome): string {
  return translate(locale, rotationOutcomeKey(outcome));
} // End of function describeRotationOutcome()

/**
 * The phrase one join created by a move reads as.
 *
 * @param locale - The dictionary to read from.
 * @param seam - A move seam as it crossed the boundary.
 * @returns The translated phrase.
 */
export function describeMoveSeam(locale: Locale, seam: MoveSeam): string {
  return translate(locale, moveSeamKey(seam));
} // End of function describeMoveSeam()

/**
 * The sentence one semantic-gate finding reads as.
 *
 * @param locale - The dictionary to read from.
 * @param code - A finding code as it crossed the boundary.
 * @returns The translated message, with its operands substituted.
 */
export function describeFindingCode(locale: Locale, code: FindingCode): string {
  const key = findingCodeKey(wireVariantName<FindingCodeName>(code));
  return translate(locale, key, scalarOperands(wireVariantOperands(code)));
} // End of function describeFindingCode()

/**
 * The sentence one reason a change was not applied reads as.
 *
 * @param locale - The dictionary to read from.
 * @param error - An edit error as it crossed the boundary.
 * @returns The translated message, with its operands substituted.
 */
export function describeEditError(locale: Locale, error: EditError): string {
  const key = editErrorKey(wireVariantName<EditErrorName>(error));
  return translate(locale, key, scalarOperands(wireVariantOperands(error)));
} // End of function describeEditError()

/**
 * The sentence one verification failure reads as.
 *
 * @param locale - The dictionary to read from.
 * @param failure - A verification failure as it crossed the boundary.
 * @returns The translated message, with its operands substituted.
 */
export function describeVerificationFailure(
  locale: Locale,
  failure: VerificationFailure
): string {
  const key = verificationFailureKey(wireVariantName<VerificationFailureName>(failure));
  return translate(locale, key, scalarOperands(wireVariantOperands(failure)));
} // End of function describeVerificationFailure()

/**
 * The sentence one span-layer refusal reads as.
 *
 * @param locale - The dictionary to read from.
 * @param error - A syntax error as it crossed the boundary.
 * @returns The translated message.
 */
export function describeSyntaxError(locale: Locale, error: SyntaxError): string {
  return translate(locale, syntaxErrorKey(wireVariantName<SyntaxErrorName>(error)));
} // End of function describeSyntaxError()

/**
 * The sentence one broken index invariant reads as.
 *
 * @param locale - The dictionary to read from.
 * @param violation - An invariant violation as it crossed the boundary.
 * @returns The translated message, with its operands substituted.
 */
export function describeInvariantViolation(
  locale: Locale,
  violation: InvariantViolation
): string {
  const key = invariantViolationKey(wireVariantName<InvariantViolationName>(violation));
  return translate(locale, key, scalarOperands(wireVariantOperands(violation)));
} // End of function describeInvariantViolation()

/**
 * The sentence one unresolved address reads as.
 *
 * @param locale - The dictionary to read from.
 * @param error - A path error as it crossed the boundary.
 * @returns The translated message, with its operands substituted.
 */
export function describePathError(locale: Locale, error: PathError): string {
  const key = pathErrorKey(wireVariantName<PathErrorName>(error));
  return translate(locale, key, scalarOperands(wireVariantOperands(error)));
} // End of function describePathError()

/**
 * The sentence one undecodable scalar reads as.
 *
 * @param locale - The dictionary to read from.
 * @param error - A decode error as it crossed the boundary.
 * @returns The translated message, with its operands substituted.
 */
export function describeDecodeError(locale: Locale, error: DecodeError): string {
  const key = decodeErrorKey(wireVariantName<DecodeErrorName>(error));
  return translate(locale, key, scalarOperands(wireVariantOperands(error)));
} // End of function describeDecodeError()

/**
 * The sentence one difference in the save target reads as.
 *
 * @param locale - The dictionary to read from.
 * @param difference - A target difference as it crossed the boundary.
 * @returns The translated message, with its operands substituted.
 */
export function describeTargetDifference(
  locale: Locale,
  difference: TargetDifference
): string {
  const key = targetDifferenceKey(wireVariantName<TargetDifferenceName>(difference));
  return translate(locale, key, scalarOperands(wireVariantOperands(difference)));
} // End of function describeTargetDifference()

/**
 * The sentence one atomic-write failure reads as.
 *
 * The path is substituted and the `kind` is not: an `io::ErrorKind` name is an
 * English identifier with no dictionary of its own, and it belongs in a console
 * rather than in a message — the same rule `IoError.kind` already follows.
 *
 * @param locale - The dictionary to read from.
 * @param error - A write error as it crossed the boundary.
 * @returns The translated message, with its operands substituted.
 */
export function describeWriteError(locale: Locale, error: WriteError): string {
  const key = writeErrorKey(wireVariantName<WriteErrorName>(error));
  return translate(locale, key, scalarOperands(wireVariantOperands(error)));
} // End of function describeWriteError()

/**
 * The sentence one backup failure reads as.
 *
 * @param locale - The dictionary to read from.
 * @param error - A backup error as it crossed the boundary.
 * @returns The translated message, with its operands substituted.
 */
export function describeBackupError(locale: Locale, error: BackupError): string {
  const key = backupErrorKey(wireVariantName<BackupErrorName>(error));
  return translate(locale, key, scalarOperands(wireVariantOperands(error)));
} // End of function describeBackupError()

/**
 * The sentence one refused or failed save reads as.
 *
 * **One sentence per variant, and the nested error is not unwrapped here.**
 * `SaveError.Patch` carries a whole `EditError` and `SaveError.Write` a whole
 * `WriteError`; each has {@link describeEditError} and {@link describeWriteError}
 * of its own, and a caller that wants both sentences asks for both. Folding them
 * into one string here would decide, for every screen at once, how much detail a
 * user is shown.
 *
 * @param locale - The dictionary to read from.
 * @param error - A save error as it crossed the boundary.
 * @returns The translated message, with its operands substituted.
 */
export function describeSaveError(locale: Locale, error: SaveError): string {
  const key = saveErrorKey(wireVariantName<SaveErrorName>(error));
  return translate(locale, key, scalarOperands(wireVariantOperands(error)));
} // End of function describeSaveError()
