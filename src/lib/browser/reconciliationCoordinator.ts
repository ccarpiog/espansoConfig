/**
 * When a drain fires, and what a drained batch does to the session cursor —
 * Phase 2d-5-3, extended at 2d-5-4.
 *
 * ## What it is
 *
 * The **drain lifecycle** the design consult's Q4 rules
 * (`docs/reviews/phase-2d-5-design.md:126-144`): four triggers that all call one
 * idempotent {@link ReconciliationCoordinator.requestDrain}, a **single-flight
 * pump** that turns any number of requests into at most one call in flight, and
 * the session cursor `{ epoch, watermark, lastDiscarded }` that the answers move.
 * `src/lib/ipc/events.ts` is the transport a wake arrives on and
 * `BrowserCommands.drainExternalChanges` is the authority a batch comes back
 * from; this module is the thing that decides *when* to ask and what the answer
 * means for the next question.
 *
 * **Since 2d-5-4 it also decides what an accepted batch's observations do.** The
 * `discarded` recovery of rulings 10 to 13 is here, because it is a decision about
 * the whole session and about the retained open request; every per-observation
 * transition is `./observationTransitions.ts`'s, and this module's whole part in
 * one is to hand it the per-document accepted sequences and the epoch it was
 * accepted under.
 *
 * ## Where it lives, and why it is not in `./workspace.svelte.ts`
 *
 * `docs/decisions/2d-5-split-notes.md` section 6 item 2 leaves *where the
 * coordinator lives* to the steps, and this step follows the precedent 2d-5-2a
 * set with `./writeSurfaceRegistry.ts`: a **plain TypeScript** module beside
 * `./workspace.svelte.ts` rather than more lines inside it. `workspace.svelte.ts`
 * was 3 945 lines when this step began and 2d-5-4 and 2d-5-5 each add more
 * coordinator machinery; and a module with **no runes in it** is drivable by a
 * model test with no component mounted, which is what lets this step's whole
 * evidence budget go on trigger orders and races rather than on rendering.
 *
 * **Nothing here is reactive, deliberately.** A coordinator reads its own state
 * immediately before it decides something, exactly as the generation counters in
 * `./workspace.svelte.ts` are read by the request that took one. What a window
 * that *draws* the cursor gets is one notification — Phase 2d-6-1c's
 * {@link ReconciliationHost.reconciliationChanged}, called after every transition
 * of a value a reader answers — and the signal it feeds lives in `BrowserState`,
 * where `openWriteSurfaces()`'s mirror already lives, and not here. No value is
 * mirrored: every reader on that state re-asks this coordinator.
 *
 * ## What this module deliberately does **not** do
 *
 * - **It applies no observation itself.** `./observationTransitions.ts` holds the
 *   routing boundary and every arm; this module holds the
 *   `acceptedSequenceByDocument` map those arms arbitrate with, hands it over, and
 *   records what each one answered on
 *   {@link ReconciliationCoordinator.observationOutcomes}.
 * - **It generalizes no conflict.** A write surface is told about a change through
 *   the transition the registry holds for it, and what a surface *does* with one —
 *   the six conflict registrations, the reapply evidence, the same-revision
 *   coalescing and the in-flight-write barrier — is **2d-5-5's**. Every registered
 *   transition is a no-op today.
 * - **It performs no membership reload of its own.**
 *   {@link ReconciliationCoordinator.membershipReloadWanted} is a request the
 *   `Named` and `Unnamed` arms raise and **nothing here acts on it**; a
 *   `discarded` loss reopens a workspace, and so does a person's request through
 *   {@link ReconciliationCoordinator.reopenFromRetainedRequest} — which the
 *   window's two guarded request methods call after their own rechecks, and
 *   which no observation ever reaches.
 * - **It is wired in the shipped window on all four of its triggers.** Since Phase
 *   2d-5-7a `AppShell.svelte` builds its state over the real event source of
 *   `src/lib/ipc/events.ts`, calls {@link ReconciliationCoordinator.start} from
 *   `onMount` and returns {@link ReconciliationCoordinator.dispose} as the
 *   cleanup, so registration, a finished open and a current-epoch wake all drain
 *   there. Since Phase 2d-6-10 the shell also passes the DOM foreground source of
 *   `./domForeground.ts` (`visibilitychange` to visible, window `focus`) in place
 *   of {@link INERT_FOREGROUND_EVENTS}. That a dispatched event requests a drain
 *   is tested; that WKWebView dispatches one on a real foregrounding is only as
 *   true as a window reading has seen, and it is a fallback, not a wake.
 *   `createBrowserState`'s *defaults* stay the two inert sources declared below,
 *   so a state built without naming a source still registers nothing.
 *
 * ## What it cannot force
 *
 * - **Nothing in TypeScript makes a host call {@link
 *   ReconciliationCoordinator.dispose}**, so the exact unlisten count is asserted
 *   by test rather than claimed by type — the same sentence
 *   `./writeSurfaceRegistry.ts` writes about its lease.
 * - **Nothing here forces the four captures to stay four.** The pump takes the
 *   open generation, the expected epoch, the disposal state and the open gate
 *   before its await and rechecks them after it; a later edit that reads any of
 *   them *after* the await instead would compile, and only
 *   `reconciliationCoordinator.test.ts`'s overlap cases would notice.
 * - **Nothing here can tell an `open()` that failed from one still loading.** The
 *   gate is closed by {@link ReconciliationCoordinator.workspaceOpened} and
 *   opened only by {@link ReconciliationCoordinator.workspaceReady}, so an
 *   `open()` whose commands refused leaves it closed until the next `open()`
 *   reaches `ready`. That is the deliberate answer rather than an oversight —
 *   `WorkspaceSession::open` documents that *a failure leaves the previously open
 *   workspace in place*, so a drain taken after a failed open would come back
 *   describing a workspace this window is not showing — and it is the reason
 *   {@link ReconciliationCoordinator.awaitingWorkspaceReady} exists to be read.
 * - **The epoch captured before the await and the live one cannot differ within
 *   one open generation**, because this pump is the only thing that adopts an
 *   epoch and single-flight means there is only one pump — but that is an
 *   argument about today's callers, not a property any type states.
 * - **A wire batch whose `epoch` is `0` is documented to be empty and to carry
 *   `newest_sequence: 0`** (`src/lib/ipc/types.ts`); this module stores what the
 *   batch reports and checks neither, so a malformed batch would be believed.
 */

import type { CommandResult } from '../ipc/commands';
import type { IpcFailure } from '../ipc/errors';
import type { ReconciliationEventSource, ReconciliationUnlisten } from '../ipc/events';
import type { DocumentId, ReconciliationBatch, ReconciliationWake } from '../ipc/types';
import {
  applyObservation,
  createAcceptedSequences,
  type ObservationOutcome,
  type ObservationSession,
  type ReconciliationWorkspace
} from './observationTransitions';

/**
 * Why a drain was asked for.
 *
 * One name per trigger of the consult's Q4, kept on the record of each physical
 * call so that "one drain satisfied both" is a fact a test can read rather than
 * an inference from a call count.
 */
export type DrainReason = 'registration' | 'workspaceOpened' | 'foreground' | 'wake';

/**
 * The session cursor — what the next drain asks with, and what the last one
 * said.
 *
 * Exactly the three fields the consult's Q2 names. **It is not the per-document
 * accepted-sequence map**, which since 2d-5-4 exists beside it and is read
 * through {@link ReconciliationCoordinator.acceptedSequence}: ruling 6 keeps the
 * two apart precisely because they answer different questions and may
 * legitimately hold different numbers. A disagreement between them is not a bug —
 * a watermark advanced by an empty batch moves while every accepted sequence
 * stands still, and a batch dropped while reconciliation is blocked moves the
 * watermark past observations no document ever accepted.
 */
export interface ReconciliationCursor {
  /**
   * The workspace epoch this session has adopted, or `0`.
   *
   * **`0` is ambiguous in this field alone** — it is both "no batch has been
   * accepted yet" and the real epoch of a workspace watched by nothing (ruling
   * 9). {@link ReconciliationCoordinator.watchState} is the typed answer that
   * separates them; this number is kept as the consult names it.
   */
  readonly epoch: number;
  /** The `afterSequence` the next drain will ask with. */
  readonly watermark: number;
  /**
   * The highest cumulative `discarded` this session has seen for its epoch.
   *
   * Cumulative and monotonic on the wire, so a repeated batch carries the same
   * value and must not be acted on twice (ruling 13).
   */
  readonly lastDiscarded: number;
}

/**
 * What this session can truthfully say about being watched — the typed state
 * ruling 9 asks for.
 *
 * **Its words are 2d-6-9a's, and nothing here names it to a person.** Phase
 * 2d-6-9a discharged `2d-5-split-notes.md` section 6 item 6: `notWatched` is drawn
 * as the `notWatched` banner decided by `decideWorkspaceReconciliation` in
 * `./reconciliationStatus.ts`, with its EN/ES sentence reached through
 * `describeReconciliationWorkspaceState` in `src/lib/i18n/codes.ts`; `notObserved`
 * is deliberately drawn as nothing. No component draws either until 2d-6-9b.
 */
export type ReconciliationWatchState =
  | {
      /** No batch has been accepted since the last `open()`. */
      readonly kind: 'notObserved';
    }
  | {
      /**
       * A batch was accepted and its epoch was `0`.
       *
       * The open found the epoch space exhausted and started a lifecycle with no
       * worker, so this workspace is watched by nothing and its batches are
       * necessarily empty. **Never to be presented as ordinary reconciliation
       * coverage.**
       */
      readonly kind: 'notWatched';
    }
  | {
      /** A real epoch was adopted from the first successful post-open drain. */
      readonly kind: 'watching';
      /** The adopted epoch. */
      readonly epoch: number;
    };

/**
 * Whether this session is still reconciling, or is holding everything it has.
 *
 * Ruling 12's state, typed. `blockedByLostHistory` means this epoch's observation
 * history has a hole in it **and** at least one write surface was open when that
 * was discovered, so nothing may be reloaded and nothing may be manufactured: no
 * `open()`, no synthetic per-surface conflict, every draft and candidate
 * preserved, and every later observation of this epoch dropped rather than
 * applied.
 *
 * ## Its exit, which the consult describes and does not type
 *
 * `docs/decisions/2d-5-split-notes.md` section 6 item 4 leaves this to 2d-5-4, and
 * the answer is: **closing the last write surface *permits* the reload and does
 * not *trigger* it.** Nothing in this application observes the registry emptying —
 * a lease's unregister moves a counter and calls nobody — and nothing observes the
 * consult's second condition at all, because *"their retained values have been
 * explicitly dealt with"* is a fact about a draft inside a component's own session
 * that R36 says no coordinator can see. So the permission is re-evaluated at the
 * **next accepted batch**, which is an event that already exists: a wake, a
 * foreground signal or an open. A window that receives no further trigger stays
 * blocked, and 2d-6 is where a person gets a control that asks.
 *
 * ## What no type expresses
 *
 * **Nothing bounds how many observations a blocked coordinator drops** (section 6
 * item 5). The watermark advances while blocked so the retained queue is not
 * refetched, which means every observation of this epoch after the loss is gone;
 * that is safe **only** because incremental reconciliation does not resume until a
 * successful whole open establishes a new epoch, and no type in this module ties
 * the dropping to that obligation.
 * {@link ReconciliationCoordinator.observationsDropped} counts them, which is a
 * measurement and not a bound.
 *
 * **What the block *does* reach is a read already in flight**, and it reaches it
 * through one function rather than through a type. A clean reread started before
 * the loss moves none of the numbers a guard compares — not the epoch, not the
 * open generation, not any projection generation — so until
 * `ObservationSession.stillApplying` existed such a read passed its guard and
 * installed underneath the whole-reload obligation, clearing the file's status on
 * the way. The guard now asks this session whether it is still applying at all and
 * refuses while this arm holds, leaving the file marked `stale`. Nothing in
 * TypeScript ties that refusal to this state either; what ties them is that the
 * one producer of the answer is the same closure that owns this value.
 */
