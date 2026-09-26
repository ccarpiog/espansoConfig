/**
 * The shared variable editor's model — Phase 4-9: one snippet's local `vars`,
 * drafted beside the seventeen scalar fields, as a value.
 *
 * **No component and no screen**, for `./matchEditor.ts`'s standing reason: only
 * the files that opt into jsdom mount a Svelte component in a test, so a decision
 * written in markup is a decision one renderer's suite carries alone. Step 4-11
 * draws what this module decides.
 *
 * ## What it is, and what it composes into
 *
 * Ruling 24 of `docs/decisions/4-split-notes.md`: the variables surface is a
 * submodel **composed into one buffer set, one history, one save and one conflict
 * registry** — the match editor's. So nothing here holds a session, a history or
 * a conflict. It holds:
 *
 * - {@link VariablesBaseline}, the projection side: what the file's `vars` held
 *   when the session was seeded — its shape, the **whole container's** Rust-cut
 *   baseline (`MatchView.vars_container`, ruling 22), and one row per projected
 *   variable. Not drafted;
 * - {@link VariablesBuffer}, the draft side: what the controls hold — each
 *   existing variable's `name`, `type` and `inject_vars` boxes, its parameter,
 *   list item and `depends_on` boxes (Phase 4-14-2, `./variableParams.ts`), and
 *   whether it is drafted for removal, the new variables, and whether the whole container is
 *   drafted for removal. `MatchBuffers.variables` in `./matchEditor.ts`, so the
 *   one `Draft<MatchBuffers>` snapshots, undoes, retains and copies it with the
 *   fields;
 * - the pure transitions over that buffer, the one derivation of the wire's
 *   `vars` and `var_intents` ({@link variablesDerivationOf}), the whole-container
 *   reapply verdict ({@link variablesReapply}), the retained rows a conflict
 *   compares and copies ({@link variableRowsOf}), and the R36/R37 structure rules
 *   ({@link variableStructureGrantOf}, {@link variableMoveOfferOf}).
 *
 * `./matchEditor.ts` owns the session-level transitions and calls these;
 * `./variableInsertion.ts` owns the compound *Insert* action and name checks.
 *
 * ## The rules it keeps
 *
 * - **Absent, present and removed are three states**, as for every scalar field:
 *   an existing variable's absent `type` left blank is `'Unchanged'`. Since Rust's
 *   `VariableDraft` refuses to insert an absent key into an existing variable
 *   ("an absent field is refused, never inserted"), an absent key is read-only
 *   here (`notInVariable`) rather than a box whose only possible save is a refusal.
 * - **Whole-container reapply** (ruling 22): a drafted variable change reapplies
 *   only when the container's baseline is unchanged — the same Rust fingerprint —
 *   or when the whole intended list is already on disk; otherwise the whole
 *   container collides. No variable is followed across revisions by index or by
 *   name.
 * - **One new variable per draft.** Rust refuses two insertions at one landing,
 *   and a new variable always lands at the end of the list, so a second addition
 *   is refused here before it could only reach that refusal (4-4 notes §1.3).
 * - **A container is removed only by its own explicit intent** (ruling 8):
 *   removing every variable one by one is withheld (`varsWouldBeEmpty`), and
 *   {@link withVariablesRemoved} is the explicit intent.
 * - **Every text a one-line control drafts refuses a carriage return and a line
 *   feed**; every other drafted text refuses a carriage return
 *   ({@link variableTextsOf}). `./matchEditor.ts`'s `beginSave` checks the wire
 *   draft with it, because `MatchBuffers` carries no brand.
 *
 * ## What no type here forces
 *
 * That a caller hands {@link variableStructureGrantOf} and
 * {@link variableMoveOfferOf} the projections the window holds **now**, read once
 * (R37). The grant and the offer are derived from one {@link VariableStructureRead},
 * and a transition or a submission spends only a grant or an offer; a caller that
 * reads the projections twice and pairs the answers type-checks. The caller in
 * this tree is `BrowserState.variableStructureRead` in `./workspace.svelte.ts`,
 * which reads its projections once.
 */

import type { TranslationKey } from '../i18n/dictionaries';
import type {
  ContainerBaseline,
  ContentForm,
  ContentRevision,
  DocumentId,
  DocumentView,
  FieldView,
  ListPlacement,
  MatchId,
  MatchView,
  NewFormField,
  NewParam,
  NewVariable,
  NewVariableParams,
  ScalarView,
  SequencePresence,
  ValueView,
  VariableDraft,
  VariableField,
  VariableKind,
  VariableView,
  VarsIntent
} from '../ipc/types';
import { hasStaleMatchDraft } from './matchMove';
import type { DraftFieldStatus, RetainedDraftField, RetainedLabel } from './saveOutcome';
import {
  capturedParams,
  intendedItemsOf,
  intendedParamOf,
  paramRowsOf,
  paramsBaselineOf,
  paramsBufferOf,
  paramsDerivationOf,
  type IntendedItem,
  type ListBaseline,
  type ParamsBaseline,
  type ParamsBuffer
} from './variableParams';

// ---------------------------------------------------------------------------
// The projection side
// ---------------------------------------------------------------------------

/** The three schema-known scalars of an existing variable this editor drafts. */
export const VARIABLE_FIELDS: readonly VariableField[] = ['name', 'type', 'inject_vars'];

/**
 * Why one scalar of an existing variable may not be edited — a code, never a
 * sentence ({@link variableFieldRefusalKey}).
 *
 * The first five are `./matchEditor.ts`'s `FieldRefusal` codes for the same
 * reasons and share their sentences; `notInVariable` is this module's own: the
 * variable does not hold the key, and Rust's `VariableDraft` refuses to insert
 * one, so a box would only ever reach a refusal.
 */
export type VariableFieldRefusal =
  | 'notDecodable'
  | 'carriageReturn'
  | 'ownsNoBytes'
  | 'unmodelledShape'
  | 'lineBreak'
  | 'notInVariable';

/** Whether one scalar of an existing variable may be edited. */
export type VariableFieldEligibility =
  | {
      /** The scalar may be bound to a one-line control. */
      readonly kind: 'editable';
    }
  | {
      /** It is shown and not edited. */
      readonly kind: 'readOnly';
      /** Why, as a code. */
      readonly reason: VariableFieldRefusal;
    };

/** What the file held for one scalar of an existing variable. Not drafted. */
export interface VariableScalarBaseline {
  /** Whether the variable held the key at all. */
  readonly present: boolean;
  /** The projected logical value, or `''` when the key is absent. */
  readonly value: string;
  /** Whether it may be edited, and why not. */
  readonly eligibility: VariableFieldEligibility;
}

/**
 * What the file held for one existing variable, by its position in `vars`.
 *
 * The three drafted scalars, and everything else the variable holds kept as
 * projected values, so a reapply can ask whether the disk already holds the
 * intended variable without slicing a byte span.
 */
export interface VariableRowBaseline {
  /** The kind its `type` names. */
  readonly kind: VariableKind;
  /** `name`. */
  readonly name: VariableScalarBaseline;
  /** `type`. */
  readonly type: VariableScalarBaseline;
  /** `inject_vars`. */
  readonly inject_vars: VariableScalarBaseline;
  /** `params`, projected shallowly, in source order. */
  readonly params: readonly FieldView[];
  /** Whether `params` is written at all. */
  readonly paramsPresent: boolean;
  /** `depends_on`, one item per source entry. */
  readonly dependsOn: readonly ValueView[];
  /** Whether `depends_on` is written at all. */
  readonly dependsOnPresent: boolean;
  /** Entries the projection did not model, as `key=value` source text. */
  readonly unknown: readonly string[];
  /**
   * The projected variable itself, copied, for the reapply's "already there"
   * comparison of scalar spellings. Never drawn and never sent.
   */
  readonly view: VariableView;
  /**
   * What the file holds for the `params` entries, list items and `depends_on`
   * items the editor drafts — Phase 4-14-2, `./variableParams.ts`.
   */
  readonly boxes: ParamsBaseline;
}

/**
 * The shape of a match's `vars`, as the projection reports it.
 *
 * - `absent` — no `vars` key: a new variable is written as one whole `vars`
 *   subtree (ruling 20);
 * - `empty` — `vars: []`, which is a flow list: Rust refuses an insertion into it
 *   (`VarsIsAFlowList`);
 * - `block` — a block list of variables, the one shape items are added to and
 *   taken from;
 * - `flow` — a flow list with items: same refusal as `empty`;
 * - `unsupported` — the key holds something that is not a list.
 */
export type VarsShape = 'absent' | 'empty' | 'block' | 'flow' | 'unsupported';

/** What the file held for `vars` when the session was seeded. Not drafted. */
export interface VariablesBaseline {
  /** The container's shape. */
  readonly shape: VarsShape;
  /**
   * The whole container's Rust-cut baseline — `MatchView.vars_container`, the
   * correspondence unit of ruling 22. Since the Phase 4-9 review it covers the
   * container's owned hull, so a changed comment that a drafted removal would
   * delete (the first variable's leading comment, the key's) changes it; that is
   * Rust's cut, and nothing in this module can widen or check it.
   */
  readonly container: ContainerBaseline;
  /** One row per projected variable, in source order. */
  readonly rows: readonly VariableRowBaseline[];
  /**
   * Whether the snippet holds a shorthand `form_fields` — read by recovery alone
   * (ruling 21), which must not recreate a snippet whose form lost its
   * definitions.
   */
  readonly formFieldsHeld: boolean;
  /**
   * Whether a committed save changed `vars` and no fresh projection has been
   * seeded since. While `true` nothing here derives an intent or accepts a change:
   * the rows no longer describe the file, and the session owes a re-projection
   * anyway (`MatchEditorSession.needsReprojection`).
   */
  readonly reprojectionOwed: boolean;
}

/**
 * The `vars` shape one presence reports.
 *
 * @param presence - `MatchView.vars_presence`.
 * @returns The shape.
 */
