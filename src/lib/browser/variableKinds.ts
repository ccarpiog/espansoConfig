/**
 * The seven kind submodels for a **new** variable — Phase 4-14-1: Date, Random,
 * Echo, Clipboard, Shell, Script and Match, as values.
 *
 * `../components/VariableGroup.svelte` draws what this module answers inside the
 * *Add a variable* form; the popovers of the `+ Insert` rows are step 4-15's and
 * will draw the same values. Every decision — which parameters a kind has, which
 * one it cannot do without, what is only worth a warning, what a press may
 * draft — is here, where a test in the `node` environment reaches it
 * (`CLAUDE.md` §6, *Frontend structure*).
 *
 * ## One closed shape per kind
 *
 * A form holds texts; {@link kindVariableOf} turns them into exactly one
 * `NewVariableParams` variant (`../ipc/types.ts`), which Rust derives `type` from
 * and closes with `deny_unknown_fields`. A kind's **own** parameters are the only
 * ones sent: the form keeps every text it was given across a change of kind, and
 * the ones the chosen kind does not own are never written. Nothing adds
 * `inject_vars`, `depends_on` or an extra parameter — those stay the file's text
 * or a later step's.
 *
 * ## Required, optional, and "given"
 *
 * {@link REQUIRED_PART} transcribes Rust's `required_param`
 * (`crates/espansoconfig-core/src/validate/mod.rs`): `choices` for `random`,
 * `echo`, `cmd`, `args`, `trigger`; **nothing for `date`** — espanso's own source
 * answers RFC 2822 with no `format`, whatever its documentation table says — and
 * nothing for `clipboard`, which takes no parameter at all. A required part must
 * be **given**, which means not blank: a blank box is what an untouched box
 * looks like, and the rule `CLAUDE.md` §6 states for an existing field (an
 * absent field left blank is `'Unchanged'`, not `Set("")`) is the same here — a
 * blank optional part is **not written at all**, and a blank required one keeps
 * *Add* disabled rather than writing an empty value nobody chose.
 *
 * ## D2u: texts, never types
 *
 * Every part is a textual control. `offset`, `trim` and `debug` are written by
 * Rust **verbatim as plain source** (ruling 4) — the form says so beside them —
 * and every other part as a logical string spelled by the codec. A text this
 * module does not recognise is **kept exactly as typed** (never trimmed, never
 * normalised, never replaced by a suggestion) and at most earns a
 * {@link KindWarning}: a claim about risk, never about meaning, and never a
 * reason to refuse.
 *
 * ## Carriage returns
 *
 * No control here can hold a `\r` (`CLAUDE.md` §6). A form opens holding no
 * text at all, so nothing can bring one in at load; {@link editKindDraft}
 * refuses one at edit (and a line feed in a one-line part); the view reports one
 * a forged draft holds as a {@link KindProblem}; and at send `addVariable` /
 * `insertVariable` refuse it (`unreadableText`), and `beginSave`'s gate after
 * them.
 *
 * ## What no type here forces
 *
 * That a caller mints the grant and the name context from a read taken at the
 * press (R37) — `VariableGroup.svelte` does; TypeScript cannot force it. And the
 * shell names {@link KNOWN_SHELLS} lists are transcribed from espanso 2's shell
 * extension, not measured by this project: `unfamiliarShell` says "not a name
 * this app knows", never "espanso refuses it".
 */

import type { TranslationKey } from '../i18n/dictionaries';
import type { NewVariable, NewVariableParams } from '../ipc/types';
import { valuesOfLines } from './formEditor';
import type { MatchEditorSession, TextSelection } from './matchEditor';
import type { VariableStructureGrant } from './variableEditor';
import { additionWithheldOf, choiceTargetsOf, type AdditionWithheld } from './variableGroup';
import {
  addVariable,
  insertVariable,
  nameVerdictOf,
  suggestedName,
  type InsertOutcome,
  type NameContext,
  type NameVerdict,
  type ReferenceField
} from './variableInsertion';

// ---------------------------------------------------------------------------
// The kinds and their parts
// ---------------------------------------------------------------------------

/**
 * One of the seven kinds this step authors. `choice` is 4-11's and `form` is
 * 4-12's; each has its own form.
 */
