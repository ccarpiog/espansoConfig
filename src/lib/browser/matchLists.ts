/**
 * The list submodel of the match editor: `triggers` and `search_terms` as
 * drafted lists of text — Phase 3-6-1.
 *
 * **No component and no screen**, for `./matchEditor.ts`'s reason: a decision
 * written in markup is one nothing but a mounted suite can check. This module
 * decides, as values, everything about one list the editor drafts: what the file
 * holds ({@link ListBaseline}), what the controls hold ({@link ListBuffer}),
 * whether it may be edited and why not ({@link ListRefusal}), the wire intents a
 * draft derives ({@link listDerivationOf}), and what a reapply may do with it
 * ({@link listReapply}). `./matchEditor.ts` holds the history, the trigger-form
 * switch and the session; this holds no session and calls no command.
 *
 * ## What a drafted list is
 *
 * An ordered array of items, each either a **kept** item of the file's list —
 * named by its index there (`origin`), its text possibly edited — or a **new**
 * item (`origin: null`). An item the file holds and the array does not is
 * removed. Kept items stay in the file's own order: no transition here reorders
 * one, and {@link listDerivationOf} refuses an array whose kept origins are not
 * strictly increasing (`notInOrder`), because a buffer carries no brand and a
 * caller that is not a transition can build one. Reordering is not a Phase 3
 * capability of the core (D2r is for matches, and no list move exists).
 *
 * ## Style is Rust's, and it is kept
 *
 * The model never chooses a style. Items are added and removed through the 3-2
 * and 3-3 intents, which write **between a flow list's brackets** and **as block
 * items in a block list** — a flow list never becomes block style, and a block
 * list never becomes flow (ruling 5). A new list is written in block style, and
 * an explicitly requested empty one as `[]`. {@link ListBaseline.style} is the
 * file's own, reported so a screen can say which it is; no function takes it as
 * an argument to change.
 *
 * ## The intended order
 *
 * Every index on the wire is a position in the **original** list. A run of new
 * items is placed immediately above the next kept item — `Front` when that is the
 * first original item, `After(k)` for the original item just above it otherwise
 * — and at `End` when no kept item follows. That placement is chosen so an
 * insertion never lands where the same batch removes an item (rule 4 of
 * `check_structure_is_coherent` in `crates/espansoconfig-core/src/draft/plan.rs`),
 * and two runs never share a landing. So the list the file ends up holding is
 * exactly the drafted array, in its order.
 *
 * ## Two shapes a save cannot express, refused rather than approximated
 *
 * - **every original item removed and new ones added** (`everyItemReplaced`):
 *   the core refuses a batch whose removals take every original item
 *   (`SequenceWouldBeEmpty`), because that is a rewrite of the list rather than
 *   an edit of it. Editing the items in place expresses the same result;
 * - **no item left in a present list** (`wouldBeEmpty`): removing the last item
 *   is never an item removal (ruling 6); {@link withListRemoved} is the explicit
 *   intent for "no list", and {@link withItemRemoved} refuses the last item.
 *
 * ## Every control is one line
 *
 * An item is edited in an `<input type="text">`, which deletes a carriage return
 * and strips a line feed (`CLAUDE.md` section 6), so an item holding either is
 * **read-only for the whole list** ({@link listBaselineOf}), and the transitions
 * here refuse a text holding either. `./matchEditor.ts`'s `beginSave` checks the
 * derived wire draft a third time, because {@link ListBuffer} carries no brand.
 */

import type { TranslationKey } from '../i18n/dictionaries';
import type {
  ItemDraft,
  ListPlacement,
  SequenceField,
  SequenceIntent,
  SequencePresence,
  ValueView
} from '../ipc/types';
import type { DetailFieldName } from './detail';

/**
 * The file's own presentation of one list, as the projection reports it.
 *
 * `absent` — no key; `empty` — `key: []`; `block` and `flow` — a list with
 * items; `unsupported` — the key holds something that is not a list.
 */
export type ListStyle = 'absent' | 'empty' | 'block' | 'flow' | 'unsupported';

