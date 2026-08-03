/**
 * The draft spine: what an editor is holding, what it started from, and what
 * consent it has collected for the exact thing it is about to send.
 *
 * **No editor, no screen and no command.** This module is the state shape every
 * editor of Phase 2c stands on, written before any of them, for the reason the
 * split gives (`docs/decisions/2c-split-notes.md` section 3): a draft model built
 * without undo in mind is a `{ value, dirty }` pair, and the shape that can carry
 * undo — a base, a current, two stacks and a set of boundary rules — is not
 * reachable from it by addition.
 *
 * ## Why it is generic, and why generic means *snapshotted*
 *
 * The raw editor (2c-1b) drafts one `string`: a file's whole text. The small
 * editor (2c-2) drafts a `MatchDraft`: twenty-two tri-state fields and four
 * lists. They are the same state machine over different values, so the value is a
 * type parameter and nothing below knows what text is.
 *
 * A `string` cannot be changed in place; a `MatchDraft` can. The first version of
 * this module stored whatever it was handed, and the 2c-1a review was right that
 * this **defeats the whole shape** for the structured case: mutate one nested
 * field of a value the draft is holding, and the base, the current value, the
 * history entry and the consent candidate all change at once, because they are
 * one object. Dirty stays false, consent stays valid, and the editor sends
 * candidate B carrying candidate A's acknowledgement.
 *
 * So a draft is constructed with {@link DraftValueRules}: how to compare two
 * values **and** how to take a snapshot of one. Every value this module records —
 * the base, the current value, each history entry, the base a save or a reload
 * moves to, and the candidate consent is bound to — is a snapshot, and
 * {@link structuredDraftRules} freezes what it copies, so a caller that mutates a
 * structured draft's value in place gets a `TypeError` in strict mode rather than
 * a silently corrupted state machine. `readonly` in TypeScript is shallow and has
 * no runtime existence; `Object.freeze` does.
 *
 * ## Four rules the shape enforces rather than documents
 *
 * 1. **Dirty is derived, never stored.** {@link isDirty} compares the current
 *    value against the base with the draft's own equality. There is no `dirty`
 *    field to forget to clear, and typing something and typing it back makes a
 *    draft clean again — which a flag would have got wrong.
 * 2. **The comparison lives in the draft.** A caller cannot ask "is this dirty?"
 *    with one rule and "did this edit change anything?" with another: both read
 *    {@link Draft.rules}, which is fixed when the draft starts.
 * 3. **Redo is cleared by editing.** {@link editDraft} empties the future. A redo
 *    stack that survived a new edit would offer to replay a value from a history
 *    that no longer happened.
 * 4. **Consent cannot outlive the value it was collected for.** See below — it is
 *    the load-bearing one.
 *
 * ## The acknowledgement is bound to the candidate, and cannot be moved
 *
 * `FindingCode::DocumentDoesNotParse` carries the **content revision of the exact
 * text it is about** (`../ipc/types`), and the save gate matches an
 * acknowledgement against the candidate's suspicions as an exact multiset. So
 * consent collected for one text acknowledges that text and no other, and undo
 * and editing both change the text.
 *
 * Three mechanisms keep that true, and none of them is a comment:
 *
 * - **Consent is not a value a caller can hand over.** There is no
 *   `acknowledgeDraft(draft, someAcknowledgement)`. The only way to record consent
 *   is {@link acknowledgeRefusal}, which takes **the submission that was sent and
 *   the refusal that came back**, checks at run time that the refusal belongs to
 *   the value the draft still holds, and derives the acknowledgement from the
 *   refusal itself. Taking draft A's acknowledgement and binding it to draft B is
 *   not something this module will do — the earlier version's decision record
 *   claimed exactly that and was wrong, because the function it described bound
 *   whatever it was handed.
 * - Every transition that changes the value — {@link editDraft},
 *   {@link undoDraft}, {@link redoDraft}, {@link reloadedDraft}, and
 *   {@link savedDraft} which spends it — returns a draft whose consent is `null`.
 * - {@link boundAcknowledgement} re-checks the stored candidate against the
 *   current value before handing anything back.
 *
 * And what goes out is a {@link DraftSubmission}, which carries the base
 * revision, the candidate, the consent **and the history generation** as one
 * value.
 *
 * **What is still not forced**, in the same breath as what is: a caller can read
 * `submission.acknowledgement` and pass it to `saveRawDocument` beside a different
 * string, because TypeScript has no linear types and no signature can require two
 * arguments to have come from one call. What is closed is that this module will
 * not produce that pairing and will not record it as consent. The wire refuses it
 * as a second refusal rather than writing it.
 */

