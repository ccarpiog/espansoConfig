/**
 * Where one conflict came from, as a value — and the one line it owes about that.
 *
 * ## Two origins, one vocabulary
 *
 * Until Phase 2d-5 a conflict had exactly one origin: a save this application
 * attempted was refused under the write lock, and `ConflictResult` *was* the
 * conflict. Phase 2d-5 adds a second — the watcher observing that a file changed on
 * disk while a write surface was open over it — and the design consult's Q6
 * (`docs/reviews/phase-2d-5-design.md:175-215`) rules that the two are told apart by
 * a **discriminated {@link ConflictSource}**, never by widening the save type with
 * optional fields. Optional `expected` / `found` / `changedAgain` would let each
 * origin masquerade as the other, and the sentences a person reads are exactly what
 * must not be interchangeable.
 *
 * ## What this module is, and what it is not
 *
 * It is vocabulary **and, since Phase 2d-5-5b, the arbitration between the two
 * origins as a set of pure decisions**. It declares the two origins, it hands out
 * **one stable object per wire value** so identity-keyed bookkeeping keeps working,
 * it names the origin-specific line a conflict panel will show, and
 * {@link arbitrateObservation} and {@link releaseBarrier} say which origin stands
 * for one file and what a barrier does with what it held. **It still installs
 * nothing, registers nothing, holds no state and routes nothing**: which
 * observations reach a surface at all is `./observationTransitions.ts`'s (2d-5-4),
 * and the tables those decisions are made against live on `BrowserState` in
 * `./workspace.svelte.ts`, which is the only thing that writes one.
 *
 * **Phase 2d-5-5a gave it its first production readers.** `ConflictModel.source` in
 * `./saveOutcome.ts` is a {@link ConflictSource}, the six conflict registrations in
 * `./workspace.svelte.ts` go through {@link saveConflictSource}, and both
 * identity-keyed maps — that module's `conflictOrigins` and this one's sibling, the
 * reapply authorization memo — are keyed on a {@link ConflictSource}. Phase 2d-5-5b
 * added the second half: `BrowserState.observeExternalChange` drives
 * {@link arbitrateObservation} — through `arbitratedDelivery` in
 * `./observationDelivery.ts` since Phase 2d-6-1b, which seals the verdict with the
 * observation it is about — so {@link externalConflictSource} now has a production
 * caller too. What still has none is a **component** — drawing either origin is
 * 2d-6's, and nothing in this repository shows a person which of the two a panel
 * is about.
 *
 * **Two things this module does not touch, and may not.** `conflictChoicesFor` in
 * `./saveOutcome.ts` stays the only producer of a choice list — what is exported
 * here are *lines*, never controls — and `adoptDiskVersion` in
 * `./workspace.svelte.ts` stays the only confirmed-install door. Origin may change
 * the messages and the provenance of reapply evidence; it may not change who
 * installs or who offers.
 */

import type { TranslationKey } from '../i18n/dictionaries';
import type {
  ConflictResult,
  ContentRevision,
  CorrespondenceTable,
  DocumentId,
  DocumentView,
  Finding
} from '../ipc/types';

/**
 * One external change this window may have to raise a conflict about.
 *
 * **The already-narrowed snapshot, and the narrowing is all three at once**: an
 * `ExternalObservation` that is `Changed`, whose `ObservedDocument` is
 * `Addressable`, and whose `ChangedContent` is `Projected`. Only that combination
 * carries the four operands a conflict panel needs — an identity the open workspace
 * resolves, the disk revision, the disk text and the projection of it — so a value
 * of this type exists only where all three arms held.
 *
 * **Flattened deliberately, and it is a projection rather than a re-export.** The
 * wire shape nests the three arms, so a consumer holding one would have to
 * re-narrow at every use; narrowing once and carrying the result is what makes the
 * `Addressable` identity below a `DocumentId` rather than a question. What it costs
 * is that **nothing in TypeScript ties a value of this type back to the observation
 * it was narrowed from** — the narrowing lives in whichever function performs it
 * (`externalConflictObservationOf` in `./observationTransitions.ts`, which is the
 * only producer in this repository), and a caller may assemble one of these by hand from
 * loose fields, exactly as `ConflictModel` could be assembled from loose fields
 * before `source` carried the wire value whole.
 *
 * **The fields are snapshot-bound to each other and no type says so.** The text,
 * the revision, the projection and the correspondence table come out of one Rust
 * snapshot; substituting a later read for any one of them type-checks perfectly and
 * is wrong. That is the wire's own warning about `CorrespondenceTable`
 * (`src/lib/ipc/types.ts:2891-2911`) restated for the value this window carries.
 */
