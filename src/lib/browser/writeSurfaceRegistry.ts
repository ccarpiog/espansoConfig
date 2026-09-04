/**
 * Which write surfaces this window has open, as a value — Phase 2d-5-2a.
 *
 * ## What it is
 *
 * The coordinator-owned **keyed registry of live write surfaces** the design
 * consult's Q1 rules (`docs/reviews/phase-2d-5-design.md:39-45`): a surface
 * registers itself while it is open, gets a **lease** back, and unregisters through
 * that lease when it closes. The registry hands out the
 * `readonly OpenWriteSurface[]` that `./restore.ts`'s two predicates already
 * consume — `competingSurfaceFor`, which asks whether a restore may replace a file's
 * text, and `targetingSurfaceFor`, which asks whether reconciliation may silently
 * reload one under an open surface.
 *
 * ## Where it lives, and why it is not in `./workspace.svelte.ts`
 *
 * `docs/decisions/2d-5-split-notes.md` section 6 item 2 leaves *where the
 * coordinator lives* to the steps. This step puts the registry in a module of its
 * own for two reasons. `./workspace.svelte.ts` was already 3 588 lines when this
 * step began — this step's own wiring adds to it — and 2d-5-3, 2d-5-4 and 2d-5-5
 * each add more coordinator machinery to it. And a **plain TypeScript** registry —
 * no runes, hence `.ts` — is model-testable without mounting anything, which is
 * what lets 2d-5-2b spend its whole evidence budget on the components that do the
 * registering.
 *
 * **Nothing here is reactive, deliberately.** Nothing renders a registry: it is
 * read by a coordinator immediately before it decides something, exactly as the
 * generation counters in `./workspace.svelte.ts` are read by the request that took
 * one. Making it `$state` would add a dependency to every effect that happened to
 * read it.
 *
 * ## What this step does **not** ship, said plainly
 *
 * **No component registers anything yet, and no transition is ever called.**
 * 2d-5-2b is what makes the surface hosts register, what makes
 * `MatchCreator.svelte` report its chosen destination upward, and what adds the
 * exact `satisfies Record<OpenWriteSurfaceKind, …>` assembly in the composition
 * file that turns omitting a declared kind into a compile error. This module
 * deliberately contains no such assembly: an exhaustiveness check that lives
 * anywhere but the composition file checks the wrong thing.
 *
 * ## What it cannot force
 *
 * - **Nothing in TypeScript forces a caller to invoke the unregister it was
 *   handed**, which is why disposal is asserted by test rather than claimed by
 *   type ({@link UnregisterWriteSurface} says the same in its own comment).
 * - **Nothing here forces a surface to register at all.** A component that opens a
 *   write surface and never calls {@link WriteSurfaceRegistry.registerWriteSurface}
 *   is invisible to every consumer, and an empty reader answer claims there are
 *   none — `competingSurfaceFor`'s own stated limitation, inherited unchanged.
 * - **A registered surface value is held as it was handed.** `readonly` does not
 *   freeze at run time, so a caller that mutates the object it registered changes
 *   what {@link WriteSurfaceRegistry.openWriteSurfaces} answers about it;
 *   {@link UnregisterWriteSurface.replaceTarget} is the supported way to change a
 *   target and the only one this module can see.
 */

import type { ExternalConflictObservation } from './conflictSource';
import type {
  OpenWriteSurface,
  OpenWriteSurfaceKind,
  WriteSurfaceDocumentTarget
} from './restore';

