/**
 * Runtime checks on the restore pane's own accessor — Phase 2c-5-4b.
 *
 * The compile-time half is `restoreRefusalKey` and `openWriteSurfaceKey` in
 * `../browser/restore`: both are `switch`es over literal keys whose return type
 * is `TranslationKey`, so a renamed key is a compile error there and a new member
 * of either union with no sentence is one too. What is left for this file is what
 * no compiler can see — that every arm names an entry both dictionaries really
 * hold, that calling the accessor produces a sentence, and that no sentence in
 * this family claims something a backup catalogue never established.
 *
 * `backupCodes.test.ts` is the precedent for all three, and this file follows it
 * including its honesty about the limit: **nothing here checks meaning.** The
 * claim scans below pin one property of one family of sentences — that a listed
 * vocabulary does not appear — and each is paired with a control proving the
 * vocabulary can match something. Whether a Spanish sentence is Spanish, and
 * whether the wording chosen instead of a forbidden claim is the right wording,
 * remain review's (`CLAUDE.md` section 6).
 *
 * **`tRestoreRefusal` itself is driven by `../components/RestorePane.test.ts`**,
 * which mounts the pane with a locale override and matches the rendered sentence
 * against the dictionary. What is checked here is the key function that accessor
 * wraps; the reactive wrapper is one line over it, and a suite that re-tested the
 * wrapper in isolation would be testing `translate`.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own.
 */

import { describe, expect, it } from 'vitest';
import {
  openWriteSurfaceKey,
  restoreRefusalKey,
  type CompetingWriteSurfaceKind,
  type RestoreRefusal
} from '../browser/restore';
import { DICTIONARIES, translate, type TranslationKey } from './dictionaries';
import en from './en.json';
import { LOCALES } from './locale';
import type { Locale } from './locale';

/**
 * Every surface kind a restore refuses to run beside.
 *
 * Written out with a `satisfies` for the reason every enumerated union in this
 * repository is: a union has no run-time extent, so a seventh member of
 * `OpenWriteSurfaceKind` — which would join `CompetingWriteSurfaceKind` by
 * exclusion — is a compile error here rather than an arm nobody renders.
 */
const COMPETING = [
  'matchEditor',
  'matchCreator',
  'matchDeleter',
  'matchMover',
  'matchDuplicator',
  'rawEditor'
] as const satisfies readonly CompetingWriteSurfaceKind[];

/**
 * Every refusal a restore can answer, one value each.
 *
 * The `writeSurfaceOpen` arm appears six times, once per competing surface,
 * because its key is chosen by the surface it carries and a single value would
 * exercise one of six sentences.
 */
const REFUSALS: readonly RestoreRefusal[] = [
  ...COMPETING.map((surface): RestoreRefusal => ({ kind: 'writeSurfaceOpen', surface })),
  { kind: 'readOnly' },
  { kind: 'noCandidate' },
  { kind: 'targetMoved' },
  { kind: 'inFlight' },
  { kind: 'conflictShowing' },
  { kind: 'alreadyRestored' }
];

/**
 * Every dictionary key the restore pane owns.
 *
 * Read from `en.json` rather than listed, so a key added to the namespace joins
 * the claim scans below without anything else being edited.
 *
 * @returns The keys, in dictionary order.
 */
function restoreKeys(): TranslationKey[] {
  return (Object.keys(en) as TranslationKey[]).filter((key) => key.startsWith('browser.restore.'));
} // End of function restoreKeys()

describe('the restore refusal accessor', () => {
  it('names a distinct key for every arm, so no two refusals share a sentence', () => {
    const keys = REFUSALS.map(restoreRefusalKey);
    expect(keys).toHaveLength(12);
    expect(new Set(keys).size).toBe(12);
  });

  it('delegates the open-surface arm rather than carrying a sentence of its own', () => {
    // Said once: which surface is open is `openWriteSurfaceKey`'s answer, and
    // `restoreRefusalKey` hands that arm straight to it. Two producers of one
    // sentence is how a newly added surface gets a sentence in one place and not
    // in the other.
    for (const surface of COMPETING) {
      expect(restoreRefusalKey({ kind: 'writeSurfaceOpen', surface })).toBe(
        openWriteSurfaceKey(surface)
      );
    } // End of the loop over the six competing surfaces
  });

  it.each(LOCALES)('renders a sentence for every arm in %s, never a gap', (locale) => {
    for (const refusal of REFUSALS) {
      const key = restoreRefusalKey(refusal);
      const label = `${locale}:${key}`;
      expect(Object.prototype.hasOwnProperty.call(en, key), label).toBe(true);
      const rendered = translate(locale, key);
      expect(rendered.trim(), label).not.toBe('');
      expect(rendered, label).not.toContain('undefined');
      // `translate` leaves an unsubstituted `{placeholder}` visible on purpose,
      // so its absence is what says the sentence names no operand nobody gave it.
      expect(rendered, label).not.toContain('{');
    } // End of the loop over every refusal
  }); // End of the "renders a sentence for every arm" case

  it.each(LOCALES)('never renders a code where a sentence belongs in %s', (locale) => {
    for (const refusal of REFUSALS) {
      const rendered = translate(locale, restoreRefusalKey(refusal));
      expect(rendered, `${locale}:${refusal.kind}`).not.toMatch(
        /\b[a-z]+[A-Z][A-Za-z]*\b/
      );
    } // End of the loop over every refusal
  }); // End of the "never a code" case
}); // End of the "restore refusal accessor" suite

