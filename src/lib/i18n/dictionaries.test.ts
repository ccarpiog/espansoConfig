/**
 * Runtime checks on the two dictionaries.
 *
 * These cover some of what the type system cannot: whether a Spanish value was
 * left byte-identical to its English one, and whether the two locales agree on
 * their `{placeholder}` tokens. Key-set agreement is enforced at compile time
 * by `ExactDictionary` in `dictionaries.ts`; it is *also* asserted here, from
 * the files rather than from a list, because a compile-time check that has been
 * accidentally loosened leaves no trace and this one would notice.
 *
 * **What the identity check is, precisely.** It is an *untranslated-value
 * heuristic*: it fires when a translator copied the English string instead of
 * translating it. It says nothing about whether the result is Spanish, and
 * cannot — setting `es.json`'s `language.label` to `"Sprache"` satisfies every
 * assertion in this file. Nothing automatable in this repository establishes
 * that a value is in the language its file claims; that needs a bilingual
 * reviewer, and saying otherwise would be exactly the over-claimed oracle this
 * project calls R24.
 */

import { describe, expect, it } from 'vitest';
import en from './en.json';
import es from './es.json';
import { DICTIONARIES, placeholdersOf, translate, type TranslationKey } from './dictionaries';
import { LOCALES } from './locale';

/**
 * Keys whose Spanish value is *correctly* identical to the English one.
 *
 * Every entry needs a reason, and the reason has to survive being read aloud.
 * The set is asserted in both directions below: a key here whose values have
 * since diverged fails just as loudly as an untranslated key that is missing
 * from it, so the list cannot quietly rot into a suppression list.
 */
const IDENTICAL_BY_DESIGN: ReadonlyMap<TranslationKey, string> = new Map([
  ['app.name', 'the product name, a proper noun'],
  ['language.english', 'an endonym: a language is offered under its own name'],
  ['language.spanish', 'an endonym: a language is offered under its own name'],
  ['browser.detail.section.variables', 'the same word, spelled the same way, in both languages'],
  ['code.matchBadge.html', 'the name of a markup format, an acronym in both languages'],
  ['code.matchBadge.markdown', 'the name of a markup format, a proper noun in both languages'],
  ['code.matchBadge.variables', 'the same word, spelled the same way, in both languages'],
  ['code.matchBadge.shell', 'espanso’s own term for the variable type, kept untranslated in Spanish technical usage'],
  ['code.matchBadge.script', 'the ordinary Spanish word for this is the same loanword']
] as const);

const englishKeys = Object.keys(en) as TranslationKey[];
const spanishKeys = Object.keys(es) as TranslationKey[];

describe('key sets', () => {
  it('are exactly equal, read from the files', () => {
    expect([...spanishKeys].sort()).toEqual([...englishKeys].sort());
  });

  it('are not empty, so an empty-file bug cannot pass the check above', () => {
    expect(englishKeys.length).toBeGreaterThan(0);
  });
}); // End of the "key sets" suite

describe('every value', () => {
  it.each(LOCALES)('in %s is a non-blank, untrimmed-free string', (locale) => {
    for (const key of englishKeys) {
      const value = DICTIONARIES[locale][key];
      expect(typeof value, `${locale}:${key}`).toBe('string');
      expect(value.trim(), `${locale}:${key}`).not.toBe('');
      expect(value, `${locale}:${key}`).toBe(value.trim());
    }
  });
}); // End of the "every value" suite

describe('the untranslated-value heuristic (identity only, never "is it Spanish")', () => {
  it('fires when a Spanish value was left byte-identical to its English one', () => {
    const untranslated = englishKeys.filter(
      (key) => es[key] === en[key] && !IDENTICAL_BY_DESIGN.has(key)
    );
    expect(untranslated).toEqual([]);
  });

  it('keeps the exception list honest: every listed key really is identical', () => {
    const stale = [...IDENTICAL_BY_DESIGN.keys()].filter((key) => es[key] !== en[key]);
    expect(stale).toEqual([]);
  });

  it('keeps the exception list a list of real keys', () => {
    const unknown = [...IDENTICAL_BY_DESIGN.keys()].filter((key) => !englishKeys.includes(key));
    expect(unknown).toEqual([]);
  });
}); // End of the untranslated-value heuristic suite

describe('placeholders', () => {
  it('agree between the two locales', () => {
    for (const key of englishKeys) {
      expect(placeholdersOf(es[key]).sort(), key).toEqual(placeholdersOf(en[key]).sort());
    }
  });

  it('are substituted when a value is given', () => {
    expect(translate('en', 'language.active', { language: 'English' })).toContain('English');
    expect(translate('es', 'language.active', { language: 'Español' })).toContain('Español');
  });

  it('survive verbatim when no value is given, so the gap is visible', () => {
    expect(translate('en', 'language.active')).toContain('{language}');
    expect(translate('en', 'language.active', {})).toContain('{language}');
  });

  it('leave a value with no placeholders untouched', () => {
    expect(translate('en', 'app.name', { language: 'ignored' })).toBe(en['app.name']);
  });
}); // End of the "placeholders" suite