export interface ExternalConflictObservation {
  /**
   * The sequence this observation was admitted under.
   *
   * **The only thing that defines "later"** for two observations of one document: a
   * revision is a hash and hashes carry no order.
   */
  readonly sequence: number;
  /** The file, as the **open** workspace resolves it. */
  readonly document: DocumentId;
  /**
   * The last stable revision the engine held before this reading, or `null`.
   *
   * **Not a claim that this window ever saw that revision**, and not an order: it
   * is what the watcher tracked, not what was shown.
   */
  readonly previousRevision: ContentRevision | null;
  /** The revision of the exact bytes now on disk. */
  readonly diskRevision: ContentRevision;
  /** Those exact bytes, whole and unchanged: no line ending converted, no BOM stripped. */
  readonly diskText: string;
  /** The projection of those same bytes. */
  readonly disk: DocumentView;
  /** The pure semantic report over that projection, in its order, none dropped. */
  readonly findings: readonly Finding[];
  /**
   * Correspondence from the previously projected content into this one, or `null`
   * where either side had no projection.
   *
   * **Usable as reapply evidence only when both of its revisions match**: its
   * `base_revision` against the retained draft's base and its `disk_revision`
   * against this observation's. Nothing *here* checks either — `reapplyEvidenceFor`
   * in `./reapply.ts` is the one function that does (ruling 24), and nothing in
   * TypeScript expresses the pairing, so a caller that reads this field directly
   * rather than through that function gets no check at all.
   */
  readonly correspondences: CorrespondenceTable | null;
}

/**
 * Where one conflict came from.
 *
 * **A discriminated union, and the save arm carries its wire value whole.** That is
 * `ConflictModel.source`'s existing contract generalized rather than replaced: the
 * object identity is what ties an adoption to *the state that produced it*, so an
 * arm that reduced its origin to loose fields would name no conflict any window ever
 * saw.
 *
 * **Get one from {@link saveConflictSource} or {@link externalConflictSource}, never
 * by writing the literal.** Those two are what make one wire value yield one object,
 * which is what the identity-keyed maps in `./workspace.svelte.ts` rest on.
 * **Nothing in TypeScript forces a caller through them** — a hand-built wrapper of
 * the same shape type-checks — and such a wrapper would install nothing rather than
 * install the wrong thing, so it fails safe and silently.
 */
export type ConflictSource = SaveConflictSource | ExternalChangeConflictSource;

/**
 * The `save` arm of {@link ConflictSource}, named so a model can require it.
 *
 * **Declared apart from the union so a type can say "this one came from a save"**,
 * which is what `SaveConflictModel` in `./saveOutcome.ts` needs: the revisions a
 * refusal reports — `expected` and `found` — exist on this arm and on no other, and
 * a model that carried them beside an `externalChange` source would be the optional
 * top-level field ruling 21 forbids.
 */
export interface SaveConflictSource {
  /** A save this application attempted was refused under the write lock. */
  readonly kind: 'save';
  /** The refusal exactly as it crossed the boundary. */
  readonly conflict: ConflictResult;
}

/**
 * The `externalChange` arm of {@link ConflictSource}.
 *
 * {@link SaveConflictSource}'s twin, and named for the same reason: the
 * correspondence table an external conflict's reapply evidence comes from exists
 * here and nowhere else.
 */
export interface ExternalChangeConflictSource {
  /** The watcher observed the file changing while a surface was open over it. */
  readonly kind: 'externalChange';
  /** The narrowed observation, exactly as this window narrowed it. */
  readonly observation: ExternalConflictObservation;
}

/**
 * One stable `save` source per wire `ConflictResult`.
 *
 * **A `WeakMap` keyed on the wire value**, so the same refusal described twice
 * recovers the identical object and both identity-keyed maps — `conflictOrigins` in
 * `./workspace.svelte.ts` and the reapply authorization memo in `./saveOutcome.ts` —
 * go on working now that `ConflictModel.source` is a {@link ConflictSource}. Weak
 * because the key is the payload the command layer handed over: when nothing holds
 * the refusal any more, nothing should hold a wrapper for it either.
 *
 * **What "stable" means here, exactly.** Two calls with the **same object** answer
 * the same wrapper. Two calls with **structurally equal but distinct** objects — two
 * separate reads of one refusal, or a payload round-tripped through JSON — answer
 * two different wrappers, and no type prevents that. It is object identity, never
 * value equality, and the wire value is the identity this application has.
 */
