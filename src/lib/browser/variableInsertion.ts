/**
 * The compound *Insert* action and the name rules — Phase 4-9.
 *
 * **No component and no screen** (`./matchEditor.ts`'s header says why). Steps
 * 4-11 and 4-15 draw the popovers; this module decides what one confirmation
 * does and whether a name may be used.
 *
 * ## One confirmation, one undoable action
 *
 * The consult's Q5 and ruling 20 of `docs/decisions/4-split-notes.md`: an
 * *Insert* confirmation is **one** undoable editor action holding three things —
 * the content key's text with `{{name}}` put in place of the selection, the new
 * variable's closed description, and the name both use. The name is not passed
 * twice: the reference is built from the description's own `name`, so the two
 * cannot disagree. It lands through `recordCompoundChange` in `./matchEditor.ts`,
 * one `editDraft`, so one undo takes back both halves, and one save sends both
 * (`MatchDraft.replace` beside one `InsertVariable` intent). When the snippet has
 * no `vars`, Rust writes the whole `vars` subtree in the same batch (4-4).
 *
 * It **never saves**: nothing here calls a command.
 *
 * ## Names
 *
 * {@link nameVerdictOf} checks a name against every name this snippet can see —
 * its variables (including a name the draft renamed or removed, which Rust still
 * refuses to repeat), the draft's new variables, the regex trigger's named
 * captures, the file's global variables and the name espanso synthesizes for a
 * shorthand form (`form1`). **Under an open scope it says "available among
 * visible names", never "collision-free"** (ruling 20, `IMPLEMENTATION_PLAN.md`
 * override 4): a file that imports others, or a name that could not be read,
 * leaves names this application cannot see. The scope is the Rust analysis's
 * (`AnalysisSummary.scope_closed`); with no analysis at hand it is open.
 *
 * A name inserted as a `{{reference}}` must also be an identifier of the
 * supported placeholder subset (`[A-Za-z_][A-Za-z0-9_]*`, ruling 16), because a
 * reference the analysis cannot read would be inserted text nobody can check.
 * That is this application's rule, not a claim about which names espanso
 * accepts.
 */

import type { TranslationKey } from '../i18n/dictionaries';
import type { AnalysisSummary, DocumentView, NewVariable } from '../ipc/types';
import {
  isFieldEditable,
  isVariablesEditable,
  recordCompoundChange,
  type MatchBuffers,
  type MatchEditorSession,
  type TextSelection
} from './matchEditor';
import {
  capturedVariables,
  grantCovers,
  variableAdditionRefusal,
  variableAdditionRefusalKey,
  variableMoveRefusalKey,
  variableTextsOf,
  withVariableAdded,
  type VariableAdditionRefusal,
  type VariableStructureGrant,
  type VariableStructureRefusal
} from './variableEditor';

/**
 * The content keys a `{{reference}}` is inserted into: the three bodies whose
 * references the Rust analysis counts (`Usage.body`). `image_path` and the
 * shorthand `form` layout are not offered — a layout's placeholders are `[[…]]`,
 * put there by *Add field* (`addFormField` in `./matchEditor.ts`, Phase 4-10).
 */
export type ReferenceField = 'replace' | 'markdown' | 'html';

/** The three, in `EDITABLE_FIELDS` order. */
export const REFERENCE_FIELDS: readonly ReferenceField[] = ['replace', 'markdown', 'html'];

/**
 * Every name a new variable's name is checked against, gathered once.
 *
 * Plain arrays of decoded text; nothing here is a sentence.
 */
export interface NameContext {
  /** Every existing variable's name, as the file has it and as the draft renames it. */
  readonly locals: readonly string[];
  /** The draft's new variables' names. */
  readonly additions: readonly string[];
  /** The regex trigger's named captures. */
  readonly captures: readonly string[];
  /** The file's `global_vars` names. */
  readonly globals: readonly string[];
  /** Names espanso synthesizes that a variable must not take (`form1`). */
  readonly synthesized: readonly string[];
  /** Whether the set of visible names is closed (the Rust analysis's answer). */
  readonly scopeClosed: boolean;
}

