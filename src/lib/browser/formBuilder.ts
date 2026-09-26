/**
 * The visual form builder's decisions — Phase 4-12: what `FormBuilder.svelte`
 * draws for one snippet's forms, and the two compound additions it offers
 * (*Add field* with a Choice or List definition, and the **Form** insertion), as
 * values.
 *
 * **This module decides; the component draws.** Every transition is Phase 4-10's
 * or this phase's in `./matchEditor.ts`, over `./formEditor.ts`'s model, into the
 * editor's one draft (ruling 24): one buffer set, one history, one save, one
 * conflict registry. Nothing here holds a session.
 *
 * ## What it keeps
 *
 * - **Both storage shapes, one builder** (ruling 17): a shorthand form's layout is
 *   the match editor's own `form` content box, so the builder draws the layout as
 *   a synchronized display under it and never a second box; a verbose form's
 *   layout is a box of the builder's own.
 * - **Rows are derived** (`formRowsOf` in `./formEditor.ts`): one per placeholder
 *   name, then the definition-only rows with their advisory. Typing in a layout
 *   changes the rows and writes no definition (ruling 15).
 * - **Choice and List are first-class** (ruling 18): a placeholder with no
 *   definition is defined as a text, a choice or a list field in one press, and a
 *   choice or a list opens its values at once; an existing `values` list is edited
 *   item by item, a multi-line `values` as one text — never converted.
 * - **Options stay textual** (D2u; ruling 2 of Phase 3 carried): `type`,
 *   `default`, `multiline` and `trim_string_values` are text boxes; suggestions
 *   are exact strings put into the box, never a checkbox.
 * - **Unknown source is always visible** (ruling 19): an option this editor does
 *   not draft is drawn through `SourceText` (its scalar text or its items) or by
 *   its shape's name, and may only be taken out.
 * - **Controls are mounted for the one selected row** (override row 7 of
 *   `docs/decisions/4-split-notes.md` §5, as the variables group does).
 *
 * ## What no type here forces
 *
 * That a handler mints its grant and name context from a read taken **at the
 * press** (R37) — the component's handlers do; TypeScript cannot force it.
 */

import type { TranslationKey } from '../i18n/dictionaries';
import type { NewFormField, NewVariable, ValueKind, ValueView } from '../ipc/types';
import {
  definitionIsEdited,
  formAdditionRefusal,
  FORM_OPTION_KEYS,
  capturedForms,
  isOneLineOption,
  optionRemovable,
  removeAllRefusal,
  valuesOfLines,
  layoutPiecesOf,
  type DefinitionBaseline,
  type FormAdditionRefusal,
  type FormFieldRefusal,
  type FormOptionKey,
  type FormRow,
  type FormRowAdvisory,
  type FormsBaseline,
  type LayoutMalformation,
  type LayoutPiece,
  type RemoveAllRefusal,
  type ValuesAdditionProblem
} from './formEditor';
import {
  addFormField,
  formRows,
  isFormEditable,
  isVariablesEditable,
  type FormFieldOutcome,
  type MatchEditorSession,
  type TextSelection
} from './matchEditor';
import {
  capturedVariables,
  grantCovers,
  variableAdditionRefusal,
  type VariableAdditionRefusal,
  type VariableStructureGrant,
  type VariableStructureRefusal
} from './variableEditor';
import { choiceTargetsOf } from './variableGroup';
import {
  insertVariable,
  nameVerdictOf,
  suggestedName,
  type InsertOutcome,
  type NameContext,
  type NameVerdict,
  type ReferenceField
} from './variableInsertion';

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

/**
 * Which row of a form: an existing definition by its position, a drafted new one
 * by its position among the additions, or a placeholder with no definition by
 * its name.
 */
export type FormRowKey = `existing:${number}` | `added:${number}` | `placeholder:${string}`;

/**
 * What the builder has open — whose controls are mounted: one form's row, one
 * form's *Add field* panel, or the **Form** insertion. `null` for nothing.
 */
export type FormBuilderSelection =
  | { readonly kind: 'row'; readonly form: number; readonly row: FormRowKey }
  | { readonly kind: 'addField'; readonly form: number }
  | { readonly kind: 'insertForm' }
  | null;

/**
 * A selection bound to the forms baseline it was made over. A baseline is
 * replaced whole by a commit, a re-seed and a reapply and never by an edit, so a
 * replaced one clears a selection whatever positions the new one holds — the 4-11
 * review's second finding, carried to forms.
 */
export interface SeededFormSelection {
  /** The selection. */
  readonly selection: FormBuilderSelection;
  /** The forms baseline it was made over, or `null` for none. */
  readonly seed: FormsBaseline | null;
}

/** Nothing selected. */
export const NO_FORM_SELECTION: SeededFormSelection = Object.freeze({ selection: null, seed: null });

/**
 * A selection bound to the session's current forms baseline.
 *
 * @param session - The editing session.
 * @param selection - What to select.
 * @returns The seeded selection.
 */
export function seededFormSelection(
  session: MatchEditorSession,
  selection: FormBuilderSelection
): SeededFormSelection {
  return { selection, seed: selection === null ? null : session.baseline.forms };
} // End of function seededFormSelection()

/**
 * The selection a seeded one still makes over the session now: `null` once the
 * forms baseline it was made over has been replaced.
 *
 * @param session - The editing session.
 * @param seeded - The seeded selection.
 * @returns The selection, or `null`.
 */
export function formSelectionOfSeed(
  session: MatchEditorSession,
  seeded: SeededFormSelection
): FormBuilderSelection {
  return seeded.seed === session.baseline.forms ? seeded.selection : null;
} // End of function formSelectionOfSeed()

/**
 * A row's key.
 *
 * @param row - The derived row.
 * @returns Its key.
 */
