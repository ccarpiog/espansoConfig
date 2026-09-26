/**
 * Runtime checks on the variable-analysis accessors — Phase 4-8.
 *
 * The compile-time half is in `codes.ts` (every key builder returns a
 * `TranslationKey` over the enum's own union) and in
 * `src-tauri/src/dictionary_contract.rs` (both dictionaries against the
 * `IncompleteReason`, `Injection`, `EdgeKind` and `MalformedPlaceholder`
 * declarations, in both directions). What is left here is that calling each
 * accessor produces a sentence in both languages, that no placeholder brace
 * survives, that no sentence prints a position, and that none claims to know how
 * espanso evaluates anything (Phase 4 rulings 12, 13 and 16).
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers in this file do.
 */

import { describe, expect, it } from 'vitest';
import {
  describeEdgeKind,
  describeIncompleteReason,
  describeInjection,
  describeMalformedPlaceholder,
  edgeKindKey,
  incompleteReasonKey,
  injectionKey,
  malformedPlaceholderKey
} from './codes';
import { LOCALES } from './locale';
import type { ExpectNever, Missing } from './exhaustive';
import en from './en.json';
import type {
  EdgeKind,
  IncompleteReason,
  IncompleteReasonName,
  Injection,
  MalformedPlaceholder
} from '../ipc/types';

/** One value of every `IncompleteReason` variant, in declaration order, by hand. */
const REASONS = [
  { ImportsOpenScope: {} },
  { GlobalVarsUnreadable: {} },
  { LocalVarsUnreadable: {} },
  { RegexCapturesUnknown: {} },
  { DuplicateDeclaration: { declarations: [0, 3] } },
  { NameUnreadable: { declaration: 7 } },
  { LocalNameUnreadable: { declaration: 7 } },
  { GlobalNameUnreadable: { declaration: 7 } },
  { DependsOnUnreadable: { declaration: 7 } },
  { ParamsUnreadable: { declaration: 7 } },
  { InjectionUncertain: { declaration: 7 } },
  { LayoutUnavailable: { form: { Variable: { index: 7 } } } },
  { LayoutUnsupported: { form: { Shorthand: {} } } }
] as const satisfies readonly IncompleteReason[];

/** The variant names {@link REASONS} covers, in the same order. */
const REASON_NAMES = [
  'ImportsOpenScope',
  'GlobalVarsUnreadable',
  'LocalVarsUnreadable',
  'RegexCapturesUnknown',
  'DuplicateDeclaration',
  'NameUnreadable',
  'LocalNameUnreadable',
  'GlobalNameUnreadable',
  'DependsOnUnreadable',
  'ParamsUnreadable',
  'InjectionUncertain',
  'LayoutUnavailable',
  'LayoutUnsupported'
] as const satisfies readonly IncompleteReasonName[];

/** Every `Injection` member, by hand. */
const INJECTIONS = ['Enabled', 'Disabled', 'Uncertain'] as const satisfies readonly Injection[];

/** Every `EdgeKind` member, by hand. */
const EDGE_KINDS = ['Explicit', 'Inferred'] as const satisfies readonly EdgeKind[];

/** Every `MalformedPlaceholder` member, by hand. */
const MALFORMED = [
  'Empty',
  'InvalidIdentifier',
  'Unterminated'
] as const satisfies readonly MalformedPlaceholder[];

export type _ReasonsAreComplete = ExpectNever<Missing<IncompleteReasonName, typeof REASON_NAMES>>;
export type _InjectionsAreComplete = ExpectNever<Missing<Injection, typeof INJECTIONS>>;
export type _EdgeKindsAreComplete = ExpectNever<Missing<EdgeKind, typeof EDGE_KINDS>>;
export type _MalformedAreComplete = ExpectNever<
  Missing<MalformedPlaceholder, typeof MALFORMED>
>;

/**
 * Every sentence the four accessors produce in one language.
 *
 * @param locale - The language to render in.
 * @returns One sentence per variant, in table order.
 */
function everySentence(locale: (typeof LOCALES)[number]): readonly string[] {
  return [
    ...REASONS.map((reason) => describeIncompleteReason(locale, reason)),
    ...INJECTIONS.map((injection) => describeInjection(locale, injection)),
    ...EDGE_KINDS.map((kind) => describeEdgeKind(locale, kind)),
    ...MALFORMED.map((reason) => describeMalformedPlaceholder(locale, reason))
  ];
} // End of function everySentence()

describe('the variable-analysis accessors', () => {
  it('reach a key of their own namespace for every variant', () => {
    const keys = [
      ...REASON_NAMES.map(incompleteReasonKey),
      ...INJECTIONS.map(injectionKey),
      ...EDGE_KINDS.map(edgeKindKey),
      ...MALFORMED.map(malformedPlaceholderKey)
    ];
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(Object.keys(en)).toContain(key);
    }
    expect(REASONS.map((reason) => Object.keys(reason)[0])).toEqual([...REASON_NAMES]);
  }); // End of the "reach a key" case

  it('render a sentence in both languages, with no brace and no position printed', () => {
    for (const locale of LOCALES) {
      const sentences = everySentence(locale);
      expect(sentences).toHaveLength(13 + 3 + 2 + 3);
      for (const sentence of sentences) {
        expect(sentence.trim().length, `${locale}: ${sentence}`).toBeGreaterThan(0);
        expect(sentence, `${locale}: ${sentence}`).not.toMatch(/[{}]/);
        // The operands are positions (7, 0, 3 above); none may reach the text.
        expect(sentence, `${locale}: ${sentence}`).not.toMatch(/\d/);
      }
      for (const [index, name] of REASON_NAMES.entries()) {
        expect(sentences[index], `${locale}: ${name}`).not.toContain(name);
      }
    } // End of the loop over the two languages
  }); // End of the "render a sentence" case

  it('never claims how espanso evaluates a variable', () => {
    for (const sentence of everySentence('en')) {
      expect(sentence.toLowerCase()).not.toMatch(/espanso (will|does|evaluates|rejects)/);
      expect(sentence.toLowerCase()).not.toContain('has no effect');
    }
  }); // End of the "never claims" case
}); // End of the variable-analysis accessors suite
