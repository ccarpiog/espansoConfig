/**
 * What one save ended as, decided here rather than in markup.
 *
 * The three arms of a `SaveResult` are the three things a save can *be*, and
 * every one of them has a way of being presented dishonestly:
 *
 * - **`saved`** can be read as "the file changed", which `committed: false`
 *   contradicts, and as "nothing else happened", which the presentation notes
 *   contradict.
 * - **`refused`** can be presented as an error to retry, when what it needs is
 *   the findings shown and — for the acknowledgeable ones only — the same save
 *   sent again carrying **exactly** those findings back. There is no `force` flag
 *   on this wire and adding one would undo the design.
 * - **`conflict`** can be presented as a question with a default, and the default
 *   would always be somebody's data.
 *
 * So the decisions are made on this side of the boundary, where a test can reach
 * them (`docs/decisions/1c-1-notes.md` hole 1), and what comes out is **codes and
 * operands, never sentences** — the rule every model in this directory follows. A
 * component renders one by calling `tSaveOutcomeMessage` or `tConflictChoice` in
 * `../i18n`, never by building a key.
 *
 * ## The conflict arm is a state, not a description
 *
 * The first version of this module said `draftKept: true` and
 * `reloadNeedsConfirmation: true` as literal types, and the 2c-1a review was
 * right that a literal makes a dishonest value *harder to build* and not
 * impossible: a caller could discard the draft and then build a model still
 * claiming it was kept, and nothing in the type required a confirmation before
 * anything reloaded.
 *
 * So the conflict arm **carries the draft itself** — the retained value is the
 * guarantee, not an adjective about it — and reloading is reached only through
 * {@link confirmReloadDiskVersion} and {@link reloadDiskVersion}, two calls with a
 * token between them that is issued for one conflict and checked against it. The
 * shape is also what 2c-4a inherits: conflict capture and preservation needs the
 * draft, the disk projection and both revisions in one value, which is what this
 * is.
 *
 * ## Why there are two describers and no `scope` parameter
 *
 * `describeRawSave`'s first line is *this replaces the entire document*, which is
 * true of `save_raw_document` and false of the four editing commands. The first
 * version took the scope as a string argument, and the review was right that this
 * makes the disclosure a caller assertion: `describeSaveOutcome(rawRefusal, 'edit')`
 * suppresses it and `describeSaveOutcome(editResult, 'wholeDocument')` invents it.
 * {@link describeWholeDocumentSave} takes a {@link WholeDocumentOutcome}, which
 * only `sealWholeDocumentSave` produces, and {@link describeEditSave} takes the
 * wire result; neither can be told which it is.
 */

import type { TranslationKey } from '../i18n/dictionaries';
import type {
  Acknowledgement,
  ContentRevision,
  DocumentView,
  Finding,
  MatchId,
  PresentationNote,
  RefusedResult,
  SaveResult,
  SaveVerdict
} from '../ipc/types';
import { reloadedDraft, type Draft } from './draft';
import type { InvalidationStatus, WholeDocumentOutcome } from './invalidation';
import {
  describeRawSave,
  refusalAcknowledgement,
  refusalChoices,
  type RawSaveChoice,
  type RawSaveModel
} from './rawSave';

/**
 * One line a save outcome shows, as a code rather than as a sentence.
 *
 * Nine codes, and none of them carries an operand: every number a save answers
 * with — a revision, a byte count, a line — is either opaque, or a developer
 * diagnostic, or already covered by a finding's own sentence.
 */
