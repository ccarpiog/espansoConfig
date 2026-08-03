/**
 * The new-snippet form: two required values, one destination and one position.
 *
 * **No component and no screen.** This is the whole protocol as a value, exactly
 * as `./matchEditor.ts` is for the small editor and `./rawEditor.ts` is for the
 * raw one, and for the same standing reason (`docs/decisions/1c-1-notes.md`
 * hole 1): nothing in this repository renders a Svelte component in an automated
 * test unless the file opts into jsdom, so a decision written in markup is a
 * decision nothing can check. A later step of 2c-3a draws what this module
 * decides.
 *
 * ## Why this is its own module and not a mode of the small editor
 *
 * The design consult's Q3 (`docs/reviews/phase-2c-3a-design.md`), and it is a
 * statement about *what creation is not*:
 *
 * - there is **no projection**, so there is no {@link MatchBaseline} to compare
 *   against and no `Unchanged`-versus-`Set("")` distinction to get right. Folding
 *   creation into `matchEditor.ts` would mean manufacturing an empty baseline,
 *   which is a projection of a snippet that does not exist — a value nothing read
 *   from a file, sitting in the one field whose whole purpose is to record what a
 *   file held;
 * - there is **no absent key**. Both values are required, because `NewMatch` says
 *   so on the wire and because a trigger with no body is not a usable espanso
 *   snippet;
 * - there is **no reprojection debt** of the small editor's kind. A committed
 *   create does invalidate this form — see below — but the reason is that the
 *   *destinations* it holds are stale, not that a scalar's spelling has changed.
 *
 * What creation *does* share is the save protocol, and it shares it by calling
 * `./editorSave.ts` and `./saveOutcome.ts` rather than by copying them: the
 * findings round trip, the withdrawal of *Save anyway* once findings go stale,
 * the two arms of a send that produced no outcome, and the three arms of an
 * outcome. It shares the coalescing boundary the same way, through `./typing.ts`.
 *
 * ## The destination: every file is offered, and the ineligible ones say why
 *
 * The consult's Q5, in its literal reading: **every file the window lists** is in
 * {@link MatchCreationSession.destinations}, and one this application cannot write
 * a snippet into carries a typed {@link DestinationRefusal} instead of being
 * dropped, because a destination list silently shorter than the sidebar reads as
 * an incomplete list rather than as an explanation. The list is therefore built
 * from the **document summaries** — what the sidebar itself draws — and a
 * projection is what an eligibility is *refined* by, not what admits a file to the
 * list. A file this window holds no projection of is offered as `couldNotBeRead`,
 * which is the first review round's sixth finding: it used to be dropped, which is
 * exactly the silent filtering Q5 rejects.
 *
 * ## The submission's identity is not only its buffers
 *
 * The destination and the position are part of what would be sent, so
 * {@link chooseDestination} and {@link choosePlacement} **withdraw** the submitted
 * findings, the consent bound to them and the outcome on screen; a change of
 * destination additionally re-points the draft's base revision at the newly chosen
 * file's. That is the first review round's first finding, and the failure it
 * closes is precise: a create refused in file A could have its findings accepted,
 * be redirected to file B, and reuse that consent — because the *buffers* had not
 * changed and consent is addressed to the buffers alone.
 *
 * **The core stays authoritative.** `match_list_of` in `src-tauri/src/commands.rs`
 * is the one caller that can produce `documentHasNoMatchList`, and
 * {@link DestinationRefusal} `noMatchList` is the *same comparison* against the
 * same wire field — `DocumentView.top_level_keys` against the literal `matches` —
 * made a moment earlier. It is an affordance derived from the current projection,
 * never authorization: if the projection and the file disagree, the command
 * refuses and that refusal is what the person sees.
 *
 * ## The position: three arms, and the anchor is an identity
 *
 * The consult's Q4. All three of `NewMatchPosition` are offered. The default is
 * `After` **only** when the held selection belongs to the chosen destination *and*
 * to that document's current revision; otherwise it is `End`, because a default
 * that crossed documents would put a snippet somewhere nobody asked for.
 *
 * The `After` arm stores the anchor's **identity** and never an ordinal, which is
 * what the wire type is for. {@link chooseDestination} recomputes the placement
 * from scratch, so an anchor belonging to another file — or to a revision this
 * form no longer holds — cannot survive a change of destination; and
 * {@link choosePlacement} refuses an anchor that is not one of the chosen
 * destination's own, so one cannot be installed by a caller either.
 *
 * ## The carriage return, and what the gate is really for
 *
 * Measured in this application's own WKWebView
 * (`docs/decisions/2c-2-2-window-reading.md` section 6): a `<textarea>` assigned
 * `"x\ry\r\nz"` reads back `"x\ny\nz"`, and an `<input type="text">` assigned
 * `"p\rq"` reads back `"pq"` — it **deletes** the character. So no control this
 * form will ever have can produce a carriage return.
 *
 * The gate below therefore exists for **the caller TypeScript cannot stop**, not
 * for the control: {@link NewMatch} carries no brand, unlike `RoundTripText`, so
 * a well-typed caller can put a `\r` in one and hand it to `createMatch`. It is
 * checked on the **derived candidate** at submit time, and — unlike the small
 * editor's, which can only answer `null` — it has a reason code of its own, so a
 * screen can say why the button does nothing.
 *
 * ## What a commit leaves behind
 *
 * A committed create makes every {@link MatchId} in that file stale, including
 * every anchor in {@link CreationDestination.anchors} and the revision beside
 * them. So a commit **spends the form**: {@link MatchCreationSession.committed}
 * becomes `true`, nothing here clears it, and {@link canCreate} answers `false`
 * with the reason `alreadyCreated` for as long as it is set. Only
 * {@link startMatchCreation} over freshly projected documents produces a form that
 * can create again. That is `matchEditor.ts`'s `needsReprojection` in spirit: an
 * obligation the model refuses to let a caller edit past, rather than a request.
 *
 * **What no type here forces**, in the same sentence as what one does: nothing
 * makes a caller re-seed, and nothing stops a component importing `createMatch`
 * from `../ipc/commands` and skipping `BrowserState` altogether — the hole
 * `saveMatch`, `moveMatch` and `saveRawDocument` have had since 2b-2a. What the
 * model forces is that no submission is produced from a form that has committed.
 */

import type { TranslationKey } from '../i18n/dictionaries';
import type { IpcFailure } from '../ipc/errors';
import type {
  Acknowledgement,
  ContentRevision,
  DocumentId,
  DocumentSummary,
  DocumentView,
  FileKind,
  MatchId,
  MatchView,
  NewMatch,
  NewMatchPosition,
  PresentationNote,
  SaveResult
} from '../ipc/types';
import {
  canRedo,
  canUndo,
  isDirty,
  redoDraft,
  retargetedDraft,
  savedDraft,
  startDraft,
  structuredDraftRules,
  submissionOf,
  undoDraft,
  withdrawnConsent,
  type Draft,
  type DraftSubmission,
  type DraftValueRules
} from './draft';
import {
  conflictArm,
  consentForRefusal,
  offeredRefusalChoices,
  refusedArm,
  sendFailureLines,
  sendFailureOf,
  submissionIsStale,
  type EditorPhase,
  type SendFailure,
  type SendFailureLine
} from './editorSave';
import type { InvalidationStatus } from './invalidation';
import type { RawSaveChoice } from './rawSave';
import {
  describeEditSave,
  invalidationFailureMessage,
  type ConflictChoice,
  type ConflictModel,
  type SaveOutcomeMessage,
  type SaveOutcomeModel
} from './saveOutcome';
import { holdsMatches } from './sidebar';
import { recordTyping, type Clock, type TypingRun } from './typing';