const SAVE_SOURCES = new WeakMap<ConflictResult, SaveConflictSource>();

/** One stable `externalChange` source per narrowed observation. */
const EXTERNAL_SOURCES = new WeakMap<
  ExternalConflictObservation,
  ExternalChangeConflictSource
>();

/**
 * The `save` origin of one refusal, memoized on the refusal itself.
 *
 * The wrapper is frozen, which stops a consumer mutating a value every other
 * consumer of that refusal shares. **It is a shallow freeze**: the
 * {@link ConflictResult} inside is the payload as it arrived and is not frozen by
 * this function.
 *
 * @param conflict - The refusal exactly as it crossed the boundary.
 * @returns The one `save` source for it, the same object every time.
 */
export function saveConflictSource(conflict: ConflictResult): SaveConflictSource {
  const held = SAVE_SOURCES.get(conflict);
  if (held !== undefined) {
    return held;
  }
  const source: SaveConflictSource = Object.freeze({ kind: 'save' as const, conflict });
  SAVE_SOURCES.set(conflict, source);
  return source;
} // End of function saveConflictSource()

/**
 * The `externalChange` origin of one observation, memoized on the observation.
 *
 * {@link saveConflictSource}'s twin, and memoized for the same reason rather than
 * for symmetry: an observation described twice — once when it is arbitrated and
 * once when a surface is told about it — must recover one object, or the same two
 * identity-keyed maps stop working for this origin while working for the other.
 *
 * @param observation - The narrowed observation, exactly as this window narrowed it.
 * @returns The one `externalChange` source for it, the same object every time.
 */
export function externalConflictSource(
  observation: ExternalConflictObservation
): ExternalChangeConflictSource {
  const held = EXTERNAL_SOURCES.get(observation);
  if (held !== undefined) {
    return held;
  }
  const source: ExternalChangeConflictSource = Object.freeze({
    kind: 'externalChange' as const,
    observation
  });
  EXTERNAL_SOURCES.set(observation, source);
  return source;
} // End of function externalConflictSource()

/**
 * The one line a conflict panel owes about **why this conflict exists**.
 *
 * **A code, never a sentence** (`CLAUDE.md` section 2), and one value per origin.
 * It is not a choice and it produces no control: `conflictChoicesFor` in
 * `./saveOutcome.ts` remains the only producer of a choice list, and this is a
 * message value of the same kind as `SaveOutcomeMessage`.
 *
 * **It names the origin, never the outcome.** *Nothing was written* and *this file
 * changed after its text was loaded here* are already `SaveOutcomeMessage` lines and
 * stay there; these two say where the comparison on screen came from, which is the
 * one thing the two origins cannot share.
 */
export type ConflictOriginMessage =
  | {
      /** A save was attempted from this window and the file refused it. */
      readonly kind: 'refusedSave';
    }
  | {
      /**
       * The file changed on disk while this surface was open, and no save was
       * initiated in response to that observation.
       *
       * **Not "with no save attempted"** — Phase 2d-6-1a's correction (the 2d-6
       * record, §3 entry 24). An observation held by ruling 27's barrier is
       * released after a write this window *did* attempt, possibly with an
       * uncertain outcome, so the only claim the sentence may make is about what
       * was done *in response to this observation*: nothing.
       */
      readonly kind: 'changedWhileOpen';
    };

/**
 * Which line one conflict's origin owes.
 *
 * **A `switch` with a `never` terminus**, so a third arm of
 * {@link ConflictSource} is a compile error here rather than an origin that
 * silently inherits the other one's sentence. What it cannot force is that a
 * component draws the line at all, or that it draws this one rather than a literal
 * of its own; only a mounted test establishes either, and 2d-6 is where one exists.
 *
 * @param source - Where the conflict came from.
 * @returns The line to show about its origin.
 */
export function conflictOriginMessage(source: ConflictSource): ConflictOriginMessage {
  switch (source.kind) {
    case 'save':
      return { kind: 'refusedSave' };
    case 'externalChange':
      return { kind: 'changedWhileOpen' };
    default: {
      const unreachable: never = source;
      return unreachable;
    }
  }
} // End of function conflictOriginMessage()