export type SaveOutcomeMessage =
  | {
      /** The file was rewritten. */
      readonly kind: 'fileWritten';
    }
  | {
      /** The text was already exactly what the file held, so nothing was written. */
      readonly kind: 'nothingToWrite';
    }
  | {
      /** A copy of the file as it was before this session's first change was kept. */
      readonly kind: 'backupTaken';
    }
  | {
      /** Nothing was written. Shown by both the refusal and the conflict. */
      readonly kind: 'nothingWasWritten';
    }
  | {
      /** The file changed since its text was loaded here. */
      readonly kind: 'changedElsewhere';
    }
  | {
      /** The draft is kept in memory exactly as it was written. */
      readonly kind: 'draftKeptInMemory';
    }
  | {
      /** Loading the version on disk discards the draft, and cannot be undone. */
      readonly kind: 'reloadDiscardsDraft';
    }
  | {
      /** The file changed *again* between the refusal and the read that followed it. */
      readonly kind: 'changedAgainSinceRefusal';
    }
  | {
      /** The save committed and the window could not be brought back into step. */
      readonly kind: 'windowOutOfStep';
    };

/**
 * What the person may do about a conflict.
 *
 * **There is no `saveAnyway` here and there must never be one.** Retrying a
 * whole-document candidate against a base revision the file has moved past is how
 * the other writer's work is destroyed; the save that refused is the check that
 * prevented it.
 *
 * **And none of these is "keep my draft".** In the plan that phrase means
 * *reapply the draft to the newly parsed disk document*, which is 2c-4b and is the
 * dangerous algorithmic half of Phase 2c. Using the words for the weaker
 * behaviour would teach the owner the wrong meaning and make 2c-4b look
 * already-done (`docs/decisions/2c-split-notes.md` section 6).
 *
 * `confirmReload` is deliberately **not** in {@link ConflictModel.choices}: it is
 * the second step, the label on the control that confirms a reload after the
 * warning has been read, and the transition behind it is
 * {@link confirmReloadDiskVersion}.
 */
export type ConflictChoice = 'keepEditing' | 'copyDraft' | 'reloadDiskVersion' | 'confirmReload';

/** A save that ran to the end. */
export interface SavedModel {
  /** Which arm this is. */
  readonly kind: 'saved';
  /** The revision the file holds now — the next save's base. */
  readonly revision: ContentRevision;
  /**
   * Whether the file was actually rewritten.
   *
   * **`false` is a success**, and the model says so with its own sentence rather
   * than by omitting one: a candidate byte-identical to what the file already
   * held is not written, because replacing a file drops metadata and buys
   * nothing. Both gates still ran.
   */
  readonly committed: boolean;
  /**
   * Whether a pre-save copy was written.
   *
   * Disclosed and never promised: retention is ten batches and a batch is a
   * session, so `true` is not a promise that the file can be recovered.
   */
  readonly backupTaken: boolean;
  /**
   * The affected snippet's identity in the new revision, when there was one.
   *
   * Always `null` for a whole-document replacement, and not by this module's
   * choice: {@link WholeDocumentOutcome}'s saved arm types it that way, because
   * every identity in a replaced file is stale at once.
   */
  readonly moved: MatchId | null;
  /**
   * Presentation changes the save had to make, in the order it reported them.
   *
   * Rendered through the existing `tPresentationNote` accessor: these are
   * disclosures the core already has sentences for, and this module has nothing
   * to add to them. Never dropped — plan section 6.2 is *never silently
   * normalise*, and a note dropped here is a normalisation made silent.
   */
  readonly notes: readonly PresentationNote[];
  /** The lines to show, in order. */
  readonly messages: readonly SaveOutcomeMessage[];
}

