/**
 * What one admitted observation does — every cell of the consult's Q8 table —
 * Phase 2d-5-4.
 *
 * Thirteen combinations: four observations over three `ObservedDocument` arms,
 * less the three cells `Added` does not have because it carries no such arm. Each
 * one is driven here against a recording workspace, so an assertion is about the
 * decision rather than about a window; `workspace.test.ts` is where the same arms
 * are driven against the real one and the window is what is read.
 *
 * **Two documents wherever two are meaningful.** A per-document map and one global
 * number are indistinguishable over a single document, and this project has
 * already shipped that confusion once — 2c-3a-1's global `selectGeneration`, green
 * over 1112 tests that all used one document.
 *
 * **Nothing here mounts anything and nothing here awaits a command.**
 * `rereadUnderGuard` is recorded with its guard rather than run, so a case that is
 * about the guard calls it itself, at the moment it wants to ask.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { describe, expect, it } from 'vitest';
import type {
  ContentRevision,
  DocumentId,
  DocumentSummary,
  ExternalObservation,
  ObservedDocument
} from '../ipc/types';
import { makeDocument, makeSummary } from './fixtures';
import {
  applyObservation,
  createAcceptedSequences,
  externalConflictObservationOf,
  routeObservation,
  type ExternalDocumentStatus,
  type ExternalPathDrift,
  type ObservationOutcome,
  type ObservationSession,
  type ReconciliationWorkspace
} from './observationTransitions';
import type { CreatorEligibility, OpenWriteSurface, OpenWriteSurfaceKind } from './restore';
import type { ExternalConflictObservation } from './conflictSource';
import type { WriteSurfaceTransition } from './writeSurfaceRegistry';

/** The epoch every session below is showing. */
const EPOCH = 11;

/** Document `1`, as the open workspace resolves it. */
const ADDRESSABLE_ONE: ObservedDocument = {
  Addressable: { document: 1, relative_path: 'match/base.yml' }
};

/** Document `2`, as the open workspace resolves it. */
const ADDRESSABLE_TWO: ObservedDocument = {
  Addressable: { document: 2, relative_path: 'match/other.yml' }
};

/** Document `9`, minted by this process and refused by the open workspace. */
const NAMED_NINE: ObservedDocument = {
  Named: { document: 9, relative_path: 'match/pending.yml' }
};

/** A path no identity has ever been minted for. */
const UNNAMED: ObservedDocument = {
  Unnamed: { relative_path: 'match/stranger.yml' }
};

/** What a `PermissionDenied` looks like on the wire. */
const DENIED = { PermissionDenied: {} } as const;

/**
 * Everything one recording workspace saw, so a case can read it.
 */
interface RecordedWorkspace {
  /** What `applyObservation` is handed. */
  readonly workspace: ReconciliationWorkspace;
  /** What the live registry answers. Assignable, so a case can open a surface. */
  surfaces: readonly OpenWriteSurface[];
  /** Which files are creator-eligible; everything not named here is not. */
  eligible: readonly DocumentId[];
  /** Which identities this window holds a row for. */
  rows: DocumentId[];
  /** Every file a guarded reread was started for, with its guard. */
  readonly reread: { document: DocumentId; guard: () => boolean }[];
  /** Every row inserted or replaced. */
  readonly added: DocumentSummary[];
  /** Every file removed. */
  readonly removed: DocumentId[];
  /** Every status recorded, in order; `null` means one was cleared. */
  readonly statuses: { document: DocumentId; status: ExternalDocumentStatus | null }[];
  /** Every path drift recorded. */
  readonly drift: ExternalPathDrift[];
  /** Every request a recovery re-ran. */
  readonly reopened: (string | null)[];
  /** Every observation a surface transition was handed, with the kind it went to. */
  readonly told: { kind: OpenWriteSurfaceKind; observation: ExternalConflictObservation }[];
  /** How many times the registry generation has been made to move. */
  bumped: number;
}

/**
 * Builds a workspace that records what it was asked to do and does none of it.
 *
 * **Every member answers `void`, exactly as the interface does**, so nothing here
 * can make a case pass by reporting success. What a case reads is the list of
 * calls.
 *
 * @returns The workspace and everything it saw.
 */