/**
 * What one live write surface is told when the file it is about changed on disk.
 *
 * **No caller invokes this yet, and that is the step's shape rather than an
 * oversight.** 2d-5-4 is where an admitted observation is routed to the surface a
 * reload would strand — the consult's Q5, *"send the observation to that surface's
 * external-conflict transition and install no projection"*
 * (`docs/reviews/phase-2d-5-design.md:149-152`) — and 2d-5-5 is where the six
 * existing conflict registrations are generalized onto `ConflictSource`. Until
 * then the registry stores one per entry and calls none.
 *
 * **The narrowest honest type, in both directions.** The parameter is
 * {@link ExternalConflictObservation} because that is the value the consult says is
 * sent — the already-narrowed `Changed`/`Addressable`/`Projected` snapshot, which
 * carries its own sequence, revision, disk text and projection — so a surface
 * implementing this cannot be handed less than it needs. The answer is `void`
 * because **nothing has decided what a surface answers**: a return type invented
 * here would be a claim about a protocol that does not exist yet, and widening
 * `void` later is one edit in this file.
 *
 * **It says nothing about what the surface then does.** Whether the transition
 * raises a conflict, discards the observation or ignores it entirely is that
 * surface's, and no type here reaches it.
 */
export type WriteSurfaceTransition = (observation: ExternalConflictObservation) => void;

/**
 * What became of one attempt to report a surface's file upward.
 *
 * `replaced` means the live entry this lease names now carries the reported target.
 * `staleLease` means it does not, because the lease no longer names a live entry —
 * it was unregistered, or a newer registration of the same kind displaced it,
 * possibly during this very call — and **the registry was not changed by this
 * call**.
 *
 * **An answer rather than a silent no-op**, because a report that did not land
 * looks exactly like one that did from the caller's side, and believing a report
 * landed when it did not is this project's silent-success defect class. Nothing
 * forces a caller to read it.
 */
export type WriteSurfaceTargetReplacement = 'replaced' | 'staleLease';

/**
 * One registration's lease: call it to unregister, or report a file through it.
 *
 * **A lease, not a bare kind key** (`docs/decisions/2d-5-split-notes.md` section 3
 * ruling 2). Reopening one kind must not let a stale instance unregister a newer
 * one, and this value is what makes that impossible: every operation on it checks
 * that it still names the live entry of its kind, and changes nothing when it does
 * not.
 *
 * **What that forces, and what it does not.** It forces that a stale instance
 * cannot remove or re-target a newer one, and that calling it twice is the same as
 * calling it once — **nothing in TypeScript forces a caller to invoke it at all**,
 * so a host that drops it leaves its surface registered for the life of the
 * registry, and only a test can establish that a host disposes of what it was
 * handed.
 *
 * **Callable rather than an object with an `unregister` method**, for two reasons
 * that are not tidiness. It keeps the consult's own signature —
 * `registerWriteSurface(surface, transition): UnregisterWriteSurface`
 * (`docs/reviews/phase-2d-5-design.md:42`) — and it is directly usable as what a
 * Svelte host returns from `$effect` or `onMount` as its cleanup, so the disposal
 * path 2d-5-2b writes is one `return` with nothing to forget. Hanging
 * {@link replaceTarget} on the same value is the other half: there is no second
 * token for a caller to pair with the wrong registration, which is the shape
 * `sendRestore(started)` in `./restore.ts` already uses for the same reason.
 */
export interface UnregisterWriteSurface {
  /**
   * Removes this registration, if it is still the live one of its kind.
   *
   * **Idempotent, and inert once displaced.** A second call does nothing, and a
   * call from a lease whose entry a newer registration of the same kind has
   * replaced does nothing — in particular it does **not** remove the newer entry,
   * and it does not move the registry generation.
   *
   * **It answers nothing on purpose.** A host disposing of its surface wants the
   * entry gone, and it is gone either way; an answer would be a value with nothing
   * to do about it, and a discarded answer is a shape this project has shipped as a
   * defect twice. What actually happened is observable through
   * {@link WriteSurfaceRegistry.openWriteSurfaces} and
   * {@link WriteSurfaceRegistry.generation}, which is where the tests read it.
   */
  (): void;