/**
 * The key a file's own snippet list is written under.
 *
 * The same literal `MATCH_LIST_KEY` in `src-tauri/src/commands.rs` holds, and the
 * duplication is deliberate rather than an oversight: nothing on this wire
 * carries the name, so the alternative to repeating it is not sharing it but
 * *not making the check at all* — which is the silent-filtering the consult's Q5
 * rejects. The comparison here is honest about being a copy, and the core's is
 * the one that decides.
 */
const MATCH_LIST_KEY = 'matches';

/** One value the form holds, spelled as its espanso key. */
export type CreationField = 'trigger' | 'replace';

/**
 * The two fields, in the order a screen shows them.
 *
 * Trigger first, because it is what fires the snippet; the body second.
 */
export const CREATION_FIELDS: readonly CreationField[] = ['trigger', 'replace'];

/** What the form's two controls hold. */
export interface CreationBuffers {
  /** The literal text that will fire the snippet — espanso's `trigger`. */
  readonly trigger: string;
  /** What the snippet will expand to — espanso's `replace`. */
  readonly replace: string;
}

/**
 * How this form compares and snapshots its drafted value.
 *
 * `structuredDraftRules` and nothing narrower, for `matchEditor.ts`'s reason:
 * {@link CreationBuffers} has fields, so the snapshot must be a deep copy and a
 * deep freeze, or the base, the current value, the history entry and the consent
 * candidate would all be one object and would all move together.
 */
const BUFFER_RULES: DraftValueRules<CreationBuffers> = structuredDraftRules<CreationBuffers>();

/**
 * Why this application will not write a new snippet into one file.
 *
 * **A code, never a sentence** (CLAUDE.md section 2): the prose lives in
 * `src/lib/i18n/{en,es}.json`, where the two languages are checked against each
 * other, and a component renders one by calling `tDestinationRefusal` — never by
 * building a key.
 *
 * The five are checked in the order they are listed, and the order is a claim
 * about which fact is the most fundamental rather than about which is the most
 * likely: where the file lives, then whether this application may write it at
 * all, then whether this window read it, then whether the substrate accepted it,
 * then what it holds. The first two are read off the **summary**, which is why
 * they are answerable for a file with no projection at all.
 */
export type DestinationRefusal =
  /** Espanso does not load snippets out of this file, wherever its keys say. */
  | 'notASnippetFile'
  /** The summary says this application must refuse to write the file. */
  | 'readOnly'
  /** This window holds no projection of the file, so it knows nothing else. */
  | 'couldNotBeRead'
  /** The substrate did not accept the file, so nothing is known about its shape. */
  | 'notParsed'
  /** The file has no top-level snippet list to add to. */
  | 'noMatchList';

/**
 * Whether one file may be written into, and why not when it may not.
 *
 * A discriminated union rather than a boolean with a nullable reason, so a
 * refused verdict with no reason is not representable — the shape every verdict
 * in this directory has.
 */
export type DestinationEligibility =
  | {
      /** A snippet may be created in this file. */
      readonly kind: 'eligible';
    }
  | {
      /** It may not, and the file is still shown. */
      readonly kind: 'ineligible';
      /** Why, as a code. */
      readonly reason: DestinationRefusal;
    };

/** The one eligible verdict, shared rather than rebuilt per file. */
const ELIGIBLE: DestinationEligibility = Object.freeze({ kind: 'eligible' as const });

/**
 * One file the form may offer as a destination.
 *
 * **The revision travels with the anchors**, in one value, which is 2c-2-2's
 * High finding restated for a list: a projection and the identities minted from
 * it are one fact, and passing a second value straight from somewhere else
 * type-checks perfectly and is wrong.
 */
export interface CreationDestination {
  /** The file, by the identity this window holds. */
  readonly document: DocumentId;
  /** Its path relative to the configuration root, for a screen to name it by. */
  readonly path: string;
  /**
   * The revision the projection this was derived from was of.
   *
   * **The empty revision when this window holds no projection of the file**, which
   * is the `couldNotBeRead` case. It cannot reach the wire: such a destination is
   * `ineligible`, and {@link canCreate} refuses a form whose chosen destination is
   * — see {@link revisionOf} for the same argument stated for the draft's base.
   */
  readonly revision: ContentRevision;
  /** Whether a snippet may be created here, and why not when it may not. */
  readonly eligibility: DestinationEligibility;
  /**
   * The snippets an `After` placement may name, in the order the file writes
   * them.
   *
   * Identities only. A screen that wants to *name* one looks it up in the
   * projection it already draws the snippet list from; carrying display text here
   * would be this model holding a second copy of it.
   */
  readonly anchors: readonly MatchId[];
}

/**
 * What one listed file is, as a destination.
 *
 * **Two values, because a file is two facts here**: the summary is what the
 * window lists and is always present, and the projection is what it managed to
 * read and may be absent. Everything that needs a parse — the revision the
 * anchors were minted from, and the anchors themselves — comes from the second
 * and is empty without it.
 *
 * @param summary - The file, as the window lists it.
 * @param view - The file's projection, exactly as this window holds it, or `null`
 *   when it holds none.
 * @returns The destination, eligible or with its reason.
 */
export function destinationOf(
  summary: DocumentSummary,
  view: DocumentView | null
): CreationDestination {
  return {
    document: summary.id,
    path: summary.relative_path,
    revision: view?.revision ?? '',
    eligibility: destinationEligibility(summary, view),
    anchors: view === null ? [] : view.matches.map((match) => match.id)
  };
} // End of function destinationOf()

/**
 * Whether a snippet may be created in one listed file.
 *
 * `holdsMatches` is asked of `kind`, which is what espanso treats the file as and
 * is a fact about **where it lives** — espanso does not load snippets out of
 * `config/`, whatever the file's keys say, so a snippet written there would never
 * fire. It and `read_only` are facts a *summary* carries, so they are decided
 * first and are decidable for a file this window never managed to read; the last
 * two are read off the projection and need one.
 *
 * @param summary - Anything carrying the file's kind and its read-only flag: a
 *   `DocumentSummary`, or a `DocumentView`, which carries both fields itself.
 * @param view - The file's projection, or `null` when this window holds none.
 * @returns The verdict, with a reason code when it is a refusal.
 */
