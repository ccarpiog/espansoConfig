Reviewer: autoclaude adversarial reviewer

# Phase 2d-4b-F — review of 2d-4b-E's fix (commit `081ea14`)

Subject: `src/lib/browser/workspace.test.ts`, the route paragraph at `:453-488`.
**Hunk count re-derived before reading any claim about it: `git show 081ea14 -- src/ | grep -c '^@@'` → 1.**
Working tree clean. Every changed line is a comment.

## Every clause of the new text, checked against code

Re-derived, all correct:

- `@tauri-apps/api/core.js:202` is `return window.__TAURI_INTERNALS__.invoke(cmd, args, options);` (201 is the `async function invoke` header). The identifier `window` is evaluated there, so `ReferenceError` before any property access is the right mechanism.
- No `@vitest-environment` docblock in the file — the only match at `:468` is the comment's own words. `vite.config.ts:65` is `environment: 'node'`; that config has no `setupFiles` and no `globalSetup`, and there is no `vitest.config.ts` or `vitest.workspace.ts` in the tree.
- `call()` (`src/lib/ipc/commands.ts:249-255`) `await`s inside `try`, and `classifyFailure` (`src/lib/ipc/errors.ts:775-777`) returns for `raw instanceof Error` rather than rethrowing. Swallowed, as claimed.
- The file mocks nothing: no `vi.mock(` anywhere in it; its only `vi.hoisted` match is the comment's own text.
- `expect(invoked).not.toHaveBeenCalled()` — `DetailPane.test.ts:534` (**one**), `RestorePane.test.ts:808, 911, 941, 968, 1084` (**five**), in six distinct `it` blocks (`:516`; `:771, 877, 915, 947, 1069`). **Six cases.**
- Neither `afterEach` reads the spy. `DetailPane.test.ts:341-350` and `RestorePane.test.ts:759-768` both read `drains` and assert `0`; the `mockClear()` calls are in `beforeEach` (`:337`, `:755`).
- Cited limits are where claimed: `DetailPane.test.ts:164-168`, `RestorePane.test.ts:439-443`.
- Both component mocks do reject (`DetailPane.test.ts:68-72`, `RestorePane.test.ts:119-123`), so "records on its way to rejecting" holds.
- Sixteen wrappers (`workspace.svelte.ts:45-60`), thirteen in `REAL_COMMANDS` (`:315-329`), three in `REAL_BACKUP_COMMANDS` (`:387-391`), two injected surfaces (`:1507`, `:1509`).
- `npx vitest run src/lib/browser/workspace.test.ts` → **186 passed**, live.

Also checked and **not** a finding: six test files call `createBrowserState`, so the binding route is live in three more (`MatchDeleter`, `MatchMover`, `MatchDuplicator`). None counts drains, so none carries a file-wide bound a drain could falsify; "the three suites that count" at `:463` correctly scopes "all three" at `:486`. And `workspace.svelte.ts:44-60` stops one line short of the statement's `} from '../ipc/commands';`, but lands a reader on exactly the sixteen names — no wrong conclusion.

**No defect found in the reviewed hunk.** 0 High, 0 Medium in source.

## SHOULD-FIX 1 — the record's own re-measured figure is still wrong in one half

`docs/decisions/2d-4b-notes.md` §11.7 item 6: *"489-497 are `drainExternalChanges`"*, *"the stub is 9"*. The stub is `workspace.test.ts:489-496` — **eight** lines; `:497` is `};` closing the object literal `scriptedCommands()` returns, and `:498` closes the function. The other three figures re-derive exactly: comment run `:446-488` (43), paragraph `:453-488` (36).

The wrong conclusion this invites is small but exact: a reader of §11.7 item 6 weighing "43 lines of comment over a 9-line stub" is reasoning about a ratio that is really 43:8. What makes it worth writing down is where it sits — the same item's parenthetical records that its own previous figure was *"estimated rather than counted, and it was wrong in both halves"*, and the replacement, labelled *"Measured after the fix, not estimated"*, is wrong in one. That is §11.4's shape a fourth time, inside the section that exists to record it.

Prose only. Under `CLAUDE.md` §7.1 fixing it commissions no round.

## SHOULD-FIX 2 — restructure rather than repair a sixth time (§11.7 item 6's open question)

**View: the paragraph does not earn its length, and the specific reason is that four of its sentences are unverifiable-by-construction cross-file citations.**

`DetailPane.test.ts:164-168`, `RestorePane.test.ts:439-443`, `DetailPane.test.ts:341-350`, `RestorePane.test.ts:759-768`, plus `@tauri-apps/api/core.js:202`, `workspace.svelte.ts:44-60`, and the counts *one*, *five*, *six*, *sixteen*, *thirteen*, *three*. Nothing in this repository checks any of them. `npm run check`, `npm test`, the markup scan and clippy are all blind to a comment, so **any edit to either component suite silently falsifies four line ranges in a third file, and the falsification is invisible until a human counts again** — which is what five consecutive rounds have been paying for. That is not a property of this paragraph's prose quality; it is a property of putting a dated cross-file measurement in a source comment, where it claims to be current.

The asymmetry is the point: `docs/decisions/2d-4b-notes.md` is allowed to be a dated snapshot and already holds every one of these figures with its derivation (§11.1, §11.2). Move the counts, the four line ranges and the two probe figures there; leave in `workspace.test.ts` the two sentences that are true of *this file's own code* and cite nothing outside it — the bound is the injection, the module-level binding route escapes it, 2d-5 owns closing it, see `2d-4b-notes.md` §11. That is roughly six lines instead of thirty-six, and it removes the fuel: a stale figure in `docs/` is a record defect, which under §7.1 commissions no round, whereas the identical staleness in the comment is a source defect that does.

Counter-argument, stated because it is real: the comment is read by a 2d-5 implementer who may not open the record, and a pointer costs them a hop. It does not outweigh five rounds of measured decay, and the pointer keeps the load-bearing warning in the file.

## NOT-VERIFIED

- **That `globalThis.window` is `undefined` under vitest's node environment.** I am read-only and did not take the orchestrator's probe. I **reasoned** it from `vite.config.ts:65` (`environment: 'node'`), the absence of `setupFiles`/`globalSetup`, the absence of any other vitest config file, and node's own unresolvable-reference semantics. Labelled as reasoning, not measurement; the orchestrator's recorded probe is the measurement.
- **The 254 figure** (Phase 2d-4b, injected surface, three suites). Taken on trust from `2d-4b-notes.md` §5; re-deriving it means mutating source. Residue 2.
- **2d-4b-B's "186 passed, 0 failed" as a historical claim about the binding probe.** I re-derived that this suite reports 186 passed today with no probe installed; I did not reinstall the probe, and what it did to the two component suites remains unrecorded. Residue 3.
- **Every workspace-wide gate**: `cargo test --workspace` (instructed not to start it), clippy, fmt, `cargo tree`, `npm run check`, `npm test`, `npm run build`, both bundle oracles. All taken from the brief's table.
- Residues 1, 4 and 5 of §11.7 are acknowledged and not re-filed.
