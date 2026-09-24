/**
 * The bulk option edit's browser model — Phase 3-11-1
 * (`docs/decisions/3-split-notes.md` §2 step 3-11 and its 2026-09-24 addendum;
 * rulings 19–22).
 *
 * One `describe` per acceptance clause the addendum gives 3-11-1: only the seven
 * options can be submitted; an untouched Mixed control emits nothing, and Mixed
 * compares exact source spellings; a stale selection blocks; open drafts are
 * respected; exclusions and execution failures are counted separately; draft
 * undo works and no disk batch undo is promised. Consent and the accessors have
 * their own blocks. The accessors are called in both locales, because the Rust
 * dictionary contract sees no `browser.*` key.
 *
 * Every fixture is synthetic and neutral (`CLAUDE.md` section 1). Per
 * `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling argument
 * is already its description carries no JSDoc of its own; ordinary helpers here
 * do.
 */

import { describe, expect, it } from 'vitest';
import {
  describeBulkBlocker,
  describeBulkExclusion,
  describeBulkOptionSummary,
  describeBulkOutcomeHeadline
} from '../i18n/codes';
import { DICTIONARIES, translate } from '../i18n/dictionaries';
import { LOCALES } from '../i18n/locale';
import type { CommandResult } from '../ipc/commands';
import type {
  BulkFileReport,
  BulkOption,
  BulkOptionSpellings,
  BulkResult,
  DocumentView,
  Finding,
  MatchId,
  OptionSpelling
} from '../ipc/types';
import {
  describeBulkCount
} from '../i18n/codes';
import {
  BULK_OPTIONS,
  EMPTY_BULK_DRAFT,
  EMPTY_BULK_SELECTION,
  acknowledgeBulkRefusal,
  bulkBlockerKey,
  bulkChangesOf,
  bulkConsentReview,
  bulkControls,
  bulkExclusionKey,
  bulkFileEffect,
  bulkOutcomeHeadlineKey,
  bulkSelectionFreshness,
  canRedoBulkDraft,
  canUndoBulkDraft,
  clearBulkIntent,
  isBulkOption,
  matchKeyOf,
  optionSummaryKey,
  planBulkApply,
  prepareBulkApply,
  redoBulkDraft,
  setBulkIntent,
  spellingReadOf,
  summarizeBulkResult,
  summarizeOption,
  toggleInBulkSelection,
  undoBulkDraft,
  bulkConsentRecorded,
  bulkConsentReviewStatus,
  bulkCountKey,
  bulkExclusionRows,
  bulkFileLines,
  bulkNarrowingOffered,
  bulkOptionField,
  bulkOutcomeCounts,
  bulkPlanCounts,
  bulkSelectingAvailability,
  bulkSuggestionsFor,
  chooseBulkIntent,
  failedSpellingReads,
  grantsAfterBulkAnswer,
  remainingBulkSelection,
  spellingReadsWanted,
  typeBulkIntentText,
  withoutFailedReads,
  type BulkCountName,
  type BulkApplyInputs,
  type BulkBlocker,
  type BulkConsentGrant,
  type BulkExclusionReason,
  type BulkIntents,
  type BulkOutcomeHeadline,
  type BulkSelection,
  type SpellingRead,
  type WordedOptionSummary
} from './bulkEdit';
import { makeDocument, makeMatch } from './fixtures';

/** Two snippets of `match/base.yml` (document 2) and one of `match/other.yml` (3). */
function views(): DocumentView[] {
  return [
    makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-a',
      matches: [
        makeMatch({ node: 10, document: 2, revision: 'rev-a', trigger: ':one' }),
        makeMatch({ node: 11, document: 2, revision: 'rev-a', trigger: ':two' })
      ]
    }),
    makeDocument({
      id: 3,
      relativePath: 'match/other.yml',
      revision: 'rev-x',
      matches: [makeMatch({ node: 20, document: 3, revision: 'rev-x', trigger: ':three' })]
    })
  ];
} // End of function views()

/** The identity of snippet `index` of document `document` in {@link views}. */
function idOf(document: number, index: number): MatchId {
  const view = views().find((held) => held.id === document);
  const match = view?.matches[index];
  if (match === undefined) {
    throw new Error(`no fixture snippet ${document}/${index}`);
  }
  return match.id;
} // End of function idOf()

/** A selection of the given identities, in order. */
function selectionOf(...ids: MatchId[]): BulkSelection {
  return ids.reduce<BulkSelection>(
    (selection, id) => toggleInBulkSelection(selection, id),
    EMPTY_BULK_SELECTION
  );
} // End of function selectionOf()

/** Spellings with every option absent except those given. */
function spellings(written: Partial<Record<BulkOption, OptionSpelling>> = {}): BulkOptionSpellings {
  const absent: OptionSpelling = { Absent: {} };
  return {
    word: written.word ?? absent,
    left_word: written.left_word ?? absent,
    right_word: written.right_word ?? absent,
    propagate_case: written.propagate_case ?? absent,
    uppercase_style: written.uppercase_style ?? absent,
    force_mode: written.force_mode ?? absent,
    force_clipboard: written.force_clipboard ?? absent
  };
} // End of function spellings()

/** A successful read of the given spellings, keyed for one identity. */
function readsOf(
  ...entries: readonly (readonly [MatchId, BulkOptionSpellings])[]
): Map<string, SpellingRead> {
  return new Map(
    entries.map(([id, spelled]) => [matchKeyOf(id), { kind: 'read', spellings: spelled } as const])
  );
} // End of function readsOf()

/** A written spelling. */
function written(source: string): OptionSpelling {
  return { Written: { source } };
} // End of function written()

