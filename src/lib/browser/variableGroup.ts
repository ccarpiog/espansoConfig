/**
 * The *Variables and fill-ins* group — Phase 4-11: what the match editor's
 * variables surface draws, as values.
 *
 * `../components/VariableGroup.svelte` walks what this module answers; every
 * decision about what is drawn, what is offered and what a press may change is
 * here, where a test in the `node` environment reaches it (`CLAUDE.md` §6,
 * *Frontend structure*). The transitions it drives are Phase 4-9's
 * (`./matchEditor.ts`, `./variableEditor.ts`, `./variableInsertion.ts`); this
 * module composes them into one view and adds the **Choice** insertion 4-11
 * delivers of its own. The *Add a variable* form — 4-11's `echo` *Add variable*,
 * widened by Phase 4-14-1 to seven kinds — is `./variableKinds.ts`'s.
 *
 * ## What the group is
 *
 * Ruling 24 of `docs/decisions/4-split-notes.md`: a group inside the existing
 * match editor plus a chip strip, over the editor's one buffer set, history,
 * save and conflict registry. Override row 7: **editing controls are not
 * mounted until selected; the chip strip stays visible.** So the view has three
 * parts:
 *
 * - {@link VariableGroupView.chips} — one chip per declaration, in authored
 *   order, then the draft's new variables. A variable drafted for removal keeps
 *   its chip (marked), and a container drafted for removal keeps every chip, so
 *   **every declaration stays reachable** — the restoration is on its controls;
 * - {@link VariableGroupView.rows} — the ordered list with each declaration's
 *   dependency state, read from the Rust analysis of the file (never re-derived
 *   here), and {@link VariableGroupView.analysis} — whether that analysis is at
 *   hand and why it is incomplete;
 * - {@link VariableGroupView.selected} — the controls of the one selection,
 *   `null` when nothing is selected, which is when no box is mounted.
 *
 * ## What it does not claim
 *
 * The dependency state describes **the file as last read** for this identity —
 * the analysis is `match_authoring_snapshot`'s, cut in Rust for exactly the
 * revision the session was seeded from — never the draft: a renamed or new
 * variable is analysed after it is saved. "No visible reference found" is never
 * "has no effect" (ruling 13): espanso evaluates every local variable. File
 * order is authored order and is never claimed to be espanso's execution order
 * (ruling 11). Under an open scope a name is "available among visible names",
 * never collision-free (ruling 20).
 *
 * ## What no type here forces
 *
 * That the component hands {@link variableGroupViewOf} the structure read it
 * took **now**, and mints a press's grant or offer from a fresh read rather than
 * from the one the view was drawn from (R37). `VariableGroup.svelte` reads once
 * per press; TypeScript cannot force it.
 */

import type { TranslationKey } from '../i18n/dictionaries';
import type { CommandResult } from '../ipc/commands';
import type {
  Acknowledgement,
  AnalysisSummary,
  AuthoringSnapshot,
  ContentForm,
  ContentRevision,
  DocumentId,
  EdgeKind,
  IncompleteReason,
  ListPlacement,
  MatchId,
  NewVariable,
  NewVariableParams,
  ScalarStyle,
  Usage,
  VariableField
} from '../ipc/types';
import { styleWorthShowing } from './detail';
import {
  isFieldEditable,
  isVariablesEditable,
  variableMoveOffer,
  type MatchEditorSession,
  type TextSelection
} from './matchEditor';
import type { RetainedLabel } from './saveOutcome';
import {
  capturedVariables,
  typeTextOf,
  variableAdditionRefusal,
  variableFieldIntent,
  variableStructureGrantOf,
  VARIABLE_FIELDS,
  type VariableAdditionRefusal,
  type VariableFieldRefusal,
  type VariableMoveRefusal,
  type VariableStructureGrant,
  type VariableStructureRead,
  type VariableStructureRefusal,
  type VariablesBaseline,
  type VarsShape
} from './variableEditor';
import {
  insertVariable,
  nameVerdictOf,
  REFERENCE_FIELDS,
  suggestedName,
  type InsertOutcome,
  type NameContext,
  type NameVerdict,
  type ReferenceField
} from './variableInsertion';
import type { MatchSaveAnswer } from './workspace.svelte';

// ---------------------------------------------------------------------------
// The port a host hands the editor
// ---------------------------------------------------------------------------

/**
 * What the variables surface needs from the window, as one object —
 * `DetailPane.svelte` builds it over `BrowserState`.
 *
 * **Required as a whole by `MatchEditor.svelte`**, so a host cannot mount the
 * editor without one; what that forces is only that a host supplies one — no
 * type forces `moveVariable` to be `BrowserState.moveVariable` rather than the
 * bare command, which would skip the adoption a commit owes.
 */
