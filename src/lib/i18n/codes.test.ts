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
  CODE_NAMESPACES_WITHOUT_A_BUILDER,
  CODE_NAMESPACE_KEY_BUILDERS,
  addedContentKey,
  changedContentKey,
  commandErrorKey,
  contentKindKey,
  describeAddedContent,
  describeChangedContent,
  describeCommandError,
  describeContentKind,
  describeDiagnostic,
  describeDuplicateSeam,
  describeExternalObservation,
  describeFileKind,
  describeHazard,
  describeIpcFailure,
  describeLineEnding,
  describeMatchBadge,
  describeScalarStyle,
  describeTriggerKind,
  describeUnknownReason,
  describeUnreadableReason,
  describeValueKind,
  describeVariableKind,
  diagnosticCodeKey,
  documentShapeKey,
  externalObservationKey,
  fileKindKey,
  hazardKindKey,
  lineEndingKey,
  matchBadgeKey,
  scalarStyleKey,
  triggerKindKey,
  unknownReasonKey,
  unreadableReasonKey,
  valueKindKey,
  variableKindKey
} from './codes';
import {
  tAddedContent,
  tChangedContent,
  tDuplicateSeam,
  tExternalObservation,
  tUnreadableReason
} from './index';
import { locale } from '../stores/locale.svelte';
import { translate, type TranslationKey } from './dictionaries';
import type { ExpectNever, Missing } from './exhaustive';
import { LOCALES, type Locale } from './locale';
import { COMMAND_ERROR_CODES, classifyFailure } from '../ipc/errors';
import type { CommandError, CommandErrorCode } from '../ipc/errors';
import type {
  AddedContent,
  AddedContentName,
  ChangedContent,
  ChangedContentName,
  ContentKind,
  DiagnosticCode,
  DiagnosticCodeName,
  DocumentShape,
  DocumentView,
  ExternalObservation,
  ExternalObservationName,
  FileKind,
  HazardKind,
  LineEnding,
  MatchBadge,
  ScalarStyle,
  TriggerKind,
  UnknownReason,
  UnknownReasonName,
  UnreadableReason,
  UnreadableReasonName,
  ValueKind,
  VariableKind
} from '../ipc/types';

// Every list below is written by hand on purpose — a list read out of `en.json`
// would agree with `en.json` by construction — and every one is pinned to its
// union by `Missing`/`ExpectNever` from `./exhaustive`, whose doc comment says
// why a hand-written table needs pinning at all.

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
  { code: 'menuBuildFailed' },
  { code: 'moveNotWithinOneSequence' },
  { code: 'duplicateSourceNotASequenceItem' },
  { code: 'documentHasNoMatchList', document: 4 },
  // The variant Rust's own `every_command_error()` samples, and for its reason:
  // it is one of the twelve that address something below the match mapping, and
  // `variable` is a position in the projected `vars` list, so the sample
  // exercises the privacy rule as well as the shape (CLAUDE.md section 1).
  { code: 'draftRefused', error: { AmbiguousVariableKey: { variable: 0 } } },
  {
    code: 'saveFailed',
    error: { DocumentIsReadOnly: { path: '/nowhere/packages/one.yml' } },
    may_have_written: false
  },
  // Phase 2c-5-2's four. The first two carry the caller's own strings, echoed
  // back for a console and interpolated into no sentence; the fourth carries a
  // whole `BackupReadError`, exactly as `saveFailed` carries a `SaveError`.
  { code: 'unrecognisedBackupBatch', batch: 'not-a-batch-name' },
  {
    code: 'unaddressableBackupEntry',
    batch: '2026-01-02T030405Z-0',
    relative_path: '../outside'
  },
  { code: 'backupEntryIsNotThisDocument', document: 9 },
  {
    code: 'backupReadFailed',
    error: {
      StaleEntry: {
        entry: {
          batch: { name: '2026-01-02T030405Z-0' },
          relative_path: 'match/base.yml'
        }
      }
    }
  }
] as const satisfies readonly CommandError[];

