/**
 * The part of *Keep my draft* every surface shares, driven without a screen.
 *
 * Four groups:
 *
 * 1. **the gate** — {@link beginReapply}, and in particular that a surface's
 *    permanent `reapplySupport` is read **before** the conflict, so *this cannot be
 *    done here* is never reported as *there is nothing to do*;
 * 2. **the evidence readers** — every arm of both wire enums, including the two
 *    empty subject arms that collapse to one answer and the one that must not;
 * 3. **the adoption** — one *wire* conflict, one token: a second attempt presents
 *    the token the first spent, whether it comes from the same `ConflictModel` or
 *    from a second description of the same `ConflictResult`;
 * 4. **what a caller cannot do** — the refusal arms adopt nothing.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { describe, expect, it, vi } from 'vitest';
import { DICTIONARIES, type TranslationKey } from '../i18n/dictionaries';
import { LOCALES } from '../i18n/locale';
import type {
  ConflictResult,
  MatchView,
  ReapplyPlacement,
  ReapplyResolution
} from '../ipc/types';
import { startDraft, textDraftRules } from './draft';
import { makeConflict, makeDocument, makeMatch } from './fixtures';
import {
  adoptForReapply,
  anchorCorrespondence,
  attemptOfReapply,
  beginReapply,
  reapplyOutcomeKey,
  reapplyReveal,
  reapplyToShow,
  sharedReapplyObstacleKey,
  subjectCorrespondence,
  subjectIsTargetless,
  type ReapplyOutcomeCode
} from './reapply';
import {
  authorizeDiskAdoption,
  describeEditSave,
  type ConflictCapabilities,
  type ConflictModel,
  type DiskAdoptionOutcome,
  type ReloadConfirmation
} from './saveOutcome';

/** A surface that can reapply. The five match surfaces' declaration. */
const SUPPORTED: ConflictCapabilities = {
  draftKind: 'authoredText',
  reloadOutcome: 'closesSurface',
  offersCopyDraft: true,
  offersReload: true,
  offersReapply: true,
  reapplySupport: 'supported'
};

/**
 * A surface that never can. The raw editor's declaration, both halves.
 *
 * `beginReapply` reads only `reapplySupport`; `offersReapply` is set to the raw
 * editor's own `false` so this constant is that surface rather than a variant of
 * the one above, and the case that drives the gate over `reapplySupport` alone
 * says so where it drives it.
 */
const UNAVAILABLE: ConflictCapabilities = {
  ...SUPPORTED,
  offersReapply: false,
  reapplySupport: 'unavailable'
};

/** The snippet a case's disk snapshot holds. */
const TARGET: MatchView = makeMatch({ node: 40, document: 2, revision: 'rev-c', trigger: ':sig' });

/**
 * A conflict model carrying chosen correspondence evidence.
 *
 * @param subject - What the search for the operation's own snippet found.
 * @param placement - What the search for its positional anchor found.
 * @returns The model a surface would be holding.
 */
function conflictWith(
  subject: ReapplyResolution = { Unsupported: {} },
  placement: ReapplyPlacement = { NotAnchored: {} }
): ConflictModel<string> {
  const disk = makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision: 'rev-c',
    matches: [TARGET]
  });
  return modelOf(makeConflict({ disk, subject, placement }));
} // End of function conflictWith()

/**
 * One description of a wire conflict, as a surface would hold it.
 *
 * Separate from {@link conflictWith} so a case can describe **the same**
 * `ConflictResult` twice: `describeEditSave` builds a fresh model per call, and two
 * models over one wire value is the case the 2c-4b-2 review found unguarded.
 *
 * @param result - The conflict exactly as it crossed the boundary.
 * @returns The model that description produced.
 */
function modelOf(result: ConflictResult): ConflictModel<string> {
  const model = describeEditSave(
    result,
    startDraft('rev-a', 'typed', textDraftRules),
    SUPPORTED
  );
  if (model.kind !== 'conflict') {
    throw new Error('this suite is about the conflict arm');
  }
  return model;
} // End of function modelOf()

/**
 * The two checks `BrowserState.adoptDiskVersion` makes about the token itself.
 *
 * The real method's first two arms, and no more: was this confirmation issued for
 * this exact model, and has it already been spent. The window-side arms — origin,
 * projection held, projection generation — need a real `BrowserState` and are
 * driven in `workspace.test.ts`.
 *
 * @returns The adoption callback, and the tokens it was handed in order.
 */
