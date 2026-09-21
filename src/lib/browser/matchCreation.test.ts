/**
 * The new-snippet form, driven without a screen.
 *
 * Seven groups, and each is a way creation could be wrong in a manner a person
 * would only discover after their file had been written:
 *
 * 1. **the destinations** — every projected file offered, and the four refusals
 *    named rather than filtered out (the consult's Q5);
 * 2. **the position** — the three arms, the `After` default and its two
 *    conditions, and the anchor that must not survive a change of file (Q4);
 * 3. **submittability** — nine typed refusals, each with a sentence in both
 *    languages, and the carriage-return gate on the derived candidate;
 * 4. **the save** — the three arms, the acknowledgement round trip, and what a
 *    commit spends;
 * 5. **history** — the draft spine reused rather than reinvented, coalesced per
 *    field through the shared boundary of `./typing.ts`;
 * 6. **the view** — what a screen would draw, derived on every read;
 * 7. **the external session** — Phase 2d-6-3: the receiver as a value over a
 *    chosen destination and over none, the held observation, the uncertainty,
 *    the anchor evidence read off a correspondence table, and the
 *    destination-less form that refuses to choose a file for the person.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { describe, expect, it } from 'vitest';
import { DICTIONARIES } from '../i18n/dictionaries';
import { LOCALES } from '../i18n/locale';
import type {
  ContentRevision,
  DocumentSummary,
  DocumentView,
  Finding,
  MatchId,
  ReapplyPlacement,
  ReapplyResolution,
  SaveResult
} from '../ipc/types';
import { editDraft } from './draft';
import { makeConflict, makeDocument, makeMatch, makeSummary } from './fixtures';
import type { InvalidationStatus } from './invalidation';
import {
  acknowledgeCreationFindings,
  acknowledgeSnapshot,
  applyCreate,
  applyObservation,
  askToReloadDiskVersion,
  baseRevisionOf,
  beginCreate,
  canChooseDestination,
  canCreate,
  chooseDestination,
  choosePlacement,
  chosenDestination,
  confirmDiskReload,
  conflictOf,
  createCouldNotBeSent,
  creationReapplyObstacleKey,
  creationRefusal,
  creationRefusalKey,
  creationTargetOf,
  destinationRefusalKey,
  destinationsOf,
  editCreationField,
  focusCreationField,
  isEditable,
  keepDrafting,
  matchCreationView,
  newMatchOf,
  placementOptionsOf,
  reapplyToDiskVersion,
  redoCreation,
  reloadTheDiskVersion,
  startMatchCreation,
  undoCreation,
  wirePosition,
  type CreationBuffers,
  type CreationReapplyObstacle,
  type CreationRefusal,
  type DestinationRefusal,
  type MatchCreationSession
} from './matchCreation';
import { NOT_RELOADING, type AdoptTheDiskVersion } from './editorSave';
import {
  externalConflictSource,
  standingConflictOf,
  type ConflictSource,
  type ExternalChangeConflictSource,
  type ExternalConflictObservation,
  type ObservationVerdict
} from './conflictSource';
import {
  arbitratedDelivery,
  retainedDelivery,
  writtenHereDelivery,
  type ObservationDelivery
} from './observationDelivery';
import { describeCreationReapplyObstacle } from '../i18n';
import type { CorrespondenceEntry, MatchView } from '../ipc/types';
import { attemptOfReapply, reapplyToShow, type StandingOriginGuard } from './reapply';
import {
  confirmReloadDiskVersion,
  isExternalConflict,
  isSaveConflict,
  type DiskAdoptionOutcome
} from './saveOutcome';
import type { ConflictChoice, ConflictModel, ExternalConflictModel } from './saveOutcome';
import { TYPING_GROUP_IDLE_MS } from './typing';

/** The revision every projection below is minted from. */
const BASE: ContentRevision = 'a'.repeat(64);

/** The revision the file holds after a commit. */
const AFTER: ContentRevision = 'b'.repeat(64);

/**
 * The revision {@link otherFile} is projected at.
 *
 * **Deliberately not {@link BASE}.** Two files a window happens to be holding are
 * two parses of two files, and a fixture in which they share a revision cannot
 * show what a change of destination does to the draft's base — which is half of
 * the first review round's first finding.
 */
const OTHER: ContentRevision = 'c'.repeat(64);

/** A clock a test drives by hand. */
class Ticker {
  /** The reading the next call answers. */
  private now = 0;

  /**
   * The clock to hand {@link startMatchCreation}.
   *
   * @returns The current reading, in milliseconds.
   */
  readonly clock = (): number => this.now;

  /**
   * Moves the reading forward.
   *
   * @param by - How many milliseconds to advance.
   */
  advance(by: number): void {
    this.now += by;
  } // End of function advance()
} // End of class Ticker

/**
 * A snippet file with two snippets in it.
 *
 * @returns The projection.
 */
function snippetFile(): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision: BASE,
    matches: [
      makeMatch({ node: 10, document: 2, revision: BASE, trigger: ':sig' }),
      makeMatch({ node: 11, document: 2, revision: BASE, trigger: ':date' })
    ]
  });
} // End of function snippetFile()

/**
 * A second snippet file, for the cross-file cases.
 *
 * @returns The projection.
 */
function otherFile(): DocumentView {
  return makeDocument({
    id: 3,
    relativePath: 'match/other.yml',
    revision: OTHER,
    matches: [makeMatch({ node: 20, document: 3, revision: OTHER, trigger: ':sql' })]
  });
} // End of function otherFile()

/**
 * A config profile, which espanso loads no snippets out of.
 *
 * @returns The projection.
 */
function profile(): DocumentView {
  return makeDocument({ id: 1, relativePath: 'config/default.yml', kind: 'ConfigProfile' });
} // End of function profile()

/**
 * A snippet file the substrate did not accept.
 *
 * @returns The projection.
 */
function unparsedFile(): DocumentView {
  return makeDocument({ id: 4, relativePath: 'match/broken.yml', parsed: false });
} // End of function unparsedFile()

/**
 * A snippet file that parses and holds no `matches:` key.
 *
 * @returns The projection.
 */
function listlessFile(): DocumentView {
  return makeDocument({ id: 5, relativePath: 'match/vars.yml', topLevelKeys: ['global_vars'] });
} // End of function listlessFile()

/**
 * A file from the Hub, which this application may never write.
 *
 * @returns The projection.
 */
function packageFile(): DocumentView {
  return makeDocument({
    id: 6,
    relativePath: 'match/packages/x/package.yml',
    kind: 'Package',
    readOnly: true
  });
} // End of function packageFile()

/** Every file the tests below can offer as a destination. */
function everyFile(): readonly DocumentView[] {
  return [profile(), snippetFile(), otherFile(), unparsedFile(), listlessFile(), packageFile()];
} // End of function everyFile()

/**
 * The summary a window would list one projected file under.
 *
 * The destination list is built from the summaries since the first review round's
 * sixth finding, so every case needs both halves of a file. Derived from the
 * projection rather than written twice, because a summary that disagreed with its
 * own projection is a fixture the next reader trusts.
 *
 * @param view - The projection to describe.
 * @returns The summary the window would hold beside it.
 */
function summaryOf(view: DocumentView): DocumentSummary {
  return makeSummary({
    id: view.id,
    relativePath: view.relative_path,
    kind: view.kind,
    readOnly: view.read_only
  });
} // End of function summaryOf()

/**
 * A form over {@link snippetFile} and {@link otherFile}, with a clock.
 *
 * @param held - The snippet the window has selected, or `null`.
 * @param clock - Where the typing boundary's readings come from.
 * @returns A clean form.
 */
function form(held: MatchId | null = null, clock: () => number = () => 0): MatchCreationSession {
  const views = [snippetFile(), otherFile()];
  return startMatchCreation(views.map(summaryOf), views, held, clock);
} // End of function form()

/**
 * A form with a destination chosen and both fields filled in.
 *
 * @returns A form {@link canCreate} answers `true` for.
 */
function ready(): MatchCreationSession {
  let session = chooseDestination(form(), 2);
  session = editCreationField(session, 'trigger', ':new');
  return editCreationField(session, 'replace', 'a body');
} // End of function ready()

/** The identity a committed create answers with. */
const CREATED: MatchId = { document: 2, revision: AFTER, node: 12 };

/** The adoption a save that wrote nothing owes: none. */
const NOT_OWED: InvalidationStatus = { kind: 'notOwed' };

/** The adoption a committed save performed. */
const ADOPTED: InvalidationStatus = { kind: 'done' };

/** The adoption a committed save could not perform. */
const NOT_ADOPTED: InvalidationStatus = {
  kind: 'failed',
  failure: { kind: 'command', error: { code: 'unknownDocument', document: 2 } }
};

/**
 * A `saved` outcome.
 *
 * @param committed - Whether the file was rewritten.
 * @param moved - The created snippet's identity in the new revision.
 * @returns The wire result.
 */
function saved(committed = true, moved: MatchId | null = CREATED): SaveResult {
  return { outcome: 'saved', revision: AFTER, committed, notes: [], backup_taken: false, moved };
} // End of function saved()

/** A finding the gate reported about the candidate. */
const SUSPICION: Finding = {
  code: { ReferenceHasNoDeclaration: { name: 'greeting' } },
  span: null,
  node: null,
  path: null
};

/** A refusal carrying that finding. */
const REFUSED: SaveResult = {
  outcome: 'refused',
  verdict: 'RefusedForUnacknowledgedSuspicions',
  findings: [SUSPICION]
};

/** A conflict: the file moved on and nothing was written. */
const CONFLICT: SaveResult = {
  outcome: 'conflict',
  reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
  expected: BASE,
  found: AFTER,
  disk_revision: AFTER,
  disk_text: 'matches:\n  - trigger: x\n    replace: theirs\n',
  disk: snippetFile()
};

