/**
 * Phase 3-5-1 — every eligible scalar field in the editor model, the content
 * switch, the cursor action and the option suggestions, driven without a screen.
 *
 * One `describe` per path ruling 23 of `docs/decisions/3-split-notes.md` names —
 * save, conflict compare and copy, reapply, recovery — each walking **every
 * field this phase made editable**, so a field that one path forgets fails here
 * by name. Then the three things drafted beside the fields: the content switch,
 * the `$|$` action for `replace`, and the exact-string suggestions.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { describe, expect, it } from 'vitest';
import { DICTIONARIES, translate } from '../i18n/dictionaries';
import { LOCALES } from '../i18n/locale';
import type {
  ContentForm,
  ContentRevision,
  MatchDraft,
  MatchId,
  MatchView,
  SaveResult
} from '../ipc/types';
import { editDraft, isDirty } from './draft';
import { makeConflict, makeDocument, makeMatch } from './fixtures';
import type { InvalidationStatus } from './invalidation';
import {
  applySave,
  applySuggestion,
  baselineOf,
  beginSave,
  buffersOf,
  cancelContentSwitch,
  canSave,
  chooseContentSwitch,
  confirmContentSwitch,
  CONTENT_FIELDS,
  contentSwitchTargets,
  cursorAdvisoryKey,
  EDITABLE_FIELDS,
  editField,
  fieldControlOf,
  fieldEligibility,
  intentsOf,
  insertCursorPosition,
  isFieldEditable,
  matchDraftOf,
  matchEditorView,
  OPTION_FIELDS,
  OPTION_SUGGESTIONS,
  planMatchReapply,
  reapplyToDiskVersion,
  removeField,
  startMatchEditor,
  undoEdit,
  type EditableField,
  type MatchBuffers,
  type MatchEditorSession
} from './matchEditor';
import { newMatchOfRecovery, recoveryBodyFieldOf, transferOfMatchDraft } from './recovery';
import { tDraftCopy } from '../i18n';

/** The revision every projection below is minted from. */
const BASE: ContentRevision = 'a'.repeat(64);

/** The revision the file holds after a commit or an external change. */
const AFTER: ContentRevision = 'b'.repeat(64);

/** The identity a committed save answers with. */
const MOVED: MatchId = { document: 1, revision: AFTER, node: 1 };

/** The adoption a save that wrote nothing owes: none. */
const NOT_OWED: InvalidationStatus = { kind: 'notOwed' };

/** The adoption a committed save performed. */
const ADOPTED: InvalidationStatus = { kind: 'done' };

/**
 * The eleven fields Phase 3-5-1 made editable: four content keys, the comment and
 * the six options that were not editable before.
 */
const ADDED: readonly EditableField[] = [
  'markdown',
  'html',
  'image_path',
  'form',
  'comment',
  'propagate_case',
  'uppercase_style',
  'force_mode',
  'force_clipboard',
  'paragraph',
  'anchor'
];

/** The fields that are not content keys and so are edited without a switch. */
const PLAIN_ADDED: readonly EditableField[] = ADDED.filter(
  (field) => !(CONTENT_FIELDS as readonly EditableField[]).includes(field)
);

/**
 * A snippet overriding one field's projected text, by the fixture's own names.
 *
 * @param field - Which field.
 * @param text - Its projected text.
 * @returns The `makeMatch` overrides.
 */
function holding(field: EditableField, text: string): Parameters<typeof makeMatch>[0] {
  switch (field) {
    case 'trigger':
      return { trigger: text };
    case 'replace':
      return { replace: text };
    case 'markdown':
      return { replace: null, markdown: text };
    case 'html':
      return { replace: null, html: text };
    case 'image_path':
      return { replace: null, imagePath: text };
    case 'form':
      return { replace: null, form: text };
    case 'label':
      return { label: text };
    case 'comment':
      return { comment: text };
    default:
      return { options: { [field]: text } };
  }
} // End of function holding()