/** A save the semantic gate refused. Nothing was written. */
export interface RefusedModel {
  /** Which arm this is. */
  readonly kind: 'refused';
  /** Which arm of the policy refused. */
  readonly verdict: SaveVerdict;
  /** **Every** finding the gate reported, in its order, none dropped. */
  readonly findings: readonly Finding[];
  /**
   * The value that makes this exact save proceed, or `null`.
   *
   * It carries **every** finding the refusal reported, because the gate matches
   * an acknowledgement against the candidate's suspicions as an **exact
   * multiset**: a subset is simply a second refusal, and there is no flag that
   * skips the match. What binds it to one candidate is not this model but
   * `acknowledgeRefusal` in `./draft`, which is the only thing that records it.
   *
   * `null` for a verdict no acknowledgement can move, which is exactly when
   * {@link RefusedModel.choices} omits `saveAnyway`.
   */
  readonly acknowledgement: Acknowledgement | null;
  /** What the person may do, in the order to offer it. */
  readonly choices: readonly RawSaveChoice[];
  /**
   * The refusal as it arrived, for `acknowledgeRefusal` to record consent from.
   *
   * Carried whole rather than reduced to its acknowledgement, because consent is
   * derived from the refusal and the submission together and never from a bare
   * acknowledgement a caller chose.
   */
  readonly refusal: RefusedResult;
  /**
   * What the raw editor says about this refusal, or `null` for an edit save.
   *
   * Non-null only for a whole-document replacement, because its first line is
   * *this replaces the entire document* and that is false of a field edit.
   */
  readonly rawSave: RawSaveModel | null;
  /** The lines to show, in order. */
  readonly messages: readonly SaveOutcomeMessage[];
}

/**
 * The file moved on under the save, **nothing was written**, and the draft is
 * here.
 *
 * The terminal, honest conflict state of `docs/decisions/2c-split-notes.md`
 * section 6 — a complete first implementation rather than half of 2c-4's rebase.
 * It **carries the retained draft** rather than asserting that one was retained,
 * and reloading is a transition off this state rather than a boolean on it.
 *
 * @typeParam T - The drafted value.
 */
export interface ConflictModel<T> {
  /** Which arm this is. */
  readonly kind: 'conflict';
  /** The revision the save was based on — what the editor loaded. */
  readonly expected: ContentRevision;
  /** The revision the locked read found: the bytes that refused the save. */
  readonly found: ContentRevision;
  /** The revision of the fresh read taken after the refusal. */
  readonly diskRevision: ContentRevision;
  /**
   * The projection of that fresh read.
   *
   * Carried so the screen can tell the disk version from the draft by something a
   * person can read — the file's own path, and what it now holds — rather than by
   * two hex digests alone. 2c-4a needs it for the comparison it owes.
   */
  readonly disk: DocumentView;
  /**
   * The disk side's **whole file text**, exactly as the file holds it.
   *
   * No line ending converted, no BOM stripped, no normalisation. It is the text
   * at {@link ConflictModel.diskRevision}, paired with it by the command layer:
   * one workspace snapshot in Rust carries the text, the revision and
   * {@link ConflictModel.disk} together, so nothing between them can substitute a
   * later read.
   *
   * **The pairing rests on content-hash equality, not on "one read".** Rust's
   * refresh hashes the bytes it has just read and keeps the snapshot it already
   * had when that hash matches, so this text may be an earlier read's — of bytes a
   * digest has just proved equal to the disk's. A hash collision is what that does
   * not exclude. This interface cannot express the pairing at all — they are two
   * ordinary fields — and what it rests on is that one production function in Rust
   * builds them.
   *
   * **Not the text at {@link ConflictModel.found}.** When
   * {@link ConflictModel.changedAgain} is true the file moved twice and this is
   * the later of the two observations, so no message may present it as the bytes
   * that refused the save.
   *
   * Carried, not drawn: 2c-4a-1 adds the value and no screen shows it yet.
   */
  readonly diskText: string;
  /**
   * Whether the file changed **again** between the refusal and the read after it.
   *
   * `found` and `diskRevision` are two observations, not two names for one: when
   * they differ, some writer changed the file a second time, and presenting the
   * two as descriptions of the same bytes would be a false statement.
   */
  readonly changedAgain: boolean;
  /**
   * The draft, exactly as it was when the save was refused.
   *
   * **This is what "nothing was discarded" means here.** A model that had thrown
   * the draft away could not be built, because the field is required and there is
   * nothing else to put in it.
   */
  readonly draft: Draft<T>;
  /**
   * What the person may do, in the order to offer it.
   *
   * *Copy draft* comes before *Reload disk version* on purpose: the destructive
   * choice is never the one nearest to hand, and the copy is what makes the
   * destruction survivable.
   */
  readonly choices: readonly ConflictChoice[];
  /** The lines to show, in order. */
  readonly messages: readonly SaveOutcomeMessage[];
}