describe('the destinations a form offers', () => {
  it('offers every projected file, in the order the window holds them', () => {
    const views = everyFile();
    const offered = destinationsOf(views.map(summaryOf), views);
    expect(offered.map((one) => one.document)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('names why an ineligible file is ineligible rather than dropping it', () => {
    const views = everyFile();
    const offered = destinationsOf(views.map(summaryOf), views);
    const reasons = offered.map((one) =>
      one.eligibility.kind === 'ineligible' ? one.eligibility.reason : null
    );
    expect(reasons).toEqual([
      // A config profile: espanso loads no snippets out of `config/`.
      'notASnippetFile',
      null,
      null,
      'notParsed',
      'noMatchList',
      'readOnly'
    ]);
  });

  it('offers a file it could not read, rather than leaving it out', () => {
    // The first review round's sixth finding, and the consult's Q5 read literally:
    // the sidebar names a file whose `get_document` refused, and a destination list
    // that simply omitted it would be shorter than the window with no explanation
    // anywhere. It is offered, and it says why it cannot be chosen.
    const views = [snippetFile(), otherFile()];
    const unreadable = makeSummary({ id: 7, relativePath: 'match/unreadable.yml' });
    const offered = destinationsOf([...views.map(summaryOf), unreadable], views);
    expect(offered.map((one) => one.document)).toEqual([2, 3, 7]);
    expect(offered[2]?.eligibility).toEqual({ kind: 'ineligible', reason: 'couldNotBeRead' });
    // Nothing is known about its parse, so it claims nothing about one.
    expect(offered[2]?.revision).toBe('');
    expect(offered[2]?.anchors).toEqual([]);
    expect(offered[2]?.path).toBe('match/unreadable.yml');
  });

  it('still refuses an unread file on the facts its summary carries', () => {
    // The order of the checks is a claim about which fact is the most fundamental,
    // and the first two are the summary's own — so a package nobody could read is
    // `readOnly` rather than `couldNotBeRead`, which is the reason a person can act
    // on.
    const profileSummary = makeSummary({
      id: 8,
      relativePath: 'config/other.yml',
      kind: 'ConfigProfile'
    });
    const packageSummary = makeSummary({
      id: 9,
      relativePath: 'match/packages/y/package.yml',
      kind: 'Package',
      readOnly: true
    });
    const offered = destinationsOf([profileSummary, packageSummary], []);
    expect(offered.map((one) => (one.eligibility.kind === 'ineligible' ? one.eligibility.reason : null))).toEqual([
      'notASnippetFile',
      'readOnly'
    ]);
  });

  it('carries the file’s own anchors, by identity, in list order', () => {
    const offered = destinationsOf([summaryOf(snippetFile())], [snippetFile()]);
    expect(offered[0]?.anchors.map((anchor) => anchor.node)).toEqual([10, 11]);
    expect(offered[0]?.revision).toBe(BASE);
    expect(offered[0]?.path).toBe('match/base.yml');
  });

  it('has a sentence for every refusal, in both languages', () => {
    const reasons: readonly DestinationRefusal[] = [
      'notASnippetFile',
      'readOnly',
      'couldNotBeRead',
      'notParsed',
      'noMatchList'
    ];
    for (const locale of LOCALES) {
      for (const reason of reasons) {
        expect(DICTIONARIES[locale][destinationRefusalKey(reason)].length).toBeGreaterThan(0);
      }
    } // End of the loop over the two locales
  });
}); // End of the "destinations" suite

describe('where in the file the snippet goes', () => {
  it('defaults to following the held snippet when it is in the file chosen', () => {
    const held = snippetFile().matches[1]!.id;
    const session = form(held);
    expect(session.chosen).toBe(2);
    expect(session.placement).toEqual({ kind: 'after', anchor: held });
  });

  it('defaults to the end when the held snippet is in another file', () => {
    const held = otherFile().matches[0]!.id;
    const session = chooseDestination(form(held), 2);
    expect(session.placement).toEqual({ kind: 'end' });
  });

  it('defaults to the end when the held identity is from another revision', () => {
    // The identity resolves to a *different* snippet in the parse the command
    // reads, which is exactly what `create_match` refuses rather than resolves.
    const stale: MatchId = { document: 2, revision: AFTER, node: 10 };
    const session = form(stale);
    expect(session.placement).toEqual({ kind: 'end' });
  });

  it('defaults to the end when nothing is selected, and chooses no file', () => {
    const session = form(null);
    expect(session.chosen).toBeNull();
    expect(session.placement).toEqual({ kind: 'end' });
    expect(creationRefusal(session)).toBe('noDestination');
  });

  it('replaces an anchor that does not belong to the file newly chosen', () => {
    const held = snippetFile().matches[0]!.id;
    const session = form(held);
    expect(session.placement.kind).toBe('after');
    const moved = chooseDestination(session, 3);
    // The whole of the consult's Q4's second half: an anchor from another file
    // cannot survive the change, because the placement is recomputed rather than
    // kept.
    expect(moved.placement).toEqual({ kind: 'end' });
  });

  it('refuses an anchor that is not one of the chosen file’s own', () => {
    const session = chooseDestination(form(), 2);
    const stranger = otherFile().matches[0]!.id;
    expect(choosePlacement(session, { kind: 'after', anchor: stranger })).toBe(session);
    const stale: MatchId = { document: 2, revision: AFTER, node: 10 };
    expect(choosePlacement(session, { kind: 'after', anchor: stale })).toBe(session);
  });

  it('withdraws consent and everything said when the destination moves', () => {
    // **The first review round's first finding.** Consent is content-addressed to
    // the *buffers*, and the buffers do not move when the destination does — so
    // findings accepted for a refusal in file A were still bound after a retarget
    // to file B, and `beginCreate` sent them. Identical finding values would then
    // have authorised a transaction nobody was ever shown.
    const started = beginCreate(ready());
    const consented = acknowledgeCreationFindings(applyCreate(started!.session, REFUSED, NOT_OWED));
    expect(beginCreate(consented)!.submission.acknowledgement).toEqual({ accepted: [SUSPICION] });
    expect(consented.draft.baseRevision).toBe(BASE);

    const retargeted = chooseDestination(consented, 3);
    expect(beginCreate(retargeted)!.submission.acknowledgement).toEqual({ accepted: [] });
    expect(retargeted.outcome).toBeNull();
    expect(retargeted.submitted).toBeNull();
    expect(matchCreationView(retargeted).refusalChoices).toEqual([]);
    // And the draft is drafted from the file it would now be written to.
    expect(retargeted.draft.baseRevision).toBe(OTHER);
    // What the person typed is theirs, and means the same thing in either file.
    expect(retargeted.draft.value).toEqual({ trigger: ':new', replace: 'a body' });
  });

  it('withdraws consent and everything said when the position moves', () => {
    // *Front* and *After :sig* are two different transactions, so the same finding
    // is the same argument as for the destination.
    const started = beginCreate(ready());
    const consented = acknowledgeCreationFindings(applyCreate(started!.session, REFUSED, NOT_OWED));
    const moved = choosePlacement(consented, { kind: 'front' });
    expect(beginCreate(moved)!.submission.acknowledgement).toEqual({ accepted: [] });
    expect(moved.outcome).toBeNull();
    expect(moved.submitted).toBeNull();
    // The file has not changed, so the base revision has not either.
    expect(moved.draft.baseRevision).toBe(BASE);
  });

  it('says nothing about a placement that is the one already held', () => {
    // A control that re-emits its own value must not clear a refusal panel nobody
    // dismissed, which is what the withdrawal above would otherwise do.
    const started = beginCreate(ready());
    const refused = applyCreate(started!.session, REFUSED, NOT_OWED);
    expect(choosePlacement(refused, { kind: 'end' })).toBe(refused);
    const anchor = snippetFile().matches[0]!.id;
    const after = choosePlacement(refused, { kind: 'after', anchor });
    expect(choosePlacement(after, { kind: 'after', anchor })).toBe(after);
  });

  it('accepts an anchor the chosen file holds, and the three wire positions', () => {
    const session = chooseDestination(form(), 2);
    const anchor = snippetFile().matches[0]!.id;
    const after = choosePlacement(session, { kind: 'after', anchor });
    expect(after.placement).toEqual({ kind: 'after', anchor });
    expect(wirePosition(after.placement)).toEqual({ After: { anchor } });
    expect(wirePosition({ kind: 'front' })).toEqual({ Front: {} });
    expect(wirePosition({ kind: 'end' })).toEqual({ End: {} });
  });
}); // End of the "position" suite

describe('what makes the form submittable', () => {
  it('is submittable once a file is chosen and both values are given', () => {
    expect(canCreate(ready())).toBe(true);
    expect(creationRefusal(ready())).toBeNull();
  });

  it('refuses with no file chosen', () => {
    expect(creationRefusal(form())).toBe('noDestination');
  });

  it('refuses a file this application will not write a snippet into', () => {
    const views = [profile(), snippetFile()];
    const session = chooseDestination(
      startMatchCreation(views.map(summaryOf), views, null, () => 0),
      1
    );
    const filled = editCreationField(
      editCreationField(session, 'trigger', ':x'),
      'replace',
      'y'
    );
    expect(creationRefusal(filled)).toBe('destinationIneligible');
    expect(beginCreate(filled)).toBeNull();
  });

  it('refuses an empty trigger and an empty body, trigger first', () => {
    const chosen = chooseDestination(form(), 2);
    expect(creationRefusal(chosen)).toBe('triggerEmpty');
    expect(creationRefusal(editCreationField(chosen, 'trigger', ':x'))).toBe('replaceEmpty');
  });

  it('refuses an anchor the chosen file no longer holds', () => {
    // Not reachable through `choosePlacement`, which refuses to install one — this
    // is the state a caller building a session literal can still produce, and the
    // refusal is what stops it reaching the wire.
    const chosen = ready();
    const stranger = otherFile().matches[0]!.id;
    const forced: MatchCreationSession = {
      ...chosen,
      placement: { kind: 'after', anchor: stranger }
    };
    expect(creationRefusal(forced)).toBe('anchorUnavailable');
    expect(beginCreate(forced)).toBeNull();
  });

  it('refuses while a save is in flight, and while a conflict is showing', () => {
    const started = beginCreate(ready());
    expect(creationRefusal(started!.session)).toBe('saveInFlight');
    const conflicted = applyCreate(started!.session, CONFLICT, NOT_OWED);
    expect(creationRefusal(conflicted)).toBe('conflict');
    expect(isEditable(conflicted)).toBe(false);
  });

  it('refuses for good once a create has committed', () => {
    const started = beginCreate(ready());
    const done = applyCreate(started!.session, saved(), ADOPTED);
    expect(creationRefusal(done)).toBe('alreadyCreated');
    // And no transition here clears it: dismissing the panel does not.
    expect(creationRefusal(keepDrafting(done))).toBe('alreadyCreated');
    expect(beginCreate(done)).toBeNull();
  });

  it('has a sentence for every refusal, in both languages', () => {
    const reasons: readonly CreationRefusal[] = [
      'alreadyCreated',
      'saveInFlight',
      'conflict',
      'externalConflict',
      'observationRetained',
      'noDestination',
      'destinationIneligible',
      'anchorUnavailable',
      'triggerEmpty',
      'replaceEmpty',
      'carriageReturn'
    ];
    for (const locale of LOCALES) {
      for (const reason of reasons) {
        expect(DICTIONARIES[locale][creationRefusalKey(reason)].length).toBeGreaterThan(0);
      }
    } // End of the loop over the two locales
  });
}); // End of the "submittability" suite

describe('the carriage return', () => {
  it('cannot be typed into either control', () => {
    const chosen = chooseDestination(form(), 2);
    expect(editCreationField(chosen, 'trigger', 'a\rb')).toBe(chosen);
    expect(editCreationField(chosen, 'replace', 'a\r\nb')).toBe(chosen);
  });

  it('is refused at submit, on the value that would be written', () => {
    // **The caller TypeScript cannot stop.** `CreationBuffers` carries no brand,
    // so a draft built by hand type-checks — and without this gate the value would
    // reach `create_match` and be written into the user's file, where no control in
    // this window could ever read it back.
    const session = ready();
    const forced: MatchCreationSession = {
      ...session,
      draft: editDraft(session.draft, { trigger: ':new', replace: 'a\rb' })
    };
    expect(creationRefusal(forced)).toBe('carriageReturn');
    expect(beginCreate(forced)).toBeNull();
  });
}); // End of the "carriage return" suite

describe('starting a create', () => {
  it('builds the wire values from the submission’s own candidate', () => {
    const started = beginCreate(ready());
    expect(started).not.toBeNull();
    expect(started!.document).toBe(2);
    expect(started!.newMatch).toEqual({ trigger: ':new', replace: 'a body' });
    expect(started!.position).toEqual({ End: {} });
    expect(newMatchOf(started!.submission.candidate)).toEqual(started!.newMatch);
    expect(started!.session.phase).toBe('saving');
    expect(started!.submission.acknowledgement).toEqual({ accepted: [] });
  });

  it('sends the anchor a placement names', () => {
    const anchor = snippetFile().matches[0]!.id;
    const started = beginCreate(choosePlacement(ready(), { kind: 'after', anchor }));
    expect(started!.position).toEqual({ After: { anchor } });
  });
}); // End of the "starting a create" suite

describe('what comes back', () => {
  it('records the created snippet and spends the form on a commit', () => {
    const started = beginCreate(ready());
    const done = applyCreate(started!.session, saved(), ADOPTED);
    expect(done.committed).toBe(true);
    expect(done.created).toEqual(CREATED);
    const view = matchCreationView(done);
    expect(view.committed).toBe(true);
    expect(view.canCreate).toBe(false);
    expect(view.messages.map((message) => message.kind)).toEqual(['fileWritten']);
  });

  it('leaves the form alive when the save committed nothing', () => {
    const started = beginCreate(ready());
    const done = applyCreate(started!.session, saved(false, null), NOT_OWED);
    expect(done.committed).toBe(false);
    expect(done.created).toBeNull();
    // Nothing on disk moved, so nothing this form holds is stale.
    expect(isEditable(done)).toBe(true);
  });

  it('accepts a commit that answered no identity, and says nothing false about it', () => {
    const started = beginCreate(ready());
    const done = applyCreate(started!.session, saved(true, null), ADOPTED);
    expect(done.committed).toBe(true);
    expect(done.created).toBeNull();
  });

  it('puts the out-of-step line beside a commit whose adoption failed', () => {
    const started = beginCreate(ready());
    const done = applyCreate(started!.session, saved(), NOT_ADOPTED);
    const kinds = matchCreationView(done).messages.map((message) => message.kind);
    // Beside the saved arm, never in place of it: the bytes are on disk.
    expect(kinds).toEqual(['fileWritten', 'windowOutOfStep']);
  });

  it('carries a refusal’s findings and the consent that answers them', () => {
    const started = beginCreate(ready());
    const refused = applyCreate(started!.session, REFUSED, NOT_OWED);
    const view = matchCreationView(refused);
    expect(view.outcome?.kind).toBe('refused');
    expect(view.refusalChoices).toEqual(['saveAnyway', 'keepEditing']);
    expect(view.findingsAreStale).toBe(false);

    const consented = acknowledgeCreationFindings(refused);
    const again = beginCreate(consented);
    expect(again!.submission.acknowledgement).toEqual({ accepted: [SUSPICION] });
  });

  it('withdraws the offer to save anyway once the draft has moved on', () => {
    const started = beginCreate(ready());
    const refused = acknowledgeCreationFindings(applyCreate(started!.session, REFUSED, NOT_OWED));
    const typed = editCreationField(refused, 'replace', 'another body');
    const view = matchCreationView(typed);
    expect(view.findingsAreStale).toBe(true);
    expect(view.refusalChoices).toEqual(['keepEditing']);
    // Editing dropped the consent, so the next attempt is an ordinary first one.
    expect(beginCreate(typed)!.submission.acknowledgement).toEqual({ accepted: [] });
  });

  it('offers four ways out of a conflict, and only the reapply reapplies', () => {
    // **2c-4a-3a offered what 2c-4a-2 built, and 2c-4b-3 did it again**: the
    // non-destructive way out first, then the copy that makes the destruction
    // survivable, then the reapply, then the destructive one — which is
    // `conflictChoicesFor`'s ordering and not this module's.
    const started = beginCreate(ready());
    const conflicted = applyCreate(started!.session, CONFLICT, NOT_OWED);
    const view = matchCreationView(conflicted);
    expect(view.conflictChoices).toEqual([
      'keepEditing',
      'copyDraft',
      'keepMyDraft',
      'reloadDiskVersion'
    ]);
    expect(conflictOf(conflicted)).not.toBeNull();
    // *Keep editing* still does not claim to reapply anything: it dismisses the
    // panel and gives the form back, and the phrase belongs to the control that
    // really does rebuild the draft over the newly parsed document.
    for (const locale of LOCALES) {
      const label = DICTIONARIES[locale]['browser.rawSave.choice.keepEditing'].toLowerCase();
      expect(label).not.toContain('keep my draft');
      expect(label).not.toContain('mantener mi borrador');
    } // End of the loop over the two locales
    const kept = keepDrafting(conflicted);
    expect(conflictOf(kept)).toBeNull();
    expect(isEditable(kept)).toBe(true);
  });

  it('labels the retained draft, exactly as the boxes held it', () => {
    // **The list the panel draws and the copy is built from, and it is one list.**
    // Both fields, in `CREATION_FIELDS` order, under the detail pane's own labels,
    // and both `setting`: a create writes both keys, and there is no key here to
    // leave alone or to take out. The destination and the position are absent on
    // purpose — `Draft<CreationBuffers>` does not carry them (consult Q4).
    const started = beginCreate(ready());
    const conflicted = applyCreate(started!.session, CONFLICT, NOT_OWED);
    expect(matchCreationView(conflicted).retainedDraft).toEqual([
      { label: 'trigger', text: ':new', status: 'setting' },
      { label: 'replace', text: 'a body', status: 'setting' }
    ]);
    // And nothing is retained when there is no conflict to retain it.
    expect(matchCreationView(started!.session).retainedDraft).toEqual([]);
  }); // End of the "retained draft" case

  it('records a send that produced no outcome, in its two arms', () => {
    const started = beginCreate(ready());
    const notSent = createCouldNotBeSent(started!.session, false, null);
    expect(notSent.sendFailure).toEqual({ kind: 'notSent', reason: null });
    const failure = {
      kind: 'command' as const,
      error: { code: 'noWorkspaceOpen' as const }
    };
    const maybe = createCouldNotBeSent(started!.session, true, failure);
    expect(maybe.sendFailure).toEqual({ kind: 'mayHaveWritten', reason: failure });
    expect(matchCreationView(maybe).failureLines).toEqual([{ kind: 'failure', failure }]);
    // The draft is untouched either way, so nothing typed is lost.
    expect(maybe.draft.value).toEqual({ trigger: ':new', replace: 'a body' });
  });
}); // End of the "what comes back" suite

describe('the history the form keeps', () => {
  it('coalesces a run of typing in one field into one step', () => {
    const ticker = new Ticker();
    let session = chooseDestination(form(null, ticker.clock), 2);
    session = editCreationField(session, 'trigger', ':');
    ticker.advance(50);
    session = editCreationField(session, 'trigger', ':n');
    ticker.advance(50);
    session = editCreationField(session, 'trigger', ':ne');
    expect(session.draft.past.length).toBe(1);
    expect(undoCreation(session).draft.value.trigger).toBe('');
  });

  it('starts a new step after an idle pause, a blur and a change of field', () => {
    const ticker = new Ticker();
    let session = chooseDestination(form(null, ticker.clock), 2);
    session = editCreationField(session, 'trigger', ':a');
    ticker.advance(TYPING_GROUP_IDLE_MS + 1);
    session = editCreationField(session, 'trigger', ':ab');
    expect(session.draft.past.length).toBe(2);

    session = focusCreationField(session, null);
    session = editCreationField(session, 'trigger', ':abc');
    expect(session.draft.past.length).toBe(3);

    session = editCreationField(session, 'replace', 'x');
    expect(session.draft.past.length).toBe(4);
  });

  it('walks back and forward through what was typed', () => {
    let session = ready();
    expect(matchCreationView(session).canUndo).toBe(true);
    session = undoCreation(session);
    expect(session.draft.value.replace).toBe('');
    expect(matchCreationView(session).canRedo).toBe(true);
    session = redoCreation(session);
    expect(session.draft.value.replace).toBe('a body');
  });

  it('accepts no change at all while a save is in flight', () => {
    const started = beginCreate(ready());
    const waiting = started!.session;
    expect(editCreationField(waiting, 'trigger', ':other')).toBe(waiting);
    expect(chooseDestination(waiting, 3)).toBe(waiting);
    expect(choosePlacement(waiting, { kind: 'front' })).toBe(waiting);
    expect(undoCreation(waiting)).toBe(waiting);
  });
}); // End of the "history" suite

describe('the view a screen draws', () => {
  it('answers everything a control needs, derived on every read', () => {
    const session = ready();
    const view = matchCreationView(session);
    expect(view.chosen).toEqual(chosenDestination(session));
    expect(view.destinations.map((one) => one.document)).toEqual([2, 3]);
    expect(view.trigger).toBe(':new');
    expect(view.replace).toBe('a body');
    expect(view.dirty).toBe(true);
    expect(view.saving).toBe(false);
    expect(view.editable).toBe(true);
    expect(view.canCreate).toBe(true);
    expect(view.refusal).toBeNull();
    expect(view.outcome).toBeNull();
    expect(view.notes).toEqual([]);
    expect(view.created).toBeNull();
  });

  it('carries the presentation notes a saved arm disclosed', () => {
    const started = beginCreate(ready());
    const withNote: SaveResult = {
      outcome: 'saved',
      revision: AFTER,
      committed: true,
      notes: [{ DoubledSequenceSeparation: { edit: 0 } }],
      backup_taken: false,
      moved: CREATED
    };
    const view = matchCreationView(applyCreate(started!.session, withNote, ADOPTED));
    expect(view.notes).toEqual([{ DoubledSequenceSeparation: { edit: 0 } }]);
  });
}); // End of the "view" suite

describe('the positions a screen offers', () => {
  it('offers Front, one option per named anchor in file order, then End', () => {
    // The consult's Q4 order, and the anchors in the order the file writes them —
    // which is the order `CreationDestination.anchors` carries, not one this
    // function chooses.
    const views = [snippetFile(), otherFile()];
    const options = placementOptionsOf(chooseDestination(form(), 2), views);
    expect(options.map((one) => one.placement.kind)).toEqual(['front', 'after', 'after', 'end']);
    expect(options.map((one) => one.anchor?.id.node ?? null)).toEqual([null, 10, 11, null]);
    // The key is built from all three fields of the identity, so two anchors of
    // one file cannot collide and an anchor of an older parse is a different key.
    expect(options[1]?.key).toBe(`after:2:${BASE}:10`);
  });

  it('says which option the form is holding, and only that one', () => {
    const views = [snippetFile(), otherFile()];
    const held = makeMatch({ node: 11, document: 2, revision: BASE }).id;
    const session = chooseDestination(form(held), 2);
    const options = placementOptionsOf(session, views);
    expect(options.filter((one) => one.chosen).map((one) => one.key)).toEqual([
      `after:2:${BASE}:11`
    ]);
  });

  it('offers the two empty arms and no anchor when no destination has been chosen', () => {
    const options = placementOptionsOf(form(), [snippetFile(), otherFile()]);
    expect(options.map((one) => one.placement.kind)).toEqual(['front', 'end']);
    expect(options[0]?.chosen).toBe(false);
    expect(options[1]?.chosen).toBe(true);
  });

  it('stops offering an anchor whose file has been read again', () => {
    // **All three fields, and the revision is the one doing the work.** A window
    // that has re-read the file holds a projection of a different parse, so the
    // form's anchors resolve to nothing and the `after` options go rather than
    // naming a snippet of a revision nobody chose.
    const reread = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: AFTER,
      matches: [
        makeMatch({ node: 10, document: 2, revision: AFTER, trigger: ':sig' }),
        makeMatch({ node: 11, document: 2, revision: AFTER, trigger: ':date' })
      ]
    });
    const options = placementOptionsOf(chooseDestination(form(), 2), [reread, otherFile()]);
    expect(options.map((one) => one.placement.kind)).toEqual(['front', 'end']);
  });

  it('offers no anchor of a file this window holds no projection of', () => {
    const options = placementOptionsOf(chooseDestination(form(), 2), [otherFile()]);
    expect(options.map((one) => one.placement.kind)).toEqual(['front', 'end']);
  });
}); // End of the "positions" suite

describe('the base revision a screen sends', () => {
  it('is the chosen destination’s, and moves with it', () => {
    // The named read a component uses in place of a property walk, and the value
    // `BrowserState.createMatch` forwards unchanged.
    expect(baseRevisionOf(form())).toBe('');
    expect(baseRevisionOf(chooseDestination(form(), 2))).toBe(BASE);
    expect(baseRevisionOf(chooseDestination(chooseDestination(form(), 2), 3))).toBe(OTHER);
  });

  it('is what the submission carries, so the two cannot describe two parses', () => {
    const started = beginCreate(ready());
    expect(started!.submission.baseRevision).toBe(baseRevisionOf(started!.session));
  });
}); // End of the "base revision" suite

describe('the confirmed reload', () => {
  // **2c-4a-2 built this and 2c-4a-3a offers it.** The consult's Q3 gives every
  // one of the six surfaces a confirmed reload; withholding the *offering* until
  // the panel existed was right, and withholding the **transition** was not — an
  // unoffered transition can be built and driven without drawing anything, and
  // leaving it out would have made step 3 invent five model machines on top of
  // five panels. `offersReload` is now `true` for this surface and
  // `MatchCreator.svelte` draws the two controls; every case here calls the
  // transitions directly, as that component's arms do.

  /**
   * A conflicted create of a ready form.
   *
   * @returns The session showing the conflict.
   */
  function conflicted(): MatchCreationSession {
    const started = beginCreate(ready());
    if (started === null) {
      throw new Error('a ready form is sendable');
    }
    return applyCreate(started.session, CONFLICT, NOT_OWED);
  } // End of function conflicted()

  /**
   * A recorder for the window's own adoption.
   *
   * @param answer - What the window answers. `refused` is a real production
   *   answer — a confirmation issued for another conflict, one already spent, a
   *   conflict this window did not produce, an unprojected document, or a
   *   projection replaced since the conflict arrived when the window does not
   *   already hold the requested revision.
   * @returns The callback to pass, and the conflicts it was handed.
   */
  function adopting(answer: DiskAdoptionOutcome = 'installed'): {
    readonly adopt: AdoptTheDiskVersion<CreationBuffers>;
    readonly adoptions: ConflictModel<CreationBuffers>[];
  } {
    const adoptions: ConflictModel<CreationBuffers>[] = [];
    return {
      adopt: (conflict) => {
        adoptions.push(conflict);
        return answer;
      },
      adoptions
    };
  } // End of function adopting()

  it('needs two deliberate steps before anything can be spent', () => {
    const stuck = conflicted();
    const recorder = adopting();
    // Straight to the destructive transition, with no warning behind it.
    expect(reloadTheDiskVersion(stuck, recorder.adopt)).toBe(stuck);
    const asked = askToReloadDiskVersion(stuck);
    expect(matchCreationView(asked).awaitingReloadConfirmation).toBe(true);
    // The warning alone is not a confirmation either.
    expect(reloadTheDiskVersion(asked, recorder.adopt)).toBe(asked);
    expect(recorder.adoptions).toEqual([]);
    expect(matchCreationView(asked).closed).toBe(false);
  }); // End of the "two steps" case

  it('adopts the disk projection once, and closes the session', () => {
    const recorder = adopting();
    const confirmed = confirmDiskReload(askToReloadDiskVersion(conflicted()));
    const after = reloadTheDiskVersion(confirmed, recorder.adopt);

    // **The conflict itself crosses**, not a payload assembled from it: the window
    // authorizes and installs in one call, so nothing here can retain an adoption.
    expect(recorder.adoptions).toHaveLength(1);
    expect(recorder.adoptions[0]).toBe(conflictOf(confirmed));
    // And this session is over. There is no disk-side draft to seed — finding "the
    // same" thing in a revision nobody has described is 2c-4b — so the panel closes.
    expect(after.closed).toBe(true);
    expect(matchCreationView(after).closed).toBe(true);
    expect(conflictOf(after)).toBeNull();
    expect(isEditable(after)).toBe(false);
  }); // End of the "adopt and close" case

  it('finishes the reload when the window was already at the disk version', () => {
    // **`alreadyThere` is a success**, so this session closes exactly as it does
    // for an install: the window holds the disk projection either way, and treating
    // the answer as a failure would leave a confirm control that could never work.
    const satisfied = adopting('alreadyThere');
    const confirmed = confirmDiskReload(askToReloadDiskVersion(conflicted()));
    const after = reloadTheDiskVersion(confirmed, satisfied.adopt);
    expect(after.closed).toBe(true);
    expect(conflictOf(after)).toBeNull();
  }); // End of the "already at the disk version" case

  it('closes nothing when the window refuses the adoption', () => {
    // Closing over a window that never moved would report a reload that did not
    // happen, and take the conflict panel off the screen with it.
    const refusing = adopting('refused');
    const confirmed = confirmDiskReload(askToReloadDiskVersion(conflicted()));
    const after = reloadTheDiskVersion(confirmed, refusing.adopt);
    expect(after.closed).toBe(false);
    // **And the reload stops being offered rather than staying pressable.** The
    // window said no with no word about which guard produced it, so the step is
    // terminal, the panel discloses it, and only *Keep editing* and the copy remain
    // (2c-4a-3a review, finding 3). Terminal is what this panel draws, and not a
    // claim that a later ask would be refused too.
    expect(after.reload.kind).toBe('refused');
    expect(matchCreationView(after).reloadUnavailable).toBe(true);
    expect(matchCreationView(after).awaitingReloadConfirmation).toBe(false);
    expect(matchCreationView(after).conflictChoices).not.toContain('confirmReload');
    expect(matchCreationView(after).conflictChoices).not.toContain('reloadDiskVersion');
    expect(matchCreationView(after).conflictChoices).toContain('keepEditing');
    // Asking again cannot spend anything a second time.
    expect(reloadTheDiskVersion(after, refusing.adopt)).toBe(after);
    expect(refusing.adoptions).toHaveLength(1);
    expect(conflictOf(after)).not.toBeNull();
  }); // End of the "window refused" case

  it('offers the confirmation label once the warning has been asked for', () => {
    // **What 2c-4a-3a changed here, and it is one boolean.** The transition was
    // built and driven by this suite from 2c-4a-2; `offersReload` was `false`, so
    // the list said `['keepEditing']` at both steps. Now the second step names
    // `confirmReload` and never `reloadDiskVersion` beside it.
    const asked = askToReloadDiskVersion(conflicted());
    expect(matchCreationView(asked).conflictChoices).toEqual<readonly ConflictChoice[]>([
      'keepEditing',
      'copyDraft',
      'keepMyDraft',
      'confirmReload'
    ]);
    expect(matchCreationView(asked).awaitingReloadConfirmation).toBe(true);
  });

  it('forgets a confirmation when the panel is dismissed or a new answer arrives', () => {
    // A confirmation is a person's answer to **one** conflict. Reaching the
    // confirmed step and then dismissing must not leave it spendable.
    const recorder = adopting();
    const confirmed = confirmDiskReload(askToReloadDiskVersion(conflicted()));
    const dismissed = keepDrafting(confirmed);
    expect(dismissed.reload.kind).toBe('idle');
    expect(reloadTheDiskVersion(dismissed, recorder.adopt)).toBe(dismissed);
    expect(recorder.adoptions).toEqual([]);
  }); // End of the "dismissal forgets the confirmation" case
}); // End of the "confirmed reload" suite

describe('reapplying the retained form', () => {
  // **2c-4b-2 builds this and 2c-4b-3 draws it.** `ConflictChoice` has no member
  // for a reapply, so nothing here is reachable from a control; every case calls
  // the transition directly.

  /**
   * The destination file, re-read: two new snippets under a new parse.
   *
   * @param overrides - Whatever a case needs the disk file to keep saying.
   * @returns The projection the conflict carries.
   */
  function diskFile(overrides: Parameters<typeof makeDocument>[0] = {}): DocumentView {
    return makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: AFTER,
      matches: [
        makeMatch({ node: 30, document: 2, revision: AFTER, trigger: ':sig' }),
        makeMatch({ node: 31, document: 2, revision: AFTER, trigger: ':date' })
      ],
      ...overrides
    });
  } // End of function diskFile()

  /**
   * A conflicted create whose payload carries chosen correspondence evidence.
   *
   * @param session - The form to submit.
   * @param disk - The newly parsed projection the conflict carries.
   * @param subject - What the search for a snippet answered. A creation's own is
   *   `Targetless`, which is what the command really sends.
   * @param anchor - What the search for the positional anchor answered.
   * @returns The form showing the conflict.
   */
  function conflictedOver(
    session: MatchCreationSession,
    disk: DocumentView,
    subject: ReapplyResolution = { Targetless: {} },
    anchor: ReapplyPlacement = { NotAnchored: {} }
  ): MatchCreationSession {
    const started = beginCreate(session);
    if (started === null) {
      throw new Error('this case needs a form that can be submitted');
    }
    return applyCreate(
      started.session,
      makeConflict({ disk, subject, placement: anchor, expected: BASE, found: AFTER }),
      NOT_OWED
    );
  } // End of function conflictedOver()

  /**
   * A recorder for the window's own adoption.
   *
   * @param answer - What the window answers.
   * @returns The callback to pass, and the conflicts it was handed.
   */
  function adoptingReapply(answer: DiskAdoptionOutcome = 'installed'): {
    readonly adopt: AdoptTheDiskVersion<CreationBuffers>;
    readonly adoptions: ConflictModel<CreationBuffers>[];
  } {
    const adoptions: ConflictModel<CreationBuffers>[] = [];
    return {
      adopt: (conflict) => {
        adoptions.push(conflict);
        return answer;
      },
      adoptions
    };
  } // End of function adoptingReapply()

  it('retains the typed values and re-points the base at the new revision', () => {
    // **Targetless**: there is no snippet to find, because a creation brings its
    // own. What is rebuilt is everything around the two typed strings.
    const disk = diskFile();
    const stuck = conflictedOver(ready(), disk);
    const recorder = adoptingReapply();
    const answer = reapplyToDiskVersion(stuck, recorder.adopt);
    expect(answer.kind).toBe('reapplied');
    if (answer.kind !== 'reapplied') {
      throw new Error('this case is about the rebuilt form');
    }
    expect(answer.session.draft.value).toEqual({ trigger: ':new', replace: 'a body' });
    expect(baseRevisionOf(answer.session)).toBe(AFTER);
    expect(canCreate(answer.session)).toBe(true);
    // The destination the form offers is the one the conflict carried, with the
    // anchors of the parse the window is about to install.
    expect(chosenDestination(answer.session)?.revision).toBe(AFTER);
    expect(chosenDestination(answer.session)?.anchors.map((one) => one.node)).toEqual([30, 31]);
    expect(recorder.adoptions).toEqual([conflictOf(stuck)]);
  });

  it('withdraws consent collected before the conflict', () => {
    // Findings accepted against one revision's candidate say nothing about
    // another's, so the acknowledgement round trip starts again.
    const refused = applyCreate(beginCreate(ready())!.session, REFUSED, NOT_OWED);
    const consented = acknowledgeCreationFindings(refused);
    expect(beginCreate(consented)!.submission.acknowledgement).toEqual({ accepted: [SUSPICION] });
    const stuck = conflictedOver(consented, diskFile());
    const answer = reapplyToDiskVersion(stuck, adoptingReapply().adopt);
    if (answer.kind !== 'reapplied') {
      throw new Error('this case is about the rebuilt form');
    }
    expect(answer.session.draft.consent).toBeNull();
    expect(beginCreate(answer.session)!.submission.acknowledgement).toEqual({ accepted: [] });
  });

  it('keeps a front placement, which the command lowers against the new list', () => {
    const disk = diskFile();
    const stuck = conflictedOver(choosePlacement(ready(), { kind: 'front' }), disk);
    const answer = reapplyToDiskVersion(stuck, adoptingReapply().adopt);
    if (answer.kind !== 'reapplied') {
      throw new Error('this case is about the rebuilt form');
    }
    expect(answer.session.placement).toEqual({ kind: 'front' });
    expect(beginCreate(answer.session)?.position).toEqual({ Front: {} });
  });

  it('ignores the evidence anchor entirely for a semantic placement', () => {
    // `front` and `end` name no snippet, so a refused anchor says nothing about
    // them. The command sends `NotAnchored` for both; a refusal here would be this
    // form reading an answer to a question it never asked.
    const stuck = conflictedOver(choosePlacement(ready(), { kind: 'end' }), diskFile(), undefined, {
      Refused: { reason: 'NoExactCorrespondence' }
    });
    expect(reapplyToDiskVersion(stuck, adoptingReapply().adopt).kind).toBe('reapplied');
  });

  it('rebuilds an after from the identified anchor, never from the old one', () => {
    const disk = diskFile();
    const anchor = disk.matches[1]!;
    const placed = choosePlacement(ready(), {
      kind: 'after',
      anchor: snippetFile().matches[1]!.id
    });
    const stuck = conflictedOver(placed, disk, undefined, { Identified: { target: anchor } });
    const answer = reapplyToDiskVersion(stuck, adoptingReapply().adopt);
    if (answer.kind !== 'reapplied') {
      throw new Error('this case is about the rebuilt form');
    }
    expect(answer.session.placement).toEqual({ kind: 'after', anchor: anchor.id });
    expect(beginCreate(answer.session)?.position).toEqual({ After: { anchor: anchor.id } });
  });

  it('refuses an anchor the core would not establish, and adopts nothing', () => {
    const placed = choosePlacement(ready(), {
      kind: 'after',
      anchor: snippetFile().matches[1]!.id
    });
    const recorder = adoptingReapply();
    const stuck = conflictedOver(placed, diskFile(), undefined, {
      Refused: { reason: 'TargetMissingOrTriggerChanged' }
    });
    expect(reapplyToDiskVersion(stuck, recorder.adopt)).toEqual({
      kind: 'manualResolution',
      obstacle: { kind: 'anchorCorrespondence', reason: 'TargetMissingOrTriggerChanged' }
    });
    expect(recorder.adoptions).toEqual([]);
  });

  it('refuses evidence that answers no anchor although the form names one', () => {
    const placed = choosePlacement(ready(), {
      kind: 'after',
      anchor: snippetFile().matches[1]!.id
    });
    const recorder = adoptingReapply();
    expect(reapplyToDiskVersion(conflictedOver(placed, diskFile()), recorder.adopt)).toEqual({
      kind: 'manualResolution',
      obstacle: { kind: 'evidenceNotAnAnchor' }
    });
    expect(recorder.adoptions).toEqual([]);
  });

  it('refuses an identified anchor the new destination does not hold', () => {
    const placed = choosePlacement(ready(), {
      kind: 'after',
      anchor: snippetFile().matches[1]!.id
    });
    const recorder = adoptingReapply();
    const stranger = makeMatch({ node: 99, document: 2, revision: AFTER, trigger: ':gone' });
    const stuck = conflictedOver(placed, diskFile(), undefined, {
      Identified: { target: stranger }
    });
    expect(reapplyToDiskVersion(stuck, recorder.adopt)).toEqual({
      kind: 'manualResolution',
      obstacle: { kind: 'anchorNotInDestination' }
    });
    expect(recorder.adoptions).toEqual([]);
  });

  it('refuses evidence that names a snippet, which a creation never does', () => {
    const recorder = adoptingReapply();
    const disk = diskFile();
    const stuck = conflictedOver(ready(), disk, { Identified: { target: disk.matches[0]! } });
    expect(reapplyToDiskVersion(stuck, recorder.adopt)).toEqual({
      kind: 'manualResolution',
      obstacle: { kind: 'evidenceNotATarget' }
    });
    expect(recorder.adoptions).toEqual([]);
  });

  it('runs the ordinary creation checks again over the new parse', () => {
    const recorder = adoptingReapply();
    const stuck = conflictedOver(ready(), diskFile({ readOnly: true }));
    expect(reapplyToDiskVersion(stuck, recorder.adopt)).toEqual({
      kind: 'manualResolution',
      obstacle: { kind: 'creationRefused', reason: 'destinationIneligible' }
    });
    expect(recorder.adoptions).toEqual([]);
  });

  it('refuses a conflict about a file this form is not writing into', () => {
    const recorder = adoptingReapply();
    const stuck = conflictedOver(ready(), diskFile({ id: 3, relativePath: 'match/other.yml' }));
    expect(reapplyToDiskVersion(stuck, recorder.adopt)).toEqual({
      kind: 'manualResolution',
      obstacle: { kind: 'notTheDestination' }
    });
    expect(recorder.adoptions).toEqual([]);
  });

  it('reports the window refusal and rebuilds nothing', () => {
    const recorder = adoptingReapply('refused');
    expect(reapplyToDiskVersion(conflictedOver(ready(), diskFile()), recorder.adopt)).toEqual({
      kind: 'adoptionRefused'
    });
    expect(recorder.adoptions).toHaveLength(1);
  });

  it('is not attempted when no conflict is showing', () => {
    const recorder = adoptingReapply();
    expect(reapplyToDiskVersion(ready(), recorder.adopt)).toEqual({ kind: 'notAttempted' });
    expect(recorder.adoptions).toEqual([]);
  });
}); // End of the reapply suite

