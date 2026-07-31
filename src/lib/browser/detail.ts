/**
 * What the detail pane shows for one match, decided here rather than in markup.
 *
 * `DetailPane.svelte` is presentation: it walks the model this module builds and
 * renders each part. Everything that *decides* — which rows exist, how a
 * {@link ValueView} flattens into lines, which option belongs to which group,
 * what order a variable's parameters come in — lives here, because nothing in
 * this repository renders a Svelte component in an automated test
 * (`docs/decisions/1c-1-notes.md` hole 1). Logic in a component is logic no test
 * can reach; logic here has `detail.test.ts`.
 *
 * ## Three rules govern every function below
 *
 * **D2u — a scalar is source text.** Every value shown comes from
 * {@link ScalarView.text}, which is what the file writes or what `decode()`
 * produced from it. Nothing here compares a text against `true`, decides that
 * `word: on` is switched on, or renders a checkbox. What *is* surfaced is
 * {@link ScalarView.ambiguous_yaml_1_1} — a claim about risk rather than about
 * meaning, which D2u explicitly permits — and {@link ScalarView.style}, which is
 * a claim about spelling.
 *
 * **Absent is not empty.** Every scalar field of the view is `ScalarView | null`,
 * and `null` means *the file does not have this key*. A field that is absent
 * produces **no row at all**; a field that is present and holds an empty string
 * produces a row carrying {@link ScalarDisplay.empty}, which the pane marks. The
 * two are different facts about the file and are never rendered the same way.
 *
 * The one place this distinction cannot be drawn is a *sequence* field —
 * `triggers`, `search_terms`, `depends_on`. The wire carries each as a plain
 * array, so an absent key and an empty list both arrive as `[]` and no function
 * here can tell them apart. That is written down as a hole in
 * `docs/decisions/1c-2a-notes.md` rather than papered over with a guess.
 *
 * **The order is the file's order.** A variable's parameters, a mapping's
 * entries and a sequence's items are rendered in the order the projection
 * carried them, which is the order the file writes them. Sorting them would
 * replace an order the user chose with one they cannot see — plan section 8.4's
 * "never hide the file boundary", applied to a mapping instead of to a file.
 */

import type { TranslationKey } from '../i18n/dictionaries';
import type {
  AliasView,
  ContentKind,
  ElidedValue,
  FieldView,
  HazardKind,
  MatchOptions,
  MatchView,
  NodeId,
  ScalarStyle,
  ScalarView,
  TriggerKind,
  UnknownEntry,
  UnknownReason,
  ValueKind,
  ValueView,
  VariableKind,
  VariableView
} from '../ipc/types';

/**
 * The name of every field the detail pane can put a label on.
 *
 * A **code**, exactly like a `TriggerKind` is: the pane renders it by calling
 * `tDetailField` in `../i18n`, never by building a key. The union is the
 * frontend's own — these are espanso's field names rather than Rust variants,
 * and no Rust enum has this shape — so it lives here rather than in
 * `../i18n/codes.ts`, which exists to bridge **Rust** codes to sentences.
 * `notices.ts`'s `selectionNoticeKey` is the precedent for a frontend-only code
 * keeping its key builder beside the vocabulary it names.
 *
 * `name` is deliberately absent: a variable's name is the heading of its card
 * rather than a labelled row, so nothing ever asks for a label for it.
 */
export type DetailFieldName =
  | 'trigger'
  | 'triggers'
  | 'regex'
  | 'replace'
  | 'markdown'
  | 'html'
  | 'imagePath'
  | 'form'
  | 'label'
  | 'comment'
  | 'searchTerms'
  | 'word'
  | 'leftWord'
  | 'rightWord'
  | 'propagateCase'
  | 'uppercaseStyle'
  | 'forceMode'
  | 'forceClipboard'
  | 'paragraph'
  | 'anchor'
  | 'type'
  | 'params'
  | 'dependsOn'
  | 'injectVars';

