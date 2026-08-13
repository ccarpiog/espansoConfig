/**
 * Runtime checks on the backup catalogue's accessors — Phase 2c-5-2.
 *
 * The compile-time half is in `codes.ts`: every key builder returns a
 * `TranslationKey` whose type is a template literal over the enum's own name
 * union, so a variant with no dictionary entry fails `svelte-check` there. The
 * Rust half is `src-tauri/src/dictionary_contract.rs`, which compares both
 * dictionaries against the enum declarations in both directions.
 *
 * What is left for this file is what neither can see: that calling the accessor
 * produces a sentence, and that the sentence does not claim something the
 * catalogue never established. `saveCodes.test.ts` is the precedent for the
 * first; the second is this phase's own risk, because a backup is the one thing
 * in this application a person is most likely to be told false comfort about.
 *
 * **What no suite in this repository can check** is whether a Spanish value is
 * Spanish, or whether the replacement wording for a forbidden claim is the right
 * wording. The claim scans below pin one property of one family of sentences —
 * that a listed vocabulary does not appear — and each is paired with a control
 * proving the vocabulary can match something. That is narrower than *meaning*,
 * deliberately, and it is stated here rather than implied.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own.
 */

import { describe, expect, it } from 'vitest';
import {
  backupReadErrorKey,
  backupReadStepKey,
  backupRootStateKey,
  backupTargetKey,
  batchSkippedKey,
  describeBackupReadError,
  describeBackupReadStep,
  describeBackupRootState,
  describeBackupTarget,
  describeBatchSkipped,
  describeCommandError,
  describeEntrySkipped,
  entrySkippedKey
} from './codes';
import { DICTIONARIES, translate, type TranslationKey } from './dictionaries';
import en from './en.json';
import { LOCALES } from './locale';
import type { Locale } from './locale';
import type {
  BackupReadErrorName,
  BackupReadStep,
  BackupRootState,
  BackupTargetName,
  BatchSkipped,
  EntrySkipped
} from '../ipc/types';

/** A path as it crosses the boundary: a lossy string, never an object. */
const PATH = '/nowhere/.espansoconfig-backups';

/** A batch identity as it crosses the boundary. */
const BATCH = { name: '2026-01-02T030405Z-0' } as const;

/** An entry identity as it crosses the boundary. */
const ENTRY = { batch: BATCH, relative_path: 'match/base.yml' } as const;

/** Every `BackupRootState` member, for the exhaustiveness the sweeps need. */
const ROOT_STATES = ['Missing', 'Present'] as const satisfies readonly BackupRootState[];

/** Every `BatchSkipped` member. */
const BATCH_SKIPPED = [
  'ForeignName',
  'NotADirectory',
  'NoMarker',
  'Unreadable'
] as const satisfies readonly BatchSkipped[];

/** Every `EntrySkipped` member. */
const ENTRY_SKIPPED = [
  'Marker',
  'Symlink',
  'NotARegularFile',
  'UnusableName',
  'Unreadable'
] as const satisfies readonly EntrySkipped[];

/** Every `BackupReadStep` member. */
const READ_STEPS = [
  'InspectBackupRoot',
  'ListBackupRoot',
  'InspectBatch',
  'ListBatch',
  'InspectEntry',
  'ReadEntry'
] as const satisfies readonly BackupReadStep[];

/** Every `BackupTarget` variant name. */
const TARGET_NAMES = [
  'InConfigRoot',
  'OutsideConfigRoot'
] as const satisfies readonly BackupTargetName[];

/** Every `BackupReadError` variant name. */
const READ_ERROR_NAMES = [
  'RootNotADirectory',
  'RootNotPrivate',
  'StaleBatch',
  'StaleEntry',
  'Io',
  'NotUtf8'
] as const satisfies readonly BackupReadErrorName[];

/** The four command errors this step added, with operands of the right shape. */
const BACKUP_COMMAND_ERRORS = [
  { code: 'unrecognisedBackupBatch', batch: 'not-a-batch-name' },
  {
    code: 'unaddressableBackupEntry',
    batch: BATCH.name,
    relative_path: '../outside'
  },
  { code: 'backupEntryIsNotThisDocument', document: 9 },
  { code: 'backupReadFailed', error: { StaleEntry: { entry: ENTRY } } }
] as const;

/**
 * One rendering per accessor, in one locale.
 *
 * The tagged ones deliberately use variants that **carry operands**, because a
 * describer that dropped the operand object still renders a sentence for a
 * bare-name variant and would pass a check built only on those.
 *
 * @param locale - The dictionary to read from.
 * @returns One label-and-sentence pair per rendering.
 */