export interface VariableGroupPort {
  /**
   * Reads one snippet's authoring snapshot — `BrowserState.matchAuthoringSnapshot`.
   *
   * @param id - The snippet, by the identity the session holds.
   * @returns The snapshot, or a failure.
   */
  snapshot(id: MatchId): Promise<CommandResult<AuthoringSnapshot>>;
  /**
   * One read of what a structural action is decided over —
   * `BrowserState.variableStructureRead`, with the identities of the match
   * editors open **beside** this one (this editor's own is added by the grant).
   *
   * @param document - The snippet's file.
   * @returns The read.
   */
  structureRead(document: DocumentId): VariableStructureRead;
  /**
   * Sends one reorder — `BrowserState.moveVariable`.
   *
   * @param id - The snippet, by the identity the offer was made for.
   * @param variable - The variable's position.
   * @param to - Where it goes.
   * @param baseRevision - The revision the offer was made against.
   * @param acknowledgement - The suspicions already shown to a person.
   * @returns The save's answer.
   */
  moveVariable(
    id: MatchId,
    variable: number,
    to: ListPlacement,
    baseRevision: ContentRevision,
    acknowledgement: Acknowledgement
  ): Promise<MatchSaveAnswer>;
}

// ---------------------------------------------------------------------------
// The analysis a session holds
// ---------------------------------------------------------------------------

/**
 * What the editor holds of the snapshot read for one identity.
 *
 * - `reading` — asked, not answered;
 * - `read` — answered with a snapshot;
 * - `unreadable` — answered with a failure (a stale identity among them).
 */
export type HeldAnalysis =
  | { readonly kind: 'reading'; readonly for: MatchId }
  | { readonly kind: 'read'; readonly for: MatchId; readonly snapshot: AuthoringSnapshot }
  | { readonly kind: 'unreadable'; readonly for: MatchId };

/**
 * Whether the analysis shown is about the session's snippet as the file holds it.
 *
 * - `reading` — the snapshot for this identity has not answered yet;
 * - `current` — it answered for exactly this identity and revision;
 * - `unavailable` — it failed, or nothing was asked;
 * - `outOfStep` — what is held was read for another identity or revision (a
 *   commit moved the session, or a reply arrived for an older one). Shown as
 *   nothing rather than as a stale claim.
 */
export type AnalysisState = 'reading' | 'current' | 'unavailable' | 'outOfStep';

/**
 * Whether two identities are the same, all three fields.
 *
 * @param one - An identity.
 * @param other - Another.
 * @returns `true` when equal.
 */
function sameMatch(one: MatchId, other: MatchId): boolean {
  return one.document === other.document && one.revision === other.revision && one.node === other.node;
} // End of function sameMatch()

/**
 * The analysis to show for a session, and in what state.
 *
 * **Only an answer for this exact identity counts**, and the snapshot's own `id`
 * is checked as well as what it was asked for: a reply that arrives after a
 * commit moved the session describes bytes that were replaced.
 *
 * **And nothing counts while the rows owe a re-projection** (the 4-11 review's
 * first finding): a committed write moves the session's identity to the new
 * revision at once, so a snapshot of that revision arrives and matches it — but
 * the baseline rows are still the old ones until the editor is re-seeded, and a
 * committed reorder changed every position. Analysis positions are attached to
 * rows only when both describe the same projection, which is exactly when no
 * re-projection is owed.
 *
 * @param session - The editing session.
 * @param held - What the editor holds, or `null` when nothing was asked.
 * @returns The state, and the analysis when it is `current`.
 */
export function analysisOf(
  session: MatchEditorSession,
  held: HeldAnalysis | null
): { readonly state: AnalysisState; readonly analysis: AnalysisSummary | null } {
  if (held === null) {
    return { state: 'unavailable', analysis: null };
  }
  if (session.needsReprojection || session.baseline.variables.reprojectionOwed) {
    return { state: 'outOfStep', analysis: null };
  }
  if (!sameMatch(held.for, session.match)) {
    return { state: 'outOfStep', analysis: null };
  }
  if (held.kind === 'reading') {
    return { state: 'reading', analysis: null };
  }
  if (held.kind === 'unreadable') {
    return { state: 'unavailable', analysis: null };
  }
  return sameMatch(held.snapshot.id, session.match)
    ? { state: 'current', analysis: held.snapshot.analysis }
    : { state: 'outOfStep', analysis: null };
} // End of function analysisOf()

/**
 * What the editor holds once a snapshot read answers.
 *
 * **Only the read still awaited is replaced**: a reply for an identity the
 * editor has moved away from (a commit re-seeded it while the read was out)
 * changes nothing, so a late answer about replaced bytes cannot overwrite the
 * read for the current ones.
 *
 * @param held - What the editor holds now.
 * @param asked - The identity the answering read was asked for.
 * @param answer - The read's answer.
 * @returns What the editor holds after it.
 */
export function heldAfterReply(
  held: HeldAnalysis | null,
  asked: MatchId,
  answer: CommandResult<AuthoringSnapshot>
): HeldAnalysis | null {
  if (held === null || held.kind !== 'reading' || !sameMatch(held.for, asked)) {
    return held;
  }
  return answer.ok
    ? { kind: 'read', for: asked, snapshot: answer.value }
    : { kind: 'unreadable', for: asked };
} // End of function heldAfterReply()

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

/**
 * What is selected in the group — whose controls are mounted.
 *
 * - `variable` — an existing variable, by its position in the file's list;
 * - `added` — a new variable of the draft, by its position among the additions;
 * - `choice` — the **Choice** insertion's form;
 * - `add` — the *Add a variable* form (`./variableKinds.ts`), which adds a new
 *   variable of one of seven kinds with no reference inserted anywhere (ruling
 *   20: Echo is authored through *Add variable*; Phase 4-14-1 widened it).
 *
 * `null` is nothing selected: no box of the group is mounted.
 */
