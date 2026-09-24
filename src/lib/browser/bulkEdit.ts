/**
 * The bulk option edit's browser model — Phase 3-11-1 (`docs/decisions/3-split-notes.md`
 * §2 step 3-11 and its 2026-09-24 addendum; rulings 19–22).
 *
 * **Decisions as values, drawing nothing.** A person selects several snippets,
 * sees how each of the seven bulk options is written across them (one spelling,
 * none, or *Mixed*), states an intent for some of the options, and applies them
 * through 3-10's `apply_bulk_options`. Everything a screen needs to draw that —
 * the selection and whether it is still current, the per-option summary, the
 * intents and their undo history, the exclusions, what blocks a submission, the
 * consent review and the partial outcome — is decided here; 3-11-2's components
 * draw these values and decide nothing.
 *
 * ## The seven options, and nothing else can be submitted (ruling 20)
 *
 * {@link BULK_OPTIONS} is the only list {@link bulkChangesOf} reads, so an
 * intent stored under any other key — `paragraph`, `anchor`, a trigger — is
 * never sent, whatever a cast smuggled into the draft. Rust refuses any other
 * option name while reading the request as well; this is the browser's half.
 *
 * ## Mixed compares exact source spelling, cut in Rust
 *
 * A projected `ScalarView.text` is **decoded**: `true`, `'true'` and `"true"`
 * are one text there and three spellings in the file. So the comparison is over
 * `match_option_spellings`, which cuts each option's bytes out of the file in
 * Rust; this module never slices a byte span out of a JavaScript string.
 * *Mixed* is a display state. An option the person did not touch is absent from
 * the intents, so an untouched *Mixed* control emits nothing — there is no
 * "keep" value to send, because `BulkValue` has none.
 *
 * ## A stale selection blocks (D2v, R27)
 *
 * A selected `MatchId` names one parse. When the live projection of its file has
 * moved on, or a spelling read answered `identityStaleRevision`, the selection is
 * stale and {@link prepareBulkApply} refuses to build a request. Nothing here
 * re-resolves a stale identity to whatever now sits at its node.
 *
 * ## Exclusions and open editors
 *
 * A snippet the visual editor may not write (`safely_editable: false`, or a
 * blocking hazard) is excluded. A file with **any** match editor open is
 * excluded whole, through `documentHasUnsavedDraft` in `./matchDuplication.ts`:
 * a committed bulk save invalidates every `MatchId` in that file, so the open
 * editor would be stranded. That predicate measures an open editor, not a dirty
 * one, and the sentence for the exclusion says so; it never claims unsaved edits
 * exist. A file whose every selected snippet is excluded travels in the request's
 * `excluded` list, so the answer accounts for it.
 *
 * ## Consent is per file, base revision, intent and candidate (ruling 22)
 *
 * {@link acknowledgeBulkRefusal} is the one producer of a {@link BulkConsentGrant}:
 * it takes a `refused` outcome of **this** submission and binds the exact
 * findings to the file, the base revision, the intent fingerprint and the
 * candidate Rust reported, plus this module's own key of the file's selection and
 * changes. {@link prepareBulkApply} attaches a grant only while that key still
 * matches, so a changed intent or selection drops the consent that covered it
 * rather than sending it to be refused as stale. There is no batch-wide bit and
 * no force flag. TypeScript does not stop a caller from writing a grant literal;
 * the Rust preflight is what refuses one that does not match.
 *
 * ## Partial outcomes, and no disk undo
 *
 * {@link summarizeBulkResult} counts exclusions (before apply) and execution
 * outcomes separately, and never reports a committed file as a failure. Undo is
 * the **draft's** ({@link undoBulkDraft}): it restores the unsaved intents and
 * touches no file. Nothing in this module, and no sentence it names, offers to
 * undo a save.
 */

import type { TranslationKey } from '../i18n/dictionaries';
import type { CommandResult } from '../ipc/commands';
import type { IpcFailure } from '../ipc/errors';
import type {
  Acknowledgement,
  BulkConsent,
  BulkFileOutcome,
  BulkFileOutcomeName,
  BulkOption,
  BulkOptionChange,
  BulkOptionSpellings,
  BulkOptionsRequest,
  BulkResult,
  BulkValue,
  ContentRevision,
  DocumentId,
  DocumentView,
  Finding,
  MatchId,
  OptionSpelling,
  SaveVerdict
} from '../ipc/types';
import { HISTORY_LIMIT, deepFreeze } from './draft';
import type { InvalidationStatus } from './invalidation';
import { documentHasUnsavedDraft } from './matchDuplication';
import { refusalAcknowledgement } from './rawSave';

// ---------------------------------------------------------------------------
// The seven options
// ---------------------------------------------------------------------------

/**
 * The seven options a bulk edit may write (ruling 20), in the core's
 * `BulkOption::ALL` order. The only list {@link bulkChangesOf} reads.
 */
export const BULK_OPTIONS: readonly BulkOption[] = Object.freeze([
  'word',
  'left_word',
  'right_word',
  'propagate_case',
  'uppercase_style',
  'force_mode',
  'force_clipboard'
] as const);

/**
 * Whether a value is one of the seven bulk options.
 *
 * @param value - Anything.
 * @returns `true` only for one of {@link BULK_OPTIONS}.
 */
