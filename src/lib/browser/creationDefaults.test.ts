/**
 * New-snippet defaults seeded into a creation draft, driven without a screen —
 * Phase 3-13-1 (ruling 28).
 *
 * One group per acceptance clause of step 3-13 that belongs to the model and
 * the coordination (`docs/decisions/3-split-notes.md` §2, 3-13), plus the
 * ruling-23 paths the widened draft owes — conflict compare and copy, reapply
 * and recovery — and the seeding rule itself (once, never over a value):
 *
 * 1. every emitted default was in the draft before *Create*, and removing one
 *    suppresses its key;
 * 2. empty differs from absent;
 * 3. a later preference change does not touch an open draft;
 * 4. recovery values are never overridden;
 * 5. an absent or corrupt sidecar leaves creation working (the model half; the
 *    coordination half is in `./workspace.test.ts`).
 *
 * "In the draft before *Create*" is a claim about the model's view: what
 * `matchCreationView` hands a screen. No screen is claimed here.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { describe, expect, it } from 'vitest';
import type { IpcFailure } from '../ipc/errors';
import type {
  BulkOption,
  ContentRevision,
  DocumentId,
  DocumentSummary,
  DocumentView,
  DraftError,
  NewMatch,
  SidecarState
} from '../ipc/types';
import type { ExternalConflictObservation } from './conflictSource';
import { isDirty } from './draft';
import { makeConflict, makeDocument, makeMatch, makeSummary } from './fixtures';
import type { InvalidationStatus } from './invalidation';
import {
  applyCreate,
  applyObservation,
  beginCreate,
  canCreate,
  chooseDestination,
  choosePlacement,
  conflictOf,
  createCouldNotBeSent,
  editCreationField,
  editCreationOption,
  matchCreationView,
  NO_CREATION_OPTIONS,
  reapplyToDiskVersion,
  removeCreationOption,
  seedDefaults,
  startMatchCreation,
  undoCreation,
  type CreationOptions,
  type MatchCreationSession
} from './matchCreation';
import {
  creationDefaultsOf,
  NO_CREATION_DEFAULTS,
  NO_FILE_DEFAULTS,
  preferencesOf,
  preferencesReadFailed,
  type CreationDefaults,
  type FileDefaults
} from './preferences';
import { arbitratedDelivery } from './observationDelivery';
import { newMatchOfRecovery, startCreationFieldRecovery } from './recovery';
import { copyOfDraft, referenceCopyOf } from './saveOutcome';

/** The revision the two snippet files are projected at. */
const BASE: ContentRevision = 'a'.repeat(64);

/** The revision the file holds after it changed on disk. */
const AFTER: ContentRevision = 'b'.repeat(64);

/** The adoption a save that wrote nothing owes: none. */
const NOT_OWED: InvalidationStatus = { kind: 'notOwed' };

/** The clock every form below reads. */
const CLOCK = (): number => 0;

/**
 * A snippet file.
 *
 * @param id - Its identity.
 * @param path - Its relative path.
 * @param revision - The revision it is projected at.
 * @returns The projection.
 */
function snippetFile(id: DocumentId, path: string, revision: ContentRevision = BASE): DocumentView {
  return makeDocument({
    id,
    relativePath: path,
    revision,
    matches: [makeMatch({ node: 10, document: id, revision, trigger: ':sig' })]
  });
} // End of function snippetFile()

/** Every file the forms below offer: two snippet files and a read-only package. */
function views(): readonly DocumentView[] {
  return [
    snippetFile(2, 'match/base.yml'),
    snippetFile(3, 'match/other.yml'),
    makeDocument({ id: 6, relativePath: 'match/packages/x/package.yml', kind: 'Package', readOnly: true })
  ];
} // End of function views()

/**
 * The summaries the window would list the files under.
 *
 * @returns One summary per projection.
 */
function summaries(): readonly DocumentSummary[] {
  return views().map((view) =>
    makeSummary({ id: view.id, relativePath: view.relative_path, kind: view.kind, readOnly: view.read_only })
  );
} // End of function summaries()

/**
 * One file's defaults, with the named options set.
 *
 * @param set - The options that have a default, and their text.
 * @returns The seven, every other one absent.
 */
