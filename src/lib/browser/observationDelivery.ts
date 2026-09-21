/**
 * What one window delivers to its sessions about a watcher observation, what it
 * may still do automatically for a file while nothing can be delivered, and what
 * it says while an observation is held or a write's outcome is unknown.
 *
 * ## Three pure things, landed before anything consumes them
 *
 * Phase 2d-6-1a (the 2d-6 record, `docs/decisions/2d-6-split-notes.md` §2, the
 * orchestrator's cut) landed the values 2d-6-1b's `BrowserState` members and
 * 2d-6-2's session transitions consume, **additively**, and the record's §3 entry
 * 42 is why — shared facilities land before callers activate, so every boundary
 * compiles. Since 2d-6-1b `./workspace.svelte.ts` seals every verdict it reaches
 * through the constructors below and answers the guard's three inputs; since
 * 2d-6-2 the match editor's `applyObservation` in `./matchEditor.ts` consumes the
 * envelope, one named action per verdict arm. **No component registers that
 * receiver yet** (2d-6-6's), so in production every envelope still reaches the
 * receivers a test registered, or nobody; the other surfaces' transitions are
 * 2d-6-3, 2d-6-4 and 2d-6-5's.
 *
 * 1. **The delivery envelope** ({@link ObservationDelivery}): the narrowed
 *    observation plus the verdict the window reached about it, sealed together so
 *    a session receives *one decision* and never re-arbitrates (entries 2 and 4).
 *    Three constructors and no generic one: {@link arbitratedDelivery} runs the
 *    arbitration itself, so the verdict it seals is about the observation it
 *    seals, and {@link retainedDelivery} and {@link writtenHereDelivery} seal the
 *    two arms a pure arbitration can never answer.
 * 2. **The per-file automatic-reload guard decision**
 *    ({@link decideAutomaticReload}): whether an automatic reread of a file may
 *    still be taken, given the three per-file facts the record names (entries 15
 *    and 32). The predicate only — `BrowserState.automaticReloadGuardFor` answers
 *    the three facts from its own tables since 2d-6-1b, and
 *    `BrowserState.requestFileReread` is the guarded request that asks the
 *    predicate since 2d-6-1c — at the request and again immediately before the
 *    installation.
 * 3. **The sentences a surface owes while it cannot act** —
 *    {@link ExternalConflictNotice} for a retained observation (entry 13) and an
 *    unknown write outcome (entry 14), and {@link ExternalConflictAction} for the
 *    acknowledgement that ends the second — as codes with key functions, rendered
 *    through `tExternalConflictNotice` and `tExternalConflictAction` in `../i18n`
 *    and never by a key a component built.
 *
 * ## What this module is not
 *
 * It holds no state, registers nothing, installs nothing and calls no command —
 * the same three sentences `./conflictSource.ts` makes about itself, and for the
 * same reason: `BrowserState` in `./workspace.svelte.ts` is the only thing that
 * writes a table, `adoptDiskVersion` there is the only confirmed-install door, and
 * `conflictChoicesFor` in `./saveOutcome.ts` is the only producer of a choice
 * list. Nothing exported here is a control.
 */

import type { TranslationKey } from '../i18n/dictionaries';
import {
  arbitrateObservation,
  type ArbitrationOutcome,
  type ExternalChangeConflictSource,
  type ExternalConflictObservation,
  type ObservationVerdict,
  type StandingConflict
} from './conflictSource';

/**
 * One observation and the one verdict this window reached about it, sealed.
 *
 * **The envelope the 2d-6 record's §3 entry 4 names.** A session that receives
 * one combines it with its own draft and declared capabilities — `raised` builds
 * an external model from it, `supersedes` hands it to `supersedeConflict`,
 * `retained` records a pending-reconciliation restriction — and never looks at
 * the window's tables to decide anything (entry 11). Two sessions over one file
 * receive the *same* envelope, which is what stops one of them answering
 * `raised` and the other `coalesced` for one observation (entry 2).
 *
 * **Sealed by construction, and shallowly.** All three constructors freeze the
 * envelope, so a recipient cannot swap the verdict out from under a sibling
 * recipient; the observation and the verdict inside are the objects they were,
 * not frozen by this module. **Nothing in TypeScript ties the two fields
 * together**: a literal of this shape with a verdict about some other
 * observation type-checks, and only the three constructors below make the
 * pairing true. A caller that assembles one by hand gets no such guarantee.
 */