export type NewVariableKind = 'date' | 'random' | 'echo' | 'clipboard' | 'shell' | 'script' | 'match';

/** The seven kinds, in the order the form offers them. */
export const NEW_VARIABLE_KINDS: readonly NewVariableKind[] = [
  'echo',
  'date',
  'random',
  'clipboard',
  'shell',
  'script',
  'match'
];

/**
 * One parameter a kind's form holds, spelled as the espanso key it is written
 * under — the same in every language, so a screen puts the key itself beside
 * its label.
 */
export type KindPart =
  | 'format'
  | 'offset'
  | 'tz'
  | 'locale'
  | 'choices'
  | 'echo'
  | 'cmd'
  | 'shell'
  | 'trim'
  | 'debug'
  | 'args'
  | 'trigger';

/** Every part, in a fixed order. */
export const KIND_PARTS: readonly KindPart[] = [
  'format',
  'offset',
  'tz',
  'locale',
  'choices',
  'echo',
  'cmd',
  'shell',
  'trim',
  'debug',
  'args',
  'trigger'
];

/**
 * The parts each kind owns, in the order Rust writes them
 * (`NewVariableParams::entries`).
 */
export const PARTS_OF_KIND: Readonly<Record<NewVariableKind, readonly KindPart[]>> = {
  date: ['format', 'offset', 'tz', 'locale'],
  random: ['choices'],
  echo: ['echo'],
  clipboard: [],
  shell: ['cmd', 'shell', 'trim', 'debug'],
  script: ['args', 'trim'],
  match: ['trigger']
};

/**
 * The part a kind cannot be evaluated without — Rust's `required_param`,
 * transcribed. `date` and `clipboard` require nothing.
 */
export const REQUIRED_PART: Readonly<Record<NewVariableKind, KindPart | null>> = {
  date: null,
  random: 'choices',
  echo: 'echo',
  clipboard: null,
  shell: 'cmd',
  script: 'args',
  match: 'trigger'
};

/**
 * How a part is drafted:
 *
 * - `oneLine` — a one-line box (`<input>`), which may hold neither a carriage
 *   return nor a line feed;
 * - `text` — a multi-line box (`<textarea>`) holding one value, line feeds
 *   included;
 * - `list` — a multi-line box holding one item per line, read by the Choice
 *   insertion's rule (`valuesOfLines` in `./formEditor.ts`).
 */
export type PartShape = 'oneLine' | 'text' | 'list';

/** Each part's shape. */
export const PART_SHAPE: Readonly<Record<KindPart, PartShape>> = {
  format: 'oneLine',
  offset: 'oneLine',
  tz: 'oneLine',
  locale: 'oneLine',
  choices: 'list',
  echo: 'text',
  cmd: 'text',
  shell: 'oneLine',
  trim: 'oneLine',
  debug: 'oneLine',
  args: 'list',
  trigger: 'oneLine'
};

/**
 * The parts Rust writes verbatim as plain source (ruling 4,
 * `PLAIN_SOURCE_PARAMS` in `crates/espansoconfig-core/src/draft/new_variable.rs`);
 * every other part is a logical string.
 */
export const PLAIN_SOURCE_PARTS: readonly KindPart[] = ['offset', 'trim', 'debug'];

/**
 * The `shell` names espanso 2's shell extension accepts, as this project
 * transcribed them (not measured): a name outside the list is kept and warned
 * about, never refused.
 */
export const KNOWN_SHELLS: readonly string[] = [
  'bash',
  'cmd',
  'nu',
  'powershell',
  'pwsh',
  'sh',
  'wsl',
  'wsl2',
  'zsh'
];

/**
 * The provisional name's stem for each kind — espanso's own `type` word.
 *
 * @param kind - The kind.
 * @returns The stem `suggestedName` numbers.
 */
function stemOf(kind: NewVariableKind): string {
  return kind;
} // End of function stemOf()

// ---------------------------------------------------------------------------
// The form's value
// ---------------------------------------------------------------------------

/**
 * What the *Add a variable* form holds: the kind, the provisional name, and one
 * text per part — **every** part, so a change of kind loses nothing typed; only
 * the chosen kind's own parts are ever sent. The component holds it; nothing
 * here stores it.
 */
