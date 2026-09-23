/**
 * What the window draws about reconciliation, decided as values — Phase 2d-6-9a.
 *
 * The 2d-6 record (`docs/decisions/2d-6-split-notes.md` §2, the orchestrator's cut
 * of 2d-6-9) splits the step into the decisions and their words (this module and
 * its keys), the rendering (2d-6-9b) and the window reading (2d-6-9c). **No
 * component reads this module yet**; 2d-6-9b draws it. Its keys are reachable
 * through `describeReconciliation*` in `../i18n/codes.ts` and the `tReconciliation*`
 * wrappers in `../i18n/index.ts`, which is why it is in the production bundle
 * before anything draws it — a code with no string is worse than a code with no
 * caller.
 *
 * ## The ten states and the five controls
 *
 * The record's §2 entry for 2d-6-9 names ten drawn states and five controls, and
 * its §3 entry 27 gives each state a place:
 *
 * - **Per file** ({@link FileReconciliationState}): `stale`, `unavailable` and
 *   `removed` — the three arms of `ExternalDocumentStatus` in
 *   `./observationTransitions.ts` — and `observationRetained` (the *held
 *   observation*) and `writeOutcomeUnknown` (the *uncertain write*).
 * - **Per workspace** ({@link WorkspaceReconciliationState}): `pathDrift`,
 *   `notWatched`, `registrationFailed`, `lostHistory` and
 *   `membershipReloadWanted`.
 * - **Controls** ({@link ReconciliationControl}): `membershipReload`,
 *   `lostHistoryRecovery`, `staleFileReread`, `retryRetainedObservation` and
 *   `acknowledgeUncertainty`, each decided as offered or not and, when offered,
 *   enabled or disabled with the {@link ReconciliationRefusal} the press would
 *   answer.
 *
 * ## Only what the frontend can observe
 *
 * The record's §5.4 and entry 26: *watcher degradation* here means no lifecycle
 * adopted, a failed subscription, lost history and observations the window cannot
 * safely apply. **This module cannot say that native observation fell back to
 * polling, and says nothing about it** — no command carries that state, and the
 * eighteenth command that would is deferred to an unnamed observability phase
 * (§6 item 6). Every input below is answered by a `BrowserState` reader in
 * `./workspace.svelte.ts`; {@link workspaceFactsOf} and {@link fileFactsOf} are the
 * two adapters that ask them.
 *
 * ## What a decision is, and what it cannot make true
 *
 * A decision is a function of the facts it is handed, taken in one synchronous
 * call. **It cannot make those facts current**: the facts are a snapshot of
 * readers whose tables move, and the `BrowserState` request each control calls
 * rechecks every guard at the press (entries 29 and 32) — so an *enabled* control
 * is a prediction the press may still refuse, and a renderer draws that refusal
 * through {@link ReconciliationRefusal}'s sentence. Where a guard cannot be
 * predicted from any public reader (the coordinator's disposal; the
 * acknowledgement's `projectionReplaced` and `holdMoved`), the decision does not
 * pretend to: the control stays enabled and the press answers.
 *
 * ## What this module is not
 *
 * It holds no state, registers nothing, installs nothing, calls no command and
 * starts no reread; nothing exported here is a transition. The five controls call
 * `requestMembershipReload`, `requestLostHistoryRecovery`, `requestFileReread`,
 * `retryRetainedObservation` and `uncertaintyAcknowledgementFor` /
 * `acknowledgeWriteUncertainty` on `BrowserState`, and 2d-6-9b wires them.
 */

import type { TranslationKey } from '../i18n/dictionaries';
import type { DocumentId, UnreadableReason } from '../ipc/types';
import type { AutomaticReloadRefusal } from './observationDelivery';
import type { ExternalDocumentStatus, ExternalPathDrift, ObservationDetail } from './observationTransitions';
import type { ReconciliationBlock, ReconciliationWatchState } from './reconciliationCoordinator';
import type { OpenWriteSurfaceKind } from './restore';
import type {
  BrowserState,
  BrowserStatus,
  FileRereadOutcome,
  ReconciliationRegistrationState,
  RegistrationFailureReason,
  RetainedRetryOutcome,
  UncertaintyAcknowledgementEligibility,
  UncertaintyAcknowledgementOutcome,
  WorkspaceReloadOutcome
} from './workspace.svelte';

// ---------------------------------------------------------------------------
// The facts a decision is taken over
// ---------------------------------------------------------------------------

/**
 * The workspace-wide facts one decision is taken over, as values.
 *
 * **Plain data on purpose**: a model test builds one by hand, and
 * {@link workspaceFactsOf} is the one adapter that fills it from a live
 * `BrowserState`. Nothing in TypeScript stops a caller filling it from somewhere
 * else; the adapter is the honest source.
 */