export function destinationEligibility(
  summary: { readonly kind: FileKind; readonly read_only: boolean },
  view: DocumentView | null
): DestinationEligibility {
  if (!holdsMatches(summary)) {
    return { kind: 'ineligible', reason: 'notASnippetFile' };
  }
  if (summary.read_only) {
    return { kind: 'ineligible', reason: 'readOnly' };
  }
  if (view === null) {
    return { kind: 'ineligible', reason: 'couldNotBeRead' };
  }
  if (!view.parsed) {
    return { kind: 'ineligible', reason: 'notParsed' };
  }
  if (!view.top_level_keys.some((key) => key.text === MATCH_LIST_KEY)) {
    return { kind: 'ineligible', reason: 'noMatchList' };
  }
  return ELIGIBLE;
} // End of function destinationEligibility()

/**
 * Every file the window lists, as a destination, in the order it lists them.
 *
 * **The list is the summaries and not the projections**, which is the first
 * review round's sixth finding. The earlier version mapped the projections, so a
 * file whose `get_document` refused was absent from the destination list
 * altogether while the sidebar went on naming it — the silent filtering the
 * consult's Q5 rejects, arrived at by leaving a file out rather than by hiding a
 * row. A file with no projection is offered and refused with `couldNotBeRead`.
 *
 * **`couldNotBeRead` is "this window holds no projection", stated exactly.** In
 * this application the two are the same state: `BrowserState.open` projects every
 * file it lists, so a missing projection means the read refused and
 * `BrowserState.loadFailures` carries the reason the sidebar shows. The one other
 * way to reach it is a projection dropped after a committed save this window could
 * not re-read, which is also a read that failed. What no type here forces is that
 * the two lists come from one window: a caller may hand in projections of one
 * workspace and summaries of another, and every file would then read as unread.
 *
 * @param documents - Every file the window lists, in window order.
 * @param views - Every projection this window holds, in any order.
 * @returns One destination per listed file, in the same order.
 */
export function destinationsOf(
  documents: readonly DocumentSummary[],
  views: readonly DocumentView[]
): readonly CreationDestination[] {
  return documents.map((summary) =>
    destinationOf(summary, views.find((view) => view.id === summary.id) ?? null)
  );
} // End of function destinationsOf()

/** Where a new snippet goes, as this form holds it. */
export type CreationPlacement =
  | {
      /** At the top of the file's snippet list. */
      readonly kind: 'front';
    }
  | {
      /** Directly after one named snippet. */
      readonly kind: 'after';
      /** The snippet it follows, **by identity**. */
      readonly anchor: MatchId;
    }
  | {
      /** At the bottom of the file's snippet list. */
      readonly kind: 'end';
    };

/** The end placement, shared rather than rebuilt. */
const AT_END: CreationPlacement = Object.freeze({ kind: 'end' as const });

/**
 * Whether two placements say the same thing.
 *
 * The idiom the whole of `./draft.ts` is built on: *a change that changes nothing
 * is not a change*. It matters more here than it looks, because since the first
 * review round a placement that really moves **withdraws the consent and the
 * outcome on screen** — so a control that re-emits the value it already holds
 * would otherwise clear a refusal panel nobody dismissed.
 *
 * @param one - One placement.
 * @param other - The other.
 * @returns `true` when they name the same position, anchor included.
 */
function samePlacement(one: CreationPlacement, other: CreationPlacement): boolean {
  if (one.kind !== other.kind) {
    return false;
  }
  return one.kind === 'after' && other.kind === 'after'
    ? sameIdentity(one.anchor, other.anchor)
    : true;
} // End of function samePlacement()

/**
 * The wire position one placement is.
 *
 * The two empty arms are objects rather than bare strings, which is what
 * {@link NewMatchPosition} documents and what the Rust side asserts: one shape
 * per wire enum is what lets a value be recognised without a special case per
 * variant.
 *
 * @param placement - Where the form says the snippet goes.
 * @returns The value `create_match` takes.
 */
export function wirePosition(placement: CreationPlacement): NewMatchPosition {
  switch (placement.kind) {
    case 'front':
      return { Front: {} };
    case 'after':
      return { After: { anchor: placement.anchor } };
    case 'end':
      return { End: {} };
  }
} // End of function wirePosition()

/**
 * Whether two match identities name the same snippet of the same parse.
 *
 * All three fields, because all three are the identity: the revision is part of
 * it precisely so that a value crossing a reparse is refused rather than resolved
 * to whatever now occupies that arena slot.
 *
 * @param one - One identity.
 * @param other - The other.
 * @returns `true` when they name the same snippet.
 */
function sameIdentity(one: MatchId, other: MatchId): boolean {
  return (
    one.document === other.document && one.revision === other.revision && one.node === other.node
  );
} // End of function sameIdentity()

/**
 * One new-snippet form.
 *
 * **A value with pure transitions, never a store**, which is 2c-1a's D1: a
 * component holds one in a `$state.raw` and reassigns it, and every function
 * below returns a new form without touching its argument.
 */
export interface MatchCreationSession {
  /** Every file the form offers, eligible or not, in window order. */
  readonly destinations: readonly CreationDestination[];
  /** The file chosen, or `null` when none has been. */
  readonly chosen: DocumentId | null;
  /** Where in that file's list the snippet goes. */
  readonly placement: CreationPlacement;
  /**
   * The snippet the window had selected when this form was opened, or `null`.
   *
   * Kept so that {@link chooseDestination} can recompute the default placement
   * for a *newly* chosen file, which is the consult's Q4: the anchor default is a
   * function of the destination and cannot be decided once at the start.
   */
  readonly held: MatchId | null;
  /** What the two controls hold. Drafted, with history and consent. */
  readonly draft: Draft<CreationBuffers>;
  /** Whether a save is in flight. */
  readonly phase: EditorPhase;
  /** Which field has the focus, as the screen last reported it. */
  readonly focus: CreationField | null;
  /** The run of typing later keystrokes may join, or `null`. */
  readonly group: TypingRun<CreationField> | null;
  /** What the last attempt sent, or `null`. Kept so a refusal can be consented to. */
  readonly submitted: DraftSubmission<CreationBuffers> | null;
  /** How the last attempt ended, as the thing a screen draws, or `null`. */
  readonly outcome: SaveOutcomeModel<CreationBuffers> | null;
  /**
   * Lines to show **beside** the outcome rather than in place of it.
   *
   * Today exactly one can appear: a committed create whose adoption failed. The
   * bytes are on disk (`PROGRESS.md` D2) and what failed is this window's attempt
   * to bring itself back into step, so it is never a replacement for the saved
   * arm.
   */
  readonly extraMessages: readonly SaveOutcomeMessage[];
  /** How the last attempt failed to produce an outcome at all, or `null`. */
  readonly sendFailure: SendFailure | null;
  /**
   * Whether a create has committed through this form.
   *
   * Set by a committed save and cleared by **nothing**. Every destination this
   * form holds was derived from a projection the commit replaced, so its
   * revisions and every anchor beside them are stale; {@link canCreate} is
   * `false` for as long as this is `true`, and only {@link startMatchCreation}
   * over freshly projected documents produces a form that can create again.
   */
  readonly committed: boolean;
  /**
   * The created snippet's identity in the new revision, or `null`.
   *
   * `SavedResult.moved` for the arm that answered it. **`null` is legal on a
   * committed create**: the wire says so — the command answers no identity when
   * the file changed again between the write and the read that followed it — so a
   * screen that offers *open the new snippet* has to be able to draw that case.
   */
  readonly created: MatchId | null;
  /** Where the typing run's boundary readings come from. */
  readonly clock: Clock;
}