export interface KindDraft {
  /** The chosen kind. */
  readonly kind: NewVariableKind;
  /** The proposed name — provisional until added. */
  readonly name: string;
  /** Each part's text, exactly as its box holds it. */
  readonly parts: Readonly<Record<KindPart, string>>;
}

/** Every part blank. */
const BLANK_PARTS: Readonly<Record<KindPart, string>> = Object.freeze({
  format: '',
  offset: '',
  tz: '',
  locale: '',
  choices: '',
  echo: '',
  cmd: '',
  shell: '',
  trim: '',
  debug: '',
  args: '',
  trigger: ''
});

/**
 * The form a kind opens with: a provisional name the context does not refuse
 * (`date`, `date2`, …) and every part blank — so it holds no text that could
 * carry a carriage return.
 *
 * @param kind - The kind.
 * @param context - The names, from `nameContextOf`.
 * @returns The form's starting value.
 */
export function kindDraftOf(kind: NewVariableKind, context: NameContext): KindDraft {
  return { kind, name: suggestedName(stemOf(kind), context), parts: BLANK_PARTS };
} // End of function kindDraftOf()

/**
 * The form with another kind chosen. Every part's text is kept; the name is
 * re-proposed only while it is still the old kind's untouched proposal, so a
 * name a person typed survives the change.
 *
 * @param draft - The form.
 * @param kind - The kind chosen.
 * @param context - The names, from `nameContextOf`.
 * @returns The new form value.
 */
export function withKind(draft: KindDraft, kind: NewVariableKind, context: NameContext): KindDraft {
  if (kind === draft.kind) {
    return draft;
  }
  const proposed = suggestedName(stemOf(draft.kind), context);
  const name = draft.name === proposed ? suggestedName(stemOf(kind), context) : draft.name;
  return { ...draft, kind, name };
} // End of function withKind()

/**
 * Why an edit of the form was not taken.
 *
 * - `carriageReturn` — the text holds a `\r`, which no control here can hold;
 * - `lineBreak` — a one-line part (or the name) holds a line feed.
 */
export type KindEditRefusal = 'carriageReturn' | 'lineBreak';

/** What one edit of the form did. */
export type KindEdit =
  | { readonly kind: 'edited'; readonly draft: KindDraft }
  | { readonly kind: 'refused'; readonly draft: KindDraft; readonly reason: KindEditRefusal };

/**
 * One box of the form edited: the name or one part. **A carriage return is
 * refused at edit**, and a line feed in a one-line box; the refused form is the
 * one it was, unchanged.
 *
 * @param draft - The form.
 * @param part - `'name'` or the part.
 * @param text - The box's whole new value.
 * @returns What happened.
 */
export function editKindDraft(draft: KindDraft, part: KindPart | 'name', text: string): KindEdit {
  if (text.includes('\r')) {
    return { kind: 'refused', draft, reason: 'carriageReturn' };
  }
  const oneLine = part === 'name' || PART_SHAPE[part] === 'oneLine';
  if (oneLine && text.includes('\n')) {
    return { kind: 'refused', draft, reason: 'lineBreak' };
  }
  if (part === 'name') {
    return { kind: 'edited', draft: { ...draft, name: text } };
  }
  return { kind: 'edited', draft: { ...draft, parts: { ...draft.parts, [part]: text } } };
} // End of function editKindDraft()

// ---------------------------------------------------------------------------
// Readiness and the closed shape
// ---------------------------------------------------------------------------

/**
 * Why a form cannot be drafted as it stands — a code with the part it is about.
 *
 * - `required` — the kind's required part is blank (a list with no item);
 * - `emptyItem` — a line between two items of a list is empty;
 * - `carriageReturn` — a text holds a `\r` (reachable only through a forged
 *   form: {@link editKindDraft} refuses one);
 * - `lineBreak` — a one-line part holds a line feed (the same);
 * - `noTarget` — an *Insert* whose content key cannot take a reference now.
 */
