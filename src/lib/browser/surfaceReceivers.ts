/**
 * Which receiver each authored write surface has reported, and over which files
 * the window delivers to it — Phase 2d-6-6b, the 2d-6 record's §3 entries 1, 2
 * and 3.
 *
 * ## What it is
 *
 * The **parent's binding record** the consult's Q1 rules: "put the receiver,
 * instance token and registry lease together in the parent's binding record".
 * A child component — `MatchEditor.svelte`, `MatchCreator.svelte`, the
 * `RecoveryPanel.svelte` either of them mounts, since Phase 2d-6-7a
 * `MatchDeleter.svelte`, `MatchMover.svelte` and `MatchDuplicator.svelte`, and
 * since Phase 2d-6-8a `RawEditor.svelte` and `RestorePane.svelte` — reports the
 * receiver that
 * applies an envelope to its own session through a required callback prop
 * ({@link BindObservationReceiver}); `DetailPane.svelte` hands that prop down,
 * keeps one {@link ReceiverRoster}, and asks it to follow the pane's exhaustive
 * write-surface assembly. The roster is what calls
 * `BrowserState.registerObservationReceiver`, once per (surface, file), and what
 * returns each registration when the surface closes, moves, or its component
 * is replaced.
 *
 * **All eight kinds receive.** The editor, the creator and the recovery form
 * since Phase 2d-6-6b, the three operation panels — the deleter, the mover and
 * the duplicator — since Phase 2d-6-7a, and the raw editor and restore since
 * Phase 2d-6-8a ({@link ReceivingSurfaceKind}).
 *
 * ## Instance-bound, by construction
 *
 * Every {@link bind} answers a fresh {@link SurfaceBinding} object, and the roster
 * holds **one binding per kind**: a later bind of the same kind displaces the
 * earlier one, returns every registration it held at once, and leaves its two
 * methods inert. So an old component's teardown cannot withdraw its
 * replacement's receiver, and a registration made for one instance delivers to
 * that instance's receiver and to no other — each registered closure names its
 * own binding and checks that it is still the live one before it calls through.
 * **What that forces is identity; what it cannot force** is that a child reports
 * at all, reports a receiver that applies the envelope to its session, or
 * withdraws on teardown — mounted tests establish those, as entry 1 says.
 *
 * ## Over which files
 *
 * A surface that names a file is registered over that file. A surface that names
 * **no** file — a new-snippet form or a recovery form before a destination is
 * chosen — is registered over **every creator-eligible file** the caller lists,
 * which is exactly the set `targetingSurfaceFor` in `./restore.ts` attributes an
 * unknown target to (its wildcard protection, the 2d-6-3 record's §2 item 2). The
 * list is the caller's answer and is not re-derived here; nothing in TypeScript
 * forces the caller to compute it with `creatorEligibilityOf`, and between one
 * reconciliation and the next a file that has just become eligible is not yet
 * registered — the same flush gap every registration in the pane already has.
 *
 * ## What this module is not
 *
 * It arbitrates nothing, installs nothing and calls no command: it forwards the
 * window's sealed envelope to one receiver. It is not reactive — a `.ts` module
 * with no runes — and reads no caller-controlled object except the two lists it
 * is handed, once per reconciliation.
 */

import type { DocumentId } from '../ipc/types';
import type { OpenWriteSurface, OpenWriteSurfaceKind, WriteSurfaceTarget } from './restore';
import type { ObservationReceiver, UnregisterObservationReceiver } from './workspace.svelte';

/**
 * The kinds whose receivers are reported and registered: the three authored
 * surfaces since Phase 2d-6-6b, the three operation panels since Phase 2d-6-7a,
 * the raw editor and restore since Phase 2d-6-8a — every `OpenWriteSurfaceKind`.
 *
 * **Written out rather than aliased to `OpenWriteSurfaceKind`**, so a ninth
 * surface kind is not a receiving kind until someone lists it here: the
 * exhaustive `switch` in {@link isReceivingKind} makes a ninth kind a compile
 * error there. What no type forces is that the list and the `switch` agree, or
 * that a kind listed here has a component that reports a receiver; the roster's
 * suite and the pane's mounted delivery cases pin both.
 */
export type ReceivingSurfaceKind = Extract<
  OpenWriteSurfaceKind,
  | 'matchEditor'
  | 'matchCreator'
  | 'recovery'
  | 'matchDeleter'
  | 'matchMover'
  | 'matchDuplicator'
  | 'rawEditor'
  | 'restore'
>;

/**
 * One reported receiver, as its component holds it.
 *
 * **Both methods are inert once the binding is displaced or withdrawn**, which is
 * what makes cleanup instance-bound: nothing a displaced component calls can
 * reach the registration or the target its replacement reported.
 */
