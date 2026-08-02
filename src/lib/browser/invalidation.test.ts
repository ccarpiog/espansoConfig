/**
 * The typed whole-document invalidation, and what it does and does not force.
 *
 * The claim under test is not "the invalidation runs" — a callback that is called
 * is easy. It is **that a caller cannot learn how the save ended without handing
 * one over**, and the 2c-1a review showed the first version failing exactly that:
 * the payload sat on the sealed object under a symbol, and
 * `Reflect.ownKeys`/`getOwnPropertySymbols`/`getOwnPropertyDescriptors` and object
 * spread all recovered it. So the first suite below is a list of **attempted
 * escapes**, each asserting that nothing comes out.
 *
 * The second claim is `PROGRESS.md` D2 — *a committed write is never afterwards
 * reported as an error*. The review found a `forget` that throws propagating out
 * of the opener and destroying a committed `saved`. It is caught now, and the
 * test throws on purpose.
 *
 * The three cases where the invalidation must *not* run are as much of the
 * contract as the one where it must, and each is a different reason.
 */

import { describe, expect, it } from 'vitest';
import type { RawSaveInvalidation, RawSaveReload } from '../ipc/commands';
import type { IpcFailure } from '../ipc/errors';
import type { ConflictResult, ContentRevision, SavedResult, SaveResult } from '../ipc/types';
import { makeDocument, makeMatch } from './fixtures';
import {
  invalidationOf,
  openWholeDocumentSave,
  sealWholeDocumentSave,
  type WholeDocumentSaveOpening
} from './invalidation';

/** The revision a save was based on. */
const BASE: ContentRevision = 'a'.repeat(64);

/** The revision it ended on. */
const AFTER: ContentRevision = 'b'.repeat(64);

/** The document every case here saves. */
const DOCUMENT = 7;

/**
 * What the issuer's own invalidation did, for the cases that are not about it.
 *
 * A required argument since Phase 2c-1b rather than an optional one: the issuer
 * always knows, and a default would be this module inventing an answer for a
 * caller that forgot. `done` is the ordinary case; the suite at the end drives
 * the other two.
 */
const ISSUER_DONE: RawSaveReload = { kind: 'done' };

/** A classified failure, for the arms that carry one. */
const FAILURE: IpcFailure = {
  kind: 'command',
  error: { code: 'io', path: '/nowhere/match/base.yml', kind: 'NotFound' }
};

/**
 * A save that ran to the end.
 *
 * @param committed - Whether the file was really rewritten.
 * @returns The `saved` outcome as it crosses the boundary.
 */
function saved(committed: boolean): SavedResult {
  return {
    outcome: 'saved',
    revision: AFTER,
    committed,
    notes: [],
    backup_taken: committed,
    moved: null
  };
} // End of function saved()

/** A save the file had moved on under. */
const CONFLICT: ConflictResult = {
  outcome: 'conflict',
  expected: BASE,
  found: AFTER,
  disk_revision: AFTER,
  disk: makeDocument({ id: DOCUMENT, revision: AFTER })
};

/** A save the semantic gate refused. */
const REFUSED: SaveResult = {
  outcome: 'refused',
  verdict: 'RefusedForUnacknowledgedSuspicions',
  findings: []
};

/**
 * Opens a sealed outcome, recording what the invalidation was called with.
 *
 * @param result - How the save ended.
 * @returns What the opener answered, and every invalidation it asked for.
 */
function open(result: SaveResult): {
  readonly opening: WholeDocumentSaveOpening;
  readonly forgotten: readonly RawSaveInvalidation[];
} {
  const forgotten: RawSaveInvalidation[] = [];
  const opening = openWholeDocumentSave(
    sealWholeDocumentSave(DOCUMENT, result, ISSUER_DONE),
    (invalidation) => {
      forgotten.push(invalidation);
    }
  );
  return { opening, forgotten };
} // End of function open()