function varsShapeOf(presence: SequencePresence): VarsShape {
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
} // End of function varsShapeOf()

/**
 * Whether one scalar of an existing variable may be edited, from the projection.
 *
 * `./matchEditor.ts`'s `fieldEligibility` order for a one-line field — decoded
 * first, then a carriage return, a zero-width span, a line feed — with the key's
 * absence answered first: absent and held in an unmodelled shape is
 * `unmodelledShape`, absent otherwise is `notInVariable`.
 *
 * @param scalar - The projected scalar, or `null`.
 * @param unknownKeys - The keys the projection did not model.
 * @param field - Which scalar.
 * @returns The verdict.
 */
function variableFieldEligibility(
  scalar: ScalarView | null,
  unknownKeys: readonly (string | null)[],
  field: VariableField
): VariableFieldEligibility {
  if (scalar === null) {
    return {
      kind: 'readOnly',
      reason: unknownKeys.includes(field) ? 'unmodelledShape' : 'notInVariable'
    };
  }
  if (!scalar.decoded) {
    return { kind: 'readOnly', reason: 'notDecodable' };
  }
  if (scalar.text.includes('\r')) {
    return { kind: 'readOnly', reason: 'carriageReturn' };
  }
  if (scalar.span.start === scalar.span.end) {
    return { kind: 'readOnly', reason: 'ownsNoBytes' };
  }
  if (scalar.text.includes('\n')) {
    return { kind: 'readOnly', reason: 'lineBreak' };
  }
  return { kind: 'editable' };
} // End of function variableFieldEligibility()

/**
 * The projected scalar of one drafted field of a variable.
 *
 * @param view - The variable.
 * @param field - Which scalar.
 * @returns It, or `null`.
 */
function scalarOfVariable(view: VariableView, field: VariableField): ScalarView | null {
  switch (field) {
    case 'name':
      return view.name;
    case 'type':
      return view.declared_type;
    case 'inject_vars':
      return view.inject_vars;
  }
} // End of function scalarOfVariable()

/**
 * A plain, owned copy of projection data.
 *
 * **Not `structuredClone`**: a projection the window holds may be reached
 * through a Svelte `$state` proxy, which `structuredClone` refuses and which the
 * baseline's `deepFreeze` must never freeze (Svelte throws
 * `state_descriptors_fixed`). A JSON round trip reads every property through the
 * proxy and builds new objects; the wire data is JSON already, so nothing is lost.
 *
 * @typeParam T - The data's type.
 * @param value - Projection data.
 * @returns A copy this module owns.
 */
function ownedCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
} // End of function ownedCopy()

/**
 * One existing variable's baseline row, from an owned copy of the projection.
 *
 * @param projected - The projected variable.
 * @returns The row.
 */
function rowBaselineOf(projected: VariableView): VariableRowBaseline {
  const view = ownedCopy(projected);
  const unknownKeys = view.unknown_entries.map((entry) => entry.key);
  /**
   * One drafted scalar's baseline.
   *
   * @param field - Which scalar.
   * @returns Its presence, value and eligibility.
   */
  const scalarBaseline = (field: VariableField): VariableScalarBaseline => {
    const scalar = scalarOfVariable(view, field);
    return {
      present: scalar !== null,
      value: scalar === null ? '' : scalar.text,
      eligibility: variableFieldEligibility(scalar, unknownKeys, field)
    };
  }; // End of function scalarBaseline()
  return {
    kind: view.kind,
    name: scalarBaseline('name'),
    type: scalarBaseline('type'),
    inject_vars: scalarBaseline('inject_vars'),
    params: view.params,
    paramsPresent: !('Absent' in view.params_presence),
    dependsOn: view.depends_on,
    dependsOnPresent: !('Absent' in view.depends_on_presence),
    unknown: view.unknown_entries.map((entry) => `${entry.key ?? ''}=${entry.value_text}`),
    // The owned copy, so freezing the baseline never freezes the window's projection.
    view,
    boxes: paramsBaselineOf(view)
  };
} // End of function rowBaselineOf()

/**
 * What the file holds for `vars`, from one snippet's projection.
 *
 * @param match - The snippet's projection.
 * @returns The baseline. The caller freezes it with the rest of the baseline.
 */
export function variablesBaselineOf(match: MatchView): VariablesBaseline {
  return {
    shape: varsShapeOf(match.vars_presence),
    container: ownedCopy(match.vars_container),
    rows: match.vars.map(rowBaselineOf),
    formFieldsHeld: !('Absent' in match.form_fields_presence),
    reprojectionOwed: false
  };
} // End of function variablesBaselineOf()

// ---------------------------------------------------------------------------
// The draft side
// ---------------------------------------------------------------------------

/** What one scalar box of an existing variable holds. */
export interface VariableScalarBuffer {
  /** Whatever the box holds. Never a carriage return or a line feed. */
  readonly text: string;
}

/** What the controls hold for one existing variable. */
export interface VariableRowBuffer {
  /** `name`. */
  readonly name: VariableScalarBuffer;
  /** `type`. */
  readonly type: VariableScalarBuffer;
  /** `inject_vars`. */
  readonly inject_vars: VariableScalarBuffer;
  /**
   * Whether the variable is drafted for removal. The boxes keep their text, so a
   * restoration gives back what they held.
   */
  readonly removed: boolean;
  /**
   * Its `params` entries', list items' and `depends_on` items' boxes — Phase
   * 4-14-2, `./variableParams.ts`.
   */
  readonly boxes: ParamsBuffer;
}

/**
 * One new variable the draft adds — the closed description Rust writes, and the
 * content key whose reference was inserted with it, if any.
 */
export interface DraftedVariable {
  /** The closed description (`NewVariable`), written at the end of the list. */
  readonly variable: NewVariable;
  /**
   * The content key the compound *Insert* put `{{name}}` into, or `null` for an
   * addition made on its own. A reapply keeps the two together: the addition and
   * that key's edit are applied together or collide together (consult Q9).
   */
  readonly insertedInto: ContentForm | null;
}

/** What the controls hold for `vars`. **The draft side.** */
export interface VariablesBuffer {
  /** One row per baseline variable, by the same position. */
  readonly rows: readonly VariableRowBuffer[];
  /** New variables, in the order drafted. At most one reaches a save. */
  readonly added: readonly DraftedVariable[];
  /**
   * Whether the whole container is drafted for removal — the explicit intent of
   * ruling 8. While `true` the rows and additions are the baseline's own.
   */
  readonly removeAll: boolean;
}

/**
 * The buffer a session starts with: every box holding the file's value, nothing
 * removed and nothing added.
 *
 * @param baseline - What the file holds.
 * @returns The starting buffer.
 */
export function variablesBufferOf(baseline: VariablesBaseline): VariablesBuffer {
  return {
    rows: baseline.rows.map((row) => ({
      name: { text: row.name.value },
      type: { text: row.type.value },
      inject_vars: { text: row.inject_vars.value },
      removed: false,
      boxes: paramsBufferOf(row.boxes)
    })),
    added: [],
    removeAll: false
  };
} // End of function variablesBufferOf()

/**
 * The buffer copied into plain values, so it is read exactly once — the
 * check-and-spend rule of `CLAUDE.md` section 6: `MatchBuffers` carries no brand,
 * and a caller could hand in a getter.
 *
 * @param buffer - What the controls hold.
 * @returns A plain copy.
 */
export function capturedVariables(buffer: VariablesBuffer): VariablesBuffer {
  return {
    rows: buffer.rows.map((row) => ({
      name: { text: row.name.text },
      type: { text: row.type.text },
      inject_vars: { text: row.inject_vars.text },
      removed: row.removed,
      boxes: capturedParams(row.boxes)
    })),
    added: buffer.added.map((one) => ({
      variable: ownedCopy(one.variable),
      insertedInto: one.insertedInto
    })),
    removeAll: buffer.removeAll
  };
} // End of function capturedVariables()

/**
 * What one scalar of an existing variable's draft says should happen to it —
 * `./matchEditor.ts`'s `fieldIntent` rules for a scalar with no content switch:
 * an ineligible scalar is `'Unchanged'`, an absent key left blank is
 * `'Unchanged'`, a retyped projected value is `'Unchanged'`. There is no removal
 * of one scalar: `VariableDraft` has no spelling for it that Rust accepts on
 * `name` or `type`, and this editor offers none.
 *
 * @param baseline - What the file holds for it.
 * @param buffer - What its box holds.
 * @returns The tri-state intent.
 */
export function variableFieldIntent(
  baseline: VariableScalarBaseline,
  buffer: VariableScalarBuffer
): VariableDraft['name'] {
  if (baseline.eligibility.kind !== 'editable') {
    return 'Unchanged';
  }
  if (!baseline.present) {
    return buffer.text === '' ? 'Unchanged' : { Set: buffer.text };
  }
  return buffer.text === baseline.value ? 'Unchanged' : { Set: buffer.text };
} // End of function variableFieldIntent()

/**
 * Why a drafted `vars` cannot be sent as it stands — reported through
 * `./matchEditor.ts`'s `SaveWithheld`.
 *
 * - `varsWouldBeEmpty` — every existing variable is drafted for removal, which
 *   Rust refuses (`VarsWouldBeEmpty`) whether or not a new one is added; the
 *   explicit container removal is the route (ruling 8);
 * - `variableAdditionsCollide` — more than one new variable, which would be two
 *   insertions at one landing; only a hand-built buffer reaches it.
 */
export type VariablesProblem = 'varsWouldBeEmpty' | 'variableAdditionsCollide';

/** What the drafted `vars` asks of a save. */
export interface VariablesDerivation {
  /** Drafted scalars of existing variables — `MatchDraft.vars`. */
  readonly vars: readonly VariableDraft[];
  /** Insertions and removals — `MatchDraft.var_intents`. */
  readonly intents: readonly VarsIntent[];
  /** Why this cannot be sent, or `null`. */
  readonly problem: VariablesProblem | null;
  /** Whether it asks for anything at all. */
  readonly changed: boolean;
}

