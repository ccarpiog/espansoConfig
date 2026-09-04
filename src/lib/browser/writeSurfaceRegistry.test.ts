/**
 * The live write-surface registry — Phase 2d-5-2a.
 *
 * **Model tests only, and the module under test has no production caller.** No
 * component registers anything yet: 2d-5-2b is what makes the surface hosts call
 * `registerWriteSurface`, what makes `MatchCreator.svelte` report its destination
 * through the lease, and what carries the exhaustiveness assembly in the
 * composition file. What is checkable now is exactly what this step shipped — that
 * a lease names one registration and stays inert once displaced, that a target can
 * be reported in place without re-keying, and that the generation moves for a real
 * change and for nothing else.
 *
 * **The two predicates are driven from here on purpose.** `competingSurfaceFor` and
 * `targetingSurfaceFor` are 2d-5-1's and are not re-tested here; what these cases
 * establish is that the array this registry produces is a value they accept and
 * that a reported destination changes their answers, which is the join between the
 * two steps and is the thing neither module's own suite can see.
 *
 * **What no case here establishes**, in the same breath as what they do. Nothing
 * here proves a component registers, unregisters, or reports its destination — a
 * model test drives values and never markup, so that is 2d-5-2b's mounted evidence
 * and, for the screen, its window reading. Nothing here proves a transition is ever
 * called with anything: the registry calls none, and these cases assert that
 * negative rather than any behaviour of a surface.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling argument
 * is already its description carries no JSDoc of its own; ordinary helpers here do.
 */

import { describe, expect, it, vi } from 'vitest';
import type { DocumentId } from '../ipc/types';
import {
  competingSurfaceFor,
  targetingSurfaceFor,
  type OpenWriteSurface,
  type OpenWriteSurfaceKind
} from './restore';
import {
  createWriteSurfaceRegistry,
  type UnregisterWriteSurface,
  type WriteSurfaceRegistry,
  type WriteSurfaceTransition
} from './writeSurfaceRegistry';

/** The file most cases here are about. */
const TARGET: DocumentId = 7;

/** A second file, for the cases that need two. */
const OTHER: DocumentId = 99;

/**
 * Every kind of write surface, written out.
 *
 * **Deliberately not a `satisfies Record<OpenWriteSurfaceKind, …>` table.** The
 * consult puts the one exhaustive assembly in the composition file and 2d-5-2b is
 * what writes it; a second one here would be a check in the wrong place. The
 * consequence is stated rather than glossed: an eighth kind added later would be
 * missing from this list silently. What catches that is `restore.test.ts`'s own
 * `EVERY_SURFACE` table, which *is* `satisfies`-checked and fails to compile when a
 * kind is added without an entry.
 */
const EVERY_SURFACE: readonly OpenWriteSurfaceKind[] = [
  'matchEditor',
  'matchCreator',
  'matchDeleter',
  'matchMover',
  'matchDuplicator',
  'rawEditor',
  'restore'
];

/** The new-snippet form before it has chosen a destination. */
const UNKNOWN_CREATOR: OpenWriteSurface = { kind: 'matchCreator', target: { kind: 'unknown' } };

/**
 * One surface of a given kind, over a given file.
 *
 * @param kind - Which kind of surface.
 * @param document - The file it is about.
 * @returns The surface value.
 */
function over(kind: OpenWriteSurfaceKind, document: DocumentId): OpenWriteSurface {
  return { kind, target: { kind: 'document', document } };
} // End of function over()

/**
 * A transition that records being called and answers nothing.
 *
 * A fresh spy every call, because several cases below are about which registration
 * a transition belongs to.
 *
 * @returns The spy.
 */
function transition(): WriteSurfaceTransition {
  return vi.fn<WriteSurfaceTransition>(() => {});
} // End of function transition()

/**
 * The kinds a registry currently holds, in the order it answers them.
 *
 * @param registry - The registry.
 * @returns One kind per live surface.
 */
function kindsOf(registry: WriteSurfaceRegistry): readonly OpenWriteSurfaceKind[] {
  return registry.openWriteSurfaces().map((surface) => surface.kind);
} // End of function kindsOf()