export function isBulkOption(value: unknown): value is BulkOption {
  return typeof value === 'string' && (BULK_OPTIONS as readonly string[]).includes(value);
} // End of function isBulkOption()

// ---------------------------------------------------------------------------
// The selection and its staleness
// ---------------------------------------------------------------------------

/** The selected snippets, in the order they were selected, each at most once. */
export type BulkSelection = readonly MatchId[];

/** The empty selection. */
export const EMPTY_BULK_SELECTION: BulkSelection = Object.freeze([]);

/**
 * Whether two identities are the same snippet of the same parse.
 *
 * All three fields: an identity from another revision is another snippet as far
 * as this model is concerned (D2v).
 *
 * @param left - One identity.
 * @param right - The other.
 * @returns `true` when document, revision and node all agree.
 */
export function sameMatchId(left: MatchId, right: MatchId): boolean {
  return (
    left.document === right.document && left.revision === right.revision && left.node === right.node
  );
} // End of function sameMatchId()

/**
 * A string that names one identity, for keying reads by it.
 *
 * @param id - The identity.
 * @returns The key.
 */
export function matchKeyOf(id: MatchId): string {
  return `${id.document}:${id.revision}:${id.node}`;
} // End of function matchKeyOf()

/**
 * Whether one snippet is in the selection.
 *
 * @param selection - The selection.
 * @param id - The snippet.
 * @returns `true` when it is selected.
 */
export function isInBulkSelection(selection: BulkSelection, id: MatchId): boolean {
  return selection.some((held) => sameMatchId(held, id));
} // End of function isInBulkSelection()

/**
 * Adds a snippet to the selection, or takes it out when it is already in it.
 *
 * The identity is copied, so a later change to the caller's object changes
 * nothing here.
 *
 * @param selection - The selection.
 * @param id - The snippet.
 * @returns The new selection.
 */
export function toggleInBulkSelection(selection: BulkSelection, id: MatchId): BulkSelection {
  if (isInBulkSelection(selection, id)) {
    return Object.freeze(selection.filter((held) => !sameMatchId(held, id)));
  }
  const owned: MatchId = Object.freeze({ document: id.document, revision: id.revision, node: id.node });
  return Object.freeze([...selection, owned]);
} // End of function toggleInBulkSelection()

/**
 * Whether the selection still describes the live projections.
 *
 * `stale` names every file whose projection no longer holds a selected identity,
 * and every file a spelling read answered `identityStaleRevision` for.
 */
export type BulkSelectionFreshness =
  | { readonly kind: 'current' }
  | { readonly kind: 'stale'; readonly documents: readonly DocumentId[] };

/**
 * Whether every selected identity is still one the window's live projections
 * hold — its file projected at the identity's revision, holding its node.
 *
 * A file the window no longer projects makes the selection stale too: there is
 * no live projection to vouch for the identity.
 *
 * @param selection - The selection.
 * @param views - The live projections, as the window holds them now.
 * @param reads - The spelling reads taken so far, keyed by {@link matchKeyOf}.
 *   A `stale` read makes its file stale whatever the projection says.
 * @returns `current`, or `stale` with the files concerned in selection order.
 */
export function bulkSelectionFreshness(
  selection: BulkSelection,
  views: readonly DocumentView[],
  reads: ReadonlyMap<string, SpellingRead>
): BulkSelectionFreshness {
  const stale: DocumentId[] = [];
  for (const id of selection) {
    const view = views.find((held) => held.id === id.document);
    const inView =
      view !== undefined &&
      view.revision === id.revision &&
      view.matches.some((match) => sameMatchId(match.id, id));
    const readStale = reads.get(matchKeyOf(id))?.kind === 'stale';
    if ((!inView || readStale) && !stale.includes(id.document)) {
      stale.push(id.document);
    }
  } // End of the loop over the selected identities
  return stale.length === 0 ? { kind: 'current' } : { kind: 'stale', documents: stale };
} // End of function bulkSelectionFreshness()

// ---------------------------------------------------------------------------
// Spellings and the Mixed summary
// ---------------------------------------------------------------------------

/**
 * What one `match_option_spellings` read produced.
 *
 * `stale` is the identity refusal R27 names — the file moved on — and it is
 * **handled, never unwrapped**: it makes the selection stale. Any other failure
 * is carried whole.
 */
export type SpellingRead =
  | { readonly kind: 'read'; readonly spellings: BulkOptionSpellings }
  | { readonly kind: 'stale' }
  | { readonly kind: 'failed'; readonly failure: IpcFailure };

/**
 * Classifies one spelling read.
 *
 * @param answer - What `BrowserState.matchOptionSpellings` answered.
 * @returns The read, `stale` for `identityStaleRevision`, or `failed`.
 */
export function spellingReadOf(answer: CommandResult<BulkOptionSpellings>): SpellingRead {
  if (answer.ok) {
    return { kind: 'read', spellings: answer.value };
  }
  if (answer.failure.kind === 'command' && answer.failure.error.code === 'identityStaleRevision') {
    return { kind: 'stale' };
  }
  return { kind: 'failed', failure: answer.failure };
} // End of function spellingReadOf()