/** A derivation that asks for nothing. */
const NOTHING_TO_VARS: VariablesDerivation = Object.freeze({
  vars: [],
  intents: [],
  problem: null,
  changed: false
});

/**
 * The one producer of the wire's `vars` and `var_intents` for the match editor.
 *
 * **Read once**: the caller hands a {@link capturedVariables} copy, and every
 * part below is derived from it. A `VariableDraft` is sent only for a variable
 * that is kept and has a drafted scalar, parameter, list item or `depends_on`
 * item (Phase 4-14-2, `paramsDerivationOf` in `./variableParams.ts`); whatever
 * it does not draft is left alone (`[]`), which is what keeps those bytes.
 * Records, new parameters and form definitions are never sent from here — a
 * verbose form's are merged in by `withVerboseForms`. Removals come before the one
 * insertion, which lands at the end of the list (`End`), and a removal of the
 * whole container is sent alone.
 *
 * @param baseline - What the file holds.
 * @param buffer - What the controls hold, captured once by the caller.
 * @returns The derivation.
 */
export function variablesDerivationOf(
  baseline: VariablesBaseline,
  buffer: VariablesBuffer
): VariablesDerivation {
  if (baseline.reprojectionOwed) {
    return NOTHING_TO_VARS;
  }
  if (buffer.removeAll) {
    return baseline.shape === 'absent'
      ? NOTHING_TO_VARS
      : { vars: [], intents: [{ RemoveVars: {} }], problem: null, changed: true };
  }
  const vars: VariableDraft[] = [];
  const intents: VarsIntent[] = [];
  baseline.rows.forEach((row, index) => {
    const drafted = buffer.rows[index];
    if (drafted === undefined) {
      return;
    }
    if (drafted.removed) {
      intents.push({ RemoveVariable: { index } });
      return;
    }
    const name = variableFieldIntent(row.name, drafted.name);
    const type = variableFieldIntent(row.type, drafted.type);
    const inject = variableFieldIntent(row.inject_vars, drafted.inject_vars);
    const open = paramsDerivationOf(row.boxes, drafted.boxes);
    if (name === 'Unchanged' && type === 'Unchanged' && inject === 'Unchanged' && !open.changed) {
      return;
    }
    vars.push({
      index,
      name,
      type,
      inject_vars: inject,
      params: open.params,
      insert_params: [],
      depends_on: open.dependsOn,
      records: [],
      lists: open.lists,
      fields: [],
      field_intents: []
    });
  }); // End of the walk over the baseline's variables
  for (const one of buffer.added) {
    intents.push({ InsertVariable: { at: { End: {} }, variable: one.variable } });
  } // End of the loop over the new variables
  const removedEvery =
    baseline.rows.length > 0 &&
    baseline.rows.every((_, index) => buffer.rows[index]?.removed === true);
  const problem: VariablesProblem | null = removedEvery
    ? 'varsWouldBeEmpty'
    : buffer.added.length > 1
      ? 'variableAdditionsCollide'
      : null;
  return { vars, intents, problem, changed: vars.length > 0 || intents.length > 0 };
} // End of function variablesDerivationOf()

/**
 * Every text a wire draft's `vars` and `var_intents` would write, split by the
 * control that drafts it — for the carriage-return gate at `beginSave`.
 *
 * `oneLine` texts come from one-line controls (a name, a `type`, the plain-source
 * settings, a `depends_on` item, a parameter key, a time zone, a locale, and —
 * Phase 4-14-2 — every item box of an existing variable's lists) and may hold
 * neither a carriage return nor a line feed; `multiLine` texts (an `echo`, a
 * command, a layout, a new variable's list items, an existing variable's
 * parameter values) may hold a line feed and never a carriage return. Conservative on purpose: a text this cannot classify is
 * `oneLine`'s stricter rule only where the control is certainly one line.
 *
 * @param vars - `MatchDraft.vars`.
 * @param intents - `MatchDraft.var_intents`.
 * @returns The texts, in no particular order.
 */
export function variableTextsOf(
  vars: readonly VariableDraft[],
  intents: readonly VarsIntent[]
): { readonly oneLine: readonly string[]; readonly multiLine: readonly string[] } {
  const oneLine: string[] = [];
  const multiLine: string[] = [];
  for (const draft of vars) {
    for (const intent of [draft.name, draft.type, draft.inject_vars]) {
      if (typeof intent === 'object') {
        oneLine.push(intent.Set);
      }
    } // End of the loop over the three drafted scalars
    // Phase 4-14-2: a parameter's value may hold a line feed (a typed setting
    // cannot, which Rust refuses by name); every item box and every
    // `depends_on` item is one line. A verbose form's layout rides `params` too.
    for (const entry of draft.params) {
      if (typeof entry.value === 'object' && 'Set' in entry.value) {
        multiLine.push(entry.value.Set);
      }
      for (const item of entry.items) {
        if (typeof item.value === 'object') {
          oneLine.push(item.value.Set);
        }
      } // End of the loop over the entry's drafted items
    } // End of the loop over the drafted params
    for (const item of draft.depends_on) {
      if (typeof item.value === 'object') {
        oneLine.push(item.value.Set);
      }
    } // End of the loop over the drafted depends_on items
    for (const list of draft.lists) {
      if ('InsertItems' in list) {
        const items = list.InsertItems.items;
        oneLine.push(...('Strings' in items ? items.Strings : items.Records.flatMap((one) => [one.label, one.id])));
      }
    } // End of the loop over the list intents
  } // End of the loop over the drafted variables
  for (const intent of intents) {
    if (!('InsertVariable' in intent)) {
      continue;
    }
    const variable = intent.InsertVariable.variable;
    oneLine.push(variable.name, ...(variable.depends_on ?? []));
    if (variable.inject_vars !== null) {
      oneLine.push(variable.inject_vars);
    }
    for (const param of variable.extra_params) {
      oneLine.push(param.key);
      multiLine.push(...newParamTexts(param));
    } // End of the loop over the extra parameters
    const texts = kindTexts(variable.params);
    oneLine.push(...texts.oneLine);
    multiLine.push(...texts.multiLine);
  } // End of the loop over the variable intents
  return { oneLine, multiLine };
} // End of function variableTextsOf()

/**
 * The texts of one new author-named parameter's value.
 *
 * @param param - The parameter.
 * @returns Its scalar or its list items.
 */
function newParamTexts(param: NewParam): readonly string[] {
  return 'Scalar' in param.value ? [param.value.Scalar] : param.value.List;
} // End of function newParamTexts()

/**
 * The texts one kind's own parameters would write, split by control.
 *
 * @param params - The kind and its parameters.
 * @returns The two lists.
 */
function kindTexts(params: NewVariableParams): {
  readonly oneLine: readonly string[];
  readonly multiLine: readonly string[];
} {
  /**
   * The texts of the parameters a kind is born holding.
   *
   * @param values - Optional texts.
   * @returns The ones that are set.
   */
  const present = (values: readonly (string | null)[]): string[] =>
    values.filter((value): value is string => value !== null);
  if ('Date' in params) {
    const date = params.Date;
    return { oneLine: present([date.offset, date.tz, date.locale]), multiLine: present([date.format]) };
  }
  if ('Choice' in params) {
    return { oneLine: [], multiLine: [...params.Choice.values] };
  }
  if ('Random' in params) {
    return { oneLine: [], multiLine: [...params.Random.choices] };
  }
  if ('Echo' in params) {
    return { oneLine: [], multiLine: [params.Echo.echo] };
  }
  if ('Shell' in params) {
    const shell = params.Shell;
    return { oneLine: present([shell.trim, shell.debug]), multiLine: present([shell.cmd, shell.shell]) };
  }
  if ('Script' in params) {
    return { oneLine: present([params.Script.trim]), multiLine: [...params.Script.args] };
  }
  if ('Form' in params) {
    const fields = params.Form.fields.map(formFieldTexts);
    return {
      oneLine: fields.flatMap((one) => one.oneLine),
      multiLine: [params.Form.layout, ...fields.flatMap((one) => one.multiLine)]
    };
  }
  if ('Match' in params) {
    return { oneLine: [], multiLine: [params.Match.trigger] };
  }
  return { oneLine: [], multiLine: [] };
} // End of function kindTexts()

/**
 * One new form field's texts, split by control: its name and its extra option
 * keys are one line; every option value may hold a line feed.
 *
 * @param field - The definition.
 * @returns The two lists.
 */
function formFieldTexts(field: NewFormField): {
  readonly oneLine: readonly string[];
  readonly multiLine: readonly string[];
} {
  const oneLine: string[] = [field.name];
  const multiLine: string[] = [];
  const options = field.options;
  for (const value of [options.type, options.default, options.multiline, options.trim_string_values]) {
    if (value !== null) {
      multiLine.push(value);
    }
  } // End of the loop over the scalar options
  if (options.values !== null) {
    multiLine.push(...('List' in options.values ? options.values.List : [options.values.Text]));
  }
  for (const extra of options.extra) {
    oneLine.push(extra.key);
    multiLine.push(...newParamTexts(extra));
  } // End of the loop over the extra options
  return { oneLine, multiLine };
} // End of function formFieldTexts()

// ---------------------------------------------------------------------------
// Pure buffer transitions
// ---------------------------------------------------------------------------

/**
 * Whether the draft is allowed to touch `vars` at all.
 *
 * @param baseline - What the file holds.
 * @returns `false` while a commit is waiting for a re-projection.
 */
function draftable(baseline: VariablesBaseline): boolean {
  return !baseline.reprojectionOwed;
} // End of function draftable()

