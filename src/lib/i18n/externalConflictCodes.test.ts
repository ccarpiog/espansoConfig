/**
 * Runtime checks on the external-conflict accessors and the reviewed wording
 * behind them — Phase 2d-6-1a.
 *
 * The compile-time half is in `../browser/saveOutcome.ts` and
 * `../browser/observationDelivery.ts`: every key function returns a
 * `TranslationKey` chosen by a `switch` with a `never` terminus, so a code with no
 * dictionary entry fails `svelte-check` there. **The Rust half does not exist for
 * these**: `src-tauri/src/dictionary_contract.rs` compares the `code.` namespace
 * alone, and `browser.externalConflict.*` is frontend state no Rust enum owns —
 * which is why this file calls every accessor rather than trusting parity.
 *
 * ## What the literal expectations are, and what they are not
 *
 * The 2d-6 design consult's Q9 (the record's §3 entries 35 and 40) asks for the
 * safety-critical sentences to be pinned with **reviewed literal EN/ES
 * expectations**. The cases below do that for the retained sentence (entry 13),
 * the uncertainty sentence and its action (entry 14), and the three corrections
 * of entry 24. **A literal fixture protects approved wording and nothing else**:
 * it fails when the wording drifts, and it cannot fail when the wording is wrong,
 * ungrammatical or — for the Spanish — not Spanish. The Spanish here was written by
 * the implementer and has not had a bilingual review; the expectation pins that
 * draft so a reviewer's correction is a deliberate edit to two files rather than a
 * silent one to one. Nothing automatable in this repository establishes
 * translation quality, and this file does not claim to.
 *
 * The word scans further down pin the seven semantic bounds of entry 40 as
 * *absences* — a sentence that does not contain "newer" cannot claim the disk is
 * newer — which is the one property of meaning a substring can carry. They say
 * nothing about what the sentences do claim.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers in this file do.
 */

import { describe, expect, it } from 'vitest';
import { conflictOriginMessageKey } from '../browser/conflictSource';
import {
  externalConflictActionKey,
  externalConflictNoticeKey,
  type ExternalConflictAction,
  type ExternalConflictNotice
} from '../browser/observationDelivery';
import { externalEvidenceRefusalKey, SUPERSEDED_EVIDENCE_KEY } from '../browser/reapply';
import { conflictMessageKey, type ConflictMessage } from '../browser/saveOutcome';
import {
  describeConflictMessage,
  describeExternalConflictAction,
  describeExternalConflictNotice
} from './codes';
import { DICTIONARIES, type TranslationKey } from './dictionaries';
import type { ExpectNever, Missing } from './exhaustive';
import { tConflictMessage, tExternalConflictAction, tExternalConflictNotice } from './index';
import { DEFAULT_LOCALE, LOCALES } from './locale';

/**
 * Every line either conflict origin can show, in declaration order.
 *
 * Written by hand and pinned to the union below, so a line added to either
 * constituent union is a compile error here rather than a code nobody renders.
 */
const CONFLICT_MESSAGE_KINDS = [
  'fileWritten',
  'nothingToWrite',
  'backupTaken',
  'nothingWasWritten',
  'changedElsewhere',
  'draftKeptInMemory',
  'operationKeptInMemory',
  'reloadDiscardsDraft',
  'reloadClosesSurface',
  'reloadAbandonsOperation',
  'reloadRetargetsCandidate',
  'changedAgainSinceRefusal',
  'windowOutOfStep',
  'fileChangedWhileOpen'
] as const satisfies readonly ConflictMessage['kind'][];

/** Every notice, in declaration order. */
const NOTICE_KINDS = [
  'observationRetained',
  'writeOutcomeUnknown'
] as const satisfies readonly ExternalConflictNotice['kind'][];

/** Every action, in declaration order. */
const ACTION_KINDS = ['acknowledgeSnapshot'] as const satisfies readonly ExternalConflictAction['kind'][];

// `never` exactly when the tables above name every member of their union. See
// `./exhaustive`.
export type _ConflictMessageKindsAreComplete = ExpectNever<
  Missing<ConflictMessage['kind'], typeof CONFLICT_MESSAGE_KINDS>
>;
export type _NoticeKindsAreComplete = ExpectNever<
  Missing<ExternalConflictNotice['kind'], typeof NOTICE_KINDS>
