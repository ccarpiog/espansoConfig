/**
 * What one admitted external observation does to this window — Phase 2d-5-4.
 *
 * ## What it is
 *
 * The design consult's Q8 as a value: the **routing boundary** that narrows one
 * {@link ExternalObservation} into this module's own vocabulary
 * (`docs/reviews/phase-2d-5-design.md:246-256`), the **per-document accepted
 * sequences** its Q2 names as the arbitration key, and the application of each
 * arm to a {@link ReconciliationWorkspace}. `./reconciliationCoordinator.ts`
 * decides *when* to drain and what a batch does to the session cursor; this
 * module decides what one observation inside an accepted batch does to the
 * documents, the projections and the selection.
 *
 * ## Where it lives, and why it is not in `./reconciliationCoordinator.ts`
 *
 * `docs/decisions/2d-5-split-notes.md` section 6 item 2 leaves *where the
 * coordinator lives* to the steps, and this step follows the precedent 2d-5-2a
 * set with `./writeSurfaceRegistry.ts` and 2d-5-3 set with
 * `./reconciliationCoordinator.ts`: a **plain TypeScript** module — no runes,
 * hence `.ts` — beside `./workspace.svelte.ts` rather than more lines inside it.
 * `./workspace.svelte.ts` was 4 083 lines when this step began and
 * `./reconciliationCoordinator.ts` 1 227; the routing table, the sequence map and
 * the eleven arms below are a subject of their own, and a module with no runes in
 * it is drivable by a model test with nothing mounted.
 *
 * ## The two sequence states are deliberately two
 *
 * {@link AcceptedSequences} is **not** the session cursor. Ruling 6 keeps them
 * apart because they answer different questions — the cursor's watermark is the
 * drain acknowledgement, and this map is what makes an *older* observation inert
 * even when the watermark has advanced past it — and it says in as many words
 * that treating a disagreement between the two numbers as a bug would be the
 * design error. **Nothing in the types says they should agree, and nothing
 * enforces that a transition consults the right one.**
 *
 * ## What it cannot force
 *
 * - **Nothing here stops a caller passing a `Named` identity to a command.**
 *   {@link routeObservation} narrows the three {@link ObservedDocument} arms into
 *   three different route arms and never produces *the identity, where there is
 *   one* — ruling 29's forbidden accessor — but a consumer that has narrowed to
 *   {@link ObservationRoute}'s `namedRow` arm still holds a `DocumentId`, and only
 *   the negative command-spy tests in `./workspace.test.ts` establish that no
 *   open-workspace document command is reached from it. That is ruling 28 read
 *   exactly: the `never` terminus forces a future fourth arm to be handled and
 *   cannot force the narrowed branch not to call a command.
 * - **Nothing here forces a {@link ReconciliationWorkspace} to be the one that
 *   owns the window.** Every member is a function this module calls and none of
 *   them answers whether it did anything; a host whose `removeDocument` does
 *   nothing produces the same outcome value as one that removes the file.
 * - **No user-facing string is produced here and none is owed yet.**
 *   {@link ExternalDocumentStatus} and {@link ExternalPathDrift} are codes, and
 *   `docs/decisions/2d-5-split-notes.md` section 6 item 6 puts the EN/ES entries
 *   and the `src/lib/i18n/codes.ts` accessor on the step that first names such a
 *   state *to a person* — 2d-6, which draws them. Nothing on a screen reads either
 *   type today.
 */

import type {
  AddedContent,
  ChangedContent,
  ContentRevision,
  DocumentId,
  DocumentSummary,
  ExternalObservation,
  UnreadableReason
} from '../ipc/types';
import type { ExternalConflictObservation } from './conflictSource';
import {
  targetingSurfaceFor,
  type CreatorEligibility,
  type OpenWriteSurface,
  type OpenWriteSurfaceKind
} from './restore';
import type { WriteSurfaceTransition } from './writeSurfaceRegistry';

/**
 * What kind of external event one observation reported, without its operands.
 *
 * **Three members, not four**: `Added` never reaches this type, because it is the
 * one observation with no {@link ObservedDocument} arm and therefore no arm of
 * {@link ObservationRoute} that needs a detail beside an identity it does not
 * have.
 *
 * The `unreadable` arm carries its reason so that no consumer has to hold a
 * nullable one beside a discriminant that already decides whether there is a
 * reason at all.
 */
export type ObservationDetail =
  | {
      /** The file's bytes changed. */
      readonly kind: 'changed';
    }
  | {
      /** The file is gone. */
      readonly kind: 'removed';
    }
  | {
      /** The file is there and this application cannot read it. */
      readonly kind: 'unreadable';
      /** Why, exactly as the engine reported it. */
      readonly reason: UnreadableReason;
    };

/**
 * What this window can truthfully say about a file it did **not** reload.
 *
 * **A code, never a sentence** (`CLAUDE.md` section 2), and no component renders
 * one yet. The sentences exist since Phase 2d-6-9a, reached through
 * `describeReconciliationFileState` in `src/lib/i18n/codes.ts` over the decisions
 * of `./reconciliationStatus.ts`; 2d-6-9b draws them.
 *
 * Every arm is a statement about *this window's knowledge*, never about the file:
 * `stale` says this window did not install what the watcher saw, `unavailable`
 * says the engine could not read the bytes, and `removed` says the file this
 * window held is gone. None of them says a write surface over that file has been
 * edited — `isDirty` is derived inside each surface's own session and no
 * coordinator can observe it (R36).
 */
export type ExternalDocumentStatus =
  | {
      /**
       * The file changed on disk and this window is still showing the older
       * projection — since Phase 2d-6-9b-1, the orchestrator's ruling: the window
       * holds a disk snapshot of this file newer than its installed projection.
       *
       * Either because a write surface that may be about it is open — the
       * conservative sentence of ruling 19 — or because the guard refused an
       * installation after the read, or because a save of this window's was refused
       * as a conflict on a revision the window does not show (`BrowserState`'s six
       * save wrappers, which no observation can mark for, since the backend
       * coalesces that reading). **It does not say which**, and a consumer that
       * needs to know asks the registry rather than this value. A confirmed
       * `adoptDiskVersion` install clears a mark nothing has written over since its
       * conflict was registered.
       */
      readonly kind: 'stale';
    }
  | {
      /** The engine reported the bytes unreadable. */
      readonly kind: 'unavailable';
      /** Why, exactly as it reported it. */
      readonly reason: UnreadableReason;
    }
  | {
      /**
       * The file was removed, and this window has dropped everything derived
       * from it.
       *
       * **Kept after the row is gone on purpose**: a write surface over that file
       * is preserved rather than closed (Q8), so the state that describes its
       * target has to outlive the row. Nothing here tells the surface — see
       * {@link ReconciliationWorkspace.transitionFor}.
       */
      readonly kind: 'removed';
    };

/**
 * One path this window holds no identity for, and what was observed of it.
 *
 * The `Unnamed` arm's whole product. **No identity is invented** (Q8), so this
 * value carries the lossy display path and nothing that could be passed to a
 * command — `src/lib/ipc/types.ts` says a wire path is never round-trippable as a
 * command argument, which is the same reason ruling 11 refuses `summary.root`.
 */
export interface ExternalPathDrift {
  /** The path, for display. Lossy — see `DocumentView.path`. */
  readonly relativePath: string;
  /** What was observed of it. */
  readonly detail: ObservationDetail;
}

/**
 * The highest observation sequence each document has accepted a transition for.
 *
 * **The arbitration key of the consult's Q2**, and deliberately a *second*
 * sequence state beside the session cursor: the cursor says what the next drain
 * asks with, and this says which observation of one file is the newest one this
 * window has acted on. The two may legitimately hold different numbers (ruling 6).
 *
 * **Keyed by `DocumentId` across the `Addressable` and `Named` arms both**, and
 * that is a decision rather than an accident: this process mints one identity per
 * path, so the same file observed while the open workspace resolves it and after
 * it stops resolving it is one key. What the map cannot do is arbitrate an
 * `Unnamed` observation, which carries no identity at all — those are appended to
 * {@link ExternalPathDrift} with no ordering of any kind.
 */