/**
 * The dictionary key holding one origin line's sentence.
 *
 * A `switch` over literal keys rather than a template, exactly as
 * `saveOutcomeMessageKey` is: a template would type-check against
 * {@link TranslationKey} only by accident of its own construction, and this way a
 * renamed key is a compile error here.
 *
 * @param message - The line to show.
 * @returns The key holding that line's sentence.
 */
export function conflictOriginMessageKey(message: ConflictOriginMessage): TranslationKey {
  switch (message.kind) {
    case 'refusedSave':
      return 'browser.conflictOrigin.refusedSave';
    case 'changedWhileOpen':
      return 'browser.conflictOrigin.changedWhileOpen';
    default: {
      const unreachable: never = message;
      return unreachable;
    }
  }
} // End of function conflictOriginMessageKey()

/**
 * The revisions one conflict may honestly name, as one typed value over both
 * origins.
 *
 * **The shared description helper the 2d-6 record's §3 entry 10 asks for, and it
 * is deliberately asymmetric.** The save arm names three: what the save was based
 * on (`expected`), what the locked read found and refused it on (`found`), and
 * what the read taken afterwards observed (`observed`). The external arm names
 * **one** — the revision of the exact bytes the watcher read — because there was
 * no save to have been based on anything and no locked read to have found
 * anything. Declaring the two arms with different fields is what makes a renderer
 * that draws `expected` off an external conflict a compile error rather than a
 * relabelled `previousRevision`.
 *
 * **Two things the external arm never carries, and why.** `previousRevision` is
 * *the last stable revision the engine tracked before this reading*; it is not
 * what this window loaded and not what any draft was made from, so presenting it
 * under the save arm's *expected* label would tell a person their draft was based
 * on a revision it may never have seen. And there is no *found* to manufacture:
 * the observation is one reading, not a refusal followed by a re-read. Both
 * exclusions are structural here — the arm has no such field — and a renderer
 * cannot get them back through this type.
 *
 * **It describes and does not compare.** Which origin stands, whether the bytes
 * differ and whether the file moved twice are `arbitrateObservation`'s and the
 * save arm's `changedAgain` — reported here as a fact read off the refusal, never
 * recomputed from a second read.
 */
export type ConflictRevisionDescription =
  | {
      /** A save this application attempted was refused under the write lock. */
      readonly kind: 'save';
      /** The revision the save was based on: what the surface loaded. */
      readonly expected: ContentRevision;
      /** The revision the locked read found: the bytes that refused the save. */
      readonly found: ContentRevision;
      /** The revision of the fresh read taken after the refusal. */
      readonly observed: ContentRevision;
      /**
       * Whether `found` and `observed` differ: the file moved twice.
       *
       * The same comparison `describeConflict` in `./saveOutcome.ts` makes for
       * `SaveConflictModel.changedAgain`, over the same two wire fields, so the two
       * cannot disagree about one refusal.
       */
      readonly changedAgain: boolean;
    }
  | {
      /** The watcher observed the file changing while a surface was open over it. */
      readonly kind: 'externalChange';
      /** The revision of the exact bytes the watcher read. Nothing else. */
      readonly observed: ContentRevision;
    };

/**
 * The revisions one conflict may name, read once off its origin.
 *
 * **A `switch` with a `never` terminus**, so a third arm of {@link ConflictSource}
 * is a compile error here rather than an origin that silently borrows the save
 * arm's three revisions. Every operand is read exactly once, off the origin, and
 * the answer is frozen: the origin is a value a caller holds and a getter behind
 * `expected` could answer one thing to a comparison and another to a screen.
 *
 * **What it forces and what it cannot.** It forces that the external arm's
 * description carries no `expected` and no `found` — there is no field to put one
 * in. It cannot force a renderer to use it: a component that reads
 * `source.observation.previousRevision` directly and draws it under an *expected*
 * label compiles, and only a mounted test over that component can catch it.
 *
 * @param source - Where the conflict came from.
 * @returns The revisions that origin may honestly name.
 */
export function conflictRevisionsOf(source: ConflictSource): ConflictRevisionDescription {
  switch (source.kind) {
    case 'save': {
      const conflict = source.conflict;
      const expected = conflict.expected;
      const found = conflict.found;
      const observed = conflict.disk_revision;
      return Object.freeze({
        kind: 'save' as const,
        expected,
        found,
        observed,
        changedAgain: found !== observed
      });
    }
    case 'externalChange':
      return Object.freeze({
        kind: 'externalChange' as const,
        observed: source.observation.diskRevision
      });
    default: {
      const unreachable: never = source;
      return unreachable;
    }
  }
} // End of function conflictRevisionsOf()

