READINESS: NOT READY

F1 — BROKEN — `mayHaveWritten` is reachable, sticky, and terminal on the normal path, but it loses refusal precedence when combined with `moved`, and its new copy gives a false reason for blocking another move.

F2 — HOLDS — `conflict` now invalidates the session; `refused` and `saved/committed:false/same-revision/notOwed` do not, while committed or adopted saved results do.

F3 — HOLDS — the false `identityInProjection` claim is removed; hole 18 accurately records the missing cross-reparse draft relation.

F4 — HOLDS — every operative claim now says one rule agrees only over consistent liveness inputs and admits that callers can supply inconsistent ones.

Reachable flag combinations:

| `moved` | `invalidated` | `mayHaveWritten` | Producer | Refusal |
|---:|---:|---:|---|---|
| 0 | 0 | 0 | fresh, refused, `notSent`, same-revision no-op | contextual |
| 0 | 0 | 1 | uncertain failed send | `mayHaveWritten` |
| 0 | 1 | 0 | conflict or noncommitted adopted result | `conflict`, then `outOfDate` after dismissal |
| 1 | 1 | 0 | committed result | `alreadyMoved` |
| 0 | 1 | 1 | later/duplicate uncertain failure after invalidation | `mayHaveWritten` |
| 1 | 1 | 1 | later/duplicate uncertain failure after commit | `alreadyMoved` — contradictory |

No transition-produced state has `moved:true, invalidated:false`; a commit sets both. Every nonzero combination is spent and disables choosing.

1. HIGH — [matchMove.ts:1024](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/matchMove.ts:1024), [matchMove.ts:1336](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/matchMove.ts:1336), [en.json:295](/Users/ccarpio/Developer/espansoConfig/src/lib/i18n/en.json:295)

   Concrete failure: take an in-flight session, apply a committed result, then handle a second/late `mayHaveWritten` failure. Both flags remain true, but `refusalGiven` checks `moved` first and returns `alreadyMoved`. The view consequently combines a definite “This snippet has been moved” refusal with a `mayHaveWritten` send failure saying it may have moved or may not. Dismissal removes the uncertainty message while the hidden uncertainty flag remains.

   Smallest fix: give `mayHaveWritten` precedence over `moved`, use copy truthful for both `001` and `111`, and test the moved-plus-uncertain and invalidated-plus-uncertain orderings.

2. HIGH — [en.json:313](/Users/ccarpio/Developer/espansoConfig/src/lib/i18n/en.json:313), [es.json:313](/Users/ccarpio/Developer/espansoConfig/src/lib/i18n/es.json:313), [2c-3b-1-notes.md:642](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-3b-1-notes.md:642)

   Concrete failure: both languages and §8.1 say moving again could repeat an already-applied change. It cannot through this model: the session resends its frozen content-hash revision, so a successful first write makes that base stale; after reopening on the new revision, `alreadyThere` refuses the same destination. The terminal state is justified by uncertainty and stale identity, not duplicate execution.

   Smallest fix: replace the repetition claim with “this panel can no longer establish where the snippet is; inspect the file and reopen it.”

3. HIGH — [2c-3b-1-notes.md:730](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-3b-1-notes.md:730), [errors.ts:506](/Users/ccarpio/Developer/espansoConfig/src/lib/ipc/errors.ts:506), [matchMove.ts:1434](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/matchMove.ts:1434)

   Concrete failure: §8.5 says `reloadFile` is offered beside `mayHaveWritten` when its failure has one of four identity/sequence codes. That combination cannot exist: production `mayHaveWritten:true` only comes from `saveFailed`, while `reloadFile` is offered only for the four other codes. A real sync-directory failure produces `spent:true` and `recovery:[]`.

   Smallest fix: state that no `MoveRecovery` is offered for `mayHaveWritten`; the wrapper has already attempted its reread, and recovery is closing/reopening over a fresh projection.

4. MEDIUM — [matchMove.ts:165](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/matchMove.ts:165), [matchMove.ts:1273](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/matchMove.ts:1273)

   Concrete failure: the module header still says `invalidated` is produced “from the adoption `BrowserState.moveMatch` reports.” A conflict with `adoption:notOwed` now sets it solely from `result.outcome === 'conflict'`. The header contradicts the implementation and its own earlier conflict section.

   Smallest fix: say `applyMove` derives invalidation from committed/adoption evidence and from the conflict arm.

5. LOW — [matchMove.test.ts:747](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/matchMove.test.ts:747), [2c-3b-1-notes.md:485](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-3b-1-notes.md:485)

   Concrete failure: replacing refused-plus-`ADOPTED` with conflict-plus-`notOwed` correctly tests production, but it does not preserve its predecessor’s observation that an owed adoption invalidates a non-saved arm. Moving `adoption.kind !== 'notOwed'` inside the saved branch would now pass every adoption test while breaking the documented structural guarantee.

   Smallest fix: retain the production conflict test and add a separate structural non-saved/adopted test, or narrow the documented guarantee to wrapper-produced pairs.

6. LOW — [2c-3b-1-notes.md:727](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-3b-1-notes.md:727), [workspace.test.ts:1622](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/workspace.test.ts:1622)

   Concrete failure: §8.5 says all four §7.6 items remain unchanged and that every claim is still about model tests. This round added an integration case using `createBrowserState` and the real `state.moveMatch` answer.

   Smallest fix: say the no-screen limitation remains, while conflict invalidation now also has wrapper-level evidence.

The strengthened conflict-dismissal test, `notSent` assertions, real-wrapper conflict case, and nonempty-note replacement are non-vacuous. The latter three preserve or improve their predecessors except for the non-saved/adoption coverage noted above. Static i18n checks found exactly 37 keys per language, exact key and placeholder parity, no move `anchorUnavailable` key, no hand-built move translation key, and no Spanish `atajo`.

WHAT I COULD NOT CHECK

I could not run Vitest, `npm run check`, or the build because the read-only workspace prevents their temporary/cache output. The second fix round is not independently committed and the principal files are untracked, so predecessor comparison relied on the two prior reviews and the decision record rather than a mechanical round-to-round diff. I did not inspect Rust or fetch anything outside the permitted file/import scope.

Codex session ID: 019fc8e5-b564-7613-8ebe-1b166735dbac
Resume in Codex: codex resume 019fc8e5-b564-7613-8ebe-1b166735dbac