export interface WorkspaceReconciliationFacts {
  /** Where the load has got to (`BrowserState.status`). */
  readonly status: BrowserStatus;
  /** Whether a load failure is held (`BrowserState.failure !== null`). */
  readonly failed: boolean;
  /** How many rows the workspace lists (`BrowserState.documents.length`). */
  readonly documentCount: number;
  /** The kind of every registered write surface, in the registry's order. */
  readonly openSurfaces: readonly OpenWriteSurfaceKind[];
  /**
   * Whether a write this window started is in flight for any file it can name.
   *
   * **A floor, not the whole answer**: {@link workspaceFactsOf} asks
   * `BrowserState.writeInFlight` for every listed row and every surface's target,
   * and no public reader enumerates writes to a file neither lists nor targets.
   * The reload requests recheck the outstanding writes themselves at the press.
   */
  readonly writeInFlight: boolean;
  /** `BrowserState.reconciliationWatchState()`. */
  readonly watch: ReconciliationWatchState;
  /** `BrowserState.reconciliationRegistration()`. */
  readonly registration: ReconciliationRegistrationState;
  /** `BrowserState.reconciliationBlock()`. */
  readonly block: ReconciliationBlock;
  /** `BrowserState.membershipReloadWanted()`. */
  readonly membershipReloadWanted: boolean;
  /** `BrowserState.externalPathDrift()`. */
  readonly pathDrift: readonly ExternalPathDrift[];
}

/**
 * The per-file facts one decision is taken over, as values.
 *
 * Filled by {@link fileFactsOf} from `BrowserState` readers; the three hold facts
 * are `automaticReloadGuardFor`'s, read in its one synchronous block.
 */
export interface FileReconciliationFacts {
  /** Whether the workspace lists a row for the file. */
  readonly hasRow: boolean;
  /** `BrowserState.externalDocumentStatus(document)`. */
  readonly status: ExternalDocumentStatus | null;
  /** Whether the barrier holds an observation for the file. */
  readonly observationRetained: boolean;
  /** Whether the file is under an unresolved uncertainty hold. */
  readonly uncertaintyUnresolved: boolean;
  /** Whether a registered write surface targets the file. */
  readonly surfaceOpen: boolean;
  /** Whether a write this window started is in flight for the file. */
  readonly writeInFlight: boolean;
  /**
   * Whether an acknowledgement could be minted against the origin standing for
   * the file — `BrowserState.uncertaintyAcknowledgementEligibility(document)`, the
   * mint's own guards answered without minting (Phase 2d-6-9a's review, finding
   * 2). The standing origin is the snapshot an acknowledgement is bound to
   * (entry 14).
   */
  readonly acknowledgement: UncertaintyAcknowledgementEligibility;
}

// ---------------------------------------------------------------------------
// The states
// ---------------------------------------------------------------------------

/**
 * One workspace-level state, drawn as a banner (entry 27).
 *
 * **`notObserved` is not here, deliberately**: before the first accepted batch the
 * window knows nothing about coverage either way, and calling it *not watched*
 * would claim an absence nothing observed. `registering`, `registered`, `idle` and
 * `abandoned` registrations are not drawn for the same reason — none of them is a
 * restriction a person can act on.
 */
export type WorkspaceReconciliationState =
  | {
      /** A path this window holds no identity for was observed. */
      readonly kind: 'pathDrift';
      /** The display path. Lossy, and never a command argument (entry 39). */
      readonly relativePath: string;
      /** What was observed of it. */
      readonly detail: ObservationDetail;
    }
  | {
      /** The adopted epoch is `0`: no worker watches this workspace. */
      readonly kind: 'notWatched';
    }
  | {
      /** Subscribing to the wake notification failed. */
      readonly kind: 'registrationFailed';
      /** Which kind of refusal, as `BrowserState` sanitized it. */
      readonly reason: RegistrationFailureReason;
    }
  | {
      /** A hole in this epoch's history suspended incremental reconciliation. */
      readonly kind: 'lostHistory';
    }
  | {
      /** An observation asked for the file list to be reloaded. */
      readonly kind: 'membershipReloadWanted';
    };

/**
 * One per-file state.
 *
 * The first three are `ExternalDocumentStatus`'s arms; the last two are the held
 * observation and the uncertain write of entry 27, which are facts of the window's
 * own tables rather than statuses.
 */
export type FileReconciliationState =
  | {
      /** What the window shows of the file has not been reconciled. */
      readonly kind: 'stale';
    }
  | {
      /** The engine reported the bytes unreadable; the last projection is kept. */
      readonly kind: 'unavailable';
      /** Why, drawn through `tUnreadableReason` beside the state's sentence. */
      readonly reason: UnreadableReason;
    }
  | {
      /** The file is no longer present in the observed workspace. */
      readonly kind: 'removed';
    }
  | {
      /** An observation for the file is held and unchecked. */
      readonly kind: 'observationRetained';
    }
  | {
      /** The last settled write's outcome is unknown and unacknowledged. */
      readonly kind: 'writeOutcomeUnknown';
    };