/** The inputs for {@link prepareBulkApply}, with sensible defaults. */
function inputs(overrides: Partial<BulkApplyInputs> = {}): BulkApplyInputs {
  const selection = overrides.selection ?? selectionOf(idOf(2, 0), idOf(3, 0));
  return {
    selection,
    views: overrides.views ?? views(),
    reads: overrides.reads ?? readsOf(...selection.map((id) => [id, spellings()] as const)),
    intents: overrides.intents ?? { word: { Set: 'true' } },
    openDrafts: overrides.openDrafts ?? [],
    grants: overrides.grants ?? []
  };
} // End of function inputs()

/** A neutral suspicion, as a refusal would carry it. */
const SUSPICION: Finding = {
  code: { ReferenceHasNoDeclaration: { name: 'greeting' } },
  span: null,
  node: null,
  path: null
};

/** A result built from reports, with `nothing_written` derived as Rust does. */
function resultOf(preflight: boolean, files: BulkFileReport[]): BulkResult {
  return {
    preflight_passed: preflight,
    nothing_written: files.every(
      (file) => file.outcome !== 'saved' && file.outcome !== 'writeOutcomeUnknown'
    ),
    files
  };
} // End of function resultOf()

describe('only the seven allowed options can be submitted (ruling 20)', () => {
  it('names exactly the seven options, in the core’s order', () => {
    expect(BULK_OPTIONS).toEqual([
      'word',
      'left_word',
      'right_word',
      'propagate_case',
      'uppercase_style',
      'force_mode',
      'force_clipboard'
    ]);
    expect(isBulkOption('paragraph')).toBe(false);
    expect(isBulkOption('anchor')).toBe(false);
    expect(isBulkOption('force_mode')).toBe(true);
  });

  it('refuses to draft an eighth option, and never sends one smuggled into the intents', () => {
    const refused = setBulkIntent(EMPTY_BULK_DRAFT, 'paragraph' as BulkOption, { Set: 'true' });
    expect(refused).toBe(EMPTY_BULK_DRAFT);

    const smuggled = {
      word: { Set: 'true' },
      paragraph: { Set: 'true' },
      anchor: 'Remove',
      trigger: { Set: ':x' }
    } as unknown as BulkIntents;
    expect(bulkChangesOf(smuggled)).toEqual([{ option: 'word', value: { Set: 'true' } }]);

    const ready = prepareBulkApply(inputs({ intents: smuggled }));
    expect(ready.kind).toBe('ready');
    if (ready.kind === 'ready') {
      const sent = ready.submission.request.changes.map((change) => change.option);
      expect(sent).toEqual(['word']);
      expect(JSON.stringify(ready.submission.request)).not.toContain('paragraph');
      expect(JSON.stringify(ready.submission.request)).not.toContain('force"');
    }
  });

  it('sends the touched options in the fixed order, whatever order they were set in', () => {
    let draft = setBulkIntent(EMPTY_BULK_DRAFT, 'force_clipboard', 'Remove');
    draft = setBulkIntent(draft, 'word', { Set: 'false' });
    expect(bulkChangesOf(draft.intents)).toEqual([
      { option: 'word', value: { Set: 'false' } },
      { option: 'force_clipboard', value: 'Remove' }
    ]);
  });
}); // End of the "seven options" suite

describe('Mixed is exact source spelling, and an untouched Mixed control emits nothing', () => {
  const one = idOf(2, 0);
  const two = idOf(2, 1);

  it('calls one decoded text in two spellings Mixed, and the same bytes Same', () => {
    const reads = readsOf(
      [one, spellings({ word: written('true'), force_mode: written('clipboard') })],
      [two, spellings({ word: written("'true'"), force_mode: written('clipboard') })]
    );
    const selection = selectionOf(one, two);
    expect(summarizeOption(selection, reads, 'word')).toEqual({ kind: 'mixed' });
    expect(summarizeOption(selection, reads, 'force_mode')).toEqual({
      kind: 'same',
      source: 'clipboard'
    });
    expect(summarizeOption(selection, reads, 'left_word')).toEqual({ kind: 'absent' });
  });

  it('calls presence against absence Mixed, and a missing read Unknown', () => {
    const selection = selectionOf(one, two);
    const partial = readsOf([one, spellings({ right_word: written('yes') })], [two, spellings()]);
    expect(summarizeOption(selection, partial, 'right_word')).toEqual({ kind: 'mixed' });
    const missing = readsOf([one, spellings()]);
    expect(summarizeOption(selection, missing, 'word')).toEqual({ kind: 'unknown' });
    expect(summarizeOption(EMPTY_BULK_SELECTION, missing, 'word')).toEqual({ kind: 'unknown' });
  });

  it('keeps an option not written as one scalar apart from both absent and spelled', () => {
    const selection = selectionOf(one, two);
    const both = readsOf(
      [one, spellings({ left_word: { NotOneScalar: {} } })],
      [two, spellings({ left_word: { NotOneScalar: {} } })]
    );
    expect(summarizeOption(selection, both, 'left_word')).toEqual({ kind: 'notOneScalar' });
    const against = readsOf(
      [one, spellings({ left_word: { NotOneScalar: {} } })],
      [two, spellings()]
    );
    expect(summarizeOption(selection, against, 'left_word')).toEqual({ kind: 'mixed' });
  });

  it('shows Mixed on an untouched control, and that control adds nothing to the request', () => {
    const selection = selectionOf(one, two);
    const reads = readsOf(
      [one, spellings({ word: written('true'), propagate_case: written('true') })],
      [two, spellings({ word: written('false') })]
    );
    const intents: BulkIntents = { force_mode: { Set: 'clipboard' } };
    const controls = bulkControls(selection, reads, intents);
    const word = controls.find((control) => control.option === 'word');
    expect(word).toMatchObject({ intent: 'untouched', showsMixed: true, text: null });
    const ready = prepareBulkApply(inputs({ selection, reads, intents }));
    expect(ready.kind).toBe('ready');
    if (ready.kind === 'ready') {
      expect(ready.submission.request.changes).toEqual([
        { option: 'force_mode', value: { Set: 'clipboard' } }
      ]);
    }
  });

  it('stops showing Mixed once the control is touched, and emits exactly that intent', () => {
    const selection = selectionOf(one, two);
    const reads = readsOf(
      [one, spellings({ word: written('true') })],
      [two, spellings({ word: written('false') })]
    );
    const draft = setBulkIntent(EMPTY_BULK_DRAFT, 'word', 'Remove');
    const word = bulkControls(selection, reads, draft.intents).find(
      (control) => control.option === 'word'
    );
    expect(word).toMatchObject({ intent: 'remove', showsMixed: false });
    expect(bulkChangesOf(draft.intents)).toEqual([{ option: 'word', value: 'Remove' }]);
  });

  it('never compares or sends a decoded text: every summary comes from a Rust spelling', () => {
    // The model's only input for a summary is the read of `match_option_spellings`;
    // a projection's `ScalarView.text` is not an argument of `summarizeOption`.
    expect(summarizeOption.length).toBe(3);
    const reads = readsOf([one, spellings({ word: written('"true"') })]);
    expect(summarizeOption(selectionOf(one), reads, 'word')).toEqual({
      kind: 'same',
      source: '"true"'
    });
  });
}); // End of the "Mixed" suite

