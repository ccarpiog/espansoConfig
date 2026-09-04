/**
 * The conflict-origin vocabulary — Phase 2d-5-1.
 *
 * **Model and type tests only.** Nothing in this repository consumes
 * `ConflictSource` yet: 2d-5-5 is where the six existing conflict registrations are
 * generalized onto it and 2d-6 is where a panel draws an origin line. What is
 * checkable now is what this step actually shipped — that one wire value yields one
 * object, that two origins are told apart by a `switch` a third arm would break, and
 * that both origin lines reach a real sentence in both dictionaries.
 *
 * **What no case here establishes**, said in the same breath as what they do:
 * nothing pins what either sentence *means*. The i18n suites check key parity and
 * placeholder agreement and never meaning (`CLAUDE.md` section 6), and this file
 * inherits that limit exactly — it pins that a key resolves and that the two arms do
 * not resolve to one sentence, never that either sentence is true of the origin it
 * names. That remains review's.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling argument
 * is already its description carries no JSDoc of its own; ordinary helpers here do.
 */

import { describe, expect, it } from 'vitest';
import { tConflictOriginMessage } from '../i18n';
import { DICTIONARIES, translate, type TranslationKey } from '../i18n/dictionaries';
import { DEFAULT_LOCALE, LOCALES } from '../i18n/locale';
import type { ConflictResult, ContentRevision } from '../ipc/types';
import {
  conflictOriginMessage,
  conflictOriginMessageKey,
  externalConflictSource,
  saveConflictSource,
  type ConflictOriginMessage,
  type ConflictSource,
  type ExternalConflictObservation
} from './conflictSource';
import { makeConflict, makeDocument } from './fixtures';

/** The file every case here is about. */
const TARGET = 7;

/** The revision a retained draft was made from. */
const BASE: ContentRevision = 'a'.repeat(64);

/** The revision the disk holds now. */
const DISK: ContentRevision = 'b'.repeat(64);

/**
 * One refusal of the shape the boundary delivers.
 *
 * A fresh object every call, on purpose: several cases below are about the
 * difference between the same object and an equal one.
 *
 * @returns The refusal.
 */
function refusal(): ConflictResult {
  return makeConflict({ disk: makeDocument({ id: TARGET, revision: DISK }), expected: BASE });
} // End of function refusal()

/**
 * One narrowed external observation of the same file.
 *
 * A fresh object every call, for {@link refusal}'s reason.
 *
 * @param sequence - The sequence it was admitted under.
 * @returns The observation.
 */
function observation(sequence = 12): ExternalConflictObservation {
  return {
    sequence,
    document: TARGET,
    previousRevision: BASE,
    diskRevision: DISK,
    diskText: '# the file as it is now\n',
    disk: makeDocument({ id: TARGET, revision: DISK }),
    findings: [],
    correspondences: null
  };
} // End of function observation()

/**
 * Every origin one conflict can have, one key each.
 *
 * `Object.keys` over a `satisfies Record<…, true>`, which is this repository's
 * mechanism for giving a union a run-time extent: a third origin added to
 * `ConflictSource` is a compile error **in this file** rather than an arm nobody
 * drives. It is the run-time half of the `never` terminus `conflictOriginMessage`
 * carries.
 */
const EVERY_ORIGIN = Object.keys({
  save: true,
  externalChange: true
} satisfies Record<ConflictSource['kind'], true>) as readonly ConflictSource['kind'][];

/**
 * Every origin line, one key each.
 *
 * {@link EVERY_ORIGIN}'s twin one union along, and it is a separate list rather than
 * derived from that one: the map from origins to lines is what
 * `conflictOriginMessage` decides, so deriving the lines from the origins would make
 * this list agree with that function by construction instead of by test.
 */
const EVERY_LINE = Object.keys({
  refusedSave: true,
  changedWhileOpen: true
} satisfies Record<ConflictOriginMessage['kind'], true>) as readonly ConflictOriginMessage['kind'][];

/**
 * One source of the named origin.
 *
 * @param kind - Which origin to build.
 * @returns The source, through the memo that is the only honest producer.
 */
function sourceOf(kind: ConflictSource['kind']): ConflictSource {
  return kind === 'save' ? saveConflictSource(refusal()) : externalConflictSource(observation());
} // End of function sourceOf()

describe('the save-source memo', () => {
  it('gives one wire conflict one object, every time it is asked', () => {
    // The whole point: `conflictOrigins` and the reapply authorization memo in
    // `./workspace.svelte.ts` are keyed by object identity, so a second description
    // of one refusal that produced a second wrapper would silently stop finding what
    // the first one recorded.
    const conflict = refusal();
    const first = saveConflictSource(conflict);
    expect(saveConflictSource(conflict)).toBe(first);
    expect(saveConflictSource(conflict)).toBe(first);
  }); // End of the "one wire conflict one object" case

  it('gives a structurally equal but distinct refusal a different object', () => {
    // Stated rather than glossed: it is object identity and never value equality. A
    // payload round-tripped through JSON is a different key, and no type says so.
    const first = saveConflictSource(refusal());
    const second = saveConflictSource(refusal());
    expect(second).not.toBe(first);
    expect(second.kind).toBe(first.kind);
  }); // End of the "structurally equal but distinct" case

  it('carries the refusal whole, by identity, and freezes only the wrapper', () => {
    const conflict = refusal();
    const source = saveConflictSource(conflict);
    expect(source.kind).toBe('save');
    if (source.kind !== 'save') {
      throw new Error('the save arm was expected');
    }
    expect(source.conflict).toBe(conflict);
    expect(Object.isFrozen(source)).toBe(true);
    // Shallow, and the doc comment says so: the payload inside is as it arrived.
    expect(Object.isFrozen(source.conflict)).toBe(false);
  }); // End of the "carries the refusal whole" case
}); // End of the "save-source memo" suite

