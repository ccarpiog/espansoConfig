/**
 * What a snippet row shows, decided in one place instead of in markup.
 *
 * Two rules govern every function here.
 *
 * **D2u — a scalar is rendered as its source text, never as an inferred type.**
 * `ScalarView.text` is what `decode()` produced or what the file literally
 * holds; nothing below resolves it, compares it against `true`, or decides that
 * a trigger is "empty" because YAML 1.1 would call it null. When there is no
 * text to show, the answer is a *code* — a `TriggerKind` — which the component
 * renders through `tTriggerKind`. A code is not a value.
 *
 * **A badge comes from badge data.** `MatchView.badges` is computed in the core
 * from a key's presence or a `type` field's text, and
 * `badges_come_from_key_presence_and_type_text_never_from_a_scalar_value` pins
 * that it is never computed from a scalar's value. {@link badgesOf} therefore
 * returns that list unchanged: the frontend adds nothing, removes nothing, and
 * — the part that matters — never looks at `content.html` and concludes "this
 * one is HTML". Deriving a badge here would silently reintroduce exactly the
 * value inference D2u forbids, one field at a time.
 */

import type { MatchBadge, MatchId, MatchView, ScalarView, ValueView } from '../ipc/types';
import type { TriggerKind } from '../ipc/types';

/**
 * What to show where a snippet's trigger goes.
 *
 * `text` is source text out of the file. `code` is the shape the core found,
 * for a match that has no trigger text to show at all.
 */
export type TriggerLabel =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'code'; readonly code: TriggerKind };

/**
 * The scalar a projected value holds, when it holds one.
 *
 * @param value - A projected value as it crossed the boundary.
 * @returns The scalar view, or `null` for any other shape.
 */
export function valueScalar(value: ValueView): ScalarView | null {
  return 'Scalar' in value ? value.Scalar : null;
} // End of function valueScalar()

/**
 * What the snippet list shows in a row's trigger position.
 *
 * The order is the order espanso itself reads the three fields in, and the
 * fallback is a code rather than an empty string: a row that shows nothing is
 * indistinguishable from a row that failed to render.
 *
 * @param match - A match as it crossed the boundary.
 * @returns Source text to print, or the code to describe.
 */
export function triggerLabel(match: MatchView): TriggerLabel {
  const single = match.trigger.trigger;
  if (single !== null) {
    return { kind: 'text', text: single.text };
  }
  for (const item of match.trigger.triggers) {
    const scalar = valueScalar(item);
    if (scalar !== null) {
      return { kind: 'text', text: scalar.text };
    }
  } // End of the loop over a match's `triggers` entries
  const regex = match.trigger.regex;
  if (regex !== null) {
    return { kind: 'text', text: regex.text };
  }
  return { kind: 'code', code: match.trigger.kind };
} // End of function triggerLabel()

/**
 * The label a snippet carries, as source text, or `null` when it has none.
 *
 * `null` rather than a placeholder sentence: plan section 8.4 is about not
 * hiding what the file really contains, and a snippet with no `label` has no
 * label rather than an invented one.
 *
 * @param match - A match as it crossed the boundary.
 * @returns The label's source text, or `null`.
 */
export function labelText(match: MatchView): string | null {
  return match.label === null ? null : match.label.text;
} // End of function labelText()

/**
 * The badges a row shows.
 *
 * The core's list, unchanged. See this module's header for why nothing here
 * looks at a scalar to decide a badge.
 *
 * @param match - A match as it crossed the boundary.
 * @returns The badge list exactly as the core computed it.
 */
export function badgesOf(match: MatchView): readonly MatchBadge[] {
  return match.badges;
} // End of function badgesOf()

/**
 * A stable key for one match, for a keyed `{#each}`.
 *
 * Session-local and revision-scoped, exactly like the identity it is built
 * from: it is a rendering key, not a way to recognise a snippet across a
 * change to the file. `selection.ts` owns that question.
 *
 * @param id - The match's identity.
 * @returns A string unique among the matches on screen.
 */
export function matchKey(id: MatchId): string {
  return `${id.document}:${id.revision}:${id.node}`;
} // End of function matchKey()
