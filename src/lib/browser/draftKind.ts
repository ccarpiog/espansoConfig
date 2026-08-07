/**
 * What one write surface's retained draft **is**, and the one rule that reads it.
 *
 * ## Why this is a module of its own
 *
 * Three sentences in this application say *editing* where three of the six write
 * surfaces edit nothing, and each of the three was found separately:
 *
 * 1. the conflict panel's non-destructive choice — `conflictChoiceKey`'s
 *    `keepEditing` — found by `docs/decisions/2c-4a-3c-2-window-reading.md`
 *    section 10.2 and fixed at 3c-3;
 * 2. the **refused** arm's own way out — `rawSaveChoiceKey`'s `keepEditing` —
 *    found by `docs/reviews/phase-2c-4a-3c-code.md`'s Medium, which is 3c-3's
 *    deliberate deferral overruled;
 * 3. `browser.saveOutcome.reloadUnavailable`, whose last clause tells the person
 *    to *keep editing* on all six surfaces.
 *
 * Each was closed by writing the same branch again somewhere else, which is
 * exactly the shape `CLAUDE.md` section 6 calls *sweep for what the type now
 * says, not for the words the old finding used*: a rule expressed three times is
 * a rule that can be fixed twice. {@link draftKindWording} is that rule as one
 * function, and the three key functions above call it rather than restating it.
 *
 * **It is here rather than in `./saveOutcome.ts` because `./rawSave.ts` needs
 * it too**, and `saveOutcome.ts` already imports `rawSave.ts`. A rule the lower
 * module imports from the higher one is a cycle; a rule both import from a third
 * is not.
 *
 * **It decides a key and never a sentence.** What either wording actually says is
 * in `src/lib/i18n/{en,es}.json`, where both languages are checked against each
 * other, and no test in this repository pins meaning (`CLAUDE.md` section 6).
 */

import type { TranslationKey } from '../i18n/dictionaries';

/**
 * What one surface's retained draft **is**.
 *
 * The 2c-4a consult's Q3/Q4 deciding rule as a value rather than as six ad hoc
 * decisions: *does the draft contain user-authored text a clipboard can preserve
 * truthfully?* `authoredText` is the raw editor's whole file text, the match
 * editor's `MatchBuffers` and the creator's `CreationBuffers` — every one of them
 * strings a person typed. `operationChoice` is the mover's `MovePlacement`, a
 * positional selection, and the deleter's and duplicator's `MatchId`, an opaque
 * revision-scoped protocol carrier. Copying either of those would preserve
 * nothing while looking like it preserved something.
 *
 * **It is a permanent fact about a surface**, not a state: it can only change if
 * the drafted type changes. `ConflictCapabilities.draftKind` in `./saveOutcome`
 * is where each surface declares its own.
 */
export type ConflictDraftKind = 'authoredText' | 'operationChoice';

/**
 * The two forms one thing a surface says has, one per {@link ConflictDraftKind}.
 *
 * **Both arms are required**, so a sentence that needs the distinction cannot be
 * given only the half its author happened to be looking at. That is the whole of
 * what a type can force here; that the two really *say* different things is not
 * forceable at all, and each caller's own suite is what holds the pair apart by
 * name.
 *
 * @typeParam T - What is being chosen: a {@link TranslationKey} for the three key
 *   functions, and a `SaveOutcomeMessage` for the two describers that pick a code
 *   and leave the key to `saveOutcomeMessageKey`.
 */
export interface DraftKindWording<T = TranslationKey> {
  /** For the raw editor, the match editor and the creator: text a person typed. */
  readonly authoredText: T;
  /** For the mover, the deleter and the duplicator: an operation nobody typed. */
  readonly operationChoice: T;
}

/**
 * The one of two things a surface's own draft kind chooses.
 *
 * **The only place this application decides between an editing form and an
 * operation form.** Five callers, all in this directory: `conflictChoiceKey`,
 * `reloadUnavailableKey`, `reloadWarningFor` and `describeConflict` in
 * `./saveOutcome`, and `rawSaveChoiceKey` in `./rawSave`. A sixth sentence that
 * needs the distinction joins them here rather than growing a sixth
 * `draftKind === 'authoredText'` somewhere else.
 *
 * **The one `draftKind === 'authoredText'` that is deliberately not this** is
 * `conflictChoicesFor`'s copy guard: it asks whether a copy could be honest at
 * all, and answers *offer it* or *do not*, which is one branch and not a choice
 * between two forms.
 *
 * **What it cannot force**, in the same sentence as what it does: it forces that
 * a caller supplies both forms and picks neither, and it cannot force that the
 * caller passes the draft kind *its own surface declares* — that is an ordinary
 * {@link ConflictDraftKind} and a component may hand over the wrong one. What is
 * closed is that no caller can omit the question.
 *
 * @typeParam T - A translation key, or a message code a describer will map later.
 * @param draftKind - What the calling surface's retained draft is, from its own
 *   `CONFLICT_CAPABILITIES`.
 * @param wording - The two forms to choose between.
 * @returns The form for that kind.
 */
export function draftKindWording<T>(
  draftKind: ConflictDraftKind,
  wording: DraftKindWording<T>
): T {
  return draftKind === 'authoredText' ? wording.authoredText : wording.operationChoice;
} // End of function draftKindWording()
