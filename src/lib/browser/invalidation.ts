/**
 * The typed effect of a whole-document replacement: **every identity in that file
 * is stale, and the outcome cannot be read until that has been acted on.**
 *
 * ## The hole this exists to narrow
 *
 * After a committed whole-document replacement, every `MatchId` a window holds
 * for that file resolves to `identityStaleRevision` — and unlike a move, a field
 * save, a creation or a deletion, there is **no single match to answer with**:
 * `SavedResult.moved` is `null` permanently and by construction. Phase 2b-2c-3a
 * recorded that this obligation "is represented in no type: a caller that ignores
 * it compiles", and 2b-2c-3b narrowed it to a required callback whose body may
 * still be empty (`docs/decisions/2b-2c-3b-notes.md` section 7.2).
 *
 * The split names the failure this leaves open as the single most likely way
 * Phase 2c goes wrong (`docs/decisions/2c-split-notes.md` section 8): *a
 * successful raw save followed by continued use of stale frontend projections and
 * `MatchId`s.*
 *
 * ## The construct, and why this one
 *
 * A {@link SealedWholeDocumentSave} is a save outcome **the object does not
 * carry**. The first version of this module kept the payload on the object under
 * a module-private symbol, and the 2c-1a review was right that this is private
 * only at the TypeScript-name level: `Reflect.ownKeys`,
 * `Object.getOwnPropertySymbols` and `Object.getOwnPropertyDescriptors` all
 * recover a symbol-keyed property, and object spread copies it. The payload now
 * lives in a module-private `WeakMap` keyed by the sealed object, so the object
 * itself is an empty frozen husk: reflection finds nothing, spread copies
 * nothing, `structuredClone` clones nothing, and a clone is not a key of the map
 * either.
 *
 * {@link openWholeDocumentSave} is the only function that can produce the result,
 * it takes the invalidation as a **required** second argument which it calls
 * itself, and it is **one-shot**: the map entry is deleted as the seal is opened,
 * so a second open — including a later one with a no-op callback — is refused
 * rather than served.
 *
 * So a caller that does not discharge the invalidation does not have a save
 * result at all: it cannot tell whether the file was written, cannot draw an
 * outcome and cannot rebase a draft. That is what "fails to type-check" can be
 * made to mean in a language with no linear types.
 *
 * Three alternatives were considered and are weaker, each in a way that matters:
 *
 * - **A branded token beside a readable result.** The caller reads the result and
 *   never consumes the token. Nothing forces the two to meet.
 * - **A discriminated result whose committed arm carries a token.** The same hole:
 *   narrowing to the arm already gives the caller everything it wanted.
 * - **A "must-use" wrapper.** TypeScript has no `#[must_use]`, and no lint in this
 *   repository could see a value dropped inside a component.
 *
 * ## An invalidation that throws must not unwrite the file
 *
 * `PROGRESS.md` D2 — *a committed write is never afterwards reported as an error*
 * — and the 2c-1a review found this module breaking it: a `forget` that threw
 * propagated out of the opener, so the caller saw an exception where a committed
 * `saved` should have been. That is the same defect 2b-2c-3b's own fix round
 * found in `saveRawDocument`, made again one layer up.
 *
 * The opener now catches it, classifies it through `classifyFailure` — the same
 * channel every other failure of this boundary uses — and hands it back on
 * {@link WholeDocumentSaveOpening}'s `invalidation` **beside** the committed
 * outcome. A window out of step with the file is a real problem and a different
 * one from a failed write.
 *
 * ## What it still does not force, stated rather than glossed
 *
 * 1. **The body may do nothing.** `() => {}` satisfies
 *    {@link ForgetReplacedDocument}, exactly as it satisfies `ReloadAfterRawSave`.
 *    No TypeScript signature can require a body to act. What the seal forces is
 *    that the routine is **called** — there is no path to the outcome that does
 *    not pass through it.
 * 2. **A caller can decline to seal**, and the document it seals with is its own
 *    assertion. `commands.saveRawDocument` still answers an unsealed value, and
 *    `sealWholeDocumentSave(documentB, resultOfA, …)` is a call this module cannot
 *    detect. What it does is put that pairing in one place — the adapter that
 *    issued the save and therefore knows both — instead of leaving a `scope`
 *    string to be re-asserted at every describer. Since Phase 2c-1b that adapter
 *    is `BrowserState.saveRawDocument`, which is the only production caller.
 * 3. **A failure that may have written is not covered.** A save that fails after
 *    its rename may have replaced the file, and there is no revision to hand back
 *    for it. `mayHaveWritten` in `../ipc/errors` is that question, and
 *    `BrowserState.saveRawDocument` is where it is asked.
 */

