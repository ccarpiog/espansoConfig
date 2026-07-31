/**
 * Every selection notice has a sentence, in both languages.
 *
 * The compile-time half is `selectionNoticeKey`'s return type: a key that
 * `en.json` does not hold is a type error there. What that cannot see is a key
 * that exists in English and was never translated — `ExactDictionary` catches a
 * *missing* Spanish key — and what neither can see is the two keys being
 * swapped. So this file pins three things the type system has no opinion about:
 * which key each notice maps to, that the four sentences read as sentences, and
 * that each one differs from its English twin and from the other notices.
 *
 * The 1c-1 review is why the last two are checked rather than assumed. `"x"`
 * satisfied "has a non-blank sentence", and "say different things in the two
 * languages" compared English with English.
 */

import { describe, expect, it } from 'vitest';
import { DICTIONARIES } from '../i18n/dictionaries';
import { LOCALES } from '../i18n/locale';
import { selectionNoticeKey, type SelectionNotice } from './notices';

/** Every notice the browser can raise. */
const NOTICES: readonly SelectionNotice[] = ['kept', 'differentMatch', 'gone', 'unresolved'];

/** The key each notice must map to, written out rather than derived. */
const EXPECTED_KEYS: ReadonlyMap<SelectionNotice, string> = new Map([
  ['kept', 'browser.notice.kept'],
  ['differentMatch', 'browser.notice.differentMatch'],
  ['gone', 'browser.notice.gone'],
  ['unresolved', 'browser.notice.unresolved']
] as const);

describe('selection notices', () => {
  it('map to the key that names them, so two cannot be swapped', () => {
    // The failure this catches: swapping two literals in `selectionNoticeKey`
    // still compiles, keeps all four keys present and distinct, and tells the
    // user their snippet was found when it was deleted.
    for (const notice of NOTICES) {
      expect(selectionNoticeKey(notice), notice).toBe(EXPECTED_KEYS.get(notice));
    }
  });

  it.each(LOCALES)('all read as a sentence in %s', (locale) => {
    for (const notice of NOTICES) {
      const value = DICTIONARIES[locale][selectionNoticeKey(notice)];
      expect(value, `${locale}:${notice}`).toBeTypeOf('string');
      // A sentence, not merely a non-blank string: several words, and a full
      // stop at the end. `"x"` passed the check this replaces.
      expect(value.trim().split(/\s+/u).length, `${locale}:${notice}`).toBeGreaterThan(4);
      expect(value.trim().endsWith('.'), `${locale}:${notice}`).toBe(true);
    }
  });

  it('have four distinct keys, so no two notices read the same', () => {
    const keys = new Set(NOTICES.map(selectionNoticeKey));
    expect(keys.size).toBe(NOTICES.length);
  });

  it('are translated, and keep differentMatch distinct from gone in both languages', () => {
    for (const notice of NOTICES) {
      const key = selectionNoticeKey(notice);
      // English against Spanish, which is the comparison the name promises and
      // the one the old body never made.
      expect(DICTIONARIES.es[key], notice).not.toBe(DICTIONARIES.en[key]);
    }
    // `differentMatch` and `gone` are the pair a user must not confuse: one
    // means the selection moved to something else, the other that it vanished.
    for (const locale of LOCALES) {
      expect(DICTIONARIES[locale][selectionNoticeKey('differentMatch')]).not.toBe(
        DICTIONARIES[locale][selectionNoticeKey('gone')]
      );
    }
  });
}); // End of the "selection notices" suite
