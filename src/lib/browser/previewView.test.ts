/**
 * Phase 4-19-2 — what the preview panel draws (`./previewView.ts`), in the
 * `node` environment. The mounted half is `../components/PreviewPanel.test.ts`.
 *
 * Every fixture is hand-authored and neutral (`CLAUDE.md` section 1).
 */

import { describe, expect, it } from 'vitest';
import { DICTIONARIES } from '../i18n/dictionaries';
import type { ExpectNever, Missing } from '../i18n/exhaustive';
import type { AnalysisSummary, MatchDraft, MatchId, PreviewPlaceholderName } from '../ipc/types';
import { makeMatch } from './fixtures';
import { editField, startMatchEditor } from './matchEditor';
import {
  EMPTY_PREVIEW_INPUTS,
  PREVIEW_IDLE,
  type PreviewShown,
  type PreviewState,
  type PreviewTarget,
  type SampleSlot
} from './preview';
import {
  anchoredForRequest,
  draftPreviewTargetOf,
  drawnAnswerOf,
  editAnchoredSlot,
  editSlot,
  EMPTY_ANCHORED_INPUTS,
  instantLabelOf,
  offsetText,
  piecesOf,
  previewBehindDraft,
  previewNoticeKey,
  previewPlaceholderChipKey,
  slotViewsOf,
  variablesAnchorOf,
  type AnchoredInputs,
  type PreviewNotice
} from './previewView';

/** Every notice, written out by hand. */
const NOTICES = [
  'pending',
  'noMatchInCandidate',
  'behindDraft',
  'noSamples',
  'noContent',
  'instantMissing'
] as const satisfies readonly PreviewNotice[];
export type _NoticesAreComplete = ExpectNever<Missing<PreviewNotice, typeof NOTICES>>;

/** Every placeholder name, written out by hand. */
const PLACEHOLDERS = ['Clipboard', 'Shell', 'Script', 'Match'] as const satisfies readonly PreviewPlaceholderName[];
export type _PlaceholdersAreComplete = ExpectNever<Missing<PreviewPlaceholderName, typeof PLACEHOLDERS>>;

/** A snippet identity. */
const ID: MatchId = { document: 1, revision: 'a'.repeat(64), node: 1 };

/** An analysis with one random and one capture. */
const ANALYSIS = {
  declarations: [{ index: 0, name: 'roll', kind: 'Random', layout: null }],
  captures: ['n'],
  shorthand_form: null
} as unknown as AnalysisSummary;

/**
 * A shown state for `target`.
 *
 * @param target - The target the request carried.
 * @param analysis - The candidate's analysis.
 * @returns The state.
 */
function shownFor(target: PreviewTarget, analysis: AnalysisSummary | null = ANALYSIS): PreviewShown {
  return {
    kind: 'shown',
    generation: 1,
    request: {
      target: JSON.parse(JSON.stringify(target)) as PreviewTarget,
      samples: { selections: [], form_values: [], captures: [], instant: null }
    },
    preview: { bodies: [], limit: null },
    limitations: { unresolved: [], unresolvedCount: 0, placeholders: [], limit: null },
    candidate: 'c'.repeat(64),
    analysis
  };
} // End of function shownFor()

describe('keys', () => {
  it('gives every notice and placeholder label a key, different in English and Spanish', () => {
    const keys = [...NOTICES.map(previewNoticeKey), ...PLACEHOLDERS.map(previewPlaceholderChipKey)];
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(DICTIONARIES.en[key]).toBeTruthy();
      expect(DICTIONARIES.es[key]).toBeTruthy();
      expect(DICTIONARIES.es[key]).not.toBe(DICTIONARIES.en[key]);
    } // End of the loop over the keys
  });
});

describe('the target an editor previews', () => {
  it('is the draft its controls hold, against the revision it was opened on', () => {
    const session = startMatchEditor(makeMatch({ revision: ID.revision, trigger: ':a', replace: 'Hi' }), () => 0);
    const edited = editField(session, 'replace', 'Bye');
    const target = draftPreviewTargetOf(edited);
    expect(target.kind).toBe('draft');
    expect(target.kind === 'draft' && target.draft.replace).toEqual({ Set: 'Bye' });
    expect(target.kind === 'draft' && target.baseRevision).toBe(ID.revision);
    expect(session.draft.value).not.toBe(edited.draft.value);
  });

  it('is behind a draft that moved on, and not behind the one it sent', () => {
    const session = startMatchEditor(makeMatch({ revision: ID.revision, trigger: ':a', replace: 'Hi' }), () => 0);
    const sent = draftPreviewTargetOf(session);
    const state: PreviewState = shownFor(sent);
    expect(previewBehindDraft(state, draftPreviewTargetOf(session))).toBe(false);
    expect(previewBehindDraft(state, draftPreviewTargetOf(editField(session, 'replace', 'Other')))).toBe(true);
    const moved: PreviewTarget = { ...sent, baseRevision: 'b'.repeat(64) } as PreviewTarget;
    expect(previewBehindDraft(state, moved)).toBe(true);
    expect(previewBehindDraft(PREVIEW_IDLE, moved)).toBe(false);
  });
});