/**
 * The buffer with one existing variable's scalar box replaced, or `null` when
 * that is refused: an unknown position, an ineligible scalar, a variable drafted
 * for removal, the whole container drafted for removal, a carriage return or a
 * line feed (every box here is one line), or no change.
 *
 * @param baseline - What the file holds.
 * @param buffer - What the controls hold.
 * @param index - The variable's position in the file's list.
 * @param field - Which scalar.
 * @param text - The box's whole value.
 * @returns The new buffer, or `null`.
 */
export function withVariableText(
  baseline: VariablesBaseline,
  buffer: VariablesBuffer,
  index: number,
  field: VariableField,
  text: string
): VariablesBuffer | null {
  const row = baseline.rows[index];
  const drafted = buffer.rows[index];
  if (!draftable(baseline) || row === undefined || drafted === undefined || buffer.removeAll) {
    return null;
  }
  if (drafted.removed || row[field].eligibility.kind !== 'editable') {
    return null;
  }
  if (text.includes('\r') || text.includes('\n') || drafted[field].text === text) {
    return null;
  }
  const rows = buffer.rows.map((one, at) =>
    at === index ? { ...one, [field]: { text } } : one
  );
  return { ...buffer, rows };
} // End of function withVariableText()

/**
 * The buffer with one existing variable's parameter, list item or `depends_on`
 * boxes changed by one `./variableParams.ts` transition — Phase 4-14-2 — or
 * `null` when that is refused: an unknown position, a variable or a container
 * drafted for removal, a commit awaiting a re-projection, or the transition's
 * own refusal.
 *
 * @param baseline - What the file holds.
 * @param buffer - What the controls hold.
 * @param index - The variable's position in the file's list.
 * @param change - The transition, over the variable's baseline and boxes.
 * @returns The new buffer, or `null`.
 */
export function withVariableBoxes(
  baseline: VariablesBaseline,
  buffer: VariablesBuffer,
  index: number,
  change: (row: ParamsBaseline, boxes: ParamsBuffer) => ParamsBuffer | null
): VariablesBuffer | null {
  const row = baseline.rows[index];
  const drafted = buffer.rows[index];
  if (!draftable(baseline) || row === undefined || drafted === undefined || buffer.removeAll || drafted.removed) {
    return null;
  }
  const boxes = change(row.boxes, drafted.boxes);
  if (boxes === null) {
    return null;
  }
  return { ...buffer, rows: buffer.rows.map((one, at) => (at === index ? { ...one, boxes } : one)) };
} // End of function withVariableBoxes()

/**
 * Whether the draft changes anything of one kept existing variable: a scalar, a
 * parameter, a list item or a `depends_on` item. The one answer the group's
 * `edited` status and the derivation share.
 *
 * @param row - What the file holds for it.
 * @param drafted - Its boxes, captured once.
 * @returns `true` when it is edited.
 */
export function variableRowEdited(row: VariableRowBaseline, drafted: VariableRowBuffer): boolean {
  return (
    variableFieldIntent(row.name, drafted.name) !== 'Unchanged' ||
    variableFieldIntent(row.type, drafted.type) !== 'Unchanged' ||
    variableFieldIntent(row.inject_vars, drafted.inject_vars) !== 'Unchanged' ||
    paramsDerivationOf(row.boxes, drafted.boxes).changed
  );
} // End of function variableRowEdited()

/**
 * The buffer with one existing variable drafted for removal, or `null`: only an
 * item of a block list is removed (Rust refuses a flow list and a non-list), and
 * a variable already drafted for removal is refused.
 *
 * @param baseline - What the file holds.
 * @param buffer - What the controls hold.
 * @param index - The variable's position.
 * @returns The new buffer, or `null`.
 */
export function withVariableRemoved(
  baseline: VariablesBaseline,
  buffer: VariablesBuffer,
  index: number
): VariablesBuffer | null {
  const drafted = buffer.rows[index];
  if (!draftable(baseline) || baseline.shape !== 'block' || buffer.removeAll) {
    return null;
  }
  if (drafted === undefined || drafted.removed) {
    return null;
  }
  return {
    ...buffer,
    rows: buffer.rows.map((one, at) => (at === index ? { ...one, removed: true } : one))
  };
} // End of function withVariableRemoved()

/**
 * The buffer with one drafted removal taken back, or `null` when there is none.
 *
 * @param baseline - What the file holds.
 * @param buffer - What the controls hold.
 * @param index - The variable's position.
 * @returns The new buffer, or `null`.
 */
export function withVariableRestored(
  baseline: VariablesBaseline,
  buffer: VariablesBuffer,
  index: number
): VariablesBuffer | null {
  const drafted = buffer.rows[index];
  if (!draftable(baseline) || drafted === undefined || !drafted.removed) {
    return null;
  }
  return {
    ...buffer,
    rows: buffer.rows.map((one, at) => (at === index ? { ...one, removed: false } : one))
  };
} // End of function withVariableRestored()

/**
 * The buffer with the whole `vars` container drafted for removal — ruling 8's
 * explicit container-removal intent — or `null` when the snippet holds no `vars`
 * or it is already drafted. Every other variable edit is dropped from the draft,
 * because a removed container has nothing left to edit; undo gives them back.
 *
 * @param baseline - What the file holds.
 * @param buffer - What the controls hold.
 * @returns The new buffer, or `null`.
 */
export function withVariablesRemoved(
  baseline: VariablesBaseline,
  buffer: VariablesBuffer
): VariablesBuffer | null {
  if (!draftable(baseline) || baseline.shape === 'absent' || buffer.removeAll) {
    return null;
  }
  return { ...variablesBufferOf(baseline), removeAll: true };
} // End of function withVariablesRemoved()

/**
 * The buffer with the container's drafted removal taken back, or `null`.
 *
 * @param baseline - What the file holds.
 * @param buffer - What the controls hold.
 * @returns The new buffer, or `null`.
 */
export function withVariablesRestored(
  baseline: VariablesBaseline,
  buffer: VariablesBuffer
): VariablesBuffer | null {
  if (!draftable(baseline) || !buffer.removeAll) {
    return null;
  }
  return { ...buffer, removeAll: false };
} // End of function withVariablesRestored()

/**
 * Why a new variable cannot be added to this draft — a code, never a sentence.
 *
 * - `varsNotABlockList` — `vars` is a flow list (`[]` included) or not a list,
 *   which Rust refuses an insertion into;
 * - `additionPending` — the draft already adds one; a second would land at the
 *   same place, which Rust refuses (save the first);
 * - `containerRemoved` — the whole container is drafted for removal;
 * - `notDraftable` — a committed save is waiting for a re-projection.
 */
export type VariableAdditionRefusal =
  | 'varsNotABlockList'
  | 'additionPending'
  | 'containerRemoved'
  | 'notDraftable';

/**
 * Why a new variable cannot be added, or `null` when it can.
 *
 * @param baseline - What the file holds.
 * @param buffer - What the controls hold.
 * @returns The refusal, or `null`.
 */
export function variableAdditionRefusal(
  baseline: VariablesBaseline,
  buffer: VariablesBuffer
): VariableAdditionRefusal | null {
  if (!draftable(baseline)) {
    return 'notDraftable';
  }
  if (baseline.shape !== 'absent' && baseline.shape !== 'block') {
    return 'varsNotABlockList';
  }
  if (buffer.removeAll) {
    return 'containerRemoved';
  }
  return buffer.added.length > 0 ? 'additionPending' : null;
} // End of function variableAdditionRefusal()

/**
 * The buffer with one new variable added at the end of the list, or `null` when
 * {@link variableAdditionRefusal} refuses.
 *
 * @param baseline - What the file holds.
 * @param buffer - What the controls hold.
 * @param variable - The closed description.
 * @param insertedInto - The content key a compound *Insert* wrote its reference
 *   into, or `null`.
 * @returns The new buffer, or `null`.
 */
export function withVariableAdded(
  baseline: VariablesBaseline,
  buffer: VariablesBuffer,
  variable: NewVariable,
  insertedInto: ContentForm | null
): VariablesBuffer | null {
  if (variableAdditionRefusal(baseline, buffer) !== null) {
    return null;
  }
  return { ...buffer, added: [...buffer.added, { variable: ownedCopy(variable), insertedInto }] };
} // End of function withVariableAdded()

/**
 * The buffer with one drafted addition dropped, or `null` when there is none at
 * that position.
 *
 * @param buffer - What the controls hold.
 * @param position - The addition's position in {@link VariablesBuffer.added}.
 * @returns The new buffer, or `null`.
 */
export function withAdditionDiscarded(
  buffer: VariablesBuffer,
  position: number
): VariablesBuffer | null {
  if (position < 0 || position >= buffer.added.length) {
    return null;
  }
  return { ...buffer, added: buffer.added.filter((_, at) => at !== position) };
} // End of function withAdditionDiscarded()

/**
 * The buffer with every compound insertion owned by content key `from` handed
 * to `to` — the Phase 4-9 review's third finding.
 *
 * A content switch moves a box's text from one key to another: choosing a target
 * carries the source's (or the previous target's) text to it, and cancelling
 * gives the target's text back to the source. A reference an *Insert* wrote
 * travels with that text, so the key {@link DraftedVariable.insertedInto} names
 * must travel with it, or a reapply would keep the addition together with a key
 * that no longer holds the reference. Every caller that moves content text
 * between keys calls this in the same transition; nothing in TypeScript forces
 * a new such caller to.
 *
 * @param buffer - What the controls hold.
 * @param from - The key whose text moved away.
 * @param to - The key it moved to.
 * @returns The buffer, the same object when no addition named `from`.
 */
export function withInsertionsMoved(
  buffer: VariablesBuffer,
  from: ContentForm,
  to: ContentForm
): VariablesBuffer {
  if (from === to || !buffer.added.some((one) => one.insertedInto === from)) {
    return buffer;
  }
  return {
    ...buffer,
    added: buffer.added.map((one) => (one.insertedInto === from ? { ...one, insertedInto: to } : one))
  };
} // End of function withInsertionsMoved()

// ---------------------------------------------------------------------------
// Whole-container reapply (ruling 22)
// ---------------------------------------------------------------------------