/**
 * How one save ended, as the thing a screen draws.
 *
 * @typeParam T - The drafted value, which only the conflict arm carries.
 */
export type SaveOutcomeModel<T> = SavedModel | RefusedModel | ConflictModel<T>;

/**
 * The order a conflict offers its choices in.
 *
 * A constant rather than a literal built per call, so the ordering claim above is
 * one fact in one place. `confirmReload` is absent by design.
 */
const CONFLICT_CHOICES: readonly ConflictChoice[] = [
  'keepEditing',
  'copyDraft',
  'reloadDiskVersion'
];

/**
 * Builds the `saved` arm.
 *
 * @param result - The saved outcome, from either kind of save.
 * @returns The model.
 */
function describeSaved(result: {
  readonly revision: ContentRevision;
  readonly committed: boolean;
  readonly backup_taken: boolean;
  readonly moved: MatchId | null;
  readonly notes: readonly PresentationNote[];
}): SavedModel {
  const messages: SaveOutcomeMessage[] = [
    result.committed ? { kind: 'fileWritten' } : { kind: 'nothingToWrite' }
  ];
  if (result.backup_taken) {
    messages.push({ kind: 'backupTaken' });
  }
  return {
    kind: 'saved',
    revision: result.revision,
    committed: result.committed,
    backupTaken: result.backup_taken,
    moved: result.moved,
    notes: result.notes,
    messages
  };
} // End of function describeSaved()

/**
 * Builds the `refused` arm.
 *
 * @param result - The refusal, exactly as it arrived.
 * @param wholeDocument - Whether the save replaced the file's whole text. Never a
 *   caller's word: the two describers below supply it, and only one of them can
 *   be reached with a {@link WholeDocumentOutcome}.
 * @returns The model.
 */
function describeRefused(result: RefusedResult, wholeDocument: boolean): RefusedModel {
  const acknowledgement = refusalAcknowledgement(result);
  return {
    kind: 'refused',
    verdict: result.verdict,
    findings: result.findings,
    acknowledgement,
    choices: refusalChoices(acknowledgement),
    refusal: result,
    rawSave: wholeDocument ? describeRawSave(result) : null,
    messages: [{ kind: 'nothingWasWritten' }]
  };
} // End of function describeRefused()

/**
 * Builds the `conflict` arm around the draft that was refused.
 *
 * The disk side's text is carried through **unchanged** — copied, never rebuilt
 * from the projection and never normalised — because it is the one value on this
 * payload a comparison can be made against byte for byte.
 *
 * @typeParam T - The drafted value.
 * @param result - The conflict, exactly as it arrived.
 * @param draft - The draft the save was made from, retained untouched.
 * @returns The model.
 */
function describeConflict<T>(
  result: {
    readonly expected: ContentRevision;
    readonly found: ContentRevision;
    readonly disk_revision: ContentRevision;
    readonly disk_text: string;
    readonly disk: DocumentView;
  },
  draft: Draft<T>
): ConflictModel<T> {
  const changedAgain = result.found !== result.disk_revision;
  const messages: SaveOutcomeMessage[] = [
    { kind: 'nothingWasWritten' },
    { kind: 'changedElsewhere' },
    { kind: 'draftKeptInMemory' },
    { kind: 'reloadDiscardsDraft' }
  ];
  if (changedAgain) {
    messages.push({ kind: 'changedAgainSinceRefusal' });
  }
  return {
    kind: 'conflict',
    expected: result.expected,
    found: result.found,
    diskRevision: result.disk_revision,
    disk: result.disk,
    diskText: result.disk_text,
    changedAgain,
    draft,
    choices: CONFLICT_CHOICES,
    messages
  };
} // End of function describeConflict()

