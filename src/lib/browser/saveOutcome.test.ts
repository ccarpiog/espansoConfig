/**
 * The three arms of a save, as the thing a screen draws.
 *
 * Each arm has a way of being presented dishonestly, and each group below pins
 * the honest reading:
 *
 * 1. **`saved`** — `committed: false` is a **success**, and the model says so with
 *    its own sentence rather than by leaving the case out; a backup is disclosed
 *    and never promised; and a presentation note is never dropped, because plan
 *    section 6.2 is *never silently normalise* and a dropped note is a
 *    normalisation made silent.
 * 2. **`refused`** — the acknowledgement carries **every** finding, because the
 *    gate matches an exact multiset, and the choice to save anyway is offered
 *    exactly when it would work. The `DocumentDoesNotParse` case is delegated to
 *    `rawSave.ts` rather than modelled a second time here.
 * 3. **`conflict`** — the requirements of `2c-split-notes.md` section 6. After the
 *    2c-1a review the arm **carries the draft** instead of asserting `draftKept:
 *    true`, and reloading is a two-step transition with a token rather than a
 *    boolean saying a confirmation is needed.
 *
 * And the scope is no longer a caller's word: there are two describers, and the
 * whole-document one can only be reached with an outcome that came out of a seal.
 */

import { describe, expect, it } from 'vitest';
import { DICTIONARIES, placeholdersOf, type TranslationKey } from '../i18n/dictionaries';
import { LOCALES } from '../i18n/locale';
import type {
  ConflictResult,
  ContentRevision,
  Finding,
  PresentationNote,
  RefusedResult,
  SavedResult
} from '../ipc/types';
import { editDraft, startDraft, textDraftRules, type Draft } from './draft';
import { makeDocument } from './fixtures';
import type { WholeDocumentSaved } from './invalidation';
import {
  authorizeDiskAdoption,
  conflictChoiceKey,
  conflictChoicesFor,
  conflictOperationKey,
  confirmReloadDiskVersion,
  copyOfDraft,
  describeEditSave,
  describeWholeDocumentSave,
  draftFieldStatusKey,
  invalidationFailureMessage,
  outcomeReveal,
  reapplyIsOffered,
  reapplyReadinessKey,
  referenceCopyOf,
  reloadDiskVersion,
  reloadUnavailableKey,
  saveOutcomeMessageKey,
  type ConflictCapabilities,
  type ConflictChoice,
  type ConflictDraftKind,
  type ConflictModel,
  type ConflictOperation,
  type DraftFieldStatus,
  type OutcomeArm,
  type RetainedDraftField,
  type SaveOutcomeMessage
} from './saveOutcome';
import { draftKindWording } from './draftKind';

// The six surfaces' own declarations, imported under names that say which is
// which. **The consult's Q3/Q4 rule lands in six places and is checked in one**:
// nothing but a test can compare them, because each is private to the model that
// draws from it and no type relates them to each other.
import { CONFLICT_CAPABILITIES as CREATOR } from './matchCreation';
import { CONFLICT_CAPABILITIES as DELETER } from './matchDeletion';
import { CONFLICT_CAPABILITIES as DUPLICATOR } from './matchDuplication';
import { CONFLICT_CAPABILITIES as MATCH_EDITOR } from './matchEditor';
import { CONFLICT_CAPABILITIES as MOVER } from './matchMove';
import { CONFLICT_CAPABILITIES as RAW_EDITOR } from './rawEditor';
import { CONFLICT_CAPABILITIES as RESTORE } from './restore';

/**
 * Every member of {@link ConflictChoice}, and **exhaustively** so.
 *
 * A union has no run-time extent, so the members have to be written out — and the
 * 2c-4a-2 review was right that `readonly ConflictChoice[]` does not make that
 * list complete: a fifth member leaves a four-element array compiling perfectly.
 * A `Record<ConflictChoice, true>` does not. Adding a member without adding a key
 * here is a compile error in this file, which is what the two cases below need in
 * order to say *every*.
 */
const EVERY_CONFLICT_CHOICE = Object.keys({
  keepEditing: true,
  copyDraft: true,
  keepMyDraft: true,
  reloadDiskVersion: true,
  confirmReload: true,
  // The sixth, added at 2c-5-4b for the one surface whose confirmed reload keeps
  // what it is holding. **This list is what failed when the member was added**,
  // which is the whole reason it is a `Record` rather than an array.
  confirmReloadKeeping: true
} satisfies Record<ConflictChoice, true>) as readonly ConflictChoice[];

/**
 * Every draft kind a label can be asked for, by the same construction.
 *
 * `conflictChoiceKey` takes one since 2c-4a-3b, because `confirmReload`'s label
 * says what is discarded and the three `operationChoice` surfaces discard no
 * text. A case that said *every choice* while asking for one kind would say half
 * of it.
 */
const EVERY_DRAFT_KIND = Object.keys({
  authoredText: true,
  operationChoice: true
} satisfies Record<ConflictDraftKind, true>) as readonly ConflictDraftKind[];

/** Every label a conflict panel can put on a control, over both draft kinds. */
const EVERY_CONFLICT_LABEL: readonly TranslationKey[] = [
  ...new Set(
    EVERY_CONFLICT_CHOICE.flatMap((choice) =>
      EVERY_DRAFT_KIND.map((draftKind) => conflictChoiceKey(choice, draftKind))
    )
  )
];

/** The revision a save was based on. */
const BASE: ContentRevision = 'a'.repeat(64);

/** The revision the file holds after it. */
const AFTER: ContentRevision = 'b'.repeat(64);

/** A third revision, for the file that changed twice. */
const AGAIN: ContentRevision = 'c'.repeat(64);

/** What {@link savedWith} may override. */
interface SavedOverrides {
  /** Whether the file was really rewritten. */
  readonly committed?: boolean;
  /** Whether a pre-save copy was taken. */
  readonly backupTaken?: boolean;
  /** The presentation changes the save had to make. */
  readonly notes?: readonly PresentationNote[];
}

/**
 * A save that ran to the end, in the whole-document shape a seal produces.
 *
 * @param overrides - Whatever the case cares about.
 * @returns The narrowed `saved` outcome, whose `moved` is `null` by type.
 */
function savedWith(overrides: SavedOverrides = {}): WholeDocumentSaved {
  return {
    outcome: 'saved',
    revision: AFTER,
    committed: overrides.committed ?? true,
    notes: overrides.notes ?? [],
    backup_taken: overrides.backupTaken ?? false,
    moved: null
  };
} // End of function savedWith()

/**
 * The same save as the wire writes it, for the edit describer.
 *
 * @param overrides - Whatever the case cares about.
 * @returns The `saved` outcome, with `moved` as the wire types it.
 */
function wireSaved(overrides: SavedOverrides = {}): SavedResult {
  return savedWith(overrides);
} // End of function wireSaved()

/** A parse rejection, which only a whole-document replacement can produce. */
const REJECTION: Finding = {
  code: {
    DocumentDoesNotParse: {
      revision: AFTER,
      line: 4,
      column: 3,
      byte_index: 40,
      detail: 'mapping values are not allowed in this context'
    }
  },
  span: null,
  node: null,
  path: null
};

/** A finding the semantic rules raise. */
const ORDINARY: Finding = {
  code: { ReferenceHasNoDeclaration: { name: 'who' } },
  span: null,
  node: null,
  path: null
};

/**
 * A refusal carrying the findings given.
 *
 * @param findings - What the gate reported.
 * @param verdict - Which arm refused; the acknowledgeable one by default.
 * @returns The `refused` outcome as it crosses the boundary.
 */
function refusedWith(
  findings: readonly Finding[],
  verdict: RefusedResult['verdict'] = 'RefusedForUnacknowledgedSuspicions'
): RefusedResult {
  return { outcome: 'refused', verdict, findings };
} // End of function refusedWith()

