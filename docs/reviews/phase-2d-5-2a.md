Reviewer: autoclaude adversarial reviewer

# Phase 2d-5-2a — adversarial review

## Blockers

None found. The lease holds under every synchronous interleaving I could construct: serials are
monotonic per registry and never reused (no ABA), `heldBy` reads only module-owned values
(`writeSurfaceRegistry.ts:348-351`), `unregister` has no caller-supplied read between its check and
its `live.delete` (`:377-387`), and `replaceTarget`'s post-`withTarget` re-check compares the entry
object by reference (`:411`), so a re-entrant same-lease replacement, a displacement, and an
unregister-then-reregister all end in `staleLease`. Re-ran: the new suite (22 passed) and
`npm run check` (438 files, 0 errors, 0 warnings).

## Should fix

**1. `writeSurfaceRegistry.ts:245-249` — the generation claims more than it gives.**
`"the recheck's meaning is *this decision was made over a set nothing has touched*"`. The counter
moves only for registry *operations*. The same file's header (`:51-55`) says surface values are held
by reference and `readonly` does not freeze, so a host mutating its registered surface's `target` in
place changes what `openWriteSurfaces()` answers with the generation **unmoved**. Consult Q5's guard
(`phase-2d-5-design.md:157-163`) rests on exactly the unmoved case, so this is the load-bearing
direction, and CLAUDE.md's "say what it cannot force in the same sentence" is not met here.
`2d-5-2a-notes.md` §3.5 repeats the sentence verbatim; §7 item 4 records the hazard without
connecting it to the guard.

**2. `workspace.svelte.ts:1683` — "the safe one costs nothing" is contradicted 586 lines later.**
`open()` clears `projectionGenerations` because `"Their identities are reallocated by the load
below"` (`:2269`). A registration surviving `open()` therefore names a `DocumentId` that now denotes
a *different file*: `competingSurfaceFor` would refuse a restore of a file nobody has open, and
`targetingSurfaceFor` would attribute it to a surface that is not about it. Fail-safe for writes, but
it costs a false refusal on an unrelated file, and neither the comment nor `2d-5-2a-notes.md` §3.8
names reallocation. Inert at 2d-5-2a (nothing registers); it becomes live in 2d-5-2b.

**3. (Low) `writeSurfaceRegistry.ts:306-308`** — `withTarget` reads `surface.kind` twice on the
non-creator path (the creator path short-circuits, so the accessor test at `writeSurfaceRegistry.test.ts:359`
exercises only one read). An inconsistent accessor yields an entry stored under key K whose
`surface.kind` is not K, making `transitionFor` and `openWriteSurfaces` disagree. Equivalent
divergence is already reachable at registration and is covered by the header's "held as handed"
caveat; noting the gap in the guard's test coverage, not asking for a redesign.

## Checked and sound

- Reader order matches its doc: `Map.set` over an existing key keeps position; pinned at test `:158`.
- `restore.test.ts:400-408` really is `satisfies Record<OpenWriteSurfaceKind, true>`, so the suite's
  claim about what catches an eighth kind is true.
- `DetailPane.svelte:844-947` is one `if`/`else if` chain with exactly one block per kind — the
  "at most one live entry per kind" cost argument holds today.
- `DetailPane` passes `surfaces={openWriteSurfaces}` as a *function* (`:966`), so the registry being
  non-reactive does not break the existing consumption shape in 2d-5-2b.
- Only `workspace.svelte.ts` implements `BrowserState` as a typed literal; three added members break
  no double.
- No `satisfies Record<OpenWriteSurfaceKind, …>` was added here, as required.
- §7.3 marks look correct: item 5's *actionable* names a disagreement nothing consumes (the registry
  is empty in production), so it is not a source correctness defect and does not block closure.

## Not verified

- `npm test` total (2229), `npm run build` (186 modules) and both bundle oracles — not re-run inside
  the 25-minute budget; only the new suite and `npm run check` were re-run.
- `cargo test --workspace`, clippy, fmt, `cargo tree` — not re-run; no Rust file changed
  (`git diff --stat HEAD -- crates/ src-tauri/` empty) and the brief records a concurrency hazard.
- No window reading and no mounted evidence exist for this step by design; every claim about hosts
  registering, unregistering on unmount, or reporting a destination is unverifiable until 2d-5-2b.