/**
 * Builds what a screen says about a **whole-document** save.
 *
 * Reachable only with a {@link WholeDocumentOutcome}, which only
 * `sealWholeDocumentSave` produces, so the *this replaces the entire document*
 * disclosure cannot be suppressed by a caller and cannot be attached to an edit.
 *
 * @typeParam T - The drafted value.
 * @param outcome - How the save ended, from an opened seal.
 * @param draft - The draft it was made from, retained for the conflict arm.
 * @returns The model for that arm.
 */
export function describeWholeDocumentSave<T>(
  outcome: WholeDocumentOutcome,
  draft: Draft<T>
): SaveOutcomeModel<T> {
  if (outcome.outcome === 'saved') {
    return describeSaved(outcome);
  }
  return outcome.outcome === 'refused'
    ? describeRefused(outcome, true)
    : describeConflict(outcome, draft);
} // End of function describeWholeDocumentSave()

/**
 * Builds what a screen says about a save that **edited a span**.
 *
 * The four editing commands: `move_match`, `save_match`, `create_match` and
 * `delete_match`. Their refusals carry no `DocumentDoesNotParse` — that finding
 * is produced only by a whole-document replacement — and their disclosures do not
 * include the one about replacing the file.
 *
 * @typeParam T - The drafted value.
 * @param result - How the save ended, exactly as the transaction reported it.
 * @param draft - The draft it was made from, retained for the conflict arm.
 * @returns The model for that arm.
 */
export function describeEditSave<T>(result: SaveResult, draft: Draft<T>): SaveOutcomeModel<T> {
  if (result.outcome === 'saved') {
    return describeSaved(result);
  }
  return result.outcome === 'refused'
    ? describeRefused(result, false)
    : describeConflict(result, draft);
} // End of function describeEditSave()

/**
 * The draft's value, for the *Copy draft* affordance.
 *
 * A function rather than a field read, so the conflict state has one named way to
 * be copied out of and a screen does not reach into the draft's internals for it.
 *
 * @typeParam T - The drafted value.
 * @param conflict - The conflict state holding the draft.
 * @returns The retained value, exactly as it was when the save was refused.
 */
export function copyOfDraft<T>(conflict: ConflictModel<T>): T {
  return conflict.draft.value;
} // End of function copyOfDraft()

/**
 * The brand of a reload confirmation. Declared, never exported, never at runtime.
 */
declare const CONFIRMED: unique symbol;

/**
 * Proof that a person was asked before their draft was discarded.
 *
 * Issued by {@link confirmReloadDiskVersion} for **one** conflict state, and
 * checked against it by {@link reloadDiskVersion}. It exists because the previous
 * shape said `reloadNeedsConfirmation: true` and nothing enforced it: a boolean
 * describing a requirement is not the requirement.
 */
export interface ReloadConfirmation {
  /** The brand. Never present at runtime, never nameable outside this module. */
  readonly [CONFIRMED]: typeof CONFIRMED;
}

/** Which conflict each confirmation was issued for. */
const CONFIRMATIONS = new WeakMap<ReloadConfirmation, object>();

/**
 * Records that the person confirmed discarding their draft for the disk version.
 *
 * The screen calls this from the second step — after the `reloadDiscardsDraft`
 * warning has been shown and *Copy draft* has been offered — and only then can it
 * reach {@link reloadDiskVersion}.
 *
 * @typeParam T - The drafted value.
 * @param conflict - The conflict state the person is looking at.
 * @returns The confirmation, valid for that conflict state and no other.
 */
export function confirmReloadDiskVersion<T>(conflict: ConflictModel<T>): ReloadConfirmation {
  const confirmation = Object.freeze({}) as ReloadConfirmation;
  CONFIRMATIONS.set(confirmation, conflict);
  return confirmation;
} // End of function confirmReloadDiskVersion()