function defaultsWith(set: Partial<Record<BulkOption, string>>): FileDefaults {
  return { ...NO_FILE_DEFAULTS, ...set };
} // End of function defaultsWith()

/**
 * The options a draft holds, with the named ones set.
 *
 * @param set - The options present, and their text.
 * @returns The seven, every other one absent.
 */
function optionsWith(set: Partial<Record<BulkOption, string>>): CreationOptions {
  return { ...NO_CREATION_OPTIONS, ...set };
} // End of function optionsWith()

/** Defaults for file 2 (an empty `word` among them) and different ones for file 3. */
const DEFAULTS: CreationDefaults = new Map([
  [2, defaultsWith({ word: '', propagate_case: 'true', force_mode: 'clipboard' })],
  [3, defaultsWith({ uppercase_style: 'capitalize' })]
]);

/**
 * A form opened with no destination, holding the given defaults snapshot.
 *
 * @param defaults - The snapshot.
 * @returns The form.
 */
function blankForm(defaults: CreationDefaults = DEFAULTS): MatchCreationSession {
  return startMatchCreation(summaries(), views(), null, CLOCK, defaults);
} // End of function blankForm()

/**
 * A form whose held selection is in file 2, so it opens with file 2 chosen.
 *
 * @param defaults - The snapshot.
 * @returns The form.
 */
function formOverBase(defaults: CreationDefaults = DEFAULTS): MatchCreationSession {
  const held = views()[0]!.matches[0]!.id;
  return startMatchCreation(summaries(), views(), held, CLOCK, defaults);
} // End of function formOverBase()

/**
 * A form with the two required fields filled in.
 *
 * @param session - The form.
 * @returns The form, submittable.
 */
function filled(session: MatchCreationSession): MatchCreationSession {
  return editCreationField(editCreationField(session, 'trigger', ':new'), 'replace', 'a body');
} // End of function filled()

/**
 * What a create of this form would send.
 *
 * @param session - A submittable form.
 * @returns The `NewMatch` of the submission.
 */
function sent(session: MatchCreationSession): NewMatch {
  const started = beginCreate(session, () => session);
  if (started === null) {
    throw new Error('this case needs a form that can be submitted');
  }
  return started.newMatch;
} // End of function sent()

/**
 * The option keys a `NewMatch` carries.
 *
 * @param newMatch - The value sent.
 * @returns Every one of the seven present on it, in option order.
 */
function emittedOptions(newMatch: NewMatch): readonly BulkOption[] {
  return (Object.keys(NO_CREATION_OPTIONS) as BulkOption[]).filter((option) => option in newMatch);
} // End of function emittedOptions()

/**
 * A form showing a save conflict over file 2.
 *
 * @param session - A submittable form over file 2.
 * @returns The form showing the conflict.
 */
function conflicted(session: MatchCreationSession): MatchCreationSession {
  const started = beginCreate(session, () => session);
  if (started === null) {
    throw new Error('this case needs a form that can be submitted');
  }
  const disk = snippetFile(2, 'match/base.yml', AFTER);
  return applyCreate(
    started.session,
    makeConflict({ disk, subject: { Targetless: {} }, expected: BASE, found: AFTER }),
    NOT_OWED,
    () => started.session
  );
} // End of function conflicted()