export interface AcceptedSequences {
  /**
   * Records this observation as the newest for one file, if it is.
   *
   * **The check and the record are one call, deliberately.** `CLAUDE.md` names a
   * check and a spend separated by any property read as this project's repeated
   * defect: a property read runs arbitrary code through a getter or a proxy trap,
   * so `if (sequence > sequenceFor(d)) { … }` followed by a write is not atomic in
   * a way any type expresses. Answering the question *and* moving the number in
   * one call removes the window.
   *
   * **Strictly greater, never greater-or-equal.** Two observations of one file
   * admitted under one sequence would be one observation delivered twice, and
   * applying the second is what makes a transition run against state the first
   * already moved.
   *
   * @param document - The file.
   * @param sequence - The sequence the observation was admitted under.
   * @returns `true` when this is the newest and the map now says so.
   */
  admit(document: DocumentId, sequence: number): boolean;
  /**
   * Whether one already-admitted observation is still the newest for its file.
   *
   * The recheck half of ruling 18's guard, asked after an await. **It reads and
   * changes nothing**, so a caller that asks it twice gets the same answer for the
   * same state — which is what lets it sit inside a guard that may be called more
   * than once.
   *
   * @param document - The file.
   * @param sequence - The sequence captured before the await.
   * @returns `true` while nothing newer for that file has been admitted.
   */
  isNewest(document: DocumentId, sequence: number): boolean;
  /**
   * The highest sequence admitted for one file.
   *
   * @param document - The file.
   * @returns The sequence, or zero for a file nothing has been admitted for.
   */
  sequenceFor(document: DocumentId): number;
  /**
   * Forgets every file's sequence.
   *
   * Called at the entry of every `open()`, which is the consult's Q2 step 1.
   *
   * **The reason is the epoch's sequence numbering, and not a change of identity**
   * — Phase 2d-5-4-D. A `DocumentId` is minted per *path* from a table that lives
   * as long as the process (`crates/espansoconfig-core/src/workspace/mod.rs`,
   * `identity_of` and `Workspace::from_tree`'s own contract), so the same path
   * answers the same number across any number of opens and a retained entry is
   * never "a sequence for a different file": it is a sequence for the **same**
   * file, or for a file the replacing workspace does not hold. What makes keeping
   * one wrong is that a new epoch restarts its observations at
   * `FIRST_OBSERVATION_SEQUENCE`, so an entry holding the closed workspace's
   * highest number would refuse every early observation the new epoch delivers for
   * that same file — the sharper reason, and the one this module's two lifecycle
   * fences exist to keep unreachable: {@link applyObservation}'s, above every
   * arm's dispatch, and {@link applyAddition}'s, below its own materialization
   * window.
   */
  clear(): void;
} // End of interface AcceptedSequences

/**
 * Builds an empty accepted-sequence map.
 *
 * A plain `Map`, not `$state`: nothing renders it, and a coordinator reads it
 * immediately before it decides something.
 *
 * @returns The map, holding nothing.
 */
export function createAcceptedSequences(): AcceptedSequences {
  const highest = new Map<DocumentId, number>();
  return {
    admit(document: DocumentId, sequence: number): boolean {
      const held = highest.get(document) ?? 0;
      if (sequence <= held) {
        return false;
      }
      highest.set(document, sequence);
      return true;
    }, // End of function admit()

    isNewest(document: DocumentId, sequence: number): boolean {
      return (highest.get(document) ?? 0) === sequence;
    },

    sequenceFor(document: DocumentId): number {
      return highest.get(document) ?? 0;
    },

    clear(): void {
      highest.clear();
    }
  };
} // End of function createAcceptedSequences()

/**
 * One observation, narrowed into the arm this window acts on.
 *
 * **Six arms over the thirteen cells of the consult's Q8 table.** Three of them
 * carry an identity the **open workspace resolves** and are the only three a
 * document command may be reached from; one is the addition, which has no
 * `ObservedDocument` arm at all; and two are the `Named` and `Unnamed` arms, which
 * produce state-only transitions and notices (ruling 28).
 *
 * **The `Named` arm's identity is called `namedDocument` on purpose.** It is a
 * `DocumentId` and it is **not an address** — `document_context` refuses it, which
 * is the whole difference between the two numbered arms — so it is not spelled
 * `document` anywhere a reader could mistake the two while skimming. Nothing in
 * TypeScript enforces that reading; the name is a convention and the tests are the
 * check.
 */
export type ObservationRoute =
  | {
      /** The file's bytes changed, and the open workspace resolves it. */
      readonly kind: 'changed';
      /** The sequence it was admitted under. */
      readonly sequence: number;
      /** The file, as the open workspace resolves it. */
      readonly document: DocumentId;
      /** The last stable revision the engine held, or `null`. */
      readonly previousRevision: ContentRevision | null;
      /** The revision of the exact bytes now on disk. */
      readonly diskRevision: ContentRevision;
      /** The projection of those bytes, or why there is none. */
      readonly content: ChangedContent;
    }
  | {
      /** The file is gone, and the open workspace resolved it. */
      readonly kind: 'removedDocument';
      /** The sequence it was admitted under. */
      readonly sequence: number;
      /** The file, as the open workspace resolves it. */
      readonly document: DocumentId;
    }
  | {
      /** The file is unreadable, and the open workspace resolves it. */
      readonly kind: 'unreadableDocument';
      /** The sequence it was admitted under. */
      readonly sequence: number;
      /** The file, as the open workspace resolves it. */
      readonly document: DocumentId;
      /** Why the text is not available. */
      readonly reason: UnreadableReason;
    }
  | {
      /** A file this workspace did not hold has appeared. */
      readonly kind: 'added';
      /** The sequence it was admitted under. */
      readonly sequence: number;
      /** The row a sidebar draws. Its identity is **not** an address. */
      readonly summary: DocumentSummary;
      /** The projection of the stabilized bytes, or why there is none. */
      readonly content: AddedContent;
    }
  | {
      /**
       * This process minted an identity for the path and the open workspace does
       * **not** hold it.
       */
      readonly kind: 'namedRow';
      /** The sequence it was admitted under. */
      readonly sequence: number;
      /** The identity, which no open-workspace command accepts. */
      readonly namedDocument: DocumentId;
      /** What was observed. */
      readonly detail: ObservationDetail;
    }
  | {
      /** No identity for the path has ever been minted anywhere. */
      readonly kind: 'unnamedPath';
      /** The sequence it was admitted under. */
      readonly sequence: number;
      /** The path, for display. Lossy, and never an address. */
      readonly relativePath: string;
      /** What was observed. */
      readonly detail: ObservationDetail;
    };

/**
 * Narrows one observation into the arm this window acts on.
 *
 * **The routing boundary, and the `never` terminus is the point.** A fifth
 * {@link ExternalObservation} arm added in Rust, or a fourth
 * {@link ObservedDocument} arm, becomes a compile error here — in the one function
 * that decides which transition runs. What it cannot do is stop a consumer of the
 * answer treating `namedRow` as addressable; ruling 28 says so and the negative
 * command-spy tests are what establish it.
 *
 * **The three-arm narrowing is written out three times rather than extracted.**
 * Ruling 29 forbids a common identity helper: one would answer *the identity,
 * where there is one*, which collapses `Addressable` and `Named` into one answer
 * with a `?` and destroys the only thing that value carries. Three exhaustive
 * switches that each keep the arm in their own answer is what the repetition buys,
 * and the consult asks for exactly that shape.
 *
 * @param observation - One observation, exactly as it crossed the boundary.
 * @returns The arm, with only the operands that arm has.
 */
export function routeObservation(observation: ExternalObservation): ObservationRoute {
  if ('Changed' in observation) {
    const changed = observation.Changed;
    const document = changed.document;
    if ('Addressable' in document) {
      return {
        kind: 'changed',
        sequence: changed.sequence,
        document: document.Addressable.document,
        previousRevision: changed.previous_revision,
        diskRevision: changed.disk_revision,
        content: changed.content
      };
    }
    if ('Named' in document) {
      return {
        kind: 'namedRow',
        sequence: changed.sequence,
        namedDocument: document.Named.document,
        detail: { kind: 'changed' }
      };
    }
    if ('Unnamed' in document) {
      return {
        kind: 'unnamedPath',
        sequence: changed.sequence,
        relativePath: document.Unnamed.relative_path,
        detail: { kind: 'changed' }
      };
    }
    const unreachableDocument: never = document;
    return unreachableDocument;
  }
  if ('Added' in observation) {
    // **No `ObservedDocument` arm at all** (ruling 30): an addition's identity is
    // by definition not an address the open workspace resolves, so there is
    // nothing here to narrow and nothing to decide.
    return {
      kind: 'added',
      sequence: observation.Added.sequence,
      summary: observation.Added.document_summary,
      content: observation.Added.content
    };
  }
  if ('Removed' in observation) {
    const removed = observation.Removed;
    const document = removed.document;
    if ('Addressable' in document) {
      return {
        kind: 'removedDocument',
        sequence: removed.sequence,
        document: document.Addressable.document
      };
    }
    if ('Named' in document) {
      return {
        kind: 'namedRow',
        sequence: removed.sequence,
        namedDocument: document.Named.document,
        detail: { kind: 'removed' }
      };
    }
    if ('Unnamed' in document) {
      return {
        kind: 'unnamedPath',
        sequence: removed.sequence,
        relativePath: document.Unnamed.relative_path,
        detail: { kind: 'removed' }
      };
    }
    const unreachableDocument: never = document;
    return unreachableDocument;
  }
  if ('Unreadable' in observation) {
    const unreadable = observation.Unreadable;
    const document = unreadable.document;
    if ('Addressable' in document) {
      return {
        kind: 'unreadableDocument',
        sequence: unreadable.sequence,
        document: document.Addressable.document,
        reason: unreadable.reason
      };
    }
    if ('Named' in document) {
      return {
        kind: 'namedRow',
        sequence: unreadable.sequence,
        namedDocument: document.Named.document,
        detail: { kind: 'unreadable', reason: unreadable.reason }
      };
    }
    if ('Unnamed' in document) {
      return {
        kind: 'unnamedPath',
        sequence: unreadable.sequence,
        relativePath: document.Unnamed.relative_path,
        detail: { kind: 'unreadable', reason: unreadable.reason }
      };
    }
    const unreachableDocument: never = document;
    return unreachableDocument;
  }
  const unreachable: never = observation;
  return unreachable;
} // End of function routeObservation()

