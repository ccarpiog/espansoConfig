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
import { tExternalEvidenceRefusal } from '../i18n';
import type {
  ConflictResult,
  CorrespondenceEntry,
  CorrespondenceTable,
  MatchView,
  ReapplyPlacement,
  ReapplyResolution
} from '../ipc/types';
import {
  externalConflictSource,
  type ConflictSource,
  type ExternalConflictObservation
} from './conflictSource';
import { startDraft, textDraftRules } from './draft';
import { makeConflict, makeDocument, makeMatch } from './fixtures';
import {
  adoptForReapply,
  anchorCorrespondence,
  attemptOfReapply,
  beginReapply,
  externalEvidenceRefusalKey,
  reapplyEvidenceFor,
  reapplyOutcomeKey,
  reapplyReveal,
  reapplyToShow,
  sharedReapplyObstacleKey,
  subjectCorrespondence,
  subjectIsTargetless,
  SUPERSEDED_EVIDENCE_KEY,
  type ExternalEvidenceRefusal,
  type ReapplyEvidenceAccess,
  type ReapplyOutcomeCode
} from './reapply';
import {
  authorizeDiskAdoption,
  describeEditSave,
  describeExternalConflict,
  type ConflictCapabilities,
  type ConflictModel,
  type DiskAdoptionOutcome,
  type ReloadConfirmation,
  type SaveConflictModel
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
): SaveConflictModel<string> {
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
function modelOf(result: ConflictResult): SaveConflictModel<string> {
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
    // Read off `SaveConflictModel.source` — the origin wrapping the wire value —
    // and never from a second read, which is consult Q9's second failure mode
    // designed out.
    const conflict = conflictWith({ Identified: { target: TARGET } });
    const start = beginReapply(SUPPORTED, conflict);
    expect(start.kind).toBe('ready');
    if (start.kind !== 'ready') {
      throw new Error('the ready arm is what this case is about');
    }
    expect(start.conflict).toBe(conflict);
    expect(start.evidence).toBe(conflict.source.conflict.reapply);
  });
}); // End of the gate suite

describe('the evidence readers', () => {
  it('reads an identified subject as the snippet the disk snapshot projects', () => {
    const answer = subjectCorrespondence(
      conflictWith({ Identified: { target: TARGET } }).source.conflict.reapply
    );
    expect(answer).toEqual({ kind: 'identified', target: TARGET });
  });

  it('reads a refused subject as its own wire code', () => {
    const answer = subjectCorrespondence(
      conflictWith({ Refused: { reason: 'AmbiguousTrigger' } }).source.conflict.reapply
    );
    expect(answer).toEqual({ kind: 'refused', reason: 'AmbiguousTrigger' });
  });

  it('collapses both empty subject arms into "no snippet to find"', () => {
    // Neither gives a surface a target, so a surface that needs one treats them
    // alike. Which of the two it was stays readable — the next case is what says
    // the collapse did not lose it.
    for (const subject of [{ Unsupported: {} }, { Targetless: {} }] as const) {
      expect(subjectCorrespondence(conflictWith(subject).source.conflict.reapply)).toEqual({
        kind: 'noSubject'
      });
    } // End of the loop over the two empty subject arms
  });

  it('still tells a creation apart from a whole-document save', () => {
    // 2c-4b-1's D7: `Targetless` is *this change brings its own snippet* and
    // `Unsupported` is *there is nothing here to reapply at all*. The creator is
    // the only caller, and it needs the distinction the collapse above does not
    // carry.
    expect(subjectIsTargetless(conflictWith({ Targetless: {} }).source.conflict.reapply)).toBe(true);
    expect(subjectIsTargetless(conflictWith({ Unsupported: {} }).source.conflict.reapply)).toBe(false);
    expect(
      subjectIsTargetless(conflictWith({ Identified: { target: TARGET } }).source.conflict.reapply)
    ).toBe(false);
  });

  it('reads all three placement arms', () => {
    const identified = conflictWith(undefined, { Identified: { target: TARGET } });
    expect(anchorCorrespondence(identified.source.conflict.reapply)).toEqual({
      kind: 'identified',
      target: TARGET
    });
    const refused = conflictWith(undefined, { Refused: { reason: 'NoExactCorrespondence' } });
    expect(anchorCorrespondence(refused.source.conflict.reapply)).toEqual({
      kind: 'refused',
      reason: 'NoExactCorrespondence'
    });
    expect(anchorCorrespondence(conflictWith().source.conflict.reapply)).toEqual({ kind: 'notAnchored' });
  });
}); // End of the evidence readers suite