import type { RawSaveInvalidation, RawSaveReload } from '../ipc/commands';
import { classifyFailure } from '../ipc/errors';
import type {
  ConflictResult,
  ContentRevision,
  DocumentId,
  PresentationNote,
  RefusedResult,
  SaveResult
} from '../ipc/types';

/**
 * What a caller must do when a whole-document replacement commits.
 *
 * **Synchronous, and that is deliberate.** The invalidation this application
 * already performs is synchronous and total before its first `await`, because an
 * asynchronous one has a window in which a getter can still read the projections
 * the commit destroyed (`docs/decisions/2b-2c-3b-notes.md` section 3). Re-reading
 * the file afterwards is a separate, asynchronous step and is not this.
 *
 * @param invalidation - The file that was replaced and the revision it holds now.
 */
export type ForgetReplacedDocument = (invalidation: RawSaveInvalidation) => void;

/**
 * A whole-document save that ran to the end.
 *
 * The wire's `SavedResult` with one field narrowed: `moved` is the literal `null`
 * rather than `MatchId | null`. The protocol says a replacement answers `null`
 * **permanently and by construction**, and the 2c-1a review was right that
 * passing the wire field through left the other case representable. It is not
 * dropped for tidiness: after a whole-document commit *every* identity in the
 * file is stale, so an identity on this arm would be one the caller must not use
 * even if the wire somehow produced it.
 */
export interface WholeDocumentSaved {
  /** Which arm this is. */
  readonly outcome: 'saved';
  /** The revision the file holds now — the caller's new base. */
  readonly revision: ContentRevision;
  /** Whether the file was actually rewritten. `false` is a success. */
  readonly committed: boolean;
  /** Presentation changes the save had to make, in the order it reported them. */
  readonly notes: readonly PresentationNote[];
  /** Whether a pre-save copy was written. */
  readonly backup_taken: boolean;
  /** Always `null`: a replacement has no single snippet to answer with. */
  readonly moved: null;
}

/**
 * How a whole-document save ended.
 *
 * The same three arms as a `SaveResult`, with the saved one narrowed. Produced
 * only by {@link sealWholeDocumentSave} and only readable through
 * {@link openWholeDocumentSave}, so a caller cannot describe an edit save as a
 * replacement by naming a scope.
 */
export type WholeDocumentOutcome = WholeDocumentSaved | ConflictResult | RefusedResult;

/**
 * The brand of a sealed outcome.
 *
 * Declared and never exported, so no object outside this module can have the
 * property and no type outside it can name the key. `declare const` also means
 * the symbol has no runtime existence: a sealed value carries **nothing** at run
 * time, and its payload is in {@link SEALS}.
 */
declare const SEALED: unique symbol;

/**
 * A save outcome that cannot be read until its invalidation has been discharged.
 *
 * **There is nothing on this value to read, at either level.** The type declares
 * only a phantom brand, and the object really is empty and frozen — reflection,
 * spread, cloning and serialization all find an object with no own properties.
 */
export interface SealedWholeDocumentSave {
  /** The phantom brand. Never present at runtime, never readable at compile time. */
  readonly [SEALED]: typeof SEALED;
}

/** What a sealed outcome is carrying, held away from the object itself. */
interface SealedBox {
  /** The document that was replaced, which no `SaveResult` carries. */
  readonly document: DocumentId;
  /** The outcome, unreachable until the seal is opened. */
  readonly outcome: WholeDocumentOutcome;
  /** What the issuer's own invalidation already did, before the seal existed. */
  readonly issuerInvalidation: RawSaveReload;
}