describe('1. every emitted default was in the draft before Create, and removing one suppresses its key', () => {
  it('seeds the chosen file’s defaults into the draft the view hands a screen, and sends exactly those', () => {
    const session = filled(formOverBase());
    const shown = matchCreationView(session).options;
    const inDraft = shown.filter((one) => one.value !== null).map((one) => one.option);
    expect(inDraft).toEqual(['word', 'propagate_case', 'force_mode']);
    expect(shown.filter((one) => one.seeded).map((one) => one.option)).toEqual(inDraft);
    const newMatch = sent(session);
    // Every key the create sends was in the view before it, with the same text.
    expect(emittedOptions(newMatch)).toEqual(inDraft);
    for (const option of emittedOptions(newMatch)) {
      expect(newMatch[option]).toBe(shown.find((one) => one.option === option)!.value);
    } // End of the loop over the emitted options
  });

  it('suppresses the key of a removed default, and only that key', () => {
    const removed = removeCreationOption(filled(formOverBase()), 'propagate_case');
    const newMatch = sent(removed);
    expect('propagate_case' in newMatch).toBe(false);
    expect(emittedOptions(newMatch)).toEqual(['word', 'force_mode']);
    expect(matchCreationView(removed).options.find((one) => one.option === 'propagate_case')!.value).toBeNull();
  });

  it('removes an empty default by removal, not by emptying: the key goes', () => {
    const removed = removeCreationOption(filled(formOverBase()), 'word');
    expect('word' in sent(removed)).toBe(false);
  });

  it('sends a seeded value the person then edited as edited, and nothing unseen', () => {
    const edited = editCreationOption(filled(formOverBase()), 'force_mode', 'keys');
    const newMatch = sent(edited);
    expect(newMatch.force_mode).toBe('keys');
    expect(emittedOptions(newMatch)).toEqual(
      matchCreationView(edited).options.filter((one) => one.value !== null).map((one) => one.option)
    );
  });

  it('never sends paragraph or anchor, which are not creation defaults', () => {
    const newMatch = sent(filled(formOverBase()));
    expect('paragraph' in newMatch).toBe(false);
    expect('anchor' in newMatch).toBe(false);
  });
});

describe('2. empty differs from absent', () => {
  it('seeds an empty default as an empty value and sends the key with it; an absent one sends no key', () => {
    const session = filled(formOverBase());
    const newMatch = sent(session);
    expect(newMatch.word).toBe('');
    expect('left_word' in newMatch).toBe(false);
    expect(matchCreationView(session).options.find((one) => one.option === 'left_word')!.value).toBeNull();
  });

  it('shows an empty default refused by name at Create, keeps it visible, and lets it be removed (4-1)', () => {
    // Phase 4-1 (`docs/decisions/4-split-notes.md` §4.3): an empty `word` default
    // is still seeded and still sent exactly as stored — never dropped or quoted
    // here — and `create_match` refuses it by name before any transaction.
    const session = filled(formOverBase());
    const started = beginCreate(session, () => session);
    expect(started).not.toBeNull();
    expect(started!.newMatch.word).toBe('');
    const refusal: DraftError = { OptionNotPlainSource: { field: 'word' } };
    const refused: IpcFailure = { kind: 'command', error: { code: 'draftRefused', error: refusal } };
    const answered = createCouldNotBeSent(started!.session, false, refused, () => started!.session);
    const view = matchCreationView(answered);
    expect(view.failureLines).toEqual([
      { kind: 'failure', failure: refused },
      { kind: 'draft', error: refusal }
    ]);
    expect(view.options.find((one) => one.option === 'word')!.value).toBe('');
    const removed = removeCreationOption(answered, 'word');
    expect('word' in sent(removed)).toBe(false);
  });

  it('keeps an option set to empty by the person apart from one removed', () => {
    const base = filled(formOverBase(NO_CREATION_DEFAULTS));
    const empty = editCreationOption(base, 'right_word', '');
    expect(sent(empty).right_word).toBe('');
    const gone = removeCreationOption(empty, 'right_word');
    expect('right_word' in sent(gone)).toBe(false);
  });

  it('reads a sidecar entry’s empty default as empty and a missing one as absent', () => {
    const state: SidecarState = {
      status: { Loaded: {} },
      writable: true,
      files: [
        {
          document: 2,
          display_name: null,
          sort_order: null,
          defaults: [{ option: 'word', value: '' }]
        }
      ],
      retained_orphans: 0
    };
    const defaults = creationDefaultsOf(preferencesOf(state)).get(2)!;
    expect(defaults.word).toBe('');
    expect(defaults.left_word).toBeNull();
  });

  it('keeps every default as text: a default spelled like a boolean stays that exact string', () => {
    const newMatch = sent(filled(formOverBase()));
    expect(newMatch.propagate_case).toBe('true');
    expect(typeof newMatch.propagate_case).toBe('string');
  });
});