function renderings(locale: Locale): readonly (readonly [string, string])[] {
  const pairs: (readonly [string, string])[] = [];
  for (const state of ROOT_STATES) {
    pairs.push([`BackupRootState.${state}`, describeBackupRootState(locale, state)]);
  }
  for (const reason of BATCH_SKIPPED) {
    pairs.push([`BatchSkipped.${reason}`, describeBatchSkipped(locale, reason)]);
  }
  for (const reason of ENTRY_SKIPPED) {
    pairs.push([`EntrySkipped.${reason}`, describeEntrySkipped(locale, reason)]);
  }
  for (const step of READ_STEPS) {
    pairs.push([`BackupReadStep.${step}`, describeBackupReadStep(locale, step)]);
  }
  pairs.push([
    'BackupTarget.InConfigRoot',
    describeBackupTarget(locale, { InConfigRoot: { relative_path: 'match/base.yml' } })
  ]);
  pairs.push([
    'BackupTarget.OutsideConfigRoot',
    describeBackupTarget(locale, 'OutsideConfigRoot')
  ]);
  pairs.push([
    'BackupReadError.RootNotPrivate',
    describeBackupReadError(locale, { RootNotPrivate: { path: PATH, mode: 0o755 } })
  ]);
  pairs.push([
    'BackupReadError.StaleBatch',
    describeBackupReadError(locale, { StaleBatch: { batch: BATCH } })
  ]);
  pairs.push([
    'BackupReadError.StaleEntry',
    describeBackupReadError(locale, { StaleEntry: { entry: ENTRY } })
  ]);
  pairs.push([
    'BackupReadError.Io',
    describeBackupReadError(locale, {
      Io: { step: 'ListBatch', path: PATH, kind: 'PermissionDenied', raw_os_error: 13 }
    })
  ]);
  pairs.push([
    'BackupReadError.NotUtf8',
    describeBackupReadError(locale, { NotUtf8: { entry: ENTRY, offset: 11 } })
  ]);
  pairs.push([
    'BackupReadError.RootNotADirectory',
    describeBackupReadError(locale, { RootNotADirectory: { path: PATH } })
  ]);
  for (const error of BACKUP_COMMAND_ERRORS) {
    pairs.push([`CommandError.${error.code}`, describeCommandError(locale, error)]);
  }
  return pairs;
} // End of function renderings()

/**
 * Every dictionary key one of this step's namespaces owns.
 *
 * Read from `en.json` rather than listed, so a key added to a namespace joins
 * the claim scans below without anything else being edited.
 *
 * @returns The keys, in dictionary order.
 */
function backupCatalogueKeys(): TranslationKey[] {
  const namespaces = [
    'code.backupRootState.',
    'code.batchSkipped.',
    'code.entrySkipped.',
    'code.backupReadStep.',
    'code.backupTarget.',
    'code.backupReadError.'
  ];
  return (Object.keys(en) as TranslationKey[]).filter((key) =>
    namespaces.some((prefix) => key.startsWith(prefix))
  );
} // End of function backupCatalogueKeys()

describe('the backup-catalogue accessors', () => {
  it.each(LOCALES)('render a sentence in %s, never a gap', (locale) => {
    const pairs = renderings(locale);
    // Twenty-five catalogue members plus the four command errors this step added.
    expect(pairs.length, locale).toBe(29);
    for (const [what, rendered] of pairs) {
      const label = `${locale}:${what}`;
      expect(rendered.trim(), label).not.toBe('');
      expect(rendered, label).not.toContain('undefined');
      // `translate` leaves an unsubstituted `{placeholder}` visible on purpose,
      // so its absence is what says every operand the message names was given.
      expect(rendered, label).not.toContain('{');
      expect(rendered, label).not.toContain('[object Object]');
    }
  }); // End of the "render a sentence" case

  it.each(LOCALES)('name a real dictionary entry from every builder in %s', (locale) => {
    const keys: TranslationKey[] = [
      ...ROOT_STATES.map(backupRootStateKey),
      ...BATCH_SKIPPED.map(batchSkippedKey),
      ...ENTRY_SKIPPED.map(entrySkippedKey),
      ...READ_STEPS.map(backupReadStepKey),
      ...TARGET_NAMES.map(backupTargetKey),
      ...READ_ERROR_NAMES.map(backupReadErrorKey)
    ];
    expect(keys.length).toBe(25);
    for (const key of keys) {
      expect(Object.prototype.hasOwnProperty.call(en, key), key).toBe(true);
      expect(translate(locale, key).trim(), `${locale}:${key}`).not.toBe('');
    }
  }); // End of the "every builder names a real entry" case

  it.each(LOCALES)('substitute the operands a message names in %s', (locale) => {
    expect(
      describeBackupReadError(locale, { RootNotADirectory: { path: PATH } }),
      locale
    ).toContain(PATH);
    expect(
      describeBackupReadError(locale, { NotUtf8: { entry: ENTRY, offset: 11 } }),
      locale
    ).toContain('11');
  }); // End of the "substitute the operands" case

  it.each(LOCALES)('keep an ErrorKind name and an errno out of the sentence in %s', (locale) => {
    // `kind` is a `std::io::ErrorKind` variant name and `raw_os_error` is a bare
    // system error number: both are diagnostic data with no dictionary of their
    // own, and both are strings or numbers `scalarOperands` would happily
    // substitute if a message named one. No message does.
    const io = describeBackupReadError(locale, {
      Io: { step: 'ListBatch', path: PATH, kind: 'PermissionDenied', raw_os_error: 13 }
    });
    expect(io, locale).not.toContain('PermissionDenied');
    expect(io, locale).not.toContain('ListBatch');
    expect(io, locale).not.toContain('13');
  }); // End of the "ErrorKind and errno" case

  it.each(LOCALES)('never render a Rust variant name where a sentence belongs in %s', (locale) => {
    for (const [what, rendered] of renderings(locale)) {
      expect(rendered, `${locale}:${what}`).not.toMatch(/\b[A-Z][a-z]+[A-Z][A-Za-z]*\b/);
    }
  }); // End of the "never a variant name" case
}); // End of the "backup-catalogue accessors" suite