import type { Acknowledgement, ContentRevision, RefusedResult } from '../ipc/types';
import { refusalAcknowledgement } from './rawSave';

/**
 * How a draft compares two of its values, and how it takes a snapshot of one.
 *
 * Supplied once, at {@link startDraft}, and then used for every question the
 * draft answers about sameness and for every value it records. A `string` draft
 * needs identity and no copying; a structured draft needs deep equality and a
 * frozen deep copy.
 *
 * @typeParam T - The drafted value.
 */
export interface DraftValueRules<T> {
  /**
   * Whether two values are the same for this draft's purposes.
   *
   * @param a - One value.
   * @param b - The other.
   * @returns `true` when the two are the same value.
   */
  readonly same: (a: T, b: T) => boolean;
  /**
   * A value the draft may keep, which nothing outside it can change.
   *
   * Called on **every** value the draft records. For an immutable value it may
   * be the identity; for anything with fields it must copy, and should freeze.
   *
   * @param value - The value to record.
   * @returns The value to keep.
   */
  readonly snapshot: (value: T) => T;
}

/**
 * The rules for a draft of text: identity, and no copying.
 *
 * A `string` cannot be changed in place, so its snapshot is itself and
 * `Object.is` is value equality. This is what 2c-1b's raw editor uses.
 */
export const textDraftRules: DraftValueRules<string> = {
  same: (a, b) => Object.is(a, b),
  snapshot: (value) => value
};

/**
 * Deep structural equality over plain data.
 *
 * Plain data is what this wire carries: objects, arrays, strings, numbers,
 * booleans and `null`. Nothing below handles a `Map`, a `Date` or a class
 * instance, because nothing in a draft is one.
 *
 * @param a - One value.
 * @param b - The other.
 * @returns `true` when the two hold the same data.
 */
export function deepEquals(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }
  const left = a as Readonly<Record<string, unknown>>;
  const right = b as Readonly<Record<string, unknown>>;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) {
    return false;
  }
  return keys.every(
    (key) => Object.prototype.hasOwnProperty.call(right, key) && deepEquals(left[key], right[key])
  );
} // End of function deepEquals()

/**
 * Freezes a value and everything under it.
 *
 * **Unconditionally, not only in development.** A freeze that happens in one
 * build and not the other is a check that fires where nobody is looking and not
 * where the user is, and its cost here is a walk over a value this application
 * has just copied anyway.
 *
 * @typeParam T - The value's type.
 * @param value - The value to freeze in place.
 * @returns The same value, frozen.
 */
export function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const nested of Object.values(value as Readonly<Record<string, unknown>>)) {
    deepFreeze(nested);
  }
  return value;
} // End of function deepFreeze()

/**
 * The rules for a draft of structured data: deep equality, frozen deep copies.
 *
 * What 2c-2's `MatchDraft` draft uses. The snapshot is a `structuredClone`
 * followed by a deep freeze, so the draft's copy shares no object with the
 * caller's and a caller that mutates its own value afterwards changes nothing
 * here.
 *
 * @typeParam T - The drafted value, which must be plain data.
 * @returns The rules.
 */
export function structuredDraftRules<T>(): DraftValueRules<T> {
  return {
    same: (a, b) => deepEquals(a, b),
    snapshot: (value) => deepFreeze(structuredClone(value))
  };
} // End of function structuredDraftRules()

/**
 * The brand that makes consent unforgeable.
 *
 * Declared and never exported, so no object outside this module can have the
 * property and no type outside it can name the key: a caller cannot write a
 * {@link DraftConsent} literal, and {@link acknowledgeRefusal} is the only thing
 * that produces one.
 */
declare const CONSENT: unique symbol;

/**
 * An acknowledgement, together with the exact value it was collected for.
 *
 * Never an acknowledgement on its own, and never one a caller chose: a
 * `DocumentDoesNotParse` finding is content-addressed to one candidate, so an
 * acknowledgement with no candidate beside it is a value nothing can check, and
 * one bound to a candidate it was not issued for is worse than none.
 *
 * @typeParam T - The drafted value.
 */