describe('a stale selection blocks (D2v, R27)', () => {
  it('is current while every identity names the live projection', () => {
    const selection = selectionOf(idOf(2, 0), idOf(3, 0));
    expect(bulkSelectionFreshness(selection, views(), new Map())).toEqual({ kind: 'current' });
  });

  it('is stale when a file’s projection moved on, and blocks without re-resolving', () => {
    const selection = selectionOf(idOf(2, 0), idOf(3, 0));
    const moved = views().map((view) =>
      view.id === 2
        ? makeDocument({
            id: 2,
            revision: 'rev-b',
            matches: [makeMatch({ node: 10, document: 2, revision: 'rev-b', trigger: ':one' })]
          })
        : view
    );
    expect(bulkSelectionFreshness(selection, moved, new Map())).toEqual({
      kind: 'stale',
      documents: [2]
    });
    const blocked = prepareBulkApply(inputs({ selection, views: moved }));
    expect(blocked).toMatchObject({ kind: 'blocked', blockers: ['staleSelection'] });
  });

  it('is stale when a spelling read answered identityStaleRevision, handled rather than unwrapped', () => {
    const stale: CommandResult<BulkOptionSpellings> = {
      ok: false,
      failure: {
        kind: 'command',
        error: { code: 'identityStaleRevision', expected: 'rev-b', found: 'rev-a' }
      }
    };
    const read = spellingReadOf(stale);
    expect(read).toEqual({ kind: 'stale' });
    const selection = selectionOf(idOf(2, 0));
    const reads = new Map<string, SpellingRead>([[matchKeyOf(idOf(2, 0)), read]]);
    expect(bulkSelectionFreshness(selection, views(), reads)).toEqual({
      kind: 'stale',
      documents: [2]
    });
    expect(prepareBulkApply(inputs({ selection, reads }))).toMatchObject({
      kind: 'blocked',
      blockers: ['staleSelection']
    });
  });

  it('carries any other failed read whole, and a success as its spellings', () => {
    const failed: CommandResult<BulkOptionSpellings> = {
      ok: false,
      failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
    };
    expect(spellingReadOf(failed)).toEqual({ kind: 'failed', failure: failed.ok ? null : failed.failure });
    expect(spellingReadOf({ ok: true, value: spellings() })).toEqual({
      kind: 'read',
      spellings: spellings()
    });
  });

  it('is stale when the file is no longer projected at all', () => {
    const selection = selectionOf(idOf(3, 0));
    const without = views().filter((view) => view.id !== 3);
    expect(bulkSelectionFreshness(selection, without, new Map())).toEqual({
      kind: 'stale',
      documents: [3]
    });
  });
}); // End of the "stale selection" suite

describe('open drafts are respected: the file is excluded, and the wording claims only an open editor', () => {
  it('excludes every selected snippet of a file with any open editor, and sends the file as excluded', () => {
    const selection = selectionOf(idOf(2, 0), idOf(2, 1), idOf(3, 0));
    // An editor open over a snippet of file 2 that is not even selected.
    const openDrafts = [idOf(2, 1)];
    const plan = planBulkApply(selection, views(), openDrafts);
    expect(plan.files.map((file) => file.document)).toEqual([3]);
    expect(plan.excludedFiles).toEqual([2]);
    expect(plan.exclusions).toEqual([
      { match: idOf(2, 0), reason: 'editorOpen' },
      { match: idOf(2, 1), reason: 'editorOpen' }
    ]);
    const ready = prepareBulkApply(inputs({ selection, openDrafts }));
    expect(ready.kind).toBe('ready');
    if (ready.kind === 'ready') {
      expect(ready.submission.request.files.map((file) => file.document)).toEqual([3]);
      expect(ready.submission.request.excluded).toEqual([2]);
    }
  });

  it('counts an editor over an earlier parse of the same file too', () => {
    const earlier: MatchId = { document: 2, revision: 'rev-0', node: 99 };
    const plan = planBulkApply(selectionOf(idOf(2, 0)), views(), [earlier]);
    expect(plan.exclusions).toEqual([{ match: idOf(2, 0), reason: 'editorOpen' }]);
  });

  it('excludes a snippet the visual editor may not write, and keeps its file for the rest', () => {
    const hazardous = views().map((view) =>
      view.id === 2
        ? makeDocument({
            id: 2,
            revision: 'rev-a',
            matches: [
              makeMatch({ node: 10, document: 2, revision: 'rev-a', trigger: ':one' }),
              makeMatch({
                node: 11,
                document: 2,
                revision: 'rev-a',
                trigger: ':two',
                safelyEditable: false,
                blockingHazard: 'AnchorDefinition'
              })
            ]
          })
        : view
    );
    const plan = planBulkApply(selectionOf(idOf(2, 0), idOf(2, 1)), hazardous, []);
    expect(plan.files).toEqual([{ document: 2, baseRevision: 'rev-a', matches: [idOf(2, 0)] }]);
    expect(plan.exclusions).toEqual([{ match: idOf(2, 1), reason: 'readOnly' }]);
  });

  it('blocks when every selected snippet is excluded', () => {
    const blocked = prepareBulkApply(
      inputs({ selection: selectionOf(idOf(2, 0)), openDrafts: [idOf(2, 0)] })
    );
    expect(blocked).toMatchObject({ kind: 'blocked', blockers: ['nothingToApply'] });
  });

  it('never says unsaved edits exist, in either language', () => {
    for (const lang of LOCALES) {
      const sentence = describeBulkExclusion(lang, 'editorOpen');
      expect(sentence).toBe(translate(lang, bulkExclusionKey('editorOpen')));
      expect(sentence).toMatch(lang === 'en' ? /cannot tell whether/ : /no puede saber si/);
      expect(sentence).not.toMatch(/unsaved|sin guardar/i);
    }
  });
}); // End of the "open drafts" suite