/**
 * Where one per-file state is drawn (entry 27).
 *
 * - `sidebarRow` — the file's row; never for `removed`, which has none and for
 *   which no row is invented.
 * - `header` — the affected detail or surface header.
 * - `selectionNotice` — `removed` alone, beside the header.
 * - `surface` — the held observation or uncertain write on the surface over the
 *   file.
 * - `workspaceRoute` — the same two once no surface over the file is open, so the
 *   state stays reachable per file and never depends on a mounted panel
 *   (entry 15).
 */
export type FileStatePlacement =
  | 'sidebarRow'
  | 'header'
  | 'selectionNotice'
  | 'surface'
  | 'workspaceRoute';

/** One per-file state and every place it is drawn. */
export interface FileStateDecision {
  /** The state. */
  readonly state: FileReconciliationState;
  /** Where it is drawn, in a fixed order; never empty. */
  readonly placements: readonly FileStatePlacement[];
}

// ---------------------------------------------------------------------------
// The controls
// ---------------------------------------------------------------------------

/** The five controls of the 2d-6-9 entry. */
export type ReconciliationControl =
  /** `BrowserState.requestMembershipReload()`. */
  | 'membershipReload'
  /** `BrowserState.requestLostHistoryRecovery()`. */
  | 'lostHistoryRecovery'
  /** `BrowserState.requestFileReread(document)`. */
  | 'staleFileReread'
  /** `BrowserState.retryRetainedObservation(document)`. */
  | 'retryRetainedObservation'
  /** `uncertaintyAcknowledgementFor(source)` then `acknowledgeWriteUncertainty`. */
  | 'acknowledgeUncertainty';

/**
 * Why a control is disabled, or why a press was refused — one code set for both,
 * so the sentence a disabled control shows is the sentence its press would get.
 *
 * The union of the refusals the five `BrowserState` members answer:
 * `WorkspaceReloadOutcome`'s five, `FileRereadRefusalReason`'s eight,
 * `RetainedRetryOutcome`'s two non-attempts and
 * `UncertaintyAcknowledgementRefusal`'s seven, with the shared ones named once.
 */
export type ReconciliationRefusal =
  | 'disposed'
  | 'workspaceNotReady'
  | 'writeInFlight'
  | 'surfaceOpen'
  | 'notBlocked'
  | 'notAddressable'
  | 'blockedByLostHistory'
  | 'uncertaintyUnresolved'
  | 'observationRetained'
  | 'nothingRetained'
  | 'unknown'
  | 'spent'
  | 'workspaceReplaced'
  | 'superseded'
  | 'projectionReplaced'
  | 'holdMoved';

/** One offered control, enabled or disabled with the refusal a press would get. */
export type ControlDecision =
  | {
      /** Which control. */
      readonly control: ReconciliationControl;
      /** Pressing it is predicted to be accepted; the press still rechecks. */
      readonly enabled: true;
    }
  | {
      /** Which control. */
      readonly control: ReconciliationControl;
      /** Drawn and not pressable. */
      readonly enabled: false;
      /** The first guard that would refuse, in the request's own order. */
      readonly reason: ReconciliationRefusal;
    };

/** What the window draws about the workspace as a whole. */
export interface WorkspaceReconciliationDecision {
  /** The banners, in a fixed order: drift entries, then the four flags. */
  readonly states: readonly WorkspaceReconciliationState[];
  /** The workspace controls offered; each at most once. */
  readonly controls: readonly ControlDecision[];
}

/** What the window draws about one file. */
export interface FileReconciliationDecision {
  /** The states, in a fixed order: status first, then held, then uncertain. */
  readonly states: readonly FileStateDecision[];
  /** The per-file controls offered; each at most once. */
  readonly controls: readonly ControlDecision[];
}

// ---------------------------------------------------------------------------
// The shell composition — empty-workspace retention
// ---------------------------------------------------------------------------

/**
 * Which composition the shell draws.
 *
 * `empty` replaces the panes; `panes` mounts `Sidebar`, `SnippetList` and
 * `DetailPane`. The workspace banners are drawn in both (see
 * {@link workspaceBannersDrawnIn}).
 */
export type ShellComposition = 'loading' | 'failed' | 'empty' | 'panes';