export interface ObservationDelivery {
  /** The narrowed observation, exactly as this window narrowed it. */
  readonly observation: ExternalConflictObservation;
  /**
   * What this window decided about it against what stood for the file.
   *
   * Every arm of `ObservationVerdict`, `retained` included: a held observation is
   * delivered too, so the surface can say it is waiting (entry 11's last row) —
   * and so that the *same* path carries the settlement verdict later, rather than
   * a second one.
   */
  readonly verdict: ObservationVerdict;
}

/**
 * An envelope whose verdict a pure arbitration answered.
 *
 * **The type says what {@link arbitratedDelivery} can seal**: never `retained`,
 * never `writtenHere`, because `arbitrateObservation` answers neither. A consumer
 * holding one may switch over `ArbitrationOutcome` alone with a `never` terminus,
 * where a consumer of the wider {@link ObservationDelivery} must handle all seven
 * arms. It is an intersection rather than a second interface so that every
 * `ArbitratedDelivery` is an `ObservationDelivery` with no conversion.
 */
export type ArbitratedDelivery = ObservationDelivery & {
  /** What was decided, by a pure arbitration. */
  readonly verdict: ArbitrationOutcome;
};

/**
 * Seals an observation with the verdict of arbitrating it, in one step.
 *
 * **The arbitration runs here so the pairing cannot be wrong.** `arbitrateObservation`
 * in `./conflictSource.ts` is called on the very observation the envelope carries;
 * a constructor taking a ready-made verdict would accept one minted for another
 * observation, and the recipient could not tell. What that leaves to the caller
 * is honesty about the operands — `standing` must be what really stands for this
 * file and `writeOutcomeUncertain` what the last settled write really established
 * — and `BrowserState` is what answers both.
 *
 * **It decides and delivers nothing.** The verdict is computed and sealed; which
 * sessions receive the envelope, and whether the window's tables moved between the
 * decision and the delivery, are the caller's questions — `BrowserState`'s
 * private `arbitrateHere` in `./workspace.svelte.ts`, which re-reads its four
 * tables after this returns and retains the observation instead when they moved.
 * The memoized origin on the three replacing arms comes from
 * `externalConflictSource` through the arbitration, which is a lookup and not a
 * registration.
 *
 * @param standing - What stands for the file, or `null` when nothing does.
 * @param observation - The narrowed observation that arrived.
 * @param writeOutcomeUncertain - Whether the last settled write this window made
 *   for the file may have written (ruling 27).
 * @returns The sealed envelope, whose verdict is never `retained` and never
 *   `writtenHere`.
 */
export function arbitratedDelivery(
  standing: StandingConflict | null,
  observation: ExternalConflictObservation,
  writeOutcomeUncertain: boolean
): ArbitratedDelivery {
  const verdict = arbitrateObservation(standing, observation, writeOutcomeUncertain);
  return Object.freeze({ observation, verdict });
} // End of function arbitratedDelivery()

/**
 * Seals an observation the window is holding rather than acting on.
 *
 * **One of the two arms {@link arbitratedDelivery} can never produce**, because a
 * pure arbitration holds no barrier and cannot know a write is in flight; only
 * `BrowserState` in `./workspace.svelte.ts` answers `retained`, and this is the
 * envelope it seals when it does. It says *held, and nobody has acted on it* and
 * nothing more — not that the observation will be looked at again.
 *
 * @param observation - The observation the barrier is holding.
 * @returns The sealed envelope, whose verdict is `retained`.
 */
export function retainedDelivery(observation: ExternalConflictObservation): ObservationDelivery {
  return Object.freeze({ observation, verdict: Object.freeze({ kind: 'retained' as const }) });
} // End of function retainedDelivery()

