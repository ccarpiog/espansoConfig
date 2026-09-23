/**
 * The delivery envelope, the per-file automatic-reload guard and the
 * external-conflict notices — Phase 2d-6-1a.
 *
 * **Model tests only, in the node environment, and they are about this module
 * alone.** `BrowserState` in `./workspace.svelte.ts` consumes the constructors and
 * answers the guard's inputs since Phase 2d-6-1b, and `./workspace.test.ts` is
 * where that is pinned; what this file pins is what this module ships: that an
 * envelope's verdict is about the observation it carries, for every arm; that the
 * guard refuses under an unresolved uncertainty hold with no surface registered at
 * all; that every code here reaches a real sentence in both dictionaries through
 * the one accessor a component may use.
 *
 * **What no case here establishes**, said in the same breath: that a session acts
 * on the verdict it is delivered, that `BrowserState` answers the guard's three
 * inputs from its tables rather than from a panel, or what any sentence means. The
 * first two are the later steps' mounted and workspace suites; the third is
 * review's, and `../i18n/externalConflictCodes.test.ts` pins reviewed wording only.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling argument
 * is already its description carries no JSDoc of its own; ordinary helpers here do.
 */

import { describe, expect, it } from 'vitest';
import { tExternalConflictAction, tExternalConflictNotice } from '../i18n';
import { DICTIONARIES, translate, type TranslationKey } from '../i18n/dictionaries';
import { DEFAULT_LOCALE, LOCALES } from '../i18n/locale';
import type { ContentRevision } from '../ipc/types';
import {
  externalConflictSource,
  saveConflictSource,
  standingConflictOf,
  type ExternalConflictObservation,
  type ObservationVerdict,
  type StandingConflict
} from './conflictSource';
import { makeConflict, makeDocument } from './fixtures';
import {
  arbitratedDelivery,
  decideAutomaticReload,
  externalConflictActionKey,
  externalConflictNoticeKey,
  isReplacingVerdict,
  noticesBesideRefusal,
  retainedDelivery,
  writtenHereDelivery,
  type AutomaticReloadDecision,
  type AutomaticReloadGuardInputs,
  type ExternalConflictAction,
  type ExternalConflictNotice
} from './observationDelivery';

/** The file every case here is about. */
const TARGET = 5;

/** The revision a retained draft was made from. */
const BASE: ContentRevision = 'a'.repeat(64);

/** The revision the disk holds now. */
const DISK: ContentRevision = 'b'.repeat(64);

/** A third revision, for the observation that supersedes. */
const LATER: ContentRevision = 'c'.repeat(64);

/**
 * One narrowed observation of the file, of the bytes at {@link DISK}.
 *
 * A fresh object every call: several cases are about identity.
 *
 * @param sequence - The sequence it was admitted under.
 * @param revision - The bytes it read.
 * @returns The observation.
 */
function observation(sequence = 12, revision: ContentRevision = DISK): ExternalConflictObservation {
  return {
    sequence,
    document: TARGET,
    previousRevision: BASE,
    diskRevision: revision,
    diskText: '# the file as it is now\n',
    disk: makeDocument({ id: TARGET, revision }),
    findings: [],
    correspondences: null
  };
} // End of function observation()

/**
 * What stands for the file when a refused save does.
 *
 * @returns The standing conflict, captured through the one producer.
 */
function standingSave(): StandingConflict {
  return standingConflictOf(
    saveConflictSource(
      makeConflict({ disk: makeDocument({ id: TARGET, revision: DISK }), expected: BASE })
    )
  );
} // End of function standingSave()

/**
 * What stands for the file when an earlier observation does.
 *
 * @param sequence - The sequence the standing observation was admitted under.
 * @returns The standing conflict, captured through the one producer.
 */
function standingExternal(sequence: number): StandingConflict {
  return standingConflictOf(externalConflictSource(observation(sequence)));
} // End of function standingExternal()