export type KindProblem =
  | { readonly kind: 'required'; readonly part: KindPart }
  | { readonly kind: 'emptyItem'; readonly part: KindPart }
  | { readonly kind: 'carriageReturn'; readonly part: KindPart | 'name' }
  | { readonly kind: 'lineBreak'; readonly part: KindPart }
  | { readonly kind: 'noTarget' };

/**
 * A text the form keeps as typed but a person may not have meant — advisory,
 * never a refusal, never a rewrite (D2u).
 *
 * - `offsetNotAnInteger` — `offset` is not a whole number of seconds;
 * - `notTrueOrFalse` — `trim` or `debug` is neither `true` nor `false`, so
 *   espanso may not read it as a switch;
 * - `unfamiliarShell` — `shell` is not one of {@link KNOWN_SHELLS};
 * - `formatWithoutSpecifier` — `format` holds no `%`, so it prints itself;
 * - `surroundingSpace` — a one-line part starts or ends with white space, which
 *   is kept.
 */
export type KindWarning =
  | { readonly code: 'offsetNotAnInteger'; readonly part: 'offset' }
  | { readonly code: 'notTrueOrFalse'; readonly part: 'trim' | 'debug' }
  | { readonly code: 'unfamiliarShell'; readonly part: 'shell' }
  | { readonly code: 'formatWithoutSpecifier'; readonly part: 'format' }
  | { readonly code: 'surroundingSpace'; readonly part: KindPart };

/**
 * The text of an optional part as the wire carries it: `null` — not written —
 * when blank, else exactly as typed.
 *
 * @param text - The box's text.
 * @returns The wire value.
 */
function optional(text: string): string | null {
  return text === '' ? null : text;
} // End of function optional()

/**
 * The first problem one part's text has, as its kind uses it.
 *
 * @param part - The part.
 * @param text - Its text.
 * @param required - Whether the kind requires it.
 * @returns The problem, or `null`.
 */
function partProblem(part: KindPart, text: string, required: boolean): KindProblem | null {
  if (text.includes('\r')) {
    return { kind: 'carriageReturn', part };
  }
  const shape = PART_SHAPE[part];
  if (shape === 'oneLine' && text.includes('\n')) {
    return { kind: 'lineBreak', part };
  }
  if (shape === 'list') {
    const read = valuesOfLines(text);
    if ('problem' in read) {
      return read.problem === 'emptyValue'
        ? { kind: 'emptyItem', part }
        : required
          ? { kind: 'required', part }
          : null;
    }
    return null;
  }
  return required && text === '' ? { kind: 'required', part } : null;
} // End of function partProblem()

/**
 * The form as owned plain values, each property read **exactly once** — the
 * 4-14-1 review's first finding. A form is validated and spent from one of
 * these, never from the form itself: a property read runs arbitrary code
 * through a getter or a `Proxy` trap (`CLAUDE.md` §6, *a check and a spend
 * separated by any property read are not atomic*), so a second read could
 * answer a text the check never saw. What TypeScript cannot force is that a
 * caller hands every later step the snapshot rather than the form; every
 * function of this module that validates or builds does.
 */
interface KindSnapshot {
  /** The kind, read once. */
  readonly kind: NewVariableKind;
  /** The name, read once. */
  readonly name: string;
  /** The kind's own parts' texts, each read once, in writing order. */
  readonly texts: ReadonlyMap<KindPart, string>;
}

/**
 * Reads a form once into owned plain values: the kind, the name, and each of
 * that kind's own parts.
 *
 * @param draft - The form.
 * @returns The snapshot.
 */
function snapshotOf(draft: KindDraft): KindSnapshot {
  const kind = draft.kind;
  const name = String(draft.name);
  const parts = draft.parts;
  const texts = new Map<KindPart, string>();
  for (const part of PARTS_OF_KIND[kind] ?? []) {
    texts.set(part, String(parts[part]));
  } // End of the loop over the kind's own parts
  return { kind, name, texts };
} // End of function snapshotOf()

/**
 * One part's text from a snapshot.
 *
 * @param snapshot - The snapshot.
 * @param part - The part.
 * @returns Its text, `''` for a part the kind does not own.
 */
function textOf(snapshot: KindSnapshot, part: KindPart): string {
  return snapshot.texts.get(part) ?? '';
} // End of function textOf()

