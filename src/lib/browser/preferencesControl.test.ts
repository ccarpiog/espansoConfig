/**
 * The preferences control's values — Phase 3-13-2.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { describe, expect, it } from 'vitest';
import type { IpcFailure } from '../ipc/errors';
import type { SidecarState } from '../ipc/types';
import { NO_PREFERENCES, preferencesOf, preferencesReadFailed } from './preferences';
import {
  defaultControlsOf,
  defaultsApplyTo,
  editDraftDefault,
  editDraftName,
  followPreferences,
  preferenceSaveLinesOf,
  preferenceTextControlOf,
  preferencesEditable,
  preferencesPlanOf,
  preferencesReadingLineOf,
  preferencesTargetOf,
  removeDraftDefault,
  seedingNoticeOf,
  startPreferencesDraft
} from './preferencesControl';

/** A failure a call could answer. */
const FAILURE: IpcFailure = { kind: 'command', error: { code: 'noWorkspaceOpen' } };

/**
 * Preferences holding one file with a name and two defaults.
 *
 * @param writable - Whether updates may write.
 * @returns The preferences.
 */
function withAlpha(writable = true): ReturnType<typeof preferencesOf> {
  const state: SidecarState = {
    status: { Loaded: {} },
    writable,
    retained_orphans: 0,
    files: [
      {
        document: 2,
        display_name: 'Alpha',
        sort_order: null,
        defaults: [
          { option: 'word', value: 'true' },
          { option: 'uppercase_style', value: '' }
        ]
      }
    ]
  };
  return preferencesOf(state);
} // End of function withAlpha()

describe('which control draws a value', () => {
  it('boxes one line, shows a value holding a line break, and offers absent as absent', () => {
    expect(preferenceTextControlOf(null)).toBe('absent');
    expect(preferenceTextControlOf('')).toBe('box');
    expect(preferenceTextControlOf('true')).toBe('box');
    expect(preferenceTextControlOf('a\nb')).toBe('shown');
    expect(preferenceTextControlOf('a\rb')).toBe('shown');
  });

  it('targets the selected listed file, and nothing for the "All" scope or an unlisted one', () => {
    const listed = [{ id: 2, relative_path: 'match/a.yml', kind: 'MatchFile' as const }];
    expect(preferencesTargetOf({ kind: 'document', id: 2 }, listed)).toBe(listed[0]);
    expect(preferencesTargetOf({ kind: 'all' }, listed)).toBeNull();
    expect(preferencesTargetOf({ kind: 'document', id: 9 }, listed)).toBeNull();
  });

  it('offers defaults for a snippet file only', () => {
    expect(defaultsApplyTo({ id: 1, relative_path: 'match/a.yml', kind: 'MatchFile' })).toBe(true);
    expect(defaultsApplyTo({ id: 1, relative_path: 'config/a.yml', kind: 'ConfigProfile' })).toBe(
      false
    );
    expect(defaultsApplyTo({ id: 1, relative_path: 'match/p/package.yml', kind: 'Package' })).toBe(
      false
    );
  });
});

describe('the draft and its plan', () => {
  it('starts equal to its baseline and plans nothing', () => {
    const draft = startPreferencesDraft(withAlpha(), 2);
    expect(draft.name).toBe('Alpha');
    expect(draft.defaults.word).toBe('true');
    expect(preferencesPlanOf(draft)).toEqual({ kind: 'nothing' });
  });

  it('asks only for what changed, name first, empty and absent kept apart', () => {
    let draft = startPreferencesDraft(withAlpha(), 2);
    draft = editDraftName(draft, ' Beta ');
    draft = removeDraftDefault(draft, 'uppercase_style');
    draft = editDraftDefault(draft, 'force_mode', '');
    expect(preferencesPlanOf(draft)).toEqual({
      kind: 'ready',
      changes: [
        { SetDisplayName: { name: ' Beta ' } },
        { ClearDefault: { option: 'uppercase_style' } },
        { SetDefault: { option: 'force_mode', value: '' } }
      ]
    });
  });

  it('clears a name emptied or blanked, and plans nothing for no name left empty', () => {
    expect(preferencesPlanOf(editDraftName(startPreferencesDraft(withAlpha(), 2), '  '))).toEqual({
      kind: 'ready',
      changes: [{ ClearDisplayName: {} }]
    });
    expect(preferencesPlanOf(startPreferencesDraft(NO_PREFERENCES, 3))).toEqual({ kind: 'nothing' });
  });

  it('refuses a name with a line break and a default with a carriage return', () => {
    const draft = startPreferencesDraft(withAlpha(), 2);
    expect(preferencesPlanOf(editDraftName(draft, 'a\nb'))).toEqual({
      kind: 'nameRefused',
      reason: 'lineBreak'
    });
    expect(preferencesPlanOf(editDraftDefault(draft, 'word', 'a\rb'))).toEqual({
      kind: 'defaultRefused',
      option: 'word',
      reason: 'carriageReturn'
    });
  });

  it('follows the preferences while untouched, and keeps a changed draft with its baseline', () => {
    const empty = startPreferencesDraft(NO_PREFERENCES, 2);
    expect(followPreferences(empty, withAlpha()).name).toBe('Alpha');
    const changed = editDraftName(empty, 'Mine');
    expect(followPreferences(changed, withAlpha())).toBe(changed);
  });

  it('lists the seven defaults in option order with their controls', () => {
    const controls = defaultControlsOf(startPreferencesDraft(withAlpha(), 2));
    expect(controls.map((each) => each.option)).toEqual([
      'word',
      'left_word',
      'right_word',
      'propagate_case',
      'uppercase_style',
      'force_mode',
      'force_clipboard'
    ]);
    expect(controls.map((each) => each.control)).toEqual([
      'box',
      'absent',
      'absent',
      'absent',
      'box',
      'absent',
      'absent'
    ]);
  });

  it('is editable only when writable and not saving', () => {
    expect(preferencesEditable(withAlpha(), false)).toBe(true);
    expect(preferencesEditable(withAlpha(), true)).toBe(false);
    expect(preferencesEditable(withAlpha(false), false)).toBe(false);
    expect(preferencesEditable(NO_PREFERENCES, false)).toBe(false);
  });
});