/**
 * Every unopened seal, keyed by the object that stands for it.
 *
 * A `WeakMap` rather than a property, because a property is reachable by
 * reflection whatever its key is, and a clone of a sealed object is a different
 * object and therefore not a key here. Deleting the entry on open is what makes a
 * seal one-shot.
 */
const SEALS = new WeakMap<SealedWholeDocumentSave, SealedBox>();

/**
 * Narrows a wire save result to a whole-document one.
 *
 * The saved arm is rebuilt rather than spread, so `moved` cannot be carried
 * across even if the wire produced one: every identity in a replaced file is
 * stale, including whatever the wire named.
 *
 * @param result - How the save ended, exactly as the transaction reported it.
 * @returns The same outcome, with the saved arm's `moved` fixed at `null`.
 */
function asWholeDocumentOutcome(result: SaveResult): WholeDocumentOutcome {
  if (result.outcome !== 'saved') {
    return result;
  }
  return {
    outcome: 'saved',
    revision: result.revision,
    committed: result.committed,
    notes: result.notes,
    backup_taken: result.backup_taken,
    moved: null
  };
} // End of function asWholeDocumentOutcome()

/**
 * Seals a whole-document save outcome against being read without invalidating.
 *
 * **The one place scope and document are asserted.** The caller that issued the
 * save knows both; everything downstream reads them off the seal rather than
 * being told again.
 *
 * ## The issuer's own invalidation travels with it
 *
 * A committed replacement is invalidated **twice over**, at two different moments
 * and by two different pieces of code, and only the first of them is early enough
 * to be safe. The adapter that issues the save passes its own routine to
 * `saveRawDocument`, which calls it before its promise resolves; the opener's
 * callback runs later, when someone asks to read the outcome. So by the time a
 * seal can be opened, the cache invalidation has already happened or already
 * failed — and if it **failed**, the person is looking at a window that is out of
 * step with a file this application really did rewrite.
 *
 * The 2c-1b review found that fact stranded: the workspace reported it to the
 * developer channel and nothing carried it to a screen, so a committed save whose
 * re-projection failed drew a clean *the file was written*. It is a required
 * argument here, rather than optional with a benign default, because the issuer
 * always knows it and a default would be this type inventing a `notOwed` for a
 * caller that simply forgot.
 *
 * @param document - The file the save was aimed at. It is carried because a
 *   `SaveResult` does not name the document it is about, and the invalidation has
 *   to.
 * @param result - How the save ended, exactly as the transaction reported it.
 * @param issuerInvalidation - What the issuer's **own** invalidation did.
 *   `notOwed` when nothing was written, `done` when the caches were refreshed,
 *   `failed` when they could not be — which never means the save failed.
 * @returns The sealed outcome, whose only use is {@link openWholeDocumentSave}.
 */
export function sealWholeDocumentSave(
  document: DocumentId,
  result: SaveResult,
  issuerInvalidation: RawSaveReload
): SealedWholeDocumentSave {
  // An empty frozen object: it is a key, and it is nothing else. The cast gives
  // it the phantom brand, which exists only in the type system.
  const sealed = Object.freeze({}) as SealedWholeDocumentSave;
  SEALS.set(sealed, {
    document,
    outcome: asWholeDocumentOutcome(result),
    issuerInvalidation
  });
  return sealed;
} // End of function sealWholeDocumentSave()

/**
 * What became of the invalidation a committed replacement owes.
 *
 * `RawSaveReload`'s three arms, and deliberately the same type: "did not run",
 * "ran and worked" and "ran and failed" are the three states the command boundary
 * already distinguishes, and a second vocabulary for them would be a second thing
 * to keep in step.
 */
export type InvalidationStatus = RawSaveReload;

/**
 * What opening a seal produced.
 *
 * The refused arm is not a failure of the save: it means this seal had already
 * been opened, so the outcome has been delivered once and the invalidation has
 * already run. A second open with a no-op callback is exactly what the one-shot
 * rule exists to refuse.
 */