/**
 * The first problem a snapshot has, in part order: the name's carriage return
 * first, then each owned part's.
 *
 * @param snapshot - The snapshot.
 * @returns The problem, or `null` when it is ready.
 */
function snapshotProblem(snapshot: KindSnapshot): KindProblem | null {
  if (snapshot.name.includes('\r')) {
    return { kind: 'carriageReturn', part: 'name' };
  }
  for (const [part, text] of snapshot.texts) {
    const problem = partProblem(part, text, REQUIRED_PART[snapshot.kind] === part);
    if (problem !== null) {
      return problem;
    }
  } // End of the loop over the kind's own parts
  return null;
} // End of function snapshotProblem()

/**
 * The first problem the form has for its kind, in part order: the name's
 * carriage return first, then each owned part's. Read from one snapshot.
 *
 * @param draft - The form.
 * @returns The problem, or `null` when the form is ready.
 */
export function kindProblemOf(draft: KindDraft): KindProblem | null {
  return snapshotProblem(snapshotOf(draft));
} // End of function kindProblemOf()

/**
 * The warnings one owned part's text earns. A blank part earns none: it is not
 * written.
 *
 * @param part - The part.
 * @param text - Its text.
 * @returns The warnings, in a fixed order.
 */
function partWarnings(part: KindPart, text: string): readonly KindWarning[] {
  if (text === '') {
    return [];
  }
  const warnings: KindWarning[] = [];
  if (part === 'offset' && !/^[+-]?[0-9]+$/.test(text)) {
    warnings.push({ code: 'offsetNotAnInteger', part });
  }
  if ((part === 'trim' || part === 'debug') && text !== 'true' && text !== 'false') {
    warnings.push({ code: 'notTrueOrFalse', part });
  }
  if (part === 'shell' && !KNOWN_SHELLS.includes(text)) {
    warnings.push({ code: 'unfamiliarShell', part });
  }
  if (part === 'format' && !text.includes('%')) {
    warnings.push({ code: 'formatWithoutSpecifier', part });
  }
  if (PART_SHAPE[part] === 'oneLine' && text.trim() !== text) {
    warnings.push({ code: 'surroundingSpace', part });
  }
  return warnings;
} // End of function partWarnings()

/**
 * Every warning the form's kind's own parts earn, in part order.
 *
 * @param draft - The form.
 * @returns The warnings.
 */
export function kindWarningsOf(draft: KindDraft): readonly KindWarning[] {
  return [...snapshotOf(draft).texts].flatMap(([part, text]) => partWarnings(part, text));
} // End of function kindWarningsOf()

/**
 * The items a list part of an already validated snapshot holds.
 *
 * @param text - The snapshot's text, already free of problems.
 * @returns The items, exactly as typed.
 */
function itemsOf(text: string): string[] {
  const read = valuesOfLines(text);
  return 'values' in read ? [...read.values] : [];
} // End of function itemsOf()

/**
 * The kind's closed parameters, from a validated snapshot's texts — exactly one
 * `NewVariableParams` variant, every text as typed and every blank optional part
 * `null`. Nothing here reads the form.
 *
 * @param snapshot - The snapshot, already free of problems.
 * @returns The parameters.
 */
function paramsOf(snapshot: KindSnapshot): NewVariableParams {
  /**
   * One part's text.
   *
   * @param part - The part.
   * @returns Its text.
   */
  const text = (part: KindPart): string => textOf(snapshot, part);
  switch (snapshot.kind) {
    case 'date':
      return {
        Date: {
          format: optional(text('format')),
          offset: optional(text('offset')),
          tz: optional(text('tz')),
          locale: optional(text('locale'))
        }
      };
    case 'random':
      return { Random: { choices: itemsOf(text('choices')) } };
    case 'echo':
      return { Echo: { echo: text('echo') } };
    case 'clipboard':
      return { Clipboard: {} };
    case 'shell':
      return {
        Shell: {
          cmd: text('cmd'),
          shell: optional(text('shell')),
          trim: optional(text('trim')),
          debug: optional(text('debug'))
        }
      };
    case 'script':
      return { Script: { args: itemsOf(text('args')), trim: optional(text('trim')) } };
    case 'match':
      return { Match: { trigger: text('trigger') } };
  }
} // End of function paramsOf()