/**
 * A projection of one snippet: trigger `:a`, body `b`, plus whatever is asked.
 *
 * @param overrides - Whatever the case needs.
 * @param revision - The revision it is minted from.
 * @returns The projection.
 */
function projection(
  overrides: Parameters<typeof makeMatch>[0] = {},
  revision: ContentRevision = BASE
): MatchView {
  return makeMatch({ revision, trigger: ':a', replace: 'b', ...overrides });
} // End of function projection()

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
 * The draft a save of this session would send, or a thrown error.
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
 * A committed save's answer.
 *
 * @returns The wire result.
 */
function committed(): SaveResult {
  return { outcome: 'saved', revision: AFTER, committed: true, notes: [], backup_taken: false, moved: MOVED };
} // End of function committed()

/**
 * A session showing a save conflict over its edited draft.
 *
 * @param held - The edited session.
 * @param diskMatches - What the disk snapshot holds.
 * @returns The session showing the conflict.
 */
function conflicted(held: MatchEditorSession, diskMatches: readonly MatchView[] = []): MatchEditorSession {
  const started = begin(held);
  if (started === null) {
    throw new Error('this case needs a saveable session');
  }
  const disk = makeDocument({ revision: AFTER, matches: diskMatches });
  return applySave(
    started.session,
    makeConflict({ disk, expected: BASE, found: AFTER }),
    NOT_OWED,
    () => started.session
  );
} // End of function conflicted()

/**
 * A switch from `replace` to `to`, drafted and confirmed.
 *
 * @param to - The content key to switch to.
 * @param match - The projection.
 * @returns The session.
 */
function switched(to: ContentForm, match: MatchView = projection()): MatchEditorSession {
  return confirmContentSwitch(chooseContentSwitch(session(match), to));
} // End of function switched()

describe('every added field is in the model', () => {
  it('lists seventeen fields: the trigger, five content keys, label, comment and nine options', () => {
    expect(EDITABLE_FIELDS).toHaveLength(17);
    expect(OPTION_FIELDS).toHaveLength(9);
    for (const field of ADDED) {
      expect(EDITABLE_FIELDS).toContain(field);
    }
  });

  it('seeds each added field from the projection, and an absent one blank and absent', () => {
    for (const field of ADDED) {
      const present = baselineOf(projection(holding(field, 'value')))[field];
      expect(present, field).toMatchObject({ present: true, value: 'value' });
      expect(present.eligibility.kind, field).toBe('editable');
      const absent = baselineOf(projection())[field];
      expect(absent, field).toMatchObject({ present: false, value: '' });
    } // End of the loop over the added fields
  });

  it('draws the content keys and the comment in a multi-line control, the rest in one line', () => {
    for (const field of EDITABLE_FIELDS) {
      const multi = (CONTENT_FIELDS as readonly EditableField[]).includes(field) || field === 'comment';
      expect(fieldControlOf(field), field).toBe(multi ? 'multiLine' : 'singleLine');
    }
    expect(matchEditorView(session()).fields.map((one) => one.control)).toEqual(
      EDITABLE_FIELDS.map(fieldControlOf)
    );
  });
});

describe('an initially absent field left blank emits no key', () => {
  it('sends Unchanged for every added field nobody touched, and for one retyped blank', () => {
    const start = session();
    const draft = matchDraftOf(start.baseline, start.draft.value);
    for (const field of ADDED) {
      expect(draft[field], field).toBe('Unchanged');
    }
    // Typed into and cleared again: still absent and blank, still no key.
    for (const field of PLAIN_ADDED) {
      const back = editField(editField(start, field, 'x'), field, '');
      expect(matchDraftOf(back.baseline, back.draft.value)[field], field).toBe('Unchanged');
    } // End of the loop over the plain added fields
    expect(draft.content_switch).toBeNull();
  });

  it('sends Set for a typed absent field, Set("") for a cleared present one, Remove for a removal', () => {
    for (const field of PLAIN_ADDED) {
      const typed = editField(session(), field, 'typed');
      expect(sent(typed)[field], field).toEqual({ Set: 'typed' });
      const cleared = editField(session(projection(holding(field, 'was'))), field, '');
      expect(sent(cleared)[field], field).toEqual({ Set: '' });
      const removed = removeField(session(projection(holding(field, 'was'))), field);
      expect(sent(removed)[field], field).toBe('Remove');
    } // End of the loop over the plain added fields
  });
});