/**
 * The narrowed `Changed`/`Addressable`/`Projected` snapshot a write surface is
 * told about, or `null`.
 *
 * **The only producer of an {@link ExternalConflictObservation} in this
 * repository**, and it is deliberately narrow: `./conflictSource.ts` declares the
 * value as the already-narrowed snapshot carrying its own sequence, revision, disk
 * text, projection and correspondence table, and every one of those operands
 * exists only on that one combination of arms.
 *
 * **It copies nothing and pairs nothing.** The five operands come out of one wire
 * snapshot; this function reassembles them under this window's own names and
 * cannot check that they belong together — that is a fact about the Rust that
 * built them, which `src/lib/ipc/types.ts` says TypeScript does not express.
 *
 * @param route - A route, of any arm.
 * @returns The snapshot, or `null` when this route is not that combination.
 */
export function externalConflictObservationOf(
  route: ObservationRoute
): ExternalConflictObservation | null {
  if (route.kind !== 'changed') {
    return null;
  }
  const content = route.content;
  if (!('Projected' in content)) {
    return null;
  }
  const projected = content.Projected;
  return {
    sequence: route.sequence,
    document: route.document,
    previousRevision: route.previousRevision,
    diskRevision: route.diskRevision,
    diskText: projected.disk_text,
    disk: projected.disk,
    findings: projected.findings,
    correspondences: projected.correspondences
  };
} // End of function externalConflictObservationOf()

/**
 * Everything an observation needs from the window that owns it.
 *
 * **Eleven members, and none of them answers whether it did anything.** That is
 * the honest shape rather than a convenience: this module decides, the host acts,
 * and the outcome value below records what was decided. A host whose
 * `removeDocument` is a no-op produces the identical outcome to one that removes
 * the file, so the workspace tests assert the *window*, never this value alone.
 *
 * **No member of this interface writes a file, and there is deliberately no
 * member that could.** Ruling 27 forbids watcher arbitration initiating any save
 * command, and the narrowest way to say so is to hand this module a surface with
 * no writing command on it at all — the same argument `ReconciliationHost` makes
 * for taking a `drain` rather than the whole `BrowserCommands`.
 */
export interface ReconciliationWorkspace {
  /**
   * Every write surface this window has open.
   *
   * @returns The live set, in the registry's own order.
   */
  openWriteSurfaces(): readonly OpenWriteSurface[];
  /**
   * How many times that live set has changed.
   *
   * Ruling 18's registry capture. **An unmoved generation means no registry
   * operation happened between the capture and the recheck**; it does not say the
   * set is the same, and it does not say a surface still names the file it named.
   *
   * @returns The generation.
   */
  writeSurfaceGeneration(): number;
  /**
   * Whether the new-snippet form would offer one file as a destination.
   *
   * `creatorEligibilityOf` in `./restore.ts` is what answers it honestly; this
   * member exists because the answer needs the window's own summary and
   * projection, which this module does not hold.
   *
   * @param document - The file.
   * @returns Whether an unknown-target creator may be about it.
   */
  creatorEligibility(document: DocumentId): CreatorEligibility;
  /**
   * The transition of the live surface of one kind, or `null`.
   *
   * **It is the only way an observation reaches a component**, and what a surface
   * does with one is that surface's business — `WriteSurfaceTransition` answers
   * `void`, so nothing here learns whether a conflict was raised. Since Phase
   * 2d-6-6b the transition `DetailPane.svelte` registers hands the observation to
   * `BrowserState.observeExternalChange` for the editor, the new-snippet form and
   * the recovery form, since Phase 2d-6-7a for the three operation panels, and
   * since Phase 2d-6-8a for the raw editor and restore.
   *
   * @param kind - Which kind of surface.
   * @returns Its transition, or `null` when no surface of that kind is live.
   */
  transitionFor(kind: OpenWriteSurfaceKind): WriteSurfaceTransition | null;
  /**
   * Whether this window holds a row for one identity.
   *
   * The *locally pending row* the consult's Q8 names in its `Named` column: the
   * only way this window can hold a row the open workspace does not resolve is
   * that an earlier `Added` inserted one.
   *
   * @param document - The identity.
   * @returns Whether a row with it exists.
   */
  holdsDocument(document: DocumentId): boolean;
  /**
   * Reads one file again and installs it **only while the guard holds**.
   *
   * Ruling 17: the clean path delegates to the existing reread machinery rather
   * than installing the batch's own projection, because the batch's projection is
   * snapshot-exact and installing it directly would bypass `installView`'s
   * invalidation and the selection discipline. The extra disk read is the accepted
   * cost.
   *
   * **The guard is checked immediately before the installation and in the same
   * synchronous block as it** (ruling 18), and the host owns that ordering —
   * nothing in this type expresses it.
   *
   * **It answers nothing, and that is not a discarded result.** The read is
   * asynchronous and the decision this module made is already complete; a promise
   * answered here would be one every caller would have to ignore, which is the
   * shape this project has shipped as a defect. What the read did is observable on
   * the window.
   *
   * **The host marks the file `stale` for as long as the read is out, and `owns`
   * is what entitles it to** — Phase 2d-5-4-C's finding 4. That mark is a write to
   * this file's status, and the caller's own ownership question was answered
   * *before* the two host members {@link tellTheSurfaceAbout} consults and before
   * `writeSurfaceGeneration()`; `CLAUDE.md` says a check and a spend separated by
   * any such read are not atomic. The write cannot move to the caller — it belongs
   * with the read it describes — so the question travels to the write instead.
   * **Nothing in this type says `owns` really asks about ownership**: it is a
   * `() => boolean`, and a caller passing `() => true` would compile.
   *
   * @param document - The file to read again.
   * @param guard - Asked immediately before the installation; `false` installs
   *   nothing.
   * @param owns - Asked immediately before the initial `stale` mark, in the same
   *   synchronous block as it; `false` writes no status at all.
   */
  rereadUnderGuard(
    document: DocumentId,
    guard: () => boolean,
    owns: () => boolean
  ): void;
  /**
   * Inserts or replaces one sidebar row by identity.
   *
   * Ruling 30. The caller has already forced `loaded: false`; this member does not
   * check it.
   *
   * @param summary - The row.
   */
  addDocument(summary: DocumentSummary): void;
  /**
   * Drops one file and everything this window derived from it.
   *
   * Ruling 31's synchronous transition. **Not `repairAfter`**, which repairs only
   * against a supplied projection and a removed file has none.
   *
   * @param document - The file that is gone.
   */
  removeDocument(document: DocumentId): void;
  /**
   * Records what this window can say about a file it did not reload.
   *
   * @param document - The file.
   * @param status - The code, or `null` to say there is nothing to report.
   */
  noteDocumentStatus(document: DocumentId, status: ExternalDocumentStatus | null): void;
  /**
   * Records what was observed of a path this window holds no identity for.
   *
   * @param drift - The path and what was observed of it.
   */
  notePathDrift(drift: ExternalPathDrift): void;
  /**
   * Re-runs the retained original open request.
   *
   * Ruling 11: **the retained request, never `summary.root`**, which is a lossy
   * rendering and is not round-trippable as a command argument. Two callers, both
   * in `./reconciliationCoordinator.ts` and both with the retained request: the
   * discarded-history recovery, only with no write surface open; and, since Phase
   * 2d-6-1c, `reopenFromRetainedRequest`, which the window's two guarded reload
   * request methods reach after rechecking the registry, the outstanding writes,
   * the open gate and disposal themselves. No transition in this module calls it.
   *
   * @param request - Exactly what the original `open()` was called with.
   */
  reopenWorkspace(request: string | null): void;
} // End of interface ReconciliationWorkspace

