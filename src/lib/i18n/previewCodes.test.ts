/**
 * Runtime checks on the preview accessors — Phase 4-17.
 *
 * The compile-time half is in `codes.ts` (every key builder returns a
 * `TranslationKey` over the enum's own union) and in
 * `src-tauri/src/dictionary_contract.rs` (both dictionaries against the
 * `PreviewUnresolved`, `PreviewPlaceholder` and `PreviewLimit` declarations,
 * in both directions). What is left here is that calling each accessor
 * produces a sentence in both languages, that no placeholder brace survives,
 * that no authored operand — a command, an argument, a trigger — reaches the
 * sentence, and that none claims how espanso expands a snippet or that this
 * application runs a command or reads the clipboard (Phase 4 ruling 26).
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers in this file do.
 */

import { describe, expect, it } from 'vitest';
import {
  describePreviewLimit,
  describePreviewPlaceholder,
  describePreviewUnresolved,
  previewLimitKey,
  previewPlaceholderKey,
  previewUnresolvedKey
} from './codes';
import { LOCALES } from './locale';
import type { ExpectNever, Missing } from './exhaustive';
import en from './en.json';
import type {
  PreviewLimit,
  PreviewPlaceholder,
  PreviewPlaceholderName,
  PreviewUnresolved
} from '../ipc/types';

/** Every `PreviewUnresolved` member, in declaration order, by hand. */
const UNRESOLVED = [
  'UnknownName',
  'AmbiguousName',
  'Cycle',
  'DepthLimit',
  'WorkLimit',
  'MissingSample',
  'SampleOutOfRange',
  'FormIsNotAScalar',
  'FieldNotInLayout',
  'SubnameUnsupported',
  'InjectionUncertain',
  'ValueUnreadable',
  'AmbiguousScalar',
  'DateNotPreviewed',
  'KindNotPreviewed',
  'UnverifiedLayoutReference',
  'UnsupportedLayoutSyntax'
] as const satisfies readonly PreviewUnresolved[];

/**
 * One value of every `PreviewPlaceholder` variant, by hand, whose operands are
 * hostile markup: none of it may reach a sentence.
 */
const PLACEHOLDERS = [
  { Clipboard: {} },
  { Shell: { command: '<script>rm -rf OPERAND</script>' } },
  { Script: { args: ['OPERAND', '<img onerror=x>'] } },
  { Match: { trigger: ':OPERAND' } }
] as const satisfies readonly PreviewPlaceholder[];

/** The variant names {@link PLACEHOLDERS} covers, in the same order. */
const PLACEHOLDER_NAMES = [
  'Clipboard',
  'Shell',
  'Script',
  'Match'
] as const satisfies readonly PreviewPlaceholderName[];

/** Every `PreviewLimit` member, by hand. */
const LIMITS = ['OutputBytes', 'Segments', 'Work'] as const satisfies readonly PreviewLimit[];

export type _UnresolvedIsComplete = ExpectNever<Missing<PreviewUnresolved, typeof UNRESOLVED>>;
export type _PlaceholdersAreComplete = ExpectNever<
  Missing<PreviewPlaceholderName, typeof PLACEHOLDER_NAMES>
>;
export type _LimitsAreComplete = ExpectNever<Missing<PreviewLimit, typeof LIMITS>>;

/**
 * Every sentence the three accessors produce in one language.
 *
 * @param locale - The language to render in.
 * @returns One sentence per variant, in table order.
 */
function everySentence(locale: (typeof LOCALES)[number]): readonly string[] {
  return [
    ...UNRESOLVED.map((reason) => describePreviewUnresolved(locale, reason)),
    ...PLACEHOLDERS.map((placeholder) => describePreviewPlaceholder(locale, placeholder)),
    ...LIMITS.map((limit) => describePreviewLimit(locale, limit))
  ];
} // End of function everySentence()

describe('the preview accessors', () => {
  it('reach a key of their own namespace for every variant', () => {
    const keys = [
      ...UNRESOLVED.map(previewUnresolvedKey),
      ...PLACEHOLDER_NAMES.map(previewPlaceholderKey),
      ...LIMITS.map(previewLimitKey)
    ];
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(Object.keys(en)).toContain(key);
    }
    expect(PLACEHOLDERS.map((placeholder) => Object.keys(placeholder)[0])).toEqual([
      ...PLACEHOLDER_NAMES
    ]);
  }); // End of the "reach a key" case

  it('render a sentence in both languages, with no brace and no operand spliced in', () => {
    for (const locale of LOCALES) {
      const sentences = everySentence(locale);
      expect(sentences).toHaveLength(17 + 4 + 3);
      for (const sentence of sentences) {
        expect(sentence.trim().length, `${locale}: ${sentence}`).toBeGreaterThan(0);
        expect(sentence, `${locale}: ${sentence}`).not.toMatch(/[{}<>]/);
        expect(sentence, `${locale}: ${sentence}`).not.toContain('OPERAND');
      }
      for (const [index, name] of UNRESOLVED.entries()) {
        expect(sentences[index], `${locale}: ${name}`).not.toContain(name);
      }
    } // End of the loop over the two languages
  }); // End of the "render a sentence" case

  it('never claims how espanso expands a snippet, and never that this application runs or reads anything', () => {
    for (const sentence of everySentence('en')) {
      const lower = sentence.toLowerCase();
      expect(lower).not.toMatch(/espanso (will|does|evaluates|rejects|expands)/);
      expect(lower).not.toMatch(/this application (runs|reads|executes)/);
    }
    // The placeholder sentences say, in both languages, that nothing is run or read.
    expect(describePreviewPlaceholder('en', { Clipboard: {} })).toMatch(/never reads/);
    expect(describePreviewPlaceholder('en', { Shell: { command: null } })).toMatch(/does not run/);
    expect(describePreviewPlaceholder('es', { Clipboard: {} })).toMatch(/nunca lee/);
    expect(describePreviewPlaceholder('es', { Script: { args: null } })).toMatch(/no lo ejecuta/);
  }); // End of the "never claims" case
}); // End of the preview accessors suite