/**
 * The placement a form defaults to for one destination.
 *
 * The consult's Q4, exactly: `After` the held selection when that selection
 * belongs to this destination **and to the revision this form holds for it**, and
 * `End` otherwise. The revision comparison is not decoration — an identity from
 * an older parse of the same file is precisely the value that would resolve to a
 * *different* snippet, and `create_match` refuses it rather than resolving it.
 *
 * @param destinations - Every file the form offers.
 * @param held - The window's selected snippet, or `null`.
 * @param document - The file being chosen, or `null`.
 * @returns Where the snippet should go by default.
 */
function defaultPlacement(
  destinations: readonly CreationDestination[],
  held: MatchId | null,
  document: DocumentId | null
): CreationPlacement {
  if (held === null || document === null || held.document !== document) {
    return AT_END;
  }
  const destination = destinations.find((one) => one.document === document);
  if (destination === undefined || destination.revision !== held.revision) {
    return AT_END;
  }
  return destination.anchors.some((anchor) => sameIdentity(anchor, held))
    ? { kind: 'after', anchor: held }
    : AT_END;
} // End of function defaultPlacement()

/**
 * Opens a new-snippet form over the files this window holds.
 *
 * The destination starts as the held selection's own file when there is one,
 * because that is the file the person is looking at; it is `null` otherwise, and
 * {@link canCreate} then answers `noDestination` rather than this function
 * guessing one. **An ineligible file is still chosen** when the selection is in
 * it: hiding the refusal by silently choosing somewhere else would move a
 * person's snippet to a file they did not name.
 *
 * @param documents - Every file the window lists, in window order.
 * @param views - Every projection this window holds.
 * @param held - The snippet the window has selected, or `null`.
 * @param clock - Where the typing run's boundary readings come from.
 *   **Required**: a default would be `Date.now`, which is the one thing a test
 *   cannot drive.
 * @returns A clean form with no history, no consent and nothing said.
 */
export function startMatchCreation(
  documents: readonly DocumentSummary[],
  views: readonly DocumentView[],
  held: MatchId | null,
  clock: Clock
): MatchCreationSession {
  const destinations = destinationsOf(documents, views);
  const chosen =
    held !== null && destinations.some((one) => one.document === held.document)
      ? held.document
      : null;
  return {
    destinations,
    chosen,
    placement: defaultPlacement(destinations, held, chosen),
    held,
    // The base revision a creation is drafted from is the destination's, which is
    // not known until one is chosen and moves when it changes — `chooseDestination`
    // re-points it. What the draft needs a revision for is the acknowledgement
    // round trip, which binds consent to a candidate *and* a base. Since the first
    // review round's second finding it is also **what nothing downstream
    // substitutes**: `BrowserState.createMatch` forwards the base revision it is
    // handed rather than reading its own projection's, so a form opened at one
    // revision conflicts rather than commits against a file the window has since
    // re-read. What no type forces is that a caller hands it *this* revision;
    // `submission.baseRevision` is where it is.
    draft: startDraft(revisionOf(destinations, chosen), { trigger: '', replace: '' }, BUFFER_RULES),
    phase: 'editing',
    focus: null,
    group: null,
    submitted: null,
    outcome: null,
    extraMessages: [],
    sendFailure: null,
    committed: false,
    created: null,
    clock
  };
} // End of function startMatchCreation()

/**
 * The revision one chosen destination was projected at, or the empty revision.
 *
 * **The empty string stands for "no file has been chosen, or the file chosen has
 * no projection"**, and it is safe for one reason worth stating exactly, because
 * the draft's base revision *is* what a caller sends: a form can only produce a
 * submission when {@link canCreate} answers `true`, which requires a chosen
 * destination whose eligibility is `eligible` — and an unprojected file is
 * `couldNotBeRead`, which is not. So the empty revision cannot reach the wire
 * unless a caller builds a submission some other way, which no function here does.
 *
 * @param destinations - Every file the form offers.
 * @param document - The file chosen, or `null`.
 * @returns The revision, or `''`.
 */
function revisionOf(
  destinations: readonly CreationDestination[],
  document: DocumentId | null
): ContentRevision {
  if (document === null) {
    return '';
  }
  return destinations.find((one) => one.document === document)?.revision ?? '';
} // End of function revisionOf()

/**
 * The chosen destination, or `null`.
 *
 * @param session - The form to ask about.
 * @returns The destination, or `null` when none is chosen or the chosen identity
 *   names no file this form holds.
 */
export function chosenDestination(session: MatchCreationSession): CreationDestination | null {
  const chosen = session.chosen;
  if (chosen === null) {
    return null;
  }
  return session.destinations.find((one) => one.document === chosen) ?? null;
} // End of function chosenDestination()

/**
 * The conflict the form is showing, or `null`.
 *
 * @param session - The form to ask about.
 * @returns The conflict model, or `null` when the form is not in one.
 */
export function conflictOf(session: MatchCreationSession): ConflictModel<CreationBuffers> | null {
  return conflictArm(session.outcome);
} // End of function conflictOf()

/**
 * Whether this form accepts changes at all right now.
 *
 * Three reasons it may not, and each has its own refusal code below: not while a
 * save is in flight, not while a conflict is showing, and not after a commit —
 * because every destination this form holds was derived from a projection that
 * commit replaced.
 *
 * @param session - The form to ask about.
 * @returns `true` when the controls may change anything.
 */
export function isEditable(session: MatchCreationSession): boolean {
  return session.phase === 'editing' && !session.committed && conflictOf(session) === null;
} // End of function isEditable()

/**
 * Everything the form must forget when the transaction it would send changes.
 *
 * **The submission's identity is the buffers *and* where they would go**, which
 * is the first review round's first finding. Consent is content-addressed to the
 * buffers alone — `draft.ts` cannot see a destination — so accepting the findings
 * of a refusal in file A, then retargeting to file B, left the acknowledgement
 * bound and `beginCreate` sent it: identical finding values authorising a
 * transaction nobody was shown.
 *
 * Three things go together here, and each on its own would be a half-fix: the
 * submission the consent was collected against, the outcome panel describing that
 * attempt, and the lines beside it. The typing run is closed too, so a keystroke
 * after a retarget opens a step of its own.
 *
 * **The consent itself is the caller's to drop**, because dropping it is a
 * transition on the *draft* and both callers already make one: `retargetedDraft`
 * for a change of destination, `withdrawnConsent` for a change of position. This
 * function installs whatever draft it is handed and cannot check that it carries
 * no consent — `Draft` exposes the field, so the check would be possible, but a
 * function that silently corrected its argument would hide the case where a caller
 * meant to keep it.
 *
 * @param session - The form.
 * @param draft - The draft to install, with its consent already withdrawn and its
 *   base already re-pointed if the destination moved.
 * @returns The form with nothing said about an attempt that no longer describes
 *   what would be sent.
 */
function withdrawnSubmission(
  session: MatchCreationSession,
  draft: Draft<CreationBuffers>
): MatchCreationSession {
  return {
    ...session,
    draft,
    submitted: null,
    outcome: null,
    extraMessages: [],
    group: null,
    sendFailure: null
  };
} // End of function withdrawnSubmission()

