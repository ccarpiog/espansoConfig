/**
 * Phase 3-6-1 — trigger forms and `search_terms` in the editor model, driven
 * without a screen.
 *
 * One `describe` per acceptance clause of step 3-6 in
 * `docs/decisions/3-split-notes.md` §2 (the 3-6-1 piece of its 2026-09-24
 * addendum): list style kept, intended order kept, a failed regex keeping the
 * draft with Rust's `RegexDoesNotCompile`, multiple→single never dropping an
 * alias silently, conservative list reapply (ruling 23), recovery that carries
 * everything or refuses explicitly, and the carriage return refused at the
 * three gates for every new control. Then the `Several`/`Absent` presentation,
 * the conflict copy and the dictionary keys the new codes need; last, the view
 * values Phase 3-6-2 added so `MatchEditor.svelte` decides nothing.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DICTIONARIES } from '../i18n/dictionaries';
import { LOCALES } from '../i18n/locale';
import type {
  ContentRevision,
  DocumentView,
  MatchDraft,
  MatchId,
  MatchView,
  SaveResult,
  SequencePresence,
  UnknownEntry
} from '../ipc/types';
import { editDraft, isDirty } from './draft';
import { makeConflict, makeDocument, makeMatch, makeSummary, scalarItem } from './fixtures';
import type { InvalidationStatus } from './invalidation';
import { NO_CREATION_OPTIONS } from './matchCreation';
import {
  addList,
  addListItem,
  applySave,
  baselineOf,
  beginSave,
  buffersOf,
  canSave,
  cancelTriggerForm,
  chooseTriggerForm,
  confirmTriggerForm,
  conflictOf,
  editField,
  editListItem,
  editRegex,
  isFieldEditable,
  matchDraftOf,
  matchEditorView,
  planMatchReapply,
  removeField,
  removeList,
  removeListItem,
  saveWithheldKey,
  startMatchEditor,
  triggerFormChoiceKey,
  triggerFormChoices,
  triggerFormRefusalKey,
  triggerFormTextNoteKey,
  triggerPresentationKey,
  triggerRepairKey,
  triggerWithdrawalKey,
  undoEdit,
  type MatchBuffers,
  type MatchEditorSession,
  type SaveWithheld,
  type TriggerFormRefusal
} from './matchEditor';
import {
  listItemStatusKey,
  listRefusalKey,
  listStyleNoteKey,
  type ListItemStatus,
  type ListRefusal,
  type ListStyle
} from './matchLists';
import {
  beginRecoveryCreate,
  editRecoveryField,
  newMatchOfRecovery,
  recoveryView,
  startMatchFieldRecovery,
  structureTransferOfMatchDraft,
  transferOfMatchDraft,
  transferRefusalKey
} from './recovery';

/** The revision every projection below is minted from. */
const BASE: ContentRevision = 'a'.repeat(64);

/** The revision the file holds after a commit or an external change. */
const AFTER: ContentRevision = 'b'.repeat(64);

/** The identity a committed save answers with. */
const MOVED: MatchId = { document: 2, revision: AFTER, node: 1 };

/** The adoption a save that wrote nothing owes: none. */
const NOT_OWED: InvalidationStatus = { kind: 'notOwed' };

/** The adoption a committed save performed. */
const ADOPTED: InvalidationStatus = { kind: 'done' };

/** A location nothing slices by. */
const NOWHERE = {
  key_node: 0,
  key_span: { start: 0, end: 0 },
  value_node: 0,
  value_span: { start: 0, end: 0 },
  path: null
};

/** A second `search_terms` entry the projection could not model: a repeated key. */
const REPEATED_TERMS: UnknownEntry = {
  key: 'search_terms',
  key_node: 0,
  key_span: { start: 0, end: 1 },
  value_span: { start: 0, end: 3 },
  value_kind: 'Sequence',
  value_text: '[x]',
  path: null,
  reason: 'RepeatedKey'
};

/**
 * A projection of one snippet, minted at `revision`.
 *
 * @param overrides - Whatever the case needs; `trigger: ':a'` and `replace: 'b'`
 *   unless it says otherwise.
 * @param revision - The revision it is minted from.
 * @returns The projection.
 */
function projection(
  overrides: Parameters<typeof makeMatch>[0] = {},
  revision: ContentRevision = BASE
): MatchView {
  return makeMatch({ revision, document: 2, trigger: ':a', replace: 'b', ...overrides });
} // End of function projection()

/**
 * A snippet whose trigger is a block `triggers` list.
 *
 * @param items - The list's items.
 * @param revision - The revision it is minted from.
 * @returns The projection.
 */
function listed(items: readonly string[], revision: ContentRevision = BASE): MatchView {
  return projection({ trigger: null, triggers: items, triggerKind: 'Multiple' }, revision);
} // End of function listed()

/**
 * A snippet whose trigger is a regex.
 *
 * @param pattern - The pattern.
 * @returns The projection.
 */
function regexed(pattern: string): MatchView {
  return projection({ trigger: null, regex: pattern, triggerKind: 'Regex' });
} // End of function regexed()

/**
 * A projection with `search_terms` written in flow style.
 *
 * @param items - The list's items.
 * @param revision - The revision it is minted from.
 * @returns The projection.
 */
function flowTerms(items: readonly string[], revision: ContentRevision = BASE): MatchView {
  const match = projection({ searchTerms: items }, revision);
  const presence: SequencePresence = { Items: { location: NOWHERE, flow: true, count: items.length } };
  return { ...match, search_terms_presence: presence };
} // End of function flowTerms()

/**
 * A session over a projection, with a clock nothing advances.
 *
 * @param match - The projection.
 * @returns A clean session.
 */
function session(match: MatchView = projection()): MatchEditorSession {
  return startMatchEditor(match, () => 0);
} // End of function session()

/**
 * `beginSave` over the session it is handed, which is the installed one.
 *
 * @param held - The session to save.
 * @returns What `beginSave` answered.
 */
function begin(held: MatchEditorSession): ReturnType<typeof beginSave> {
  return beginSave(held, () => held);
} // End of function begin()

/**
 * The draft a save of this session would send.
 *
 * @param held - The session to save.
 * @returns The wire draft.
 */