/**
 * The disk side's whole file text, with three bytes a normaliser would change.
 *
 * A leading BOM, one CRLF among bare LFs, and no final newline: written with
 * `\u{feff}` and explicit escapes so that saving this source file cannot make the
 * fixture agree with a boundary that normalises.
 */
const DISK_TEXT = '\u{feff}# theirs\r\nmatches:\n  - trigger: x\n    replace: theirs';

/**
 * A save the file had moved on under.
 *
 * @param diskRevision - What the read taken after the refusal found; the same
 *   bytes the lock saw, unless the case is about a file that changed twice.
 * @returns The `conflict` outcome as it crosses the boundary.
 */
function conflictWith(diskRevision: ContentRevision = AFTER): ConflictResult {
  return {
    outcome: 'conflict',
    reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
    expected: BASE,
    found: AFTER,
    disk_revision: diskRevision,
    disk_text: DISK_TEXT,
    disk: makeDocument({ id: 3, revision: diskRevision })
  };
} // End of function conflictWith()

/** The draft every case here was saving: edited, and therefore dirty. */
function draftInHand(): Draft<string> {
  return editDraft(startDraft(BASE, 'matches:\n', textDraftRules), 'matches:\n  - trigger: x\n');
} // End of function draftInHand()

/**
 * The conflict model, narrowed, for the cases that are about it.
 *
 * @param diskRevision - What the read after the refusal found.
 * @param draft - The draft the save was made from.
 * @param surface - Whose declaration decides which reload sentence the model
 *   carries. The raw editor's by default, because that is the surface
 *   `describeWholeDocumentSave` belongs to.
 * @returns The conflict arm.
 */
function conflictModel(
  diskRevision: ContentRevision = AFTER,
  draft: Draft<string> = draftInHand(),
  surface: ConflictCapabilities = RAW_EDITOR
): ConflictModel<string> {
  const model = describeWholeDocumentSave(conflictWith(diskRevision), draft, surface);
  if (model.kind !== 'conflict') {
    throw new Error('the conflict arm is what this case is about');
  }
  return model;
} // End of function conflictModel()

describe('a save that ran to the end', () => {
  it('says the file was written, and discloses a backup without promising one', () => {
    const model = describeWholeDocumentSave(savedWith({ backupTaken: true }), draftInHand(), RAW_EDITOR);
    expect(model.kind).toBe('saved');
    expect(model).toMatchObject({ committed: true, backupTaken: true, revision: AFTER });
    expect(model.messages).toEqual([{ kind: 'fileWritten' }, { kind: 'backupTaken' }]);
  });

  it('treats "nothing to write" as a success with its own sentence', () => {
    // `committed: false` is a documented success: a candidate byte-identical to
    // what the file already held is not written, because replacing a file drops
    // metadata and buys nothing. A model that only said "written" or said nothing
    // would present that as a failure or as silence.
    const model = describeWholeDocumentSave(savedWith({ committed: false }), draftInHand(), RAW_EDITOR);
    expect(model).toMatchObject({ kind: 'saved', committed: false });
    expect(model.messages).toEqual([{ kind: 'nothingToWrite' }]);
  });

  it('carries every presentation note rather than summarising them', () => {
    // Plan section 6.2 — never silently normalise. A note dropped here is a
    // normalisation made silent, which is the failure the whole `notes` channel
    // exists to prevent.
    const notes: readonly PresentationNote[] = [
      { ScalarRestyled: { edit: 0, from: 'Plain', to: 'DoubleQuoted', reason: 'MixedLineBreaks' } },
      { DoubledSequenceSeparation: { edit: 1 } }
    ];
    const model = describeEditSave(wireSaved({ notes }), draftInHand(), MATCH_EDITOR);
    expect(model).toMatchObject({ kind: 'saved' });
    if (model.kind !== 'saved') {
      return;
    }
    expect(model.notes).toEqual(notes);
  }); // End of the "carries every presentation note" case

  it('reads the same from either describer', () => {
    expect(describeEditSave(wireSaved(), draftInHand(), MATCH_EDITOR)).toEqual(
      describeWholeDocumentSave(savedWith(), draftInHand(), RAW_EDITOR)
    );
  });
}); // End of the "save that ran to the end" suite

describe('a save the semantic gate refused', () => {
  it('states that nothing was written, and hands every finding back', () => {
    // The gate matches an acknowledgement against the candidate's suspicions as
    // an **exact multiset**, so a subset is simply a second refusal — and there
    // is no `force` flag on this wire.
    const refusal = refusedWith([REJECTION, ORDINARY]);
    const model = describeWholeDocumentSave(refusal, draftInHand(), RAW_EDITOR);
    expect(model.kind).toBe('refused');
    if (model.kind !== 'refused') {
      return;
    }
    expect(model.messages).toEqual([{ kind: 'nothingWasWritten' }]);
    expect(model.findings).toEqual([REJECTION, ORDINARY]);
    expect(model.acknowledgement).toEqual({ accepted: [REJECTION, ORDINARY] });
    expect(model.choices).toEqual(['saveAnyway', 'keepEditing']);
    // The refusal itself is carried, because `acknowledgeRefusal` in `./draft`
    // records consent from the refusal and the submission together and never
    // from a bare acknowledgement a caller chose.
    expect(model.refusal).toBe(refusal);
  }); // End of the "states that nothing was written" case

  it('withholds the offer from a verdict no acknowledgement can move', () => {
    const model = describeEditSave(
      refusedWith([ORDINARY], 'RefusedForEditorModelErrors'),
      draftInHand(),
      MATCH_EDITOR
    );
    expect(model).toMatchObject({
      kind: 'refused',
      acknowledgement: null,
      choices: ['keepEditing']
    });
  });

  it('delegates the parse rejection to the raw-save model instead of re-deriving it', () => {
    // `rawSave.ts` already models the owner's ruling — the sentence about espanso
    // not loading the file, the parser's position when it has one, and the choice
    // — and this arm carries that model rather than a second copy of it.
    const model = describeWholeDocumentSave(refusedWith([REJECTION]), draftInHand(), RAW_EDITOR);
    expect(model.kind).toBe('refused');
    if (model.kind !== 'refused') {
      return;
    }
    expect(model.rawSave?.messages).toEqual([
      { kind: 'replacesWholeDocument' },
      { kind: 'willNotLoad' },
      { kind: 'stoppedAt', line: 4, column: 3 }
    ]);
    expect(model.rawSave?.unparseable?.finding).toBe(REJECTION);
  }); // End of the "delegates the parse rejection" case

  it('says nothing about replacing the whole document for an edit save', () => {
    // `describeRawSave`'s first line is *this replaces the entire document*, and
    // that is false of a field edit. The scope is not a caller's word any more:
    // this is a different function, and the other one cannot be reached without
    // an outcome that came out of a seal.
    const model = describeEditSave(refusedWith([ORDINARY]), draftInHand(), MATCH_EDITOR);
    expect(model).toMatchObject({ kind: 'refused', rawSave: null });
  });
}); // End of the "save the semantic gate refused" suite