describe('what the control says', () => {
  it('says reading, a status worth saying, or a failure — and nothing for Loaded', () => {
    expect(preferencesReadingLineOf(NO_PREFERENCES)).toEqual({ kind: 'reading' });
    expect(preferencesReadingLineOf(withAlpha())).toBeNull();
    expect(preferencesReadingLineOf(preferencesReadFailed(FAILURE))).toEqual({
      kind: 'readFailed',
      failure: FAILURE
    });
    const fresh = preferencesOf({ status: { Fresh: {} }, writable: true, files: [], retained_orphans: 0 });
    expect(preferencesReadingLineOf(fresh)).toEqual({ kind: 'status', status: { Fresh: {} } });
  });

  it('maps every save ending to the lines its describers render', () => {
    expect(preferenceSaveLinesOf({ kind: 'idle' })).toEqual([]);
    expect(preferenceSaveLinesOf({ kind: 'saving' })).toEqual([{ kind: 'saving' }]);
    expect(preferenceSaveLinesOf({ kind: 'ended', report: { kind: 'saved' } })).toEqual([
      { kind: 'outcome', outcome: { Saved: {} } }
    ]);
    expect(preferenceSaveLinesOf({ kind: 'ended', report: { kind: 'unchanged' } })).toEqual([
      { kind: 'outcome', outcome: { Unchanged: {} } }
    ]);
    expect(
      preferenceSaveLinesOf({
        kind: 'ended',
        report: { kind: 'notWritable', status: { Unreadable: {} } }
      })
    ).toEqual([
      { kind: 'outcome', outcome: { NotWritable: {} } },
      { kind: 'status', status: { Unreadable: {} } }
    ]);
    expect(preferenceSaveLinesOf({ kind: 'ended', report: { kind: 'writeFailed' } })).toEqual([
      { kind: 'outcome', outcome: { WriteFailed: {} } }
    ]);
    expect(
      preferenceSaveLinesOf({ kind: 'ended', report: { kind: 'failed', failure: FAILURE } })
    ).toEqual([{ kind: 'failure', failure: FAILURE }]);
    expect(preferenceSaveLinesOf({ kind: 'ended', report: { kind: 'withdrawn' } })).toEqual([
      { kind: 'withdrawn' }
    ]);
  });

  it('names the seeding’s file by the form’s own destination, and nothing when pending', () => {
    const destinations = [
      {
        document: 2,
        path: 'match/alpha.yml',
        revision: '',
        eligibility: { kind: 'eligible' as const },
        anchors: []
      }
    ];
    expect(
      seedingNoticeOf({ destinations, seeding: { kind: 'pending' } } as unknown as Parameters<
        typeof seedingNoticeOf
      >[0])
    ).toBeNull();
    const notice = seedingNoticeOf({
      destinations,
      seeding: { kind: 'seeded', from: 2, seeded: ['word'], kept: ['force_mode'], withheld: ['left_word'] }
    } as unknown as Parameters<typeof seedingNoticeOf>[0]);
    expect(notice).toEqual({
      from: 'match/alpha.yml',
      seeded: ['word'],
      kept: ['forceMode'],
      withheld: [{ label: 'leftWord', reason: 'carriageReturn' }]
    });
  });
});
