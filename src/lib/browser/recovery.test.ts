/**
 * Recovery from a conflict nothing could resolve automatically, driven without a
 * screen.
 *
 * Eight groups, and each is a way this escape could be wrong in a manner a person
 * would only discover after their file had been written — or after they had lost a
 * draft nothing could land:
 *
 * 1. **the surface matrix** — which of the six write surfaces gets a save-as-new,
 *    driven over **every** `manualResolution` obstacle the five match surfaces can
 *    produce, plus the raw editor's;
 * 2. **the six transfer decisions** — what a retained draft makes of each field,
 *    with `None` and `Some("")` kept apart;
 * 3. **the destinations** — only files that may be written, the conflict's own
 *    document judged by the **disk** projection, and the case where there are none;
 * 4. **the placement** — fixed at the end, with no chooser and no anchor anywhere;
 * 5. **the create** — the acknowledgement round trip, another conflict, an
 *    uncertain send, and a failed adoption after a **known** commit;
 * 6. **the source conflict** — three answers, because an answer that commits
 *    nothing can still have made the window re-read the file;
 * 7. **the two ways out of a conflict of its own** — the rebase that breaks a
 *    stale base and the confirmed reload that ends the form, both built and
 *    neither offered;
 * 8. **what recovery never does** — no create offer for the three operation
 *    surfaces or the raw editor, no send while a refusal stands, and no route
 *    from this module to the command layer at all.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type {
  ContentRevision,
  DocumentSummary,
  DocumentView,
  Finding,
  MatchId,
  MatchView,
  SaveResult,
  ScalarView,
  UnknownEntry
} from '../ipc/types';
import { startDraft, structuredDraftRules } from './draft';
import { makeConflict, makeDocument, makeMatch, makeSummary, scalar } from './fixtures';
import type { InvalidationStatus } from './invalidation';
import {
  CONFLICT_CAPABILITIES as CREATOR_CAPABILITIES,
  type CreationBuffers,
  type CreationReapplyObstacle
} from './matchCreation';
import { CONFLICT_CAPABILITIES as DELETER_CAPABILITIES } from './matchDeletion';
import type { DeletionReapplyObstacle } from './matchDeletion';
import { CONFLICT_CAPABILITIES as DUPLICATOR_CAPABILITIES } from './matchDuplication';
import type { DuplicationReapplyObstacle } from './matchDuplication';
import {
  CONFLICT_CAPABILITIES as EDITOR_CAPABILITIES,
  baselineOf,
  buffersOf,
  type EditorReapplyObstacle,
  type MatchBaseline,
  type MatchBuffers
} from './matchEditor';
import { CONFLICT_CAPABILITIES as MOVER_CAPABILITIES } from './matchMove';
import type { MoveReapplyObstacle } from './matchMove';
import { CONFLICT_CAPABILITIES as RAW_CAPABILITIES } from './rawEditor';
import type { RawEditorReapplyObstacle } from './rawEditor';
import type { ReapplyOutcome } from './reapply';
import type { AdoptTheDiskVersion } from './editorSave';
// The module as a namespace, so the partition below can be compared against the
// set of names it really exports rather than against a list somebody maintains.
import * as recovery from './recovery';
import { describeEditSave, type ConflictModel, type DiskAdoptionOutcome } from './saveOutcome';
import {
  RECOVERY_CONFLICT_CAPABILITIES,
  RECOVERY_POSITION,
  acknowledgeRecoveryFindings,
  applyRecoveryCreate,
  askToReloadRecoveryDiskVersion,
  beginRecoveryCreate,
  confirmRecoveryDiskReload,
  reapplyRecoveryToDiskVersion,
  reloadRecoveryDiskVersion,
  canCreateRecovery,
  chooseRecoveryDestination,
  conflictDraftKindOf,
  editRecoveryField,
  fieldsNotCarried,
  focusRecoveryField,
  isRecoveryEditable,
  keepRecovering,
  newMatchOfRecovery,
  preferredRecoveryDestination,
  recoveryAvailability,
  recoveryBaseRevisionOf,
  recoveryConflictOf,
  recoveryCreateCouldNotBeSent,
  recoveryDestinationsOf,
  recoveryRefusal,
  recoveryRouteOf,
  recoveryIsAnswerable,
  recoveryView,
  recoveryWithoutCreation,
  redoRecoveryEdit,
  sendRecoveryCreate,
  sourceConflictState,
  startCreationFieldRecovery,
  startMatchFieldRecovery,
  transferOfCreationDraft,
  transferOfMatchDraft,
  undoRecoveryEdit,
  type CreateARecoveredSnippet,
  type InstallTheWaitingForm,
  type RecoveryCreateAnswer,
  type RecoveryDraftKind,
  type RecoverySession,
  type RecoveryUnavailable,
  type RecoveryWithoutCreationKind
} from './recovery';

/** The revision the window is projecting when every conflict below arrives. */
const HELD: ContentRevision = 'a'.repeat(64);

/** The revision the disk projection a conflict carries was taken at. */
const DISK: ContentRevision = 'b'.repeat(64);

/** The revision a second file is projected at. */
const OTHER: ContentRevision = 'c'.repeat(64);

/** The revision a committed create ends on. */
const AFTER: ContentRevision = 'd'.repeat(64);

/** The adoption a save that wrote nothing owes: none. */
const NOT_OWED: InvalidationStatus = { kind: 'notOwed' };

/** The adoption a committed save performed. */
const ADOPTED: InvalidationStatus = { kind: 'done' };

/** The adoption a committed save could not perform. */
const NOT_ADOPTED: InvalidationStatus = {
  kind: 'failed',
  failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
};

/** A clock nothing advances, so every keystroke joins one run. */
const CLOCK = (): number => 0;

/**
 * An installation that puts the waiting form nowhere.
 *
 * `sendRecoveryCreate`'s third argument has no default — the 2c-4c-3a review's
 * first High — so a case that is not about the moment a form goes in flight still
 * has to say what it does with it. The cases that **are** about that moment record
 * instead, and `RecoveryPanel.test.ts` presses the controls a real installation
 * makes inert.
 */
const INSTALLS_NOTHING: InstallTheWaitingForm = () => {};

/**
 * An installation that fails the case that reaches it.
 *
 * For the probes where *nothing goes in flight at all* is the property under test.
 */
const REFUSES_TO_INSTALL: InstallTheWaitingForm = () => {
  throw new Error('this form must never be put in flight');
};

/**
 * The snippet the match editor's cases are seeded from.
 *
 * @param overrides - Whatever the case cares about.
 * @returns The projection.
 */
function snippet(overrides: Parameters<typeof makeMatch>[0] = {}): MatchView {
  return makeMatch({
    node: 10,
    document: 2,
    revision: HELD,
    trigger: ':sig',
    replace: 'Regards',
    ...overrides
  });
} // End of function snippet()

/**
 * A projection with one field's scalar replaced by hand.
 *
 * `makeMatch` builds every scalar the ordinary way, and three of the five field
 * refusals are about a scalar that is *not* ordinary, so those views are patched
 * rather than expressed as overrides.
 *
 * @param field - Which field to patch.
 * @param value - The scalar to put there.
 * @returns The projection.
 */
function withScalar(field: 'replace' | 'label' | 'word', value: ScalarView): MatchView {
  const match = snippet({ label: 'A name', options: { word: 'true' } });
  if (field === 'replace') {
    return { ...match, content: { ...match.content, replace: value } };
  }
  if (field === 'label') {
    return { ...match, label: value };
  }
  return { ...match, options: { ...match.options, word: value } };
} // End of function withScalar()

/**
 * A projection whose `label` is a key the projection did not model.
 *
 * @returns The projection.
 */
function unmodelledLabel(): MatchView {
  const entry: UnknownEntry = {
    key: 'label',
    key_node: 9,
    key_span: { start: 0, end: 5 },
    value_span: { start: 6, end: 12 },
    value_kind: 'Mapping',
    value_text: '{a: b}',
    path: null,
    reason: { UnexpectedShape: { found: 'Mapping' } }
  };
  return snippet({ unknownEntries: [entry] });
} // End of function unmodelledLabel()

/**
 * The file the conflict is about, as the **disk** projection carries it.
 *
 * @param overrides - Whatever the case cares about.
 * @returns The projection.
 */
function diskFile(overrides: Parameters<typeof makeDocument>[0] = {}): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision: DISK,
    matches: [makeMatch({ node: 30, document: 2, revision: DISK, trigger: ':other' })],
    ...overrides
  });
} // End of function diskFile()

/**
 * The file the window still holds, which is the parse the conflict refused.
 *
 * @param overrides - Whatever the case cares about.
 * @returns The projection.
 */
function heldFile(overrides: Parameters<typeof makeDocument>[0] = {}): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision: HELD,
    matches: [snippet()],
    ...overrides
  });
} // End of function heldFile()

/**
 * A second snippet file, for the cases about choosing a destination.
 *
 * @param overrides - Whatever the case cares about.
 * @returns The projection.
 */
function otherFile(overrides: Parameters<typeof makeDocument>[0] = {}): DocumentView {
  return makeDocument({
    id: 3,
    relativePath: 'match/other.yml',
    revision: OTHER,
    matches: [makeMatch({ node: 20, document: 3, revision: OTHER, trigger: ':sql' })],
    ...overrides
  });
} // End of function otherFile()

/** The three files the window lists in every case below, in window order. */
const DOCUMENTS: readonly DocumentSummary[] = [
  makeSummary({ id: 1, relativePath: 'config/default.yml', kind: 'ConfigProfile' }),
  makeSummary({ id: 2, relativePath: 'match/base.yml' }),
  makeSummary({ id: 3, relativePath: 'match/other.yml' })
];

/**
 * The conflict a surface is showing, over a drafted value of any shape.
 *
 * Built through `describeEditSave` rather than by hand, so the model under test is
 * handed the value the boundary and the outcome describer really produce — the
 * `source` wire value included, which is what recovery carries and never spends.
 *
 * @typeParam T - The drafted value.
 * @param value - The draft the conflict retained.
 * @param disk - The newly parsed projection the conflict carries.
 * @returns The conflict model.
 */