/**
 * How one option is written across the selection.
 *
 * - `unknown` — at least one selected snippet has no successful read yet;
 * - `absent` — no selected snippet writes it;
 * - `same` — every selected snippet writes it spelled exactly `source`;
 * - `notOneScalar` — every selected snippet writes it, none as one scalar;
 * - `mixed` — presence or spelling differs between the selected snippets.
 *
 * **Display only**: nothing built from a summary is ever sent.
 */
export type OptionSummary =
  | { readonly kind: 'unknown' }
  | { readonly kind: 'absent' }
  | { readonly kind: 'same'; readonly source: string }
  | { readonly kind: 'notOneScalar' }
  | { readonly kind: 'mixed' };

/** The summary kinds a sentence is drawn for; `same` draws the file's own bytes. */
export type WordedOptionSummary = Exclude<OptionSummary['kind'], 'same'>;

/**
 * A key that is equal for two spellings exactly when they are the same
 * presence and the same bytes.
 *
 * @param spelling - One spelling.
 * @returns The comparison key.
 */
function spellingKey(spelling: OptionSpelling): string {
  if ('Written' in spelling) {
    return `written:${spelling.Written.source}`;
  }
  return 'Absent' in spelling ? 'absent' : 'notOneScalar';
} // End of function spellingKey()

/**
 * How one option is written across the selection.
 *
 * @param selection - The selection.
 * @param reads - The spelling reads, keyed by {@link matchKeyOf}.
 * @param option - The option.
 * @returns The summary; `unknown` for an empty selection.
 */
export function summarizeOption(
  selection: BulkSelection,
  reads: ReadonlyMap<string, SpellingRead>,
  option: BulkOption
): OptionSummary {
  const seen: OptionSpelling[] = [];
  for (const id of selection) {
    const read = reads.get(matchKeyOf(id));
    if (read === undefined || read.kind !== 'read') {
      return { kind: 'unknown' };
    }
    seen.push(read.spellings[option]);
  } // End of the loop over the selected snippets
  const first = seen[0];
  if (first === undefined) {
    return { kind: 'unknown' };
  }
  const key = spellingKey(first);
  if (!seen.every((spelling) => spellingKey(spelling) === key)) {
    return { kind: 'mixed' };
  }
  if ('Written' in first) {
    return { kind: 'same', source: first.Written.source };
  }
  return 'Absent' in first ? { kind: 'absent' } : { kind: 'notOneScalar' };
} // End of function summarizeOption()

// ---------------------------------------------------------------------------
// The drafted intents, and their undo
// ---------------------------------------------------------------------------

/**
 * The intents drafted so far: an option with a value is touched, and an option
 * with none is untouched and emits nothing.
 */
export type BulkIntents = Readonly<Partial<Record<BulkOption, BulkValue>>>;

/**
 * The unsaved bulk draft: the intents now, and the history undo and redo walk.
 *
 * **Undo restores the unsaved intents and nothing else** (ruling 21). No member
 * of this value, and nothing in this module, names a save, a file or a revision
 * it could undo.
 */
export interface BulkDraft {
  /** The intents the controls hold now. */
  readonly intents: BulkIntents;
  /** Earlier intents, oldest first, at most `HISTORY_LIMIT` of them. */
  readonly past: readonly BulkIntents[];
  /** Undone intents, next-to-redo first. Emptied by any edit. */
  readonly future: readonly BulkIntents[];
}

/** A draft with nothing touched and no history. */
export const EMPTY_BULK_DRAFT: BulkDraft = deepFreeze({ intents: {}, past: [], future: [] });

/**
 * Whether two intents are the same, option by option.
 *
 * @param left - One set of intents.
 * @param right - The other.
 * @returns `true` when every option holds the same intent in both.
 */
function sameIntents(left: BulkIntents, right: BulkIntents): boolean {
  return BULK_OPTIONS.every((option) => sameValue(left[option], right[option]));
} // End of function sameIntents()

/**
 * Whether two intents for one option are the same.
 *
 * @param left - One intent, or `undefined` for untouched.
 * @param right - The other.
 * @returns `true` when both are untouched, both remove, or both set the same text.
 */
function sameValue(left: BulkValue | undefined, right: BulkValue | undefined): boolean {
  if (left === undefined || right === undefined || left === 'Remove' || right === 'Remove') {
    return left === right;
  }
  return left.Set === right.Set;
} // End of function sameValue()

/**
 * Records new intents as one undoable step.
 *
 * @param draft - The draft.
 * @param next - The intents the controls now hold.
 * @returns The draft after the edit, or the same draft when nothing changed.
 */
function recordIntents(draft: BulkDraft, next: BulkIntents): BulkDraft {
  if (sameIntents(draft.intents, next)) {
    return draft;
  }
  const grown = [...draft.past, draft.intents];
  return deepFreeze({
    intents: next,
    past: grown.length > HISTORY_LIMIT ? grown.slice(grown.length - HISTORY_LIMIT) : grown,
    future: []
  });
} // End of function recordIntents()

/**
 * Sets one option's intent: a source text to write verbatim, or its removal.
 *
 * **Only the seven options are accepted.** Any other key leaves the draft as it
 * is, so a cast cannot put a field ruling 20 does not allow into the intents.
 *
 * @param draft - The draft.
 * @param option - The option.
 * @param value - `{ Set: text }` or `'Remove'`.
 * @returns The draft with the intent recorded as one undoable step.
 */
