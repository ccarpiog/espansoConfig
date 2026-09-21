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
 * It is vocabulary. It declares the two origins, it hands out **one stable object
 * per wire value** so identity-keyed bookkeeping keeps working, and it names the
 * origin-specific line a conflict panel will show. It arbitrates nothing, installs
 * nothing and routes nothing: which observations become conflicts at all is
 * `./observationTransitions.ts`'s (2d-5-4).
 *
 * **Phase 2d-5-5a gave it its first production readers.** `ConflictModel.source` in
 * `./saveOutcome.ts` is a {@link ConflictSource}, the six conflict registrations in
 * `./workspace.svelte.ts` go through {@link saveConflictSource}, and both
 * identity-keyed maps — that module's `conflictOrigins` and this one's sibling, the
 * reapply authorization memo — are keyed on a {@link ConflictSource}. What still has
 * no production caller is {@link externalConflictSource}'s half of the arbitration:
 * choosing between a save conflict and a watcher observation for one document is
 * 2d-5-5b's, and drawing either origin is 2d-6's.
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
      /** The file changed on disk while this surface was open, with no save attempted. */
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