function conflictOver<T>(value: T, disk: DocumentView = diskFile()): ConflictModel<T> {
  const draft = startDraft(HELD, value, structuredDraftRules<T>());
  const outcome = describeEditSave(
    makeConflict({ disk, expected: HELD }),
    draft,
    EDITOR_CAPABILITIES
  );
  if (outcome.kind !== 'conflict') {
    throw new Error('this helper needs the conflict arm');
  }
  return outcome;
} // End of function conflictOver()

/**
 * A reapply that resolved nothing, carrying one surface's obstacle.
 *
 * @typeParam O - The surface's own obstacle type.
 * @param obstacle - What stopped it.
 * @returns The outcome arm recovery is entered from.
 */
function resolvedNothing<O>(obstacle: O): ReapplyOutcome<unknown, O> {
  return { kind: 'manualResolution', obstacle };
} // End of function resolvedNothing()

/**
 * The baseline and buffers of a match editor's retained draft.
 *
 * @param match - The snippet the editing session was seeded from.
 * @param edits - What the controls hold instead of what the file holds.
 * @returns The pair recovery's transfer reads.
 */
function drafted(
  match: MatchView,
  edits: Partial<MatchBuffers> = {}
): { readonly baseline: MatchBaseline; readonly buffers: MatchBuffers } {
  const baseline = baselineOf(match);
  return { baseline, buffers: { ...buffersOf(baseline), ...edits } };
} // End of function drafted()

/**
 * An opened recovery form over the match editor's draft.
 *
 * @param match - The snippet the editing session was seeded from.
 * @param edits - What the controls hold instead of what the file holds.
 * @param views - The projections the window holds.
 * @param disk - The projection the conflict carries.
 * @returns The form.
 */
function openedOverEditor(
  match: MatchView = snippet(),
  edits: Partial<MatchBuffers> = {},
  views: readonly DocumentView[] = [heldFile(), otherFile()],
  disk: DocumentView = diskFile()
): RecoverySession {
  const { baseline, buffers } = drafted(match, edits);
  const start = startMatchFieldRecovery(
    resolvedNothing<EditorReapplyObstacle>({ kind: 'evidenceNotATarget' }),
    conflictOver<MatchBuffers>(buffers, disk),
    baseline,
    DOCUMENTS,
    views,
    CLOCK
  );
  if (start.kind !== 'ready') {
    throw new Error(`this helper needs an opened form, not ${start.reason}`);
  }
  return start.session;
} // End of function openedOverEditor()

/**
 * An opened recovery form over the creator's draft.
 *
 * @param buffers - What the creator's two boxes held.
 * @returns The form.
 */
function openedOverCreator(
  buffers: CreationBuffers = { trigger: ':new', replace: 'A body' }
): RecoverySession {
  const start = startCreationFieldRecovery(
    resolvedNothing<CreationReapplyObstacle>({ kind: 'notTheDestination' }),
    conflictOver<CreationBuffers>(buffers),
    DOCUMENTS,
    [heldFile(), otherFile()],
    CLOCK
  );
  if (start.kind !== 'ready') {
    throw new Error(`this helper needs an opened form, not ${start.reason}`);
  }
  return start.session;
} // End of function openedOverCreator()

/** A saved outcome that committed, answering the created snippet's identity. */
const CREATED: MatchId = { document: 2, revision: AFTER, node: 44 };

/** What the transaction answers for a committed create. */
const COMMITTED: SaveResult = {
  outcome: 'saved',
  revision: AFTER,
  committed: true,
  notes: [],
  backup_taken: false,
  moved: CREATED
};

/** The finding 2c-4c-1 added, as a refusal carries it. */
const REPEATS_TRIGGER: Finding = {
  code: { NewMatchRepeatsLiteralTrigger: { revision: AFTER } },
  path: null,
  span: null,
  node: null
};

/** What the transaction answers for a create refused for one suspicion. */
const REFUSED: SaveResult = {
  outcome: 'refused',
  verdict: 'RefusedForUnacknowledgedSuspicions',
  findings: [REPEATS_TRIGGER]
};

/**
 * Whether one module's source could reach the IPC command layer.
 *
 * Two ways it could: a **value** import from `../ipc/commands` — a type-only one
 * carries nothing at run time and is not one — or a direct `invoke(` of the Tauri
 * boundary. Written as a function over source text rather than as an assertion, so
 * that the case above can drive it over text that really does break the rule; a
 * scanner nothing false is ever fed is a scanner that cannot fail.
 *
 * @param source - The module's own text.
 * @returns `true` when the text names a route to a command.
 */