function tokenCheckingAdoption(): {
  readonly adopt: (
    conflict: ConflictModel<string>,
    confirmation: ReloadConfirmation
  ) => DiskAdoptionOutcome;
  readonly seen: ReloadConfirmation[];
} {
  const seen: ReloadConfirmation[] = [];
  const spent = new Set<ReloadConfirmation>();
  return {
    seen,
    adopt: (conflict, confirmation) => {
      seen.push(confirmation);
      if (authorizeDiskAdoption(conflict, confirmation) === null || spent.has(confirmation)) {
        return 'refused';
      }
      spent.add(confirmation);
      return 'installed';
    }
  };
} // End of function tokenCheckingAdoption()

describe('the gate', () => {
  it('answers unavailable for a surface that can never reapply, conflict or not', () => {
    // **Support is checked before the conflict, and that ordering is the claim.**
    // *This cannot be done here* is permanent; *there is nothing to do* is a state,
    // and answering the second for the raw editor would invite a caller to
    // conclude the first was temporary.
    expect(beginReapply(UNAVAILABLE, null)).toEqual({ kind: 'unavailable' });
    expect(beginReapply(UNAVAILABLE, conflictWith())).toEqual({ kind: 'unavailable' });
  });

  it('answers notAttempted for a supporting surface with no conflict', () => {
    expect(beginReapply(SUPPORTED, null)).toEqual({ kind: 'notAttempted' });
  });

  it('hands back the conflict and the evidence that arrived on its own payload', () => {
    // Read off `ConflictModel.source` — the wire value itself — and never from a
    // second read, which is consult Q9's second failure mode designed out.
    const conflict = conflictWith({ Identified: { target: TARGET } });
    const start = beginReapply(SUPPORTED, conflict);
    expect(start.kind).toBe('ready');
    if (start.kind !== 'ready') {
      throw new Error('the ready arm is what this case is about');
    }
    expect(start.conflict).toBe(conflict);
    expect(start.evidence).toBe(conflict.source.reapply);
  });
}); // End of the gate suite

describe('the evidence readers', () => {
  it('reads an identified subject as the snippet the disk snapshot projects', () => {
    const answer = subjectCorrespondence(
      conflictWith({ Identified: { target: TARGET } }).source.reapply
    );
    expect(answer).toEqual({ kind: 'identified', target: TARGET });
  });

  it('reads a refused subject as its own wire code', () => {
    const answer = subjectCorrespondence(
      conflictWith({ Refused: { reason: 'AmbiguousTrigger' } }).source.reapply
    );
    expect(answer).toEqual({ kind: 'refused', reason: 'AmbiguousTrigger' });
  });

  it('collapses both empty subject arms into "no snippet to find"', () => {
    // Neither gives a surface a target, so a surface that needs one treats them
    // alike. Which of the two it was stays readable — the next case is what says
    // the collapse did not lose it.
    for (const subject of [{ Unsupported: {} }, { Targetless: {} }] as const) {
      expect(subjectCorrespondence(conflictWith(subject).source.reapply)).toEqual({
        kind: 'noSubject'
      });
    } // End of the loop over the two empty subject arms
  });

  it('still tells a creation apart from a whole-document save', () => {
    // 2c-4b-1's D7: `Targetless` is *this change brings its own snippet* and
    // `Unsupported` is *there is nothing here to reapply at all*. The creator is
    // the only caller, and it needs the distinction the collapse above does not
    // carry.
    expect(subjectIsTargetless(conflictWith({ Targetless: {} }).source.reapply)).toBe(true);
    expect(subjectIsTargetless(conflictWith({ Unsupported: {} }).source.reapply)).toBe(false);
    expect(
      subjectIsTargetless(conflictWith({ Identified: { target: TARGET } }).source.reapply)
    ).toBe(false);
  });

  it('reads all three placement arms', () => {
    const identified = conflictWith(undefined, { Identified: { target: TARGET } });
    expect(anchorCorrespondence(identified.source.reapply)).toEqual({
      kind: 'identified',
      target: TARGET
    });
    const refused = conflictWith(undefined, { Refused: { reason: 'NoExactCorrespondence' } });
    expect(anchorCorrespondence(refused.source.reapply)).toEqual({
      kind: 'refused',
      reason: 'NoExactCorrespondence'
    });
    expect(anchorCorrespondence(conflictWith().source.reapply)).toEqual({ kind: 'notAnchored' });
  });
}); // End of the evidence readers suite