/**
 * The dictionary key holding one field's label.
 *
 * The template literal is what makes a field with no dictionary entry a
 * **compile error in this file** rather than an `undefined` on a screen: the
 * returned type is `browser.detail.field.${DetailFieldName}`, and
 * `TranslationKey` is derived from `en.json`, so the assignment only holds when
 * every member has a key. It is the same device the twelve builders in
 * `../i18n/codes.ts` use.
 *
 * **Why it is not one of those twelve.** Not because of
 * `src-tauri/src/dictionary_contract.rs` — that check filters on the key prefix
 * `code.`, not on the file, so a builder in `codes.ts` returning
 * `browser.detail.field.*` would pass `cargo test` unchanged. The reason is
 * ownership: `codes.ts` bridges **Rust** codes to sentences, and
 * {@link DetailFieldName} is the frontend's own vocabulary with no Rust twin.
 * `notices.ts`'s `selectionNoticeKey` is the existing precedent.
 *
 * @param field - The field to label.
 * @returns The key holding that field's label.
 */
export function detailFieldKey(field: DetailFieldName): TranslationKey {
  return `browser.detail.field.${field}`;
} // End of function detailFieldKey()

/**
 * A scalar and the three things the pane says about it beyond its text.
 *
 * None of the three is a claim about what the scalar *means*: `empty` is a fact
 * about its length, `ambiguous` is the core's own risk flag, and `style` is how
 * the file spells it.
 */
export interface ScalarDisplay {
  /** The scalar, whose `text` is the only thing ever printed from it (D2u). */
  readonly scalar: ScalarView;
  /**
   * `true` when the key is present and its text is empty.
   *
   * A row with nothing in it is indistinguishable from a row that failed to
   * render, so the pane prints a marker instead of nothing.
   */
  readonly empty: boolean;
  /** `true` when YAML 1.1 and YAML 1.2 core read this plain scalar differently. */
  readonly ambiguous: boolean;
  /**
   * The style, when knowing it tells the reader something, and `null` otherwise.
   *
   * See {@link styleWorthShowing}.
   */
  readonly style: ScalarStyle | null;
}

/** One labelled scalar field the file actually has. */
export interface ScalarRow extends ScalarDisplay {
  /** Which field this row is. */
  readonly field: DetailFieldName;
}

/**
 * Whether a scalar's written style is worth putting on screen.
 *
 * A plain scalar's text *is* its bytes, so saying "written without quotes" beside
 * every row is noise. Every other style means the text shown differs from the
 * spelling in the file — quotes were removed, or a block header decided how the
 * newlines fold — and that is a difference the reader of a fidelity-preserving
 * editor should be able to see.
 *
 * @param style - How the scalar is written in the source.
 * @returns The style when it is informative, `null` when it is not.
 */
export function styleWorthShowing(style: ScalarStyle): ScalarStyle | null {
  return style === 'Plain' ? null : style;
} // End of function styleWorthShowing()

/**
 * The three facts the pane shows about a scalar, beside the scalar itself.
 *
 * @param scalar - A scalar as it crossed the boundary.
 * @returns The scalar and its display facts.
 */
export function scalarDisplay(scalar: ScalarView): ScalarDisplay {
  return {
    scalar,
    empty: scalar.text === '',
    ambiguous: scalar.ambiguous_yaml_1_1,
    style: styleWorthShowing(scalar.style)
  };
} // End of function scalarDisplay()

/**
 * A row for one field, or `null` when the file does not have that key.
 *
 * `null` never reaches a component: {@link collectRows} drops it, so what the
 * pane walks is a list of rows the file really has. The `null` is the seam this
 * function is tested through — "absent produces no row" is the assertion — and
 * the shape the caller filters on.
 *
 * @param field - Which field the row would be.
 * @param scalar - The projected scalar, or `null` for an absent key.
 * @returns The row, or `null` when the key is absent.
 */