export function setBulkIntent(draft: BulkDraft, option: BulkOption, value: BulkValue): BulkDraft {
  if (!isBulkOption(option)) {
    return draft;
  }
  const owned: BulkValue = value === 'Remove' ? 'Remove' : { Set: value.Set };
  return recordIntents(draft, { ...draft.intents, [option]: owned });
} // End of function setBulkIntent()

/**
 * Returns one option to untouched, so it emits nothing again.
 *
 * @param draft - The draft.
 * @param option - The option.
 * @returns The draft with that option untouched, as one undoable step.
 */
export function clearBulkIntent(draft: BulkDraft, option: BulkOption): BulkDraft {
  const next: Partial<Record<BulkOption, BulkValue>> = { ...draft.intents };
  delete next[option];
  return recordIntents(draft, next);
} // End of function clearBulkIntent()

/**
 * Whether {@link undoBulkDraft} would change anything.
 *
 * @param draft - The draft.
 * @returns `true` when there is an earlier set of intents.
 */
export function canUndoBulkDraft(draft: BulkDraft): boolean {
  return draft.past.length > 0;
} // End of function canUndoBulkDraft()

/**
 * Whether {@link redoBulkDraft} would change anything.
 *
 * @param draft - The draft.
 * @returns `true` when there is an undone set of intents.
 */
export function canRedoBulkDraft(draft: BulkDraft): boolean {
  return draft.future.length > 0;
} // End of function canRedoBulkDraft()

/**
 * Goes back one set of intents. Touches no file.
 *
 * @param draft - The draft.
 * @returns The draft one step back, or the same draft when there is no past.
 */
export function undoBulkDraft(draft: BulkDraft): BulkDraft {
  const previous = draft.past[draft.past.length - 1];
  if (previous === undefined) {
    return draft;
  }
  return deepFreeze({
    intents: previous,
    past: draft.past.slice(0, -1),
    future: [draft.intents, ...draft.future]
  });
} // End of function undoBulkDraft()

/**
 * Goes forward one set of intents, undoing an undo. Touches no file.
 *
 * @param draft - The draft.
 * @returns The draft one step forward, or the same draft when there is no future.
 */
export function redoBulkDraft(draft: BulkDraft): BulkDraft {
  const next = draft.future[0];
  if (next === undefined) {
    return draft;
  }
  return deepFreeze({
    intents: next,
    past: [...draft.past, draft.intents],
    future: draft.future.slice(1)
  });
} // End of function redoBulkDraft()

/**
 * The option changes to send: one per touched option, in {@link BULK_OPTIONS}
 * order, and nothing for an untouched one — a *Mixed* control left alone
 * included.
 *
 * **Reads the seven options and nothing else**, so an intent stored under any
 * other key is never sent. Each value is copied into a fresh wire object.
 *
 * @param intents - The drafted intents.
 * @returns The changes, possibly none.
 */
export function bulkChangesOf(intents: BulkIntents): readonly BulkOptionChange[] {
  const changes: BulkOptionChange[] = [];
  for (const option of BULK_OPTIONS) {
    const value = intents[option];
    if (value === 'Remove') {
      changes.push({ option, value: 'Remove' });
    } else if (value !== undefined && typeof value.Set === 'string') {
      changes.push({ option, value: { Set: value.Set } });
    }
  } // End of the loop over the seven options
  return changes;
} // End of function bulkChangesOf()

/** What one option's control shows: its summary beside its intent. */
export interface BulkControl {
  /** The option, spelled as its espanso key. */
  readonly option: BulkOption;
  /** How the selection writes it now. */
  readonly summary: OptionSummary;
  /** What the person asked for, or `untouched`. */
  readonly intent: 'untouched' | 'set' | 'remove';
  /** The text of a `set` intent, or `null`. */
  readonly text: string | null;
  /**
   * Whether the control shows *Mixed*: the selection disagrees and the person
   * has not touched it, so it emits nothing.
   */
  readonly showsMixed: boolean;
}

/**
 * The seven controls, in {@link BULK_OPTIONS} order.
 *
 * @param selection - The selection.
 * @param reads - The spelling reads, keyed by {@link matchKeyOf}.
 * @param intents - The drafted intents.
 * @returns One control per option.
 */
export function bulkControls(
  selection: BulkSelection,
  reads: ReadonlyMap<string, SpellingRead>,
  intents: BulkIntents
): readonly BulkControl[] {
  return BULK_OPTIONS.map((option) => {
    const summary = summarizeOption(selection, reads, option);
    const value = intents[option];
    const intent = value === undefined ? 'untouched' : value === 'Remove' ? 'remove' : 'set';
    return {
      option,
      summary,
      intent,
      text: value !== undefined && value !== 'Remove' ? value.Set : null,
      showsMixed: summary.kind === 'mixed' && intent === 'untouched'
    };
  });
} // End of function bulkControls()

// ---------------------------------------------------------------------------
// Exclusions and the plan
// ---------------------------------------------------------------------------

/**
 * Why a selected snippet is left out of the apply.
 *
 * - `readOnly` — the visual editor may not write it (a blocking hazard, or the
 *   core's `safely_editable: false`);
 * - `editorOpen` — a match editor is open over some snippet of its file. That is
 *   what `documentHasUnsavedDraft` measures: an **open** editor, never a dirty
 *   one, and the sentence claims no more.
 */