export function rowKeyOf(row: FormRow): FormRowKey {
  if (row.definition === null) {
    return `placeholder:${row.name ?? ''}`;
  }
  return row.definition.kind === 'existing'
    ? `existing:${row.definition.index}`
    : `added:${row.definition.position}`;
} // End of function rowKeyOf()

// ---------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------

/**
 * What the draft does to a row's definition: `file` (nothing), `edited`,
 * `removed`, `added`, or `undefined` — a placeholder no definition names.
 */
export type RowStatus = 'file' | 'edited' | 'removed' | 'added' | 'undefined';

/** One row of the list, always drawn. */
export interface FormRowView {
  /** Its key. */
  readonly key: FormRowKey;
  /** The field's name, or `null` for a definition whose key could not be read. */
  readonly name: string | null;
  /** How many `[[name]]` the drafted layout holds. */
  readonly occurrences: number;
  /** The advisory, or `null`. */
  readonly advisory: FormRowAdvisory | null;
  /** What the draft does to it. */
  readonly status: RowStatus;
  /** The drafted `type` text, as its box holds it; `''` for none. Never interpreted. */
  readonly typeText: string;
  /** Whether its controls are mounted. */
  readonly selected: boolean;
}

/**
 * How a form's layout is drawn:
 *
 * - `contentField` — a shorthand form: the layout is the match editor's own
 *   `form` box above, the one draft of that scalar (ruling 17);
 * - `box` — a verbose form's layout box;
 * - `readOnly` — a verbose layout shown and not edited, with the reason; `text`
 *   is the file's text for `SourceText`, `''` when it holds none.
 */
export type LayoutView =
  | { readonly kind: 'contentField' }
  | { readonly kind: 'box'; readonly text: string; readonly editable: boolean }
  | { readonly kind: 'readOnly'; readonly text: string; readonly refusal: FormFieldRefusal };

/** One of the four drafted option boxes of the selected definition. */
export interface OptionBoxView {
  /** The option. */
  readonly key: FormOptionKey;
  /** What its box holds. */
  readonly text: string;
  /** Whether the file holds it. */
  readonly present: boolean;
  /** Whether the box is bound to a control that accepts changes. */
  readonly editable: boolean;
  /** Why it is shown and not edited, or `null`. */
  readonly refusal: FormFieldRefusal | null;
  /** Whether it is one line (an `<input>`) or may span lines (a text area). */
  readonly oneLine: boolean;
  /** The option's position in the definition, or `null` when absent. */
  readonly option: number | null;
  /** Whether the draft takes it out. */
  readonly removed: boolean;
  /** Whether *Take this option out* is offered. */
  readonly canRemove: boolean;
  /** Exact strings offered for the box, in every language; never imposed. */
  readonly suggestions: readonly string[];
}

/**
 * An option no control of this editor shows — one it does not draft, or a known
 * one its box cannot hold (the 4-12 review) — shown, and only removable.
 */
export interface OtherOptionView {
  /** Its position in the definition. */
  readonly option: number;
  /** Its key as written, or `null` for a key that is not a scalar. */
  readonly key: string | null;
  /** Its scalar text, or its items' texts: drawn through `SourceText`. */
  readonly texts: readonly string[];
  /** Its shape, when it is neither a scalar nor a list of scalars. */
  readonly shape: ValueKind | null;
  /** Whether the draft takes it out. */
  readonly removed: boolean;
  /** Whether *Take this option out* is offered. */
  readonly canRemove: boolean;
}

/** One existing `values` item. */
export interface ValuesItemView {
  /** What its box holds. */
  readonly text: string;
  /** What the file holds, for a removed item's line. */
  readonly fileText: string;
  /** Whether the box accepts changes. */
  readonly editable: boolean;
  /** Why it is shown and not edited, or `null`. */
  readonly refusal: FormFieldRefusal | null;
  /** Whether the draft takes it out. */
  readonly removed: boolean;
  /** Whether *Take this value out* is offered. */
  readonly canRemove: boolean;
}

/** The selected definition's `values`, in the representation the file uses. */
export type ValuesView =
  | { readonly kind: 'absent' }
  | { readonly kind: 'unsupported'; readonly option: number; readonly removed: boolean; readonly canRemove: boolean }
  | {
      readonly kind: 'list';
      /** Its position among the options. */
      readonly option: number;
      /** Whether the list is written between brackets. */
      readonly flow: boolean;
      /** Whether the draft takes the whole option out. */
      readonly removed: boolean;
      /** Whether *Take this option out* is offered. */
      readonly canRemove: boolean;
      /** The existing items. */
      readonly items: readonly ValuesItemView[];
      /** The new items, written at the end. */
      readonly added: readonly string[];
      /** Whether *Add values* is offered. */
      readonly canAdd: boolean;
    }
  | {
      readonly kind: 'text';
      /** Its position among the options. */
      readonly option: number;
      /** What the box holds. */
      readonly text: string;
      /** Whether the box accepts changes. */
      readonly editable: boolean;
      /** Why it is shown and not edited, or `null`. */
      readonly refusal: FormFieldRefusal | null;
      /** Whether the draft takes the option out. */
      readonly removed: boolean;
      /** Whether *Take this option out* is offered. */
      readonly canRemove: boolean;
    };