/**
 * Gathers the names one session's new variable is checked against.
 *
 * **One read of each input**: the session's baseline and draft, the analysis the
 * caller holds for this snippet (`match_authoring_snapshot`'s or a candidate's),
 * and the file's projection for its `global_vars`. An absent analysis leaves the
 * scope open and the captures unknown, which is the honest answer.
 *
 * @param session - The editing session.
 * @param analysis - The snippet's analysis, or `null` when none is at hand.
 * @param document - The file's projection, or `null`.
 * @returns The context.
 */
export function nameContextOf(
  session: MatchEditorSession,
  analysis: AnalysisSummary | null,
  document: DocumentView | null
): NameContext {
  const baseline = session.baseline;
  const drafted = capturedVariables(session.draft.value.variables);
  const locals = new Set<string>();
  baseline.variables.rows.forEach((row, index) => {
    if (row.name.present) {
      locals.add(row.name.value);
    }
    const box = drafted.rows[index];
    if (box !== undefined && box.name.text !== '') {
      locals.add(box.name.text);
    }
  }); // End of the walk over the existing variables
  const shorthandForm = baseline.form.present || session.draft.value.form.text !== '';
  return {
    locals: [...locals],
    additions: drafted.added.map((one) => one.variable.name),
    captures: analysis === null ? [] : [...analysis.captures],
    globals:
      document === null
        ? []
        : document.global_vars.flatMap((variable) => (variable.name === null ? [] : [variable.name.text])),
    synthesized: shorthandForm ? ['form1'] : [],
    scopeClosed: analysis !== null && analysis.scope_closed
  };
} // End of function nameContextOf()

/**
 * Why a name cannot be used — a code, never a sentence ({@link nameRefusalKey}).
 */
export type NameRefusal =
  /** The name is empty. */
  | 'empty'
  /** A name inserted as a reference is not an identifier of the supported subset. */
  | 'notAnIdentifier'
  /** An existing variable has it, or had it before the draft renamed or removed it. */
  | 'takenByLocal'
  /** A new variable of the draft has it. */
  | 'takenByAddition'
  /** A named capture of the regex trigger has it. */
  | 'takenByCapture'
  /** A global variable of the file has it. */
  | 'takenByGlobal'
  /** espanso synthesizes it (`form1` for a shorthand form). */
  | 'takenBySynthesized';

/**
 * What a name check answered.
 *
 * `available` carries the scope, because the two are different sentences: under
 * a closed scope no visible name uses it, under an open one it is available among
 * visible names only.
 */
export type NameVerdict =
  | {
      /** The name may be used. */
      readonly kind: 'available';
      /** Whether that is a claim about every name, or about the visible ones. */
      readonly scope: 'closed' | 'open';
    }
  | {
      /** It may not. */
      readonly kind: 'refused';
      /** Why. */
      readonly reason: NameRefusal;
    };

/** The supported placeholder subset's identifier (ruling 16). */
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Checks one name against a context.
 *
 * @param name - The proposed name, as decoded text.
 * @param context - The names it must not repeat.
 * @param asReference - Whether it will be inserted as a `{{reference}}`, which
 *   also requires an identifier.
 * @returns The verdict.
 */