export type ReconciliationBlock =
  | {
      /** Observations of this epoch are being applied. */
      readonly kind: 'running';
    }
  | {
      /** This epoch's history has a hole and a write surface was open. */
      readonly kind: 'blockedByLostHistory';
      /** The cumulative `discarded` that put this session here. */
      readonly discarded: number;
      /** The epoch it happened in. */
      readonly epoch: number;
    };

/**
 * What became of the event registration.
 *
 * **A registration failure stays observable**, which is `src/lib/ipc/events.ts`'s
 * own contract: a `subscribe` that rejects is never turned into a resolved no-op
 * unlisten, because that would report a subscription this application does not
 * have.
 */
export type RegistrationState =
  | {
      /** {@link ReconciliationCoordinator.start} has not been called. */
      readonly kind: 'idle';
    }
  | {
      /** `subscribe` was called and has not settled. */
      readonly kind: 'registering';
    }
  | {
      /** `subscribe` resolved and its unlisten is held for disposal. */
      readonly kind: 'registered';
    }
  | {
      /** `subscribe` rejected; nothing is listening and nothing pretends to be. */
      readonly kind: 'failed';
      /** Whatever it rejected with, unchanged. */
      readonly error: unknown;
    }
  | {
      /**
       * `subscribe` resolved **after** disposal, and its unlisten was called
       * immediately rather than stored (ruling 16).
       */
      readonly kind: 'abandoned';
    };

/**
 * What one physical drain asked and what came back.
 *
 * The evidence door for every ordering case: a call count says how many drains
 * happened, and this says which triggers each of them answered for, what it
 * asked with, and whether its answer moved anything.
 */
export interface DrainRecord {
  /** The watermark this call was made with. */
  readonly afterSequence: number;
  /** Every trigger this one call answered for, in arrival order. */
  readonly reasons: readonly DrainReason[];
  /** What the coordinator did with the answer. */
  readonly outcome: DrainOutcome;
}

/**
 * What a drain's answer was allowed to do.
 *
 * Five of the six arms change nothing at all; only `accepted` moves the cursor.
 */
export type DrainOutcome =
  /** The batch was for this open and this epoch, and the cursor moved. */
  | 'accepted'
  /**
   * An `open()` landed while the call was in flight, so it installed nothing.
   *
   * **Or ended the applying lifecycle while the answer's own values were being
   * read** — Phase 2d-5-4-E. The three rechecks above `accept` catch an open that
   * landed during the await; this arm is also what `accept` answering `false`
   * records. **Three caller-controlled reads can produce that `false`, not the two
   * this enumeration named until Phase 2d-5-4-G**: a getter on the injected answer,
   * a getter on the batch's own members or on its observation list's `length`, and
   * — since 2d-5-4-F gave the blocked arm a second comparison — the injected
   * `host.openWriteSurfaces()` read that `recoverFromLostHistory` opens with, whose
   * own comparison over the same lifecycle also lands here. All of them are the same
   * fact: the batch's numbers cannot be attributed to the lifecycle now in force.
   *
   * **It does not claim nothing moved, and it did until Phase 2d-5-4-G.** No
   * *cursor* moved on any of these paths — that is the promise, and it is the one
   * that matters, because the cursor is what the next drain asks from. But
   * `accept`'s second `false` stands below `adopted`, `epoch`, `lastDiscarded`,
   * `discardedNoticeCount` and `block`; see `accept()`'s own `@returns` for which
   * of the three lifecycle-moving sites clears them.
   */
  | 'staleOpen'
  /** The batch named an epoch this session is not showing. */
  | 'staleEpoch'
  /** The coordinator was disposed before or during the call. */
  | 'disposed'
  /** The command refused; the failure went to the host's reporter. */
  | 'refused'
  /** The injected drain threw or rejected, which the real wrapper never does. */
  | 'threw';

/**
 * Everything the coordinator needs from the state that owns it.
 *
 * **Three members of its own, plus every member of
 * {@link ReconciliationWorkspace}**, which is what an admitted observation needs.
 * One interface rather than a second constructor parameter, and that is the
 * deliberate choice: a fourth parameter with an inert default would let
 * `createBrowserState` forget to pass one and go on compiling, and a coordinator
 * that silently applies nothing is the failure this whole step exists to end. A
 * required member is a compile error at every construction site instead.
 *
 * It is deliberately **not** `BrowserCommands`: the only command this module calls
 * is the drain, and taking the whole surface would let a later edit here reach a
 * writing command, which watcher arbitration may never initiate (ruling 27).
 * {@link ReconciliationWorkspace} carries no writing command either, for the same
 * reason and by the same construction.
 */
export interface ReconciliationHost extends ReconciliationWorkspace {
  /**
   * Asks for everything above `afterSequence`.
   *
   * Must go through the caller's **injected** command surface. A call made
   * through a module-level binding instead increments nothing in
   * `workspace.test.ts`'s drain counter, which is the route 2d-5-6 closes.
   *
   * @param afterSequence - The session watermark.
   * @returns The batch, or a failure.
   */
  drain(afterSequence: number): Promise<CommandResult<ReconciliationBatch>>;
  /**
   * The owning state's workspace-open generation, read at the moment of asking.
   *
   * @returns The number `open()` last took.
   */
  openGeneration(): number;
  /**
   * Where a refused drain goes for the developer.
   *
   * @param failure - The refusal, unchanged.
   */
  report(failure: IpcFailure): void;
  /**
   * Told after every transition of a value one of this coordinator's readers
   * answers — Phase 2d-6-1c, the 2d-6 record's §3 entry 28.
   *
   * **One notification, carrying nothing.** The host is told *that* something a
   * reader answers has moved, never *what*: a `BrowserState` bumps one reactive
   * revision number from it and every reader on that state re-asks the
   * coordinator, so no boolean is copied and the coordinator stays the one
   * authority. It is called synchronously, in the same block as the write it
   * describes and after that write, so a host that reads back inside it sees the
   * new value.
   *
   * **A host member rather than a constructor option, for the reason the
   * interface header gives**: an option with an inert default would let a host be
   * built without one and go on compiling, and a coordinator whose transitions
   * nobody can observe is a screen that never redraws. A required member is a
   * compile error at every construction site instead.
   *
   * **What the type cannot force, in the same sentence as what it does.** It
   * forces every host to *have* a notification; it cannot force every mutation
   * site inside the coordinator to *call* it — nothing in TypeScript ties a
   * `let` assignment to a call, so a transition added without one compiles and
   * leaves a screen stale with every gate green. `reconciliationCoordinator.test.ts`
   * counts the notification across every transition the interface names,
   * asynchronous subscription rejection included, and that suite is the whole of
   * the enforcement.
   *
   * **It is caller code, and it is placed accordingly.** Every call is after the
   * writes of the transition it announces and before nothing that a re-entrant
   * `open()` or `dispose()` fired from inside it could make wrong: the coordinator
   * never writes a captured number below a notification without re-asking its
   * lifecycle first. A host whose notification throws is not contained — the one
   * production host increments a number and cannot throw, and the module's rule
   * for host members that throw is stated on `ensurePumping`.
   */
  reconciliationChanged(): void;
}

/** What a foreground or resume signal is handed to. */
export type ForegroundHandler = () => void;

/** What ends a foreground subscription. */
export type ForegroundUnsubscribe = () => void;

/**
 * The narrow transport for "the window came forward" — no DOM and no Tauri in
 * its type.
 *
 * {@link ReconciliationEventSource}'s twin for the third trigger, and narrow for
 * the same reason: a fake is one function, and nothing here has to know whether
 * the real signal is a `visibilitychange`, a Tauri window event or an
 * `NSApplication` notification.
 *
 * **Synchronous, unlike `subscribe` on the event source.** Ruling 16 requires
 * foreground listeners to be removed *synchronously* on disposal, and an
 * asynchronous registration cannot promise that. DOM `addEventListener` and
 * `removeEventListener` are synchronous, which is why the one production source
 * (`./domForeground.ts`, Phase 2d-6-10) is built on them. **Tauri's window
 * `onFocusChanged` is not a candidate**: it is `async` and awaits two separate
 * `listen` calls before it hands back an unlisten (`@tauri-apps/api/window.js`),
 * so it cannot return an unsubscribe from `subscribe` — this comment claimed the
 * opposite until the 2d-6 consult's §5.8 found it false. Nothing in TypeScript
 * stops a source from returning an unsubscribe that defers its real removal; the
 * type forces only that one is returned.
 */
export interface ForegroundSource {
  /**
   * Subscribes to every foreground or resume signal.
   *
   * @param handler - Called with nothing, once per signal.
   * @returns The call that ends the subscription. The caller owns it.
   */
  subscribe(handler: ForegroundHandler): ForegroundUnsubscribe;
} // End of interface ForegroundSource

/**
 * The message the inert event source rejects with.
 *
 * Exported so a caller can tell "this state was built with no transport" from a
 * real registration failure. It is a developer string and **never a user-facing
 * one**: nothing renders it, and if a later phase wants to say this on a screen
 * it goes through i18n like everything else.
 */
export const NO_RECONCILIATION_TRANSPORT = 'no reconciliation event source was injected';

/**
 * The default event source: one that refuses, loudly.
 *
 * **It rejects rather than resolving with a no-op unlisten**, and that is
 * `src/lib/ipc/events.ts`'s rule rather than a choice made here — resolving would
 * report a subscription this application does not have, and
 * {@link RegistrationState} would say `registered` about nothing. Rejecting puts
 * `failed` on the record instead, and the other three triggers go on working,
 * which is the honest description of a window with no wake transport.
 *
 * **The real source is deliberately not the default.** Importing the real adapter
 * `src/lib/ipc/events.ts` declares would make every state built with the defaults
 * — every test state in this repository — subscribe through Tauri's `listen`. The
 * one production import of it is `src/lib/components/AppShell.svelte`'s, which
 * names it at its `createBrowserState` call, beside the two capability entries
 * `src-tauri/capabilities/default.json` grants for it. That the import is the
 * shell's alone is machine-checkable — the real adapter's identifier occurs
 * under `src/lib/browser/` in no file — so this comment names it by description
 * rather than by identifier, and the check stays an oracle rather than a
 * convention.
 */
export const INERT_RECONCILIATION_EVENTS: ReconciliationEventSource = {
  /**
   * Refuses to subscribe.
   *
   * @returns A promise that always rejects.
   */
  subscribe(): Promise<ReconciliationUnlisten> {
    return Promise.reject(new Error(NO_RECONCILIATION_TRANSPORT));
  }
};

/**
 * The default foreground source: a real subscription to a signal nothing emits.
 *
 * Unlike the event source above this one **succeeds**, and truthfully: it really
 * does register a handler, and the handler really is never called, because there
 * is no window behind it. Nothing is claimed that is not so.
 */
export const INERT_FOREGROUND_EVENTS: ForegroundSource = {
  /**
   * Registers a handler on a source that never signals.
   *
   * @returns An unsubscribe that has nothing to undo.
   */
  subscribe(): ForegroundUnsubscribe {
    /**
     * Ends a subscription to a source that never signalled.
     *
     * Nothing was registered anywhere, so nothing is removed. A function that
     * does nothing is honest here in a way that a resolved no-op *unlisten* would
     * not be: this source really has no listener to remove.
     */
    return function unsubscribe(): void {
      return undefined;
    };
  }
};

