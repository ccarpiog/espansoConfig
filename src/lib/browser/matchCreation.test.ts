/**
 * The new-snippet form, driven without a screen.
 *
 * Six groups, and each is a way creation could be wrong in a manner a person
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
 * 6. **the view** — what a screen would draw, derived on every read.
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
  SaveResult
} from '../ipc/types';
import { editDraft } from './draft';
import { makeDocument, makeMatch, makeSummary } from './fixtures';
import type { InvalidationStatus } from './invalidation';
import {
  acknowledgeCreationFindings,
  applyCreate,
  askToReloadDiskVersion,
  baseRevisionOf,
  beginCreate,
  canCreate,
  chooseDestination,
  choosePlacement,
  chosenDestination,
  confirmDiskReload,
  conflictOf,
  createCouldNotBeSent,
  creationRefusal,
  creationRefusalKey,
  destinationRefusalKey,
  destinationsOf,
  editCreationField,
  focusCreationField,
  isEditable,
  keepDrafting,
  matchCreationView,
  newMatchOf,
  placementOptionsOf,
  redoCreation,
  reloadTheDiskVersion,
  startMatchCreation,
  undoCreation,
  wirePosition,
  type CreationBuffers,
  type CreationRefusal,
  type DestinationRefusal,
  type MatchCreationSession
} from './matchCreation';
import type { AdoptTheDiskVersion } from './editorSave';
import type { DiskAdoptionOutcome } from './saveOutcome';
import type { ConflictChoice, ConflictModel } from './saveOutcome';
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

  it('offers one way out of a conflict, and it is not called "keep my draft"', () => {
    const started = beginCreate(ready());
    const conflicted = applyCreate(started!.session, CONFLICT, NOT_OWED);
    const view = matchCreationView(conflicted);
    expect(view.conflictChoices).toEqual(['keepEditing']);
    expect(conflictOf(conflicted)).not.toBeNull();
    for (const locale of LOCALES) {
      const label = DICTIONARIES[locale]['browser.rawSave.choice.keepEditing'].toLowerCase();
      expect(label).not.toContain('keep my draft');
      expect(label).not.toContain('mantener mi borrador');
    } // End of the loop over the two locales
    const kept = keepDrafting(conflicted);
    expect(conflictOf(kept)).toBeNull();
    expect(isEditable(kept)).toBe(true);
  });

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

describe('the confirmed reload, which is built but not offered yet', () => {
  // **2c-4a-2's High finding.** The consult's Q3 gives every one of the six
  // surfaces a confirmed reload; withholding the *offering* until 2c-4a-3 draws
  // this surface's control is right, and withholding the **transition** was not —
  // an unoffered transition can be built and driven without drawing anything, and
  // leaving it out would have made step 3 invent five model machines on top of
  // five panels. So the transition below is built **and** wired: this surface's
  // `conflictAction` calls it, and `offersReload` stays `false` so nothing on
  // screen reaches it. Every case here calls it directly, as that arm does.

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
   *   answer — a spent confirmation, a conflict this window did not produce, or a
   *   projection replaced since it arrived.
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
    expect(after).toBe(confirmed);
    expect(after.closed).toBe(false);
    expect(conflictOf(after)).not.toBeNull();
  }); // End of the "window refused" case

  it('does not offer the reload, so no control is drawn for it', () => {
    // The half of the review's judgement that stands: the transition exists, is
    // driven here and is called by this surface's `conflictAction`; `offersReload`
    // stays `false`, so nothing on screen can reach it and 2c-4a-3 has only the
    // boolean to flip.
    const asked = askToReloadDiskVersion(conflicted());
    expect(matchCreationView(asked).conflictChoices).toEqual<readonly ConflictChoice[]>([
      'keepEditing'
    ]);
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