function recordingWorkspace(): RecordedWorkspace {
  const recorded: RecordedWorkspace = {
    workspace: {
      /**
       * Whatever the case last assigned.
       *
       * @returns The live set.
       */
      openWriteSurfaces: (): readonly OpenWriteSurface[] => recorded.surfaces,
      /**
       * A generation the case moves by hand.
       *
       * **Not derived from the set**, because two of the guard's clauses have to
       * be told apart: a surface that is open *now*, and a registry that moved
       * while the read was in flight and is back where it was.
       *
       * @returns The count of deliberate bumps.
       */
      writeSurfaceGeneration: (): number => recorded.bumped,
      /**
       * Whether the new-snippet form would offer one file.
       *
       * @param document - The file.
       * @returns Whether the case listed it.
       */
      creatorEligibility: (document: DocumentId): CreatorEligibility =>
        recorded.eligible.includes(document) ? 'creatorEligible' : 'notCreatorEligible',
      /**
       * A transition that records what it was told.
       *
       * @param kind - Which kind of surface.
       * @returns The transition, for every kind.
       */
      transitionFor: (kind: OpenWriteSurfaceKind): WriteSurfaceTransition | null => {
        return (observation: ExternalConflictObservation): void => {
          recorded.told.push({ kind, observation });
        };
      },
      /**
       * Whether this window holds a row.
       *
       * @param document - The identity.
       * @returns Whether the case listed it.
       */
      holdsDocument: (document: DocumentId): boolean => recorded.rows.includes(document),
      /**
       * Records the reread and its guard, and runs neither.
       *
       * @param document - The file.
       * @param guard - Asked immediately before the installation.
       */
      rereadUnderGuard: (document: DocumentId, guard: () => boolean): void => {
        recorded.reread.push({ document, guard });
      },
      /**
       * Records a row.
       *
       * @param summary - The row.
       */
      addDocument: (summary: DocumentSummary): void => {
        recorded.added.push(summary);
        recorded.rows.push(summary.id);
      },
      /**
       * Records a removal.
       *
       * @param document - The file.
       */
      removeDocument: (document: DocumentId): void => {
        recorded.removed.push(document);
        recorded.rows = recorded.rows.filter((held) => held !== document);
      },
      /**
       * Records a status.
       *
       * @param document - The file.
       * @param status - The code, or `null`.
       */
      noteDocumentStatus: (
        document: DocumentId,
        status: ExternalDocumentStatus | null
      ): void => {
        recorded.statuses.push({ document, status });
      },
      /**
       * Records a path drift.
       *
       * @param entry - The path and what was observed of it.
       */
      notePathDrift: (entry: ExternalPathDrift): void => {
        recorded.drift.push(entry);
      },
      /**
       * Records a recovery request.
       *
       * @param request - The retained open request.
       */
      reopenWorkspace: (request: string | null): void => {
        recorded.reopened.push(request);
      }
    },
    surfaces: [],
    eligible: [],
    rows: [],
    reread: [],
    added: [],
    removed: [],
    statuses: [],
    drift: [],
    reopened: [],
    told: [],
    bumped: 0
  };
  return recorded;
} // End of function recordingWorkspace()

/**
 * Everything one session was asked for.
 */
interface RecordedSession {
  /** What `applyObservation` is handed. */
  readonly session: ObservationSession;
  /** The epoch it answers *now*; assignable, so a case can replace a workspace. */
  live: number;
  /**
   * Whether it is still applying observations; assignable, so a case can block or
   * dispose the coordinator while a read is in flight.
   */
  applying: boolean;
  /** How many membership reloads were asked for. */
  readonly requests: number[];
}

/**
 * Builds a session showing {@link EPOCH}.
 *
 * @returns The session and what it was asked for.
 */
function recordingSession(): RecordedSession {
  const recorded: RecordedSession = {
    session: {
      epoch: EPOCH,
      /**
       * The epoch this session is showing now.
       *
       * @returns Whatever the case last assigned.
       */
      epochNow: (): number => recorded.live,
      /**
       * Whether this session is still applying observations.
       *
       * @returns Whatever the case last assigned.
       */
      stillApplying: (): boolean => recorded.applying,
      /**
       * Counts a membership-reload request.
       */
      requestMembershipReload: (): void => {
        recorded.requests.push(1);
      }
    },
    live: EPOCH,
    applying: true,
    requests: []
  };
  return recorded;
} // End of function recordingSession()

/**
 * One `Changed` observation whose bytes projected.
 *
 * @param sequence - The sequence it was admitted under.
 * @param document - Which document arm.
 * @param revision - The revision of the bytes now on disk.
 * @returns The observation.
 */
function projectedChange(
  sequence: number,
  document: ObservedDocument,
  revision: ContentRevision = 'rev-disk'
): ExternalObservation {
  return {
    Changed: {
      sequence,
      document,
      previous_revision: 'rev-before',
      disk_revision: revision,
      content: {
        Projected: {
          disk_text: 'matches: []\n',
          disk: makeDocument({ id: 1, relativePath: 'match/base.yml' }),
          findings: [],
          correspondences: null
        }
      }
    }
  };
} // End of function projectedChange()

/**
 * One `Changed` observation whose bytes could not be read.
 *
 * @param sequence - The sequence it was admitted under.
 * @param document - Which document arm.
 * @returns The observation.
 */
function unreadableChange(sequence: number, document: ObservedDocument): ExternalObservation {
  return {
    Changed: {
      sequence,
      document,
      previous_revision: null,
      disk_revision: 'rev-bytes',
      content: { Unreadable: { reason: DENIED } }
    }
  };
} // End of function unreadableChange()

/**
 * One `Removed` observation.
 *
 * @param sequence - The sequence it was admitted under.
 * @param document - Which document arm.
 * @returns The observation.
 */
