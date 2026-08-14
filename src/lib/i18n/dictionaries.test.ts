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

/**
 * The seven keys that name the revision a conflicted save was drafted from.
 *
 * One per panel that draws a conflict of its own — the six write surfaces and, since
 * 2c-4c-3a, the recovery panel — drawn as the first of three revision lines on that
 * panel, a few lines under `browser.saveOutcome.nothingWasWritten`, which is the
 * panel's whole reason for existing. The list is asserted below to be **exactly**
 * the family, so an eighth line cannot join the dictionary without joining the
 * check.
 */
const REVISION_EXPECTED_KEYS = [
  'browser.rawEditor.revisionExpected',
  'browser.matchEditor.revisionExpected',
  'browser.matchCreation.revisionExpected',
  'browser.matchDeletion.revisionExpected',
  'browser.matchMove.revisionExpected',
  'browser.matchDuplication.revisionExpected',
  // The seventh, added at 2c-4c-3a: the recovery panel's own create is a save
  // like any other, so its conflict draws the same three revision lines under the
  // same *nothing was written* sentence — and the check below is exactly what that
  // comment above predicted would have to grow with it.
  'browser.recovery.revisionExpected',
  // The eighth, added at 2c-5-4b: the restore pane's conflict draws the same
  // three lines, and this check failed on the commit that added the key — which is
  // the guard doing exactly what the paragraph above said it would.
  'browser.restore.revisionExpected'
] as const satisfies readonly TranslationKey[];

/**
 * Words that claim, in one locale, that something **was written**.
 *
 * Deliberately a small list of the exact forms this project's own *nothing was
 * written* sentence uses, and not an attempt at a lexicon. What makes it evidence
 * rather than decoration is the second case below: a list that had been typo'd
 * into matching nothing would fail there.
 */
const CLAIMS_A_WRITE: Readonly<Record<(typeof LOCALES)[number], readonly string[]>> = {
  en: ['written', 'wrote', 'writes', 'saved'],
  es: ['escrito', 'escrita', 'escribió', 'escribe', 'guardado', 'guardó']
};

describe('the conflict panel does not say the file was written (2c-4a-3c, finding 10.1)', () => {
  /*
   * **The one check `CLAUDE.md` section 6 says these suites cannot give — narrowed
   * until it can.** The window reading found `browser.matchCreation.revisionExpected`
   * reading *"Este fragmento **se ha escrito** sobre la versión {revision}"* four
   * lines under *"No se ha escrito nada"*: a false claim about whether the person's
   * file had been written, on the one panel whose entire job is to make that
   * unambiguous. Nothing failed, because parity and placeholder agreement were both
   * intact and no suite in this repository pins meaning.
   *
   * This does not pin meaning either, and saying so is the point. It pins one
   * property of one family of sentences: **a line that names the revision a draft
   * was made from may not use the vocabulary of writing to a file**, because the
   * same panel says a few lines above that nothing was written. That is the exact
   * defect, stated as an invariant rather than as a sentence. What it cannot say is
   * whether the replacement verb is the right one, whether it is grammatical, or
   * whether it is even Spanish — the honest limit `dictionaries.test.ts`'s own
   * header states for the identity heuristic, and it is the same limit here.
   */
  it('covers every key of that family, so a seventh surface cannot escape it', () => {
    const family = englishKeys.filter((key) => key.endsWith('.revisionExpected'));
    expect([...family].sort()).toEqual([...REVISION_EXPECTED_KEYS].sort());
  });

  it('never uses a verb of writing, in either locale', () => {
    for (const locale of LOCALES) {
      for (const key of REVISION_EXPECTED_KEYS) {
        const value = DICTIONARIES[locale][key].toLowerCase();
        const claimed = CLAIMS_A_WRITE[locale].filter((word) => value.includes(word));
        expect(claimed, `${locale}:${key}`).toEqual([]);
      } // End of the loop over the six revision-expected keys
    } // End of the loop over the two locales
  });

  it('keeps that word list capable of firing', () => {
    // The panel's own *nothing was written* line is the control: if none of a
    // locale's listed words appears in it, the list matches nothing and the case
    // above passes for a reason that has nothing to do with the dictionary.
    for (const locale of LOCALES) {
      const written = DICTIONARIES[locale]['browser.saveOutcome.nothingWasWritten'].toLowerCase();
      const found = CLAIMS_A_WRITE[locale].filter((word) => written.includes(word));
      expect(found.length, locale).toBeGreaterThan(0);
    } // End of the loop over the two locales
  });
}); // End of the "conflict panel does not say the file was written" suite

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