export function nameVerdictOf(name: string, context: NameContext, asReference: boolean): NameVerdict {
  if (name === '') {
    return { kind: 'refused', reason: 'empty' };
  }
  if ((asReference && !IDENTIFIER.test(name)) || name.includes('\r') || name.includes('\n')) {
    return { kind: 'refused', reason: 'notAnIdentifier' };
  }
  const taken: readonly (readonly [readonly string[], NameRefusal])[] = [
    [context.locals, 'takenByLocal'],
    [context.additions, 'takenByAddition'],
    [context.captures, 'takenByCapture'],
    [context.globals, 'takenByGlobal'],
    [context.synthesized, 'takenBySynthesized']
  ];
  for (const [names, reason] of taken) {
    if (names.includes(name)) {
      return { kind: 'refused', reason };
    }
  } // End of the loop over the five name sources
  return { kind: 'available', scope: context.scopeClosed ? 'closed' : 'open' };
} // End of function nameVerdictOf()

/**
 * A name built from a stem that the context does not refuse: the stem itself,
 * then the stem followed by 2, 3 and so on. A stem that is not an identifier is
 * reduced to one (`var` when nothing is left). **Available is the context's
 * claim**: under an open scope it is available among visible names only.
 *
 * @param stem - The wanted name, usually the kind's word (`choice`).
 * @param context - The names it must not repeat.
 * @returns The first name {@link nameVerdictOf} accepts as a reference.
 */
export function suggestedName(stem: string, context: NameContext): string {
  const cleaned = stem.replace(/[^A-Za-z0-9_]/g, '').replace(/^[0-9]+/, '');
  const base = cleaned === '' ? 'var' : cleaned;
  if (nameVerdictOf(base, context, true).kind === 'available') {
    return base;
  }
  let suffix = 2;
  while (nameVerdictOf(`${base}${suffix}`, context, true).kind !== 'available') {
    suffix += 1;
  } // End of the loop over numbered candidates
  return `${base}${suffix}`;
} // End of function suggestedName()

/**
 * Why an *Insert* or an *Add variable* did nothing — a code with its operand.
 */
export type InsertRefusal =
  | {
      /** The content key does not accept changes now. */
      readonly kind: 'fieldNotEditable';
    }
  | {
      /** The structure grant does not cover this snippet (R36, R37). */
      readonly kind: 'structure';
      /** The grant's own reason. */
      readonly reason: VariableStructureRefusal;
    }
  | {
      /** A new variable cannot be added to this draft. */
      readonly kind: 'addition';
      /** Why. */
      readonly reason: VariableAdditionRefusal;
    }
  | {
      /** The name cannot be used. */
      readonly kind: 'name';
      /** Why. */
      readonly reason: NameRefusal;
    }
  | {
      /**
       * A text of the new variable holds a carriage return, or a one-line text
       * a line feed — which no control here can hold (`CLAUDE.md` section 6).
       */
      readonly kind: 'unreadableText';
    };

/** What an *Insert* or an *Add variable* did. */
export type InsertOutcome =
  | {
      /** Drafted, as one history step. */
      readonly kind: 'inserted';
      /** The session holding it. */
      readonly session: MatchEditorSession;
      /**
       * Where the caret goes: just after the inserted reference, in UTF-16 code
       * units of the content key's new text. For an *Add variable* with no
       * content key, the empty selection at 0.
       */
      readonly selection: TextSelection;
      /** The name check's verdict, for the sentence beside the result. */
      readonly verdict: NameVerdict;
    }
  | {
      /** Nothing was drafted. */
      readonly kind: 'refused';
      /** The same session. */
      readonly session: MatchEditorSession;
      /** Why. */
      readonly refusal: InsertRefusal;
    };

/**
 * A position clamped into a text, or the text's end when it is not an integer.
 *
 * @param position - What the control reported.
 * @param length - The text's length in code units.
 * @returns A usable index.
 */
function clamped(position: number, length: number): number {
  if (!Number.isInteger(position)) {
    return length;
  }
  return Math.min(Math.max(position, 0), length);
} // End of function clamped()

/**
 * Whether a new variable's texts could pass through this window's controls.
 *
 * @param variable - The closed description.
 * @returns `true` when one of its texts could not.
 */