/**
 * Why a list may not be edited. **A code, never a sentence**:
 * {@link listRefusalKey} names the key and `tListRefusal` renders it.
 *
 * - `unsupportedShape` — the key holds a scalar or a mapping, not a list;
 * - `unmodelledShape` — the key is in the projection's unknown entries (a
 *   repeated key most visibly), so which list an edit would hit is not a question
 *   this editor answers;
 * - `itemNotText` — an item is a collection or an alias, not one piece of text;
 * - `itemNotDecodable` — an item's text is the file's own characters rather than
 *   a value this application could read back;
 * - `carriageReturn` — an item holds a carriage return, which no control here can
 *   give back;
 * - `lineBreak` — an item spans lines, and an item is edited in a one-line box;
 * - `ownsNoBytes` — an item owns no bytes, so there is no value to replace.
 */
export type ListRefusal =
  | 'unsupportedShape'
  | 'unmodelledShape'
  | 'itemNotText'
  | 'itemNotDecodable'
  | 'carriageReturn'
  | 'lineBreak'
  | 'ownsNoBytes';

/** Whether one list may be edited, and why not when it may not. */
export type ListEligibility =
  | {
      /** The list may be drafted. */
      readonly kind: 'editable';
    }
  | {
      /** The list is shown and not edited. */
      readonly kind: 'readOnly';
      /** Why, as a code. */
      readonly reason: ListRefusal;
    };

/** The one editable verdict, shared. */
const EDITABLE: ListEligibility = Object.freeze({ kind: 'editable' as const });

/**
 * What the file held for one list when the session was seeded. **Not drafted.**
 */
export interface ListBaseline {
  /** Which list. */
  readonly field: SequenceField;
  /** The file's own presentation of it. */
  readonly style: ListStyle;
  /**
   * Each item's text, in the file's order: the decoded value for a text item,
   * and `''` for one that is not text (such a list is read-only, so the
   * placeholder is never a value anything below writes).
   */
  readonly items: readonly string[];
  /** Whether the list may be drafted, and why not. */
  readonly eligibility: ListEligibility;
}

/** One item of a drafted list. */
export interface ListItemBuffer {
  /**
   * The item's index in the file's list, or `null` for an item the draft adds.
   * A kept item's origin is what names it on the wire.
   */
  readonly origin: number | null;
  /** What its one-line control holds. */
  readonly text: string;
}

/**
 * What one list's controls hold. **The draft side**, snapshotted and undone with
 * the rest of the editor's buffers.
 */
export interface ListBuffer {
  /** Whether the drafted snippet holds the list at all. */
  readonly present: boolean;
  /** The drafted items, in order. Empty for an absent list, and for `[]`. */
  readonly items: readonly ListItemBuffer[];
}

/**
 * The style one presence state reports.
 *
 * @param presence - The projection's presence for the list.
 * @returns The style.
 */
function styleOf(presence: SequencePresence): ListStyle {
  if ('Absent' in presence) {
    return 'absent';
  }
  if ('Empty' in presence) {
    return 'empty';
  }
  if ('Items' in presence) {
    return presence.Items.flow ? 'flow' : 'block';
  }
  return 'unsupported';
} // End of function styleOf()

/**
 * Why one item stops its list being drafted, or `null`.
 *
 * @param value - The item as it crossed the boundary.
 * @returns The refusal, or `null` for an editable text item.
 */
function itemRefusalOf(value: ValueView): ListRefusal | null {
  if (!('Scalar' in value)) {
    return 'itemNotText';
  }
  const scalar = value.Scalar;
  if (!scalar.decoded) {
    return 'itemNotDecodable';
  }
  if (scalar.text.includes('\r')) {
    return 'carriageReturn';
  }
  if (scalar.text.includes('\n')) {
    return 'lineBreak';
  }
  return scalar.span.start === scalar.span.end ? 'ownsNoBytes' : null;
} // End of function itemRefusalOf()

/**
 * What the file holds for one list, and whether it may be drafted.
 *
 * The checks are in the order a reader would ask them: is it a list at all, is
 * it one list, and is every item one line of text this window can give back.
 *
 * @param field - Which list.
 * @param presence - The projection's presence for it.
 * @param values - Its items as they crossed the boundary, in file order.
 * @param unknownKeys - The keys of the match's unknown entries.
 * @returns The baseline, frozen.
 */