export function scalarRow(field: DetailFieldName, scalar: ScalarView | null): ScalarRow | null {
  return scalar === null ? null : { field, ...scalarDisplay(scalar) };
} // End of function scalarRow()

/**
 * Builds the rows of a group of fields, skipping every absent one.
 *
 * @param entries - Field names paired with the scalar the projection carried.
 * @returns One row per present field, in the order given.
 */
function collectRows(
  entries: readonly (readonly [DetailFieldName, ScalarView | null])[]
): readonly ScalarRow[] {
  return entries.flatMap(([field, scalar]) => {
    const row = scalarRow(field, scalar);
    return row === null ? [] : [row];
  });
} // End of function collectRows()

// ---------------------------------------------------------------------------
// Values, flattened into lines
// ---------------------------------------------------------------------------

/**
 * What opens a line: a mapping key, a sequence bullet, or a key that is not a
 * name at all.
 *
 * `unnamed` is `FieldView.key === null`, which is a mapping entry whose key is
 * an alias or a collection. Nothing can address such an entry *by name*, and the
 * pane says so rather than dropping the line — but the key **node** exists
 * whether or not the key is a scalar, so it is carried: an editing phase
 * addresses a line in order to change it, and a projection that dropped the one
 * identity the wire handed it would have to go back to the wire for it.
 */
export type LineLabel =
  | { readonly kind: 'item' }
  | { readonly kind: 'key'; readonly key: ScalarView }
  | { readonly kind: 'unnamed'; readonly keyNode: NodeId };

/** What every line of a projected value carries, whatever it holds. */
export interface LineBase {
  /** How deep inside the value this line sits; 0 is the outermost. */
  readonly depth: number;
  /** What opens the line. */
  readonly label: LineLabel;
}

/** A line holding a scalar. */
export interface ScalarLine extends ScalarDisplay, LineBase {
  /** Discriminant. */
  readonly kind: 'scalar';
}

/** A line holding an alias reference, which the projection never follows. */
export interface AliasLine extends LineBase {
  /** Discriminant. */
  readonly kind: 'alias';
  /** The alias node, carried so a later phase can address it. */
  readonly alias: AliasView;
}

/** A line for a node the projection stopped at. */
export interface ElidedLine extends LineBase {
  /** Discriminant. */
  readonly kind: 'elided';
  /**
   * The elided node, whole.
   *
   * Its `kind` is what the pane says it stopped at; its `node` and `span` are
   * what a later phase addresses it by. The sibling {@link AliasLine} keeps its
   * whole {@link AliasView} for the same reason.
   */
  readonly elided: ElidedValue;
}

/** A line opening a nested collection. */
export interface BranchLine extends LineBase {
  /** Discriminant. */
  readonly kind: 'branch';
  /** Which collection it opens. */
  readonly shape: 'Sequence' | 'Mapping';
  /** `true` when the collection holds nothing, so no line follows it. */
  readonly empty: boolean;
}

/** One line of a projected value, ready to render. */
export type ValueLine = ScalarLine | AliasLine | ElidedLine | BranchLine;

/** A labelled block of lines, absent when the file has nothing to show there. */
export interface LineBlock {
  /** Which field the block stands for. */
  readonly field: DetailFieldName;
  /** Its lines, in source order. */
  readonly lines: readonly ValueLine[];
}

/**
 * The bullet of a sequence item, which carries no key.
 *
 * The pane draws a real marker for it. It did not until the 1c-2a review's
 * second finding: the lines are flat and `list-style` is `none`, so two items
 * whose first scalar holds a newline read as three unmarked lines with nothing
 * saying where one ends. `detail.test.ts` requires the component to handle this
 * arm.
 */
const ITEM_LABEL: LineLabel = { kind: 'item' };

/**
 * What opens the line for one entry of a shallowly projected mapping.
 *
 * @param field - The entry as it crossed the boundary.
 * @returns Its key, or the marker for a key that is not a name.
 */