function unreadableVariable(variable: NewVariable): boolean {
  const texts = variableTextsOf([], [{ InsertVariable: { at: { End: {} }, variable } }]);
  return (
    texts.oneLine.some((text) => text.includes('\r') || text.includes('\n')) ||
    texts.multiLine.some((text) => text.includes('\r'))
  );
} // End of function unreadableVariable()

/**
 * The checks an *Insert* and an *Add variable* share, in order: the grant, the
 * addition, the name, the texts.
 *
 * @param session - The session being edited.
 * @param grant - The structure grant, from one read of the window.
 * @param context - The names, from {@link nameContextOf}.
 * @param variable - The closed description.
 * @param asReference - Whether the name is inserted as a reference.
 * @returns The refusal, or the name's verdict.
 */
function admission(
  session: MatchEditorSession,
  grant: VariableStructureGrant,
  context: NameContext,
  variable: NewVariable,
  asReference: boolean
): { readonly refusal: InsertRefusal } | { readonly verdict: NameVerdict } {
  if (!isVariablesEditable(session)) {
    return { refusal: { kind: 'fieldNotEditable' } };
  }
  if (!grantCovers(grant, session.match)) {
    return {
      refusal: { kind: 'structure', reason: grant.kind === 'refused' ? grant.reason : 'notInDocument' }
    };
  }
  const addition = variableAdditionRefusal(
    session.baseline.variables,
    capturedVariables(session.draft.value.variables)
  );
  if (addition !== null) {
    return { refusal: { kind: 'addition', reason: addition } };
  }
  const verdict = nameVerdictOf(variable.name, context, asReference);
  if (verdict.kind === 'refused') {
    return { refusal: { kind: 'name', reason: verdict.reason } };
  }
  if (unreadableVariable(variable)) {
    return { refusal: { kind: 'unreadableText' } };
  }
  return { verdict };
} // End of function admission()

/**
 * *Insert* — Phase 4-9's compound action: `{{name}}` in place of the selection
 * in one content key, and the new variable at the end of `vars`, as **one**
 * history step. Refused, with the same session, when the key does not accept
 * changes, the grant does not cover this snippet, a new variable cannot be added,
 * the name is refused, or a text could not pass through a control.
 *
 * **The reference is built from the description's own name**, so the name is one
 * value shared by both halves. The body is read once.
 *
 * @param session - The session being edited.
 * @param grant - The structure grant, minted from one read of the window
 *   (`variableStructureGrantOf` in `./variableEditor.ts`).
 * @param context - The names, from {@link nameContextOf}.
 * @param request - The content key, its control's selection in UTF-16 code
 *   units, and the new variable.
 * @returns What happened.
 */
export function insertVariable(
  session: MatchEditorSession,
  grant: VariableStructureGrant,
  context: NameContext,
  request: {
    readonly field: ReferenceField;
    readonly selection: TextSelection;
    readonly variable: NewVariable;
  }
): InsertOutcome {
  const { field, selection } = request;
  const variable: NewVariable = JSON.parse(JSON.stringify(request.variable));
  if (!isFieldEditable(session, field)) {
    return { kind: 'refused', session, refusal: { kind: 'fieldNotEditable' } };
  }
  const admitted = admission(session, grant, context, variable, true);
  if ('refusal' in admitted) {
    return { kind: 'refused', session, refusal: admitted.refusal };
  }
  const buffers = session.draft.value;
  const text = buffers[field].text;
  const first = clamped(selection.start, text.length);
  const second = clamped(selection.end, text.length);
  const start = Math.min(first, second);
  const end = Math.max(first, second);
  const reference = `{{${variable.name}}}`;
  const variables = withVariableAdded(
    session.baseline.variables,
    capturedVariables(buffers.variables),
    variable,
    field
  );
  if (variables === null) {
    return { kind: 'refused', session, refusal: { kind: 'addition', reason: 'additionPending' } };
  }
  const next: MatchBuffers = {
    ...buffers,
    [field]: { text: `${text.slice(0, start)}${reference}${text.slice(end)}`, removed: false },
    variables
  };
  const after = recordCompoundChange(session, next, field);
  const caret = start + reference.length;
  return { kind: 'inserted', session: after, selection: { start: caret, end: caret }, verdict: admitted.verdict };
} // End of function insertVariable()

