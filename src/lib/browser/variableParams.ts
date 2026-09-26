/**
 * An existing variable's parameters, `depends_on` and list items — Phase 4-14-2:
 * the part of one variable the shared variable editor (`./variableEditor.ts`)
 * drafts beyond its `name`, `type` and `inject_vars`.
 *
 * **A submodel of a submodel, never a second lifecycle.** Everything here is a
 * pure value or a pure function over one variable's baseline row and buffer row;
 * `./variableEditor.ts` composes it into `VariableRowBaseline` /
 * `VariableRowBuffer`, so the match editor's one `Draft<MatchBuffers>` snapshots,
 * undoes, retains, copies and reapplies it with every other field (ruling 24).
 * The session transitions are `./matchEditor.ts`'s; the view is
 * `./variableGroup.ts`'s; `../components/VariableGroup.svelte` draws it.
 *
 * ## What is drafted
 *
 * - **A scalar `params` entry**: one box, sent as `EntryDraft.value`. An entry
 *   keyed `offset`, `trim` or `debug` ({@link PLAIN_SOURCE_PARAMS}) is a typed
 *   setting: its box is one line and Rust writes it as plain source, refusing by
 *   name a text that cannot be (ruling 4; `plan_open_mapping` in
 *   `crates/espansoconfig-core/src/draft/plan.rs`). Every other entry is a
 *   logical string spelled by the codec. Nothing here interprets either (D2u).
 * - **A `params` entry holding a flat list of scalars**: one box per item, sent
 *   as `EntryDraft.items`. When the list is the variable kind's own list —
 *   `values` of a `choice`, `choices` of a `random`, `args` of a `script` —
 *   items can also be taken out and added at the end (`VariableDraft.lists`).
 * - **`depends_on`**: one one-line box per item, sent as `VariableDraft.depends_on`;
 *   items taken out and added at the end through `VariableDraft.lists`.
 *
 * A verbose form's `layout` and `fields` are **not** here: `./formEditor.ts`
 * drafts them, and `withVerboseForms` merges its `params` drafts beside these.
 * Anything else — a mapping, an alias, a `{label, id}` record, a key that is not
 * one addressable text — is shown as not edited here, with the reason.
 *
 * ## The rules it keeps
 *
 * - **A box never holds a carriage return**, at load (a value holding one is
 *   read-only), at edit (refused) and at send (`variableTextsOf` in
 *   `./variableEditor.ts`, checked by `beginSave`); a one-line box never holds a
 *   line feed.
 * - **A text left as the file holds it is `'Unchanged'`**; an edited text is sent
 *   exactly as typed, however unfamiliar.
 * - **A list is never emptied here**: the last item left cannot be taken out (Rust
 *   refuses it too, `VariableListWouldBeEmpty`); a list's removal is not offered.
 * - **A removed item's box keeps its text and sends nothing**, so a restoration
 *   gives it back and Rust never sees a removal and a rewrite of one item.
 */

import type { TranslationKey } from '../i18n/dictionaries';
import type {
  EntryDraft,
  FieldView,
  ItemDraft,
  ScalarStyle,
  ScalarView,
  SequencePresence,
  ValueView,
  VariableKind,
  VariableList,
  VariableListIntent,
  VariableView
} from '../ipc/types';
import type { RetainedDraftField } from './saveOutcome';

// ---------------------------------------------------------------------------
// The projection side
// ---------------------------------------------------------------------------

/**
 * The `params` keys a variable writes as plain source — ruling 4, the same three
 * `PLAIN_SOURCE_PARAMS` names in `crates/espansoconfig-core/src/draft/new_variable.rs`
 * and `OpenMapping::typed_setting` answers for a variable's `params`. Decided by
 * the key alone, whatever the variable's `type` says, as Rust decides it.
 */
export const PLAIN_SOURCE_PARAMS: readonly ('offset' | 'trim' | 'debug')[] = ['offset', 'trim', 'debug'];

/**
 * Why one parameter text is shown and not edited — a code, never a sentence
 * ({@link paramRefusalKey}).
 *
 * The first four are `./matchEditor.ts`'s `FieldRefusal` codes for the same
 * reasons and share their sentences:
 * - `notDecodable`, `carriageReturn`, `ownsNoBytes`, `lineBreak` (a one-line box
 *   over a text holding a line feed);
 * and this module's own:
 * - `keyNotNameable` — the entry's key is not one decoded text, or another entry
 *   of `params` has the same key, so Rust cannot address it;
 * - `notText` — the value (or the item) is a mapping, an alias, a `{label, id}`
 *   record or anything else that is not one text.
 */
export type ParamRefusal =
  | 'notDecodable'
  | 'carriageReturn'
  | 'ownsNoBytes'
  | 'lineBreak'
  | 'keyNotNameable'
  | 'notText';

/** What the file holds for one text a box drafts. Not drafted. */
export interface TextBaseline {
  /** The projected logical value, `''` when there is none. */
  readonly value: string;
  /** Why it is not a box, or `null` when it is. */
  readonly refusal: ParamRefusal | null;
  /** How the file writes it, when that is not plain (D2u: said beside the box). */
  readonly style: ScalarStyle | null;
}