describe('a conflict, which is terminal and honest', () => {
  it('states that nothing was written and carries the draft itself', () => {
    // Not `draftKept: true`. The review was right that a literal makes a
    // dishonest value harder to build and not impossible; the retained draft is
    // the guarantee, because there is nothing else to put in the field.
    const draft = draftInHand();
    const model = conflictModel(AFTER, draft);
    expect(model.messages).toEqual([
      { kind: 'nothingWasWritten' },
      { kind: 'changedElsewhere' },
      { kind: 'draftKeptInMemory' },
      { kind: 'reloadDiscardsDraft' }
    ]);
    expect(model.draft).toBe(draft);
    expect(model.draft.value).toBe('matches:\n  - trigger: x\n');
    expect(copyOfDraft(model)).toBe(draft.value);
  }); // End of the "states that nothing was written" case

  it('warns about the reload the calling surface actually performs', () => {
    // **The 2c-4a-3a review's finding 2.** *Loading the version on disk replaces
    // your text with it* is what the raw editor does; a match surface installs the
    // disk projection and **closes**, loading nothing in the draft's place — so the
    // shared sentence was a false statement on five of the six panels, and it
    // contradicted the confirmation sentence beside it. The surface's own
    // `reloadOutcome` decides, in this module, and not in six markup files.
    expect(conflictModel(AFTER, draftInHand(), RAW_EDITOR).messages).toContainEqual({
      kind: 'reloadDiscardsDraft'
    });
    for (const surface of [MATCH_EDITOR, CREATOR]) {
      const messages = describeEditSave(conflictWith(), draftInHand(), surface).messages;
      expect(messages).toContainEqual({ kind: 'reloadClosesSurface' });
      expect(messages).not.toContainEqual({ kind: 'reloadDiscardsDraft' });
    } // End of the loop over the two authored-text match surfaces
    // **The third arm, and 2c-4a-3b's verification of `reloadOutcome` is why.**
    // `reloadClosesSurface` ends *copy it first if you want to keep it*, which is
    // an instruction with no control behind it on the three surfaces where consult
    // Q4 refuses a copy as a property of the drafted value. The pair
    // `closesSurface` + `operationChoice` gets its own sentence, and neither of the
    // other two reaches those panels.
    for (const surface of [MOVER, DELETER, DUPLICATOR]) {
      const messages = describeEditSave(conflictWith(), draftInHand(), surface).messages;
      expect(messages).toContainEqual({ kind: 'reloadAbandonsOperation' });
      expect(messages).not.toContainEqual({ kind: 'reloadClosesSurface' });
      expect(messages).not.toContainEqual({ kind: 'reloadDiscardsDraft' });
      // And what was retained is described as an operation, never as text.
      expect(messages).toContainEqual({ kind: 'operationKeptInMemory' });
      expect(messages).not.toContainEqual({ kind: 'draftKeptInMemory' });
    } // End of the loop over the three operation-choice surfaces
    // **The fourth arm, added at 2c-5-3 for restore.** Its candidate is the exact
    // text read from a backup entry, which the conflict never touched and the
    // adoption has no reason to discard, so the panel neither reseeds a draft
    // nobody typed nor
    // closes over something it can keep: what moves is the revision the candidate
    // would be written against. All three of the older sentences would have been
    // false statements here, and before this arm existed `reloadWarningFor`'s
    // fall-through tail would have handed it one of them silently.
    const RESTORE: ConflictCapabilities = {
      draftKind: 'operationChoice',
      reloadOutcome: 'retargetsCandidate',
      offersCopyDraft: false,
      offersReload: false,
      offersReapply: false,
      reapplySupport: 'unavailable'
    };
    const restoreMessages = describeEditSave(conflictWith(), draftInHand(), RESTORE).messages;
    expect(restoreMessages).toContainEqual({ kind: 'reloadRetargetsCandidate' });
    expect(restoreMessages).not.toContainEqual({ kind: 'reloadDiscardsDraft' });
    expect(restoreMessages).not.toContainEqual({ kind: 'reloadClosesSurface' });
    expect(restoreMessages).not.toContainEqual({ kind: 'reloadAbandonsOperation' });
    // And the six declarations are what that rests on: one surface reseeds, five
    // close, and a surface cannot omit the field.
    expect(RAW_EDITOR.reloadOutcome).toBe('reseedsDraft');
    for (const surface of [MATCH_EDITOR, CREATOR, MOVER, DELETER, DUPLICATOR]) {
      expect(surface.reloadOutcome).toBe('closesSurface');
    } // End of the loop over the five match declarations
  }); // End of the "surface-aware reload warning" case

  it('carries no choices of its own, so there is one authority and not two', () => {
    // **The consult's Q9 item 1, as the assertion that would have caught it.**
    // `describeConflict` used to install a global three-choice array on every
    // model while all five match models ignored it and exported a local
    // `['keepEditing']`. A field nobody reads is not a default, it is a second
    // answer — and it is why a newly offered button could compile and do nothing.
    const model = conflictModel();
    expect(model).not.toHaveProperty('choices');
    expect(model).not.toHaveProperty('acknowledgement');
  }); // End of the "no second authority" case

  it('reloads only through a confirmation issued for that conflict', () => {
    // A boolean saying a confirmation is needed is not a confirmation. This is
    // two calls with a token between them, and the token is checked.
    const model = conflictModel();
    const confirmation = confirmReloadDiskVersion(model);
    const reloaded = reloadDiskVersion(model, confirmation, AFTER, 'what the disk holds');
    expect(reloaded?.value).toBe('what the disk holds');
    expect(reloaded?.baseRevision).toBe(AFTER);
    expect(reloaded?.past).toEqual([]);
    // And the conflict's own draft is untouched, because every transition here
    // returns a new value.
    expect(model.draft.value).toBe('matches:\n  - trigger: x\n');
  }); // End of the "reloads only through a confirmation" case

  it('refuses a confirmation collected for a different conflict', () => {
    // So that a screen cannot collect one answer and spend it on another
    // question — which, here, would discard a draft nobody was asked about.
    const first = conflictModel();
    const second = conflictModel(AGAIN);
    expect(reloadDiskVersion(second, confirmReloadDiskVersion(first), AFTER, 'disk')).toBeNull();
  });

  it('shows enough to tell the disk version from the draft', () => {
    expect(conflictModel()).toMatchObject({
      expected: BASE,
      found: AFTER,
      diskRevision: AFTER,
      changedAgain: false
    });
  });

  it('carries the whole disk-side text through byte for byte', () => {
    // 2c-4a-1's whole point on this side: `describeConflict` copies the text it
    // was given and never rebuilds it from the projection, so the three bytes a
    // normaliser would change survive. Asserted on the value rather than on its
    // length, because a stripped BOM and a converted CRLF both keep the shape.
    const model = conflictModel();
    expect(model.diskText).toBe(DISK_TEXT);
    expect(model.diskText.startsWith('\u{feff}')).toBe(true);
    expect(model.diskText).toContain('\r\n');
    expect(model.diskText.endsWith('\n')).toBe(false);
  }); // End of the "carries the disk side's whole text" case

  it('carries the text of the later read when the file changed twice', () => {
    // The honesty rule applied to the text: `disk_text` describes the bytes at
    // `disk_revision`, never the bytes at `found` that refused the save. The
    // model can only be as honest as what it was handed, and what this pins is
    // that it hands it on unchanged rather than pairing it with `found`.
    const model = conflictModel(AGAIN);
    expect(model.diskText).toBe(DISK_TEXT);
    expect(model.diskRevision).toBe(AGAIN);
    expect(model.changedAgain).toBe(true);
  }); // End of the "carries the text of the later read" case

  it('keeps two observations apart when the file changed again', () => {
    // `found` is what the locked read saw and `disk_revision` is a fresh read
    // taken afterwards. They are usually equal and need not be; presenting them
    // as descriptions of the same bytes would be a false statement.
    const model = conflictModel(AGAIN);
    expect(model).toMatchObject({ changedAgain: true, diskRevision: AGAIN });
    expect(model.messages).toContainEqual({ kind: 'changedAgainSinceRefusal' });
  });

  it('says "keep my draft" on the reapply control and on no other', () => {
    // **This case is the inverse of the one it replaces, and the inversion is the
    // record of the phase.** Until 2c-4b-3 the phrase named nothing this
    // application could do, so no label was allowed to use it: it means *reapply
    // the draft to the newly parsed document*, and using it for the weaker
    // behaviour would have made 2c-4b look already-done. The operation now exists,
    // so exactly one choice may wear the words — and every other label must still
    // not, for the same reason it never could.
    const reapply = new Set<TranslationKey>(
      EVERY_DRAFT_KIND.map((draftKind) => conflictChoiceKey('keepMyDraft', draftKind))
    );
    for (const key of EVERY_CONFLICT_LABEL) {
      if (reapply.has(key)) {
        continue;
      }
      for (const locale of LOCALES) {
        const label = DICTIONARIES[locale][key].toLowerCase();
        expect(label, `${locale}:${key}`).not.toContain('keep my draft');
        expect(label, `${locale}:${key}`).not.toContain('conservar mi borrador');
      } // End of the loop over the two locales
    } // End of the loop over every label that is not the reapply's
    // And the check is only evidence if it can fire: the authored-text label is
    // exactly what it would reject anywhere else.
    expect(DICTIONARIES.en[conflictChoiceKey('keepMyDraft', 'authoredText')].toLowerCase()).toContain(
      'keep my draft'
    );
    expect(DICTIONARIES.es[conflictChoiceKey('keepMyDraft', 'authoredText')].toLowerCase()).toContain(
      'conservar mi borrador'
    );
  }); // End of the "names the reapply control" case
}); // End of the "conflict" suite

