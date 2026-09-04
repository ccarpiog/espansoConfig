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
 * **Nothing here is reactive, deliberately**, and that is still true — but what a
 * consumer sees is not. A registry is read by a coordinator immediately before it
 * decides something, exactly as the generation counters in `./workspace.svelte.ts`
 * are read by the request that took one, and this module is a `.ts` file with no
 * runes in it. What Phase 2d-5-2b's review added is one layer up:
 * `BrowserState.openWriteSurfaces` mirrors {@link WriteSurfaceRegistry.generation}
 * into a signal, because a window *does* render from the live set — the restore's
 * refusal is derived from it — and a plain `Map` gives a `$derived` nothing to
 * depend on. The mirror is that door's, not this module's; nothing here changed.
 *
 * ## What this module does **not** ship, said plainly
 *
 * **No transition stored here has ever been called.** {@link
 * WriteSurfaceRegistry.transitionFor} is the only reader of one and it has no
 * caller; 2d-5-4 is where an admitted observation is routed to the surface a
 * reload would strand, and 2d-5-5 is where the six existing conflict
 * registrations are generalized. What Phase 2d-5-2b added is on the other side:
 * `src/lib/components/DetailPane.svelte` now registers all seven kinds from one
 * `satisfies Record<OpenWriteSurfaceKind, …>` assembly, `MatchCreator.svelte`
 * reports its chosen destination through {@link
 * UnregisterWriteSurface.replaceTarget}, and every one of those surfaces
 * registers the same **no-op** transition — so a stored transition is still a
 * value nothing produces an effect from at either end.
 *
 * **This module deliberately contains no exhaustive assembly**, and that has not
 * changed: an exhaustiveness check that lives anywhere but the composition file
 * checks the wrong thing.
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
 *   The one host that exists registers from an exhaustive assembly, so *that* host
 *   cannot omit a kind the union declares; nothing makes a **new** component
 *   declare itself a write surface in the first place.
 * - **What a caller retains cannot change what the registry answers**, and that is
 *   enforced rather than asked for. A registration reads the caller's object once,
 *   in a fixed order, and builds the stored `OpenWriteSurface` itself — frozen,
 *   member by member, from the values it read — so a host that goes on holding the
 *   object it registered and mutates it changes nothing
 *   {@link WriteSurfaceRegistry.openWriteSurfaces} answers and moves no generation.
 *   {@link UnregisterWriteSurface.replaceTarget} is the only way to change a
 *   registered target, which is what lets {@link WriteSurfaceRegistry.generation}
 *   count every change to what a reader sees.
 * - **What that copy does not force is that the values stay meaningful.** A
 *   `DocumentId` is session-local and `open()` in `./workspace.svelte.ts`
 *   reallocates the identities of the documents it reloads, so a registration that
 *   survives a workspace replacement names a `DocumentId` that now denotes a
 *   different file. Copying the value freezes the *number*, never what it denotes,
 *   and no operation here moves for a reallocation.
 * - **A pairing the union cannot represent is refused, not coerced**, and the
 *   refusal is a thrown `TypeError`; {@link WriteSurfaceRegistry.registerWriteSurface}
 *   says which pairing and why that answer.
 */