  /**
   * Reports the file this surface is about, replacing the target in place.
   *
   * **In place: the entry keeps its key, its lease and its position** in the
   * reader's order, and the transition it was registered with is untouched. This
   * is the new-snippet form's unknown-to-known transition, which is why it exists:
   * `MatchCreator.svelte` registers with `target: { kind: 'unknown' }` and reports
   * its destination when the person chooses one (2d-5-2b). It has no production
   * caller at 2d-5-2a.
   *
   * **A document target only, and that is a shape argument rather than a
   * restriction on purpose.** `OpenWriteSurface` lets only `matchCreator` carry an
   * unknown target, so a parameter of the wider `WriteSurfaceTarget` would either
   * need a cast to build an unrepresentable surface or a third refusal arm for
   * something no caller wants. A surface that must go back to naming no file
   * unregisters and registers again — a re-key, where by design the newest
   * registration wins.
   *
   * @param target - The file this surface would write, as the document arm.
   * @returns Whether the live entry was changed, or that this lease is stale.
   */
  readonly replaceTarget: (
    target: WriteSurfaceDocumentTarget
  ) => WriteSurfaceTargetReplacement;
}

/**
 * Every write surface this window has open, keyed by kind.
 *
 * **At most one live entry per kind**, which is what the key buys: reopening a kind
 * displaces the entry that kind had, and the displaced lease becomes inert rather
 * than dangerous. What it costs is stated rather than glossed — **two surfaces of
 * one kind cannot both be represented**, so a window that ever drew two match
 * editors at once would show one of them here. Today it cannot: the third pane
 * holds exactly one block per kind inside one `if`/`else` chain
 * (`src/lib/components/DetailPane.svelte:844-961`), which is the same ground
 * `competingSurfaceFor`'s comment stands on for restore.
 */
export interface WriteSurfaceRegistry {
  /**
   * Records that one write surface is open, and answers its lease.
   *
   * **The consult's signature, unchanged** (`docs/reviews/phase-2d-5-design.md:42`).
   * The surface carries its own kind, so there is no key argument to disagree with
   * it; a registration of a kind that already has a live entry **displaces** that
   * entry, and the displaced lease can neither remove nor re-target this one.
   *
   * @param surface - The surface, exactly as a consumer of the registry will see
   *   it — the new-snippet form may name no file, every other kind names one.
   * @param transition - What this surface is told about an external observation of
   *   its file. Stored and never called at 2d-5-2a; see
   *   {@link WriteSurfaceTransition}.
   * @returns The lease: call it to unregister, or report a file through it.
   */
  registerWriteSurface(
    surface: OpenWriteSurface,
    transition: WriteSurfaceTransition
  ): UnregisterWriteSurface;

  /**
   * Every live surface, as the array `./restore.ts`'s two predicates take.
   *
   * **A fresh array each call, and it is a snapshot**: it does not track later
   * registrations, and nothing a caller does to it reaches the registry. The
   * surface objects inside are the ones that were registered rather than copies,
   * for the reason this module's header gives.
   *
   * **The order is the order the live entries were registered in, oldest first**,
   * with one property worth naming because a predicate depends on it: a
   * registration that displaces a live entry of the same kind **keeps that entry's
   * position** rather than moving to the end. That matters exactly where
   * `targetingSurfaceFor` says it does — array order decides which kind is answered
   * when two open surfaces name one file — and it decides no yes/no answer of
   * either predicate.
   *
   * @returns Every live surface, oldest registration first.
   */
  openWriteSurfaces(): readonly OpenWriteSurface[];

