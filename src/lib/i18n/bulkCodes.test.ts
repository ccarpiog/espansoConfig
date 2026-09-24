/**
 * Runtime checks on the bulk option edit's accessors — Phase 3-10.
 *
 * The compile-time half is in `codes.ts` (every key builder returns a
 * `TranslationKey` over the enum's own name union) and in
 * `src-tauri/src/dictionary_contract.rs` (both dictionaries against the
 * `BulkPlanError` and `BulkFileOutcome` declarations, in both directions). What
 * is left here is that calling each accessor produces a sentence in both
 * languages, that no placeholder brace survives, and the one register rule the
 * outcomes must keep: only a preflight outcome may say that no file was written.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers in this file do.
 */

import { describe, expect, it } from 'vitest';
import {
  bulkFileOutcomeKey,
  bulkPlanErrorKey,
  describeBulkFileOutcome,
  describeBulkPlanError,
  describeIdentityError
} from './codes';
import { LOCALES } from './locale';
import type { ExpectNever, Missing } from './exhaustive';
import en from './en.json';
import type {
  BulkFileOutcome,
  BulkFileOutcomeName,
  BulkPlanError,
  BulkPlanErrorName,
  IdentityError
} from '../ipc/types';

/** Every `BulkPlanError` variant name, in declaration order, written by hand. */
const PLAN_ERROR_NAMES = [
  'NoOptionChanges',
  'OptionRepeated',
  'OptionNotPlainSource',
  'NoFiles',
  'DocumentRepeated',
  'NoMatches',
  'MatchRepeated',
  'Identity',
  'Draft'
] as const satisfies readonly BulkPlanErrorName[];

/** Every `BulkFileOutcome` discriminant, in declaration order, written by hand. */
const OUTCOME_NAMES = [
  'saved',
  'alreadyUnchanged',
  'conflicted',
  'refused',
  'consentStale',
  'blocked',
  'failed',
  'writeOutcomeUnknown',
  'notAttempted',
  'excludedBeforeApply'
] as const satisfies readonly BulkFileOutcomeName[];

export type _BulkPlanErrorsAreComplete = ExpectNever<
  Missing<BulkPlanErrorName, typeof PLAN_ERROR_NAMES>
>;
export type _BulkFileOutcomesAreComplete = ExpectNever<
  Missing<BulkFileOutcomeName, typeof OUTCOME_NAMES>
>;

/** One synthetic revision, the shape Rust writes. */
const REVISION = 'a'.repeat(64);

/** One instance of every planning refusal, in declaration order. */
const PLAN_ERRORS: readonly BulkPlanError[] = [
  { NoOptionChanges: {} },
  { OptionRepeated: { option: 'force_mode' } },
  { OptionNotPlainSource: { option: 'word' } },
  { NoFiles: {} },
  { DocumentRepeated: { document: 3 } },
  { NoMatches: {} },
  { MatchRepeated: { index: 2 } },
  { Identity: { index: 0, error: { NoSuchMatch: { node: 4 } } } },
  { Draft: { index: 1, error: { MatchNotEditable: { hazard: null } } } }
];

/** One instance of every file outcome, in declaration order. */
const OUTCOMES: readonly BulkFileOutcome[] = [
  { outcome: 'saved', revision: REVISION, backup_taken: true, notes: [] },
  { outcome: 'alreadyUnchanged', revision: REVISION },
  { outcome: 'conflicted', expected: REVISION, found: 'b'.repeat(64), disk_revision: 'b'.repeat(64) },
  {
    outcome: 'refused',
    verdict: 'RefusedForUnacknowledgedSuspicions',
    findings: [],
    candidate: REVISION,
    intent: 'd'.repeat(64)
  },
  { outcome: 'consentStale', intent: 'd'.repeat(64), candidate: 'c'.repeat(64) },
  { outcome: 'blocked', error: { code: 'bulkRefused', error: { NoMatches: {} } } },
  { outcome: 'failed', error: { code: 'noWorkspaceOpen' } },
  { outcome: 'writeOutcomeUnknown', error: { code: 'noWorkspaceOpen' } },
  { outcome: 'notAttempted' },
  { outcome: 'excludedBeforeApply' }
];

/**
 * Whether a rendered sentence is a real one: non-empty, with no placeholder left.
 *
 * @param sentence - What an accessor answered.
 * @returns `true` for a finished sentence.
 */
function finished(sentence: string): boolean {
  return sentence.trim().length > 0 && !/[{}]/.test(sentence);
}

describe('the bulk planning refusals', () => {
  it('cover every variant with a key of its own', () => {
    expect(PLAN_ERRORS.map((error) => Object.keys(error)[0])).toEqual([...PLAN_ERROR_NAMES]);
    for (const name of PLAN_ERROR_NAMES) {
      expect(Object.keys(en)).toContain(bulkPlanErrorKey(name));
    }
  });

  it('render a finished sentence in every language', () => {
    for (const locale of LOCALES) {
      for (const error of PLAN_ERRORS) {
        expect(finished(describeBulkPlanError(locale, error))).toBe(true);
      }
    }
  });

  it('name a repeated option by its espanso key, never by a Rust identifier', () => {
    for (const locale of LOCALES) {
      const sentence = describeBulkPlanError(locale, { OptionRepeated: { option: 'force_mode' } });
      expect(sentence).toContain('force_mode');
      expect(sentence).not.toContain('ForceMode');
    }
  });

  it('render the nested identity refusal through its own accessor', () => {
    // `IdentityError` first crossed the boundary in its own shape at Phase 3-10,
    // inside the `Identity` arm, so it gained a builder of its own.
    const identities: readonly IdentityError[] = [
      { WrongDocument: { expected: 1, found: 2 } },
      { StaleRevision: { expected: REVISION, found: 'b'.repeat(64) } },
      { NoSuchMatch: { node: 4 } }
    ];
    for (const locale of LOCALES) {
      const sentences = identities.map((error) => describeIdentityError(locale, error));
      for (const sentence of sentences) {
        expect(finished(sentence)).toBe(true);
      }
      expect(new Set(sentences).size).toBe(identities.length);
    }
  });
}); // End of the "bulk planning refusals" suite

describe('the bulk file outcomes', () => {
  it('cover every discriminant with a key of its own', () => {
    expect(OUTCOMES.map((outcome) => outcome.outcome)).toEqual([...OUTCOME_NAMES]);
    for (const name of OUTCOME_NAMES) {
      expect(Object.keys(en)).toContain(bulkFileOutcomeKey(name));
    }
  });

  it('render a finished, distinct sentence in every language', () => {
    for (const locale of LOCALES) {
      const sentences = OUTCOMES.map((outcome) => describeBulkFileOutcome(locale, outcome));
      for (const sentence of sentences) {
        expect(finished(sentence)).toBe(true);
      }
      expect(new Set(sentences).size).toBe(OUTCOMES.length);
    }
  });

  it('claim that no file was written only where a preflight stopped the run', () => {
    // Ruling 19: "nothing was written" is never said unless the execution shows
    // it for the whole request. `blocked` and `consentStale` are produced only
    // by the preflight, before any save runs; every other sentence speaks of its
    // own file alone.
    const wholeRequest = new Set<BulkFileOutcomeName>(['blocked', 'consentStale']);
    for (const outcome of OUTCOMES) {
      const sentence = describeBulkFileOutcome('en', outcome);
      expect(/no file was written/i.test(sentence)).toBe(wholeRequest.has(outcome.outcome));
    }
  });
}); // End of the "bulk file outcomes" suite