/** The controls of the selected row. */
export type SelectedFormRow =
  | {
      readonly kind: 'existing';
      /** The definition's position. */
      readonly index: number;
      /** Its name, or `null`. */
      readonly name: string | null;
      /** Whether the draft removes it (alone or with the container). */
      readonly removed: boolean;
      /** Whether *Take this field out* is offered. */
      readonly canRemove: boolean;
      /** Whether *Keep this field* is offered. */
      readonly canRestore: boolean;
      /** How many `[[name]]` a removal leaves in the layout — ruling 15's preview. */
      readonly occurrencesKept: number;
      /** The four drafted option boxes. */
      readonly options: readonly OptionBoxView[];
      /** Its `values`. */
      readonly values: ValuesView;
      /** Every other option, in file order. */
      readonly others: readonly OtherOptionView[];
      /** Whether its options are not a block mapping (a scalar, a flow mapping, …). */
      readonly optionsNotABlockMapping: boolean;
    }
  | {
      readonly kind: 'added';
      /** Its position among the additions. */
      readonly position: number;
      /** The name. */
      readonly name: string;
      /** Its `type`, or `''`. */
      readonly typeText: string;
      /** Its values, one per item, or none. */
      readonly values: readonly string[];
      /** Whether *Add field* also put `[[name]]` into the layout. */
      readonly placeholderInserted: boolean;
    }
  | {
      readonly kind: 'placeholder';
      /** The placeholder's name. */
      readonly name: string;
      /** How many times the layout holds it. */
      readonly occurrences: number;
    };

/** One form as the builder draws it. */
export interface FormView {
  /** Its position in `MatchBaseline.forms`. */
  readonly position: number;
  /** Which storage shape. */
  readonly shape: 'shorthand' | 'verbose';
  /** A verbose form's variable name as written; `null` for shorthand. */
  readonly variableName: string | null;
  /** Whether its transitions would do anything now. */
  readonly editable: boolean;
  /** How the layout is drawn. */
  readonly layout: LayoutView;
  /** The drafted layout's pieces, for the synchronized display. */
  readonly pieces: readonly LayoutPiece[];
  /** The rows, in `formRowsOf`'s order. */
  readonly rows: readonly FormRowView[];
  /** Whether the whole container is drafted for removal. */
  readonly removeAllDrafted: boolean;
  /** Why *Take out all the fields* is withheld, or `null`; `undefined`-free. */
  readonly removeAllRefusal: RemoveAllRefusal | null;
  /** The selected row's controls, or `null`. */
  readonly selected: SelectedFormRow | null;
  /** Whether this form's *Add field* panel is open. */
  readonly addFieldOpen: boolean;
}

/** What the builder draws. */
export interface FormBuilderView {
  /** One entry per form of the snippet, in baseline order. */
  readonly forms: readonly FormView[];
  /** Whether the **Form** insertion panel is open. */
  readonly insertOpen: boolean;
  /** Why a structural action is withheld (R36), or `null`. */
  readonly structureRefusal: VariableStructureRefusal | null;
}

/** Exact strings offered per option — never imposed, never a checkbox (D2u). */
export const FORM_OPTION_SUGGESTIONS: Readonly<Partial<Record<FormOptionKey, readonly string[]>>> = Object.freeze({
  type: Object.freeze(['text', 'choice', 'list']),
  multiline: Object.freeze(['true', 'false']),
  trim_string_values: Object.freeze(['true', 'false'])
});

/**
 * The texts of one option value this editor shows but does not draft.
 *
 * @param value - The projected value.
 * @returns The scalar text or the items' texts, and a shape for anything else.
 */
function shownValueOf(value: ValueView): { readonly texts: readonly string[]; readonly shape: ValueKind | null } {
  if ('Scalar' in value) {
    return { texts: [value.Scalar.text], shape: null };
  }
  if ('Sequence' in value && value.Sequence.every((item) => 'Scalar' in item)) {
    return { texts: value.Sequence.map((item) => ('Scalar' in item ? item.Scalar.text : '')), shape: null };
  }
  if ('Sequence' in value) {
    return { texts: [], shape: 'Sequence' };
  }
  if ('Mapping' in value) {
    return { texts: [], shape: 'Mapping' };
  }
  if ('Alias' in value) {
    return { texts: [], shape: 'Alias' };
  }
  return { texts: [], shape: value.Elided.kind };
} // End of function shownValueOf()

/**
 * Whether one option's content is actually shown by a box or by the `values`
 * controls — the 4-12 review's first finding. A recognised key is not enough:
 * a known option its box cannot hold (a `default` holding a list, a repeated
 * `type`) has no box that shows it, so it falls back to `SourceText` with every
 * other option this editor does not draft.
 *
 * @param definition - The definition's baseline.
 * @param option - The option's position.
 * @returns `true` when a control already shows this option's content.
 */
function isRepresented(definition: DefinitionBaseline, option: number): boolean {
  const entry = definition.options[option];
  const key = entry?.key !== null && entry?.key !== undefined && entry.key.decoded ? entry.key.text : null;
  if (key === null) {
    return false;
  }
  if ((FORM_OPTION_KEYS as readonly string[]).includes(key)) {
    const scalar = definition.scalars[key as FormOptionKey];
    const unshown = scalar.eligibility.kind === 'readOnly' && scalar.eligibility.reason === 'unmodelledShape';
    return scalar.index === option && !unshown;
  }
  if (key !== 'values') {
    return false;
  }
  const values = definition.values;
  if (values.kind === 'text') {
    return values.index === option;
  }
  return (
    values.kind === 'list' &&
    values.index === option &&
    values.items.every((item) => !(item.eligibility.kind === 'readOnly' && item.eligibility.reason === 'unmodelledShape'))
  );
} // End of function isRepresented()

/**
 * The controls of one selected existing definition.
 *
 * @param session - The editing session.
 * @param form - The form's position.
 * @param index - The definition's position.
 * @param occurrences - How many `[[name]]` the drafted layout holds.
 * @param grantHolds - Whether a structural action would be granted now.
 * @returns The controls, or `null` for no such definition.
 */
