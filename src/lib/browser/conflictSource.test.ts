/**
 * The conflict-origin vocabulary — Phase 2d-5-1.
 *
 * **Model and type tests only, and they are about this module alone.** Phase 2d-5-5a
 * generalized the six conflict registrations and both identity-keyed maps onto
 * `ConflictSource`, and those are driven in `saveOutcome.test.ts` and
 * `workspace.test.ts`; 2d-6 is where a panel draws an origin line, and nothing draws
 * one yet. What this file pins is what this step shipped — that one wire value yields
 * one object, that two origins are told apart by a `switch` a third arm would break,
 * and that both origin lines reach a real sentence in both dictionaries.
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
  arbitrateObservation,
  conflictOriginMessage,
  conflictOriginMessageKey,
  conflictRevisionsOf,
  externalConflictSource,
  newestObservationOf,
  releaseBarrier,
  saveConflictSource,
  standingConflictOf,
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

  it('says of the watcher line that no save was initiated in response to the observation, in both locales', () => {
    // **One property of one sentence, not its meaning.** The external origin's whole
    // claim is that this application initiated no save in response to the change it
    // saw; a line that dropped that clause would read as a report of a failed save.
    // **Not "no save was attempted"** — Phase 2d-6-1a narrowed the clause (the 2d-6
    // record's §3 entry 24), because an observation the barrier held is released
    // after a write this window *did* attempt, so the old sentence was an unbounded
    // historical claim. The last two assertions are the discriminator rather than a
    // control: they show the clause belongs to the watcher line alone, so a scan
    // that matched both sentences fails here, and that the old clause is gone.
    const key = conflictOriginMessageKey({ kind: 'changedWhileOpen' });
    expect(DICTIONARIES.en[key]).toContain('No save was initiated in response to this observation');
    expect(DICTIONARIES.es[key]).toContain(
      'No se ha iniciado ningún guardado como respuesta a esta observación'
    );
    expect(DICTIONARIES.en[key].toLowerCase()).not.toContain('no save was attempted');
    expect(DICTIONARIES.es[key].toLowerCase()).not.toContain('no se intentó ningún guardado');
    expect(DICTIONARIES.en[conflictOriginMessageKey({ kind: 'refusedSave' })]).not.toContain(
      'No save was initiated'
    );
  }); // End of the "no save was initiated in response" case
}); // End of the "origin line" suite

describe('the revisions one conflict may name', () => {
  it('names three for a refused save, read off the refusal, with the moved-twice fact', () => {
    // The save arm's description is the refusal's three revisions under the labels a
    // panel already draws — expected, found, observed — and `changedAgain` is the
    // same comparison `describeConflict` makes, over the same two wire fields.
    const once = refusal();
    const description = conflictRevisionsOf(saveConflictSource(once));
    expect(description).toEqual({
      kind: 'save',
      expected: BASE,
      found: DISK,
      observed: DISK,
      changedAgain: false
    });
    const twice = makeConflict({
      disk: makeDocument({ id: TARGET, revision: 'c'.repeat(64) }),
      expected: BASE,
      found: DISK
    });
    expect(conflictRevisionsOf(saveConflictSource(twice))).toEqual({
      kind: 'save',
      expected: BASE,
      found: DISK,
      observed: 'c'.repeat(64),
      changedAgain: true
    });
  }); // End of the "three for a refused save" case

  it('names only the observed disk revision for an external change, and never the previous one', () => {
    // **Entry 10's two prohibitions, as absences.** The external arm has no
    // `expected` and no `found` — there was no save to be based on anything and no
    // locked read to have found anything — and `previousRevision` is not relabelled
    // as either: it is what the watcher tracked, not what any draft was made from.
    const seen = observation();
    expect(seen.previousRevision).toBe(BASE);
    const description = conflictRevisionsOf(externalConflictSource(seen));
    expect(description).toEqual({ kind: 'externalChange', observed: DISK });
    for (const absent of ['expected', 'found', 'changedAgain', 'previousRevision']) {
      expect(Object.hasOwn(description, absent), absent).toBe(false);
    } // End of the loop over the four names the external arm must not carry
    // No value of the description is the previous revision, under any name.
    expect(Object.values(description)).not.toContain(BASE);
    // And a first reading — no previous revision at all — describes identically.
    const first = externalConflictSource({ ...observation(), previousRevision: null });
    expect(conflictRevisionsOf(first)).toEqual({ kind: 'externalChange', observed: DISK });
  }); // End of the "only the observed disk revision" case

  it('is decided for every origin the union has, and answers a frozen value', () => {
    // The exhaustive drive over `EVERY_ORIGIN`, so a third origin fails here as well
    // as at the `never` terminus. Frozen because a description is handed to a
    // renderer and a getter behind `expected` could otherwise answer a comparison one
    // thing and a screen another.
    for (const kind of EVERY_ORIGIN) {
      const description = conflictRevisionsOf(sourceOf(kind));
      expect(description.kind, kind).toBe(kind);
      expect(Object.isFrozen(description), kind).toBe(true);
    } // End of the loop over every origin
  }); // End of the "every origin" case

  it('reads each revision off the origin exactly once', () => {
    // `CLAUDE.md` section 6's check-and-spend class, for a describer: a source is a
    // value a caller holds, and a getter that counts its reads shows the description
    // was built from one reading of each field.
    const reads = { expected: 0, found: 0, disk_revision: 0 };
    const counted: ConflictResult = {
      ...refusal(),
      get expected(): ContentRevision {
        reads.expected += 1;
        return BASE;
      },
      get found(): ContentRevision {
        reads.found += 1;
        return DISK;
      },
      get disk_revision(): ContentRevision {
        reads.disk_revision += 1;
        return DISK;
      }
    };
    conflictRevisionsOf(saveConflictSource(counted));
    expect(reads).toEqual({ expected: 1, found: 1, disk_revision: 1 });
  }); // End of the "reads each revision once" case
}); // End of the "revisions one conflict may name" suite

describe('arbitrating a watcher observation against what stands', () => {
  /** A third revision, for the observation that supersedes. */
  const LATER: ContentRevision = 'c'.repeat(64);

  /**
   * One observation of other bytes than {@link DISK}.
   *
   * @param sequence - The sequence it was admitted under.
   * @returns The observation.
   */
  function laterObservation(sequence: number): ExternalConflictObservation {
    return {
      ...observation(sequence),
      diskRevision: LATER,
      disk: makeDocument({ id: TARGET, revision: LATER })
    };
  } // End of function laterObservation()

  it('raises an observation when nothing stands for the file', () => {
    const arriving = observation();
    expect(arbitrateObservation(null, arriving, false)).toEqual({
      kind: 'raised',
      source: externalConflictSource(arriving)
    });
  });

  it('lets the standing conflict win at the same disk revision, for either origin', () => {
    // **Ruling 25.** Revision equality proves identical bytes and never origin or
    // chronology, so there is nothing for the arrival to replace — and replacing the
    // source identity alone would re-key every map this window holds for the file.
    const save = saveConflictSource(refusal());
    expect(arbitrateObservation(standingConflictOf(save), observation(99), false)).toEqual({
      kind: 'coalesced',
      standing: save
    });
    const external = externalConflictSource(observation(3));
    expect(arbitrateObservation(standingConflictOf(external), observation(99), false)).toEqual({
      kind: 'coalesced',
      standing: external
    });
  }); // End of the "same revision coalesces" case

  it('supersedes a standing conflict on a strictly later observation of other bytes', () => {
    // **Ruling 26**, and the two halves of its premise are both required: strictly
    // later by sequence, and a different revision.
    const standing = externalConflictSource(observation(3));
    const arriving = laterObservation(4);
    expect(arbitrateObservation(standingConflictOf(standing), arriving, false)).toEqual({
      kind: 'supersedes',
      superseded: standing,
      source: externalConflictSource(arriving)
    });
  }); // End of the "different revision supersedes" case

  it('refuses an observation that is not strictly later than the standing one', () => {
    // **Hashes carry no order, so only the sequence defines "later".** An equal
    // sequence is one observation delivered twice and a lower one arrived late;
    // acting on either runs a transition against state a newer one already moved.
    const standing = externalConflictSource(observation(7));
    for (const sequence of [7, 6]) {
      expect(arbitrateObservation(standingConflictOf(standing), laterObservation(sequence), false))
        .toEqual({ kind: 'notLater', standing });
    } // End of the loop over the equal and the lower sequence
  }); // End of the "not strictly later" case

  it('has no sequence to compare a save conflict by, so different bytes supersede it', () => {
    // A refused write attempt was not observed, it was attempted, so it carries no
    // observation sequence and `standingConflictOf` says `null` rather than zero.
    // What decides against it is therefore the revision alone — including for an
    // observation whose sequence is the lowest this window could admit.
    const standing = saveConflictSource(refusal());
    expect(standingConflictOf(standing).sequence).toBeNull();
    expect(standingConflictOf(standing).diskRevision).toBe(DISK);
    const arriving = laterObservation(1);
    expect(arbitrateObservation(standingConflictOf(standing), arriving, false)).toEqual({
      kind: 'supersedes',
      superseded: standing,
      source: externalConflictSource(arriving)
    });
  }); // End of the "a save conflict carries no sequence" case

  it('forbids an automatic reload while the last write may have written', () => {
    // **Ruling 27's uncertainty.** A later watcher snapshot can establish what is on
    // disk and never who put it there, so the observation still becomes the file's
    // conflict — the person is told — and the arm it comes back on is the one that
    // says no reload may be made from it. It carries what it replaced, or `null`.
    const arriving = observation();
    expect(arbitrateObservation(null, arriving, true)).toEqual({
      kind: 'raisedWithoutReload',
      source: externalConflictSource(arriving),
      superseded: null
    });
    const standing = externalConflictSource(observation(3));
    const later = laterObservation(4);
    expect(arbitrateObservation(standingConflictOf(standing), later, true)).toEqual({
      kind: 'raisedWithoutReload',
      source: externalConflictSource(later),
      superseded: standing
    });
    // **Uncertainty does not override ruling 25 or the sequence.** The same bytes are
    // still the same bytes, and an older observation is still older.
    expect(arbitrateObservation(standingConflictOf(standing), observation(9), true)).toEqual({
      kind: 'coalesced',
      standing
    });
    expect(arbitrateObservation(standingConflictOf(standing), laterObservation(2), true)).toEqual({
      kind: 'notLater',
      standing
    });
  }); // End of the "uncertainty forbids an automatic reload" case

  it('reads each operand of the arrival exactly once', () => {
    // **This project\'s named check-and-spend class** (`CLAUDE.md` section 6): a
    // property read runs arbitrary code through a getter, and `readonly` freezes
    // nothing at runtime. Both operands are taken before anything is compared, so a
    // getter cannot answer one thing to the comparison and another to the arm.
    let sequenceReads = 0;
    let revisionReads = 0;
    const base = observation(4);
    const shifting: ExternalConflictObservation = {
      ...base,
      get sequence() {
        sequenceReads += 1;
        return sequenceReads === 1 ? 4 : 1;
      },
      get diskRevision() {
        revisionReads += 1;
        return revisionReads === 1 ? LATER : DISK;
      }
    };
    const standing = externalConflictSource(observation(3));
    expect(arbitrateObservation(standingConflictOf(standing), shifting, false).kind).toBe(
      'supersedes'
    );
    expect(sequenceReads).toBe(1);
    expect(revisionReads).toBe(1);
  }); // End of the "each operand read once" case
}); // End of the arbitration suite