/**
 * Which composition the shell draws — the record's §3 entry 31 and §5.2 as a
 * value.
 *
 * **An empty list does not unmount a surface that is still open.** The panes stay
 * while any write surface is registered, even over an empty document list, and
 * give way to the empty state once the last one closes — closing it permits the
 * change and a renderer re-deriving is what performs it. 2d-6-6b delivered the rule
 * inline in `AppShell.svelte`; this is the same condition as a value, so a model
 * test pins it, and 2d-6-9b makes the shell draw from it rather than keep a second
 * copy (§6 item 13: re-asserted, not re-implemented).
 *
 * **What it cannot keep** is a surface its host has not registered yet — the pane
 * registers from an effect — and nothing in TypeScript ties `openSurfaceCount` to
 * the registry rather than to some other list; the adapter reads
 * `BrowserState.openWriteSurfaces()`.
 *
 * @param facts - The load state, the row count and the registered surfaces.
 * @returns The composition to draw.
 */
export function decideShellComposition(
  facts: Pick<WorkspaceReconciliationFacts, 'status' | 'failed' | 'documentCount' | 'openSurfaces'>
): ShellComposition {
  if (facts.status === 'loading') {
    return 'loading';
  }
  if (facts.status === 'failed' && facts.failed) {
    return 'failed';
  }
  if (facts.documentCount === 0 && facts.openSurfaces.length === 0) {
    return 'empty';
  }
  return 'panes';
} // End of function decideShellComposition()

/**
 * Whether the workspace banners are drawn in one composition.
 *
 * **In `empty` as well as `panes`**, and that is the retention half a banner
 * needs: the last row disappearing — the removal that also asks for a membership
 * reload — must not take the banner and its reload control with the panes, or the
 * person is left with an empty window and no way to ask. Not in `loading` or
 * `failed`, whose own screens say what the window is doing.
 *
 * @param composition - What the shell draws.
 * @returns Whether the banners are drawn beside it.
 */
export function workspaceBannersDrawnIn(composition: ShellComposition): boolean {
  return composition === 'empty' || composition === 'panes';
} // End of function workspaceBannersDrawnIn()

// ---------------------------------------------------------------------------
// The decisions
// ---------------------------------------------------------------------------

/**
 * The first guard a workspace reload request would refuse on, predicted.
 *
 * `requestMembershipReload`'s order in `./workspace.svelte.ts` less its first
 * question: the coordinator's disposal has no public reader, and a disposed state
 * is one whose shell has unmounted, so the press is what answers it.
 *
 * @param facts - The workspace facts.
 * @returns The refusal, or `null` when every predictable guard permits.
 */
function reloadRefusal(facts: WorkspaceReconciliationFacts): ReconciliationRefusal | null {
  if (facts.status !== 'ready') {
    return 'workspaceNotReady';
  }
  if (facts.writeInFlight) {
    return 'writeInFlight';
  }
  if (facts.openSurfaces.length > 0) {
    return 'surfaceOpen';
  }
  return null;
} // End of function reloadRefusal()

/**
 * A control decision from a predicted refusal.
 *
 * @param control - Which control.
 * @param refusal - The predicted refusal, or `null`.
 * @returns The decision, frozen.
 */
function controlOf(
  control: ReconciliationControl,
  refusal: ReconciliationRefusal | null
): ControlDecision {
  return refusal === null
    ? Object.freeze({ control, enabled: true as const })
    : Object.freeze({ control, enabled: false as const, reason: refusal });
} // End of function controlOf()

/**
 * What the window draws about the workspace as a whole.
 *
 * **Five banners, each from one reader** (entry 27): one `pathDrift` per drift
 * entry, in the reader's order; `notWatched` when the adopted epoch is `0`;
 * `registrationFailed` with its sanitized reason; `lostHistory` while the session
 * is `blockedByLostHistory`; `membershipReloadWanted` while the flag stands.
 *
 * **Two controls, separate intents** (entry 29): the membership reload is offered
 * while an observation has asked for one, and the lost-history recovery while the
 * session is blocked. Both are disabled, never hidden, by the request's own
 * refusals in its order — not ready, a write in flight, an open surface — and an
 * open surface's refusal is the one the person can act on. **Closing the last
 * surface permits and does not trigger**: this decision re-derives to enabled and
 * nothing here presses anything. What it does not offer is a membership reload
 * nobody asked for: `requestMembershipReload` permits one, and a control for it
 * outside these banners is 2d-6-9b's to decide, not a status.
 *
 * @param facts - The workspace facts, read in one block.
 * @returns The banners and the controls, frozen.
 */