export function fieldLabel(field: FieldView): LineLabel {
  return field.key === null
    ? { kind: 'unnamed', keyNode: field.key_node }
    : { kind: 'key', key: field.key };
} // End of function fieldLabel()

/**
 * Flattens one projected value into lines, depth-first, in source order.
 *
 * A flat list rather than a tree, because the alternative is a recursive snippet
 * in markup — and markup is the one place in this project a mistake reaches a
 * screen without a test seeing it. Here the whole shape of a rendered value is a
 * value a test can assert on, element by element.
 *
 * Every arm of `ValueView` produces at least one line, `Elided` included: the
 * node exists, the projection simply stopped at it, and rendering nothing would
 * tell the reader that the file holds nothing.
 *
 * The two collection arms delegate to {@link flattenItems} and
 * {@link flattenFields}, which is where "a sequence item carries a bullet, a
 * mapping entry carries its key" is decided. Restating it here would put the
 * same rule in three places, free to drift in two of them.
 *
 * @param value - A projected value as it crossed the boundary.
 * @param label - What opens the first line; a sequence bullet by default.
 * @param depth - Nesting depth of that line; 0 by default.
 * @returns The lines, in the order they are read.
 */
export function flattenValue(
  value: ValueView,
  label: LineLabel = ITEM_LABEL,
  depth = 0
): readonly ValueLine[] {
  if ('Scalar' in value) {
    return [{ kind: 'scalar', depth, label, ...scalarDisplay(value.Scalar) }];
  }
  if ('Alias' in value) {
    return [{ kind: 'alias', depth, label, alias: value.Alias }];
  }
  if ('Elided' in value) {
    return [{ kind: 'elided', depth, label, elided: value.Elided }];
  }
  if ('Sequence' in value) {
    const items = value.Sequence;
    return [
      { kind: 'branch', depth, label, shape: 'Sequence', empty: items.length === 0 },
      ...flattenItems(items, depth + 1)
    ];
  }
  const entries = value.Mapping;
  return [
    { kind: 'branch', depth, label, shape: 'Mapping', empty: entries.length === 0 },
    ...flattenFields(entries, depth + 1)
  ];
} // End of function flattenValue()

/**
 * Flattens a sequence field — `triggers`, `search_terms`, `depends_on`.
 *
 * The sequence itself gets no branch line: the block already carries the field's
 * label, and a "a list" header above a list the reader can see would say nothing.
 * {@link flattenValue}'s `Sequence` arm draws that header itself and then calls
 * this at the next depth.
 *
 * @param items - The items as they crossed the boundary, in source order.
 * @param depth - Nesting depth of the items; 0 by default.
 * @returns One line per item, plus whatever each item nests.
 */
export function flattenItems(items: readonly ValueView[], depth = 0): readonly ValueLine[] {
  return items.flatMap((item) => flattenValue(item, ITEM_LABEL, depth));
} // End of function flattenItems()

/**
 * Flattens a shallowly projected mapping — `params`, `form_fields`.
 *
 * The entries keep the order the projection carried, which is the order the file
 * writes them.
 *
 * @param fields - The entries as they crossed the boundary, in source order.
 * @param depth - Nesting depth of the entries; 0 by default.
 * @returns One line per entry, plus whatever each entry nests.
 */
export function flattenFields(fields: readonly FieldView[], depth = 0): readonly ValueLine[] {
  return fields.flatMap((field) => flattenValue(field.value, fieldLabel(field), depth));
} // End of function flattenFields()

/**
 * Wraps lines in a labelled block, or answers `null` when there are none.
 *
 * @param field - Which field the block stands for.
 * @param lines - The lines it holds.
 * @returns The block, or `null` so the caller renders no heading either.
 */
function blockOf(field: DetailFieldName, lines: readonly ValueLine[]): LineBlock | null {
  return lines.length === 0 ? null : { field, lines };
} // End of function blockOf()

