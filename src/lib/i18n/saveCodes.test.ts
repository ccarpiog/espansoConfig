/**
 * Runtime checks on the save transaction's accessors — Phase 2b-1.
 *
 * The compile-time half is in `codes.ts`: every key builder returns a
 * `TranslationKey` whose type is a template literal over the enum's own name
 * union, so a variant with no dictionary entry fails `svelte-check` there. The
 * Rust half is `src-tauri/src/dictionary_contract.rs`, which compares both
 * dictionaries against the enum declarations in both directions, and
 * `wire_contract.rs`, which additionally asserts that every `{placeholder}` in
 * these 157 messages names an operand `serde` really writes.
 *
 * What is left for this file is the one thing neither can see: that calling the
 * accessor actually produces a sentence. A describer that reached for the wrong
 * key, or that fed the wrong shape to `wireVariantName`, renders `undefined` and
 * every check above still passes.
 *
 * The samples are written by hand. A list derived from `en.json` would agree
 * with `en.json` by construction and could not fail; a list derived from the
 * union types is what `wire_contract.rs` already holds, in the language where the
 * JSON exists.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own.
 */

import { describe, expect, it } from 'vitest';
import {
  describeBackupError,
  describeBackupStep,
  describeDecodeError,
  describeEditError,
  describeFindingClass,
  describeFindingCode,
  describeInvariantViolation,
  describeMoveSeam,
  describeNodeKind,
  describePathError,
  describeRotationOutcome,
  describeSaveError,
  describeSaveVerdict,
  describeSyntaxError,
  describeTargetDifference,
  describeVerificationFailure,
  describeWriteError,
  describeWriteStep
} from './codes';
import { LOCALES } from './locale';
import type { Locale } from './locale';

/** A byte span, for a sample that carries one. */
const SPAN = { start: 3, end: 11 } as const;

/** A path as it crosses the boundary: a lossy string, never an object. */
const PATH = '/nowhere/match/base.yml';

/**
 * One rendering per accessor, in one locale.
 *
 * Every entry names the accessor and hands it a value of the shape `serde`
 * writes. The tagged ones deliberately use a variant that **carries operands**,
 * because a describer that dropped the operand object still renders a sentence
 * for a bare-name variant and would pass a check built only on those.
 *
 * @param locale - The dictionary to read from.
 * @returns One label-and-sentence pair per accessor.
 */
function renderings(locale: Locale): readonly (readonly [string, string])[] {
  return [
    ['NodeKind', describeNodeKind(locale, 'Mapping')],
    ['SaveVerdict', describeSaveVerdict(locale, 'RefusedForEditorModelErrors')],
    ['FindingClass', describeFindingClass(locale, 'SuspiciousButPermitted')],
    ['WriteStep', describeWriteStep(locale, 'VerifyTempIdentity')],
    ['BackupStep', describeBackupStep(locale, 'PublishBackupFile')],
    ['RotationOutcome', describeRotationOutcome(locale, 'ScanFailed')],
    ['MoveSeam', describeMoveSeam(locale, 'CarriedRunsJoin')],
    [
      'FindingCode',
      describeFindingCode(locale, { VariableTypeNotRecognised: { declared: 'global' } })
    ],
    ['FindingCode.unit', describeFindingCode(locale, 'MatchHasNoTriggerField')],
    ['EditError', describeEditError(locale, { NoObservableLineEnding: { edit: 0, at: 12 } })],
    [
      'VerificationFailure',
      describeVerificationFailure(locale, { DecoderDisagreement: { edit: 0 } })
    ],
    [
      'SyntaxError',
      describeSyntaxError(locale, { Invariant: { UnbalancedEvents: { depth: 1 } } })
    ],
    [
      'InvariantViolation',
      describeInvariantViolation(locale, { InvertedSpan: { start: 9, end: 4 } })
    ],
    ['PathError', describePathError(locale, { NoSuchKey: { key: 'replace', segment: 1, node: 0 } })],
    ['PathError.unit', describePathError(locale, 'NoKeySegment')],
    ['DecodeError', describeDecodeError(locale, { UnknownEscape: { escape: 'q' } })],
    ['DecodeError.span', describeDecodeError(locale, { SpanOutsideSource: { span: SPAN, source_len: 4 } })],
    ['TargetDifference', describeTargetDifference(locale, { Retargeted: { now: PATH } })],
    ['TargetDifference.unit', describeTargetDifference(locale, 'Vanished')],
    [
      'WriteError',
      describeWriteError(locale, {
        Io: { step: 'Rename', path: PATH, kind: 'PermissionDenied', raw_os_error: null }
      })
    ],
    ['BackupError', describeBackupError(locale, { NotADirectory: { path: PATH } })],
    ['SaveError', describeSaveError(locale, { TargetNotUtf8: { path: PATH, offset: 12 } })],
    [
      'SaveError.nested',
      describeSaveError(locale, { Write: { TempFileChangedDuringWrite: { path: PATH } } })
    ]
  ];
} // End of function renderings()

describe('the save-transaction accessors', () => {
  it.each(LOCALES)('render a sentence in %s, never a gap', (locale) => {
    for (const [what, rendered] of renderings(locale)) {
      const label = `${locale}:${what}`;
      expect(rendered.trim(), label).not.toBe('');
      expect(rendered, label).not.toContain('undefined');
      // `translate` leaves an unsubstituted `{placeholder}` visible on purpose,
      // so its absence is what says every operand the message names was given.
      expect(rendered, label).not.toContain('{');
      expect(rendered, label).not.toContain('[object Object]');
    }
  }); // End of the "render a sentence" case

  it.each(LOCALES)('substitute the operands a message names in %s', (locale) => {
    expect(describeSaveError(locale, { TargetNotUtf8: { path: PATH, offset: 12 } })).toContain(PATH);
    expect(describeSaveError(locale, { TargetNotUtf8: { path: PATH, offset: 12 } })).toContain('12');
    expect(
      describeFindingCode(locale, { VariableTypeNotRecognised: { declared: 'global' } })
    ).toContain('global');
  }); // End of the "substitute the operands" case

  it.each(LOCALES)('leave an ErrorKind name and a nested error out of the sentence in %s', (
    locale
  ) => {
    // `kind` is a `std::io::ErrorKind` variant name: an English identifier with
    // no dictionary of its own, and the same operand `IoError.kind` is already
    // kept out of a message for.
    const io = describeWriteError(locale, {
      Io: { step: 'Rename', path: PATH, kind: 'PermissionDenied', raw_os_error: 13 }
    });
    expect(io).not.toContain('PermissionDenied');
    expect(io).not.toContain('Rename');
    // `raw_os_error` is diagnostic data rather than a code. It is a number, so
    // `scalarOperands` would happily substitute it — no message names it, and a
    // bare errno in a sentence is exactly the leak this asserts against.
    expect(io).not.toContain('13');
    // A nested wire value has a message of its own; folding it in here would
    // decide for every screen at once how much detail a user is shown.
    const nested = describeSaveError(locale, {
      Write: { TempFileChangedDuringWrite: { path: PATH } }
    });
    expect(nested).not.toContain('TempFileChangedDuringWrite');
  }); // End of the "ErrorKind and nested error" case

  it.each(LOCALES)('never render a Rust variant name where a sentence belongs in %s', (locale) => {
    for (const [what, rendered] of renderings(locale)) {
      expect(rendered, `${locale}:${what}`).not.toMatch(/\b[A-Z][a-z]+[A-Z][A-Za-z]*\b/);
    }
  }); // End of the "never a variant name" case
}); // End of the "save-transaction accessors" suite