describe('the delivery envelope', () => {
  it('seals a raised verdict about exactly the observation it carries', () => {
    const seen = observation();
    const delivery = arbitratedDelivery(null, seen, false);
    expect(delivery.observation).toBe(seen);
    expect(delivery.verdict.kind).toBe('raised');
    if (delivery.verdict.kind !== 'raised') {
      throw new Error('the raised arm is what this case is about');
    }
    // The memoized origin, not a fresh wrapper — so the session's model and the
    // window's registration are keyed on one object.
    expect(delivery.verdict.source).toBe(externalConflictSource(seen));
    expect(delivery.verdict.source.observation).toBe(seen);
  }); // End of the "raised about the carried observation" case

  it('seals the uncertainty arm when the last write may have written', () => {
    const seen = observation();
    const fresh = arbitratedDelivery(null, seen, true);
    expect(fresh.verdict).toEqual({
      kind: 'raisedWithoutReload',
      source: externalConflictSource(seen),
      superseded: null
    });
    const standing = standingSave();
    const over = arbitratedDelivery(standing, observation(12, LATER), true);
    expect(over.verdict.kind).toBe('raisedWithoutReload');
    if (over.verdict.kind !== 'raisedWithoutReload') {
      throw new Error('the uncertainty arm is what this case is about');
    }
    expect(over.verdict.superseded).toBe(standing.source);
  }); // End of the "uncertainty arm" case

  it('seals every arbitrated arm, and each replacing arm names the sealed observation', () => {
    // One envelope per arm a pure arbitration can answer, driven against the
    // standing origins that produce it. What is checked of every replacing arm is
    // the property the two constructors exist for: the verdict's source wraps the
    // observation the envelope carries, never another one.
    const cases: readonly [string, StandingConflict | null, ExternalConflictObservation, boolean][] =
      [
        ['raised', null, observation(), false],
        ['raisedWithoutReload', null, observation(), true],
        ['supersedes', standingSave(), observation(12, LATER), false],
        ['coalesced', standingSave(), observation(), false],
        ['notLater', standingExternal(20), observation(12, LATER), false]
      ];
    for (const [expected, standing, seen, uncertain] of cases) {
      const delivery = arbitratedDelivery(standing, seen, uncertain);
      expect(delivery.verdict.kind, expected).toBe(expected);
      expect(delivery.observation, expected).toBe(seen);
      if (isReplacingVerdict(delivery.verdict)) {
        expect(delivery.verdict.source.observation, expected).toBe(delivery.observation);
      } else {
        // The narrowed `ArbitratedDelivery` leaves only the two standing-carrying
        // arms here: `retained` and `writtenHere` are not in its verdict type.
        expect(delivery.verdict.standing, expected).toBe(standing?.source);
      }
    } // End of the loop over every arbitrated arm
  }); // End of the "every arbitrated arm" case

  it('never seals a retained or writtenHere verdict through arbitration, and seals each only through its own constructor', () => {
    // `retained` and `writtenHere` are the two arms a pure arbitration cannot
    // answer — it holds no barrier and knows no settlement — so the arbitrating
    // constructor never produces either, whatever the operands, and each of the
    // other two constructors produces exactly its own arm.
    for (const standing of [null, standingSave(), standingExternal(1)]) {
      for (const uncertain of [false, true]) {
        const kind: string = arbitratedDelivery(standing, observation(), uncertain).verdict.kind;
        expect(kind).not.toBe('retained');
        expect(kind).not.toBe('writtenHere');
      } // End of the loop over both uncertainty answers
    } // End of the loop over three standing origins
    const seen = observation();
    const held = retainedDelivery(seen);
    expect(held.observation).toBe(seen);
    expect(held.verdict).toEqual({ kind: 'retained' });
    const dropped = writtenHereDelivery(seen);
    expect(dropped.observation).toBe(seen);
    expect(dropped.verdict).toEqual({ kind: 'writtenHere' });
    expect(isReplacingVerdict(dropped.verdict)).toBe(false);
  }); // End of the "retained and writtenHere only through their constructors" case

  it('is frozen, so one recipient cannot change what a sibling recipient reads', () => {
    const arbitrated = arbitratedDelivery(null, observation(), false);
    const held = retainedDelivery(observation());
    const dropped = writtenHereDelivery(observation());
    for (const delivery of [arbitrated, held, dropped]) {
      expect(Object.isFrozen(delivery)).toBe(true);
      expect(() => {
        (delivery as { verdict: ObservationVerdict }).verdict = { kind: 'retained' };
      }).toThrow(TypeError);
    } // End of the loop over the three constructors' envelopes
    // Shallow, and said so: the observation inside is the caller's object as it was.
    expect(Object.isFrozen(arbitrated.observation)).toBe(false);
  }); // End of the "frozen" case
}); // End of the "delivery envelope" suite