/**
 * How deep an indentation class the stylesheet has a rule for.
 *
 * **The contract is with `src/app.css`**, which holds the `.depth-0` … `.depth-N`
 * ladder unscoped so that any pane needing indentation uses the same one. A
 * Svelte component's `<style>` is scoped — the rules would compile to
 * `.depth-3.svelte-<hash>` and no second component could reach them — so the
 * ladder cannot live in a component without becoming private to it.
 * `detail.test.ts` reads `src/app.css` and fails if a class this constant
 * promises has no rule there.
 */
export const MAX_INDENT_DEPTH = 5;

/**
 * The CSS class carrying one line's indentation.
 *
 * A class rather than an inline `style`, because the production CSP is
 * `style-src 'self'` with no `'unsafe-inline'` (`src-tauri/tauri.conf.json`, and
 * the 1b-1 review's second High finding is why): a `style` attribute would be
 * refused by the webview and the indentation would silently vanish. Depths past
 * {@link MAX_INDENT_DEPTH} share the deepest rule rather than falling back to
 * none, so a deeply nested value stays legible instead of jumping back to the
 * margin.
 *
 * @param depth - The line's nesting depth.
 * @returns The class name to put on the line.
 */
export function indentClass(depth: number): string {
  const clamped = depth < 0 ? 0 : Math.min(depth, MAX_INDENT_DEPTH);
  return `depth-${clamped}`;
} // End of function indentClass()

// ---------------------------------------------------------------------------
// The match itself
// ---------------------------------------------------------------------------

/** The trigger side, with all three fields kept apart. */
export interface TriggerDetail {
  /** Whether the three fields form a shape espanso accepts. */
  readonly kind: TriggerKind;
  /** `trigger` and `regex`, each shown only when the file has it. */
  readonly rows: readonly ScalarRow[];
  /** `triggers`, when the projection carried any item. */
  readonly triggers: LineBlock | null;
}

/** The content side, with all five fields kept apart. */
export interface ContentDetail {
  /** Whether the five fields form a shape espanso accepts. */
  readonly kind: ContentKind;
  /** Every content field the file has, in the plan's own order. */
  readonly rows: readonly ScalarRow[];
}

/**
 * Which of the four intents a group of options belongs to.
 *
 * A **code**, like {@link DetailFieldName}: the pane renders it by calling
 * `tOptionGroup` in `../i18n`, never by building a key. The member is `case`
 * rather than `casing` because the dictionary key it names is
 * `browser.detail.options.case`, and the two must be the same word for
 * {@link optionGroupKey}'s return type to check.
 */
export type OptionGroupName = 'matching' | 'case' | 'injection' | 'other';

/**
 * The dictionary key holding one option group's heading.
 *
 * The same device as {@link detailFieldKey}, for the same reason: the template
 * literal makes a group with no dictionary entry a compile error in this file.
 *
 * @param name - The group to label.
 * @returns The key holding that group's heading.
 */
export function optionGroupKey(name: OptionGroupName): TranslationKey {
  return `browser.detail.options.${name}`;
} // End of function optionGroupKey()

/**
 * One group of the match options, grouped by intent rather than dumped flat.
 *
 * Plan section 8.5: *"Not a flat dump of every schema field"*. The four groups
 * are the ones the plan names for a match — word boundary, case, injection
 * method, and what is left.
 *
 * The plan also says: *"Do not expose `force_mode` and `force_clipboard` as two
 * unrelated checkboxes. Present a single Insertion method control"*. That is an
 * instruction about **editing**, and this pane does not edit: it puts both under
 * one heading so they read as one decision, and still shows each one's own
 * source text, because collapsing two keys into one rendered value would be
 * exactly the inference D2u forbids.
 *
 * **A list rather than four named fields.** The four used to be four properties
 * of one interface, which meant the pane wrote four near-identical `{#if}` +
 * heading + rows blocks and four other places named the same four; a fifth group
 * added to the model and forgotten in any of them was silent. A group with no row
 * is not built at all, so `MatchDetail.options` holds only groups that have
 * something in them and the pane walks it.
 */