/** What the file holds for one flat list a variable drafts by item. Not drafted. */
export interface ListBaseline {
  /** One per item, in source order. */
  readonly items: readonly TextBaseline[];
  /**
   * The list as Rust names it for an insertion or a removal, or `null` when
   * items cannot be added or taken out here (not the kind's own list, not a
   * written list with items, a `params` written as a flow mapping, or an item
   * that is not a text).
   */
  readonly list: VariableList | null;
  /** Whether the file writes it between brackets. */
  readonly flow: boolean;
  /** Whether its boxes are one line (`depends_on`) — every item box is. */
  readonly oneLine: true;
}

/** One `params` entry of an existing variable. Not drafted. */
export interface ParamBaseline {
  /** The entry's position in the projected `params`. */
  readonly entry: number;
  /** The key's text, as projected, `''` for a key that is not a scalar. */
  readonly key: string;
  /** Whether the key is one of {@link PLAIN_SOURCE_PARAMS}. */
  readonly plainSource: boolean;
  /** What the value is. */
  readonly value:
    | { readonly kind: 'text'; readonly text: TextBaseline; readonly oneLine: boolean }
    | { readonly kind: 'list'; readonly list: ListBaseline }
    | { readonly kind: 'other'; readonly refusal: ParamRefusal };
}

/** What the file holds for one variable's drafted parameters and dependencies. */
export interface ParamsBaseline {
  /** The drafted `params` entries, in source order — a verbose form's two excluded. */
  readonly params: readonly ParamBaseline[];
  /** `depends_on`, or `null` when the variable does not write it as a list. */
  readonly dependsOn: ListBaseline | null;
}

/**
 * One scalar's baseline, by `./matchEditor.ts`'s eligibility order: decoded, a
 * carriage return, a zero-width span, a line feed in a one-line box.
 *
 * @param scalar - The projected scalar.
 * @param oneLine - Whether its box is one line.
 * @returns The baseline.
 */
function textBaselineOf(scalar: ScalarView, oneLine: boolean): TextBaseline {
  const style = scalar.style === 'Plain' ? null : scalar.style;
  /**
   * The baseline with a refusal.
   *
   * @param refusal - Why it is not a box.
   * @returns The baseline.
   */
  const refused = (refusal: ParamRefusal): TextBaseline => ({ value: scalar.text, refusal, style });
  if (!scalar.decoded) {
    return refused('notDecodable');
  }
  if (scalar.text.includes('\r')) {
    return refused('carriageReturn');
  }
  if (scalar.span.start === scalar.span.end) {
    return refused('ownsNoBytes');
  }
  if (oneLine && scalar.text.includes('\n')) {
    return refused('lineBreak');
  }
  return { value: scalar.text, refusal: null, style };
} // End of function textBaselineOf()

/**
 * One item's baseline: a scalar's, or `notText`.
 *
 * @param item - The projected item.
 * @returns The baseline.
 */
function itemBaselineOf(item: ValueView): TextBaseline {
  return 'Scalar' in item ? textBaselineOf(item.Scalar, true) : { value: '', refusal: 'notText', style: null };
} // End of function itemBaselineOf()

/**
 * The kind's own list parameter key — `list_entry` in Rust's planner.
 *
 * @param kind - The variable's kind.
 * @returns The key and the list name, or `null` for a kind with none.
 */
function kindListOf(kind: VariableKind): VariableList | null {
  switch (kind) {
    case 'Choice':
      return 'values';
    case 'Random':
      return 'choices';
    case 'Script':
      return 'args';
    default:
      return null;
  }
} // End of function kindListOf()

/**
 * Whether a presence is a written list with items, block or flow.
 *
 * @param presence - The presence.
 * @returns Its flow flag, or `null` when it is not a list with items.
 */
function itemsFlow(presence: SequencePresence | null): boolean | null {
  return presence !== null && 'Items' in presence ? presence.Items.flow : null;
} // End of function itemsFlow()

/**
 * One list's baseline.
 *
 * @param items - Its projected items.
 * @param list - Rust's name for it, when items may be added and taken out.
 * @param presence - Its presence.
 * @returns The baseline.
 */
function listBaselineOf(
  items: readonly ValueView[],
  list: VariableList | null,
  presence: SequencePresence | null
): ListBaseline {
  const texts = items.map(itemBaselineOf);
  const flow = itemsFlow(presence);
  const everyText = items.every((item) => 'Scalar' in item);
  return {
    items: texts,
    list: flow !== null && everyText ? list : null,
    flow: flow === true,
    oneLine: true
  };
} // End of function listBaselineOf()

/**
 * Whether one entry's key can be addressed: a decoded scalar no other entry
 * shares (`nameable_key` in Rust's planner).
 *
 * @param params - Every entry.
 * @param index - The entry's position.
 * @returns `true` when it can.
 */
function nameable(params: readonly FieldView[], index: number): boolean {
  const key = params[index]?.key ?? null;
  if (key === null || !key.decoded) {
    return false;
  }
  return params.every(
    (other, at) => at === index || other.key === null || !other.key.decoded || other.key.text !== key.text
  );
} // End of function nameable()