/**
 * What the coordinator lends one observation for the length of its transition.
 *
 * Three of the four members are about the session itself, which lives in
 * `./reconciliationCoordinator.ts` and is not this module's to hold; the fourth is
 * where a membership-reload request goes.
 */
export interface ObservationSession {
  /** The epoch the batch carrying this observation was accepted under. */
  readonly epoch: number;
  /**
   * The epoch the coordinator is showing **now**, read at the moment of asking.
   *
   * A function rather than a number because ruling 18's guard asks it *after* an
   * await: an `open()` that landed meanwhile has cleared the adopted epoch, and a
   * stored number could not see that.
   *
   * @returns The adopted epoch, or zero when none is adopted.
   */
  epochNow(): number;
  /**
   * Whether the lifecycle this batch was read in is still the one in force.
   *
   * **The question neither {@link epoch} nor {@link stillApplying} can answer** —
   * Phase 2d-5-4-E. A re-open sets the coordinator's epoch to `0` and its `accept`
   * adopts `0` exactly like any other value, so two lifecycles may legitimately
   * show one epoch and the comparison beside this one is then vacuous;
   * `stillApplying` reports disposal and the blocked state, and a re-open sets
   * neither. What is left over is precisely the event every fence in this module
   * exists for: `workspaceOpened` emptying the accepted-sequence map, which is the
   * one thing {@link AcceptedSequences.admit} answers **permissively**.
   *
   * **What it is good for is the interval, not the instant.** The coordinator
   * answers it by comparing a counter it never resets against a capture taken
   * before it read anything at all of the command's answer — so a `false` means
   * *something ended that lifecycle at some point since*, and a `true` means
   * nothing had, as of this call. Asking it twice across caller code is therefore
   * not the same as asking it once.
   *
   * **What no type forces.** This is a declaration on an interface: a caller may
   * implement it as a constant `true`, and `readonly` on {@link epoch} does not
   * make that member a data property either. The monotonic counter, the capture
   * point and the closure are properties of `./reconciliationCoordinator.ts`'s
   * implementation alone, and an arm of this module that never asks still
   * compiles.
   *
   * @returns `true` while nothing has ended the lifecycle this batch belongs to.
   */
  lifecycleIsOurs(): boolean;
  /**
   * Whether the coordinator is **still applying observations at all**.
   *
   * **The question the other three could not ask, and the reason it exists.** The
   * epoch, the accepted sequence, the registry generation and the host's own three
   * captures all compare one number taken before an await with the same number
   * after it — so every one of them is unmoved by a coordinator that has *stopped*
   * without replacing the workspace.
   *
   * **The enumeration above is `applyChange`'s guard's four questions, and it is
   * not every question this interface offers** — Phase 2d-5-4-G, correcting a
   * sentence that read as though it were. {@link lifecycleIsOurs} was added to this
   * interface one round earlier and it **does** move on a disposal:
   * `./reconciliationCoordinator.ts`'s `dispose()` increments the applying
   * lifecycle, which is the counter that member compares, and
   * {@link lifecycleMovedUnder}'s doc says so in as many words. So the reason this
   * member exists is a fact about the guard that consumes it rather than about
   * every guard that could be built — `applyChange`'s guard deliberately does not
   * ask `lifecycleIsOurs`, so nothing **it** compares moves on a disposal, and this
   * member is what that guard asks instead.
   *
   * Two such states exist and both are reachable while a clean reread is in flight:
   *
   * - **A hole in the observation history that could not be recovered from.**
   *   `ReconciliationBlock`'s `blockedByLostHistory` arm is entered when `discarded`
   *   rises, and the recovery is *deferred* whenever a write surface is open — so
   *   the epoch, the open generation and every projection generation stay exactly
   *   where the in-flight read left them. Installing under that block would land a
   *   piecemeal answer underneath the whole-reload obligation that is the blocked
   *   state's entire safety argument, and clearing the file's status would tell the
   *   person the file is reconciled while the session is in the state that means
   *   *I cannot describe this workspace's membership*.
   * - **Disposal.** Nothing `applyChange`'s guard compares moves when a coordinator
   *   is disposed — its four questions are the epoch, the accepted sequence, the
   *   registry generation and the host's capture, and none of them is the applying
   *   lifecycle — so a read in flight at `dispose()` would install after
   *   reconciliation was stopped. **Bounded to that guard at Phase 2d-5-4-G**: the
   *   sentence said *nothing a guard compares*, which is false of a guard that asks
   *   {@link lifecycleIsOurs}, because `dispose()` moves the counter behind it.
   *
   * **What it does not cover.** It is a fact about the *coordinator*, not about the
   * window: it says nothing about whether the workspace was replaced
   * ({@link ObservationSession.lifecycleIsOurs} is the member that answers that
   * — named here at Phase 2d-5-4-F, which added it one round earlier and left this
   * list reading as though the two below were the whole set; the epoch says it only
   * for a session that adopted a non-zero one, and the host's open-generation
   * capture only on the paths that take one), nothing about whether a newer
   * observation of the file was admitted, and nothing about whether a surface has
   * unsaved edits (R36). A recovery that *runs* answers `true` again immediately —
   * it clears the block before firing `reopenWorkspace` — and what catches the read
   * in flight across that is the host's own open-generation capture, not this.
   *
   * @returns `true` while this session's decisions may still be acted on.
   */
  stillApplying(): boolean;
  /**
   * Asks for a safe membership reload.
   *
   * The `Named` and `Unnamed` arms' only outward effect beside a notice. **It is a
   * request and nothing acts on it** — see
   * `docs/decisions/2d-5-4-notes.md` for why this step records it rather than
   * performing it.
   */
  requestMembershipReload(): void;
} // End of interface ObservationSession

/**
 * What one observation's transition did.
 *
 * **A record for tests, never a claim about the window.** Every host member this
 * module calls answers `void`, so these names say which arm ran and not what it
 * achieved; `./workspace.test.ts` asserts the documents, the projections and the
 * selection.
 */
export type ObservationOutcome =
  /** A row was inserted or replaced (ruling 30). */
  | 'added'
  /** A guarded reread was started for a file no open surface may be about. */
  | 'reread'
  /** A write surface may be about the file, so it was told and nothing installed. */
  | 'conflicted'
  /** The bytes are unreadable; the old projection and every surface stay. */
  | 'unavailable'
  /** The file is gone and everything derived from it was dropped. */
  | 'removed'
  /** A newer observation for the same file has already been admitted. */
  | 'superseded'
  /**
   * The session that accepted the observation stopped applying, or the epoch it
   * was accepted under is no longer the one showing, before the arm reached its
   * arbitration.
   *
   * **Distinct from `superseded` because it says something else** — Phase
   * 2d-5-4-D. A superseded observation lost an arbitration this session really
   * ran; this one never reached one, and the record it lands in may already belong
   * to the *replacing* workspace, because `workspaceOpened` in
   * `./reconciliationCoordinator.ts` empties the outcome list. Recording it as
   * `superseded` there would claim a newer observation of that file had been
   * admitted by a session that has admitted nothing.
   */
  | 'lifecycleMoved'
  /**
   * A locally pending row's arm ran; whether it wrote depends on its own
   * arbitration.
   *
   * **It does not say the row was marked, removed or annotated, and it said so
   * until Phase 2d-5-4-G.** Every write in {@link applyNamedRow} is behind an
   * `isNewest` call taken immediately above it, and an arm all of whose writes
   * refuse still answers this — the `removed` arm can now leave both the row and
   * the status untouched, which `./observationTransitions.test.ts`'s
   * *removes no row when the host row question admitted a newer observation*
   * asserts. That is the type header's own rule about these names applied to this
   * variant rather than an exception to it.
   */
  | 'pendingRow'
  /** There was no locally pending row to act on, so nothing was changed. */
  | 'noPendingRow'
  /** A path this window holds no identity for was recorded. */
  | 'pathDrift';

