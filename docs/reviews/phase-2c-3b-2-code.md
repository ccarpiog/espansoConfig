## Findings

1. **High — an old re-read can overwrite a newer workspace or projection**  
   [workspace.svelte.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/workspace.svelte.ts:1765)

   `rereadDocument()` awaits `reloadDocument()` without capturing or checking `openGeneration` or a per-document request generation. If the workspace is reopened, or two re-reads overlap, an older result can install after the newer state and inject a projection from the wrong workspace/revision.

   This contradicts the module’s stated invariant that asynchronous results are discarded when no longer wanted and can leave stale identities installed.

   Minimal fix: capture the current workspace generation plus a per-document re-read generation before the await; discard results that no longer match. Add deferred-promise tests for reversed re-read completion and workspace replacement.

2. **High — a failed adoption draws mutually contradictory sentences**  
   [MatchMover.svelte](/Users/ccarpio/Developer/espansoConfig/src/lib/components/MatchMover.svelte:618)  
   [en.json](/Users/ccarpio/Developer/espansoConfig/src/lib/i18n/en.json:303)  
   [es.json](/Users/ccarpio/Developer/espansoConfig/src/lib/i18n/es.json:303)

   A committed move whose re-read fails correctly carries `windowOutOfStep`, saying the window could not read the file back. The component simultaneously draws `browser.matchMove.moved`, which says “the file has been read again” / “el archivo se ha vuelto a leer.”

   Both sentences are reachable together because `view.moved` is true even when `adoption.kind === 'failed'`.

   Minimal fix: weaken `browser.matchMove.moved` so it does not claim the re-read succeeded, e.g. instruct the user to continue only once the window has a fresh reading. Add a mounted failed-adoption case.

3. **High — `movedNotIdentified` claims the snippet remains in the file without evidence**  
   [MatchMover.svelte](/Users/ccarpio/Developer/espansoConfig/src/lib/components/MatchMover.svelte:624)  
   [en.json](/Users/ccarpio/Developer/espansoConfig/src/lib/i18n/en.json:304)  
   [es.json](/Users/ccarpio/Developer/espansoConfig/src/lib/i18n/es.json:304)

   `landed === null` means the file changed again between the write and the following read. That intervening change may have removed or replaced the snippet. The copy nevertheless states “It is in the file” / “Está en el archivo.”

   Minimal fix: retain the uncertainty: tell the user the window cannot locate or establish whether the moved snippet is still present, and ask them to inspect the fresh file. Add a mounted committed-with-`moved: null` assertion.

4. **Medium — ordinary send-failure copy overclaims that the snippet stayed put**  
   [MatchMover.svelte](/Users/ccarpio/Developer/espansoConfig/src/lib/components/MatchMover.svelte:556)  
   [en.json](/Users/ccarpio/Developer/espansoConfig/src/lib/i18n/en.json:294)  
   [es.json](/Users/ccarpio/Developer/espansoConfig/src/lib/i18n/es.json:294)

   `sendFailed` is drawn for identity-staleness failures. Those failures establish that this move wrote nothing, but the file may already have changed externally. Therefore “The snippet is where it was” / “El fragmento sigue donde estaba” is not guaranteed.

   Minimal fix: say only that this move was not written; remove the claim about the snippet’s current position.

5. **Medium — failed recovery deliberately retains a projection already known to disagree**  
   [workspace.svelte.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/workspace.svelte.ts:1765)  
   [MatchMover.svelte](/Users/ccarpio/Developer/espansoConfig/src/lib/components/MatchMover.svelte:392)

   The recovery is offered after failures saying the window and command disagree about the address. If that re-read fails, `rereadDocument()` leaves the old projection installed. The move session consequently remains live against that projection, keeps its old destinations, and can resend the same stale identity.

   Retaining an old projection may be reasonable for a generic refresh failure, but it is not conservative for this recovery caller, which already has evidence of disagreement.

   Minimal fix: give recovery re-reads invalidating semantics, or add a recovery-specific method. On failure, remove the affected projection and selection through the existing invalidation helpers so counters and caches move together and the session becomes `outOfDate`.

6. **Low — the record promises every successful re-read makes the session `outOfDate`**  
   [2c-3b-2-notes.md](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-3b-2-notes.md:171)  
   [MatchMover.svelte](/Users/ccarpio/Developer/espansoConfig/src/lib/components/MatchMover.svelte:384)

   `reloadDocument` can successfully return the same revision when bytes have not changed. In that case the full identity still compares equal, so the panel does not say `outOfDate` and may remain usable. The documentation claims otherwise.

   Minimal fix: qualify the claim: the panel becomes `outOfDate` only when the successful re-read installs a different projection identity.

## Explicit checks

- The frozen `notMovable` reason is suppressed beside live `outOfDate`; the markup satisfies the component-only rule on reachable error and conflict paths.
- R37’s synchronous read is sound: accessing `current.views` evaluates the single `$derived.by` as one synchronous computation, and `started` freezes everything needed before the await. No reprojection can interleave inside that JavaScript block.
- `moveMatch` still returns `MatchSaveAnswer`, forwards the caller’s base revision, reads adoption failure beside committed outcomes, and uses `forgetTextOf(document)`. The production caller was updated; no caller was dropped.
- `identityInProjection` is used only to obtain a value that `beginMove`/full-identity comparison checks, never to follow a draft across revisions.
- The silent absence of Move while the editor is open is acceptable for the chosen R36 conservative policy: the instruction was explicitly that such a snippet is not offered a move. The editor itself remains visibly open with its save/leave workflow; exposing the model’s `unsavedDraft` sentence would require allowing both surfaces simultaneously or adding a separate coordinator.
- The mounted tests exercise meaningful behavior, but omit the contradictory failed-adoption state and asynchronous re-read races above.

**READINESS: NOT READY**

Codex session ID: 019fc92c-649e-73f0-aec3-c92759aea7d6
Resume in Codex: codex resume 019fc92c-649e-73f0-aec3-c92759aea7d6