/**
 * Discards the draft and starts again from what the disk holds.
 *
 * **The destructive transition, and the only one.** It refuses a confirmation
 * issued for a different conflict state rather than trusting it, so a screen
 * cannot collect one answer and spend it on another question.
 *
 * @typeParam T - The drafted value.
 * @param conflict - The conflict state being left.
 * @param confirmation - What {@link confirmReloadDiskVersion} issued for it.
 * @param revision - The revision that was read from disk.
 * @param value - The value at that revision.
 * @returns A clean draft of the disk version, or `null` when the confirmation was
 *   not issued for this conflict — in which case nothing was discarded.
 */
export function reloadDiskVersion<T>(
  conflict: ConflictModel<T>,
  confirmation: ReloadConfirmation,
  revision: ContentRevision,
  value: T
): Draft<T> | null {
  if (CONFIRMATIONS.get(confirmation) !== conflict) {
    return null;
  }
  return reloadedDraft(conflict.draft, revision, value);
} // End of function reloadDiskVersion()

/**
 * The disclosure a committed save owes when the invalidation that followed it
 * failed.
 *
 * **A committed write is never afterwards reported as an error** (`PROGRESS.md`
 * D2), so this is a line *beside* a `saved` model and never a replacement for
 * one: the bytes are on disk, and what failed is this window's attempt to bring
 * itself back into step. Telling the person otherwise would invite a retry of a
 * write that already happened.
 *
 * @param invalidation - What became of it, from an opened seal or from the
 *   command wrapper — the two use one type.
 * @returns The line to add, or `null` when nothing failed.
 */
export function invalidationFailureMessage(
  invalidation: InvalidationStatus
): SaveOutcomeMessage | null {
  return invalidation.kind === 'failed' ? { kind: 'windowOutOfStep' } : null;
} // End of function invalidationFailureMessage()

/**
 * The dictionary key holding one message's sentence.
 *
 * A `switch` over literal keys rather than a template, on purpose: a template
 * would type-check against {@link TranslationKey} only by accident of its own
 * construction, and this way a renamed key is a compile error here.
 *
 * @param message - A line of the model.
 * @returns The key holding that line's sentence.
 */
export function saveOutcomeMessageKey(message: SaveOutcomeMessage): TranslationKey {
  switch (message.kind) {
    case 'fileWritten':
      return 'browser.saveOutcome.fileWritten';
    case 'nothingToWrite':
      return 'browser.saveOutcome.nothingToWrite';
    case 'backupTaken':
      return 'browser.saveOutcome.backupTaken';
    case 'nothingWasWritten':
      return 'browser.saveOutcome.nothingWasWritten';
    case 'changedElsewhere':
      return 'browser.saveOutcome.changedElsewhere';
    case 'draftKeptInMemory':
      return 'browser.saveOutcome.draftKeptInMemory';
    case 'reloadDiscardsDraft':
      return 'browser.saveOutcome.reloadDiscardsDraft';
    case 'changedAgainSinceRefusal':
      return 'browser.saveOutcome.changedAgainSinceRefusal';
    case 'windowOutOfStep':
      return 'browser.saveOutcome.windowOutOfStep';
  }
} // End of function saveOutcomeMessageKey()

/**
 * The dictionary key holding one conflict choice's label.
 *
 * `keepEditing` reuses the raw editor's own label rather than adding a second
 * string that reads the same: it is the same offer, made about a different
 * refusal.
 *
 * @param choice - What the person may do.
 * @returns The key holding that choice's label.
 */
export function conflictChoiceKey(choice: ConflictChoice): TranslationKey {
  switch (choice) {
    case 'keepEditing':
      return 'browser.rawSave.choice.keepEditing';
    case 'copyDraft':
      return 'browser.saveOutcome.choice.copyDraft';
    case 'reloadDiskVersion':
      return 'browser.saveOutcome.choice.reloadDiskVersion';
    case 'confirmReload':
      return 'browser.saveOutcome.choice.confirmReload';
  }
} // End of function conflictChoiceKey()