/**
 * Whether one entry is a verbose form's own — `layout` or `fields` of a `form`
 * variable, which `./formEditor.ts` drafts.
 *
 * @param kind - The variable's kind.
 * @param entry - The entry.
 * @returns `true` when it is.
 */
function formOwned(kind: VariableKind, entry: FieldView): boolean {
  return (
    kind === 'Form' &&
    entry.key !== null &&
    entry.key.decoded &&
    (entry.key.text === 'layout' || entry.key.text === 'fields')
  );
} // End of function formOwned()

/**
 * What the file holds for one variable's parameters and dependencies.
 *
 * @param view - The variable, an owned copy.
 * @returns The baseline.
 */
export function paramsBaselineOf(view: VariableView): ParamsBaseline {
  const kindList = kindListOf(view.kind);
  const flowParams = 'Entries' in view.params_presence && view.params_presence.Entries.flow;
  let kindListSeen = false;
  const params: ParamBaseline[] = [];
  view.params.forEach((entry, index) => {
    if (formOwned(view.kind, entry)) {
      return;
    }
    const key = entry.key === null ? '' : entry.key.text;
    const plainSource = PLAIN_SOURCE_PARAMS.some((one) => one === key) && entry.key?.decoded === true;
    const value = entry.value;
    let drafted: ParamBaseline['value'];
    if (!nameable(view.params, index)) {
      drafted = { kind: 'other', refusal: 'keyNotNameable' };
    } else if ('Scalar' in value) {
      // A typed setting is one line; every other text may hold a line feed.
      drafted = { kind: 'text', text: textBaselineOf(value.Scalar, plainSource), oneLine: plainSource };
    } else if ('Sequence' in value && value.Sequence.every((item) => 'Scalar' in item || 'Mapping' in item)) {
      // Rust's `list_entry` is the first entry with the kind's key.
      const theKindList = kindList !== null && key === kindList && !kindListSeen;
      if (theKindList) {
        kindListSeen = true;
      }
      drafted = {
        kind: 'list',
        list: listBaselineOf(
          value.Sequence,
          theKindList && !flowParams ? kindList : null,
          theKindList ? view.list_param_presence : null
        )
      };
    } else {
      drafted = { kind: 'other', refusal: 'notText' };
    }
    params.push({ entry: index, key, plainSource, value: drafted });
  }); // End of the walk over the variable's params
  const dependsOn =
    'Absent' in view.depends_on_presence || 'UnsupportedShape' in view.depends_on_presence
      ? null
      : listBaselineOf(view.depends_on, 'depends_on', view.depends_on_presence);
  return { params, dependsOn };
} // End of function paramsBaselineOf()

// ---------------------------------------------------------------------------
// The draft side
// ---------------------------------------------------------------------------

/** What the controls hold for one list. */
export interface ListBuffer {
  /** One per baseline item: its box, and whether it is drafted for removal. */
  readonly items: readonly { readonly text: string; readonly removed: boolean }[];
  /** New items, written at the end of the list in this order. Never empty. */
  readonly added: readonly string[];
}

/** What the controls hold for one `params` entry, parallel to its baseline. */
export interface ParamBuffer {
  /** The text box's value — `''` for an entry that is not a text. */
  readonly text: string;
  /** The list's boxes, or `null` for an entry that is not a list. */
  readonly list: ListBuffer | null;
}

/** What the controls hold for one variable's parameters and dependencies. */
export interface ParamsBuffer {
  /** Parallel to {@link ParamsBaseline.params}. */
  readonly params: readonly ParamBuffer[];
  /** Parallel to {@link ParamsBaseline.dependsOn}. */
  readonly dependsOn: ListBuffer | null;
}

/**
 * A list's starting boxes.
 *
 * @param list - Its baseline.
 * @returns The buffer.
 */
function listBufferOf(list: ListBaseline): ListBuffer {
  return { items: list.items.map((item) => ({ text: item.value, removed: false })), added: [] };
} // End of function listBufferOf()

/**
 * The boxes a session starts with: every one holding the file's value.
 *
 * @param baseline - What the file holds.
 * @returns The buffer.
 */
export function paramsBufferOf(baseline: ParamsBaseline): ParamsBuffer {
  return {
    params: baseline.params.map((param) => ({
      text: param.value.kind === 'text' ? param.value.text.value : '',
      list: param.value.kind === 'list' ? listBufferOf(param.value.list) : null
    })),
    dependsOn: baseline.dependsOn === null ? null : listBufferOf(baseline.dependsOn)
  };
} // End of function paramsBufferOf()

/**
 * A list's boxes copied into plain values.
 *
 * @param list - The boxes.
 * @returns A plain copy.
 */
function capturedList(list: ListBuffer): ListBuffer {
  return {
    items: list.items.map((item) => ({ text: String(item.text), removed: item.removed === true })),
    added: list.added.map((text) => String(text))
  };
} // End of function capturedList()

/**
 * The buffer copied into plain values, read exactly once — the check-and-spend
 * rule of `CLAUDE.md` section 6 (`capturedVariables` calls it).
 *
 * @param buffer - What the controls hold.
 * @returns A plain copy.
 */
