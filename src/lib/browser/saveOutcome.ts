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
 * ## One authority decides what a conflict offers, and one authorizes the adoption
 *
 * Until 2c-4a-2 there were **two**: this module installed a global three-choice
 * array into every {@link ConflictModel}, and each of the five match models
 * ignored that field and exported a local `['keepEditing']` of its own. A field
 * nobody reads is not a default, it is a second answer — and the consult's Q9
 * named the consequence exactly: *that split is why a newly offered button can
 * compile and do nothing*. The field is gone. {@link conflictChoicesFor} is now
 * the only producer of a {@link ConflictChoice} list, and each surface declares
 * one {@link ConflictCapabilities} it is given.
 *
 * The other half is {@link DiskAdoption}. A conflict writes nothing, so the
 * frontend must not move to the disk observation until a person says so; the
 * branded value {@link authorizeDiskAdoption} mints is what `BrowserState`'s one
 * adoption path takes, and it can only be obtained from a conflict together with
 * the confirmation issued **for that conflict**.
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
import type { DetailFieldName } from './detail';
import type {
  Acknowledgement,
  ConflictResult,
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
import { draftKindWording, type ConflictDraftKind } from './draftKind';
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
      /**
       * The operation the panel was set up to perform is still set up, untouched.
       *
       * **The `operationChoice` half of {@link SaveOutcomeMessage} `draftKeptInMemory`,
       * and 2c-4a-3b is why it exists.** *Your text is still here, exactly as you
       * wrote it* is true of the raw editor, the match editor and the creator, and
       * false of the mover, the deleter and the duplicator: nobody typed anything
       * on those three, so a sentence about text describes something the person
       * never produced. {@link ConflictCapabilities.draftKind} chooses between the
       * two, in this module, and not in six markup files.
       */
      readonly kind: 'operationKeptInMemory';
    }
  | {
      /**
       * Loading the version on disk **replaces the draft with it**, irreversibly.
       *
       * True of the raw editor and of nothing else, which is the 2c-4a-3a review's
       * finding 2: a match surface's reload installs the disk projection and
       * closes the panel, loading nothing in the draft's place, so this sentence
       * described an action those five surfaces do not perform.
       * {@link ConflictCapabilities.reloadOutcome} is what chooses between this and
       * {@link SaveOutcomeMessage} `reloadClosesSurface`.
       */
      readonly kind: 'reloadDiscardsDraft';
    }
  | {
      /**
       * Loading the version on disk discards the draft and **closes the panel**.
       *
       * The five match surfaces' half of the same fact: there is no truthful
       * disk-side `MatchBuffers`, `CreationBuffers`, `MovePlacement` or `MatchId`
       * to seed, and manufacturing one would be the cross-revision identification
       * 2c-4b owns.
       *
       * **It states the whole guarantee, including that the operation is not
       * carried out and the file is not written** — the 2c-4a-3b review's finding
       * 3. It used to say only what became of the draft, so the creator's own
       * confirmation line carried *and the snippet is not added* while the other
       * three surfaces got that clause from
       * {@link SaveOutcomeMessage} `reloadAbandonsOperation`: one guarantee decided
       * in two places, which is how the mover's half of it drifted into being
       * false.
       */
      readonly kind: 'reloadClosesSurface';
    }
  | {
      /**
       * Loading the version on disk **closes the panel** and the operation is not
       * carried out.
       *
       * **The third arm, and 2c-4a-3b's verification of `reloadOutcome` is why.**
       * {@link SaveOutcomeMessage} `reloadClosesSurface` ends *copy it first if you
       * want to keep it*, which is sound advice on the two surfaces that offer a
       * copy and an instruction with no control behind it on the three that never
       * can: consult Q4 refuses a copy for a `MovePlacement` or a `MatchId` as a
       * property of the drafted value. This sentence promises no copy, because
       * there is nothing here a clipboard could preserve.
       */
      readonly kind: 'reloadAbandonsOperation';
    }
  | {
      /**
       * Loading the version on disk **keeps the candidate and moves what it is
       * measured against**, and the panel stays open.
       *
       * **The fourth arm, added at 2c-5-3 for restore.** The other three are all
       * false of it: nothing the person typed is replaced
       * ({@link SaveOutcomeMessage} `reloadDiscardsDraft`), and the panel neither
       * closes nor abandons what was asked for
       * ({@link SaveOutcomeMessage} `reloadClosesSurface` and
       * `reloadAbandonsOperation`). A restore's candidate is the exact text read
       * from a backup entry, which the conflict never touched and the adoption has no
       * reason
       * to discard; what the adoption changes is the **revision the candidate would
       * be written against**, so the confirmation collected against the old one is
       * withdrawn and has to be given again.
       *
       * It says the file is not written either way, because that is the fact the
       * whole panel exists to make unambiguous.
       */
      readonly kind: 'reloadRetargetsCandidate';
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
 * **`keepMyDraft` is the phrase the plan reserved, and it means what the plan says
 * it means.** Until 2c-4b-3 this union deliberately had no member for it: in the
 * plan the words mean *reapply the draft to the newly parsed disk document*, which
 * is 2c-4b's dangerous algorithmic half, and using them for the weaker behaviour
 * would have taught the owner the wrong meaning and made the phase look
 * already-done (`docs/decisions/2c-split-notes.md` section 6). The member exists
 * now because the operation does: 2c-4b-1 built the correspondence evidence,
 * 2c-4b-2 built one pure transition per surface, and this member is what names the
 * control that calls one.
 *
 * **It is not a second reload and it asks no second question** — the consult's Q6.
 * A reload discards the draft and resets the history; a reapply retains the intent,
 * rebuilds it over the newly parsed document and hands back a session the surface's
 * ordinary submit path sends, meeting the ordinary gates. What a destructive
 * surface still re-asks is **its own** confirmation, against the snippet the live
 * projection then names; that is confirmation of the destructive operation and not
 * of this label.
 *
 * `confirmReload` is deliberately never offered beside `reloadDiskVersion`: it is
 * the second step, the label on the control that confirms a reload after the
 * warning has been read, and the transition behind it is
 * {@link confirmReloadDiskVersion}. {@link conflictChoicesFor} is what enforces
 * that, by taking the step and answering one of the two.
 */
export type ConflictChoice =
  | 'keepEditing'
  | 'copyDraft'
  | 'keepMyDraft'
  | 'reloadDiskVersion'
  | 'confirmReload';

/**
 * What one surface's retained draft **is**.
 *
 * **Declared in `./draftKind` since 2c-4a-3c-4 and re-exported here**, so every
 * existing importer keeps working while the module that owns the *rule* keyed on
 * it can be imported by `./rawSave` too — which `./saveOutcome` imports, so the
 * type could not stay here without making that a cycle.
 */
export type { ConflictDraftKind };

/**
 * What a confirmed reload **does** on one surface.
 *
 * A permanent fact about the surface, exactly as {@link ConflictDraftKind} is, and
 * the 2c-4a-3a review's finding 2 is why it is a declaration rather than a
 * sentence: the shared conflict panel told every surface that loading the disk
 * version *replaces your text with it*, which is what the raw editor does and is
 * false of the five match surfaces, whose reload installs the disk projection and
 * closes the panel with nothing in the draft's place.
 *
 * **Required on {@link ConflictCapabilities}**, so a surface cannot omit it and
 * inherit somebody else's sentence; what no type can force is that the transition
 * really does what the surface declares, and each surface's own suite is what
 * drives that.
 */
export type ConflictReloadOutcome =
  /** The draft is replaced by the disk version. The raw editor, and only it. */
  | 'reseedsDraft'
  /** The disk projection is installed and the panel closes. The five match surfaces. */
  | 'closesSurface'
  /**
   * The disk projection is installed, the candidate is kept, and the panel stays
   * open measuring it against the newly installed revision. Restore, and only it.
   *
   * **Added at 2c-5-3 rather than reusing one of the two above**, because both
   * would have been false statements: a restore's candidate is the exact text read
   * from a backup entry, so there is nothing of the person's to replace and nothing to
   * abandon, and the surface has no reason to close over a candidate it still
   * holds. What the adoption really changes is the revision the candidate would be
   * written against, which is why the confirmation given against the old one is
   * withdrawn (consult Q4, `docs/reviews/phase-2c-5-design.md`).
   */
  | 'retargetsCandidate';

/**
 * How far one surface's reload has got, as far as the labels are concerned.
 *
 * Three values rather than the four of a surface's own reload state: a
 * confirmation that was spent **and satisfied** leaves the conflict behind it, so
 * there is nothing left to offer choices about. A spend the window **refused** is
 * not behind it at all — the panel is still there and the draft is still there —
 * and `unavailable` is what stops the confirm control being offered again after a
 * refusal that came back with no word about its cause (2c-4a-3a review, finding 3)
 * — a control withheld, not a claim that a later ask could only be refused too.
 */
export type ConflictReloadStep = 'idle' | 'confirming' | 'unavailable';

/**
 * Whether one surface can have a reapply transition **at all**.
 *
 * **A permanent fact about the surface**, exactly as {@link ConflictDraftKind} and
 * {@link ConflictReloadOutcome} are, and not a statement about what it draws. The
 * consult's Q4 rules the raw editor out for ever: its candidate is a whole
 * document, so there is no target, no field intent and no operation to re-resolve,
 * and the only things "reapply" could mean there are overwriting the newly read
 * disk text with a stale string or inventing a text merge — the first forbidden by
 * plan section 6.5 and the second by `IMPLEMENTATION_PLAN.md` outright.
 *
 * **Two things read it, and they read it for two different questions.**
 * `beginReapply` in `./reapply.ts` is the gate every surface's reapply transition
 * goes through, so an `unavailable` surface answers `unavailable` whether or not a
 * conflict is showing; {@link conflictChoicesFor} reads it as the second of the two
 * conditions for naming `keepMyDraft`, so a surface cannot draw a control over a
 * transition that can never do anything. Neither is a description: a declaration
 * nothing reads is a second answer rather than a default
 * ({@link conflictChoicesFor}'s own history).
 *
 * **It is the permanent half of the pair, and
 * {@link ConflictCapabilities.offersReapply} is the other.** This one says what the
 * surface *is*; that one says what it draws today. 2c-4b-2 shipped this alone and
 * said so, because there was then no {@link ConflictChoice} member for a boolean to
 * produce; 2c-4b-3 added the member and the boolean together.
 */
export type ConflictReapplySupport =
  /** This surface has a reapply transition. The five match surfaces. */
  | 'supported'
  /** It can never have one. The raw editor, and only it. */
  | 'unavailable';

/**
 * What one surface may offer about a conflict, declared once by that surface.
 *
 * **The single authority the consult's Q9 asked for.** Before 2c-4a-2 the
 * capability was expressed twice — an ignored field on the model and a local array
 * in each of the five match models — and {@link conflictChoicesFor} replaces both.
 *
 * **Two fields are permanent and three booleans are not.**
 * {@link ConflictCapabilities.draftKind} and
 * {@link ConflictCapabilities.reloadOutcome} are facts about what the drafted value
 * *is* and what a reload *does*, and {@link ConflictCapabilities.reapplySupport} is
 * a fact about whether a reapply could ever be honest here. The three booleans say
 * what this surface **offers today**, and they exist because of a hazard no type in
 * this project can close: a model that names a choice puts a control on screen, and
 * the six components' exhaustive `switch`es protect against a new *member* of
 * {@link ConflictChoice} and not against a newly *offered* one.
 *
 * **Offered is not the same as implemented, and since the 2c-4a-2 confirmation
 * pass this distinction is the whole point.** Every surface's reload transition
 * exists and every component's `conflictAction` calls it; what a `false` here
 * withholds is the *control*. Phase 2c-4a-3a flipped both booleans on the two
 * authored-text match surfaces over machinery that was already there and already
 * tested, 2c-4a-3b flipped `offersReload` on the other three the same way, and
 * 2c-4b-3 flipped {@link ConflictCapabilities.offersReapply} on the five match
 * surfaces over the transitions 2c-4b-2 had already built and driven. All six now
 * offer the reload; three of them will never offer the copy, because that one is
 * refused by {@link conflictChoicesFor} for what their draft *is*; and the raw
 * editor will never offer the reapply, because its
 * {@link ConflictCapabilities.reapplySupport} refuses it for what its candidate is.
 */
export interface ConflictCapabilities {
  /** What the retained draft is, which decides whether a copy could ever be honest. */
  readonly draftKind: ConflictDraftKind;
  /**
   * What a confirmed reload does here, which decides what the panel warns about.
   *
   * Permanent, like {@link ConflictCapabilities.draftKind}, and read by
   * `describeEditSave`/`describeWholeDocumentSave` rather than by a component: the
   * warning is a claim about behaviour and belongs beside the behaviour.
   */
  readonly reloadOutcome: ConflictReloadOutcome;
  /**
   * Whether this surface offers *Copy draft*.
   *
   * `true` on the three surfaces whose draft is authored text — the raw editor,
   * the match editor and the creator — and `false` on the other three, where it
   * would be refused anyway.
   *
   * **Honoured only for an `authoredText` draft**, and that is checked in
   * {@link conflictChoicesFor} rather than trusted here: a surface that set this
   * beside `operationChoice` still gets no copy control, because the Q4 rule is a
   * property of the drafted value and not of a caller's opinion about it.
   */
  readonly offersCopyDraft: boolean;
  /**
   * Whether this surface offers the reload path.
   *
   * Consult Q3 gives **all six** surfaces a confirmed reload, and **all six have
   * one**: the raw editor reseeds its draft from the disk text, the five match
   * surfaces adopt the disk projection and close. Three began offering it at
   * 2c-4a-3a — the raw editor, the match editor and the creator — and the mover,
   * the deleter and the duplicator at 2c-4a-3b, when their panels and sentences
   * were drawn. **It is still a boolean rather than a constant**, because what it
   * records is what a surface draws today and a surface without a panel for it
   * must be able to say so.
   */
  readonly offersReload: boolean;
  /**
   * Whether this surface offers *Keep my draft* — the reapply path.
   *
   * `true` on the five match surfaces since 2c-4b-3, over the transitions
   * `./reapply.ts` and each surface's own module built at 2c-4b-2; `false` on the
   * raw editor, which also declares
   * {@link ConflictCapabilities.reapplySupport} `unavailable`.
   *
   * **Honoured only for a surface whose {@link ConflictCapabilities.reapplySupport}
   * is `supported`**, and that is checked in {@link conflictChoicesFor} rather than
   * trusted here — the same shape as {@link ConflictCapabilities.offersCopyDraft}
   * and for the same reason: the raw editor's refusal is a permanent property of a
   * whole-document candidate and not a caller's opinion about it, so a surface that
   * set this beside `unavailable` still gets no control.
   *
   * **A boolean rather than a constant**, like the other two: what it records is
   * what a surface draws today, and a surface without a panel for it must be able
   * to say so.
   */
  readonly offersReapply: boolean;
  /**
   * Whether this surface can have a reapply transition at all.
   *
   * Permanent, like {@link ConflictCapabilities.draftKind} and
   * {@link ConflictCapabilities.reloadOutcome}. `beginReapply` in `./reapply.ts`
   * reads it as the gate every reapply transition goes through — a surface that
   * declares `unavailable` gets a `ReapplyOutcome` of `unavailable` whether or not a
   * conflict is showing — and {@link conflictChoicesFor} reads it as the permanent
   * half of the two conditions for naming `keepMyDraft`.
   */
  readonly reapplySupport: ConflictReapplySupport;
}

/**
 * What one surface offers about the conflict it is showing, in the order to offer
 * it.
 *
 * **The only producer of a {@link ConflictChoice} list in this repository.**
 * *Keep editing* is always first and always present: it is the non-destructive way
 * out and every surface has one. *Copy draft* comes before the destructive choice
 * on purpose — the destructive one is never nearest to hand, and the copy is what
 * makes the destruction survivable.
 *
 * **`keepMyDraft` comes after the copy and before the reload**, which is the
 * consult's Q6 read literally. It is the conservative choice — it writes nothing,
 * discards nothing and asks no second question — so it belongs above the one that
 * abandons the draft, and below the copy that makes abandoning it survivable.
 *
 * **It is gated on two conditions and not on the reload's step.**
 * {@link ConflictCapabilities.reapplySupport} is the permanent fact — the raw
 * editor can never have an honest reapply — and
 * {@link ConflictCapabilities.offersReapply} is what the surface draws today. The
 * `unavailable` step is deliberately **not** consulted: it records that a *reload*
 * spend was refused, and a reapply is a different question with a different
 * authorization. What a person who presses it in that state gets is whatever that
 * attempt honestly ends as — `adoptionRefused` among the six arms, and no arm is
 * promised here — rather than a control that vanished without a word.
 *
 * **What this forces and what it does not, in the same sentence.** It forces that
 * a copy control cannot be offered for a draft that is not authored text, that a
 * reapply control cannot be offered by a surface whose support is `unavailable`,
 * that `reloadDiskVersion` and `confirmReload` are never offered together, and that
 * **neither is offered once a spend has been refused** — the `unavailable` step,
 * which keeps a control that has just been refused without a word off the screen
 * rather than claiming a later ask could only be refused again.
 * It cannot force that the component drawing the list acts on what it names —
 * nothing in TypeScript can — which is what
 * {@link ConflictCapabilities.offersReload},
 * {@link ConflictCapabilities.offersCopyDraft} and
 * {@link ConflictCapabilities.offersReapply} are for, and they are hand-set.
 *
 * @param capabilities - What the surface declares about itself.
 * @param step - How far its reload has got.
 * @returns The choices to offer, in order.
 */
export function conflictChoicesFor(
  capabilities: ConflictCapabilities,
  step: ConflictReloadStep
): readonly ConflictChoice[] {
  const choices: ConflictChoice[] = ['keepEditing'];
  if (capabilities.offersCopyDraft && capabilities.draftKind === 'authoredText') {
    choices.push('copyDraft');
  }
  if (capabilities.offersReapply && capabilities.reapplySupport === 'supported') {
    choices.push('keepMyDraft');
  }
  if (capabilities.offersReload && step !== 'unavailable') {
    choices.push(step === 'idle' ? 'reloadDiskVersion' : 'confirmReload');
  }
  return choices;
} // End of function conflictChoicesFor()

/**
 * Whether one offered list names the reapply control.
 *
 * **A named read of the one authority, so a panel's readiness sentence and its
 * control cannot disagree.** The sentence beside *Keep my draft* is the thing the
 * consult's Q6 spends most of its words on, and a surface that drew it from its own
 * capability record rather than from the produced list would be expressing
 * capability twice — the split that once let a button compile and do nothing.
 *
 * @param choices - What {@link conflictChoicesFor} answered.
 * @returns Whether the reapply control is among them.
 */
export function reapplyIsOffered(choices: readonly ConflictChoice[]): boolean {
  return choices.includes('keepMyDraft');
} // End of function reapplyIsOffered()

/**
 * The dictionary key holding the sentence that stands beside *Keep my draft*.
 *
 * **The consult's Q6 sentence, chosen by what the surface drafts and by nothing
 * else.** Three surfaces hold text a person typed and three hold a placement or an
 * identity nobody typed at all, so the version for the second three says *requested
 * action* where the first says *the changes you kept* — the 2c-4a-3b finding that
 * *typed text* describes something a mover, a deleter and a duplicator never
 * produced, applied to the sentence this step adds rather than rediscovered later.
 *
 * **What no test in this repository can hold**: that either sentence *says* what
 * Q6 requires — that this application will only **try**, that it works from the
 * newly parsed document, that nothing is written when the target or a drafted field
 * cannot be matched safely, that a safe match promises **no** particular ending,
 * and that a later save may still be refused or conflict. The third of those is the
 * 2c-4b-3a review's High: a safe correspondence does not imply something to send,
 * because `ReapplyOutcome`'s `alreadySatisfied` is a success with nothing left
 * to send when the newly parsed document already holds what was asked for — an arm
 * the mounted mover suite exercises — and `adoptionRefused` and `manualResolution`
 * are endings too, so the sentence names the two successful shapes as possibilities
 * rather than as an exhaustive pair. The i18n suites check key parity and
 * placeholder agreement, never meaning (`CLAUDE.md` section 6). What a test can
 * hold, and `saveOutcome.test.ts` does, is that the two keys are different and that
 * each draft kind reaches its own.
 *
 * @param draftKind - What the calling surface's retained draft is, from its own
 *   `CONFLICT_CAPABILITIES`.
 * @returns The key holding that surface's version of the sentence.
 */
export function reapplyReadinessKey(draftKind: ConflictDraftKind): TranslationKey {
  return draftKindWording(draftKind, {
    authoredText: 'browser.reapply.ready',
    operationChoice: 'browser.reapply.readyOperation'
  });
} // End of function reapplyReadinessKey()

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
   * Disclosed and never promised: rotation attempts to retain ten recognised
   * batch folders by sortable name and a batch is a session, so `true` promises
   * neither how long the copy remains nor that the file can be recovered.
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
   * **This is the disk side of the comparison, and it supersedes a second read.**
   * Until 2c-4a-2 the raw editor was handed the text by a separate `document_text`
   * call the workspace cached by document; that call could answer a *later* text
   * than the conflict is about, or — when the viewer happened to be pointed at the
   * same file — an **earlier** one (`docs/decisions/2c-4a-1-notes.md` section 4.1).
   * This field cannot: it arrives on the payload, paired with
   * {@link ConflictModel.diskRevision} by the command layer.
   */
  readonly diskText: string;
  /**
   * The conflict exactly as it crossed the boundary.
   *
   * **Carried whole rather than reduced to its fields**, which is
   * {@link RefusedModel.refusal}'s reason one arm along: it is the identity
   * `BrowserState` registered when this conflict arrived, and the only thing that
   * ties an adoption to *the state that produced it* and to *the projection it was
   * produced against*. A model assembled from loose fields names no conflict any
   * window ever saw, and `adoptDiskVersion` refuses it — which is what closes the
   * 2c-4a-2 confirmation pass's High.
   */
  readonly source: ConflictResult;
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
 * The line one surface's conflict shows about what a reload would do.
 *
 * **Read off the two permanent fields together, and never off a caller's word.**
 * `reloadOutcome` says whether the draft is replaced or the panel closes;
 * `draftKind` says whether there is anything a copy could preserve. The pair has
 * three inhabited combinations today and this names all three, so a surface
 * cannot inherit a sentence that promises a control it does not have.
 *
 * **This is the one place the close/abandon guarantee is decided**, and the
 * 2c-4a-3b review's finding 3 is why it is written down here. Each of the five
 * match surfaces also draws a line of its own at the confirmation step; that line
 * says only what this application cannot bring back on *that* surface and what to
 * do about it afterwards, and it must never restate what these three sentences
 * already promise — that the panel closes, that the operation is not carried out,
 * that the file is not written, or what becomes of the draft. Two wordings of one
 * guarantee is how the mover's half of it drifted into claiming something
 * (`browser.matchMove.reloadClosesMover`, now gone) that was false of two of its
 * three placement arms.
 *
 * **Nothing here can enforce that**, and no test in this repository pins prose:
 * the i18n suites check parity and placeholders, never meaning (`CLAUDE.md`
 * section 6). What is enforced is that a surface cannot pick its own arm — the
 * three sentences are chosen from the declared capabilities and from nothing else.
 *
 * @param capabilities - What the surface declares about itself.
 * @returns The warning to show.
 */
function reloadWarningFor(capabilities: ConflictCapabilities): SaveOutcomeMessage {
  // **A `switch` rather than an `if` with a fall-through tail, since 2c-5-3.** The
  // first version returned the two `closesSurface` sentences from its `else`, so a
  // third arm of `ConflictReloadOutcome` would have inherited one of them silently
  // — which is the shape of defect this whole family of declarations exists to
  // prevent. A new arm is now a compile error here.
  switch (capabilities.reloadOutcome) {
    case 'reseedsDraft':
      return { kind: 'reloadDiscardsDraft' };
    case 'retargetsCandidate':
      return { kind: 'reloadRetargetsCandidate' };
    case 'closesSurface':
      // The same rule the three key functions use, over a message code rather than
      // a key: `draftKindWording` is generic precisely so that a describer choosing
      // a code and a key function choosing a key are not two rules (3c-4).
      return draftKindWording<SaveOutcomeMessage>(capabilities.draftKind, {
        authoredText: { kind: 'reloadClosesSurface' },
        operationChoice: { kind: 'reloadAbandonsOperation' }
      });
  }
} // End of function reloadWarningFor()

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
  result: ConflictResult,
  draft: Draft<T>,
  capabilities: ConflictCapabilities
): ConflictModel<T> {
  const changedAgain = result.found !== result.disk_revision;
  const messages: SaveOutcomeMessage[] = [
    { kind: 'nothingWasWritten' },
    { kind: 'changedElsewhere' },
    // **What was retained is what the drafted value *is*.** Three surfaces hold
    // strings a person typed; the other three hold a placement or an identity
    // nobody typed at all, and a sentence about text would describe something
    // they never produced (2c-4a-3b). Chosen by the one shared rule, like every
    // other authored-text/operation pair in this application (3c-4).
    draftKindWording<SaveOutcomeMessage>(capabilities.draftKind, {
      authoredText: { kind: 'draftKeptInMemory' },
      operationChoice: { kind: 'operationKeptInMemory' }
    }),
    // **The surface's own declaration, not a shared guess.** The raw editor loads
    // the disk text into its box; every match surface closes instead, and telling
    // a person their text is about to be replaced by it would describe an action
    // that surface does not perform (2c-4a-3a review, finding 2). The third arm
    // splits `closesSurface` by what the draft is, because the sentence for an
    // authored draft ends by advising a copy that an `operationChoice` surface has
    // no control for and — by consult Q4 — never may.
    reloadWarningFor(capabilities)
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
    // The wire value itself, so an adoption can be matched against the conflict
    // `BrowserState` registered rather than against a look-alike.
    source: result,
    changedAgain,
    draft,
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
 * @param capabilities - The calling surface's own declaration, which decides what
 *   the conflict arm warns a reload would do.
 * @returns The model for that arm.
 */
export function describeWholeDocumentSave<T>(
  outcome: WholeDocumentOutcome,
  draft: Draft<T>,
  capabilities: ConflictCapabilities
): SaveOutcomeModel<T> {
  if (outcome.outcome === 'saved') {
    return describeSaved(outcome);
  }
  return outcome.outcome === 'refused'
    ? describeRefused(outcome, true)
    : describeConflict(outcome, draft, capabilities);
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
 * @param capabilities - The calling surface's own declaration, which decides what
 *   the conflict arm warns a reload would do.
 * @returns The model for that arm.
 */
export function describeEditSave<T>(
  result: SaveResult,
  draft: Draft<T>,
  capabilities: ConflictCapabilities
): SaveOutcomeModel<T> {
  if (result.outcome === 'saved') {
    return describeSaved(result);
  }
  return result.outcome === 'refused'
    ? describeRefused(result, false)
    : describeConflict(result, draft, capabilities);
} // End of function describeEditSave()

/**
 * The disk side of a conflict, as the thing a panel draws.
 *
 * **A union rather than a `string` the renderer inspects**, which is the 2c-4a-3a
 * review's finding 5: three components each wrote `diskText === ''` in their own
 * markup, so *a file of zero characters is a fact about the file rather than a
 * failure to obtain it* was a semantic decision carried by no suite at all. It is
 * decided once, here.
 *
 * **There is no unavailable arm**, and that is 2c-4a-1's D1 rather than an
 * omission: a `SaveResult::Conflict` cannot exist without the read that produced
 * its text having succeeded.
 */
export type ConflictDiskText =
  | {
      /** The file holds characters, and these are them, exactly. */
      readonly kind: 'text';
      /** What to hand `SourceText`, byte for byte. */
      readonly text: string;
    }
  | {
      /** The file holds no characters at all. A fact about the file. */
      readonly kind: 'empty';
    };

/** The one empty verdict, shared rather than rebuilt per read. */
const NO_CHARACTERS: ConflictDiskText = Object.freeze({ kind: 'empty' as const });

/**
 * What the disk side of one conflict shows.
 *
 * @typeParam T - The drafted value.
 * @param conflict - The conflict carrying the text, or `null` when none is showing.
 * @returns The arm to draw, or `null` when there is no conflict.
 */
export function conflictDiskText<T>(conflict: ConflictModel<T> | null): ConflictDiskText | null {
  if (conflict === null) {
    return null;
  }
  return conflict.diskText === '' ? NO_CHARACTERS : { kind: 'text', text: conflict.diskText };
} // End of function conflictDiskText()

/**
 * What an `operationChoice` surface's retained draft **asked for**, as a code.
 *
 * **The consult's Q5 "retained operation summary", as a value rather than as
 * three markup files.** The mover, the deleter and the duplicator draft no text,
 * so the side of the comparison that the other three fill with
 * `RetainedDraftField`s has to be filled with a description of the operation —
 * and a description assembled in a `.svelte` file is a decision no model test can
 * drive and a second renderer can quietly get wrong (2c-3c-3's Medium).
 *
 * **It says what was asked for and never what became of it.** *Nothing was
 * written* is already on screen as {@link SaveOutcomeMessage} `nothingWasWritten`;
 * repeating the claim here would be two sentences that have to be kept in step.
 *
 * **It names no snippet.** A `MatchId` is revision-scoped and identifying the
 * corresponding snippet in another revision is 2c-4b's work, so the summary
 * describes the *shape* of the operation and the panel's own header — drawn from
 * the projection this session opened over — is what names the snippet.
 *
 * **A summary that points at something else on the screen is an arm of its own,
 * chosen from what that screen is drawing now.** The 2c-4a-3b review's finding 2:
 * the `after` sentence sends the reader to the destination the list still marks,
 * and `movePlacementOptionsOf` drops an anchor whose parse this window has since
 * replaced — so a reprojection arriving while the conflict is displayed left a
 * sentence pointing at a mark that had gone. Which of the two `after` arms is
 * shown is `matchMove.ts`'s decision, taken against the same option list the
 * panel renders.
 */
export type ConflictOperation =
  /** Remove this snippet from its file. The deleter. */
  | 'deleteSnippet'
  /** Copy this snippet immediately after itself. The duplicator. */
  | 'duplicateSnippet'
  /** Move this snippet to the front of its list. The mover's `top` placement. */
  | 'moveToTop'
  /** Move this snippet to the end of its list. The mover's `end` placement. */
  | 'moveToEnd'
  /**
   * Move this snippet after another one of its list, **still offered above**.
   *
   * The mover's `after`, while the destination list this panel draws still holds
   * that anchor and still marks it as chosen. Only then may the sentence send the
   * reader to it.
   */
  | 'moveAfterSnippet'
  /**
   * Move this snippet after another one of its list, **no longer offered above**.
   *
   * The same `after`, once this window has replaced the parse the anchor was
   * minted from: `movePlacementOptionsOf` stops offering it, so nothing on screen
   * is marked and the sentence has to say so. It says the anchor is gone from the
   * list and **never** which snippet of the disk version it was — that would be
   * the cross-revision identification 2c-4b owns.
   */
  | 'moveAfterSnippetNoLongerShown'
  /**
   * Replace this file's whole text with the selected backup entry's. Restore.
   *
   * **It names no batch, no entry and no time**, for the reason every other member
   * names no snippet: the summary describes the *shape* of the operation, and the
   * panel's own header is what names what was selected. It says *the selected
   * backup entry* and never that the entry is older, newer, authentic or
   * recoverable — the claims consult Q6 forbids outright.
   */
  | 'replaceFileFromBackup';

/**
 * The dictionary key holding one operation summary's sentence.
 *
 * A `switch` over literal keys rather than a template, the idiom of every other
 * describer in this directory: a renamed key is a compile error here, and a new
 * member of {@link ConflictOperation} with no sentence is one too.
 *
 * @param operation - What the retained draft asked for.
 * @returns The key holding that summary's sentence.
 */
export function conflictOperationKey(operation: ConflictOperation): TranslationKey {
  switch (operation) {
    case 'deleteSnippet':
      return 'browser.saveOutcome.operation.deleteSnippet';
    case 'duplicateSnippet':
      return 'browser.saveOutcome.operation.duplicateSnippet';
    case 'moveToTop':
      return 'browser.saveOutcome.operation.moveToTop';
    case 'moveToEnd':
      return 'browser.saveOutcome.operation.moveToEnd';
    case 'moveAfterSnippet':
      return 'browser.saveOutcome.operation.moveAfterSnippet';
    case 'moveAfterSnippetNoLongerShown':
      return 'browser.saveOutcome.operation.moveAfterSnippetNoLongerShown';
    case 'replaceFileFromBackup':
      return 'browser.saveOutcome.operation.replaceFileFromBackup';
  }
} // End of function conflictOperationKey()

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
 * What a save would do with one field of a retained draft.
 *
 * **Three arms, because those are the three things a draft says about a key**, and
 * they are exactly the arms of the wire's own `DraftField<T>`: leave it alone,
 * write this text, take the key out. A two-valued *present / marked for removal*
 * status would have had to call an absent field left blank "present", which is a
 * claim about what a save writes and is the opposite of what it writes — the one
 * rule the whole draft-versus-projection arrangement exists for
 * (`matchEditor.ts`'s `fieldIntent`).
 */
export type DraftFieldStatus =
  /** The file keeps whatever it has here; this save says nothing about it. */
  | 'unchanged'
  /** This text is what the save would write. */
  | 'setting'
  /** The key would be taken out of the file. */
  | 'removing';

/**
 * One labelled piece of a draft a conflict retained.
 *
 * **The panel draws this list and the clipboard copy is built from the same
 * list**, so what a person is told they copied is what they were shown. It is a
 * *reference*: labels, exact text and an explicit status, in the surface's own
 * stable field order — never YAML, which would drop comments, key order and
 * scalar spelling while looking like something that could be pasted back
 * (consult Q4, and `CLAUDE.md` section 6 on projection-based emission).
 */
export interface RetainedDraftField {
  /** The label, as the detail pane's own code, rendered through `tDetailField`. */
  readonly label: DetailFieldName;
  /**
   * What the control holds, exactly.
   *
   * Copied through unchanged, including a carriage return a projected value may
   * carry: this is the drafted value and not a rendering of it.
   */
  readonly text: string;
  /** What a save would do with this key. */
  readonly status: DraftFieldStatus;
}

/**
 * The wording {@link referenceCopyOf} needs, supplied by the i18n layer.
 *
 * **The format is here and the sentences are not**, which is the split every
 * model in this directory makes: the order of the blocks, the fact that the
 * heading comes first and the fact that each field's text is inserted byte for
 * byte are rules a test can fail on, and the strings they are assembled from
 * come from `src/lib/i18n`. `tDraftCopy` there is the only caller.
 */
export interface DraftCopyWording {
  /** The first line, which says the copy is a reference and not YAML. */
  readonly heading: string;
  /** Names one field. `tDetailField`. */
  readonly label: (name: DetailFieldName) => string;
  /** Says what a save would do with it. `tDraftFieldStatus`. */
  readonly status: (status: DraftFieldStatus) => string;
}

/**
 * The labelled reference copy of a retained draft, as plain text.
 *
 * **Every copied string survives byte for byte**, which is the whole of the
 * honesty claim: the labels and statuses are prose around the values and nothing
 * touches the values themselves. A field is one block — its label and status on
 * one line, its text under them — and the blocks come in the order the caller
 * gives, which is the surface's own stable field order.
 *
 * **What this cannot force**, in the same sentence as what it does: it forces the
 * order, the heading's position and the exactness of each `text`, and it cannot
 * force that the *clipboard route* a component picks preserves them — a
 * `<textarea>` carrier normalises a carriage return, which is why
 * `src/lib/components/clipboard.ts` refuses that route for a value holding one
 * rather than copying something else.
 *
 * @param fields - The retained draft, in the order to show it.
 * @param wording - The localized pieces to assemble it from.
 * @returns The text to put on the clipboard.
 */
export function referenceCopyOf(
  fields: readonly RetainedDraftField[],
  wording: DraftCopyWording
): string {
  const blocks = fields.map(
    (field) => `${wording.label(field.label)} (${wording.status(field.status)})\n${field.text}`
  );
  return [wording.heading, ...blocks].join('\n\n');
} // End of function referenceCopyOf()

/**
 * The dictionary key holding one field status's phrase.
 *
 * A `switch` over literal keys rather than a template, the idiom every describer
 * in this directory follows: a renamed key is a compile error here, and a new
 * member of {@link DraftFieldStatus} with no phrase is one too.
 *
 * @param status - What a save would do with the field.
 * @returns The key holding that status's phrase.
 */
export function draftFieldStatusKey(status: DraftFieldStatus): TranslationKey {
  switch (status) {
    case 'unchanged':
      return 'browser.saveOutcome.field.unchanged';
    case 'setting':
      return 'browser.saveOutcome.field.setting';
    case 'removing':
      return 'browser.saveOutcome.field.removing';
  }
} // End of function draftFieldStatusKey()

/**
 * The brand of a reload confirmation. Declared, never exported, never at runtime.
 */
declare const CONFIRMED: unique symbol;

/**
 * Authorization to act on **one** conflict's disk observation, once.
 *
 * Issued by {@link confirmReloadDiskVersion} for one conflict state, and checked
 * against it by {@link reloadDiskVersion} and by {@link authorizeDiskAdoption}. It
 * exists because the previous shape said `reloadNeedsConfirmation: true` and
 * nothing enforced it: a boolean describing a requirement is not the requirement.
 *
 * **The name records the transition that first needed one, not the only one that
 * does.** Since 2c-4b-2 a *reapply* mints one too, through
 * {@link reapplyAuthorizationFor}, and a reapply does **not** discard the draft and
 * asks the person no second question — the consult's Q6 rules that a reapply needs
 * no reload-style confirmation. What the two share, and all this value carries, is
 * the binding: one conflict, one spend, checked by
 * `BrowserState.adoptDiskVersion`. The type is not renamed here because six
 * components name it and 2c-4b-2 may not touch a `.svelte` file; the debt is
 * recorded rather than hidden.
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
 * The one authorization each conflict's reapply may ever spend.
 *
 * **Keyed by the wire value, not by the model.** `describeEditSave` builds a fresh
 * {@link ConflictModel} on every call, so a memo keyed on the model would hand a
 * second description of *the same* conflict a second unspent token. The wire value
 * is the key `rememberTheConflict` already uses in `./workspace.svelte.ts`, for the
 * same reason; the review round of 2c-4b-2 found this map disagreeing with it.
 */
const REAPPLY_AUTHORIZATIONS = new WeakMap<ConflictResult, ReloadConfirmation>();

/**
 * The authorization a reapply of one conflict spends.
 *
 * **One conflict, one token, and that is what makes "one spend" true rather than
 * intended.** A reapply asks the person no second question — the consult's Q6 —
 * so there is no `confirming` step to hold the token on, as the reload's
 * `ReloadStep` does. Minting a fresh one per attempt would therefore hand every
 * attempt a token `BrowserState.adoptDiskVersion`'s spent-confirmation guard had
 * never seen, which is precisely the guard a conflict's reapply must not be able
 * to walk past. So the token is **memoized on the conflict's origin**: the first
 * attempt mints it, every later attempt for the same wire conflict gets that same
 * token back, and the window refuses it.
 *
 * **The key is {@link ConflictModel.source}, the wire value the payload carried
 * whole** — the same key `rememberTheConflict` uses in `./workspace.svelte.ts`, and
 * for the same reason. `describeEditSave` builds a fresh model per call, so a memo
 * keyed on the model object would give a second description of one conflict a
 * second unspent token; the window would then authorize it, find the projection
 * already at the disk revision, and answer `alreadyThere` — a successful adoption
 * from a conflict that had already spent its one. That is what the 2c-4b-2 review
 * found and what this key closes.
 *
 * **It is the existing door and not a parallel one**: the token is
 * {@link confirmReloadDiskVersion}'s own, the origin and projection-generation
 * checks are `BrowserState.adoptDiskVersion`'s own — applied where that method
 * applies them, which for the generation is only on the branch that installs — and
 * nothing here weakens either. What is added is the memo.
 *
 * **What this forces and what it does not, in the same sentence.** All this
 * function forces is that every {@link ConflictModel} over one wire conflict is
 * handed the *same* token; what a caller then does with it is the caller's, and
 * `AdoptTheDiskVersion` in `./editorSave.ts` is an ordinary function type, so an
 * arbitrary one can ignore both the token and the spend. **At most one adoption
 * can succeed per wire conflict** is an implementation fact about the one callback
 * the five match transitions pass, `BrowserState.adoptDiskVersion`: with that
 * method a success spends the token in its own `WeakSet`, and a later attempt is
 * refused — as spent when it presents the model the token was minted for, and by
 * {@link authorizeDiskAdoption} when it presents any other model of that same
 * conflict. Nor does this function force that a caller takes its token
 * from here: {@link confirmReloadDiskVersion} is exported, and a caller that mints
 * its own for an already-adopted conflict is answered `alreadyThere` — a success
 * that installs nothing but is reported as one, because
 * `BrowserState.adoptDiskVersion` settles that question before it reaches the
 * projection-generation check. What holds today is an implementation fact and not a
 * type: every reapply transition that adopts anything — the five match surfaces —
 * takes its token from this function, through `adoptForReapply` in `./reapply.ts`,
 * and the raw editor's takes no adoption function at all.
 *
 * @typeParam T - The drafted value.
 * @param conflict - The conflict state a reapply is being attempted from.
 * @returns The authorization for that conflict's origin, minted once.
 */
export function reapplyAuthorizationFor<T>(conflict: ConflictModel<T>): ReloadConfirmation {
  const held = REAPPLY_AUTHORIZATIONS.get(conflict.source);
  if (held !== undefined) {
    return held;
  }
  const minted = confirmReloadDiskVersion(conflict);
  REAPPLY_AUTHORIZATIONS.set(conflict.source, minted);
  return minted;
} // End of function reapplyAuthorizationFor()

/**
 * The brand of an authorized adoption. Declared, never exported, never at runtime.
 */
declare const AUTHORIZED: unique symbol;

/**
 * The disk observation a confirmed reload is allowed to install into the window.
 *
 * **The value that makes deferred adoption enforceable rather than merely
 * intended.** A conflict writes nothing, so until 2c-4a-2 the six writing wrappers
 * were wrong to install `disk` the moment one arrived: the snippet list re-ordered
 * and the selection moved before the person had chosen anything, leaving their
 * draft on screen against a projection that no longer described it (consult Q2).
 * `BrowserState.adoptDiskVersion` is the one frontend transition that installs it
 * now, and this is the only type it accepts.
 *
 * **It is produced and consumed inside that one method, and this is the 2c-4a-2
 * review's second finding.** The first version handed this value to the surfaces:
 * `authorizeDiskAdoption` bound it to its conflict, and then nothing bound the
 * *spending*, so a surface could retain one, replay it, hand it to another
 * `BrowserState`, or spend it while a later conflict was on screen. Nothing carries
 * one across a module boundary now — a surface hands `BrowserState` the conflict
 * and the confirmation, and the authorization and the install happen in the same
 * synchronous call — so the class of defect is gone rather than guarded.
 *
 * **What that forces, and what it does not, in the same sentence.** It forces that
 * an adoption cannot be assembled from a `DocumentView` a caller happens to hold:
 * the brand is nameable only inside this module and {@link authorizeDiskAdoption}
 * is its only producer, which in turn requires the confirmation issued for that
 * exact conflict. It does not force the *window-side* answers — a confirmation
 * issued for another conflict, one already spent, a conflict that window did not
 * produce, an unprojected document, or a projection replaced since the conflict
 * arrived when the window does not already hold the requested revision, that last
 * clause being load-bearing because a window already **at** the disk revision is a
 * {@link DiskAdoptionOutcome} `alreadyThere`, decided before the projection
 * generation is compared at all, and not a refusal. Those are
 * `BrowserState.adoptDiskVersion`'s, in that method's order, and are stated
 * there; and the brand is a cast at bottom, exactly as `ReloadConfirmation`,
 * `RoundTripText` and `SealedWholeDocumentSave` are.
 */
export interface DiskAdoption {
  /** The brand. Never present at run time, never nameable outside this module. */
  readonly [AUTHORIZED]: typeof AUTHORIZED;
  /** The projection of the fresh read, to install in place of what the window holds. */
  readonly disk: DocumentView;
  /** The revision that projection and {@link DiskAdoption.diskText} both describe. */
  readonly diskRevision: ContentRevision;
  /** That revision's whole file text, exactly as the file holds it. */
  readonly diskText: string;
}

/**
 * What became of a request to adopt the disk observation.
 *
 * **Three values, because a boolean could not carry the middle one**, and the
 * 2c-4a-2 confirmation pass found the consequence: the window having *already*
 * reached the requested disk projection is a satisfied request, not a refusal, and
 * reporting it as `false` left a surface unable to close or reseed with no way
 * forward but pressing the same control again.
 *
 * A surface treats `installed` and `alreadyThere` alike — the window holds the
 * disk version either way — and must not act on `refused`.
 */
export type DiskAdoptionOutcome =
  /** The window's projection was replaced with the conflict's disk observation. */
  | 'installed'
  /** The window already held exactly those bytes. Nothing to do, and nothing wrong. */
  | 'alreadyThere'
  /** Nothing was installed, and the surface must not act as though it had been. */
  | 'refused';

/**
 * Authorizes installing the disk observation a conflict carried.
 *
 * The second consumer of a {@link ReloadConfirmation}, beside
 * {@link reloadDiskVersion}, and it exists because the consult's Q3 refused to
 * force `reloadDiskVersion<T>(..., value: T)` on the five match surfaces: there is
 * no truthful disk-side `MovePlacement` or `MatchId` to manufacture, and a
 * match-level reload is *confirm abandonment, then adopt the disk document and
 * close* rather than *reload a value*. Both consumers check the same token against
 * the same conflict, so a confirmation collected for one conflict cannot be spent
 * on another.
 *
 * **`BrowserState.adoptDiskVersion` is its only caller**, and that is the shape
 * rather than an accident: what it returns never leaves that method, so no surface
 * can hold, replay or forward an authorized adoption.
 *
 * @typeParam T - The drafted value.
 * @param conflict - The conflict state the person is looking at.
 * @param confirmation - What {@link confirmReloadDiskVersion} issued for it.
 * @returns The adoption, or `null` when the confirmation was not issued for this
 *   conflict — in which case nothing may be installed.
 */
export function authorizeDiskAdoption<T>(
  conflict: ConflictModel<T>,
  confirmation: ReloadConfirmation
): DiskAdoption | null {
  if (CONFIRMATIONS.get(confirmation) !== conflict) {
    return null;
  }
  // The cast is the brand: the property it claims exists only in the type system,
  // and this is the one line in the repository that adds it.
  return {
    disk: conflict.disk,
    diskRevision: conflict.diskRevision,
    diskText: conflict.diskText
  } as DiskAdoption;
} // End of function authorizeDiskAdoption()

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
    case 'operationKeptInMemory':
      return 'browser.saveOutcome.operationKeptInMemory';
    case 'reloadDiscardsDraft':
      return 'browser.saveOutcome.reloadDiscardsDraft';
    case 'reloadClosesSurface':
      return 'browser.saveOutcome.reloadClosesSurface';
    case 'reloadAbandonsOperation':
      return 'browser.saveOutcome.reloadAbandonsOperation';
    case 'reloadRetargetsCandidate':
      return 'browser.saveOutcome.reloadRetargetsCandidate';
    case 'changedAgainSinceRefusal':
      return 'browser.saveOutcome.changedAgainSinceRefusal';
    case 'windowOutOfStep':
      return 'browser.saveOutcome.windowOutOfStep';
  }
} // End of function saveOutcomeMessageKey()

/**
 * The dictionary key holding one conflict choice's label.
 *
 * **Two of the four choices branch on the draft kind, and the second branch is
 * 2c-4a-3c's finding 10.2.** This comment used to say that `keepEditing`
 * *"reuses the raw editor's own label rather than adding a second string that
 * reads the same: it is the same offer, made about a different refusal"*, and
 * that was written before the operation-choice panels existed. It is not the same
 * offer: nothing is being edited on the mover, the deleter or the duplicator, so
 * *Keep editing* named an activity the person never started — a **narrower
 * instance of the finding step 3b closed for the sentences on those three exact
 * surfaces**, which is `CLAUDE.md` section 6's *sweep for what the type now says,
 * not for the words the old finding used* failure, made once more. The window
 * reading is what caught it: `docs/decisions/2c-4a-3c-2-window-reading.md`
 * section 10.2 has *Keep editing* / *Seguir editando* beside a panel about a
 * deletion, a move and a copy.
 *
 * **The draft kind is required rather than defaulted, and 2c-4a-3b is why.**
 * *Discard my text and load it* is what the confirmation does on a surface whose
 * draft is authored text, and it is a claim about text nobody typed on the mover,
 * the deleter and the duplicator — the three panels that first drew this control
 * at 2c-4a-3b. A default here would let one of them inherit the other's sentence
 * silently, which is the argument that made
 * {@link ConflictCapabilities.reloadOutcome} required one field along.
 *
 * **The branch itself moved to `./draftKind` at 3c-4 and is not repeated here.**
 * The review that followed 3c-3 found the *same* rule missing from the refused
 * arm's own way out, and the orchestrator found it a third time in
 * `browser.saveOutcome.reloadUnavailable`; three sentences deciding one thing in
 * three places is a rule that can be fixed twice. {@link draftKindWording} is
 * that decision, and this function, {@link reloadUnavailableKey} and
 * `rawSaveChoiceKey` are its three callers.
 *
 * **What no type forces**: that the caller passes the draft kind its own surface
 * declares. It is an ordinary {@link ConflictDraftKind}, so a component may hand
 * over the wrong one; what is closed is that it cannot omit the question. Nor can
 * any type here force that the two labels *say* what this comment claims —
 * `browser.saveOutcome.choice.keepOperation` could be re-worded to read exactly
 * like `browser.rawSave.choice.keepEditing` and every suite would stay green. The
 * i18n suites check parity and placeholders, never meaning (`CLAUDE.md`
 * section 6); what a test **can** hold is that the two keys are different and
 * that each kind reaches its own, and `saveOutcome.test.ts` holds that.
 *
 * @param choice - What the person may do.
 * @param draftKind - What the calling surface's retained draft is, from its own
 *   `CONFLICT_CAPABILITIES`.
 * @returns The key holding that choice's label.
 */
export function conflictChoiceKey(
  choice: ConflictChoice,
  draftKind: ConflictDraftKind
): TranslationKey {
  switch (choice) {
    case 'keepEditing':
      return draftKindWording(draftKind, {
        authoredText: 'browser.rawSave.choice.keepEditing',
        operationChoice: 'browser.saveOutcome.choice.keepOperation'
      });
    case 'copyDraft':
      return 'browser.saveOutcome.choice.copyDraft';
    case 'keepMyDraft':
      // **The third branch on the draft kind, and it is the same rule as the other
      // two.** *Keep my draft* names text on the raw editor, the match editor and
      // the creator; on the mover, the deleter and the duplicator there is no
      // draft in that sense — a placement and an identity are not authored text —
      // so the label names the requested action instead (consult Q6).
      return draftKindWording(draftKind, {
        authoredText: 'browser.saveOutcome.choice.keepMyDraft',
        operationChoice: 'browser.saveOutcome.choice.keepMyRequest'
      });
    case 'reloadDiskVersion':
      return 'browser.saveOutcome.choice.reloadDiskVersion';
    case 'confirmReload':
      return draftKindWording(draftKind, {
        authoredText: 'browser.saveOutcome.choice.confirmReload',
        operationChoice: 'browser.saveOutcome.choice.confirmReloadClosing'
      });
  }
} // End of function conflictChoiceKey()

/**
 * The dictionary key holding the sentence a withdrawn reload control leaves
 * behind.
 *
 * **The third instance of the same rule, and the orchestrator's own finding
 * rather than the review's.** The single sentence this replaces ended *"Keep
 * editing, or stop and open the file again"* and was drawn by a bare key literal
 * on all six surfaces, three of which draft an operation and edit nothing. It is
 * the same defect as `conflictChoiceKey`'s `keepEditing` and as
 * `rawSaveChoiceKey`'s, one sentence along, and all three are now decided by
 * {@link draftKindWording}.
 *
 * **This arm is not reachable through the controls a conflict panel draws, and
 * the argument is written out rather than asserted from a short list.**
 * `reloadUnavailable` is drawn for a {@link DiskAdoptionOutcome} of `refused`, and
 * `BrowserState.adoptDiskVersion` has **five** refusal returns, not three:
 *
 * 1. the confirmation was issued for another conflict —
 *    {@link authorizeDiskAdoption} answers `null`;
 * 2. the confirmation has already been spent through that state;
 * 3. the conflict is one that state never registered, or the origin recorded when
 *    it arrived names a different document from the one the payload carries;
 * 4. the document is no longer projected there;
 * 5. that document's projection generation has moved since the conflict arrived
 *    **and** the window does not already hold the requested revision. The order is
 *    load-bearing and this clause is 2c-4b-3's correction of it: the satisfied
 *    request is settled first, so a window that has reprojected *to those exact
 *    bytes* answers `alreadyThere` and never reaches this check.
 *
 * **Why the current window supplies none of the five, which is a separate claim
 * from the list.** The first two are closed by how a confirmation is minted and
 * spent: `reloadConfirmed` issues it from the conflict the session is showing and
 * stores it on that session's `ReloadStep`, every surface mints and spends in
 * **one synchronous expression**, and `DetailPane.svelte` forwards the conflict and
 * that confirmation together while retaining neither — so no control can pair a
 * confirmation with another conflict, nor present a spent one, because the spend
 * leaves the `confirmed` step in the same handler (`NOT_RELOADING` on a success,
 * `RELOAD_REFUSED` on a refusal) and `offeredReloadStep` then names no reload label
 * at all. The third is closed because every conflict a surface can show arrived
 * through one of the six writing wrappers, each of which calls
 * `rememberTheConflict` for that document at the moment it arrived. The last two
 * ask about the projection, and the one control that calls
 * `BrowserState.rereadDocument` — the mover's and the duplicator's `reloadFile` —
 * is offered only from a `sendFailure`, which a conflict outcome does not set.
 *
 * **Since 2c-4b-3 the panel draws a control that *does* replace the projection,
 * and this is where that is accounted for.** *Keep my draft* adopts through the
 * very same door, so a successful reapply installs a view and bumps the generation.
 * It does not put a later reload in front of a moved projection, because the two
 * arms that adopt — `reapplied` and `alreadySatisfied` — both hand the surface a
 * rebuilt session whose outcome is `null`, so the conflict panel that could offer a
 * reload is gone in the same synchronous handler; and the arms that leave the panel
 * standing adopt nothing at all, because every transition decides its whole rebase
 * before it asks the window to move. **That is an implementation fact about the six
 * transitions and about six components, not something these types force**, and what
 * drives it is each surface's own suite together with the six mounted suites.
 *
 * **What that argument is worth, in the same place as the argument.** It is about
 * the controls this window draws; it is not a proof that no reprojection begun
 * before the panel appeared can land while it is open, which is precisely what
 * guard 5 exists for. What covers this sentence is the six mounted suites, which
 * script the adoption answer directly and therefore do **not** establish which of
 * the five guards produced it. The window readings drew the sentence's siblings and
 * not this one; that is evidence about those launches, not an exhaustive proof.
 *
 * @param draftKind - What the calling surface's retained draft is, from its own
 *   `CONFLICT_CAPABILITIES`.
 * @returns The key holding that surface's version of the sentence.
 */
export function reloadUnavailableKey(draftKind: ConflictDraftKind): TranslationKey {
  return draftKindWording(draftKind, {
    authoredText: 'browser.saveOutcome.reloadUnavailable',
    operationChoice: 'browser.saveOutcome.reloadUnavailableOperation'
  });
} // End of function reloadUnavailableKey()

/**
 * Which arm of a save outcome a panel is showing.
 *
 * **Derived from {@link SaveOutcomeModel} rather than restated**, which is the
 * 2c-4a-3c review's third finding: the first version of this union lived in
 * `src/lib/components/reveal.ts` and was written out as three literals
 * *specifically* to avoid depending on `src/lib/browser/`, which reverses the
 * project's binding architecture rule instead of satisfying it. A new arm of a
 * save outcome is now a compile error in {@link outcomeReveal} rather than a
 * silent gap in the cue.
 */
export type OutcomeArm = SaveOutcomeModel<unknown>['kind'];

/**
 * What, if anything, to ask to have brought into view when an outcome panel
 * changes.
 *
 * **Five values and not three, which is the 2c-4a-3c review's second finding.**
 * The first version answered one `'panel'` for all three arms, so a component's
 * `$effect` depended on a cue that did **not** change when one arm replaced
 * another over the same bound element — and the concrete path is this
 * application's most ordinary one: an acknowledgeable refusal followed by *Save
 * anyway*. `beginSave` retains the outcome in flight, so `refused` is replaced by
 * `saved` with no `null` interval, the panel node and the old cue both survive,
 * and the effect need not run at all. The person is left near the controls at the
 * bottom of the panel that has just gone, with the new panel's first line — *The
 * file was written* — above the viewport.
 *
 * **The three panel values ask for identical scrolling**; what they are for is
 * the *identity* of the arm, so a replacement is a change. `revealOutcome` in
 * `src/lib/components/reveal.ts` maps all three to `block: 'start'`, which is
 * where the sentence that says what happened is.
 *
 * **Two targets and not one**, which is finding 10.4 rather than an elaboration
 * of 10.3. Pressing *Load the version on disk* adds the surface's confirmation
 * line to a panel that is already at the end of the scroller, so the content
 * grows *downwards* past a fixed `scrollTop` and the confirmation control lands
 * outside the viewport again — measured at y = 771 and y = 788 in a 728 px
 * window. A fix that only pointed at the panel's top would not have moved it,
 * which the reading says in as many words.
 */
export type OutcomeReveal =
  /** Nothing is showing, so nothing is asked for. */
  | 'none'
  /** A save that ran to the end has just appeared: ask for its **first** line. */
  | 'savedPanel'
  /** A refusal has just appeared: ask for its **first** line. */
  | 'refusedPanel'
  /** A conflict has just appeared: ask for its **first** line. */
  | 'conflictPanel'
  /** The reload's second step has just appeared: ask for the **controls**. */
  | 'conflictChoices';

/**
 * What to ask to have brought into view for one state of one outcome panel.
 *
 * **The panel's top, not its bottom, when it appears.** The first line of a
 * conflict panel is *Nothing was written*, and that is the sentence the window
 * reading found nobody could see; a reveal that framed the controls instead would
 * ask for the destructive choice and ask for nothing on behalf of the statement
 * that nothing had happened.
 *
 * **This is a rule and it lives here for that reason.** Pointing a viewport is a
 * question only a document can answer, and the `scrollIntoView` machinery is
 * still in `src/lib/components/reveal.ts` — but *which* thing must be revealed,
 * and when, is decided from save-model state, and a decision written into a
 * renderer is carried by that renderer's mounted suite alone (2c-3c-3's Medium).
 *
 * **What no type here can force**: that a component binds the elements it hands
 * to `revealOutcome`, or that it runs the effect at all. Both are deletable in
 * silence, and each of the six mounted suites carries a case for them.
 *
 * @param arm - Which arm is showing, or `null` when no outcome panel is drawn.
 * @param awaitingConfirmation - Whether the reload's second step is on screen.
 * @returns What to reveal.
 */
export function outcomeReveal(
  arm: OutcomeArm | null,
  awaitingConfirmation: boolean
): OutcomeReveal {
  switch (arm) {
    case null:
      return 'none';
    case 'saved':
      return 'savedPanel';
    case 'refused':
      return 'refusedPanel';
    case 'conflict':
      // Guarded on the arm as well as on the flag: only a conflict has a second
      // step, and a surface whose view answered `true` beside a `saved` arm would
      // otherwise scroll past the outcome to a row of controls that mean
      // something else.
      return awaitingConfirmation ? 'conflictChoices' : 'conflictPanel';
  }
} // End of function outcomeReveal()