function selectedExisting(
  session: MatchEditorSession,
  form: number,
  index: number,
  occurrences: number,
  grantHolds: boolean
): SelectedFormRow | null {
  const held = session.baseline.forms.forms[form];
  const definition = held?.definitions[index];
  const drafted = capturedForms(session.draft.value.forms).forms[form];
  const box = drafted?.definitions[index];
  if (held === undefined || definition === undefined || drafted === undefined || box === undefined) {
    return null;
  }
  const editable = isFormEditable(session, form);
  const removed = drafted.removeAll || box.removed;
  const live = editable && !removed;
  const removedOptions = new Set(box.removedOptions);
  const remaining = definition.options.length - removedOptions.size;
  /**
   * Whether one option may be taken out now.
   *
   * @param option - Its position.
   * @returns `true` when the press would draft it.
   */
  const removable = (option: number): boolean =>
    live && grantHolds && !removedOptions.has(option) && optionRemovable(definition, option) && remaining > 1;
  const options: OptionBoxView[] = FORM_OPTION_KEYS.map((key) => {
    const scalar = definition.scalars[key];
    const optionRemoved = scalar.index !== null && removedOptions.has(scalar.index);
    const refusal = scalar.eligibility.kind === 'readOnly' ? scalar.eligibility.reason : null;
    return {
      key,
      text: box.options[key].text,
      present: scalar.present,
      editable: live && refusal === null && !optionRemoved,
      refusal,
      oneLine: isOneLineOption(key),
      option: scalar.index,
      removed: optionRemoved,
      canRemove: scalar.index !== null && removable(scalar.index),
      suggestions: FORM_OPTION_SUGGESTIONS[key] ?? []
    };
  }); // End of the map over the drafted options
  const others: OtherOptionView[] = [];
  definition.options.forEach((entry, option) => {
    if (isRepresented(definition, option)) {
      return;
    }
    const shown = shownValueOf(entry.value);
    others.push({
      option,
      key: entry.key === null ? null : entry.key.text,
      texts: shown.texts,
      shape: shown.shape,
      removed: removedOptions.has(option),
      canRemove: removable(option)
    });
  }); // End of the walk over the options this editor does not draft
  return {
    kind: 'existing',
    index,
    name: definition.name,
    removed,
    canRemove: live && grantHolds && held.definitionsShape === 'block',
    canRestore: editable && box.removed && !drafted.removeAll,
    occurrencesKept: occurrences,
    options,
    values: valuesViewOf(definition, box, live, grantHolds, removable),
    others,
    optionsNotABlockMapping: definition.optionsShape !== 'block'
  };
} // End of function selectedExisting()

/**
 * The selected definition's `values` view.
 *
 * @param definition - The baseline.
 * @param box - Its buffer.
 * @param live - Whether the definition accepts changes.
 * @param grantHolds - Whether a structural action would be granted.
 * @param removable - Whether one option may be taken out now.
 * @returns The view.
 */
function valuesViewOf(
  definition: FormsBaseline['forms'][number]['definitions'][number],
  box: ReturnType<typeof capturedForms>['forms'][number]['definitions'][number],
  live: boolean,
  grantHolds: boolean,
  removable: (option: number) => boolean
): ValuesView {
  const values = definition.values;
  const removedOptions = new Set(box.removedOptions);
  switch (values.kind) {
    case 'absent':
      return { kind: 'absent' };
    case 'unsupported':
      return {
        kind: 'unsupported',
        option: values.index,
        removed: removedOptions.has(values.index),
        canRemove: removable(values.index)
      };
    case 'text': {
      const refusal = values.scalar.eligibility.kind === 'readOnly' ? values.scalar.eligibility.reason : null;
      const removed = removedOptions.has(values.index);
      return {
        kind: 'text',
        option: values.index,
        text: box.values.kind === 'text' ? box.values.text : values.scalar.value,
        editable: live && refusal === null && !removed,
        refusal,
        removed,
        canRemove: removable(values.index)
      };
    }
    case 'list': {
      const removed = removedOptions.has(values.index);
      const buffer = box.values.kind === 'list' ? box.values : { items: [], added: [] as readonly string[] };
      const kept = buffer.items.filter((one) => !one.removed).length;
      const items: ValuesItemView[] = values.items.map((item, at) => {
        const itemBox = buffer.items[at] ?? { text: item.value, removed: false };
        const refusal = item.eligibility.kind === 'readOnly' ? item.eligibility.reason : null;
        return {
          text: itemBox.text,
          fileText: item.value,
          editable: live && !removed && refusal === null && !itemBox.removed,
          refusal,
          removed: itemBox.removed,
          canRemove: live && grantHolds && !removed && !itemBox.removed && refusal !== 'unmodelledShape' && kept > 1
        };
      }); // End of the map over the existing items
      return {
        kind: 'list',
        option: values.index,
        flow: values.flow,
        removed,
        canRemove: removable(values.index),
        items,
        added: buffer.added,
        canAdd: live && grantHolds && !removed
      };
    }
  }
} // End of function valuesViewOf()

/**
 * The controls of one selected row.
 *
 * @param session - The editing session.
 * @param form - The form's position.
 * @param row - The derived row.
 * @param grantHolds - Whether a structural action would be granted now.
 * @returns The controls, or `null`.
 */
function selectedRowOf(
  session: MatchEditorSession,
  form: number,
  row: FormRow,
  grantHolds: boolean
): SelectedFormRow | null {
  if (row.definition === null) {
    return { kind: 'placeholder', name: row.name ?? '', occurrences: row.occurrences };
  }
  if (row.definition.kind === 'existing') {
    return selectedExisting(session, form, row.definition.index, row.occurrences, grantHolds);
  }
  const added = session.draft.value.forms.forms[form]?.added[row.definition.position];
  if (added === undefined) {
    return null;
  }
  const values = added.field.options.values;
  return {
    kind: 'added',
    position: row.definition.position,
    name: added.field.name,
    typeText: added.field.options.type ?? '',
    values: values === null ? [] : 'List' in values ? values.List : [values.Text],
    placeholderInserted: added.placeholderInserted
  };
} // End of function selectedRowOf()