export interface DraftConsent<T> {
  /** The brand. Never present at runtime, never nameable outside this module. */
  readonly [CONSENT]: typeof CONSENT;
  /** The value the person was shown when they accepted the findings. */
  readonly candidate: T;
  /**
   * What they accepted, exactly as the refusal reported it.
   *
   * Derived from the refusal rather than supplied, and frozen, so what goes back
   * to the gate is what came from it: the gate matches the multiset, and a copy
   * assembled from the parts acknowledges nothing.
   */
  readonly acknowledgement: Acknowledgement;
}

/**
 * One value the draft held, and when it held it.
 *
 * The generation is what lets a save draw its boundary in the right place after
 * the person has gone on typing: it identifies **this step**, so a submission can
 * name the step it was taken from and a success can discard what is older than it
 * without discarding what is newer.
 *
 * @typeParam T - The drafted value.
 */
export interface DraftStep<T> {
  /** The value, as a snapshot. */
  readonly value: T;
  /** The step's identity within this draft. Unique and never reused. */
  readonly generation: number;
}

/**
 * One editor's draft of one value.
 *
 * **A value, not a store.** Every transition below returns a new draft and none
 * mutates its argument, so a Svelte component holds one in a `$state` and
 * reassigns it. That keeps the whole state machine testable in a file no
 * component is rendered in — this project's standing constraint
 * (`docs/decisions/1c-1-notes.md` hole 1).
 *
 * `[...past, this step, ...future]` is the branch in chronological order: undo
 * moves the current step to the **front** of the future, so `future[0]` is the
 * step that came directly after the current one.
 *
 * @typeParam T - The drafted value.
 */
export interface Draft<T> {
  /**
   * The revision the value was loaded from, and the one the next save sends.
   *
   * **The only thing standing between a save and silently overwriting whatever
   * changed the file since**, which is why it is captured when the draft starts
   * and moved only at a boundary ({@link savedDraft}, {@link reloadedDraft}) —
   * never re-read just before saving.
   */
  readonly baseRevision: ContentRevision;
  /** The value at that revision, snapshotted. What dirty is measured against. */
  readonly baseValue: T;
  /** The value the editor is showing now, snapshotted. */
  readonly value: T;
  /** The current value's step identity. */
  readonly generation: number;
  /** Earlier steps, oldest first. {@link undoDraft} pops the last. */
  readonly past: readonly DraftStep<T>[];
  /** Undone steps, next-to-redo first. Emptied by any edit. */
  readonly future: readonly DraftStep<T>[];
  /**
   * The step the **most recent push** dropped at {@link HISTORY_LIMIT}, or `null`.
   *
   * **One retained slot, and it exists for exactly one caller.** {@link amendDraft}
   * collapses a step when the amendment is what that step began as, and at the
   * bound the push that opened the step had already evicted the oldest one — so a
   * collapse that only sliced would answer a draft whose value is back where it
   * started and whose history is one state shorter, permanently and silently. That
   * is the one case where "an edit that ends where it began costs nothing" was
   * false, and it is the confirmation pass's second finding.
   *
   * It is **not** part of the history: nothing reads it but the collapse, undo and
   * redo do not walk into it, and every transition that moves the branch somewhere
   * a collapse could not follow clears it. The cost is one extra step retained per
   * draft, which is the smallest thing that can make the collapse history-neutral —
   * the evicted value is not recoverable from anything else the draft holds.
   */
  readonly evicted: DraftStep<T> | null;
  /** Consent collected for one exact candidate, or `null`. */
  readonly consent: DraftConsent<T> | null;
  /** The next generation to mint. Monotonic, never reused. */
  readonly nextGeneration: number;
  /** How this draft compares and snapshots its values. Fixed at {@link startDraft}. */
  readonly rules: DraftValueRules<T>;
}

/**
 * What one save attempt sends: the base, the candidate, the consent and the step.
 *
 * The four travel as one value because they are one claim — *this text, from that
 * revision, with those findings accepted, taken at that point in the history*.
 * Splitting them is what would let consent collected for one candidate be spent
 * on another, and what would leave a success unable to say which edit it was of.
 *
 * @typeParam T - The drafted value.
 */