describe('the carriage return, at all three gates, for every added field', () => {
  it('is refused at eligibility', () => {
    for (const field of ADDED) {
      expect(fieldEligibility(projection(holding(field, 'a\rb')), field), field).toEqual({
        kind: 'readOnly',
        reason: 'carriageReturn'
      });
    }
  });

  it('is refused at editField', () => {
    for (const field of PLAIN_ADDED) {
      const start = session();
      expect(editField(start, field, 'a\rb'), field).toBe(start);
    }
    for (const field of CONTENT_FIELDS) {
      const start = session(projection(holding(field, 'body')));
      expect(editField(start, field, 'a\rb'), field).toBe(start);
    }
  });

  it('is refused at beginSave when the buffer was built by hand', () => {
    for (const field of ADDED) {
      const start = session(projection(holding(field, 'body')));
      const forged: MatchBuffers = { ...start.draft.value, [field]: { text: 'a\rb', removed: false } };
      const held = { ...start, draft: editDraft(start.draft, forged) };
      expect(isDirty(held.draft), field).toBe(true);
      expect(begin(held), field).toBeNull();
    } // End of the loop over the added fields
  });

  it('refuses a line feed in a one-line field at all three gates, and keeps it in a multi-line one', () => {
    expect(fieldEligibility(projection(holding('anchor', 'a\nb')), 'anchor')).toEqual({
      kind: 'readOnly',
      reason: 'lineBreak'
    });
    expect(fieldEligibility(projection(holding('markdown', 'a\nb')), 'markdown')).toEqual({
      kind: 'editable'
    });
    const start = session();
    expect(editField(start, 'force_mode', 'a\nb')).toBe(start);
    const forged: MatchBuffers = { ...start.draft.value, anchor: { text: 'a\nb', removed: false } };
    expect(begin({ ...start, draft: editDraft(start.draft, forged) })).toBeNull();
    expect(sent(editField(start, 'comment', 'one\ntwo')).comment).toEqual({ Set: 'one\ntwo' });
  });
});

describe('the save path, per added field', () => {
  it('sends the field, adopts the identity and moves its baseline to what was written', () => {
    for (const field of ADDED) {
      const start = session(projection(holding(field, 'before')));
      const edited = editField(start, field, 'after');
      const started = begin(edited);
      expect(started, field).not.toBeNull();
      expect(started!.draft[field], field).toEqual({ Set: 'after' });
      const done = applySave(started!.session, committed(), ADOPTED, () => started!.session);
      expect(done.match, field).toEqual(MOVED);
      expect(done.baseline[field], field).toMatchObject({ present: true, value: 'after' });
      expect(intentsOf(done.baseline, done.draft.value, null)[field], field).toBe('Unchanged');
    } // End of the loop over the added fields
  });
});

describe('conflict compare and copy, per added field', () => {
  it('retains every added field with its text and status, and copies it byte for byte', () => {
    for (const field of ADDED) {
      const held = editField(session(projection(holding(field, 'before'))), field, `drafted ${field}`);
      const view = matchEditorView(conflicted(held));
      const retained = view.retainedDraft.find((one) => one.label === view.fields.find((f) => f.field === field)!.label);
      expect(retained, field).toEqual({
        label: view.fields.find((f) => f.field === field)!.label,
        text: `drafted ${field}`,
        status: 'setting'
      });
      expect(tDraftCopy(view.retainedDraft), field).toContain(`drafted ${field}`);
      // The copy's order is the editor's own field order.
      expect(view.retainedDraft).toHaveLength(EDITABLE_FIELDS.length);
    } // End of the loop over the added fields
  });
});