function sent(held: MatchEditorSession): MatchDraft {
  const started = begin(held);
  if (started === null) {
    throw new Error('this case needs a saveable session');
  }
  return started.draft;
} // End of function sent()

/**
 * A session whose buffers were replaced by hand — a caller that is not a
 * transition, which `MatchBuffers`' missing brand lets type-check.
 *
 * @param held - The session.
 * @param buffers - The buffers to install.
 * @returns The session holding them.
 */
function forged(held: MatchEditorSession, buffers: MatchBuffers): MatchEditorSession {
  return { ...held, draft: editDraft(held.draft, buffers) };
} // End of function forged()

/**
 * The disk file a conflict carries, and the one file recovery may write into.
 *
 * @param matches - The snippets it holds.
 * @returns The projection.
 */
function diskFile(matches: readonly MatchView[] = []): DocumentView {
  return makeDocument({ id: 2, relativePath: 'match/base.yml', revision: AFTER, matches });
} // End of function diskFile()

/**
 * A session showing a save conflict over its edited draft.
 *
 * @param held - The edited session.
 * @returns The session showing the conflict.
 */
function conflicted(held: MatchEditorSession): MatchEditorSession {
  const started = begin(held);
  if (started === null) {
    throw new Error('this case needs a saveable session');
  }
  return applySave(
    started.session,
    makeConflict({ disk: diskFile(), expected: BASE, found: AFTER }),
    NOT_OWED,
    () => started.session
  );
} // End of function conflicted()

/**
 * A committed save's answer.
 *
 * @returns The wire result.
 */
function committed(): SaveResult {
  return { outcome: 'saved', revision: AFTER, committed: true, notes: [], backup_taken: false, moved: MOVED };
} // End of function committed()

// ---------------------------------------------------------------------------
// Block and flow lists keep their style
// ---------------------------------------------------------------------------

describe('block and flow lists keep their style', () => {
  it('edits a block list only by item intents, never by rewriting the list', () => {
    const held = session(listed([':one', ':two', ':three']));
    const view = matchEditorView(held).structure.trigger.triggers;
    expect(view.style).toBe('block');
    expect(view.editable).toBe(true);
    const edited = removeListItem(addListItem(held, 'triggers', 3, ':four'), 'triggers', 1);
    const draft = sent(edited);
    expect(draft.sequences).toEqual([
      { RemoveItem: { field: 'triggers', index: 1 } },
      { InsertItems: { field: 'triggers', at: { End: {} }, items: [':four'] } }
    ]);
    // No whole-field intent and no switch: nothing that could restyle the list.
    expect(draft.trigger_form).toBeNull();
    expect(draft.sequences.some((intent) => 'InsertField' in intent || 'RemoveField' in intent)).toBe(false);
  });

  it('edits a flow list by the same item intents, which Rust writes between its brackets', () => {
    const held = session(flowTerms(['alpha', 'beta']));
    expect(matchEditorView(held).structure.searchTerms.style).toBe('flow');
    const edited = editListItem(addListItem(held, 'search_terms', 0, 'zero'), 'search_terms', 2, 'BETA');
    const draft = sent(edited);
    expect(draft.search_terms).toEqual([{ index: 1, value: { Set: 'BETA' } }]);
    expect(draft.sequences).toEqual([
      { InsertItems: { field: 'search_terms', at: { Front: {} }, items: ['zero'] } }
    ]);
    // A committed save predicts the list stays a flow list.
    const started = begin(edited)!;
    const done = applySave(started.session, committed(), ADOPTED, () => started.session);
    expect(done.baseline.structure.searchTerms.style).toBe('flow');
    expect(done.baseline.structure.searchTerms.items).toEqual(['zero', 'alpha', 'BETA']);
  });

  it('adds a new list as one field intent — block with items, `[]` when explicitly empty', () => {
    const held = session();
    expect(matchEditorView(held).structure.searchTerms).toMatchObject({
      style: 'absent',
      present: false,
      canAddList: true
    });
    const added = addList(held, 'search_terms');
    expect(sent(added).sequences).toEqual([{ InsertField: { field: 'search_terms', items: [] } }]);
    const filled = addListItem(addListItem(added, 'search_terms', 0, 'one'), 'search_terms', 1, 'two');
    expect(sent(filled).sequences).toEqual([
      { InsertField: { field: 'search_terms', items: ['one', 'two'] } }
    ]);
    // Removing the whole list is its own explicit intent.
    const gone = removeList(session(projection({ searchTerms: ['x'] })), 'search_terms');
    expect(sent(gone).sequences).toEqual([{ RemoveField: { field: 'search_terms' } }]);
  });
});

// ---------------------------------------------------------------------------
// Additions and removals keep the intended order
// ---------------------------------------------------------------------------

