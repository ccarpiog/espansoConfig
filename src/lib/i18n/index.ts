/**
 * The single entry point every component uses to produce user-facing text.
 *
 * Import `t` from here and nothing else: reading a dictionary directly, or
 * writing a literal into markup, is the one habit CLAUDE.md section 2 forbids.
 */

import { locale } from '../stores/locale.svelte';
import { translate, type TranslationKey, type TranslationParams } from './dictionaries';

export { DICTIONARIES, placeholdersOf, translate } from './dictionaries';
export type { TranslationKey, TranslationParams } from './dictionaries';
export { DEFAULT_LOCALE, LOCALES, isLocale, matchLocaleTag, negotiateLocale } from './locale';
export type { Locale } from './locale';

/**
 * Translates a key into the language the interface is currently showing.
 *
 * Reading `locale.current` inside this function is what makes it reactive: a
 * Svelte 5 template that calls `t(...)` records the read, so changing the
 * language re-renders every string on screen without a page reload and without
 * any component subscribing to anything.
 *
 * @param key - A key of the English dictionary; anything else is a type error.
 * @param params - Substitutions for the value's `{placeholder}` tokens.
 * @returns The translated string.
 */
export function t(key: TranslationKey, params?: TranslationParams): string {
  return translate(locale.current, key, params);
} // End of function t()

/**
 * The dictionary key naming a locale in its own language.
 *
 * Kept as a function rather than a lookup table so that adding a locale without
 * adding its name is a compile error rather than an undefined at runtime.
 *
 * @param value - The locale to name.
 * @returns The translation key holding that locale's endonym.
 */
export function localeNameKey(value: 'en' | 'es'): TranslationKey {
  return value === 'en' ? 'language.english' : 'language.spanish';
} // End of function localeNameKey()