export function decideWorkspaceReconciliation(
  facts: WorkspaceReconciliationFacts
): WorkspaceReconciliationDecision {
  const states: WorkspaceReconciliationState[] = [];
  for (const drift of facts.pathDrift) {
    states.push(
      Object.freeze({ kind: 'pathDrift', relativePath: drift.relativePath, detail: drift.detail })
    );
  }
  if (facts.watch.kind === 'notWatched') {
    states.push(Object.freeze({ kind: 'notWatched' }));
  }
  if (facts.registration.kind === 'failed') {
    states.push(Object.freeze({ kind: 'registrationFailed', reason: facts.registration.reason }));
  }
  const blocked = facts.block.kind === 'blockedByLostHistory';
  if (blocked) {
    states.push(Object.freeze({ kind: 'lostHistory' }));
  }
  if (facts.membershipReloadWanted) {
    states.push(Object.freeze({ kind: 'membershipReloadWanted' }));
  }
  const controls: ControlDecision[] = [];
  const refusal = reloadRefusal(facts);
  if (facts.membershipReloadWanted) {
    controls.push(controlOf('membershipReload', refusal));
  }
  if (blocked) {
    controls.push(controlOf('lostHistoryRecovery', refusal));
  }
  return Object.freeze({ states: Object.freeze(states), controls: Object.freeze(controls) });
} // End of function decideWorkspaceReconciliation()

/**
 * The first guard `requestFileReread` would refuse on at the request, predicted.
 *
 * Its order in `./workspace.svelte.ts`: the open gate, an addressable row, the
 * lost-history block, then `decideAutomaticReload`'s three in its own order, then
 * the write barrier. Disposal is not predicted, for {@link reloadRefusal}'s reason;
 * a row the open workspace does not resolve is not predicted either — no public
 * reader says so — and the press answers `notAddressable` for it.
 *
 * @param workspace - The workspace facts.
 * @param file - The file's facts.
 * @returns The refusal, or `null` when every predictable guard permits.
 */
function rereadRefusal(
  workspace: Pick<WorkspaceReconciliationFacts, 'status' | 'block'>,
  file: FileReconciliationFacts
): ReconciliationRefusal | null {
  if (workspace.status !== 'ready') {
    return 'workspaceNotReady';
  }
  if (!file.hasRow) {
    return 'notAddressable';
  }
  if (workspace.block.kind === 'blockedByLostHistory') {
    return 'blockedByLostHistory';
  }
  const hold: AutomaticReloadRefusal | null = file.uncertaintyUnresolved
    ? 'uncertaintyUnresolved'
    : file.observationRetained
      ? 'observationRetained'
      : file.surfaceOpen
        ? 'surfaceOpen'
        : null;
  if (hold !== null) {
    return hold;
  }
  if (file.writeInFlight) {
    return 'writeInFlight';
  }
  return null;
} // End of function rereadRefusal()

/**
 * What the window draws about one file.
 *
 * **States** (entry 27): a `stale` or `unavailable` status in the file's sidebar
 * row — when it has one — and the affected header; a `removed` status in the
 * header and the selection notice and never a row; a held observation and an
 * uncertain write on the surface over the file while one is open, and on the
 * workspace route once none is, so neither depends on a mounted panel.
 *
 * **Controls**:
 *
 * - `staleFileReread` is offered while the file is `stale` **and no surface over
 *   it is open** — entry 32's *a `stale` file whose surface has closed*; with a
 *   surface open, the surface's own conflict is the route. Disabled by the
 *   request's guards in its order.
 * - `retryRetainedObservation` is offered while an observation is held, wherever
 *   the state is drawn, and disabled only by a write in flight (entry 16) — the one
 *   refusal the retry itself answers besides `nothingRetained`, which an offered
 *   control cannot meet.
 * - `acknowledgeUncertainty` is offered while the hold stands **and a conflict
 *   origin stands for the file** — the acknowledgement is bound to a reviewed
 *   snapshot (entry 14, orchestrator ruling (2)), so with none there is nothing to
 *   acknowledge and no control. It is enabled exactly when the mint's own guards
 *   permit (`uncertaintyAcknowledgementEligibility`, the review's finding 2) and
 *   disabled with `writeInFlight` or `projectionReplaced` otherwise. What is still
 *   not predicted is the spend's refusal about a token — `holdMoved` after a later
 *   hold, `spent` — which the press answers.
 *   **Which snapshot a renderer draws beside the control is the renderer's rule**:
 *   on the workspace route it must draw the standing origin's disk text, or the
 *   press acknowledges a snapshot nobody was shown — nothing here can check that.
 *
 * @param workspace - The workspace facts the reread guard also asks.
 * @param file - The file's facts, read in one block.
 * @returns The states and the controls, frozen.
 */