/**
 * A row's status marker.
 *
 * @param session - The editing session.
 * @param form - The form's position.
 * @param row - The derived row.
 * @returns The status.
 */
function rowStatusOf(session: MatchEditorSession, form: number, row: FormRow): RowStatus {
  if (row.definition === null) {
    return 'undefined';
  }
  if (row.definition.kind === 'added') {
    return 'added';
  }
  if (row.definition.removed) {
    return 'removed';
  }
  const definition = session.baseline.forms.forms[form]?.definitions[row.definition.index];
  const box = session.draft.value.forms.forms[form]?.definitions[row.definition.index];
  return definition !== undefined && box !== undefined && definitionIsEdited(definition, box) ? 'edited' : 'file';
} // End of function rowStatusOf()

/**
 * A row's drafted `type` text.
 *
 * @param session - The editing session.
 * @param form - The form's position.
 * @param row - The derived row.
 * @returns The text, or `''`.
 */
function typeTextOf(session: MatchEditorSession, form: number, row: FormRow): string {
  const drafted = session.draft.value.forms.forms[form];
  if (row.definition === null || drafted === undefined) {
    return '';
  }
  if (row.definition.kind === 'added') {
    return drafted.added[row.definition.position]?.field.options.type ?? '';
  }
  return drafted.definitions[row.definition.index]?.options.type.text ?? '';
} // End of function typeTextOf()

/**
 * How one form's layout is drawn.
 *
 * @param session - The editing session.
 * @param form - The form's position.
 * @returns The layout view.
 */
function layoutViewOf(session: MatchEditorSession, form: number): LayoutView {
  const held = session.baseline.forms.forms[form];
  const drafted = session.draft.value.forms.forms[form];
  if (held === undefined || held.layout === null) {
    return { kind: 'contentField' };
  }
  if (held.layout.eligibility.kind === 'readOnly') {
    return { kind: 'readOnly', text: held.layout.value, refusal: held.layout.eligibility.reason };
  }
  return { kind: 'box', text: drafted?.layout?.text ?? held.layout.value, editable: isFormEditable(session, form) };
} // End of function layoutViewOf()

/**
 * What the builder draws now.
 *
 * @param session - The editing session.
 * @param selection - What is selected, from {@link formSelectionOfSeed}.
 * @param grant - The structure grant from the view's read (R36); a press mints
 *   its own.
 * @returns The view.
 */
export function formBuilderViewOf(
  session: MatchEditorSession,
  selection: FormBuilderSelection,
  grant: VariableStructureGrant
): FormBuilderView {
  const grantHolds = grantCovers(grant, session.match);
  const buffer = capturedForms(session.draft.value.forms);
  const forms: FormView[] = session.baseline.forms.forms.map((held, position) => {
    const derived = formRows(session, position);
    const rows = derived?.rows ?? [];
    let selected: SelectedFormRow | null = null;
    const rowViews: FormRowView[] = rows.map((row) => {
      const key = rowKeyOf(row);
      const isSelected = selection?.kind === 'row' && selection.form === position && selection.row === key;
      if (isSelected) {
        selected = selectedRowOf(session, position, row, grantHolds);
      }
      return {
        key,
        name: row.name,
        occurrences: row.occurrences,
        advisory: row.advisory,
        status: rowStatusOf(session, position, row),
        typeText: typeTextOf(session, position, row),
        selected: isSelected && selected !== null
      };
    }); // End of the map over the form's rows
    const editable = isFormEditable(session, position);
    const removeAllDrafted = buffer.forms[position]?.removeAll === true;
    const refusal = editable
      ? removeAllRefusal(session.baseline.forms, buffer, position)
      : ('formNotEditable' as const);
    return {
      position,
      shape: held.address.kind,
      variableName: held.variableName,
      editable,
      layout: layoutViewOf(session, position),
      pieces: derived?.pieces ?? [],
      rows: rowViews,
      removeAllDrafted,
      removeAllRefusal: refusal,
      selected,
      addFieldOpen: selection?.kind === 'addField' && selection.form === position
    };
  }); // End of the map over the forms
  return {
    forms,
    insertOpen: selection?.kind === 'insertForm',
    structureRefusal: grant.kind === 'refused' ? grant.reason : null
  };
} // End of function formBuilderViewOf()

// ---------------------------------------------------------------------------
// A new definition: Add field, and defining a placeholder
// ---------------------------------------------------------------------------

/** The kind of field a new definition describes — Choice and List first-class. */
export type NewFieldKind = 'text' | 'choice' | 'list';

/** The three, in the order the builder offers them. */
export const NEW_FIELD_KINDS: readonly NewFieldKind[] = ['text', 'choice', 'list'];

/**
 * What a new definition's panel holds: its name, its kind and — for a choice or
 * a list — its values, one per line. The component holds it; nothing here
 * stores it.
 */
export interface FieldDraft {
  /** The name — the placeholder's own for a placeholder with no definition. */
  readonly name: string;
  /** The kind. */
  readonly kind: NewFieldKind;
  /** The values, one per line, as the text area holds them. */
  readonly values: string;
}

/**
 * The closed description a panel asks for: `type` spelled as the kind's name (a
 * logical string, D2u), and for a choice or a list its `values` as a list —
 * never a text, since the panel's values are one per line.
 *
 * @param draft - The panel.
 * @returns The description, or the values' problem.
 */
