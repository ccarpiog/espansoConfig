/**
 * The one place a number chooses between two dictionary keys.
 *
 * `"{count} snippets"` renders **"1 snippets"**, and the phase's own R32
 * reading had files with a count of 1 on screen. So a counted noun needs two
 * values per language, and something has to pick.
 *
 * ## Why `count === 1` is enough here, and where it would stop being enough
 *
 * English and Spanish share the same split: exactly one takes the singular,
 * everything else — including zero and every negative — takes the plural.
 * `Intl.PluralRules` would give the same two answers for both locales and cost a
 * dependency on the interface's number formatting, so it is not used. A third
 * language with a dual, a paucal or a zero form is the point at which this
 * function stops being sufficient, and the point at which it should be replaced
 * rather than extended: it is deliberately one function over a key **pair**, so
 * the replacement has one call site per counted noun and no key built by
 * concatenation anywhere.
 *
 * The keys themselves stay literal, so `TranslationKey` still checks them at
 * compile time and both parity tests in `dictionaries.test.ts` still cover them
 * — they iterate the English file, and these are ordinary keys in it.
 */

import { translate, type TranslationKey } from './dictionaries';
import type { Locale } from './locale';

/**
 * Picks the singular or the plural key for a count.
 *
 * @param one - The key whose value reads as a singular.
 * @param other - The key whose value reads as a plural.
 * @param count - The number that will be substituted into it.
 * @returns Whichever of the two keys the count calls for.
 */
export function pluralKey(one: TranslationKey, other: TranslationKey, count: number): TranslationKey {
  return count === 1 ? one : other;
} // End of function pluralKey()

/**
 * The key holding "N snippets" in the number the count calls for.
 *
 * @param count - How many snippets a sidebar row stands for.
 * @returns The singular or the plural key.
 */
export function snippetCountKey(count: number): TranslationKey {
  return pluralKey('browser.sidebar.snippetCount.one', 'browser.sidebar.snippetCount.other', count);
} // End of function snippetCountKey()

/**
 * The key holding the unmodelled-entry sentence, in the right number.
 *
 * The second counted noun in the interface, and the reason this module is a
 * *pair* selector rather than a one-off: adding one is two dictionary keys and
 * one function, and no call site builds a key.
 *
 * @param count - How many entries of a snippet the projection did not model.
 * @returns The singular or the plural key.
 */
export function unknownCountKey(count: number): TranslationKey {
  return pluralKey('browser.detail.unknownCount.one', 'browser.detail.unknownCount.other', count);
} // End of function unknownCountKey()

/**
 * The sentence the unmodelled-entry count reads as, in one language.
 *
 * @param locale - The dictionary to read from.
 * @param count - How many entries the projection did not model.
 * @returns The translated sentence, with the count substituted.
 */
export function describeUnknownCount(locale: Locale, count: number): string {
  return translate(locale, unknownCountKey(count), { count });
} // End of function describeUnknownCount()

/**
 * The sentence "N snippets" reads as, in one language.
 *
 * @param locale - The dictionary to read from.
 * @param count - How many snippets a sidebar row stands for.
 * @returns The translated phrase, with the count substituted.
 */
export function describeSnippetCount(locale: Locale, count: number): string {
  return translate(locale, snippetCountKey(count), { count });
} // End of function describeSnippetCount()