describe('which verdicts replace what a surface shows', () => {
  /**
   * Every verdict arm, one key each.
   *
   * `Object.keys` over a `satisfies Record<…, true>`: an eighth arm of
   * `ObservationVerdict` is a compile error **here** rather than an arm nobody
   * drives — the run-time half of the `never` terminus `isReplacingVerdict` carries.
   */
  const EVERY_VERDICT = Object.keys({
    retained: true,
    writtenHere: true,
    raised: true,
    raisedWithoutReload: true,
    supersedes: true,
    coalesced: true,
    notLater: true
  } satisfies Record<ObservationVerdict['kind'], true>) as readonly ObservationVerdict['kind'][];

  /**
   * One verdict of the named arm.
   *
   * @param kind - Which arm to build.
   * @returns A verdict of that arm, with real origins where the arm carries one.
   */
  function verdictOf(kind: ObservationVerdict['kind']): ObservationVerdict {
    const source = externalConflictSource(observation());
    const standing = standingSave().source;
    switch (kind) {
      case 'retained':
        return { kind };
      case 'writtenHere':
        return { kind };
      case 'raised':
        return { kind, source };
      case 'raisedWithoutReload':
        return { kind, source, superseded: standing };
      case 'supersedes':
        return { kind, source, superseded: standing };
      case 'coalesced':
        return { kind, standing };
      case 'notLater':
        return { kind, standing };
    }
  } // End of function verdictOf()

  it('names exactly the three arms that carry a new origin', () => {
    const replacing = EVERY_VERDICT.filter((kind) => isReplacingVerdict(verdictOf(kind)));
    expect([...replacing].sort()).toEqual(['raised', 'raisedWithoutReload', 'supersedes']);
    expect(EVERY_VERDICT).toHaveLength(7);
  });

  it('narrows to a verdict whose source is the memoized origin', () => {
    const verdict = verdictOf('supersedes');
    if (!isReplacingVerdict(verdict)) {
      throw new Error('supersedes is a replacing verdict');
    }
    expect(verdict.source.kind).toBe('externalChange');
  });
}); // End of the "which verdicts replace" suite

describe('the per-file automatic-reload guard', () => {
  /**
   * Every combination of the three inputs, with the decision each is owed.
   *
   * Eight rows written by hand rather than generated, so the expected decision of
   * every row is a statement this file makes and not one derived from the function
   * under test. The order of refusal reasons is the one the doc names: uncertainty,
   * then retained, then surface.
   */
  const EVERY_COMBINATION: readonly [AutomaticReloadGuardInputs, AutomaticReloadDecision][] = [
    [
      { uncertaintyUnresolved: false, observationRetained: false, surfaceOpen: false },
      { kind: 'permitted' }
    ],
    [
      { uncertaintyUnresolved: false, observationRetained: false, surfaceOpen: true },
      { kind: 'refused', reason: 'surfaceOpen' }
    ],
    [
      { uncertaintyUnresolved: false, observationRetained: true, surfaceOpen: false },
      { kind: 'refused', reason: 'observationRetained' }
    ],
    [
      { uncertaintyUnresolved: false, observationRetained: true, surfaceOpen: true },
      { kind: 'refused', reason: 'observationRetained' }
    ],
    [
      { uncertaintyUnresolved: true, observationRetained: false, surfaceOpen: false },
      { kind: 'refused', reason: 'uncertaintyUnresolved' }
    ],
    [
      { uncertaintyUnresolved: true, observationRetained: false, surfaceOpen: true },
      { kind: 'refused', reason: 'uncertaintyUnresolved' }
    ],
    [
      { uncertaintyUnresolved: true, observationRetained: true, surfaceOpen: false },
      { kind: 'refused', reason: 'uncertaintyUnresolved' }
    ],
    [
      { uncertaintyUnresolved: true, observationRetained: true, surfaceOpen: true },
      { kind: 'refused', reason: 'uncertaintyUnresolved' }
    ]
  ];

  it('decides every combination of its three inputs as the table says', () => {
    for (const [inputs, expected] of EVERY_COMBINATION) {
      expect(decideAutomaticReload(inputs), JSON.stringify(inputs)).toEqual(expected);
    } // End of the loop over the eight combinations
    expect(EVERY_COMBINATION).toHaveLength(8);
  });

  it('permits only when every guard permits', () => {
    const permitted = EVERY_COMBINATION.filter(([, decision]) => decision.kind === 'permitted');
    expect(permitted).toHaveLength(1);
    expect(permitted[0]![0]).toEqual({
      uncertaintyUnresolved: false,
      observationRetained: false,
      surfaceOpen: false
    });
  });

  it('refuses under an unresolved uncertainty hold with no surface registered at all', () => {
    // **The negative case the 2d-6 record's §3 entry 15 names**: the hold blocks
    // automatic rereading *after its surface closes*, per file, never dependent on
    // a mounted panel. `surfaceOpen: false` is the state of a file whose surface has
    // closed — no registration, nothing mounted — and the answer is still a refusal,
    // for the uncertainty and not for anything about a panel.
    const decision = decideAutomaticReload({
      uncertaintyUnresolved: true,
      observationRetained: false,
      surfaceOpen: false
    });
    expect(decision).toEqual({ kind: 'refused', reason: 'uncertaintyUnresolved' });
  }); // End of the "uncertainty with no surface" case

  it('names the uncertainty first when more than one guard refuses', () => {
    // The strongest claim wins the reason: an unknown write outcome is the one
    // state under which even an empty registry may not reread, so it is never
    // masked by a weaker refusal that happens to hold as well.
    expect(
      decideAutomaticReload({
        uncertaintyUnresolved: true,
        observationRetained: true,
        surfaceOpen: true
      })
    ).toEqual({ kind: 'refused', reason: 'uncertaintyUnresolved' });
    expect(
      decideAutomaticReload({
        uncertaintyUnresolved: false,
        observationRetained: true,
        surfaceOpen: true
      })
    ).toEqual({ kind: 'refused', reason: 'observationRetained' });
  }); // End of the "precedence" case

  it('reads each input exactly once, before deciding', () => {
    // `CLAUDE.md` section 6's check-and-spend class: the inputs are a value a
    // caller assembled, and a getter behind one could answer one thing to the
    // decision and another to whoever records its reason. Every field is read once,
    // whatever the answer — including the fields a short-circuit would skip.
    const reads = { uncertaintyUnresolved: 0, observationRetained: 0, surfaceOpen: 0 };
    const counted: AutomaticReloadGuardInputs = {
      get uncertaintyUnresolved(): boolean {
        reads.uncertaintyUnresolved += 1;
        return true;
      },
      get observationRetained(): boolean {
        reads.observationRetained += 1;
        return true;
      },
      get surfaceOpen(): boolean {
        reads.surfaceOpen += 1;
        return true;
      }
    };
    decideAutomaticReload(counted);
    expect(reads).toEqual({ uncertaintyUnresolved: 1, observationRetained: 1, surfaceOpen: 1 });
  }); // End of the "reads each input once" case
}); // End of the "per-file automatic-reload guard" suite