/**
 * The coordinator, as a value.
 *
 * Every accessor below exists because a model test has to be able to read what
 * happened without mounting anything; none of them is rendered today.
 */
export interface ReconciliationCoordinator {
  /**
   * Begins the lifecycle: registers for wakes and for foreground signals.
   *
   * **Idempotent.** A second call registers nothing and returns; it is not an
   * error, because a host that starts twice is a host with two `onMount`s and
   * this must not become two subscriptions.
   */
  start(): void;
  /**
   * Ends it: removes the foreground listener synchronously, calls a held
   * unlisten exactly once, and makes every pending or returning drain inert.
   *
   * **"Inert" is bounded, and this sentence was unbounded until Phase 2d-5-4-G.**
   * Two things carry it. A drain that has not yet passed its post-await `disposed`
   * check installs nothing and records `'disposed'`. A drain already below that
   * check is caught instead by the applying-lifecycle counter this call increments:
   * every arm that asks `ObservationSession.stillApplying` or
   * `ObservationSession.lifecycleIsOurs` refuses, and the batch accounting refuses
   * at its own two comparisons over that counter — including the one inside the
   * lost-history recovery, which is what stops a disposed coordinator asking the
   * window to reload its whole workspace. What this call cannot do is unwind a
   * write already made: the five pre-recovery values named in the batch
   * accounting's `@returns` stay where a disposal left them, because nothing here
   * clears them.
   *
   * Idempotent for the same reason `start()` is, and because ruling 16's "exactly
   * once" has to survive a host that disposes twice.
   *
   * **It also makes every observation this coordinator has already applied stop
   * being actionable**, which the drain rechecks alone could not do: a guarded
   * reread started by an earlier batch is a read the *host* owns, and nothing it
   * captures moves when a coordinator is disposed. `ObservationSession.stillApplying`
   * is what a guard asks, and it answers `false` from here on. What that does not
   * do is *cancel* the read — the command is already out and its answer will
   * arrive; what it stops is the installation.
   */
  dispose(): void;
  /**
   * Asks for a drain, for the given reason.
   *
   * **The reason is always recorded; whether a physical call follows is the
   * pump's business.** Three conditions hold one back and none of them loses it:
   * the lifecycle has not been started, an `open()` has not reported `ready`
   * (see {@link ReconciliationCoordinator.awaitingWorkspaceReady}), or a pump is
   * already in flight. Ten calls before a drain produce one call; ten during one
   * produce at most one follow-up.
   *
   * **A request made in the microtask in which the previous pump releases its
   * single-flight slot is not lost either.** That window used to strand one: the
   * pump's loop had already exited and the slot was still occupied, so the
   * request set its boolean, saw a pump that was no longer draining, and waited
   * for a trigger that might never come. The slot's release now restarts the
   * pump when a request is outstanding, so the only thing a request can wait for
   * is `start()` or `ready`.
   *
   * Nothing here is a promise that the drain has *happened* when this returns —
   * every physical call is asynchronous, and
   * {@link ReconciliationCoordinator.drains} is the record of what really ran.
   *
   * @param reason - Which trigger is asking.
   */
  requestDrain(reason: DrainReason): void;
  /**
   * Told at the entry of every `open()`, before its first command.
   *
   * Clears the expected epoch, the watermark, the handled-discard count, the
   * per-document accepted sequences and the blocked state, so that nothing learned
   * about the workspace being closed is asked with, or compared against, in the
   * one replacing it. The accepted sequences go for a sharper reason than the
   * others, and **it is not that the identities change**: a `DocumentId` is minted
   * per path and is stable for the life of the process, so a retained entry names
   * the same file. What makes keeping one wrong is that the epoch replacing this
   * one restarts its observation sequences at the first, so the closed workspace's
   * highest number would refuse that same file's first observations of the new
   * epoch.
   *
   * **It also closes the open gate**, which is what stops a trigger arriving
   * between here and `ready` from adopting the epoch of the workspace being
   * replaced: Rust still holds that workspace until the open succeeds, so a drain
   * taken in this window answers for the wrong lifecycle while every generation
   * capture in the pump legitimately passes.
   *
   * **And it retains the request, which is what ruling 11's recovery re-runs.**
   * Never `summary.root`: a wire path is a lossy rendering and is not
   * round-trippable as a command argument, so re-opening from one would be a
   * different request that happened to look like the same one. **Nothing in
   * TypeScript forces a host to pass the argument its own `open()` was called
   * with**, and a host that passed something else would make the recovery open a
   * workspace nobody asked for.
   *
   * @param request - Exactly what this `open()` was called with.
   */
  workspaceOpened(request: string | null): void;
  /**
   * Told once an `open()` has reached `ready`.
   *
   * The second trigger, and the only thing that opens the gate
   * {@link ReconciliationCoordinator.workspaceOpened} closed. A superseded or
   * failed `open()` never calls it, so a drain is requested only for a load that
   * really finished — and everything requested while the gate was closed is
   * flushed here rather than dropped.
   */
  workspaceReady(): void;
  /**
   * Whether physical drains are being held for an `open()`.
   *
   * **It measures one thing only**: that the coordinator was told an `open()`
   * began and has not since been told one reached `ready`. It is therefore `true`
   * while an open is loading **and** after an open that ended without reaching
   * `ready` — this coordinator has no third door and deliberately none, because a
   * failed open leaves the previous workspace in place on the Rust side while the
   * window shows nothing, so draining against it would report a lifecycle this
   * window is not showing. The next `open()` that reaches `ready` opens the gate;
   * nothing else does, and `open()` is the only thing that puts a workspace on
   * screen, so no shown workspace can be left behind a closed one.
   *
   * It is `false` before any `open()` has been announced at all, which is what
   * keeps a coordinator driven with no workspace — every case in
   * `reconciliationCoordinator.test.ts` that never calls `workspaceOpened()` —
   * draining on its other three triggers.
   *
   * @returns `true` while requests are recorded and no physical drain is issued.
   */
  awaitingWorkspaceReady(): boolean;
  /**
   * The session cursor as it now stands.
   *
   * @returns A frozen snapshot; the coordinator's own numbers are not exposed.
   */
  cursor(): ReconciliationCursor;
  /**
   * What can truthfully be said about being watched.
   *
   * @returns The typed state ruling 9 asks for.
   */
  watchState(): ReconciliationWatchState;
  /**
   * What became of the wake registration.
   *
   * @returns The current registration state.
   */
  registration(): RegistrationState;
  /**
   * Which triggers have asked and not yet been answered by a physical call.
   *
   * @returns The reasons, in arrival order.
   */
  pending(): readonly DrainReason[];
  /**
   * Every physical drain this coordinator has made, oldest first.
   *
   * @returns The records.
   */
  drains(): readonly DrainRecord[];
  /**
   * How many times `discarded` strictly rose within the adopted epoch.
   *
   * The observable that says a loss was *acted on* rather than merely seen
   * again: a repeated batch carrying the same non-zero value must not move it
   * (ruling 13).
   *
   * **It counts the losses, never the recoveries**, and since 2d-5-4 the two are
   * different numbers: one rise puts the session in
   * {@link ReconciliationBlock}'s blocked arm or re-runs the retained open, and a
   * session that blocks and later takes the permitted reload has moved this once
   * and reopened once, while a session blocked forever has moved it once and
   * reopened not at all.
   *
   * @returns The count, reset by {@link ReconciliationCoordinator.workspaceOpened}.
   */
  discardedNotices(): number;
  /**
   * How many observations this session dropped without arbitrating them.
   *
   * **Since 2d-5-4 this counts one thing only: what a *blocked* coordinator threw
   * away.** An observation that reaches a transition is not dropped, whatever that
   * transition decided — one superseded by a newer sequence is on
   * {@link ReconciliationCoordinator.observationOutcomes} as `superseded`, which
   * is arbitration rather than loss.
   *
   * It is a **measurement, not a bound**: nothing limits how many a blocked
   * coordinator may drop, and what makes that safe is the whole-reload obligation
   * {@link ReconciliationBlock} describes.
   *
   * @returns The running total since the last `open()`.
   */
  observationsDropped(): number;
  /**
   * What each applied observation's transition answered, oldest first.
   *
   * **A record of which arm ran, never of what it achieved.** Every member of
   * {@link ReconciliationWorkspace} answers `void`, so a host that does nothing
   * produces the same outcomes as one that changes the window;
   * `./workspace.test.ts` asserts the window.
   *
   * @returns The outcomes, reset by
   *   {@link ReconciliationCoordinator.workspaceOpened}.
   */
  observationOutcomes(): readonly ObservationOutcome[];
  /**
   * The highest observation sequence one document has accepted a transition for.
   *
   * The consult's Q2 `acceptedSequenceByDocument`, read. **Not the watermark**:
   * ruling 6 keeps the two apart, and they legitimately hold different numbers.
   *
   * @param document - The file.
   * @returns Its accepted sequence, or zero.
   */
  acceptedSequence(document: DocumentId): number;
  /**
   * Whether this session is still reconciling, or holding everything it has.
   *
   * @returns The typed state of ruling 12.
   */
  block(): ReconciliationBlock;
  /**
   * Whether a `Named` or an `Unnamed` observation has asked for a safe membership
   * reload.
   *
   * **Nothing acts on it automatically.** It is set by the arms the consult's Q8
   * says *request a safe membership reload*, cleared by
   * {@link ReconciliationCoordinator.workspaceOpened}, and read by the window,
   * whose `requestMembershipReload` in `./workspace.svelte.ts` is the model half
   * of the control a person gets (Phase 2d-6-1c; 2d-6-9 draws it). Performing it
   * automatically would mean replacing the whole window — every projection, the
   * selection and the viewer with it — because an unrelated file appeared beside
   * the configuration.
   *
   * @returns `true` once such a request has been made in this session.
   */
  membershipReloadWanted(): boolean;
  /**
   * Whether {@link ReconciliationCoordinator.dispose} has been called.
   *
   * @returns `true` once disposed, forever.
   */
  isDisposed(): boolean;
  /**
   * Re-runs the retained original open request because a person asked — Phase
   * 2d-6-1c, the 2d-6 record's §3 entry 29.
   *
   * **The request never leaves this coordinator.** A `BrowserState` reload request
   * calls this rather than reading the retained request and opening with it, so
   * that nothing on the window side holds a value it could substitute — the
   * retained request is the one `workspaceOpened()` was told, `null` included,
   * and never `summary.root` (ruling 11). The reopen goes through
   * {@link ReconciliationWorkspace.reopenWorkspace}, which under
   * `./workspace.svelte.ts` is the existing `open()`.
   *
   * **Its one fence is disposal, and it is asked here rather than by the
   * caller**: a disposed coordinator asks the window to reload nothing, whatever
   * the caller checked a statement earlier. The registry, the outstanding writes
   * and the open gate are the caller's to recheck — they are the window's facts,
   * and `BrowserState`'s two request methods ask all three in the same
   * synchronous block as this call, with no caller code between.
   *
   * **It moves the applying lifecycle before it reopens**, for
   * `recoverFromLostHistory`'s reason: a host that reopens without announcing
   * through `workspaceOpened()` — which nothing in TypeScript forces — must still
   * leave every session built after this point unable to claim the lifecycle
   * being replaced. The blocked state is reset with it, because a whole open is
   * exactly what that state was waiting for; the membership-reload flag is left
   * to `workspaceOpened()`, which clears it on every open.
   *
   * @returns `true` when the reopen was started; `false` when this coordinator is
   *   disposed and nothing was done.
   */
  reopenFromRetainedRequest(): boolean;
  /**
   * Whether the single-flight slot is occupied.
   *
   * **That is exactly what it measures, and it is slightly more than "a drain is
   * running".** The slot is taken synchronously when a pump starts and released
   * in a microtask after the pump's promise settles, so this stays `true` for the
   * microtask in which the release happens — during which nothing is draining and
   * a pending request may restart the pump without the answer ever going `false`
   * for an outside reader. A `false` therefore means *no pump is running and none
   * is being released*; a `true` means *a pump is running, or one has just
   * finished and its slot has not been given back*. It says nothing about whether
   * a request is outstanding — {@link ReconciliationCoordinator.pending} does.
   *
   * **It is not a settlement door and there is deliberately none.** A test that
   * waited on this coordinator would be waiting on whatever the injected host
   * does, and a host whose drain is never answered would hang the case rather
   * than fail it; `reconciliationCoordinator.test.ts` lets the microtask queue
   * run instead and reads the counts. This answers the narrower question a caller
   * can act on.
   *
   * @returns `true` while a pump holds the single-flight slot.
   */
  isPumping(): boolean;
} // End of interface ReconciliationCoordinator