describe('exclusions and execution failures are counted separately', () => {
  it('counts excluded files and snippets apart from every execution outcome', () => {
    const selection = selectionOf(idOf(2, 0), idOf(2, 1), idOf(3, 0));
    const plan = planBulkApply(selection, views(), [idOf(3, 0)]);
    expect(plan.excludedFiles).toEqual([3]);
    const result = resultOf(true, [
      { document: 2, outcome: 'failed', error: { code: 'noWorkspaceOpen' } },
      { document: 3, outcome: 'excludedBeforeApply' }
    ]);
    const summary = summarizeBulkResult(result, plan);
    expect(summary).toMatchObject({
      headline: 'nothingWritten',
      notWritten: 1,
      excludedFiles: 1,
      excludedSnippets: 1,
      saved: 0
    });
  });

  it('keeps a committed file saved beside a later failure, and never calls it an error', () => {
    const plan = planBulkApply(selectionOf(idOf(2, 0), idOf(3, 0)), views(), []);
    const result = resultOf(true, [
      { document: 2, outcome: 'saved', revision: 'rev-b', backup_taken: true, notes: [] },
      { document: 3, outcome: 'conflicted', expected: 'rev-x', found: 'rev-y', disk_revision: 'rev-y' }
    ]);
    const summary = summarizeBulkResult(result, plan);
    expect(summary).toMatchObject({
      headline: 'partial',
      saved: 1,
      notWritten: 1,
      excludedFiles: 0,
      excludedSnippets: 0,
      committedDocuments: [2]
    });
    expect(bulkFileEffect(result.files[0]!)).toEqual({ kind: 'committed', revision: 'rev-b' });
    expect(bulkFileEffect(result.files[1]!)).toEqual({ kind: 'nothingWritten' });
  });

  it('reports an uncertain write as uncertain, and the files after it as not attempted', () => {
    const plan = planBulkApply(selectionOf(idOf(2, 0), idOf(3, 0)), views(), []);
    const result = resultOf(true, [
      { document: 2, outcome: 'writeOutcomeUnknown', error: { code: 'noWorkspaceOpen' } },
      { document: 3, outcome: 'notAttempted' }
    ]);
    const summary = summarizeBulkResult(result, plan);
    expect(summary).toMatchObject({ headline: 'uncertain', writeOutcomeUnknown: 1, notAttempted: 1 });
    expect(bulkFileEffect(result.files[0]!)).toEqual({ kind: 'uncertain' });
  });

  it('calls a run where every file already held the values complete, with nothing written', () => {
    const plan = planBulkApply(selectionOf(idOf(2, 0)), views(), []);
    const result = resultOf(true, [{ document: 2, outcome: 'alreadyUnchanged', revision: 'rev-a' }]);
    expect(result.nothing_written).toBe(true);
    expect(summarizeBulkResult(result, plan).headline).toBe('complete');
    expect(bulkFileEffect(result.files[0]!)).toEqual({ kind: 'unchanged', revision: 'rev-a' });
  });

  it('counts a preflight blocker as not written and its siblings as not attempted', () => {
    const plan = planBulkApply(selectionOf(idOf(2, 0), idOf(3, 0)), views(), []);
    const result = resultOf(false, [
      { document: 2, outcome: 'blocked', error: { code: 'noWorkspaceOpen' } },
      { document: 3, outcome: 'notAttempted' }
    ]);
    expect(summarizeBulkResult(result, plan)).toMatchObject({
      headline: 'nothingWritten',
      notWritten: 1,
      notAttempted: 1,
      excludedFiles: 0
    });
  });
}); // End of the "counted separately" suite