export function newFieldOf(
  draft: FieldDraft
): { readonly field: NewFormField } | { readonly problem: Exclude<ValuesAdditionProblem, 'notAList'> } {
  const options = {
    type: draft.kind,
    default: null,
    multiline: null,
    values: null,
    trim_string_values: null,
    extra: []
  };
  if (draft.kind === 'text') {
    return { field: { name: draft.name, options } };
  }
  const values = valuesOfLines(draft.values);
  if ('problem' in values) {
    return values;
  }
  return { field: { name: draft.name, options: { ...options, values: { List: [...values.values] } } } };
} // End of function newFieldOf()

/** What a new definition's panel says beside its controls. */
export interface FieldAdditionView {
  /** Why the definition would be refused, or `null`. */
  readonly refusal: FormAdditionRefusal | null;
  /** The values' problem, or `null`. */
  readonly problem: Exclude<ValuesAdditionProblem, 'notAList'> | null;
  /** Whether *Add* would draft it. */
  readonly canAdd: boolean;
}

/**
 * What a new definition's panel says now — a dry run of `formAdditionRefusal`
 * over the drafted forms, and the values' problem.
 *
 * @param session - The editing session.
 * @param form - The form's position.
 * @param grant - The structure grant from the view's read.
 * @param draft - The panel.
 * @returns The view.
 */
export function fieldAdditionViewOf(
  session: MatchEditorSession,
  form: number,
  grant: VariableStructureGrant,
  draft: FieldDraft
): FieldAdditionView {
  const described = newFieldOf(draft);
  const problem = 'problem' in described ? described.problem : null;
  const candidate: NewFormField =
    'field' in described
      ? described.field
      : { name: draft.name, options: { type: draft.kind, default: null, multiline: null, values: null, trim_string_values: null, extra: [] } };
  const refusal: FormAdditionRefusal | null = !isFormEditable(session, form)
    ? { kind: 'formNotEditable' }
    : grant.kind === 'refused'
      ? { kind: 'structure', reason: grant.reason }
      : formAdditionRefusal(session.baseline.forms, capturedForms(session.draft.value.forms), form, candidate);
  return { refusal, problem, canAdd: refusal === null && problem === null };
} // End of function fieldAdditionViewOf()

/** What pressing *Add* on a new definition's panel did. */
export type FieldAdditionOutcome =
  | FormFieldOutcome
  | {
      /** The values could not be used; nothing was drafted. */
      readonly kind: 'problem';
      /** The same session. */
      readonly session: MatchEditorSession;
      /** Why. */
      readonly problem: Exclude<ValuesAdditionProblem, 'notAList'>;
    };

/**
 * *Add* on a new definition's panel — the explicit compound addition (ruling
 * 15) through `addFormField` in `./matchEditor.ts`: with a `selection`, the
 * layout's selection becomes `[[name]]` and the definition is added, as one
 * history step; with `null` (a placeholder the layout already holds), the
 * definition alone.
 *
 * @param session - The editing session.
 * @param grant - The structure grant, minted from a read taken at the press.
 * @param form - The form's position.
 * @param draft - The panel.
 * @param selection - The layout control's selection, or `null`.
 * @returns What happened.
 */
export function addField(
  session: MatchEditorSession,
  grant: VariableStructureGrant,
  form: number,
  draft: FieldDraft,
  selection: TextSelection | null
): FieldAdditionOutcome {
  const described = newFieldOf(draft);
  if ('problem' in described) {
    return { kind: 'problem', session, problem: described.problem };
  }
  return addFormField(session, grant, form, { field: described.field, selection });
} // End of function addField()

// ---------------------------------------------------------------------------
// The Form insertion
// ---------------------------------------------------------------------------

/**
 * How one placeholder of a new form is defined: `none` writes no definition for
 * it (what espanso makes of an undefined field is not established here — R16),
 * `choice` and `list` a definition with their `type` and values.
 */
export type InsertedFieldKind = 'none' | 'choice' | 'list';

/** The three, in the order the **Form** insertion offers them. */
export const INSERTED_FIELD_KINDS: readonly InsertedFieldKind[] = ['none', 'choice', 'list'];

/** One placeholder's choices in the **Form** insertion. */
export interface InsertedFieldDraft {
  /** The placeholder's name. */
  readonly name: string;
  /** How it is defined. */
  readonly kind: InsertedFieldKind;
  /** Its values, one per line, for a choice or a list. */
  readonly values: string;
  /** Whether `{{form.name}}` goes into the content key. */
  readonly referenced: boolean;
}

/**
 * What the **Form** insertion's panel holds: the new variable's name, its
 * layout, the content key its references go into, and each placeholder's
 * choices (kept by name, so a placeholder retyped away and back keeps them).
 */
export interface FormInsertionDraft {
  /** The proposed name — provisional until inserted. */
  readonly name: string;
  /** The layout, as its text area holds it. */
  readonly layout: string;
  /** The content key the references go into. */
  readonly target: ReferenceField;
  /** Choices made per placeholder name; a name with none is `none`, referenced. */
  readonly fields: readonly InsertedFieldDraft[];
}

/**
 * Why a **Form** cannot be inserted as the panel stands — a code, with the field
 * for a values problem:
 *
 * - `noTarget` — no content key of this snippet can take a reference now (a
 *   shorthand `form` snippet included: there, a layout's fields are authored by
 *   *Add field* instead);
 * - `noLayout` — the layout is empty;
 * - `unreadableLayout` — the layout holds a carriage return;
 * - `noPlaceholder` — the layout holds no placeholder of the supported subset;
 * - `noReference` — no field is referenced;
 * - `values` — one field's values cannot be used.
 */
export type FormInsertionProblem =
  | { readonly kind: 'noTarget' }
  | { readonly kind: 'noLayout' }
  | { readonly kind: 'unreadableLayout' }
  | { readonly kind: 'noPlaceholder' }
  | { readonly kind: 'noReference' }
  | { readonly kind: 'values'; readonly field: string; readonly problem: Exclude<ValuesAdditionProblem, 'notAList'> };