import type { DocumentId } from '../ipc/types';
import type { ExternalConflictObservation } from './conflictSource';
import type {
  OpenWriteSurface,
  OpenWriteSurfaceKind,
  WriteSurfaceDocumentTarget,
  WriteSurfaceTarget
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
 * Svelte host returns from `$effect` or `onMount` as its cleanup — **which the one
 * host that exists does not do, and the reason is worth recording rather than
 * hiding.** `DetailPane.svelte` holds up to seven of these at once and reconciles
 * them against an assembly, so its teardown is a loop over the leases it is
 * holding; returning one directly is available to a host that registers exactly one
 * surface for exactly as long as one effect lives, and no host in this repository
 * is that. Hanging
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
   * is the new-snippet form's unknown-to-known transition, which is why it exists,
   * and since Phase 2d-5-2b that is its production caller: `DetailPane.svelte`
   * registers the form with `target: { kind: 'unknown' }` and calls this when
   * `MatchCreator.svelte` reports the file the person chose.
   *
   * **A document target only, and that is a shape argument rather than a
   * restriction on purpose.** `OpenWriteSurface` lets only `matchCreator` carry an
   * unknown target, so a parameter of the wider `WriteSurfaceTarget` would either
   * need a cast to build an unrepresentable surface or a third refusal arm for
   * something no caller wants. A surface that must go back to naming no file
   * unregisters and registers again — a re-key, where by design the newest
   * registration wins.
   *
   * **What it reads, and what it never reads.** It reads `document` off the value
   * it is handed, once, and builds the stored target itself; the stored surface is
   * the registry's own frozen copy, so mutating the target you reported afterwards
   * changes nothing here. It does **not** read that value's own `kind` — the
   * parameter type *is* the document arm and this method means *this is the file*,
   * so the registry writes `'document'` rather than trusting a discriminant it
   * would have to read. And it does not re-read the kind of the surface that was
   * registered: the entry keeps the kind this lease was minted for, which is what
   * makes the key and the stored `surface.kind` incapable of disagreeing.
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
   * **The surface is copied, not kept.** Its properties are read exactly once
   * each, in this order — `kind`, then `target`, then that target's `kind`, then,
   * on the document arm, its `document` — and the stored value is built from what
   * those reads answered and frozen. Every one of them happens **before** this call
   * takes a serial or writes anything, so a read that re-enters this registry lands
   * first and is displaced by this call rather than clobbering it, and once the
   * serial is taken there is no caller-supplied read left in this path for anything
   * to run inside.
   *
   * **A pairing `OpenWriteSurface` cannot represent is refused by throwing a
   * `TypeError`.** A `kind` other than `matchCreator` read together with a
   * `target.kind` of `'unknown'` is not a value of that union — nor is a
   * `target.kind` that is neither arm — and reaching either takes a caller that has
   * defeated the compiler: a cast, or an accessor whose answer differs from its
   * declared type. The registry will not coerce it: inventing a
   * document, storing something no consumer can narrow, and dropping the
   * registration silently are each worse than a throw, and the last is the
   * fail-unsafe one, since an invisible surface is exactly the answer that permits a
   * silent reload. The throw happens before the serial is taken and before the map
   * is touched, so **this call** writes nothing: no serial, no entry under the kind
   * it read, no generation moved. That is a claim about this call and not about the
   * registry, and the two differ on one of the routes above — an accessor that
   * answers an unrepresentable value can register a surface of its own before
   * answering, so the registry a refused call returns to may hold an entry it did
   * not hold on the way in, with the generation moved to match. What is refused is
   * this registration; what the caller's own reads did on the way in stands. The
   * message is a programmer's and nothing renders it, so it is not a string the
   * i18n rule is about.
   *
   * @param surface - The surface, exactly as a consumer of the registry will see
   *   it — the new-snippet form may name no file, every other kind names one.
   * @param transition - What this surface is told about an external observation of
   *   its file. Stored and never called at 2d-5-2a; see
   *   {@link WriteSurfaceTransition}.
   * @returns The lease: call it to unregister, or report a file through it.
   * @throws TypeError - When the `kind` read from the surface and the arm read from
   *   its target are not a representable pairing; see the paragraph above for what
   *   that is and for what a refusal does and does not leave behind.
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
   * surface objects inside are the registry's own frozen copies rather than the
   * objects that were registered, so neither a host that kept what it handed over
   * nor a consumer that casts away `readonly` on what it was handed here can change
   * what a later call answers — the second is refused by the freeze, whose exact
   * strength `ownedDocumentSurface` in this module states.
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
   * set exactly as it was.
   *
   * **What an unmoved generation implies, and what it does not.** It is the guard
   * the consult's Q5 asks a coordinator to capture before an await and recheck
   * immediately before it installs (`docs/reviews/phase-2d-5-design.md:157-163`),
   * and unmoved it means *no registry operation happened between the capture and
   * this decision* — which is a true statement about what a reader sees, because
   * every surface this registry answers is its own frozen copy and the three
   * operations counted here are the only ways one can change. It is not a statement
   * that nothing relevant changed. **Nothing forces a host to register at all**, so
   * an unmoved counter over an empty registry says that nobody registered and not
   * that no write surface is open — `competingSurfaceFor`'s own limitation,
   * inherited. And a `DocumentId` a stored surface names can be reallocated by
   * `open()` in `./workspace.svelte.ts` with no registry operation at all, so this
   * counter does not promise that a surface still names the file it named.
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
  /**
   * This registry's own frozen copy of the surface, with any reported target.
   *
   * Never the object a caller handed over: it is built here from values already
   * read, which is what makes an unmoved {@link WriteSurfaceRegistry.generation} a
   * true claim about what a reader sees.
   */
  readonly surface: OpenWriteSurface;
  /** What that surface is told about an external observation of its file. */
  readonly transition: WriteSurfaceTransition;
}