/**
 * What one standing conflict says about the file it is about, captured once.
 *
 * **Every operand read exactly once, off the origin, before anything is
 * compared** — {@link standingConflictOf} is the only producer, and it exists so
 * that {@link arbitrateObservation} can be a pure comparison over numbers and
 * hashes rather than a walk over a value some caller assembled. A property read
 * runs arbitrary code through a getter or a `Proxy` trap and `readonly` freezes
 * nothing at runtime, so an arbitration that read `source.conflict.disk_revision`
 * twice could decide one thing and report another.
 *
 * **The sequence is `null` on the save arm and that is a fact rather than a
 * default.** A refused write attempt carries no observation sequence, because it
 * was not observed — it was attempted. Ruling 26 orders two observations by
 * sequence and nothing else, so against a save conflict there is no order to
 * compare and the revision is the whole of what decides.
 */
export interface StandingConflict {
  /** The origin standing for the file, as the object every map is keyed by. */
  readonly source: ConflictSource;
  /** The disk revision that origin is about. */
  readonly diskRevision: ContentRevision;
  /** The observation sequence it was admitted under, or `null` on the save arm. */
  readonly sequence: number | null;
}

/**
 * The two facts one standing origin is arbitrated by, read once and frozen.
 *
 * **A `switch` with a `never` terminus**, so a third arm of
 * {@link ConflictSource} is a compile error here rather than an origin that
 * silently arbitrates as a save. What it does **not** force is that a caller
 * arbitrate at all, or that the origin it passes is the one any state registered:
 * this function reads an ordinary object and can vouch for nothing about where it
 * came from.
 *
 * @param source - The origin standing for one file.
 * @returns Its two arbitration operands, captured once.
 */
export function standingConflictOf(source: ConflictSource): StandingConflict {
  switch (source.kind) {
    case 'save':
      return Object.freeze({
        source,
        diskRevision: source.conflict.disk_revision,
        sequence: null
      });
    case 'externalChange': {
      const observation = source.observation;
      return Object.freeze({
        source,
        diskRevision: observation.diskRevision,
        sequence: observation.sequence
      });
    }
    default: {
      const unreachable: never = source;
      return unreachable;
    }
  }
} // End of function standingConflictOf()

/**
 * What one window did with a watcher observation of a file it holds a conflict
 * about.
 *
 * **The answers of rulings 25, 26 and 27 as one value.** Only `BrowserState` in
 * `./workspace.svelte.ts` answers the `retained` and `writtenHere` arms — it is
 * the only thing that knows whether a write is in flight, what revision that
 * write ended on, and whether its own tables moved while a verdict was being
 * decided — and {@link arbitrateObservation} produces every other one.
 *
 * **Not one of these arms installs anything, and none may.** Ruling 23 keeps
 * `BrowserState.adoptDiskVersion` the only confirmed-install door and
 * `conflictChoicesFor` in `./saveOutcome.ts` the only producer of a choice list,
 * and ruling 27 forbids watcher arbitration initiating any save command at all;
 * this is a verdict about *which origin stands*, and nothing else.
 *
 * **Every arm is delivered** (the 2d-6 record's §3 entries 2 and 4): since Phase
 * 2d-6-1b, `BrowserState` seals each verdict with the observation it is about into
 * an `ObservationDelivery` (`./observationDelivery.ts`) and hands that one
 * envelope to every receiver registered over the file — the `retained` arm too, so
 * a session can say an observation is waiting, and the two arms that end a wait
 * (`writtenHere`, or whichever arm a settlement or a retry arbitrates to) travel
 * the same path afterwards. Nothing in TypeScript ties a receiver to a session or
 * makes a session act on the arm it is given; that is the session transition's —
 * the match editor's is `applyObservation` in `./matchEditor.ts` (Phase 2d-6-2),
 * with one named action per arm and a `never` terminus, and the new-snippet
 * form's and the recovery form's are `applyObservation` in `./matchCreation.ts`
 * and `applyRecoveryObservation` in `./recovery.ts` (Phase 2d-6-3), in the same
 * shape, as are the deleter's `applyDeletionObservation` in `./matchDeletion.ts`,
 * the mover's `applyMoveObservation` in `./matchMove.ts` and the duplicator's
 * `applyDuplicationObservation` in `./matchDuplication.ts` (Phase 2d-6-4), and
 * the raw editor's `applyObservation` in `./rawEditor.ts` and restore's
 * `applyRestoreObservation` in `./restore.ts` (Phase 2d-6-5). All eight exist as
 * values; `DetailPane.svelte` registers the editor's, the new-snippet form's and
 * the recovery form's since Phase 2d-6-6b, the three operation panels' since
 * 2d-6-7a and the raw editor's and restore's since 2d-6-8a
 * (`./surfaceReceivers.ts`).
 */