export function capturedParams(buffer: ParamsBuffer): ParamsBuffer {
  return {
    params: buffer.params.map((param) => ({
      text: String(param.text),
      list: param.list === null ? null : capturedList(param.list)
    })),
    dependsOn: buffer.dependsOn === null ? null : capturedList(buffer.dependsOn)
  };
} // End of function capturedParams()

/**
 * What one box's draft says: `null` for unchanged — an ineligible text, or one
 * holding the file's value — otherwise the text exactly as typed.
 *
 * @param baseline - What the file holds.
 * @param text - What the box holds.
 * @returns The text to send, or `null`.
 */
function textIntent(baseline: TextBaseline | undefined, text: string | undefined): string | null {
  if (baseline === undefined || text === undefined || baseline.refusal !== null) {
    return null;
  }
  return text === baseline.value ? null : text;
} // End of function textIntent()

/**
 * One list's item rewrites, removals and insertion.
 *
 * @param list - The baseline.
 * @param drafted - The boxes, or `null`.
 * @returns The rewrites by original index, the removed indices, and the new items.
 */
function listIntentsOf(
  list: ListBaseline,
  drafted: ListBuffer | null
): {
  readonly rewrites: readonly ItemDraft[];
  readonly removed: readonly number[];
  readonly added: readonly string[];
} {
  const rewrites: ItemDraft[] = [];
  const removed: number[] = [];
  if (drafted === null) {
    return { rewrites, removed, added: [] };
  }
  list.items.forEach((item, index) => {
    const box = drafted.items[index];
    if (box === undefined) {
      return;
    }
    if (box.removed && list.list !== null) {
      removed.push(index);
      return;
    }
    const text = textIntent(item, box.text);
    if (text !== null) {
      rewrites.push({ index, value: { Set: text } });
    }
  }); // End of the walk over the list's items
  return { rewrites, removed, added: list.list === null ? [] : drafted.added };
} // End of function listIntentsOf()

/** What one variable's drafted parameters and dependencies ask of a save. */
export interface ParamsDerivation {
  /** `VariableDraft.params`. */
  readonly params: readonly EntryDraft[];
  /** `VariableDraft.depends_on`. */
  readonly dependsOn: readonly ItemDraft[];
  /** `VariableDraft.lists`: removals first, then at most one insertion per list, at the end. */
  readonly lists: readonly VariableListIntent[];
  /** Whether it asks for anything. */
  readonly changed: boolean;
}

/**
 * The wire's parts of one variable's drafted parameters and dependencies.
 *
 * @param baseline - What the file holds.
 * @param buffer - What the controls hold, captured once by the caller.
 * @returns The derivation.
 */
export function paramsDerivationOf(baseline: ParamsBaseline, buffer: ParamsBuffer): ParamsDerivation {
  const params: EntryDraft[] = [];
  const lists: VariableListIntent[] = [];
  /**
   * Records one list's removals and insertion.
   *
   * @param list - Rust's name for the list, or `null`.
   * @param removed - The removed indices.
   * @param added - The new items.
   */
  const listIntents = (list: VariableList | null, removed: readonly number[], added: readonly string[]): void => {
    if (list === null) {
      return;
    }
    for (const index of removed) {
      lists.push({ RemoveItem: { list, index } });
    } // End of the loop over the removed items
    if (added.length > 0) {
      lists.push({ InsertItems: { list, at: { End: {} }, items: { Strings: [...added] } } });
    }
  }; // End of function listIntents()
  baseline.params.forEach((param, position) => {
    const box = buffer.params[position];
    if (box === undefined) {
      return;
    }
    if (param.value.kind === 'text') {
      const text = textIntent(param.value.text, box.text);
      if (text !== null) {
        params.push({ index: param.entry, value: { Set: text }, items: [] });
      }
      return;
    }
    if (param.value.kind === 'list') {
      const intents = listIntentsOf(param.value.list, box.list);
      if (intents.rewrites.length > 0) {
        params.push({ index: param.entry, value: 'Unchanged', items: [...intents.rewrites] });
      }
      listIntents(param.value.list.list, intents.removed, intents.added);
    }
  }); // End of the walk over the drafted params
  let dependsOn: readonly ItemDraft[] = [];
  if (baseline.dependsOn !== null) {
    const intents = listIntentsOf(baseline.dependsOn, buffer.dependsOn);
    dependsOn = intents.rewrites;
    listIntents(baseline.dependsOn.list, intents.removed, intents.added);
  }
  return {
    params,
    dependsOn,
    lists,
    changed: params.length > 0 || dependsOn.length > 0 || lists.length > 0
  };
} // End of function paramsDerivationOf()

// ---------------------------------------------------------------------------
// Pure transitions
// ---------------------------------------------------------------------------

/** Which list of a variable an item action is about. */
export type ListAddress =
  | {
      /** A `params` entry holding a list. */
      readonly kind: 'param';
      /** Its position in {@link ParamsBaseline.params}. */
      readonly position: number;
    }
  | {
      /** `depends_on`. */
      readonly kind: 'dependsOn';
    };

/**
 * The list one address names, baseline and boxes, or `null`.
 *
 * @param baseline - What the file holds.
 * @param buffer - What the controls hold.
 * @param address - Which list.
 * @returns Both halves, or `null`.
 */