/**
 * Chooses the file the snippet will be created in.
 *
 * **The placement is recomputed rather than kept**, which is the second half of
 * the consult's Q4: an anchor from another file, or from a revision this form no
 * longer holds, must not survive the change. Recomputing from scratch is what
 * makes that structural rather than a rule somebody has to remember to apply.
 *
 * **The draft is re-pointed at the newly chosen file's revision**, and everything
 * said about the last attempt is withdrawn ({@link withdrawnSubmission}). The
 * typed values are kept: they are what the person wrote, and they mean the same
 * thing in either file.
 *
 * @param session - The form.
 * @param document - The file to write into.
 * @returns The form with that destination, its default placement and a draft
 *   drafted from it, or the same form when it is not accepting changes or the
 *   destination did not move.
 */
export function chooseDestination(
  session: MatchCreationSession,
  document: DocumentId
): MatchCreationSession {
  if (!isEditable(session) || session.chosen === document) {
    return session;
  }
  return {
    ...withdrawnSubmission(
      session,
      retargetedDraft(session.draft, revisionOf(session.destinations, document))
    ),
    chosen: document,
    placement: defaultPlacement(session.destinations, session.held, document)
  };
} // End of function chooseDestination()

/**
 * Chooses where in the destination's list the snippet goes.
 *
 * An `after` naming a snippet that is not one of the chosen destination's own
 * anchors is **refused**, so an incompatible anchor cannot be installed by a
 * caller any more than it can survive a change of destination. The comparison is
 * all three fields of the identity, so an anchor from an older parse of the right
 * file is refused too.
 *
 * A placement that is accepted withdraws the last attempt, for
 * {@link chooseDestination}'s reason: *Front* and *After :sig* are two different
 * transactions, and findings accepted for one are not consent for the other. The
 * base revision does not move — the file has not changed.
 *
 * @param session - The form.
 * @param placement - Where the snippet should go.
 * @returns The form with that placement, or the same form when it is not
 *   accepting changes or the anchor does not belong to the chosen file.
 */
export function choosePlacement(
  session: MatchCreationSession,
  placement: CreationPlacement
): MatchCreationSession {
  if (!isEditable(session) || samePlacement(session.placement, placement)) {
    return session;
  }
  if (placement.kind === 'after') {
    const destination = chosenDestination(session);
    const anchor = placement.anchor;
    if (destination === null) {
      return session;
    }
    if (!destination.anchors.some((one) => sameIdentity(one, anchor))) {
      return session;
    }
  } // End of the arm that checks an anchor against the chosen file
  return { ...withdrawnSubmission(session, withdrawnConsent(session.draft)), placement };
} // End of function choosePlacement()

/**
 * The buffers with one field replaced.
 *
 * A named helper rather than a computed-key spread at the call site: the spread
 * widens the result's type, and this keeps the record exact.
 *
 * @param buffers - What the controls hold.
 * @param field - Which field to replace.
 * @param text - What it should hold.
 * @returns The new buffers.
 */
function withField(
  buffers: CreationBuffers,
  field: CreationField,
  text: string
): CreationBuffers {
  const next: Record<CreationField, string> = { ...buffers };
  next[field] = text;
  return next;
} // End of function withField()

/**
 * Records whatever one control now holds.
 *
 * **A value carrying a carriage return is refused here as well as at submit**,
 * and the redundancy is the same one `matchEditor.editField` documents: this is a
 * statement about *this function*, and the submit-time gate is a statement about
 * what reaches the wire. A control cannot produce one — its value has every line
 * break normalised, and an `<input>` deletes the character outright — so what this
 * closes is a caller that is not a control.
 *
 * @param session - The form.
 * @param field - Which field.
 * @param text - The control's whole value.
 * @returns The form after the edit, or the same form when it is not accepting
 *   changes, the text carries a carriage return, or nothing changed.
 */
export function editCreationField(
  session: MatchCreationSession,
  field: CreationField,
  text: string
): MatchCreationSession {
  if (!isEditable(session) || text.includes('\r')) {
    return session;
  }
  const recorded = recordTyping(
    session.draft,
    session.group,
    field,
    withField(session.draft.value, field, text),
    session.clock()
  );
  if (recorded === null) {
    return session;
  }
  return {
    ...session,
    draft: recorded.draft,
    focus: field,
    group: recorded.group,
    sendFailure: null
  };
} // End of function editCreationField()

/**
 * Records which control has the focus, ending the typing run when it moves.
 *
 * A blur is `focusCreationField(session, null)`; a change of focused field is a
 * call naming a different one. Focusing the field that already has the focus
 * changes nothing, so a spurious focus event does not split an undo step.
 *
 * @param session - The form.
 * @param field - The field that now has the focus, or `null` for a blur.
 * @returns The form with the focus recorded and the run closed when it moved.
 */
export function focusCreationField(
  session: MatchCreationSession,
  field: CreationField | null
): MatchCreationSession {
  if (session.focus === field) {
    return session;
  }
  return { ...session, focus: field, group: null };
} // End of function focusCreationField()

/**
 * Goes back one step.
 *
 * A structural action, so the typing run ends: a keystroke after an undo starts a
 * step of its own rather than amending the value the undo restored.
 *
 * @param session - The form to undo.
 * @returns The form one step back, or the same form when there is nothing to undo
 *   or it is not accepting changes.
 */
export function undoCreation(session: MatchCreationSession): MatchCreationSession {
  if (!isEditable(session)) {
    return session;
  }
  const draft = undoDraft(session.draft);
  return draft === session.draft ? session : { ...session, draft, group: null, sendFailure: null };
} // End of function undoCreation()

/**
 * Goes forward one step, undoing an undo.
 *
 * @param session - The form to redo.
 * @returns The form one step forward, or the same form when there is nothing to
 *   redo or it is not accepting changes.
 */
export function redoCreation(session: MatchCreationSession): MatchCreationSession {
  if (!isEditable(session)) {
    return session;
  }
  const draft = redoDraft(session.draft);
  return draft === session.draft ? session : { ...session, draft, group: null, sendFailure: null };
} // End of function redoCreation()

/**
 * Why this form cannot be submitted as it stands.
 *
 * **A code, never a sentence.** `creationRefusalKey` maps it to a dictionary key
 * and `tCreationRefusal` in `../i18n` renders it; a component never builds the
 * key.
 *
 * This is where creation differs from the small editor in a way worth naming:
 * `matchEditor.beginSave` answers a bare `null` and *cannot explain itself*,
 * because its own header says no signature there can carry a reason to a control
 * that was never drawn. Here every refusal has a code, so a screen can say why
 * the button does nothing.
 */
export type CreationRefusal =
  /** A create has already committed through this form. */
  | 'alreadyCreated'
  /** A save is in flight. */
  | 'saveInFlight'
  /** A conflict is on screen and has not been dismissed. */
  | 'conflict'
  /** No file has been chosen. */
  | 'noDestination'
  /** The chosen file is one this application will not write a snippet into. */
  | 'destinationIneligible'
  /** The placement names a snippet the chosen file's projection does not hold. */
  | 'anchorUnavailable'
  /** The trigger is empty, and it is required. */
  | 'triggerEmpty'
  /** The body is empty, and it is required. */
  | 'replaceEmpty'
  /** A value carries a carriage return, which no control here could read back. */
  | 'carriageReturn';

