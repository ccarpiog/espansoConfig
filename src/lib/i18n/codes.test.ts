/**
 * Runtime checks on the Rust-code dictionaries and the accessors over them.
 *
 * The compile-time half is in `codes.ts` itself: every key builder returns a
 * `TranslationKey`, and its body is a template literal type, so a member with no
 * dictionary entry fails `svelte-check`. The Rust-side half is
 * `src-tauri/src/dictionary_contract.rs`, which reads the enum declarations out
 * of the core's own source and compares them against both dictionaries in both
 * directions.
 *
 * What is left for this file is what neither of those can see: that the
 * accessors render a sentence rather than the string `undefined` or an
 * unsubstituted `{placeholder}`, that an enum-valued operand is *translated*
 * instead of being interpolated as its raw Rust variant name, and that the
 * developer string of an unexpected failure never reaches the output.
 *
 * The sample tables below are written out by hand rather than derived from
 * `en.json`. A list read out of the dictionary would agree with the dictionary
 * by construction and could not fail.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers in this file do.
 */

import { describe, expect, it } from 'vitest';
import en from './en.json';
import {
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
import { translate, type TranslationKey } from './dictionaries';
import { LOCALES } from './locale';
import { COMMAND_ERROR_CODES, classifyFailure } from '../ipc/errors';
import type { CommandError, CommandErrorCode } from '../ipc/errors';
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

/**
 * Compile-time proof that a hand-written table names every member of a union.
 *
 * **The R24 corollary applied to a sample table.** Every list below is written
 * by hand on purpose — a list read out of `en.json` would agree with `en.json`
 * by construction — but a hand-written list can also be *short*, and a test
 * named "renders every badge" that iterates nine of ten badges is a test whose
 * body cannot fail if its name is false. That is exactly the shape Phase
 * 1b-2b's review found in `COMMAND_ERRORS`.
 *
 * `Missing<U, L>` is the union members `L` omits. `ExpectNever<T extends never>`
 * accepts it only when it is empty, so a member added to a wire union and not to
 * the table below is a **`npm run check` failure naming the member**, in this
 * file, before any test runs.
 */
type Missing<Union extends string, Listed extends readonly string[]> = Exclude<
  Union,
  Listed[number]
>;

/** Accepts only `never`; see {@link Missing}. */
type ExpectNever<T extends never> = T;

/** Every `DiagnosticCode` variant name, in declaration order. */
const DIAGNOSTIC_CODE_NAMES = [
  'ParseFailed',
  'IndexRejected',
  'NoDocument',
  'EmptyDocument',
  'AdditionalDocumentNotProjected',
  'RootIsNotAMapping',
  'FieldHasUnexpectedShape',
  'RepeatedKey',
  'NonScalarKey',
  'ShapeDisagreesWithLocation',
  'MatchHasNoTrigger',
  'MatchHasSeveralTriggerForms',
  'MatchHasNoContent',
  'MatchHasSeveralContentForms',
  'MatchIsNotAMapping',
  'VariableIsNotAMapping',
  'VariableHasNoName',
  'VariableHasNoType',
  'ScalarNotDecodable',
  'ValueTooDeep',
  'CoverageIsIncomplete',
  'KeyNotAccountedFor',
  'Hazard'
] as const satisfies readonly DiagnosticCodeName[];

/**
 * One value of every `DiagnosticCode` variant, as it crosses the wire.
 *
 * The frontend twin of `diagnostic_code_samples()` in
 * `src-tauri/src/wire_contract.rs`, and it is checked against
 * {@link DIAGNOSTIC_CODE_NAMES} below so the two cannot fall out of step.
 */
const DIAGNOSTIC_CODES: readonly DiagnosticCode[] = [
  { ParseFailed: { line: 1, column: 2, byte_index: 3 } },
  'IndexRejected',
  'NoDocument',
  { EmptyDocument: { document_index: 0 } },
  { AdditionalDocumentNotProjected: { document_index: 1 } },
  { RootIsNotAMapping: { found: 'Sequence' } },
  { FieldHasUnexpectedShape: { key: 'trigger', found: 'Sequence' } },
  { RepeatedKey: { key: 'trigger' } },
  'NonScalarKey',
  { ShapeDisagreesWithLocation: { shape: 'MatchFile' } },
  'MatchHasNoTrigger',
  { MatchHasSeveralTriggerForms: { count: 2 } },
  'MatchHasNoContent',
  { MatchHasSeveralContentForms: { count: 2 } },
  { MatchIsNotAMapping: { found: 'Scalar' } },
  { VariableIsNotAMapping: { found: 'Scalar' } },
  'VariableHasNoName',
  'VariableHasNoType',
  'ScalarNotDecodable',
  { ValueTooDeep: { depth: 64 } },
  'CoverageIsIncomplete',
  'KeyNotAccountedFor',
  { Hazard: { kind: 'MergeKey' } }
];

/** Every `UnknownReason` variant name. */
const UNKNOWN_REASON_NAMES = [
  'NotModelled',
  'UnexpectedShape',
  'RepeatedKey',
  'NonScalarKey'
] as const satisfies readonly UnknownReasonName[];

/** One value of every `UnknownReason` variant. */
const UNKNOWN_REASONS: readonly UnknownReason[] = [
  'NotModelled',
  { UnexpectedShape: { found: 'Sequence' } },
  'RepeatedKey',
  'NonScalarKey'
];

/** Every `HazardKind` variant. */
const HAZARD_KINDS = [
  'CommentInFlowCollection',
  'ExplicitKeyMapping',
  'TruncatedBlockScalarHeader',
  'UnclassifiedTrivia',
  'AnchorDefinition',
  'AliasReference',
  'MergeKey',
  'DuplicateMappingKey',
  'ExplicitTag',
  'MultiDocumentStream'
] as const satisfies readonly HazardKind[];

/** Every `ValueKind` variant. */
const VALUE_KINDS = [
  'Scalar',
  'Sequence',
  'Mapping',
  'Alias',
  'Other'
] as const satisfies readonly ValueKind[];

/** Every `DocumentShape` variant. */
const DOCUMENT_SHAPES = [
  'MatchFile',
  'ConfigProfile',
  'Other'
] as const satisfies readonly DocumentShape[];

/** Every `MatchBadge` variant. */
const MATCH_BADGES = [
  'Regex',
  'MultipleTriggers',
  'Form',
  'Html',
  'Markdown',
  'Image',
  'Variables',
  'Shell',
  'Script',
  'NotEditable'
] as const satisfies readonly MatchBadge[];

/** Every `ScalarStyle` variant. */
const SCALAR_STYLES = [
  'Plain',
  'SingleQuoted',
  'DoubleQuoted',
  'Literal',
  'Folded'
] as const satisfies readonly ScalarStyle[];

/** Every `LineEnding` variant. */
const LINE_ENDINGS = ['Lf', 'Crlf'] as const satisfies readonly LineEnding[];

/** Every `FileKind` variant. */
const FILE_KINDS = [
  'MatchFile',
  'ConfigProfile',
  'Package'
] as const satisfies readonly FileKind[];

/** Every `TriggerKind` variant. */
const TRIGGER_KINDS = [
  'Single',
  'Multiple',
  'Regex',
  'Several',
  'Absent'
] as const satisfies readonly TriggerKind[];

/** Every `ContentKind` variant. */
const CONTENT_KINDS = [
  'Replace',
  'Markdown',
  'Html',
  'ImagePath',
  'Form',
  'Several',
  'Absent'
] as const satisfies readonly ContentKind[];

/** Every `VariableKind` variant. */
const VARIABLE_KINDS = [
  'Date',
  'Choice',
  'Random',
  'Clipboard',
  'Echo',
  'Shell',
  'Script',
  'Form',
  'Match',
  'Unrecognised',
  'Absent'
] as const satisfies readonly VariableKind[];

/**
 * One well-formed `CommandError` per code, with operands of the declared shape.
 *
 * Every operand value is synthetic and neutral: no path here is a real one
 * (CLAUDE.md section 1).
 *
 * **This table is what Phase 1b-2b's review found short.** It pinned nine
 * entries against a `CommandError` that had ten variants, so
 * `describeCommandError('menuUnavailable')` could have returned `''` and the
 * test named "render every command error" would have passed. It is now checked
 * against `COMMAND_ERROR_CODES` in both directions, at compile time by
 * {@link Missing} below and at run time by the case in "the sample tables".
 */
const COMMAND_ERRORS = [
  { code: 'noWorkspaceOpen' },
  { code: 'configDirNotFound', candidates: ['/nowhere/espanso'] },
  { code: 'notADirectory', path: '/nowhere/espanso.yml' },
  { code: 'io', path: '/nowhere/base.yml', kind: 'PermissionDenied' },
  { code: 'notUtf8', path: '/nowhere/base.yml', offset: 12 },
  { code: 'unknownDocument', document: 7 },
  { code: 'identityWrongDocument', expected: 1, found: 2 },
  { code: 'identityStaleRevision', expected: 'a'.repeat(64), found: 'b'.repeat(64) },
  { code: 'identityNoSuchMatch', node: 3 },
  { code: 'menuUnavailable' },
  { code: 'invalidMenuLabels', missing: ['quit'], unexpected: ['renamed_last_week'] },
  { code: 'menuBuildFailed' }
] as const satisfies readonly CommandError[];

// Each of the following is `never` when the table above it names every member of
// its union, and the member's own name when it does not. A member added to a
// wire union and forgotten here fails `npm run check` **in this file**, naming
// it — which is the only thing that keeps a table written by hand from silently
// covering less than its tests claim.
export type _DiagnosticCodesAreComplete = ExpectNever<
  Missing<DiagnosticCodeName, typeof DIAGNOSTIC_CODE_NAMES>
>;
export type _UnknownReasonsAreComplete = ExpectNever<
  Missing<UnknownReasonName, typeof UNKNOWN_REASON_NAMES>
>;
export type _HazardsAreComplete = ExpectNever<Missing<HazardKind, typeof HAZARD_KINDS>>;
export type _ValueKindsAreComplete = ExpectNever<Missing<ValueKind, typeof VALUE_KINDS>>;
export type _DocumentShapesAreComplete = ExpectNever<Missing<DocumentShape, typeof DOCUMENT_SHAPES>>;
export type _MatchBadgesAreComplete = ExpectNever<Missing<MatchBadge, typeof MATCH_BADGES>>;
export type _ScalarStylesAreComplete = ExpectNever<Missing<ScalarStyle, typeof SCALAR_STYLES>>;
export type _LineEndingsAreComplete = ExpectNever<Missing<LineEnding, typeof LINE_ENDINGS>>;
export type _FileKindsAreComplete = ExpectNever<Missing<FileKind, typeof FILE_KINDS>>;
export type _TriggerKindsAreComplete = ExpectNever<Missing<TriggerKind, typeof TRIGGER_KINDS>>;
export type _ContentKindsAreComplete = ExpectNever<Missing<ContentKind, typeof CONTENT_KINDS>>;
export type _VariableKindsAreComplete = ExpectNever<Missing<VariableKind, typeof VARIABLE_KINDS>>;
export type _CommandErrorsAreComplete = ExpectNever<
  Exclude<CommandErrorCode, (typeof COMMAND_ERRORS)[number]['code']>
>;

/**
 * Asserts that a builder's key really is a key of the English dictionary.
 *
 * The builders are typed, so a missing key is normally a compile error. This
 * catches what the types cannot: a key whose value is blank, and a build in
 * which the type was widened.
 *
 * @param key - The key a builder returned.
 */
function expectRenderable(key: TranslationKey): void {
  expect(Object.prototype.hasOwnProperty.call(en, key), key).toBe(true);
  for (const locale of LOCALES) {
    expect(translate(locale, key).trim(), `${locale}:${key}`).not.toBe('');
  }
} // End of function expectRenderable()

/**
 * The variant name of a diagnostic code as it crosses the wire.
 *
 * A bare string variant is its own name; a variant with operands is a one-key
 * object. Repeated here rather than imported so that the sample table is
 * checked against something other than the function it feeds.
 *
 * @param code - A diagnostic code.
 * @returns Its variant name.
 */
function nameOf(code: DiagnosticCode): string {
  return typeof code === 'string' ? code : Object.keys(code)[0]!;
} // End of function nameOf()

describe('the sample tables', () => {
  it('hold one diagnostic code per declared name, in the same order', () => {
    expect(DIAGNOSTIC_CODES.map(nameOf)).toEqual([...DIAGNOSTIC_CODE_NAMES]);
  });

  it('hold the variant counts this phase measured', () => {
    expect({
      diagnosticCodes: DIAGNOSTIC_CODE_NAMES.length,
      unknownReasons: UNKNOWN_REASON_NAMES.length,
      hazardKinds: HAZARD_KINDS.length,
      valueKinds: VALUE_KINDS.length,
      documentShapes: DOCUMENT_SHAPES.length,
      matchBadges: MATCH_BADGES.length,
      commandErrors: COMMAND_ERRORS.length,
      scalarStyles: SCALAR_STYLES.length,
      lineEndings: LINE_ENDINGS.length,
      fileKinds: FILE_KINDS.length,
      triggerKinds: TRIGGER_KINDS.length,
      contentKinds: CONTENT_KINDS.length,
      variableKinds: VARIABLE_KINDS.length
    }).toEqual({
      diagnosticCodes: 23,
      unknownReasons: 4,
      hazardKinds: 10,
      valueKinds: 5,
      documentShapes: 3,
      matchBadges: 10,
      commandErrors: 12,
      scalarStyles: 5,
      lineEndings: 2,
      fileKinds: 3,
      triggerKinds: 5,
      contentKinds: 7,
      variableKinds: 11
    });
  }); // End of the "variant counts" case

  it('cover exactly the command error codes, in both directions', () => {
    // **The review's seventh finding.** A count alone cannot say a table is the
    // right table: nine entries against nine expected passes whichever nine
    // they are. This compares the *sets*, so a code added to
    // `COMMAND_ERROR_CODES` and not here fails, and a sample here for a code
    // Rust cannot produce fails too.
    const sampled = COMMAND_ERRORS.map((error) => error.code).sort();
    expect(sampled).toEqual([...COMMAND_ERROR_CODES].sort());
    expect(new Set(sampled).size).toBe(COMMAND_ERRORS.length);
  }); // End of the "command error codes" case
}); // End of the "sample tables" suite

describe('the key builders', () => {
  it('name a real dictionary entry for every diagnostic code', () => {
    for (const name of DIAGNOSTIC_CODE_NAMES) {
      expectRenderable(diagnosticCodeKey(name));
    }
  });

  it('name a real dictionary entry for every unknown reason', () => {
    for (const name of UNKNOWN_REASON_NAMES) {
      expectRenderable(unknownReasonKey(name));
    }
  });

  it('name a real dictionary entry for every hazard, value kind and document shape', () => {
    for (const kind of HAZARD_KINDS) {
      expectRenderable(hazardKindKey(kind));
    }
    for (const kind of VALUE_KINDS) {
      expectRenderable(valueKindKey(kind));
    }
    for (const shape of DOCUMENT_SHAPES) {
      expectRenderable(documentShapeKey(shape));
    }
  }); // End of the "hazard, value kind and document shape" case

  it('name a real dictionary entry for every badge', () => {
    for (const badge of MATCH_BADGES) {
      expectRenderable(matchBadgeKey(badge));
    }
  });

  it('name a real dictionary entry for every read-model display field', () => {
    // The six enumerations Phase 1b-2b deferred and its review reinstated.
    // Every one of them already crosses the wire as a field of the projection,
    // so a 1c component can meet any member of any of them.
    for (const style of SCALAR_STYLES) {
      expectRenderable(scalarStyleKey(style));
    }
    for (const ending of LINE_ENDINGS) {
      expectRenderable(lineEndingKey(ending));
    }
    for (const kind of FILE_KINDS) {
      expectRenderable(fileKindKey(kind));
    }
    for (const kind of TRIGGER_KINDS) {
      expectRenderable(triggerKindKey(kind));
    }
    for (const kind of CONTENT_KINDS) {
      expectRenderable(contentKindKey(kind));
    }
    for (const kind of VARIABLE_KINDS) {
      expectRenderable(variableKindKey(kind));
    }
  }); // End of the "read-model display field" case

  it('build a command-error key from the wire code, unchanged', () => {
    for (const error of COMMAND_ERRORS) {
      expect(commandErrorKey(error)).toBe(`code.commandError.${error.code}`);
      expectRenderable(commandErrorKey(error));
    }
  }); // End of the "command-error key" case
}); // End of the "key builders" suite

describe('the descriptions', () => {
  it.each(LOCALES)('render every diagnostic in %s with no gap left in the sentence', (locale) => {
    for (const code of DIAGNOSTIC_CODES) {
      const rendered = describeDiagnostic(locale, code);
      const label = `${locale}:${nameOf(code)}`;
      expect(rendered.trim(), label).not.toBe('');
      expect(rendered, label).not.toContain('undefined');
      // An unsubstituted `{placeholder}` is deliberately left visible by
      // `translate`, so its absence here is what says every operand the message
      // names was supplied.
      expect(rendered, label).not.toMatch(/\{[A-Za-z]/);
    }
  }); // End of the "every diagnostic" case

  it.each(LOCALES)('substitute a numeric diagnostic operand in %s', (locale) => {
    expect(describeDiagnostic(locale, { ValueTooDeep: { depth: 64 } })).toContain('64');
  });

  it.each(LOCALES)('translate an enum-valued operand rather than interpolate it in %s', (locale) => {
    const rendered = describeDiagnostic(locale, {
      FieldHasUnexpectedShape: { key: 'trigger', found: 'Sequence' }
    });
    // The key came from the file and is data; the value kind is a Rust variant
    // name, and interpolating it would put an English identifier into a Spanish
    // sentence (CLAUDE.md section 2).
    expect(rendered).toContain('trigger');
    expect(rendered).not.toContain('Sequence');
    expect(rendered).toContain(translate(locale, 'code.valueKind.sequence'));
  }); // End of the "enum-valued operand" case

  it.each(LOCALES)('translate the shape named by a location diagnostic in %s', (locale) => {
    const rendered = describeDiagnostic(locale, { ShapeDisagreesWithLocation: { shape: 'MatchFile' } });
    expect(rendered).not.toContain('MatchFile');
    expect(rendered).toContain(translate(locale, 'code.documentShape.matchFile'));
  }); // End of the "shape named by a location diagnostic" case

  it.each(LOCALES)('translate the hazard named by a Hazard diagnostic in %s', (locale) => {
    const rendered = describeDiagnostic(locale, { Hazard: { kind: 'MergeKey' } });
    expect(rendered).not.toContain('MergeKey');
    expect(rendered).toContain(describeHazard(locale, 'MergeKey'));
  }); // End of the "hazard named by a Hazard diagnostic" case

  it.each(LOCALES)('render every unknown reason in %s', (locale) => {
    for (const reason of UNKNOWN_REASONS) {
      const label = `${locale}:${typeof reason === 'string' ? reason : 'UnexpectedShape'}`;
      const rendered = describeUnknownReason(locale, reason);
      expect(rendered.trim(), label).not.toBe('');
      expect(rendered, label).not.toMatch(/\{[A-Za-z]/);
    }
    expect(describeUnknownReason(locale, { UnexpectedShape: { found: 'Sequence' } })).not.toContain(
      'Sequence'
    );
  }); // End of the "every unknown reason" case

  it.each(LOCALES)('render every value kind in %s, never as a Rust identifier', (locale) => {
    // The detail pane names one for a node the projection stopped at, which is
    // the difference between "this app stopped reading here: a list" and an
    // empty line the reader would read as "the file holds nothing".
    for (const kind of VALUE_KINDS) {
      const rendered = describeValueKind(locale, kind);
      expect(rendered.trim(), `${locale}:${kind}`).not.toBe('');
      expect(rendered, `${locale}:${kind}`).not.toContain(kind);
    }
  }); // End of the "every value kind" case

  it.each(LOCALES)('render every badge and every hazard in %s', (locale) => {
    for (const badge of MATCH_BADGES) {
      expect(describeMatchBadge(locale, badge).trim(), `${locale}:${badge}`).not.toBe('');
    }
    for (const kind of HAZARD_KINDS) {
      expect(describeHazard(locale, kind).trim(), `${locale}:${kind}`).not.toBe('');
    }
  }); // End of the "every badge and every hazard" case

  it.each(LOCALES)('render every command error in %s, path included', (locale) => {
    for (const error of COMMAND_ERRORS) {
      const rendered = describeCommandError(locale, error);
      const label = `${locale}:${error.code}`;
      expect(rendered.trim(), label).not.toBe('');
      expect(rendered, label).not.toMatch(/\{[A-Za-z]/);
      if ('path' in error) {
        expect(rendered, label).toContain(error.path);
      }
    }
  }); // End of the "every command error" case

  it.each(LOCALES)('render every read-model display field in %s', (locale) => {
    // The claim the review's first finding is about: a component that shows a
    // match's trigger kind must have a sentence for it, in both languages, and
    // must never fall back to the raw Rust identifier.
    const rendered: string[] = [
      ...SCALAR_STYLES.map((style) => describeScalarStyle(locale, style)),
      ...LINE_ENDINGS.map((ending) => describeLineEnding(locale, ending)),
      ...FILE_KINDS.map((kind) => describeFileKind(locale, kind)),
      ...TRIGGER_KINDS.map((kind) => describeTriggerKind(locale, kind)),
      ...CONTENT_KINDS.map((kind) => describeContentKind(locale, kind)),
      ...VARIABLE_KINDS.map((kind) => describeVariableKind(locale, kind))
    ];
    expect(rendered).toHaveLength(33);
    for (const text of rendered) {
      expect(text.trim(), locale).not.toBe('');
      expect(text, locale).not.toContain('undefined');
      expect(text, locale).not.toMatch(/\{[A-Za-z]/);
    }
  }); // End of the "read-model display field" rendering case

  it.each(LOCALES)('never render a variant name where a sentence belongs in %s', (locale) => {
    // The failure this closes is an English Rust identifier in a Spanish
    // sentence (CLAUDE.md section 2). `ImagePath` and `Unrecognised` are the
    // two most tempting to interpolate raw, so both are named.
    expect(describeContentKind(locale, 'ImagePath')).not.toContain('ImagePath');
    expect(describeVariableKind(locale, 'Unrecognised')).not.toContain('Unrecognised');
    expect(describeScalarStyle(locale, 'SingleQuoted')).not.toContain('SingleQuoted');
    expect(describeTriggerKind(locale, 'Multiple')).not.toContain('Multiple');
  }); // End of the "never render a variant name" case

  it.each(LOCALES)('leave an ErrorKind name and a revision digest out of the message in %s', (
    locale
  ) => {
    expect(
      describeCommandError(locale, { code: 'io', path: '/nowhere/base.yml', kind: 'PermissionDenied' })
    ).not.toContain('PermissionDenied');
    expect(
      describeCommandError(locale, {
        code: 'identityStaleRevision',
        expected: 'a'.repeat(64),
        found: 'b'.repeat(64)
      })
    ).not.toContain('aaaa');
  }); // End of the "ErrorKind name and revision digest" case
}); // End of the "descriptions" suite

describe('the unexpected-failure arm', () => {
  it.each(LOCALES)('renders the one generic key in %s', (locale) => {
    const failure = classifyFailure('Command get_match not allowed by ACL');
    expect(failure.kind).toBe('unexpected');
    expect(describeIpcFailure(locale, failure)).toBe(translate(locale, 'ipc.unexpectedFailure'));
  }); // End of the "one generic key" case

  it.each(LOCALES)('never renders the developer string it was handed, in %s', (locale) => {
    // The two rejections a real webview produces: Tauri's own English sentence,
    // and a thrown `Error`. Neither may reach the output. This is the runtime
    // half of the guard; `scripts/lint/ipc-detail.ts` is the structural half.
    const fromString = classifyFailure('Command get_match not allowed by ACL');
    const fromError = classifyFailure(new Error('the webview died'));
    expect(describeIpcFailure(locale, fromString)).not.toContain('ACL');
    expect(describeIpcFailure(locale, fromString)).not.toContain('get_match');
    expect(describeIpcFailure(locale, fromError)).not.toContain('webview');
  }); // End of the "never renders the developer string" case

  it.each(LOCALES)('still routes a real command error to its own message in %s', (locale) => {
    const failure = classifyFailure({ code: 'noWorkspaceOpen' });
    expect(failure.kind).toBe('command');
    expect(describeIpcFailure(locale, failure)).toBe(
      describeCommandError(locale, { code: 'noWorkspaceOpen' })
    );
  }); // End of the "routes a real command error" case
}); // End of the "unexpected-failure arm" suite
