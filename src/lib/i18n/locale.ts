/**
 * Locale identity and negotiation.
 *
 * Deliberately free of runes, of the DOM and of storage: everything here is a
 * pure function of its arguments, so the policy can be tested without a
 * browser. The reactive half lives in `src/lib/stores/locale.svelte.ts`.
 */

/** Every language the interface ships in (CLAUDE.md section 2 — both, from day one). */
export const LOCALES = ['en', 'es'] as const;

/** A language the interface ships in. */
export type Locale = (typeof LOCALES)[number];

/**
 * The locale used when nothing else can be determined.
 *
 * English rather than Spanish only because the English dictionary is the one
 * the key union is derived from, so it is the file guaranteed to be complete.
 */
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * Narrows an arbitrary string to a supported {@link Locale}.
 *
 * @param value - Any string, including one read back from persisted storage.
 * @returns `true` when `value` is exactly a supported locale tag.
 */
export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
} // End of function isLocale()

/**
 * Reduces one BCP-47 language tag to a supported locale.
 *
 * Only the primary subtag is considered, so `es-419`, `es-MX` and `es` all
 * resolve to `es`. Regional variants are not distinguished because the
 * dictionaries do not distinguish them; pretending otherwise would promise a
 * `es-MX` translation that does not exist.
 *
 * @param tag - A BCP-47 language tag, e.g. `en-GB`.
 * @returns The matching locale, or `null` when the language is not supported.
 */
export function matchLocaleTag(tag: string): Locale | null {
  const primary = tag.trim().toLowerCase().split(/[-_]/)[0];
  return isLocale(primary) ? primary : null;
} // End of function matchLocaleTag()

/**
 * Picks the interface locale from the ordered list the platform reports.
 *
 * The list is the system preference order (`navigator.languages` in a webview),
 * so the first entry this app can actually serve wins. A user whose macOS
 * language order is `fr, es, en` gets Spanish, which is the behaviour plan
 * section 9 asks for and is not what taking only `navigator.language` would
 * give.
 *
 * @param tags - Language tags in descending order of user preference.
 * @returns The best supported locale, falling back to {@link DEFAULT_LOCALE}.
 */
export function negotiateLocale(tags: readonly string[]): Locale {
  for (const tag of tags) {
    const matched = matchLocaleTag(tag);
    if (matched !== null) {
      return matched;
    }
  }
  return DEFAULT_LOCALE;
} // End of function negotiateLocale()