export type BulkExclusionReason = 'readOnly' | 'editorOpen';

/** One selected snippet left out, and why. */
export interface BulkExclusion {
  /** The snippet. */
  readonly match: MatchId;
  /** Why. */
  readonly reason: BulkExclusionReason;
}

/** One file the apply will write, with what it sends for it. */
export interface BulkPlannedFile {
  /** The file. */
  readonly document: DocumentId;
  /** The revision its live projection holds — the base the request names. */
  readonly baseRevision: ContentRevision;
  /** Its selected, included snippets, in selection order. */
  readonly matches: readonly MatchId[];
}

/** What an apply would send, and what it leaves out. */
export interface BulkPlan {
  /** The files to write, in the order their first snippet was selected. */
  readonly files: readonly BulkPlannedFile[];
  /** Files whose every selected snippet is excluded, sent as `excluded`. */
  readonly excludedFiles: readonly DocumentId[];
  /** Every excluded snippet, in selection order. */
  readonly exclusions: readonly BulkExclusion[];
}

/**
 * Splits the selection into the files an apply writes and the snippets it
 * leaves out.
 *
 * Takes the live projections and the open editors as arguments, because the
 * editors are held by components and this directory is what a test reaches. A
 * snippet with no live projection is neither planned nor excluded: the
 * selection is stale, and {@link bulkSelectionFreshness} is what says so.
 *
 * @param selection - The selection.
 * @param views - The live projections.
 * @param openDrafts - Every snippet this window has a match editor open over,
 *   dirty or not.
 * @returns The plan.
 */
export function planBulkApply(
  selection: BulkSelection,
  views: readonly DocumentView[],
  openDrafts: readonly MatchId[]
): BulkPlan {
  const files: { document: DocumentId; baseRevision: ContentRevision; matches: MatchId[] }[] = [];
  const touched: DocumentId[] = [];
  const exclusions: BulkExclusion[] = [];
  for (const id of selection) {
    const view = views.find((held) => held.id === id.document);
    const match = view?.matches.find((held) => sameMatchId(held.id, id));
    if (view === undefined || match === undefined || view.revision !== id.revision) {
      continue;
    }
    if (!touched.includes(id.document)) {
      touched.push(id.document);
    }
    if (documentHasUnsavedDraft(id.document, openDrafts)) {
      exclusions.push({ match: id, reason: 'editorOpen' });
      continue;
    }
    if (!match.safely_editable || match.blocking_hazard !== null) {
      exclusions.push({ match: id, reason: 'readOnly' });
      continue;
    }
    const file = files.find((held) => held.document === id.document);
    if (file === undefined) {
      files.push({ document: id.document, baseRevision: view.revision, matches: [id] });
    } else {
      file.matches.push(id);
    }
  } // End of the loop over the selected identities
  return deepFreeze({
    files,
    excludedFiles: touched.filter((document) => !files.some((file) => file.document === document)),
    exclusions
  });
} // End of function planBulkApply()

// ---------------------------------------------------------------------------
// Consent (ruling 22)
// ---------------------------------------------------------------------------

/**
 * Consent collected for one file of one submission.
 *
 * `key` is this module's fingerprint of the file's base revision, selection and
 * changes when the consent was collected; {@link prepareBulkApply} attaches the
 * consent only while the current request has the same key.
 */
export interface BulkConsentGrant {
  /** {@link bulkFileKey} of the file the consent was collected for. */
  readonly key: string;
  /** The consent, exactly as the request carries it. */
  readonly consent: BulkConsent;
}

/**
 * A fingerprint of one file of a request: its document, base revision, ordered
 * selection and the request's ordered changes.
 *
 * A browser-side key only. The authority is Rust's own intent fingerprint, which
 * the consent carries and the preflight compares.
 *
 * @param file - The planned file.
 * @param changes - The request's changes.
 * @returns The key.
 */
export function bulkFileKey(file: BulkPlannedFile, changes: readonly BulkOptionChange[]): string {
  return JSON.stringify([
    file.document,
    file.baseRevision,
    file.matches.map((id) => [id.document, id.revision, id.node]),
    changes.map((change) => [
      change.option,
      change.value === 'Remove' ? null : change.value.Set
    ])
  ]);
} // End of function bulkFileKey()

/** One request, with the keys its files were built under. */
export interface BulkSubmission {
  /** The request to hand `BrowserState.applyBulkOptions`. */
  readonly request: BulkOptionsRequest;
  /** One key per applied file, in request order. */
  readonly keys: readonly { readonly document: DocumentId; readonly key: string }[];
}

/** One refused file of an answer, as a consent review draws it. */
export interface BulkConsentReviewItem {
  /** The file. */
  readonly document: DocumentId;
  /** Which arm of the policy refused. */
  readonly verdict: SaveVerdict;
  /** Every finding its candidate produced, in report order. */
  readonly findings: readonly Finding[];
  /**
   * Whether acknowledging these findings could let the same request proceed.
   * `false` for a verdict no acknowledgement moves.
   */
  readonly acknowledgeable: boolean;
}

/**
 * The files of an answer that were refused for their findings, for a consent
 * review.
 *
 * @param result - What the bulk edit answered.
 * @returns One item per `refused` file, in the answer's order.
 */
