# Review brief — Phase 2d-5-3-L

Repo: `/Users/ccarpio/Developer/Utils/espansoConfig` (branch `main`, HEAD `26fa26a`; the only change
HEAD carries over `aa025fa` is `PROGRESS.md`).
Review file — write your full report there, overwriting: `docs/reviews/phase-2d-5-3-L.md`.
Time budget: 10 minutes.

## Phase and goal

Phase 2d-5-3-L is round 12 of the `reconciliationCoordinator.ts` review tail — the round `CLAUDE.md`
§7.1 commissioned because Phase 2d-5-3-K's fix changed one source file. The goal of this round is to
review THAT fix, cold: is what it wrote true of the code?

## What to review — the whole scope, and nothing else

The change under review is ALREADY COMMITTED as `aa025fa` (Phase 2d-5-3-K). Read it with:

    git show aa025fa --stat
    git show aa025fa -- src/lib/browser/reconciliationCoordinator.ts
    git show aa025fa -- docs/decisions/2d-5-3-J-notes.md

1. `src/lib/browser/reconciliationCoordinator.ts` — comment-only, two rewritten passages (21 lines
   changed, around lines 763–805 on HEAD):
   (a) the sentence describing what the coordinator DOES do in `src/lib/browser/workspace.test.ts`'s
       test *"lets the newer open win, however late the older one answers"*, together with the
       narrowed two-witness claim above it (*"The two tests that come nearest drive that overlap
       somewhere other than Rust, and nothing wider is claimed here"*);
   (b) the *"swap block that early return skips"* rewrite.
2. `docs/decisions/2d-5-3-K-notes.md` in full — every claim it makes about the code, the tests and
   commit `3428cde`.
3. The four correction blocks 2d-5-3-K wrote into `docs/decisions/2d-5-3-J-notes.md`
   (`rg -n 'Correction, 2d-5-3-K' docs/decisions/2d-5-3-J-notes.md`).

## The instruction that has found the substantive finding of every round of this tail

**Check the comments against the code, not the code against the comments.** Hunt the ADDITIONS: this
fix replaced an absence claim with a MECHANISM description, and a mechanism has more surfaces. Each of
the propositions below is asserted in the new comment text or in the notes, and nothing in the
repository pins any of them — read the code and decide whether each is true:

- `createBrowserState` in `src/lib/browser/workspace.svelte.ts` constructs the coordinator
  unconditionally;
- every `open()` calls `reconciliation.workspaceOpened()` synchronously, before its first await;
- the open that WINS reaches `reconciliation.workspaceReady()`, and a superseded one returns before it;
- `workspaceReady()`'s body is a `requestDrain('workspaceOpened')`;
- `requestDrain` REMEMBERS rather than issues that reason, because `drainMayStart()` is
  `started && !disposed && !awaitingReady()` and `started` is false in that test — i.e. the test never
  calls `start()`;
- the test *"lets the newer open win, however late the older one answers"* overlaps two opens and
  issues no drain at all;
- `reconciliationCoordinator.test.ts`'s *"installs nothing from a drain an open overtook"* moves the
  generation on the injected host and says nothing about Rust;
- *"the two tests that come nearest"* — is any third test in the repository nearer to driving an
  open landing during a drain against Rust?
- `reconciliation.begin_epoch` in `src-tauri/src/commands.rs` (`WorkspaceSession::open`) is reached
  only inside the swap block that the early return (a failed `Workspace::discover(root)?`) skips —
  and does *"that early return"* have an unambiguous antecedent where it now sits?

Read `open()` in `workspace.svelte.ts` IN FULL, not the lines the notes quote — 2d-5-3-K found its
own error in exactly the sentence it had not yet read to the end of.

Also check `2d-5-3-K-notes.md` §3 and §4: were the anchors it says do not resolve actually wrong on
`3428cde` (`git show 3428cde:docs/decisions/2d-5-3-J-notes.md`, and the source files at that
commit), and is its own account of the sweep in §4 complete? Check §5's "found sound" list against
the code — a false *"holds"* is worse than a missed finding. Every line number or count the notes
assert is a claim about a tree; re-derive it rather than accept it, and say which tree you measured.

## Verification already run by the orchestrator — do not repeat it

All four gates green on the tree 2d-5-3-K committed: `cargo test --workspace -- --test-threads=1`
→ 1320 passed across 26 `test result` lines, none lacking `0 failed`; clippy `-D warnings` exit 0;
`cargo fmt --check` exit 0; `cargo tree -p espansoconfig-core` finds no `tauri`; `npm run check` →
441 files, 0 errors, 0 warnings; `npm test` → 2307 passed; `npm run build` → 188 modules, server-only
markers absent, client-only markers present. The source diff was proven comment-only mechanically.
The orchestrator is re-running the same gates on the inherited tree while you read.

## HARD RULE — run NO build, test, lint, package or cargo command of any kind

Not `cargo test`, `cargo build`, `cargo check`, `cargo clippy`, `npm test`, `npm run check`,
`npm run build`, `npx vitest`, `npx svelte-check`, `tsc` — nothing that compiles, tests or bundles.
This host has a measured filesystem-watcher concurrency scar: any such run concurrent with the
orchestrator's corrupts BOTH readings. Review by reading. `git show`, `git log`, `git grep`, `rg`,
`cat`, `sed`, `awk` are fine. State under NOT-VERIFIED that no build/test command was run, by
instruction.

## Recorded risks and things not to touch

- The working tree is deliberately not clean: `src-tauri/src/main.rs` and `src/main.ts` (modified)
  and `src-tauri/src/probe.rs` and `src/probe.ts` (untracked) are a window-reading instrument that is
  never committed. They are OUT OF SCOPE: do not treat them as part of the change, and do not modify,
  revert or commit them.
- `PROGRESS.md`, `PROGRESS.json` and `docs/progress-archive/` may change under you while you read;
  they are the orchestrator's checkpoint and are not in scope.
- Reviewer arithmetic was wrong in each of the last two rounds: quote the line you are pointing at
  and give its number on HEAD so the orchestrator can re-derive it.
- Severity: a false statement in a source comment is SHOULD-FIX (Medium); a stale line anchor or a
  wrong count in a `docs/` record is SHOULD-FIX (Low, unless it changes a conclusion). Finding
  nothing at a severity is a valid answer; this tail's records treat a fabricated finding as worse
  than a missed one.

## Report

Write the full report (400 words max) to `docs/reviews/phase-2d-5-3-L.md`. Its first line must read
exactly `Reviewer: autoclaude adversarial reviewer`; end with the four keys VERDICT / BLOCKERS /
SHOULD-FIX / NOT-VERIFIED. Return only those four lines to the orchestrator.