/**
 * Builds a coordinator over one host and two transports.
 *
 * @param host - The drain, the open generation and the failure reporter.
 * @param events - Where a wake arrives; defaults to
 *   {@link INERT_RECONCILIATION_EVENTS}, never to the real source.
 * @param foreground - Where a foreground or resume signal arrives; defaults to
 *   {@link INERT_FOREGROUND_EVENTS}.
 * @returns A coordinator that has registered nothing until `start()` is called.
 */
export function createReconciliationCoordinator(
  host: ReconciliationHost,
  events: ReconciliationEventSource = INERT_RECONCILIATION_EVENTS,
  foreground: ForegroundSource = INERT_FOREGROUND_EVENTS
): ReconciliationCoordinator {
  // The lifecycle flags. `started` gates registration and the pump; `disposed` is
  // one-way and is the thing every asynchronous continuation rechecks.
  let started = false;
  let disposed = false;
  // The wake registration. `unlisten` is held only between a `subscribe` that
  // resolved before disposal and the disposal that calls it, and it is nulled in
  // the same statement that calls it so "exactly once" survives a double dispose.
  let unlisten: ReconciliationUnlisten | null = null;
  let registrationState: RegistrationState = { kind: 'idle' };
  // The foreground subscriptions, removed synchronously on disposal. A list
  // rather than one value because `start()` is idempotent and a future host may
  // legitimately want more than one signal on the same coordinator; today it
  // holds at most one.
  const foregroundOff: ForegroundUnsubscribe[] = [];

  // The session cursor. `adopted` is the bit the three-field cursor cannot carry:
  // without it, epoch `0` would mean both "nothing accepted yet" and "watched by
  // nothing", which are the two states ruling 9 exists to keep apart.
  let adopted = false;
  let epoch = 0;
  let watermark = 0;
  let lastDiscarded = 0;
  let discardedNoticeCount = 0;
  let observationsDroppedCount = 0;
  // **The second sequence state, and deliberately not part of the cursor above.**
  // The cursor is the drain acknowledgement; this is the arbitration key, and
  // ruling 6 says a disagreement between the two numbers is not a bug.
  const accepted = createAcceptedSequences();
  const observationOutcomeRecords: ObservationOutcome[] = [];
  // **The retained original open request** (ruling 11). `null` is a legitimate
  // value — it is what `open(null)` means, *discover the configuration root* — so
  // this is not "no request has been retained"; before the first
  // `workspaceOpened()` it is simply the same thing `AppShell.svelte` opens with.
  let openRequest: string | null = null;
  let block: ReconciliationBlock = { kind: 'running' };
  let membershipReloadRequested = false;

  // **The applying lifecycle: the one value here that is never reset** — Phase
  // 2d-5-4-E. Every other number in this factory is either cleared by
  // `workspaceOpened()` or scoped to one epoch, so none of them can separate *this
  // lifecycle is still the one in force* from *a replacement reset it back to the
  // value I captured*: `workspaceOpened()` sets `epoch = 0`, and `accept()` adopts
  // `0` exactly like any other value, which its own comment says in as many words.
  // A monotonic counter can be captured before any caller-controlled read and
  // compared with afterwards, which is the only shape that survives a getter on an
  // injected batch reopening the workspace mid-read.
  //
  // **What no type forces.** It is a plain `let` and nothing makes a new reset site
  // increment it. The three sites that do are `workspaceOpened()`, `dispose()` and
  // `recoverFromLostHistory()` — see each for why — and a fourth added without a
  // `lifecycle += 1` would compile and silently widen every fence built on it.
  // `dispose()`'s increment **overlaps** the live `disposed` read of
  // `stillApplying()` for the per-observation fences, and is **necessary** for
  // `accept()`, whose comparison reads this counter alone — Phase 2d-5-4-F, which
  // corrected the sentence that stood here calling it redundant. Removing it would
  // let a disposal fired from a wire getter run the whole of `accept()`, cursor
  // writes and `host.reopenWorkspace()` included; see `dispose()` for the
  // derivation. The rule it keeps true beside that is *every site that ends the
  // applying lifecycle moves this*, rather than *every site except the ones
  // another live read happens to cover*.
  let lifecycle = 0;

  // The open gate. `true` from the `workspaceOpened()` of an `open()` until the
  // `workspaceReady()` of one, and `false` before any open has been announced at
  // all — which is the state a coordinator built beside a state that never opens
  // a workspace stays in, and the reason the other three triggers still drain
  // there.
  let openInProgress = false;

  // The single-flight pump. `requested` is the boolean Q4 prescribes, and
  // `inFlight` is the running pump's promise — held so that a second request sees
  // a pump rather than starting one, and `null` exactly when no pump holds the
  // slot. **`inFlight === null` is not "no pump is running"**: the slot is given
  // back a microtask after the pump settles, and `release` below is what closes
  // the gap that window used to leave.
  let requested = false;
  let inFlight: Promise<void> | null = null;
  const pendingReasons: DrainReason[] = [];
  const drainRecords: DrainRecord[] = [];

  /**
   * Whether physical drains are being held for an `open()`.
   *
   * **It is what this coordinator was *told*, deliberately, and not a comparison
   * with `host.openGeneration()`.** Keying the gate to the generation it was
   * recorded under was tried and rejected: it would let a generation the
   * coordinator was never told about *open* the gate, which is precisely the hole
   * this gate exists to close, and it bounds nothing a plain flag does not —
   * every `open()` announces itself through `workspaceOpened()` on entry, so a
   * gate a failed or superseded open leaves closed is re-armed by the next open
   * and released by that open's `ready`.
   *
   * @returns `true` while no drain may be issued.
   */
  function awaitingReady(): boolean {
    return openInProgress;
  } // End of function awaitingReady()

  /**
   * Whether the lifecycle currently permits a physical drain.
   *
   * The one predicate every decision to pump reads, rather than three copies of
   * its three clauses: `requestDrain`, `start()`, the pump's own loop and the
   * single-flight release all ask this. A clause added here is added to all four
   * by construction, which is what a copy would not give.
   *
   * @returns `true` when a pump may be started or continued.
   */
  function drainMayStart(): boolean {
    return started && !disposed && !awaitingReady();
  } // End of function drainMayStart()

  /**
   * Remembers why a drain was asked for, without repeating a reason.
   *
   * @param reason - The trigger.
   */
  function rememberReason(reason: DrainReason): void {
    if (!pendingReasons.includes(reason)) {
      pendingReasons.push(reason);
      notifyChanged();
    }
  } // End of function rememberReason()

  /**
   * Tells the host that a value one of the readers answers has moved — Phase
   * 2d-6-1c.
   *
   * **One function, called after every transition, and nothing in TypeScript
   * makes a new transition call it.** The sites that do are enumerated on
   * {@link ReconciliationHost.reconciliationChanged}'s test suite rather than
   * here, because a list in a comment is the kind of sentence this project has
   * watched go stale; what this comment can say is the placement rule every site
   * follows — after the writes it announces, and never between a lifecycle
   * capture and a write that capture fences, because the host's callback is
   * caller code and a re-entrant `open()` inside it moves the lifecycle.
   */
  function notifyChanged(): void {
    host.reconciliationChanged();
  } // End of function notifyChanged()

  /**
   * Writes one physical drain onto the record.
   *
   * @param afterSequence - What the call asked with.
   * @param reasons - Every trigger it answered for.
   * @param outcome - What was done with the answer.
   */
  function record(
    afterSequence: number,
    reasons: readonly DrainReason[],
    outcome: DrainOutcome
  ): void {
    drainRecords.push({ afterSequence, reasons, outcome });
    notifyChanged();
  } // End of function record()

  /**
   * Whether a lost-history recovery can be run right now, and runs it if so.
   *
   * **Ruling 11 and ruling 12 are one decision with two arms, and the registry is
   * the whole of what decides between them.** With nothing registered, recovery is
   * a true `open()` with the **retained request** — which clears documents,
   * projections, selection, viewer state and every per-document generation, and is
   * exactly the identity reset a hole in the membership history requires. With any
   * write surface open — **an unknown-target creator included**, because it counts
   * as open — nothing is reloaded and nothing is manufactured.
   *
   * **An empty registry does not mean no surface is open.** Nothing in TypeScript
   * forces a component to register, so an unregistered surface is invisible here
   * and would be reloaded under; that is `competingSurfaceFor`'s standing
   * limitation, inherited whole, and this function is the sharpest place in the
   * application where it costs something.
   *
   * **It must be called before anything in this batch is believed**, because a
   * hole in the history means the batch's own observations may be describing a
   * membership this window can no longer reconstruct.
   *
   * **Its own first statement is caller code, so it re-asks the lifecycle before it
   * acts** — Phase 2d-5-4-G. `host.openWriteSurfaces()` is injected and the
   * `.length` on its answer is a second caller-controlled read, so either can
   * synchronously reach `BrowserState.open()` or `dispose()`; before this round
   * nothing below them asked either question, and a disposal fired from there left
   * this function moving the lifecycle a second time, resetting {@link block} and
   * asking the window — through {@link ReconciliationHost.reopenWorkspace} — to
   * throw away and reload its whole workspace **after it had been disposed**, which
   * is the exact harm `dispose()`'s own increment is documented as preventing. The
   * comparison is placed **below** the registry read on purpose: above it, it would
   * be spent by that read and answer nothing about what the read did.
   *
   * @param lifecycleAt - The applying lifecycle {@link accept} captured before it
   *   read anything of the batch. Nothing in TypeScript forces a caller to pass its
   *   own capture, and one that passed the live `lifecycle` would make the
   *   comparison below vacuous.
   * @returns `true` when a whole `open()` was started, so no cursor may be written;
   *   `false` when a write surface is registered **or** when the lifecycle moved
   *   inside the read that answered that question. The caller cannot tell those two
   *   apart from the return value alone, and it does not need to: its own recheck
   *   below the call refuses the second, and neither permits a cursor write.
   */
  function recoverFromLostHistory(lifecycleAt: number): boolean {
    if (host.openWriteSurfaces().length > 0) {
      return false;
    }
    // **Asked here, below the registry read and above every write** — Phase
    // 2d-5-4-G. The read above is injected and the `.length` taken on its answer is
    // the caller's too, so one that synchronously reached `BrowserState.open()` or
    // `dispose()` and *then* answered an empty registry used to fall straight
    // through to the three statements below. `false` needs no new arm anywhere:
    // `accept()`'s own recheck below the call answers `false` for the same reason
    // and `runOneDrain` records `'staleOpen'`, which already means *this batch's
    // numbers cannot be attributed to the lifecycle now in force*.
    if (lifecycle !== lifecycleAt) {
      return false;
    }
    // **The applying lifecycle ends here**, because this is the one place this
    // coordinator asks for the workspace it is applying to be replaced. It is
    // moved *before* the call below rather than left to the announcement, so that
    // a host which reopens without calling `workspaceOpened()` — which nothing in
    // TypeScript forces it to do, as that call's own comment says — still leaves
    // every session built after this point unable to claim this lifecycle. It does
    // **not** rescue the batch being applied right now: `accept()` returns
    // immediately below, having already compared its own capture.
    lifecycle += 1;
    block = { kind: 'running' };
    // **Fired, never awaited, and the host owns everything after it.** A
    // production `open()` announces itself through `workspaceOpened()` in its
    // first statements, which clears this cursor synchronously — so the caller
    // must write nothing after this returns. **Nothing in TypeScript forces a host
    // to announce**, and one that did not would leave this session comparing a new
    // lifecycle's batches against an old lifecycle's epoch.
    host.reopenWorkspace(openRequest);
    return true;
  } // End of function recoverFromLostHistory()

  /**
   * Accounts for a batch that is for this open and this epoch.
   *
   * **Every value the batch carries is read once, at the top, and nothing is
   * written until the lifecycle has been re-asked** — Phase 2d-5-4-E. `batch`
   * crossed an injected boundary, so each of the four reads below can run caller
   * code through a getter or a `Proxy` trap, and one that synchronously calls
   * `BrowserState.open()` in `./workspace.svelte.ts` reaches `workspaceOpened()`
   * before that function's first await — which clears the cursor, the
   * accepted-sequence map and the outcome record. Before this, those reads were
   * interleaved with the writes they fed, so such a getter left this function
   * putting a closed lifecycle's epoch, watermark and observations into the
   * workspace that replaced it, with `session.epoch` captured *after* the reset and
   * therefore comparing that replacement with itself.
   *
   * **The comparison here is not the whole defence, and cannot be.** It is taken
   * once, before anything is written, and **two kinds of caller code run below
   * it** — Phase 2d-5-4-F. The first is the blocked arm's recovery:
   * {@link recoverFromLostHistory} opens with the injected
   * `host.openWriteSurfaces()`, so a registry read stands between this comparison
   * and the two cursor writes that arm makes when recovery declines. That is why
   * the arm re-asks this same comparison rather than relying on this one, and the
   * enumeration here was short by exactly that until 2d-5-4-F. The second is the
   * observations, applied after it, each reading caller-controlled properties of
   * its own; that is what {@link ObservationSession.lifecycleIsOurs} carries into
   * every arm, and what `./observationTransitions.ts` re-asks after routing.
   *
   * **`observations.length` is read with the four members, and that is not
   * tidiness** — Phase 2d-5-4-F. `observationsDroppedCount += observations.length`
   * evaluates its operand and **stores afterwards**, so a `length` getter that
   * reopened the workspace from inside that operand would have the
   * `observationsDroppedCount = 0` of `workspaceOpened()` overwritten by the closed
   * lifecycle's total — a read below the comparison feeding a write below it. The
   * count taken above the comparison is what that arm adds. The record said the
   * opposite for one round (`2d-5-4-E-notes.md` §9 item 1, corrected in
   * `2d-5-4-F-notes.md`), on the strength of *the `.length` read is the last
   * statement before that arm returns*: it is not a statement at all, it is an
   * operand.
   *
   * **`discarded` is handled before the observations** (ruling 10), because a
   * per-document reread is not a recovery from a hole in the history: the lost
   * entry may have been the only observation of an addition or a removal, so no
   * observation in this batch can be trusted to describe the membership.
   *
   * **A blocked session still advances the watermark** (ruling 13), so the
   * retained queue is not fetched again — which means those observations are gone.
   * That is safe only under the whole-reload obligation, and no type says so; see
   * {@link ReconciliationBlock}.
   *
   * @param batch - The accepted batch.
   * @param lifecycleAt - The applying lifecycle its caller captured **before** it
   *   read anything at all of the command's answer. Nothing in TypeScript forces a
   *   caller to capture it there, and one that captured it later would hand this
   *   function a value a getter had already moved.
   * @returns `true` when the batch was accounted for, and `false` when the
   *   lifecycle moved under it. **`false` does not mean nothing whatever was
   *   written, and this said it did until Phase 2d-5-4-G.** It is exact for the
   *   `false` at the top, which is above every write. The second `false` — the
   *   blocked arm's, added at 2d-5-4-F — is below five of them: `adopted` and
   *   `epoch` when this session had not adopted one, and `lastDiscarded`,
   *   `discardedNoticeCount` and `block` when `discarded` rose. What it does
   *   promise, on both paths, is that **no cursor moved**: neither `watermark` nor
   *   `observationsDroppedCount`. Whether the five survive depends on *which* site
   *   moved the lifecycle, and only one of the three clears them —
   *   `workspaceOpened()` clears all five, `dispose()` clears nothing, and
   *   {@link recoverFromLostHistory}'s own increment returns `true` and so never
   *   reaches that `false`.
   */
  function accept(batch: ReconciliationBatch, lifecycleAt: number): boolean {
    const batchEpoch = batch.epoch;
    const batchDiscarded = batch.discarded;
    const newestSequence = batch.newest_sequence;
    const observations = batch.observations;
    // **The fifth read, and it belongs up here with the other four** — Phase
    // 2d-5-4-F. It feeds a compound assignment in the blocked arm below, whose
    // store happens *after* its operand has been evaluated; read there, a `length`
    // getter that reopened the workspace would be followed by this function
    // writing the closed lifecycle's total over the zero that reset left.
    const observationCount = observations.length;
    if (lifecycle !== lifecycleAt) {
      // Something between the caller's capture and this line ended the lifecycle
      // this batch was drained in — one of the **five** reads above reopened the
      // workspace, or an `open()` or a disposal landed while the drain was in
      // flight.
      //
      // **Four of those five reads are inert from the one live caller; the fifth
      // is not** — Phase 2d-5-4-G, correcting a sentence that claimed all five
      // were. `runOneDrain` hands this function a plain object whose four members
      // it materialized, so `batch.epoch`, `batch.discarded`,
      // `batch.newest_sequence` and `batch.observations` read own data properties
      // and run no caller code. `observations.length` is a read on the array that
      // injected object supplied — the snapshot copies the **reference** — so a
      // `Proxy` `get` trap or an own `length` accessor on it runs caller code right
      // here, from the live caller, which is exactly what
      // `./reconciliationCoordinator.test.ts`'s *drops no count when the
      // observation list's own length reopened the workspace* drives. That is why
      // that read is hoisted above this comparison instead of left in the blocked
      // arm's compound assignment. The comparison would stay regardless: nothing in
      // `ReconciliationBatch` forces a caller to hand this function a plain object
      // at all.
      //
      // Nothing of a closed lifecycle's queue may be written into the one that
      // replaced it, and the cursor is the half no per-observation fence below
      // could protect.
      return false;
    }
    if (!adopted) {
      // **The shown epoch is learned here and nowhere else** (ruling 8):
      // `open_workspace` answers a root and counts, so the first successful drain
      // taken at the still-current open generation is the only thing that can
      // supply one. Epoch `0` is adopted exactly like any other; what it means is
      // `watchState()`'s business.
      adopted = true;
      epoch = batchEpoch;
    }
    if (batchDiscarded > lastDiscarded) {
      // Strictly greater, never merely non-zero: `discarded` is cumulative and
      // monotonic within the epoch, so a repeated batch carries the value that was
      // already acted on and must not be acted on again (ruling 13).
      lastDiscarded = batchDiscarded;
      discardedNoticeCount += 1;
      block = { kind: 'blockedByLostHistory', discarded: batchDiscarded, epoch };
    }
    if (block.kind === 'blockedByLostHistory') {
      if (recoverFromLostHistory(lifecycleAt)) {
        // The `open()` that recovery started has already cleared this cursor.
        // Writing a watermark here would put a closed lifecycle's number back.
        // **`true` rather than `false`**: this batch was accounted for — by being
        // refused whole under ruling 10 — and the recovery is this session's own
        // act, not a lifecycle that moved under it.
        return true;
      }
      if (lifecycle !== lifecycleAt) {
        // **The same comparison the top of this function makes, asked again
        // because the call above spent it** — Phase 2d-5-4-F.
        // `recoverFromLostHistory()` opens with `host.openWriteSurfaces()`, which
        // is injected: a call that synchronously reaches `BrowserState.open()` —
        // and so `workspaceOpened()`, `lifecycle += 1` and a zeroed cursor — and
        // *then* answers a non-empty registry declines the recovery, which lands
        // here. Both writes below would then put the closed lifecycle's numbers
        // into the replacing workspace's freshly zeroed cursor, after which
        // `host.drain(watermark)` would never fetch the new epoch's early
        // observations at all.
        //
        // **`false`, not `true`**, and that is the difference from the arm above:
        // this is a lifecycle that moved *under* the session, not a refusal the
        // session itself performed. `runOneDrain` records `'staleOpen'` for a
        // `false`, which already means *this batch's numbers cannot be attributed
        // to the lifecycle now in force*, so no new outcome arm is invented.
        //
        // **Reached by a second cause since Phase 2d-5-4-G**, and it is the one
        // that made the recovery's `true` arm unsafe: a registry read that moves
        // the lifecycle and *then* answers an **empty** list is now refused inside
        // `recoverFromLostHistory` itself, by the comparison it takes below that
        // read, and it returns `false` to here. So this line answers two facts
        // about the same lifecycle and the outcome is the same for both. The
        // sentence that stood here said *the recovery's own `true` arm needs no
        // such recheck: it writes nothing* — false of the code it described, which
        // wrote `lifecycle`, wrote `block` and called `host.reopenWorkspace()`.
        return false;
      }
      watermark = newestSequence;
      observationsDroppedCount += observationCount;
      return true;
    }
    // **Advanced for an empty batch too** (ruling 7) — that is what stops the
    // retained queue being read again.
    watermark = newestSequence;
    const session: ObservationSession = {
      epoch,
      /**
       * The epoch this session is showing now.
       *
       * @returns The adopted epoch, or zero.
       */
      epochNow: (): number => epoch,
      /**
       * Whether the lifecycle this batch was read in is still the one in force.
       *
       * **A closure over the capture the caller took above every read of the
       * command's answer**, compared against a counter no site resets — which is
       * what makes it answer where the epoch cannot: `workspaceOpened()` sets the
       * epoch to `0` and `accept()` adopts `0` like any other value, so two
       * lifecycles can legitimately show one epoch. That is a property of *this*
       * implementation and not of {@link ObservationSession}, whose member is a
       * declaration a caller may satisfy with a constant.
       *
       * @returns `true` while no site has ended this lifecycle.
       */
      lifecycleIsOurs: (): boolean => lifecycle === lifecycleAt,
      /**
       * Whether this coordinator is still applying observations at all.
       *
       * **Read live, never captured.** Both states it reports are entered *after*
       * a transition has already started a read and before that read's answer
       * comes back — a `discarded` that blocks without recovering leaves every
       * generation a guard compares exactly where it was, and so does `dispose()`.
       * A stored boolean would be the value taken at the moment the batch was
       * applied, which is precisely the moment both of them are still `true`.
       *
       * @returns `true` while this session's decisions may still be acted on.
       */
      stillApplying: (): boolean => !disposed && block.kind !== 'blockedByLostHistory',
      /**
       * Records that a safe membership reload has been asked for.
       */
      requestMembershipReload: (): void => {
        membershipReloadRequested = true;
        // Announced from inside the observation loop, which already runs host
        // members per observation and re-asks the lifecycle for each; nothing of
        // the cursor is written after this loop.
        notifyChanged();
      }
    };
    for (const observation of observations) {
      // **In sequence order, which is the order the wire promises** — the batch's
      // own comment says its observations are ordered by sequence — and the
      // per-document map is what makes that promise unnecessary: an older
      // observation of one file is refused by `admit` whatever order it arrives in.
      //
      // **The lifecycle is re-asked inside, once per observation**, because the
      // iteration itself runs a caller-supplied `Symbol.iterator` and every arm
      // reads caller-controlled properties of the observation it was handed: the
      // comparison above is a fact about the moment before the first of them.
      observationOutcomeRecords.push(applyObservation(observation, host, accepted, session));
    } // End of the loop over every observation of the accepted batch
    return true;
  } // End of function accept()

  /**
   * Makes one physical drain, with the five captures around its await.
   *
   * Single-flight removes drain-versus-drain reordering and **nothing else**
   * (ruling 15), so all five captures are still taken: an `open()` or a disposal
   * can make the only drain stale. The shape is
   * `workspace.svelte.ts`'s `rereadDocument` — capture, await, recheck, and only
   * then change anything.
   *
   * **The fourth is the open gate, and it is a re-observation rather than a
   * stored value.** What it asks after the await — *has an `open()` begun that has
   * not reported `ready`* — is a fact about now, not a number to compare with one
   * from before; storing the pre-await answer would only re-derive the generation
   * capture on the line above it, and an equality that can never fail is a claim
   * no test can fail either.
   *
   * **The fifth is the applying lifecycle, and it is taken first of all** — Phase
   * 2d-5-4-E. It is not a stronger form of the generation capture: that one asks an
   * **injected host**, so a host that reopens without moving the number it reports
   * defeats it, and the gate below asks only what this coordinator was *told*. This
   * one compares a `let` nothing outside this factory can reach. It is captured
   * above `host.openGeneration()` rather than beside it because that call is itself
   * caller code, and it is handed to {@link accept} rather than re-read there
   * because every property of the command's answer — `ok` and `value` included — is
   * caller-controlled too. **Nothing in TypeScript forces this order**; a capture
   * written one line lower would be a value a getter had already moved, and would
   * compile.
   *
   * @returns Nothing; every answer is recorded rather than returned.
   */
  async function runOneDrain(): Promise<void> {
    const lifecycleAt = lifecycle;
    const reasons = pendingReasons.splice(0, pendingReasons.length);
    // `pending()` moved. Announced here, above the host's generation read, which
    // is caller code of the same standing: a re-entrant `open()` from either lands
    // above the lifecycle comparison `accept()` makes below the await.
    notifyChanged();
    if (disposed) {
      // **Reachable since the notification above, and unreachable before it** —
      // the 2d-6-1c review's should-fix, in its second form. `pump()`'s loop
      // condition asks `drainMayStart()` synchronously in the statement that
      // calls this function, so until Phase 2d-6-1c nothing between that check
      // and the await was caller code and a check here was a claim no test could
      // fail. The notification is caller code, and a host that disposes from it
      // used to be answered with one physical drain against a coordinator that
      // had already ended, refused a microtask later by the arm below the await.
      // Recorded as that arm records it, so the reasons spliced off above are not
      // lost from the record; `host.openGeneration()` below is caller code of the
      // same standing and is not fenced — a disposal from *there* still costs one
      // refused drain, as it always has.
      record(watermark, reasons, 'disposed');
      return;
    }
    const openedAt = host.openGeneration();
    const expectedAdopted = adopted;
    const expectedEpoch = epoch;
    const afterSequence = watermark;
    let answer: CommandResult<ReconciliationBatch>;
    try {
      answer = await host.drain(afterSequence);
    } catch {
      // The real wrapper answers a `CommandResult` and never rejects, so this arm
      // exists for an injected surface that does. It is caught rather than left to
      // escape because `pump()` is started with `void`, and an escaping rejection
      // would be an unhandled one with nothing to report it.
      record(afterSequence, reasons, 'threw');
      return;
    }
    if (disposed) {
      // Ruling 16: a drain that returns after disposal performs no transition.
      record(afterSequence, reasons, 'disposed');
      return;
    }
    if (openedAt !== host.openGeneration()) {
      // An `open()` landed while this was in flight: the number the host reports
      // is no longer the one this drain was issued under. Neither sequence state
      // moves, and **that is true whether or not the cursor has been cleared** —
      // nothing on this line observes `workspaceOpened()`, and a host may move
      // `openGeneration()` without ever calling it, which is exactly the
      // independence {@link awaitingReady}'s doc comment states and the arm below
      // states again.
      //
      // **Which lifecycle the batch describes is not knowable here, and the
      // refusal does not need it to be.** In `src-tauri/src/commands.rs` both
      // `WorkspaceSession::drain_external_changes` and `WorkspaceSession::open`
      // reach the same session mutex, and neither side chooses which takes it
      // first: win, and the batch is the outgoing queue; lose, and `open`'s swap
      // block has already run — the one block that calls
      // `reconciliation.begin_epoch` and installs the new `Open` together — so the
      // batch is the **incoming** lifecycle's queue under a new epoch.
      //
      // **A third state is neither of those, so no reason here may be written as a
      // disjunction over two.** `open()` bumps the generation in its first
      // statement, unconditionally, while `WorkspaceSession::open` returns from
      // `Workspace::discover(root)?` before it takes the lock at all — so a refused
      // `open_workspace` leaves the **previous** workspace installed and its queue
      // untouched. There the batch's queue is neither gone nor foreign, and its
      // `newest_sequence` really is a watermark for the lifecycle Rust is still
      // holding. **That function's doc comment states the workspace half and not
      // the queue half.** It says a failed discovery *"returns before touching the
      // session, so the previous workspace and its watcher both stay exactly as
      // they were"*, and its `# Errors` section says a failure *"leaves the
      // previously open workspace in place"*; neither names the queue. The queue
      // half follows from that same early return rather than from any sentence,
      // because `reconciliation.begin_epoch` is reached only inside the swap block
      // that early return skips — which is why the paragraph opening *"The
      // workspace half of the third state"* calls that half reasoned rather than
      // executed.
      //
      // **A refused `list_documents` is not that state**, under the one host that
      // issues one: `./workspace.svelte.ts` returns on `!opened.ok` before it calls
      // `listDocuments()`, so reaching a `list_documents` refusal at all means
      // `open_workspace` **succeeded** and the swap block ran
      // `reconciliation.begin_epoch` and installed the new `Open` together. **It
      // does not say which of the first two cases the batch is**, and writing it as
      // the incoming one would decide a race this refusal cannot see: the batch was
      // produced when the drain took the session lock, which is before or after that
      // block according to the order the two commands reached it, and a refusal
      // observed later in `open()` is no evidence either way. So it is one of those
      // two, whichever the race gave, and never this one — **which is a claim about
      // where the batch came from, not about the property the paragraph opening *"A
      // third state is neither of those"* draws from it.** In case 2 the batch
      // already *is* the incoming lifecycle's queue, so **at the instant the drain
      // took the session lock** the property *"its
      // `newest_sequence` really is a watermark for the lifecycle Rust is still
      // holding"* was satisfied outright — no second open is needed to arrange it,
      // and none is claimed. **The time index is load-bearing and is the whole of
      // the claim.** This arm runs after the await, a further successful open may
      // have installed another lifecycle and emptied the queue by then — nothing
      // stops one. **Of the two tests cited here, one drives that overlap and does
      // so against an injected host, and the other does not drive it at all;
      // nothing wider is claimed here.**
      // `./workspace.test.ts`'s *"lets the newer open win, however late the older
      // one answers"* overlaps two **opens** with each other and issues no drain at
      // all, so it is the one that does not — but **coordinator code does run in
      // it**: the host constructs one, every `open()` calls `workspaceOpened()`
      // synchronously, and the open that wins reaches `workspaceReady()`, whose
      // body is `openInProgress = false` and then `requestDrain('workspaceOpened')`;
      // the open this test supersedes returns at the generation check directly
      // under its own `openWorkspace` await, so it never reaches
      // `workspaceReady()`. The test never calls `start()`, so `drainMayStart()` is
      // false and that reason is **remembered rather than issued**. What drives an
      // open landing during a drain is
      // `./reconciliationCoordinator.test.ts`'s *"installs nothing from a drain an
      // open overtook"*, and it moves the generation on the **injected** host — so
      // it reaches this arm and says nothing about Rust either. Nothing here
      // observes whether one did. Provenance is what the paragraphs above
      // classify, and **nothing here rests on the property** — the refusal below is
      // justified by unattributability — so the distinction costs the refusal
      // nothing and is written down only because a reader who takes "this one" as
      // the property would find the enumeration short by a case.
      //
      // **The workspace half of the third state is driven and asserted in Rust; the
      // queue half is not.** `src-tauri/src/watch_check.rs`'s
      // `a_failed_reopen_keeps_the_previous_watcher_watching` opens a real tree,
      // refuses a second open with a path that is not a directory, and then asserts
      // the session is still open at the same epoch, still ready, and still
      // delivering a live edit — so a change that let a refused open replace or
      // empty the session turns that test **red**, and the **workspace** half of the
      // paragraph opening *"A third state is neither of those"* is not
      // reasoned-only. **What nothing pins is that the queue survives it**: that
      // test never drains, and no scripted-command suite in `./workspace.test.ts`
      // drives Rust at all — its failed-open case asserts the *gate*, and no batch
      // reaches this arm in it. So the queue half is **asserted in prose and rested
      // on by nothing here** — asserted by the paragraph opening *"A third state is
      // neither of those"* and by that one alone, which is the site this sentence
      // means and the reason it names it by its opening words rather than saying
      // *the paragraph above*: this arm records the *pre-await* `afterSequence` and
      // returns, never reading `batch.newest_sequence`, which is consumed in
      // `accept()` alone. **The case-2 sentence above is not a second site for it.**
      // It repeats the same property *text* about **case 2** — a successful open
      // that lost the lock race — and the paragraph opening *"A refused
      // `list_documents` is not that state"* separates that case from this one in
      // as many words, so the edit that would falsify this comment — one that reset
      // the queue on the refusal path — does not reach it. **The two paragraphs
      // that carry the refusal's own justification say different things and are
      // cited as such**: the one opening *"What makes the refusal right in all
      // three"* says the refusal rests on unattributability; the one opening
      // *"Which lifecycle the batch describes"* says only that the lifecycle is not
      // knowable here and that the refusal does not need it to be, which is the
      // weaker claim. **The queue half** is reasoned from `WorkspaceSession::open`
      // rather than executed, and an edit that reset the queue on the refusal path
      // would falsify **this comment** with every gate in the project green.
      //
      // **What makes the refusal right in all three is that nothing here can
      // attribute the number, never that the queue is gone.** The only value that
      // separates two lifecycles' sequences is the batch's `epoch`, and this arm
      // fires **above** the check that reads it, so `newest_sequence` arrives
      // unattributable by construction. Refusing costs at most one repeated drain,
      // and on the failed-open path not even that: the gate `workspaceOpened()`
      // closed stays closed and the window is showing a failure. Moving a sequence
      // state on a number that may belong to another lifecycle poisons the cursor
      // for the session. Under `./workspace.svelte.ts` the cursor has also just
      // been cleared, which makes the same refusal right a second way — a property
      // of that host and not of this line, exactly as the paragraph opening *"An
      // `open()` landed while this was in flight"* says.
      record(afterSequence, reasons, 'staleOpen');
      return;
    }
    if (awaitingReady()) {
      // An `open()` **began** while this was in flight, and the two checks are not
      // the same question. The one above compares the number the host reports; this
      // one asks whether the coordinator was *told* an open started and was not
      // told it finished. Under `./workspace.svelte.ts` they fire together, because
      // that `open()` bumps its generation in the statement before it says so — but
      // the generation is read through {@link ReconciliationHost} and the gate is
      // set through a call on this interface, and nothing ties the two. The outcome
      // is the same as the check above's, and so is the *shape* of the reason —
      // nothing here can attribute the batch's `newest_sequence` to a lifecycle —
      // but **the premise is not that arm's**, and writing it as that arm's would
      // contradict the sentence this comment opens with. The generation this drain
      // was issued under is still the one the host reports; this arm is reached
      // only because the check above did not fire. So what is unknown here is not
      // which lifecycle replaced this session's, but whether the open this
      // coordinator was *told* about has replaced it **yet**:
      // `WorkspaceSession::open` may not have reached its swap block, may have
      // passed it, or may refuse at `Workspace::discover(root)?` and leave the
      // previous workspace installed indefinitely. The batch's `epoch` is the only
      // value that would separate those, and it is read below this arm. So a batch
      // of it must move neither sequence state.
      record(afterSequence, reasons, 'staleOpen');
      return;
    }
    if (!answer.ok) {
      host.report(answer.failure);
      record(afterSequence, reasons, 'refused');
      return;
    }
    // **One read of `answer.value`, and one materialization of what it carries**
    // — Phase 2d-5-4-F. `answer` is whatever the injected `host.drain()` resolved
    // with, so `value` may be an accessor answering a different object each time
    // it is asked. Validating one read and spending another is the check-and-spend
    // shape `CLAUDE.md` names, and here the check and the spend were two reads of
    // the **same property**: the epoch validated below belonged to one object and
    // the `discarded`, `newest_sequence` and `observations` consumed by
    // {@link accept} to another. **No lifecycle movement is required for that**, so
    // no fence in this module defended it.
    //
    // **The snapshot is a plain object of own data properties**, so `accept()`'s
    // own four reads read data rather than accessors, and the epoch validated
    // below is the epoch it adopts. **Its `observations` member is a copied
    // reference, not a copied list**, so `accept()`'s fifth read — the `length` on
    // that array — is still a read on the object the host supplied; see the comment
    // on `accept()`'s own comparison.
    //
    // **The consequence, written down rather than discovered later**: the `value`
    // getter and the four member getters now fire **above** the `staleEpoch` arm
    // instead of below it. They are still below the `disposed` check and both
    // generation checks, and still above `accept()`'s comparison, so a getter that
    // ends the lifecycle is caught **above every write** — but not always by the
    // same catcher, and this comment said *caught exactly as it was* until Phase
    // 2d-5-4-G. When `expectedAdopted` is `true` and the batch names an epoch this
    // session is not showing, the `staleEpoch` arm below is now reached first and
    // this drain records `'staleEpoch'`, never calling `accept()` at all; otherwise
    // it is `accept()`'s comparison answering `false` and this drain recording
    // `'staleOpen'`. Nothing is written on either path, so the difference is which
    // record the drain lands in.
    const delivered = answer.value;
    const batch: ReconciliationBatch = {
      epoch: delivered.epoch,
      discarded: delivered.discarded,
      newest_sequence: delivered.newest_sequence,
      observations: delivered.observations
    };
    if (expectedAdopted && batch.epoch !== expectedEpoch) {
      // **Neither sequence state moves**: not the watermark, not `lastDiscarded`.
      // The batch describes a queue for a workspace lifecycle this session is not
      // showing, and its `newest_sequence` is not comparable with this session's —
      // the non-falling property is scoped to one epoch (ruling 7).
      record(afterSequence, reasons, 'staleEpoch');
      return;
    }
    if (!accept(batch, lifecycleAt)) {
      // The lifecycle this drain was issued in ended before the batch could be
      // accounted for — inside the `answer.value` read above, inside one of the
      // four member reads that built the snapshot, inside `accept`'s own reads of
      // it, or inside the registry read its blocked arm makes. Nothing moved, so
      // the outcome here is the same as the two rechecks above and for the same
      // reason: the number this batch carries cannot be attributed to the
      // lifecycle now in force.
      record(afterSequence, reasons, 'staleOpen');
      return;
    }
    record(afterSequence, reasons, 'accepted');
  } // End of function runOneDrain()

  /**
   * The single-flight pump.
   *
   * **It yields once before its first drain**, which is what makes the consult's
   * "one physical drain may satisfy both when neither has started" reachable: two
   * triggers arriving in the same synchronous block, or in the same microtask
   * batch, are both on `pendingReasons` by the time the loop clears `requested`.
   * The `while` is the general form of Q4's "repeat once more" — ten triggers
   * during one call still produce exactly one follow-up, because they set one
   * boolean.
   *
   * **The loop exits with `requested` still set when the gate closes under it**,
   * and that is the intended shape: an `open()` that begins during a drain must
   * stop the next physical call without discarding the trigger that asked for it.
   * `workspaceReady()` is what flushes it.
   *
   * @returns Nothing; it runs until nothing more is requested or nothing more is
   *   permitted.
   */
  async function pump(): Promise<void> {
    await Promise.resolve();
    while (requested && drainMayStart()) {
      requested = false;
      await runOneDrain();
    } // End of the loop that drains until nothing more has been requested
  } // End of function pump()

  /**
   * Starts a pump if one is not already running.
   *
   * `inFlight` is assigned **synchronously**, before any await inside `pump()`
   * runs, so a second request in the same block sees a pump and returns rather
   * than starting a second one.
   *
   * **The caller decides whether a pump is permitted; this decides whether one is
   * needed.** Every call site asks `drainMayStart()` first, so nothing here
   * repeats those three clauses — except in `release`, where the question is asked
   * again because the slot is given back in a microtask and the world may have
   * moved.
   */
  function ensurePumping(): void {
    if (inFlight !== null) {
      return;
    }
    const running = pump();
    inFlight = running;
    // `isPumping()` moved. `pump()` has yielded at its first line, so nothing of
    // the drain has run yet and a re-entrant request inside the host's callback
    // sees an occupied slot, exactly as one made by any other caller would.
    notifyChanged();
    /**
     * Releases the slot, whichever way the pump ended, and re-enters if a request
     * is outstanding.
     *
     * **The re-entry closes a window that used to strand a request.** `pump()`'s
     * loop exits synchronously the moment `requested` is false, but the slot is
     * only given back here, a microtask later; a `requestDrain` landing in between
     * set `requested`, saw an occupied slot, and returned — leaving its reason on
     * `pendingReasons` with no pump behind it and nothing but a later trigger to
     * rescue it. Reproduced at microtask-chain depth two, which is the depth an
     * `open()`'s tail calling `workspaceReady()` arrives at.
     *
     * **It cannot spin.** A restart happens only because a trigger set
     * `requested`, and the loop above clears `requested` before each drain, so
     * every restart consumes exactly the request that caused it. The slot is
     * cleared *before* the re-entry, so `ensurePumping` sees a free slot and a
     * throw from the restart cannot leave the slot held.
     *
     * Compared by identity so that a pump started by a request made *during* this
     * one's settlement is not cleared by this one's callback.
     */
    const release = (): void => {
      if (inFlight !== running) {
        return;
      }
      inFlight = null;
      // `isPumping()` moved back. Announced with the slot already free, so a
      // request the host's callback makes starts a pump through the ordinary door
      // and the re-entry below then finds the slot taken and returns. **This is
      // the one notification that runs inside a promise callback**: a host whose
      // callback throws here rejects the `void`-ed promise `running.then(...)`
      // returns, with no handler — the unhandled rejection the comment below names
      // as the cost of a `void`-ed `.finally` — and the one production host cannot
      // throw.
      notifyChanged();
      if (requested && drainMayStart()) {
        ensurePumping();
      }
    }; // End of function release()
    // **Both arms, rather than `.finally`.** `pump()` catches **nothing** — it
    // holds no `try` at all, and `runOneDrain`'s wraps only the `await
    // host.drain(...)` itself — so everything below that await is unprotected: a
    // throwing getter on `answer.ok`, on `answer.value`, on any of the four batch
    // members, on the `Symbol.iterator` the batch loop runs, or on any host member
    // an arm calls, propagates out of `runOneDrain`, out of `pump()`, and rejects
    // `running`. The comment here claimed the opposite until Phase 2d-5-4-F. What
    // that costs is one drain missing from {@link drains} — its reasons were
    // spliced off `pendingReasons` before the await and no `record()` runs — and
    // **not** a stranded slot, because the rejection arm below releases it.
    //
    // **A third cost, named at Phase 2d-5-4-G because this enumeration stopped one
    // short of it.** `accept()` writes `watermark = newestSequence` *above* the
    // observation loop, so a throw from any host member an arm calls — a status
    // write, a removal, an addition, a guarded reread, an eligibility question —
    // at observation *k* leaves the cursor already advanced past the **whole**
    // batch. The next drain asks `host.drain(watermark)`, so observations *k* to
    // *n* are never fetched again and nothing records that they were dropped: this
    // is the partial application `observationsDroppedCount` does not count. It is
    // the same mechanism ruling 13 relies on for a blocked session, without that
    // ruling's whole-reload obligation behind it. **Closing it is a phase
    // decision, not a sentence's business** — a `try` added here to make a comment
    // true is machinery invented for prose, which is why 2d-5-4-F refused one.
    // A `void`-ed `.finally` on a rejected promise is an *unhandled* rejection
    // with nothing to report it, while a rejection handler that returns normally
    // is not. `release` itself returns normally on both arms: `ensurePumping` calls
    // an `async` function, which reports a synchronous throw as a rejected promise
    // rather than by throwing, so nothing here can turn a rejection into a second
    // one with no handler.
    void running.then(release, release);
  } // End of function ensurePumping()

  /**
   * Registers for wakes, and owns the race between that and disposal.
   *
   * @returns Nothing; the outcome lands on {@link registrationState}.
   */
  async function register(): Promise<void> {
    registrationState = { kind: 'registering' };
    notifyChanged();
    let off: ReconciliationUnlisten;
    try {
      off = await events.subscribe(onWake);
    } catch (error) {
      // **Observable, never a silent no-op unlisten.** `src/lib/ipc/events.ts`
      // refuses to resolve with one for this reason, and swallowing the rejection
      // here would put the claim back in a different place. The other three
      // triggers are unaffected: a window with no wake transport still drains
      // after an open and on foreground.
      //
      // **Announced like every other transition** — the 2d-6 record's entry 28
      // names this one because it is the asynchronous arm a screen would
      // otherwise never learn of: nothing else runs when a subscription rejects.
      registrationState = { kind: 'failed', error };
      notifyChanged();
      return;
    }
    if (disposed) {
      // Ruling 16's half that nothing in TypeScript forces to be written: the
      // unlisten is called immediately rather than stored, so a coordinator
      // disposed while `subscribe` was in flight still ends the subscription
      // exactly once and leaves nothing listening.
      registrationState = { kind: 'abandoned' };
      notifyChanged();
      off();
      return;
    }
    unlisten = off;
    registrationState = { kind: 'registered' };
    notifyChanged();
    requestDrain('registration');
  } // End of function register()

  /**
   * What a wake does.
   *
   * **A wake carries no observation and establishes no authority** (ruling 8): it
   * is a reason to ask, and the drain is what answers. Before the first batch
   * adopts an epoch, a wake may request a drain whatever epoch it names; once one
   * is adopted, a wake for another epoch requests nothing.
   *
   * @param wake - The payload, whole.
   */
  function onWake(wake: ReconciliationWake): void {
    if (disposed) {
      return;
    }
    if (adopted && wake.workspace_epoch !== epoch) {
      return;
    }
    requestDrain('wake');
  } // End of function onWake()

  /**
   * Records a request and pumps when the lifecycle permits it.
   *
   * **A request made before `start()` is remembered rather than dropped**, which
   * is what lets an `open()` that finished first be answered by the first pump:
   * the consult's two orders both have to work, and losing the reason would make
   * one of them silently produce no drain at all. **A request made while an
   * `open()` is loading is remembered for the same reason and for a second one**:
   * a drain issued here would come back describing a lifecycle the coordinator
   * could not name — `WorkspaceSession::open` swaps the workspace under the same
   * session mutex `WorkspaceSession::drain_external_changes` takes, so the batch is
   * the outgoing queue or the incoming one according to which reached that mutex
   * first, and it is the **previous, still-installed** one when the open is refused
   * before that swap ever runs — while every generation capture in the pump would
   * legitimately pass, because `open()` had already taken the generation this drain
   * captures. Recording without issuing is what answers all three: the reason
   * survives to the drain that follows the next `ready`, and no batch is accepted
   * for a lifecycle this session is not showing.
   *
   * @param reason - Which trigger is asking.
   */
  function requestDrain(reason: DrainReason): void {
    if (disposed) {
      return;
    }
    rememberReason(reason);
    requested = true;
    if (!drainMayStart()) {
      return;
    }
    ensurePumping();
  } // End of function requestDrain()

  return {
    start(): void {
      if (started || disposed) {
        return;
      }
      started = true;
      // Registration first, as the consult orders the four triggers — and it is
      // fired rather than awaited, because `start()` answers a host's `onMount`
      // and must not make it asynchronous.
      void register();
      if (disposed) {
        // **The `registering` notification ran inside the call above, and it is
        // caller code** — the 2d-6-1c review's should-fix. A host that disposes
        // from it used to watch this function go on to subscribe to the foreground
        // source, and `dispose()` had already run its removal loop over an empty
        // list: a listener nothing would ever remove. Nothing below may take a
        // resource on a coordinator that has ended, so this returns with none
        // taken. The registration in flight lands as `abandoned` on its own.
        return;
      }
      const offForeground = foreground.subscribe(
        /**
         * Asks for a drain because the window came forward.
         *
         * @returns Nothing; the pump is what answers.
         */
        function onForeground(): void {
          requestDrain('foreground');
        }
      );
      if (disposed) {
        // `subscribe` is the injected source's own code and can dispose this
        // coordinator re-entrantly too; the unsubscribe it answered is then called
        // here, once, instead of being held by a list `dispose()` has already
        // emptied. Nothing in TypeScript forces a source not to do this.
        offForeground();
        return;
      }
      foregroundOff.push(offForeground);
      if (requested && drainMayStart()) {
        // Anything recorded before the lifecycle began — an `open()` that reached
        // `ready` first — is flushed here, in arrival order. Not, however, an
        // `open()` still loading, and what that rests on is the predicate rather
        // than any call order in a host: `drainMayStart()` is the question being
        // asked, so a host that announced an open through `workspaceOpened()` and
        // has not reported `ready` reaches this line with the gate already closed,
        // and the flush is `workspaceReady()`'s.
        //
        // **The one production caller is `AppShell.svelte`'s `onMount`**, through
        // `BrowserState.start()` in `./workspace.svelte.ts`, and it calls this
        // *before* `open(null)` — so in the shipped window nothing is requested
        // yet when this line is reached and the flush below is a no-op; the
        // registration's request lands while the open's gate is closed and is
        // issued by `workspaceReady()`. This comment states the gate rather than
        // that call order, because a host that opened first would be equally
        // correct and nothing in TypeScript fixes the order.
        ensurePumping();
      }
    }, // End of function start()

    dispose(): void {
      if (disposed) {
        return;
      }
      disposed = true;
      // **Necessary, not redundant, and this comment said the opposite for a
      // round** — Phase 2d-5-4-F. It *overlaps* the line above for the fences that
      // read `stillApplying()`, which reads `disposed` live: every per-observation
      // arm in `./observationTransitions.ts` refuses after this point whether or
      // not this counter moves. It does **not** overlap {@link accept}, whose
      // comparison reads `lifecycle` **alone** and never reads `disposed`. The only
      // other `disposed` read on the drain path is `runOneDrain`'s, and that one is
      // above every caller-controlled read of the command's answer — so a
      // `dispose()` fired from a getter on `answer.value`, on one of the batch's
      // four members or on `observations.length` lands *below* it. Delete this line
      // and such a disposal leaves `accept()` adopting an epoch, entering the
      // blocked state, moving the watermark, and reaching
      // `host.reopenWorkspace()`: a disposed coordinator asking the window to throw
      // away and reload its whole workspace. The rule it also keeps true — *every
      // site that ends the applying lifecycle moves the counter* — is a second
      // reason, not the reason.
      lifecycle += 1;
      // `isDisposed()` moved, and it is announced before the two caller-owned
      // calls below rather than after them: a foreground unsubscribe or a held
      // unlisten that throws must not leave a screen believing this coordinator
      // is still live. A re-entrant `dispose()` from the callback returns at the
      // guard above.
      notifyChanged();
      // **Synchronously**, before anything can await: ruling 16 says foreground
      // listeners are removed synchronously, and there is no reason for the wake
      // listener to be different when its unlisten is already held.
      for (const off of foregroundOff.splice(0, foregroundOff.length)) {
        off();
      }
      const held = unlisten;
      unlisten = null;
      if (held !== null) {
        // Nulled in the statement before the call, so a re-entrant dispose — or a
        // second one after a throw from `held` — cannot call it twice. The
        // `disposed` guard above already refuses a second call; this is the half
        // that does not depend on it.
        held();
      }
    }, // End of function dispose()

    requestDrain,

    workspaceOpened(request: string | null): void {
      // **First, before any of the clearing below**, so that caller code re-entering
      // part-way through the reset — a `$effect` on `documents`, say — already sees
      // a lifecycle it cannot claim rather than a half-cleared one it can. It is
      // the increment the whole of Phase 2d-5-4-E's fence rests on: `accepted` is
      // emptied in the block below, and `admit` is the one operation an empty map
      // answers permissively.
      lifecycle += 1;
      // **Everything learned about the workspace being closed goes.** The epoch
      // is a property of that lifecycle, the watermark indexes its queue, and
      // `lastDiscarded` is cumulative *within* the epoch — carrying any of them
      // into the next open would compare a new lifecycle's numbers with an old
      // one's. The consult's Q2 step 1 names a fourth thing, the accepted-sequence
      // map, and it is cleared here for a sharper reason than the other three —
      // **not** because identities change, which they do not: they are minted per
      // path and live as long as the process, so a retained entry is a sequence
      // about the *same* file. It is because the epoch replacing this one restarts
      // its observation sequences at the first, so a kept entry would refuse that
      // file's earliest observations of the new epoch.
      adopted = false;
      epoch = 0;
      watermark = 0;
      lastDiscarded = 0;
      discardedNoticeCount = 0;
      observationsDroppedCount = 0;
      accepted.clear();
      observationOutcomeRecords.length = 0;
      // The blocked state and the membership-reload request both describe the
      // workspace being closed. A whole open is exactly what each of them was
      // asking for, so neither may survive one.
      block = { kind: 'running' };
      membershipReloadRequested = false;
      // **Retained for ruling 11's recovery**, and overwritten by every open so
      // that the recovery re-runs the request that produced the workspace on
      // screen rather than the first one this session ever made.
      openRequest = request;
      // **And the gate closes.** A drain issued between here and `ready` answers
      // for whichever lifecycle reached the session mutex first — Rust holds the
      // workspace being replaced until `WorkspaceSession::open`'s swap block runs,
      // which is not tied to when this window learns the open succeeded, and holds
      // it **indefinitely** when that open is refused before the swap, which is
      // that function's own documented behaviour — and the gate does not need to
      // know which, because the objection is to accepting **any** batch in this
      // window: `adopted` has just been cleared, so `accept()` would take that
      // batch's epoch as this session's shown epoch, the post-`ready` batch would
      // come back `staleEpoch`, and `onWake` would drop every wake for the real
      // epoch from then on. Every generation capture in the pump passes in that
      // window, because `open()` took its generation in the statement before this
      // call; being *told* is the only thing that distinguishes it.
      openInProgress = true;
      // Every reader but `registration()` and `isDisposed()` moved above. Last,
      // after the gate: the one caller of this function is `open()`'s first
      // statements, and nothing here is written after the callback.
      notifyChanged();
    }, // End of function workspaceOpened()

    workspaceReady(): void {
      // The gate opens first, so the request below is the flush rather than one
      // more thing held behind it — together with every reason recorded while it
      // was closed, which the pump answers in arrival order.
      openInProgress = false;
      // `awaitingWorkspaceReady()` moved. Announced before the request below, which
      // announces its own two transitions and refuses on a disposed coordinator
      // without announcing anything.
      notifyChanged();
      requestDrain('workspaceOpened');
    }, // End of function workspaceReady()

    awaitingWorkspaceReady(): boolean {
      return awaitingReady();
    },

    cursor(): ReconciliationCursor {
      // **Frozen, because the sentence in the interface says so.** A caller that
      // reads this is reading three numbers of a session cursor the coordinator
      // goes on moving; handing back a mutable literal would let one of them be
      // assigned in a way that looks like it changed the coordinator and does not.
      return Object.freeze({ epoch, watermark, lastDiscarded });
    }, // End of function cursor()

    watchState(): ReconciliationWatchState {
      if (!adopted) {
        return { kind: 'notObserved' };
      }
      if (epoch === 0) {
        return { kind: 'notWatched' };
      }
      return { kind: 'watching', epoch };
    }, // End of function watchState()

    registration(): RegistrationState {
      return registrationState;
    },

    pending(): readonly DrainReason[] {
      return [...pendingReasons];
    },

    drains(): readonly DrainRecord[] {
      return [...drainRecords];
    },

    discardedNotices(): number {
      return discardedNoticeCount;
    },

    observationsDropped(): number {
      return observationsDroppedCount;
    },

    observationOutcomes(): readonly ObservationOutcome[] {
      return [...observationOutcomeRecords];
    },

    acceptedSequence(document: DocumentId): number {
      return accepted.sequenceFor(document);
    },

    block(): ReconciliationBlock {
      return block;
    },

    membershipReloadWanted(): boolean {
      return membershipReloadRequested;
    },

    isDisposed(): boolean {
      return disposed;
    },

    reopenFromRetainedRequest(): boolean {
      if (disposed) {
        return false;
      }
      // **The same three statements as `recoverFromLostHistory`'s reopen, without
      // its two fences** — deliberately not shared with it. That function's fences
      // are about a batch it is applying (the registry read it makes and the
      // lifecycle it captured before reading the batch); this member applies no
      // batch and is fenced by the window's own rechecks in the block that calls
      // it. The lifecycle moves first, for the reason given there: a host that
      // reopens without announcing still leaves every later session unable to
      // claim the lifecycle being replaced. `membershipReloadRequested` is left to
      // `workspaceOpened()`, which every announcing host reaches synchronously.
      lifecycle += 1;
      block = { kind: 'running' };
      // **Fired, never awaited, and the host owns everything after it.** Nothing
      // of the cursor is written below, so a host that announces synchronously —
      // the production `open()` does — clears the cursor before this returns and
      // one that does not leaves it where it stood.
      host.reopenWorkspace(openRequest);
      // `block()` moved, and it is announced after the reopen rather than before
      // it so the callback runs with nothing left to write here.
      notifyChanged();
      return true;
    }, // End of function reopenFromRetainedRequest()

    isPumping(): boolean {
      return inFlight !== null;
    }
  };
} // End of function createReconciliationCoordinator()