>;
export type _ActionKindsAreComplete = ExpectNever<
  Missing<ExternalConflictAction['kind'], typeof ACTION_KINDS>
>;

/**
 * One conflict line of the named kind.
 *
 * @param kind - Which line.
 * @returns The line, as the model would produce it.
 */
function messageOf(kind: ConflictMessage['kind']): ConflictMessage {
  return { kind } as ConflictMessage;
} // End of function messageOf()

/**
 * The sentence one key holds in one locale, for a literal pin.
 *
 * @param locale - Which dictionary.
 * @param key - Which entry.
 * @returns The value, exactly.
 */
function sentence(locale: (typeof LOCALES)[number], key: TranslationKey): string {
  return DICTIONARIES[locale][key];
} // End of function sentence()

describe('the external-conflict accessors', () => {
  it.each(LOCALES)('render a sentence for every conflict line in %s, never a gap', (locale) => {
    for (const kind of CONFLICT_MESSAGE_KINDS) {
      const rendered = describeConflictMessage(locale, messageOf(kind));
      expect(rendered.trim(), `${locale}:${kind}`).not.toBe('');
      expect(rendered, `${locale}:${kind}`).not.toContain('undefined');
      // `translate` leaves an unsubstituted `{placeholder}` visible on purpose, so
      // its absence is what says none of these lines names an operand.
      expect(rendered, `${locale}:${kind}`).not.toContain('{');
    } // End of the loop over every conflict line
  }); // End of the "every conflict line" case

  it.each(LOCALES)('render a sentence for every notice and action in %s', (locale) => {
    for (const kind of NOTICE_KINDS) {
      const rendered = describeExternalConflictNotice(locale, { kind });
      expect(rendered.trim(), `${locale}:${kind}`).not.toBe('');
      expect(rendered, `${locale}:${kind}`).not.toContain('undefined');
      expect(rendered, `${locale}:${kind}`).not.toContain('{');
    } // End of the loop over every notice
    for (const kind of ACTION_KINDS) {
      const rendered = describeExternalConflictAction(locale, { kind });
      expect(rendered.trim(), `${locale}:${kind}`).not.toBe('');
      expect(rendered, `${locale}:${kind}`).not.toContain('undefined');
      expect(rendered, `${locale}:${kind}`).not.toContain('{');
    } // End of the loop over every action
  }); // End of the "every notice and action" case

  it.each(LOCALES)('tell every conflict line apart in %s', (locale) => {
    // Fourteen codes, fourteen sentences: the external line may not resolve to the
    // sentence of any save-outcome line, and in particular not to `changedElsewhere`'s.
    const rendered = CONFLICT_MESSAGE_KINDS.map((kind) =>
      describeConflictMessage(locale, messageOf(kind))
    );
    expect(new Set(rendered).size, locale).toBe(CONFLICT_MESSAGE_KINDS.length);
  }); // End of the "tell every line apart" case

  it('resolve the external line under browser.externalConflict and every save line under browser.saveOutcome', () => {
    for (const kind of CONFLICT_MESSAGE_KINDS) {
      const key = conflictMessageKey(messageOf(kind));
      const namespace = kind === 'fileChangedWhileOpen' ? 'browser.externalConflict.' : 'browser.saveOutcome.';
      expect(key.startsWith(namespace), kind).toBe(true);
    } // End of the loop over every conflict line
    for (const kind of NOTICE_KINDS) {
      expect(externalConflictNoticeKey({ kind }).startsWith('browser.externalConflict.'), kind).toBe(true);
    } // End of the loop over every notice
    for (const kind of ACTION_KINDS) {
      expect(
        externalConflictActionKey({ kind }).startsWith('browser.externalConflict.action.'),
        kind
      ).toBe(true);
    } // End of the loop over every action
  }); // End of the "namespaces" case

  it('are wrapped reactively in index.ts, resolving the default locale', () => {
    // Each `t*` wrapper is one line over its describer; what is checked is that it
    // exists, is exported from the one module a component may read a string from,
    // and answers the same sentence as the describer in the default locale.
    for (const kind of CONFLICT_MESSAGE_KINDS) {
      expect(tConflictMessage(messageOf(kind)), kind).toBe(
        describeConflictMessage(DEFAULT_LOCALE, messageOf(kind))
      );
    } // End of the loop over every conflict line
    for (const kind of NOTICE_KINDS) {
      expect(tExternalConflictNotice({ kind }), kind).toBe(
        describeExternalConflictNotice(DEFAULT_LOCALE, { kind })
      );
    } // End of the loop over every notice
    for (const kind of ACTION_KINDS) {
      expect(tExternalConflictAction({ kind }), kind).toBe(
        describeExternalConflictAction(DEFAULT_LOCALE, { kind })
      );
    } // End of the loop over every action
  }); // End of the "wrapped reactively" case
}); // End of the "external-conflict accessors" suite