describe('reapply, per added field', () => {
  it('applies over an unchanged disk field, is satisfied by an equal one, collides with a changed one', () => {
    for (const field of ADDED) {
      const base = projection(holding(field, 'old'));
      const held = editField(session(base), field, 'new');
      const was = held.baseline;
      const buffers = held.draft.value;
      const same = planMatchReapply(was, buffers, baselineOf(projection(holding(field, 'old'), AFTER)));
      expect(same.verdicts[field], field).toEqual({ kind: 'applicable', intent: { Set: 'new' } });
      expect(same.collisions, field).toEqual([]);
      const equal = planMatchReapply(was, buffers, baselineOf(projection(holding(field, 'new'), AFTER)));
      expect(equal.verdicts[field], field).toEqual({ kind: 'satisfied' });
      const changed = planMatchReapply(
        was,
        buffers,
        baselineOf(projection(holding(field, 'theirs'), AFTER))
      );
      expect(changed.collisions, field).toEqual([field]);
    } // End of the loop over the added fields
  });
});

describe('recovery, per added field', () => {
  it('carries a drafted value, omits an absent-and-blank field, and writes the matching key', () => {
    for (const field of PLAIN_ADDED) {
      const held = editField(session(), field, `v-${field}`);
      const transfer = transferOfMatchDraft(held.baseline, held.draft.value);
      expect(transfer[field], field).toEqual({ kind: 'carried', text: `v-${field}` });
      const newMatch = newMatchOfRecovery(transfer, { trigger: ':a', replace: 'b' });
      expect((newMatch as unknown as Record<string, unknown>)[field], field).toBe(`v-${field}`);
      const untouched = session();
      const none = transferOfMatchDraft(untouched.baseline, untouched.draft.value);
      expect(none[field], field).toEqual({ kind: 'notCarried', reason: { kind: 'notInTheFile' } });
      expect(field in newMatchOfRecovery(none, { trigger: ':a', replace: 'b' }), field).toBe(false);
    } // End of the loop over the plain added fields
  });

  it('writes the body under the one content key the draft holds', () => {
    for (const field of CONTENT_FIELDS) {
      const held = session(projection(holding(field, 'the body')));
      const transfer = transferOfMatchDraft(held.baseline, held.draft.value);
      expect(recoveryBodyFieldOf(transfer), field).toBe(field);
      const newMatch = newMatchOfRecovery(transfer, { trigger: ':a', replace: 'the body' });
      expect(Object.values(newMatch.content), field).toEqual(['the body']);
      expect(Object.keys(newMatch.content)[0]?.toLowerCase().replace('_', ''), field).toBe(
        field.replace('_', '')
      );
    } // End of the loop over the content keys
  });

  it('carries one content key when the source held two, and says why the other is not', () => {
    const two = session(projection({ markdown: 'second' }));
    const transfer = transferOfMatchDraft(two.baseline, two.draft.value);
    expect(transfer.replace).toEqual({ kind: 'carried', text: 'b' });
    expect(transfer.markdown).toEqual({ kind: 'notCarried', reason: { kind: 'oneContentOnly' } });
  });
});