function removal(sequence: number, document: ObservedDocument): ExternalObservation {
  return { Removed: { sequence, document, previous_revision: null } };
} // End of function removal()

/**
 * One `Unreadable` observation.
 *
 * @param sequence - The sequence it was admitted under.
 * @param document - Which document arm.
 * @returns The observation.
 */
function unreadable(sequence: number, document: ObservedDocument): ExternalObservation {
  return { Unreadable: { sequence, document, reason: DENIED } };
} // End of function unreadable()

/**
 * One `Added` observation whose bytes projected.
 *
 * @param sequence - The sequence it was admitted under.
 * @param id - The identity this process minted.
 * @param loaded - What the wire claims about the row, so a case can lie.
 * @returns The observation.
 */
function addition(sequence: number, id: number, loaded = false): ExternalObservation {
  return {
    Added: {
      sequence,
      document_summary: { ...makeSummary({ id, relativePath: `match/new-${id}.yml` }), loaded },
      content: {
        Projected: {
          disk: makeDocument({ id, relativePath: `match/new-${id}.yml` }),
          findings: []
        }
      }
    }
  };
} // End of function addition()

/**
 * Applies one observation against a workspace and a session.
 *
 * @param observation - The observation.
 * @param workspace - The recording workspace.
 * @param session - The recording session.
 * @param sequences - The map, so several calls can share one.
 * @returns Which arm ran.
 */
function apply(
  observation: ExternalObservation,
  workspace: RecordedWorkspace,
  session: RecordedSession,
  sequences = createAcceptedSequences()
): ObservationOutcome {
  return applyObservation(observation, workspace.workspace, sequences, session.session);
} // End of function apply()

describe('the accepted-sequence map', () => {
  it('admits a strictly higher sequence and refuses anything else', () => {
    const sequences = createAcceptedSequences();
    expect(sequences.sequenceFor(1)).toBe(0);
    expect(sequences.admit(1, 5)).toBe(true);
    // Equal is refused as well as lower: two observations of one file under one
    // sequence would be one observation delivered twice.
    expect(sequences.admit(1, 5)).toBe(false);
    expect(sequences.admit(1, 4)).toBe(false);
    expect(sequences.admit(1, 6)).toBe(true);
    expect(sequences.sequenceFor(1)).toBe(6);
  });

  it('keeps two documents apart', () => {
    const sequences = createAcceptedSequences();
    sequences.admit(1, 20);
    expect(sequences.admit(2, 3)).toBe(true);
    expect(sequences.sequenceFor(1)).toBe(20);
    expect(sequences.sequenceFor(2)).toBe(3);
    expect(sequences.isNewest(1, 20)).toBe(true);
    expect(sequences.isNewest(2, 20)).toBe(false);
  });

  it('answers isNewest without moving anything', () => {
    const sequences = createAcceptedSequences();
    sequences.admit(1, 4);
    expect(sequences.isNewest(1, 4)).toBe(true);
    expect(sequences.isNewest(1, 4)).toBe(true);
    expect(sequences.sequenceFor(1)).toBe(4);
  });

  it('forgets everything on a clear', () => {
    const sequences = createAcceptedSequences();
    sequences.admit(1, 4);
    sequences.admit(2, 9);
    sequences.clear();
    expect(sequences.sequenceFor(1)).toBe(0);
    expect(sequences.sequenceFor(2)).toBe(0);
  });
}); // End of the "accepted-sequence map" suite

describe('the routing boundary', () => {
  it('narrows all three arms of a change into three different routes', () => {
    expect(routeObservation(projectedChange(1, ADDRESSABLE_ONE)).kind).toBe('changed');
    expect(routeObservation(projectedChange(1, NAMED_NINE)).kind).toBe('namedRow');
    expect(routeObservation(projectedChange(1, UNNAMED)).kind).toBe('unnamedPath');
  });

  it('narrows all three arms of a removal and of an unreadable', () => {
    expect(routeObservation(removal(1, ADDRESSABLE_ONE)).kind).toBe('removedDocument');
    expect(routeObservation(removal(1, NAMED_NINE)).kind).toBe('namedRow');
    expect(routeObservation(removal(1, UNNAMED)).kind).toBe('unnamedPath');
    expect(routeObservation(unreadable(1, ADDRESSABLE_ONE)).kind).toBe('unreadableDocument');
    expect(routeObservation(unreadable(1, NAMED_NINE)).kind).toBe('namedRow');
    expect(routeObservation(unreadable(1, UNNAMED)).kind).toBe('unnamedPath');
  });

  it('gives an addition no document arm at all', () => {
    const route = routeObservation(addition(3, 42));
    expect(route.kind).toBe('added');
    expect(route.kind === 'added' && route.summary.id).toBe(42);
  });

  it('keeps a Named identity under a name no reader can mistake for an address', () => {
    const route = routeObservation(removal(2, NAMED_NINE));
    // Ruling 29: no common identity accessor, so the two numbered arms answer
    // through two differently named fields.
    expect(route).toEqual({
      kind: 'namedRow',
      sequence: 2,
      namedDocument: 9,
      detail: { kind: 'removed' }
    });
  });

  it('carries the unreadable reason on the detail rather than beside it', () => {
    const route = routeObservation(unreadable(4, UNNAMED));
    expect(route).toEqual({
      kind: 'unnamedPath',
      sequence: 4,
      relativePath: 'match/stranger.yml',
      detail: { kind: 'unreadable', reason: DENIED }
    });
  });

  it('narrows a conflict observation from exactly one combination', () => {
    const projected = routeObservation(projectedChange(7, ADDRESSABLE_ONE, 'rev-seven'));
    expect(externalConflictObservationOf(projected)).toEqual({
      sequence: 7,
      document: 1,
      previousRevision: 'rev-before',
      diskRevision: 'rev-seven',
      diskText: 'matches: []\n',
      disk: makeDocument({ id: 1, relativePath: 'match/base.yml' }),
      findings: [],
      correspondences: null
    });
    // Every other combination answers `null`, including a change whose bytes
    // could not be read: that arm has no text, no projection and no table.
    expect(externalConflictObservationOf(routeObservation(unreadableChange(7, ADDRESSABLE_ONE)))).toBeNull();
    expect(externalConflictObservationOf(routeObservation(removal(7, ADDRESSABLE_ONE)))).toBeNull();
    expect(externalConflictObservationOf(routeObservation(addition(7, 42)))).toBeNull();
  });
}); // End of the "routing boundary" suite