describe('the adoption', () => {
  it('spends one token per conflict, so a second attempt presents the spent one', () => {
    // **One conflict, one spend.** A reapply asks no second question, so there is
    // no `confirming` step to hold a token on; minting a fresh one per attempt
    // would hand every attempt a token the window's spent-confirmation guard had
    // never seen.
    const conflict = conflictWith({ Identified: { target: TARGET } });
    const window = tokenCheckingAdoption();

    expect(adoptForReapply(conflict, window.adopt)).toBe('installed');
    expect(adoptForReapply(conflict, window.adopt)).toBe('refused');
    expect(window.seen).toHaveLength(2);
    expect(window.seen[0]).toBe(window.seen[1]);
  });

  it('hands two descriptions of one wire conflict the same token', () => {
    // **The memo is keyed on `ConflictModel.source`, the wire value**, which is the
    // key `rememberTheConflict` uses for the same conflict. `describeEditSave`
    // builds a fresh model per call, so keying on the model would give the second
    // description an unspent token and one wire conflict two successful adoptions —
    // the 2c-4b-2 review's first finding.
    const disk = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-c',
      matches: [TARGET]
    });
    const wire = makeConflict({ disk, subject: { Identified: { target: TARGET } } });
    const first = modelOf(wire);
    const second = modelOf(wire);
    expect(first).not.toBe(second);
    expect(first.source).toBe(second.source);

    const window = tokenCheckingAdoption();
    expect(adoptForReapply(first, window.adopt)).toBe('installed');
    // The second description presents the first's token, which the door refuses:
    // it was issued for the other model, and it has been spent besides.
    expect(adoptForReapply(second, window.adopt)).toBe('refused');
    expect(window.seen[0]).toBe(window.seen[1]);
  });

  it('mints a different token for a different wire conflict', () => {
    // Two payloads are two questions, however alike they look: the key is the wire
    // value's own identity and nothing about its fields.
    const seen: unknown[] = [];
    const adopt = (_conflict: ConflictModel<string>, confirmation: object): DiskAdoptionOutcome => {
      seen.push(confirmation);
      return 'installed';
    };
    adoptForReapply(conflictWith(), adopt);
    adoptForReapply(conflictWith(), adopt);
    expect(seen[0]).not.toBe(seen[1]);
  });

  it('passes the window answer through unchanged, all three arms', () => {
    // `alreadyThere` is a success with nothing to install, and a boolean could not
    // have carried it — the defect the 2c-4a-2 confirmation pass shipped.
    for (const answer of ['installed', 'alreadyThere', 'refused'] as const) {
      const adopt = vi.fn(() => answer);
      expect(adoptForReapply(conflictWith(), adopt)).toBe(answer);
      expect(adopt).toHaveBeenCalledTimes(1);
    } // End of the loop over the three adoption outcomes
  });
}); // End of the adoption suite