describe('the one authority that decides what a conflict offers', () => {
  /**
   * A capability record, with every field overridable.
   *
   * @param over - What this case is about.
   * @returns The capabilities.
   */
  function capabilities(over: Partial<ConflictCapabilities> = {}): ConflictCapabilities {
    return {
      draftKind: 'authoredText',
      reloadOutcome: 'reseedsDraft',
      offersCopyDraft: true,
      offersReload: true,
      // The raw editor's own two values, because that is the surface these
      // defaults describe: it declares the reapply and it declares that one can
      // never be had here. `conflictChoicesFor` reads **both**, and the cases below
      // drive each of the four combinations rather than assuming any of them.
      offersReapply: false,
      reapplySupport: 'unavailable',
      ...over
    };
  } // End of function capabilities()

  it('always offers the non-destructive way out, first', () => {
    for (const draftKind of ['authoredText', 'operationChoice'] as const) {
      for (const offersCopyDraft of [true, false]) {
        for (const offersReload of [true, false]) {
          for (const step of ['idle', 'confirming'] as const) {
            const offered = conflictChoicesFor(
              capabilities({ draftKind, offersCopyDraft, offersReload }),
              step
            );
            expect(offered[0], `${draftKind}/${step}`).toBe('keepEditing');
          }
        } // End of the loop over the reload capability
      } // End of the loop over the copy capability
    } // End of the loop over the two kinds of draft
  }); // End of the "keep editing is always first" case

  it('puts the copy before the destructive choice, and never both reload labels', () => {
    const first = conflictChoicesFor(capabilities(), 'idle');
    expect(first).toEqual(['keepEditing', 'copyDraft', 'reloadDiskVersion']);
    const second = conflictChoicesFor(capabilities(), 'confirming');
    expect(second).toEqual(['keepEditing', 'copyDraft', 'confirmReload']);
    // The destructive one is never nearest to hand, and the copy is what makes
    // the destruction survivable — so it is still offered at the second step.
    expect(second.indexOf('copyDraft')).toBeLessThan(second.indexOf('confirmReload'));
    expect(first).not.toContain('confirmReload');
    expect(second).not.toContain('reloadDiskVersion');
  }); // End of the "ordering and the two steps" case

  it('names no reload label once a spend has been refused, and keeps the other two', () => {
    // **The 2c-4a-3a review's finding 3.** `BrowserState.adoptDiskVersion` refuses
    // for one of its own ordered reasons — a confirmation issued for another
    // conflict, one already spent, a conflict this window never produced, an
    // unprojected document, or a projection replaced since the conflict arrived
    // when the window does not already hold the requested revision — and says which
    // through nothing but the answer, so leaving *Confirm reload* on screen offered
    // a control that had just been refused without a word. Withholding it claims
    // nothing about how a later ask would be answered. The non-destructive way out
    // and the copy stay; the surface says why the third has gone.
    expect(conflictChoicesFor(capabilities(), 'unavailable')).toEqual([
      'keepEditing',
      'copyDraft'
    ]);
    expect(
      conflictChoicesFor(capabilities({ offersCopyDraft: false }), 'unavailable')
    ).toEqual(['keepEditing']);
    // And a surface that offers no reload at all is unchanged by the step.
    expect(conflictChoicesFor(capabilities({ offersReload: false }), 'unavailable')).toEqual(
      conflictChoicesFor(capabilities({ offersReload: false }), 'idle')
    );
  }); // End of the "refused spend offers no reload" case

  it('refuses a copy of a draft a clipboard cannot preserve, whatever the caller says', () => {
    // **The consult's Q4 rule, enforced against the value rather than trusted of
    // the caller.** A `MovePlacement` is a positional choice and a `MatchId` is a
    // protocol carrier; copying either preserves nothing while looking like it
    // preserved something. A surface that set `offersCopyDraft` beside
    // `operationChoice` still gets no copy control.
    expect(
      conflictChoicesFor(capabilities({ draftKind: 'operationChoice' }), 'idle')
    ).toEqual(['keepEditing', 'reloadDiskVersion']);
    expect(
      conflictChoicesFor(
        capabilities({ draftKind: 'operationChoice', offersReload: false }),
        'confirming'
      )
    ).toEqual(['keepEditing']);
  }); // End of the "copy refused for an operation choice" case

  it('offers nothing but keeping editing to a surface that declares neither', () => {
    // Which is what the five match models declare in 2c-4a-2 — **and the reason is
    // not that their arms are missing**: their reload transitions exist and their
    // components call them. What is withheld is the *offering*, because a model
    // that names a choice draws a control, and 2c-4a-3 is where that is drawn.
    const unoffered = capabilities({ offersCopyDraft: false, offersReload: false });
    expect(conflictChoicesFor(unoffered, 'idle')).toEqual(['keepEditing']);
    expect(conflictChoicesFor(unoffered, 'confirming')).toEqual(['keepEditing']);
  });

  it('puts the reapply after the copy and before the reload', () => {
    // **The consult's Q6 order, read literally.** It writes nothing, discards
    // nothing and asks no second question, so it belongs above the choice that
    // abandons the draft — and below the copy that makes abandoning it survivable.
    const offered = conflictChoicesFor(
      capabilities({ offersReapply: true, reapplySupport: 'supported' }),
      'idle'
    );
    expect(offered).toEqual(['keepEditing', 'copyDraft', 'keepMyDraft', 'reloadDiskVersion']);
    expect(
      conflictChoicesFor(
        capabilities({ offersReapply: true, reapplySupport: 'supported' }),
        'confirming'
      )
    ).toEqual(['keepEditing', 'copyDraft', 'keepMyDraft', 'confirmReload']);
  }); // End of the "reapply ordering" case

  it('names the reapply only when both the boolean and the permanent fact allow it', () => {
    // **Two conditions and neither is decoration.** `offersReapply` is what the
    // surface draws today; `reapplySupport` is whether an honest reapply could ever
    // be had here. Either alone offers nothing, which is what stops a surface
    // declaring its way past the consult's Q4 ruling on the raw editor.
    for (const offersReapply of [true, false]) {
      for (const reapplySupport of ['supported', 'unavailable'] as const) {
        const offered = conflictChoicesFor(
          capabilities({ offersReapply, reapplySupport }),
          'idle'
        );
        expect(offered.includes('keepMyDraft'), `${String(offersReapply)}/${reapplySupport}`).toBe(
          offersReapply && reapplySupport === 'supported'
        );
      } // End of the loop over the permanent fact
    } // End of the loop over the boolean
  }); // End of the "two gates" case

  it('offers the reapply whatever the reload step is, including a refused spend', () => {
    // **Deliberately not gated on the reload's step**, which records that a
    // *reload* spend was refused. A reapply is a different question with a
    // different authorization, and a person who presses it in that state is
    // answered by the honest `adoptionRefused` sentence rather than by a control
    // that vanished without a word.
    const surface = capabilities({ offersReapply: true, reapplySupport: 'supported' });
    for (const step of ['idle', 'confirming', 'unavailable'] as const) {
      expect(conflictChoicesFor(surface, step).includes('keepMyDraft'), step).toBe(true);
    } // End of the loop over the three reload steps
    // And the reload's own rule is untouched by that.
    expect(conflictChoicesFor(surface, 'unavailable')).toEqual(['keepEditing', 'copyDraft', 'keepMyDraft']);
  }); // End of the "reapply is not the reload's step" case

  it('never offers the reapply to the raw editor, whatever it declares', () => {
    // **The one surface the consult's Q4 rules out for ever.** Its candidate is a
    // whole document, so there is no target, no field intent and no operation to
    // re-resolve — and this is the assertion that keeps a later `offersReapply:
    // true` from putting a control over `rawEditor.reapplyToDiskVersion`, which
    // takes no adoption function at all and answers `unavailable` before it looks
    // at any evidence.
    expect(RAW_EDITOR.reapplySupport).toBe('unavailable');
    expect(RAW_EDITOR.offersReapply).toBe(false);
    for (const step of ['idle', 'confirming', 'unavailable'] as const) {
      expect(conflictChoicesFor(RAW_EDITOR, step), step).not.toContain('keepMyDraft');
      expect(
        conflictChoicesFor({ ...RAW_EDITOR, offersReapply: true }, step),
        step
      ).not.toContain('keepMyDraft');
    } // End of the loop over the three reload steps
    // And the five match surfaces declare both halves, which is what makes the
    // sentence above about the raw editor rather than about nobody.
    for (const surface of [MATCH_EDITOR, CREATOR, MOVER, DELETER, DUPLICATOR]) {
      expect(surface.reapplySupport).toBe('supported');
      expect(surface.offersReapply).toBe(true);
      expect(conflictChoicesFor(surface, 'idle')).toContain('keepMyDraft');
    } // End of the loop over the five match declarations
  }); // End of the "raw never offers it" case

  it('answers whether a produced list names the reapply, and reads no declaration', () => {
    // The predicate every panel's `reapplyOffered` goes through, so the readiness
    // sentence and the control cannot disagree: it is given the list, not the
    // surface, and there is nothing in it to consult a second authority with.
    expect(reapplyIsOffered(conflictChoicesFor(DELETER, 'idle'))).toBe(true);
    expect(reapplyIsOffered(conflictChoicesFor(RAW_EDITOR, 'idle'))).toBe(false);
    expect(reapplyIsOffered([])).toBe(false);
  });

  it('gives the readiness line one sentence per draft kind, in both languages', () => {
    // **What no test here can hold**: that either sentence *says* what the
    // consult's Q6 requires — that this app will only try, that it works from the
    // newly parsed document, that nothing is written when a match cannot be made
    // safely, that a safe match promises *no* particular ending, and that a later
    // save may still be refused or conflict. The fourth of those is the 2c-4b-3a
    // review's High: `alreadySatisfied` is a successful arm with nothing to send,
    // so a sentence promising a form outright is false. The i18n suites check keys
    // and placeholders, never meaning. What is held is that the two keys are
    // different and that each kind reaches its own.
    const authored = reapplyReadinessKey('authoredText');
    const operation = reapplyReadinessKey('operationChoice');
    expect(authored).not.toBe(operation);
    for (const key of [authored, operation]) {
      for (const locale of LOCALES) {
        expect(DICTIONARIES[locale][key].length, `${locale}:${key}`).toBeGreaterThan(0);
      } // End of the loop over the two locales
    } // End of the loop over the two sentences
    // And the operation-choice sentence does not call a placement or an identity
    // *text*, which is 2c-4a-3b's finding applied to the sentence this step adds
    // rather than rediscovered on a screen later. A word check, not a meaning
    // check: only a person can say whether the replacement reads well.
    for (const locale of LOCALES) {
      const sentence = DICTIONARIES[locale][operation].toLowerCase();
      expect(sentence, locale).not.toContain('you typed');
      expect(sentence, locale).not.toContain('your text');
      expect(sentence, locale).not.toContain('su texto');
      expect(sentence, locale).not.toContain('ha escrito');
    } // End of the loop over the two locales
  }); // End of the "readiness line" case

  it('labels the reapply by what the surface drafts too', () => {
    // The third branch on the draft kind, and the same rule as `keepEditing`'s and
    // `confirmReload`'s: *my draft* names text on the three authored-text
    // surfaces, and nobody typed anything on the other three.
    expect(conflictChoiceKey('keepMyDraft', 'authoredText')).toBe(
      'browser.saveOutcome.choice.keepMyDraft'
    );
    expect(conflictChoiceKey('keepMyDraft', 'operationChoice')).toBe(
      'browser.saveOutcome.choice.keepMyRequest'
    );
    expect(conflictChoiceKey('keepMyDraft', 'authoredText')).not.toBe(
      conflictChoiceKey('keepMyDraft', 'operationChoice')
    );
    for (const locale of LOCALES) {
      const label = DICTIONARIES[locale][
        conflictChoiceKey('keepMyDraft', 'operationChoice')
      ].toLowerCase();
      expect(label, locale).not.toContain('draft');
      expect(label, locale).not.toContain('borrador');
    } // End of the loop over the two locales
  }); // End of the "reapply label" case

  it('gives every choice it can name a sentence in both languages', () => {
    for (const key of EVERY_CONFLICT_LABEL) {
      for (const locale of LOCALES) {
        expect(DICTIONARIES[locale][key].length, `${locale}:${key}`).toBeGreaterThan(0);
      }
    } // End of the loop over every label, over both draft kinds
  });

  it('labels the confirmation by what the surface drafts, and never by its name', () => {
    // **2c-4a-3b's verification of the labels the three new panels draw.** *Discard
    // my text and load it* is what the confirmation does where the draft is
    // authored text; on the mover, the deleter and the duplicator nobody typed
    // anything, and a label claiming otherwise is this project's worst defect class
    // on a control that had never been drawn there before.
    expect(conflictChoiceKey('confirmReload', 'authoredText')).toBe(
      'browser.saveOutcome.choice.confirmReload'
    );
    expect(conflictChoiceKey('confirmReload', 'operationChoice')).toBe(
      'browser.saveOutcome.choice.confirmReloadClosing'
    );
    // The other two say the same thing either way, so they have one label.
    // **`keepEditing` used to be in this list and is not**, which is 2c-4a-3c's
    // finding 10.2: see the case below.
    for (const choice of ['copyDraft', 'reloadDiskVersion'] as const) {
      expect(conflictChoiceKey(choice, 'authoredText'), choice).toBe(
        conflictChoiceKey(choice, 'operationChoice')
      );
    } // End of the loop over the draft-kind-neutral choices
    // And no `operationChoice` label claims text, in either language.
    for (const locale of LOCALES) {
      const label = DICTIONARIES[locale][
        conflictChoiceKey('confirmReload', 'operationChoice')
      ].toLowerCase();
      expect(label, locale).not.toContain('my text');
      expect(label, locale).not.toContain('mi texto');
    } // End of the loop over the two locales
  }); // End of the "labels the confirmation" case

  it('gives a surface whose reload keeps its candidate a confirmation of its own', () => {
    // **2c-5-4b.** Restore's reload installs the disk observation, keeps the
    // retained candidate and leaves the panel open, so *Discard my text and load
    // it* and *Close this and load it* are both false of it — and a false label on
    // the destructive step of a whole-file replacement is this project's worst
    // defect class on the worst control to have it on. The choice is picked from
    // the surface's declared `reloadOutcome`, in the one authority.
    expect(conflictChoicesFor(RESTORE, 'confirming')).toEqual([
      'keepEditing',
      'confirmReloadKeeping'
    ]);
    expect(conflictChoicesFor(RESTORE, 'idle')).toEqual(['keepEditing', 'reloadDiskVersion']);
    // The five surfaces whose reload discards or closes are untouched by it.
    for (const surface of [RAW_EDITOR, MATCH_EDITOR, CREATOR, MOVER, DELETER, DUPLICATOR]) {
      expect(conflictChoicesFor(surface, 'confirming')).toContain('confirmReload');
      expect(conflictChoicesFor(surface, 'confirming')).not.toContain('confirmReloadKeeping');
    } // End of the loop over the five surfaces that discard or close
    // One label, whatever the draft is: the sentence is about what the reload
    // does, so there is no second wording for a draft kind to pick between.
    expect(conflictChoiceKey('confirmReloadKeeping', 'authoredText')).toBe(
      conflictChoiceKey('confirmReloadKeeping', 'operationChoice')
    );
    // And it claims neither of the two things the other confirmations claim.
    for (const locale of LOCALES) {
      const label =
        DICTIONARIES[locale][conflictChoiceKey('confirmReloadKeeping', 'operationChoice')];
      const lowered = label.toLowerCase();
      for (const claimed of ['discard', 'close this', 'descartar', 'cerrar']) {
        expect(lowered, `${locale}:${claimed}`).not.toContain(claimed);
      } // End of the loop over the claims this label must not make
    } // End of the loop over the two locales
  }); // End of the "a confirmation of its own" case

  it('labels the non-destructive way out by what the surface drafts too', () => {
    // **2c-4a-3c's finding 10.2, and it was found by a window and by nothing
    // else.** `conflictChoiceKey` branched `confirmReload` on the draft kind at
    // 2c-4a-3b and left `keepEditing` returning the raw editor's own label
    // unconditionally, so the deleter, the mover and the duplicator drew *Keep
    // editing* / *Seguir editando* beside a panel about a deletion, a move and a
    // copy — an activity the person never started. It is the narrower instance of
    // the finding 3b closed for the *sentences* on those three exact surfaces.
    expect(conflictChoiceKey('keepEditing', 'authoredText')).toBe(
      'browser.rawSave.choice.keepEditing'
    );
    expect(conflictChoiceKey('keepEditing', 'operationChoice')).toBe(
      'browser.saveOutcome.choice.keepOperation'
    );
    // Two keys, not one wearing two names: a "fix" that pointed both at the same
    // key would satisfy every other assertion in this file.
    expect(conflictChoiceKey('keepEditing', 'authoredText')).not.toBe(
      conflictChoiceKey('keepEditing', 'operationChoice')
    );
    // And the `operationChoice` label does not claim an activity nobody started,
    // in either language. **This is a word check and not a meaning check**: it
    // fires on the exact defect the reading found — the word *editing* on a panel
    // where nothing is being edited — and says nothing about whether the
    // replacement reads well. Only a person can say that (`CLAUDE.md` section 6).
    for (const locale of LOCALES) {
      const label = DICTIONARIES[locale][
        conflictChoiceKey('keepEditing', 'operationChoice')
      ].toLowerCase();
      expect(label, locale).not.toContain('editing');
      expect(label, locale).not.toContain('editando');
      expect(label, locale).not.toContain('editar');
    } // End of the loop over the two locales
    // The check above is only evidence if it is capable of firing: the label the
    // three surfaces used to draw is exactly what it must reject.
    for (const locale of LOCALES) {
      const old = DICTIONARIES[locale]['browser.rawSave.choice.keepEditing'].toLowerCase();
      expect(
        old.includes('editing') || old.includes('editando') || old.includes('editar'),
        locale
      ).toBe(true);
    } // End of the loop that keeps the word check falsifiable
  }); // End of the "labels the non-destructive way out" case

  it('declares what each of the six surfaces drafts, by the Q3/Q4 rule', () => {
    // **The rule is one rule and the six declarations are where it lands.** The
    // raw editor's whole file text, the match editor's `MatchBuffers` and the
    // creator's `CreationBuffers` are strings a person typed; the mover's
    // `MovePlacement` is a positional choice and the deleter's and duplicator's
    // `MatchId` is an opaque revision-scoped carrier. A surface whose drafted type
    // changed and whose declaration did not would be caught here and nowhere else.
    expect(RAW_EDITOR.draftKind).toBe('authoredText');
    expect(MATCH_EDITOR.draftKind).toBe('authoredText');
    expect(CREATOR.draftKind).toBe('authoredText');
    expect(MOVER.draftKind).toBe('operationChoice');
    expect(DELETER.draftKind).toBe('operationChoice');
    expect(DUPLICATOR.draftKind).toBe('operationChoice');
  }); // End of the "six declarations" case

  it('draws four on the two authored-text match surfaces and three on the raw editor', () => {
    // **What this establishes, and what it cannot.** It reads six capability
    // objects and this module's one mapping, so it can say what each surface
    // currently *offers*. It **cannot** say that a component acts on what it is
    // offered: no component is imported, mounted or invoked here. The wiring
    // evidence is each surface's own model suite driving its transitions and each
    // component's mounted suite pressing the control.
    //
    // 2c-4a-3a flipped both booleans on the two authored-text match surfaces and
    // 2c-4a-3b flipped `offersReload` on the other three, so **all six offer the
    // reload**; 2c-4b-3 flipped `offersReapply` on the five match surfaces, so the
    // raw editor is now the only one of the six with three choices. The copy stays
    // refused on three of them for ever, and the reapply on the raw editor for
    // ever, because both rules are about what those surfaces *are* and not about
    // what they declare.
    expect(conflictChoicesFor(RAW_EDITOR, 'idle')).toEqual([
      'keepEditing',
      'copyDraft',
      'reloadDiskVersion'
    ]);
    expect(conflictChoicesFor(RAW_EDITOR, 'confirming')).toEqual([
      'keepEditing',
      'copyDraft',
      'confirmReload'
    ]);
    for (const surface of [MATCH_EDITOR, CREATOR]) {
      expect(conflictChoicesFor(surface, 'idle')).toEqual([
        'keepEditing',
        'copyDraft',
        'keepMyDraft',
        'reloadDiskVersion'
      ]);
      expect(conflictChoicesFor(surface, 'confirming')).toEqual([
        'keepEditing',
        'copyDraft',
        'keepMyDraft',
        'confirmReload'
      ]);
    } // End of the loop over the two authored-text match surfaces
    for (const surface of [MOVER, DELETER, DUPLICATOR]) {
      expect(conflictChoicesFor(surface, 'idle')).toEqual([
        'keepEditing',
        'keepMyDraft',
        'reloadDiskVersion'
      ]);
      expect(conflictChoicesFor(surface, 'confirming')).toEqual([
        'keepEditing',
        'keepMyDraft',
        'confirmReload'
      ]);
      // And a spend the window refused takes **both reload labels** away again, on
      // these three as on the other three — and leaves the reapply, which is a
      // different question with a different authorization.
      expect(conflictChoicesFor(surface, 'unavailable')).toEqual(['keepEditing', 'keepMyDraft']);
      expect(surface.offersCopyDraft).toBe(false);
    } // End of the loop over the three operation-choice surfaces
  }); // End of the "what each surface draws" case
}); // End of the "one authority" suite