describe('a change of an addressable file', () => {
  it('starts a guarded reread when no surface may be about it', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();

    expect(apply(projectedChange(4, ADDRESSABLE_ONE), workspace, session)).toBe('reread');
    expect(workspace.reread.map((entry) => entry.document)).toEqual([1]);
    expect(workspace.told).toEqual([]);
    expect(workspace.statuses).toEqual([]);
  });

  it('tells the surface and installs nothing when one may be', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();
    workspace.surfaces = [{ kind: 'rawEditor', target: { kind: 'document', document: 1 } }];

    expect(apply(projectedChange(4, ADDRESSABLE_ONE), workspace, session)).toBe('conflicted');
    expect(workspace.reread).toEqual([]);
    expect(workspace.told.map((entry) => entry.kind)).toEqual(['rawEditor']);
    expect(workspace.told[0]?.observation.sequence).toBe(4);
    expect(workspace.statuses).toEqual([{ document: 1, status: { kind: 'stale' } }]);
  });

  it('treats an unknown-target creator as being about every eligible file', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();
    workspace.surfaces = [{ kind: 'matchCreator', target: { kind: 'unknown' } }];
    workspace.eligible = [1];

    // Document 1 is eligible, so the creator may be about it: no reload.
    expect(apply(projectedChange(4, ADDRESSABLE_ONE), workspace, session)).toBe('conflicted');
    // Document 2 is not, so the same creator covers nothing there.
    expect(apply(projectedChange(4, ADDRESSABLE_TWO), workspace, session)).toBe('reread');
    expect(workspace.reread.map((entry) => entry.document)).toEqual([2]);
  });

  it('marks unreadable content and installs nothing', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();

    expect(apply(unreadableChange(4, ADDRESSABLE_ONE), workspace, session)).toBe('unavailable');
    expect(workspace.reread).toEqual([]);
    expect(workspace.removed).toEqual([]);
    expect(workspace.statuses).toEqual([
      { document: 1, status: { kind: 'unavailable', reason: DENIED } }
    ]);
  });

  it('refuses an older change of one file while accepting a newer one of another', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();
    const sequences = createAcceptedSequences();

    expect(apply(projectedChange(8, ADDRESSABLE_ONE), workspace, session, sequences)).toBe(
      'reread'
    );
    expect(apply(projectedChange(5, ADDRESSABLE_ONE), workspace, session, sequences)).toBe(
      'superseded'
    );
    expect(apply(projectedChange(5, ADDRESSABLE_TWO), workspace, session, sequences)).toBe(
      'reread'
    );
    expect(workspace.reread.map((entry) => entry.document)).toEqual([1, 2]);
  });

  it('writes no stale when the host read that chose the surface admitted a newer one', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();
    const sequences = createAcceptedSequences();
    workspace.surfaces = [{ kind: 'matchEditor', target: { kind: 'document', document: 1 } }];
    // **A host whose own member advances the accepted sequence.** `applyChange`
    // is handed both the workspace and the map, so this is the module's ordinary
    // injection rather than a private hook: `creatorEligibility` is read
    // *between* the question that admitted this observation and the `stale` the
    // conflict arm writes, and in the production host it walks the window's row
    // list. Anything that can deliver an observation synchronously from there
    // makes this observation no longer the newest.
    const hostile: ReconciliationWorkspace = {
      ...workspace.workspace,
      /**
       * Answers the question, and admits a newer observation while doing it.
       *
       * @param document - The file.
       * @returns Whatever the recording workspace would have answered.
       */
      creatorEligibility: (document: DocumentId): CreatorEligibility => {
        sequences.admit(document, 9);
        return workspace.workspace.creatorEligibility(document);
      }
    };

    expect(
      applyObservation(
        projectedChange(4, ADDRESSABLE_ONE),
        hostile,
        sequences,
        session.session
      )
    ).toBe('conflicted');

    // The surface is still told — the delivery is not what the fence is about,
    // and refusing it would drop a conflict a component is entitled to see.
    expect(workspace.told.map((entry) => entry.kind)).toEqual(['matchEditor']);
    // The status is not written, because by the time this line is reached a newer
    // observation of the same file owns what that file's status says. The
    // sentence that used to defend this write — *reaching it is already the
    // answer to the ownership question* — was a claim about the past.
    expect(workspace.statuses).toEqual([]);
  }); // End of the conflict-arm ownership case
}); // End of the "change of an addressable file" suite

