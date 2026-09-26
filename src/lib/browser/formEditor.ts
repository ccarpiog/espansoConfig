/**
 * The form editor's model — Phase 4-10: one snippet's forms, shorthand and
 * verbose, drafted beside the seventeen scalar fields and the variables, as a
 * value.
 *
 * **No component and no screen**, for `./matchEditor.ts`'s standing reason: only
 * the files that opt into jsdom mount a Svelte component in a test. Step 4-12
 * draws what this module decides.
 *
 * ## One form model, two adapters
 *
 * Rulings 15–19 of `docs/decisions/4-split-notes.md`. A form is a **layout** — the
 * text whose `[[name]]` placeholders are its fields — and a set of **definitions**,
 * one per field name, each an option mapping. Espanso writes that pair in two
 * shapes, and this module reads both into one {@link FormBaseline}:
 *
 * - the **shorthand** adapter: the match's own `form` key is the layout and its
 *   `form_fields` the definitions. **The layout is the existing `form` content
 *   buffer** of `./matchEditor.ts` (`MatchBuffers.form`) — this module holds no
 *   second draft of that scalar ({@link FormBuffer.layout} is `null` for it), so
 *   the one box, its one history and its one save path stay the match editor's;
 * - the **verbose** adapter: a `type: form` variable's `params.layout` is the
 *   layout and its `params.fields` the definitions. The layout is one entry of an
 *   open `params` mapping, which no other model drafts, so its box lives here.
 *
 * Both write their definitions with the same wire intent (`FormFieldIntent`),
 * carried by `MatchDraft.form_intents` for the shorthand shape and by
 * `VariableDraft.field_intents` for the verbose one; **nothing converts one shape
 * into the other** (ruling 17).
 *
 * ## The rules it keeps
 *
 * - **The layout is authoritative for occurrences; definitions are authored
 *   independently** (ruling 15). A layout edit — typing in the box — changes the
 *   displayed rows ({@link formRowsOf}) and **never inserts, deletes or renames a
 *   definition**: no function here derives a definition from layout text. *Add
 *   field* ({@link withDefinitionAdded}, composed by `addFormField` in
 *   `./matchEditor.ts`) is the explicit compound action: `[[name]]` put into the
 *   layout and a new definition, one history step. Removing a definition is its
 *   own explicit action and leaves every occurrence in the layout where it is.
 * - **Repeated placeholders share one row**; a definition with no occurrence is
 *   a **definition-only row** with an advisory, never hidden and never deleted.
 * - **Absent, present and removed are three states** for every option box, as for
 *   every scalar field: an option the definition does not hold, left blank, is
 *   `'Unchanged'`; typed into, it is inserted; a present option retyped to its own
 *   value is `'Unchanged'`.
 * - **Every text a box drafts refuses a carriage return**, and a one-line box a
 *   line feed, at load (eligibility), at edit (the transitions) and at send
 *   ({@link formsWriteUnreadable}, which `beginSave` asks because `MatchBuffers`
 *   carries no brand). A layout holding a real `\r` is read-only (ruling 19).
 * - **Whole-container reapply** (ruling 22): a drafted shorthand form reapplies
 *   only over the same `form_fields` container (the Rust fingerprint), a drafted
 *   verbose form only over the same `vars` container; anything else collides the
 *   whole container. Nothing is followed by index or by name across revisions.
 *
 * ## The placeholder parser is a transcription
 *
 * {@link layoutPiecesOf} is a transcription of `PlaceholderLayout::parse` in
 * `crates/espansoconfig-core/src/analysis/placeholder.rs` — the **named supported
 * subset** `[[identifier]]` (ruling 16), never espanso's grammar. It runs here
 * because rows follow every keystroke of a draft Rust has not seen; the Rust
 * analysis on the wire (`LayoutSummary`) stays the authority for a saved file.
 * Nothing forces the two to agree: the test file pins the transcription on the
 * Rust suite's own samples.
 *
 * ## What no type here forces
 *
 * That a caller hands the structure transitions a grant minted from the
 * projections the window holds **now** (R37) — the grant is
 * `VariableStructureGrant` of `./variableEditor.ts`, shared on purpose because
 * R36 covers variable and form structural actions alike (ruling 23).
 */

import type { TranslationKey } from '../i18n/dictionaries';
import type {
  ContainerBaseline,
  DraftField,
  EntryDraft,
  FieldView,
  FormFieldDraft,
  FormFieldIntent,
  FormFieldShape,
  FormOptions,
  MappingPresence,
  MatchDraft,
  MatchView,
  NewFormField,
  NewParam,
  ScalarView,
  VariableView
} from '../ipc/types';
import type { RetainedDraftField, RetainedLabel } from './saveOutcome';
import {
  variableMoveRefusalKey,
  type VariablesBaseline,
  type VariablesBuffer,
  type VariableStructureRefusal
} from './variableEditor';

// ---------------------------------------------------------------------------
// The layout: the named supported placeholder subset
// ---------------------------------------------------------------------------

/**
 * Why a region that opens with `[[` is not a supported placeholder — the three
 * reasons of Rust's `MalformedPlaceholder`.
 */
export type LayoutMalformation = 'empty' | 'invalidIdentifier' | 'unterminated';

/** One tile of a parsed layout; together the tiles reproduce the text exactly. */
export type LayoutPiece =
  | {
      /** Text that is not a placeholder and does not open one. */
      readonly kind: 'text';
      /** The text. */
      readonly text: string;
    }
  | {
      /** A supported `[[identifier]]`. */
      readonly kind: 'placeholder';
      /** The whole `[[identifier]]`, brackets included. */
      readonly text: string;
      /** The identifier. */
      readonly name: string;
    }
  | {
      /** A region that opens with `[[` and is not a supported placeholder. */
      readonly kind: 'malformed';
      /** The region. */
      readonly text: string;
      /** Why. */
      readonly reason: LayoutMalformation;
    };

/** The supported identifier spelling, `[A-Za-z_][A-Za-z0-9_]*` (ruling 16). */
const SUPPORTED_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Whether a text is an identifier of the supported spelling — Rust's
 * `is_supported_identifier`, transcribed.
 *
 * @param text - The candidate.
 * @returns `true` for `[A-Za-z_][A-Za-z0-9_]*`.
 */
export function isSupportedIdentifier(text: string): boolean {
  return SUPPORTED_IDENTIFIER.test(text);
} // End of function isSupportedIdentifier()

/**
 * A layout parsed into the named supported subset — a transcription of
 * `PlaceholderLayout::parse` (see the module header). Total: every text gives a
 * list of pieces whose texts concatenate back to it.
 *
 * Offsets here are UTF-16 code units of a JavaScript string the draft holds —
 * never a Rust `ByteSpan` — and every delimiter is ASCII, so cutting at them
 * cuts at the same characters Rust cuts at.
 *
 * @param text - The layout.
 * @returns The pieces, in text order.
 */
export function layoutPiecesOf(text: string): readonly LayoutPiece[] {
  const pieces: LayoutPiece[] = [];
  let textStart = 0;
  let at = 0;
  // The next `]]` and `[[` at or after a position, remembered across openers so
  // each search runs forward from where the last one stopped — Rust's
  // `NextDelimiter`, which the 4-7 review added because repeated unterminated
  // openers made the search quadratic.
  let closeAt: number | null = null;
  let reopenAt: number | null = null;
  /**
   * The first `delimiter` at or after `from`, reusing a cached answer that still lies ahead.
   *
   * @param cached - The last answer for this delimiter, `-1` for none left, or `null`.
   * @param delimiter - `]]` or `[[`.
   * @param from - Where to look from; never moves backwards.
   * @returns The position, or `-1`.
   */
  const next = (cached: number | null, delimiter: string, from: number): number =>
    cached !== null && (cached === -1 || cached >= from) ? cached : text.indexOf(delimiter, from);
  while (at + 1 < text.length) {
    if (!(text[at] === '[' && text[at + 1] === '[')) {
      at += 1;
      continue;
    }
    if (textStart < at) {
      pieces.push({ kind: 'text', text: text.slice(textStart, at) });
    }
    const innerStart = at + 2;
    const close = next(closeAt, ']]', innerStart);
    const reopen = next(reopenAt, '[[', innerStart);
    closeAt = close;
    reopenAt = reopen;
    let end: number;
    if (close !== -1 && (reopen === -1 || close < reopen)) {
      const inner = text.slice(innerStart, close);
      end = close + 2;
      const whole = text.slice(at, end);
      if (inner === '') {
        pieces.push({ kind: 'malformed', text: whole, reason: 'empty' });
      } else if (isSupportedIdentifier(inner)) {
        pieces.push({ kind: 'placeholder', text: whole, name: inner });
      } else {
        pieces.push({ kind: 'malformed', text: whole, reason: 'invalidIdentifier' });
      }
    } else {
      // No `]]`, or another `[[` first: only the opener is reported, and the
      // scan resumes after it.
      end = innerStart;
      pieces.push({ kind: 'malformed', text: text.slice(at, end), reason: 'unterminated' });
    }
    at = end;
    textStart = end;
  } // End of the loop over the layout's characters
  if (textStart < text.length) {
    pieces.push({ kind: 'text', text: text.slice(textStart) });
  }
  return pieces;
} // End of function layoutPiecesOf()

