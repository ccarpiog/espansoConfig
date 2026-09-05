/**
 * When a drain fires, and what a drained batch does to the session cursor —
 * Phase 2d-5-3.
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
 * `./workspace.svelte.ts` are read by the request that took one. If a later phase
 * needs a window to *draw* the cursor — 2d-6 draws {@link
 * ReconciliationWatchState}'s `notWatched` arm — the mirror belongs in
 * `BrowserState`, where `openWriteSurfaces()`'s mirror already lives, and not
 * here.
 *
 * ## What this step deliberately does **not** do
 *
 * - **It applies no observation.** `Added`, `Removed` and `Unreadable`, the
 *   per-document `acceptedSequenceByDocument` map, the guarded reread and
 *   `applyExternalObservation` are all **2d-5-4's**. A drained batch's
 *   observations are counted by {@link ReconciliationCoordinator.observationsDropped}
 *   and otherwise dropped.
 * - **It performs no `discarded` recovery.** No re-run of `open()`, no
 *   blocked-reconciliation policy, no synthetic conflict. The cursor tracks
 *   `lastDiscarded` and counts the times it strictly rose; rulings 11 and 12's
 *   recovery is **2d-5-4's**.
 * - **It reaches nothing in the shipped window.** `createBrowserState` defaults
 *   both injected sources to the inert ones declared below, no production module
 *   imports `src/lib/ipc/events.ts`, and no production caller invokes
 *   {@link ReconciliationCoordinator.start} — `AppShell.svelte` is **2d-5-7's** to
 *   change. That unreachability is exactly what makes dropping observations safe
 *   at this step: nothing on a screen is derived from anything this module holds.
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
import type { ReconciliationBatch, ReconciliationWake } from '../ipc/types';

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
 * accepted-sequence map**, which is 2d-5-4's and does not exist yet: ruling 6
 * keeps the two apart precisely because they answer different questions and may
 * legitimately hold different numbers.
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
 * **2d-6 draws it and owes its dictionary keys.** This step names the state and
 * adds **no** i18n key for it, because `2d-5-split-notes.md` section 6 item 6
 * puts the EN/ES entries and the `src/lib/i18n/codes.ts` accessor on the step
 * that first *names it to a person*, and nothing here is on a screen.
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
  /** An `open()` landed while the call was in flight, so it installed nothing. */
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
 * Three members, so a model test supplies three functions and no `BrowserState`.
 * It is deliberately **not** `BrowserCommands`: the only command this step calls
 * is the drain, and taking the whole surface would let a later edit here reach a
 * writing command, which watcher arbitration may never initiate (ruling 27).
 */