function listAt(
  baseline: ParamsBaseline,
  buffer: ParamsBuffer,
  address: ListAddress
): { readonly list: ListBaseline; readonly boxes: ListBuffer } | null {
  if (address.kind === 'dependsOn') {
    return baseline.dependsOn === null || buffer.dependsOn === null
      ? null
      : { list: baseline.dependsOn, boxes: buffer.dependsOn };
  }
  const param = baseline.params[address.position];
  const boxes = buffer.params[address.position]?.list ?? null;
  return param === undefined || param.value.kind !== 'list' || boxes === null
    ? null
    : { list: param.value.list, boxes };
} // End of function listAt()

/**
 * The buffer with one list's boxes replaced.
 *
 * @param buffer - What the controls hold.
 * @param address - Which list.
 * @param boxes - Its new boxes.
 * @returns The new buffer.
 */
function withList(buffer: ParamsBuffer, address: ListAddress, boxes: ListBuffer): ParamsBuffer {
  if (address.kind === 'dependsOn') {
    return { ...buffer, dependsOn: boxes };
  }
  return {
    ...buffer,
    params: buffer.params.map((one, at) => (at === address.position ? { ...one, list: boxes } : one))
  };
} // End of function withList()

/**
 * Whether a text may go into a box: never a carriage return, never a line feed
 * in a one-line box.
 *
 * @param text - The text.
 * @param oneLine - Whether the box is one line.
 * @returns `true` when it may.
 */
function boxTakes(text: string, oneLine: boolean): boolean {
  return !text.includes('\r') && !(oneLine && text.includes('\n'));
} // End of function boxTakes()

/**
 * The buffer with one scalar `params` entry's box replaced, or `null` when that
 * is refused: an unknown position, an entry that is not an editable text, a
 * carriage return, a line feed in a one-line box, or no change.
 *
 * @param baseline - What the file holds.
 * @param buffer - What the controls hold.
 * @param position - The entry's position in {@link ParamsBaseline.params}.
 * @param text - The box's whole value.
 * @returns The new buffer, or `null`.
 */
export function withParamText(
  baseline: ParamsBaseline,
  buffer: ParamsBuffer,
  position: number,
  text: string
): ParamsBuffer | null {
  const param = baseline.params[position];
  const box = buffer.params[position];
  if (param === undefined || box === undefined || param.value.kind !== 'text') {
    return null;
  }
  if (param.value.text.refusal !== null || !boxTakes(text, param.value.oneLine) || box.text === text) {
    return null;
  }
  return {
    ...buffer,
    params: buffer.params.map((one, at) => (at === position ? { ...one, text } : one))
  };
} // End of function withParamText()

/**
 * The buffer with one list item's box replaced, or `null` when that is refused:
 * an unknown list or item, an ineligible item, an item drafted for removal, a
 * carriage return or a line feed (every item box is one line), or no change.
 *
 * @param baseline - What the file holds.
 * @param buffer - What the controls hold.
 * @param address - Which list.
 * @param item - The item's position in the file's list.
 * @param text - The box's whole value.
 * @returns The new buffer, or `null`.
 */
export function withListItemText(
  baseline: ParamsBaseline,
  buffer: ParamsBuffer,
  address: ListAddress,
  item: number,
  text: string
): ParamsBuffer | null {
  const found = listAt(baseline, buffer, address);
  const base = found?.list.items[item];
  const box = found?.boxes.items[item];
  if (found === null || base === undefined || box === undefined || base.refusal !== null || box.removed) {
    return null;
  }
  if (!boxTakes(text, true) || box.text === text) {
    return null;
  }
  return withList(buffer, address, {
    ...found.boxes,
    items: found.boxes.items.map((one, at) => (at === item ? { ...one, text } : one))
  });
} // End of function withListItemText()

/**
 * How many of a list's items the draft keeps.
 *
 * @param boxes - The list's boxes.
 * @returns The count.
 */
function keptItems(boxes: ListBuffer): number {
  return boxes.items.filter((one) => !one.removed).length;
} // End of function keptItems()

/**
 * Whether one item may be drafted for removal: the list takes removals, the item
 * is a text kept by the draft, and it is not the last item kept.
 *
 * @param baseline - What the file holds.
 * @param buffer - What the controls hold.
 * @param address - Which list.
 * @param item - The item's position.
 * @returns `true` when *Take out* may be offered.
 */
export function listItemRemovable(
  baseline: ParamsBaseline,
  buffer: ParamsBuffer,
  address: ListAddress,
  item: number
): boolean {
  const found = listAt(baseline, buffer, address);
  const box = found?.boxes.items[item];
  return (
    found !== null &&
    found.list.list !== null &&
    found.list.items[item]?.refusal !== 'notText' &&
    box !== undefined &&
    !box.removed &&
    keptItems(found.boxes) > 1
  );
} // End of function listItemRemovable()

/**
 * The buffer with one item drafted for removal (`removed`) or restored, or
 * `null` when refused ({@link listItemRemovable}; a restoration needs a drafted
 * removal).
 *
 * @param baseline - What the file holds.
 * @param buffer - What the controls hold.
 * @param address - Which list.
 * @param item - The item's position.
 * @param removed - `true` to take it out, `false` to keep it.
 * @returns The new buffer, or `null`.
 */