export function listBaselineOf(
  field: SequenceField,
  presence: SequencePresence,
  values: readonly ValueView[],
  unknownKeys: readonly (string | null)[]
): ListBaseline {
  const style = styleOf(presence);
  let eligibility: ListEligibility = EDITABLE;
  if (style === 'unsupported') {
    eligibility = { kind: 'readOnly', reason: 'unsupportedShape' };
  } else if (unknownKeys.includes(field)) {
    eligibility = { kind: 'readOnly', reason: 'unmodelledShape' };
  } else {
    for (const value of values) {
      const refusal = itemRefusalOf(value);
      if (refusal !== null) {
        eligibility = { kind: 'readOnly', reason: refusal };
        break;
      }
    } // End of the loop over the list's items
  }
  return Object.freeze({
    field,
    style,
    items: Object.freeze(values.map((value) => ('Scalar' in value ? value.Scalar.text : ''))),
    eligibility
  });
} // End of function listBaselineOf()

/**
 * The buffer a session starts with: the file's own list, every item kept.
 *
 * @param baseline - What the file holds.
 * @returns The starting buffer.
 */
export function listBufferOf(baseline: ListBaseline): ListBuffer {
  return {
    present: baseline.style !== 'absent' && baseline.style !== 'unsupported',
    items: baseline.items.map((text, origin) => ({ origin, text }))
  };
} // End of function listBufferOf()

/**
 * A list buffer copied into plain values, so it is read exactly once — the
 * check-and-spend rule of `CLAUDE.md` section 6: a buffer carries no brand, and
 * a caller can hand in one whose properties are getters.
 *
 * @param buffer - The buffer as handed in.
 * @returns A plain copy.
 */
export function capturedList(buffer: ListBuffer): ListBuffer {
  const items = buffer.items;
  return {
    present: buffer.present,
    items: Array.from(items, (item) => ({ origin: item.origin, text: item.text }))
  };
} // End of function capturedList()

/**
 * Whether a text cannot pass through an item's one-line control unchanged.
 *
 * @param text - A value for one item.
 * @returns `true` when it holds a carriage return or a line feed.
 */
export function unreadableItem(text: string): boolean {
  return text.includes('\r') || text.includes('\n');
} // End of function unreadableItem()

/**
 * The buffer with one item's text replaced, or `null` when that is refused.
 *
 * @param buffer - What the controls hold.
 * @param position - The item's position in the drafted array.
 * @param text - Its control's whole value.
 * @returns The new buffer, or `null` for an absent list, a position the array
 *   does not have, a text a one-line control cannot hold, or no change.
 */
export function withItemText(
  buffer: ListBuffer,
  position: number,
  text: string
): ListBuffer | null {
  const item = buffer.items[position];
  if (!buffer.present || item === undefined || unreadableItem(text) || item.text === text) {
    return null;
  }
  const items = buffer.items.slice();
  items[position] = { origin: item.origin, text };
  return { present: true, items };
} // End of function withItemText()

/**
 * The buffer with one new item added, or `null` when that is refused.
 *
 * @param buffer - What the controls hold.
 * @param position - Where in the drafted array the new item goes, `0` to the
 *   array's length.
 * @param text - Its text, possibly empty.
 * @returns The new buffer, or `null` for an absent list, a position outside the
 *   array, or a text a one-line control cannot hold.
 */
export function withItemAdded(
  buffer: ListBuffer,
  position: number,
  text: string
): ListBuffer | null {
  if (
    !buffer.present ||
    !Number.isInteger(position) ||
    position < 0 ||
    position > buffer.items.length ||
    unreadableItem(text)
  ) {
    return null;
  }
  const items = buffer.items.slice();
  items.splice(position, 0, { origin: null, text });
  return { present: true, items };
} // End of function withItemAdded()

/**
 * The buffer with one item taken out, or `null` when that is refused.
 *
 * **The last item is refused** (ruling 6): a list with nothing left would have
 * to be `[]` or a bare null key, and neither is "remove an item".
 * {@link withListRemoved} is the explicit intent for no list.
 *
 * @param buffer - What the controls hold.
 * @param position - The item's position in the drafted array.
 * @returns The new buffer, or `null`.
 */
export function withItemRemoved(buffer: ListBuffer, position: number): ListBuffer | null {
  if (!buffer.present || buffer.items[position] === undefined || buffer.items.length <= 1) {
    return null;
  }
  const items = buffer.items.slice();
  items.splice(position, 1);
  return { present: true, items };
} // End of function withItemRemoved()

/**
 * The buffer holding a new, empty list where the file holds none, or `null`.
 *
 * @param baseline - What the file holds.
 * @param buffer - What the controls hold.
 * @returns The new buffer, or `null` when the list is already drafted present.
 */
