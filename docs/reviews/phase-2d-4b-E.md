Reviewer: autoclaude adversarial reviewer

Phase 2d-4b-E. Subject: the comment block `6dba9f7` rewrote in
`src/lib/browser/workspace.test.ts`.

**Extent, re-derived first.** `git show 6dba9f7 -- src/ | grep -c '^@@'` → **1**. Every
changed line begins `//`. No executable line changed.

## M1 (Medium, source) — `workspace.test.ts:473-475`

*"What those two files have and this one does not is the `vi.hoisted` `invoked` spy, which
records the call on its way to rejecting."* True, and one clause short of what both other
files say of themselves: `DetailPane.test.ts:166-168` and `RestorePane.test.ts:441-443`
each call the spy *"a partial trap — `invoked` is asserted case by case and never in the
`afterEach`, so it catches nothing file-wide."* Re-derived: `expect(invoked).not
.toHaveBeenCalled()` occurs once in `DetailPane.test.ts` (534) and five times in
`RestorePane.test.ts` (808, 911, 941, 968, 1084); no `afterEach` reads it.

Wrong conclusion, in the paragraph a 2d-5 implementer reads while opening the drain: *the
binding route is already trapped in the two component suites.* It is not.
`2d-4b-notes.md` §10 records that round D "confirmed … the partial trap", so the limit was
known and not carried into the sentence it wrote. Mitigation, stated plainly: the
paragraph's closing clause tells the reader not to trust the comment.

## L1 (Low, source) — `workspace.test.ts:469-471`

*"it runs in node, where the real `invoke` dereferences `window.__TAURI_INTERNALS__` and
throws."* Measured: `node -e "try { window.__TAURI_INTERNALS__.invoke() } catch (e) {…}"`
→ `ReferenceError: window is not defined`. No dereference occurs; the throw is on the
identifier. The mechanism described (window present, property absent → `TypeError`) is
**jsdom's**, the environment this sentence's own premise excludes. Conclusion unaffected.

## Clauses that hold

No `@vitest-environment` docblock (`rg` matches only line 468; `vite.config.ts:65` sets
`node`, no `setupFiles`). No `vi.mock(` in the file. `core.js:201-203` and
`commands.ts:249-254` are as cited; `drainExternalChanges` (`commands.ts:918-922`) routes
through `call()`; `classifyFailure` (`errors.ts:768-785`) never rethrows — so "swallowed in
all three" holds. Both component mocks record then reject (`DetailPane.test.ts:66-71`,
`RestorePane.test.ts:117-122`). Sixteen wrappers = 13 `REAL_COMMANDS` (315-329) + 3
`REAL_BACKUP_COMMANDS` (387-391); two surfaces injected at 1507/1509. `npx vitest run
src/lib/browser/workspace.test.ts` → **186 passed**, exit 0. Attributions match §5 (254,
2d-4b, injected) and §8.2 (186, 2d-4b-B, binding).

## Not verified

254 itself — re-deriving means mutating source; forbidden, and §10.7 item 2 records it.
`window` absent under vitest's node env is reasoned from config plus bare node, not from a
vitest run (a probe file is outside read-only scope). Workspace gates not re-run; figures
taken from the brief. Whether 2d-4b-B's binding probe failed anything in the component
suites is unrecorded and unmeasured; M1 does not depend on it.

Not re-filed per brief: §9.5/§10.7 items 1, 2, 4, 5.