/**
 * This registry's own copy of one surface, over one file.
 *
 * **Built member by member from values already read, and frozen.** A spread of a
 * caller's object would read whatever it holds at the moment of the spread and
 * would still share `target`, which is an object of its own — so a host mutating
 * `target.document` afterwards would change what the registry answers. Both objects
 * are frozen because `Object.freeze` is shallow, and freezing at all is what stops a
 * consumer that casts away `readonly` on a surface it was handed from corrupting the
 * live set. **The refusal is what varies, never the protection**: that write throws
 * a `TypeError` from strict-mode code, which is all of this project's, and fails
 * silently from sloppy-mode code — the registry is unchanged either way.
 *
 * Written as a branch on the kind rather than one literal so that no cast is needed:
 * TypeScript checks the `matchCreator` arm and the other arm separately, and neither
 * is built from the other.
 *
 * @param kind - The kind, already read once by the caller.
 * @param document - The file, already read once by the caller.
 * @returns A frozen surface of that kind, over that file.
 */
function ownedDocumentSurface(kind: OpenWriteSurfaceKind, document: DocumentId): OpenWriteSurface {
  const target: WriteSurfaceDocumentTarget = Object.freeze({
    kind: 'document' as const,
    document
  });
  return Object.freeze(
    kind === 'matchCreator' ? { kind: 'matchCreator' as const, target } : { kind, target }
  );
} // End of function ownedDocumentSurface()

/**
 * This registry's own copy of one surface, whatever its target arm.
 *
 * **One read of each caller-supplied property, in a stated order**: the target's
 * `kind`, then — only on the document arm — its `document`. The surface's own `kind`
 * is not read here at all; it is the value the caller of this function already read,
 * so nothing can answer one kind to the key and another to the stored surface.
 *
 * **Exactly two pairings are representable, and anything else throws.** Any kind over
 * the document arm is one; `matchCreator` over the unknown arm is the other. A kind
 * other than `matchCreator` that names no file is the pairing the review named, and a
 * discriminant that is *neither* arm is the same problem arriving by a different
 * route — both are tested for positively, so neither is coerced into the arm it looks
 * closest to. {@link WriteSurfaceRegistry.registerWriteSurface} carries the argument
 * for throwing rather than dropping. Every caller builds before it mutates anything,
 * so a throw here means the **calling operation** wrote nothing — no serial taken,
 * no entry stored, no generation moved by it. It is not a claim that the registry is
 * unchanged: the two reads this function takes are the caller's, and either can
 * register a surface before answering the value that is then refused.
 *
 * @param kind - The kind, already read once by the caller.
 * @param target - The caller's target, read here and not retained.
 * @returns A frozen surface of that kind, over that target.
 * @throws TypeError - When the kind and the target arm are not a representable pair.
 */