// ---------------------------------------------------------------------------
// The projection side
// ---------------------------------------------------------------------------

/** Which form of a snippet: its shorthand `form`, or one `type: form` variable. */
export type FormAddress =
  | {
      /** The match's own `form` + `form_fields`. */
      readonly kind: 'shorthand';
    }
  | {
      /** A verbose form: `vars[variable].params.layout` + `params.fields`. */
      readonly kind: 'verbose';
      /** The variable's position in `vars`. */
      readonly variable: number;
    };

/**
 * The four schema-known scalar options of one definition this editor drafts.
 * `values` (a list or a text) is not one of them: its items are 4-12's.
 */
export const FORM_OPTION_KEYS = ['type', 'default', 'multiline', 'trim_string_values'] as const;

/** One of {@link FORM_OPTION_KEYS}. */
export type FormOptionKey = (typeof FORM_OPTION_KEYS)[number];

/**
 * Whether an option's box is one line. `default` may hold a line feed (a
 * multi-line field's default); the other three are one-word settings.
 *
 * @param key - The option.
 * @returns `true` for a one-line box.
 */
export function isOneLineOption(key: FormOptionKey): boolean {
  return key !== 'default';
} // End of function isOneLineOption()

/**
 * The shape of a mapping, as a presence reports it: `absent`; `empty` (`{}`, a
 * flow mapping); `block`; `flow` with entries; `unsupported` (not a mapping).
 */
export type MappingShape = 'absent' | 'empty' | 'block' | 'flow' | 'unsupported';

/**
 * Why one option box or a verbose layout is not edited — a code, never a
 * sentence ({@link formFieldRefusalKey}). The first five share the match
 * editor's sentences.
 *
 * - `notInForm` — a verbose form holds no `layout`; this editor does not insert
 *   one (it edits the layout a form already has);
 * - `optionsNotABlockMapping` — the definition does not hold the option, and its
 *   options are not a block mapping, which Rust refuses to insert into
 *   (`FormFieldOptionsAreNotABlockMapping`).
 */
export type FormFieldRefusal =
  | 'notDecodable'
  | 'carriageReturn'
  | 'ownsNoBytes'
  | 'unmodelledShape'
  | 'lineBreak'
  | 'notInForm'
  | 'optionsNotABlockMapping';

/** Whether a box may be edited. */
export type FormFieldEligibility =
  | {
      /** It may be bound to a control. */
      readonly kind: 'editable';
    }
  | {
      /** It is shown and not edited. */
      readonly kind: 'readOnly';
      /** Why. */
      readonly reason: FormFieldRefusal;
    };

/** What the file held for one scalar a form box drafts. Not drafted. */
export interface FormScalarBaseline {
  /** Whether the key is held at all. */
  readonly present: boolean;
  /** The projected logical value, or `''` when absent. */
  readonly value: string;
  /**
   * The key's position in the projected mapping it lives in — the definition's
   * options, or the verbose form's `params` — or `null` when absent.
   */
  readonly index: number | null;
  /** Whether it may be edited, and why not. */
  readonly eligibility: FormFieldEligibility;
}

/** What the file held for one definition, by its position. Not drafted. */
export interface DefinitionBaseline {
  /** Its name — the decoded key — or `null` when the key could not be read. */
  readonly name: string | null;
  /** Its options' shape. */
  readonly optionsShape: MappingShape;
  /** Its options, projected, in source order; `[]` when not a mapping. */
  readonly options: readonly FieldView[];
  /** The four drafted scalar options. */
  readonly scalars: Readonly<Record<FormOptionKey, FormScalarBaseline>>;
}

/** What the file held for one form. Not drafted. */
export interface FormBaseline {
  /** Which form. */
  readonly address: FormAddress;
  /** A verbose form's variable name as written, for the retained rows; `null` for shorthand. */
  readonly variableName: string | null;
  /**
   * A verbose form's `params.layout`; **`null` for shorthand**, whose layout is
   * the match editor's `form` field baseline — the one draft of that scalar.
   */
  readonly layout: FormScalarBaseline | null;
  /** The definitions container's shape. */
  readonly definitionsShape: MappingShape;
  /** One row per definition, in source order. */
  readonly definitions: readonly DefinitionBaseline[];
  /**
   * The correspondence unit a reapply compares (ruling 22): the shorthand form's
   * `MatchView.form_fields_container`, or — for a verbose form, whose layout and
   * definitions live inside `vars` — `MatchView.vars_container`. Rust's cut;
   * nothing here can widen or check it.
   */
  readonly container: ContainerBaseline;
}

/** What the file held for every form of one snippet. Not drafted. */
export interface FormsBaseline {
  /** The shorthand form first, when the snippet has one, then each verbose form in `vars` order. */
  readonly forms: readonly FormBaseline[];
  /**
   * Whether a committed save changed a form or `vars` and no fresh projection has
   * been seeded since. While `true` nothing derives or drafts here: positions no
   * longer describe the file.
   */
  readonly reprojectionOwed: boolean;
}

/**
 * The shape a mapping presence reports.
 *
 * @param presence - A presence, or `null` for none.
 * @returns The shape.
 */
function mappingShapeOf(presence: MappingPresence | null): MappingShape {
  if (presence === null || 'Absent' in presence) {
    return 'absent';
  }
  if ('Empty' in presence) {
    return 'empty';
  }
  if ('Entries' in presence) {
    return presence.Entries.flow ? 'flow' : 'block';
  }
  return 'unsupported';
} // End of function mappingShapeOf()

/**
 * A plain, owned copy of projection data — a JSON round trip, for the reason
 * `ownedCopy` in `./variableEditor.ts` gives (Svelte `$state` proxies).
 *
 * @typeParam T - The data's type.
 * @param value - Projection data.
 * @returns A copy this module owns.
 */
function ownedCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
} // End of function ownedCopy()

/**
 * Every entry of a projected mapping whose decoded key is `key`, with its position.
 *
 * @param entries - The mapping's entries.
 * @param key - The key.
 * @returns The matching entries.
 */
function entriesNamed(
  entries: readonly FieldView[],
  key: string
): readonly { readonly entry: FieldView; readonly index: number }[] {
  const found: { entry: FieldView; index: number }[] = [];
  entries.forEach((entry, index) => {
    if (entry.key !== null && entry.key.decoded && entry.key.text === key) {
      found.push({ entry, index });
    }
  }); // End of the walk over the entries
  return found;
} // End of function entriesNamed()

/**
 * The eligibility of one present scalar a box drafts: `./matchEditor.ts`'s
 * order — decoded, a carriage return, a line feed in a one-line box, a zero-width
 * span.
 *
 * @param scalar - The scalar.
 * @param oneLine - Whether its box is one line.
 * @returns The verdict.
 */
function scalarEligibility(scalar: ScalarView, oneLine: boolean): FormFieldEligibility {
  if (!scalar.decoded) {
    return { kind: 'readOnly', reason: 'notDecodable' };
  }
  if (scalar.text.includes('\r')) {
    return { kind: 'readOnly', reason: 'carriageReturn' };
  }
  if (oneLine && scalar.text.includes('\n')) {
    return { kind: 'readOnly', reason: 'lineBreak' };
  }
  if (scalar.span.start === scalar.span.end) {
    return { kind: 'readOnly', reason: 'ownsNoBytes' };
  }
  return { kind: 'editable' };
} // End of function scalarEligibility()

