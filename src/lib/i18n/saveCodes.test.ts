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
  describeNotReencodable,
  describePathError,
  describePresentationNote,
  describeRotationOutcome,
  describeSaveError,
  describeSaveResult,
  describeSaveVerdict,
  describeSyntaxError,
  describeTargetDifference,
  describeVerificationFailure,
  describeWriteError,
  describeWriteStep
} from './codes';
import { makeDocument } from '../browser/fixtures';
import { LOCALES } from './locale';
import type { Locale } from './locale';

/** A byte span, for a sample that carries one. */
const SPAN = { start: 3, end: 11 } as const;

/** A path as it crosses the boundary: a lossy string, never an object. */
const PATH = '/nowhere/match/base.yml';

/**
 * A content revision as it crosses the boundary: 64 lowercase hex characters.
 *
 * `DocumentDoesNotParse` carries one so that acknowledging a broken text
 * acknowledges *that* text. It is opaque and no sentence names it, which is what
 * the "keep the parser's own diagnostic out" case below asserts.
 */
const REVISION = 'c'.repeat(64);

/**
 * The projection a conflict carries.
 *
 * Neutral and synthetic, and built by the browser's own fixture module so this
 * file does not become a second, drifting description of a `DocumentView`.
 */
const DISK = makeDocument({ id: 2, relativePath: 'match/base.yml' });

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
    [
      'FindingCode.doesNotParse',
      describeFindingCode(locale, {
        DocumentDoesNotParse: {
          revision: REVISION,
          line: 4,
          column: 11,
          byte_index: 52,
          detail: "the substrate's own English diagnostic"
        }
      })
    ],
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
    ],
    ['NotReencodable', describeNotReencodable(locale, 'MixedLineBreaks')],
    ['NotReencodable.nested', describeNotReencodable(locale, { Undecodable: 'TrailingBackslash' })],
    [
      'PresentationNote.scalar',
      describePresentationNote(locale, {
        ScalarRestyled: { edit: 0, from: 'Plain', to: 'Literal', reason: null }
      })
    ],
    [
      'PresentationNote.layout',
      describePresentationNote(locale, { DoubledSequenceSeparation: { edit: 0 } })
    ],
    [
      'SaveResult.saved',
      describeSaveResult(locale, {
        outcome: 'saved',
        revision: 'a'.repeat(64),
        committed: true,
        notes: [],
        backup_taken: true,
        moved: null
      })
    ],
    [
      'SaveResult.conflict',
      describeSaveResult(locale, {
        outcome: 'conflict',
        reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
        expected: 'a'.repeat(64),
        found: 'b'.repeat(64),
        disk_revision: 'b'.repeat(64),
        disk_text: 'matches:\n  - trigger: x\n    replace: theirs\n',
        disk: DISK
      })
    ],
    [
      'SaveResult.refused',
      describeSaveResult(locale, {
        outcome: 'refused',
        verdict: 'RefusedForUnacknowledgedSuspicions',
        findings: []
      })
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

  it.each(LOCALES)('say nothing about a save that this application can establish in %s', (
    locale
  ) => {
    // The register `docs/reviews/phase-2b-1-strings.md` set, applied to the three
    // sentences 2b-2a added. None may promise that a change cannot be lost, that
    // a file is recoverable, or what espanso will do with the result: the write
    // lock excludes only this application's own writers, and backups are kept for
    // ten sessions.
    const saved = describeSaveResult(locale, {
      outcome: 'saved',
      revision: 'a'.repeat(64),
      committed: true,
      notes: [],
      backup_taken: true,
      moved: null
    });
    for (const claim of ['espanso ', 'recuperab', 'recover', 'safe', 'seguro', 'a salvo']) {
      expect(saved.toLowerCase(), `${locale}:${claim}`).not.toContain(claim.toLowerCase());
    }
  }); // End of the "register" case

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

  it.each(LOCALES)('keep the parser’s own diagnostic out of the sentence in %s', (locale) => {
    // `detail` is the YAML substrate's prose in one language, exactly as
    // `RegexDoesNotCompile.detail` is the `regex` crate's. It is a string, so
    // `scalarOperands` would substitute it if a message named it; no message
    // does, and this is what says so.
    const parse = describeFindingCode(locale, {
      DocumentDoesNotParse: {
        revision: REVISION,
        line: 4,
        column: 11,
        byte_index: 52,
        detail: 'did not find expected key'
      }
    });
    expect(parse, locale).not.toContain('did not find expected key');
    // The position operands are optional on the wire — a failure this crate's own
    // indexer produced carries none — so a message naming them would leave a
    // visible brace for exactly the case a user is least able to interpret.
    for (const absent of ['4', '11', '52']) {
      expect(parse, `${locale}:${absent}`).not.toContain(absent);
    }
    // `revision` is the operand that binds an acknowledgement to one candidate.
    // It is a 64-character digest and means nothing to a reader, so it is carried
    // and never shown — the same rule, for the same reason `detail` follows it.
    expect(parse, locale).not.toContain(REVISION);
  }); // End of the "parser's own diagnostic" case

  it.each(LOCALES)('tell the two presentation notes apart in %s', (locale) => {
    // The whole reason `PresentationNote` became a tagged union: a deletion that
    // leaves two blank lines next to each other is not a spelling change, and a
    // note that rendered the spelling sentence for it would be telling a person
    // something untrue about their file. The two sentences must therefore differ,
    // and the layout one must not be about a value at all.
    const restyled = describePresentationNote(locale, {
      ScalarRestyled: { edit: 0, from: 'Plain', to: 'Literal', reason: null }
    });
    const layout = describePresentationNote(locale, {
      DoubledSequenceSeparation: { edit: 0 }
    });
    expect(layout, locale).not.toBe(restyled);
    for (const spelling of ['spelling', 'style', 'grafía', 'estilo']) {
      expect(layout.toLowerCase(), `${locale}:${spelling}`).not.toContain(spelling);
    }
    // `edit` is a batch position and means nothing to the person reading this.
    expect(layout, locale).not.toContain('0');
    expect(restyled, locale).not.toContain('0');
  }); // End of the "two presentation notes" case

  it.each(LOCALES)('never render a Rust variant name where a sentence belongs in %s', (locale) => {
    for (const [what, rendered] of renderings(locale)) {
      expect(rendered, `${locale}:${what}`).not.toMatch(/\b[A-Z][a-z]+[A-Z][A-Za-z]*\b/);
    }
  }); // End of the "never a variant name" case
}); // End of the "save-transaction accessors" suite