/**
 * Whether the lifecycle an observation was accepted in has moved under it.
 *
 * **One producer for the three questions, so two fences cannot drift** — Phase
 * 2d-5-4-E. It is asked **once on every observation's path** — by
 * {@link applyObservation}, the moment routing returns — **and a second time on
 * the addition path alone**, by {@link applyAddition} after its own
 * materialization window. The other five arms get exactly one comparison, and this
 * sentence claimed two for all six until Phase 2d-5-4-F; a reader who believed it
 * would credit `applyChange`, `applyRemoval`, `applyUnreadable`,
 * {@link applyNamedRow} and `applyUnnamedPath` with a recheck none of them makes.
 * Written out at each site instead, a later fence could be added with two of the
 * three clauses and compile.
 *
 * **What each clause discriminates, and what it does not.**
 *
 * - {@link ObservationSession.stillApplying} answers disposal and the blocked
 *   state, and **nothing about a replaced workspace** — its own doc says so.
 * - {@link ObservationSession.lifecycleIsOurs} answers a replacement, a disposal
 *   and a self-requested reopen, and **nothing about the epoch's identity**: it is
 *   a counter, so it says *something ended that lifecycle*, never which one is
 *   showing now.
 * - The epoch comparison answers *a different workspace epoch is showing*, and is
 *   **vacuous for a session that adopted `0`** — which `./reconciliationCoordinator.ts`
 *   supports deliberately, and which the Rust side happens to keep out of
 *   production (`FIRST_WORKSPACE_EPOCH` is `1`) rather than the wire type
 *   forbidding it. It is kept as the cheap, specific question, not as the load-
 *   bearing one.
 *
 * **None of the three is forced by a type.** All three are members of an injected
 * interface, so this function answers what the *session it was handed* says, and
 * `session.epoch` is a `readonly` declaration rather than a frozen value — a
 * caller may put an accessor behind it, and `readonly` does not freeze at runtime.
 *
 * @param session - The session the batch was accepted under.
 * @returns `true` when this observation may no longer be acted on.
 */
function lifecycleMovedUnder(session: ObservationSession): boolean {
  return (
    !session.stillApplying() ||
    !session.lifecycleIsOurs() ||
    session.epochNow() !== session.epoch
  );
} // End of function lifecycleMovedUnder()

/**
 * Applies one observation of an accepted batch.
 *
 * **Every arm of the consult's Q8 table, and no command outside the three
 * `Addressable` ones.** The one document command *this arbitration requests* is
 * the reread of {@link ReconciliationWorkspace.rereadUnderGuard}, from the
 * `changed`/`Addressable`/`Projected` combination alone. `Added` requests nothing
 * (ruling 30); `Removed`, `Unreadable`, `Named` and `Unnamed` request nothing;
 * **no save command is reachable at all** (ruling 27), because
 * {@link ReconciliationWorkspace} has none.
 *
 * **That is not the same as the set of commands reachable transitively, and
 * saying it was is a claim Phase 2d-5-4's second review falsified.** Two host
 * members this module calls refresh the raw viewer afterwards, so with the viewer
 * open a **second** command goes out — `document_text`, for the viewer's own
 * target. `rereadUnderGuard` ends with the host's `readFileText()` once it has
 * installed, and `removeDocument` fires the same refresh because a removal can
 * take the viewer's file with it. Neither is a route around ruling 28: the
 * identity that read is sent for is the viewer target's, which the host filters
 * `pendingAdditions` out of, so no unaddressable identity reaches a command from
 * here either way.
 *
 * **Routing is caller code, and the fence below it is what covers every arm** —
 * Phase 2d-5-4-E. {@link routeObservation} is nothing but property reads and `in`
 * checks on the wire value: for a `Removed`/`Addressable` observation it reads
 * `observation.Removed`, `removed.document`, `removed.sequence` and two more,
 * every one of which a caller can make a getter or a `Proxy` trap. So **any**
 * observation, of any arm, can reset the lifecycle inside its own routing, before
 * the arm is entered at all — and the arm then arbitrates against an
 * accepted-sequence map `workspaceOpened` has just emptied, which is the one state
 * {@link AcceptedSequences.admit} answers permissively while every `isNewest`
 * fence in this module fails safe. Until this round the doc of
 * {@link applyAddition} said the other arms were *safe in isolation*, which was
 * true of their bodies and false of the path that reaches them.
 *
 * **It is asked once, here, and the arms are not made redundant by it.** The route
 * it returns is a plain literal of own data properties, so nothing between this
 * fence and an arm's own `admit` runs caller code — for every arm except
 * {@link applyAddition}, whose materialization window is below it and which
 * therefore asks again.
 *
 * @param observation - One observation, exactly as it crossed the boundary.
 * @param workspace - The window that owns it.
 * @param sequences - The per-document accepted sequences.
 * @param session - The epoch this batch was accepted under, and where a
 *   membership-reload request goes.
 * @returns Which arm ran.
 */
export function applyObservation(
  observation: ExternalObservation,
  workspace: ReconciliationWorkspace,
  sequences: AcceptedSequences,
  session: ObservationSession
): ObservationOutcome {
  const route = routeObservation(observation);
  if (lifecycleMovedUnder(session)) {
    // **Below the routing and above every arm**: the reads that built `route` are
    // the caller's, and an arm entered after one of them reopened the workspace
    // would admit against a cleared map. `route` itself is an own-data-property
    // literal, so the dispatch below adds no caller code of its own.
    return 'lifecycleMoved';
  }
  switch (route.kind) {
    case 'added':
      return applyAddition(route, workspace, sequences, session);
    case 'changed':
      return applyChange(route, workspace, sequences, session);
    case 'removedDocument':
      return applyRemoval(route, workspace, sequences);
    case 'unreadableDocument':
      return applyUnreadable(route, workspace, sequences);
    case 'namedRow':
      return applyNamedRow(route, workspace, sequences, session);
    case 'unnamedPath':
      return applyUnnamedPath(route, workspace, session);
    default: {
      const unreachable: never = route;
      return unreachable;
    }
  } // End of the switch over the route's arm
} // End of function applyObservation()

/**
 * Inserts or replaces one sidebar row, and calls no command.
 *
 * Ruling 30 in three statements: the summary goes into the rows by identity,
 * **`loaded: false` is forced rather than trusted** — the wire promises it and
 * this function does not have to believe the wire to keep the ruling true — and
 * the supplied projection is dropped rather than put into `views`, because an
 * addition's identity is by definition not an address `getDocument` would accept.
 *
 * **The addition is arbitrated like every other observation.** Its identity is a
 * `DocumentId` this process minted, so two additions of one path in one batch are
 * ordered by sequence exactly as two changes of one file are.
 *
 * **Both wire values are read before the arbitration, not after it** — Phase
 * 2d-5-4-C's M5. The spread and the `in` below run the wire summary's seven
 * accessors and the content's `has` trap, all of which are caller-controlled code
 * on an injected boundary; taken after `admit` they sit between that check and the
 * host's `documents = …`, which is where a re-entrant `Removed` for the same
 * identity got its removal undone. Read here they run *before* the question they
 * would have to defeat, and an accessor that admits something newer makes `admit`
 * itself refuse. The cost is that a superseded addition reads them too.
 *
 * **And the lifecycle is re-asked between those reads and the arbitration** —
 * Phase 2d-5-4-D's blocker. The three questions are {@link lifecycleMovedUnder}'s,
 * two of which are the first two {@link applyChange}'s guard asks — that guard is
 * **not** widened to the third, because what catches a replacement across its await
 * is the host's own open-generation capture inside `rereadUnderGuard`, which its
 * own doc names. They are asked here for that guard's own reason: the
 * spread and the `in` above are caller code, and a getter that synchronously calls
 * `BrowserState.open()` reaches `workspaceOpened`, which clears the
 * accepted-sequence map before `admit` reads it. **A cleared map is the one thing
 * `admit` cannot defend itself against**: its contract is *strictly greater than
 * what is held*, and after a clear nothing is held — so where every `isNewest`
 * fence in this module answers `false` across a lifecycle reset and therefore
 * fails safe, `admit` answers `true` and writes the closed workspace's sequence
 * into the replacing workspace's map, where it refuses that file's first
 * observations of the new epoch. The window is **older than M5**, which widened it
 * from one `id` getter to seven accessors plus a `has` trap rather than
 * introducing it.
 *
 * **This is the only arm with caller code above its `admit` *inside its own body*,
 * and that is a much narrower claim than the one this paragraph used to make** —
 * Phase 2d-5-4-E. It said this arm was the only one that ran caller code above its
 * `admit` at all, and that {@link applyRemoval} and {@link applyUnreadable} were
 * *safe in isolation*. Both sentences were true of the function bodies and false
 * of the path that reaches them: {@link applyObservation} runs
 * {@link routeObservation} — caller-controlled property reads, every one of them —
 * before it dispatches anything. The fence that covers that is now in
 * `applyObservation`, above the switch; what keeps **this** one is the
 * materialization window below, which runs after routing has already returned.
 *
 * **What the types do not force.** {@link ObservationSession}'s type says nothing
 * about how long an answer to it is good for, so *asked once per batch* and *asked
 * once per observation* are the same to the compiler; an arm that never asks still
 * compiles; and `session.epoch` is a `readonly` declaration, which does not stop a
 * caller putting an accessor behind it. **Nothing re-asks the question between the
 * arbitration below and the host writes under it** either — `isNewest` is what
 * defends those, and it fails safe across a reset where `admit` does not.
 *
 * **An admitted, newest addition states this file's status whole** — Phase
 * 2d-5-4-D. This write used to happen only for unreadable content, so a `Removed`
 * followed in a later batch by an `Added` of the same path left
 * `{ kind: 'removed' }` standing over a row that is back in the sidebar:
 * `addDocument` clears no status, an addition requests no reread (ruling 30), and
 * the only clears are a successful reread and a whole `open()`. It is
 * unconditional now, under the same `isNewest` fence, which is what
 * {@link applyRemoval} and {@link applyUnreadable} already do. The fence is the
 * whole of why it cannot wipe a newer observation's mark; what entitles it to
 * speak at all is `admit`, which accepted this observation as strictly newer than
 * anything that wrote before it.
 *
 * @param route - The addition.
 * @param workspace - The window.
 * @param sequences - The per-document accepted sequences.
 * @param session - The epoch this batch was accepted under, asked again here.
 * @returns Which arm ran.
 */