export function decideFileReconciliation(
  workspace: Pick<WorkspaceReconciliationFacts, 'status' | 'block'>,
  file: FileReconciliationFacts
): FileReconciliationDecision {
  const states: FileStateDecision[] = [];
  const controls: ControlDecision[] = [];
  const status = file.status;
  if (status !== null) {
    switch (status.kind) {
      case 'stale':
        states.push(stateOf({ kind: 'stale' }, file.hasRow ? ['sidebarRow', 'header'] : ['header']));
        if (!file.surfaceOpen) {
          controls.push(controlOf('staleFileReread', rereadRefusal(workspace, file)));
        }
        break;
      case 'unavailable':
        states.push(
          stateOf(
            { kind: 'unavailable', reason: status.reason },
            file.hasRow ? ['sidebarRow', 'header'] : ['header']
          )
        );
        break;
      case 'removed':
        states.push(stateOf({ kind: 'removed' }, ['header', 'selectionNotice']));
        break;
      default: {
        const unreachable: never = status;
        return unreachable;
      }
    }
  } // End of the branch over the file's external status
  const held: FileStatePlacement = file.surfaceOpen ? 'surface' : 'workspaceRoute';
  if (file.observationRetained) {
    states.push(stateOf({ kind: 'observationRetained' }, [held]));
    controls.push(
      controlOf('retryRetainedObservation', file.writeInFlight ? 'writeInFlight' : null)
    );
  }
  if (file.uncertaintyUnresolved) {
    states.push(stateOf({ kind: 'writeOutcomeUnknown' }, [held]));
    const eligibility = file.acknowledgement;
    if (eligibility.kind === 'eligible') {
      controls.push(controlOf('acknowledgeUncertainty', null));
    } else if (
      eligibility.reason === 'writeInFlight' ||
      eligibility.reason === 'projectionReplaced'
    ) {
      controls.push(controlOf('acknowledgeUncertainty', eligibility.reason));
    }
    // `noHold` and `noStandingOrigin`: nothing to acknowledge, so no control.
  } // End of the branch over an uncertainty hold
  return Object.freeze({ states: Object.freeze(states), controls: Object.freeze(controls) });
} // End of function decideFileReconciliation()

/**
 * One frozen state decision.
 *
 * @param state - The state.
 * @param placements - Where it is drawn.
 * @returns The decision.
 */
function stateOf(
  state: FileReconciliationState,
  placements: readonly FileStatePlacement[]
): FileStateDecision {
  return Object.freeze({ state: Object.freeze(state), placements: Object.freeze([...placements]) });
} // End of function stateOf()

// ---------------------------------------------------------------------------
// What a press answered, as a refusal code
// ---------------------------------------------------------------------------

/**
 * The refusal a workspace reload request answered, or `null` when it reloaded.
 *
 * @param outcome - What `requestMembershipReload` or `requestLostHistoryRecovery`
 *   answered.
 * @returns The refusal to draw, or `null`.
 */
export function reloadRefusalOf(outcome: WorkspaceReloadOutcome): ReconciliationRefusal | null {
  return outcome.kind === 'reloading' ? null : outcome.reason;
} // End of function reloadRefusalOf()

/**
 * The refusal a guarded reread answered, or `null` when it did not refuse.
 *
 * `failed` is not a refusal: the command's own failure is drawn through
 * `tIpcFailure`, as every read failure is. A refusal `at: 'installation'` has the
 * same code as one at the request — the guard that moved while the read was out.
 *
 * @param outcome - What `requestFileReread` answered.
 * @returns The refusal to draw, or `null`.
 */
export function rereadRefusalOf(outcome: FileRereadOutcome): ReconciliationRefusal | null {
  return outcome.kind === 'refused' ? outcome.reason : null;
} // End of function rereadRefusalOf()

/**
 * The refusal a retry answered, or `null` when one arbitration ran.
 *
 * An `attempted` retry may have answered `retained` again — the tables moved under
 * it — and that is not a refusal: the state stays drawn and the control stays
 * askable (entry 16).
 *
 * @param outcome - What `retryRetainedObservation` answered.
 * @returns The refusal to draw, or `null`.
 */
export function retryRefusalOf(outcome: RetainedRetryOutcome): ReconciliationRefusal | null {
  return outcome.kind === 'attempted' ? null : outcome.kind;
} // End of function retryRefusalOf()

/**
 * The refusal an acknowledgement answered, or `null` when the hold ended.
 *
 * @param outcome - What `acknowledgeWriteUncertainty` answered.
 * @returns The refusal to draw, or `null`.
 */
export function acknowledgementRefusalOf(
  outcome: UncertaintyAcknowledgementOutcome
): ReconciliationRefusal | null {
  return outcome.kind === 'acknowledged' ? null : outcome.reason;
} // End of function acknowledgementRefusalOf()

// ---------------------------------------------------------------------------
// The adapters over BrowserState
// ---------------------------------------------------------------------------

/** The `BrowserState` readers the two adapters ask, and nothing else. */
export type ReconciliationStatusReader = Pick<
  BrowserState,
  | 'status'
  | 'failure'
  | 'documents'
  | 'openWriteSurfaces'
  | 'writeInFlight'
  | 'reconciliationWatchState'
  | 'reconciliationRegistration'
  | 'reconciliationBlock'
  | 'membershipReloadWanted'
  | 'externalPathDrift'
  | 'externalDocumentStatus'
  | 'automaticReloadGuardFor'
  | 'uncertaintyAcknowledgementEligibility'