export function withListItemRemoval(
  baseline: ParamsBaseline,
  buffer: ParamsBuffer,
  address: ListAddress,
  item: number,
  removed: boolean
): ParamsBuffer | null {
  const found = listAt(baseline, buffer, address);
  const box = found?.boxes.items[item];
  if (found === null || box === undefined) {
    return null;
  }
  if (removed ? !listItemRemovable(baseline, buffer, address, item) : !box.removed) {
    return null;
  }
  return withList(buffer, address, {
    ...found.boxes,
    items: found.boxes.items.map((one, at) => (at === item ? { ...one, removed } : one))
  });
} // End of function withListItemRemoval()

/**
 * The buffer with new items appended at the end of one list, or `null` when
 * refused: the list takes no insertion, no item, an empty item, or a carriage
 * return or a line feed in one (each is one line).
 *
 * @param baseline - What the file holds.
 * @param buffer - What the controls hold.
 * @param address - Which list.
 * @param items - The new items, in order.
 * @returns The new buffer, or `null`.
 */
export function withListItemsAppended(
  baseline: ParamsBaseline,
  buffer: ParamsBuffer,
  address: ListAddress,
  items: readonly string[]
): ParamsBuffer | null {
  const found = listAt(baseline, buffer, address);
  const plain = items.map((one) => String(one));
  if (found === null || found.list.list === null || plain.length === 0) {
    return null;
  }
  if (plain.some((one) => one === '' || !boxTakes(one, true))) {
    return null;
  }
  return withList(buffer, address, { ...found.boxes, added: [...found.boxes.added, ...plain] });
} // End of function withListItemsAppended()

/**
 * The buffer with one drafted new item dropped, or `null` when there is none.
 *
 * @param baseline - What the file holds.
 * @param buffer - What the controls hold.
 * @param address - Which list.
 * @param at - The new item's position among the added ones.
 * @returns The new buffer, or `null`.
 */
export function withAppendedItemDiscarded(
  baseline: ParamsBaseline,
  buffer: ParamsBuffer,
  address: ListAddress,
  at: number
): ParamsBuffer | null {
  const found = listAt(baseline, buffer, address);
  if (found === null || at < 0 || at >= found.boxes.added.length) {
    return null;
  }
  return withList(buffer, address, { ...found.boxes, added: found.boxes.added.filter((_, one) => one !== at) });
} // End of function withAppendedItemDiscarded()

// ---------------------------------------------------------------------------
// What a reapply and a conflict read
// ---------------------------------------------------------------------------

/**
 * One intended list item, for a reapply's "already there": an item the draft
 * keeps as the file holds it (compare the projected value), or a text the draft
 * writes (compare as a logical string).
 */
export type IntendedItem =
  | { readonly kind: 'kept'; readonly index: number }
  | { readonly kind: 'text'; readonly text: string };

/** What the draft intends one `params` entry to hold. */
export type IntendedParam =
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'text'; readonly text: string; readonly plain: boolean }
  | { readonly kind: 'list'; readonly items: readonly IntendedItem[] };

/**
 * The items a list is intended to hold, in order, or `null` when the draft
 * leaves it as it is.
 *
 * @param list - The baseline.
 * @param boxes - The boxes, or `null`.
 * @returns The intended items, or `null`.
 */
export function intendedItemsOf(list: ListBaseline, boxes: ListBuffer | null): readonly IntendedItem[] | null {
  const intents = listIntentsOf(list, boxes);
  if (intents.rewrites.length === 0 && intents.removed.length === 0 && intents.added.length === 0) {
    return null;
  }
  const items: IntendedItem[] = [];
  list.items.forEach((_, index) => {
    if (intents.removed.includes(index)) {
      return;
    }
    const rewrite = intents.rewrites.find((one) => one.index === index);
    items.push(
      rewrite !== undefined && typeof rewrite.value === 'object'
        ? { kind: 'text', text: rewrite.value.Set }
        : { kind: 'kept', index }
    );
  }); // End of the walk over the original items
  for (const text of intents.added) {
    items.push({ kind: 'text', text });
  } // End of the loop over the new items
  return items;
} // End of function intendedItemsOf()

/**
 * What the draft intends the `params` entry at one projected position to hold.
 *
 * @param baseline - What the file holds.
 * @param buffer - What the controls hold, captured once.
 * @param entry - The entry's position in the projected `params`.
 * @returns The intention; `unchanged` for an entry this module does not draft.
 */
export function intendedParamOf(baseline: ParamsBaseline, buffer: ParamsBuffer, entry: number): IntendedParam {
  const position = baseline.params.findIndex((one) => one.entry === entry);
  const param = baseline.params[position];
  const box = buffer.params[position];
  if (param === undefined || box === undefined) {
    return { kind: 'unchanged' };
  }
  if (param.value.kind === 'text') {
    const text = textIntent(param.value.text, box.text);
    return text === null ? { kind: 'unchanged' } : { kind: 'text', text, plain: param.plainSource };
  }
  if (param.value.kind === 'list') {
    const items = intendedItemsOf(param.value.list, box.list);
    return items === null ? { kind: 'unchanged' } : { kind: 'list', items };
  }
  return { kind: 'unchanged' };
} // End of function intendedParamOf()

