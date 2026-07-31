/**
 * Locale negotiation policy.
 *
 * The interesting case is the third one: a user whose macOS language order is
 * French, then Spanish, then English gets Spanish. Taking only the head of the
 * list — the obvious implementation — would hand them English.
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, isLocale, matchLocaleTag, negotiateLocale } from './locale';

describe('matchLocaleTag()', () => {
  it('reduces a regional tag to its primary subtag', () => {
    expect(matchLocaleTag('es-419')).toBe('es');
    expect(matchLocaleTag('es-MX')).toBe('es');
    expect(matchLocaleTag('en-GB')).toBe('en');
    expect(matchLocaleTag('en_US')).toBe('en');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(matchLocaleTag('  ES  ')).toBe('es');
  });

  it('refuses a language the app does not ship', () => {
    expect(matchLocaleTag('fr-FR')).toBeNull();
    expect(matchLocaleTag('')).toBeNull();
    expect(matchLocaleTag('espanol')).toBeNull();
  });
}); // End of the "matchLocaleTag()" suite

describe('negotiateLocale()', () => {
  it('takes the first tag it can actually serve, not the first tag', () => {
    expect(negotiateLocale(['fr-FR', 'es-ES', 'en-US'])).toBe('es');
  });

  it('honours preference order between two supported languages', () => {
    expect(negotiateLocale(['es', 'en'])).toBe('es');
    expect(negotiateLocale(['en', 'es'])).toBe('en');
  });

  it('falls back to the default when nothing matches', () => {
    expect(negotiateLocale(['fr', 'de', 'ja'])).toBe(DEFAULT_LOCALE);
    expect(negotiateLocale([])).toBe(DEFAULT_LOCALE);
  });
}); // End of the "negotiateLocale()" suite

describe('isLocale()', () => {
  it('accepts only exact supported tags', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('es')).toBe(true);
    expect(isLocale('es-ES')).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(7)).toBe(false);
  });
}); // End of the "isLocale()" suite
