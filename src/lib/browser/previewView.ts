/**
 * What the preview panel draws, decided here — Phase 4-19-2.
 *
 * `../components/PreviewPanel.svelte` is a walk over what this module answers
 * about a {@link PreviewState} from `./preview.ts` (Phase 4-19-1): which notice
 * stands in for a result, which answer is drawn while a newer request is in
 * flight, the sample-input controls a shown answer offers and what each holds,
 * the output as drawable pieces, the sample instant and zone drawn beside it,
 * and whether the draft has moved on since the answer was asked for.
 *
 * ## What it deliberately does not do
 *
 * - **It sends nothing and writes nothing.** It imports no command wrapper; the
 *   panel reaches Rust only through the coordinator of `./preview.ts`, whose
 *   injectable surface holds the two preview readers and nothing else. The one
 *   draft this module touches is the one {@link draftPreviewTargetOf} *reads*
 *   from an editor session through `matchDraftOf`, a pure derivation.
 * - **It holds no sentence.** Notices and placeholder labels are codes with a
 *   key function each ({@link previewNoticeKey},
 *   {@link previewPlaceholderChipKey}), wrapped reactively in `../i18n/index.ts`.
 * - **It escapes nothing.** Every piece text is the file's, the draft's or the
 *   sample's characters, markup included; the panel draws it as text nodes
 *   through `./sourceText.ts`'s segments. TypeScript cannot force a renderer to
 *   do that; `PreviewPanel.test.ts` checks the one renderer there is.
 */

import type { TranslationKey } from '../i18n/dictionaries';
import type {
  MatchDraft,
  PreviewPlaceholderName,
  PreviewSegment,
  PreviewUnresolved,
  SampleInstant
} from '../ipc/types';
import { deepEquals } from './draft';
import { baseRevisionOf, matchDraftOf, type MatchEditorSession } from './matchEditor';
import {
  placeholderName,
  sampleSlotsOf,
  samePreviewSource,
  EMPTY_PREVIEW_INPUTS,
  withCapture,
  withFormValue,
  withoutPositionalSamples,
  withoutSelection,
  withSelection,
  zoneOf,
  type PreviewAnswered,
  type PreviewInputs,
  type PreviewShown,
  type PreviewState,
  type PreviewTarget,
  type SampleSlot
} from './preview';

// ---------------------------------------------------------------------------
// The target an open editor previews
// ---------------------------------------------------------------------------

/**
 * The draft target an open match editor previews: the session's identity, the
 * revision it was drafted against, and the draft its controls hold now —
 * always the **candidate route** (`preview_match_candidate`), dirty or not, so
 * the sample positions a shown answer offers are always the candidate's own
 * (`4-19-1-notes.md` §3.2) and never a saved snapshot's.
 *
 * @param session - The editor session.
 * @returns The target.
 */
export function draftPreviewTargetOf(session: MatchEditorSession): PreviewTarget {
  return {
    kind: 'draft',
    id: session.match,
    baseRevision: baseRevisionOf(session),
    draft: matchDraftOf(session.baseline, session.draft.value)
  };
} // End of function draftPreviewTargetOf()

// ---------------------------------------------------------------------------
// Which answer is drawn
// ---------------------------------------------------------------------------

/**
 * The answer a panel draws: the state's own, or — while a newer request is in
 * flight — the last one, so the output does not blink away at each keystroke.
 *
 * @param state - The coordinator's state.
 * @returns The answer to draw, or `null` when there is none yet.
 */
export function drawnAnswerOf(state: PreviewState): PreviewAnswered | null {
  if (state.kind === 'idle') {
    return null;
  }
  return state.kind === 'pending' ? state.last : state;
} // End of function drawnAnswerOf()

/**
 * The shown answer a panel draws, if the drawn answer is one.
 *
 * @param state - The coordinator's state.
 * @returns The shown answer, or `null`.
 */
export function drawnShownOf(state: PreviewState): PreviewShown | null {
  const answer = drawnAnswerOf(state);
  return answer !== null && answer.kind === 'shown' ? answer : null;
} // End of function drawnShownOf()