/**
 * The retained rows one variable's drafted parameters and dependencies are
 * copied as — exact texts, never YAML: per changed entry a `parameterName` row
 * holding the key, then one `parameterValue` row per intended value (the whole
 * intended list, for a list); then, when `depends_on` changes, one `dependsOn`
 * row per intended item. A kept item is copied as the file holds it.
 *
 * @param baseline - What the file holds.
 * @param buffer - What the controls hold, captured once.
 * @returns The rows, in the order a screen shows them.
 */
export function paramRowsOf(baseline: ParamsBaseline, buffer: ParamsBuffer): readonly RetainedDraftField[] {
  const rows: RetainedDraftField[] = [];
  /**
   * The texts of intended items.
   *
   * @param list - The baseline.
   * @param items - The intended items.
   * @returns Their texts.
   */
  const textsOf = (list: ListBaseline, items: readonly IntendedItem[]): readonly string[] =>
    items.map((one) => (one.kind === 'text' ? one.text : (list.items[one.index]?.value ?? '')));
  baseline.params.forEach((param) => {
    const intended = intendedParamOf(baseline, buffer, param.entry);
    if (intended.kind === 'unchanged') {
      return;
    }
    rows.push({ label: 'params', text: param.key, status: 'parameterName' });
    const texts =
      intended.kind === 'text'
        ? [intended.text]
        : param.value.kind === 'list'
          ? textsOf(param.value.list, intended.items)
          : [];
    rows.push(...texts.map((text) => ({ label: 'params' as const, text, status: 'parameterValue' as const })));
  }); // End of the walk over the drafted params
  if (baseline.dependsOn !== null) {
    const items = intendedItemsOf(baseline.dependsOn, buffer.dependsOn);
    if (items !== null) {
      const list = baseline.dependsOn;
      rows.push(
        ...textsOf(list, items).map((text) => ({ label: 'dependsOn' as const, text, status: 'setting' as const }))
      );
    }
  }
  return rows;
} // End of function paramRowsOf()

// ---------------------------------------------------------------------------
// What the selected variable's controls draw
// ---------------------------------------------------------------------------

/** One text a box drafts, as drawn. */
export interface TextView {
  /** What the box holds (or, read-only, what the file holds). */
  readonly text: string;
  /** Whether a box is drawn and accepts typing. */
  readonly editable: boolean;
  /** Why it is shown and not edited, or `null` when it is a box. */
  readonly refusal: ParamRefusal | null;
  /** How the file writes it, when that is not plain (D2u). */
  readonly style: ScalarStyle | null;
  /** Whether the box is one line (`<input>`) rather than a text area. */
  readonly oneLine: boolean;
}

/** One existing item of a list, as drawn. */
export interface ItemView extends TextView {
  /** Its position in the file's list. */
  readonly item: number;
  /** Whether it is drafted for removal. */
  readonly removed: boolean;
  /** Whether *Take out* does anything. */
  readonly canRemove: boolean;
  /** Whether *Keep* does anything. */
  readonly canRestore: boolean;
}

/** One list of a selected variable, as drawn. */
export interface ListView {
  /** Which list, for the transitions. */
  readonly address: ListAddress;
  /** Its existing items. */
  readonly items: readonly ItemView[];
  /** The drafted new items, in order. */
  readonly added: readonly string[];
  /** Whether items can be added to and taken out of it here at all. */
  readonly changeable: boolean;
  /** Whether *Add these items* does anything now. */
  readonly canAdd: boolean;
  /** Whether the file writes it between brackets. */
  readonly flow: boolean;
  /** Whether only one item is kept, so *Take out* is withheld from it. */
  readonly lastItemKept: boolean;
}

/** One `params` entry of a selected variable, as drawn. */
export interface ParamView {
  /** Its position among the drafted entries, for the transitions. */
  readonly position: number;
  /** The key's text. */
  readonly key: string;
  /** Whether it is written as plain source (a typed setting). */
  readonly plainSource: boolean;
  /**
   * Whether an edit would rewrite a quoted spelling plain — a quoted typed
   * setting. Saving it untouched writes nothing.
   */
  readonly editWritesPlain: boolean;
  /** Its text, when it is one. */
  readonly text: TextView | null;
  /** Its list, when it is one. */
  readonly list: ListView | null;
  /** Why it is shown and not edited, when it is neither. */
  readonly refusal: ParamRefusal | null;
}

/** Everything the selected variable's parameter controls draw. */
export interface ParamsView {
  /** The drafted entries, in source order. */
  readonly params: readonly ParamView[];
  /** `depends_on`, or `null` when the variable does not write it as a list. */
  readonly dependsOn: ListView | null;
}

/**
 * One list, as drawn.
 *
 * @param baseline - The variable's baseline.
 * @param buffer - Its boxes, captured once.
 * @param address - Which list.
 * @param list - The list's baseline.
 * @param boxes - Its boxes.
 * @param editable - Whether the variable accepts a change now.
 * @param granted - Whether structural actions are granted over the view's read.
 * @returns The view.
 */