export function withListAdded(baseline: ListBaseline, buffer: ListBuffer): ListBuffer | null {
  if (buffer.present || baseline.style === 'unsupported') {
    return null;
  }
  // A list the file held and the draft removed comes back whole: adding it again
  // is taking the removal back, and a field removed and added in one batch is
  // two intents about one list, which Rust refuses.
  return baseline.style === 'absent' ? { present: true, items: [] } : listBufferOf(baseline);
} // End of function withListAdded()

/**
 * The buffer with the whole list drafted away, or `null`.
 *
 * @param buffer - What the controls hold.
 * @returns The new buffer, or `null` when the list is already drafted absent.
 */
export function withListRemoved(buffer: ListBuffer): ListBuffer | null {
  return buffer.present ? { present: false, items: buffer.items } : null;
} // End of function withListRemoved()

/** Why a drafted list cannot be sent as it stands. A code, never a sentence. */
export type ListProblem =
  /** Kept items are not in the file's own order, or name an item twice. */
  | 'notInOrder'
  /** Every original item is removed and new ones are added: a rewrite. */
  | 'everyItemReplaced'
  /** A present list with no item left, reached by removals. */
  | 'wouldBeEmpty';

/** What one drafted list derives. */
export type ListDerivation =
  | {
      /** The draft says nothing about this list. */
      readonly kind: 'unchanged';
    }
  | {
      /** The draft changes the list: these edits and these intents. */
      readonly kind: 'changed';
      /** Rewritten items, by their index in the file's list. */
      readonly items: readonly ItemDraft[];
      /** Items or the whole list added or removed. */
      readonly sequences: readonly SequenceIntent[];
    }
  | {
      /** The drafted list cannot be sent. */
      readonly kind: 'refused';
      /** Why. */
      readonly problem: ListProblem;
    };

/** The derivation of a list the draft leaves alone, shared. */
const UNCHANGED: ListDerivation = Object.freeze({ kind: 'unchanged' as const });

/**
 * Where a run of new items is placed so it lands immediately above the next
 * kept item, or at the end when none follows.
 *
 * @param next - The origin of the next kept item, or `null`.
 * @returns The placement, in the file's list.
 */
function placementAbove(next: number | null): ListPlacement {
  if (next === null) {
    return { End: {} };
  }
  return next === 0 ? { Front: {} } : { After: { index: next - 1 } };
} // End of function placementAbove()

/**
 * The removals and insertions of a **flow** list, gap by gap — Phase 3-6-1's
 * review fix.
 *
 * In a flow list a removal takes the item **and** a separator, so an insertion
 * placed `After` a removed item starts inside the removal's span and the engine
 * refuses the batch as overlapping (a block list removes whole lines, so the same
 * placement is disjoint there and keeps {@link listDerivationOf}'s own rule). So
 * within each gap between two kept items (or an end of the list), the new items
 * **take the removed items' places in order**: the first new item rewrites the
 * first removed item as an `ItemDraft`, and so on; removed items left over are
 * `RemoveItem`s, and new items left over are inserted after the last rewritten
 * one — or, in a gap that removed nothing, above the next kept item. Every
 * generated span is then disjoint and the file holds exactly the drafted order.
 * What it trades, stated: a rewritten item keeps any comment the file wrote
 * inside the brackets beside it, where a removal would have taken it.
 *
 * @param baseline - What the file holds; a flow list.
 * @param buffer - What the controls hold, read once, its kept items in order.
 * @param items - The item rewrites being built, appended to.
 * @param sequences - The list intents being built, appended to.
 */
function flowGapIntents(
  baseline: ListBaseline,
  buffer: ListBuffer,
  items: ItemDraft[],
  sequences: SequenceIntent[]
): void {
  const field = baseline.field;
  let previous = -1;
  let fresh: string[] = [];
  for (let position = 0; position <= buffer.items.length; position += 1) {
    const item = buffer.items[position];
    if (item !== undefined && item.origin === null) {
      fresh.push(item.text);
      continue;
    }
    const next = item === undefined ? baseline.items.length : (item.origin ?? baseline.items.length);
    const removed: number[] = [];
    for (let index = previous + 1; index < next; index += 1) {
      removed.push(index);
    } // End of the loop over the gap's removed items
    const paired = Math.min(removed.length, fresh.length);
    for (let at = 0; at < paired; at += 1) {
      const index = removed[at]!;
      const text = fresh[at]!;
      if (text !== baseline.items[index]) {
        items.push({ index, value: { Set: text } });
      }
    } // End of the loop that rewrites removed items in place
    for (const index of removed.slice(paired)) {
      sequences.push({ RemoveItem: { field, index } });
    } // End of the loop over the removals left over
    const left = fresh.slice(paired);
    if (left.length > 0) {
      const at: ListPlacement =
        paired > 0
          ? { After: { index: removed[paired - 1]! } }
          : placementAbove(item === undefined ? null : item.origin);
      sequences.push({ InsertItems: { field, at, items: left } });
    }
    fresh = [];
    previous = next;
  } // End of the loop over the gaps between kept items
} // End of function flowGapIntents()