/**
 * The baseline of one keyed scalar of a mapping — an option or a layout.
 *
 * @param entries - The mapping's entries.
 * @param key - The key.
 * @param oneLine - Whether its box is one line.
 * @param absent - The verdict for an absent key.
 * @returns The baseline.
 */
function keyedScalarBaseline(
  entries: readonly FieldView[],
  key: string,
  oneLine: boolean,
  absent: FormFieldEligibility
): FormScalarBaseline {
  const found = entriesNamed(entries, key);
  const only = found[0];
  if (only === undefined) {
    return { present: false, value: '', index: null, eligibility: absent };
  }
  if (found.length > 1 || !('Scalar' in only.entry.value)) {
    // A repeated key, or one holding a collection, an alias or an elided node:
    // which one a replacement would hit is not this editor's question.
    return {
      present: true,
      value: '',
      index: only.index,
      eligibility: { kind: 'readOnly', reason: 'unmodelledShape' }
    };
  }
  const scalar = only.entry.value.Scalar;
  return {
    present: true,
    value: scalar.text,
    index: only.index,
    eligibility: scalarEligibility(scalar, oneLine)
  };
} // End of function keyedScalarBaseline()

/**
 * One definition's baseline.
 *
 * @param entry - The definition's projected entry.
 * @param shape - Its projected container shape, when the projection gave one.
 * @returns The baseline.
 */
function definitionBaselineOf(entry: FieldView, shape: FormFieldShape | undefined): DefinitionBaseline {
  const options = 'Mapping' in entry.value ? entry.value.Mapping : [];
  const optionsShape: MappingShape =
    shape === undefined ? ('Mapping' in entry.value ? 'block' : 'unsupported') : mappingShapeOf(shape.options);
  const absent: FormFieldEligibility =
    optionsShape === 'block' ? { kind: 'editable' } : { kind: 'readOnly', reason: 'optionsNotABlockMapping' };
  const scalars = {} as Record<FormOptionKey, FormScalarBaseline>;
  for (const key of FORM_OPTION_KEYS) {
    scalars[key] = keyedScalarBaseline(options, key, isOneLineOption(key), absent);
  } // End of the loop over the drafted options
  return {
    name: entry.key !== null && entry.key.decoded ? entry.key.text : null,
    optionsShape,
    options,
    scalars
  };
} // End of function definitionBaselineOf()

/**
 * A verbose form's baseline, from its variable.
 *
 * @param variable - The `type: form` variable, owned.
 * @param index - Its position in `vars`.
 * @param container - The `vars` container.
 * @returns The baseline.
 */
function verboseBaselineOf(variable: VariableView, index: number, container: ContainerBaseline): FormBaseline {
  const fieldsEntry = entriesNamed(variable.params, 'fields');
  const only = fieldsEntry.length === 1 ? fieldsEntry[0] : undefined;
  const definitions =
    only !== undefined && 'Mapping' in only.entry.value
      ? only.entry.value.Mapping.map((entry, at) => definitionBaselineOf(entry, variable.field_shapes[at]))
      : [];
  return {
    address: { kind: 'verbose', variable: index },
    variableName: variable.name === null ? null : variable.name.text,
    layout: keyedScalarBaseline(variable.params, 'layout', false, { kind: 'readOnly', reason: 'notInForm' }),
    definitionsShape: fieldsEntry.length > 1 ? 'unsupported' : mappingShapeOf(variable.fields_presence),
    definitions,
    container
  };
} // End of function verboseBaselineOf()

/**
 * What the file holds for every form of one snippet.
 *
 * The shorthand form exists when the snippet holds a `form` key or a
 * `form_fields`; a verbose form for every variable whose `type` names `form`.
 *
 * @param match - The snippet's projection.
 * @returns The baseline. The caller freezes it with the rest of the baseline.
 */
export function formsBaselineOf(match: MatchView): FormsBaseline {
  const view = ownedCopy(match);
  const forms: FormBaseline[] = [];
  if (view.content.form !== null || !('Absent' in view.form_fields_presence)) {
    forms.push({
      address: { kind: 'shorthand' },
      variableName: null,
      layout: null,
      definitionsShape: mappingShapeOf(view.form_fields_presence),
      definitions: view.form_fields.map((entry, at) => definitionBaselineOf(entry, view.form_field_shapes[at])),
      container: view.form_fields_container
    });
  }
  view.vars.forEach((variable, index) => {
    if (variable.kind === 'Form') {
      forms.push(verboseBaselineOf(variable, index, view.vars_container));
    }
  }); // End of the walk over the variables
  return { forms, reprojectionOwed: false };
} // End of function formsBaselineOf()

// ---------------------------------------------------------------------------
// The draft side
// ---------------------------------------------------------------------------

/** What one box holds. */
export interface FormTextBuffer {
  /** Whatever the box holds. Never a carriage return. */
  readonly text: string;
}

/** What the controls hold for one existing definition. */
export interface DefinitionBuffer {
  /** Whether it is drafted for removal; the boxes keep their text. */
  readonly removed: boolean;
  /** The four option boxes. */
  readonly options: Readonly<Record<FormOptionKey, FormTextBuffer>>;
}

/**
 * One new definition the draft adds — the closed description Rust writes, and
 * whether *Add field* put its `[[name]]` into the layout in the same action.
 */
export interface AddedDefinition {
  /** The closed description, written after the last definition that stays. */
  readonly field: NewFormField;
  /**
   * Whether the compound *Add field* inserted `[[name]]` into the layout. A
   * reapply keeps the two halves together for a shorthand form (the layout is the
   * `form` field, reapplied by the field walk); a verbose form's layout and
   * definitions share one container, so they are together by construction.
   */
  readonly placeholderInserted: boolean;
}

/** What the controls hold for one form. **The draft side.** */
export interface FormBuffer {
  /** A verbose form's layout box; **`null` for shorthand** (the `form` field is its box). */
  readonly layout: FormTextBuffer | null;
  /** One entry per baseline definition, by the same position. */
  readonly definitions: readonly DefinitionBuffer[];
  /** New definitions, in the order drafted. */
  readonly added: readonly AddedDefinition[];
}

/** What the controls hold for every form, by the baseline's positions. */
export interface FormsBuffer {
  /** One buffer per baseline form. */
  readonly forms: readonly FormBuffer[];
}

/**
 * One definition's starting buffer.
 *
 * @param definition - Its baseline.
 * @returns The buffer: every box holding the file's value.
 */
function definitionBufferOf(definition: DefinitionBaseline): DefinitionBuffer {
  const options = {} as Record<FormOptionKey, FormTextBuffer>;
  for (const key of FORM_OPTION_KEYS) {
    options[key] = { text: definition.scalars[key].value };
  } // End of the loop over the drafted options
  return { removed: false, options };
} // End of function definitionBufferOf()

/**
 * The buffer a session starts with: every box holding the file's value, nothing
 * removed and nothing added.
 *
 * @param baseline - What the file holds.
 * @returns The starting buffer.
 */
export function formsBufferOf(baseline: FormsBaseline): FormsBuffer {
  return {
    forms: baseline.forms.map((form) => ({
      layout: form.layout === null ? null : { text: form.layout.value },
      definitions: form.definitions.map(definitionBufferOf),
      added: []
    }))
  };
} // End of function formsBufferOf()

/**
 * The buffer copied into plain values, so it is read exactly once — the
 * check-and-spend rule of `CLAUDE.md` section 6.
 *
 * @param buffer - What the controls hold.
 * @returns A plain copy.
 */
export function capturedForms(buffer: FormsBuffer): FormsBuffer {
  return ownedCopy(buffer);
} // End of function capturedForms()

/**
 * The positions of `vars` whose verbose form this draft may not touch: every
 * variable drafted for removal, or all of them when the container is.
 *
 * @param variables - The variables baseline.
 * @param buffer - The variables buffer, captured once by the caller.
 * @returns The excluded positions.
 */