describe('the reviewed wording, pinned literally', () => {
  // **What these pin and what they cannot** — the header says it once and the
  // cases say it again: approved wording, never meaning, never translation
  // quality. The Spanish is the implementer's draft, unreviewed by a bilingual
  // reader; a correction is a deliberate edit here and in `es.json` together.

  it('pins the retained sentence (entry 13) in both languages', () => {
    const key = externalConflictNoticeKey({ kind: 'observationRetained' });
    expect(sentence('en', key)).toBe(
      'An observed change is waiting to be checked against this window’s state.'
    );
    expect(sentence('es', key)).toBe(
      'Un cambio observado está a la espera de comprobarse frente al estado de esta ventana.'
    );
  }); // End of the "retained sentence" case

  it('pins the uncertainty sentence and its action (entry 14) in both languages', () => {
    const notice = externalConflictNoticeKey({ kind: 'writeOutcomeUnknown' });
    expect(sentence('en', notice)).toBe(
      'The earlier write’s outcome is unknown. Reviewing this disk snapshot cannot establish whether that write completed.'
    );
    expect(sentence('es', notice)).toBe(
      'Se desconoce el resultado de la escritura anterior. Revisar esta instantánea del disco no permite establecer si esa escritura llegó a completarse.'
    );
    const action = externalConflictActionKey({ kind: 'acknowledgeSnapshot' });
    expect(sentence('en', action)).toBe('I have reviewed this snapshot');
    expect(sentence('es', action)).toBe('He revisado esta instantánea');
  }); // End of the "uncertainty sentence and action" case

  it('pins the external origin line and the external conflict line (entry 24) in both languages', () => {
    const origin = conflictOriginMessageKey({ kind: 'changedWhileOpen' });
    expect(sentence('en', origin)).toBe(
      'What is compared here came from watching the file: it changed on disk while this was open. No save was initiated in response to this observation, so nothing was written from here in response to it, and this app cannot say what changed the file or when.'
    );
    expect(sentence('es', origin)).toBe(
      'Lo que se compara aquí viene de la vigilancia del archivo: cambió en el disco mientras esto estaba abierto. No se ha iniciado ningún guardado como respuesta a esta observación, así que desde aquí no se ha escrito nada como respuesta a ella, y esta aplicación no puede decir qué cambió el archivo ni cuándo.'
    );
    const line = conflictMessageKey({ kind: 'fileChangedWhileOpen' });
    expect(sentence('en', line)).toBe(
      'This file changed on disk while this panel was open. No save was initiated in response to this observation, and this app cannot say what changed the file or when.'
    );
    expect(sentence('es', line)).toBe(
      'Este archivo ha cambiado en el disco mientras este panel estaba abierto. No se ha iniciado ningún guardado como respuesta a esta observación, y esta aplicación no puede decir qué cambió el archivo ni cuándo.'
    );
  }); // End of the "external origin and conflict lines" case

  it('pins the reapply refusals over external evidence to "this reapply attempt wrote nothing" (entry 24)', () => {
    // The three sentences `tExternalEvidenceRefusal` renders used to end *Nothing
    // was written* — an unbounded claim about the file, false after a write this
    // window attempted with an unknown outcome. Each now ends with a claim about
    // this attempt alone, and the old clause is gone from all three.
    for (const reason of ['noCorrespondence', 'baseRevisionMoved', 'diskRevisionMoved'] as const) {
      const key = externalEvidenceRefusalKey(reason);
      expect(sentence('en', key), reason).toMatch(/ This reapply attempt wrote nothing\.$/);
      expect(sentence('en', key), reason).not.toContain('Nothing was written');
      expect(sentence('es', key), reason).toMatch(/ Este intento de reaplicar no ha escrito nada\.$/);
      expect(sentence('es', key), reason).not.toContain('No se ha escrito nada');
    } // End of the loop over the three external-evidence refusals
  }); // End of the "reapply refusals" case

  it('pins the supersession sentence to "accepted evidence changed" (entry 24) in both languages', () => {
    expect(sentence('en', SUPERSEDED_EVIDENCE_KEY)).toBe(
      'The evidence this panel was comparing against has been superseded by another accepted reading of this file, so there is nothing here to match what you kept against. This reapply attempt wrote nothing.'
    );
    expect(sentence('es', SUPERSEDED_EVIDENCE_KEY)).toBe(
      'La evidencia con la que este panel comparaba ha quedado sustituida por otra lectura aceptada de este archivo, así que aquí no hay nada con lo que comparar lo que has conservado. Este intento de reaplicar no ha escrito nada.'
    );
  }); // End of the "supersession sentence" case
}); // End of the "reviewed wording" suite