/**
 * What one drafted list asks of a save.
 *
 * **The only producer of a list's wire intents.** An ineligible list derives
 * nothing, whatever its buffer holds — the last line before a value this window
 * could not give back reaches a file. The rules, in the order they apply:
 *
 * | The file | The draft | Derives |
 * |---|---|---|
 * | absent | absent | nothing |
 * | absent | present | `InsertField` with the items (none: `[]`) |
 * | present | absent | `RemoveField` |
 * | present | present | an `ItemDraft` per edited kept item, a `RemoveItem` per dropped item, an `InsertItems` per run of new items |
 *
 * @param baseline - What the file holds.
 * @param buffer - What the controls hold, **read once by the caller**
 *   ({@link capturedList}).
 * @returns The derivation.
 */
export function listDerivationOf(baseline: ListBaseline, buffer: ListBuffer): ListDerivation {
  if (baseline.eligibility.kind !== 'editable') {
    return UNCHANGED;
  }
  const field = baseline.field;
  const held = baseline.style !== 'absent';
  if (!held) {
    return buffer.present
      ? {
          kind: 'changed',
          items: [],
          sequences: [{ InsertField: { field, items: buffer.items.map((item) => item.text) } }]
        }
      : UNCHANGED;
  }
  if (!buffer.present) {
    return { kind: 'changed', items: [], sequences: [{ RemoveField: { field } }] };
  }
  const items: ItemDraft[] = [];
  const sequences: SequenceIntent[] = [];
  const kept = new Set<number>();
  let last = -1;
  for (const item of buffer.items) {
    if (item.origin === null) {
      continue;
    }
    if (
      !Number.isInteger(item.origin) ||
      item.origin <= last ||
      item.origin >= baseline.items.length
    ) {
      return { kind: 'refused', problem: 'notInOrder' };
    }
    last = item.origin;
    kept.add(item.origin);
    if (item.text !== baseline.items[item.origin]) {
      items.push({ index: item.origin, value: { Set: item.text } });
    }
  } // End of the loop over the kept items
  const added = buffer.items.some((item) => item.origin === null);
  if (buffer.items.length === 0) {
    return baseline.items.length === 0 ? UNCHANGED : { kind: 'refused', problem: 'wouldBeEmpty' };
  }
  if (baseline.items.length > 0 && kept.size === 0 && added) {
    return { kind: 'refused', problem: 'everyItemReplaced' };
  }
  if (baseline.style === 'flow') {
    flowGapIntents(baseline, buffer, items, sequences);
  } else {
    baseline.items.forEach((_text, index) => {
      if (!kept.has(index)) {
        sequences.push({ RemoveItem: { field, index } });
      }
    });
    let run: string[] = [];
    for (let position = 0; position <= buffer.items.length; position += 1) {
      const item = buffer.items[position];
      if (item !== undefined && item.origin === null) {
        run.push(item.text);
        continue;
      }
      if (run.length > 0) {
        sequences.push({
          InsertItems: { field, at: placementAbove(item === undefined ? null : item.origin), items: run }
        });
        run = [];
      }
    } // End of the loop that places each run of new items
  }
  return items.length === 0 && sequences.length === 0
    ? UNCHANGED
    : { kind: 'changed', items, sequences };
} // End of function listDerivationOf()

/**
 * The texts a drafted list leaves in the file, or `null` when it leaves no list.
 *
 * @param baseline - What the file holds.
 * @param buffer - What the controls hold, read once by the caller.
 * @returns The item texts in order, or `null`.
 */
