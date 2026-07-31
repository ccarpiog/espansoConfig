/**
 * The translation dictionaries, and the type machinery that keeps them in step.
 *
 * The English file is the schema. `TranslationKey` is derived from its shape,
 * so `t('nope')` is a compile error, and `es.json` is bound to a type that is
 * unsatisfiable unless its key set is *exactly* the English one — a missing key
 * and a surplus key both fail `tsc`. Neither check needs a hand-maintained list
 * of keys, so neither can drift out of date the way a list would.
 *
 * What the types cannot see is covered by `dictionaries.test.ts`: that no
 * Spanish value is byte-identical to its English one outside an audited
 * exception list, and that the `{placeholder}` sets agree. Note the exact
 * shape of the first claim — it is an *untranslated-value heuristic*, not a
 * proof that a value is Spanish. `"Sprache"` passes it.
 */

import en from './en.json';
import es from './es.json';
import type { Locale } from './locale';

/**
 * Every key the interface may ask for.
 *
 * Derived from `en.json`, which makes the English file the single source of
 * truth for the key set rather than a separate declaration that could disagree
 * with it.
 */
export type TranslationKey = keyof typeof en;

/**
 * A dictionary whose key set is exactly {@link TranslationKey}.
 *
 * The first half demands every English key. The second half maps any *extra*
 * key of `T` to `never`, which nothing of type `string` satisfies — so a key
 * that exists only in the translation is rejected too. Plain
 * `Record<TranslationKey, string>` would have caught only the first direction,
 * because excess-property checking does not apply to a non-literal assignment.
 */
export type ExactDictionary<T> = Record<TranslationKey, string> &
  Record<Exclude<keyof T, TranslationKey>, never>;

/**
 * The Spanish dictionary, bound to the exactness constraint.
 *
 * This binding is the enforcement point: deleting a line from `es.json`, or
 * adding one that `en.json` lacks, breaks `npm run check` here.
 */
const spanish: ExactDictionary<typeof es> = es;

/** Every dictionary, keyed by locale. */
export const DICTIONARIES: Readonly<Record<Locale, Readonly<Record<TranslationKey, string>>>> = {
  en,
  es: spanish
};

/** Values that may be substituted into a `{placeholder}`. */
export type TranslationParams = Readonly<Record<string, string | number>>;

/** Matches a `{placeholder}` token in a translation value. */
const PLACEHOLDER_PATTERN = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;

/**
 * Looks a key up in one locale and substitutes its `{placeholder}` tokens.
 *
 * A placeholder with no matching entry in `params` is left in the output
 * verbatim. That is deliberate: a visible `{language}` in the interface is a
 * bug report, whereas silently substituting an empty string produces a sentence
 * that reads as finished and is wrong.
 *
 * @param locale - The dictionary to read from.
 * @param key - A key of the English dictionary; anything else is a type error.
 * @param params - Substitutions for the value's `{placeholder}` tokens.
 * @returns The translated string.
 */
export function translate(
  locale: Locale,
  key: TranslationKey,
  params?: TranslationParams
): string {
  const value = DICTIONARIES[locale][key];
  if (params === undefined) {
    return value;
  }
  return value.replace(PLACEHOLDER_PATTERN, (token, name: string) =>
    // `Object.prototype.hasOwnProperty.call` rather than `Object.hasOwn`: the
    // latter needs Safari 15.4, and this is the one function that runs before
    // anything exists to report an error in. See `1b-1-notes.md` section 11,
    // finding 1 — the WebKit floor is declared in two places and this call
    // should not be the thing that decides whether they were right.
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : token
  );
} // End of function translate()

/**
 * Collects the `{placeholder}` names used by a translation value.
 *
 * Exported for `dictionaries.test.ts`, which asserts that the two locales agree
 * on them — a translator who drops `{language}` from a Spanish sentence
 * produces a string that type-checks and renders, and only this can see it.
 *
 * @param value - A raw dictionary value.
 * @returns The placeholder names, in the order they appear, without duplicates.
 */
export function placeholdersOf(value: string): string[] {
  const found = new Set<string>();
  for (const match of value.matchAll(PLACEHOLDER_PATTERN)) {
    const name = match[1];
    if (name !== undefined) {
      found.add(name);
    }
  }
  return [...found];
} // End of function placeholdersOf()