describe('what the write barrier does with what it held', () => {
  it('has nothing to release when it held nothing', () => {
    expect(releaseBarrier({ kind: 'nothingWritten' }, null)).toEqual({ kind: 'nothingRetained' });
    expect(releaseBarrier({ kind: 'ended', revision: DISK }, null)).toEqual({
      kind: 'nothingRetained'
    });
    expect(releaseBarrier({ kind: 'uncertain' }, null)).toEqual({ kind: 'nothingRetained' });
  });

  it('drops a held reading of exactly the bytes the transaction ended on', () => {
    // **Ruling 27\'s coalescing.** The observation is a reading of the revision this
    // window\'s own write ended on, so it is not news about a change. What it says is
    // that the two revisions are equal — never that this window wrote them.
    const held = observation();
    expect(releaseBarrier({ kind: 'ended', revision: DISK }, held)).toEqual({
      kind: 'writtenHere',
      observation: held
    });
  }); // End of the "coalesced with the write" case

  it('arbitrates anything else it held, including what an uncertain write left', () => {
    // A transaction that ended on other bytes, a refusal or a definite failure, and
    // an uncertain outcome all leave the observation to be arbitrated: the
    // uncertainty is carried by `arbitrateObservation`\'s own operand, so a held
    // observation is never silently lost.
    const held = observation();
    const other: ContentRevision = 'd'.repeat(64);
    expect(releaseBarrier({ kind: 'ended', revision: other }, held)).toEqual({
      kind: 'arbitrate',
      observation: held
    });
    expect(releaseBarrier({ kind: 'nothingWritten' }, held)).toEqual({
      kind: 'arbitrate',
      observation: held
    });
    expect(releaseBarrier({ kind: 'uncertain' }, held)).toEqual({
      kind: 'arbitrate',
      observation: held
    });
  }); // End of the "arbitrates what it held" case

  it('coalesces two held observations by keeping the newest, never by merging them', () => {
    const first = observation(3);
    const second = observation(9);
    expect(newestObservationOf(null, first)).toBe(first);
    expect(newestObservationOf(first, second)).toBe(second);
    expect(newestObservationOf(second, first)).toBe(second);
    // **Strictly greater, so an equal sequence keeps what is held**: swapping one
    // object for an equal one would change the identity `externalConflictSource`
    // memoizes on, and therefore the origin any later registration writes down.
    const equal = observation(9);
    expect(newestObservationOf(second, equal)).toBe(second);
  }); // End of the "newest, never merged" case
}); // End of the barrier suite