describe('draft undo works, and no disk batch undo is promised', () => {
  it('undoes and redoes the drafted intents, one edit per step', () => {
    let draft = setBulkIntent(EMPTY_BULK_DRAFT, 'word', { Set: 'true' });
    draft = setBulkIntent(draft, 'force_mode', { Set: 'clipboard' });
    draft = clearBulkIntent(draft, 'word');
    expect(draft.intents).toEqual({ force_mode: { Set: 'clipboard' } });
    expect(canUndoBulkDraft(draft)).toBe(true);

    const back = undoBulkDraft(draft);
    expect(back.intents).toEqual({ word: { Set: 'true' }, force_mode: { Set: 'clipboard' } });
    expect(canRedoBulkDraft(back)).toBe(true);
    expect(redoBulkDraft(back).intents).toEqual(draft.intents);

    const start = undoBulkDraft(undoBulkDraft(back));
    expect(start.intents).toEqual({});
    expect(canUndoBulkDraft(start)).toBe(false);
    expect(undoBulkDraft(start)).toBe(start);
  });

  it('adds no step for an edit that changes nothing, and drops the redo branch on an edit', () => {
    const once = setBulkIntent(EMPTY_BULK_DRAFT, 'word', { Set: 'true' });
    expect(setBulkIntent(once, 'word', { Set: 'true' })).toBe(once);
    const undone = undoBulkDraft(once);
    const branched = setBulkIntent(undone, 'left_word', 'Remove');
    expect(canRedoBulkDraft(branched)).toBe(false);
  });

  it('restores an intent the request then carries again, and touches nothing else', () => {
    let draft = setBulkIntent(EMPTY_BULK_DRAFT, 'word', { Set: 'true' });
    draft = clearBulkIntent(draft, 'word');
    expect(prepareBulkApply(inputs({ intents: draft.intents }))).toMatchObject({
      kind: 'blocked',
      blockers: ['noChanges']
    });
    const restored = undoBulkDraft(draft);
    const ready = prepareBulkApply(inputs({ intents: restored.intents }));
    expect(ready.kind).toBe('ready');
  });

  it('offers no undo of a save: the draft and the summary name nothing that could', () => {
    expect(Object.keys(EMPTY_BULK_DRAFT).sort()).toEqual(['future', 'intents', 'past']);
    const plan = planBulkApply(selectionOf(idOf(2, 0)), views(), []);
    const summary = summarizeBulkResult(
      resultOf(true, [{ document: 2, outcome: 'saved', revision: 'rev-b', backup_taken: false, notes: [] }]),
      plan
    );
    expect(Object.keys(summary).some((key) => /undo|revert|restore/i.test(key))).toBe(false);
    for (const lang of LOCALES) {
      const bulkSentences = Object.entries(DICTIONARIES[lang])
        .filter(([key]) => key.startsWith('browser.bulkEdit.'))
        .map(([, sentence]) => sentence);
      expect(bulkSentences.length).toBeGreaterThan(0);
      for (const sentence of bulkSentences) {
        expect(sentence).not.toMatch(/undo|deshac|revert|restaur/i);
      }
    }
  });
}); // End of the "draft undo" suite

describe('consent is per file, base revision, intent and candidate (ruling 22)', () => {
  /** A first attempt over both files, refused for file 2's candidate. */
  function refusedFirstAttempt() {
    const ready = prepareBulkApply(inputs());
    if (ready.kind !== 'ready') {
      throw new Error('the fixture request must be ready');
    }
    const result = resultOf(false, [
      {
        document: 2,
        outcome: 'refused',
        verdict: 'RefusedForUnacknowledgedSuspicions',
        findings: [SUSPICION, SUSPICION],
        candidate: 'cand-2',
        intent: 'intent-2'
      },
      { document: 3, outcome: 'notAttempted' }
    ]);
    return { submission: ready.submission, result };
  } // End of function refusedFirstAttempt()

  it('reviews the refused files, and binds the exact findings to that file’s own identities', () => {
    const { submission, result } = refusedFirstAttempt();
    expect(bulkConsentReview(result)).toEqual([
      {
        document: 2,
        verdict: 'RefusedForUnacknowledgedSuspicions',
        findings: [SUSPICION, SUSPICION],
        acknowledgeable: true
      }
    ]);
    const grants = acknowledgeBulkRefusal([], submission, result, 2);
    expect(grants).toHaveLength(1);
    expect(grants[0]?.consent).toEqual({
      document: 2,
      base_revision: 'rev-a',
      intent: 'intent-2',
      candidate: 'cand-2',
      acknowledgement: { accepted: [SUSPICION, SUSPICION] }
    });
    const again = prepareBulkApply(inputs({ grants }));
    expect(again.kind).toBe('ready');
    if (again.kind === 'ready') {
      expect(again.submission.request.files[0]?.consent).toEqual(grants[0]?.consent);
      expect(again.submission.request.files[1]?.consent).toBeNull();
    }
  });

  it('drops the consent once the intents or the selection change, rather than sending it', () => {
    const { submission, result } = refusedFirstAttempt();
    const grants: readonly BulkConsentGrant[] = acknowledgeBulkRefusal([], submission, result, 2);
    const otherIntent = prepareBulkApply(inputs({ grants, intents: { word: { Set: 'false' } } }));
    const otherSelection = prepareBulkApply(
      inputs({ grants, selection: selectionOf(idOf(2, 0), idOf(2, 1), idOf(3, 0)) })
    );
    for (const ready of [otherIntent, otherSelection]) {
      expect(ready.kind).toBe('ready');
      if (ready.kind === 'ready') {
        expect(ready.submission.request.files.every((file) => file.consent === null)).toBe(true);
      }
    }
  });

  it('refuses to record consent for a file that was not refused, or for a verdict no consent moves', () => {
    const { submission, result } = refusedFirstAttempt();
    expect(acknowledgeBulkRefusal([], submission, result, 3)).toEqual([]);
    const errors = resultOf(false, [
      {
        document: 2,
        outcome: 'refused',
        verdict: 'RefusedForEditorModelErrors',
        findings: [SUSPICION],
        candidate: 'cand-2',
        intent: 'intent-2'
      }
    ]);
    expect(acknowledgeBulkRefusal([], submission, errors, 2)).toEqual([]);
    expect(bulkConsentReview(errors)[0]?.acknowledgeable).toBe(false);
  });

  it('carries no batch-wide consent and no force flag anywhere in the request', () => {
    const { submission, result } = refusedFirstAttempt();
    const grants = acknowledgeBulkRefusal([], submission, result, 2);
    const ready = prepareBulkApply(inputs({ grants }));
    expect(ready.kind).toBe('ready');
    if (ready.kind === 'ready') {
      expect(Object.keys(ready.submission.request).sort()).toEqual(['changes', 'excluded', 'files']);
      expect(JSON.stringify(ready.submission.request)).not.toMatch(/"force"/);
    }
  });
}); // End of the "consent" suite

