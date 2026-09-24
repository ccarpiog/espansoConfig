/**
 * Runtime checks on the sidecar store's accessors — Phase 3-12.
 *
 * The compile-time half is in `codes.ts` (each key builder returns a
 * `TranslationKey` over the enum's own name union) and in
 * `src-tauri/src/dictionary_contract.rs` (both dictionaries against the
 * `SidecarStatus` and `SidecarUpdateOutcome` declarations, in both
 * directions). What is left here is that each accessor produces a finished
 * sentence in both languages, that operands are substituted, and the one
 * register rule ruling 27 sets: only a status built after a rename says the
 * file was renamed.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers in this file do.
 */

import { describe, expect, it } from 'vitest';
import {
  describeSidecarStatus,
  describeSidecarUpdateOutcome,
  sidecarStatusKey,
  sidecarUpdateOutcomeKey
} from './codes';
import { LOCALES } from './locale';
import type { ExpectNever, Missing } from './exhaustive';
import en from './en.json';
import type {
  SidecarStatus,
  SidecarStatusName,
  SidecarUpdateOutcome,
  SidecarUpdateOutcomeName
} from '../ipc/types';

/** Every `SidecarStatus` variant name, in declaration order, written by hand. */
const STATUS_NAMES = [
  'Fresh',
  'Loaded',
  'Quarantined',
  'QuarantineFailed',
  'FutureSchema',
  'Unreadable',
  'RootUnresolved',
  'StorageUnavailable'
] as const satisfies readonly SidecarStatusName[];

/** Every `SidecarUpdateOutcome` variant name, in declaration order. */
const OUTCOME_NAMES = [
  'Saved',
  'Unchanged',
  'NotWritable',
  'WriteFailed'
] as const satisfies readonly SidecarUpdateOutcomeName[];

export type _SidecarStatusesAreComplete = ExpectNever<
  Missing<SidecarStatusName, typeof STATUS_NAMES>
>;
export type _SidecarOutcomesAreComplete = ExpectNever<
  Missing<SidecarUpdateOutcomeName, typeof OUTCOME_NAMES>
>;

/** A synthetic quarantine name, the shape Rust generates. */
const ASIDE = `${'0'.repeat(64)}.corrupt-1767225600-42-0.json`;

/** One instance of every status, in declaration order. */
const STATUSES: readonly SidecarStatus[] = [
  { Fresh: {} },
  { Loaded: {} },
  { Quarantined: { aside: ASIDE } },
  { QuarantineFailed: {} },
  { FutureSchema: { version: '7' } },
  { Unreadable: {} },
  { RootUnresolved: {} },
  { StorageUnavailable: {} }
];

/** One instance of every update outcome, in declaration order. */
const OUTCOMES: readonly SidecarUpdateOutcome[] = [
  { Saved: {} },
  { Unchanged: {} },
  { NotWritable: {} },
  { WriteFailed: {} }
];

/**
 * Whether a rendered sentence is finished: not blank, and no placeholder brace
 * left unsubstituted.
 *
 * @param sentence - The rendered sentence.
 * @returns `true` when it is.
 */
function finished(sentence: string): boolean {
  return sentence.trim().length > 0 && !/[{}]/.test(sentence);
}

describe('the sidecar statuses', () => {
  it('cover every variant with a key of its own', () => {
    expect(STATUSES.map((status) => Object.keys(status)[0])).toEqual([...STATUS_NAMES]);
    for (const name of STATUS_NAMES) {
      expect(Object.keys(en)).toContain(sidecarStatusKey(name));
    }
  });

  it('render a finished, distinct sentence in every language, operands substituted', () => {
    for (const locale of LOCALES) {
      const sentences = STATUSES.map((status) => describeSidecarStatus(locale, status));
      for (const sentence of sentences) {
        expect(finished(sentence)).toBe(true);
      }
      expect(new Set(sentences).size).toBe(STATUSES.length);
      expect(describeSidecarStatus(locale, { Quarantined: { aside: ASIDE } })).toContain(ASIDE);
      expect(describeSidecarStatus(locale, { FutureSchema: { version: '7' } })).toContain('7');
    }
  });

  it('say the file was renamed only for the status built after the rename', () => {
    for (const status of STATUSES) {
      const sentence = describeSidecarStatus('en', status);
      expect(/renamed/i.test(sentence)).toBe('Quarantined' in status);
    }
  });
}); // End of the "sidecar statuses" suite

describe('the sidecar update outcomes', () => {
  it('cover every variant with a key of its own', () => {
    expect(OUTCOMES.map((outcome) => Object.keys(outcome)[0])).toEqual([...OUTCOME_NAMES]);
    for (const name of OUTCOME_NAMES) {
      expect(Object.keys(en)).toContain(sidecarUpdateOutcomeKey(name));
    }
  });

  it('render a finished, distinct sentence in every language', () => {
    for (const locale of LOCALES) {
      const sentences = OUTCOMES.map((outcome) => describeSidecarUpdateOutcome(locale, outcome));
      for (const sentence of sentences) {
        expect(finished(sentence)).toBe(true);
      }
      expect(new Set(sentences).size).toBe(OUTCOMES.length);
    }
  });
}); // End of the "sidecar update outcomes" suite