export type GroupSelection =
  | { readonly kind: 'variable'; readonly index: number }
  | { readonly kind: 'added'; readonly position: number }
  | { readonly kind: 'choice' }
  | { readonly kind: 'add' }
  | null;

/**
 * Whether two selections name the same thing.
 *
 * @param one - A selection.
 * @param other - Another.
 * @returns `true` when equal.
 */
export function sameSelection(one: GroupSelection, other: GroupSelection): boolean {
  if (one === null || other === null) {
    return one === other;
  }
  if (one.kind === 'variable' && other.kind === 'variable') {
    return one.index === other.index;
  }
  if (one.kind === 'added' && other.kind === 'added') {
    return one.position === other.position;
  }
  return one.kind === other.kind && (one.kind === 'choice' || one.kind === 'add');
} // End of function sameSelection()

/**
 * A selection together with the variables baseline it was made over — the 4-11
 * review's second finding. A selection names a declaration **by position**, and
 * a position means the same declaration only over the baseline it was chosen
 * in: after a committed reorder or removal and a re-seed, position 1 is another
 * variable. The component holds one of these, never a bare selection.
 */
export interface SeededSelection {
  /** What was selected. */
  readonly selection: GroupSelection;
  /**
   * The `MatchBaseline.variables` it was chosen over, compared by identity: a
   * baseline is replaced whole by a commit, a re-seed and a reapply, and never
   * by an edit.
   */
  readonly seed: VariablesBaseline | null;
}

/** Nothing selected, over no baseline. */
export const NO_SELECTION: SeededSelection = Object.freeze({ selection: null, seed: null });

/**
 * A selection made now, bound to the baseline it was made over.
 *
 * @param session - The editing session.
 * @param selection - What was selected.
 * @returns The seeded selection.
 */
export function seededSelection(session: MatchEditorSession, selection: GroupSelection): SeededSelection {
  return { selection, seed: session.baseline.variables };
} // End of function seededSelection()

/**
 * The selection a seeded one still makes: `null` once the baseline it was made
 * over has been replaced, whatever positions the new one holds.
 *
 * @param session - The editing session.
 * @param seeded - What the component holds.
 * @returns The selection, or `null`.
 */
export function selectionOfSeed(session: MatchEditorSession, seeded: SeededSelection): GroupSelection {
  return seeded.seed === session.baseline.variables ? seeded.selection : null;
} // End of function selectionOfSeed()

/**
 * A selection that still names something the session holds, or `null` — an
 * undo can take an addition away, and a re-seed can shorten the list. A
 * re-seed that keeps the length is {@link selectionOfSeed}'s to catch.
 *
 * @param session - The editing session.
 * @param selection - What the component holds.
 * @returns The selection, or `null`.
 */
export function liveSelection(session: MatchEditorSession, selection: GroupSelection): GroupSelection {
  if (selection === null || selection.kind === 'choice' || selection.kind === 'add') {
    return selection;
  }
  if (selection.kind === 'variable') {
    return selection.index >= 0 && selection.index < session.baseline.variables.rows.length
      ? selection
      : null;
  }
  return selection.position >= 0 && selection.position < session.draft.value.variables.added.length
    ? selection
    : null;
} // End of function liveSelection()

// ---------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------

/**
 * What the draft does to one declaration.
 *
 * - `file` — nothing: it is as the file holds it;
 * - `edited` — a drafted scalar changes;
 * - `removed` — drafted for removal (or its whole container is);
 * - `added` — a new variable of the draft.
 */
export type DeclarationStatus = 'file' | 'edited' | 'removed' | 'added';

/** One chip of the strip. */
export interface VariableChip {
  /** A key unique within the strip, for a renderer's keyed walk. */
  readonly key: string;
  /** What pressing it selects. */
  readonly selection: Exclude<GroupSelection, null>;
  /** The name to draw: the box's text, or the file's; `''` when there is none. */
  readonly name: string;
  /** The `type` text to draw beside it; `''` when there is none. */
  readonly typeText: string;
  /** What the draft does to it. */
  readonly status: DeclarationStatus;
  /** Whether its controls are the ones mounted. */
  readonly selected: boolean;
}

/** A declaration another one is linked to, by the name the analysis read. */
export interface LinkedDeclaration {
  /** The other declaration's name, or `null` when the analysis read none. */
  readonly name: string | null;
  /** How the edge was learnt. */
  readonly kind: EdgeKind;
}

/**
 * What the Rust analysis says about one declaration — never re-derived here.
 */
export interface DependencyState {
  /** How often it is referenced, by where. */
  readonly usage: Usage;
  /**
   * Whether no reference to it was found anywhere this analysis looks — ruling
   * 13's "no visible reference found", never "has no effect".
   */
  readonly noVisibleReference: boolean;
  /** The declarations it depends on. */
  readonly dependsOn: readonly LinkedDeclaration[];
  /** The declarations that depend on it. */
  readonly usedBy: readonly LinkedDeclaration[];
  /** Whether it is a member of a dependency cycle. */
  readonly inCycle: boolean;
  /** How many of its `depends_on` entries name nothing visible. */
  readonly missingDependencies: number;
  /**
   * The declarations it depends on that are written after it — ruling 11's
   * advisory, naming both declarations. The order stays as written.
   */
  readonly writtenBefore: readonly (string | null)[];
  /** Why part of what is said about it is uncertain. */
  readonly incomplete: readonly IncompleteReason[];
}