export interface DraftSubmission<T> {
  /** The revision the candidate was drafted from. */
  readonly baseRevision: ContentRevision;
  /** The value to send. A snapshot, so it cannot change while it is in flight. */
  readonly candidate: T;
  /**
   * The findings already shown to a person **for this exact candidate**.
   *
   * {@link EMPTY_ACKNOWLEDGEMENT} on a first attempt, and on every attempt whose
   * candidate has changed since consent was collected. There is no `force` flag
   * on this wire and adding one would undo the design.
   */
  readonly acknowledgement: Acknowledgement;
  /** The step this was taken from, for {@link savedDraft} to draw its boundary at. */
  readonly generation: number;
}

/**
 * The acknowledgement a first attempt sends: nothing accepted.
 *
 * Frozen, because it is shared by every submission that has collected no consent
 * and a caller that pushed a finding into it would change every one of them.
 */
export const EMPTY_ACKNOWLEDGEMENT: Acknowledgement = deepFreeze({ accepted: [] });

/**
 * How many earlier steps a draft keeps.
 *
 * **A bound, chosen over coalescing, because coalescing is not this module's
 * decision.** What counts as one edit — a keystroke, a word, a pause — is a
 * property of the editor: 2c-1b binds a text area and 2c-2 binds twenty-two
 * fields, and they will not agree. What *is* this module's to decide is that the
 * history cannot grow without limit, because a raw draft holds a file's entire
 * text and one entry per keystroke over a long session is unbounded retained
 * memory.
 *
 * A hundred steps of a hundred-kilobyte configuration is ten megabytes at worst,
 * which is a bound rather than a promise of thrift. Undo and redo move steps
 * between the two stacks rather than creating them, so the two together hold
 * about this many and not more.
 *
 * **What changed at 2c-2-1, and what did not.** {@link amendDraft} gives an
 * editor a way to replace the current step instead of pushing a new one, which is
 * what coalescing is made of. The decision above is unchanged: this module still
 * does not decide *when* two changes are one edit, it only stops an editor from
 * having to fake the transition. 2c-1b's raw editor takes one keystroke as one
 * step and does not call it; 2c-2's small editor coalesces a typing burst per
 * field and does.
 *
 * **What the user loses when it is reached:** the *oldest* undo step, and then the
 * next oldest. The recent history — which is what undo is for — is never the part
 * that is dropped, and `baseValue` is never dropped at all, so "what this file
 * held when I opened it" is still in the draft even when its history is not.
 */
export const HISTORY_LIMIT = 100;

/**
 * Starts a draft of one value at one revision.
 *
 * @typeParam T - The drafted value.
 * @param baseRevision - The revision the value was read at.
 * @param baseValue - The value as the file holds it.
 * @param rules - How to compare and snapshot this draft's values.
 *   {@link textDraftRules} for a raw text draft; {@link structuredDraftRules} for
 *   anything with fields. **Required**, because a wrong default is exactly the
 *   aliasing defect this parameter exists to prevent.
 * @returns A clean draft with no history and no consent.
 */
export function startDraft<T>(
  baseRevision: ContentRevision,
  baseValue: T,
  rules: DraftValueRules<T>
): Draft<T> {
  const snapshot = rules.snapshot(baseValue);
  return {
    baseRevision,
    baseValue: snapshot,
    value: snapshot,
    generation: 0,
    past: [],
    future: [],
    evicted: null,
    consent: null,
    nextGeneration: 1,
    rules
  };
} // End of function startDraft()

/**
 * Whether the draft differs from what it was started from.
 *
 * **Derived, every time.** Editing a value away and back again makes a draft
 * clean, because clean means *equal to the base* and not *never touched*.
 *
 * @typeParam T - The drafted value.
 * @param draft - The draft to ask about.
 * @returns `true` when the current value differs from the base value.
 */
export function isDirty<T>(draft: Draft<T>): boolean {
  return !draft.rules.same(draft.value, draft.baseValue);
} // End of function isDirty()

/**
 * Whether there is an earlier value to go back to.
 *
 * @typeParam T - The drafted value.
 * @param draft - The draft to ask about.
 * @returns `true` when {@link undoDraft} would change anything.
 */
export function canUndo<T>(draft: Draft<T>): boolean {
  return draft.past.length > 0;
} // End of function canUndo()