function applyAddition(
  route: Extract<ObservationRoute, { kind: 'added' }>,
  workspace: ReconciliationWorkspace,
  sequences: AcceptedSequences,
  session: ObservationSession
): ObservationOutcome {
  const row: DocumentSummary = { ...route.summary, loaded: false };
  const reason = 'Unreadable' in route.content ? route.content.Unreadable.reason : null;
  if (lifecycleMovedUnder(session)) {
    // Asked **after** the whole caller-controlled window above and **before**
    // `admit`, in one synchronous block with it. Under the coordinator's own
    // session nothing between this line and the arbitration below runs anything a
    // caller supplied, because there all three members are closures over its own
    // `let`s and `epoch` is an own data property of the literal it builds — **but
    // that is a property of that implementation and not of
    // {@link ObservationSession}**, whose members are declarations and whose
    // `readonly epoch` does not exclude an accessor or freeze anything at runtime.
    // A caller may put code behind any of the three, and it would run between the
    // halves of the comparison this fence is made of. The same disclaimer is
    // written out in full above {@link ObservationSession.lifecycleIsOurs} and in
    // {@link applyChange}'s `stillOurs`.
    return 'lifecycleMoved';
  }
  if (!sequences.admit(row.id, route.sequence)) {
    return 'superseded';
  }
  workspace.addDocument(row);
  // Fenced for the reason the whole of this module's status writing now is:
  // `addDocument` is a host member, so a window whose row insertion admits a newer
  // observation of the same file leaves this writing over a verdict nothing
  // re-derives. The reason itself was read above, before `admit`.
  if (sequences.isNewest(row.id, route.sequence)) {
    workspace.noteDocumentStatus(row.id, reason === null ? null : { kind: 'unavailable', reason });
  }
  return 'added';
} // End of function applyAddition()

/**
 * Reloads one file, or tells the surface that may be about it.
 *
 * The consult's Q5 in one function: arbitrate, read the live registry, and either
 * hand the observation to a surface's transition and install nothing, or run the
 * guarded reread.
 *
 * **Unreadable content installs nothing and calls nothing** (Q8): the old
 * projection and every open surface are preserved and the file is marked
 * unavailable with the engine's own reason.
 *
 * **The raw viewer refreshes as a consequence of the clean path, and that is a
 * permission being exercised rather than an obligation.** Ruling 20 says the
 * read-only viewer *may* refresh automatically, and `2d-5-split-notes.md` section
 * 5 correction 4 hands that freedom to this step; the reread machinery drops the
 * viewer's snapshot and reads it again, so it does. A later step may stop it
 * without contradicting anything here.
 *
 * @param route - The change.
 * @param workspace - The window.
 * @param sequences - The per-document accepted sequences.
 * @param session - The epoch and the membership-reload door.
 * @returns Which arm ran.
 */
function applyChange(
  route: Extract<ObservationRoute, { kind: 'changed' }>,
  workspace: ReconciliationWorkspace,
  sequences: AcceptedSequences,
  session: ObservationSession
): ObservationOutcome {
  const document = route.document;
  if (!sequences.admit(document, route.sequence)) {
    return 'superseded';
  }
  /**
   * Whether this observation is still the one entitled to speak for the file.
   *
   * **The one ownership question of this function**, asked by every status write
   * below and handed to the host as {@link ReconciliationWorkspace.rereadUnderGuard}'s
   * `owns` so that the initial `stale` mark — which is written in the *other*
   * module, after two host members have run — asks the same thing at the same
   * depth.
   *
   * **What it asks is an injected interface method, not a pure read.**
   * `sequences` is a parameter of type {@link AcceptedSequences}, whose `isNewest`
   * is a declaration; the only implementation today — the closure
   * {@link createAcceptedSequences} returns — is a `Map` lookup and is pure, so
   * asking it fires no callback *as this program is assembled*. That is a
   * property of that implementation and not of the type, and a later store with a
   * getter behind `isNewest` would put a callback back inside a guard.
   *
   * @returns `true` while nothing newer for this file has been admitted.
   */
  const stillOurs = (): boolean => sequences.isNewest(document, route.sequence);
  /**
   * Writes this file's status, but only while this observation still owns it.
   *
   * **Every status an admitted `Changed` writes from this function goes through
   * here** — the `unavailable` of the unreadable-content arm, and the `stale` of
   * the four arms that refuse an installation — so a reader has one place to check
   * rather than five. The host's initial mark is the one write it cannot carry,
   * because that write is in the host; {@link stillOurs} travels there instead,
   * as `rereadUnderGuard`'s `owns`.
   *
   * @param status - What to record.
   */
  const noteWhileOurs = (status: ExternalDocumentStatus): void => {
    if (!stillOurs()) {
      return;
    }
    workspace.noteDocumentStatus(document, status);
  }; // End of function noteWhileOurs()
  /**
   * The `stale` writer {@link tellTheSurfaceAbout} is handed.
   *
   * Passed as a parameter rather than rebuilt there, so that one fenced writer
   * serves both of that function's call sites instead of two that can drift.
   */
  const markStaleWhileOurs = (): void => {
    noteWhileOurs({ kind: 'stale' });
  };
  if ('Unreadable' in route.content) {
    // **Read before the fence, written after it.** The `in` above and the two
    // property reads below are on the wire value the drain supplied, so they are
    // caller code and they run here, once, before the question that decides
    // whether this arm may still speak for the file — Phase 2d-5-4-C's M4. The
    // record used to justify this write by saying nothing was checked before it;
    // `sequences.admit` above is, and a `has` trap that admits something newer is
    // exactly what makes the difference.
    const reason = route.content.Unreadable.reason;
    noteWhileOurs({ kind: 'unavailable', reason });
    return 'unavailable';
  }
  if (tellTheSurfaceAbout(route, workspace, markStaleWhileOurs)) {
    return 'conflicted';
  }
  // Ruling 18's registry capture, taken **before** the read and rechecked inside
  // the guard. It is not the whole guard: the open generation, the per-document
  // re-read generation and the projection generation are the host's own three
  // captures, taken inside `rereadUnderGuard` because they are its to compare.
  const registryAt = workspace.writeSurfaceGeneration();
  /**
   * Whether the answer of that read may still be installed.
   *
   * **Asked immediately before the installation, in the same synchronous block**
   * (ruling 18). Five questions, in an order that matters: whether this session is
   * still applying observations at all, which is the broadest and is therefore
   * first; the epoch, which catches a replacement **only when this session adopted
   * a non-zero one** — `workspaceOpened()` sets the coordinator's epoch to `0` and
   * its `accept()` adopts `0` exactly like any other value, so for a session
   * holding `0` this question is vacuous, which is what
   * {@link lifecycleMovedUnder}'s own doc says and what this sentence denied until
   * Phase 2d-5-4-F; whether this is still the newest observation for the file; whether a
   * surface can now be about it, which is the one arm that *re-arbitrates* rather
   * than merely refusing; and whether the registry moved at all, which catches a
   * surface that opened and closed again while the read was in flight.
   *
   * **The member that does answer a replacement outright is
   * {@link ObservationSession.lifecycleIsOurs}, and this guard deliberately does
   * not ask it** — Phase 2d-5-4-F, stating here what `2d-5-4-E-notes.md` §9 item 2
   * records. What catches a replacement across *this* read is the host's own
   * open-generation capture inside {@link ReconciliationWorkspace.rereadUnderGuard},
   * taken before the await and compared after it; the safety therefore lives in
   * another module and no type ties the two files together. The ordering below is
   * unchanged by saying so.
   *
   * **`stillApplying` is first because the arm below it calls a component's
   * callback.** `tellTheSurfaceAbout` fires the registered
   * {@link WriteSurfaceTransition}, and a session that has been blocked by lost
   * history or disposed must not raise a conflict on a surface on the strength of
   * an observation it is no longer entitled to act on. Being first also means the
   * other four questions say nothing about what it covers: it is not a generation
   * comparison and there is no number it could be folded into — see
   * {@link ObservationSession.stillApplying} for the two states it names and for
   * what it deliberately does not cover.
   *
   * **A refusal marks the file stale**, except when a newer observation has
   * already been admitted — that one is somebody else's transition to finish, and
   * saying `stale` about it would describe a state this window is about to leave.
   * **No refusing arm clears the status**, and that matters most on the first one:
   * a file left `stale` by a blocked session is the true statement, and clearing it
   * there would say *reconciled* about a window that cannot describe its own
   * membership. No arm here clears one at all any more — the clear moved to the
   * installation itself, in `rereadUnderGuard`, because this guard reached one of
   * that helper's two callers.
   *
   * **Decision order and write ownership are two different questions, and treating
   * them as one is what Phase 2d-5-4's second review found.** The order above is
   * about *which* arm gets to decide, and it is unchanged: `stillApplying` is first
   * because the arm below it fires a component's callback. Ownership is about
   * whether **this** read is still entitled to say anything about this file's
   * status, and the only question that asks it is
   * `sequences.isNewest(document, route.sequence)` — which, being third, could not
   * stop the first two arms writing. A newer `Unreadable` for the same file records
   * `unavailable` with a typed reason and moves none of the host's three captures,
   * so the read still reached this guard, `stillApplying` refused first, and
   * `stale` overwrote the reason — permanently, because a blocked session advances
   * the watermark and the observation is never redelivered.
   *
   * **Every arm that writes does so through `markStaleWhileOurs`** — the
   * `isNewest` arm itself writes nothing at all, deliberately — **and the two
   * below the ownership question do so because position is not an answer.** They used to
   * write directly, defended by the sentence *reaching this line means the
   * ownership question two arms up already answered yes*. It answered yes **then**:
   * between `isNewest` and either write, `tellTheSurfaceAbout` calls
   * `workspace.openWriteSurfaces()` and `workspace.creatorEligibility(document)`,
   * which are host members — the second one reads this window's row list — and
   * `CLAUDE.md` says a check and a spend separated by any such read are not atomic.
   * A host whose accessor admits a newer observation for the same file makes the
   * lower two arms write `stale` over a newer transition's verdict, which is
   * exactly what the fence was introduced to stop for the upper two. The companion
   * claim, that such a call *can never refuse and no test could tell it from no
   * call*, is false for the same reason and
   * `observationTransitions.test.ts` now holds the case that refuses it.
   *
   * @returns `true` when the read may be installed.
   */
  const guard = (): boolean => {
    if (!session.stillApplying()) {
      markStaleWhileOurs();
      return false;
    }
    if (session.epochNow() !== session.epoch) {
      markStaleWhileOurs();
      return false;
    }
    if (!sequences.isNewest(document, route.sequence)) {
      return false;
    }
    if (tellTheSurfaceAbout(route, workspace, markStaleWhileOurs)) {
      // A surface opened while the read was in flight. The consult's Q5 says to
      // re-run arbitration against the retained observation and put that surface
      // on its conflict path, which is exactly what the call above did. Its own
      // `stale` is written through the fenced writer handed in, because the two
      // host members it consults first are caller code.
      return false;
    }
    if (workspace.writeSurfaceGeneration() !== registryAt) {
      // Fenced, and the ownership question is asked *here* rather than inferred
      // from the fact that it was asked above: `tellTheSurfaceAbout` ran two host
      // members in between, and one of them reads this window's rows.
      markStaleWhileOurs();
      return false;
    }
    // Nothing refused, so the answer may be installed. **The status is not cleared
    // here**: `rereadUnderGuard` clears it in the same synchronous block as
    // `installView`, which is the only place that knows an installation really
    // happened and is the one place both of that helper's callers pass through.
    return true;
  }; // End of function guard()
  // **The ownership question goes with the read** — Phase 2d-5-4-C's finding 4.
  // The host marks the file `stale` before it starts the read, and that mark is a
  // status write standing on the far side of `tellTheSurfaceAbout`'s two host
  // members and of `writeSurfaceGeneration()` above. It cannot be hoisted to this
  // module, because it belongs in the same synchronous block as the read it
  // describes; so `stillOurs` is handed over and asked there.
  workspace.rereadUnderGuard(document, guard, stillOurs);
  return 'reread';
} // End of function applyChange()