export function bulkConsentReview(result: BulkResult): readonly BulkConsentReviewItem[] {
  const items: BulkConsentReviewItem[] = [];
  for (const report of result.files) {
    if (report.outcome !== 'refused') {
      continue;
    }
    items.push({
      document: report.document,
      verdict: report.verdict,
      findings: report.findings,
      acknowledgeable:
        refusalAcknowledgement({
          outcome: 'refused',
          verdict: report.verdict,
          findings: report.findings
        }) !== null
    });
  } // End of the loop over the answer's files
  return items;
} // End of function bulkConsentReview()

/**
 * Records the consent a person gave to one refused file of **this**
 * submission's answer — the one producer of a {@link BulkConsentGrant}.
 *
 * Refuses, returning the grants unchanged, when the file was not part of the
 * submission, when the answer has no `refused` outcome for it, or when the
 * verdict is one no acknowledgement moves. The acknowledgement is the refusal's
 * own findings, cloned and frozen, so what goes back is the exact multiset the
 * gate reported. A grant for the same file replaces the earlier one.
 *
 * @param grants - The grants held so far.
 * @param submission - What was sent.
 * @param result - What came back for it.
 * @param document - The file the person consented for.
 * @returns The grants with this file's consent recorded, or unchanged.
 */
export function acknowledgeBulkRefusal(
  grants: readonly BulkConsentGrant[],
  submission: BulkSubmission,
  result: BulkResult,
  document: DocumentId
): readonly BulkConsentGrant[] {
  const sent = submission.request.files.find((file) => file.document === document);
  const key = submission.keys.find((entry) => entry.document === document)?.key;
  const report = result.files.find((file) => file.document === document);
  if (sent === undefined || key === undefined || report === undefined || report.outcome !== 'refused') {
    return grants;
  }
  const acknowledgement: Acknowledgement | null = refusalAcknowledgement({
    outcome: 'refused',
    verdict: report.verdict,
    findings: report.findings
  });
  if (acknowledgement === null) {
    return grants;
  }
  const grant: BulkConsentGrant = deepFreeze({
    key,
    consent: {
      document,
      base_revision: sent.base_revision,
      intent: report.intent,
      candidate: report.candidate,
      acknowledgement: structuredClone(acknowledgement)
    }
  });
  return Object.freeze([...grants.filter((held) => held.consent.document !== document), grant]);
} // End of function acknowledgeBulkRefusal()

// ---------------------------------------------------------------------------
// What blocks a submission, and the request
// ---------------------------------------------------------------------------

/**
 * Why a bulk edit cannot be sent now.
 *
 * - `noSelection` — nothing is selected;
 * - `staleSelection` — a selected identity no longer names the live projection;
 * - `noChanges` — no option is touched, so there is nothing to apply;
 * - `emptyValue` — an option is set to an empty text, which no plain scalar
 *   spells (the Rust check would refuse it as not plain source);
 * - `nothingToApply` — every selected snippet is excluded.
 */
export type BulkBlocker =
  | 'noSelection'
  | 'staleSelection'
  | 'noChanges'
  | 'emptyValue'
  | 'nothingToApply';

/** What the model needs to decide whether a request can be built. */
export interface BulkApplyInputs {
  /** The selection. */
  readonly selection: BulkSelection;
  /** The live projections. */
  readonly views: readonly DocumentView[];
  /** The spelling reads, keyed by {@link matchKeyOf}. */
  readonly reads: ReadonlyMap<string, SpellingRead>;
  /** The drafted intents. */
  readonly intents: BulkIntents;
  /** Every snippet this window has a match editor open over, dirty or not. */
  readonly openDrafts: readonly MatchId[];
  /** The consent collected so far. */
  readonly grants: readonly BulkConsentGrant[];
}

/** Whether a request could be built, and the plan either way. */
export type BulkApplyReadiness =
  | {
      /** The discriminant: the request below may be sent. */
      readonly kind: 'ready';
      /** The plan the request was built from. */
      readonly plan: BulkPlan;
      /** The request, with the keys its files were built under. */
      readonly submission: BulkSubmission;
    }
  | {
      /** The discriminant: nothing may be sent. */
      readonly kind: 'blocked';
      /** The plan, so a screen can still draw the exclusions. */
      readonly plan: BulkPlan;
      /** Every reason, in a fixed order; never empty. */
      readonly blockers: readonly BulkBlocker[];
    };

/**
 * Decides whether a bulk edit can be sent now, and builds its request if so.
 *
 * A stale selection **blocks**; nothing here re-resolves it. Consent is attached
 * per file only when its grant's key matches the file as it would be sent now,
 * so consent collected for another selection or other intents is dropped rather
 * than sent.
 *
 * @param inputs - The selection, projections, reads, intents, open editors and
 *   grants.
 * @returns `ready` with the submission, or `blocked` with every reason.
 */