/**
 * What a reapply does with the drafted `vars` — ruling 22 of
 * `docs/decisions/4-split-notes.md`:
 *
 * - `unchanged` — the draft says nothing about `vars`;
 * - `applicable` — the new projection's container is the one the draft was built
 *   against: the same shape and the same Rust fingerprint (a shifted offset alone
 *   is no change), so every positional intent still names what it named;
 * - `satisfied` — the container moved, and the whole intended list is already
 *   there, variable by variable (see {@link variablesReapply} for what "already
 *   there" compares, and where it answers "cannot tell" by colliding);
 * - `collision` — anything else. The whole container collides; nothing is
 *   followed by index or by name.
 */
export type VariablesReapplyVerdict = 'unchanged' | 'applicable' | 'satisfied' | 'collision';

/**
 * Whether two container baselines are the same bytes.
 *
 * `Uncut` corresponds to nothing, itself included (4-8's rule).
 *
 * @param was - The draft's container.
 * @param now - The new projection's.
 * @returns `true` for two absent containers or two equal fingerprints.
 */
function sameContainer(was: ContainerBaseline, now: ContainerBaseline): boolean {
  if ('Absent' in was && 'Absent' in now) {
    return true;
  }
  if ('Present' in was && 'Present' in now) {
    return was.Present.fingerprint === now.Present.fingerprint;
  }
  return false;
} // End of function sameContainer()

/**
 * Whether a plain scalar's text can only be a string in YAML, so a disk scalar
 * written plain may stand for a logical string Rust's codec would have written.
 *
 * **Conservative, and the cost of that is a collision, never a false
 * `satisfied`**: an identifier-shaped word that is not one of YAML's boolean or
 * null spellings. Anything else written plain — a number, `true`, `~`, text with
 * punctuation — is not taken as the logical string it looks like.
 *
 * @param text - The scalar's text.
 * @returns `true` when a plain spelling is certainly a string.
 */
function plainIsCertainlyAString(text: string): boolean {
  if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(text)) {
    return false;
  }
  return !['true', 'false', 'yes', 'no', 'on', 'off', 'null', 'y', 'n'].includes(text.toLowerCase());
} // End of function plainIsCertainlyAString()

/**
 * Whether a disk scalar holds a logical string, as Rust's codec would write it.
 *
 * @param scalar - The disk scalar.
 * @param text - The intended logical string.
 * @returns `true` when the scalar is certainly that string.
 */
function holdsLogical(scalar: ScalarView, text: string): boolean {
  return (
    scalar.decoded &&
    scalar.text === text &&
    (scalar.style !== 'Plain' || plainIsCertainlyAString(text))
  );
} // End of function holdsLogical()

/**
 * Whether a disk scalar holds a plain-source text, as Rust writes a typed
 * setting (ruling 4): plain, and exactly that text.
 *
 * @param scalar - The disk scalar.
 * @param text - The intended source text.
 * @returns `true` when it is.
 */
function holdsPlain(scalar: ScalarView, text: string): boolean {
  return scalar.decoded && scalar.style === 'Plain' && scalar.text === text;
} // End of function holdsPlain()

/**
 * Whether two projected values are the same, spans and node numbers aside:
 * scalars by text, style and decoding, collections element by element, and an
 * alias or an elided node never (it cannot be compared, so it is not called the
 * same).
 *
 * @param one - A value.
 * @param other - Another.
 * @returns `true` when they are the same.
 */
function sameValue(one: ValueView, other: ValueView): boolean {
  if ('Scalar' in one && 'Scalar' in other) {
    return (
      one.Scalar.text === other.Scalar.text &&
      one.Scalar.style === other.Scalar.style &&
      one.Scalar.decoded === other.Scalar.decoded
    );
  }
  if ('Sequence' in one && 'Sequence' in other) {
    return (
      one.Sequence.length === other.Sequence.length &&
      one.Sequence.every((item, index) => sameValue(item, other.Sequence[index] as ValueView))
    );
  }
  if ('Mapping' in one && 'Mapping' in other) {
    return sameFields(one.Mapping, other.Mapping);
  }
  return false;
} // End of function sameValue()

/**
 * Whether two projected mappings are the same, entry by entry in order.
 *
 * @param one - Entries.
 * @param other - Other entries.
 * @returns `true` when they are the same.
 */
function sameFields(one: readonly FieldView[], other: readonly FieldView[]): boolean {
  return (
    one.length === other.length &&
    one.every((entry, index) => {
      const twin = other[index] as FieldView;
      if (entry.key === null || twin.key === null) {
        return false;
      }
      return (
        entry.key.text === twin.key.text &&
        entry.key.style === twin.key.style &&
        sameValue(entry.value, twin.value)
      );
    })
  );
} // End of function sameFields()

/**
 * Whether one intended scalar of a kept variable is what the disk holds.
 *
 * @param was - The baseline scalar.
 * @param buffer - The drafted box.
 * @param now - The disk's scalar baseline.
 * @param plain - Whether the key is a plain-source setting.
 * @param nowScalar - The disk's scalar itself, or `null`.
 * @returns `true` when the disk holds what the draft intends.
 */
function scalarIntended(
  was: VariableScalarBaseline,
  buffer: VariableScalarBuffer,
  now: VariableScalarBaseline,
  plain: boolean,
  nowScalar: ScalarView | null
): boolean {
  const intent = variableFieldIntent(was, buffer);
  if (intent === 'Unchanged') {
    return now.present === was.present && now.value === was.value;
  }
  if (intent === 'Remove' || nowScalar === null) {
    return false;
  }
  return plain ? holdsPlain(nowScalar, intent.Set) : holdsLogical(nowScalar, intent.Set);
} // End of function scalarIntended()

/**
 * Whether a disk variable is the kept baseline variable with its drafted scalars
 * applied: everything the draft did not touch is the same projected value, and
 * each drafted scalar is what the draft intends.
 *
 * @param was - The baseline row.
 * @param buffer - Its drafted boxes.
 * @param now - The disk's row.
 * @returns `true` when it is.
 */
function keptRowIntended(
  was: VariableRowBaseline,
  buffer: VariableRowBuffer,
  now: VariableRowBaseline
): boolean {
  const nowView = now.view;
  return (
    scalarIntended(was.name, buffer.name, now.name, false, nowView.name) &&
    scalarIntended(was.type, buffer.type, now.type, false, nowView.declared_type) &&
    scalarIntended(was.inject_vars, buffer.inject_vars, now.inject_vars, true, nowView.inject_vars) &&
    was.paramsPresent === now.paramsPresent &&
    paramsIntended(was, buffer, now) &&
    was.dependsOnPresent === now.dependsOnPresent &&
    dependsOnIntended(was, buffer, now) &&
    was.unknown.length === now.unknown.length &&
    was.unknown.every((entry, index) => entry === now.unknown[index])
  );
} // End of function keptRowIntended()

/**
 * Whether a disk list holds exactly the intended items — Phase 4-14-2: a kept
 * item is the same projected value, a drafted text is that logical string.
 *
 * @param was - The baseline's items.
 * @param intended - The intended items.
 * @param now - The disk's items.
 * @returns `true` when they are.
 */
function itemsIntended(
  was: readonly ValueView[],
  intended: readonly IntendedItem[],
  now: readonly ValueView[]
): boolean {
  return (
    now.length === intended.length &&
    intended.every((one, index) => {
      const disk = now[index] as ValueView;
      if (one.kind === 'kept') {
        const held = was[one.index];
        return held !== undefined && sameValue(held, disk);
      }
      return 'Scalar' in disk && holdsLogical(disk.Scalar, one.text);
    })
  );
} // End of function itemsIntended()

/**
 * Whether the disk's `params` are the baseline's with the drafted parameters and
 * list items applied (Phase 4-14-2), entry by entry and in order: every key the
 * same spelling, an undrafted value the same projected value, a drafted typed
 * setting written plain, any other drafted text as its logical string.
 *
 * @param was - The baseline row.
 * @param buffer - Its drafted boxes.
 * @param now - The disk's row.
 * @returns `true` when they are.
 */
function paramsIntended(was: VariableRowBaseline, buffer: VariableRowBuffer, now: VariableRowBaseline): boolean {
  return (
    was.params.length === now.params.length &&
    was.params.every((entry, index) => {
      const twin = now.params[index] as FieldView;
      if (entry.key === null || twin.key === null) {
        return false;
      }
      if (entry.key.text !== twin.key.text || entry.key.style !== twin.key.style) {
        return false;
      }
      const intended = intendedParamOf(was.boxes, buffer.boxes, index);
      if (intended.kind === 'unchanged') {
        return sameValue(entry.value, twin.value);
      }
      if (intended.kind === 'text') {
        if (!('Scalar' in twin.value)) {
          return false;
        }
        return intended.plain
          ? holdsPlain(twin.value.Scalar, intended.text)
          : holdsLogical(twin.value.Scalar, intended.text);
      }
      return (
        'Sequence' in entry.value &&
        'Sequence' in twin.value &&
        itemsIntended(entry.value.Sequence, intended.items, twin.value.Sequence)
      );
    })
  );
} // End of function paramsIntended()

/**
 * Whether the disk's `depends_on` is the baseline's with the drafted items
 * applied (Phase 4-14-2).
 *
 * @param was - The baseline row.
 * @param buffer - Its drafted boxes.
 * @param now - The disk's row.
 * @returns `true` when it is.
 */
function dependsOnIntended(was: VariableRowBaseline, buffer: VariableRowBuffer, now: VariableRowBaseline): boolean {
  const list: ListBaseline | null = was.boxes.dependsOn;
  const intended = list === null ? null : intendedItemsOf(list, buffer.boxes.dependsOn);
  if (intended === null) {
    return (
      was.dependsOn.length === now.dependsOn.length &&
      was.dependsOn.every((item, index) => sameValue(item, now.dependsOn[index] as ValueView))
    );
  }
  return itemsIntended(was.dependsOn, intended, now.dependsOn);
} // End of function dependsOnIntended()