/** One declaration of the ordered list. */
export interface VariableRow {
  /** Its position in the file's list. */
  readonly index: number;
  /** The name to draw (the draft's), `''` when there is none. */
  readonly name: string;
  /** The `type` text to draw (the draft's), `''` when there is none. */
  readonly typeText: string;
  /** What the draft does to it. */
  readonly status: DeclarationStatus;
  /** The analysis's state for it, or `null` when no analysis is current. */
  readonly dependency: DependencyState | null;
}

/** One new variable of the draft, in the list. */
export interface AddedRow {
  /** Its position among the draft's additions. */
  readonly position: number;
  /** Its name. */
  readonly name: string;
  /** Its `type` text, as Rust will write it. */
  readonly typeText: string;
}

/** One scalar box of a selected existing variable. */
export interface VariableFieldView {
  /** Which scalar. */
  readonly field: VariableField;
  /** Its label, for `tRetainedLabel`. */
  readonly label: RetainedLabel;
  /** What the box holds (or, read-only, what the file holds). */
  readonly text: string;
  /** Whether a box is drawn and accepts typing. */
  readonly editable: boolean;
  /** Why it is shown and not edited, or `null` when it is a box. */
  readonly refusal: VariableFieldRefusal | null;
  /**
   * How the file writes it, when that is not plain — D2u: the box holds the
   * scalar's text between its quotes, so the style is said beside it rather
   * than hidden. `null` for a plain or absent scalar.
   */
  readonly style: ScalarStyle | null;
  /**
   * Whether an edit would rewrite a quoted spelling plain — true of a quoted
   * `inject_vars`, which every writing path emits as validated plain source
   * (Phase 4-9 review, finding 1). Saving it untouched writes nothing.
   */
  readonly editWritesPlain: boolean;
}

/** One reorder a selected variable is offered. */
export interface MoveChoiceView {
  /** The placement, exactly as the offer holds it. */
  readonly to: ListPlacement;
  /** Which sentence labels it. */
  readonly label: 'front' | 'after' | 'end';
  /** For `after`, the name of the variable it would follow (`''` when none). */
  readonly anchor: string;
}

/** The controls of one selected existing variable. */
export interface SelectedVariable {
  /** What kind of selection. */
  readonly kind: 'variable';
  /** Its position in the file's list. */
  readonly index: number;
  /** Its name, as drawn. */
  readonly name: string;
  /** Whether it is drafted for removal (alone or with the container). */
  readonly removed: boolean;
  /** The three scalar boxes, in {@link VARIABLE_FIELDS} order. */
  readonly fields: readonly VariableFieldView[];
  /** Whether *Take this variable out* does anything. */
  readonly canRemove: boolean;
  /** Whether *Keep this variable* does anything. */
  readonly canRestore: boolean;
  /** The reorders offered for it — empty while {@link VariableGroupView.moveRefusal} is set. */
  readonly moves: readonly MoveChoiceView[];
}

/** The controls of one selected new variable. */
export interface SelectedAddition {
  /** What kind of selection. */
  readonly kind: 'added';
  /** Its position among the additions. */
  readonly position: number;
  /** Its name. */
  readonly name: string;
  /** Its `type` text. */
  readonly typeText: string;
  /** A `choice`'s values, in order; empty for any other kind. */
  readonly values: readonly string[];
  /**
   * The drafted parameters, exactly as they will be sent — Phase 4-14-1: a
   * renderer lists them through `addedParamsOf` in `./variableKinds.ts`.
   */
  readonly params: NewVariableParams;
  /** The content key its compound *Insert* wrote the reference into, or `null`. */
  readonly insertedInto: ContentForm | null;
  /** Whether *Drop this new variable* does anything. */
  readonly canDiscard: boolean;
}

/** Everything the group draws, derived on every read. */
export interface VariableGroupView {
  /** Whether the variables accept changes now (`isVariablesEditable`). */
  readonly editable: boolean;
  /** The `vars` shape. */
  readonly shape: VarsShape;
  /** Whether the whole container is drafted for removal. */
  readonly containerRemoved: boolean;
  /** Whether *Take out all variables* does anything. */
  readonly canRemoveAll: boolean;
  /** Whether *Keep the variables* does anything. */
  readonly canRestoreAll: boolean;
  /** Why structural actions are withheld (R36), or `null`. */
  readonly structureRefusal: VariableStructureRefusal | null;
  /** Why a new variable cannot be added, or `null`. */
  readonly additionRefusal: VariableAdditionRefusal | null;
  /** Why no reorder is offered (R25, R36), or `null`. */
  readonly moveRefusal: VariableMoveRefusal | null;
  /** The chip strip. */
  readonly chips: readonly VariableChip[];
  /** The ordered list: existing declarations in file order. */
  readonly rows: readonly VariableRow[];
  /** The draft's new variables, after them. */
  readonly added: readonly AddedRow[];
  /** The analysis's state, and its reasons that name no declaration. */
  readonly analysis: {
    readonly state: AnalysisState;
    readonly incomplete: readonly IncompleteReason[];
  };
  /** The live selection. */
  readonly selection: GroupSelection;
  /** The selected declaration's controls, or `null` (the two forms are the component's). */
  readonly selected: SelectedVariable | SelectedAddition | null;
}