export function prepareBulkApply(inputs: BulkApplyInputs): BulkApplyReadiness {
  const plan = planBulkApply(inputs.selection, inputs.views, inputs.openDrafts);
  const changes = bulkChangesOf(inputs.intents);
  const blockers: BulkBlocker[] = [];
  if (inputs.selection.length === 0) {
    blockers.push('noSelection');
  } else if (bulkSelectionFreshness(inputs.selection, inputs.views, inputs.reads).kind === 'stale') {
    blockers.push('staleSelection');
  }
  if (changes.length === 0) {
    blockers.push('noChanges');
  }
  if (changes.some((change) => change.value !== 'Remove' && change.value.Set === '')) {
    blockers.push('emptyValue');
  }
  if (inputs.selection.length > 0 && plan.files.length === 0 && !blockers.includes('staleSelection')) {
    blockers.push('nothingToApply');
  }
  if (blockers.length > 0) {
    return { kind: 'blocked', plan, blockers };
  }
  const keys = plan.files.map((file) => ({ document: file.document, key: bulkFileKey(file, changes) }));
  const request: BulkOptionsRequest = {
    changes,
    files: plan.files.map((file, index) => {
      const key = keys[index]?.key;
      const grant = inputs.grants.find(
        (held) => held.key === key && held.consent.document === file.document
      );
      return {
        document: file.document,
        base_revision: file.baseRevision,
        matches: file.matches,
        consent: grant === undefined ? null : grant.consent
      };
    }),
    excluded: plan.excludedFiles
  };
  return { kind: 'ready', plan, submission: deepFreeze({ request, keys }) };
} // End of function prepareBulkApply()

// ---------------------------------------------------------------------------
// The answer, per file and as a whole
// ---------------------------------------------------------------------------

/**
 * What `BrowserState.applyBulkOptions` answers.
 *
 * - `answered` — the command ran and accounted for every file; `adoptions` says,
 *   per file that was written or may have been, what became of re-reading it.
 *   **A `failed` adoption never means that file's save failed.**
 * - `notAttempted` — the window holds no projection of a file the request names,
 *   so nothing was sent and nothing can have been written.
 * - `failed` — the command itself rejected (`bulkRefused`, `noWorkspaceOpen`, …)
 *   before any file was read.
 */
export type BulkApplyAnswer =
  | {
      /** The discriminant. */
      readonly kind: 'answered';
      /** What happened to every file. */
      readonly result: BulkResult;
      /** Per written or possibly written file, the re-read's fate. */
      readonly adoptions: readonly {
        readonly document: DocumentId;
        readonly adoption: InvalidationStatus;
      }[];
    }
  | { readonly kind: 'notAttempted' }
  | {
      /** The discriminant. */
      readonly kind: 'failed';
      /** Whether any file may have been written. */
      readonly mayHaveWritten: boolean;
      /** Why the command rejected. */
      readonly failure: IpcFailure;
    };

/**
 * What one file's outcome did to that file, which is what the window's
 * coordination acts on.
 *
 * - `committed` — the file was rewritten: every `MatchId` in it is now stale;
 * - `unchanged` — the save ran and wrote nothing, ending on the revision given;
 * - `uncertain` — the write may have happened; the file is re-read, not trusted;
 * - `nothingWritten` — nothing was written to it.
 */
export type BulkFileEffect =
  | { readonly kind: 'committed'; readonly revision: ContentRevision }
  | { readonly kind: 'unchanged'; readonly revision: ContentRevision }
  | { readonly kind: 'uncertain' }
  | { readonly kind: 'nothingWritten' };

/**
 * What one file's outcome did to that file.
 *
 * @param outcome - One file's outcome.
 * @returns Its effect.
 */
export function bulkFileEffect(outcome: BulkFileOutcome): BulkFileEffect {
  switch (outcome.outcome) {
    case 'saved':
      return { kind: 'committed', revision: outcome.revision };
    case 'alreadyUnchanged':
      return { kind: 'unchanged', revision: outcome.revision };
    case 'writeOutcomeUnknown':
      return { kind: 'uncertain' };
    case 'conflicted':
    case 'refused':
    case 'consentStale':
    case 'blocked':
    case 'failed':
    case 'notAttempted':
    case 'excludedBeforeApply':
      return { kind: 'nothingWritten' };
    default: {
      const unreachable: never = outcome;
      return unreachable;
    }
  } // End of the switch over the ten outcomes
} // End of function bulkFileEffect()

/**
 * The headline of an answer.
 *
 * - `complete` — every applied file was saved or already held the values;
 * - `partial` — some file was saved and some other applied file was not;
 * - `uncertain` — some file's write may have happened and could not be confirmed;
 * - `nothingWritten` — Rust's own `nothing_written`: no file was written.
 */
export type BulkOutcomeHeadline = 'complete' | 'partial' | 'uncertain' | 'nothingWritten';

/** The counts a partial outcome is drawn from. */
export interface BulkOutcomeSummary {
  /** The headline. A committed file is never counted as an error. */
  readonly headline: BulkOutcomeHeadline;
  /** Files rewritten. */
  readonly saved: number;
  /** Files that already held every value; nothing was written or copied. */
  readonly alreadyUnchanged: number;
  /**
   * Applied files that were not written, by execution or preflight outcome:
   * `conflicted`, `refused`, `consentStale`, `blocked` and `failed`. **Never an
   * exclusion.**
   */
  readonly notWritten: number;
  /** Files whose write may have happened. */
  readonly writeOutcomeUnknown: number;
  /** Files the run stopped before. */
  readonly notAttempted: number;
  /**
   * Files excluded before the apply (`excludedBeforeApply`): every selected
   * snippet in them was excluded. **Counted apart from every execution outcome.**
   */
  readonly excludedFiles: number;
  /** Selected snippets excluded before the apply, in files that were applied or not. */
  readonly excludedSnippets: number;
  /** The files rewritten, in answer order. */
  readonly committedDocuments: readonly DocumentId[];
  /** Per outcome, how many files. */
  readonly byOutcome: Readonly<Record<BulkFileOutcomeName, number>>;
}