describe('the labelled reference copy', () => {
  /** Wording a case can read back, so the format is what is under test. */
  const WORDING = {
    heading: '<heading>',
    label: (name: string): string => `<${name}>`,
    status: (status: DraftFieldStatus): string => `<${status}>`
  };

  /** A draft holding one field of every status, with awkward text in it. */
  const FIELDS: readonly RetainedDraftField[] = [
    { label: 'trigger', text: ':a', status: 'unchanged' },
    { label: 'replace', text: 'one\r\ntwo  ', status: 'setting' },
    { label: 'label', text: 'Signature', status: 'removing' }
  ];

  it('puts the heading first and one block per field, in the order it was given', () => {
    expect(referenceCopyOf(FIELDS, WORDING)).toBe(
      '<heading>\n\n<trigger> (<unchanged>)\n:a\n\n<replace> (<setting>)\none\r\ntwo  \n\n<label> (<removing>)\nSignature'
    );
  }); // End of the "shape of the copy" case

  it('preserves every copied string byte for byte', () => {
    // **The whole of the honesty claim.** The labels and statuses are prose around
    // the values and nothing touches the values: a carriage return, a trailing run
    // of spaces and an empty field all survive. What a `<textarea>` carrier would
    // do to that carriage return is why `src/lib/components/clipboard.ts` refuses
    // the selection route for a text holding one.
    const copied = referenceCopyOf(FIELDS, WORDING);
    for (const field of FIELDS) {
      expect(copied).toContain(field.text);
    } // End of the loop over the three fields
    expect(referenceCopyOf([{ label: 'label', text: '', status: 'unchanged' }], WORDING)).toBe(
      '<heading>\n\n<label> (<unchanged>)\n'
    );
  }); // End of the "byte for byte" case

  it('is the heading alone for a draft with no fields', () => {
    expect(referenceCopyOf([], WORDING)).toBe('<heading>');
  });

  it('gives every field status a phrase in both languages, and never YAML for one', () => {
    for (const status of ['unchanged', 'setting', 'removing'] as const) {
      for (const locale of LOCALES) {
        expect(DICTIONARIES[locale][draftFieldStatusKey(status)].length).toBeGreaterThan(0);
      } // End of the loop over the two locales
    } // End of the loop over the three statuses
    // The copy says what it is, in both languages, and neither sentence is "keep
    // my draft" — the phrase reserved for 2c-4b.
    for (const locale of LOCALES) {
      const heading = DICTIONARIES[locale]['browser.saveOutcome.copyHeading'].toLowerCase();
      expect(heading).toContain('yaml');
      expect(heading).not.toContain('keep my draft');
      expect(heading).not.toContain('mantener mi borrador');
    } // End of the loop over the two locales
  }); // End of the "status sentences" case
}); // End of the "reference copy" suite