/**
 * Whether there is an undone value to go forward to.
 *
 * @typeParam T - The drafted value.
 * @param draft - The draft to ask about.
 * @returns `true` when {@link redoDraft} would change anything.
 */
export function canRedo<T>(draft: Draft<T>): boolean {
  return draft.future.length > 0;
} // End of function canRedo()

/**
 * The current value as a step, for pushing onto one of the two stacks.
 *
 * @typeParam T - The drafted value.
 * @param draft - The draft to read.
 * @returns The step the draft is on.
 */
function currentStep<T>(draft: Draft<T>): DraftStep<T> {
  return { value: draft.value, generation: draft.generation };
} // End of function currentStep()

/** A bounded push: the new past, and whatever the bound cost. */
interface BoundedPush<T> {
  /** The new past, never longer than {@link HISTORY_LIMIT}. */
  readonly past: readonly DraftStep<T>[];
  /** The step the bound dropped, or `null` when it dropped none. */
  readonly evicted: DraftStep<T> | null;
}

/**
 * The past with one step appended, dropping the oldest once the bound is reached.
 *
 * **It answers what it dropped**, which it did not until 2c-2's confirmation pass.
 * A push at the bound evicts the oldest step, and an amendment that collapses that
 * same push has to be able to put it back or the collapse silently costs the
 * person a state — see {@link Draft.evicted}.
 *
 * At most one step is ever evicted by one push, because the past is never longer
 * than the bound to begin with.
 *
 * @typeParam T - The drafted value.
 * @param past - The steps kept so far, oldest first.
 * @param step - The step to record.
 * @returns The new past and the step the bound cost, if any.
 */
function pushBounded<T>(past: readonly DraftStep<T>[], step: DraftStep<T>): BoundedPush<T> {
  const grown = [...past, step];
  if (grown.length <= HISTORY_LIMIT) {
    return { past: grown, evicted: null };
  }
  // `grown` is longer than the bound, so it has a first element; the index read is
  // widened by `noUncheckedIndexedAccess` and cannot see that.
  return { past: grown.slice(grown.length - HISTORY_LIMIT), evicted: grown[0] ?? null };
} // End of function pushBounded()

/**
 * Records a new value.
 *
 * Four things happen together, and they are together because doing any of them
 * without the others is a bug this shape exists to prevent: the value is
 * snapshotted, the previous step joins the past, the future is emptied, and any
 * collected consent is dropped.
 *
 * A change that changes nothing is **not** an edit: it adds no history entry and
 * — because the candidate is unchanged — it keeps the consent. That is not a
 * shortcut, it is the same rule stated for the case where the two values are
 * equal.
 *
 * @typeParam T - The drafted value.
 * @param draft - The draft being edited.
 * @param next - What the editor now holds.
 * @returns The draft after the edit, or the same draft when nothing changed.
 */
export function editDraft<T>(draft: Draft<T>, next: T): Draft<T> {
  if (draft.rules.same(next, draft.value)) {
    return draft;
  }
  const pushed = pushBounded(draft.past, currentStep(draft));
  return {
    ...draft,
    value: draft.rules.snapshot(next),
    generation: draft.nextGeneration,
    nextGeneration: draft.nextGeneration + 1,
    past: pushed.past,
    // What this push cost at the bound, retained for one purpose only: an
    // amendment that collapses this very step has to be able to give it back.
    evicted: pushed.evicted,
    future: [],
    consent: null
  };
} // End of function editDraft()