describe('which evidence one conflict may work from', () => {
  /** The revision every retained draft in this suite was made from. */
  const DRAFT_BASE = 'rev-a';

  /** The revision the disk holds in the conflict every case here builds. */
  const DISK = 'rev-c';

  /**
   * A correspondence table naming the two revisions it was built between.
   *
   * **Its rows are empty on purpose.** What is under test is the pairing the wire
   * cannot express — which two snapshots this table is about — and not what a row
   * says; a row would invite a case to look like evidence that the answers inside
   * belong to this projection, which nothing here can establish.
   *
   * @param base - The revision the rows' identities were minted from.
   * @param disk - The revision every answer was resolved against.
   * @returns The table.
   */
  function table(base: string, disk: string): CorrespondenceTable {
    return { base_revision: base, disk_revision: disk, entries: [] };
  } // End of function table()

  /**
   * One external conflict over a file, with the table a case wants to test.
   *
   * @param correspondences - The table the observation carried, or `null`.
   * @returns The model a surface would be holding.
   */
  function externalConflict(correspondences: CorrespondenceTable | null) {
    const observation: ExternalConflictObservation = {
      sequence: 9,
      document: 2,
      previousRevision: DRAFT_BASE,
      diskRevision: DISK,
      diskText: '# the file as it is now\n',
      disk: makeDocument({ id: 2, relativePath: 'match/base.yml', revision: DISK }),
      findings: [],
      correspondences
    };
    return describeExternalConflict(
      observation,
      startDraft(DRAFT_BASE, 'typed', textDraftRules),
      SUPPORTED
    );
  } // End of function externalConflict()

  /**
   * The evidence one conflict may work from while it is still the one standing.
   *
   * **The standing origin is the conflict's own here**, which is what a window
   * that has seen nothing newer would pass; the two cases below that are about
   * ruling 26's supersession pass a different one on purpose.
   *
   * @typeParam T - The drafted value the conflict retained.
   * @param conflict - The conflict a reapply would work from.
   * @returns Which evidence is available.
   */
  function evidenceOf<T>(conflict: ConflictModel<T>): ReapplyEvidenceAccess {
    return reapplyEvidenceFor(conflict, () => conflict.source);
  } // End of function evidenceOf()

  it('reads the evidence a save conflict carries off its own refusal', () => {
    // Ruling 23's save half: the evidence is `ConflictResult.reapply`, resolved by
    // the command that was refused, about that one operation.
    const conflict = conflictWith({ Identified: { target: TARGET } });
    expect(evidenceOf(conflict)).toEqual({
      kind: 'saveEvidence',
      evidence: conflict.source.conflict.reapply
    });
  });

  it('refuses an external conflict that carried no correspondence at all', () => {
    // The wire allows a null table whenever either side had no projection, and an
    // absence is not weaker evidence — it is none.
    expect(evidenceOf(externalConflict(null))).toEqual({
      kind: 'refused',
      reason: 'noCorrespondence'
    });
  });

  it('refuses a table minted from a base this draft was not made against', () => {
    // **Ruling 24, first half.** The rows' identities come from a snapshot this
    // draft never saw, so nothing in them is about what the person is holding.
    // Content revisions are hashes, so this says the two differ and never which is
    // older.
    expect(evidenceOf(externalConflict(table('rev-z', DISK)))).toEqual({
      kind: 'refused',
      reason: 'baseRevisionMoved'
    });
  });

  it('refuses a table resolved against a disk snapshot this conflict is not about', () => {
    // **Ruling 24, second half**, which is also ruling 26 read from the evidence's
    // side: a later observation supersedes the conflict's disk side, and the old
    // table is then evidence about a state the person was not shown.
    expect(evidenceOf(externalConflict(table(DRAFT_BASE, 'rev-later')))).toEqual({
      kind: 'refused',
      reason: 'diskRevisionMoved'
    });
  });

  it('accepts the table only when both revisions match, and hands back what it checked', () => {
    const matching = table(DRAFT_BASE, DISK);
    const answer = evidenceOf(externalConflict(matching));
    expect(answer.kind).toBe('externalCorrespondence');
    if (answer.kind !== 'externalCorrespondence') {
      throw new Error('the accepted arm is what this case is about');
    }
    // Every value the table carried, unchanged — and **not the observation's own
    // object** (this phase's review, finding 2). What goes back is the snapshot
    // built from the values the two equalities were made against, because the
    // observation's table is a value a caller assembled and a second read of it is
    // not the read that was checked.
    expect(answer.correspondences).toEqual(matching);
    expect(answer.correspondences).not.toBe(matching);
    // **What the two equalities establish, and what they do not.** They establish
    // that the table *names* the two snapshots this conflict names. They do not
    // establish that one Rust call built both — that rests on the narrowing in
    // `./observationTransitions.ts`, and no case in this file can reach it.
    expect(answer.correspondences.entries).toEqual([]);
  }); // End of the "accepts only when both revisions match" case

  it('answers with the revisions it compared, whatever the table says afterwards', () => {
    // **This project's named check-and-spend class** (`CLAUDE.md` section 6): a
    // check and a spend separated by any property read are not atomic, because a
    // property read runs arbitrary code through a getter or a `Proxy` trap and
    // `readonly` freezes nothing at runtime. Returning the observation's table let
    // a consumer read a `base_revision` the pairing gate never saw — the gate would
    // pass on the first read and the consumer would rebase a draft against a
    // snapshot it was never made from.
    let baseReads = 0;
    // Declared mutable here and handed over as the `readonly` field it satisfies,
    // which is what lets the case push a row in **after** the answer was given.
    const rows: CorrespondenceEntry[] = [];
    const shifting: CorrespondenceTable = {
      get base_revision() {
        baseReads += 1;
        // The value the gate is shown, once; every later reader is told another.
        return baseReads === 1 ? DRAFT_BASE : 'rev-z';
      },
      disk_revision: DISK,
      entries: rows
    };
    const answer = evidenceOf(externalConflict(shifting));
    expect(answer.kind).toBe('externalCorrespondence');
    if (answer.kind !== 'externalCorrespondence') {
      throw new Error('the accepted arm is what this case is about');
    }
    // The gate read it exactly once, and that one value is what came back.
    expect(baseReads).toBe(1);
    expect(answer.correspondences.base_revision).toBe(DRAFT_BASE);
    // The row array is copied for the same reason, so a later push cannot add a row
    // to evidence that has already been accepted. It is a **shallow** copy: a row's
    // own fields are the observation's objects still, and nothing here vouches for
    // them.
    rows.push({ base: TARGET.id, exact: { Unsupported: {} }, editor: { Unsupported: {} } });
    expect(rows).toHaveLength(1);
    expect(answer.correspondences.entries).toHaveLength(0);
  }); // End of the "the revisions it compared are the ones it answers with" case

  it('refuses the evidence of a superseded conflict, whichever origin it has', () => {
    // **Ruling 26's "old reapply evidence invalidated", and it is one rule for both
    // origins.** A refused save's `ConflictResult.reapply` was resolved against a
    // disk snapshot the file has moved on from exactly as an observation's table can
    // have been, so the refusal is asked before either arm is reached — and it is
    // asked of the *save* arm too, which the two revision gates below it never see.
    const later: ExternalConflictObservation = {
      sequence: 12,
      document: 2,
      previousRevision: DISK,
      diskRevision: 'rev-later',
      diskText: '# later still\n',
      disk: makeDocument({ id: 2, relativePath: 'match/base.yml', revision: 'rev-later' }),
      findings: [],
      correspondences: null
    };
    const stands: ConflictSource = externalConflictSource(later);
    // A save conflict whose evidence would otherwise be read straight off its
    // refusal.
    const save = conflictWith({ Identified: { target: TARGET } });
    expect(reapplyEvidenceFor(save, () => stands)).toEqual({ kind: 'superseded' });
    // And an external conflict whose table would otherwise be accepted, because
    // both of its revisions match.
    const external = externalConflict(table(DRAFT_BASE, DISK));
    expect(evidenceOf(external).kind).toBe('externalCorrespondence');
    expect(reapplyEvidenceFor(external, () => stands)).toEqual({ kind: 'superseded' });
  }); // End of the "superseded, whichever origin" case

  it('refuses evidence when nothing stands for the file at all', () => {
    // **`null` is the conservative direction and not a missing answer.** A window
    // holding no conflict for the file has nothing this evidence could be about, so
    // the same arm answers — which is what makes a caller that has not looked up a
    // standing origin fail safe rather than read stale rows.
    expect(reapplyEvidenceFor(conflictWith(), () => null)).toEqual({ kind: 'superseded' });
    expect(reapplyEvidenceFor(externalConflict(table(DRAFT_BASE, DISK)), () => null)).toEqual({
      kind: 'superseded'
    });
  }); // End of the "nothing stands" case

  it('refuses evidence the file moved past while that evidence was being assembled', () => {
    // **This phase's review, finding 4, and it is this project's named
    // check-and-spend class one level up** (`CLAUDE.md` section 6). Asking what
    // stands *before* reading the evidence answers a question about an instant that
    // has passed by the time the answer is given: every read that builds the
    // evidence crosses into a value a caller assembled — the table's fields, the
    // draft's base, the conflict's disk revision, **and the iteration of the row
    // array** — and any one of them can run a getter, a `Proxy` trap or an iterator
    // that registers a strictly later reading of the file. The iteration is the last
    // of them, so a supersession triggered there is the one an ordering that checks
    // "late enough" still misses. The operand is a guard for exactly this reason:
    // it is asked once, after everything has been read.
    let standing: ConflictSource | null = null;
    // Declared mutable and handed over as the `readonly` field it satisfies, then
    // given an iterator of its own — `readonly` is a compile-time word and freezes
    // nothing at runtime, and `Array.from` goes through `Symbol.iterator`.
    const rows: CorrespondenceEntry[] = [];
    Object.defineProperty(rows, Symbol.iterator, {
      value: (): IterableIterator<CorrespondenceEntry> => {
        // A strictly later reading of the file arrives while the rows are copied,
        // and from here on it is the one that speaks for the file.
        standing = null;
        return ([] as CorrespondenceEntry[])[Symbol.iterator]();
      }
    });
    const external = externalConflict({
      base_revision: DRAFT_BASE,
      disk_revision: DISK,
      entries: rows
    });
    // Both revisions match, so this table is otherwise accepted — the case is not
    // vacuous, and the refusal below is the supersession and nothing else.
    expect(evidenceOf(external).kind).toBe('externalCorrespondence');

    standing = external.source;
    expect(reapplyEvidenceFor(external, () => standing).kind).toBe('superseded');
  }); // End of the "superseded while the evidence was assembled" case

  it('names a sentence both dictionaries hold for a superseded conflict', () => {
    // The same thing `externalEvidenceRefusalKey`'s case below pins for the three
    // refusals: the key is a real entry in both dictionaries and is not one of
    // theirs. **What no test here can hold is that the sentence is true** — the
    // i18n suites check parity and placeholders, never meaning (`CLAUDE.md` §2).
    const refusals = new Set<TranslationKey>([
      externalEvidenceRefusalKey('noCorrespondence'),
      externalEvidenceRefusalKey('baseRevisionMoved'),
      externalEvidenceRefusalKey('diskRevisionMoved')
    ]);
    expect(refusals.has(SUPERSEDED_EVIDENCE_KEY)).toBe(false);
    for (const locale of LOCALES) {
      expect(DICTIONARIES[locale][SUPERSEDED_EVIDENCE_KEY]).toBeTruthy();
    }
  }); // End of the "a sentence for a superseded conflict" case

  it('names a distinct sentence both dictionaries really hold, for every refusal', () => {
    const every = Object.keys({
      noCorrespondence: true,
      baseRevisionMoved: true,
      diskRevisionMoved: true
    } satisfies Record<ExternalEvidenceRefusal, true>) as readonly ExternalEvidenceRefusal[];
    const keys = new Set<TranslationKey>();
    for (const reason of every) {
      const key = externalEvidenceRefusalKey(reason);
      keys.add(key);
      for (const locale of LOCALES) {
        expect(DICTIONARIES[locale][key], `${locale}:${key}`).toBeTruthy();
      } // End of the loop over the two locales
    } // End of the loop over every refusal reason
    expect(keys.size).toBe(every.length);
    // And the accessor is what a panel will call, so it is exercised here rather
    // than left to a component that does not exist yet.
    expect(tExternalEvidenceRefusal('noCorrespondence')).toBe(
      DICTIONARIES.en[externalEvidenceRefusalKey('noCorrespondence')]
    );
  }); // End of the "one sentence per refusal" case
}); // End of the "which evidence one conflict may work from" suite

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
    // **The memo is keyed on `ConflictModel.source`, the origin memoized per wire
    // value**, which is the key `rememberTheConflict` uses for the same conflict.
    // `describeEditSave`
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