describe('additions and removals keep the intended order', () => {
  it('places each run of new items directly above the next kept item', () => {
    const held = session(projection({ searchTerms: ['a', 'b', 'c', 'd'] }));
    // Drafted: x a B y d z — `c` removed, `b` retyped.
    let edited = addListItem(held, 'search_terms', 0, 'x');
    edited = editListItem(edited, 'search_terms', 2, 'B');
    edited = removeListItem(edited, 'search_terms', 3);
    edited = addListItem(edited, 'search_terms', 3, 'y');
    edited = addListItem(edited, 'search_terms', 5, 'z');
    expect(matchEditorView(edited).structure.searchTerms.items.map((item) => item.text)).toEqual([
      'x',
      'a',
      'B',
      'y',
      'd',
      'z'
    ]);
    const draft = sent(edited);
    expect(draft.search_terms).toEqual([{ index: 1, value: { Set: 'B' } }]);
    expect(draft.sequences).toEqual([
      { RemoveItem: { field: 'search_terms', index: 2 } },
      { InsertItems: { field: 'search_terms', at: { Front: {} }, items: ['x'] } },
      // Above `d` (index 3): after the removed `c`, so it never lands on a removal.
      { InsertItems: { field: 'search_terms', at: { After: { index: 2 } }, items: ['y'] } },
      { InsertItems: { field: 'search_terms', at: { End: {} }, items: ['z'] } }
    ]);
    expect(matchEditorView(edited).structure.searchTerms.removed).toEqual([{ origin: 2, text: 'c' }]);
  });

  it('refuses to remove the last item, and withholds a list whose every item was replaced', () => {
    const one = session(projection({ searchTerms: ['only'] }));
    expect(removeListItem(one, 'search_terms', 0)).toBe(one);
    expect(matchEditorView(one).structure.searchTerms.canRemoveItem).toBe(false);
    const replaced = removeListItem(addListItem(one, 'search_terms', 1, 'new'), 'search_terms', 0);
    expect(matchEditorView(replaced).saveWithheld).toBe('listEveryItemReplaced');
    expect(canSave(replaced)).toBe(false);
    expect(begin(replaced)).toBeNull();
  });

  it('refuses a hand-built list whose kept items are out of the file’s order', () => {
    const held = session(projection({ searchTerms: ['a', 'b'] }));
    const buffers: MatchBuffers = {
      ...held.draft.value,
      searchTerms: {
        present: true,
        items: [
          { origin: 1, text: 'b' },
          { origin: 0, text: 'a' }
        ]
      }
    };
    const reordered = forged(held, buffers);
    expect(matchEditorView(reordered).saveWithheld).toBe('listNotInOrder');
    expect(canSave(reordered)).toBe(false);
    expect(begin(reordered)).toBeNull();
  });

  it('undoes an addition as one step', () => {
    const held = session(projection({ searchTerms: ['a'] }));
    const added = addListItem(held, 'search_terms', 1, 'b');
    expect(isDirty(added.draft)).toBe(true);
    expect(isDirty(undoEdit(added).draft)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// A failed regex keeps the draft; the finding is Rust's
// ---------------------------------------------------------------------------

describe('a regex is validated by Rust, never by a JavaScript RegExp', () => {
  it('sends a pattern that does not compile, and keeps the draft when Rust refuses it', () => {
    const held = editRegex(session(regexed('^a')), '(unclosed');
    expect(matchEditorView(held).structure.trigger.regex).toMatchObject({
      text: '(unclosed',
      editable: true,
      refusal: null
    });
    // Nothing here compiled it: the save goes out and the verdict is Rust's.
    const started = begin(held)!;
    expect(started.draft.regex).toEqual({ Set: '(unclosed' });
    const refused: SaveResult = {
      outcome: 'refused',
      verdict: 'RefusedForEditorModelErrors',
      findings: [
        {
          code: { RegexDoesNotCompile: { detail: 'regex parse error' } },
          span: null,
          node: null,
          path: null
        }
      ]
    };
    const answered = applySave(started.session, refused, NOT_OWED, () => started.session);
    expect(answered.outcome?.kind).toBe('refused');
    expect(answered.draft.value.triggerSide.regex.text).toBe('(unclosed');
    expect(isDirty(answered.draft)).toBe(true);
    expect(answered.needsReprojection).toBe(false);
  });

  it('holds no RegExp anywhere in the model that drafts a pattern', () => {
    for (const file of ['matchEditor.ts', 'matchLists.ts']) {
      const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
      expect(source.includes('new RegExp'), file).toBe(false);
      expect(/\bRegExp\(/.test(source), file).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Multiple→single never silently drops an alias
// ---------------------------------------------------------------------------

describe('changing the trigger form', () => {
  it('refuses multiple→single for a longer list, by count, and never drafts it', () => {
    const held = session(listed([':one', ':two', ':three']));
    const choices = triggerFormChoices(held);
    expect(choices).toEqual([
      {
        to: 'trigger',
        label: 'trigger',
        offered: false,
        refusal: { kind: 'wouldDropAliases', count: 3 }
      },
      { to: 'regex', label: 'regex', offered: false, refusal: { kind: 'wouldDropAliases', count: 3 } }
    ]);
    expect(chooseTriggerForm(held, 'trigger')).toBe(held);
    // A hand-built draft of the same thing is not sent either.
    const buffers: MatchBuffers = {
      ...held.draft.value,
      trigger: { text: ':one', removed: false },
      triggerSide: { ...held.draft.value.triggerSide, form: 'trigger', confirmed: true }
    };
    const smuggled = forged(held, buffers);
    expect(matchEditorView(smuggled).saveWithheld).toBe('triggerFormNotOffered');
    expect(begin(smuggled)).toBeNull();
    expect(matchDraftOf(smuggled.baseline, smuggled.draft.value).trigger_form).toBeNull();
  });

  it('converts a one-item block list to a single trigger, after a confirmation', () => {
    const held = session(listed([':only']));
    const chosen = chooseTriggerForm(held, 'trigger');
    expect(chosen.draft.value.trigger.text).toBe(':only');
    expect(isFieldEditable(chosen, 'trigger')).toBe(true);
    const view = matchEditorView(chosen);
    expect(view.structure.trigger.preview).toMatchObject({
      from: 'triggers',
      to: 'trigger',
      texts: [':only'],
      confirmed: false
    });
    expect(view.saveWithheld).toBe('triggerFormUnconfirmed');
    expect(begin(chosen)).toBeNull();
    const confirmed = confirmTriggerForm(chosen);
    const draft = sent(confirmed);
    expect(draft.trigger_form).toEqual({
      Switch: { switch: { FromList: { to: 'trigger', value: ':only' } } }
    });
    expect(draft.trigger).toBe('Unchanged');
    expect(draft.triggers).toEqual([]);
    expect(draft.sequences).toEqual([]);
    // Undo takes the confirmation back, then the switch.
    expect(undoEdit(confirmed).draft.value.triggerSide.confirmed).toBe(false);
  });

  it('refuses the switch for a flow list and for a list with unsaved edits', () => {
    const flow = listed([':only']);
    const held = session({
      ...flow,
      trigger: {
        ...flow.trigger,
        triggers_presence: { Items: { location: NOWHERE, flow: true, count: 1 } }
      }
    });
    expect(triggerFormChoices(held)[0]).toMatchObject({ offered: false, refusal: { kind: 'flowList' } });
    const edited = addListItem(session(listed([':only'])), 'triggers', 1, ':two');
    expect(triggerFormChoices(edited)[0]).toMatchObject({
      offered: false,
      refusal: { kind: 'listEdited' }
    });
  });

  it('turns a single trigger into a list holding it first, and keeps every alias added', () => {
    const chosen = chooseTriggerForm(session(), 'triggers');
    expect(chosen.draft.value.triggerSide.triggers.items).toEqual([{ origin: null, text: ':a' }]);
    const aliased = confirmTriggerForm(addListItem(chosen, 'triggers', 1, ':alias'));
    expect(sent(aliased).trigger_form).toEqual({
      Switch: { switch: { ToList: { from: 'trigger', items: [':a', ':alias'] } } }
    });
  });

  it('renames trigger↔regex in place, keeping the bytes unless the text changed', () => {
    const kept = confirmTriggerForm(chooseTriggerForm(session(), 'regex'));
    expect(sent(kept)).toMatchObject({
      trigger_form: { Rename: { from: 'trigger' } },
      trigger: 'Unchanged',
      regex: 'Unchanged'
    });
    const retyped = confirmTriggerForm(editRegex(chooseTriggerForm(session(), 'regex'), '^a$'));
    expect(sent(retyped).regex).toEqual({ Set: '^a$' });
    const back = confirmTriggerForm(chooseTriggerForm(session(regexed('^x')), 'trigger'));
    expect(sent(back)).toMatchObject({ trigger_form: { Rename: { from: 'regex' } }, trigger: 'Unchanged' });
  });

  it('gives everything back when the change is cancelled', () => {
    const held = session();
    const chosen = editRegex(chooseTriggerForm(held, 'regex'), '^z');
    const cancelled = cancelTriggerForm(chosen);
    expect(cancelled.draft.value.triggerSide.form).toBe('trigger');
    expect(cancelled.draft.value.trigger.text).toBe(':a');
    expect(isDirty(cancelled.draft)).toBe(false);
  });

  it('never removes the only trigger form', () => {
    const held = session();
    expect(removeField(held, 'trigger')).toBe(held);
    expect(matchEditorView(held).fields.find((one) => one.field === 'trigger')?.canRemove).toBe(false);
    const list = session(listed([':one', ':two']));
    expect(removeList(list, 'triggers')).toBe(list);
  });
});

// ---------------------------------------------------------------------------
// Several and Absent, as model values
// ---------------------------------------------------------------------------

describe('the Several and Absent presentations', () => {
  it('shows every form of a Several in file order, picks none, and offers raw repair', () => {
    const match = projection({ trigger: ':a', regex: '^b', triggerKind: 'Several' });
    const spec = match.trigger;
    const several = session({
      ...match,
      trigger: { ...spec, regex: { ...spec.regex!, span: { start: 1, end: 3 } }, trigger: { ...spec.trigger!, span: { start: 5, end: 7 } } }
    });
    const view = matchEditorView(several).structure.trigger;
    expect(view.presentation).toEqual({ kind: 'several', forms: ['regex', 'trigger'], repair: 'rawDocument' });
    expect(view.choices).toEqual([]);
    expect(view.regex.editable).toBe(false);
    expect(isFieldEditable(several, 'trigger')).toBe(false);
    expect(editField(several, 'trigger', ':z')).toBe(several);
    expect(editRegex(several, '^z')).toBe(several);
    expect(sent(editField(session(projection({ label: 'x' })), 'label', 'y')).trigger_form).toBeNull();
  });

  it('offers an explicit Add trigger for Absent, with no confirmation and no blank write', () => {
    const absent = session(projection({ trigger: null, triggerKind: 'Absent' }));
    const view = matchEditorView(absent).structure.trigger;
    expect(view.presentation).toEqual({ kind: 'absent' });
    expect(view.choices.map((one) => one.to)).toEqual(['trigger', 'regex', 'triggers']);
    const chosen = chooseTriggerForm(absent, 'trigger');
    expect(matchEditorView(chosen).saveWithheld).toBe('triggerFormEmpty');
    const typed = editField(chosen, 'trigger', ':new');
    expect(sent(typed)).toMatchObject({ trigger: { Set: ':new' }, trigger_form: null });
    const list = addListItem(chooseTriggerForm(absent, 'triggers'), 'triggers', 0, ':one');
    expect(sent(list).sequences).toEqual([{ InsertField: { field: 'triggers', items: [':one'] } }]);
  });
});

// ---------------------------------------------------------------------------
// Conservative list reapply (ruling 23)
// ---------------------------------------------------------------------------

describe('reapply of a drafted list is conservative', () => {
  const was = session(projection({ searchTerms: ['a', 'b', 'c'] }));
  const drafted = addListItem(was, 'search_terms', 3, 'd');

  it('applies over an unchanged list and is satisfied by the whole intended result', () => {
    const same = planMatchReapply(
      drafted.baseline,
      drafted.draft.value,
      baselineOf(projection({ searchTerms: ['a', 'b', 'c'] }, AFTER))
    );
    expect(same.searchTerms).toBe('applicable');
    expect(same.writesAnything).toBe(true);
    expect(same.buffers.searchTerms.items.map((item) => item.text)).toEqual(['a', 'b', 'c', 'd']);
    const done = planMatchReapply(
      drafted.baseline,
      drafted.draft.value,
      baselineOf(projection({ searchTerms: ['a', 'b', 'c', 'd'] }, AFTER))
    );
    expect(done.searchTerms).toBe('satisfied');
    expect(done.collisions).toEqual([]);
  });

  it('collides the whole list on an external reorder, a duplicate or a repeated key', () => {
    for (const now of [
      projection({ searchTerms: ['b', 'a', 'c'] }, AFTER),
      projection({ searchTerms: ['a', 'b', 'b', 'c'] }, AFTER),
      projection(
        {
          searchTerms: ['a', 'b', 'c'],
          unknownEntries: [
            REPEATED_TERMS
          ]
        },
        AFTER
      )
    ]) {
      const plan = planMatchReapply(drafted.baseline, drafted.draft.value, baselineOf(now));
      expect(plan.searchTerms).toBe('collision');
      expect(plan.collisions).toEqual(['search_terms']);
    } // End of the loop over the three disk shapes
  });

  it('collides a whole change of trigger form when the disk moved the trigger side', () => {
    const switched = confirmTriggerForm(chooseTriggerForm(session(), 'triggers'));
    const moved = planMatchReapply(switched.baseline, switched.draft.value, baselineOf(projection({ trigger: ':other' }, AFTER)));
    expect(moved.triggerSide).toMatchObject({ verdict: 'collision', compound: true });
    expect(moved.collisions).toEqual(['trigger', 'triggers']);
    const unmoved = planMatchReapply(switched.baseline, switched.draft.value, baselineOf(projection({}, AFTER)));
    expect(unmoved.triggerSide.verdict).toBe('applicable');
    expect(unmoved.buffers.triggerSide.form).toBe('triggers');
  });

  it('collides the triggers list on an external reorder', () => {
    const held = removeListItem(session(listed([':x', ':y', ':z'])), 'triggers', 2);
    const plan = planMatchReapply(held.baseline, held.draft.value, baselineOf(listed([':y', ':x', ':z'], AFTER)));
    expect(plan.collisions).toEqual(['triggers']);
  });
});

// ---------------------------------------------------------------------------
// Conflict compare and copy
// ---------------------------------------------------------------------------

describe('a conflict retains and copies the drafted lists and form', () => {
  it('lists the drafted items with their status, and nothing for an untouched list', () => {
    const untouched = matchEditorView(conflicted(editField(session(projection({ searchTerms: ['a'] })), 'label', 'x')));
    expect(untouched.retainedDraft.some((row) => row.label === 'searchTerms')).toBe(false);
    const edited = removeListItem(
      addListItem(session(projection({ searchTerms: ['a', 'b'] })), 'search_terms', 2, 'c'),
      'search_terms',
      0
    );
    const view = matchEditorView(conflicted(edited));
    expect(view.retainedDraft.filter((row) => row.label === 'searchTerms')).toEqual([
      { label: 'searchTerms', text: 'b', status: 'unchanged' },
      { label: 'searchTerms', text: 'c', status: 'itemAdded' },
      { label: 'searchTerms', text: 'a', status: 'itemRemoved' }
    ]);
    const switched = matchEditorView(conflicted(confirmTriggerForm(chooseTriggerForm(session(), 'regex'))));
    expect(switched.retainedDraft.find((row) => row.label === 'trigger')?.status).toBe('triggerFormAway');
    expect(switched.retainedDraft.find((row) => row.label === 'regex')).toEqual({
      label: 'regex',
      text: ':a',
      status: 'triggerFormTo'
    });
  });
});

// ---------------------------------------------------------------------------
// Recovery transfers everything or refuses explicitly
// ---------------------------------------------------------------------------

describe('recovery carries the trigger form and search_terms whole, or not at all', () => {
  it('carries a drafted triggers list and search_terms whole, in order', () => {
    const held = addListItem(
      addList(addListItem(session(listed([':one', ':two'])), 'triggers', 2, ':three'), 'search_terms'),
      'search_terms',
      0,
      'term'
    );
    const buffers = held.draft.value;
    const structure = structureTransferOfMatchDraft(held.baseline, buffers);
    expect(structure).toEqual({
      trigger: { form: 'triggers', items: [':one', ':two', ':three'] },
      searchTerms: { kind: 'carried', items: ['term'] }
    });
    const transfer = transferOfMatchDraft(held.baseline, buffers);
    expect(transfer.trigger).toEqual({ kind: 'notCarried', reason: { kind: 'triggerFormCarried' } });
    expect(newMatchOfRecovery(transfer, { trigger: '', replace: 'b', options: NO_CREATION_OPTIONS }, structure)).toMatchObject({
      trigger: { Multiple: [':one', ':two', ':three'] },
      search_terms: ['term']
    });
  });

  it('refuses a list it cannot carry whole, by name, and carries none of it', () => {
    const match = projection({ searchTerms: ['a'] });
    const unreadable = session({ ...match, search_terms: [scalarItem('a'), { Alias: { span: { start: 0, end: 1 }, node: 0 } }] });
    expect(matchEditorView(unreadable).structure.searchTerms.refusal).toBe('itemNotText');
    expect(structureTransferOfMatchDraft(unreadable.baseline, unreadable.draft.value).searchTerms).toEqual({
      kind: 'notCarried',
      reason: { kind: 'listNotEditable', reason: 'itemNotText' }
    });
    const removed = removeList(session(match), 'search_terms');
    expect(structureTransferOfMatchDraft(removed.baseline, removed.draft.value).searchTerms).toEqual({
      kind: 'notCarried',
      reason: { kind: 'removedByTheDraft' }
    });
  });

  it('writes a recovered snippet with the carried form through the form’s own create', () => {
    const held = editRegex(session(regexed('^a')), '^b');
    const stuck = conflicted(held);
    const start = startMatchFieldRecovery(
      { kind: 'manualResolution', obstacle: { kind: 'evidenceNotATarget' } },
      conflictOf(stuck),
      stuck.baseline,
      [makeSummary({ id: 2, relativePath: 'match/base.yml' })],
      [diskFile()],
      () => 0
    );
    if (start.kind !== 'ready') {
      throw new Error(`recovery did not open: ${start.reason}`);
    }
    expect(recoveryView(start.session)).toMatchObject({ triggerForm: 'regex', trigger: '^b' });
    const created = beginRecoveryCreate(start.session, () => start.session);
    expect(created?.newMatch.trigger).toEqual({ Regex: '^b' });

    const listedStart = startMatchFieldRecovery(
      { kind: 'manualResolution', obstacle: { kind: 'evidenceNotATarget' } },
      conflictOf(conflicted(addListItem(session(listed([':x'])), 'triggers', 1, ':y'))),
      baselineOf(listed([':x'])),
      [makeSummary({ id: 2, relativePath: 'match/base.yml' })],
      [diskFile()],
      () => 0
    );
    if (listedStart.kind !== 'ready') {
      throw new Error('recovery did not open');
    }
    const form = listedStart.session;
    expect(recoveryView(form)).toMatchObject({ triggerForm: 'triggers', triggerItems: [':x', ':y'], triggerEditable: false });
    expect(editRecoveryField(form, 'trigger', ':typed')).toBe(form);
    expect(beginRecoveryCreate(form, () => form)?.newMatch.trigger).toEqual({ Multiple: [':x', ':y'] });
  });
});

// ---------------------------------------------------------------------------
// The carriage return, at all three gates, for every new control
// ---------------------------------------------------------------------------

describe('a carriage return or a line feed is refused for every new control', () => {
  it('at eligibility: a regex or an item holding one is read-only', () => {
    expect(matchEditorView(session(regexed('a\rb'))).structure.trigger.regex).toMatchObject({
      editable: false,
      refusal: 'carriageReturn'
    });
    expect(matchEditorView(session(regexed('a\nb'))).structure.trigger.regex.refusal).toBe('lineBreak');
    expect(matchEditorView(session(projection({ searchTerms: ['a\rb'] }))).structure.searchTerms).toMatchObject({
      editable: false,
      refusal: 'carriageReturn'
    });
    expect(matchEditorView(session(listed([':a', 'x\ny']))).structure.trigger.triggers.refusal).toBe('lineBreak');
  });

  it('at the transitions: the regex box, an item edit and an added item refuse one', () => {
    const regex = session(regexed('^a'));
    expect(editRegex(regex, 'a\rb')).toBe(regex);
    expect(editRegex(regex, 'a\nb')).toBe(regex);
    const terms = session(projection({ searchTerms: ['a'] }));
    expect(editListItem(terms, 'search_terms', 0, 'a\rb')).toBe(terms);
    expect(addListItem(terms, 'search_terms', 1, 'a\rb')).toBe(terms);
    expect(addListItem(terms, 'search_terms', 1, 'a\nb')).toBe(terms);
  });

  it('at beginSave: a hand-built buffer carrying one sends nothing', () => {
    const regex = session(regexed('^a'));
    const cases: MatchBuffers[] = [
      {
        ...regex.draft.value,
        triggerSide: { ...regex.draft.value.triggerSide, regex: { text: 'a\rb', removed: false } }
      }
    ];
    const terms = session(projection({ searchTerms: ['a'] }));
    cases.push({
      ...terms.draft.value,
      searchTerms: { present: true, items: [{ origin: 0, text: 'a\rb' }] }
    });
    cases.push({
      ...terms.draft.value,
      searchTerms: {
        present: true,
        items: [
          { origin: 0, text: 'a' },
          { origin: null, text: 'x\ny' }
        ]
      }
    });
    const single = session();
    cases.push({
      ...single.draft.value,
      triggerSide: {
        ...single.draft.value.triggerSide,
        form: 'triggers',
        confirmed: true,
        triggers: { present: true, items: [{ origin: null, text: 'p\rq' }] }
      }
    });
    for (const [index, buffers] of cases.entries()) {
      const base = index === 0 ? regex : index === 3 ? single : terms;
      const smuggled = forged(base, buffers);
      expect(begin(smuggled), `case ${index}`).toBeNull();
    } // End of the loop over the forged buffers
  });
});

// ---------------------------------------------------------------------------
// The dictionary keys the new codes need
// ---------------------------------------------------------------------------

describe('every new code has a sentence in both languages', () => {
  it('names a key for each code, present and non-empty in EN and ES, placeholders agreeing', () => {
    const withheld: readonly SaveWithheld[] = [
      'triggerFormUnconfirmed',
      'triggerFormEmpty',
      'triggerFormNotOffered',
      'listNotInOrder',
      'listEveryItemReplaced',
      'listWouldBeEmpty'
    ];
    const lists: readonly ListRefusal[] = [
      'unsupportedShape',
      'unmodelledShape',
      'itemNotText',
      'itemNotDecodable',
      'carriageReturn',
      'lineBreak',
      'ownsNoBytes'
    ];
    const refusals: readonly TriggerFormRefusal[] = [
      { kind: 'wouldDropAliases', count: 2 },
      { kind: 'flowList' },
      { kind: 'listEdited' },
      { kind: 'notEditable' }
    ];
    const keys = [
      ...withheld.map(saveWithheldKey),
      ...lists.map(listRefusalKey),
      ...refusals.map(triggerFormRefusalKey),
      triggerPresentationKey({ kind: 'several', forms: ['trigger'], repair: 'rawDocument' })!,
      triggerPresentationKey({ kind: 'absent' })!,
      triggerRepairKey('rawDocument'),
      transferRefusalKey({ kind: 'triggerFormCarried' }),
      transferRefusalKey({ kind: 'listNotEditable', reason: 'itemNotText' }),
      'browser.saveOutcome.field.itemAdded' as const,
      'browser.saveOutcome.field.itemRemoved' as const,
      'browser.saveOutcome.field.triggerFormAway' as const,
      'browser.saveOutcome.field.triggerFormTo' as const
    ];
    expect(new Set(keys).size).toBe(keys.length);
    for (const locale of LOCALES) {
      for (const key of keys) {
        expect(DICTIONARIES[locale][key].length, `${locale} ${key}`).toBeGreaterThan(0);
      }
    } // End of the loop over the locales
    const aliases = triggerFormRefusalKey({ kind: 'wouldDropAliases', count: 2 });
    for (const locale of LOCALES) {
      expect(DICTIONARIES[locale][aliases]).toContain('{count}');
    }
    expect(triggerPresentationKey({ kind: 'form', form: 'trigger' })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The committed baseline and the untouched snippet
// ---------------------------------------------------------------------------

describe('what does not change', () => {
  it('sends nothing about lists or forms for a draft that touched neither', () => {
    const draft = sent(editField(session(listed([':x', ':y'])), 'label', 'named'));
    expect(draft).toMatchObject({ trigger_form: null, sequences: [], triggers: [], search_terms: [], regex: 'Unchanged' });
    expect(buffersOf(baselineOf(listed([':x']))).triggerSide.form).toBe('triggers');
  });

  it('moves the trigger side to what a committed switch wrote', () => {
    const switched = confirmTriggerForm(chooseTriggerForm(session(), 'regex'));
    const started = begin(switched)!;
    const done = applySave(started.session, committed(), ADOPTED, () => started.session);
    expect(done.baseline.structure.trigger).toMatchObject({ kind: 'Regex', form: 'regex' });
    expect(done.baseline.structure.trigger.regex).toMatchObject({ present: true, value: ':a' });
    expect(done.baseline.trigger).toMatchObject({ present: false, value: '' });
    expect(done.needsReprojection).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Review fixes (docs/reviews/phase-3-6-1.md)
// ---------------------------------------------------------------------------

describe('review fix: a drafted list is never dropped by re-pointing the form', () => {
  it('refuses trigger → triggers + alias → regex, keeping every drafted item', () => {
    const drafted = addListItem(chooseTriggerForm(session(), 'triggers'), 'triggers', 1, ':alias');
    const regexChoice = triggerFormChoices(drafted).find((one) => one.to === 'regex');
    expect(regexChoice).toMatchObject({ offered: false, refusal: { kind: 'wouldDropAliases', count: 2 } });
    const repointed = confirmTriggerForm(chooseTriggerForm(drafted, 'regex'));
    expect(repointed.draft.value.triggerSide.form).toBe('triggers');
    expect(repointed.draft.value.triggerSide.triggers.items.map((item) => item.text)).toEqual([':a', ':alias']);
    expect(sent(repointed).trigger_form).toEqual({
      Switch: { switch: { ToList: { from: 'trigger', items: [':a', ':alias'] } } }
    });
  });

  it('refuses choosing the held literal back over drafted additions', () => {
    const drafted = addListItem(chooseTriggerForm(session(), 'triggers'), 'triggers', 1, ':alias');
    expect(chooseTriggerForm(drafted, 'trigger')).toBe(drafted);
  });

  it('refuses a scalar form over a list drafted onto a snippet with no trigger', () => {
    const absent = session(projection({ trigger: null, triggerKind: 'Absent' }));
    const listed2 = addListItem(
      addListItem(chooseTriggerForm(absent, 'triggers'), 'triggers', 0, ':one'),
      'triggers',
      1,
      ':two'
    );
    expect(triggerFormChoices(listed2).find((one) => one.to === 'trigger')).toMatchObject({
      offered: false,
      refusal: { kind: 'wouldDropAliases', count: 2 }
    });
    expect(chooseTriggerForm(listed2, 'trigger')).toBe(listed2);
  });

  it('still re-points a drafted list of one item, carrying that item', () => {
    const one = chooseTriggerForm(chooseTriggerForm(session(), 'triggers'), 'regex');
    expect(one.draft.value.triggerSide.form).toBe('regex');
    expect(one.draft.value.triggerSide.regex.text).toBe(':a');
  });
});

describe('review fix: flow-list insertions never overlap a removal', () => {
  it('rewrites a removed item in place when a new one takes its position', () => {
    const held = session(flowTerms(['a', 'b', 'c']));
    const edited = addListItem(removeListItem(held, 'search_terms', 1), 'search_terms', 1, 'new');
    const draft = sent(edited);
    expect(draft.search_terms).toEqual([{ index: 1, value: { Set: 'new' } }]);
    expect(draft.sequences).toEqual([]);
  });

  it('pairs in order, removes the rest, and inserts the rest after the last rewritten item', () => {
    const held = session(flowTerms(['a', 'b', 'c', 'd']));
    // Drafted: a x y d — `b` and `c` removed, two new items in their gap.
    let edited = removeListItem(removeListItem(held, 'search_terms', 1), 'search_terms', 1);
    edited = addListItem(addListItem(edited, 'search_terms', 1, 'x'), 'search_terms', 2, 'y');
    expect(sent(edited)).toMatchObject({
      search_terms: [
        { index: 1, value: { Set: 'x' } },
        { index: 2, value: { Set: 'y' } }
      ],
      sequences: []
    });
    const more = addListItem(edited, 'search_terms', 3, 'z');
    expect(sent(more).sequences).toEqual([
      { InsertItems: { field: 'search_terms', at: { After: { index: 2 } }, items: ['z'] } }
    ]);
    const fewer = removeListItem(edited, 'search_terms', 2);
    expect(sent(fewer)).toMatchObject({
      search_terms: [{ index: 1, value: { Set: 'x' } }],
      sequences: [{ RemoveItem: { field: 'search_terms', index: 2 } }]
    });
  });

  it('keeps the block-list placement, which Rust plans with disjoint spans', () => {
    const held = session(projection({ searchTerms: ['a', 'b', 'c'] }));
    const edited = addListItem(removeListItem(held, 'search_terms', 1), 'search_terms', 1, 'new');
    expect(sent(edited).sequences).toEqual([
      { RemoveItem: { field: 'search_terms', index: 1 } },
      { InsertItems: { field: 'search_terms', at: { After: { index: 1 } }, items: ['new'] } }
    ]);
  });
});

// ---------------------------------------------------------------------------
// Phase 3-6-2: the values the components draw
// ---------------------------------------------------------------------------

describe('the trigger side names its one control and its withdrawal (Phase 3-6-2)', () => {
  it('draws the held form’s control, the held forms of a Several, and nothing for an Absent', () => {
    const control = (match: MatchView): string => matchEditorView(session(match)).structure.trigger.control;
    expect(control(projection())).toBe('literal');
    expect(control(regexed('^a'))).toBe('regex');
    expect(control(listed([':a', ':b']))).toBe('triggers');
    expect(control(projection({ trigger: ':a', regex: '^b', triggerKind: 'Several' }))).toBe('heldForms');
    expect(control(projection({ trigger: null, triggerKind: 'Absent' }))).toBe('none');
    for (const match of [projection(), regexed('^a'), listed([':a'])]) {
      expect(matchEditorView(session(match)).structure.trigger.withdrawal).toBeNull();
    } // End of the loop over the held forms
  });

  it('follows the drafted form, and calls withdrawing a change or an addition', () => {
    const changed = chooseTriggerForm(session(), 'triggers');
    expect(matchEditorView(changed).structure.trigger).toMatchObject({
      control: 'triggers',
      withdrawal: 'change'
    });
    const added = chooseTriggerForm(session(projection({ trigger: null, triggerKind: 'Absent' })), 'regex');
    expect(matchEditorView(added).structure.trigger).toMatchObject({
      control: 'regex',
      withdrawal: 'addition'
    });
    const literal = chooseTriggerForm(session(regexed('^a')), 'trigger');
    expect(matchEditorView(literal).structure.trigger.control).toBe('literal');
    expect(matchEditorView(cancelTriggerForm(literal)).structure.trigger.withdrawal).toBeNull();
  });

  it('never says a blank literal trigger “writes nothing” when it is a destination or an addition', () => {
    const added = chooseTriggerForm(session(projection({ trigger: null, triggerKind: 'Absent' })), 'trigger');
    const literal = matchEditorView(added).fields.find((one) => one.field === 'trigger');
    expect(literal).toMatchObject({ editable: true, present: false, saysAbsent: false });
    // A key that is not the literal trigger keeps its sentence.
    expect(matchEditorView(added).fields.find((one) => one.field === 'label')?.saysAbsent).toBe(true);
  });

  it('names the choice by the presentation, and the preview’s text by what is written', () => {
    expect(triggerFormChoiceKey({ kind: 'absent' })).toBe('browser.matchEditor.triggerForm.add');
    expect(triggerFormChoiceKey({ kind: 'form', form: 'trigger' })).toBe(
      'browser.matchEditor.triggerForm.to'
    );
    const kept = matchEditorView(chooseTriggerForm(session(), 'regex')).structure.trigger.preview;
    expect(kept === null ? null : triggerFormTextNoteKey(kept)).toBe(
      'browser.matchEditor.triggerForm.textKept'
    );
    const edited = matchEditorView(editRegex(chooseTriggerForm(session(), 'regex'), '^z')).structure
      .trigger.preview;
    expect(edited === null ? null : triggerFormTextNoteKey(edited)).toBe(
      'browser.matchEditor.triggerForm.textEdited'
    );
    // A list is never said to keep the file's text: the scalar becomes a new item.
    const list = matchEditorView(chooseTriggerForm(session(), 'triggers')).structure.trigger.preview;
    expect(list === null ? null : triggerFormTextNoteKey(list)).toBe(
      'browser.matchEditor.triggerForm.listHolds'
    );
  });
});

describe('a list model says what a screen owes beside it (Phase 3-6-2)', () => {
  it('shows a read-only list’s items, naming one that is not text, and an editable one’s not at all', () => {
    const base = listed([':r1']);
    const withCollection: MatchView = {
      ...base,
      trigger: { ...base.trigger, triggers: [...base.trigger.triggers, { Sequence: [] }] }
    };
    const refused = matchEditorView(session(withCollection)).structure.trigger.triggers;
    expect(refused.refusal).toBe('itemNotText');
    expect(refused.shown).toEqual([
      { kind: 'text', text: ':r1' },
      { kind: 'notScalar', shape: 'Sequence' }
    ]);
    expect(matchEditorView(session(listed([':a']))).structure.trigger.triggers.shown).toEqual([]);
  });

  it('says absent, empty, being removed and the last item kept, each only when true', () => {
    const none = matchEditorView(session()).structure.searchTerms;
    expect(none).toMatchObject({ saysAbsent: true, saysEmpty: false, removing: false, lastItemKept: false });
    const added = matchEditorView(addList(session(), 'search_terms')).structure.searchTerms;
    expect(added).toMatchObject({ saysAbsent: false, saysEmpty: true, removing: false });
    const one = session(projection({ searchTerms: ['alpha'] }));
    expect(matchEditorView(one).structure.searchTerms).toMatchObject({
      saysAbsent: false,
      lastItemKept: true,
      canRemoveItem: false
    });
    expect(matchEditorView(addListItem(one, 'search_terms', 1, 'beta')).structure.searchTerms).toMatchObject({
      lastItemKept: false,
      canRemoveItem: true
    });
    const gone = matchEditorView(removeList(one, 'search_terms')).structure.searchTerms;
    expect(gone).toMatchObject({ removing: true, saysAbsent: false, present: false });
    // Review fix: a list the draft takes out has no writable items.
    expect(matchEditorView(one).structure.searchTerms.itemsEditable).toBe(true);
    expect(gone.itemsEditable).toBe(false);
  });

  it('owes a style note for a block or a flow list only, and a marker for a changed item only', () => {
    const notes: Record<ListStyle, string | null> = {
      absent: null,
      empty: null,
      block: 'browser.matchEditor.list.style.block',
      flow: 'browser.matchEditor.list.style.flow',
      unsupported: null
    };
    for (const [style, key] of Object.entries(notes) as [ListStyle, string | null][]) {
      expect(listStyleNoteKey(style), style).toBe(key);
    } // End of the loop over the list styles
    const markers: Record<ListItemStatus, string | null> = {
      kept: null,
      edited: 'browser.matchEditor.list.item.edited',
      added: 'browser.matchEditor.list.item.added'
    };
    for (const [status, key] of Object.entries(markers) as [ListItemStatus, string | null][]) {
      expect(listItemStatusKey(status), status).toBe(key);
    } // End of the loop over the item statuses
  });

  it('has a sentence, in both languages, for every key the new values name', () => {
    const keys = [
      triggerFormChoiceKey({ kind: 'absent' }),
      triggerFormChoiceKey({ kind: 'form', form: 'regex' }),
      triggerWithdrawalKey('change'),
      triggerWithdrawalKey('addition'),
      'browser.matchEditor.triggerForm.textKept',
      'browser.matchEditor.triggerForm.textEdited',
      'browser.matchEditor.triggerForm.listHolds',
      'browser.matchEditor.list.style.block',
      'browser.matchEditor.list.style.flow',
      'browser.matchEditor.list.item.added',
      'browser.matchEditor.list.item.edited'
    ] as const;
    for (const lang of LOCALES) {
      for (const key of keys) {
        expect(DICTIONARIES[lang][key], `${lang} ${key}`).toBeTruthy();
      } // End of the loop over the keys
      expect(DICTIONARIES[lang][triggerFormChoiceKey({ kind: 'absent' })]).toContain('{form}');
    } // End of the loop over the languages
  });
});