describe('which answer is drawn', () => {
  it('keeps the last answer while a newer request is in flight', () => {
    const shown = shownFor({ kind: 'saved', id: ID });
    const pending: PreviewState = { kind: 'pending', generation: 2, request: shown.request, last: shown };
    expect(drawnAnswerOf(pending)).toBe(shown);
    expect(drawnAnswerOf(PREVIEW_IDLE)).toBeNull();
  });
});

describe('the instant and zone', () => {
  it('spells an instant in UTC and a zone by name or offset', () => {
    expect(instantLabelOf({ unix_seconds: 0, zone: { Named: { name: 'UTC' } } })).toEqual({
      utc: '1970-01-01 00:00:00',
      unixSeconds: 0,
      zone: { kind: 'named', name: 'UTC' }
    });
    expect(instantLabelOf({ unix_seconds: -1, zone: { Fixed: { offset_seconds: -19_800 } } })).toEqual({
      utc: '1969-12-31 23:59:59',
      unixSeconds: -1,
      zone: { kind: 'fixed', offset: '-05:30' }
    });
    expect(instantLabelOf({ unix_seconds: 9e15, zone: { Fixed: { offset_seconds: 0 } } }).utc).toBeNull();
  });

  it('spells offsets with seconds only when there are some', () => {
    expect([offsetText(0), offsetText(7200), offsetText(-3661), offsetText(86_399)]).toEqual([
      '+00:00',
      '+02:00',
      '-01:01:01',
      '+23:59:59'
    ]);
  });
});

describe('sample-input controls', () => {
  it('offers the candidate analysis slots with what the inputs hold, and none without an analysis', () => {
    const target: PreviewTarget = { kind: 'saved', id: ID };
    const edited = editSlot(EMPTY_PREVIEW_INPUTS, { kind: 'capture', name: 'n' }, 'seven');
    expect(edited.kind).toBe('edited');
    const inputs = edited.kind === 'edited' ? edited.inputs : EMPTY_PREVIEW_INPUTS;
    expect(slotViewsOf(shownFor(target), inputs).map((view) => [view.key, view.text])).toEqual([
      ['selection:{"Local":{"index":0}}', ''],
      ['capture:n', 'seven']
    ]);
    expect(slotViewsOf(shownFor(target, null), inputs)).toEqual([]);
    expect(slotViewsOf(PREVIEW_IDLE, inputs)).toEqual([]);
  });

  it('takes an entry number from 1 or nothing, and refuses anything else', () => {
    const slot = { kind: 'selection', variable: { Local: { index: 0 } }, name: 'roll', variableKind: 'Random' } as const;
    const second = editSlot(EMPTY_PREVIEW_INPUTS, slot, ' 2 ');
    expect(second.kind === 'edited' && second.inputs.selections).toEqual([{ variable: { Local: { index: 0 } }, index: 1 }]);
    const cleared = second.kind === 'edited' ? editSlot(second.inputs, slot, '') : second;
    expect(cleared.kind === 'edited' && cleared.inputs.selections).toEqual([]);
    for (const text of ['0', '-1', '1.5', 'two', '1e3']) {
      expect(editSlot(EMPTY_PREVIEW_INPUTS, slot, text)).toEqual({ kind: 'refused', text: '' });
    } // End of the loop over the refused texts
    const held = second.kind === 'edited' ? second.inputs : EMPTY_PREVIEW_INPUTS;
    expect(editSlot(held, slot, '0')).toEqual({ kind: 'refused', text: '2' });
  });

  it('keeps a form value exactly as given', () => {
    const edited = editSlot(
      EMPTY_PREVIEW_INPUTS,
      { kind: 'formField', form: { ShorthandForm: {} }, name: null, field: 'x' },
      ' <b>\r '
    );
    expect(edited.kind === 'edited' && edited.inputs.formValues).toEqual([
      { form: { ShorthandForm: {} }, field: 'x', value: ' <b>\r ' }
    ]);
  });
});

