Reviewer: autoclaude adversarial reviewer

# Phase 2d-5-2b — adversarial review

## Blockers

None. No write path changed; the assembly, the reconciler and disposal are correct as read.

## Should fix

**1. Medium — the restore's surface list lost its reactive dependency, and a source comment claims a
guarantee that loss removes.**
`DetailPane.svelte:1306` now passes `surfaces={() => browser.openWriteSurfaces()}`. That reads a plain
`Map` (`writeSurfaceRegistry.ts:463`; the module header says "Nothing here is reactive, deliberately").
`RestorePane.svelte:336-344` holds `const current = $derived.by(() => ({ observed:
revisionInProjection(projections(), session.target), surfaces: surfaces() }))`, so **opening or closing
a write surface no longer invalidates `current` at all**. The deleted producer closed over `editing`,
`editingMatch`, `deletingMatch`, `movingMatch`, `duplicatingMatch`, `restoring` — all `$state.raw`
(`DetailPane.svelte:204,283,347,370,393,480`) — and did.
`runRestore` (`RestorePane.svelte:509-511`) takes `const now = current` and sends `now.context.surfaces`;
`confirmRestore(session, context)` reads that argument (`restore.ts:1993`), never the registry. So
`DetailPane.svelte:1296` — *"and `confirmRestore` re-asks at the write"* — is **false with respect to
surfaces**. Direction is under-refusal. Inert today only because `busy` makes the seven mutually
exclusive, which is a fact about this pane, not the model — the notes are careful about that everywhere
else. Fix the sentence, or restore the dependency.

**2. Medium — the case named for criterion 4 cannot observe criterion 4.**
`DetailPane.test.ts:958` (*"gives the restore its surfaces from the registry, itself included"*) asserts
`registered(pane.state)` — the registry directly — plus the absence of six refusal strings. Neither
observes what `RestorePane` received. `competingSurfaceFor` skips `restore` entries
(`restore.ts:477`), so `[]` and `[{restore,…}]` draw identically and the assertion cannot distinguish
them. Notes §9's table claims the case establishes *"the list holds the restore's own entry over the
file it opened on"*. It does not.

**3. Low — a test comment claims coverage that does not exist.**
`MatchCreator.test.ts` (*"reports again when a transition leaves the destination where it was"*) says
*"`DetailPane.test.ts` is what shows the registry is not churned by it"*; notes §5 repeats it. No
`DetailPane.test.ts` case drives a repeat report — nothing types into the creator, and the only
generation assertions are lines 871, 886, 899. That is §7's own worst class, in source.

**4. Low — notes §5 overstates what is reported.** `view.chosen` is `chosenDestination(session)`
(`matchCreation.ts:716-722`), which answers `null` when `session.chosen` names an identity no longer in
`destinations`. A form holding a stale destination is reported as `unknown`, which
`competingSurfaceFor` treats as competing with nothing.

## Checked and clean

`reconcileWriteSurfaces` copies keys before mutating; the `staleLease` arm correctly drops the stale
lease uncalled; the take-back re-key is correct; `sameTarget` is discriminant-first. No-cleanup `$effect`
plus `onDestroy` is leak-free and idempotent (`heldRegistrations.clear()`). `creatorDestination` is
assigned only at 433/434/443/444/1270, so both edges pair. The `$state.raw`-only claim behind the
mount-path-throw argument holds against all seven declarations. `open()` sets `status = 'loading'`
before its first await (`workspace.svelte.ts:2336`) and its two callers are `AppShell.svelte:30,68`
with the pane in the `{:else}` arm (line 84). The two "doc comments only" files changed no behaviour.
No hardcoded user-facing string added; JSDoc and closing-bracket comments present.

## Not verified

- The suites, gates and bundle oracles were not re-run; the orchestrator's figures are accepted as given.
- Svelte's render-effect/user-effect ordering was not probed, so whether `RestorePane`'s first
  `surfaces()` read precedes the pane's registration effect is reasoned, not measured. Finding 2 stands
  either way: the assertion cannot see the value.
- No window reading (2d-5-2c owes it).