/**
 * *Add variable* — a new variable with no reference inserted anywhere (Echo is
 * authored this way, ruling 20). The same checks as {@link insertVariable} but the
 * identifier rule, which is about a reference; one history step.
 *
 * @param session - The session being edited.
 * @param grant - The structure grant, from one read of the window.
 * @param context - The names, from {@link nameContextOf}.
 * @param variable - The closed description.
 * @returns What happened.
 */
export function addVariable(
  session: MatchEditorSession,
  grant: VariableStructureGrant,
  context: NameContext,
  variable: NewVariable
): InsertOutcome {
  const described: NewVariable = JSON.parse(JSON.stringify(variable));
  const admitted = admission(session, grant, context, described, false);
  if ('refusal' in admitted) {
    return { kind: 'refused', session, refusal: admitted.refusal };
  }
  const buffers = session.draft.value;
  const variables = withVariableAdded(
    session.baseline.variables,
    capturedVariables(buffers.variables),
    described,
    null
  );
  if (variables === null) {
    return { kind: 'refused', session, refusal: { kind: 'addition', reason: 'additionPending' } };
  }
  const after = recordCompoundChange(session, { ...buffers, variables }, session.focus ?? 'replace');
  return { kind: 'inserted', session: after, selection: { start: 0, end: 0 }, verdict: admitted.verdict };
} // End of function addVariable()

/**
 * The dictionary key holding one name verdict's sentence.
 *
 * @param verdict - What {@link nameVerdictOf} answered.
 * @returns The key.
 */
export function nameVerdictKey(verdict: NameVerdict): TranslationKey {
  if (verdict.kind === 'available') {
    return verdict.scope === 'closed'
      ? 'browser.variableEditor.name.available'
      : 'browser.variableEditor.name.availableAmongVisibleNames';
  }
  return nameRefusalKey(verdict.reason);
} // End of function nameVerdictKey()

/**
 * The dictionary key holding one name refusal's sentence.
 *
 * @param reason - Why the name cannot be used.
 * @returns The key.
 */
export function nameRefusalKey(reason: NameRefusal): TranslationKey {
  switch (reason) {
    case 'empty':
      return 'browser.variableEditor.name.empty';
    case 'notAnIdentifier':
      return 'browser.variableEditor.name.notAnIdentifier';
    case 'takenByLocal':
      return 'browser.variableEditor.name.takenByLocal';
    case 'takenByAddition':
      return 'browser.variableEditor.name.takenByAddition';
    case 'takenByCapture':
      return 'browser.variableEditor.name.takenByCapture';
    case 'takenByGlobal':
      return 'browser.variableEditor.name.takenByGlobal';
    case 'takenBySynthesized':
      return 'browser.variableEditor.name.takenBySynthesized';
  }
} // End of function nameRefusalKey()

/**
 * The dictionary key holding one insertion refusal's sentence: the nested
 * reason's own sentence for the three that carry one.
 *
 * @param refusal - Why the action did nothing.
 * @returns The key.
 */
export function insertRefusalKey(refusal: InsertRefusal): TranslationKey {
  switch (refusal.kind) {
    case 'fieldNotEditable':
      return 'browser.variableEditor.insert.fieldNotEditable';
    case 'structure':
      return variableMoveRefusalKey(refusal.reason);
    case 'addition':
      return variableAdditionRefusalKey(refusal.reason);
    case 'name':
      return nameRefusalKey(refusal.reason);
    case 'unreadableText':
      return 'browser.variableEditor.insert.unreadableText';
  }
} // End of function insertRefusalKey()