  /**
   * How many times the live set has changed.
   *
   * **Moves for all three mutating operations**: a registration, an unregistration
   * that removed an entry, and a target replacement that landed. It does **not**
   * move for a no-op — a second call of one lease's unregister, a stale lease's
   * unregister, or a stale lease's `replaceTarget` — because none of those changed
   * anything.
   *
   * **What a moved generation implies, and what it does not.** It implies that the
   * live set was mutated since the capture, so any answer derived from an older
   * snapshot may describe surfaces that are no longer open, or miss one that now
   * is. It does **not** say *what* changed, does not say the change concerns any
   * particular document, and does **not** say the set differs from the capture now
   * — registering a surface and unregistering it moves this twice and leaves the
   * set exactly as it was. It is the guard the consult's Q5 asks a coordinator to
   * capture before an await and recheck immediately before it installs
   * (`docs/reviews/phase-2d-5-design.md:157-163`); the recheck's meaning is *this
   * decision was made over a set nothing has touched*, which is deliberately
   * stricter than *the set still looks the same*.
   *
   * @returns The current generation; zero for a registry nothing has registered
   *   with.
   */
  generation(): number;

  /**
   * The transition of the live surface of one kind, or `null`.
   *
   * **The lookup 2d-5-4 will need, and the only way the stored transition can be
   * read at all.** `targetingSurfaceFor` answers a *kind*, so this is keyed to
   * match it. It has no production caller at 2d-5-2a and is not on `BrowserState`
   * yet — 2d-5-4 lifts it there when it has one.
   *
   * **Two answers from two reads are two facts.** The kind a snapshot of
   * {@link openWriteSurfaces} justified may have been displaced or unregistered by
   * the time this is asked, in which case this answers the *newer* surface's
   * transition or `null`; {@link generation} is what tells a caller that happened,
   * and nothing here checks it.
   *
   * @param kind - Which kind of surface.
   * @returns Its transition, or `null` when no surface of that kind is live.
   */
  transitionFor(kind: OpenWriteSurfaceKind): WriteSurfaceTransition | null;
}

/**
 * One live registration: what was registered, and which registration it is.
 *
 * The serial is the lease's whole mechanism. It is compared, never shown, and it is
 * per registry rather than global — nothing outside one registry ever sees one.
 */
interface LiveRegistration {
  /** Which registration this is, within this registry. */
  readonly serial: number;
  /** The surface as it now stands, including any reported target. */
  readonly surface: OpenWriteSurface;
  /** What that surface is told about an external observation of its file. */
  readonly transition: WriteSurfaceTransition;
}

/**
 * The same surface with a different target, keeping the union's own shape.
 *
 * Written as a branch on the kind rather than a spread so that no cast is needed:
 * the `matchCreator` arm takes any {@link WriteSurfaceDocumentTarget} and so does
 * every other arm, and TypeScript checks each separately.
 *
 * @param surface - The surface as it stands.
 * @param target - The file it is now about.
 * @returns A new surface value of the same kind, carrying that target.
 */
function withTarget(
  surface: OpenWriteSurface,
  target: WriteSurfaceDocumentTarget
): OpenWriteSurface {
  return surface.kind === 'matchCreator'
    ? { kind: 'matchCreator', target }
    : { kind: surface.kind, target };
} // End of function withTarget()

/**
 * Builds one empty registry.
 *
 * **One per `BrowserState`**, created by `createBrowserState` in
 * `./workspace.svelte.ts` and never module-level: two windows are two registries,
 * and a module-level one would make a surface open in one of them visible in the
 * other, exactly as a `DocumentId` is session-local.
 *
 * @returns A registry with nothing registered and generation zero.
 */