/**
 * What one new snippet would say, derived from the buffers.
 *
 * Both values are **logical text**, never YAML: how each is spelled in the file —
 * plain, quoted, or a `|` block — is Rust's decision, made by the same encoder
 * every other value this application writes goes through.
 *
 * @param buffers - What the controls hold.
 * @returns The value `create_match` takes.
 */
export function newMatchOf(buffers: CreationBuffers): NewMatch {
  return { trigger: buffers.trigger, replace: buffers.replace };
} // End of function newMatchOf()

/**
 * Why the form cannot be submitted, or `null` when it can.
 *
 * The order of the checks is the order a person would fix them in: what the form
 * is doing, then where the snippet goes, then what it says.
 *
 * **The carriage-return check reads the value that would be sent**, which is the
 * buffers here because both fields are always written — unlike the small editor,
 * where a field refused *for* carrying a carriage return legitimately holds one
 * in its buffer while sending `'Unchanged'`.
 *
 * @param session - The form to ask about.
 * @returns The reason, or `null` when {@link beginCreate} would produce a
 *   submission.
 */
export function creationRefusal(session: MatchCreationSession): CreationRefusal | null {
  if (session.committed) {
    return 'alreadyCreated';
  }
  if (session.phase === 'saving') {
    return 'saveInFlight';
  }
  if (conflictOf(session) !== null) {
    return 'conflict';
  }
  const destination = chosenDestination(session);
  if (destination === null) {
    return 'noDestination';
  }
  if (destination.eligibility.kind !== 'eligible') {
    return 'destinationIneligible';
  }
  const placement = session.placement;
  if (
    placement.kind === 'after' &&
    !destination.anchors.some((anchor) => sameIdentity(anchor, placement.anchor))
  ) {
    return 'anchorUnavailable';
  }
  const buffers = session.draft.value;
  if (buffers.trigger === '') {
    return 'triggerEmpty';
  }
  if (buffers.replace === '') {
    return 'replaceEmpty';
  }
  if (buffers.trigger.includes('\r') || buffers.replace.includes('\r')) {
    return 'carriageReturn';
  }
  return null;
} // End of function creationRefusal()

/**
 * Whether the form may be submitted.
 *
 * @param session - The form to ask about.
 * @returns `true` when {@link creationRefusal} answers `null`.
 */
export function canCreate(session: MatchCreationSession): boolean {
  return creationRefusal(session) === null;
} // End of function canCreate()

/** A create about to be sent: the form that is waiting, and what to send. */
export interface StartedCreation {
  /** The form, now in flight, with the submission recorded on it. */
  readonly session: MatchCreationSession;
  /**
   * What was drafted, for the acknowledgement round trip and the history
   * boundary.
   *
   * Its `acknowledgement` is whatever consent is bound to **this exact
   * candidate** and `EMPTY_ACKNOWLEDGEMENT` otherwise; `submissionOf` is the only
   * place the two are put together.
   */
  readonly submission: DraftSubmission<CreationBuffers>;
  /** The file to write into. */
  readonly document: DocumentId;
  /** What the new snippet says. */
  readonly newMatch: NewMatch;
  /** Where it goes in that file's list. */
  readonly position: NewMatchPosition;
}

/**
 * Starts a create of the form as it stands.
 *
 * The wire values are built from **the submission's own candidate** rather than
 * from the session, so the three values that travel together — the candidate, the
 * consent bound to it, and the `NewMatch` derived from it — cannot describe two
 * different things.
 *
 * **The carriage-return gate is repeated on the derived candidate**, and it is
 * not redundant: {@link creationRefusal} reads the live buffers, and this reads
 * what would actually be written. `NewMatch` carries **no brand**, unlike
 * `RoundTripText`, so a caller that builds one by hand type-checks — which is
 * exactly the caller this gate is for, since no control in this window can
 * produce the character at all.
 *
 * @param session - The form to submit.
 * @returns The waiting form and everything the command takes, or `null` when
 *   {@link creationRefusal} names a reason.
 */
export function beginCreate(session: MatchCreationSession): StartedCreation | null {
  if (!canCreate(session)) {
    return null;
  }
  const destination = chosenDestination(session);
  if (destination === null) {
    return null;
  }
  const submission = submissionOf(session.draft);
  const newMatch = newMatchOf(submission.candidate);
  if (newMatch.trigger.includes('\r') || newMatch.replace.includes('\r')) {
    return null;
  }
  return {
    session: {
      ...session,
      phase: 'saving',
      submitted: submission,
      group: null,
      sendFailure: null
    },
    submission,
    document: destination.document,
    newMatch,
    position: wirePosition(session.placement)
  };
} // End of function beginCreate()

/**
 * Takes a create's answer.
 *
 * **Not sealed, and that is not an omission.** The seal of `./invalidation.ts`
 * exists because a whole-document replacement makes every identity in the file
 * stale with no single identity to answer with. A create has one:
 * `SavedResult.moved` is the snippet that was created, and
 * `BrowserState.createMatch` performs the adoption before this is ever called.
 *
 * On a `saved` arm the draft's base moves to the candidate that was sent, through
 * `savedDraft`, which is what makes the form clean rather than dirty against a
 * value that has been written. A **committed** save additionally spends the form:
 * `committed` is set, the created identity is recorded, and nothing here clears
 * either.
 *
 * **A failed adoption is a line beside the outcome, never in place of it.** The
 * wrapper answers `adoption: { kind: 'failed' }` when the file was written and
 * this window could not read it back; telling the person the create failed would
 * invite a retry of a write that already happened (`PROGRESS.md` D2).
 *
 * @param session - The form waiting for an answer.
 * @param result - How the save ended, exactly as the transaction reported it.
 * @param adoption - What became of the adoption, from `BrowserState.createMatch`.
 *   Required and not defaulted: a default would be this function inventing a
 *   `notOwed` for a caller that simply did not look.
 * @returns The form showing what the create ended as.
 */
export function applyCreate(
  session: MatchCreationSession,
  result: SaveResult,
  adoption: InvalidationStatus
): MatchCreationSession {
  const submission = session.submitted;
  if (submission === null) {
    return session;
  }
  const outcome = describeEditSave(result, session.draft);
  const failed = invalidationFailureMessage(adoption);
  const extraMessages = failed === null ? [] : [failed];
  if (result.outcome !== 'saved') {
    return {
      ...session,
      phase: 'editing',
      group: null,
      outcome,
      extraMessages,
      sendFailure: null
    };
  }
  return {
    ...session,
    // A commit replaced the bytes every destination here was derived from, so the
    // form stops accepting changes until it is seeded again. A `committed: false`
    // replaced nothing and spends nothing.
    committed: result.committed,
    created: result.moved,
    draft: savedDraft(session.draft, submission, result.revision),
    phase: 'editing',
    group: null,
    outcome,
    extraMessages,
    sendFailure: null
  };
} // End of function applyCreate()