/**
 * Records a new value **in place of the current one**, adding no history step.
 *
 * The mechanism coalescing needs, and only the mechanism: *when* two changes are
 * one edit is a policy this module still refuses to decide, for the reason
 * {@link HISTORY_LIMIT} gives — a text area and a set of twenty-two fields will
 * not agree about it. What belongs here is the transition itself, because the
 * alternative is an editor composing {@link undoDraft} with {@link editDraft} to
 * get the same effect by a route nobody reading it would recognise.
 *
 * It is {@link editDraft} in every respect but one: the previous value does
 * **not** join the past, so the step this replaces is gone and cannot be undone
 * to. Everything else is the same rule, and each part matters:
 *
 * - the value is snapshotted, so a caller that mutates its own object afterwards
 *   changes nothing here;
 * - a **new generation** is minted, because the value changed and a generation
 *   identifies a value rather than a position. A submission taken at the step
 *   this replaces is therefore no longer on the branch, and {@link savedDraft}
 *   already has a rule for that: it discards nothing;
 * - the future is emptied and the consent is dropped, because the candidate has
 *   changed and consent is content-addressed to the candidate it was collected
 *   for.
 *
 * A change that changes nothing is not a change: the draft is returned as it is.
 *
 * ## An amendment back to where the step began drops the step
 *
 * The one case where this does more than replace, and it is the same rule rather
 * than a second one. An amendment replaces the step it is on, so an amendment
 * whose value equals **the step before it** leaves two adjacent identical entries
 * on the branch — an undo the person can press that changes nothing on screen and
 * only spends a step. Type a burst and erase it again inside one group and that is
 * exactly what happens.
 *
 * So the step is dropped instead, and the draft goes back to the earlier step's
 * own value and its own generation, exactly as {@link undoDraft} would. This is not
 * a decision about *when* two changes are one edit — that is still the editor's —
 * it is this transition declining to manufacture a history entry that describes
 * nothing, which no caller could want.
 *
 * **And nothing is lost, at the bound as well as below it.** The first version of
 * this branch only sliced, which is right below {@link HISTORY_LIMIT} and wrong at
 * it: the push that opened the collapsed step had already evicted the oldest entry,
 * so a burst typed and erased again left the value where it started and the history
 * one state shorter — silently, since nothing on screen changed. The evicted step
 * is put back from {@link Draft.evicted}, so a net-zero group really is history-
 * neutral. That is the whole reason the draft retains one extra slot.
 *
 * @typeParam T - The drafted value.
 * @param draft - The draft being edited.
 * @param next - What the editor now holds.
 * @returns The draft with its current value replaced — or with the replaced step
 *   dropped when the replacement is what that step was made from, or the same
 *   draft when nothing changed.
 */
export function amendDraft<T>(draft: Draft<T>, next: T): Draft<T> {
  if (draft.rules.same(next, draft.value)) {
    return draft;
  }
  const previous = draft.past[draft.past.length - 1];
  if (previous !== undefined && draft.rules.same(next, previous.value)) {
    const kept = draft.past.slice(0, -1);
    return {
      ...draft,
      value: previous.value,
      generation: previous.generation,
      // The step this collapse undoes may have cost the oldest entry when it was
      // pushed. Putting it back is what makes a net-zero group cost nothing at the
      // bound as well as below it.
      past: draft.evicted === null ? kept : [draft.evicted, ...kept],
      evicted: null,
      future: [],
      consent: null
    };
  }
  // The eviction is deliberately **not** cleared here: a group is a push followed
  // by any number of amendments, and the collapse that ends it may be the third or
  // the tenth. It is the push's cost, and it stays recoverable until that push is
  // either collapsed or left behind.
  return {
    ...draft,
    value: draft.rules.snapshot(next),
    generation: draft.nextGeneration,
    nextGeneration: draft.nextGeneration + 1,
    future: [],
    consent: null
  };
} // End of function amendDraft()

/**
 * Goes back one value.
 *
 * The consent goes with it: undoing changes the candidate, and consent is
 * content-addressed to the candidate it was collected for.
 *
 * @typeParam T - The drafted value.
 * @param draft - The draft to undo.
 * @returns The draft one step back, or the same draft when there is no past.
 */
export function undoDraft<T>(draft: Draft<T>): Draft<T> {
  if (draft.past.length === 0) {
    return draft;
  }
  // The length check above is the proof that this read finds a step;
  // `noUncheckedIndexedAccess` widens every index read and cannot see it.
  const previous = draft.past[draft.past.length - 1] as DraftStep<T>;
  return {
    ...draft,
    value: previous.value,
    generation: previous.generation,
    past: draft.past.slice(0, -1),
    future: [currentStep(draft), ...draft.future],
    // An undo takes the branch somewhere a collapse could no longer follow, so the
    // retained eviction is released rather than kept for a later amendment that
    // would put it back in the wrong place.
    evicted: null,
    consent: null
  };
} // End of function undoDraft()

/**
 * Goes forward one value, undoing an undo.
 *
 * @typeParam T - The drafted value.
 * @param draft - The draft to redo.
 * @returns The draft one step forward, or the same draft when there is no future.
 */