export type WholeDocumentSaveOpening =
  | {
      /** The discriminant: the seal was intact and has now been consumed. */
      readonly kind: 'opened';
      /** The file the save was aimed at. */
      readonly document: DocumentId;
      /** How the save ended. */
      readonly outcome: WholeDocumentOutcome;
      /**
       * What became of the invalidation.
       *
       * **A `failed` here never means the save failed.** The bytes are on disk;
       * what threw is this window's own forgetting.
       */
      readonly invalidation: InvalidationStatus;
      /**
       * What became of the **issuer's** invalidation, which ran earlier.
       *
       * A separate field rather than one merged with the above, because they are
       * two different acts at two different moments and a single field would make
       * "which of the two failed?" unanswerable. Both mean the same thing to a
       * person — *the file was written and this window is out of step* — so a
       * screen that draws either draws it once.
       */
      readonly issuerInvalidation: InvalidationStatus;
    }
  | {
      /** The discriminant: this seal has been opened before and holds nothing. */
      readonly kind: 'alreadyOpened';
    };

/**
 * Opens a sealed outcome, discharging the invalidation on the way.
 *
 * `forget` is called **exactly when the file was rewritten** — a committed
 * `saved` and nothing else — and it is called before this function returns, so
 * there is no moment in which the caller holds the result and the window still
 * holds identities minted from the bytes that were replaced.
 *
 * It is deliberately not called for the other outcomes, and each is a different
 * reason rather than one:
 *
 * - `committed: false` is a success in which **nothing was written**: the
 *   candidate was byte-identical to what the file already held, no new revision
 *   exists and nothing went stale. Invalidating anyway would make a window
 *   discard projections that are still correct.
 * - `conflict` wrote nothing either, and what the caller holds is a projection of
 *   bytes **some other writer** replaced. That is carried in the outcome's own
 *   `disk` field, and adopting it is a different act from forgetting a file this
 *   application has just rewritten.
 * - `refused` wrote nothing and changed nothing.
 *
 * @param sealed - What {@link sealWholeDocumentSave} produced.
 * @param forget - What to do about every identity in that file. Required, with no
 *   default and no `undefined` in its type. If it throws, the throw is classified
 *   onto the answer and never allowed to replace the outcome.
 * @returns The outcome and the invalidation's own fate, or `alreadyOpened`.
 */
export function openWholeDocumentSave(
  sealed: SealedWholeDocumentSave,
  forget: ForgetReplacedDocument
): WholeDocumentSaveOpening {
  const box = SEALS.get(sealed);
  if (box === undefined) {
    return { kind: 'alreadyOpened' };
  }
  // Deleted before the callback runs, so a `forget` that re-enters this function
  // with the same seal cannot be served either.
  SEALS.delete(sealed);
  const opened = {
    kind: 'opened',
    document: box.document,
    outcome: box.outcome,
    issuerInvalidation: box.issuerInvalidation
  } as const;
  const invalidation = invalidationOf(box.document, box.outcome);
  if (invalidation === null) {
    return { ...opened, invalidation: { kind: 'notOwed' } };
  }
  try {
    forget(invalidation);
  } catch (raw: unknown) {
    // **The file is written and stays written.** `classifyFailure` never throws
    // and never returns `undefined`, so this arm always has something to carry,
    // and what it carries goes beside the committed outcome rather than in place
    // of it.
    return { ...opened, invalidation: { kind: 'failed', failure: classifyFailure(raw) } };
  }
  return { ...opened, invalidation: { kind: 'done' } };
} // End of function openWholeDocumentSave()

/**
 * What one save outcome made stale, or `null` when it made nothing stale.
 *
 * The single rule that decides whether the invalidation is owed, so that
 * {@link openWholeDocumentSave} and any reader asking the same question cannot
 * answer it differently. Exported so a test can ask without opening a seal, which
 * is safe: it already requires the outcome it would otherwise be revealing.
 *
 * @param document - The file the save was aimed at.
 * @param result - How the save ended.
 * @returns The invalidation a committed replacement owes, or `null`.
 */
export function invalidationOf(
  document: DocumentId,
  result: SaveResult | WholeDocumentOutcome
): RawSaveInvalidation | null {
  return result.outcome === 'saved' && result.committed
    ? { document, revision: result.revision }
    : null;
} // End of function invalidationOf()