describe('what one attempt leaves a panel holding', () => {
  /** A session, as an identity a case can compare by reference. */
  interface Held {
    /** Which one this is, so a failure names it. */
    readonly name: string;
  }

  /** The session a panel is showing before an attempt. */
  const BEFORE: Held = { name: 'before' };

  /** The session a successful attempt hands back. */
  const AFTER: Held = { name: 'after' };

  it('replaces the session on the two arms that adopted, and on no other', () => {
    // **The rule five panels would otherwise each have written.** `reapplied` and
    // `alreadySatisfied` have already installed the disk snapshot, so the session
    // they carry is the one to hold; the other four adopted nothing and leave the
    // window exactly where it was.
    const carried = [
      { kind: 'reapplied', session: AFTER },
      { kind: 'alreadySatisfied', session: AFTER }
    ] as const;
    for (const outcome of carried) {
      expect(attemptOfReapply(BEFORE, outcome).session, outcome.kind).toBe(AFTER);
    } // End of the loop over the two arms that carry a session

    const kept = [
      { kind: 'manualResolution', obstacle: { kind: 'evidenceNotATarget' } },
      { kind: 'adoptionRefused' },
      { kind: 'unavailable' },
      { kind: 'notAttempted' }
    ] as const;
    for (const outcome of kept) {
      expect(attemptOfReapply(BEFORE, outcome).session, outcome.kind).toBe(BEFORE);
    } // End of the loop over the four arms that carry none
  }); // End of the "which arms replace the session" case

  it('reports an attempt only while the session it produced is the one on screen', () => {
    // What makes a stale report impossible rather than unlikely: the comparison is
    // reference equality, and every transition in this repository returns a new
    // session value, so the next thing a person does drops the report.
    const attempt = attemptOfReapply(BEFORE, { kind: 'adoptionRefused' });
    expect(reapplyToShow(attempt, BEFORE)).toBe(attempt.outcome);
    expect(reapplyToShow(attempt, { name: 'before' })).toBeNull();
    expect(reapplyToShow(null, BEFORE)).toBeNull();
  });

  it('gives every arm a sentence, in both languages', () => {
    // A `Record` over the union rather than an array, so a seventh arm is a
    // compile error here as well as in `reapplyOutcomeKey`.
    const every = Object.keys({
      reapplied: true,
      alreadySatisfied: true,
      manualResolution: true,
      adoptionRefused: true,
      unavailable: true,
      notAttempted: true
    } satisfies Record<ReapplyOutcomeCode, true>) as readonly ReapplyOutcomeCode[];
    const keys = new Set<TranslationKey>();
    for (const code of every) {
      const key = reapplyOutcomeKey(code);
      keys.add(key);
      for (const locale of LOCALES) {
        expect(DICTIONARIES[locale][key].length, `${locale}:${code}`).toBeGreaterThan(0);
      } // End of the loop over the two locales
    } // End of the loop over every arm
    // Six arms, six keys: one arm wearing another's sentence would satisfy every
    // assertion above.
    expect(keys.size).toBe(every.length);
  }); // End of the "every arm has a sentence" case

  it('gives both shared obstacles a sentence of their own, in both languages', () => {
    const first = sharedReapplyObstacleKey({
      kind: 'correspondence',
      reason: 'AmbiguousTrigger'
    });
    const second = sharedReapplyObstacleKey({ kind: 'evidenceNotATarget' });
    expect(first).not.toBe(second);
    for (const key of [first, second]) {
      for (const locale of LOCALES) {
        expect(DICTIONARIES[locale][key].length, `${locale}:${key}`).toBeGreaterThan(0);
      } // End of the loop over the two locales
    } // End of the loop over the two shared obstacles
  });
}); // End of the "what one attempt leaves a panel holding" suite

describe('what a panel must ask to have brought into view', () => {
  /*
   * **2c-4b-3c-2 §11.1's repair, at the only end a test can reach.** The finding
   * is that a refused reapply reported itself entirely above the scrollport on
   * five surfaces in both languages, because nothing in the application pointed a
   * viewport at the report block.
   *
   * **Nothing in this file, and nothing in any mounted suite, can fail because of
   * that.** Neither has a viewport: vitest's default environment lays nothing out
   * at all, and jsdom does not implement `scrollIntoView`. What is checked here is
   * the *decision* — which cue each arm gets — and what a mounted suite adds is
   * that a component binds the block and runs the effect. That a person sees the
   * sentence is 3d-2's window reading and nothing else.
   */

  it('asks for nothing when no report is drawn', () => {
    expect(reapplyReveal(null)).toBe('none');
  });

  it('asks for the report block on every arm, success included', () => {
    // A `Record` over the union for the same reason the sentence case above uses
    // one: a seventh arm is a compile error here, so whoever adds it decides
    // whether their report is asked for rather than inheriting an answer.
    const every = Object.keys({
      reapplied: true,
      alreadySatisfied: true,
      manualResolution: true,
      adoptionRefused: true,
      unavailable: true,
      notAttempted: true
    } satisfies Record<ReapplyOutcomeCode, true>) as readonly ReapplyOutcomeCode[];
    for (const code of every) {
      expect(reapplyReveal(code), code).toBe('reportPanel');
    } // End of the loop over every arm
  }); // End of the "asks for the report block on every arm" case
}); // End of the "what a panel must ask to have brought into view" suite
