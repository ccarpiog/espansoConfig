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
import { DICTIONARIES, placeholdersOf } from '../i18n/dictionaries';
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
  confirmReloadDiskVersion,
  copyOfDraft,
  describeEditSave,
  describeWholeDocumentSave,
  invalidationFailureMessage,
  reloadDiskVersion,
  saveOutcomeMessageKey,
  type ConflictCapabilities,
  type ConflictChoice,
  type ConflictModel,
  type SaveOutcomeMessage
} from './saveOutcome';

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
  reloadDiskVersion: true,
  confirmReload: true
} satisfies Record<ConflictChoice, true>) as readonly ConflictChoice[];

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
 * @returns The conflict arm.
 */
function conflictModel(
  diskRevision: ContentRevision = AFTER,
  draft: Draft<string> = draftInHand()
): ConflictModel<string> {
  const model = describeWholeDocumentSave(conflictWith(diskRevision), draft);
  if (model.kind !== 'conflict') {
    throw new Error('the conflict arm is what this case is about');
  }
  return model;
} // End of function conflictModel()

describe('a save that ran to the end', () => {
  it('says the file was written, and discloses a backup without promising one', () => {
    const model = describeWholeDocumentSave(savedWith({ backupTaken: true }), draftInHand());
    expect(model.kind).toBe('saved');
    expect(model).toMatchObject({ committed: true, backupTaken: true, revision: AFTER });
    expect(model.messages).toEqual([{ kind: 'fileWritten' }, { kind: 'backupTaken' }]);
  });

  it('treats "nothing to write" as a success with its own sentence', () => {
    // `committed: false` is a documented success: a candidate byte-identical to
    // what the file already held is not written, because replacing a file drops
    // metadata and buys nothing. A model that only said "written" or said nothing
    // would present that as a failure or as silence.
    const model = describeWholeDocumentSave(savedWith({ committed: false }), draftInHand());
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
    const model = describeEditSave(wireSaved({ notes }), draftInHand());
    expect(model).toMatchObject({ kind: 'saved' });
    if (model.kind !== 'saved') {
      return;
    }
    expect(model.notes).toEqual(notes);
  }); // End of the "carries every presentation note" case

  it('reads the same from either describer', () => {
    expect(describeEditSave(wireSaved(), draftInHand())).toEqual(
      describeWholeDocumentSave(savedWith(), draftInHand())
    );
  });
}); // End of the "save that ran to the end" suite