export interface OptionGroup {
  /** Which intent this group stands for. */
  readonly name: OptionGroupName;
  /** Its rows, in the order the plan names the fields. Never empty. */
  readonly rows: readonly ScalarRow[];
}

/**
 * One mapping key of an entry the projection did not model.
 *
 * Three arms rather than a `string | null`, because a key that is present and
 * **empty** is a third case and the pane must not draw a blank `<dt>` for it: a
 * row with nothing in it is indistinguishable from a row that failed to render,
 * which is the failure {@link ScalarDisplay.empty} exists to prevent everywhere
 * else in this pane.
 */
export type UnknownKeyLabel =
  | { readonly kind: 'named'; readonly text: string }
  | { readonly kind: 'empty' }
  | { readonly kind: 'unnamed' };

/**
 * One entry the projection did not model, as the pane shows it.
 *
 * The entry's **value** is deliberately not here: `UnknownEntry` carries no
 * value text at all, only a span and a shape, so the pane names the shape and
 * says plainly that the value is not on screen. See
 * `docs/decisions/1c-2a-notes.md` section 12, hole 13.
 */
export interface UnknownRow {
  /** The key node, which is what keys the row in a list and addresses it. */
  readonly node: NodeId;
  /** What the pane puts in the `dt`. */
  readonly key: UnknownKeyLabel;
  /** What the unshown value is, unprojected. */
  readonly valueKind: ValueKind;
  /** Why the entry was not modelled. */
  readonly reason: UnknownReason;
}

/**
 * Builds the model for one unmodelled entry.
 *
 * @param entry - An unmodelled entry as it crossed the boundary.
 * @returns What the pane draws for it.
 */
export function describeUnknown(entry: UnknownEntry): UnknownRow {
  return {
    node: entry.key_node,
    key: unknownKeyLabel(entry.key),
    valueKind: entry.value_kind,
    reason: entry.reason
  };
} // End of function describeUnknown()

/**
 * What the pane puts in the `dt` of one unmodelled entry.
 *
 * @param key - The key's decoded text, or `null` for a key that is not a scalar.
 * @returns The named, empty or unnamed arm.
 */
function unknownKeyLabel(key: string | null): UnknownKeyLabel {
  if (key === null) {
    return { kind: 'unnamed' };
  }
  return key === '' ? { kind: 'empty' } : { kind: 'named', text: key };
} // End of function unknownKeyLabel()

/** One variable of a match's `vars`. */
export interface VariableDetail {
  /** The mapping node, which is what keys the card in a list. */
  readonly node: NodeId;
  /** `name`, as source text, or `null` when the variable has none. */
  readonly name: ScalarDisplay | null;
  /** Which of the nine types the core read out of `type`. */
  readonly kind: VariableKind;
  /**
   * `type` and `inject_vars`, each shown only when the file has it.
   *
   * `type` is the **authoritative** value and is shown as written;
   * {@link VariableDetail.kind} beside it is what the core read it as, which is
   * a different claim and is labelled as one.
   */
  readonly rows: readonly ScalarRow[];
  /** `params`, shallowly projected and in source order. */
  readonly params: LineBlock | null;
  /** `depends_on`, in source order. */
  readonly dependsOn: LineBlock | null;
  /** Entries the projection did not model, which it never discards. */
  readonly unknown: readonly UnknownRow[];
}

