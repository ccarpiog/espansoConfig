Reviewer: autoclaude adversarial reviewer

# Phase 2d-5-2a-A — adversarial review

## Blockers

None. Finding 1's fix holds: `DocumentId` is `number` (`ipc/types.ts:58`), so
`ownedDocumentSurface` (`writeSurfaceRegistry.ts:379-387`) copies every leaf and freezes both
levels; `live` is mutated only at `:490`, `:508` and `:541`, each with `generation += 1` in the same
block; `openWriteSurfaces` (`:549-555`) hands out only those frozen copies. No path reaches a value
`openWriteSurfaces()` answers that can be mutated without the counter moving. The removed second
lease check really is unfireable **in the new ordering**: between `heldBy` (`:534`) and `live.set`
(`:541`) the only reads are of this module's own entry object, so no getter can run.

## Should fix

**1. `writeSurfaceRegistry.ts:533-543` — the ordering change is not outcome-preserving, and both
records say it is.** `2d-5-2a-A-notes.md:180` and `2d-5-2a-notes.md` §4's correction claim "the
answer is the same `staleLease` the old ordering produced". True for a re-entrant *registration*;
false for a re-entrant same-lease `replaceTarget`. Old code compared the entry **object**
(`git show HEAD:…:404`, `heldBy(...) !== held`), and a nested replacement installs a new entry
object with the same serial → outer refused. New code compares only the serial, so the outer call
overwrites the inner's target and **both calls answer `'replaced'`**. Defensible (same lease,
last-finisher-wins, matches the module's registration rule) but unnamed. Record fix.

**2. `workspace.svelte.ts:1478-1510` — the door 2d-5-2b's components call documents no throw.**
`BrowserState.registerWriteSurface` delegates at `:3196` to a function that now throws `TypeError`,
and its JSDoc has neither prose nor `@throws` (the convention exists: `bootstrap.ts:53`,
`writeSurfaceRegistry.ts:409`). A throw on a mount path is a blank pane. Source file — a fix
commissions a round under §7.1.

**3. Stale citation this phase created.** `2d-5-2a-notes.md:237` and `2d-5-2a-A-notes.md:141` cite
`workspace.svelte.ts:2269` for "Their identities are reallocated by the load below"; this phase's
own +17-line comment moved it to **:2286**. Also `writeSurfaceRegistry.ts:241-243` ("a refused
registration leaves the registry exactly as it was") is false when the caller's accessor — one of
the two named routes to the throw — registered before throwing.

## Checked and sound

- Read order matches the doc: `surface.kind` (`:486`) → `surface.target` (`:487`) → `target.kind`
  (`:412`) → `target.document` (`:414`), all before `serials += 1`.
- The throw is compiler-guarded: `OpenWriteSurface` (`restore.ts:423-435`) correlates kind and arm.
- Both branches of `ownedDocumentSurface`/`ownedSurface` narrow without a cast.
- No "held by reference"/"held as handed" sentence survives anywhere under `src/`.
- Line counts in §1 are exact (441→565, 421→609, 3693→3710).
- `workspace.svelte.ts` diff is comment-only.

## Not verified

- The "7 of 28 fail against `git show HEAD:…`" discrimination claim — checking it requires writing a
  tracked source file, which this review may not do. I ran the suite as shipped: **28 passed**.
- `npm test` (2235), `npm run build` (186), both bundle oracles, `cargo test` (1320), clippy, fmt,
  `cargo tree`, and the `git archive` per-file re-derivation — not re-run; budget, plus the recorded
  `cargo test` concurrency hazard.
- Nothing in production registers, so the copy, the freeze, the refusal and lease disposal are
  established over values only. Whether a host registers on mount, unregisters on destroy, reports a
  destination, survives an `open()`, or blanks a pane on the `TypeError` is unverifiable until
  2d-5-2b's mounted evidence.
- Whether Svelte 5's `$state` proxy handles a frozen surface as a 2d-5-2b host would need — no
  component consumes the registry yet.