describe('3. a later preference change does not touch an open draft', () => {
  it('keeps the snapshot it was opened with when the caller’s map changes afterwards', () => {
    const live = new Map(DEFAULTS);
    const seeded = formOverBase(live);
    const unseeded = blankForm(live);
    live.set(2, defaultsWith({ left_word: 'changed' }));
    live.set(3, defaultsWith({ right_word: 'changed' }));
    // The seeded draft is untouched…
    expect(seeded.draft.value.options).toEqual(
      optionsWith({ word: '', propagate_case: 'true', force_mode: 'clipboard' })
    );
    // …and a destination chosen later seeds from the snapshot, never the live map.
    expect(chooseDestination(unseeded, 3).draft.value.options).toEqual(
      optionsWith({ uppercase_style: 'capitalize' })
    );
    // Only a form opened after the change sees it.
    expect(formOverBase(live).draft.value.options).toEqual(optionsWith({ left_word: 'changed' }));
  });

  it('keeps its own copy of every record when the caller changes one of its records afterwards', () => {
    // A type-correct mutable record: `Readonly` does not freeze at runtime.
    const record: Record<BulkOption, string | null> = { ...NO_FILE_DEFAULTS, force_mode: 'keys' };
    const unseeded = blankForm(new Map([[3, record]]));
    record.force_mode = 'clipboard';
    record.left_word = 'changed';
    const chosen = chooseDestination(unseeded, 3);
    expect(chosen.draft.value.options).toEqual(optionsWith({ force_mode: 'keys' }));
    expect(Object.isFrozen(unseeded.defaults.get(3))).toBe(true);
  });

  it('seeds once: changing the destination afterwards neither re-seeds nor takes a seeded value back', () => {
    const seeded = formOverBase();
    const moved = chooseDestination(seeded, 3);
    expect(moved.draft.value.options).toEqual(seeded.draft.value.options);
    const back = chooseDestination(moved, 2);
    expect(back.draft.value.options).toEqual(seeded.draft.value.options);
    expect(seedDefaults(back)).toBe(back);
    expect(back.seeding).toEqual({
      kind: 'seeded',
      from: 2,
      seeded: ['word', 'propagate_case', 'force_mode'],
      kept: [],
      withheld: []
    });
  });
});

describe('the destination-less form resolving an external conflict', () => {
  /**
   * An observation that file 2 changed on disk, as a window would narrow it.
   *
   * @returns The observation.
   */
  function fileTwoChanged(): ExternalConflictObservation {
    return {
      sequence: 5,
      document: 2,
      previousRevision: BASE,
      diskRevision: AFTER,
      diskText: 'matches:\n  - trigger: x\n    replace: theirs\n',
      disk: snippetFile(2, 'match/base.yml', AFTER),
      findings: [],
      correspondences: null
    };
  } // End of function fileTwoChanged()

  it('seeds the named file’s defaults when choosing another file drops the conflict', () => {
    const delivery = arbitratedDelivery(null, fileTwoChanged(), false);
    expect(delivery.verdict.kind).toBe('raised');
    const told = applyObservation(filled(blankForm()), delivery);
    expect(told.externalConflict).not.toBeNull();
    expect(told.chosen).toBeNull();
    const resolved = chooseDestination(told, 3);
    expect(resolved.externalConflict).toBeNull();
    expect(resolved.draft.value.options).toEqual(optionsWith({ uppercase_style: 'capitalize' }));
    expect(resolved.seeding).toEqual({
      kind: 'seeded',
      from: 3,
      seeded: ['uppercase_style'],
      kept: [],
      withheld: []
    });
    // Naming the affected file keeps the conflict, and seeds nothing.
    const affected = chooseDestination(told, 2);
    expect(affected.externalConflict).not.toBeNull();
    expect(affected.draft.value.options).toEqual(NO_CREATION_OPTIONS);
    expect(affected.seeding.kind).toBe('pending');
  });

  it('never seeds over an option the draft already holds when the resolution seeds', () => {
    const typed = editCreationOption(filled(blankForm()), 'uppercase_style', 'mine');
    const told = applyObservation(typed, arbitratedDelivery(null, fileTwoChanged(), false));
    const resolved = chooseDestination(told, 3);
    expect(resolved.draft.value.options).toEqual(optionsWith({ uppercase_style: 'mine' }));
    expect(resolved.seeding).toMatchObject({ kind: 'seeded', from: 3, seeded: [], kept: ['uppercase_style'] });
  });
}); // End of the "destination-less form resolving an external conflict" suite