function ownedSurface(kind: OpenWriteSurfaceKind, target: WriteSurfaceTarget): OpenWriteSurface {
  const targetKind = target.kind;
  if (targetKind === 'document') {
    return ownedDocumentSurface(kind, target.document);
  }
  if (targetKind === 'unknown' && kind === 'matchCreator') {
    return Object.freeze({ kind, target: Object.freeze({ kind: 'unknown' as const }) });
  }
  throw new TypeError(
    `writeSurfaceRegistry: a ${kind} surface cannot carry a target of kind '${targetKind}'`
  );
} // End of function ownedSurface()

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
   * **It answers the entry itself rather than a boolean**, because the caller that
   * acts on a live entry needs what the entry carries: `replaceTarget` below writes
   * the entry's own transition back beside the new surface, so a boolean would make
   * it ask the map a second time for a value it has already been given.
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
      // **Everything the caller can be asked is read here, before the serial is
      // taken and before anything is written.** `surface` is the caller's, so
      // `surface.kind`, `surface.target` and that target's own properties may each
      // be an accessor running arbitrary code — including code that registers
      // another surface of this very kind. Reading them all first has two
      // consequences and both are the truth rather than a convenience. Any such
      // re-entrant registration takes a *lower* serial and lands before this one,
      // which is right: this call finished last, and taking the serial first would
      // let the re-entrant registration be silently clobbered by the older number.
      // And after the reads there is nothing caller-supplied left to read in this
      // path, so no accessor can run between the serial and the `live.set`.
      //
      // `ownedSurface` throws on a pairing the union cannot represent, and it does
      // so here — before the serial and before the map is touched — so *this*
      // registration writes nothing when it is refused. What that does not say is
      // that the registry is unchanged: the reads on the two lines below are the
      // caller's, and one of them can register a surface of its own before answering
      // the value that gets refused, in which case the throw leaves that
      // registration standing and the generation moved. Refusing this call is the
      // whole of what happens here.
      const kind = surface.kind;
      const owned = ownedSurface(kind, surface.target);
      serials += 1;
      const serial = serials;
      live.set(kind, { serial, surface: owned, transition });
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
        // **The caller's value is read before the lease is checked, so that the
        // check and the spend below have nothing between them.** `target.document`
        // may be an accessor running arbitrary code — this project has shipped a
        // check and a spend separated by exactly such a read twice — and anything
        // it re-enters and does is therefore *already done* when `heldBy` runs. If
        // it did not re-enter at all, nothing between the check and the `live.set`
        // can run either.
        //
        // **What the check answers when it did re-enter depends on what it did, and
        // the two cases are not one.** A re-entrant *registration* of this kind
        // takes a new serial, so `heldBy` finds a serial that is not this lease's
        // and this call answers `staleLease` having written nothing. A re-entrant
        // `replaceTarget` on *this* lease keeps the serial, so `heldBy` matches, and
        // this call — which finished last — writes its own target over the inner
        // one: **both calls answer `replaced` and the outer target is the one
        // installed.** That is this module's registration rule seen through a lease,
        // last finisher wins, and it is the one place this ordering differs in
        // outcome from the two-check ordering it replaced. That one had no read of
        // `target.document` at all; its own re-entry route was a `kind` accessor on
        // the caller's retained surface — gone, now that the stored surface is this
        // module's frozen copy — and **what that route answered depended on what the
        // accessor did, so the sentence has to say which case it is about.** A
        // re-entrant same-lease `replaceTarget` kept the serial and swapped the entry
        // object, so the removed second check failed on identity and the old code
        // answered `staleLease` for a lease that was still live, leaving the inner
        // call's target installed. A re-entrant *registration* of this kind through
        // that same accessor took a new serial, so there the old `staleLease` named a
        // lease that really had been displaced and was correct — this comment attributed
        // the untruthful answer to the whole route until Phase 2d-5-2a-C.
        // `docs/decisions/2d-5-2a-B-notes.md` section 2 and `2d-5-2a-C-notes.md`
        // section 3 carry both derivations.
        //
        // **The kind is the captured one, and no surface's `kind` is re-read.** The
        // entry keeps the key its lease was minted for, so the key and the stored
        // `surface.kind` cannot come apart.
        const next = ownedDocumentSurface(kind, target.document);
        const held = heldBy(kind, serial);
        if (held === undefined) {
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