export function intendedTexts(
  baseline: ListBaseline,
  buffer: ListBuffer
): readonly string[] | null {
  if (baseline.eligibility.kind !== 'editable') {
    return baseline.style === 'absent' ? null : baseline.items;
  }
  return buffer.present ? buffer.items.map((item) => item.text) : null;
} // End of function intendedTexts()

/**
 * Whether two readings of one list are, for a save's purposes, the same list.
 *
 * **Presence, style, every item's text in order, and eligibility.** An item
 * moved, added, removed or retyped, a flow list rewritten as block, a list that
 * became unreadable — each is a different list.
 *
 * @param was - What the file held when the session was seeded.
 * @param now - What the newly parsed projection holds.
 * @returns `true` when nothing about the list moved.
 */
export function sameListState(was: ListBaseline, now: ListBaseline): boolean {
  return (
    was.style === now.style &&
    was.items.length === now.items.length &&
    was.items.every((text, index) => now.items[index] === text) &&
    (was.eligibility.kind === 'editable'
      ? now.eligibility.kind === 'editable'
      : now.eligibility.kind === 'readOnly' && now.eligibility.reason === was.eligibility.reason)
  );
} // End of function sameListState()

/**
 * What a reapply may do with one drafted list — ruling 23, the conservative
 * rule.
 *
 * - `unchanged` — the draft says nothing about the list;
 * - `applicable` — the new projection holds the list exactly as the draft's
 *   baseline did, so every index the draft names still means the same item;
 * - `satisfied` — the new projection already holds the **whole** intended
 *   result, items and order, as an editable list;
 * - `collision` — anything else, and **the whole list collides**: an external
 *   reorder, an item added or removed or retyped, a style change, a list that
 *   appears twice (a repeated key reads `unmodelledShape`) or became unreadable.
 *   No item-by-item merge is attempted, because matching items by text is exactly
 *   the ambiguity a duplicated item makes unanswerable.
 */
export type ListReapplyVerdict = 'unchanged' | 'applicable' | 'satisfied' | 'collision';

/**
 * The reapply verdict of one drafted list.
 *
 * @param was - What the file held when the session was seeded.
 * @param buffer - What the retained draft holds, read once by the caller.
 * @param now - What the newly parsed projection holds.
 * @returns The verdict.
 */
export function listReapply(
  was: ListBaseline,
  buffer: ListBuffer,
  now: ListBaseline
): ListReapplyVerdict {
  const derived = listDerivationOf(was, buffer);
  if (derived.kind === 'unchanged') {
    return 'unchanged';
  }
  if (derived.kind === 'changed' && sameListState(was, now)) {
    return 'applicable';
  }
  const intended = intendedTexts(was, buffer);
  if (now.eligibility.kind !== 'editable') {
    return 'collision';
  }
  if (intended === null) {
    return now.style === 'absent' ? 'satisfied' : 'collision';
  }
  const holds = now.style !== 'absent';
  return holds &&
    now.items.length === intended.length &&
    intended.every((text, index) => now.items[index] === text)
    ? 'satisfied'
    : 'collision';
} // End of function listReapply()

/**
 * The buffer a reapply holds over the new projection for one list.
 *
 * `applicable` keeps the retained buffer, whose origins still name the same
 * items because the list did not move; every other verdict holds what the new
 * projection holds, so the rebuilt draft says nothing about the list.
 *
 * @param verdict - What {@link listReapply} answered.
 * @param buffer - What the retained draft holds.
 * @param now - What the newly parsed projection holds.
 * @returns The buffer to hold.
 */
export function rebuiltList(
  verdict: ListReapplyVerdict,
  buffer: ListBuffer,
  now: ListBaseline
): ListBuffer {
  return verdict === 'applicable' ? capturedList(buffer) : listBufferOf(now);
} // End of function rebuiltList()

/**
 * The baseline a committed save leaves for one list: what was written becomes
 * what the file holds.
 *
 * **The style is predicted, not observed** — a list created by a save is block
 * style (`[]` when empty), a list that was `[]` and gained items is a flow list,
 * and a held list keeps its style; the re-projection the commit owes is what
 * reports the file's own. Eligibility is carried, as `committedBaseline` in
 * `./matchEditor.ts` carries every field's.
 *
 * @param baseline - What the file held before the save.
 * @param buffer - The candidate that was written, read once by the caller.
 * @returns The baseline to measure the next edit against.
 */