describe('the content switch — one compound intention, all or nothing', () => {
  it('offers only content keys the file does not hold, and none when it holds two', () => {
    expect(contentSwitchTargets(session())).toEqual(['markdown', 'html', 'image_path', 'form']);
    expect(contentSwitchTargets(session(projection({ markdown: 'x' })))).toEqual([]);
    const start = session();
    expect(chooseContentSwitch(start, 'replace')).toBe(start);
  });

  it('keeps an absent content key dormant while another is held', () => {
    const start = session();
    expect(isFieldEditable(start, 'markdown')).toBe(false);
    expect(editField(start, 'markdown', 'x')).toBe(start);
    const roles = matchEditorView(start).fields.filter((one) => one.contentRole !== null);
    expect(roles.map((one) => one.contentRole)).toEqual(['current', 'dormant', 'dormant', 'dormant', 'dormant']);
  });

  it('cannot be submitted unconfirmed, and sends one rename once confirmed', () => {
    const chosen = chooseContentSwitch(session(), 'markdown');
    expect(matchEditorView(chosen).saveWithheld).toBe('contentSwitchUnconfirmed');
    expect(canSave(chosen)).toBe(false);
    expect(begin(chosen)).toBeNull();
    const confirmed = confirmContentSwitch(chosen);
    expect(canSave(confirmed)).toBe(true);
    const draft = sent(confirmed);
    expect(draft.content_switch).toEqual({ from: 'replace', to: 'markdown' });
    // The text is carried unconverted, so neither key carries a value intent: the
    // bytes are kept exactly by Rust's rename.
    expect(draft.replace).toBe('Unchanged');
    expect(draft.markdown).toBe('Unchanged');
  });

  it('carries an edit of the destination as its value, and never converts content', () => {
    const edited = editField(switched('html'), 'html', '<b>b</b>');
    const draft = sent(edited);
    expect(draft.content_switch).toEqual({ from: 'replace', to: 'html' });
    expect(draft.html).toEqual({ Set: '<b>b</b>' });
    expect(draft.replace).toBe('Unchanged');
    const untouched = switched('html');
    expect(untouched.draft.value.html.text).toBe('b');
  });

  it('removes no companion key, and names the ones it keeps in its preview', () => {
    const match = projection({ options: { paragraph: 'true' } });
    const preview = matchEditorView(chooseContentSwitch(session(match), 'markdown')).contentSwitch;
    expect(preview).toEqual({
      from: 'replace',
      to: 'markdown',
      fromLabel: 'replace',
      toLabel: 'markdown',
      text: 'b',
      textKept: true,
      companionsKept: ['paragraph'],
      companionsRemoved: [],
      confirmed: false
    });
    const draft = sent(switched('markdown', match));
    expect(draft.paragraph).toBe('Unchanged');
    expect(draft.vars).toEqual([]);
    expect(draft.form_fields).toEqual([]);
  });

  it('refuses a companion removal drafted after the switch was confirmed (review fix)', () => {
    const match = projection({ options: { paragraph: 'true' } });
    const confirmed = switched('markdown', match);
    expect(removeField(confirmed, 'paragraph')).toBe(confirmed);
    // A hand-built candidate carrying the removal is refused at the save, and
    // the preview never promises to keep what the draft removes.
    const forged: MatchBuffers = {
      ...confirmed.draft.value,
      paragraph: { text: 'true', removed: true }
    };
    const held = { ...confirmed, draft: editDraft(confirmed.draft, forged) };
    expect(matchDraftOf(held.baseline, held.draft.value).paragraph).toBe('Remove');
    expect(canSave(held)).toBe(false);
    expect(begin(held)).toBeNull();
    const view = matchEditorView(held);
    expect(view.contentSwitch?.companionsKept).toEqual([]);
    expect(view.contentSwitch?.companionsRemoved).toEqual(['paragraph']);
    expect(view.saveWithheld).toBe('switchRemovesCompanion');
  });

  it('refuses a switch over a companion removal drafted before it was chosen (review fix)', () => {
    const match = projection({ options: { paragraph: 'true' } });
    const removed = removeField(session(match), 'paragraph');
    expect(matchDraftOf(removed.baseline, removed.draft.value).paragraph).toBe('Remove');
    expect(chooseContentSwitch(removed, 'markdown')).toBe(removed);
    // Forged in the other order — the switch confirmed over the removal — the
    // save is refused on the captured candidate all the same.
    const forged: MatchBuffers = {
      ...removed.draft.value,
      markdown: { text: 'b', removed: false },
      contentSwitch: { from: 'replace', to: 'markdown', confirmed: true }
    };
    const held = { ...removed, draft: editDraft(removed.draft, forged) };
    expect(begin(held)).toBeNull();
    expect(matchEditorView(held).contentSwitch?.companionsKept).toEqual([]);
    // Restored, the switch is offered again and saves with the companion kept.
    const restored = chooseContentSwitch(
      undoEdit(removed),
      'markdown'
    );
    expect(sent(confirmContentSwitch(restored)).paragraph).toBe('Unchanged');
  });

  it('is undone step by step, and cancelled with the text given back to the source', () => {
    const chosen = chooseContentSwitch(session(), 'markdown');
    const confirmed = confirmContentSwitch(chosen);
    expect(undoEdit(confirmed).draft.value.contentSwitch).toEqual({
      from: 'replace',
      to: 'markdown',
      confirmed: false
    });
    expect(undoEdit(undoEdit(confirmed)).draft.value.contentSwitch).toBeNull();
    const typed = editField(confirmed, 'markdown', 'kept');
    const cancelled = cancelContentSwitch(typed);
    expect(cancelled.draft.value.contentSwitch).toBeNull();
    expect(cancelled.draft.value.replace.text).toBe('kept');
    expect(cancelled.draft.value.markdown.text).toBe('');
  });

  it('re-pointing drops the confirmation and moves the text', () => {
    const typed = editField(switched('markdown'), 'markdown', 'kept');
    const moved = chooseContentSwitch(typed, 'form');
    expect(moved.draft.value.contentSwitch).toEqual({ from: 'replace', to: 'form', confirmed: false });
    expect(moved.draft.value.form.text).toBe('kept');
    expect(moved.draft.value.markdown.text).toBe('');
  });

  it('refuses a removal of either key while it stands', () => {
    const held = switched('markdown');
    expect(removeField(held, 'replace')).toBe(held);
    expect(removeField(held, 'markdown')).toBe(held);
  });

  it('is retained, compared and copied with both keys named', () => {
    const view = matchEditorView(conflicted(switched('markdown')));
    const statuses = Object.fromEntries(view.retainedDraft.map((one) => [one.label, one.status]));
    expect(statuses['replace']).toBe('switchingAway');
    expect(statuses['markdown']).toBe('switchingTo');
    for (const locale of LOCALES) {
      expect(DICTIONARIES[locale]['browser.saveOutcome.field.switchingAway'].length).toBeGreaterThan(0);
      expect(DICTIONARIES[locale]['browser.saveOutcome.field.switchingTo'].length).toBeGreaterThan(0);
    }
  });

  it('rebases the baseline after a commit: the source absent, the destination present', () => {
    const started = begin(switched('markdown'))!;
    const done = applySave(started.session, committed(), ADOPTED, () => started.session);
    expect(done.baseline.replace).toMatchObject({ present: false, value: '' });
    expect(done.baseline.markdown).toMatchObject({ present: true, value: 'b' });
    const intents = intentsOf(done.baseline, done.draft.value, done.draft.value.contentSwitch);
    expect(intents.replace).toBe('Unchanged');
    expect(intents.markdown).toBe('Unchanged');
  });

  it('reapplies all of it or none of it', () => {
    const held = switched('markdown');
    const same = planMatchReapply(held.baseline, held.draft.value, baselineOf(projection({}, AFTER)));
    expect(same.contentSwitch).toBe('applicable');
    expect(same.writesAnything).toBe(true);
    expect(same.buffers.contentSwitch).toEqual({ from: 'replace', to: 'markdown', confirmed: true });
    const done = planMatchReapply(
      held.baseline,
      held.draft.value,
      baselineOf(projection({ replace: null, markdown: 'b' }, AFTER))
    );
    expect(done.contentSwitch).toBe('satisfied');
    expect(done.buffers.contentSwitch).toBeNull();
    // The disk changed the source's text: the whole switch collides, both keys.
    const changed = planMatchReapply(
      held.baseline,
      held.draft.value,
      baselineOf(projection({ replace: 'theirs' }, AFTER))
    );
    expect(changed.contentSwitch).toBe('collision');
    expect(changed.collisions).toEqual(['replace', 'markdown']);
    // The disk grew the destination key itself: the same.
    const grown = planMatchReapply(
      held.baseline,
      held.draft.value,
      baselineOf(projection({ markdown: 'other' }, AFTER))
    );
    expect(grown.collisions).toEqual(['replace', 'markdown']);
  });

  it('reapplies through the transition, rebuilding the switch over the identified snippet', () => {
    const target = projection({ node: 9 }, AFTER);
    const started = begin(switched('markdown'))!;
    const disk = makeDocument({ revision: AFTER, matches: [target] });
    const stuck = applySave(
      started.session,
      makeConflict({ disk, subject: { Identified: { target } }, expected: BASE, found: AFTER }),
      NOT_OWED,
      () => started.session
    );
    const answer = reapplyToDiskVersion(stuck, () => 'installed', null, () => stuck);
    expect(answer.kind).toBe('reapplied');
    if (answer.kind !== 'reapplied') {
      return;
    }
    expect(sent(answer.session).content_switch).toEqual({ from: 'replace', to: 'markdown' });
  });

  it('is recovered as a snippet written under the destination key', () => {
    const held = editField(switched('markdown'), 'markdown', 'recovered **body**');
    const transfer = transferOfMatchDraft(held.baseline, held.draft.value);
    expect(transfer.replace).toEqual({ kind: 'notCarried', reason: { kind: 'switchedAway' } });
    expect(transfer.markdown).toEqual({ kind: 'carried', text: 'recovered **body**' });
    expect(recoveryBodyFieldOf(transfer)).toBe('markdown');
    expect(newMatchOfRecovery(transfer, { trigger: ':a', replace: 'recovered **body**' }).content).toEqual({
      Markdown: 'recovered **body**'
    });
  });

  it('reads a switch behind a getter once, so the intents and the wire value agree', () => {
    const start = session();
    let reads = 0;
    const forged = {
      ...buffersOf(start.baseline),
      markdown: { text: 'b', removed: false },
      get contentSwitch() {
        reads += 1;
        return reads === 1 ? { from: 'replace' as const, to: 'markdown' as const, confirmed: true } : null;
      }
    } as MatchBuffers;
    const draft = matchDraftOf(start.baseline, forged);
    expect(reads).toBe(1);
    expect(draft.content_switch).toEqual({ from: 'replace', to: 'markdown' });
    // The same read decided the intents: `replace` is the source, never `Set`.
    expect(draft.replace).toBe('Unchanged');
    expect(draft.markdown).toBe('Unchanged');
  });
});