describe('the guard the reread is run under', () => {
  it('permits the install and writes no status of its own', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();
    apply(projectedChange(4, ADDRESSABLE_ONE), workspace, session);

    // **The clear used to be here and is not any more** — Phase 2d-5-4's second
    // review, finding 5. This guard reached one of `rereadUnderGuard`'s two
    // callers: `BrowserState.rereadDocument` passes a guard that always holds, so a
    // person recovering a file this window had marked `stale` read it successfully
    // and the mark stayed for the rest of the session. The clear now happens in the
    // same synchronous block as `installView`, which is where an installation is
    // known to have happened, and `workspace.test.ts` is what reads it.
    expect(workspace.reread[0]?.guard()).toBe(true);
    expect(workspace.statuses).toEqual([]);
  });

  it('refuses and marks stale when the session has stopped applying', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();
    apply(projectedChange(4, ADDRESSABLE_ONE), workspace, session);

    // The state a `discarded` that blocked without recovering leaves, and the one
    // `dispose()` leaves: **nothing else the guard compares has moved.** The epoch
    // is the same, no newer observation was admitted, no surface opened and the
    // registry generation is where it was — so without this question the read
    // would install and clear the status.
    session.applying = false;
    expect(workspace.reread[0]?.guard()).toBe(false);
    expect(workspace.statuses).toEqual([{ document: 1, status: { kind: 'stale' } }]);
  });

  it('tells no surface when the session has stopped applying', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();
    apply(projectedChange(4, ADDRESSABLE_ONE), workspace, session);

    // The ordering, as behaviour rather than as a comment: a surface opened during
    // the read *and* the session stopped. The conflict arm would fire a component's
    // callback, and a session that may apply nothing must not raise one.
    workspace.surfaces = [{ kind: 'matchEditor', target: { kind: 'document', document: 1 } }];
    workspace.bumped += 1;
    session.applying = false;
    expect(workspace.reread[0]?.guard()).toBe(false);
    expect(workspace.told).toEqual([]);
  });

  it('refuses and marks stale when the workspace epoch has moved', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();
    apply(projectedChange(4, ADDRESSABLE_ONE), workspace, session);

    session.live = EPOCH + 1;
    expect(workspace.reread[0]?.guard()).toBe(false);
    expect(workspace.statuses).toEqual([{ document: 1, status: { kind: 'stale' } }]);
  });

  it('refuses silently when a newer observation of the file was admitted', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();
    const sequences = createAcceptedSequences();
    apply(projectedChange(4, ADDRESSABLE_ONE), workspace, session, sequences);
    apply(projectedChange(5, ADDRESSABLE_ONE), workspace, session, sequences);

    // The older read refuses, and says nothing: the newer transition owns this
    // file now, so `stale` would describe a state the window is about to leave.
    expect(workspace.reread[0]?.guard()).toBe(false);
    expect(workspace.statuses).toEqual([]);
    expect(workspace.reread[1]?.guard()).toBe(true);
  });

  it('preserves a newer unreadable reason when the session has stopped applying', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();
    const sequences = createAcceptedSequences();
    // **Two files, because the fence is per document and a blanket suppression
    // would look identical over one.** Both get a change whose read is in flight.
    apply(projectedChange(4, ADDRESSABLE_ONE), workspace, session, sequences);
    apply(projectedChange(4, ADDRESSABLE_TWO), workspace, session, sequences);

    // A newer `Unreadable` for file 1 alone. It records `unavailable` with its
    // typed reason and — this is what makes the interleaving reachable — it
    // installs nothing and invalidates no projection, so all three of the host's
    // captures for the read in flight are still intact and that read still reaches
    // its guard.
    expect(apply(unreadable(5, ADDRESSABLE_ONE), workspace, session, sequences)).toBe(
      'unavailable'
    );

    // Then the session stops applying — a `discarded` that blocked without
    // recovering, or a disposal. `stillApplying` is the guard's *first* question
    // and stays first, because the arm below it fires a component's callback; what
    // changed is that its refusal no longer writes a status it does not own.
    session.applying = false;
    expect(workspace.reread[0]?.guard()).toBe(false);
    expect(workspace.reread[1]?.guard()).toBe(false);

    // File 1's reason survives: nothing appended `stale` over it, and it could
    // never be recovered if it had been — a blocked session advances the watermark,
    // so that observation is never delivered again. File 2 is marked, because no
    // newer observation of *it* was admitted and the older read really does still
    // own what its status says.
    expect(workspace.statuses).toEqual([
      { document: 1, status: { kind: 'unavailable', reason: DENIED } },
      { document: 2, status: { kind: 'stale' } }
    ]);
  }); // End of the ownership-before-the-write case

  it('preserves a newer status when the workspace epoch has moved', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();
    const sequences = createAcceptedSequences();
    apply(projectedChange(4, ADDRESSABLE_ONE), workspace, session, sequences);
    apply(projectedChange(4, ADDRESSABLE_TWO), workspace, session, sequences);
    apply(unreadable(5, ADDRESSABLE_ONE), workspace, session, sequences);

    // The same fence on the second arm. The epoch question is unreachable from the
    // production host — `open()` bumps the open generation in its first statement,
    // so the host's own pre-guard comparison refuses before this guard is asked —
    // and the arm is fenced anyway, because *which arm is reachable today* is not
    // the rule this is meant to encode.
    session.live = EPOCH + 1;
    expect(workspace.reread[0]?.guard()).toBe(false);
    expect(workspace.reread[1]?.guard()).toBe(false);
    expect(workspace.statuses).toEqual([
      { document: 1, status: { kind: 'unavailable', reason: DENIED } },
      { document: 2, status: { kind: 'stale' } }
    ]);
  }); // End of the epoch-arm fence case

  it('reaches neither arm below the ownership question once it is answered', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();
    const sequences = createAcceptedSequences();
    apply(projectedChange(4, ADDRESSABLE_ONE), workspace, session, sequences);
    apply(unreadable(5, ADDRESSABLE_ONE), workspace, session, sequences);

    // **What the ownership question does when it is the one that refuses.** A
    // surface is open *and* the registry moved, so both of the arms below it would
    // fire if they were reached — the surface arm would deliver a conflict
    // observation and the registry arm would write `stale`. Neither happens,
    // because the question is asked before both.
    //
    // **This case says nothing about whether those two arms need a fence of their
    // own, and the comment it used to carry claimed the opposite.** It said a
    // fence there would be a call that can never refuse and that no test could
    // tell it from no call. Both halves are false: `tellTheSurfaceAbout` runs two
    // host members between the question and either write, and the two cases added
    // at Phase 2d-5-4-B drive exactly that and discriminate.
    workspace.surfaces = [{ kind: 'matchEditor', target: { kind: 'document', document: 1 } }];
    workspace.bumped += 1;
    expect(workspace.reread[0]?.guard()).toBe(false);
    expect(workspace.told).toEqual([]);
    expect(workspace.statuses).toEqual([
      { document: 1, status: { kind: 'unavailable', reason: DENIED } }
    ]);
  }); // End of the arms-below-ownership case

  it('writes no stale on the registry arm when a host read admitted a newer one', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();
    const sequences = createAcceptedSequences();
    let hostile = false;
    // The same injected host as the conflict-arm case above, armed later: the
    // first arbitration has to be ordinary, because it is the one that admits
    // this observation and records the reread whose guard the case then asks.
    const injected: ReconciliationWorkspace = {
      ...workspace.workspace,
      /**
       * Answers the question, and admits a newer observation once armed.
       *
       * @param document - The file.
       * @returns Whatever the recording workspace would have answered.
       */
      creatorEligibility: (document: DocumentId): CreatorEligibility => {
        if (hostile) {
          sequences.admit(document, 9);
        }
        return workspace.workspace.creatorEligibility(document);
      }
    };
    applyObservation(projectedChange(4, ADDRESSABLE_ONE), injected, sequences, session.session);

    // A surface opened and closed again while the read was in flight, so the
    // registry arm is the one that refuses — and `tellTheSurfaceAbout` runs two
    // host members before it is reached, the second of which is the one armed
    // here. Nothing targets the file, so no conflict is delivered and the
    // registry generation is the only thing left to catch it.
    workspace.bumped += 2;
    hostile = true;
    expect(workspace.reread[0]?.guard()).toBe(false);

    // The arm still refuses the install. What it no longer does is write `stale`
    // over a newer transition's verdict on the strength of a question that was
    // answered before the host ran.
    expect(workspace.statuses).toEqual([]);
    expect(workspace.told).toEqual([]);
  }); // End of the registry-arm ownership case

  it('re-arbitrates onto the conflict path when a surface opened during the read', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();
    apply(projectedChange(4, ADDRESSABLE_ONE), workspace, session);
    expect(workspace.told).toEqual([]);

    // The consult's Q5: "If a surface opens during the read, the answer is not
    // installed; re-run arbitration against the retained observation and put the
    // surface on its conflict path."
    workspace.surfaces = [{ kind: 'matchEditor', target: { kind: 'document', document: 1 } }];
    workspace.bumped += 1;
    expect(workspace.reread[0]?.guard()).toBe(false);
    expect(workspace.told.map((entry) => entry.kind)).toEqual(['matchEditor']);
    expect(workspace.told[0]?.observation.sequence).toBe(4);
    expect(workspace.statuses).toEqual([{ document: 1, status: { kind: 'stale' } }]);
  });

  it('refuses when the registry moved and came back, with no surface to blame', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();
    apply(projectedChange(4, ADDRESSABLE_ONE), workspace, session);

    // A surface opened and closed again while the read was in flight. Nothing
    // targets the file now, so only the generation catches it — and refusing is
    // the safe direction: the file is marked stale rather than reloaded under
    // something this window did not see.
    workspace.bumped += 2;
    expect(workspace.reread[0]?.guard()).toBe(false);
    expect(workspace.statuses).toEqual([{ document: 1, status: { kind: 'stale' } }]);
  });

  it('does not confuse two documents’ guards', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();
    const sequences = createAcceptedSequences();
    apply(projectedChange(4, ADDRESSABLE_ONE), workspace, session, sequences);
    apply(projectedChange(4, ADDRESSABLE_TWO), workspace, session, sequences);

    // A newer observation of document 1 only: document 2's guard is untouched.
    apply(projectedChange(9, ADDRESSABLE_ONE), workspace, session, sequences);
    expect(workspace.reread[0]?.guard()).toBe(false);
    expect(workspace.reread[1]?.guard()).toBe(true);
  });
}); // End of the "guard" suite

