Reviewer: autoclaude adversarial reviewer

# Phase 2d-6-10 — adversarial review

## BLOCKERS

None found.

- Registration and removal are synchronous. `subscribe` returns a closure that removes the exact `onVisibilityChange`/`onFocus` functions it added (`domForeground.ts`). The mounted case compares the removed listener arguments against the added ones by identity (`toEqual` on the function arrays).
- Negative-control reasoning holds. With the inert source, the visible, focus, coalesce and unmount mounted cases would fail, because each one needs a 4th invoke or a registered listener. Only the "gate closed" case would still pass, and the notes say so.

## SHOULD-FIX

1. `src/lib/browser/domForeground.ts` header, "No timer and no debounce" paragraph: "two signals in one block — a `visibilitychange` and a `focus` delivered together when the window comes forward — are coalesced by the coordinator's pump". The coalescing is real only within one synchronous turn. `pump()` begins with `await Promise.resolve()` and then sets `requested = false` before `await runOneDrain()` (`reconciliationCoordinator.ts:1612-1616`). If the two events arrive as separate tasks, which is what the HTML spec's separate visibility-update and focus-update steps normally produce, the second request lands while the drain is in flight and causes one follow-up drain. The comment presents "delivered together when the window comes forward" as host behaviour. The window reading saw no real foreground event at all. The same unverified claim is in `AppShell.test.ts`, coalesce case: "What a window coming forward typically dispatches: both signals in one turn." This is the §5 false-guarantee class. Reword both to say that same-turn signals coalesce, that separate-task signals cost at most one follow-up drain, and that the host's delivery order is unread.
2. `docs/decisions/2d-6-10-notes.md` §3, row "Mounted: triggers coalesce — Met": qualify it as same-turn only, for the same reason.

## Risks probed

- (1) Sync and exact-function removal: confirmed. A double unsubscribe is a no-op, and the `live` flag guards a target that does not honour removal.
- (2) Double-drain: none within one turn. Across tasks there is one follow-up drain, which the SHOULD-FIX items cover.
- (3) The `reconciliationCoordinator.ts` `ForegroundSource` doc and the module-header corrections claim only what the code forces. The added sentence "Nothing in TypeScript stops a source from returning an unsubscribe that defers its real removal" is accurate.
- (4) The window reading does not overclaim. It states a locked screen, no activation, a synthetic `focus` only, and wake/resume unread. The notes mark the reading clause "Met in part".
- (5) See the negative-control point above.

## NOT-VERIFIED

- The full `npm test`, `npm run check` and `npm run build` were not re-run. Only the two touched suites were re-run: `npx vitest run domForeground.test.ts AppShell.test.ts` gave 23 passed.
- Whether WKWebView dispatches `focus` and `visibilitychange` in one task or in separate tasks is a host fact that needs an unlocked window reading.
- The instrument files were not reviewed, as the brief directs.