/**
 * What this application says about editing one match, and nothing more.
 *
 * **The one thing the pane says that is not a fact about the file.** Everything
 * else here is source text or a shape; this is a *judgement*, so its three arms
 * are exactly the three answers the wire can support and no fourth is invented.
 *
 * `unrestricted` deliberately renders **nothing at all**. Phase 1 is read-only,
 * so "this snippet can be edited safely" would be a promise about an editor the
 * user cannot reach — the same class of over-claim as presenting a plain
 * scalar's type (D2u) or 1c-2a's "shown as written" beside a value that was not
 * shown. A refusal is a claim this project has earned, because the mutation
 * entry point really does refuse: `EditError::Refused` in
 * `crates/espansoconfig-core/src/patch/edit.rs`.
 */
export type MatchEditability =
  /** Nothing on this match blocks the visual editor. Drawn as nothing. */
  | { readonly kind: 'unrestricted' }
  /**
   * The editor refuses this match, and the wire named the construct.
   *
   * The construct is **in the file**, not necessarily in the match:
   * `TriviaIndex::disqualifying_hazard` returns a hazard flagged on the match's
   * node, on an **ancestor** of it, on a descendant of it, or — first of all —
   * one with no node at all, which disqualifies the whole document. So the
   * string this arm renders says *this file contains* and not *this snippet
   * contains*; the first wording was true only of the descendant case.
   */
  | { readonly kind: 'blocked'; readonly hazard: HazardKind }
  /**
   * The editor refuses this match and the wire gave no reason.
   *
   * The string this arm renders says only that, and deliberately does not say
   * *why* — the 1c-2b-1 review's Low 1. The only fact in evidence is the
   * verdict; "some part of the file blocks it" was an explanation this model
   * invented, and a refusal that is one day not about a hazard at all would
   * make it false.
   */
  | { readonly kind: 'blockedUnnamed' };

/**
 * Reads the two editability fields of a match into one answer.
 *
 * **`safely_editable` is the verdict and `blocking_hazard` is the reason**, in
 * that order of authority. In Rust the two come from one call —
 * `TriviaIndex::is_safely_editable` is defined as
 * `disqualifying_hazard(...).is_none()` — so they cannot disagree there. They
 * are two independent fields on the wire, though, and if they ever did
 * disagree, this order is the one that keeps the pane agreeing with the snippet
 * list: `MatchBadge::NotEditable` is derived from `safely_editable` alone, so a
 * pane that refused on the strength of `blocking_hazard` could contradict a row
 * two panes to the left. A hazard named on a match the wire calls editable is
 * not lost either — it is in `DocumentView.hazards`, which the snippet list
 * shows for the file.
 *
 * @param match - The selected match as it crossed the boundary.
 * @returns What, if anything, the pane says about editing it.
 */
export function matchEditability(match: MatchView): MatchEditability {
  if (match.safely_editable) {
    return { kind: 'unrestricted' };
  }
  return match.blocking_hazard === null
    ? { kind: 'blockedUnnamed' }
    : { kind: 'blocked', hazard: match.blocking_hazard };
} // End of function matchEditability()

/** Everything the detail pane draws for one selected match. */
export interface MatchDetail {
  /** What this app says about editing the match; often "nothing". */
  readonly editability: MatchEditability;
  /** The trigger side. */
  readonly trigger: TriggerDetail;
  /** The content side. */
  readonly content: ContentDetail;
  /** `label` and `comment` — plan section 8.5's "Discovery" group. */
  readonly discovery: readonly ScalarRow[];
  /** `search_terms`, which belongs to the same group. */
  readonly searchTerms: LineBlock | null;
  /** The options, grouped by intent; a group with no row is not here at all. */
  readonly options: readonly OptionGroup[];
  /** `vars`, in source order. */
  readonly variables: readonly VariableDetail[];
  /**
   * `form_fields`, shallowly projected.
   *
   * Lines rather than a {@link LineBlock}: this one has a section heading of its
   * own, so a field label above it would say the same thing twice.
   */
  readonly formFields: readonly ValueLine[];
  /** Entries the projection did not model, which it never discards. */
  readonly unknown: readonly UnknownRow[];
}