export function excludedVariablesOf(
  variables: VariablesBaseline,
  buffer: VariablesBuffer
): ReadonlySet<number> {
  const excluded = new Set<number>();
  variables.rows.forEach((_, index) => {
    if (buffer.removeAll || variables.reprojectionOwed || buffer.rows[index]?.removed === true) {
      excluded.add(index);
    }
  }); // End of the walk over the variables
  return excluded;
} // End of function excludedVariablesOf()

/**
 * Whether one form is out of this draft's reach: a verbose form of an excluded
 * variable.
 *
 * @param form - Its baseline.
 * @param excluded - {@link excludedVariablesOf}.
 * @returns `true` when nothing of it is drafted or sent.
 */
function outOfReach(form: FormBaseline, excluded: ReadonlySet<number>): boolean {
  return form.address.kind === 'verbose' && excluded.has(form.address.variable);
} // End of function outOfReach()

// ---------------------------------------------------------------------------
// Intents and the one derivation
// ---------------------------------------------------------------------------

/**
 * What one box's draft says should happen — `./matchEditor.ts`'s `fieldIntent`
 * rules with no removal: an ineligible scalar is `'Unchanged'`, an **absent**
 * key left blank is `'Unchanged'`, an absent key typed into is `Set` (an
 * insertion), a present value retyped to itself is `'Unchanged'`.
 *
 * @param baseline - What the file holds for it.
 * @param buffer - What its box holds.
 * @returns The intent.
 */
export function formScalarIntent(baseline: FormScalarBaseline, buffer: FormTextBuffer): DraftField<string> {
  if (baseline.eligibility.kind !== 'editable') {
    return 'Unchanged';
  }
  if (!baseline.present) {
    return buffer.text === '' ? 'Unchanged' : { Set: buffer.text };
  }
  return buffer.text === baseline.value ? 'Unchanged' : { Set: buffer.text };
} // End of function formScalarIntent()

/** An empty `FormOptions`: nothing written. */
const NO_OPTIONS: FormOptions = Object.freeze({
  type: null,
  default: null,
  multiline: null,
  values: null,
  trim_string_values: null,
  extra: []
});

/**
 * One existing definition's wire draft, or `null` when it drafts nothing: a
 * present option's rewrite is an `EntryDraft` by its position, an absent one's
 * text an inserted option.
 *
 * @param definition - The baseline.
 * @param buffer - Its boxes.
 * @param index - Its position.
 * @returns The draft, or `null`.
 */
function definitionDraftOf(
  definition: DefinitionBaseline,
  buffer: DefinitionBuffer,
  index: number
): FormFieldDraft | null {
  const options: EntryDraft[] = [];
  const inserted: Record<FormOptionKey, string | null> = {
    type: null,
    default: null,
    multiline: null,
    trim_string_values: null
  };
  for (const key of FORM_OPTION_KEYS) {
    const scalar = definition.scalars[key];
    const intent = formScalarIntent(scalar, buffer.options[key]);
    if (intent === 'Unchanged' || intent === 'Remove') {
      continue;
    }
    if (scalar.present && scalar.index !== null) {
      options.push({ index: scalar.index, value: intent, items: [] });
    } else {
      inserted[key] = intent.Set;
    }
  } // End of the loop over the drafted options
  const insertsAny = FORM_OPTION_KEYS.some((key) => inserted[key] !== null);
  if (options.length === 0 && !insertsAny) {
    return null;
  }
  options.sort((one, other) => one.index - other.index);
  return {
    index,
    options,
    insert_options: insertsAny ? { ...NO_OPTIONS, ...inserted } : NO_OPTIONS,
    values: []
  };
} // End of function definitionDraftOf()

/**
 * A verbose layout's wire draft: a `params` entry rewrite by its position, or
 * `null` when the draft says nothing (a shorthand form, an ineligible or an
 * unchanged layout).
 *
 * @param baseline - The layout's baseline, or `null` for shorthand.
 * @param buffer - Its box, or `null` for shorthand.
 * @returns The entry draft, or `null`.
 */
function layoutDraftOf(baseline: FormScalarBaseline | null, buffer: FormTextBuffer | null): EntryDraft | null {
  if (baseline === null || buffer === null || baseline.index === null) {
    return null;
  }
  const intent = formScalarIntent(baseline, buffer);
  return typeof intent === 'object' ? { index: baseline.index, value: intent, items: [] } : null;
} // End of function layoutDraftOf()

/** What one form asks of a save. */
export interface FormDerivation {
  /** Which form. */
  readonly address: FormAddress;
  /** A verbose layout rewrite as a `params` entry draft, or `null`. */
  readonly layout: EntryDraft | null;
  /** Drafted existing definitions — `form_fields` or a variable's `fields`. */
  readonly fields: readonly FormFieldDraft[];
  /** Removals then insertions — `form_intents` or a variable's `field_intents`. */
  readonly intents: readonly FormFieldIntent[];
}

/**
 * Why a drafted form cannot be sent as it stands — through `./matchEditor.ts`'s
 * `SaveWithheld`: every existing definition of one form is drafted for removal,
 * which Rust refuses (`FormFieldsWouldBeEmpty`) whether or not one is added.
 */
export type FormsProblem = 'formFieldsWouldBeEmpty';

/** What every drafted form asks of a save. */
export interface FormsDerivation {
  /** One entry per form that asks for anything, in baseline order. */
  readonly forms: readonly FormDerivation[];
  /** Why this cannot be sent, or `null`. */
  readonly problem: FormsProblem | null;
  /** Whether anything is asked at all. */
  readonly changed: boolean;
  /** Whether a verbose form asks for anything (it lives inside `vars`). */
  readonly verboseChanged: boolean;
}

/** A derivation that asks for nothing. */
const NOTHING_TO_FORMS: FormsDerivation = Object.freeze({
  forms: [],
  problem: null,
  changed: false,
  verboseChanged: false
});

/**
 * The one producer of every form intent the match editor sends.
 *
 * **Read once**: the caller hands a {@link capturedForms} copy. A verbose form of
 * a variable drafted for removal is out of reach and contributes nothing — its
 * boxes keep their text, and a restoration brings its edits back, as a removed
 * variable's own boxes do.
 *
 * @param baseline - What the file holds.
 * @param buffer - What the controls hold, captured once.
 * @param excluded - {@link excludedVariablesOf}, from the same captured read.
 * @returns The derivation.
 */
export function formsDerivationOf(
  baseline: FormsBaseline,
  buffer: FormsBuffer,
  excluded: ReadonlySet<number>
): FormsDerivation {
  if (baseline.reprojectionOwed) {
    return NOTHING_TO_FORMS;
  }
  const forms: FormDerivation[] = [];
  let problem: FormsProblem | null = null;
  baseline.forms.forEach((form, position) => {
    const drafted = buffer.forms[position];
    if (drafted === undefined || outOfReach(form, excluded)) {
      return;
    }
    const fields: FormFieldDraft[] = [];
    const intents: FormFieldIntent[] = [];
    form.definitions.forEach((definition, index) => {
      const box = drafted.definitions[index];
      if (box === undefined) {
        return;
      }
      if (box.removed) {
        intents.push({ RemoveField: { index } });
        return;
      }
      const draft = definitionDraftOf(definition, box, index);
      if (draft !== null) {
        fields.push(draft);
      }
    }); // End of the walk over the definitions
    for (const added of drafted.added) {
      intents.push({ InsertField: { after: null, field: added.field } });
    } // End of the loop over the new definitions
    const layout = layoutDraftOf(form.layout, drafted.layout);
    if (
      form.definitions.length > 0 &&
      form.definitions.every((_, index) => drafted.definitions[index]?.removed === true)
    ) {
      problem ??= 'formFieldsWouldBeEmpty';
    }
    if (layout !== null || fields.length > 0 || intents.length > 0) {
      forms.push({ address: form.address, layout, fields, intents });
    }
  }); // End of the walk over the forms
  return {
    forms,
    problem,
    changed: forms.length > 0,
    verboseChanged: forms.some((one) => one.address.kind === 'verbose')
  };
} // End of function formsDerivationOf()

/**
 * The wire's shorthand parts of a derivation.
 *
 * @param derived - The derivation.
 * @returns `MatchDraft.form_fields` and `MatchDraft.form_intents`.
 */