describe('the authorized disk adoption', () => {
  it('carries the projection, the revision and the text of one conflict', () => {
    const model = conflictModel();
    const adoption = authorizeDiskAdoption(model, confirmReloadDiskVersion(model));
    expect(adoption?.disk).toBe(model.disk);
    expect(adoption?.diskRevision).toBe(model.diskRevision);
    // Byte for byte, because this is the text a reload seeds a draft from: the
    // BOM, the CRLF pair and the missing final newline all survive.
    expect(adoption?.diskText).toBe(DISK_TEXT);
  }); // End of the "carries one conflict's observation" case

  it('refuses a confirmation collected for a different conflict', () => {
    // The same check `reloadDiskVersion` makes, on the same token, so a screen
    // cannot collect one answer and install another conflict's projection with it.
    const first = conflictModel();
    const second = conflictModel(AGAIN);
    expect(authorizeDiskAdoption(second, confirmReloadDiskVersion(first))).toBeNull();
  });
}); // End of the "authorized disk adoption" suite

describe('a committed save whose invalidation failed', () => {
  it('is still a committed save, with the failure as an extra line', () => {
    // `PROGRESS.md` D2: a committed write is never afterwards reported as an
    // error. The bytes are on disk; what failed is this window's own forgetting.
    const model = describeWholeDocumentSave(savedWith(), draftInHand(), RAW_EDITOR);
    expect(model).toMatchObject({ kind: 'saved', committed: true });
    expect(invalidationFailureMessage({ kind: 'failed', failure: { kind: 'unexpected' } })).toEqual({
      kind: 'windowOutOfStep'
    });
  });

  it('adds nothing when the invalidation was not owed or worked', () => {
    expect(invalidationFailureMessage({ kind: 'notOwed' })).toBeNull();
    expect(invalidationFailureMessage({ kind: 'done' })).toBeNull();
  });
}); // End of the "committed save whose invalidation failed" suite