describe('the external session — Phase 2d-6-3', () => {
  // **The receiver as a value, driven without a window.** Every envelope here is
  // sealed by the three constructors of `./observationDelivery.ts`, so the verdict
  // inside is about the observation inside by construction; `workspace.test.ts`
  // drives this same transition through a real `BrowserState`. Nothing here can
  // show a component registers the receiver — 2d-6-6 wires it — and nothing here
  // calls a command: no `BrowserState` exists in this file.

  /** The disk text every observation below reads. */
  const THEIRS = 'matches:\n  - trigger: x\n    replace: theirs\n';

  /**
   * The destination file as another writer left it: the same two snippets under
   * a new parse, plus a third.
   *
   * @param overrides - Whatever the case needs the disk file to keep saying.
   * @returns The projection the observation carries.
   */
  function diskFile(overrides: Parameters<typeof makeDocument>[0] = {}): DocumentView {
    return makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: AFTER,
      matches: [
        makeMatch({ node: 30, document: 2, revision: AFTER, trigger: ':sig' }),
        makeMatch({ node: 31, document: 2, revision: AFTER, trigger: ':date' }),
        makeMatch({ node: 32, document: 2, revision: AFTER, trigger: ':theirs' })
      ],
      ...overrides
    });
  } // End of function diskFile()

  /**
   * One narrowed observation of the destination file.
   *
   * A fresh object every call, deliberately: the memo in `./conflictSource.ts` and
   * the form's wait are both keyed on object identity, so two calls are two
   * observations.
   *
   * @param overrides - Whatever the case needs beyond the defaults.
   * @returns The observation, as a window would have narrowed it.
   */
  function observation(
    overrides: Partial<ExternalConflictObservation> = {}
  ): ExternalConflictObservation {
    return {
      sequence: 5,
      document: 2,
      previousRevision: BASE,
      diskRevision: AFTER,
      diskText: THEIRS,
      disk: diskFile(),
      findings: [],
      correspondences: null,
      ...overrides
    };
  } // End of function observation()

  /**
   * An observation of the other file, which the form may also be about.
   *
   * @param overrides - Whatever the case needs beyond the defaults.
   * @returns The observation.
   */
  function otherObservation(
    overrides: Partial<ExternalConflictObservation> = {}
  ): ExternalConflictObservation {
    return observation({
      document: 3,
      previousRevision: OTHER,
      diskRevision: 'd'.repeat(64),
      disk: makeDocument({ id: 3, relativePath: 'match/other.yml', revision: 'd'.repeat(64) }),
      ...overrides
    });
  } // End of function otherObservation()

  /**
   * An arbitrated envelope, asserted to have reached the arm the case is about.
   *
   * @param standing - What stands for the file, or `null`.
   * @param seen - The observation.
   * @param uncertain - Whether the last settled write may have written.
   * @param arm - The verdict the case needs.
   * @returns The sealed envelope.
   */
  function decided(
    standing: ConflictSource | null,
    seen: ExternalConflictObservation,
    uncertain: boolean,
    arm: ObservationVerdict['kind']
  ): ObservationDelivery {
    const delivery = arbitratedDelivery(
      standing === null ? null : standingConflictOf(standing),
      seen,
      uncertain
    );
    expect(delivery.verdict.kind).toBe(arm);
    return delivery;
  } // End of function decided()

  /**
   * The `raised` envelope for one observation.
   *
   * @param seen - The observation.
   * @returns The envelope.
   */
  function raised(seen: ExternalConflictObservation): ObservationDelivery {
    return decided(null, seen, false, 'raised');
  } // End of function raised()

  /**
   * A recorder for the window's own adoption.
   *
   * @param answer - What the window answers.
   * @returns The callback to pass, and the conflicts it was handed.
   */
  function adopting(answer: DiskAdoptionOutcome = 'installed'): {
    readonly adopt: AdoptTheDiskVersion<CreationBuffers>;
    readonly adoptions: ConflictModel<CreationBuffers>[];
  } {
    const adoptions: ConflictModel<CreationBuffers>[] = [];
    return {
      adopt: (conflict) => {
        adoptions.push(conflict);
        return answer;
      },
      adoptions
    };
  } // End of function adopting()

  /**
   * The external conflict a form shows, or a failure naming the case.
   *
   * @param held - The form.
   * @returns Its external conflict.
   */
  function externalOf(held: MatchCreationSession): ExternalConflictModel<CreationBuffers> {
    const conflict = held.externalConflict;
    if (conflict === null) {
      throw new Error('this case needs an external conflict on the form');
    }
    return conflict;
  } // End of function externalOf()

  /**
   * A form whose create met a save conflict — the save origin.
   *
   * @returns The form showing the save conflict.
   */
  function saveConflicted(): MatchCreationSession {
    const started = beginCreate(ready());
    if (started === null) {
      throw new Error('a ready form is submittable');
    }
    return applyCreate(started.session, CONFLICT, NOT_OWED);
  } // End of function saveConflicted()

  /**
   * A form with both fields filled and **no** destination — the wildcard.
   *
   * @returns The destination-less form.
   */
  function unaddressed(): MatchCreationSession {
    const blank = form();
    expect(blank.chosen).toBeNull();
    return editCreationField(editCreationField(blank, 'trigger', ':new'), 'replace', 'a body');
  } // End of function unaddressed()

  describe('over a chosen destination (entries 6, 8 and 11)', () => {
    it('raises over the destination, freezes the boxes, refuses the send, and names why', () => {
      const seen = observation();
      const next = applyObservation(ready(), raised(seen));
      const conflict = externalOf(next);
      expect(conflict.source).toBe(externalConflictSource(seen));
      expect(conflict.draft).toBe(next.draft);
      expect(conflict.diskText).toBe(THEIRS);
      expect(isExternalConflict(conflict)).toBe(true);
      expect(conflictOf(next)).toBe(conflict);
      // `outcome` is untouched: no create ended (entry 6).
      expect(next.outcome).toBeNull();
      expect(isEditable(next)).toBe(false);
      expect(editCreationField(next, 'replace', 'other')).toBe(next);
      expect(next.draft.value).toEqual({ trigger: ':new', replace: 'a body' });
      // The refusal has a code of its own, whose sentence is the external origin's
      // first line and never *while this snippet was being written*.
      expect(creationRefusal(next)).toBe('externalConflict');
      expect(creationRefusalKey('externalConflict')).toBe('browser.externalConflict.fileChangedWhileOpen');
      expect(canCreate(next)).toBe(false);
      expect(beginCreate(next)).toBeNull();
      // The form stays over the file it chose; the target it reports is unchanged.
      expect(next.chosen).toBe(2);
      expect(creationTargetOf(next)).toEqual({ kind: 'document', document: 2 });
      const view = matchCreationView(next);
      expect(view.conflict).toBe(conflict);
      expect(view.externalMessages).toBe(conflict.messages);
      expect(view.externalMessages[0]).toEqual({ kind: 'fileChangedWhileOpen' });
      expect(view.messages).toEqual([]);
      expect(view.externalNotices).toEqual([]);
      expect(view.destinationRequired).toBe(false);
      expect(view.canChooseDestination).toBe(false);
      expect(view.retainedDraft.map((one) => one.text)).toEqual([':new', 'a body']);
      expect(view.conflictChoices).toEqual<readonly ConflictChoice[]>([
        'keepEditing',
        'copyDraft',
        'keepMyDraft',
        'reloadDiskVersion'
      ]);
    }); // End of the "raised over the destination" case

    it('answers null from beginCreate called directly under an external conflict, refusal path included', () => {
      // **Past a disabled button.** The refusal panel's *Save anyway* would reach
      // `beginCreate` with consent recorded; the model refuses at the same function
      // the view asks, and the view withholds the offer.
      const refused = applyCreate(beginCreate(ready())!.session, REFUSED, NOT_OWED);
      const blocked = applyObservation(refused, raised(observation()));
      expect(blocked.outcome?.kind).toBe('refused');
      expect(beginCreate(acknowledgeCreationFindings(blocked))).toBeNull();
      const view = matchCreationView(blocked);
      expect(view.refusalChoices).toEqual(['keepEditing']);
      expect(view.findingsAreStale).toBe(false);
    });

    it('takes nothing from a delivery about another file, except the end of its own wait', () => {
      // A form over `match/base.yml` is told `match/other.yml` changed: nothing
      // about this form is about that file, so the form is the object it was.
      const over = ready();
      const elsewhere = otherObservation();
      expect(applyObservation(over, raised(elsewhere))).toBe(over);
      expect(applyObservation(over, retainedDelivery(elsewhere))).toBe(over);
      expect(applyObservation(over, decided(null, elsewhere, true, 'raisedWithoutReload'))).toBe(over);
      // A wait recorded for that observation while the form was unaddressed ends
      // with the decision about it, whichever file it names.
      const waiting: MatchCreationSession = { ...over, awaitingReconciliation: new Map([[3, elsewhere]]) };
      expect(applyObservation(waiting, writtenHereDelivery(elsewhere)).awaitingReconciliation.size).toBe(0);
      expect(applyObservation(waiting, raised(elsewhere))).toEqual({ ...waiting, awaitingReconciliation: new Map() });
    });

    it('takes nothing once closed', () => {
      const closed = reloadTheDiskVersion(
        confirmDiskReload(askToReloadDiskVersion(saveConflicted())),
        adopting().adopt
      );
      expect(closed.closed).toBe(true);
      expect(applyObservation(closed, raised(observation()))).toBe(closed);
      expect(applyObservation(closed, retainedDelivery(observation()))).toBe(closed);
    });
  }); // End of the "over a chosen destination" suite

  describe('the destination-less form refuses to choose one (entry 21)', () => {
    it('shows the affected file’s state, keeps its fields and its unknown target, and withholds both ways to the disk', () => {
      const seen = observation();
      const told = applyObservation(unaddressed(), raised(seen));
      const conflict = externalOf(told);
      expect(conflict.source).toBe(externalConflictSource(seen));
      expect(conflict.disk.id).toBe(2);
      // **Nothing was chosen for the person.** The destination stays unknown, the
      // draft's base stays empty — the observed revision was not adopted into it —
      // and the two typed values are exactly what they were.
      expect(told.chosen).toBeNull();
      expect(creationTargetOf(told)).toEqual({ kind: 'unknown' });
      expect(baseRevisionOf(told)).toBe('');
      expect(told.draft.value).toEqual({ trigger: ':new', replace: 'a body' });
      expect(isEditable(told)).toBe(false);
      expect(editCreationField(told, 'trigger', ':other')).toBe(told);
      // The refusal is the destination, because that is the resolution.
      expect(creationRefusal(told)).toBe('noDestination');
      expect(beginCreate(told)).toBeNull();
      const view = matchCreationView(told);
      expect(view.destinationRequired).toBe(true);
      expect(view.canChooseDestination).toBe(true);
      expect(canChooseDestination(told)).toBe(true);
      expect(view.editable).toBe(false);
      expect(view.conflict).toBe(conflict);
      expect(view.conflictChoices).toEqual<readonly ConflictChoice[]>(['keepEditing', 'copyDraft']);
      expect(view.reapplyOffered).toBe(false);
      // The three reload steps refuse a call made past the withheld control.
      expect(askToReloadDiskVersion(told)).toBe(told);
      expect(confirmDiskReload({ ...told, reload: { kind: 'confirming' } })).toEqual({
        ...told,
        reload: { kind: 'confirming' }
      });
      // A confirmation minted for the shown conflict by hand reaches no door.
      const recorder = adopting();
      const forced: MatchCreationSession = {
        ...told,
        reload: { kind: 'confirmed', confirmation: confirmReloadDiskVersion(conflict) }
      };
      expect(reloadTheDiskVersion(forced, recorder.adopt)).toBe(forced);
      // And the reapply refuses before any evidence is read, adopting nothing —
      // the unknown-target reapply is a refusal, not a choice.
      expect(reapplyToDiskVersion(told, recorder.adopt, () => conflict.source)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'destinationRequired' }
      });
      expect(recorder.adoptions).toEqual([]);
      expect(creationReapplyObstacleKey({ kind: 'destinationRequired' })).toBe(
        'browser.matchCreation.cannotCreate.noDestination'
      );
      // Dismissal erases none of it (entry 9).
      const kept = keepDrafting(told);
      expect(kept.externalConflict).toBe(conflict);
      expect(matchCreationView(kept).destinationRequired).toBe(true);
    }); // End of the "affected file's state" case

    it('resolves through an explicit destination: the affected file keeps the conflict, another file drops it', () => {
      const seen = observation();
      const told = applyObservation(unaddressed(), raised(seen));
      // **The affected file, named by the person**: an ordinary destination
      // conflict now, over a draft re-pointed at the revision this window holds
      // for it — `BASE`, never the observed `AFTER` — with both ways to the disk
      // offered and the typed values kept.
      const affected = chooseDestination(told, 2);
      expect(affected.chosen).toBe(2);
      expect(creationTargetOf(affected)).toEqual({ kind: 'document', document: 2 });
      expect(baseRevisionOf(affected)).toBe(BASE);
      const conflict = externalOf(affected);
      expect(conflict.source).toBe(externalConflictSource(seen));
      expect(conflict.draft).toBe(affected.draft);
      expect(conflict.draft.value).toEqual({ trigger: ':new', replace: 'a body' });
      expect(creationRefusal(affected)).toBe('externalConflict');
      const view = matchCreationView(affected);
      expect(view.destinationRequired).toBe(false);
      expect(view.canChooseDestination).toBe(false);
      expect(view.conflictChoices).toEqual<readonly ConflictChoice[]>([
        'keepEditing',
        'copyDraft',
        'keepMyDraft',
        'reloadDiskVersion'
      ]);
      // From there the reload goes through the door and closes the form.
      const recorder = adopting();
      const closed = reloadTheDiskVersion(
        confirmDiskReload(askToReloadDiskVersion(affected)),
        recorder.adopt
      );
      expect(closed.closed).toBe(true);
      expect(recorder.adoptions).toEqual([conflict]);

      // **Another file, named by the person**: the observation was about a file
      // this form no longer writes into, so nothing stands over the form.
      const elsewhere = chooseDestination(told, 3);
      expect(elsewhere.chosen).toBe(3);
      expect(elsewhere.externalConflict).toBeNull();
      expect(conflictOf(elsewhere)).toBeNull();
      expect(baseRevisionOf(elsewhere)).toBe(OTHER);
      expect(canCreate(elsewhere)).toBe(true);
      expect(elsewhere.draft.value).toEqual({ trigger: ':new', replace: 'a body' });
      expect(matchCreationView(elsewhere).destinationRequired).toBe(false);
      // The same destination twice is no choice at all.
      expect(chooseDestination(told, 2)).not.toBe(told);
      expect(chooseDestination(affected, 2)).toBe(affected);
    }); // End of the "explicit destination" case

    it('carries the uncertainty into the affected file and drops it for another', () => {
      const seen = observation();
      const withheld = applyObservation(unaddressed(), decided(null, seen, true, 'raisedWithoutReload'));
      expect(withheld.uncertaintyUnresolved).toBe(true);
      expect(matchCreationView(withheld).externalNotices).toEqual([{ kind: 'writeOutcomeUnknown' }]);
      const affected = chooseDestination(withheld, 2);
      expect(affected.uncertaintyUnresolved).toBe(true);
      expect(matchCreationView(affected).conflictChoices).toEqual<readonly ConflictChoice[]>([
        'keepEditing',
        'copyDraft'
      ]);
      const elsewhere = chooseDestination(withheld, 3);
      expect(elsewhere.uncertaintyUnresolved).toBe(false);
      expect(elsewhere.externalConflict).toBeNull();
    });

    it('shows the later of two affected files, and still chooses neither', () => {
      // One slot: the newest decision is what the form shows, and the earlier
      // file's change is protected by the command's revision check, not here.
      const first = applyObservation(unaddressed(), raised(observation()));
      const second = applyObservation(first, raised(otherObservation()));
      expect(externalOf(second).disk.id).toBe(3);
      expect(second.chosen).toBeNull();
      expect(creationTargetOf(second)).toEqual({ kind: 'unknown' });
      // Naming the earlier file drops the later file's conflict and sends against
      // the revision this window holds — which the command, not this form, checks.
      const named = chooseDestination(second, 2);
      expect(named.externalConflict).toBeNull();
      expect(baseRevisionOf(named)).toBe(BASE);
    });
  }); // End of the "destination-less form" suite

  describe('the held observation, and writtenHere by identity (entries 8 and 11)', () => {
    it('records a wait as a restriction on sending, keeps the boxes live, and lifts it only for that observation', () => {
      const seen = observation();
      const waiting = applyObservation(ready(), retainedDelivery(seen));
      expect(waiting.awaitingReconciliation.get(2)).toBe(seen);
      expect(waiting.awaitingReconciliation.size).toBe(1);
      expect(waiting.externalConflict).toBeNull();
      expect(conflictOf(waiting)).toBeNull();
      expect(creationRefusal(waiting)).toBe('observationRetained');
      expect(creationRefusalKey('observationRetained')).toBe('browser.externalConflict.observationRetained');
      expect(beginCreate(waiting)).toBeNull();
      expect(isEditable(waiting)).toBe(true);
      const typed = editCreationField(waiting, 'replace', 'a longer body');
      expect(typed.draft.value.replace).toBe('a longer body');
      expect(typed.awaitingReconciliation.get(2)).toBe(seen);
      const view = matchCreationView(typed);
      expect(view.canCreate).toBe(false);
      expect(view.editable).toBe(true);
      expect(view.externalNotices).toEqual([{ kind: 'observationRetained' }]);
      // Lifted by identity, and by nothing else.
      expect(applyObservation(typed, writtenHereDelivery(observation())).awaitingReconciliation.get(2)).toBe(seen);
      const lifted = applyObservation(typed, writtenHereDelivery(seen));
      expect(lifted).toEqual({ ...typed, awaitingReconciliation: new Map() });
      expect(canCreate(lifted)).toBe(true);
      expect(applyObservation(lifted, writtenHereDelivery(seen))).toBe(lifted);
      // Any decision about the awaited observation ends the wait; a later
      // `retained` replaces it; a re-held reading is still held.
      const standing = externalConflictSource(observation({ sequence: 9 }));
      expect(applyObservation(waiting, decided(standing, seen, false, 'notLater'))).toEqual({
        ...waiting,
        awaitingReconciliation: new Map()
      });
      expect(
        applyObservation(waiting, decided(externalConflictSource(observation({ sequence: 1 })), seen, false, 'coalesced'))
      ).toEqual({ ...waiting, awaitingReconciliation: new Map() });
      expect(applyObservation(waiting, raised(seen)).awaitingReconciliation.size).toBe(0);
      const newer = observation({ sequence: 7 });
      expect(applyObservation(waiting, retainedDelivery(newer)).awaitingReconciliation.get(2)).toBe(newer);
      expect(applyObservation(waiting, retainedDelivery(seen)).awaitingReconciliation.get(2)).toBe(seen);
    }); // End of the "retained and writtenHere" case

    it('keeps a wait across a change of destination, so returning to the file restores its block (the review’s second blocker)', () => {
      // **The reviewer's interleaving.** A chosen, `retained(A)`, B chosen, A
      // chosen again: the only record of A's wait must not be erased by the
      // detour, or `beginCreate` proceeds past a block the window still holds.
      const seen = observation();
      const waiting = applyObservation(ready(), retainedDelivery(seen));
      expect(beginCreate(waiting)).toBeNull();
      const away = chooseDestination(waiting, 3);
      expect(away.chosen).toBe(3);
      // Over the other file the wait about the first blocks nothing.
      expect(creationRefusal(away)).toBeNull();
      const back = chooseDestination(away, 2);
      expect(back.chosen).toBe(2);
      expect(creationRefusal(back)).toBe('observationRetained');
      expect(beginCreate(back)).toBeNull();
      // And the decision about that observation, arriving now, lifts it.
      const lifted = applyObservation(back, writtenHereDelivery(seen));
      expect(creationRefusal(lifted)).toBeNull();
      expect(beginCreate(lifted)).not.toBeNull();
    }); // End of the "wait kept across a change of destination" case

    it('keeps every wait through a change of destination, and blocks only for the file named', () => {
      // A wait about `match/base.yml` on a form that moves to `match/other.yml`
      // blocks nothing there, and is still held for when the form comes back.
      const seen = observation();
      const waiting = applyObservation(ready(), retainedDelivery(seen));
      const moved = chooseDestination(waiting, 3);
      expect(moved.chosen).toBe(3);
      expect(moved.awaitingReconciliation).toBe(waiting.awaitingReconciliation);
      expect(canCreate(moved)).toBe(true);
      expect(matchCreationView(moved).externalNotices).toEqual([]);
      // An unaddressed form waits on any file it was told of, and blocks for the
      // one it then names.
      const unaddressedWait = applyObservation(unaddressed(), retainedDelivery(seen));
      expect(creationRefusal(unaddressedWait)).toBe('noDestination');
      expect(matchCreationView(unaddressedWait).externalNotices).toEqual([{ kind: 'observationRetained' }]);
      const named = chooseDestination(unaddressedWait, 2);
      expect(named.awaitingReconciliation.get(2)).toBe(seen);
      expect(creationRefusal(named)).toBe('observationRetained');
      expect(creationRefusal(chooseDestination(unaddressedWait, 3))).toBeNull();
    });

    it('holds every delivery during its own create and replays them in arrival order (entry 5)', () => {
      const started = beginCreate(ready());
      if (started === null) {
        throw new Error('a ready form is submittable');
      }
      const seen = observation();
      const later = observation({ sequence: 6 });
      const standing = externalConflictSource(seen);
      const held = applyObservation(
        applyObservation(applyObservation(started.session, retainedDelivery(seen)), raised(seen)),
        decided(standing, later, false, 'coalesced')
      );
      expect(held.externalConflict).toBeNull();
      expect(held.awaitingReconciliation.size).toBe(0);
      expect(held.heldDeliveries.map((one) => one.verdict.kind)).toEqual(['retained', 'raised', 'coalesced']);
      // The create's answer lands first, the held decisions second, in one
      // transition: the conflict `raised` announced stands, the wait `retained`
      // recorded ended with it, and `coalesced` found the conflict it was about.
      const settled = applyCreate(held, REFUSED, NOT_OWED);
      expect(settled.heldDeliveries).toEqual([]);
      expect(settled.outcome?.kind).toBe('refused');
      expect(externalOf(settled).source).toBe(standing);
      expect(settled.awaitingReconciliation.size).toBe(0);
      expect(canCreate(settled)).toBe(false);
      // The answer lands first and the replay has the last word, on a commit too
      // (entry 5).
      const committed = applyCreate(held, saved(), ADOPTED);
      expect(committed.outcome?.kind).toBe('saved');
      expect(externalOf(committed).source).toBe(standing);
      // A create that produced no outcome consumes the hold too.
      const heldUncertain = applyObservation(started.session, decided(null, seen, true, 'raisedWithoutReload'));
      const failed = createCouldNotBeSent(heldUncertain, true, null);
      expect(failed.heldDeliveries).toEqual([]);
      expect(failed.sendFailure?.kind).toBe('mayHaveWritten');
      expect(failed.uncertaintyUnresolved).toBe(true);
      expect(externalOf(failed).source).toBe(externalConflictSource(seen));
    }); // End of the "held during the create" case
  }); // End of the "held observation" suite

  describe('collisions: only one conflict is active (entry 7), and a replacing verdict resets (entry 12)', () => {
    it('retires a save conflict when an observation supersedes it, keeping the retained draft', () => {
      const stuck = saveConflicted();
      const saveModel = conflictOf(stuck);
      if (saveModel === null || !isSaveConflict(saveModel)) {
        throw new Error('this case starts from a save conflict');
      }
      const confirmed = confirmDiskReload(askToReloadDiskVersion(stuck));
      expect(confirmed.reload.kind).toBe('confirmed');
      const attempt = attemptOfReapply(confirmed, { kind: 'adoptionRefused' } as const);
      expect(reapplyToShow(attempt, confirmed)).toEqual({ kind: 'adoptionRefused' });
      const seen = observation({ diskRevision: 'c'.repeat(64), disk: diskFile({ revision: 'c'.repeat(64) }) });
      const next = applyObservation(confirmed, decided(saveModel.source, seen, false, 'supersedes'));
      expect(next.outcome).toBeNull();
      expect(next.submitted).toBeNull();
      const conflict = externalOf(next);
      expect(conflict.draft).toBe(saveModel.draft);
      expect(conflict.diskRevision).toBe('c'.repeat(64));
      expect(conflictOf(next)).toBe(conflict);
      // The reload is idle again and the confirmation is gone; the displayed
      // reapply result is about a form no longer on screen.
      expect(next.reload).toBe(NOT_RELOADING);
      expect(matchCreationView(next).awaitingReloadConfirmation).toBe(false);
      const recorder = adopting();
      expect(reloadTheDiskVersion(next, recorder.adopt)).toBe(next);
      expect(recorder.adoptions).toEqual([]);
      expect(reapplyToShow(attempt, next)).toBeNull();
      // The typed values survive.
      expect(next.draft.value).toEqual({ trigger: ':new', replace: 'a body' });
    }); // End of the "supersedes a save conflict" case

    it('keeps a committed success and a refusal as history, and lets a create that conflicts retire the external one', () => {
      const started = beginCreate(ready());
      if (started === null) {
        throw new Error('a ready form is submittable');
      }
      const committed = applyCreate(started.session, saved(), ADOPTED);
      const overSaved = applyObservation(committed, raised(observation()));
      expect(overSaved.outcome?.kind).toBe('saved');
      expect(overSaved.committed).toBe(true);
      expect(conflictOf(overSaved)).toBe(overSaved.externalConflict);
      // The reverse collision, kept for a direct call: a conflict answer retires
      // the external conflict, a refusal leaves it.
      const refused = applyCreate(beginCreate(ready())!.session, REFUSED, NOT_OWED);
      const blocked = applyObservation(refused, raised(observation()));
      const conflicted = applyCreate(blocked, CONFLICT, NOT_OWED);
      expect(conflicted.externalConflict).toBeNull();
      expect(conflictOf(conflicted)?.source.kind).toBe('save');
      const refusedAgain = applyCreate(blocked, REFUSED, NOT_OWED);
      expect(refusedAgain.externalConflict).toBe(blocked.externalConflict);
    });

    it('lets keepDrafting cancel the warning and the panel, and nothing external (entry 9)', () => {
      const seen = observation();
      const refused = applyCreate(beginCreate(ready())!.session, REFUSED, NOT_OWED);
      const blocked = askToReloadDiskVersion(applyObservation(refused, raised(seen)));
      const kept = keepDrafting(blocked);
      expect(kept.outcome).toBeNull();
      expect(kept.reload).toBe(NOT_RELOADING);
      expect(kept.externalConflict).toBe(blocked.externalConflict);
      expect(isEditable(kept)).toBe(false);
      expect(beginCreate(kept)).toBeNull();
      const withheld = applyObservation(ready(), decided(null, observation(), true, 'raisedWithoutReload'));
      expect(keepDrafting(withheld).uncertaintyUnresolved).toBe(true);
      const waiting = applyObservation(ready(), retainedDelivery(seen));
      expect(keepDrafting(waiting).awaitingReconciliation.get(2)).toBe(seen);
    });

    it('changes nothing on coalesced and notLater, not even the object', () => {
      const seen = observation();
      const asked = askToReloadDiskVersion(applyObservation(ready(), raised(seen)));
      expect(matchCreationView(asked).awaitingReloadConfirmation).toBe(true);
      const standing = externalConflictSource(seen);
      expect(applyObservation(asked, decided(standing, observation({ sequence: 6 }), false, 'coalesced'))).toBe(asked);
      expect(
        applyObservation(asked, decided(standing, observation({ sequence: 4, diskRevision: 'd'.repeat(64) }), false, 'notLater'))
      ).toBe(asked);
    });
  }); // End of the "collisions" suite

  describe('the uncertainty and its exits (entries 11, 14, 15, 22; the record’s §5.5)', () => {
    it('withholds the reload and the reapply on raisedWithoutReload until the snapshot is acknowledged', () => {
      const seen = observation();
      const withheld = applyObservation(ready(), decided(null, seen, true, 'raisedWithoutReload'));
      expect(withheld.uncertaintyUnresolved).toBe(true);
      const view = matchCreationView(withheld);
      expect(view.conflictChoices).toEqual<readonly ConflictChoice[]>(['keepEditing', 'copyDraft']);
      expect(view.reapplyOffered).toBe(false);
      expect(view.externalNotices).toEqual([{ kind: 'writeOutcomeUnknown' }]);
      expect(askToReloadDiskVersion(withheld)).toBe(withheld);
      const recorder = adopting();
      expect(reapplyToDiskVersion(withheld, recorder.adopt, () => externalOf(withheld).source)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'writeOutcomeUnknown' }
      });
      expect(recorder.adoptions).toEqual([]);
      // Exit three: the acknowledgement, refused and then accepted.
      const asked: ExternalChangeConflictSource[] = [];
      expect(
        acknowledgeSnapshot(withheld, (source) => {
          asked.push(source);
          return 'refused';
        })
      ).toBe(withheld);
      expect(asked).toEqual([externalOf(withheld).source]);
      const acknowledged = acknowledgeSnapshot(withheld, () => 'acknowledged');
      expect(acknowledged).toEqual({ ...withheld, uncertaintyUnresolved: false, reload: NOT_RELOADING });
      expect(matchCreationView(acknowledged).conflictChoices).toContain('reloadDiskVersion');
      expect(matchCreationView(askToReloadDiskVersion(acknowledged)).awaitingReloadConfirmation).toBe(true);
      // Nothing to acknowledge asks nothing.
      let askedWithoutCause = 0;
      const plain = applyObservation(ready(), raised(seen));
      expect(
        acknowledgeSnapshot(plain, () => {
          askedWithoutCause += 1;
          return 'acknowledged';
        })
      ).toBe(plain);
      expect(askedWithoutCause).toBe(0);
    }); // End of the "raisedWithoutReload" case

    it('clears the uncertainty when a later verdict under none replaces the conflict', () => {
      // Exit one, as a form sees it: a later definite write ends the hold at the
      // window, and the next reading arrives under no uncertainty.
      const first = observation();
      const withheld = applyObservation(ready(), decided(null, first, true, 'raisedWithoutReload'));
      const later = observation({ sequence: 6, diskRevision: 'c'.repeat(64), disk: diskFile({ revision: 'c'.repeat(64) }) });
      const replaced = applyObservation(withheld, decided(externalConflictSource(first), later, false, 'supersedes'));
      expect(replaced.uncertaintyUnresolved).toBe(false);
      expect(externalOf(replaced).source).toBe(externalConflictSource(later));
      expect(matchCreationView(replaced).conflictChoices).toContain('reloadDiskVersion');
    });
  }); // End of the "uncertainty" suite

  describe('the reapply over the external origin: targetless, with the anchor read off the table (entries 19, 20, 22)', () => {
    /** The base identity of the second snippet of `match/base.yml`. */
    const ANCHOR: MatchId = snippetFile().matches[1]!.id;

    /**
     * One row of a table.
     *
     * @param base - The identity the row is about.
     * @param exact - The exact tier's answer.
     * @returns The row, with an editor tier that answers nothing.
     */
    function row(base: MatchId, exact: ReapplyResolution): CorrespondenceEntry {
      return { base, exact, editor: { Unsupported: {} } };
    } // End of function row()

    /**
     * An observation carrying a table over the two revisions.
     *
     * @param entries - The table's rows.
     * @param revisions - The table's two revisions, defaulting to the matching pair.
     * @param disk - The disk projection.
     * @returns The observation.
     */
    function observed(
      entries: readonly CorrespondenceEntry[],
      revisions: { readonly base?: string; readonly disk?: string } = {},
      disk: DocumentView = diskFile()
    ): ExternalConflictObservation {
      return observation({
        disk,
        correspondences: {
          base_revision: revisions.base ?? BASE,
          disk_revision: revisions.disk ?? AFTER,
          entries
        }
      });
    } // End of function observed()

    /**
     * A form placed after the second snippet, raised over one observation.
     *
     * @param seen - The observation.
     * @param placement - Where the form places the snippet.
     * @returns The form and the guard answering its own conflict's origin.
     */
    function raisedOver(
      seen: ExternalConflictObservation,
      placement: Parameters<typeof choosePlacement>[1] = { kind: 'after', anchor: ANCHOR }
    ): { readonly stuck: MatchCreationSession; readonly stands: StandingOriginGuard } {
      const stuck = applyObservation(choosePlacement(ready(), placement), raised(seen));
      const source = externalOf(stuck).source;
      return { stuck, stands: () => source };
    } // End of function raisedOver()

    /** The disk-side snippet the anchor's row identifies. */
    const TWIN: MatchView = diskFile().matches[1]!;

    it('rebuilds an after from the row the anchor’s full identity finds, reading its exact tier', () => {
      const { stuck, stands } = raisedOver(observed([row(ANCHOR, { Identified: { target: TWIN } })]));
      const recorder = adopting();
      const answer = reapplyToDiskVersion(stuck, recorder.adopt, stands);
      expect(answer.kind).toBe('reapplied');
      if (answer.kind !== 'reapplied') {
        throw new Error('this case is about the rebuilt form');
      }
      expect(answer.session.placement).toEqual({ kind: 'after', anchor: TWIN.id });
      expect(baseRevisionOf(answer.session)).toBe(AFTER);
      expect(answer.session.draft.value).toEqual({ trigger: ':new', replace: 'a body' });
      expect(answer.session.draft.consent).toBeNull();
      expect(canCreate(answer.session)).toBe(true);
      expect(beginCreate(answer.session)?.position).toEqual({ After: { anchor: TWIN.id } });
      expect(answer.session.externalConflict).toBeNull();
      expect(answer.session.awaitingReconciliation.size).toBe(0);
      expect(recorder.adoptions).toEqual([externalOf(stuck)]);
    }); // End of the "after rebuilt from the row" case

    it('asks the table nothing for a front or end placement, and refuses no creation for a table it never read', () => {
      // **Targetless, and non-anchored**: a table that names a subject in every
      // row, a table about other revisions, and no table at all each change
      // nothing for a placement that names no snippet.
      const recorder = adopting();
      for (const placement of [{ kind: 'front' }, { kind: 'end' }] as const) {
        const naming = raisedOver(observed([row(ANCHOR, { Identified: { target: TWIN } })]), placement);
        expect(reapplyToDiskVersion(naming.stuck, recorder.adopt, naming.stands).kind).toBe('reapplied');
        const moved = raisedOver(observed([], { base: 'z'.repeat(64) }), placement);
        expect(reapplyToDiskVersion(moved.stuck, recorder.adopt, moved.stands).kind).toBe('reapplied');
        const tableless = raisedOver(observation(), placement);
        const answer = reapplyToDiskVersion(tableless.stuck, recorder.adopt, tableless.stands);
        expect(answer.kind).toBe('reapplied');
        if (answer.kind === 'reapplied') {
          expect(answer.session.placement).toEqual(placement);
          expect(chosenDestination(answer.session)?.anchors.map((one) => one.node)).toEqual([30, 31, 32]);
        }
      } // End of the loop over the two semantic placements
      expect(recorder.adoptions).toHaveLength(6);
    }); // End of the "semantic placement asks nothing" case

    it('refuses the anchor: a refused tier, an empty tier, a missing row, several rows, and a stranger', () => {
      const recorder = adopting();
      const refusedTier = raisedOver(observed([row(ANCHOR, { Refused: { reason: 'NoExactCorrespondence' } })]));
      expect(reapplyToDiskVersion(refusedTier.stuck, recorder.adopt, refusedTier.stands)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'anchorCorrespondence', reason: 'NoExactCorrespondence' }
      });
      for (const empty of [{ Unsupported: {} }, { Targetless: {} }] as const) {
        const emptyTier = raisedOver(observed([row(ANCHOR, empty)]));
        expect(reapplyToDiskVersion(emptyTier.stuck, recorder.adopt, emptyTier.stands)).toEqual({
          kind: 'manualResolution',
          obstacle: { kind: 'evidenceNotAnAnchor' }
        });
      } // End of the loop over the two empty arms
      // **Never the node alone and never the position** (entry 20).
      const nodeOnly = raisedOver(
        observed([row({ document: 2, revision: 'z'.repeat(64), node: 11 }, { Identified: { target: TWIN } })])
      );
      expect(reapplyToDiskVersion(nodeOnly.stuck, recorder.adopt, nodeOnly.stands)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: 'noRowForBase' }
      });
      const byPosition = raisedOver(
        observed([
          row({ document: 2, revision: BASE, node: 10 }, { Identified: { target: TWIN } }),
          row({ document: 2, revision: BASE, node: 99 }, { Identified: { target: TWIN } })
        ])
      );
      expect(reapplyToDiskVersion(byPosition.stuck, recorder.adopt, byPosition.stands)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: 'noRowForBase' }
      });
      const twice = raisedOver(
        observed([row(ANCHOR, { Identified: { target: TWIN } }), row(ANCHOR, { Identified: { target: TWIN } })])
      );
      expect(reapplyToDiskVersion(twice.stuck, recorder.adopt, twice.stands)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: 'severalRowsForBase' }
      });
      const stranger = makeMatch({ node: 99, document: 2, revision: AFTER, trigger: ':gone' });
      const notHeld = raisedOver(observed([row(ANCHOR, { Identified: { target: stranger } })]));
      expect(reapplyToDiskVersion(notHeld.stuck, recorder.adopt, notHeld.stands)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'anchorNotInDestination' }
      });
      expect(recorder.adoptions).toEqual([]);
    }); // End of the "anchor refusals" case

    it('refuses a table about other revisions, and an observation with none, for an anchored placement', () => {
      const recorder = adopting();
      const otherBase = raisedOver(observed([row(ANCHOR, { Identified: { target: TWIN } })], { base: 'z'.repeat(64) }));
      expect(reapplyToDiskVersion(otherBase.stuck, recorder.adopt, otherBase.stands)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: 'baseRevisionMoved' }
      });
      const otherDisk = raisedOver(observed([row(ANCHOR, { Identified: { target: TWIN } })], { disk: 'z'.repeat(64) }));
      expect(reapplyToDiskVersion(otherDisk.stuck, recorder.adopt, otherDisk.stands)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: 'diskRevisionMoved' }
      });
      const tableless = raisedOver(observation());
      expect(reapplyToDiskVersion(tableless.stuck, recorder.adopt, tableless.stands)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: 'noCorrespondence' }
      });
      expect(recorder.adoptions).toEqual([]);
    });

    it('refuses superseded evidence through the live guard, whichever origin and placement, adopting nothing', () => {
      const recorder = adopting();
      const elsewhere = externalConflictSource(observation({ sequence: 9 }));
      const anchored = raisedOver(observed([row(ANCHOR, { Identified: { target: TWIN } })]));
      expect(reapplyToDiskVersion(anchored.stuck, recorder.adopt, () => elsewhere)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'supersededEvidence' }
      });
      const atEnd = raisedOver(observation(), { kind: 'end' });
      expect(reapplyToDiskVersion(atEnd.stuck, recorder.adopt, () => null)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'supersededEvidence' }
      });
      expect(reapplyToDiskVersion(saveConflicted(), recorder.adopt, () => elsewhere)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'supersededEvidence' }
      });
      expect(recorder.adoptions).toEqual([]);
    });

    it('answers every adoption outcome for the external origin, and the ordinary checks over the new parse', () => {
      const seen = observed([row(ANCHOR, { Identified: { target: TWIN } })]);
      const { stuck, stands } = raisedOver(seen);
      expect(reapplyToDiskVersion(stuck, adopting('installed').adopt, stands).kind).toBe('reapplied');
      expect(reapplyToDiskVersion(stuck, adopting('alreadyThere').adopt, stands).kind).toBe('reapplied');
      const refusedWindow = adopting('refused');
      expect(reapplyToDiskVersion(stuck, refusedWindow.adopt, stands)).toEqual({ kind: 'adoptionRefused' });
      expect(refusedWindow.adoptions).toHaveLength(1);
      // The creation checks run again over the disk parse, adopting nothing.
      const readOnly = raisedOver(observation({ disk: diskFile({ readOnly: true }) }), { kind: 'end' });
      const recorder = adopting();
      expect(reapplyToDiskVersion(readOnly.stuck, recorder.adopt, readOnly.stands)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'creationRefused', reason: 'destinationIneligible' }
      });
      // And a conflict about a file this form is not writing into.
      const elsewhere = applyObservation(
        { ...ready(), externalConflict: null },
        raised(otherObservation({ document: 2, disk: makeDocument({ id: 3, relativePath: 'match/other.yml', revision: AFTER }) }))
      );
      expect(reapplyToDiskVersion(elsewhere, recorder.adopt, () => externalOf(elsewhere).source)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'notTheDestination' }
      });
      expect(recorder.adoptions).toEqual([]);
    });

    it('refuses a reapply while an observation is held, so no rebuilt form can drop the block', () => {
      const { stuck, stands } = raisedOver(observed([row(ANCHOR, { Identified: { target: TWIN } })]));
      const heldReading = observation({ sequence: 6, diskRevision: 'd'.repeat(64), disk: diskFile({ revision: 'd'.repeat(64) }) });
      const held = applyObservation(stuck, retainedDelivery(heldReading));
      expect(held.awaitingReconciliation.get(2)).toBe(heldReading);
      expect(canCreate(held)).toBe(false);
      const recorder = adopting();
      expect(reapplyToDiskVersion(held, recorder.adopt, stands)).toEqual({
        kind: 'manualResolution',
        obstacle: { kind: 'observationRetained' }
      });
      expect(recorder.adoptions).toEqual([]);
      const view = matchCreationView(held);
      expect(view.conflictChoices).toEqual<readonly ConflictChoice[]>(['keepEditing', 'copyDraft', 'reloadDiskVersion']);
      expect(view.reapplyOffered).toBe(false);
      expect(view.externalNotices).toEqual([{ kind: 'observationRetained' }]);
      const lifted = applyObservation(held, writtenHereDelivery(heldReading));
      const answer = reapplyToDiskVersion(lifted, adopting().adopt, stands);
      expect(answer.kind).toBe('reapplied');
      if (answer.kind === 'reapplied') {
        expect(answer.session.awaitingReconciliation.size).toBe(0);
        expect(canCreate(answer.session)).toBe(true);
      }
    }); // End of the "reapply refused while held" case

    it('asks nothing of the window when no guard is handed in, and leaves the door to decide', () => {
      const { stuck } = raisedOver(observed([row(ANCHOR, { Identified: { target: TWIN } })]));
      const refusedWindow = adopting('refused');
      expect(reapplyToDiskVersion(stuck, refusedWindow.adopt)).toEqual({ kind: 'adoptionRefused' });
      expect(refusedWindow.adoptions).toEqual([externalOf(stuck)]);
      expect(reapplyToDiskVersion(stuck, adopting().adopt).kind).toBe('reapplied');
    });

    it('names a sentence in both languages for every obstacle the external origin can raise', () => {
      const obstacles: CreationReapplyObstacle[] = [
        { kind: 'destinationRequired' },
        { kind: 'externalEvidence', reason: 'noCorrespondence' },
        { kind: 'externalEvidence', reason: 'baseRevisionMoved' },
        { kind: 'externalEvidence', reason: 'diskRevisionMoved' },
        { kind: 'externalEvidence', reason: 'noRowForBase' },
        { kind: 'externalEvidence', reason: 'severalRowsForBase' },
        { kind: 'supersededEvidence' },
        { kind: 'writeOutcomeUnknown' },
        { kind: 'observationRetained' }
      ];
      for (const obstacle of obstacles) {
        const key = creationReapplyObstacleKey(obstacle);
        for (const locale of LOCALES) {
          expect(DICTIONARIES[locale][key], `${locale}:${obstacle.kind}`).toBeTruthy();
          const rendered = describeCreationReapplyObstacle(locale, obstacle);
          expect(rendered, `${locale}:${obstacle.kind}`).toBe(DICTIONARIES[locale][key]);
          expect(rendered).not.toContain('{');
        } // End of the loop over the two locales
      } // End of the loop over the external obstacles
      expect(creationReapplyObstacleKey({ kind: 'writeOutcomeUnknown' })).toBe('browser.externalConflict.writeOutcomeUnknown');
      expect(creationReapplyObstacleKey({ kind: 'observationRetained' })).toBe('browser.externalConflict.observationRetained');
    }); // End of the "a sentence per obstacle" case
  }); // End of the "reapply over the external origin" suite
}); // End of the "external session" suite