describe('4. recovery values are never overridden', () => {
  it('never seeds over an option the draft already holds, and lists it as kept', () => {
    let session = blankForm();
    session = editCreationOption(session, 'force_mode', 'keys');
    session = editCreationOption(session, 'word', 'no');
    session = chooseDestination(session, 2);
    expect(session.draft.value.options).toEqual(
      optionsWith({ word: 'no', propagate_case: 'true', force_mode: 'keys' })
    );
    expect(session.seeding).toEqual({
      kind: 'seeded',
      from: 2,
      seeded: ['propagate_case'],
      kept: ['word', 'force_mode'],
      withheld: []
    });
  });

  it('recovers a creator’s conflicted draft with exactly its own options, whatever the destination’s defaults', () => {
    let session = removeCreationOption(filled(formOverBase()), 'force_mode');
    session = editCreationOption(session, 'word', 'yes');
    const stuck = conflicted(session);
    const conflict = conflictOf(stuck);
    expect(conflict).not.toBeNull();
    const start = startCreationFieldRecovery(
      { kind: 'manualResolution', obstacle: { kind: 'notTheDestination' } },
      conflict,
      summaries(),
      views(),
      CLOCK
    );
    if (start.kind !== 'ready') {
      throw new Error(`this case needs an opened recovery, not ${start.reason}`);
    }
    const recovered = newMatchOfRecovery(start.session.transfer, start.session.draft.value, start.session.structure);
    expect(recovered.word).toBe('yes');
    expect(recovered.propagate_case).toBe('true');
    expect('force_mode' in recovered).toBe(false);
    expect('uppercase_style' in recovered).toBe(false);
    // The recovery form drafts no option of its own, so nothing can seed into it.
    expect(start.session.draft.value.options).toEqual(NO_CREATION_OPTIONS);
  });

  it('keeps the retained options through a reapply to the disk version, unseeded again', () => {
    // At the end, so the reapply needs no anchor evidence (targetless, like every create).
    const session = choosePlacement(editCreationOption(filled(formOverBase()), 'left_word', 'yes'), {
      kind: 'end'
    });
    const stuck = conflicted(session);
    const answer = reapplyToDiskVersion(stuck, () => 'installed', null, () => stuck);
    if (answer.kind !== 'reapplied') {
      throw new Error('this case is about the rebuilt form');
    }
    expect(answer.session.draft.value.options).toEqual(session.draft.value.options);
    expect(answer.session.seeding).toEqual(session.seeding);
    expect(emittedOptions(sent(answer.session))).toEqual([
      'word',
      'left_word',
      'propagate_case',
      'force_mode'
    ]);
  });
});

describe('5. an absent or corrupt sidecar leaves creation working', () => {
  const unusable: readonly SidecarState['status'][] = [
    { Fresh: {} },
    { Quarantined: { aside: 'x.corrupt.json' } },
    { QuarantineFailed: {} },
    { FutureSchema: { version: '9' } },
    { Unreadable: {} },
    { RootUnresolved: {} },
    { StorageUnavailable: {} }
  ];

  it.each(unusable)('opens, seeds nothing and creates over %j', (status) => {
    const preferences = preferencesOf({ status, writable: false, files: [], retained_orphans: 0 });
    const session = filled(formOverBase(creationDefaultsOf(preferences)));
    expect(session.seeding).toEqual({ kind: 'pending' });
    expect(canCreate(session)).toBe(true);
    expect(emittedOptions(sent(session))).toEqual([]);
  });

  it('opens, seeds nothing and creates when the read itself failed', () => {
    const preferences = preferencesReadFailed({
      kind: 'command',
      error: { code: 'noWorkspaceOpen' }
    });
    const session = filled(formOverBase(creationDefaultsOf(preferences)));
    expect(canCreate(session)).toBe(true);
    expect(emittedOptions(sent(session))).toEqual([]);
  });

  it('opens with no snapshot at all, the caller that passes none', () => {
    const held = views()[0]!.matches[0]!.id;
    const session = filled(startMatchCreation(summaries(), views(), held, CLOCK));
    expect(canCreate(session)).toBe(true);
    expect(emittedOptions(sent(session))).toEqual([]);
  });
});

