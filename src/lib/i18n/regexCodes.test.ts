/**
 * Runtime checks on the regex bench accessors — Phase 4-21.
 *
 * The compile-time half is in `codes.ts` (each key builder returns a
 * `TranslationKey` over the enum's own union) and in
 * `src-tauri/src/dictionary_contract.rs` (both dictionaries against the
 * `RegexRefusal` and `RegexCompileFailure` declarations, in both directions).
 * What is left here is that calling each accessor produces a sentence in both
 * languages, that no placeholder brace survives, that no variant name leaks
 * into a sentence, and that none claims what espanso accepts or triggers on
 * (Phase 4 ruling 28).
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers in this file do.
 */

import { describe, expect, it } from 'vitest';
import {
  describeRegexCompileFailure,
  describeRegexRefusal,
  regexCompileFailureKey,
  regexRefusalKey
} from './codes';
import { LOCALES } from './locale';
import type { ExpectNever, Missing } from './exhaustive';
import en from './en.json';
import type { RegexCompileFailure, RegexRefusal, RegexRefusalName } from '../ipc/types';

/** One value of every `RegexRefusal` variant, by hand. */
const REFUSALS = [
  'PatternTooLarge',
  'SampleTooLarge',
  'CaptureLimit',
  { CompileRejected: { reason: 'Syntax' } },
  'OutputLimit'
] as const satisfies readonly RegexRefusal[];

/** The variant names {@link REFUSALS} covers, in the same order. */
const REFUSAL_NAMES = [
  'PatternTooLarge',
  'SampleTooLarge',
  'CaptureLimit',
  'CompileRejected',
  'OutputLimit'
] as const satisfies readonly RegexRefusalName[];

/** Every `RegexCompileFailure` member, by hand. */
const FAILURES = ['Syntax', 'CompiledTooBig', 'Other'] as const satisfies readonly RegexCompileFailure[];

export type _RefusalsAreComplete = ExpectNever<Missing<RegexRefusalName, typeof REFUSAL_NAMES>>;
export type _FailuresAreComplete = ExpectNever<Missing<RegexCompileFailure, typeof FAILURES>>;

/**
 * Every sentence the two accessors produce in one language.
 *
 * @param locale - The language to render in.
 * @returns One sentence per variant, refusals first.
 */
function everySentence(locale: (typeof LOCALES)[number]): readonly string[] {
  return [
    ...REFUSALS.map((refusal) => describeRegexRefusal(locale, refusal)),
    ...FAILURES.map((reason) => describeRegexCompileFailure(locale, reason))
  ];
} // End of function everySentence()

describe('the regex bench accessors', () => {
  it('reach a key of their own namespace for every variant', () => {
    const keys = [...REFUSAL_NAMES.map(regexRefusalKey), ...FAILURES.map(regexCompileFailureKey)];
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(Object.keys(en)).toContain(key);
    }
    expect(
      REFUSALS.map((refusal) => (typeof refusal === 'string' ? refusal : Object.keys(refusal)[0]))
    ).toEqual([...REFUSAL_NAMES]);
  }); // End of the "reach a key" case

  it('render a sentence in both languages, with no brace and no variant name', () => {
    const names: readonly string[] = [...REFUSAL_NAMES, ...FAILURES];
    for (const locale of LOCALES) {
      const sentences = everySentence(locale);
      expect(sentences).toHaveLength(5 + 3);
      for (const [index, sentence] of sentences.entries()) {
        expect(sentence.trim().length, `${locale}: ${sentence}`).toBeGreaterThan(0);
        expect(sentence, `${locale}: ${sentence}`).not.toMatch(/[{}<>]/);
        expect(sentence, `${locale}: ${sentence}`).not.toContain(names[index] ?? '');
      }
    } // End of the loop over the two languages
  }); // End of the "render a sentence" case

  it('never claims what espanso accepts or triggers on', () => {
    for (const locale of LOCALES) {
      for (const sentence of everySentence(locale)) {
        const lower = sentence.toLowerCase();
        expect(lower).not.toMatch(/espanso (will|does|accepts|rejects|triggers|expands)/);
        expect(lower).not.toMatch(/espanso (acepta|rechaza|dispara|expande)/);
      }
    } // End of the loop over the two languages
    // The compile sentence names the version this application uses, in both languages.
    expect(describeRegexRefusal('en', { CompileRejected: { reason: 'Other' } })).toMatch(
      /the version espansoConfig uses/
    );
    expect(describeRegexRefusal('es', { CompileRejected: { reason: 'Other' } })).toMatch(
      /la versión que usa espansoConfig/
    );
  }); // End of the "never claims" case
}); // End of the regex bench accessors suite