// ---------------------------------------------------------------------------
// The external-change reconciliation codes — Phase 2d-4b
// ---------------------------------------------------------------------------
//
// Four namespaces and fourteen sentences, whose keys Phase 2d-4a landed and
// whose accessors this phase adds. Every table below is written by hand for the
// R24 reason the header gives, and pinned to its `…Name` union, so a variant
// added in Rust and mirrored in `types.ts` is an `npm run check` failure here.
//
// `ObservedDocument` has **no** table because it has no namespace: it is an
// address rather than a code, and `dictionary_contract.rs` names it in
// `NOT_A_CODE` with that reason.

/** Every `ExternalObservation` variant name, in declaration order. */
const EXTERNAL_OBSERVATION_NAMES = [
  'Changed',
  'Added',
  'Removed',
  'Unreadable'
] as const satisfies readonly ExternalObservationName[];

/** Every `UnreadableReason` variant name, in declaration order. */
const UNREADABLE_REASON_NAMES = [
  'NotUtf8',
  'PermissionDenied',
  'InvalidData',
  'TimedOut',
  'Interrupted',
  'Other'
] as const satisfies readonly UnreadableReasonName[];

/** Every `AddedContent` variant name, in declaration order. */
const ADDED_CONTENT_NAMES = [
  'Projected',
  'Unreadable'
] as const satisfies readonly AddedContentName[];

/** Every `ChangedContent` variant name, in declaration order. */
const CHANGED_CONTENT_NAMES = [
  'Projected',
  'Unreadable'
] as const satisfies readonly ChangedContentName[];

/**
 * A projection stand-in, for the two content samples that carry one.
 *
 * A `DocumentView` is nearly a hundred lines of shape and none of it reaches a
 * sentence: no message in either dictionary names an operand of `Projected`, and
 * `scalarOperands` drops every object anyway. The cast is what keeps this file
 * about the *codes* rather than about re-declaring the read model, and it is
 * safe for exactly that reason — the value is never read.
 */
const A_PROJECTION = { id: 2 } as unknown as DocumentView;

/** One value of every `UnreadableReason` variant, as it crosses the wire. */
const UNREADABLE_REASONS: readonly UnreadableReason[] = [
  { NotUtf8: { offset: 12 } },
  { PermissionDenied: {} },
  { InvalidData: {} },
  { TimedOut: {} },
  { Interrupted: {} },
  { Other: {} }
];

/** One value of every `AddedContent` variant, as it crosses the wire. */
const ADDED_CONTENTS: readonly AddedContent[] = [
  { Projected: { disk: A_PROJECTION, findings: [] } },
  { Unreadable: { reason: { NotUtf8: { offset: 12 } } } }
];

/** One value of every `ChangedContent` variant, as it crosses the wire. */
const CHANGED_CONTENTS: readonly ChangedContent[] = [
  {
    Projected: {
      disk_text: 'matches: []\n',
      disk: A_PROJECTION,
      findings: [],
      correspondences: null
    }
  },
  { Unreadable: { reason: { NotUtf8: { offset: 12 } } } }
];

/** One value of every `ExternalObservation` variant, as it crosses the wire. */
const EXTERNAL_OBSERVATIONS: readonly ExternalObservation[] = [
  {
    Changed: {
      sequence: 4,
      document: { Addressable: { document: 2, relative_path: 'match/base.yml' } },
      previous_revision: 'a'.repeat(64),
      disk_revision: 'b'.repeat(64),
      content: { Unreadable: { reason: { NotUtf8: { offset: 12 } } } }
    }
  },
  {
    Added: {
      sequence: 5,
      document_summary: {
        id: 9,
        path: '/nowhere/match/new.yml',
        relative_path: 'match/new.yml',
        kind: 'MatchFile',
        disabled: false,
        read_only: false,
        loaded: false
      },
      content: { Unreadable: { reason: { NotUtf8: { offset: 12 } } } }
    }
  },
  {
    Removed: {
      sequence: 6,
      document: { Named: { document: 9, relative_path: 'match/new.yml' } },
      previous_revision: null
    }
  },
  {
    Unreadable: {
      sequence: 7,
      document: { Unnamed: { relative_path: 'match/stranger.yml' } },
      reason: { PermissionDenied: {} }
    }
  }
];

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
export type _ExternalObservationsAreComplete = ExpectNever<
  Missing<ExternalObservationName, typeof EXTERNAL_OBSERVATION_NAMES>