export function shorthandWireOf(derived: FormsDerivation): Pick<MatchDraft, 'form_fields' | 'form_intents'> {
  const shorthand = derived.forms.find((one) => one.address.kind === 'shorthand');
  return shorthand === undefined
    ? { form_fields: [], form_intents: [] }
    : { form_fields: shorthand.fields, form_intents: shorthand.intents };
} // End of function shorthandWireOf()

/**
 * `MatchDraft.vars` with every verbose form's parts merged in: a variable the
 * variable editor already drafts gains its `params`, `fields` and
 * `field_intents`; another gets a `VariableDraft` of its own whose three scalars
 * are `'Unchanged'`. Sorted by position.
 *
 * @param vars - The variable editor's drafts.
 * @param derived - The form derivation.
 * @returns The merged drafts.
 */
export function withVerboseForms(vars: MatchDraft['vars'], derived: FormsDerivation): MatchDraft['vars'] {
  const verbose = derived.forms.filter((one) => one.address.kind === 'verbose');
  if (verbose.length === 0) {
    return vars;
  }
  const merged = vars.map((one) => ({ ...one }));
  for (const form of verbose) {
    if (form.address.kind !== 'verbose') {
      continue;
    }
    const index = form.address.variable;
    const parts = {
      params: form.layout === null ? [] : [form.layout],
      fields: form.fields,
      field_intents: form.intents
    };
    const at = merged.findIndex((one) => one.index === index);
    if (at === -1) {
      merged.push({
        index,
        name: 'Unchanged',
        type: 'Unchanged',
        inject_vars: 'Unchanged',
        insert_params: [],
        depends_on: [],
        records: [],
        lists: [],
        ...parts
      });
    } else {
      merged[at] = { ...(merged[at] as MatchDraft['vars'][number]), ...parts };
    }
  } // End of the loop over the verbose forms
  return merged.sort((one, other) => one.index - other.index);
} // End of function withVerboseForms()

// ---------------------------------------------------------------------------
// The carriage-return gate at send
// ---------------------------------------------------------------------------

/**
 * The texts one new definition would write, split by control.
 *
 * @param field - The definition.
 * @returns One-line and multi-line texts.
 */
function newDefinitionTexts(field: NewFormField): { readonly oneLine: string[]; readonly multiLine: string[] } {
  const options = field.options;
  const oneLine: string[] = [field.name];
  const multiLine: string[] = [];
  for (const value of [options.type, options.multiline, options.trim_string_values]) {
    if (value !== null) {
      oneLine.push(value);
    }
  } // End of the loop over the one-line options
  if (options.default !== null) {
    multiLine.push(options.default);
  }
  if (options.values !== null) {
    multiLine.push(...('List' in options.values ? options.values.List : [options.values.Text]));
  }
  for (const extra of options.extra) {
    oneLine.push(extra.key);
    multiLine.push(...extraTexts(extra));
  } // End of the loop over the extra options
  return { oneLine, multiLine };
} // End of function newDefinitionTexts()

/**
 * An extra option's value texts.
 *
 * @param extra - The option.
 * @returns Its scalar or its items.
 */
function extraTexts(extra: NewParam): readonly string[] {
  return 'Scalar' in extra.value ? [extra.value.Scalar] : extra.value.List;
} // End of function extraTexts()

/**
 * Whether a new definition holds a text no control here could hold: a carriage
 * return anywhere, a line feed in a one-line text.
 *
 * @param field - The definition.
 * @returns `true` when one of its texts could not pass through a control.
 */
export function unreadableDefinition(field: NewFormField): boolean {
  const texts = newDefinitionTexts(field);
  return (
    texts.oneLine.some((text) => text.includes('\r') || text.includes('\n')) ||
    texts.multiLine.some((text) => text.includes('\r'))
  );
} // End of function unreadableDefinition()

/**
 * Whether a wire draft's form parts would write a text no control here could
 * hold — `beginSave`'s gate, over the draft that is sent, because `MatchBuffers`
 * carries no brand and a buffer built by hand type-checks.
 *
 * Every form text is checked for a carriage return; a definition name, a
 * one-line option and an extra option's key for a line feed as well. An
 * `EntryDraft` names an option by position, so the baseline says which key it
 * is; one this cannot place is held to the one-line rule, the stricter.
 *
 * @param baseline - What the file holds.
 * @param draft - The wire draft about to be sent.
 * @returns `true` when the draft must not be sent.
 */
export function formsWriteUnreadable(baseline: FormsBaseline, draft: MatchDraft): boolean {
  const oneLine: string[] = [];
  const multiLine: string[] = [];
  /**
   * Collects one form's texts.
   *
   * @param form - Its baseline, or `undefined` when the draft names an unknown one.
   * @param fields - Its drafted definitions.
   * @param intents - Its intents.
   */
  const collect = (
    form: FormBaseline | undefined,
    fields: readonly FormFieldDraft[],
    intents: readonly FormFieldIntent[]
  ): void => {
    for (const drafted of fields) {
      const definition = form?.definitions[drafted.index];
      for (const entry of drafted.options) {
        if (typeof entry.value !== 'object') {
          continue;
        }
        const key = definition?.options[entry.index]?.key?.text;
        const multi = key === 'default';
        (multi ? multiLine : oneLine).push(entry.value.Set);
      } // End of the loop over the rewritten options
      const texts = newDefinitionTexts({ name: '', options: drafted.insert_options });
      oneLine.push(...texts.oneLine);
      multiLine.push(...texts.multiLine);
    } // End of the loop over the drafted definitions
    for (const intent of intents) {
      if ('InsertField' in intent) {
        const texts = newDefinitionTexts(intent.InsertField.field);
        oneLine.push(...texts.oneLine);
        multiLine.push(...texts.multiLine);
      }
    } // End of the loop over the intents
  }; // End of function collect()
  collect(
    baseline.forms.find((form) => form.address.kind === 'shorthand'),
    draft.form_fields,
    draft.form_intents
  );
  for (const variable of draft.vars) {
    const form = baseline.forms.find(
      (one) => one.address.kind === 'verbose' && one.address.variable === variable.index
    );
    collect(form, variable.fields, variable.field_intents);
    for (const entry of variable.params) {
      if (typeof entry.value === 'object') {
        // The only `params` entry this editor drafts is a verbose layout, which is
        // multi-line; anything else a hand-built draft puts here is held to the
        // carriage-return rule at least.
        multiLine.push(entry.value.Set);
      }
    } // End of the loop over the drafted parameters
  } // End of the loop over the drafted variables
  return (
    oneLine.some((text) => text.includes('\r') || text.includes('\n')) ||
    multiLine.some((text) => text.includes('\r'))
  );
} // End of function formsWriteUnreadable()

// ---------------------------------------------------------------------------
// Rows: the layout's placeholders and the definitions, synchronized
// ---------------------------------------------------------------------------

/**
 * What a row says beside itself — a code, never a sentence
 * ({@link formRowAdvisoryKey}):
 *
 * - `noDefinition` — the layout holds the placeholder and no definition in the
 *   draft names it;
 * - `noOccurrence` — a definition-only row: the layout holds no supported
 *   placeholder of its name, and the layout is wholly inside the supported
 *   subset, so none is there to find (the §5 row 1 advisory of ruling 15);
 * - `noOccurrenceUnverified` — the same, over a layout holding syntax the subset
 *   does not read, which may be an occurrence this parser cannot see.
 */
export type FormRowAdvisory = 'noDefinition' | 'noOccurrence' | 'noOccurrenceUnverified';

/** Which definition a row shows. */
export type RowDefinition =
  | {
      /** An existing definition, by its position in the file. */
      readonly kind: 'existing';
      /** Its position. */
      readonly index: number;
      /** Whether the draft removes it. */
      readonly removed: boolean;
    }
  | {
      /** A definition the draft adds. */
      readonly kind: 'added';
      /** Its position in {@link FormBuffer.added}. */
      readonly position: number;
    };

/** One displayed field row. */
export interface FormRow {
  /** The field's name, or `null` for a definition whose key could not be read. */
  readonly name: string | null;
  /** How many supported `[[name]]` the layout holds — every repetition is this one row. */
  readonly occurrences: number;
  /** The definition shown, or `null` for a placeholder with none. */
  readonly definition: RowDefinition | null;
  /** The advisory, or `null`. */
  readonly advisory: FormRowAdvisory | null;
}