function listViewOf(
  baseline: ParamsBaseline,
  buffer: ParamsBuffer,
  address: ListAddress,
  list: ListBaseline,
  boxes: ListBuffer,
  editable: boolean,
  granted: boolean
): ListView {
  const changeable = list.list !== null;
  return {
    address,
    items: list.items.map((item, index) => {
      const box = boxes.items[index] ?? { text: item.value, removed: false };
      return {
        item: index,
        text: item.refusal === null ? box.text : item.value,
        editable: editable && item.refusal === null && !box.removed,
        refusal: item.refusal,
        style: item.style,
        oneLine: true,
        removed: box.removed,
        canRemove: editable && granted && listItemRemovable(baseline, buffer, address, index),
        canRestore: editable && box.removed
      };
    }),
    added: [...boxes.added],
    changeable,
    canAdd: editable && granted && changeable,
    flow: list.flow,
    lastItemKept: changeable && keptItems(boxes) <= 1
  };
} // End of function listViewOf()

/**
 * What the selected variable's parameter controls draw.
 *
 * @param baseline - The variable's baseline.
 * @param buffer - Its boxes, captured once by the caller.
 * @param editable - Whether the variable accepts a change now (the editor is
 *   editable and the variable is not drafted for removal).
 * @param granted - Whether structural actions are granted over the view's read.
 * @returns The view.
 */
export function paramsViewOf(
  baseline: ParamsBaseline,
  buffer: ParamsBuffer,
  editable: boolean,
  granted: boolean
): ParamsView {
  const params = baseline.params.map((param, position): ParamView => {
    const box = buffer.params[position];
    const value = param.value;
    const quoted = value.kind === 'text' && (value.text.style === 'SingleQuoted' || value.text.style === 'DoubleQuoted');
    let text: TextView | null = null;
    let list: ListView | null = null;
    let refusal: ParamRefusal | null = null;
    if (value.kind === 'text') {
      text = {
        text: value.text.refusal === null && box !== undefined ? box.text : value.text.value,
        editable: editable && value.text.refusal === null,
        refusal: value.text.refusal,
        style: value.text.style,
        oneLine: value.oneLine
      };
    } else if (value.kind === 'list' && box?.list != null) {
      list = listViewOf(baseline, buffer, { kind: 'param', position }, value.list, box.list, editable, granted);
    } else {
      refusal = value.kind === 'other' ? value.refusal : 'notText';
    }
    return {
      position,
      key: param.key,
      plainSource: param.plainSource,
      editWritesPlain: param.plainSource && quoted && value.kind === 'text' && value.text.refusal === null,
      text,
      list,
      refusal
    };
  }); // End of the walk over the drafted params
  const dependsOn =
    baseline.dependsOn === null || buffer.dependsOn === null
      ? null
      : listViewOf(baseline, buffer, { kind: 'dependsOn' }, baseline.dependsOn, buffer.dependsOn, editable, granted);
  return { params, dependsOn };
} // End of function paramsViewOf()

// ---------------------------------------------------------------------------
// Sentences: codes to keys
// ---------------------------------------------------------------------------

/**
 * Why *Add these items* added nothing — a code, never a sentence
 * ({@link listItemsProblemKey}).
 *
 * - `noItems` — the box holds no item;
 * - `emptyItem` — a line between two items is empty;
 * - `carriageReturn` — the text holds a carriage return;
 * - `notAList` — the list takes no insertion here, or the variable does not
 *   accept a change now;
 * - `structure` — structural changes are withheld (R36) or the editor accepts no
 *   change.
 */
export type ListItemsProblem = 'noItems' | 'emptyItem' | 'carriageReturn' | 'notAList' | 'structure';

/**
 * The dictionary key holding one *Add these items* problem's sentence.
 *
 * @param problem - Why nothing was added.
 * @returns The key.
 */
export function listItemsProblemKey(problem: ListItemsProblem): TranslationKey {
  switch (problem) {
    case 'noItems':
      return 'browser.variableParams.problem.noItems';
    case 'emptyItem':
      return 'browser.variableParams.problem.emptyItem';
    case 'carriageReturn':
      return 'browser.variableParams.problem.carriageReturn';
    case 'notAList':
      return 'browser.variableParams.problem.notAList';
    case 'structure':
      return 'browser.variableParams.problem.structure';
  }
} // End of function listItemsProblemKey()

/**
 * The dictionary key holding one parameter refusal's sentence. The four shared
 * codes reuse the match editor's sentences.
 *
 * @param reason - Why the text is not a box.
 * @returns The key.
 */
export function paramRefusalKey(reason: ParamRefusal): TranslationKey {
  switch (reason) {
    case 'notDecodable':
      return 'browser.matchEditor.readOnly.notDecodable';
    case 'carriageReturn':
      return 'browser.matchEditor.readOnly.carriageReturn';
    case 'ownsNoBytes':
      return 'browser.matchEditor.readOnly.ownsNoBytes';
    case 'lineBreak':
      return 'browser.matchEditor.readOnly.lineBreak';
    case 'keyNotNameable':
      return 'browser.variableParams.readOnly.keyNotNameable';
    case 'notText':
      return 'browser.variableParams.readOnly.notText';
  }
} // End of function paramRefusalKey()