describe('the seal, against every escape the review found', () => {
  it('carries nothing at all: no string key, no symbol key, no descriptor', () => {
    // The first version kept the payload on the object under a module-private
    // symbol. A symbol key is private only at the TypeScript-name level: all
    // three of these recover one. The payload is in a `WeakMap` now, so the
    // object is an empty frozen husk.
    const sealed = sealWholeDocumentSave(DOCUMENT, saved(true), ISSUER_DONE);
    expect(Object.keys(sealed)).toEqual([]);
    expect(Object.getOwnPropertySymbols(sealed)).toEqual([]);
    expect(Reflect.ownKeys(sealed)).toEqual([]);
    expect(Object.values(Object.getOwnPropertyDescriptors(sealed))).toEqual([]);
  }); // End of the "carries nothing at all" case

  it('survives a spread and a clone, because a copy is not a key', () => {
    // Spread copies enumerable symbol properties, which is how the first version
    // leaked through a copy. There is nothing to copy, and neither the spread nor
    // the clone is the object the map is keyed by, so neither can be opened.
    const sealed = sealWholeDocumentSave(DOCUMENT, saved(true), ISSUER_DONE);
    const spread = { ...sealed };
    expect(Reflect.ownKeys(spread)).toEqual([]);
    expect(JSON.stringify(sealed)).toBe('{}');
    expect(JSON.stringify(structuredClone(sealed))).toBe('{}');
    expect(openWholeDocumentSave(structuredClone(sealed), () => {})).toEqual({
      kind: 'alreadyOpened'
    });
  }); // End of the "survives a spread and a clone" case

  it('is frozen, so nothing can be attached to it either', () => {
    const sealed = sealWholeDocumentSave(DOCUMENT, saved(true), ISSUER_DONE);
    expect(Object.isFrozen(sealed)).toBe(true);
  });

  it('is one-shot: a second open is refused rather than served', () => {
    // Otherwise a caller could open it once with a real invalidation and again,
    // later, with a no-op — which is the same hole with an extra step.
    const sealed = sealWholeDocumentSave(DOCUMENT, saved(true), ISSUER_DONE);
    const first = openWholeDocumentSave(sealed, () => {});
    expect(first.kind).toBe('opened');
    let calledAgain = false;
    const second = openWholeDocumentSave(sealed, () => {
      calledAgain = true;
    });
    expect(second).toEqual({ kind: 'alreadyOpened' });
    expect(calledAgain).toBe(false);
  }); // End of the "is one-shot" case

  it('hands back the outcome it was given', () => {
    const opening = open(saved(true)).opening;
    expect(opening).toMatchObject({ kind: 'opened', document: DOCUMENT });
    expect(opening.kind === 'opened' && opening.outcome.outcome).toBe('saved');
  });
}); // End of the "seal, against every escape" suite

describe('the whole-document saved arm', () => {
  it('answers `moved: null` by construction, not by passing the wire through', () => {
    // The protocol says a replacement answers `null` permanently: every identity
    // in the file is stale at once, so an identity here would be one the caller
    // must not use even if the wire produced it.
    const withIdentity: SavedResult = {
      ...saved(true),
      moved: makeMatch().id
    };
    const opening = open(withIdentity).opening;
    expect(opening.kind === 'opened' && opening.outcome.outcome === 'saved').toBe(true);
    if (opening.kind !== 'opened' || opening.outcome.outcome !== 'saved') {
      throw new Error('the saved arm is what this case is about');
    }
    expect(opening.outcome.moved).toBeNull();
    expect(opening.outcome.revision).toBe(AFTER);
  }); // End of the "answers moved: null by construction" case
}); // End of the "whole-document saved arm" suite

describe('when the invalidation is owed', () => {
  it('runs for a committed save, naming the document and its new revision', () => {
    // Every `MatchId` the caller holds for this file is stale, and unlike a move
    // there is no single identity to answer with. So what the invalidation gets
    // is the file and the revision it now holds — the caller's new base.
    const { opening, forgotten } = open(saved(true));
    expect(forgotten).toEqual([{ document: DOCUMENT, revision: AFTER }]);
    expect(opening).toMatchObject({ invalidation: { kind: 'done' } });
  });

  it('runs before the outcome is returned, not after the caller has acted', () => {
    // Ordering, as a test rather than as a promise: an invalidation performed
    // after the caller had the result would leave a window in which the screen
    // reads projections the commit destroyed.
    let seenBeforeReturn = false;
    const opening = openWholeDocumentSave(sealWholeDocumentSave(DOCUMENT, saved(true), ISSUER_DONE), () => {
      seenBeforeReturn = true;
    });
    expect(seenBeforeReturn).toBe(true);
    expect(opening.kind).toBe('opened');
  }); // End of the "runs before the outcome is returned" case
}); // End of the "when the invalidation is owed" suite