/** One parameter a new variable is written with, as a reapply compares it. */
type IntendedParam =
  | { readonly key: string; readonly kind: 'logical'; readonly text: string }
  | { readonly key: string; readonly kind: 'plain'; readonly text: string }
  | { readonly key: string; readonly kind: 'list'; readonly items: readonly string[] };

/**
 * The parameters Rust writes for a new variable, in the order it writes them
 * (`NewVariableParams::entries` then the extras), or `null` when this module
 * cannot say — a form with field definitions, whose nested mapping it does not
 * compare. `null` makes a reapply collide rather than guess.
 *
 * @param variable - The closed description.
 * @returns The parameters, or `null`.
 */
function intendedParams(variable: NewVariable): readonly IntendedParam[] | null {
  const params = variable.params;
  const out: IntendedParam[] = [];
  /**
   * Records a logical-string parameter, when it is set.
   *
   * @param key - The parameter's key.
   * @param text - Its text, or `null`.
   */
  const logical = (key: string, text: string | null): void => {
    if (text !== null) {
      out.push({ key, kind: 'logical', text });
    }
  }; // End of function logical()
  /**
   * Records a plain-source parameter, when it is set.
   *
   * @param key - The parameter's key.
   * @param text - Its source text, or `null`.
   */
  const plain = (key: string, text: string | null): void => {
    if (text !== null) {
      out.push({ key, kind: 'plain', text });
    }
  }; // End of function plain()
  if ('Date' in params) {
    logical('format', params.Date.format);
    plain('offset', params.Date.offset);
    logical('tz', params.Date.tz);
    logical('locale', params.Date.locale);
  } else if ('Choice' in params) {
    out.push({ key: 'values', kind: 'list', items: params.Choice.values });
  } else if ('Random' in params) {
    out.push({ key: 'choices', kind: 'list', items: params.Random.choices });
  } else if ('Echo' in params) {
    logical('echo', params.Echo.echo);
  } else if ('Shell' in params) {
    logical('cmd', params.Shell.cmd);
    logical('shell', params.Shell.shell);
    plain('trim', params.Shell.trim);
    plain('debug', params.Shell.debug);
  } else if ('Script' in params) {
    out.push({ key: 'args', kind: 'list', items: params.Script.args });
    plain('trim', params.Script.trim);
  } else if ('Form' in params) {
    if (params.Form.fields.length > 0) {
      return null;
    }
    logical('layout', params.Form.layout);
  } else if ('Match' in params) {
    logical('trigger', params.Match.trigger);
  }
  for (const extra of variable.extra_params) {
    if ('Scalar' in extra.value) {
      out.push({ key: extra.key, kind: 'logical', text: extra.value.Scalar });
    } else {
      out.push({ key: extra.key, kind: 'list', items: extra.value.List });
    }
  } // End of the loop over the extra parameters
  return out;
} // End of function intendedParams()

/**
 * Whether one disk parameter is the intended one.
 *
 * @param entry - The disk entry.
 * @param intended - What Rust would write.
 * @returns `true` when it is.
 */
function paramIntended(entry: FieldView, intended: IntendedParam): boolean {
  if (entry.key === null || !holdsLogical(entry.key, intended.key)) {
    return false;
  }
  const value = entry.value;
  if (intended.kind === 'list') {
    return (
      'Sequence' in value &&
      value.Sequence.length === intended.items.length &&
      value.Sequence.every(
        (item, index) => 'Scalar' in item && holdsLogical(item.Scalar, intended.items[index] as string)
      )
    );
  }
  if (!('Scalar' in value)) {
    return false;
  }
  return intended.kind === 'plain'
    ? holdsPlain(value.Scalar, intended.text)
    : holdsLogical(value.Scalar, intended.text);
} // End of function paramIntended()

/**
 * The `type` text Rust writes for a new variable's kind —
 * `NewVariableParams::type_text`, transcribed. `''` only for a value no variant
 * describes, which a hand-built description alone can be.
 *
 * @param params - The kind and its parameters.
 * @returns The `type` text.
 */
export function typeTextOf(params: NewVariableParams): string {
  const kinds: readonly (readonly [string, string])[] = [
    ['Date', 'date'],
    ['Choice', 'choice'],
    ['Random', 'random'],
    ['Clipboard', 'clipboard'],
    ['Echo', 'echo'],
    ['Shell', 'shell'],
    ['Script', 'script'],
    ['Form', 'form'],
    ['Match', 'match']
  ];
  const found = kinds.find(([tag]) => tag in params);
  return found === undefined ? '' : found[1];
} // End of function typeTextOf()

/**
 * Whether a disk variable is exactly what a drafted addition would write.
 *
 * @param added - The drafted variable.
 * @param now - The disk's variable.
 * @returns `true` when every key the addition writes is there as written and
 *   nothing else is.
 */
function additionIntended(added: NewVariable, now: VariableView): boolean {
  const params = intendedParams(added);
  if (params === null || now.name === null || now.declared_type === null) {
    return false;
  }
  if (!holdsLogical(now.name, added.name) || !holdsLogical(now.declared_type, typeTextOf(added.params))) {
    return false;
  }
  const inject =
    added.inject_vars === null
      ? now.inject_vars === null
      : now.inject_vars !== null && holdsPlain(now.inject_vars, added.inject_vars);
  const dependsOn =
    added.depends_on === null
      ? 'Absent' in now.depends_on_presence
      : now.depends_on.length === added.depends_on.length &&
        now.depends_on.every(
          (item, index) => 'Scalar' in item && holdsLogical(item.Scalar, added.depends_on?.[index] as string)
        );
  return (
    inject &&
    dependsOn &&
    now.unknown_entries.length === 0 &&
    now.params.length === params.length &&
    now.params.every((entry, index) => paramIntended(entry, params[index] as IntendedParam))
  );
} // End of function additionIntended()

/**
 * Whether the new projection already holds the whole intended `vars`.
 *
 * @param was - What the draft was built against.
 * @param buffer - The retained draft, captured once.
 * @param now - The new projection's baseline.
 * @returns `true` when every intended variable is there, in order, and nothing else.
 */
function intendedResultPresent(
  was: VariablesBaseline,
  buffer: VariablesBuffer,
  now: VariablesBaseline
): boolean {
  if (buffer.removeAll) {
    return now.shape === 'absent';
  }
  if (now.shape !== 'block') {
    return false;
  }
  const kept = was.rows
    .map((row, index) => ({ row, drafted: buffer.rows[index] }))
    .filter((one) => one.drafted !== undefined && !one.drafted.removed);
  if (now.rows.length !== kept.length + buffer.added.length) {
    return false;
  }
  const keptThere = kept.every((one, index) =>
    keptRowIntended(one.row, one.drafted as VariableRowBuffer, now.rows[index] as VariableRowBaseline)
  );
  const addedThere = buffer.added.every((one, position) =>
    additionIntended(one.variable, (now.rows[kept.length + position] as VariableRowBaseline).view)
  );
  return keptThere && addedThere;
} // End of function intendedResultPresent()

/**
 * The reapply verdict of the drafted `vars`, and the buffer to hold over the new
 * baseline.
 *
 * **What "already there" compares**, since a false `satisfied` would drop a
 * drafted change silently: every kept variable must be, in order, the baseline
 * variable with its drafted scalars applied — every other projected value the
 * same text, style and shape — and every added variable must be exactly what
 * Rust writes for it: the name and `type` as logical strings, the plain-source
 * settings plain, the parameters in Rust's order, and nothing else. A logical
 * string on disk written plain counts only when it cannot be anything but a
 * string, and a new form with field definitions is not compared at all. Each of
 * those answers "cannot tell" by colliding, which costs a manual resolution and
 * never a lost edit.
 *
 * @param was - What the file held when the session was seeded.
 * @param buffer - The retained draft, captured once by the caller.
 * @param now - What the newly parsed projection holds.
 * @returns The verdict, and the buffer a rebuilt session holds.
 */
export function variablesReapply(
  was: VariablesBaseline,
  buffer: VariablesBuffer,
  now: VariablesBaseline
): { readonly verdict: VariablesReapplyVerdict; readonly buffer: VariablesBuffer } {
  const fresh = variablesBufferOf(now);
  const derived = variablesDerivationOf(was, buffer);
  if (!derived.changed && !was.reprojectionOwed) {
    return { verdict: 'unchanged', buffer: fresh };
  }
  if (
    !was.reprojectionOwed &&
    !now.reprojectionOwed &&
    derived.problem === null &&
    was.shape === now.shape &&
    was.rows.length === now.rows.length &&
    sameContainer(was.container, now.container)
  ) {
    return { verdict: 'applicable', buffer };
  }
  if (!was.reprojectionOwed && intendedResultPresent(was, buffer, now)) {
    return { verdict: 'satisfied', buffer: fresh };
  }
  return { verdict: 'collision', buffer: fresh };
} // End of function variablesReapply()

// ---------------------------------------------------------------------------
// Retention: the rows a conflict compares and copies
// ---------------------------------------------------------------------------

/**
 * The status one drafted scalar is copied with.
 *
 * @param intent - Its intent.
 * @returns The status.
 */
function statusOf(intent: VariableDraft['name']): DraftFieldStatus {
  if (intent === 'Unchanged') {
    return 'unchanged';
  }
  return intent === 'Remove' ? 'removing' : 'setting';
} // End of function statusOf()

/**
 * The retained rows one new variable is copied as: its name and type, its
 * common fields, then each parameter as a `parameterName` row holding the key
 * and one `parameterValue` row per value — exact texts, never YAML.
 *
 * @param added - The drafted variable.
 * @returns The rows.
 */