describe('what blocks a submission', () => {
  it('names every blocker at once', () => {
    expect(prepareBulkApply(inputs({ selection: EMPTY_BULK_SELECTION, intents: {} }))).toMatchObject({
      kind: 'blocked',
      blockers: ['noSelection', 'noChanges']
    });
    expect(prepareBulkApply(inputs({ intents: { word: { Set: '' } } }))).toMatchObject({
      kind: 'blocked',
      blockers: ['emptyValue']
    });
  });

  it('builds one file entry per file, in selection order, at the live base revision', () => {
    const selection = selectionOf(idOf(3, 0), idOf(2, 1), idOf(2, 0));
    const ready = prepareBulkApply(inputs({ selection }));
    expect(ready.kind).toBe('ready');
    if (ready.kind === 'ready') {
      expect(ready.submission.request.files).toEqual([
        { document: 3, base_revision: 'rev-x', matches: [idOf(3, 0)], consent: null },
        { document: 2, base_revision: 'rev-a', matches: [idOf(2, 1), idOf(2, 0)], consent: null }
      ]);
    }
  });

  it('toggles a snippet in and out, holding each identity once', () => {
    const one = idOf(2, 0);
    const twice = toggleInBulkSelection(toggleInBulkSelection(EMPTY_BULK_SELECTION, one), one);
    expect(twice).toEqual([]);
    expect(selectionOf(one, idOf(2, 1))).toHaveLength(2);
  });
}); // End of the "blocks" suite

describe('the accessors, in both languages', () => {
  it('gives every exclusion, blocker, summary and headline a sentence through its key function', () => {
    const reasons: readonly BulkExclusionReason[] = ['readOnly', 'editorOpen'];
    const blockers: readonly BulkBlocker[] = [
      'noSelection',
      'staleSelection',
      'noChanges',
      'emptyValue',
      'nothingToApply'
    ];
    const summaries: readonly WordedOptionSummary[] = ['unknown', 'absent', 'notOneScalar', 'mixed'];
    const headlines: readonly BulkOutcomeHeadline[] = [
      'complete',
      'partial',
      'uncertain',
      'nothingWritten'
    ];
    for (const lang of LOCALES) {
      for (const reason of reasons) {
        expect(describeBulkExclusion(lang, reason)).toBe(translate(lang, bulkExclusionKey(reason)));
      }
      for (const blocker of blockers) {
        expect(describeBulkBlocker(lang, blocker)).toBe(translate(lang, bulkBlockerKey(blocker)));
      }
      for (const kind of summaries) {
        expect(describeBulkOptionSummary(lang, kind)).toBe(translate(lang, optionSummaryKey(kind)));
      }
      for (const headline of headlines) {
        expect(describeBulkOutcomeHeadline(lang, headline)).toBe(
          translate(lang, bulkOutcomeHeadlineKey(headline))
        );
      }
    } // End of the loop over the two languages
    const keys = new Set([
      ...reasons.map(bulkExclusionKey),
      ...blockers.map(bulkBlockerKey),
      ...summaries.map(optionSummaryKey),
      ...headlines.map(bulkOutcomeHeadlineKey)
    ]);
    expect(keys.size).toBe(15);
    const inDictionary = Object.keys(DICTIONARIES.en).filter((key) =>
      key.startsWith('browser.bulkEdit.')
    );
    expect(new Set(inDictionary)).toEqual(keys);
  });

  it('never says nothing was written for a partial outcome, and says so for none written', () => {
    for (const lang of LOCALES) {
      const partial = describeBulkOutcomeHeadline(lang, 'partial');
      expect(partial).toMatch(lang === 'en' ? /stay saved/ : /siguen guardados/);
      expect(describeBulkOutcomeHeadline(lang, 'nothingWritten')).toMatch(
        lang === 'en' ? /No file was written/ : /No se escribió ningún archivo/
      );
    }
  });
}); // End of the "accessors" suite