>;

/**
 * Every file one window can say something about: each listed row, then each file a
 * registered surface targets that no row names — a removed file's surface keeps
 * its state reachable (entry 30). Without repetition, rows first.
 *
 * **What it cannot list** is a file with a held observation or an uncertainty hold
 * that neither a row nor a surface names: no public reader enumerates those
 * tables. 2d-6-9a records it for 2d-6-9b.
 *
 * @param browser - The readers.
 * @returns The files, in that order.
 */
export function filesToDecide(
  browser: Pick<ReconciliationStatusReader, 'documents' | 'openWriteSurfaces'>
): readonly DocumentId[] {
  const seen = new Set<DocumentId>();
  const files: DocumentId[] = [];
  for (const row of browser.documents) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      files.push(row.id);
    }
  }
  for (const surface of browser.openWriteSurfaces()) {
    const target = surface.target;
    if (target.kind === 'document' && !seen.has(target.document)) {
      seen.add(target.document);
      files.push(target.document);
    }
  } // End of the loop over the registered surfaces
  return Object.freeze(files);
} // End of function filesToDecide()

/**
 * The workspace facts, asked of a live `BrowserState` in one synchronous block.
 *
 * Each reader subscribes a derivation to `reconciliationRevision()` or to the
 * registry's mirror on its own, so a `$derived` over this re-runs on every
 * announced transition. It moves nothing.
 *
 * @param browser - The readers.
 * @returns The facts.
 */
export function workspaceFactsOf(browser: ReconciliationStatusReader): WorkspaceReconciliationFacts {
  const surfaces = browser.openWriteSurfaces();
  const writeInFlight = filesToDecide(browser).some((document) => browser.writeInFlight(document));
  return Object.freeze({
    status: browser.status,
    failed: browser.failure !== null,
    documentCount: browser.documents.length,
    openSurfaces: Object.freeze(surfaces.map((surface) => surface.kind)),
    writeInFlight,
    watch: browser.reconciliationWatchState(),
    registration: browser.reconciliationRegistration(),
    block: browser.reconciliationBlock(),
    membershipReloadWanted: browser.membershipReloadWanted(),
    pathDrift: browser.externalPathDrift()
  });
} // End of function workspaceFactsOf()

/**
 * One file's facts, asked of a live `BrowserState` in one synchronous block.
 *
 * @param browser - The readers.
 * @param document - The file.
 * @returns The facts.
 */
export function fileFactsOf(
  browser: ReconciliationStatusReader,
  document: DocumentId
): FileReconciliationFacts {
  const guard = browser.automaticReloadGuardFor(document);
  return Object.freeze({
    hasRow: browser.documents.some((row) => row.id === document),
    status: browser.externalDocumentStatus(document),
    observationRetained: guard.observationRetained,
    uncertaintyUnresolved: guard.uncertaintyUnresolved,
    surfaceOpen: guard.surfaceOpen,
    writeInFlight: browser.writeInFlight(document),
    acknowledgement: browser.uncertaintyAcknowledgementEligibility(document)
  });
} // End of function fileFactsOf()

// ---------------------------------------------------------------------------
// The keys
// ---------------------------------------------------------------------------

/**
 * The dictionary key holding one workspace banner's sentence.
 *
 * `pathDrift` has one sentence per observed detail and takes the display path as
 * its `{path}` operand; an `unreadable` detail's reason is drawn beside it through
 * `tUnreadableReason`. A failed registration has one sentence per sanitized reason.
 * Keys under `browser.externalDocument.*` and `browser.reconciliation.*`
 * (entry 39); exhaustive, so a new arm is a compile error here.
 *
 * @param state - The banner.
 * @returns The key holding its sentence.
 */
export function workspaceReconciliationStateKey(state: WorkspaceReconciliationState): TranslationKey {
  switch (state.kind) {
    case 'pathDrift':
      switch (state.detail.kind) {
        case 'changed':
          return 'browser.externalDocument.pathDrift.changed';
        case 'removed':
          return 'browser.externalDocument.pathDrift.removed';
        case 'unreadable':
          return 'browser.externalDocument.pathDrift.unreadable';
        default: {
          const unreachable: never = state.detail;
          return unreachable;
        }
      }
    case 'notWatched':
      return 'browser.reconciliation.notWatched';
    case 'registrationFailed':
      switch (state.reason) {
        case 'noTransport':
          return 'browser.reconciliation.registrationFailed.noTransport';
        case 'rejected':
          return 'browser.reconciliation.registrationFailed.rejected';
        default: {
          const unreachable: never = state.reason;
          return unreachable;
        }
      }
    case 'lostHistory':
      return 'browser.reconciliation.lostHistory';
    case 'membershipReloadWanted':
      return 'browser.reconciliation.membershipReloadWanted';
    default: {
      const unreachable: never = state;
      return unreachable;
    }
  }
} // End of function workspaceReconciliationStateKey()