/** The rows of one form, derived from its drafted layout and definitions. */
export interface FormRows {
  /** Rows in layout order of first occurrence, then the definition-only rows in definition order. */
  readonly rows: readonly FormRow[];
  /** Whether the layout holds nothing outside the supported subset. */
  readonly fullySupported: boolean;
  /** The layout's pieces, for a display that draws it. */
  readonly pieces: readonly LayoutPiece[];
}

/**
 * The rows one form shows. **Derived, never stored**: nothing here writes a
 * definition because the layout changed — a layout edit only changes this
 * answer (ruling 15).
 *
 * @param form - The form's baseline.
 * @param buffer - Its buffer.
 * @param layout - The layout text the draft holds (for shorthand, the `form`
 *   field's box; `''` when it holds none).
 * @returns The rows.
 */
export function formRowsOf(form: FormBaseline, buffer: FormBuffer, layout: string): FormRows {
  const pieces = layoutPiecesOf(layout);
  const fullySupported = pieces.every((piece) => piece.kind !== 'malformed');
  const order: string[] = [];
  const counts = new Map<string, number>();
  for (const piece of pieces) {
    if (piece.kind !== 'placeholder') {
      continue;
    }
    if (!counts.has(piece.name)) {
      order.push(piece.name);
    }
    counts.set(piece.name, (counts.get(piece.name) ?? 0) + 1);
  } // End of the loop over the layout's pieces
  const candidates: { readonly name: string | null; readonly definition: RowDefinition; readonly live: boolean }[] = [
    ...form.definitions.map((definition, index) => {
      const removed = buffer.definitions[index]?.removed === true;
      return { name: definition.name, definition: { kind: 'existing' as const, index, removed }, live: !removed };
    }),
    ...buffer.added.map((added, position) => ({
      name: added.field.name,
      definition: { kind: 'added' as const, position },
      live: true
    }))
  ];
  const used = new Set<number>();
  const rows: FormRow[] = order.map((name) => {
    // The first live definition of the name, else the first removed one, so a
    // removed definition stays visible on the row whose placeholder it defined.
    let at = candidates.findIndex((one, index) => !used.has(index) && one.name === name && one.live);
    if (at === -1) {
      at = candidates.findIndex((one, index) => !used.has(index) && one.name === name);
    }
    const found = candidates[at];
    if (found !== undefined) {
      used.add(at);
    }
    return {
      name,
      occurrences: counts.get(name) ?? 0,
      definition: found === undefined ? null : found.definition,
      advisory: found === undefined || !found.live ? 'noDefinition' : null
    };
  }); // End of the map over the placeholder names
  candidates.forEach((one, index) => {
    if (used.has(index)) {
      return;
    }
    rows.push({
      name: one.name,
      occurrences: 0,
      definition: one.definition,
      advisory: one.live ? (fullySupported ? 'noOccurrence' : 'noOccurrenceUnverified') : null
    });
  }); // End of the walk over the definition-only rows
  return { rows, fullySupported, pieces };
} // End of function formRowsOf()

// ---------------------------------------------------------------------------
// Pure buffer transitions
// ---------------------------------------------------------------------------

/**
 * The buffer with one form's part replaced.
 *
 * @param buffer - The forms buffer.
 * @param position - The form's position.
 * @param form - Its new buffer.
 * @returns The new forms buffer.
 */
function withForm(buffer: FormsBuffer, position: number, form: FormBuffer): FormsBuffer {
  return { forms: buffer.forms.map((one, at) => (at === position ? form : one)) };
} // End of function withForm()

/**
 * The buffer with a verbose layout's box replaced, or `null` when refused: no
 * such verbose form, an ineligible layout, a carriage return, or no change. A
 * shorthand layout is never drafted here — it is the `form` field's box.
 *
 * @param baseline - What the file holds.
 * @param buffer - What the controls hold.
 * @param position - The form's position.
 * @param text - The box's whole value.
 * @returns The new buffer, or `null`.
 */
export function withLayoutText(
  baseline: FormsBaseline,
  buffer: FormsBuffer,
  position: number,
  text: string
): FormsBuffer | null {
  const form = baseline.forms[position];
  const drafted = buffer.forms[position];
  if (baseline.reprojectionOwed || form === undefined || drafted === undefined) {
    return null;
  }
  if (form.layout === null || drafted.layout === null || form.layout.eligibility.kind !== 'editable') {
    return null;
  }
  if (text.includes('\r') || drafted.layout.text === text) {
    return null;
  }
  return withForm(buffer, position, { ...drafted, layout: { text } });
} // End of function withLayoutText()

/**
 * The buffer with one option box of one existing definition replaced, or `null`
 * when refused: an unknown position, an ineligible option, a definition drafted
 * for removal, a carriage return, a line feed in a one-line box, or no change.
 *
 * @param baseline - What the file holds.
 * @param buffer - What the controls hold.
 * @param position - The form's position.
 * @param index - The definition's position.
 * @param key - The option.
 * @param text - The box's whole value.
 * @returns The new buffer, or `null`.
 */
export function withOptionText(
  baseline: FormsBaseline,
  buffer: FormsBuffer,
  position: number,
  index: number,
  key: FormOptionKey,
  text: string
): FormsBuffer | null {
  const definition = baseline.forms[position]?.definitions[index];
  const drafted = buffer.forms[position];
  const box = drafted?.definitions[index];
  if (baseline.reprojectionOwed || definition === undefined || drafted === undefined || box === undefined) {
    return null;
  }
  if (box.removed || definition.scalars[key].eligibility.kind !== 'editable') {
    return null;
  }
  if (text.includes('\r') || (isOneLineOption(key) && text.includes('\n')) || box.options[key].text === text) {
    return null;
  }
  const definitions = drafted.definitions.map((one, at) =>
    at === index ? { ...one, options: { ...one.options, [key]: { text } } } : one
  );
  return withForm(buffer, position, { ...drafted, definitions });
} // End of function withOptionText()

/**
 * The buffer with one existing definition drafted for removal, or restored, or
 * `null` when refused. A removal needs a block `form_fields`/`fields` (Rust
 * refuses a flow one) and leaves the layout alone: every `[[name]]` stays where
 * it is, and its row says the placeholder has no definition.
 *
 * @param baseline - What the file holds.
 * @param buffer - What the controls hold.
 * @param position - The form's position.
 * @param index - The definition's position.
 * @param removed - `true` to remove, `false` to restore.
 * @returns The new buffer, or `null`.
 */
export function withDefinitionRemoval(
  baseline: FormsBaseline,
  buffer: FormsBuffer,
  position: number,
  index: number,
  removed: boolean
): FormsBuffer | null {
  const form = baseline.forms[position];
  const drafted = buffer.forms[position];
  const box = drafted?.definitions[index];
  if (baseline.reprojectionOwed || form === undefined || drafted === undefined || box === undefined) {
    return null;
  }
  if (box.removed === removed || (removed && form.definitionsShape !== 'block')) {
    return null;
  }
  const definitions = drafted.definitions.map((one, at) => (at === index ? { ...one, removed } : one));
  return withForm(buffer, position, { ...drafted, definitions });
} // End of function withDefinitionRemoval()

/**
 * Why a name cannot be given to a new definition — a code:
 *
 * - `empty`;
 * - `notAnIdentifier` — not `[A-Za-z_][A-Za-z0-9_]*`: a definition this editor
 *   adds is for a placeholder of the supported subset (ruling 16). This
 *   application's rule, not a claim about which keys espanso accepts;
 * - `takenByDefinition` — an existing definition of this form has the name,
 *   removed or not (Rust refuses to repeat a removed one's name in one batch);
 * - `takenByAddition` — a definition the draft adds has it.
 */
export type FormNameRefusal = 'empty' | 'notAnIdentifier' | 'takenByDefinition' | 'takenByAddition';

/**
 * Why *Add field* did nothing — a code with its operand.
 *
 * - `formNotEditable` — the editor, the form or its variable does not accept
 *   changes now (a variable drafted for removal included);
 * - `layoutNotEditable` — the layout the placeholder would go into is read-only
 *   (for instance, it holds a real carriage return);
 * - `structure` — the R36/R37 grant does not cover this snippet;
 * - `definitionsNotABlockMapping` — the definitions are written between braces
 *   or are not a mapping, which Rust refuses to insert into;
 * - `definitionsUnreadable` — a definition's key could not be read, so a new
 *   name cannot be compared with it;
 * - `name` — the name is refused;
 * - `unreadableText` — a text of the definition holds a carriage return, or a
 *   one-line one a line feed.
 */