export function createWriteSurfaceRegistry(): WriteSurfaceRegistry {
  // The live set. A `Map` because insertion order is exactly the reader's
  // documented order, and because `set` over an existing key keeps that key's
  // position — which is what makes a displacing registration keep the displaced
  // entry's place in the array rather than jumping to the end.
  const live = new Map<OpenWriteSurfaceKind, LiveRegistration>();
  // Serials are handed out in order and never reused, so a lease's serial names one
  // registration for the life of this registry.
  let serials = 0;
  let generation = 0;

  /**
   * The registration this lease names, or `undefined` when it is stale.
   *
   * **It answers the entry itself rather than a boolean**, so that a caller which
   * has to act after reading something else can compare *the same object* again
   * instead of asking a second yes/no question. `replaceTarget` below is the caller
   * that needs it, and why is in its own comment.
   *
   * **Nothing a caller supplied is read here**: the map, the captured `kind` and
   * `serial`, and the `serial` of this module's own entry object. So no getter and
   * no proxy trap can run inside this call.
   *
   * @param kind - The kind the lease was minted for.
   * @param serial - The registration the lease was minted for.
   * @returns The live registration, or `undefined`.
   */
  function heldBy(kind: OpenWriteSurfaceKind, serial: number): LiveRegistration | undefined {
    const held = live.get(kind);
    return held !== undefined && held.serial === serial ? held : undefined;
  } // End of function heldBy()

  return {
    registerWriteSurface(
      surface: OpenWriteSurface,
      transition: WriteSurfaceTransition
    ): UnregisterWriteSurface {
      // **The caller's object is read first, before the serial is taken.** `surface`
      // is the caller's, so `surface.kind` may be an accessor that runs arbitrary
      // code — including code that registers another surface of this very kind. Read
      // first and every such registration takes a *lower* serial and lands before
      // this one, which is the truth: this call finished last. Taking the serial
      // first would let a re-entrant registration be silently clobbered by the older
      // number.
      const kind = surface.kind;
      serials += 1;
      const serial = serials;
      live.set(kind, { serial, surface, transition });
      generation += 1;

      /**
       * Removes this registration, if it is still the live one of its kind.
       *
       * @returns Nothing; see {@link UnregisterWriteSurface}.
       */
      const unregister = (): void => {
        if (heldBy(kind, serial) === undefined) {
          // Already gone, or displaced by a newer registration of this kind. Doing
          // nothing is the whole point of the lease: the newer entry is not this
          // lease's to remove, and the generation must not move for a no-op.
          return;
        }
        // The check above and this removal are one synchronous block with nothing
        // caller-supplied read between them, so no accessor can re-enter and turn
        // this into a removal of somebody else's entry.
        live.delete(kind);
        generation += 1;
      }; // End of function unregister()

      /**
       * Reports the file this surface is about, replacing the target in place.
       *
       * @param target - The file this surface would write.
       * @returns Whether the live entry was changed, or that this lease is stale.
       */
      const replaceTarget = (
        target: WriteSurfaceDocumentTarget
      ): WriteSurfaceTargetReplacement => {
        const held = heldBy(kind, serial);
        if (held === undefined) {
          return 'staleLease';
        }
        // **Built before the lease is checked again, and that second check is not
        // redundant.** `withTarget` reads `kind` off the surface the caller
        // registered, which may be an accessor running arbitrary code — and this
        // project has shipped a check and a spend separated by exactly such a read
        // twice. If anything re-entered and replaced this kind's entry during that
        // read, the entry object is no longer the one checked and this call must
        // refuse rather than write the older registration back over it.
        const next = withTarget(held.surface, target);
        if (heldBy(kind, serial) !== held) {
          return 'staleLease';
        }
        // The serial and the transition travel through unchanged: this is a target
        // replacement, not a re-registration, so the lease stays valid and the
        // entry keeps its position in the reader's order.
        live.set(kind, { serial, surface: next, transition: held.transition });
        generation += 1;
        return 'replaced';
      }; // End of function replaceTarget()

      return Object.assign(unregister, { replaceTarget });
    }, // End of function registerWriteSurface()

    openWriteSurfaces(): readonly OpenWriteSurface[] {
      const open: OpenWriteSurface[] = [];
      for (const registration of live.values()) {
        open.push(registration.surface);
      }
      return open;
    },

    generation(): number {
      return generation;
    },

    transitionFor(kind: OpenWriteSurfaceKind): WriteSurfaceTransition | null {
      return live.get(kind)?.transition ?? null;
    }
  };
} // End of function createWriteSurfaceRegistry()