/**
 * Seals an observation a settlement dropped as a reading of the bytes a write of
 * this window ended on.
 *
 * **The other arm {@link arbitratedDelivery} can never produce**, because a pure
 * arbitration knows no settlement; only the write lease's `close()` in
 * `./workspace.svelte.ts` answers `writtenHere`, when `releaseBarrier` in
 * `./conflictSource.ts` finds the held observation's disk revision equal to the
 * revision the transaction ended on. It exists so that a session told `retained`
 * is told the wait is over on the same path — the alternative is a session that
 * blocks submission for a check that already happened and was never announced. It
 * says the revisions are equal and never that this window wrote them.
 *
 * @param observation - The observation the barrier held and dropped.
 * @returns The sealed envelope, whose verdict is `writtenHere`.
 */
export function writtenHereDelivery(
  observation: ExternalConflictObservation
): ObservationDelivery {
  return Object.freeze({ observation, verdict: Object.freeze({ kind: 'writtenHere' as const }) });
} // End of function writtenHereDelivery()

/**
 * The three verdicts that put a **new** origin in front of a surface.
 *
 * `raised`, `raisedWithoutReload` and `supersedes` each carry the memoized
 * `externalChange` source the surface's model is built from; the other four
 * carry the origin that already stood, or nothing. The 2d-6 record's §3 entry 12
 * is written over this distinction — a replacing verdict resets the surface's
 * reload step and clears its pending confirmations, and no other verdict does —
 * so the distinction is a type here rather than a list each transition repeats.
 */
export type ReplacingVerdict = Extract<
  ObservationVerdict,
  { readonly source: ExternalChangeConflictSource }
>;

/**
 * Whether one verdict replaces what a surface is showing (entry 12).
 *
 * **A `switch` with a `never` terminus**, so an eighth arm of `ObservationVerdict`
 * is a compile error here rather than a verdict that silently counts as
 * non-replacing. What it says is which arms *carry a new source*; whether a
 * session really resets its reload step on one is that session's transition's
 * business, and only its own suite can show it does.
 *
 * @param verdict - Any verdict.
 * @returns Whether it carries a new origin for the surface to show.
 */
export function isReplacingVerdict(verdict: ObservationVerdict): verdict is ReplacingVerdict {
  switch (verdict.kind) {
    case 'raised':
    case 'raisedWithoutReload':
    case 'supersedes':
      return true;
    case 'coalesced':
    case 'notLater':
    case 'retained':
    case 'writtenHere':
      return false;
    default: {
      const unreachable: never = verdict;
      return unreachable;
    }
  }
} // End of function isReplacingVerdict()

/**
 * The three per-file facts an automatic reread is decided on.
 *
 * **Every one is a fact about the file, and none is a fact about a panel.** The
 * 2d-6 record's §3 entry 15 is explicit that the uncertainty hold "blocks
 * automatic rereading after its surface closes — per file, never dependent on a
 * mounted panel", and the same is true of the other two: a retained observation
 * is held per document by ruling 27's barrier, and an open surface is a
 * registration in the write-surface registry, which a mounted component reports
 * into and which outlives no component that failed to report.
 *
 * **Nothing in TypeScript forces a caller to answer these from the tables that
 * hold them.** Three booleans are three booleans; `BrowserState.automaticReloadGuardFor`
 * in `./workspace.svelte.ts` is what answers them from the tables, in one
 * synchronous block, and `BrowserState.requestFileReread` is the guarded request
 * that re-asks them immediately before any installation, through
 * `rereadUnderGuard`'s guard (Phase 2d-6-1c).
 */
export interface AutomaticReloadGuardInputs {
  /**
   * Whether the last settled write this window made for the file may have written
   * and no acknowledgement has ended that hold.
   *
   * `true` for as long as the file is under ruling 27's uncertainty — from the
   * settlement that could not attribute the bytes until a later write settles
   * definitely, `open()` drops the workspace, or the person acknowledges the
   * snapshot through `BrowserState.acknowledgeWriteUncertainty` (the third exit,
   * entry 14). An automatic reread under it would install bytes a write of this
   * window may or may not have produced, and would do so with no surface open to
   * tell anybody — which is exactly the case entry 15 forbids.
   */
  readonly uncertaintyUnresolved: boolean;
  /**
   * Whether the barrier holds an observation for the file that no settlement has
   * released.
   *
   * A held observation means either that a write is in flight for the file or
   * that an arbitration was abandoned because the tables moved underneath it;
   * either way there is a decision pending about this file that an automatic
   * installation would pre-empt.
   */
  readonly observationRetained: boolean;
  /**
   * Whether any write surface is registered over the file.
   *
   * **A registration, never a mounted panel.** The conservative rule of the 2d-5
   * record's ruling 19: a surface capable of writing the file is open, so the
   * observation goes to it as a conflict and is not installed over its draft. It
   * says nothing about whether that surface has unsaved edits, which no
   * coordinator can observe.
   */
  readonly surfaceOpen: boolean;
}