/**
 * Tells the write surface that may be about this file, if there is one.
 *
 * **The conservative sentence of ruling 19 in code**: an answer here means *a
 * surface capable of writing this file is open*, never *there are unsaved edits* —
 * `isDirty` is derived inside each surface's own session and no coordinator can
 * observe it (R36). Over-refusing costs one file left showing an older projection;
 * under-refusing is somebody's work reloaded out from under them.
 *
 * **It offers the mark whether or not a transition was found.** A surface whose
 * kind the registry answers and whose transition it does not is a race the
 * registry's own comment describes, and the file is still not being reloaded, so
 * the state is the same either way.
 *
 * **Offers rather than writes, because the mark goes through the caller's fenced
 * writer — Phase 2d-5-4-B's finding 5.** The call above it reads two host
 * members, `openWriteSurfaces()` and `creatorEligibility()`, the second of which
 * walks the window's row list; so arbitrary code runs between the caller's
 * ownership question and this write, whichever of the two call sites invoked it,
 * and a newer observation admitted there makes the write suppress itself. Taking
 * the writer as a parameter rather than rebuilding it here is what keeps
 * `applyChange` to **one** fenced writer instead of two that can drift; it says
 * nothing about the other transitions, which carry their own.
 *
 * @param route - The change.
 * @param workspace - The window.
 * @param markStale - The caller's fenced `stale` writer, asked at the write.
 * @returns Whether a surface may be about the file.
 */
function tellTheSurfaceAbout(
  route: Extract<ObservationRoute, { kind: 'changed' }>,
  workspace: ReconciliationWorkspace,
  markStale: () => void
): boolean {
  const kind = targetingSurfaceFor(
    route.document,
    workspace.openWriteSurfaces(),
    workspace.creatorEligibility(route.document)
  );
  if (kind === null) {
    return false;
  }
  markStale();
  const narrowed = externalConflictObservationOf(route);
  const transition = workspace.transitionFor(kind);
  if (narrowed !== null && transition !== null) {
    transition(narrowed);
  }
  return true;
} // End of function tellTheSurfaceAbout()

/**
 * Drops one file and everything this window derived from it.
 *
 * Q8's `Removed`/`Addressable` cell. The summary, the projection, the load
 * failure and the raw snapshot all go, the projection is invalidated, and a
 * selection inside the file is cleared **synchronously** with the external-gone
 * notice — all of that is the host's `removeDocument`, because every one of those
 * values lives on the window.
 *
 * **The write surface is preserved rather than told.** Q8 asks for a
 * removed-target state, and what this step can express is the state and not the
 * telling: `WriteSurfaceTransition` takes an
 * {@link ExternalConflictObservation} — the narrowed `Changed`/`Projected`
 * snapshot — so a removal cannot be delivered through it at all. The surface keeps
 * its registration, nothing is reloaded under it, and the file's status says
 * `removed`.
 *
 * **The accepted sequence is kept, not forgotten.** An addition of the same path
 * afterwards may carry the identity this process already minted, and a map that
 * forgot would let an older observation of it be admitted again.
 *
 * @param route - The removal.
 * @param workspace - The window.
 * @param sequences - The per-document accepted sequences.
 * @returns Which arm ran.
 */
function applyRemoval(
  route: Extract<ObservationRoute, { kind: 'removedDocument' }>,
  workspace: ReconciliationWorkspace,
  sequences: AcceptedSequences
): ObservationOutcome {
  if (!sequences.admit(route.document, route.sequence)) {
    return 'superseded';
  }
  workspace.removeDocument(route.document);
  // **Fenced, because `removeDocument` is a host member** — Phase 2d-5-4-C's M4.
  // It clears a selection, drops a projection and re-reads the raw viewer's
  // target, so a window whose removal admits a newer observation of the same
  // identity — an `Added` re-inserting the path, say — would have this `removed`
  // written over that newer verdict, permanently: the batch watermark has moved
  // past the observation that carried it. The removal itself is unconditional,
  // because it is this arm's transition and not a statement about status.
  if (sequences.isNewest(route.document, route.sequence)) {
    workspace.noteDocumentStatus(route.document, { kind: 'removed' });
  }
  return 'removed';
} // End of function applyRemoval()