describe('registering a surface', () => {
  it('answers it, for every one of the seven kinds', () => {
    for (const kind of EVERY_SURFACE) {
      const registry = createWriteSurfaceRegistry();
      const told = transition();
      registry.registerWriteSurface(over(kind, TARGET), told);
      expect(registry.openWriteSurfaces(), kind).toEqual([
        { kind, target: { kind: 'document', document: TARGET } }
      ]);
      expect(registry.transitionFor(kind), kind).toBe(told);
      expect(registry.generation(), kind).toBe(1);
    } // End of the loop over every surface kind
  }); // End of the "every one of the seven kinds" case

  it('starts empty, at generation zero', () => {
    const registry = createWriteSurfaceRegistry();
    expect(registry.openWriteSurfaces()).toEqual([]);
    expect(registry.generation()).toBe(0);
    for (const kind of EVERY_SURFACE) {
      expect(registry.transitionFor(kind), kind).toBeNull();
    } // End of the loop over every surface kind
  }); // End of the "starts empty" case

  it('holds two surfaces of different kinds at once, oldest first', () => {
    const registry = createWriteSurfaceRegistry();
    registry.registerWriteSurface(over('rawEditor', TARGET), transition());
    registry.registerWriteSurface(over('matchEditor', OTHER), transition());
    expect(kindsOf(registry)).toEqual(['rawEditor', 'matchEditor']);
    expect(registry.generation()).toBe(2);
  });

  it('answers a fresh array that no later registration reaches', () => {
    const registry = createWriteSurfaceRegistry();
    registry.registerWriteSurface(over('rawEditor', TARGET), transition());
    const held = registry.openWriteSurfaces();
    registry.registerWriteSurface(over('matchEditor', TARGET), transition());
    expect(held).toHaveLength(1);
    expect(registry.openWriteSurfaces()).toHaveLength(2);
  });

  it('keeps two registries apart', () => {
    const one = createWriteSurfaceRegistry();
    const two = createWriteSurfaceRegistry();
    one.registerWriteSurface(over('rawEditor', TARGET), transition());
    expect(two.openWriteSurfaces()).toEqual([]);
    expect(two.generation()).toBe(0);
  });
}); // End of the "registering a surface" suite

describe('reopening one kind', () => {
  it('lets the newer registration win, and keeps the displaced entry position', () => {
    const registry = createWriteSurfaceRegistry();
    registry.registerWriteSurface(over('matchEditor', TARGET), transition());
    registry.registerWriteSurface(over('rawEditor', TARGET), transition());
    const newer = transition();
    registry.registerWriteSurface(over('matchEditor', OTHER), newer);
    expect(registry.openWriteSurfaces()).toEqual([
      { kind: 'matchEditor', target: { kind: 'document', document: OTHER } },
      { kind: 'rawEditor', target: { kind: 'document', document: TARGET } }
    ]);
    expect(registry.transitionFor('matchEditor')).toBe(newer);
    expect(registry.generation()).toBe(3);
  }); // End of the "newer registration wins" case

  it('makes the displaced lease inert rather than dangerous', () => {
    const registry = createWriteSurfaceRegistry();
    const older = registry.registerWriteSurface(over('matchEditor', TARGET), transition());
    registry.registerWriteSurface(over('matchEditor', OTHER), transition());
    const generation = registry.generation();
    older();
    expect(registry.openWriteSurfaces()).toEqual([
      { kind: 'matchEditor', target: { kind: 'document', document: OTHER } }
    ]);
    expect(registry.generation()).toBe(generation);
    expect(older.replaceTarget({ kind: 'document', document: TARGET })).toBe('staleLease');
    expect(registry.openWriteSurfaces()).toEqual([
      { kind: 'matchEditor', target: { kind: 'document', document: OTHER } }
    ]);
    expect(registry.generation()).toBe(generation);
  }); // End of the "displaced lease is inert" case
}); // End of the "reopening one kind" suite

describe('the unregister a registration answers', () => {
  it('removes its own entry and leaves every other one', () => {
    const registry = createWriteSurfaceRegistry();
    const raw = registry.registerWriteSurface(over('rawEditor', TARGET), transition());
    registry.registerWriteSurface(over('matchMover', TARGET), transition());
    raw();
    expect(kindsOf(registry)).toEqual(['matchMover']);
    expect(registry.transitionFor('rawEditor')).toBeNull();
    expect(registry.generation()).toBe(3);
  });

  it('is idempotent, and a second call moves nothing', () => {
    const registry = createWriteSurfaceRegistry();
    const raw = registry.registerWriteSurface(over('rawEditor', TARGET), transition());
    raw();
    const generation = registry.generation();
    raw();
    raw();
    expect(registry.openWriteSurfaces()).toEqual([]);
    expect(registry.generation()).toBe(generation);
  });

  it('does not remove a newer entry of the same kind registered after it left', () => {
    const registry = createWriteSurfaceRegistry();
    const older = registry.registerWriteSurface(over('matchDeleter', TARGET), transition());
    older();
    registry.registerWriteSurface(over('matchDeleter', OTHER), transition());
    const generation = registry.generation();
    older();
    expect(registry.openWriteSurfaces()).toEqual([
      { kind: 'matchDeleter', target: { kind: 'document', document: OTHER } }
    ]);
    expect(registry.generation()).toBe(generation);
  }); // End of the "does not remove a newer entry" case
}); // End of the "unregister" suite