describe('positional samples and the variables they were entered against (review 4-19-2)', () => {
  const slot = { kind: 'selection', variable: { Local: { index: 0 } }, name: 'roll', variableKind: 'Random' } as const;
  const capture = { kind: 'capture', name: 'n' } as const;
  const form = { kind: 'formField', form: { Local: { index: 1 } }, name: 'f', field: 'x' } as const;
  const shorthand = { kind: 'formField', form: { ShorthandForm: {} }, name: null, field: 'y' } as const;

  /**
   * A draft target with no drafted `vars` and the given `var_intents`.
   *
   * @param varIntents - The drafted `var_intents`.
   * @returns The target.
   */
  function draftTarget(varIntents: MatchDraft['var_intents']): PreviewTarget {
    return {
      kind: 'draft',
      id: ID,
      baseRevision: 'a'.repeat(64),
      draft: { vars: [], var_intents: varIntents } as unknown as MatchDraft
    };
  } // End of function draftTarget()

  /**
   * Applies edits in order against one target, failing on a refusal.
   *
   * @param against - The target the controls were drawn from.
   * @param edits - Each slot and text.
   * @returns The anchored inputs.
   */
  function entered(against: PreviewTarget, edits: readonly (readonly [SampleSlot, string])[]): AnchoredInputs {
    let anchored = EMPTY_ANCHORED_INPUTS;
    for (const [where, text] of edits) {
      const edit = editAnchoredSlot(anchored, against, where, text);
      expect(edit.kind).toBe('edited');
      anchored = edit.kind === 'edited' ? edit.anchored : anchored;
    } // End of the loop over the edits
    return anchored;
  } // End of function entered()

  it('keeps every sample for the same drafted variables', () => {
    const before = draftTarget([]);
    const anchored = entered(before, [[slot, '2'], [capture, 'seven']]);
    expect(anchoredForRequest(anchored, draftTarget([]))).toBe(anchored);
  });

  it('drops every positional sample, and only those, once the drafted variables change', () => {
    const anchored = entered(draftTarget([]), [[slot, '2'], [form, 'a'], [shorthand, 'b'], [capture, 'seven']]);
    const after = anchoredForRequest(anchored, draftTarget([{ RemoveVariable: { index: 0 } }]));
    expect(after.inputs.selections).toEqual([]);
    expect(after.inputs.formValues).toEqual([{ form: { ShorthandForm: {} }, field: 'y', value: 'b' }]);
    expect(after.inputs.captures).toEqual([{ name: 'n', value: 'seven' }]);
    expect(after.anchor).toBe(variablesAnchorOf(draftTarget([{ RemoveVariable: { index: 0 } }])));
    expect(variablesAnchorOf({ kind: 'saved', id: ID })).not.toBe(variablesAnchorOf(draftTarget([])));
  });

  it('drops samples entered against other variables before an edit against the drawn answer', () => {
    const anchored = entered(draftTarget([]), [[slot, '2']]);
    const drawnFor = draftTarget([{ RemoveVariable: { index: 0 } }]);
    const edit = editAnchoredSlot(anchored, drawnFor, form, 'a');
    expect(edit.kind === 'edited' && edit.anchored.inputs.selections).toEqual([]);
    expect(edit.kind === 'edited' && edit.anchored.anchor).toBe(variablesAnchorOf(drawnFor));
    expect(editAnchoredSlot(anchored, drawnFor, slot, '0')).toEqual({ kind: 'refused', text: '2' });
  });
});

describe('pieces', () => {
  it('carries every text unchanged, nested choices included', () => {
    expect(
      piecesOf([
        { Literal: { text: '<b>' } },
        { Sample: { text: 's', source: { Capture: { name: 'n' } } } },
        {
          Choice: {
            source: { Local: { index: 0 } },
            label: 'L',
            segments: [{ Unresolved: { text: '{{q}}', source: null, reason: 'Cycle' } }]
          }
        },
        { Placeholder: { source: { Local: { index: 1 } }, placeholder: { Script: { args: null } } } }
      ])
    ).toEqual([
      { kind: 'literal', text: '<b>' },
      { kind: 'sample', text: 's' },
      { kind: 'choice', label: 'L', pieces: [{ kind: 'unresolved', text: '{{q}}', reason: 'Cycle' }] },
      { kind: 'placeholder', name: 'Script' }
    ]);
  });
});