describe('what the inspector draws (Phase 3-11-2)', () => {
  it('refuses to start selecting several while any write surface is open', () => {
    expect(bulkSelectingAvailability([])).toBe('available');
    expect(
      bulkSelectingAvailability([{ kind: 'matchEditor', target: { kind: 'document', document: 2 } }])
    ).toBe('surfaceOpen');
    expect(bulkSelectingAvailability([{ kind: 'matchCreator', target: { kind: 'unknown' } }])).toBe(
      'surfaceOpen'
    );
  });

  it('asks for each unread snippet once, and never retries a failed read by itself', () => {
    const selection = selectionOf(idOf(2, 0), idOf(2, 1), idOf(3, 0));
    const failed: SpellingRead = {
      kind: 'failed',
      failure: { kind: 'unrecognized', value: 'boom' } as never
    };
    const reads = new Map<string, SpellingRead>([
      [matchKeyOf(idOf(2, 0)), { kind: 'read', spellings: spellings() }],
      [matchKeyOf(idOf(2, 1)), failed]
    ]);
    expect(spellingReadsWanted(selection, reads, new Set())).toEqual([idOf(3, 0)]);
    expect(spellingReadsWanted(selection, reads, new Set([matchKeyOf(idOf(3, 0))]))).toEqual([]);
    expect(failedSpellingReads(selection, reads)).toBe(1);
    const again = withoutFailedReads(reads);
    expect(again.has(matchKeyOf(idOf(2, 1)))).toBe(false);
    expect(again.has(matchKeyOf(idOf(2, 0)))).toBe(true);
    expect(spellingReadsWanted(selection, again, new Set())).toEqual([idOf(2, 1), idOf(3, 0)]);
  });

  it('labels each option with the detail pane’s own field and offers the editor’s suggestions', () => {
    expect(BULK_OPTIONS.map(bulkOptionField)).toEqual([
      'word',
      'leftWord',
      'rightWord',
      'propagateCase',
      'uppercaseStyle',
      'forceMode',
      'forceClipboard'
    ]);
    expect(bulkSuggestionsFor('force_mode')).toEqual(['clipboard', 'keys']);
    expect(bulkSuggestionsFor('word')).toEqual([]);
  });

  it('maps an intent control’s three choices onto the draft, each one undoable step', () => {
    const set = chooseBulkIntent(EMPTY_BULK_DRAFT, 'word', 'set');
    expect(set.intents.word).toEqual({ Set: '' });
    const typed = typeBulkIntentText(set, 'word', 'true');
    const removed = chooseBulkIntent(typed, 'word', 'remove');
    expect(removed.intents.word).toBe('Remove');
    const back = chooseBulkIntent(removed, 'word', 'untouched');
    expect(back.intents.word).toBeUndefined();
    expect(bulkChangesOf(back.intents)).toEqual([]);
    // `set` over a set option keeps its text and adds no step.
    expect(chooseBulkIntent(typed, 'word', 'set')).toBe(typed);
    expect(undoBulkDraft(undoBulkDraft(back)).intents.word).toEqual({ Set: 'true' });
  });

  it('keeps a run of typing into one box as one step, and starts a new run after another edit', () => {
    let draft = chooseBulkIntent(EMPTY_BULK_DRAFT, 'force_mode', 'set');
    draft = typeBulkIntentText(draft, 'force_mode', 'c');
    draft = typeBulkIntentText(draft, 'force_mode', 'cl');
    draft = typeBulkIntentText(draft, 'force_mode', 'clipboard');
    expect(draft.past).toHaveLength(2);
    expect(undoBulkDraft(draft).intents.force_mode).toEqual({ Set: '' });
    draft = chooseBulkIntent(draft, 'word', 'remove');
    draft = typeBulkIntentText(draft, 'force_mode', 'keys');
    expect(draft.past).toHaveLength(4);
    expect(undoBulkDraft(draft).intents.force_mode).toEqual({ Set: 'clipboard' });
    expect(typeBulkIntentText(draft, 'paragraph' as BulkOption, 'x')).toBe(draft);
  });

  it('names every excluded snippet with its trigger view and its file, and counts the plan', () => {
    const readOnly = views();
    const first = readOnly[0];
    if (first === undefined) {
      throw new Error('fixture');
    }
    readOnly[0] = {
      ...first,
      matches: first.matches.map((match, index) =>
        index === 1 ? { ...match, safely_editable: false } : match
      )
    };
    const plan = planBulkApply(selectionOf(idOf(2, 0), idOf(2, 1), idOf(3, 0)), readOnly, []);
    const rows = bulkExclusionRows(plan, readOnly);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.reason).toBe('readOnly');
    expect(rows[0]?.file).toBe('match/base.yml');
    expect(rows[0]?.view?.id).toEqual(idOf(2, 1));
    expect(bulkExclusionRows(plan, [])[0]).toMatchObject({ view: null, file: null });
    expect(bulkPlanCounts(plan)).toEqual({ files: 2, snippets: 2 });
  });

  it('keeps execution counts and exclusion counts in two lists, zero lines left out', () => {
    const plan = planBulkApply(selectionOf(idOf(2, 0), idOf(3, 0)), views(), [idOf(3, 0)]);
    const summary = summarizeBulkResult(
      resultOf(true, [
        { document: 2, outcome: 'saved', revision: 'rev-b', backup_taken: true, notes: [] },
        { document: 3, outcome: 'excludedBeforeApply' }
      ]),
      plan
    );
    const counts = bulkOutcomeCounts(summary);
    expect(counts.execution).toEqual([{ name: 'saved', count: 1 }]);
    expect(counts.exclusions).toEqual([
      { name: 'excludedFiles', count: 1 },
      { name: 'excludedSnippets', count: 1 }
    ]);
  });

  it('lists each file with its name, its command error and a re-read that failed, never as a save failure', () => {
    const failure = { kind: 'unrecognized', value: 'x' } as never;
    const result = resultOf(true, [
      { document: 2, outcome: 'saved', revision: 'rev-b', backup_taken: false, notes: [] },
      { document: 3, outcome: 'failed', error: { code: 'noWorkspaceOpen' } as never }
    ]);
    const lines = bulkFileLines(
      result,
      [{ document: 2, adoption: { kind: 'failed', failure } }],
      [
        { ...views()[0], loaded: true } as never,
        { ...views()[1], loaded: true } as never
      ]
    );
    expect(lines.map((line) => line.report.outcome)).toEqual(['saved', 'failed']);
    expect(lines[0]).toMatchObject({ file: 'match/base.yml', rereadFailure: failure, error: null });
    expect(lines[1]).toMatchObject({ file: 'match/other.yml', rereadFailure: null });
    expect(lines[1]?.error).toEqual({ code: 'noWorkspaceOpen' });
  });

  it('narrows the selection to what nothing wrote, dropping and never re-resolving the rest', () => {
    const selection = selectionOf(idOf(2, 0), idOf(3, 0), idOf(2, 1));
    const result = resultOf(true, [
      { document: 2, outcome: 'saved', revision: 'rev-b', backup_taken: false, notes: [] },
      {
        document: 3,
        outcome: 'refused',
        verdict: 'RefusedForUnacknowledgedSuspicions',
        findings: [SUSPICION],
        candidate: 'c',
        intent: 'i'
      }
    ]);
    expect(remainingBulkSelection(selection, result, selection)).toEqual([idOf(3, 0)]);
    expect(bulkNarrowingOffered(selection, result, selection)).toEqual([idOf(3, 0)]);
    expect(bulkNarrowingOffered([idOf(3, 0)], result, [idOf(3, 0)])).toBeNull();
    expect(bulkNarrowingOffered([idOf(2, 0)], result, [idOf(2, 0)])).toBeNull();
  });

  it('keeps a snippet selected after the submission, whatever that answer says (review fix 3)', () => {
    const submitted = selectionOf(idOf(2, 0));
    const result = resultOf(true, [
      { document: 2, outcome: 'saved', revision: 'rev-b', backup_taken: false, notes: [] }
    ]);
    // File 3 was selected after the apply; the answer does not name it.
    const now = selectionOf(idOf(2, 0), idOf(3, 0));
    expect(remainingBulkSelection(now, result, submitted)).toEqual([idOf(3, 0)]);
    expect(bulkNarrowingOffered(now, result, submitted)).toEqual([idOf(3, 0)]);
  });

  it('offers consent only while the file as it would be sent is the one reviewed (review fix 2)', () => {
    const selection = selectionOf(idOf(2, 0), idOf(3, 0));
    const intents: BulkIntents = { word: { Set: 'true' } };
    const ready = prepareBulkApply(inputs({ selection, intents }));
    if (ready.kind !== 'ready') {
      throw new Error('the fixture request must be ready');
    }
    const reviewed = ready.submission.keys.find((entry) => entry.document === 2)?.key;
    const result = resultOf(false, [
      {
        document: 2,
        outcome: 'refused',
        verdict: 'RefusedForUnacknowledgedSuspicions',
        findings: [SUSPICION],
        candidate: 'cand-2',
        intent: 'intent-2'
      },
      { document: 3, outcome: 'notAttempted' }
    ]);
    const plan = ready.plan;
    expect(bulkConsentReviewStatus(reviewed, plan, intents, [], 2)).toBe('offered');
    const grants = acknowledgeBulkRefusal([], ready.submission, result, 2);
    expect(bulkConsentReviewStatus(reviewed, plan, intents, grants, 2)).toBe('recorded');
    // Another option drafted: the review is about a request no longer on screen.
    const changed: BulkIntents = { word: { Set: 'true' }, force_mode: { Set: 'keys' } };
    expect(bulkConsentReviewStatus(reviewed, plan, changed, grants, 2)).toBe('outdated');
    expect(bulkConsentReviewStatus(reviewed, plan, changed, [], 2)).toBe('outdated');
    // Another selection in that file.
    const wider = planBulkApply(selectionOf(idOf(2, 0), idOf(2, 1), idOf(3, 0)), views(), []);
    expect(bulkConsentReviewStatus(reviewed, wider, intents, grants, 2)).toBe('outdated');
    expect(bulkConsentReviewStatus(undefined, plan, intents, grants, 2)).toBe('outdated');
    // Changing back makes the same review current again.
    expect(bulkConsentReviewStatus(reviewed, plan, intents, grants, 2)).toBe('recorded');
  });

  it('keeps a grant only for a file the answer never reached', () => {
    const grant = (document: number): BulkConsentGrant => ({
      key: `k${document}`,
      consent: {
        document,
        base_revision: 'r',
        intent: 'i',
        candidate: 'c',
        acknowledgement: { accepted: [] }
      }
    });
    const grants = [grant(2), grant(3), grant(4)];
    const result = resultOf(false, [
      { document: 2, outcome: 'consentStale', intent: 'i', candidate: 'c' },
      { document: 3, outcome: 'notAttempted' }
    ]);
    const kept = grantsAfterBulkAnswer(grants, result);
    expect(kept.map((held) => held.consent.document)).toEqual([3, 4]);
    expect(bulkConsentRecorded(kept, 3)).toBe(true);
    expect(bulkConsentRecorded(kept, 2)).toBe(false);
  });

  it('gives every counted line a sentence in both languages with the count in it, and no undo', () => {
    const names: readonly BulkCountName[] = [
      'saved',
      'alreadyUnchanged',
      'notWritten',
      'writeOutcomeUnknown',
      'notAttempted',
      'excludedFiles',
      'excludedSnippets'
    ];
    expect(new Set(names.map(bulkCountKey)).size).toBe(names.length);
    for (const lang of LOCALES) {
      for (const name of names) {
        const sentence = describeBulkCount(lang, { name, count: 7 });
        expect(sentence).toContain('7');
        expect(sentence).not.toMatch(/[{}]/);
        expect(sentence).not.toMatch(/undo|deshac|revert|restaur/i);
      }
    } // End of the loop over the two languages
  });

  it('names an undo only for the draft, and says a saved file is not taken back', () => {
    for (const lang of LOCALES) {
      const inspector = Object.entries(DICTIONARIES[lang]).filter(([key]) =>
        key.startsWith('browser.bulkInspector.')
      );
      const naming = inspector
        .filter(([, sentence]) => /undo|deshac|revert|anul|take.*back/i.test(sentence))
        .map(([key]) => key);
      expect(naming).toContain('browser.bulkInspector.draftUndo');
      for (const key of naming) {
        expect([
          'browser.bulkInspector.draftOnly',
          'browser.bulkInspector.draftUndo',
          'browser.bulkInspector.noDiskUndo'
        ]).toContain(key);
      }
    }
    expect(translate('en', 'browser.bulkInspector.noDiskUndo')).toMatch(/nothing here takes that save back/);
    expect(translate('es', 'browser.bulkInspector.noDiskUndo')).toMatch(/nada de aquí anula/);
  });
}); // End of the "what the inspector draws" suite