/**
 * Counts an answer, keeping exclusions and execution outcomes apart.
 *
 * @param result - What the bulk edit answered.
 * @param plan - The plan the request was built from, for the excluded snippets.
 * @returns The summary.
 */
export function summarizeBulkResult(result: BulkResult, plan: BulkPlan): BulkOutcomeSummary {
  const byOutcome: Record<BulkFileOutcomeName, number> = {
    saved: 0,
    alreadyUnchanged: 0,
    conflicted: 0,
    refused: 0,
    consentStale: 0,
    blocked: 0,
    failed: 0,
    writeOutcomeUnknown: 0,
    notAttempted: 0,
    excludedBeforeApply: 0
  };
  const committedDocuments: DocumentId[] = [];
  for (const report of result.files) {
    byOutcome[report.outcome] += 1;
    if (report.outcome === 'saved') {
      committedDocuments.push(report.document);
    }
  } // End of the loop over the answer's files
  const notWritten =
    byOutcome.conflicted +
    byOutcome.refused +
    byOutcome.consentStale +
    byOutcome.blocked +
    byOutcome.failed;
  const settledWell = byOutcome.saved + byOutcome.alreadyUnchanged;
  // A committed file is never the headline's failure: `partial` says some files
  // were saved, and `nothingWritten` is reached only when none was.
  let headline: BulkOutcomeHeadline;
  if (byOutcome.writeOutcomeUnknown > 0) {
    headline = 'uncertain';
  } else if (notWritten + byOutcome.notAttempted === 0 && settledWell > 0) {
    headline = 'complete';
  } else if (byOutcome.saved > 0) {
    headline = 'partial';
  } else {
    headline = 'nothingWritten';
  }
  return deepFreeze({
    headline,
    saved: byOutcome.saved,
    alreadyUnchanged: byOutcome.alreadyUnchanged,
    notWritten,
    writeOutcomeUnknown: byOutcome.writeOutcomeUnknown,
    notAttempted: byOutcome.notAttempted,
    excludedFiles: byOutcome.excludedBeforeApply,
    excludedSnippets: plan.exclusions.length,
    committedDocuments,
    byOutcome
  });
} // End of function summarizeBulkResult()

// ---------------------------------------------------------------------------
// Dictionary keys
// ---------------------------------------------------------------------------

/**
 * The dictionary key for an exclusion's reason.
 *
 * @param reason - Why the snippet is left out.
 * @returns The key holding its sentence.
 */
export function bulkExclusionKey(reason: BulkExclusionReason): TranslationKey {
  switch (reason) {
    case 'readOnly':
      return 'browser.bulkEdit.exclusion.readOnly';
    case 'editorOpen':
      return 'browser.bulkEdit.exclusion.editorOpen';
  }
} // End of function bulkExclusionKey()

/**
 * The dictionary key for a blocker.
 *
 * @param blocker - Why nothing may be sent.
 * @returns The key holding its sentence.
 */
export function bulkBlockerKey(blocker: BulkBlocker): TranslationKey {
  switch (blocker) {
    case 'noSelection':
      return 'browser.bulkEdit.blocked.noSelection';
    case 'staleSelection':
      return 'browser.bulkEdit.blocked.staleSelection';
    case 'noChanges':
      return 'browser.bulkEdit.blocked.noChanges';
    case 'emptyValue':
      return 'browser.bulkEdit.blocked.emptyValue';
    case 'nothingToApply':
      return 'browser.bulkEdit.blocked.nothingToApply';
  }
} // End of function bulkBlockerKey()

/**
 * The dictionary key for a worded option summary. `same` has none: a screen
 * draws the file's own bytes for it, and the parameter type makes asking for
 * its key a compile error.
 *
 * @param kind - The summary's kind.
 * @returns The key holding its words.
 */
export function optionSummaryKey(kind: WordedOptionSummary): TranslationKey {
  switch (kind) {
    case 'unknown':
      return 'browser.bulkEdit.option.unknown';
    case 'absent':
      return 'browser.bulkEdit.option.absent';
    case 'notOneScalar':
      return 'browser.bulkEdit.option.notOneScalar';
    case 'mixed':
      return 'browser.bulkEdit.option.mixed';
  }
} // End of function optionSummaryKey()

/**
 * The dictionary key for an answer's headline.
 *
 * @param headline - The headline.
 * @returns The key holding its sentence.
 */
export function bulkOutcomeHeadlineKey(headline: BulkOutcomeHeadline): TranslationKey {
  switch (headline) {
    case 'complete':
      return 'browser.bulkEdit.outcome.complete';
    case 'partial':
      return 'browser.bulkEdit.outcome.partial';
    case 'uncertain':
      return 'browser.bulkEdit.outcome.uncertain';
    case 'nothingWritten':
      return 'browser.bulkEdit.outcome.nothingWritten';
  }
} // End of function bulkOutcomeHeadlineKey()