describe('a removal of an addressable file', () => {
  it('drops the file and records that it is gone', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();

    expect(apply(removal(6, ADDRESSABLE_ONE), workspace, session)).toBe('removed');
    expect(workspace.removed).toEqual([1]);
    expect(workspace.statuses).toEqual([{ document: 1, status: { kind: 'removed' } }]);
    expect(workspace.reread).toEqual([]);
  });

  it('removes the file even with a surface open over it, and tells no surface', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();
    workspace.surfaces = [{ kind: 'matchDeleter', target: { kind: 'document', document: 1 } }];

    expect(apply(removal(6, ADDRESSABLE_ONE), workspace, session)).toBe('removed');
    expect(workspace.removed).toEqual([1]);
    // The surface is preserved — nothing unregisters it here — and it is **not**
    // told: `WriteSurfaceTransition` takes the narrowed `Changed`/`Projected`
    // snapshot, which a removal is not.
    expect(workspace.told).toEqual([]);
    expect(workspace.surfaces).toHaveLength(1);
  });

  it('keeps the accepted sequence, so a lost older observation stays refused', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();
    const sequences = createAcceptedSequences();
    apply(removal(6, ADDRESSABLE_ONE), workspace, session, sequences);

    expect(apply(projectedChange(5, ADDRESSABLE_ONE), workspace, session, sequences)).toBe(
      'superseded'
    );
    expect(workspace.reread).toEqual([]);
  });
}); // End of the "removal of an addressable file" suite

