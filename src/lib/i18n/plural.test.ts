/**
 * The singular/plural selection, in both languages.
 *
 * `"{count} snippets"` was the only value of `browser.sidebar.snippetCount`,
 * and a file holding one snippet is the ordinary case rather than the edge one:
 * the phase's own R32 reading has "1" beside two rows, which read **"1
 * snippets"** and **"1 fragmentos"** in the tooltip. So there are two keys per
 * language now, and this file pins which one a count picks.
 *
 * The key-set and placeholder-parity checks in `dictionaries.test.ts` still
 * cover both keys without being told about them: they iterate the English file,
 * and these are ordinary keys in it.
 */

import { describe, expect, it } from 'vitest';
import { describeSnippetCount, pluralKey, snippetCountKey } from './plural';
import { LOCALES } from './locale';

describe('the key a count picks', () => {
  it('is the singular for exactly one', () => {
    expect(snippetCountKey(1)).toBe('browser.sidebar.snippetCount.one');
  });

  it('is the plural for zero, for two, and for everything else', () => {
    for (const count of [0, 2, 3, 11, 100]) {
      expect(snippetCountKey(count), `${count}`).toBe('browser.sidebar.snippetCount.other');
    }
  });

  it('reads the count rather than its truthiness', () => {
    // `count ? one : other` would answer the plural for 1 and the singular for
    // 0, which is both errors at once.
    expect(pluralKey('app.name', 'app.tagline', 1)).toBe('app.name');
    expect(pluralKey('app.name', 'app.tagline', 0)).toBe('app.tagline');
  });
}); // End of the "key a count picks" suite

describe('the sentence a count renders as', () => {
  it('is singular for one in both languages', () => {
    expect(describeSnippetCount('en', 1)).toBe('1 snippet');
    expect(describeSnippetCount('es', 1)).toBe('1 fragmento');
  });

  it('is plural for zero and for more than one in both languages', () => {
    expect(describeSnippetCount('en', 0)).toBe('0 snippets');
    expect(describeSnippetCount('en', 7)).toBe('7 snippets');
    expect(describeSnippetCount('es', 0)).toBe('0 fragmentos');
    expect(describeSnippetCount('es', 7)).toBe('7 fragmentos');
  });

  it.each(LOCALES)('substitutes the number in %s, leaving no placeholder behind', (locale) => {
    for (const count of [0, 1, 42]) {
      const value = describeSnippetCount(locale, count);
      expect(value, `${locale}:${count}`).toContain(String(count));
      expect(value, `${locale}:${count}`).not.toContain('{count}');
    }
  });
}); // End of the "sentence a count renders as" suite