>;
export type _UnreadableReasonsAreComplete = ExpectNever<
  Missing<UnreadableReasonName, typeof UNREADABLE_REASON_NAMES>
>;
export type _AddedContentsAreComplete = ExpectNever<
  Missing<AddedContentName, typeof ADDED_CONTENT_NAMES>
>;
export type _ChangedContentsAreComplete = ExpectNever<
  Missing<ChangedContentName, typeof CHANGED_CONTENT_NAMES>
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
      variableKinds: VARIABLE_KINDS.length,
      externalObservations: EXTERNAL_OBSERVATION_NAMES.length,
      unreadableReasons: UNREADABLE_REASON_NAMES.length,
      addedContents: ADDED_CONTENT_NAMES.length,
      changedContents: CHANGED_CONTENT_NAMES.length
    }).toEqual({
      diagnosticCodes: 23,
      unknownReasons: 4,
      hazardKinds: 10,
      valueKinds: 5,
      documentShapes: 3,
      matchBadges: 10,
      commandErrors: 21,
      scalarStyles: 5,
      lineEndings: 2,
      fileKinds: 3,
      triggerKinds: 5,
      contentKinds: 7,
      variableKinds: 11,
      // Phase 2d-4a's four reconciliation namespaces, measured from the Rust
      // declarations in `src-tauri/src/reconciliation.rs`.
      externalObservations: 4,
      unreadableReasons: 6,
      addedContents: 2,
      changedContents: 2
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

  it.each(LOCALES)('count documents from one rather than from zero in %s', (locale) => {
    // `document_index` indexes `SyntaxIndex::documents()`, so it is zero-based
    // — and a person counting the documents in a file starts at one. Both
    // indices are tested because the defect was invisible at index 1: "document
    // 1" reads perfectly well while naming the *second* document.
    const first = describeDiagnostic(locale, { EmptyDocument: { document_index: 0 } });
    const second = describeDiagnostic(locale, {
      AdditionalDocumentNotProjected: { document_index: 1 }
    });
    expect(first).toContain('1');
    expect(first).not.toContain('0');
    expect(second).toContain('2');
  });

  it.each(LOCALES)('leave every other numeric operand exactly as the wire sends it in %s', (locale) => {
    // The conversion is per variant and per operand, not a rule about numbers.
    // A depth of 64 is a depth of 64 and a count of 2 is a count of 2.
    expect(describeDiagnostic(locale, { ValueTooDeep: { depth: 64 } })).not.toContain('65');
    expect(
      describeDiagnostic(locale, { MatchHasSeveralContentForms: { count: 2 } })
    ).toContain('2');
  });

  it.each(LOCALES)('render every diagnostic sample without a stray index in %s', (locale) => {
    /*
     * The second review pass's Low, from the other side. The display-index
     * table is a **mapped type over `DiagnosticCodeName`**, so a variant added
     * to the union and forgotten there is a compile error in `codes.ts` — but a
     * compile-time guarantee leaves no trace at run time, and a weakened
     * annotation would leave none either. This is the cheap runtime companion:
     * every sample renders, and no sample renders an operand the table would
     * have had to name. It is not a substitute for the type; it is a tripwire
     * for the type being taken away.
     */
    for (const code of DIAGNOSTIC_CODES) {
      const rendered = describeDiagnostic(locale, code);
      expect(rendered, `${locale}:${nameOf(code)}`).not.toMatch(/\{[A-Za-z]/);
    }
    // And the one pair the table does name, at the boundary value that made the
    // defect invisible: index 0 must never reach a sentence.
    expect(describeDiagnostic(locale, { EmptyDocument: { document_index: 0 } })).not.toContain('0');
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

describe('the reconciliation key builders', () => {
  it('name a real dictionary entry for every external observation', () => {
    for (const name of EXTERNAL_OBSERVATION_NAMES) {
      expectRenderable(externalObservationKey(name));
    }
  });

  it('name a real dictionary entry for every unreadable reason', () => {
    for (const name of UNREADABLE_REASON_NAMES) {
      expectRenderable(unreadableReasonKey(name));
    }
  });

  it('name a real dictionary entry for both content outcomes of both kinds', () => {
    // Two namespaces with the same two variant names, deliberately kept apart:
    // *this file is new to me* and *this file is one I had already read* are two
    // facts, so `code.addedContent.projected` and `code.changedContent.projected`
    // are two sentences and not one shared key.
    for (const name of ADDED_CONTENT_NAMES) {
      expectRenderable(addedContentKey(name));
    }
    for (const name of CHANGED_CONTENT_NAMES) {
      expectRenderable(changedContentKey(name));
    }
    expect(addedContentKey('Projected')).not.toBe(changedContentKey('Projected'));
  }); // End of the "both content outcomes" case

  it('hold one sample per declared name, in the same order', () => {
    const nameOfSample = (value: object): string => Object.keys(value)[0]!;
    expect(EXTERNAL_OBSERVATIONS.map(nameOfSample)).toEqual([...EXTERNAL_OBSERVATION_NAMES]);
    expect(UNREADABLE_REASONS.map(nameOfSample)).toEqual([...UNREADABLE_REASON_NAMES]);
    expect(ADDED_CONTENTS.map(nameOfSample)).toEqual([...ADDED_CONTENT_NAMES]);
    expect(CHANGED_CONTENTS.map(nameOfSample)).toEqual([...CHANGED_CONTENT_NAMES]);
  }); // End of the "one sample per declared name" case
}); // End of the "reconciliation key builders" suite

describe('the reconciliation descriptions', () => {
  it.each(LOCALES)('render every external observation in %s', (locale) => {
    for (const observation of EXTERNAL_OBSERVATIONS) {
      const label = `${locale}:${Object.keys(observation)[0]!}`;
      const rendered = describeExternalObservation(locale, observation);
      expect(rendered.trim(), label).not.toBe('');
      expect(rendered, label).not.toContain('undefined');
      expect(rendered, label).not.toMatch(/\{[A-Za-z]/);
    }
  }); // End of the "every external observation" case

  it.each(LOCALES)('render every unreadable reason in %s', (locale) => {
    for (const reason of UNREADABLE_REASONS) {
      const label = `${locale}:${Object.keys(reason)[0]!}`;
      const rendered = describeUnreadableReason(locale, reason);
      expect(rendered.trim(), label).not.toBe('');
      expect(rendered, label).not.toContain('undefined');
      expect(rendered, label).not.toMatch(/\{[A-Za-z]/);
    }
  }); // End of the "every unreadable reason" case

  it.each(LOCALES)('render both content outcomes of both kinds in %s', (locale) => {
    const rendered = [
      ...ADDED_CONTENTS.map((content) => describeAddedContent(locale, content)),
      ...CHANGED_CONTENTS.map((content) => describeChangedContent(locale, content))
    ];
    expect(rendered).toHaveLength(4);
    for (const text of rendered) {
      expect(text.trim(), locale).not.toBe('');
      expect(text, locale).not.toContain('undefined');
      expect(text, locale).not.toMatch(/\{[A-Za-z]/);
    }
    // Four sentences, not two: the two namespaces answer different questions.
    expect(new Set(rendered).size).toBe(4);
  }); // End of the "both content outcomes" rendering case

  it.each(LOCALES)('never render a wire operand where a sentence belongs in %s', (locale) => {
    // A sequence is arbitration data, an offset is a byte position, and a
    // display path is the owner's own file name. None of them is interpolated
    // today, and this is what says so rather than leaving it to be inferred from
    // the dictionary's current wording.
    const rendered = describeExternalObservation(locale, EXTERNAL_OBSERVATIONS[0]!);
    expect(rendered).not.toContain('4');
    expect(rendered).not.toContain('match/base.yml');
    expect(describeUnreadableReason(locale, UNREADABLE_REASONS[0]!)).not.toContain('12');
  }); // End of the "never render a wire operand" case

  it.each(LOCALES)('never render a Rust variant name in %s', (locale) => {
    // The failure this closes is an English identifier in a Spanish sentence.
    expect(describeUnreadableReason(locale, { PermissionDenied: {} })).not.toContain(
      'PermissionDenied'
    );
    expect(describeExternalObservation(locale, EXTERNAL_OBSERVATIONS[2]!)).not.toContain('Removed');
    expect(describeAddedContent(locale, ADDED_CONTENTS[0]!)).not.toContain('Projected');
  }); // End of the "never render a Rust variant name" case
}); // End of the "reconciliation descriptions" suite

/**
 * Every `code.<namespace>` the English dictionary declares.
 *
 * Derived from `en.json` rather than listed, because the question this asks is
 * *which namespaces exist*, and a hand-written answer to that could not fail
 * when a new one arrived. The listed side of the comparison is the registry in
 * `codes.ts`, which is hand-written for the opposite reason.
 *
 * **This selects `code.<namespace>.<member>` and nothing else, so what it
 * returns is the complete set of `code.` namespaces only while every `code.` key
 * has exactly three parts.** That is not a property of the shape — 190 keys
 * elsewhere in this dictionary have four — so it is asserted rather than assumed,
 * by the "only three-part keys" case below. Without that case a four-part
 * `code.<namespace>.<variant>.<operand>` key would register no namespace here, so
 * its namespace would need no registry entry and would be exempt from the
 * reachability check in silence.
 *
 * @returns The namespace names, deduplicated and sorted.
 */
function dictionaryCodeNamespaces(): readonly string[] {
  const namespaces = new Set<string>();
  for (const key of Object.keys(en)) {
    const parts = key.split('.');
    if (parts.length === 3 && parts[0] === 'code' && parts[1] !== undefined) {
      namespaces.add(parts[1]);
    }
  } // End of the loop over the English dictionary's keys
  return [...namespaces].sort();
} // End of function dictionaryCodeNamespaces()

/**
 * One argument per registered key builder, of that builder's own parameter type.
 *
 * The probe below calls every entry of `CODE_NAMESPACE_KEY_BUILDERS` and checks
 * the namespace it emits, and the builders do not share an argument shape: most
 * take a `…Name` string union or a bare-string wire value, and `commandErrorKey`
 * takes a whole `CommandError`. So one generic argument cannot exist, and this
 * table is what supplies the missing one — reusing the sample and name tables at
 * the top of this file wherever one already covers the namespace, so that a
 * variant renamed in Rust breaks one table rather than two.
 *
 * The **shape** is derived from the registry and the **values** are hand-written,
 * which is the split that makes both halves able to fail: a namespace added to
 * the registry with no entry here is an `npm run check` error, and a sample of
 * the wrong type for its builder is one too.
 */
const CODE_NAMESPACE_SAMPLES: {
  readonly [K in keyof typeof CODE_NAMESPACE_KEY_BUILDERS]: Parameters<
    (typeof CODE_NAMESPACE_KEY_BUILDERS)[K]
  >[0];
} = {
  addedContent: ADDED_CONTENT_NAMES[0],
  backupError: 'Io',
  backupReadError: 'RootNotADirectory',
  backupReadStep: 'InspectBackupRoot',
  backupRootState: 'Missing',
  backupStep: 'CreateBackupRoot',
  backupTarget: 'InConfigRoot',
  batchSkipped: 'ForeignName',
  changedContent: CHANGED_CONTENT_NAMES[0],
  commandError: COMMAND_ERRORS[0],
  contentKind: CONTENT_KINDS[0],
  decodeError: 'SpanOutsideSource',
  diagnosticCode: DIAGNOSTIC_CODE_NAMES[0],
  documentShape: DOCUMENT_SHAPES[0],
  draftError: 'MatchHasNoPath',
  duplicateSeam: 'ArrivalLands',
  editError: 'SourceDoesNotParse',
  entrySkipped: 'Marker',
  externalObservation: EXTERNAL_OBSERVATION_NAMES[0],
  fileKind: FILE_KINDS[0],
  findingClass: 'EditorModelError',
  findingCode: 'MatchHasNoContentField',
  hazardKind: HAZARD_KINDS[0],
  invariantViolation: 'InvertedSpan',
  lineEnding: LINE_ENDINGS[0],
  matchBadge: MATCH_BADGES[0],
  moveSeam: 'SourceCloses',
  nodeKind: 'Document',
  notReencodable: 'FoldedStyle',
  pathError: 'NoSuchDocument',
  presentationNote: 'ScalarRestyled',
  reapplyPlacement: 'NotAnchored',
  reapplyRefusal: 'NoAnchorInBase',
  reapplyResolution: 'Unsupported',
  rotationOutcome: 'NotAttempted',
  saveError: 'DocumentIsReadOnly',
  saveResult: 'saved',
  saveVerdict: 'Proceed',
  scalarStyle: SCALAR_STYLES[0],
  syntaxError: 'Parse',
  targetDifference: 'Retargeted',
  triggerKind: TRIGGER_KINDS[0],
  unknownReason: UNKNOWN_REASON_NAMES[0],
  unreadableReason: UNREADABLE_REASON_NAMES[0],
  valueKind: VALUE_KINDS[0],
  variableKind: VARIABLE_KINDS[0],
  verificationFailure: 'DoesNotParse',
  writeError: 'TargetMissing',
  writeStep: 'ResolveTarget'
};

/**
 * Calls one registered key builder with its own namespace's sample argument.
 *
 * The cast is what the registry's type makes unavoidable: read generically, the
 * values are a union of builders with unrelated parameter types, and nothing can
 * call a member of that union without erasing the parameter. It is confined to
 * this one function, and the argument it erases was type-checked against exactly
 * this builder's parameter where {@link CODE_NAMESPACE_SAMPLES} declares it.
 *
 * @param namespace - The registry key whose builder to call.
 * @returns The key that builder produced for its sample argument.
 */
function keyFromSample(namespace: keyof typeof CODE_NAMESPACE_KEY_BUILDERS): TranslationKey {
  const builder = CODE_NAMESPACE_KEY_BUILDERS[namespace] as (value: unknown) => TranslationKey;
  return builder(CODE_NAMESPACE_SAMPLES[namespace]);
} // End of function keyFromSample()

describe('every code namespace has a typed accessor', () => {
  // **The general form of this phase's own gap, and the reason it is written
  // generally.** Before it, `src/lib/i18n/dictionaries.test.ts` checked key-set
  // equality, value shape, the untranslated-value heuristic and placeholder
  // agreement, and `src-tauri/src/dictionary_contract.rs` checked both
  // dictionaries against the Rust enums — and *no* suite asserted that a key
  // could be reached at all. A namespace could therefore land its keys with
  // every gate green and render nowhere. `duplicateSeam` had been in exactly
  // that state since Phase 2c-3c-1, and this check is what found it.

  it('covers the dictionary in both directions, with three named exceptions', () => {
    const registered = Object.keys(CODE_NAMESPACE_KEY_BUILDERS);
    const reachable = [...registered, ...CODE_NAMESPACES_WITHOUT_A_BUILDER].sort();
    expect(reachable).toEqual([...dictionaryCodeNamespaces()]);
    // No duplicate between the two lists: a namespace that is both built and
    // excused would make the comparison above pass while saying two things.
    expect(new Set(reachable).size).toBe(reachable.length);
  }); // End of the "both directions" case

  it('admits exactly the three namespaces that never cross the wire in their own shape', () => {
    // Not a suppression list. `CommandError` flattens all three conditions, so
    // the frontend has no wire type whose variants a builder could take, and
    // their sentences exist because a code with no string is worse than a code
    // with no caller. A fourth entry is a claim about this boundary that has to
    // be argued in `codes.ts`.
    expect([...CODE_NAMESPACES_WITHOUT_A_BUILDER]).toEqual([
      'workspaceError',
      'discoveryError',
      'identityError'
    ]);
  }); // End of the "three exceptions" case

  it('registers callable functions, never namespace strings', () => {
    // The registry's whole point, in two halves. A manifest of strings could
    // claim an accessor exists without naming code, so every value is asserted
    // to be a function; and a builder registered under the *wrong* key is still
    // a function, so every value is also **called**, with
    // `CODE_NAMESPACE_SAMPLES`'s argument for its namespace, and the key it
    // returns is asserted to begin with `code.<the key it is registered under>.`
    // and to be a key `en.json` really holds.
    //
    // **The second half is a runtime probe because nothing forces it at compile
    // time.** `satisfies Readonly<Record<string, (value: never) =>
    // TranslationKey>>` in `codes.ts` says each value is *some* key builder and
    // no more: `never` is assignable to every parameter, so a mis-wired
    // `addedContent: changedContentKey` satisfies it, passes the both-directions
    // key-set comparison above, and leaves `code.addedContent.*` reachable
    // through nothing — the exact unreachability this registry exists to stop.
    // No type can close that, because the namespace a builder emits lives in its
    // body rather than in its signature; only calling it can tell.
    //
    // What the probe does **not** force, stated so it is not read as more: one
    // sample per namespace proves the *prefix*, never that every member of the
    // union has a key. That is `dictionaries.test.ts`'s and
    // `dictionary_contract.rs`'s, in both directions against both dictionaries.
    const namespaces = Object.keys(
      CODE_NAMESPACE_KEY_BUILDERS
    ) as readonly (keyof typeof CODE_NAMESPACE_KEY_BUILDERS)[];
    expect(namespaces.length).toBeGreaterThanOrEqual(49);
    for (const namespace of namespaces) {
      expect(typeof CODE_NAMESPACE_KEY_BUILDERS[namespace], namespace).toBe('function');
      const produced = keyFromSample(namespace);
      expect(produced.startsWith(`code.${namespace}.`), `${namespace} produced ${produced}`).toBe(
        true
      );
      // Non-vacuity: a builder answering a prefix nobody translates would pass
      // the line above while naming nothing.
      expect(Object.hasOwn(en, produced), produced).toBe(true);
    } // End of the loop over the registry's namespaces
  }); // End of the "callable functions" case

  it('has one sample per registered namespace, and none for anything else', () => {
    // The probe above is only as complete as its table, and a table that
    // covered 48 of 49 registry entries — or that kept a sample for a namespace
    // the registry no longer has — would be this suite's own defect one level
    // up. The mapped type on `CODE_NAMESPACE_SAMPLES` makes both a compile
    // error, but **vitest strips types and never type-checks**, so inside this
    // suite that type enforces nothing and only `npm run check` reads it.
    //
    // Of the two halves this case then covers, the second is the one nothing
    // else would notice. A *missing* sample also fails the probe: every builder
    // registered today reaches into its argument — through `uncapitalize`, or
    // through `.code` — so `undefined` throws there, and one that only
    // interpolated would answer `code.<namespace>.undefined` and fail the
    // `Object.hasOwn` check instead. A *stale extra* sample fails nothing at
    // all: the loop iterates the registry, so an entry this table alone still
    // names is simply never read.
    expect(Object.keys(CODE_NAMESPACE_SAMPLES).sort()).toEqual(
      Object.keys(CODE_NAMESPACE_KEY_BUILDERS).sort()
    );
  }); // End of the "one sample per namespace" case

  it('finds only three-part keys under `code.`, which is what makes that set complete', () => {
    // `dictionaryCodeNamespaces` selects `code.<namespace>.<member>`, and both
    // it and `codes.ts` call what it returns the complete set of `code.`
    // namespaces. That is true of this dictionary rather than of the key shape:
    // 190 keys outside `code.` already have four parts. A four-part
    // `code.<namespace>.<variant>.<operand>` key would therefore register no
    // namespace, so its namespace would need no registry entry, and it would be
    // exempt from the reachability check above **in silence** — the failure the
    // registry exists to stop, arriving through the shape of a key rather than
    // through a missing entry. This is the assertion that makes "complete" true
    // by construction instead of by luck.
    //
    // **Relaxing it means deciding what a four-part `code.` key's namespace is**
    // and teaching `dictionaryCodeNamespaces` to return it, so the key still
    // faces the registry. It never means widening the filter to let a shape
    // through unregistered.
    const notThreeParts = Object.keys(en).filter(
      (key) => key.split('.')[0] === 'code' && key.split('.').length !== 3
    );
    expect(notThreeParts).toEqual([]);
  }); // End of the "only three-part keys" case

  it('is read from a dictionary that really was parsed', () => {
    // The non-vacuity guard: a `dictionaryCodeNamespaces` that silently stopped
    // recognising keys would return nothing, and an empty set compared against a
    // non-empty registry already fails — but it would fail pointing at the
    // registry. This fails first, and with a count.
    const namespaces = dictionaryCodeNamespaces();
    expect(namespaces.length).toBeGreaterThanOrEqual(52);
    expect(namespaces).toContain('duplicateSeam');
    expect(namespaces).toContain('externalObservation');
  }); // End of the "really was parsed" case
}); // End of the "every code namespace has a typed accessor" suite

describe('the reactive reconciliation wrappers', () => {
  // The `t*` wrappers are one-line delegations to the `describe*` functions
  // above, with the showing locale supplied. What is asserted is exactly that:
  // each renders the sentence its describer renders for the locale in force, and
  // each follows an override rather than freezing a language. A wrapper wired to
  // the wrong describer — the easiest mistake in a block of near-identical
  // one-liners — renders another namespace's sentence and passes every check
  // that only asks whether *a* sentence came out.

  /**
   * Runs `body` with the interface language overridden, and restores it after.
   *
   * The override is global state on a module-level store, so a case that set it
   * and threw would leave the next case in another language.
   *
   * @param language - The locale to force.
   * @param body - What to run under it.
   */
  function underLocale(language: Locale, body: () => void): void {
    const before = locale.current;
    locale.setOverride(language);
    try {
      body();
    } finally {
      locale.setOverride(before === language ? null : before);
    }
  } // End of function underLocale()

  it.each(LOCALES)('render each namespace through its own describer in %s', (language) => {
    underLocale(language, () => {
      expect(tExternalObservation(EXTERNAL_OBSERVATIONS[0]!)).toBe(
        describeExternalObservation(language, EXTERNAL_OBSERVATIONS[0]!)
      );
      expect(tUnreadableReason(UNREADABLE_REASONS[0]!)).toBe(
        describeUnreadableReason(language, UNREADABLE_REASONS[0]!)
      );
      expect(tAddedContent(ADDED_CONTENTS[0]!)).toBe(
        describeAddedContent(language, ADDED_CONTENTS[0]!)
      );
      expect(tChangedContent(CHANGED_CONTENTS[0]!)).toBe(
        describeChangedContent(language, CHANGED_CONTENTS[0]!)
      );
      expect(tDuplicateSeam('CopiedRunsJoin')).toBe(
        describeDuplicateSeam(language, 'CopiedRunsJoin')
      );
    });
  }); // End of the "own describer" case

  it('follows the language in force rather than freezing one', () => {
    // Two namespaces whose two sentences must differ between the dictionaries.
    // A wrapper that captured `locale.current` at module load would answer the
    // same string under both overrides, and the assertion above — which reads
    // the same store — could not tell.
    const rendered = LOCALES.map((language) => {
      let seen = '';
      underLocale(language, () => {
        seen = tChangedContent(CHANGED_CONTENTS[1]!);
      });
      return seen;
    });
    expect(new Set(rendered).size).toBe(LOCALES.length);
  }); // End of the "follows the language in force" case

  it('does not answer one namespace with another namespace’s sentence', () => {
    // `addedContent` and `changedContent` have the same two variant names, which
    // is exactly where a copied one-liner would go unnoticed.
    underLocale('en', () => {
      expect(tAddedContent(ADDED_CONTENTS[0]!)).not.toBe(tChangedContent(CHANGED_CONTENTS[0]!));
      expect(tAddedContent(ADDED_CONTENTS[1]!)).not.toBe(tChangedContent(CHANGED_CONTENTS[1]!));
    });
  }); // End of the "one namespace's sentence" case
}); // End of the "reactive reconciliation wrappers" suite