export type FormAdditionRefusal =
  | { readonly kind: 'formNotEditable' }
  | { readonly kind: 'layoutNotEditable' }
  | { readonly kind: 'structure'; readonly reason: VariableStructureRefusal }
  | { readonly kind: 'definitionsNotABlockMapping' }
  | { readonly kind: 'definitionsUnreadable' }
  | { readonly kind: 'name'; readonly reason: FormNameRefusal }
  | { readonly kind: 'unreadableText' };

/**
 * Why a new definition cannot be added to one form, or `null` — every check but
 * the editor's own and the grant, which `./matchEditor.ts` asks first.
 *
 * @param baseline - What the file holds.
 * @param buffer - What the controls hold, captured once.
 * @param position - The form's position.
 * @param field - The new definition.
 * @returns The refusal, or `null`.
 */
export function formAdditionRefusal(
  baseline: FormsBaseline,
  buffer: FormsBuffer,
  position: number,
  field: NewFormField
): FormAdditionRefusal | null {
  const form = baseline.forms[position];
  const drafted = buffer.forms[position];
  if (baseline.reprojectionOwed || form === undefined || drafted === undefined) {
    return { kind: 'formNotEditable' };
  }
  if (form.definitionsShape !== 'absent' && form.definitionsShape !== 'block') {
    return { kind: 'definitionsNotABlockMapping' };
  }
  if (form.definitions.some((definition) => definition.name === null)) {
    return { kind: 'definitionsUnreadable' };
  }
  if (field.name === '') {
    return { kind: 'name', reason: 'empty' };
  }
  if (!isSupportedIdentifier(field.name)) {
    return { kind: 'name', reason: 'notAnIdentifier' };
  }
  if (form.definitions.some((definition) => definition.name === field.name)) {
    return { kind: 'name', reason: 'takenByDefinition' };
  }
  if (drafted.added.some((added) => added.field.name === field.name)) {
    return { kind: 'name', reason: 'takenByAddition' };
  }
  return unreadableDefinition(field) ? { kind: 'unreadableText' } : null;
} // End of function formAdditionRefusal()

/**
 * The buffer with one new definition added at the end of a form's definitions,
 * or `null` when {@link formAdditionRefusal} refuses.
 *
 * @param baseline - What the file holds.
 * @param buffer - What the controls hold.
 * @param position - The form's position.
 * @param field - The new definition.
 * @param placeholderInserted - Whether *Add field* put `[[name]]` into the
 *   layout in the same action.
 * @returns The new buffer, or `null`.
 */
export function withDefinitionAdded(
  baseline: FormsBaseline,
  buffer: FormsBuffer,
  position: number,
  field: NewFormField,
  placeholderInserted: boolean
): FormsBuffer | null {
  const drafted = buffer.forms[position];
  if (drafted === undefined || formAdditionRefusal(baseline, buffer, position, field) !== null) {
    return null;
  }
  return withForm(buffer, position, {
    ...drafted,
    added: [...drafted.added, { field: ownedCopy(field), placeholderInserted }]
  });
} // End of function withDefinitionAdded()

/**
 * The buffer with one drafted new definition dropped, or `null` when there is
 * none at that position. A `[[name]]` *Add field* put into the layout stays: it
 * is text the person can see and remove; undo takes back the whole action.
 *
 * @param buffer - What the controls hold.
 * @param position - The form's position.
 * @param at - The addition's position.
 * @returns The new buffer, or `null`.
 */
export function withDefinitionDiscarded(buffer: FormsBuffer, position: number, at: number): FormsBuffer | null {
  const drafted = buffer.forms[position];
  if (drafted === undefined || at < 0 || at >= drafted.added.length) {
    return null;
  }
  return withForm(buffer, position, { ...drafted, added: drafted.added.filter((_, one) => one !== at) });
} // End of function withDefinitionDiscarded()

/**
 * Whether a retained draft adds a definition — ruling 21's test for recovery,
 * beside `carriesDefinitions` in `./variableEditor.ts` (which already refuses a
 * snippet holding `form_fields` or `vars`): a shorthand form with no
 * `form_fields` whose draft adds one would be recreated with its layout and
 * without the definition.
 *
 * @param buffer - The retained draft, captured once.
 * @returns `true` when recovery must refuse to recreate.
 */
export function formsCarryDefinitions(buffer: FormsBuffer): boolean {
  return buffer.forms.some((form) => form.added.length > 0);
} // End of function formsCarryDefinitions()

// ---------------------------------------------------------------------------
// Whole-container reapply (ruling 22)
// ---------------------------------------------------------------------------

/**
 * What a reapply does with the drafted forms:
 *
 * - `unchanged` — the draft says nothing about any form;
 * - `applicable` — every drafted form's container is the one the draft was built
 *   against (same Rust fingerprint, same definition count, same address), so
 *   every positional intent still names what it named;
 * - `collision` — anything else: the whole container collides. **There is no
 *   `satisfied` for a form**: "already there" is not compared for definitions
 *   (a nested option mapping this module does not re-derive), so a form whose
 *   intended result is already on disk collides — a manual resolution, never a
 *   lost edit.
 */
export type FormsReapplyVerdict = 'unchanged' | 'applicable' | 'collision';

/** The container a collision of forms names. */
export type FormsCollisionSubject = 'form_fields' | 'vars';

/**
 * Whether two container baselines are the same bytes; `Uncut` matches nothing.
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
 * Whether two addresses name the same form.
 *
 * @param one - An address.
 * @param other - Another.
 * @returns `true` when they are equal.
 */
function sameAddress(one: FormAddress, other: FormAddress): boolean {
  return one.kind === 'shorthand'
    ? other.kind === 'shorthand'
    : other.kind === 'verbose' && other.variable === one.variable;
} // End of function sameAddress()

/**
 * The reapply verdict of the drafted forms, the containers that collided, and
 * the buffer to hold over the new baseline: the new projection's fresh buffer,
 * with the retained buffer carried only for each drafted form whose container
 * was verified unchanged — never for a form this did not check.
 *
 * @param was - What the file held when the session was seeded.
 * @param buffer - The retained draft, captured once.
 * @param now - What the newly parsed projection holds.
 * @param excluded - {@link excludedVariablesOf} of the retained draft.
 * @returns The verdict, the subjects and the buffer.
 */
export function formsReapply(
  was: FormsBaseline,
  buffer: FormsBuffer,
  now: FormsBaseline,
  excluded: ReadonlySet<number>
): {
  readonly verdict: FormsReapplyVerdict;
  readonly subjects: readonly FormsCollisionSubject[];
  readonly buffer: FormsBuffer;
  readonly placeholderInserted: boolean;
} {
  const fresh = formsBufferOf(now);
  const derived = formsDerivationOf(was, buffer, excluded);
  const shorthand = was.forms.findIndex((one) => one.address.kind === 'shorthand');
  const placeholderInserted =
    derived.forms.some((form) => form.address.kind === 'shorthand') &&
    (buffer.forms[shorthand]?.added.some((added) => added.placeholderInserted) ?? false);
  if (!derived.changed && !was.reprojectionOwed) {
    return { verdict: 'unchanged', subjects: [], buffer: fresh, placeholderInserted: false };
  }
  const subjects = new Set<FormsCollisionSubject>();
  const addressesAgree =
    was.forms.length === now.forms.length &&
    was.forms.every((form, at) => sameAddress(form.address, (now.forms[at] as FormBaseline).address));
  for (const form of derived.forms) {
    const at = was.forms.findIndex((one) => sameAddress(one.address, form.address));
    const old = was.forms[at] as FormBaseline;
    const fresher = now.forms[at];
    const holds =
      addressesAgree &&
      !now.reprojectionOwed &&
      fresher !== undefined &&
      old.definitionsShape === fresher.definitionsShape &&
      old.definitions.length === fresher.definitions.length &&
      sameContainer(old.container, fresher.container);
    if (!holds) {
      subjects.add(form.address.kind === 'shorthand' ? 'form_fields' : 'vars');
    }
  } // End of the loop over the drafted forms
  if (was.reprojectionOwed || derived.problem !== null) {
    subjects.add(was.forms.some((one) => one.address.kind === 'shorthand') ? 'form_fields' : 'vars');
  }
  if (subjects.size === 0) {
    // Built from the fresh buffer, carrying the retained one **only for a form
    // whose container the loop above verified** (the 4-10 review's blocker): an
    // undrafted form's retained boxes hold the old file's text, and over a new
    // baseline where that form changed they would derive a `Set` of the old
    // text, silently overwriting the external change.
    const verified = new Set(
      derived.forms.map((form) => was.forms.findIndex((one) => sameAddress(one.address, form.address)))
    );
    const carried: FormsBuffer = {
      forms: fresh.forms.map((one, at) => (verified.has(at) ? (buffer.forms[at] ?? one) : one))
    };
    return { verdict: 'applicable', subjects: [], buffer: carried, placeholderInserted };
  }
  return { verdict: 'collision', subjects: [...subjects], buffer: fresh, placeholderInserted };
} // End of function formsReapply()