describe('an invalidation that throws', () => {
  it('never replaces the committed outcome with an exception', () => {
    // `PROGRESS.md` D2: a committed write is never afterwards reported as an
    // error. The review found this module breaking it — the same defect
    // 2b-2c-3b's fix round found in `saveRawDocument`, made one layer up.
    const opening = openWholeDocumentSave(sealWholeDocumentSave(DOCUMENT, saved(true), ISSUER_DONE), () => {
      throw new Error('state invalidation failed');
    });
    expect(opening.kind).toBe('opened');
    if (opening.kind !== 'opened') {
      throw new Error('the opened arm is what this case is about');
    }
    expect(opening.outcome).toMatchObject({ outcome: 'saved', committed: true, revision: AFTER });
    expect(opening.invalidation.kind).toBe('failed');
  }); // End of the "never replaces the committed outcome" case

  it('classifies the throw through the same channel every other failure uses', () => {
    const opening = openWholeDocumentSave(sealWholeDocumentSave(DOCUMENT, saved(true), ISSUER_DONE), () => {
      throw new Error('state invalidation failed');
    });
    if (opening.kind !== 'opened' || opening.invalidation.kind !== 'failed') {
      throw new Error('a failed invalidation is what this case is about');
    }
    // A developer string, never a sentence: `classifyFailure` hides it behind a
    // non-enumerable property so nothing can render it by accident.
    expect(opening.invalidation.failure.kind).toBe('unexpected');
    expect(JSON.stringify(opening.invalidation.failure)).not.toContain('state invalidation');
  }); // End of the "classifies the throw" case

  it('still consumed the seal, so the failure cannot be retried into a second read', () => {
    const sealed = sealWholeDocumentSave(DOCUMENT, saved(true), ISSUER_DONE);
    openWholeDocumentSave(sealed, () => {
      throw new Error('state invalidation failed');
    });
    expect(openWholeDocumentSave(sealed, () => {})).toEqual({ kind: 'alreadyOpened' });
  });
}); // End of the "invalidation that throws" suite

describe('when it is not owed, and why not', () => {
  it('does not run for a save that wrote nothing', () => {
    // `committed: false` is a success in which the candidate was byte-identical
    // to what the file already held. Nothing went stale, and invalidating anyway
    // would make a window discard projections that are still correct.
    const { opening, forgotten } = open(saved(false));
    expect(forgotten).toEqual([]);
    expect(opening).toMatchObject({ invalidation: { kind: 'notOwed' } });
  });

  it('does not run for a conflict', () => {
    // Nothing was written. What the caller holds is a projection of bytes some
    // *other* writer replaced, which is carried in the outcome's own `disk`
    // field; adopting that is a different act from forgetting a file this
    // application has just rewritten.
    expect(open(CONFLICT).forgotten).toEqual([]);
  });

  it('does not run for a refusal', () => {
    expect(open(REFUSED).forgotten).toEqual([]);
  });

  it('answers the same question the same way outside the seal', () => {
    expect(invalidationOf(DOCUMENT, saved(true))).toEqual({
      document: DOCUMENT,
      revision: AFTER
    });
    expect(invalidationOf(DOCUMENT, saved(false))).toBeNull();
    expect(invalidationOf(DOCUMENT, CONFLICT)).toBeNull();
    expect(invalidationOf(DOCUMENT, REFUSED)).toBeNull();
  });
}); // End of the "when it is not owed" suite

describe("the issuer's own invalidation, carried rather than stranded", () => {
  // The 2c-1b review's third finding: the invalidation that can really fail on the
  // running path is the **issuer's**, which runs before any of this, and its
  // failure used to reach the developer console and no screen at all.

  it('hands back what the issuer reported, arm for arm', () => {
    for (const issuer of [
      { kind: 'notOwed' },
      { kind: 'done' },
      { kind: 'failed', failure: FAILURE }
    ] satisfies readonly RawSaveReload[]) {
      const opening = openWholeDocumentSave(
        sealWholeDocumentSave(DOCUMENT, saved(true), issuer),
        () => {}
      );
      expect(opening).toMatchObject({ kind: 'opened', issuerInvalidation: issuer });
    } // End of the loop over the three arms
  }); // End of the "hands back what the issuer reported" case

  it('keeps it apart from what the openeritself did', () => {
    // Two acts at two moments. A single field would make "which of the two
    // failed?" unanswerable, and the answer decides nothing for a person but
    // everything for whoever reads the report afterwards.
    const opening = openWholeDocumentSave(
      sealWholeDocumentSave(DOCUMENT, saved(true), { kind: 'failed', failure: FAILURE }),
      () => {}
    );
    expect(opening).toMatchObject({
      kind: 'opened',
      invalidation: { kind: 'done' },
      issuerInvalidation: { kind: 'failed' }
    });
    // And the save is still a committed save, which is the whole point.
    expect(opening.kind === 'opened' && opening.outcome.outcome).toBe('saved');
  }); // End of the "keeps it apart" case
}); // End of the "issuer's own invalidation" suite

describe('what the seal still does not force', () => {
  it('accepts a body that does nothing, and this is the residue', () => {
    // Written down rather than claimed closed, exactly as `2b-2c-3b-notes.md`
    // section 7.2 did for `ReloadAfterRawSave`: no TypeScript signature can
    // require a body to act. What the seal forces is that the routine is
    // **called** — there is no path to the outcome that does not pass through it.
    const opening = openWholeDocumentSave(
      sealWholeDocumentSave(DOCUMENT, saved(true), ISSUER_DONE),
      () => {}
    );
    expect(opening).toMatchObject({ kind: 'opened', invalidation: { kind: 'done' } });
  }); // End of the "body that does nothing" case
}); // End of the "what the seal still does not force" suite