/**
 * The declaration position an incomplete reason names, or `null` for a reason
 * about the whole analysis.
 *
 * @param reason - The reason.
 * @returns The position, or `null`.
 */
function reasonDeclaration(reason: IncompleteReason): number | null {
  if ('NameUnreadable' in reason) {
    return reason.NameUnreadable.declaration;
  }
  if ('LocalNameUnreadable' in reason) {
    return reason.LocalNameUnreadable.declaration;
  }
  if ('DependsOnUnreadable' in reason) {
    return reason.DependsOnUnreadable.declaration;
  }
  if ('ParamsUnreadable' in reason) {
    return reason.ParamsUnreadable.declaration;
  }
  if ('InjectionUncertain' in reason) {
    return reason.InjectionUncertain.declaration;
  }
  return null;
} // End of function reasonDeclaration()

/**
 * Whether an incomplete reason concerns one declaration.
 *
 * @param reason - The reason.
 * @param index - The declaration's position.
 * @returns `true` when it names that declaration.
 */
function reasonConcerns(reason: IncompleteReason, index: number): boolean {
  if ('DuplicateDeclaration' in reason) {
    return reason.DuplicateDeclaration.declarations.includes(index);
  }
  return reasonDeclaration(reason) === index;
} // End of function reasonConcerns()

/**
 * Whether an incomplete reason is about the analysis as a whole.
 *
 * @param reason - The reason.
 * @returns `true` when it names no declaration.
 */
function reasonIsGeneral(reason: IncompleteReason): boolean {
  return !('DuplicateDeclaration' in reason) && reasonDeclaration(reason) === null;
} // End of function reasonIsGeneral()

/**
 * What the analysis says about one declaration.
 *
 * @param analysis - The current analysis.
 * @param index - The declaration's position in the file's list.
 * @returns Its state, or `null` when the analysis holds no such declaration.
 */
function dependencyOf(analysis: AnalysisSummary, index: number): DependencyState | null {
  const declaration = analysis.declarations.find((one) => one.index === index);
  if (declaration === undefined) {
    return null;
  }
  /**
   * The name the analysis read for one position.
   *
   * @param at - A declaration's position.
   * @returns Its name, or `null`.
   */
  const nameAt = (at: number): string | null =>
    analysis.declarations.find((one) => one.index === at)?.name ?? null;
  const usage = declaration.usage;
  return {
    usage,
    noVisibleReference:
      usage.body + usage.parameters + usage.depends_on + usage.unverified_layout === 0,
    dependsOn: analysis.edges
      .filter((edge) => edge.consumer === index)
      .map((edge) => ({ name: nameAt(edge.dependency), kind: edge.kind })),
    usedBy: analysis.edges
      .filter((edge) => edge.dependency === index)
      .map((edge) => ({ name: nameAt(edge.consumer), kind: edge.kind })),
    inCycle: analysis.cycles.some((cycle) => cycle.members.includes(index)),
    missingDependencies: analysis.missing_dependencies.filter((one) => one.consumer === index).length,
    writtenBefore: analysis.order_advisories
      .filter((one) => one.consumer === index)
      .map((one) => nameAt(one.dependency)),
    incomplete: analysis.incomplete.filter((reason) => reasonConcerns(reason, index))
  };
} // End of function dependencyOf()

/**
 * The reorders one variable is offered, from the offer.
 *
 * @param offer - The offer, from one read.
 * @param index - The variable's position.
 * @param names - Every existing variable's drawn name, by position.
 * @returns The choices, in the offer's order.
 */
function movesOf(
  offer: ReturnType<typeof variableMoveOffer>,
  index: number,
  names: readonly string[]
): readonly MoveChoiceView[] {
  if (offer.refusal !== null) {
    return [];
  }
  return offer.choices
    .filter((choice) => choice.variable === index)
    .map((choice) => {
      const to = choice.to;
      if ('Front' in to) {
        return { to, label: 'front' as const, anchor: '' };
      }
      if ('End' in to) {
        return { to, label: 'end' as const, anchor: '' };
      }
      return { to, label: 'after' as const, anchor: names[to.After.index] ?? '' };
    });
} // End of function movesOf()

/**
 * Everything the group draws for one session.
 *
 * @param session - The editing session.
 * @param held - The snapshot the editor holds, or `null`.
 * @param selection - What the component holds as selected.
 * @param read - One read of the window, taken by the caller for this drawing.
 * @returns The view.
 */
