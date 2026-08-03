READINESS: NOT READY

F1 — CLOSED — `saved`, `committed:false`, revision R1 with `adoption:done` leaves `moved:false`, sets `invalidated:true`, disables choosing/submission, and reports `outOfDate`.

F2 — CLOSED — `sameIdentity` compares document, revision, and node; the exact cross-revision input is now movable, and the resulting stale-draft exposure is explicitly recorded.

F3 — CLOSED — with R1 projections, both the view-side check and `beginMove` reject the R0 session as `outOfDate`; `anchorUnavailable` is absent, and i18n has 36 parity-matched keys per language with no Spanish `atajo`.

F4 — CLOSED — the test supplies a non-empty `ScalarRestyled` note and verifies both value and reference preservation.

1. SEVERITY: HIGH — [matchMove.ts:1208](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/matchMove.ts:1208), [workspace.svelte.ts:1768](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/workspace.svelte.ts:1768), [en.json:295](/Users/ccarpio/Developer/espansoConfig/src/lib/i18n/en.json:295)

   Concrete failure: after `failed, mayHaveWritten:true`, `moveCouldNotBeSent` records only `sendFailure`; neither `canChoose` nor `refusalGiven` consults it. If the wrapper’s re-read fails and retains R0, the same move is immediately enabled for retry even though the message says to inspect the file first. If the re-read succeeds at R1, the new live check produces `outOfDate`, whose sentence says “Nothing has been written,” directly contradicting `mayHaveWritten`.

   Smallest fix: make `sendFailure.kind === 'mayHaveWritten'` a terminal, spent submission state with its own truthful refusal reason; block choosing and retrying until a new session is opened, and test successful and failed re-reads.

2. SEVERITY: HIGH — [workspace.svelte.ts:1813](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/workspace.svelte.ts:1813), [matchMove.ts:1170](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/matchMove.ts:1170), [2c-3b-1-notes.md:442](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-3b-1-notes.md:442)

   Concrete failure: a conflict installs its R1 disk projection but returns `adoption:notOwed`; consequently `applyMove` leaves `invalidated:false`. After dismissal, `canChoose` becomes true and `MatchMoveView.spent` remains false for a session whose identities were replaced. Current projections prevent submission, but the record falsely guarantees that adoption evidence invalidates “on every arm.” The new refused-plus-`ADOPTED` test uses a production-impossible pair and misses the real conflict-plus-`NOT_OWED` pair.

   Smallest fix: report the conflict projection installation as an owed/done adoption, or derive invalidation explicitly from the conflict arm; assert `invalidated`, `spent`, and `canChoose` using the production wrapper result.

3. SEVERITY: HIGH — [2c-3b-1-notes.md:133](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-3b-1-notes.md:133), [matchDeletion.ts:253](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/matchDeletion.ts:253)

   Concrete failure: the record says `identityInProjection` closes F2’s residual, but that function explicitly resolves only by arena node and must not follow a snippet across reparses. With draft A at R0/node 10 and unrelated B at R1/node 10, it returns B’s R1 identity; supplying that to `moveEligibility` falsely refuses B for `unsavedDraft`, recreating the original defect through the prescribed producer.

   Smallest fix: remove the claim that `identityInProjection` closes the residual. Step 2 needs a coordinator-owned relation that does not infer cross-revision identity, or must require the stale draft to be resolved before offering moves.

4. SEVERITY: HIGH — [2c-3b-1-notes.md:497](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-3b-1-notes.md:497), [matchMove.ts:1003](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/matchMove.ts:1003)

   Concrete failure: the record guarantees that the view and `beginMove` “cannot disagree by construction,” but they receive independent liveness inputs. `matchMoveView(session, R0Views)` reports `canMove:true` while `beginMove(session, identityInProjection(R1Views, session.match))` returns `null`. `$state` proxies themselves are harmless here; stale or different inputs are not forced away.

   Smallest fix: qualify the record guarantee as applying only to consistent liveness inputs, and require the eventual component to derive the view, options, and submission identity from one current projection read.

WHAT I COULD NOT CHECK

I could not run Vitest, `npm run check`, or the build because the workspace is read-only and those tools require temporary/cache output. I did not revalidate the referenced Rust behavior because it was outside the permitted file/import scope. Static checks found clean diff whitespace, exact i18n key/placeholder parity, no orphaned move key, and no hand-built dynamic translation key.

Codex session ID: 019fc8d2-b5d0-7c32-ab74-9717de529c16
Resume in Codex: codex resume 019fc8d2-b5d0-7c32-ab74-9717de529c16