describe('reporting a file through the lease', () => {
  it('replaces an unknown creator target in place', () => {
    const registry = createWriteSurfaceRegistry();
    const told = transition();
    const lease = registry.registerWriteSurface(UNKNOWN_CREATOR, told);
    registry.registerWriteSurface(over('rawEditor', OTHER), transition());
    expect(lease.replaceTarget({ kind: 'document', document: TARGET })).toBe('replaced');
    expect(registry.openWriteSurfaces()).toEqual([
      { kind: 'matchCreator', target: { kind: 'document', document: TARGET } },
      { kind: 'rawEditor', target: { kind: 'document', document: OTHER } }
    ]);
    // In place: same key, same position, same transition — and the lease still
    // names the entry, so it can still remove it.
    expect(registry.transitionFor('matchCreator')).toBe(told);
    lease();
    expect(kindsOf(registry)).toEqual(['rawEditor']);
  }); // End of the "replaces in place" case

  it('changes what the two predicates answer about that file', () => {
    const registry = createWriteSurfaceRegistry();
    const lease = registry.registerWriteSurface(UNKNOWN_CREATOR, transition());
    const unknown = registry.openWriteSurfaces();
    // 2d-5-1's shipped answers for a destination-less form: no restore is refused,
    // and every creator-eligible document is treated as targeted.
    expect(competingSurfaceFor(TARGET, unknown)).toBeNull();
    expect(targetingSurfaceFor(TARGET, unknown, 'creatorEligible')).toBe('matchCreator');
    expect(targetingSurfaceFor(TARGET, unknown, 'notCreatorEligible')).toBeNull();
    lease.replaceTarget({ kind: 'document', document: TARGET });
    const named = registry.openWriteSurfaces();
    expect(competingSurfaceFor(TARGET, named)).toBe('matchCreator');
    expect(competingSurfaceFor(OTHER, named)).toBeNull();
    expect(targetingSurfaceFor(TARGET, named, 'notCreatorEligible')).toBe('matchCreator');
    expect(targetingSurfaceFor(OTHER, named, 'creatorEligible')).toBeNull();
  }); // End of the "changes what the predicates answer" case

  it('reports a file for a kind that already named one', () => {
    const registry = createWriteSurfaceRegistry();
    const lease = registry.registerWriteSurface(over('matchMover', TARGET), transition());
    expect(lease.replaceTarget({ kind: 'document', document: OTHER })).toBe('replaced');
    expect(registry.openWriteSurfaces()).toEqual([
      { kind: 'matchMover', target: { kind: 'document', document: OTHER } }
    ]);
  });

  it('is refused from a lease whose entry has gone', () => {
    const registry = createWriteSurfaceRegistry();
    const lease = registry.registerWriteSurface(UNKNOWN_CREATOR, transition());
    lease();
    const generation = registry.generation();
    expect(lease.replaceTarget({ kind: 'document', document: TARGET })).toBe('staleLease');
    expect(registry.openWriteSurfaces()).toEqual([]);
    expect(registry.generation()).toBe(generation);
  }); // End of the "refused from a lease whose entry has gone" case
}); // End of the "reporting a file" suite

describe('the registry generation', () => {
  it('moves for a registration, an unregistration and a landed replacement', () => {
    const registry = createWriteSurfaceRegistry();
    expect(registry.generation()).toBe(0);
    const lease = registry.registerWriteSurface(UNKNOWN_CREATOR, transition());
    expect(registry.generation()).toBe(1);
    lease.replaceTarget({ kind: 'document', document: TARGET });
    expect(registry.generation()).toBe(2);
    lease();
    expect(registry.generation()).toBe(3);
  }); // End of the "moves for all three" case

  it('moves for a replacement that changes nothing about the target', () => {
    // A landed replacement is a replacement: the rule is about the operation, not
    // about whether the new value differs, and a caller comparing values would be a
    // second rule that can drift from this one.
    const registry = createWriteSurfaceRegistry();
    const lease = registry.registerWriteSurface(over('matchDuplicator', TARGET), transition());
    lease.replaceTarget({ kind: 'document', document: TARGET });
    expect(registry.generation()).toBe(2);
  }); // End of the "replacement that changes nothing" case

  it('does not move for a no-op unregister', () => {
    const registry = createWriteSurfaceRegistry();
    const lease = registry.registerWriteSurface(over('restore', TARGET), transition());
    lease();
    const generation = registry.generation();
    lease();
    expect(registry.generation()).toBe(generation);
  });

  it('moves twice for a registration and its removal, leaving the set as it was', () => {
    // The property the doc comment claims: a moved generation does not imply the
    // set differs from the capture.
    const registry = createWriteSurfaceRegistry();
    registry.registerWriteSurface(over('rawEditor', TARGET), transition());
    const captured = registry.openWriteSurfaces();
    const generation = registry.generation();
    const lease = registry.registerWriteSurface(over('matchEditor', TARGET), transition());
    lease();
    expect(registry.generation()).toBe(generation + 2);
    expect(registry.openWriteSurfaces()).toEqual(captured);
  }); // End of the "moves twice, set unchanged" case
}); // End of the "generation" suite