export function variableGroupViewOf(
  session: MatchEditorSession,
  held: HeldAnalysis | null,
  selection: GroupSelection,
  read: VariableStructureRead
): VariableGroupView {
  const baseline = session.baseline.variables;
  const buffer = capturedVariables(session.draft.value.variables);
  const editable = isVariablesEditable(session);
  const { state, analysis } = analysisOf(session, held);
  const grant = variableStructureGrantOf(session.match, read);
  const structureRefusal = grant.kind === 'refused' ? grant.reason : null;
  const offer = variableMoveOffer(session, read);
  const live = liveSelection(session, selection);
  const rows: VariableRow[] = baseline.rows.map((row, index) => {
    const drafted = buffer.rows[index];
    const removed = buffer.removeAll || drafted?.removed === true;
    const edited =
      drafted !== undefined &&
      !removed &&
      (variableFieldIntent(row.name, drafted.name) !== 'Unchanged' ||
        variableFieldIntent(row.type, drafted.type) !== 'Unchanged' ||
        variableFieldIntent(row.inject_vars, drafted.inject_vars) !== 'Unchanged');
    return {
      index,
      name: drafted === undefined || removed ? row.name.value : drafted.name.text,
      typeText: drafted === undefined || removed ? row.type.value : drafted.type.text,
      status: removed ? 'removed' : edited ? 'edited' : 'file',
      dependency: analysis === null ? null : dependencyOf(analysis, index)
    };
  }); // End of the walk over the existing variables
  const added: AddedRow[] = buffer.added.map((one, position) => ({
    position,
    name: one.variable.name,
    typeText: typeTextOf(one.variable.params)
  }));
  const chips: VariableChip[] = [
    ...rows.map((row) => {
      const chosen: Exclude<GroupSelection, null> = { kind: 'variable', index: row.index };
      return {
        key: `variable-${row.index}`,
        selection: chosen,
        name: row.name,
        typeText: row.typeText,
        status: row.status,
        selected: sameSelection(live, chosen)
      };
    }),
    ...added.map((row) => {
      const chosen: Exclude<GroupSelection, null> = { kind: 'added', position: row.position };
      return {
        key: `added-${row.position}`,
        selection: chosen,
        name: row.name,
        typeText: row.typeText,
        status: 'added' as const,
        selected: sameSelection(live, chosen)
      };
    })
  ];
  const names = rows.map((row) => row.name);
  const granted = grant.kind === 'granted';
  return {
    editable,
    shape: baseline.shape,
    containerRemoved: buffer.removeAll,
    canRemoveAll: editable && granted && !buffer.removeAll && baseline.shape !== 'absent',
    canRestoreAll: editable && buffer.removeAll,
    structureRefusal,
    additionRefusal: variableAdditionRefusal(baseline, buffer),
    moveRefusal: offer.refusal,
    chips,
    rows,
    added,
    analysis: {
      state,
      incomplete: analysis === null ? [] : analysis.incomplete.filter(reasonIsGeneral)
    },
    selection: live,
    selected: selectedOf(session, live, rows, names, offer, granted)
  };
} // End of function variableGroupViewOf()

/**
 * The controls of the live selection.
 *
 * @param session - The editing session.
 * @param selection - The live selection.
 * @param rows - The list's rows.
 * @param names - Every existing variable's drawn name, by position.
 * @param offer - The reorder offer, from the view's read.
 * @param granted - Whether structural actions are granted over that read.
 * @returns The controls, or `null` for no selection or one of the two forms.
 */
function selectedOf(
  session: MatchEditorSession,
  selection: GroupSelection,
  rows: readonly VariableRow[],
  names: readonly string[],
  offer: ReturnType<typeof variableMoveOffer>,
  granted: boolean
): SelectedVariable | SelectedAddition | null {
  const editable = isVariablesEditable(session);
  const buffer = capturedVariables(session.draft.value.variables);
  if (selection === null || selection.kind === 'choice' || selection.kind === 'add') {
    return null;
  }
  if (selection.kind === 'added') {
    const one = buffer.added[selection.position];
    if (one === undefined) {
      return null;
    }
    const params = one.variable.params;
    return {
      kind: 'added',
      position: selection.position,
      name: one.variable.name,
      typeText: typeTextOf(params),
      values: 'Choice' in params ? [...params.Choice.values] : [],
      params,
      insertedInto: one.insertedInto,
      canDiscard: editable
    };
  }
  const index = selection.index;
  const row = session.baseline.variables.rows[index];
  const drafted = buffer.rows[index];
  const drawn = rows[index];
  if (row === undefined || drafted === undefined || drawn === undefined) {
    return null;
  }
  const removed = drawn.status === 'removed';
  const fields: VariableFieldView[] = VARIABLE_FIELDS.map((field) => {
    const scalar = row[field];
    const view = field === 'name' ? row.view.name : field === 'type' ? row.view.declared_type : row.view.inject_vars;
    const style = view === null ? null : styleWorthShowing(view.style);
    const eligible = scalar.eligibility.kind === 'editable';
    return {
      field,
      label: field === 'name' ? 'variableName' : field === 'type' ? 'type' : 'injectVars',
      text: eligible ? drafted[field].text : scalar.value,
      editable: eligible && editable && !removed,
      refusal: scalar.eligibility.kind === 'readOnly' ? scalar.eligibility.reason : null,
      style,
      editWritesPlain: field === 'inject_vars' && (style === 'SingleQuoted' || style === 'DoubleQuoted')
    };
  }); // End of the walk over the three drafted scalars
  const containerRemoved = buffer.removeAll;
  return {
    kind: 'variable',
    index,
    name: drawn.name,
    removed,
    fields,
    canRemove:
      editable && granted && !removed && session.baseline.variables.shape === 'block',
    canRestore: editable && drafted.removed && !containerRemoved,
    moves: movesOf(offer, index, names)
  };
} // End of function selectedOf()

// ---------------------------------------------------------------------------
// The Choice insertion
// ---------------------------------------------------------------------------