/**
 * Whether the draft has moved on since the drawn answer was asked for: another
 * identity, another base revision, or another draft. A saved target, or no
 * answer, is never behind.
 *
 * The request holds the draft as it crossed the wire (a JSON copy), so the
 * current draft is compared in that same form.
 *
 * @param state - The coordinator's state.
 * @param current - The target the editor would preview now.
 * @returns `true` when the drawn output no longer describes the draft.
 */
export function previewBehindDraft(state: PreviewState, current: PreviewTarget): boolean {
  const answer = drawnAnswerOf(state);
  if (answer === null) {
    return false;
  }
  const sent = answer.request.target;
  if (sent.kind !== 'draft' || current.kind !== 'draft') {
    return sent.kind !== current.kind;
  }
  if (!deepEquals(sent.id, current.id) || sent.baseRevision !== current.baseRevision) {
    return true;
  }
  return !deepEquals(sent.draft, wireCopy(current.draft));
} // End of function previewBehindDraft()

/**
 * A draft exactly as it would cross the wire.
 *
 * @param draft - A match draft.
 * @returns Its JSON copy.
 */
function wireCopy(draft: MatchDraft): unknown {
  return JSON.parse(JSON.stringify(draft)) as unknown;
} // End of function wireCopy()

// ---------------------------------------------------------------------------
// Notices
// ---------------------------------------------------------------------------

/** A sentence the panel draws in place of, or beside, a result. */
export type PreviewNotice =
  | 'pending'
  | 'noMatchInCandidate'
  | 'behindDraft'
  | 'noSamples'
  | 'noContent'
  | 'instantMissing';

/**
 * The dictionary key of a notice.
 *
 * @param notice - The notice.
 * @returns Its key.
 */
export function previewNoticeKey(notice: PreviewNotice): TranslationKey {
  switch (notice) {
    case 'pending':
      return 'browser.preview.notice.pending';
    case 'noMatchInCandidate':
      return 'browser.preview.notice.noMatchInCandidate';
    case 'behindDraft':
      return 'browser.preview.notice.behindDraft';
    case 'noSamples':
      return 'browser.preview.notice.noSamples';
    case 'noContent':
      return 'browser.preview.notice.noContent';
    case 'instantMissing':
      return 'browser.preview.notice.instantMissing';
  }
} // End of function previewNoticeKey()

/**
 * The dictionary key of a placeholder's short label, drawn inside the output
 * where the placeholder stands. Its full sentence is `describePreviewPlaceholderName`'s.
 *
 * @param name - The placeholder's variant name.
 * @returns Its key.
 */
export function previewPlaceholderChipKey(name: PreviewPlaceholderName): TranslationKey {
  switch (name) {
    case 'Clipboard':
      return 'browser.preview.placeholder.clipboard';
    case 'Shell':
      return 'browser.preview.placeholder.shell';
    case 'Script':
      return 'browser.preview.placeholder.script';
    case 'Match':
      return 'browser.preview.placeholder.match';
  }
} // End of function previewPlaceholderChipKey()

// ---------------------------------------------------------------------------
// The instant and zone drawn beside the result
// ---------------------------------------------------------------------------

/** The instant and zone an answer showed dates at, ready to draw. */
export interface InstantLabel {
  /**
   * The instant in UTC, `YYYY-MM-DD HH:MM:SS` — a fixed, locale-free spelling —
   * or `null` when it lies outside what `Date` can write.
   */
  readonly utc: string | null;
  /** The instant in whole seconds since the epoch, for when `utc` is `null`. */
  readonly unixSeconds: number;
  /** The zone: the IANA name, or a fixed offset spelled `+HH:MM`. */
  readonly zone: { readonly kind: 'named'; readonly name: string } | { readonly kind: 'fixed'; readonly offset: string };
}

/** The furthest instant from the epoch `Date` represents, in seconds. */
const DATE_LIMIT_SECONDS = 8_640_000_000_000;

/**
 * The drawable instant and zone of one request.
 *
 * @param instant - The instant a request carried.
 * @returns Its label.
 */