describe('the cursor action — replace only, buffer only, undoable', () => {
  it('inserts a marker in place of the selection, as one history step', () => {
    const start = editField(session(), 'replace', 'Dear ,');
    const result = insertCursorPosition(start, { start: 5, end: 5 });
    expect(result.kind).toBe('inserted');
    if (result.kind !== 'inserted') {
      return;
    }
    expect(result.session.draft.value.replace.text).toBe('Dear $|$,');
    expect(result.selection).toEqual({ start: 5, end: 8 });
    expect(undoEdit(result.session).draft.value.replace.text).toBe('Dear ,');
    expect(sent(result.session).replace).toEqual({ Set: 'Dear $|$,' });
  });

  it('selects the one marker already there and changes nothing', () => {
    const start = editField(session(), 'replace', 'a $|$ b');
    const result = insertCursorPosition(start, { start: 0, end: 0 });
    expect(result).toEqual({ kind: 'selected', session: start, selection: { start: 2, end: 5 } });
  });

  it('answers an advisory with the count, in both languages, when there are several', () => {
    const start = editField(session(), 'replace', '$|$ and $|$ and $|$');
    const result = insertCursorPosition(start, { start: 0, end: 0 });
    expect(result).toEqual({ kind: 'advisory', session: start, advisory: { kind: 'severalMarkers', count: 3 } });
    if (result.kind !== 'advisory') {
      return;
    }
    for (const locale of LOCALES) {
      expect(translate(locale, cursorAdvisoryKey(result.advisory), { count: 3 })).toContain('3');
    }
    expect(matchEditorView(start).cursorMarkers).toBe(3);
  });

  it('is not offered for another content kind, nor for a replace switched away', () => {
    const markdown = session(projection({ replace: null, markdown: 'x' }));
    expect(insertCursorPosition(markdown, { start: 0, end: 0 }).kind).toBe('unavailable');
    expect(matchEditorView(markdown).cursorActionOffered).toBe(false);
    const away = switched('markdown');
    expect(insertCursorPosition(away, { start: 0, end: 0 }).kind).toBe('unavailable');
    expect(matchEditorView(session()).cursorActionOffered).toBe(true);
  });

  it('clamps a selection outside the text, and a reversed one', () => {
    const start = editField(session(), 'replace', 'ab');
    const far = insertCursorPosition(start, { start: 99, end: 99 });
    expect(far.kind === 'inserted' && far.session.draft.value.replace.text).toBe('ab$|$');
    const reversed = insertCursorPosition(start, { start: 2, end: 0 });
    expect(reversed.kind === 'inserted' && reversed.session.draft.value.replace.text).toBe('$|$');
  });
});