/**
 * Vocabulary that would claim more about a backup than a catalogue establishes.
 *
 * The consult's Q6 list, narrowed to the exact words a sentence would have to
 * contain to make each forbidden claim. Deliberately **not** an attempt at a
 * lexicon: what makes it evidence rather than decoration is the control case
 * below, where a list typo'd into matching nothing fails.
 */
const FORBIDDEN_CLAIMS: Readonly<Record<Locale, readonly string[]>> = {
  en: [
    'undo',
    'revert',
    'authentic',
    'untampered',
    'verified',
    'recoverable',
    'previous version',
    'original version',
    'newest backup',
    'taken at',
    'safe backup',
    'kept forever',
    'merge',
    'works with espanso'
  ],
  es: [
    'deshacer',
    'revertir',
    'auténtic',
    'sin alterar',
    'verificad',
    'recuperable',
    'versión anterior',
    'versión original',
    'copia más reciente',
    'tomada el',
    'copia segura',
    'para siempre',
    'fusion',
    'funciona con espanso'
  ]
};

/**
 * A sentence in each locale that the forbidden vocabulary really does match.
 *
 * The control. It is not a dictionary value and is never rendered; what it
 * provides is a string each locale's list can be shown to bite on, so a negative
 * above is a statement about the dictionary rather than about a list that matches
 * nothing.
 */
const CLAIM_CONTROL: Readonly<Record<Locale, string>> = {
  en:
    'Undo this and revert to the authentic, verified previous version: the newest backup, ' +
    'taken at noon, is a safe backup, kept forever, recoverable, untampered, works with ' +
    'espanso, and will merge the original version.',
  es:
    'Deshacer esto y revertir a la versión anterior auténtica y verificada: la copia más ' +
    'reciente, tomada el mediodía, es una copia segura, guardada para siempre, recuperable, ' +
    'sin alterar, funciona con espanso, y fusiona la versión original.'
};

describe('the restore pane claims nothing it cannot establish (consult Q6)', () => {
  it.each(LOCALES)('makes no historical or authenticity claim in %s', (locale) => {
    const keys = restoreKeys();
    // Every key of the namespace, the twelve refusals included, so a sentence
    // added to the pane joins this scan by existing.
    expect(keys.length, locale).toBeGreaterThan(50);
    for (const key of keys) {
      const value = DICTIONARIES[locale][key].toLowerCase();
      const claimed = FORBIDDEN_CLAIMS[locale].filter((word) => value.includes(word));
      expect(claimed, `${locale}:${key}`).toEqual([]);
    } // End of the loop over every restore key
  }); // End of the "no historical claim" case

  it.each(LOCALES)('keeps that word list capable of firing in %s', (locale) => {
    const found = FORBIDDEN_CLAIMS[locale].filter((word) =>
      CLAIM_CONTROL[locale].toLowerCase().includes(word)
    );
    expect(found, locale).toEqual([...FORBIDDEN_CLAIMS[locale]]);
  }); // End of the "word list can fire" case

  it.each(LOCALES)('calls a batch recognised rather than trusted in %s', (locale) => {
    // The truthful term the consult names. The ownership marker is deliberately
    // forgeable by anything able to write inside the backups folder, so what this
    // application establishes is that a folder is shaped the way it writes them.
    const heading = DICTIONARIES[locale]['browser.restore.batchesHeading'].toLowerCase();
    const recognised = locale === 'en' ? 'recognised' : 'reconocid';
    expect(heading, locale).toContain(recognised);
  }); // End of the "recognised rather than trusted" case

  it.each(LOCALES)('never turns a batch name into a time in %s', (locale) => {
    // The one sentence that says what a batch label is. It has to deny both
    // halves: that the label records when this file was written, and that
    // recognising the label says what wrote the folder.
    const order = DICTIONARIES[locale]['browser.restore.batchOrder'].toLowerCase();
    for (const word of locale === 'en' ? ['label', 'clock'] : ['etiqueta', 'reloj']) {
      expect(order, `${locale}:${word}`).toContain(word);
    } // End of the loop over the words that must be there
  }); // End of the "never a time" case

  it.each(LOCALES)('says an attempt wrote nothing rather than that nothing changed in %s', (locale) => {
    // Consult Q6: *nothing was changed* is a claim about the file, and another
    // writer may have changed it. The narrower predicate is about this attempt.
    const failed = DICTIONARIES[locale]['browser.restore.sendFailed'].toLowerCase();
    const attempt = locale === 'en' ? 'this attempt wrote nothing' : 'este intento no escribió nada';
    expect(failed, locale).toContain(attempt);
  }); // End of the "attempt wrote nothing" case

  it.each(LOCALES)('never calls an open editor unsaved edits in %s', (locale) => {
    // `documentHasUnsavedDraft`'s defect, and the two sentences whose predicate
    // sees only an *open* surface. Both claim an open editor and this
    // application's inability to tell whether it was edited, and neither may say
    // that unsaved edits exist.
    for (const key of [
      'browser.restore.refused.matchEditorOpen',
      'browser.restore.refused.rawEditorOpen'
    ] as const) {
      const value = DICTIONARIES[locale][key].toLowerCase();
      const cannotTell = locale === 'en' ? 'cannot tell whether' : 'no puede saber si';
      expect(value, `${locale}:${key}`).toContain(cannotTell);
    } // End of the loop over the two open-editor sentences
  }); // End of the "never unsaved edits" case
}); // End of the "claims nothing it cannot establish" suite