/**
 * Marks one file unavailable, and calls nothing.
 *
 * Q8's `Unreadable`/`Addressable` cell: the last projection and every surface are
 * preserved, the typed reason is recorded, and there is **no command and no
 * automatic install**.
 *
 * **The one status write in this module that carries no fence, and the reason is
 * a property of the code rather than of its scope** (Phase 2d-5-4-C's M4): no
 * statement stands between `admit` and the write, and both values the write reads
 * — `route.document` and `route.reason` — are own data properties of the literal
 * {@link routeObservation} built before the arbitration, so reading them fires
 * nothing. A statement inserted between the two lines below would end that, and
 * nothing in TypeScript would object.
 *
 * @param route - The unreadable observation.
 * @param workspace - The window.
 * @param sequences - The per-document accepted sequences.
 * @returns Which arm ran.
 */
function applyUnreadable(
  route: Extract<ObservationRoute, { kind: 'unreadableDocument' }>,
  workspace: ReconciliationWorkspace,
  sequences: AcceptedSequences
): ObservationOutcome {
  if (!sequences.admit(route.document, route.sequence)) {
    return 'superseded';
  }
  workspace.noteDocumentStatus(route.document, { kind: 'unavailable', reason: route.reason });
  return 'unavailable';
} // End of function applyUnreadable()

/**
 * Acts on a locally pending row, or on nothing.
 *
 * Q8's whole `Named` column. **The identity is never passed to a command** — it is
 * one the open workspace refuses, which is what `Named` means — so every arm here
 * is a state-only transition over the row an earlier `Added` inserted.
 *
 * - `changed`: the row is marked stale and a safe membership reload is requested.
 * - `removed`: the row is removed if present **and this observation is still the
 *   newest for it**, and nothing is requested. Q8 asks for no reload here, and
 *   that is not an omission: a row this window invented going away leaves the open
 *   workspace exactly as it was.
 * - `unreadable`: the reason is attached to the row where there is one.
 *
 * **Every write this function makes is fenced, and this is which fence covers
 * which write** — Phase 2d-5-4-G. `session.requestMembershipReload()` and
 * `workspace.holdsDocument()` are injected calls standing between the `admit`
 * above and every write below, so a newer observation of this identity can be
 * admitted between the two; the removal used to be the one write outside the
 * arbitration that answers it. There are **three** writes and **three** `isNewest`
 * calls, each immediately above the write it guards: `noteWhileOurs`'s own call
 * covers the `changed` arm's `stale`, the `unreadable` arm's `unavailable` and —
 * because the `removed` arm reaches the status write through the same helper —
 * that arm's `removed` status; `removeWhileOurs`'s own call covers
 * `workspace.removeDocument()` and nothing else. **The removal's fence does not
 * cover the status write beside it**, because `workspace.removeDocument()` is
 * itself an injected member standing between the two; that is why the `removed`
 * arm asks twice, and Phase 2d-5-4-F's single call for both writes is the defect
 * this replaces.
 *
 * **A membership reload is requested even when there is no row**, for the
 * `changed` arm alone: an identity this process minted for a file the open
 * workspace does not hold is drift whether or not this window happens to be
 * showing a row for it.
 *
 * @param route - The observation.
 * @param workspace - The window.
 * @param sequences - The per-document accepted sequences.
 * @param session - Where a membership-reload request goes.
 * @returns Which arm ran.
 */
function applyNamedRow(
  route: Extract<ObservationRoute, { kind: 'namedRow' }>,
  workspace: ReconciliationWorkspace,
  sequences: AcceptedSequences,
  session: ObservationSession
): ObservationOutcome {
  const named = route.namedDocument;
  if (!sequences.admit(named, route.sequence)) {
    return 'superseded';
  }
  /**
   * Writes the pending row's status, but only while this observation owns it.
   *
   * **The same fence as {@link applyChange}'s, and this function needs its own**
   * — Phase 2d-5-4-C's M4. Two injected calls stand between the arbitration above
   * and every write below: `session.requestMembershipReload()` and
   * `workspace.holdsDocument()`. A `stale` this module wrote over a newer
   * `removed` would be permanent, because the batch watermark has already moved
   * past the observation that carried it.
   *
   * @param status - What to record.
   */
  const noteWhileOurs = (status: ExternalDocumentStatus): void => {
    if (!sequences.isNewest(named, route.sequence)) {
      return;
    }
    workspace.noteDocumentStatus(named, status);
  }; // End of function noteWhileOurs()
  /**
   * Drops the pending row and records the removal, each under its own
   * arbitration.
   *
   * **Two `isNewest` calls for two writes, because an injected call stands
   * between them** — Phase 2d-5-4-G. Until 2d-5-4-F
   * `workspace.removeDocument()` was called unconditionally, outside the fence
   * guarding the status write beside it and below the same two injected calls this
   * arm's doc names as the reason that fence exists: a `holdsDocument()`
   * implementation that admitted a newer observation of this identity and then
   * answered `true` had the older `removed` drop the row anyway — permanently,
   * because the batch watermark has already moved past the observation carrying it
   * — while `noteWhileOurs` correctly wrote nothing, so the row vanished with no
   * status and nothing recording why. 2d-5-4-F fenced the removal by collapsing
   * both writes under a **single** call above them, which fenced the removal and
   * **unfenced the status write**: a `removeDocument()` that admitted a newer
   * observation of this identity had the older `removed` status written over the
   * newer observation's verdict, permanently and for the same reason.
   *
   * **The call above the removal is not the status write's fence.**
   * `workspace.removeDocument()` is an injected host member — `workspace` is a
   * parameter of the enclosing function, and `./reconciliationCoordinator.ts`
   * passes its own `host` straight in — so it spends the check above it before the
   * write below it runs. A check and a spend separated by a whole method call are
   * not atomic, which is the derivation {@link applyRemoval} states about the
   * identical pair of calls and the derivation this arm's doc states about
   * `requestMembershipReload` and `holdsDocument`.
   *
   * **It does not contradict {@link applyRemoval}'s unconditional-transition
   * rule.** That rule is about an `Addressable` removal, whose `admit` and whose
   * removal have no injected call between them; here there are two, and the
   * arbitration re-asked above the removal is the same question `admit` answered
   * before them.
   */
  const removeWhileOurs = (): void => {
    if (!sequences.isNewest(named, route.sequence)) {
      return;
    }
    workspace.removeDocument(named);
    noteWhileOurs({ kind: 'removed' });
  }; // End of function removeWhileOurs()
  const detail = route.detail;
  if (detail.kind === 'changed') {
    session.requestMembershipReload();
  }
  if (!workspace.holdsDocument(named)) {
    return 'noPendingRow';
  }
  switch (detail.kind) {
    case 'changed':
      noteWhileOurs({ kind: 'stale' });
      return 'pendingRow';
    case 'removed':
      removeWhileOurs();
      return 'pendingRow';
    case 'unreadable':
      noteWhileOurs({ kind: 'unavailable', reason: detail.reason });
      return 'pendingRow';
    default: {
      const unreachable: never = detail;
      return unreachable;
    }
  } // End of the switch over what was observed of the pending row
} // End of function applyNamedRow()

/**
 * Records a path this window holds no identity for.
 *
 * Q8's whole `Unnamed` column. **No identity is invented and no path is matched**
 * — a wire path is lossy, so matching a row by one would be this window guessing
 * which file an observation was about.
 *
 * **There is no sequence arbitration here, and there cannot be**: the
 * accepted-sequence map is keyed by identity and an `Unnamed` observation carries
 * none. What bounds the drift instead is the host, which keys its record by path.
 *
 * A `changed` or a `removed` asks for a safe membership reload; an `unreadable`
 * does not, because a path this window cannot read says nothing about which files
 * the workspace holds.
 *
 * @param route - The observation.
 * @param workspace - The window.
 * @param session - Where a membership-reload request goes.
 * @returns Which arm ran.
 */
function applyUnnamedPath(
  route: Extract<ObservationRoute, { kind: 'unnamedPath' }>,
  workspace: ReconciliationWorkspace,
  session: ObservationSession
): ObservationOutcome {
  workspace.notePathDrift({ relativePath: route.relativePath, detail: route.detail });
  switch (route.detail.kind) {
    case 'changed':
    case 'removed':
      session.requestMembershipReload();
      return 'pathDrift';
    case 'unreadable':
      return 'pathDrift';
    default: {
      const unreachable: never = route.detail;
      return unreachable;
    }
  } // End of the switch over what was observed of the path
} // End of function applyUnnamedPath()