/**
 * What the **Choice** insertion's form holds: the new variable's name, its
 * values as one text (one value per line), and the content key the
 * `{{reference}}` goes into. The component holds it; nothing here stores it.
 */
export interface ChoiceDraft {
  /** The proposed name — provisional until inserted. */
  readonly name: string;
  /** The values, one per line, as the text area holds them. */
  readonly values: string;
  /** The content key the reference goes into. */
  readonly target: ReferenceField;
}

/**
 * Why a **Choice** cannot be inserted as the form stands — a code.
 *
 * - `noTarget` — no content key of this snippet can take a reference now;
 * - `noValues` — no value was given;
 * - `emptyValue` — a line between two values is empty;
 * - `carriageReturn` — a value holds a carriage return, which no control here
 *   can hold (`CLAUDE.md` §6) — reachable only through a forged draft.
 */
export type ChoiceProblem = 'noTarget' | 'noValues' | 'emptyValue' | 'carriageReturn';

/**
 * The content keys a reference may go into now: the three bodies whose
 * references the analysis counts, each accepting changes, and each the snippet
 * holds or the draft writes — a reference is never the reason a new content key
 * appears.
 *
 * @param session - The editing session.
 * @returns The keys, in `REFERENCE_FIELDS` order.
 */
export function choiceTargetsOf(session: MatchEditorSession): readonly ReferenceField[] {
  const buffers = session.draft.value;
  return REFERENCE_FIELDS.filter(
    (field) =>
      isFieldEditable(session, field) &&
      !buffers[field].removed &&
      (session.baseline[field].present || buffers[field].text !== '')
  );
} // End of function choiceTargetsOf()

/**
 * The form a **Choice** insertion opens with: a provisional name the context
 * does not refuse (`choice`, `choice2`, …), no values, and the focused content
 * key when it can take a reference, else the first that can.
 *
 * @param session - The editing session.
 * @param context - The names, from `nameContextOf`.
 * @returns The form's starting value.
 */
export function choiceDraftOf(session: MatchEditorSession, context: NameContext): ChoiceDraft {
  const targets = choiceTargetsOf(session);
  const focus = session.focus;
  const target =
    focus !== null && (targets as readonly string[]).includes(focus)
      ? (focus as ReferenceField)
      : (targets[0] ?? 'replace');
  return { name: suggestedName('choice', context), values: '', target };
} // End of function choiceDraftOf()

/**
 * The values one text area holds, or why they cannot be used: one value per
 * line; a single final line break is the end of the last value, not an empty
 * one.
 *
 * @param text - The text area's value.
 * @returns The values, or the problem.
 */
export function choiceValuesOf(
  text: string
): { readonly values: readonly string[] } | { readonly problem: ChoiceProblem } {
  if (text.includes('\r')) {
    return { problem: 'carriageReturn' };
  }
  const lines = text.split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  if (lines.length === 1 && lines[0] === '') {
    return { problem: 'noValues' };
  }
  if (lines.some((line) => line === '')) {
    return { problem: 'emptyValue' };
  }
  return { values: lines };
} // End of function choiceValuesOf()

/**
 * The closed description a **Choice** form asks for: a `choice` variable with
 * its `values`, no `inject_vars`, no `depends_on` and no extra parameter.
 *
 * @param draft - The form.
 * @returns The description, or the problem with its values.
 */
export function choiceVariableOf(
  draft: ChoiceDraft
): { readonly variable: NewVariable } | { readonly problem: ChoiceProblem } {
  const values = choiceValuesOf(draft.values);
  if ('problem' in values) {
    return values;
  }
  return {
    variable: {
      name: draft.name,
      params: { Choice: { values: [...values.values] } },
      inject_vars: null,
      depends_on: null,
      extra_params: []
    }
  };
} // End of function choiceVariableOf()

/** What the **Choice** form draws beside its controls. */
export interface ChoiceInsertionView {
  /** The content keys offered as targets. */
  readonly targets: readonly ReferenceField[];
  /**
   * The name check's verdict — under an open scope `available` carries
   * `scope: 'open'`, which reads "available among visible names" (ruling 20).
   */
  readonly verdict: NameVerdict;
  /** Why the values or the target cannot be used, or `null`. */
  readonly problem: ChoiceProblem | null;
  /** Why no variable can be added now (structure or addition), or `null`. */
  readonly withheld: AdditionWithheld;
  /** Whether *Insert* would draft it. */
  readonly canInsert: boolean;
}

/**
 * Why no new variable can be drafted now, whatever a form holds, or `null`.
 */
export type AdditionWithheld =
  | { readonly kind: 'structure'; readonly reason: VariableStructureRefusal }
  | { readonly kind: 'addition'; readonly reason: VariableAdditionRefusal }
  | { readonly kind: 'notEditable' }
  | null;

/**
 * Why no new variable can be drafted now, whatever a form holds: the variables
 * accept no change, the structure grant is refused (R36), or the addition is.
 * Shared by the Choice form and `./variableKinds.ts`'s *Add a variable* form.
 *
 * @param session - The editing session.
 * @param grant - The structure grant.
 * @returns The reason, or `null`.
 */