/** Why an automatic reread was refused, in the order the three are asked. */
export type AutomaticReloadRefusal =
  /** The file is under an unresolved uncertainty hold. */
  | 'uncertaintyUnresolved'
  /** An observation for the file is held and unreleased. */
  | 'observationRetained'
  /** A write surface is registered over the file. */
  | 'surfaceOpen';

/**
 * Whether an automatic reread of one file may proceed, and if not, why.
 *
 * **A code rather than a boolean**, so the caller that refuses can record which
 * hold refused — the record's §3 entry 27 draws the retained and uncertain states
 * on the affected surface, and a `false` would have thrown away the one fact that
 * decides which sentence is owed. It is not itself a message: no key hangs off
 * it, and `browser.externalDocument.*` is 2d-6-9's.
 */
export type AutomaticReloadDecision =
  | {
      /** Every guard permits; the clean path may read the file again. */
      readonly kind: 'permitted';
    }
  | {
      /** One guard refused, and this is the first that did. */
      readonly kind: 'refused';
      /** Which one. */
      readonly reason: AutomaticReloadRefusal;
    };

/**
 * Decides whether an automatic reread of one file is permitted (entries 15 and 32).
 *
 * **What it enforces, exactly.** Given three per-file facts it answers
 * `permitted` only when all three are `false`, and otherwise names the first of
 * them that holds, in this order: the uncertainty hold, then a retained
 * observation, then an open surface. The order is the strength of the claim each
 * makes — an unknown write outcome is the one state under which even an empty
 * registry may not reread, because the hold outlives the surface that raised it
 * (entry 15), so it is asked first and is never masked by the answer to a weaker
 * question. Every operand is read exactly once, before any comparison: the inputs
 * are a value a caller assembled and a getter behind one of them could answer one
 * thing to this decision and another to whoever acts on it.
 *
 * **What it cannot enforce, in the same breath.** It cannot know that the three
 * facts are *current*: they are read off tables it does not hold, and a reread is
 * asynchronous, so a decision taken before the read is stale by the time the
 * answer arrives. The 2d-6 record's §3 entry 32 is the rule this rests on —
 * *every guard is rechecked immediately before installation* — and the caller
 * that passes this decision to `rereadUnderGuard` in `./workspace.svelte.ts` is
 * what must ask it again inside that guard, in the same synchronous block as the
 * installation. Nor can it enforce that `surfaceOpen` was answered from the
 * registry rather than from a component: it is a boolean, and `BrowserState`'s
 * own suite is what pins where the answer comes from. **It holds per file because
 * its inputs are per-file facts; it cannot stop a caller answering one of them
 * from a mounted panel's state, and it says so rather than claiming otherwise.**
 *
 * **It permits and never triggers.** A `permitted` answer is a permission the
 * clean path may exercise (the record's §6 item 1); closing a surface changes
 * eligibility only, and no reread starts from here.
 *
 * @param inputs - The three per-file facts, as `BrowserState` answers them.
 * @returns Whether the reread may proceed, and the first reason it may not.
 */
export function decideAutomaticReload(inputs: AutomaticReloadGuardInputs): AutomaticReloadDecision {
  // **All three off the value, read once and before any comparison.** See the
  // doc above: a getter could otherwise answer differently to the decision and
  // to whoever records its reason.
  const uncertaintyUnresolved = inputs.uncertaintyUnresolved;
  const observationRetained = inputs.observationRetained;
  const surfaceOpen = inputs.surfaceOpen;
  if (uncertaintyUnresolved) {
    return { kind: 'refused', reason: 'uncertaintyUnresolved' };
  }
  if (observationRetained) {
    return { kind: 'refused', reason: 'observationRetained' };
  }
  if (surfaceOpen) {
    return { kind: 'refused', reason: 'surfaceOpen' };
  }
  return { kind: 'permitted' };
} // End of function decideAutomaticReload()