describe('the external-conflict notices and action', () => {
  /**
   * Every notice, one key each — the run-time half of the `never` terminus.
   */
  const EVERY_NOTICE = Object.keys({
    observationRetained: true,
    writeOutcomeUnknown: true
  } satisfies Record<ExternalConflictNotice['kind'], true>) as readonly ExternalConflictNotice['kind'][];

  /** Every action, one key each. */
  const EVERY_ACTION = Object.keys({
    acknowledgeSnapshot: true
  } satisfies Record<ExternalConflictAction['kind'], true>) as readonly ExternalConflictAction['kind'][];

  it('name a distinct entry both dictionaries really hold, for every code', () => {
    const keys: TranslationKey[] = [
      ...EVERY_NOTICE.map((kind) => externalConflictNoticeKey({ kind })),
      ...EVERY_ACTION.map((kind) => externalConflictActionKey({ kind }))
    ];
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(key.startsWith('browser.externalConflict.'), key).toBe(true);
      for (const locale of LOCALES) {
        expect(translate(locale, key).trim(), `${locale}:${key}`).not.toBe('');
        expect(translate(locale, key), `${locale}:${key}`).not.toMatch(/\{[A-Za-z]/);
      } // End of the loop over the two locales
    } // End of the loop over every key
  }); // End of the "distinct entry both dictionaries hold" case

  it('reach the screen through the accessors, never through a key a component built', () => {
    // Each `t*` wrapper is one line over the describer in `../i18n/codes`; what is
    // checked is that it exists, is exported from the one module a component may
    // read a string from, and resolves the key this model produced. Nothing here
    // renders anything: no component draws either before a later 2d-6 step.
    for (const kind of EVERY_NOTICE) {
      const notice: ExternalConflictNotice = { kind };
      expect(tExternalConflictNotice(notice), kind).toBe(
        DICTIONARIES[DEFAULT_LOCALE][externalConflictNoticeKey(notice)]
      );
    } // End of the loop over every notice
    for (const kind of EVERY_ACTION) {
      const action: ExternalConflictAction = { kind };
      expect(tExternalConflictAction(action), kind).toBe(
        DICTIONARIES[DEFAULT_LOCALE][externalConflictActionKey(action)]
      );
    } // End of the loop over every action
  }); // End of the "reaches the screen through the accessor" case
}); // End of the "external-conflict notices and action" suite

describe('the notices drawn beside a refusal line — Phase 2d-6-7b', () => {
  it('drops only the notice the refusal already says, keeps the order, and keeps every notice otherwise', () => {
    const both = [{ kind: 'writeOutcomeUnknown' }, { kind: 'observationRetained' }] as const;
    expect(noticesBesideRefusal(both, 'observationRetained')).toEqual([{ kind: 'writeOutcomeUnknown' }]);
    expect(noticesBesideRefusal(both, 'writeOutcomeUnknown')).toEqual([{ kind: 'observationRetained' }]);
    expect(noticesBesideRefusal(both, null)).toBe(both);
    expect(noticesBesideRefusal([], 'observationRetained')).toEqual([]);
  }); // End of the "drops only the restated notice" case
}); // End of the "notices beside a refusal" suite