describe('a save the semantic gate refused', () => {
  it('states that nothing was written, and hands every finding back', () => {
    // The gate matches an acknowledgement against the candidate's suspicions as
    // an **exact multiset**, so a subset is simply a second refusal — and there
    // is no `force` flag on this wire.
    const refusal = refusedWith([REJECTION, ORDINARY]);
    const model = describeWholeDocumentSave(refusal, draftInHand());
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
      draftInHand()
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
    const model = describeWholeDocumentSave(refusedWith([REJECTION]), draftInHand());
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
    const model = describeEditSave(refusedWith([ORDINARY]), draftInHand());
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

  it('names no control "keep my draft", in either language', () => {
    // The phrase means *reapply the draft to the newly parsed document* — Phase
    // 2c-4b, the dangerous algorithmic half — and using it early would teach the
    // owner the wrong meaning and make 2c-4b look already-done.
    for (const choice of EVERY_CONFLICT_CHOICE) {
      expect(choice).not.toBe('keepMyDraft');
      for (const locale of LOCALES) {
        const label = DICTIONARIES[locale][conflictChoiceKey(choice)].toLowerCase();
        expect(label, `${locale}:${choice}`).not.toContain('keep my draft');
        expect(label, `${locale}:${choice}`).not.toContain('conservar mi borrador');
      }
    }
  }); // End of the "names no control" case
}); // End of the "conflict" suite

describe('the one authority that decides what a conflict offers', () => {
  /**
   * A capability record, with every field overridable.
   *
   * @param over - What this case is about.
   * @returns The capabilities.
   */
  function capabilities(over: Partial<ConflictCapabilities> = {}): ConflictCapabilities {
    return { draftKind: 'authoredText', offersCopyDraft: true, offersReload: true, ...over };
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

  it('gives every choice it can name a sentence in both languages', () => {
    for (const choice of EVERY_CONFLICT_CHOICE) {
      for (const locale of LOCALES) {
        expect(DICTIONARIES[locale][conflictChoiceKey(choice)].length).toBeGreaterThan(0);
      }
    } // End of the loop over every choice
  });

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

  it('draws only *Keep editing* for the five surfaces whose panels do not act yet', () => {
    // **What this establishes, and what it cannot.** It reads six capability
    // objects and this module's one mapping, so it can say that the five match
    // surfaces currently *offer* nothing but `keepEditing` and that the raw editor
    // offers all three. It **cannot** say that a component acts on what it is
    // offered: no component is imported, mounted or invoked here, and the
    // 2c-4a-2 review was right that once 2c-4a-3 edits these expectations the case
    // stops relating to any `conflictAction` arm at all. The wiring evidence is
    // each surface's own model suite driving `reloadTheDiskVersion`, and — from
    // 2c-4a-3 — each component's mounted suite pressing the control.
    expect(conflictChoicesFor(RAW_EDITOR, 'idle')).toEqual([
      'keepEditing',
      'copyDraft',
      'reloadDiskVersion'
    ]);
    for (const surface of [MATCH_EDITOR, CREATOR, MOVER, DELETER, DUPLICATOR]) {
      expect(conflictChoicesFor(surface, 'idle')).toEqual(['keepEditing']);
      expect(conflictChoicesFor(surface, 'confirming')).toEqual(['keepEditing']);
    } // End of the loop over the five match surfaces
  }); // End of the "only keep editing is drawn" case
}); // End of the "one authority" suite

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
    const model = describeWholeDocumentSave(savedWith(), draftInHand());
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
    { kind: 'reloadDiscardsDraft' },
    { kind: 'changedAgainSinceRefusal' },
    { kind: 'windowOutOfStep' }
  ];

  /** Every choice a conflict can name, the confirmation label included. */
  const CHOICES: readonly ConflictChoice[] = [
    'keepEditing',
    'copyDraft',
    'reloadDiskVersion',
    'confirmReload'
  ];

  it('map to the key that names them, so two cannot be swapped', () => {
    for (const message of MESSAGES) {
      expect(saveOutcomeMessageKey(message), message.kind).toBe(
        `browser.saveOutcome.${message.kind}`
      );
    }
    // The one that reuses an existing label rather than adding a second string
    // that reads the same: it is the same offer about a different refusal.
    expect(conflictChoiceKey('keepEditing')).toBe('browser.rawSave.choice.keepEditing');
    expect(conflictChoiceKey('copyDraft')).toBe('browser.saveOutcome.choice.copyDraft');
    expect(conflictChoiceKey('reloadDiskVersion')).toBe(
      'browser.saveOutcome.choice.reloadDiskVersion'
    );
    expect(conflictChoiceKey('confirmReload')).toBe('browser.saveOutcome.choice.confirmReload');
  }); // End of the "map to the key" case

  it.each(LOCALES)('all read as a sentence in %s', (locale) => {
    for (const message of MESSAGES) {
      const value = DICTIONARIES[locale][saveOutcomeMessageKey(message)];
      expect(value.trim().split(/\s+/u).length, `${locale}:${message.kind}`).toBeGreaterThan(4);
      expect(value.trim().endsWith('.'), `${locale}:${message.kind}`).toBe(true);
    }
    // A choice is a button label, so it is checked the other way round: short,
    // and never punctuated like a sentence.
    for (const choice of CHOICES) {
      const value = DICTIONARIES[locale][conflictChoiceKey(choice)];
      expect(value.trim(), `${locale}:${choice}`).not.toBe('');
      expect(value.trim().endsWith('.'), `${locale}:${choice}`).toBe(false);
    }
  }); // End of the "all read as a sentence" case

  it('are translated, and no two of them read the same', () => {
    const keys = [...MESSAGES.map(saveOutcomeMessageKey), ...CHOICES.map(conflictChoiceKey)];
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
    }
  }); // End of the "name no placeholder" case
}); // End of the "sentences behind the model" suite