/**
 * Records that the create produced no outcome.
 *
 * **Not an outcome, and not always "nothing was written".** The command failed
 * before any of the three arms existed. Whether the file changed is a **second**
 * question, and the only honest answers are "no" and "this application cannot
 * tell". The draft is untouched either way, so nothing the person typed is lost.
 *
 * @param session - The form waiting for an answer.
 * @param mayHaveWritten - Whether the file may already hold the new snippet.
 * @param reason - Why the command rejected, or `null` when nothing was sent and
 *   the boundary therefore has no rejection to hand on.
 * @returns The form, back to drafting, with the right notice raised.
 */
export function createCouldNotBeSent(
  session: MatchCreationSession,
  mayHaveWritten: boolean,
  reason: IpcFailure | null
): MatchCreationSession {
  return {
    ...session,
    phase: 'editing',
    group: null,
    sendFailure: sendFailureOf(mayHaveWritten, reason)
  };
} // End of function createCouldNotBeSent()

/**
 * Records that the person accepted the findings of the refusal on screen.
 *
 * Delegates to `consentForRefusal`, which delegates to `acknowledgeRefusal` — the
 * **only** producer of consent in this application. The submission is taken from
 * the form rather than from an argument, so a caller cannot pair one candidate's
 * acknowledgement with another candidate.
 *
 * @param session - The form showing a refusal.
 * @returns The form carrying consent, or the same form.
 */
export function acknowledgeCreationFindings(
  session: MatchCreationSession
): MatchCreationSession {
  const draft = consentForRefusal(session.draft, session.submitted, session.outcome);
  return draft === session.draft ? session : { ...session, draft };
} // End of function acknowledgeCreationFindings()

/**
 * Puts the outcome away and gives the controls back.
 *
 * *Keep editing*, for all three arms. The draft is untouched — this is a panel
 * being dismissed, not a state being resolved — and the submission goes with it,
 * because there is nothing left on screen to acknowledge.
 *
 * **It does not give the controls back after a commit**, and that is deliberate:
 * {@link MatchCreationSession.committed} lives on the form and survives this, so
 * a person cannot dismiss their way past the re-seed a commit owes.
 *
 * @param session - The form showing an outcome.
 * @returns The form with nothing being said about the last attempt.
 */
export function keepDrafting(session: MatchCreationSession): MatchCreationSession {
  return {
    ...session,
    submitted: null,
    outcome: null,
    extraMessages: [],
    group: null,
    sendFailure: null
  };
} // End of function keepDrafting()

/**
 * The choices a conflict offers in this sub-phase.
 *
 * **One**, and the two that are missing are missing on purpose. *Copy draft*
 * copies a text, and this draft is two fields. *Load the version on disk* would
 * mean re-seeding the destinations from a fresh read, which is conflict capture
 * and preservation — Phase 2c-4a — and a rough version of it here would make that
 * phase look already done.
 *
 * **None of these is "keep my draft"** and none may become one: that phrase means
 * *reapply the draft to the newly parsed document*, which is 2c-4b.
 */
const CONFLICT_CHOICES: readonly ConflictChoice[] = ['keepEditing'];

/** Everything a screen needs about one form, derived on every read. */
export interface MatchCreationView {
  /** Every file the form offers, eligible or not, in window order. */
  readonly destinations: readonly CreationDestination[];
  /** The file chosen, or `null`. */
  readonly chosen: CreationDestination | null;
  /** Where in that file's list the snippet goes. */
  readonly placement: CreationPlacement;
  /** What the trigger control shows. */
  readonly trigger: string;
  /** What the body control shows. */
  readonly replace: string;
  /** Whether anything has been typed. Derived. */
  readonly dirty: boolean;
  /** Whether there is a step to go back to. Derived. */
  readonly canUndo: boolean;
  /** Whether there is an undone step to go forward to. Derived. */
  readonly canRedo: boolean;
  /** Whether a save is in flight. */
  readonly saving: boolean;
  /** Whether the controls accept changes. */
  readonly editable: boolean;
  /** Whether the create control does anything. */
  readonly canCreate: boolean;
  /** Why it does not, as a code, or `null`. */
  readonly refusal: CreationRefusal | null;
  /** How the last attempt failed to produce an outcome, or `null`. */
  readonly sendFailure: SendFailure | null;
  /**
   * The reasons to show beside that failure, outermost first.
   *
   * `sendFailureLines` walks the chain in the model, so how deep a screen goes is
   * a decision a test can fail on rather than one written in markup.
   */
  readonly failureLines: readonly SendFailureLine[];
  /** How the last attempt ended, or `null`. */
  readonly outcome: SaveOutcomeModel<CreationBuffers> | null;
  /** The outcome's lines followed by anything to be said beside them. */
  readonly messages: readonly SaveOutcomeMessage[];
  /** The presentation changes a saved arm disclosed, in report order. */
  readonly notes: readonly PresentationNote[];
  /** What to offer about a refusal, withdrawn once its findings are stale. */
  readonly refusalChoices: readonly RawSaveChoice[];
  /** Whether the findings on screen are about a draft that has since changed. */
  readonly findingsAreStale: boolean;
  /** The conflict being shown, or `null`. */
  readonly conflict: ConflictModel<CreationBuffers> | null;
  /** What to offer about the conflict. */
  readonly conflictChoices: readonly ConflictChoice[];
  /**
   * Whether a create has committed and this form must be seeded again.
   *
   * **What no type here forces** is that a caller performs the re-seed: a
   * component that draws no way to do it leaves a person with a form that has
   * stopped accepting changes. What the model forces is that no submission is
   * produced from destinations a commit has invalidated.
   */
  readonly committed: boolean;
  /** The created snippet's identity, or `null`. See the session's own field. */
  readonly created: MatchId | null;
}

/**
 * Everything a screen needs about one form.
 *
 * Derived on every call and stored nowhere, which is 2c-1a's D2 carried up: a
 * `dirty` this module cached would be a second answer to a question the draft
 * already answers, and the two would eventually disagree.
 *
 * @param session - The form to describe.
 * @returns The view.
 */
export function matchCreationView(session: MatchCreationSession): MatchCreationView {
  const outcome = session.outcome;
  const refused = refusedArm(outcome);
  const stale = submissionIsStale(session.draft, session.submitted);
  const conflict = conflictOf(session);
  const saved = outcome !== null && outcome.kind === 'saved' ? outcome : null;
  return {
    destinations: session.destinations,
    chosen: chosenDestination(session),
    placement: session.placement,
    trigger: session.draft.value.trigger,
    replace: session.draft.value.replace,
    dirty: isDirty(session.draft),
    canUndo: canUndo(session.draft),
    canRedo: canRedo(session.draft),
    saving: session.phase === 'saving',
    editable: isEditable(session),
    canCreate: canCreate(session),
    refusal: creationRefusal(session),
    sendFailure: session.sendFailure,
    failureLines: sendFailureLines(session.sendFailure?.reason ?? null),
    outcome,
    messages: outcome === null ? [] : [...outcome.messages, ...session.extraMessages],
    notes: saved === null ? [] : saved.notes,
    refusalChoices: offeredRefusalChoices(refused, stale),
    findingsAreStale: refused !== null && stale,
    conflict,
    conflictChoices: conflict === null ? [] : CONFLICT_CHOICES,
    committed: session.committed,
    created: session.created
  };
} // End of function matchCreationView()