export interface SurfaceBinding {
  /**
   * Reports which file the surface would write now, or that none is open.
   *
   * Used by the recovery form, whose form opens and closes inside its panel and
   * whose destination only it knows. The editor, the creator, the three
   * operation panels, the raw editor and restore do not call it: the pane
   * already knows the file each of those is over, and the creator reports its
   * destination through its own `reportDestination` prop.
   *
   * @param target - The surface's target, or `null` when no surface is open.
   */
  readonly reportTarget: (target: WriteSurfaceTarget | null) => void;
  /**
   * Withdraws this binding: every registration it holds is returned and a
   * target it reported is cleared. One-shot and idempotent.
   */
  readonly withdraw: () => void;
}

/**
 * The required callback prop a receiving surface reports through.
 *
 * **Required, not optional** (entry 1): a host that mounts a receiving surface
 * cannot compile without handing one down. What the required prop forces is that
 * every host supplies it; nothing in TypeScript forces the child to call it, to
 * call it once, or to withdraw what it answered.
 *
 * @param receiver - What the surface is told, applied to its own session.
 * @returns The instance-bound binding.
 */
export type BindObservationReceiver = (receiver: ObservationReceiver) => SurfaceBinding;

/**
 * What the roster needs from the window.
 *
 * Two members, both narrow: the registration door, and where a reported target
 * lands so the pane's assembly can read it.
 */
export interface ReceiverRosterHost {
  /**
   * `BrowserState.registerObservationReceiver`.
   *
   * @param document - The file.
   * @param receiver - What is told about it.
   * @returns The one-shot, instance-bound unregister.
   */
  register(document: DocumentId, receiver: ObservationReceiver): UnregisterObservationReceiver;
  /**
   * Where a live binding's reported target lands — the pane's own state.
   *
   * @param kind - The surface kind.
   * @param target - The target, or `null` when none is open.
   */
  reportTarget(kind: ReceivingSurfaceKind, target: WriteSurfaceTarget | null): void;
}

/** The parent's binding record, kind by kind. */
export interface ReceiverRoster {
  /**
   * Binds one component instance's receiver for one kind, displacing any earlier
   * binding of that kind.
   *
   * The new binding is registered at once over the files the last
   * {@link reconcile} saw for its kind, so a component that replaces another
   * inside one flush is not left undelivered until the next.
   *
   * @param kind - The kind.
   * @param receiver - The component's receiver.
   * @returns The instance-bound binding.
   */
  bind(kind: ReceivingSurfaceKind, receiver: ObservationReceiver): SurfaceBinding;
  /**
   * Brings the window's receiver registrations into step with the open surfaces.
   *
   * @param surfaces - What the pane has open, every kind.
   * @param eligible - Every creator-eligible file, which a surface naming no file
   *   is registered over.
   */
  reconcile(surfaces: readonly OpenWriteSurface[], eligible: readonly DocumentId[]): void;
  /**
   * Whether a kind has a live binding.
   *
   * @param kind - Any surface kind.
   * @returns `true` when a receiver of that kind has been reported and not
   *   withdrawn or displaced.
   */
  receives(kind: OpenWriteSurfaceKind): boolean;
  /** Returns every registration and forgets every binding. */
  dispose(): void;
}

/** One live binding: its receiver and the registrations made for it, by file. */
interface LiveBinding {
  /** The binding the component holds. */
  readonly binding: SurfaceBinding;
  /** The component's receiver. */
  readonly receiver: ObservationReceiver;
  /** The window's unregister for each file this binding is registered over. */
  readonly registrations: Map<DocumentId, UnregisterObservationReceiver>;
}

/**
 * Whether a kind is one of the eight that receive — since Phase 2d-6-8a, every
 * one.
 *
 * **Exhaustive by construction**: the `switch` covers every
 * `OpenWriteSurfaceKind`, so a ninth kind is a compile error here rather than a
 * kind silently answered `false`. What it cannot force is that the answer for a
 * kind agrees with {@link ReceivingSurfaceKind}; the roster's suite pins both.
 *
 * @param kind - Any surface kind.
 * @returns The narrowing.
 */
function isReceivingKind(kind: OpenWriteSurfaceKind): kind is ReceivingSurfaceKind {
  switch (kind) {
    case 'matchEditor':
    case 'matchCreator':
    case 'recovery':
    case 'matchDeleter':
    case 'matchMover':
    case 'matchDuplicator':
    case 'rawEditor':
    case 'restore':
      return true;
    default: {
      const unreachable: never = kind;
      return unreachable;
    }
  }
} // End of function isReceivingKind()