describe('an unreadable addressable file', () => {
  it('preserves the projection and every surface, and calls nothing', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();
    workspace.surfaces = [{ kind: 'restore', target: { kind: 'document', document: 1 } }];

    expect(apply(unreadable(6, ADDRESSABLE_ONE), workspace, session)).toBe('unavailable');
    expect(workspace.reread).toEqual([]);
    expect(workspace.removed).toEqual([]);
    expect(workspace.told).toEqual([]);
    expect(workspace.statuses).toEqual([
      { document: 1, status: { kind: 'unavailable', reason: DENIED } }
    ]);
  });
}); // End of the "unreadable addressable file" suite

describe('an addition', () => {
  it('inserts the row, forces loaded false and calls no command', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();

    // The wire promises `loaded: false`; this arm forces it rather than trusting
    // it, so the ruling stays true of a wire that changed.
    expect(apply(addition(3, 42, true), workspace, session)).toBe('added');
    expect(workspace.added).toHaveLength(1);
    expect(workspace.added[0]?.id).toBe(42);
    expect(workspace.added[0]?.loaded).toBe(false);
    expect(workspace.reread).toEqual([]);
    expect(workspace.reopened).toEqual([]);
  });

  it('marks an addition this application cannot read', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();

    expect(
      apply(
        {
          Added: {
            sequence: 3,
            document_summary: makeSummary({ id: 42, relativePath: 'match/new-42.yml' }),
            content: { Unreadable: { reason: DENIED } }
          }
        },
        workspace,
        session
      )
    ).toBe('added');
    expect(workspace.added).toHaveLength(1);
    expect(workspace.statuses).toEqual([
      { document: 42, status: { kind: 'unavailable', reason: DENIED } }
    ]);
  });

  it('arbitrates two additions of one path by sequence', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();
    const sequences = createAcceptedSequences();

    expect(apply(addition(8, 42), workspace, session, sequences)).toBe('added');
    expect(apply(addition(5, 42), workspace, session, sequences)).toBe('superseded');
    expect(apply(addition(8, 43), workspace, session, sequences)).toBe('added');
    expect(workspace.added.map((summary) => summary.id)).toEqual([42, 43]);
  });
}); // End of the "addition" suite