describe('the semantic bounds of entry 40, as absences', () => {
  /**
   * Every sentence this phase introduced or corrected, by key.
   *
   * Listed by hand so a sentence added to the namespace later has to be entered
   * here to be bounded, and asserted below against the dictionary so the list
   * cannot name a key that is gone.
   */
  const BOUNDED_KEYS: readonly TranslationKey[] = [
    'browser.externalConflict.fileChangedWhileOpen',
    'browser.externalConflict.observationRetained',
    'browser.externalConflict.writeOutcomeUnknown',
    'browser.externalConflict.action.acknowledgeSnapshot',
    'browser.conflictOrigin.changedWhileOpen',
    'browser.reapply.externalEvidence.noCorrespondence',
    'browser.reapply.externalEvidence.baseRevisionMoved',
    'browser.reapply.externalEvidence.diskRevisionMoved',
    'browser.reapply.supersededConflict'
  ];

  /**
   * One claim none of the bounded sentences may make, with the sentence that proves
   * the pattern can find it.
   */
  interface ForbiddenClaim {
    /** The claim, for the failure message. */
    readonly claim: string;
    /**
     * The form to scan for, over the lower-cased sentence.
     *
     * A pattern rather than a substring since the phase's review: the Spanish for
     * *saved* and *written* is a participle the approved **negative** wording also
     * uses — *ningún guardado*, *no ha escrito nada* — so the affirmative form has to
     * be told from the negated one by what precedes it, which a substring cannot do.
     * Every pattern is bounded by `(?<![\p{L}])` … `(?![\p{L}])` rather than `\b`,
     * because `\b` treats an accented letter as a word edge.
     */
    readonly form: RegExp;
    /**
     * A sentence that makes the claim and **must** be caught by `form`.
     *
     * The positive control, one per form: a pattern that had been typo'd into
     * matching nothing fails below rather than passing the absence case vacuously.
     */
    readonly control: string;
  }

  /**
   * Builds a word-bounded pattern over lower-cased text.
   *
   * @param body - The pattern body, with any lookbehind exclusions of its own.
   * @returns The bounded, Unicode-aware pattern.
   */
  function bounded(body: string): RegExp {
    return new RegExp(`(?<![\\p{L}])(?:${body})(?![\\p{L}])`, 'u');
  } // End of function bounded()

  /**
   * The claims none of the bounded sentences may make, per locale.
   *
   * The consult's list — *merged, saved, newer, deleted, exact duplicate, identity
   * correspondence* — plus an affirmative *written*, the two promises the retained
   * sentence must not make, and the refused-save claim `changedElsewhere` makes.
   * The two participle forms exclude exactly the approved negative wording and
   * nothing else: `guardado` not preceded by *ningún*, and `(se) ha escrito` /
   * `was written` not preceded by *no (se)* / *nothing*.
   */
  const FORBIDDEN: Readonly<Record<(typeof LOCALES)[number], readonly ForbiddenClaim[]>> = {
    en: [
      { claim: 'merged', form: bounded('merged'), control: 'Your text was merged with the file.' },
      { claim: 'saved', form: bounded('saved'), control: 'The file was saved.' },
      {
        claim: 'written (affirmative)',
        form: bounded('(?<!nothing )was written'),
        control: 'The file was written.'
      },
      { claim: 'newer', form: bounded('newer'), control: 'The version on disk is newer.' },
      { claim: 'deleted', form: bounded('deleted'), control: 'The snippet was deleted.' },
      {
        claim: 'exact duplicate',
        form: bounded('exact duplicate'),
        control: 'This snippet is an exact duplicate.'
      },
      {
        claim: 'identity correspondence',
        form: bounded('identity correspondence'),
        control: 'An identity correspondence was found.'
      },
      {
        claim: 'automatic processing',
        form: bounded('automatically'),
        control: 'It will be processed automatically.'
      },
      { claim: 'waiting for your save', form: bounded('your save'), control: 'Waiting for your save.' },
      { claim: 'a refused save', form: bounded('was refused'), control: 'The save was refused.' }
    ],
    es: [
      {
        claim: 'merged',
        form: bounded('(?:fusionad|combinad)[oa]s?'),
        control: 'Tu texto se ha fusionado con el archivo.'
      },
      {
        claim: 'saved (affirmative)',
        form: bounded('(?<!ningún )guardad[oa]s?|guardó|guardaron'),
        control: 'El archivo se ha guardado.'
      },
      {
        claim: 'written (affirmative)',
        form: bounded('(?<!no (?:se )?)(?:se )?ha escrito|escribió'),
        control: 'El archivo se ha escrito.'
      },
      {
        claim: 'newer',
        form: bounded('más (?:reciente|nuev[oa]s?)'),
        control: 'La versión del disco es más reciente.'
      },
      {
        claim: 'deleted',
        form: bounded('(?:borrad|eliminad)[oa]s?'),
        control: 'El fragmento se ha borrado.'
      },
      {
        claim: 'exact duplicate',
        form: bounded('duplicado exacto'),
        control: 'Este fragmento es un duplicado exacto.'
      },
      {
        claim: 'identity correspondence',
        form: bounded('correspondencia de identidad'),
        control: 'Se ha encontrado una correspondencia de identidad.'
      },
      {
        claim: 'automatic processing',
        form: bounded('automáticamente'),
        control: 'Se procesará automáticamente.'
      },
      { claim: 'waiting for your save', form: bounded('tu guardado'), control: 'A la espera de tu guardado.' },
      { claim: 'a refused save', form: bounded('se ha rechazado'), control: 'El guardado se ha rechazado.' }
    ]
  };

  /**
   * The approved negative wording every form must admit, per locale.
   *
   * The clauses the bounded sentences really use, quoted from them: a form that
   * caught one of these would reject the reviewed wording rather than the claim.
   */
  const APPROVED_NEGATIVES: Readonly<Record<(typeof LOCALES)[number], readonly string[]>> = {
    en: [
      'No save was initiated in response to this observation',
      'nothing was written from here in response to it',
      'This reapply attempt wrote nothing.'
    ],
    es: [
      'No se ha iniciado ningún guardado como respuesta a esta observación',
      'desde aquí no se ha escrito nada como respuesta a ella',
      'Este intento de reaplicar no ha escrito nada.'
    ]
  };

  /**
   * Which forbidden claims one sentence makes.
   *
   * @param locale - Which list to scan with.
   * @param value - The sentence, in any case.
   * @returns The claims found, empty when none.
   */
  function claimsMadeBy(locale: (typeof LOCALES)[number], value: string): string[] {
    const lower = value.toLowerCase();
    return FORBIDDEN[locale].filter(({ form }) => form.test(lower)).map(({ claim }) => claim);
  } // End of function claimsMadeBy()

  it('covers every key of the external-conflict namespace', () => {
    const namespace = (Object.keys(DICTIONARIES.en) as TranslationKey[]).filter((key) =>
      key.startsWith('browser.externalConflict.')
    );
    for (const key of namespace) {
      expect(BOUNDED_KEYS, key).toContain(key);
    } // End of the loop over every key of the namespace
    expect(namespace).toHaveLength(4);
  });

  it('never makes a claim the consult forbids, in either locale', () => {
    for (const locale of LOCALES) {
      for (const key of BOUNDED_KEYS) {
        expect(claimsMadeBy(locale, DICTIONARIES[locale][key]), `${locale}:${key}`).toEqual([]);
      } // End of the loop over the bounded keys
    } // End of the loop over the two locales
  });

  it('catches every forbidden form on its own positive control, in both locales', () => {
    // One control per form, so no form can have been typo'd into matching nothing
    // while the absence case above passes for a reason unrelated to the dictionary.
    for (const locale of LOCALES) {
      for (const { claim, form, control } of FORBIDDEN[locale]) {
        expect(form.test(control.toLowerCase()), `${locale}:${claim}`).toBe(true);
        expect(claimsMadeBy(locale, control), `${locale}:${claim}`).toContain(claim);
      } // End of the loop over every forbidden form
      expect(FORBIDDEN[locale].length, locale).toBe(10);
    } // End of the loop over the two locales
  });

  it('catches an affirmative saved or written claim prepended to an approved refusal', () => {
    // The phase's review probe: the Spanish list had no equivalent of *saved*, so
    // "El archivo se ha guardado." in front of a refusal passed the scan. It fails
    // now, in both languages and for both verbs, on every bounded refusal.
    const probes: Readonly<Record<(typeof LOCALES)[number], readonly string[]>> = {
      en: ['The file was saved. ', 'The file was written. '],
      es: ['El archivo se ha guardado. ', 'El archivo se ha escrito. ']
    };
    for (const locale of LOCALES) {
      for (const key of BOUNDED_KEYS) {
        for (const probe of probes[locale]) {
          expect(
            claimsMadeBy(locale, probe + DICTIONARIES[locale][key]),
            `${locale}:${key}:${probe.trim()}`
          ).not.toEqual([]);
        } // End of the loop over both probes
      } // End of the loop over the bounded keys
    } // End of the loop over the two locales
  });

  it('admits the approved negative wording under every form, in both locales', () => {
    // The other half of the participle patterns: *ningún guardado* and *no ha
    // escrito nada* are the reviewed wording, and a form that caught them would be
    // rejecting the sentence for saying the right thing.
    for (const locale of LOCALES) {
      for (const negative of APPROVED_NEGATIVES[locale]) {
        expect(claimsMadeBy(locale, negative), `${locale}:${negative}`).toEqual([]);
        // And each really is quoted from a bounded sentence, so the list cannot
        // drift into admitting wording nothing uses.
        const quoted = BOUNDED_KEYS.some((key) => DICTIONARIES[locale][key].includes(negative));
        expect(quoted, `${locale}:${negative}`).toBe(true);
      } // End of the loop over the approved negatives
    } // End of the loop over the two locales
  });

  it('says of the retained sentence only that a check is pending, and promises nothing', () => {
    const key = externalConflictNoticeKey({ kind: 'observationRetained' });
    expect(sentence('en', key)).toContain('waiting to be checked');
    expect(sentence('en', key)).not.toMatch(/\bwill\b/);
    expect(sentence('es', key)).toContain('a la espera de comprobarse');
    expect(sentence('es', key)).not.toMatch(/\b(se procesará|se comprobará)\b/);
  });

  it('says of the uncertainty sentence that the outcome is unknown, never failed or completed', () => {
    const key = externalConflictNoticeKey({ kind: 'writeOutcomeUnknown' });
    expect(sentence('en', key)).toContain('outcome is unknown');
    expect(sentence('en', key)).toContain('cannot establish');
    expect(sentence('en', key)).not.toMatch(/\b(failed|succeeded|was written|was not written)\b/);
    expect(sentence('es', key)).toContain('Se desconoce el resultado');
    expect(sentence('es', key)).toContain('no permite establecer');
    expect(sentence('es', key)).not.toMatch(/\b(falló|ha fallado|se ha escrito|no se ha escrito)\b/);
  });

  it('says of supersession that the evidence changed and nothing about chronology', () => {
    expect(sentence('en', SUPERSEDED_EVIDENCE_KEY)).toContain('superseded by another accepted reading');
    expect(sentence('en', SUPERSEDED_EVIDENCE_KEY)).not.toMatch(/\b(changed again|later|after)\b/);
    expect(sentence('es', SUPERSEDED_EVIDENCE_KEY)).toContain('otra lectura aceptada');
    expect(sentence('es', SUPERSEDED_EVIDENCE_KEY)).not.toMatch(/\b(vuelto a cambiar|después|posterior)\b/);
  });
}); // End of the "semantic bounds" suite