/**
 * The panel a **Form** insertion opens with: a provisional name the context does
 * not refuse (`form`, `form2`, …), an empty layout, and the focused content key
 * when it can take a reference, else the first that can.
 *
 * @param session - The editing session.
 * @param context - The names, from `nameContextOf`.
 * @returns The panel's starting value.
 */
export function formInsertionDraftOf(session: MatchEditorSession, context: NameContext): FormInsertionDraft {
  const targets = choiceTargetsOf(session);
  const focus = session.focus;
  const target =
    focus !== null && (targets as readonly string[]).includes(focus)
      ? (focus as ReferenceField)
      : (targets[0] ?? 'replace');
  return { name: suggestedName('form', context), layout: '', target, fields: [] };
} // End of function formInsertionDraftOf()

/**
 * The placeholders of the panel's layout, in order of first occurrence, each
 * with its choices.
 *
 * @param draft - The panel.
 * @returns One entry per placeholder name.
 */
export function insertedFieldsOf(draft: FormInsertionDraft): readonly InsertedFieldDraft[] {
  const names: string[] = [];
  for (const piece of layoutPiecesOf(draft.layout)) {
    if (piece.kind === 'placeholder' && !names.includes(piece.name)) {
      names.push(piece.name);
    }
  } // End of the loop over the layout's pieces
  return names.map(
    (name) => draft.fields.find((one) => one.name === name) ?? { name, kind: 'none', values: '', referenced: true }
  );
} // End of function insertedFieldsOf()

/**
 * The panel with one placeholder's choices replaced.
 *
 * @param draft - The panel.
 * @param field - The new choices for that placeholder.
 * @returns The new panel.
 */
export function withInsertedField(draft: FormInsertionDraft, field: InsertedFieldDraft): FormInsertionDraft {
  return { ...draft, fields: [...draft.fields.filter((one) => one.name !== field.name), field] };
} // End of function withInsertedField()

/**
 * The closed description and the references the panel asks for, or the problem.
 *
 * @param draft - The panel.
 * @returns The variable and its sub-references, or the problem.
 */
export function formVariableOf(
  draft: FormInsertionDraft
):
  | { readonly variable: NewVariable; readonly references: readonly string[] }
  | { readonly problem: FormInsertionProblem } {
  if (draft.layout.includes('\r')) {
    return { problem: { kind: 'unreadableLayout' } };
  }
  if (draft.layout === '') {
    return { problem: { kind: 'noLayout' } };
  }
  const fields = insertedFieldsOf(draft);
  if (fields.length === 0) {
    return { problem: { kind: 'noPlaceholder' } };
  }
  const definitions: NewFormField[] = [];
  for (const field of fields) {
    if (field.kind === 'none') {
      continue;
    }
    const described = newFieldOf({ name: field.name, kind: field.kind, values: field.values });
    if ('problem' in described) {
      return { problem: { kind: 'values', field: field.name, problem: described.problem } };
    }
    definitions.push(described.field);
  } // End of the loop over the placeholders
  const references = fields.filter((one) => one.referenced).map((one) => one.name);
  if (references.length === 0) {
    return { problem: { kind: 'noReference' } };
  }
  return {
    variable: {
      name: draft.name,
      params: { Form: { layout: draft.layout, fields: definitions } },
      inject_vars: null,
      depends_on: null,
      extra_params: []
    },
    references
  };
} // End of function formVariableOf()

/** What the **Form** insertion's panel draws beside its controls. */
export interface FormInsertionView {
  /** The content keys offered as targets. */
  readonly targets: readonly ReferenceField[];
  /** The name check's verdict — "available among visible names" under an open scope. */
  readonly verdict: NameVerdict;
  /** The placeholders, each with its choices. */
  readonly fields: readonly InsertedFieldDraft[];
  /** The references *Insert* would write, exactly; `''` when there is a problem. */
  readonly referenceText: string;
  /** Why it cannot be inserted, or `null`. */
  readonly problem: FormInsertionProblem | null;
  /** Why no variable can be added now, or `null`. */
  readonly withheld:
    | { readonly kind: 'structure'; readonly reason: VariableStructureRefusal }
    | { readonly kind: 'addition'; readonly reason: VariableAdditionRefusal }
    | { readonly kind: 'notEditable' }
    | null;
  /** Whether *Insert* would draft it. */
  readonly canInsert: boolean;
}

/**
 * What the **Form** insertion's panel says about its current value.
 *
 * @param session - The editing session.
 * @param context - The names, from `nameContextOf`.
 * @param grant - The structure grant, from the view's read.
 * @param draft - The panel.
 * @returns The view.
 */
export function formInsertionViewOf(
  session: MatchEditorSession,
  context: NameContext,
  grant: VariableStructureGrant,
  draft: FormInsertionDraft
): FormInsertionView {
  const targets = choiceTargetsOf(session);
  const verdict = nameVerdictOf(draft.name, context, true);
  const described = formVariableOf(draft);
  const problem: FormInsertionProblem | null = !targets.includes(draft.target)
    ? { kind: 'noTarget' }
    : 'problem' in described
      ? described.problem
      : null;
  const addition = variableAdditionRefusal(
    session.baseline.variables,
    capturedVariables(session.draft.value.variables)
  );
  const withheld: FormInsertionView['withheld'] = !isVariablesEditable(session)
    ? { kind: 'notEditable' }
    : grant.kind === 'refused'
      ? { kind: 'structure', reason: grant.reason }
      : addition !== null
        ? { kind: 'addition', reason: addition }
        : null;
  return {
    targets,
    verdict,
    fields: insertedFieldsOf(draft),
    referenceText:
      'problem' in described ? '' : described.references.map((sub) => `{{${draft.name}.${sub}}}`).join(' '),
    problem,
    withheld,
    canInsert: withheld === null && problem === null && verdict.kind === 'available'
  };
} // End of function formInsertionViewOf()