/**
 * The dictionary key holding one per-file state's sentence at one placement.
 *
 * **The placement matters for one state only.** On a surface the held observation
 * and the uncertain write read as the surfaces already say them —
 * `browser.externalConflict.observationRetained` and `.writeOutcomeUnknown`, the
 * reviewed sentences of entries 13 and 14. On the workspace route the uncertain
 * write gets its own sentence, because the surface one says *reviewing this disk
 * snapshot* and a route with no snapshot drawn has none to review. The retained
 * sentence names no panel and reads the same in both places.
 *
 * @param state - The state.
 * @param placement - Where it is drawn.
 * @returns The key holding its sentence.
 */
export function fileReconciliationStateKey(
  state: FileReconciliationState,
  placement: FileStatePlacement
): TranslationKey {
  switch (state.kind) {
    case 'stale':
      return 'browser.externalDocument.stale';
    case 'unavailable':
      return 'browser.externalDocument.unavailable';
    case 'removed':
      return 'browser.externalDocument.removed';
    case 'observationRetained':
      return 'browser.externalConflict.observationRetained';
    case 'writeOutcomeUnknown':
      return placement === 'workspaceRoute'
        ? 'browser.externalConflict.route.writeOutcomeUnknown'
        : 'browser.externalConflict.writeOutcomeUnknown';
    default: {
      const unreachable: never = state;
      return unreachable;
    }
  }
} // End of function fileReconciliationStateKey()

/**
 * The dictionary key holding one control's label.
 *
 * The acknowledgement's label is the one 2d-6-1a reviewed with its sentence,
 * `browser.externalConflict.action.acknowledgeSnapshot`, so a surface and the
 * workspace route label the one exit alike.
 *
 * @param control - The control.
 * @returns The key holding its label.
 */
export function reconciliationControlKey(control: ReconciliationControl): TranslationKey {
  switch (control) {
    case 'membershipReload':
      return 'browser.reconciliation.action.membershipReload';
    case 'lostHistoryRecovery':
      return 'browser.reconciliation.action.lostHistoryRecovery';
    case 'staleFileReread':
      return 'browser.externalDocument.action.reread';
    case 'retryRetainedObservation':
      return 'browser.externalConflict.action.retry';
    case 'acknowledgeUncertainty':
      return 'browser.externalConflict.action.acknowledgeSnapshot';
    default: {
      const unreachable: never = control;
      return unreachable;
    }
  }
} // End of function reconciliationControlKey()

/**
 * The dictionary key holding one refusal's sentence.
 *
 * Literal keys, one per code, under `browser.reconciliation.refusal.*`; a switch
 * rather than a template so that a new code is a compile error here and never a
 * key built from a string.
 *
 * @param refusal - Why a control is disabled or a press was refused.
 * @returns The key holding its sentence.
 */
export function reconciliationRefusalKey(refusal: ReconciliationRefusal): TranslationKey {
  switch (refusal) {
    case 'disposed':
      return 'browser.reconciliation.refusal.disposed';
    case 'workspaceNotReady':
      return 'browser.reconciliation.refusal.workspaceNotReady';
    case 'writeInFlight':
      return 'browser.reconciliation.refusal.writeInFlight';
    case 'surfaceOpen':
      return 'browser.reconciliation.refusal.surfaceOpen';
    case 'notBlocked':
      return 'browser.reconciliation.refusal.notBlocked';
    case 'notAddressable':
      return 'browser.reconciliation.refusal.notAddressable';
    case 'blockedByLostHistory':
      return 'browser.reconciliation.refusal.blockedByLostHistory';
    case 'uncertaintyUnresolved':
      return 'browser.reconciliation.refusal.uncertaintyUnresolved';
    case 'observationRetained':
      return 'browser.reconciliation.refusal.observationRetained';
    case 'nothingRetained':
      return 'browser.reconciliation.refusal.nothingRetained';
    case 'unknown':
      return 'browser.reconciliation.refusal.unknown';
    case 'spent':
      return 'browser.reconciliation.refusal.spent';
    case 'workspaceReplaced':
      return 'browser.reconciliation.refusal.workspaceReplaced';
    case 'superseded':
      return 'browser.reconciliation.refusal.superseded';
    case 'projectionReplaced':
      return 'browser.reconciliation.refusal.projectionReplaced';
    case 'holdMoved':
      return 'browser.reconciliation.refusal.holdMoved';
    default: {
      const unreachable: never = refusal;
      return unreachable;
    }
  }
} // End of function reconciliationRefusalKey()
