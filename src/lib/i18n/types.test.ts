/**
 * Compile-time pins for the typed key union.
 *
 * Every `@ts-expect-error` below is an assertion that the line under it *does
 * not* type-check. TypeScript reports an unused `@ts-expect-error` as an error
 * of its own, so if the key union were ever loosened — widened to `string`,
 * say, or the exactness constraint on `es.json` dropped — `npm run check` fails
 * on these lines rather than passing silently. That is what makes the claim
 * "a missing key is a compile error" falsifiable instead of merely stated.
 *
 * The bodies also run under vitest, but the runtime assertions are incidental;
 * the type checker is the oracle here, and `npm run check` is where it speaks.
 */

import { describe, expect, it } from 'vitest';
import en from './en.json';
import { translate, type ExactDictionary, type TranslationKey } from './dictionaries';

describe('the translation key union', () => {
  it('rejects a key no dictionary defines', () => {
    // @ts-expect-error - 'shell.placeholder.nope' is not a key of en.json.
    const absent: TranslationKey = 'shell.placeholder.nope';
    expect(absent).toBe('shell.placeholder.nope');
  });

  it('rejects an arbitrary string passed to t()', () => {
    // @ts-expect-error - translate() takes a TranslationKey, never a string.
    const rendered = translate('en', 'not a key at all');
    expect(rendered).toBeUndefined();
  });

  it('accepts a key that does exist', () => {
    const present: TranslationKey = 'app.name';
    expect(translate('en', present)).toBe(en['app.name']);
  });
}); // End of the "translation key union" suite

describe('the exactness constraint on a translation file', () => {
  it('rejects a dictionary that is missing an English key', () => {
    const { 'app.tagline': _dropped, ...withoutTagline } = en;
    // @ts-expect-error - 'app.tagline' is missing from this dictionary.
    const incomplete: ExactDictionary<typeof withoutTagline> = withoutTagline;
    expect(Object.keys(incomplete)).not.toContain('app.tagline');
  });

  it('rejects a dictionary carrying a key English does not have', () => {
    const withSurplus = { ...en, 'shell.placeholder.surplus': 'unreachable' };
    // @ts-expect-error - 'shell.placeholder.surplus' is not a key of en.json.
    const overfull: ExactDictionary<typeof withSurplus> = withSurplus;
    expect(Object.keys(overfull)).toContain('shell.placeholder.surplus');
  });
}); // End of the "exactness constraint" suite
