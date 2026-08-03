1. **Low — F5’s new invalidation producer is missing from the module-level contract**  
   [matchMove.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/matchMove.ts:173)

   The header still says `invalidated` represents a replaced projection and that `applyMove` is its only producer. `moveRecoveryFailed` is now another producer and explicitly does not replace the projection. The field-level documentation is correct, but the module-level guarantee is not.

   Minimal fix: describe `invalidated` as identities the session can no longer vouch for, and include `moveRecoveryFailed` as the non-replacement producer.

2. **Low — the spent-session prose still excludes failed recovery re-reads**  
   [2c-3b-2-notes.md](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-3b-2-notes.md:95)  
   [MatchMover.svelte](/Users/ccarpio/Developer/espansoConfig/src/lib/components/MatchMover.svelte:127)

   Both passages claim every spent `outOfDate` session came from a parse that is gone. After `moveRecoveryFailed`, the projection remains installed; the command has contradicted its identity, but the parse is not gone. This is precisely the new F5 history those descriptions need to cover.

   Minimal fix: qualify both statements to include identities contradicted by the command after a failed recovery re-read.

3. **Low — F1 comments and its workspace-replacement test state the opposite counter policy from the code**  
   [workspace.svelte.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/workspace.svelte.ts:1819)  
   [workspace.test.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/workspace.test.ts:1585)

   These say `open()` clears the re-read counters. It does not; `rereadGenerations` is deliberately monotonic and its defining comment and decision record correctly say it is not cleared. `open()` clears only `projectionGenerations`.

   Minimal fix: rewrite the two comments to say the re-read counter cannot by itself distinguish workspaces, while `openGeneration` provides that separation.

The behavioral fixes themselves are sound:

- All three F1 generations are captured before the await; failures remain reported; counters are keyed by `DocumentId`; both race tests force delayed older completion.
- All five English/Spanish messages match in strength. In particular, `cannotMove.outOfDate` is true for ordinary stale projections and failed recovery reads; its “this move wrote nothing” clause is protected by refusal precedence.
- `moveRecoveryFailed` disables choosing and sending, survives dismissal, and leaves the workspace counters and projection untouched.
- R37, `notMovable` suppression, the repaired `moveMatch` behavior, and refusal precedence remain intact.

Because the confirmation scope explicitly includes prose guarantees, the remaining contradictory documentation prevents a clean pass.

**READINESS: NOT READY**

Codex session ID: 019fc940-9593-7531-be2c-3af77487595a
Resume in Codex: codex resume 019fc940-9593-7531-be2c-3af77487595a