export function redoDraft<T>(draft: Draft<T>): Draft<T> {
  if (draft.future.length === 0) {
    return draft;
  }
  // As in `undoDraft`: the length check is what makes this read total.
  const next = draft.future[0] as DraftStep<T>;
  const pushed = pushBounded(draft.past, currentStep(draft));
  return {
    ...draft,
    value: next.value,
    generation: next.generation,
    past: pushed.past,
    evicted: pushed.evicted,
    future: draft.future.slice(1),
    consent: null
  };
} // End of function redoDraft()

/**
 * Records the consent a refusal of **this draft's own submission** collected.
 *
 * The only way consent enters a draft, and it takes the submission and the
 * refusal rather than an acknowledgement, because an acknowledgement on its own
 * says nothing about which candidate it belongs to. Three checks, all at run
 * time, all answering with the draft unchanged rather than throwing:
 *
 * 1. the submission must carry **this** draft's base revision;
 * 2. the value the draft holds now must still be the candidate that was sent — if
 *    the person edited or undid while the save was in flight, the refusal is
 *    about a text that is no longer on screen, and consenting to it would consent
 *    to the wrong thing;
 * 3. the refusal must be one an acknowledgement can actually move
 *    (`refusalAcknowledgement`), so no consent is recorded for a verdict that
 *    would refuse it again.
 *
 * @typeParam T - The drafted value.
 * @param draft - The draft the person is looking at.
 * @param submission - What was sent, from {@link submissionOf}.
 * @param refusal - What came back.
 * @returns The draft carrying consent, or the same draft when a check failed.
 */
export function acknowledgeRefusal<T>(
  draft: Draft<T>,
  submission: DraftSubmission<T>,
  refusal: RefusedResult
): Draft<T> {
  if (submission.baseRevision !== draft.baseRevision) {
    return draft;
  }
  if (!draft.rules.same(submission.candidate, draft.value)) {
    return draft;
  }
  const acknowledgement = refusalAcknowledgement(refusal);
  if (acknowledgement === null) {
    return draft;
  }
  // The cast is the brand: `DraftConsent` declares a property on a symbol this
  // module does not export, so no literal outside it can have the type and this
  // is the only place one is built.
  const consent = {
    candidate: draft.value,
    acknowledgement: deepFreeze(structuredClone(acknowledgement))
  } as unknown as DraftConsent<T>;
  return { ...draft, consent };
} // End of function acknowledgeRefusal()

/**
 * The consent that is still valid for the value the draft holds, or `null`.
 *
 * The last gate. Every transition that changes the value already drops the
 * consent, so this should never find a stale one — and it checks anyway, because
 * the cost of the check is one comparison and the cost of being wrong is a save
 * that writes unparseable text on consent collected for different text.
 *
 * @typeParam T - The drafted value.
 * @param draft - The draft about to be submitted.
 * @returns The acknowledgement bound to the current value, or `null`.
 */
export function boundAcknowledgement<T>(draft: Draft<T>): Acknowledgement | null {
  const consent = draft.consent;
  if (consent === null) {
    return null;
  }
  return draft.rules.same(consent.candidate, draft.value) ? consent.acknowledgement : null;
} // End of function boundAcknowledgement()

/**
 * What to send for this draft: the base revision, the candidate, the consent and
 * the step it was taken from.
 *
 * The only place they are put together, so there is no place that puts a
 * candidate together with somebody else's consent.
 *
 * @typeParam T - The drafted value.
 * @param draft - The draft to submit.
 * @returns The submission, whose acknowledgement is
 *   {@link EMPTY_ACKNOWLEDGEMENT} whenever no consent is bound to this exact
 *   candidate.
 */
export function submissionOf<T>(draft: Draft<T>): DraftSubmission<T> {
  return {
    baseRevision: draft.baseRevision,
    candidate: draft.value,
    acknowledgement: boundAcknowledgement(draft) ?? EMPTY_ACKNOWLEDGEMENT,
    generation: draft.generation
  };
} // End of function submissionOf()