/**
 * The closed description the form asks for: its kind's variant, no
 * `inject_vars`, no `depends_on` and no extra parameter — or the first problem.
 *
 * @param draft - The form.
 * @returns The description, or the problem.
 */
export function kindVariableOf(
  draft: KindDraft
): { readonly variable: NewVariable } | { readonly problem: KindProblem } {
  const snapshot = snapshotOf(draft);
  const problem = snapshotProblem(snapshot);
  if (problem !== null) {
    return { problem };
  }
  return {
    variable: {
      name: snapshot.name,
      params: paramsOf(snapshot),
      inject_vars: null,
      depends_on: null,
      extra_params: []
    }
  };
} // End of function kindVariableOf()

// ---------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------

/** One box of the form, as the view draws it. */
export interface KindPartView {
  /** The part — also the espanso key drawn beside the label. */
  readonly part: KindPart;
  /** Which box draws it. */
  readonly shape: PartShape;
  /** Whether the kind requires it. */
  readonly required: boolean;
  /** Whether Rust writes it verbatim as plain source. */
  readonly plainSource: boolean;
  /** What the box holds. */
  readonly text: string;
  /** The warnings its text earns. */
  readonly warnings: readonly KindWarning[];
}

/** What the *Add a variable* form draws beside its controls. */
export interface KindAdditionView {
  /** The chosen kind. */
  readonly kind: NewVariableKind;
  /** The kinds offered, in order. */
  readonly kinds: readonly NewVariableKind[];
  /** The chosen kind's own boxes, in writing order. */
  readonly parts: readonly KindPartView[];
  /**
   * The name check's verdict — as a name, not a reference, for an *Add*; under
   * an open scope `available` reads "available among visible names".
   */
  readonly verdict: NameVerdict;
  /** Why the form cannot be drafted, or `null` when it is ready. */
  readonly problem: KindProblem | null;
  /** Every warning, in part order. */
  readonly warnings: readonly KindWarning[];
  /** Why no variable can be added now, or `null`. */
  readonly withheld: AdditionWithheld;
  /**
   * Whether espanso runs a command for this kind when the snippet expands —
   * `shell` and `script`. The form says so, and that this application never
   * runs it.
   */
  readonly executes: boolean;
  /**
   * Whether espanso reads the clipboard for this kind when the snippet expands —
   * `clipboard`. The form says so, and that this application never reads it.
   */
  readonly readsClipboard: boolean;
  /** Whether *Add* would draft it. */
  readonly canAdd: boolean;
}

/**
 * What the *Add a variable* form says about its current value.
 *
 * @param session - The editing session.
 * @param context - The names, from `nameContextOf`.
 * @param grant - The structure grant, from the view's read.
 * @param draft - The form.
 * @returns The view.
 */
export function kindAdditionViewOf(
  session: MatchEditorSession,
  context: NameContext,
  grant: VariableStructureGrant,
  draft: KindDraft
): KindAdditionView {
  const snapshot = snapshotOf(draft);
  const kind = snapshot.kind;
  const parts: KindPartView[] = [...snapshot.texts].map(([part, text]) => ({
    part,
    shape: PART_SHAPE[part],
    required: REQUIRED_PART[kind] === part,
    plainSource: PLAIN_SOURCE_PARTS.includes(part),
    text,
    warnings: partWarnings(part, text)
  }));
  const verdict = nameVerdictOf(snapshot.name, context, false);
  const problem = snapshotProblem(snapshot);
  const withheld = additionWithheldOf(session, grant);
  return {
    kind,
    kinds: NEW_VARIABLE_KINDS,
    parts,
    verdict,
    problem,
    warnings: parts.flatMap((one) => one.warnings),
    withheld,
    executes: kind === 'shell' || kind === 'script',
    readsClipboard: kind === 'clipboard',
    canAdd: withheld === null && problem === null && verdict.kind === 'available'
  };
} // End of function kindAdditionViewOf()

// ---------------------------------------------------------------------------
// The two presses
// ---------------------------------------------------------------------------