/**
 * One line a surface shows while an observation about its file cannot be acted
 * on, as a code rather than a sentence.
 *
 * **Two states, two sentences, and both are bounded by the 2d-6 record's §3
 * entry 40.** The retained sentence (entry 13) says an observed change is waiting
 * to be checked against this window's state — never *waiting for your save*,
 * which would need a live write-barrier reading no surface has, and never that it
 * will be processed automatically, which nothing promises. The uncertainty
 * sentence (entry 14) says the earlier write's outcome is unknown and that
 * reviewing the snapshot cannot establish whether it completed — an unknown
 * outcome, never a failure and never a success.
 *
 * **Nothing draws these yet.** The match editor's view answers both since
 * 2d-6-2 (`MatchEditorView.externalNotices` in `./matchEditor.ts`), and no
 * component reads that field; the acknowledgement that ends the second exists
 * (`BrowserState.acknowledgeWriteUncertainty` in `./workspace.svelte.ts`, since
 * 2d-6-1b) and no component calls it — 2d-6-9 draws the control. The codes exist
 * because a code with no string is worse than a code with no caller, and because
 * the wording is reviewed once, here, before anything draws it.
 */
export type ExternalConflictNotice =
  | {
      /** An observation for this file is held and has not been checked. */
      readonly kind: 'observationRetained';
    }
  | {
      /**
       * The last settled write for this file may or may not have written, and
       * the disk snapshot on screen cannot settle which.
       */
      readonly kind: 'writeOutcomeUnknown';
    };

/**
 * The dictionary key holding one notice's sentence.
 *
 * A `switch` over literal keys with a `never` terminus, exactly as
 * `conflictOriginMessageKey` in `./conflictSource.ts`: a renamed key is a compile
 * error here, and a third notice is a compile error here rather than a state with
 * no sentence. The keys live under `browser.externalConflict.*` (entry 39).
 *
 * @param notice - The line to show.
 * @returns The key holding its sentence.
 */
export function externalConflictNoticeKey(notice: ExternalConflictNotice): TranslationKey {
  switch (notice.kind) {
    case 'observationRetained':
      return 'browser.externalConflict.observationRetained';
    case 'writeOutcomeUnknown':
      return 'browser.externalConflict.writeOutcomeUnknown';
    default: {
      const unreachable: never = notice;
      return unreachable;
    }
  }
} // End of function externalConflictNoticeKey()

/**
 * One thing a person may do about an external-conflict notice, as a code.
 *
 * **One arm today, and it is a label rather than a transition.** The
 * acknowledgement that ends an uncertainty hold (entry 14) is
 * `BrowserState.acknowledgeWriteUncertainty` in `./workspace.svelte.ts`, which no
 * component calls yet; this names the control's label and nothing else, so that
 * the wording — *I have reviewed this snapshot* — is fixed here with the sentence
 * it answers. It is not a {@link ExternalConflictNotice} arm because a label is
 * not a line: a renderer that iterated notices and drew each as a paragraph would
 * otherwise draw a button's text as prose.
 *
 * **It is not a choice list.** `conflictChoicesFor` in `./saveOutcome.ts` stays
 * the only producer of one; this is a single label for a control that stands
 * beside the conflict's choices, not among them.
 */
export type ExternalConflictAction = {
  /** The person has reviewed the disk snapshot and ends the uncertainty hold. */
  readonly kind: 'acknowledgeSnapshot';
};

/**
 * The dictionary key holding one action's label.
 *
 * @param action - The control to label.
 * @returns The key holding its label.
 */
export function externalConflictActionKey(action: ExternalConflictAction): TranslationKey {
  switch (action.kind) {
    case 'acknowledgeSnapshot':
      return 'browser.externalConflict.action.acknowledgeSnapshot';
    default: {
      // `action.kind` rather than `action`: a one-arm type is not a union, so
      // TypeScript narrows the discriminant to `never` here and not the object.
      const unreachable: never = action.kind;
      return unreachable;
    }
  }
} // End of function externalConflictActionKey()