/**
 * Where a submitted step sits in the branch, or `null` when it is not on it.
 *
 * The branch in chronological order is `[...past, current, ...future]`, so an
 * index into that sequence is a position in time and the current value's index is
 * `past.length`.
 *
 * @typeParam T - The drafted value.
 * @param draft - The draft to look in.
 * @param generation - The step to look for.
 * @returns Its index in the branch, or `null`.
 */
function branchIndexOf<T>(draft: Draft<T>, generation: number): number | null {
  if (draft.generation === generation) {
    return draft.past.length;
  }
  const inPast = draft.past.findIndex((step) => step.generation === generation);
  if (inPast !== -1) {
    return inPast;
  }
  const inFuture = draft.future.findIndex((step) => step.generation === generation);
  return inFuture === -1 ? null : draft.past.length + 1 + inFuture;
} // End of function branchIndexOf()

/**
 * The history boundary a successful save draws.
 *
 * The base moves to **the candidate that was written**, not to whatever the
 * editor is holding now: a person may type while a save is in flight, and
 * declaring their newer text saved would report a dirty draft as clean. So the
 * current value is left exactly as it is, and a draft that moved on stays dirty
 * against its new base — which is the truth.
 *
 * **What the boundary discards, and what it keeps.** Undo may not walk backwards
 * across a write as though nothing had been written, so every step *older* than
 * the submitted one goes. Steps made **after** it are kept, which is the 2c-1a
 * review's finding: the first version cleared the whole history and left a person
 * who typed during a save unable to undo back to what had just been written.
 *
 * Three cases, and the last two are the ones a rule has to say out loud:
 *
 * - the submitted step is at or behind the current position — the ordinary case:
 *   the past is cut at it and the future is untouched, so undo stops at what was
 *   saved;
 * - the submitted step is **ahead** of the current position, because the person
 *   undid past it while the save was in flight: nothing is discarded. They have
 *   already walked back past the saved state deliberately, and taking their
 *   history away as well would punish them for it;
 * - the submitted step is **not on the branch at all**, because an edit from an
 *   undone state cleared the future it was in: nothing is discarded either, for
 *   the same reason and one more — there is no boundary left to draw.
 *
 * Nothing here is conditional on `committed`. A `committed: false` is a documented
 * success — the candidate was byte-identical to what the file already held — and
 * it moves the base for the same reason a write does.
 *
 * @typeParam T - The drafted value.
 * @param draft - The draft that was saved.
 * @param submission - What the save actually sent, from {@link submissionOf}.
 * @param revision - The revision the transaction ended on.
 * @returns The draft rebased on what is now on disk.
 */
export function savedDraft<T>(
  draft: Draft<T>,
  submission: DraftSubmission<T>,
  revision: ContentRevision
): Draft<T> {
  const boundary = branchIndexOf(draft, submission.generation);
  const past =
    boundary !== null && boundary <= draft.past.length ? draft.past.slice(boundary) : draft.past;
  return {
    ...draft,
    baseRevision: revision,
    baseValue: draft.rules.snapshot(submission.candidate),
    past,
    // A save draws a boundary undo may not walk back across, so a step evicted
    // before it must not be able to reappear behind it.
    evicted: null,
    consent: null
  };
} // End of function savedDraft()

/**
 * The history boundary a reload draws, discarding the draft.
 *
 * **This is the destructive one.** It replaces the current value with what was
 * read, so a caller must have asked the person first — the conflict state in
 * `saveOutcome.ts` reaches it only through an explicit confirmation, and offers
 * *Copy draft* before it (`docs/decisions/2c-split-notes.md` section 6). What
 * this module can do is not offer a quieter way to do the same thing.
 *
 * @typeParam T - The drafted value.
 * @param draft - The draft being replaced.
 * @param revision - The revision that was read.
 * @param value - The value at that revision.
 * @returns A clean draft of the value that was read, with no history and no
 *   consent.
 */
export function reloadedDraft<T>(
  draft: Draft<T>,
  revision: ContentRevision,
  value: T
): Draft<T> {
  const snapshot = draft.rules.snapshot(value);
  return {
    ...draft,
    baseRevision: revision,
    baseValue: snapshot,
    value: snapshot,
    generation: draft.nextGeneration,
    nextGeneration: draft.nextGeneration + 1,
    past: [],
    future: [],
    // The history is gone, so the one step held outside it goes too.
    evicted: null,
    consent: null
  };
} // End of function reloadedDraft()