/**
 * Whether the discovery section has anything to show.
 *
 * Two lists feed one heading — `label` and `comment` as rows, `search_terms` as
 * a block — so the question is a compound one, and a compound predicate written
 * in markup is a decision no test in this repository can reach. It is asked here
 * for the same reason the option groups are built here.
 *
 * @param detail - The model built for one match.
 * @returns `true` when the section would hold at least one thing.
 */
export function hasDiscovery(detail: MatchDetail): boolean {
  return detail.discovery.length > 0 || detail.searchTerms !== null;
} // End of function hasDiscovery()

/**
 * Builds the model for one variable.
 *
 * @param variable - A variable as it crossed the boundary.
 * @returns What the pane draws for it.
 */
export function describeVariable(variable: VariableView): VariableDetail {
  return {
    node: variable.node,
    name: variable.name === null ? null : scalarDisplay(variable.name),
    kind: variable.kind,
    rows: collectRows([
      ['type', variable.declared_type],
      ['injectVars', variable.inject_vars]
    ]),
    params: blockOf('params', flattenFields(variable.params)),
    dependsOn: blockOf('dependsOn', flattenItems(variable.depends_on)),
    unknown: variable.unknown_entries.map(describeUnknown)
  };
} // End of function describeVariable()

/**
 * Builds the four option groups, keeping only the ones the file has a key for.
 *
 * @param options - The match's options as they crossed the boundary.
 * @returns The non-empty groups, in the order the plan names them.
 */
function describeOptions(options: MatchOptions): readonly OptionGroup[] {
  const groups: readonly OptionGroup[] = [
    {
      name: 'matching',
      rows: collectRows([
        ['word', options.word],
        ['leftWord', options.left_word],
        ['rightWord', options.right_word]
      ])
    },
    {
      name: 'case',
      rows: collectRows([
        ['propagateCase', options.propagate_case],
        ['uppercaseStyle', options.uppercase_style]
      ])
    },
    {
      name: 'injection',
      rows: collectRows([
        ['forceMode', options.force_mode],
        ['forceClipboard', options.force_clipboard]
      ])
    },
    {
      name: 'other',
      rows: collectRows([
        ['paragraph', options.paragraph],
        ['anchor', options.anchor]
      ])
    }
  ];
  return groups.filter((group) => group.rows.length > 0);
} // End of function describeOptions()

/**
 * Builds the model for one match.
 *
 * The three trigger fields and the five content fields are each collected
 * independently, so a match writing both a `trigger` and a `regex` — which the
 * core reports as `TriggerKind::Several` and which really occurs — shows **both**
 * rows. The snippet list collapses the three into one display value on purpose;
 * a detail pane that did the same would be hiding the very thing it exists to
 * show, and the 1c-1 review removed a first attempt at this pane for doing it.
 *
 * @param match - The selected match as it crossed the boundary.
 * @returns Everything the pane draws.
 */
export function describeMatch(match: MatchView): MatchDetail {
  return {
    editability: matchEditability(match),
    trigger: {
      kind: match.trigger.kind,
      rows: collectRows([
        ['trigger', match.trigger.trigger],
        ['regex', match.trigger.regex]
      ]),
      triggers: blockOf('triggers', flattenItems(match.trigger.triggers))
    },
    content: {
      kind: match.content.kind,
      // Plan section 3.3's own order for the content side.
      rows: collectRows([
        ['replace', match.content.replace],
        ['form', match.content.form],
        ['markdown', match.content.markdown],
        ['html', match.content.html],
        ['imagePath', match.content.image_path]
      ])
    },
    discovery: collectRows([
      ['label', match.label],
      ['comment', match.comment]
    ]),
    searchTerms: blockOf('searchTerms', flattenItems(match.search_terms)),
    options: describeOptions(match.options),
    variables: match.vars.map(describeVariable),
    formFields: flattenFields(match.form_fields),
    unknown: match.unknown_entries.map(describeUnknown)
  };
} // End of function describeMatch()