/**
 * Vocabulary that would claim a backup is authentic, recoverable or a version.
 *
 * Deliberately a short list of the exact words the phase's design consult (Q6)
 * forbids, and **not** an attempt at a lexicon. What makes it evidence rather
 * than decoration is the control case below: a list typo'd into matching nothing
 * would fail there.
 */
const FORBIDDEN_CLAIMS: Readonly<Record<Locale, readonly string[]>> = {
  en: [
    'undo',
    'authentic',
    'verified',
    'untampered',
    'recoverable',
    'previous version',
    'original version',
    'taken at'
  ],
  es: [
    'deshacer',
    'auténtic',
    'verificad',
    'sin alterar',
    'recuperable',
    'versión anterior',
    'versión original',
    'tomada el'
  ]
};

/**
 * A sentence in each locale that the forbidden vocabulary really does match.
 *
 * The control. `code.commandError.saveFailed` is not one of this step's keys and
 * says nothing about backups; what it provides is a value each locale's list can
 * be shown to bite on, so a negative above is a statement about the dictionary
 * rather than about a list that matches nothing.
 */
const CLAIM_CONTROL: Readonly<Record<Locale, string>> = {
  en: 'This backup is authentic and the previous version is recoverable, and you may undo it.',
  es: 'Esta copia es auténtica y la versión anterior es recuperable, y puedes deshacer.'
};

describe('the backup catalogue claims nothing it cannot establish (consult Q6)', () => {
  it.each(LOCALES)('never calls a batch authentic, recoverable or a version in %s', (locale) => {
    const keys = backupCatalogueKeys();
    expect(keys.length, locale).toBe(25);
    for (const key of keys) {
      const value = DICTIONARIES[locale][key].toLowerCase();
      const claimed = FORBIDDEN_CLAIMS[locale].filter((word) => value.includes(word));
      expect(claimed, `${locale}:${key}`).toEqual([]);
    } // End of the loop over this step's dictionary keys
  }); // End of the "never claims" case

  it.each(LOCALES)('keeps that word list capable of firing in %s', (locale) => {
    const found = FORBIDDEN_CLAIMS[locale].filter((word) =>
      CLAIM_CONTROL[locale].toLowerCase().includes(word)
    );
    expect(found.length, locale).toBeGreaterThan(3);
  }); // End of the "word list can fire" case

  it.each(LOCALES)('says a missing backups folder is ordinary, not a failure, in %s', (locale) => {
    // The one sentence a person meets on a fresh install. It must not read as a
    // failure, and the whole point of `BackupRootState::Missing` being an outcome
    // rather than an error is lost if it does.
    const missing = describeBackupRootState(locale, 'Missing').toLowerCase();
    for (const alarm of ['error', 'failed', 'falló', 'fallo']) {
      expect(missing, `${locale}:${alarm}`).not.toContain(alarm);
    }
  }); // End of the "missing folder is ordinary" case

  it.each(LOCALES)('keeps a forged identity apart from a stale one in %s', (locale) => {
    // The two say opposite things about the disk: `unrecognisedBackupBatch` is
    // raised before anything is opened, and `StaleBatch` means a recognised batch
    // is no longer there. One sentence for both would tell a person their backups
    // had been tidied away when nothing was ever asked of the folder.
    const forged = describeCommandError(locale, {
      code: 'unrecognisedBackupBatch',
      batch: 'not-a-batch-name'
    });
    const stale = describeBackupReadError(locale, { StaleBatch: { batch: BATCH } });
    expect(forged, locale).not.toBe(stale);
  }); // End of the "forged apart from stale" case

  it.each(LOCALES)('never echoes a forged identity into a sentence in %s', (locale) => {
    // `batch` and `relative_path` are the caller's own strings, carried for a
    // console. A message that interpolated one would put an attacker-chosen or
    // simply meaningless string in front of a person as though it named
    // something they had chosen.
    const forged = describeCommandError(locale, {
      code: 'unaddressableBackupEntry',
      batch: BATCH.name,
      relative_path: '../outside'
    });
    expect(forged, locale).not.toContain('../outside');
    expect(forged, locale).not.toContain(BATCH.name);
  }); // End of the "never echoes a forged identity" case
}); // End of the "claims nothing it cannot establish" suite