describe('a Named identity the open workspace refuses', () => {
  it('marks a pending row stale and asks for a membership reload', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();
    workspace.rows = [9];

    expect(apply(projectedChange(4, NAMED_NINE), workspace, session)).toBe('pendingRow');
    expect(workspace.statuses).toEqual([{ document: 9, status: { kind: 'stale' } }]);
    expect(session.requests).toHaveLength(1);
    // Never a command, and never the guarded reread: the identity is one
    // `document_context` refuses.
    expect(workspace.reread).toEqual([]);
    expect(workspace.removed).toEqual([]);
  });

  it('asks for a membership reload even when it holds no row', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();

    expect(apply(projectedChange(4, NAMED_NINE), workspace, session)).toBe('noPendingRow');
    expect(workspace.statuses).toEqual([]);
    expect(session.requests).toHaveLength(1);
  });

  it('removes a pending row and asks for nothing', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();
    workspace.rows = [9];

    expect(apply(removal(4, NAMED_NINE), workspace, session)).toBe('pendingRow');
    expect(workspace.removed).toEqual([9]);
    expect(workspace.statuses).toEqual([{ document: 9, status: { kind: 'removed' } }]);
    expect(session.requests).toEqual([]);
  });

  it('no-ops a removal of a row it does not hold', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();

    expect(apply(removal(4, NAMED_NINE), workspace, session)).toBe('noPendingRow');
    expect(workspace.removed).toEqual([]);
    expect(workspace.statuses).toEqual([]);
    expect(session.requests).toEqual([]);
  });

  it('attaches an unreadable reason to a pending row, and to nothing otherwise', () => {
    const withRow = recordingWorkspace();
    const withoutRow = recordingWorkspace();
    const session = recordingSession();
    withRow.rows = [9];

    expect(apply(unreadable(4, NAMED_NINE), withRow, session)).toBe('pendingRow');
    expect(withRow.statuses).toEqual([
      { document: 9, status: { kind: 'unavailable', reason: DENIED } }
    ]);
    expect(apply(unreadable(4, NAMED_NINE), withoutRow, session)).toBe('noPendingRow');
    expect(withoutRow.statuses).toEqual([]);
    expect(session.requests).toEqual([]);
  });

  it('arbitrates a Named identity through the same per-document map', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();
    const sequences = createAcceptedSequences();
    workspace.rows = [9];

    expect(apply(projectedChange(7, NAMED_NINE), workspace, session, sequences)).toBe(
      'pendingRow'
    );
    expect(apply(removal(3, NAMED_NINE), workspace, session, sequences)).toBe('superseded');
    expect(workspace.removed).toEqual([]);
  });
}); // End of the "Named identity" suite

describe('an Unnamed path', () => {
  it('records a change and asks for a membership reload, inventing no identity', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();

    expect(apply(projectedChange(4, UNNAMED), workspace, session)).toBe('pathDrift');
    expect(workspace.drift).toEqual([
      { relativePath: 'match/stranger.yml', detail: { kind: 'changed' } }
    ]);
    expect(session.requests).toHaveLength(1);
    expect(workspace.reread).toEqual([]);
    expect(workspace.removed).toEqual([]);
    expect(workspace.added).toEqual([]);
    expect(workspace.statuses).toEqual([]);
  });

  it('records a removal and asks for a whole reload', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();

    expect(apply(removal(4, UNNAMED), workspace, session)).toBe('pathDrift');
    expect(workspace.drift).toEqual([
      { relativePath: 'match/stranger.yml', detail: { kind: 'removed' } }
    ]);
    expect(session.requests).toHaveLength(1);
    expect(workspace.removed).toEqual([]);
  });

  it('records an unreadable path and asks for nothing', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();

    expect(apply(unreadable(4, UNNAMED), workspace, session)).toBe('pathDrift');
    expect(workspace.drift).toEqual([
      { relativePath: 'match/stranger.yml', detail: { kind: 'unreadable', reason: DENIED } }
    ]);
    expect(session.requests).toEqual([]);
  });

  it('is not arbitrated by sequence, because it has no identity to key one by', () => {
    const workspace = recordingWorkspace();
    const session = recordingSession();
    const sequences = createAcceptedSequences();

    apply(removal(9, UNNAMED), workspace, session, sequences);
    // An older observation of the same path is recorded too: nothing orders two
    // `Unnamed` observations, and the host is what bounds the record.
    expect(apply(projectedChange(2, UNNAMED), workspace, session, sequences)).toBe('pathDrift');
    expect(workspace.drift).toHaveLength(2);
    expect(sequences.sequenceFor(1)).toBe(0);
  });
}); // End of the "Unnamed path" suite