/** What pressing *Add* or *Insert* did. */
export type KindOutcome =
  | InsertOutcome
  | {
      /** The form could not be drafted; nothing was. */
      readonly kind: 'problem';
      /** The same session. */
      readonly session: MatchEditorSession;
      /** Why. */
      readonly problem: KindProblem;
    };

/**
 * *Add*: the new variable at the end of `vars`, with no reference inserted
 * anywhere, as **one** history step and one save (`addVariable` in
 * `./variableInsertion.ts`, which checks the grant, the addition, the name and
 * every text — a carriage return among them).
 *
 * @param session - The editing session.
 * @param grant - The structure grant, minted from a read taken at the press.
 * @param context - The names, from `nameContextOf` at the press.
 * @param draft - The form.
 * @returns What happened.
 */
export function addKindVariable(
  session: MatchEditorSession,
  grant: VariableStructureGrant,
  context: NameContext,
  draft: KindDraft
): KindOutcome {
  const described = kindVariableOf(draft);
  if ('problem' in described) {
    return { kind: 'problem', session, problem: described.problem };
  }
  return addVariable(session, grant, context, described.variable);
} // End of function addKindVariable()

/**
 * *Insert*: `{{name}}` in place of one content key's selection and the new
 * variable at the end of `vars`, as **one** history step and one save
 * (`insertVariable` in `./variableInsertion.ts`). The content key must be one
 * `choiceTargetsOf` offers — a reference is never the reason a new content key
 * appears. Step 4-15's `+ Insert` rows press this; no screen does yet.
 *
 * @param session - The editing session.
 * @param grant - The structure grant, minted from a read taken at the press.
 * @param context - The names, from `nameContextOf` at the press.
 * @param draft - The form.
 * @param target - The content key the reference goes into.
 * @param selection - Its box's selection, in UTF-16 code units; a non-integer
 *   is the end of the text.
 * @returns What happened.
 */
export function insertKindVariable(
  session: MatchEditorSession,
  grant: VariableStructureGrant,
  context: NameContext,
  draft: KindDraft,
  target: ReferenceField,
  selection: TextSelection
): KindOutcome {
  if (!choiceTargetsOf(session).includes(target)) {
    return { kind: 'problem', session, problem: { kind: 'noTarget' } };
  }
  const described = kindVariableOf(draft);
  if ('problem' in described) {
    return { kind: 'problem', session, problem: described.problem };
  }
  return insertVariable(session, grant, context, { field: target, selection, variable: described.variable });
} // End of function insertKindVariable()

// ---------------------------------------------------------------------------
// What a drafted new variable holds, for the selected addition's panel
// ---------------------------------------------------------------------------

/** One parameter a drafted new variable will be written with. */
export interface AddedParam {
  /** The espanso key. */
  readonly key: string;
  /** Its value, or its items, exactly as drafted. */
  readonly texts: readonly string[];
}

/**
 * The parameters a drafted new variable of one of the seven kinds will be
 * written with, in Rust's writing order, each set one with its texts — for the
 * selected addition's panel. A `choice` or a `form` answers `[]`: their panels
 * are 4-11's and 4-12's.
 *
 * @param params - The drafted parameters.
 * @returns The parameters.
 */
export function addedParamsOf(params: NewVariableParams): readonly AddedParam[] {
  const out: AddedParam[] = [];
  /**
   * Records one parameter when it is set.
   *
   * @param key - The espanso key.
   * @param value - Its value, its items, or `null`.
   */
  const put = (key: string, value: string | readonly string[] | null): void => {
    if (value !== null) {
      out.push({ key, texts: typeof value === 'string' ? [value] : [...value] });
    }
  }; // End of function put()
  if ('Date' in params) {
    put('format', params.Date.format);
    put('offset', params.Date.offset);
    put('tz', params.Date.tz);
    put('locale', params.Date.locale);
  } else if ('Random' in params) {
    put('choices', params.Random.choices);
  } else if ('Echo' in params) {
    put('echo', params.Echo.echo);
  } else if ('Shell' in params) {
    put('cmd', params.Shell.cmd);
    put('shell', params.Shell.shell);
    put('trim', params.Shell.trim);
    put('debug', params.Shell.debug);
  } else if ('Script' in params) {
    put('args', params.Script.args);
    put('trim', params.Script.trim);
  } else if ('Match' in params) {
    put('trigger', params.Match.trigger);
  }
  return out;
} // End of function addedParamsOf()