export function additionWithheldOf(session: MatchEditorSession, grant: VariableStructureGrant): AdditionWithheld {
  const addition = variableAdditionRefusal(
    session.baseline.variables,
    capturedVariables(session.draft.value.variables)
  );
  return !isVariablesEditable(session)
    ? { kind: 'notEditable' }
    : grant.kind === 'refused'
      ? { kind: 'structure', reason: grant.reason }
      : addition !== null
        ? { kind: 'addition', reason: addition }
        : null;
} // End of function additionWithheldOf()

/**
 * What the **Choice** form says about its current value.
 *
 * @param session - The editing session.
 * @param context - The names, from `nameContextOf`.
 * @param grant - The structure grant, from the view's read.
 * @param draft - The form.
 * @returns The view.
 */
export function choiceInsertionViewOf(
  session: MatchEditorSession,
  context: NameContext,
  grant: VariableStructureGrant,
  draft: ChoiceDraft
): ChoiceInsertionView {
  const targets = choiceTargetsOf(session);
  const verdict = nameVerdictOf(draft.name, context, true);
  const described = choiceVariableOf(draft);
  const problem: ChoiceProblem | null = !targets.includes(draft.target)
    ? 'noTarget'
    : 'problem' in described
      ? described.problem
      : null;
  const withheld = additionWithheldOf(session, grant);
  return {
    targets,
    verdict,
    problem,
    withheld,
    canInsert: withheld === null && problem === null && verdict.kind === 'available'
  };
} // End of function choiceInsertionViewOf()

/** What pressing *Insert* on the **Choice** form did. */
export type ChoiceOutcome =
  | InsertOutcome
  | {
      /** The form's values or target could not be used; nothing was drafted. */
      readonly kind: 'problem';
      /** The same session. */
      readonly session: MatchEditorSession;
      /** Why. */
      readonly problem: ChoiceProblem;
    };

/**
 * *Insert* on the **Choice** form: `{{name}}` in place of the target's
 * selection and the new `choice` variable at the end of `vars`, as **one**
 * history step and one save (`insertVariable` in `./variableInsertion.ts`, which
 * checks the grant, the addition, the name and every text).
 *
 * @param session - The editing session.
 * @param grant - The structure grant, minted from a read taken at the press.
 * @param context - The names, from `nameContextOf` at the press.
 * @param draft - The form.
 * @param selection - The target box's selection, in UTF-16 code units; a
 *   non-integer is the end of the text.
 * @returns What happened.
 */
export function insertChoice(
  session: MatchEditorSession,
  grant: VariableStructureGrant,
  context: NameContext,
  draft: ChoiceDraft,
  selection: TextSelection
): ChoiceOutcome {
  if (!choiceTargetsOf(session).includes(draft.target)) {
    return { kind: 'problem', session, problem: 'noTarget' };
  }
  const described = choiceVariableOf(draft);
  if ('problem' in described) {
    return { kind: 'problem', session, problem: described.problem };
  }
  return insertVariable(session, grant, context, {
    field: draft.target,
    selection,
    variable: described.variable
  });
} // End of function insertChoice()

// ---------------------------------------------------------------------------
// Sentences: codes to keys
// ---------------------------------------------------------------------------

/**
 * The dictionary key holding the sentence for the analysis's state.
 *
 * @param state - The state.
 * @returns The key.
 */
export function analysisStateKey(state: AnalysisState): TranslationKey {
  switch (state) {
    case 'reading':
      return 'browser.variableGroup.analysis.reading';
    case 'current':
      return 'browser.variableGroup.analysis.current';
    case 'unavailable':
      return 'browser.variableGroup.analysis.unavailable';
    case 'outOfStep':
      return 'browser.variableGroup.analysis.outOfStep';
  }
} // End of function analysisStateKey()

/**
 * The dictionary key holding the marker for what the draft does to a declaration.
 *
 * @param status - The status.
 * @returns The key, or `null` for `file`, which draws no marker.
 */
export function declarationStatusKey(status: DeclarationStatus): TranslationKey | null {
  switch (status) {
    case 'file':
      return null;
    case 'edited':
      return 'browser.variableGroup.status.edited';
    case 'removed':
      return 'browser.variableGroup.status.removed';
    case 'added':
      return 'browser.variableGroup.status.added';
  }
} // End of function declarationStatusKey()

/**
 * The dictionary key holding the label of one reorder choice. `after` takes the
 * anchor's name as `{name}`.
 *
 * @param label - Which placement.
 * @returns The key.
 */
export function moveChoiceKey(label: MoveChoiceView['label']): TranslationKey {
  switch (label) {
    case 'front':
      return 'browser.variableGroup.move.front';
    case 'after':
      return 'browser.variableGroup.move.after';
    case 'end':
      return 'browser.variableGroup.move.end';
  }
} // End of function moveChoiceKey()

/**
 * The dictionary key holding one **Choice** problem's sentence.
 *
 * @param problem - The problem.
 * @returns The key.
 */
export function choiceProblemKey(problem: ChoiceProblem): TranslationKey {
  switch (problem) {
    case 'noTarget':
      return 'browser.variableGroup.choice.noTarget';
    case 'noValues':
      return 'browser.variableGroup.choice.noValues';
    case 'emptyValue':
      return 'browser.variableGroup.choice.emptyValue';
    case 'carriageReturn':
      return 'browser.variableGroup.choice.carriageReturn';
  }
} // End of function choiceProblemKey()