describe('textual options — exact-string suggestions, no inferred boolean', () => {
  it('offers espanso’s own spellings for uppercase_style and force_mode, and nothing else', () => {
    expect(OPTION_SUGGESTIONS.uppercase_style).toEqual(['uppercase', 'capitalize', 'capitalize_words']);
    expect(OPTION_SUGGESTIONS.force_mode).toEqual(['clipboard', 'keys']);
    const view = matchEditorView(session());
    for (const field of view.fields) {
      const expected = field.field === 'uppercase_style' || field.field === 'force_mode';
      expect(field.suggestions.length > 0, field.field).toBe(expected);
    }
  });

  it('keeps an unfamiliar value exactly, and compares suggestions by ===', () => {
    const held = session(projection({ options: { force_mode: 'Keys', uppercase_style: 'capitalize' } }));
    const view = matchEditorView(held);
    const forceMode = view.fields.find((one) => one.field === 'force_mode')!;
    expect(forceMode.text).toBe('Keys');
    expect(forceMode.suggested).toBe(false);
    expect(forceMode.intent).toBe('Unchanged');
    expect(view.fields.find((one) => one.field === 'uppercase_style')!.suggested).toBe(true);
    expect(applySuggestion(held, 'force_mode', 'KEYS')).toBe(held);
    expect(sent(applySuggestion(held, 'force_mode', 'keys')).force_mode).toEqual({ Set: 'keys' });
  });

  it('never turns an option into a boolean: every spelling is sent as the text typed', () => {
    for (const field of OPTION_FIELDS) {
      for (const spelling of ['on', 'yes', 'True', '1', '']) {
        const start = session(projection(holding(field, 'false')));
        const draft = sent(editField(start, field, spelling));
        expect(draft[field as keyof MatchDraft], `${field}=${spelling}`).toEqual({ Set: spelling });
      } // End of the loop over the spellings
    } // End of the loop over the options
  });

  it('keeps force_mode and force_clipboard separate, with no inferred precedence', () => {
    const held = session(projection({ options: { force_clipboard: 'true' } }));
    const draft = sent(editField(held, 'force_mode', 'keys'));
    expect(draft.force_mode).toEqual({ Set: 'keys' });
    expect(draft.force_clipboard).toBe('Unchanged');
  });
});