/**
 * The files one surface is delivered about.
 *
 * @param target - The surface's target.
 * @param eligible - Every creator-eligible file.
 * @returns Its file, or every eligible file when it names none.
 */
function documentsFor(
  target: WriteSurfaceTarget,
  eligible: readonly DocumentId[]
): readonly DocumentId[] {
  switch (target.kind) {
    case 'document':
      return [target.document];
    case 'unknown':
      return eligible;
    default: {
      const unreachable: never = target;
      return unreachable;
    }
  }
} // End of function documentsFor()

/**
 * Builds an empty roster over one window.
 *
 * @param host - The registration door and the target sink.
 * @returns The roster.
 */
export function createReceiverRoster(host: ReceiverRosterHost): ReceiverRoster {
  const live = new Map<ReceivingSurfaceKind, LiveBinding>();
  // What the last reconciliation wanted, by kind: the files each open receiving
  // surface is delivered about. A new binding is registered over these at once.
  let wanted = new Map<ReceivingSurfaceKind, readonly DocumentId[]>();

  /**
   * Returns every registration one binding holds.
   *
   * @param held - The binding.
   */
  function unregisterAll(held: LiveBinding): void {
    for (const unregister of held.registrations.values()) {
      unregister();
    } // End of the loop over the binding's registrations
    held.registrations.clear();
  } // End of function unregisterAll()

  /**
   * Registers one binding over one file, through a closure naming that binding.
   *
   * @param kind - The kind it is live for.
   * @param held - The binding.
   * @param document - The file.
   */
  function registerOver(kind: ReceivingSurfaceKind, held: LiveBinding, document: DocumentId): void {
    held.registrations.set(
      document,
      host.register(document, (delivery) => {
        // **Instance-bound at the call as well as at the registration**: a
        // displaced binding's registrations are returned at displacement, and
        // this check is what still holds if one of them were ever left behind.
        if (live.get(kind) === held) {
          held.receiver(delivery);
        }
      })
    );
  } // End of function registerOver()

  /**
   * Makes one binding's registrations exactly the files wanted for its kind.
   *
   * @param kind - The kind.
   * @param held - Its live binding.
   * @param documents - The files it should be registered over.
   */
  function follow(
    kind: ReceivingSurfaceKind,
    held: LiveBinding,
    documents: readonly DocumentId[]
  ): void {
    const keep = new Set(documents);
    for (const [document, unregister] of [...held.registrations]) {
      if (!keep.has(document)) {
        unregister();
        held.registrations.delete(document);
      }
    } // End of the loop over the files this binding no longer covers
    for (const document of keep) {
      if (!held.registrations.has(document)) {
        registerOver(kind, held, document);
      }
    } // End of the loop over the files this binding now covers
  } // End of function follow()

  return {
    bind(kind: ReceivingSurfaceKind, receiver: ObservationReceiver): SurfaceBinding {
      const previous = live.get(kind);
      if (previous !== undefined) {
        unregisterAll(previous);
      }
      const binding: SurfaceBinding = {
        reportTarget: (target) => {
          if (live.get(kind)?.binding === binding) {
            host.reportTarget(kind, target);
          }
        },
        withdraw: () => {
          const held = live.get(kind);
          if (held === undefined || held.binding !== binding) {
            return;
          }
          unregisterAll(held);
          live.delete(kind);
          host.reportTarget(kind, null);
        }
      };
      const held: LiveBinding = { binding, receiver, registrations: new Map() };
      live.set(kind, held);
      follow(kind, held, wanted.get(kind) ?? []);
      return binding;
    }, // End of function bind()

    reconcile(surfaces: readonly OpenWriteSurface[], eligible: readonly DocumentId[]): void {
      const next = new Map<ReceivingSurfaceKind, readonly DocumentId[]>();
      for (const surface of surfaces) {
        const kind = surface.kind;
        if (isReceivingKind(kind)) {
          next.set(kind, documentsFor(surface.target, eligible));
        }
      } // End of the loop over the open surfaces
      wanted = next;
      for (const [kind, held] of live) {
        follow(kind, held, next.get(kind) ?? []);
      } // End of the loop over the live bindings
    }, // End of function reconcile()

    receives(kind: OpenWriteSurfaceKind): boolean {
      return isReceivingKind(kind) && live.has(kind);
    },

    dispose(): void {
      for (const held of live.values()) {
        unregisterAll(held);
      } // End of the loop over every live binding
      live.clear();
      wanted = new Map();
    } // End of function dispose()
  };
} // End of function createReceiverRoster()