export interface ReconciliationHost {
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
 * asynchronous registration cannot promise that. Every real implementation this
 * would wrap — `addEventListener`, Tauri's window `onFocusChanged` — registers
 * synchronously too, so nothing is being pretended here.
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
 * `src/lib/ipc/events.ts` declares would make that file a production module and
 * pull Tauri's `listen` into the bundle; the split reserves the first production
 * import of it for **2d-5-7**, together with the two capability entries it needs.
 * That reservation is machine-checkable — the real adapter's name occurs in `src/`
 * only in the file that declares it — so this comment names it by description
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
   * Idempotent for the same reason `start()` is, and because ruling 16's "exactly
   * once" has to survive a host that disposes twice.
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
   * Clears the expected epoch, the watermark and the handled-discard count, so
   * that nothing learned about the workspace being closed is asked with, or
   * compared against, in the one replacing it.
   *
   * **It also closes the open gate**, which is what stops a trigger arriving
   * between here and `ready` from adopting the epoch of the workspace being
   * replaced: Rust still holds that workspace until the open succeeds, so a drain
   * taken in this window answers for the wrong lifecycle while every generation
   * capture in the pump legitimately passes.
   */
  workspaceOpened(): void;
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
   * (ruling 13). **Acting is all it counts** — the recovery itself is 2d-5-4's.
   *
   * @returns The count, reset by {@link ReconciliationCoordinator.workspaceOpened}.
   */
  discardedNotices(): number;
  /**
   * How many observations this step has accounted for and thrown away.
   *
   * There to make the dropping *visible*, so that 2d-5-4 replacing it with a
   * transition is a change to something a test already reads.
   *
   * @returns The running total since the last `open()`.
   */
  observationsDropped(): number;
  /**
   * Whether {@link ReconciliationCoordinator.dispose} has been called.
   *
   * @returns `true` once disposed, forever.
   */
  isDisposed(): boolean;
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
    }
  } // End of function rememberReason()

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
  } // End of function record()

  /**
   * Accounts for a batch that is for this open and this epoch.
   *
   * **`discarded` is handled before the observations**, which is ruling 10's
   * order and is kept here even though this step only counts both: 2d-5-4 puts a
   * recovery in the first half and transitions in the second, and writing the
   * order now is what stops that step having to re-derive it.
   *
   * @param batch - The accepted batch.
   */
  function accept(batch: ReconciliationBatch): void {
    if (!adopted) {
      // **The shown epoch is learned here and nowhere else** (ruling 8):
      // `open_workspace` answers a root and counts, so the first successful drain
      // taken at the still-current open generation is the only thing that can
      // supply one. Epoch `0` is adopted exactly like any other; what it means is
      // `watchState()`'s business.
      adopted = true;
      epoch = batch.epoch;
    }
    if (batch.discarded > lastDiscarded) {
      // Strictly greater, never merely non-zero: `discarded` is cumulative and
      // monotonic within the epoch, so a repeated batch carries the value that was
      // already acted on and must not be acted on again (ruling 13).
      lastDiscarded = batch.discarded;
      discardedNoticeCount += 1;
    }
    // **Advanced for an empty batch too** (ruling 7) — that is what stops the
    // retained queue being read again — and advanced while a loss is outstanding,
    // which ruling 13 requires and which is safe only because incremental
    // reconciliation does not resume until a new epoch is established. **This step
    // establishes neither half of that: 2d-5-4 owns the recovery**, so what is
    // written here is the accounting alone.
    watermark = batch.newest_sequence;
    // Counted, then dropped. 2d-5-4 replaces this line with the per-document
    // arbitration and the guarded reread; until then nothing on any screen is
    // derived from an observation, because nothing in production runs this pump.
    observationsDroppedCount += batch.observations.length;
  } // End of function accept()

  /**
   * Makes one physical drain, with the four captures around its await.
   *
   * Single-flight removes drain-versus-drain reordering and **nothing else**
   * (ruling 15), so all four captures are still taken: an `open()` or a disposal
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
   * @returns Nothing; every answer is recorded rather than returned.
   */
  async function runOneDrain(): Promise<void> {
    const reasons = pendingReasons.splice(0, pendingReasons.length);
    const openedAt = host.openGeneration();
    const expectedAdopted = adopted;
    const expectedEpoch = epoch;
    // **No disposal check here, and its absence is deliberate.** `pump()`'s loop
    // condition is the check, evaluated synchronously in the statement that calls
    // this function, so one written here would be unreachable — and an unreachable
    // guard is a claim no test can fail. The one that matters is below the await.
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
      // untouched, which that function's own doc comment states in as many words.
      // There the batch's queue is neither gone nor foreign, and its
      // `newest_sequence` really is a watermark for the lifecycle Rust is still
      // holding.
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
      // where the batch came from, not about the property the paragraph above draws
      // from it.** `open()` has no re-entrancy guard, so a case-2 batch followed by
      // a *later* open refusing at `Workspace::discover(root)?` leaves Rust holding
      // the very workspace that batch came from: the property *"its
      // `newest_sequence` really is a watermark for the lifecycle Rust is still
      // holding"* is satisfied while the provenance is still case 2. Provenance is
      // what these three paragraphs classify, and **nothing here rests on the
      // property** — the refusal below is justified by unattributability — so the
      // distinction costs the refusal nothing and is written down only because a
      // reader who takes "this one" as the property would find the enumeration
      // short by a case.
      //
      // **The workspace half of the third state is driven and asserted in Rust; the
      // queue half is not.** `src-tauri/src/watch_check.rs`'s
      // `a_failed_reopen_keeps_the_previous_watcher_watching` opens a real tree,
      // refuses a second open with a path that is not a directory, and then asserts
      // the session is still open at the same epoch, still ready, and still
      // delivering a live edit — so a change that let a refused open replace or
      // empty the session turns that test **red**, and the paragraph above is not
      // reasoned-only. **What nothing pins is that the queue survives it**: that
      // test never drains, and no scripted-command suite in `./workspace.test.ts`
      // drives Rust at all — its failed-open case asserts the *gate*, and no batch
      // reaches this arm in it. So the half this arm actually rests on — that the
      // batch's `newest_sequence` still indexes the queue Rust is holding — is
      // reasoned from `WorkspaceSession::open` rather than executed, and an edit
      // that reset the queue on the refusal path would falsify it with every gate
      // in the project green.
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
      // of that host and not of this line, exactly as the paragraph above says.
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
    if (expectedAdopted && answer.value.epoch !== expectedEpoch) {
      // **Neither sequence state moves**: not the watermark, not `lastDiscarded`.
      // The batch describes a queue for a workspace lifecycle this session is not
      // showing, and its `newest_sequence` is not comparable with this session's —
      // the non-falling property is scoped to one epoch (ruling 7).
      record(afterSequence, reasons, 'staleEpoch');
      return;
    }
    accept(answer.value);
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
      if (requested && drainMayStart()) {
        ensurePumping();
      }
    }; // End of function release()
    // **Both arms, rather than `.finally`.** `pump()` catches everything a drain
    // can throw, so this is defence against a throw from the bookkeeping itself —
    // and a `void`-ed `.finally` on a rejected promise is an *unhandled* rejection
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
    let off: ReconciliationUnlisten;
    try {
      off = await events.subscribe(onWake);
    } catch (error) {
      // **Observable, never a silent no-op unlisten.** `src/lib/ipc/events.ts`
      // refuses to resolve with one for this reason, and swallowing the rejection
      // here would put the claim back in a different place. The other three
      // triggers are unaffected: a window with no wake transport still drains
      // after an open and on foreground.
      registrationState = { kind: 'failed', error };
      return;
    }
    if (disposed) {
      // Ruling 16's half that nothing in TypeScript forces to be written: the
      // unlisten is called immediately rather than stored, so a coordinator
      // disposed while `subscribe` was in flight still ends the subscription
      // exactly once and leaves nothing listening.
      registrationState = { kind: 'abandoned' };
      off();
      return;
    }
    unlisten = off;
    registrationState = { kind: 'registered' };
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
      foregroundOff.push(
        foreground.subscribe(
          /**
           * Asks for a drain because the window came forward.
           *
           * @returns Nothing; the pump is what answers.
           */
          function onForeground(): void {
            requestDrain('foreground');
          }
        )
      );
      if (requested && drainMayStart()) {
        // Anything recorded before the lifecycle began — an `open()` that reached
        // `ready` first — is flushed here, in arrival order. Not, however, an
        // `open()` still loading, and what that rests on is the predicate rather
        // than any call order in a host: `drainMayStart()` is the question being
        // asked, so a host that announced an open through `workspaceOpened()` and
        // has not reported `ready` reaches this line with the gate already closed,
        // and the flush is `workspaceReady()`'s.
        //
        // **No production code calls `start()` at all today.** `BrowserState.start()`
        // in `./workspace.svelte.ts` is its only wrapper and nothing invokes that
        // wrapper either; wiring it to a host's `onMount` is 2d-5-7's business. This
        // comment is aimed at that author, so it states the gate and not a call
        // order this repository does not yet contain.
        ensurePumping();
      }
    }, // End of function start()

    dispose(): void {
      if (disposed) {
        return;
      }
      disposed = true;
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

    workspaceOpened(): void {
      // **Everything learned about the workspace being closed goes.** The epoch
      // is a property of that lifecycle, the watermark indexes its queue, and
      // `lastDiscarded` is cumulative *within* the epoch — carrying any of them
      // into the next open would compare a new lifecycle's numbers with an old
      // one's. The consult's Q2 step 1 names a fourth thing to clear, the
      // accepted-sequence map; **that map is 2d-5-4's and does not exist yet**, so
      // this function will gain a line there rather than having one that pretends
      // now.
      adopted = false;
      epoch = 0;
      watermark = 0;
      lastDiscarded = 0;
      discardedNoticeCount = 0;
      observationsDroppedCount = 0;
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
    }, // End of function workspaceOpened()

    workspaceReady(): void {
      // The gate opens first, so the request below is the flush rather than one
      // more thing held behind it — together with every reason recorded while it
      // was closed, which the pump answers in arrival order.
      openInProgress = false;
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

    isDisposed(): boolean {
      return disposed;
    },

    isPumping(): boolean {
      return inFlight !== null;
    }
  };
} // End of function createReconciliationCoordinator()