describe('the sentences behind the model', () => {
  /** Every message the model can build, one of each kind. */
  const MESSAGES: readonly SaveOutcomeMessage[] = [
    { kind: 'fileWritten' },
    { kind: 'nothingToWrite' },
    { kind: 'backupTaken' },
    { kind: 'nothingWasWritten' },
    { kind: 'changedElsewhere' },
    { kind: 'draftKeptInMemory' },
    { kind: 'operationKeptInMemory' },
    { kind: 'reloadDiscardsDraft' },
    { kind: 'reloadClosesSurface' },
    { kind: 'reloadAbandonsOperation' },
    { kind: 'reloadRetargetsCandidate' },
    { kind: 'changedAgainSinceRefusal' },
    { kind: 'windowOutOfStep' }
  ];

  /**
   * Every operation summary an `operationChoice` surface can show.
   *
   * Written out for {@link EVERY_CONFLICT_CHOICE}'s reason: a union has no
   * run-time extent, and the `satisfies` below makes a new member with no entry
   * here a compile error in this file.
   */
  const OPERATIONS = Object.keys({
    deleteSnippet: true,
    duplicateSnippet: true,
    moveToTop: true,
    moveToEnd: true,
    moveAfterSnippet: true,
    moveAfterSnippetNoLongerShown: true,
    replaceFileFromBackup: true
  } satisfies Record<ConflictOperation, true>) as readonly ConflictOperation[];

  it('map to the key that names them, so two cannot be swapped', () => {
    for (const message of MESSAGES) {
      expect(saveOutcomeMessageKey(message), message.kind).toBe(
        `browser.saveOutcome.${message.kind}`
      );
    }
    for (const operation of OPERATIONS) {
      expect(conflictOperationKey(operation), operation).toBe(
        `browser.saveOutcome.operation.${operation}`
      );
    }
    // The one that reuses an existing label rather than adding a second string
    // that reads the same: it is the same offer about a different refusal.
    expect(conflictChoiceKey('keepEditing', 'authoredText')).toBe(
      'browser.rawSave.choice.keepEditing'
    );
    expect(conflictChoiceKey('copyDraft', 'authoredText')).toBe(
      'browser.saveOutcome.choice.copyDraft'
    );
    expect(conflictChoiceKey('reloadDiskVersion', 'authoredText')).toBe(
      'browser.saveOutcome.choice.reloadDiskVersion'
    );
    expect(conflictChoiceKey('confirmReload', 'authoredText')).toBe(
      'browser.saveOutcome.choice.confirmReload'
    );
  }); // End of the "map to the key" case

  it.each(LOCALES)('all read as a sentence in %s', (locale) => {
    for (const message of MESSAGES) {
      const value = DICTIONARIES[locale][saveOutcomeMessageKey(message)];
      expect(value.trim().split(/\s+/u).length, `${locale}:${message.kind}`).toBeGreaterThan(4);
      expect(value.trim().endsWith('.'), `${locale}:${message.kind}`).toBe(true);
    }
    for (const operation of OPERATIONS) {
      const value = DICTIONARIES[locale][conflictOperationKey(operation)];
      expect(value.trim().split(/\s+/u).length, `${locale}:${operation}`).toBeGreaterThan(4);
      expect(value.trim().endsWith('.'), `${locale}:${operation}`).toBe(true);
    }
    // A choice is a button label, so it is checked the other way round: short,
    // and never punctuated like a sentence.
    for (const key of EVERY_CONFLICT_LABEL) {
      const value = DICTIONARIES[locale][key];
      expect(value.trim(), `${locale}:${key}`).not.toBe('');
      expect(value.trim().endsWith('.'), `${locale}:${key}`).toBe(false);
    }
  }); // End of the "all read as a sentence" case

  it('are translated, and no two of them read the same', () => {
    const keys = [
      ...MESSAGES.map(saveOutcomeMessageKey),
      ...OPERATIONS.map(conflictOperationKey),
      ...EVERY_CONFLICT_LABEL
    ];
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(DICTIONARIES.es[key], key).not.toBe(DICTIONARIES.en[key]);
    }
    for (const locale of LOCALES) {
      const rendered = new Set(keys.map((key) => DICTIONARIES[locale][key]));
      expect(rendered.size, locale).toBe(keys.length);
    }
  }); // End of the "are translated" case

  it('name no placeholder, because none of them carries an operand', () => {
    // A revision is opaque and never rendered; a finding's own numbers reach a
    // screen through `tFindingCode`. A sentence naming `{something}` here would
    // reach a screen with the token in it.
    for (const locale of LOCALES) {
      for (const message of MESSAGES) {
        const named = placeholdersOf(DICTIONARIES[locale][saveOutcomeMessageKey(message)]);
        expect(named, `${locale}:${message.kind}`).toEqual([]);
      }
      // An operation summary carries none either: it names the *shape* of the
      // operation and never a snippet, because identifying one across revisions is
      // 2c-4b (consult Q5).
      for (const operation of OPERATIONS) {
        const named = placeholdersOf(DICTIONARIES[locale][conflictOperationKey(operation)]);
        expect(named, `${locale}:${operation}`).toEqual([]);
      }
    } // End of the loop over the two locales
  }); // End of the "name no placeholder" case
}); // End of the "sentences behind the model" suite