describe('the seeding rule', () => {
  it('seeds into the starting value of a pristine form, so it is not dirty and has nothing to undo', () => {
    const session = formOverBase();
    expect(isDirty(session.draft)).toBe(false);
    expect(matchCreationView(session).canUndo).toBe(false);
    // Removing a seeded default is an edit like any other.
    expect(isDirty(removeCreationOption(session, 'word').draft)).toBe(true);
  });

  it('seeds as one undoable step into a form the person already typed into', () => {
    let session = editCreationField(blankForm(), 'trigger', ':typed');
    session = chooseDestination(session, 2);
    expect(session.draft.value.options.force_mode).toBe('clipboard');
    const undone = undoCreation(session);
    expect(undone.draft.value.options).toEqual(NO_CREATION_OPTIONS);
    expect(undone.draft.value.trigger).toBe(':typed');
  });

  it('does not seed from an ineligible destination, and seeds from the first eligible one', () => {
    const packaged = new Map([[6, defaultsWith({ word: 'pkg' })], ...DEFAULTS]);
    const onPackage = chooseDestination(blankForm(packaged), 6);
    expect(onPackage.seeding).toEqual({ kind: 'pending' });
    expect(onPackage.draft.value.options).toEqual(NO_CREATION_OPTIONS);
    const onBase = chooseDestination(onPackage, 2);
    expect(onBase.seeding.kind).toBe('seeded');
  });

  it('waits for a destination with defaults: a file with none leaves the seeding pending', () => {
    const noDefaults = new Map([[3, defaultsWith({ word: 'three' })]]);
    const first = chooseDestination(blankForm(noDefaults), 2);
    expect(first.seeding).toEqual({ kind: 'pending' });
    const second = chooseDestination(first, 3);
    expect(second.draft.value.options.word).toBe('three');
  });

  it('withholds a default holding a carriage return, and says so', () => {
    const session = formOverBase(new Map([[2, defaultsWith({ word: 'a\rb', left_word: 'no' })]]));
    expect(session.draft.value.options).toEqual(optionsWith({ left_word: 'no' }));
    expect(session.seeding).toEqual({
      kind: 'seeded',
      from: 2,
      seeded: ['left_word'],
      kept: [],
      withheld: ['word']
    });
  });

  it('refuses a carriage return typed into an option, at the edit and at the send', () => {
    const session = filled(formOverBase(NO_CREATION_DEFAULTS));
    expect(editCreationOption(session, 'word', 'a\rb')).toBe(session);
    const smuggled: MatchCreationSession = {
      ...session,
      draft: { ...session.draft, value: { ...session.draft.value, options: optionsWith({ word: 'a\rb' }) } }
    };
    expect(canCreate(smuggled)).toBe(false);
    expect(beginCreate(smuggled, () => smuggled)).toBeNull();
  });
});

describe('the widened draft through a conflict (ruling 23)', () => {
  it('retains, lists and copies every option the draft held, empty ones included, and no absent one', () => {
    const stuck = conflicted(filled(formOverBase()));
    const conflict = conflictOf(stuck)!;
    expect(copyOfDraft(conflict).options).toEqual(
      optionsWith({ word: '', propagate_case: 'true', force_mode: 'clipboard' })
    );
    const retained = matchCreationView(stuck).retainedDraft;
    expect(retained.map((field) => [field.label, field.text, field.status])).toEqual([
      ['trigger', ':new', 'setting'],
      ['replace', 'a body', 'setting'],
      ['word', '', 'setting'],
      ['propagateCase', 'true', 'setting'],
      ['forceMode', 'clipboard', 'setting']
    ]);
    const copy = referenceCopyOf(retained, {
      heading: 'HEADING',
      label: (name) => name,
      status: (status) => status
    });
    expect(copy).toContain('forceMode (setting)\nclipboard');
    expect(copy).not.toContain('leftWord');
  });
});