export function instantLabelOf(instant: SampleInstant): InstantLabel {
  const seconds = instant.unix_seconds;
  const utc =
    Number.isSafeInteger(seconds) && Math.abs(seconds) <= DATE_LIMIT_SECONDS
      ? new Date(seconds * 1000).toISOString().slice(0, 19).replace('T', ' ')
      : null;
  const zone = zoneOf(instant.zone);
  return Object.freeze({
    utc,
    unixSeconds: seconds,
    zone:
      zone.kind === 'named'
        ? Object.freeze({ kind: 'named' as const, name: zone.name })
        : Object.freeze({ kind: 'fixed' as const, offset: offsetText(zone.offsetSeconds) })
  });
} // End of function instantLabelOf()

/**
 * A fixed offset spelled `+HH:MM`, or `+HH:MM:SS` when it has seconds.
 *
 * @param offsetSeconds - Seconds east of UTC.
 * @returns The spelling.
 */
export function offsetText(offsetSeconds: number): string {
  const sign = offsetSeconds < 0 ? '-' : '+';
  const total = Math.abs(Math.trunc(offsetSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number): string => String(value).padStart(2, '0');
  const base = `${sign}${pad(hours)}:${pad(minutes)}`;
  return seconds === 0 ? base : `${base}:${pad(seconds)}`;
} // End of function offsetText()

// ---------------------------------------------------------------------------
// Sample-input controls
// ---------------------------------------------------------------------------

/** One sample-input control and what it holds. */
export type SlotView =
  | {
      readonly kind: 'selection';
      readonly slot: Extract<SampleSlot, { readonly kind: 'selection' }>;
      readonly key: string;
      /** The entry number the box shows, counted from 1, or `''` for none. */
      readonly text: string;
    }
  | {
      readonly kind: 'formField';
      readonly slot: Extract<SampleSlot, { readonly kind: 'formField' }>;
      readonly key: string;
      /** The sample value, as given. */
      readonly text: string;
    }
  | {
      readonly kind: 'capture';
      readonly slot: Extract<SampleSlot, { readonly kind: 'capture' }>;
      readonly key: string;
      /** The sample value, as given. */
      readonly text: string;
    };

/**
 * A stable key for one slot, for a keyed list.
 *
 * @param slot - The slot.
 * @returns The key.
 */
export function slotKeyOf(slot: SampleSlot): string {
  switch (slot.kind) {
    case 'selection':
      return `selection:${JSON.stringify(slot.variable)}`;
    case 'formField':
      return `field:${JSON.stringify(slot.form)}:${slot.field}`;
    case 'capture':
      return `capture:${slot.name}`;
  }
} // End of function slotKeyOf()

/**
 * The sample-input controls the drawn answer offers, each with what the inputs
 * hold for it. Only a shown **draft** answer carries an analysis (the
 * candidate's), so every position a control addresses is the candidate's.
 *
 * @param state - The coordinator's state.
 * @param inputs - The sample inputs.
 * @returns The controls, in authored order; none before a first answer.
 */
export function slotViewsOf(state: PreviewState, inputs: PreviewInputs): readonly SlotView[] {
  const shown = drawnShownOf(state);
  if (shown === null || shown.analysis === null) {
    return Object.freeze([]);
  }
  const views: SlotView[] = [];
  for (const slot of sampleSlotsOf(shown.analysis)) {
    const key = slotKeyOf(slot);
    const text = slotTextOf(inputs, slot);
    if (slot.kind === 'selection') {
      views.push({ kind: 'selection', slot, key, text });
    } else if (slot.kind === 'formField') {
      views.push({ kind: 'formField', slot, key, text });
    } else {
      views.push({ kind: 'capture', slot, key, text });
    }
  } // End of the loop over the sample slots
  return Object.freeze(views);
} // End of function slotViewsOf()

/**
 * What a control for `slot` holds under `inputs`: the entry number counted
 * from 1 for a selection, the value as given otherwise, `''` for none.
 *
 * @param inputs - The sample inputs.
 * @param slot - The slot.
 * @returns The control's text.
 */
export function slotTextOf(inputs: PreviewInputs, slot: SampleSlot): string {
  switch (slot.kind) {
    case 'selection': {
      const chosen = inputs.selections.find((sample) => samePreviewSource(sample.variable, slot.variable));
      return chosen === undefined ? '' : String(chosen.index + 1);
    }
    case 'formField': {
      const given = inputs.formValues.find(
        (sample) => samePreviewSource(sample.form, slot.form) && sample.field === slot.field
      );
      return given?.value ?? '';
    }
    case 'capture':
      return inputs.captures.find((sample) => sample.name === slot.name)?.value ?? '';
  }
} // End of function slotTextOf()

/**
 * What one edit of a sample-input control did. A refusal carries the text the
 * control must be put back to — what it held under the kept inputs — so a box
 * never goes on showing a value that is not the one sent (review 4-19-2).
 */
export type SlotEdit =
  | { readonly kind: 'edited'; readonly inputs: PreviewInputs }
  | { readonly kind: 'refused'; readonly text: string };

/**
 * The inputs after a control was set to `text`.
 *
 * An entry box takes a whole number from 1 (sent as the position `n - 1`) or
 * nothing (no selection); anything else is refused, the inputs are kept, and
 * the refusal names the text the box held under them. A field or capture
 * value is used exactly as given.
 *
 * @param inputs - The current inputs.
 * @param slot - The control's slot.
 * @param text - What the control now holds.
 * @returns The new inputs, or a refusal.
 */
export function editSlot(inputs: PreviewInputs, slot: SampleSlot, text: string): SlotEdit {
  switch (slot.kind) {
    case 'selection': {
      const trimmed = text.trim();
      if (trimmed === '') {
        return { kind: 'edited', inputs: withoutSelection(inputs, slot.variable) };
      }
      if (!/^[0-9]+$/.test(trimmed)) {
        return { kind: 'refused', text: slotTextOf(inputs, slot) };
      }
      const entry = Number(trimmed);
      const next = entry >= 1 ? withSelection(inputs, slot.variable, entry - 1) : null;
      return next === null ? { kind: 'refused', text: slotTextOf(inputs, slot) } : { kind: 'edited', inputs: next };
    }
    case 'formField':
      return { kind: 'edited', inputs: withFormValue(inputs, slot.form, slot.field, text) };
    case 'capture':
      return { kind: 'edited', inputs: withCapture(inputs, slot.name, text) };
  }
} // End of function editSlot()

// ---------------------------------------------------------------------------
// Positional samples and the candidate they were entered against
// ---------------------------------------------------------------------------

/**
 * The sample inputs together with the variables they were entered against
 * (review 4-19-2).
 *
 * A selection or a form value names its variable **by position** in the
 * candidate the drawn answer analysed. Once the drafted variables change —
 * one removed, inserted, renamed, retyped or edited — the same position can
 * name another variable, or the same entry number another entry, so every
 * positional sample is dropped before a request for the changed draft
 * ({@link anchoredForRequest}). Captures (by name), the shorthand form's
 * values (by field name) and the pinned instant are kept.
 *
 * **This is conservative, and it is a comparison of drafts, not of
 * candidates:** the draft is a list of intents and what the candidate's
 * positions become is Rust's to compute, so any change to the drafted
 * `vars` or `var_intents` drops the positional samples, a change that moves
 * nothing included. {@link variablesAnchorOf} is the whole comparison.
 */
export interface AnchoredInputs {
  /** The sample inputs. */
  readonly inputs: PreviewInputs;
  /**
   * {@link variablesAnchorOf} the target every positional sample in `inputs`
   * was entered against, or `null` before any sample or request.
   */
  readonly anchor: string | null;
}

/** No samples, anchored to nothing. */
export const EMPTY_ANCHORED_INPUTS: AnchoredInputs = Object.freeze({ inputs: EMPTY_PREVIEW_INPUTS, anchor: null });

/**
 * What a target's variable positions depend on, as one comparable string: the
 * identity, and for a draft its base revision, its drafted `vars` and its
 * `var_intents`, each as it would cross the wire.
 *
 * @param target - A saved or draft target.
 * @returns The anchor.
 */
export function variablesAnchorOf(target: PreviewTarget): string {
  if (target.kind === 'saved') {
    return JSON.stringify({ saved: target.id });
  }
  return JSON.stringify({
    draft: target.id,
    baseRevision: target.baseRevision,
    vars: target.draft.vars,
    varIntents: target.draft.var_intents
  });
} // End of function variablesAnchorOf()

/**
 * `anchored` re-anchored to `target`: unchanged when the anchor is the
 * target's, and otherwise with every positional sample dropped.
 *
 * @param anchored - The current inputs and their anchor.
 * @param target - The target samples now address.
 * @returns The re-anchored inputs.
 */
function reanchored(anchored: AnchoredInputs, target: PreviewTarget): AnchoredInputs {
  const anchor = variablesAnchorOf(target);
  if (anchored.anchor === anchor) {
    return anchored;
  }
  return Object.freeze({ inputs: withoutPositionalSamples(anchored.inputs), anchor });
} // End of function reanchored()

/**
 * The inputs a request for `target` sends, and the anchor they are kept under
 * afterwards: every positional sample entered against other variables is
 * dropped first.
 *
 * @param anchored - The current inputs and their anchor.
 * @param target - The target about to be requested.
 * @returns The inputs to send and keep.
 */
export function anchoredForRequest(anchored: AnchoredInputs, target: PreviewTarget): AnchoredInputs {
  return reanchored(anchored, target);
} // End of function anchoredForRequest()

/** What one edit of an anchored control did. */
export type AnchoredSlotEdit =
  | { readonly kind: 'edited'; readonly anchored: AnchoredInputs }
  | { readonly kind: 'refused'; readonly text: string };

/**
 * {@link editSlot} for a control drawn from the answer to `against` — the
 * drawn answer's own request target, whose candidate the control's position
 * addresses. Positional samples entered against other variables are dropped
 * before the edit is applied, so every positional sample kept shares one
 * anchor. A refusal changes nothing and names the text the control held.
 *
 * @param anchored - The current inputs and their anchor.
 * @param against - The target the drawn answer was requested for.
 * @param slot - The control's slot.
 * @param text - What the control now holds.
 * @returns The new anchored inputs, or a refusal.
 */
export function editAnchoredSlot(
  anchored: AnchoredInputs,
  against: PreviewTarget,
  slot: SampleSlot,
  text: string
): AnchoredSlotEdit {
  const edit = editSlot(anchored.inputs, slot, text);
  if (edit.kind === 'refused') {
    return edit;
  }
  const base = reanchored(anchored, against);
  const applied = base === anchored ? edit : editSlot(base.inputs, slot, text);
  return applied.kind === 'refused'
    ? applied
    : { kind: 'edited', anchored: Object.freeze({ inputs: applied.inputs, anchor: base.anchor }) };
} // End of function editAnchoredSlot()

// ---------------------------------------------------------------------------
// The output as drawable pieces
// ---------------------------------------------------------------------------

/** One piece of illustrative output, as the panel draws it. */
export type PreviewPiece =
  | { readonly kind: 'literal'; readonly text: string }
  | { readonly kind: 'sample'; readonly text: string }
  | { readonly kind: 'choice'; readonly label: string; readonly pieces: readonly PreviewPiece[] }
  | { readonly kind: 'placeholder'; readonly name: PreviewPlaceholderName }
  | { readonly kind: 'unresolved'; readonly text: string; readonly reason: PreviewUnresolved };

/**
 * The drawable pieces of one body's segments, nested choices included. Texts
 * are carried unchanged.
 *
 * @param segments - The segments, as they crossed the boundary.
 * @returns The pieces.
 */
export function piecesOf(segments: readonly PreviewSegment[]): readonly PreviewPiece[] {
  return segments.map((segment): PreviewPiece => {
    if ('Literal' in segment) {
      return { kind: 'literal', text: segment.Literal.text };
    }
    if ('Sample' in segment) {
      return { kind: 'sample', text: segment.Sample.text };
    }
    if ('Choice' in segment) {
      return { kind: 'choice', label: segment.Choice.label, pieces: piecesOf(segment.Choice.segments) };
    }
    if ('Placeholder' in segment) {
      return { kind: 'placeholder', name: placeholderName(segment.Placeholder.placeholder) };
    }
    return { kind: 'unresolved', text: segment.Unresolved.text, reason: segment.Unresolved.reason };
  });
} // End of function piecesOf()