export type ObservationVerdict =
  | {
      /**
       * Ruling 27: a write this window started is still in flight for the file,
       * so the observation is held and coalesced rather than applied.
       *
       * **A second thing answers it, and it is not a second meaning**: since
       * Phase 2d-5-5b's review, `BrowserState` also holds an observation whose
       * arbitration found the state it was decided against changed underneath it
       * — a re-entrant registration through a getter on the value it was reading.
       * *Held, and nobody has acted on it* is the whole of what this arm says
       * either way; what it never says is that the observation will be looked at
       * again. **Three things release a held observation**: a later settlement of
       * a write for the file, which arbitrates it or drops it as `writtenHere`; a
       * person's `BrowserState.retryRetainedObservation`, one attempt per press
       * (the 2d-6 record's §3 entries 16-18); and `open()` dropping the workspace
       * whole. Nothing schedules a second look on its own, and a retry whose
       * arbitration finds the tables moved again leaves the observation held and
       * askable again.
       */
      readonly kind: 'retained';
    }
  | {
      /**
       * Ruling 27's barrier released the held observation because its disk
       * revision is exactly the revision a write of this window ended on, so it is
       * not news about a change: nothing is registered, nothing stands from it,
       * and the wait the `retained` arm announced is over.
       *
       * **It says the revisions are equal and never that this window wrote them**
       * — `BarrierRelease.writtenHere`'s own caveat, carried unchanged: another
       * program may have produced byte-identical content, and no watcher snapshot
       * can say who wrote anything. **Only a settlement answers it**, never a pure
       * arbitration and never a retry: `BrowserState` seals it when
       * {@link releaseBarrier} answers `writtenHere`, so that a session told
       * `retained` earlier is told the check happened rather than left waiting
       * for a verdict that will never come. The session's named action (the 2d-6
       * record's §3 entry 11, extended by Phase 2d-6-1b) is to lift the
       * pending-reconciliation restriction it recorded for this observation and to
       * change nothing else — no disk comparison, no origin, no reload offer —
       * which is what the match editor's `applyObservation` does with it since
       * Phase 2d-6-2, by the observation's identity.
       */
      readonly kind: 'writtenHere';
    }
  | {
      /** Nothing stood for the file, so this observation is its conflict now. */
      readonly kind: 'raised';
      /** The memoized origin to register and to build a model from. */
      readonly source: ExternalChangeConflictSource;
    }
  | {
      /**
       * Ruling 27's uncertainty: the observation stands as the file's conflict,
       * and **no automatic reload may be made from it**, because a write from
       * this window may or may not have produced the bytes it read.
       */
      readonly kind: 'raisedWithoutReload';
      /** The memoized origin to register and to build a model from. */
      readonly source: ExternalChangeConflictSource;
      /** The origin it replaced, or `null` when nothing stood. */
      readonly superseded: ConflictSource | null;
    }
  | {
      /** Ruling 26: a strictly later observation of different bytes. */
      readonly kind: 'supersedes';
      /** The origin whose disk side this replaces. */
      readonly superseded: ConflictSource;
      /** The memoized origin to register and to build a model from. */
      readonly source: ExternalChangeConflictSource;
    }
  | {
      /**
       * Ruling 25: the same bytes the standing conflict is already about, so the
       * standing conflict keeps the model, its messages and its source identity.
       */
      readonly kind: 'coalesced';
      /** The origin that stands, unchanged. */
      readonly standing: ConflictSource;
    }
  | {
      /**
       * The observation is not strictly later than the standing external
       * conflict, so it says nothing this window has not already acted on.
       */
      readonly kind: 'notLater';
      /** The origin that stands, unchanged. */
      readonly standing: ConflictSource;
    };

/**
 * Every verdict an arbitration that really ran can answer.
 *
 * **`retained` and `writtenHere` are the two arms this excludes**, and the
 * exclusion is the type saying what the prose would otherwise have to:
 * {@link arbitrateObservation} is pure and holds no barrier, so it cannot answer
 * that a write is in flight, and it knows no settlement, so it cannot answer that
 * a held reading was of the bytes a write ended on.
 */