function additionRows(added: NewVariable): readonly RetainedDraftField[] {
  const rows: RetainedDraftField[] = [
    { label: 'variableName', text: added.name, status: 'variableAdded' },
    { label: 'type', text: typeTextOf(added.params), status: 'variableAdded' }
  ];
  if (added.inject_vars !== null) {
    rows.push({ label: 'injectVars', text: added.inject_vars, status: 'variableAdded' });
  }
  for (const item of added.depends_on ?? []) {
    rows.push({ label: 'dependsOn', text: item, status: 'variableAdded' });
  } // End of the loop over the new variable's dependencies
  /**
   * Adds one parameter's rows: its key, then each value.
   *
   * @param key - The parameter's key.
   * @param values - Its values.
   */
  const param = (key: string, values: readonly string[]): void => {
    rows.push({ label: 'params', text: key, status: 'parameterName' });
    rows.push(...values.map((text) => ({ label: 'params' as const, text, status: 'parameterValue' as const })));
  }; // End of function param()
  const params = added.params;
  /**
   * Adds one optional parameter's rows, when it is set.
   *
   * @param key - The parameter's key.
   * @param value - Its value, or `null`.
   */
  const optional = (key: string, value: string | null): void => {
    if (value !== null) {
      param(key, [value]);
    }
  }; // End of function optional()
  if ('Date' in params) {
    optional('format', params.Date.format);
    optional('offset', params.Date.offset);
    optional('tz', params.Date.tz);
    optional('locale', params.Date.locale);
  } else if ('Choice' in params) {
    param('values', params.Choice.values);
  } else if ('Random' in params) {
    param('choices', params.Random.choices);
  } else if ('Echo' in params) {
    param('echo', [params.Echo.echo]);
  } else if ('Shell' in params) {
    param('cmd', [params.Shell.cmd]);
    optional('shell', params.Shell.shell);
    optional('trim', params.Shell.trim);
    optional('debug', params.Shell.debug);
  } else if ('Script' in params) {
    param('args', params.Script.args);
    optional('trim', params.Script.trim);
  } else if ('Form' in params) {
    param('layout', [params.Form.layout]);
    for (const field of params.Form.fields) {
      param('fields', [field.name]);
      const options = field.options;
      optional('type', options.type);
      optional('default', options.default);
      optional('multiline', options.multiline);
      if (options.values !== null) {
        param('values', 'List' in options.values ? options.values.List : [options.values.Text]);
      }
      optional('trim_string_values', options.trim_string_values);
      for (const extra of options.extra) {
        param(extra.key, newParamTexts(extra));
      } // End of the loop over the field's extra options
    } // End of the loop over the form's new definitions
  } else if ('Match' in params) {
    param('trigger', [params.Match.trigger]);
  }
  for (const extra of added.extra_params) {
    param(extra.key, newParamTexts(extra));
  } // End of the loop over the extra parameters
  return rows;
} // End of function additionRows()

/**
 * The retained draft's rows for `vars`, **only when the draft says something
 * about it**, so a copy of a draft that never touched a variable reads exactly as
 * it did before this phase.
 *
 * A container removal is one `variablesRemoved` row. Otherwise, per existing
 * variable in file order: a removed one is its name with `variableRemoved`; an
 * edited one is its drafted name (with the name's own status), then each drafted
 * scalar that changes, then its drafted parameters and `depends_on`
 * (`paramRowsOf` in `./variableParams.ts`, Phase 4-14-2). Then each new variable
 * ({@link additionRows}). Labels
 * repeat on purpose — one per variable — so a renderer must not key these rows
 * by label (B1, `docs/decisions/4-2-notes.md`).
 *
 * @param baseline - What the file holds.
 * @param buffer - The retained draft, captured once.
 * @returns The rows, in the order a screen shows them.
 */
export function variableRowsOf(
  baseline: VariablesBaseline,
  buffer: VariablesBuffer
): readonly RetainedDraftField[] {
  const derived = variablesDerivationOf(baseline, buffer);
  if (!derived.changed) {
    return [];
  }
  if (buffer.removeAll) {
    return [{ label: 'vars', text: '', status: 'variablesRemoved' }];
  }
  const rows: RetainedDraftField[] = [];
  baseline.rows.forEach((row, index) => {
    const drafted = buffer.rows[index];
    if (drafted === undefined) {
      return;
    }
    if (drafted.removed) {
      rows.push({ label: 'variableName', text: row.name.value, status: 'variableRemoved' });
      return;
    }
    const name = variableFieldIntent(row.name, drafted.name);
    const type = variableFieldIntent(row.type, drafted.type);
    const inject = variableFieldIntent(row.inject_vars, drafted.inject_vars);
    const open = paramRowsOf(row.boxes, drafted.boxes);
    if (name === 'Unchanged' && type === 'Unchanged' && inject === 'Unchanged' && open.length === 0) {
      return;
    }
    rows.push({ label: 'variableName', text: drafted.name.text, status: statusOf(name) });
    if (type !== 'Unchanged') {
      rows.push({ label: 'type', text: drafted.type.text, status: statusOf(type) });
    }
    if (inject !== 'Unchanged') {
      rows.push({ label: 'injectVars', text: drafted.inject_vars.text, status: statusOf(inject) });
    }
    rows.push(...open);
  }); // End of the walk over the baseline's variables
  for (const one of buffer.added) {
    rows.push(...additionRows(one.variable));
  } // End of the loop over the new variables
  return rows;
} // End of function variableRowsOf()

/**
 * Whether a retained draft carries variables or form definitions a new snippet
 * could not be born holding — ruling 21's test for recovery.
 *
 * `true` when the snippet holds a `vars` that is not an empty list, holds a
 * shorthand `form_fields`, or the draft adds a variable. Creation is
 * variable-free in Phase 4, so recreating such a snippet would keep its
 * `{{references}}` and drop their definitions. Deliberately wider than "the body
 * references one of them": whether a reference resolves is an analysis this
 * module does not repeat, and a refusal costs a copy and a discard, never a file
 * whose references lost their definitions.
 *
 * @param baseline - What the file held.
 * @param buffer - The retained draft, captured once.
 * @returns `true` when recovery must refuse to recreate.
 */
export function carriesDefinitions(baseline: VariablesBaseline, buffer: VariablesBuffer): boolean {
  const holdsVars = baseline.shape !== 'absent' && baseline.shape !== 'empty';
  return holdsVars || baseline.formFieldsHeld || buffer.added.length > 0;
} // End of function carriesDefinitions()

// ---------------------------------------------------------------------------
// R36 and R37: structural actions and the reorder offer
// ---------------------------------------------------------------------------

/**
 * One read of what the window holds that a structural variable action is decided
 * over — R37's "one synchronous read of current projections".
 */
export interface VariableStructureRead {
  /** The snippet's file as the window projects it now, or `null` when it holds none. */
  readonly document: DocumentView | null;
  /**
   * The identity of every snippet this window has a match editor open over, as
   * each editor's own projection gave it — R36's input.
   */
  readonly drafts: readonly MatchId[];
}

/**
 * The read a caller takes, from one list of projections.
 *
 * **One read**: the projection list is searched once here and never again by a
 * grant or an offer built from the answer. `BrowserState.variableStructureRead`
 * in `./workspace.svelte.ts` is the caller in this tree.
 *
 * @param views - The window's projections, read once by the caller.
 * @param document - The snippet's file.
 * @param drafts - Every open match draft's identity.
 * @returns The read.
 */
export function variableStructureReadOf(
  views: readonly DocumentView[],
  document: DocumentId,
  drafts: readonly MatchId[]
): VariableStructureRead {
  return {
    document: views.find((view) => view.id === document) ?? null,
    drafts: [...drafts]
  };
} // End of function variableStructureReadOf()

/**
 * Why a structural variable action (an insertion, a removal, a container removal
 * or a reorder) is withheld — a code, never a sentence.
 *
 * - `notInDocument` — the read holds no projection of the snippet's file, or the
 *   file holds no snippet with this exact identity;
 * - `readOnly` — this application must refuse to write the file;
 * - `staleDraftInDocument` — **R36's conservative rule** (ruling 23): a match
 *   editor is open in this file over an older revision — this one or another —
 *   so no relation can say which snippet it now means, and every structural
 *   variable action in the file is withheld until it is saved or discarded.
 */
export type VariableStructureRefusal = 'notInDocument' | 'readOnly' | 'staleDraftInDocument';

/**
 * The permission one structural transition spends — minted from one
 * {@link VariableStructureRead} for one snippet identity.
 */
export type VariableStructureGrant =
  | {
      /** Structural actions may be drafted. */
      readonly kind: 'granted';
      /** The snippet it was granted for, by the identity the read gives it. */
      readonly match: MatchId;
    }
  | {
      /** They may not, and the reason is shown. */
      readonly kind: 'refused';
      /** Why. */
      readonly reason: VariableStructureRefusal;
    };

/**
 * Whether two identities are the same, all three fields.
 *
 * @param one - An identity.
 * @param other - Another.
 * @returns `true` when they are equal.
 */
function sameMatch(one: MatchId, other: MatchId): boolean {
  return one.document === other.document && one.revision === other.revision && one.node === other.node;
} // End of function sameMatch()

/**
 * Whether structural variable actions may be drafted for one snippet, decided
 * over one read.
 *
 * R36 is asked **before** the snippet is looked for in the file: a stale session's
 * identity is by definition not in the newer projection, and the true reason is
 * the stale draft, not a missing snippet. It compares the document number and
 * revision only (`hasStaleMatchDraft` in `./matchMove.ts`, the one predicate) —
 * never a node lookup, which is the producer R36 forbids.
 *
 * @param match - The snippet, by the identity its editor holds.
 * @param read - One read of the window.
 * @returns The grant, or the refusal.
 */