describe('the external-source memo', () => {
  it('gives one narrowed observation one object', () => {
    const observed = observation();
    const first = externalConflictSource(observed);
    expect(externalConflictSource(observed)).toBe(first);
  });

  it('gives a structurally equal but distinct observation a different object', () => {
    expect(externalConflictSource(observation())).not.toBe(externalConflictSource(observation()));
  });

  it('carries the observation whole, by identity', () => {
    const observed = observation(31);
    const source = externalConflictSource(observed);
    expect(source.kind).toBe('externalChange');
    if (source.kind !== 'externalChange') {
      throw new Error('the external arm was expected');
    }
    expect(source.observation).toBe(observed);
    expect(source.observation.sequence).toBe(31);
    expect(Object.isFrozen(source)).toBe(true);
  }); // End of the "carries the observation whole" case

  it('does not confuse the two memos, which are keyed on different values', () => {
    const save = saveConflictSource(refusal());
    const external = externalConflictSource(observation());
    expect(save).not.toBe(external);
    expect(save.kind).not.toBe(external.kind);
  }); // End of the "does not confuse the two memos" case
}); // End of the "external-source memo" suite

describe('the origin line', () => {
  it('is decided for every origin the union has, and the two differ', () => {
    // The exhaustive drive. `EVERY_ORIGIN` fails to compile when an origin is added;
    // this fails to pass when one is added whose line nobody decided.
    const lines = EVERY_ORIGIN.map((kind) => conflictOriginMessage(sourceOf(kind)).kind);
    expect(lines).toHaveLength(EVERY_ORIGIN.length);
    expect(new Set(lines).size).toBe(EVERY_ORIGIN.length);
    expect([...lines].sort()).toEqual([...EVERY_LINE].sort());
  }); // End of the "decided for every origin" case

  it('names the refusal for a save and the watcher for an external change', () => {
    expect(conflictOriginMessage(saveConflictSource(refusal()))).toEqual({ kind: 'refusedSave' });
    expect(conflictOriginMessage(externalConflictSource(observation()))).toEqual({
      kind: 'changedWhileOpen'
    });
  }); // End of the "names the refusal" case

  it('names a distinct entry both dictionaries really hold, for every line', () => {
    const keys: TranslationKey[] = EVERY_LINE.map((kind) => conflictOriginMessageKey({ kind }));
    expect(new Set(keys).size).toBe(keys.length);
    for (const locale of LOCALES) {
      for (const key of keys) {
        expect(translate(locale, key).trim(), `${locale}:${key}`).not.toBe('');
        expect(translate(locale, key), `${locale}:${key}`).not.toMatch(/\{[A-Za-z]/);
      } // End of the loop over the two keys
    } // End of the loop over the two locales
  }); // End of the "distinct entry both dictionaries hold" case

  it('reaches the screen through the accessor, never through a key a component built', () => {
    // `tConflictOriginMessage` is one line over `translate`, so what is checked here
    // is that it exists, is exported from the one module a component may read a
    // string from, and resolves the same key this model produced. Nothing here
    // renders anything: no component draws an origin line before 2d-6.
    for (const kind of EVERY_LINE) {
      const message: ConflictOriginMessage = { kind };
      expect(tConflictOriginMessage(message), kind).toBe(
        DICTIONARIES[DEFAULT_LOCALE][conflictOriginMessageKey(message)]
      );
    } // End of the loop over the two lines
  }); // End of the "reaches the screen through the accessor" case

  it('says of the watcher line that no save was attempted, in both locales', () => {
    // **One property of one sentence, not its meaning.** The external origin's whole
    // claim is that this application wrote nothing in response to the change it saw;
    // a line that dropped that clause would read as a report of a failed save. The
    // third assertion is the discriminator rather than a control: it shows the clause
    // belongs to the watcher line alone, so a scan that matched both sentences — the
    // way a scan for a word every sentence happens to contain would — fails here.
    const key = conflictOriginMessageKey({ kind: 'changedWhileOpen' });
    expect(DICTIONARIES.en[key].toLowerCase()).toContain('no save was attempted');
    expect(DICTIONARIES.es[key].toLowerCase()).toContain('no se intentó ningún guardado');
    expect(DICTIONARIES.en[conflictOriginMessageKey({ kind: 'refusedSave' })]).not.toContain(
      'No save was attempted'
    );
  }); // End of the "no save was attempted" case
}); // End of the "origin line" suite