export type ArbitrationOutcome = Exclude<
  ObservationVerdict,
  { readonly kind: 'retained' | 'writtenHere' }
>;

/**
 * Which origin stands for one file, given what stood before and what was observed.
 *
 * **Rulings 25 and 26 in one function, and the order of its questions is the
 * ruling.**
 *
 * 1. **Not strictly later** — asked first and only of a standing *external*
 *    conflict, because that is the only origin carrying a sequence. An
 *    observation at or below the standing one's sequence is the same observation
 *    delivered twice or an older one arriving late, and acting on it would run a
 *    transition against state a newer one already moved.
 * 2. **The same disk revision** (ruling 25) — the standing conflict wins. Against
 *    a save origin it carries the stronger fact, a locked write attempt that was
 *    refused, plus operation-specific evidence; against an external origin the
 *    two readings are of identical bytes and replacing one with the other would
 *    change the source identity every map is keyed by for no change at all.
 *    **Revision equality proves identical bytes and never origin or chronology.**
 * 3. **Ruling 27's uncertainty, if the last settled write for this file may have
 *    written** — the observation stands as the conflict so the person is told,
 *    and no automatic reload may be made from it.
 * 4. **A different revision** (ruling 26) — the observation supersedes the
 *    standing conflict's disk side.
 *
 * **What "later" rests on, stated rather than implied.** Between two observations
 * it is the sequence and nothing else: a content revision is a hash and hashes
 * carry no order. Between a **save conflict** and an observation there is no
 * order at all — the refusal carries no sequence, and this function cannot tell
 * whether the watcher read the file before or after the locked read did. What
 * bounds that is ruling 27's barrier, which keeps an observation delivered
 * *during* this window's own write out of this function until the write settles;
 * an observation that was queued before a refusal and drained after it is not
 * bounded by anything here, and superseding on a different revision is what the
 * consult ruled for that case.
 *
 * **It decides and does not act.** It registers nothing, installs nothing, spends
 * no confirmation, calls no command and reads no state; the memoized origin on
 * three of its arms comes from {@link externalConflictSource}, which is a lookup
 * and not a registration. Nothing in TypeScript forces a caller to act on the arm
 * it is given, and `./workspace.svelte.ts` is the only caller that does.
 *
 * @param standing - What stands for the file, or `null` when nothing does.
 * @param observation - The narrowed observation that arrived.
 * @param writeOutcomeUncertain - Whether the last settled write this window made
 *   for the file may have written (ruling 27). A caller that always passes
 *   `false` compiles, and `BrowserState` is what answers it honestly.
 * @returns Which origin stands now.
 */
export function arbitrateObservation(
  standing: StandingConflict | null,
  observation: ExternalConflictObservation,
  writeOutcomeUncertain: boolean
): ArbitrationOutcome {
  // **Both operands off the observation, read once and before any comparison.**
  // It is a value a caller assembled, so either could be a getter that answers
  // one thing to the test and another to the arm that reports it.
  const sequence = observation.sequence;
  const diskRevision = observation.diskRevision;
  const source = externalConflictSource(observation);
  if (standing === null) {
    return writeOutcomeUncertain
      ? { kind: 'raisedWithoutReload', source, superseded: null }
      : { kind: 'raised', source };
  }
  const standingSequence = standing.sequence;
  if (standingSequence !== null && sequence <= standingSequence) {
    return { kind: 'notLater', standing: standing.source };
  }
  if (diskRevision === standing.diskRevision) {
    return { kind: 'coalesced', standing: standing.source };
  }
  return writeOutcomeUncertain
    ? { kind: 'raisedWithoutReload', source, superseded: standing.source }
    : { kind: 'supersedes', superseded: standing.source, source };
} // End of function arbitrateObservation()

/**
 * What one settled write promise says about the file it was aimed at.
 *
 * **Three answers, because that is how many the wrappers can really give.** The
 * six writing wrappers in `./workspace.svelte.ts` end in a transaction outcome,
 * in a refusal, or in a failure whose `mayHaveWritten` in `../ipc/errors` decides
 * which of the last two this is.
 */