// ---------------------------------------------------------------------------
// Sentences: codes to keys
// ---------------------------------------------------------------------------

/**
 * The dictionary key holding one kind's name.
 *
 * @param kind - The kind.
 * @returns The key.
 */
export function newVariableKindKey(kind: NewVariableKind): TranslationKey {
  switch (kind) {
    case 'date':
      return 'browser.variableKinds.kind.date';
    case 'random':
      return 'browser.variableKinds.kind.random';
    case 'echo':
      return 'browser.variableKinds.kind.echo';
    case 'clipboard':
      return 'browser.variableKinds.kind.clipboard';
    case 'shell':
      return 'browser.variableKinds.kind.shell';
    case 'script':
      return 'browser.variableKinds.kind.script';
    case 'match':
      return 'browser.variableKinds.kind.match';
  }
} // End of function newVariableKindKey()

/**
 * The dictionary key holding one part's label.
 *
 * @param part - The part.
 * @returns The key.
 */
export function kindPartKey(part: KindPart): TranslationKey {
  switch (part) {
    case 'format':
      return 'browser.variableKinds.part.format';
    case 'offset':
      return 'browser.variableKinds.part.offset';
    case 'tz':
      return 'browser.variableKinds.part.tz';
    case 'locale':
      return 'browser.variableKinds.part.locale';
    case 'choices':
      return 'browser.variableKinds.part.choices';
    case 'echo':
      return 'browser.variableKinds.part.echo';
    case 'cmd':
      return 'browser.variableKinds.part.cmd';
    case 'shell':
      return 'browser.variableKinds.part.shell';
    case 'trim':
      return 'browser.variableKinds.part.trim';
    case 'debug':
      return 'browser.variableKinds.part.debug';
    case 'args':
      return 'browser.variableKinds.part.args';
    case 'trigger':
      return 'browser.variableKinds.part.trigger';
  }
} // End of function kindPartKey()

/**
 * The dictionary key holding one problem's sentence; each takes the part's key
 * as `{part}` (the name's problem takes `name`).
 *
 * @param problem - The problem.
 * @returns The key.
 */
export function kindProblemKey(problem: KindProblem): TranslationKey {
  switch (problem.kind) {
    case 'required':
      return 'browser.variableKinds.problem.required';
    case 'emptyItem':
      return 'browser.variableKinds.problem.emptyItem';
    case 'carriageReturn':
      return 'browser.variableKinds.problem.carriageReturn';
    case 'lineBreak':
      return 'browser.variableKinds.problem.lineBreak';
    case 'noTarget':
      return 'browser.variableGroup.choice.noTarget';
  }
} // End of function kindProblemKey()

/**
 * The dictionary key holding one warning's sentence; each takes the part's key
 * as `{part}`.
 *
 * @param warning - The warning.
 * @returns The key.
 */
export function kindWarningKey(warning: KindWarning): TranslationKey {
  switch (warning.code) {
    case 'offsetNotAnInteger':
      return 'browser.variableKinds.warning.offsetNotAnInteger';
    case 'notTrueOrFalse':
      return 'browser.variableKinds.warning.notTrueOrFalse';
    case 'unfamiliarShell':
      return 'browser.variableKinds.warning.unfamiliarShell';
    case 'formatWithoutSpecifier':
      return 'browser.variableKinds.warning.formatWithoutSpecifier';
    case 'surroundingSpace':
      return 'browser.variableKinds.warning.surroundingSpace';
  }
} // End of function kindWarningKey()

/**
 * The dictionary key holding one edit refusal's sentence; it takes the box's
 * key as `{part}`.
 *
 * @param reason - Why the edit was not taken.
 * @returns The key.
 */
export function kindEditRefusalKey(reason: KindEditRefusal): TranslationKey {
  switch (reason) {
    case 'carriageReturn':
      return 'browser.variableKinds.problem.carriageReturn';
    case 'lineBreak':
      return 'browser.variableKinds.problem.lineBreak';
  }
} // End of function kindEditRefusalKey()