describe('a caller-supplied accessor that re-enters', () => {
  /**
   * A creator surface whose `kind` runs the given body on the given read.
   *
   * **`readonly` does not freeze anything at run time and a property read runs
   * arbitrary code**, which is the hazard `CLAUDE.md` names and the two cases below
   * exercise. This helper is the smallest thing that produces it honestly: an
   * ordinary object that satisfies `OpenWriteSurface` and whose discriminant is an
   * accessor.
   *
   * @param on - Which read of `kind` runs the body; the first read is 1.
   * @param body - What that read does before answering.
   * @returns The surface.
   */
  function creatorReading(on: number, body: () => void): OpenWriteSurface {
    let reads = 0;
    return {
      /**
       * The discriminant, and the re-entry.
       *
       * @returns The kind, always.
       */
      get kind(): 'matchCreator' {
        reads += 1;
        if (reads === on) {
          body();
        }
        return 'matchCreator';
      }, // End of the kind accessor
      target: { kind: 'unknown' }
    };
  } // End of function creatorReading()

  it('refuses a replacement whose own read let a newer registration in', () => {
    const registry = createWriteSurfaceRegistry();
    // The second read of `kind` is the one `withTarget` takes, inside
    // `replaceTarget` and after its lease check.
    const surface = creatorReading(2, () => {
      registry.registerWriteSurface(over('matchCreator', OTHER), transition());
    });
    const lease = registry.registerWriteSurface(surface, transition());
    expect(lease.replaceTarget({ kind: 'document', document: TARGET })).toBe('staleLease');
    // The re-entrant registration is the live one, and this call wrote nothing over
    // it — neither its target nor its serial.
    expect(registry.openWriteSurfaces()).toEqual([
      { kind: 'matchCreator', target: { kind: 'document', document: OTHER } }
    ]);
  }); // End of the "refuses a replacement" case

  it('lets the registration that finished last win, whatever its accessor did', () => {
    const registry = createWriteSurfaceRegistry();
    // Collected rather than held in a `let`, so that reading it back is not a
    // narrowing question about a variable a callback assigned.
    const inner: UnregisterWriteSurface[] = [];
    // The first read of `kind` is the one `registerWriteSurface` takes, before it
    // has claimed a serial.
    const surface = creatorReading(1, () => {
      inner.push(registry.registerWriteSurface(over('matchCreator', OTHER), transition()));
    });
    registry.registerWriteSurface(surface, transition());
    expect(registry.openWriteSurfaces()).toEqual([
      { kind: 'matchCreator', target: { kind: 'unknown' } }
    ]);
    expect(registry.generation()).toBe(2);
    // The re-entrant lease is the older one, so it is inert against the entry that
    // displaced it.
    expect(inner).toHaveLength(1);
    inner[0]?.();
    expect(registry.openWriteSurfaces()).toHaveLength(1);
  }); // End of the "registration that finished last wins" case
}); // End of the "re-entrant accessor" suite

describe('the transition a registration carries', () => {
  it('is never called by the registry', () => {
    const registry = createWriteSurfaceRegistry();
    const told = transition();
    const lease = registry.registerWriteSurface(UNKNOWN_CREATOR, told);
    lease.replaceTarget({ kind: 'document', document: TARGET });
    registry.openWriteSurfaces();
    registry.generation();
    registry.transitionFor('matchCreator');
    lease();
    lease();
    expect(told).not.toHaveBeenCalled();
  }); // End of the "never called by the registry" case

  it('goes with its own registration, and a displaced one is unreachable', () => {
    const registry = createWriteSurfaceRegistry();
    const older = transition();
    const newer = transition();
    registry.registerWriteSurface(over('matchEditor', TARGET), older);
    registry.registerWriteSurface(over('matchEditor', TARGET), newer);
    expect(registry.transitionFor('matchEditor')).toBe(newer);
    expect(registry.transitionFor('rawEditor')).toBeNull();
  }); // End of the "goes with its own registration" case
}); // End of the "transition" suite