/**
 * One position a screen may offer, with whatever it needs to name it.
 *
 * **The `after` arm carries a projection and not a piece of text.**
 * {@link CreationDestination.anchors} is identities only, deliberately — a model
 * holding display text would be holding a second copy of what the snippet list
 * already draws — so what this hands a screen is the *projection* the identity
 * resolves to, and the screen names it the way it names a row, through
 * `triggerLabel` and `labelText` in `./labels.ts`.
 */
export interface PlacementOption {
  /**
   * A stable key for a keyed `{#each}` and for a control's own value.
   *
   * Built from the identity's three fields for an `after`, so two anchors of the
   * same file cannot collide and an anchor from an older parse is a different
   * key. It is a rendering key and never a way to recognise a snippet across a
   * change to the file, exactly as `matchKey` in `./labels.ts` is.
   */
  readonly key: string;
  /** The placement this option would install. */
  readonly placement: CreationPlacement;
  /** The snippet an `after` names, or `null` for the two empty arms. */
  readonly anchor: MatchView | null;
  /** Whether this is the placement the form currently holds. */
  readonly chosen: boolean;
}

/**
 * Every position the form can offer for the destination it holds.
 *
 * The consult's Q4 order — `Front`, then one option per named snippet, then
 * `End` — with the anchors in the order the file writes them, which is the order
 * {@link CreationDestination.anchors} carries.
 *
 * **An anchor this window can no longer name is not offered**, and that is the
 * honest answer rather than a hidden one: the projections handed in are asked
 * for a snippet of the anchor's own document *and its own revision*, so a file
 * re-read since the form opened resolves none of its anchors and the `after`
 * options disappear. The form is not left claiming it can place a snippet after
 * something it cannot show; {@link creationRefusal} answers `anchorUnavailable`
 * for a placement that was installed before the re-read, which is the same fact
 * said the other way round.
 *
 * @param session - The form to describe.
 * @param views - Every projection this window holds, in any order.
 * @returns The options, in the order a screen shows them.
 */
export function placementOptionsOf(
  session: MatchCreationSession,
  views: readonly DocumentView[]
): readonly PlacementOption[] {
  const front: CreationPlacement = { kind: 'front' };
  const options: PlacementOption[] = [
    { key: 'front', placement: front, anchor: null, chosen: samePlacement(session.placement, front) }
  ];
  const destination = chosenDestination(session);
  for (const anchor of destination?.anchors ?? []) {
    const view = views.find((one) => one.id === anchor.document && one.revision === anchor.revision);
    const match = view?.matches.find((one) => one.id.node === anchor.node);
    if (match === undefined) {
      continue;
    }
    const placement: CreationPlacement = { kind: 'after', anchor };
    options.push({
      key: `after:${anchor.document}:${anchor.revision}:${anchor.node}`,
      placement,
      anchor: match,
      chosen: samePlacement(session.placement, placement)
    });
  } // End of the loop over the chosen destination's anchors
  options.push({
    key: 'end',
    placement: AT_END,
    anchor: null,
    chosen: samePlacement(session.placement, AT_END)
  });
  return options;
} // End of function placementOptionsOf()

/**
 * The dictionary key holding one destination refusal's sentence.
 *
 * A `switch` over literal keys rather than a template, the idiom of every other
 * describer in this directory: a renamed key is a compile error here, and a new
 * member of {@link DestinationRefusal} with no sentence is one too.
 *
 * @param reason - Why the file may not be written into.
 * @returns The key holding that reason's sentence.
 */
export function destinationRefusalKey(reason: DestinationRefusal): TranslationKey {
  switch (reason) {
    case 'notASnippetFile':
      return 'browser.matchCreation.destination.notASnippetFile';
    case 'readOnly':
      return 'browser.matchCreation.destination.readOnly';
    case 'couldNotBeRead':
      return 'browser.matchCreation.destination.couldNotBeRead';
    case 'notParsed':
      return 'browser.matchCreation.destination.notParsed';
    case 'noMatchList':
      return 'browser.matchCreation.destination.noMatchList';
  }
} // End of function destinationRefusalKey()

/**
 * The dictionary key holding one submission refusal's sentence.
 *
 * @param reason - Why the form cannot be submitted.
 * @returns The key holding that reason's sentence.
 */
export function creationRefusalKey(reason: CreationRefusal): TranslationKey {
  switch (reason) {
    case 'alreadyCreated':
      return 'browser.matchCreation.cannotCreate.alreadyCreated';
    case 'saveInFlight':
      return 'browser.matchCreation.cannotCreate.saveInFlight';
    case 'conflict':
      return 'browser.matchCreation.cannotCreate.conflict';
    case 'noDestination':
      return 'browser.matchCreation.cannotCreate.noDestination';
    case 'destinationIneligible':
      return 'browser.matchCreation.cannotCreate.destinationIneligible';
    case 'anchorUnavailable':
      return 'browser.matchCreation.cannotCreate.anchorUnavailable';
    case 'triggerEmpty':
      return 'browser.matchCreation.cannotCreate.triggerEmpty';
    case 'replaceEmpty':
      return 'browser.matchCreation.cannotCreate.replaceEmpty';
    case 'carriageReturn':
      return 'browser.matchCreation.cannotCreate.carriageReturn';
  }
} // End of function creationRefusalKey()

/**
 * The acknowledgement one submission carries, for a caller that only needs that.
 *
 * A named read rather than a property walk at the call site, so the one place a
 * screen hands consent to the boundary is a place this module can be searched
 * for.
 *
 * @param submission - What {@link beginCreate} produced.
 * @returns The suspicions already shown to a person, for this exact candidate.
 */
export function acknowledgementOf(
  submission: DraftSubmission<CreationBuffers>
): Acknowledgement {
  return submission.acknowledgement;
} // End of function acknowledgementOf()

/**
 * The base revision this form would create against.
 *
 * A named read rather than a property walk at the call site, so the one place a
 * screen hands a revision to the boundary is a place this module can be searched
 * for — the same read `matchEditor.baseRevisionOf` and
 * `matchDeletion.baseRevisionOf` are.
 *
 * It is the **chosen destination's** revision, re-pointed by
 * {@link chooseDestination} every time the destination moves, and since the first
 * review round's second finding nothing downstream substitutes another:
 * `BrowserState.createMatch` forwards the base revision it is handed rather than
 * reading its own projection's.
 *
 * **What no type forces**, in the same sentence: that parameter is an ordinary
 * `ContentRevision`, so a caller may hand the window's current projection over
 * instead of this and get the old behaviour. What is closed is that the wrapper no
 * longer chooses for it.
 *
 * @param session - The form to ask about.
 * @returns The revision the draft is drafted from.
 */
export function baseRevisionOf(session: MatchCreationSession): ContentRevision {
  return session.draft.baseRevision;
} // End of function baseRevisionOf()