export type WriteSettlement =
  | {
      /**
       * The transaction ended, and these are the bytes it ended on.
       *
       * **Not the same as "it wrote"**: `committed: false` is a documented
       * success, and the revision is what the file holds either way. What the
       * revision is for is ruling 27's coalescing — an observation of exactly
       * these bytes is a reading of a write this window already knows about.
       */
      readonly kind: 'ended';
      /** The revision the transaction ended on. */
      readonly revision: ContentRevision;
    }
  | {
      /**
       * The attempt is over and nothing was written — a refusal, a conflict, or
       * a failure this application can establish wrote nothing.
       */
      readonly kind: 'nothingWritten';
    }
  | {
      /**
       * The write may or may not have written (`mayHaveWritten`), so what is on
       * disk cannot be attributed.
       */
      readonly kind: 'uncertain';
    };

/**
 * What to do with the observation a barrier held, once the write settled.
 *
 * **Three arms and no verdict**, deliberately: the arbitration that follows is
 * {@link arbitrateObservation}'s, and folding the two together would give this
 * function a second way to answer ruling 25.
 */
export type BarrierRelease =
  | {
      /** The barrier held nothing, so there is nothing to apply. */
      readonly kind: 'nothingRetained';
    }
  | {
      /**
       * Ruling 27's coalescing: the held observation is a reading of exactly the
       * bytes this window's own write ended on, so it is not news about a change
       * and is dropped.
       *
       * **It says the revisions are equal and never that this window wrote
       * them** — another program may have produced byte-identical content, and no
       * watcher snapshot can say who wrote anything.
       */
      readonly kind: 'writtenHere';
      /** The observation that was held, for a caller that wants to record it. */
      readonly observation: ExternalConflictObservation;
    }
  | {
      /** The held observation is news; arbitrate it as an ordinary arrival. */
      readonly kind: 'arbitrate';
      /** The observation that was held. */
      readonly observation: ExternalConflictObservation;
    };

/**
 * What the per-document write barrier does with what it held (ruling 27).
 *
 * **The barrier's only decision is whether the held observation is news**, and
 * exactly one settlement can answer no: a transaction that ended on the very
 * revision the observation read. A refusal, a definite failure and an uncertain
 * outcome all leave the observation to be arbitrated normally — the uncertainty
 * is *not* expressed by dropping it, but by
 * {@link arbitrateObservation}'s `writeOutcomeUncertain` operand, so that one
 * fact lives in one place and a released observation is never silently lost.
 *
 * **No arm of this reaches a command.** Ruling 27's last sentence is that no save
 * command may ever be initiated by watcher arbitration, and the narrowest way to
 * say so is that neither this function nor its answer can name one.
 *
 * @param settlement - What the write promise settled as.
 * @param retained - The newest observation the barrier held, or `null`.
 * @returns What to do with it.
 */
export function releaseBarrier(
  settlement: WriteSettlement,
  retained: ExternalConflictObservation | null
): BarrierRelease {
  if (retained === null) {
    return { kind: 'nothingRetained' };
  }
  switch (settlement.kind) {
    case 'ended':
      // **Read once from each side.** The settlement is this module's caller's
      // and the observation is a value someone assembled; comparing one read of
      // each is what keeps the answer about the pair that was compared.
      return retained.diskRevision === settlement.revision
        ? { kind: 'writtenHere', observation: retained }
        : { kind: 'arbitrate', observation: retained };
    case 'nothingWritten':
      return { kind: 'arbitrate', observation: retained };
    case 'uncertain':
      // Held observations are not dropped by uncertainty — they are arbitrated
      // under it. See this function's own doc.
      return { kind: 'arbitrate', observation: retained };
    default: {
      const unreachable: never = settlement;
      return unreachable;
    }
  }
} // End of function releaseBarrier()

/**
 * Which of two observations of one file a barrier keeps (ruling 27's coalescing).
 *
 * **Coalescing is keeping the newest, never merging two readings.** Two snapshots
 * of one file are two whole readings — text, projection, findings and
 * correspondence table each bound to their own revision — so anything built from
 * halves of both would name a state that never existed.
 *
 * **Strictly greater, so an equal sequence keeps what is held.** Two observations
 * admitted under one sequence would be one observation delivered twice, and
 * swapping the held object for an equal one would change the identity
 * `externalConflictSource` memoizes on and therefore the origin any later
 * registration writes down.
 *
 * @param held - What the barrier holds, or `null` when it holds nothing.
 * @param arriving - The observation that just arrived.
 * @returns The one to keep.
 */
export function newestObservationOf(
  held: ExternalConflictObservation | null,
  arriving: ExternalConflictObservation
): ExternalConflictObservation {
  if (held === null) {
    return arriving;
  }
  return arriving.sequence > held.sequence ? arriving : held;
} // End of function newestObservationOf()