/** What pressing *Insert* on the **Form** panel did. */
export type FormInsertionOutcome =
  | InsertOutcome
  | {
      /** The panel could not be used; nothing was drafted. */
      readonly kind: 'problem';
      /** The same session. */
      readonly session: MatchEditorSession;
      /** Why. */
      readonly problem: FormInsertionProblem;
    };

/**
 * *Insert* on the **Form** panel: the referenced `{{name.field}}` in place of the
 * target's selection and the new `type: form` variable (its layout and the
 * Choice and List definitions chosen) at the end of `vars`, as **one** history
 * step and one save (`insertVariable` in `./variableInsertion.ts`, which checks
 * the grant, the addition, the name and every text).
 *
 * @param session - The editing session.
 * @param grant - The structure grant, minted from a read taken at the press.
 * @param context - The names, from `nameContextOf` at the press.
 * @param draft - The panel.
 * @param selection - The target box's selection, in UTF-16 code units.
 * @returns What happened.
 */
export function insertForm(
  session: MatchEditorSession,
  grant: VariableStructureGrant,
  context: NameContext,
  draft: FormInsertionDraft,
  selection: TextSelection
): FormInsertionOutcome {
  if (!choiceTargetsOf(session).includes(draft.target)) {
    return { kind: 'problem', session, problem: { kind: 'noTarget' } };
  }
  const described = formVariableOf(draft);
  if ('problem' in described) {
    return { kind: 'problem', session, problem: described.problem };
  }
  return insertVariable(session, grant, context, {
    field: draft.target,
    selection,
    variable: described.variable,
    subReferences: described.references
  });
} // End of function insertForm()

// ---------------------------------------------------------------------------
// Sentences: codes to keys
// ---------------------------------------------------------------------------

/**
 * The dictionary key holding a row's status marker.
 *
 * @param status - The status.
 * @returns The key, or `null` for `file`, which draws none.
 */
export function rowStatusKey(status: RowStatus): TranslationKey | null {
  switch (status) {
    case 'file':
      return null;
    case 'edited':
      return 'browser.formBuilder.status.edited';
    case 'removed':
      return 'browser.formBuilder.status.removed';
    case 'added':
      return 'browser.formBuilder.status.added';
    case 'undefined':
      return 'browser.formBuilder.status.undefined';
  }
} // End of function rowStatusKey()

/**
 * The dictionary key holding why *Take out all the fields* is withheld.
 *
 * @param refusal - The code.
 * @returns The key.
 */
export function removeAllRefusalKey(refusal: RemoveAllRefusal): TranslationKey {
  switch (refusal) {
    case 'noDefinitions':
      return 'browser.formBuilder.removeAll.noDefinitions';
    case 'additionsPending':
      return 'browser.formBuilder.removeAll.additionsPending';
    case 'formNotEditable':
      return 'browser.formBuilder.removeAll.formNotEditable';
  }
} // End of function removeAllRefusalKey()

/**
 * The dictionary key holding one values problem's sentence.
 *
 * @param problem - The code.
 * @returns The key.
 */
export function valuesProblemKey(problem: ValuesAdditionProblem): TranslationKey {
  switch (problem) {
    case 'notAList':
      return 'browser.formBuilder.values.notAList';
    case 'noValues':
      return 'browser.formBuilder.values.noValues';
    case 'emptyValue':
      return 'browser.formBuilder.values.emptyValue';
    case 'unreadableText':
      return 'browser.formBuilder.values.unreadableText';
  }
} // End of function valuesProblemKey()

/**
 * The dictionary key holding one **Form** insertion problem's sentence; a values
 * problem takes the field's name as `{name}`.
 *
 * @param problem - The problem.
 * @returns The key.
 */
export function formInsertionProblemKey(problem: FormInsertionProblem): TranslationKey {
  switch (problem.kind) {
    case 'noTarget':
      return 'browser.formBuilder.insert.noTarget';
    case 'noLayout':
      return 'browser.formBuilder.insert.noLayout';
    case 'unreadableLayout':
      return 'browser.formBuilder.insert.unreadableLayout';
    case 'noPlaceholder':
      return 'browser.formBuilder.insert.noPlaceholder';
    case 'noReference':
      return 'browser.formBuilder.insert.noReference';
    case 'values':
      return 'browser.formBuilder.insert.values';
  }
} // End of function formInsertionProblemKey()

/**
 * The dictionary key holding the marker of a layout region the supported subset
 * does not read as a placeholder.
 *
 * @param reason - Why.
 * @returns The key.
 */
export function layoutMalformationKey(reason: LayoutMalformation): TranslationKey {
  switch (reason) {
    case 'empty':
      return 'browser.formBuilder.layout.empty';
    case 'invalidIdentifier':
      return 'browser.formBuilder.layout.invalidIdentifier';
    case 'unterminated':
      return 'browser.formBuilder.layout.unterminated';
  }
} // End of function layoutMalformationKey()

/**
 * The dictionary key holding a new field kind's label.
 *
 * @param kind - The kind.
 * @returns The key.
 */
export function newFieldKindKey(kind: NewFieldKind | InsertedFieldKind): TranslationKey {
  switch (kind) {
    case 'text':
      return 'browser.formBuilder.kind.text';
    case 'choice':
      return 'browser.formBuilder.kind.choice';
    case 'list':
      return 'browser.formBuilder.kind.list';
    case 'none':
      return 'browser.formBuilder.kind.none';
  }
} // End of function newFieldKindKey()