function reachesTheCommandLayer(source: string): boolean {
  const valueImport = /import\s+(?!type\b)[^;]*from\s+['"][^'"]*ipc\/commands['"]/;
  return valueImport.test(source) || /\binvoke\s*\(/.test(source);
} // End of function reachesTheCommandLayer()

/**
 * A recorder for the create a recovery sends.
 *
 * @param answers - What to answer, in order.
 * @returns The callback to pass, and the calls it recorded.
 */
function recordingCreate(answers: readonly RecoveryCreateAnswer[]): {
  readonly create: CreateARecoveredSnippet;
  readonly calls: Parameters<CreateARecoveredSnippet>[];
} {
  const calls: Parameters<CreateARecoveredSnippet>[] = [];
  let answered = 0;
  const create: CreateARecoveredSnippet = async (...args) => {
    calls.push(args);
    return answers[answered++] ?? { kind: 'notAttempted' };
  };
  return { create, calls };
} // End of function recordingCreate()

describe('which surface recovery offers a new snippet on', () => {
  it('routes the four draft kinds, and refines the two the conflict machinery has', () => {
    expect(recoveryRouteOf('matchFields')).toBe('createsSnippet');
    expect(recoveryRouteOf('creationFields')).toBe('createsSnippet');
    expect(recoveryRouteOf('operationChoice')).toBe('reloadThenFreshOperation');
    expect(recoveryRouteOf('wholeDocumentText')).toBe('keepEditingWholeDocument');
    expect(conflictDraftKindOf('matchFields')).toBe('authoredText');
    expect(conflictDraftKindOf('creationFields')).toBe('authoredText');
    expect(conflictDraftKindOf('wholeDocumentText')).toBe('authoredText');
    expect(conflictDraftKindOf('operationChoice')).toBe('operationChoice');
  });

  it('agrees with what each of the six surfaces declares about its own draft', () => {
    // The refinement checked against the surfaces themselves rather than against a
    // second opinion held here: a surface that changed its `draftKind` would make
    // this fail rather than leave recovery quietly offering the wrong thing.
    const surfaces: readonly (readonly [RecoveryDraftKind, { readonly draftKind: string }])[] = [
      ['matchFields', EDITOR_CAPABILITIES],
      ['creationFields', CREATOR_CAPABILITIES],
      ['operationChoice', DELETER_CAPABILITIES],
      ['operationChoice', MOVER_CAPABILITIES],
      ['operationChoice', DUPLICATOR_CAPABILITIES],
      ['wholeDocumentText', RAW_CAPABILITIES]
    ];
    for (const [kind, capabilities] of surfaces) {
      expect(conflictDraftKindOf(kind)).toBe(capabilities.draftKind);
    } // End of the loop over the six write surfaces
  });

  it('offers the new snippet for every obstacle the editor and the creator produce', () => {
    const editorObstacles: readonly EditorReapplyObstacle[] = [
      { kind: 'correspondence', reason: 'NoExactCorrespondence' },
      { kind: 'evidenceNotATarget' },
      { kind: 'fieldCollisions', fields: ['trigger', 'replace'] },
      { kind: 'targetNotEditable' }
    ];
    const creatorObstacles: readonly CreationReapplyObstacle[] = [
      { kind: 'correspondence', reason: 'DiskDoesNotParse' },
      { kind: 'evidenceNotATarget' },
      { kind: 'anchorCorrespondence', reason: 'AmbiguousExact' },
      { kind: 'evidenceNotAnAnchor' },
      { kind: 'anchorNotInDestination' },
      { kind: 'notTheDestination' },
      { kind: 'creationRefused', reason: 'anchorUnavailable' }
    ];
    for (const obstacle of editorObstacles) {
      const offer = recoveryAvailability(
        'matchFields',
        resolvedNothing(obstacle),
        conflictOver<MatchBuffers>(drafted(snippet()).buffers),
        DOCUMENTS,
        [heldFile(), otherFile()]
      );
      expect(offer).toEqual({
        kind: 'offered',
        choices: ['createFromSupportedFields'],
        destinations: [
          { document: 2, path: 'match/base.yml', revision: DISK },
          { document: 3, path: 'match/other.yml', revision: OTHER }
        ]
      });
    } // End of the loop over the match editor's four obstacles
    for (const obstacle of creatorObstacles) {
      const offer = recoveryAvailability(
        'creationFields',
        resolvedNothing(obstacle),
        conflictOver<CreationBuffers>({ trigger: ':x', replace: 'y' }),
        DOCUMENTS,
        [heldFile(), otherFile()]
      );
      expect(offer.kind).toBe('offered');
    } // End of the loop over the creator's seven obstacles
  }); // End of the "every obstacle of the two authored-match surfaces" case

  it('offers nothing for the three operation surfaces, whatever stopped their reapply', () => {
    const deletionObstacles: readonly DeletionReapplyObstacle[] = [
      { kind: 'correspondence', reason: 'AmbiguousExact' },
      { kind: 'evidenceNotATarget' },
      { kind: 'notDeletable', reason: 'lastSnippet' }
    ];
    const moveObstacles: readonly MoveReapplyObstacle[] = [
      { kind: 'correspondence', reason: 'SequenceMissing' },
      { kind: 'evidenceNotATarget' },
      { kind: 'anchorCorrespondence', reason: 'NoAnchorInBase' },
      { kind: 'evidenceNotAnAnchor' },
      { kind: 'notTheSameSequence' },
      { kind: 'anchorNotInSequence' },
      { kind: 'moveRefused', reason: 'alreadyMoved' }
    ];
    const duplicationObstacles: readonly DuplicationReapplyObstacle[] = [
      { kind: 'correspondence', reason: 'WrongDocument' },
      { kind: 'evidenceNotATarget' },
      { kind: 'notDuplicable', reason: 'noSequencePosition' }
    ];
    const all = [...deletionObstacles, ...moveObstacles, ...duplicationObstacles];
    for (const obstacle of all) {
      expect(
        recoveryAvailability(
          'operationChoice',
          resolvedNothing(obstacle),
          conflictOver<MatchId>({ document: 2, revision: HELD, node: 10 }),
          DOCUMENTS,
          [heldFile(), otherFile()]
        )
      ).toEqual({ kind: 'unavailable', reason: 'operationDraft' });
    } // End of the loop over every obstacle the three operation surfaces produce
  }); // End of the "no save-as-new for an operation choice" case

  it('offers nothing for the raw editor, whose draft is a whole document', () => {
    const obstacles: readonly RawEditorReapplyObstacle[] = [
      { kind: 'correspondence', reason: 'DiskDoesNotParse' },
      { kind: 'evidenceNotATarget' }
    ];
    for (const obstacle of obstacles) {
      expect(
        recoveryAvailability(
          'wholeDocumentText',
          resolvedNothing(obstacle),
          conflictOver<string>('# the whole file\n'),
          DOCUMENTS,
          [heldFile(), otherFile()]
        )
      ).toEqual({ kind: 'unavailable', reason: 'wholeDocumentDraft' });
    } // End of the loop over the raw editor's two obstacles
    // And the raw editor cannot produce a `manualResolution` at all, because its
    // reapply support is `unavailable` — checked here so that the sentence above
    // is not the only thing saying so.
    expect(RAW_CAPABILITIES.reapplySupport).toBe('unavailable');
  });

  it('refuses every arm of a reapply that is not the manual one', () => {
    const arms: readonly ReapplyOutcome<unknown, EditorReapplyObstacle>[] = [
      { kind: 'reapplied', session: null },
      { kind: 'alreadySatisfied', session: null },
      { kind: 'adoptionRefused' },
      { kind: 'unavailable' },
      { kind: 'notAttempted' }
    ];
    for (const arm of [...arms, null]) {
      expect(
        recoveryAvailability(
          'matchFields',
          arm,
          conflictOver<MatchBuffers>(drafted(snippet()).buffers),
          DOCUMENTS,
          [heldFile(), otherFile()]
        )
      ).toEqual({ kind: 'unavailable', reason: 'notFromManualResolution' });
    } // End of the loop over the five arms that are not `manualResolution`
  });

  it('refuses when there is no conflict to recover a draft from', () => {
    expect(
      recoveryAvailability(
        'matchFields',
        resolvedNothing<EditorReapplyObstacle>({ kind: 'evidenceNotATarget' }),
        null,
        DOCUMENTS,
        [heldFile(), otherFile()]
      )
    ).toEqual({ kind: 'unavailable', reason: 'noConflict' });
  });

  it('answers `noConflict` on all four kinds when there is no conflict at all', () => {
    // **2c-4c-3b's one model change, and the defect it closes.** Until this step the
    // route check came first, so a surface that cannot create answered
    // `operationDraft` or `wholeDocumentDraft` **whatever was going on** — and
    // `recoveryIsAnswerable` calls both worth a sentence, so the deleter, the mover,
    // the duplicator and the raw editor would each have carried a permanent
    // paragraph about a version on disk that was not in dispute. The two creating
    // kinds are unaffected on a screen: `noConflict` and `notFromManualResolution`
    // are both refusals nothing draws.
    const kinds: readonly RecoveryDraftKind[] = [
      'matchFields',
      'creationFields',
      'operationChoice',
      'wholeDocumentText'
    ];
    for (const kind of kinds) {
      const offer = recoveryAvailability(
        kind,
        resolvedNothing<EditorReapplyObstacle>({ kind: 'evidenceNotATarget' }),
        null,
        DOCUMENTS,
        [heldFile(), otherFile()]
      );
      expect(offer, kind).toEqual({ kind: 'unavailable', reason: 'noConflict' });
      expect(recoveryIsAnswerable(offer), kind).toBe(false);
    } // End of the loop over all four recovery draft kinds
  }); // End of the "no conflict is asked first" case
}); // End of the "surface matrix" suite

describe('what a surface that cannot create says about recovery', () => {
  /** The two kinds `recoveryWithoutCreation` accepts, with the reason each shows. */
  const SURFACES: readonly (readonly [RecoveryWithoutCreationKind, RecoveryUnavailable])[] = [
    ['operationChoice', 'operationDraft'],
    ['wholeDocumentText', 'wholeDocumentDraft']
  ];

  it('says nothing at all while there is no conflict', () => {
    for (const [kind] of SURFACES) {
      expect(recoveryWithoutCreation(kind, null), kind).toBeNull();
    }
  });

  it('names what the surface drafts once a conflict is showing', () => {
    for (const [kind, reason] of SURFACES) {
      expect(
        recoveryWithoutCreation(kind, conflictOver<string>('# the whole file\n')),
        kind
      ).toBe(reason);
    }
  });

  it('answers the same thing as the full gate, whatever else the window holds', () => {
    // **The agreement this narrowing rests on, driven rather than asserted in a
    // comment.** `recoveryWithoutCreation` passes no reapply attempt and two empty
    // document lists, which is safe only because a route that is not
    // `createsSnippet` reaches neither the reapply check nor the destination list.
    // That is a property of one ordering in one function, so a later reordering has
    // to fail here rather than silently making four screens go quiet.
    const arms: readonly (ReapplyOutcome<unknown, EditorReapplyObstacle> | null)[] = [
      null,
      { kind: 'reapplied', session: null },
      { kind: 'alreadySatisfied', session: null },
      { kind: 'adoptionRefused' },
      { kind: 'unavailable' },
      { kind: 'notAttempted' },
      resolvedNothing<EditorReapplyObstacle>({ kind: 'evidenceNotATarget' })
    ];
    for (const [kind, reason] of SURFACES) {
      for (const arm of arms) {
        const full = recoveryAvailability(
          kind,
          arm,
          conflictOver<string>('# the whole file\n'),
          DOCUMENTS,
          [heldFile(), otherFile()]
        );
        expect(full, kind).toEqual({ kind: 'unavailable', reason });
        expect(recoveryWithoutCreation(kind, conflictOver<string>('# the whole file\n')), kind).toBe(
          reason
        );
      } // End of the loop over every arm a reapply can leave behind
    } // End of the loop over the two non-creating surfaces
  }); // End of the "narrow gate agrees with the full one" case
}); // End of the "a surface that cannot create" suite

describe('what a retained draft becomes in the new snippet', () => {
  it('carries what the file holds for a field the draft leaves alone', () => {
    const { baseline, buffers } = drafted(snippet({ label: 'A name' }));
    const transfer = transferOfMatchDraft(baseline, buffers);
    expect(transfer.trigger).toEqual({ kind: 'carried', text: ':sig' });
    expect(transfer.replace).toEqual({ kind: 'carried', text: 'Regards' });
    expect(transfer.label).toEqual({ kind: 'carried', text: 'A name' });
  });

  it('carries what the draft would write, over what the file holds', () => {
    const { baseline, buffers } = drafted(snippet({ label: 'A name' }), {
      replace: { text: 'Kind regards', removed: false }
    });
    expect(transferOfMatchDraft(baseline, buffers).replace).toEqual({
      kind: 'carried',
      text: 'Kind regards'
    });
  });

  it('omits a key the file never held and the draft left blank', () => {
    // **The `None`-versus-`Some("")` case, from the side that must be `None`.**
    // The buffer is empty and the file held no `label`, so the new snippet is born
    // without the key — asking Rust to write `label: ''` here is what writing an
    // empty value into a file that never had one looks like.
    const { baseline, buffers } = drafted(snippet());
    expect(baseline.label.present).toBe(false);
    expect(transferOfMatchDraft(baseline, buffers).label).toEqual({
      kind: 'notCarried',
      reason: { kind: 'notInTheFile' }
    });
  });

  it('carries an empty value for a present key the draft cleared', () => {
    // The other side of the same distinction: the file held the key, the person
    // emptied it, and what a save of that draft would write is an empty value.
    const { baseline, buffers } = drafted(snippet({ label: 'A name' }), {
      label: { text: '', removed: false }
    });
    expect(transferOfMatchDraft(baseline, buffers).label).toEqual({ kind: 'carried', text: '' });
  });

  it('omits a key the draft asks to have taken out', () => {
    const { baseline, buffers } = drafted(snippet({ label: 'A name' }), {
      label: { text: 'A name', removed: true }
    });
    expect(transferOfMatchDraft(baseline, buffers).label).toEqual({
      kind: 'notCarried',
      reason: { kind: 'removedByTheDraft' }
    });
  });

  it('carries nothing for any of the five fields this editor may not edit', () => {
    const cases: readonly (readonly [MatchView, 'trigger' | 'replace' | 'label' | 'word', string])[] =
      [
        [snippet({ triggerKind: 'Regex', regex: '^a' }), 'trigger', 'triggerNotSingle'],
        [withScalar('replace', { ...scalar('b'), decoded: false }), 'replace', 'notDecodable'],
        [withScalar('replace', scalar('a\rb')), 'replace', 'carriageReturn'],
        [withScalar('label', { ...scalar(''), span: { start: 12, end: 12 } }), 'label', 'ownsNoBytes'],
        [unmodelledLabel(), 'label', 'unmodelledShape']
      ];
    for (const [match, field, reason] of cases) {
      const { baseline, buffers } = drafted(match);
      expect(transferOfMatchDraft(baseline, buffers)[field]).toEqual({
        kind: 'notCarried',
        reason: { kind: 'fieldNotEditable', reason }
      });
    } // End of the loop over the five field refusals
  }); // End of the "read-only fields are not transferred" case

  it('refuses a drafted value carrying a carriage return no control could produce', () => {
    // `MatchBuffers` carries no brand, so a caller that is not a control can put
    // one there. What that must never become is a key in a creation Rust writes.
    const { baseline, buffers } = drafted(snippet(), {
      replace: { text: 'a\rb', removed: false }
    });
    expect(transferOfMatchDraft(baseline, buffers).replace).toEqual({
      kind: 'notCarried',
      reason: { kind: 'carriageReturn' }
    });
  });

  it('makes the creator’s two authored fields the whole of its transfer', () => {
    const transfer = transferOfCreationDraft({ trigger: ':new', replace: 'A body' });
    expect(transfer.trigger).toEqual({ kind: 'carried', text: ':new' });
    expect(transfer.replace).toEqual({ kind: 'carried', text: 'A body' });
    expect(fieldsNotCarried(transfer)).toEqual(['label', 'word', 'left_word', 'right_word']);
    expect(transfer.word).toEqual({ kind: 'notCarried', reason: { kind: 'notInTheFile' } });
  });

  it('writes only the keys the transfer carried, and an empty one when it carried empty', () => {
    const { baseline, buffers } = drafted(
      snippet({ label: 'A name', options: { word: 'true' } }),
      { label: { text: '', removed: false } }
    );
    const transfer = transferOfMatchDraft(baseline, buffers);
    const newMatch = newMatchOfRecovery(transfer, { trigger: ':sig', replace: 'Regards' });
    expect(newMatch).toEqual({ trigger: ':sig', replace: 'Regards', label: '', word: 'true' });
    // The absent keys are **absent**, not present and undefined: `serde` reads a
    // missing key as `None` and would read an explicit `null` the same way, but a
    // property that exists at all is what `exactOptionalPropertyTypes` is about.
    expect('left_word' in newMatch).toBe(false);
    expect('right_word' in newMatch).toBe(false);
  }); // End of the "None is not Some(empty)" case

  it('takes the two mandatory values from the controls and never from the transfer', () => {
    const transfer = transferOfCreationDraft({ trigger: ':new', replace: 'A body' });
    expect(newMatchOfRecovery(transfer, { trigger: ':typed', replace: 'Typed' })).toEqual({
      trigger: ':typed',
      replace: 'Typed'
    });
  });
}); // End of the "transfer" suite

describe('where a recovered snippet may go', () => {
  it('offers every file that may be written, in window order, and nothing else', () => {
    const listless = otherFile({ id: 4, relativePath: 'match/vars.yml', topLevelKeys: ['global_vars'] });
    const documents = [...DOCUMENTS, makeSummary({ id: 4, relativePath: 'match/vars.yml' })];
    expect(recoveryDestinationsOf(documents, [heldFile(), otherFile(), listless], diskFile())).toEqual([
      { document: 2, path: 'match/base.yml', revision: DISK },
      { document: 3, path: 'match/other.yml', revision: OTHER }
    ]);
  });

  it('judges the conflict’s own file by the disk projection and not by the stale one', () => {
    // The window still holds the parse the save was refused against. Asking that
    // one whether the file still has a snippet list would be answering from bytes
    // this application already knows are gone.
    const gone = diskFile({ topLevelKeys: ['global_vars'] });
    expect(recoveryDestinationsOf(DOCUMENTS, [heldFile(), otherFile()], gone)).toEqual([
      { document: 3, path: 'match/other.yml', revision: OTHER }
    ]);
    // And the other way round: the window's own projection of that file did not
    // parse, while the disk one does.
    const broken = heldFile({ parsed: false, topLevelKeys: [] });
    expect(recoveryDestinationsOf(DOCUMENTS, [broken, otherFile()], diskFile())).toEqual([
      { document: 2, path: 'match/base.yml', revision: DISK },
      { document: 3, path: 'match/other.yml', revision: OTHER }
    ]);
  }); // End of the "disk projection decides" case

  it('never offers a read-only file, a profile, or one this window could not read', () => {
    const readOnly = makeSummary({ id: 5, relativePath: 'match/hub.yml', readOnly: true });
    const unread = makeSummary({ id: 6, relativePath: 'match/unread.yml' });
    const documents = [...DOCUMENTS, readOnly, unread];
    const views = [heldFile(), otherFile(), makeDocument({ id: 5, relativePath: 'match/hub.yml', readOnly: true })];
    expect(
      recoveryDestinationsOf(documents, views, diskFile()).map((one) => one.document)
    ).toEqual([2, 3]);
  });

  it('prefers the conflict’s own file only when it may still be written', () => {
    const offered = recoveryDestinationsOf(DOCUMENTS, [heldFile(), otherFile()], diskFile());
    expect(preferredRecoveryDestination(offered, 2)).toBe(2);
    const withoutIt = recoveryDestinationsOf(
      DOCUMENTS,
      [heldFile(), otherFile()],
      diskFile({ topLevelKeys: ['global_vars'] })
    );
    expect(preferredRecoveryDestination(withoutIt, 2)).toBeNull();
  });

  it('writes nothing and keeps the draft when no file may be written into', async () => {
    const start = startMatchFieldRecovery(
      resolvedNothing<EditorReapplyObstacle>({ kind: 'targetNotEditable' }),
      conflictOver<MatchBuffers>(
        drafted(snippet()).buffers,
        diskFile({ topLevelKeys: ['global_vars'] })
      ),
      drafted(snippet()).baseline,
      [DOCUMENTS[1]!],
      [heldFile()],
      CLOCK
    );
    expect(start).toEqual({ kind: 'unavailable', reason: 'noEligibleDestination' });
    // The missing `matches:` list is not permission to create one: there is no
    // session, so there is nothing to send from and nothing to send it with.
  }); // End of the "nowhere to write" case

  it('starts on the conflict’s file, and re-points the draft when the choice moves', () => {
    const session = openedOverEditor();
    expect(session.chosen).toBe(2);
    expect(recoveryBaseRevisionOf(session)).toBe(DISK);
    const moved = chooseRecoveryDestination(session, 3);
    expect(moved.chosen).toBe(3);
    expect(recoveryBaseRevisionOf(moved)).toBe(OTHER);
    // A file that is not one of this form's own destinations is refused rather
    // than installed.
    expect(chooseRecoveryDestination(moved, 1)).toBe(moved);
    expect(chooseRecoveryDestination(moved, 99)).toBe(moved);
  });

  it('withdraws consent and the panel when the destination moves', async () => {
    const refusedFirst = await sendRecoveryCreate(
      openedOverEditor(),
      recordingCreate([{ kind: 'answered', result: REFUSED, adoption: NOT_OWED }]).create,
      INSTALLS_NOTHING
    );
    const consented = acknowledgeRecoveryFindings(refusedFirst);
    expect(consented.draft.consent).not.toBeNull();
    const moved = chooseRecoveryDestination(consented, 3);
    expect(moved.draft.consent).toBeNull();
    expect(moved.outcome).toBeNull();
    expect(moved.submitted).toBeNull();
    // And the retry into the other file sends no acknowledgement at all.
    const { create, calls } = recordingCreate([
      { kind: 'answered', result: COMMITTED, adoption: ADOPTED }
    ]);
    await sendRecoveryCreate(moved, create, INSTALLS_NOTHING);
    expect(calls[0]![3]).toBe(OTHER);
    expect(calls[0]![4]).toEqual({ accepted: [] });
  }); // End of the "consent does not cross a destination" case
}); // End of the "destinations" suite

describe('where in the file a recovered snippet goes', () => {
  it('is the end, and there is no other value and no chooser', async () => {
    expect(RECOVERY_POSITION).toEqual({ End: {} });
    const started = beginRecoveryCreate(openedOverEditor());
    expect(started?.position).toBe(RECOVERY_POSITION);
    // No anchor, no ordinal, no front: the whole of what is sent is checked, not
    // just the arm's name.
    expect(JSON.stringify(started?.position)).toBe('{"End":{}}');
    const { create, calls } = recordingCreate([
      { kind: 'answered', result: COMMITTED, adoption: ADOPTED }
    ]);
    await sendRecoveryCreate(openedOverEditor(), create, INSTALLS_NOTHING);
    expect(calls[0]![2]).toEqual({ End: {} });
    expect(recoveryView(openedOverEditor()).position).toEqual({ End: {} });
  });
}); // End of the "placement" suite

describe('sending the recovery create', () => {
  it('hands the waiting form back before it authorizes anything, and only when it sends', async () => {
    // **The 2c-4c-3a review's first High, held in the model rather than in the one
    // renderer that composes it.** A caller awaiting this function holds the
    // pre-send form for the whole flight, so the moment the form goes in flight has
    // to be offered synchronously or it does not exist at all. What is pinned here
    // is the ordering and the gating; that a caller *installs* what it is handed is
    // `RecoveryPanel.test.ts`'s, and no type forces it.
    const order: string[] = [];
    const installed: RecoverySession[] = [];
    const create: CreateARecoveredSnippet = async (...args) => {
      order.push('create');
      expect(installed).toHaveLength(1);
      // The revision on the wire is the waiting form's own, so the two values
      // cannot describe two different sends.
      expect(args[3]).toBe(recoveryBaseRevisionOf(installed[0]!));
      return { kind: 'answered', result: COMMITTED, adoption: ADOPTED };
    };
    const after = await sendRecoveryCreate(openedOverEditor(), create, (waiting) => {
      order.push('install');
      installed.push(waiting);
    });
    expect(order).toEqual(['install', 'create']);
    // What was handed over is the form gated as saving, which is what makes every
    // control the view gates on `saving` inert for the flight.
    expect(installed[0]!.phase).toBe('saving');
    expect(recoveryView(installed[0]!).saving).toBe(true);
    expect(recoveryView(installed[0]!).canCreate).toBe(false);
    expect(recoveryView(installed[0]!).refusal).toBe('saveInFlight');
    expect(recoveryView(installed[0]!).editable).toBe(false);
    expect(after.committed).toBe(true);
  }); // End of the "the waiting form is offered before the send" case

  it('offers no waiting form for a form it will not send', async () => {
    // The mirror of the case above: a refusal calls neither callback, so nothing
    // installs a `saving` state a person could never leave.
    const installed: RecoverySession[] = [];
    const blank = editRecoveryField(openedOverCreator({ trigger: '', replace: 'A body' }), 'trigger', '');
    const { create, calls } = recordingCreate([]);
    expect(await sendRecoveryCreate(blank, create, (waiting) => installed.push(waiting))).toBe(blank);
    expect(installed).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('composes the one create the caller supplies, with the drafted values', async () => {
    const { create, calls } = recordingCreate([
      { kind: 'answered', result: COMMITTED, adoption: ADOPTED }
    ]);
    const session = openedOverEditor(snippet({ label: 'A name' }));
    const after = await sendRecoveryCreate(session, create, INSTALLS_NOTHING);
    expect(calls).toHaveLength(1);
    expect(calls[0]![0]).toBe(2);
    expect(calls[0]![1]).toEqual({
      trigger: ':sig',
      replace: 'Regards',
      label: 'A name'
    });
    expect(calls[0]![3]).toBe(DISK);
    expect(after.committed).toBe(true);
    expect(after.created).toEqual(CREATED);
  });

  it('refuses the findings once and commits on the second attempt', async () => {
    const { create, calls } = recordingCreate([
      { kind: 'answered', result: REFUSED, adoption: NOT_OWED },
      { kind: 'answered', result: COMMITTED, adoption: ADOPTED }
    ]);
    const refused = await sendRecoveryCreate(openedOverEditor(), create, INSTALLS_NOTHING);
    expect(refused.outcome?.kind).toBe('refused');
    expect(recoveryView(refused).refusalChoices).toEqual(['saveAnyway', 'keepEditing']);
    expect(refused.committed).toBe(false);
    expect(sourceConflictState(refused)).toBe('retained');
    const consented = acknowledgeRecoveryFindings(refused);
    const committed = await sendRecoveryCreate(consented, create, INSTALLS_NOTHING);
    expect(calls[1]![4]).toEqual({ accepted: [REPEATS_TRIGGER] });
    expect(committed.committed).toBe(true);
  }); // End of the "acknowledgement round trip" case

  it('withdraws the offer to save anyway once the findings are about another draft', async () => {
    const refused = await sendRecoveryCreate(
      openedOverEditor(),
      recordingCreate([{ kind: 'answered', result: REFUSED, adoption: NOT_OWED }]).create,
      INSTALLS_NOTHING
    );
    const typed = editRecoveryField(refused, 'trigger', ':other');
    expect(recoveryView(typed).findingsAreStale).toBe(true);
    expect(recoveryView(typed).refusalChoices).toEqual(['keepEditing']);
  });

  it('keeps its own conflict, and the source conflict, when the file moved again', async () => {
    const session = openedOverEditor();
    const conflicted = await sendRecoveryCreate(
      session,
      recordingCreate([
        {
          kind: 'answered',
          result: makeConflict({ disk: diskFile({ revision: AFTER }), expected: DISK }),
          adoption: NOT_OWED
        }
      ]).create,
      INSTALLS_NOTHING
    );
    expect(recoveryConflictOf(conflicted)).not.toBeNull();
    expect(conflicted.committed).toBe(false);
    expect(sourceConflictState(conflicted)).toBe('retained');
    // The conflict this form was opened from is **the same wire value**, neither
    // replaced nor spent.
    expect(conflicted.origin.conflict).toBe(session.origin.conflict);
    expect(conflicted.origin.diskRevision).toBe(DISK);
    // And the form refuses to send anything more until the panel is dismissed.
    expect(recoveryRefusal(conflicted)).toBe('conflict');
    expect(isRecoveryEditable(conflicted)).toBe(false);
    expect(isRecoveryEditable(keepRecovering(conflicted))).toBe(true);
  }); // End of the "another conflict" case

  it('says a send may have written, and does not say nothing was written', async () => {
    const { create } = recordingCreate([
      {
        kind: 'failed',
        mayHaveWritten: true,
        failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
      }
    ]);
    const session = openedOverEditor();
    const after = await sendRecoveryCreate(session, create, INSTALLS_NOTHING);
    expect(after.sendFailure?.kind).toBe('mayHaveWritten');
    expect(after.outcome).toBeNull();
    expect(after.committed).toBe(false);
    // Nothing the person typed is lost.
    expect(after.draft.value).toEqual(session.draft.value);
    expect(recoveryView(after).failureLines).toHaveLength(1);
    // **And the source conflict is not called intact**, which is the review's
    // High: `mayHaveWritten` is the exact answer on which `BrowserState.createMatch`
    // orders a re-read of the file, and what that re-read installed — or where it
    // left the selection — is reported back to neither this model nor its caller.
    // The real wrapper ordering one is `workspace.test.ts`'s to drive; what this
    // pins is that the model stops claiming the window is where it was.
    expect(sourceConflictState(after)).toBe('windowMoved');
    expect(recoveryView(after).sourceConflict).toBe('windowMoved');
  }); // End of the "uncertain send" case

  it('leaves the source conflict alone for a failure that wrote nothing', async () => {
    const after = await sendRecoveryCreate(
      openedOverEditor(),
      recordingCreate([
        {
          kind: 'failed',
          mayHaveWritten: false,
          failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
        }
      ]).create,
      INSTALLS_NOTHING
    );
    expect(after.sendFailure?.kind).toBe('notSent');
    expect(sourceConflictState(after)).toBe('retained');
  });

  it('says nothing was written for a state that refused before any command ran', async () => {
    const after = await sendRecoveryCreate(
      openedOverEditor(),
      recordingCreate([{ kind: 'notAttempted' }]).create,
      INSTALLS_NOTHING
    );
    expect(after.sendFailure).toEqual({ kind: 'notSent', reason: null });
  });

  it('raises the two failure arms from outside the composition too', () => {
    // The transition is public because a caller that composes `beginRecoveryCreate`
    // itself still has to be able to say what became of its own send.
    const started = beginRecoveryCreate(openedOverEditor())!;
    expect(recoveryCreateCouldNotBeSent(started.session, false, null).sendFailure).toEqual({
      kind: 'notSent',
      reason: null
    });
    const uncertain = recoveryCreateCouldNotBeSent(started.session, true, {
      kind: 'command',
      error: { code: 'noWorkspaceOpen' }
    });
    expect(uncertain.sendFailure?.kind).toBe('mayHaveWritten');
    // Back to drafting either way, so nothing the person typed is stranded behind
    // a phase that never ends.
    expect(uncertain.phase).toBe('editing');
  });

  it('reports a committed create whose adoption failed as a save, never as an error', async () => {
    const after = await sendRecoveryCreate(
      openedOverEditor(),
      recordingCreate([{ kind: 'answered', result: COMMITTED, adoption: NOT_ADOPTED }]).create,
      INSTALLS_NOTHING
    );
    expect(after.outcome?.kind).toBe('saved');
    expect(after.committed).toBe(true);
    expect(recoveryView(after).messages).toContainEqual({ kind: 'windowOutOfStep' });
    // The bytes are on disk, so the conflict that sent the person here is answered
    // whether or not this window could read the file back.
    expect(sourceConflictState(after)).toBe('spent');
  }); // End of the "failed adoption after a known commit" case

  it('spends the form on a commit and lets nothing dismiss its way past that', async () => {
    const after = await sendRecoveryCreate(
      openedOverEditor(),
      recordingCreate([{ kind: 'answered', result: COMMITTED, adoption: ADOPTED }]).create,
      INSTALLS_NOTHING
    );
    expect(recoveryRefusal(after)).toBe('alreadyCreated');
    expect(recoveryRefusal(keepRecovering(after))).toBe('alreadyCreated');
    expect(beginRecoveryCreate(after)).toBeNull();
    expect(isRecoveryEditable(after)).toBe(false);
    const { create, calls } = recordingCreate([]);
    expect(await sendRecoveryCreate(after, create, INSTALLS_NOTHING)).toBe(after);
    expect(calls).toEqual([]);
  });

  it('retains the source conflict for a saved arm that committed nothing and moved nothing', async () => {
    const wroteNothing: SaveResult = { ...COMMITTED, committed: false, moved: null };
    const after = await sendRecoveryCreate(
      openedOverEditor(),
      recordingCreate([{ kind: 'answered', result: wroteNothing, adoption: NOT_OWED }]).create,
      INSTALLS_NOTHING
    );
    expect(after.committed).toBe(false);
    expect(sourceConflictState(after)).toBe('retained');
  });

  it('does not call the source conflict intact when a non-committed arm reconciled the window', async () => {
    // **The other half of the review's High.** A recovery create is based on the
    // conflict's disk revision while the window still projects the older one, so
    // `BrowserState.createMatch` treats even a `committed: false` saved arm as out
    // of date and adopts — and the adoption status is what says so.
    const wroteNothing: SaveResult = { ...COMMITTED, committed: false, moved: null };
    for (const adoption of [ADOPTED, NOT_ADOPTED]) {
      const after = await sendRecoveryCreate(
        openedOverEditor(),
        recordingCreate([{ kind: 'answered', result: wroteNothing, adoption }]).create,
        INSTALLS_NOTHING
      );
      expect(after.committed).toBe(false);
      expect(after.windowWasReconciled).toBe(true);
      expect(sourceConflictState(after)).toBe('windowMoved');
    } // End of the loop over the two ways a reconciliation can end
  }); // End of the "saved, committed: false, reconciled" case

  it('keeps saying the window may have moved once a re-read was ordered, through every later transition', async () => {
    const moved = await sendRecoveryCreate(
      openedOverEditor(),
      recordingCreate([
        {
          kind: 'failed',
          mayHaveWritten: true,
          failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
        }
      ]).create,
      INSTALLS_NOTHING
    );
    // Dismissing a panel, typing and choosing another destination observe nothing
    // about the window: none of them can withdraw a re-read that was already
    // ordered, and none of them can learn what came of it.
    expect(sourceConflictState(keepRecovering(moved))).toBe('windowMoved');
    expect(sourceConflictState(editRecoveryField(moved, 'trigger', ':again'))).toBe('windowMoved');
    expect(sourceConflictState(chooseRecoveryDestination(moved, 3))).toBe('windowMoved');
    const refusedLater = await sendRecoveryCreate(
      moved,
      recordingCreate([{ kind: 'answered', result: REFUSED, adoption: NOT_OWED }]).create,
      INSTALLS_NOTHING
    );
    expect(sourceConflictState(refusedLater)).toBe('windowMoved');
  }); // End of the "the record is never withdrawn" case

  it('ignores an answer for a form that sent nothing', () => {
    const session = openedOverEditor();
    expect(applyRecoveryCreate(session, COMMITTED, ADOPTED)).toBe(session);
  });
}); // End of the "sending" suite

/**
 * One export that takes a form and answers something, and what a closed form owes.
 *
 * `answersItself` is the property under test — the same session, by reference —
 * and `otherwise` is for the two doors that answer something else entirely: a
 * reapply answers a `ReapplyOutcome`'s `notAttempted`, and `beginRecoveryCreate`
 * answers `null`.
 */
interface ClosedFormProbe {
  /**
   * Calls the export with whatever it needs besides the form.
   *
   * @param closed - The closed form.
   * @param adopt - The window's adoption, for the two that take one.
   * @returns Whatever that export answered.
   */
  readonly answers: (
    closed: RecoverySession,
    adopt: AdoptTheDiskVersion<CreationBuffers>
  ) => unknown | Promise<unknown>;
  /** Whether the answer must be the very session that was handed in. */
  readonly answersItself: boolean;
  /** What it must answer instead, when it answers something else. */
  readonly otherwise?: unknown;
}

/**
 * Every export that takes a recovery form, keyed by its own name.
 *
 * Keyed by name so the partition below can be compared against `Object.keys` of
 * the module itself: this is the half that is probed, and
 * {@link NOT_A_FORM_TRANSITION} is the half that is not.
 */
const CLOSED_FORM_PROBES: Readonly<Record<string, ClosedFormProbe>> = {
  focusRecoveryField: {
    answers: (closed) => focusRecoveryField(closed, 'trigger'),
    answersItself: true
  },
  keepRecovering: { answers: (closed) => keepRecovering(closed), answersItself: true },
  editRecoveryField: {
    answers: (closed) => editRecoveryField(closed, 'trigger', ':anything'),
    answersItself: true
  },
  undoRecoveryEdit: { answers: (closed) => undoRecoveryEdit(closed), answersItself: true },
  redoRecoveryEdit: { answers: (closed) => redoRecoveryEdit(closed), answersItself: true },
  chooseRecoveryDestination: {
    answers: (closed) => chooseRecoveryDestination(closed, 3),
    answersItself: true
  },
  acknowledgeRecoveryFindings: {
    answers: (closed) => acknowledgeRecoveryFindings(closed),
    answersItself: true
  },
  askToReloadRecoveryDiskVersion: {
    answers: (closed) => askToReloadRecoveryDiskVersion(closed),
    answersItself: true
  },
  confirmRecoveryDiskReload: {
    answers: (closed) => confirmRecoveryDiskReload(closed),
    answersItself: true
  },
  reloadRecoveryDiskVersion: {
    answers: (closed, adopt) => reloadRecoveryDiskVersion(closed, adopt),
    answersItself: true
  },
  applyRecoveryCreate: {
    answers: (closed) => applyRecoveryCreate(closed, COMMITTED, ADOPTED),
    answersItself: true
  },
  recoveryCreateCouldNotBeSent: {
    // **The door round 4 found missing** from the hand-written list this table
    // replaced.
    answers: (closed) => recoveryCreateCouldNotBeSent(closed, true, null),
    answersItself: true
  },
  sendRecoveryCreate: {
    // The installer **throws** rather than records: a closed form must reach
    // neither the boundary nor the moment a form goes in flight, and a probe that
    // silently accepted an installation would let a terminal form be drawn as
    // saving with nothing ever coming back to clear it.
    answers: (closed) => sendRecoveryCreate(closed, recordingCreate([]).create, REFUSES_TO_INSTALL),
    answersItself: true
  },
  reapplyRecoveryToDiskVersion: {
    answers: (closed, adopt) => reapplyRecoveryToDiskVersion(closed, adopt),
    answersItself: false,
    otherwise: { kind: 'notAttempted' }
  },
  beginRecoveryCreate: {
    answers: (closed) => beginRecoveryCreate(closed),
    answersItself: false,
    otherwise: null
  }
};

/**
 * Every other value this module exports, and why it is not probed above.
 *
 * Four kinds, and each is a claim a reader can check: a **producer** builds a
 * form or a value out of things that are not a form; a **query** takes one and
 * answers a fact about it rather than a new form; a **constant** is data; and a
 * **key function** turns a code into a dictionary key, which 2c-4c-3a added and
 * which takes no form at all.
 */
const NOT_A_FORM_TRANSITION: readonly string[] = [
  // Producers: they build values, and none of them takes a form.
  'startMatchFieldRecovery',
  'startCreationFieldRecovery',
  'recoveryAvailability',
  // 2c-4c-3b's one new export: a kind and a conflict in, a code or `null` out.
  'recoveryWithoutCreation',
  'recoveryDestinationsOf',
  'preferredRecoveryDestination',
  'transferOfField',
  'transferOfMatchDraft',
  'transferOfCreationDraft',
  'newMatchOfRecovery',
  'conflictDraftKindOf',
  'recoveryRouteOf',
  'fieldsNotCarried',
  // Queries: they take a form and answer a fact about it, never a form.
  'sourceConflictState',
  'recoveryConflictOf',
  'isRecoveryEditable',
  'recoveryRefusal',
  'canCreateRecovery',
  'recoveryView',
  'recoveryBaseRevisionOf',
  'recoveryIsAnswerable',
  'transferStatusOf',
  // Key functions, added at 2c-4c-3a: each takes a code and answers a dictionary
  // key, and not one of them takes a form.
  'recoveryChoiceKey',
  'recoveryUnavailableKey',
  'transferStatusKey',
  'transferRefusalKey',
  'recoveryRefusalKey',
  'recoveryReapplyObstacleKey',
  'sourceConflictStateKey',
  // Constants.
  'RECOVERY_POSITION',
  'RECOVERY_CONFLICT_CAPABILITIES'
];

describe('the two ways out of a conflict of this form’s own', () => {
  /**
   * A form whose own create conflicted, over a projection a case chooses.
   *
   * @param disk - The newly parsed projection that conflict carries.
   * @param targetless - Whether its subject is a creation's, which is what a real
   *   `create_match` conflict answers.
   * @returns The form, showing its own conflict.
   */
  async function conflictedForm(
    disk: DocumentView = diskFile({ revision: AFTER }),
    targetless = true
  ): Promise<RecoverySession> {
    return sendRecoveryCreate(
      openedOverEditor(),
      recordingCreate([
        {
          kind: 'answered',
          result: makeConflict({
            disk,
            expected: DISK,
            subject: targetless ? { Targetless: {} } : { Unsupported: {} }
          }),
          adoption: NOT_OWED
        }
      ]).create,
      INSTALLS_NOTHING
    );
  } // End of function conflictedForm()

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

  it('rebases the form onto the newly parsed file, which is what breaks the stale base', async () => {
    // **The review's third finding.** Dismissing the panel changes no revision, so
    // the next send meets the base the transaction has already refused. The reapply
    // is the transition that moves the form forward while keeping what was typed.
    const conflicted = await conflictedForm();
    expect(recoveryBaseRevisionOf(conflicted)).toBe(DISK);
    const { adopt, adoptions } = adopting();
    const attempt = reapplyRecoveryToDiskVersion(conflicted, adopt);
    expect(attempt.kind).toBe('reapplied');
    if (attempt.kind !== 'reapplied') {
      return;
    }
    expect(recoveryBaseRevisionOf(attempt.session)).toBe(AFTER);
    expect(attempt.session.draft.value).toEqual(conflicted.draft.value);
    expect(recoveryConflictOf(attempt.session)).toBeNull();
    expect(adoptions).toHaveLength(1);
    expect(adoptions[0]!.source).not.toBe(conflicted.origin.conflict);
    // **The adoption it spent was not refused**, which is all this transition
    // tests for — the double answers `installed`, and the case below drives
    // `alreadyThere` through the same arm — so this form can no longer vouch for
    // the window the source conflict was registered against: the confirmation
    // pass's first finding, in the second of the two paths that carried it.
    expect(attempt.session.windowWasReconciled).toBe(true);
    expect(sourceConflictState(attempt.session)).toBe('windowMoved');
    // And the next send really goes out against the newly parsed revision.
    const { create, calls } = recordingCreate([
      { kind: 'answered', result: COMMITTED, adoption: ADOPTED }
    ]);
    await sendRecoveryCreate(attempt.session, create, INSTALLS_NOTHING);
    expect(calls[0]![3]).toBe(AFTER);
  }); // End of the "stale base broken" case

  it('withdraws consent when it rebases, because findings do not cross a revision', async () => {
    const refused = await sendRecoveryCreate(
      openedOverEditor(),
      recordingCreate([{ kind: 'answered', result: REFUSED, adoption: NOT_OWED }]).create,
      INSTALLS_NOTHING
    );
    const consented = acknowledgeRecoveryFindings(refused);
    expect(consented.draft.consent).not.toBeNull();
    const conflicted = await sendRecoveryCreate(
      keepRecovering(consented),
      recordingCreate([
        {
          kind: 'answered',
          result: makeConflict({
            disk: diskFile({ revision: AFTER }),
            expected: DISK,
            subject: { Targetless: {} }
          }),
          adoption: NOT_OWED
        }
      ]).create,
      INSTALLS_NOTHING
    );
    const attempt = reapplyRecoveryToDiskVersion(conflicted, adopting().adopt);
    expect(attempt.kind === 'reapplied' ? attempt.session.draft.consent : 'no session').toBeNull();
  });

  it('refuses to rebase onto evidence a creation’s conflict never answers', async () => {
    const attempt = reapplyRecoveryToDiskVersion(
      await conflictedForm(diskFile({ revision: AFTER }), false),
      adopting().adopt
    );
    expect(attempt).toEqual({
      kind: 'manualResolution',
      obstacle: { kind: 'evidenceNotATarget' }
    });
  });

  it('refuses to rebase onto a file that may no longer be written into', async () => {
    const attempt = reapplyRecoveryToDiskVersion(
      await conflictedForm(diskFile({ revision: AFTER, topLevelKeys: ['global_vars'] })),
      adopting().adopt
    );
    // The destination is dropped rather than left holding a revision the command
    // would refuse, and the ordinary rule is what names the refusal.
    expect(attempt).toEqual({
      kind: 'manualResolution',
      obstacle: { kind: 'recoveryRefused', reason: 'destinationUnavailable' }
    });
  });

  it('leaves the form exactly as it was when the window refuses the adoption', async () => {
    const conflicted = await conflictedForm();
    const attempt = reapplyRecoveryToDiskVersion(conflicted, adopting('refused').adopt);
    expect(attempt).toEqual({ kind: 'adoptionRefused' });
    expect(recoveryBaseRevisionOf(conflicted)).toBe(DISK);
    expect(recoveryConflictOf(conflicted)).not.toBeNull();
    // Decide-then-adopt: a refusal adopted nothing, so nothing about the window
    // changed and nothing is recorded about it.
    expect(sourceConflictState(conflicted)).toBe('retained');
  });

  it('records the spend for a rebase whose adoption found the window already there', async () => {
    const attempt = reapplyRecoveryToDiskVersion(await conflictedForm(), adopting('alreadyThere').adopt);
    expect(attempt.kind).toBe('reapplied');
    if (attempt.kind !== 'reapplied') {
      return;
    }
    expect(sourceConflictState(attempt.session)).toBe('windowMoved');
  });

  it('answers `notAttempted` when there is no conflict of its own to rebase', () => {
    const attempt = reapplyRecoveryToDiskVersion(openedOverEditor(), adopting().adopt);
    expect(attempt).toEqual({ kind: 'notAttempted' });
  });

  it('takes the disk version in two steps, and ends the form rather than reseeding it', async () => {
    const conflicted = await conflictedForm();
    const asked = askToReloadRecoveryDiskVersion(conflicted);
    expect(recoveryView(asked).awaitingReloadConfirmation).toBe(true);
    // **Offered as of 2c-4c-3a**: the same transition, with the boolean flipped, so
    // the second step's label replaces the first's in the produced list — which is
    // `conflictChoicesFor`'s decision and not this module's.
    expect(recoveryView(asked).conflictChoices).toEqual([
      'keepEditing',
      'keepMyDraft',
      'confirmReload'
    ]);
    const confirmed = confirmRecoveryDiskReload(asked);
    const { adopt, adoptions } = adopting();
    const closed = reloadRecoveryDiskVersion(confirmed, adopt);
    expect(adoptions).toHaveLength(1);
    // **The adoption is spent on this form's own conflict and never on the one
    // recovery was opened from**, which is what the module header claims and what
    // a caller could otherwise not tell apart.
    expect(adoptions[0]!.source).toBe(recoveryConflictOf(conflicted)?.source);
    expect(adoptions[0]!.source).not.toBe(conflicted.origin.conflict);
    expect(closed.closed).toBe(true);
    expect(recoveryView(closed).closed).toBe(true);
    expect(recoveryConflictOf(closed)).toBeNull();
    expect(recoveryRefusal(closed)).toBe('formClosed');
    expect(isRecoveryEditable(closed)).toBe(false);
    expect(beginRecoveryCreate(closed)).toBeNull();
    // The conflict recovery was opened from is another conflict on another
    // surface, and this transition neither answers nor spends it — **and that is
    // not the same as leaving the window it was registered against alone**, which
    // is the confirmation pass's first finding. An adoption was spent here, and a
    // satisfied spend does not say whether a projection was installed.
    expect(closed.origin.conflict).toBe(conflicted.origin.conflict);
    expect(closed.windowWasReconciled).toBe(true);
    expect(sourceConflictState(closed)).toBe('windowMoved');
    expect(recoveryView(closed).sourceConflict).toBe('windowMoved');
  }); // End of the "confirmed reload" case

  it('records the spend of a confirmed reload that found the window already there', async () => {
    // `spendTheConfirmedReload` collapses `installed` and `alreadyThere` into
    // `satisfied`, so this transition cannot tell them apart — and `windowMoved`
    // claims uncertainty, so recording it over-claims nothing while staying
    // `retained` would claim the window is exactly where the conflict left it.
    const confirmed = confirmRecoveryDiskReload(
      askToReloadRecoveryDiskVersion(await conflictedForm())
    );
    const closed = reloadRecoveryDiskVersion(confirmed, adopting('alreadyThere').adopt);
    expect(closed.closed).toBe(true);
    expect(sourceConflictState(closed)).toBe('windowMoved');
  });

  it('does not close over a window that refused to move, and records nothing', async () => {
    const confirmed = confirmRecoveryDiskReload(
      askToReloadRecoveryDiskVersion(await conflictedForm())
    );
    const refused = reloadRecoveryDiskVersion(confirmed, adopting('refused').adopt);
    expect(refused.closed).toBe(false);
    expect(recoveryView(refused).reloadUnavailable).toBe(true);
    expect(recoveryConflictOf(refused)).not.toBeNull();
    // Nothing was adopted, so nothing about the window changed and the source
    // conflict is still exactly where it was.
    expect(sourceConflictState(refused)).toBe('retained');
  });

  it('classifies every value this module exports, so a new one cannot go unexamined', () => {
    // **Round 4's finding 2, and the reason it is checked this way.** The previous
    // version of the case below wrote the transitions out by hand and missed one —
    // `recoveryCreateCouldNotBeSent`, which really did mutate a closed form — and a
    // hand-written list is exactly as complete as whoever last read the module, so
    // it is now checked against the module's own exports.
    //
    // **In one sentence, because the force and the limit are one claim**: this
    // forces that every runtime export name is classified and that none is
    // classified twice — the sorted comparison catches a duplicate as readily as a
    // gap — while forcing neither that a new export is classified *correctly*, since
    // a transition dropped into `NOT_A_FORM_TRANSITION` would satisfy it and be
    // probed by nothing, nor that the probe inputs below are adversarial enough to
    // catch a guard that is missing, since a probe only ever sees the forms this
    // file hands it.
    expect([...Object.keys(CLOSED_FORM_PROBES), ...NOT_A_FORM_TRANSITION].sort()).toEqual(
      Object.keys(recovery).sort()
    );
  }); // End of the "the export partition is exhaustive" case

  it('answers itself for every transition once it is closed, four hostile fixtures included', async () => {
    // **The confirmation pass's second finding, and then round 4's.** The first
    // named `focusRecoveryField`; the property is that a form the person has left
    // behind produces no new value from **any** door. Round 4's addition is that
    // one fixture cannot show it: every probe used to receive the session the
    // reload transition produces, whose outcome, submission and reload step were
    // cleared *by that transition* — so an explicit guard and identity caused by an
    // empty fixture were indistinguishable.
    //
    // Beside it stand **four** adversarial forms `RecoverySession`'s own type
    // permits, one state each rather than one form carrying them all: a conflict at
    // each of the three reload steps, and a refusal with the submission consent is
    // collected against. Nothing in this module produces any of them today, and
    // nothing in TypeScript forbids one — `closed implies cleared` is not encoded —
    // so a transition that reads any of those before checking `closed` shows up
    // here, an adoption reached from a closed form included. They are probed one at
    // a time, each with an adoption recorder of its own.
    const confirmed = confirmRecoveryDiskReload(
      askToReloadRecoveryDiskVersion(await conflictedForm())
    );
    const closing = adopting();
    const closed = reloadRecoveryDiskVersion(confirmed, closing.adopt);
    expect(closed.closed).toBe(true);
    expect(closing.adoptions).toHaveLength(1);

    const conflicted = await conflictedForm();
    const asked = askToReloadRecoveryDiskVersion(conflicted);
    const refused = await sendRecoveryCreate(
      openedOverEditor(),
      recordingCreate([{ kind: 'answered', result: REFUSED, adoption: NOT_OWED }]).create,
      INSTALLS_NOTHING
    );
    // **One hostile form per state a guard could read**, because a guard is only
    // shown to be a guard by a form that would otherwise get past it: a conflict at
    // each of the three reload steps, and a refusal with the submission consent is
    // collected against.
    const hostile: readonly RecoverySession[] = [
      { ...conflicted, closed: true },
      { ...asked, closed: true },
      { ...confirmed, closed: true },
      { ...refused, closed: true }
    ];
    // The premise, asserted rather than assumed: each of these is closed and has
    // kept what closure clears.
    expect(hostile.map((form) => form.closed)).toEqual([true, true, true, true]);
    expect(hostile.map((form) => form.reload.kind)).toEqual([
      'idle',
      'confirming',
      'confirmed',
      'idle'
    ]);
    expect(hostile.slice(0, 3).map((form) => recoveryConflictOf(form) === null)).toEqual([
      false,
      false,
      false
    ]);
    expect(refused.submitted).not.toBeNull();

    for (const form of [closed, ...hostile]) {
      // A recorder per fixture, so *no probe reached the window* is asserted rather
      // than inferred from a total.
      const probing = adopting();
      for (const [name, probe] of Object.entries(CLOSED_FORM_PROBES)) {
        const answer = await probe.answers(form, probing.adopt);
        // Named in the assertion so a failure says which door let a closed form
        // through rather than only that one did.
        expect({ [name]: answer }).toEqual({
          [name]: probe.answersItself ? form : probe.otherwise
        });
      } // End of the loop over every export that takes a form and answers one
      expect(probing.adoptions).toEqual([]);
    } // End of the loop over the produced fixture and the four hostile ones
  }); // End of the "a closed form is terminal" case

  it('asks the window nothing without a conflict and without a confirmation', async () => {
    const conflicted = await conflictedForm();
    const { adopt, adoptions } = adopting();
    expect(reloadRecoveryDiskVersion(conflicted, adopt)).toBe(conflicted);
    expect(askToReloadRecoveryDiskVersion(openedOverEditor()).reload).toEqual({ kind: 'idle' });
    expect(confirmRecoveryDiskReload(conflicted)).toBe(conflicted);
    expect(adoptions).toEqual([]);
  });
}); // End of the "two ways out" suite

describe('what the form refuses to send', () => {
  it('names each reason, and sends nothing while one stands', async () => {
    const blank = editRecoveryField(openedOverCreator({ trigger: '', replace: 'A body' }), 'trigger', '');
    expect(recoveryRefusal(blank)).toBe('triggerEmpty');
    const noBody = openedOverCreator({ trigger: ':new', replace: '' });
    expect(recoveryRefusal(noBody)).toBe('replaceEmpty');
    const { create, calls } = recordingCreate([]);
    expect(await sendRecoveryCreate(noBody, create, INSTALLS_NOTHING)).toBe(noBody);
    expect(calls).toEqual([]);
    expect(canCreateRecovery(noBody)).toBe(false);
    expect(beginRecoveryCreate(noBody)).toBeNull();
  });

  it('opens a field the transfer could not carry blank, and requires a value', () => {
    // The consult's Q1: a trigger that is not one literal cannot be transferred,
    // so the box is empty, the reason is on the table beside it, and nothing here
    // invents content.
    const session = openedOverEditor(snippet({ triggerKind: 'Multiple', triggers: [':a', ':b'] }));
    expect(session.draft.value.trigger).toBe('');
    expect(recoveryRefusal(session)).toBe('triggerEmpty');
    expect(session.transfer.trigger).toEqual({
      kind: 'notCarried',
      reason: { kind: 'fieldNotEditable', reason: 'triggerNotSingle' }
    });
    const typed = editRecoveryField(session, 'trigger', ':chosen');
    expect(recoveryRefusal(typed)).toBeNull();
    expect(beginRecoveryCreate(typed)?.newMatch.trigger).toBe(':chosen');
  }); // End of the "blank rather than invented" case

  it('refuses a carriage return at the control and again at the wire', () => {
    const session = openedOverEditor();
    expect(editRecoveryField(session, 'replace', 'a\rb')).toBe(session);
    // The gate that matters is the second one: `CreationBuffers` has no brand, so
    // a caller that is not a control can put one in the draft.
    const forced: RecoverySession = {
      ...session,
      draft: { ...session.draft, value: { trigger: ':sig', replace: 'a\rb' } }
    };
    expect(recoveryRefusal(forced)).toBe('carriageReturn');
    expect(beginRecoveryCreate(forced)).toBeNull();
  });

  it('refuses while a create is in flight', () => {
    const started = beginRecoveryCreate(openedOverEditor());
    expect(recoveryRefusal(started!.session)).toBe('saveInFlight');
    expect(beginRecoveryCreate(started!.session)).toBeNull();
  });

  it('refuses a destination that is not one of its own', () => {
    const session = openedOverEditor();
    const elsewhere: RecoverySession = { ...session, chosen: 99 };
    expect(recoveryRefusal(elsewhere)).toBe('destinationUnavailable');
  });
}); // End of the "refusals" suite

describe('editing the two values a recovery may still change', () => {
  it('records a change, keeps a history and gives it back', () => {
    const session = openedOverEditor();
    const typed = editRecoveryField(session, 'trigger', ':typed');
    expect(recoveryView(typed).trigger).toBe(':typed');
    expect(recoveryView(typed).dirty).toBe(true);
    expect(recoveryView(typed).canUndo).toBe(true);
    const undone = undoRecoveryEdit(typed);
    expect(recoveryView(undone).trigger).toBe(':sig');
    expect(recoveryView(redoRecoveryEdit(undone)).trigger).toBe(':typed');
  });

  it('closes the typing run when the focus moves, and ignores a repeated focus', () => {
    const typed = editRecoveryField(openedOverEditor(), 'trigger', ':typed');
    expect(typed.group).not.toBeNull();
    const blurred = focusRecoveryField(typed, null);
    expect(blurred.group).toBeNull();
    expect(focusRecoveryField(blurred, null)).toBe(blurred);
  });
}); // End of the "editing" suite

describe('what a screen would draw', () => {
  it('lays the six fields out in the editor’s order, with two of them editable', () => {
    const view = recoveryView(openedOverEditor(snippet({ label: 'A name' })));
    expect(view.fields.map((one) => one.field)).toEqual([
      'trigger',
      'replace',
      'label',
      'word',
      'left_word',
      'right_word'
    ]);
    expect(view.fields.map((one) => one.editable)).toEqual([true, true, false, false, false, false]);
    expect(view.fields[2]!.label).toBe('label');
    expect(view.fields[4]!.label).toBe('leftWord');
    expect(view.fields[2]!.transfer).toEqual({ kind: 'carried', text: 'A name' });
    expect(view.fields[3]!.transfer).toEqual({
      kind: 'notCarried',
      reason: { kind: 'notInTheFile' }
    });
  });

  it('draws the source conflict as retained before any send, and as spent once a create commits', async () => {
    // Two of the three answers, and deliberately not the middle one: `windowMoved`
    // is drawn from this same view where it is produced — by the uncertain send and
    // by the confirmed reload, both above.
    const session = openedOverEditor();
    expect(recoveryView(session).sourceConflict).toBe('retained');
    const committed = await sendRecoveryCreate(
      session,
      recordingCreate([{ kind: 'answered', result: COMMITTED, adoption: ADOPTED }]).create,
      INSTALLS_NOTHING
    );
    expect(recoveryView(committed).sourceConflict).toBe('spent');
    expect(recoveryView(committed).created).toEqual(CREATED);
    expect(recoveryView(committed).committed).toBe(true);
  });

  it('offers the two ways out for a conflict of its own, and draws the disk text', async () => {
    const conflicted = await sendRecoveryCreate(
      openedOverEditor(),
      recordingCreate([
        {
          kind: 'answered',
          result: makeConflict({ disk: diskFile({ revision: AFTER }), expected: DISK }),
          adoption: NOT_OWED
        }
      ]).create,
      INSTALLS_NOTHING
    );
    const view = recoveryView(conflicted);
    // Both transitions this module owns are offered as of 2c-4c-3a. The copy is
    // not, and that is a property of the view rather than an opinion: it copies the
    // **retained draft list**, which `recoveryView` does not produce — the two
    // values are in this form's own boxes.
    expect(view.conflictChoices).toEqual(['keepEditing', 'keepMyDraft', 'reloadDiskVersion']);
    expect(view.diskText).toEqual({ kind: 'text', text: '# the file as it is now\n' });
    expect(RECOVERY_CONFLICT_CAPABILITIES.offersReload).toBe(true);
    expect(RECOVERY_CONFLICT_CAPABILITIES.offersReapply).toBe(true);
    expect(RECOVERY_CONFLICT_CAPABILITIES.offersCopyDraft).toBe(false);
  });

  it('draws nothing about a conflict when there is none of its own', () => {
    const view = recoveryView(openedOverEditor());
    expect(view.conflict).toBeNull();
    expect(view.conflictChoices).toEqual([]);
    expect(view.diskText).toBeNull();
    expect(view.messages).toEqual([]);
    expect(view.refusalChoices).toEqual([]);
  });
}); // End of the "view" suite

describe('what recovery never does', () => {
  it('gives an operation choice and a whole-document draft no create offer', async () => {
    // **Narrowed after the review's fourth finding.** This proves what it drives —
    // no offer — and no more: the previous version created a `create` mock, handed
    // it to nothing, and asserted the untouched mock was not called, which is an
    // assertion that could not fail. What proves *no command* is the two checks
    // below and `sendRecoveryCreate`'s own refusal case.
    const kinds: readonly RecoveryDraftKind[] = ['operationChoice', 'wholeDocumentText'];
    for (const kind of kinds) {
      const offer = recoveryAvailability(
        kind,
        resolvedNothing({ kind: 'evidenceNotATarget' }),
        conflictOver<string>('# a whole file\n'),
        DOCUMENTS,
        [heldFile(), otherFile()]
      );
      expect(offer.kind).toBe('unavailable');
    } // End of the loop over the two kinds that have no save-as-new
  });

  it('never calls the send it was handed for a form that may not be submitted', async () => {
    // The mock **is** reachable by the code under test — `sendRecoveryCreate` calls
    // it on every submittable form — so a gate removed anywhere in
    // `beginRecoveryCreate` makes this fail rather than pass vacuously.
    const create = vi.fn<CreateARecoveredSnippet>(async () => ({ kind: 'notAttempted' }));
    const blank = openedOverCreator({ trigger: ':new', replace: '' });
    expect(await sendRecoveryCreate(blank, create, INSTALLS_NOTHING)).toBe(blank);
    expect(create).not.toHaveBeenCalled();
    // And it is called exactly once for a form that may be.
    await sendRecoveryCreate(openedOverCreator(), create, INSTALLS_NOTHING);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('reaches the IPC command layer from nowhere in its own source', () => {
    // **A dependency check rather than a mock**, which is the review's fourth
    // finding taken at its word: no test can observe a call that no exercised path
    // makes, so what is checked instead is that the module cannot make one. The
    // rule is the module's own claim — every write goes through the callback a
    // caller supplies — and the scanner is driven over a source that breaks it, so
    // it is a check that can fail (`scripts/lint/*.test.ts`'s own shape).
    const source = readFileSync(
      new URL('./recovery.ts', import.meta.url),
      'utf8'
    );
    expect(reachesTheCommandLayer(source)).toBe(false);
    expect(reachesTheCommandLayer("import { createMatch } from '../ipc/commands';\n")).toBe(true);
    expect(reachesTheCommandLayer("const x = await invoke('create_match', {});\n")).toBe(true);
    expect(reachesTheCommandLayer("import type { CommandResult } from '../ipc/commands';\n")).toBe(
      false
    );
  }); // End of the "no route to a command" case

  it('adopts nothing, spends nothing and closes nothing when it opens', () => {
    // Structural rather than asserted: no function in the module takes an
    // adoption, a confirmation or a host session, so there is nothing an opened
    // form could have spent. What this checks is that the conflict is carried
    // whole and unchanged, which is what a caller compares against.
    const buffers = drafted(snippet()).buffers;
    const conflict = conflictOver<MatchBuffers>(buffers);
    const start = startMatchFieldRecovery(
      resolvedNothing<EditorReapplyObstacle>({ kind: 'evidenceNotATarget' }),
      conflict,
      drafted(snippet()).baseline,
      DOCUMENTS,
      [heldFile(), otherFile()],
      CLOCK
    );
    expect(start.kind).toBe('ready');
    if (start.kind !== 'ready') {
      return;
    }
    expect(start.session.origin.conflict).toBe(conflict.source);
    expect(start.session.origin.document).toBe(2);
    expect(conflict.draft.value).toEqual(buffers);
    expect(sourceConflictState(start.session)).toBe('retained');
  });

  it('answers the disk revision as the base, never the one the window holds', () => {
    expect(recoveryBaseRevisionOf(openedOverEditor())).toBe(DISK);
    expect(recoveryBaseRevisionOf(openedOverCreator())).toBe(DISK);
  });
}); // End of the "what recovery never does" suite