export function variableStructureGrantOf(
  match: MatchId,
  read: VariableStructureRead
): VariableStructureGrant {
  const document = read.document;
  if (document === null || document.id !== match.document) {
    return { kind: 'refused', reason: 'notInDocument' };
  }
  if (document.read_only) {
    return { kind: 'refused', reason: 'readOnly' };
  }
  if (hasStaleMatchDraft(document, [match, ...read.drafts])) {
    return { kind: 'refused', reason: 'staleDraftInDocument' };
  }
  if (!document.matches.some((held) => sameMatch(held.id, match))) {
    return { kind: 'refused', reason: 'notInDocument' };
  }
  return { kind: 'granted', match };
} // End of function variableStructureGrantOf()

/**
 * Whether a grant covers one snippet.
 *
 * @param grant - What {@link variableStructureGrantOf} answered.
 * @param match - The snippet a transition is about.
 * @returns `true` when the grant was minted for exactly that identity.
 */
export function grantCovers(grant: VariableStructureGrant, match: MatchId): boolean {
  return grant.kind === 'granted' && sameMatch(grant.match, match);
} // End of function grantCovers()

/**
 * Why a reorder is not offered — a code, never a sentence.
 *
 * {@link VariableStructureRefusal}'s three, and:
 * - `editorNotEditable` — the editor accepts no change now (a save in flight, a
 *   conflict on screen, a commit awaiting a re-projection);
 * - `otherEditsPending` — **R25**: a reorder is alone in its save, so it is not
 *   offered while the draft holds any other change;
 * - `varsNotABlockList` — only a block list is reordered;
 * - `tooFewVariables` — a list of fewer than two has no other order.
 */
export type VariableMoveRefusal =
  | VariableStructureRefusal
  | 'editorNotEditable'
  | 'otherEditsPending'
  | 'varsNotABlockList'
  | 'tooFewVariables';

/** One reorder the offer allows: a variable, and where it would go. */
export interface VariableMoveChoice {
  /** The variable's position in the file's list. */
  readonly variable: number;
  /** Where it would go, as a placement in the **original** list. */
  readonly to: ListPlacement;
}

/**
 * What the reorder control may offer — every part derived from one read (R37).
 *
 * `choices` is empty whenever `refusal` is not `null`. {@link variableMoveSubmissionOf}
 * spends only a choice this offer holds.
 */
export interface VariableMoveOffer {
  /** Why nothing is offered, or `null`. */
  readonly refusal: VariableMoveRefusal | null;
  /** The snippet, by the identity the session holds. */
  readonly match: MatchId;
  /** The revision a reorder would be sent against. */
  readonly baseRevision: ContentRevision;
  /** Every reorder that changes the order, per variable. */
  readonly choices: readonly VariableMoveChoice[];
}

/**
 * Every placement that moves one variable somewhere else: the front unless it
 * is first, after each other variable except the one it already follows, and
 * the end unless it is last. `After` the last variable is the end's landing, so
 * it is offered as `End` only.
 *
 * @param count - How many variables the list holds.
 * @returns The choices, variable by variable.
 */
function moveChoicesOf(count: number): readonly VariableMoveChoice[] {
  const choices: VariableMoveChoice[] = [];
  for (let variable = 0; variable < count; variable += 1) {
    if (variable !== 0) {
      choices.push({ variable, to: { Front: {} } });
    }
    for (let after = 0; after < count - 1; after += 1) {
      if (after !== variable && after !== variable - 1) {
        choices.push({ variable, to: { After: { index: after } } });
      }
    } // End of the loop over the anchors
    if (variable !== count - 1) {
      choices.push({ variable, to: { End: {} } });
    }
  } // End of the loop over the variables
  return choices;
} // End of function moveChoicesOf()

/**
 * The reorder offer for one editor, over one read.
 *
 * @param state - What the editor says about itself: its identity, its base
 *   revision, its `vars` baseline, whether it accepts changes and whether its
 *   draft is dirty. `./matchEditor.ts`'s `variableMoveOffer` builds it.
 * @param read - One read of the window.
 * @returns The offer.
 */
export function variableMoveOfferOf(
  state: {
    readonly match: MatchId;
    readonly baseRevision: ContentRevision;
    readonly baseline: VariablesBaseline;
    readonly editable: boolean;
    readonly dirty: boolean;
  },
  read: VariableStructureRead
): VariableMoveOffer {
  /**
   * An offer that offers nothing, for one reason.
   *
   * @param refusal - Why.
   * @returns The offer.
   */
  const refused = (refusal: VariableMoveRefusal): VariableMoveOffer => ({
    refusal,
    match: state.match,
    baseRevision: state.baseRevision,
    choices: []
  }); // End of function refused()
  const grant = variableStructureGrantOf(state.match, read);
  if (grant.kind === 'refused') {
    return refused(grant.reason);
  }
  if (!state.editable || state.baseline.reprojectionOwed) {
    return refused('editorNotEditable');
  }
  if (state.dirty) {
    return refused('otherEditsPending');
  }
  if (state.baseline.shape !== 'block') {
    return refused('varsNotABlockList');
  }
  if (state.baseline.rows.length < 2) {
    return refused('tooFewVariables');
  }
  return {
    refusal: null,
    match: state.match,
    baseRevision: state.baseRevision,
    choices: moveChoicesOf(state.baseline.rows.length)
  };
} // End of function variableMoveOfferOf()

/**
 * A reorder ready to send: `beginVariableMove` in `./matchEditor.ts` starts it
 * and `BrowserState.moveVariable` in `./workspace.svelte.ts` sends it (Phase
 * 4-11).
 */
export interface VariableMoveSubmission {
  /** The snippet. */
  readonly match: MatchId;
  /** The variable's position in the original list. */
  readonly variable: number;
  /** Where it goes. */
  readonly to: ListPlacement;
  /** The revision it is sent against. */
  readonly baseRevision: ContentRevision;
}

/**
 * Whether two placements are the same.
 *
 * @param one - A placement.
 * @param other - Another.
 * @returns `true` when they are equal.
 */
function samePlacement(one: ListPlacement, other: ListPlacement): boolean {
  if ('Front' in one || 'End' in one) {
    return ('Front' in one && 'Front' in other) || ('End' in one && 'End' in other);
  }
  return 'After' in other && one.After.index === other.After.index;
} // End of function samePlacement()

/**
 * The submission for one reorder, **only from the offer it was chosen in** (R37):
 * the identity and the base revision are the offer's, never read again, and a
 * variable or placement the offer does not hold is refused (`null`).
 *
 * What it cannot force is that the offer is current: a caller that kept an old
 * offer gets a submission against its old revision, which the command refuses as
 * stale (D2v) — a surfaced refusal, never a wrong write.
 *
 * @param offer - What {@link variableMoveOfferOf} answered.
 * @param variable - The variable chosen.
 * @param to - The placement chosen.
 * @returns The submission, or `null`.
 */
export function variableMoveSubmissionOf(
  offer: VariableMoveOffer,
  variable: number,
  to: ListPlacement
): VariableMoveSubmission | null {
  if (offer.refusal !== null) {
    return null;
  }
  const chosen = offer.choices.some((one) => one.variable === variable && samePlacement(one.to, to));
  if (!chosen) {
    return null;
  }
  return { match: offer.match, variable, to, baseRevision: offer.baseRevision };
} // End of function variableMoveSubmissionOf()

// ---------------------------------------------------------------------------
// Sentences: codes to keys
// ---------------------------------------------------------------------------

/**
 * The dictionary key holding one variable-field refusal's sentence. The five
 * shared codes reuse the match editor's sentences.
 *
 * @param reason - Why the scalar may not be edited.
 * @returns The key.
 */
export function variableFieldRefusalKey(reason: VariableFieldRefusal): TranslationKey {
  switch (reason) {
    case 'notDecodable':
      return 'browser.matchEditor.readOnly.notDecodable';
    case 'carriageReturn':
      return 'browser.matchEditor.readOnly.carriageReturn';
    case 'ownsNoBytes':
      return 'browser.matchEditor.readOnly.ownsNoBytes';
    case 'unmodelledShape':
      return 'browser.matchEditor.readOnly.unmodelledShape';
    case 'lineBreak':
      return 'browser.matchEditor.readOnly.lineBreak';
    case 'notInVariable':
      return 'browser.variableEditor.readOnly.notInVariable';
  }
} // End of function variableFieldRefusalKey()

/**
 * The dictionary key holding one addition refusal's sentence.
 *
 * @param reason - Why a new variable cannot be added.
 * @returns The key.
 */
export function variableAdditionRefusalKey(reason: VariableAdditionRefusal): TranslationKey {
  switch (reason) {
    case 'varsNotABlockList':
      return 'browser.variableEditor.addition.varsNotABlockList';
    case 'additionPending':
      return 'browser.variableEditor.addition.additionPending';
    case 'containerRemoved':
      return 'browser.variableEditor.addition.containerRemoved';
    case 'notDraftable':
      return 'browser.variableEditor.addition.notDraftable';
  }
} // End of function variableAdditionRefusalKey()

/**
 * The dictionary key holding one reorder or structure refusal's sentence.
 *
 * @param reason - Why the action is withheld.
 * @returns The key.
 */
export function variableMoveRefusalKey(reason: VariableMoveRefusal): TranslationKey {
  switch (reason) {
    case 'notInDocument':
      return 'browser.variableEditor.structure.notInDocument';
    case 'readOnly':
      return 'browser.variableEditor.structure.readOnly';
    case 'staleDraftInDocument':
      return 'browser.variableEditor.structure.staleDraftInDocument';
    case 'editorNotEditable':
      return 'browser.variableEditor.move.editorNotEditable';
    case 'otherEditsPending':
      return 'browser.variableEditor.move.otherEditsPending';
    case 'varsNotABlockList':
      return 'browser.variableEditor.move.varsNotABlockList';
    case 'tooFewVariables':
      return 'browser.variableEditor.move.tooFewVariables';
  }
} // End of function variableMoveRefusalKey()

/**
 * The label a `vars` collision is named by, for `tRetainedLabel`.
 *
 * @returns The `vars` label.
 */
export function varsLabelName(): RetainedLabel {
  return 'vars';
} // End of function varsLabelName()
