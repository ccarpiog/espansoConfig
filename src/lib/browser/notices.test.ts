/**
 * Every selection notice has a sentence, in both languages.
 *
 * The compile-time half is `selectionNoticeKey`'s return type: a key that
 * `en.json` does not hold is a type error there. What that cannot see is a key
 * that exists in English and was never translated — `ExactDictionary` catches a
 * *missing* Spanish key — and what neither can see is the two keys being
 * swapped. So this file pins three things the type system has no opinion about:
 * which key each notice maps to, that every sentence reads as a sentence, and
 * that each one differs from its English twin and from the other notices.
 *
 * **The list below is hand-maintained and a new arm has to be added to it**, which
 * 2c-3a's `deleted`, 2c-3b's `keptAfterMove` and `displacedByMove`, and
 * 2c-3c-2's `keptAfterDuplicate` and `displacedByDuplicate` were: the
 * `switch` in `selectionNoticeKey` is exhaustive and catches a *missing key*,
 * and nothing catches a notice this file forgets to walk.
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
const NOTICES: readonly SelectionNotice[] = [
  'kept',
  'differentMatch',
  'gone',
  'unresolved',
  'deleted',
  'keptAfterMove',
  'displacedByMove',
  'keptAfterDuplicate',
  'displacedByDuplicate'
];

/** The key each notice must map to, written out rather than derived. */
const EXPECTED_KEYS: ReadonlyMap<SelectionNotice, string> = new Map([
  ['kept', 'browser.notice.kept'],
  ['differentMatch', 'browser.notice.differentMatch'],
  ['gone', 'browser.notice.gone'],
  ['unresolved', 'browser.notice.unresolved'],
  ['deleted', 'browser.notice.deleted'],
  ['keptAfterMove', 'browser.notice.keptAfterMove'],
  ['displacedByMove', 'browser.notice.displacedByMove'],
  ['keptAfterDuplicate', 'browser.notice.keptAfterDuplicate'],
  ['displacedByDuplicate', 'browser.notice.displacedByDuplicate']
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

  it('have one distinct key each, so no two notices read the same', () => {
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
    // `differentMatch` and `gone` are the pair a user must not confuse, and
    // **neither of them means what this comment used to say they meant**
    // (2c-4b-3c-2 §11.3): `differentMatch` is *the bytes at the held position
    // are not the bytes that were selected*, which the same snippet edited in
    // place by another program satisfies, and `gone` is *the selection cannot be
    // pointed at any more*, which an external deletion of an **earlier** snippet
    // satisfies while the snippet itself is still in the file. What is checked
    // below is that the two sentences are not the same string. **No test in this
    // repository can fail because one of them claims more than that** — the i18n
    // suites check parity and placeholders, never meaning.
    for (const locale of LOCALES) {
      expect(DICTIONARIES[locale][selectionNoticeKey('differentMatch')]).not.toBe(
        DICTIONARIES[locale][selectionNoticeKey('gone')]
      );
    }
  });

  it('attribute an asked-for move distinctly from an external change, in both languages', () => {
    // The two 2c-3b arms exist precisely because their external twins
    // misattribute a committed move to the disk
    // (`docs/decisions/2c-3b-2-window-reading.md` section 7.1). A pair whose
    // sentences read the same would carry the new arm and keep the false alarm.
    for (const locale of LOCALES) {
      expect(DICTIONARIES[locale][selectionNoticeKey('keptAfterMove')], locale).not.toBe(
        DICTIONARIES[locale][selectionNoticeKey('kept')]
      );
      expect(DICTIONARIES[locale][selectionNoticeKey('displacedByMove')], locale).not.toBe(
        DICTIONARIES[locale][selectionNoticeKey('differentMatch')]
      );
    } // End of the loop over the two locales
  });

  it('attribute an asked-for duplicate distinctly from a move and from the disk, in both languages', () => {
    // The 2c-3c-2 arms exist for the same reason the move's do, plus one more:
    // reusing the move's sentences would claim the person's duplicate
    // *reordered* the file, which an insertion did not do. So each duplicate
    // arm must differ from its external twin **and** from its move twin.
    for (const locale of LOCALES) {
      expect(DICTIONARIES[locale][selectionNoticeKey('keptAfterDuplicate')], locale).not.toBe(
        DICTIONARIES[locale][selectionNoticeKey('kept')]
      );
      expect(DICTIONARIES[locale][selectionNoticeKey('keptAfterDuplicate')], locale).not.toBe(
        DICTIONARIES[locale][selectionNoticeKey('keptAfterMove')]
      );
      expect(DICTIONARIES[locale][selectionNoticeKey('displacedByDuplicate')], locale).not.toBe(
        DICTIONARIES[locale][selectionNoticeKey('differentMatch')]
      );
      expect(DICTIONARIES[locale][selectionNoticeKey('displacedByDuplicate')], locale).not.toBe(
        DICTIONARIES[locale][selectionNoticeKey('displacedByMove')]
      );
    } // End of the loop over the two locales
  });
}); // End of the "selection notices" suite