describe('the one rule every authored-text/operation pair shares', () => {
  /** Both draft kinds, so no case below checks one surface's half only. */
  const KINDS: readonly ConflictDraftKind[] = ['authoredText', 'operationChoice'];

  it('picks by the draft kind and never by a caller’s preference', () => {
    // The rule as a value. Five callers, all in `../browser`: `conflictChoiceKey`,
    // `reloadUnavailableKey`, `reloadWarningFor` and `describeConflict` here, and
    // `rawSaveChoiceKey` in `./rawSave`. A sixth thing that needs the distinction
    // joins them there rather than growing a sixth
    // `draftKind === 'authoredText'` somewhere else.
    const wording = {
      authoredText: 'browser.rawSave.choice.keepEditing',
      operationChoice: 'browser.saveOutcome.choice.keepOperation'
    } as const;
    expect(draftKindWording('authoredText', wording)).toBe(wording.authoredText);
    expect(draftKindWording('operationChoice', wording)).toBe(wording.operationChoice);
  });

  it('is generic, so a message code and a key are not two rules', () => {
    // `reloadWarningFor` and `describeConflict` choose a `SaveOutcomeMessage` and
    // leave the key to `saveOutcomeMessageKey`; the three key functions choose a
    // key directly. Written as two functions those would be two rules, and the
    // review's Medium is what one rule written twice costs.
    const codes = {
      authoredText: { kind: 'draftKeptInMemory' },
      operationChoice: { kind: 'operationKeptInMemory' }
    } as const satisfies Record<ConflictDraftKind, SaveOutcomeMessage>;
    expect(draftKindWording<SaveOutcomeMessage>('authoredText', codes)).toEqual({
      kind: 'draftKeptInMemory'
    });
    expect(draftKindWording<SaveOutcomeMessage>('operationChoice', codes)).toEqual({
      kind: 'operationKeptInMemory'
    });
  });

  it('gives the withdrawn reload its own sentence per draft kind', () => {
    // **The orchestrator's finding at 3c-4, and the third instance of the same
    // defect.** `browser.saveOutcome.reloadUnavailable` ends *"Keep editing, or
    // stop and open the file again"* and was drawn by a bare key literal on all
    // six surfaces, three of which edit nothing.
    expect(reloadUnavailableKey('authoredText')).toBe('browser.saveOutcome.reloadUnavailable');
    expect(reloadUnavailableKey('operationChoice')).toBe(
      'browser.saveOutcome.reloadUnavailableOperation'
    );
    expect(reloadUnavailableKey('authoredText')).not.toBe(
      reloadUnavailableKey('operationChoice')
    );
  });

  it('keeps the word "editing" out of the operation sentence, in both languages', () => {
    // A word check and not a meaning check, exactly as the two label cases above
    // are: it fires on the defect that was found and says nothing about whether
    // the replacement reads well. The falsifiability half is the second loop —
    // the sentence the three surfaces used to draw is what the check must reject,
    // so a word list typo'd into matching nothing cannot pass this vacuously.
    for (const locale of LOCALES) {
      const operation = DICTIONARIES[locale][reloadUnavailableKey('operationChoice')].toLowerCase();
      expect(operation, locale).not.toContain('keep editing');
      expect(operation, locale).not.toContain('sigue editando');
      const authored = DICTIONARIES[locale][reloadUnavailableKey('authoredText')].toLowerCase();
      expect(
        authored.includes('keep editing') || authored.includes('sigue editando'),
        locale
      ).toBe(true);
    } // End of the loop over the two locales
  }); // End of the "no editing in the operation sentence" case

  it('says the same guarantee in both sentences, whatever it advises afterwards', () => {
    // The clause that differs is the advice; the guarantee — nothing written,
    // nothing discarded — is the part a person acts on and must survive the
    // split. Checked by the shared prefix rather than by a verbatim string, so a
    // legitimate rewording of the advice does not fail this.
    for (const locale of LOCALES) {
      for (const kind of KINDS) {
        const value = DICTIONARIES[locale][reloadUnavailableKey(kind)];
        expect(placeholdersOf(value), `${locale}:${kind}`).toEqual([]);
        expect(value.trim().endsWith('.'), `${locale}:${kind}`).toBe(true);
      } // End of the loop over the two draft kinds
      const shared = DICTIONARIES[locale][reloadUnavailableKey('authoredText')].split(':')[0];
      expect(shared, locale).not.toBeUndefined();
      expect(DICTIONARIES[locale][reloadUnavailableKey('operationChoice')], locale).toContain(
        shared as string
      );
    } // End of the loop over the two locales
  }); // End of the "same guarantee" case
}); // End of the "one rule three sentences share" suite

describe('what a changing outcome asks to have brought into view', () => {
  /** Every arm a save outcome can be, from the model's own union. */
  const ARMS: readonly OutcomeArm[] = ['saved', 'refused', 'conflict'];

  it('asks for nothing when no outcome panel is drawn', () => {
    expect(outcomeReveal(null, false)).toBe('none');
    // Even a stale confirmation flag cannot conjure a target out of no panel.
    expect(outcomeReveal(null, true)).toBe('none');
  });

  it('gives every arm a cue of its own, so one replacing another is a change', () => {
    // **The 2c-4a-3c review's second finding.** All three used to answer one
    // `'panel'`, so a component's `$effect` did not re-run when `refused` was
    // replaced by `saved` over the same bound element — which is the ordinary path
    // of *Save anyway*, since `beginSave` retains the outcome in flight and there
    // is no `null` interval between them.
    const cues = ARMS.map((arm) => outcomeReveal(arm, false));
    expect(new Set(cues).size, cues.join(',')).toBe(ARMS.length);
    expect(outcomeReveal('saved', false)).toBe('savedPanel');
    expect(outcomeReveal('refused', false)).toBe('refusedPanel');
    expect(outcomeReveal('conflict', false)).toBe('conflictPanel');
  });

  it('asks for the controls at the reload’s second step', () => {
    // **Finding 10.4 as a decision.** The confirmation line grows the panel
    // downwards past a `scrollTop` already at its end, so the second step needs its
    // own target and not a second scroll to the same one.
    expect(outcomeReveal('conflict', true)).toBe('conflictChoices');
  });

  it('never asks for the controls for an arm that has no second step', () => {
    // A `saved` or `refused` arm's row of controls means something else entirely —
    // *Dismiss*, *Save anyway* — and framing it would scroll the outcome off the
    // screen to show them. Only a conflict has a confirmation step at all.
    expect(outcomeReveal('saved', true)).toBe('savedPanel');
    expect(outcomeReveal('refused', true)).toBe('refusedPanel');
  });
}); // End of the "what a changing outcome asks to have brought into view" suite