export function committedList(baseline: ListBaseline, buffer: ListBuffer): ListBaseline {
  const texts = intendedTexts(baseline, buffer);
  if (texts === null) {
    return Object.freeze({ ...baseline, style: 'absent', items: Object.freeze([]) });
  }
  let style: ListStyle = baseline.style;
  if (style === 'absent') {
    style = texts.length === 0 ? 'empty' : 'block';
  } else if (style === 'empty' && texts.length > 0) {
    style = 'flow';
  }
  return Object.freeze({ ...baseline, style, items: Object.freeze([...texts]) });
} // End of function committedList()

/** What one drafted item is to the file. */
export type ListItemStatus = 'kept' | 'edited' | 'added';

/** One drafted item, as the thing a screen draws. */
export interface ListItemModel {
  /** Its position in the drafted array — what the transitions take. */
  readonly position: number;
  /** Its index in the file's list, or `null` for a new item. */
  readonly origin: number | null;
  /** What its control holds. */
  readonly text: string;
  /** Kept as the file has it, edited, or added by the draft. */
  readonly status: ListItemStatus;
}

/** One item of the file's list the draft takes out. */
export interface RemovedListItem {
  /** Its index in the file's list. */
  readonly origin: number;
  /** Its text as the file holds it. */
  readonly text: string;
}

/**
 * The drafted items with their status, and the file's items the draft removes.
 *
 * @param baseline - What the file holds.
 * @param buffer - What the controls hold, read once by the caller.
 * @returns The two lists, in drafted order and in file order.
 */
export function listRowsOf(
  baseline: ListBaseline,
  buffer: ListBuffer
): { readonly items: readonly ListItemModel[]; readonly removed: readonly RemovedListItem[] } {
  const items: ListItemModel[] = buffer.items.map((item, position) => ({
    position,
    origin: item.origin,
    text: item.text,
    status:
      item.origin === null
        ? 'added'
        : baseline.items[item.origin] === item.text
          ? 'kept'
          : 'edited'
  }));
  const kept = new Set(buffer.items.map((item) => item.origin));
  const removed: RemovedListItem[] =
    baseline.style === 'absent'
      ? []
      : buffer.present
        ? baseline.items
            .map((text, origin) => ({ origin, text }))
            .filter((one) => !kept.has(one.origin))
        : baseline.items.map((text, origin) => ({ origin, text }));
  return { items, removed };
} // End of function listRowsOf()

/**
 * Every text a drafted list's wire intents would write.
 *
 * @param derivation - What {@link listDerivationOf} answered.
 * @returns The texts, in no particular order.
 */
export function textsWritten(derivation: ListDerivation): readonly string[] {
  if (derivation.kind !== 'changed') {
    return [];
  }
  const texts: string[] = derivation.items.flatMap((item) =>
    typeof item.value === 'object' ? [item.value.Set] : []
  );
  for (const intent of derivation.sequences) {
    if ('InsertItems' in intent) {
      texts.push(...intent.InsertItems.items);
    } else if ('InsertField' in intent) {
      texts.push(...intent.InsertField.items);
    }
  } // End of the loop over the derived intents
  return texts;
} // End of function textsWritten()

/**
 * The label the detail pane already has a sentence for.
 *
 * @param field - Which list.
 * @returns `triggers` or `searchTerms`.
 */
export function listLabelName(field: SequenceField): DetailFieldName {
  return field === 'triggers' ? 'triggers' : 'searchTerms';
} // End of function listLabelName()

/**
 * The dictionary key holding one list refusal's sentence.
 *
 * @param reason - Why the list may not be edited.
 * @returns The key.
 */
export function listRefusalKey(reason: ListRefusal): TranslationKey {
  switch (reason) {
    case 'unsupportedShape':
      return 'browser.matchEditor.list.readOnly.unsupportedShape';
    case 'unmodelledShape':
      return 'browser.matchEditor.list.readOnly.unmodelledShape';
    case 'itemNotText':
      return 'browser.matchEditor.list.readOnly.itemNotText';
    case 'itemNotDecodable':
      return 'browser.matchEditor.list.readOnly.itemNotDecodable';
    case 'carriageReturn':
      return 'browser.matchEditor.list.readOnly.carriageReturn';
    case 'lineBreak':
      return 'browser.matchEditor.list.readOnly.lineBreak';
    case 'ownsNoBytes':
      return 'browser.matchEditor.list.readOnly.ownsNoBytes';
  }
} // End of function listRefusalKey()