// ---------------------------------------------------------------------------
// Retention: the rows a conflict compares and copies
// ---------------------------------------------------------------------------

/**
 * The retained rows one new definition is copied as: its name, then each option
 * as an `optionName` row holding the key and one `optionValue` row per value.
 *
 * @param field - The definition.
 * @returns The rows.
 */
function addedDefinitionRows(field: NewFormField): readonly RetainedDraftField[] {
  const rows: RetainedDraftField[] = [{ label: 'formField', text: field.name, status: 'fieldAdded' }];
  /**
   * Adds one option's rows.
   *
   * @param key - The option's key.
   * @param values - Its values.
   */
  const option = (key: string, values: readonly string[]): void => {
    rows.push({ label: 'formOption', text: key, status: 'optionName' });
    rows.push(...values.map((text) => ({ label: 'formOption' as const, text, status: 'optionValue' as const })));
  }; // End of function option()
  const options = field.options;
  for (const [key, value] of [
    ['type', options.type],
    ['default', options.default],
    ['multiline', options.multiline]
  ] as const) {
    if (value !== null) {
      option(key, [value]);
    }
  } // End of the loop over the first three options
  if (options.values !== null) {
    option('values', 'List' in options.values ? options.values.List : [options.values.Text]);
  }
  if (options.trim_string_values !== null) {
    option('trim_string_values', [options.trim_string_values]);
  }
  for (const extra of options.extra) {
    option(extra.key, extraTexts(extra));
  } // End of the loop over the extra options
  return rows;
} // End of function addedDefinitionRows()

/**
 * The retained draft's rows for the forms, **only for a form the draft changes**,
 * so a copy of a draft that touches no form reads exactly as before this phase.
 *
 * Per form: a verbose form is headed by its variable's name (`unchanged`) and its
 * layout (`setting`) when drafted — a shorthand layout is the `form` field's own
 * row above. Then per existing definition in file order: a removed one is its
 * name with `fieldRemoved`; an edited one is its name with `fieldEdited`, then
 * each drafted option's key and value. Then each new definition. Labels repeat
 * on purpose, so a renderer must not key these rows by label (B1).
 *
 * @param baseline - What the file holds.
 * @param buffer - The retained draft, captured once.
 * @param excluded - {@link excludedVariablesOf} of the same read.
 * @returns The rows.
 */
export function formRowsRetained(
  baseline: FormsBaseline,
  buffer: FormsBuffer,
  excluded: ReadonlySet<number>
): readonly RetainedDraftField[] {
  const derived = formsDerivationOf(baseline, buffer, excluded);
  const rows: RetainedDraftField[] = [];
  for (const form of derived.forms) {
    const at = baseline.forms.findIndex((one) => sameAddress(one.address, form.address));
    const held = baseline.forms[at] as FormBaseline;
    const drafted = buffer.forms[at] as FormBuffer;
    if (form.address.kind === 'verbose') {
      rows.push({ label: 'variableName', text: held.variableName ?? '', status: 'unchanged' });
      if (form.layout !== null && drafted.layout !== null) {
        rows.push({ label: 'layout', text: drafted.layout.text, status: 'setting' });
      }
    }
    held.definitions.forEach((definition, index) => {
      const box = drafted.definitions[index];
      if (box === undefined) {
        return;
      }
      if (box.removed) {
        rows.push({ label: 'formField', text: definition.name ?? '', status: 'fieldRemoved' });
        return;
      }
      const changed = FORM_OPTION_KEYS.filter(
        (key) => formScalarIntent(definition.scalars[key], box.options[key]) !== 'Unchanged'
      );
      if (changed.length === 0) {
        return;
      }
      rows.push({ label: 'formField', text: definition.name ?? '', status: 'fieldEdited' });
      for (const key of changed) {
        rows.push({ label: 'formOption', text: key, status: 'optionName' });
        rows.push({ label: 'formOption', text: box.options[key].text, status: 'optionValue' });
      } // End of the loop over the changed options
    }); // End of the walk over the definitions
    for (const added of drafted.added) {
      rows.push(...addedDefinitionRows(added.field));
    } // End of the loop over the new definitions
  } // End of the loop over the drafted forms
  return rows;
} // End of function formRowsRetained()

/**
 * The label a collision of forms is named by, for `tRetainedLabel`.
 *
 * @returns The `form_fields` label.
 */
export function formFieldsLabelName(): RetainedLabel {
  return 'formFields';
} // End of function formFieldsLabelName()

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

/**
 * The dictionary key holding one box refusal's sentence. The five shared codes
 * reuse the match editor's sentences.
 *
 * @param reason - Why the box is read-only.
 * @returns The key.
 */
export function formFieldRefusalKey(reason: FormFieldRefusal): TranslationKey {
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
    case 'notInForm':
      return 'browser.formEditor.readOnly.notInForm';
    case 'optionsNotABlockMapping':
      return 'browser.formEditor.readOnly.optionsNotABlockMapping';
  }
} // End of function formFieldRefusalKey()

/**
 * The dictionary key holding one name refusal's sentence.
 *
 * @param reason - Why the name cannot be used.
 * @returns The key.
 */
export function formNameRefusalKey(reason: FormNameRefusal): TranslationKey {
  switch (reason) {
    case 'empty':
      return 'browser.formEditor.name.empty';
    case 'notAnIdentifier':
      return 'browser.formEditor.name.notAnIdentifier';
    case 'takenByDefinition':
      return 'browser.formEditor.name.takenByDefinition';
    case 'takenByAddition':
      return 'browser.formEditor.name.takenByAddition';
  }
} // End of function formNameRefusalKey()

/**
 * The dictionary key holding one *Add field* refusal's sentence: the structure
 * grant's own sentence (shared with the variables, ruling 23) and the name's own.
 *
 * @param refusal - Why *Add field* did nothing.
 * @returns The key.
 */
export function formAdditionRefusalKey(refusal: FormAdditionRefusal): TranslationKey {
  switch (refusal.kind) {
    case 'formNotEditable':
      return 'browser.formEditor.addition.formNotEditable';
    case 'layoutNotEditable':
      return 'browser.formEditor.addition.layoutNotEditable';
    case 'structure':
      return variableMoveRefusalKey(refusal.reason);
    case 'definitionsNotABlockMapping':
      return 'browser.formEditor.addition.definitionsNotABlockMapping';
    case 'definitionsUnreadable':
      return 'browser.formEditor.addition.definitionsUnreadable';
    case 'name':
      return formNameRefusalKey(refusal.reason);
    case 'unreadableText':
      return 'browser.formEditor.addition.unreadableText';
  }
} // End of function formAdditionRefusalKey()

/**
 * The dictionary key holding one row advisory's sentence.
 *
 * @param advisory - What the row says.
 * @returns The key.
 */
export function formRowAdvisoryKey(advisory: FormRowAdvisory): TranslationKey {
  switch (advisory) {
    case 'noDefinition':
      return 'browser.formEditor.row.noDefinition';
    case 'noOccurrence':
      return 'browser.formEditor.row.noOccurrence';
    case 'noOccurrenceUnverified':
      return 'browser.formEditor.row.noOccurrenceUnverified';
  }
} // End of function formRowAdvisoryKey()
